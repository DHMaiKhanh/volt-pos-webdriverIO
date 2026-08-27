/**
 * Daily-income report rows, transcribed from the app's own schema.
 *
 * ## Every money field is NULLABLE, and that is not a formality
 *
 * `${VOLT_POS_SRC}/src/generated/schema.graphql` declares these as `Int`, not
 * `Int!` — a day with no orders returns `null` for `dailySaleSale`, not `0`.
 * The Playwright suite these types came from declared them all as `number`,
 * which made `row.dailySaleSale + row.dailySaleTip` evaluate to `NaN` on an
 * empty day and then compare unequal to every expected value with no hint as to
 * why. They are typed honestly here, and {@link cents} is the one sanctioned way
 * to read one.
 *
 * ## One shape, because the app now reads a VIEW
 *
 * There used to be a live/settled split — `storeDailyIncomeLive` for today,
 * `reportStoreDailyIncomeList` for a past day — and the Playwright suite still
 * branches on it. The app does not: `income-daily.gql.ts` selects
 * `vReportStoreDailyIncomeList` for every date, and the `v` prefix is a database
 * VIEW that already unions the live rows with the settled snapshots.
 *
 * So there is one row shape and one query, and a spec never has to know whether
 * the day it asked for has been settled yet. The un-prefixed
 * `report*`/`reportLive*` fields still exist on the schema; they are the older
 * surface and are deliberately not used here, because a spec asserting against a
 * different query than the screen renders from is not an oracle.
 *
 * All amounts are integer **cents**.
 */

/** An amount the schema may return as null. */
export type OptionalCents = number | null;

/**
 * A nullable money field as a number.
 *
 * `?? 0` inline reads as harmless and is how the NaN above got shipped — a
 * genuinely absent figure and a genuine zero become indistinguishable at the
 * call site. Going through a named function keeps "null means the backend had
 * nothing for this day" a decision someone made rather than one that leaked.
 */
export const cents = (value: OptionalCents | undefined): number => value ?? 0;

/**
 * The store's day.
 *
 * Query `reportStoreDailyIncomeList` for a settled past day,
 * `reportLiveStoreDailyIncomeList` for today.
 */
export interface StoreDailyIncomeRow {
  id: string;
  date: string;

  // ── Income Detail ────────────────────────────────────────────────────────
  dailySaleSale: OptionalCents;
  dailySaleTip: OptionalCents;
  incomeTaxAmount: OptionalCents;
  incomeTotalPayment: OptionalCents;

  // ── Payment Detail ───────────────────────────────────────────────────────
  dailySalePaymentCard: OptionalCents;
  dailySalePaymentCash: OptionalCents;
  dailySalePaymentOthers: OptionalCents;
  dailySalePaymentGiftCardRedemption: OptionalCents;
  dailySalePaymentAmountCollected: OptionalCents;
  dailySaleTotalPayment: OptionalCents;

  // ── Tax split by tender ──────────────────────────────────────────────────
  paymentTaxCard: OptionalCents;
  paymentTaxCash: OptionalCents;
  paymentTaxOthers: OptionalCents;
  paymentTaxGiftCardRedemption: OptionalCents;

  saleIncomeTaxAmount: OptionalCents;
  saleIncomeTotalPayment: OptionalCents;

  numberOrder: number | null;
}

/**
 * The store's day, Income Summary fields.
 *
 * Kept separate from {@link StoreDailyIncomeRow} because the two screens select
 * disjoint halves of one very wide type: asking for all ~85 fields to satisfy a
 * Daily Sale Report assertion makes the failure output unreadable and couples
 * the Daily spec to columns only Income Summary cares about.
 */
export interface StoreIncomeSummaryRow {
  id: string;
  date: string;

