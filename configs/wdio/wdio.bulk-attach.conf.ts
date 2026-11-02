import path from 'node:path';
import { config as bulk } from './wdio.bulk.conf.js';
import { Paths } from '../constants/paths.js';
import { loadEnv } from '../env/loadEnv.js';

const env = loadEnv();

/**
 * Specs the attach lane cannot drive: anything that drives the CUSTOMER DISPLAY.
 *
 * CDP attach exposes only the staff window — the second (customer) window shows as
 * a bare `about:blank` target no `switchToCustomer` can reach — so a customer-tip /
 * signature / customer-display spec wedges on the window switch. The self-heal then
 * relaunches a clean app for the NEXT file, so a miss here only costs one relaunch,
 * not a cascade; this list just keeps those relaunches down. The whole `cd-e2e`
 * folder is customer-display by definition; the `@dual-window` TAG (handled by the
 * grep below) covers the rest that live inside otherwise-attachable files. Run
 * these on the LAUNCH lane (`test:bulk`), which drives both windows.
 */
const ATTACH_EXCLUDE: readonly string[] = [
  path.join(Paths.TESTS, 'regression', 'volt-qc', 'cd-e2e', '*.spec.ts'),
];

/**
 * BULK + ATTACH lane — the bulk tuning, but driving an app that is ALREADY
 * RUNNING instead of relaunching it per spec file.
 *
 * ## Why this exists
 *
 * In the normal (launch) mode every spec file pays a full app relaunch:
 * `AppLifecycleService.beforeSession` kills the old app, `TauriDriverService`
 * starts a fresh tauri-driver which launches the binary, and `afterSession`
 * tears it all down again. Measured warm, that handshake is ~15s per spec — on
 * 200 files that is ~50 minutes spent booting the same app over and over.
 *
 * Attach mode launches the app ONCE (`npm run app:launch`, CDP enabled) and
 * every spec re-attaches to that one long-lived process over WebView2's
 * debugger address. Nothing relaunches; the per-spec cost drops to a quick
 * re-attach. Both services already no-op in attach mode (they check
 * `env.MODE === 'launch'`), so the app this config drives is the operator's.
 *
 * ## The trade-off, stated plainly
 *
 * The app is NOT freshly booted per spec. Isolation then rests entirely on the
 * root hooks (`ensureLoggedIn` + `returnToHome` + `switchToMain`) getting back
 * to /home between files — and, crucially, there is NO self-heal: if one spec
 * leaves the app crashed or on a dead screen, launch mode would have relaunched
 * a clean app for the next file, but attach mode cannot, so the rest of the run
 * fails. Use this for a fast functional sweep on a healthy app; keep the plain
 * `test:bulk` (launch) lane for the authoritative, self-healing full run.
 *
 * ## How to use
 *
 *   1. npm run app:launch        # start the app once with CDP
 *   2. npm run test:bulk-attach  # run the whole suite against it, no relaunch
 *   3. npm run app:kill          # stop the app when done
 *
 * `npm run bulk:attached` does all three in one command.
 */
export const config: WebdriverIO.Config = {
  ...bulk,

  // Drop the customer-display files on top of whatever the bulk lane already
  // excludes (_manual, _recovery, quarantine) — attach cannot drive the 2nd window.
  exclude: [...(bulk.exclude ?? []), ...ATTACH_EXCLUDE],

  // Skip @broken (bulk's reason) AND @dual-window: the latter's cross-window
  // assertions only hold on the launch lane, where both windows are real handles.
  mochaOpts: {
    ...bulk.mochaOpts,
    grep: '@broken|@dual-window',
    invert: true,
  },

  // Attach to the running WebView2 instead of letting tauri-driver launch one.
  // The port must match what `app:launch` opened (REMOTE_DEBUG_PORT).
  capabilities: [
    {
      browserName: 'MicrosoftEdge',
      'ms:edgeOptions': {
        debuggerAddress: `127.0.0.1:${String(env.REMOTE_DEBUG_PORT)}`,
      },
    },
  ],
  specFileRetries: 0,
};
