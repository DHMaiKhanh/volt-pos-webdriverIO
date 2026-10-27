/**
 * volt-qc port — 15 TURN board cases that CHECK STAFF IN (write: attendance).
 *
 * Source: volt-qc `e2e/tests/15-turn/turn-plan-board.spec.ts` (TURN-B1, B3, B4,
 * B5, B6, B8, B9, B10, B11) and `turn-deep.spec.ts` (TURN-D01, D02). TC
 * catalogue: docs/qc/volt-qc/windows-regression/15-turn.md.
 *
 * Read-only board cases (TURN-B2, B7) live in tests/regression/volt-qc/pos/turn.spec.ts.
 *
 * Data: staff are picked at run time among those OUT now and checked OUT again
 * in `finally` (turnKit `withTurnStaff`). Manual adjustments (B6, D02) are
 * reverted with the opposite delta. No Turn Settings change in this file.
 *
 * Adaptations:
 * - volt-qc B5 / B6 add a Time Tracking record for YESTERDAY; here the past day
 *   is discovered (`findPastDayWithRows`) and a staff who has a closed shift on
 *   it is used — no attendance is back-dated.
 * - volt-qc deletes the Time Tracking rows its clock-ins create; this suite only
 *   checks the staff OUT again (as tests/regression/home/turn-board*.spec.ts).
 * - The 0-turn grey colour (TURN-005) and the "< 6 px nudge is a click" part of
 *   TURN-019 are not asserted (Tailwind classes / sub-6px pointer moves).
 *
 * WRITES ATTENDANCE (+ net-zero manual adjustments). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { appNav } from '../../../../src/components/index.js';
import { turnBoardDialog } from '../../../../src/components/modal/TurnBoardDialog.js';
import { timeKeepingDialog } from '../../../../src/components/modal/TimeKeepingDialog.js';
import { TURN_SORT_LABELS, type TurnSortKey } from '../../../../src/constants/testids.turn.js';
import { VqaTurn } from '../../../../src/constants/testids.voltqc-appt-time-turn.js';
import { goToOrderHistory, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { dismissUpdaterIfPresent } from '../../../../src/helpers/updater.js';
import { settle, waitUntilPath } from '../../../../src/helpers/wait.js';
import { homePage } from '../../../../src/pages/index.js';
import {
  addDays,
  adjustTurn,
  boardListScrolls,
  boardText,
  boardToToday,
  cardTurn,
  clockIn,
  clockInFresh,
  clockOut,
  closeStray,
  dateLabels,
  quickGeometry,
  quickRows,
  readCfg,
  revertAdjust,
  round2,
  todayStart,
  turnOf,
  waitTurn,
  withTurnStaff,
} from '../../../../src/pages/voltqc/appt-time-turn/turnKit.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { findPastDayWithRows, todayRows } from '../../home/turn-board.helpers.js';

const EN_SORTS = (Object.keys(TURN_SORT_LABELS) as TurnSortKey[]).map((k) => TURN_SORT_LABELS[k].en);

/** Board staff order under a sort, the board left back on Fewest + closed. */
async function orderBy(sort: TurnSortKey): Promise<string[]> {
  await turnBoardDialog.open();
  await boardToToday();
  await turnBoardDialog.setSort(sort);
  const names = await turnBoardDialog.staffOrder();
  if (sort !== 'countAsc') await turnBoardDialog.setSort('countAsc');
  await turnBoardDialog.close();
  return names;
}

const isBefore = (names: string[], x: string, y: string): boolean =>
  names.includes(x) && names.includes(y) && names.indexOf(x) < names.indexOf(y);

async function awaitReloadedHome(): Promise<void> {
  await waitUntilPath((p) => p.startsWith('/home'), {
    timeout: Timeouts.APP_BOOT,
    message: 'Reload did not land on /home',
  });
  await dismissUpdaterIfPresent();
  await homePage.waitForReady(Timeouts.APP_BOOT);
}

