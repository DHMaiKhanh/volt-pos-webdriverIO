/**
 * volt-qc card terminal — the checkout side of a real card charge: the state
 * sequence on POS + customer display, and the two signature timings.
 *
 * TC catalogue: docs/qc/volt-qc/windows-regression/03-checkout-thanh-toan.md,
 * 11-settings.md, 13-customer-display.md and 14-e2e-xuyen-suot.md. These rows were
 * pending in ../_manual/ only because they needed the Bamboo DOT terminal.
 *
 * Gating and the operator tap: see ./card-terminal.helpers.ts. Every case skips
 * without CARD_SETTLE=1 or a connected terminal. The signature cases change the
 * store's signature rule (Settings › Payment & Transaction) and put it back in
 * `finally`, hence EXCLUSIVE.
 *
 * Charges: the approved-card case and the signature-AFTER case take one real
 * charge each (an operator taps the card). The signature-BEFORE case stops on the
 * customer's tip + signature screen and cancels — it never reaches the terminal
 * charge.
 *
 *     CARD_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/volt-qc/card-terminal/card-checkout.spec.ts
 *
 * CREATES DATA AND TAKES CARD PAYMENTS. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { CdCustomer, CdMain } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { step } from '../../../../src/helpers/steps.js';
import { withCustomerWindow } from '../../../../src/helpers/window.js';
import { checkoutPage } from '../../../../src/pages/index.js';
import { app as cdApp } from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import {
  detailText,
  field,
  openReceipt,
  passcodeIfAsked,
  receiptText,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import {
  isTipEnabled,
  noReceipt,
  P,
  setCashierTip,
  waitSuccess,
} from '../../../../src/pages/voltqc/pay/payProbe.js';
import { watchCard } from '../../../../src/pages/voltqc/promo-split/splitDeepExtra.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import {
  CARD_WAIT_MS,
  ONE_CHARGE_MS,
  cardsOf,
  cleanAfterCard,
  createCardOrder,
  dollarsToCents,
  openCardCheckout,
  requireCardTerminal,
  successfulCardsOf,
  usd,
  withSignatureRule,
} from './card-terminal.helpers.js';

/** Is the customer signature canvas blank (no stroke drawn yet)? */
function customerCanvasBlank(): Promise<boolean> {
  return withCustomerWindow(() =>
    P.exec<boolean>(`
      var c = Array.prototype.filter.call(document.querySelectorAll('canvas'), function (x) { return x.getClientRects().length > 0; })[0];
      if (!c || !c.width || !c.height) return false;
      var blank = document.createElement('canvas');
      blank.width = c.width; blank.height = c.height;
      return c.toDataURL() === blank.toDataURL();
    `),
  );
}

