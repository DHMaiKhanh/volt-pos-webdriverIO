/**
 * Selectors for the specs ported from volt-qc (Playwright) — POS screen modules
 * (`tests/regression/volt-qc/pos/*`).
 *
 * ## Why these are QUERIES and not `Locator`s
 *
 * The volt-qc suite reaches nearly everything through Playwright's role/name
 * engine (`getByRole('tab', { name: /^Customer/ })`, `filter({ hasText })`,
 * `.last()`), and the installed build 1.1.x strips almost every `data-testid`,
 * so a faithful port needs the same vocabulary. A {@link VqcQuery} is that
 * vocabulary as plain data: an ARIA role (or CSS), an accessible-name match,
 * containment filters and an index. `src/pages/voltqc/pos/VoltQcProbe.ts`
 * resolves a chain of them in ONE `execute` round trip, then hands the hit to a
 * real WebDriver click — so the click still goes through the browser's hit
 * testing, an overlay still blocks it, exactly as Playwright's would.
 *
 * Every string below is the app's en-US label (volt-pos `src/locales/en/common.json`)
 * as the volt-qc suite recorded it. The ported specs assume the till is in
 * English — the same assumption the source suite makes.
 */

export type VqcRole =
  | 'button'
  | 'tab'
  | 'tabpanel'
  | 'textbox'
  | 'combobox'
  | 'checkbox'
  | 'switch'
  | 'option'
  | 'heading'
  | 'dialog'
  | 'link'
  | 'complementary'
  | 'banner'
  | 'grid'
  | 'row'
  | 'columnheader';

/** One step of a query chain; each step is resolved inside the previous step's hits. */
export interface VqcQuery {
  /** ARIA role (implicit HTML roles included). */
  readonly role?: VqcRole;
  /** CSS selector — the base set when no role is given, an extra filter when one is. */
  readonly css?: string;
  /** Accessible name, exact (whitespace-normalised). */
  readonly name?: string;
  /** Accessible name, regex source. */
  readonly nameRe?: string;
  /** Element text, exact (whitespace-normalised); keeps the innermost match only. */
  readonly text?: string;
  /** Element text, regex source; keeps the innermost match only. */
  readonly textRe?: string;
  /** Element text CONTAINS this (Playwright `filter({ hasText })`). */
  readonly hasText?: string;
  /** Element text matches this regex source. */
  readonly hasTextRe?: string;
  /** Element has a descendant matching this CSS (Playwright `filter({ has })`). */
  readonly hasCss?: string;
  /** Exact `placeholder` attribute. */
  readonly placeholder?: string;
  /** Regex flags for the `*Re` fields. */
  readonly flags?: string;
  /** Include elements that are not rendered (default: visible only). */
  readonly hidden?: boolean;
  /** Keep only the n-th hit (negative counts from the end: -1 = last). */
  readonly nth?: number;
}

export type VqcChain = VqcQuery | readonly VqcQuery[];

const MAIN: VqcQuery = { css: 'main' };
const DIALOG_LAST: VqcQuery = { role: 'dialog', nth: -1 };

/** `main` › `q` — the volt-qc `app.mainArea` scope. */
export const inMain = (q: VqcQuery): readonly VqcQuery[] => [MAIN, q];
/** The top-most open dialog › `q`. */
export const inTopDialog = (q: VqcQuery): readonly VqcQuery[] => [DIALOG_LAST, q];
/** A button by exact name. */
export const btn = (name: string, nth?: number): VqcQuery => ({ role: 'button', name, nth });
/** A button by name regex. */
export const btnRe = (nameRe: string, nth?: number): VqcQuery => ({ role: 'button', nameRe, nth });
/** A tab by exact name. */
export const tab = (name: string): VqcQuery => ({ role: 'tab', name });
/** Any element whose own text is exactly `text`. */
export const txt = (text: string): VqcQuery => ({ text });
/** Any element whose text matches. */
export const txtRe = (textRe: string): VqcQuery => ({ textRe });

/* ------------------------------------------------------------------------- *
 * Shared chrome
 * ------------------------------------------------------------------------- */

export const VqcCommon = {
  /** Passcode guard ("Enter staff code to …"). */
  passcodeDialog: { role: 'dialog', hasTextRe: 'Enter staff code|Nhập mã nhân viên', nth: -1 } as VqcQuery,
  /** The `Close` button of the top-most dialog. */
  dialogClose: inTopDialog(btn('Close', 0)),
  /** Sidebar drawer (Radix Sheet portalled to body). */
  sidebar: { css: '[data-slot="sidebar"], [data-slot="sheet-content"]', nth: -1 } as VqcQuery,
  /** Header global-search trigger ("Search..."). */
  headerSearch: [{ role: 'banner' }, { css: 'input', placeholder: 'Search...' }] as readonly VqcQuery[],
  /** Header link to the appointment board. */
  headerAppointmentLink: { css: 'header a[href^="/appointment"]', nth: 0 } as VqcQuery,
  /** The header button that opens /order-pending. */
  headerOpenPending: btn('Open pending orders'),
  errorText: 'Something went wrong',
} as const;

