/**
 * GIFT CARD (sell & pay) — spec + regression guards from
 * docs/screens/order-flow/payment-flows-test-cases.md §6.
 *
 * ## The selling side is unreachable from this lane
 *
 * Most GC cases are about SELLING a gift card (VALUE + Bonus → Balance, the
 * $10,000 cap, promotion/service-fee exclusion, re-scan). The gift-card SALE and
 * SCAN dialogs ship **no data-testid** on the installed dev build (see
 * [[giftcard-20258-and-dialog-testids]]), and this suite does not invent testids —
 * `audit:testids` would reject names the app team never agreed to. Those cases are
 * therefore pending until the app annotates the dialog, each noting that reason.
 *
 * ## What DOES run: the redemption validator at checkout
 *
 *   - GC-03 (✅, read-only) the checkout gift-card tender validates a code in real
 *     time — a bad number is rejected, a funded one is accepted — WITHOUT pressing
 *     Pay, so nothing is spent. This is the one gift-card path the attach lane can
 *     prove, and it is the live regression surface behind VP-3547 / VP-3565.
 *
 * Redemption that actually spends the shared card lives in charge-giftcard-matrix.spec.ts
 * behind `CHARGE_SETTLE=1`; it is not repeated here.
 *
 * PREREQUISITE: a funded gift card in the merchant under test (merchant 20258
 * ships 152298102986). Without one the file skips rather than failing.
 *
 * CREATES DATA: an order is created and voided; no money moves. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/index.js';
import {
  fundedActiveGiftCards,
  INVALID_GIFT_CARD_CODE,
  requireFundedActiveGiftCard,
} from '../../../src/data/index.js';
import { completeCustomerTipIfPrompted, createOrder, returnToHome } from '../../../src/flows/index.js';
import { checkoutPage, homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

describe('Payment flows — Gift Card', () => {
  before(function (this: Mocha.Context): void {
    // No FUNDED card in the catalog for this merchant — a skip, not a failure. The
    // acceptance branch below redeems against a card that must actually cover the
    // order, so it uses a funded catalog card (the old hard-set 152298102986
    // drains across runs and, once empty, is "accepted" but offers no Pay). The
    // order is built inside the test, not here: creating it in a before-hook left
    // the gift-card customer handoff racing the scan dialog.
    if (fundedActiveGiftCards.length === 0) this.skip();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
  });

  it(
    title(
      'The checkout gift-card tender validates a code in real time (GC-03)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      await returnToHome();
      if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
      await createOrder();
      await checkoutPage.waitForReady();

      await checkoutPage.selectTender('gift-card');
      await checkoutPage.pressCompletePayment();
      // Complete Payment may raise the passcode guard before the scan dialog.
      await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
      // On 20258 the gift-card tender pushes a BEFORE-style tip to the customer
      // display and parks the till on "Customer is adding a tip. Please wait…" —
      // the scan dialog only opens once that handoff is resolved. Drive it (the
      // same step payWithGiftCard runs); a no-op on a merchant without the flow.
      // Needs the LAUNCH lane (the dev lane is one). MEDIUM: the wait dialog rides
      // the settle API round-trip, so its appearance can lag a few seconds.
      await completeCustomerTipIfPrompted('none', undefined, Timeouts.MEDIUM);
      await checkoutPage.waitForGiftCardScanDialog();

      // A number from another merchant / a bad number is rejected on lookup — the
      // "không đủ / không hợp lệ" branch of GC-03, and VP-3547's regression surface.
      await checkoutPage.enterGiftCardCode(INVALID_GIFT_CARD_CODE);
      await checkoutPage.redeemGiftCard();
      expect(await checkoutPage.isGiftCardInvalid()).toBe(true);

      // A funded number for THIS merchant is accepted and unlocks Pay — the "đủ"
      // branch. Uses the richest catalog card so acceptance is never mistaken for
      // a drained card. Stop at acceptance; do not press Pay, so the balance is
      // untouched.
      await checkoutPage.enterGiftCardCode(requireFundedActiveGiftCard().code);
      await checkoutPage.redeemGiftCard();
      expect(await checkoutPage.isGiftCardAccepted()).toBe(true);
      expect(await checkoutPage.isGiftCardPayAvailable()).toBe(true);

      await checkoutPage.closeGiftCardDialog();
    },
  );

  // --- Selling side: blocked by the missing sale/scan testids (see module note) ---
  it(
    title(
      'GC-01: sell gift card, Balance = VALUE + Bonus — PENDING ✅-blocked (sale dialog has no testid on dev build)',
    ),
  );

  it(
    title(
      'GC-02: custom value cap $10,000; quick $25/$50/$100 — PENDING ✅-blocked (sale dialog has no testid)',
    ),
  );

  it(
    title(
      'GC-R5 (VP-3910): "Scan again" returns no result after first scan — PENDING ✅-blocked (scan dialog has no testid)',
    ),
  );

  it(
    title(
      'GC-R7 (VP-4160): gift-card price drops $105→$104.75 under a promotion — PENDING ✅-blocked (sale dialog has no testid)',
    ),
  );

  it(
    title(
      'GC-R8 (VP-3827): exclude GC Sale from Service Fee & Cash Discount — PENDING ✅-blocked (sale dialog has no testid)',
    ),
  );

  it(
    title(
      'GC-R9 (VP-3812): GC Sale still charged Service Fee — PENDING ✅-blocked (sale dialog has no testid)',
    ),
  );

  it(
    title(
      'GC-R10 (VP-3235): scan shows no Transaction History — PENDING ✅-blocked (scan dialog has no testid)',
    ),
  );

  // --- Need a real settle / card / point read ---
  it(
    title(
      'GC-04: Gift Card is Void-only, never a refund method — PENDING 💳 (needs a settled gift-card order)',
    ),
  );

  it(
    title(
      'GC-R1 (VP-3565): redemption amount mismatch + not linked to tx — PENDING 💳 (needs a real redemption + tx read)',
    ),
  );

  it(
    title('GC-R2 (VP-3788): partial-redemption split loses the check tip — PENDING 💳 (shared with SPL-R2)'),
  );

  it(
    title(
      'GC-R3 (VP-3727): cancel of multiple gift cards restores wrong balance — PENDING 💳 (shared with CAN-R1)',
    ),
  );

  it(
    title(
      'GC-R4 (VP-3547): scan Active but "Invalid" on Add Value — PENDING 💳 (add-value dialog has no testid)',
    ),
  );

  it(
    title('GC-R6 (VP-4171): gift-card sale not excluded from point — PENDING 🌙 (needs a point/report read)'),
  );
});
