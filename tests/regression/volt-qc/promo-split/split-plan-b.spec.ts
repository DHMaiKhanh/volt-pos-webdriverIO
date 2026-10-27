/**
 * volt-qc port — 05 SPLIT plan, part B (SPLIT-K1 … SPLIT-Q1).
 *
 * Source: volt-qc `e2e/tests/05-split/split-plan.spec.ts` (from `SPLIT-K1` to the end).
 * TC catalogue: docs/qc/volt-qc/windows-regression/05-split.
 *
 * Since 2026-10-09 the merchant runs a Card Service Fee + Tax: a check is split from the
 * Card-price Total on Home, and paying it by Cash / Other / Gift Card costs ≈ check / (1 + fee)
 * (`nonCardShare`, app reconciles ≤ 2¢ → the price is read on the "Pay $x" button). A test
 * that paid one check must finish the split (`settleSplit`): the Split screen blocks leaving
 * while a check is paid and an order with transactions cannot be deleted.
 *
 * Money in DOLLARS like volt-qc. Writes orders / payments / gift card redemptions.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqcCommon } from '../../../../src/constants/testids.voltqc-pos.js';
import {
  VqpsCheckout,
  VqpsCustomer,
  VqpsSplit,
  VqpsSuccess,
} from '../../../../src/constants/testids.voltqc-promo-split.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { priceModel } from '../../../../src/pages/voltqc/promo-split/price.js';
import { giftCardCooldown, markGiftCardUse } from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import * as S from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  clickItemRowName,
  closePasscode,
  dailySaleRow,
  emulateViewport,
  ensureGiftBalance,
  methodTileContrast,
  openSplitTipNotProportion,
  payOtherWithTip,
  pollGiftBalanceCents,
  reopenToCheckout,
  roleWithout,
  selectedTipTab,
  textAppears,
  textHas,
  themeRadio,
  tipClose,
  tipConfirm,
  tipInput,
  tipInputsDisabled,
  tipTab,
  twoStaffOrder,
  typeCode,
  visibleStaffNames,
} from '../../../../src/pages/voltqc/promo-split/splitPlanBExtra.js';
import {
  app,
  cust,
  money,
  visible,
  vqEnv,
  waitUntil,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const reMoney = (x: number): string => `\\$${x.toFixed(2).replace('.', '\\.')}`;

/** Split orders a test opened and may leave half-paid → finished in afterEach. */
const splits = new Set<string>();
const track = (id: string): string => {
  splits.add(id);
  return id;
};

