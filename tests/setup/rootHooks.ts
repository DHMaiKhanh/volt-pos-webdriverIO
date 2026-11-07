/**
 * Mocha ROOT HOOKS — the per-file preamble every spec would otherwise repeat.
 *
 * ## Wiring
 *
 * Root hooks are not discovered; Mocha has to be told to load this module.
 * Add it to the shared config (`configs/wdio/wdio.shared.conf.ts`):
 *
 * ```ts
 * mochaOpts: {
 *   ui: 'bdd',
 *   timeout: Timeouts.MOCHA_TEST,
 *   require: ['./tests/setup/rootHooks.ts'],
 * },
 * ```
 *
 * The path is repo-relative and the file stays `.ts`: WebdriverIO loads specs
 * and `require` entries through the same `tsx` register hook, so a pre-compiled
 * `.js` would be the odd one out here, not the safe choice.
 *
 * ## Why the hooks are shaped the way they are
 *
 * WebdriverIO runs ONE Mocha instance per spec file, so `beforeAll` fires once
 * per file rather than once per session. That is why {@link ensureLoggedIn} has
 * to be idempotent — it is a "get me to a signed-in till" query, not a login
 * action — and why `afterAll` is the right place to hand the next file a known
 * screen.
 */

import { browser } from '@wdio/globals';
// Side effect: records WHY each runtime this.skip() happened, for the GUI.
import '../../src/support/skipReason.js';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { loadEnv } from '../../configs/env/loadEnv.js';
import { ensureLoggedIn, returnToHome } from '../../src/flows/index.js';
import { flushDeadTime } from '../../src/helpers/deadTime.js';
import { installStepOverlay, logStep } from '../../src/helpers/steps.js';
import { startUpdaterWatcher, stopUpdaterWatcher } from '../../src/helpers/updater.js';
import { reloadCustomerWindow, switchToMain } from '../../src/helpers/window.js';
import { settle } from '../../src/helpers/wait.js';
import {
  ensureHealthyAttachedApp,
  primeCustomerWindow,
  resetCustomerWindow,
} from '../../src/support/attachApp.js';
import { restoreDeviceBaseline } from '../../src/support/deviceBaseline.js';
import { ensurePasscodeGrant } from '../../src/support/passcodeGrant.js';
import { killStaleProcesses } from '../../src/support/process.js';
import { moduleLogger } from '../../src/utils/logger.js';

