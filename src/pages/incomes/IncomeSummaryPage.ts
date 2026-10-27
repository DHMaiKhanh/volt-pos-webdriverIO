import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import { IncomeSummaryIds, summaryRow } from '../../constants/testids.incomes.js';
import {
  IncomeSummaryExtraIds,
  IncomeSummaryLabels,
  SUMMARY_BLOCKS,
  SUMMARY_LABELS,
  type SummaryBlock,
  type SummaryLabel,
} from '../../constants/testids.income-summary.js';
import { tableRowCell } from '../../constants/testids.reports-v4.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { parseMoney } from '../../utils/money.js';
import { passcodeDialog } from '../../components/modal/PasscodeDialog.js';
import { ReportBasePage } from './ReportBasePage.js';
import { findTable, labelMoneyPairs, moneyCents, visibleLines } from './reportDom.js';

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
export class IncomeSummaryPage extends ReportBasePage {
  readonly name = 'Income Summary';
  readonly route = Routes.INCOME_SUMMARY;

  /**
   * The summary table: it mounts with its header once the passcode guard is
   * satisfied and the range query is wired (the heading paints behind the
   * guard, so it proves nothing).
   */
  protected readonly readyAnchor: Locator = IncomeSummaryExtraIds.table;

  /**
   * Bare route — no search params — so the screen shows its OWN defaults
   * (preset Today, group-by Day). Unlocks the owner passcode gate.
   */
  async openDefault(): Promise<this> {
    await logStep(`Open ${this.name} (defaults)`);
    await goTo(this.route);
    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    await this.waitForDataSettled();
    return this;
  }

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

  /* --------------------------------------------------------------------- *
   * Live-scan 2026-10-25 surface: table, detail panel blocks
   * --------------------------------------------------------------------- */

  async headingText(): Promise<string> {
    return this.text(IncomeSummaryExtraIds.heading, { visible: true });
  }

  /** The summary table's header texts. */
  async tableHeaders(): Promise<string[]> {
    return (await findTable(IncomeSummaryLabels.totalPaymentHead))?.head ?? [];
  }

  /** Every period row as rendered: Date / Sale / Tip / Tax / Total Payment texts. */
  async tableRows(): Promise<SummaryTableRow[]> {
    const table = await findTable(IncomeSummaryLabels.totalPaymentHead);
    return (table?.rows ?? [])
      .filter((cells) => cells.length >= 5)
      .map(([date, sale, tip, tax, totalPayment]) => ({
        date: (date ?? '').replace(/\s+/g, ' '),
        sale: sale ?? '',
        tip: tip ?? '',
        tax: tax ?? '',
        totalPayment: totalPayment ?? '',
      }));
  }

  /** Is the right panel on its "No detail to show" empty state? */
  async isDetailEmpty(): Promise<boolean> {
    return this.isVisible(IncomeSummaryExtraIds.noDetail, Timeouts.SHORT);
  }

  async hasPrintButton(): Promise<boolean> {
    return this.isVisible(IncomeSummaryExtraIds.printButton, Timeouts.SHORT);
  }

  /**
   * Click the N-th (1-based) period row and wait for the detail panel (its
   * Print button) to replace the empty state. Expands Staff Payout's
   * "Show more" so Pay 1 / Pay 2 are readable.
   */
  async openRowDetail(n = 1): Promise<this> {
    await logStep(`${this.name}: open detail of row ${String(n)}`);
    await this.click(tableRowCell(IncomeSummaryLabels.totalPaymentHead, n));
    await this.find(IncomeSummaryExtraIds.printButton, { visible: true, timeout: Timeouts.MEDIUM });
    await this.waitForDataSettled();
    if (await this.isVisible(IncomeSummaryExtraIds.showMore, 1_000)) {
      await this.click(IncomeSummaryExtraIds.showMore);
      await this.waitForDataSettled();
    }
    return this;
  }

  /**
   * The open detail panel, parsed into its blocks.
   *
   * Reads the visible text AFTER the summary table in document order (the panel
   * renders after it), takes the line before "Print" as the period title, then
   * splits on the block headings and pairs each label with the money line that
   * follows it. Labels are mapped back to their English key so a Vietnamese
   * till parses the same.
   */
  async readDetail(): Promise<SummaryDetail> {
    const lines = await visibleLines({ afterTableWithHead: IncomeSummaryLabels.totalPaymentHead });
    const printIndex = lines.findIndex((l) => (IncomeSummaryLabels.print as readonly string[]).includes(l));
    const title = printIndex > 0 ? lines[printIndex - 1]! : '';

    const blocks = Object.fromEntries(
      (Object.keys(SUMMARY_BLOCKS) as SummaryBlock[]).map((b) => [b, [] as DetailEntry[]]),
    ) as Record<SummaryBlock, DetailEntry[]>;

    const headingOf = (line: string): SummaryBlock | null =>
      (Object.keys(SUMMARY_BLOCKS) as SummaryBlock[]).find((b) =>
        (SUMMARY_BLOCKS[b] as readonly string[]).includes(line),
      ) ?? null;

    let current: SummaryBlock | null = null;
    let chunk: string[] = [];
    const flush = (): void => {
      if (current === null) return;
      for (const { label, text } of labelMoneyPairs(chunk)) {
        blocks[current].push({ label: toEnglishLabel(label), text, cents: moneyCents(text) });
      }
    };
    for (const line of lines.slice(Math.max(printIndex + 1, 0))) {
      const heading = headingOf(line);
      if (heading !== null) {
        flush();
        current = heading;
        chunk = [];
      } else {
        chunk.push(line);
      }
    }
    flush();

    const blocksPresent = (Object.keys(blocks) as SummaryBlock[]).filter((b) =>
      lines.some((l) => (SUMMARY_BLOCKS[b] as readonly string[]).includes(l)),
    );
    return { title, blocks, blocksPresent };
  }
}

/** One label/amount pair inside a detail block. `label` is the English key text. */
export interface DetailEntry {
  label: string;
  text: string;
  cents: number;
}

export interface SummaryDetail {
  /** Period title above Print, e.g. `Oct 25, 2026`. */
  title: string;
  blocks: Record<SummaryBlock, DetailEntry[]>;
  /** Block headings actually rendered. */
  blocksPresent: SummaryBlock[];
}

export interface SummaryTableRow {
  date: string;
  sale: string;
  tip: string;
  tax: string;
  totalPayment: string;
}

/** Map a rendered label (EN or VI) back to its English text. */
function toEnglishLabel(rendered: string): string {
  for (const [en, vi] of Object.values(SUMMARY_LABELS)) {
    if (rendered === en || rendered === vi) return en;
  }
  return rendered;
}

/**
 * The `occurrence`-th (0-based) value labelled `label` inside `block`, in cents,
 * or `null` when absent. Occurrence matters: Payment Details lists Sale/Tip/Tax
 * once per tender type.
 */
export function detailCents(
  detail: SummaryDetail,
  block: SummaryBlock,
  label: SummaryLabel,
  occurrence = 0,
): number | null {
  const en = SUMMARY_LABELS[label][0];
  const hits = detail.blocks[block].filter((e) => e.label === en);
  return hits[occurrence]?.cents ?? null;
}

export default new IncomeSummaryPage();
