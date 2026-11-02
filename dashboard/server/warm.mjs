/**
 * Pre-warm for the GUI runner — keep a booted, attachable app (CDP on) waiting
 * while the runner is idle, so pressing Run attaches in seconds instead of
 * paying the splash (~20s) and a cold start (up to ~80s) at click time.
 *
 * The work itself is scripts/warm-app.ts (tsx, so it can reuse
 * src/support/attachApp.ts); this module only decides WHEN:
 *   - at server start, after every run, and when the toggle is switched on;
 *   - as a slow retry while it is not ready (cold / busy / error).
 * It never warms during a run, and warm-app.ts reports `busy` — touching
 * nothing — when it finds a person's own app window or another lane's driver.
 *
 * State lives in .tmp/gui-warm.json, which two other processes read:
 *   - fast-run.mjs: wait for a warm in progress, skip the preflight when ready;
 *   - scripts/preflight.ts: a LAUNCH lane may close this app (it is ours).
 */

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** How long a not-ready warm waits before trying again. */
const RETRY_MS = 3 * 60_000;
/** Health probe cadence — one local CDP read. */
const PROBE_MS = 10_000;

export function createWarm({ repoRoot, tmp, isRunning, logCrash }) {
  const MARKER = path.join(tmp, 'gui-warm.json');
  const SETTINGS = path.join(tmp, 'gui-warm-settings.json');
  const LOG = path.join(tmp, 'gui-warm.log');

  const readJson = (file, fallback) => {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return fallback;
    }
  };

  let enabled = readJson(SETTINGS, { enabled: true }).enabled !== false;
  let status = { state: enabled ? 'cold' : 'off', detail: '', preflightOk: false, launched: false, at: null };
  let cdp = '127.0.0.1:9222';
  let child = null;
  let lastAttempt = 0;

  function save(patch) {
    status = { ...status, ...patch, at: new Date().toISOString() };
    try {
      mkdirSync(tmp, { recursive: true });
      // `enabled` too: fast-run.mjs closes the app after an attach-only run when it is off.
      writeFileSync(MARKER, JSON.stringify({ ...status, enabled }, null, 2));
    } catch (err) {
      logCrash('warm marker', err);
    }
  }
  save({}); // a stale "ready" from a previous server must not outlive it

  /** Start warm-app.ts unless off, already warming, or a run owns the machine. */
  function request(reason) {
    if (!enabled || child || isRunning()) return false;
    lastAttempt = Date.now();
    save({ state: 'warming', detail: reason });
    appendFileSync(LOG, `\n===== ${new Date().toISOString()} warm (${reason}) =====\n`);
    let out = '';
    try {
      child = spawn('npx tsx scripts/warm-app.ts', {
        cwd: repoRoot,
        shell: true,
        windowsHide: true,
        env: { ...process.env, ENV: 'dev', FORCE_COLOR: '0' },
      });
    } catch (err) {
      logCrash('warm spawn', err);
      save({ state: 'error', detail: String(err) });
      return false;
    }
    const sink = (chunk) => {
      out += chunk;
      try {
        appendFileSync(LOG, chunk);
      } catch {
        /* the log is only for reading */
      }
    };
    child.stdout.on('data', sink);
    child.stderr.on('data', sink);
    child.on('error', (err) => logCrash('warm child', err));
    child.on('close', (code) => {
      child = null;
      const last = out.trim().split(/\r?\n/).reverse().find((l) => l.startsWith('{'));
      let result = null;
      try {
        result = last ? JSON.parse(last) : null;
      } catch {
        /* fall through to the error below */
      }
      if (result?.cdp) cdp = result.cdp;
      if (!result) save({ state: 'error', detail: `warm-app thoát code ${code} (xem .tmp/gui-warm.log)` });
      else if (!enabled) {
        // Switched off mid-warm: do not leave behind the app it just opened.
        save({ ...result, state: 'off' });
        release();
      } else save(result);
    });
    return true;
  }

  /** Is an app page still answering on the CDP port? Read-only. */
  async function appAlive() {
    try {
      const res = await fetch(`http://${cdp}/json/list`, { signal: AbortSignal.timeout(1_500) });
      const targets = await res.json();
      return targets.some((t) => {
        if (t.type !== 'page') return false;
        try {
          const u = new URL(t.url);
          return u.hostname === 'tauri.localhost' && !u.pathname.startsWith('/customer');
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  async function probe() {
    if (child) return;
    if (status.state === 'ready' && !(await appAlive())) {
      save({ state: enabled ? 'cold' : 'off', detail: 'app đã tắt', preflightOk: false });
      // Someone closed it (or a launch phase did): wait a full retry period before
      // reopening, so closing the window by hand is not undone ten seconds later.
      lastAttempt = Date.now();
    }
    if (enabled && ['cold', 'busy', 'error'].includes(status.state) && Date.now() - lastAttempt > RETRY_MS) {
      request('thử lại');
    }
  }
  setInterval(() => {
    probe().catch((err) => logCrash('warm probe', err));
  }, PROBE_MS).unref();

  return {
    status: () => ({ ...status, enabled }),
    request,
    setEnabled(on) {
      enabled = !!on;
      try {
        mkdirSync(tmp, { recursive: true });
        writeFileSync(SETTINGS, JSON.stringify({ enabled }));
      } catch (err) {
        logCrash('warm settings', err);
      }
      if (enabled) {
        save({ state: status.state === 'off' ? 'cold' : status.state });
        request('bật mở sẵn');
      } else {
        // Off = "don't keep an app open for me": close the one this runner opened.
        if (status.launched && !isRunning() && !child) release();
        save({ state: 'off', preflightOk: false });
      }
    },
    /** Close the app this runner launched (window closed / toggle off). */
    release,
  };

  function release() {
    if (!status.launched || isRunning() || child) return;
    spawnSync('npx tsx scripts/kill-app.ts', { cwd: repoRoot, shell: true, windowsHide: true, stdio: 'ignore' });
    save({ state: enabled ? 'cold' : 'off', detail: 'đã đóng app mở sẵn', launched: false, preflightOk: false });
  }
}
