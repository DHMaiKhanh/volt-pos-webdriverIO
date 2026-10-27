/**
 * volt-qc port — 05 SPLIT "deep": multi-method checks, void, tips, receipts, reports, Split Tip Setting, Vietnamese.
 *
 * Source: volt-qc `e2e/tests/05-split/split-deep.spec.ts` (SPLIT-D01..D06).
 * Merchant 14 (dev) runs Service Fee 10% (Card) + Tax 10%: a check is split from the CARD total on Home; paying a check
 * with Cash / Other / Gift Card costs ≈ check / (1 + fee) and the app reconciles ≤ 1–2¢ so that the SUM over the checks
 * equals the Cash price of the whole order (Σ base·(1+tax)) — checked on the "Pay $x" button, totals compared to the cent.
 * A test that paid ≥ 1 check always finishes the split in `finally` (the Split screen blocks leaving with a paid check).
 *
 * CREATES DATA (orders paid Cash / Other / Gift Card — no card charge). D05 flips Split Tip Setting and D06 the app
 * language (merchant-global, Tag.EXCLUSIVE) — both restored in `finally`.
 *
 * Not automated (same as the source): SPLIT-032 (DEV pre-fills one item on a new By Items check), SPLIT-054 / SPLIT-057
 * (partial gift-card redemption blocked in split, VP-3788), SPLIT-092 (per-check receipt omits totals on purpose, VP-2050).
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { btn, btnRe, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsHome } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { step } from '../../../../src/helpers/steps.js';
import { restoreEnglish, setLanguage } from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { cardTotalOf, cashTotalOf, priceModel } from '../../../../src/pages/voltqc/promo-split/price.js';
import {
  ensureGiftCardBalance,
  giftCardCooldown,
  markGiftCardUse,
  waitGiftCardBalance,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import {
  addCheckButton,
  c,
  checkReceiptText,
  driveUntil,
  ensureServiceLine,
  expectNoEnglish,
  flat,
  historyReceiptText,
  itemsOfCheck,
  note,
  openPendingAnyLang,
  orderStaffNames,
  payButtonText,
  payCurrentCheck,
  payOtherWithTip,
  pollDailyRow,
  pollTrue,
  POLL_TIMEOUT,
  prices,
  readSplitTipMode,
  rememberOrderDay,
  reUsd,
  selectCheckButton,
  selectedSplitTipTab,
  setSplitTipSetting,
  settleSplitAnyLang,
  splitTipButton,
  splitTipTab,
  staffIncomeOrderRows,
  staffTip,
  successTotal,
  sum2,
  tipInput,
  VI,
  type SplitTipMode,
} from '../../../../src/pages/voltqc/promo-split/splitDeepExtra.js';
import * as S from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  app,
  field,
  money,
  usd,
  visible,
  vqEnv,
  waitUntil,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

/** A synchronous assertion block reported as a step. */
const check = (name: string, fn: () => void): Promise<void> => step(name, () => Promise.resolve().then(fn));

/** Order whose split may be half-paid — afterEach finishes it. */
let splitId = '';

async function afterEachCleanup(): Promise<void> {
  await app.closeStrayDialogs().catch(() => undefined);
  if (splitId) await S.settleSplit(splitId);
  splitId = '';
  if (/payment-success/.test(await app.path().catch(() => ''))) await app.noReceipt().catch(() => undefined);
  await app.cleanupOrders();
}

