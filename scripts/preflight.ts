/**
 * `npm run preflight` — runs ahead of every `test:*` lane.
 *
 * ## Why a gate exists at all
 *
 * Every expensive failure this suite has had was an environment problem wearing
 * a test failure's clothes:
 *
 *   - a msedgedriver one build behind WebView2, which hangs instead of erroring
 *   - a leftover app window, which `tauri-plugin-single-instance` hands the new
 *     launch to, so the driver ends up with a session against nothing
 *   - the WRONG .exe, because dev / staging / prod are three separate binaries
 *     (`src-tauri/build.rs` bakes the backend in at compile time) and a machine
 *     legitimately holds more than one
 *
 * None of those look like an environment problem in the WebdriverIO output. So
 * they are checked here, once, in under a second, and printed as a table an
 * operator can read at a glance.
 *
 * Exit code is 1 when any check is FAIL. WARN never blocks — it is for things
 * that degrade a run without invalidating it.
 */

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Paths, merchantDbDir } from '../configs/constants/paths.js';
import { loadEnv } from '../configs/env/loadEnv.js';
import { resolveAppCandidates } from '../configs/env/resolveApp.js';
import { resolveMsEdgeDriver, resolveTauriDriver } from '../src/support/services/TauriDriverService.js';
import { APP_IMAGE_NAMES, DRIVER_IMAGE_NAMES, runningImages } from '../src/support/process.js';
import { isPortOpen } from '../src/support/net.js';

/** Minimum for `node:sqlite`, which the DB helpers use to inspect the app's databases. */
const MIN_NODE = { major: 22, minor: 5 } as const;

/** Same registry client ids `scripts/setup-drivers.ts` reads — EdgeUpdate writes the 32-bit view. */
const WEBVIEW2_RUNTIME_KEY = String.raw`HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`;
const EDGE_STABLE_KEY = String.raw`HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{56EB18F8-B008-4CBD-B6D2-8C97FE7E9062}`;
const VERSION_RE = /(\d+\.\d+\.\d+\.\d+)/;

const DRIVER_MISMATCH_CHECK = 'Driver <-> WebView2';

type Status = 'OK' | 'WARN' | 'FAIL' | 'INFO';

interface Check {
  name: string;
  status: Status;
  detail: string;
  /** Printed in the "How to fix" block. Only meaningful for WARN / FAIL. */
  fix?: string;
}

const checks: Check[] = [];

const add = (name: string, status: Status, detail: string, fix?: string): void => {
  checks.push(fix === undefined ? { name, status, detail } : { name, status, detail, fix });
};

const line = (text = ''): void => console.log(text);

// ── Local helpers. Kept in-file so preflight can run before anything is set up ──

