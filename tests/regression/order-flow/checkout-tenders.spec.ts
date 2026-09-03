/**
 * The checkout screen: the four tenders, amount entry, and the completion guard.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-39  the four tenders show per-method amounts (card ≥ cash)
 *   - TC-ORDERFLOW-40  a cash quick-select preset adds to the entry
 *   - TC-ORDERFLOW-41  a cash amount below the total leaves a remaining balance
 *   - TC-ORDERFLOW-42  a full cash tender clears the balance
 *   - TC-ORDERFLOW-44  card keeps Complete Payment disabled without a terminal
 *   - TC-ORDERFLOW-46  Other reveals and records a method-name field
 *   - TC-ORDERFLOW-47  Tip is pressable once a tender is chosen
 *   - TC-ORDERFLOW-49  Cash Drawer belongs to the cash tender, not the header
 *   - TC-ORDERFLOW-76  Complete Payment settles cash, clearing the staff-code guard
 *
 * All but the last probe the screen WITHOUT taking money; TC-76 runs last and
 * settles the order, which is why it is the only one that ends the checkout.
 *
 * TC-ORDERFLOW-43 (partial pay across several tenders) and TC-ORDERFLOW-48
 * (Print omits the payment method from the receipt preview) are pending — the
 * first is a multi-settle sequence, the second needs a receipt-preview reader.
 * Gift-card redemption (TC-45) lives in `gift-card-payment.spec.ts`.
 *
 * CREATES DATA AND TAKES A PAYMENT (TC-76 only). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/index.js';
import { createOrder, returnToHome } from '../../../src/flows/index.js';
import { checkoutPage, homePage, paymentSuccessPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

describe('Order flow — Checkout tenders', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    // Creating an order is an upstream round trip plus a sync push.
    this.timeout(Timeouts.MOCHA_HOOK);

    await returnToHome();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();

    await createOrder();
    await checkoutPage.waitForReady();
  });

  after(async () => {
    // Whether TC-76 settled the order or an earlier test left it on checkout,
    // returnToHome walks back and the draft (if any) is voided.
    await returnToHome();
    await homePage.waitForReady();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
  });

  // These probes share ONE order, and they mutate the entry field (a preset here,
  // an under-tender there). Two things leak forward without a reset:
  //   1. A failed test leaves rootHooks' recovery on /home, so the next test can
  //      no longer find the tender tabs — one failure becomes a file of failures.
  //   2. Re-selecting the ALREADY-active tender is a no-op in the app, so the
  //      auto-fill effect never re-runs and a prior under-tender's amount stays
  //      in the field — TC-42 / TC-76 then read a non-zero "remaining".
  // Re-open the checkout when recovery left it, then bounce off the card tender so
  // the next `selectTender()` is always a real change that re-fills the full due.
  beforeEach(async () => {
    if (!(await checkoutPage.isActive())) {
      await returnToHome();
      if (await homePage.hasActiveDraft()) await homePage.pressPay();
      else await createOrder();
      await checkoutPage.waitForReady();
    }
    await checkoutPage.selectTender('card');
  });

  it(
    title('The four tenders show per-method amounts (TC-ORDERFLOW-39)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      // The entry field pre-fills the amount DUE for the selected tender, and the
      // due differs by method — card carries the service fee, cash the discount.
      await checkoutPage.selectTender('card');
      const cardDue = await checkoutPage.enteredAmountCents();

      await checkoutPage.selectTender('cash');
      const cashDue = await checkoutPage.enteredAmountCents();

      expect(cardDue).toBeGreaterThan(0);
      expect(cashDue).toBeGreaterThan(0);
      // Card is never cheaper than cash (fee/tax vs cash discount); equal on a
      // merchant with neither configured, which still satisfies this.
      expect(cardDue).toBeGreaterThanOrEqual(cashDue);

      // The remaining two tenders must be selectable too.
      await checkoutPage.selectTender('gift-card');
      await checkoutPage.selectOtherTender();
      expect(await checkoutPage.isOtherMethodNameShown()).toBe(true);
    },
  );

  it(
    title('A cash quick-select preset adds to the entry (TC-ORDERFLOW-40)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await checkoutPage.selectTender('cash');
      await checkoutPage.clearAmount();
      expect(await checkoutPage.enteredAmountCents()).toBe(0);

      // $50 preset. Presets ADD to whatever is entered, so from zero it lands on $50.
      await checkoutPage.addCashPreset(5_000);
      expect(await checkoutPage.enteredAmountCents()).toBe(5_000);
    },
  );

  it(
    title('A cash amount below the total leaves a balance (TC-ORDERFLOW-41)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await checkoutPage.selectTender('cash');
      // One cent is below any real order total, so a balance must remain and no
      // change is owed.
      await checkoutPage.enterAmount(1);

      expect(await checkoutPage.remainingCents()).toBeGreaterThan(0);
      expect(await checkoutPage.isChangeShown()).toBe(false);
    },
  );

  it(
    title('A full cash tender clears the balance (TC-ORDERFLOW-42)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      // Selecting cash re-fills the entry with the exact amount due, so a full
      // tender is the pre-filled field untouched.
      await checkoutPage.selectTender('cash');

      expect(await checkoutPage.enteredAmountCents()).toBeGreaterThan(0);
      expect(await checkoutPage.remainingCents()).toBe(0);
      expect(await checkoutPage.isCompletePaymentEnabled()).toBe(true);
    },
  );

  it(
    title(
      'Card keeps Complete Payment disabled without a terminal (TC-ORDERFLOW-44)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await checkoutPage.selectTender('card');
      // The card tender unlocks Complete Payment only after the customer display
      // returns the tip and signature — impossible without a terminal here.
      expect(await checkoutPage.isCompletePaymentEnabled()).toBe(false);
    },
  );

  it(
    title('Other reveals and records a method-name field (TC-ORDERFLOW-46)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await checkoutPage.selectOtherTender();
      expect(await checkoutPage.isOtherMethodNameShown()).toBe(true);

      await checkoutPage.enterOtherMethodName('Zelle');
      expect(await checkoutPage.otherMethodName()).toBe('Zelle');
    },
  );

  it(
    title(
      'TC-ORDERFLOW-47: Tip is pressable once a tender is chosen — PENDING ' +
        '(the Tip button renders but reads `disabled` on EVERY tender on this device — verified ' +
        'card/cash/gift-card/other — because enabling it needs the customer-display tip handoff / ' +
        'tip-after-payment merchant config, which merchant 20258 does not have set up)',
    ),
  );

  it(
    title(
      'Cash Drawer belongs to the cash tender, not the header (TC-ORDERFLOW-49)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await checkoutPage.selectTender('cash');
      expect(await checkoutPage.isCashDrawerShown()).toBe(true);

      // It is not part of any other tender — the header has no Cash Drawer at all.
      await checkoutPage.selectTender('card');
      expect(await checkoutPage.isCashDrawerShown()).toBe(false);
    },
  );

  it(title('TC-ORDERFLOW-43: partial pay across several tenders — PENDING (multi-settle sequence)'));

  it(
    title(
      'TC-ORDERFLOW-48: Print omits the payment method from the preview — PENDING (no receipt-preview reader)',
    ),
  );

  it(
    title(
      'Complete Payment settles cash, clearing the staff-code guard (TC-ORDERFLOW-76)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      await checkoutPage.selectTender('cash');
      // Pre-filled with the exact due — a full tender.
      expect(await checkoutPage.remainingCents()).toBe(0);

      await checkoutPage.pressCompletePayment();

      // Whether the guard appears is merchant permission state; when it does, it
      // must accept the staff passcode. This is the "requires staff code" step.
      if (await passcodeDialog.isPrompting(Timeouts.MEDIUM)) {
        await passcodeDialog.enter(env.STAFF_PASSCODE);
      }

      const success = await paymentSuccessPage.waitForNavigation();
      expect(await success.isActive()).toBe(true);
    },
  );
});
