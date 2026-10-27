/**
 * Turn board — the `?dialog=turn-board` dialog, its two child dialogs
 * (Adjust Manual Turn, Turn Settings), its date picker and the floating
 * Turn Quick View tab.
 *
 * ## Why a separate file from `testids.payroll.ts`'s `TurnIds`
 *
 * `TurnIds` was ported from the Playwright suite before the board was rebuilt:
 * it models the board as a `<table>` and reaches it only through the quick
 * view. On build 1.1.x the board is a list of `div` rows
 * (`volt-pos/src/components/turn-board/turn-board-row.tsx`), it opens from the
 * `dialog` search param, and the installed build strips every `data-testid`.
 * These locators keep the testid the app SHOULD expose as the first candidate
 * (naming: `turn-board-*`) and fall back to structure the app source
 * guarantees: Radix `role`s, shadcn `data-slot`s, the `id`s on the switches
 * and the date trigger, and the bilingual labels from `labels.ts`.
 *
 * ## Relative XPath on purpose
 *
 * Every locator used through `BaseComponent.inside()` starts with `.//` — a
 * WebDriver XPath starting with `//` searches the whole DOCUMENT even when
 * issued from an element, which would defeat the scoping (Radix keeps a closed
 * child dialog's siblings mounted while the parent is open).
 */

import { Actions, Turn, both, type Label } from './labels.js';
import { locator, type Locator } from '../helpers/selectors.js';

/* ------------------------------------------------------------------------- *
 * Strings the shared label catalogue does not carry yet (verbatim from
 * volt-pos src/locales/{en,vi}/common.json, `turn.*`).
 * ------------------------------------------------------------------------- */

const L = (en: string, vi: string, key: string): Label => ({ en, vi, key });

export const TurnText = {
  adjustTitle: L('Adjust Manual Turn', 'Chỉnh lượt thủ công', 'turn.adjustTitle'),
  settingTitle: L('Turn Settings', 'Cài đặt phiên làm việc', 'turn.settingTitle'),
  noStaff: L('No staff clocked in for this day', 'Chưa có thợ nào chấm công ngày này', 'turn.noStaff'),
  current: L('Current', 'Hiện tại', 'turn.current'),
  thresholdHelp: L(
    'The sales amount equal to one turn. Example: at $25, a $50 service counts as 2 turns.',
    'Số tiền tương ứng với 1 lượt. Ví dụ: với $25, một dịch vụ $50 tính 2 lượt.',
    'turn.thresholdHelp',
  ),
  thresholdLabel: L(
    'Turn value (minimum order amount counted as 1 turn)',
    'Giá trị phiên (số tiền tối thiểu của đơn để tính 1 lượt)',
    'turn.thresholdLabel',
  ),
} as const;

/** The four `turn.sort*` options, in the order the app renders them. */
export const TURN_SORT_LABELS = {
  countAsc: L('Fewest turns first', 'Ít lượt nhất trước', 'turn.sortCountAsc'),
  countDesc: L('Most turns first', 'Nhiều lượt nhất trước', 'turn.sortCountDesc'),
  checkinAsc: L('Earliest check-in first', 'Check-in sớm nhất trước', 'turn.sortCheckinAsc'),
  checkinDesc: L('Latest check-in first', 'Check-in muộn nhất trước', 'turn.sortCheckinDesc'),
} as const;

/* ------------------------------------------------------------------------- *
 * XPath helpers (local — relative and bilingual)
 * ------------------------------------------------------------------------- */

const anyText = (l: Label): string => `normalize-space()="${l.en}" or normalize-space()="${l.vi}"`;

/** A Radix dialog identified by its OWN `DialogTitle`, not by any text inside it. */
const dialogTitled = (l: Label): string =>
  `//*[@role="dialog"][.//*[@data-slot="dialog-title"][${anyText(l)}]]`;

/** Relative button whose whole label is one of the label's strings. */
const relButton = (l: Label): string => `.//button[${anyText(l)}]`;

/* ------------------------------------------------------------------------- *
 * Main dialog
 * ------------------------------------------------------------------------- */

