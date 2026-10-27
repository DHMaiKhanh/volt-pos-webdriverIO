import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import {
  ServicesCss,
  ServicesIds,
  ServicesText,
  servicesCategoryLink,
  servicesCategoryUpdateButton,
  servicesDialogTab,
  servicesSelectOption,
} from '../../constants/testids.settings-services.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle, waitUntilPath } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/** One category row of the Category panel. */
export interface CategoryRow {
  name: string;
  href: string;
  /** Does the row carry its pencil (Update) button? The app omits it for "Other". */
  hasUpdate: boolean;
}

/** One row of the displayed service/product table. */
export interface ServiceRow {
  name: string;
  /** The second line under the name — `''` when the app renders nothing. */
  description: string;
  /** Column 3, as displayed (e.g. `$20.00`). */
  price: string;
  hasSwitch: boolean;
  switchOn: boolean;
  hasEdit: boolean;
}

/** One card in the Reorder dialog's active tab. */
export interface ReorderCard {
  name: string;
  /** The `N Services` / `N Products` line — `null` on the pinned Quick Pay / Gift Card tiles. */
  count: string | null;
  /** The second line as raw text (a price on the All-services tab). */
  subtitle: string | null;
  /** Does any copy of this card carry a drag grip? */
  draggable: boolean;
  /** Is the card tinted (inline background colour)? */
  colored: boolean;
}

/** Which header-button a dialog submits with. */
export type DialogSubmit = 'create' | 'update' | 'add';

const SUBMIT: Record<DialogSubmit, Locator> = {
  create: ServicesIds.dialogCreateBtn,
  update: ServicesIds.dialogUpdateBtn,
  add: ServicesIds.dialogAddBtn,
};

/**
 * Settings → Services & Products — `/settings/services` and
 * `/settings/services/$categoryId`.
 *
 * ## Nothing here persists
 *
 * Every dialog on this screen submits through its header button (Create /
 * Update / Add), and this page object deliberately exposes NO method that
 * presses one. The specs open a dialog, read or type, and close it with Escape —
 * which the app treats as a plain cancel with no discard prompt. The row Status
 * switches and the reorder drag handles save IMMEDIATELY, so they are read and
 * never toggled.
 *
 * ## The displayed table, not "the table"
 *
 * The category detail mounts BOTH the product and the service table and hides
 * one (`<Activity mode="hidden">` → `display:none`). Every table read goes
 * through {@link visibleTable}, and every detail-header control through
 * {@link displayed}.
 */
export class ServicesSettingsPage extends BasePage {
  readonly name = 'Services & Products';

  readonly route: string = Routes.SETTINGS_SERVICES;

  /** A category row — only rendered once the category query returned. */
  protected readonly readyAnchor: Locator = ServicesIds.categoryLinks;

  /* --------------------------------------------------------------------- *
   * Category panel
   * --------------------------------------------------------------------- */

  isCategoryHeadingShown(): Promise<boolean> {
    return this.isVisible(ServicesIds.categoryHeading, Timeouts.MEDIUM);
  }

  isSelectCategoryPlaceholderShown(): Promise<boolean> {
    return this.isVisible(ServicesIds.selectCategoryPlaceholder, Timeouts.MEDIUM);
  }

  /** The category rows currently listed (the active tab's). */
  async categoryRows(): Promise<CategoryRow[]> {
    await this.find(ServicesIds.categoryLinks, { timeout: Timeouts.MEDIUM });
    return browser.execute((css: string) => {
      return Array.from(document.querySelectorAll<HTMLAnchorElement>(css))
        .filter((a) => a.getClientRects().length > 0)
        .map((a) => {
          const clone = a.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('button').forEach((b) => b.remove());
          return {
            name: (clone.textContent ?? '').replace(/\s+/g, ' ').trim(),
            href: a.getAttribute('href') ?? '',
            hasUpdate: a.querySelector('button') !== null,
          };
        });
    }, ServicesCss.categoryLinks);
  }

  async categoryNames(): Promise<string[]> {
    return (await this.categoryRows()).map((row) => row.name);
  }

