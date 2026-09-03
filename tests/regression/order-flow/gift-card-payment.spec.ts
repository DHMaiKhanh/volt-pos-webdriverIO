/**
 * Paying by gift card — manual code entry through to acceptance.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-45  a valid code entered by hand is accepted, and Pay unlocks
 *
 * The spec stops at ACCEPTANCE and abandons the order rather than redeeming: a
 * redemption drains the shared test card (see src/data/static/paymentMethods.ts),
 * and a coverage check should not spend a balance every run. Acceptance is the
 * assertion the test case makes; the balance deduction that follows Pay is the
 * cash-flow's job, exercised where a throwaway card is available.
 *
 * PREREQUISITE: a funded gift card in the merchant under test — `GIFT_CARD_CODE`,
 * or the card hard-set for the merchant in paymentMethods.ts (merchant 20258
 * ships one). Without it the file skips rather than failing.
 *
 * CREATES DATA: an order is created and voided; no money moves. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/index.js';
import { giftCard } from '../../../src/data/static/paymentMethods.js';
import { createOrder, returnToHome } from '../../../src/flows/index.js';
import { checkoutPage, homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

describe('Order flow — Gift card payment', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    if (giftCard.code === '') {
      // No card configured for this merchant — a skip, not a failure.
      this.skip();
    }

    this.timeout(Timeouts.MOCHA_HOOK);

    await returnToHome();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();

    await createOrder();
    await checkoutPage.waitForReady();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
  });

  it(
    title(
      'A manually entered code is accepted and unlocks Pay (TC-ORDERFLOW-45)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      await checkoutPage.selectTender('gift-card');
      await checkoutPage.pressCompletePayment();

      // Complete Payment may raise the passcode guard before the scan dialog.
      await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);

      await checkoutPage.waitForGiftCardScanDialog();
      await checkoutPage.enterGiftCardCode(giftCard.code);
      await checkoutPage.redeemGiftCard();

      expect(await checkoutPage.isGiftCardAccepted()).toBe(true);
      expect(await checkoutPage.isGiftCardPayAvailable()).toBe(true);

      // Stop here — do not spend the card. The after-hook voids the order.
      await checkoutPage.closeGiftCardDialog();
    },
  );
});
