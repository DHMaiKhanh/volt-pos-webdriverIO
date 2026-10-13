/**
 * Card charge matrix — 10 successful card charges, each a distinct point in the
 * tip / amount / discount / staff matrix.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (EXTENDS the catalog, 114+):
 *   - TC-ORDERFLOW-114 no tip, single line                      → payment-success
 *   - TC-ORDERFLOW-115 tip 10%, single line                     → payment-success
 *   - TC-ORDERFLOW-116 tip 15%, single line                     → payment-success
 *   - TC-ORDERFLOW-117 tip 20%, single line                     → payment-success
 *   - TC-ORDERFLOW-118 tip 25%, single line                     → payment-success
 *   - TC-ORDERFLOW-119 no tip, two-line order                   → payment-success
 *   - TC-ORDERFLOW-120 no tip, price-override ($30)             → payment-success
 *   - TC-ORDERFLOW-121 item discount + tip 20%                  → payment-success
 *   - TC-ORDERFLOW-122 item discount + no tip, two lines        → payment-success
 *   - TC-ORDERFLOW-123 tip 15% + different staff/service tile    → payment-success
 *
 * ## Why every case is gated behind CARD_SETTLE=1
 *
 * A card charge is real and NOT undoable: `payWithCard` presses Complete Payment
 * (passcode guard), drives the CUSTOMER DISPLAY's tip + both signatures, and waits
 * on a Bamboo DOT terminal that approves the tapped card while money moves on the
 * dev gateway. The charging dialog has no cancel, so an unattended lane that ran
 * this blindly would wedge on the no-terminal stall. It therefore runs ONLY when
 * an operator at the terminal opts in — the SAME gate as card-payment.spec.ts
 * TC-84:
 *
 *     CARD_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/order-flow/charge-card-matrix.spec.ts
 *
 * `SPEC_RETRIES=0` because a file retry would re-attempt every charge. Without the
 * flag all ten skip.
 *
 * ## What it needs (beyond the flag)
 *
 * The LAUNCH lane — the customer display is only a WebDriver handle there, hence
 * `@dual-window` — a STAFF_PASSCODE the merchant accepts for `completed_payment`
 * (merchant 20258 = 8888 in .env.dev; the 9999 sample is rejected), and a terminal
 * that approves the charge. The charge does not complete until the display's tip
 * (+ signature) is driven, so the tip is a REAL part of each case, not decoration.
 *
 * A merchant without percent presets (20258 shows only Custom Tip + No Tip) has
 * the percentage cases type that percent of the subtotal on the Custom Tip
 * keypad — see {@link chargeWithPercentTip} — which lands on the same dollar the
 * app previews for the percent. The no-tip cases press No Tip directly.
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
 * + No Tip — so a "tip 15%" case enters 15% of the subtotal on the keypad, which
 * lands on the exact dollar figure the app previews for that percent. Read the
 * subtotal while checkout is still up (payWithCard leaves it for the customer
 * display), then hand the cents to the card flow.
 */
async function chargeWithPercentTip(orderId: string, pct: number): Promise<PaymentSuccessPage> {
  const subtotal = await checkoutPage.subtotalCents();
  const customTipCents = Math.max(1, Math.round((subtotal * pct) / 100));
  return payWithCard(orderId, { customTipCents });
}

describe('Order flow — Card charge matrix', () => {
  before(() => assertWritesAllowed('build the card charge matrix'));

  afterEach(voidAnyDraft);

  it(
    title(
      'No tip, single line, charges and settles (TC-ORDERFLOW-114)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'card');
      await expectCharged(await payWithCard(orderId, { tip: 'none' }), orderId);
    },
  );

  it(
    title(
      'Tip 10%, single line, charges and settles (TC-ORDERFLOW-115)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'card');
      await expectCharged(await chargeWithPercentTip(orderId, 10), orderId);
    },
  );

  it(
    title(
      'Tip 15%, single line, charges and settles (TC-ORDERFLOW-116)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'card');
      await expectCharged(await chargeWithPercentTip(orderId, 15), orderId);
    },
  );

  it(
    title(
      'Tip 20%, single line, charges and settles (TC-ORDERFLOW-117)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'card');
      await expectCharged(await chargeWithPercentTip(orderId, 20), orderId);
    },
  );

  it(
    title(
      'Tip 25%, single line, charges and settles (TC-ORDERFLOW-118)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({}, 'card');
      await expectCharged(await chargeWithPercentTip(orderId, 25), orderId);
    },
  );

  it(
    title(
      'No tip, two-line order, charges and settles (TC-ORDERFLOW-119)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 1 }, 'card');
      expect(await checkoutPage.totalCents()).toBeGreaterThan(0);
      await expectCharged(await payWithCard(orderId, { tip: 'none' }), orderId);
    },
  );

  it(
    title(
      'No tip, price-override ($30), charges and settles (TC-ORDERFLOW-120)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ priceCents: 3_000 }, 'card');
      await expectCharged(await payWithCard(orderId, { tip: 'none' }), orderId);
    },
  );

  it(
    title(
      'Item discount + tip 20%, charges and settles (TC-ORDERFLOW-121)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ discount: true }, 'card');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectCharged(await chargeWithPercentTip(orderId, 20), orderId);
    },
  );

  it(
    title(
      'Item discount + no tip, two lines, charges and settles (TC-ORDERFLOW-122)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ extraLines: 1, discount: true }, 'card');
      expect(await checkoutPage.isDiscountShown()).toBe(true);
      expect(await checkoutPage.discountCents()).toBeLessThan(0);

      await expectCharged(await payWithCard(orderId, { tip: 'none' }), orderId);
    },
  );

  it(
    title(
      'Tip 15% + different staff/service tile, charges and settles (TC-ORDERFLOW-123)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);

      const orderId = await openCheckout({ staffIndex: 1, serviceIndex: 1 }, 'card');
      await expectCharged(await chargeWithPercentTip(orderId, 15), orderId);
    },
  );
});
