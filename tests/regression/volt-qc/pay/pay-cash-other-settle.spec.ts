/**
 * volt-qc port — 03 PAY: settling Cash / Other, the payment-success screen and
 * Order History (REAL cash / other payments).
 *
 * Source: volt-qc `e2e/tests/03-checkout/payment.spec.ts` (PAY-B, PAY-D),
 * `pay-plan-keypad.spec.ts` (PAY-M, PAY-M2, PAY-N, PAY-N2),
 * `pay-plan-layout.spec.ts` (PAY-T, PAY-T2, PAY-U) and `pay-plan-passcode.spec.ts`
 * (PAY-S2). TC catalogue: docs/qc/volt-qc/windows-regression/03-checkout-thanh-toan.md.
 *
 * Cash and Other settle through the shared flows (`payInCash`, `payWithOther`)
 * or the same Complete Payment → guard → customer-tip handoff (`completeToSuccess`).
 * The customer tip handoff on cash ([[cash-tip-flow-20258]]) needs the LAUNCH
 * lane, where the customer window is a WebDriver handle.
 *
 * Adaptations vs the source:
 * - Over-tender uses $888.88 (9-free; "9" sits under the $50 preset).
 * - PAY-121 / PAY-133 / PAY-137 assume the dev machine has NO receipt printer /
 *   cash drawer; the toast is the assertion.
 * - PAY-129 navigates to a non-existent order id (the dev build ignores a bad
 *   transactionId on a real order — same adaptation as the source).
 *
 * CREATES DATA AND TAKES CASH / OTHER PAYMENTS. dev / staging only.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../../src/components/index.js';
import { VqcPay } from '../../../../src/constants/testids.voltqc-pay.js';
import {
  completeCustomerTipIfPrompted,
  goToOrderHistory,
  payInCash,
  payWithOther,
  returnToHome,
} from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  checkoutPage,
  customerDisplayPage,
  homePage,
  orderHistoryDetailPage,
  orderHistoryPage,
  orderPendingPage,
  paymentSuccessPage,
} from '../../../../src/pages/index.js';
import {
  P,
  checkoutOrderCode,
  checkoutState,
  cleanTill,
  completeToSuccess,
  customerClickText,
  doubleClickQ,
  ellipsisStyle,
  keys,
  methodAmounts,
  noReceipt,
  toastSeen,
  typeAmount,
  usd,
  waitSuccess,
} from '../../../../src/pages/voltqc/pay/payProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { OVER_TENDER_CENTS, buildDraft } from '../../order-flow/charge-matrix.helpers.js';

interface Draft {
  orderId: string;
  code: string;
  cash: number;
  other: number;
}

async function draftAtCheckout(quickPayCents?: number): Promise<Draft> {
  await buildDraft(
    quickPayCents === undefined ? {} : { quickPay: { amountCents: quickPayCents, name: 'QC QP' } },
  );
  await homePage.pressPay();
  await checkoutPage.waitForReady();
  const amt = await methodAmounts();
  return {
    orderId: await checkoutPage.orderId(),
    code: await checkoutOrderCode(),
    cash: amt.Cash,
    other: amt.Other,
  };
}

async function openHistory(orderId: string): Promise<void> {
  await returnToHome();
  await goToOrderHistory();
  await orderHistoryPage.openOrder(orderId);
  await orderHistoryDetailPage.waitForOrder(orderId);
}

const flat = (s: string): string => s.replace(/\s*\n+\s*/g, ' | ');

