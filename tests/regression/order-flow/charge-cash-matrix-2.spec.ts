/**
 * Cash charge matrix, batch 2 — 10 more successful cash settles on scenarios the
 * first matrix did not touch: Quick Pay orders, large price overrides, deep
 * multi-line carts, and a noted line.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (EXTENDS the catalog, 134+):
 *   - TC-ORDERFLOW-134 Quick Pay $50, exact tender              → payment-success
 *   - TC-ORDERFLOW-135 Quick Pay $60 + over-tender (typed)      → payment-success
 *   - TC-ORDERFLOW-136 price-override $100, exact tender        → payment-success
 *   - TC-ORDERFLOW-137 price-override $250, exact tender        → payment-success
 *   - TC-ORDERFLOW-138 price-override $500, exact tender        → payment-success
 *   - TC-ORDERFLOW-139 four-line order, exact tender            → payment-success
 *   - TC-ORDERFLOW-140 five-line order, exact tender            → payment-success
 *   - TC-ORDERFLOW-141 noted line, exact tender                 → payment-success
 *   - TC-ORDERFLOW-142 price-override $100 + discount, exact    → payment-success
 *   - TC-ORDERFLOW-143 Quick Pay $120 + note, over-tender (typed) → payment-success
 *
 * Same lane and gating as charge-cash-matrix.spec.ts: cash needs no hardware and
 * no customer display, so these run wherever writes are allowed and take real
 * money. Over-tender cases type a fixed 9-free amount and assert change = tendered
 * - due: this build's presets REPLACE the entry rather than accumulate, and the
 * "$50" preset covers the "9" key (see the checkout-keypad-preset-overlap note).
 *
 * CREATES DATA AND TAKES PAYMENTS: ten cash sales are settled. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { payInCash } from '../../../src/flows/index.js';
import { checkoutPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../src/utils/money.js';
import {
  expectCashOverTenderChange,
  expectSettled,
  openCheckout,
  voidAnyDraft,
} from './charge-matrix.helpers.js';

describe('Order flow — Cash charge matrix (batch 2)', () => {
  before(() => assertWritesAllowed('build the cash charge matrix (batch 2)'));

  afterEach(voidAnyDraft);

  it(
    title(
      'Quick Pay $50, exact tender, settles (TC-ORDERFLOW-134)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      // Quick Pay sells an arbitrary amount with no catalogue row — a different
      // creation path than the service tiles the first matrix used.
      const orderId = await openCheckout({ quickPay: { amountCents: 5_000, name: 'Cash QP 50' } }, 'cash');

      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Quick Pay $60 + over-tender, change to the cent, settles (TC-ORDERFLOW-135)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ quickPay: { amountCents: 6_000, name: 'Cash QP 60' } }, 'cash');

      await expectCashOverTenderChange();

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Price-override $100, exact tender, settles (TC-ORDERFLOW-136)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 10_000 }, 'cash');
      expectCentsEqual(await checkoutPage.subtotalCents(), 10_000, 'subtotal after price override');
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Price-override $250, exact tender, settles (TC-ORDERFLOW-137)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 25_000 }, 'cash');
      expectCentsEqual(await checkoutPage.subtotalCents(), 25_000, 'subtotal after price override');

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Price-override $500, exact tender, settles (TC-ORDERFLOW-138)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 50_000 }, 'cash');
      expectCentsEqual(await checkoutPage.subtotalCents(), 50_000, 'subtotal after price override');

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Four-line order, exact tender, settles (TC-ORDERFLOW-139)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 3 }, 'cash');
      const total = await checkoutPage.totalCents();
      expect(total).toBeGreaterThan(0);
      expectCentsEqual(await checkoutPage.enteredAmountCents(), total, 'pre-filled cash due');

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Five-line order, exact tender, settles (TC-ORDERFLOW-140)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 4 }, 'cash');
      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title('Noted line, exact tender, settles (TC-ORDERFLOW-141)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      // A per-line note is order metadata; it must not block the settle.
      const orderId = await openCheckout({ serviceNote: 'Extra hot towel' }, 'cash');
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Price-override $100 + discount, exact tender, settles (TC-ORDERFLOW-142)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 10_000, discount: true }, 'cash');
      expectCentsEqual(await checkoutPage.subtotalCents(), 10_000, 'subtotal after price override');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Quick Pay $120 + note, over-tender, change to the cent, settles (TC-ORDERFLOW-143)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout(
        { quickPay: { amountCents: 12_000, name: 'Cash QP 120', note: 'Package deal' } },
        'cash',
      );

      await expectCashOverTenderChange();

      await expectSettled(await payInCash(orderId), orderId);
    },
  );
});
