/**
 * volt-qc module 10-reports (RPT-*) — what a NEW order does to the reports
 * (`@mutation`), plus the remaining gate / Daily Sale rows.
 *
 * Source: volt-qc `e2e/tests/10-reports/reports.spec.ts` (RPT-A, RPT-B),
 * `rpt-plan-daily.spec.ts` (RPT-T09, T10, T11), `rpt-plan-summary.spec.ts`
 * (RPT-T17), `rpt-plan-staff-income.spec.ts` (RPT-T24), `rpt-plan-cross.spec.ts`
 * (RPT-T33), and the TC rows RPT-002..006, 013, 020, 187, 190, 191, 193 of
 * docs/qc/volt-qc/windows-regression/10-bao-cao-payroll.md (written from the row).
 *
 * Writes: settles cash / Other orders on merchant 14, cancels one, re-opens one
 * (re-completed unchanged) and adjusts one tip. No setting is changed. Reports
 * are read on the V1 routes (`/incomes/*`) the volt-qc tests target; every
 * delta is asserted as "at least my order" so another sale on the till cannot
 * make a case fail. All money is integer cents.
 */

import { browser, expect } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { appNav } from '../../../../src/components/index.js';
import { RptCss, RptRoutes, RptTitles } from '../../../../src/constants/testids.voltqc-reports-time.js';
import { AspText } from '../../../../src/constants/testids.voltqc-app-rpt-set-perm.js';
import { goToOrderHistory, payWithOther, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle, waitUntilPath } from '../../../../src/helpers/wait.js';
import { checkoutPage, orderHistoryDetailPage, orderHistoryPage } from '../../../../src/pages/index.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import {
  cleanTill,
  draftToCheckout,
  log,
  ownerCode,
  settleCashOrder,
  toastShown,
  type SettledOrder,
} from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import { voltQcProbe } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  paneText,
  rangeOffset,
  searchParam,
  type UnixRange,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  clickRow,
  closeOrderDetails,
  dailySnapshot,
  dateRangeText,
  openDaily,
  openStaffIncome,
  openSummary,
  orderDetailsText,
  staffList,
  summaryState,
  waitOrderDetails,
  type DailyRow,
  type DailySnap,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { finishReopenUnchanged } from '../../order-flow/reopen-flow.helpers.js';

