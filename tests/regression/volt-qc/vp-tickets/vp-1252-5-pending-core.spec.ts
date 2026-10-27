/**
 * VP-1252-5 — Pending Order core rules (volt-qc per-ticket file
 * `docs/qc/volt-qc/vp-tickets/VP-1252-5-test-cases.md`, TC 1–5).
 *
 * Kept in its own file on purpose: the coverage script keys this sheet as
 * `VP-1252-5 TC-nn`, and the sibling pending-order spec must not name these
 * row numbers or it would claim rows of the other sheet.
 *
 * Automated: a walk-in draft (TC-01) is pending — in the queue, absent from the
 * revenue report — and once paid in cash it leaves the queue and enters the
 * report (TC-05). The other rows (appointment / GoCheckin sources, overnight
 * order date) are manual pending stubs in tests/regression/volt-qc/_manual/.
 *
 * CREATES DATA: one draft, settled in cash. dev / staging only.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { ReportService } from '../../../../src/api/index.js';
import { PENDING_ORDER_CODE } from '../../../../src/constants/testids.orders.js';
import { createOrder, payInCash, returnToHome } from '../../../../src/flows/index.js';
import { checkoutPage, homePage, orderPendingPage } from '../../../../src/pages/index.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { voidAnyDraft } from './vp-tickets.helpers.js';

const reports = new ReportService();

describe('VP-1252-5 — Pending Order core rules', () => {
  let orderId = '';
  let orderCode = '';
  let paid = false;

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create a walk-in pending order');
    await voidAnyDraft();
    ({ orderId } = await createOrder());
    await checkoutPage.waitForReady();
    const header = await checkoutPage.orderNumber();
    orderCode = PENDING_ORDER_CODE.exec(header)?.[0] ?? header.replace(/^.*#/, '').trim();
    await returnToHome();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    if (orderCode && !paid) {
      await orderPendingPage.open().catch(() => undefined);
      if (await orderPendingPage.isOrderListed(orderCode).catch(() => false)) {
        await orderPendingPage.openOrder(orderCode).catch(() => undefined);
        await returnToHome().catch(() => undefined);
        if (await homePage.hasActiveDraft().catch(() => false)) await homePage.deleteOrder();
      }
    }
    await returnToHome();
  });

  it(
    title(
      'VP-1252-5 TC-01 A manual walk-in order is a Pending Order: queued, not in the report',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await orderPendingPage.open();
      expect(await orderPendingPage.isOrderListed(orderCode)).toBe(true);
      const orders = await reports.storeOrders(new Date());
      expect(orders.some((o) => o.orderId === orderId)).toBe(false);
    },
  );

  it(
    title(
      'VP-1252-5 TC-05 Once paid it leaves the Pending queue and enters the report',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await orderPendingPage.open();
      await orderPendingPage.openOrder(orderCode);
      await returnToHome();
      await homePage.pressPay();
      await checkoutPage.waitForReady();
      const success = await payInCash(orderId);
      paid = true;
      await success.continueToNextOrder();
      await success.waitForFlowToEnd();

      await returnToHome();
      await orderPendingPage.open();
      await orderPendingPage.waitForOrderGone(orderCode, Timeouts.LONG);
      expect(await orderPendingPage.isOrderListed(orderCode)).toBe(false);

      let inReport = false;
      await browser
        .waitUntil(
          async () => (inReport = (await reports.storeOrders(new Date())).some((o) => o.orderId === orderId)),
          { timeout: Timeouts.API * 2, interval: 3_000 },
        )
        .catch(() => undefined);
      expect(inReport).toBe(true);
    },
  );
});
