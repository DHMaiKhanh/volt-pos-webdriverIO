/**
 * volt-qc module 12-perm (PERM-*) + 10-reports gate cases — Passcode Setting
 * SAVED, and what a gate ON / OFF does. `@settings` / `@mutation` port.
 *
 * Source: volt-qc `e2e/tests/12-perm/perm-plan-gates.spec.ts` (PERM-T13a, T13b,
 * T15 ×8, T16a, T16b, T17, T18, T19) and `10-reports/rpt-plan-settings.spec.ts`
 * (RPT-T04). TC rows: docs/qc/volt-qc/windows-regression/12-phan-quyen-passcode.md,
 * 10-bao-cao-payroll.md.
 *
 * ## Why this file is @exclusive
 *
 * Passcode Setting is MERCHANT-GLOBAL (it syncs to every till of merchant 14).
 * `before` snapshots all 15 gates; every case restores that snapshot in its own
 * `finally` and `after` restores it once more, then re-arms the run's 30-minute
 * passcode grant. Orders a case needs are prepared BEFORE a gate is switched
 * off, so the window with a gate down is as short as possible.
 *
 * Adaptation: PERM-T16a used a Staff-role code to create the 30-minute skip; this
 * suite has only the owner code, so the skip is made with it — the assertion
 * (a gate OFF never asks, skip or no skip; a gate ON follows the skip) is the same.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import {
  ASP_PAGE_GATES,
  AspOrder,
  AspText,
} from '../../../../src/constants/testids.voltqc-app-rpt-set-perm.js';
import { Vq } from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { goToOrderHistory, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle, waitUntilPath } from '../../../../src/helpers/wait.js';
import {
  checkoutPage,
  orderHistoryDetailPage,
  orderHistoryPage,
  PASSCODE_GATES,
  settingsPage,
} from '../../../../src/pages/index.js';
import type { PasscodeGate, PasscodeGateState } from '../../../../src/pages/index.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import {
  buildHomeDraft,
  cleanTill,
  draftToCheckout,
  endSaleAfterComplete,
  log,
  ownerCode,
  readGates,
  restoreGates,
  saveGates,
  settleCashOrder,
  toastShown,
} from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { clearPasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { finishReopenUnchanged } from '../../order-flow/reopen-flow.helpers.js';
import { recoverShell } from '../app-perm/app-perm.helpers.js';

let snapshot: PasscodeGateState | null = null;

const snap = (): PasscodeGateState => {
  if (!snapshot) throw new Error('Passcode Setting snapshot was not taken');
  return snapshot;
};

/** Gate ON: the route asks, with "Enter staff code to access <page>". Escapes the guard. */
async function guardHeading(route: string): Promise<string | null> {
  if (!(await gateProbe.openGate(route))) return null;
  const heading = (await gateProbe.state())?.heading ?? '';
  await gateProbe.dismiss();
  return heading;
}

/** Gate OFF: the route opens with no guard and its content renders. */
async function opensWithoutGuard(
  route: string,
  content: RegExp,
): Promise<{ opened: boolean; guards: string[] }> {
  await gateProbe.dismiss();
  await clearPasscodeGrant();
  await returnToHome();
  await gateProbe.watchGates();
  await gateProbe.routerNavigate(route);
  const opened = await gateProbe.waitMainText(content, Timeouts.MEDIUM);
  const guards = await gateProbe.gatesSeen();
  await gateProbe.dismiss();
  if ((await gateProbe.path()).startsWith('/settings')) {
    await gateProbe.routerNavigate('/home');
    await settingsPage.confirmLeaveGuardIfShown();
  }
  return { opened, guards };
}

