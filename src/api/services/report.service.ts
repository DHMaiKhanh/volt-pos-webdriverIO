import { gql, type GraphQLClient } from '../GraphQLClient.js';
import {
  cents,
  type DailyIncomeTotals,
  type StaffDailyIncomeOrderRow,
  type StaffDailyIncomeRow,
  type StoreDailyIncomeOrderRow,
  type StoreDailyIncomeRow,
  type StoreIncomeSummaryRow,
} from '../models/report.js';

/* ------------------------------------------------------------------------- *
 * Date handling
 * ------------------------------------------------------------------------- */

/**
 * A day as the `date` / `reportDate` filters want it: bare `yyyy-MM-dd`.
 *
 * ## Two things the Playwright original got wrong here
 *
 * 1. **It sent a full RFC3339 timestamp.** `startOfDayIso()` produced
 *    `2026-08-26T00:00:00.000Z` and the comment claimed the backend rejects a
 *    bare date. The app does the opposite — `formatDateRangeToISO`
 *    (`volt-pos/src/lib/utils.ts:567`) formats with `DATE_FORMATS.ISO_DATE`,
 *    which is literally `"yyyy-MM-dd"`. A timestamp compares as a longer string
 *    against a `yyyy-MM-dd` column and silently matches nothing.
 * 2. **It hardcoded `Asia/Ho_Chi_Minh`.** These merchants are US salons, and
 *    the app resolves the day with date-fns `startOfDay`/`endOfDay`, i.e. the
 *    machine's own timezone. Forcing a fixed zone shifts the boundary by half a
 *    day and quietly reads the wrong day's report.
 *
 * Formatting from the local parts, rather than `toISOString().slice(0, 10)`,
 * is what keeps the second point true: `toISOString` converts to UTC first, so
 * an evening run in a negative-offset zone reports tomorrow.
 */
