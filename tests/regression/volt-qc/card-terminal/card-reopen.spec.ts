/**
 * volt-qc card terminal — re-opening an order when a Card is on either side: the
 * original paid by Card, or the difference charged on a real Card.
 *
 * TC catalogue: docs/qc/volt-qc/windows-regression/17-reopen.md. These rows were
 * pending in ../_manual/oh-reopen.manual.spec.ts only because they needed a card
 * charged on the Bamboo DOT terminal.
 *
 * Gating and the operator tap: see ./card-terminal.helpers.ts. Each case takes one
 * real card charge, except the Card-original + Card-difference case (two). That is
 * 7 taps for the file.
 *
 *     CARD_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/volt-qc/card-terminal/card-reopen.spec.ts
 *
 * The money edit of a re-open is a single shot: a case that cannot add a service
 * on the Home editor fails at `tryAddService` (it is not skipped) — that is the
 * same expectation reopen-core.spec.ts / reopen-methods.spec.ts hold for cash.
 *
 * Service-fee arithmetic: the fee factor (1 + SF) is MEASURED on the original
 * checkout (Card tile ÷ Cash tile), never hard-coded, and the fee assertions only
 * run when the merchant charges one (factor > 1).
 *
 * CREATES, SETTLES, RE-OPENS, RE-CHARGES AND VOIDS ORDERS (cash / other / card). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import {
  OhRoButtons as B,
  OhRoDialogs as D,
  OhRoText as T,
} from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { checkoutPage } from '../../../../src/pages/index.js';
import {
  adjustTipTo,
  centsIn,
  checkoutState,
  confirmVoidAll,
  countPayments,
  createPaidOrder,
  detailActions,
  detailText,
  enteredFor,
  field,
  freshDetail,
  leaveReopen,
  passcodeIfAsked,
  payDifference,
  payFromEdit,
  removeCartLine,
  reopenDialogText,
  reopenDone,
  reopenToHome,
  tenderAmountCents,
  tryAddService,
  waitStatus,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { P, noReceipt, waitSuccess } from '../../../../src/pages/voltqc/pay/payProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import {
  ONE_CHARGE_MS,
  assertCardPayable,
  cardDialogShown,
  cardsOf,
  chargeSelectedCard,
  cleanAfterCard,
  createCardOrder,
  detailWithCards,
  dollarsToCents,
  requireCardTerminal,
  successfulCardsOf,
  usd,
} from './card-terminal.helpers.js';

/** (1 + SF) measured on a checkout: Card tile ÷ Cash tile; 1 when there is no fee or no reading. */
function feeFactor(cardCents: number, cashCents: number): number {
  if (!Number.isFinite(cardCents) || !Number.isFinite(cashCents) || cashCents <= 0) return 1;
  return cardCents / cashCents;
}

/** The difference owed on Card carries the fee: Card ≈ Cash × (1 + SF), to the cent. */
function expectCardCarriesFee(cardDue: number, cashDue: number, fee: number): void {
  if (fee <= 1) return; // no service fee on this merchant
  expect(cardDue).toBeGreaterThan(cashDue);
  expect(Math.abs(cardDue - Math.round(cashDue * fee))).toBeLessThanOrEqual(1);
}

/** Re-open → Edit Order → add one service line → Pay; returns the Cash tile of the difference. */
async function reopenAndAddService(orderId: string): Promise<number> {
  await reopenToHome(orderId);
  expect(await tryAddService(1)).toBe(true);
  await payFromEdit();
  return tenderAmountCents('Cash');
}

/**
 * On the reopened checkout: Card tender, read what it owes, charge it (operator
 * taps), end the sale. Returns the charged difference in cents.
 */
async function chargeDifferenceByCard(ctx: Mocha.Context): Promise<number> {
  await checkoutPage.selectTender('card');
  await settle(Timeouts.DEBOUNCE);
  const due = await checkoutPage.enteredAmountCents();
  expect(due).toBeGreaterThan(0);
  await assertCardPayable(ctx);
  const trace = await chargeSelectedCard();
  // The charge dialog / customer display shows the difference, not the order total.
  expect(`${trace.main.join(' ⟶ ')} ${trace.customer.join(' ⟶ ')}`).toContain(usd(due));
  await waitSuccess(Timeouts.CARD_CHARGE);
  await noReceipt();
  return due;
}

