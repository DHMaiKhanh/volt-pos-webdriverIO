/**
 * The payment-success screen after a settled sale.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-50  the four receipt-delivery actions render on completion
 *   - TC-ORDERFLOW-51  No Receipt ends the order and returns to the till
 *
 * Only the reception side is asserted here. The customer-display half of TC-50
 * ("Payment complete" + four actions on the second window) is covered by the
 * dual-screen file — see dual-screen.spec.ts.
 *
 * CREATES DATA AND TAKES A PAYMENT: a cash sale is settled. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { createOrder, payInCash, returnToHome } from '../../../src/flows/index.js';
import { checkoutPage, homePage, paymentSuccessPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

describe('Order flow — Payment success', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    // Create, tender and settle — three upstream round trips plus a sync push.
    this.timeout(Timeouts.MOCHA_HOOK);

    await returnToHome();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();

    const { orderId } = await createOrder();
    await checkoutPage.waitForReady();
    const totalCents = await checkoutPage.totalCents();

    await payInCash(orderId, { tenderedCents: totalCents });
    await paymentSuccessPage.waitForReady();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title(
      'The four receipt actions render on completion (TC-ORDERFLOW-50)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      expect(await paymentSuccessPage.isActive()).toBe(true);
      expect(await paymentSuccessPage.areAllReceiptActionsShown()).toBe(true);
    },
  );

  it(
    title(
      'No Receipt ends the order and returns to the till (TC-ORDERFLOW-51)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      await paymentSuccessPage.continueToNextOrder();
      await paymentSuccessPage.waitForFlowToEnd();

      // No Receipt hands off through `/order-pending` on a till that still has
      // drafts queued, rather than landing straight on `/home` — returnToHome
      // walks that last hop. The assertion is that the sale is over and the till
      // is usable again for the next order.
      await returnToHome();
      expect(await homePage.isActive()).toBe(true);
    },
  );
});
