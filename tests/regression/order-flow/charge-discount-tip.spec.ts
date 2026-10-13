/**
 * Charging the four tenders on an order that carries BOTH a line discount and a
 * customer tip — the "discount + tip" combination across cash, card, gift card
 * and other.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (EXTENDS the catalog, 88+):
 *   - TC-ORDERFLOW-88  the item-discount switch produces a deduction on the cart
 *                      AND rolls into checkout's Total Discount — always-on probe
 *   - TC-ORDERFLOW-89  the discount survives on every one of the 4 tender tabs —
 *                      always-on probe (order-level discount, not tender-level)
 *   - TC-ORDERFLOW-90  Cash + discount + tip settles → payment-success — gated
 *   - TC-ORDERFLOW-91  Other (Zelle) + discount + tip settles → payment-success — gated
 *   - TC-ORDERFLOW-92  Gift Card + discount (+ tip if the app allows it) redeems
 *                      and settles — gated
 *   - TC-ORDERFLOW-93  Card + discount + tip charges and settles — gated (terminal)
 *
 * ## Two features, two surfaces
 *
 * The DISCOUNT is a LINE-level item discount, applied on /home before checkout:
 * open the cart line editor and flip the Apply-Discount switch
 * (`HomePage.toggleItemDiscount`). It renders as an `Item Discount` deduction on
 * the cart and rolls up into `Total Discount` on checkout — an order-level figure
 * that shows on every tender, which is what the always-on probes assert without
 * moving a cent. Its MAGNITUDE is the merchant's configured item-discount rule
 * (merchant 20258 has one); a merchant with none would show the switch on but no
 * deduction, and TC-88 is where that gap would surface.
 *
 * The TIP is collected on the CUSTOMER DISPLAY. The checkout Tip button hands the
 * tip screen to the second window (`checkoutPage.pressTip()` for cash/gift/other;
 * for card the tip rides the Complete-Payment handoff inside `payWithCard`), so
 * driving a tip needs the tauri-driver LAUNCH lane — the attach lane cannot see
 * the customer webview as a handle. That is why every tip lives behind the settle
 * gate rather than in the always-on probes.
 *
 * ## Why the money-moving half is gated
 *
 * A settle is real and NOT undoable on a write-enabled till: cash / gift card /
 * other press Complete Payment and close the sale; card additionally moves money
 * on the dev gateway through a Bamboo DOT terminal. So the charge — and the tip
 * drive that precedes it — runs ONLY when an operator opts in:
 *
 *   - cash / gift card / other:
 *       CHARGE_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/order-flow/charge-discount-tip.spec.ts
 *   - card (same prerequisites as card-payment.spec.ts TC-84 — a terminal that
 *     approves the tapped card, and a STAFF_PASSCODE the merchant accepts for
 *     `completed_payment`, e.g. 20258 = 8888 in .env.dev):
 *       CARD_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ...
 *
 * `SPEC_RETRIES=0` because a file retry would re-take the charge. Without the
 * flags the four charge cases skip and the two probes (88, 89) still run, taking
 * no money.
 *
 * ## Orders vary by POSITION, never a hard-coded account
 *
 * Each case builds its draft on a chosen staff/service TILE via
 * `HomePage.selectStaffByIndex` / `addServiceByIndex`, the index taken modulo the
 * mounted count so a short roster still runs (every case lands on tile 0) — the
 * same convention card-payment.spec.ts uses.
 *
 * CREATES DATA (drafts, voided when not charged). Takes real payments ONLY under
 * CHARGE_SETTLE=1 / CARD_SETTLE=1. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { giftCard } from '../../../src/data/index.js';
import {
  payInCash,
  payWithCard,
  payWithGiftCard,
  payWithOther,
  returnToHome,
} from '../../../src/flows/index.js';
import { checkoutPage, customerDisplayPage, homePage, paymentSuccessPage } from '../../../src/pages/index.js';
import type { Tender } from '../../../src/pages/pos/CheckoutPage.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** Opt-in for the real, money-moving settle on cash / gift card / other. */
const SETTLE_ENABLED = process.env.CHARGE_SETTLE === '1';

/** Opt-in for the card charge — same meaning as card-payment.spec.ts (terminal + passcode). */
const CARD_SETTLE_ENABLED = process.env.CARD_SETTLE === '1';

