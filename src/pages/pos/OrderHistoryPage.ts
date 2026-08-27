import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import {
  OrderHistoryIds,
  orderHistoryItem,
  orderHistoryPaymentFilter,
  orderHistoryStatusFilter,
} from '../../constants/testids.js';
import { Routes } from '../../constants/routes.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle } from '../../helpers/wait.js';
import type { MoneyCents, PaymentMethod } from '../../types/models.js';
import { parseMoney } from '../../utils/money.js';
import { BasePage } from '../BasePage.js';
import orderHistoryDetailPage from './OrderHistoryDetailPage.js';

/**
 * The two sort fields the app offers, in the order the `<Select>` renders them.
 *
 * Transcribed from `ORDER_HISTORY_SORT_FIELDS` in the app's
 * `-order-history-list/order-history-list.constants.ts`. The ORDER matters: a
 * Radix `SelectItem` reflects neither its value nor a testid onto the DOM, so
 * the only way to pick one is by position — see {@link OrderHistoryPage.sortBy}.
 */
export const ORDER_HISTORY_SORT_FIELDS = ['completedAt', 'updatedAt'] as const;

export type OrderHistorySortField = (typeof ORDER_HISTORY_SORT_FIELDS)[number];

/**
 * The DOM ids the status checkboxes carry, verbatim from `ORDER_STATUS_OPTIONS`
 * in `-shared/order-history.constants.ts`.
 *
 * These are ids, not statuses: `status-successful` filters "Successful -
 * Unsettled" while `status-successful-settled` is a synthetic `ORDER_FILTER`
 * value with no matching `ORDER_STATUS`. Do not derive one from the other.
 */
export const ORDER_STATUS_FILTER_IDS = [
  'status-successful',
  'status-successful-settled',
  'status-canceled',
  'status-canceling',
  'status-cancel-issue',
  'status-partial-refunded',
  'status-refunded',
  'status-refunding',
  'status-refund-issue',
] as const;

export type OrderStatusFilterId = (typeof ORDER_STATUS_FILTER_IDS)[number];

/** One rendered row of the order list, read as data rather than handed out as an element. */
export interface OrderRowSummary {
  /** The uuid the row links to — taken from `href`, which is what the router uses. */
  orderId: string;
  /** Every non-empty line the row renders, top to bottom. */
  lines: string[];
  /** Whole-row text, newlines preserved as they came off the screen. */
  text: string;
  /**
   * The row's total. `order-history-item.tsx` prints exactly one `money()`
   * value per row, so the single currency token in the text is unambiguous.
   */
  total: MoneyCents;
}

/** The one currency token a row prints: `$1,234.56`, or `-$12.00` on a refund. */
const MONEY_TOKEN = /-?\$\s?[\d,]+(?:\.\d{2})?/;

/**
 * How many screens of the virtualised list {@link OrderHistoryPage.findRowByOrderId}
 * will page through before reporting the order absent.
 *
 * 20 pages x ~7 visible rows covers roughly 140 orders, well past the 20-row
 * first page from `ORDER_HISTORY_PAGINATION.LIMIT`. Searching by order code is
 * the right tool beyond that; this bound exists so a wrong id fails in seconds
 * instead of walking a merchant's entire history.
 */
const MAX_SCROLL_PAGES = 20;

/**
 * `/order-history` — the searchable, filterable order list.
 *
 * ## The list is virtualised
 *
 * `order-history-list.tsx` drives the rows through `@tanstack/react-virtual`,
 * so only the rows inside the viewport (plus 5 of overscan) exist in the DOM.
 * Every count and every lookup here is therefore about what is RENDERED, not
 * what the query returned — {@link rowCount} says so in its own doc, and
 * {@link findRowByOrderId} scrolls rather than assuming.
 *
 * ## The list frame outlives the detail pane
 *
 * `/order-history` is a TanStack layout route: the list is rendered by
 * `route.tsx` and stays mounted while `$orderId.tsx` fills the pane beside it.
 * So this page object remains valid after {@link openOrder} navigates, and a
 * spec can go back to filtering without re-navigating.
 */
