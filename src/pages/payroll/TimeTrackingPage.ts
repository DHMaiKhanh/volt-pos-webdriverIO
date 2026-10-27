import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import { selectOptionWithText } from '../../constants/testids.incomes.js';
import {
  PayrollIds,
  TimeTrackingIds,
  timeTrackingRowAction,
  timeTrackingRowByNote,
} from '../../constants/testids.payroll.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { isBlankCell } from '../../helpers/table.js';
import { settle } from '../../helpers/wait.js';
import { passcodeDialog } from '../../components/modal/PasscodeDialog.js';
import { BasePage } from '../BasePage.js';

/** A WebDriver property read as a string (`getProperty` is typed `unknown`). */
const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

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

/** One record of the management table, every column as rendered. */
export interface TimeTrackingRecord {
  staff: string;
  dateIn: string;
  dateOut: string;
  totalHours: string;
  createdAt: string;
  updatedAt: string;
  note: string;
  /** Is this row's Delete button disabled (record inside a locked payroll)? */
  deleteDisabled: boolean;
}

/**
 * Read a "Total Hours" cell as minutes.
 *
 * The app has rendered this several ways across builds — `8h 30m`, `8h`, `30m`,
 * `8:30`, a bare `8.5` — and a spec should not care which. An unrecognised
 * string returns `0` rather than throwing: the column legitimately holds an em
 * dash for an open shift.
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

/** Header spellings (EN + VI, `global.staff/dateIn/dateOut/...`). */
const COLS = {
  staff: ['Staff', 'Nhân viên'],
  dateIn: ['Date IN', 'Giờ vào'],
  dateOut: ['Date OUT', 'Giờ ra'],
  totalHours: ['Total Hours', 'Tổng giờ'],
  createdAt: ['Created At', 'Ngày tạo'],
  updatedAt: ['Updated At', 'Ngày cập nhật'],
  note: ['Note', 'Lưu ý', 'Ghi chú'],
} as const;