describe('volt-qc 03 PAY — Cash / Other settle, success screen, history', function () {
  this.timeout(Timeouts.MOCHA_TEST * 3);

  afterEach(async () => {
    await cleanTill();
  });

  it(
    title(
      'Cash over-tender: Change shown, success screen "Cash (Received … - Change …)", No Receipt ends the flow, customer display back to welcome, Order History Successful with Got/Change (PAY-023, PAY-024, PAY-116, PAY-118, PAY-130)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      const d = await draftAtCheckout();
      const change = OVER_TENDER_CENTS - d.cash;

      await step('PAY-024: $888.88 tendered → Change row = tendered − due', async () => {
        await checkoutPage.selectTender('cash');
        await typeAmount(OVER_TENDER_CENTS);
        const s = await checkoutState();
        expect(s.hasChange).toBe(true);
        expect(s.change).toBe(change);
      });

      const success = await step('PAY-023: Complete Payment → payment-success', async () => {
        await payInCash(d.orderId, { tenderedCents: OVER_TENDER_CENTS });
        return waitSuccess();
      });

      await step('PAY-116 / PAY-024: heading, total, method line with Received/Change', async () => {
        expect(success).toContain(VqcPay.successHeading);
        expect(success).toContain(usd(d.cash));
        expect(success).toContain(`Received ${usd(OVER_TENDER_CENTS)} - Change ${usd(change)}`);
        expect(await paymentSuccessPage.areAllReceiptActionsShown()).toBe(true);
      });

      await step(
        'PAY-118: No Receipt → leaves payment-success; customer display returns to welcome',
        async () => {
          await noReceipt();
          expect(await homePage.currentPath()).toMatch(/order-pending|home/);
          await browser.waitUntil(() => customerDisplayPage.isShowingWelcome(), {
            timeout: Timeouts.MEDIUM,
            timeoutMsg: 'Customer display never returned to its welcome screen',
          });
        },
      );

      await step('PAY-130: Order History — Successful, Cash, Got/Change, one cash transaction', async () => {
        await openHistory(d.orderId);
        expect(await orderHistoryDetailPage.readInformation()).toMatch(/Successful/);
        const pay = flat(await orderHistoryDetailPage.readPayment());
        expect(pay).toMatch(/Cash/);
        expect(pay).toContain(`Got: ${usd(OVER_TENDER_CENTS)}`);
        expect((pay.match(/Got: \$/g) ?? []).length).toBe(1);
      });
    },
  );

  it(
    title(
      'Documented example: order $42.30, customer hands $50 → change = $50 − cash due (PAY-025)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      const d = await draftAtCheckout(4_230);
      const given = d.cash <= 5_000 ? 5_000 : 10_000;
      await checkoutPage.selectTender('cash');
      await keys([given === 5_000 ? '$50' : '$100']);
      expect((await checkoutState()).change).toBe(given - d.cash);
      const s = await completeToSuccess();
      expect(s).toContain(`Received ${usd(given)} - Change ${usd(given - d.cash)}`);
      if (d.cash === 4_230) expect(s).toContain('Change $7.70');
      await noReceipt();
    },
  );

  it(
    title(
      'A just-paid cash order never comes back to Pending; history shows it Successful with the cash total (PAY-031)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      const d = await draftAtCheckout();
      await payInCash(d.orderId);
      await noReceipt();
      await returnToHome();
      await orderPendingPage.open();
      for (let i = 0; i < 3; i += 1) {
        expect(await orderPendingPage.isOrderListed(d.code)).toBe(false);
        await settle(3_000);
      }
      await openHistory(d.orderId);
      expect(await orderHistoryDetailPage.readInformation()).toMatch(/Successful/);
      expect(flat(await orderHistoryDetailPage.readSummary())).toContain(usd(d.cash));
      expect(flat(await orderHistoryDetailPage.readPayment())).toMatch(/Cash/);
    },
  );

  it(
    title(
      'Other with a method name records the name on the success screen (PAY-032)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      const d = await draftAtCheckout();
      await payWithOther(d.orderId, 'Zelle QC');
      const s = await waitSuccess();
      expect(s).toMatch(/Other/);
      expect(s).toContain('Zelle QC');
      expect(s).toContain(usd(d.other));
      await noReceipt();
    },
  );

  it(
    title(
      'Other without a name is allowed and the line reads just "Other" (PAY-033)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      const d = await draftAtCheckout();
      await checkoutPage.selectOtherTender();
      await P.fillQ(VqcPay.otherNameInput, '');
      const s = await completeToSuccess();
      const line = /\| Other(?: \| [^|]*)? \| \$[\d,.]+/.exec(s)?.[0] ?? '';
      expect(line).not.toBe('');
      expect(line).not.toContain('(');
      expect(line).toContain(usd(d.other));
      await noReceipt();
    },
  );

  it(
    title(
      'Other name is capped at 255 characters and a long name is ellipsised on one line (PAY-034)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      await draftAtCheckout();
      await checkoutPage.selectOtherTender();
      const v = await P.fillQ(VqcPay.otherNameInput, 'A'.repeat(256));
      expect(v.length).toBe(255);
      await completeToSuccess();
      const style = await ellipsisStyle('A'.repeat(50));
      expect(style).not.toBeNull();
      if (style) {
        expect(style.ws).toBe('nowrap');
        expect(style.to).toBe('ellipsis');
        expect(style.h).toBeLessThan(style.lh * 1.6);
      }
      await noReceipt();
    },
  );

  it(
    title(
      'An Other name with Vietnamese diacritics and symbols survives to the success screen and Order History (PAY-035)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      const name = 'Chuyển khoản #1 & Zelle';
      const d = await draftAtCheckout();
      await checkoutPage.selectOtherTender();
      expect(await P.fillQ(VqcPay.otherNameInput, name)).toBe(name);
      const s = await completeToSuccess();
      expect(s).toContain(name);
      await noReceipt();
      await openHistory(d.orderId);
      expect(await orderHistoryDetailPage.readPayment()).toContain(name);
    },
  );

  it(
    title(
      'Double-clicking Complete Payment creates ONE Other transaction (PAY-115)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      const d = await draftAtCheckout();
      await checkoutPage.selectOtherTender();
      await doubleClickQ(VqcPay.completePayment);
      await settle(1_500);
      // The second click can land on the guard's overlay and close it — press once more then.
      if (
        !(await passcodeDialog.isPrompting(Timeouts.ANIMATION)) &&
        !(await checkoutPage.isWaitingForCustomerTip()) &&
        !(await paymentSuccessPage.isActive()) &&
        (await checkoutPage.isActive())
      ) {
        await checkoutPage.pressCompletePayment();
      }
      await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
      await completeCustomerTipIfPrompted('none');
      await waitSuccess();
      await noReceipt();
      await openHistory(d.orderId);
      const pay = flat(await orderHistoryDetailPage.readPayment());
      expect((pay.match(/\bOther\b/g) ?? []).length).toBe(1);
      expect(pay).toContain(usd(d.other));
    },
  );

  it(
    title(
      'Success screen: customer-side No Receipt ends the flow; SMS / Email Send stay disabled on bad input; Print without a printer toasts and stays (PAY-119, PAY-121, PAY-122, PAY-124)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const d = await draftAtCheckout();
      await payInCash(d.orderId);
      await waitSuccess();

      await step('PAY-122: Text Message → 9 digits → Send disabled → Close', async () => {
        await paymentSuccessPage.textReceipt();
        await P.waitFor(VqcPay.smsDialog, Timeouts.SHORT, 'SMS receipt dialog');
        await P.fillQ(VqcPay.smsPhone, '832123456');
        expect(await P.isDisabled(VqcPay.smsSend)).toBe(true);
        await P.clickQ(VqcPay.smsClose);
        await P.waitGoneQ(VqcPay.smsDialog, Timeouts.SHORT);
      });

      await step('PAY-124: Email → "abc@" → Send disabled → Close', async () => {
        await paymentSuccessPage.emailReceipt();
        await P.waitFor(VqcPay.emailDialog, Timeouts.SHORT, 'Email receipt dialog');
        await P.fillQ(VqcPay.emailInput, 'abc@');
        expect(await P.isDisabled(VqcPay.emailSend)).toBe(true);
        await P.clickQ(VqcPay.emailClose);
        await P.waitGoneQ(VqcPay.emailDialog, Timeouts.SHORT);
      });

      await step('PAY-121: Print with no printer → error toast, still on payment-success', async () => {
        await paymentSuccessPage.printReceipt();
        expect(await toastSeen(VqcPay.printerErrorRe)).toBe(true);
        expect(await paymentSuccessPage.isActive()).toBe(true);
      });

      await step('PAY-119: customer taps No Receipt → main leaves payment-success', async () => {
        await customerClickText('No Receipt');
        await paymentSuccessPage.waitForFlowToEnd();
      });
    },
  );

  it(
    title(
      'An unknown order / transactionId on payment-success shows "Transaction Not Found" with a way back to Home (PAY-129)',
      Tag.REGRESSION,
    ),
    async () => {
      await returnToHome();
      await P.routerGo('/order/00000000-0000-0000-0000-000000000000/payment-success', {
        transactionId: 'invalid',
      });
      await browser.waitUntil(async () => (await P.pageText('body')).includes(VqcPay.transactionNotFound), {
        timeout: Timeouts.MEDIUM,
        timeoutMsg: '"Transaction Not Found" never rendered',
      });
      const back = { role: 'link', name: 'Back to Home' } as const;
      if (await P.has(back)) await P.clickQ(back);
      else await P.clickQ({ role: 'button', name: 'Back to Home' });
      await browser.waitUntil(async () => /\/home/.test(await P.path()), { timeout: Timeouts.MEDIUM });
    },
  );

  it(
    title(
      'No drawer / printer on the till: Cash Drawer toasts "Open cash drawer failed" and Print on checkout toasts, payment still possible (PAY-133, PAY-137)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await draftAtCheckout();
      await checkoutPage.selectTender('cash');

      await step(
        'PAY-133: Cash Drawer → guard (if on) → drawer error toast; Complete still enabled',
        async () => {
          await checkoutPage.pressCashDrawer();
          await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
          expect(await toastSeen(VqcPay.drawerErrorRe)).toBe(true);
          expect(await checkoutPage.isCompletePaymentEnabled()).toBe(true);
        },
      );

      await step(
        'PAY-137: Print on checkout → printer toast, still on checkout, Total Paid $0.00',
        async () => {
          await P.closeToasts();
          await checkoutPage.pressPrint();
          expect(await toastSeen(VqcPay.printerErrorRe)).toBe(true);
          expect(await checkoutPage.isActive()).toBe(true);
          expect((await checkoutState()).totalPaid).toBe(0);
        },
      );
    },
  );
});
