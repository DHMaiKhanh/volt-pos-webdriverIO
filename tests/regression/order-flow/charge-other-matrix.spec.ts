/**
 * "Other" charge matrix — 10 successful settles under a labelled tender, each a
 * distinct point in the amount / discount / label / staff matrix.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (EXTENDS the catalog, 104+):
 *   - TC-ORDERFLOW-104 Zelle, single line, exact               → payment-success
 *   - TC-ORDERFLOW-105 Bank Transfer, label recorded            → payment-success
 *   - TC-ORDERFLOW-106 Personal Check, single line              → payment-success
 *   - TC-ORDERFLOW-107 Venmo, two-line order                    → payment-success
 *   - TC-ORDERFLOW-108 Cash App, three-line order               → payment-success
 *   - TC-ORDERFLOW-109 Zelle, price-override ($25)              → payment-success
 *   - TC-ORDERFLOW-110 Zelle + item discount                    → payment-success
 *   - TC-ORDERFLOW-111 Zelle, different staff/service tile       → payment-success
 *   - TC-ORDERFLOW-112 Zelle, further staff/service tile         → payment-success
 *   - TC-ORDERFLOW-113 Bank Transfer + discount + two lines     → payment-success
 *
 * ## What "Other" is, and is NOT
 *
 * Other is a LABELLED tender — "Zelle", "Bank Transfer", "Personal Check" — not
 * an untaxed one: tax stays applied exactly as it does for card, so every case
 * settles the full TAXED balance (checkout.flow.ts → payWithOther). It settles
 * ONLINE with no terminal and no customer display, so like cash these run
 * wherever writes are allowed — gated only by `assertWritesAllowed`. But unlike
 * cash it CLAMPS the entry to the balance due (`appendCashDigit`), so there is no
 * over-tender / change axis here; the amount varies by lines and price instead.
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

describe('Order flow — "Other" charge matrix', () => {
  before(() => assertWritesAllowed('build the "Other" charge matrix'));

  afterEach(voidAnyDraft);

  it(
    title(
      'Zelle, single line, exact, settles (TC-ORDERFLOW-104)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'other');

      // Other pre-fills the full taxed due and clamps to it — a full tender is the
      // untouched entry.
      const total = await checkoutPage.totalCents();
      expectCentsEqual(await checkoutPage.enteredAmountCents(), total, 'pre-filled "Other" due');
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payWithOther(orderId, 'Zelle'), orderId);
    },
  );

  it(
    title(
      'Bank Transfer label is recorded, settles (TC-ORDERFLOW-105)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'other');

      // The label is what makes an "Other" sale assertable downstream — it echoes
      // on the receipt as `Other (Bank Transfer)`. Prove it took before settling.
      await checkoutPage.selectOtherTender();
      await checkoutPage.enterOtherMethodName('Bank Transfer');
      expect(await checkoutPage.otherMethodName()).toBe('Bank Transfer');

      await expectSettled(await payWithOther(orderId, 'Bank Transfer'), orderId);
    },
  );

  it(
    title('Personal Check, single line, settles (TC-ORDERFLOW-106)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'other');
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payWithOther(orderId, 'Personal Check'), orderId);
    },
  );

  it(
    title('Venmo, two-line order, settles (TC-ORDERFLOW-107)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 1 }, 'other');

      const total = await checkoutPage.totalCents();
      expect(total).toBeGreaterThan(0);
      expectCentsEqual(await checkoutPage.enteredAmountCents(), total, 'pre-filled "Other" due');

      await expectSettled(await payWithOther(orderId, 'Venmo'), orderId);
    },
  );

  it(
    title('Cash App, three-line order, settles (TC-ORDERFLOW-108)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 2 }, 'other');
      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);

      await expectSettled(await payWithOther(orderId, 'Cash App'), orderId);
    },
  );

  it(
    title('Zelle, price-override ($25), settles (TC-ORDERFLOW-109)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 2_500 }, 'other');

      expectCentsEqual(await checkoutPage.subtotalCents(), 2_500, 'subtotal after price override');

      await expectSettled(await payWithOther(orderId, 'Zelle'), orderId);
    },
  );

  it(
    title('Zelle + item discount, settles (TC-ORDERFLOW-110)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ discount: true }, 'other');

      // Other is taxed like card, so the discount and the tax both land — the net
      // due is what settles under the label.
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payWithOther(orderId, 'Zelle'), orderId);
    },
  );

  it(
    title(
      'Zelle, different staff/service tile, settles (TC-ORDERFLOW-111)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ staffIndex: 1, serviceIndex: 1 }, 'other');
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payWithOther(orderId, 'Zelle'), orderId);
    },
  );

  it(
    title(
      'Zelle, further staff/service tile, settles (TC-ORDERFLOW-112)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ staffIndex: 2, serviceIndex: 2 }, 'other');
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payWithOther(orderId, 'Zelle'), orderId);
    },
  );

  it(
    title(
      'Bank Transfer + discount + two lines, settles (TC-ORDERFLOW-113)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 1, discount: true }, 'other');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectSettled(await payWithOther(orderId, 'Bank Transfer'), orderId);
    },
  );
});
