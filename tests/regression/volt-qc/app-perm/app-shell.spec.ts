/**
 * volt-qc module 01-app (APP-*) — app shell: root/404 routing, header, sidebar,
 * About block, Version Update, shortcuts, notifications. READ-ONLY.
 *
 * Ported from volt-qc `e2e/tests/01-app/{navigation,app-plan,app-deep}.spec.ts`
 * (`@readonly` cases only). TC definitions:
 * docs/qc/volt-qc/windows-regression/01-khoi-dong-dang-nhap-dieu-huong.md.
 *
 * Creates no order, presses no Save, changes no setting. The cases that need a
 * passcode guard drop the run's 30-minute grant first and {@link recoverShell}
 * re-arms it after every case. A case whose precondition is merchant state
 * (gate switched off, no clocked-in staff for the TURN tab, a pending update)
 * skips with the reason rather than failing.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { appNav, turnBoardDialog } from '../../../../src/components/index.js';
import { timeKeepingDialog } from '../../../../src/components/modal/TimeKeepingDialog.js';
import { Routes } from '../../../../src/constants/routes.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle, waitUntilPath } from '../../../../src/helpers/wait.js';
import { homePage } from '../../../../src/pages/index.js';
import { appShellProbe } from '../../../../src/pages/voltqc/app-perm/AppShellProbe.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { log, ownerCode, recoverShell, visit } from './app-perm.helpers.js';

const onPath = (path: string): Promise<string> =>
  waitUntilPath((p) => p === path || p.startsWith(`${path}/`), {
    timeout: Timeouts.NAVIGATION,
    message: `never reached ${path}`,
  });

/** Back on Pending Orders with its filter bar rendered — where a cancelled gate lands. */
async function expectPendingOrders(): Promise<void> {
  await onPath(Routes.ORDER_PENDING);
  expect(await appShellProbe.mainButtonShown('Quick Checkout')).toBe(true);
}

