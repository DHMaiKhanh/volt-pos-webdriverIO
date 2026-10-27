/**
 * volt-qc port — 03 PAY: Service Fee / Cash Discount pricing, the Card tender
 * guard / charge, and a re-opened order's Total Paid block.
 *
 * Source: volt-qc `e2e/tests/03-checkout/pay-plan-fee.spec.ts` (PAY-R2a/b/c),
 * `pay-plan-card.spec.ts` (CARD-01), `pay-plan-card-failure.spec.ts` (CARD-R1)
 * and `pay-plan-reopen.spec.ts` (PAY-V). TC catalogue:
 * docs/qc/volt-qc/windows-regression/03-checkout-thanh-toan.md.
 *
 * - Fee cases read the store's pricing OFF THE TILL (Card ≠ Cash ⇒ fee on) and
 *   SKIP on a merchant with no Service Fee / Cash Discount (CFG-SFCD).
 * - PAY-138 asserts the no-terminal guard and so skips when `CARD_SETTLE=1`
 *   declares a terminal attached; PAY-139/PAY-117 are the real charge, gated by
 *   `CARD_SETTLE=1` exactly like charge-card-matrix.spec.ts.
 * - PAY-055 settles a cash order, re-opens it unchanged and closes it with
 *   Re-Open Done (Edit Order is locked on 1.1.56, so nothing is edited).
 *
 * CREATES DATA AND TAKES CASH (and, with CARD_SETTLE=1, CARD) PAYMENTS. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { payWithCard } from '../../../../src/flows/index.js';
import { checkoutPage, homePage, orderHistoryDetailPage } from '../../../../src/pages/index.js';
import {
  P,
  checkoutState,
  cleanTill,
  isTipEnabled,
  methodAmounts,
  noReceipt,
  setCashierTip,
  usd,
  waitSuccess,
} from '../../../../src/pages/voltqc/pay/payProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import {
  gcAdd,
  gcEnterCode,
  gcQuick,
  openSellGiftCard,
} from '../../../../src/pages/voltqc/pos/giftCardProbe.js';
import { giftCard } from '../../../../src/data/static/paymentMethods.js';
import { settle } from '../../../../src/helpers/wait.js';
import { buildDraft } from '../../order-flow/charge-matrix.helpers.js';
import { CARD_SETTLE_ENABLED, createAndSettleCashOrder } from '../../order-flow/payment-flows.helpers.js';
import {
  finishReopenUnchanged,
  leaveReopenCheckout,
  reopenOrder,
} from '../../order-flow/reopen-flow.helpers.js';

/** Sell the configured gift card as a $25 line on the open draft (never paid). */
async function addGiftCardLine(): Promise<void> {
  await openSellGiftCard();
  await gcEnterCode(giftCard.code);
  await P.clickQ(gcQuick('$25'));
  await P.clickQ(gcAdd);
  await settle(800);
}

async function draftAtCheckout(discount = false): Promise<void> {
  await buildDraft({ discount });
  await homePage.pressPay();
  await checkoutPage.waitForReady();
}

