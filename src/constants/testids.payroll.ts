/**
 * Time Tracking, Staff Payroll and the Turn board.
 *
 * The three screens that describe what staff DID, as opposed to what the shop
 * earned. They share a shape — a passcode gate, a date control, one table — so
 * they share a locator file.
 *
 * Fallbacks come from the Playwright suite (proven against a live till), with
 * the English-only text matches replaced by bilingual ones. Where the app has
 * no i18n key the English string is repeated and marked, rather than being
 * quietly passed off as translated.
 */

import { Actions, Home, Payroll, Turn, both } from './labels.js';
import {
  buttonWithAnyText,
  byRole,
  inputWithAnyPlaceholder,
  locator,
  textIsAnyOf,
  type Locator,
} from '../helpers/selectors.js';

/* ------------------------------------------------------------------------- *
 * Time Tracking + Staff Payroll
 * ------------------------------------------------------------------------- */

export const PayrollIds = {
  timeTrackingHeading: locator(
    'time tracking heading',
    'time-tracking-heading',
    `//h3[${both(Payroll.timeTracking)
      .map((t) => `normalize-space()="${t}"`)
      .join(' or ')}]`,
    textIsAnyOf(...both(Payroll.timeTracking)),
  ),

  staffPayrollHeading: locator(
    'staff payroll heading',
    'staff-payroll-heading',
    `//*[@data-slot="income-header-title"][${both(Payroll.staffPayroll)
      .map((t) => `normalize-space()="${t}"`)
      .join(' or ')}]`,
    textIsAnyOf(...both(Payroll.staffPayroll)),
  ),

  /**
   * The single data table on either screen.
   *
   * Deliberately unscoped: both routes render exactly one, and scoping to a
   * container would need a class the app does not guarantee. `readTable()`
   * takes this same `table` selector.
   */
  table: locator('data table', 'payroll-table', 'table', byRole('table')),

  /** `global.searchStaff` — the same placeholder the home screen's staff filter uses. */
  searchStaff: locator(
    'staff search',
    'payroll-search-staff',
    inputWithAnyPlaceholder(...both(Home.searchStaff)),
  ),

  /** Shares the DOM id used by the income reports and the pending toolbar. */
  dateRange: locator('date range', 'payroll-date-range', '#selected-date-range'),

  /** Row links carry the staff id — the only structural handle on a payroll row. */
  staffLinks: locator('payroll staff links', 'payroll-staff-link-', 'a[href*="/settings/staffs/"]'),

  checkIn: locator('check in', 'payroll-check-in', buttonWithAnyText(...both(Payroll.checkIn))),
  checkOut: locator('check out', 'payroll-check-out', buttonWithAnyText(...both(Payroll.checkOut))),

  noStaffClockedIn: locator(
    'nobody clocked in',
    'payroll-empty',
    textIsAnyOf('No staff clocked in for this day', 'Không có nhân viên chấm công trong ngày này'),
  ),

  /**
   * The title of ANY route passcode guard — `global.enterStaffCodeToAccess`
   * ("Enter staff code to access {{permission}}"). Prefix match because the
   * permission name is interpolated; the reader compares the suffix.
   */
  gateTitle: locator(
    'passcode gate title',
    'passcode-guard-dialog-title',
    `//*[@role="dialog"]//*[starts-with(normalize-space(),"Enter staff code to access") or starts-with(normalize-space(),"Nhập mã nhân viên để truy cập")][not(.//*[starts-with(normalize-space(),"Enter staff code") or starts-with(normalize-space(),"Nhập mã nhân viên")])]`,
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Time Tracking — the management screen (/time-tracking)
 * ------------------------------------------------------------------------- */

const exactAny = (texts: readonly string[]): string =>
  texts.map((text) => `normalize-space()="${text}"`).join(' or ');

const TT_TITLE = exactAny(both(Payroll.timeTracking));
const ADD_DIALOG_TITLE = exactAny(['Add New Time Keeping', 'Thêm chấm công mới']);
const EDIT_DIALOG_TITLE = exactAny(['Edit Time Keeping', 'Sửa chấm công']);

/**
 * Time Tracking (`routes/_app/time-tracking`), live DOM build 1.1.56.
 *
 * No `data-testid` survives on this screen. What does: the `<h3>` title, the
 * `#selected-date-range` id, the `Search staff` placeholder, the shadcn
 * `data-slot` attributes on dialogs / form parts, the form's literal
 * `id="time-tracking-form"` (the header submit button references it through
 * `form=`), and the row action buttons' hardcoded `aria-label="Edit"` /
 * `aria-label="Delete"` (English in BOTH bundles — they are not translated).
 */
export const TimeTrackingIds = {
  heading: locator(
    'time tracking heading',
    'time-tracking-heading',
    `//h3[${TT_TITLE}]`,
    textIsAnyOf(...both(Payroll.timeTracking)),
  ),

  /** The preset select ("Today", "This Week", ...) — the screen's only combobox outside a dialog. */
  presetSelect: locator(
    'time tracking preset select',
    'time-tracking-preset',
    `//h3[${TT_TITLE}]/following-sibling::*//button[@role="combobox"]`,
    'button[role="combobox"]',
  ),

  dateRange: locator('time tracking date range', 'time-tracking-date-range', '#selected-date-range'),

  /**
   * The icon-only `ButtonPlus` beside the search box. It has no name at all,
   * so the lucide `plus` glyph is the handle, then "the header button that is
   * neither the preset select nor the date trigger".
   */
  addButton: locator(
    'add time keeping button',
    'time-tracking-add-btn',
    `//h3[${TT_TITLE}]/following-sibling::*//button[.//*[local-name()="svg"][contains(@class,"lucide-plus")]]`,
    `(//h3[${TT_TITLE}]/following-sibling::*//button[not(@role) and not(@id)])[last()]`,
  ),

  table: locator('time tracking table', 'time-tracking-table', 'table', byRole('table')),

  emptyTitle: locator(
    'no time tracking records',
    'time-tracking-empty',
    textIsAnyOf('No time tracking records', 'Không có bản ghi chấm công'),
  ),

  /** The second empty-state line: date-range wording, or the no-match-for-search wording. */
  emptyHint: locator(
    'time tracking empty hint',
    'time-tracking-empty-hint',
    `//*[${exactAny(['No time tracking records', 'Không có bản ghi chấm công'])}]/following-sibling::*[1]`,
  ),

  addDialog: locator(
    'add time keeping dialog',
    'time-tracking-add-dialog',
    `//*[@role="dialog"][.//*[@data-slot="dialog-title"][${ADD_DIALOG_TITLE}]]`,
    `//*[@role="dialog"][.//*[${ADD_DIALOG_TITLE}]]`,
  ),

  editDialog: locator(
    'edit time keeping dialog',
    'time-tracking-update-dialog',
    `//*[@role="dialog"][.//*[@data-slot="dialog-title"][${EDIT_DIALOG_TITLE}]]`,
    `//*[@role="dialog"][.//*[${EDIT_DIALOG_TITLE}]]`,
  ),

  /** "Add" / "Save" in the dialog header — a submit button bound to the form by id. */
  dialogSubmit: locator(
    'time keeping submit',
    'time-tracking-form-submit',
    'button[type="submit"][form="time-tracking-form"]',
  ),

  /** `DialogHeaderClose` — an X with an sr-only "Close". */
  dialogClose: locator(
    'time keeping dialog close',
    'time-tracking-form-close',
    `//*[@role="dialog"]//*[@data-slot="dialog-header"]//button[.//*[${exactAny(both(Actions.close))}]]`,
    `//*[@role="dialog"]//button[.//span[contains(@class,"sr-only")][${exactAny(both(Actions.close))}]]`,
  ),

  /** Add only: the searchable staff picker trigger (a `role=combobox` button). */
  staffCombobox: locator(
    'time keeping staff picker',
    'time-tracking-form-staff',
    '#time-tracking-form button[role="combobox"]',
  ),

  /** Edit only: the staff rendered as a DISABLED button inside the first form item. */
  staffReadonly: locator(
    'time keeping staff (read-only)',
    'time-tracking-form-staff-readonly',
    '#time-tracking-form [data-slot="form-item"]:first-child button[disabled]',
    `//form[@id="time-tracking-form"]//button[@disabled][1]`,
  ),

  staffSearch: locator(
    'staff picker search',
    'time-tracking-form-staff-search',
    '#time-tracking-form [data-slot="command-input"]',
    '[data-slot="command-input"]',
  ),

  staffOptions: locator(
    'staff picker options',
    'time-tracking-form-staff-option-',
    '#time-tracking-form [data-slot="command-item"]',
    '[data-slot="command-item"]',
  ),

  /** Any inline validation message inside the form (`FormMessage`). */
  formMessages: locator(
    'time keeping form messages',
    'time-tracking-form-message',
    '#time-tracking-form [data-slot="form-message"]',
  ),

  noteInput: locator(
    'time keeping note',
    'time-tracking-form-note',
    '#time-tracking-form input[maxlength="255"]',
    inputWithAnyPlaceholder('Optional note', 'Ghi chú (không bắt buộc)'),
  ),

  deleteDialog: locator('delete time keeping dialog', 'time-tracking-delete-dialog', byRole('alertdialog')),

  deleteDescription: locator(
    'delete time keeping description',
    'time-tracking-delete-description',
    '[role="alertdialog"] [data-slot="alert-dialog-description"]',
  ),

  deleteConfirm: locator(
    'delete time keeping confirm',
    'time-tracking-delete-confirm',
    `//*[@role="alertdialog"]//button[${exactAny(['Delete', 'Xoá', 'Xóa'])}]`,
  ),

  deleteCancel: locator(
    'delete time keeping cancel',
    'time-tracking-delete-cancel',
    `//*[@role="alertdialog"]//button[${exactAny(both(Actions.cancel))} or normalize-space()="Hủy"]`,
  ),

  /** Sonner toasts. Transient (≈4 s), so read immediately after the action. */
  toast: locator('toast', 'app-toast', '[data-sonner-toast]', '[data-sonner-toaster] li'),
} satisfies Record<string, Locator>;

/**
 * The first table row whose Note cell contains `marker`.
 *
 * `contains` rather than equality: the edit step appends to the marker and the
 * cleanup has to find the record either way.
 */
export const timeTrackingRowByNote = (marker: string): Locator =>
  locator(
    `time tracking row "${marker}"`,
    'time-tracking-row-',
    `(//tbody/tr[./td[contains(normalize-space(),"${marker}")]])[1]`,
  );

/** The Edit / Delete icon button on the first row whose note contains `marker`. */
export const timeTrackingRowAction = (marker: string, action: 'Edit' | 'Delete'): Locator =>
  locator(
    `time tracking ${action.toLowerCase()} for "${marker}"`,
    `time-tracking-row-${action.toLowerCase()}-`,
    `(//tbody/tr[./td[contains(normalize-space(),"${marker}")]])[1]//button[@aria-label="${action}"]`,
  );

/* ------------------------------------------------------------------------- *
 * Turn board — a DIALOG, not a route
 * ------------------------------------------------------------------------- */

/**
 * The turn board.
 *
 * ## It has no URL
 *
 * The Playwright suite models this as a page with `path = '/turn'`. There is no
 * such route in the app: `TurnBoardDialog` is mounted app-wide in
 * `volt-pos/src/routes/_app.tsx:77` and opened from the floating `TurnQuickView`,
 * which itself renders only on `/home`, `/order-pending` and `/order-history`
 * (`pathTurnQuickView`, same file). So a spec reaches the board by being on one
 * of those three screens and pressing "View Turn" — navigating to a turn URL
 * would 404.
 *
 * That is why these live under a `Dialog` heading and the WebdriverIO
 * counterpart is a component rather than a page.
 */
export const TurnIds = {
  /** The floating quick-view launcher. Its label is the uppercase `turn.title`. */
  quickViewLauncher: locator(
    'turn quick view launcher',
    'turn-quick-view-launcher',
    `//button[.//span[normalize-space()="TURN" or normalize-space()="PHIÊN LÀM VIỆC"]]`,
    textIsAnyOf(...both(Turn.title)),
  ),

  quickViewPanel: locator('turn quick view panel', 'turn-quick-view', textIsAnyOf(...both(Turn.order))),

  viewTurn: locator('view turn button', 'turn-view-btn', buttonWithAnyText(...both(Turn.view))),

  /** The dialog itself, matched by its own title so it is not any open dialog. */
  dialog: locator(
    'turn board dialog',
    'turn-board-dialog',
    `//*[@role="dialog"][.//*[normalize-space()="Turn" or normalize-space()="Phiên làm việc"]]`,
  ),

  adjustTurn: locator('adjust turn button', 'turn-adjust-btn', buttonWithAnyText(...both(Turn.adjust))),
  settings: locator('turn settings button', 'turn-settings-btn', buttonWithAnyText(...both(Turn.setting))),

  adjustDialog: locator(
    'adjust manual turn dialog',
    'turn-adjust-dialog',
    `//*[@role="dialog"][.//*[normalize-space()="Adjust Manual Turn" or normalize-space()="Chỉnh lượt thủ công"]]`,
  ),

  settingsDialog: locator(
    'turn settings dialog',
    'turn-settings-dialog',
    `//*[@role="dialog"][.//*[normalize-space()="Turn Settings" or normalize-space()="Cài đặt phiên làm việc"]]`,
  ),

  /**
   * The sort control inside the board.
   *
   * A Radix select whose current value is one of the four `turn.sort*` strings,
   * which is what distinguishes it from any other combobox in the dialog.
   */
  sortSelect: locator(
    'turn sort select',
    'turn-sort',
    `//*[@role="combobox"][contains(.,"turns first") or contains(.,"check-in first")` +
      ` or contains(.,"lượt nhất trước") or contains(.,"sớm nhất trước") or contains(.,"muộn nhất trước")]`,
  ),

  /** Any Radix option in the board's open sort dropdown. */
  sortOptions: locator('turn sort options', 'turn-sort-option-', byRole('option')),

  board: locator('turn board table', 'turn-board', 'table', byRole('table')),
  rows: locator('turn rows', 'turn-row-', 'tbody tr'),

  /** Shown when nobody clocked in — a real state, not an empty table. */
  noStaff: locator(
    'no staff clocked in',
    'turn-no-staff',
    textIsAnyOf('No staff clocked in for this day', 'Chưa có thợ nào chấm công ngày này'),
  ),

  /**
   * Column headers, used to assert that sorting changed the order.
   *
   * `th[scope="col"]` first because the app sets it; the role form covers the
   * virtualised variant, which renders divs rather than a real table.
   */
  columnHeaders: locator(
    'turn column headers',
    'turn-column-header-',
    'th[scope="col"]',
    'thead th',
    byRole('columnheader'),
  ),
} satisfies Record<string, Locator>;

/** Registered with the audit script by `src/constants/testids.ts`. */
export const PAYROLL_LOCATOR_GROUPS: Record<string, Record<string, Locator>> = {
  PayrollIds,
  TimeTrackingIds,
  TurnIds,
};