describe('volt-qc PERM — Passcode Setting saved, gates ON/OFF (settings)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('change merchant passcode gates');
    await cleanTill();
    snapshot = await readGates();
    log.info(`Passcode Setting snapshot: ${JSON.stringify(snapshot)}`);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await restoreGates(snapshot);
    await recoverShell();
  });

  it(
    title(
      'Saving one gate shows a success toast and the value survives leaving the page (PERM-033)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const want = !snap().view_order_history;
      try {
        await saveGates({ view_order_history: want });
        expect((await toastShown('updated', Timeouts.SHORT)) || (await toastShown('success', 1_000))).toBe(
          true,
        );
        await settingsPage.openSection('LANGUAGE');
        expect((await readGates()).view_order_history).toBe(want);
      } finally {
        await restoreGates(snapshot);
      }
      expect((await readGates()).view_order_history).toBe(snap().view_order_history);
    },
  );

  it(
    title(
      'Each of the 15 gates saves on its own; three gates switched off stay off after leaving (PERM-034)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(15 * 60_000);
      const base = snap();
      try {
        for (const g of PASSCODE_GATES) {
          await step(`gate ${g}`, async () => {
            await saveGates({ [g]: !base[g] });
            expect((await readGates())[g]).toBe(!base[g]);
            await saveGates({ [g]: base[g] });
          });
        }
        const three: PasscodeGate[] = ['staff_payroll', 'delete_order', 'time_tracking'];
        await saveGates(Object.fromEntries(three.map((g) => [g, false])));
        await returnToHome();
        const now = await readGates();
        for (const g of three) expect(now[g]).toBe(false);
      } finally {
        await restoreGates(snapshot);
      }
    },
  );

  // One case per page gate — ids (from ASP_PAGE_GATES): PERM-040, PERM-041, PERM-042, PERM-043,
  // PERM-044, PERM-045, PERM-052, PERM-054, PERM-055; the five report gates also claim RPT-018.
  for (const pg of ASP_PAGE_GATES) {
    const rpt = /income|batch/.test(pg.route) ? ', RPT-018' : '';
    it(
      title(
        `Gate "${pg.page}" ON asks "${AspText.gateAccess(pg.page)}", OFF opens straight away (${pg.id}${rpt})`,
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.EXCLUSIVE,
      ),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK * 2);
        const gate = pg.gate as PasscodeGate;
        const check = async (on: boolean, label: string): Promise<void> => {
          if (on) {
            expect({ label, heading: await guardHeading(pg.route) }).toEqual({
              label,
              heading: AspText.gateAccess(pg.page),
            });
          } else {
            const r = await opensWithoutGuard(pg.route, pg.content);
            expect({ label, ...r }).toEqual({ label, opened: true, guards: [] });
          }
        };
        const orig = snap()[gate];
        try {
          await check(orig, 'original');
          await saveGates({ [gate]: !orig });
          await check(!orig, 'flipped');
        } finally {
          await restoreGates(snapshot);
        }
        await check(orig, 'restored');
      },
    );
  }

  it(
    title(
      'A gate OFF never asks, with or without a 30-minute skip; a gate ON follows the skip (PERM-039)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      try {
        await saveGates({ daily_income: false, summary_income: true });

        const noSkip = await opensWithoutGuard('/incomes/income-daily', /Total Order/);
        expect(noSkip).toEqual({ opened: true, guards: [] });

        await step('Gate ON (Income Summary) asks; tick the skip and answer', async () => {
          expect(await gateProbe.activateSkip('/incomes/income-summary', ownerCode())).toBe(true);
          expect(await gateProbe.readSkip()).not.toBeNull();
        });

        await returnToHome();
        await gateProbe.watchGates();
        await gateProbe.routerNavigate('/incomes/income-daily');
        expect(await gateProbe.waitMainText(/Total Order/)).toBe(true);
        await gateProbe.routerNavigate('/home');
        await gateProbe.routerNavigate('/incomes/income-summary');
        expect(await gateProbe.waitMainText(/Total (Payment|Income)/)).toBe(true);
        expect(await gateProbe.gatesSeen()).toEqual([]);

        await step('Skip dropped → the ON gate asks again, the OFF gate still does not', async () => {
          expect(await guardHeading('/incomes/income-summary')).toBe(AspText.gateAccess('Income Summary'));
          expect(await opensWithoutGuard('/incomes/income-daily', /Total Order/)).toEqual({
            opened: true,
            guards: [],
          });
        });
      } finally {
        await restoreGates(snapshot);
      }
    },
  );

  it(
    title(
      'Completed Payment gate OFF does not drop the report gates (PERM-047, RPT-019)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await saveGates({ complete_order: false, summary_income: true, daily_income: true });
        expect(await guardHeading('/incomes/income-summary')).toBe(AspText.gateAccess('Income Summary'));
        expect(await guardHeading('/incomes/income-daily')).toBe(AspText.gateAccess('Daily Sale Report'));
      } finally {
        await restoreGates(snapshot);
      }
    },
  );

  it(
    title(
      'Action gates OFF: Remove goes straight to Delete Order, Cash Drawer and Complete Payment run with no passcode (PERM-046, PERM-051, PERM-053)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      try {
        await saveGates({ complete_order: false, delete_order: false, open_cash_drawer: false });
        await clearPasscodeGrant();

        await step('PERM-051 Remove → Delete Order confirm, no passcode', async () => {
          await buildHomeDraft();
          await gateProbe.watchGates();
          await vqProbe.press(AspOrder.remove);
          expect(await vqProbe.isShown(AspOrder.deleteOrderDialog, Timeouts.SHORT)).toBe(true);
          expect(await gateProbe.gatesSeen()).toEqual([]);
          await vqProbe.press(Vq.alertButton('Delete'));
          await vqProbe.isGone(Vq.alertDialog(), Timeouts.SHORT);
        });

        await step('PERM-053 Cash Drawer, PERM-046 Complete Payment — no passcode', async () => {
          await draftToCheckout();
          await checkoutPage.selectTender('cash');
          await gateProbe.watchGates();
          await vqProbe.press(AspOrder.cashDrawer);
          await settle(2_000);
          const afterDrawer = await gateProbe.gatesSeen();
          await gateProbe.dismiss();
          expect(afterDrawer).toEqual([]);

          await gateProbe.watchGates();
          await checkoutPage.pressCompletePayment();
          await endSaleAfterComplete();
          expect(await gateProbe.gatesSeen()).toEqual([]);
        });
      } finally {
        await restoreGates(snapshot);
        await cleanTill().catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Cancel Order and Re-Open gates OFF: void and re-open run with no passcode (PERM-048, PERM-050)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 3);
      // Orders first — the gates go down only for the two actions.
      const a = await settleCashOrder();
      const b = await settleCashOrder();
      let reopened = false;
      try {
        await saveGates({ cancel_order: false, reopen_order: false });
        await clearPasscodeGrant();

        await step('PERM-048 cancel order A — no passcode, toast', async () => {
          await goToOrderHistory();
          await orderHistoryPage.openOrder(a.orderId);
          await orderHistoryDetailPage.waitForOrder(a.orderId);
          await gateProbe.watchGates();
          await orderHistoryDetailPage.cancelOrder('customer_request');
          expect(await toastShown(AspText.orderCanceled, Timeouts.API)).toBe(true);
          expect(await gateProbe.gatesSeen()).toEqual([]);
        });

        await step('PERM-050 re-open order B — no passcode, lands on checkout', async () => {
          await returnToHome();
          await goToOrderHistory();
          await orderHistoryPage.openOrder(b.orderId);
          await orderHistoryDetailPage.waitForOrder(b.orderId);
          await gateProbe.watchGates();
          await orderHistoryDetailPage.openReopenDialog();
          await orderHistoryDetailPage.pressReopenConfirm();
          await waitUntilPath((p) => p.startsWith(`/order/${b.orderId}/checkout`), {
            timeout: Timeouts.NAVIGATION,
            message: 'Re-open with the gate OFF never reached checkout',
          });
          reopened = true;
          expect(await gateProbe.gatesSeen()).toEqual([]);
          await checkoutPage.waitForReady(Timeouts.MEDIUM);
          await finishReopenUnchanged(b.orderId);
          reopened = false;
        });
      } finally {
        if (reopened) await finishReopenUnchanged(b.orderId).catch(() => undefined);
        await restoreGates(snapshot);
      }
    },
  );

  it(
    title(
      'Every gate OFF (Active All): a masked phone still asks "Enter staff code to continue" (PERM-058)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      let heading: string | null = null;
      let found = true;
      try {
        await saveGates(Object.fromEntries(PASSCODE_GATES.map((g) => [g, false])));
        await clearPasscodeGrant();
        await returnToHome();
        await goToOrderHistory();
        await orderHistoryPage.waitForRows(1, Timeouts.MEDIUM).catch(() => undefined);
        const ids = (await orderHistoryPage.renderedOrderIds()).slice(0, 12);
        found = false;
        for (const id of ids) {
          await orderHistoryPage.openOrder(id);
          await orderHistoryDetailPage.waitForOrder(id);
          if ((await vqProbe.count(AspOrder.maskedPhone)) === 0) continue;
          found = true;
          await vqProbe.press(AspOrder.maskedPhone);
          heading = (await gateProbe.waitOpen(Timeouts.SHORT))
            ? ((await gateProbe.state())?.heading ?? '')
            : null;
          await gateProbe.dismiss();
          break;
        }
      } finally {
        await restoreGates(snapshot);
      }
      if (!found) {
        log.warn('PERM-058: no order with a masked customer phone among the first 12 in Order History');
        this.skip();
      }
      expect(heading).toBe(AspText.gateContinue);
    },
  );
});
