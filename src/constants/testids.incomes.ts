/**
 * The income reports — `/incomes/*`.
 *
 * ## Where these fallbacks come from
 *
 * Not from VP-802, which never annotated these screens. They are transcribed
 * from a Playwright suite that has 306 passing tests against this app
 * (`D:/2.POS/volt-pos-playwright`), so every structural selector below has run
 * against a live till. That provenance is the reason they are trusted; the
 * testids themselves are PROPOSED, following the app's own naming, and none of
 * them ships yet.
 *
 * Three things were CHANGED rather than copied, because the Playwright suite is
 * behind the app:
 *
 * 1. **The chart cards.** It knows four (`Total Order`, `Sale`, `Total Tip`,
 *    `Total Payment`); the app now defines six in `CHART_TYPES` —
 *    `netIncome` and `totalRefund` were added. All six are here.
 * 2. **English-only text.** Every label match is bilingual, via
 *    `src/constants/labels.ts`. A Vietnamese till breaks the original suite
 *    outright and that is not a defect worth importing.
 * 3. **The heading.** It matched the literal string `Daily Sale Report`; the
 *    app renders `t("global.dailySaleReport")`, which is `Doanh thu ngày` in
 *    Vietnamese.
 *
 * ## The two XPath idioms worth understanding before editing
 *
 * **Ancestor-by-content.** A stat card has no class or id of its own, so it is
 * reached by finding its heading and walking up to the nearest ancestor that
 * also contains the "vs Yesterday" line. That is what makes the card a
 * container rather than a heading, and it survives restyling because it names
 * content, not layout.
 *
 * **Leaf-only value.** The big number inside a card is matched with
 * `[not(.//*)]` — an element with no element children. Without it the match
 * returns the card's own wrapper, whose text is the heading, the value and the
 * percentage badge run together, and `parseMoney()` then rejects it as "more
 * than one amount". The surrounding parentheses in `(…)[1]` matter for the same
 * reason the original suite documented: an unparenthesised `//*[…][1]` takes the
 * first match in EVERY branch, so it also picks up the percentage badge.
 */

import { Actions, Home, Money, Nav, Payroll, Settings, both } from './labels.js';
import {
  buttonWithAnyText,
  cardWithTitle,
  inputWithAnyPlaceholder,
  locator,
  rowAmount,
  textIsAnyOf,
  type Locator,
} from '../helpers/selectors.js';

/* ------------------------------------------------------------------------- *
 * Chart cards — shared by Daily Sale Report and Income Summary
 * ------------------------------------------------------------------------- */

/**
 * The six charts the report can show.
 *
 * Keys are the `activeChart` URL values, verified against `CHART_TYPES` in
 * `volt-pos/src/routes/_app/incomes/income-daily/-shared/income-daily.types.ts`.
 * The labels are the i18n values behind `chartLabelKeys` in the same file —
 * note that `sale` renders `global.revenue`, whose English value is the word
 * "Sale". That mismatch between key and text is the app's, not a transcription
 * slip, and it is exactly the sort of thing a hardcoded English selector gets
 * wrong.
 */
export const CHART_CARDS = {
  sale: { en: 'Sale', vi: 'Doanh thu', key: 'global.revenue' },
  netIncome: { en: 'Net Income', vi: 'Thu nhập ròng', key: 'global.netIncome' },
  totalTip: { en: 'Total tip', vi: 'Tổng tiền boa', key: 'global.totalTip' },
  totalPayment: { en: 'Total Payment', vi: 'Tổng thanh toán', key: 'global.totalPayment' },
  totalRefund: { en: 'Total Refund', vi: 'Tổng hoàn tiền', key: 'global.totalRefund' },
  totalOrder: { en: 'Total Order', vi: 'Tổng đơn', key: 'global.totalOrder' },
} as const;

export type ChartKey = keyof typeof CHART_CARDS;

