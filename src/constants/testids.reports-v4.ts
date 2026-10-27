/**
 * Reports V4 — `/report-pages/v4/{daily-sale-report|income-summary|staff-income|staff-payroll}`
 * — plus the report CHROME every date-ranged report screen shares (preset
 * combobox, date-range button, Day/Week/Month tabs, the generic table shape).
 *
 * ## Provenance
 *
 * Transcribed from the live scan of 2026-10-25 (installed 1.1.56, merchant 14,
 * DEV) — `reports/scans/2026-10-25-feature-inventory/dom/v4-*.json`. That build
 * strips every `data-testid` except `env-badge`, so the testids below are
 * PROPOSED names and the fallbacks are what actually resolves: ARIA roles, the
 * one literal DOM id (`#selected-date-range`) and bilingual visible text whose
 * Vietnamese halves were read from `volt-pos/src/locales/vi/common.json`.
 *
 * The shared chrome lives here rather than in a fourth file because Batch
 * History and Income Summary render the very same components; the two sibling
 * catalogues import it instead of declaring the same element twice.
 */

import { locator, type Locator } from '../helpers/selectors.js';

/** One label in both locale bundles. */
export type Bilingual = readonly [en: string, vi: string];

const exact = (texts: readonly string[]): string => texts.map((t) => `normalize-space()="${t}"`).join(' or ');

/* ------------------------------------------------------------------------- *
 * Shared report chrome
 * ------------------------------------------------------------------------- */

/** The ten date presets, in the order the combobox lists them. */
export const DATE_PRESETS = {
  today: ['Today', 'Hôm nay'],
  yesterday: ['Yesterday', 'Hôm qua'],
  thisWeek: ['This Week', 'Tuần này'],
  lastWeek: ['Last Week', 'Tuần trước'],
  last7Days: ['Last 7 Days', '7 ngày qua'],
  thisMonth: ['This Month', 'Tháng này'],
  lastMonth: ['Last Month', 'Tháng trước'],
  last30Days: ['Last 30 Days', '30 ngày qua'],
  thisYear: ['This Year', 'Năm nay'],
  lastYear: ['Last Year', 'Năm trước'],
} as const satisfies Record<string, Bilingual>;

export type DatePreset = keyof typeof DATE_PRESETS;

/** Day / Week / Month group-by tabs (Radix Tabs; trigger ids end in `-trigger-<value>`). */
export const GROUP_TABS = {
  day: ['Day', 'Ngày'],
  week: ['Week', 'Tuần'],
  month: ['Month', 'Tháng'],
} as const satisfies Record<string, Bilingual>;

export type GroupTab = keyof typeof GROUP_TABS;

export const ReportChromeIds = {
  /**
   * The preset picker. A Radix Select trigger — `button[role=combobox]`. The
   * report screens carry exactly one combobox before the group-by one on V4
   * Income Summary, so the FIRST is the preset.
   */
  presetCombobox: locator('date preset combobox', 'report-date-preset', '(//*[@role="combobox"])[1]'),

  /** Every option of whichever Radix Select listbox is open (portalled to body). */
  options: locator('select options', 'report-select-option-', '[role="option"]'),

  /** The date-range button. A literal DOM id — the strongest handle on these screens. */
  dateRange: locator('selected date range', 'report-date-range', '#selected-date-range'),

  /** Loading placeholders — the reports paint their shell before the query lands. */
  skeleton: locator('loading skeleton', 'report-skeleton', '[data-slot="skeleton"]', '.animate-pulse'),
} satisfies Record<string, Locator>;

export const presetOption = (preset: DatePreset): Locator =>
  locator(
    `preset option ${DATE_PRESETS[preset][0]}`,
    `report-date-preset-option-${preset}`,
    `//*[@role="option"][${exact(DATE_PRESETS[preset])}]`,
  );

/**
 * One group-by tab. The Radix id prefix (`radix-_r_jv_-`) is generated per
 * mount, so only the SUFFIX is matched; text is the fallback.
 */
export const groupTab = (tab: GroupTab): Locator =>
  locator(
    `group-by tab ${GROUP_TABS[tab][0]}`,
    `report-group-tab-${tab}`,
    `[role="tab"][id$="-trigger-${tab}"]`,
    `//*[@role="tab"][${exact(GROUP_TABS[tab])}]`,
  );

/**
 * Raw CSS fragments the in-page table/text readers (`src/pages/incomes/reportDom.ts`)
 * hand to `browser.execute`. Kept here so the catalogue still names every
 * selector the suite depends on.
 */
export const ReportDomCss = {
  table: 'table',
  headCell: 'th',
  bodyRow: 'tr',
  cell: 'td',
  clickable: 'button, [role="button"]',
} as const;

/* ------------------------------------------------------------------------- *
 * Reports V4
 * ------------------------------------------------------------------------- */

export const V4_SLUGS = ['daily-sale-report', 'income-summary', 'staff-income', 'staff-payroll'] as const;
export type V4Slug = (typeof V4_SLUGS)[number];

export const V4_ROUTE_PREFIX = '/report-pages/v4/';

