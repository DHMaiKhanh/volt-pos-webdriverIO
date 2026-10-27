/**
 * volt-qc port — 03 PAY: the Gift Card tender at checkout.
 *
 * Source: volt-qc `e2e/tests/03-checkout/pay-plan-giftcard.spec.ts` (PAY-O0,
 * PAY-O, PAY-O3, PAY-O2), `payment.spec.ts` (PAY-F, PAY-G, PAY-H) and
 * `pay-deep.spec.ts` (PAY-D05). TC catalogue:
 * docs/qc/volt-qc/windows-regression/03-checkout-thanh-toan.md.
 *
 * Cards come from the merchant's configured card (`GIFT_CARD_CODE` /
 * `GIFT_CARD_BY_MERCHANT`) and the captured catalogue (`giftCards.json`: active
 * funded, active empty, inactive). A case whose card kind is missing on the
 * merchant under test SKIPS. The probing cases stop at "Gift Card Accepted" →
 * Cancel and spend nothing; only PAY-039 / PAY-048 / PAY-051 / PAY-128 redeem.
 *
 * Adaptations vs the source:
 * - No auto top-up (volt-qc `ensureGiftCardBalance`): the redeem cases skip when
 *   the order would exceed the card.
 * - PAY-012 sells the configured card as a $25 line through the Sell Gift Card
 *   dialog (pos port's `giftCardProbe`) and never pays it.
 *
 * CREATES DATA; PAY-039/048 REDEEM A GIFT CARD. dev / staging only.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { VqcPay } from '../../../../src/constants/testids.voltqc-pay.js';
import { giftCardCatalog, emptyActiveGiftCards } from '../../../../src/data/index.js';
import { INVALID_GIFT_CARD_CODE, giftCard } from '../../../../src/data/static/paymentMethods.js';
import { goToOrderHistory, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  checkoutPage,
  homePage,
  orderHistoryDetailPage,
  orderHistoryPage,
} from '../../../../src/pages/index.js';
import {
  P,
  checkoutState,
  cleanTill,
  closeGiftDialogs,
  dialogText,
  fillGiftCardCode,
  isTipEnabled,
  methodAmounts,
  noReceipt,
  openGiftCardCodeDialog,
  pick,
  setCashierTip,
  usd,
  waitSuccess,
} from '../../../../src/pages/voltqc/pay/payProbe.js';
import {
  gcAdd,
  gcEnterCode,
  gcQuick,
  openSellGiftCard,
} from '../../../../src/pages/voltqc/pos/giftCardProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { buildDraft } from '../../order-flow/charge-matrix.helpers.js';
import { skipTest } from '../../order-flow/payment-flows.helpers.js';

const CODE = giftCard.code;

async function draftAtCheckout(quickPayCents?: number): Promise<void> {
  await buildDraft(
    quickPayCents === undefined ? {} : { quickPay: { amountCents: quickPayCents, name: 'QC QP GC' } },
  );
  await homePage.pressPay();
  await checkoutPage.waitForReady();
}

/** Enter a code and press Confirm; returns the verdict dialog text. */
async function lookUp(code: string): Promise<string> {
  await fillGiftCardCode(code);
  if (await P.isDisabled(VqcPay.gcConfirm)) await fillGiftCardCode(code);
  await P.clickQ(VqcPay.gcConfirm);
  await browser.waitUntil(
    async () =>
      /Gift Card Accepted|not Enough Balance|not valid|Inactive|Used Up|invalid/i.test(
        await P.pageText('body'),
      ),
    { timeout: Timeouts.MEDIUM, timeoutMsg: `No verdict for gift card ${code}` },
  );
  return P.pageText('body');
}

