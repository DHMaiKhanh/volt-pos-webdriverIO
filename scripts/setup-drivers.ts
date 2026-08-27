/**
 * `npm run setup:drivers`
 *
 * Puts both WebDriver binaries this suite needs into `.drivers/`:
 *
 *   tauri-driver.exe  — proxies WebDriver to the Tauri app (installed with cargo)
 *   msedgedriver.exe  — the NATIVE driver tauri-driver delegates to on Windows
 *
 * ## The one thing that matters here
 *
 * `msedgedriver` must match the **WebView2 Runtime** version, not "roughly", not
 * "same major". A mismatch does not raise an error — the session hangs until
 * WebdriverIO's connection timeout, and the failure surfaces later as a broken
 * selector or a dead spec file. That is why this script reads the runtime
 * version out of the registry and downloads exactly that build, and why it
 * prints both numbers side by side at the end.
 *
 * Everything here is idempotent: re-running it reports what it skipped.
 * `--force` re-installs regardless.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { Paths } from '../configs/constants/paths.js';

/**
 * Registry homes of the two Edge-family version numbers.
 *
 * The GUID is the Evergreen WebView2 Runtime's EdgeUpdate client id and is
 * stable across releases. The 32-bit view (`WOW6432Node`) is where EdgeUpdate
 * writes on 64-bit Windows — reading the native view silently finds nothing.
 * The Edge browser key is only a fallback: WebView2 and Edge usually ship the
 * same build, but they can drift, and it is WebView2 that hosts the app.
 */
const WEBVIEW2_RUNTIME_KEY = String.raw`HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`;
const EDGE_STABLE_KEY = String.raw`HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{56EB18F8-B008-4CBD-B6D2-8C97FE7E9062}`;

const DRIVER_CDN = 'https://msedgedriver.microsoft.com';
const TAURI_DRIVER_EXE = 'tauri-driver.exe';
const MSEDGEDRIVER_EXE = 'msedgedriver.exe';

const force = process.argv.includes('--force');

const line = (text = ''): void => console.log(text);
const rule = (): void => line('-'.repeat(78));

function banner(title: string): void {
  line();
  line('='.repeat(78));
  line(` ${title}`);
  line('='.repeat(78));
}

function ok(text: string): void {
  line(`  [ OK ]  ${text}`);
}
function skip(text: string): void {
  line(`  [SKIP]  ${text}`);
}
function info(text: string): void {
  line(`  [INFO]  ${text}`);
}
function warn(text: string): void {
  line(`  [WARN]  ${text}`);
}
function fail(text: string): void {
  line(`  [FAIL]  ${text}`);
}

// ── Version helpers ─────────────────────────────────────────────────────────

const VERSION_RE = /(\d+\.\d+\.\d+\.\d+)/;

