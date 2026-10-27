/**
 * volt-qc module 12-perm (PERM-*) — action gates, the 30-minute skip, View Phone
 * Number, the matrix debounce and the Vietnamese guard. `@mutation` / `@settings`.
 *
 * Source: volt-qc `e2e/tests/12-perm/perm-plan-dialog.spec.ts` (PERM-T03b, T04,
 * T11b), `perm-plan-skip.spec.ts` (T06a), `perm-plan-matrix.spec.ts` (T10 owner
 * part, T26b PERM-081 part, T27b, T05). TC rows:
 * docs/qc/volt-qc/windows-regression/12-phan-quyen-passcode.md.
 *
 * Writes: drafts are created and deleted, one cash order is settled; T27b flips
 * three Partner permissions for a few seconds and restores them (Tag.EXCLUSIVE);
 * T05 switches the till to Vietnamese and back (Tag.EXCLUSIVE). Every case drops
 * the 30-minute grant to see the guard; `after` re-arms it.
 *
 * Not ported here: everything that needs a Manager / Partner / Staff-role code
 * (the matrix-by-role cases) — those are listed as [MANUAL] in
 * `_manual/app-rpt-set-perm-devm.manual.spec.ts`.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { AspOrder, AspText, AspVi } from '../../../../src/constants/testids.voltqc-app-rpt-set-perm.js';
import { Vq } from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { goToOrderHistory, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  checkoutPage,
  homePage,
  orderHistoryDetailPage,
  orderHistoryPage,
  settingsPage,
} from '../../../../src/pages/index.js';
import StaffsSettingsPage from '../../../../src/pages/settings/StaffsSettingsPage.js';
import { appShellProbe } from '../../../../src/pages/voltqc/app-perm/AppShellProbe.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import {
  bodyText,
  buildHomeDraft,
  cleanTill,
  clickPerm,
  goAnyLang,
  log,
  openPermissions,
  ownerCode,
  readGates,
  readPerm,
  restoreEnglish,
  setLanguage,
  setPerm,
  settleCashOrder,
} from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { recoverShell } from '../app-perm/app-perm.helpers.js';

const PARTNER = 2;

/** Open orders in history until one shows a masked customer phone; returns its id. */
async function openOrderWithMaskedPhone(limit = 12): Promise<string | null> {
  await returnToHome();
  await goToOrderHistory();
  await orderHistoryPage.waitForRows(1, Timeouts.MEDIUM).catch(() => undefined);
  for (const id of (await orderHistoryPage.renderedOrderIds()).slice(0, limit)) {
    await orderHistoryPage.openOrder(id);
    await orderHistoryDetailPage.waitForOrder(id);
    if ((await vqProbe.count(AspOrder.maskedPhone)) > 0) return id;
  }
  return null;
}

