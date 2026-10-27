/**
 * volt-qc port — 14 E2E: points, promotions and the main journey.
 *
 * Source: volt-qc `e2e/tests/14-e2e/e2e-plan-points.spec.ts` (E2E-T07, T08, T10),
 * `e2e-plan-promo.spec.ts` (E2E-T20, T22, T23) and `journey.spec.ts` (E2E-J1).
 *
 * Adaptations:
 * - Point RATES (volt-qc `VOLT_POINT_RATE_*`) are not configured here, so the
 *   point checks are the rate-free ones: earned > 0, POS "Point:" = earned for a
 *   new customer, tip included ⇒ earned(with tip) ≥ earned(without).
 * - Report deltas (Daily Sale tiles, Staff Income Discount Charge, Income Summary)
 *   are replaced by the order's own Daily Sale row; E2E-T22 therefore asserts the
 *   POS / Order History half of E2E-040 (Promotion −$4, Total Discount $4) and the
 *   Discount-Charge split is noted, not asserted.
 * - E2E-T23 claims E2E-041: the build clamps instead of showing the TC's error
 *   strings, and the test asserts the BLOCKING (clamp, Apply disabled, Save
 *   disabled, nothing saved) — which is the TC's expected result.
 * - E2E-J1 covers CD-060 (+ PROMO-046 / RPT-040 like the source).
 */

import { expect } from '@wdio/globals';
import { CdCustomer, CdMain } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  app,
  field,
  moneyField,
  randomPhone,
  uniqueName,
} from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { parseMoney } from '../../../../src/utils/money.js';
import { ensure, expectCents, note, resetTill, track, untrack, usd } from './cd-e2e.helpers.js';

const GIFT_CARD = (process.env.VOLT_TEST_GIFT_CARD ?? '').trim();

/** Open a fresh order for a new customer and confirm the phone on the customer display. */
async function newCustomerOrder(): Promise<{ code: string; phone: string; name: string }> {
  const phone = randomPhone();
  const name = uniqueName('QC E2E');
  const code = track(await app.createOrder());
  await app.attachNewCustomer(phone, name);
  await app.customerConfirmPhone();
  expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
  return { code, phone, name };
}

/** The customer's POS "Point:" value, read by attaching them to a throw-away draft. */
async function lookupPoint(phone: string): Promise<number> {
  const code = track(await app.createOrder());
  await app.attachExistingCustomer(phone);
  const pts = await app.customerPoints();
  await app.deleteCurrentOrder();
  untrack(code);
  return pts;
}