  // ── Sale Details ─────────────────────────────────────────────────────────
  incomeServiceSale: OptionalCents;
  incomeServiceRefund: OptionalCents;
  incomeProductSale: OptionalCents;
  incomeProductRefund: OptionalCents;
  incomeServiceFeeSale: OptionalCents;
  incomeServiceFeeRefund: OptionalCents;
  incomeGiftCardSale: OptionalCents;
  incomeSubtotal: OptionalCents;
  incomeDiscount: OptionalCents;
  incomeDiscountReversed: OptionalCents;
  incomeCashDiscountSale: OptionalCents;
  incomeCashDiscountRefund: OptionalCents;
  incomeTotalDiscount: OptionalCents;
  incomeTotalSale: OptionalCents;
  incomeTotalRefund: OptionalCents;
  incomeNet: OptionalCents;
  incomeNetTotal: OptionalCents;
  incomeTip: OptionalCents;
  incomeTaxAmount: OptionalCents;

  // ── Payment Details ──────────────────────────────────────────────────────
  incomeSummaryPaymentCardSale: OptionalCents;
  incomeSummaryPaymentCardRefund: OptionalCents;
  incomeSummaryPaymentCardTip: OptionalCents;
  incomeSummaryPaymentTotalCard: OptionalCents;
  incomeSummaryPaymentCashSale: OptionalCents;
  incomeSummaryPaymentCashRefund: OptionalCents;
  incomeSummaryPaymentCashTip: OptionalCents;
  incomeSummaryPaymentTotalCash: OptionalCents;
  incomeSummaryPaymentOthersSale: OptionalCents;
  incomeSummaryPaymentOthersRefund: OptionalCents;
  incomeSummaryPaymentOthersTip: OptionalCents;
  incomeSummaryPaymentTotalOthers: OptionalCents;
  incomeSummaryPaymentGiftCardSale: OptionalCents;
  incomeSummaryPaymentGiftCardTip: OptionalCents;
  incomeSummaryPaymentGiftCardRedemption: OptionalCents;
  incomeSummaryPaymentAmountCollected: OptionalCents;
  incomeSummaryTotalPayment: OptionalCents;

  // ── Staff Payout ─────────────────────────────────────────────────────────
  staffPayoutTotalService: OptionalCents;
  staffPayoutCommission: OptionalCents;
  staffPayoutSupplyShare: OptionalCents;
  staffPayoutCleanUpFee: OptionalCents;
  staffPayoutSalary: OptionalCents;
  staffPayoutTip: OptionalCents;
  staffPayoutCardFeeCharge: OptionalCents;
  staffPayoutCardFeeChargeTipSale: OptionalCents;
  staffPayoutCardFeeChargeTipRefund: OptionalCents;
  staffPayoutDiscountCharge: OptionalCents;
  staffPayoutDiscountChargeReversed: OptionalCents;
  staffPayoutPay1: OptionalCents;
  staffPayoutPay2: OptionalCents;
  staffPayoutTotal: OptionalCents;

  // ── Salon Earnings ───────────────────────────────────────────────────────
  salonEarningsTotalService: OptionalCents;
  salonEarningsCommission: OptionalCents;
  salonEarningsProductSale: OptionalCents;
  salonEarningsProductRefund: OptionalCents;
  salonEarningsSupplyShare: OptionalCents;
  salonEarningsStaffSupplyShare: OptionalCents;
  salonEarningsCleanUpFee: OptionalCents;
  salonEarningsStaffSalary: OptionalCents;
  salonEarningsDiscount: OptionalCents;
  salonEarningsDiscountReversed: OptionalCents;
  salonEarningsTotalDiscount: OptionalCents;
  salonEarningsTaxAmount: OptionalCents;
  salonEarningsNet: OptionalCents;
  salonEarningsTotal: OptionalCents;

  // ── Supply fee split ─────────────────────────────────────────────────────
  supplyFeeTotal: OptionalCents;
  supplyFeeStaffShare: OptionalCents;
  supplyFeeSalonShare: OptionalCents;
}