/**
 * Time Tracking — `/time-tracking` (passcode-gated).
 *
 * ## Why a spec cares
 *
 * This table is an INPUT to the money the income reports show. A staff member
 * on `wage_per_day` or `wage_per_hour` earns from their clock-ins, so a payroll
 * figure that looks wrong is often a clock-in that is wrong.
 *
 * ## Shape (routes/_app/time-tracking, live DOM 1.1.56)
 *
 * `<h3>` title, a preset select + `#selected-date-range`, a "Search staff" box
 * (SERVER-side filter: it is part of the query key), an icon-only "+" that opens
 * "Add New Time Keeping", and a virtualised table that ALWAYS renders (its empty
 * state is a cell). Each row carries icon buttons with hardcoded
 * `aria-label="Edit"` / `"Delete"`; Delete is `disabled` for a record inside a
 * locked payroll (`isReadOnly`) — the build shows no message for that case.
 *
 * ## Reading the Staff cell
 *
 * The cell is a `StaffAvatar` initial followed by the nickname with no
 * whitespace, so `textContent` reads "AAndy". Rows are read with `innerText`
 * and the name is the cell's last line.
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
    await settle();
    return this;
  }

  /** Navigate WITHOUT answering the passcode guard — for the gate case. */
  async navigateGated(): Promise<void> {
    await logStep(`Navigate to ${this.name} without unlocking`);
    await goTo(this.route);
  }

  /** The guard's title, e.g. "Enter staff code to access Time Tracking". `''` when not shown. */
  async gateTitle(): Promise<string> {
    return this.text(PayrollIds.gateTitle, { visible: true, timeout: Timeouts.MEDIUM }).catch(() => '');
  }

  isLoaded(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(TimeTrackingIds.heading, timeout);
  }

  /** Are the filter controls (preset, date, search, add) on screen? */
  async filtersVisible(): Promise<boolean> {
    return (
      (await this.isVisible(TimeTrackingIds.presetSelect, Timeouts.SHORT)) &&
      (await this.isVisible(TimeTrackingIds.dateRange, Timeouts.ANIMATION)) &&
      (await this.isVisible(PayrollIds.searchStaff, Timeouts.ANIMATION)) &&
      (await this.isVisible(TimeTrackingIds.addButton, Timeouts.ANIMATION))
    );
  }

  /* --------------------------------------------------------------------- *
   * The table
   * --------------------------------------------------------------------- */

  /** Header texts, in column order. */
  async headers(): Promise<string[]> {
    return browser.execute(function () {
      const table = document.querySelector('table');
      if (!table) return [] as string[];
      return Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function (th: HTMLElement) {
        return (th.innerText || th.textContent || '').replace(/\s+/g, ' ').trim();
      });
    });
  }

  /** Every record currently rendered (the table is virtualised — fine for a day's worth). */
  async readRecords(): Promise<TimeTrackingRecord[]> {
    const raw = await browser.execute(function () {
      const table = document.querySelector('table');
      if (!table)
        return { headers: [] as string[], rows: [] as { cells: string[]; deleteDisabled: boolean }[] };
      const norm = function (value: string): string {
        return value.replace(/\s+/g, ' ').trim();
      };
      const headers = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function (
        th: HTMLElement,
      ) {
        return norm(th.innerText || th.textContent || '');
      });
      const rows = (Array.prototype.slice.call(table.querySelectorAll('tbody tr')) as HTMLElement[])
        // The empty state is ONE cell spanning the row; a record has a cell per column.
        .filter(function (tr) {
          return tr.querySelectorAll('td').length > 1;
        })
        .map(function (tr) {
          const tds = Array.prototype.slice.call(tr.querySelectorAll('td')) as HTMLElement[];
          const del = tr.querySelector<HTMLButtonElement>('button[aria-label="Delete"]');
          return {
            cells: tds.map(function (td) {
              const lines = (td.innerText || td.textContent || '')
                .split('\n')
                .map(function (l) {
                  return l.trim();
                })
                .filter(function (l) {
                  return l !== '';
                });
              return lines.length > 0 ? lines[lines.length - 1] : '';
            }),
            deleteDisabled: del ? del.disabled : false,
          };
        });
      return { headers: headers, rows: rows };
    });

    const col = (names: readonly string[], fallback: number): number => {
      const i = raw.headers.findIndex((h) => names.includes(h));
      return i >= 0 ? i : fallback;
    };
    const c = {
      staff: col(COLS.staff, 1),
      dateIn: col(COLS.dateIn, 2),
      dateOut: col(COLS.dateOut, 3),
      totalHours: col(COLS.totalHours, 4),
      createdAt: col(COLS.createdAt, 5),
      updatedAt: col(COLS.updatedAt, 6),
      note: col(COLS.note, 7),
    };

    return raw.rows.map((row) => ({
      staff: row.cells[c.staff] ?? '',
      dateIn: row.cells[c.dateIn] ?? '',
      dateOut: row.cells[c.dateOut] ?? '',
      totalHours: row.cells[c.totalHours] ?? '',
      createdAt: row.cells[c.createdAt] ?? '',
      updatedAt: row.cells[c.updatedAt] ?? '',
      note: row.cells[c.note] ?? '',
      deleteDisabled: row.deleteDisabled,
    }));
  }

  /** Every clock-in for the selected range (legacy shape). */
  async readCheckIns(): Promise<TimeTrackingRow[]> {
    await this.find(PayrollIds.table, { visible: true, timeout: Timeouts.MEDIUM });
    return (await this.readRecords())
      .filter((row) => row.staff !== '')
      .map((row) => ({
        staff: row.staff,
        dateIn: isBlankCell(row.dateIn) ? null : row.dateIn,
        dateOut: isBlankCell(row.dateOut) ? null : row.dateOut,
        totalHoursText: row.totalHours,
        workedMinutes: parseHoursToMinutes(row.totalHours),
        checkedIn: !isBlankCell(row.dateIn),
      }));
  }

  /** One staff member's clock-in, or `null` when they have none for the range. */
  async rowFor(staffName: string): Promise<TimeTrackingRow | null> {
    return (await this.readCheckIns()).find((row) => row.staff.includes(staffName)) ?? null;
  }

  /** Who is clocked in for the selected range. */
  async checkedInStaff(): Promise<string[]> {
    return (await this.readCheckIns()).filter((row) => row.checkedIn).map((row) => row.staff);
  }

  /** The record whose note contains `marker`, or `null`. */
  async recordByNote(marker: string): Promise<TimeTrackingRecord | null> {
    return (await this.readRecords()).find((row) => row.note.includes(marker)) ?? null;
  }

  /** Is the "No time tracking records" empty state showing? */
  isEmpty(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(TimeTrackingIds.emptyTitle, timeout);
  }

  /** The empty state's second line (date-range wording, or the no-match-for-search wording). */
  async emptyHint(): Promise<string> {
    return (await this.text(TimeTrackingIds.emptyHint).catch(() => '')).trim();
  }

  /* --------------------------------------------------------------------- *
   * Filters
   * --------------------------------------------------------------------- */

  async presetText(): Promise<string> {
    return (await this.text(TimeTrackingIds.presetSelect, { visible: true })).trim();
  }

  async dateRangeText(): Promise<string> {
    return (await this.text(TimeTrackingIds.dateRange, { visible: true })).trim();
  }

  /** Choose a preset (pass every spelling) and wait for the requery to settle. */
  async selectPreset(...labels: string[]): Promise<this> {
    await logStep(`${this.name}: choose preset ${labels[0] ?? ''}`);
    await this.click(TimeTrackingIds.presetSelect);
    await this.click(selectOptionWithText(...labels), { timeout: Timeouts.SHORT });
    await settle(Timeouts.DEBOUNCE);
    await this.find(PayrollIds.table, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  /** Filter the table (server-side, debounced). Pass `''` to clear. */
  async search(staffName: string): Promise<this> {
    await this.setValue(PayrollIds.searchStaff, staffName);
    await settle(Timeouts.DEBOUNCE);
    await this.find(PayrollIds.table, { visible: true, timeout: Timeouts.MEDIUM });
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Add / Edit dialog
   * --------------------------------------------------------------------- */

  async openAddDialog(): Promise<this> {
    await logStep(`${this.name}: open Add New Time Keeping`);
    await this.click(TimeTrackingIds.addButton);
    await this.find(TimeTrackingIds.addDialog, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  isAddDialogOpen(timeout: number = Timeouts.ANIMATION): Promise<boolean> {
    return this.isVisible(TimeTrackingIds.addDialog, timeout);
  }

  isEditDialogOpen(timeout: number = Timeouts.ANIMATION): Promise<boolean> {
    return this.isVisible(TimeTrackingIds.editDialog, timeout);
  }

  /** Press the header submit ("Add" / "Save") — does NOT wait for the dialog to close. */
  async pressSubmit(): Promise<void> {
    await this.click(TimeTrackingIds.dialogSubmit);
    await settle();
  }

  async isSubmitEnabled(): Promise<boolean> {
    const el = await this.find(TimeTrackingIds.dialogSubmit, { visible: true });
    return el.isEnabled();
  }

  /** Every inline validation message currently shown in the form. */
  async formMessages(): Promise<string[]> {
    const els = await this.findAll(TimeTrackingIds.formMessages, { timeout: Timeouts.ANIMATION }).catch(
      () => [] as WebdriverIO.Element[],
    );
    const out: string[] = [];
    for (const el of els) {
      const text = ((await el.getText()) || asText(await el.getProperty('textContent'))).trim();
      if (text !== '') out.push(text);
    }
    return out;
  }

  /** `aria-invalid` on the staff picker trigger (`FormControl` writes it). */
  async isStaffInvalid(): Promise<boolean> {
    const el = await this.find(TimeTrackingIds.staffCombobox, { visible: true });
    return (await el.getAttribute('aria-invalid')) === 'true';
  }

  /**
   * Pick a staff member in the Add dialog's searchable picker.
   *
   * `optionIndex` addresses the (virtualised) option list from the top. Returns
   * the nickname actually chosen, read off the option, so the spec can look for
   * it in the table afterwards.
   */
  async chooseStaff(optionIndex = 0): Promise<string> {
    await this.click(TimeTrackingIds.staffCombobox);
    const options = await this.findAll(TimeTrackingIds.staffOptions, { timeout: Timeouts.MEDIUM });
    const option = options[optionIndex];
    if (!option) {
      throw new Error(
        `${this.name}: the staff picker offers ${String(options.length)} option(s); #${String(optionIndex)} asked.`,
      );
    }
    const lines = (asText(await option.getProperty('innerText')) || (await option.getText()))
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '');
    const name = lines[lines.length - 1] ?? '';
    await option.click();
    await settle();
    return name;
  }

  async setNote(note: string): Promise<void> {
    await this.setValue(TimeTrackingIds.noteInput, note);
  }

  async noteValue(): Promise<string> {
    return this.value(TimeTrackingIds.noteInput);
  }

  /** Close the open Add/Edit dialog with its X, without saving. */
  async closeDialog(): Promise<void> {
    await this.click(TimeTrackingIds.dialogClose).catch(async () => {
      await browser.keys(['Escape']);
    });
    await settle();
  }

  /**
   * Create a record: open Add, choose a staff member, type the note, submit.
   *
   * A staff member who already has an entry for today makes the schema reject
   * the range ("Time range overlaps with an existing entry for this staff."),
   * so on any validation message the next staff option is tried — up to
   * `maxAttempts`. Returns the staff nickname that was saved.
   */
  async addRecord(note: string, maxAttempts = 5): Promise<string> {
    await this.openAddDialog();
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const staff = await this.chooseStaff(attempt);
      await this.setNote(note);
      await this.pressSubmit();

      const deadline = Date.now() + Timeouts.MEDIUM;
      while (Date.now() < deadline) {
        if (!(await this.isAddDialogOpen(Timeouts.ANIMATION))) {
          await logStep(`${this.name}: added a record for ${staff}`);
          await settle();
          return staff;
        }
        if ((await this.formMessages()).length > 0) break;
        await settle(250);
      }
      this.log.warn(
        `${this.name}: "${staff}" was rejected (${(await this.formMessages()).join(' | ') || 'dialog still open'}); trying the next staff.`,
      );
    }
    await this.closeDialog();
    throw new Error(
      `${this.name}: could not add a time keeping record after ${String(maxAttempts)} staff attempts.`,
    );
  }

  /** Open the Edit dialog for the record whose note contains `marker`. */
  async openEditFor(marker: string): Promise<this> {
    await logStep(`${this.name}: edit the record "${marker}"`);
    await this.click(timeTrackingRowAction(marker, 'Edit'));
    await this.find(TimeTrackingIds.editDialog, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  /** In the Edit dialog: is the staff field the disabled read-only button? */
  async isStaffReadonly(): Promise<boolean> {
    const el = await this.find(TimeTrackingIds.staffReadonly, { timeout: Timeouts.SHORT }).catch(() => null);
    if (!el) return false;
    return !(await el.isEnabled());
  }

  /** In the Edit dialog: the read-only staff name. */
  async readonlyStaffName(): Promise<string> {
    return (await this.text(TimeTrackingIds.staffReadonly).catch(() => '')).trim();
  }

  /** Wait for the open Add/Edit dialog to close (after a successful submit). */
  async waitDialogClosed(timeout: number = Timeouts.MEDIUM): Promise<void> {
    await this.waitGone(TimeTrackingIds.editDialog, timeout).catch(() => undefined);
    await this.waitGone(TimeTrackingIds.addDialog, timeout).catch(() => undefined);
    await settle();
  }

  /* --------------------------------------------------------------------- *
   * Delete
   * --------------------------------------------------------------------- */

  /** Press Delete on the record whose note contains `marker`; waits for the alert dialog. */
  async openDeleteFor(marker: string): Promise<this> {
    await logStep(`${this.name}: delete the record "${marker}"`);
    await this.click(timeTrackingRowAction(marker, 'Delete'));
    await this.find(TimeTrackingIds.deleteDialog, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  isDeleteDialogOpen(timeout: number = Timeouts.ANIMATION): Promise<boolean> {
    return this.isVisible(TimeTrackingIds.deleteDialog, timeout);
  }

  async deleteDialogText(): Promise<string> {
    return (await this.text(TimeTrackingIds.deleteDescription).catch(() => '')).trim();
  }

  async cancelDelete(): Promise<void> {
    await this.click(TimeTrackingIds.deleteCancel);
    await this.waitGone(TimeTrackingIds.deleteDialog, Timeouts.SHORT);
  }

  async confirmDelete(): Promise<void> {
    await this.click(TimeTrackingIds.deleteConfirm);
    await this.waitGone(TimeTrackingIds.deleteDialog, Timeouts.MEDIUM);
    await settle();
  }

  /** Is a row whose note contains `marker` rendered? */
  hasRecordWithNote(marker: string, timeout: number = Timeouts.ANIMATION): Promise<boolean> {
    return this.exists(timeTrackingRowByNote(marker), timeout);
  }

  /** Wait until no row's note contains `marker`. */
  async waitRecordGone(marker: string, timeout: number = Timeouts.MEDIUM): Promise<void> {
    await this.waitGone(timeTrackingRowByNote(marker), timeout);
  }

  /** Wait until a row whose note contains `marker` is rendered. */
  async waitRecord(marker: string, timeout: number = Timeouts.MEDIUM): Promise<void> {
    await this.find(timeTrackingRowByNote(marker), { timeout });
  }

  /* --------------------------------------------------------------------- *
   * Toast
   * --------------------------------------------------------------------- */

  /** Texts of every toast on screen right now (sonner, ≈4 s lifetime). */
  async toastTexts(timeout: number = Timeouts.SHORT): Promise<string[]> {
    const els = await this.findAll(TimeTrackingIds.toast, { timeout }).catch(
      () => [] as WebdriverIO.Element[],
    );
    const out: string[] = [];
    for (const el of els) {
      const text = asText(await el.getProperty('textContent')).trim();
      if (text !== '') out.push(text);
    }
    return out;
  }
}

export default new TimeTrackingPage();