const log = moduleLogger('rootHooks');

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** `work`, or a rejection once `ms` pass — for calls a hung session would never answer. */
function withinMs<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what}: no answer within ${String(ms / 1000)}s`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Longest a recovery walk to /home may take before the file moves on. */
const RECOVER_HOME_MS = 60_000;

/**
 * What the recovery after a failed test may spend in all. WebdriverIO races every
 * hook against the timeout it had when it STARTED (@wdio/utils `executeAsync`), so
 * the hook's own `this.timeout()` does not extend it past MOCHA_TEST — and a hook
 * cut there makes Mocha skip every later test of the file, the one thing recovery
 * must not do. Kept under MOCHA_TEST with room to spare.
 */
const AFTER_FAILURE_BUDGET_MS = Timeouts.MOCHA_TEST - 15_000;

/** Longest the reload after a failed test may take, within that budget. */
const RELOAD_AFTER_FAILURE_MS = 45_000;

/**
 * Longest budget a test may claim with `this.timeout()` in its body (the suite's
 * largest is 15 min). See the root `beforeEach`.
 */
const BODY_TIMEOUT_CAP_MS = 20 * 60_000;

/**
 * Return to `/home` without letting the attempt replace a real failure.
 *
 * Recovery runs when the screen is already in an unknown state, so it is the
 * likeliest thing in the file to throw. Rethrowing here would overwrite the
 * assertion error Mocha is about to report with a navigation one, and the
 * diagnosis would be lost. Bounded, too: on a hung session the walk never
 * returns, and the hook would sit out its full timeout first.
 */
async function recoverToHome(ms: number = RECOVER_HOME_MS): Promise<void> {
  try {
    await withinMs(returnToHome(), ms, 'return to the till');
  } catch (error) {
    log.warn(`Could not return to a known screen: ${reason(error)}`);
  }
}

/** Does the WebDriver session still answer? A cheap read, capped. */
async function sessionAnswers(ms = 15_000): Promise<boolean> {
  try {
    await withinMs(browser.getWindowHandles(), ms, 'session check');
    return true;
  } catch (error) {
    log.warn(`The WebDriver session does not answer: ${reason(error)}`);
    return false;
  }
}

/**
 * Replace a dead session so the rest of a grouped worker can still run.
 *
 * Seen live on 2026-10-30: one command hung after a settings spec, the session
 * then died ("invalid session id"), and every later file of the 25-file group
 * sat out its 180s hooks on it — over an hour of nothing. `reloadSession()`
 * opens a fresh session with the same capabilities. Attach mode first replaces
 * the msedgedriver that holds the hung command (and the app, if it went with
 * it); launch mode first clears the old app window, which tauri-plugin-single-
 * instance would otherwise hand the new launch to.
 */
async function replaceDeadSession(): Promise<void> {
  if (loadEnv().MODE === 'attach') {
    killStaleProcesses({ app: false, drivers: true });
    await ensureHealthyAttachedApp();
  } else {
    killStaleProcesses({ app: true, drivers: false });
  }
  await withinMs(browser.reloadSession(), Timeouts.APP_BOOT, 'new session');
  log.warn('Replaced a dead WebDriver session — this file starts on a new one.');
}

/**
 * Reload both webviews and walk to a signed-in till: what a fresh app gives,
 * in ~2s measured instead of the ~15s of a real relaunch. It drops whatever the
 * last test left in memory (an open dialog, a search filter, a selected draft, a
 * tip-wait modal), which walking to /home does not.
 */
async function reloadToTill(): Promise<void> {
  // Attach mode reloads the customer window over CDP: a WebDriver refresh
  // leaves it on about:blank there, where no later switch can find it.
  const resetCustomer =
    loadEnv().MODE === 'attach' ? resetCustomerWindow().then(() => settle()) : reloadCustomerWindow();
  await resetCustomer.catch((error: unknown) =>
    log.warn(`Reload: could not reload the customer window: ${reason(error)}`),
  );
  await switchToMain();
  // Device settings left changed (virtual keyboard, language) go back to the
  // baseline here, so the reload below starts on them.
  await restoreDeviceBaseline();
  await browser.refresh();
  // A payment spec ends on /order/…/payment-success, and the reload keeps that
  // route. ensureLoggedIn() refuses to leave a signed-in screen by URL (that
  // would re-run the splash), so walk to the till through the UI first.
  await ensureLoggedIn().catch(async (error: unknown) => {
    if (!/parked on/.test(reason(error))) throw error;
    await recoverToHome();
    await ensureLoggedIn();
  });
  await recoverToHome();
}

/**
 * Give every spec FILE of a grouped worker the clean start a worker of its own gets.
 *
 * A grouped worker (`specs: [[a, b, c]]` — the GUI's ⚡ mode, one app launch for
 * many files) runs all its files in ONE Mocha instance, so these root hooks'
 * beforeAll/afterAll fire once for the group, not per file. Without this, file b
 * would start on whatever file a left in memory: each one failed whole groups.
 *
 * So each later file's top suite gets a FIRST before-all hook that runs
 * {@link reloadToTill}. Mocha only appends hooks, so it is moved to the front of
 * the suite's internal list — before the file's own `before` runs.
 */
function isolateGroupedFiles(root: Mocha.Suite | undefined): void {
  const files = root?.suites ?? [];
  files.slice(1).forEach((suite, i) => {
    const previous = files[i]?.file ?? 'unknown';
    suite.beforeAll('reset between grouped spec files', async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      flushDeadTime(previous);
      // A session the previous file left dead would fail this file and every
      // one after it in the group; start this one on a new session instead.
      if (!(await sessionAnswers())) await replaceDeadSession();
      await reloadToTill();
    });
    const hooks = (suite as unknown as { _beforeAll: unknown[] })._beforeAll;
    const reset = hooks.pop();
    if (reset !== undefined) hooks.unshift(reset);
  });
}

export const mochaHooks: Mocha.RootHookObject = {
  async beforeAll(this: Mocha.Context): Promise<void> {
    // The splash runs migrations, opens three SQLCipher databases and completes
    // a sync handshake — measured worst case ~50s cold. A hook otherwise
    // inherits `mochaOpts.timeout` (MOCHA_TEST), which would abort mid-boot on
    // a slow machine and report it as a hanging hook rather than a slow app.
    this.timeout(Timeouts.MOCHA_HOOK);

    // Attaching msedgedriver to the running app blanks the customer window (seen
    // 2026-11-03, Edge 156: /customer/ → about:blank the moment the session
    // opens), so the prime attachApp does BEFORE the session is undone. Every
    // payment that pushes a tip then waited on "Customer is adding a tip" for
    // good. Prime again now that the session exists — a no-op when it is loaded.
    if (loadEnv().MODE === 'attach') {
      await primeCustomerWindow().catch((error: unknown) =>
        log.warn(`Could not load the customer window: ${reason(error)}`),
      );
    }

    await ensureLoggedIn();

    // A worker's first file gets no between-files reset, and the device settings a
    // previous worker (or run) left behind survive app relaunches: restore them,
    // and reload only when one actually changed — the screens read them on mount.
    if ((await restoreDeviceBaseline()).length > 0) {
      await browser.refresh();
      await ensureLoggedIn();
    }

    // Re-seed the 30-minute passcode grant from a staff id a prior spec captured,
    // so merchant 14's gated actions (Quick Pay, Delete Order, service price,
    // income) skip the keypad for this file too. A no-op on the very first spec,
    // before any gate has been unlocked through the UI once.
    await ensurePasscodeGrant();

    await installStepOverlay();

    // The app's updater comparator is `|_current, _update| true`, so every
    // response counts as newer and an installed build reliably raises the
    // sonner toast — top-right, directly over the controls specs click. The
    // watcher clears it for the lifetime of the file.
    startUpdaterWatcher();

    isolateGroupedFiles(this.test?.parent);

    await logStep('Suite ready');
  },

  async beforeEach(this: Mocha.Context): Promise<void> {
    // WebdriverIO arms its own timer from the test's timeout BEFORE the body runs
    // (@wdio/utils `executeAsync`), so `this.timeout(6 * 60_000)` inside the body
    // never reached it and every such case was cut at MOCHA_TEST with a bare
    // "Error: Timeout" — 13 in run 5, PERM-034 a third of the way through its 15
    // gates. Hand the timer the largest budget a body may claim; Mocha still
    // enforces the body's own value. (WebdriverIO keeps the spec's toString.)
    const test = this.currentTest;
    if (test && /\bthis\.timeout\(/.test(test.fn?.toString() ?? '')) test.timeout(BODY_TIMEOUT_CAP_MS);

    // A `@dual-window` test that failed on the customer display leaves the
    // session switched to it. Every staff-side lookup then misses in a window
    // that has no staff controls, and the next failure names the wrong screen.
    await switchToMain();
  },

  async afterEach(this: Mocha.Context): Promise<void> {
    if (this.currentTest?.state !== 'failed') return;
    const deadline = Date.now() + AFTER_FAILURE_BUDGET_MS;
    const left = (): number => deadline - Date.now();

    // A test that failed on a HUNG session (Mocha cut it at its timeout, the
    // command still holds the session) would make every later test of the file
    // queue behind it and time out too — 30 tests × 120s. Replace it now; the
    // new session starts on a fresh page, so walking to /home is all it needs.
    //
    // A case cut by a TIMEOUT gets the same, answering session or not: Mocha and
    // WebdriverIO only stop WAITING for it, and its leftover commands then run into
    // whatever comes next. In run 7 one left the session on the customer display,
    // the next case's navigation turned that window into a second staff screen, and
    // every later payment that pushes a tip waited on it forever (split-plan-b, 16
    // failures). A new session cuts the leftover off.
    const timedOut = /^Timeout$|Timeout of \d+ms exceeded/.test(this.currentTest.err?.message ?? '');
    if (timedOut || !(await sessionAnswers())) {
      await replaceDeadSession().catch((error: unknown) =>
        log.warn(`Could not replace the session: ${reason(error)}`),
      );
      // An attached app outlives the session, its customer window included.
      if (loadEnv().MODE === 'attach') await resetCustomerWindow().catch(() => false);
      // A launched app starts over on the splash: let it finish booting first.
      await withinMs(ensureLoggedIn(), Math.max(5_000, left()), 'boot after the new session').catch(
        (error: unknown) => log.warn(`After the new session: ${reason(error)}`),
      );
      await recoverToHome(Math.max(5_000, left()));
      return;
    }

    // Recovery ONLY. Forcing `/home` after every test would break the specs
    // whose second `it` deliberately continues on the screen the first one
    // reached (order history opens a row it just asserted on). After a failure
    // the screen is unknown, which is the one case worth resetting — and walking
    // to /home is not enough: in run 6 a Home left unresponsive (staff and
    // service taps did nothing) failed every later test of 5 files on "cart pay
    // button" (37 tests, 35 min), while the reload between files cleared it.
    // Walk home BEFORE reloading: reloaded on a flow screen (payment-success, a
    // gated page) the walk back found no header link and sat out its 15s wait.
    await recoverToHome(Math.min(RECOVER_HOME_MS, left() - RELOAD_AFTER_FAILURE_MS));
    if (left() < 10_000) return;
    await withinMs(
      reloadToTill(),
      Math.min(RELOAD_AFTER_FAILURE_MS, left()),
      'reload after the failure',
    ).catch(async (error: unknown) => {
      log.warn(`Could not reload after the failure: ${reason(error)}`);
      if (left() > 5_000) await recoverToHome(left());
    });
  },

  async afterAll(this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);

    stopUpdaterWatcher();

    // The next spec FILE starts from whatever this one left behind — the driver
    // session outlives the Mocha instance. Handing it `/home` is what lets each
    // file assume a till and not a checkout screen.
    await recoverToHome();

    // Per-file dead time (blind pauses + probes for absent UI) → .tmp/dead-time.jsonl.
    flushDeadTime(this.test?.parent?.suites.at(-1)?.file ?? 'unknown');
  },
};