describe('volt-qc APP — app shell, header & sidebar (read-only)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await returnToHome();
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await recoverShell();
  });

  /* ------------------------------------------------------------------ *
   * Routing
   * ------------------------------------------------------------------ */

  it(
    title(
      'The root path "/" lands on Pending Orders; an unknown route shows 404 with a link back (APP-053, APP-054)',
      Tag.REGRESSION,
    ),
    async () => {
      await step('"/" redirects to /order-pending', async () => {
        await gateProbe.routerNavigate('/');
        await expectPendingOrders();
      });

      await step('An unknown route renders the 404 page', async () => {
        await gateProbe.routerNavigate('/abc-khong-ton-tai');
        expect(await appShellProbe.notFoundShown()).toEqual({ code: true, title: true, message: true });
      });

      await step('"← Back to Home" returns to Pending Orders', async () => {
        await appShellProbe.clickNotFoundBack();
        await expectPendingOrders();
      });
    },
  );

  /* ------------------------------------------------------------------ *
   * Header
   * ------------------------------------------------------------------ */

  it(
    title(
      'The header carries its items left to right; logo → /home, Pending Orders → /order-pending (APP-055, APP-056)',
      Tag.REGRESSION,
    ),
    async () => {
      await gateProbe.routerNavigate(Routes.ORDER_PENDING);
      await onPath(Routes.ORDER_PENDING);

      const items = await appShellProbe.headerLeftItems();
      for (const item of items)
        expect({ item: item.name, visible: item.visible }).toEqual({ item: item.name, visible: true });
      const xs = items.map((i) => i.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      // Devices, Time keeping, Notifications (+ an update icon when one is pending).
      expect(await appShellProbe.headerRightButtonCount()).toBeGreaterThanOrEqual(3);
      expect(await appShellProbe.pendingListRendered()).toBe(true);

      await step('Logo → /home (the till)', async () => {
        await appShellProbe.clickLogo();
        await onPath(Routes.HOME);
        await homePage.waitForReady(Timeouts.MEDIUM);
      });

      await step('Pending Orders → /order-pending, no error toast', async () => {
        await appShellProbe.clickPendingOrders();
        await onPath(Routes.ORDER_PENDING);
        expect(await appShellProbe.bodyHasText("Couldn't open pending orders. Please try again.")).toBe(
          false,
        );
      });
    },
  );

  it(
    title(
      'The header Order History link raises the passcode gate and Escape cancels back to Pending Orders (APP-057)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await gateProbe.clearSkip();
      await appShellProbe.clickHeaderOrderHistory();
      if (!(await gateProbe.waitOpen(4_000))) this.skip(); // Order History gate is OFF in Passcode Setting

      expect((await gateProbe.state())?.heading).toBe('Enter staff code to access Order History');
      await gateProbe.pressEscape();
      expect(await gateProbe.waitClosed()).toBe(true);
      await onPath(Routes.ORDER_PENDING);
      expect(await gateProbe.mainHeadingShown('Order History')).toBe(false);
    },
  );

  it(
    title(
      "The header Appointment link opens today's board: date = start of today, Appointment Overview (APP-058)",
      Tag.REGRESSION,
    ),
    async () => {
      await appShellProbe.clearAppointmentDateFilter();
      const today = await appShellProbe.startOfTodayUnix();
      expect(await appShellProbe.headerAppointmentHref()).toMatch(
        new RegExp(`^/appointment\\?date=${String(today)}`),
      );

      await appShellProbe.clickHeaderAppointment();
      await onPath(Routes.APPOINTMENT);
      expect(Number(await gateProbe.searchParam('date'))).toBe(today);
      expect(await gateProbe.waitMainText(/Appointment Overview/)).toBe(true);
    },
  );

  it(
    title(
      'The header clock opens Time Keeping in place; Escape closes dialogs, popovers and the gate (APP-059, APP-114)',
      Tag.REGRESSION,
    ),
    async () => {
      await gateProbe.routerNavigate(Routes.ORDER_PENDING);
      await onPath(Routes.ORDER_PENDING);

      await step(
        'Clock icon → Time Keeping, ?dialog=time-keeping, path kept; X clears the param',
        async () => {
          await appShellProbe.clickTimeKeepingIcon();
          expect(await timeKeepingDialog.isOpen(Timeouts.MEDIUM)).toBe(true);
          expect(await gateProbe.path()).toBe(Routes.ORDER_PENDING);
          expect(await timeKeepingDialog.currentDialogParam()).toBe('time-keeping');
          await timeKeepingDialog.close();
          await browser.waitUntil(async () => (await timeKeepingDialog.currentDialogParam()) === null, {
            timeout: Timeouts.SHORT,
            timeoutMsg: 'dialog=time-keeping stayed in the URL after closing',
          });
          expect(await gateProbe.path()).toBe(Routes.ORDER_PENDING);
        },
      );

      await step('Escape closes Time Keeping', async () => {
        await appShellProbe.clickTimeKeepingIcon();
        expect(await timeKeepingDialog.isOpen(Timeouts.MEDIUM)).toBe(true);
        await timeKeepingDialog.closeWithEscape();
        expect(await timeKeepingDialog.isOpen(Timeouts.ANIMATION)).toBe(false);
      });

      await step('Escape closes the Notifications popover', async () => {
        await appShellProbe.clickBell();
        expect(await appShellProbe.waitPopover('Notifications')).not.toBeNull();
        await gateProbe.pressEscape();
        expect(await appShellProbe.waitPopoverGone('Notifications')).toBe(true);
      });

      await step('Escape at the Order History gate cancels back to /order-pending', async () => {
        if (!(await gateProbe.openGate(Routes.ORDER_HISTORY))) {
          log.info('APP-114: Order History gate is OFF — the gate step has nothing to cancel');
          return;
        }
        await gateProbe.pressEscape();
        expect(await gateProbe.waitClosed()).toBe(true);
        await onPath(Routes.ORDER_PENDING);
      });
    },
  );

  it(
    title(
      'The Devices popover lists Terminal and Printer with a status, read-only (APP-060)',
      Tag.REGRESSION,
    ),
    async () => {
      await gateProbe.routerNavigate(Routes.ORDER_PENDING);
      await onPath(Routes.ORDER_PENDING);
      await appShellProbe.clickDevices();
      const text = await appShellProbe.waitPopover('Devices');
      expect(text).not.toBeNull();
      log.info(`APP-060 Devices: ${text ?? ''}`);
      expect(text).toContain('Terminal');
      const printer = (text ?? '').match(/Printer \| (Connected|Not Connected|Not Installed Driver)/);
      expect(printer).not.toBeNull();
      if (printer?.[1] !== 'Connected') expect(text).toMatch(/\d+ devices? not connected/);
      // Never press "Check" — it prints a test page.
      await gateProbe.pressEscape();
      expect(await appShellProbe.waitPopoverGone('Devices')).toBe(true);
    },
  );

  it(
    title('The TURN tab shows on Home, Pending Orders and Order History only (APP-062)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      // The quick view only renders with Turn on AND a staff clocked in today; the
      // suite does not clock anyone in (shared time-keeping data).
      if (!(await turnBoardDialog.hasQuickView(Timeouts.SHORT))) this.skip();

      for (const route of [Routes.HOME, Routes.ORDER_PENDING, Routes.ORDER_HISTORY]) {
        await visit(route);
        expect({ route, tab: await turnBoardDialog.hasQuickView(Timeouts.SHORT) }).toEqual({
          route,
          tab: true,
        });
      }
      for (const route of [Routes.APPOINTMENT, Routes.TIME_TRACKING]) {
        await visit(route);
        await settle(800);
        expect({ route, tab: await turnBoardDialog.hasQuickView(Timeouts.ANIMATION) }).toEqual({
          route,
          tab: false,
        });
      }
    },
  );

  /* ------------------------------------------------------------------ *
   * Sidebar
   * ------------------------------------------------------------------ */

  it(
    title(
      'Each sidebar entry reaches its route through the gate typed on the keyboard (APP-064, APP-065, APP-066, APP-067, APP-068, APP-069, APP-070, APP-074)',
      Tag.REGRESSION,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);

      await step('Home → /home, drawer closes; reopened, Home is aria-current', async () => {
        await gateProbe.routerNavigate(Routes.ORDER_PENDING);
        await onPath(Routes.ORDER_PENDING);
        await appNav.openSidebar();
        await appShellProbe.clickSidebarLink(Routes.HOME);
        await onPath(Routes.HOME);
        expect(await appNav.isSidebarOpen()).toBe(false);
        await appNav.openSidebar();
        expect(await appShellProbe.sidebarHomeAriaCurrent()).toBe('page');
        await appNav.closeSidebar();
      });

      const entries: { path: string; gate: string; content: RegExp }[] = [
        { path: Routes.ORDER_HISTORY, gate: 'Order History', content: /Order History/ },
        { path: Routes.BATCH_HISTORY, gate: 'Batch History', content: /Batch History/ },
        // Build 1.1.x points the sidebar's report entries at the V4 pages.
        { path: Routes.REPORT_V4_DAILY, gate: 'Daily Sale Report', content: /Daily Sale Report/ },
        { path: Routes.REPORT_V4_SUMMARY, gate: 'Income Summary', content: /Income Summary/ },
        { path: Routes.REPORT_V4_STAFF_INCOME, gate: 'Staff Income', content: /Staff Income/ },
        { path: Routes.REPORT_V4_STAFF_PAYROLL, gate: 'Staff Payroll', content: /Staff Payroll/ },
        // The settings guard's wording differs by build; only its prefix is asserted.
        { path: Routes.SETTINGS_BUSINESS, gate: '', content: /Business Name/ },
      ];
      for (const e of entries) {
        await step(`Sidebar › ${e.path}`, async () => {
          await gateProbe.clearSkip();
          await gateProbe.routerNavigate(Routes.HOME);
          await onPath(Routes.HOME);
          await appNav.openSidebar();
          await appShellProbe.clickSidebarLink(e.path);
          expect(await appNav.isSidebarOpen()).toBe(false);
          if (await gateProbe.waitOpen(4_000)) {
            expect((await gateProbe.state())?.heading).toContain(`Enter staff code to access ${e.gate}`);
            // APP-065: physical keyboard, auto-submits on the 4th digit (no Submit button).
            await gateProbe.typeKeys(ownerCode());
            expect(await gateProbe.waitClosed()).toBe(true);
          } else {
            log.info(`${e.path}: gate is OFF — opened straight`);
          }
          await onPath(e.path);
          expect({ path: e.path, rendered: await gateProbe.waitMainText(e.content) }).toEqual({
            path: e.path,
            rendered: true,
          });
        });
      }
    },
  );

  it(
    title(
      'Time Keeping in the sidebar opens its dialog on the current page, no passcode (APP-071)',
      Tag.REGRESSION,
    ),
    async () => {
      await gateProbe.clearSkip();
      await gateProbe.routerNavigate(Routes.ORDER_PENDING);
      await onPath(Routes.ORDER_PENDING);
      await gateProbe.watchGates();
      await appNav.openSidebar();
      await timeKeepingDialog.pressSidebarEntry();
      expect(await timeKeepingDialog.isOpen(Timeouts.MEDIUM)).toBe(true);
      expect(await appNav.isSidebarOpen()).toBe(false);
      expect(await gateProbe.path()).toBe(Routes.ORDER_PENDING);
      expect(await timeKeepingDialog.currentDialogParam()).toBe('time-keeping');
      expect(await gateProbe.gatesSeen()).toEqual([]);
      await timeKeepingDialog.closeWithEscape();
    },
  );

  it(
    title(
      'Time Tracking in the sidebar asks its own passcode, then shows the table (APP-072)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await gateProbe.clearSkip();
      await appNav.openSidebar();
      await appShellProbe.clickSidebarLink(Routes.TIME_TRACKING);
      if (!(await gateProbe.waitOpen(4_000))) this.skip(); // Time Tracking gate is OFF

      expect((await gateProbe.state())?.heading).toBe('Enter staff code to access Time Tracking');
      expect((await gateProbe.submit(ownerCode())).result).toBe('allowed');
      await onPath(Routes.TIME_TRACKING);
      expect(await gateProbe.waitMainText(/Time Tracking/)).toBe(true);
      for (const col of ['Staff', 'Date IN', 'Date OUT', 'Total Hours']) {
        expect({ col, shown: await gateProbe.waitMainText(new RegExp(col), Timeouts.SHORT) }).toEqual({
          col,
          shown: true,
        });
      }
    },
  );

  it(title('Turn in the sidebar opens the Turn board dialog (APP-073)', Tag.REGRESSION), async () => {
    await gateProbe.routerNavigate(Routes.ORDER_PENDING);
    await onPath(Routes.ORDER_PENDING);
    await appNav.openSidebar();
    await turnBoardDialog.pressSidebarEntry();
    expect(await turnBoardDialog.isOpen(Timeouts.MEDIUM)).toBe(true);
    expect(await turnBoardDialog.currentDialogParam()).toBe('turn-board');
    await turnBoardDialog.close();
  });

  it(
    title(
      'The sidebar closes by its back button, Escape and the overlay; Ctrl+B toggles it (APP-076, APP-113)',
      Tag.REGRESSION,
    ),
    async () => {
      await gateProbe.routerNavigate(Routes.ORDER_PENDING);
      await onPath(Routes.ORDER_PENDING);
      const url0 = await browser.getUrl();

      await step('Back button at the top of the drawer', async () => {
        await appNav.openSidebar();
        await appShellProbe.clickSidebarBack();
        expect(await appNav.isSidebarOpen()).toBe(false);
        expect(await browser.getUrl()).toBe(url0);
      });
      await step('Escape', async () => {
        await appNav.openSidebar();
        await gateProbe.pressEscape();
        expect(await appNav.isSidebarOpen()).toBe(false);
        expect(await browser.getUrl()).toBe(url0);
      });
      await step('Click on the overlay', async () => {
        await appNav.openSidebar();
        await appShellProbe.clickOverlay();
        expect(await appNav.isSidebarOpen()).toBe(false);
        expect(await browser.getUrl()).toBe(url0);
      });
      await step('Ctrl+B opens, Ctrl+B closes', async () => {
        await appShellProbe.pressCtrlB();
        expect(await appNav.isSidebarOpen()).toBe(true);
        await appShellProbe.pressCtrlB();
        expect(await appNav.isSidebarOpen()).toBe(false);
        expect(await browser.getUrl()).toBe(url0);
      });
    },
  );

  it(
    title(
      'With the 30-minute skip ticked, gated pages open straight; clearing it asks again (APP-078)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      if (!(await gateProbe.activateSkip(Routes.BATCH_HISTORY, ownerCode()))) this.skip(); // Batch History gate OFF
      expect(await gateProbe.readSkip()).not.toBeNull();

      await gateProbe.watchGates();
      for (const [route, text] of [
        [Routes.INCOME_STAFF, /Total staff income/i],
        [Routes.TIME_TRACKING, /Date IN/],
      ] as const) {
        await gateProbe.routerNavigate(route);
        await onPath(route);
        expect({ route, rendered: await gateProbe.waitMainText(text) }).toEqual({ route, rendered: true });
      }
      expect(await gateProbe.gatesSeen()).toEqual([]);

      await gateProbe.clearSkip();
      expect(await gateProbe.openGate(Routes.BATCH_HISTORY)).toBe(true);
    },
  );

  it(
    title(
      'The About block at the foot of the sidebar shows Version, Device ID (QR) and Support (APP-079)',
      Tag.REGRESSION,
    ),
    async () => {
      await appNav.openSidebar();
      const about = await appShellProbe.readAbout();
      log.info(`APP-079: Version ${about.version}, Device ID ${about.deviceId}`);
      expect(about.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(about.deviceId).not.toMatch(/^$|Loading/);
      expect(about.support).toBe('(832) 968 9900');
      await appShellProbe.clickDeviceId();
      expect(await appShellProbe.lastPopoverHasSvg()).toBe(true);
    },
  );

  it(
    title(
      'Version Update shows the current version and, on the latest build, offers no update (APP-104)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await appNav.openSidebar();
      const version = (await appShellProbe.readAbout()).version;
      await appShellProbe.clickVersionUpdate();
      expect(await appShellProbe.isVersionDialogOpen(Timeouts.MEDIUM)).toBe(true);
      expect((await appShellProbe.versionDialogState()).currentVersion).toBe(version);

      await appShellProbe.checkForUpdates(); // never "Update Now"
      const state = await appShellProbe.versionDialogState();
      log.info(`APP-104: ${state.status || '(no status)'} on ${version}`);
      expect(state.status).not.toBe('');
      await appShellProbe.closeVersionDialog();

      // APP-104's precondition is "running the latest published build".
      if (state.status !== "You're Up to Date") this.skip();
      expect(state.text).toContain('Volt POS is running the latest version');
      expect(state.hasUpdateNow).toBe(false);
    },
  );

  /* ------------------------------------------------------------------ *
   * Shortcuts & notifications
   * ------------------------------------------------------------------ */

  it(
    title(
      'Ctrl+C / Ctrl+V in a text box only copy and paste — no customer box, no Void (APP-116)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await returnToHome();
      if (!(await appShellProbe.homeSearchBoxesShown())) this.skip(); // no Search staff / Search service boxes on Home
      const url = await browser.getUrl();
      const before = await appShellProbe.alertDialogCount();
      try {
        await appShellProbe.copyStaffSearchIntoServiceSearch('PAM');
        expect(await appShellProbe.serviceSearchValue()).toBe('PAM');
        expect(await browser.getUrl()).toBe(url);
        expect(await appShellProbe.alertDialogCount()).toBe(before);
      } finally {
        await appShellProbe.clearHomeSearchBoxes();
      }
    },
  );

  it(
    title(
      'The passcode gate takes the physical keyboard: dots follow keys, Backspace removes one, the 4th digit submits (APP-120)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!(await gateProbe.openGate(Routes.ORDER_HISTORY))) this.skip(); // Order History gate OFF
      await gateProbe.typeKeys('12');
      expect(await gateProbe.waitFilled(2)).toBe(2);
      await gateProbe.pressBackspaceKey();
      expect(await gateProbe.waitFilled(1)).toBe(1);
      await gateProbe.pressBackspaceKey();
      expect(await gateProbe.waitFilled(0)).toBe(0);
      await gateProbe.typeKeys(ownerCode());
      expect(await gateProbe.waitClosed()).toBe(true);
      expect(await gateProbe.waitMainHeading('Order History')).toBe(true);
    },
  );

  it(
    title('The Notifications list scrolls down to its end marker (APP-127)', Tag.REGRESSION, Tag.SLOW),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await appShellProbe.clickBell();
      expect(await appShellProbe.waitPopover('Notifications')).not.toBeNull();
      const end = await appShellProbe.scrollNotificationsToEnd();
      log.info(`APP-127 end marker: ${end ?? '(none)'}`);
      expect(end).toMatch(/^(No more notifications|No notifications yet)$/);
      await gateProbe.pressEscape();
      expect(await appShellProbe.waitPopoverGone('Notifications')).toBe(true);
    },
  );
});
