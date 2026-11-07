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
import { ensureHealthyAttachedApp } from '../attachApp.js';
import {
  afterActionCommand,
  replayCost,
  resetEvidence,
  writeEvidence,
  type FailureFiles,
} from '../evidence.js';
import { APP_IMAGE_NAMES, killStaleProcesses, waitForImagesGone } from '../process.js';

const log = moduleLogger('AppLifecycleService');

const slug = (value: string): string =>
  value
    .replace(/[^\w\d]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .toLowerCase();

/**
 * The Mocha title path of the test `afterTest` got. WDIO's Mocha test object
 * carries no `fullTitle` (only the immediate `parent`), but the Mocha context
 * it passes alongside still knows the real test.
 */
function fullTitleOf(test: Frameworks.Test, context: unknown): string {
  const ctx = context as
    { test?: { fullTitle?: () => string }; currentTest?: { fullTitle?: () => string } } | undefined;
  const fromCtx = ctx?.currentTest?.fullTitle?.() ?? ctx?.test?.fullTitle?.();
  return fromCtx || test.fullTitle || `${test.parent ?? ''} ${test.title}`.trim();
}

/** `work`, or a rejection after `ms` — evidence capture must not hang on a dead session. */
function withinMs<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no answer within ${String(ms)}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Cap on a failure's DOM snapshot — the inline icon SVGs alone run to megabytes. */
const DOM_SNAPSHOT_MAX_CHARS = 2_000_000;

/**
 * In-page: the document's markup with the icon SVG bodies and script/style text
 * dropped, headed by the URL, viewport, and every element scrolled off its
 * origin (a Home scrolled sideways left staff and service taps doing nothing in
 * run 6, and nothing in a screenshot said which container it was).
 */
function domSnapshot(max: number): string {
  const root = document.documentElement.cloneNode(true) as HTMLElement;
  root.querySelectorAll('svg').forEach((svg) => {
    svg.innerHTML = '';
  });
  root.querySelectorAll('script, style').forEach((el) => {
    el.textContent = '';
  });
  const scrolled: string[] = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el.scrollLeft > 0 || el.scrollTop > 0) {
      const cls = typeof el.className === 'string' ? el.className.slice(0, 80) : '';
      scrolled.push(`${el.tagName}.${cls} left=${String(el.scrollLeft)} top=${String(el.scrollTop)}`);
    }
  });
  const page = document.scrollingElement ?? document.documentElement;
  const head =
    `<!-- ${location.href} | viewport ${String(innerWidth)}x${String(innerHeight)} | ` +
    `page scroll ${String(page.scrollLeft)},${String(page.scrollTop)} | ` +
    `active ${document.activeElement?.tagName ?? '-'} -->\n` +
    `<!-- scrolled: ${scrolled.slice(0, 20).join(' ; ').replace(/--/g, '- -')} -->\n`;
  const html = root.outerHTML;
  return head + (html.length > max ? `${html.slice(0, max)}\n<!-- truncated -->` : html);
}

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
  async beforeSession(): Promise<void> {
    const env = loadEnv();

    // Attach self-heal (the ONLY per-file app work this mode does). Before each spec
    // file, make sure a healthy app parked on /home is attachable: a no-op when the
    // previous file left it there — keeping the open-once speed — and a relaunch only
    // when a spec wedged or crashed it, which is what stops the cascade that otherwise
    // turns one bad file into an all-red run. Also starts the app on the FIRST file if
    // nobody ran `app:launch`.
    if (env.MODE === 'attach') {
      await ensureHealthyAttachedApp();
      for (const dir of [Paths.SCREENSHOTS, Paths.APP_LOGS, Paths.FAILURE_DOM, Paths.ALLURE_RESULTS]) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return;
    }

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

    for (const dir of [Paths.SCREENSHOTS, Paths.APP_LOGS, Paths.FAILURE_DOM, Paths.ALLURE_RESULTS]) {
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
  async afterTest(test: Frameworks.Test, context: unknown, result: Frameworks.TestResult): Promise<void> {
    // A `this.skip()` also arrives here as `passed: false` — but with no error.
    // Capturing for it cost a screenshot + DOM + app log per skip, for nothing.
    if (result.passed || !result.error) return;
    const files = await this.captureFailure(test.parent ?? '', test.title);
    writeEvidence(
      { file: test.file || this.currentFile, title: test.title, fullTitle: fullTitleOf(test, context) },
      files,
    );
  }

  /** Spec file of the running suite — a hook's own object does not say. */
  private currentFile = '';

  beforeSuite(suite: Frameworks.Suite): void {
    if (suite.file) this.currentFile = suite.file;
  }

  beforeTest(): void {
    resetEvidence();
  }

  /** Replay frames are taken here — see src/support/evidence.ts for the cost cap. */
  async afterCommand(commandName: string): Promise<void> {
    await afterActionCommand(commandName);
  }

  /**
   * A failed `before all` / `after all` hook takes its whole suite down without
   * a single `it` failing, so {@link afterTest} never sees it. Same evidence.
   */
  async afterHook(
    test: Frameworks.Test,
    _context: unknown,
    result: Frameworks.TestResult & { error?: Error },
  ): Promise<void> {
    if (result.passed !== false && !result.error) return;
    const title = test.title || 'hook';
    const files = await this.captureFailure(test.parent ?? '', title);
    writeEvidence({ file: test.file || this.currentFile, title, fullTitle: title, hook: true }, files);
  }

  /** Screenshot, URL, DOM and app log at the moment of failure — on disk and in Allure. */
  private async captureFailure(parent: string, title: string): Promise<FailureFiles> {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `${slug(parent)}__${slug(title)}__${stamp}`;
    const out: FailureFiles = {};

    try {
      const shotPath = path.join(Paths.SCREENSHOTS, `${base}.png`);
      await withinMs(browser.saveScreenshot(shotPath), 15_000);
      out.shotPath = shotPath;
      await allure.addAttachment('Screenshot', fs.readFileSync(shotPath), 'image/png');
      log.info(`Screenshot: ${shotPath}`);
    } catch (error) {
      log.warn(`Could not capture a screenshot: ${(error as Error).message}`);
    }

    try {
      const url = await withinMs(browser.getUrl(), 5_000);
      out.url = url;
      await allure.addAttachment('URL at failure', url, 'text/plain');
    } catch {
      /* the session may already be gone */
    }

    // A screenshot shows that a control is missing, not why: the DOM says which
    // locator candidate drifted, what a dialog really contains, which container
    // scrolled. Without it, a recurring failure could only be read on a live app
    // that the running suite was busy driving.
    try {
      const domPath = path.join(Paths.FAILURE_DOM, `${base}.html`);
      fs.writeFileSync(
        domPath,
        await withinMs(browser.execute(domSnapshot, DOM_SNAPSHOT_MAX_CHARS), 10_000),
        'utf8',
      );
      out.domPath = domPath;
      log.info(`DOM: ${domPath}`);
    } catch (error) {
      log.debug(`No DOM snapshot: ${(error as Error).message}`);
    }

    try {
      const logs = collectAppLogs({ identifier: loadEnv().APP_IDENTIFIER, tailLines: 400 });
      if (logs) {
        const logPath = path.join(Paths.APP_LOGS, `${base}.log`);
        fs.writeFileSync(logPath, logs, 'utf8');
        out.logPath = logPath;
        await allure.addAttachment('App log (tail)', logs, 'text/plain');
      }
    } catch (error) {
      log.debug(`No app log collected: ${(error as Error).message}`);
    }
    return out;
  }

  /**
   * Synchronous for the same reason as {@link beforeSession}: stopping the
   * updater watcher clears an interval, and the shutdown itself belongs to
   * {@link afterSession}, which runs after the driver is gone.
   */
  after(): void {
    const env = loadEnv();
    stopUpdaterWatcher();
    log.info(`Failure replay: ${replayCost()}`);

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
