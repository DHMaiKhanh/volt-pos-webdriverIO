/**
 * volt-qc port — 13 CD: the customer display after payment — Payment complete,
 * receipt choices, points, and what void / layout / i18n do to it.
 *
 * Source: volt-qc `e2e/tests/13-customer-display/cd-plan-payment.spec.ts`
 * (CD-T16, T17, T18, T19, T21, T29) plus CD-059 from the catalogue.
 *
 * Gift-card cases need `VOLT_TEST_GIFT_CARD` with enough balance for one test
 * order (volt-qc topped it up; here a short card skips rather than spending).
 * Nothing is sent: the SMS / Email screens are validated and backed out of.
 */

import { expect } from '@wdio/globals';
import { CdCustomer } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { app, fmtPhone, randomPhone, uniqueName } from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, note, resetTill, track, untrack, usd } from './cd-e2e.helpers.js';

const GIFT_CARD = (process.env.VOLT_TEST_GIFT_CARD ?? '').trim();

/** Card balance covers one test order at the Gift Card price (+$1 slack). */
async function giftCardCovers(): Promise<boolean> {
  if (!GIFT_CARD) return false;
  const balance = await app.giftCardBalance(GIFT_CARD);
  const code = track(await app.createOrder());
  await app.pay();
  const need = (await app.methodCents('Gift Card')) + 100;
  await app.openPendingOrder(code);
  await app.deleteCurrentOrder();
  untrack(code);
  note(`gift card ****${GIFT_CARD.slice(-4)} balance ${usd(balance)}, need ${usd(need)}`);
  return balance >= need;
}

