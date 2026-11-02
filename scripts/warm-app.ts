/**
 * `tsx scripts/warm-app.ts` — the GUI runner's PRE-WARM.
 *
 * Have a booted, attachable app waiting BEFORE anyone presses Run, so the ⚡
 * attach phase starts in seconds. Measured on this machine: a launch-mode start
 * pays ~5s preflight + ~4s launcher + ~5s worker + 17–20s splash (opening sync)
 * — and far more on a cold cache (77s before wdio printed a line). Attached to an
 * app that already finished booting, the first test starts ~9s after wdio does.
 *
 * What it does, in order:
 *   1. An app already answering on the CDP port with a drivable staff window →
 *      reuse it (start msedgedriver beside it if that died), reloading its
 *      webviews first if a run has driven it since it was last fresh.
 *   2. A TITLED app window running WITHOUT remote debugging (someone's own
 *      window), or a tauri-driver (another launch lane mid-run) → leave
 *      everything alone and report `busy`. The run then boots its own app.
 *   3. Nothing running, the windowless helper a closed app leaves behind, or our
 *      own CDP app wedged → launch a fresh one (`launchAttachedApp`, same wiring
 *      as `npm run app:launch`).
 *   4. Wait until the staff window is past /splashscreen, leave the "fresh" flag
 *      (the run's first attach worker then skips its reset), and run the
 *      preflight in attach mode so the run itself can skip it. A reused app that
 *      dies on the way gets one fresh launch; a failed preflight reports `error`.
 *   5. Read the run's module graph once (see `primeModuleGraph`), so a cold disk
 *      is paid here and not after Run.
 *
 * The LAST stdout line is one JSON object the runner parses:
 *   { "state": "ready" | "busy" | "error", "detail": "...", "preflightOk": bool,
 *     "launched": bool, "cdp": "host:port" }
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { loadEnv } from '../configs/env/loadEnv.js';
import {
  WARM_FRESH_FLAG,
  ensureAttachDriver,
  isAttachedAppHealthy,
  launchAttachedApp,
  markWarmFresh,
  reloadAttachedApp,
  waitForBootedApp,
} from '../src/support/attachApp.js';
import { isPortOpen } from '../src/support/net.js';
import { TAURI_DRIVER_IMAGE, appWindowTitles, runningImages } from '../src/support/process.js';

interface WarmResult {
  state: 'ready' | 'busy' | 'error';
  detail: string;
  preflightOk: boolean;
  launched: boolean;
  /** Past the splash but on /login — a device nobody has signed in (a fresh parallel copy). */
  signedOut?: boolean;
}

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The attach-mode preflight, its table left in this script's output for the runner log. */
function attachPreflight(): boolean {
  const r = spawnSync('npx tsx scripts/preflight.ts', {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, WDIO_MODE: 'attach' },
  });
  return r.status === 0;
}

/**
 * Read the run's module graph once, so the click does not pay for it.
 *
 * Measured right after a session restart: the first worker-side import took
 * 28.6s (6.4s the next time) and the launcher's config load 11.9s (3.1s) — the
 * cost of reading node_modules and the page objects cold (disk + Defender), not
 * of compiling them. One dry launcher pass (no specs → no worker, no session)
 * plus one import of the worker side leaves all of it in the OS cache and tsx's
 * transform cache. `DASHBOARD_RUN_PHASE=2/3` keeps the dry pass from clearing
 * or writing the dashboard's run fragments.
 */
function primeModuleGraph(): void {
  spawnSync(
    'node node_modules/@wdio/cli/bin/wdio.js run configs/wdio/wdio.bulk-attach.conf.ts --spec .tmp/no-such.spec.ts',
    {
      shell: true,
      stdio: 'ignore',
      env: { ...process.env, WDIO_MODE: 'attach', DASHBOARD_RUN_PHASE: '2/3' },
    },
  );
  const graph = [
    'webdriverio',
    '@wdio/mocha-framework',
    '@wdio/local-runner',
    './src/pages/index.ts',
    './src/flows/index.ts',
    './tests/setup/rootHooks.ts',
  ];
  spawnSync(`npx tsx -e "Promise.all(${JSON.stringify(graph).replace(/"/g, "'")}.map((m) => import(m)))"`, {
    shell: true,
    stdio: 'ignore',
  });
}

/** A ready app: past the splash, marked fresh, attach preflight run. */
async function settle(launched: boolean): Promise<WarmResult> {
  const url = await waitForBootedApp();
  if (!url)
    return { state: 'error', detail: 'app không qua được splash trong 90s', preflightOk: false, launched };
  markWarmFresh();
  const preflightOk = attachPreflight();
  if (!preflightOk) {
    return { state: 'error', detail: 'preflight attach FAIL — xem .tmp/gui-warm.log', preflightOk, launched };
  }
  const pathname = new URL(url).pathname;
  return {
    state: 'ready',
    detail: pathname,
    preflightOk,
    launched,
    signedOut: pathname.startsWith('/login'),
  };
}

async function warm(): Promise<WarmResult> {
  const env = loadEnv();
  if (!env.APP_PATH)
    return { state: 'error', detail: 'APP_PATH chưa resolve được', preflightOk: false, launched: false };

  let result: WarmResult;
  if (await isAttachedAppHealthy(1)) {
    await ensureAttachDriver();
    // A run drove this app since it was last fresh: hand the next run a clean webview.
    if (!fs.existsSync(WARM_FRESH_FLAG)) await reloadAttachedApp();
    result = await settle(false);
    // It died under us (closed by hand mid-warm, …): one fresh launch, then report.
    if (result.state === 'error' && !(await isAttachedAppHealthy(1))) {
      await launchAttachedApp();
      result = await settle(true);
    }
  } else {
    const cdpOpen = await isPortOpen(env.DRIVER_HOST, env.REMOTE_DEBUG_PORT);
    if (runningImages([TAURI_DRIVER_IMAGE]).length) {
      return {
        state: 'busy',
        detail: 'một lane launch khác đang chạy (tauri-driver)',
        preflightOk: false,
        launched: false,
      };
    }
    // A TITLED window without CDP is a person's own app; a windowless volt-pos.exe
    // is the helper a closed window left behind, safe to clear with the rest.
    if (!cdpOpen && appWindowTitles().some(Boolean)) {
      return {
        state: 'busy',
        detail: 'app đang mở không có CDP (cửa sổ người dùng) — không đụng vào',
        preflightOk: false,
        launched: false,
      };
    }
    // Nothing running, a leftover helper, or OUR CDP app stuck on a screen the
    // self-heal would replace anyway.
    await launchAttachedApp();
    result = await settle(true);
  }
  // A parallel instance runs beside the installed app's warm, which primed the graph already.
  if (result.state === 'ready' && env.INSTANCE === 0) primeModuleGraph();
  return result;
}

let result: WarmResult;
try {
  result = await warm();
} catch (error) {
  result = { state: 'error', detail: reason(error), preflightOk: false, launched: false };
}
// `cdp` lets the runner probe the app's health without loading the TS env itself.
const { DRIVER_HOST, REMOTE_DEBUG_PORT } = loadEnv();
console.log(JSON.stringify({ ...result, cdp: `${DRIVER_HOST}:${String(REMOTE_DEBUG_PORT)}` }));
process.exitCode = result.state === 'error' ? 1 : 0;