/* ------------------------------------------------------------------------- *
 * Home (02-home)
 * ------------------------------------------------------------------------- */

export const VqcHome = {
  quickCheckout: btn('Quick Checkout', 0),
  orderHeading: inMain({ textRe: '^#OD\\d{6}-\\d+' }),
  staffSearch: inMain({ css: 'input', placeholder: 'Search staff' }),
  serviceSearch: inMain({ css: 'input', placeholder: 'Search service' }),
  customerInput: { css: 'input', placeholder: 'Enter Customer Phone, Name or Email', nth: 0 } as VqcQuery,
  doneButton: inMain(btn('Done', 0)),
  pendingSidebar: { role: 'complementary', name: 'Pending Orders sidebar' } as VqcQuery,
  checkinToday: inMain(btnRe('^Checkin Today \\(\\d+\\)')),
  appointmentsToday: inMain(btnRe('^Appointments Today \\(\\d+\\)')),
  noAppointmentsToday: inMain(txt('No appointments today')),
  quickPayTile: inMain({ role: 'heading', name: 'Quick Pay', nth: 0 }),
  giftCardTile: inMain({ role: 'heading', name: 'Gift Card', nth: 0 }),
  noServices: inMain(txt('No services available.')),
  /** Keypad key in the centre panel (`0`-`9`, `C`). */
  keypadKey: (key: string): readonly VqcQuery[] => inMain(btn(key, 0)),
  /** Staff-name spans on the staff grid (`span.col-span-2.text-xl`). */
  staffNameCss: 'main span.col-span-2.text-xl',
  sortPopover: { css: '[data-radix-popper-content-wrapper]', hasText: 'Sort by', nth: -1 } as VqcQuery,
  sortOptions: ['Default Order', 'Name', 'Appointment Time', 'Turn Count', 'Staff Checked In'],
} as const;

export const VqcGlobalSearch = {
  placeholder: 'Search by customer Name or Phone, Order ID, QR Code',
  hint: 'Search by customer name, phone, order ID, or QR code',
  dialog: {
    role: 'dialog',
    hasCss: 'input[placeholder="Search by customer Name or Phone, Order ID, QR Code"]',
    nth: -1,
  } as VqcQuery,
  tabs: ['All', 'Appointment', 'Customer', 'Order'],
  /** Result rows (`div.cursor-pointer`). */
  resultCss: 'div.cursor-pointer',
} as const;

/* ------------------------------------------------------------------------- *
 * Sell Gift Card (04-promo)
 * ------------------------------------------------------------------------- */

export const VqcGiftCard = {
  dialog: { role: 'dialog', name: 'Sell Gift Card', nth: -1 } as VqcQuery,
  detailsDialog: { role: 'dialog', hasText: 'Gift Card Details', nth: -1 } as VqcQuery,
  historyDialog: { role: 'dialog', name: 'Gift card history', nth: -1 } as VqcQuery,
  codeBox: { role: 'textbox', name: 'Enter gift card code' } as VqcQuery,
  customAmount: { role: 'textbox', name: '$0.00', nth: 0 } as VqcQuery,
  add: btn('Add'),
  scan: btnRe('Scan'),
  viewDetails: btn('View Details'),
  quick: ['$25', '$50', '$100'] as const,
  layoutLabels: [
    'Card Number',
    'Gift Card Value',
    'Custom Amount',
    'Max $10,000.00',
    'Total Balance',
    'Customer Pays',
  ],
  invalid: 'Invalid gift card number',
  balanceRe: '^Balance: \\$[\\d,.]+$',
} as const;

/* ------------------------------------------------------------------------- *
 * Pending page (06-pending, 17-added)
 * ------------------------------------------------------------------------- */

export const VqcPending = {
  searchPlaceholder: 'Search order ID, customer name or phone',
  searchBox: inMain({ css: 'input', placeholder: 'Search order ID, customer name or phone', nth: 0 }),
  staffButton: inMain(btnRe('^\\s*Staff\\s*\\d*\\s*$', 0)),
  sortCombo: inMain({ role: 'combobox', hasTextRe: '^\\s*(Latest|Oldest|Mới nhất|Cũ nhất)\\s*$', nth: 0 }),
  dateRange: { css: '#selected-date-range' } as VqcQuery,
  presetCombo: [
    { css: 'div:has(> #selected-date-range)' },
    { role: 'combobox', nth: 0 },
  ] as readonly VqcQuery[],
  quickCheckout: inMain(btn('Quick Checkout', 0)),
  filtersButton: inMain(btnRe('^Filters?$')),
  cards: inMain(btnRe('^\\s*OD\\d{6}-\\d+')),
  calendarPopover: {
    css: '[data-slot="popover-content"]',
    hasCss: 'button',
    hasText: 'Apply',
    nth: -1,
  } as VqcQuery,
  noPending: 'No pending orders',
  noPendingDesc: 'New orders created from check-in or appointments will show up here.',
  presets: [
    'Today',
    'Yesterday',
    'This Week',
    'Last Week',
    'Last 7 Days',
    'This Month',
    'Last Month',
    'Last 30 Days',
  ],
} as const;

