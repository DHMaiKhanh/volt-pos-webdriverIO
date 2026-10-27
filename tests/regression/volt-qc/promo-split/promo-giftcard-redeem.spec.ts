/**
 * volt-qc port — 04 PROMO: paying with / refunding a gift card (PROMO-Q1..Q3, R1..R7).
 *
 * Source: volt-qc `e2e/tests/04-promo/promo-plan-giftcard-redeem.spec.ts`.
 * TC catalogue: docs/qc/volt-qc/windows-regression/04-khuyen-mai-diem-giftcard.md.
 *
 * Data: `VOLT_TEST_GIFT_CARD` (Active card on THIS merchant; topped up in Cash when
 * short). Unset → every case skips. PROMO-R6's no-permission leg needs a role code
 * (`VOLT_MANAGER_CODE` / `VOLT_PARTNER_CODE` / `VOLT_STAFFROLE_CODE`) whose
 * "Cancel Order (Void)" is OFF; without one that leg is logged and skipped.
 * PROMO-R7 needs `VOLT_ALLOW_PASSCODE_SKIP=1`.
 *
 * VP-3761: two transactions on one card inside 10 s are rejected — every redeem
 * waits `giftCardCooldown()` first (PROMO-Q3 deliberately does not).
 * Gift-card ledger writes are asynchronous on DEV (bug #6): balances are polled.
 *
 * REAL gift-card redeems, top-ups (Cash) and cancellations. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { VqcCommon, btn } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsHistory } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  currentBalanceOf,
  dismissCheckPaid,
  finishSplit,
  payCheckWithGiftCard,
  payOutcome,
  paidByGiftCard,
  roleWithoutPermission,
  startCancelOrder,
  typePasscode,
  unknownCode,
} from '../../../../src/pages/voltqc/promo-split/giftCardExtra.js';
import { priceModel } from '../../../../src/pages/voltqc/promo-split/price.js';
import {
  cancelPaidOrder,
  checkoutState,
  createQuickPayOrder,
  ensureGiftCardBalance,
  giftCardCooldown,
  markGiftCardUse,
  payCurrentWithGiftCard,
  pollValue,
  settledGiftCardBalance,
  waitGiftCardBalance,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import {
  openSplit,
  payCheck,
  startGiftCardCheck,
  voidCheck,
  waitCheckPaid,
} from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  app,
  appears,
  escapeRe,
  field,
  money,
  vqEnv,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const CODE = vqEnv.testGiftCard;
const NO_CARD = 'VOLT_TEST_GIFT_CARD is not set (an Active gift card on this merchant)';
const CANCELED_OK = { textRe: 'Order canceled successfully', nth: 0 } as const;
const INSUFFICIENT =
  'Gift Card balance is insufficient to revert this top-up. This order cannot be cancelled.';

const balanceOf = async (): Promise<number> => (await app.giftCardBalance(CODE)).balance;

/** Poll the card balance until ≈ `want` (gift-card refunds are asynchronous). */
const pollBalance = (want: number, timeout = 60_000): Promise<number> =>
  pollValue(balanceOf, (v) => Math.abs(v - want) < 0.005, timeout);

