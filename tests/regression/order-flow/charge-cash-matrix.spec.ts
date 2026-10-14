/**
 * Cash charge matrix — 10 successful cash settles, each a distinct point in the
 * amount / change / discount / staff matrix.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (EXTENDS the catalog, 94+):
 *   - TC-ORDERFLOW-94  exact tender, single line                  → payment-success
 *   - TC-ORDERFLOW-95  over-tender (typed), change = tendered-due → payment-success
 *   - TC-ORDERFLOW-96  over-tender (typed), change = tendered-due → payment-success
 *   - TC-ORDERFLOW-97  over-tender (typed), change = tendered-due → payment-success
 *   - TC-ORDERFLOW-98  two-line order, exact tender               → payment-success
 *   - TC-ORDERFLOW-99  three-line order, exact tender             → payment-success
 *   - TC-ORDERFLOW-100 price-override line ($40), exact tender    → payment-success
 *   - TC-ORDERFLOW-101 item discount, exact tender               → payment-success
 *   - TC-ORDERFLOW-102 booked to a different staff tile, exact    → payment-success
 *   - TC-ORDERFLOW-103 discount + over-tender (typed), change     → payment-success
 *
 * ## Why cash is the always-on tender
 *
 * Cash settles with NO hardware and NO customer display — `requiresTerminal`,
 * `requiresNetwork` and `requiresCustomerHandoff` are all false
 * (src/data/static/paymentMethods.ts). So unlike card / gift card / other-with-
 * tip, these run wherever writes are allowed, gated only by `assertWritesAllowed`
 * inside `payInCash`. They DO take real money: each case closes a real order.
 *
 * ## The keypad-overlap trap, and how over-tender is typed
 *
 * This build renders the $5/$10/$50/$100 preset column ON TOP of the digit keys,
 * so the "$50" button physically covers "9" and typing any amount containing a 9
 * stalls (see the checkout-keypad-preset-overlap note). It ALSO makes the presets
 * REPLACE the entry rather than accumulate onto the pre-filled due, so change can
 * no longer be dialled in by preset. Exact-tender cases settle the pre-filled due
 * (no typing); over-tender cases type a fixed 9-free amount ($888.88) through
 * {@link expectCashOverTenderChange} and assert change = tendered - due.
 *
 * ## Tip is deliberately absent
 *
 * The checkout Tip button is disabled on every tender on merchant 20258 (it needs
 * the customer-display handoff / a tip-after-payment config this merchant does not
 * have — checkout-tenders.spec.ts TC-47), and driving it needs the dual-window
 * launch lane. A tip does not belong on a cash matrix that must run in the plain
 * attach lane; the tip axis lives in charge-card-matrix.spec.ts instead.
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

describe('Order flow — Cash charge matrix', () => {
  before(() => assertWritesAllowed('build the cash charge matrix'));

  // A case that fails mid-settle can leave a draft on the till; the next case
  // assumes an empty one. openCheckout also voids first, so this is the backstop.
  afterEach(voidAnyDraft);

  it(
    title(
      'Exact tender, single line, settles (TC-ORDERFLOW-94)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'cash');

      // The field arrives pre-filled with the remaining due, so a full tender is
      // the untouched entry — enter nothing, owe nothing.
      const total = await checkoutPage.totalCents();
      expectCentsEqual(await checkoutPage.enteredAmountCents(), total, 'pre-filled cash due');
      expect(await checkoutPage.remainingCents()).toBe(0);
      expect(await checkoutPage.isChangeShown()).toBe(false);

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Over-tender computes change to the cent and settles (TC-ORDERFLOW-95)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'cash');

      await expectCashOverTenderChange();

      // payInCash with no tendered amount presses Complete Payment on the field
      // as-is (the typed over-tender), so the change stands.
      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Over-tender on a fresh single line settles (TC-ORDERFLOW-96)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'cash');

      await expectCashOverTenderChange();

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Over-tender on a repeat single line settles (TC-ORDERFLOW-97)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'cash');

      await expectCashOverTenderChange();

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title('Two-line order, exact tender, settles (TC-ORDERFLOW-98)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      // A second distinct line raises the balance; the pre-fill still clears it.
      const orderId = await openCheckout({ extraLines: 1 }, 'cash');

      const total = await checkoutPage.totalCents();
      expect(total).toBeGreaterThan(0);
      expectCentsEqual(await checkoutPage.enteredAmountCents(), total, 'pre-filled cash due');
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Three-line order, exact tender, settles (TC-ORDERFLOW-99)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 2 }, 'cash');

      const total = await checkoutPage.totalCents();
      expect(total).toBeGreaterThan(0);
      expectCentsEqual(await checkoutPage.enteredAmountCents(), total, 'pre-filled cash due');

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Price-override line ($40), exact tender, settles (TC-ORDERFLOW-100)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      // Pin the line price so the subtotal is a known figure, not the tile's own.
      const orderId = await openCheckout({ priceCents: 4_000 }, 'cash');

      expectCentsEqual(await checkoutPage.subtotalCents(), 4_000, 'subtotal after price override');
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title('Item discount, exact tender, settles (TC-ORDERFLOW-101)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ discount: true }, 'cash');

      // The discount rolls into the order-level Total Discount row, rendered
      // negative; the cash tender still pre-fills — and clears — the net due.
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);
      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Booked to a different staff tile, exact tender, settles (TC-ORDERFLOW-102)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      // Positional staff variation — tile 1 when the roster has one, else tile 0.
      const orderId = await openCheckout({ staffIndex: 1, serviceIndex: 1 }, 'cash');

      expect(await checkoutPage.remainingCents()).toBe(0);

      await expectSettled(await payInCash(orderId), orderId);
    },
  );

  it(
    title(
      'Discount + over-tender, change to the cent, settles (TC-ORDERFLOW-103)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ discount: true }, 'cash');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      // Change is the typed over-tender over the DISCOUNTED due.
      await expectCashOverTenderChange();

      await expectSettled(await payInCash(orderId), orderId);
    },
  );
});
