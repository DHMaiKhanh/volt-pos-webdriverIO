/**
 * VP-1873 — Reload App: TC-05 and TC-06 (volt-qc per-ticket file
 * `docs/qc/volt-qc/vp-tickets/VP-1873-reload-app-test-cases.md`).
 *
 * The main spec (tests/regression/app/vp-1873-reload-app.spec.ts) asserts these
 * under the composite title `TC-04/05/06`, which the coverage matcher cannot see.
 * Here each row is its own case:
 *   - TC-05 the app re-initialises — the WebView document is new (a marker set
 *     on `window` before the reload is gone after it) and Home is ready;
 *   - TC-06 services reconnect — the router is published again, staff and
 *     services load, and the report API answers.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { ReportService } from '../../../../src/api/index.js';
import { appNav } from '../../../../src/components/index.js';
import { Routes } from '../../../../src/constants/routes.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { routerReady } from '../../../../src/helpers/navigate.js';
import { dismissUpdaterIfPresent } from '../../../../src/helpers/updater.js';
import { waitUntilPath } from '../../../../src/helpers/wait.js';
import { homePage } from '../../../../src/pages/index.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const MARKER = '__vp1873ReloadMarker';

async function reloadAndAwaitHome(): Promise<void> {
  await appNav.pressReload();
  await waitUntilPath((p) => p.startsWith(Routes.HOME), {
    timeout: Timeouts.APP_BOOT,
    message: 'Reload did not land on /home',
  });
  await dismissUpdaterIfPresent();
  await homePage.waitForReady(Timeouts.APP_BOOT);
}

describe('VP-1873 — Reload App (TC-05, TC-06)', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    if (await appNav.isSidebarOpen()) await appNav.closeSidebar();
  });

  it(
    title(
      'VP-1873 TC-05 Reload re-initialises the app state (fresh document) and lands on Home',
      Tag.REGRESSION,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await browser.execute((key: string) => {
        (window as unknown as Record<string, unknown>)[key] = true;
      }, MARKER);

      await reloadAndAwaitHome();

      const survived = await browser.execute(
        (key: string) => (window as unknown as Record<string, unknown>)[key] === true,
        MARKER,
      );
      expect(survived).toBe(false);
      expect(await homePage.currentPath()).toMatch(/^\/home/);
    },
  );

  it(
    title(
      'VP-1873 TC-06 After reload the services reconnect: router, staff, services and API',
      Tag.REGRESSION,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await reloadAndAwaitHome();

      expect(await routerReady()).toBe(true);
      expect(await homePage.visibleStaffCount()).toBeGreaterThan(0);
      expect(await homePage.visibleServiceCount()).toBeGreaterThan(0);
      // The backend answers after the reload (null = no row today, still an answer).
      const day = await new ReportService().storeDay(new Date());
      expect(day === null || typeof day === 'object').toBe(true);
    },
  );
});
