/**
 * Gift-card charge matrix — 10 successful redemptions, each a distinct point in
 * the amount / discount / staff matrix.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (EXTENDS the catalog, 124+):
 *   - TC-ORDERFLOW-124 $1.00 single line                        → payment-success
 *   - TC-ORDERFLOW-125 $2.00 single line                        → payment-success
 *   - TC-ORDERFLOW-126 $3.00 single line                        → payment-success
 *   - TC-ORDERFLOW-127 $1.00 + item discount                    → payment-success
 *   - TC-ORDERFLOW-128 $2.00, different staff tile               → payment-success
 *   - TC-ORDERFLOW-129 $1.50, different service tile             → payment-success
 *   - TC-ORDERFLOW-130 $2.50, further staff/service tile         → payment-success
 *   - TC-ORDERFLOW-131 $3.50 + item discount                    → payment-success
 *   - TC-ORDERFLOW-132 $1.25, further service tile               → payment-success
 *   - TC-ORDERFLOW-133 $4.00, further staff/service tile         → payment-success
 *
 * ## Why gated, and why the amounts are TINY
 *
 * A redemption SPENDS the card — the shared test card (152298102986, hard-set for
 * merchant 20258 in src/data/static/paymentMethods.ts) drains on every settle. So
 * two protections stack:
 *
 *   1. The whole file is gated behind CHARGE_SETTLE=1 — it does not run on a plain
 *      regression pass, only when an operator opts in and knows the balance will
 *      be spent:
 *        CHARGE_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/order-flow/charge-giftcard-matrix.spec.ts
 *   2. Every case OVERWRITES the line price to a small figure ($1–$4) so the ten
 *      redemptions together spend on the order of $25 + tax rather than ten full-
 *      price services. Keep the card topped up; if it runs dry mid-file,
 *      `payWithGiftCard` throws a "does not cover the balance — that is a split
 *      payment" error naming the shortfall rather than failing silently.
 *
 * `SPEC_RETRIES=0` because a file retry would redeem a second time. Without the
 * flag — or with no card configured for the merchant — every case skips.
 *
 * ## No tip axis
 *
 * Gift card is excluded from tipping (§A3.4 — the checkout Tip button is disabled
 * on this tender), so the matrix varies by amount, discount and staff only. It
 * needs NO terminal and NO customer display, so it runs in the plain attach lane
 * once the gate and the card are in place.
 *
 * CREATES DATA AND SPENDS A GIFT CARD. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { giftCard } from '../../../src/data/index.js';
import { payWithGiftCard } from '../../../src/flows/index.js';
import { checkoutPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../src/utils/money.js';
import { expectSettled, openCheckout, voidAnyDraft } from './charge-matrix.helpers.js';

/** Opt-in for the real redemption — same flag charge-discount-tip.spec.ts uses for cash/gift/other. */
const SETTLE_ENABLED = process.env.CHARGE_SETTLE === '1';

/** Skip when the settle is not opted in, or when the merchant has no card configured to spend. */
function requireRedeemable(ctx: Mocha.Context): void {
  if (!SETTLE_ENABLED) ctx.skip();
  if (giftCard.code === '') ctx.skip();
  ctx.timeout(Timeouts.MOCHA_HOOK);
}

describe('Order flow — Gift-card charge matrix', () => {
  before(() => assertWritesAllowed('build the gift-card charge matrix'));

  afterEach(voidAnyDraft);

  it(
    title(
      '$1.00 single line redeems and settles (TC-ORDERFLOW-124)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 100 }, 'gift-card');
      expectCentsEqual(await checkoutPage.subtotalCents(), 100, 'subtotal after price override');

      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title('$2.00 single line redeems and settles (TC-ORDERFLOW-125)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 200 }, 'gift-card');
      expectCentsEqual(await checkoutPage.subtotalCents(), 200, 'subtotal after price override');

      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title('$3.00 single line redeems and settles (TC-ORDERFLOW-126)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 300 }, 'gift-card');
      expectCentsEqual(await checkoutPage.subtotalCents(), 300, 'subtotal after price override');

      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$1.00 + item discount redeems and settles (TC-ORDERFLOW-127)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 100, discount: true }, 'gift-card');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$2.00, different staff tile, redeems and settles (TC-ORDERFLOW-128)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 200, staffIndex: 1 }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$1.50, different service tile, redeems and settles (TC-ORDERFLOW-129)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 150, serviceIndex: 1 }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$2.50, further staff/service tile, redeems and settles (TC-ORDERFLOW-130)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 250, staffIndex: 2, serviceIndex: 2 }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$3.50 + item discount redeems and settles (TC-ORDERFLOW-131)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 350, discount: true }, 'gift-card');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$1.25, further service tile, redeems and settles (TC-ORDERFLOW-132)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 125, serviceIndex: 2 }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$4.00, further staff/service tile, redeems and settles (TC-ORDERFLOW-133)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 400, staffIndex: 3, serviceIndex: 3 }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );
});
