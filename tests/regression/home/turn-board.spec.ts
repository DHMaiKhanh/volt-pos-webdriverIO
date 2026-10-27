/**
 * Turn board (part 1) — opening/closing, roster, sort, date picker, quick view.
 *
 * Test cases: docs/screens/turn/turn-test-cases.md — TC-TURN-01..24 and 50..54.
 * Part 2 (turn-board-2.spec.ts) holds Turn Settings and Adjust Manual Turn
 * (TC-TURN-25..49, 55).
 *
 * The board is a DIALOG (`?dialog=turn-board`) mounted on every `_app` route —
 * `turnBoardDialog.open()` sets the search param through the router.
 *
 * ## Data
 *
 * Row-dependent cases check 3 staff IN through Time Keeping (staff who are OUT
 * right now) and check exactly those staff OUT in `after`. The doc's numbers
 * (Angela 4.24, 6 staff on 27/07…) are not asserted — only invariants: order,
 * rank, counts consistent with Time Keeping, state flips.
 *
 * WRITES ATTENDANCE (check in/out). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { appNav } from '../../../src/components/nav/AppNav.js';
import { passcodeDialog } from '../../../src/components/modal/PasscodeDialog.js';
import { timeKeepingDialog } from '../../../src/components/modal/TimeKeepingDialog.js';
import { TURN_QUICK_VIEW_ROUTES, turnBoardDialog } from '../../../src/components/modal/TurnBoardDialog.js';
import { Routes } from '../../../src/constants/routes.js';
import { TURN_SORT_LABELS } from '../../../src/constants/testids.turn.js';
import { returnToHome } from '../../../src/flows/index.js';
import { currentRoutePath, goTo } from '../../../src/helpers/navigate.js';
import { step } from '../../../src/helpers/steps.js';
import { dismissUpdaterIfPresent } from '../../../src/helpers/updater.js';
import { waitUntilPath } from '../../../src/helpers/wait.js';
import { homePage } from '../../../src/pages/index.js';
import { clearPasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  EMPTY_DAY,
  addDays,
  clockInRoster,
  clockOut,
  dateLabels,
  findPastDayWithRows,
  isNonDecreasing,
  isNonIncreasing,
  startOnHome,
  today,
  todayRows,
} from './turn-board.helpers.js';

const TURN_TITLES = ['Turn', 'Phiên làm việc'];
const sortLabels = (key: keyof typeof TURN_SORT_LABELS): string[] => [
  TURN_SORT_LABELS[key].en,
  TURN_SORT_LABELS[key].vi,
];

/** Reset the board's in-memory state (date + sort) to the defaults. */
async function resetBoardState(): Promise<void> {
  await turnBoardDialog.open();
  await turnBoardDialog.closeDatePicker().catch(() => undefined);
  if (!dateLabels(today()).includes(await turnBoardDialog.dateText()))
    await turnBoardDialog.pickDate(today());
  if (!sortLabels('countAsc').includes(await turnBoardDialog.sortText()))
    await turnBoardDialog.setSort('countAsc');
}

async function awaitReloadedHome(): Promise<void> {
  await waitUntilPath((p) => p.startsWith(Routes.HOME), {
    timeout: Timeouts.APP_BOOT,
    message: 'Reload did not land on /home',
  });
  await dismissUpdaterIfPresent();
  await homePage.waitForReady(Timeouts.APP_BOOT);
}