const bare = (code: string): string => code.replace(/^#/, '').trim();
const rowsFor = (snap: DailySnap, code: string): DailyRow[] =>
  snap.rows.filter((r) => r.order.includes(bare(code)));
const cardValue = (snap: DailySnap, titleText: string): number => snap.cards[titleText]?.value ?? Number.NaN;

/** Poll Daily Sale (today) until `ok(snapshot)` or the budget runs out; returns the last snapshot. */
async function dailyUntil(ok: (s: DailySnap) => boolean, budgetMs = 60_000): Promise<DailySnap> {
  const end = Date.now() + budgetMs;
  let s = await dailySnapshot(0);
  while (!ok(s) && Date.now() < end) {
    await settle(3_000);
    s = await dailySnapshot(0);
  }
  return s;
}

/** Settle an order with the "Other" tender; back on /home. */
async function settleOtherOrder(): Promise<SettledOrder> {
  const draft = await draftToCheckout();
  await checkoutPage.selectTender('cash');
  const totalCents = await checkoutPage.totalCents();
  const success = await payWithOther(draft.orderId, 'QC Other');
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();
  await returnToHome();
  return { ...draft, totalCents };
}

async function openHistoryDetail(orderId: string): Promise<void> {
  await returnToHome();
  await goToOrderHistory();
  await orderHistoryPage.openOrder(orderId);
  await orderHistoryDetailPage.waitForOrder(orderId);
}

/** Times (minutes of day) of the Daily Sale rows, top to bottom (`hh:mm AM`). */
function rowMinutes(rows: DailyRow[]): number[] {
  return rows
    .map((r) => /(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(r.order))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ((Number(m[1]) % 12) + (/p/i.test(m[3] ?? '') ? 12 : 0)) * 60 + Number(m[2]));
}

describe('volt-qc RPT — new orders vs the reports (mutation)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('settle, cancel and re-open orders for the report checks');
    await cleanTill();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await gateProbe.dismiss().catch(() => undefined);
    await ensurePasscodeGrant();
    await returnToHome().catch(() => undefined);
  });

  /* ----------------------------- gate rows ------------------------------- */

  for (const [key, id] of [
    ['daily', 'RPT-002'],
    ['summary', 'RPT-003'],
    ['staff', 'RPT-004'],
    ['payroll', 'RPT-005'],
    ['batch', 'RPT-006'],
  ] as const) {
    it(
      title(
        `${RptTitles[key]} gate: heading "${AspText.gateAccess(RptTitles[key])}", the owner code opens it in the app (${id})`,
        Tag.REGRESSION,
      ),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        try {
          if (!(await gateProbe.openGate(RptRoutes[key]))) {
            log.warn(`${id}: the ${RptTitles[key]} gate is OFF`);
            this.skip();
          }
          expect((await gateProbe.state())?.heading).toBe(AspText.gateAccess(RptTitles[key]));
          expect((await gateProbe.submit(ownerCode())).result).toBe('allowed');
          expect(await gateProbe.path()).toBe(RptRoutes[key]);
          expect((await paneText(RptCss.main)).length).toBeGreaterThan(0);
        } finally {
          await ensurePasscodeGrant();
        }
      },
    );
  }

  it(
    title('Cancelling the report guard with X or Escape does not open the report (RPT-013)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        for (const how of ['x', 'escape'] as const) {
          if (!(await gateProbe.openGate(RptRoutes.daily))) this.skip();
          if (how === 'x') await gateProbe.clickClose();
          else await gateProbe.pressEscape();
          expect(await gateProbe.waitClosed()).toBe(true);
          await settle(800);
          expect({ how, path: await gateProbe.path() }).not.toEqual({ how, path: RptRoutes.daily });
          expect(/Total Order/.test(await paneText(RptCss.main))).toBe(false);
        }
      } finally {
        await ensurePasscodeGrant();
      }
    },
  );

  it(
    title('Reloading the app while on a report runs the gate again (RPT-020)', Tag.REGRESSION, Tag.SLOW),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      try {
        if (!(await gateProbe.openGate(RptRoutes.daily))) this.skip();
        expect((await gateProbe.submit(ownerCode())).result).toBe('allowed');
        await clearPasscodeGrant();
        await appNav.openSidebar();
        if (!(await appNav.isReloadShown())) {
          await appNav.closeSidebar();
          log.warn('RPT-020: no Reload entry in the sidebar');
          this.skip();
        }
        await appNav.pressReload();
        await browser.waitUntil(async () => gateProbe.isOpen(), {
          timeout: Timeouts.APP_BOOT,
          interval: 1_000,
          timeoutMsg: 'After Reload on Daily Sale the passcode gate never came back',
        });
        expect((await gateProbe.state())?.heading).toMatch(/Enter staff code to access/);
        await gateProbe.submit(ownerCode());
      } finally {
        await ensurePasscodeGrant();
        await returnToHome().catch(() => undefined);
      }
    },
  );

  /* ----------------------------- Daily Sale ------------------------------ */

  it(
    title(
      'A new Cash (+ an Other) order: one row each, ascending by time, Δ Cash / Others in Payment Details (RPT-039, RPT-040, RPT-029)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 3);
      const before = await dailySnapshot(0);
      const cash = await settleCashOrder();
      const other = await settleOtherOrder();
      const after = await dailyUntil(
        (s) => rowsFor(s, cash.orderNumber).length > 0 && rowsFor(s, other.orderNumber).length > 0,
      );
      const rc = rowsFor(after, cash.orderNumber);
      const ro = rowsFor(after, other.orderNumber);
      expect(rc.length).toBe(1);
      expect(ro.length).toBe(1);
      expect(rc[0]?.total ?? 0).toBe((rc[0]?.sale ?? 0) + (rc[0]?.tip ?? 0) + (rc[0]?.tax ?? 0));
      expect(rc[0]?.total).toBe(cash.totalCents);
      if (before.detail && after.detail) {
        expect(after.detail.cash - before.detail.cash).toBeGreaterThanOrEqual(cash.totalCents);
        expect(after.detail.others - before.detail.others).toBeGreaterThanOrEqual(other.totalCents);
      }
      expect(cardValue(after, 'Total Order') - cardValue(before, 'Total Order')).toBeGreaterThanOrEqual(2);
      const mins = rowMinutes(after.rows);
      expect(mins).toEqual([...mins].sort((a, b) => a - b));
    },
  );

  it(
    title(
      'A cancelled (voided) order disappears from Daily Sale and is not counted (RPT-044)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      const o = await settleCashOrder();
      await dailyUntil((s) => rowsFor(s, o.orderNumber).length === 1);
      await openHistoryDetail(o.orderId);
      await orderHistoryDetailPage.cancelOrder('customer_request');
      await gateProbe.submit(ownerCode()).catch(() => undefined);
      expect(await toastShown(AspText.orderCanceled, Timeouts.API)).toBe(true);
      const after = await dailyUntil((s) => rowsFor(s, o.orderNumber).length === 0);
      expect(rowsFor(after, o.orderNumber)).toEqual([]);
    },
  );

  it(
    title(
      'Adjust Tip after payment changes the row Tip / Total; Sale unchanged (RPT-048)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      const o = await settleCashOrder();
      const before = rowsFor(
        await dailyUntil((s) => rowsFor(s, o.orderNumber).length === 1),
        o.orderNumber,
      )[0];
      await openHistoryDetail(o.orderId);
      if (!(await orderHistoryDetailPage.isAdjustTipAvailable())) {
        log.warn('RPT-048: Adjust Tip is not offered on this order (Tip Timing is not After Payment)');
        this.skip();
      }
      await orderHistoryDetailPage.adjustTip(300);
      await gateProbe.submit(ownerCode()).catch(() => undefined);
      await settle(1_500);
      const after = rowsFor(
        await dailyUntil((s) => (rowsFor(s, o.orderNumber)[0]?.tip ?? 0) !== (before?.tip ?? 0)),
        o.orderNumber,
      )[0];
      expect(after?.tip).toBe((before?.tip ?? 0) + 300);
      expect(after?.sale).toBe(before?.sale);
      expect(after?.total).toBe((before?.total ?? 0) + 300);
    },
  );

  it(
    title(
      'A re-opened order leaves Daily Sale; completed again it is counted exactly once (RPT-049)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 3);
      const o = await settleCashOrder();
      await dailyUntil((s) => rowsFor(s, o.orderNumber).length === 1);
      let reopened = false;
      try {
        await openHistoryDetail(o.orderId);
        await orderHistoryDetailPage.openReopenDialog();
        await orderHistoryDetailPage.pressReopenConfirm();
        await gateProbe.waitOpen(2_000).then(async (up) => (up ? gateProbe.submit(ownerCode()) : undefined));
        await waitUntilPath((p) => p.startsWith(`/order/${o.orderId}/checkout`), {
          timeout: Timeouts.NAVIGATION,
          message: 'Re-open never reached checkout',
        });
        reopened = true;
        await step('While re-opened the order is not on Daily Sale', async () => {
          const mid = await dailyUntil((s) => rowsFor(s, o.orderNumber).length === 0, 30_000);
          expect(rowsFor(mid, o.orderNumber)).toEqual([]);
          await openHistoryDetail(o.orderId);
          await orderHistoryDetailPage.openReopenDialog();
          await orderHistoryDetailPage.pressReopenConfirm();
          await gateProbe
            .waitOpen(2_000)
            .then(async (up) => (up ? gateProbe.submit(ownerCode()) : undefined));
          await waitUntilPath((p) => p.startsWith(`/order/${o.orderId}/checkout`), {
            timeout: Timeouts.NAVIGATION,
            message: 'Continue Re-open never reached checkout',
          });
        });
        await checkoutPage.waitForReady(Timeouts.MEDIUM);
        await finishReopenUnchanged(o.orderId);
        reopened = false;
      } finally {
        if (reopened) await finishReopenUnchanged(o.orderId).catch(() => undefined);
      }
      const after = await dailyUntil((s) => rowsFor(s, o.orderNumber).length === 1);
      expect(rowsFor(after, o.orderNumber).length).toBe(1);
    },
  );

  it(
    title(
      'Daily Sale: the Total Payment card, Income Details and Payment Details agree (RPT-187)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      const s = await dailySnapshot(0);
      if (!s.detail) this.skip();
      const card = cardValue(s, 'Total Payment');
      expect(s.detail?.incomeTotal).toBe(s.detail?.paymentTotal);
      if (Number.isFinite(card)) expect(card).toBe(s.detail?.paymentTotal);
    },
  );

  it(
    title('Daily Sale money renders as $#,##0.00 on cards, table and detail (RPT-193)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      await openDaily(0);
      const text = `${await paneText(RptCss.leftPane)} ${await paneText(RptCss.rightPane)}`;
      const money = text.match(/-?\$[\d,]*\.?\d*/g) ?? [];
      if (money.length === 0) this.skip();
      const bad = money.filter((m) => !/^-?\$\d{1,3}(,\d{3})*\.\d{2}$/.test(m));
      expect(bad).toEqual([]);
    },
  );

  it(
    title(
      'Order Details from a Daily Sale row shows that order; X, Escape and an outside click all close it and keep the report (RPT-190)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openDaily(0);
      const route = await gateProbe.path();
      for (const how of ['x', 'escape', 'outside'] as const) {
        if (!(await clickRow(RptCss.rightPane, /OD\d{6}-\d+/))) this.skip();
        expect(await waitOrderDetails(true)).toBe(true);
        expect(await orderDetailsText()).toMatch(/OD\d{6}-\d+/);
        if (how === 'escape') await browser.keys([Key.Escape]);
        else if (how === 'x') {
          await browser.execute(function () {
            const d = Array.from(document.querySelectorAll('[role="dialog"]')).pop();
            const b = d?.querySelector<HTMLButtonElement>(
              'button[aria-label="Close"], button[data-slot="dialog-close"]',
            );
            b?.click();
          });
        } else await voltQcProbe.clickAt(5, 5);
        const closed = await waitOrderDetails(false, Timeouts.SHORT);
        if (!closed) await closeOrderDetails();
        expect({ how, closed }).toEqual({ how, closed: true });
        expect(await gateProbe.path()).toBe(route);
      }
    },
  );

  it(
    title('Daily Sale opened by URL keeps the requested day and chart (RPT-191)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      const yesterday: UnixRange = rangeOffset(-1);
      await openDaily(yesterday, 'tip');
      expect(await searchParam('activeChart')).toBe('tip');
      expect(Number(await searchParam('from'))).toBe(yesterday.from);
      const d = new Date(yesterday.from * 1000);
      const label = await dateRangeText();
      log.info(`RPT-191 date range label: ${label}`);
      expect(label).toContain(String(d.getDate()));
    },
  );

  /* ------------------------ cross-report deltas -------------------------- */

  it(
    title(
      'One new Cash order moves Daily Sale, Income Summary and Staff Income together; Summary Total = Sale + Tip + Tax (RPT-088, RPT-127, RPT-179)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 3);
      const today = rangeOffset(0);
      const d0 = await dailySnapshot(0);
      await openSummary(today);
      const s0 = (await summaryState()).rows[0];
      await openStaffIncome(today);
      const i0 = await staffList();

      const o = await settleCashOrder();

      const d1 = await dailyUntil((s) => rowsFor(s, o.orderNumber).length === 1);
      const row = rowsFor(d1, o.orderNumber)[0];
      expect(row?.total).toBe(o.totalCents);
      expect(cardValue(d1, 'Sale') - cardValue(d0, 'Sale')).toBeGreaterThanOrEqual(row?.sale ?? 0);

      await openSummary(today);
      const s1 = (await summaryState()).rows[0];
      expect((s1?.sale ?? 0) - (s0?.sale ?? 0)).toBeGreaterThanOrEqual(row?.sale ?? 0);
      expect(s1?.total).toBe((s1?.sale ?? 0) + (s1?.tip ?? 0) + (s1?.tax ?? 0));

      await openStaffIncome(today);
      const i1 = await staffList();
      expect(i1.summary.totalOrders - i0.summary.totalOrders).toBeGreaterThanOrEqual(1);
      expect(i1.summary.totalSubtotal - i0.summary.totalSubtotal).toBeGreaterThan(0);
    },
  );

  it(
    title('A voided order leaves Staff Income (orders count back) (RPT-130)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      const today = rangeOffset(0);
      const o = await settleCashOrder();
      await openStaffIncome(today);
      const withOrder = await staffList();
      await openHistoryDetail(o.orderId);
      await orderHistoryDetailPage.cancelOrder('customer_request');
      await gateProbe.submit(ownerCode()).catch(() => undefined);
      expect(await toastShown(AspText.orderCanceled, Timeouts.API)).toBe(true);
      let after = withOrder;
      const end = Date.now() + 60_000;
      while (Date.now() < end) {
        await openStaffIncome(today);
        after = await staffList();
        if (after.summary.totalOrders < withOrder.summary.totalOrders) break;
        await settle(3_000);
      }
      expect(after.summary.totalOrders).toBeLessThan(withOrder.summary.totalOrders);
    },
  );
});
