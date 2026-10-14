/**
 * Paying ONE order with MULTIPLE gift cards — the app's partial-redemption path.
 *
 * docs/screens/order-flow/payment-flows-test-cases.md §7 (redeem) / GC split:
 *   - GC-MULTI  split a checkout across two gift cards when the first is short
 *
 * ## What the app does, verified live (2026-10-13, dev build, merchant 20258)
 *
 * When a redeemed card holds LESS than the amount due, the gift-card dialog offers
 * **"Redeem & Add New Check"** ("Gift card not Enough Balance — Redeem with current
 * balance and add a new check for the remaining amount?"). Pressing it spends that
 * card's whole balance, drops the remaining due, and returns the dialog to its scan
 * screen for the next card — no second Complete Payment. The card that covers what
 * is left comes back "Gift Card Accepted" and Pay settles the order. That whole
 * sequence is {@link payWithGiftCards}; this spec proves it reaches the receipt.
 *
 * ## Gated, and why these two cards
 *
 * Redemption SPENDS real balances, so the settle is behind CHARGE_SETTLE=1 (the
 * same flag giftcard-topup-charge / the charge matrix use) — a plain regression
 * pass skips it. It pays a small (~$13) order with the LEANEST funded card first
 * (so it is short and the split path is exercised) and the RICHEST funded card
 * second (so the remainder is always covered, whatever the lean card had left).
 *
 * PREREQUISITE: at least TWO funded active cards in the catalog for the merchant
 * under test (merchant 20258 ships them). Fewer → skip, not fail.
 *
 * CREATES DATA + SPENDS when CHARGE_SETTLE=1. dev / staging only.
 */

import { Timeouts } from '../../../configs/constants/timeouts.js';
import { fundedActiveGiftCards } from '../../../src/data/index.js';
import { payWithGiftCards } from '../../../src/flows/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectSettled, openCheckout, voidAnyDraft } from './charge-matrix.helpers.js';

/** Opt-in for the real split redemption — same flag the single-card charge uses. */
const SETTLE_ENABLED = process.env.CHARGE_SETTLE === '1';

/**
 * Order total, in cents BEFORE tax — picked above the leanest funded card so that
 * card is short and the "Redeem & Add New Check" split path is the one taken. The
 * leanest catalog card is $10, so $12 clears it with tax on top (~$13.20 live).
 */
const SPLIT_ORDER_PRICE_CENTS = 1_200;

describe('Order flow — Pay one order with multiple gift cards', () => {
  before(function (this: Mocha.Context): void {
    // Needs two distinct funded cards: a lean one to come up short, a rich one to
    // cover the remainder. Fewer is a skip, not a failure.
    if (fundedActiveGiftCards.length < 2) this.skip();
    this.timeout(Timeouts.MOCHA_HOOK);
  });

  afterEach(voidAnyDraft);

  it(
    title(
      'splits a ~$13 order across a lean card then the richest card (GC-MULTI)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      // Leanest first (comes up short → split), richest last (always covers the
      // remainder). fundedActiveGiftCards is richest-first, so the tail is leanest.
      const lean = fundedActiveGiftCards[fundedActiveGiftCards.length - 1]!;
      const rich = fundedActiveGiftCards[0]!;

      const orderId = await openCheckout({ priceCents: SPLIT_ORDER_PRICE_CENTS }, 'gift-card');
      await expectSettled(await payWithGiftCards(orderId, [lean.code, rich.code]), orderId);
    },
  );
});