function regQuery(key: string, value: string): string | null {
  try {
    const out = execFileSync('reg', ['query', key, '/v', value], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    // `    pv    REG_SZ    151.0.4129.107`
    const match = VERSION_RE.exec(out);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

interface RuntimeVersion {
  version: string | null;
  source: 'WebView2 Runtime' | 'Edge browser (fallback)' | 'none';
}

function detectWebView2Version(): RuntimeVersion {
  const runtime = regQuery(WEBVIEW2_RUNTIME_KEY, 'pv');
  if (runtime) return { version: runtime, source: 'WebView2 Runtime' };

  const edge = regQuery(EDGE_STABLE_KEY, 'pv');
  if (edge) return { version: edge, source: 'Edge browser (fallback)' };

  return { version: null, source: 'none' };
}

/** `exe --version`, parsed down to the dotted quad. Null when it will not run. */
function binaryVersion(exe: string, flag = '--version'): string | null {
  try {
    const out = execFileSync(exe, [flag], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15_000,
    });
    return VERSION_RE.exec(out)?.[1] ?? out.trim().split('\n')[0]?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── Download / extract (no npm dependencies on purpose) ─────────────────────

function showProgress(received: number, total: number): void {
  if (!process.stdout.isTTY) return;
  const mb = (n: number): string => (n / 1024 / 1024).toFixed(1);
  const pct = total > 0 ? `${String(Math.floor((received / total) * 100)).padStart(3)}%` : '  ??%';
  process.stdout.write(`\r          ${pct}  ${mb(received)} / ${total > 0 ? mb(total) : '?'} MB   `);
}

function clearProgress(): void {
  if (process.stdout.isTTY) process.stdout.write('\r'.padEnd(60) + '\r');
}

function downloadToFile(url: string, dest: string, redirectsLeft = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'volt-pos-e2e/setup-drivers' } }, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;

      // The CDN fronts blob storage and answers 30x for some builds.
      if (status >= 300 && status < 400 && location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects while downloading ${url}`));
          return;
        }
        void downloadToFile(new URL(location, url).toString(), dest, redirectsLeft - 1).then(resolve, reject);
        return;
      }

      if (status !== 200) {
        res.resume();
        reject(new Error(`HTTP ${String(status)} for ${url}`));
        return;
      }

      const total = Number(res.headers['content-length'] ?? 0);
      let received = 0;
      const file = fs.createWriteStream(dest);

      res.on('data', (chunk: Buffer) => {
        received += chunk.length;
        showProgress(received, total);
      });
      res.on('error', reject);
      file.on('error', reject);
      file.on('finish', () => {
        clearProgress();
        resolve();
      });
      res.pipe(file);
    });

    request.on('error', reject);
    request.setTimeout(120_000, () => {
      request.destroy(new Error(`Timed out downloading ${url}`));
    });
  });
}

function fetchText(url: string, redirectsLeft = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'volt-pos-e2e/setup-drivers' } }, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects while fetching ${url}`));
          return;
        }
        void fetchText(new URL(location, url).toString(), redirectsLeft - 1).then(resolve, reject);
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(new Error(`HTTP ${String(status)} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        // The LATEST_* pointer files are UTF-16LE with a BOM, which decodes to
        // "1\x005\x001..." if read as UTF-8 and then fails the version regex.
        const utf16 = body.length >= 2 && body[0] === 0xff && body[1] === 0xfe;
        resolve(
          body
            .toString(utf16 ? 'utf16le' : 'utf8')
            .replace(/^\uFEFF/, '')
            .trim(),
        );
      });
    });
    request.on('error', reject);
    request.setTimeout(30_000, () => {
      request.destroy(new Error(`Timed out fetching ${url}`));
    });
  });
}

/**
 * Unzip without adding a dependency.
 *
 * Windows 10 1803+ ships bsdtar at `System32\tar.exe`, which reads zip. It is
 * addressed by absolute path deliberately: Git for Windows puts GNU tar on
 * PATH ahead of it, and GNU tar cannot open a zip. `Expand-Archive` is the
 * fallback for older or unusual images.
 */
function extractZip(zipPath: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });

  const systemTar = path.join(process.env.SystemRoot ?? String.raw`C:\Windows`, 'System32', 'tar.exe');
  if (fs.existsSync(systemTar)) {
    const result = spawnSync(systemTar, ['-xf', zipPath, '-C', destDir], { windowsHide: true });
    if (result.status === 0) return;
  }

  const result = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`,
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`Could not unzip ${zipPath}: ${result.stderr || 'unknown error'}`);
  }
}

// ── tauri-driver ────────────────────────────────────────────────────────────

const RUSTUP_INSTRUCTIONS = [
  '  cargo is not on PATH, so tauri-driver cannot be installed.',
  '',
  '  Install the Rust toolchain, then re-run this script:',
  '',
  '    winget install --id Rustlang.Rustup -e',
  '    # or download and run https://win.rustup.rs',
  '',
  '    rustup default stable-msvc',
  '    cargo install tauri-driver --locked',
  '',
  '  Then make sure %USERPROFILE%\\.cargo\\bin is on PATH and re-run:',
  '',
  '    npm run setup:drivers',
].join('\n');

function hasCargo(): boolean {
  const result = spawnSync('cargo', ['--version'], { windowsHide: true, encoding: 'utf8' });
  return result.status === 0;
}