/**
 * The tip percentage every case asks for. Merchant 20258 exposes no percent
 * presets (only Custom Tip + No Tip), so each case enters 20% of the subtotal on
 * the Custom Tip keypad rather than tapping a preset — see `applyTip` and the
 * CustomerDisplayPage note before assuming a percentage on another merchant.
 */
const TIP_PERCENT = 20;

/** The four tender tabs, in checkout order — for the per-tender discount probe. */
const ALL_TENDERS: readonly Tender[] = ['card', 'cash', 'gift-card', 'other'];

/**
 * Build a draft on the given staff/service tiles and put a LINE discount on it,
 * leaving the app on the /home cart (before Pay).
 *
 * Positional, not id-based (see the module note). The item discount is the cart
 * line editor's Apply-Discount switch, flipped on and saved.
 */
async function buildDiscountedDraft(staffIndex: number, serviceIndex: number): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();

  const staffCount = await homePage.visibleStaffCount();
  const serviceCount = await homePage.visibleServiceCount();
  await homePage.selectStaffByIndex(staffIndex % Math.max(staffCount, 1));
  await homePage.addServiceByIndex(serviceIndex % Math.max(serviceCount, 1));

  await homePage.openServiceEditor();
  if (!(await homePage.isItemDiscountOn())) await homePage.toggleItemDiscount();
  // Flipping the switch on is not enough: the app keeps Save disabled until a
  // non-zero discount amount is entered in the field the switch reveals — the same
  // gotcha charge-matrix.helpers buildDraft handles.
  await homePage.setItemDiscount('10');
  await homePage.saveServiceEditor();
}

/**
 * Build the discounted draft, open checkout on `tender`, and return the order id
 * off the checkout URL.
 */
async function openDiscountedCheckout(
  staffIndex: number,
  serviceIndex: number,
  tender: Tender,
): Promise<string> {
  await buildDiscountedDraft(staffIndex, serviceIndex);
  await homePage.pressPay();
  await checkoutPage.waitForReady();
  await checkoutPage.selectTender(tender);
  return checkoutPage.orderId();
}

/**
 * Drive a tip on the customer display and wait for the till to take it back.
 *
 * Returns `false` when the Tip button is disabled for the selected tender — the
 * app refusing a tip (gift card is excluded from tipping per §A3.4), which the
 * caller documents rather than fails on. Signs the pad only if one is shown, so
 * it works whether or not the merchant runs `signatureSetting`.
 */
async function applyTip(percent: number): Promise<boolean> {
  if (!(await checkoutPage.isTipEnabled())) return false;

  // Merchant 20258 exposes no percent presets — only Custom Tip + No Tip — so a
  // percent tip is entered as that percent of the subtotal on the Custom Tip
  // keypad, landing on the same dollar the app previews (see CustomerDisplayPage).
  const customTipCents = Math.max(1, Math.round((await checkoutPage.subtotalCents()) * (percent / 100)));

  await checkoutPage.pressTip();
  await customerDisplayPage.waitForTipPrompt(Timeouts.LONG);
  await customerDisplayPage.enterCustomTip(customTipCents);
  if (await customerDisplayPage.isSignaturePadShown()) {
    await customerDisplayPage.sign();
  }
  await customerDisplayPage.pressContinue();
  await checkoutPage.waitForCustomerHandoff();
  return true;
}

/** Leave the till empty for the next case, whatever state this one ended in. */
async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

/** End the sale so the next case starts from a clean till, not the receipt screen. */
async function endSale(): Promise<void> {
  await paymentSuccessPage.continueToNextOrder();
  await paymentSuccessPage.waitForFlowToEnd();
}

