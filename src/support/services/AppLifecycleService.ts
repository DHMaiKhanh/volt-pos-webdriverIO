import fs from 'node:fs';
import path from 'node:path';
import type { Frameworks } from '@wdio/types';
import { browser } from '@wdio/globals';
import allure from '@wdio/allure-reporter';
import { Paths } from '../../../configs/constants/paths.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';
import { resetDatabases } from '../../db/reset.js';
import { collectAppLogs } from '../../db/appLogs.js';
import { startUpdaterWatcher, stopUpdaterWatcher } from '../../helpers/updater.js';
import { installStepOverlay } from '../../helpers/steps.js';
import { moduleLogger } from '../../utils/logger.js';
import { APP_IMAGE_NAMES, killStaleProcesses, waitForImagesGone } from '../process.js';

const log = moduleLogger('AppLifecycleService');

const slug = (value: string): string =>
  value
    .replace(/[^\w\d]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .toLowerCase();

/**
 * Everything around a session that is about the APP rather than the driver.
 *
 * Registered BEFORE {@link TauriDriverService} so its `beforeSession` clears
 * stale processes first — starting a driver while an old app window is alive
 * hands the session to the wrong process (see `killStaleProcesses`).
 */
export default class AppLifecycleService {
  /**
   * Synchronous on purpose. Everything it does — killing strays, wiping the
   * databases, creating the report directories — is `node:fs` and `node:child_process`
   * work with no await in it, and WebdriverIO happily accepts a `void` hook. An
   * `async` wrapper here would only advertise a suspension point that does not
   * exist.
   */
  beforeSession(): void {
    const env = loadEnv();

    // ATTACH MODE OWNS NOTHING. `npm run app:launch` started both the app and the
    // msedgedriver this session is about to connect to, and WebdriverIO runs
    // every `beforeSession` before it creates the session — so sweeping drivers
    // here would kill that msedgedriver and the run would then fail creating a
    // session against a dead port. TauriDriverService already no-ops in attach
    // mode, so nothing would restart it either.
    const owned = env.MODE === 'launch';
    const killed = killStaleProcesses({ app: owned, drivers: owned });
    if (killed.length) log.warn(`Cleared stale processes from a previous run: ${killed.join(', ')}`);

    // `taskkill /F /T` returns before the kernel has finished tearing the tree
    // down, and `resetDatabases()` REFUSES to run while the app is still listed
    // (a half-dead process still holds its SQLCipher handles). Without this the
    // session aborts on `RESET_DB=true` roughly whenever the machine is busy.
    if (killed.length && env.RESET_DB) {
      const survivors = waitForImagesGone(APP_IMAGE_NAMES);
      if (survivors.length) {
        log.warn(`Still running after taskkill: ${survivors.join(', ')} — the reset will refuse.`);
      }
    }

    if (env.RESET_DB) {
      const result = resetDatabases({
        merchantId: env.MERCHANT_ID,
        identifier: env.APP_IDENTIFIER,
        backup: true,
      });
      log.warn(
        `RESET_DB: removed ${String(result.removed.length)} database file(s) for merchant ` +
          `${env.MERCHANT_ID}` +
          (result.backupPath ? `; snapshot kept at ${result.backupPath}` : ''),
      );
    }

    for (const dir of [Paths.SCREENSHOTS, Paths.APP_LOGS, Paths.ALLURE_RESULTS]) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async before(): Promise<void> {
    const env = loadEnv();

    allure.addLabel('env', env.ENV);
    allure.addLabel('mode', env.MODE);
    allure.addLabel('upstream', env.UPSTREAM_BASE_URI);

    if (env.SHOW_STEPS) await installStepOverlay();
    if (env.AUTO_DISMISS_UPDATER) startUpdaterWatcher();
  }

  /**
   * Capture evidence at the moment of failure.
   *
   * A desktop app leaves almost nothing behind on its own: there is no browser
   * console to reopen and no network tab. The screenshot plus the app's own
   * rolling log is the entire post-mortem, so both are attached to the Allure
   * result rather than only written to disk, where a CI job would discard them.
   */
  async afterTest(test: Frameworks.Test, _context: unknown, result: Frameworks.TestResult): Promise<void> {
    if (result.passed) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `${slug(test.parent ?? '')}__${slug(test.title)}__${stamp}`;

    try {
      const shotPath = path.join(Paths.SCREENSHOTS, `${base}.png`);
      await browser.saveScreenshot(shotPath);
      await allure.addAttachment('Screenshot', fs.readFileSync(shotPath), 'image/png');
      log.info(`Screenshot: ${shotPath}`);
    } catch (error) {
      log.warn(`Could not capture a screenshot: ${(error as Error).message}`);
    }

    try {
      const url = await browser.getUrl();
      await allure.addAttachment('URL at failure', url, 'text/plain');
    } catch {
      /* the session may already be gone */
    }

    try {
      const logs = collectAppLogs({ identifier: loadEnv().APP_IDENTIFIER, tailLines: 400 });
      if (logs) {
        const logPath = path.join(Paths.APP_LOGS, `${base}.log`);
        fs.writeFileSync(logPath, logs, 'utf8');
        await allure.addAttachment('App log (tail)', logs, 'text/plain');
      }
    } catch (error) {
      log.debug(`No app log collected: ${(error as Error).message}`);
    }
  }

  /**
   * Synchronous for the same reason as {@link beforeSession}: stopping the
   * updater watcher clears an interval, and the shutdown itself belongs to
   * {@link afterSession}, which runs after the driver is gone.
   */
  after(): void {
    const env = loadEnv();
    stopUpdaterWatcher();

    if (env.KEEP_APP_OPEN) {
      log.warn('KEEP_APP_OPEN=true — leaving the app running for manual inspection.');
    }
  }

  /**
   * Last resort: nothing this run STARTED may outlive it.
   *
   * The drivers are swept here as well as the app, and that is not redundant
   * with `TauriDriverService.after()`. That hook calls `child.kill()`, which on
   * Windows terminates tauri-driver alone — the msedgedriver it spawned, and
   * the WebView2 hosts under it, are left holding port 4444. The next spec
   * file's `beforeSession` clears them, so the leak is invisible mid-run and
   * only shows up after the LAST session, where it blocks the next `npm test`.
   *
   * Attach mode is excluded from both: `npm run app:launch` owns that app and
   * that driver, and the operator ends them with `npm run app:kill`.
   */
  afterSession(): void {
    const env = loadEnv();
    if (env.KEEP_APP_OPEN) return;

    const owned = env.MODE === 'launch';
    killStaleProcesses({ app: owned, drivers: owned });
  }
}
