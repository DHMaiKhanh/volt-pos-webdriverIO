/**
 * VP-2691 — the auto-update popup is gone; menu ≡ → Version Update is a page
 * that shows the update and starts it (POS part VP-2787, bug VP-5102: the
 * "Update failed" toast pushed its Update Now button off screen).
 *
 * TC doc: docs/qc/volt-qc/vp-tickets/VP-2691-version-update-page-test-cases.md
 * (TC-VP2691-01..19 — VU-01..13 of the QC run, BUG-01..04 of VP-5102).
 *
 * ## A fake updater, never a real update
 *
 * The dev feed has no build newer than the installed one, so every "update
 * available" case runs against the fetch-level updater mock in
 * `vp-2691-version-update.helpers.ts`: the check offers `<current + 1 patch>`
 * (or nothing, or a network error) and download / install are ALWAYS refused.
 * Nothing is downloaded or installed, whatever a case presses. `after()` reloads
 * the app, which drops the mock and the app's updater store with it.
 *
 * The rootHooks updater watcher is stopped for this file — it would close the
 * very toasts these cases assert on — and restarted in `after()`.
 *
 * Pending: TC-18 (a real install restarts the app and ends the session) and
 * TC-19 (needs a Portal Deprecate; the forced-update screen installs on mount).
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { appNav } from '../../../src/components/index.js';
import { Routes } from '../../../src/constants/routes.js';
import { VersionUpdateText } from '../../../src/constants/testids.version-update.js';
import { goToOrderHistory, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import {
  dismissUpdaterIfPresent,
  startUpdaterWatcher,
  stopUpdaterWatcher,
} from '../../../src/helpers/updater.js';
import { waitUntilPath } from '../../../src/helpers/wait.js';
import { homePage } from '../../../src/pages/index.js';
import { appShellProbe } from '../../../src/pages/voltqc/app-perm/AppShellProbe.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  anyModalOpen,
  answerConfirm,
  closeVersionUpdatePage,
  confirmTitle,
  installUpdaterMock,
  isSoftwareUpdatingShown,
  nextPatch,
  openVersionUpdatePage,
  pressPageUpdateNow,
  pressRefresh,
  pressToast,
  probeUpdaterToast,
  readVersionPage,
  refreshAndSettle,
  removeUpdaterMock,
  setUpdaterMock,
  sidebarVersionEntry,
  toastTexts,
  updaterMockCalls,
  updaterPopupTexts,
  waitForConfirm,
  waitForPageStatus,
  waitForToast,
  waitToastGone,
  type ToastProbe,
  type UpdaterMockConfig,
  type VersionPage,
} from './vp-2691-version-update.helpers.js';

/** Release notes of the fake build — two lines, the page keeps line breaks (`whitespace-pre-line`). */
const NOTES = 'E2E VP-2691 release notes\n- fake build, never installed';
const NOTES_FIRST_LINE = 'E2E VP-2691 release notes';

/** Resolves true if `probe` turns true within `ms`, false otherwise (absence checks). */
async function becomesTrue(probe: () => Promise<boolean>, ms: number): Promise<boolean> {
  return browser.waitUntil(probe, { timeout: ms, interval: 200 }).then(
    () => true,
    () => false,
  );
}

