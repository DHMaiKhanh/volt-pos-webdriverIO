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

import { Timeouts } from '../../configs/constants/timeouts.js';
import { ensureLoggedIn, returnToHome } from '../../src/flows/index.js';
import { installStepOverlay, logStep } from '../../src/helpers/steps.js';
import { startUpdaterWatcher, stopUpdaterWatcher } from '../../src/helpers/updater.js';
import { switchToMain } from '../../src/helpers/window.js';
import { moduleLogger } from '../../src/utils/logger.js';

const log = moduleLogger('rootHooks');

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Return to `/home` without letting the attempt replace a real failure.
 *
 * Recovery runs when the screen is already in an unknown state, so it is the
 * likeliest thing in the file to throw. Rethrowing here would overwrite the
 * assertion error Mocha is about to report with a navigation one, and the
 * diagnosis would be lost.
 */
async function recoverToHome(): Promise<void> {
  try {
    await returnToHome();
  } catch (error) {
    log.warn(`Could not return to a known screen: ${reason(error)}`);
  }
}

export const mochaHooks: Mocha.RootHookObject = {
  async beforeAll(this: Mocha.Context): Promise<void> {
    // The splash runs migrations, opens three SQLCipher databases and completes
    // a sync handshake — measured worst case ~50s cold. A hook otherwise
    // inherits `mochaOpts.timeout` (MOCHA_TEST), which would abort mid-boot on
    // a slow machine and report it as a hanging hook rather than a slow app.
    this.timeout(Timeouts.MOCHA_HOOK);

    await ensureLoggedIn();
    await installStepOverlay();

    // The app's updater comparator is `|_current, _update| true`, so every
    // response counts as newer and an installed build reliably raises the
    // sonner toast — top-right, directly over the controls specs click. The
    // watcher clears it for the lifetime of the file.
    startUpdaterWatcher();

    await logStep('Suite ready');
  },

  async beforeEach(): Promise<void> {
    // A `@dual-window` test that failed on the customer display leaves the
    // session switched to it. Every staff-side lookup then misses in a window
    // that has no staff controls, and the next failure names the wrong screen.
    await switchToMain();
  },

  async afterEach(this: Mocha.Context): Promise<void> {
    if (this.currentTest?.state !== 'failed') return;

    // Recovery ONLY. Forcing `/home` after every test would break the specs
    // whose second `it` deliberately continues on the screen the first one
    // reached (order history opens a row it just asserted on). After a failure
    // the screen is unknown, which is the one case worth resetting.
    await recoverToHome();
  },

  async afterAll(this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);

    stopUpdaterWatcher();

    // The next spec FILE starts from whatever this one left behind — the driver
    // session outlives the Mocha instance. Handing it `/home` is what lets each
    // file assume a till and not a checkout screen.
    await recoverToHome();
  },
};