export function ymd(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* ------------------------------------------------------------------------- *
 * Queries
 * ------------------------------------------------------------------------- */

/**
 * The Daily Sale Report's own query.
 *
 * `vReportStoreDailyIncomeList` — the `v` is a database VIEW that already
 * unions today's live rows with the settled snapshots, which is why there is no
 * live/settled branch anywhere in this service. This mirrors
 * `volt-pos/src/routes/_app/incomes/income-daily/-shared/income-daily.gql.ts`
 * field for field, deliberately: an oracle that reads a DIFFERENT query than
 * the screen renders from can disagree with the screen while both are correct.
 */
const STORE_DAILY_INCOME = `
  query storeDailyIncome($from: String, $to: String) {
    vReportStoreDailyIncomeList(
      where: { date: { gte: $from, lte: $to } }
      orderBy: [{ date: desc }]
    ) {
      id
      date
      numberOrder
      dailySaleSale
      dailySaleTip
      dailySalePaymentCash
      dailySalePaymentCard
      dailySalePaymentOthers
      dailySalePaymentGiftCardRedemption
      dailySalePaymentAmountCollected
      dailySaleTotalPayment
      incomeTaxAmount
      incomeTotalPayment
      paymentTaxCard
      paymentTaxCash
      paymentTaxOthers
      paymentTaxGiftCardRedemption
      saleIncomeTaxAmount
      saleIncomeTotalPayment
    }
  }
`;

const STORE_DAILY_INCOME_ORDERS = `
  query storeDailyIncomeOrders($from: String, $to: String) {
    vReportStoreDailyIncomeOrderList(
      where: { reportDate: { gte: $from, lte: $to } }
      orderBy: [{ reportDate: desc }]
    ) {
      id
      orderId
      saleAmount
      refundAmount
      tipAmount
      taxAmount
      giftCardSaleRedemptionAmount
      total
      transactionType
      reportDate
      occurredAt
    }
  }
`;

/** The Income Summary half of the same view — the wide money columns. */
const STORE_INCOME_SUMMARY = `
  query storeIncomeSummary($from: String, $to: String) {
    vReportStoreDailyIncomeList(
      where: { date: { gte: $from, lte: $to } }
      orderBy: [{ date: desc }]
    ) {
      id
      date
      incomeServiceSale
      incomeServiceRefund
      incomeProductSale
      incomeProductRefund
      incomeServiceFeeSale
      incomeServiceFeeRefund
      incomeGiftCardSale
      incomeSubtotal
      incomeDiscount
      incomeDiscountReversed
      incomeCashDiscountSale
      incomeCashDiscountRefund
      incomeTotalDiscount
      incomeTotalSale
      incomeTotalRefund
      incomeNet
      incomeNetTotal
      incomeTip
      incomeTaxAmount
      incomeSummaryPaymentCardSale
      incomeSummaryPaymentCardRefund
      incomeSummaryPaymentCardTip
      incomeSummaryPaymentTotalCard
      incomeSummaryPaymentCashSale
      incomeSummaryPaymentCashRefund
      incomeSummaryPaymentCashTip
      incomeSummaryPaymentTotalCash
      incomeSummaryPaymentOthersSale
      incomeSummaryPaymentOthersRefund
      incomeSummaryPaymentOthersTip
      incomeSummaryPaymentTotalOthers
      incomeSummaryPaymentGiftCardSale
      incomeSummaryPaymentGiftCardTip
      incomeSummaryPaymentGiftCardRedemption
      incomeSummaryPaymentAmountCollected
      incomeSummaryTotalPayment
      staffPayoutTotalService
      staffPayoutCommission
      staffPayoutSupplyShare
      staffPayoutCleanUpFee
      staffPayoutSalary
      staffPayoutTip
      staffPayoutCardFeeCharge
      staffPayoutCardFeeChargeTipSale
      staffPayoutCardFeeChargeTipRefund
      staffPayoutDiscountCharge
      staffPayoutDiscountChargeReversed
      staffPayoutPay1
      staffPayoutPay2
      staffPayoutTotal
      salonEarningsTotalService
      salonEarningsCommission
      salonEarningsProductSale
      salonEarningsProductRefund
      salonEarningsSupplyShare
      salonEarningsStaffSupplyShare
      salonEarningsCleanUpFee
      salonEarningsStaffSalary
      salonEarningsDiscount
      salonEarningsDiscountReversed
      salonEarningsTotalDiscount
      salonEarningsTaxAmount
      salonEarningsNet
      salonEarningsTotal
      supplyFeeTotal
      supplyFeeStaffShare
      supplyFeeSalonShare
    }
  }
`;

const STAFF_DAILY_INCOME = `
  query staffDailyIncome($from: String, $to: String) {
    vReportStaffDailyIncomeList(
      where: { date: { gte: $from, lte: $to } }
      orderBy: [{ date: desc }]
    ) {
      id
      staffId
      staffName
      date
      numberOfOrders
      sale
      refund
      subtotal
      supplyFee
      staffCommission
      cleanUpFee
      staffSalary
      totalIncome
      tip
      cashTip
      creditCardTip
      giftCardTip
      otherTip
      cardFeeCharge
      cardFeeChargeTipSale
      cardFeeChargeTipRefund
      discountCharge
      discountChargeReversed
      pay1
      pay2
      rate
      compensation
      totalHour
      workDays
    }
  }
`;

const STAFF_DAILY_INCOME_ORDERS = `
  query staffDailyIncomeOrders($from: String, $to: String) {
    vReportStaffDailyIncomeOrderList(
      where: { reportDate: { gte: $from, lte: $to } }
      orderBy: [{ reportDate: desc }]
    ) {
      id
      orderId
      staffId
      reportDate
      saleAmount
      refundAmount
      supplyFee
      tipAmount
      serviceNames
      transactionType
      occurredAt
    }
  }
`;

/* ------------------------------------------------------------------------- *
 * Service
 * ------------------------------------------------------------------------- */

interface StoreListResponse {
  vReportStoreDailyIncomeList: StoreDailyIncomeRow[];
}
interface StoreSummaryResponse {
  vReportStoreDailyIncomeList: StoreIncomeSummaryRow[];
}
interface StoreOrdersResponse {
  vReportStoreDailyIncomeOrderList: StoreDailyIncomeOrderRow[];
}
interface StaffListResponse {
  vReportStaffDailyIncomeList: StaffDailyIncomeRow[];
}
interface StaffOrdersResponse {
  vReportStaffDailyIncomeOrderList: StaffDailyIncomeOrderRow[];
}

/**
 * The income reports, read straight from the schema the screens render from.
 *
 * Every method takes a DAY, or a from/to pair, and returns rows exactly as the
 * app would receive them — no coalescing, no summing. Deriving expected figures
 * is {@link ReportService.computeTotals}' job and asserting them is the spec's;
 * keeping the three separate is what lets a failure say whether the backend, the
 * formula or the screen is wrong.
 */
export class ReportService {
  constructor(private readonly client: GraphQLClient = gql()) {}

  /** The store's row for one day, or `null` when the day has no report at all. */
  async storeDay(date: Date = new Date()): Promise<StoreDailyIncomeRow | null> {
    const rows = await this.storeRange(date, date);
    return rows[0] ?? null;
  }

  /** The store's rows across a date range, newest first. */
  async storeRange(from: Date, to: Date): Promise<StoreDailyIncomeRow[]> {
    const data = await this.client.query<StoreListResponse>(STORE_DAILY_INCOME, {
      operationName: 'storeDailyIncome',
      variables: { from: ymd(from), to: ymd(to) },
    });
    return data.vReportStoreDailyIncomeList;
  }

  /** The Income Summary columns for one day. */
  async incomeSummaryDay(date: Date = new Date()): Promise<StoreIncomeSummaryRow | null> {
    const rows = await this.incomeSummaryRange(date, date);
    return rows[0] ?? null;
  }

  /** The Income Summary columns across a range — one row per day, newest first. */
  async incomeSummaryRange(from: Date, to: Date): Promise<StoreIncomeSummaryRow[]> {
    const data = await this.client.query<StoreSummaryResponse>(STORE_INCOME_SUMMARY, {
      operationName: 'storeIncomeSummary',
      variables: { from: ymd(from), to: ymd(to) },
    });
    return data.vReportStoreDailyIncomeList;
  }

  /** Per-order lines behind the store's day. */
  async storeOrders(from: Date, to: Date = from): Promise<StoreDailyIncomeOrderRow[]> {
    const data = await this.client.query<StoreOrdersResponse>(STORE_DAILY_INCOME_ORDERS, {
      operationName: 'storeDailyIncomeOrders',
      variables: { from: ymd(from), to: ymd(to) },
    });
    return data.vReportStoreDailyIncomeOrderList;
  }

  /** Every staff member's row for a day. */
  async staffDay(date: Date = new Date()): Promise<StaffDailyIncomeRow[]> {
    return this.staffRange(date, date);
  }

  /** Every staff member's rows across a range. */
  async staffRange(from: Date, to: Date): Promise<StaffDailyIncomeRow[]> {
    const data = await this.client.query<StaffListResponse>(STAFF_DAILY_INCOME, {
      operationName: 'staffDailyIncome',
      variables: { from: ymd(from), to: ymd(to) },
    });
    return data.vReportStaffDailyIncomeList;
  }

  /** Per-order lines behind each staff member's day. */
  async staffOrders(from: Date, to: Date = from): Promise<StaffDailyIncomeOrderRow[]> {
    const data = await this.client.query<StaffOrdersResponse>(STAFF_DAILY_INCOME_ORDERS, {
      operationName: 'staffDailyIncomeOrders',
      variables: { from: ymd(from), to: ymd(to) },
    });
    return data.vReportStaffDailyIncomeOrderList;
  }

  /**
   * The figures the Daily Sale Report screen should be showing.
   *
   * These are the app's stated formulas, recomputed from the raw row rather
   * than read from the pre-aggregated `dailySaleTotalPayment` /
   * `incomeTotalPayment` columns — that is the entire point. Asserting the
   * screen against a column the same backend also computed proves only that the
   * screen can read; recomputing catches a rollup that drifted from its parts.
   */
  computeTotals(row: StoreDailyIncomeRow): DailyIncomeTotals {
    const incomeSale = cents(row.dailySaleSale);
    const incomeTip = cents(row.dailySaleTip);
    const incomeTaxCollected = cents(row.incomeTaxAmount);

    const paymentCard = cents(row.dailySalePaymentCard);
    const paymentCash = cents(row.dailySalePaymentCash);
    const paymentOthers = cents(row.dailySalePaymentOthers);
    const paymentGiftCardRedemption = cents(row.dailySalePaymentGiftCardRedemption);
    const paymentAmountCollected = paymentCard + paymentCash + paymentOthers;

    return {
      incomeSale,
      incomeTip,
      incomeTaxCollected,
      incomeTotalPayment: incomeSale + incomeTip + incomeTaxCollected,

      paymentCard,
      paymentCash,
      paymentOthers,
      paymentAmountCollected,
      paymentGiftCardRedemption,
      paymentTotalPayment: paymentAmountCollected + paymentGiftCardRedemption,
    };
  }
}
