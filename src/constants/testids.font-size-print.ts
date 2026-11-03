/**
 * VP-4809 — Font Size setting (Settings → Accessibility) and "print several
 * staff on one receipt" on the V4 Staff Income / Staff Payroll report pages.
 *
 * ## Provenance
 *
 * Read from volt-pos `origin/develop` @ 9bacacdd1 (PR volt-pos#3087):
 *
 * - `settings/accessibility/-shared/setting-radio-card.tsx` — each radio is a
 *   Radix `RadioGroupItem` whose `id` AND `data-testid` are `font-size-<option>`
 *   (`small` / `medium` / `large`). Both are real, so the DOM id is the fallback.
 * - `report-pages/-block/table/report-table-row.tsx` / `report-table.tsx` — the
 *   print tick boxes are Radix `Checkbox`es (`button[role=checkbox]`) carrying
 *   `data-testid="report-table-tick-all"` (header) and
 *   `report-table-tick-<rowKey>` (rows), `aria-label` = "Select All" / the row's
 *   staff name.
 * - `report-pages/-action/report-print-button.tsx` — the Print button has NO
 *   testid; its label is `actions.print` ("Print" / "In") or
 *   `global.reportPrintTicked` ("Print ({{count}})" / "In ({{count}})").
 * - `report-pages/-action/report-print-progress-dialog.tsx` —
 *   `data-testid="report-print-progress"`, text `global.reportPrintPreparing`.
 *
 * New file (not `testids.ts`) on purpose: the shared catalogue has uncommitted
 * edits from parallel work.
 */

import { locator, type Locator } from '../helpers/selectors.js';

/** One label in both locale bundles (`locales/{en,vi}/common.json`). */
type Bilingual = readonly [en: string, vi: string];

const anyExact = (texts: readonly string[]): string =>
  texts.map((t) => `normalize-space()="${t}"`).join(' or ');

export const FONT_SIZES = ['small', 'medium', 'large'] as const;
export type FontSizeOption = (typeof FONT_SIZES)[number];

/** Copy shown by the Font Size card and its toast. */
export const FontSizeLabels = {
  title: ['Font Size', 'Cỡ chữ'],
  small: ['Small', 'Nhỏ'],
  medium: ['Medium', 'Vừa'],
  large: ['Large', 'Lớn'],
  updated: ['Font size updated', 'Đã cập nhật cỡ chữ'],
} as const satisfies Record<string, Bilingual>;

export const FontSizeIds = {
  /** The card title (`CardTitle` → `data-slot="card-title"`). */
  cardTitle: locator(
    'font size card title',
    'font-size-card-title',
    `//*[@data-slot="card-title"][${anyExact(FontSizeLabels.title)}]`,
    `//*[${anyExact(FontSizeLabels.title)}]`,
  ),
} satisfies Record<string, Locator>;

/** One radio of the Font Size card. The testid is real (`${idPrefix}-${option}`). */
export const fontSizeRadio = (option: FontSizeOption): Locator =>
  locator(`font size radio ${option}`, `font-size-${option}`, `#font-size-${option}`);

/** Text labels next to each radio, for the "3 options" display check. */
export const fontSizeOptionLabel = (option: FontSizeOption): Locator =>
  locator(
    `font size option label ${option}`,
    `font-size-${option}-label`,
    `//label[@for="font-size-${option}"]`,
  );

/* ------------------------------------------------------------------------- *
 * Multi-staff print (Reports V4 Staff Income / Staff Payroll)
 * ------------------------------------------------------------------------- */

export const ReportPrintLabels = {
  print: ['Print', 'In'],
  /** Prefix of `global.reportPrintTicked` — "Print (3)" / "In (3)". */
  printTickedPrefix: ['Print (', 'In ('],
  selectAll: ['Select All', 'Chọn tất cả'],
  preparing: ['Preparing', 'Đang chuẩn bị'],
  skipped: ['Skipped', 'Bỏ qua'],
  nothing: ['Nothing to print for the ticked staff', 'Các nhân viên đã chọn không có số liệu để in'],
} as const;

export const ReportPrintIds = {
  /**
   * The header Print button — no testid in the app (proposed below). Matched by
   * its label, bilingual, including the "Print (n)" form.
   */
  printButton: locator(
    'report print button',
    'report-print-btn',
    `//button[${anyExact(ReportPrintLabels.print)} or starts-with(normalize-space(),"${ReportPrintLabels.printTickedPrefix[0]}") or starts-with(normalize-space(),"${ReportPrintLabels.printTickedPrefix[1]}")]`,
  ),
  /** The header "tick all" box. Real testid. */
  tickAll: locator(
    'report table tick-all',
    'report-table-tick-all',
    'table thead [role="checkbox"]',
    `//*[@role="checkbox"][@aria-label="${ReportPrintLabels.selectAll[0]}" or @aria-label="${ReportPrintLabels.selectAll[1]}"]`,
  ),
  /** Every row tick box currently mounted (the list is virtualised). */
  rowTicks: locator(
    'report table row ticks',
    'report-table-tick-',
    '[data-testid^="report-table-tick-"]:not([data-testid="report-table-tick-all"])',
  ),
  /** The modal that holds the page while several staff are collected. Real testid. */
  printProgress: locator(
    'report print progress dialog',
    'report-print-progress',
    `//*[@role="dialog"]//*[starts-with(normalize-space(),"${ReportPrintLabels.preparing[0]}") or starts-with(normalize-space(),"${ReportPrintLabels.preparing[1]}")]`,
  ),
} satisfies Record<string, Locator>;

/**
 * One row's tick box, by the staff name in its `aria-label` (a VALUE, not UI
 * copy). The app keys the testid by the row key (`report-table-tick-<rowKey>`),
 * which the screen does not show, so the aria-label fallback is what resolves.
 */
export const reportRowTick = (staffName: string): Locator =>
  locator(
    `report row tick "${staffName}"`,
    `report-table-tick-${staffName}`,
    `[data-testid^="report-table-tick-"][aria-label=${JSON.stringify(staffName)}]`,
  );

/**
 * The N-th (1-based) mounted staff row's SECOND cell (Orders) — a click target
 * that selects the row without landing on the tick box in the first cell.
 * "Staff rows" = body rows that carry a tick box, so the rail's own tables
 * (commission daily breakdown) never match.
 */
export const reportStaffRowClickCell = (n: number): Locator =>
  locator(
    `report staff row ${String(n)} (orders cell)`,
    `report-table-row-${String(n)}`,
    `(//tbody/tr[td][.//*[@role="checkbox"]])[${String(n)}]/td[2]`,
  );

/** Raw CSS for the in-page readers (`browser.execute`). */
export const ReportPrintCss = {
  // Only the staff table's own boxes: another tbody on the page (no testid,
  // e.g. "QA TEST Claude Phone") also holds a checkbox and was read as row 1.
  rowTick: '[data-testid^="report-table-tick-"]:not([data-testid="report-table-tick-all"])',
  headTick: 'table thead [role="checkbox"]',
} as const;