describe('volt-qc 03 PAY — Gift Card tender', function () {
  this.timeout(Timeouts.MOCHA_TEST * 2);

  afterEach(async () => {
    await cleanTill();
  });

  it(
    title(
      'Gift card dialog opens on Scan QR with "Input Gift Card Code"; empty code keeps Confirm disabled; the field takes 1–16 digits only (PAY-038, PAY-041, PAY-042)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await draftAtCheckout();
      await step('PAY-038: Complete Payment on Gift Card → Scan QR code + Input Gift Card Code', async () => {
        await checkoutPage.selectTender('gift-card');
        await openGiftCardCodeDialog();
        expect(await P.has(VqcPay.gcCodeDialog)).toBe(true);
      });
      await step('PAY-041: empty → Confirm disabled', async () => {
        await fillGiftCardCode('');
        expect(await P.isDisabled(VqcPay.gcConfirm)).toBe(true);
      });
      await step('PAY-042: 17 digits keep 16; letters are dropped', async () => {
        expect((await fillGiftCardCode('12345678901234567')).replace(/\D/g, '')).toBe('1234567890123456');
        expect((await fillGiftCardCode('ABC12')).replace(/\s/g, '')).toBe('12');
      });
    },
  );

  it(
    title(
      'An unknown gift card number is rejected and no payment is made (PAY-043)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await draftAtCheckout();
      await openGiftCardCodeDialog();
      const t = await lookUp(INVALID_GIFT_CARD_CODE);
      expect(t).not.toContain('Gift Card Accepted');
      expect(t).toMatch(/not valid|invalid/i);
      await closeGiftDialogs();
      expect(await checkoutPage.isActive()).toBe(true);
      expect((await checkoutState()).totalPaid).toBe(0);
    },
  );

  it(
    title('Enter in the code field checks the card like Confirm (PAY-040)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      if (CODE === '') this.skip();
      await draftAtCheckout();
      await openGiftCardCodeDialog();
      await fillGiftCardCode(CODE);
      await P.press('Enter');
      await P.waitFor(VqcPay.gcAcceptedDialog, Timeouts.MEDIUM, '"Gift Card Accepted" after Enter');
      await closeGiftDialogs();
    },
  );

  it(
    title(
      'Cancel on "Gift Card Accepted" returns to checkout with nothing paid (PAY-047)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (CODE === '') this.skip();
      await draftAtCheckout();
      await openGiftCardCodeDialog();
      const t = await lookUp(CODE);
      if (!t.includes('Gift Card Accepted')) this.skip();
      await P.clickQ([VqcPay.gcAcceptedDialog, { role: 'button', name: 'Cancel', nth: 0 }]);
      await closeGiftDialogs();
      expect(await checkoutPage.isActive()).toBe(true);
      expect((await checkoutState()).totalPaid).toBe(0);
    },
  );

  it(
    title(
      'Insufficient balance: "not Enough Balance" with Current Balance / Amount Needed, Cancel deducts nothing (PAY-044)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (CODE === '') this.skip();
      // Find the balance first on a small order, then build one $50 above it.
      await draftAtCheckout();
      await openGiftCardCodeDialog();
      const probe = await lookUp(CODE);
      const bal = pick(probe, 'Current Balance');
      await closeGiftDialogs();
      if (Number.isNaN(bal) || bal + 5_000 > 999_999) this.skip();
      await cleanTill();

      await draftAtCheckout(bal + 5_000);
      const need = (await methodAmounts())['Gift Card'];
      expect(need).toBeGreaterThan(bal);
      await openGiftCardCodeDialog();
      await lookUp(CODE);
      await P.waitFor(VqcPay.gcNotEnoughDialog, Timeouts.MEDIUM, 'not Enough Balance');
      const t = await dialogText(VqcPay.gcNotEnoughDialog);
      expect(pick(t, 'Current Balance')).toBe(bal);
      expect(pick(t, 'Amount Needed')).toBe(need);
      await P.clickQ([VqcPay.gcNotEnoughDialog, { role: 'button', name: 'Cancel', nth: 0 }]);
      await closeGiftDialogs();
      expect(await checkoutPage.isActive()).toBe(true);
      expect((await checkoutState()).totalPaid).toBe(0);
    },
  );

  it(title('A used-up ($0) gift card cannot pay (PAY-045)', Tag.REGRESSION, Tag.WRITE), async function () {
    const empty = emptyActiveGiftCards[0];
    if (!empty) this.skip();
    await draftAtCheckout();
    await openGiftCardCodeDialog();
    const t = await lookUp(empty?.code ?? '');
    expect(t).not.toContain('Gift Card Accepted');
    await closeGiftDialogs();
    expect((await checkoutState()).totalPaid).toBe(0);
  });

  it(title('An Inactive gift card cannot pay (PAY-046)', Tag.REGRESSION, Tag.WRITE), async function () {
    const inactive = giftCardCatalog.find((c) => c.status === 'inactive');
    if (!inactive) this.skip();
    await draftAtCheckout();
    await openGiftCardCodeDialog();
    const t = await lookUp(inactive?.code ?? '');
    expect(t).not.toContain('Gift Card Accepted');
    await closeGiftDialogs();
    expect((await checkoutState()).totalPaid).toBe(0);
  });

  it(
    title(
      'An order with a gift-card SALE line cannot be paid by Gift Card (PAY-012)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (CODE === '') this.skip();
      await cleanTill();
      await homePage.selectStaffByIndex(0);
      await openSellGiftCard();
      await gcEnterCode(CODE);
      await P.clickQ(gcQuick('$25'));
      await P.clickQ(gcAdd);
      await settle(800);
      await homePage.pressPay();
      await checkoutPage.waitForReady();
      const t = await P.pageText('main');
      expect(t).toContain(VqcPay.gcCannotBuyGiftCard);
    },
  );

  it(
    title(
      'Redeem: Amount Needed = Gift Card button, card pays in full, success shows masked number + remaining balance; Order History stores it (PAY-039, PAY-051, PAY-128)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      if (CODE === '') skipTest(this);
      await draftAtCheckout();
      const orderId = await checkoutPage.orderId();
      const need = (await methodAmounts())['Gift Card'];
      await openGiftCardCodeDialog();
      const t = await lookUp(CODE);
      if (!t.includes('Gift Card Accepted')) skipTest(this);
      const acc = await dialogText(VqcPay.gcAcceptedDialog);
      expect(pick(acc, 'Amount Needed')).toBe(need);
      const before = pick(acc, 'Current Balance');
      await checkoutPage.payWithGiftCardBalance();
      const s = await waitSuccess();
      const last4 = CODE.slice(-4);
      expect(s).toMatch(new RegExp(`\\*+-\\*+-${last4}`));
      if (!Number.isNaN(before)) expect(s).toContain(`Balance ${usd(before - need)}`);
      await noReceipt();
      await returnToHome();
      await goToOrderHistory();
      await orderHistoryPage.openOrder(orderId);
      await orderHistoryDetailPage.waitForOrder(orderId);
      expect(await orderHistoryDetailPage.readPayment()).toMatch(new RegExp(`\\*+-\\*+-${last4}`));
    },
  );

  it(
    title(
      'A cashier tip on Gift Card: Amount Needed and the deduction = gift-card price + tip (PAY-048)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      if (CODE === '') skipTest(this);
      await draftAtCheckout();
      const price = (await methodAmounts())['Gift Card'];
      await checkoutPage.selectTender('gift-card');
      if (!(await isTipEnabled())) skipTest(this);
      await setCashierTip(['2', '0', '0']);
      if ((await methodAmounts())['Gift Card'] !== price + 200) skipTest(this); // Tip Settings leave Gift Card out
      expect(await checkoutPage.enteredAmountCents()).toBe(price + 200);
      await openGiftCardCodeDialog();
      const t = await lookUp(CODE);
      if (!t.includes('Gift Card Accepted')) skipTest(this);
      expect(pick(await dialogText(VqcPay.gcAcceptedDialog), 'Amount Needed')).toBe(price + 200);
      await checkoutPage.payWithGiftCardBalance();
      const s = await waitSuccess();
      expect(s).toContain(`${usd(price)} + $2.00 Tip`);
      await noReceipt();
    },
  );
});
