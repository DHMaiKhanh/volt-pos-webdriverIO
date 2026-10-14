/**
 * Gift-card charge matrix, batch 2 — 10 more successful redemptions on scenarios
 * the first matrix did not cover: Quick Pay lines, noted lines, and a further
 * staff/service spread. Amounts stay TINY ($1–$3) because every redemption drains
 * the shared card.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (EXTENDS the catalog, 164+):
 *   - TC-ORDERFLOW-164 Quick Pay $1.00                          → payment-success
 *   - TC-ORDERFLOW-165 $2.00 + noted line                       → payment-success
 *   - TC-ORDERFLOW-166 Quick Pay $1.50                          → payment-success
 *   - TC-ORDERFLOW-167 $2.50 + noted line                       → payment-success
 *   - TC-ORDERFLOW-168 $3.00 + discount + noted line            → payment-success
 *   - TC-ORDERFLOW-169 Quick Pay $1.25                          → payment-success
 *   - TC-ORDERFLOW-170 $2.00, further staff tile                → payment-success
 *   - TC-ORDERFLOW-171 $1.75, further service tile              → payment-success
 *   - TC-ORDERFLOW-172 Quick Pay $2.25, different staff tile     → payment-success
 *   - TC-ORDERFLOW-173 $3.00, further staff tile + noted line   → payment-success
 *
 * Same gate and protections as charge-giftcard-matrix.spec.ts: behind
 * CHARGE_SETTLE=1, skipped when no card is configured, and every case kept small
 * so the ten together spend ~$20 + tax rather than draining the card. A run-dry
 * mid-file surfaces as `payWithGiftCard`'s "does not cover the balance — split
 * payment" error, not a silent failure.
 *
 *     CHARGE_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/order-flow/charge-giftcard-matrix-2.spec.ts
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
import { expectSettled, openCheckout, voidAnyDraft } from './charge-matrix.helpers.js';

/** Opt-in for the real redemption — same flag charge-discount-tip.spec.ts uses for cash/gift/other. */
const SETTLE_ENABLED = process.env.CHARGE_SETTLE === '1';

/** Skip when the settle is not opted in, or when the merchant has no card configured to spend. */
function requireRedeemable(ctx: Mocha.Context): void {
  if (!SETTLE_ENABLED) ctx.skip();
  if (giftCard.code === '') ctx.skip();
  ctx.timeout(Timeouts.MOCHA_HOOK);
}

describe('Order flow — Gift-card charge matrix (batch 2)', () => {
  before(() => assertWritesAllowed('build the gift-card charge matrix (batch 2)'));

  afterEach(voidAnyDraft);

  it(
    title(
      'Quick Pay $1.00 redeems and settles (TC-ORDERFLOW-164)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ quickPay: { amountCents: 100, name: 'GC QP 1' } }, 'gift-card');
      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);

      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$2.00 + noted line redeems and settles (TC-ORDERFLOW-165)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 200, serviceNote: 'GC noted' }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title('Quick Pay $1.50 redeems and settles (TC-ORDERFLOW-166)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ quickPay: { amountCents: 150, name: 'GC QP 1.5' } }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$2.50 + noted line redeems and settles (TC-ORDERFLOW-167)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 250, serviceNote: 'Rebook' }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$3.00 + discount + noted line redeems and settles (TC-ORDERFLOW-168)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout(
        { priceCents: 300, discount: true, serviceNote: 'Promo' },
        'gift-card',
      );
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title('Quick Pay $1.25 redeems and settles (TC-ORDERFLOW-169)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ quickPay: { amountCents: 125, name: 'GC QP 1.25' } }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$2.00, further staff tile, redeems and settles (TC-ORDERFLOW-170)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 200, staffIndex: 3 }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$1.75, further service tile, redeems and settles (TC-ORDERFLOW-171)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout({ priceCents: 175, serviceIndex: 3 }, 'gift-card');
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      'Quick Pay $2.25, different staff tile, redeems and settles (TC-ORDERFLOW-172)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout(
        { quickPay: { amountCents: 225, name: 'GC QP 2.25' }, staffIndex: 1 },
        'gift-card',
      );
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );

  it(
    title(
      '$3.00, further staff tile + noted line, redeems and settles (TC-ORDERFLOW-173)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      requireRedeemable(this);

      const orderId = await openCheckout(
        { priceCents: 300, staffIndex: 2, serviceNote: 'Thank you' },
        'gift-card',
      );
      await expectSettled(await payWithGiftCard(orderId, giftCard.code), orderId);
    },
  );
});
