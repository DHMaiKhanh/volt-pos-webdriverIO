import { setTimeout as delay } from 'node:timers/promises';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { loadEnv } from '../../configs/env/loadEnv.js';
import { moduleLogger } from '../utils/logger.js';
import { isPortOpen, waitForPortFree, waitForPortOpen } from './net.js';
import { killStaleProcesses, launchDetached } from './process.js';
import { appEnvPassthrough, resolveMsEdgeDriver } from './services/TauriDriverService.js';

const log = moduleLogger('attachApp');

export interface CdpTarget {
  type?: string;
  url?: string;
  title?: string;
}

/**
 * Stuck screens the rootHooks recovery (`returnToHome`) cannot escape — an app
 * sitting on one would only cascade into the next file: a half-finished
 * `/order/…/checkout`, a `/split-order` with no nav bar, the `/force-update`
 * route, or a bare `about:blank`. Everything else ON tauri.localhost — /home,
 * /login, /splashscreen, an order or pending/history list — is a screen the next
 * file's `ensureLoggedIn` + `returnToHome` can recover from, so it counts as
 * drivable. (A freshly launched app sits on splash/login until a spec drives it
 * to /home, so requiring /home here would relaunch a perfectly good app.)
 */
const STUCK_PATH = /\/checkout$|\/split-order$|\/force-update/;

export function isDrivableTarget(target: CdpTarget): boolean {
  if (target.type !== 'page') return false;
  try {
    const url = new URL(target.url ?? '');
    return url.hostname === 'tauri.localhost' && !STUCK_PATH.test(url.pathname);
  } catch {
    return false; // about:blank, devtools://, an empty url — not drivable
  }
}

/**
 * Is a drivable Volt POS webview answering on the CDP port right now?
 *
 * More than "the port is open": after a crash or a force-update the socket can
 * linger with only an `about:blank` / `/force-update` target, and a wedged spec
 * can leave the app stuck mid-checkout — both read as "up" on a plain port probe
 * but neither is drivable by the next file. Require a `page` target on a ready
 * route ({@link isReadyUrl}). Polled a few times so a brief mid-navigation blip
 * does not trigger a needless relaunch.
 */
export async function isAttachedAppHealthy(tries = 3): Promise<boolean> {
  const env = loadEnv();
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await isPortOpen(env.DRIVER_HOST, env.REMOTE_DEBUG_PORT)) {
      try {
        const res = await fetch(`http://${env.DRIVER_HOST}:${String(env.REMOTE_DEBUG_PORT)}/json/list`);
        const targets = (await res.json()) as CdpTarget[];
        if (targets.some(isDrivableTarget)) return true;
      } catch {
        /* CDP not answering yet — fall through to the retry */
      }
    }
    if (attempt < tries - 1) await delay(1_000);
  }
  return false;
}

/**
 * Launch the installed app (WebView2 remote debugging on) and `msedgedriver` for
 * attach mode — the same wiring as `scripts/launch-app.ts`, callable mid-run so a
 * wedged app can be replaced with a fresh one.
 */
export async function launchAttachedApp(): Promise<void> {
  const env = loadEnv();
  if (!env.APP_PATH)
    throw new Error('attach relaunch: APP_PATH is unresolved (set it in configs/env/.env.<ENV>).');

  const msEdgeDriver = resolveMsEdgeDriver(env.MSEDGEDRIVER_PATH);
  if (!msEdgeDriver) throw new Error('attach relaunch: msedgedriver not found. Fix: npm run setup:drivers');

  // single-instance would hand a new launch to the old window, so clear both first.
  killStaleProcesses({ app: true, drivers: true });
  await waitForPortFree(env.DRIVER_HOST, env.REMOTE_DEBUG_PORT, Timeouts.SHORT).catch(() => undefined);
  await waitForPortFree(env.DRIVER_HOST, env.DRIVER_PORT, Timeouts.SHORT).catch(() => undefined);

  const browserArgs = `--remote-debugging-port=${String(env.REMOTE_DEBUG_PORT)}`;
  const appPid = launchDetached(env.APP_PATH, env.APP_ARGS, {
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: browserArgs,
    ...appEnvPassthrough(),
  });
  log.warn(
    `attach relaunch: launched ${env.APP_PATH} (pid ${String(appPid)}); waiting for CDP ${String(env.REMOTE_DEBUG_PORT)}`,
  );
  await waitForPortOpen(env.DRIVER_HOST, env.REMOTE_DEBUG_PORT, Timeouts.APP_BOOT);

  const driverPid = launchDetached(msEdgeDriver, [`--port=${String(env.DRIVER_PORT)}`], {});
  await waitForPortOpen(env.DRIVER_HOST, env.DRIVER_PORT, Timeouts.DRIVER_READY);
  log.warn(`attach relaunch: msedgedriver up (pid ${String(driverPid)}) on ${String(env.DRIVER_PORT)}`);

  // The CDP socket binds before the splash paints its first route; wait for the
  // webview to show a drivable target so the next file attaches to a live app.
  const booted = await isAttachedAppHealthy(Math.ceil(Timeouts.APP_BOOT / 1_000));
  if (!booted)
    log.warn(
      'attach relaunch: app came up but never showed a drivable screen — the next file may still need to recover.',
    );
}

/**
 * Make sure a healthy, attachable app is up before a spec file's session.
 *
 * Returns whether it had to (re)launch. A no-op when the app the operator (or the
 * previous file) left on /home is still healthy — the common case, which keeps the
 * open-once speed. A relaunch happens only when the previous file wedged or crashed
 * the app, which is what stops the no-self-heal cascade. Also covers the FIRST file
 * when nobody ran `app:launch`, so the attach lane can start the app itself.
 */
export async function ensureHealthyAttachedApp(): Promise<boolean> {
  if (await isAttachedAppHealthy()) return false;
  log.warn('attach: no healthy app on /home — (re)launching a fresh one for this spec file.');
  await launchAttachedApp();
  return true;
}