/* ------------------------------------------------------------------------- *
 * Order History (07-order-history, 19-reopen)
 * ------------------------------------------------------------------------- */

export const VqcOrderHistory = {
  heading: { role: 'heading', name: 'Order History' } as VqcQuery,
  searchBox: inMain({ role: 'textbox', name: 'Search order ID, customer name or phone' }),
  rowCss: 'main a[href^="/order-history/"]',
  dateRange: inMain({ css: '#selected-date-range', nth: 0 }),
  datePopover: { css: '[data-radix-popper-content-wrapper]', hasText: 'Apply', nth: -1 } as VqcQuery,
  filterButton: inMain(btn('Filter')),
  filterRedDot: [MAIN, btn('Filter'), { css: 'span.bg-destructive' }] as readonly VqcQuery[],
  filterDialog: { role: 'dialog', hasCss: '[role="combobox"]', hasText: 'Filter', nth: -1 } as VqcQuery,
  noOrders: 'No Orders Found',
  noOrdersDesc: 'There are no orders to display.',
  noSearchResults: 'Your search did not return any results.',
  selectOrder: 'Select an order to view details.',
  accessTitle: 'Enter staff code to access Order History',
  rangeLimit: 'Date range cannot exceed 6 months.',
  passcodeSkipKey: 'volt-passcode-skip',
  wrongCode: /Failed to verify staff code|Invalid staff code/,
} as const;

/* ------------------------------------------------------------------------- *
 * Appointment board (08-appointment)
 * ------------------------------------------------------------------------- */

export const VqcAppointment = {
  filtersKey: 'appointment_filters',
  dateKey: 'appointment_filter_date',
  prevDay: { css: 'main button[aria-label="Previous day"]', nth: 0 } as VqcQuery,
  nextDay: { css: 'main button[aria-label="Next day"]', nth: 0 } as VqcQuery,
  dateButton: inMain({ css: 'button', hasTextRe: '^\\s*\\d{2}\\/\\d{2}\\/\\d{4}\\s*$', nth: 0 }),
  now: inMain({ css: 'button', hasTextRe: '^\\s*(Now|Bây giờ)\\s*$', nth: 0 }),
  reset: inMain({ css: 'button', hasTextRe: '^\\s*(Reset to Default|Đặt lại mặc định)\\s*$', nth: 0 }),
  staffsButton: inMain({ css: 'button', hasTextRe: '^\\s*(Staffs|Nhân viên)\\s*\\d*\\s*$', nth: 0 }),
  statusesButton: inMain({ css: 'button', hasTextRe: '^\\s*(Statuses|Trạng thái)\\s*\\d*\\s*$', nth: 0 }),
  staffPopover: { css: '[data-slot="popover-content"]', hasCss: '#select-all-staff', nth: -1 } as VqcQuery,
  statusPopover: { css: '[data-slot="popover-content"]', hasCss: '#select-all-status', nth: -1 } as VqcQuery,
  calendar: { css: '[data-slot="calendar"]', nth: -1 } as VqcQuery,
  overviewTitle: 'Appointment Overview',
  emptyTitle: 'No appointments to show',
  emptyDesc: 'Select one or more staff or status filters to view appointments.',
  statusLabels: ['Scheduled', 'Canceled', 'Confirmed', 'Done'],
  statusIds: ['scheduled', 'canceled', 'confirmed', 'done'],
} as const;

/* ------------------------------------------------------------------------- *
 * Turn board (15-turn)
 * ------------------------------------------------------------------------- */

export const VqcTurn = {
  settingsDialog: { role: 'dialog', hasText: 'Turn Settings', nth: -1 } as VqcQuery,
  settingsLabels: [
    'Calculate turns from services instead of orders',
    'On: count a turn for each service, using the turn value below. Off: each completed order counts as 1 turn.',
    'Calculate turn values with decimals instead of rounding',
    'On: turn counts can include decimals (e.g. 1.6). Off: turn counts are whole numbers.',
  ],
  savedToast: { css: '[data-sonner-toast]', hasText: 'Turn value saved' } as VqcQuery,
  chargeFeeTurnCard: { css: '[data-slot="card"]', hasText: 'Turn Settings', nth: 0 } as VqcQuery,
} as const;

/* ------------------------------------------------------------------------- *
 * Order detail buttons (07 / 19)
 * ------------------------------------------------------------------------- */

export const VqcDetail = {
  button: (name: string): readonly VqcQuery[] => inMain(btn(name)),
  refund: { css: '[data-testid="order-action-refund"]' } as VqcQuery,
} as const;
