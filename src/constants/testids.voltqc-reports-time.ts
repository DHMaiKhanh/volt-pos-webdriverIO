/**
 * Selectors and on-screen texts for the specs ported from volt-qc
 * (`e2e/tests/10-reports/*` and `e2e/tests/09-time/*`, `@readonly` only).
 *
 * The installed build 1.1.x strips most `data-testid`s, so these are the same
 * structural hooks the volt-qc Playwright helpers (`src/flows/rpt.ts`,
 * `src/flows/time.ts`) used against the live app: Radix/shadcn `data-slot`
 * attributes, ARIA roles, a handful of stable ids and the English copy from
 * `locales/en/common.json`.
 *
 * Everything here is a plain CSS / XPath string or a text constant — the
 * helpers in `src/pages/voltqc/reports-time/` mostly read the DOM in one
 * `browser.execute`, where a `Locator` object would be of no use.
 */

/** Report routes (V1 — the routes the volt-qc tests target). */
export const RptRoutes = {
  daily: '/incomes/income-daily',
  summary: '/incomes/income-summary',
  staff: '/incomes/income-staff',
  payroll: '/incomes/staff-payroll',
  batch: '/batch-history',
  timeTracking: '/time-tracking',
  home: '/home',
} as const;

export type RptRouteKey = keyof typeof RptRoutes;

/** Page names as interpolated into "Enter staff code to access <name>". */
export const RptTitles: Record<'daily' | 'summary' | 'staff' | 'payroll' | 'batch', string> = {
  daily: 'Daily Sale Report',
  summary: 'Income Summary',
  staff: 'Staff Income',
  payroll: 'Staff Payroll',
  batch: 'Batch History',
};

/** Structural CSS hooks. */
export const RptCss = {
  main: 'main',
  leftPane: '[data-slot="income-layout-left"]',
  rightPane: '[data-slot="income-layout-right"]',
  skeleton: '[data-slot="skeleton"]',
  card: '[data-slot="card"]',
  badge: '[data-slot="badge"]',
  toast: '[data-sonner-toast]',
  dateRange: '#selected-date-range',
  combobox: '[role="combobox"]',
  option: '[role="option"]',
  listbox: '[role="listbox"]',
  switch: '[role="switch"]',
  visibleDialog: '[role="dialog"], [role="alertdialog"]',
  popper: '[data-radix-popper-content-wrapper]',
  sidebar: '[data-sidebar="sidebar"]',
  offlineBanner: '[data-testid="income-offline-banner"]',
  /** Batch History right panel (Batch Close Review / "No item selected"). */
  batchReview: 'div.w-1\\/3',
  /** Passcode guard keypad dots (`passcode-guard-dialog.tsx`). */
  gateFilledDot: 'div.rounded-full.bg-primary-500',
  gateEmptyDot: 'div.rounded-full.bg-neutral-500',
  gateError: 'span.text-red-500',
  /** Time Keeping dialog: staff tiles are fixed 220x108 cards. */
  tkTile: 'div[class*="h-[108px]"]',
  tkTileName: 'span.truncate',
  /** Time Tracking virtualised table rows. */
  ttRow: 'tbody tr[data-index]',
  formItem: '[data-slot="form-item"]',
  formLabel: '[data-slot="form-label"]',
  timeInput: 'input[type="time"]',
  /** The header clock icon has no aria-label; its svg carries this clipPath id. */
  headerTimeKeepingIcon: '[id="clip0_header_tk"]',
} as const;

