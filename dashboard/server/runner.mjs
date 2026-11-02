/**
 * GUI test-runner server.
 *
 * The React dashboard is read-only by itself — it renders whatever the WDIO
 * DashboardReporter last wrote to `public/data/history.json`. This server adds
 * the other half: pick features/specs in the UI, press Run, and it launches
 * `wdio run` exactly like a person would in a terminal, then streams both the raw
 * log and per-test results back while it runs.
 *
 * ## How a selection becomes a run
 *
 * The UI sends spec paths + an optional title grep. Instead of piling them onto
 * the command line (cmd.exe caps a line at 8 191 chars — ~200 spec paths blow
 * through that), the server writes `.tmp/wdio.gui.conf.ts`, which re-exports the
 * env's real config with `specs` and `mochaOpts.grep` overridden, and runs that.
 *
 * ## Live results
 *
 * The run gets `GUI_LIVE_FILE`; DashboardReporter appends one JSON line per test
 * to it from the worker processes. The server tails that file and folds attempts
 * per test, so a test that failed then passed on a spec retry reads as flaky.
 *
 * ## Surviving the server
 *
 * A run outlives the server. wdio is launched through `run-job.mjs`, DETACHED,
 * with its output going to `run.log` (never a pipe back to us) and its metadata
 * + pid in `run.json`. If the server crashes or is killed, the run carries on;
 * the next server start re-adopts it from those two files and the live-event
 * file, so the UI picks up where it left off. The server also refuses to die
 * from a stray exception — one unhandled error used to take a 4-hour run with it.
 *
 * Dependency-free (Node built-ins only) and single-flight: the suite drives ONE
 * desktop app over ONE WebDriver session (`maxInstances: 1`), so a second
 * concurrent run would corrupt both.
 */

import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  closeSync,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fastGrep, laneClass, needsLaunch, planFast, planLanes, specSourceWithKits } from './fast-plan.mjs';
import { buildCatalog } from './catalog.mjs';
import { createWarm } from './warm.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Repo root = two levels up from dashboard/server/. npm scripts run from here. */
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DASH_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(DASH_ROOT, 'dist');
const DATA = path.join(DASH_ROOT, 'public', 'data');
const TMP = path.join(REPO_ROOT, '.tmp');
const GUI_CONF = path.join(TMP, 'wdio.gui.conf.ts');
const LIVE_FILE = path.join(REPO_ROOT, 'reports', '.gui-live', 'events.jsonl');
const RUN_STATE = path.join(path.dirname(LIVE_FILE), 'run.json');
const RUN_LOG = path.join(path.dirname(LIVE_FILE), 'run.log');
const RUN_JOB = path.join(__dirname, 'run-job.mjs');
const CRASH_LOG = path.join(TMP, 'runner-crash.log');
const SCHEDULE_FILE = path.join(TMP, 'gui-schedules.json');
/** Every run — ⚡ or not — goes through fast-run.mjs with one of these. */
const PLAN_FILE = path.join(TMP, 'gui-fast-plan.json');
/** The live files of the last runs, one folder per run id (see archiveLastRun). */
const RUNS_ARCHIVE = path.join(REPO_ROOT, 'reports', '.gui-runs');
const RUNS_KEPT = 10;
/** warm.mjs's state file; fast-run.mjs reads it to wait for / skip ahead of the pre-warm. */
const WARM_FILE = path.join(TMP, 'gui-warm.json');
const FAST_RUN = path.join(__dirname, 'fast-run.mjs');
export const PORT = Number(process.env.RUNNER_PORT ?? 4322);

/* ── Never die from a stray error ───────────────────────────────────────── */

function logCrash(kind, err) {
  const line = `[${new Date().toISOString()}] ${kind}: ${err?.stack ?? err}\n`;
  console.error(`[runner] ${line.trim()}`);
  try {
    mkdirSync(TMP, { recursive: true });
    appendFileSync(CRASH_LOG, line);
  } catch {
    /* nothing left to report to */
  }
}
process.on('uncaughtException', (err) => logCrash('uncaughtException', err));
process.on('unhandledRejection', (err) => logCrash('unhandledRejection', err));

/** Env → wdio config. Each env is a different .exe build, not a runtime flag. */
const ENVS = {
  dev: 'configs/wdio/wdio.dev.conf.ts',
  staging: 'configs/wdio/wdio.staging.conf.ts',
  prod: 'configs/wdio/wdio.prod.conf.ts',
};

/**
 * `key` as a run of `env` will see it: the process env first, then the env files
 * in configs/env/loadEnv.ts's order (dotenv never overrides, so the first wins).
 */
function envFileValue(env, key) {
  if ((process.env[key] ?? '').trim()) return process.env[key].trim();
  for (const file of [`.env.${env}`, '.env.local', '.env.example']) {
    let text;
    try {
      text = readFileSync(path.join(REPO_ROOT, 'configs', 'env', file), 'utf8');
    } catch {
      continue;
    }
    const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm'));
    if (m) return m[1].replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '').trim();
  }
  return '';
}

/* ── Freeze the user's other apps while a run needs the RAM ─────────────── */

/** On/off, kept across restarts. */
const FREEZE_SETTING = path.join(TMP, 'gui-freeze.json');
/** What scripts/freeze-apps.ps1 froze; run-job.mjs thaws it when the run ends. */
const FREEZE_STATE = path.join(TMP, 'frozen-apps.json');
const FREEZE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'freeze-apps.ps1');