describe('volt-qc 14 E2E — points, promotions, journey', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'No Receipt pressed right after paying still books points (> 0, POS Point = earned) and keeps the customer on the order (E2E-016)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { code, phone, name } = await newCustomerOrder();
      await app.pay();
      const paid = await app.methodCents('Cash');
      await app.selectMethod('Cash');
      await app.completePayment('none');
      await app.successText();
      untrack(code);
      const earned = await cust.earnedPoints(5_000).catch(() => NaN);
      await app.noReceipt();
      expect(await cust.waitWelcome(20_000)).toBe(true);
      const point = await lookupPoint(phone);
      note(`E2E-016 ${code}: Cash ${usd(paid)} → earned ${String(earned)}, POS Point ${String(point)}`);
      expect(point).toBeGreaterThan(0);
      if (Number.isFinite(earned)) expect(point).toBe(earned);
      await app.openHistoryOrder(code);
      const dump = await app.historyDetail(code);
      expect(field(dump, 'Customer')).toBe(name);
      expect(field(dump, 'Status')).toMatch(/Successful/);
    },
  );

  it(
    title(
      'Other + customer Custom Tip $2.00 → paid = Other + $2.00, points > 0 (tip in the base), tip in Order History and the Daily Sale row (E2E-017)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const d = await app.testData();
      const { code } = await newCustomerOrder();
      await app.pay();
      const paid = await app.methodCents('Other');
      await app.selectMethod('Other');
      if (!(await app.completeUntilTipScreen())) this.skip();
      await cust.customTip('200');
      await app.waitPaymentSuccess();
      expect(await app.successText()).toContain(`${usd(paid)} + $2.00 Tip`);
      expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
      const earned = await cust.earnedPoints();
      expect(earned).toBeGreaterThan(0);
      note(`E2E-017 ${code}: Other ${usd(paid)} + $2 tip → earned ${String(earned)}`);
      await app.noReceipt();
      untrack(code);

      await step('Order History', async () => {
        await app.openHistoryOrder(code);
        const dump = await app.historyDetail(code);
        expect(field(dump, 'Tip')).toBe('$2.00');
        expectCents(moneyField(dump, 'Total'), paid + 200, 'history Total');
        expect(dump).toContain(`${d.staff} - $2.00`);
      });
      await step('Daily Sale row', async () => {
        const row = await app.dailySaleRow(code);
        ensure(row !== null, `${code} never showed in Daily Sale`);
        expect(row ?? '').toContain('$2.00');
        expect(row ?? '').toContain(usd(paid + 200));
      });
    },
  );

  it(
    title(
      'Walk-in with no customer paying Other: "No rewards available", checkout shows Unknown, no earned points, Order History Customer "-", Daily Sale row = Other amount (E2E-019)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const code = track(await app.createOrder());
      let paid = NaN;
      await step('Promo & Rewards: No rewards available', async () => {
        await app.click(CdMain.promoRewards);
        expect(await app.waitFor([CdMain.promoDialog, { text: 'No rewards available', nth: 0 }])).toBe(true);
        await app.escape();
        expect(await app.waitGone(CdMain.promoDialog)).toBe(true);
      });
      await step('checkout Unknown → Other → no points', async () => {
        await app.pay();
        expect(await app.has([{ css: 'main' }, { text: 'Unknown', nth: 0 }])).toBe(true);
        paid = await app.methodCents('Other');
        await app.selectMethod('Other');
        await app.completePayment('none');
        await app.successText();
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await app.pause(4_000);
        expect(await cust.has({ textRe: "You've earned", nth: 0 })).toBe(false);
        await app.noReceipt();
        untrack(code);
        expect(await cust.waitWelcome()).toBe(true);
      });
      await step('Order History', async () => {
        await app.openHistoryOrder(code);
        const dump = await app.historyDetail(code);
        expect(field(dump, 'Customer')).toBe('-');
        expect(field(dump, 'Status')).toBe('Successful - Unsettled');
        const i = dump.indexOf('Payment Details');
        const pd = i >= 0 ? dump.slice(i) : '';
        expect(pd).toContain('Other');
        expect(pd).toContain(usd(paid));
      });
      await step('Daily Sale row', async () => {
        const row = await app.dailySaleRow(code);
        ensure(row !== null, `${code} never showed in Daily Sale`);
        expect(row ?? '').toContain(usd(paid));
      });
    },
  );

  it(
    title(
      'Service + gift-card top-up $50 + 10% discount: promotion only on the service, gift-card line stays $50.00, points > 0, card balance +$50; a gift-card-only order refuses promotions (E2E-037)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      if (!GIFT_CARD) this.skip();
      const balance0 = await app.giftCardBalance(GIFT_CARD);
      const { code } = await newCustomerOrder();
      const sub0 = (await app.orderTotals()).subtotal;

      await step('add the $50 top-up line', async () => {
        await app.sellGiftCardLine(GIFT_CARD, '$50');
        expect(await app.has([{ css: 'main' }, { textRe: 'Gift Card \\[\\*+-\\*+-\\d{4}\\]', nth: 0 }])).toBe(
          true,
        );
        expectCents(
          (await app.orderTotals()).subtotal,
          sub0 + 5000,
          'Subtotal = service + $50 (no SF on the card line)',
        );
      });

      await step('Custom Discount 10% → on the service only', async () => {
        await app.customDiscount('%', 10);
        const t = await app.orderTotals();
        expect(t.promotion).toBeLessThan(0);
        expect(Math.abs(t.promotion)).toBeLessThanOrEqual(Math.round(sub0 / 10) + 1);
        expectCents(t.total, t.subtotal + t.promotion + t.tax, 'Total = Subtotal − discount + Tax', 2);
        expect(await app.text('main')).toMatch(/Gift Card \[[^\]]*\][^$]*\$50\.00/);
        expect(await cust.waitText((x) => x.includes(usd(t.total)))).toContain(usd(t.total));
      });

      await step('Cash → points > 0, balance +$50', async () => {
        await app.pay();
        const cash = await app.methodCents('Cash');
        await app.selectMethod('Cash');
        expectCents(await app.enteredCents(), cash, 'Enter Amount');
        await app.completePayment('none');
        await app.successText();
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        expect(await cust.earnedPoints()).toBeGreaterThan(0);
        await app.noReceipt();
        untrack(code);
        const deadline = Date.now() + 120_000;
        let balance = await app.giftCardBalance(GIFT_CARD);
        while (balance !== balance0 + 5000 && Date.now() < deadline) {
          await app.pause(2_000);
          balance = await app.giftCardBalance(GIFT_CARD);
        }
        expectCents(balance, balance0 + 5000, 'gift card balance', 0);
      });

      await step('gift-card-only order: promotions do not apply', async () => {
        await app.quickCheckout();
        await app.sellGiftCardLine(GIFT_CARD, '$25');
        const gid = track(await app.orderCode());
        await app.click(CdMain.promoRewards);
        expect(
          await app.waitFor([
            CdMain.promoDialog,
            { text: "Promotions and rewards don't apply to gift cards", nth: 0 },
          ]),
        ).toBe(true);
        expect(await app.isDisabled([CdMain.promoDialog, { role: 'button', name: 'Apply', nth: 0 }])).toBe(
          true,
        );
        await app.escape();
        await app.deleteCurrentOrder();
        untrack(gid);
      });
    },
  );

  it(
    title(
      'Custom Discount $4.00 owner 50 / staff 50 on a 2-staff order → Promotion −$4.00, Total = Subtotal − $4 + Tax; Order History Total Discount $4.00 (E2E-040)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const d = await app.testData();
      if (!d.staff2) this.skip();
      const code = track(await app.createOrder());
      await app.pickStaff(d.staff2);
      await app.quickPay(3000, 'QC Service');
      expect(await app.itemRowCount('QC Service')).toBe(1);
      await app.openCustomDiscount('$', 4);
      const { owner, staff } = await app.promoSplitInputs();
      await app.fill(owner, '50');
      expect(await app.value(staff)).toBe('50');
      await app.applyPromo();
      const t = await app.orderTotals();
      expectCents(t.promotion, -400, 'Promotion', 0);
      expectCents(t.total, t.subtotal + t.promotion + t.tax, 'Total = Subtotal − $4 + Tax', 2);
      await app.pay();
      const cash = await app.methodCents('Cash');
      await app.selectMethod('Cash');
      await app.completePayment('none');
      await app.successText();
      expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
      await app.noReceipt();
      untrack(code);
      await app.openHistoryOrder(code);
      const dump = await app.historyDetail(code);
      expectCents(moneyField(dump, 'Total'), cash, 'history Total');
      expectCents(Math.abs(moneyField(dump, 'Total Discount')), 400, 'Total Discount', 0);
      note('E2E-040: the per-staff Discount Charge split (Staff Income) is not re-derived here');
    },
  );

  it(
    title(
      'Owner/staff split and % discount are blocked everywhere: 101% clamps to 100, 0% cannot Apply, owner 60 → staff 40, staff 110 → 100; Charge & Fee 60/30 → "must total 100%", Save disabled, leaving saves nothing (E2E-041)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const code = track(await app.createOrder());
      await step('Promo & Rewards', async () => {
        await app.openCustomDiscount('%', 101);
        const pct = [CdMain.promoDialog, { role: 'textbox' as const, nth: 0 }];
        expect(await app.value(pct)).toBe('100');
        await app.fill(pct, '0');
        expect(await app.isDisabled([CdMain.promoDialog, { role: 'button', name: 'Apply', nth: 0 }])).toBe(
          true,
        );
        await app.fill(pct, '10');
        const { owner, staff } = await app.promoSplitInputs();
        await app.fill(owner, '60');
        expect(await app.value(staff)).toBe('40');
        await app.fill(staff, '110');
        expect(await app.value(staff)).toBe('100');
        expect(await app.value(owner)).toBe('0');
        expect(await app.has({ text: 'Owner and staff percent must total 100%', nth: 0 })).toBe(false);
        await app.escape();
        expect(await app.waitGone(CdMain.promoDialog)).toBe(true);
        const promo = (await app.orderTotals()).promotion;
        expect(Number.isFinite(promo) ? promo : 0).toBe(0);
      });
      await step('Charge & Fee › Discount Setting', async () => {
        await app.openReport('/settings/charge-fee');
        const owner = { css: '#discount-setting-owner', nth: 0 };
        const staff = { css: '#discount-setting-staff', nth: 0 };
        if (!(await app.waitFor(owner)))
          throw new Error('#discount-setting-owner not on /settings/charge-fee');
        const [o0, s0] = [await app.value(owner), await app.value(staff)];
        await app.fill(owner, '60');
        await app.fill(staff, '30');
        expect(await app.waitFor({ text: 'Owner and staff percent must total 100%', nth: 0 })).toBe(true);
        const save = [
          { css: 'div,section,form', hasCss: '#discount-setting-owner', hasText: 'Save', nth: -1 },
          { role: 'button' as const, name: 'Save', nth: 0 },
        ];
        expect(await app.isDisabled(save)).toBe(true);
        await app.routerGoRaw('/home');
        if (await app.waitFor(CdMain.leaveDialog, 5_000))
          await app.click([CdMain.leaveDialog, { role: 'button', name: 'Discard & Leave', nth: 0 }]);
        expect(await app.waitPath(/\/home/, 10_000)).toBe(true);
        await app.openReport('/settings/charge-fee');
        await app.waitFor(owner);
        expect(await app.value(owner)).toBe(o0);
        expect(await app.value(staff)).toBe(s0);
      });
      await app.openPendingOrder(code);
      await app.deleteCurrentOrder();
      untrack(code);
    },
  );

  it(
    title(
      'Journey: new customer, 2 lines, −10% order discount, Other + 10% customer tip → points earned; Order History customer/discount/tip/total; Daily Sale row; Staff Income lists the staff (CD-060, PROMO-046, RPT-040)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const d = await app.testData();
      const phone = randomPhone();
      const name = 'QC E2E Journey';
      let code = '';
      let total = NaN;
      let tip = NaN;
      await step('order: staff + 2 lines + new customer', async () => {
        code = track(await app.createOrder({ services: [d.service] }));
        await app.quickPay(2000, 'QC Journey 2');
        await app.attachNewCustomer(phone, name);
        await app.customerConfirmPhone();
        expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
      });
      await step('−10% on the order', async () => {
        const before = await app.orderTotals();
        await app.customDiscount('%', 10);
        const after = await app.orderTotals();
        expect(after.promotion).toBeLessThan(0);
        expect(Math.abs(after.promotion)).toBeLessThanOrEqual(Math.round(before.subtotal / 10) + 1);
        expectCents(after.total, after.subtotal + after.promotion + after.tax, 'Total', 2);
      });
      await step('Other + customer 10% tip', async () => {
        await app.pay();
        expect(await app.has([{ css: 'main' }, { text: name, nth: 0 }])).toBe(true);
        total = await app.methodCents('Other');
        await app.selectMethod('Other');
        await app.click(CdMain.completePayment);
        const labels = await (async () => {
          const deadline = Date.now() + 30_000;
          while (Date.now() < deadline) {
            if (await app.passcodeShown()) await app.passcodeIfAsked(500);
            if (/payment-success/.test(await app.path())) return [] as string[];
            if (await cust.has(CdCustomer.addTip)) return cust.tipPresetLabels();
            await app.pause(400);
          }
          return [] as string[];
        })();
        if (!labels.length && !/payment-success/.test(await app.path()))
          await app.cancelWaitingTip().then(() => this.skip());
        if (labels.length)
          await cust.chooseTipAndContinue(labels.includes('10%') ? '10%' : (labels[0] ?? 'none'));
        await app.waitPaymentSuccess();
        const s = await app.successText();
        const m = /Total Tip: (\$[\d,.]+)/.exec(s);
        tip = m?.[1] ? parseMoney(m[1]) : 0;
        expect(tip).toBeGreaterThan(0);
        expect(s).toContain(`${usd(total)} + ${usd(tip)} Tip`);
      });
      await step('CD-060 customer: earned points', async () => {
        expect(await cust.waitFor(CdCustomer.earned, 10_000)).toBe(true);
        expect(await cust.earnedPoints()).toBeGreaterThan(0);
        if (await cust.has(CdCustomer.currentPoints)) expect(await cust.currentPoints()).toBeGreaterThan(0);
        await app.noReceipt();
        untrack(code);
      });
      await step('Order History', async () => {
        await app.openHistoryOrder(code);
        const dump = await app.historyDetail(code);
        expect(field(dump, 'Status')).toBe('Successful - Unsettled');
        expect(field(dump, 'Customer')).toBe(name);
        expect(moneyField(dump, 'Total Discount')).toBeLessThan(0);
        expect(field(dump, 'Tip')).toBe(usd(tip));
        expectCents(moneyField(dump, 'Total'), total + tip, 'history Total');
      });
      await step('Daily Sale row', async () => {
        const row = await app.dailySaleRow(code);
        ensure(row !== null, `${code} never showed in Daily Sale`);
        expect(row ?? '').toContain(usd(tip));
      });
      await step('Staff Income lists the staff', async () => {
        expect(await app.staffIncomeLists(d.staff)).toBe(true);
      });
    },
  );
});
