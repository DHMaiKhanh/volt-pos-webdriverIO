/**
 * Paying by card — the card tender from selection through to a settled charge.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (EXTENDS the catalog, 82+):
 *   - TC-ORDERFLOW-82  the card tender pre-fills the full balance due
 *   - TC-ORDERFLOW-83  the card tab clamps an over-tender to the balance due
 *   - TC-ORDERFLOW-84  a card charge settles and lands on payment-success — gated (CARD_SETTLE=1)
 *   - TC-ORDERFLOW-85  the charging dialog shows the amount and counts down — PENDING (assert during a settle run)
 *   - TC-ORDERFLOW-86  a failed / timed-out charge offers Try Again — PENDING (needs a decline reply)
 *   - TC-ORDERFLOW-87  card routes the tip prompt to the customer display — PENDING (launch lane + tip config)
 *
 * ## Orders vary by POSITION, never a hard-coded account
 *
 * Each case builds its draft on a chosen staff/service TILE via
 * `HomePage.selectStaffByIndex` / `addServiceByIndex` — different pairings across
 * the file, all resolved by where the tile sits, so the suite covers a spread of
 * staff/services without pinning to an id that only exists on one merchant. The
 * index is taken modulo the mounted count, so a merchant with a single staff or
 * service still runs (every case lands on tile 0) rather than throwing.
 *
 * ## Why the SETTLE is gated behind CARD_SETTLE=1 rather than always-on
 *
 * A card charge is real and NOT undoable: it presses Complete Payment (passcode
 * guard, then the charging dialog), waits on a Bamboo DOT terminal, and moves
 * money on the dev gateway. The charging dialog has no cancel — a decline or a
 * no-terminal stall parks it modally, and `pressBack` is gone once the order is
 * fully tendered — so an unattended lane that ran this blindly would take stray
 * charges and could wedge on a decline. It therefore runs ONLY when an operator
 * who is at the terminal opts in:
 *
 *     CARD_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/order-flow/card-payment.spec.ts
 *
 * `SPEC_RETRIES=0` because a file retry would re-attempt the charge. Without the
 * flag TC-84 skips, and the probes (82, 83) still run and take no money.
 *
 * Prerequisite for the settle: the LAUNCH lane (the customer display is only a
 * WebDriver handle there), a STAFF_PASSCODE the merchant accepts for
 * `completed_payment` (merchant 20258 = 8888, set in .env.dev; the 9999 sample is
 * rejected), AND a terminal that will approve the charge. The charge does NOT
 * complete until the customer display's tip (+ signature) is driven — the till's
 * charging dialog waits on that handoff, so TC-84 completes it before waiting.
 *
 * The neighbouring card assertions already live in checkout-tenders.spec.ts and
 * are NOT duplicated here: card due ≥ cash due (TC-39), Complete Payment disabled
 * without a terminal (TC-44), and no Cash Drawer on the card tender (TC-49).
 *
 * CREATES DATA (drafts, all voided). Takes a card payment ONLY under CARD_SETTLE=1.
 * dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { payWithCard, returnToHome } from '../../../src/flows/index.js';
import { checkoutPage, homePage, paymentSuccessPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** Opt-in for the real, money-moving settle. See the module note. */
const SETTLE_ENABLED = process.env.CARD_SETTLE === '1';

/**
 * Build a draft on the staff/service tiles at the given positions and open the
 * card tender, returning the order id off the checkout URL.
 *
 * Positional, not id-based: the pairing changes per case without hard-coding an
 * account (see the module note). The index is wrapped to the mounted tile count
 * so a short roster never throws — it just repeats tile 0.
 */
async function openCardCheckout(staffIndex: number, serviceIndex: number): Promise<string> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();

  const staffCount = await homePage.visibleStaffCount();
  const serviceCount = await homePage.visibleServiceCount();
  await homePage.selectStaffByIndex(staffIndex % Math.max(staffCount, 1));
  await homePage.addServiceByIndex(serviceIndex % Math.max(serviceCount, 1));

  await homePage.pressPay();
  await checkoutPage.waitForReady();
  await checkoutPage.selectTender('card');
  return checkoutPage.orderId();
}

/** Leave the till empty for the next case, whatever state this one ended in. */
async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

describe('Order flow — Card payment', () => {
  before(() => assertWritesAllowed('build card orders'));

  after(voidAnyDraft);

  it(
    title('The card tender pre-fills the full balance due (TC-ORDERFLOW-82)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await openCardCheckout(0, 0);

      // Selecting a tender re-fills the entry with the exact amount due, so a
      // freshly selected card tab owes nothing beyond what is already entered.
      expect(await checkoutPage.enteredAmountCents()).toBeGreaterThan(0);
      expect(await checkoutPage.remainingCents()).toBe(0);

      await voidAnyDraft();
    },
  );

  it(
    title(
      'The card tab clamps an over-tender to the balance due (TC-ORDERFLOW-83)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      // A different staff/service pairing than TC-82 — positional, not hard-coded.
      await openCardCheckout(1, 1);
      const due = await checkoutPage.enteredAmountCents();
      expect(due).toBeGreaterThan(0);

      // Unlike cash, the card keypad caps entry at the remaining due
      // (`appendCashDigit`), so typing well over the balance settles back to it —
      // there is no over-tender / change concept on a card charge.
      await checkoutPage.enterAmount(due * 10);
      expect(await checkoutPage.enteredAmountCents()).toBe(due);
      expect(await checkoutPage.isChangeShown()).toBe(false);

      await voidAnyDraft();
    },
  );

  it(
    title(
      'A card charge settles and lands on payment-success (TC-ORDERFLOW-84)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!SETTLE_ENABLED) {
        // Off by default — a real charge needs an operator at the terminal. See
        // the module note for the CARD_SETTLE=1 command.
        this.skip();
      }
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCardCheckout(0, 1);

      // payWithCard drives the whole card handoff for merchant 20258: Complete
      // Payment, the passcode guard, the customer-display tip + BOTH signatures,
      // and the settle on the card budget. The "why" lives in checkout.flow.ts —
      // the operator only has to tap the card when the terminal prompts.
      const success = await payWithCard(orderId);
      expect(await success.isActive()).toBe(true);
      expect(await paymentSuccessPage.areAllReceiptActionsShown()).toBe(true);

      // End the sale so the after-hook starts from a clean till rather than the
      // receipt screen.
      await paymentSuccessPage.continueToNextOrder();
      await paymentSuccessPage.waitForFlowToEnd();
    },
  );

  it(
    title(
      'TC-ORDERFLOW-85: the charging dialog shows the amount and counts down — PENDING ' +
        '(assert cardChargeAmount / cardCountdown during a CARD_SETTLE=1 run)',
      Tag.PAYMENT,
    ),
  );

  it(
    title(
      'TC-ORDERFLOW-86: a failed / timed-out charge offers Try Again — PENDING ' +
        '(needs a terminal driven to decline / time out)',
      Tag.PAYMENT,
    ),
  );

  it(
    title(
      'TC-ORDERFLOW-87: card routes the tip prompt to the customer display — PENDING ' +
        '(needs the launch lane + a tip-after-payment merchant)',
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
  );
});
