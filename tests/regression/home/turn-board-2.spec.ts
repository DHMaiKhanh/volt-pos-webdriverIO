/**
 * Turn board (part 2) — Adjust Manual Turn and Turn Settings.
 *
 * Test cases: docs/screens/turn/turn-test-cases.md — TC-TURN-25..49 and 55.
 * Part 1 (turn-board.spec.ts) holds TC-TURN-01..24 and 50..54.
 *
 * ## Adjust Manual Turn (TC-TURN-36..48)
 *
 * Works on TODAY's board, so 2 staff are checked IN through Time Keeping and
 * OUT again in `after`. Every saved adjustment is undone in the same test
 * (a `−` Save after a `+` Save, net delta 0), and `after` re-applies any
 * delta a failing test left behind.
 *
 * ## Turn Settings (TC-TURN-25..35, 49, 55) — `@exclusive`
 *
 * `sys_setting.merchant_turn_default` is merchant-GLOBAL. The block reads the
 * original configuration first, puts the merchant on a known baseline
 * ($100.00, service-based ON, decimals ON) so the arithmetic is predictable,
 * restores the baseline after every saving case, and restores the ORIGINAL at
 * the end (TC-TURN-55 asserts it). The formula cases run on a PAST day with
 * sales (found at run time) so a live order cannot move the numbers, and
 * assert invariants — ratios, integer-ness, monotonicity — not the doc's
 * figures, which came from one merchant's data.
 *
 * WRITES ATTENDANCE, MANUAL TURN DELTAS (reverted) AND THE MERCHANT TURN
 * CONFIG (restored). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import {
  turnBoardDialog,
  type TurnRow,
  type TurnSettingsState,
} from '../../../src/components/modal/TurnBoardDialog.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  EMPTY_DAY,
  clockInRoster,
  clockOut,
  findPastDayWithRows,
  startOnHome,
  today,
  todayRows,
} from './turn-board.helpers.js';

const BASELINE = { serviceBased: true, decimal: true, turnValueCents: 10_000 } as const;

/** Rounded to the 2 decimals the board shows. */
const r2 = (n: number): number => Math.round(n * 100) / 100;
const byStaff = (rows: TurnRow[]): Map<string, number> => new Map(rows.map((r) => [r.staff, r.turnCount]));

/* ======================================================================= *
 * Adjust Manual Turn
 * ======================================================================= */