function freezeEnabled() {
  try {
    return JSON.parse(readFileSync(FREEZE_SETTING, 'utf8')).enabled !== false;
  } catch {
    return true;
  }
}

function setFreezeEnabled(enabled) {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(FREEZE_SETTING, JSON.stringify({ enabled }));
}

/** How many processes sit frozen right now (0 when none). */
function frozenCount() {
  try {
    const list = JSON.parse(readFileSync(FREEZE_STATE, 'utf8'));
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

const freezeStatus = () => ({ enabled: freezeEnabled(), frozen: frozenCount() });

/** `Freeze` or `Thaw`; returns the script's one-line summary for the run log. */
function freezeApps(action) {
  if (process.platform !== 'win32') return '';
  if (action === 'Thaw' && !existsSync(FREEZE_STATE)) return '';
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', FREEZE_SCRIPT, '-Action', action, '-StateFile', FREEZE_STATE],
    { encoding: 'utf8', windowsHide: true, timeout: 60_000 },
  );
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  if (r.status !== 0) logCrash(`freeze-apps ${action}`, new Error(out || `exit ${r.status}`));
  return out;
}

/* ── Catalogue (cached, rebuilt when asked) ─────────────────────────────── */

let catalog = null;
function getCatalog(refresh = false) {
  if (!catalog || refresh) catalog = buildCatalog(REPO_ROOT);
  return catalog;
}

/* ── Run state ──────────────────────────────────────────────────────────── */

/**
 * Current/last run, or null before the first one.
 * { id, env, specs[], grep, label, pid, startedAt, finishedAt, exitCode,
 *   planned, estimateMs, results: Map<key, result>, liveOffset, version }
 * The log lives in RUN_LOG, the persisted half of this in RUN_STATE.
 */
let current = null;
/** The pre-warm (warm.mjs), created once the run state below exists. */
let warm = null;
/** A fresh UI gets at most the log's tail. */
const MAX_LOG_BYTES = 3_000_000;

function appendLog(chunk) {
  try {
    appendFileSync(RUN_LOG, chunk);
  } catch (err) {
    logCrash('appendLog', err);
  }
}

const logSize = () => (existsSync(RUN_LOG) ? statSync(RUN_LOG).size : 0);

/** Log bytes from `offset` to the end, as text. */
function readLog(offset) {
  const size = logSize();
  if (offset >= size) return '';
  const buf = Buffer.alloc(size - offset);
  const fd = openSync(RUN_LOG, 'r');
  try {
    readSync(fd, buf, 0, buf.length, offset);
  } finally {
    closeSync(fd);
  }
  return buf.toString('utf8');
}

function freshRunState(saved) {
  return {
    ...saved,
    results: new Map(),
    liveOffset: 0,
    activeSpec: null,
    attempts: new Map(),
    specsDone: new Set(),
    version: 0,
  };
}

/**
 * Copy the previous run's live files — per-test timeline, log, state, plan — to
 * reports/.gui-runs/<run id>/ before a new run truncates them. They are the only
 * record of which lane ran what and when; a 15-minute smoke started after the
 * 5-hour run 5 wiped its timeline before it had been analysed.
 */
function archiveLastRun() {
  let id;
  try {
    id = JSON.parse(readFileSync(RUN_STATE, 'utf8')).id;
  } catch {
    return;
  }
  if (!id) return;
  const dir = path.join(RUNS_ARCHIVE, String(id).replace(/[:.]/g, '-'));
  mkdirSync(dir, { recursive: true });
  for (const file of [LIVE_FILE, RUN_STATE, RUN_LOG, PLAN_FILE]) {
    if (existsSync(file)) copyFileSync(file, path.join(dir, path.basename(file)));
  }
  const runs = readdirSync(RUNS_ARCHIVE).sort();
  for (const old of runs.slice(0, Math.max(0, runs.length - RUNS_KEPT))) {
    rmSync(path.join(RUNS_ARCHIVE, old), { recursive: true, force: true });
  }
}

function saveRunState() {
  if (!current) return;
  const { id, env, label, specs, grep, pid, startedAt, finishedAt, exitCode, planned, estimateMs } = current;
  writeFileSync(
    RUN_STATE,
    JSON.stringify(
      { id, env, label, specs, grep, pid, startedAt, finishedAt, exitCode, planned, estimateMs },
      null,
      2,
    ),
  );
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * Settle `current.exitCode` from the outside world: run-job.mjs writes the code
 * into RUN_STATE when wdio exits; a job that vanished without writing one was
 * killed (Stop, taskkill, reboot) and reads as -1.
 */
function refreshExit() {
  if (!current || current.exitCode !== null) return;
  let saved = null;
  try {
    saved = JSON.parse(readFileSync(RUN_STATE, 'utf8'));
  } catch {
    /* mid-write — next poll */
  }
  if (saved?.id === current.id && saved.exitCode !== null && saved.exitCode !== undefined) {
    current.exitCode = saved.exitCode;
    current.finishedAt = saved.finishedAt ?? new Date().toISOString();
  } else if (!pidAlive(current.pid)) {
    current.exitCode = -1;
    current.finishedAt = new Date().toISOString();
    appendLog('\n[runner] run process is gone without an exit code (killed).\n');
    saveRunState();
  } else {
    return;
  }
  ingestLive();
  current.activeSpec = null;
  current.version += 1;
  // run-job.mjs thaws on a normal end; a killed job never got the chance.
  const thawed = freezeApps('Thaw');
  if (thawed) appendLog(`\n${thawed}\n`);
  // The machine is free again: have an app booted before the next Run.
  warm?.request('sau lần chạy');
}

/** Re-adopt the last run on startup — still running or not — so a restart loses nothing. */
function adoptLastRun() {
  try {
    if (!existsSync(RUN_STATE)) return;
    const saved = JSON.parse(readFileSync(RUN_STATE, 'utf8'));
    if (!saved?.id) return;
    current = freshRunState(saved);
    ingestLive();
    refreshExit();
    if (current.exitCode === null)
      console.log(`[runner] re-adopted in-flight run ${current.id} (pid ${current.pid})`);
  } catch (err) {
    logCrash('adoptLastRun', err);
    current = null;
  }
}

/** Reporter paths arrive as `file:///D:/…` URLs or absolute paths → `tests/…/x.spec.ts`. */
const relSpec = (file) => {
  const abs = file.startsWith('file:') ? fileURLToPath(file) : file;
  const rel = path.isAbsolute(abs) ? path.relative(REPO_ROOT, abs) : abs;
  return rel.replace(/\\/g, '/');
};

/** Pull new lines from the live-event file into `current.results`. */
function ingestLive() {
  if (!current || !existsSync(LIVE_FILE)) return;
  const size = statSync(LIVE_FILE).size;
  if (size <= current.liveOffset) return;
  const buf = readFileSync(LIVE_FILE);
  const text = buf.subarray(current.liveOffset).toString('utf8');
  const lastNl = text.lastIndexOf('\n');
  if (lastNl < 0) return;
  current.liveOffset += Buffer.byteLength(text.slice(0, lastNl + 1));
  for (const line of text.slice(0, lastNl).split('\n')) {
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    const file = relSpec(ev.file ?? '');
    if (ev.t === 'spec-start') {
      current.activeSpec = file;
      // WDIO's runner.retry counts retries LEFT, not the attempt — count spec starts instead.
      current.attempts.set(file, (current.attempts.get(file) ?? 0) + 1);
    } else if (ev.t === 'spec-end') {
      if (current.activeSpec === file) current.activeSpec = null;
      current.specsDone.add(file);
    } else if (ev.t === 'test') {
      const key = `${file}::${ev.fullTitle}`;
      const prev = current.results.get(key);
      const failedBefore = (prev?.failedBefore ?? false) || prev?.state === 'failed';
      current.results.set(key, {
        key,
        file,
        title: ev.title,
        fullTitle: ev.fullTitle,
        state: ev.state,
        durationMs: ev.durationMs ?? 0,
        attempt: current.attempts.get(file) ?? 1,
        hook: !!ev.hook,
        error: ev.state === 'failed' ? ev.error : prev?.error,
        failedBefore,
        // Passed only after a failed attempt (spec retry or mocha retry) = flaky.
        flaky: ev.state === 'passed' && (failedBefore || (ev.mochaRetries ?? 0) > 0),
        at: ev.at,
      });
    }
    current.version += 1;
  }
}

function summarize() {
  const out = { passed: 0, failed: 0, flaky: 0, skipped: 0, done: 0 };
  if (!current) return out;
  for (const r of current.results.values()) {
    out.done += 1;
    if (r.state === 'failed') out.failed += 1;
    else if (r.state === 'skipped') out.skipped += 1;
    else if (r.flaky) out.flaky += 1;
    else out.passed += 1;
  }
  return out;
}

function statePayload(sinceVersion = -1) {
  ingestLive();
  refreshExit();
  const running = !!current && current.exitCode === null;
  const base = {
    running,
    run: current
      ? {
          id: current.id,
          env: current.env,
          label: current.label,
          specs: current.specs,
          grep: current.grep,
          startedAt: current.startedAt,
          finishedAt: current.finishedAt,
          exitCode: current.exitCode,
          planned: current.planned,
          estimateMs: current.estimateMs,
          activeSpec: current.activeSpec,
          specsDone: current.specsDone.size,
          summary: summarize(),
          version: current.version,
        }
      : null,
    logLength: current ? logSize() : 0,
    warm: warm?.status() ?? null,
    lanes: lanesStatus(),
    freeze: freezeStatus(),
  };
  // Results only when they moved — the UI polls every second or so.
  if (current && current.version !== sinceVersion) base.results = [...current.results.values()];
  return base;
}

/* ── Starting / stopping ────────────────────────────────────────────────── */

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** Mocha treats a `/…/flags` string as a RegExp; anything else is matched literally. */
function buildGrep({ tags = [], titles = [] }) {
  const parts = [...tags.map(escapeRe), ...titles.map(escapeRe)];
  return parts.length ? `/${parts.join('|')}/` : '';
}

/** Rough ETA from the last run that contained each spec; unknown specs count 60 s. */
function estimate(specs) {
  let history = [];
  try {
    history = JSON.parse(readFileSync(path.join(DATA, 'history.json'), 'utf8')).runs ?? [];
  } catch {
    /* no history yet */
  }
  const last = new Map();
  for (const run of [...history].reverse()) {
    for (const s of run.specs ?? []) last.set(relSpec(s.file), s.durationMs ?? 0);
  }
  return specs.reduce((ms, s) => ms + (last.get(s) || 60_000), 0);
}

/* ── ⚡ Chạy nhanh (fast mode) ────────────────────────────────────────────── */

/**
 * One generated wdio config for the GUI: base conf + these specs/grep, Allure off.
 * `specs` entries may themselves be arrays: each inner array runs in ONE worker
 * (one session), so launch mode starts the app once per group, not per file.
 */
function writeGuiConf(file, baseConfPath, specs, grep, retries) {
  const rel = (p) => path.relative(TMP, path.join(REPO_ROOT, p)).replace(/\\/g, '/');
  const abs = (s) => (Array.isArray(s) ? s.map(abs) : path.join(REPO_ROOT, s));
  writeFileSync(
    file,
    [
      '// Generated by dashboard/server/runner.mjs for one GUI run — do not edit.',
      `import { config as base } from ${JSON.stringify(rel(baseConfPath).replace(/\.ts$/, '.js'))};`,
      `import DashboardReporter from ${JSON.stringify(rel('configs/reporters/DashboardReporter.js'))};`,
      'export const config: WebdriverIO.Config = {',
      '  ...base,',
      `  specs: ${JSON.stringify(specs.map(abs))},`,
      '  exclude: [],',
      // Drop Allure for GUI runs: it logs every WebDriver command as a step and
      // screenshots each one — real per-command overhead the GUI never reads (it
      // renders DashboardReporter's live events). spec + DashboardReporter stay.
      "  reporters: [['spec', { symbols: { passed: '[PASS]', failed: '[FAIL]', skipped: '[SKIP]' } }], [DashboardReporter, {}]],",
      grep ? `  mochaOpts: { ...base.mochaOpts, grep: ${JSON.stringify(grep)}, invert: false },` : '',
      `  specFileRetries: ${String(retries)},`,
      '};',
      '',
    ].join('\n'),
  );
}

/** A grouped worker skips the ~15 s app boot every other file would pay. */
const BOOT_SAVING_MS = 15_000;

/**
 * ⚡ runs scale every blind settle() pause by this (see src/helpers/wait.ts, which
 * floors debounce-sized waits at the app's debounce). Blind pauses were 76 min of
 * a 7-hour full run at 0.5 (dead-time.jsonl, 2026-10-31).
 */
const FAST_SETTLE_SCALE = 0.35;

/**
 * Spec files per ⚡ group = per app launch. Smaller limits how far a wedged app
 * cascades; larger saves boots. 25 ≈ 8 launches for the whole suite.
 */
const FAST_GROUP_SIZE = 25;

/* ── Parallel app instances (docs/parallel-instances.md) ────────────────── */

/** Where `scripts/make-instance.mjs` puts the copies: <root>\i<N>\volt-pos-i<N>.exe. */
const INSTANCE_ROOT = process.env.VOLT_INSTANCE_ROOT || 'D:\\VoltE2E';
/**
 * Apps per ⚡ run, the installed one included. Each app + worker ≈ 1.3 GB: three
 * fit this 16 GB machine once browsers / chat apps are closed; a copy that is
 * not signed in yet simply gets no lane. `GUI_LANES=1` turns the lanes off.
 */
const MAX_LANES = Math.max(1, Number(process.env.GUI_LANES ?? 3) || 1);
/** Lanes pay a second app's boot: only worth it for a sweep, not a handful of files. */
const LANES_MIN_FILES = 20;
/** Smaller than FAST_GROUP_SIZE: the lanes pull groups off one queue, so small ones even out the finish. */
const LANE_GROUP_SIZE = 10;
/** A parked copy must keep rendering while out of sight. */
const ANTI_THROTTLE =
  '--disable-features=CalculateNativeWinOcclusion --disable-backgrounding-occluded-windows ' +
  '--disable-renderer-backgrounding --disable-background-timer-throttling';

/** Everything instance N's processes need to stay out of instance 0's way (src/support/process.ts). */
function instanceEnv(n) {
  const dir = path.join(INSTANCE_ROOT, `i${n}`);
  return {
    VOLT_INSTANCE: String(n),
    APP_PATH: path.join(dir, `volt-pos-i${n}.exe`),
    APP_IDENTIFIER: `VoltP${String(n).padStart(2, '0')}`,
    APP_IMAGES: `volt-pos-i${n}.exe`,
    DRIVER_IMAGES: `tauri-driver-i${n}.exe,msedgedriver-i${n}.exe`,
    MSEDGEDRIVER_PATH: path.join(dir, `msedgedriver-i${n}.exe`),
    TAURI_DRIVER_PATH: path.join(dir, `tauri-driver-i${n}.exe`),
    REMOTE_DEBUG_PORT: String(9222 + 10 * n),
    DRIVER_PORT: String(4444 + 10 * n),
    TAURI_NATIVE_PORT: String(4445 + 10 * n),
    APP_BROWSER_ARGS: ANTI_THROTTLE,
    APP_WINDOW_SEED: path.join(dir, 'window-offscreen.json'),
  };
}

/**
 * Instance 0 plus every copy on disk that has been signed in once, up to
 * MAX_LANES. A copy fresh from make-instance.mjs sits on its QR login and has no
 * `credentials` file in its data folder yet (only its existence is checked).
 */
function laneInstances() {
  const found = [{ n: 0, env: {} }];
  for (let n = 1; found.length < MAX_LANES && n <= 9; n += 1) {
    const env = instanceEnv(n);
    const signedIn = existsSync(path.join(process.env.APPDATA ?? '', env.APP_IDENTIFIER, 'credentials'));
    if (existsSync(env.APP_PATH) && existsSync(env.MSEDGEDRIVER_PATH) && signedIn) found.push({ n, env });
  }
  return found;
}

/** The installed app the copies are made from (the GUI runs outside the Claude package, so this is the real one). */
const INSTALLED_APP = path.join(process.env.LOCALAPPDATA ?? '', 'Volt POS', 'volt-pos.exe');

/**
 * Remake copy N (scripts/make-instance.mjs) when the installed app changed under
 * it. A 1.1.85 copy beside a freshly installed 1.1.86 signed itself out and
 * never got a lane again. make-instance.mjs stamps `source.json` with the
 * installed exe it was made from; a copy that is running keeps its exe locked,
 * so it is left for the next run. Returns what happened, for the run log.
 */
function syncCopyBuild(n) {
  const dir = path.join(INSTANCE_ROOT, `i${n}`);
  if (!existsSync(path.join(dir, `volt-pos-i${n}.exe`)) || !existsSync(INSTALLED_APP)) return 'none';
  const st = statSync(INSTALLED_APP);
  try {
    const stamp = JSON.parse(readFileSync(path.join(dir, 'source.json'), 'utf8'));
    if (stamp.size === st.size && stamp.mtimeMs === st.mtimeMs) return 'same';
  } catch {
    /* no stamp yet: remake it once */
  }
  const running = spawnSync('tasklist', ['/FI', `IMAGENAME eq volt-pos-i${n}.exe`, '/NH'], {
    encoding: 'utf8',
  });
  if ((running.stdout ?? '').toLowerCase().includes(`volt-pos-i${n}.exe`)) return 'busy';
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'make-instance.mjs'), String(n)], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return r.status === 0 ? 'rebuilt' : `failed: ${(r.stderr || r.stdout || '').trim().split(/\r?\n/).pop()}`;
}

