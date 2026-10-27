/**
 * Query chains for the volt-qc APPT / TIME / TURN write-path ports
 * (tests/regression/volt-qc/appt-time-turn/). Same vocabulary as
 * `testids.voltqc-pos.ts` ({@link VqcQuery}, resolved by `VoltQcProbe`): build
 * 1.1.x ships almost no `data-testid`, so these anchor on roles, aria-labels,
 * `data-slot` and the app's en-US labels, exactly as the volt-qc suite does.
 *
 * Only what the read-only catalogues (`VqcAppointment`, `VqcTurn`, `RptCss`)
 * do not already hold lives here.
 */

import type { VqcQuery } from './testids.voltqc-pos.js';

export type { VqcQuery };

/* ------------------------------------------------------------------------- *
 * Appointment (08-appointment) — section owned by the APPT port
 * ------------------------------------------------------------------------- */

// @appt-section

/** Appointment card / popover / checkout chains not in `VqcAppointment`. */
export const VqaAppt = {
  /** Every rendered appointment card on the board. */
  cardCss: 'main [data-appointment-card]',
  card: (nth: number): VqcQuery => ({ css: 'main [data-appointment-card]', nth }),
  /** The appointment detail popover (board or Home) — the one with an X `aria-label="Close"`. */
  popover: {
    css: '[data-slot="popover-content"]',
    hasCss: 'button[aria-label="Close"]',
    nth: -1,
  } as VqcQuery,
  popoverClose: [
    { css: '[data-slot="popover-content"]', hasCss: 'button[aria-label="Close"]', nth: -1 },
    { css: 'button[aria-label="Close"]', nth: 0 },
  ] as readonly VqcQuery[],
  popoverCheckout: [
    { css: '[data-slot="popover-content"]', hasCss: 'button[aria-label="Close"]', nth: -1 },
    { role: 'button', name: 'Checkout', nth: 0 },
  ] as readonly VqcQuery[],
  popoverHeading: [
    { css: '[data-slot="popover-content"]', hasCss: 'button[aria-label="Close"]', nth: -1 },
    { css: 'h3', nth: 0 },
  ] as readonly VqcQuery[],
  popoverMaskedPhone: [
    { css: '[data-slot="popover-content"]', hasCss: 'button[aria-label="Close"]', nth: -1 },
    { textRe: '^\\*\\*\\*-\\*\\*\\*-\\d{4}$', nth: 0 },
  ] as readonly VqcQuery[],
  /** "Open Appointment Order" alert (device already holds another order). */
  openOrderDialog: { css: '[role="alertdialog"]', hasText: 'Open Appointment Order', nth: -1 } as VqcQuery,
  openOrderText:
    'Your current order will be kept in Pending Orders, and the selected appointment will open here. Continue?',
  /** Drag-and-drop confirm that must NOT appear on this build. */
  updateDialog: { css: '[role="alertdialog"]', hasText: 'Update appointment' } as VqcQuery,
  anyDialog: { css: '[role="dialog"],[role="alertdialog"]' } as VqcQuery,
  createTestid: { css: '[data-testid="create-appointment-button"]', hidden: true } as VqcQuery,
  createTextRe: 'Create Appointment|New Appointment|Add Appointment',
  cannotScheduleRe: 'Cannot schedule appointment|Can not schedule appointment',
  maskedPhoneRe: '\\*\\*\\*-\\*\\*\\*-\\d{4}',
  /** A Home › Appointments Today row ("hh:mm AM | name | Staff: … | ***-***-1234"). */
  homeRow: { css: 'main div.cursor-pointer', hasTextRe: 'Staff:', nth: 0 } as VqcQuery,
  homeRowCss: 'main div.cursor-pointer',
  passcodeSkipKey: 'volt-passcode-skip',
  phoneGateHeading: 'Enter staff code to continue',
  phoneGateSkip: 'Do not require passcode for the next 30 minutes',
  failedCode: 'Failed to verify staff code',
  statusLabels: ['Scheduled', 'Confirmed', 'Done', 'Canceled'],
  pendingSideSearch: [
    { role: 'complementary', name: 'Pending Orders sidebar' },
    { role: 'textbox', nth: 0 },
  ] as readonly VqcQuery[],
  pendingSideCard: (orderId: string): readonly VqcQuery[] => [
    { role: 'complementary', name: 'Pending Orders sidebar' },
    { role: 'button', nameRe: `^\\s*${orderId}`, nth: 0 },
  ],
  bookingTimeRe: 'Booking Time:',
  /** Vietnamese board labels (APPT-113). */
  vi: {
    overview: 'Tổng quan lịch hẹn',
    now: 'Bây giờ',
    staffs: 'Nhân viên',
    statuses: 'Trạng thái',
    reset: 'Đặt lại mặc định',
    empty: 'Không có lịch hẹn để hiển thị',
  },
  /** Settings › Accessibility › Appearance radios (dark-mode build only). */
  themeRadio: (theme: 'light' | 'dark'): VqcQuery => ({
    css: `[data-testid="appearance-theme-${theme}"]`,
    nth: 0,
  }),
} as const;

