/**
 * Split Order screen — dividing one draft check into several.
 *
 * Ports the live-verified split-order cases (see
 * docs/screens/order-flow/order-flow-test-cases.md §7, verified 2026-09-02):
 *   - TC-ORDERFLOW-25  navigate to /order/{id}/split-order
 *   - TC-ORDERFLOW-26  By Items disabled for a single-line order
 *   - TC-ORDERFLOW-27  Equally defaults to two checks that sum to the whole
 *   - TC-ORDERFLOW-28  Add New Check raises the count
 *
 * CREATES DATA: a draft order is written locally and synced upstream, but NO
 * payment is taken — the spec ends by voiding the draft. dev / staging only, so
 * it is guarded by `assertWritesAllowed` / `Tag.WRITE`.
 *
 * PREREQUISITE: the merchant has at least one staff member and one service. The
 * draft is built with a SINGLE line so that By Items has nothing to divide,
 * which is the state TC-ORDERFLOW-26 asserts against.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage, splitOrderPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

describe('Order flow — Split Order', () => {
  before(async () => {
    // No data-creating flow precedes this spec — building the draft IS the
    // setup — so the write rail is stated here rather than inherited.
    assertWritesAllowed('open the split-order screen on a draft');

    await returnToHome();
    await homePage.waitForReady();
    await homePage.selectFirstStaff();
    await homePage.addFirstService();
    await homePage.openSplitOrder();
    await splitOrderPage.waitForReady();
  });

  after(async () => {
    // Leave the till clean: return to the cart and void the never-paid draft.
    await splitOrderPage.backToOrder();
    await homePage.deleteOrder();
  });

  it(
    title('Split opens on the split-order screen (TC-ORDERFLOW-25)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      expect(await splitOrderPage.isActive()).toBe(true);
    },
  );

  it(
    title('By Items is disabled for a single-line order (TC-ORDERFLOW-26)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      expect(await splitOrderPage.isMethodEnabled('equally')).toBe(true);
      expect(await splitOrderPage.isMethodEnabled('byAmount')).toBe(true);
      // One service line has nothing to divide by item.
      expect(await splitOrderPage.isMethodEnabled('byItems')).toBe(false);
    },
  );

  it(
    title(
      'Equally defaults to two checks that sum to the whole (TC-ORDERFLOW-27)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await splitOrderPage.selectMethod('equally');

      const amounts = await splitOrderPage.allCheckAmountsCents();
      expect(amounts.length).toBe(2);

      const [first, second] = amounts;
      if (first === undefined || second === undefined) {
        throw new Error(`expected two checks, got ${JSON.stringify(amounts)}`);
      }

      expect(first + second).toBeGreaterThan(0);
      // Even split, with the last check carrying at most the rounding cent.
      expect(Math.abs(first - second)).toBeLessThanOrEqual(1);
    },
  );

  it(title('Add New Check raises the check count (TC-ORDERFLOW-28)', Tag.REGRESSION, Tag.WRITE), async () => {
    await splitOrderPage.selectMethod('equally');

    const before = await splitOrderPage.checkCount();
    await splitOrderPage.addCheck();

    expect(await splitOrderPage.checkCount()).toBe(before + 1);
  });
});
