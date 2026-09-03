/**
 * Adjust Tip on a settled-but-unsettled cash order.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-69  the Adjust Tip dialog opens on an eligible order
 *
 * Whether Adjust Tip is offered at all is merchant configuration (it needs
 * tip-after-payment on plus an adjustable tender), so the test skips at runtime
 * when the action is absent rather than failing on a till that does not enable
 * it. The Gift-Card exclusion half of the case cannot be shown here — it needs an
 * unsettled gift-card order, which the suite cannot leave unsettled.
 *
 * TC-ORDERFLOW-70 (a multi-tender order forces a tender choice first) is pending:
 * building an order paid by two tenders in one run is a multi-settle sequence the
 * suite does not script yet.
 *
 * CREATES DATA AND TAKES A PAYMENT: one settled order, tip left unchanged (the
 * dialog is opened and closed, never saved). dev / staging only.
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

describe('Order flow — Adjust Tip', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);

    await returnToHome();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();

    const { orderId } = await createOrder();
    await checkoutPage.waitForReady();
    const total = await checkoutPage.totalCents();

    const success = await payInCash(orderId, { tenderedCents: total });
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
    title('The Adjust Tip dialog opens on an eligible order (TC-ORDERFLOW-69)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      if (!(await orderHistoryDetailPage.isAdjustTipAvailable())) {
        // Tip-after-payment is off on this merchant — nothing to adjust.
        this.skip();
      }

      await orderHistoryDetailPage.openAdjustTip();

      // A single-tender cash order skips the picker and lands on amount entry.
      expect(await orderHistoryDetailPage.isTenderPickerOpen()).toBe(false);
      expect(await orderHistoryDetailPage.isAdjustTipEntryShown()).toBe(true);

      // Leave the tip untouched.
      await orderHistoryDetailPage.closeAdjustTip();
    },
  );

  it(title('TC-ORDERFLOW-70: a multi-tender order forces a tender choice — PENDING (multi-settle order)'));
});