describe('volt-qc 05 SPLIT deep — multi-method checks, void, tip, reports', () => {
  before(() => {
    assertWritesAllowed('volt-qc 05 SPLIT deep: pay split checks Cash / Other / Gift Card');
  });

  afterEach(async () => {
    await afterEachCleanup();
  });

  it(
    title(
      'SPLIT-D01 Equally 3 checks Cash + $2 tip with change / Other + $1 tip / Gift Card: Σ checks = Total, Σ paid = order Cash price; success page, Order History, receipt, Daily Sale, card balance (SPLIT-070)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn('VOLT_TEST_GIFT_CARD is not set');
        this.skip();
      }
      this.timeout(10 * 60_000);
      const code = vqEnv.testGiftCard;
      const { m, base } = await prices([vqEnv.testService, vqEnv.testService2]);
      const bases = [base[vqEnv.testService] ?? Number.NaN, base[vqEnv.testService2] ?? Number.NaN, 12.34];
      const gross = sum2(bases);
      const cashAll = cashTotalOf(m, bases);
      const B0 = await ensureGiftCardBalance(code, cashAll);
      const id = await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
      await S.addQuickPay({ cents: 1234, name: 'QP D01 1234' });
      const T = (await app.orderTotals()).total;
      expect(T).toBeCloseTo(cardTotalOf(m, bases), 1);
      await S.openSplit();
      splitId = id;

      let xs: number[] = [];
      let c1 = Number.NaN;
      let o2 = Number.NaN;
      let g3 = Number.NaN;
      let give = Number.NaN;
      let success = '';
      try {
        await step(
          'Add New Check → 3 even checks from Total (remainder cents on the last checks), Σ = Total',
          async () => {
            await P.clickQ(addCheckButton);
            await P.waitFor(selectCheckButton(id, 3), 10_000, 'Check 3');
            xs = await S.checkAmounts(id);
            expect(xs.map(c)).toEqual(S.evenSplit(T, 3).map(c));
            expect(c(sum2(xs))).toBe(c(T));
          },
        );

        await step(
          'Check 1 Cash + cashier tip $2, customer gives round cash → change; "2 checks remaining - total …"',
          async () => {
            c1 = await S.methodPrice(id, 1, 'Cash');
            expect(c1).toBeCloseTo(S.nonCardShare(m, xs[0] ?? Number.NaN), 1);
            await S.cashierTip('200');
            expect(await payButtonText()).toMatch(new RegExp(`Pay\\s*${reUsd(c1 + 2)}`));
            give = Math.ceil(c1 + 2) + 5;
            const t = await payCurrentCheck(1, 'Cash', { cashKeys: [...String(give * 100)] });
            expect(t).toContain(`2 checks remaining - total ${usd((xs[1] ?? 0) + (xs[2] ?? 0))}`);
            await S.closePaidDialog(1);
            expect(await S.checkRowText(id, 1)).toContain(
              `Paid with Cash - Got: ${usd(give)} (Change: ${usd(give - c1 - 2)} - Tip: $2.00)`,
            );
          },
        );

        await step('Check 2 Other ("QC Deep D01") + tip $1 → "1 check remaining - total …"', async () => {
          o2 = await S.methodPrice(id, 2, 'Other');
          expect(o2).toBeCloseTo(S.nonCardShare(m, xs[1] ?? Number.NaN), 1);
          const t = await S.payCheck(id, 2, 'Other', {
            cashierTipCents: '100',
            otherName: 'QC Deep D01',
            next: 'none',
          });
          expect(t).toContain(`1 check remaining - total ${usd(xs[2] ?? 0)}`);
          await S.closePaidDialog(2);
          expect(await S.checkRowText(id, 2)).toContain('Paid with Other');
        });

        await step('Check 3 Gift Card → "All checks paid"', async () => {
          g3 = await S.methodPrice(id, 3, 'Gift Card');
          expect(g3).toBeCloseTo(S.nonCardShare(m, xs[2] ?? Number.NaN), 1);
          await giftCardCooldown();
          const t = await S.payCheck(id, 3, 'Gift Card', { giftCard: code, next: 'none' });
          markGiftCardUse();
          expect(t).toContain('All checks paid');
          await S.closePaidDialog(3);
          expect(await S.checkRowText(id, 3)).toContain('Paid with Gift Card');
        });

        await check(
          'SPLIT-070 Σ paid (Cash / Other / Gift Card) = order Cash price — tax split per check loses / adds no cent',
          () => {
            note(`Cash ${String(c1)} + Other ${String(o2)} + Gift Card ${String(g3)} vs ${String(cashAll)}`);
            expect(c(c1 + o2 + g3)).toBe(c(cashAll));
          },
        );

        success = await S.completeDone();
        rememberOrderDay(id);
        await app.noReceipt();
      } finally {
        await S.settleSplit(id);
        splitId = '';
      }

      await check(
        'Success page: big amount = Σ paid + $3 tip; "Check n | Paid by … | $x (+ $tip Tip)"; Total Tip $3.00',
        () => {
          expect(successTotal(success)).toBeCloseTo(c1 + o2 + g3 + 3, 2);
          expect(success).toMatch(
            new RegExp(`Check 1 \\| Paid by Cash[^|]*\\| ${reUsd(c1)} \\+ \\$2\\.00 Tip`),
          );
          expect(success).toMatch(
            new RegExp(`Check 2 \\| Paid by Other[^|]*\\| ${reUsd(o2)} \\+ \\$1\\.00 Tip`),
          );
          expect(success).toMatch(new RegExp(`Check 3 \\| Paid by Gift Card[^|]*\\| ${reUsd(g3)}( \\||$)`));
          expect(success).toContain('Total Tip: $3.00');
        },
      );

      await step(
        'SPLIT-070 Order History: Successful - Unsettled, #-1/-2/-3; Tax = order tax; Tip $3.00; Total = Σ paid + tip',
        async () => {
          await app.openHistoryOrder(id);
          const d = await app.historyDetail(id);
          expect(field(d, 'Status')).toBe('Successful - Unsettled');
          for (const n of [1, 2, 3]) expect(d).toContain(`#${id}-${String(n)}`);
          expect(money(field(d, 'Subtotal'))).toBeCloseTo(gross, 2);
          expect(money(field(d, 'Tax'))).toBeCloseTo(cashAll - gross, 2);
          expect(money(field(d, 'Tip'))).toBeCloseTo(3, 2);
          expect(money(field(d, 'Total'))).toBeCloseTo(cashAll + 3, 2);
        },
      );

      await step(
        'Final receipt: "Paid with" #-1 Cash / #-2 Other / #-3 Gift Card, amount = paid + tip, no Voided',
        async () => {
          const r = await historyReceiptText();
          expect(r).toMatch(new RegExp(`#${id}-1 \\| Cash \\| ${reUsd(c1 + 2)}`));
          expect(r).toMatch(new RegExp(`#${id}-2 \\| Other \\| ${reUsd(o2 + 1)}`));
          expect(r).toMatch(new RegExp(`#${id}-3 \\| Gift Card \\| ${reUsd(g3)}`));
          expect(r).not.toContain('Voided');
        },
      );

      await step(
        'Daily Sale: Tip $3.00, Total = Σ paid + tip, Sale + Tax + Tip = Total, Sale = Σ base',
        async () => {
          const [row] = await pollDailyRow(id, true);
          expect(row?.tip).toBeCloseTo(3, 2);
          expect(row?.total).toBeCloseTo(cashAll + 3, 2);
          expect((row?.sale ?? 0) + (row?.tax ?? 0) + (row?.tip ?? 0)).toBeCloseTo(
            row?.total ?? Number.NaN,
            2,
          );
          expect(row?.sale).toBeCloseTo(gross, 2);
        },
      );

      await step('Card balance = before − check 3', async () => {
        expect(await waitGiftCardBalance(code, B0 - g3, 90_000)).toBeCloseTo(B0 - g3, 2);
      });
    },
  );

  it(
    title(
      'SPLIT-D02 Void a Cash check then repay with Other + tip: success page "(Voided)"; final receipt lists each check (void one Voided) + Cancel information; per-check receipt has only its check; Daily Sale (SPLIT-125)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(10 * 60_000);
      const id = await app.createOrder();
      await S.openSplit();
      splitId = id;
      let c1 = Number.NaN;
      let o1 = Number.NaN;
      let o2 = Number.NaN;
      let success = '';
      try {
        await step(
          'Check 1 Cash → Void (Customer Request) → unpaid → repay with Other + tip $1; Check 2 Other',
          async () => {
            c1 = await S.methodPrice(id, 1, 'Cash');
            await S.payCheck(id, 1, 'Cash');
            await S.voidCheck(id, 1, 'Customer Request');
            expect(await S.isCheckPaid(id, 1)).toBe(false);
            o1 = await S.methodPrice(id, 1, 'Other');
            expect(o1).toBeCloseTo(c1, 2);
            await S.payCheck(id, 1, 'Other', { cashierTipCents: '100', otherName: 'QC Repay' });
            o2 = await S.methodPrice(id, 2, 'Other');
            await S.payCheck(id, 2, 'Other', { otherName: 'QC Check2' });
          },
        );
        success = await S.completeDone();
        rememberOrderDay(id);
        await app.noReceipt();
      } finally {
        await S.settleSplit(id);
        splitId = '';
      }
      const live = Math.round((o1 + 1 + o2) * 100) / 100;

      await check(
        'Success page: "Check 1 (Voided)" Cash, Check 2 Other + $1.00 Tip, Check 3 Other; big amount = non-void checks',
        () => {
          expect(success).toMatch(new RegExp(`Check 1 \\(Voided\\) \\| Paid by Cash[^|]*\\| ${reUsd(c1)}`));
          expect(success).toMatch(
            new RegExp(`Check 2 \\| Paid by Other[^|]*\\| ${reUsd(o1)} \\+ \\$1\\.00 Tip`),
          );
          expect(success).toMatch(new RegExp(`Check 3 \\| Paid by Other[^|]*\\| ${reUsd(o2)}`));
          expect(successTotal(success)).toBeCloseTo(live, 2);
        },
      );

      await step(
        'Daily Sale (while the void settles): Tip $1.00, Total = non-void checks + tip',
        async () => {
          const [row] = await pollDailyRow(
            id,
            true,
            POLL_TIMEOUT,
            (rows) => c(rows[0]?.total ?? Number.NaN) === c(live),
          );
          expect(row?.tip).toBeCloseTo(1, 2);
        },
      );

      let rc = '';
      await step(
        'SPLIT-125 final receipt: #-1 Voided Cash, #-2 Other (paid + tip), #-3 Other; Cancel information of #-1',
        async () => {
          // The void sits in "Canceling" before "Voided"; the cancel block appears only after (≈1–10 min) → reopen until there.
          const ok = await pollTrue(
            async () => {
              await app.openHistoryOrder(id);
              rc = await historyReceiptText();
              return /Cancel informations? \|/.test(rc);
            },
            5 * 60_000,
            4_000,
          );
          if (!ok) note(`Receipt has no Cancel information yet: ${rc}`, 'observation');
          expect(ok).toBe(true);
          note(`Receipt: ${rc}`);
          expect(rc).toMatch(new RegExp(`#${id}-1 \\| Voided \\| Cash \\| ${reUsd(c1)}`));
          expect(rc).toMatch(new RegExp(`#${id}-2 \\| Other \\| ${reUsd(o1 + 1)}`));
          expect(rc).toMatch(new RegExp(`#${id}-3 \\| Other \\| ${reUsd(o2)}`));
          const amt = (n: number): number =>
            money(new RegExp(`#${id}-${String(n)} \\| Other \\| (\\$[\\d,.]+)`).exec(rc)?.[1]);
          expect(c(amt(2) + amt(3))).toBe(c(live));
          const ci = rc.slice(rc.search(/Cancel informations? \|/));
          expect(ci).toMatch(
            new RegExp(`^Cancel informations? \\| #${id}-1 \\| Amount \\| ${reUsd(c1)} \\|`),
          );
          expect(ci).toMatch(/\| Date \| \d{2}\/\d{2}\/\d{4}[^|]*\|/);
          expect(ci).toMatch(/\| By Staff \| [^|]+\|/);
          expect(ci).toMatch(/\| Reason \| Customer Request/);
          expect(ci).not.toMatch(new RegExp(`#${id}-[23]`));
        },
      );

      await step(
        'Per-check receipt (View receipt for check 2 / 3): only that check code + method',
        async () => {
          for (const [n, method] of [
            [2, 'Other'],
            [3, 'Other'],
          ] as const) {
            const t = await checkReceiptText(id, n);
            expect(t).toContain(`#${id}-${String(n)}`);
            for (const k of [1, 2, 3].filter((x) => x !== n)) expect(t).not.toContain(`#${id}-${String(k)}`);
            expect(t).toMatch(new RegExp(`Paid with:? \\| ${method} \\| \\$`));
          }
        },
      );
    },
  );

  it(
    title(
      'SPLIT-D03 By Amount 4 checks: gift card over balance → only "Select Another Method", card untouched; pay Cash / Gift Card / Other + tip / Cash + tip; Σ = Total, Σ paid = Cash price; Order History + Daily Sale (SPLIT-055)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn('VOLT_TEST_GIFT_CARD is not set');
        this.skip();
      }
      this.timeout(10 * 60_000);
      const code = vqEnv.testGiftCard;
      const m = await priceModel();
      const B = await ensureGiftCardBalance(code, 30);
      // Check 1 (Card price) so that its Gift Card price ≈ check / (1 + fee) exceeds the balance by $250 (stale balance read, bug #6).
      const a1 = Math.ceil((B + 250) * (1 + m.fee) * 100);
      const qp = Math.round((a1 + 1500 + 1500 + 2000) / ((1 + m.fee) * (1 + m.tax)));
      if (qp > 1_000_000) {
        console.warn(
          `Test card balance ($${String(B)}) too large — the order would need Quick Pay > $10,000`,
        );
        this.skip();
      }
      const id = await S.quickPayOrder([{ cents: qp, name: 'QP D03 BA' }]);
      const T = (await app.orderTotals()).total;
      const cashAll = cashTotalOf(m, [qp / 100]);
      await S.openSplit();
      splitId = id;

      const p = { c1: Number.NaN, g2: Number.NaN, o3: Number.NaN, c4: Number.NaN };
      let success = '';
      try {
        await step(
          'By Amount + 2× Add New Check → 4 checks; Check 2 = Check 3 = $15, Check 1 over the card balance; last auto-balances',
          async () => {
            await P.clickQ(S.modeButton('By Amount'));
            await P.clickQ(addCheckButton);
            await P.clickQ(addCheckButton);
            await P.waitFor(selectCheckButton(id, 4), 10_000, 'Check 4');
            expect(c(sum2(await S.checkAmounts(id)))).toBe(c(T));
            await S.setCheckAmount(id, 2, '1500');
            await S.setCheckAmount(id, 3, '1500');
            await S.setCheckAmount(id, 1, String(a1));
            const xs = await S.checkAmounts(id);
            note(`Order ${id}: Total ${String(T)}, checks ${xs.join(' / ')}, card balance ${String(B)}`);
            expect(xs.slice(0, 3).map(c)).toEqual([a1, 1500, 1500]);
            expect(xs[3]).toBeGreaterThanOrEqual(1);
            expect(c(sum2(xs))).toBe(c(T));
          },
        );

        await step(
          'SPLIT-055 check 1 Gift Card over balance → "Gift Card not Enough Balance"; Select Another Method → nothing charged, check unpaid, checks unchanged',
          async () => {
            const before = await S.checkNumbers(id);
            const text = await S.startGiftCardCheck(id, 1, code);
            const dlg = VqpsCheckout.gcResultDialog;
            expect(text).toContain('Gift Card not Enough Balance');
            // DEV: BLOCK_PARTIAL_GIFT_CARD_REDEMPTION = true (VP-3788) → no "Create New Check"/"Cancel"; only "Select Another Method".
            expect(text).toContain(
              'Gift Card balance is insufficient for this check. Please select another payment method or modify the split configuration.',
            );
            expect(await P.count([dlg, btn('Create New Check')])).toBe(0);
            await P.clickQ([dlg, btn('Select Another Method')]);
            await P.waitGoneQ(dlg, 8_000);
            expect(await S.isCheckPaid(id, 1)).toBe(false);
            expect(await S.checkNumbers(id)).toEqual(before);
            await P.clickQ(S.methodButton('Cash'));
            expect(await P.isDisabled(S.payButton)).toBe(false);
          },
        );

        await step(
          'Pay: check 1 Cash, check 2 Gift Card, check 3 Other + $1, check 4 Cash + $2; Σ paid = order Cash price',
          async () => {
            p.c1 = await S.methodPrice(id, 1, 'Cash');
            expect(p.c1).toBeCloseTo(S.nonCardShare(m, a1 / 100), 1);
            expect(p.c1).toBeGreaterThan(B);
            await S.payCheck(id, 1, 'Cash');
            p.g2 = await S.methodPrice(id, 2, 'Gift Card');
            await giftCardCooldown();
            await S.payCheck(id, 2, 'Gift Card', { giftCard: code });
            markGiftCardUse();
            p.o3 = await S.methodPrice(id, 3, 'Other');
            await S.payCheck(id, 3, 'Other', { cashierTipCents: '100', otherName: 'QC D03' });
            p.c4 = await S.methodPrice(id, 4, 'Cash');
            const t4 = await S.payCheck(id, 4, 'Cash', { cashierTipCents: '200', next: 'none' });
            expect(t4).toContain('All checks paid');
            await S.closePaidDialog(4);
            note(`Σ paid ${JSON.stringify(p)}`);
            expect(c(p.c1 + p.g2 + p.o3 + p.c4)).toBe(c(cashAll));
          },
        );
        success = await S.completeDone();
        rememberOrderDay(id);
        await app.noReceipt();
      } finally {
        await S.settleSplit(id);
        splitId = '';
      }
      const paid = p.c1 + p.g2 + p.o3 + p.c4;

      await check('Success page: 4 checks right methods, Total Tip $3.00, big amount = Σ paid + tip', () => {
        expect(success).toMatch(new RegExp(`Check 1 \\| Paid by Cash[^|]*\\| ${reUsd(p.c1)}`));
        expect(success).toMatch(new RegExp(`Check 2 \\| Paid by Gift Card[^|]*\\| ${reUsd(p.g2)}`));
        expect(success).toMatch(
          new RegExp(`Check 3 \\| Paid by Other[^|]*\\| ${reUsd(p.o3)} \\+ \\$1\\.00 Tip`),
        );
        expect(success).toMatch(
          new RegExp(`Check 4 \\| Paid by Cash[^|]*\\| ${reUsd(p.c4)} \\+ \\$2\\.00 Tip`),
        );
        expect(success).toContain('Total Tip: $3.00');
        expect(successTotal(success)).toBeCloseTo(paid + 3, 2);
      });

      await step('Order History: #-1…#-4, Tip $3.00, Total = Σ paid + tip', async () => {
        await app.openHistoryOrder(id);
        const d = await app.historyDetail(id);
        expect(field(d, 'Status')).toBe('Successful - Unsettled');
        for (const n of [1, 2, 3, 4]) expect(d).toContain(`#${id}-${String(n)}`);
        expect(money(field(d, 'Tip'))).toBeCloseTo(3, 2);
        expect(money(field(d, 'Total'))).toBeCloseTo(cashAll + 3, 2);
      });

      await step(
        'Daily Sale: Tip $3.00, Total = Σ paid + tip; card balance down by check 2 only',
        async () => {
          const [row] = await pollDailyRow(id, true);
          expect(row?.tip).toBeCloseTo(3, 2);
          expect(row?.total).toBeCloseTo(cashAll + 3, 2);
          expect((row?.sale ?? 0) + (row?.tax ?? 0) + (row?.tip ?? 0)).toBeCloseTo(
            row?.total ?? Number.NaN,
            2,
          );
          expect(await waitGiftCardBalance(code, B - p.g2, 90_000)).toBeCloseTo(B - p.g2, 2);
        },
      );
    },
  );

  it(
    title(
      'SPLIT-D04 By Items 2 staff, 3 checks (1 item each): check = item Card price; Cash + $2 / Other + $1 / Other; Split Tip $3.00 Evenly $1.50/$1.50 → Manual $1/$2; Order History, Daily Sale, Staff Income tips (SPLIT-111)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(10 * 60_000);
      const [s1, s2] = [vqEnv.testStaff, vqEnv.testStaff2];
      const { m, base } = await prices([vqEnv.testService, vqEnv.testService2]);
      const QP = 'QP D04 Items';
      const itemBase: Record<string, number> = {
        [vqEnv.testService]: base[vqEnv.testService] ?? Number.NaN,
        [QP]: 20,
        [vqEnv.testService2]: base[vqEnv.testService2] ?? Number.NaN,
      };
      const cashAll = cashTotalOf(m, Object.values(itemBase));
      const id = await app.createOrder({ services: [vqEnv.testService] });
      await S.addQuickPay({ cents: 2000, name: QP });
      await app.pickStaff(s2);
      await app.addService(vqEnv.testService2);
      await ensureServiceLine(vqEnv.testService2);
      await waitUntil(async () => (await orderStaffNames()).join('|') === [s1, s2].join('|'), 5_000);
      expect(await orderStaffNames()).toEqual([s1, s2]);
      const T = (await app.orderTotals()).total;
      await S.openSplit();
      splitId = id;

      const nameOf: Record<number, string> = {};
      const paid: number[] = [];
      let success = '';
      try {
        await step(
          'By Items → Add New Check: 3 checks with exactly 1 item each; check ≈ item Card price, Σ = Total',
          async () => {
            await P.clickQ(S.modeButton('By Items'));
            await P.clickQ(addCheckButton);
            await P.waitFor(selectCheckButton(id, 3), 10_000, 'Check 3');
            for (const n of [1, 2, 3]) {
              const items = await itemsOfCheck(id, n);
              note(`Check ${String(n)}: ${items.join(', ')}`);
              expect(items).toHaveLength(1);
              nameOf[n] = Object.keys(itemBase).find((k) => (items[0] ?? '').includes(k)) ?? '';
              expect(nameOf[n]).not.toBe('');
              const want = cardTotalOf(m, [itemBase[nameOf[n] ?? ''] ?? Number.NaN]);
              expect(Math.abs((await S.checkAmount(id, n)) - want)).toBeLessThanOrEqual(0.011);
            }
            expect(new Set(Object.values(nameOf)).size).toBe(3);
            expect(c(sum2(await S.checkAmounts(id)))).toBe(c(T));
          },
        );

        await step(
          'Pay: check 1 Cash + $2, check 2 Other + $1, check 3 Other; each = item Cash price, Σ = order Cash price',
          async () => {
            paid.push(await S.methodPrice(id, 1, 'Cash'));
            await S.payCheck(id, 1, 'Cash', { cashierTipCents: '200' });
            paid.push(await S.methodPrice(id, 2, 'Other'));
            await S.payCheck(id, 2, 'Other', { cashierTipCents: '100', otherName: 'QC D04' });
            paid.push(await S.methodPrice(id, 3, 'Other'));
            await S.payCheck(id, 3, 'Other', { otherName: 'QC D04 b' });
            for (const n of [1, 2, 3]) {
              expect(paid[n - 1]).toBeCloseTo(cashTotalOf(m, [itemBase[nameOf[n] ?? ''] ?? Number.NaN]), 1);
            }
            expect(c(sum2(paid))).toBe(c(cashAll));
          },
        );
        success = await S.completeDone();
        rememberOrderDay(id);
      } finally {
        await S.settleSplit(id);
        splitId = '';
      }

      await step('SPLIT-111 Split Tip: Total tip $3.00; Split Evenly $1.50 / $1.50 → Confirm', async () => {
        expect(success).toContain('Total Tip: $3.00');
        await S.openSplitTip();
        expect(await visible([S.splitTipDialog, { textRe: '\\$3\\.00', nth: 0 }])).toBe(true);
        await P.clickQ(splitTipTab('Manual'));
        await P.clickQ(splitTipTab('Split Evenly'));
        expect(await S.tipValues()).toEqual([1.5, 1.5]);
        const confirm = splitTipButton('Confirm');
        if (!(await P.isDisabled(confirm))) {
          await P.clickQ(confirm);
          await P.waitFor({ textRe: 'Tip updated successfully', nth: 0 }, 10_000, 'Tip updated successfully');
          await P.waitGoneQ(S.splitTipDialog, 8_000);
        } else {
          note('Split Tip already saved Evenly → Confirm disabled (nothing to change)');
          await P.clickQ(splitTipButton('Close'));
        }
      });

      await step(
        'Manual staff 1 $1.00 / staff 2 $2.00 → Confirm → success page shows each staff tip',
        async () => {
          await S.openSplitTip();
          await P.clickQ(splitTipTab('Manual'));
          await P.fillQ(tipInput(0), '0');
          await P.fillQ(tipInput(1), '0');
          await P.fillQ(tipInput(0), '100');
          await P.fillQ(tipInput(1), '200');
          await P.clickQ(splitTipButton('Confirm'));
          await P.waitFor({ textRe: 'Tip updated successfully', nth: 0 }, 10_000, 'Tip updated successfully');
          await waitUntil(
            async () => Math.abs(staffTip(await app.text('body'), s1) - 1) < 0.005,
            15_000,
            300,
          );
          expect(staffTip(await app.text('body'), s1)).toBeCloseTo(1, 2);
          expect(staffTip(await app.text('body'), s2)).toBeCloseTo(2, 2);
          await app.noReceipt();
        },
      );

      await step(
        'Order History: #-1/-2/-3, Tip $3.00, staff 1 $1.00 / staff 2 $2.00, Total = Σ paid + tip',
        async () => {
          await app.openHistoryOrder(id);
          const d = await app.historyDetail(id);
          for (const n of [1, 2, 3]) expect(d).toContain(`#${id}-${String(n)}`);
          expect(money(field(d, 'Tip'))).toBeCloseTo(3, 2);
          expect(staffTip(d, s1)).toBeCloseTo(1, 2);
          expect(staffTip(d, s2)).toBeCloseTo(2, 2);
          expect(money(field(d, 'Total'))).toBeCloseTo(cashAll + 3, 2);
        },
      );

      await step(
        'Reports: Daily Sale (Tip $3.00, Total = Σ paid + tip); Staff Income detail tip staff 1 $1 / staff 2 $2, Sale = item bases',
        async () => {
          const [row] = await pollDailyRow(id, true);
          expect(row?.tip).toBeCloseTo(3, 2);
          expect(row?.total).toBeCloseTo(cashAll + 3, 2);
          const sale1 = (itemBase[vqEnv.testService] ?? Number.NaN) + 20;
          const sale2 = itemBase[vqEnv.testService2] ?? Number.NaN;
          for (const [staff, tip, sale] of [
            [s1, 1, sale1],
            [s2, 2, sale2],
          ] as const) {
            let rows: { tip: number; sale: number }[] = [];
            await pollTrue(
              async () => {
                rows = await staffIncomeOrderRows(staff, id);
                return c(sum2(rows.map((r) => r.tip))) === c(tip);
              },
              POLL_TIMEOUT,
              1_000,
            );
            note(`Staff Income ${staff}: order ${id} rows ${JSON.stringify(rows)}`);
            expect(c(sum2(rows.map((r) => r.tip)))).toBe(c(tip));
            expect(c(sum2(rows.map((r) => r.sale)))).toBe(c(sale));
          }
        },
      );
    },
  );

  it(
    title(
      'SPLIT-D05 Split Tip Setting Evenly ↔ Proportion (toast "Split tip setting updated") → 2-staff order with tip: initial tips and Split Tip default tab follow the setting; setting restored (SPLIT-109)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const original = await readSplitTipMode();
      if (!original) {
        console.warn('Split Tip Setting unreadable (Settings › Payment & Transaction)');
        this.skip();
      }
      // Flip to the other value first, then back → both saves are real (toast), the last one = the original.
      const modes: SplitTipMode[] =
        original === 'proportion' ? ['evenly', 'proportion'] : ['proportion', 'evenly'];
      try {
        for (const mode of modes) {
          await step(
            `Setting = ${mode} → staff 1 QP $60 + staff 2 QP $40, tip $10 → initial tips + Split Tip opens on ${mode}`,
            async () => {
              expect(await setSplitTipSetting(mode)).toBe(true);
              await app.go('/home', { passcode: false });
              await S.quickPayOrder([{ cents: 6000, name: 'QP D05 A' }]);
              await app.pickStaff(vqEnv.testStaff2);
              await S.addQuickPay({ cents: 4000, name: 'QP D05 B' });
              const s = await payOtherWithTip('1000');
              const want = mode === 'evenly' ? [5, 5] : [6, 4];
              expect(staffTip(s, vqEnv.testStaff)).toBeCloseTo(want[0] ?? Number.NaN, 2);
              expect(staffTip(s, vqEnv.testStaff2)).toBeCloseTo(want[1] ?? Number.NaN, 2);
              await S.openSplitTip();
              expect(await selectedSplitTipTab()).toBe(mode === 'evenly' ? 'Split Evenly' : 'Proportion');
              expect(await S.tipValues()).toEqual(want);
              await P.clickQ(splitTipButton('Close'));
              await app.noReceipt();
            },
          );
        }
      } finally {
        await app.closeStrayDialogs().catch(() => undefined);
        if (/payment-success/.test(await app.path().catch(() => '')))
          await app.noReceipt().catch(() => undefined);
        const now = await readSplitTipMode().catch(() => '');
        if (now !== original) {
          await setSplitTipSetting(original).catch((e: unknown) =>
            note(`Restoring Split Tip Setting "${original}" failed: ${String(e)}`, 'cleanup'),
          );
        }
        await app.go('/home', { passcode: false }).catch(() => undefined);
      }
    },
  );
});