describe('volt-qc 04 PROMO — pay & refund with a gift card (PROMO-Q/R)', () => {
  before(() => {
    assertWritesAllowed('redeem / refund gift cards (volt-qc 04 PROMO)');
  });

  afterEach(async () => {
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders();
  });

  it(
    title(
      'PROMO-Q1 Wrong code "1" → "Gift card is not valid" + Scan Again, no transaction (PROMO-141)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(6 * 60_000);
      await app.createOrder();
      await app.pay();
      const r = await app.payWithGiftCard('1');
      expect(r.info).toContain('Gift card is not valid');
      await P.clickQ([VqpsCheckout.gcResultDialog, btn('Scan Again')]);
      expect(await appears({ text: 'Scan QR code', nth: 0 }, 10_000)).toBe(true);
      await app.closeStrayDialogs();
      expect(await app.url()).toMatch(/checkout/);
      expect((await checkoutState()).totalPaid).toBeCloseTo(0, 2);
    },
  );

  // bug #6: the checkout "Gift Card Accepted" box sometimes shows the OLD Current Balance (flaky).
  it(
    title(
      'PROMO-Q2 One card over consecutive orders: Current Balance decreases correctly; an order above the balance is refused (PROMO-146)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(6 * 60_000);
      const b = await ensureGiftCardBalance(CODE, 70);
      const o1 = await paidByGiftCard(CODE);
      // The debit lands asynchronously → wait for order 1 before paying order 2.
      expect(await waitGiftCardBalance(CODE, b - o1.total)).toBeCloseTo(b - o1.total, 2);

      await step('Order 2: "Gift Card Accepted" shows Current Balance = B − order 1', async () => {
        await app.createOrder();
        await app.pay();
        await giftCardCooldown();
        const r = await app.payWithGiftCard(CODE);
        expect(money(currentBalanceOf(r.info))).toBeCloseTo(b - o1.total, 2);
        await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
        await app.driveToSuccess('none');
        markGiftCardUse();
        await app.waitSuccess();
        await app.noReceipt();
      });

      const left = await waitGiftCardBalance(CODE, b - 2 * o1.total);
      expect(left).toBeCloseTo(b - 2 * o1.total, 2);

      if (left + 5 > 9_999.99) {
        console.warn('Balance too large for a Quick Pay order above it');
        this.skip();
      }
      await step('Order 3 = remaining balance + $5 → "Gift Card not Enough Balance"', async () => {
        await createQuickPayOrder([{ amount: Math.round((left + 5) * 100) / 100, name: 'QC GC Over' }]);
        await app.pay();
        await giftCardCooldown();
        const r = await app.payWithGiftCard(CODE);
        expect(r.info).toContain('Gift Card not Enough Balance');
        await P.clickQ([VqpsCheckout.gcResultDialog, btn('Cancel')]);
        await app.closeStrayDialogs();
        expect(await app.url()).toMatch(/checkout/);
      });
    },
  );

  // bug #13: the DEV gift-card backend does not block 2 transactions on one card within 10 s.
  it(
    title(
      'PROMO-Q3 2 transactions on one card within 10 s: the 2nd fails clearly, order 2 has no transaction, card debited once (PROMO-147)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(6 * 60_000);
      const b = await ensureGiftCardBalance(CODE, 70);
      const id2 = await app.createOrder();
      const id1 = await app.createOrder();
      await app.pay();
      const total = await app.methodAmount('Gift Card'); // what the card is debited (Gift Card price, not Card Total)
      await payCurrentWithGiftCard(CODE);
      const t0 = Date.now();
      await app.waitSuccess();
      await app.openPendingOrder(id2);
      await app.pay();
      const r = await app.payWithGiftCard(CODE);
      const elapsed = Date.now() - t0;
      // VERIFY: the customer tip screen can push this past 10 s → VP-3761 cannot be reproduced.
      if (elapsed >= 9_500 || !r.info.includes('Gift Card Accepted')) {
        console.warn(
          `2nd attempt reached Pay after ${String(Math.round(elapsed / 1000))} s (needs < 10 s) — ${r.info.slice(0, 80)}`,
        );
        this.skip();
      }
      await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
      const outcome = await payOutcome(20_000);
      console.warn(
        `[observation] PROMO-147: ${id1} → ${id2} after ${String(Math.round(elapsed / 1000))} s: ${outcome}`,
      );
      // A 2nd transaction inside 10 s must fail visibly — not silently, not succeed.
      expect(outcome).toBe('error');
      markGiftCardUse();
      await app.closeStrayDialogs();
      await waitGiftCardBalance(CODE, b - total);
      // Debited exactly once.
      expect(await settledGiftCardBalance(CODE)).toBeCloseTo(b - total, 2);
    },
  );

  it(
    title(
      'PROMO-R1 Cancel an order paid by gift card → "Order canceled successfully", Canceled, full refund (PROMO-154)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(6 * 60_000);
      const b = await ensureGiftCardBalance(CODE, 40);
      const { id, total } = await paidByGiftCard(CODE);
      expect(await waitGiftCardBalance(CODE, b - total)).toBeCloseTo(b - total, 2);
      await app.openHistoryOrder(id);
      await app.cancelOrder(0);
      expect(await appears(CANCELED_OK, 20_000)).toBe(true);
      expect(await app.waitHistoryStatus(id, /^Canceled$/, 90_000)).toBe('Canceled');
      expect(await pollBalance(b)).toBeCloseTo(b, 2); // gift-card refund is asynchronous
    },
  );

  it(
    title(
      'PROMO-R2 Split into 2 checks both paid by gift card → cancel refunds both (PROMO-156)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(6 * 60_000);
      const b = await ensureGiftCardBalance(CODE, 100);
      const id = await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
      await openSplit();
      await payCheckWithGiftCard(id, 1, CODE);
      await dismissCheckPaid();
      await payCheckWithGiftCard(id, 2, CODE);
      await finishSplit();
      await app.openHistoryOrder(id);
      await cancelPaidOrder(id);
      expect(await pollBalance(b)).toBeCloseTo(b, 2); // gift-card refund is asynchronous
    },
  );

  it(
    title(
      'PROMO-R3 Split: void a check paid by gift card → balance restored, the check can be paid by card again (PROMO-157)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(8 * 60_000);
      const b = await ensureGiftCardBalance(CODE, 100);
      const id = await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
      await openSplit();
      await payCheckWithGiftCard(id, 1, CODE);
      await dismissCheckPaid();
      await voidCheck(id, 1);
      // The refund after a void is asynchronous (bug #6, sometimes > 60 s) → poll, then reopen the split screen.
      expect(await waitGiftCardBalance(CODE, b, 120_000)).toBeCloseTo(b, 2);
      await app.openPendingOrder(id);
      await openSplit();

      await step(
        'Pay check 1 by gift card again: Current Balance = the starting balance (fully refunded)',
        async () => {
          await giftCardCooldown();
          const info = await startGiftCardCheck(id, 1, CODE);
          expect(info).toContain('Gift Card Accepted');
          expect(money(currentBalanceOf(info))).toBeCloseTo(b, 2);
          await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
          await waitCheckPaid(1);
          markGiftCardUse();
          await dismissCheckPaid();
        },
      );

      await step(
        'Cleanup: check 2 by Other → Complete Done → cancel the order to refund the card',
        async () => {
          await payCheck(id, 2, 'Other', { otherName: 'QC E2E', next: 'none' });
          await finishSplit();
          await app.openHistoryOrder(id);
          await cancelPaidOrder(id);
          expect(await pollBalance(b)).toBeCloseTo(b, 2); // gift-card refund is asynchronous
        },
      );
    },
  );

  it(
    title(
      'PROMO-R4 Cancel a top-up order while the card still holds it: canceled, no shortage message, balance down by $50.00 (PROMO-158, PROMO-160)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(6 * 60_000);
      const b0 = await settledGiftCardBalance(CODE);
      const x = await app.topUpGiftCard(CODE, 50);
      expect(await waitGiftCardBalance(CODE, b0 + 50)).toBeCloseTo(b0 + 50, 2);
      await app.openHistoryOrder(x);
      await app.cancelOrder(0);
      expect(await P.count({ text: INSUFFICIENT })).toBe(0);
      expect(await app.waitHistoryStatus(x, /^Canceled$/, 90_000)).toBe('Canceled');
      expect(await pollBalance(b0)).toBeCloseTo(b0, 2); // gift-card refund is asynchronous
    },
  );

  // bug #6: the checkout balance check can use a STALE balance (top-up not counted yet) →
  // the spend order (B1 − $20) is refused with "Gift Card not Enough Balance".
  it(
    title(
      'PROMO-R5 Card partly spent cannot revert a top-up → "Unable to Cancel Order", top-up kept, balance never negative (PROMO-159)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(8 * 60_000);
      const m = await priceModel();
      const b0 = await settledGiftCardBalance(CODE);
      if (b0 + 30 > 9_999.99) {
        console.warn(`Balance ${String(b0)} too large for a spend order (B1 − $20)`);
        this.skip();
      }
      const x = await app.topUpGiftCard(CODE, 50);
      let y = '';
      let paidY = false;
      try {
        const b1 = await waitGiftCardBalance(CODE, b0 + 50);
        expect(b1).toBeCloseTo(b0 + 50, 2);
        // Debit = Quick Pay·(1+tax) (no Service Fee on Gift Card) → pick a Quick Pay leaving ≈ $20.
        const spend = Math.round(((b1 - 20) / (1 + m.tax)) * 100) / 100;
        y = await createQuickPayOrder([{ amount: spend, name: 'QC GC Spend' }]);
        await app.pay();
        const charged = await app.methodAmount('Gift Card');
        console.warn(
          `[order] top-up ${x}, spend ${y} (Quick Pay ${String(spend)}, card debit ${String(charged)})`,
        );
        // Quick Pay is taxed like a service → debit ≈ B1 − 20 (rounding ≤ a few cents).
        expect(charged).toBeCloseTo(b1 - 20, 1);
        expect(charged).toBeLessThanOrEqual(b1);
        await payCurrentWithGiftCard(CODE);
        await app.waitSuccess();
        paidY = true;
        await app.noReceipt();
        const rest = Math.round((b1 - charged) * 100) / 100;
        expect(await waitGiftCardBalance(CODE, rest)).toBeCloseTo(rest, 2);

        await app.openHistoryOrder(x);
        await startCancelOrder(0);
        await app.passcodeIfAsked(3_000);
        const alert = { role: 'dialog', hasText: 'Unable to Cancel Order', nth: -1 } as const;
        expect(await appears(alert, 20_000)).toBe(true);
        expect(await P.has([alert, { textRe: escapeRe(INSUFFICIENT), nth: 0 }])).toBe(true);
        await P.clickQ([alert, btn('OK')]);
        await app.closeStrayDialogs();
        await app.openHistoryOrder(x);
        expect(field(await app.historyDetail(x), 'Status')).toMatch(/Successful/);
        expect(await balanceOf()).toBeGreaterThanOrEqual(0);
      } finally {
        // Cleanup: cancel spend Y (refunds the card), then the top-up X. Never masks the real failure.
        await app.closeStrayDialogs().catch(() => undefined);
        const note = (e: unknown): void =>
          console.warn(`[cleanup] ${String((e as Error).message ?? e).split('\n')[0] ?? ''}`);
        if (y && paidY) {
          await app
            .openHistoryOrder(y)
            .then(() => cancelPaidOrder(y))
            .catch(note);
          await waitGiftCardBalance(CODE, b0 + 50).catch(note); // the spend must be refunded before the top-up can revert
        }
        await app
          .openHistoryOrder(x)
          .then(() => cancelPaidOrder(x))
          .catch(note);
      }
    },
  );

  it(
    title(
      'PROMO-R6 Cancel a gift-card order: wrong code / no permission / closed passcode → not canceled, balance unchanged (PROMO-161)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(6 * 60_000);
      const noPerm = await roleWithoutPermission('Cancel Order (Void)');
      const b0 = await ensureGiftCardBalance(CODE, 40);
      const { id, total } = await paidByGiftCard(CODE);
      const b = await waitGiftCardBalance(CODE, b0 - total);
      await app.openHistoryOrder(id);
      await startCancelOrder(0);
      expect(await appears(VqcCommon.passcodeDialog, 5_000)).toBe(true);
      const r1 = await typePasscode(unknownCode());
      expect(r1.text).toMatch(/Invalid staff code|Failed to verify staff code/);
      if (noPerm) {
        const r2 = await typePasscode(noPerm.code);
        expect(r2.text).toContain("You don't have permission for this action");
      } else {
        console.warn(
          'PROMO-161: no role code with "Cancel Order (Void)" OFF (VOLT_MANAGER_CODE / VOLT_PARTNER_CODE / VOLT_STAFFROLE_CODE) — permission leg skipped',
        );
      }
      await P.escape();
      await app.closeStrayDialogs();
      await app.openHistoryOrder(id);
      expect(field(await app.historyDetail(id), 'Status')).toBe('Successful - Unsettled');
      await settle(10_000);
      expect(await balanceOf()).toBeCloseTo(b, 2);
      // Cleanup: cancel for real to refund the card.
      await app.openHistoryOrder(id);
      await cancelPaidOrder(id);
    },
  );

  it(
    title(
      'PROMO-R7 While the 30-min passcode skip is on → cancelling a gift-card order asks no passcode, full refund (PROMO-162)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      if (process.env.VOLT_ALLOW_PASSCODE_SKIP !== '1') {
        console.warn('Needs VOLT_ALLOW_PASSCODE_SKIP=1 (ticks the 30-minute passcode skip)');
        this.skip();
      }
      this.timeout(6 * 60_000);
      const b = await ensureGiftCardBalance(CODE, 40);
      await app.clearPasscodeSkip();
      try {
        const id = await app.createOrder();
        await app.pay();
        await app.selectMethod('Gift Card');
        await giftCardCooldown();
        await P.clickQ(VqpsCheckout.complete);
        const dlg = VqcCommon.passcodeDialog;
        expect(await appears(dlg, 5_000)).toBe(true);
        await P.clickQ([dlg, { text: 'Do not require passcode for the next 30 minutes', nth: 0 }]);
        await app.enterPasscode(vqEnv.staffCode);
        await app.reachGiftCardInput(30_000);
        await app.confirmGiftCardCode(CODE);
        await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
        await app.driveToSuccess('none');
        markGiftCardUse();
        await app.noReceipt();

        await app.openHistoryOrder(id);
        await P.clickQ(VqpsHistory.cancelOrder);
        await P.clickQ([VqpsHistory.cancelDialog, { role: 'combobox', nth: 0 }]);
        await P.clickQ({ role: 'option', nth: 0 });
        await P.clickQ([VqpsHistory.cancelDialog, btn('Confirm Cancel')]);
        const asked = await appears(VqcCommon.passcodeDialog, 3_000);
        // Inside the 30-minute skip window no passcode may be asked.
        expect(asked).toBe(false);
        expect(await appears(CANCELED_OK, 20_000)).toBe(true);
        expect(await pollBalance(b)).toBeCloseTo(b, 2); // gift-card refund is asynchronous
      } finally {
        await app.clearPasscodeSkip();
      }
    },
  );
});
