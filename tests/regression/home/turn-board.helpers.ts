/**
 * Shared set-up for the Turn board specs (turn-board.spec.ts, turn-board-2.spec.ts).
 *
 * ## Why staff have to be clocked in
 *
 * The board lists ONLY staff with a clock-in record on the selected day, and on
 * TODAY only staff whose shift is still open (`use-turn-board.ts`). A DEV
 * merchant often has nobody clocked in, so every row-dependent case first checks
 * staff IN through the Time Keeping dialog — choosing staff who are OUT right
 * now — and checks exactly those staff OUT again in an `after` hook. Nobody who
 * was already IN is touched.
 */

import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { timeKeepingDialog } from '../../../src/components/modal/TimeKeepingDialog.js';
import { turnBoardDialog, type TurnRow } from '../../../src/components/modal/TurnBoardDialog.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { dismissUpdaterIfPresent } from '../../../src/helpers/updater.js';

/**
 * A past day the 2026-08 scan found populated (6 staff, real sales) on the DEV
 * merchant. Tried FIRST when a spec needs "a past day with rows"; when it is
 * empty on this merchant the helper walks back from yesterday instead.
 */
export const REFERENCE_PAST_DAY = new Date(2026, 6, 27);

/** A day long before any merchant existed — always the empty state. */
export const EMPTY_DAY = new Date(2001, 0, 1);

export const today = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/** Both renderings of a date on the trigger: EN `MM/DD/YYYY`, VI `DD/MM/YYYY`. */
export function dateLabels(date: Date): [string, string] {
  const p = (n: number): string => String(n).padStart(2, '0');
  const y = date.getFullYear();
  return [
    `${p(date.getMonth() + 1)}/${p(date.getDate())}/${y}`,
    `${p(date.getDate())}/${p(date.getMonth() + 1)}/${y}`,
  ];
}

/** Start on a clean /home: no dialog, no updater banner. */
export async function startOnHome(): Promise<void> {
  await returnToHome();
  await dismissUpdaterIfPresent();
  await turnBoardDialog.close().catch(() => undefined);
  await timeKeepingDialog.closeWithEscape().catch(() => undefined);
}

/**
 * Check `count` staff IN who are currently OUT. Returns their nicknames in the
 * order they were checked in (so check-in time ascending). WRITES ATTENDANCE —
 * pair with {@link clockOut} in an `after` hook.
 */
export async function clockInRoster(count: number): Promise<string[]> {
  assertWritesAllowed('clock staff in for the Turn board');
  return step(`Clock in ${count} staff for the turn board`, async () => {
    await turnBoardDialog.close().catch(() => undefined);
    await timeKeepingDialog.open();
    const names = await timeKeepingDialog.checkInCandidates(count);
    if (names.length < count) {
      throw new Error(
        `Time Keeping offers only ${names.length} staff that can be checked in (wanted ${count}). ` +
          'Every rendered card in "Unavailable Staff" is disabled, duplicated or already selected.',
      );
    }
    const done: string[] = [];
    try {
      for (const name of names) {
        await timeKeepingDialog.checkIn(name);
        done.push(name);
        // Distinct check-in times keep the check-in sorts deterministic.
        await new Promise((resolve) => setTimeout(resolve, 1_100));
      }
    } catch (error) {
      // Leave nobody half-way: undo what did go IN before reporting.
      await clockOut(done).catch(() => undefined);
      throw error;
    }
    await timeKeepingDialog.clearSearch();
    await timeKeepingDialog.close();
    return done;
  });
}

/** Check these staff OUT again — only those that are actually IN. Never throws on a missing name. */
export async function clockOut(names: readonly string[]): Promise<void> {
  if (names.length === 0) return;
  await step(`Clock out ${names.join(', ')}`, async () => {
    await turnBoardDialog.close().catch(() => undefined);
    await timeKeepingDialog.open();
    for (const name of names) {
      if ((await timeKeepingDialog.columnOf(name)) === 'available') await timeKeepingDialog.checkOut(name);
    }
    await timeKeepingDialog.clearSearch().catch(() => undefined);
    await timeKeepingDialog.close();
  });
}

/** Board rows of TODAY (opens the board if needed and selects today). */
export async function todayRows(): Promise<TurnRow[]> {
  await turnBoardDialog.open();
  await turnBoardDialog.pickDate(today());
  return turnBoardDialog.rows();
}

/**
 * A past day whose board has at least one row (`withTurns`: at least one row
 * with a count above 0). {@link REFERENCE_PAST_DAY} first, then yesterday
 * backwards for `maxDays`. Leaves the board ON that day. `null` when none.
 */
export async function findPastDayWithRows(
  options: { withTurns?: boolean; maxDays?: number } = {},
): Promise<Date | null> {
  const { withTurns = false, maxDays = 21 } = options;
  const wanted = (rows: TurnRow[]): boolean =>
    rows.length > 0 && (!withTurns || rows.some((r) => r.turnCount > 0));
  await turnBoardDialog.open();

  const candidates = [REFERENCE_PAST_DAY];
  for (let back = 1; back <= maxDays; back += 1) candidates.push(addDays(today(), -back));

  for (const day of candidates) {
    if (day.getTime() >= today().getTime()) continue;
    await turnBoardDialog.pickDate(day);
    if (wanted(await turnBoardDialog.rows())) return day;
  }
  return null;
}

/** `true` when the numbers are ascending (non-decreasing). */
export const isNonDecreasing = (xs: number[]): boolean =>
  xs.every((x, i) => i === 0 || (xs[i - 1] ?? x) <= x);

/** `true` when the numbers are descending (non-increasing). */
export const isNonIncreasing = (xs: number[]): boolean =>
  xs.every((x, i) => i === 0 || (xs[i - 1] ?? x) >= x);
