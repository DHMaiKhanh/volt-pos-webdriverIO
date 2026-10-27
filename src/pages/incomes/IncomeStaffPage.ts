import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import {
  IncomeDailyIps,
  IncomeDetailIds,
  IncomeStaffIds,
  INCOME_STATS,
  incomeListRowAt,
  incomeStatValue,
  selectOptionWithText,
  type IncomeStat,
} from '../../constants/testids.incomes.js';
import { PayrollIds } from '../../constants/testids.payroll.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { parseMoney } from '../../utils/money.js';
import { passcodeDialog } from '../../components/modal/PasscodeDialog.js';
import { BasePage } from '../BasePage.js';
import { readDetailFields, readStaffList, type DetailField, type StaffListData } from './staffIncomeTable.js';

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

/** The `from` / `to` search params, in unix SECONDS, or `null` when the URL carries none. */
export interface UrlRange {
  from: number;
  to: number;
}

/**
 * Staff Income — `/incomes/income-staff`.
 *
 * ## What the table is, and what it is not
 *
 * A per-staff breakdown of the same day the store report totals. Rows are read
 * by HEADER through {@link readStaffList} (one round trip) and the spec decides
 * which figure it cares about.
 *
 * ## Build 1.1.56 vs develop
 *
 * The installed build renders NO "Search staff" box on this screen (live DOM
 * 2026-10-25); develop's `income-staff-list.tsx` does. {@link hasSearch} lets a
 * spec tell "absent" from "broken". The "Show staff with no income" switch is
 * off by default, which hides every zero-income row — so the row count equals
 * the Total staff card only with that switch in the state the card was computed
 * for (the card is computed from the same filtered list, `computeStaffIncomeSummary`).
 *
 * ## The rollup trap
 *
 * Per-staff figures do not all sum to the store's Staff Payout. Only `tip`,
 * `cleanUpFee`, `staffSalary` and `subtotal` do. `staffCommission`, `pay1`,
 * `pay2`, `supplyFee` and `totalIncome` are post-split at the store level. The
 * SUMMARY CARDS on this screen, however, are a plain `sumBy` over the visible
 * rows, so card == Σ column is a valid in-screen invariant.
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

  /** Open with NO search params, so the route's own default (Today) applies. */
  async openDefault(): Promise<this> {
    await logStep(`Open ${this.name} with the route's default range`);
    await goTo(this.route);
    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    await this.waitForDataSettled();
    return this;
  }

  /**
   * Navigate WITHOUT answering the passcode guard — for the gate cases. The
   * caller is responsible for the grant (clear it first, re-arm it after).
   */
  async navigateGated(): Promise<void> {
    await logStep(`Navigate to ${this.name} without unlocking`);
    await goTo(this.route);
  }

  /** The guard's title, e.g. "Enter staff code to access Staff Income". `''` when not shown. */
  async gateTitle(): Promise<string> {
    return this.text(PayrollIds.gateTitle, { visible: true, timeout: Timeouts.MEDIUM }).catch(() => '');
  }

  /** Is the report body (its title) on screen? */
  isLoaded(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(IncomeStaffIds.heading, timeout);
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

  /* --------------------------------------------------------------------- *
   * Filter bar
   * --------------------------------------------------------------------- */

  /** `from` / `to` from the address bar, or `null` when either is missing. */
  async urlRange(): Promise<UrlRange | null> {
    const url = new URL(await browser.getUrl());
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from === null || to === null) return null;
    return { from: Number(from), to: Number(to) };
  }

  /** The preset select's current text — "Today", "Yesterday", "Custom", ... */
  async presetText(): Promise<string> {
    return (await this.text(IncomeStaffIds.presetSelect, { visible: true })).trim();
  }

  /** The date-range trigger's text — `MM/DD/YYYY` or `MM/DD/YYYY - MM/DD/YYYY`. */
  async dateRangeText(): Promise<string> {
    return (await this.text(IncomeStaffIds.dateRange, { visible: true })).trim();
  }

  /**
   * Pick a preset from the select and wait for the URL to move.
   *
   * The URL is the source of truth (`income-staff-date-filter.tsx` navigates
   * with the new `from`/`to`), so that is what is waited on rather than the
   * select's own label, which can update a frame before the query refires.
   */
  async selectPreset(...labels: string[]): Promise<this> {
    await logStep(`${this.name}: choose preset ${labels[0] ?? ''}`);
    const before = JSON.stringify(await this.urlRange());
    await this.click(IncomeStaffIds.presetSelect);
    await this.click(selectOptionWithText(...labels), { timeout: Timeouts.SHORT });

    await browser
      .waitUntil(async () => JSON.stringify(await this.urlRange()) !== before, {
        timeout: Timeouts.MEDIUM,
        interval: 150,
      })
      .catch(() => {
        this.log.warn(`${this.name}: the URL range did not change after choosing ${labels[0] ?? ''}.`);
      });
    await this.waitForDataSettled();
    return this;
  }

  /**
   * Re-mount the route from its own URL state: leave to Home, come back with the
   * SAME `from`/`to`. A document reload is deliberately not used — in this Tauri
   * shell it re-runs the whole splash boot (see `helpers/navigate.ts`) — and the
   * thing under test is "the screen rebuilds its filter from the URL".
   */
  async remountFromUrl(): Promise<this> {
    const range = await this.urlRange();
    await logStep(`${this.name}: re-mount from URL ${JSON.stringify(range)}`);
    await goTo(Routes.HOME);
    await goTo(this.route, range ? { search: { from: range.from, to: range.to } } : {});
    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    await this.waitForDataSettled();
    return this;
  }

  /** Does this build render the "Search staff" box? (1.1.56 does not.) */
  hasSearch(): Promise<boolean> {
    return this.isVisible(IncomeStaffIds.searchStaff, Timeouts.ANIMATION);
  }

  /** Filter the table by staff name, where the screen offers a search box. */
  async search(staffName: string): Promise<this> {
    await this.setValue(IncomeStaffIds.searchStaff, staffName);
    await settle(Timeouts.DEBOUNCE);
    await this.waitForDataSettled(Timeouts.SHORT);
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Summary cards
   * --------------------------------------------------------------------- */

  async statText(stat: IncomeStat): Promise<string> {
    return (await this.text(incomeStatValue(stat), { visible: true })).trim();
  }

  /** All six cards; a card that cannot be read comes back as `''` so the spec can name it. */
  async allStats(): Promise<Record<IncomeStat, string>> {
    const out = {} as Record<IncomeStat, string>;
    for (const stat of Object.keys(INCOME_STATS) as IncomeStat[]) {
      out[stat] = await this.statText(stat).catch(() => '');
    }
    return out;
  }

  async statCents(stat: IncomeStat): Promise<number> {
    return parseMoney(await this.statText(stat));
  }

  async statCount(stat: IncomeStat): Promise<number> {
    const text = await this.statText(stat);
    const parsed = Number.parseInt(text.replace(/[^\d-]/g, ''), 10);
    if (!Number.isFinite(parsed))
      throw new Error(`${this.name}: the ${stat} card read "${text}", not a count.`);
    return parsed;
  }

  /* --------------------------------------------------------------------- *
   * The listing
   * --------------------------------------------------------------------- */

  /** Headers + every row, parsed, in one round trip. Empty when the list is empty. */
  readList(): Promise<StaffListData> {
    return readStaffList();
  }

  /** "No results found." in place of the table. */
  isListEmpty(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(IncomeStaffIds.emptyList, timeout);
  }

  /**
   * Every staff row, in display order (legacy shape, kept for existing callers).
   */
  async rows(): Promise<StaffIncomeRow[]> {
    const { rows } = await readStaffList();
    return rows.map((row) => ({
      staffName: row.name,
      cells: row.cells,
      amountsCents: [row.subtotalCents, row.supplyFeeCents, row.tipCents, row.totalIncomeCents],
    }));
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

  /* --------------------------------------------------------------------- *
   * Detail panel
   * --------------------------------------------------------------------- */

  /** Is the right panel showing its "No detail to show" prompt? */
  hasNoDetail(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(IncomeDetailIds.noDetail, timeout);
  }

  async noDetailHint(): Promise<string> {
    return this.text(IncomeDetailIds.noDetailHint, { visible: true }).catch(() => '');
  }

  /**
   * Click the row at `index` and wait for the panel to show THAT staff member.
   *
   * Waits on the `<h2>` name AND the skeleton being gone: the panel shows a
   * skeleton while switching staff, and reading during it returns the previous
   * staff member's figures.
   */
  async openStaffDetailAt(index: number): Promise<this> {
    await logStep(`${this.name}: open staff row #${String(index)}`);
    await this.click(incomeListRowAt(index));
    await browser.waitUntil(async () => new URL(await browser.getUrl()).searchParams.has('staffId'), {
      timeout: Timeouts.MEDIUM,
      interval: 150,
      timeoutMsg: `Clicking staff row #${String(index)} never put staffId in the URL.`,
    });
    await this.find(IncomeDetailIds.staffName, { visible: true, timeout: Timeouts.MEDIUM });
    await this.waitDetailSettled();
    return this;
  }

  private async waitDetailSettled(timeout: number = Timeouts.MEDIUM): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!(await this.exists(IncomeDetailIds.skeleton, 300))) return;
      await settle(200);
    }
    this.log.warn(`${this.name}: detail skeleton still visible after ${String(timeout)}ms.`);
  }

  /** The panel header: the nickname and the `(range)` text with its parentheses removed. */
  async detailHeader(): Promise<{ name: string; range: string }> {
    const name = (await this.text(IncomeDetailIds.staffName, { visible: true })).trim();
    const rangeRaw = await this.text(IncomeDetailIds.dateRange).catch(() => '');
    return { name, range: rangeRaw.trim().replace(/^\(/, '').replace(/\)$/, '') };
  }

  async isPrintEnabled(): Promise<boolean> {
    const el = await this.find(IncomeDetailIds.printButton, { visible: true });
    return el.isEnabled();
  }

  /** Every label/value row of the open detail panel. */
  detailFields(): Promise<DetailField[]> {
    return readDetailFields();
  }

  /** "Thank you, <name>!" — `''` when absent. */
  async thankYouText(): Promise<string> {
    return (await this.text(IncomeDetailIds.thankYou).catch(() => '')).trim();
  }
}

export default new IncomeStaffPage();