describe('volt-qc 05 SPLIT plan B — gift card, lock, after-payment, tips, void, Split Tip, layout', () => {
  before(() => {
    assertWritesAllowed('volt-qc 05 SPLIT plan B (orders, split payments, gift card redemptions)');
  });

  afterEach(async () => {
    await app.closeStrayDialogs().catch(() => undefined);
    for (const id of splits) await S.settleSplit(id);
    splits.clear();
    if (/payment-success/.test(await app.path().catch(() => '')))
      await app.noReceipt().catch(() => undefined);
    await app.cleanupOrders();
  });

  /* ======================================================================= *
   * SPLIT-K Gift card in Split
   * ======================================================================= */

  describe('SPLIT-K Gift card in Split', () => {
    beforeEach(function () {
      if (!vqEnv.testGiftCard) {
        console.warn('SPLIT-K: needs VOLT_TEST_GIFT_CARD');
        this.skip();
      }
    });

    it(
      title(
        'SPLIT-K1 Check 1 paid by Gift Card (half the order): "Paid with Gift Card", Check 2 unpaid; balance drops by the check Total Paid (SPLIT-053)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        let charged = Number.NaN;
        const before = await ensureGiftBalance(20);
        const id = track(await app.createOrder());
        await S.openSplit();
        try {
          await giftCardCooldown();
          await S.payCheck(id, 1, 'Gift Card');
          markGiftCardUse();
          expect(await S.checkRowText(id, 1)).toContain('Paid with Gift Card');
          // Card debit = Total Paid of the check (Gift Card price = check / (1 + fee)).
          charged = await S.checkAmount(id, 1);
          expect(await S.isCheckPaid(id, 2)).toBe(false);
          await S.payCheck(id, 2, 'Other');
          await S.completeDone();
          await app.noReceipt();
        } finally {
          await S.settleSplit(id);
        }
        expect(charged).toBeGreaterThan(0);
        // Balance is recorded late (bug #6) → re-read for up to 90 s.
        const want = Math.round((before - charged) * 100);
        const seen = await pollGiftBalanceCents(want, 90_000);
        expect(seen[seen.length - 1]).toBe(want);
      },
    );

    it(
      title(
        'SPLIT-K2 Void a check paid by Gift Card → balance fully restored and reusable at once (SPLIT-059)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        let charged = Number.NaN;
        const before = await ensureGiftBalance(20);
        const id = track(await app.createOrder());
        await S.openSplit();
        try {
          await giftCardCooldown();
          await S.payCheck(id, 1, 'Gift Card');
          await S.voidCheck(id, 1);
          expect(await S.isCheckPaid(id, 1)).toBe(false);
          await settle(11_000); // two transactions on one card within 10 s are rejected
          const text = await S.startGiftCardCheck(id, 1);
          expect(text).toContain('Gift Card Accepted');
          // Balance after the void must be back to the starting one.
          expect(money(/Current Balance \| (\$[\d,.]+)/.exec(text)?.[1])).toBeCloseTo(before, 2);
          await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
          await S.drivePaid(1, 'Gift Card');
          markGiftCardUse();
          await S.closePaidDialog(1);
          charged = await S.checkAmount(id, 1); // Total Paid of the check (Gift Card price)
          await S.payCheck(id, 2, 'Other');
          await S.completeDone();
          await app.noReceipt();
        } finally {
          await S.settleSplit(id);
        }
        // Balance after void + re-pay is recorded late (bug #6) → re-read for up to 90 s.
        const want = Math.round((before - charged) * 100);
        const seen = await pollGiftBalanceCents(want, 90_000);
        expect(seen[seen.length - 1]).toBe(want);
      },
    );

    it(
      title(
        'SPLIT-K3 Check 1 + Tip $5 paid by Gift Card: card debited check + tip, success line "<Gift Card price> + $5.00 Tip" (SPLIT-058)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const before = await ensureGiftBalance(60);
        const { id, T, m } = await S.cardTotalOrder(10_000);
        track(id);
        // Check 1 = half the Card Total (≈ $50); Gift Card price ≈ check / (1 + fee), read on "Pay $x".
        await S.openSplit();
        let success = '';
        let gcPart = Number.NaN;
        try {
          gcPart = await S.methodPrice(id, 1, 'Gift Card');
          expect(gcPart).toBeCloseTo(S.nonCardShare(m, S.evenSplit(T, 2)[0] ?? Number.NaN), 1);
          const canTip = await visible(VqpsSplit.tip);
          if (!canTip) {
            console.warn('SPLIT-K3: no Tip button for a Gift Card check (tip setting excludes Gift Card)');
            this.skip();
          }
          await giftCardCooldown();
          await S.payCheck(id, 1, 'Gift Card', { cashierTipCents: '500' });
          markGiftCardUse();
          await S.payCheck(id, 2, 'Other');
          success = await S.completeDone();
          await app.noReceipt();
        } finally {
          await S.settleSplit(id);
        }
        expect(success).toMatch(
          new RegExp(`Check 1 \\| Paid by Gift Card[^|]*\\| ${reMoney(gcPart)} \\+ \\$5\\.00 Tip`),
        );
        // Balance recorded late (bug #6) → re-read for up to 90 s.
        const want = Math.round((before - gcPart - 5) * 100);
        const seen = await pollGiftBalanceCents(want, 90_000);
        expect(seen[seen.length - 1]).toBe(want);
      },
    );

    it(
      title(
        'SPLIT-K4 Same card pays Check 1 and Check 2 (> 10 s apart), then both voided: balance drops then fully recovers (SPLIT-060)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const before = await ensureGiftBalance(35);
        const id = track(await app.createOrder());
        await S.openSplit();
        try {
          await giftCardCooldown();
          const r1 = await S.payCheck(id, 1, 'Gift Card', { next: 'none' });
          expect(r1).toContain('1 check remaining');
          await S.closePaidDialog(1);
          await settle(11_000);
          await S.payCheck(id, 2, 'Gift Card');
          // Keep > 10 s between every transaction on the card — the REVERT of a void included.
          await settle(11_000);
          await S.voidCheck(id, 1);
          await settle(11_000);
          await S.voidCheck(id, 2);
          markGiftCardUse();
          await waitUntil(async () => (await P.count(inMain({ textRe: 'Canceling' }))) === 0, 10_000);
          expect(await P.count(inMain({ textRe: 'Canceling' }))).toBe(0);
          expect(await S.unpaidChecks(id)).toEqual([1, 2]);
        } finally {
          await S.settleSplit(id);
        }
        // No paid check left → the Split screen can be left; the pending order is cleaned up.
        console.warn(`SPLIT-060: order ${id}, balance before $${String(before)}`);
        const want = Math.round(before * 100);
        const seen = await pollGiftBalanceCents(want, 60_000);
        console.warn(`SPLIT-060: balance reads after voiding both (cents): ${seen.join(', ')}`);
        expect(seen[seen.length - 1]).toBe(want);
      },
    );

    it(
      title(
        'SPLIT-K5 Same card pays Check 2 right after Check 1 (< 10 s) → clear error, Check 2 stays unpaid (SPLIT-061)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        console.warn(
          'SPLIT-K5 known issue: bug #13 — DEV accepts the 2nd transaction on the card ~2.5 s after the 1st',
        );
        await ensureGiftBalance(35);
        const id = track(await app.createOrder());
        await S.openSplit();
        try {
          await giftCardCooldown();
          await S.payCheck(id, 1, 'Gift Card');
          markGiftCardUse();
          const t1 = Date.now();
          const r = await S.startGiftCardCheck(id, 2);
          let err = r;
          if (/Gift Card Accepted/i.test(r)) {
            await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
            console.warn(`SPLIT-061: Pay check 2 ${((Date.now() - t1) / 1000).toFixed(1)} s after check 1`);
            const toast = { css: '[data-sonner-toast]', nth: 0 } as const;
            const errDlg = {
              role: 'dialog',
              hasTextRe: 'error|fail|try again|10 seconds|declin|reject',
              flags: 'i',
              nth: -1,
            } as const;
            const shown = await waitUntil(
              async () => (await visible(toast)) || (await visible(errDlg)),
              15_000,
            );
            const dlgs = await P.texts({ role: 'dialog' }).catch(() => [] as string[]);
            console.warn(
              `SPLIT-061: order ${id}; after Pay check 2 — error toast/dialog: ${String(shown)}; check 2 paid: ${String(await S.isCheckPaid(id, 2))}; open dialogs: ${dlgs.join(' || ')}`,
            );
            // Bug #13 (docs/bugs-found-dev.md): DEV takes the second transaction without an upstream error.
            expect(shown).toBe(true); // Check 2 on the same card < 10 s must report a clear error (not silently)
            err = (await P.textOf(toast).catch(() => '')) || (await P.textOf(errDlg).catch(() => '')) || err;
          }
          console.warn(`SPLIT-061: message when paying the same card < 10 s: "${err}"`);
          await app.closeStrayDialogs();
          expect(await S.isCheckPaid(id, 2)).toBe(false); // Check 2 must not be paid
        } finally {
          await S.settleSplit(id);
        }
      },
    );

    it(
      title(
        'SPLIT-K6 Equally / By Items: card short of the check → popup with only "Select Another Method", no debit, no new check (SPLIT-056)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const { balance: b } = await app.giftCardBalance(vqEnv.testGiftCard);
        await app.closeStrayDialogs();
        const line = Math.round((Math.max(b, 0) + 5) * 100); // each line > balance
        if (line > 1_000_000) {
          console.warn(`SPLIT-K6: test card balance ($${String(b)}) too large to build a check above it`);
          this.skip();
        }
        const id = track(
          await S.quickPayOrder([
            { cents: line, name: 'QP GC a' },
            { cents: line, name: 'QP GC b' },
          ]),
        );
        await S.openSplit();
        for (const mode of ['Equally', 'By Items'] as const) {
          await step(mode, async () => {
            await P.clickQ(S.modeButton(mode));
            await settle(600);
            const checksBefore = await S.checkNumbers(id);
            const text = await S.startGiftCardCheck(id, 1);
            expect(text).toContain('Gift Card not Enough Balance');
            expect(text).toContain(
              'Gift Card balance is insufficient for this check. Please select another payment method or modify the split configuration.',
            );
            expect(await visible([VqpsCheckout.gcResultDialog, btn('Select Another Method')])).toBe(true);
            expect(await P.count([VqpsCheckout.gcResultDialog, btn('Create New Check')])).toBe(0);
            await P.clickQ([VqpsCheckout.gcResultDialog, btn('Select Another Method')]);
            await P.waitGoneQ(VqpsCheckout.gcResultDialog, 5_000, 'gift card verdict');
            expect(await S.checkNumbers(id)).toEqual(checksBefore);
            expect(await S.isCheckPaid(id, 1)).toBe(false);
          });
        }
        await P.clickQ(S.modeButton('Equally'));
        await app.openPendingOrder(id);
        expect((await app.giftCardBalance(vqEnv.testGiftCard)).balance).toBeCloseTo(b, 2);
      },
    );

    // DEV: SPLIT-054/055/057 (By Amount short balance → "Create New Check"/"Cancel", drain the card,
    // new check for the rest) do NOT apply: develop disables partial redemption
    // (`BLOCK_PARTIAL_GIFT_CARD_REDEMPTION = true`, VP-3788) → By Amount behaves like Equally/By Items.
    // The test checks DEV behaviour and covers no TC id.
    it(
      title(
        'SPLIT-K7 By Amount, card short (DEV blocks partial redemption) → only "Select Another Method", no debit, no new check',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const m = await priceModel(); // measured before opening the order
        const b = await ensureGiftBalance(10);
        if ((b + 20) * 2 > 10_000) {
          console.warn(
            `SPLIT-K7: test card balance ($${String(b)}) too large — the order needs 2 × (balance + $20) ≤ $10,000`,
          );
          this.skip();
        }
        const cents = Math.round((b + 20) * 100);
        const id = track(await S.quickPayOrder([{ cents: cents * 2, name: 'QP GC by amount' }]));
        await S.openSplit();
        await P.clickQ(S.modeButton('By Amount'));
        // Check 1 is typed at Card price; Gift Card = check / (1 + fee) → type (balance + $20)·(1 + fee).
        await S.setCheckAmount(id, 1, String(Math.ceil(cents * (1 + m.fee))));
        const checksBefore = await S.checkNumbers(id);
        const text = await S.startGiftCardCheck(id, 1);
        expect(text).toContain('Gift Card not Enough Balance');
        expect(text).toContain(
          'Gift Card balance is insufficient for this check. Please select another payment method or modify the split configuration.',
        );
        expect(await visible([VqpsCheckout.gcResultDialog, btn('Select Another Method')])).toBe(true);
        expect(await P.count([VqpsCheckout.gcResultDialog, btn('Create New Check')])).toBe(0);
        await P.clickQ([VqpsCheckout.gcResultDialog, btn('Select Another Method')]);
        await P.waitGoneQ(VqpsCheckout.gcResultDialog, 5_000, 'gift card verdict');
        expect(await S.checkNumbers(id)).toEqual(checksBefore);
        expect(await S.isCheckPaid(id, 1)).toBe(false);
        await app.openPendingOrder(id);
        expect((await app.giftCardBalance(vqEnv.testGiftCard)).balance).toBeCloseTo(b, 2);
      },
    );
  });

  /* ======================================================================= *
   * SPLIT-L Structure lock after a payment
   * ======================================================================= */

  describe('SPLIT-L Structure lock after a payment', () => {
    it(
      title(
        'SPLIT-L1 One check paid: Back to order hidden, leaving blocked "Please complete all checks before leaving"; voiding all restores Back and mode switching (SPLIT-063, SPLIT-065)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        // Two lines so By Items is not locked (one item → By Items disabled).
        const id = track(await S.quickPayOrder([5000, 5000]));
        await S.openSplit();
        const back = VqpsSplit.backToOrder;
        try {
          expect(await visible(back)).toBe(true);
          await S.payCheck(id, 1, 'Other');
          // DEV: with ≥ 1 paid check the Back to order button is HIDDEN (isLocked) instead of a toast.
          // No sidebar on Split → leave through the router (like a menu click) → useBlocker + toast.
          expect(await P.count(back)).toBe(0); // one check paid: Back to order must be hidden
          // Do not return the navigate promise: a blocked navigation never resolves.
          await P.exec<null>("void window.__TSR_ROUTER__.navigate({ to: '/order-history' }); return null;");
          expect(await textAppears('Please complete all checks before leaving', 8_000)).toBe(true);
          await settle(1_000);
          expect(await app.url()).toMatch(/\/split-order/);

          await S.voidCheck(id, 1);
          await waitUntil(() => visible(back), 8_000);
          expect(await visible(back)).toBe(true); // all paid checks voided → Back to order shows again
          for (const m of ['Equally', 'By Amount', 'By Items'] as const)
            expect(await P.isDisabled(S.modeButton(m))).toBe(false);
          await P.clickQ(S.modeButton('By Amount'));
          expect(await S.isModeActive('By Amount')).toBe(true);
        } finally {
          await S.settleSplit(id);
        }
      },
    );
  });

  /* ======================================================================= *
   * SPLIT-M After payment
   * ======================================================================= */

  describe('SPLIT-M After payment', () => {
    it(
      title(
        'SPLIT-M1 Re-open a split order: re-open checkout Enter Amount $0.00 on 4 methods; Edit Order locks amounts, note editable; Re-Open Done keeps the checks (SPLIT-071, SPLIT-090)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        // Bug #22: re-opening a split order with tips is forced into "Void Order Transactions" → each run leaves a stuck order.
        if (process.env.VOLT_RUN_STUCK_BUG_TESTS !== '1') {
          console.warn(
            'SPLIT-M1: bug #22 (re-open split order forced to Void) leaves a stuck order each run — set VOLT_RUN_STUCK_BUG_TESTS=1 to run',
          );
          this.skip();
        }
        const id = track(await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] }));
        await S.openSplit();
        await S.payCheck(id, 1, 'Cash', { cashierTipCents: '200' });
        await S.payCheck(id, 2, 'Other', { cashierTipCents: '100' });
        await S.completeDone();
        await app.noReceipt();
        splits.delete(id);

        await reopenToCheckout(id);
        let reopened = true;
        try {
          // Bug #22: SF + Tax on → re-opening a Cash + Other split with tips raises "Void Order Transactions" at once.
          const forcedVoid = { role: 'dialog', hasText: 'Void Order Transactions', nth: -1 } as const;
          await settle(1_500);
          expect(await P.count(forcedVoid)).toBe(0); // re-open without changes must not force a void (bug #22)
          expect(await visible(VqpsCheckout.reopenDone)).toBe(true);
          for (const m of ['Card', 'Cash', 'Gift Card', 'Other'] as const) {
            await app.selectMethod(m);
            // VERIFY: "Enter Amount" shows for all 4 methods on the re-open checkout.
            expect(await app.enteredAmount()).toBeCloseTo(0, 2);
          }

          await P.clickQ(VqpsCheckout.editOrder);
          await app.passcodeIfAsked(2_000);
          await app.waitPath(/\/home\?editOrderId=/, 15_000);
          await step('Amount edits are blocked', async () => {
            expect(await visible(inMain({ css: 'li.pointer-events-none', nth: 0 }))).toBe(true);
            await clickItemRowName(vqEnv.testService);
            const dlg = { role: 'dialog', hasText: vqEnv.testService, nth: -1 } as const;
            if (await waitUntil(() => visible(dlg), 3_000)) {
              const amt = [dlg, { css: 'input[placeholder="0.00"]', nth: 0 }] as const;
              const ai = await P.info(amt);
              if (ai) expect(ai.disabled || 'readonly' in ai.attrs).toBe(true); // item price must not be editable on re-open
              const sw = [dlg, { role: 'switch', nth: 0 }] as const;
              if (await P.count(sw)) expect(await P.isDisabled(sw)).toBe(true);
              await app.closeStrayDialogs();
            }
          });
          await step('Note is editable', async () => {
            await app.addNote('Reopen note e2e');
          });
          await app.finishReopen();
          reopened = false;
        } finally {
          if (reopened) {
            // Bug #22: never Confirm Void (would void real money) — "Back to Order" only; the order stays stuck in re-open.
            const backBtn = btn('Back to Order', 0);
            if (await visible(backBtn)) {
              console.warn(`SPLIT-M1 cleanup: order ${id} stuck in Re-open by bug #22 (Void not confirmed)`);
              await P.clickQ(backBtn).catch(() => undefined);
            } else await app.finishReopen().catch(() => undefined);
          }
        }
        await app.openHistoryOrder(id);
        const d = await app.historyDetail(id);
        expect(d).toContain(`#${id}-1`);
        expect(d).toContain(`#${id}-2`);
        expect(d).toContain('Reopen note e2e');
      },
    );

    it(
      title(
        'SPLIT-M2 Split order (2 checks Other) vs the same order paid straight by Other: Daily Sale Report revenue/tip/tax equal (SPLIT-093)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.SLOW,
      ),
      async function () {
        this.timeout(8 * 60_000);
        const { id: a } = await app.createPaidOrder({ method: 'Other' });
        const b = track(await app.createOrder());
        await S.openSplit();
        await S.payCheck(b, 1, 'Other');
        await S.payCheck(b, 2, 'Other');
        await S.completeDone();
        await app.noReceipt();
        splits.delete(b);

        const strip = (row: string | null, id: string): string[] =>
          (row ?? '')
            .replace(id, '')
            .split('|')
            .map((s) => s.trim())
            .filter((s) => /^-?\$/.test(s));
        let ra: string | null = null;
        let rb: string | null = null;
        const deadline = Date.now() + 180_000;
        while (Date.now() < deadline && !(ra && rb)) {
          ra = ra ?? (await dailySaleRow(a));
          rb = rb ?? (await dailySaleRow(b));
          if (!(ra && rb)) await settle(1_000);
        }
        console.warn(`Daily Sale: A ${a} → ${String(ra)} | B ${b} → ${String(rb)}`);
        // DEV Daily Sale Report sometimes stops taking new orders for hours: if even the straight order A is
        // missing nothing can be compared → skip; A present but B missing is a failure.
        if (!ra) {
          console.warn(
            `SPLIT-M2: Daily Sale Report still lacks the plain order ${a} after 3 min (DEV report not updating)`,
          );
          this.skip();
        }
        expect(rb).toBeTruthy(); // split order must reach the Daily Sale Report like the plain order
        expect(strip(rb, b)).toEqual(strip(ra, a));
      },
    );
  });

  /* ======================================================================= *
   * SPLIT-N Tip per check
   * ======================================================================= */

  describe('SPLIT-N Tip per check', () => {
    it(
      title(
        'SPLIT-N1 Check 1 Cash + Tip $2: Pay = Cash price + $2, tender $20 → right Change, "Paid with Cash - Got: $20.00 (Change … - Tip: $2.00)"; Check 2 no tip (SPLIT-072, SPLIT-073)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const m = await priceModel(); // measured before opening the order
        const id = track(await app.createOrder());
        const T = (await app.orderTotals()).total;
        const half = S.evenSplit(T, 2);
        const h0 = half[0] ?? Number.NaN;
        const h1 = half[1] ?? Number.NaN;
        await S.openSplit();
        try {
          const cash1 = await S.methodPrice(id, 1, 'Cash');
          // Cash price of the check ≈ check (Card price) / (1 + fee), reconciled ≤ 2¢.
          expect(cash1).toBeCloseTo(S.nonCardShare(m, h0), 1);
          if (!(cash1 + 2 <= 20)) {
            console.warn(
              `SPLIT-N1: Cash price of check 1 ($${String(cash1)}) + $2 tip > $20 — cannot tender $20`,
            );
            this.skip();
          }
          await S.cashierTip('200');
          expect(await P.textOf(S.payButton)).toMatch(new RegExp(`Pay\\s*${reMoney(cash1 + 2)}`));
          const change = (2000 - Math.round((cash1 + 2) * 100)) / 100;

          await step('SPLIT-073: select Check 2 → other half, no tip', async () => {
            await S.selectCheck(id, 2);
            expect(await S.checkAmount(id, 2)).toBeCloseTo(h1, 2);
            await P.clickQ(S.methodButton('Cash'));
            await settle(300);
            // No tip: Pay = Cash price of check 2 ≈ check / (1 + fee).
            expect(money(await P.textOf(S.payButton))).toBeCloseTo(S.nonCardShare(m, h1), 1);
            await S.selectCheck(id, 1);
          });

          await P.clickQ(S.payButton);
          await app.passcodeIfAsked(3_000);
          const dlg = S.cashDialog(1);
          await P.waitFor(dlg, 10_000, 'Cash dialog check 1');
          await S.dialogKeys(dlg, ['C', '2', '0', '0', '0']);
          expect(await visible([dlg, { textRe: reMoney(change), nth: 0 }])).toBe(true);
          await P.clickQ([dlg, btn('Complete Check 1')]);
          await P.waitFor(S.paidDialog(1), 30_000, 'Check 1 Paid Successfully');
          expect(await cust.has(VqpsCustomer.addTip)).toBe(false); // cashier tip given → customer display does not ask
          await S.closePaidDialog(1);
          expect(await S.checkRowText(id, 1)).toContain(
            `Paid with Cash - Got: $20.00 (Change: $${change.toFixed(2)} - Tip: $2.00)`,
          );
        } finally {
          await S.settleSplit(id);
        }
      },
    );

    it(
      title(
        'SPLIT-N2 Check 1 Cash without cashier tip → customer Custom Tip $1: main "Customer is adding a tip.", Check 1 shows Tip: $1.00 (SPLIT-074)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = track(await app.createOrder());
        await S.openSplit();
        try {
          await S.selectCheck(id, 1);
          await P.clickQ(S.methodButton('Cash'));
          await settle(300);
          await P.clickQ(S.payButton);
          await app.passcodeIfAsked(3_000);
          const dlg = S.cashDialog(1);
          await P.clickQ([dlg, btn('Complete Check 1')], 10_000);
          await app.passcodeIfAsked(2_000);
          expect(await cust.waitFor(VqpsCustomer.addTip, 15_000)).toBe(true);
          expect(await visible(textHas('Customer is adding a tip.'))).toBe(true);
          await cust.customTip('100');
          await P.waitFor(S.paidDialog(1), 30_000, 'Check 1 Paid Successfully');
          await S.closePaidDialog(1);
          expect(await S.checkRowText(id, 1)).toContain('Tip: $1.00');
        } finally {
          await S.settleSplit(id);
        }
      },
    );

    it(
      title(
        'SPLIT-N3 Check 1 Cash + tip $2, Check 2 Other + tip $1 → Complete Done: big number = Σ (method price + tip), each check "+ $x Tip", Total Tip: $3.00 (SPLIT-076)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        // Cash/Other price of each check is read on "Pay $x" before paying.
        const id = track(await app.createOrder());
        await S.openSplit();
        const cash1 = await S.methodPrice(id, 1, 'Cash');
        await S.payCheck(id, 1, 'Cash', { cashierTipCents: '200' });
        const other2 = await S.methodPrice(id, 2, 'Other');
        await S.payCheck(id, 2, 'Other', { cashierTipCents: '100' });
        const s = await S.completeDone();
        splits.delete(id);
        expect(s).toContain(`$${(Math.round((cash1 + other2) * 100) / 100 + 3).toFixed(2)}`);
        expect(s).toMatch(new RegExp(`Check 1 \\| Paid by Cash[^|]*\\| ${reMoney(cash1)} \\+ \\$2\\.00 Tip`));
        expect(s).toMatch(
          new RegExp(`Check 2 \\| Paid by Other[^|]*\\| ${reMoney(other2)} \\+ \\$1\\.00 Tip`),
        );
        expect(s).toContain('Total Tip: $3.00');
        await app.noReceipt();
      },
    );
  });

  /* ======================================================================= *
   * SPLIT-O Void check
   * ======================================================================= */

  describe('SPLIT-O Void check', () => {
    it(
      title(
        'SPLIT-O1 Void Check 1 (Cash): "Are you sure you want to void Check 1 (Total Paid by Cash: $x)?", 7 reasons, Confirm Void disabled until chosen; voided check reopens, Total Paid $0.00 (SPLIT-078, SPLIT-079, SPLIT-080)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        if (!vqEnv.staffCode) {
          console.warn('SPLIT-O1: needs VOLT_STAFF_CODE / STAFF_PASSCODE');
          this.skip();
        }
        await app.clearPasscodeSkip();
        const id = track(await app.createOrder());
        await S.openSplit();
        try {
          const cash1 = await S.methodPrice(id, 1, 'Cash');
          await S.payCheck(id, 1, 'Cash');
          await P.clickQ(VqpsSplit.voidBtn(id, 1));
          const dlg = S.voidDialog;
          await P.waitFor(dlg, 8_000, 'Void Payment');
          const t = ((await P.rawText(dlg)) ?? '').replace(/\s+/g, ' ');
          expect(t).toContain('Are you sure you want to void');
          expect(t).toContain(`Check 1 (Total Paid by Cash: $${cash1.toFixed(2)})?`);
          expect(t).toContain('This action cannot be undone.');
          expect(await visible([dlg, textHas('Please select a reason for void:')])).toBe(true);
          expect(await P.textOf([dlg, { role: 'combobox', nth: 0 }])).toContain('Select reason void');
          expect(await P.isDisabled([dlg, btn('Confirm Void')])).toBe(true);

          await P.clickQ([dlg, { role: 'combobox', nth: 0 }]);
          await P.waitFor({ role: 'option', nth: 0 }, 5_000, 'void reasons');
          const opts = (await P.texts({ role: 'option' })).map((o) => o.trim());
          expect(opts).toEqual([
            'Customer Request',
            'Service issue',
            'Incorrect order',
            'Duplicate payment',
            'Promotion / Discount error',
            'Staff mistake',
            'Other',
          ]);
          await P.clickQ({ role: 'option', name: 'Customer Request' });
          expect(await P.isDisabled([dlg, btn('Confirm Void')])).toBe(false);
          await P.clickQ([dlg, btn('Confirm Void')]);
          const pass = VqcCommon.passcodeDialog;
          await P.waitFor(pass, 8_000, 'passcode dialog');
          expect((await P.textOf([pass, { role: 'heading', nth: 0 }])).trim()).toBe(
            'Enter staff code to continue',
          );
          await app.enterPasscode(vqEnv.staffCode);
          await P.waitFor(VqpsSplit.voidOk, 30_000, 'Void Payment Successful!');
          await P.clickQ([VqpsSplit.voidOk, btn('Done')]);
          await P.waitGoneQ(VqpsSplit.voidOk, 8_000);
          await settle(800);
          expect(await S.isCheckPaid(id, 1)).toBe(false);
          expect(await visible(VqpsSplit.select(id, 1))).toBe(true);
          expect((await S.paidRemaining()).totalPaid).toBeCloseTo(0, 2);
        } finally {
          await S.settleSplit(id);
        }
      },
    );

    it(
      title(
        'SPLIT-O2 Reason Other required (empty/blank → disabled), max 80 chars; Keep and closing the passcode keep the paid check; reason trimmed and saved (SPLIT-081, SPLIT-082, SPLIT-083, SPLIT-084, SPLIT-085)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.SLOW,
      ),
      async function () {
        this.timeout(8 * 60_000);
        await app.clearPasscodeSkip();
        const id = track(await app.createOrder());
        await S.openSplit();
        const dlg = S.voidDialog;
        const confirm = [dlg, btn('Confirm Void')] as const;
        try {
          await S.payCheck(id, 1, 'Other');
          await P.clickQ(VqpsSplit.voidBtn(id, 1));
          await P.waitFor(dlg, 8_000, 'Void Payment');
          await S.pickVoidReason('Other');
          const other = [
            dlg,
            { css: '[data-testid="split-void-reason-other-input"], textarea, input[type="text"]', nth: -1 },
          ] as const;
          await P.waitFor(other, 5_000, 'Other reason input');
          expect(await P.isDisabled(confirm)).toBe(true);
          await P.fillQ(other, '   ');
          expect(await P.isDisabled(confirm)).toBe(true); // a blank reason is not valid
          await P.fillQ(other, 'r'.repeat(81));
          expect(await P.inputValue(other)).toBe('r'.repeat(80));

          await step('SPLIT-084: Keep → closes, Check 1 still paid', async () => {
            await P.clickQ([dlg, btn('Keep')]);
            await P.waitGoneQ(dlg, 5_000, 'Void Payment');
            expect(await S.isCheckPaid(id, 1)).toBe(true);
          });

          await step('SPLIT-085: up to the passcode step, then close → check still paid', async () => {
            await P.clickQ(VqpsSplit.voidBtn(id, 1));
            await P.waitFor(dlg, 8_000, 'Void Payment');
            await S.pickVoidReason('Customer Request');
            await P.clickQ(confirm);
            await P.waitFor(VqcCommon.passcodeDialog, 8_000, 'passcode dialog');
            await closePasscode();
            if (await visible(dlg)) await P.clickQ([dlg, btn('Keep')]);
            expect(await S.isCheckPaid(id, 1)).toBe(true);
          });

          await step('SPLIT-082: Other "  khach doi y  " → void succeeds', async () => {
            await S.voidCheck(id, 1, 'Other', '  khach doi y  ');
            expect(await S.isCheckPaid(id, 1)).toBe(false);
          });

          await S.payCheck(id, 1, 'Other');
          await S.payCheck(id, 2, 'Other');
          await S.completeDone();
          await app.noReceipt();
        } finally {
          await S.settleSplit(id);
        }
        // The void sits in "Canceling" a while before "Voided"; "Cancel information | … | Reason | <reason>"
        // appears only after that (seen ~1–10 min) → reopen Order History until it shows.
        let d = '';
        const deadline = Date.now() + 4 * 60_000;
        for (;;) {
          await app.openHistoryOrder(id);
          d = await app.historyDetail(id);
          if (/Cancel information/.test(d) || Date.now() > deadline) break;
          await settle(15_000);
        }
        if (!/Cancel information/.test(d)) {
          console.warn(
            `SPLIT-082: Order History lacks "Cancel information" after 4 min: ${d.slice(d.indexOf('Payment Details'))}`,
          );
        }
        expect(d).toMatch(/Cancel information/);
        expect(d).toMatch(/Reason \| khach doi y( \||$)/); // Order History keeps the trimmed reason
        expect(d).not.toContain('  khach doi y  ');
      },
    );

    it(
      title(
        'SPLIT-O3 Void with a role lacking Cancel Order (Void) → "You don\'t have permission for this action" (SPLIT-086)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const role = await roleWithout('Cancel Order (Void)');
        if (!role) {
          console.warn(
            'SPLIT-O3: no role with a staff code in .env (VOLT_MANAGER_CODE / VOLT_PARTNER_CODE / VOLT_STAFFROLE_CODE) lacks Cancel Order (Void)',
          );
          this.skip();
        }
        await app.clearPasscodeSkip();
        const id = track(await app.createOrder());
        await S.openSplit();
        try {
          await S.payCheck(id, 1, 'Other');
          await P.clickQ(VqpsSplit.voidBtn(id, 1));
          await P.waitFor(S.voidDialog, 8_000, 'Void Payment');
          await S.pickVoidReason('Customer Request');
          await P.clickQ([S.voidDialog, btn('Confirm Void')]);
          const r = await typeCode(role.code);
          expect(r.text).toContain("You don't have permission for this action");
          await closePasscode();
          if (await visible(S.voidDialog)) await P.clickQ([S.voidDialog, btn('Keep')]);
          expect(await S.isCheckPaid(id, 1)).toBe(true);
        } finally {
          await S.settleSplit(id);
        }
      },
    );

    it(
      title(
        'SPLIT-O4 3 checks: pay Check 1, void, pay again; pay Checks 2, 3 → success page has "Check 1 (Voided)", big number = sum of non-void checks (SPLIT-088)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const id = track(await S.quickPayOrder([10_000]));
        await S.openSplit();
        let s = '';
        let paid = Number.NaN;
        try {
          await P.clickQ(VqpsSplit.addCheck);
          await settle(500);
          await S.payCheck(id, 1, 'Other');
          await S.voidCheck(id, 1);
          const nums = await S.unpaidChecks(id);
          console.warn(`SPLIT-088: unpaid checks after the void: ${nums.join(', ')}`);
          for (const n of nums) await S.payCheck(id, n, 'Other');
          // Sum of non-void checks = Total Paid (Other price).
          paid = (await S.paidRemaining()).totalPaid;
          s = await S.completeDone();
          await app.noReceipt();
        } finally {
          await S.settleSplit(id);
        }
        expect(s).toMatch(/Check \d+ \(Voided\)/);
        expect(paid).toBeGreaterThan(0);
        expect(s).toContain(
          `$${paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        );
      },
    );

    it(
      title(
        'SPLIT-O5 Void Order (void the whole split order) — skipped when the Split screen has no button (SPLIT-089)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = track(await app.createOrder());
        await S.openSplit();
        try {
          await S.payCheck(id, 1, 'Other');
          const voidOrder = inMain(btn('Void Order', 0));
          // VERIFY: develop only has the locale key global.voidOrder; no button rendered on Split yet.
          if (!(await visible(voidOrder))) {
            console.warn('SPLIT-O5: no "Void Order" button on the Split screen (develop does not render it)');
            this.skip();
          }
          await P.clickQ(voidOrder);
          expect(await textAppears('Void this entire order? All check payments will be voided.', 8_000)).toBe(
            true,
          );
          await P.clickQ([
            { role: 'dialog', nth: -1 },
            { role: 'button', nameRe: 'Confirm|Void', nth: -1 },
          ]);
          await app.passcodeIfAsked(4_000);
          expect(await textAppears('Order voided', 20_000)).toBe(true);
        } finally {
          await S.settleSplit(id);
        }
      },
    );
  });

  /* ======================================================================= *
   * SPLIT-P Split Tip
   * ======================================================================= */

  describe('SPLIT-P Split Tip', () => {
    it(
      title(
        'SPLIT-P1 1-staff order tip $2: Total Tip $2.00, "Pamela - $2.00", no Split Tip; 2-staff order tip $10 has Split Tip (SPLIT-096)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(5 * 60_000);
        await app.createOrder();
        let s = await payOtherWithTip('200');
        expect(s).toContain('Total Tip: $2.00');
        expect(s).toContain(`${vqEnv.testStaff} - $2.00`);
        expect(await P.count(VqpsSuccess.splitTip)).toBe(0);
        await app.noReceipt();

        await twoStaffOrder();
        s = await payOtherWithTip('1000');
        expect(s).toContain('Total Tip: $10.00');
        expect(await visible(VqpsSuccess.splitTip)).toBe(true);
        await app.noReceipt();
      },
    );

    it(
      title(
        'SPLIT-P2 Tip $60 → Split Tip: Total tip $60.00, 3 tabs; default tab per setting (Evenly → $30.00/$30.00 disabled) (SPLIT-097)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await twoStaffOrder();
        await payOtherWithTip('6000');
        await S.openSplitTip();
        const dlg = S.splitTipDialog;
        expect(await visible([dlg, textHas('Split Tip')])).toBe(true);
        expect(await visible([dlg, { text: 'Total tip', nth: 0 }])).toBe(true);
        expect(await visible([dlg, textHas('$60.00')])).toBe(true);
        for (const t of ['Split Evenly', 'Proportion', 'Manual']) expect(await visible(tipTab(t))).toBe(true);
        if ((await P.attrOf(tipTab('Split Evenly'), 'aria-selected')) === 'true') {
          expect(await S.tipValues()).toEqual([30, 30]);
          expect(await tipInputsDisabled()).toEqual([true, true]);
        } else {
          console.warn(
            'SPLIT-097: merchant Split Tip Setting is not Evenly — only the selected tab is checked',
          );
          expect(await P.count([dlg, { role: 'tab', css: '[aria-selected="true"]' }])).toBe(1);
        }
        await P.clickQ(tipClose);
        await app.noReceipt();
      },
    );

    it(
      title(
        'SPLIT-P3 3 staff, tip $10 → Split Evenly → $3.34 / $3.33 / $3.33, Confirm → "Tip updated successfully" (SPLIT-098)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await twoStaffOrder();
        // Third staff: any technician on the Home grid besides Pamela / Thalia.
        const third = (await visibleStaffNames()).find(
          (n) => ![vqEnv.testStaff, vqEnv.testStaff2].includes(n),
        );
        if (!third) {
          console.warn('SPLIT-P3: Home grid has no third staff besides Pamela / Thalia');
          this.skip();
        }
        console.warn(`SPLIT-P3: third staff ${third}`);
        await app.pickStaff(third);
        await app.addService(vqEnv.testService);
        await payOtherWithTip('1000');
        await S.openSplitTip();
        await P.clickQ(tipTab('Manual'));
        await P.clickQ(tipTab('Split Evenly'));
        expect(await S.tipValues()).toEqual([3.34, 3.33, 3.33]);
        if (!(await P.isDisabled(tipConfirm))) {
          await P.clickQ(tipConfirm);
          expect(await textAppears('Tip updated successfully', 10_000)).toBe(true);
        } else {
          console.warn('SPLIT-098: split already Evenly → Confirm disabled');
          await P.clickQ(tipClose);
        }
        await app.noReceipt();
      },
    );

    it(
      title(
        'SPLIT-P4 Split Evenly 2 staff rounding: $15.00 → 7.50/7.50; $17.10 → 8.55/8.55; $4.00 → 2.00/2.00; $0.01 → 0.01/0.00 (SPLIT-099)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
        Tag.SLOW,
      ),
      async function () {
        this.timeout(8 * 60_000);
        const cases: [string, number[]][] = [
          ['1500', [7.5, 7.5]],
          ['1710', [8.55, 8.55]],
          ['400', [2, 2]],
          ['1', [0.01, 0]],
        ];
        for (const [tip, expected] of cases) {
          await step(`tip ${tip} cents`, async () => {
            await twoStaffOrder();
            await payOtherWithTip(tip);
            await S.openSplitTip();
            await P.clickQ(tipTab('Manual'));
            await P.clickQ(tipTab('Split Evenly'));
            expect(await S.tipValues()).toEqual(expected);
            await P.clickQ(tipClose);
            await app.noReceipt();
          });
        }
      },
    );

    it(
      title(
        'SPLIT-P5 Proportion: Pamela $60 / Thalia $40, tip $20 → $12.00 / $8.00, inputs disabled, Confirm enabled (SPLIT-100)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await S.quickPayOrder([{ cents: 6000, name: 'QP prop A' }]);
        await app.pickStaff(vqEnv.testStaff2);
        await S.addQuickPay({ cents: 4000, name: 'QP prop B' });
        await payOtherWithTip('2000');
        await openSplitTipNotProportion();
        await P.clickQ(tipTab('Proportion'));
        expect(await S.tipValues()).toEqual([12, 8]);
        expect(await tipInputsDisabled()).toEqual([true, true]);
        expect(await P.isDisabled(tipConfirm)).toBe(false);
        await P.clickQ(tipClose);
        await app.noReceipt();
      },
    );

    it(
      title(
        'SPLIT-P6 Proportion: Pamela $65 / Thalia $26 + $38, tip $25.80 → $13.00 / $12.80; Confirm → toast (SPLIT-101)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await S.quickPayOrder([{ cents: 6500, name: 'QP p65' }]);
        await app.pickStaff(vqEnv.testStaff2);
        await S.addQuickPay({ cents: 2600, name: 'QP p26' });
        await S.addQuickPay({ cents: 3800, name: 'QP p38' });
        await payOtherWithTip('2580');
        await openSplitTipNotProportion();
        await P.clickQ(tipTab('Proportion'));
        expect(await S.tipValues()).toEqual([13, 12.8]);
        expect(await P.isDisabled(tipConfirm)).toBe(false);
        await P.clickQ(tipConfirm);
        expect(await textAppears('Tip updated successfully', 10_000)).toBe(true);
        await app.noReceipt();
      },
    );

    it(
      title(
        'SPLIT-P7 Proportion rounding: $1.00 / $2.00, tip $1.00 → $0.34 / $0.66 (SPLIT-102)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await S.quickPayOrder([{ cents: 100, name: 'QP one' }]);
        await app.pickStaff(vqEnv.testStaff2);
        await S.addQuickPay({ cents: 200, name: 'QP two' });
        await payOtherWithTip('100');
        await S.openSplitTip();
        await P.clickQ(tipTab('Proportion'));
        expect(await S.tipValues()).toEqual([0.34, 0.66]);
        await P.clickQ(tipClose);
        await app.noReceipt();
      },
    );

    it(
      title(
        'SPLIT-P8 Manual: Confirm disabled until a change, enabled on tab switch; sum ≠ tip → disabled; input 2 clamped to $0.00; closing X keeps the old tip (SPLIT-103, SPLIT-104, SPLIT-105, SPLIT-107, SPLIT-108)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await twoStaffOrder();
        const s0 = await payOtherWithTip('1000');
        const tipLine = (s: string): string =>
          new RegExp(`${vqEnv.testStaff} - \\$[\\d.]+[^|]*`).exec(s)?.[0] ?? '';
        await S.openSplitTip();
        expect(await P.isDisabled(tipConfirm)).toBe(true); // SPLIT-107: no change → Confirm disabled
        const current = await selectedTipTab();
        const other = current === 'Proportion' ? 'Split Evenly' : 'Proportion';
        await P.clickQ(tipTab(other));
        expect(await P.isDisabled(tipConfirm)).toBe(false); // SPLIT-107: tab switch → Confirm enabled

        await P.clickQ(tipTab('Manual'));
        const [i1, i2] = [tipInput(0), tipInput(1)];
        await P.fillQ(i1, '500');
        await P.fillQ(i2, '300');
        expect(await P.isDisabled(tipConfirm)).toBe(true); // SPLIT-103: $5 + $3 ≠ $10
        await P.fillQ(i2, '499');
        expect(await P.isDisabled(tipConfirm)).toBe(true); // SPLIT-104: $5 + $4.99 ≠ $10
        await P.fillQ(i2, '0');
        await P.fillQ(i1, '1000');
        await P.fillQ(i2, '500');
        await settle(300);
        expect(await P.inputValue(i2)).toMatch(/^\$?0\.00$/); // SPLIT-105: staff 2 clamped to $0.00 once staff 1 has the whole tip

        await P.clickQ(tipClose);
        await P.waitGoneQ(S.splitTipDialog, 5_000, 'Split Tip dialog');
        const s1 = await app.text('body');
        expect(tipLine(s1)).toBe(tipLine(s0)); // SPLIT-108: closing X saves nothing
        await app.noReceipt();
      },
    );

    it(
      title(
        'SPLIT-P9 Manual $10 / $30 (tip $40) → Confirm: toast, success page and Order History show $10.00 / $30.00 (SPLIT-106)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = await twoStaffOrder();
        await payOtherWithTip('4000');
        await S.openSplitTip();
        await P.clickQ(tipTab('Manual'));
        const [i1, i2] = [tipInput(0), tipInput(1)];
        await P.fillQ(i1, '0');
        await P.fillQ(i2, '0');
        await P.fillQ(i1, '1000');
        await P.fillQ(i2, '3000');
        await P.clickQ(tipConfirm);
        expect(await textAppears('Tip updated successfully', 10_000)).toBe(true);
        await waitUntil(async () => (await app.text('body')).includes(`${vqEnv.testStaff} - $10.00`), 15_000);
        expect(await app.text('body')).toContain(`${vqEnv.testStaff} - $10.00`);
        expect(await app.text('body')).toContain(`${vqEnv.testStaff2} - $30.00`);
        await app.noReceipt();
        await app.openHistoryOrder(id);
        const d = await app.historyDetail(id);
        expect(d).toContain(`${vqEnv.testStaff} - $10.00`);
        expect(d).toContain(`${vqEnv.testStaff2} - $30.00`);
      },
    );

    it(
      title(
        'SPLIT-P10 2-staff order + a gift card sale line: Split Tip lists only the 2 staff, no "Store" (SPLIT-110)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        if (!vqEnv.testGiftCard) {
          console.warn('SPLIT-P10: needs VOLT_TEST_GIFT_CARD');
          this.skip();
        }
        await twoStaffOrder();
        await app.openSellGiftCard();
        const gc = { role: 'dialog', name: 'Sell Gift Card', nth: -1 } as const;
        await P.fillQ([gc, { role: 'textbox', name: 'Enter gift card code' }], vqEnv.testGiftCard);
        await P.waitFor([gc, { textRe: 'Balance: \\$', nth: 0 }], 10_000, 'gift card Balance');
        await P.clickQ([gc, btn('$25', 0)]);
        await P.clickQ([gc, btn('Add')]);
        await P.waitGoneQ(gc, 8_000, 'Sell Gift Card');
        await payOtherWithTip('1000');
        await S.openSplitTip();
        const dlg = S.splitTipDialog;
        expect(await P.count(S.tipInputs)).toBe(2);
        expect(await visible([dlg, { text: vqEnv.testStaff, nth: 0 }])).toBe(true);
        expect(await visible([dlg, { text: vqEnv.testStaff2, nth: 0 }])).toBe(true);
        expect(await P.count([dlg, { text: 'Store' }])).toBe(0);
        await P.clickQ(tipClose);
        await app.noReceipt();
      },
    );

    it(
      title(
        'SPLIT-P11 2-staff order paid by Split: Check 1 tip $2, Check 2 tip $1 → Split Tip: Total tip $3.00, Evenly $1.50 / $1.50 (SPLIT-111)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = track(await twoStaffOrder());
        await S.openSplit();
        await S.payCheck(id, 1, 'Other', { cashierTipCents: '200' });
        await S.payCheck(id, 2, 'Other', { cashierTipCents: '100' });
        await S.completeDone();
        splits.delete(id);
        await S.openSplitTip();
        expect(await visible([S.splitTipDialog, textHas('$3.00')])).toBe(true);
        await P.clickQ(tipTab('Manual'));
        await P.clickQ(tipTab('Split Evenly'));
        expect(await S.tipValues()).toEqual([1.5, 1.5]);
        if (!(await P.isDisabled(tipConfirm))) {
          await P.clickQ(tipConfirm);
          expect(await textAppears('Tip updated successfully', 10_000)).toBe(true);
        } else await P.clickQ(tipClose);
        await app.noReceipt();
      },
    );
  });

  /* ======================================================================= *
   * SPLIT-Q Layout
   * ======================================================================= */

  describe('SPLIT-Q Layout', () => {
    it(
      title(
        'SPLIT-Q1 1920×1080 + Dark theme: Split screen with 4 checks has no horizontal scroll, method tiles have enough contrast (SPLIT-114)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.EXCLUSIVE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        await app.go('/settings/accessibility');
        await settle(800);
        const dark = themeRadio('dark');
        const light = themeRadio('light');
        if (!(await visible(dark))) {
          console.warn(
            'SPLIT-Q1: no Dark theme control on Settings › Accessibility (dark mode not shipped on this build)',
          );
          this.skip();
        }
        const wasDark =
          (await P.attrOf(dark, 'aria-checked')) === 'true' ||
          (await P.attrOf(dark, 'data-state')) === 'checked';
        const restore = await emulateViewport(1920, 1080);
        if (!restore) {
          console.warn(
            'SPLIT-Q1: the app window cannot be sized to a 1920×1080 viewport on this screen (volt-qc used CDP emulation)',
          );
          this.skip();
        }
        try {
          await P.clickQ(dark);
          await waitUntil(
            async () =>
              (await P.attrOf(dark, 'aria-checked')) === 'true' ||
              (await P.attrOf(dark, 'data-state')) === 'checked',
            5_000,
          );
          expect(
            (await P.attrOf(dark, 'aria-checked')) === 'true' ||
              (await P.attrOf(dark, 'data-state')) === 'checked',
          ).toBe(true);
          const id = await S.quickPayOrder([10_000]);
          await S.openSplit();
          await P.clickQ(VqpsSplit.addCheck);
          await settle(400);
          await P.clickQ(VqpsSplit.addCheck);
          await settle(400);
          expect(await S.checkNumbers(id)).toEqual([1, 2, 3, 4]);
          expect(await P.noHorizontalScroll()).toBe(true); // Split screen at 1920×1080 must not scroll sideways
          for (const m of ['Card', 'Cash', 'Gift Card', 'Other'] as const) {
            const c = await methodTileContrast(m);
            expect(c).not.toBeNull();
            if (!c) continue;
            // WCAG 2.x AA: large text (≥ 24px, or ≥ 18.66px bold ≥ 700) needs 3:1; normal text 4.5:1.
            const large = c.px >= 24 || (c.px >= 18.66 && c.weight >= 700);
            console.warn(
              `Tile ${m}: contrast ${c.ratio.toFixed(2)} (text ${String(c.px)}px/${String(c.weight)}${large ? ', large' : ''})`,
            );
            expect(c.ratio).toBeGreaterThanOrEqual(large ? 3 : 4.5);
          }
        } finally {
          await restore();
          await app.go('/settings/accessibility');
          if (!wasDark) await P.clickQ(light, 5_000).catch(() => undefined);
        }
      },
    );
  });
});
