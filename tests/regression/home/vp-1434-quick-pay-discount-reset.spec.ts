/**
 * VP-1434 — Quick Pay: Apply Discount & Reset Amount.
 *
 * Source: volt-qc `VP-1434-quick-pay-discount-reset-test-cases.md` (TC 1–10).
 * Locators/behaviour cross-checked with volt-qc `tests/17-added/home-pay-oh-added.spec.ts`
 * (HOME-AD1..AD6), which ran against a live till.
 *
 * Amounts are compared on the CART rows rather than the line text: the merchant
 * may run a service fee / tax, so the line price carries the fee while the Item
 * Discount row is the pure discount (− 50% of $20 = −$10.00) on every merchant.
 *
 * CREATES DATA: one draft per test (staff + Quick Pay line), voided after each.
 * Nothing is paid. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

const AMOUNT_20 = 2_000;

async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

/** Fresh draft with a staff and the Quick Pay dialog open on `amount`. */
async function openQuickPayWith(amount: number, name?: string): Promise<void> {
  await voidAnyDraft();
  await homePage.selectFirstStaff();
  await homePage.openQuickPay();
  await homePage.fillQuickPayAmount(amount);
  if (name !== undefined) await homePage.fillQuickPayName(name);
}

describe('VP-1434 — Quick Pay: Apply Discount & Reset Amount', () => {
  before(() => {
    assertWritesAllowed('add Quick Pay lines on /home');
  });

  afterEach(async () => {
    if (await homePage.isQuickPayDialogShown()) await homePage.closeQuickPayDialog();
  });

  after(voidAnyDraft);

  it(
    title(
      'TC-01 Apply Discount switch reveals the value field with %/$ (default %)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await openQuickPayWith(AMOUNT_20);

      expect(await homePage.isQuickPayDiscountOn()).toBe(false);
      expect(await homePage.isQuickPayDiscountFieldShown()).toBe(false);

      await homePage.setQuickPayDiscountEnabled(true);

      expect(await homePage.isQuickPayDiscountOn()).toBe(true);
      expect(await homePage.isQuickPayDiscountFieldShown()).toBe(true);
      expect(await homePage.quickPayDiscountMode()).toBe('%');
    },
  );

  it(title('TC-02 50% item discount on $20 books -$10.00', Tag.REGRESSION, Tag.WRITE), async () => {
    await openQuickPayWith(AMOUNT_20, 'VP1434 pct');
    await homePage.applyQuickPayDiscount('%', '50');

    expect(await homePage.submitQuickPay()).toBe(true);

    const totals = await homePage.cartTotals();
    expect(Math.abs(totals.itemDiscount)).toBe(1_000);
  });

  it(title('TC-03 $5 item discount on $20 books -$5.00', Tag.REGRESSION, Tag.WRITE), async () => {
    await openQuickPayWith(AMOUNT_20, 'VP1434 fixed');
    await homePage.applyQuickPayDiscount('$', '5.00');
    expect(await homePage.quickPayDiscountValue()).toMatch(/^\$?5\.00$/);

    expect(await homePage.submitQuickPay()).toBe(true);

    const totals = await homePage.cartTotals();
    expect(Math.abs(totals.itemDiscount)).toBe(500);
  });

  it(
    title(
      'TC-04 Discount 0 is blocked with "Discount amount must be greater than 0"',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await openQuickPayWith(AMOUNT_20, 'VP1434 zero');
      await homePage.applyQuickPayDiscount('%', '0');

      const closed = await homePage.submitQuickPay(3_000);

      expect(closed).toBe(false);
      expect(await homePage.isQuickPayDialogShown()).toBe(true);
      expect(await homePage.isQuickPayDiscountErrorShown()).toBe(true);
    },
  );

  it(
    title(
      'TC-05 Switching Apply Discount off hides the field and books the full $20',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await openQuickPayWith(AMOUNT_20, 'VP1434 off');
      await homePage.applyQuickPayDiscount('%', '10');
      await homePage.setQuickPayDiscountEnabled(false);

      expect(await homePage.isQuickPayDiscountFieldShown()).toBe(false);
      expect(await homePage.submitQuickPay()).toBe(true);

      const totals = await homePage.cartTotals();
      expect(totals.itemDiscount).toBe(0);
      expect(totals.subtotal).toBeGreaterThanOrEqual(AMOUNT_20);
    },
  );

  it(
    title('TC-06 100% discount brings the line to $0.00 without error', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await openQuickPayWith(AMOUNT_20, 'VP1434 100');
      await homePage.applyQuickPayDiscount('%', '100');

      expect(await homePage.submitQuickPay()).toBe(true);

      const totals = await homePage.cartTotals();
      expect(Math.abs(totals.itemDiscount)).toBe(AMOUNT_20);
      expect(totals.total).toBe(0);
    },
  );

  it(
    title('TC-07 Over-limit discount clamps: $500 on $400 → $400.00, 150% → 100', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await openQuickPayWith(40_000);
      await homePage.applyQuickPayDiscount('$', '500.00');
      expect(await homePage.quickPayDiscountValue()).toMatch(/^\$?400\.00$/);

      await homePage.chooseQuickPayDiscountMode('%');
      await homePage.setQuickPayDiscountValue('150');
      expect(await homePage.quickPayDiscountValue()).toBe('100');
    },
  );

  it(
    title('TC-08 Reset (×) returns the amount to $0.00 in one press', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await openQuickPayWith(AMOUNT_20);
      expect(await homePage.isQuickPayResetShown()).toBe(true);

      await homePage.resetQuickPayAmount();

      expect(await homePage.quickPayAmountCents()).toBe(0);
      expect(await homePage.isQuickPayDialogShown()).toBe(true);
    },
  );

  it(title('TC-09 Reset keeps Service Name, Note and the discount', Tag.REGRESSION, Tag.WRITE), async () => {
    await openQuickPayWith(AMOUNT_20, 'Test');
    await homePage.fillQuickPayNote('abc');
    await homePage.applyQuickPayDiscount('%', '10');

    await homePage.resetQuickPayAmount();

    expect(await homePage.quickPayAmountCents()).toBe(0);
    expect(await homePage.quickPayNameValue()).toBe('Test');
    expect(await homePage.quickPayNoteValue()).toBe('abc');
    expect(await homePage.isQuickPayDiscountOn()).toBe(true);
    expect(await homePage.quickPayDiscountValue()).toBe('10');
  });

  it(
    title(
      'TC-10 At $0.00 the reset is not offered and the amount stays 0 (no NaN/negative)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await openQuickPayWith(AMOUNT_20);
      await homePage.resetQuickPayAmount();

      // The app hides (×) once the amount is zero, so a second press is impossible —
      // the observable contract is "still $0.00, nothing invalid".
      expect(await homePage.isQuickPayResetShown()).toBe(false);
      const raw = await homePage.quickPayAmountValue();
      expect(raw).not.toMatch(/NaN|-/);
      expect(await homePage.quickPayAmountCents()).toBe(0);
    },
  );
});
