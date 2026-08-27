/**
 * Building a draft order on the till.
 *
 * CREATES DATA: a draft order is written to the local database and pushed
 * upstream by the sync loop. dev / staging only — see `Tag.WRITE`.
 *
 * PREREQUISITE: the merchant has at least one staff member and one service.
 * Both panels are virtualised, so the spec works with whichever tile is
 * rendered first rather than naming a fixture by id.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../src/utils/money.js';
import type { CartTotals } from '../../../src/pages/pos/HomePage.js';

/** The cart footer's own arithmetic, restated so the spec asserts it rather than trusting it. */
const expectedTotal = (totals: CartTotals): number =>
  totals.subtotal - totals.itemDiscount - totals.promotion - totals.reward + totals.tax;

describe('Home — create an order', () => {
  before(async () => {
    // No flow stands between this spec and the till: composing the order IS what
    // is under test, so the write rail is stated here instead of being inherited
    // from a data-creating flow.
    assertWritesAllowed('create a draft order on /home');

    await returnToHome();
    await homePage.waitForReady();
    await homePage.selectFirstStaff();
    await homePage.addFirstService();
  });

  after(async () => {
    await homePage.deleteOrder();
  });

  it(
    title('A staff member and a service open a priced draft order', Tag.REGRESSION, Tag.WRITE, Tag.CRITICAL),
    async () => {
      const totals = await homePage.cartTotals();

      // A service with a zero price would make every later assertion in this
      // file vacuous, and would make the checkout spec pay nothing at all.
      expect(totals.subtotal).toBeGreaterThan(0);
      expectCentsEqual(totals.total, expectedTotal(totals), 'draft order total');
    },
  );

  it(
    title('A second service line raises the subtotal', Tag.REGRESSION, Tag.WRITE, Tag.CRITICAL),
    async () => {
      const oneService = await homePage.cartTotals();

      await homePage.addFirstService();

      const twoServices = await homePage.cartTotals();
      expect(twoServices.subtotal).toBeGreaterThan(oneService.subtotal);
      expectCentsEqual(
        twoServices.total,
        expectedTotal(twoServices),
        'draft order total after the second line',
      );
    },
  );
});