/** English copy the specs assert on (develop `locales/en/common.json`). */
export const RptText = {
  gateHeading: /Enter staff code to access|Nhập mã nhân viên để truy cập/,
  skip30: 'Do not require passcode for the next 30 minutes',
  invalidCode: /^(Invalid staff code|Failed to verify staff code)$/,
  failedVerify: 'Failed to verify staff code',
  inactive: 'This staff is inactive',
  offlineBanner: 'The data is not accurate when the app is offline',
  noData: 'No data available',
  noChartData: 'No chart data available',
  tryDifferentDate: 'Try selecting a different date',
  noDetail: 'No detail to show',
  summaryNoDetailHint: 'Select a period from the table to view income details.',
  staffNoDetailHint: 'Select staff to preview income details or print reports.',
  noResults: 'No results found.',
  noOrdersForDate: 'No orders found for the selected date.',
  showNoIncome: 'Show staff with no income',
  estimated: 'Estimated — figures update until the period is closed.',
  noBatches: 'No batches found.',
  noItemSelected: 'No item selected',
  batchCloseReview: 'Batch Close Review',
  notClosedYet: 'Not closed yet',
  orderDetails: 'Order Details',
  ttEmpty: 'No time tracking records',
  ttEmptyRange: 'No time tracking data for the selected date range.',
  tkNoStaff: 'No staff found.',
} as const;

export const DAILY_CARDS = ['Total Order', 'Sale', 'Total tip', 'Total Payment'] as const;

export const DAILY_CARD_DESCRIPTIONS: Record<(typeof DAILY_CARDS)[number], string> = {
  'Total Order': 'Total number of order, excluding cancel/refunds/ manual refunds',
  Sale: 'Total sale amount of the order, including refund/partial refund values after discount is applied, excluding Tax and Tip.',
  'Total tip': 'Total tips received, not included in sales revenue but counted in collected amounts.',
  'Total Payment': 'The final revenue includes Gift Card Redemption.',
};

export const DATE_PRESETS = [
  'Today',
  'Yesterday',
  'This Week',
  'Last Week',
  'Last 7 Days',
  'This Month',
  'Last Month',
  'Last 30 Days',
  'This Year',
  'Last Year',
] as const;

/** Income Summary "vs. <x>" comparison label per preset. */
export const SUMMARY_COMPARISON: Record<string, string> = {
  Today: 'Same day last week',
  Yesterday: 'Same day last week',
  'This Week': 'Last Week',
  'Last Week': 'Week before last',
  'This Month': 'Last Month',
  'Last Month': 'Month before last',
  'This Year': 'Last Year',
  'Last Year': 'Year before last',
  'Last 7 Days': 'Previous 7 days',
  'Last 30 Days': 'Previous 30 days',
  Custom: 'Previous period',
};

export const STAFF_SUMMARY_LABELS = [
  'Total staff',
  'Total orders',
  'Total subtotal',
  'Total supply fee',
  'Total tip',
  'Total staff income',
] as const;

export const STAFF_COLUMNS = ['Name', 'Orders', 'Subtotal', 'Supply Fee', 'Tip', 'Total Income'] as const;

/** Sidebar entries in the order volt-qc RPT-T01 expects them. */
export const SIDEBAR_ORDER = [
  'Order History',
  'Batch History',
  'Daily Sale Report',
  'Income Summary',
  'Staff Income',
  'Staff Payroll',
  'Time Keeping',
  'Time Tracking',
  'Turn',
  'Setting',
  'Version Update',
  'Reload',
] as const;

/** `src/lib/passcode-skip.ts` localStorage key. */
export const SKIP_KEY = 'volt-passcode-skip';

/** Relative-XPath helpers (scoped searches through `$(scope).$(xpath)`). */
export const RptXpath = {
  /** A button whose own normalised text is exactly `text`. */
  buttonText: (text: string): string => `.//button[normalize-space(.)="${text}"]`,
  /** Any element whose normalised text is exactly `text`. */
  exactText: (tag: string, text: string): string => `.//${tag}[normalize-space(.)="${text}"]`,
  /** A role=option anywhere in the document whose text is exactly `text`. */
  option: (text: string): string => `//*[@role="option"][normalize-space(.)="${text}"]`,
  /** A role=tab whose text is exactly `text`. */
  tab: (text: string): string => `.//*[@role="tab"][normalize-space(.)="${text}"]`,
};
