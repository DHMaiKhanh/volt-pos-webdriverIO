/**
 * Does order history load, and can its filter be opened without side effects?
 *
 * Read-only. The filter dialog is opened and dismissed with Escape; Confirm is
 * never pressed, so the applied filters and the merchant's data are untouched.
 *
 * PREREQUISITE: the merchant has at least one order in the default date range.
 * That is true of any till that has taken money, and an empty list is a real
 * state the app renders on purpose — a failure here on a brand-new merchant
 * means the fixture, not the app.
 */

import { expect } from '@wdio/globals';
import { Routes } from '../../src/constants/routes.js';
import { goToOrderHistory } from '../../src/flows/index.js';
import { orderHistoryPage } from '../../src/pages/index.js';
import { Tag, title } from '../../src/types/testTags.js';
import { expectCentsEqual } from '../../src/utils/money.js';

describe('Order history', () => {
  before(async () => {
    await goToOrderHistory();
  });

  it(title('The order list loads with addressable, priced rows', Tag.SMOKE), async () => {
    expect(await orderHistoryPage.currentPath()).toBe(Routes.ORDER_HISTORY);
    await orderHistoryPage.waitForRows(1);

    // Every rendered row must link to an order. `renderedOrderIds()` reads the
    // uuid out of each row's href and drops the rows that have none, so a
    // shortfall against `rowCount()` means the list painted a row the router
    // cannot open — the failure a user hits as a dead tap.
    const ids = await orderHistoryPage.renderedOrderIds();
    expect(ids.length).toBe(await orderHistoryPage.rowCount());

    const firstOrderId = await orderHistoryPage.firstOrderId();
    if (firstOrderId === null) {
      throw new Error('The list rendered rows, but none of them carried an /order-history/ href.');
    }

    const row = await orderHistoryPage.readRowSummary(firstOrderId);
    expect(row.orderId).toBe(firstOrderId);
    expect(row.lines.length).toBeGreaterThan(0);
    // A row prints exactly one money() value. Reading it back as anything other
    // than whole cents means the amount was parsed as dollars.
    expectCentsEqual(row.total, Math.trunc(row.total), `order-history row ${firstOrderId} total`);
  });

  it(title('The filter dialog opens and closes leaving the list untouched', Tag.SMOKE), async () => {
    const before = await orderHistoryPage.renderedOrderIds();

    await orderHistoryPage.openFilter();
    // `order-history-header.tsx` keeps Confirm disabled while the dialog's draft
    // filters still equal the applied ones. Disabled therefore proves two things
    // at once: the dialog really is open, and nothing in it has been changed.
    expect(await orderHistoryPage.canConfirmFilter()).toBe(false);

    // Escape with no popover open dismisses the topmost layer, which is the
    // dialog itself.
    await orderHistoryPage.closeFilterPopover();

    // Re-opening is the proof the dismissal landed: `openFilter()` CLICKS the
    // filter button, and a dialog still up would have its overlay swallow that
    // click — the click times out rather than passing silently.
    await orderHistoryPage.openFilter();
    await orderHistoryPage.closeFilterPopover();

    expect(await orderHistoryPage.currentPath()).toBe(Routes.ORDER_HISTORY);
    expect(await orderHistoryPage.renderedOrderIds()).toEqual(before);
  });
});