describe('volt-qc card terminal — checkout states and signature timing', function () {
  this.timeout(ONE_CHARGE_MS);

  before(() => assertWritesAllowed('take card payments (volt-qc card terminal)'));
  afterEach(cleanAfterCard);

  it(
    title(
      'Approved card: card dialog Present Card → Processing, customer shows the amount, Payment Successful; Order History has one Successful card txn with an Auth Code, printed on the receipt (E2E-058)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await requireCardTerminal(this);
      const o = await createCardOrder(this);

      await step('POS / customer states in order', () => {
        const main = o.trace.main.join(' ⟶ ');
        console.warn(`[E2E-058] card dialog: ${main}`);
        expect(main).toMatch(/(Present Card|Getting ready to charge)[\s\S]*Processing Payment/);
        expect(main).not.toMatch(/Payment failed!|Transaction timeout!/);
        if (!Number.isNaN(o.cardCents)) {
          expect(`${o.trace.customer.join(' ⟶ ')} ${main}`).toContain(usd(o.cardCents));
        }
        expect(o.successText).toMatch(/Card/);
        return Promise.resolve();
      });

      await step(
        'Order History: Successful (not stuck Processing), one card txn with an Auth Code',
        async () => {
          const d = await detailText(o.code);
          expect(field(d, 'Status')).toBe('Successful - Unsettled');
          const cards = cardsOf(d);
          expect(cards.some((c) => /Processing/i.test(c.status))).toBe(false);
          const ok = successfulCardsOf(d);
          expect(ok).toHaveLength(1);
          expect(ok[0]?.auth ?? '').not.toBe('');
          if (!Number.isNaN(o.cardCents)) expect(dollarsToCents(ok[0]?.amount ?? 0)).toBe(o.cardCents);

          await openReceipt();
          expect(await receiptText()).toContain(ok[0]?.auth ?? '<no auth code>');
          await P.escape();
        },
      );
    },
  );

  it(
    title(
      'Signature BEFORE required (saved in Settings): Card + cashier tip $2 → customer gets Add a tip + Sign here + Clear, main "Customer is adding a tip.", Continue locked until signed; cancelled before the charge (PAY-080, SET-084)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await requireCardTerminal(this);
      // withSignatureRule saves the rule and re-reads it (SET-084 step 1), and
      // restores the old rule in `finally` (SET-084 step 4).
      await withSignatureRule({ required: true, timing: 'before' }, async () => {
        await openCardCheckout(this);
        const cardTips = await isTipEnabled();
        if (cardTips) await setCashierTip(['2', '0', '0']);
        await checkoutPage.pressCompletePayment();
        await passcodeIfAsked(4_000);

        expect(await cust.waitFor(CdCustomer.canvas, 25_000)).toBe(true);
        expect(await cust.has(CdCustomer.clear)).toBe(true);
        expect(await cust.text()).toMatch(/Sign here/);
        const waiting = await cdApp.waitingTipText();
        if (cardTips) {
          // PAY-080: the tip screen is pushed even though the cashier already entered a tip.
          expect(await cust.has(CdCustomer.addTip)).toBe(true);
          expect(waiting).toContain('Customer is adding a tip.');
        } else {
          expect(waiting).toMatch(/Customer is adding (a tip|signature)\./);
        }

        expect(await cust.isContinueEnabled()).toBe(false);
        await cust.sign();
        expect(await cust.isContinueEnabled()).toBe(true);

        // Never Continue: that would start the terminal charge.
        await cdApp.cancelWaitingTip();
      });
    },
  );

  it(
    title(
      'Signature AFTER required: after approval the customer gets Add Signature / "Transaction approved. Please sign your name." on an empty pad, Clear, Continue locked until signed; main "Customer is adding signature." then Payment Successful (PAY-147, CD-055)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await requireCardTerminal(this);
      await withSignatureRule({ required: true, timing: 'after' }, async () => {
        await openCardCheckout(this);
        await checkoutPage.pressCompletePayment();
        // Passcode + No Tip are answered; the signature is left for the asserts.
        await watchCard(({ customer }) => /Add Signature|Please sign your name/.test(customer), {
          timeoutMs: CARD_WAIT_MS,
          reset: true,
          sign: false,
        });

        await step('Customer: Add Signature on a fresh, empty pad; Clear; Continue locked', async () => {
          const c = await cust.text();
          expect(c).toMatch(/Add Signature/);
          expect(c).toMatch(/Transaction approved/);
          expect(c).toMatch(/Please sign your name/);
          expect(await cust.has(CdCustomer.clear)).toBe(true);
          expect(await customerCanvasBlank()).toBe(true);
          expect(await cust.isContinueEnabled()).toBe(false);
        });

        await step('Main: "Customer is adding signature."', async () => {
          expect(await P.textOf(CdMain.waitingDialog)).toMatch(/Customer is adding signature/);
        });

        await step('Sign → Continue unlocks; Clear empties the pad and locks it again', async () => {
          await cust.sign();
          expect(await cust.isContinueEnabled()).toBe(true);
          await cust.click(CdCustomer.clear);
          expect(await customerCanvasBlank()).toBe(true);
          expect(await cust.isContinueEnabled()).toBe(false);
          await cust.sign();
          expect(await cust.isContinueEnabled()).toBe(true);
        });

        await cust.click(CdCustomer.continue);
        expect(await waitSuccess(Timeouts.CARD_CHARGE)).toMatch(/Card/);
        await noReceipt();
      });
    },
  );
});
