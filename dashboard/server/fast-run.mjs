/**
 * Runs one GUI job as a sequence of wdio phases — or, with `lanes`, as parallel
 * lanes over several app instances (docs/parallel-instances.md).
 *
 *   node fast-run.mjs <plan.json>
 *
 * plan.json = { phases: [{ name, conf, mode: 'attach' | 'launch' }], settleScale?, warmFile? }
 *           | { lanes: { instances: [{ n, slot, store, env }], queues }, settleScale?, warmFile? }
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
  // No usable warm app: whatever Volt POS / driver is up is in the way — an app the
  // updater relaunched (no CDP), one opened by hand, an older warm's msedgedriver
  // still on :4444. Preflight only reports those (02/11: the run never started), and
  // a GUI sweep owns the machine, so clear them first. Copies (`-iN`) are not touched.
  if (!warmReady) sh('npm run app:kill');
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

/**
 * Parallel lanes: one per app in `plan.lanes.instances` (1–3, dashboard/server/apps.mjs).
 *
 *   1. Boot every app at once. Instance 0 (the installed dev app) attaches to the
 *      pre-warmed app; a copy is killed, parked off-screen and warmed. A copy that
 *      is signed out or fails to boot sits the run out — the others take its share.
 *   2. Shared phase: `primary` work (card terminal / gift card / appointments) only
 *      on the first live app, `any` work on whichever app is free.
 *   3. `alone` phase (store-wide settings / reports): nothing else may touch that
 *      store, so ONE app per store runs it — with two stores (staging 14 + 100004,
 *      prod 2949 + 20258) the two halves run side by side.
 */