describe('Turn board — Adjust Manual Turn', () => {
  let roster: string[] = [];
  /** Saved deltas not yet undone, per staff — replayed in reverse by `after`. */
  const unreverted = new Map<string, number>();

  /** Open the board on today and the Adjust dialog. */
  async function openAdjustOnToday(): Promise<void> {
    await turnBoardDialog.closeAdjust().catch(() => undefined);
    await todayRows();
    await turnBoardDialog.openAdjust();
  }

  /** +1 and Save, remembering it for the safety net. */
  async function savePlusOne(staff: string): Promise<void> {
    await turnBoardDialog.adjustIncrease(staff);
    await turnBoardDialog.adjustSave(staff);
    unreverted.set(staff, (unreverted.get(staff) ?? 0) + 1);
  }

  /** −1 and Save (undo of {@link savePlusOne}). */
  async function saveMinusOne(staff: string): Promise<void> {
    await turnBoardDialog.adjustDecrease(staff);
    await turnBoardDialog.adjustSave(staff);
    unreverted.set(staff, (unreverted.get(staff) ?? 0) - 1);
  }

  /** A roster row whose Current is 0 (freshly clocked in, no sales today). */
  async function zeroRow(): Promise<string> {
    const rows = await turnBoardDialog.adjustRows();
    const row =
      rows.find((r) => roster.includes(r.staff) && r.current === 0) ?? rows.find((r) => r.current === 0);
    if (!row)
      throw new Error("No Adjust row with Current: 0 — every staff on today's board already has turns.");
    return row.staff;
  }

  /** Set only when the merchant had the turn feature OFF and this block had to switch it on. */
  let switchedOnFrom: TurnSettingsState | null = null;

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('save manual turn adjustments');
    await startOnHome();
    // Turn value $0.00 is the app's kill switch: every count (adjustments included) reads 0.
    await turnBoardDialog.open();
    await turnBoardDialog.openSettings();
    const current = await turnBoardDialog.readSettings();
    if (current.turnValueCents === 0) {
      switchedOnFrom = current;
      await turnBoardDialog.applySettings(BASELINE);
    } else {
      await turnBoardDialog.cancelSettings();
    }
    await turnBoardDialog.close();
    roster = await clockInRoster(2);
  });

  afterEach(async () => {
    await turnBoardDialog.closeAdjust().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    // Safety net: undo any saved delta a failing case left behind.
    const pending = [...unreverted.entries()].filter(([, delta]) => delta !== 0);
    if (pending.length > 0) {
      await step('Revert leftover turn adjustments', async () => {
        await openAdjustOnToday();
        for (const [staff, delta] of pending) {
          if (delta > 0) await turnBoardDialog.adjustDecrease(staff, delta);
          else await turnBoardDialog.adjustIncrease(staff, -delta);
          await turnBoardDialog.adjustSave(staff);
        }
        await turnBoardDialog.closeAdjust();
      }).catch(() => undefined);
    }
    if (switchedOnFrom !== null) {
      await turnBoardDialog.open().catch(() => undefined);
      await turnBoardDialog.applySettings(switchedOnFrom).catch(() => undefined);
      switchedOnFrom = null;
    }
    await turnBoardDialog.close().catch(() => undefined);
    await clockOut(roster);
    roster = [];
    await returnToHome();
  });

  it(title('Adjust Turn opens one stepper row per board row (TC-TURN-36)', Tag.REGRESSION), async () => {
    const board = await todayRows();
    await turnBoardDialog.openAdjust();
    const rows = await turnBoardDialog.adjustRows();

    expect(rows).toHaveLength(board.length);
    for (const row of rows) {
      expect(row.currentText).toMatch(/^(Current|Hiện tại):\s*\d+(\.\d{1,2})?$/);
      expect(row.increaseEnabled).toBe(true);
      expect(row.valueText).toMatch(/^\d+(\.\d{1,2})?$/);
    }
  });

  it(title("Adjust rows follow the board's current sort (TC-TURN-37)", Tag.REGRESSION), async () => {
    await todayRows();
    await turnBoardDialog.setSort('checkinDesc');
    const boardOrder = await turnBoardDialog.staffOrder();
    await turnBoardDialog.openAdjust();
    const adjustOrder = (await turnBoardDialog.adjustRows()).map((r) => r.staff);
    await turnBoardDialog.closeAdjust();
    await turnBoardDialog.setSort('countAsc');

    expect(adjustOrder).toEqual(boardOrder);
  });

  it(title('Save and Reset are disabled on an untouched row (TC-TURN-38)', Tag.REGRESSION), async () => {
    await openAdjustOnToday();
    for (const row of await turnBoardDialog.adjustRows()) {
      expect(row.saveEnabled).toBe(false);
      expect(row.resetEnabled).toBe(false);
      expect(row.value).toBe(row.current);
    }
  });

  it(title('One increase makes only that row dirty (TC-TURN-39)', Tag.REGRESSION), async () => {
    await openAdjustOnToday();
    const staff = await zeroRow();
    await turnBoardDialog.adjustIncrease(staff);
    const rows = await turnBoardDialog.adjustRows();

    for (const row of rows) {
      if (row.staff === staff) {
        expect(row.value).toBe(1);
        expect(row.saveEnabled).toBe(true);
        expect(row.resetEnabled).toBe(true);
      } else {
        expect(row.saveEnabled).toBe(false);
        expect(row.resetEnabled).toBe(false);
      }
    }
    await turnBoardDialog.adjustReset(staff);
  });

  it(title('Decrease steps by exactly 1 and keeps the decimals (TC-TURN-40)', Tag.REGRESSION), async () => {
    await openAdjustOnToday();
    const rows = await turnBoardDialog.adjustRows();
    // Prefer a fractional Current ≥ 1 (the doc's 4.24 → 3.24); otherwise lift
    // any row by +1 first so there is a full step to take back.
    const row = rows.find((r) => r.current >= 1 && r.current % 1 !== 0) ?? rows[0];
    if (!row) throw new Error("Today's board has no rows.");

    let start = row.current;
    if (start < 1) {
      await turnBoardDialog.adjustIncrease(row.staff);
      start = r2(row.current + 1);
    }
    await turnBoardDialog.adjustDecrease(row.staff);

    const after = await turnBoardDialog.adjustRowFor(row.staff);
    expect(after?.value).toBe(r2(start - 1));
    await turnBoardDialog.adjustReset(row.staff);
  });

  it(title('Decrease clamps at 0 — never negative (TC-TURN-41)', Tag.REGRESSION), async () => {
    await openAdjustOnToday();
    const rows = await turnBoardDialog.adjustRows();
    // A fractional Current (e.g. 0.46 / 2.5) shows the clamp best; any row with turns works.
    const row = rows.find((r) => r.current > 0 && r.current % 1 !== 0) ?? rows.find((r) => r.current > 0);
    const staff = row?.staff ?? (await zeroRow());
    if (!row) await turnBoardDialog.adjustIncrease(staff); // 0 → 1 so there is something to clamp
    const start = row?.current ?? 1;

    await turnBoardDialog.adjustDecrease(staff, Math.ceil(start));
    const after = await turnBoardDialog.adjustRowFor(staff);

    expect(after?.value).toBe(0);
    expect(after?.decreaseEnabled).toBe(false);
    await turnBoardDialog.adjustReset(staff);
  });

  it(title('Decrease is disabled when Current is 0 (TC-TURN-42)', Tag.REGRESSION), async () => {
    await openAdjustOnToday();
    const staff = await zeroRow();
    const row = await turnBoardDialog.adjustRowFor(staff);

    expect(row?.decreaseEnabled).toBe(false);
    expect(row?.increaseEnabled).toBe(true);
  });

  it(
    title('Reset returns one row to Current and leaves other dirty rows alone (TC-TURN-43)', Tag.REGRESSION),
    async () => {
      await openAdjustOnToday();
      const [a, b] = roster;
      if (a === undefined || b === undefined) throw new Error('Needs two clocked-in staff.');
      await turnBoardDialog.adjustIncrease(a);
      await turnBoardDialog.adjustIncrease(b);

      await turnBoardDialog.adjustReset(a);
      const rowA = await turnBoardDialog.adjustRowFor(a);
      const rowB = await turnBoardDialog.adjustRowFor(b);

      expect(rowA?.value).toBe(rowA?.current);
      expect(rowA?.saveEnabled).toBe(false);
      expect(rowA?.resetEnabled).toBe(false);
      expect(rowB?.value).toBe(r2((rowB?.current ?? 0) + 1));
      expect(rowB?.saveEnabled).toBe(true);
      await turnBoardDialog.adjustReset(b);
    },
  );

  it(
    title(
      'Saving an adjustment on today updates Current and the board (TC-TURN-44)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openAdjustOnToday();
      const staff = await zeroRow();
      const before = (await turnBoardDialog.adjustRowFor(staff))?.current ?? 0;

      await savePlusOne(staff);
      try {
        const row = await turnBoardDialog.adjustRowFor(staff);
        expect(row?.current).toBe(r2(before + 1));
        expect(row?.value).toBe(r2(before + 1));
        expect(row?.saveEnabled).toBe(false);
        expect(row?.resetEnabled).toBe(false);

        await turnBoardDialog.closeAdjust();
        expect((await turnBoardDialog.rowFor(staff))?.turnCount).toBe(r2(before + 1));
      } finally {
        await openAdjustOnToday();
        await saveMinusOne(staff);
      }
    },
  );

  it(
    title('A manual adjustment is ADDED to the computed turns (TC-TURN-45)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const [staff] = roster;
      if (staff === undefined) throw new Error('Needs a clocked-in staff.');
      const computed = (await todayRows()).find((r) => r.staff === staff)?.turnCount ?? 0;

      await turnBoardDialog.openAdjust();
      await savePlusOne(staff);
      try {
        await turnBoardDialog.closeAdjust();
        expect((await turnBoardDialog.rowFor(staff))?.turnCount).toBe(r2(computed + 1));
      } finally {
        await openAdjustOnToday();
        await saveMinusOne(staff);
      }
    },
  );

  it(
    title(
      'Undoing a saved adjustment needs a second Save, not Reset (TC-TURN-46)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openAdjustOnToday();
      const staff = await zeroRow();
      const before = (await turnBoardDialog.adjustRowFor(staff))?.current ?? 0;

      await savePlusOne(staff);
      // Reset only reverts the pending stepper — the saved +1 stays.
      await turnBoardDialog.closeAdjust();
      await turnBoardDialog.openAdjust();
      expect((await turnBoardDialog.adjustRowFor(staff))?.resetEnabled).toBe(false);
      expect((await turnBoardDialog.adjustRowFor(staff))?.current).toBe(r2(before + 1));

      await saveMinusOne(staff);
      expect((await turnBoardDialog.adjustRowFor(staff))?.current).toBe(before);
      await turnBoardDialog.closeAdjust();
      expect((await turnBoardDialog.rowFor(staff))?.turnCount).toBe(before);
    },
  );

  it(
    title(
      'TC-TURN-47: Save on a PAST day lands on today (bug) — PENDING (writes an un-revertable delta: the past ' +
        "day's staff are not on today's board, so the stray +1 cannot be taken back through the UI on a shared merchant)",
    ),
  );

  it(
    title(
      'TC-TURN-48: float dust keeps Save enabled at 1.02 − 1 (bug) — PENDING (needs a staff whose Current is ' +
        'fractional today, which only real service sales under decimal mode produce)',
    ),
  );
});

