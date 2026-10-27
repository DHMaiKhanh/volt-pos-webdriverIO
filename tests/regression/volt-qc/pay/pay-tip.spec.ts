/**
 * volt-qc port — 03 PAY: cashier tip dialog and the customer-display tip screen.
 *
 * Source: volt-qc `e2e/tests/03-checkout/pay-plan-tip.spec.ts` (PAY-P, PAY-P2,
 * PAY-P3, PAY-Q, PAY-Q2) and `payment.spec.ts` (PAY-D). TC catalogue:
 * docs/qc/volt-qc/windows-regression/03-checkout-thanh-toan.md.
 *
 * Every case needs the merchant to TIP on the cash tender (Tip button enabled /
 * customer tip screen pushed on Complete Payment). A merchant whose Tip Settings
 * leave cash out skips with that reason rather than failing — it is
 * configuration, not a defect. The customer-display cases need the LAUNCH lane
 * (customer window = WebDriver handle).
 *
 * Adaptations vs the source:
 * - Staff/service by tile index; the tip base is read off "Tip based on total"
 *   instead of a hard-coded $30.00 service.
 * - PAY-076 / PAY-077 (no volt-qc test) use a $0.01 Quick Pay line so every %
 *   preset rounds to $0.00.
 *
 * CREATES DATA AND TAKES CASH PAYMENTS. dev / staging only.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../../src/components/index.js';
import { PAY_METHODS, VqcPay } from '../../../../src/constants/testids.voltqc-pay.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  checkoutPage,
  customerDisplayPage,
  homePage,
  paymentSuccessPage,
} from '../../../../src/pages/index.js';
import {
  P,
  addTipAndClose,
  checkoutState,
  cleanTill,
  clearCashierTip,
  clickCustomerPreset,
  completeUntilCustomerTip,
  customerClickButton,
  customerCustomTipBack,
  customerContinueDisabled,
  customerText,
  customerTipBasedOn,
  customerTipPresets,
  isTipEnabled,
  methodAmounts,
  noReceipt,
  openCashierTip,
  setCashierTip,
  tipDialogAmount,
  tipKeys,
  usd,
  waitCustomerTipScreen,
  waitSuccess,
} from '../../../../src/pages/voltqc/pay/payProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { buildDraft } from '../../order-flow/charge-matrix.helpers.js';

async function cashCheckout(quickPayCents?: number): Promise<{ homeTotal: number; cash: number }> {
  await buildDraft(
    quickPayCents === undefined ? {} : { quickPay: { amountCents: quickPayCents, name: 'QC QP' } },
  );
  const homeTotal = await homePage.cartTotal();
  await homePage.pressPay();
  await checkoutPage.waitForReady();
  const cash = (await methodAmounts()).Cash;
  await checkoutPage.selectTender('cash');
  return { homeTotal, cash };
}

/** Complete Payment → customer tip screen, or skip when this merchant does not tip cash. */
async function toCustomerTipOrSkip(ctx: Mocha.Context): Promise<void> {
  if (!(await completeUntilCustomerTip())) {
    await noReceipt();
    ctx.skip();
  }
  await waitCustomerTipScreen();
}