describe('volt-qc PERM — action gates, skip, phone, matrix (mutation)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create drafts and settle orders behind passcode gates');
    await cleanTill();
  });

  afterEach(async () => {
    await gateProbe.dismiss().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await restoreEnglish();
    await recoverShell();
    await cleanTill().catch(() => undefined);
  });

  it(
    title(
      'Closing the Delete Order guard with X leaves the draft in place (PERM-017)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await buildHomeDraft();
      await clearPasscodeGrant();
      await vqProbe.press(AspOrder.remove);
      const asked = await gateProbe.waitOpen(4_000);
      if (!asked) {
        if (await vqProbe.isShown(Vq.alertButton('Cancel'), Timeouts.ANIMATION))
          await vqProbe.press(Vq.alertButton('Cancel'));
        log.warn('PERM-017: the Delete Order gate is OFF on this merchant');
        this.skip();
      }
      expect((await gateProbe.state())?.heading).toBe(AspText.gateDeleteOrder);
      await gateProbe.clickClose();
      expect(await gateProbe.waitClosed()).toBe(true);
      expect(await vqProbe.count(AspOrder.deleteOrderDialog)).toBe(0);
      expect(await homePage.hasActiveDraft()).toBe(true);
      await ensurePasscodeGrant();
      await cleanTill();
    },
  );

  it(
    title(
      'The guard title follows the screen / action: page gates, re-open, Delete Order, Cash Drawer, Complete Payment, phone (PERM-019)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      const gates = await readGates();
      const wrong: string[] = [];
      const expectHeading = async (want: string): Promise<boolean> => {
        if (!(await gateProbe.waitOpen(4_000))) return false;
        const got = (await gateProbe.state())?.heading ?? '';
        if (got !== want) wrong.push(`want "${want}", got "${got}"`);
        await gateProbe.clickClose().catch(() => gateProbe.dismiss());
        await gateProbe.waitClosed();
        return true;
      };

      const pages: [string, string, boolean][] = [
        ['/order-history', 'Order History', gates.view_order_history],
        ['/batch-history', 'Batch History', gates.batch_history],
        ['/incomes/income-daily', 'Daily Sale Report', gates.daily_income],
        ['/incomes/income-summary', 'Income Summary', gates.summary_income],
        ['/incomes/income-staff', 'Staff Income', gates.staff_income],
        ['/incomes/staff-payroll', 'Staff Payroll', gates.staff_payroll],
        ['/time-tracking', 'Time Tracking', gates.time_tracking],
        ['/settings/business', 'Merchant Settings Page', gates.settings_page],
      ];
      for (const [route, page, on] of pages) {
        if (!on) continue;
        await returnToHome();
        await clearPasscodeGrant();
        await gateProbe.routerNavigate(route);
        await expectHeading(AspText.gateAccess(page));
        await gateProbe.dismiss();
      }

      if (gates.reopen_order) {
        const paid = await settleCashOrder();
        await step('Order History › Re-Open', async () => {
          await goToOrderHistory();
          await orderHistoryPage.openOrder(paid.orderId);
          await orderHistoryDetailPage.waitForOrder(paid.orderId);
          await clearPasscodeGrant();
          await orderHistoryDetailPage.openReopenDialog();
          await orderHistoryDetailPage.pressReopenConfirm();
          await expectHeading(AspText.gateReopen);
          if (await orderHistoryDetailPage.isReopenDialogShown())
            await orderHistoryDetailPage.closeReopenDialog();
          expect(await gateProbe.path()).not.toContain('/checkout');
        });
      }

      await step('Pending draft › Remove, Cash Drawer, Complete Payment', async () => {
        await ensurePasscodeGrant();
        await buildHomeDraft();
        await clearPasscodeGrant();
        if (gates.delete_order) {
          await vqProbe.press(AspOrder.remove);
          await expectHeading(AspText.gateDeleteOrder);
        }
        await ensurePasscodeGrant();
        await homePage.pressPay();
        await checkoutPage.waitForReady();
        await checkoutPage.selectTender('cash');
        await clearPasscodeGrant();
        if (gates.open_cash_drawer) {
          await vqProbe.press(AspOrder.cashDrawer);
          await expectHeading(AspText.gateCashDrawer);
        }
        if (gates.complete_order) {
          await checkoutPage.pressCompletePayment();
          await expectHeading(AspText.gateCompletePayment);
        }
      });

      const phoneOrder = await openOrderWithMaskedPhone();
      if (phoneOrder) {
        await clearPasscodeGrant();
        await vqProbe.press(AspOrder.maskedPhone);
        await expectHeading(AspText.gateContinue);
      } else log.warn('PERM-019: no order with a masked phone — phone title not checked');

      await ensurePasscodeGrant();
      await cleanTill();
      expect(wrong).toEqual([]);
    },
  );

  it(
    title(
      'Time Keeping, Appointment, Pending and adding a service on Home never ask for a passcode (PERM-030)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await cleanTill();
      await clearPasscodeGrant();
      await gateProbe.watchGates();
      await appShellProbe.clickTimeKeepingIcon();
      await settle(2_000);
      await gateProbe.pressEscape();
      for (const route of ['/appointment', '/order-pending', '/home']) {
        await gateProbe.routerNavigate(route);
        await settle(1_500);
      }
      await homePage.selectStaffByIndex(0);
      await homePage.addServiceByIndex(0);
      await settle(1_500);
      expect(await gateProbe.gatesSeen()).toEqual([]);
      await ensurePasscodeGrant();
      await cleanTill();
    },
  );

  it(
    title(
      'Ticking "Do not require passcode for the next 30 minutes" skips every gate for 30 minutes; Remove goes straight to Delete Order (PERM-021)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        if (!(await gateProbe.activateSkip('/order-history', ownerCode()))) {
          log.warn('PERM-021: the Order History gate is OFF — no skip can be created there');
          this.skip();
        }
        const now = await gateProbe.now();
        const skip = await gateProbe.readSkip();
        expect(skip).not.toBeNull();
        expect(typeof skip?.staffId).toBe('string');
        const mins = ((skip?.expiresAt ?? 0) - now) / 60_000;
        expect(mins).toBeGreaterThanOrEqual(29);
        expect(mins).toBeLessThanOrEqual(30.05);

        await gateProbe.watchGates();
        for (const [route, text] of [
          ['/incomes/income-daily', /Total Order/],
          ['/incomes/staff-payroll', /Current Period|Total staff income/],
          ['/settings/business', /Business Info/],
          ['/time-tracking', /Date IN|Time Tracking/],
        ] as const) {
          await gateProbe.routerNavigate('/home');
          await settingsPage.confirmLeaveGuardIfShown();
          await gateProbe.routerNavigate(route);
          expect({ route, shown: await gateProbe.waitMainText(text) }).toEqual({ route, shown: true });
        }
        await gateProbe.routerNavigate('/home');
        await settingsPage.confirmLeaveGuardIfShown();
        await returnToHome();
        await homePage.selectStaffByIndex(0);
        await homePage.addServiceByIndex(0);
        await vqProbe.press(AspOrder.remove);
        expect(await vqProbe.isShown(AspOrder.deleteOrderDialog, Timeouts.SHORT)).toBe(true);
        expect(await gateProbe.gatesSeen()).toEqual([]);
        await vqProbe.press(Vq.alertButton('Delete'));
        await vqProbe.isGone(Vq.alertDialog(), Timeouts.SHORT);
      } finally {
        await clearPasscodeGrant();
        await ensurePasscodeGrant();
      }
    },
  );

  it(
    title(
      'A masked phone always asks "Enter staff code to continue"; the owner code reveals it in place, and a 30-minute skip reveals it with no guard (PERM-057, PERM-028)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const id = await openOrderWithMaskedPhone();
      if (!id) {
        log.warn('PERM-057: no order with a masked customer phone among the first 12 in Order History');
        this.skip();
      }
      const before = await vqProbe.count(AspOrder.maskedPhone);
      const path = await gateProbe.path();
      await clearPasscodeGrant();
      await vqProbe.press(AspOrder.maskedPhone);
      expect(await gateProbe.waitOpen(Timeouts.SHORT)).toBe(true);
      expect((await gateProbe.state())?.heading).toBe(AspText.gateContinue);
      expect((await gateProbe.submit(ownerCode())).result).toBe('allowed');
      await settle(800);
      expect(await vqProbe.count(AspOrder.maskedPhone)).toBeLessThan(before);
      expect(await gateProbe.path()).toBe(path);

      await step('PERM-028 with a skip active the number opens without a guard', async () => {
        try {
          if (!(await gateProbe.activateSkip('/order-history', ownerCode()))) {
            log.warn('PERM-028: the Order History gate is OFF — no skip could be created');
            return;
          }
          await orderHistoryPage.openOrder(id ?? '');
          await orderHistoryDetailPage.waitForOrder(id ?? '');
          const masked = await vqProbe.count(AspOrder.maskedPhone);
          expect(masked).toBeGreaterThan(0);
          await gateProbe.watchGates();
          await vqProbe.press(AspOrder.maskedPhone);
          await settle(1_200);
          expect(await gateProbe.gatesSeen()).toEqual([]);
          expect(await vqProbe.count(AspOrder.maskedPhone)).toBeLessThan(masked);
        } finally {
          await clearPasscodeGrant();
          await ensurePasscodeGrant();
        }
      });
    },
  );

  it(
    title(
      'Staff detail › Permissions: switches the role already grants are ON and locked (PERM-081)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await goAnyLang('/settings/staffs');
      const rows = await StaffsSettingsPage.staffRows();
      const target = rows.find((r) => /active/i.test(r.status)) ?? rows[0];
      if (!target) this.skip();
      await StaffsSettingsPage.openStaff(target?.name ?? '');
      await StaffsSettingsPage.openTab(4);
      const locked = await vqProbe.count(Vq.disabledSwitches('main'));
      const all = await vqProbe.count(Vq.switches('main'));
      log.info(`PERM-081 ${target?.name ?? ''}: ${String(locked)} locked of ${String(all)} switches`);
      expect(all).toBeGreaterThan(0);
      expect(locked).toBeGreaterThan(0);
      for (let i = 0; i < locked; i += 1) {
        const s = await vqProbe.read({ ...Vq.disabledSwitches('main'), nth: i });
        expect(s.checked).toBe(true);
      }
      expect(await vqProbe.isDisabled(Vq.button('Save', 'main'))).toBe(true);
      await goAnyLang('/settings/business');
    },
  );

  it(
    title(
      'Flipping three Partner permissions in quick succession saves all three (debounce per key) (PERM-094)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const labels = ['Refund', 'Open Cash Drawer', 'View Time Tracking'];
      await openPermissions();
      const snap: Record<string, boolean> = {};
      for (const l of labels) {
        const v = await readPerm(l, PARTNER);
        if (v === null) throw new Error(`Permissions: row "${l}" not rendered`);
        snap[l] = v;
      }
      log.info(`PERM-094 Partner snapshot: ${JSON.stringify(snap)}`);
      try {
        const t0 = Date.now();
        for (const l of labels) await clickPerm(l, PARTNER);
        expect(Date.now() - t0).toBeLessThan(4_000);
        await settle(2_500);
        await settingsPage.openSection('ROLES');
        await openPermissions();
        for (const l of labels) expect({ l, v: await readPerm(l, PARTNER) }).toEqual({ l, v: !snap[l] });
      } finally {
        await openPermissions();
        for (const l of labels) await setPerm(l, PARTNER, snap[l] ?? false);
        await settle(1_500);
      }
      await settingsPage.openSection('ROLES');
      await openPermissions();
      for (const l of labels) expect({ l, v: await readPerm(l, PARTNER) }).toEqual({ l, v: snap[l] });
    },
  );

  it(
    title(
      'Vietnamese: guard title / skip label and the Passcode Setting card are translated (PERM-020, PERM-038)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await setLanguage('vi');
        await step('PERM-020 guard in Vietnamese', async () => {
          if (await gateProbe.openGate('/order-history')) {
            const s = await gateProbe.state();
            expect(s?.heading).toBe('Nhập mã nhân viên để truy cập Lịch sử đơn hàng');
            expect(await bodyText('[role="dialog"]')).toContain('Không yêu cầu passcode trong 30 phút tới');
            await gateProbe.dismiss();
          } else log.warn('PERM-020: Order History gate OFF — guard title not checked');
        });
        await step('PERM-038 Passcode Setting card in Vietnamese', async () => {
          await goAnyLang('/settings/accessibility');
          const t = await bodyText('main');
          for (const s of [...AspVi.passcodeCard, 'Huỷ đơn hàng', 'Cài đặt POS'])
            expect({ s, has: t.includes(s) }).toEqual({ s, has: true });
          expect(t).not.toMatch(AspText.rawKey);
        });
      } finally {
        await restoreEnglish();
        await ensurePasscodeGrant();
      }
    },
  );
});
