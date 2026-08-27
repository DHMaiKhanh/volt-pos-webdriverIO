import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import { IncomeDailyIps, IncomeSummaryIds, summaryRow } from '../../constants/testids.incomes.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { parseMoney } from '../../utils/money.js';
import { passcodeDialog } from '../../components/modal/PasscodeDialog.js';
import { BasePage } from '../BasePage.js';

const unixSeconds = (date: Date): number => Math.floor(date.getTime() / 1_000);

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/** How the report groups its rows. Mirrors `GROUP_BY_OPTIONS` on the route. */
export type GroupBy = 'day' | 'week' | 'month' | 'year';

/**
 * The label pairs this screen's money rows are addressed by.
 *
 * Kept as a table rather than one locator per row because the screen has ~60 of
 * them across four panels and they all share one shape: a flex row holding a
 * translated label span and a `money()` span. A spec names the row it wants;
 * {@link IncomeSummaryPage.rowCents} builds the locator.
 *
 * Vietnamese halves are the app's own values. Where a row has no i18n key the
 * English string is repeated — see `src/constants/labels.ts` for why that is
 * recorded rather than hidden.
 */
export const SummaryRows = {
  // Sale Details
  serviceSale: ['Service Sale', 'Doanh thu dịch vụ'],
  productSale: ['Product Sale', 'Doanh thu sản phẩm'],
  giftCardSale: ['Gift Card Sale', 'Bán thẻ quà tặng'],
  subtotal: ['Subtotal', 'Tạm tính'],
  totalDiscount: ['Total Discount', 'Tổng giảm giá'],
  netTotal: ['Net Total', 'Tổng thực thu'],
  tax: ['Tax', 'Thuế'],
  tip: ['Tip', 'Tiền boa'],

  // Payment Details
  card: ['Card', 'Thẻ'],
  cash: ['Cash', 'Tiền mặt'],
  others: ['Others', 'Khác'],
  giftCardRedemption: ['Gift Card Redemption', 'Sử dụng thẻ quà tặng'],
  amountCollected: ['Amount Collected', 'Số tiền đã thu'],
  totalPayment: ['Total Payment', 'Tổng thanh toán'],

  // Staff Payout
  totalService: ['Total Service', 'Tổng dịch vụ'],
  commission: ['Commission', 'Hoa hồng'],
  supplyFee: ['Supply Fee', 'Phí vật tư'],
  cleanUpFee: ['Clean Up Fee', 'Phí dọn dẹp'],
  salary: ['Salary', 'Lương'],
  cardFeeCharge: ['Card Fee Charge', 'Phí thẻ'],

  // Salon Earnings
  salonNet: ['Net', 'Thực thu'],
  totalIncome: ['Total Income', 'Tổng thu nhập'],
} as const satisfies Record<string, readonly [string, string]>;

export type SummaryRowKey = keyof typeof SummaryRows;

/**
 * Income Summary — `/incomes/income-summary`.
 *
 * ## What makes this screen worth automating carefully
 *
 * It is where the app's money arithmetic is visible: four panels of derived
 * figures — Sale Details, Payment Details, Staff Payout, Salon Earnings — that
 * are supposed to reconcile with each other and with the per-staff report.
 * Almost every real defect here is a formula that drifted, not a control that
 * broke, so the assertions worth writing compare NUMBERS across sources rather
 * than checking that a panel rendered.
 *
 * Two sources are available and both matter:
 *
 * - `ReportService.incomeSummaryRange()` returns the same
 *   `vReportStoreDailyIncomeList` row the screen renders from, so a mismatch
 *   between it and the screen is a rendering bug.
 * - `ReportService.staffRange()` returns the per-staff rows. Only `tip`,
 *   `cleanUpFee`, `staffSalary` and `subtotal` sum cleanly to their Staff Payout
 *   counterparts; `staffCommission`, `pay1`, `pay2`, `supplyFee` and
 *   `totalIncome` do NOT, because the store rollup applies the staff/salon split
 *   first. Summing those anyway is the most common wrong assertion on this
 *   screen and it fails in a way that looks like a backend bug.
 */
export class IncomeSummaryPage extends BasePage {
  readonly name = 'Income Summary';
  readonly route = Routes.INCOME_SUMMARY;

  protected readonly readyAnchor: Locator = IncomeSummaryIds.heading;

  async open(date: Date = new Date(), groupBy: GroupBy = 'day'): Promise<this> {
    return this.openRange(date, date, groupBy);
  }

  async openRange(from: Date, to: Date, groupBy: GroupBy = 'day'): Promise<this> {
    await logStep(`Open ${this.name} for ${from.toDateString()} → ${to.toDateString()}`);

    await goTo(this.route, {
      search: {
        from: unixSeconds(startOfDay(from)),
        to: unixSeconds(endOfDay(to)),
        groupBy,
      },
    });

    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    await this.waitForDataSettled();
    return this;
  }

  /** Wait for the loading placeholders to clear — see `IncomeDailyPage.waitForDataSettled`. */
  async waitForDataSettled(timeout: number = Timeouts.MEDIUM): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!(await this.exists(IncomeDailyIps.skeleton, 300))) return;
      // `exists` returns as soon as the FIRST candidate matches, so a skeleton
      // that is present makes it cheap — without this the loop would spin flat
      // out for the whole timeout hammering the driver.
      await settle(200);
    }
    this.log.warn(`${this.name}: skeletons still visible after ${String(timeout)}ms.`);
  }

  /* --------------------------------------------------------------------- *
   * Reading figures
   * --------------------------------------------------------------------- */

  /**
   * One money row, in integer cents.
   *
   * Throws with the row's raw text when it does not parse, because the two
   * likely causes need different fixes: a row read mid-load is a timing problem,
   * and a row whose label matched the wrong panel is a locator problem.
   */
  async rowCents(row: SummaryRowKey): Promise<number> {
    const [en, vi] = SummaryRows[row];
    const text = await this.text(summaryRow(en, vi), { visible: true });
    try {
      return parseMoney(text);
    } catch (error) {
      throw new Error(
        `${this.name}: the "${en}" row read ${JSON.stringify(text)}, which is not one money ` +
          'amount. If the text looks like a label glued to a number, the row matched a container ' +
          "rather than the amount span — rowAmount() returns span[last()] and expects the app's " +
          'label/amount pair.',
        { cause: error },
      );
    }
  }

  /** Several rows at once, so a reconciliation assertion reads as one statement. */
  async rowsCents<K extends SummaryRowKey>(...rows: K[]): Promise<Record<K, number>> {
    const out = {} as Record<K, number>;
    for (const row of rows) out[row] = await this.rowCents(row);
    return out;
  }

  /** Is a panel on screen? Some render only when the merchant has that feature on. */
  async hasPanel(
    panel: 'saleDetails' | 'paymentDetails' | 'staffPayout' | 'salonEarnings',
  ): Promise<boolean> {
    return this.isVisible(IncomeSummaryIds[panel], Timeouts.SHORT);
  }

  /** The detail table's row count, for group-by assertions. */
  async detailRowCount(): Promise<number> {
    return (await this.findAll(IncomeSummaryIds.detailRows, { timeout: Timeouts.SHORT })).length;
  }
}

export default new IncomeSummaryPage();
