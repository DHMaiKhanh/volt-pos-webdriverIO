/**
 * card-charge-payment-success-fail-test-cases — card payment success and
 * failure scenarios (volt-qc per-ticket file
 * `docs/qc/volt-qc/vp-tickets/card-charge-payment-success-fail-test-cases.md`).
 *
 * ## What can run
 *
 * A real card charge needs the LAUNCH lane (the customer display drives tip and
 * signature), a Bamboo DOT terminal with an operator tapping a card, and it
 * moves money. The three plain success rows run behind the suite's opt-in
 * `CARD_SETTLE=1` (same gate as tests/regression/order-flow/charge-card-matrix.spec.ts);
 * without it they skip.
 *
 * Everything else needs a specific card (declined / expired / stolen / Amex /
 * daily limit / partial approval), a gateway fault (timeout-but-approved, refund
 * declined), a terminal fault (network / Bluetooth drop, cancel on terminal,
 * crash mid-charge) or a printer — MANUAL.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { payWithCard } from '../../../../src/flows/index.js';
import { checkoutPage, homePage } from '../../../../src/pages/index.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { endSale, openCheckout } from '../../order-flow/charge-matrix.helpers.js';
import { voidAnyDraft } from './vp-tickets.helpers.js';

const CARD_SETTLE_ENABLED = process.env.CARD_SETTLE === '1';

describe('card-charge-payment-success-fail-test-cases — Card payment success & failure', () => {
  before(() => assertWritesAllowed('take card payments'));
  afterEach(voidAnyDraft);

  it(
    title(
      'card-charge-payment-success-fail-test-cases A1 A tapped card with enough funds is approved and the order settles',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);
      const orderId = await openCheckout({}, 'card');
      const success = await payWithCard(orderId, { tip: 'none' });
      expect(await success.orderId()).toBe(orderId);
      await endSale();
    },
  );

  it(
    title(
      'card-charge-payment-success-fail-test-cases A2 The full order total is paid with one card',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);
      const orderId = await openCheckout({ extraLines: 1 }, 'card');
      const due = await checkoutPage.totalCents();
      expect(due).toBeGreaterThan(0);
      const success = await payWithCard(orderId, { tip: 'none' });
      expect(await success.isActive()).toBe(true);
      await endSale();
    },
  );

  it(
    title(
      'card-charge-payment-success-fail-test-cases A10 The card is charged the total AFTER a line discount',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!CARD_SETTLE_ENABLED) this.skip();
      this.timeout(Timeouts.MOCHA_HOOK);
      await voidAnyDraft();
      await homePage.selectFirstStaff();
      await homePage.addFirstService();
      const before = await homePage.cartTotal();
      await homePage.openServiceEditor();
      if (!(await homePage.isItemDiscountOn())) await homePage.toggleItemDiscount();
      await homePage.setItemDiscount('10');
      await homePage.saveServiceEditor();
      const after = await homePage.cartTotal();
      expect(after).toBeLessThan(before);

      await homePage.pressPay();
      await checkoutPage.waitForReady();
      expect(await checkoutPage.totalCents()).toBe(after);
      const success = await payWithCard(await checkoutPage.orderId(), { tip: 'none' });
      expect(await success.isActive()).toBe(true);
      await endSale();
    },
  );
});
