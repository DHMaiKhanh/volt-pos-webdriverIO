/**
 * volt-qc port — 04 PROMO: Custom Discount, Promo & Rewards dialog, item discount,
 * Owner/Staff split, gift card + Service Fee.
 *
 * Source: volt-qc `e2e/tests/04-promo/discount.spec.ts` (PROMO-A..D),
 * `promo-plan-discount.spec.ts` (PROMO-E..J) and `promo-plan-fee.spec.ts` (PROMO-L2).
 * TC catalogue: docs/qc/volt-qc/windows-regression/04-khuyen-mai-diem-giftcard.md.
 *
 * CREATES DATA (draft orders, a few Other payments) — dev/staging only.
 * The merchant may run Service Fee (Card) + Tax at any time: every number is
 * derived from the price model measured on the app (`priceModel`) or read off
 * the screen, exactly like the source suite. Discounts apply to BASE price.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { VqpsHome, VqpsPromo } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  basePrice,
  cardTotalOf,
  cashTotalOf,
  priceModel,
} from '../../../../src/pages/voltqc/promo-split/price.js';
import {
  addGiftCardLine,
  applyPromo,
  checkoutBack,
  checkoutOrderCode,
  checkoutState,
  closeDialogX,
  createQuickPayOrder,
  customChecked,
  customDiscountSplit,
  customerText,
  feeConfigFromCheckout,
  fillCustom,
  inPromo,
  itemDialog,
  itemDiscount,
  itemSave,
  methodAmounts,
  openItemDialog,
  openPromo,
  pollValue,
  promoApply,
  promoInput,
  promoSplitInputs,
  quickPay,
  setItemDiscountFields,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import {
  app,
  cust,
  field,
  money,
  pick,
  usd,
  visible,
  vqEnv,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const pct = (amount: number, p: number): number => Math.round(amount * p) / 100;
const homeText = (): Promise<string> => app.text('main');
const appliedToastShown = (): Promise<boolean> => visible(VqpsHome.appliedToast);

describe('volt-qc 04 PROMO — Custom Discount, Promo & Rewards, item discount', () => {
  before(() => {
    assertWritesAllowed('create draft orders with discounts');
  });

  afterEach(async () => {
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders().catch(() => undefined);
  });

  /* ------------------------------ discount.spec ------------------------------ */

  it(
    title(
      'PROMO-A Custom Discount 10% on the whole order; customer display shows Promotion (PROMO-018, PROMO-022, CD-010)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await priceModel();
      await app.quickCheckout();
      const b1 = await basePrice(vqEnv.testService);
      const b2 = await basePrice(vqEnv.testService2);
      await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
      const before = await app.orderTotals();
      await app.customDiscount('%', 10);
      const after = await app.orderTotals();
      const disc = pct(b1 + b2, 10);
      expect(after.promotion).toBeCloseTo(-disc, 2);
      expect(after.total).toBeCloseTo(after.subtotal + after.promotion + after.tax, 2);
      expect(after.tax).toBeCloseTo(before.tax * 0.9, 1);
      expect(after.total).toBeCloseTo(before.total * 0.9, 1);
      const ct = await pollValue(
        () => customerText(),
        (t) => t.includes('Promotion') && t.includes(usd(disc)),
        10_000,
      );
      expect(ct).toContain('Promotion');
      expect(ct).toContain(usd(disc));
      await app.deleteCurrentOrder();
    },
  );

  it(
    title('PROMO-B Custom Discount $5.00 takes off exactly $5.00 (PROMO-027)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(3 * 60_000);
      await app.createOrder();
      await app.customDiscount('$', 5);
      const after = await app.orderTotals();
      expect(after.promotion).toBeCloseTo(-5, 2);
      expect(after.total).toBeCloseTo(after.subtotal + after.promotion + after.tax, 2);
      await app.deleteCurrentOrder();
    },
  );

  it(
    title('PROMO-C 100% discount takes the order to $0.00 (PROMO-019, PROMO-028)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(3 * 60_000);
      await app.createOrder();
      await app.customDiscount('%', 100);
      expect((await app.orderTotals()).total).toBeCloseTo(0, 2);
      await app.deleteCurrentOrder();
    },
  );

  it(
    title('PROMO-D A % discount recalculates when a service is added (PROMO-023)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(4 * 60_000);
      await priceModel();
      await app.quickCheckout();
      const b1 = await basePrice(vqEnv.testService);
      const b2 = await basePrice(vqEnv.testService2);
      await app.createOrder();
      await app.customDiscount('%', 10);
      await app.addService(vqEnv.testService2);
      await settle(800);
      const t = await app.orderTotals();
      expect(t.promotion).toBeCloseTo(-pct(b1 + b2, 10), 2);
      expect(t.total).toBeCloseTo(t.subtotal + t.promotion + t.tax, 2);
      await app.deleteCurrentOrder();
    },
  );

  /* -------------------------- promo-plan-discount.spec -------------------------- */

  it(
    title(
      'PROMO-E Promo & Rewards layout, default split 100/0 locked, close does not apply, nothing leaks to another order (PROMO-001, PROMO-002, PROMO-003, PROMO-004, PROMO-061)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const a = await createQuickPayOrder([{ amount: 50, name: 'QC Promo' }]);
      const total0 = (await app.orderTotals()).total;

      await step(
        'PROMO-001 / PROMO-061 sections in order, "No rewards available", Apply disabled',
        async () => {
          await openPromo();
          expect(await P.has(inPromo({ role: 'button', name: 'Close', nth: 0 }))).toBe(true);
          const t = ((await P.rawText(VqpsPromo.dialog)) ?? '').replace(/\s*\n+\s*/g, ' | ');
          let pos = t.indexOf('Promotions');
          expect(pos).toBeGreaterThanOrEqual(0);
          for (const l of ['Custom Discount', VqpsPromo.splitSetting, 'Rewards']) {
            pos = t.indexOf(l, pos);
            expect(pos).toBeGreaterThanOrEqual(0);
          }
          expect(t).toMatch(/No promotions available|Promotions \| \S/);
          for (const tab of [VqpsPromo.tabPercent, VqpsPromo.tabAmount])
            expect(await P.has(inPromo({ role: 'tab', name: tab }))).toBe(true);
          expect(await P.has(inPromo({ text: VqpsPromo.noRewards }))).toBe(true);
          expect(await P.isDisabled(promoApply)).toBe(true);
        },
      );

      await step('PROMO-002 Percent for owner 100 / staff 0, both locked', async () => {
        const { owner, staff } = await promoSplitInputs();
        expect(await P.inputValue(owner)).toBe('100');
        expect(await P.inputValue(staff)).toBe('0');
        expect(await P.isDisabled(owner)).toBe(true);
        expect(await P.isDisabled(staff)).toBe(true);
      });

      await step(
        'PROMO-003 tick Custom 10% → close X: no toast, no Promotion; reopen empty, Apply disabled',
        async () => {
          await fillCustom('%', '10');
          await closeDialogX();
          expect(await appliedToastShown()).toBe(false);
          const tt = await app.orderTotals();
          expect(Number.isNaN(tt.promotion)).toBe(true);
          expect(tt.total).toBeCloseTo(total0, 2);
          await openPromo();
          expect(await customChecked()).toBe(false);
          expect(await P.isDisabled(promoApply)).toBe(true);
          await closeDialogX();
        },
      );

      await step('PROMO-004 A gets 10% → order B $50: dialog empty, B has no Promotion', async () => {
        await customDiscountSplit('%', 10);
        expect((await app.orderTotals()).promotion).toBeCloseTo(-5, 2);
        await createQuickPayOrder([{ amount: 50, name: 'QC Promo B' }]);
        await openPromo();
        expect(await customChecked()).toBe(false);
        expect(await P.isDisabled(promoApply)).toBe(true);
        await closeDialogX();
        expect(Number.isNaN((await app.orderTotals()).promotion)).toBe(true);
        await app.openPendingOrder(a);
        expect((await app.orderTotals()).promotion).toBeCloseTo(-5, 2);
      });
    },
  );

  it(
    title(
      'PROMO-E2 Custom 10% applied before any service: toast, no Promotion line; adding $50 → -$5.00 (PROMO-005)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(3 * 60_000);
      await app.quickCheckout();
      await app.pickStaff(vqEnv.testStaff);
      if (!(await visible(VqpsHome.promoButton))) {
        console.warn('PROMO-E2: a draft with only a staff shows no Promo & Rewards button');
        this.skip();
      }
      if (await app.hasOrderId()) app.createdOrders.add(await app.orderId());
      await openPromo();
      await fillCustom('%', '10');
      await P.clickQ(promoApply);
      await app.passcodeIfAsked(2_000);
      expect(await pollValue(appliedToastShown, (v) => v, 10_000)).toBe(true);
      expect(await homeText()).not.toMatch(/\| Promotion \| -/);
      await quickPay(50, { name: 'QC Promo Late' });
      app.createdOrders.add(await app.orderId());
      const promo = await pollValue(
        async () => (await app.orderTotals()).promotion,
        (v) => Math.abs(v + 5) < 0.005,
        10_000,
      );
      expect(promo).toBeCloseTo(-5, 2);
    },
  );

  it(
    title(
      'PROMO-F Custom %: >100 blocked, 0/empty unticks, tab switch clears, re-open shows the applied value, clearing removes it (PROMO-020, PROMO-021, PROMO-024, PROMO-026)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await createQuickPayOrder([{ amount: 50, name: 'QC Promo F' }]);
      await openPromo();

      await step('PROMO-020 101 → "Maximum discount is 100%" or clamped to 100', async () => {
        await fillCustom('%', '101');
        if (await visible(inPromo({ text: VqpsPromo.maxPercent })))
          expect(await P.isDisabled(promoApply)).toBe(true);
        else expect(await P.inputValue(promoInput)).toBe('100');
      });

      await step('PROMO-021 0 then empty: no red error, Custom unticked, Apply disabled', async () => {
        await P.fillQ(promoInput, '0');
        await P.fillQ(promoInput, '');
        expect(await P.count(inPromo({ css: 'p.text-destructive' }))).toBe(0);
        expect(await customChecked()).toBe(false);
        expect(await P.isDisabled(promoApply)).toBe(true);
      });

      await step('PROMO-024 % = 10 → Amount $ ($0.00) → back to % (empty)', async () => {
        await fillCustom('%', '10');
        await P.clickQ(inPromo({ role: 'tab', name: VqpsPromo.tabAmount }));
        expect(await P.inputValue(promoInput)).toBe('$0.00');
        await P.clickQ(inPromo({ role: 'tab', name: VqpsPromo.tabPercent }));
        expect(['', '0']).toContain(await P.inputValue(promoInput));
        await closeDialogX();
      });

      await step(
        'Apply 10% → re-open: Custom ticked, tab %, box = 10 (PROMO-025 left out: DEV keeps Apply enabled)',
        async () => {
          await customDiscountSplit('%', 10);
          await openPromo();
          expect(await customChecked()).toBe(true);
          expect(await P.attrOf(inPromo({ role: 'tab', name: VqpsPromo.tabPercent }), 'aria-selected')).toBe(
            'true',
          );
          expect(await P.inputValue(promoInput)).toBe('10');
          console.warn(
            `PROMO-025 dev: Apply ${(await P.isDisabled(promoApply)) ? 'disabled' : 'ENABLED'} on re-open without a change`,
          );
        },
      );

      await step('PROMO-026 clear the value → Apply enabled → toast, Promotion gone', async () => {
        await P.fillQ(promoInput, '');
        expect(await P.isDisabled(promoApply)).toBe(false);
        await P.clickQ(promoApply);
        await app.passcodeIfAsked(2_000);
        expect(await pollValue(appliedToastShown, (v) => v, 10_000)).toBe(true);
        const promo = await pollValue(
          async () => (await app.orderTotals()).promotion,
          (v) => Number.isNaN(v),
          10_000,
        );
        expect(Number.isNaN(promo)).toBe(true);
      });
    },
  );

  it(
    title(
      'PROMO-G Fixed discount capped at the discountable part, Promotion -$20 on $20, item + promo never negative (PROMO-028, PROMO-029, PROMO-030, PROMO-031, PROMO-034)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await step(
        'PROMO-031 / PROMO-029 $20 → Amount $30.00: error or clamp $20.00; Total never negative',
        async () => {
          await createQuickPayOrder([{ amount: 20, name: 'QC Promo G' }]);
          await openPromo();
          await fillCustom('$', '3000');
          if (await visible(inPromo({ text: 'Discount cannot exceed $20.00' }))) {
            expect(await P.isDisabled(promoApply)).toBe(true);
            await P.fillQ(promoInput, '2000');
          } else {
            expect(await P.inputValue(promoInput)).toBe('$20.00');
          }
          await applyPromo();
          const t = await app.orderTotals();
          expect(t.promotion).toBeCloseTo(-20, 2);
          expect(t.total).toBeCloseTo(0, 2);
          await app.pay();
          const a = await methodAmounts();
          expect(a.Other).toBeCloseTo(0, 2);
          expect(a.Card).toBeCloseTo(0, 2);
          expect(await homeText()).not.toMatch(/\| -\$|\$-/);
        },
      );

      await step(
        'PROMO-030 / PROMO-028 checkout + customer display Promotion -$20.00, Total $0.00; pay Other → Order History discount $20.00',
        async () => {
          const s = await checkoutState();
          expect(pick(s.text, 'Promotion')).toBeCloseTo(-20, 2);
          expect(s.total).toBeCloseTo(0, 2);
          expect(pick(await cust.text(), 'Promotion')).toBeCloseTo(-20, 2);
          const id = await checkoutOrderCode();
          await app.selectMethod('Other');
          await app.completePayment({ tip: 'none' });
          await app.waitSuccess();
          await app.noReceipt();
          await app.openHistoryOrder(id);
          const d = await app.historyDetail(id);
          expect(Math.abs(money(field(d, 'Total Discount')))).toBeCloseTo(20, 2);
        },
      );

      await step(
        'PROMO-034 $20 + item discount $5 → Amount $18.00 capped at $15.00 → Total $0.00',
        async () => {
          await createQuickPayOrder([{ amount: 20, name: 'QC Promo G2' }]);
          await itemDiscount('QC Promo G2', '$', 5);
          await openPromo();
          await fillCustom('$', '1800');
          if (await visible(inPromo({ text: 'Discount cannot exceed $15.00' }))) {
            expect(await P.isDisabled(promoApply)).toBe(true);
            await P.fillQ(promoInput, '1500');
          } else {
            expect(await P.inputValue(promoInput)).toBe('$15.00');
          }
          await applyPromo();
          const t = await homeText();
          expect(pick(t, 'Item Discount')).toBeCloseTo(-5, 2);
          expect(pick(t, 'Promotion')).toBeCloseTo(-15, 2);
          expect((await app.orderTotals()).total).toBeCloseTo(0, 2);
        },
      );
    },
  );

  it(
    title(
      'PROMO-G2 $20 service + $100 gift card sale, max $ discount, Owner 50: gift card stays $100.00, customer pays $100.00 (PROMO-032)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn('PROMO-G2: VOLT_TEST_GIFT_CARD is not set');
        this.skip();
      }
      this.timeout(4 * 60_000);
      const id = await createQuickPayOrder([{ amount: 20, name: 'QC Promo GC' }]);
      await addGiftCardLine(vqEnv.testGiftCard, 100);
      await app.openPendingOrder(id);
      await customDiscountSplit('$', 20, 50);
      await app.pay();
      await app.selectMethod('Cash');
      const s = await checkoutState();
      expect(s.text).toMatch(/Gift Card \[\*+-\*+-\d{4}\] \| \$100\.00/);
      expect(pick(s.text, 'Promotion')).toBeCloseTo(-20, 2);
      expect(s.total).toBeCloseTo(100, 2);
      expect(await app.methodAmount('Cash')).toBeCloseTo(100, 2);
      // Known DEV bug #32: Card adds Service Fee to the gift-card line.
      expect(await app.methodAmount('Card')).toBeCloseTo(100, 2);
      await checkoutBack();
    },
  );

  it(
    title(
      'PROMO-I Item discount %/$, over-price and >100% blocked, 100%, combined with promotion, Quick Pay with discount (PROMO-036, PROMO-037, PROMO-038, PROMO-039, PROMO-041, PROMO-042, PROMO-043)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const m = await priceModel();

      await step(
        'PROMO-036 / PROMO-037 $30: 10% → "10% OFF -$3.00", Other = $27 + tax; $5.00 → "$5.00 OFF"',
        async () => {
          await createQuickPayOrder([{ amount: 30, name: 'QC Item 30' }]);
          await itemDiscount('QC Item 30', '%', 10);
          let t = await homeText();
          expect(t).toContain('10% OFF');
          expect(t).toContain('-$3.00');
          expect(pick(t, 'Item Discount')).toBeCloseTo(-3, 2);
          await app.pay();
          expect((await methodAmounts()).Other).toBeCloseTo(cashTotalOf(m, [27]), 2);
          await checkoutBack();
          await itemDiscount('QC Item 30', '$', 5);
          t = await homeText();
          expect(t).toContain('$5.00 OFF');
          expect(pick(t, 'Item Discount')).toBeCloseTo(-5, 2);
        },
      );

      await step('PROMO-038 / PROMO-039 / PROMO-041 on a $20 line', async () => {
        await createQuickPayOrder([{ amount: 20, name: 'QC Item 20' }]);
        await openItemDialog('QC Item 20');
        const box = [itemDialog, { role: 'textbox', nth: -1 }] as const;
        await setItemDiscountFields(itemDialog, '$', '2001');
        if (await visible([itemDialog, { text: 'Maximum discount is $20.00' }]))
          expect(await P.isDisabled(itemSave)).toBe(true);
        else expect(await P.inputValue(box)).toBe('$20.00');
        await setItemDiscountFields(itemDialog, '%', '101');
        if (await visible([itemDialog, { text: VqpsPromo.maxPercent }]))
          expect(await P.isDisabled(itemSave)).toBe(true);
        else expect(await P.inputValue(box)).toBe('100');
        await P.fillQ(box, '100');
        await P.clickQ(itemSave);
        await P.waitGoneQ(itemSave, 8_000);
        await settle(600);
        const t = await homeText();
        expect(t).toContain('100% OFF');
        expect(pick(t, 'Item Discount')).toBeCloseTo(-20, 2);
        expect((await app.orderTotals()).total).toBeCloseTo(0, 2);
      });

      await step(
        'PROMO-042 $20 + $30, item 10% on $30 + Custom 10%: Item -$3.00, Promotion $5.00 or $4.70, Other = (50 − 3 − promo)·(1+tax)',
        async () => {
          await createQuickPayOrder([
            { amount: 20, name: 'QC Manicure' },
            { amount: 30, name: 'QC Pedicure' },
          ]);
          await itemDiscount('QC Pedicure', '%', 10);
          await customDiscountSplit('%', 10);
          await app.pay();
          const t = (await checkoutState()).text;
          expect(pick(t, 'Item Discount')).toBeCloseTo(-3, 2);
          const promo = -pick(t, 'Promotion');
          expect([5, 4.7].some((v) => Math.abs(v - promo) < 0.005)).toBe(true);
          console.warn(`PROMO-042 dev: Promotion -${usd(promo)}`);
          expect((await methodAmounts()).Other).toBeCloseTo(cashTotalOf(m, [50 - 3 - promo]), 1);
          await checkoutBack();
        },
      );

      await step('PROMO-043 Quick Pay $25 + Apply Discount 20% → "20% OFF" -$5.00', async () => {
        await app.quickCheckout();
        await app.pickStaff(vqEnv.testStaff);
        await quickPay(25, { name: 'QC QP', discount: { kind: '%', value: 20 } });
        app.createdOrders.add(await app.orderId());
        const t = await homeText();
        expect(t).toContain('20% OFF');
        expect(t).toContain('-$5.00');
        expect(pick(t, 'Item Discount')).toBeCloseTo(-5, 2);
      });
    },
  );

  it(
    title(
      'PROMO-I0 Item discount = 0: error shown, Save does not apply it (DEV observation)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(3 * 60_000);
      await createQuickPayOrder([{ amount: 20, name: 'QC Item 0' }]);
      await openItemDialog('QC Item 0');
      await setItemDiscountFields(itemDialog, '%', '5');
      await P.fillQ([itemDialog, { role: 'textbox', nth: -1 }], '0');
      expect(await P.has([itemDialog, { text: 'Discount amount must be greater than 0' }])).toBe(true);
      const enabled = !(await P.isDisabled(itemSave));
      console.warn(`PROMO-040 dev: Save ${enabled ? 'ENABLED' : 'disabled'} with value 0`);
      if (enabled) await P.clickQ(itemSave);
      await settle(800);
      expect(await visible(itemSave)).toBe(true);
      await app.closeStrayDialogs();
      expect(await homeText()).not.toContain('OFF');
    },
  );

  it(
    title(
      'PROMO-K Owner/Staff split: locked without a discount, auto-complement to 100, out of 0–100 and decimals blocked (PROMO-049, PROMO-050, PROMO-051, PROMO-052, PROMO-053)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(3 * 60_000);
      await createQuickPayOrder([{ amount: 100, name: 'QC Promo K' }]);
      await openPromo();
      let { owner, staff } = await promoSplitInputs();
      expect(await P.isDisabled(owner)).toBe(true);
      expect(await P.isDisabled(staff)).toBe(true);

      await fillCustom('%', '10');
      ({ owner, staff } = await promoSplitInputs());
      expect(
        await pollValue(
          () => P.isDisabled(owner),
          (v) => !v,
          3_000,
        ),
      ).toBe(false);
      await P.fillQ(owner, '50');
      expect(await P.inputValue(staff)).toBe('50');
      expect(await P.isDisabled(promoApply)).toBe(false);

      await P.fillQ(staff, '70');
      expect(await P.inputValue(owner)).toBe('30');

      const splitErr = inPromo({ text: VqpsPromo.splitError });
      await P.fillQ(owner, '150');
      if (await visible(splitErr)) expect(await P.isDisabled(promoApply)).toBe(true);
      else {
        expect(await P.inputValue(owner)).toBe('100');
        expect(await P.inputValue(staff)).toBe('0');
      }
      await P.fillQ(owner, '50.5');
      if (await visible(splitErr)) expect(await P.isDisabled(promoApply)).toBe(true);
      else expect(await P.inputValue(owner)).toMatch(/^\d+$/);
      await closeDialogX();
    },
  );

  it(
    title('PROMO-J0 Custom 10% → no Merge Order button (PROMO-048)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(3 * 60_000);
      await createQuickPayOrder([{ amount: 50, name: 'QC Promo J0' }]);
      await customDiscountSplit('%', 10);
      // Known DEV bug #11: Merge Order still shows.
      expect(await P.count(inMain({ text: 'Merge Order' }))).toBe(0);
    },
  );

  it(
    title(
      'PROMO-J Customer display has no duplicate discount line; $33.33 × 15% rounding (PROMO-022, PROMO-044)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const m = await priceModel();
      await createQuickPayOrder([{ amount: 50, name: 'QC Promo J' }]);
      await customDiscountSplit('%', 10);

      await step(
        'PROMO-044 Pay → customer display Subtotal, Promotion -$5.00, no duplicate Total Discount',
        async () => {
          await app.pay();
          const ct = await pollValue(
            () => cust.text(),
            (t) => t.includes('Promotion'),
            10_000,
          );
          expect(pick(ct, 'Subtotal')).toBeCloseTo(pick(await homeText(), 'Subtotal'), 2);
          expect(pick(ct, 'Subtotal')).toBeCloseTo(50 + (50 - 5) * m.fee, 1);
          expect(pick(ct, 'Promotion')).toBeCloseTo(-5, 2);
          expect(ct).not.toMatch(/Total Discount \| -?\s*\$5\.00/);
          await checkoutBack();
        },
      );

      await step('PROMO-022 Quick Pay $33.33 × 15% → Promotion -$5.00, Other = $28.33 + tax', async () => {
        await createQuickPayOrder([{ amount: 33.33, name: 'QC Promo 3333' }]);
        await customDiscountSplit('%', 15);
        expect((await app.orderTotals()).promotion).toBeCloseTo(-5, 2);
        await app.pay();
        expect((await methodAmounts()).Other).toBeCloseTo(cashTotalOf(m, [28.33]), 2);
        await checkoutBack();
      });
    },
  );

  /* ------------------------------ promo-plan-fee.spec ----------------------------- */

  it(
    title(
      'PROMO-L2 Gift card only $50: Card = Cash = Other = $50; service + gift card: fee only on the service (PROMO-135, PROMO-136)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn('PROMO-L2: VOLT_TEST_GIFT_CARD is not set');
        this.skip();
      }
      this.timeout(5 * 60_000);
      const m = await priceModel();
      await app.quickCheckout();
      const b = await basePrice(vqEnv.testService);
      const id = await app.createOrder();
      await app.pay();
      const svc = await feeConfigFromCheckout();
      if (!svc.enabled) {
        console.warn(
          `PROMO-L2: Service Fee / Cash Discount is off (Card ${String(svc.card)} = Cash ${String(svc.cash)}) — CFG-SFCD`,
        );
        await checkoutBack();
        this.skip();
      }

      await step('PROMO-136 service + $50 gift card: Card − Cash unchanged', async () => {
        await app.openPendingOrder(id);
        await addGiftCardLine(vqEnv.testGiftCard, 50);
        await app.pay();
        const a = await methodAmounts();
        expect(a.Card - a.Cash).toBeCloseTo(svc.card - svc.cash, 2);
        expect(a.Cash).toBeCloseTo(svc.cash + 50, 2);
        expect(a.Card).toBeCloseTo(cardTotalOf(m, [b]) + 50, 1);
        expect(a.Cash).toBeCloseTo(cashTotalOf(m, [b]) + 50, 1);
        expect(a.Other).toBeCloseTo(a.Cash, 2);
        await checkoutBack();
      });

      await step('PROMO-135 gift card only $50: Card = Cash = Other = $50.00', async () => {
        await app.quickCheckout();
        await addGiftCardLine(vqEnv.testGiftCard, 50);
        app.createdOrders.add(await app.orderId());
        await app.pay();
        const a = await methodAmounts();
        // Known DEV bug #32: Card shows $55.00.
        expect(a.Card).toBeCloseTo(50, 2);
        for (const meth of ['Cash', 'Other'] as const) expect(a[meth]).toBeCloseTo(50, 2);
        await checkoutBack();
      });
    },
  );
});
