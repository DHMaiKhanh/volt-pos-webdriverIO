/**
 * Income Summary (V1) — `/incomes/income-summary` — the parts the 2026-10-25
 * live scan pinned down that `testids.incomes.ts` (owned elsewhere) does not
 * cover: the group-by tabs, the empty detail panel, the Print button, the
 * clickable period rows, and the detail panel's BLOCK structure.
 *
 * ## Why the detail panel is read as text, not by locator
 *
 * The detail panel repeats the same labels across blocks — "Total Payment"
 * appears in both Payment Details and Sale Details (and they differ: see
 * BUG-INCSUM-01), "Tip" / "Tax" / "Sale" appear five times inside Payment
 * Details alone. A `//div[span="Total Payment"]` locator therefore returns
 * whichever block is first in the DOM. The page object instead walks the
 * panel's visible text in document order and splits it on the block headings
 * below, so every figure is addressed as (block, label, occurrence).
 *
 * Source: `reports/scans/2026-10-25-feature-inventory/dom/income-summary-explore.json`.
 * Vietnamese from `volt-pos/src/locales/vi/common.json`.
 */

import { locator, type Locator } from '../helpers/selectors.js';
import type { Bilingual } from './testids.reports-v4.js';

const exact = (texts: readonly string[]): string => texts.map((t) => `normalize-space()="${t}"`).join(' or ');

/** The five detail blocks, in render order. */
export const SUMMARY_BLOCKS = {
  paymentDetails: ['Payment Details', 'Chi tiết thanh toán'],
  saleDetails: ['Sale Details', 'Chi tiết bán hàng'],
  supplyFee: ['Supply Fee', 'Phí vật tư'],
  staffPayout: ['Staff Payout', 'Chi trả nhân viên'],
  salonEarnings: ['Salon Earnings', 'Thu nhập salon'],
} as const satisfies Record<string, Bilingual>;

export type SummaryBlock = keyof typeof SUMMARY_BLOCKS;

/** Labels inside the blocks, EN → VI, so a parsed Vietnamese panel maps back to EN keys. */
export const SUMMARY_LABELS = {
  cash: ['Cash', 'Tiền mặt'],
  card: ['Card', 'Thẻ'],
  others: ['Others', 'Khác'],
  sale: ['Sale', 'Doanh số'],
  refund: ['Refund', 'Hoàn tiền'],
  tip: ['Tip', 'Tiền boa'],
  tax: ['Tax', 'Thuế'],
  amountCollected: ['Amount Collected', 'Số tiền đã thu'],
  giftCardRedemption: ['Gift Card Redemption', 'Thanh toán bằng thẻ quà tặng'],
  totalPayment: ['Total Payment', 'Tổng thanh toán'],
  totalSale: ['Total Sale', 'Tổng doanh thu'],
  serviceSale: ['Service Sale', 'Doanh thu dịch vụ'],
  productSale: ['Product Sale', 'Doanh thu sản phẩm'],
  giftCardSale: ['Gift Card Sale', 'Doanh thu thẻ quà tặng'],
  totalRefund: ['Total Refund', 'Tổng hoàn tiền'],
  subtotal: ['Subtotal', 'Tạm tính'],
  totalDiscount: ['Total Discount', 'Tổng giảm giá'],
  serviceFee: ['Service Fee', 'Phí dịch vụ'],
  cashDiscount: ['Cash Discount', 'Giảm giá tiền mặt'],
  netTotal: ['Net Total', 'Doanh thu thuần'],
  taxCollected: ['Tax Collected', 'Thuế đã thu'],
  totalSupplyFee: ['Total supply fee', 'Tổng phí vật tư'],
  staffSupplyShare: ['Staff Supply Share', 'Phần vật tư nhân viên'],
  salonSupplyShare: ['Salon Supply Share', 'Phần vật tư salon'],
  totalStaffPayout: ['Total Staff Payout', 'Tổng chi trả nhân viên'],
  pay1: ['Pay 1', 'Pay 1'],
  pay2: ['Pay 2', 'Pay 2'],
} as const satisfies Record<string, Bilingual>;

export type SummaryLabel = keyof typeof SUMMARY_LABELS;

export const IncomeSummaryLabels = {
  title: ['Income Summary', 'Tổng hợp thu nhập'],
  noDetail: ['No detail to show', 'Không có chi tiết để hiển thị'],
  print: ['Print', 'In'],
  showMore: ['Show more', 'Xem thêm'],
  showLess: ['Show less', 'Thu gọn'],
  totalPaymentHead: ['Total Payment', 'Tổng thanh toán'],
  tableHead: [
    ['Date', 'Ngày'],
    ['Sale', 'Doanh số'],
    ['Tip', 'Tiền boa'],
    ['Tax', 'Thuế'],
    ['Total Payment', 'Tổng thanh toán'],
  ],
} as const;

export const IncomeSummaryExtraIds = {
  heading: locator(
    'income summary heading',
    'income-summary-heading',
    `//*[self::h1 or self::h2 or self::h3][${exact(IncomeSummaryLabels.title)}]`,
    `//*[not(*)][${exact(IncomeSummaryLabels.title)}]`,
  ),

  /** The summary table — the data-dependent readiness anchor. */
  table: locator(
    'income summary table',
    'income-summary-table',
    `//table[.//th[${exact(IncomeSummaryLabels.totalPaymentHead)}]]`,
  ),

  noDetail: locator(
    'income summary empty detail panel',
    'income-summary-no-detail',
    `//*[${exact(IncomeSummaryLabels.noDetail)}]`,
  ),

  printButton: locator(
    'income summary print button',
    'income-summary-print-btn',
    `//button[${exact(IncomeSummaryLabels.print)}] | //*[@role="button"][${exact(IncomeSummaryLabels.print)}]`,
  ),

  /** Staff Payout's "Show more" toggle — Pay 1 / Pay 2 hide behind it when collapsed. */
  showMore: locator(
    'staff payout show more',
    'income-summary-show-more',
    `//button[${exact(IncomeSummaryLabels.showMore)}] | //*[@role="button"][${exact(IncomeSummaryLabels.showMore)}]`,
    `//*[not(*)][${exact(IncomeSummaryLabels.showMore)}]`,
  ),
} satisfies Record<string, Locator>;
