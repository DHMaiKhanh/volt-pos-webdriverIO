/**
 * Batch History — `/batch-history`.
 *
 * Transcribed from the 2026-10-25 live scan (installed 1.1.56, merchant 14) —
 * `reports/scans/2026-10-25-feature-inventory/dom/batch-history*.json`. No
 * `data-testid` ships on this build, so the testids are PROPOSED and the
 * fallbacks are roles / bilingual text (Vietnamese from the app's own
 * `vi/common.json`).
 *
 * Two shape facts worth knowing before editing:
 *
 * 1. The batch list renders its header and its body as TWO separate `<table>`s
 *    (a header table with 0 rows, then a headless body table). Readers must not
 *    assume `thead` and `tbody` share a parent — `src/pages/incomes/reportDom.ts`
 *    stitches them back together.
 * 2. The Batch Close Review panel opens from the **Total Amount BUTTON** inside
 *    the batch row, not from a click on the row itself (clicking the `td` was
 *    tried live and does nothing).
 *
 * The preset combobox and date-range button are shared report chrome — see
 * `ReportChromeIds` in `testids.reports-v4.ts`.
 */

import { locator, type Locator } from '../helpers/selectors.js';
import type { Bilingual } from './testids.reports-v4.js';

const exact = (texts: readonly string[]): string => texts.map((t) => `normalize-space()="${t}"`).join(' or ');

export const BatchLabels = {
  title: ['Batch History', 'Lịch sử Batch'],
  batchDate: ['Batch Date', 'Ngày batch'],
  batchNumber: ['Batch Number', 'Số batch'],
  status: ['Status', 'Trạng thái'],
  totalPayment: ['Total Payment', 'Tổng thanh toán'],
  totalAmount: ['Total Amount', 'Tổng tiền'],
  noItemSelected: ['No item selected', 'Chưa chọn mục nào'],
  reviewTitle: ['Batch Close Review', 'Đối soát chốt batch'],
  notClosedYet: ['Not closed yet', 'Chưa chốt batch'],
  statusOpen: ['Open', 'Mở'],
  odCode: ['OD Code', 'Mã đơn'],
  subtotal: ['Subtotal', 'Tạm tính'],
  tip: ['Tip', 'Tiền boa'],
  total: ['Total', 'Tổng cộng'],
} as const satisfies Record<string, Bilingual>;

export const BatchHistoryIds = {
  heading: locator(
    'batch history heading',
    'batch-history-heading',
    `//*[self::h1 or self::h2 or self::h3][${exact(BatchLabels.title)}]`,
  ),

  /** Right panel's empty state. */
  noItemSelected: locator(
    'batch panel empty state',
    'batch-history-no-item',
    `//*[${exact(BatchLabels.noItemSelected)}]`,
  ),

  /** Right panel title once a batch is opened. */
  reviewTitle: locator(
    'batch close review title',
    'batch-close-review-title',
    `//*[not(*)][${exact(BatchLabels.reviewTitle)}]`,
    `//*[${exact(BatchLabels.reviewTitle)}]`,
  ),
} satisfies Record<string, Locator>;

/**
 * The Total Amount button of the N-th (1-based) batch row.
 *
 * The batch body is the first table whose rows carry a button, and the Total
 * Amount cell holds the row's ONLY button — so "last button in the row" is
 * unambiguous. The `$` guard on the fallback keeps it off any icon button.
 */
export const batchTotalAmountButton = (n: number): Locator =>
  locator(
    `batch row ${String(n)} Total Amount button`,
    `batch-history-row-${String(n)}-total-amount`,
    `(//tr[td][.//button])[${String(n)}]/td[last()]//button`,
    `(//tr[td][.//button])[${String(n)}]//button[last()]`,
    `(//button[starts-with(normalize-space(),"$")])[${String(n)}]`,
  );

/** One OD Code button in the review table, by its code. */
export const batchReviewOrderButton = (odCode: string): Locator =>
  locator(
    `batch review order ${odCode}`,
    `batch-review-order-${odCode}`,
    `//button[normalize-space()="${odCode}"]`,
  );