/** Returns false when the operator has to install Rust before we can continue. */
function ensureTauriDriver(): boolean {
  const target = path.join(Paths.DRIVERS, TAURI_DRIVER_EXE);
  const cargoBin = path.join(os.homedir(), '.cargo', 'bin', TAURI_DRIVER_EXE);

  if (fs.existsSync(target) && !force) {
    skip(`${TAURI_DRIVER_EXE} already in .drivers  (${binaryVersion(target) ?? 'version unknown'})`);
    skip('  pass --force to reinstall it');
    return true;
  }

  if (!fs.existsSync(cargoBin) || force) {
    if (!hasCargo()) {
      fail('tauri-driver is missing.');
      line();
      line(RUSTUP_INSTRUCTIONS);
      line();
      return false;
    }

    info(`Running: cargo install tauri-driver --locked${force ? ' --force' : ''}`);
    info('  first install compiles from source; two to four minutes is normal.');
    line();
    const args = ['install', 'tauri-driver', '--locked'];
    if (force) args.push('--force');
    const result = spawnSync('cargo', args, { stdio: 'inherit', windowsHide: true });
    line();
    if (result.status !== 0) {
      fail(`cargo install exited with code ${String(result.status)}.`);
      fail("Read cargo's output above — a missing MSVC build tools install is the usual cause.");
      return false;
    }
  }

  if (!fs.existsSync(cargoBin)) {
    fail(`cargo reported success but ${cargoBin} does not exist.`);
    return false;
  }

  fs.copyFileSync(cargoBin, target);
  ok(`${TAURI_DRIVER_EXE} -> ${target}  (${binaryVersion(target) ?? 'version unknown'})`);
  info('  copied out of ~/.cargo/bin so a run does not depend on the operator PATH.');
  return true;
}

// ── msedgedriver ────────────────────────────────────────────────────────────

async function resolveDownloadVersion(wanted: string): Promise<{ version: string; exact: boolean }> {
  const url = `${DRIVER_CDN}/${wanted}/edgedriver_win64.zip`;
  const head = await headStatus(url);
  if (head === 200) return { version: wanted, exact: true };

  warn(`No msedgedriver published for ${wanted} (HTTP ${String(head)}).`);
  warn('Falling back to LATEST_STABLE. Read the version warning at the end of this run.');
  const latest = VERSION_RE.exec(await fetchText(`${DRIVER_CDN}/LATEST_STABLE`))?.[1];
  if (!latest) throw new Error(`Could not resolve a msedgedriver version for WebView2 ${wanted}.`);
  return { version: latest, exact: false };
}

function headStatus(url: string, redirectsLeft = 5): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      { method: 'HEAD', headers: { 'User-Agent': 'volt-pos-e2e/setup-drivers' } },
      (res: IncomingMessage) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        res.resume();
        if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
          void headStatus(new URL(location, url).toString(), redirectsLeft - 1).then(resolve, reject);
          return;
        }
        resolve(status);
      },
    );
    request.on('error', reject);
    request.setTimeout(30_000, () => {
      request.destroy(new Error(`Timed out probing ${url}`));
    });
    request.end();
  });
}

async function ensureMsEdgeDriver(runtime: RuntimeVersion): Promise<boolean> {
  const target = path.join(Paths.DRIVERS, MSEDGEDRIVER_EXE);

  if (!runtime.version) {
    fail('Could not read the WebView2 Runtime version from the registry.');
    fail(`  key: ${WEBVIEW2_RUNTIME_KEY}`);
    line();
    line('  Install the Evergreen WebView2 Runtime (the app needs it to render at all):');
    line('    https://developer.microsoft.com/microsoft-edge/webview2/');
    line('  Then re-run: npm run setup:drivers');
    line();
    return false;
  }

  const installed = fs.existsSync(target) ? binaryVersion(target) : null;
  if (installed && installed === runtime.version && !force) {
    skip(`${MSEDGEDRIVER_EXE} already matches WebView2 ${runtime.version}`);
    skip('  pass --force to re-download it');
    return true;
  }
  if (installed && installed !== runtime.version) {
    warn(`Replacing msedgedriver ${installed} — WebView2 is now ${runtime.version}.`);
  }

  const { version, exact } = await resolveDownloadVersion(runtime.version);
  const url = `${DRIVER_CDN}/${version}/edgedriver_win64.zip`;
  const stagingDir = path.join(Paths.TMP, `edgedriver-${version}`);
  const zipPath = path.join(Paths.TMP, `edgedriver_win64-${version}.zip`);

  fs.mkdirSync(Paths.TMP, { recursive: true });
  fs.rmSync(stagingDir, { recursive: true, force: true });

  info(`Downloading ${url}`);
  await downloadToFile(url, zipPath);
  extractZip(zipPath, stagingDir);

  const extracted = path.join(stagingDir, MSEDGEDRIVER_EXE);
  if (!fs.existsSync(extracted)) {
    fail(
      `${MSEDGEDRIVER_EXE} was not inside the archive. Contents: ${fs.readdirSync(stagingDir).join(', ')}`,
    );
    return false;
  }

  fs.mkdirSync(Paths.DRIVERS, { recursive: true });
  fs.copyFileSync(extracted, target);
  fs.rmSync(zipPath, { force: true });
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const landed = binaryVersion(target);
  ok(`${MSEDGEDRIVER_EXE} -> ${target}  (${landed ?? 'version unknown'})`);
  if (!exact) {
    warn(`This is LATEST_STABLE (${version}), not an exact match for WebView2 ${runtime.version}.`);
  }
  return true;
}