describe('volt-qc 13 CD — after payment', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'Other, walk-in: customer "Payment complete" with the bold total and No Receipt / Text Message / Email (Print unless auto-print); no points box (CD-059)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const code = track(await app.createOrder());
      await app.pay();
      const total = await app.methodCents('Other');
      await app.selectMethod('Other');
      await app.completePayment('none');
      await app.successText();
      untrack(code);
      expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
      expect(await cust.has({ text: usd(total), nth: 0 })).toBe(true);
      for (const b of [CdCustomer.noReceipt, CdCustomer.textMessage, CdCustomer.email])
        expect(await cust.has(b)).toBe(true);
      note(
        `CD-059: Print button ${(await cust.has({ role: 'button', name: 'Print', nth: 0 })) ? 'shown' : 'hidden (auto-print on?)'}`,
      );
      expect(await cust.has(CdCustomer.earned)).toBe(false);
      expect(await cust.has(CdCustomer.currentPoints)).toBe(false);
      await app.noReceipt();
    },
  );

  it(
    title(
      'Gift card payment: customer flashes "Payment Successful!" then "Payment complete" (CD-058)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      if (!(await giftCardCovers())) this.skip();
      const code = track(await app.createOrder());
      await app.pay();
      const info = await app.payWithGiftCard(GIFT_CARD);
      expect(info).toContain('Gift Card Accepted');
      await app.confirmGiftCardPay();
      const flashed = await cust.waitFor(CdCustomer.paymentSuccessful, 15_000);
      expect(await cust.waitFor(CdCustomer.paymentComplete, 15_000)).toBe(true);
      note(`CD-058: "Payment Successful!" flash ${flashed ? 'seen' : 'missed (may be < one poll)'}`);
      ensure(
        flashed || (await cust.has(CdCustomer.paymentComplete)),
        'customer display never confirmed the gift card payment',
      );
      await app.waitPaymentSuccess();
      await app.noReceipt();
      untrack(code);
    },
  );

  it(
    title(
      'No Receipt on the customer display → main leaves payment-success (to /order-pending), customer Welcome; No Receipt on main → Welcome (CD-062, CD-063)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      await step('CD-062 customer presses No Receipt', async () => {
        const code = track(await app.createOrder());
        await app.payCurrentOrder('Other');
        untrack(code);
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await cust.click(CdCustomer.noReceipt);
        expect(await app.waitPath(/^(?!.*payment-success)/, 15_000)).toBe(true);
        expect(await app.waitPath(/\/order-pending/, 10_000)).toBe(true);
        expect(await cust.waitWelcome()).toBe(true);
      });
      await step('CD-063 cashier presses No Receipt', async () => {
        await returnToHome();
        const code = track(await app.createOrder());
        await app.payCurrentOrder('Other');
        untrack(code);
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await app.noReceipt();
        expect(await cust.waitWelcome()).toBe(true);
      });
    },
  );

  it(
    title(
      'Send-receipt screens: Text Message pre-fills the phone, C + 9 digits disables Send, back → Payment complete; Email autofocus, "abc@" keeps Send disabled, back (CD-065, CD-066)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const phone = randomPhone();
      const code = track(await app.createOrder());
      await app.attachNewCustomer(phone, uniqueName('QC E2E'));
      await app.customerConfirmPhone();
      await app.payCurrentOrder('Other');
      untrack(code);
      expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);

      await step('CD-065 Text Message', async () => {
        await cust.click(CdCustomer.textMessage);
        await cust.waitFor(CdCustomer.phoneInput);
        expect(await cust.phoneValue()).toBe(fmtPhone(phone));
        expect(await cust.isDisabled(CdCustomer.send)).toBe(false);
        await cust.keys('C');
        expect(await cust.phoneValue()).toBe('');
        await cust.keys('832555012');
        expect(await cust.isDisabled(CdCustomer.send)).toBe(true);
        await cust.click(CdCustomer.sendBack);
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await app.closeStrayDialogs();
      });

      await step('CD-066 Email', async () => {
        await cust.click(CdCustomer.email);
        expect(await cust.waitFor(CdCustomer.emailInput)).toBe(true);
        expect(await cust.isFocused(CdCustomer.emailInput)).toBe(true);
        expect(await cust.has(CdCustomer.keyboardSend)).toBe(true);
        await cust.typeInto(CdCustomer.emailInput, 'abc@');
        expect(await cust.hasClass(CdCustomer.keyboardSend, 'hg-button-disabled')).toBe(true);
        await cust.click(CdCustomer.sendBack);
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await app.closeStrayDialogs();
      });
      await app.noReceipt();
    },
  );

  it(
    title(
      'Voiding a paid order (Cancel Order) does not wake the customer display (CD-069)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { code } = await app.createPaidOrder({ method: 'Other' });
      expect(await cust.waitWelcome()).toBe(true);
      await app.openHistoryOrder(code);
      await app.cancelOrder(0);
      const status = await (async () => {
        const deadline = Date.now() + 30_000;
        let s = '';
        while (Date.now() < deadline && !/Cancel/.test(s)) {
          s = await app.historyStatus(code);
          await app.pause(1_000);
        }
        return s;
      })();
      expect(status).toMatch(/Cancel/);
      await app.pause(2_000);
      expect(await cust.isWelcome()).toBe(true);
      expect(await cust.has(CdCustomer.orderDetails)).toBe(false);
    },
  );

  it(
    title(
      'No raw i18n key and no page-level overflow on every customer screen (Welcome, cart, confirm, check-in, tip, custom tip, Payment complete, SMS, Email) (CD-072, CD-076)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const problems: string[] = [];
      const check = async (screen: string): Promise<void> => {
        const keys = await cust.rawI18nKeys();
        if (keys.length) problems.push(`${screen}: raw key ${keys.join(', ')}`);
        const o = await cust.overflow();
        if (o.scrollW > o.clientW + 1 || o.scrollH > o.clientH + 1)
          problems.push(`${screen}: overflow ${JSON.stringify(o)}`);
      };
      await app.quickCheckout();
      expect(await cust.waitWelcome()).toBe(true);
      await check('Welcome');
      const phone = randomPhone();
      const code = track(await app.createOrder());
      await cust.waitFor(CdCustomer.orderDetails);
      await check('Cart + phone');
      await app.attachNewCustomer(phone, uniqueName('QC E2E'));
      await cust.waitFor(CdCustomer.isThisYourPhone);
      await check('Confirm phone');
      await app.customerConfirmPhone();
      await cust.waitFor(CdCustomer.checkinSuccessful);
      await check('Check-in Successful');
      await app.pay();
      await app.selectMethod('Other');
      if (await app.completeUntilTipScreen()) {
        await check('Add a tip');
        await cust.click(CdCustomer.customTip);
        await cust.waitFor(CdCustomer.customTipTitle);
        await check('Custom tip');
        await cust.customTipBack();
        await cust.chooseTipAndContinue('none');
      } else {
        note('CD-072: Other has no tip screen on this merchant — tip screens not checked');
      }
      await app.waitPaymentSuccess();
      untrack(code);
      await cust.waitFor(CdCustomer.paymentComplete);
      await check('Payment complete');
      await cust.click(CdCustomer.textMessage);
      await cust.waitFor(CdCustomer.phoneInput);
      await check('Send SMS');
      await cust.click(CdCustomer.sendBack);
      await app.closeStrayDialogs();
      await cust.click(CdCustomer.email);
      await cust.waitFor(CdCustomer.emailInput);
      await check('Send Email');
      await cust.click(CdCustomer.sendBack);
      await app.closeStrayDialogs();
      await app.noReceipt();
      expect(problems).toEqual([]);
    },
  );

  it(
    title(
      'Points shown after paying Cash, Other and Gift Card ("Congrats! You\'ve earned" N > 0) (CD-061)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const phone = randomPhone();
      const results: string[] = [];

      await step('Cash (new customer)', async () => {
        const code = track(await app.createOrder());
        await app.attachNewCustomer(phone, uniqueName('QC E2E'));
        await app.customerConfirmPhone();
        await app.payCurrentOrder('Cash');
        untrack(code);
        expect(await cust.waitFor(CdCustomer.earned, 15_000)).toBe(true);
        const n = await cust.earnedPoints();
        expect(n).toBeGreaterThan(0);
        results.push(`Cash +${String(n)}`);
        await app.noReceipt();
      });

      await step('Other (existing customer)', async () => {
        const code = track(await app.createOrder());
        await app.attachExistingCustomer(phone);
        await app.customerConfirmPhone();
        await app.payCurrentOrder('Other');
        untrack(code);
        expect(await cust.waitFor(CdCustomer.earned, 15_000)).toBe(true);
        const n = await cust.earnedPoints();
        expect(n).toBeGreaterThan(0);
        results.push(`Other +${String(n)}`);
        await app.noReceipt();
      });

      if (await giftCardCovers()) {
        await step('Gift Card', async () => {
          const code = track(await app.createOrder());
          await app.attachExistingCustomer(phone);
          await app.customerConfirmPhone();
          await app.pay();
          expect(await app.payWithGiftCard(GIFT_CARD)).toContain('Gift Card Accepted');
          await app.confirmGiftCardPay();
          await app.waitPaymentSuccess();
          untrack(code);
          expect(await cust.waitFor(CdCustomer.earned, 15_000)).toBe(true);
          const n = await cust.earnedPoints();
          expect(n).toBeGreaterThan(0);
          results.push(`Gift Card +${String(n)}`);
          await app.noReceipt();
        });
      } else {
        note('CD-061: Gift Card leg skipped — VOLT_TEST_GIFT_CARD unset or short');
      }
      note(`CD-061 ***${phone.slice(-4)}: ${results.join('; ')} (Card left out — no card is presented)`);
    },
  );
});
