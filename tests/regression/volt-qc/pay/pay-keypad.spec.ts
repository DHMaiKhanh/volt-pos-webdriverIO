/**
 * volt-qc port — 03 PAY: the checkout keypad, quick cash and amount limits (drafts only).
 *
 * Source: volt-qc `e2e/tests/03-checkout/pay-plan-keypad.spec.ts` (PAY-L, PAY-M,
 * PAY-A2), `payment.spec.ts` (PAY-A, PAY-C), `pay-deep.spec.ts` (PAY-D03) and
 * `17-added/home-pay-oh-added.spec.ts` (PAY-AD1). TC catalogue:
 * docs/qc/volt-qc/windows-regression/03-checkout-thanh-toan.md.
 *
 * Nothing is paid: every case probes the keypad on a draft and voids it.
 *
 * Adaptations vs the source:
 * - PAY-015 / PAY-022: the catalogue says production APPENDS a digit to the
 *   pre-filled / quick-cash amount, the volt-qc dev build REPLACED it. Both are
 *   accepted here (and nothing else): the case proves the key never produces a
 *   third, garbage value, without pinning a build-specific rule.
 * - "9" sits under the "$50" quick-cash button on build 1.1.x
 *   ([[checkout-keypad-preset-overlap]]); `keys()` presses it without hit-testing.
 * - PAY-173 builds a $32.00 Quick Pay line; with tax on, the cash due is read off
 *   the Cash button, and each preset is checked against THAT due.
 *
 * CREATES DATA (drafts, all voided). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { QUICK_CASH, VqcPay } from '../../../../src/constants/testids.voltqc-pay.js';
import { step } from '../../../../src/helpers/steps.js';
import { checkoutPage, homePage } from '../../../../src/pages/index.js';
import {
  P,
  TENDER,
  checkoutState,
  cleanTill,
  isTipEnabled,
  keys,
  methodAmounts,
  setCashierTip,
  typeAmount,
} from '../../../../src/pages/voltqc/pay/payProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { buildDraft } from '../../order-flow/charge-matrix.helpers.js';

const PRESET_CENTS: Record<(typeof QUICK_CASH)[number], number> = {
  $5: 500,
  $10: 1_000,
  $50: 5_000,
  $100: 10_000,
};

async function draftAtCheckout(quickPayCents?: number): Promise<void> {
  await buildDraft(
    quickPayCents === undefined ? {} : { quickPay: { amountCents: quickPayCents, name: 'QC QP' } },
  );
  await homePage.pressPay();
  await checkoutPage.waitForReady();
}

/** Re-fill the cash tender with its full due (re-selecting the active tab is a no-op). */
async function refillCash(): Promise<void> {
  await checkoutPage.selectTender('card');
  await checkoutPage.selectTender('cash');
}