/** For the GUI pill: the copies on disk (up to MAX_LANES) and whether each is signed in. */
function lanesStatus() {
  const copies = [];
  for (let n = 1; n < MAX_LANES && n <= 9; n += 1) {
    const env = instanceEnv(n);
    if (!existsSync(env.APP_PATH)) continue;
    copies.push({
      n,
      signedIn: existsSync(path.join(process.env.APPDATA ?? '', env.APP_IDENTIFIER, 'credentials')),
    });
  }
  return { max: MAX_LANES, copies };
}

/**
 * Open copy N on screen with its QR login (`launch.cmd visible`), for the one-time
 * device sign-in. From here, NOT from a shell inside the Claude app: that one is
 * an MSIX package whose children get a virtualised AppData, so a sign-in made
 * there would never reach the runs.
 */
function openCopyForSignIn(n) {
  const launcher = path.join(INSTANCE_ROOT, `i${n}`, 'launch.cmd');
  if (!existsSync(launcher))
    return { ok: false, error: `Không có ${launcher} — chạy node scripts/make-instance.mjs ${n}` };
  spawn('cmd.exe', ['/c', launcher, 'visible'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
  return { ok: true };
}

/**
 * The lanes plan for fast-run.mjs: every queued group gets one generated config
 * per instance allowed to take it (`….i<N>.conf.ts` — the name is how
 * activeWdioRuns tells the lanes' processes apart).
 */
function writeLanePlan(plan, instances, userTags, retries) {
  for (const old of readdirSync(TMP))
    if (/^gui-lane-.*\.conf\.ts$/.test(old)) rmSync(path.join(TMP, old), { force: true });
  // A `@lane-split` group (fast-plan.mjs planLanes) runs one half of its files' tests.
  const grepFor = (only) =>
    fastGrep({
      exclude: only === 'shared' ? ['@broken', '@exclusive'] : ['@broken'],
      userTags,
      require: only === 'exclusive' ? ['@exclusive'] : [],
    });
  const queues = {};
  for (const [cls, q] of Object.entries(plan.queues)) {
    queues[cls] = {};
    for (const mode of ['attach', 'launch']) {
      queues[cls][mode] = q[mode].map(({ files, only }, k) => {
        const id = `${cls}-${mode}-${k + 1}${only ? `-${only}` : ''}`;
        const confs = {};
        for (const inst of cls === 'any' ? instances : instances.slice(0, 1)) {
          const conf = path.join(TMP, `gui-lane-${id}${inst.n ? `.i${inst.n}` : ''}.conf.ts`);
          const base =
            mode === 'attach' ? 'configs/wdio/wdio.bulk-attach.conf.ts' : 'configs/wdio/wdio.bulk.conf.ts';
          writeGuiConf(conf, base, [files], grepFor(only), retries);
          confs[String(inst.n)] = conf;
        }
        // `specs` is for after-the-fact analysis: the confs are rewritten by the next run.
        return { id, files: files.length, specs: files, confs, ...(only ? { only } : {}) };
      });
    }
  }
  return { instances, queues };
}

function startRun(body) {
  refreshExit();
  if (current && current.exitCode === null) return { ok: false, error: 'Đang có một lần chạy khác.' };
  const env = ENVS[body.env] ? body.env : 'dev';
  const known = new Set(getCatalog().flatMap((f) => f.files.map((x) => x.path)));
  let specs = [...new Set((body.specs ?? []).map(String))].filter((s) => known.has(s));
  // Production is read-only smoke — wdio.prod.conf.ts pins that, and the override
  // config below would otherwise bypass it.
  if (env === 'prod') specs = specs.filter((s) => s.startsWith('tests/smoke/'));
  if (specs.length === 0) {
    return {
      ok: false,
      error: env === 'prod' ? 'ENV prod chỉ được chạy tests/smoke.' : 'Chưa chọn spec nào.',
    };
  }
  const grep = buildGrep({ tags: body.tags ?? [], titles: body.titles ?? [] });

  mkdirSync(TMP, { recursive: true });
  mkdirSync(path.dirname(LIVE_FILE), { recursive: true });
  archiveLastRun();
  writeFileSync(LIVE_FILE, '');
  // Default retries OFF for GUI runs (fail once, re-run reds with the "Test lỗi
  // lần trước" button), unless the UI asks for more.
  const retries = Number.isInteger(body.retries) && body.retries > 0 ? body.retries : 0;

  // Which files can ATTACH to the pre-warmed app (no boot at all) and which must
  // launch their own (payments / customer display — see fast-plan.mjs).
  const byPath = new Map(
    getCatalog()
      .flatMap((f) => f.files)
      .map((f) => [f.path, f]),
  );
  const launchOnly = (p) =>
    needsLaunch(byPath.get(p) ?? { path: p, tests: [] }, specSourceWithKits(REPO_ROOT, p));

  // Fast mode is a dev-lane sweep of whole files; a single-title run stays plain.
  // A sweep is always ⚡ (and so gets the parallel copies): pressing Run on a full
  // selection without the toggle used to fall back to one app booting per file.
  const fast = (!!body.fast || specs.length >= LANES_MIN_FILES) && env === 'dev' && !body.titles?.length;
  const copyBuilds =
    fast && specs.length >= LANES_MIN_FILES
      ? Array.from({ length: MAX_LANES - 1 }, (_, i) => `i${i + 1} ${syncCopyBuild(i + 1)}`)
      : [];
  const instances = fast ? laneInstances() : [];
  let phases;
  let lanes;
  let planned;
  let estimateMs;
  if (fast && instances.length > 1 && specs.length >= LANES_MIN_FILES) {
    const userTags = body.tags ?? [];
    // Asked several times per file below; reading a spec + its kits is the slow part.
    const lanesOf = new Map();
    const opts = { voltTestCardSet: envFileValue(env, 'VOLT_TEST_GIFT_CARD') !== '' };
    const laneOf = (p) => {
      if (!lanesOf.has(p))
        lanesOf.set(
          p,
          laneClass(byPath.get(p) ?? { path: p, tests: [] }, specSourceWithKits(REPO_ROOT, p), opts),
        );
      return lanesOf.get(p);
    };
    const plan = planLanes(getCatalog(), specs, userTags, LANE_GROUP_SIZE, {
      needsLaunch: launchOnly,
      laneOf,
    });
    planned = plan.planned;
    if (!plan.files.length) {
      return {
        ok: false,
        error: 'Chạy nhanh: không còn test tự động nào trong lựa chọn (toàn case kiểm tay/@broken).',
      };
    }
    lanes = writeLanePlan(plan, instances, userTags, retries);
    // A `@lane-split` file is estimated whole in its lane: its exclusive tests are the small part.
    const filesOf = (cls) => plan.files.filter((p) => laneOf(p).replace(/^split:/, '') === cls);
    const [alone, primary, any] = ['alone', 'primary', 'any'].map((cls) => estimate(filesOf(cls)));
    estimateMs = alone + Math.max(primary, (primary + any) / instances.length);
    phases = Object.entries(plan.queues).map(([cls, q]) => ({ name: cls, mode: 'lanes', files: q.files }));
  } else if (fast) {
    const userTags = body.tags ?? [];
    const plan = planFast(getCatalog(), specs, userTags, FAST_GROUP_SIZE, { needsLaunch: launchOnly });
    planned = plan.planned;
    if (!plan.files.length) {
      return {
        ok: false,
        error: 'Chạy nhanh: không còn test tự động nào trong lựa chọn (toàn case kiểm tay/@broken).',
      };
    }
    const grepFast = fastGrep({ exclude: ['@broken'], userTags });
    phases = [];
    // Attach first: the pre-warmed app is already past its splash, so the run is
    // testing within seconds of Run. Grouped like launch, so later files of a
    // group get the webview reset of rootHooks.isolateGroupedFiles.
    if (plan.attachGroups.length) {
      const conf = path.join(TMP, 'wdio.gui.fast-attach.conf.ts');
      writeGuiConf(conf, 'configs/wdio/wdio.bulk-attach.conf.ts', plan.attachGroups, grepFast, retries);
      phases.push({ name: 'attach', mode: 'attach', conf, files: plan.attachFiles.length });
    }
    // Then launch mode (both windows real — payments and the customer display
    // work), grouped so the app boots once per group instead of once per file.
    if (plan.launchGroups.length) {
      const conf = path.join(TMP, 'wdio.gui.fast.conf.ts');
      writeGuiConf(conf, 'configs/wdio/wdio.bulk.conf.ts', plan.launchGroups, grepFast, retries);
      phases.push({
        name: 'launch',
        mode: 'launch',
        conf,
        files: plan.files.length - plan.attachFiles.length,
      });
    }
    const launchFiles = plan.files.length - plan.attachFiles.length;
    estimateMs = Math.max(
      0,
      estimate(plan.files) -
        (plan.attachFiles.length + launchFiles - plan.launchGroups.length) * BOOT_SAVING_MS,
    );
  } else {
    // A plain dev run (one test, "Test lỗi lần trước") attaches too when none of
    // its files needs the customer display — the same fast start, one worker per file.
    const attach = env === 'dev' && specs.every((p) => !launchOnly(p));
    writeGuiConf(GUI_CONF, attach ? 'configs/wdio/wdio.attach.conf.ts' : ENVS[env], specs, grep, retries);
    const mode = attach ? 'attach' : 'launch';
    phases = [{ name: mode, mode, conf: GUI_CONF, files: specs.length }];
    planned = getCatalog()
      .flatMap((f) => f.files)
      .filter((f) => specs.includes(f.path))
      .reduce((n, f) => {
        const tags = body.tags ?? [];
        if (body.titles?.length) return n + f.tests.filter((t) => body.titles.includes(t.title)).length;
        if (!tags.length) return n + f.tests.length;
        return n + f.tests.filter((t) => t.tags.some((g) => tags.includes(g))).length;
      }, 0);
    estimateMs = Math.max(0, estimate(specs) - (attach ? specs.length * BOOT_SAVING_MS : 0));
  }
  writeFileSync(
    PLAN_FILE,
    JSON.stringify(
      lanes
        ? { lanes, settleScale: FAST_SETTLE_SCALE, warmFile: WARM_FILE }
        : { phases, settleScale: fast ? FAST_SETTLE_SCALE : undefined, warmFile: WARM_FILE },
      null,
      2,
    ),
  );
  const cmd = `node "${FAST_RUN}" "${PLAN_FILE}"`;
  const phaseLine = lanes
    ? `${lanes.instances.length} app song song: ` + phases.map((p) => `${p.name} ${p.files} file`).join(' · ')
    : phases.map((p) => `${p.name} ${p.files} file`).join(' → ');
  current = freshRunState({
    id: new Date().toISOString(),
    env,
    label: body.label ?? `${specs.length} spec`,
    specs,
    grep,
    pid: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    planned,
    estimateMs,
  });
  writeFileSync(
    RUN_LOG,
    `$ ENV=${env} ${cmd}\n# ${specs.length} spec${grep ? `, grep ${grep}` : ''}${fast ? ' · ⚡ chạy nhanh' : ''}` +
      ` · ${phaseLine} · app mở sẵn: ${warm?.status().state ?? 'off'}` +
      (copyBuilds.length ? ` · bản sao: ${copyBuilds.join(', ')}` : '') +
      (fast && instances.length < MAX_LANES && specs.length >= LANES_MIN_FILES
        ? ' · chạy 1 app: bản sao chưa đăng nhập (chip "Mở QR" trên GUI)'
        : '') +
      '\n',
  );
  saveRunState();
  // A sweep needs the RAM (three apps ≈ 4 GB): freeze browsers / chat apps until it ends.
  if (freezeEnabled() && specs.length >= LANES_MIN_FILES) {
    const frozen = freezeApps('Freeze');
    if (frozen) appendLog(`${frozen}\n`);
  }

  // Detached + output to a file: the run must not depend on this process staying alive.
  const out = openSync(RUN_LOG, 'a');
  try {
    const child = spawn(process.execPath, [RUN_JOB, RUN_STATE, cmd], {
      cwd: REPO_ROOT,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', out, out],
      env: {
        ...process.env,
        ENV: env,
        GUI_LIVE_FILE: LIVE_FILE,
        FORCE_COLOR: '0',
        FREEZE_SCRIPT,
        FREEZE_STATE,
      },
    });
    child.on('error', (err) => logCrash('run-job spawn', err));
    child.unref();
    current.pid = child.pid ?? null;
  } finally {
    closeSync(out);
  }
  saveRunState();
  return { ok: true };
}

function stopRun() {
  refreshExit();
  if (!current || current.exitCode !== null) return { ok: false, error: 'Không có gì đang chạy.' };
  try {
    // Kill the whole tree on Windows so the app/driver children die too.
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(current.pid), '/T', '/F']);
    else process.kill(-current.pid, 'SIGTERM');
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  appendLog('\n[runner] stop requested\n');
  const thawed = freezeApps('Thaw');
  if (thawed) appendLog(`${thawed}\n`);
  return { ok: true };
}

/* ── Schedules ──────────────────────────────────────────────────────────── */

function loadSchedules() {
  try {
    return JSON.parse(readFileSync(SCHEDULE_FILE, 'utf8'));
  } catch {
    return [];
  }
}
function saveSchedules(list) {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(SCHEDULE_FILE, JSON.stringify(list, null, 2));
}

/** Fire due schedules once per minute slot. A busy runner skips (and logs) the slot. */
function tickSchedules() {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const slot = `${now.toDateString()} ${hhmm}`;
  const list = loadSchedules();
  if (!Array.isArray(list)) return;
  let changed = false;
  for (const s of list) {
    if (!s.enabled || s.time !== hhmm || s.lastSlot === slot) continue;
    if (Array.isArray(s.days) && s.days.length && !s.days.includes(now.getDay())) continue;
    s.lastSlot = slot;
    changed = true;
    const r = startRun({
      env: s.env,
      specs: s.specs,
      tags: s.tags,
      label: `⏰ ${s.name}`,
      fast: s.fast !== false,
    });
    s.lastResult = r.ok ? `started ${now.toISOString()}` : `skipped: ${r.error}`;
  }
  if (changed) saveSchedules(list);
}
setInterval(() => {
  try {
    tickSchedules();
  } catch (err) {
    logCrash('tickSchedules', err);
  }
}, 20_000);

/* ── HTTP ───────────────────────────────────────────────────────────────── */

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/** Serve the built UI from dist/, and run data live from public/data (dist's copy is a build-time snapshot). */
function serveStatic(pathname, res) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  const roots = rel.startsWith('data/') ? [path.join(DASH_ROOT, 'public')] : [DIST];
  for (const root of roots) {
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) break;
    if (existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      // The reporter rewrites data/*.json mid-run; a locked file (EBUSY) must not crash the server.
      createReadStream(file)
        .on('error', (err) => {
          logCrash(`serveStatic ${rel}`, err);
          res.destroy();
        })
        .pipe(res);
      return true;
    }
  }
  return false;
}