// ── Report ──────────────────────────────────────────────────────────────────

function versionReport(runtime: RuntimeVersion): void {
  const driverPath = path.join(Paths.DRIVERS, MSEDGEDRIVER_EXE);
  const driver = fs.existsSync(driverPath) ? binaryVersion(driverPath) : null;
  const tauri = path.join(Paths.DRIVERS, TAURI_DRIVER_EXE);

  banner('DRIVERS');
  line(` Location             ${Paths.DRIVERS}`);
  line(` tauri-driver         ${fs.existsSync(tauri) ? (binaryVersion(tauri) ?? 'installed') : 'MISSING'}`);
  line(` msedgedriver         ${driver ?? 'MISSING'}`);
  line(` WebView2 Runtime     ${runtime.version ?? 'UNKNOWN'}   (read from: ${runtime.source})`);
  rule();

  const matched = !!driver && !!runtime.version && driver === runtime.version;
  if (matched) {
    line(' msedgedriver matches the WebView2 Runtime exactly. This is the state you want.');
    line(' If these two ever drift apart, the WebDriver session HANGS — it does not error,');
    line(' and the run dies on a connection timeout that looks like a broken test.');
  } else {
    line(' VERSION MISMATCH — READ THIS.');
    line('');
    line(` msedgedriver ${driver ?? '(missing)'} vs WebView2 Runtime ${runtime.version ?? '(unknown)'}.`);
    line(' A mismatched msedgedriver does NOT report an error. It accepts the connection and');
    line(' then never answers `newSession`, so the suite hangs until WebdriverIO gives up and');
    line(' reports something unrelated. Every minute spent debugging a "flaky driver" starts');
    line(' here. Re-run `npm run setup:drivers --force`, or install the WebView2 Runtime build');
    line(' that matches the driver.');
  }
  rule();
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  banner('VOLT POS E2E — driver setup');

  if (process.platform !== 'win32') {
    fail(
      `This suite drives WebView2 through msedgedriver and only runs on Windows (found ${process.platform}).`,
    );
    return 1;
  }

  fs.mkdirSync(Paths.DRIVERS, { recursive: true });
  info(`Target directory: ${Paths.DRIVERS}`);
  if (force) info('--force: reinstalling both drivers regardless of what is already there.');
  line();

  line(' tauri-driver');
  rule();
  const tauriOk = ensureTauriDriver();
  line();

  const runtime = detectWebView2Version();
  line(' msedgedriver');
  rule();
  if (runtime.version) {
    info(`WebView2 Runtime detected: ${runtime.version}  (${runtime.source})`);
  }
  const edgeOk = await ensureMsEdgeDriver(runtime);
  line();

  versionReport(runtime);

  line();
  if (tauriOk && edgeOk) {
    line(' Next:  npm run preflight        (verifies drivers, app binary and environment)');
    line('        npm run test:dev         (runs the suite against the dev build)');
    line();
    // A version mismatch is reported loudly but does not fail setup: an operator
    // may be deliberately pinning a driver while a WebView2 update rolls out,
    // and failing `npm run setup` here would strand them. `preflight` is the
    // gate that runs before every lane and re-checks the pair.
    return 0;
  }

  fail('Setup did not complete. Fix the items marked [FAIL] above and re-run: npm run setup:drivers');
  line();
  return 1;
}

process.exitCode = await main();