/**
 * "vs Yesterday" — the line every stat card carries and nothing else does.
 *
 * This is the anchor {@link statCard} walks up to, so it has to be right in
 * both languages or the card is unreachable on a Vietnamese till.
 */
const VS_YESTERDAY = ['vs Yesterday', 'so với hôm qua'] as const;

const vsYesterdayPredicate = VS_YESTERDAY.map((text) => `contains(normalize-space(.),"${text}")`).join(
  ' or ',
);

/**
 * One statistics card, as a CONTAINER.
 *
 * Pinned to `h4`: the page renders the same word twice — once as the card's
 * `h4` heading and once as the `h3` label above the bar chart — and matching
 * both means every scoped query inside the card is ambiguous.
 */
export const statCard = (chart: ChartKey): Locator => {
  const { en, vi } = CHART_CARDS[chart];
  return locator(
    `${en} stat card`,
    `income-card-${chart}`,
    `//h4[normalize-space()="${en}" or normalize-space()="${vi}"]` +
      `/ancestor::*[${vsYesterdayPredicate}][1]`,
  );
};

/** The big value inside a stat card. Leaf-only, percentage badge excluded. */
export const statCardValue = (chart: ChartKey): Locator => {
  const { en, vi } = CHART_CARDS[chart];
  return locator(
    `${en} stat value`,
    `income-card-${chart}-value`,
    `(//h4[normalize-space()="${en}" or normalize-space()="${vi}"]` +
      `/ancestor::*[${vsYesterdayPredicate}][1]` +
      `//*[self::div or self::span][normalize-space()][not(.//*)]` +
      `[not(contains(normalize-space(),"%"))])[1]`,
  );
};

/** The "vs Yesterday" percentage badge inside a stat card. */
export const statCardPercent = (chart: ChartKey): Locator => {
  const { en, vi } = CHART_CARDS[chart];
  return locator(
    `${en} stat percentage`,
    `income-card-${chart}-percent`,
    `//h4[normalize-space()="${en}" or normalize-space()="${vi}"]` +
      `/ancestor::*[${vsYesterdayPredicate}][1]` +
      `//*[self::div or self::span][contains(normalize-space(.),"%")]` +
      `[not(.//*[contains(normalize-space(.),"%")])]`,
  );
};

/* ------------------------------------------------------------------------- *
 * Daily Sale Report — /incomes/income-daily
 * ------------------------------------------------------------------------- */