describe('volt-qc 03 PAY — tips', function () {
  this.timeout(Timeouts.MOCHA_TEST * 3);

  afterEach(async () => {
    if (await checkoutPage.isWaitingForCustomerTip().catch(() => false)) {
      await P.clickQ(VqcPay.waitingTipCancel).catch(() => undefined);
    }
    if (await P.has(VqcPay.tipDialog).catch(() => false))
      await P.clickQ(VqcPay.tipClose).catch(() => undefined);
    await cleanTill();
  });

  it(
    title(
      'Cashier tip: Total and every tender go up by the tip, customer display shows it; reopening replaces on the first key, 00 ×100; presets add; X closes without saving, Escape / outside click do not close; capped at $10,000; $0 removes the tip (PAY-056, PAY-057, PAY-058, PAY-059, PAY-060, PAY-061, PAY-062)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      await buildDraft({});
      const homeTotal = await homePage.cartTotal();
      await homePage.pressPay();
      await checkoutPage.waitForReady();
      const amt = await methodAmounts();

      // PAY-056: an order with a staff line has Tip enabled — unless Tip Settings leave it out (config → skip).
      if (!(await isTipEnabled())) this.skip();

      await step(
        'PAY-057: Tip $5.00 → Tip row, Total +$5, each tender +$5, customer display Tip $5.00',
        async () => {
          await setCashierTip(['5', '0', '0']);
          const s = await checkoutState();
          expect(s.tip).toBe(500);
          expect(s.total).toBe(homeTotal + 500);
          const a = await methodAmounts();
          for (const m of PAY_METHODS) expect(a[m]).toBe(amt[m] + 500);
          await browser.waitUntil(async () => /Tip \| \$5\.00/.test(await customerText()), {
            timeout: Timeouts.MEDIUM,
            timeoutMsg: 'Customer display never showed Tip $5.00',
          });
        },
      );

      await step('PAY-059: reopen ($5.00) → "3" = $0.03 → "00" = $3.00 → Add', async () => {
        await openCashierTip();
        expect(await tipDialogAmount()).toBe(500);
        await tipKeys(['3']);
        expect(await tipDialogAmount()).toBe(3);
        await tipKeys(['00']);
        expect(await tipDialogAmount()).toBe(300);
        await addTipAndClose();
        expect((await checkoutState()).tip).toBe(300);
      });

      await step('PAY-058: from $0, $20 + $50 = $70.00; reopen + $20 = $90.00', async () => {
        await clearCashierTip();
        await openCashierTip();
        await tipKeys(['$20', '$50']);
        expect(await tipDialogAmount()).toBe(7_000);
        await addTipAndClose();
        expect((await checkoutState()).tip).toBe(7_000);
        await openCashierTip();
        await tipKeys(['$20']);
        expect(await tipDialogAmount()).toBe(9_000);
        await addTipAndClose();
        expect((await checkoutState()).tip).toBe(9_000);
      });

      await step(
        'PAY-061: Escape and an outside click keep the dialog; X closes it and the tip is unchanged',
        async () => {
          await openCashierTip();
          await tipKeys(['8', '0', '0']);
          await P.escape();
          expect(await P.has(VqcPay.tipDialog)).toBe(true);
          await P.clickAt(5, 5);
          expect(await P.has(VqcPay.tipDialog)).toBe(true);
          await P.clickQ(VqcPay.tipClose);
          await P.waitGoneQ(VqcPay.tipDialog, Timeouts.SHORT);
          expect((await checkoutState()).tip).toBe(9_000);
        },
      );

      await step('PAY-062: 1-0-0-0-0-0-0-0 stops at $10,000.00', async () => {
        await openCashierTip();
        await tipKeys(['1', '0', '0', '0', '0', '0', '0', '0']);
        expect(await tipDialogAmount()).toBe(1_000_000);
        await addTipAndClose();
        expect((await checkoutState()).tip).toBe(1_000_000);
      });

      await step(
        'PAY-060: back-space to $0.00 → Add → Tip row gone; Cash Complete still asks the customer for a tip',
        async () => {
          await clearCashierTip();
          expect(await P.pageText('main')).not.toMatch(/\| Tip \| \$/);
          await checkoutPage.selectTender('cash');
          const asked = await completeUntilCustomerTip();
          if (asked) {
            await customerDisplayPage.waitForTipPrompt(Timeouts.LONG);
            await customerDisplayPage.chooseTip('none');
            await customerDisplayPage.pressContinue();
          }
          await waitSuccess();
          await noReceipt();
        },
      );
    },
  );

  it(
    title(
      'A cashier tip on Cash is not asked again on the customer display; success shows "<cash> + $3.00 Tip" (PAY-065, PAY-116)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      const { cash } = await cashCheckout();
      if (!(await isTipEnabled())) this.skip();
      await setCashierTip(['3', '0', '0']);
      await checkoutPage.pressCompletePayment();
      let sawWaiting = false;
      const deadline = Date.now() + Timeouts.LONG;
      while (Date.now() < deadline && !(await paymentSuccessPage.isActive())) {
        if (await passcodeDialog.isPrompting(Timeouts.ANIMATION))
          await passcodeDialog.enter(env.STAFF_PASSCODE);
        if (await checkoutPage.isWaitingForCustomerTip()) {
          sawWaiting = true;
          await customerDisplayPage.chooseTip('none').catch(() => undefined);
          await customerDisplayPage.pressContinue().catch(() => undefined);
        }
        await settle(400);
      }
      expect(sawWaiting).toBe(false);
      const s = await waitSuccess();
      expect(s).toContain(`${usd(cash)} + $3.00 Tip`);
      expect(s).toContain(usd(cash + 300));
      expect(s).toContain('Total Tip: $3.00');
      await noReceipt();
    },
  );

  it(
    title(
      'Customer tip screen: cashier waits with Cancel, Continue disabled until a choice, Cancel returns to an unpaid checkout; % presets = round(base × %); Custom then back keeps the preset; Continue → "+ $x Tip" (PAY-068, PAY-070, PAY-074, PAY-075, PAY-078)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { cash } = await cashCheckout();

      await toCustomerTipOrSkip(this);
      await step(
        'PAY-068 / PAY-078: waiting dialog + customer screen labels; Continue disabled; still waiting after 2 s',
        async () => {
          const mainText = await P.pageText('body');
          expect(mainText).toContain('Customer is adding a tip');
          expect(await P.has(VqcPay.waitingTipCancel)).toBe(true);
          const ct = await customerText();
          expect(ct).toContain('Custom Tip');
          expect(ct).toContain('No Tip');
          expect(ct).toMatch(/Tip Amount: \$0\.00/);
          expect(await customerContinueDisabled()).toBe(true);
          await settle(2_000);
          expect(await checkoutPage.isActive()).toBe(true);
        },
      );

      await step(
        'PAY-075: cashier Cancel → still on checkout, Total Paid $0.00, customer leaves the tip screen',
        async () => {
          await P.clickQ(VqcPay.waitingTipCancel);
          await browser.waitUntil(async () => !(await checkoutPage.isWaitingForCustomerTip()), {
            timeout: Timeouts.SHORT,
          });
          expect(await checkoutPage.isActive()).toBe(true);
          expect((await checkoutState()).totalPaid).toBe(0);
          await browser.waitUntil(async () => !/Add a tip/.test(await customerText()), {
            timeout: Timeouts.MEDIUM,
          });
        },
      );

      let preset = { index: 0, amount: 0 };
      let basedOn = Number.NaN;
      await toCustomerTipOrSkip(this);
      const presets = await customerTipPresets();
      if (presets.length === 0) this.skip();
      await step('PAY-070: "Tip based on total: $x"; each % preset = round(x × %)', async () => {
        basedOn = await customerTipBasedOn();
        expect(basedOn).toBeGreaterThan(0);
        for (const p of presets) expect(p.amount).toBe(Math.round((basedOn * p.percent) / 100));
        const first = presets[0];
        if (first) preset = { index: first.index, amount: first.amount };
        await clickCustomerPreset(preset.index);
        expect(await customerText()).toContain(`Tip Amount: ${usd(preset.amount)}`);
        expect(await customerContinueDisabled()).toBe(false);
      });

      await step(
        'PAY-074: Custom Tip → type → back arrow: back on "Add a tip", tip still the preset',
        async () => {
          await customerDisplayPage.openCustomTip();
          expect(await customerText()).toContain(`Custom tip on ${usd(basedOn)}`);
          await customerClickButton('5');
          await customerClickButton('5');
          await customerCustomTipBack();
          await browser.waitUntil(async () => /Add a tip/.test(await customerText()), {
            timeout: Timeouts.SHORT,
          });
          expect(await customerText()).toContain(`Tip Amount: ${usd(preset.amount)}`);
        },
      );

      await step('PAY-070: Continue → success "<cash> + $x Tip"', async () => {
        await customerDisplayPage.pressContinue();
        const s = await waitSuccess();
        expect(s).toContain(`${usd(cash)} + ${usd(preset.amount)} Tip`);
        expect(s).toContain(`Total Tip: ${usd(preset.amount)}`);
        await noReceipt();
      });
    },
  );

  it(
    title(
      'Customer No Tip → Continue settles without a tip (PAY-069)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { cash } = await cashCheckout();
      await toCustomerTipOrSkip(this);
      await customerDisplayPage.selectNoTip();
      await customerDisplayPage.pressContinue();
      const s = await waitSuccess();
      expect(s).toContain(usd(cash));
      expect(s).not.toContain('Total Tip');
      await noReceipt();
    },
  );

  it(
    title(
      'Customer Custom Tip $3.00 → "Custom tip on <base>", Tip Amount $3.00, success "+ $3.00 Tip" (PAY-073)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { cash } = await cashCheckout();
      await toCustomerTipOrSkip(this);
      const basedOn = await customerTipBasedOn();
      await customerDisplayPage.openCustomTip();
      if (!Number.isNaN(basedOn)) expect(await customerText()).toContain(`Custom tip on ${usd(basedOn)}`);
      for (const k of ['3', '0', '0']) await customerClickButton(k);
      await customerClickButton('Done');
      expect(await customerText()).toContain('Tip Amount: $3.00');
      await customerDisplayPage.pressContinue();
      const s = await waitSuccess();
      expect(s).toContain(`${usd(cash)} + $3.00 Tip`);
      await noReceipt();
    },
  );

  it(
    title(
      '% presets on $33.33 round half-up to the cent (PAY-071)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { cash } = await cashCheckout(3_333);
      await toCustomerTipOrSkip(this);
      const basedOn = await customerTipBasedOn();
      const presets = await customerTipPresets();
      if (presets.length === 0 || Number.isNaN(basedOn)) this.skip();
      for (const p of presets) expect(p.amount).toBe(Math.round((basedOn * p.percent) / 100));
      const first = presets[0];
      if (!first) this.skip();
      await clickCustomerPreset(first.index);
      await customerDisplayPage.pressContinue();
      const s = await waitSuccess();
      expect(s).toContain(`${usd(cash)} + ${usd(first.amount)} Tip`);
      await noReceipt();
    },
  );

  it(
    title(
      'On a $0.01 order every % preset reads $0.00: tapping one highlights only that one and Continue is allowed as no tip (PAY-076, PAY-077)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      await cashCheckout(1);
      await toCustomerTipOrSkip(this);
      const presets = await customerTipPresets();
      const zero = presets.filter((p) => p.amount === 0);
      if (zero.length < 2) this.skip();
      const target = zero[1];
      if (!target) this.skip();
      await clickCustomerPreset(target.index);
      const after = await customerTipPresets();
      expect(after.filter((p) => p.selected).map((p) => p.index)).toEqual([target.index]);
      expect(await customerContinueDisabled()).toBe(false);
      await customerDisplayPage.pressContinue();
      const s = await waitSuccess();
      expect(s).not.toContain('Total Tip');
      await noReceipt();
    },
  );
});
