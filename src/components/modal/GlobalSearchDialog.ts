import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { locator, inputWithAnyPlaceholder } from '../../helpers/selectors.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { BaseComponent } from '../BaseComponent.js';

/**
 * The header's global Customer & Order search (VP-802 TC-ORDERFLOW-74/75).
 *
 * The header carries a small `placeholder="Search..."` input (top-right). Clicking
 * it opens a `data-slot="dialog-content"` whose own input reads "Search by customer
 * Name or Phone, Order ID, QR Code" and whose `tabs-list` holds exactly four tabs:
 * **All / Appointment / Customer / Order** — no "Checkin" tab (the Linear note that
 * listed five was wrong against the live UI). Typing filters; the Order tab lists
 * matching orders and opening one routes to its Order History detail.
 *
 * Build 1.1.x ships no data-testid here, so the locators key off the unique
 * placeholder and the Radix `role`/`data-slot` attributes. The dialog is scoped by
 * its own input placeholder rather than a bare `data-slot="dialog-content"` so it
 * can never resolve to some other dialog the app keeps mounted.
 */

const PLACEHOLDER_EN = 'Search by customer Name or Phone, Order ID, QR Code';
const PLACEHOLDER_VI = 'Tìm theo tên hoặc SĐT khách, mã đơn, mã QR';

/** XPath anchor for "the dialog that is the global search", by its own input. */
const DIALOG_XPATH =
  `//*[@data-slot="dialog-content"]` +
  `[.//input[@placeholder=${xq(PLACEHOLDER_EN)} or @placeholder=${xq(PLACEHOLDER_VI)}]]`;

/** Quote a string for use as an XPath literal. */
function xq(s: string): string {
  return s.includes('"') ? `concat("${s.replace(/"/g, '",\'"\',"')}")` : `"${s}"`;
}

const Ids = {
  /** The header trigger. The input itself collapses to width 0 (a magnifier), so
   *  the clickable thing is its `input-wrapper` box; identify it by the "Search..."
   *  input it wraps. The other search boxes are "Search staff/service" and the
   *  pending list's longer string. */
  trigger: locator(
    'global search trigger',
    'global-search-trigger',
    '//div[contains(@class,"input-wrapper")][.//input[@placeholder="Search..." or @placeholder="Tìm kiếm..."]]',
    'input[placeholder="Search..."]',
  ),
  input: locator(
    'global search input',
    'global-search-input',
    inputWithAnyPlaceholder(PLACEHOLDER_EN, PLACEHOLDER_VI),
  ),
} satisfies Record<string, Locator>;

const anyTab: Locator = locator('global search tab', 'global-search-tab', `${DIALOG_XPATH}//*[@role="tab"]`);

const tabByText = (name: string): Locator =>
  locator(
    `global search "${name}" tab`,
    `global-search-tab-${name}`,
    `${DIALOG_XPATH}//*[@role="tab"][normalize-space()=${xq(name)}]`,
  );

const resultContaining = (needle: string): Locator =>
  locator(
    `global search result "${needle}"`,
    `global-search-result-${needle}`,
    `${DIALOG_XPATH}//*[(contains(@class,"cursor-pointer") or self::button or @role="option")][contains(normalize-space(.),${xq(needle)})]`,
  );

export class GlobalSearchDialog extends BaseComponent {
  readonly name = 'global search';
  protected readonly root: Locator = locator('global search dialog', 'global-search-dialog', DIALOG_XPATH);

  /** Focus the header trigger and wait for the dialog. No-op if already open. */
  async open(): Promise<this> {
    await logStep('Global search: open');
    if (await this.isOpen(Timeouts.SHORT)) return this;
    await this.click(Ids.trigger);
    // Build 1.1.x expands the dialog on the FIRST keystroke, not on focus alone;
    // the seed char is cleared by the next {@link type}. Sent to the focused
    // trigger via the keyboard so it works whether the box is the same element
    // that re-renders inside the dialog or a separate one.
    await browser.keys(['a']);
    await this.waitOpen();
    return this;
  }

  /** Type a query into the dialog's input (real keystrokes, so React filters). */
  async type(query: string): Promise<this> {
    await logStep(`Global search: type "${query}"`);
    await this.setValue(Ids.input, query);
    await settle();
    return this;
  }

  async close(): Promise<this> {
    await browser.keys(['Escape']);
    await this.waitClosed(Timeouts.SHORT).catch(() => {
      /* already gone */
    });
    return this;
  }

  /** The tab labels in the dialog, in render order (expected: All/Appointment/Customer/Order). */
  async tabLabels(): Promise<string[]> {
    const tabs = await this.insideAll(anyTab);
    const out: string[] = [];
    for (const t of tabs) out.push(((await t.getText()) || '').trim());
    return out.filter(Boolean);
  }

  async selectTab(name: string): Promise<this> {
    await this.click(tabByText(name));
    await settle();
    return this;
  }

  /** Is a result row whose text contains `needle` (e.g. an order id) on screen? */
  hasResult(needle: string, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    return this.isVisible(resultContaining(needle), timeout);
  }

  /** Open the result row whose text contains `needle`. */
  async openResult(needle: string): Promise<this> {
    await logStep(`Global search: open result "${needle}"`);
    await this.click(resultContaining(needle));
    await settle();
    return this;
  }
}

export const globalSearch = new GlobalSearchDialog();
