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

import { Home, Payroll, Turn, both } from './labels.js';
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
    textIsAnyOf(...both(Payroll.timeTracking)),
  ),

  staffPayrollHeading: locator(
    'staff payroll heading',
    'staff-payroll-heading',
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
} satisfies Record<string, Locator>;

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
  TurnIds,
};
