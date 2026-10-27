/**
 * volt-qc port — 04 PROMO "deep" flows (PROMO-D01..D07): discounts, points,
 * gift cards and their reports, Vietnamese labels.
 *
 * Source: volt-qc `e2e/tests/04-promo/promo-deep.spec.ts` (2026-10-12 batch).
 * Each case is one multi-step flow; report checks share the case so the
 * report cycle is awaited once. Prices are never hard-coded: the price model
 * (Service Fee on Card + Tax) is MEASURED (price.ts — Cash/Other/Gift Card =
 * base·(1+tax); gift-card lines carry no tax). Gift card = `VOLT_TEST_GIFT_CARD`;
 * transactions on one card are ≥ 11 s apart (VP-3761) and ledgers settle late
 * (bug #6) → waitGiftCardBalance.
 *
 * Writes: orders, payments, cancels, gift card top-ups/redeems (D05/D06 move
 * real balance on the test card), D06 activates a "Not Sold Yet" card
 * (`VOLT_GC_NEW_DEEP`, one per run), D07 flips the app language to Vietnamese
 * and back (Tag.EXCLUSIVE). Missing data → this.skip() with the reason.
 *
 * Known issues kept as in the source (expect.soft → expect, so they fail on DEV):
 * D02 (PROMO-025 Apply enabled on reopen), D03 (PROMO-127 card not blocked on
 * order B), D05 (bug #6 stale Current Balance, Daily Sale sale of top-ups),
 * D06 (bug #32 Card adds Service Fee on a gift card line).
 *
 * Not automated (as in the source): PROMO-094..097 (re-open locks money and the
 * customer field), preset promotions / rewards / cashback (Portal config).
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { VqcGiftCard, btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsCheckout } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { setLanguage } from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import { gcAdd, gcCodeBox, gcQuick } from '../../../../src/pages/voltqc/pos/giftCardProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { cashTotalOf, priceModel } from '../../../../src/pages/voltqc/promo-split/price.js';
import {
  POLL_TIMEOUT,
  VI,
  baseForCashTotal,
  besideLabel,
  c,
  cancelFromHistory,
  disabledSoon,
  driveUntil,
  eventually,
  expectNoEnglish,
  flat,
  gcLineCount,
  giftCardHistoryRows,
  giftCardState,
  incomeSummaryToday,
  methodButtonByLabel,
  note,
  openPendingAnyLang,
  ownDailyRows,
  payAnyLang,
  payHere,
  pollDailyRow,
  prices,
  proposedEnv,
  rememberOrderDay,
  reportDelta,
  sellGiftCard,
  successTotal,
  valueSoon,
  type GcReport,
} from '../../../../src/pages/voltqc/promo-split/promoDeepExtra.js';
import {
  applyPromo,
  attachExistingCustomer,
  checkoutBack,
  closeDialogX,
  createQuickPayOrder,
  customChecked,
  customDiscountSplit,
  customerEarnedPoints,
  fillCustom,
  giftCardCooldown,
  itemDialog,
  itemSave,
  markGiftCardUse,
  methodAmounts,
  openItemDialog,
  openPromo,
  payCurrentWithGiftCard,
  promoApply,
  promoDlg,
  promoInput,
  promoSplitInputs,
  readCustomerStats,
  setItemDiscountFields,
  settledGiftCardBalance,
  staffDiscountCharge,
  waitGiftCardBalance,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import * as S from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  app,
  field,
  money,
  pick,
  randomPhone,
  uniqueName,
  usd,
  vqEnv,
  waitUntil,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const NO_GC = 'VOLT_TEST_GIFT_CARD is not configured';
const GC = VqcGiftCard.dialog;

const verdict = (info: string, label: string): number =>
  money(new RegExp(`${label} \\| (\\$[\\d,.]+)`).exec(info)?.[1]);

describe('volt-qc 04 PROMO — deep: discounts, points, gift cards', () => {
  before(function (this: Mocha.Context): void {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create, pay and cancel orders; top up / redeem gift cards');
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders().catch(() => undefined);
  });

  it(
    title(
      'PROMO-D01 Deep discount on a 2-line order: item discount 0 blocked → 10%; Custom 0 / 100% / $ above the budget; $5 split Owner 40 / Staff 60 reloads; Other + tip → Order History, Daily Sale, staff Discount Charge (PROMO-021, PROMO-040)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { m, base } = await prices();
      const b = base[vqEnv.testService] ?? Number.NaN;
      const gross = b + 20; // real service + Quick Pay $20 (base)
      const itemOff = Math.round(b * 10) / 100; // 10% item discount on the line's base price
      const budget = Math.round((gross - itemOff) * 100) / 100; // what the order can still be discounted (discountMax)
      const dc0 = await staffDiscountCharge(vqEnv.testStaff); // staff Discount Charge today BEFORE the order
      const id = await app.createOrder();
      await S.addQuickPay({ cents: 2000, name: 'QC D01 QP' });

      await step(
        'PROMO-040 real service line: Apply Discount on, value 0 → "Discount amount must be greater than 0", Save disabled; 10% → Save',
        async () => {
          await openItemDialog(vqEnv.testService);
          const err = [itemDialog, { text: 'Discount amount must be greater than 0', nth: 0 }] as const;
          await setItemDiscountFields(itemDialog, '%', '5');
          await P.fillQ([itemDialog, { role: 'textbox', nth: -1 }], '0');
          expect(await eventually(() => P.has(err), 5_000)).toBe(true);
          expect(await disabledSoon(itemSave, true)).toBe(true);
          await P.fillQ([itemDialog, { role: 'textbox', nth: -1 }], '10');
          expect(await eventually(async () => !(await P.has(err)), 5_000)).toBe(true);
          expect(await disabledSoon(itemSave, false)).toBe(false);
          await P.clickQ(itemSave);
          await P.waitGoneQ(itemSave, 8_000, 'item editor');
          let itemLine = Number.NaN;
          await eventually(async () => {
            itemLine = pick(await app.text('main'), 'Item Discount');
            return Math.abs(itemLine + itemOff) < 0.005;
          }, 8_000);
          expect(itemLine).toBeCloseTo(-itemOff, 2);
          expect(await app.text('main')).toContain('10% OFF');
        },
      );

      await step(
        'PROMO-021 Custom % 0 then cleared: no red error, Custom Discount unticks itself, Apply disabled',
        async () => {
          await openPromo();
          await fillCustom('%', '0');
          await P.fillQ(promoInput, '');
          expect(await P.count([promoDlg, { css: 'p.text-destructive' }])).toBe(0);
          expect(await customChecked()).toBe(false);
          expect(await disabledSoon(promoApply, true)).toBe(true);
          await closeDialogX();
        },
      );

      await step(
        'Custom 100% on an order with item discount: Total $0.00, Card / Cash / Other $0.00',
        async () => {
          await openPromo();
          await fillCustom('%', '100');
          await applyPromo();
          const t = await app.orderTotals();
          expect(t.total).toBeCloseTo(0, 2);
          // VP-4375 (Promotion line = the part ACTUALLY applied, after item discount) is not on every build → the
          // current build may show the typed amount (−gross). With VP-4375 it must be −budget.
          if (Math.abs(t.promotion + gross) < 0.01)
            note(
              `Promotion 100% shows −${String(gross)} (typed) instead of −${String(budget)} — VP-4375 not on this build`,
              'observation',
            );
          else expect(t.promotion).toBeCloseTo(-budget, 2);
          await app.pay();
          const a = await methodAmounts();
          for (const k of ['Card', 'Cash', 'Other'] as const) expect(a[k]).toBeCloseTo(0, 2);
          await checkoutBack();
        },
      );

      await step(
        'Amount $ above the budget → error or the box clamps at the budget; then $5.00 + Owner 40 → Staff auto 60 → Apply',
        async () => {
          await openPromo();
          await fillCustom('$', '99999');
          const err = [promoDlg, { text: `Discount cannot exceed ${usd(budget)}`, nth: 0 }] as const;
          if (await P.has(err)) expect(await disabledSoon(promoApply, true)).toBe(true);
          // DEV: InputCurrency maxValue = discountMax → clamps as you type (as PROMO-G).
          else expect(await valueSoon(promoInput, usd(budget))).toBe(usd(budget));
          await P.fillQ(promoInput, '500');
          const { owner, staff } = await promoSplitInputs();
          await P.fillQ(owner, '40');
          expect(await valueSoon(staff, '60')).toBe('60');
          await applyPromo();
          const t = await app.orderTotals();
          expect(t.promotion).toBeCloseTo(-5, 2);
          expect(t.total).toBeGreaterThan(0); // Total = Subtotal − Item Discount − Promotion + Tax (> 0 only)
        },
      );

      await step(
        'Reopen the dialog: Custom ticked, tab Amount $, box $5.00, Owner 40 / Staff 60; close X changes nothing',
        async () => {
          await openPromo();
          expect(await customChecked()).toBe(true);
          expect(await P.attrOf([promoDlg, { role: 'tab', name: 'Amount $' }], 'aria-selected')).toBe('true');
          expect(await valueSoon(promoInput, '$5.00')).toBe('$5.00');
          const { owner, staff } = await promoSplitInputs();
          // VERIFY: the applied split is reloaded on open (parseCustomPromoSplitFromOrder).
          expect(await valueSoon(owner, '40')).toBe('40');
          expect(await valueSoon(staff, '60')).toBe('60');
          await closeDialogX();
          expect((await app.orderTotals()).promotion).toBeCloseTo(-5, 2);
        },
      );

      const net = Math.round((gross - itemOff - 5) * 100) / 100;
      let other = Number.NaN;
      await step(
        'Pay → Other = (base − item − promo)·(1+tax); cashier tip $2 → Payment Successful (Total Tip $2.00, staff - $2.00)',
        async () => {
          const r = await payHere(id, 'Other', { tipCents: '200' });
          other = r.amount;
          expect(other).toBeCloseTo(cashTotalOf(m, [net]), 1);
          expect(successTotal(r.success)).toBeCloseTo(other + 2, 2);
          expect(r.success).toContain('Total Tip: $2.00');
          expect(r.success).toContain(`${vqEnv.testStaff} - $2.00`);
          await app.noReceipt();
        },
      );

      await step(
        'Order History: Total Discount = item + promo, Tip $2.00, Total = Other + tip, service line "10% OFF -$x"',
        async () => {
          await app.openHistoryOrder(id);
          const d = await app.historyDetail(id);
          expect(field(d, 'Status')).toBe('Successful - Unsettled');
          expect(Math.abs(money(field(d, 'Total Discount')))).toBeCloseTo(itemOff + 5, 2);
          expect(money(field(d, 'Tip'))).toBeCloseTo(2, 2);
          expect(money(field(d, 'Total'))).toBeCloseTo(other + 2, 2);
          // order-history-detail-services.tsx: "<amountDiscount/price·100>% OFF" + "-$amountDiscount".
          expect(d).toContain('10% OFF');
          expect(d).toContain(`-${usd(itemOff)}`);
        },
      );

      await step(
        'Reports: Daily Sale (Tip $2, Total = Other + tip, Sale + Tax + Tip = Total); Staff Income Discount Charge +60% × $5',
        async () => {
          const [row] = await pollDailyRow(id, true);
          expect(row).toBeDefined();
          if (!row) return;
          expect(row.tip).toBeCloseTo(2, 2);
          expect(row.total).toBeCloseTo(other + 2, 2);
          expect(row.sale + row.tax + row.tip).toBeCloseTo(row.total, 2);
          let dc = Number.NaN;
          const grew = await waitUntil(
            async () => {
              dc = await staffDiscountCharge(vqEnv.testStaff).catch(() => Number.NaN);
              return dc - dc0 >= 2.995;
            },
            POLL_TIMEOUT,
            1_000,
          );
          note(`Discount Charge ${vqEnv.testStaff}: ${String(dc0)} → ${String(dc)}`);
          expect(grew).toBe(true); // Discount Charge must grow
          // VERIFY: the item discount is not charged to the staff (only the staff share of the promotion) → Δ exactly $3.00.
          expect(dc - dc0).toBeCloseTo(3, 2);
        },
      );
    },
  );

  // DEV (order-promo-rewards-dialog.tsx: canApply = mode "custom" && has a value) → reopening the dialog shows Apply ENABLED
  // although nothing changed, unlike TC PROMO-025 ("Apply disabled until something changes") — known issue.
  it(
    title(
      'PROMO-D02 Reopen Promo & Rewards after Custom 10%: preselected, tab %, box = 10, Apply disabled until changed; 15% → re-applied (PROMO-025)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await createQuickPayOrder([{ amount: 50, name: 'QC D02' }]);
      await customDiscountSplit('%', 10);
      expect((await app.orderTotals()).promotion).toBeCloseTo(-5, 2);
      await openPromo();
      expect(await customChecked()).toBe(true);
      expect(await P.attrOf([promoDlg, { role: 'tab', name: 'Percentage %' }], 'aria-selected')).toBe('true');
      expect(await valueSoon(promoInput, '10')).toBe('10');
      note(
        `PROMO-025 dev: Apply ${(await P.isDisabled(promoApply)) ? 'disabled' : 'ENABLED'} on reopen without changes`,
        'observation',
      );
      expect(await disabledSoon(promoApply, true, 2_000)).toBe(true); // PROMO-025: nothing changed → Apply must be disabled
      await P.fillQ(promoInput, '15');
      expect(await disabledSoon(promoApply, false)).toBe(false);
      await applyPromo();
      expect((await app.orderTotals()).promotion).toBeCloseTo(-7.5, 2);
      await openPromo();
      expect(await valueSoon(promoInput, '15')).toBe('15');
      await closeDialogX();
    },
  );

  // DEV: Quick Checkout calls resetAllOrderState() → clears the session's gift card list, so order B is NOT blocked
  // (PROMO-O2); TC PROMO-127 asserts the spec (one card per in-progress order) → known issue until PO confirms.
  it(
    title(
      'PROMO-D03 Same card on 2 orders: order A holds the card (unpaid), Quick Checkout order B → Sell Gift Card with the same code is blocked (PROMO-127)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn(NO_GC);
        this.skip();
      }
      this.timeout(6 * 60_000);
      const code = vqEnv.testGiftCard;
      const a = await sellGiftCard(code, { value: 25, fresh: true });
      const b = await app.createOrder(); // Quick Checkout → order B (staff + test service)
      await app.openSellGiftCard();
      await P.fillQ(gcCodeBox, code);
      await P.waitFor(
        [GC, { textRe: 'Balance: \\$|already been added', nth: 0 }],
        15_000,
        'gift card lookup',
      );
      await P.clickQ(gcQuick('$25'));
      const msg = [
        GC,
        {
          textRe:
            'This gift card has already been added in this order\\. Please edit the existing amount instead\\.',
          nth: 0,
        },
      ] as const;
      const blocked = await eventually(() => P.has(msg), 3_000);
      note(
        `PROMO-127: A ${a.id}, B ${b}: order B ${blocked ? 'BLOCKED' : 'STILL ALLOWS Add (Quick Checkout clears giftCardItems)'}`,
        'observation',
      );
      const addDisabled = await disabledSoon(gcAdd, true, 2_000);
      await P.clickQ([GC, btn('Close', 0)]); // no Add — order B has no gift card line
      await P.waitGoneQ(GC, 5_000).catch(() => undefined);
      expect(await gcLineCount(code)).toBe(0);
      expect(blocked).toBe(true); // PROMO-127: card on order A → order B must be blocked
      expect(addDisabled).toBe(true);
    },
  );

  it(
    title(
      'PROMO-D04 Points on cancel / re-open: new customer K pays Other → cancel keeps points (never negative); 2nd order Cash adds on; re-open finish again changes neither points nor visits (PROMO-098, PROMO-099)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(10 * 60_000);
      const phone = randomPhone();
      let id1 = '';
      let e1 = Number.NaN;
      let c1 = Number.NaN;

      await step(
        'Order 1: new customer K + test service → Other → customer display "You\'ve earned N points", current = N',
        async () => {
          id1 = await app.createOrder();
          await app.attachNewCustomer(phone, uniqueName('QC E2E'));
          await app.customerConfirmPhone().catch(() => undefined);
          await payHere(id1, 'Other');
          const p = await customerEarnedPoints();
          e1 = p.earned;
          c1 = p.current;
          expect(e1).toBeGreaterThan(0); // an order with a customer earns points
          expect(c1).toBe(e1); // new customer: current = just earned
          await app.noReceipt();
        },
      );

      // Local points sync periodically → wait until they match (≤ 40 s). Bug #39: points may NOT persist to the profile ("Point: 0").
      const s1 = await readCustomerStats(phone, c1, 40_000);
      const persisted = s1.points === c1;
      note(
        `K ***${phone.slice(-4)}: after order 1 POS Points ${String(s1.points)} / visits ${String(s1.visits)} (display ${String(c1)})`,
      );
      if (!persisted)
        note(
          `Bug #39: earned points (${String(c1)}) not saved to the profile (POS ${String(s1.points)}) — compare "unchanged" after cancel only`,
          'observation',
        );

      await step('PROMO-099 cancel order 1 (Cancel Order → reason → Confirm Cancel) → Canceled', async () => {
        await cancelFromHistory(id1);
      });

      await step('PROMO-099 K points unchanged, not negative (read twice)', async () => {
        for (let i = 0; i < 2; i += 1) {
          const s = await readCustomerStats(phone);
          expect(s.points).toBe(s1.points);
          expect(s.points).toBeGreaterThanOrEqual(0);
        }
      });

      let id2 = '';
      let s2 = { points: Number.NaN, visits: Number.NaN };
      await step(
        'Order 2 Cash for K: current = previous + new (cancelling order 1 deducts nothing later)',
        async () => {
          id2 = await app.createOrder();
          await attachExistingCustomer(phone);
          await payHere(id2, 'Cash');
          const p = await customerEarnedPoints();
          expect(p.earned).toBeGreaterThan(0);
          if (persisted) expect(p.current).toBe(s1.points + p.earned);
          else
            note(
              `Order 2: earned ${String(p.earned)}, current ${String(p.current)} (bug #39 — no add-up check)`,
              'observation',
            );
          await app.noReceipt();
          s2 = await readCustomerStats(phone, persisted ? s1.points + p.earned : undefined, 40_000);
          if (persisted) expect(s2.points).toBe(s1.points + p.earned);
        },
      );

      await step(
        'PROMO-098 re-open order 2 → Re-Open Done (no change): K points and visits unchanged',
        async () => {
          await app.reopenOrder(id2);
          await app.finishReopen();
          const s3 = await readCustomerStats(phone);
          note(
            `After re-open: points ${String(s2.points)} → ${String(s3.points)}, visits ${String(s2.visits)} → ${String(s3.visits)}`,
          );
          expect(s3.visits).toBe(s2.visits);
          expect(s3.points).toBe(s2.points);
        },
      );
    },
  );

  // Bug #6: the card verdict / Sell Gift Card sometimes shows the OLD balance right after a top-up → Current Balance step fails on the bug.
  it(
    title(
      'PROMO-D05 Gift card & reports: top up $50 Cash + $100 at 10% off (Cash $90) + service order paid fully by card → Income Summary (Gift Card Sale / Redemption), Daily Sale, card history; cancelling the card order restores the balance (PROMO-154, PROMO-184, PROMO-185)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn(NO_GC);
        this.skip();
      }
      this.timeout(12 * 60_000);
      const code = vqEnv.testGiftCard;
      const { m, base } = await prices();
      const b = base[vqEnv.testService] ?? Number.NaN;
      const need = cashTotalOf(m, [b]) + 5;

      // Report baseline BEFORE any transaction of this case (incl. a top-up when the card is short → added to the expected Gift Card Sale).
      const R0 = await incomeSummaryToday();
      let extra = 0;
      let B0 = await settledGiftCardBalance(code);
      if (!(B0 >= need)) {
        extra = Math.max(vqEnv.giftCardTopUp, Math.ceil(need - (Number.isFinite(B0) ? B0 : 0)) + 10);
        await giftCardCooldown();
        await app.topUpGiftCard(code, extra);
        markGiftCardUse();
        B0 = await waitGiftCardBalance(code, B0 + extra);
      }
      note(`Card ****${code.slice(-4)}: opening balance ${String(B0)} (extra top-up ${String(extra)})`);

      let s1 = '';
      let s2 = '';
      await step(
        'Order S1: top up $50 (no discount) → Cash $50.00 (gift cards carry no fee / tax)',
        async () => {
          const r = await sellGiftCard(code, { value: 50, fresh: true });
          s1 = r.id;
          expect(r.summary).toMatchObject({ value: 50, totalBalance: 50, customerPays: 50 });
          await giftCardCooldown();
          const p = await payHere(s1, 'Cash');
          markGiftCardUse();
          expect(p.amount).toBeCloseTo(50, 2);
          expect(successTotal(p.success)).toBeCloseTo(50, 2);
          await app.noReceipt();
        },
      );

      await step(
        'Order S2: top up $100 at 10% off → Customer Pays $90, Total Balance $100 → Cash $90.00',
        async () => {
          const r = await sellGiftCard(code, { value: 100, discount: { unit: '%', raw: '10' }, fresh: true });
          s2 = r.id;
          expect(r.summary).toMatchObject({ value: 100, totalBalance: 100, customerPays: 90 });
          await giftCardCooldown();
          const p = await payHere(s2, 'Cash');
          markGiftCardUse();
          expect(p.amount).toBeCloseTo(90, 2);
          await app.noReceipt();
        },
      );

      const B1 = await waitGiftCardBalance(code, B0 + 150, 90_000);
      expect(B1).toBeCloseTo(B0 + 150, 2); // + $50 + $100 (face value, not what the customer paid)

      let rid = '';
      let r = Number.NaN;
      await step(
        'Order R: test service paid fully by card (Gift Card price = base·(1+tax), no service fee)',
        async () => {
          rid = await app.createOrder();
          await app.pay();
          r = await app.methodAmount('Gift Card');
          expect(r).toBeCloseTo(cashTotalOf(m, [b]), 2);
          const info = await payCurrentWithGiftCard(code);
          // Bug #6: the verdict sometimes shows the OLD balance (before the top-ups).
          expect(verdict(info, 'Current Balance')).toBeCloseTo(B1, 2);
          expect(verdict(info, 'Amount Needed')).toBeCloseTo(r, 2);
          await app.waitSuccess();
          rememberOrderDay(rid);
          await app.noReceipt();
        },
      );
      const B2 = await waitGiftCardBalance(code, B1 - r, 90_000);
      expect(B2).toBeCloseTo(B1 - r, 2);

      await step(
        'PROMO-184 / PROMO-185 Income Summary today: Δ Gift Card Sale = paid ($140), Δ Gift Card Redemption = redeemed, Total Sale / Service Sale / Total Payment grow',
        async () => {
          let R1: GcReport = R0;
          const ok = await waitUntil(
            async () => {
              R1 = await incomeSummaryToday();
              const d = reportDelta(R0, R1);
              return c(d.gcSale) >= c(140 + extra) && c(d.gcRedemption) >= c(r);
            },
            POLL_TIMEOUT,
            1_000,
          );
          expect(ok).toBe(true); // Income Summary must show this case's Gift Card Sale / Redemption
          const d = reportDelta(R0, R1);
          note(`Income Summary Δ: ${JSON.stringify(d)}`);
          // NOTE TC: "Gift Card Sale counts what the customer pays ($90) or face value ($100)" — asserted per TC (customer pays).
          expect(c(d.gcSale)).toBe(c(140 + extra)); // PROMO-184
          expect(c(d.gcRedemption)).toBe(c(r)); // PROMO-185
          // VERIFY: Gift Card Redemption splits Sale (base) / Tax like the Cash group.
          expect(c(d.gcRedemptionSale)).toBe(c(b));
          expect(d.totalSale).toBeGreaterThanOrEqual(140 + extra + b - 0.005);
          expect(d.serviceSale).toBeGreaterThanOrEqual(b - 0.005);
          // VERIFY: shared merchant — other automation rarely sells products; Product Sale not moved by gift cards.
          expect(c(d.productSale)).toBe(0);
          expect(d.totalPayment).toBeGreaterThanOrEqual(140 + extra + r - 0.005);
        },
      );

      await step(
        'Daily Sale: order R Sale = base, Total = redeemed; top-up orders add nothing to Sale (TC PROMO-184 #4 / RPT-043)',
        async () => {
          const [row] = await pollDailyRow(rid, true);
          expect(row).toBeDefined();
          if (!row) return;
          expect(row.sale).toBeCloseTo(b, 2);
          expect(row.total).toBeCloseTo(r, 2);
          for (const sid of [s1, s2]) {
            const rows = await ownDailyRows(sid);
            note(`Daily Sale top-up order ${sid}: ${JSON.stringify(rows)}`);
            // VERIFY: RPT-T09b (2026-10-09) saw top-up rows with Sale = face value — TC (RPT-043 "to confirm") expects Sale $0.00.
            expect(rows.every((x) => c(x.sale) === 0)).toBe(true);
          }
        },
      );

      await step(
        'Card history (View Details): −R (order R), +$100 (S2), +$50 (S1), running balance after each row',
        async () => {
          await giftCardState(code);
          const rows = await giftCardHistoryRows();
          await app.closeStrayDialogs();
          note(`History: ${rows.map((x) => `${x.order} ${x.amount} → ${x.balance}`).join(' || ')}`);
          const at = (oid: string): (typeof rows)[number] | undefined => rows.find((x) => x.order === oid);
          expect(at(rid)?.value).toBeCloseTo(-r, 2);
          expect(at(s2)?.value).toBeCloseTo(100, 2); // face value $100, customer paid $90
          expect(at(s1)?.value).toBeCloseTo(50, 2);
          expect(at(rid)?.after).toBeCloseTo(B1 - r, 2);
          expect(at(s2)?.after).toBeCloseTo(B1, 2);
          expect(at(s1)?.after).toBeCloseTo(B0 + 50, 2);
        },
      );

      await step(
        'PROMO-154 cancel order R → "Order canceled successfully", Canceled, card balance back to B1',
        async () => {
          await giftCardCooldown(); // the REVERT is also a card transaction
          await cancelFromHistory(rid);
          markGiftCardUse();
          expect(await waitGiftCardBalance(code, B1, 90_000)).toBeCloseTo(B1, 2);
        },
      );
    },
  );

  // Needs a dedicated unused "Not Sold Yet" card (VOLT_GC_NEW_DEEP — NOT the PROMO-AD1 VOLT_GC_NEW, this case activates it).
  // Each run spends one card (→ Active), later runs skip until the code changes. Bug #32: Card adds Service Fee on gift card lines.
  it(
    title(
      'PROMO-D06 New card (VOLT_GC_NEW_DEEP): sell + bonus with a test-card top-up on one order → Active; pay exactly the balance → Used Up; Used Up cannot pay; top up → Active; split on 2 cards then cancel → each card refunded (PROMO-137, PROMO-145, PROMO-155, PROMO-175, PROMO-180, PROMO-181)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      const gcNew = proposedEnv('VOLT_GC_NEW_DEEP');
      if (!gcNew || !vqEnv.testGiftCard) {
        console.warn(
          'Needs VOLT_GC_NEW_DEEP (unused Not Sold Yet card — this case activates it) + VOLT_TEST_GIFT_CARD',
        );
        this.skip();
      }
      this.timeout(15 * 60_000);
      const code = vqEnv.testGiftCard;
      const m = await priceModel();
      const st0 = await giftCardState(gcNew);
      await app.closeStrayDialogs();
      if (st0.status !== 'Not Sold Yet') {
        console.warn(
          `VOLT_GC_NEW_DEEP card ****${gcNew.slice(-4)} is "${st0.status}" (used by an earlier run) — needs a new Not Sold Yet code`,
        );
        this.skip();
      }
      const B0 = await settledGiftCardBalance(code);

      let n1 = '';
      await step(
        'PROMO-137 / PROMO-175 one order: new card $100 + Bonus 10% (Total Balance $110) + test card $50 + Bonus $5 → 2 Store lines; Cash/Other $150, Gift Card blocked → Other',
        async () => {
          const a = await sellGiftCard(gcNew, { value: 100, bonus: { unit: '%', raw: '10' }, fresh: true });
          n1 = a.id;
          expect(a.summary).toMatchObject({ value: 100, bonus: 10, totalBalance: 110, customerPays: 100 });
          const t = await sellGiftCard(code, { value: 50, bonus: { unit: '$', raw: '500' } });
          expect(t.id).toBe(n1);
          expect(t.summary).toMatchObject({ value: 50, bonus: 5, totalBalance: 55, customerPays: 50 });
          expect(await gcLineCount(gcNew)).toBe(1);
          expect(await gcLineCount(code)).toBe(1);
          await app.pay();
          const amt = await methodAmounts();
          expect(amt.Cash).toBeCloseTo(150, 2);
          expect(amt.Other).toBeCloseTo(150, 2);
          expect(amt.Card).toBeCloseTo(150, 2); // Bug #32: Card must not add Service Fee on gift card lines
          expect(
            await P.has(
              inMain({
                text: 'Cannot use Gift Card to buy a Gift Card. Use another payment method.',
                nth: 0,
              }),
            ),
          ).toBe(true);
          await app.selectMethod('Other');
          await giftCardCooldown();
          await app.completePayment({ tip: 'none' });
          markGiftCardUse();
          expect(successTotal(await app.successText())).toBeCloseTo(150, 2);
          rememberOrderDay(n1);
          await app.noReceipt();
          expect(await waitGiftCardBalance(gcNew, 110, 90_000)).toBeCloseTo(110, 2); // new card: face + bonus
          expect((await giftCardState(gcNew)).status).toBe('Active');
          await app.closeStrayDialogs();
          expect(await waitGiftCardBalance(code, B0 + 55, 90_000)).toBeCloseTo(B0 + 55, 2); // test card: + $50 + bonus $5
        },
      );

      await step(
        'PROMO-181 order whose Gift Card price is exactly $110.00 paid with the new card: Accepted (no shortfall) → $0.00, Used Up, picking a preset enables Add',
        async () => {
          const qp = baseForCashTotal(m, 11000);
          if (qp === null) {
            console.warn(
              'Cannot build a Quick Pay with a Gift Card price of exactly $110.00 at the current tax',
            );
            this.skip();
          }
          const id = await S.quickPayOrder([{ cents: qp, name: 'QC D06 Exact' }]);
          await app.pay();
          expect(await app.methodAmount('Gift Card')).toBeCloseTo(110, 2);
          await giftCardCooldown();
          const res = await app.payWithGiftCard(gcNew);
          expect(res.info).toContain('Gift Card Accepted');
          expect(res.info).not.toContain('not Enough Balance');
          expect(verdict(res.info, 'Current Balance')).toBeCloseTo(110, 2);
          expect(verdict(res.info, 'Amount Needed')).toBeCloseTo(110, 2);
          await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
          await app.driveToSuccess('none');
          markGiftCardUse();
          await app.waitSuccess();
          rememberOrderDay(id);
          await app.noReceipt();
          expect(await waitGiftCardBalance(gcNew, 0, 90_000)).toBeCloseTo(0, 2);
          const st = await giftCardState(gcNew);
          expect(st.status).toBe('Used Up');
          await P.clickQ(gcQuick('$25'));
          expect(await disabledSoon(gcAdd, false)).toBe(false); // a Used Up card can be topped up
          await app.closeStrayDialogs();
        },
      );

      await step(
        'PROMO-145 $0.00 card on a new order → "Gift Card not Enough Balance"; Redeem & Add New Check creates no $0 transaction',
        async () => {
          const id = await app.createOrder();
          await app.pay();
          await giftCardCooldown();
          const res = await app.payWithGiftCard(gcNew);
          expect(res.info).toContain('Gift Card not Enough Balance');
          const redeem = [VqpsCheckout.gcResultDialog, btn('Redeem & Add New Check')] as const;
          if (await P.has(redeem)) await P.clickQ(redeem);
          else await P.clickQ([VqpsCheckout.gcResultDialog, btn('Cancel')]);
          await app.closeStrayDialogs();
          expect(await app.url()).toMatch(/checkout/);
          expect(money(/\| Total Paid \| (\$[\d,.]+)/.exec(await app.text('main'))?.[1])).toBeCloseTo(0, 2);
          await app.openPendingOrder(id);
          await app.deleteCurrentOrder();
          app.createdOrders.delete(id);
          expect((await giftCardState(gcNew)).balance).toBeCloseTo(0, 2);
          await app.closeStrayDialogs();
        },
      );

      await step(
        'PROMO-180 top up $25 on the Used Up card → Other $25.00 → Active, $25.00, history has +$25.00 with the order code',
        async () => {
          const t = await sellGiftCard(gcNew, { value: 25, fresh: true });
          await giftCardCooldown();
          const p = await payHere(t.id, 'Other');
          markGiftCardUse();
          expect(successTotal(p.success)).toBeCloseTo(25, 2);
          await app.noReceipt();
          expect(await waitGiftCardBalance(gcNew, 25, 90_000)).toBeCloseTo(25, 2);
          const st = await giftCardState(gcNew);
          expect(st.status).toBe('Active');
          const rows = await giftCardHistoryRows();
          await app.closeStrayDialogs();
          expect(rows.find((x) => x.order === t.id)?.value).toBeCloseTo(25, 2);
        },
      );

      await step(
        'PROMO-155 split order: check 1 new card, check 2 test card → cancel: Canceled (not stuck Canceling), each card refunded exactly',
        async () => {
          const bNew = 25;
          const bTest = await settledGiftCardBalance(code);
          const id = await app.createOrder();
          await S.openSplit();
          let g1 = Number.NaN;
          let g2 = Number.NaN;
          try {
            g1 = await S.methodPrice(id, 1, 'Gift Card');
            if (g1 > bNew) {
              console.warn(`Check 1 ($${String(g1)}) > new card balance $25`);
              this.skip();
            }
            await giftCardCooldown();
            await S.payCheck(id, 1, 'Gift Card', { giftCard: gcNew });
            markGiftCardUse();
            g2 = await S.methodPrice(id, 2, 'Gift Card');
            await giftCardCooldown();
            await S.payCheck(id, 2, 'Gift Card', { giftCard: code });
            markGiftCardUse();
            await S.completeDone();
            rememberOrderDay(id);
            await app.noReceipt();
          } finally {
            await S.settleSplit(id);
          }
          expect(await waitGiftCardBalance(gcNew, bNew - g1, 90_000)).toBeCloseTo(bNew - g1, 2);
          expect(await waitGiftCardBalance(code, bTest - g2, 90_000)).toBeCloseTo(bTest - g2, 2);
          await giftCardCooldown();
          await cancelFromHistory(id);
          markGiftCardUse();
          expect(await P.count(inMain({ text: 'Canceling' }))).toBe(0);
          expect(await waitGiftCardBalance(gcNew, bNew, 90_000)).toBeCloseTo(bNew, 2); // new card fully refunded
          expect(await waitGiftCardBalance(code, bTest, 90_000)).toBeCloseTo(bTest, 2); // test card fully refunded
        },
      );
    },
  );
});

describe('volt-qc 04 PROMO — deep: Vietnamese', () => {
  before(function (this: Mocha.Context): void {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create orders and switch the app language');
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await setLanguage('en').catch(() => undefined);
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders().catch(() => undefined);
  });

  // Switches Settings › Language (merchant-global) and ALWAYS restores English in finally. Orders are prepared in English.
  it(
    title(
      'PROMO-D07 Vietnamese: Promo & Rewards dialog translated (split-% error may stay English); "Thẻ quà tặng [****-****-xxxx]" line under "Cửa hàng" + gift-card-for-gift-card block message; not-enough-balance popup has no "check" (PROMO-164, PROMO-165, PROMO-166)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn(NO_GC);
        this.skip();
      }
      this.timeout(8 * 60_000);
      const code = vqEnv.testGiftCard;
      const bal = (await app.giftCardBalance(code)).balance;
      if (!(bal >= 0) || bal + 50 > 9_999.99) {
        console.warn(`Card balance ${String(bal)} too large to build an order above the balance`);
        this.skip();
      }
      const idP = await createQuickPayOrder([{ amount: 50, name: 'QC D07 Promo' }]);
      const g = await sellGiftCard(code, { value: 25, fresh: true });
      const idN = await createQuickPayOrder([
        { amount: Math.round((bal + 50) * 100) / 100, name: 'QC D07 Over' },
      ]);

      try {
        await setLanguage('vi');

        await step(
          'PROMO-165 "Khuyến mãi & Phần thưởng" dialog: Khuyến mãi, Giảm giá tuỳ chỉnh, Phần trăm % / Số tiền $, Thiết lập chia giảm giá khuyến mãi (owner / staff), Phần thưởng, Không có phần thưởng, Áp dụng',
          async () => {
            await openPendingAnyLang(idP);
            await P.clickQ(btn(VI.promoRewards, 0));
            const dlg = { role: 'dialog', hasText: VI.customDiscount, nth: -1 } as const;
            await P.waitFor(dlg, 10_000, VI.promoRewards);
            await P.clickQ(
              await besideLabel(
                VI.customDiscount,
                VI.customDiscount,
                '[role="checkbox"]',
                'data-vqps-vi-custom',
              ),
            );
            await P.clickQ([dlg, { role: 'tab', name: VI.percentageTab }]);
            await P.fillQ([dlg, { role: 'textbox', nth: 0 }], '10');
            await P.clickQ([dlg, { text: VI.orderPromoSetting, nth: 0 }]);
            await settle(300);
            const owner = await besideLabel(
              VI.customDiscount,
              VI.percentOwner,
              'input',
              'data-vqps-vi-owner',
            );
            expect(await eventually(() => P.has(owner), 5_000)).toBe(true);
            const t = await flat(dlg);
            for (const s of [
              VI.promoRewards,
              VI.promotions,
              VI.customDiscount,
              VI.percentageTab,
              VI.amountTab,
              VI.orderPromoSetting,
              VI.percentOwner,
              VI.percentStaff,
              VI.rewards,
              VI.noRewards,
              VI.apply,
            ]) {
              if (!t.includes(s)) console.warn(`VI dialog misses "${s}"`);
              expect(t).toContain(s);
            }
            expectNoEnglish(
              t,
              [
                'Promo & Rewards',
                'Promotions',
                'No promotions available',
                'Custom Discount',
                'Percentage',
                'Amount $',
                'Order promotion discount setting',
                'Percent for owner',
                'Percent for staff',
                'Rewards',
                'No rewards available',
                'Apply',
              ],
              'Promo & Rewards',
            );
            await P.fillQ(owner, '150');
            // TC: the split-% error is a hard-coded English string. DEV: the % box clamps at 100 (use-percent-input.ts) — observation only.
            const splitErr = await P.has([
              dlg,
              { text: 'Percent must be a whole number between 0 and 100', nth: 0 },
            ]);
            note(
              `PROMO-165 Owner 150: ${splitErr ? 'English error shown' : `no error, box = ${await P.inputValue(owner)}`}`,
              'observation',
            );
            await P.escape();
            expect(await eventually(async () => !(await P.has(dlg)), 5_000)).toBe(true);
          },
        );

        await step(
          'PROMO-164 gift card order: line "Thẻ quà tặng [****-****-xxxx]" under "Cửa hàng"; checkout block message in Vietnamese',
          async () => {
            await openPendingAnyLang(g.id);
            const t = await app.text('main');
            expect(t).toMatch(new RegExp(`${VI.giftCard} \\[\\*{4}-\\*{4}-${code.slice(-4)}\\]`));
            expect(t).toContain(VI.store); // VERIFY: the Store group title uses global.store ("Cửa hàng").
            expectNoEnglish(t, [/Gift Card \[/], 'Order panel');
            await payAnyLang();
            const ck = await app.text('main');
            expect(ck).toContain(VI.cannotUseGiftCard);
            expectNoEnglish(ck, ['Cannot use Gift Card'], 'Checkout of a gift card order');
          },
        );

        await step(
          'PROMO-166 not enough balance: "Thẻ quà tặng không đủ số dư", question + "Dùng số dư & Thêm thanh toán đơn mới" (no "check") → Huỷ, no transaction',
          async () => {
            await openPendingAnyLang(idN);
            await payAnyLang();
            await P.clickQ(methodButtonByLabel(VI.giftCard));
            await P.clickQ(inMain(btn(VI.completePayment, 0)));
            const input = btn(VI.inputGiftCardCode, 0);
            await driveUntil(() => P.has(input));
            await P.clickQ(input);
            const box = { role: 'dialog', hasCss: 'input', hasText: VI.confirm, nth: -1 } as const;
            await P.fillQ([box, { role: 'textbox', nth: 0 }], code);
            await P.clickQ([box, btn(VI.confirm, 0)]);
            const nb = { role: 'dialog', hasText: VI.notEnoughBalance, nth: -1 } as const;
            await P.waitFor(nb, 15_000, VI.notEnoughBalance);
            const t = await flat(nb);
            for (const s of [VI.notEnoughBalance, VI.redeemQuestion, VI.redeemAddNewCheck]) {
              if (!t.includes(s)) console.warn(`VI popup misses "${s}"`);
              expect(t).toContain(s);
            }
            expectNoEnglish(
              t,
              ['Gift Card not Enough Balance', 'Redeem', /\bcheck\b/i],
              'Not-enough-balance popup',
            );
            await P.clickQ([nb, btn(VI.cancel)]);
            await P.escape().catch(() => undefined);
            expect(await app.url()).toMatch(/checkout/);
          },
        );
      } finally {
        await setLanguage('en').catch(() => undefined);
      }
    },
  );
});
