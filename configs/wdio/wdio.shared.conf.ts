import path from 'node:path';
import { Paths } from '../constants/paths.js';
import { Timeouts } from '../constants/timeouts.js';
import { loadEnv } from '../env/loadEnv.js';
import { resolveAppCandidates } from '../env/resolveApp.js';
import AppLifecycleService from '../../src/support/services/AppLifecycleService.js';
import TauriDriverService from '../../src/support/services/TauriDriverService.js';

const env = loadEnv();

/**
 * tauri-driver's capability namespace.
 *
 * Not part of the W3C set and not in `@wdio/types`, so it is declared here and
 * merged in with a cast at the bottom of this file.
 */
interface TauriCapabilities {
  'tauri:options': {
    /** Absolute path to the binary tauri-driver should launch. */
    application: string;
    /** CLI arguments handed to that binary. */
    args?: string[];
  };
}

const spec = (...segments: string[]): string => path.join(Paths.TESTS, ...segments);

/**
 * Configuration shared by every environment.
 *
 * The per-environment files re-export this with only the differences applied,
 * so there is exactly one place where the framework's behaviour is defined and
 * three small files describing WHICH BUILD each lane drives.
 */
export const shared: WebdriverIO.Config = {
  runner: 'local',

  // tauri-driver speaks plain WebDriver over HTTP on this port. There is no
  // `services: ['tauri']` package to do this — the driver is a separate binary,
  // started by TauriDriverService below.
  hostname: env.DRIVER_HOST,
  port: env.DRIVER_PORT,
  path: '/',

  specs: [spec('**', '*.spec.ts')],
  exclude: [],

  suites: {
    /** Read-only. The ONLY suite permitted against a production build. */
    smoke: [spec('smoke', '**', '*.spec.ts')],
    /** Full functional coverage. Creates data — dev/staging only. */
    regression: [spec('regression', '**', '*.spec.ts')],
    home: [spec('regression', 'home', '**', '*.spec.ts')],
    checkout: [spec('regression', 'checkout', '**', '*.spec.ts')],
    orderHistory: [spec('regression', 'order-history', '**', '*.spec.ts')],
    settings: [spec('regression', 'settings', '**', '*.spec.ts')],
  },

  /**
   * One session at a time, always.
   *
   * This is not a tuning choice that could be relaxed later. tauri-driver
   * proxies a single session, the app enforces single-instance through
   * `tauri-plugin-single-instance`, and the two windows share one SQLCipher
   * database on this machine. A second worker would attach to the first
   * worker's app and corrupt both runs.
   */
  maxInstances: 1,
  maxInstancesPerCapability: 1,

  capabilities: [
    {
      maxInstances: 1,
      'tauri:options': {
        application: env.APP_PATH,
        args: env.APP_ARGS,
      },
    } as WebdriverIO.Capabilities & TauriCapabilities,
  ],

  logLevel: env.LOG_LEVEL === 'debug' ? 'debug' : 'warn',
  outputDir: path.join(Paths.REPORTS, 'wdio-logs'),

  bail: 0,
  waitforTimeout: Timeouts.MEDIUM,
  waitforInterval: 200,
  connectionRetryTimeout: Timeouts.API,
  connectionRetryCount: 2,

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: Timeouts.MOCHA_TEST,
    // Hooks do the app boot (splash + migrations + first sync), which is far
    // slower than any single assertion. Sharing one budget would make a cold
    // start look like a hanging test.
    slow: 10_000,

    /**
     * Mocha ROOT HOOKS. Without this entry the suite has no sign-in step at all.
     *
     * `tests/setup/rootHooks.ts` exports `mochaHooks`, and root hooks are not
     * discovered — Mocha only collects them from a module named here, which it
     * merges into `mochaOpts.rootHooks`. Omit it and `ensureLoggedIn()` never
     * runs, `switchToMain()` never runs between tests, and every spec fails in
     * its own `before` against a cold app parked on `/splashscreen` → `/login`.
     *
     * ABSOLUTE, because `@wdio/mocha-framework` resolves each entry against
     * `config.rootDir` (which follows the cwd wdio was invoked from), so a
     * repo-relative string silently resolves to nothing when the runner is
     * started from anywhere but the project root.
     *
     * It stays `.ts`: WebdriverIO loads specs and `require` entries through the
     * same `tsx` hook, so a pre-compiled `.js` would be the odd one out.
     */
    require: [path.join(Paths.TESTS, 'setup', 'rootHooks.ts')],
  },

  /**
   * Retries.
   *
   * One retry on dev/staging absorbs the genuinely non-deterministic parts of a
   * desktop run — a sync round trip landing late, the WebView2 host taking an
   * extra beat after a window switch. Production runs with ZERO retries: a
   * flaky result there is information, and re-running it hides that.
   */
  specFileRetries: env.SPEC_RETRIES,
  specFileRetriesDeferred: true,

  reporters: [
    ['spec', { symbols: { passed: '[PASS]', failed: '[FAIL]', skipped: '[SKIP]' } }],
    [
      'allure',
      {
        outputDir: Paths.ALLURE_RESULTS,
        disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false,
        useCucumberStepReporter: false,
      },
    ],
  ],

  // Order matters: AppLifecycleService.beforeSession clears stale app/driver
  // processes, and only then may TauriDriverService bind the port.
  services: [
    [AppLifecycleService, {}],
    [TauriDriverService, {}],
  ],

  /**
   * Run banner.
   *
   * Printing the resolved binary is the single most valuable line in the log.
   * Every environment is a different .exe (`src-tauri/build.rs` bakes the
   * backend in at compile time), and a machine legitimately holds several — so
   * "the tests passed" means nothing until you know WHICH build passed them.
   */
  onPrepare(): void {
    const candidates = resolveAppCandidates(process.env.APP_PATH, env.VOLT_POS_SRC);
    const lines = [
      '',
      '='.repeat(78),
      ` VOLT POS E2E — ENV=${env.ENV}  MODE=${env.MODE}`,
      '='.repeat(78),
      ` Binary under test : ${env.APP_PATH || '(UNRESOLVED)'}`,
      ` Upstream API      : ${env.UPSTREAM_BASE_URI}`,
      ` Merchant          : ${env.MERCHANT_ID}`,
      ` Writes allowed    : ${String(env.WRITE_ALLOWED)}`,
      ` Reset DB          : ${String(env.RESET_DB)}`,
      ` Spec retries      : ${String(env.SPEC_RETRIES)}`,
      '-'.repeat(78),
      ` Other builds found on this machine (NOT used):`,
      ...candidates.slice(1).map((c) => `   - ${c.label}: ${c.exe}`),
      candidates.length <= 1 ? '   (none)' : '',
      '='.repeat(78),
      '',
    ].filter((l) => l !== '');

    console.log(lines.join('\n'));
  },

  onComplete(): void {
    console.log(
      `\nAllure results: ${Paths.ALLURE_RESULTS}\n  npm run report:allure && npm run report:open\n`,
    );
  },
};