function regQuery(key: string, value: string): string | null {
  try {
    const out = execFileSync('reg', ['query', key, '/v', value], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return VERSION_RE.exec(out)?.[1] ?? null;
  } catch {
    return null;
  }
}

function binaryVersion(exe: string): string | null {
  try {
    const out = execFileSync(exe, ['--version'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15_000,
    });
    return VERSION_RE.exec(out)?.[1] ?? null;
  } catch {
    return null;
  }
}

function renderTable(rows: readonly Check[]): void {
  const cells = [{ name: 'CHECK', status: 'STATUS', detail: 'DETAIL' }, ...rows];
  const nameW = Math.max(...cells.map((r) => r.name.length));
  const statusW = Math.max(...cells.map((r) => r.status.length));

  const [head, ...body] = cells;
  if (!head) return;

  line(`  ${head.name.padEnd(nameW)}  ${head.status.padEnd(statusW)}  ${head.detail}`);
  line(`  ${'-'.repeat(nameW)}  ${'-'.repeat(statusW)}  ${'-'.repeat(46)}`);
  for (const r of body) {
    line(`  ${r.name.padEnd(nameW)}  ${r.status.padEnd(statusW)}  ${r.detail}`);
  }
}

// ── Checks ──────────────────────────────────────────────────────────────────

function checkNode(): void {
  const raw = process.versions.node;
  const [major = 0, minor = 0] = raw.split('.').map((n) => Number.parseInt(n, 10));
  const good = major > MIN_NODE.major || (major === MIN_NODE.major && minor >= MIN_NODE.minor);
  add(
    'Node runtime',
    good ? 'OK' : 'FAIL',
    `v${raw} (need >= ${String(MIN_NODE.major)}.${String(MIN_NODE.minor)} for node:sqlite)`,
    good ? undefined : 'Install Node 22.5+ (see .nvmrc), then re-run npm install.',
  );
}

function checkPlatform(): void {
  const good = process.platform === 'win32';
  add(
    'Operating system',
    good ? 'OK' : 'FAIL',
    good ? `${process.platform} ${process.arch}` : `${process.platform} — this suite is Windows-only`,
    good
      ? undefined
      : 'The app is a Windows Tauri/WebView2 build driven by msedgedriver. There is no Linux lane.',
  );
}

interface DriverState {
  driverVersion: string | null;
  runtimeVersion: string | null;
  runtimeSource: string;
}

function checkDrivers(attachMode: boolean, tauriDriverPath: string, msEdgeDriverPath: string): DriverState {
  const tauriDriver = resolveTauriDriver(tauriDriverPath);
  const msEdgeDriver = resolveMsEdgeDriver(msEdgeDriverPath);

  if (attachMode) {
    // tauri-driver always launches its OWN copy of the binary, which is exactly
    // what the attach lane refuses to do. Its absence is not a problem here.
    add('tauri-driver', 'INFO', 'not used in MODE=attach (msedgedriver attaches over CDP)');
  } else {
    add(
      'tauri-driver',
      tauriDriver ? 'OK' : 'FAIL',
      tauriDriver ?? `not found in ${Paths.DRIVERS} or ~/.cargo/bin`,
      tauriDriver ? undefined : 'npm run setup:drivers   (or: cargo install tauri-driver --locked)',
    );
  }

  add(
    'msedgedriver',
    msEdgeDriver ? 'OK' : 'FAIL',
    msEdgeDriver ?? `not found in ${Paths.DRIVERS}`,
    msEdgeDriver ? undefined : 'npm run setup:drivers',
  );

  const driverVersion = msEdgeDriver ? binaryVersion(msEdgeDriver) : null;
  const webview2 = regQuery(WEBVIEW2_RUNTIME_KEY, 'pv');
  const edge = webview2 ? null : regQuery(EDGE_STABLE_KEY, 'pv');
  const runtimeVersion = webview2 ?? edge;
  const runtimeSource = webview2 ? 'WebView2 Runtime' : edge ? 'Edge browser' : 'unreadable';

  if (msEdgeDriver && !runtimeVersion) {
    add(
      DRIVER_MISMATCH_CHECK,
      'WARN',
      `driver ${driverVersion ?? '?'} vs runtime UNREADABLE (registry key missing)`,
      'Install the Evergreen WebView2 Runtime: https://developer.microsoft.com/microsoft-edge/webview2/',
    );
  } else if (msEdgeDriver && driverVersion === runtimeVersion) {
    add(
      DRIVER_MISMATCH_CHECK,
      'OK',
      `${String(driverVersion)} == ${String(runtimeVersion)} (${runtimeSource})`,
    );
  } else if (msEdgeDriver) {
    add(
      DRIVER_MISMATCH_CHECK,
      'WARN',
      `MISMATCH: msedgedriver ${driverVersion ?? '?'} vs ${runtimeSource} ${String(runtimeVersion)}`,
      'npm run setup:drivers -- --force   (see the mismatch note printed below the table)',
    );
  }

  return { driverVersion, runtimeVersion, runtimeSource };
}

/** Returns the builds that were found but NOT chosen, for the report below the table. */
function checkAppBinary(explicitPath: string, voltPosSrc: string): string[] {
  const candidates = resolveAppCandidates(explicitPath, voltPosSrc);
  const chosen = candidates[0];

  if (!chosen) {
    add(
      'App binary',
      'FAIL',
      'no volt-pos executable found',
      'Set APP_PATH in configs/env/.env.<ENV>, or install the app to %LOCALAPPDATA%\\volt-pos.',
    );
    return [];
  }

  const exists = fs.existsSync(chosen.exe);
  add(
    'App binary',
    exists ? 'OK' : 'FAIL',
    `${chosen.exe}  [${chosen.label}]`,
    exists ? undefined : 'The resolved path does not exist. Fix APP_PATH in configs/env/.env.<ENV>.',
  );

  return candidates.slice(1).map((c) => `${c.label}: ${c.exe}`);
}

function checkProcesses(attachMode: boolean): void {
  const appRunning = runningImages(APP_IMAGE_NAMES);
  const driversRunning = runningImages(DRIVER_IMAGE_NAMES);

  if (attachMode) {
    // The attach lane drives an app a human already started, so a live process
    // is the precondition here, not the problem.
    add(
      'App process',
      appRunning.length ? 'OK' : 'FAIL',
      appRunning.length ? `running: ${appRunning.join(', ')}` : 'no app running to attach to',
      appRunning.length ? undefined : 'npm run app:launch   (starts the app with WebView2 CDP enabled)',
    );
    const edgeDriverUp = driversRunning.includes('msedgedriver.exe');
    add(
      'Driver process',
      edgeDriverUp ? 'OK' : 'FAIL',
      edgeDriverUp ? `running: ${driversRunning.join(', ')}` : 'msedgedriver is not running',
      edgeDriverUp ? undefined : 'npm run app:launch',
    );
    return;
  }

  const stale = [...appRunning, ...driversRunning];
  add(
    'Stale processes',
    stale.length ? 'FAIL' : 'OK',
    stale.length ? `still running: ${stale.join(', ')}` : 'none',
    stale.length
      ? 'npm run app:kill  — tauri-plugin-single-instance hands a new launch to the OLD window, ' +
          'so the driver would own a session against a process it never started.'
      : undefined,
  );
}

async function checkPorts(
  attachMode: boolean,
  host: string,
  driverPort: number,
  cdpPort: number,
): Promise<void> {
  const driverBusy = await isPortOpen(host, driverPort);

  if (!attachMode) {
    add(
      'Driver port',
      driverBusy ? 'FAIL' : 'OK',
      `${host}:${String(driverPort)} ${driverBusy ? 'ALREADY IN USE' : 'free'}`,
      driverBusy ? 'Another run owns this port. Run `npm run app:kill`, or move DRIVER_PORT.' : undefined,
    );
    return;
  }

  add(
    'Driver port',
    driverBusy ? 'OK' : 'FAIL',
    `${host}:${String(driverPort)} ${driverBusy ? 'answering (msedgedriver)' : 'nothing listening'}`,
    driverBusy ? undefined : 'npm run app:launch',
  );

  const cdpOpen = await isPortOpen(host, cdpPort);
  add(
    'WebView2 CDP port',
    cdpOpen ? 'OK' : 'FAIL',
    `${host}:${String(cdpPort)} ${cdpOpen ? 'answering' : 'closed — the app has no remote debugging'}`,
    cdpOpen
      ? undefined
      : 'npm run app:launch   (sets WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port)',
  );
}

/**
 * The account the lane runs against.
 *
 * ## Why the token is a WARN and the merchant is a FAIL
 *
 * There are no username/password credentials to check. `/login` is a **QR**
 * login — `volt-pos/src/routes/login/index.tsx` renders a `QRCodeSVG` and polls
 * `useQrLogin` until the portal claims the device — and the only typed
 * credential the app accepts anywhere is the single `staffToken` field on
 * `/login-staff-token`. Blocking the run on a `LOGIN_PASSWORD` the app can
 * never consume made the suite unrunnable over a field that does not exist.
 *
 * The token is a WARN rather than a FAIL because a device stays authenticated
 * between runs: the ordinary case is that the splash goes straight to `/home`
 * and no credential is needed at all. A missing token is worth saying, not
 * worth stopping for.
 *
 * `MERCHANT_ID` stays a hard failure — every static fixture and the local
 * database helper is scoped by it, so an empty value silently reads whichever
 * shop happens to come first.
 */
function checkCredentials(staffToken: string, merchantId: string): void {
  if (merchantId) {
    add('Merchant under test', 'OK', `merchant ${merchantId}`);
  } else {
    add(
      'Merchant under test',
      'FAIL',
      'MERCHANT_ID is unset',
      'Set MERCHANT_ID in configs/env/.env.<ENV> — the static fixtures and the local database ' +
        'helper are both scoped by it, so an empty value reads the wrong shop without saying so.',
    );
  }

  add(
    'Staff token',
    staffToken ? 'OK' : 'WARN',
    staffToken
      ? `set (${'*'.repeat(Math.min(staffToken.length, 8))})`
      : 'STAFF_TOKEN is unset — harmless while the device stays signed in',
    staffToken
      ? undefined
      : 'Only needed if the device gets signed out: /login is a QR login and cannot be ' +
          'automated, so the fallback is the staff-token form at /login-staff-token. Put a token ' +
          'in STAFF_TOKEN (configs/env/.env.<ENV>) to let the suite recover on its own.',
  );
}

function checkSourceCheckout(voltPosSrc: string): void {
  if (!voltPosSrc) {
    add(
      'App source checkout',
      'WARN',
      'VOLT_POS_SRC is unset',
      'Set VOLT_POS_SRC in configs/env/.env.<ENV> to enable `npm run audit:testids` and the ' +
        'debug-build fallback. Not needed to drive an installed build.',
    );
    return;
  }
  const exists = fs.existsSync(voltPosSrc);
  add(
    'App source checkout',
    exists ? 'OK' : 'WARN',
    exists ? voltPosSrc : `${voltPosSrc} does not exist`,
    exists ? undefined : 'Point VOLT_POS_SRC at your volt-pos checkout, or clear it.',
  );
}

function checkAppData(identifier: string, merchantId: string): void {
  try {
    const dir = merchantDbDir(merchantId, identifier);
    add(
      'App data',
      'INFO',
      fs.existsSync(dir) ? dir : `${dir} (created by the app on first successful login)`,
    );
  } catch (error) {
    add('App data', 'WARN', (error as Error).message);
  }
}

/** Prod safety rail. Adds the check row AND returns the block printed under the table. */
function checkProdRail(writeAllowed: boolean): string[] {
  if (writeAllowed) {
    add(
      'Prod write rail',
      'WARN',
      'ALLOW_PROD_WRITES opt-in is ACTIVE — specs may create real orders',
      'Unset ALLOW_PROD_WRITES unless this is a deliberate, supervised production write test.',
    );
  } else {
    add('Prod write rail', 'OK', 'WRITE_ALLOWED=false — data-creating flows will throw');
  }

  const block = [
    ' ' + '#'.repeat(76),
    ' # ENV=prod — PRODUCTION BUILD, LIVE MERCHANT',
    ' #',
    ' # ONLY `tests/smoke` MAY RUN HERE. That suite is read-only by construction; every other',
    ' # suite creates data, and a prod build pushes every local row upstream through',
    ' # /syncing/pushing and talks to the live payment gateway. A stray checkout spec bills a',
    ' # real merchant.',
    ' #',
    ' #     cross-env ENV=prod wdio run configs/wdio/wdio.prod.conf.ts --suite smoke',
    ' #',
  ];

  if (writeAllowed) {
    block.push(
      ' # WRITE_ALLOWED is TRUE: ALLOW_PROD_WRITES=i-know-what-i-am-doing is set in this shell,',
      ' # so assertWritesAllowed() will NOT stop a spec from creating orders. Unset it unless',
      ' # that is exactly what you came here to do.',
    );
  } else {
    block.push(
      ' # WRITE_ALLOWED is false, so assertWritesAllowed() throws inside any data-creating flow.',
      ' # That is the correct state for this lane.',
    );
  }

  block.push(' ' + '#'.repeat(76));
  return block;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const env = loadEnv();
  const attachMode = env.MODE === 'attach';

  line();
  line('='.repeat(78));
  line(` PREFLIGHT — ENV=${env.ENV}  MODE=${env.MODE}`);
  line('='.repeat(78));
  line(` Upstream API      ${env.UPSTREAM_BASE_URI}`);
  line(` Merchant          ${env.MERCHANT_ID}`);
  line(` Writes allowed    ${String(env.WRITE_ALLOWED)}`);
  line(` Reset DB          ${String(env.RESET_DB)}`);
  line('='.repeat(78));
  line();

  checkNode();
  checkPlatform();
  const drivers = checkDrivers(attachMode, env.TAURI_DRIVER_PATH, env.MSEDGEDRIVER_PATH);
  const otherBuilds = checkAppBinary(process.env.APP_PATH ?? '', env.VOLT_POS_SRC);
  checkProcesses(attachMode);
  await checkPorts(attachMode, env.DRIVER_HOST, env.DRIVER_PORT, env.REMOTE_DEBUG_PORT);
  checkCredentials(env.STAFF_TOKEN, env.MERCHANT_ID);
  checkSourceCheckout(env.VOLT_POS_SRC);
  checkAppData(env.APP_IDENTIFIER, env.MERCHANT_ID);
  const prodBlock = env.ENV === 'prod' ? checkProdRail(env.WRITE_ALLOWED) : [];

  renderTable(checks);
  line();

  // Which OTHER builds exist matters as much as which one was picked: the tests
  // pass either way, they just pass against the wrong backend.
  if (otherBuilds.length) {
    line(' Other volt-pos builds on this machine (NOT used by this run):');
    for (const other of otherBuilds) line(`   - ${other}`);
    line();
    line(' If the wrong one was picked, set APP_PATH explicitly. ENV does not repoint a build —');
    line(' the backend URL is compiled in (src-tauri/build.rs -> env!()), so dev, staging and prod');
    line(' are three different .exe files.');
    line();
  }

  if (checks.some((c) => c.name === DRIVER_MISMATCH_CHECK && c.status === 'WARN')) {
    line(' ' + '!'.repeat(76));
    line(' ! DRIVER / WEBVIEW2 VERSION MISMATCH');
    line(' !');
    line(` !   msedgedriver       ${drivers.driverVersion ?? '(unknown)'}`);
    line(` !   ${drivers.runtimeSource.padEnd(19)}${drivers.runtimeVersion ?? '(unknown)'}`);
    line(' !');
    line(' ! This does not fail loudly at runtime. msedgedriver accepts the connection and then');
    line(' ! never answers `newSession`, so the session HANGS and the run dies on a timeout that');
    line(' ! points at something else entirely. If this run behaves strangely, fix this first:');
    line(' !');
    line(' !     npm run setup:drivers -- --force');
    line(' ' + '!'.repeat(76));
    line();
  }

  for (const text of prodBlock) line(text);
  if (prodBlock.length) line();

  const failures = checks.filter((c) => c.status === 'FAIL');
  const warnings = checks.filter((c) => c.status === 'WARN');
  const fixable = [...failures, ...warnings].filter((c) => c.fix);

  if (fixable.length) {
    line(' How to fix:');
    for (const c of fixable) {
      line(`   [${c.status}] ${c.name}`);
      line(`          ${c.fix ?? ''}`);
    }
    line();
  }

  if (failures.length) {
    line(
      ` PREFLIGHT FAILED — ${String(failures.length)} blocking problem(s): ` +
        failures.map((f) => f.name).join(', '),
    );
    line(' The lane was not started: nothing launched, nothing reset, no data touched.');
    line();
    return 1;
  }

  line(
    ` PREFLIGHT PASSED${warnings.length ? ` with ${String(warnings.length)} warning(s)` : ''} — ` +
      'starting the lane.',
  );
  line();
  return 0;
}

process.exitCode = await main();
