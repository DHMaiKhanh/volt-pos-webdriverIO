/**
 * VP-1761 — Turn suggestion / Turn board (volt-qc per-ticket file
 * `docs/qc/volt-qc/vp-tickets/VP-1761-turn-suggestion-test-cases.md`, TC 1–25).
 *
 * Automated: the board and quick view against two staff this spec clocks IN
 * (and OUT again in `after`), the four sorts, the past-day picker, the Setting
 * passcode gate and the service-based/decimals lock, and the Adjust Manual Turn
 * stepper semantics (cumulative save, negative, reset). Every saved delta is
 * reverted; the Turn config is only changed when the merchant had it switched
 * off ($0.00 kills every count) and is restored afterwards.
 *
 * Known build deviation: the 1.1.x stepper clamps at 0 (TC-TURN-41 in
 * tests/regression/home/turn-board-2.spec.ts), while the sheet's TC-22 allows a
 * negative delta. TC-22 asserts the sheet and therefore names that gap when it
 * fails; it never saves.
 *
 * Manual: the turn FORMULAS (they need orders completed with chosen services,
 * discounts, refunds and voids — the invariant versions run on past days in
 * turn-board-2.spec.ts), legend chips (no handle), day-rollover of deltas and
 * the checkout "Turn Count" staff sort.
 *
 * WRITES ATTENDANCE AND MANUAL TURN DELTAS (both reverted). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../../src/components/index.js';
import { timeKeepingDialog } from '../../../../src/components/modal/TimeKeepingDialog.js';
import { turnBoardDialog, type TurnSettingsState } from '../../../../src/components/modal/TurnBoardDialog.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import {
  clockInRoster,
  clockOut,
  findPastDayWithRows,
  isNonDecreasing,
  startOnHome,
  todayRows,
} from '../../home/turn-board.helpers.js';

const BASELINE = { serviceBased: true, decimal: true, turnValueCents: 10_000 } as const;
const r2 = (n: number): number => Math.round(n * 100) / 100;

describe('VP-1761 — Turn suggestion', () => {
  let roster: string[] = [];
  let switchedOnFrom: TurnSettingsState | null = null;
  /** Saved deltas not yet undone, per staff — replayed in reverse by `after`. */
  const unreverted = new Map<string, number>();

  async function openAdjustOnToday(): Promise<void> {
    await turnBoardDialog.closeAdjust().catch(() => undefined);
    await todayRows();
    await turnBoardDialog.openAdjust();
  }

  async function saveDelta(staff: string, delta: number): Promise<void> {
    if (delta > 0) await turnBoardDialog.adjustIncrease(staff, delta);
    else await turnBoardDialog.adjustDecrease(staff, -delta);
    await turnBoardDialog.adjustSave(staff);
    unreverted.set(staff, (unreverted.get(staff) ?? 0) + delta);
  }

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('clock staff in and save manual turn deltas');
    await startOnHome();
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
    await turnBoardDialog.cancelSettings().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    const pending = [...unreverted.entries()].filter(([, d]) => d !== 0);
    if (pending.length > 0) {
      await step('Revert leftover turn deltas', async () => {
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
    }
    await turnBoardDialog.close().catch(() => undefined);
    await clockOut(roster);
    await ensurePasscodeGrant();
    await returnToHome();
  });

  it(
    title(
      'VP-1761 TC-01 With staff clocked in, the TURN tab (quick view) is shown',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await startOnHome();
      expect(await turnBoardDialog.hasQuickView(Timeouts.MEDIUM)).toBe(true);
    },
  );

  it(title('VP-1761 TC-02 Only clocked-in staff are on the board', Tag.REGRESSION, Tag.WRITE), async () => {
    const names = (await todayRows()).map((r) => r.staff);
    for (const n of roster) expect(names).toContain(n);
    await turnBoardDialog.close();
    await timeKeepingDialog.open();
    const out: string[] = [];
    for (const n of names) if ((await timeKeepingDialog.columnOf(n)) !== 'available') out.push(n);
    await timeKeepingDialog.close();
    expect(out).toEqual([]);
  });

  it(
    title(
      'VP-1761 TC-03 Check-out removes the staff; re-check-in the same day keeps their turns',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const staff = roster[0] ?? '';
      const before = (await todayRows()).find((r) => r.staff === staff)?.turnCount ?? 0;
      await turnBoardDialog.close();

      await timeKeepingDialog.open();
      await timeKeepingDialog.checkOut(staff);
      await timeKeepingDialog.close();
      expect((await todayRows()).map((r) => r.staff)).not.toContain(staff);
      await turnBoardDialog.close();

      await timeKeepingDialog.open();
      await timeKeepingDialog.checkIn(staff);
      await timeKeepingDialog.close();
      expect((await todayRows()).find((r) => r.staff === staff)?.turnCount).toBe(before);
    },
  );

  it(
    title('VP-1761 TC-04 Quick view lists staff fewest turns first, ranked 1…n', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await startOnHome();
      await turnBoardDialog.openQuickView();
      const rows = await turnBoardDialog.quickViewRows();
      expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
      expect(isNonDecreasing(rows.map((r) => Number.parseFloat(r.turnCountText) || 0))).toBe(true);
      await turnBoardDialog.pressViewTurn();
      expect(await turnBoardDialog.currentDialogParam()).toBe('turn-board');
      await turnBoardDialog.close();
    },
  );

  it(
    title('VP-1761 TC-05 Each board row shows the staff and a total turn count', Tag.REGRESSION, Tag.WRITE),
    async () => {
      const rows = await todayRows();
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.staff).not.toBe('');
        expect(r.turnCountText).toMatch(/^-?\d+(\.\d+)?$/);
      }
    },
  );

  it(
    title(
      'VP-1761 TC-07 Four sorts, default "Fewest turns first", ascending by turns',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await todayRows();
      const options = await turnBoardDialog.sortOptions();
      expect(options).toHaveLength(4);
      expect(options[0]?.selected).toBe(true);
      expect(isNonDecreasing((await turnBoardDialog.rows()).map((r) => r.turnCount))).toBe(true);
      for (const sort of ['countDesc', 'checkinAsc', 'checkinDesc', 'countAsc'] as const) {
        await turnBoardDialog.setSort(sort);
        expect((await turnBoardDialog.rows()).length).toBeGreaterThan(0);
      }
    },
  );

  it(
    title('VP-1761 TC-09 A past day from the picker shows that day independently', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const day = await findPastDayWithRows();
      if (!day) this.skip();
      expect((await turnBoardDialog.rows()).length).toBeGreaterThan(0);
      expect(await turnBoardDialog.dateText()).not.toBe('');
    },
  );

  it(
    title('VP-1761 TC-10 Setting asks for a staff code first', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await todayRows();
      await clearPasscodeGrant();
      await turnBoardDialog.openSettings().catch(() => undefined);
      const prompted = await passcodeDialog.isPrompting(Timeouts.SHORT);
      if (prompted) await passcodeDialog.enter(env.STAFF_PASSCODE, { skipForNext30Min: true });
      await ensurePasscodeGrant();
      expect(prompted).toBe(true);
      expect(await turnBoardDialog.isSettingsOpen(Timeouts.MEDIUM)).toBe(true);
    },
  );

  it(title('VP-1761 TC-11 Service-based OFF locks the decimals switch', Tag.REGRESSION), async () => {
    await todayRows();
    await turnBoardDialog.openSettings();
    await turnBoardDialog.setServiceBased(true);
    await turnBoardDialog.setServiceBased(false);
    const s = await turnBoardDialog.readSettings();
    await turnBoardDialog.cancelSettings();
    expect(s.serviceBased).toBe(false);
    expect(s.decimalEnabled).toBe(false);
  });

  it(
    title('VP-1761 TC-21 Saving +1 then +2 adds up to +3 on the board', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const staff = roster[1] ?? roster[0] ?? '';
      const base = (await todayRows()).find((r) => r.staff === staff)?.turnCount ?? 0;
      try {
        await openAdjustOnToday();
        await saveDelta(staff, 1);
        await saveDelta(staff, 2);
        await turnBoardDialog.closeAdjust();
        expect((await turnBoardDialog.rowFor(staff))?.turnCount).toBe(r2(base + 3));
      } finally {
        await openAdjustOnToday();
        await saveDelta(staff, -3);
        await turnBoardDialog.closeAdjust();
      }
    },
  );

  it(
    title('VP-1761 TC-22 The stepper allows going below zero (negative delta)', Tag.REGRESSION),
    async () => {
      await openAdjustOnToday();
      const staff = roster[0] ?? '';
      const row = await turnBoardDialog.adjustRowFor(staff);
      const start = row?.current ?? 0;
      await turnBoardDialog.adjustDecrease(staff, Math.ceil(start) + 2);
      const after = await turnBoardDialog.adjustRowFor(staff);
      await turnBoardDialog.adjustReset(staff);
      // Sheet: negative allowed. 1.1.x clamps at 0 (TC-TURN-41) — a failure here is that gap.
      expect(after?.value ?? 0).toBeLessThan(0);
    },
  );

  it(
    title('VP-1761 TC-23 Reset clears only the unsaved entry; saved turns stay', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const staff = roster[0] ?? '';
      await openAdjustOnToday();
      const current = (await turnBoardDialog.adjustRowFor(staff))?.current ?? 0;
      await turnBoardDialog.adjustIncrease(staff, 2);
      await turnBoardDialog.adjustReset(staff);
      const row = await turnBoardDialog.adjustRowFor(staff);
      expect(row?.value).toBe(row?.current);
      expect(row?.current).toBe(current);
      expect(row?.saveEnabled).toBe(false);
      await turnBoardDialog.closeAdjust();
      expect((await turnBoardDialog.rowFor(staff))?.turnCount).toBe(current);
    },
  );
});
