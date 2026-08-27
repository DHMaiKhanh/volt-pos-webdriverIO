import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import { IncomeDailyIps, IncomeStaffIds } from '../../constants/testids.incomes.js';
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

/** One staff row as the table renders it. Money is text until a spec parses it. */
export interface StaffIncomeRow {
  staffName: string;
  cells: string[];
  /** Every money amount on the row, left to right, in integer cents. */
  amountsCents: number[];
}

/**
 * Staff Income — `/incomes/income-staff`.
 *
 * ## What the table is, and what it is not
 *
 * A per-staff breakdown of the same day the store report totals. Its columns
 * shift with the merchant's compensation setup — a salon paying salary shows
 * columns a commission-only salon does not — so a page object that named
 * columns by index would be wrong on the next merchant. Rows are therefore read
 * as text plus a parsed list of amounts, and the SPEC decides which amount it
 * cares about, usually by cross-checking against
 * `ReportService.staffRange()` rather than by counting columns.
 *
 * ## The rollup trap
 *
 * Per-staff figures do not all sum to the store's Staff Payout. Only `tip`,
 * `cleanUpFee`, `staffSalary` and `subtotal` do. `staffCommission`, `pay1`,
 * `pay2`, `supplyFee` and `totalIncome` are post-split at the store level, so
 * adding the per-staff column and expecting the store total is a wrong
 * assertion that reads like a backend bug.
 */
export class IncomeStaffPage extends BasePage {
  readonly name = 'Staff Income';
  readonly route = Routes.INCOME_STAFF;

  protected readonly readyAnchor: Locator = IncomeStaffIds.heading;

  async open(date: Date = new Date()): Promise<this> {
    return this.openRange(date, date);
  }

  async openRange(from: Date, to: Date): Promise<this> {
    await logStep(`Open ${this.name} for ${from.toDateString()} → ${to.toDateString()}`);

    await goTo(this.route, {
      search: { from: unixSeconds(startOfDay(from)), to: unixSeconds(endOfDay(to)) },
    });

    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    await this.waitForDataSettled();
    return this;
  }

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

  /**
   * Every staff row, in display order.
   *
   * The first cell is taken as the staff name — true on this table and on the
   * payroll one, and cheap to correct in one place if it stops being.
   */
  async rows(): Promise<StaffIncomeRow[]> {
    const elements = await this.findAll(IncomeStaffIds.staffRows, { timeout: Timeouts.SHORT });
    const rows: StaffIncomeRow[] = [];

    for (const element of elements) {
      const cellElements = await element.$$('td, [role="cell"]').getElements();
      const cells: string[] = [];
      for (const cell of cellElements) cells.push((await cell.getText()).trim());

      rows.push({
        staffName: cells[0] ?? '',
        cells,
        // Anything that does not parse as money is skipped rather than thrown
        // on: a row legitimately mixes counts, percentages and amounts, and a
        // caller wanting the count reads `cells` instead.
        amountsCents: cells.flatMap((cell) => {
          try {
            return [parseMoney(cell)];
          } catch {
            return [];
          }
        }),
      });
    }

    return rows;
  }

  /** One staff member's row, matched on the name cell. */
  async row(staffName: string): Promise<StaffIncomeRow> {
    const all = await this.rows();
    const found = all.find((row) => row.staffName.includes(staffName));
    if (found) return found;

    throw new Error(
      `${this.name}: no row for "${staffName}". The table holds: ` +
        `${all.map((r) => r.staffName).join(', ') || '(no rows)'}. ` +
        'A staff member with no activity on the selected day does not appear at all.',
    );
  }

  /** Filter the table by staff name, where the screen offers a search box. */
  async search(staffName: string): Promise<this> {
    await this.setValue(IncomeStaffIds.searchStaff, staffName);
    await this.waitForDataSettled(Timeouts.SHORT);
    return this;
  }
}

export default new IncomeStaffPage();