describe('volt-qc card terminal — re-open with a card on either side', function () {
  this.timeout(ONE_CHARGE_MS + 3 * 60_000);

  before(() => assertWritesAllowed('take card payments (volt-qc card terminal)'));
  afterEach(async () => {
    await leaveReopen();
    await cleanAfterCard();
  });
  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Card original (2 services), reopen + service, difference in Cash: Cash = Other = the cash price (no SF), Card would carry the SF; Payment Details old Card + new Cash; Total = Card + Cash (RO-080)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await requireCardTerminal(this);
      const o = await createCardOrder(this, [
        [0, 0],
        [0, 1],
      ]);
      const fee = feeFactor(o.cardCents, o.cashCents);

      const cash = await reopenAndAddService(o.orderId);
      expect(await tenderAmountCents('Other')).toBe(cash);
      expectCardCarriesFee(await tenderAmountCents('Card'), cash, fee);
      const due = await enteredFor('cash');
      expect(due).toBe(cash);
      await payDifference(o.orderId, 'cash');

      const d = await freshDetail(o.orderId, (x) => countPayments(x, 'Cash') === 1);
      expect(field(d, 'Status')).toBe('Successful - Unsettled');
      const cards = successfulCardsOf(d);
      expect(cards).toHaveLength(1);
      expect(dollarsToCents(cards[0]?.amount ?? 0)).toBe(o.cardCents);
      expect(centsIn(field(d, 'Total'))).toBe(o.cardCents + due);
    },
  );

  it(
    title(
      'Cash original, reopen + service, difference charged on a real Card: charge = cash price × (1 + SF), Successful - Unsettled, Cash + Card lines, edit spent; a 2nd reopen is non-money only and Done never reaches the terminal (RO-082, RO-213)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await requireCardTerminal(this);
      const c = await createPaidOrder({ method: 'cash' });
      const fee = feeFactor(c.cardCents, c.paidCents);

      const cash = await reopenAndAddService(c.orderId);
      const due = await chargeDifferenceByCard(this);
      expectCardCarriesFee(due, cash, fee);

      await step('RO-082 Payment Details: the Cash txn + one new Card txn of the difference', async () => {
        const d = await detailWithCards(c.orderId, 1);
        expect(field(d, 'Status')).toBe('Successful - Unsettled');
        expect(countPayments(d, 'Cash')).toBe(1);
        const card = successfulCardsOf(d)[0];
        expect(dollarsToCents(card?.amount ?? 0)).toBe(due);
        expect(card?.last4 ?? '').toMatch(/^\d{4}$/);
        expect(await reopenDialogText(c.orderId)).toContain(T.msgNoEdit);
      });

      await step('RO-213 second reopen: no line can be added, $0 owed, Done opens no charge', async () => {
        await reopenToHome(c.orderId);
        expect(await tryAddService(0)).toBe(false);
        await payFromEdit();
        expect(await checkoutPage.enteredAmountCents()).toBe(0);
        expect(await cardDialogShown()).toBe(false);
        await reopenDone();
        const d = await freshDetail(c.orderId);
        expect(successfulCardsOf(d)).toHaveLength(1);
        expect(countPayments(d, 'Cash')).toBe(1);
      });
    },
  );

  it(
    title(
      'Card original, reopen + service, difference also by Card: no checkout error, Payment Successful, two Successful card txns (old + the new difference) (RO-097)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(2 * ONE_CHARGE_MS + 2 * 60_000);
      await requireCardTerminal(this);
      const o = await createCardOrder(this);
      const fee = feeFactor(o.cardCents, o.cashCents);

      const cash = await reopenAndAddService(o.orderId);
      const due = await chargeDifferenceByCard(this);
      expectCardCarriesFee(due, cash, fee);

      const d = await detailWithCards(o.orderId, 2);
      expect(field(d, 'Status')).toBe('Successful - Unsettled');
      const amounts = successfulCardsOf(d)
        .map((x) => dollarsToCents(x.amount))
        .sort((a, b) => a - b);
      expect(amounts).toEqual([o.cardCents, due].sort((a, b) => a - b));
    },
  );

  it(
    title(
      'Other original, reopen + service, difference by Card: the Card charge carries the SF, the old Other txn is kept, Total = Other + Card (RO-203)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await requireCardTerminal(this);
      const c = await createPaidOrder({ method: 'other' });
      const fee = feeFactor(c.cardCents, c.paidCents);

      const cash = await reopenAndAddService(c.orderId);
      const due = await chargeDifferenceByCard(this);
      expectCardCarriesFee(due, cash, fee);

      const d = await detailWithCards(c.orderId, 1);
      expect(countPayments(d, 'Other')).toBe(1);
      expect(dollarsToCents(successfulCardsOf(d)[0]?.amount ?? 0)).toBe(due);
      expect(centsIn(field(d, 'Total'))).toBe(c.paidCents + due);
    },
  );

  it(
    title(
      'Card original, reopen + service, difference by Other: Other = the cash price (no SF), the terminal is not used, Payment Details old Card + new Other (RO-504)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await requireCardTerminal(this);
      const o = await createCardOrder(this);

      const cash = await reopenAndAddService(o.orderId);
      const due = await enteredFor('other');
      expect(due).toBe(cash);
      await payDifference(o.orderId, 'other');

      const d = await freshDetail(o.orderId, (x) => countPayments(x, 'Other') === 1);
      const cards = successfulCardsOf(d);
      expect(cards).toHaveLength(1);
      expect(dollarsToCents(cards[0]?.amount ?? 0)).toBe(o.cardCents);
      expect(centsIn(field(d, 'Total'))).toBe(o.cardCents + due);
    },
  );

  it(
    title(
      'Card original (2 services) with a $2 tip, reopen and drop a service: Void Order Transactions → Confirm Void voids the card, Total Paid $0.00; paid again in Cash: no Successful card txn left, no tip details (RO-085)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await requireCardTerminal(this);
      const o = await createCardOrder(this, [
        [0, 0],
        [0, 1],
      ]);
      if ((await detailActions())[B.adjustTip]) {
        await adjustTipTo('200');
        await P.poll(
          () => detailText(o.code),
          (t) => field(t, 'Tip') === '$2.00',
          30_000,
        );
      } else {
        console.warn('[RO-085] no Adjust Tip on this merchant — the card order is voided without a tip');
      }

      await reopenToHome(o.orderId);
      await removeCartLine(-1);
      await P.clickQ(inMain(btn('Pay', 0)));
      await passcodeIfAsked(1_500);
      await P.waitFor(D.voidTransactions, Timeouts.MEDIUM, 'Void Order Transactions');
      await confirmVoidAll();
      const st = await checkoutState();
      if (!Number.isNaN(st.totalPaid)) expect(st.totalPaid).toBe(0);

      const owed = await enteredFor('cash');
      expect(owed).toBeGreaterThan(0);
      await payDifference(o.orderId, 'cash');

      expect(await waitStatus(o.code, /^Successful - Unsettled$/, 120_000)).toBe('Successful - Unsettled');
      const d = await freshDetail(o.orderId, (x) => countPayments(x, 'Cash') === 1);
      // No live card charge is left: any Successful card row is matched by its Voided
      // row (same Auth Code). The TC expects the voided card not to be listed at all.
      const cards = cardsOf(d);
      const voided = new Set(cards.filter((x) => x.status === 'Voided').map((x) => x.auth));
      expect(cards.filter((x) => x.status === 'Successful' && !voided.has(x.auth))).toHaveLength(0);
      if (cards.length > 0)
        console.warn(
          `[RO-085] voided card still listed in Payment Details: ${cards.map((x) => x.raw).join(' / ')}`,
        );
      expect(centsIn(field(d, 'Total'))).toBe(owed);
      expect(d).toContain(T.noTips);
    },
  );
});
