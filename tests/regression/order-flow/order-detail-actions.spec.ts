/**
 * The order-history detail pane and its action bar, for a just-settled order.
 *
 * A cash sale is created and settled in the hook, so the order under test is
 * "Successful - Unsettled" — the richest action state (Cancel / Re-Open / Adjust
 * Tip / Receipt), and the only status this suite can reach in one run without a
 * batch close (which happens the next merchant day).
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-79  the detail pane renders its sections and the charged total
 *   - TC-ORDERFLOW-55  an unsettled order offers Cancel / Re-Open, not Refund
 *   - TC-ORDERFLOW-64  Cancel Order opens its reason dialog
 *   - TC-ORDERFLOW-54  the list filter dialog opens beside the detail pane
 *
 * Pending on order statuses a single run cannot manufacture — a settled/batched
 * order, a cancelled one, a refunded one:
 *   - TC-ORDERFLOW-56  Settled → Receipt + (combined) Refund
 *   - TC-ORDERFLOW-57  Canceled → Receipt + voided payment detail
 *   - TC-ORDERFLOW-58  Refunded → Receipt + Refund Information
 *   - TC-ORDERFLOW-59  Partial Refunded → Receipt / Refund / Partial Refund
 *
 * CREATES DATA AND TAKES A PAYMENT: leaves one settled order in history (the
 * cancel dialog is opened but never confirmed). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { createOrder, goToOrderHistory, payInCash, returnToHome } from '../../../src/flows/index.js';
import {
  checkoutPage,
  homePage,
  orderHistoryDetailPage,
  orderHistoryPage,
} from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { formatMoney } from '../../../src/utils/money.js';

describe('Order flow — Order detail actions', () => {
  let orderId = '';
  let paidTotalCents = 0;

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);

    await returnToHome();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();

    const created = await createOrder();
    orderId = created.orderId;
    await checkoutPage.waitForReady();
    paidTotalCents = await checkoutPage.totalCents();

    const success = await payInCash(orderId, { tenderedCents: paidTotalCents });
    await success.continueToNextOrder();
    await success.waitForFlowToEnd();

    await returnToHome();
    await goToOrderHistory();
    await orderHistoryPage.openOrder(orderId);
    await orderHistoryDetailPage.waitForOrder(orderId);
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title(
      'The detail pane renders its sections and the charged total (TC-ORDERFLOW-79)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const information = await orderHistoryDetailPage.readInformation();
      expect(information.length).toBeGreaterThan(0);

      // The summary is where the cashier reads the charge back, formatting included.
      expect(paidTotalCents).toBeGreaterThan(0);
      expect(await orderHistoryDetailPage.readSummary()).toContain(formatMoney(paidTotalCents));
    },
  );

  it(
    title(
      'An unsettled order offers Cancel / Re-Open, not Refund (TC-ORDERFLOW-55)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      // Settled-only actions must be absent while the order is unsettled...
      expect(await orderHistoryDetailPage.isRefundAvailable()).toBe(false);
      // ...and the unsettled actions present.
      expect(await orderHistoryDetailPage.isCancelAvailable()).toBe(true);
      expect(await orderHistoryDetailPage.isReopenAvailable()).toBe(true);
      // One staff on the order, so no tip to split.
      expect(await orderHistoryDetailPage.isSplitTipAvailable()).toBe(false);
    },
  );

  it(title('Cancel Order opens its reason dialog (TC-ORDERFLOW-64)', Tag.REGRESSION, Tag.WRITE), async () => {
    expect(await orderHistoryDetailPage.isCancelAvailable()).toBe(true);

    await orderHistoryDetailPage.openCancelDialog();
    expect(await orderHistoryDetailPage.isCancelDialogShown()).toBe(true);

    // Do NOT confirm — cancelling voids the payment and needs the passcode
    // guard. Opening the dialog is the coverage; close it and leave the order.
    await orderHistoryDetailPage.closeCancelDialog();
  });

  it(
    title('The list filter dialog opens beside the detail pane (TC-ORDERFLOW-54)', Tag.REGRESSION),
    async () => {
      // The list frame stays mounted under the detail pane (a layout route), so
      // its filter is reachable without navigating away.
      await orderHistoryPage.openFilter();
      expect(await orderHistoryPage.isFilterDialogShown()).toBe(true);
      await orderHistoryPage.closeFilter();
    },
  );

  it(title('TC-ORDERFLOW-56: Settled → Receipt + Refund — PENDING (needs a batched/settled order)'));

  it(title('TC-ORDERFLOW-57: Canceled → Receipt + voided payment — PENDING (needs a cancelled order)'));

  it(title('TC-ORDERFLOW-58: Refunded → Receipt + Refund Information — PENDING (needs a refunded order)'));

  it(title('TC-ORDERFLOW-59: Partial Refunded → Receipt / Refund / Partial Refund — PENDING (needs one)'));
});