export class OrderHistoryPage extends BasePage {
  readonly name = 'Order History';

  readonly route: string = Routes.ORDER_HISTORY;

  /**
   * The search box, not a row.
   *
   * A row would be the data-gated anchor `BasePage` asks for, but "this
   * merchant has no orders" is a legitimate, testable state — the app renders
   * its own empty state for it — and anchoring on a row would turn that into a
   * 30s timeout that blames the selector. The header is the frame; specs that
   * need the data gate call {@link waitForRows}, which fails with a count.
   */
  protected readonly readyAnchor: Locator = OrderHistoryIds.searchInput;

  /* --------------------------------------------------------------------- *
   * Listing
   * --------------------------------------------------------------------- */

  /**
   * Type into the search box and let the query settle.
   *
   * `use-order-history-list.ts` runs the term through `useDebounce(…, 300)`
   * before it reaches the GraphQL layer, so returning the moment `setValue`
   * resolves hands the spec the PREVIOUS result set. `Timeouts.DEBOUNCE`
   * (800ms) covers that window with room for the IPC round trip.
   */
  async search(keyword: string): Promise<this> {
    await this.setValue(OrderHistoryIds.searchInput, keyword);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /** Empty the search box and wait for the unfiltered list to come back. */
  async clearSearch(): Promise<this> {
    await this.setValue(OrderHistoryIds.searchInput, '');
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /**
   * How many rows are on screen right now.
   *
   * NOT the size of the result set — the list is virtualised, so this counts
   * what the DOM holds. Use it to prove a filter changed something, never to
   * assert "the merchant has N orders".
   */
  async rowCount(): Promise<number> {
    const rows = await this.findAll(OrderHistoryIds.orderItems, { timeout: Timeouts.SHORT });
    return rows.length;
  }

  /** The order ids of the rendered rows, in list order. */
  async renderedOrderIds(): Promise<string[]> {
    const rows = await this.findAll(OrderHistoryIds.orderItems, { timeout: Timeouts.SHORT });
    const ids: string[] = [];
    for (const row of rows) {
      const id = orderIdFromHref(await row.getAttribute('href'));
      if (id) ids.push(id);
    }
    return ids;
  }

  /** Block until at least `min` rows have rendered. Fails with the count it actually saw. */
  async waitForRows(min = 1, timeout: number = Timeouts.MEDIUM): Promise<this> {
    let seen = 0;
    try {
      await browser.waitUntil(
        async () => {
          seen = await this.rowCount();
          return seen >= min;
        },
        { timeout, interval: 300 },
      );
    } catch {
      throw new Error(
        `${this.name}: expected at least ${String(min)} order row(s) within ${String(timeout)}ms, ` +
          `saw ${String(seen)}. An empty list is a real state here — check the date range and the ` +
          `active filters before blaming the selector.`,
      );
    }
    return this;
  }

  /** The first rendered row's order id, or `null` when the list is empty. */
  async firstOrderId(): Promise<string | null> {
    const [first] = await this.renderedOrderIds();
    return first ?? null;
  }

  /**
   * Locate one order, paging the virtualised list until it shows up.
   *
   * Returns its summary rather than the element: a spec that holds a
   * `WebdriverIO.Element` from a virtualised list is holding a node the
   * virtualiser may unmount on the next scroll. `null` means "not rendered
   * within {@link MAX_SCROLL_PAGES} screens", which for a filtered list is the
   * same answer as "not there".
   */
  async findRowByOrderId(orderId: string): Promise<OrderRowSummary | null> {
    for (let page = 0; page <= MAX_SCROLL_PAGES; page += 1) {
      if (await this.exists(orderHistoryItem(orderId), Timeouts.SHORT)) {
        return this.readRowSummary(orderId);
      }
      if (!(await this.scrollListForward())) {
        this.log.debug(`order ${orderId} not found after ${String(page + 1)} screen(s)`);
        return null;
      }
    }
    return null;
  }

  /** Read one row as data. Throws when the row is not rendered — use {@link findRowByOrderId} first. */
  async readRowSummary(orderId: string): Promise<OrderRowSummary> {
    const row = await this.find(orderHistoryItem(orderId), { timeout: Timeouts.SHORT });
    const text = (await row.getText()).trim();
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const money = MONEY_TOKEN.exec(text);
    if (!money) {
      throw new Error(
        `Order row ${orderId} rendered no currency amount, so its total cannot be read. ` +
          `Text was:\n${text}`,
      );
    }

    return { orderId, lines, text, total: parseMoney(money[0]) };
  }

  /**
   * Open an order's detail pane.
   *
   * Scrolls to the row first, so a spec may name an order that is below the
   * fold without knowing the list is virtualised.
   */
  async openOrder(orderId: string): Promise<typeof orderHistoryDetailPage> {
    if (!(await this.findRowByOrderId(orderId))) {
      throw new Error(
        `Order ${orderId} is not in the list. It may be filtered out, outside the selected ` +
          `date range, or more than ${String(MAX_SCROLL_PAGES)} screens down — search for its ` +
          `order code instead.`,
      );
    }
    await this.click(orderHistoryItem(orderId));
    return orderHistoryDetailPage.waitForOrder(orderId);
  }

  /** Open the first rendered order. Fails when the list is empty rather than returning null. */
  async openFirstOrder(): Promise<typeof orderHistoryDetailPage> {
    await this.waitForRows(1);
    const orderId = await this.firstOrderId();
    if (!orderId) {
      throw new Error(`${this.name}: the list rendered a row without an /order-history/ href.`);
    }
    return this.openOrder(orderId);
  }

  /* --------------------------------------------------------------------- *
   * Filter dialog
   * --------------------------------------------------------------------- */

  /** Open the filter dialog and wait for it to finish animating in. */
  async openFilter(): Promise<this> {
    await this.click(OrderHistoryIds.filterBtn);
    await this.find(OrderHistoryIds.filterDialog, { timeout: Timeouts.SHORT, visible: true });
    return this;
  }

  /**
   * Pick a sort field.
   *
   * Driven from the keyboard on purpose. The options are Radix `SelectItem`s,
   * which reflect neither their `value` nor a testid — their generated `id`
   * embeds a per-mount random `baseId` — so position is the only handle, and
   * `Home` + `ArrowDown` addresses position without a selector at all.
   */
  async sortBy(field: OrderHistorySortField): Promise<this> {
    const index = ORDER_HISTORY_SORT_FIELDS.indexOf(field);
    await this.click(OrderHistoryIds.filterSortTrigger);
    await settle();

    await browser.keys(['Home']);
    for (let step = 0; step < index; step += 1) {
      await browser.keys(['ArrowDown']);
    }
    await browser.keys(['Enter']);
    await settle();
    return this;
  }

  /** Toggle one or more status checkboxes, then dismiss the popover. */
  async filterByStatus(...statusIds: OrderStatusFilterId[]): Promise<this> {
    await this.click(OrderHistoryIds.filterStatusTrigger);
    for (const statusId of statusIds) {
      await this.click(orderHistoryStatusFilter(statusId));
    }
    return this.closeFilterPopover();
  }

  /**
   * Toggle one or more payment-method checkboxes, then dismiss the popover.
   *
   * `method` is the tab spelling (`gift-card`), which is also the DOM id the
   * app hardcodes in `PAYMENT_METHOD_OPTIONS` — not the `gift_card` wire value.
   */
  async filterByPaymentMethod(...methods: PaymentMethod[]): Promise<this> {
    await this.click(OrderHistoryIds.filterPaymentTrigger);
    for (const method of methods) {
      await this.click(orderHistoryPaymentFilter(method));
    }
    return this.closeFilterPopover();
  }

  /**
   * Open the staff column of the filter dialog.
   *
   * Selecting a NAMED staff is deliberately absent. `CheckboxLabel id={staff.id}`
   * gives each row a bare uuid DOM id and nothing else — no testid, no stable
   * class — so the only possible handle is a raw `#<uuid>` built inside this
   * file, which is precisely what `constants/testids.ts` exists to prevent.
   * Declare an `oh-filter-staff-{id}` factory there (the status and payment
   * columns already have that exact shape) and this grows a `selectStaff()`
   * sibling that afternoon.
   */
  async openStaffFilter(): Promise<this> {
    await this.click(OrderHistoryIds.filterStaffTrigger);
    return this;
  }

  /**
   * Dismiss whichever filter popover is open, leaving the dialog itself up.
   *
   * Radix dismisses the topmost layer only, so Escape closes the popover and
   * the filter dialog underneath survives — which is what lets a spec set
   * status, then payment, then confirm in one pass.
   */
  async closeFilterPopover(): Promise<this> {
    await browser.keys(['Escape']);
    await settle();
    return this;
  }

  /**
   * Is Confirm clickable?
   *
   * `order-history-header.tsx` disables it while `tempFilters` still equals the
   * applied filters, so a spec that confirms without changing anything fails on
   * a click timeout that reads like a broken button.
   */
  async canConfirmFilter(): Promise<boolean> {
    const button = await this.find(OrderHistoryIds.filterConfirmBtn, { timeout: Timeouts.SHORT });
    return button.isEnabled();
  }

  /** Apply the pending filters and wait for the dialog to go away. */
  async confirmFilter(): Promise<this> {
    await this.click(OrderHistoryIds.filterConfirmBtn);
    await this.waitGone(OrderHistoryIds.filterDialog, Timeouts.SHORT);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /**
   * Reset the pending filters back to defaults.
   *
   * Clear only edits the dialog's draft state — the list does not change until
   * {@link confirmFilter}, so the two are almost always called together.
   */
  async clearFilter(): Promise<this> {
    await this.click(OrderHistoryIds.filterClearBtn);
    return this;
  }

  /** Open the date-range picker. Its calendar has no declared locators yet. */
  async openDateRange(): Promise<this> {
    await this.click(OrderHistoryIds.dateRangeTrigger);
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Internals
   * --------------------------------------------------------------------- */

  /**
   * Page the virtualised list down by one screen.
   *
   * Scrolls the LAST rendered row into view at the bottom edge, which both
   * advances the virtualiser and trips the `hasNextPage` fetch in
   * `order-history-list.tsx`. Returns `false` once the rendered set stops
   * changing, i.e. the bottom of the loaded data — that is the stop condition,
   * not a fixed number of scrolls.
   */
  private async scrollListForward(): Promise<boolean> {
    const before = await this.renderedOrderIds();
    if (before.length === 0) return false;

    const rows = await this.findAll(OrderHistoryIds.orderItems, { timeout: Timeouts.SHORT });
    const last = rows[rows.length - 1];
    if (!last) return false;

    await last.scrollIntoView({ block: 'end', inline: 'nearest' });
    // The next page arrives over Tauri IPC, so the DOM lags the scroll itself.
    await settle(Timeouts.ANIMATION);

    const after = await this.renderedOrderIds();
    return after.join() !== before.join();
  }
}

/** `/order-history/1f2e…` → `1f2e…`. Anything else is a row we cannot address. */
function orderIdFromHref(href: string | null): string | null {
  if (!href) return null;
  const match = /\/order-history\/([^/?#]+)/.exec(href);
  return match?.[1] ?? null;
}

export default new OrderHistoryPage();
