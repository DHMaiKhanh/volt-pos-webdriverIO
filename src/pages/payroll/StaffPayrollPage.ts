import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import { PayrollIds } from '../../constants/testids.payroll.js';
import { goTo } from '../../helpers/navigate.js';
import { locator, type Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { cell, isBlankCell, readTable } from '../../helpers/table.js';
import { settle } from '../../helpers/wait.js';
import { passcodeDialog } from '../../components/modal/PasscodeDialog.js';
import { BasePage } from '../BasePage.js';

/**
 * The aggregate bar above the listing.
 *
 * Each entry is the label in both bundles. `Total staff` is the only one with a
 * confirmed key (`global.totalStaff`); the other five are composed at render
 * time from a `Total` prefix plus a translated noun, so their Vietnamese halves
 * are transcribed from the rendered screen rather than from one key.
 */
const STATS = {
  totalStaff: ['Total staff', 'Tổng nhân viên'],
  totalOrders: ['Total orders', 'Tổng đơn'],
  totalSubtotal: ['Total subtotal', 'Tổng tạm tính'],
  totalSupplyFee: ['Total supply fee', 'Tổng phí vật tư'],
  totalTip: ['Total tip', 'Tổng tiền boa'],
  totalStaffIncome: ['Total staff income', 'Tổng thu nhập nhân viên'],
} as const satisfies Record<string, readonly [string, string]>;

export type PayrollStat = keyof typeof STATS;

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
 * - `salary`: Working Hours + Salary Amount are the base.
 * - `commission`: a per-date Sale / Refund / Supply Fee / Tip breakdown, with
 *   Staff Commission as the base.
 *
 * Detected from which labels the panel renders, not from a class — the panels
 * share styling and differ only in content.
 */
export type PayType = 'salary' | 'commission' | 'unknown';

/** A label/value pair in the detail panel, addressed by the label. */
const detailValue = (en: string, vi: string): Locator =>
  locator(
    `${en} value`,
    `staff-payroll-detail-${en.toLowerCase().replace(/\s+/g, '-')}`,
    `//*[normalize-space()="${en}" or normalize-space()="${vi}"]/following-sibling::*[1]`,
    `//*[normalize-space()="${en}" or normalize-space()="${vi}"]/../following-sibling::*[1]`,
  );

const statValue = (stat: PayrollStat): Locator => {
  const [en, vi] = STATS[stat];
  return locator(
    `${en} value`,
    `staff-payroll-stat-${stat}`,
    `//*[normalize-space()="${en}" or normalize-space()="${vi}"]/following-sibling::*[1]`,
  );
};

const unixSeconds = (date: Date): number => Math.floor(date.getTime() / 1_000);

/**
 * Staff Payroll — `/incomes/staff-payroll` (passcode-gated).
 *
 * A search + pay-period filter, a six-metric aggregate bar and a staff listing
 * on the left; a per-staff payroll detail panel on the right.
 *
 * ## Changing the period does not settle immediately
 *
 * This is the trap the Playwright suite documented, and it is worth keeping.
 * Selecting a pay period refetches, and the table passes through TWO
 * intermediate states — the old rows, then an empty body — before the new rows
 * land. Reading after a fixed pause catches whichever happens to be up, and the
 * spec then asserts against the PREVIOUS period's numbers, which look entirely
 * plausible.
 *
 * {@link waitForTableSettled} therefore requires the table to have changed AND
 * then to be byte-identical across three consecutive reads while holding at
 * least one row. The row-count condition matters: this screen's roster is never
 * legitimately empty, so an empty body is always a transient state, and without
 * that check "empty three times running" reads as settled.
 */
export class StaffPayrollPage extends BasePage {
  readonly name = 'Staff Payroll';
  readonly route = Routes.STAFF_PAYROLL;

  protected readonly readyAnchor: Locator = PayrollIds.staffPayrollHeading;

  async open(from?: Date, to?: Date): Promise<this> {
    await logStep(`Open ${this.name}`);

    await goTo(this.route, from && to ? { search: { from: unixSeconds(from), to: unixSeconds(to) } } : {});

    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    await this.find(PayrollIds.table, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Aggregate bar
   * --------------------------------------------------------------------- */

  /** One aggregate figure, as rendered. */
  async statText(stat: PayrollStat): Promise<string> {
    return this.text(statValue(stat), { visible: true });
  }

  /** The whole aggregate bar. */
  async allStats(): Promise<Record<PayrollStat, string>> {
    const out = {} as Record<PayrollStat, string>;
    for (const stat of Object.keys(STATS) as PayrollStat[]) {
      out[stat] = await this.statText(stat).catch(() => '');
    }
    return out;
  }

  /* --------------------------------------------------------------------- *
   * The listing
   * --------------------------------------------------------------------- */

  async rows(): Promise<PayrollRow[]> {
    const table = await readTable('table');

    return table.rows
      .map((row) => ({
        staff: cell(table, row, 'Staff', 'Nhân viên') ?? row.cells[0] ?? '',
        orders: cell(table, row, 'Orders', 'Đơn hàng') ?? '',
        subtotal: cell(table, row, 'Subtotal', 'Tạm tính') ?? '',
        supplyFee: cell(table, row, 'Supply Fee', 'Phí vật tư') ?? '',
        tip: cell(table, row, 'Tip', 'Tiền boa') ?? '',
        totalIncome: cell(table, row, 'Total Income', 'Tổng thu nhập', 'Thu nhập thực nhận') ?? '',
        cells: row.cells,
      }))
      .filter((row) => row.staff !== '');
  }

  async rowCount(): Promise<number> {
    return (await this.rows()).length;
  }

  /**
   * A stable fingerprint of the table body.
   *
   * Joined cell text rather than an element count: two periods can hold the same
   * number of staff, so a count alone would report "settled" the moment the
   * roster size matched, before the figures updated.
   */
  private async tableSnapshot(): Promise<string> {
    const table = await readTable('table');
    return table.rows.map((row) => row.cells.join('|')).join('\n');
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

  /** Filter the listing. Debounced. */
  async search(staffName: string): Promise<this> {
    const before = await this.tableSnapshot();
    await this.setValue(PayrollIds.searchStaff, staffName);
    await settle(Timeouts.DEBOUNCE);
    await this.waitForTableSettled(before, Timeouts.SHORT);
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Detail panel
   * --------------------------------------------------------------------- */

  /** Open one staff member's payroll detail. */
  async openStaffDetail(staffName: string): Promise<this> {
    await logStep(`${this.name}: open ${staffName}`);
    const rows = await this.findAll(locator('payroll rows', 'staff-payroll-row-', 'tbody tr'), {
      timeout: Timeouts.SHORT,
    });

    for (const row of rows) {
      if ((await row.getText()).includes(staffName)) {
        await row.click();
        await settle();
        return this;
      }
    }

    throw new Error(
      `${this.name}: no row for "${staffName}". The listing holds: ` +
        `${(await this.rows()).map((r) => r.staff).join(', ') || '(no rows)'}.`,
    );
  }

  /**
   * Which pay model the open detail panel describes.
   *
   * Detected by which base label is present. `unknown` when neither is — most
   * often because no staff member is selected and the panel is showing
   * "No detail to show".
   */
  async payType(): Promise<PayType> {
    if (await this.isVisible(detailValue('Salary Amount', 'Mức lương'), Timeouts.ANIMATION)) {
      return 'salary';
    }
    if (await this.isVisible(detailValue('Staff Commission', 'Hoa hồng nhân viên'), Timeouts.ANIMATION)) {
      return 'commission';
    }
    return 'unknown';
  }

  /** Is the panel showing its empty state? */
  hasNoDetail(): Promise<boolean> {
    return this.isVisible(
      locator(
        'no detail to show',
        'staff-payroll-no-detail',
        `//*[normalize-space()="No detail to show" or normalize-space()="Không có chi tiết để hiển thị"]`,
      ),
      Timeouts.SHORT,
    );
  }

  /**
   * One labelled figure from the detail panel, as rendered.
   *
   * `''` when the label is not on this panel — which is normal, since the
   * salary and commission layouts render disjoint label sets. A caller wanting
   * to distinguish "absent" from "empty" should check {@link payType} first.
   */
  async detailText(en: string, vi: string): Promise<string> {
    const text = await this.text(detailValue(en, vi), { visible: true }).catch(() => '');
    return isBlankCell(text) ? '' : text;
  }
}

export default new StaffPayrollPage();
