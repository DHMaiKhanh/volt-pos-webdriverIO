import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import {
  IncomeDetailIds,
  INCOME_PANEL_CSS,
  INCOME_STATS,
  StaffPayrollIds,
  incomeListRowAt,
  incomeStatValue,
  type IncomeStat,
} from '../../constants/testids.incomes.js';
import { PayrollIds } from '../../constants/testids.payroll.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { isBlankCell } from '../../helpers/table.js';
import { settle } from '../../helpers/wait.js';
import { parseMoney } from '../../utils/money.js';
import { passcodeDialog } from '../../components/modal/PasscodeDialog.js';
import { BasePage } from '../BasePage.js';
import {
  findField,
  readDetailFields,
  readStaffList,
  type DetailField,
  type StaffListData,
} from '../incomes/staffIncomeTable.js';

/** The six aggregate cards — the same component as Staff Income. */
export type PayrollStat = IncomeStat;

/** One row of the staff listing. Money stays text; the spec parses what it needs. */
export interface PayrollRow {
  staff: string;
  orders: string;
  subtotal: string;
  supplyFee: string;
  tip: string;
  totalIncome: string;
  cells: string[];
}

/**
 * How a staff member is paid — the detail panel has a different shape per model.
 *
 * - `salary`: Working Days / Working Hours / Salary Amount, no per-day table.
 * - `commission`: a per-date breakdown table (when there are days), then
 *   Sale / Refund / Subtotal / Supply Fee / Staff Commission / ... / Discount Charge.
 *
 * Detected from which labels the panel renders (`staff-payroll-detail-*.tsx`).
 */
export type PayType = 'salary' | 'commission' | 'unknown';

/** Label spellings used by the payroll detail (EN + VI, from `locales/*\/common.json`). */
export const PAYROLL_LABELS = {
  workingDays: ['Working Days', 'Số ngày làm'],
  workingHours: ['Working Hours', 'Số giờ làm'],
  salaryAmount: ['Salary Amount', 'Mức lương'],
  sale: ['Sale', 'Doanh số'],
  refund: ['Refund', 'Hoàn tiền'],
  subtotal: ['Subtotal', 'Tạm tính'],
  supplyFee: ['Supply Fee', 'Phí vật tư'],
  staffCommission: ['Staff Commission', 'Hoa hồng nhân viên'],
  cardChargeCommission: ['Card Charge Commission', 'Phí thẻ - Hoa hồng'],
  cleanUpFee: ['Clean Up Fee/Deduction', 'Phí dọn dẹp/Khấu trừ'],
  tip: ['Tip', 'Tiền boa'],
  cardChargeTip: ['Card Charge Tip', 'Tiền boa thanh toán bằng thẻ'],
  discountCharge: ['Discount Charge', 'Phí khuyến mãi'],
  totalIncome: ['Total Income', 'Tổng thu nhập', 'Thu nhập thực nhận'],
  pay1: ['Pay 1'],
  pay2: ['Pay 2'],
} as const satisfies Record<string, readonly string[]>;

/**
 * Staff Payroll — `/incomes/staff-payroll` (passcode-gated).
 *
 * A search + pay-period select, the six-card aggregate bar and a staff listing
 * on the left; a per-staff payroll detail panel on the right. The listing is the
 * Staff Income list component, so it shares {@link readStaffList}.
 *
 * ## Changing the period does not settle immediately
 *
 * Selecting a pay period refetches, and the table passes through TWO
 * intermediate states — the old rows, then an empty body — before the new rows
 * land. {@link waitForTableSettled} therefore requires the table to have
 * changed AND then to be byte-identical across three consecutive reads while
 * holding at least one row. This roster is never legitimately empty (the live
 * build lists every staff member, 337 on merchant 14), so an empty body is
 * always a transient state.
 */
export class StaffPayrollPage extends BasePage {
  readonly name = 'Staff Payroll';
  readonly route = Routes.STAFF_PAYROLL;