/* ======================================================================= *
 * Turn Settings — merchant-global
 * ======================================================================= */

describe('Turn board — Turn Settings (merchant-global)', () => {
  let original: TurnSettingsState | null = null;
  /** A past day with at least one row > 0 turns under the baseline. */
  let dataDay: Date | null = null;

  const sameConfig = (
    s: TurnSettingsState,
    t: { serviceBased: boolean; decimal: boolean; turnValueCents: number },
  ): boolean =>
    s.serviceBased === t.serviceBased &&
    (!t.serviceBased || s.decimal === t.decimal) &&
    s.turnValueCents === t.turnValueCents;

  /** Apply a config (opens Settings), then read the data day's board. */
  async function rowsUnder(config: {
    serviceBased: boolean;
    decimal: boolean;
    turnValueCents: number;
  }): Promise<TurnRow[]> {
    await turnBoardDialog.open();
    await turnBoardDialog.applySettings(config);
    expect(await turnBoardDialog.isSettingsOpen()).toBe(false);
    return turnBoardDialog.rows();
  }

  async function requireDataDay(): Promise<Date> {
    if (dataDay === null) {
      throw new Error(
        'No past day with turns > 0 was found (the reference day 2026-07-27 and the last 21 days) — ' +
          'the formula cases need a day with completed service sales by a clocked-in staff.',
      );
    }
    await turnBoardDialog.open();
    await turnBoardDialog.pickDate(dataDay);
    return dataDay;
  }

  async function restoreBaseline(): Promise<void> {
    await turnBoardDialog.cancelSettings().catch(() => undefined);
    await turnBoardDialog.open();
    await turnBoardDialog.openSettings();
    const now = await turnBoardDialog.readSettings();
    if (sameConfig(now, BASELINE)) await turnBoardDialog.cancelSettings();
    else await turnBoardDialog.applySettings(BASELINE);
  }

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('change the merchant turn settings');
    await startOnHome();
    await turnBoardDialog.open();
    await turnBoardDialog.openSettings();
    original = await turnBoardDialog.readSettings();
    await turnBoardDialog.applySettings(BASELINE);
    dataDay = await findPastDayWithRows({ withTurns: true });
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await turnBoardDialog.closeAdjust().catch(() => undefined);
    await turnBoardDialog.cancelSettings().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    // Belt-and-braces: TC-TURN-55 restores the original; this re-applies it if that case failed.
    if (original !== null) {
      await turnBoardDialog.open().catch(() => undefined);
      await turnBoardDialog.openSettings().catch(() => undefined);
      const now = await turnBoardDialog.readSettings().catch(() => null);
      if (now === null || !sameConfig(now, original)) {
        await turnBoardDialog.applySettings(original).catch(() => undefined);
      } else {
        await turnBoardDialog.cancelSettings().catch(() => undefined);
      }
    }
    await turnBoardDialog.pickDate(today()).catch(() => undefined);
    await turnBoardDialog.close().catch(() => undefined);
    await returnToHome();
  });

  it(title('Turn Settings shows the saved configuration (TC-TURN-25)', Tag.REGRESSION), async () => {
    await turnBoardDialog.open();
    await turnBoardDialog.openSettings();
    const s = await turnBoardDialog.readSettings();

    expect(s.serviceBased).toBe(BASELINE.serviceBased);
    expect(s.decimal).toBe(BASELINE.decimal);
    expect(s.turnValueText).toBe('$100.00');
    expect(s.helperShown).toBe(true);
    await turnBoardDialog.cancelSettings();
  });

  it(title('Turn value is a CENT mask: 25 → $0.25, 2500 → $25.00 (TC-TURN-26)', Tag.REGRESSION), async () => {
    await turnBoardDialog.open();
    await turnBoardDialog.openSettings();

    expect(await turnBoardDialog.typeTurnValue('25')).toBe('$0.25');
    expect(await turnBoardDialog.typeTurnValue('2500')).toBe('$25.00');
    await turnBoardDialog.cancelSettings();
  });

  it(title('Turn value filters letters and the minus sign (TC-TURN-27)', Tag.REGRESSION), async () => {
    await turnBoardDialog.open();
    await turnBoardDialog.openSettings();

    expect(await turnBoardDialog.typeTurnValue('abc-99')).toBe('$0.99');
    await turnBoardDialog.cancelSettings();
  });

  it(title('Escape discards unsaved Turn Settings (TC-TURN-28)', Tag.REGRESSION), async () => {
    await turnBoardDialog.open();
    const rowsBefore = await turnBoardDialog.rows();
    await turnBoardDialog.openSettings();
    const before = await turnBoardDialog.readSettings();

    await turnBoardDialog.typeTurnValue('2500');
    await turnBoardDialog.cancelSettings();
    await turnBoardDialog.openSettings();
    const after = await turnBoardDialog.readSettings();
    await turnBoardDialog.cancelSettings();

    expect(after.turnValueText).toBe(before.turnValueText);
    expect(after.serviceBased).toBe(before.serviceBased);
    expect(after.decimal).toBe(before.decimal);
    expect(await turnBoardDialog.rows()).toEqual(rowsBefore);
  });

  it(
    title('Saving a new Turn value recomputes the board at once (TC-TURN-29)', Tag.REGRESSION, Tag.EXCLUSIVE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await requireDataDay();
        const at100 = byStaff(await turnBoardDialog.rows());
        const at25 = byStaff(await rowsUnder({ ...BASELINE, turnValueCents: 2_500 }));

        const scored = [...at100.entries()].filter(([, v]) => v > 0);
        expect(scored.length).toBeGreaterThan(0);
        // $100 → $25 is ×4 (rounding to 2 decimals on both sides allows a few hundredths).
        for (const [staff, v] of scored)
          expect(Math.abs((at25.get(staff) ?? 0) - v * 4)).toBeLessThanOrEqual(0.05);
      } finally {
        await restoreBaseline();
      }
    },
  );

  it(
    title(
      'Decimals OFF counts services at/over the threshold, not a rounded total (TC-TURN-30)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await requireDataDay();
        const dec = byStaff(await rowsUnder({ serviceBased: true, decimal: true, turnValueCents: 2_500 }));
        const int = byStaff(await rowsUnder({ serviceBased: true, decimal: false, turnValueCents: 2_500 }));

        for (const [staff, n] of int) {
          expect(Number.isInteger(n)).toBe(true);
          // Each counted service is worth ≥ the threshold, so count ≤ total/threshold.
          expect(n).toBeLessThanOrEqual((dec.get(staff) ?? 0) + 1e-9);
        }
      } finally {
        await restoreBaseline();
      }
    },
  );

  it(
    title(
      'Decimals OFF with a higher threshold never counts more (TC-TURN-31)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await requireDataDay();
        const at25 = byStaff(await rowsUnder({ serviceBased: true, decimal: false, turnValueCents: 2_500 }));
        const at60 = byStaff(await rowsUnder({ serviceBased: true, decimal: false, turnValueCents: 6_000 }));

        for (const [staff, n] of at60) {
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeLessThanOrEqual(at25.get(staff) ?? 0);
        }
      } finally {
        await restoreBaseline();
      }
    },
  );

  it(
    title('Service-based OFF disables the decimals switch, not the Turn value (TC-TURN-32)', Tag.REGRESSION),
    async () => {
      await turnBoardDialog.open();
      await turnBoardDialog.openSettings();
      await turnBoardDialog.setServiceBased(true);
      await turnBoardDialog.setServiceBased(false);
      const s = await turnBoardDialog.readSettings();
      await turnBoardDialog.cancelSettings();

      expect(s.serviceBased).toBe(false);
      expect(s.decimalEnabled).toBe(false);
      expect(s.turnValueEnabled).toBe(true);
    },
  );

  it(
    title(
      'Service-based OFF counts one turn per completed order (TC-TURN-33)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await requireDataDay();
        const baseline = byStaff(await turnBoardDialog.rows());
        const orders = byStaff(
          await rowsUnder({ serviceBased: false, decimal: false, turnValueCents: 10_000 }),
        );
        // The Turn value is ignored in order mode.
        const ordersAt25 = byStaff(
          await rowsUnder({ serviceBased: false, decimal: false, turnValueCents: 2_500 }),
        );

        for (const [staff, n] of orders) {
          expect(Number.isInteger(n)).toBe(true);
          if ((baseline.get(staff) ?? 0) > 0) expect(n).toBeGreaterThanOrEqual(1);
          expect(ordersAt25.get(staff)).toBe(n);
        }
      } finally {
        await restoreBaseline();
      }
    },
  );

  it(
    title(
      'TC-TURN-34: only SUCCESSFUL orders count toward turns — PENDING (needs a clocked-in staff with a ' +
        'successful + pending + canceled order on one day and their per-order service totals to compute ' +
        'the expected value; the board shows only the sum)',
    ),
  );

  it(
    title('Empty Turn value saves as $0.00 and zeroes every row (TC-TURN-35)', Tag.REGRESSION, Tag.EXCLUSIVE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await requireDataDay();
        await turnBoardDialog.openSettings();
        expect(await turnBoardDialog.typeTurnValue('')).toBe('$0.00');
        await turnBoardDialog.saveSettings();

        // Doc logged this as a missing validation; current source treats 0 as the
        // documented kill switch ("turnValue <= 0 disables turn counting").
        expect(await turnBoardDialog.isSettingsOpen()).toBe(false);
        const rows = await turnBoardDialog.rows();
        for (const row of rows) expect(row.turnCount).toBe(0);

        await turnBoardDialog.openSettings();
        expect((await turnBoardDialog.readSettings()).turnValueCents).toBe(0);
        await turnBoardDialog.cancelSettings();
      } finally {
        await restoreBaseline();
      }
    },
  );

  it(
    title('Adjust Turn and Setting still open on an empty day (TC-TURN-49)', Tag.REGRESSION, Tag.EXCLUSIVE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await turnBoardDialog.open();
      await turnBoardDialog.pickDate(EMPTY_DAY);
      expect(await turnBoardDialog.hasNoStaff()).toBe(true);

      await turnBoardDialog.openAdjust();
      expect(await turnBoardDialog.adjustRows()).toHaveLength(0);
      expect(await turnBoardDialog.adjustHasNoStaff()).toBe(true);
      await turnBoardDialog.closeAdjust();

      // Saving the unchanged baseline proves the form still saves with no rows.
      await turnBoardDialog.openSettings();
      const before = await turnBoardDialog.readSettings();
      await turnBoardDialog.saveSettings();
      expect(await turnBoardDialog.isSettingsOpen()).toBe(false);
      await turnBoardDialog.openSettings();
      const after = await turnBoardDialog.readSettings();
      await turnBoardDialog.cancelSettings();
      expect(sameConfig(after, before)).toBe(true);

      await turnBoardDialog.pickDate(today());
    },
  );

  it(
    title(
      'Turn Settings are restored to the original configuration (TC-TURN-55)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      if (original === null) throw new Error('The original Turn Settings were never read.');
      await turnBoardDialog.open();
      await turnBoardDialog.applySettings(original);

      await turnBoardDialog.openSettings();
      const now = await turnBoardDialog.readSettings();
      await turnBoardDialog.cancelSettings();

      expect(now.serviceBased).toBe(original.serviceBased);
      expect(now.turnValueCents).toBe(original.turnValueCents);
      if (original.serviceBased) expect(now.decimal).toBe(original.decimal);
    },
  );
});