export const TurnBoardIds = {
  /** `turn-board.tsx` — `DialogTitle` = `turn.title`. */
  dialog: locator('turn board dialog', 'turn-board-dialog', dialogTitled(Turn.title)),

  title: locator('turn board title', 'turn-board-title', './/*[@data-slot="dialog-title"]', './/h2'),

  /** `DialogHeaderClose` — an icon button whose only text is the sr-only `common.close`. */
  close: locator(
    'turn board close',
    'turn-board-close',
    `.//*[@data-slot="dialog-header"]//button[${anyText(Actions.close)}]`,
    `.//button[${anyText(Actions.close)}]`,
  ),

  /** `DatePickerSecondary` stamps `id="selected-date-range"` on its trigger. Scoped to the dialog. */
  dateButton: locator('turn board date', 'turn-board-date', './/*[@id="selected-date-range"]'),

  /** The only Radix select in the board header — it has no aria-label, only its value text. */
  sortSelect: locator(
    'turn board sort',
    'turn-board-sort',
    './/button[@role="combobox"][@data-slot="select-trigger"]',
    './/*[@role="combobox"]',
  ),

  adjustButton: locator('adjust turn button', 'turn-board-adjust-btn', relButton(Turn.adjust)),
  settingsButton: locator('turn settings button', 'turn-board-settings-btn', relButton(Turn.setting)),

  noStaff: locator('turn board empty state', 'turn-board-empty', `.//p[${anyText(TurnText.noStaff)}]`),

  /** The open Radix select listbox (portalled to body, so NOT relative). */
  openListboxOptions: locator(
    'open select options',
    'turn-board-sort-option-',
    '[role="listbox"] [role="option"]',
    '[data-slot="select-item"]',
  ),

  /** The hamburger drawer's "Turn" entry — a `<Button>` (not a link) that sets `dialog=turn-board`. */
  sidebarEntry: locator(
    'sidebar turn entry',
    'app-sidebar-item-turn-board',
    `//*[@data-slot="sidebar"]//button[.//span[${anyText(Turn.title)}]]`,
    `//*[@data-sidebar="sidebar"]//button[.//span[${anyText(Turn.title)}]]`,
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Date picker popover (`date-picker-secondary.tsx` + react-day-picker v9)
 * ------------------------------------------------------------------------- */

export const TurnDatePickerIds = {
  popover: locator(
    'turn date picker',
    'turn-board-date-picker',
    '//*[@data-slot="popover-content"][.//*[@data-slot="calendar"]]',
    '//*[@data-radix-popper-content-wrapper]//*[@data-slot="calendar"]/..',
  ),
  /** Month then year — the two `CalendarDropdown` Radix selects, in that DOM order. */
  dropdowns: locator('calendar dropdowns', 'turn-board-date-dropdown-', './/*[@role="combobox"]'),
  grid: locator('calendar grid', 'turn-board-date-grid', `.//*[@role="grid"]`, './/table'),
  columnHeaders: locator(
    'calendar weekday headers',
    'turn-board-date-weekday-',
    './/*[@role="columnheader"]',
    './/thead//th',
  ),
  dayButtons: locator(
    'calendar day buttons',
    'turn-board-date-day-',
    './/td[@data-day]//button',
    './/button[@data-day]',
  ),
} satisfies Record<string, Locator>;

/**
 * One day cell's button.
 *
 * react-day-picker v9 stamps `data-day="yyyy-MM-dd"` on the `<td>`;
 * shadcn's `CalendarDayButton` ALSO stamps `data-day={date.toLocaleDateString()}`
 * on the button, which depends on the WebView locale — so it is the second
 * candidate, not the first.
 */
export const turnCalendarDay = (iso: string, localeDate: string): Locator =>
  locator(
    `calendar day ${iso}`,
    `turn-board-date-day-${iso}`,
    `.//td[@data-day="${iso}"]//button`,
    `.//button[@data-day="${localeDate}"]`,
  );

/* ------------------------------------------------------------------------- *
 * Adjust Manual Turn (`turn-board-adjust-dialog.tsx`)
 * ------------------------------------------------------------------------- */

export const TurnAdjustIds = {
  dialog: locator('adjust manual turn dialog', 'turn-adjust-dialog', dialogTitled(TurnText.adjustTitle)),

  /** One staff row: the only `div` that directly holds the `aria-label="decrease"` stepper button. */
  rows: locator('adjust rows', 'turn-adjust-row-', './/div[./button[@aria-label="decrease"]]'),

  /* Row-relative (use with `within: row`). */
  rowName: locator('adjust row name', 'turn-adjust-row-name', './div/p[1]'),
  rowCurrent: locator('adjust row current', 'turn-adjust-row-current', './div/p[2]'),
  rowValue: locator('adjust row pending value', 'turn-adjust-row-value', './span'),
  rowDecrease: locator('adjust row decrease', 'turn-adjust-row-decrease', './button[@aria-label="decrease"]'),
  rowIncrease: locator('adjust row increase', 'turn-adjust-row-increase', './button[@aria-label="increase"]'),
  rowSave: locator('adjust row save', 'turn-adjust-row-save', `./button[${anyText(Actions.save)}]`),
  rowReset: locator('adjust row reset', 'turn-adjust-row-reset', `./button[${anyText(Actions.reset)}]`),

  noStaff: locator('adjust empty state', 'turn-adjust-empty', `.//p[${anyText(TurnText.noStaff)}]`),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Turn Settings (`turn-board-settings-dialog.tsx` + `turn-board-settings-fields.tsx`)
 * ------------------------------------------------------------------------- */

export const TurnSettingsIds = {
  dialog: locator('turn settings dialog', 'turn-settings-dialog', dialogTitled(TurnText.settingTitle)),

  /** `SwitchLabel id="turn-service-based"` → the Radix switch button carries the id. */
  serviceBased: locator(
    'service-based switch',
    'turn-settings-service-based',
    './/*[@id="turn-service-based"]',
    `(.//button[@role="switch"])[1]`,
  ),
  decimal: locator(
    'decimal switch',
    'turn-settings-decimal',
    './/*[@id="turn-decimal"]',
    `(.//button[@role="switch"])[2]`,
  ),

  /**
   * `InputCurrency` — the only text input in the form (Radix switches inside a
   * `<form>` add hidden checkbox inputs, hence the type filter).
   */
  turnValue: locator(
    'turn value input',
    'turn-settings-turn-value',
    './/input[not(@type="checkbox") and not(@type="hidden")]',
  ),

  helper: locator('turn value helper', 'turn-settings-helper', `.//p[${anyText(TurnText.thresholdHelp)}]`),

  save: locator(
    'turn settings save',
    'turn-settings-save',
    './/button[@type="submit"]',
    relButton(Actions.save),
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Turn Quick View (`turn-quick-view.tsx`) — only on /home, /order-pending, /order-history
 * ------------------------------------------------------------------------- */

export const TurnQuickViewIds = {
  /**
   * The edge tab: a Radix `PopoverTrigger` (so it carries `aria-expanded` and
   * `aria-haspopup="dialog"`) whose first span holds `turn.title` (shown
   * uppercase by CSS only — the DOM text is "Turn"). The sidebar's "Turn" entry
   * has no `aria-expanded`, which keeps the two apart.
   */
  launcher: locator(
    'turn quick view tab',
    'turn-quick-view-launcher',
    `//button[@aria-expanded][./span[${anyText(Turn.title)}]]`,
    `//button[@aria-haspopup="dialog"][.//span[${anyText(Turn.title)}]]`,
  ),

  panel: locator(
    'turn quick view panel',
    'turn-quick-view',
    `//*[@data-slot="popover-content"][.//p[${anyText(Turn.order)}]]`,
    `//*[@role="dialog"][.//p[${anyText(Turn.order)}]]`,
  ),

  viewTurn: locator('view turn button', 'turn-quick-view-view-btn', relButton(Turn.view)),
} satisfies Record<string, Locator>;

/** Keys of {@link TURN_SORT_LABELS}. */
export type TurnSortKey = keyof typeof TURN_SORT_LABELS;

/** Both language variants of every sort option, flattened — for "exactly these four" checks. */
export const allSortTexts = (): Array<[string, string]> =>
  Object.values(TURN_SORT_LABELS).map((l) => both(l));

/** localStorage key the quick view persists its edge position under (`turn-quick-view.store.ts`). */
export const TURN_QUICK_VIEW_POSITION_KEY = 'turn_quick_view_position';
