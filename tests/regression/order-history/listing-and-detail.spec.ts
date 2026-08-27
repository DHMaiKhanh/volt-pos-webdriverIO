/**
 * An order that was just paid has to be findable, and priced correctly, in
 * history.
 *
 * CREATES DATA AND TAKES A PAYMENT: the spec builds and closes its own order
 * rather than asserting on whatever the merchant happens to have. dev / staging
 * only — `Tag.WRITE`.
 *
 * Building the fixture in the hook is deliberate: history is the one screen
 * where reusing a stranger's order would make the assertion meaningless — the
 * total under test has to be the total this run charged.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../../src/constants/routes.js';
import { createOrder, goToOrderHistory, payInCash, returnToHome } from '../../../src/flows/index.js';
import { homePage, orderHistoryPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual, formatMoney } from '../../../src/utils/money.js';

describe('Order history — the order this run took', () => {
  let orderId = '';
  let paidTotalCents = 0;

  before(async function (this: Mocha.Context): Promise<void> {
    // Creating, tendering and settling an order is three upstream round trips
    // plus a sync push — comfortably more than a single assertion's budget.
    this.timeout(Timeouts.MOCHA_HOOK);

    await returnToHome();
    await createOrder();

    const checkout = await homePage.pressPay();
    await checkout.waitForReady();

    orderId = await checkout.orderId();
    paidTotalCents = await checkout.totalCents();

    // Exact tender: no change to reconcile, so the row's total is the order
    // total and nothing else.
    await payInCash(orderId, { tenderedCents: paidTotalCents });

    await returnToHome();
    await goToOrderHistory();
  });

  it(
    title('The order appears in the list with the total it was charged', Tag.REGRESSION, Tag.WRITE),
    async () => {
      const row = await orderHistoryPage.findRowByOrderId(orderId);
      if (row === null) {
        throw new Error(
          `Order ${orderId} was paid in full but no row for it rendered in ${Routes.ORDER_HISTORY}. ` +
            `The lookup pages the virtualised list before giving up, so this is a missing order rather ` +
            `than a scroll problem — check the default date range and the applied filters.`,
        );
      }

      expect(row.orderId).toBe(orderId);
      expect(paidTotalCents).toBeGreaterThan(0);
      expectCentsEqual(row.total, paidTotalCents, 'order-history row total');
    },
  );

  it(
    title('Opening the row shows the detail pane for the same order', Tag.REGRESSION, Tag.WRITE),
    async () => {
      const detail = await orderHistoryPage.openOrder(orderId);

      expect(await detail.currentPath()).toBe(Routes.ORDER_HISTORY_DETAIL(orderId));

      // Matching the rendered string, not a parsed number: the order summary is
      // where a cashier reads the charge back, so this also pins the formatting
      // money() produces (`$1,234.56`) rather than only its value.
      expect(await detail.readSummary()).toContain(formatMoney(paidTotalCents));
    },
  );
});