/* ------------------------------------------------------------------------- *
 * Time Keeping / Time Tracking (09-time-keeping) — section owned by the TIME port
 * ------------------------------------------------------------------------- */

// @time-section

/**
 * Time Tracking Add / Edit / Delete dialogs and Time Keeping copy
 * (`routes/_app/time-tracking/**`, `components/time-keeping/**`, en-US locale).
 * Read by `src/pages/voltqc/appt-time-turn/timeWrite.ts`.
 */
export const VqcTime = {
  /** Dialog titles: the dialogs carry no testid, they are told apart by their title. */
  addTitle: 'Add New Time Keeping',
  editTitle: 'Edit Time Keeping',
  deleteTitle: 'Delete Time Keeping Record',
  /** Every form row is a shadcn `FormItem` with a `FormLabel` and an optional `FormMessage`. */
  formItem: '[data-slot="form-item"]',
  formLabel: '[data-slot="form-label"]',
  formMessage: '[data-slot="form-message"]',
  timeInput: 'input[type="time"]',
  dateButton: '#selected-date-range',
  combobox: '[role="combobox"]',
  /** Radix popover trigger around the lucide clock icon (opens the 3-wheel time picker). */
  clockTrigger: 'button:has(svg.lucide-clock)',
  notePlaceholder: 'Optional note',
  staffSearchPlaceholder: 'Search staff',
  popper: '[data-radix-popper-content-wrapper]',
  wheel: '[data-rwp]',
  wheelOption: '[data-rwp-option]',
  wheelHighlightList: '[data-rwp-highlight-list]',
  /** A Time Tracking table row by its virtualiser index. */
  rowCss: (index: number): string => `main tbody tr[data-index="${String(index)}"]`,
  noteLabel: 'Note (optional, max 255)',
  selectStaffText: 'Select staff',
  toastAdded: 'Time keeping added successfully',
  toastUpdated: 'Time keeping updated successfully',
  toastDeleted: 'Time Keeping record deleted successfully',
  toastCheckIn: 'Check in successfully',
  toastCheckOut: 'Check out successfully',
  overlap: 'Time range overlaps with an existing entry for this staff.',
  staffRequired: 'Staff is required',
  gateHeading: 'Enter staff code to access Time Tracking',
  pageHeading: 'Time Tracking',
  /** Column headers of the Time Tracking table, in order (TIME-043). */
  headers: ['#', 'Staff', 'Date IN', 'Date OUT', 'Total Hours', 'Created At', 'Updated At', 'Note', 'Action'],
  /** Vietnamese copy (TIME-101 / TIME-102). */
  vi: {
    tkTitle: 'Chấm công',
    unavailable: 'Nhân viên chưa sẵn sàng',
    available: 'Nhân viên sẵn sàng',
    search: 'Tìm nhân viên',
    checkIn: 'Ghi nhận giờ vào',
    checkOut: 'Ghi nhận giờ ra',
    toastIn: 'Ghi nhận giờ vào thành công',
    toastOut: 'Ghi nhận giờ ra thành công',
    noStaff: 'Không tìm thấy nhân viên.',
    statusIn: 'VÀO',
    statusOut: 'RA',
    ttHeading: 'Quản lý chấm công',
    ttEmpty: 'Không có bản ghi chấm công',
    ttEmptyHint: 'Không tìm thấy bản ghi cho "zzz". Thử tìm kiếm khác hoặc khoảng ngày khác.',
    addTitle: 'Thêm chấm công mới',
    addLabels: ['Nhân viên', 'Giờ vào', 'Giờ ra', 'Ghi chú (không bắt buộc, tối đa 255)'],
    notePlaceholder: 'Ghi chú (không bắt buộc)',
    add: 'Thêm',
    close: 'Đóng',
    /** English words that must not survive in the Vietnamese Time Keeping dialog. */
    englishLeftRe:
      'Time Keeping|Available Staff|Unavailable Staff|Check In|Check Out|Search staff|No staff found|\\bIN\\b|\\bOUT\\b|Check-in',
  },
} as const;