describe('volt-qc 05 SPLIT deep — Vietnamese', () => {
  before(() => {
    assertWritesAllowed('volt-qc 05 SPLIT deep (VI): pay split checks Cash / Other');
  });

  afterEach(async () => {
    await restoreEnglish();
    await afterEachCleanup();
  });

  it(
    title(
      'SPLIT-D06 Vietnamese: Split screen (Chia đều / Theo số tiền / Theo món, "Thanh toán đơn N"), check payment dialogs, success page "Trả bằng …" and "Chia tiền boa" modal show no English (SPLIT-112, SPLIT-113)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const id = await app.createOrder({ services: [vqEnv.testService] });
      await app.pickStaff(vqEnv.testStaff2);
      await app.addService(vqEnv.testService2);
      await ensureServiceLine(vqEnv.testService2);
      await waitUntil(
        async () => (await orderStaffNames()).join('|') === [vqEnv.testStaff, vqEnv.testStaff2].join('|'),
        5_000,
      );
      expect(await orderStaffNames()).toEqual([vqEnv.testStaff, vqEnv.testStaff2]);

      try {
        await setLanguage('vi');
        await openPendingAnyLang(id);
        await P.clickQ(VqpsHome.splitButton);
        await app.passcodeIfAsked(2_000);
        await app.waitPath(/\/split-order/, 15_000);
        await P.waitFor(inMain({ text: VI.chooseCheck, nth: 0 }), 15_000, VI.chooseCheck);

        await step(
          'SPLIT-112 Split screen: modes, "Chọn thanh toán đơn để trả", "Thanh toán đơn 1/2", "Thêm thanh toán đơn mới", "Chọn phương thức thanh toán"',
          async () => {
            const t = await app.text('main');
            for (const s of [
              VI.equally,
              VI.byAmount,
              VI.byItems,
              VI.chooseCheck,
              VI.check(1),
              VI.check(2),
              VI.addNewCheck,
              VI.choosePaymentMethod,
            ]) {
              expect(t).toContain(s);
            }
            expectNoEnglish(
              t,
              [
                'Equally',
                'By Amount',
                'By Items',
                'Choose the check to pay',
                /\bCheck \d/,
                'Add New Check',
                'Choose payment method',
              ],
              'Split screen',
            );
          },
        );

        await step(
          'SPLIT-112 pay Thanh toán đơn 1 in Tiền mặt (customer tips $2): "Hoàn tất Thanh toán đơn 1", "Thanh toán đơn 1 thành công" + "Còn 1 thanh toán đơn - tổng …"',
          async () => {
            await S.selectCheck(id, 1);
            await P.clickQ(inMain(btn(VI.cash, 0)));
            await P.clickQ(inMain(btnRe(`^${VI.pay}\\s*\\$[\\d,.]+$`, 0)));
            const cash = { role: 'dialog', hasCss: 'button', hasText: VI.completeCheck(1), nth: -1 } as const;
            await driveUntil(() => visible(cash));
            expectNoEnglish(await flat(cash), [/Complete Check/, 'Enter Amount', 'Change'], 'Cash dialog');
            await P.clickQ([cash, btn(VI.completeCheck(1))]);
            const paid = { role: 'dialog', name: VI.checkPaidTitle(1), nth: -1 } as const;
            await driveUntil(() => visible(paid), { customerTipCents: '200' });
            const t = await flat(paid);
            expect(t).toContain(VI.checksRemaining(1));
            expectNoEnglish(
              t,
              ['Paid Successfully', /\bchecks? remaining\b/i, 'Continue Payment'],
              'Paid-check dialog',
            );
            await P.clickQ([paid, btn(VI.continuePayment)]);
            await P.waitGoneQ(paid, 8_000);
            const row = await S.checkRowText(id, 1);
            note(`Paid check 1 row (VI): ${row}`);
            // DEV: the paid row on the Split screen uses global.paidWith ("Thanh toán bằng …").
            expect(row).toContain(VI.paidWith);
            expectNoEnglish(row, ['Paid with', 'Got'], 'Check 1 row');
          },
        );

        await step(
          'Thanh toán đơn 2 in Khác → "Đã hoàn tất tất cả thanh toán đơn" → Hoàn tất → "Hoàn tất - Xong" → success page "Thanh toán đơn N | Trả bằng …"',
          async () => {
            await S.selectCheck(id, 2);
            await P.clickQ(inMain(btn(VI.other, 0)));
            await P.clickQ(inMain(btnRe(`^${VI.pay}\\s*\\$[\\d,.]+$`, 0)));
            const other = { role: 'dialog', hasText: VI.otherPayment, nth: -1 } as const;
            await driveUntil(() => visible(other));
            await P.fillQ([other, { css: `input[placeholder="${VI.inputPaymentMethodName}"]` }], 'QC VI');
            await P.clickQ([other, btnRe(`^${VI.pay}\\s*\\$`, 0)]);
            const paid = { role: 'dialog', name: VI.checkPaidTitle(2), nth: -1 } as const;
            await driveUntil(() => visible(paid));
            expect(await flat(paid)).toContain(VI.allChecksPaid);
            await P.clickQ([paid, btn(VI.done)]);
            await P.clickQ(inMain(btn(VI.completeDone, 0)));
            await driveUntil(async () => /payment-success/.test(await app.path()));
            await P.waitFor({ text: VI.paymentSuccessful, nth: 0 }, 20_000, VI.paymentSuccessful);
            const s = await app.text('body');
            for (const x of [VI.check(1), VI.check(2), VI.paidBy(VI.cash), VI.paidBy(VI.other)])
              expect(s).toContain(x);
            expectNoEnglish(
              s,
              ['Payment Successful', /\bCheck \d/, 'Paid by', 'Total Tip', 'Split Tip'],
              'Success page',
            );
          },
        );

        await step(
          'SPLIT-113 "Chia tiền boa" modal: Tổng tiền boa, tabs Chia đều / Theo tỉ lệ / Thủ công, Xác nhận — no English',
          async () => {
            await P.clickQ(btn(VI.splitTip, 0));
            const dlg = { role: 'dialog', hasText: VI.totalTip, nth: -1 } as const;
            await P.waitFor(dlg, 8_000, VI.totalTip);
            const t = await flat(dlg);
            for (const x of [VI.splitTip, VI.totalTip, VI.splitEvenly, VI.proportion, VI.manual, VI.confirm])
              expect(t).toContain(x);
            expectNoEnglish(
              t,
              ['Split Tip', 'Total tip', 'Split Evenly', 'Proportion', 'Manual', 'Confirm'],
              'Split Tip modal',
            );
            await P.escape();
            await P.waitGoneQ(dlg, 8_000);
            await P.clickQ(btn(VI.noReceipt, 0));
            await waitUntil(async () => !/payment-success/.test(await app.path()), 15_000, 150);
            rememberOrderDay(id);
          },
        );
      } finally {
        await settleSplitAnyLang(id).catch((e: unknown) =>
          note(`Cleaning split ${id} failed: ${String(e)}`, 'cleanup'),
        );
        if (/payment-success/.test(await app.path().catch(() => ''))) {
          await P.clickQ(btnRe('^(No Receipt|Không hoá đơn)$', 0)).catch(() => undefined);
        }
        await restoreEnglish();
      }
    },
  );
});