describe('VP-2691 — Version Update page replaces the auto-update popup', () => {
  /** The installed build (sidebar About) and the fake one offered by the mock. */
  let currentVersion = '';
  let mock: UpdaterMockConfig;

  /** Wait for the reloaded app to settle back on a usable /home. */
  async function awaitReloadedHome(): Promise<void> {
    await waitUntilPath((p) => p.startsWith(Routes.HOME), {
      timeout: Timeouts.APP_BOOT,
      message: 'Reload did not land on /home',
    });
    await homePage.waitForReady(Timeouts.APP_BOOT);
  }

  /** Leave no confirm, updater toast, Version Update dialog or sidebar on screen. */
  async function clearUpdaterSurfaces(): Promise<void> {
    if ((await confirmTitle()) !== '') await answerConfirm('cancel').catch(() => undefined);
    for (const which of ['failed', 'available'] as const) {
      if ((await probeUpdaterToast(which)).present) {
        await pressToast(which, 'close').catch(() => undefined);
      }
    }
    await closeVersionUpdatePage().catch(() => undefined);
    if (await appNav.isSidebarOpen()) await appNav.closeSidebar();
  }

  /** Mock installed, Version Update open, the fake build on offer (cleared first so the toast effect fires). */
  async function pageWithOffer(): Promise<VersionPage> {
    await installUpdaterMock({ ...mock, mode: 'none' });
    await openVersionUpdatePage();
    await refreshAndSettle();
    await setUpdaterMock({ mode: 'offer' });
    await refreshAndSettle();
    return waitForPageStatus('available');
  }

  /** {@link pageWithOffer} → Update Now → confirm → refused download → "Update failed" toast. */
  async function failOnce(): Promise<{ sawOverlay: boolean; toast: ToastProbe; downloads: number }> {
    await pageWithOffer();
    // The offer toast is dismissed by startSoftwareUpdate itself; close it now so the
    // failed toast is the only updater toast on screen.
    if ((await probeUpdaterToast('available')).present) await pressToast('available', 'close');
    const before = (await updaterMockCalls()).download;
    await pressPageUpdateNow();
    await waitForConfirm();
    await answerConfirm('confirm');
    const sawOverlay = await becomesTrue(isSoftwareUpdatingShown, Timeouts.SHORT);
    const toast = await waitForToast('failed', Timeouts.LONG);
    const downloads = (await updaterMockCalls()).download - before;
    return { sawOverlay, toast, downloads };
  }

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    stopUpdaterWatcher();
    await returnToHome();
    await dismissUpdaterIfPresent();
    await appNav.openSidebar();
    currentVersion = (await appShellProbe.readAbout()).version;
    await appNav.closeSidebar();
    if (!/^\d+\.\d+\.\d+/.test(currentVersion))
      throw new Error(`Could not read the app version ("${currentVersion}").`);
    mock = {
      mode: 'none',
      currentVersion,
      version: nextPatch(currentVersion),
      description: NOTES,
      checkDelayMs: 300,
      downloadDelayMs: 1_500,
    };
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await clearUpdaterSurfaces();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    try {
      await clearUpdaterSurfaces().catch(() => undefined);
      await removeUpdaterMock().catch(() => undefined);
      // A reload drops whatever the mock told the app's updater store.
      await returnToHome();
      await appNav.pressReload();
      await awaitReloadedHome();
      await dismissUpdaterIfPresent();
    } finally {
      startUpdaterWatcher();
    }
  });

  /* ------------------------------------------------------------------ *
   * 1. Version Update page — real server
   * ------------------------------------------------------------------ */

  it(
    title('TC-VP2691-01: the sidebar has a Version Update entry and About shows the version', Tag.REGRESSION),
    async () => {
      await appNav.openSidebar();
      expect((await sidebarVersionEntry()).found).toBe(true);
      expect((await appShellProbe.readAbout()).version).toBe(currentVersion);
    },
  );

  it(
    title(
      'TC-VP2691-02: on the newest build the page says "You\'re Up to Date" with no Update Now',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await removeUpdaterMock();
      await openVersionUpdatePage();
      const page = await refreshAndSettle();
      // Precondition: the dev feed has nothing newer. If it does, this case does not apply.
      if (page.status === 'available') this.skip();
      expect(page.status).toBe('upToDate');
      expect(page.text).toContain(VersionUpdateText.upToDateDescription[0]);
      expect(page.current).toBe(currentVersion);
      expect(page.latest).toBe('');
      expect(page.hasUpdateNow).toBe(false);
    },
  );

  it(
    title('TC-VP2691-03: refresh shows "Checking for Updates", then back to Up to Date', Tag.REGRESSION),
    async () => {
      await installUpdaterMock({ ...mock, mode: 'none', checkDelayMs: 2_000 });
      try {
        await openVersionUpdatePage();
        await browser.waitUntil(async () => (await readVersionPage()).refreshEnabled, {
          timeout: Timeouts.MEDIUM,
          interval: 150,
          timeoutMsg: 'The check on open never finished',
        });
        expect(await pressRefresh()).toBe(true);

        const checking = await waitForPageStatus('checking', Timeouts.SHORT);
        expect(checking.refreshEnabled).toBe(false);

        const done = await waitForPageStatus('upToDate', Timeouts.MEDIUM);
        expect(done.current).toBe(currentVersion);
        await browser.waitUntil(async () => (await readVersionPage()).refreshEnabled, {
          timeout: Timeouts.SHORT,
          interval: 150,
          timeoutMsg: 'Refresh did not re-enable after the check',
        });
      } finally {
        await setUpdaterMock({ checkDelayMs: mock.checkDelayMs }).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'TC-VP2691-04: no auto-update popup after a reload or while moving between screens',
      Tag.REGRESSION,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await removeUpdaterMock();
      await returnToHome();

      await step('Reload the app', async () => {
        await appNav.pressReload();
        await awaitReloadedHome();
      });
      expect(await becomesTrue(async () => (await updaterPopupTexts()).length > 0, 5_000)).toBe(false);

      await step('Order History, then back Home', async () => {
        await goToOrderHistory();
        expect(await becomesTrue(async () => (await updaterPopupTexts()).length > 0, 3_000)).toBe(false);
        await returnToHome();
        expect(await becomesTrue(async () => (await updaterPopupTexts()).length > 0, 3_000)).toBe(false);
      });
    },
  );

  /* ------------------------------------------------------------------ *
   * 2. Update available (fake) — notice & information page
   * ------------------------------------------------------------------ */

  it(
    title(
      'TC-VP2691-05: a new build only raises a toast; the POS stays usable and X keeps it closed',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await pageWithOffer();
      await closeVersionUpdatePage();

      const toast = await waitForToast('available');
      expect(toast.hasClose).toBe(true);
      expect(await anyModalOpen()).toBe(false);

      await step('Screens still change with the toast up', async () => {
        await goToOrderHistory();
        expect((await probeUpdaterToast('available')).present).toBe(true);
        expect(await anyModalOpen()).toBe(false);
        await returnToHome();
      });

      await step('X closes it for good', async () => {
        await pressToast('available', 'close');
        await waitToastGone('available');
        await goToOrderHistory();
        await returnToHome();
        expect(await becomesTrue(async () => (await probeUpdaterToast('available')).present, 3_000)).toBe(
          false,
        );
      });
    },
  );

  it(
    title(
      'TC-VP2691-06: the page shows current / latest version, release notes and Update Now',
      Tag.REGRESSION,
    ),
    async () => {
      const page = await pageWithOffer();
      expect(page.status).toBe('available');
      expect(page.current).toBe(currentVersion);
      expect(page.latest).toBe(mock.version);
      expect(page.description).toContain(NOTES_FIRST_LINE);
      expect(page.hasUpdateNow).toBe(true);
      expect(page.text).toContain(`Version ${mock.version} is ready to install`);
    },
  );

  it(
    title('TC-VP2691-07: Update Now opens "Update to version X?"; Cancel downloads nothing', Tag.REGRESSION),
    async () => {
      await pageWithOffer();
      const before = await updaterMockCalls();

      await pressPageUpdateNow();
      expect(await waitForConfirm()).toContain(mock.version);
      await answerConfirm('cancel');

      expect(await becomesTrue(isSoftwareUpdatingShown, 1_500)).toBe(false);
      expect((await updaterMockCalls()).download).toBe(before.download);
      expect((await readVersionPage()).status).toBe('available');
    },
  );

  it(
    title(
      'TC-VP2691-09: a build withdrawn before install says "No update is currently available."',
      Tag.REGRESSION,
    ),
    async () => {
      await pageWithOffer();
      await setUpdaterMock({ mode: 'none' });
      const before = await updaterMockCalls();

      await pressPageUpdateNow();
      await waitForConfirm();
      await answerConfirm('confirm');

      await browser.waitUntil(
        async () =>
          (await toastTexts()).some((t) => VersionUpdateText.noUpdateAvailable.some((m) => t.includes(m))),
        {
          timeout: Timeouts.MEDIUM,
          interval: 150,
          timeoutMsg: 'No "No update is currently available." toast',
        },
      );
      const page = await waitForPageStatus('upToDate');
      expect(page.hasUpdateNow).toBe(false);
      expect((await updaterMockCalls()).download).toBe(before.download);
    },
  );

  it(title('TC-VP2691-10: X closes the page and drops ?dialog=version-update', Tag.REGRESSION), async () => {
    await installUpdaterMock({ ...mock, mode: 'none' });
    await returnToHome();
    const pathBefore = new URL(await browser.getUrl()).pathname;

    await openVersionUpdatePage();
    expect(await browser.getUrl()).toContain('dialog=version-update');

    await closeVersionUpdatePage();
    const after = new URL(await browser.getUrl());
    expect(after.search).not.toContain('version-update');
    expect(after.pathname).toBe(pathBefore);
  });

  it(
    title('TC-VP2691-11: a failed check says "Couldn\'t Check for Updates", not Up to Date', Tag.REGRESSION),
    async () => {
      await installUpdaterMock({ ...mock, mode: 'none' });
      await openVersionUpdatePage();
      await refreshAndSettle(); // no offer left in the app

      await setUpdaterMock({ mode: 'offline' });
      await refreshAndSettle();
      const page = await waitForPageStatus('failed');
      expect(page.text).toContain(VersionUpdateText.checkFailedDescription[0]);
      expect(page.text).not.toContain(VersionUpdateText.upToDate[0]);
      expect(page.hasUpdateNow).toBe(false);
    },
  );

  it(
    title(
      'TC-VP2691-12: the sidebar entry carries a warning mark only while a build is on offer',
      Tag.REGRESSION,
    ),
    async () => {
      await installUpdaterMock({ ...mock, mode: 'none' });
      await openVersionUpdatePage();
      await refreshAndSettle();
      await closeVersionUpdatePage();

      await appNav.openSidebar(); // opening the drawer re-probes
      expect(await becomesTrue(async () => (await sidebarVersionEntry()).alert, 2_000)).toBe(false);
      await appNav.closeSidebar();

      await setUpdaterMock({ mode: 'offer' });
      await appNav.openSidebar();
      expect(await becomesTrue(async () => (await sidebarVersionEntry()).alert, Timeouts.MEDIUM)).toBe(true);
    },
  );

  /* ------------------------------------------------------------------ *
   * 3. Update Now → failed download → "Update failed" toast (VP-5102)
   * ------------------------------------------------------------------ */

  it(
    title(
      'TC-VP2691-08: a failed download shows Software Updating, then the "Update failed" toast',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const { sawOverlay, toast, downloads } = await failOnce();

      expect(sawOverlay).toBe(true);
      expect(downloads).toBeGreaterThanOrEqual(1);
      expect(toast.heading).toBe(VersionUpdateText.updateFailed[0]);
      expect(toast.buttons.map((b) => b.label).sort()).toEqual(
        [VersionUpdateText.updateLater[0], VersionUpdateText.updateNow[0]].sort(),
      );
      expect(toast.hasClose).toBe(true);
      expect(await isSoftwareUpdatingShown()).toBe(false);
    },
  );

  it(
    title(
      'TC-VP2691-13: on the failed toast Update Now retries, Update Later and X keep the offer',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await failOnce();

      await step('Update Now retries the download', async () => {
        const before = (await updaterMockCalls()).download;
        await pressToast('failed', 'updateNow');
        await browser.waitUntil(async () => (await updaterMockCalls()).download > before, {
          timeout: Timeouts.MEDIUM,
          interval: 150,
          timeoutMsg: 'Update Now on the toast did not download again',
        });
        await waitForToast('failed', Timeouts.LONG);
      });

      for (const control of ['updateLater', 'close'] as const) {
        await step(
          `${control === 'close' ? 'X' : 'Update Later'} closes the toast, the offer stays`,
          async () => {
            if (!(await probeUpdaterToast('failed')).present) {
              await pressPageUpdateNow();
              await waitForConfirm();
              await answerConfirm('confirm');
              await waitForToast('failed', Timeouts.LONG);
            }
            await pressToast('failed', control);
            await waitToastGone('failed');
            await openVersionUpdatePage();
            const page = await waitForPageStatus('available');
            expect(page.latest).toBe(mock.version);
            expect(page.hasUpdateNow).toBe(true);
          },
        );
      }
    },
  );

  it(
    title(
      'TC-VP2691-14: VP-5102 BUG-01 — the failed toast fits: both buttons inside it and on screen, ≥16px',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await failOnce();
      // The Version Update dialog is modal (pointer-events off outside it); close it so the
      // hit test below measures the toast, not the modal layer.
      await closeVersionUpdatePage();
      const toast = await waitForToast('failed');
      const rect = toast.rect;
      if (!rect) throw new Error('The failed toast has no box');

      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(toast.viewport.width);
      expect(toast.buttons).toHaveLength(2);
      for (const button of toast.buttons) {
        const where = `${button.label} [${Math.round(button.rect.left)}–${Math.round(button.rect.right)}] in toast [${Math.round(rect.left)}–${Math.round(rect.right)}], viewport ${toast.viewport.width}`;
        expect({ where, inToast: button.inToast }).toEqual({ where, inToast: true });
        expect({ where, inViewport: button.inViewport }).toEqual({ where, inViewport: true });
        expect({ where, onTop: button.onTop }).toEqual({ where, onTop: true });
        expect(button.rect.width).toBeGreaterThan(0);
        expect(button.fontSizePx).toBeGreaterThanOrEqual(16);
      }
    },
  );

  it(
    title(
      'TC-VP2691-15: VP-5102 BUG-02 — Update Now on the toast runs Software Updating again',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await failOnce();
      const before = (await updaterMockCalls()).download;

      await pressToast('failed', 'updateNow');
      const sawOverlay = await becomesTrue(isSoftwareUpdatingShown, Timeouts.SHORT);
      await waitForToast('failed', Timeouts.LONG);

      expect(sawOverlay).toBe(true);
      expect((await updaterMockCalls()).download).toBeGreaterThan(before);
    },
  );

  it(
    title(
      'TC-VP2691-16: VP-5102 BUG-03 — Update Later closes the toast; the page keeps the offer',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await failOnce();
      await pressToast('failed', 'updateLater');
      await waitToastGone('failed');

      await openVersionUpdatePage();
      const page = await waitForPageStatus('available');
      expect(page.latest).toBe(mock.version);
      expect(page.hasUpdateNow).toBe(true);
    },
  );

  it(
    title('TC-VP2691-17: VP-5102 BUG-04 — X closes the toast like Update Later', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await failOnce();
      await pressToast('failed', 'close');
      await waitToastGone('failed');

      await openVersionUpdatePage();
      const page = await waitForPageStatus('available');
      expect(page.latest).toBe(mock.version);
      expect(page.hasUpdateNow).toBe(true);
    },
  );

  /* ------------------------------------------------------------------ *
   * 4. Out of reach for this lane
   * ------------------------------------------------------------------ */

  it(
    title(
      'TC-VP2691-18: a real update downloads, installs and relaunches on the new version — PENDING ' +
        '(a real install restarts the app and ends the WebDriver session; dev has no newer build; manual)',
    ),
  );

  it(
    title(
      'TC-VP2691-19: a Deprecated build still goes to /force-update — PENDING ' +
        '(needs a Portal Deprecate, and the force-update screen installs on mount; manual)',
    ),
  );
});