/* ------------------------------------------------------------------------- *
 * Turn (15-turn) — section owned by the TURN port
 * ------------------------------------------------------------------------- */

// @turn-section

/** Turn board / quick view / Home staff card chains not in `VqcTurn` / `TurnBoardIds`. */
export const VqaTurn = {
  /** The Turn board dialog — the only dialog carrying the `#selected-date-range` trigger. */
  boardDialog: { role: 'dialog', hasCss: '#selected-date-range', nth: -1 } as VqcQuery,
  /** Radix popover content; the quick view is the one whose `p` reads "Turn Order". */
  popoverCss: '[data-slot="popover-content"],[data-radix-popper-content-wrapper]',
  quickTitles: ['Turn Order', 'Thứ tự lượt'],
  /** The edge tab is a Popover trigger (`aria-expanded`) whose first span reads "Turn". */
  launcherCss: 'button[aria-expanded]',
  launcherTexts: ['turn', 'phiên làm việc'],
  /** The status chip text of a Turn Order row. */
  statusRe: '^(Available|Busy|Đang rảnh|Đang bận)$',
  /** Home staff tiles (testid on dev builds, the listing's clickable cards on 1.1.x). */
  staffCardCss: '[data-testid^="staff-item-"],#home-staff-listing div.cursor-pointer',
  /** A staff tile's nickname span on the Home grid (same anchor as `VqcHome.staffNameCss`). */
  staffName: (name: string): VqcQuery[] => [{ css: 'main' }, { css: 'span.col-span-2', text: name, nth: 0 }],
  adjustSavedToast: { css: '[data-sonner-toast]', hasText: 'Turn adjustments saved' } as VqcQuery,
  noStaff: 'No staff clocked in for this day',
  /** VP-1761 spec bars / legend chips that production does NOT ship (TURN-007). */
  legendLabels: ['Turn count', 'Done income', 'Processing orders', 'Processing income'],
  /** Home › Sort by popover labels. */
  homeSort: {
    turnCount: 'Turn Count',
    ascending: 'Ascending',
    descending: 'Descending',
    defaultOrder: 'Default Order',
  },
  /** Pages that must NOT carry the quick-view tab (TURN-015). */
  noTabRoutes: ['/appointment', '/settings/business'],
  tabRoutes: ['/home', '/order-pending', '/order-history'],
  /** Vietnamese labels (TURN-086). */
  vi: {
    boardTitle: 'Phiên làm việc',
    sorts: [
      'Ít lượt nhất trước',
      'Nhiều lượt nhất trước',
      'Check-in sớm nhất trước',
      'Check-in muộn nhất trước',
    ],
    adjust: 'Chỉnh lượt',
    setting: 'Cài đặt',
    unit: 'Lượt',
    current: 'Hiện tại:',
    reset: 'Đặt lại',
    adjustTitle: 'Chỉnh lượt thủ công',
    settingsTitle: 'Cài đặt phiên làm việc',
    quickTitle: 'Thứ tự lượt',
    viewTurn: 'Xem Turn',
    statusRe: 'Đang rảnh|Đang bận',
    homeTurnCount: 'Số lượt',
    englishLeftovers: [
      'Fewest turns first',
      'Adjust Turn',
      'Turn Order',
      'View Turn',
      'Available',
      'Current:',
    ],
  },
} as const;
