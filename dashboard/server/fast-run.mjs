/**
 * Runs one GUI job as a sequence of wdio phases — or, with `lanes`, as parallel
 * lanes over several app instances (docs/parallel-instances.md).
 *
 *   node fast-run.mjs <plan.json>
 *
 * plan.json = { phases: [{ name, conf, mode: 'attach' | 'launch' }], settleScale?, warmFile? }
 *           | { lanes: { instances, queues }, settleScale?, warmFile? }
 *
 * The attach phase drives the app the GUI keeps PRE-WARMED (dashboard/server/
 * warm.mjs) — already past its splash, so the first test starts seconds after
 * Run instead of after a full boot. If no warm app is up, the first attach
 * worker's self-heal (src/support/attachApp.ts) launches one, which costs what
 * a launch would and nothing more. The launch phases then drive the payment /
 * customer-display specs the usual way, since CDP attach cannot drive the second
 * window. All phases append to the same GUI_LIVE_FILE and fold into ONE history
 * entry (DASHBOARD_RUN_PHASE), so the GUI sees one run.
 *
 * A failing phase does not stop the next one (the point is a full sweep); the
 * exit code is 1 if any phase failed, so the GUI still shows the run as red.
 * Spawned children stay in this process tree, so "Dừng" (taskkill /T) stops all.
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The CLI's own entry, not `npx wdio` — npx resolution alone costs ~1.5s per phase. */
const WDIO = `node "${path.join(REPO_ROOT, 'node_modules', '@wdio', 'cli', 'bin', 'wdio.js')}"`;
/** A warm stuck in "warming" this long belongs to a server that died mid-way. */
const WARM_STALE_MS = 3 * 60_000;

const t0 = Date.now();
const elapsed = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

const plan = JSON.parse(readFileSync(process.argv[2], 'utf8'));
// Blind settle() pauses scaled down for the sweep (src/helpers/wait.ts).
const phaseEnv = plan.settleScale ? { SETTLE_SCALE: String(plan.settleScale) } : {};

const sh = (cmd, extraEnv = {}) => {
  console.log(`\n$ ${cmd}`);
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  return r.status ?? 1;
};

const readWarm = () => {
  try {
    return plan.warmFile ? JSON.parse(readFileSync(plan.warmFile, 'utf8')) : null;
  } catch {
    return null;
  }
};

/** Let a warm in progress finish (the app is mid-boot) rather than race it for the app. */
async function settledWarm() {
  let warm = readWarm();
  if (warm?.state === 'warming' && Date.now() - Date.parse(warm.at ?? 0) < WARM_STALE_MS) {
    console.log(`[fast-run] ${elapsed()} app đang được mở sẵn — đợi nó boot xong rồi chạy…`);
    const deadline = Date.now() + WARM_STALE_MS;
    while (warm?.state === 'warming' && Date.now() < deadline) {
      await delay(500);
      warm = readWarm();
    }
  }
  return warm;
}

/** Preflight for a run that opens with `firstMode`; false = stop. Skipped when the warm already ran it. */
function preflightFirst(warm, firstMode) {
  const warmReady = warm?.state === 'ready';
  if (firstMode === 'attach' && warmReady && warm.preflightOk) {
    console.log(
      `[fast-run] ${elapsed()} app mở sẵn (${warm.detail}) đã qua preflight lúc warm — bỏ preflight, attach luôn`,
    );
    return true;
  }
  return (
    sh('npm run preflight', {
      WDIO_MODE: firstMode === 'attach' && warmReady ? 'attach' : 'launch',
      // A GUI run may clear what a closed app left behind (see preflight.ts releaseGuiWarmApp).
      PREFLIGHT_CLEAN_LEFTOVERS: '1',
    }) === 0
  );
}

/* ── One lane: the phases in a row ─────────────────────────────────────────── */

async function runPhases() {
  const warm = await settledWarm();
  if (!preflightFirst(warm, plan.phases[0]?.mode)) process.exit(1);

  /** "attach+launch" for the one history entry the phases fold into. */
  const runModes = [...new Set(plan.phases.map((p) => p.mode))].join('+');

  let failed = false;
  for (const [i, phase] of plan.phases.entries()) {
    const started = Date.now();
    console.log(`\n[fast-run] ${elapsed()} ===== pha ${phase.name} (${phase.mode}) =====`);
    const code = sh(`${WDIO} run "${phase.conf}"`, {
      ...phaseEnv,
      WDIO_MODE: phase.mode,
      DASHBOARD_RUN_PHASE: `${i + 1}/${plan.phases.length}`,
      DASHBOARD_RUN_MODES: runModes,
      // GUI attach workers reset the webviews unless the pre-warm left them fresh.
      ...(phase.mode === 'attach' ? { ATTACH_RESET: '1' } : {}),
    });
    // A launch phase after this one starts its own app; an attach-only run leaves
    // the app up, so the next Run attaches to it again (warm.mjs reloads it first).
    if (phase.mode === 'attach' && i < plan.phases.length - 1) sh('npm run app:kill');
    if (code !== 0) failed = true;
    console.log(
      `[fast-run] pha ${phase.name} xong: exit ${code}, ${Math.round((Date.now() - started) / 60000)} phút`,
    );
  }

  // Pre-warm switched off: the run ends with the app closed, as a launch run always did.
  if (plan.phases.at(-1)?.mode === 'attach' && readWarm()?.enabled === false) sh('npm run app:kill');
  return failed;
}