export const IncomeDailyIps = {
  heading: locator(
    'daily sale report heading',
    'income-daily-heading',
    textIsAnyOf('Daily Sale Report', 'Doanh thu ngày'),
  ),

  /**
   * The chart label above the bar chart.
   *
   * An `h3`, unlike the cards' `h4` — which is the whole reason the card
   * locators pin the level. It reflects whichever card is active, so it is the
   * readiness signal for "the chart re-rendered after a card was clicked".
   */
  chartHeading: locator('active chart heading', 'income-daily-chart-heading', '//h3'),

  todayButton: locator('today button', 'income-daily-today-btn', buttonWithAnyText('Today', 'Hôm nay')),

  printButton: locator('print button', 'income-daily-print-btn', buttonWithAnyText(...both(Actions.print))),

  /** The date-range trigger. A literal DOM id, which is the strongest handle on this screen. */
  dateRangeTrigger: locator('selected date range', 'income-daily-date-range', '#selected-date-range'),

  ordersTable: locator('orders table', 'income-daily-orders-table', 'table', '[role="table"]'),
  orderRows: locator('order rows', 'income-daily-order-row-', 'tbody tr'),

  /**
   * The per-order detail dialog.
   *
   * `[role="dialog"]` alone matches any open dialog, so the title is part of the
   * match — on this screen more than one can legitimately be mounted (the
   * passcode guard behind it, mid-transition).
   */
  orderDetailDialog: locator(
    'order detail dialog',
    'income-daily-order-dialog',
    `//*[@role="dialog"][.//*[normalize-space()="Order Details" or normalize-space()="Chi tiết đơn hàng"]]`,
  ),

  incomeDetailsPanel: locator(
    'income details panel',
    'income-daily-income-details',
    cardWithTitle('Income Details', 'Chi tiết thu nhập'),
  ),
  paymentDetailsPanel: locator(
    'payment details panel',
    'income-daily-payment-details',
    cardWithTitle('Payment Details', 'Chi tiết thanh toán'),
  ),

  /** The right-hand column, used to disambiguate labels that also appear on the left. */
  rightColumn: locator(
    'income layout right column',
    'income-layout-right',
    '[data-slot="income-layout-right"]',
  ),

  /** Any loading placeholder. Reports paint their shell before the query lands. */
  skeleton: locator(
    'loading skeleton',
    'income-skeleton',
    '[data-slot="skeleton"]',
    '[role="status"]',
    '.animate-pulse',
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Income Summary — /incomes/income-summary
 * ------------------------------------------------------------------------- */

/**
 * A money row inside the Income Summary panels.
 *
 * Every figure on this screen is a label/amount pair in a flex row, so
 * {@link rowAmount} — which returns `span[last()]`, the AMOUNT — is the whole
 * vocabulary. Returning the row instead loses the sign on deduction lines: their
 * text reads `Total Discount - $5.00`, where the minus is no longer leading and
 * `parseMoney()` silently reads a positive number.
 */
export const summaryRow = (labelEn: string, labelVi: string): Locator =>
  locator(`${labelEn} row`, `income-summary-row`, rowAmount(labelEn, labelVi));

export const IncomeSummaryIds = {
  heading: locator(
    'income summary heading',
    'income-summary-heading',
    textIsAnyOf('Income Summary', 'Tổng hợp thu nhập'),
  ),

  saleDetails: locator(
    'sale details panel',
    'income-summary-sale-details',
    cardWithTitle('Sale Details', 'Chi tiết bán hàng'),
  ),
  paymentDetails: locator(
    'payment details panel',
    'income-summary-payment-details',
    cardWithTitle('Payment Details', 'Chi tiết thanh toán'),
  ),
  staffPayout: locator(
    'staff payout panel',
    'income-summary-staff-payout',
    cardWithTitle('Staff Payout', 'Chi trả nhân viên'),
  ),
  salonEarnings: locator(
    'salon earnings panel',
    'income-summary-salon-earnings',
    cardWithTitle('Salon Earnings', 'Thu nhập tiệm'),
  ),

  totalIncome: locator(
    'total income row',
    'income-summary-total-income',
    rowAmount(...both(Money.totalIncome)),
  ),

  detailTable: locator('summary table', 'income-summary-table', 'table', '[role="table"]'),
  detailRows: locator('summary rows', 'income-summary-row-', 'tbody tr'),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Staff Income — /incomes/income-staff
 * ------------------------------------------------------------------------- */

/**
 * The two halves of `IncomeLayout` as raw CSS, for the one-round-trip readers
 * (`browser.execute`) that cannot take a `Locator`.
 *
 * `data-slot` is written by `incomes/-components/income-layout.tsx` and is NOT
 * a testid, so build 1.1.x — which strips `data-testid` — keeps it. Scoping
 * matters on both staff screens: once a staff member is selected the RIGHT
 * panel mounts a second `<table>` (the order list / daily breakdown), and an
 * unscoped `table` or `tbody tr` then reads whichever comes first.
 */
export const INCOME_PANEL_CSS = {
  left: '[data-slot="income-layout-left"]',
  right: '[data-slot="income-layout-right"]',
} as const;

/**
 * The six summary cards above the staff list — shared verbatim by Staff Income
 * and Staff Payroll (`income-staff-summary.tsx`, reused by the payroll list).
 *
 * Each card is `<div><span>label</span><span>value</span></div>`. The VI values
 * are the app's own `locales/vi/common.json` entries (note `totalStaffIncome`
 * is "Tổng thu nhập", NOT "Tổng thu nhập nhân viên"); the older transcriptions
 * are kept as extra spellings so a till on a previous bundle still matches.
 */
export const INCOME_STATS = {
  totalStaff: ['Total staff', 'Tổng nhân viên'],
  totalOrders: ['Total orders', 'Tổng đơn hàng', 'Tổng đơn'],
  totalSubtotal: ['Total subtotal', 'Tổng tạm tính'],
  totalSupplyFee: ['Total supply fee', 'Tổng phí vật tư'],
  totalTip: ['Total tip', 'Tổng tiền boa'],
  totalStaffIncome: ['Total staff income', 'Tổng thu nhập', 'Tổng thu nhập nhân viên'],
} as const satisfies Record<string, readonly string[]>;

export type IncomeStat = keyof typeof INCOME_STATS;

const exactAny = (texts: readonly string[]): string =>
  texts.map((text) => `normalize-space()="${text}"`).join(' or ');

/** The VALUE span of one summary card. Left panel first; unscoped as a fallback. */
export const incomeStatValue = (stat: IncomeStat): Locator =>
  locator(
    `${INCOME_STATS[stat][0]} value`,
    `income-stat-${stat}`,
    `//*[@data-slot="income-layout-left"]//span[${exactAny(INCOME_STATS[stat])}]/following-sibling::span[1]`,
    `//span[${exactAny(INCOME_STATS[stat])}]/following-sibling::*[1]`,
  );

/** One staff-list row by 0-based display index (names repeat on the payroll roster). */
export const incomeListRowAt = (index: number): Locator =>
  locator(
    `staff list row #${String(index)}`,
    `income-staff-row-${String(index)}`,
    `(//*[@data-slot="income-layout-left"]//tbody/tr)[${String(index + 1)}]`,
    `(//tbody/tr)[${String(index + 1)}]`,
  );

/**
 * One option of an open Radix select (date preset / payroll period).
 *
 * Exact first; `contains` second because `PresetOptionItem` may render a check
 * icon whose markup adds nothing to the text but a future label suffix would.
 */
export const selectOptionWithText = (...texts: string[]): Locator =>
  locator(
    `select option "${texts[0] ?? ''}"`,
    `select-option-${(texts[0] ?? '').toLowerCase().replace(/\s+/g, '-')}`,
    `//*[@role="option"][${exactAny(texts)}]`,
    `//*[@role="option"][${texts.map((t) => `contains(normalize-space(),"${t}")`).join(' or ')}]`,
  );

/**
 * The right-hand detail panel shared by Staff Income and Staff Payroll.
 *
 * Both render the same header (`<h2>` nickname + `(<range>)` + Print), the same
 * "Thank you, <name>!" footer and the same empty prompt, so they share one
 * group instead of two copies drifting apart.
 */
export const IncomeDetailIds = {
  panel: locator('income detail panel', 'income-detail-panel', INCOME_PANEL_CSS.right),

  staffName: locator('detail staff name', 'income-detail-staff-name', `${INCOME_PANEL_CSS.right} h2`),

  /** `(<MM/DD/YYYY>)` or `(<from> - <to>)` — the sibling right after the name. */
  dateRange: locator(
    'detail date range',
    'income-detail-date-range',
    `//*[@data-slot="income-layout-right"]//h2/following-sibling::*[1]`,
  ),

  printButton: locator(
    'detail print button',
    'income-detail-print-btn',
    `//*[@data-slot="income-layout-right"]//button[.//span[${exactAny(both(Actions.print))}]]`,
    `//*[@data-slot="income-layout-right"]//button[${exactAny(both(Actions.print))}]`,
  ),

  thankYou: locator(
    'detail thank-you footer',
    'income-detail-thank-you',
    `//*[@data-slot="income-layout-right"]//p[starts-with(normalize-space(),"Thank you,") or starts-with(normalize-space(),"Cảm ơn,")]`,
  ),

  noDetail: locator(
    'no detail to show',
    'income-detail-empty',
    `//*[@data-slot="income-layout-right"]//*[${exactAny(['No detail to show', 'Không có chi tiết để hiển thị'])}]`,
    textIsAnyOf('No detail to show', 'Không có chi tiết để hiển thị'),
  ),

  noDetailHint: locator(
    'no detail hint',
    'income-detail-empty-hint',
    `//*[@data-slot="income-layout-right"]//*[${exactAny([
      'Select staff to preview income details or print reports.',
      'Chọn nhân viên để xem chi tiết thu nhập hoặc in báo cáo.',
    ])}]`,
  ),

  /** Payroll only: a selected staff member with no payroll rows renders `global.noData`. */
  noData: locator(
    'detail no data',
    'income-detail-no-data',
    `//*[@data-slot="income-layout-right"]//*[${exactAny(['No Data', 'Không có dữ liệu'])}]`,
  ),

  /** The order list (income) / per-day breakdown (payroll commission) inside the panel. */
  table: locator('detail table', 'income-detail-table', `${INCOME_PANEL_CSS.right} table`),

  skeleton: locator(
    'detail skeleton',
    'income-detail-skeleton',
    `${INCOME_PANEL_CSS.right} [data-slot="skeleton"]`,
    `${INCOME_PANEL_CSS.right} .animate-pulse`,
  ),

  /** `failedLoadStaffIncome` — the list's error branch, used to prove "not an error state". */
  loadError: locator(
    'staff income load error',
    'income-staff-load-error',
    textIsAnyOf('Failed to load staff income data!', 'Không tải được dữ liệu thu nhập nhân viên!'),
  ),
} satisfies Record<string, Locator>;

export const IncomeStaffIds = {
  /**
   * `IncomeLayoutHeaderTitle` is a `div[data-slot=income-header-title]`, not a
   * heading element (the live DOM's `headings` list does not contain it), and
   * it only mounts once the passcode guard is satisfied. The slot form comes
   * first so the sidebar's "Staff Income" link can never answer for it.
   */
  heading: locator(
    'staff income heading',
    'income-staff-heading',
    `//*[@data-slot="income-header-title"][${exactAny(['Staff Income', 'Thu nhập nhân viên'])}]`,
    textIsAnyOf('Staff Income', 'Thu nhập nhân viên'),
  ),

  /** The staff list. Rows open the per-staff detail on the right. */
  staffTable: locator(
    'staff income table',
    'income-staff-table',
    `${INCOME_PANEL_CSS.left} table`,
    'table',
    '[role="table"]',
  ),
  staffRows: locator(
    'staff income rows',
    'income-staff-row-',
    `${INCOME_PANEL_CSS.left} tbody tr`,
    'tbody tr',
  ),

  /**
   * NOT rendered by installed build 1.1.56 (live DOM 2026-10-25 has no input on
   * this screen) although develop's `income-staff-list.tsx` renders one. Kept
   * so the spec can tell "absent" from "broken".
   */
  searchStaff: locator(
    'staff search input',
    'income-staff-search',
    inputWithAnyPlaceholder(...both(Home.searchStaff)),
    '[placeholder*="staff" i]',
    '[placeholder*="nhân viên" i]',
  ),

  /** The preset Radix select — the only `role=combobox` in the left panel. */
  presetSelect: locator(
    'date preset select',
    'income-staff-preset',
    `${INCOME_PANEL_CSS.left} button[role="combobox"]`,
    'button[role="combobox"]',
  ),

  /** The date-range trigger. A literal DOM id (`date-range-picker`), survives the testid strip. */
  dateRange: locator('selected date range', 'income-staff-date-range', '#selected-date-range'),

  /** "Show staff with no income" — off by default, which hides zero-income rows. */
  noIncomeSwitch: locator(
    'show staff with no income switch',
    'income-staff-no-income-switch',
    `${INCOME_PANEL_CSS.left} button[role="switch"]`,
    '#report-filter-includeNoIncome',
  ),

  /** `DataTable`'s empty branch replaces the whole `<table>` with this slot. */
  emptyList: locator(
    'staff list empty state',
    'income-staff-empty',
    `//*[@data-slot="table-empty-content"][.//*[${exactAny(['No results found.', 'Không tìm thấy kết quả.'])}]]`,
    textIsAnyOf('No results found.', 'Không tìm thấy kết quả.'),
  ),

  detailPanel: locator('staff income detail', 'income-staff-detail', INCOME_PANEL_CSS.right),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Staff Payroll — /incomes/staff-payroll
 * ------------------------------------------------------------------------- */

export const StaffPayrollIds = {
  heading: locator(
    'staff payroll heading',
    'staff-payroll-heading',
    `//*[@data-slot="income-header-title"][${exactAny(both(Payroll.staffPayroll))}]`,
    textIsAnyOf(...both(Payroll.staffPayroll)),
  ),

  payrollTable: locator(
    'payroll table',
    'staff-payroll-table',
    `${INCOME_PANEL_CSS.left} table`,
    'table',
    '[role="table"]',
  ),
  payrollRows: locator('payroll rows', 'staff-payroll-row-', `${INCOME_PANEL_CSS.left} tbody tr`, 'tbody tr'),

  /** `global.searchStaff` — present on payroll in 1.1.56 (live DOM 2026-10-25). */
  searchStaff: locator(
    'payroll staff search',
    'staff-payroll-search',
    inputWithAnyPlaceholder(...both(Home.searchStaff)),
  ),

  /**
   * The pay-period Radix select (`staff-payroll-period-select.tsx`). Its value
   * reads e.g. "Current Period (Oct 23, 2026 - Oct 25, 2026)"; choosing another
   * writes `periodId` to the URL.
   */
  periodSelect: locator(
    'pay period select',
    'staff-payroll-period-select',
    `${INCOME_PANEL_CSS.left} button[role="combobox"]`,
    'button[role="combobox"]',
  ),

  /** Every option of the OPEN period select. */
  periodOptions: locator('pay period options', 'staff-payroll-period-option-', '[role="option"]'),

  /** Row links carry the staff id in the href — the only structural handle on a row. */
  staffLinks: locator('payroll staff links', 'staff-payroll-link-', 'a[href*="/settings/staffs/"]'),

  workingDays: locator(
    'working days',
    'staff-payroll-working-days',
    textIsAnyOf(...both(Payroll.workingDays)),
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Shared income chrome
 * ------------------------------------------------------------------------- */

export const IncomeNavIds = {
  incomeNav: locator('income nav item', 'app-sidebar-item-incomes', ...[`a[href*="/incomes"]`]),
  incomeTab: locator('income tab', 'income-tab', textIsAnyOf(...both(Nav.income))),

  /**
   * The offline banner.
   *
   * A CONFIRMED id — one of the ~20 the app actually ships — so it needs no
   * fallback and must not be given one.
   */
  offlineBanner: locator('income offline banner', 'income-offline-banner'),

  languageSetting: locator(
    'language setting nav',
    'settings-nav-language',
    `a[href*="/settings/language"]`,
    textIsAnyOf(...both(Settings.language)),
  ),
} satisfies Record<string, Locator>;

/** Registered with the audit script by `src/constants/testids.ts`. */
export const INCOME_LOCATOR_GROUPS: Record<string, Record<string, Locator>> = {
  IncomeDailyIps,
  IncomeSummaryIds,
  IncomeStaffIds,
  IncomeDetailIds,
  StaffPayrollIds,
  IncomeNavIds,
};