describe('Turn board — dialog, roster, sort, date, quick view', () => {
  /** Staff THIS spec checked in — and must check out. */
  let roster: string[] = [];
  /** Turn value > 0 — the quick view renders only when the feature is on. */
  let turnFeatureOn = true;

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await startOnHome();
    await turnBoardDialog.open();
    await turnBoardDialog.openSettings();
    turnFeatureOn = (await turnBoardDialog.readSettings()).turnValueCents > 0;
    await turnBoardDialog.cancelSettings();
    await turnBoardDialog.close();
  });

  afterEach(async () => {
    await turnBoardDialog.closeQuickView().catch(() => undefined);
    await turnBoardDialog.closeDatePicker().catch(() => undefined);
    await turnBoardDialog.closeAdjust().catch(() => undefined);
    await turnBoardDialog.cancelSettings().catch(() => undefined);
    if (await appNav.isSidebarOpen()) await appNav.closeSidebar();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await returnToHome().catch(() => undefined);
    await resetBoardState().catch(() => undefined);
    await turnBoardDialog.close().catch(() => undefined);
    await clockOut(roster);
    roster = [];
    await returnToHome();
  });

  /* ------------------------------------------------------------------ *
   * Opening / closing
   * ------------------------------------------------------------------ */

  it(title('Open Turn from the sidebar (TC-TURN-01)', Tag.REGRESSION), async () => {
    await startOnHome();
    await appNav.openSidebar();
    await turnBoardDialog.pressSidebarEntry();
    await turnBoardDialog.waitOpen();

    expect(await appNav.isSidebarOpen()).toBe(false);
    expect(await currentRoutePath()).toBe(Routes.HOME);
    expect(await turnBoardDialog.currentDialogParam()).toBe('turn-board');
    expect(TURN_TITLES).toContain(await turnBoardDialog.titleText());
  });

  it(
    title('Deep link ?dialog=turn-board opens the board with no passcode (TC-TURN-02)', Tag.REGRESSION),
    async () => {
      await turnBoardDialog.close();
      await turnBoardDialog.open(Routes.HOME);

      expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION)).toBe(false);
      expect(await turnBoardDialog.toolbar()).toEqual({
        date: true,
        sort: true,
        adjust: true,
        setting: true,
      });
    },
  );

  it(title('Defaults to today and "Fewest turns first" (TC-TURN-03)', Tag.REGRESSION), async () => {
    await turnBoardDialog.open();

    expect(dateLabels(today())).toContain(await turnBoardDialog.dateText());
    expect(sortLabels('countAsc')).toContain(await turnBoardDialog.sortText());
  });

  it(title('Close button closes and drops the search param (TC-TURN-04)', Tag.REGRESSION), async () => {
    await turnBoardDialog.open();
    await turnBoardDialog.closeWithButton();

    expect(await turnBoardDialog.isOpen(Timeouts.ANIMATION)).toBe(false);
    expect(await turnBoardDialog.currentDialogParam()).toBeNull();
    expect(await currentRoutePath()).toBe(Routes.HOME);
  });

  it(title('Escape closes one dialog layer at a time (TC-TURN-05)', Tag.REGRESSION), async () => {
    await turnBoardDialog.open();
    await turnBoardDialog.openAdjust();

    await turnBoardDialog.pressEscape();
    expect(await turnBoardDialog.isAdjustOpen()).toBe(false);
    expect(await turnBoardDialog.isOpen()).toBe(true);
    expect(await turnBoardDialog.currentDialogParam()).toBe('turn-board');

    await turnBoardDialog.pressEscape();
    await turnBoardDialog.waitClosed(Timeouts.SHORT);
    expect(await turnBoardDialog.currentDialogParam()).toBeNull();
    expect(await currentRoutePath()).toBe(Routes.HOME);
  });

  it(
    title('Deep link on a gated route puts the passcode guard on top (TC-TURN-06)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await step('Arm the gate: drop the 30-minute passcode grant', () => clearPasscodeGrant());
        await goTo(Routes.TIME_TRACKING, { search: { dialog: 'turn-board' } });

        expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(true);
        expect(await turnBoardDialog.isRendered()).toBe(true);
        expect(await turnBoardDialog.isToolbarInteractable()).toBe(false);
      } finally {
        // Re-take (and re-capture) the grant so the rest of the lane is not gated.
        await passcodeDialog.unlockForRun(env.OWNER_PASSCODE).catch(() => undefined);
        await turnBoardDialog.close().catch(() => undefined);
        await returnToHome();
      }
    },
  );

  /* ------------------------------------------------------------------ *
   * Roster
   * ------------------------------------------------------------------ */

  it(title('Empty state on a day nobody clocked in (TC-TURN-07)', Tag.REGRESSION), async () => {
    await turnBoardDialog.open();
    await turnBoardDialog.pickDate(EMPTY_DAY);

    expect(await turnBoardDialog.hasNoStaff()).toBe(true);
    expect(await turnBoardDialog.rows()).toHaveLength(0);
    expect(await turnBoardDialog.toolbar()).toEqual({ date: true, sort: true, adjust: true, setting: true });

    await turnBoardDialog.pickDate(today());
  });

  it(
    title('Quick view does not render while today is empty (TC-TURN-51)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      // Runs BEFORE this spec clocks anyone in. If other staff are already in
      // their shift the empty case cannot be produced without clocking out real
      // people, so the contrapositive is checked instead: rows ⇒ tab.
      const rows = await todayRows();
      await turnBoardDialog.close();
      await returnToHome();

      if (rows.length === 0) {
        expect(await turnBoardDialog.hasQuickView(Timeouts.SHORT)).toBe(false);
      } else {
        expect(await turnBoardDialog.hasQuickView(Timeouts.MEDIUM)).toBe(turnFeatureOn);
      }
    },
  );

  it(
    title("Check In puts the staff on today's board (TC-TURN-10)", Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const before = await todayRows();
      await turnBoardDialog.close();

      const [name] = await clockInRoster(1);
      if (name === undefined) throw new Error('No staff was checked in.');
      try {
        const after = await todayRows();
        expect(after.map((r) => r.staff)).toContain(name);
        expect(after).toHaveLength(before.length + 1);
        expect(await turnBoardDialog.hasNoStaff(Timeouts.ANIMATION)).toBe(false);
      } finally {
        await clockOut([name]);
      }
    },
  );

  it(
    title("Check Out takes the staff off today's board (TC-TURN-11)", Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const [name] = await clockInRoster(1);
      if (name === undefined) throw new Error('No staff was checked in.');
      try {
        expect((await todayRows()).map((r) => r.staff)).toContain(name);
        await turnBoardDialog.close();
      } finally {
        await clockOut([name]);
      }

      const after = await todayRows();
      expect(after.map((r) => r.staff)).not.toContain(name);
      if (after.length === 0) expect(await turnBoardDialog.hasNoStaff()).toBe(true);
    },
  );

  describe('with staff clocked in today', () => {
    before(async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await startOnHome();
      roster = await clockInRoster(3);
      await resetBoardState();
    });

    it(
      title('A row shows rank, avatar letter, name and turn count (TC-TURN-08)', Tag.REGRESSION),
      async () => {
        const rows = await todayRows();
        const first = rows[0];
        expect(first).toBeDefined();
        if (!first) return;

        expect(first.rank).toBe(1);
        expect(first.staff.length).toBeGreaterThan(0);
        // A staff with a photo shows no letter; otherwise the nickname's first letter.
        if (first.avatarText !== '')
          expect(first.avatarText.toUpperCase()).toBe(first.staff.charAt(0).toUpperCase());
        expect(first.turnCountText).toMatch(/^\d+(\.\d{1,2})?$/);
        expect(first.unit).toMatch(/^(Turns?|Lượt)$/);
        expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
      },
    );

    it(title('Clicking a row opens nothing (TC-TURN-09)', Tag.REGRESSION), async () => {
      await todayRows();
      const dialogsBefore = await turnBoardDialog.openDialogCount();
      const pathBefore = await currentRoutePath();

      await turnBoardDialog.clickRow(0);

      expect(await turnBoardDialog.openDialogCount()).toBe(dialogsBefore);
      expect(await currentRoutePath()).toBe(pathBefore);
      expect(await turnBoardDialog.currentDialogParam()).toBe('turn-board');
    });

    it(
      title('A past day still lists shifts that are closed (TC-TURN-12)', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        const todayNames = (await todayRows()).map((r) => r.staff);
        const day = await findPastDayWithRows();
        expect(day).not.toBeNull();

        const pastNames = (await turnBoardDialog.rows()).map((r) => r.staff);
        expect(pastNames.length).toBeGreaterThan(0);
        // Their shifts are long closed, yet they are listed — unlike today, where
        // only open shifts appear. At least one of them is not on today's board.
        expect(pastNames.some((n) => !todayNames.includes(n))).toBe(true);

        await turnBoardDialog.pickDate(today());
      },
    );

    it(
      title('The board lists clocked-in staff only, not every staff (TC-TURN-13)', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        const rows = await todayRows();
        await turnBoardDialog.close();

        await timeKeepingDialog.open();
        await timeKeepingDialog.clearSearch();
        const inShift = await timeKeepingDialog.columnCount('available');
        const total = inShift + (await timeKeepingDialog.columnCount('unavailable'));
        await timeKeepingDialog.close();

        for (const name of roster) expect(rows.map((r) => r.staff)).toContain(name);
        // Today's board = open shifts that started TODAY, a subset of "Available".
        expect(rows.length).toBeLessThanOrEqual(inShift);
        expect(rows.length).toBeLessThan(total);
      },
    );

    it(
      title('"Fewest turns first" sorts ascending, ties by check-in (TC-TURN-14)', Tag.REGRESSION),
      async () => {
        await todayRows();
        await turnBoardDialog.setSort('checkinAsc');
        const checkinOrder = await turnBoardDialog.staffOrder();
        await turnBoardDialog.setSort('countAsc');
        const rows = await turnBoardDialog.rows();

        expect(isNonDecreasing(rows.map((r) => r.turnCount))).toBe(true);
        for (let i = 1; i < rows.length; i += 1) {
          const prev = rows[i - 1];
          const cur = rows[i];
          if (prev && cur && prev.turnCount === cur.turnCount) {
            expect(checkinOrder.indexOf(prev.staff)).toBeLessThan(checkinOrder.indexOf(cur.staff));
          }
        }
      },
    );

    it(
      title('"Most turns first" sorts descending and re-ranks from 1 (TC-TURN-15)', Tag.REGRESSION),
      async () => {
        await todayRows();
        await turnBoardDialog.setSort('countDesc');
        const rows = await turnBoardDialog.rows();

        expect(isNonIncreasing(rows.map((r) => r.turnCount))).toBe(true);
        expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
        await turnBoardDialog.setSort('countAsc');
      },
    );

    it(title('"Earliest check-in first" follows check-in order (TC-TURN-16)', Tag.REGRESSION), async () => {
      await todayRows();
      await turnBoardDialog.setSort('checkinAsc');
      const order = await turnBoardDialog.staffOrder();

      // The roster was checked in one after another — that order must hold.
      const positions = roster.map((n) => order.indexOf(n));
      expect(positions.every((p) => p >= 0)).toBe(true);
      expect(isNonDecreasing(positions)).toBe(true);
      await turnBoardDialog.setSort('countAsc');
    });

    it(title('"Latest check-in first" is the exact reverse (TC-TURN-17)', Tag.REGRESSION), async () => {
      await todayRows();
      await turnBoardDialog.setSort('checkinAsc');
      const asc = await turnBoardDialog.staffOrder();
      await turnBoardDialog.setSort('checkinDesc');
      const desc = await turnBoardDialog.staffOrder();

      expect(desc).toEqual([...asc].reverse());
      await turnBoardDialog.setSort('countAsc');
    });

    it(title('The sort dropdown has exactly four options (TC-TURN-18)', Tag.REGRESSION), async () => {
      await turnBoardDialog.open();
      const current = await turnBoardDialog.sortText();
      const options = await turnBoardDialog.sortOptions();

      expect(options).toHaveLength(4);
      const keys = ['countAsc', 'countDesc', 'checkinAsc', 'checkinDesc'] as const;
      keys.forEach((key, i) => expect(sortLabels(key)).toContain(options[i]?.text));
      const selected = options.filter((o) => o.selected);
      expect(selected).toHaveLength(1);
      expect(selected[0]?.text).toBe(current);
    });

    /* ---------------------------------------------------------------- *
     * Quick view (needs someone in shift today — the roster)
     * ---------------------------------------------------------------- */

    it(
      title('Quick view shows on /home, /order-pending, /order-history only (TC-TURN-50)', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        if (!turnFeatureOn) {
          throw new Error(
            'Turn value is $0.00 on this merchant (turn feature off) — the quick view never renders.',
          );
        }
        await turnBoardDialog.close();
        try {
          for (const route of TURN_QUICK_VIEW_ROUTES) {
            await goTo(route);
            expect(await turnBoardDialog.hasQuickView(Timeouts.MEDIUM)).toBe(true);
          }
          await goTo(Routes.TIME_TRACKING);
          await passcodeDialog.unlockForRun(env.OWNER_PASSCODE).catch(() => undefined);
          expect(await turnBoardDialog.hasQuickView(Timeouts.SHORT)).toBe(false);
        } finally {
          await returnToHome();
        }
      },
    );

    it(title("Quick view popover mirrors today's board (TC-TURN-52)", Tag.REGRESSION), async () => {
      if (!turnFeatureOn) throw new Error('Turn feature off (Turn value $0.00) — no quick view.');
      await resetBoardState();
      const board = await turnBoardDialog.rows();
      await turnBoardDialog.close();

      await turnBoardDialog.openQuickView();
      const quick = await turnBoardDialog.quickViewRows();

      expect(await turnBoardDialog.quickViewExpanded()).toBe(true);
      expect(quick.map((r) => r.rank)).toEqual(quick.map((_, i) => i + 1));
      expect([...quick.map((r) => r.staff)].sort()).toEqual([...board.map((r) => r.staff)].sort());
      for (const q of quick) {
        const b = board.find((r) => r.staff === q.staff);
        expect(q.turnCountText).toBe(b?.turnCountText);
      }
    });

    it(
      title('"View Turn" opens the full board and collapses the tab (TC-TURN-53)', Tag.REGRESSION),
      async () => {
        if (!turnFeatureOn) throw new Error('Turn feature off (Turn value $0.00) — no quick view.');
        await turnBoardDialog.close();
        await turnBoardDialog.openQuickView();
        await turnBoardDialog.pressViewTurn();

        expect(await turnBoardDialog.currentDialogParam()).toBe('turn-board');
        expect(await turnBoardDialog.isOpen()).toBe(true);
        expect(await turnBoardDialog.isQuickViewPanelOpen()).toBe(false);
        expect(await turnBoardDialog.quickViewExpanded()).toBe(false);
      },
    );

    it(
      title('Dragging the tab snaps it to an edge and persists the position (TC-TURN-54)', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        if (!turnFeatureOn) throw new Error('Turn feature off (Turn value $0.00) — no quick view.');
        await turnBoardDialog.close();
        await returnToHome();

        const originalRaw = await turnBoardDialog.quickViewStoredPosition();
        const originalSide = await turnBoardDialog.quickViewSide();
        const target = originalSide === 'left' ? 'right' : 'left';
        try {
          await turnBoardDialog.dragQuickViewTo(target === 'right' ? 0.8 : 0.2, 0.5);

          expect(await turnBoardDialog.quickViewSide()).toBe(target);
          const stored = JSON.parse((await turnBoardDialog.quickViewStoredPosition()) ?? '{}') as {
            side?: string;
            topPct?: unknown;
          };
          expect(stored.side).toBe(target);
          expect(typeof stored.topPct).toBe('number');

          await goTo(Routes.ORDER_PENDING);
          expect(await turnBoardDialog.hasQuickView(Timeouts.MEDIUM)).toBe(true);
          expect(await turnBoardDialog.quickViewSide()).toBe(target);
        } finally {
          await returnToHome();
          if (
            (await turnBoardDialog.hasQuickView(Timeouts.SHORT)) &&
            (await turnBoardDialog.quickViewSide()) !== originalSide
          ) {
            await turnBoardDialog.dragQuickViewTo(originalSide === 'right' ? 0.8 : 0.2, 0.5);
          }
          await turnBoardDialog.restoreQuickViewStoredPosition(originalRaw);
        }
      },
    );

    /* ---------------------------------------------------------------- *
     * Date picker
     * ---------------------------------------------------------------- */

    it(title('Date picker structure with today selected (TC-TURN-19)', Tag.REGRESSION), async () => {
      await resetBoardState();
      await turnBoardDialog.openDatePicker();
      const structure = await turnBoardDialog.datePickerStructure();
      const days = await turnBoardDialog.calendarDays();

      expect(structure.dropdowns).toBe(2);
      expect(structure.weekdays).toHaveLength(7);
      expect(structure.gridLabel).toContain(String(today().getFullYear()));
      const todayCell = days.find((d) => d.today);
      expect(todayCell).toBeDefined();
      expect(todayCell?.selected).toBe(true);
      await turnBoardDialog.closeDatePicker();
    });

    it(title('Days after today are disabled (TC-TURN-20)', Tag.REGRESSION), async () => {
      await resetBoardState();
      await turnBoardDialog.openDatePicker();
      const days = await turnBoardDialog.calendarDays();
      const todayIso = days.find((d) => d.today)?.iso ?? '';
      const future = days.filter((d) => d.iso > todayIso);

      for (const d of future) expect(d.disabled).toBe(true);

      const tomorrow = addDays(today(), 1);
      if (tomorrow.getMonth() === today().getMonth()) {
        const clicked = await turnBoardDialog.tryClickDay(tomorrow);
        expect(clicked).toBe(false);
      }
      await turnBoardDialog.closeDatePicker();
      expect(dateLabels(today())).toContain(await turnBoardDialog.dateText());
    });

    it(title('The year dropdown runs from 1970 to this year (TC-TURN-21)', Tag.REGRESSION), async () => {
      await resetBoardState();
      await turnBoardDialog.openDatePicker();
      const years = (await turnBoardDialog.calendarDropdownOptions(1)).map((o) =>
        Number.parseInt(o.text, 10),
      );
      await turnBoardDialog.closeDatePicker();

      const thisYear = today().getFullYear();
      expect(years[0]).toBe(1970);
      expect(years[years.length - 1]).toBe(thisYear);
      expect(years.every((y) => y <= thisYear)).toBe(true);
    });

    it(
      title('Changing month then picking a past day reloads the board (TC-TURN-22)', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        await resetBoardState();
        const todayList = await turnBoardDialog.rows();
        // A day in an EARLIER month exercises the month dropdown.
        const pastDay = new Date(today().getFullYear(), today().getMonth() - 1, 15);
        await turnBoardDialog.pickDate(pastDay);

        expect(await turnBoardDialog.isDatePickerOpen()).toBe(false);
        expect(dateLabels(pastDay)).toContain(await turnBoardDialog.dateText());
        const pastList = await turnBoardDialog.rows();
        // Today's roster is in an OPEN shift started today — it cannot all be on a past day's board.
        const sameAsToday =
          pastList.length === todayList.length && pastList.every((r, i) => r.staff === todayList[i]?.staff);
        expect(sameAsToday).toBe(false);

        await turnBoardDialog.pickDate(today());
      },
    );

    it(
      title('Date and sort survive closing and reopening the dialog (TC-TURN-23)', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        await resetBoardState();
        const pastDay = addDays(today(), -3);
        await turnBoardDialog.pickDate(pastDay);
        await turnBoardDialog.setSort('countDesc');
        await turnBoardDialog.closeWithButton();

        await appNav.openSidebar();
        await turnBoardDialog.pressSidebarEntry();
        await turnBoardDialog.waitOpen();

        expect(dateLabels(pastDay)).toContain(await turnBoardDialog.dateText());
        expect(sortLabels('countDesc')).toContain(await turnBoardDialog.sortText());
        await resetBoardState();
      },
    );

    it(
      title('Reloading the app resets date and sort (TC-TURN-24)', Tag.REGRESSION, Tag.SLOW),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        await resetBoardState();
        await turnBoardDialog.pickDate(addDays(today(), -3));
        await turnBoardDialog.setSort('countDesc');
        await turnBoardDialog.close();

        await appNav.pressReload();
        await awaitReloadedHome();
        await turnBoardDialog.open(Routes.HOME);

        expect(dateLabels(today())).toContain(await turnBoardDialog.dateText());
        expect(sortLabels('countAsc')).toContain(await turnBoardDialog.sortText());
      },
    );
  });
});
