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
import { spawn } from 'node:child_process';
import {
  appendFileSync,
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './catalog.mjs';

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

function saveRunState() {
  if (!current) return;
  const { id, env, label, specs, grep, pid, startedAt, finishedAt, exitCode, planned, estimateMs } = current;
  writeFileSync(
    RUN_STATE,
    JSON.stringify({ id, env, label, specs, grep, pid, startedAt, finishedAt, exitCode, planned, estimateMs }, null, 2),
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
    if (current.exitCode === null) console.log(`[runner] re-adopted in-flight run ${current.id} (pid ${current.pid})`);
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
    return { ok: false, error: env === 'prod' ? 'ENV prod chỉ được chạy tests/smoke.' : 'Chưa chọn spec nào.' };
  }
  const grep = buildGrep({ tags: body.tags ?? [], titles: body.titles ?? [] });

  mkdirSync(TMP, { recursive: true });
  mkdirSync(path.dirname(LIVE_FILE), { recursive: true });
  writeFileSync(LIVE_FILE, '');
  // Relative + `.js` so tsx resolves it to the .ts config, same as the repo's own imports.
  const baseConf = path.relative(TMP, path.join(REPO_ROOT, ENVS[env])).replace(/\\/g, '/').replace(/\.ts$/, '.js');
  writeFileSync(
    GUI_CONF,
    [
      '// Generated by dashboard/server/runner.mjs for one GUI run — do not edit.',
      `import { config as base } from ${JSON.stringify(baseConf)};`,
      'export const config: WebdriverIO.Config = {',
      '  ...base,',
      `  specs: ${JSON.stringify(specs.map((s) => path.join(REPO_ROOT, s)))},`,
      '  exclude: [],',
      grep ? `  mochaOpts: { ...base.mochaOpts, grep: ${JSON.stringify(grep)} },` : '',
      ...(body.retries === 0 ? ['  specFileRetries: 0,'] : []),
      '};',
      '',
    ].join('\n'),
  );

  const planned = getCatalog()
    .flatMap((f) => f.files)
    .filter((f) => specs.includes(f.path))
    .reduce((n, f) => {
      const tags = body.tags ?? [];
      if (body.titles?.length) return n + f.tests.filter((t) => body.titles.includes(t.title)).length;
      if (!tags.length) return n + f.tests.length;
      return n + f.tests.filter((t) => t.tags.some((g) => tags.includes(g))).length;
    }, 0);

  const cmd = `npm run preflight && npx wdio run "${GUI_CONF}"`;
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
    estimateMs: estimate(specs),
  });
  writeFileSync(RUN_LOG, `$ ENV=${env} ${cmd}\n# ${specs.length} spec${grep ? `, grep ${grep}` : ''}\n`);
  saveRunState();

  // Detached + output to a file: the run must not depend on this process staying alive.
  const out = openSync(RUN_LOG, 'a');
  try {
    const child = spawn(process.execPath, [RUN_JOB, RUN_STATE, cmd], {
      cwd: REPO_ROOT,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', out, out],
      env: { ...process.env, ENV: env, GUI_LIVE_FILE: LIVE_FILE, FORCE_COLOR: '0' },
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
    const r = startRun({ env: s.env, specs: s.specs, tags: s.tags, label: `⏰ ${s.name}` });
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
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
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
    return sendJson(res, 200, { text, nextOffset: from + Buffer.byteLength(text), reset: reset && offset > 0 });
  }
  if (pathname === '/api/gui/run' && req.method === 'POST') {
    const result = startRun(await readBody(req));
    return sendJson(res, result.ok ? 200 : 409, result.ok ? statePayload() : result);
  }
  if (pathname === '/api/gui/stop' && req.method === 'POST') {
    const result = stopRun();
    return sendJson(res, result.ok ? 200 : 409, result);
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
      resolve();
    });
  });
}

export const isRunning = () => {
  refreshExit();
  return !!current && current.exitCode === null;
};

adoptLastRun();

// `node server/runner.mjs` → listen right away; importing (desktop.mjs) leaves it to the caller.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void listen();
}
