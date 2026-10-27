/**
 * volt-qc port — 17 RE-OPEN: paying the difference by tender (card pricing, no-terminal card,
 * gift card).
 *
 * Source: volt-qc `e2e/tests/19-reopen/reopen-methods.spec.ts` (RO-208, RO-212, RO-401, RO-403,
 * RO-405) and `reopen-linear.spec.ts` (RO-B1 card half).
 * TC catalogue: docs/qc/volt-qc/windows-regression/17-reopen.md.
 *
 * No card is charged here — the card-terminal cases are in ../_manual/oh-reopen.manual.spec.ts.
 * Gift-card cases need the merchant's standing card (`GIFT_CARD_CODE`, src/data/static/paymentMethods.ts)
 * and skip without it.
 *
 * CREATES, SETTLES, RE-OPENS AND RE-CHARGES ORDERS (cash / other / gift card) — dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { OhRoDialogs } from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { giftCard } from '../../../../src/data/index.js';
import { payInCash, payWithGiftCard, returnToHome } from '../../../../src/flows/index.js';
import { settle } from '../../../../src/helpers/wait.js';
import { checkoutPage, homePage } from '../../../../src/pages/index.js';
import {
  centsIn,
  closeTipDialog,
  countPayments,
  createPaidOrder,
  enteredFor,
  field,
  freshDetail,
  freshTill,
  leaveReopen,
  openAdjustTip,
  openHistoryOrder,
  passcodeIfAsked,
  payDifference,
  payFromEdit,
  removeCartLine,
  reopenDone,
  reopenToCheckout,
  reopenToHome,
  tenderAmountCents,
  tryAddService,
  waitStatus,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const HAS_GIFT_CARD = giftCard.code !== '';
const INVALID_GC = '000000000000';

describe('volt-qc 17 RE-OPEN — difference by tender (write)', () => {
  afterEach(async () => {
    await leaveReopen();
  });
  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Dual pricing on the difference: Card = Cash × (1 + SF) to the cent, Card = base + SF + tax on (base + SF) (RO-011, RO-212)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { orderId, code, paidCents, cardCents } = await createPaidOrder({ method: 'cash' });
      if (Number.isNaN(cardCents) || cardCents === paidCents) this.skip(); // no service fee on this merchant
      const fee = cardCents / paidCents; // (1 + SF), measured on the original sale
      await reopenToHome(orderId);
      expect(await tryAddService(1)).toBe(true);
      await payFromEdit();
      const cash = await tenderAmountCents('Cash');
      const card = await tenderAmountCents('Card');
      expect(card).toBeGreaterThan(cash);
      expect(Math.abs(card - Math.round(cash * fee))).toBeLessThanOrEqual(1);
      // Do not charge: drop the added line and close the reopen unchanged.
      await checkoutPage.pressEditOrder();
      await settle(Timeouts.DEBOUNCE);
      await removeCartLine(-1);
      await reopenDone();
      expect(await waitStatus(code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
    },
  );

  it(
    title(
      'No terminal connected: paying the difference by Card keeps Complete Payment locked; switching to Cash still pays (RO-208)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { orderId } = await createPaidOrder({ method: 'cash' });
      await reopenToHome(orderId);
      expect(await tryAddService(1)).toBe(true);
      await payFromEdit();
      await checkoutPage.selectTender('card');
      await settle(Timeouts.DEBOUNCE);
      if (await checkoutPage.isCompletePaymentEnabled()) {
        // A terminal IS connected here — pressing would charge a real card.
        await enteredFor('cash');
        await payDifference(orderId, 'cash');
        this.skip();
      }
      expect(await checkoutPage.isCompletePaymentEnabled()).toBe(false);
      const due = await enteredFor('cash');
      expect(due).toBeGreaterThan(0);
      const success = await payInCash(orderId);
      await success.continueToNextOrder();
      await success.waitForFlowToEnd();
      expect(countPayments(await freshDetail(orderId, (d) => countPayments(d, 'Cash') === 2), 'Cash')).toBe(
        2,
      );
    },
  );

  it(
    title(
      'Original paid by Gift Card, reopen without change: $0 owed, Done opens no scan dialog and adds no gift-card txn (RO-401)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      if (!HAS_GIFT_CARD) this.skip();
      await freshTill();
      await homePage.selectStaffByIndex(0);
      await homePage.addServiceByIndex(0);
      const checkout = await homePage.pressPay();
      const orderId = await checkout.orderId();
      const success = await payWithGiftCard(orderId, giftCard.code);
      await success.continueToNextOrder();
      await success.waitForFlowToEnd();
      const code = await openHistoryOrder(orderId);
      await reopenToCheckout(orderId);
      expect(await enteredFor('cash')).toBe(0);
      await reopenDone();
      expect(await checkoutPage.isGiftCardScanDialogOpen(1_500).catch(() => false)).toBe(false);
      expect(await waitStatus(code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
      expect(countPayments(await freshDetail(orderId), 'Gift Card')).toBe(1);
    },
  );

  it(
    title(
      'Original Cash, pay the difference with a Gift Card: only the difference is redeemed, the Cash txn stays; the Gift Card txn is not in Adjust Tip (OH-193, RO-403, RO-415)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      if (!HAS_GIFT_CARD) this.skip();
      const { orderId, paidCents } = await createPaidOrder({ method: 'cash' });
      await reopenToHome(orderId);
      expect(await tryAddService(1)).toBe(true);
      await payFromEdit();
      const due = await enteredFor('cash');
      const success = await payWithGiftCard(orderId, giftCard.code);
      await success.continueToNextOrder();
      await success.waitForFlowToEnd();
      const d = await freshDetail(orderId, (x) => countPayments(x, 'Gift Card') === 1);
      expect(countPayments(d, 'Cash')).toBe(1);
      expect(countPayments(d, 'Gift Card')).toBe(1);
      expect(centsIn(field(d, 'Total'))).toBe(paidCents + due);
      // RO-415 / OH-193: the Gift Card txn is not tip-adjustable — Adjust Tip goes straight to the Cash txn.
      await openAdjustTip();
      expect(await P.has(OhRoDialogs.adjustOrderTipList)).toBe(false);
      expect(await P.has(OhRoDialogs.adjustTip)).toBe(true);
      await closeTipDialog();
    },
  );

  it(
    title(
      'A wrong gift-card code while paying the difference is refused: no txn, still on the reopened checkout (RO-405)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'cash' });
      await reopenToHome(orderId);
      expect(await tryAddService(1)).toBe(true);
      await payFromEdit();
      await checkoutPage.selectTender('gift-card');
      await checkoutPage.pressCompletePayment();
      await passcodeIfAsked(2_000);
      await checkoutPage.waitForGiftCardScanDialog(Timeouts.MEDIUM);
      await checkoutPage.enterGiftCardCode(INVALID_GC);
      await checkoutPage.redeemGiftCard();
      expect(await checkoutPage.isGiftCardAccepted()).toBe(false);
      await checkoutPage.closeGiftCardDialog();
      await settle(Timeouts.DEBOUNCE);
      expect(await checkoutPage.currentPath()).toMatch(/\/checkout$/);
      // Settle the difference in cash so the order does not stay parked in Re-open.
      await payDifference(orderId, 'cash');
      const d = await freshDetail(orderId, (x) => countPayments(x, 'Cash') === 2);
      expect(countPayments(d, 'Gift Card')).toBe(0);
      expect(field(d, 'Order ID')).toBe(code);
    },
  );
});
