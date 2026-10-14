/**
 * Card charge matrix, batch 2 — 10 more successful card charges, pairing the tip
 * axis with scenarios the first matrix did not cover: Quick Pay, large price
 * overrides, deep multi-line carts and a noted line.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (EXTENDS the catalog, 154+):
 *   - TC-ORDERFLOW-154 no tip, Quick Pay $50                    → payment-success
 *   - TC-ORDERFLOW-155 tip 20%, price-override $100             → payment-success
 *   - TC-ORDERFLOW-156 tip 15%, price-override $250             → payment-success
 *   - TC-ORDERFLOW-157 tip 25%, four-line order                → payment-success
 *   - TC-ORDERFLOW-158 no tip, five-line order                 → payment-success
 *   - TC-ORDERFLOW-159 tip 10%, noted line                     → payment-success
 *   - TC-ORDERFLOW-160 tip 20%, Quick Pay $80                  → payment-success
 *   - TC-ORDERFLOW-161 no tip, price-override $500             → payment-success
 *   - TC-ORDERFLOW-162 tip 20% + discount + price $100         → payment-success
 *   - TC-ORDERFLOW-163 tip 15%, four-line + discount           → payment-success
 *
 * Same gate and prerequisites as charge-card-matrix.spec.ts: real, non-undoable
 * charges behind CARD_SETTLE=1, needing the launch lane (customer display), a
 * terminal, and a passcode the merchant accepts for `completed_payment`. Without
 * the flag all ten skip.
 *
 *     CARD_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/order-flow/charge-card-matrix-2.spec.ts
 *
 * CREATES DATA. Takes card payments ONLY under CARD_SETTLE=1. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { payWithCard } from '../../../src/flows/index.js';
import { checkoutPage } from '../../../src/pages/index.js';
import type { PaymentSuccessPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { endSale, openCheckout, voidAnyDraft } from './charge-matrix.helpers.js';

/** Opt-in for the real, money-moving card charge. See the module note. */
const CARD_SETTLE_ENABLED = process.env.CARD_SETTLE === '1';

/** The card charge's shared post-condition: success screen for THIS order, all receipt actions, end the sale. */
async function expectCharged(success: PaymentSuccessPage, orderId: string): Promise<void> {
  expect(await success.orderId()).toBe(orderId);
  expect(await success.isActive()).toBe(true);
  expect(await success.areAllReceiptActionsShown()).toBe(true);
  await endSale();
}

/**
 * Charge with a tip of `pct`% of the subtotal, typed as a custom amount.
 *
 * Merchant 20258's customer display exposes no percent presets — only Custom Tip
 * + No Tip — so passing `{ tip: 20 }` here looks for a "customer tip option 20"
 * tile that does not exist and the charge stalls at the tip prompt. A "tip 15%"
 * case therefore enters 15% of the subtotal on the Custom Tip keypad, which lands
 * on the exact dollar figure the app previews for that percent. Read the subtotal
 * while checkout is still up (payWithCard leaves it for the customer display),
 * then hand the cents to the card flow. Same helper as charge-card-matrix.spec.ts.
 */
async function chargeWithPercentTip(orderId: string, pct: number): Promise<PaymentSuccessPage> {
  const subtotal = await checkoutPage.subtotalCents();
  const customTipCents = Math.max(1, Math.round((subtotal * pct) / 100));
  return payWithCard(orderId, { customTipCents });
}

describe('Order flow — Card charge matrix (batch 2)', () => {
  before(() => assertWritesAllowed('build the card charge matrix (batch 2)'));

  afterEach(voidAnyDraft);

  it(
    title(
      'No tip, Quick Pay $50, charges and settles (TC-ORDERFLOW-154)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ quickPay: { amountCents: 5_000, name: 'Card QP 50' } }, 'card');
      await expectCharged(await payWithCard(orderId, { tip: 'none' }), orderId);
    },
  );

  it(
    title(
      'Tip 20%, price-override $100, charges and settles (TC-ORDERFLOW-155)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 10_000 }, 'card');
      await expectCharged(await chargeWithPercentTip(orderId, 20), orderId);
    },
  );

  it(
    title(
      'Tip 15%, price-override $250, charges and settles (TC-ORDERFLOW-156)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 25_000 }, 'card');
      await expectCharged(await chargeWithPercentTip(orderId, 15), orderId);
    },
  );

  it(
    title(
      'Tip 25%, four-line order, charges and settles (TC-ORDERFLOW-157)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 3 }, 'card');
      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);
      await expectCharged(await chargeWithPercentTip(orderId, 25), orderId);
    },
  );

  it(
    title(
      'No tip, five-line order, charges and settles (TC-ORDERFLOW-158)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 4 }, 'card');
      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);
      await expectCharged(await payWithCard(orderId, { tip: 'none' }), orderId);
    },
  );

  it(
    title(
      'Tip 10%, noted line, charges and settles (TC-ORDERFLOW-159)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ serviceNote: 'Card w/ note' }, 'card');
      await expectCharged(await chargeWithPercentTip(orderId, 10), orderId);
    },
  );

  it(
    title(
      'Tip 20%, Quick Pay $80, charges and settles (TC-ORDERFLOW-160)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ quickPay: { amountCents: 8_000, name: 'Card QP 80' } }, 'card');
      await expectCharged(await chargeWithPercentTip(orderId, 20), orderId);
    },
  );

  it(
    title(
      'No tip, price-override $500, charges and settles (TC-ORDERFLOW-161)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 50_000 }, 'card');
      await expectCharged(await payWithCard(orderId, { tip: 'none' }), orderId);
    },
  );

  it(
    title(
      'Tip 20% + discount + price $100, charges and settles (TC-ORDERFLOW-162)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 10_000, discount: true }, 'card');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectCharged(await chargeWithPercentTip(orderId, 20), orderId);
    },
  );

  it(
    title(
      'Tip 15%, four-line + discount, charges and settles (TC-ORDERFLOW-163)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 3, discount: true }, 'card');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectCharged(await chargeWithPercentTip(orderId, 15), orderId);
    },
  );
});
