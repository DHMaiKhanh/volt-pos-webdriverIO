/**
 * "Other" charge matrix, batch 2 — 10 more successful settles under a labelled
 * tender, on scenarios the first matrix did not cover: new labels, Quick Pay,
 * large price overrides, deep multi-line carts and a noted line.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (EXTENDS the catalog, 144+):
 *   - TC-ORDERFLOW-144 PayPal, Quick Pay $50                    → payment-success
 *   - TC-ORDERFLOW-145 Check, price-override $100               → payment-success
 *   - TC-ORDERFLOW-146 Wire Transfer, price-override $250       → payment-success
 *   - TC-ORDERFLOW-147 Store Credit, price-override $500        → payment-success
 *   - TC-ORDERFLOW-148 PayPal, four-line order                  → payment-success
 *   - TC-ORDERFLOW-149 PayPal, five-line order                  → payment-success
 *   - TC-ORDERFLOW-150 Zelle, noted line                        → payment-success
 *   - TC-ORDERFLOW-151 PayPal, price-override $100 + discount   → payment-success
 *   - TC-ORDERFLOW-152 Money Order, Quick Pay $200              → payment-success
 *   - TC-ORDERFLOW-153 PayPal, discount + noted line            → payment-success
 *
 * Same lane and gating as charge-other-matrix.spec.ts: Other settles online with
 * no terminal and no customer display, and stays TAXED like card. It clamps the
 * entry to the balance due, so there is no change axis; the amount varies by
 * Quick Pay, price and line count.
 *
 * CREATES DATA AND TAKES PAYMENTS: ten "Other" sales are settled. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { payWithOther } from '../../../src/flows/index.js';
import { checkoutPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../src/utils/money.js';
import { expectSettled, openCheckout, voidAnyDraft } from './charge-matrix.helpers.js';

describe('Order flow — "Other" charge matrix (batch 2)', () => {
  before(() => assertWritesAllowed('build the "Other" charge matrix (batch 2)'));

  afterEach(voidAnyDraft);

  it(
    title(
      'PayPal, Quick Pay $50, settles (TC-ORDERFLOW-144)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ quickPay: { amountCents: 5_000, name: 'Other QP 50' } }, 'other');
      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payWithOther(orderId, 'PayPal'), orderId);
    },
  );

  it(
    title('Check, price-override $100, settles (TC-ORDERFLOW-145)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 10_000 }, 'other');
      expectCentsEqual(await checkoutPage.subtotalCents(), 10_000, 'subtotal after price override');

      await expectSettled(await payWithOther(orderId, 'Check'), orderId);
    },
  );

  it(
    title(
      'Wire Transfer, price-override $250, settles (TC-ORDERFLOW-146)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 25_000 }, 'other');
      expectCentsEqual(await checkoutPage.subtotalCents(), 25_000, 'subtotal after price override');

      await expectSettled(await payWithOther(orderId, 'Wire Transfer'), orderId);
    },
  );

  it(
    title(
      'Store Credit, price-override $500, settles (TC-ORDERFLOW-147)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 50_000 }, 'other');
      expectCentsEqual(await checkoutPage.subtotalCents(), 50_000, 'subtotal after price override');

      await expectSettled(await payWithOther(orderId, 'Store Credit'), orderId);
    },
  );

  it(
    title('PayPal, four-line order, settles (TC-ORDERFLOW-148)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 3 }, 'other');
      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);

      await expectSettled(await payWithOther(orderId, 'PayPal'), orderId);
    },
  );

  it(
    title('PayPal, five-line order, settles (TC-ORDERFLOW-149)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 4 }, 'other');
      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);

      await expectSettled(await payWithOther(orderId, 'PayPal'), orderId);
    },
  );

  it(
    title('Zelle, noted line, settles (TC-ORDERFLOW-150)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ serviceNote: 'Loyalty regular' }, 'other');
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payWithOther(orderId, 'Zelle'), orderId);
    },
  );

  it(
    title(
      'PayPal, price-override $100 + discount, settles (TC-ORDERFLOW-151)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 10_000, discount: true }, 'other');
      expectCentsEqual(await checkoutPage.subtotalCents(), 10_000, 'subtotal after price override');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectSettled(await payWithOther(orderId, 'PayPal'), orderId);
    },
  );

  it(
    title('Money Order, Quick Pay $200, settles (TC-ORDERFLOW-152)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout(
        { quickPay: { amountCents: 20_000, name: 'Other QP 200' } },
        'other',
      );
      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);

      await expectSettled(await payWithOther(orderId, 'Money Order'), orderId);
    },
  );

  it(
    title(
      'PayPal, discount + noted line, settles (TC-ORDERFLOW-153)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ discount: true, serviceNote: 'VIP' }, 'other');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectSettled(await payWithOther(orderId, 'PayPal'), orderId);
    },
  );
});