  async selectCategoryTab(which: 'active' | 'inactive'): Promise<this> {
    const tab = which === 'active' ? ServicesIds.activeTab : ServicesIds.inactiveTab;
    const before = (await this.categoryNames().catch(() => [])).join('|');
    await this.click(tab);
    // The list re-queries; wait for it to differ (or settle when both tabs list the same).
    await browser
      .waitUntil(async () => (await this.categoryNames().catch(() => [])).join('|') !== before, {
        timeout: Timeouts.SHORT,
        interval: 200,
      })
      .catch(() => undefined);
    await settle();
    return this;
  }

  async isCategoryTabSelected(which: 'active' | 'inactive'): Promise<boolean> {
    const el = await this.find(which === 'active' ? ServicesIds.activeTab : ServicesIds.inactiveTab);
    return (
      (await el.getAttribute('aria-selected')) === 'true' ||
      (await el.getAttribute('data-state')) === 'active'
    );
  }

  /** How many tabs a strict "exactly Active" match resolves to, vs a substring match (TC-SVC-05). */
  async activeTabMatchCounts(): Promise<{ exact: number; partial: number }> {
    const exact = await this.findAll(ServicesIds.tabsExactActive, { timeout: Timeouts.SHORT });
    const partial = await this.findAll(ServicesIds.tabsContainingActive, { timeout: Timeouts.SHORT });
    return { exact: exact.length, partial: partial.length };
  }

  /** Open a category by its name; waits for the detail route and its displayed table. */
  async openCategory(name: string): Promise<string> {
    await this.scrollCategoryIntoList(name);
    await this.click(servicesCategoryLink(name));
    const path = await waitUntilPath((p) => /^\/settings\/services\/[^/]+$/.test(p), {
      timeout: Timeouts.NAVIGATION,
      message: `Category "${name}" never opened its detail route`,
    });
    await this.visibleTable();
    await settle();
    return path;
  }

  /**
   * Open the first category whose detail is a SERVICE table with rows — the
   * doc's `MANICURE & PEDICURE` fixture does not exist on every merchant, so
   * the spec asks for "a service category" rather than a name.
   */
  async openFirstServiceCategory(exclude: readonly string[] = []): Promise<string> {
    for (const name of await this.categoryNames()) {
      if (exclude.includes(name)) continue;
      await this.openCategory(name);
      const headers = await this.tableHeaders();
      const isService = headers.some((h) => (ServicesText.durationColumn as readonly string[]).includes(h));
      if (isService && (await this.rowCount()) > 0) return name;
    }
    throw new Error(`${this.name}: no active category opens a service table with rows.`);
  }

  /* --------------------------------------------------------------------- *
   * Category detail
   * --------------------------------------------------------------------- */

  /** The displayed detail `<h2>` (dialogs excluded). */
  async detailHeading(): Promise<string> {
    await this.visibleTable();
    return browser.execute(() => {
      const h2 = Array.from(document.querySelectorAll('h2')).find(
        (el) => !el.closest('[role="dialog"]') && el.getClientRects().length > 0,
      );
      return (h2?.textContent ?? '').trim();
    });
  }

  /** The table the user can see — the other mounted copy is `display:none`. */
  async visibleTable(): Promise<WebdriverIO.Element> {
    return this.displayed(ServicesIds.tables, Timeouts.MEDIUM);
  }

  /** How many `<table>` are mounted in the document, and how many are displayed (TC-SVC-37). */
  async tableCounts(): Promise<{ total: number; visible: number }> {
    const all = await this.findAll(ServicesIds.tables, { timeout: Timeouts.SHORT });
    let visible = 0;
    for (const table of all) if (await table.isDisplayed()) visible += 1;
    return { total: all.length, visible };
  }

  /** Header cells of the displayed table, trimmed (`''` for the icon-only drag column). */
  async tableHeaders(): Promise<string[]> {
    const table = await this.visibleTable();
    return browser.execute(
      (el: HTMLElement) =>
        Array.from(el.querySelectorAll('thead th')).map((th) =>
          (th.textContent ?? '').replace(/\s+/g, ' ').trim(),
        ),
      table as unknown as HTMLElement,
    );
  }

  async rowCount(): Promise<number> {
    return (await this.rows()).length;
  }