/**
 * One staff member's day.
 *
 * `reportStaffDailyIncomeList` (settled) and `reportLiveStaffDailyIncomeList`
 * (today) share this shape — again verified field-by-field against the schema.
 *
 * `pay1` / `pay2` are the two pay-period buckets, NOT a running total: only
 * `tip`, `cleanUpFee`, `staffSalary` and `subtotal` sum cleanly to the
 * store-level Staff Payout. `staffCommission`, `pay1`, `pay2`, `supplyFee` and
 * `totalIncome` do not, because the store rollup applies the staff/salon split
 * first. Summing them anyway is the single most common wrong assertion on this
 * screen.
 */
export interface StaffDailyIncomeRow {
  id: string;
  staffId: string | null;
  staffName: string | null;
  date: string;

  numberOfOrders: number | null;
  sale: OptionalCents;
  refund: OptionalCents;
  subtotal: OptionalCents;
  supplyFee: OptionalCents;
  staffCommission: OptionalCents;
  cleanUpFee: OptionalCents;
  staffSalary: OptionalCents;
  totalIncome: OptionalCents;

  tip: OptionalCents;
  cashTip: OptionalCents;
  creditCardTip: OptionalCents;
  giftCardTip: OptionalCents;
  otherTip: OptionalCents;

  cardFeeCharge: OptionalCents;
  cardFeeChargeTipSale: OptionalCents;
  cardFeeChargeTipRefund: OptionalCents;
  discountCharge: OptionalCents;
  discountChargeReversed: OptionalCents;

  pay1: OptionalCents;
  pay2: OptionalCents;
  rate: number | null;
  /** `commission` | `salary` | `commission_salary` */
  compensation: string | null;
  totalHour: number | null;
  workDays: number | null;
}

/**
 * One order's contribution to the store's day.
 *
 * The backend guarantees `total = saleAmount + refundAmount + taxAmount +
 * tipAmount`, with exactly one of sale/refund non-zero per row.
 *
 * ## There is no `orderCode` here
 *
 * The Playwright model declared one and the field does not exist on the view —
 * `VReportStoreDailyIncomeOrder` carries `orderId` and no relation to `Order`,
 * so a query selecting `orderCode` (flat OR nested) is rejected outright. A
 * spec that needs the human-readable code looks it up by `orderId`; see
 * {@link OrderService.orderCodesById}.
 */
export interface StoreDailyIncomeOrderRow {
  id: string;
  orderId: string;
  saleAmount: number;
  refundAmount: number;
  tipAmount: number;
  taxAmount: OptionalCents;
  giftCardSaleRedemptionAmount: OptionalCents;
  total: number;
  transactionType: 'sale' | 'refund';
  reportDate: string;
  occurredAt: string;
}

/** One order's contribution to ONE staff member's day. Same no-`orderCode` rule. */
export interface StaffDailyIncomeOrderRow {
  id: string;
  orderId: string;
  staffId: string | null;
  reportDate: string;
  saleAmount: number;
  refundAmount: number;
  supplyFee: number;
  tipAmount: number;
  serviceNames: string | null;
  transactionType: 'sale' | 'refund';
  occurredAt: string;
}

/**
 * The figures the Daily Sale Report screen is expected to display.
 *
 * Derived from a raw row by {@link ReportService.computeTotals} so a spec can
 * assert the SCREEN against the SCHEMA rather than against itself.
 */
export interface DailyIncomeTotals {
  incomeSale: number;
  incomeTip: number;
  incomeTaxCollected: number;
  /** Income Detail: Sale + Tip + Tax Collected. */
  incomeTotalPayment: number;

  paymentCard: number;
  paymentCash: number;
  paymentOthers: number;
  /** Card + Cash + Others — deliberately EXCLUDES gift-card redemption. */
  paymentAmountCollected: number;
  paymentGiftCardRedemption: number;
  /** Payment Detail: Amount Collected + Gift Card Redemption. */
  paymentTotalPayment: number;
}
