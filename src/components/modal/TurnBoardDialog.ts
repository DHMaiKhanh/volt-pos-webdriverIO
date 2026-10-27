import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import {
  TURN_QUICK_VIEW_POSITION_KEY,
  TURN_SORT_LABELS,
  TurnAdjustIds,
  TurnBoardIds,
  TurnDatePickerIds,
  TurnQuickViewIds,
  TurnSettingsIds,
  turnCalendarDay,
} from '../../constants/testids.turn.js';
import { currentRoutePath, goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { BaseComponent } from '../BaseComponent.js';

/** How the board orders its rows. Keys of `TURN_SORT_LABELS` (`turn.sort*`). */
export type TurnSort = 'countAsc' | 'countDesc' | 'checkinAsc' | 'checkinDesc';

/** Search-param value that opens the board (`TURN_DIALOG_KEY` in the app). */
export const TURN_DIALOG_PARAM = 'turn-board';

/** Routes that render the floating Turn Quick View (`pathTurnQuickView` in `_app.tsx`). */
export const TURN_QUICK_VIEW_ROUTES = [Routes.HOME, Routes.ORDER_PENDING, Routes.ORDER_HISTORY] as const;

/** One staff member's line on the board. */
export interface TurnRow {
  /** 1-based rank badge in the current sort. */
  rank: number;
  staff: string;
  /** Text of the avatar (the nickname's first letter) — `''` when the staff has a photo. */
  avatarText: string;
  /** The turn count as rendered — may carry decimals. */
  turnCountText: string;
  /** {@link turnCountText} as a number (`0` when unparseable). */
  turnCount: number;
  /** The unit next to the count: `Turn` / `Turns` / `Lượt`. */
  unit: string;
  /** Every text fragment of the row in DOM order, for assertions this interface has not named. */
  cells: string[];
}

/** One row of the Adjust Manual Turn dialog. */
export interface TurnAdjustRow {
  staff: string;
  /** Raw "Current: x" paragraph. */
  currentText: string;
  current: number;
  /** The stepper's pending value as rendered. */
  valueText: string;
  value: number;
  decreaseEnabled: boolean;
  increaseEnabled: boolean;
  saveEnabled: boolean;
  resetEnabled: boolean;
}

/** What the Turn Settings form currently shows. */
export interface TurnSettingsState {
  serviceBased: boolean;
  decimal: boolean;
  decimalEnabled: boolean;
  turnValueText: string;
  turnValueEnabled: boolean;
  /** {@link turnValueText} in integer cents (`$25.00` → 2500). */
  turnValueCents: number;
  helperShown: boolean;
}

/** One rendered day cell of the date picker's month grid. */
export interface TurnCalendarDay {
  /** `yyyy-MM-dd` from react-day-picker's `data-day`. */
  iso: string;
  label: string;
  disabled: boolean;
  today: boolean;
  selected: boolean;
  outside: boolean;
}

/** One row of the quick-view popover. */
export interface TurnQuickViewRow {
  rank: number;
  staff: string;
  turnCountText: string;
}

/** `textContent` of an element, trimmed — immune to the WebView2 empty-`getText()` quirk. */
async function textContentOf(el: WebdriverIO.Element): Promise<string> {
  const raw = await el.getProperty('textContent');
  return typeof raw === 'string' ? raw.trim() : '';
}

const parseNumber = (text: string): number => {
  const match = /-?\d+(?:\.\d+)?/.exec(text.replace(/,/g, ''));
  return match ? Number.parseFloat(match[0]) : 0;
};

/** `$1,234.56` → 123456. */
const parseCents = (text: string): number => {
  const digits = text.replace(/[^\d]/g, '');
  return digits === '' ? 0 : Number.parseInt(digits, 10);
};

/**
 * The Turn board dialog (`volt-pos/src/components/turn-board/`).
 *
 * ## It is a dialog addressed by a search param
 *
 * `TurnBoardDialog` is mounted app-wide in `_app.tsx` and opens whenever the
 * `dialog` search param equals `turn-board` — on ANY `_app` route. The sidebar
 * entry and the quick view's "View Turn" both just set that param. So
 * {@link open} drives the router ({@link goTo} with `search`) on the current
 * route, which is the same navigation the sidebar performs without depending
 * on the drawer.
 *
 * ## The board is not a table
 *
 * Since the 2026 rebuild each staff is a `div` row — rank `span`, avatar,
 * nickname `p`, count `span` + unit `span` (`turn-board-row.tsx`). Rows are
 * read in ONE `execute` against the dialog element so a re-render mid-read
 * cannot leave half a list.
 *
 * ## Child dialogs
 *
 * "Adjust Turn" and "Setting" open their own Radix dialogs, portalled beside
 * this one; their methods address them by their own titles.
 *
 * Turn Settings is merchant-GLOBAL (`sys_setting.merchant_turn_default`) —
 * callers that save it must restore it (`@exclusive`).
 */
export class TurnBoardDialog extends BaseComponent {
  readonly name = 'turn board';

  protected readonly root: Locator = TurnBoardIds.dialog;

  /* --------------------------------------------------------------------- *
   * Opening / closing
   * --------------------------------------------------------------------- */

  /**
   * Open the board through its search param on the current route (or `/home`
   * when the current route is outside the app shell). Idempotent.
   */
  async open(route?: string): Promise<this> {
    if (route === undefined && (await this.isOpen(Timeouts.ANIMATION))) return this;
    const target = route ?? (await this.appRouteOrHome());
    await logStep(`Open the turn board on ${target}`);
    await goTo(target, { search: { dialog: TURN_DIALOG_PARAM } });
    await this.waitOpen();
    await settle();
    return this;
  }

  /** Press the hamburger drawer's "Turn" entry. The drawer must already be open (`appNav.openSidebar()`). */
  async pressSidebarEntry(): Promise<this> {
    await logStep('Sidebar → Turn');
    await this.click(TurnBoardIds.sidebarEntry);
    return this;
  }

  /** Close with the header's Close button. */
  async closeWithButton(): Promise<void> {
    await this.click(TurnBoardIds.close, { within: await this.rootEl() });
    await this.waitClosed(Timeouts.MEDIUM);
  }

  /** Close with Escape (closes only the TOPMOST layer — see {@link pressEscape}). */
  async close(): Promise<void> {
    if (!(await this.isOpen(Timeouts.ANIMATION))) return;
    await browser.keys(['Escape']);
    await this.waitClosed(Timeouts.MEDIUM);
  }

  /** One Escape keypress, no waiting on any particular layer. */
  async pressEscape(): Promise<void> {
    await browser.keys(['Escape']);
    await settle();
  }

  /** The `dialog` search param of the current URL, or `null`. */
  async currentDialogParam(): Promise<string | null> {
    return browser.execute(function () {
      return new URLSearchParams(window.location.search).get('dialog');
    });
  }

  /** How many Radix dialogs are open right now (any dialog, not just this one). */
  async openDialogCount(): Promise<number> {
    return browser.execute(function () {
      return Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"]')).filter(
        function (el) {
          const state = el.getAttribute('data-state');
          return state === null || state === 'open';
        },
      ).length;
    });
  }

  /** The dialog's heading text. */
  async titleText(): Promise<string> {
    return this.text(TurnBoardIds.title, { within: await this.rootEl() });
  }

  /** Which toolbar controls are on screen. */
  async toolbar(): Promise<{ date: boolean; sort: boolean; adjust: boolean; setting: boolean }> {
    const root = await this.rootEl();
    const has = async (loc: Locator): Promise<boolean> => {
      try {
        const el = await this.find(loc, { within: root, visible: true, timeout: Timeouts.SHORT });
        return await el.isDisplayed();
      } catch {
        return false;
      }
    };
    return {
      date: await has(TurnBoardIds.dateButton),
      sort: await has(TurnBoardIds.sortSelect),
      adjust: await has(TurnBoardIds.adjustButton),
      setting: await has(TurnBoardIds.settingsButton),
    };
  }

  /* --------------------------------------------------------------------- *
   * Reading the board
   * --------------------------------------------------------------------- */

  /** Is the "No staff clocked in for this day" state showing? */
  async hasNoStaff(timeout: number = Timeouts.SHORT): Promise<boolean> {
    try {
      const el = await this.inside(TurnBoardIds.noStaff, { timeout, visible: true });
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Every row on the board, in display order.
   *
   * Waits for the list to leave its loading skeleton (rows or the empty state
   * present) before reading.
   */
  async rows(): Promise<TurnRow[]> {
    const root = await this.rootEl(Timeouts.MEDIUM);
    await browser.waitUntil(
      async () => (await this.readRows(root)).length > 0 || (await this.hasNoStaff(Timeouts.ANIMATION)),
      { timeout: Timeouts.MEDIUM, interval: 200, timeoutMsg: 'Turn board never left its loading state.' },
    );
    return this.readRows(root);
  }

  /** Staff names in board order. */
  async staffOrder(): Promise<string[]> {
    return (await this.rows()).map((row) => row.staff);
  }

  /** One staff member's row, or `null`. Exact nickname match. */
  async rowFor(staffName: string): Promise<TurnRow | null> {
    return (await this.rows()).find((row) => row.staff === staffName) ?? null;
  }

  /** Click a row (by 0-based board index). Rows are inert in the app — the spec asserts nothing opened. */
  async clickRow(index: number): Promise<void> {
    const root = await this.rootEl();
    const rows = await this.rowElements(root);
    const row = rows[index];
    if (!row) throw new Error(`Turn board has no row at index ${index} (rows: ${rows.length}).`);
    await row.click();
    await settle();
  }

  /** Text of the date trigger (`MM/DD/YYYY` in EN, `DD/MM/YYYY` in VI). */
  async dateText(): Promise<string> {
    return this.text(TurnBoardIds.dateButton, { within: await this.rootEl() });
  }

  /** The sort trigger's current value text. */
  async sortText(): Promise<string> {
    return this.text(TurnBoardIds.sortSelect, { within: await this.rootEl() });
  }

  /* --------------------------------------------------------------------- *
   * Sort
   * --------------------------------------------------------------------- */

  /** Re-sort the board. */
  async setSort(sort: TurnSort): Promise<this> {
    const { en, vi } = TURN_SORT_LABELS[sort];
    await logStep(`Turn board: sort "${en}"`);
    await this.click(TurnBoardIds.sortSelect, { within: await this.rootEl() });

    const options = await this.findAll(TurnBoardIds.openListboxOptions, { timeout: Timeouts.SHORT });
    for (const option of options) {
      const text = (await option.getText()).trim();
      if (text === en || text === vi) {
        await option.click();
        await settle();
        return this;
      }
    }
    await browser.keys(['Escape']);
    throw new Error(`Turn board: the sort dropdown offers no "${en}" / "${vi}" option.`);
  }

  /** Open the sort dropdown, read every option (text + selected), close it again. */
  async sortOptions(): Promise<Array<{ text: string; selected: boolean }>> {
    await this.click(TurnBoardIds.sortSelect, { within: await this.rootEl() });
    const options = await this.findAll(TurnBoardIds.openListboxOptions, { timeout: Timeouts.SHORT });
    const out: Array<{ text: string; selected: boolean }> = [];
    for (const option of options) {
      const text = (await option.getText()).trim() || (await textContentOf(option));
      const selected =
        (await option.getAttribute('aria-selected')) === 'true' ||
        (await option.getAttribute('data-state')) === 'checked';
      out.push({ text, selected });
    }
    await browser.keys(['Escape']);
    await settle();
    return out;
  }

  /* --------------------------------------------------------------------- *
   * Date picker
   * --------------------------------------------------------------------- */

  async openDatePicker(): Promise<this> {
    if (await this.isVisible(TurnDatePickerIds.popover, Timeouts.ANIMATION)) return this;
    await this.click(TurnBoardIds.dateButton, { within: await this.rootEl() });
    await this.find(TurnDatePickerIds.popover, { visible: true, timeout: Timeouts.SHORT });
    await settle();
    return this;
  }

  /** Close the picker popover with Escape (leaves the board open). */
  async closeDatePicker(): Promise<void> {
    if (!(await this.isVisible(TurnDatePickerIds.popover, Timeouts.ANIMATION))) return;
    await browser.keys(['Escape']);
    await this.waitGone(TurnDatePickerIds.popover, Timeouts.SHORT);
  }

  async isDatePickerOpen(): Promise<boolean> {
    return this.isVisible(TurnDatePickerIds.popover, Timeouts.ANIMATION);
  }

  /** Structure of the open picker. */
  async datePickerStructure(): Promise<{ dropdowns: number; gridLabel: string; weekdays: string[] }> {
    const pop = await this.find(TurnDatePickerIds.popover, { visible: true });
    const dropdowns = await this.findAll(TurnDatePickerIds.dropdowns, {
      within: pop,
      timeout: Timeouts.SHORT,
    });
    let gridLabel = '';
    try {
      const grid = await this.find(TurnDatePickerIds.grid, { within: pop, timeout: Timeouts.SHORT });
      gridLabel = (await grid.getAttribute('aria-label')) ?? '';
    } catch {
      gridLabel = '';
    }
    const headers = await this.findAll(TurnDatePickerIds.columnHeaders, {
      within: pop,
      timeout: Timeouts.SHORT,
    });
    const weekdays: string[] = [];
    for (const h of headers) weekdays.push(await textContentOf(h));
    return { dropdowns: dropdowns.length, gridLabel, weekdays };
  }

  /** Every day cell rendered in the open picker's month grid. */
  async calendarDays(): Promise<TurnCalendarDay[]> {
    const pop = await this.find(TurnDatePickerIds.popover, { visible: true });
    return browser.execute(
      (el: HTMLElement) =>
        Array.from(el.querySelectorAll('td[data-day]')).map((td) => {
          const button = td.querySelector('button');
          const flag = (name: string): boolean => {
            const v = td.getAttribute(name);
            return v !== null && v !== 'false';
          };
          return {
            iso: td.getAttribute('data-day') ?? '',
            label: button?.getAttribute('aria-label') ?? '',
            disabled: flag('data-disabled') || (button ? button.disabled : true),
            today: flag('data-today'),
            selected: flag('data-selected'),
            outside: flag('data-outside'),
          };
        }),
      pop as unknown as HTMLElement,
    );
  }

  /** Try to click a day cell, even when disabled. Resolves whether the click was possible. */
  async tryClickDay(date: Date): Promise<boolean> {
    const pop = await this.find(TurnDatePickerIds.popover, { visible: true });
    const day = await this.find(turnCalendarDay(isoDate(date), date.toLocaleDateString()), {
      within: pop,
      timeout: Timeouts.SHORT,
    });
    if (!(await day.isEnabled())) return false;
    await day.click();
    await settle();
    return true;
  }

  /** Open one of the picker's dropdowns (0 = month, 1 = year), read its options, close it. */
  async calendarDropdownOptions(which: 0 | 1): Promise<Array<{ text: string; disabled: boolean }>> {
    const pop = await this.find(TurnDatePickerIds.popover, { visible: true });
    const dropdowns = await this.findAll(TurnDatePickerIds.dropdowns, {
      within: pop,
      timeout: Timeouts.SHORT,
    });
    const trigger = dropdowns[which];
    if (!trigger) throw new Error(`Date picker has ${dropdowns.length} dropdown(s); wanted index ${which}.`);
    await trigger.click();
    const options = await this.findAll(TurnBoardIds.openListboxOptions, { timeout: Timeouts.SHORT });
    const out: Array<{ text: string; disabled: boolean }> = [];
    for (const option of options) {
      out.push({
        text: await textContentOf(option),
        disabled:
          (await option.getAttribute('aria-disabled')) === 'true' ||
          (await option.getAttribute('data-disabled')) !== null,
      });
    }
    await browser.keys(['Escape']);
    await settle();
    return out;
  }

  /**
   * Pick a day: year dropdown (by its digits), month dropdown (by INDEX — the
   * option labels are locale-formatted), then the day cell. The popover closes
   * itself on selection.
   */
  async pickDate(date: Date): Promise<this> {
    await logStep(`Turn board: pick ${isoDate(date)}`);
    await this.openDatePicker();
    const pop = await this.find(TurnDatePickerIds.popover, { visible: true });

    const choose = async (index: 0 | 1, pickOption: (texts: string[]) => number): Promise<void> => {
      const dropdowns = await this.findAll(TurnDatePickerIds.dropdowns, {
        within: pop,
        timeout: Timeouts.SHORT,
      });
      const trigger = dropdowns[index];
      if (!trigger) throw new Error(`Date picker dropdown ${index} not found.`);
      await trigger.click();
      const options = await this.findAll(TurnBoardIds.openListboxOptions, { timeout: Timeouts.SHORT });
      const texts: string[] = [];
      for (const o of options) texts.push(await textContentOf(o));
      const at = pickOption(texts);
      const option = options[at];
      if (at < 0 || !option) {
        await browser.keys(['Escape']);
        throw new Error(
          `Date picker dropdown ${index}: no option matching the wanted value among [${texts.join(', ')}].`,
        );
      }
      await option.scrollIntoView({ block: 'center' });
      await option.click();
      await settle();
    };

    await choose(1, (texts) => texts.findIndex((t) => t === String(date.getFullYear())));
    await choose(0, (texts) => (texts.length === 12 ? date.getMonth() : -1));

    const clicked = await this.tryClickDay(date);
    if (!clicked) throw new Error(`Day ${isoDate(date)} is disabled in the turn board date picker.`);
    await this.waitGone(TurnDatePickerIds.popover, Timeouts.SHORT).catch(() => undefined);
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Adjust Manual Turn
   * --------------------------------------------------------------------- */

  async openAdjust(): Promise<this> {
    await this.click(TurnBoardIds.adjustButton, { within: await this.rootEl() });
    await this.find(TurnAdjustIds.dialog, { visible: true, timeout: Timeouts.MEDIUM });
    await settle();
    return this;
  }

  async isAdjustOpen(timeout: number = Timeouts.ANIMATION): Promise<boolean> {
    return this.isVisible(TurnAdjustIds.dialog, timeout);
  }

  /** Close the Adjust dialog with Escape (the board stays open). */
  async closeAdjust(): Promise<void> {
    if (!(await this.isAdjustOpen())) return;
    await browser.keys(['Escape']);
    await this.waitGone(TurnAdjustIds.dialog, Timeouts.SHORT);
  }

  async adjustHasNoStaff(): Promise<boolean> {
    const dlg = await this.find(TurnAdjustIds.dialog, { visible: true });
    try {
      await this.find(TurnAdjustIds.noStaff, { within: dlg, timeout: Timeouts.SHORT });
      return true;
    } catch {
      return false;
    }
  }

  /** Every Adjust row, in dialog order. */
  async adjustRows(): Promise<TurnAdjustRow[]> {
    const dlg = await this.find(TurnAdjustIds.dialog, { visible: true });
    const raw = await browser.execute(
      (el: HTMLElement) =>
        Array.from(el.querySelectorAll('div'))
          .filter((d) => d.querySelector(':scope > button[aria-label="decrease"]') !== null)
          .map((d) => {
            const ps = Array.from(d.querySelectorAll(':scope > div > p'));
            const buttons = Array.from(d.querySelectorAll<HTMLButtonElement>(':scope > button'));
            const dec = d.querySelector<HTMLButtonElement>(':scope > button[aria-label="decrease"]');
            const inc = d.querySelector<HTMLButtonElement>(':scope > button[aria-label="increase"]');
            const rest = buttons.filter((b) => b !== dec && b !== inc);
            return {
              staff: (ps[0]?.textContent ?? '').trim(),
              currentText: (ps[1]?.textContent ?? '').trim(),
              valueText: (d.querySelector(':scope > span')?.textContent ?? '').trim(),
              decreaseEnabled: dec ? !dec.disabled : false,
              increaseEnabled: inc ? !inc.disabled : false,
              saveEnabled: rest[0] ? !rest[0].disabled : false,
              resetEnabled: rest[1] ? !rest[1].disabled : false,
            };
          }),
      dlg as unknown as HTMLElement,
    );
    return raw.map((r) => ({
      ...r,
      current: parseNumber(r.currentText.split(':').pop() ?? ''),
      value: parseNumber(r.valueText),
    }));
  }

  async adjustRowFor(staffName: string): Promise<TurnAdjustRow | null> {
    return (await this.adjustRows()).find((r) => r.staff === staffName) ?? null;
  }

  async adjustIncrease(staffName: string, times = 1): Promise<this> {
    for (let i = 0; i < times; i += 1) await this.clickInAdjustRow(staffName, TurnAdjustIds.rowIncrease);
    return this;
  }

  async adjustDecrease(staffName: string, times = 1): Promise<this> {
    for (let i = 0; i < times; i += 1) await this.clickInAdjustRow(staffName, TurnAdjustIds.rowDecrease);
    return this;
  }

  async adjustReset(staffName: string): Promise<this> {
    await this.clickInAdjustRow(staffName, TurnAdjustIds.rowReset);
    return this;
  }

  /**
   * Save one row and wait for the round trip: the row's Save button stops
   * being enabled (clean) OR its Current changes. Returns the row afterwards.
   */
  async adjustSave(staffName: string): Promise<TurnAdjustRow | null> {
    const before = await this.adjustRowFor(staffName);
    await logStep(`Adjust turn: save ${staffName}`);
    await this.clickInAdjustRow(staffName, TurnAdjustIds.rowSave);
    await browser
      .waitUntil(
        async () => {
          const now = await this.adjustRowFor(staffName);
          return now !== null && (!now.saveEnabled || now.current !== before?.current);
        },
        { timeout: Timeouts.MEDIUM, interval: 250 },
      )
      .catch(() => undefined);
    await settle();
    return this.adjustRowFor(staffName);
  }

  /* --------------------------------------------------------------------- *
   * Turn Settings
   * --------------------------------------------------------------------- */

  async openSettings(): Promise<this> {
    await this.click(TurnBoardIds.settingsButton, { within: await this.rootEl() });
    await this.find(TurnSettingsIds.dialog, { visible: true, timeout: Timeouts.MEDIUM });
    await settle();
    return this;
  }

  async isSettingsOpen(timeout: number = Timeouts.ANIMATION): Promise<boolean> {
    return this.isVisible(TurnSettingsIds.dialog, timeout);
  }

  /** Dismiss Turn Settings WITHOUT saving (Escape). */
  async cancelSettings(): Promise<void> {
    if (!(await this.isSettingsOpen())) return;
    await browser.keys(['Escape']);
    await this.waitGone(TurnSettingsIds.dialog, Timeouts.SHORT);
  }

  async readSettings(): Promise<TurnSettingsState> {
    const dlg = await this.find(TurnSettingsIds.dialog, { visible: true });
    const sw = async (loc: Locator): Promise<{ on: boolean; enabled: boolean }> => {
      const el = await this.find(loc, { within: dlg, timeout: Timeouts.SHORT });
      const checked =
        (await el.getAttribute('aria-checked')) === 'true' ||
        (await el.getAttribute('data-state')) === 'checked';
      return { on: checked, enabled: await el.isEnabled() };
    };
    const service = await sw(TurnSettingsIds.serviceBased);
    const decimal = await sw(TurnSettingsIds.decimal);
    const input = await this.find(TurnSettingsIds.turnValue, { within: dlg, timeout: Timeouts.SHORT });
    const turnValueText = ((await input.getValue()) ?? '').trim();
    let helperShown = false;
    try {
      await this.find(TurnSettingsIds.helper, { within: dlg, timeout: Timeouts.ANIMATION });
      helperShown = true;
    } catch {
      helperShown = false;
    }
    return {
      serviceBased: service.on,
      decimal: decimal.on,
      decimalEnabled: decimal.enabled,
      turnValueText,
      turnValueEnabled: await input.isEnabled(),
      turnValueCents: parseCents(turnValueText),
      helperShown,
    };
  }

  /** Flip a switch to the wanted state (no-op when already there). */
  async setServiceBased(on: boolean): Promise<this> {
    return this.setSwitch(TurnSettingsIds.serviceBased, on);
  }

  async setDecimal(on: boolean): Promise<this> {
    return this.setSwitch(TurnSettingsIds.decimal, on);
  }

  /**
   * Replace the Turn value by typing raw digits into the cent mask: `'2500'`
   * reads back `$25.00`. Pass `''` to empty the field. The field is cleared
   * with select-all + Backspace first — the mask is pre-filled, and typing into
   * it appends (see `home-cart-service-editor-inputcurrency` notes).
   */
  async typeTurnValue(raw: string): Promise<string> {
    const dlg = await this.find(TurnSettingsIds.dialog, { visible: true });
    const input = await this.find(TurnSettingsIds.turnValue, { within: dlg, visible: true });
    await input.click();
    await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', 'a']);
    await browser.keys(['Backspace']);
    // Backspace may leave "$0.00" behind; delete digit by digit until the mask is zero.
    for (let i = 0; i < 12; i += 1) {
      const v = ((await input.getValue()) ?? '').replace(/[^\d]/g, '');
      if (v === '' || /^0+$/.test(v)) break;
      await browser.keys(['End', 'Backspace']);
    }
    if (raw !== '') await browser.keys(raw.split(''));
    await settle();
    return ((await input.getValue()) ?? '').trim();
  }

  /** Press Save and wait for the dialog to close itself. */
  async saveSettings(): Promise<void> {
    const dlg = await this.find(TurnSettingsIds.dialog, { visible: true });
    await logStep('Turn settings: save');
    await this.click(TurnSettingsIds.save, { within: dlg });
    await this.waitGone(TurnSettingsIds.dialog, Timeouts.MEDIUM);
    await settle();
  }

  /**
   * Open Settings, set every field, save. Used to put the merchant on a known
   * configuration and to RESTORE the original one afterwards.
   */
  async applySettings(target: {
    serviceBased: boolean;
    decimal: boolean;
    turnValueCents: number;
  }): Promise<void> {
    if (!(await this.isSettingsOpen())) await this.openSettings();
    await this.setServiceBased(target.serviceBased);
    if (target.serviceBased) await this.setDecimal(target.decimal);
    await this.typeTurnValue(target.turnValueCents === 0 ? '' : String(target.turnValueCents));
    await this.saveSettings();
  }

  /* --------------------------------------------------------------------- *
   * Turn Quick View
   * --------------------------------------------------------------------- */

  async hasQuickView(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(TurnQuickViewIds.launcher, timeout);
  }

  async quickViewExpanded(): Promise<boolean> {
    const tab = await this.find(TurnQuickViewIds.launcher, { visible: true, timeout: Timeouts.SHORT });
    return (await tab.getAttribute('aria-expanded')) === 'true';
  }

  async openQuickView(): Promise<this> {
    if (await this.isVisible(TurnQuickViewIds.panel, Timeouts.ANIMATION)) return this;
    await this.click(TurnQuickViewIds.launcher, { timeout: Timeouts.MEDIUM });
    await this.find(TurnQuickViewIds.panel, { visible: true, timeout: Timeouts.SHORT });
    await settle();
    return this;
  }

  async isQuickViewPanelOpen(): Promise<boolean> {
    return this.isVisible(TurnQuickViewIds.panel, Timeouts.ANIMATION);
  }

  async closeQuickView(): Promise<void> {
    if (!(await this.isQuickViewPanelOpen())) return;
    await browser.keys(['Escape']);
    await this.waitGone(TurnQuickViewIds.panel, Timeouts.SHORT);
  }

  async quickViewRows(): Promise<TurnQuickViewRow[]> {
    const panel = await this.find(TurnQuickViewIds.panel, { visible: true });
    return browser.execute(
      (el: HTMLElement) =>
        Array.from(el.querySelectorAll('div'))
          .filter((d) => {
            const first = d.firstElementChild;
            return (
              first !== null &&
              first.tagName === 'SPAN' &&
              /^\d+$/.test((first.textContent ?? '').trim()) &&
              d.querySelector(':scope > div > p') !== null
            );
          })
          .map((d) => ({
            rank: Number((d.firstElementChild?.textContent ?? '0').trim()),
            staff: (d.querySelector(':scope > div > p')?.textContent ?? '').trim(),
            turnCountText: (d.lastElementChild?.textContent ?? '').trim(),
          })),
      panel as unknown as HTMLElement,
    );
  }

  /** "View Turn" inside the popover. */
  async pressViewTurn(): Promise<this> {
    const panel = await this.find(TurnQuickViewIds.panel, { visible: true });
    await this.click(TurnQuickViewIds.viewTurn, { within: panel });
    await this.waitOpen();
    return this;
  }

  /** Which edge the tab hugs, from its on-screen box. */
  async quickViewSide(): Promise<'left' | 'right'> {
    const tab = await this.find(TurnQuickViewIds.launcher, { visible: true });
    const box = await browser.execute(
      (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: window.innerWidth };
      },
      tab as unknown as HTMLElement,
    );
    return box.left + (box.right - box.left) / 2 < box.width / 2 ? 'left' : 'right';
  }

  /**
   * Drag the tab with a real pointer sequence to a point given as a fraction
   * of the viewport (0..1). The app snaps it to the nearer edge on release.
   */
  async dragQuickViewTo(xFraction: number, yFraction: number): Promise<void> {
    const tab = await this.find(TurnQuickViewIds.launcher, { visible: true });
    const geo = await browser.execute(
      (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          w: window.innerWidth,
          h: window.innerHeight,
        };
      },
      tab as unknown as HTMLElement,
    );
    const toX = Math.round(geo.w * xFraction);
    const toY = Math.round(geo.h * yFraction);
    await browser
      .action('pointer', { parameters: { pointerType: 'mouse' } })
      .move({ x: Math.round(geo.x), y: Math.round(geo.y) })
      .down()
      .move({
        x: Math.round(geo.x + (toX - geo.x) / 2),
        y: Math.round(geo.y + (toY - geo.y) / 2),
        duration: 150,
      })
      .move({ x: toX, y: toY, duration: 150 })
      .up()
      .perform();
    await settle();
  }

  /** Raw `localStorage.turn_quick_view_position`, or `null`. */
  async quickViewStoredPosition(): Promise<string | null> {
    return browser.execute(function (key: string) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }, TURN_QUICK_VIEW_POSITION_KEY);
  }

  /**
   * Put `localStorage.turn_quick_view_position` back to a value read earlier
   * (`null` removes the key). The in-memory store only re-reads it on boot, so
   * pair this with a drag back to the original edge.
   */
  async restoreQuickViewStoredPosition(raw: string | null): Promise<void> {
    await browser.execute(
      function (key: string, value: string | null) {
        try {
          if (value === null) window.localStorage.removeItem(key);
          else window.localStorage.setItem(key, value);
        } catch {
          // Storage unavailable — nothing to restore.
        }
      },
      TURN_QUICK_VIEW_POSITION_KEY,
      raw,
    );
  }

  /**
   * Can the board's "Adjust Turn" button actually receive a click right now?
   * `false` when another layer (a route's passcode guard) sits on top of it.
   */
  async isToolbarInteractable(): Promise<boolean> {
    try {
      const root = await this.find(this.root, { timeout: Timeouts.SHORT });
      const btn = await this.find(TurnBoardIds.adjustButton, { within: root, timeout: Timeouts.SHORT });
      return await btn.isClickable();
    } catch {
      return false;
    }
  }

  /** Is the board mounted and displayed, even if covered by another dialog? */
  async isRendered(): Promise<boolean> {
    try {
      const el = await this.find(this.root, { timeout: Timeouts.SHORT });
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  /* --------------------------------------------------------------------- *
   * Internals
   * --------------------------------------------------------------------- */

  private async appRouteOrHome(): Promise<string> {
    const path = await currentRoutePath();
    // Outside the _app shell (login, splash, checkout-less customer route) the param would do nothing.
    if (path === '' || path === '/' || path.startsWith('/login') || path.startsWith('/customer'))
      return Routes.HOME;
    return path;
  }

  private async readRows(root: WebdriverIO.Element): Promise<TurnRow[]> {
    const raw = await browser.execute(
      (el: HTMLElement) =>
        Array.from(el.querySelectorAll('div'))
          .filter((d) => {
            const kids = Array.from(d.children);
            if (kids.length < 3) return false;
            const first = kids[0];
            const last = kids[kids.length - 1];
            if (!first || !last || first.tagName !== 'SPAN') return false;
            if (!/^\d+$/.test((first.textContent ?? '').trim())) return false;
            if (d.querySelector(':scope > div > p') === null) return false;
            return last.querySelectorAll(':scope > span').length >= 2;
          })
          .map((d) => {
            const kids = Array.from(d.children);
            const last = kids[kids.length - 1];
            const spans = last ? Array.from(last.querySelectorAll(':scope > span')) : [];
            return {
              rank: Number((kids[0]?.textContent ?? '0').trim()),
              staff: (d.querySelector(':scope > div > p')?.textContent ?? '').trim(),
              avatarText: (kids[1]?.textContent ?? '').trim(),
              turnCountText: (spans[0]?.textContent ?? '').trim(),
              unit: (spans[1]?.textContent ?? '').trim(),
              cells: kids.map((k) => (k.textContent ?? '').trim()),
            };
          }),
      root as unknown as HTMLElement,
    );
    return raw.map((r) => ({ ...r, turnCount: parseNumber(r.turnCountText) }));
  }

  /** WebDriver handles of the rows, same filter as {@link readRows}. */
  private async rowElements(root: WebdriverIO.Element): Promise<WebdriverIO.Element[]> {
    const all = await root.$$('.//div[./span[1]][./div/p][./*[last()][count(span)>=2]]').getElements();
    return [...all];
  }

  private async clickInAdjustRow(staffName: string, loc: Locator): Promise<void> {
    const dlg = await this.find(TurnAdjustIds.dialog, { visible: true });
    const rows = await this.findAll(TurnAdjustIds.rows, { within: dlg, timeout: Timeouts.SHORT });
    for (const row of rows) {
      const nameEl = await this.find(TurnAdjustIds.rowName, {
        within: row,
        timeout: Timeouts.ANIMATION,
      }).catch(() => null);
      if (!nameEl) continue;
      const name = await textContentOf(nameEl);
      if (name !== staffName) continue;
      await this.click(loc, { within: row, timeout: Timeouts.SHORT });
      await settle(Timeouts.ANIMATION / 2);
      return;
    }
    throw new Error(`Adjust Manual Turn has no row for "${staffName}".`);
  }

  private async setSwitch(loc: Locator, on: boolean): Promise<this> {
    const dlg = await this.find(TurnSettingsIds.dialog, { visible: true });
    const el = await this.find(loc, { within: dlg, timeout: Timeouts.SHORT });
    const checked =
      (await el.getAttribute('aria-checked')) === 'true' ||
      (await el.getAttribute('data-state')) === 'checked';
    if (checked !== on) {
      await el.click();
      await settle();
    }
    return this;
  }
}

/** Local-calendar `yyyy-MM-dd` (react-day-picker's `data-day` format). */
export function isoDate(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export const turnBoardDialog = new TurnBoardDialog();