const server = createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (err) {
    logCrash(`${req.method} ${req.url}`, err);
    if (!res.headersSent) sendJson(res, 500, { error: String(err) });
    else res.destroy();
  }
});

async function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  if (pathname === '/api/gui/catalog' && req.method === 'GET') {
    return sendJson(res, 200, { features: getCatalog(url.searchParams.has('refresh')) });
  }
  if (pathname === '/api/gui/state' && req.method === 'GET') {
    return sendJson(res, 200, statePayload(Number(url.searchParams.get('since') ?? -1)));
  }
  if (pathname === '/api/gui/log' && req.method === 'GET') {
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const size = current ? logSize() : 0;
    // Offset past the end means the log was replaced (new run) — resend from the start (or the tail).
    const reset = offset <= 0 || offset > size;
    const from = reset ? Math.max(0, size - MAX_LOG_BYTES) : offset;
    const text = current ? readLog(from) : '';
    return sendJson(res, 200, {
      text,
      nextOffset: from + Buffer.byteLength(text),
      reset: reset && offset > 0,
    });
  }
  if (pathname === '/api/gui/run' && req.method === 'POST') {
    const result = startRun(await readBody(req));
    return sendJson(res, result.ok ? 200 : 409, result.ok ? statePayload() : result);
  }
  if (pathname === '/api/gui/stop' && req.method === 'POST') {
    const result = stopRun();
    return sendJson(res, result.ok ? 200 : 409, result);
  }
  // { enabled: boolean } switches the pre-warm; { now: true } retries it right away.
  if (pathname === '/api/gui/warm' && req.method === 'POST') {
    const body = await readBody(req);
    if (typeof body.enabled === 'boolean') warm.setEnabled(body.enabled);
    else if (body.now) warm.request('bấm tay');
    return sendJson(res, 200, { warm: warm.status() });
  }
  // { enabled: boolean } — freeze the user's other apps during a sweep.
  if (pathname === '/api/gui/freeze' && req.method === 'POST') {
    const body = await readBody(req);
    if (typeof body.enabled === 'boolean') setFreezeEnabled(body.enabled);
    return sendJson(res, 200, { freeze: freezeStatus() });
  }
  if (pathname === '/api/gui/lanes/signin' && req.method === 'POST') {
    const body = await readBody(req);
    const n = Number(body.n);
    if (!Number.isInteger(n) || n < 1 || n > 9) return sendJson(res, 400, { error: 'n phải là 1–9' });
    const r = openCopyForSignIn(n);
    return sendJson(res, r.ok ? 200 : 400, r.ok ? { lanes: lanesStatus() } : { error: r.error });
  }
  if (pathname === '/api/gui/schedules') {
    if (req.method === 'GET') return sendJson(res, 200, { schedules: loadSchedules() });
    if (req.method === 'PUT') {
      const body = await readBody(req);
      saveSchedules(Array.isArray(body.schedules) ? body.schedules : []);
      return sendJson(res, 200, { schedules: loadSchedules() });
    }
  }

  if (req.method === 'GET' && serveStatic(pathname, res)) return;
  if (req.method === 'GET' && !pathname.startsWith('/api/') && serveStatic('/index.html', res)) return;
  return sendJson(res, 404, { error: 'Not found' });
}

/** Start listening. Resolves once the port is bound (desktop.mjs waits on it). */
export function listen() {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[runner] Volt POS GUI runner on http://127.0.0.1:${PORT}`);
      console.log(`[runner] repo root: ${REPO_ROOT}`);
      // Apps left frozen by a run that ended while no server was up.
      if (!isRunning()) {
        const thawed = freezeApps('Thaw');
        if (thawed) console.log(thawed);
      }
      // Boot an app now, while the user is still picking specs.
      warm.request('khởi động');
      resolve();
    });
  });
}

export const isRunning = () => {
  refreshExit();
  return !!current && current.exitCode === null;
};

/** Close the app the pre-warm opened (desktop.mjs, when the window closes). */
export const releaseWarm = () => warm?.release();

warm = createWarm({
  repoRoot: REPO_ROOT,
  tmp: TMP,
  // Plain state read, not isRunning(): this is called from inside refreshExit.
  isRunning: () => !!current && current.exitCode === null,
  logCrash,
});
adoptLastRun();

// `node server/runner.mjs` → listen right away; importing (desktop.mjs) leaves it to the caller.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void listen();
}