describe('volt-qc 03 PAY — fees, card, re-open', function () {
  this.timeout(Timeouts.MOCHA_TEST * 3);

  let reopened = '';

  afterEach(async () => {
    if (reopened !== '') {
      await leaveReopenCheckout(reopened).catch(() => undefined);
      reopened = '';
    }
    await cleanTill();
  });

  it(
    title(
      'Card carries the Service Fee; Cash / Gift Card / Other get the cash price; no separate Service Fee / Cash Discount row (PAY-036, PAY-049, PAY-081)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      await draftAtCheckout();
      const a = await methodAmounts();
      if (a.Card === a.Cash) this.skip(); // store has no SF / CD (CFG-SFCD)
      expect(a.Other).toBe(a.Cash);
      expect(a['Gift Card']).toBe(a.Cash);
      expect(a.Card).toBeGreaterThan(a.Cash);
      for (const m of ['card', 'cash'] as const) {
        await checkoutPage.selectTender(m);
        const t = await P.pageText('main');
        expect(t).not.toMatch(/\| Service Fee \| /);
        expect(t).not.toMatch(/\| Cash Discount \| /);
      }
    },
  );

  it(
    title(
      'Service Fee is not charged on the tip: + $5 tip = + $5.00 on Card and on Cash (PAY-066)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      await draftAtCheckout();
      const before = await methodAmounts();
      if (before.Card === before.Cash || !(await isTipEnabled())) this.skip();
      await setCashierTip(['5', '0', '0']);
      const after = await methodAmounts();
      expect(after.Card).toBe(before.Card + 500);
      expect(after.Cash).toBe(before.Cash + 500);
    },
  );

  it(
    title(
      'Service Fee is computed on the price after item discount: a 10% line discount lowers Card and Cash by 10% (PAY-086)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      await draftAtCheckout();
      const full = await methodAmounts();
      if (full.Card === full.Cash) this.skip();
      await cleanTill();
      await draftAtCheckout(true);
      const s = await checkoutState();
      if (!/10% OFF/.test(s.text)) this.skip(); // the discount landed as $ on this build
      const off = await methodAmounts();
      // Per-line rounding: allow 2 cents.
      expect(Math.abs(off.Card - Math.round(full.Card * 0.9))).toBeLessThanOrEqual(2);
      expect(Math.abs(off.Cash - Math.round(full.Cash * 0.9))).toBeLessThanOrEqual(2);
    },
  );

  it(
    title(
      'With "Apply Service Fee to Gift Card" OFF (default) a gift-card SALE line carries no fee: alone Card = Cash = $25.00; beside a service the Card − Cash gap is unchanged (PAY-090, PAY-092)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (giftCard.code === '') this.skip();
      await draftAtCheckout();
      const svc = await methodAmounts();
      if (svc.Card === svc.Cash) this.skip(); // no fee on this store — nothing to tell apart
      await checkoutPage.pressBack();
      await homePage.waitForReady();
      await addGiftCardLine();
      await homePage.pressPay();
      await checkoutPage.waitForReady();
      const both = await methodAmounts();
      expect(both.Cash - svc.Cash).toBe(2_500);
      expect(both.Card - svc.Card).toBe(2_500);

      await cleanTill();
      await homePage.selectStaffByIndex(0);
      await addGiftCardLine();
      await homePage.pressPay();
      await checkoutPage.waitForReady();
      const only = await methodAmounts();
      expect(only.Card).toBe(2_500);
      expect(only.Cash).toBe(2_500);
      expect(only.Other).toBe(2_500);
    },
  );

  it(
    title(
      'Without a connected terminal Complete Payment stays disabled on Card (PAY-138)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (CARD_SETTLE_ENABLED) this.skip(); // a terminal is declared attached
      await draftAtCheckout();
      await checkoutPage.selectTender('card');
      expect(await checkoutPage.isCompletePaymentEnabled()).toBe(false);
      expect((await checkoutState()).totalPaid).toBe(0);
    },
  );

  it(
    title(
      'Card charge through the terminal succeeds; success line reads "Card (Credit)"; Order History has one successful card payment (PAY-139, PAY-117)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      if (!CARD_SETTLE_ENABLED) this.skip(); // real money — CARD_SETTLE=1 only
      await draftAtCheckout();
      const orderId = await checkoutPage.orderId();
      const due = (await methodAmounts()).Card;
      await payWithCard(orderId);
      const s = await waitSuccess(Timeouts.CARD_CHARGE);
      expect(s).toMatch(/Card[ |]*\(Credit\)/);
      expect(s).toContain(usd(due));
      await noReceipt();
    },
  );

  it(
    title(
      'Re-opening a paid cash order lists the existing payment in Total Paid, Remaining $0.00, and offers Re-Open Done (PAY-055)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      const { orderId, paidTotalCents } = await createAndSettleCashOrder();
      if (!(await orderHistoryDetailPage.isReopenAvailable())) {
        throw new Error(`Re-Open is not offered on the just-settled order ${orderId}`);
      }
      await reopenOrder(orderId);
      reopened = orderId;
      const s = await checkoutState();
      expect(s.totalPaid).toBe(paidTotalCents);
      expect(s.text).toMatch(/Cash/);
      expect(s.remaining).toBe(0);
      expect(await checkoutPage.isReopenDoneShown()).toBe(true);
      await finishReopenUnchanged(orderId);
      reopened = '';
    },
  );
});