  protected readonly readyAnchor: Locator = PayrollIds.staffPayrollHeading;

  async open(from?: Date, to?: Date): Promise<this> {
    await logStep(`Open ${this.name}`);

    const unixSeconds = (date: Date): number => Math.floor(date.getTime() / 1_000);
    await goTo(this.route, from && to ? { search: { from: unixSeconds(from), to: unixSeconds(to) } } : {});

    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    await this.find(StaffPayrollIds.payrollTable, { visible: true, timeout: Timeouts.MEDIUM });
    await this.waitForRows();
    return this;
  }

  /** Navigate WITHOUT answering the passcode guard — for the gate case. */
  async navigateGated(): Promise<void> {
    await logStep(`Navigate to ${this.name} without unlocking`);
    await goTo(this.route);
  }

  /** The guard's title, e.g. "Enter staff code to access Staff Payroll". `''` when not shown. */
  async gateTitle(): Promise<string> {
    return this.text(PayrollIds.gateTitle, { visible: true, timeout: Timeouts.MEDIUM }).catch(() => '');
  }

  isLoaded(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(StaffPayrollIds.heading, timeout);
  }

  /** Poll until the listing holds at least one row (the first fetch lands after the shell). */
  private async waitForRows(timeout: number = Timeouts.MEDIUM): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await this.tableSnapshot()) !== '') return;
      await settle(300);
    }
    this.log.warn(`${this.name}: the listing was still empty after ${String(timeout)}ms.`);
  }

  /* --------------------------------------------------------------------- *
   * Aggregate bar
   * --------------------------------------------------------------------- */

  /** One aggregate figure, as rendered. */
  async statText(stat: PayrollStat): Promise<string> {
    return (await this.text(incomeStatValue(stat), { visible: true })).trim();
  }

  /** The whole aggregate bar; an unreadable card comes back as `''`. */
  async allStats(): Promise<Record<PayrollStat, string>> {
    const out = {} as Record<PayrollStat, string>;
    for (const stat of Object.keys(INCOME_STATS) as PayrollStat[]) {
      out[stat] = await this.statText(stat).catch(() => '');
    }
    return out;
  }

  async statCents(stat: PayrollStat): Promise<number> {
    return parseMoney(await this.statText(stat));
  }

  async statCount(stat: PayrollStat): Promise<number> {
    const text = await this.statText(stat);
    const parsed = Number.parseInt(text.replace(/[^\d-]/g, ''), 10);
    if (!Number.isFinite(parsed))
      throw new Error(`${this.name}: the ${stat} card read "${text}", not a count.`);
    return parsed;
  }

  /* --------------------------------------------------------------------- *
   * The listing
   * --------------------------------------------------------------------- */

  /** Headers + every row, parsed to cents, in one round trip. */
  readList(): Promise<StaffListData> {
    return readStaffList();
  }

  async rows(): Promise<PayrollRow[]> {
    const { rows } = await readStaffList();
    return rows.map((row) => ({
      staff: row.name,
      orders: row.cells[1] ?? '',
      subtotal: row.cells[2] ?? '',
      supplyFee: row.cells[3] ?? '',
      tip: row.cells[4] ?? '',
      totalIncome: row.cells[5] ?? '',
      cells: row.cells,
    }));
  }

  async rowCount(): Promise<number> {
    return (await readStaffList()).rows.length;
  }

  /**
   * A stable fingerprint of the left-panel table body.
   *
   * Joined cell text rather than an element count: two periods can hold the same
   * number of staff, so a count alone would report "settled" the moment the
   * roster size matched, before the figures updated. Scoped to the LEFT panel —
   * a commission staff member's detail mounts a second table on the right.
   */
  private async tableSnapshot(): Promise<string> {
    return browser.execute(function (rootCss: string) {
      const root = document.querySelector(rootCss) ?? document;
      const rows = Array.prototype.slice.call(root.querySelectorAll('table tbody tr')) as HTMLElement[];
      return rows
        .map(function (tr) {
          return (tr.textContent ?? '').replace(/\s+/g, ' ').trim();
        })
        .join('\n');
    }, INCOME_PANEL_CSS.left);
  }

  /**
   * Wait for a refetch to finish. See the class note for why this is not a pause.
   *
   * Returns rather than throwing on timeout: the caller is about to read the
   * table anyway, and a slow-but-correct refetch should not fail a spec that
   * would have passed. The warning is the signal.
   */
  async waitForTableSettled(before: string, timeout: number = Timeouts.MEDIUM): Promise<void> {
    const REQUIRED_STABLE_READS = 3;
    const deadline = Date.now() + timeout;

    let previous: string | null = null;
    let stableStreak = 0;
    let sawChange = false;

    while (Date.now() < deadline) {
      const current = await this.tableSnapshot();
      if (!sawChange && current !== before) sawChange = true;

      const hasRows = current !== '';
      stableStreak = hasRows && current === previous ? stableStreak + 1 : 0;
      if (sawChange && stableStreak >= REQUIRED_STABLE_READS) return;

      previous = current;
      await settle(300);
    }

    this.log.warn(
      `${this.name}: the table never settled within ${String(timeout)}ms ` +
        `(changed: ${String(sawChange)}). Figures read now may belong to the previous period.`,
    );
  }

  /** Filter the listing. Debounced. Pass `''` to clear. */
  async search(staffName: string): Promise<this> {
    const before = await this.tableSnapshot();
    await this.setValue(StaffPayrollIds.searchStaff, staffName);
    await settle(Timeouts.DEBOUNCE);
    await this.waitForTableSettled(before, Timeouts.SHORT);
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Pay period
   * --------------------------------------------------------------------- */

  /** `periodId` from the URL, or `null` before one was chosen (the hook then picks the default). */
  async periodIdFromUrl(): Promise<string | null> {
    return new URL(await browser.getUrl()).searchParams.get('periodId');
  }

  /** The select's current text, e.g. `Current Period (Oct 23, 2026 - Oct 25, 2026)`. */
  async periodText(): Promise<string> {
    return (await this.text(StaffPayrollIds.periodSelect, { visible: true })).trim();
  }

  /** Every option label of the period select (opens and closes it). */
  async periodOptions(): Promise<string[]> {
    await this.click(StaffPayrollIds.periodSelect);
    const options = await this.findAll(StaffPayrollIds.periodOptions, { timeout: Timeouts.SHORT });
    const labels: string[] = [];
    for (const option of options) labels.push(((await option.getText()) || '').trim());
    await browser.keys(['Escape']);
    await settle();
    return labels;
  }

  /**
   * Choose the period at `index` in the dropdown and wait for the refetch.
   *
   * Returns the label that was chosen. The wait is on `periodId` in the URL
   * (what `staff-payroll-period-select.tsx` writes) and then on the table body.
   */
  async selectPeriodAt(index: number): Promise<string> {
    const before = await this.tableSnapshot();
    const periodBefore = await this.periodIdFromUrl();

    await this.click(StaffPayrollIds.periodSelect);
    const options = await this.findAll(StaffPayrollIds.periodOptions, { timeout: Timeouts.SHORT });
    const option = options[index];
    if (!option) {
      await browser.keys(['Escape']);
      throw new Error(
        `${this.name}: the period select has ${String(options.length)} option(s); #${String(index)} asked.`,
      );
    }
    const label = ((await option.getText()) || '').trim();
    await logStep(`${this.name}: choose period "${label}"`);
    await option.click();

    await browser
      .waitUntil(async () => (await this.periodIdFromUrl()) !== periodBefore, {
        timeout: Timeouts.MEDIUM,
        interval: 150,
      })
      .catch(() => this.log.warn(`${this.name}: periodId did not change after choosing "${label}".`));
    await this.waitForTableSettled(before);
    return label;
  }

  /* --------------------------------------------------------------------- *
   * Detail panel
   * --------------------------------------------------------------------- */

  /** Open the detail of the row at `index` (0-based display order). */
  async openStaffDetailAt(index: number): Promise<this> {
    await logStep(`${this.name}: open staff row #${String(index)}`);
    await this.click(incomeListRowAt(index));
    await browser.waitUntil(async () => new URL(await browser.getUrl()).searchParams.has('staffId'), {
      timeout: Timeouts.MEDIUM,
      interval: 150,
      timeoutMsg: `Clicking payroll row #${String(index)} never put staffId in the URL.`,
    });
    await this.find(IncomeDetailIds.staffName, { visible: true, timeout: Timeouts.MEDIUM });
    await this.waitDetailSettled();
    return this;
  }

  /** Open one staff member's payroll detail by name (first match). */
  async openStaffDetail(staffName: string): Promise<this> {
    const { rows } = await readStaffList();
    const row = rows.find((r) => r.name.includes(staffName));
    if (!row) {
      throw new Error(
        `${this.name}: no row for "${staffName}". The listing holds: ` +
          `${
            rows
              .map((r) => r.name)
              .slice(0, 40)
              .join(', ') || '(no rows)'
          }.`,
      );
    }
    return this.openStaffDetailAt(row.index);
  }

  private async waitDetailSettled(timeout: number = Timeouts.MEDIUM): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!(await this.exists(IncomeDetailIds.skeleton, 300))) return;
      await settle(200);
    }
    this.log.warn(`${this.name}: detail skeleton still visible after ${String(timeout)}ms.`);
  }

  /** The panel header: nickname and the `(range)` text without its parentheses. */
  async detailHeader(): Promise<{ name: string; range: string }> {
    const name = (await this.text(IncomeDetailIds.staffName, { visible: true })).trim();
    const rangeRaw = await this.text(IncomeDetailIds.dateRange).catch(() => '');
    return { name, range: rangeRaw.trim().replace(/^\(/, '').replace(/\)$/, '') };
  }

  /** Every label/value row of the open detail panel. */
  detailFields(): Promise<DetailField[]> {
    return readDetailFields();
  }

  /** Is the per-day breakdown table (commission layout) mounted in the panel? */
  hasDailyBreakdown(): Promise<boolean> {
    return this.isVisible(IncomeDetailIds.table, Timeouts.ANIMATION);
  }

  /** A selected staff member with no payroll rows renders "No Data" instead of fields. */
  hasNoData(): Promise<boolean> {
    return this.isVisible(IncomeDetailIds.noData, Timeouts.ANIMATION);
  }

  /** The list's error branch ("Failed to load staff income data!"). */
  hasLoadError(): Promise<boolean> {
    return this.isVisible(IncomeDetailIds.loadError, Timeouts.ANIMATION);
  }

  /** Which pay model the open detail panel describes — by which base label is present. */
  async payType(): Promise<PayType> {
    const fields = await readDetailFields();
    if (findField(fields, ...PAYROLL_LABELS.salaryAmount)) return 'salary';
    if (findField(fields, ...PAYROLL_LABELS.staffCommission)) return 'commission';
    return 'unknown';
  }

  /** Is the panel showing its empty state? */
  hasNoDetail(): Promise<boolean> {
    return this.isVisible(IncomeDetailIds.noDetail, Timeouts.SHORT);
  }

  /**
   * One labelled figure from the detail panel, as rendered.
   *
   * `''` when the label is not on this panel — normal, since the salary and
   * commission layouts render disjoint label sets.
   */
  async detailText(en: string, vi: string): Promise<string> {
    const field = findField(await readDetailFields(), en, vi);
    const text = field?.value ?? '';
    return isBlankCell(text) ? '' : text;
  }

  /** "Thank you, <name>!" — `''` when absent. */
  async thankYouText(): Promise<string> {
    return (await this.text(IncomeDetailIds.thankYou).catch(() => '')).trim();
  }
}

export default new StaffPayrollPage();
