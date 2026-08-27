import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import { PayrollIds } from '../../constants/testids.payroll.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { cell, isBlankCell, readTable } from '../../helpers/table.js';
import { settle } from '../../helpers/wait.js';
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

/** One staff member's clock-in for the selected day. */
export interface TimeTrackingRow {
  staff: string;
  /** Raw "Date IN" text, e.g. `06/26/2026 09:43 AM`. `null` when not clocked in. */
  dateIn: string | null;
  /** Raw "Date OUT" text. `null` while the shift is still open. */
  dateOut: string | null;
  /** Raw "Total Hours" text, exactly as rendered. */
  totalHoursText: string;
  /** {@link totalHoursText} in minutes. `0` when the shift is open or unparseable. */
  workedMinutes: number;
  checkedIn: boolean;
}

/**
 * Read a "Total Hours" cell as minutes.
 *
 * The app has rendered this several ways across builds — `8h 30m`, `8h`, `30m`,
 * `8:30`, a bare `8.5` — and a spec should not care which. An unrecognised
 * string returns `0` rather than throwing: the column legitimately holds an em
 * dash for an open shift, and a throw there would fail every run that happens
 * to catch someone mid-shift.
 *
 * Exported because the payroll screen renders the same shapes.
 */
export function parseHoursToMinutes(text: string): number {
  const trimmed = text.trim();
  if (isBlankCell(trimmed)) return 0;

  const hoursAndMinutes = /(\d+(?:\.\d+)?)\s*h(?:ours?)?(?:\s*(\d+)\s*m)?/i.exec(trimmed);
  if (hoursAndMinutes?.[1] !== undefined) {
    const hours = Number.parseFloat(hoursAndMinutes[1]);
    const minutes = hoursAndMinutes[2] === undefined ? 0 : Number.parseInt(hoursAndMinutes[2], 10);
    return Math.round(hours * 60 + minutes);
  }

  const minutesOnly = /^(\d+)\s*m(?:in)?/i.exec(trimmed);
  if (minutesOnly?.[1] !== undefined) return Number.parseInt(minutesOnly[1], 10);

  const clock = /^(\d+):(\d{1,2})$/.exec(trimmed);
  if (clock?.[1] !== undefined && clock[2] !== undefined) {
    return Number.parseInt(clock[1], 10) * 60 + Number.parseInt(clock[2], 10);
  }

  const decimal = /^(\d+(?:\.\d+)?)$/.exec(trimmed);
  if (decimal?.[1] !== undefined) return Math.round(Number.parseFloat(decimal[1]) * 60);

  return 0;
}

/**
 * Time Tracking — `/time-tracking` (passcode-gated).
 *
 * ## Why a spec cares
 *
 * This table is an INPUT to the money the income reports show. A staff member
 * on `wage_per_day` or `wage_per_hour` earns from their clock-ins, so a payroll
 * figure that looks wrong is often a clock-in that is wrong — and checking the
 * report without checking this table cannot tell the two apart.
 *
 * ## Columns are read by header
 *
 * The column set varies with merchant configuration, and the headers are
 * translated (`Date IN` / `Giờ vào`). Both spellings are named at every lookup;
 * see `src/helpers/table.ts` for why indexes are not used.
 */
export class TimeTrackingPage extends BasePage {
  readonly name = 'Time Tracking';
  readonly route = Routes.TIME_TRACKING;

  protected readonly readyAnchor: Locator = PayrollIds.timeTrackingHeading;

  /** Navigate, unlock the gate, and wait for the table. */
  async open(date?: Date): Promise<this> {
    await logStep(`Open ${this.name}${date ? ` for ${date.toDateString()}` : ''}`);

    await goTo(
      this.route,
      date
        ? {
            search: {
              from: unixSeconds(startOfDay(date)),
              to: unixSeconds(endOfDay(date)),
            },
          }
        : {},
    );

    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    await this.find(PayrollIds.table, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  /**
   * Every clock-in for the selected day.
   *
   * Rows with no staff name are dropped — the table renders a trailing
   * placeholder row on some builds, and it would otherwise arrive as a staff
   * member called `''` whose `checkedIn` is false.
   */
  async readCheckIns(): Promise<TimeTrackingRow[]> {
    await this.find(PayrollIds.table, { visible: true, timeout: Timeouts.MEDIUM });
    const table = await readTable('table');

    return table.rows
      .map((row) => {
        const staff = cell(table, row, 'Staff', 'Nhân viên') ?? '';
        const dateIn = cell(table, row, 'Date IN', 'Giờ vào');
        const dateOut = cell(table, row, 'Date OUT', 'Giờ ra');
        const totalHoursText = cell(table, row, 'Total Hours', 'Tổng giờ') ?? '';

        return {
          staff,
          dateIn: isBlankCell(dateIn) ? null : dateIn,
          dateOut: isBlankCell(dateOut) ? null : dateOut,
          totalHoursText,
          workedMinutes: parseHoursToMinutes(totalHoursText),
          checkedIn: !isBlankCell(dateIn),
        };
      })
      .filter((row) => row.staff !== '');
  }

  /** One staff member's clock-in, or `null` when they have none for the day. */
  async rowFor(staffName: string): Promise<TimeTrackingRow | null> {
    return (await this.readCheckIns()).find((row) => row.staff.includes(staffName)) ?? null;
  }

  /** Who is clocked in for the selected day. */
  async checkedInStaff(): Promise<string[]> {
    return (await this.readCheckIns()).filter((row) => row.checkedIn).map((row) => row.staff);
  }

  /** Filter the table. Debounced, so the wait is load-bearing. */
  async search(staffName: string): Promise<this> {
    await this.setValue(PayrollIds.searchStaff, staffName);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }
}

export default new TimeTrackingPage();
