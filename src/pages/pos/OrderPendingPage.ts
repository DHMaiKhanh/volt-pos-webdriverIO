import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import { headerMenuItem } from '../../constants/testids.js';
import { OrderPendingScreenIds as OrderPendingIds } from '../../constants/testids.order-pending.js';
import { PENDING_ORDER_CODE } from '../../constants/testids.orders.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle, waitUntilPath } from '../../helpers/wait.js';
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

  /**
   * The search box, not the "Pending Orders" heading: on build 1.1.x the screen
   * renders no heading at all, and the only "Pending Orders" text is the header
   * quick-nav button — present on EVERY screen with a header, so it would report
   * this route ready while the app is still on /home. The search input is
   * rendered by this route's filter bar only.
   */
  protected readonly readyAnchor: Locator = OrderPendingIds.searchInput;

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

  /* --------------------------------------------------------------------- *
   * Reads for the toolbar (TC-OP-01, -06..-09)
   * --------------------------------------------------------------------- */

  /** Which toolbar controls are on screen. One read per control, SHORT budget each. */
  async toolbarVisibility(): Promise<
    Record<'search' | 'staffFilter' | 'sort' | 'datePreset' | 'dateRange' | 'quickCheckout', boolean>
  > {
    return {
      search: await this.isVisible(OrderPendingIds.searchInput, Timeouts.SHORT),
      staffFilter: await this.isVisible(OrderPendingIds.staffFilter, Timeouts.SHORT),
      sort: await this.isVisible(OrderPendingIds.sortSelect, Timeouts.SHORT),
      datePreset: await this.isVisible(OrderPendingIds.datePreset, Timeouts.SHORT),
      dateRange: await this.isVisible(OrderPendingIds.dateRange, Timeouts.SHORT),
      quickCheckout: await this.isVisible(OrderPendingIds.quickCheckout, Timeouts.SHORT),
    };
  }

  /** The staff filter's label with its count badge, whitespace-collapsed: `Staff 305`. */
  async staffFilterLabel(): Promise<string> {
    return (await this.text(OrderPendingIds.staffFilter, { timeout: Timeouts.SHORT }))
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** The sort select's CURRENT value (`Latest` / `Oldest`, or the VI pair). */
  async currentSortLabel(): Promise<string> {
    return this.text(OrderPendingIds.sortSelect, { timeout: Timeouts.SHORT });
  }

  /** The date-range preset select's current value (`Today` on arrival). */
  async datePresetLabel(): Promise<string> {
    return this.text(OrderPendingIds.datePreset, { timeout: Timeouts.SHORT });
  }

  /** The calendar trigger's text — the selected date, e.g. `10/25/2026`. */
  async dateRangeLabel(): Promise<string> {
    return this.text(OrderPendingIds.dateRange, { timeout: Timeouts.SHORT });
  }

  /** Is Quick Checkout rendered AND enabled? */
  async isQuickCheckoutEnabled(): Promise<boolean> {
    if (!(await this.isVisible(OrderPendingIds.quickCheckout, Timeouts.SHORT))) return false;
    const button = await this.find(OrderPendingIds.quickCheckout, { timeout: Timeouts.SHORT });
    return button.isEnabled();
  }

  /**
   * Open the sort dropdown, read its options, and close it again with Escape.
   *
   * {@link sortOptionLabels} reads an ALREADY-open dropdown; this is the
   * self-contained version a "what does Sort offer" check wants.
   */
  async readSortOptions(): Promise<string[]> {
    await this.click(OrderPendingIds.sortSelect);
    await settle(Timeouts.ANIMATION);
    const labels = await this.sortOptionLabels();
    await browser.keys(['Escape']);
    await settle(Timeouts.ANIMATION);
    return labels;
  }

  /* --------------------------------------------------------------------- *
   * Reads for a card (TC-OP-02)
   * --------------------------------------------------------------------- */

  /**
   * The full text of the card carrying `orderCode`, or `null` when no card does.
   *
   * Read through `textContent` as well as `getText()` — WebView2 152 returns ''
   * from `getText()` for a node React just re-rendered (see UiObject.text()).
   */
  async cardText(orderCode: string): Promise<string | null> {
    const bare = orderCode.replace(/^#/, '');
    const cards = await this.findAll(OrderPendingIds.orderCards, { timeout: Timeouts.SHORT });
    for (const card of cards) {
      let text = (await card.getText().catch(() => '')).trim();
      if (text === '') {
        const raw = await card.getProperty('textContent').catch(() => '');
        text = typeof raw === 'string' ? raw.trim() : '';
      }
      if (text.includes(bare)) return text;
    }
    return null;
  }

  /* --------------------------------------------------------------------- *
   * Header cross-navigation (TC-OP-10)
   * --------------------------------------------------------------------- */

  /**
   * Press a header quick-nav link (`/order-history`, `/appointment`) and wait
   * for the router to land on it. The Appointment link carries `?date=<epoch>`,
   * which is why {@link headerMenuItem} also matches by href PREFIX.
   */
  async pressHeaderLink(route: string): Promise<string> {
    await logStep(`${this.name}: header link ${route}`);
    await this.click(headerMenuItem(route));
    return waitUntilPath((path) => path.startsWith(route), {
      timeout: Timeouts.NAVIGATION,
      message: `The header link to ${route} did not navigate`,
    });
  }

  /** Start a checkout that has no order behind it yet. */
  async pressQuickCheckout(): Promise<this> {
    await logStep(`${this.name}: Quick Checkout`);
    await this.click(OrderPendingIds.quickCheckout);
    return this;
  }
}

export default new OrderPendingPage();
