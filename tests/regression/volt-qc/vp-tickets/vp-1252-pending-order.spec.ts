/**
 * VP-1252 — Pending Order (volt-qc per-ticket files
 * `docs/qc/volt-qc/vp-tickets/VP-1252-pending-order-test-cases.md` (TC 1–20) and
 * the 5-row core-rules sheet, see vp-1252-5-pending-core.spec.ts).
 *
 * The second sheet (the 5-row core-rules file) has its own coverage key and its
 * own spec: vp-1252-5-pending-core.spec.ts.
 *
 * Automated: one walk-in draft is created (no payment) and driven through the
 * queue — listed as Processing, searchable, re-openable, editable, absent from
 * Order History and from the revenue report — then paid in cash, after which it
 * must leave the queue and appear in Order History.
 *
 * Manual: appointment / GoCheckin sources (web lane + a check-in kiosk), the
 * source/tag filter and the left mini list (no page-object handle), and the
 * offline rows (network cut).
 *
 * CREATES DATA: one draft, settled in cash by TC-18. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { ReportService } from '../../../../src/api/index.js';
import { Routes } from '../../../../src/constants/routes.js';
import {
  PENDING_DATE_PRESET_TODAY,
  PENDING_STATUS_PROCESSING,
} from '../../../../src/constants/testids.order-pending.js';
import { PENDING_ORDER_CODE } from '../../../../src/constants/testids.orders.js';
import { createOrder, goToOrderHistory, payInCash, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { waitUntilPath } from '../../../../src/helpers/wait.js';
import { checkoutPage, homePage, orderHistoryPage, orderPendingPage } from '../../../../src/pages/index.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { voidAnyDraft } from './vp-tickets.helpers.js';

const reports = new ReportService();

async function reopenFromQueue(code: string): Promise<void> {
  await orderPendingPage.open();
  await orderPendingPage.clearSearch().catch(() => undefined);
  await orderPendingPage.openOrder(code);
  await waitUntilPath((path) => !path.startsWith(Routes.ORDER_PENDING), {
    timeout: Timeouts.NAVIGATION,
    message: `Opening pending order ${code} did not leave the queue`,
  });
}

describe('VP-1252 — Pending Order', () => {
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
      await reopenFromQueue(orderCode).catch(() => undefined);
      await returnToHome().catch(() => undefined);
      if (await homePage.hasActiveDraft().catch(() => false)) await homePage.deleteOrder();
    }
    await returnToHome();
  });

  it(
    title(
      'VP-1252 TC-01 A walk-in order created on Home lands in the Pending queue',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await orderPendingPage.open();
      expect(orderCode).toMatch(PENDING_ORDER_CODE);
      expect(await orderPendingPage.isOrderListed(orderCode)).toBe(true);
    },
  );

  it(
    title(
      'VP-1252 TC-06 The queue header carries Search, Staff, Sort, Date and Quick Checkout',
      Tag.REGRESSION,
    ),
    async () => {
      await orderPendingPage.open();
      expect(await orderPendingPage.toolbarVisibility()).toEqual({
        search: true,
        staffFilter: true,
        sort: true,
        datePreset: true,
        dateRange: true,
        quickCheckout: true,
      });
      expect(await orderPendingPage.isQuickCheckoutEnabled()).toBe(true);
    },
  );

  it(
    title('VP-1252 TC-07 A pending card shows its code and "Processing"', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await orderPendingPage.open();
      const card = (await orderPendingPage.cardText(orderCode)) ?? '';
      expect(card).toContain(orderCode);
      expect(PENDING_STATUS_PROCESSING.some((s) => card.includes(s))).toBe(true);
    },
  );

  it(
    title('VP-1252 TC-08 Searching the code narrows the queue to it', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await orderPendingPage.open();
      const fragment = orderCode.split('-')[1] ?? orderCode;
      try {
        await orderPendingPage.search(fragment);
        const codes = await orderPendingPage.orderCodes();
        expect(codes).toContain(orderCode);
        expect(codes.filter((c) => !c.includes(fragment))).toEqual([]);
      } finally {
        await orderPendingPage.clearSearch();
      }
    },
  );

  it(title('VP-1252 TC-09 The date filter defaults to Today', Tag.REGRESSION), async () => {
    await orderPendingPage.open();
    expect(PENDING_DATE_PRESET_TODAY).toContain(await orderPendingPage.datePresetLabel());
    expect(await orderPendingPage.dateRangeLabel()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it(
    title('VP-1252 TC-11 Opening a card leaves the queue for the order workspace', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await reopenFromQueue(orderCode);
      expect(await homePage.currentPath()).not.toMatch(/^\/order-pending/);
      await returnToHome();
      expect(await homePage.hasActiveDraft()).toBe(true);
    },
  );

  it(
    title(
      'VP-1252 TC-13 Editing the service price on the pending order updates its total',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await reopenFromQueue(orderCode);
      await returnToHome();
      const before = await homePage.cartTotal();
      await homePage.openServiceEditor();
      await homePage.setServiceEditorPrice(before + 1_000);
      await homePage.saveServiceEditor();
      expect(await homePage.cartTotal()).toBe(before + 1_000);
    },
  );

  it(
    title('VP-1252 TC-16 A pending order is NOT listed in Order History', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await goToOrderHistory();
      await orderHistoryPage.search(orderCode);
      expect(await orderHistoryPage.findRowByOrderId(orderId)).toBeNull();
      await orderHistoryPage.clearSearch();
    },
  );

  it(
    title('VP-1252 TC-17 A pending order is NOT in the revenue report', Tag.REGRESSION, Tag.WRITE),
    async () => {
      const orders = await reports.storeOrders(new Date());
      expect(orders.filter((o) => o.orderId === orderId)).toEqual([]);
    },
  );

  it(
    title(
      'VP-1252 TC-18 Payment success completes the order: it leaves the queue and enters Order History',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await step('Re-open the pending order and pay it in cash', async () => {
        await reopenFromQueue(orderCode);
        await returnToHome();
        await homePage.pressPay();
        await checkoutPage.waitForReady();
        const success = await payInCash(orderId);
        paid = true;
        await success.continueToNextOrder();
        await success.waitForFlowToEnd();
      });

      await returnToHome();
      await orderPendingPage.open();
      await orderPendingPage.waitForOrderGone(orderCode, Timeouts.LONG);
      expect(await orderPendingPage.isOrderListed(orderCode)).toBe(false);

      await goToOrderHistory();
      await orderHistoryPage.searchUntil(orderCode, (ids) => ids.includes(orderId), Timeouts.LONG);
      expect(await orderHistoryPage.findRowByOrderId(orderId)).not.toBeNull();
    },
  );
});
