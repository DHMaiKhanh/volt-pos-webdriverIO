/**
 * volt-qc port — 04 PROMO-H: Discount Charge (the staff's share of a discount)
 * on Staff Income (V1).
 *
 * Source: volt-qc `e2e/tests/04-promo/promo-plan-staff-income.spec.ts`.
 * The report lags 30–60 s and the merchant is shared, so every case compares the
 * DELTA of Discount Charge before/after its own order, polling up to 2 minutes.
 * Orders pay Other/Cash with a fixed $ discount, so the expected delta is the
 * typed discount (verified by volt-qc with SF 10% + Tax 10%).
 *
 * CREATES DATA (paid Other/Cash orders) — dev/staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import {
  addGiftCardLine,
  createQuickPayOrder,
  customDiscountSplit,
  payOpenOrder,
  staffDiscountCharge,
  waitDiscountChargeDelta,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import { app, vqEnv, waitUntil } from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

describe('volt-qc 04 PROMO-H — Discount Charge on Staff Income', () => {
  before(() => {
    assertWritesAllowed('pay discounted orders and read Staff Income');
  });

  afterEach(async () => {
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders().catch(() => undefined);
  });

  it(
    title(
      'PROMO-H1 Quick Pay $100, Custom $10 split 50/50 → staff Discount Charge +$5.00 (PROMO-054)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const before = await staffDiscountCharge(vqEnv.testStaff);
      const id = await createQuickPayOrder([{ amount: 100, name: 'QC DC 100' }]);
      await customDiscountSplit('$', 10, 50);
      await payOpenOrder('Other');
      const now = await waitDiscountChargeDelta(vqEnv.testStaff, before, 5);
      console.warn(`${id}: Discount Charge ${String(before)} → ${String(now)}`);
      expect(now - before).toBeCloseTo(5, 2);
    },
  );

  it(
    title(
      'PROMO-H2 $70 (staff 1) + $30 (staff 2), Custom $10 split 50/50 → +$3.50 / +$1.50 (PROMO-055)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const b1 = await staffDiscountCharge(vqEnv.testStaff);
      const b2 = await staffDiscountCharge(vqEnv.testStaff2);
      await createQuickPayOrder([
        { amount: 70, name: 'QC DC 70', staff: vqEnv.testStaff },
        { amount: 30, name: 'QC DC 30', staff: vqEnv.testStaff2 },
      ]);
      await customDiscountSplit('$', 10, 50);
      await payOpenOrder('Other');
      const n1 = await waitDiscountChargeDelta(vqEnv.testStaff, b1, 3.5);
      const n2 = await waitDiscountChargeDelta(vqEnv.testStaff2, b2, 1.5);
      expect(n1 - b1).toBeCloseTo(3.5, 2);
      expect(n2 - b2).toBeCloseTo(1.5, 2);
    },
  );

  it(
    title(
      'PROMO-H3 Quick Pay $50, Custom $3.33 split 50/50 → +$1.66 (rounding) (PROMO-056)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const before = await staffDiscountCharge(vqEnv.testStaff);
      await createQuickPayOrder([{ amount: 50, name: 'QC DC 50' }]);
      await customDiscountSplit('$', 3.33, 50);
      await payOpenOrder('Other');
      const now = await waitDiscountChargeDelta(vqEnv.testStaff, before, 1.66);
      expect(now - before).toBeCloseTo(1.66, 2);
    },
  );

  it(
    title(
      'PROMO-H4 Custom 10% left at Owner 100 / Staff 0 → Discount Charge unchanged (PROMO-058)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const before = await staffDiscountCharge(vqEnv.testStaff);
      const id = await createQuickPayOrder([{ amount: 100, name: 'QC DC 0' }]);
      await customDiscountSplit('%', 10);
      await payOpenOrder('Other');
      // No delta to wait for: wait until THIS order shows on the staff's detail (report caught up), then read.
      let now = Number.NaN;
      const seen = await waitUntil(
        async () => {
          now = await staffDiscountCharge(vqEnv.testStaff);
          return (await app.text('main')).replace(/\s/g, '').includes(id);
        },
        180_000,
        1_000,
      );
      if (!seen) console.warn(`${id} not on Staff Income after 180 s — reading the current number`);
      expect(now - before).toBeCloseTo(0, 2);
    },
  );

  it(
    title(
      'PROMO-H5 $20 service + $100 gift card sale, max $ discount 50/50 → +$10.00 on the real $20 discount (PROMO-033)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn('PROMO-H5: VOLT_TEST_GIFT_CARD is not set (the order tops the test card up by $100)');
        this.skip();
      }
      this.timeout(7 * 60_000);
      const before = await staffDiscountCharge(vqEnv.testStaff);
      const id = await createQuickPayOrder([{ amount: 20, name: 'QC DC GC' }]);
      await addGiftCardLine(vqEnv.testGiftCard, 100);
      await app.openPendingOrder(id);
      await customDiscountSplit('$', 20, 50);
      await payOpenOrder('Cash');
      const now = await waitDiscountChargeDelta(vqEnv.testStaff, before, 10);
      expect(now - before).toBeCloseTo(10, 2);
    },
  );
});
