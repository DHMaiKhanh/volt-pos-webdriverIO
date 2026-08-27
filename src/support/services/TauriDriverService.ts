import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Paths } from '../../../configs/constants/paths.js';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';
import { moduleLogger } from '../../utils/logger.js';
import { waitForPortFree, waitForPortOpen } from '../net.js';

const log = moduleLogger('TauriDriverService');

/**
 * Where a driver binary might live, best first.
 *
 * `.drivers/` is what `npm run setup:drivers` fills, and it is preferred over
 * whatever happens to be on PATH so a machine with an unrelated msedgedriver
 * installed for browser work does not quietly get used against WebView2.
 */
function resolveBinary(explicit: string, fileName: string, extraDirs: string[] = []): string | null {
  if (explicit && fs.existsSync(explicit)) return explicit;

  const searched = [path.join(Paths.DRIVERS, fileName), ...extraDirs.map((d) => path.join(d, fileName))];
  for (const candidate of searched) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolveTauriDriver(explicit = ''): string | null {
  return resolveBinary(explicit, 'tauri-driver.exe', [path.join(os.homedir(), '.cargo', 'bin')]);
}

export function resolveMsEdgeDriver(explicit = ''): string | null {
  return resolveBinary(explicit, 'msedgedriver.exe');
}

/**
 * Variables forwarded into the application process.
 *
 * Any `APP_ENV_FOO=bar` in the environment file reaches the app as `FOO=bar`.
 * The prefix is required so a stray variable in someone's shell cannot leak
 * into the binary under test and change its behaviour invisibly — a run must be
 * reproducible from `configs/env/.env.<ENV>` alone.
 *
 * The intended use is WebView2 tuning, e.g.
 *   `APP_ENV_WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-gpu`
 */
export function appEnvPassthrough(): NodeJS.ProcessEnv {
  const forwarded: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('APP_ENV_') && value !== undefined) {
      forwarded[key.slice('APP_ENV_'.length)] = value;
    }
  }
  return forwarded;
}

/**
 * Runs `tauri-driver` for the lifetime of ONE WebdriverIO session.
 *
 * ## Why per-session and not once per run
 *
 * tauri-driver proxies a single WebDriver session to the native driver and does
 * not reliably reset between sessions — a second `newSession` against the same
 * long-lived process can inherit the previous app's window handles. Restarting
 * it per spec file costs about a second, which is noise next to the app's own
 * boot, and removes an entire class of cross-spec contamination.
 *
 * ## Why the environment is set HERE
 *
 * tauri-driver launches the app as a CHILD process, so the app inherits this
 * process's environment. That is the only injection point available: the
 * WebDriver capability set has no field for the application's env, and the
 * binary reads its configuration at startup. Anything the app must see —
 * WebView2 browser arguments in particular — has to be in `env` below.
 */
export default class TauriDriverService {
  private child: ChildProcess | null = null;
  private exited = false;

  async beforeSession(): Promise<void> {
    const env = loadEnv();

    if (env.MODE === 'attach') {
      log.info('MODE=attach — not starting tauri-driver; connecting to a running app instead.');
      return;
    }

    const driver = resolveTauriDriver(env.TAURI_DRIVER_PATH);
    if (!driver) {
      throw new Error(
        'tauri-driver was not found.\n' +
          `Looked in ${Paths.DRIVERS} and ~/.cargo/bin.\n` +
          'Fix: npm run setup:drivers   (or: cargo install tauri-driver --locked)',
      );
    }

    const native = resolveMsEdgeDriver(env.MSEDGEDRIVER_PATH);
    const args = ['--port', String(env.DRIVER_PORT)];
    if (native) args.push('--native-driver', native);

    // A previous session's socket can linger in TIME_WAIT on Windows.
    await waitForPortFree(env.DRIVER_HOST, env.DRIVER_PORT, Timeouts.SHORT).catch((error: unknown) => {
      log.warn(`Port ${env.DRIVER_PORT} still busy: ${(error as Error).message}`);
    });

    log.info(`Starting tauri-driver: ${driver} ${args.join(' ')}`);
    if (!native) {
      log.warn(
        'No msedgedriver resolved — tauri-driver will fall back to whatever is on PATH. ' +
          'It MUST match the WebView2 Runtime version or the session hangs silently.',
      );
    }

    this.exited = false;
    this.child = spawn(driver, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      // Inherited by tauri-driver AND, through it, by the app itself.
      env: { ...process.env, ...appEnvPassthrough() },
    });

    this.child.stdout?.on('data', (chunk: Buffer) => log.debug(chunk.toString().trimEnd()));
    this.child.stderr?.on('data', (chunk: Buffer) => log.debug(chunk.toString().trimEnd()));

    this.child.on('error', (error) => {
      log.error(`tauri-driver failed to start: ${error.message}`);
    });

    this.child.on('exit', (code) => {
      if (!this.exited) log.error(`tauri-driver exited unexpectedly with code ${String(code)}`);
    });

    await waitForPortOpen(env.DRIVER_HOST, env.DRIVER_PORT, Timeouts.DRIVER_READY);
    log.info(`tauri-driver ready on ${env.DRIVER_HOST}:${env.DRIVER_PORT}`);
  }

  afterSession(): void {
    if (!this.child) return;
    this.exited = true;
    this.child.kill();
    this.child = null;
    log.info('tauri-driver stopped');
  }
}
