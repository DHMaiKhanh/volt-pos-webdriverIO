/**
 * VP-1873 — Reload App from the left sidebar.
 *
 * Source: volt-qc `VP-1873-reload-app-test-cases.md` (TC 1–12).
 *
 * The action re-initialises the WebView document in place: the WebDriver session
 * survives, every element handle goes stale, and the router lands on /home
 * (verified live 2026-10-17, build 1.1.40; the sheet's own note says the same).
 *
 * Pending, by nature of the lane:
 *   - TC-07 "latest backend data" needs a second writer (web lane / API) changing
 *     data between the reload and the read;
 *   - TC-08 device isolation needs a second till;
 *   - TC-10 offline reload needs the network to be cut (see network-disconnect.spec.ts
 *     for the harness that exists today).
 *
 * TC-11 opens a draft (staff only) before reloading and voids it afterwards.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { appNav } from '../../../src/components/index.js';
import { Routes } from '../../../src/constants/routes.js';
import { goToOrderHistory, returnToHome } from '../../../src/flows/index.js';
import { dismissUpdaterIfPresent } from '../../../src/helpers/updater.js';
import { waitUntilPath } from '../../../src/helpers/wait.js';
import { homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** Wait for the reloaded app to settle back on a usable /home. */
async function awaitReloadedHome(): Promise<void> {
  await waitUntilPath((p) => p.startsWith(Routes.HOME), {
    timeout: Timeouts.APP_BOOT,
    message: 'Reload did not land on /home',
  });
  await dismissUpdaterIfPresent();
  await homePage.waitForReady(Timeouts.APP_BOOT);
}

describe('VP-1873 — Reload App', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    if (await appNav.isSidebarOpen()) await appNav.closeSidebar();
  });

  after(async () => {
    await returnToHome();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
  });

  it(title('TC-01 The sidebar offers a Reload action', Tag.REGRESSION), async () => {
    expect(await appNav.isReloadShown()).toBe(true);
  });

  // One reload feeds both cases: the probe records what it saw during the reload.
  let reloadProbe: { sawConfirm: boolean; sawLoader: boolean } | null = null;

  it(
    title('TC-02 Reload runs immediately — no confirm popup', Tag.REGRESSION, Tag.SLOW),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      reloadProbe = await appNav.pressReload();
      await awaitReloadedHome();

      expect(reloadProbe.sawConfirm).toBe(false);
    },
  );

  it(
    title('TC-03 Reload shows the "Reloading ..." loading message', Tag.REGRESSION, Tag.SLOW),
    function (this: Mocha.Context) {
      if (reloadProbe === null) this.skip();
      // CDP trace on 1.1.40 (2026-10-17): both windows go blank for ~1.5 s and
      // repaint — no "Reloading ..." text in either. A failure here is that gap
      // against the VP-1873 acceptance criterion, not a timing miss.
      expect(reloadProbe?.sawLoader).toBe(true);
    },
  );

  it(
    title(
      'TC-04/05/06 After reload the app re-inits on Home with staff and services loaded',
      Tag.REGRESSION,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await appNav.pressReload();
      await awaitReloadedHome();

      expect(await homePage.currentPath()).toMatch(/^\/home/);
      expect(await homePage.visibleStaffCount()).toBeGreaterThan(0);
      expect(await homePage.visibleServiceCount()).toBeGreaterThan(0);
    },
  );

  it(title('TC-07: reload pulls the latest backend data — PENDING (needs a second writer)'));

  it(title('TC-08: only the current device reloads — PENDING (needs a second till)'));

  it(
    title('TC-09 Reload from Order History still lands on Home', Tag.REGRESSION, Tag.SLOW),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await goToOrderHistory();
      await appNav.pressReload();
      await awaitReloadedHome();

      expect(await homePage.currentPath()).toMatch(/^\/home/);
    },
  );

  it(title('TC-10: reload while offline — PENDING (needs the network cut)'));

  it(
    title('TC-11 Reload with an open draft is safe and lands on Home', Tag.REGRESSION, Tag.WRITE, Tag.SLOW),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await returnToHome();
      if (!(await homePage.hasActiveDraft())) await homePage.selectFirstStaff();

      await appNav.pressReload();
      await awaitReloadedHome();

      expect(await homePage.currentPath()).toMatch(/^\/home/);
      expect(await homePage.visibleStaffCount()).toBeGreaterThan(0);
    },
  );

  it(
    title('TC-12 Reloading several times in a row stays stable', Tag.REGRESSION, Tag.SLOW),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      for (let i = 0; i < 3; i += 1) {
        await appNav.pressReload();
        await awaitReloadedHome();
      }
      expect(await homePage.currentPath()).toMatch(/^\/home/);
      expect(await homePage.visibleServiceCount()).toBeGreaterThan(0);
    },
  );
});