  /** Every body row of the displayed table. */
  async rows(): Promise<ServiceRow[]> {
    const table = await this.visibleTable();
    await settle();
    return browser.execute(
      (el: HTMLElement, editLabels: readonly string[]) =>
        Array.from(el.querySelectorAll('tbody tr')).map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td'));
          const spans = cells[1] ? Array.from(cells[1].querySelectorAll('span')) : [];
          const sw = tr.querySelector('[role="switch"]');
          const buttons = Array.from(tr.querySelectorAll('button'));
          return {
            name: (spans[0]?.textContent ?? '').trim(),
            description: (spans[1]?.textContent ?? '').trim(),
            price: (cells[2]?.textContent ?? '').trim(),
            hasSwitch: sw !== null,
            switchOn:
              sw?.getAttribute('aria-checked') === 'true' || sw?.getAttribute('data-state') === 'checked',
            hasEdit: buttons.some((b) => editLabels.includes((b.textContent ?? '').trim())),
          };
        }),
      table as unknown as HTMLElement,
      ServicesText.edit,
    );
  }

  /* --------------------------------------------------------------------- *
   * Status filter
   * --------------------------------------------------------------------- */

  async statusFilterText(): Promise<string> {
    return (await (await this.displayed(ServicesIds.statusFilters)).getText()).trim();
  }

  /** Open the status filter and return its option labels. Leaves the listbox OPEN. */
  async openStatusFilter(): Promise<string[]> {
    const trigger = await this.displayed(ServicesIds.statusFilters);
    await trigger.click();
    const options = await this.findAll(ServicesIds.selectOptions, { timeout: Timeouts.MEDIUM });
    const labels: string[] = [];
    for (const option of options) labels.push((await option.getText()).trim());
    return labels;
  }

  /** Pick a status (`ServicesText.all|active|inactive`) and wait for the table to re-query. */
  async chooseStatusFilter(pair: readonly string[]): Promise<this> {
    if (!(await this.exists(ServicesIds.selectOptions, Timeouts.ANIMATION))) {
      await (await this.displayed(ServicesIds.statusFilters)).click();
    }
    await this.click(servicesSelectOption(pair));
    // The table re-queries after the trigger updates; a fixed debounce raced it.
    // Wait for the label to flip, then for the row count to hold steady.
    await browser.waitUntil(async () => pair.includes(await this.statusFilterText()), {
      timeout: Timeouts.MEDIUM,
      timeoutMsg: `Status filter never showed ${pair.join(' / ')}`,
    });
    let previous = -1;
    await browser.waitUntil(
      async () => {
        await settle(Timeouts.DEBOUNCE);
        const count = (await this.rows()).length;
        const stable = count === previous;
        previous = count;
        return stable;
      },
      { timeout: Timeouts.MEDIUM, timeoutMsg: 'Service table never settled after filtering' },
    );
    return this;
  }

  /** Is a "no results" empty state shown in place of rows? */
  isEmptyStateShown(): Promise<boolean> {
    return this.isVisible(ServicesIds.emptyState, Timeouts.ANIMATION);
  }

  /* --------------------------------------------------------------------- *
   * Opening dialogs (never submitting them)
   * --------------------------------------------------------------------- */

  async openCreateCategory(): Promise<this> {
    await this.click(ServicesIds.createCategoryButton);
    await this.dialog();
    return this;
  }

  async openUpdateCategory(name: string): Promise<this> {
    await this.click(servicesCategoryUpdateButton(name));
    await this.dialog();
    return this;
  }

  /** The `+` in the displayed detail header — Add New Item (service or product variant). */
  async openAddItem(): Promise<this> {
    const button = await this.displayed(ServicesIds.addItemButtons);
    await button.waitForClickable({ timeout: Timeouts.SHORT });
    await button.click();
    await this.dialog();
    return this;
  }

  /** The Edit button of the displayed table's row `index` (0-based). */
  async openEditRow(index: number): Promise<this> {
    const table = await this.visibleTable();
    const rows = await table.$$('tbody tr').getElements();
    const row = rows[index];
    if (!row) throw new Error(`${this.name}: no table row ${String(index)} (only ${String(rows.length)}).`);
    const buttons = await row.$$('button').getElements();
    let edit: WebdriverIO.Element | undefined;
    for (const button of buttons) {
      const label = ((await button.getProperty('textContent')) as string | null)?.trim() ?? '';
      if ((ServicesText.edit as readonly string[]).includes(label)) edit = button;
    }
    if (!edit) throw new Error(`${this.name}: row ${String(index)} has no Edit button.`);
    await edit.scrollIntoView({ block: 'center' });
    await edit.click();
    await this.dialog();
    return this;
  }

  async openReorder(): Promise<this> {
    await this.click(ServicesIds.reorderButton);
    await this.dialog();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Inside the open dialog
   * --------------------------------------------------------------------- */

  isDialogOpen(): Promise<boolean> {
    return this.isVisible(ServicesIds.dialog, Timeouts.ANIMATION);
  }

  async dialogTitle(): Promise<string> {
    const dialog = await this.dialog();
    const title = await this.find(ServicesIds.dialogTitle, { within: dialog, timeout: Timeouts.SHORT });
    return (await title.getText()).trim();
  }

  /** Every button label in the dialog (sr-only text included; swatches read as `''`). */
  async dialogButtonLabels(): Promise<string[]> {
    const dialog = await this.dialog();
    return browser.execute(
      (el: HTMLElement) =>
        Array.from(el.querySelectorAll('button'))
          .filter((b) => b.getAttribute('role') !== 'switch' && b.getAttribute('role') !== 'checkbox')
          .map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim()),
      dialog as unknown as HTMLElement,
    );
  }

  /** Colour swatches — the dialog's nameless, role-less buttons. */
  async dialogSwatchCount(): Promise<number> {
    const dialog = await this.dialog();
    // 1.1.56 renders each swatch as `div[role=button]` coloured through a
    // `--color` custom property (`bg-[var(--color)]`), not a `<button>`.
    return browser.execute(
      (el: HTMLElement) => el.querySelectorAll('[role="button"][style*="--color"]').length,
      dialog as unknown as HTMLElement,
    );
  }

  async dialogNameValue(): Promise<string> {
    return (await (await this.inDialog(ServicesIds.dialogNameInput)).getValue()) ?? '';
  }

  async dialogNamePlaceholder(): Promise<string> {
    return (await (await this.inDialog(ServicesIds.dialogNameInput)).getAttribute('placeholder')) ?? '';
  }

  async typeDialogName(text: string): Promise<this> {
    const input = await this.inDialog(ServicesIds.dialogNameInput);
    await input.setValue(text);
    await settle();
    return this;
  }

  async isSubmitEnabled(which: DialogSubmit): Promise<boolean> {
    return (await this.inDialog(SUBMIT[which])).isEnabled();
  }

  /** `aria-checked` of every switch in the dialog, in render order. */
  async dialogSwitchStates(): Promise<boolean[]> {
    const dialog = await this.dialog();
    const switches = await this.findAll(ServicesIds.dialogSwitches, {
      within: dialog,
      timeout: Timeouts.SHORT,
    });
    const states: boolean[] = [];
    for (const sw of switches) states.push((await sw.getAttribute('aria-checked')) === 'true');
    return states;
  }

  /** Visible text of every combobox in the dialog (category select, duration selects). */
  async dialogComboboxTexts(): Promise<string[]> {
    const dialog = await this.dialog();
    const boxes = await this.findAll(ServicesIds.dialogComboboxes, {
      within: dialog,
      timeout: Timeouts.ANIMATION,
    });
    const texts: string[] = [];
    for (const box of boxes) texts.push((await box.getText()).trim());
    return texts;
  }

  /** The whole dialog's visible text — for label presence checks. */
  async dialogText(): Promise<string> {
    return (await (await this.dialog()).getText()).replace(/\s+/g, ' ');
  }

  async isFlexiblePricingChecked(): Promise<boolean> {
    const box = await this.inDialog(ServicesIds.dialogFlexiblePricing);
    return (
      (await box.getAttribute('aria-checked')) === 'true' ||
      (await box.getAttribute('data-state')) === 'checked'
    );
  }

  async toggleFlexiblePricing(): Promise<this> {
    const box = await this.inDialog(ServicesIds.dialogFlexiblePricing);
    await box.click();
    await settle();
    return this;
  }

  async priceValue(): Promise<string> {
    return (await (await this.inDialog(ServicesIds.dialogPriceInput)).getValue()) ?? '';
  }

  async isPriceDisabled(): Promise<boolean> {
    return !(await (await this.inDialog(ServicesIds.dialogPriceInput)).isEnabled());
  }

  async supplyFeeValue(): Promise<string> {
    return (await (await this.inDialog(ServicesIds.dialogSupplyFeeInput)).getValue()) ?? '';
  }

  async hasDialogField(which: 'name' | 'price' | 'supplyFee' | 'description'): Promise<boolean> {
    const map: Record<typeof which, Locator> = {
      name: ServicesIds.dialogNameInput,
      price: ServicesIds.dialogPriceInput,
      supplyFee: ServicesIds.dialogSupplyFeeInput,
      description: ServicesIds.dialogDescription,
    };
    const dialog = await this.dialog();
    return this.findAll(map[which], { within: dialog, timeout: Timeouts.ANIMATION }).then(
      (l) => l.length > 0,
    );
  }

  /** Type into the price mask WITHOUT clearing (the doc's `pressSequentially`). Unlocks Flexible Pricing first. */
  async appendToPrice(text: string): Promise<this> {
    const input = await this.enabledPrice();
    await input.click();
    await browser.keys(['End']);
    await browser.keys(text.split(''));
    await settle();
    return this;
  }

  /** Select-all then type digits into the price mask. Unlocks Flexible Pricing first. */
  async replacePrice(digits: string): Promise<this> {
    const input = await this.enabledPrice();
    await input.click();
    await browser.keys(['Control', 'a']);
    await browser.keys(['Control']); // release the modifier before typing
    await browser.keys(digits.split(''));
    await settle();
    return this;
  }

  /** Escape — the app's no-confirm cancel. Resolves once the dialog is gone. */
  async closeDialogWithEscape(): Promise<this> {
    await browser.keys(['Escape']);
    await this.waitGone(ServicesIds.dialog, Timeouts.SHORT);
    return this;
  }

  /** Press Escape until no dialog / listbox is left — test hygiene between cases. */
  async closeAnything(): Promise<void> {
    for (let i = 0; i < 3; i += 1) {
      const open =
        (await this.exists(ServicesIds.dialog, Timeouts.ANIMATION)) ||
        (await this.exists(ServicesIds.selectOptions, Timeouts.ANIMATION));
      if (!open) return;
      await browser.keys(['Escape']);
      await settle();
    }
  }

  /* --------------------------------------------------------------------- *
   * Reorder dialog
   * --------------------------------------------------------------------- */

  async reorderTabs(): Promise<{ label: string; selected: boolean }[]> {
    const dialog = await this.dialog();
    const tabs = await this.findAll(ServicesIds.dialogTabs, { within: dialog, timeout: Timeouts.SHORT });
    const out: { label: string; selected: boolean }[] = [];
    for (const tab of tabs) {
      out.push({
        label: (await tab.getText()).trim(),
        selected: (await tab.getAttribute('aria-selected')) === 'true',
      });
    }
    return out;
  }

  async selectReorderTab(pair: readonly string[]): Promise<this> {
    await this.inDialogClick(servicesDialogTab(pair));
    await settle();
    return this;
  }

  /**
   * The cards of one region of the dialog's ACTIVE tab, in DOM order.
   *
   * 1.1.56 shows two regions: a read-only PREVIEW row (the pinned Quick Pay and
   * Gift Card tiles, then only the categories that have items) above the
   * draggable GRID (every category, empty ones included — each card carries a
   * grip button). A name can appear in both, and "Gift Card" can be both a
   * pinned tile and a real category, so the regions are read apart, never merged.
   */
  async reorderCards(region: 'preview' | 'grid' = 'preview'): Promise<ReorderCard[]> {
    const dialog = await this.dialog();
    await settle();
    return browser.execute(
      (el: HTMLElement, panelCss: string, wanted: string) => {
        const panel = el.querySelector(panelCss) ?? el;
        const cards: {
          name: string;
          count: string | null;
          subtitle: string | null;
          draggable: boolean;
          colored: boolean;
        }[] = [];
        for (const h3 of Array.from(panel.querySelectorAll('h3'))) {
          let card: HTMLElement | null = h3;
          for (let i = 0; i < 4 && card && !card.style.backgroundColor; i += 1) card = card.parentElement;
          const hasGrip = card ? card.querySelector('button') !== null : false;
          if ((wanted === 'grid') !== hasGrip) continue;
          const sub = h3.nextElementSibling;
          const subtitle = sub ? (sub.textContent ?? '').trim() : null;
          cards.push({
            name: (h3.textContent ?? '').trim(),
            count: subtitle !== null && /\d/.test(subtitle) && !subtitle.includes('$') ? subtitle : null,
            subtitle,
            draggable: hasGrip,
            colored: Boolean(card?.style.backgroundColor),
          });
        }
        return cards;
      },
      dialog as unknown as HTMLElement,
      ServicesCss.activeTabpanel,
      region,
    );
  }

  /** Track count of the grid in the active tab (`grid-template-columns`). */
  async reorderGridColumns(): Promise<number> {
    const dialog = await this.dialog();
    return browser.execute(
      (el: HTMLElement, panelCss: string) => {
        const panel = el.querySelector(panelCss) ?? el;
        const grids = Array.from(panel.querySelectorAll<HTMLElement>('*')).filter(
          (node) => window.getComputedStyle(node).display === 'grid' && node.querySelector('h3'),
        );
        const grid = grids[grids.length - 1];
        if (!grid) return 0;
        return window.getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      },
      dialog as unknown as HTMLElement,
      ServicesCss.activeTabpanel,
    );
  }

  /* --------------------------------------------------------------------- *
   * Internals
   * --------------------------------------------------------------------- */

  /**
   * The category list is virtualised: only the rows near the scroll position are
   * mounted, so after visiting a category far down the list an early one is not
   * in the DOM at all. Scroll the list from the top until the named row mounts.
   */
  private async scrollCategoryIntoList(name: string): Promise<void> {
    await browser.execute(async (wanted: string) => {
      const links = (): HTMLAnchorElement[] =>
        Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/settings/services/"]'));
      // A row's text also carries its "Update" button label — compare the first line only.
      const label = (a: HTMLElement): string => (a.innerText.split('\n')[0] ?? '').trim();
      const mounted = (): boolean => links().some((a) => label(a) === wanted);
      if (mounted()) return;
      let scroller: HTMLElement | null = links()[0]?.parentElement ?? null;
      while (scroller && !/(auto|scroll)/.test(window.getComputedStyle(scroller).overflowY)) {
        scroller = scroller.parentElement;
      }
      if (!scroller) return;
      for (let top = 0; top <= scroller.scrollHeight; top += scroller.clientHeight / 2) {
        scroller.scrollTop = top;
        // The virtualiser re-renders on the next frame after the scroll event.
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (mounted()) return;
      }
    }, name);
    await settle();
  }

  /** The open dialog (topmost). */
  private async dialog(): Promise<WebdriverIO.Element> {
    return this.find(ServicesIds.dialog, { visible: true, timeout: Timeouts.MEDIUM });
  }

  private async inDialog(loc: Locator): Promise<WebdriverIO.Element> {
    const dialog = await this.dialog();
    return this.find(loc, { within: dialog, timeout: Timeouts.SHORT });
  }

  private async inDialogClick(loc: Locator): Promise<void> {
    const el = await this.inDialog(loc);
    await el.waitForClickable({ timeout: Timeouts.SHORT });
    await el.click();
  }

  /** The price input, enabled — unticks Flexible Pricing when it is locking the field. */
  private async enabledPrice(): Promise<WebdriverIO.Element> {
    if (await this.isPriceDisabled()) await this.toggleFlexiblePricing();
    const input = await this.inDialog(ServicesIds.dialogPriceInput);
    await input.waitForEnabled({ timeout: Timeouts.SHORT });
    return input;
  }

  /** First DISPLAYED match of a locator that matches one copy per mounted table. */
  private async displayed(loc: Locator, timeout: number = Timeouts.SHORT): Promise<WebdriverIO.Element> {
    const deadline = Date.now() + timeout;
    do {
      const all = await this.findAll(loc, { timeout: Timeouts.ANIMATION });
      for (const el of all) {
        if (await el.isDisplayed()) return el;
      }
      await settle(200);
    } while (Date.now() < deadline);
    throw new Error(`${this.name}: no displayed "${loc.name}" within ${String(timeout)}ms.`);
  }
}

export default new ServicesSettingsPage();