export const V4_TITLES: Record<V4Slug, Bilingual> = {
  'daily-sale-report': ['Daily Sale Report', 'Doanh thu ngày'],
  'income-summary': ['Income Summary', 'Tổng hợp thu nhập'],
  'staff-income': ['Staff Income', 'Thu nhập nhân viên'],
  'staff-payroll': ['Staff Payroll', 'Bảng lương nhân viên'],
};

/** Card / tile titles, as the first text line of each card. */
export const V4Labels = {
  vsYesterday: ['vs Yesterday', 'so với hôm qua'],
  reportsV4Group: ['Reports V4', 'Báo cáo V4'],
  noDetail: ['No detail to show', 'Không có chi tiết để hiển thị'],
  currentPeriod: ['Current Period', 'Kỳ hiện tại'],
  giftCardRedemption: ['Gift Card Redemption', 'Thanh toán bằng thẻ quà tặng'],
  paymentDetailsTab: ['Payment Details', 'Chi tiết thanh toán'],

  // Daily Sale Report tiles
  totalOrder: ['Total Order', 'Tổng đơn'],
  sale: ['Sale', 'Doanh thu'],
  totalTip: ['Total tip', 'Tổng tiền boa'],
  totalPayment: ['Total Payment', 'Tổng thanh toán'],

  // Income Summary tile
  totalIncome: ['Total Income', 'Tổng thu nhập'],

  // Staff Income / Staff Payroll cards
  totalStaff: ['Total staff', 'Tổng nhân viên'],
  totalOrders: ['Total orders', 'Tổng đơn hàng'],
  totalSubtotal: ['Total subtotal', 'Tổng tạm tính'],
  totalSupplyFee: ['Total supply fee', 'Tổng phí vật tư'],
  totalStaffIncome: ['Total staff income', 'Tổng thu nhập'],

  // Table head markers used to pick the right table
  orderNumberHead: ['Order #', 'Đơn #'],
  dateHead: ['Date', 'Ngày'],
  supplyFeeHead: ['Supply Fee', 'Phí vật tư'],
} as const satisfies Record<string, Bilingual>;

export const ReportsV4Ids = {
  /**
   * The "V4" badge beside every V4 report title. Leaf-only and exact, so the
   * sidebar's "Reports V4" group label (not exact "V4") never matches it.
   */
  v4Badge: locator('V4 badge', 'report-v4-badge', '//*[not(*)][normalize-space()="V4"]'),

  /** The sidebar group toggle. Collapsed by default. */
  menuGroup: locator(
    'Reports V4 menu group',
    'app-sidebar-group-reports-v4',
    `//*[@data-slot="sidebar"]//*[self::button or @role="button"][.//*[${exact(V4Labels.reportsV4Group)}] or ${exact(V4Labels.reportsV4Group)}]`,
    `//*[@data-slot="sidebar"]//*[${exact(V4Labels.reportsV4Group)}]`,
  ),

  /** Every V4 link in the open drawer. */
  menuLinks: locator(
    'Reports V4 menu links',
    'app-sidebar-item-report-v4-',
    `[data-slot="sidebar"] a[href^="${V4_ROUTE_PREFIX}"]`,
    `[data-sidebar="sidebar"] a[href^="${V4_ROUTE_PREFIX}"]`,
  ),

  /** Detail panel empty state ("No detail to show"). */
  noDetail: locator('report no-detail state', 'report-no-detail', `//*[${exact(V4Labels.noDetail)}]`),

  /** Staff Income / Payroll name search. */
  search: locator(
    'staff search',
    'report-staff-search',
    'input[placeholder="Search"]',
    'input[placeholder="Tìm kiếm"]',
    'input[placeholder*="Search" i]',
  ),

  /** "Show staff with no income" switch (Radix Switch). */
  noIncomeSwitch: locator('show staff with no income switch', 'report-show-no-income', '[role="switch"]'),

  /** The Payment Details tab of the DSR V4 right panel. */
  paymentDetailsTab: locator(
    'DSR payment details tab',
    'report-dsr-payment-details-tab',
    `//*[self::button or @role="button" or @role="tab"][${exact(V4Labels.paymentDetailsTab)}]`,
  ),
} satisfies Record<string, Locator>;

export const v4MenuLink = (slug: V4Slug): Locator =>
  locator(
    `Reports V4 menu link ${slug}`,
    `app-sidebar-item-${V4_ROUTE_PREFIX}${slug}`,
    `[data-slot="sidebar"] a[href="${V4_ROUTE_PREFIX}${slug}"]`,
  );

export const v4Heading = (slug: V4Slug): Locator =>
  locator(
    `${V4_TITLES[slug][0]} heading`,
    `report-v4-heading-${slug}`,
    `//*[self::h1 or self::h2 or self::h3][${exact(V4_TITLES[slug])}]`,
    `//*[not(*)][${exact(V4_TITLES[slug])}]`,
  );

/**
 * The N-th (1-based) data row's first cell of the table whose header carries
 * `headMarker` — the click target that opens a report's detail panel.
 */
export const tableRowCell = (headMarker: Bilingual, n: number): Locator =>
  locator(
    `row ${String(n)} of the "${headMarker[0]}" table`,
    `report-table-row-${String(n)}`,
    `(//table[.//th[${exact(headMarker)}]]//tbody/tr[td])[${String(n)}]/td[1]`,
    `(//tbody/tr[td])[${String(n)}]/td[1]`,
  );
