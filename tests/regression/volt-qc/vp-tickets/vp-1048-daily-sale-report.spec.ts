/**
 * VP-1048 — Daily Sale Report & Income/Payment Detail (volt-qc per-ticket file
 * `docs/qc/volt-qc/vp-tickets/VP-1048-daily-sale-report-test-cases.md`, TC 1–44).
 *
 * ## Ids
 *
 * VP-1048 has TWO sheets (this one and VP-1048-income-summary.md) whose rows are
 * both numbered 1…; the coverage matcher keys both by `VP-1048`. Titles here say
 * `VP-1048 DSR TC-nn` and the Income Summary spec says `VP-1048 IS TC-nn`, so a
 * reader can tell them apart even though the matcher cannot.
 *
 * ## How the numbers are asserted
 *
 * The sheet's dollar figures came from one merchant's day. The spec instead
 * reconciles what the screen shows with what the app's own query returned
 * (`ReportService` → `vReportStoreDailyIncomeList`, the document the screen
 * renders from), and recomputes the rollups from their parts — the pattern of
 * tests/regression/incomes/daily-sale-report.spec.ts. A day with no activity
 * skips the reconciliation cases with that reason rather than "passing" 0 = 0.
 *
 * Read-only except TC-38, which settles ONE cash order (Tag.WRITE) to prove
 * today's report is live.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { cents, ReportService } from '../../../../src/api/index.js';
import type { StoreDailyIncomeRow } from '../../../../src/api/index.js';
import { passcodeDialog } from '../../../../src/components/index.js';
import { Routes } from '../../../../src/constants/routes.js';
import { createOrder, payInCash, returnToHome } from '../../../../src/flows/index.js';
import { goTo } from '../../../../src/helpers/navigate.js';
import { step } from '../../../../src/helpers/steps.js';
import { incomeDailyPage } from '../../../../src/pages/index.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../../src/utils/money.js';

const reports = new ReportService();
const CARDS = ['totalOrder', 'sale', 'totalTip', 'totalPayment'] as const;
const MONEY_CARDS = ['sale', 'totalTip', 'totalPayment'] as const;
const EMPTY_DAY = new Date(2001, 0, 1);

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

describe('VP-1048 DSR — Daily Sale Report', () => {
  const today = new Date();
  let row: StoreDailyIncomeRow | null = null;

  /** Skip a reconciliation case on a day with no report row, naming why. */
  const needRow = (ctx: Mocha.Context): StoreDailyIncomeRow => {
    if (row === null) {
      ctx.skip();
      throw new Error('unreachable: no daily-income row for today — take a payment and re-run');
    }
    return row;
  };

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await incomeDailyPage.open(today);
    row = await reports.storeDay(today);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await ensurePasscodeGrant();
    await returnToHome();
  });

  it(
    title(
      'VP-1048 DSR TC-01 Opens on today with the 4 cards (Total Order, Sale, Total Tip, Total Payment)',
      Tag.REGRESSION,
    ),
    async () => {
      await incomeDailyPage.open(today);
      expect(await incomeDailyPage.currentPath()).toBe(Routes.INCOME_DAILY);
      expect(Number.isInteger(await incomeDailyPage.cardCount('totalOrder'))).toBe(true);
      for (const card of MONEY_CARDS)
        expect(Number.isInteger(await incomeDailyPage.cardCents(card))).toBe(true);
      expect(await incomeDailyPage.activeChart()).toBe('sale');
    },
  );

  it(
    title('VP-1048 DSR TC-02 Total Order equals the report count (cancel/refund excluded)', Tag.REGRESSION),
    async function () {
      const r = needRow(this);
      expect(await incomeDailyPage.cardCount('totalOrder')).toBe(r.numberOrder ?? 0);
    },
  );

  it(
    title('VP-1048 DSR TC-04 Sale card equals the report Sale (after discount, no tip/tax)', Tag.REGRESSION),
    async function () {
      const r = needRow(this);
      expectCentsEqual(
        await incomeDailyPage.cardCents('sale'),
        cents(r.dailySaleSale),
        'DSR Sale card vs dailySaleSale',
      );
    },
  );

  it(title('VP-1048 DSR TC-06 Total Tip card equals the report Tip', Tag.REGRESSION), async function () {
    const r = needRow(this);
    expectCentsEqual(
      await incomeDailyPage.cardCents('totalTip'),
      cents(r.dailySaleTip),
      'DSR Total Tip vs dailySaleTip',
    );
  });

  it(
    title(
      'VP-1048 DSR TC-08 Total Payment card = Amount Collected + Gift Card Redemption',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function () {
      const r = needRow(this);
      expectCentsEqual(
        await incomeDailyPage.cardCents('totalPayment'),
        reports.computeTotals(r).paymentTotalPayment,
        'DSR Total Payment card vs Card + Cash + Others + Gift Card Redemption',
      );
    },
  );

  it(
    title(
      'VP-1048 DSR TC-10 "vs Yesterday" % matches (today − yesterday) / yesterday on the Sale card',
      Tag.REGRESSION,
    ),
    async function () {
      const r = needRow(this);
      const y = await reports.storeDay(daysAgo(1));
      const yesterday = cents(y?.dailySaleSale);
      if (yesterday === 0) this.skip(); // TC-42 owns the divide-by-zero case.
      const text = await incomeDailyPage.cardPercentText('sale');
      const shown = Number.parseFloat(text.replace(/[^\d.]/g, ''));
      const expected = Math.abs(((cents(r.dailySaleSale) - yesterday) / yesterday) * 100);
      expect(Number.isFinite(shown)).toBe(true);
      expect(Math.abs(shown - expected)).toBeLessThanOrEqual(1);
    },
  );

  it(
    title('VP-1048 DSR TC-12 Picking a past day reloads the cards for that day', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      // The past day with activity closest to today (the picker writes from/to; so does open()).
      let day: Date | null = null;
      let past: StoreDailyIncomeRow | null = null;
      for (let back = 1; back <= 14 && past === null; back += 1) {
        const candidate = daysAgo(back);
        const found = await reports.storeDay(candidate);
        if (found && (found.numberOrder ?? 0) > 0) {
          day = candidate;
          past = found;
        }
      }
      if (!day || !past) this.skip();
      try {
        await incomeDailyPage.open(day ?? today);
        expect(await incomeDailyPage.cardCount('totalOrder')).toBe(past?.numberOrder ?? 0);
        expectCentsEqual(
          await incomeDailyPage.cardCents('sale'),
          cents(past?.dailySaleSale),
          'DSR past-day Sale',
        );
      } finally {
        await incomeDailyPage.open(today);
      }
    },
  );

  it(
    title(
      'VP-1048 DSR TC-13 A day with no orders shows 0 / $0.00 everywhere and an empty table',
      Tag.REGRESSION,
    ),
    async () => {
      try {
        await incomeDailyPage.open(EMPTY_DAY);
        expect(await incomeDailyPage.cardCount('totalOrder')).toBe(0);
        for (const card of MONEY_CARDS) expect(await incomeDailyPage.cardCents(card)).toBe(0);
        expect(await incomeDailyPage.orderRowCount()).toBe(0);
      } finally {
        await incomeDailyPage.open(today);
      }
    },
  );

  it(
    title('VP-1048 DSR TC-14 Order # column shows order codes (OD######-########)', Tag.REGRESSION),
    async function () {
      needRow(this);
      const codes = await incomeDailyPage.orderCodes();
      expect(codes.length).toBeGreaterThan(0);
      for (const code of codes) expect(code).toMatch(/^OD\d{6}-\d+$/);
    },
  );

  it(
    title(
      'VP-1048 DSR TC-18 Every order row: Total = Sale/Refund + Tip + Tax (data the table renders)',
      Tag.REGRESSION,
    ),
    async function () {
      needRow(this);
      const orders = await reports.storeOrders(today);
      const bad = orders.filter((o) => {
        const tax = cents(o.taxAmount);
        const signed = o.saleAmount - o.refundAmount + o.tipAmount + tax;
        const absolute = o.saleAmount + o.refundAmount + o.tipAmount + tax; // refund already negative
        return o.total !== signed && o.total !== absolute;
      });
      expect(bad.map((o) => `${o.orderId}/${o.transactionType}: total ${String(o.total)}`)).toEqual([]);
    },
  );

  it(
    title(
      'VP-1048 DSR TC-19 Income Detail Total Payment = Sale + Tip + Tax Collected',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    function () {
      const r = needRow(this);
      const t = reports.computeTotals(r);
      expectCentsEqual(
        cents(r.incomeTotalPayment),
        t.incomeTotalPayment,
        'incomeTotalPayment vs Sale + Tip + Tax',
      );
    },
  );

  it(
    title('VP-1048 DSR TC-20 Payment Detail Amount Collected = Card + Cash + Others', Tag.REGRESSION),
    function () {
      const r = needRow(this);
      expectCentsEqual(
        cents(r.dailySalePaymentAmountCollected),
        reports.computeTotals(r).paymentAmountCollected,
        'dailySalePaymentAmountCollected vs Card + Cash + Others',
      );
    },
  );

  it(
    title(
      'VP-1048 DSR TC-21 TOTAL PAYMENT agrees in Payment Detail, Income Detail and the card',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function () {
      const r = needRow(this);
      const t = reports.computeTotals(r);
      expectCentsEqual(
        t.paymentTotalPayment,
        t.incomeTotalPayment,
        'Payment Detail vs Income Detail Total Payment',
      );
      expectCentsEqual(
        await incomeDailyPage.cardCents('totalPayment'),
        t.paymentTotalPayment,
        'card vs Payment Detail',
      );
    },
  );

  it(
    title('VP-1048 DSR TC-26 Every money card parses as a 2-decimal currency amount', Tag.REGRESSION),
    async () => {
      // parseMoney rejects anything that is not one "$#,##0.00" amount (or blank).
      for (const card of MONEY_CARDS)
        expect(Number.isInteger(await incomeDailyPage.cardCents(card))).toBe(true);
    },
  );

  for (const [tc, chart] of [
    ['VP-1048 DSR TC-27', 'totalOrder'],
    ['VP-1048 DSR TC-28', 'totalTip'],
    ['VP-1048 DSR TC-29', 'totalPayment'],
  ] as const) {
    it(
      title(`${tc} Clicking the ${chart} card moves the chart and activeChart=${chart}`, Tag.REGRESSION),
      async () => {
        const before = await incomeDailyPage.chartHeadingText();
        await incomeDailyPage.selectCard(chart);
        expect(await incomeDailyPage.activeChart()).toBe(chart);
        expect(await incomeDailyPage.chartHeadingText()).not.toBe(before);
        await incomeDailyPage.selectCard('sale');
      },
    );
  }

  it(title('VP-1048 DSR TC-30 Exactly one card is visually active at a time', Tag.REGRESSION), async () => {
    for (const chart of CARDS) {
      await incomeDailyPage.selectCard(chart);
      const active: string[] = [];
      for (const c of CARDS) if (await incomeDailyPage.isCardSelected(c)) active.push(c);
      expect(active).toEqual([chart]);
    }
    await incomeDailyPage.selectCard('sale');
  });

  it(
    title(
      'VP-1048 DSR TC-32 Without a passcode grant the report is held behind the passcode guard',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await returnToHome();
      await clearPasscodeGrant();
      await goTo(Routes.INCOME_DAILY);
      try {
        expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(true);
      } finally {
        await passcodeDialog.enterIfPresent(env.OWNER_PASSCODE, { skipForNext30Min: true });
        await ensurePasscodeGrant();
      }
    },
  );

  it(
    title('VP-1048 DSR TC-33 A wrong passcode keeps the dialog open and the report hidden', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await returnToHome();
      await clearPasscodeGrant();
      await goTo(Routes.INCOME_DAILY);
      try {
        expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(true);
        const wrong = env.OWNER_PASSCODE === '0000' ? '1111' : '0000';
        await passcodeDialog.enter(wrong, { timeout: Timeouts.SHORT }).catch(() => undefined);
        expect(await passcodeDialog.isPrompting(Timeouts.SHORT)).toBe(true);
      } finally {
        await passcodeDialog
          .enterIfPresent(env.OWNER_PASSCODE, { skipForNext30Min: true })
          .catch(() => false);
        await ensurePasscodeGrant();
      }
    },
  );

  it(
    title(
      'VP-1048 DSR TC-34 "Do not require passcode for 30 minutes" lets the next visit in without a prompt',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await returnToHome();
      await clearPasscodeGrant();
      await goTo(Routes.INCOME_DAILY);
      await passcodeDialog.enter(env.OWNER_PASSCODE, { skipForNext30Min: true });
      await returnToHome();
      await goTo(Routes.INCOME_DAILY);
      // The "after 30 minutes it prompts again" half waits out the window — manual.
      expect(await passcodeDialog.isPrompting(Timeouts.SHORT)).toBe(false);
      await ensurePasscodeGrant();
    },
  );

  it(
    title('VP-1048 DSR TC-35 Clicking an order row opens its detail dialog', Tag.REGRESSION),
    async function () {
      needRow(this);
      await incomeDailyPage.open(today);
      const [first] = await incomeDailyPage.orderCodes();
      if (!first) this.skip();
      await incomeDailyPage.openOrderDetail(first ?? '');
      expect(await browser.getUrl()).toContain('orderId=');
      await incomeDailyPage.closeOrderDetail();
    },
  );

  it(
    title(
      'VP-1048 DSR TC-36 Escape closes the dialog, the table stays and another row opens',
      Tag.REGRESSION,
    ),
    async function () {
      needRow(this);
      await incomeDailyPage.open(today);
      const codes = await incomeDailyPage.orderCodes();
      const [first, second] = codes;
      if (!first) this.skip();
      await incomeDailyPage.openOrderDetail(first ?? '');
      await incomeDailyPage.closeOrderDetail();
      expect(await incomeDailyPage.orderCodes()).toEqual(codes);
      await incomeDailyPage.openOrderDetail(second ?? first ?? '');
      await incomeDailyPage.closeOrderDetail();
    },
  );

  it(
    title(
      'VP-1048 DSR TC-38 Today is live: a new cash order raises Total Order by 1',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await incomeDailyPage.open(today);
      const before = await incomeDailyPage.cardCount('totalOrder');

      await step('Settle one cash order', async () => {
        await returnToHome();
        const { orderId } = await createOrder();
        const success = await payInCash(orderId);
        await success.continueToNextOrder();
        await success.waitForFlowToEnd();
      });

      let after = before;
      const deadline = Date.now() + Timeouts.API * 2;
      while (Date.now() < deadline && after <= before) {
        await incomeDailyPage.open(today);
        after = await incomeDailyPage.cardCount('totalOrder');
      }
      expect(after).toBe(before + 1);
    },
  );

  it(
    title('VP-1048 DSR TC-42 No "Infinity%" / "NaN%" on any vs-Yesterday badge', Tag.REGRESSION),
    async () => {
      await incomeDailyPage.open(today);
      for (const card of CARDS)
        expect(await incomeDailyPage.cardPercentText(card)).not.toMatch(/Infinity|NaN|999999/);
    },
  );
});
