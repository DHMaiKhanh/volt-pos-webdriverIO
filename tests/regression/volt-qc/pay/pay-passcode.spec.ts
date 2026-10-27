/**
 * volt-qc port — 03 PAY: the Complete Payment passcode guard.
 *
 * Source: volt-qc `e2e/tests/03-checkout/pay-plan-passcode.spec.ts` (PAY-S,
 * PAY-S3). TC catalogue: docs/qc/volt-qc/windows-regression/03-checkout-thanh-toan.md.
 *
 * The suite normally runs inside the 30-minute "do not require passcode"
 * window that `returnToHome()` → `unlockForRun()` opens, so each case first
 * FORGETS that window (`volt-passcode-skip`) to make the guard appear. When the
 * merchant has the "Complete Order" gate switched off, the guard never shows and
 * the case skips — that is configuration (the gate-off case is manual).
 *
 * Adaptations vs the source:
 * * - The no-permission role case (a staff role WITHOUT "Completed Payment") needs a second staff
 *   code this environment does not carry → manual (`_manual/pay.manual.spec.ts`).
 * - PAY-113 runs unconditionally: ticking the 30-minute box is exactly the state
 *   the suite's own unlock leaves behind, so it does not change the shared till.
 *
 * CREATES DATA AND TAKES CASH / OTHER PAYMENTS. dev / staging only.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../../src/components/index.js';
import { VqcCommon, btn } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqcPay } from '../../../../src/constants/testids.voltqc-pay.js';
import {
  completeCustomerTipIfPrompted,
  goToOrderHistory,
  returnToHome,
} from '../../../../src/flows/index.js';
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
  cleanTill,
  clearPasscodeSkip,
  noReceipt,
  passcodeText,
  typePasscode,
  waitSuccess,
} from '../../../../src/pages/voltqc/pay/payProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { buildDraft } from '../../order-flow/charge-matrix.helpers.js';

const GUARD = VqcCommon.passcodeDialog;

/** A 4-digit code that is not the configured staff passcode. */
function unknownCode(): string {
  return ['0137', '2468', '1357'].find((c) => c !== env.STAFF_PASSCODE) ?? '0137';
}

async function draftAtCheckout(): Promise<string> {
  await buildDraft({});
  await homePage.pressPay();
  await checkoutPage.waitForReady();
  return checkoutPage.orderId();
}

async function filledDots(): Promise<number> {
  return P.count([GUARD, { css: 'div.rounded-full.bg-primary-500' }]);
}

describe('volt-qc 03 PAY — Complete Payment passcode', function () {
  this.timeout(Timeouts.MOCHA_TEST * 3);

  afterEach(async () => {
    if (await passcodeDialog.isPrompting(Timeouts.ANIMATION).catch(() => false)) await P.escape();
    await cleanTill();
  });

  it(
    title(
      'Guard layout (title, 4 dots, 0–9, 30-min box); wrong code errors with no payment; Escape / X cancel; physical keys + Backspace; the right 4 digits auto-submit and the sale completes with a Cashier (PAY-107, PAY-108, PAY-109, PAY-111, PAY-112)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      const orderId = await draftAtCheckout();
      await checkoutPage.selectTender('cash');
      await clearPasscodeSkip();
      await checkoutPage.pressCompletePayment();
      if (!(await passcodeDialog.isPrompting(Timeouts.SHORT))) {
        // Gate off: the sale just went through. Close it out and skip.
        await completeCustomerTipIfPrompted('none');
        await waitSuccess();
        await noReceipt();
        this.skip();
      }

      await step('PAY-107: title, 4 dots, digit keys, 30-minute checkbox', async () => {
        const t = await passcodeText();
        expect(t).toContain(VqcPay.passcodeCompleteTitle);
        expect(await P.count([GUARD, { css: 'div.rounded-full.w-5' }])).toBe(4);
        for (const d of '0123456789') expect(await P.has([GUARD, btn(d, 0)])).toBe(true);
        expect(t).toContain(VqcPay.skip30Label);
      });

      await step('PAY-109: unknown code → error, guard stays, still on checkout', async () => {
        const r = await typePasscode(unknownCode());
        expect(r.open).toBe(true);
        expect(r.text).toMatch(/Invalid staff code|Failed to verify|invalid|not found/i);
        expect(await checkoutPage.isActive()).toBe(true);
      });

      await step(
        'PAY-111: Escape closes the guard; X closes it too; nothing paid, Complete still enabled',
        async () => {
          await P.escape();
          expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION)).toBe(false);
          expect(await checkoutPage.isCompletePaymentEnabled()).toBe(true);
          await checkoutPage.pressCompletePayment();
          expect(await passcodeDialog.isPrompting(Timeouts.SHORT)).toBe(true);
          await P.clickQ([GUARD, { css: 'button.absolute', nth: 0 }]);
          expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION)).toBe(false);
          expect(await checkoutPage.isActive()).toBe(true);
          expect(await checkoutPage.isCompletePaymentEnabled()).toBe(true);
        },
      );

      await step('PAY-112 / PAY-108: keyboard 2 digits → Backspace ×2 → full code auto-submits', async () => {
        await checkoutPage.pressCompletePayment();
        expect(await passcodeDialog.isPrompting(Timeouts.SHORT)).toBe(true);
        await browser.keys(env.STAFF_PASSCODE.slice(0, 2).split(''));
        await settle(300);
        expect(await filledDots()).toBe(2);
        await browser.keys(['Backspace']);
        await settle(300);
        expect(await filledDots()).toBe(1);
        await browser.keys(['Backspace']);
        await browser.keys(env.STAFF_PASSCODE.split(''));
        await browser.waitUntil(async () => !(await passcodeDialog.isPrompting(Timeouts.ANIMATION)), {
          timeout: Timeouts.MEDIUM,
          timeoutMsg: 'The guard never accepted the typed passcode',
        });
        await completeCustomerTipIfPrompted('none');
        await waitSuccess();
        await noReceipt();
      });

      await step('PAY-108: Order History records a Cashier', async () => {
        await returnToHome();
        await goToOrderHistory();
        await orderHistoryPage.openOrder(orderId);
        await orderHistoryDetailPage.waitForOrder(orderId);
        expect(await orderHistoryDetailPage.readInformation()).toMatch(/Cashier\s*\|?\s*\S+/);
      });
    },
  );

  it(
    title(
      'Ticking "Do not require passcode for the next 30 minutes" skips the guard on the next payment (PAY-113)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      await draftAtCheckout();
      await checkoutPage.selectOtherTender();
      await clearPasscodeSkip();
      await checkoutPage.pressCompletePayment();
      if (!(await passcodeDialog.isPrompting(Timeouts.SHORT))) {
        await completeCustomerTipIfPrompted('none');
        await waitSuccess();
        await noReceipt();
        this.skip();
      }
      await passcodeDialog.enter(env.STAFF_PASSCODE, { skipForNext30Min: true });
      await completeCustomerTipIfPrompted('none');
      await waitSuccess();
      await noReceipt();
      expect(await P.localGet(VqcPay.passcodeSkipKey)).not.toBeNull();

      await returnToHome();
      await draftAtCheckout();
      await checkoutPage.selectOtherTender();
      await checkoutPage.pressCompletePayment();
      expect(await passcodeDialog.isPrompting(Timeouts.SHORT)).toBe(false);
      await completeCustomerTipIfPrompted('none');
      await waitSuccess();
      await noReceipt();
    },
  );
});