describe('volt-qc 15 TURN — board with staff clocked in (write)', () => {
  before(async () => {
    await returnToHome();
    await dismissUpdaterIfPresent();
  });

  afterEach(async () => {
    await closeStray().catch(() => undefined);
    await turnBoardDialog.open().catch(() => undefined);
    await boardToToday().catch(() => undefined);
    await turnBoardDialog.setSort('countAsc').catch(() => undefined);
    await turnBoardDialog.close().catch(() => undefined);
  });

  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Board from the sidebar: header, today, Fewest by default, buttons; rows ranked 1..n, ≤ 2 decimals, Turn/Turns label, no VP-1761 legend (TURN-001, TURN-005, TURN-006, TURN-007)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await withTurnStaff(this, 1, async ([s0]) => {
        const sa = s0 ?? '';
        await returnToHome();
        await appNav.openSidebar();
        await turnBoardDialog.pressSidebarEntry();
        await turnBoardDialog.waitOpen();
        await step('TURN-001 header', async () => {
          expect(await turnBoardDialog.currentDialogParam()).toBe('turn-board');
          expect(['Turn', 'Phiên làm việc']).toContain(await turnBoardDialog.titleText());
          expect(dateLabels(todayStart())).toContain(await turnBoardDialog.dateText());
          expect(await turnBoardDialog.sortText()).toContain(TURN_SORT_LABELS.countAsc.en);
          expect(await turnBoardDialog.toolbar()).toEqual({
            date: true,
            sort: true,
            adjust: true,
            setting: true,
          });
        });
        const rows = await turnBoardDialog.rows();
        // TURN-001 the staff just IN is listed; ranks run 1..n
        {
          expect(rows.map((r) => r.staff)).toContain(sa);
          expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
        }
        // TURN-005 at most 2 decimals, no trailing zero
        {
          for (const r of rows) {
            expect(r.turnCountText).toMatch(/^\d+(\.\d{1,2})?$/);
            expect(r.turnCountText).not.toMatch(/\.\d*0$/);
          }
        }
        // TURN-006 "Turn" for exactly 1, "Turns" otherwise
        {
          for (const r of rows) expect(r.unit).toBe(r.turnCount === 1 ? 'Turn' : 'Turns');
        }
        await step('TURN-007 no bars / legend chips / income on the board', async () => {
          const t = await boardText();
          for (const l of VqaTurn.legendLabels) expect(t).not.toContain(l);
          expect(t.match(/\$\d/g) ?? []).toHaveLength(0);
        });
        await turnBoardDialog.close();
      });
    },
  );

  it(
    title(
      'With many staff the list scrolls inside the board and ranks stay continuous (TURN-008)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      const rows = await todayRows();
      if (rows.length < 10) {
        await turnBoardDialog.close();
        this.skip(); // needs ≥ 10 staff IN today
      }
      expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
      expect(await boardListScrolls()).toBe(true);
      await turnBoardDialog.close();
    },
  );

  it(
    title(
      "Today's board = Time Keeping's Available Staff; staff OUT are not on it (TURN-004)",
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(3 * 60_000);
      await withTurnStaff(this, 1, async ([s0]) => {
        const sa = s0 ?? '';
        await timeKeepingDialog.open();
        await timeKeepingDialog.clearSearch();
        const badge = await timeKeepingDialog.columnCount('available');
        const avail = (await timeKeepingDialog.columnCards('available')).map((c) => c.name);
        const unavail = (await timeKeepingDialog.columnCards('unavailable')).map((c) => c.name);
        await timeKeepingDialog.close();
        const names = (await todayRows()).map((r) => r.staff);
        await turnBoardDialog.close();
        expect(names).toContain(sa);
        expect(names.length).toBe(badge);
        if (avail.length === badge) expect(new Set(names)).toEqual(new Set(avail));
        for (const u of unavail) expect(names).not.toContain(u);
      });
    },
  );

  it(
    title(
      'Sort: 4 options, Fewest by default; Fewest / Most by count (ties → earlier check-in first), Earliest / Latest are reverses (TURN-056)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await withTurnStaff(this, 2, async () => {
        await turnBoardDialog.open();
        await boardToToday();
        expect((await turnBoardDialog.sortOptions()).map((o) => o.text)).toEqual(EN_SORTS);
        expect(await turnBoardDialog.sortText()).toContain(TURN_SORT_LABELS.countAsc.en);
        const read = async (k: TurnSortKey): Promise<Awaited<ReturnType<typeof turnBoardDialog.rows>>> => {
          await turnBoardDialog.setSort(k);
          return turnBoardDialog.rows();
        };
        const early = await read('checkinAsc');
        const late = await read('checkinDesc');
        const few = await read('countAsc');
        const most = await read('countDesc');
        expect(late.map((r) => r.staff)).toEqual([...early.map((r) => r.staff)].reverse());
        const pri = new Map(early.map((r, i) => [r.staff, i]));
        const p = (s: string): number => pri.get(s) ?? -1;
        for (let i = 1; i < few.length; i += 1) {
          const a = few[i - 1];
          const b = few[i];
          if (!a || !b) continue;
          expect(a.turnCount < b.turnCount || (a.turnCount === b.turnCount && p(a.staff) < p(b.staff))).toBe(
            true,
          );
        }
        for (let i = 1; i < most.length; i += 1) {
          const a = most[i - 1];
          const b = most[i];
          if (!a || !b) continue;
          expect(a.turnCount > b.turnCount || (a.turnCount === b.turnCount && p(a.staff) < p(b.staff))).toBe(
            true,
          );
        }
        await turnBoardDialog.setSort('countAsc');
        await turnBoardDialog.close();
      });
    },
  );

  it(
    title(
      'Date: tomorrow is disabled; a past day keeps staff whose shift is closed; picking today again shows only staff IN now (TURN-012, TURN-059)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await returnToHome();
      const inNow = (await todayRows()).map((r) => r.staff);
      await step('TURN-059 calendar: today selected, tomorrow disabled, month + year dropdowns', async () => {
        await turnBoardDialog.openDatePicker();
        const days = await turnBoardDialog.calendarDays();
        const iso = (d: Date): string =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const tomorrow = days.find((d) => d.iso === iso(addDays(todayStart(), 1)) && !d.outside);
        if (tomorrow) expect(tomorrow.disabled).toBe(true);
        expect(days.find((d) => d.today)?.selected).toBe(true);
        expect((await turnBoardDialog.datePickerStructure()).dropdowns).toBe(2);
        await turnBoardDialog.closeDatePicker();
      });
      const past = await findPastDayWithRows();
      if (!past) {
        await turnBoardDialog.close();
        this.skip(); // no past day with attendance in the last 3 weeks
      }
      const pastRows = await turnBoardDialog.rows();
      const closed = pastRows.map((r) => r.staff).filter((s) => !inNow.includes(s));
      if (closed.length === 0) {
        await turnBoardDialog.pickDate(todayStart());
        await turnBoardDialog.close();
        this.skip(); // every past-day staff is IN today: a closed shift is not observable
      }
      await step('TURN-012 the past day lists staff who are OUT now (history)', async () => {
        expect(dateLabels(past ?? todayStart())).toContain(await turnBoardDialog.dateText());
        expect(closed.length).toBeGreaterThan(0);
      });
      await step('TURN-059 today again → only staff IN now', async () => {
        await turnBoardDialog.pickDate(todayStart());
        expect(dateLabels(todayStart())).toContain(await turnBoardDialog.dateText());
        const names = await turnBoardDialog.staffOrder();
        for (const c of closed) expect(names).not.toContain(c);
        expect(new Set(names)).toEqual(new Set(inNow));
      });
      await turnBoardDialog.close();
    },
  );

  it(
    title(
      'A manual adjustment saved while the board shows a PAST day lands on TODAY; the past day is unchanged (TURN-073, TURN-074)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      await returnToHome();
      if ((await readCfg()).turnValueCents <= 0) this.skip();
      const inNow = (await todayRows()).map((r) => r.staff);
      const past = await findPastDayWithRows();
      const pastRows = past ? await turnBoardDialog.rows() : [];
      await turnBoardDialog.close();
      const pick = pastRows.find((r) => !inNow.includes(r.staff));
      if (!past || !pick) this.skip(); // needs a past-day staff who is OUT now
      const sa = pick?.staff ?? '';
      const y0 = pick?.turnCount ?? 0;
      let saved = 0;
      await clockIn([sa]);
      try {
        const t0 = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
        await adjustTurn(sa, 1, past ?? undefined);
        saved = 1;
        await step('the past day keeps its count', async () => {
          await turnBoardDialog.open();
          await turnBoardDialog.pickDate(past ?? todayStart());
          expect((await turnBoardDialog.rowFor(sa))?.turnCount).toBe(y0);
          await turnBoardDialog.pickDate(todayStart());
          await turnBoardDialog.close();
        });
        await step('today = before + 1', async () => {
          const t1 = await waitTurn(sa, (x) => x !== null && Math.abs(x - (t0 + 1)) < 0.001, 30_000);
          expect(round2(t1 ?? Number.NaN)).toBe(round2(t0 + 1));
        });
      } finally {
        // Revert from the SAME view, so the opposite delta lands on whatever day the first one did.
        await revertAdjust(sa, saved, past ?? undefined);
        await clockOut([sa]).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Adjust Manual Turn: rows in board order, Current = board, ± not saved, Reset back to Current, X discards (TURN-065, TURN-070, TURN-071)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await withTurnStaff(this, 1, async ([s0]) => {
        const sa = s0 ?? '';
        await turnBoardDialog.open();
        await boardToToday();
        const rows = await turnBoardDialog.rows();
        await turnBoardDialog.openAdjust();
        await step('TURN-065 every row', async () => {
          const adj = await turnBoardDialog.adjustRows();
          expect(adj.map((a) => a.staff)).toEqual(rows.map((r) => r.staff));
          for (const r of rows.slice(0, 6)) {
            const a = adj.find((x) => x.staff === r.staff);
            expect(a?.current).toBe(r.turnCount);
            expect(a?.value).toBe(r.turnCount);
            expect(a?.saveEnabled).toBe(false);
            expect(a?.resetEnabled).toBe(false);
            expect(a?.decreaseEnabled).toBe(r.turnCount > 0);
          }
        });
        const c0 = (await turnBoardDialog.adjustRowFor(sa))?.current ?? 0;
        await step('TURN-070 +2 then Reset → back to Current, Save / Reset off', async () => {
          await turnBoardDialog.adjustIncrease(sa, 2);
          let a = await turnBoardDialog.adjustRowFor(sa);
          expect(a?.value).toBe(round2(c0 + 2));
          expect(a?.saveEnabled).toBe(true);
          expect(a?.resetEnabled).toBe(true);
          await turnBoardDialog.adjustReset(sa);
          a = await turnBoardDialog.adjustRowFor(sa);
          expect(a?.value).toBe(c0);
          expect(a?.saveEnabled).toBe(false);
          expect(a?.resetEnabled).toBe(false);
        });
        await step('TURN-071 +3 then close → board unchanged; reopening shows Current', async () => {
          await turnBoardDialog.adjustIncrease(sa, 3);
          await turnBoardDialog.closeAdjust();
          expect((await turnBoardDialog.rowFor(sa))?.turnCount).toBe(c0);
          await turnBoardDialog.openAdjust();
          const a = await turnBoardDialog.adjustRowFor(sa);
          expect(a?.value).toBe(c0);
          expect(a?.saveEnabled).toBe(false);
          await turnBoardDialog.closeAdjust();
        });
        expect(await P.count(VqaTurn.adjustSavedToast)).toBe(0);
        await turnBoardDialog.close();
      });
    },
  );

  it(
    title(
      'The TURN tab is on /home, /order-pending, /order-history only, docked at the saved edge; outside click / Escape / tab click close it, chevron flips (TURN-015, TURN-018)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await withTurnStaff(this, 1, async () => {
        const stored = await turnBoardDialog.quickViewStoredPosition();
        const side =
          stored !== null && (JSON.parse(stored) as { side?: string }).side === 'right' ? 'right' : 'left';
        await step('TURN-015 tab present on the three operational pages', async () => {
          await returnToHome();
          expect(await turnBoardDialog.hasQuickView(15_000)).toBe(true);
          await P.routerGo('/order-pending');
          expect(await turnBoardDialog.hasQuickView(15_000)).toBe(true);
          await goToOrderHistory();
          expect(await turnBoardDialog.hasQuickView(15_000)).toBe(true);
        });
        await step('TURN-015 no tab elsewhere', async () => {
          for (const route of VqaTurn.noTabRoutes) {
            await P.routerGo(route);
            await settle(1_200);
            expect(await turnBoardDialog.hasQuickView(1_000)).toBe(false);
          }
        });
        await returnToHome();
        await step('TURN-015 docked at the saved edge (default left, mid-height)', async () => {
          expect(await turnBoardDialog.quickViewSide()).toBe(side);
          const g = await quickGeometry();
          if (stored === null && g.tab)
            expect(Math.abs(g.tab.y + g.tab.h / 2 - g.vh / 2)).toBeLessThan(g.vh * 0.2);
        });
        await step('TURN-018 open / close ways and chevron direction', async () => {
          const closedIcon = (await quickGeometry()).chevron;
          expect(closedIcon).toContain(side === 'left' ? 'chevron-right' : 'chevron-left');
          await turnBoardDialog.openQuickView();
          const g = await quickGeometry();
          expect(g.chevron).toContain(side === 'left' ? 'chevron-left' : 'chevron-right');
          await P.clickAt(Math.round(g.vw / 2), Math.round(g.vh - 30));
          expect(
            await P.poll(
              () => turnBoardDialog.isQuickViewPanelOpen(),
              (v) => !v,
              5_000,
            ),
          ).toBe(false);
          await turnBoardDialog.openQuickView();
          await P.escape();
          expect(
            await P.poll(
              () => turnBoardDialog.isQuickViewPanelOpen(),
              (v) => !v,
              5_000,
            ),
          ).toBe(false);
          await turnBoardDialog.openQuickView();
          const tab = (await quickGeometry()).tab;
          if (tab) await P.clickAt(Math.round(tab.x + tab.w / 2), Math.round(tab.y + tab.h / 2));
          expect(
            await P.poll(
              () => turnBoardDialog.isQuickViewPanelOpen(),
              (v) => !v,
              5_000,
            ),
          ).toBe(false);
          expect(await P.path()).toBe('/home');
        });
      });
    },
  );

  it(
    title(
      'Check Out removes the staff from the board, Turn Order and the card turn line; Check In again the same day restores the same count (TURN-010)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      await withTurnStaff(this, 2, async ([s0]) => {
        const sa = s0 ?? '';
        const name = sa;
        const n = await waitTurn(name, (x) => x !== null, 30_000);
        await clockOut([name]);
        expect(await turnOf(name)).toBeNull();
        await returnToHome();
        expect((await quickRows()).map((r) => r.staff)).not.toContain(name);
        expect((await cardTurn(name)).turn).toBeNull();
        await clockIn([name]);
        expect(await waitTurn(name, (x) => x === n, 30_000)).toBe(n);
      });
    },
  );

  it(
    title(
      'Nobody IN: board + Adjust show the empty state and no tab; first Check In shows the tab at once (staff #1); last Check Out removes it (TURN-003, TURN-009, TURN-020)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await returnToHome();
      if ((await readCfg()).turnValueCents <= 0) this.skip();
      const rows = await todayRows();
      if (rows.length > 0) {
        await turnBoardDialog.close();
        this.skip(); // someone is IN today — "nobody IN" cannot be set up without touching them
      }
      await step('TURN-003 empty board + Adjust, no tab', async () => {
        expect(await turnBoardDialog.hasNoStaff()).toBe(true);
        await turnBoardDialog.openAdjust();
        expect(await turnBoardDialog.adjustHasNoStaff()).toBe(true);
        await turnBoardDialog.closeAdjust();
        await turnBoardDialog.close();
        expect(await turnBoardDialog.hasQuickView(2_000)).toBe(false);
      });
      const staff = await clockInFresh(1);
      try {
        const sa = staff[0];
        if (!sa) this.skip();
        await step('TURN-009 tab appears without reload; the staff is #1; View Turn lists them', async () => {
          await returnToHome();
          expect(await turnBoardDialog.hasQuickView(15_000)).toBe(true);
          expect((await quickRows())[0]?.staff).toBe(sa);
          await turnBoardDialog.openQuickView();
          await turnBoardDialog.pressViewTurn();
          expect(await turnBoardDialog.staffOrder()).toContain(sa);
          await turnBoardDialog.close();
        });
        await step('TURN-020 last Check Out → tab gone, board empty', async () => {
          await clockOut(staff);
          await returnToHome();
          expect(
            await P.poll(
              () => turnBoardDialog.hasQuickView(1_000),
              (v) => !v,
              15_000,
            ),
          ).toBe(false);
          await turnBoardDialog.open();
          await boardToToday();
          expect(await turnBoardDialog.hasNoStaff()).toBe(true);
          await turnBoardDialog.close();
        });
      } finally {
        await clockOut(staff).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Dragging the tab: vertical clamp at 10 %, past mid-screen docks right with the popup opening leftwards; board keeps sort + date in the session, Reload resets them and keeps the tab (TURN-019, TURN-058)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await withTurnStaff(this, 1, async () => {
        await returnToHome();
        const original = await turnBoardDialog.quickViewStoredPosition();
        const readPos = async (): Promise<{ side?: string; topPct?: number }> =>
          JSON.parse((await turnBoardDialog.quickViewStoredPosition()) ?? '{}') as {
            side?: string;
            topPct?: number;
          };
        try {
          const side0 = await turnBoardDialog.quickViewSide();
          const g0 = await quickGeometry();
          const xFrac = g0.tab ? (g0.tab.x + g0.tab.w / 2) / g0.vw : 0.02;
          await step('TURN-019 drag up past the header → stops at 10 %, popup stays closed', async () => {
            await turnBoardDialog.dragQuickViewTo(xFrac, 0.02);
            expect(await turnBoardDialog.isQuickViewPanelOpen()).toBe(false);
            expect(await readPos()).toEqual({ side: side0, topPct: 10 });
          });
          await step('TURN-019 drag to the right half → docks right', async () => {
            await turnBoardDialog.dragQuickViewTo(0.75, 0.4);
            expect(await turnBoardDialog.quickViewSide()).toBe('right');
            const pos = await readPos();
            expect(pos.side).toBe('right');
            expect(Math.abs((pos.topPct ?? 0) - 40)).toBeLessThanOrEqual(1);
            expect(await turnBoardDialog.isQuickViewPanelOpen()).toBe(false);
          });
          await step('TURN-019 the popup opens to the LEFT of a right-docked tab', async () => {
            await turnBoardDialog.openQuickView();
            await settle(400);
            const g = await quickGeometry();
            expect(g.pop && g.tab ? g.pop.x + g.pop.w <= g.tab.x + 2 : false).toBe(true);
            await turnBoardDialog.closeQuickView();
          });
          const yesterday = addDays(todayStart(), -1);
          await step('TURN-058 Most turns first + yesterday survive close / reopen', async () => {
            await turnBoardDialog.open();
            await turnBoardDialog.setSort('countDesc');
            await turnBoardDialog.pickDate(yesterday);
            await turnBoardDialog.close();
            await turnBoardDialog.open();
            expect(await turnBoardDialog.sortText()).toContain(TURN_SORT_LABELS.countDesc.en);
            expect(dateLabels(yesterday)).toContain(await turnBoardDialog.dateText());
            await turnBoardDialog.close();
          });
          await step('Reload → TURN-019 tab still right; TURN-058 board back to Fewest + today', async () => {
            await appNav.pressReload();
            await awaitReloadedHome();
            expect(await turnBoardDialog.quickViewSide()).toBe('right');
            await turnBoardDialog.open();
            expect(await turnBoardDialog.sortText()).toContain(TURN_SORT_LABELS.countAsc.en);
            expect(dateLabels(todayStart())).toContain(await turnBoardDialog.dateText());
            await turnBoardDialog.close();
          });
        } finally {
          await closeStray();
          await returnToHome().catch(() => undefined);
          const o = original
            ? (JSON.parse(original) as { side?: string; topPct?: number })
            : { side: 'left', topPct: 50 };
          await turnBoardDialog
            .dragQuickViewTo(o.side === 'right' ? 0.98 : 0.02, (o.topPct ?? 50) / 100)
            .catch(() => undefined);
          await turnBoardDialog.restoreQuickViewStoredPosition(original).catch(() => undefined);
        }
      });
    },
  );

  it(
    title(
      'Tied counts: the staff who checked in FIRST today ranks first (board Fewest + Turn Order), also after Check Out / Check In again; Latest check-in uses the first check-in (TURN-011)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      await withTurnStaff(this, 2, async ([a1, b1]) => {
        const sa = a1 ?? '';
        const sb = b1 ?? '';
        let saved: { staff: string; delta: number } | null = null;
        try {
          const a = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
          const b = (await waitTurn(sb, (x) => x !== null, 30_000)) ?? 0;
          if (a !== b) {
            const diff = round2(Math.abs(a - b));
            if (!Number.isInteger(diff)) this.skip(); // decimal counts cannot be balanced with ±1 steps
            const lo = a < b ? sa : sb;
            await adjustTurn(lo, diff);
            saved = { staff: lo, delta: diff };
            await waitTurn(lo, (x) => x !== null && Math.abs(x - Math.max(a, b)) < 0.011, 30_000);
          }
          await step('tied: SA (checked in first) above SB on the board and in Turn Order', async () => {
            expect(isBefore(await orderBy('countAsc'), sa, sb)).toBe(true);
            await returnToHome();
            expect(
              isBefore(
                (await quickRows()).map((r) => r.staff),
                sa,
                sb,
              ),
            ).toBe(true);
          });
          await step('SA checks out and back in', async () => {
            await clockOut([sa]);
            await waitTurn(sa, (x) => x === null, 30_000);
            await clockIn([sa]);
            await waitTurn(sa, (x) => x !== null, 30_000);
          });
          await step('SA keeps its priority; Latest check-in → SB first; Earliest → SA first', async () => {
            expect(isBefore(await orderBy('countAsc'), sa, sb)).toBe(true);
            await returnToHome();
            expect(
              isBefore(
                (await quickRows()).map((r) => r.staff),
                sa,
                sb,
              ),
            ).toBe(true);
            expect(isBefore(await orderBy('checkinDesc'), sb, sa)).toBe(true);
            expect(isBefore(await orderBy('checkinAsc'), sa, sb)).toBe(true);
          });
        } finally {
          if (saved) await revertAdjust(saved.staff, saved.delta);
        }
      });
    },
  );
});
