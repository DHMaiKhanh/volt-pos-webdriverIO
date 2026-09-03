/**
 * Split Order on a MULTI-LINE order — the states a single-service order cannot reach.
 *
 * The sibling `split-order.spec.ts` builds a one-line order and pins the cases
 * that hold there (By Items disabled, Equally into two). This file builds a
 * TWO-line order and covers what only a multi-line order can show:
 *   - TC-ORDERFLOW-33 (precondition) / TC-ORDERFLOW-26  By Items ENABLED with >1 line
 *   - TC-ORDERFLOW-27  Equally still sums to the whole on a two-line order
 *   - TC-ORDERFLOW-32  the Receipt Details panel renders the order's own totals
 *
 * Pending, because the page object has no driver for these interactions yet — a
 * By-Amount custom-amount keypad and a By-Items row-to-check assignment, neither
 * annotated in the catalogue:
 *   - TC-ORDERFLOW-29  By Amount rejects a total over the order total
 *   - TC-ORDERFLOW-30  By Amount auto-computes the last check
 *   - TC-ORDERFLOW-31  each check pays independently with the four tenders
 *   - TC-ORDERFLOW-33  By Items assigns each line to a check
 *
 * PREREQUISITE: a SECOND, differently-priced service (`SECOND_SERVICE_ID`).
 * Without it a reliable two-LINE order cannot be built — adding the first tile
 * twice may fold into one line at quantity two — so the whole file skips.
 *
 * CREATES DATA: a two-line draft is written and voided; no payment is taken.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { secondaryService } from '../../../src/data/static/services.js';
import { homePage, splitOrderPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

describe('Order flow — Split Order (multi-line)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    if (secondaryService.id === '') {
      // Not a failure: a reliable two-line order needs a second, different
      // service, and this merchant has not configured one.
      this.skip();
    }

    assertWritesAllowed('build a two-line order for split');
    await voidAnyDraft();

    await homePage.selectFirstStaff();
    await homePage.addFirstService();
    await homePage.searchService(secondaryService.name);
    await homePage.addService(secondaryService.id);

    await homePage.openSplitOrder();
    await splitOrderPage.waitForReady();
  });

  after(async () => {
    if (await splitOrderPage.isActive()) await splitOrderPage.backToOrder();
    await voidAnyDraft();
  });

  it(
    title(
      'By Items is enabled once the order has more than one line (TC-ORDERFLOW-26)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      // The complement of split-order.spec.ts, which asserts it disabled at one line.
      expect(await splitOrderPage.isMethodEnabled('byItems')).toBe(true);
    },
  );

  it(
    title(
      'Equally splits a two-line order into checks that sum to the whole (TC-ORDERFLOW-27)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await splitOrderPage.selectMethod('equally');

      const amounts = await splitOrderPage.allCheckAmountsCents();
      expect(amounts.length).toBeGreaterThanOrEqual(2);

      const sum = amounts.reduce((total, amount) => total + amount, 0);
      expect(sum).toBeGreaterThan(0);
      // Even split across the checks, the last one carrying at most a rounding cent.
      const max = Math.max(...amounts);
      const min = Math.min(...amounts);
      expect(max - min).toBeLessThanOrEqual(1);
    },
  );

  it(
    title('The Receipt Details panel renders the order totals (TC-ORDERFLOW-32)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      expect(await splitOrderPage.isReceiptDetailsShown()).toBe(true);
    },
  );

  it(title('TC-ORDERFLOW-29: By Amount rejects an over-total — PENDING (no custom-amount keypad driver)'));

  it(
    title(
      'TC-ORDERFLOW-30: By Amount auto-computes the last check — PENDING (no custom-amount keypad driver)',
    ),
  );

  it(title('TC-ORDERFLOW-31: each check pays independently — PENDING (heavy multi-tender settle)'));

  it(title('TC-ORDERFLOW-33: By Items assigns each line to a check — PENDING (no row-assignment driver)'));
});
