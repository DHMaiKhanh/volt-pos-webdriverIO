/**
 * Daily Sale Report — the screen against the SCHEMA.
 *
 * ## The pattern this file establishes
 *
 * Every other income spec should be shaped like this one. The report renders
 * derived money, so the only assertion with teeth compares what the screen shows
 * to what the app's own query returned:
 *
 *   1. `ReportService` fetches `vReportStoreDailyIncomeList` — the exact
 *      document `income-daily.gql.ts` renders from.
 *   2. The page object reads the cards.
 *   3. The two are compared in integer cents.
 *
 * Comparing a card to another card on the same screen would prove only that the
 * screen agrees with itself; comparing a card to a total the same backend also
 * computed proves only that the screen can read. Recomputing the total from its
 * parts (`computeTotals`) and comparing THAT is what catches a rollup that has
 * drifted from the figures it is supposed to summarise.
 *
 * ## Read-only
 *
 * Nothing here creates an order, a payment or a refund, so it is safe on any
 * environment. It is tagged `@regression` rather than `@smoke` only because it
 * needs the passcode gate unlocked, which `@smoke` deliberately avoids.
 *
 * ## An empty day is not a failure
 *
 * A merchant with no orders today returns no row at all, and every figure would
 * be a legitimate zero. That is a real state the app renders on purpose, so the
 * spec says so and stops rather than asserting `0 === 0` and reporting a pass
 * that tested nothing.
 */

import { expect } from '@wdio/globals';
import { cents, ReportService } from '../../../src/api/index.js';
import type { StoreDailyIncomeRow } from '../../../src/api/index.js';
import { incomeDailyPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../src/utils/money.js';

const reports = new ReportService();

describe('Daily Sale Report', () => {
  const today = new Date();
  let row: StoreDailyIncomeRow | null = null;

  before(async () => {
    await incomeDailyPage.open(today);
    row = await reports.storeDay(today);
  });

  it(title('The Sale card matches the schema', Tag.REGRESSION, Tag.CRITICAL), async () => {
    if (row === null) {
      throw new Error(
        'The merchant has no daily-income row for today, so there is nothing to reconcile. ' +
          'Take one payment on this till (or point MERCHANT_ID at a shop with activity) and ' +
          're-run — asserting on an absent row would pass without testing anything.',
      );
    }

    expectCentsEqual(
      await incomeDailyPage.cardCents('sale'),
      cents(row.dailySaleSale),
      'Daily Sale Report: the Sale card vs vReportStoreDailyIncomeList.dailySaleSale',
    );
  });

  it(title('The Total Tip card matches the schema', Tag.REGRESSION), async () => {
    if (row === null) return;

    expectCentsEqual(
      await incomeDailyPage.cardCents('totalTip'),
      cents(row.dailySaleTip),
      'Daily Sale Report: the Total tip card vs dailySaleTip',
    );
  });

  it(
    title('Total Payment equals its parts, not just the rollup column', Tag.REGRESSION, Tag.CRITICAL),
    async () => {
      if (row === null) return;

      const derived = reports.computeTotals(row);

      // The screen's own figure.
      expectCentsEqual(
        await incomeDailyPage.cardCents('totalPayment'),
        derived.paymentTotalPayment,
        'Daily Sale Report: the Total Payment card vs Card + Cash + Others + Gift Card',
      );

      // And the backend's rollup against the same recomputation. A mismatch
      // here is a backend defect the screen would have shown faithfully — worth
      // separating from a rendering bug, which is why it is its own assertion.
      expectCentsEqual(
        cents(row.dailySaleTotalPayment),
        derived.paymentTotalPayment,
        'vReportStoreDailyIncomeList.dailySaleTotalPayment vs the sum of its tender columns',
      );
    },
  );

  it(title('Selecting a card moves the chart and the URL together', Tag.REGRESSION), async () => {
    await incomeDailyPage.selectCard('totalOrder');
    expect(await incomeDailyPage.activeChart()).toBe('totalOrder');

    // The heading is translated, so the assertion is that it CHANGED rather
    // than that it equals an English string — this spec has to pass on a
    // Vietnamese till too.
    const headingAfterOrder = await incomeDailyPage.chartHeadingText();

    await incomeDailyPage.selectCard('sale');
    expect(await incomeDailyPage.activeChart()).toBe('sale');
    expect(await incomeDailyPage.chartHeadingText()).not.toBe(headingAfterOrder);
  });

  it(title("The orders table lists exactly the day's orders", Tag.REGRESSION), async () => {
    if (row === null) return;

    const orders = await reports.storeOrders(today);
    const uniqueOrderIds = new Set(orders.map((order) => order.orderId));

    // The table shows one row per ORDER; the report view holds one row per
    // order-and-transaction-type, so an order that was partly refunded
    // contributes two. Comparing raw lengths would fail on any refunded day.
    expect(await incomeDailyPage.orderRowCount()).toBe(uniqueOrderIds.size);
  });
});
