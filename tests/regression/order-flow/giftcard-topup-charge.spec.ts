/**
 * Gift card — TOP UP (nạp tiền) then CHARGE, driven from the gift-card catalog.
 *
 * docs/screens/order-flow/payment-flows-test-cases.md §6 (GC) + §7 (redeem):
 *   - GC-TOPUP-xx  add value to an active card, then redeem it at checkout
 *
 * The cards come from src/data/static/giftCards.json via the catalog loader, so
 * this file pins no number itself — it iterates the ACTIVE cards the report
 * listed, picks empty/low ones to top up, and proves the funded ones are usable
 * charge sources. The catalog is merchant-tagged (20258); on any other merchant
 * the loader yields no cards and every parameterised case simply does not mount.
 *
 * ## Three parts, and why they are gated differently
 *
 *   A. TOP UP (nạp tiền) — PENDING. The gift-card SALE / Add-Value dialog ships no
 *      data-testid AND no stable text anchor on the installed dev build (see
 *      [[giftcard-20258-and-dialog-testids]] and the GC-01/GC-02 pendings in
 *      gift-card-guards.spec.ts). This suite does not invent selectors, so the
 *      top-up step cannot be driven yet — each target is a titled PENDING with the
 *      amount it WOULD add, ready to become real the moment the dialog is
 *      annotated. The scaffolding (catalog → pick target → add value → redeem) is
 *      laid out in order so only the middle step is missing.
 *
 *   B. CHARGE precondition — RUNS, read-only. For a sample of funded active cards,
 *      the checkout gift-card tender VALIDATES and ACCEPTS the code in real time,
 *      proving each catalog card is a usable charge source WITHOUT pressing Pay,
 *      so nothing is spent. This is the "dùng gift card đó charge" assertion the
 *      attach lane can make every run.
 *
 *   C. CHARGE for real — SPENDS, gated behind CHARGE_SETTLE=1 (the same flag
 *      charge-giftcard-matrix.spec.ts uses). Redeems a tiny amount off the richest
 *      funded card so a plain regression pass never drains a balance.
 *
 * PREREQUISITE: the catalog captured for the merchant under test (merchant 20258
 * ships one). Without matching cards the file skips rather than failing.
 *
 * CREATES DATA: orders are created and voided; Part B moves no money, Part C
 * spends a gift card. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/index.js';
import {
  emptyActiveGiftCards,
  fundedActiveGiftCards,
  pickFundedActiveGiftCards,
  requireFundedActiveGiftCard,
} from '../../../src/data/index.js';
import type { GiftCardRecord } from '../../../src/data/index.js';
import {
  completeCustomerTipIfPrompted,
  createOrder,
  payWithGiftCard,
  returnToHome,
} from '../../../src/flows/index.js';
import { checkoutPage, homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectSettled, openCheckout, voidAnyDraft } from './charge-matrix.helpers.js';

/** Opt-in for the real redemption — same flag the gift-card charge matrix uses. */
const SETTLE_ENABLED = process.env.CHARGE_SETTLE === '1';

/** How much each PENDING top-up case would add to its card, in cents ($25.00). */
const TOP_UP_AMOUNT_CENTS = 2_500;

/** How many funded cards Part B proves (bounds runtime; the catalog has ~30). */
const CHARGE_SAMPLE = 4;

/**
 * The cards a "nạp tiền trước khi charge" case is written for: the active cards
 * with nothing to redeem yet (balance 0), then the two LEANEST funded ones —
 * topping those up is the realistic flow, a card that is already rich needs no
 * refill. `fundedActiveGiftCards` is richest-first, so the lean tail is the end.
 */
const TOP_UP_TARGETS: readonly GiftCardRecord[] = [
  ...emptyActiveGiftCards,
  ...fundedActiveGiftCards.slice(-2),
];

/** Mask all but the last four digits — the number is account data, not for the log. */
function masked(code: string): string {
  return code.length <= 4 ? code : `••••${code.slice(-4)}`;
}

describe('Order flow — Gift card top-up then charge (catalog-driven)', () => {
  before(function (this: Mocha.Context): void {
    // No cards for this merchant (wrong till, or empty catalog) — a skip, not a failure.
    if (fundedActiveGiftCards.length === 0) this.skip();
    this.timeout(Timeouts.MOCHA_HOOK);
  });

  afterEach(voidAnyDraft);

  /* ------------------------------------------------------------------ *
   * A. TOP UP (nạp tiền) — PENDING: the Add-Value dialog has no selector
   * ------------------------------------------------------------------ */
  describe('Nạp tiền (add value)', () => {
    for (const card of TOP_UP_TARGETS) {
      it(
        title(
          `Top up $${(TOP_UP_AMOUNT_CENTS / 100).toFixed(2)} into ${masked(card.code)} ` +
            `(balance ${String(card.balance)}, ${card.status}) — PENDING ✅-blocked ` +
            `(Add-Value dialog has no testid on the dev build)`,
        ),
      );
    }

    it(
      title(
        'GC-TOPUP cap: custom value is capped at $10,000; quick $25/$50/$100 — ' +
          'PENDING ✅-blocked (sale dialog has no testid)',
      ),
    );
  });

  /* ------------------------------------------------------------------ *
   * B. CHARGE precondition — RUNS: each funded card validates & accepts
   * ------------------------------------------------------------------ */
  describe('Charge source is valid (read-only — no spend)', () => {
    for (const card of pickFundedActiveGiftCards(CHARGE_SAMPLE)) {
      it(
        title(
          `${masked(card.code)} validates and unlocks Pay at checkout`,
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
          // 20258 pushes a BEFORE-style tip to the customer display and parks the
          // till on "Customer is adding a tip. Please wait…"; the scan dialog (and
          // its Input-Code button) only renders once that handoff is resolved.
          // Drive it on the customer window — a no-op on a merchant without the
          // before-tip flow, and the exact step payWithGiftCard runs. Needs the
          // LAUNCH lane (the dev lane is one); it throws a named "no customer
          // window" error on the attach lane, where this check cannot run. MEDIUM:
          // the wait dialog rides the settle API round-trip, so it can lag.
          await completeCustomerTipIfPrompted('none', undefined, Timeouts.MEDIUM);
          await checkoutPage.waitForGiftCardScanDialog();

          await checkoutPage.enterGiftCardCode(card.code);
          await checkoutPage.redeemGiftCard();

          // Accepted + Pay offered is the proof this catalog card can charge. Stop
          // here — do NOT press Pay; the after-hook voids the order, nothing spent.
          expect(await checkoutPage.isGiftCardAccepted()).toBe(true);
          expect(await checkoutPage.isGiftCardPayAvailable()).toBe(true);

          await checkoutPage.closeGiftCardDialog();
        },
      );
    }
  });

  /* ------------------------------------------------------------------ *
   * C. CHARGE for real — SPENDS, gated behind CHARGE_SETTLE=1
   * ------------------------------------------------------------------ */
  describe('Charge for real (CHARGE_SETTLE=1 — spends the card)', () => {
    it(
      title(
        'The richest funded card redeems $1.00 and settles',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.CRITICAL,
      ),
      async function (this: Mocha.Context): Promise<void> {
        if (!SETTLE_ENABLED) this.skip();
        this.timeout(Timeouts.MOCHA_HOOK);

        const card = requireFundedActiveGiftCard();
        const orderId = await openCheckout({ priceCents: 100 }, 'gift-card');

        await expectSettled(await payWithGiftCard(orderId, card.code), orderId);
      },
    );
  });
});