/* ── Parallel lanes ─────────────────────────────────────────────────────────── */

/**
 * Run `cmd` without blocking the other lanes. Lane 0 prints as a single-lane run
 * always did; lane N's lines carry `[iN]` so the GUI log stays readable.
 */
function shAsync(cmd, extraEnv, tag) {
  return new Promise((resolve) => {
    const prefix = tag ? `[${tag}] ` : '';
    console.log(`\n${prefix}$ ${cmd}`);
    const child = spawn(cmd, {
      shell: true,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const [stream, out] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ]) {
      let rest = '';
      stream.on('data', (chunk) => {
        const lines = (rest + chunk).split(/\r?\n/);
        rest = lines.pop() ?? '';
        for (const l of lines) out.write(`${prefix}${l}\n`);
      });
      stream.on('end', () => rest && out.write(`${prefix}${rest}\n`));
    }
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** The warm JSON a lane's `scripts/warm-app.ts` prints last. */
function lastJson(text) {
  const line = text
    .trim()
    .split(/\r?\n/)
    .reverse()
    .find((l) => l.startsWith('{'));
  try {
    return line ? JSON.parse(line) : null;
  } catch {
    return null;
  }
}

/**
 * Boot (or reuse) instance N's app for its first attach group. Resolves the warm
 * result when the lane can run, `{ sitOut: true }` when it cannot.
 */
function warmInstance(inst) {
  return new Promise((resolve) => {
    const tag = `i${inst.n}`;
    console.log(`[fast-run] ${elapsed()} [${tag}] mở app song song (${inst.env.APP_PATH})…`);
    const child = spawn('npx tsx scripts/warm-app.ts', {
      shell: true,
      cwd: REPO_ROOT,
      env: { ...process.env, ...inst.env, WDIO_MODE: 'attach' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', () => {
      const warm = lastJson(out);
      writeFileSync(
        path.join(REPO_ROOT, '.tmp', `gui-warm-${tag}.json`),
        JSON.stringify({ ...warm, enabled: true, at: new Date().toISOString() }),
      );
      if (warm?.state === 'ready' && !warm.signedOut) {
        console.log(`[fast-run] ${elapsed()} [${tag}] sẵn sàng (${warm.detail}) — chạy song song`);
        resolve(warm);
        return;
      }
      const why = warm?.signedOut
        ? 'thiết bị chưa đăng nhập — quét QR một lần: D:\\VoltE2E\\i' + inst.n + '\\launch.cmd visible'
        : (warm?.detail ?? 'không đọc được kết quả warm');
      console.log(`[fast-run] ${elapsed()} [${tag}] bỏ làn này: ${why}`);
      resolve({ sitOut: true });
    });
  });
}

/** Keep instance N's windows parked off-screen while its lane runs (scripts/park-windows.ps1). */
function parkWatcher(inst) {
  const stopFile = path.join(REPO_ROOT, '.tmp', `park-i${inst.n}.stop`);
  rmSync(stopFile, { force: true });
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(REPO_ROOT, 'scripts', 'park-windows.ps1'),
      '-Image',
      path.basename(inst.env.APP_PATH),
      '-Watch',
      '-StopFile',
      stopFile,
      '-ParentPid',
      String(process.pid),
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  return () => {
    writeFileSync(stopFile, 'stop');
    setTimeout(() => child.kill(), 3_000).unref();
  };
}

/** One history entry for the whole run: the lanes keep fragments, this process folds them. */
function resetDashboardFragments() {
  const dir = path.join(REPO_ROOT, 'reports', '.dashboard-tmp');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '_run-started-at.txt'), new Date().toISOString());
}

async function runLanes() {
  const { instances, queues } = plan.lanes;
  resetDashboardFragments();
  const runModes = `lanes×${instances.length}`;
  const common = { ...phaseEnv, DASHBOARD_RUN_PHASE: '2/3', DASHBOARD_RUN_MODES: runModes };
  let failed = false;

  // Instance 0 opens like a single-lane run: attach to the pre-warmed app.
  const firstMode = queues.primary.attach.length || queues.any.attach.length ? 'attach' : 'launch';
  const warm = await settledWarm();
  if (!preflightFirst(warm, firstMode)) process.exit(1);

  /** Copies still working (or about to): while one is, instance 0 leaves them the shared attach work. */
  let activeCopies = instances.length - 1;

  /**
   * Next group for lane `n` in `mode`. Only instance 0 can take `primary`, so it
   * takes no shared work while primary work is waiting: in run 5 it drained two
   * shared attach groups (26 min) before its primary launch groups, and the copy
   * then sat idle for the last 70 min of the parallel phase.
   */
  const take = (n, mode) => {
    if (n !== 0) return queues.any[mode].shift() ?? null;
    const own = queues.primary[mode].shift();
    if (own) return own;
    if (mode === 'attach' && queues.primary.launch.length && activeCopies > 0) return null;
    return queues.any[mode].shift() ?? null;
  };
  const left = (n, mode) => queues.any[mode].length + (n === 0 ? queues.primary[mode].length : 0);

  async function runGroup(inst, group, mode) {
    const tag = inst.n ? `i${inst.n}` : '';
    const started = Date.now();
    console.log(
      `\n[fast-run] ${elapsed()} ${tag ? `[${tag}] ` : ''}===== ${group.id} (${mode}, ${group.files} file) =====`,
    );
    const code = await shAsync(
      `${WDIO} run "${group.confs[String(inst.n)]}"`,
      {
        ...common,
        ...inst.env,
        WDIO_MODE: mode,
        ...(mode === 'attach' ? { ATTACH_RESET: '1' } : {}),
        // Launch: msedgedriver starts the copy — the anti-throttling set reaches it this way.
        ...(mode === 'launch' && inst.n
          ? { APP_ENV_WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: inst.env.APP_BROWSER_ARGS }
          : {}),
      },
      tag,
    );
    if (code !== 0) failed = true;
    console.log(
      `[fast-run] ${tag ? `[${tag}] ` : ''}${group.id} xong: exit ${code}, ${Math.round((Date.now() - started) / 60000)} phút`,
    );
  }

  async function lane(inst) {
    const tag = inst.n ? `i${inst.n}` : '';
    let stopPark = () => {};
    if (inst.n) {
      // Always a fresh copy: one left open by hand (the QR sign-in) keeps a small,
      // framed window, and tests then click outside its viewport. A fresh launch
      // takes the seeded 1920×1080 frameless placement — the installed app's
      // fullscreen viewport. Parked from the first frame, or it covers the screen.
      await shAsync('npm run app:kill', inst.env, tag);
      stopPark = parkWatcher(inst);
      const warm = await warmInstance(inst);
      if (warm.sitOut) {
        activeCopies -= 1;
        stopPark();
        await shAsync('npm run app:kill', inst.env, tag);
        return;
      }
    }
    try {
      for (let g = take(inst.n, 'attach'); g; g = take(inst.n, 'attach')) await runGroup(inst, g, 'attach');
      if (left(inst.n, 'launch') === 0) return;
      // The launch groups start their own app per group: close the attach one first.
      await shAsync('npm run app:kill', inst.env, tag);
      if (
        (await shAsync(
          'npm run preflight',
          { ...inst.env, WDIO_MODE: 'launch', PREFLIGHT_CLEAN_LEFTOVERS: '1' },
          tag,
        )) !== 0
      ) {
        console.log(
          `[fast-run] ${tag ? `[${tag}] ` : ''}preflight launch FAIL — làn này dừng, phần còn lại để làn khác`,
        );
        failed = true;
        return;
      }
      for (let g = take(inst.n, 'launch'); g; g = take(inst.n, 'launch')) await runGroup(inst, g, 'launch');
    } finally {
      stopPark();
      // A parked copy holds ~1 GB; nothing else needs it this run.
      if (inst.n) {
        activeCopies -= 1;
        await shAsync('npm run app:kill', inst.env, tag);
      }
    }
  }

  console.log(`[fast-run] ${elapsed()} ===== song song: ${instances.length} app =====`);
  await Promise.all(instances.map((inst) => lane(inst)));
  // A lane that sat out (copy not signed in) leaves its share: instance 0 takes it now.
  const inst0 = instances[0];
  for (const mode of ['attach', 'launch']) {
    if (left(0, mode) === 0) continue;
    if (mode === 'launch') sh('npm run app:kill');
    for (let g = take(0, mode); g; g = take(0, mode)) await runGroup(inst0, g, mode);
  }

  // Merchant-global specs last, with nothing else touching the merchant.
  const alone = queues.alone;
  if (alone.attach.length || alone.launch.length) {
    console.log(
      `\n[fast-run] ${elapsed()} ===== chạy riêng (cài đặt / báo cáo / danh sách chung): app gốc =====`,
    );
    for (const g of alone.attach) await runGroup(inst0, g, 'attach');
    if (alone.launch.length) {
      sh('npm run app:kill');
      if (
        alone.attach.length &&
        sh('npm run preflight', { WDIO_MODE: 'launch', PREFLIGHT_CLEAN_LEFTOVERS: '1' }) !== 0
      )
        failed = true;
      for (const g of alone.launch) await runGroup(inst0, g, 'launch');
    }
  }

  sh(`npx tsx "${path.join(REPO_ROOT, 'scripts', 'finalize-dashboard.ts')}"`, {
    DASHBOARD_RUN_MODES: runModes,
  });
  if (readWarm()?.enabled === false) sh('npm run app:kill');
  return failed;
}

const failed = plan.lanes ? await runLanes() : await runPhases();
process.exit(failed ? 1 : 0);
