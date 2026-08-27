import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import { OrderPendingIds, PENDING_ORDER_CODE } from '../../constants/testids.orders.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/** How the queue is ordered. The values are what the Radix select shows. */
export type SortOrder = 'latest' | 'oldest';

const SORT_LABELS: Record<SortOrder, [string, string]> = {
  latest: ['Latest', 'Mới nhất'],
  oldest: ['Oldest', 'Cũ nhất'],
};

/**
 * Pending Orders — `/order-pending`.
 *
 * ## What the screen means
 *
 * Every order still in progress. The useful property for a spec is the negative
 * one: **a completed order drops off this list**, so "did the checkout really
 * settle?" is answerable here in a way the success screen cannot answer — the
 * success screen renders on navigation, whereas absence from this queue means
 * the order's status actually changed.
 *
 * ## The order code is spelled differently here
 *
 * Cards print the bare code, `OD260616-12063420`, with **no leading `#`** —
 * unlike the active-order panel on `/home`. A spec carrying a code between the
 * two screens has to know which form it is holding, which is why
 * {@link PENDING_ORDER_CODE} matches the bare form and {@link isOrderListed}
 * strips a `#` before comparing.
 */
export class OrderPendingPage extends BasePage {
  readonly name = 'Pending Orders';
  readonly route = Routes.ORDER_PENDING;

  protected readonly readyAnchor: Locator = OrderPendingIds.heading;

  /** Navigate client-side and wait for the queue to render. */
  async open(): Promise<this> {
    await logStep(`Open ${this.name}`);
    await goTo(this.route);
    return this.waitForReady();
  }

  /* --------------------------------------------------------------------- *
   * The queue
   * --------------------------------------------------------------------- */

  /** Every order code currently listed, in display order. */
  async orderCodes(): Promise<string[]> {
    const cards = await this.findAll(OrderPendingIds.orderCards, { timeout: Timeouts.SHORT });
    const codes: string[] = [];
    for (const card of cards) {
      const match = PENDING_ORDER_CODE.exec(await card.getText());
      if (match) codes.push(match[0]);
    }
    return codes;
  }

  async cardCount(): Promise<number> {
    return (await this.findAll(OrderPendingIds.orderCards, { timeout: Timeouts.SHORT })).length;
  }

  /** Is the queue showing its "no pending orders" state? A real state, not a failure. */
  isEmpty(): Promise<boolean> {
    return this.isVisible(OrderPendingIds.emptyState, Timeouts.SHORT);
  }

  /**
   * Is this order in the queue?
   *
   * Accepts either spelling of the code: a caller that read `#OD260616-12063420`
   * off the home panel should not have to know that this screen drops the hash.
   */
  async isOrderListed(orderCode: string): Promise<boolean> {
    const bare = orderCode.replace(/^#/, '');
    return (await this.orderCodes()).includes(bare);
  }

  /**
   * Wait for an order to LEAVE the queue.
   *
   * The assertion a checkout spec actually wants. A completed order is removed
   * once its status lands, which can trail the navigation to the success screen
   * by a sync round trip — so this polls rather than reading once.
   */
  async waitForOrderGone(orderCode: string, timeout: number = Timeouts.MEDIUM): Promise<void> {
    const bare = orderCode.replace(/^#/, '');
    await browser.waitUntil(async () => !(await this.isOrderListed(bare)), {
      timeout,
      interval: 400,
      timeoutMsg:
        `Order ${bare} is still in the pending queue after ${String(timeout)}ms. ` +
        'A settled order is removed from this list, so it is still open — the payment did not ' +
        'complete, or it completed against a different order.',
    });
  }

  /** Open a pending order, returning to the till with it loaded. */
  async openOrder(orderCode: string): Promise<void> {
    const bare = orderCode.replace(/^#/, '');
    await logStep(`${this.name}: open ${bare}`);

    const cards = await this.findAll(OrderPendingIds.orderCards, { timeout: Timeouts.SHORT });
    for (const card of cards) {
      if ((await card.getText()).includes(bare)) {
        await card.waitForClickable({ timeout: Timeouts.SHORT });
        await card.click();
        return;
      }
    }

    throw new Error(
      `${this.name}: no card for ${bare}. The queue holds: ` +
        `${(await this.orderCodes()).join(', ') || '(empty)'}.`,
    );
  }

  /* --------------------------------------------------------------------- *
   * Toolbar
   * --------------------------------------------------------------------- */

  /**
   * Filter the queue.
   *
   * The box is debounced, so the settle is not decoration — reading the list
   * immediately after typing returns the PREVIOUS result set and the spec then
   * asserts against stale rows.
   */
  async search(text: string): Promise<this> {
    await this.setValue(OrderPendingIds.searchInput, text);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  async clearSearch(): Promise<this> {
    return this.search('');
  }

  /** Choose Latest or Oldest. */
  async setSort(order: SortOrder): Promise<this> {
    await logStep(`${this.name}: sort ${order}`);
    await this.click(OrderPendingIds.sortSelect);

    const [en, vi] = SORT_LABELS[order];
    const options = await this.findAll(OrderPendingIds.selectOptions, { timeout: Timeouts.SHORT });
    for (const option of options) {
      const text = (await option.getText()).trim();
      if (text === en || text === vi) {
        await option.click();
        await settle();
        return this;
      }
    }

    // Leave the dropdown closed rather than stranding it open over the next
    // assertion's target.
    await browser.keys(['Escape']);
    throw new Error(
      `${this.name}: the sort dropdown offers no "${en}" / "${vi}" option. ` +
        `It listed: ${(await this.sortOptionLabels()).join(', ') || '(nothing)'}.`,
    );
  }

  /** What the sort dropdown offers. Opens it and closes it again. */
  async sortOptionLabels(): Promise<string[]> {
    const options = await this.findAll(OrderPendingIds.selectOptions, { timeout: Timeouts.SHORT });
    const labels: string[] = [];
    for (const option of options) labels.push((await option.getText()).trim());
    return labels;
  }

  /** Start a checkout that has no order behind it yet. */
  async pressQuickCheckout(): Promise<this> {
    await logStep(`${this.name}: Quick Checkout`);
    await this.click(OrderPendingIds.quickCheckout);
    return this;
  }
}

export default new OrderPendingPage();