async function runLanes() {
  const { instances, queues } = plan.lanes;
  resetDashboardFragments();
  const runModes = `lanes×${instances.length}`;
  const common = { ...phaseEnv, DASHBOARD_RUN_PHASE: '2/3', DASHBOARD_RUN_MODES: runModes };
  let failed = false;

  const tagOf = (inst) => (inst.n ? `i${inst.n}` : '');
  const pre = (inst) => (inst.n ? `[i${inst.n}] ` : '');
  const kill = (inst) => shAsync('npm run app:kill', inst.env, tagOf(inst));
  const describe = (inst) =>
    `App ${inst.slot ?? 1} = ${inst.n ? `i${inst.n}` : 'app đã cài'}${inst.store ? ` · tiệm ${inst.store}` : ''}`;
  console.log(`[fast-run] ${elapsed()} ${instances.map(describe).join(' | ')}`);

  /* 1. Boot */
  const firstMode = queues.primary.attach.length || queues.any.attach.length ? 'attach' : 'launch';
  const installed = instances.find((inst) => !inst.n);
  if (installed) {
    const warm = await settledWarm();
    if (!preflightFirst(warm, firstMode)) process.exit(1);
    installed.mode = firstMode;
  }
  const copies = instances.filter((inst) => inst.n);
  const booted = await Promise.all(
    copies.map(async (inst) => {
      // Always a fresh copy: one left open by hand (the QR sign-in) keeps a small,
      // framed window, and tests then click outside its viewport. A fresh launch
      // takes the seeded 1920×1080 frameless placement — the installed app's
      // fullscreen viewport. Parked from the first frame, or it covers the screen.
      await kill(inst);
      inst.stopPark = parkWatcher(inst);
      const warm = await warmInstance(inst);
      if (warm.sitOut) {
        inst.stopPark();
        await kill(inst);
        return false;
      }
      inst.mode = 'attach';
      return true;
    }),
  );
  const live = instances.filter((inst) => !inst.n || booted[copies.indexOf(inst)]);
  if (!live.length) {
    console.log(`[fast-run] ${elapsed()} không app nào sẵn sàng — dừng (xem lý do từng làn ở trên)`);
    process.exit(1);
  }
  // The installed app owns the card terminal / gift-card work when it is in the run.
  const primary = live.find((inst) => !inst.n) ?? live[0];

  /** Switch a lane to launch mode once: close its attach app, preflight launch. */
  async function toLaunch(inst) {
    if (inst.mode === 'launch') return true;
    if (inst.dead) return false;
    await kill(inst);
    const code = await shAsync(
      'npm run preflight',
      { ...inst.env, WDIO_MODE: 'launch', PREFLIGHT_CLEAN_LEFTOVERS: '1' },
      tagOf(inst),
    );
    if (code !== 0) {
      console.log(`[fast-run] ${pre(inst)}preflight launch FAIL — làn này dừng, phần còn lại để làn khác`);
      failed = true;
      inst.dead = true;
      return false;
    }
    inst.mode = 'launch';
    return true;
  }

  async function runGroup(inst, group, mode) {
    const started = Date.now();
    // Attach after launch: no app is up, the first attach worker's self-heal boots one.
    if (mode === 'attach') inst.mode = 'attach';
    console.log(`\n[fast-run] ${elapsed()} ${pre(inst)}===== ${group.id} (${mode}, ${group.files} file) =====`);
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
      tagOf(inst),
    );
    if (code !== 0) failed = true;
    console.log(
      `[fast-run] ${pre(inst)}${group.id} xong: exit ${code}, ${Math.round((Date.now() - started) / 60000)} phút`,
    );
  }

  /* 2. Shared phase */

  /** Lanes other than primary still working (or about to): while one is, primary leaves them the shared attach work. */
  let activeOthers = live.length - 1;

  /**
   * Next group for `inst` in `mode`. Only the primary lane can take `primary`, so
   * it takes no shared work while primary work is waiting: in run 5 it drained two
   * shared attach groups (26 min) before its primary launch groups, and the copy
   * then sat idle for the last 70 min of the parallel phase.
   */
  const take = (inst, mode) => {
    if (inst !== primary) return queues.any[mode].shift() ?? null;
    const own = queues.primary[mode].shift();
    if (own) return own;
    if (mode === 'attach' && queues.primary.launch.length && activeOthers > 0) return null;
    return queues.any[mode].shift() ?? null;
  };
  const left = (inst, mode) => queues.any[mode].length + (inst === primary ? queues.primary[mode].length : 0);

  async function lane(inst) {
    try {
      for (let g = take(inst, 'attach'); g; g = take(inst, 'attach')) await runGroup(inst, g, 'attach');
      if (left(inst, 'launch') === 0) return;
      if (!(await toLaunch(inst))) return;
      for (let g = take(inst, 'launch'); g; g = take(inst, 'launch')) await runGroup(inst, g, 'launch');
    } finally {
      if (inst !== primary) activeOthers -= 1;
    }
  }

  console.log(`[fast-run] ${elapsed()} ===== song song: ${live.length} app =====`);
  await Promise.all(live.map((inst) => lane(inst)));
  // A lane that died leaves its share: the primary lane takes it now.
  for (const mode of ['attach', 'launch']) {
    if (left(primary, mode) === 0) continue;
    if (mode === 'launch' && !(await toLaunch(primary))) break;
    for (let g = take(primary, mode); g; g = take(primary, mode)) await runGroup(primary, g, mode);
  }

  /* 3. Store-wide specs last: one app per store, nothing else touching that store */
  const alone = queues.alone;
  if (alone.attach.length || alone.launch.length) {
    const perStore = new Map();
    for (const inst of live) if (!inst.dead && !perStore.has(inst.store ?? '')) perStore.set(inst.store ?? '', inst);
    const storeLanes = [...perStore.values()];
    // The other apps of each store must be idle — close them, which also hands back their RAM.
    for (const inst of live) {
      if (storeLanes.includes(inst) || !inst.n) continue;
      inst.stopPark?.();
      await kill(inst);
      inst.closed = true;
    }
    console.log(
      `\n[fast-run] ${elapsed()} ===== chạy riêng (cài đặt / báo cáo / danh sách chung): ` +
        `${storeLanes.map(describe).join(' + ')} =====`,
    );
    await Promise.all(
      storeLanes.map(async (inst) => {
        for (let g = alone.attach.shift(); g; g = alone.attach.shift()) await runGroup(inst, g, 'attach');
        if (!alone.launch.length || !(await toLaunch(inst))) return;
        for (let g = alone.launch.shift(); g; g = alone.launch.shift()) await runGroup(inst, g, 'launch');
      }),
    );
  }

  // A parked copy holds ~1 GB; nothing else needs it after the run.
  for (const inst of live) {
    if (!inst.n || inst.closed) continue;
    inst.stopPark?.();
    await kill(inst);
  }

  sh(`npx tsx "${path.join(REPO_ROOT, 'scripts', 'finalize-dashboard.ts')}"`, {
    DASHBOARD_RUN_MODES: runModes,
  });
  if (installed && readWarm()?.enabled === false) sh('npm run app:kill');
  return failed;
}

const failed = plan.lanes ? await runLanes() : await runPhases();
process.exit(failed ? 1 : 0);