describe('volt-qc 03 PAY — keypad & quick cash (drafts)', function () {
  this.timeout(Timeouts.MOCHA_TEST * 2);

  afterEach(async () => {
    await cleanTill();
  });

  it(
    title(
      'Keypad: C → $0.00 then digits by cents, back-space drops the last digit down to $0.00, a key after the pre-fill appends or replaces, $0.00 cannot complete (PAY-015, PAY-016, PAY-017, PAY-028)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await draftAtCheckout();
      const due = (await methodAmounts()).Cash;
      await checkoutPage.selectTender('cash');

      await step('PAY-015: pre-filled cash + "5" → append (×10 + 5) or replace ($0.05)', async () => {
        expect(await checkoutPage.enteredAmountCents()).toBe(due);
        await keys(['5']);
        expect([due * 10 + 5, 5]).toContain(await checkoutPage.enteredAmountCents());
      });

      await step(
        'PAY-017: back-space ×5 from the due drops one cents digit each time, never below $0.00',
        async () => {
          await refillCash();
          const seen: number[] = [];
          for (let i = 0; i < 5; i += 1) {
            await keys(['back']);
            seen.push(await checkoutPage.enteredAmountCents());
          }
          const want = Array.from({ length: 5 }, (_, i) => Math.floor(due / 10 ** (i + 1)));
          expect(seen).toEqual(want);
          await keys(['back']);
          expect(await checkoutPage.enteredAmountCents()).toBe(0);
        },
      );

      await step('PAY-016: C → $0.00, then 1-2-3-4 → $12.34', async () => {
        await keys(['C']);
        expect(await checkoutPage.enteredAmountCents()).toBe(0);
        await keys(['1', '2', '3', '4']);
        expect(await checkoutPage.enteredAmountCents()).toBe(1_234);
      });

      await step('PAY-028: $0.00 → Remaining = full due, Complete Payment disabled', async () => {
        await keys(['C']);
        const s = await checkoutState();
        expect(s.entered).toBe(0);
        expect(s.remaining).toBe(due);
        expect(await checkoutPage.isCompletePaymentEnabled()).toBe(false);
      });
    },
  );

  it(
    title(
      'Quick cash REPLACES the entry: each of $5/$10/$50/$100 on a $32.00 order sets the amount, Remaining/Change and Complete Payment follow; two in a row keep the last; a digit after a preset appends or replaces (PAY-020, PAY-021, PAY-022, PAY-173)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await draftAtCheckout(3_200);
      const due = (await methodAmounts()).Cash;
      await checkoutPage.selectTender('cash');

      await step(
        'PAY-173: every preset replaces; Remaining / Change / Complete state match the due',
        async () => {
          for (const q of QUICK_CASH) {
            await keys([q]);
            const v = PRESET_CENTS[q];
            const s = await checkoutState();
            expect(s.entered).toBe(v);
            if (v >= due) {
              expect(s.remaining).toBe(0);
              expect(s.change).toBe(v - due);
              expect(await checkoutPage.isCompletePaymentEnabled()).toBe(true);
            } else {
              expect(s.remaining).toBe(due - v);
              expect(s.hasChange).toBe(false);
              expect(await checkoutPage.isCompletePaymentEnabled()).toBe(false);
            }
          }
        },
      );

      await step('PAY-020: $12.34 typed → $50 → $50.00, not $62.34', async () => {
        await typeAmount(1_234);
        await keys(['$50']);
        expect(await checkoutPage.enteredAmountCents()).toBe(5_000);
      });

      await step('PAY-021: $50 → $100 = $100.00; $5 → $5.00; $10 → $10.00', async () => {
        await keys(['$50', '$100']);
        expect(await checkoutPage.enteredAmountCents()).toBe(10_000);
        await keys(['$5']);
        expect(await checkoutPage.enteredAmountCents()).toBe(500);
        await keys(['$10']);
        expect(await checkoutPage.enteredAmountCents()).toBe(1_000);
      });

      await step('PAY-022: $50 then "5" → $500.05 (append) or $0.05 (replace)', async () => {
        await keys(['$50', '5']);
        expect([50_005, 5]).toContain(await checkoutPage.enteredAmountCents());
      });
    },
  );

  it(
    title(
      'Amount limits: cash is unbounded with exact change; Card / Gift Card / Other clamp at the due; 1-cent boundaries; under-tender blocks Complete on Cash and Other (PAY-018, PAY-019, PAY-026, PAY-027, PAY-037)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await draftAtCheckout();
      const amt = await methodAmounts();
      const due = amt.Cash;
      await checkoutPage.selectTender('cash');

      await step(
        'PAY-019: cash $888.88 → Change = 888.88 − due, Remaining $0.00, Complete enabled',
        async () => {
          await typeAmount(88_888);
          const s = await checkoutState();
          expect(s.entered).toBe(88_888);
          expect(s.change).toBe(88_888 - due);
          expect(s.remaining).toBe(0);
          expect(await checkoutPage.isCompletePaymentEnabled()).toBe(true);
        },
      );

      await step(
        'PAY-027: due − 1¢ → Remaining $0.01 disabled; due → no Change, enabled; due + 1¢ → Change $0.01',
        async () => {
          await typeAmount(due - 1);
          let s = await checkoutState();
          expect(s.remaining).toBe(1);
          expect(await checkoutPage.isCompletePaymentEnabled()).toBe(false);
          await typeAmount(due);
          s = await checkoutState();
          expect(s.remaining).toBe(0);
          expect(s.hasChange).toBe(false);
          expect(await checkoutPage.isCompletePaymentEnabled()).toBe(true);
          await typeAmount(due + 1);
          expect((await checkoutState()).change).toBe(1);
        },
      );

      await step('PAY-026: cash $1.00 below the due → Complete Payment disabled', async () => {
        await typeAmount(Math.max(due - 100, 1));
        expect((await checkoutState()).remaining).toBeGreaterThan(0);
        expect(await checkoutPage.isCompletePaymentEnabled()).toBe(false);
      });

      await step(
        'PAY-018: Other / Gift Card / Card typing $20,000.00 stops at the due, no Change',
        async () => {
          for (const m of ['Other', 'Gift Card', 'Card'] as const) {
            await checkoutPage.selectTender(TENDER[m]);
            await typeAmount(2_000_000);
            const s = await checkoutState();
            expect(s.entered).toBe(amt[m]);
            expect(s.hasChange).toBe(false);
          }
        },
      );

      await step('PAY-037: Other $5.00 < due → Remaining = due − $5, Complete disabled', async () => {
        await checkoutPage.selectTender('other');
        await typeAmount(500);
        expect((await checkoutState()).remaining).toBe(amt.Other - 500);
        expect(await checkoutPage.isCompletePaymentEnabled()).toBe(false);
        expect(await P.has(VqcPay.continuePayment)).toBe(false);
      });
    },
  );

  it(
    title(
      'A cashier tip on an already-entered cash amount adds the tip to the tendered amount (PAY-029)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      await draftAtCheckout(3_200);
      const due = (await methodAmounts()).Cash;
      await checkoutPage.selectTender('cash');
      if (!(await isTipEnabled())) this.skip();
      await keys(['$50']);
      await setCashierTip(['5', '0', '0']);
      const s = await checkoutState();
      expect(s.entered).toBe(5_500);
      expect(s.tip).toBe(500);
      expect(s.total).toBe(due + 500);
      if (5_500 >= due + 500) expect(s.change).toBe(5_500 - (due + 500));
      else expect(s.remaining).toBe(due + 500 - 5_500);
    },
  );
});