describe('Order flow — Charge with discount + tip', () => {
  before(() => assertWritesAllowed('build discounted, tipped orders'));

  after(voidAnyDraft);

  /* ------------------------------------------------------------------ *
   * Always-on probes — the discount surface, no money, no launch lane
   * ------------------------------------------------------------------ */

  it(
    title(
      'The item-discount switch deducts on the cart and rolls into Total Discount (TC-ORDERFLOW-88)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await buildDiscountedDraft(0, 0);

      // On the cart, the discount is its own `Item Discount` deduction row —
      // negative, because the page object reports what the cashier sees.
      const totals = await homePage.cartTotals();
      expect(totals.itemDiscount).toBeLessThan(0);

      // On checkout it rolls up into the single `Total Discount` row, which is
      // present and negative for this order.
      await homePage.pressPay();
      await checkoutPage.waitForReady();
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await voidAnyDraft();
    },
  );

  it(
    title('The discount holds on all four tender tabs (TC-ORDERFLOW-89)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      // A different staff/service pairing than TC-88 — positional, not hard-coded.
      await openDiscountedCheckout(1, 1, 'card');

      // The discount is order-level, so switching tender never drops it: every
      // one of the four tabs keeps the Total Discount row on screen and negative.
      for (const tender of ALL_TENDERS) {
        await checkoutPage.selectTender(tender);
        expect(await checkoutPage.isDiscountShown()).toBe(true);
        expect(await checkoutPage.discountCents()).toBeLessThan(0);
      }

      await voidAnyDraft();
    },
  );

  /* ------------------------------------------------------------------ *
   * Gated charges — discount + tip, then settle (real money)
   * ------------------------------------------------------------------ */

  it(
    title(
      'Cash + discount + tip settles → payment-success (TC-ORDERFLOW-90)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openDiscountedCheckout(0, 0, 'cash');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      expect(await applyTip(TIP_PERCENT)).toBe(true);
      expect(await checkoutPage.tipCents()).toBeGreaterThan(0);

      // Exact settle: no tenderedCents → Complete Payment on the pre-filled
      // discounted+tipped balance. Cash needs no terminal.
      const success = await payInCash(orderId);
      expect(await success.orderId()).toBe(orderId);
      expect(await success.isActive()).toBe(true);

      await endSale();
    },
  );

  it(
    title(
      'Other (Zelle) + discount + tip settles → payment-success (TC-ORDERFLOW-91)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openDiscountedCheckout(2, 2, 'other');
      expect(await checkoutPage.isDiscountShown()).toBe(true);

      expect(await applyTip(TIP_PERCENT)).toBe(true);
      expect(await checkoutPage.tipCents()).toBeGreaterThan(0);

      // Other is a labelled tender, not a tax-free one — it settles the taxed,
      // discounted, tipped balance under the name "Zelle".
      const success = await payWithOther(orderId, 'Zelle');
      expect(await success.orderId()).toBe(orderId);
      expect(await success.isActive()).toBe(true);

      await endSale();
    },
  );

  it(
    title(
      'Gift Card + discount (+ tip if allowed) redeems and settles (TC-ORDERFLOW-92)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!SETTLE_ENABLED) this.skip();
      if (giftCard.code === '') {
        // No card configured for this merchant — nothing to redeem. See
        // src/data/static/paymentMethods.ts (GIFT_CARD_BY_MERCHANT / GIFT_CARD_CODE).
        this.skip();
      }
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openDiscountedCheckout(3, 3, 'gift-card');
      expect(await checkoutPage.isDiscountShown()).toBe(true);

      // Gift card is excluded from Adjust Tip post-payment (§A3.4); at checkout the
      // Tip button may likewise be disabled. Take the tip when the app offers it,
      // and document the exclusion when it does not — either way the card still
      // redeems the discounted balance.
      if (await applyTip(TIP_PERCENT)) {
        expect(await checkoutPage.tipCents()).toBeGreaterThan(0);
      } else {
        expect(await checkoutPage.isTipEnabled()).toBe(false);
      }

      const success = await payWithGiftCard(orderId, giftCard.code);
      expect(await success.orderId()).toBe(orderId);
      expect(await success.isActive()).toBe(true);

      await endSale();
    },
  );

  it(
    title(
      'Card + discount + tip charges and settles (TC-ORDERFLOW-93)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) {
        // Card moves money on the gateway and needs an operator at the terminal —
        // same opt-in as card-payment.spec.ts TC-84. See the module note.
        this.skip();
      }
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openDiscountedCheckout(0, 1, 'card');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      // Card is pay-first: payWithCard presses Complete Payment, clears the
      // passcode guard, then drives the customer display's tip + both signatures
      // and waits out the terminal approval on the discounted balance. 20258 has
      // no percent presets, so the 20% tip is typed as its dollar value on the
      // Custom Tip keypad (subtotal × 20%), same as the card charge matrix.
      const customTipCents = Math.max(
        1,
        Math.round((await checkoutPage.subtotalCents()) * (TIP_PERCENT / 100)),
      );
      const success = await payWithCard(orderId, { customTipCents });
      expect(await success.isActive()).toBe(true);
      expect(await paymentSuccessPage.areAllReceiptActionsShown()).toBe(true);

      await endSale();
    },
  );
});
