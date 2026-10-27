/**
 * VP-1432 — Pay by Cash quick option ($5 / $10 / $50 / $100).
 *
 * Source: volt-qc `VP-1432-test-cases.md` (TC 1–5).
 *
 * ## The sheet and the build disagree on ONE rule
 *
 * The sheet says each tap ADDS the denomination to the entry ($32 + $50 = $82).
 * Every build this suite and volt-qc have driven (1.1.x, re-checked 2026-10-17)
 * REPLACES the entry instead — volt-qc's own live spec PAY-AD1 asserts
 * "$5/$10/$50/$100 THAY số tiền", and CheckoutPage.setCashPreset documents the
 * same. TC-02..04 therefore assert what the SHEET specifies; if they fail with
 * "expected 8200, received 5000" that is the requirement/build mismatch to raise
 * on VP-1432, not a broken test. Set VP1432_PRESET=replace to assert the build's
 * current behaviour instead.
 *
 * CREATES DATA AND TAKES A CASH PAYMENT (TC-05). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { createOrder, payInCash, returnToHome } from '../../../src/flows/index.js';
import { checkoutPage, homePage } from '../../../src/pages/index.js';
import type { CashPreset } from '../../../src/pages/pos/CheckoutPage.js';
import { Tag, title } from '../../../src/types/testTags.js';

const ADDITIVE = process.env.VP1432_PRESET !== 'replace';

/** What the entry should read after tapping `preset` on top of `before`. */
const expectedAfter = (before: number, preset: number): number => (ADDITIVE ? before + preset : preset);

async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

let orderId = '';

/** Back on the cash tab with the entry re-filled to the full due. */
async function freshCashTab(): Promise<number> {
  if (!(await checkoutPage.isActive())) {
    await returnToHome();
    if (await homePage.hasActiveDraft()) await homePage.pressPay();
    else orderId = (await createOrder()).orderId;
    await checkoutPage.waitForReady();
  }
  // Bounce off card so selecting cash is a real change and re-runs the auto-fill.
  await checkoutPage.selectTender('card');
  await checkoutPage.selectTender('cash');
  return checkoutPage.enteredAmountCents();
}

describe('VP-1432 — Pay by Cash quick option', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create an order for the cash quick-option checks');
    await voidAnyDraft();
    orderId = (await createOrder()).orderId;
    await checkoutPage.waitForReady();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
  });

  it(
    title(
      'TC-01 Enter Amount defaults to the order total; presets are $5 $10 $50 $100',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const due = await freshCashTab();

      expect(due).toBeGreaterThan(0);
      expect(await checkoutPage.remainingCents()).toBe(0);
      expect(await checkoutPage.cashPresetLabels()).toEqual(['$5', '$10', '$50', '$100']);
    },
  );

  it(
    title(
      'TC-02 Tapping $50 adds to the default total and enables Complete Payment',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const due = await freshCashTab();
      await checkoutPage.setCashPreset(5_000);

      const entered = expectedAfter(due, 5_000);
      expect(await checkoutPage.enteredAmountCents()).toBe(entered);
      // Complete Payment unlocks once the entry covers the due — always true when
      // presets add; with the build's replace behaviour only when $50 >= due.
      expect(await checkoutPage.isCompletePaymentEnabled()).toBe(entered >= due);
    },
  );

  it(title('TC-03 $5 then $100 accumulate', Tag.REGRESSION, Tag.WRITE), async () => {
    const due = await freshCashTab();

    await checkoutPage.setCashPreset(500);
    const afterFive = expectedAfter(due, 500);
    expect(await checkoutPage.enteredAmountCents()).toBe(afterFive);

    await checkoutPage.setCashPreset(10_000);
    expect(await checkoutPage.enteredAmountCents()).toBe(expectedAfter(afterFive, 10_000));
  });

  it(title('TC-04 Each denomination adds exactly its own value', Tag.REGRESSION, Tag.WRITE), async () => {
    let expected = await freshCashTab();
    for (const preset of [500, 1_000, 5_000, 10_000] as CashPreset[]) {
      await checkoutPage.setCashPreset(preset);
      expected = expectedAfter(expected, preset);
      expect(await checkoutPage.enteredAmountCents()).toBe(expected);
    }
  });

  it(
    title(
      'TC-05 Completing cash with a quick option settles the order with change',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const due = await freshCashTab();

      // $100 covers any single-service order on the test merchants.
      await checkoutPage.setCashPreset(10_000);
      const tendered = await checkoutPage.enteredAmountCents();
      expect(tendered).toBe(expectedAfter(due, 10_000));
      expect(await checkoutPage.changeCents()).toBe(tendered - due);

      // No tenderedCents: the cash tab is already active (re-selecting is a no-op),
      // so Complete Payment takes the preset entry as tapped — retyping it could hit
      // the "9" key the $50 preset covers.
      const success = await payInCash(orderId);
      expect(await success.isActive()).toBe(true);
    },
  );
});
