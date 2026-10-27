/**
 * volt-qc port — 15 TURN: Adjust Manual Turn with SAVE, Busy / Available, Turn
 * Order and the Home staff card / Turn Count sort.
 *
 * Source: volt-qc `e2e/tests/15-turn/turn-plan-adjust.spec.ts` (TURN-A1..A3) and
 * `turn-plan-home.spec.ts` (TURN-H1..H3); TURN-069 written from the TC row.
 * TC catalogue: docs/qc/volt-qc/windows-regression/15-turn.md.
 *
 * Data: fresh staff are checked IN and OUT again (turnKit `withTurnStaff`);
 * every saved manual adjustment is reverted with the opposite delta in
 * `finally`; drafts are deleted, pending Quick Pay orders are deleted from
 * /order-pending. Turn Settings are never changed here (volt-qc A2 switches to
 * the integer mode; this port skips A2 when the staff's count is fractional).
 *
 * WRITES ATTENDANCE, NET-ZERO ADJUSTMENTS AND DRAFT ORDERS. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { turnBoardDialog } from '../../../../src/components/modal/TurnBoardDialog.js';
import { timeKeepingDialog } from '../../../../src/components/modal/TimeKeepingDialog.js';
import { VqaTurn } from '../../../../src/constants/testids.voltqc-appt-time-turn.js';
import { VqcHome } from '../../../../src/constants/testids.voltqc-pos.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { homePage, orderPendingPage } from '../../../../src/pages/index.js';
import {
  adjustToastShown,
  adjustTurn,
  boardToToday,
  buildDraft,
  cardTurn,
  closeStray,
  pickStaff,
  quickOf,
  quickRows,
  revertAdjust,
  round2,
  turnOf,
  voidDraft,
  waitTurn,
  withTurnStaff,
} from '../../../../src/pages/voltqc/appt-time-turn/turnKit.js';
import { openStaffSort, visibleStaffNames } from '../../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const statusOf = async (staff: string): Promise<string> => (await quickOf(staff))?.status ?? '';

describe('volt-qc 15 TURN — Adjust (saved) and Busy / Available (write)', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await closeStray().catch(() => undefined);
    await voidDraft().catch(() => undefined);
  });

  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      '+2 then Save: Current updates, Save / Reset off; board, Turn Order and card add 2; a second adjustment starts at Current and accumulates (TURN-066, TURN-067)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await withTurnStaff(this, 1, async ([s]) => {
        const sa = s ?? '';
        let saved = 0;
        try {
          const n0 = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
          await step('TURN-066 +2 → Save', async () => {
            await turnBoardDialog.open();
            await boardToToday();
            await turnBoardDialog.openAdjust();
            await turnBoardDialog.adjustIncrease(sa, 2);
            const pending = await turnBoardDialog.adjustRowFor(sa);
            expect(pending?.value).toBe(round2(n0 + 2));
            expect(pending?.saveEnabled).toBe(true);
            await turnBoardDialog.adjustSave(sa);
            saved += 2;
            expect(await adjustToastShown()).toBe(true);
            const after = await P.poll(
              () => turnBoardDialog.adjustRowFor(sa),
              (r) => r?.current === round2(n0 + 2),
              15_000,
            );
            expect(after?.current).toBe(round2(n0 + 2));
            expect(after?.saveEnabled).toBe(false);
            expect(after?.resetEnabled).toBe(false);
            await turnBoardDialog.closeAdjust();
            await turnBoardDialog.close();
            expect(await waitTurn(sa, (x) => x === round2(n0 + 2), 30_000)).toBe(round2(n0 + 2));
            await returnToHome();
            expect((await quickOf(sa))?.count).toBe(round2(n0 + 2));
            expect((await cardTurn(sa)).turn?.count).toBe(round2(n0 + 2));
          });
          await step('TURN-067 reopen: the stepper starts at Current; +1 → total +3', async () => {
            await turnBoardDialog.open();
            await boardToToday();
            await turnBoardDialog.openAdjust();
            expect((await turnBoardDialog.adjustRowFor(sa))?.value).toBe(round2(n0 + 2));
            await turnBoardDialog.closeAdjust();
            await turnBoardDialog.close();
            await adjustTurn(sa, 1);
            saved += 1;
            expect(await waitTurn(sa, (x) => x === round2(n0 + 3), 30_000)).toBe(round2(n0 + 3));
          });
        } finally {
          await revertAdjust(sa, saved);
        }
      });
    },
  );

  it(
    title(
      'No negative turns: − is disabled at 0; saving 0 shows 0 on the board, never a negative (TURN-068)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await withTurnStaff(this, 1, async ([s]) => {
        const sa = s ?? '';
        let saved = 0;
        try {
          let n = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
          if (!Number.isInteger(n)) this.skip(); // fractional count: ±1 steps cannot be undone exactly
          if (n === 0) {
            await adjustTurn(sa, 1);
            saved += 1;
            n = (await waitTurn(sa, (x) => x === 1, 30_000)) ?? 0;
          }
          await turnBoardDialog.open();
          await boardToToday();
          await turnBoardDialog.openAdjust();
          await turnBoardDialog.adjustDecrease(sa, n + 1); // one extra press: must clamp at 0
          const row = await turnBoardDialog.adjustRowFor(sa);
          expect(row?.value).toBe(0);
          expect(row?.decreaseEnabled).toBe(false);
          await turnBoardDialog.adjustSave(sa);
          saved -= n;
          await turnBoardDialog.closeAdjust();
          await turnBoardDialog.close();
          expect(await waitTurn(sa, (x) => x === 0, 30_000)).toBe(0);
          await turnBoardDialog.open();
          await boardToToday();
          const r = await turnBoardDialog.rowFor(sa);
          await turnBoardDialog.close();
          expect(r?.turnCountText).toBe('0');
        } finally {
          await revertAdjust(sa, saved);
        }
      });
    },
  );

  it(
    title(
      'Save is per row: saving SA does not save the pending value on SB; the adjusted count drives the order on board, Turn Order and card (TURN-072, TURN-075)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      await withTurnStaff(this, 2, async ([s1, s2]) => {
        const sa = s1 ?? '';
        const sb = s2 ?? '';
        let saved = 0;
        try {
          const a0 = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
          const b0 = (await waitTurn(sb, (x) => x !== null, 30_000)) ?? 0;
          const k = Math.max(1, Math.ceil(b0 - a0 + 1)); // SA ends above SB
          await step('TURN-072 step both rows, Save only SA', async () => {
            await turnBoardDialog.open();
            await boardToToday();
            await turnBoardDialog.openAdjust();
            await turnBoardDialog.adjustIncrease(sa, k);
            await turnBoardDialog.adjustIncrease(sb, 1);
            await turnBoardDialog.adjustSave(sa);
            saved = k;
            await turnBoardDialog.closeAdjust();
            await turnBoardDialog.close();
            const a1 = await waitTurn(sa, (x) => x !== null && Math.abs(x - (a0 + k)) < 0.011, 30_000);
            expect(Math.abs((a1 ?? Number.NaN) - (a0 + k))).toBeLessThan(0.011);
            expect(await turnOf(sb)).toBe(b0);
          });
          await step(
            'TURN-075 Fewest: SB above SA on the board and in Turn Order; the card shows the new count',
            async () => {
              await turnBoardDialog.open();
              await boardToToday();
              const rows = await turnBoardDialog.rows();
              await turnBoardDialog.close();
              const names = rows.map((r) => r.staff);
              expect(names.indexOf(sb)).toBeLessThan(names.indexOf(sa));
              await returnToHome();
              const q = (await quickRows()).map((r) => r.staff);
              expect(q.indexOf(sb)).toBeLessThan(q.indexOf(sa));
              expect((await cardTurn(sa)).turn?.count).toBe(rows.find((r) => r.staff === sa)?.turnCount);
            },
          );
        } finally {
          await revertAdjust(sa, saved);
        }
      });
    },
  );

  it(
    title(
      'Decimal counts: ±1 keeps the fraction; stepping below 1 clamps to 0 (not saved) (TURN-069)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      await turnBoardDialog.open();
      await boardToToday();
      await turnBoardDialog.openAdjust();
      const rows = await turnBoardDialog.adjustRows();
      const frac = rows.find((r) => !Number.isInteger(r.current));
      if (!frac) {
        await closeStray();
        this.skip(); // nobody IN today has a fractional count (decimal mode + odd prices)
      }
      const name = frac?.staff ?? '';
      const cur = frac?.current ?? 0;
      await turnBoardDialog.adjustIncrease(name, 1);
      expect((await turnBoardDialog.adjustRowFor(name))?.value).toBe(round2(cur + 1));
      await turnBoardDialog.adjustDecrease(name, 1);
      expect((await turnBoardDialog.adjustRowFor(name))?.value).toBe(cur);
      await turnBoardDialog.adjustDecrease(name, Math.ceil(cur));
      const low = await turnBoardDialog.adjustRowFor(name);
      expect(low?.value).toBe(0);
      expect(low?.decreaseEnabled).toBe(false);
      await turnBoardDialog.adjustReset(name);
      await turnBoardDialog.closeAdjust();
      await turnBoardDialog.close();
    },
  );

  it(
    title(
      'Card of a staff IN = "<count> | Available" = board (no VP-1761 L/C line); OUT staff have no turn line; picking the staff makes them Busy; a pending order off Home keeps them Busy; deleting it frees them (TURN-021, TURN-023, TURN-024, TURN-028, TURN-080)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      await withTurnStaff(this, 2, async ([s]) => {
        const sa = s ?? '';
        const n = await waitTurn(sa, (x) => x !== null, 30_000);
        await returnToHome();
        await step('TURN-028 / TURN-080 card of a staff IN', async () => {
          const c = await cardTurn(sa);
          expect(c.turn).toEqual({ count: n, status: 'Available' });
          expect(c.text).not.toMatch(/\bL = \$|\bC = \d/);
        });
        await step('TURN-028 card of a staff OUT has no turn line', async () => {
          await timeKeepingDialog.open();
          await timeKeepingDialog.clearSearch();
          const out = (await timeKeepingDialog.columnCards('unavailable')).find(
            (c) => c.name !== '' && !c.disabled,
          )?.name;
          await timeKeepingDialog.close();
          if (out) expect((await cardTurn(out)).turn).toBeNull();
        });
        await step('TURN-021 staff on a draft with no service yet → Busy (Turn Order + card)', async () => {
          await voidDraft();
          await pickStaff(sa);
          expect(await homePage.hasActiveDraft()).toBe(true);
          expect(
            await P.poll(
              () => statusOf(sa),
              (v) => v === 'Busy',
              20_000,
            ),
          ).toBe('Busy');
          expect((await cardTurn(sa)).turn?.status).toBe('Busy');
          await homePage.deleteOrder();
          expect(
            await P.poll(
              () => statusOf(sa),
              (v) => v === 'Available',
              20_000,
            ),
          ).toBe('Available');
        });
        let code = '';
        await step('TURN-024 pending order off Home → still Busy on /order-pending', async () => {
          code = await buildDraft([{ staff: sa, amounts: [1000] }]);
          expect(code).not.toBe('');
          await P.routerGo('/order-pending');
          expect(
            await P.poll(
              () => orderPendingPage.isOrderListed(code),
              (v) => v,
              15_000,
            ),
          ).toBe(true);
          expect(
            await P.poll(
              () => statusOf(sa),
              (v) => v === 'Busy',
              30_000,
            ),
          ).toBe('Busy');
        });
        await step('TURN-023 delete the pending order → Available', async () => {
          await orderPendingPage.openOrder(code);
          await homePage.waitForReady();
          await homePage.deleteOrder();
          await returnToHome();
          expect(
            await P.poll(
              () => statusOf(sa),
              (v) => v === 'Available',
              30_000,
            ),
          ).toBe('Available');
        });
      });
    },
  );

  it(
    title(
      'Turn Order: ranks, chips, fewest first whatever the board sort, ties → earlier check-in; View Turn opens the board (TURN-016, TURN-017)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      await withTurnStaff(this, 2, async ([s1, s2]) => {
        const sa = s1 ?? '';
        const sb = s2 ?? '';
        let saved = 0;
        try {
          const b = (await waitTurn(sb, (x) => x !== null, 30_000)) ?? 0;
          const a = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
          const need = Math.max(1, Math.ceil(b - a + 1));
          await adjustTurn(sa, need);
          saved = need;
          await waitTurn(sa, (x) => x !== null && x > b, 30_000);
          await turnBoardDialog.open();
          await boardToToday();
          await turnBoardDialog.setSort('checkinAsc');
          const early = await turnBoardDialog.staffOrder();
          await turnBoardDialog.setSort('countDesc'); // the quick view must ignore the board sort
          await turnBoardDialog.close();
          await buildDraft([{ staff: sb, amounts: [1000] }]); // SB Busy
          const rows = await P.poll(
            quickRows,
            (r) => r.find((x) => x.staff === sb)?.status === 'Busy',
            20_000,
          );
          expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
          for (let i = 1; i < rows.length; i += 1) {
            const x = rows[i - 1];
            const y = rows[i];
            if (!x || !y) continue;
            expect(
              x.count < y.count || (x.count === y.count && early.indexOf(x.staff) < early.indexOf(y.staff)),
            ).toBe(true);
          }
          const ra = rows.find((r) => r.staff === sa);
          const rb = rows.find((r) => r.staff === sb);
          expect((rb?.rank ?? 99) < (ra?.rank ?? 0)).toBe(true);
          expect(rb?.status).toBe('Busy');
          expect(['Available', 'Busy']).toContain(ra?.status);
          await turnBoardDialog.openQuickView();
          await turnBoardDialog.pressViewTurn();
          expect(await turnBoardDialog.isQuickViewPanelOpen()).toBe(false);
          expect(await turnBoardDialog.currentDialogParam()).toBe('turn-board');
          await turnBoardDialog.setSort('countAsc');
          await turnBoardDialog.close();
        } finally {
          await closeStray();
          await voidDraft().catch(() => undefined);
          await turnBoardDialog.open().catch(() => undefined);
          await turnBoardDialog.setSort('countAsc').catch(() => undefined);
          await turnBoardDialog.close().catch(() => undefined);
          await revertAdjust(sa, saved);
        }
      });
    },
  );

  it(
    title(
      'Home › Sort Turn Count: staff IN come first in board order (Ascending); Descending reverses inside the IN group only (TURN-078, TURN-079)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await withTurnStaff(this, 2, async () => {
        await turnBoardDialog.open();
        await boardToToday();
        await turnBoardDialog.setSort('countAsc');
        const few = await turnBoardDialog.rows();
        await turnBoardDialog.close();
        const fewNames = few.map((r) => r.staff);
        const countOf = new Map(few.map((r) => [r.staff, r.turnCount]));
        await returnToHome();
        await homePage.searchStaff('');
        await openStaffSort();
        const pick = async (label: string): Promise<void> => {
          await P.clickQ([VqcHome.sortPopover, { text: label, nth: 0 }]);
          await settle(1_200);
        };
        try {
          await pick(VqaTurn.homeSort.turnCount);
          await pick(VqaTurn.homeSort.ascending);
          const asc = await visibleStaffNames();
          if (asc.length < fewNames.length) this.skip(); // the grid renders fewer cards than staff IN
          expect(asc.slice(0, fewNames.length)).toEqual(fewNames);
          await pick(VqaTurn.homeSort.descending);
          const desc = (await visibleStaffNames()).slice(0, fewNames.length);
          expect(new Set(desc)).toEqual(new Set(fewNames));
          const counts = desc.map((s) => countOf.get(s) ?? 0);
          expect(counts.every((c, i) => i === 0 || (counts[i - 1] ?? c) >= c)).toBe(true);
        } finally {
          if (await P.has(VqcHome.sortPopover))
            await pick(VqaTurn.homeSort.defaultOrder).catch(() => undefined);
          await P.escape();
        }
      });
    },
  );
});
