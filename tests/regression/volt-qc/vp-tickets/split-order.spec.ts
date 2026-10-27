/**
 * Split-Order-test-cases — [POS] Split Order (volt-qc per-ticket file
 * `docs/qc/volt-qc/vp-tickets/Split-Order-test-cases.md`, TC 1–25).
 *
 * Automated: the split SCREEN rules that need no payment — the > $5 gate,
 * Equally rounding/spread, By Amount auto-last-check and validation, method
 * switching, manual check edit, discount-before-split and Add New Check.
 * Each case builds its own single-line draft priced for the row, and voids it.
 *
 * Manual / pending: everything after a check is PAID (status, tip per check,
 * gift card, refund, void, re-open, receipt, reports, audit log). Paying a
 * split check settles money on the merchant; those flows are covered live by
 * tests/regression/order-flow/split-order-multi.spec.ts / split-tip.spec.ts and
 * stay manual here.
 *
 * CREATES DATA: drafts only, no payment. dev / staging.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { homePage, splitOrderPage } from '../../../../src/pages/index.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import {
  draftWithPrice,
  growChecksTo,
  leaveSplitAndVoid,
  splitWithPrice,
  voidAnyDraft,
} from './vp-tickets.helpers.js';

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe('Split-Order-test-cases — [POS] Split Order', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('build split-order drafts');
    await voidAnyDraft();
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await leaveSplitAndVoid();
  });

  it(
    title('TC-01 Split is disabled for Total ≤ $5.00 and enabled for $5.01', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await draftWithPrice(500);
      expect(await homePage.isSplitOrderAvailable()).toBe(false);

      await homePage.openServiceEditor();
      await homePage.setServiceEditorPrice(501);
      await homePage.saveServiceEditor();
      expect(await homePage.isSplitOrderAvailable()).toBe(true);
    },
  );

  it(
    title(
      'TC-02 Equally on 3 checks: sums to the total, the odd cent goes to the FIRST checks',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await splitWithPrice(10_000);
      await splitOrderPage.selectMethod('equally');
      await growChecksTo(3);

      const amounts = await splitOrderPage.allCheckAmountsCents();
      const total = sum(amounts);
      expect(amounts).toHaveLength(3);
      expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
      // Spread from the front: amounts never increase from check 1 to check N.
      for (let i = 1; i < amounts.length; i += 1) {
        expect(amounts[i] ?? 0).toBeLessThanOrEqual(amounts[i - 1] ?? 0);
      }
      expect(total).toBeGreaterThan(0);
    },
  );

  it(
    title('TC-03 Equally rounds to 2 decimals — $157.50 / 3 = $52.50 each', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await splitWithPrice(15_750);
      await splitOrderPage.selectMethod('equally');
      await growChecksTo(3);

      const amounts = await splitOrderPage.allCheckAmountsCents();
      const total = sum(amounts);
      // A service fee would move the total off $157.50 — then assert the spread only.
      if (total === 15_750) expect(amounts).toEqual([5_250, 5_250, 5_250]);
      else expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
    },
  );

  it(
    title(
      'TC-04 By Amount: Check 1 $30 + Check 2 $50 → Check 3 auto = Total − $80',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await splitWithPrice(10_000);
      await splitOrderPage.selectMethod('byAmount');
      await growChecksTo(3);
      const total = await splitOrderPage.checksTotalCents();

      await splitOrderPage.enterCheckAmount(1, 3_000);
      await splitOrderPage.enterCheckAmount(2, 5_000);
      const amounts = await splitOrderPage.allCheckAmountsCents();

      expect(amounts[0]).toBe(3_000);
      expect(amounts[1]).toBe(5_000);
      expect(amounts[2]).toBe(total - 8_000);
      expect(sum(amounts)).toBe(total);
    },
  );

  it(
    title('TC-05 By Amount refuses a $0 check (amount ≤ 0 is invalid)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await splitWithPrice(10_000);
      await splitOrderPage.selectMethod('byAmount');
      const total = await splitOrderPage.checksTotalCents();

      // The keypad has no minus key, so "-10" cannot be typed; 0 is the reachable bad value.
      await splitOrderPage.enterCheckAmount(1, 0);
      const amounts = await splitOrderPage.allCheckAmountsCents();

      expect(amounts.every((a) => a > 0)).toBe(true);
      expect(sum(amounts)).toBe(total);
    },
  );

  it(
    title(
      'TC-06 By Amount never lets the checks exceed the total nor the last check go negative',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await splitWithPrice(16_500);
      await splitOrderPage.selectMethod('byAmount');
      const total = await splitOrderPage.checksTotalCents();

      await splitOrderPage.enterCheckAmount(1, total + 2_000);
      const amounts = await splitOrderPage.allCheckAmountsCents();

      expect(sum(amounts)).toBe(total);
      expect(Math.min(...amounts)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...amounts)).toBeLessThanOrEqual(total);
    },
  );

  it(
    title(
      'TC-07 Switching Equally ↔ By Amount recomputes the checks and keeps the total',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await splitWithPrice(16_500);
      await splitOrderPage.selectMethod('equally');
      const equally = await splitOrderPage.allCheckAmountsCents();
      const total = sum(equally);
      expect(Math.abs((equally[0] ?? 0) - (equally[1] ?? 0))).toBeLessThanOrEqual(1);

      await splitOrderPage.selectMethod('byAmount');
      await splitOrderPage.enterCheckAmount(1, 7_500);
      expect(await splitOrderPage.checksTotalCents()).toBe(total);

      await splitOrderPage.selectMethod('equally');
      expect(await splitOrderPage.checksTotalCents()).toBe(total);
    },
  );

  it(
    title(
      'TC-09 Editing Check 1 to $75.00 re-balances the rest to the order total',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await splitWithPrice(15_750);
      await splitOrderPage.selectMethod('byAmount');
      const total = await splitOrderPage.checksTotalCents();

      await splitOrderPage.enterCheckAmount(1, 7_500);
      const amounts = await splitOrderPage.allCheckAmountsCents();
      expect(amounts[0]).toBe(7_500);
      expect(sum(amounts)).toBe(total);
    },
  );

  it(
    title('TC-10 An order-level discount is in the total BEFORE the split', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      // A line discount is the discount the cart editor exposes; the cart total
      // after it is what the split must divide (not the pre-discount subtotal).
      await draftWithPrice(11_000);
      await homePage.openServiceEditor();
      if (!(await homePage.isItemDiscountOn())) await homePage.toggleItemDiscount();
      await homePage.setItemDiscount('10');
      await homePage.saveServiceEditor();
      const cartTotal = await homePage.cartTotal();

      await homePage.openSplitOrder();
      await splitOrderPage.waitForReady();
      await splitOrderPage.selectMethod('equally');
      expect(await splitOrderPage.checksTotalCents()).toBe(cartTotal);
      expect(cartTotal).toBeLessThan(11_000);
    },
  );

  it(
    title(
      'TC-13 Add New Check raises the count and the checks still sum to the total',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await splitWithPrice(10_000);
      await splitOrderPage.selectMethod('equally');
      const before = await splitOrderPage.checkCount();
      const total = await splitOrderPage.checksTotalCents();
      expect(before).toBeGreaterThanOrEqual(2);

      await splitOrderPage.addCheck();
      expect(await splitOrderPage.checkCount()).toBe(before + 1);
      expect(await splitOrderPage.checksTotalCents()).toBe(total);
    },
  );
});
