/**
 * volt-qc port — 15 TURN turn-count formulas (orders paid, Turn Settings switched).
 *
 * Source: volt-qc `e2e/tests/15-turn/turn-plan-count.spec.ts` (TURN-C1..C6, C8..C11)
 * and `turn-deep.spec.ts` (TURN-D05); TURN-036 / 064 / 054 / 055 written from the
 * TC rows. TC catalogue: docs/qc/volt-qc/windows-regression/15-turn.md.
 *
 * Every case sets the configuration it needs (decimal / integer-per-service /
 * per-order, with a Turn value) through board › Setting and RESTORES the
 * original in `finally` — Turn Settings are merchant-global, hence
 * `Tag.EXCLUSIVE`. Orders are Quick Pay lines on a freshly clocked-in staff,
 * paid with "Other" (Zelle) or Cash; assertions are on the staff's turn DELTA
 * (the staff may already have turns today). Manual adjustments are reverted.
 *
 * Not ported (manual pack, tests/regression/volt-qc/_manual/): volt-qc C7 (split —
 * the Split screen blocks leaving until every check is paid, so the mid-way
 * state cannot be read), the order-level promo / tip cases (no page-object
 * path here) and the refund cases.
 *
 * WRITES ORDERS, ATTENDANCE, MANUAL ADJUSTMENTS AND TURN SETTINGS. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { appNav } from '../../../../src/components/index.js';
import { timeKeepingDialog } from '../../../../src/components/modal/TimeKeepingDialog.js';
import { turnBoardDialog } from '../../../../src/components/modal/TurnBoardDialog.js';
import { VqcTurn } from '../../../../src/constants/testids.voltqc-pos.js';
import { goToSettings, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { homePage, settingsPage } from '../../../../src/pages/index.js';
import {
  CFG_D,
  CFG_O,
  CFG_S,
  type TurnCfg,
  adjustTurn,
  boardToToday,
  buildDraft,
  cardTurn,
  clockIn,
  clockOut,
  closeStray,
  expectedDelta,
  paidOrder,
  payDraft,
  pickStaff,
  quickOf,
  quickRows,
  readCfg,
  revertAdjust,
  round2,
  saveCfg,
  sameCfg,
  todayStart,
  turnOf,
  voidDraft,
  voidPaidOrder,
  waitTurn,
  withCfg,
  withTurnStaff,
} from '../../../../src/pages/voltqc/appt-time-turn/turnKit.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { formatMoney } from '../../../../src/utils/money.js';
import { findPastDayWithRows } from '../../home/turn-board.helpers.js';
import {
  goToReopenEditor,
  leaveReopenCheckout,
  openOrderDetail,
  reopenOrder,
} from '../../order-flow/reopen-flow.helpers.js';

const T = 12 * 60_000;

/** Turn before, run `act`, wait for the change, assert the delta of `added` under `cfg`. */
async function deltaAfter(
  cfg: TurnCfg,
  staff: string,
  added: number[][],
  act: () => Promise<unknown>,
): Promise<{ before: number; after: number }> {
  const before = (await waitTurn(staff, (x) => x !== null, 30_000)) ?? 0;
  await act();
  const { delta, tolerance } = expectedDelta(cfg, before, added);
  const after =
    (await waitTurn(staff, (x) => x !== null && (delta === 0 || Math.abs(x - before) > 0.001), 90_000)) ??
    Number.NaN;
  expect(Math.abs(after - before - delta)).toBeLessThanOrEqual(tolerance);
  return { before, after };
}

const statusOf = async (staff: string): Promise<string> => (await quickOf(staff))?.status ?? '';

/** Today's board count of a staff read WITHOUT dropping the current search (keeps `?editOrderId`). */
async function turnKeepingSearch(staff: string): Promise<number | null> {
  const search = await P.routerSearch();
  await P.routerGo(await P.path(), { ...search, dialog: 'turn-board' });
  await turnBoardDialog.waitOpen();
  await boardToToday();
  const row = await turnBoardDialog.rowFor(staff);
  await P.escape();
  await settle(500);
  return row ? row.turnCount : null;
}

describe('volt-qc 15 TURN — turn-count formulas (write, settings)', () => {
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
      'Decimal $30: a pending order makes the staff Busy without turns; paying (Other) frees them and adds 1; 2 × $20 adds 1.33 (TURN-022, TURN-029)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(T);
      const cfg = CFG_D(3000);
      await withCfg(this, cfg, () =>
        withTurnStaff(this, 1, async ([s]) => {
          const sa = s ?? '';
          await step('TURN-022 pending → Busy, no turn; paid → Available, +1', async () => {
            const n0 = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
            await buildDraft([{ staff: sa, amounts: [3000] }]);
            expect(
              await P.poll(
                () => statusOf(sa),
                (v) => v === 'Busy',
                20_000,
              ),
            ).toBe('Busy');
            expect(await turnOf(sa)).toBe(n0);
            await payDraft('other');
            const n1 = (await waitTurn(sa, (x) => x !== null && x !== n0)) ?? Number.NaN;
            const { delta, tolerance } = expectedDelta(cfg, n0, [[3000]]);
            expect(Math.abs(n1 - n0 - delta)).toBeLessThanOrEqual(tolerance);
            expect(
              await P.poll(
                () => statusOf(sa),
                (v) => v === 'Available',
                20_000,
              ),
            ).toBe('Available');
          });
          await step('TURN-029 2 × $20 / $30 = 1.33', async () => {
            await deltaAfter(cfg, sa, [[2000, 2000]], () =>
              paidOrder([{ staff: sa, amounts: [2000, 2000] }]),
            );
          });
        }),
      );
    },
  );

  it(
    title(
      'Decimal $30: three $10 orders round on the DAY total (0.33 → 0.67 → 1); no minimum ($27 → +0.9 each) (TURN-030, TURN-031)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(T);
      await withCfg(this, CFG_D(3000), () =>
        withTurnStaff(this, 1, async ([s]) => {
          const sa = s ?? '';
          const start = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
          const base = start * 3000;
          await step('TURN-030 3 × $10', async () => {
            for (let i = 1; i <= 3; i += 1) {
              const prev = (await turnOf(sa)) ?? 0;
              await paidOrder([{ staff: sa, amounts: [1000] }]);
              const n = (await waitTurn(sa, (x) => x !== null && x !== prev)) ?? Number.NaN;
              if (start === 0) expect(n).toBe([0.33, 0.67, 1][i - 1]);
              else expect(Math.abs(n - round2((base + 1000 * i) / 3000))).toBeLessThanOrEqual(0.011);
            }
          });
          await step('TURN-031 2 × $27 (separate orders)', async () => {
            const s0 = (await turnOf(sa)) ?? 0;
            for (let i = 1; i <= 2; i += 1) {
              const prev = (await turnOf(sa)) ?? 0;
              await paidOrder([{ staff: sa, amounts: [2700] }]);
              const n = (await waitTurn(sa, (x) => x !== null && x !== prev)) ?? Number.NaN;
              expect(Math.abs(n - s0 - 0.9 * i)).toBeLessThanOrEqual(0.011);
            }
          });
        }),
      );
    },
  );

  it(
    title(
      'Integer per service $25: only services ≥ $25 count (= $25 included); a $50 service is still 1 turn; orders add up (TURN-032, TURN-033)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(T);
      const cfg = CFG_S(2500);
      await withCfg(this, cfg, () =>
        withTurnStaff(this, 1, async ([s]) => {
          const sa = s ?? '';
          await step('TURN-032 one order $30 + $25 + $60 + $24.99 → +3', async () => {
            await deltaAfter(cfg, sa, [[3000, 2500, 6000, 2499]], () =>
              paidOrder([{ staff: sa, amounts: [3000, 2500, 6000, 2499] }]),
            );
          });
          await step('TURN-033 $50 order (+1) then $25 order (+1)', async () => {
            await deltaAfter(cfg, sa, [[5000]], () => paidOrder([{ staff: sa, amounts: [5000] }]));
            await deltaAfter(cfg, sa, [[2500]], () => paidOrder([{ staff: sa, amounts: [2500] }]));
          });
          expect(Number.isInteger(await turnOf(sa))).toBe(true);
        }),
      );
    },
  );

  it(
    title(
      'Per order (service-based OFF, $100): every paid order is 1 turn whatever its price or line count (TURN-034)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(T);
      const cfg = CFG_O(10000);
      await withCfg(this, cfg, () =>
        withTurnStaff(this, 1, async ([s]) => {
          const sa = s ?? '';
          await deltaAfter(cfg, sa, [[1000]], () => paidOrder([{ staff: sa, amounts: [1000] }]));
          await deltaAfter(cfg, sa, [[5000, 5000, 5000]], () =>
            paidOrder([{ staff: sa, amounts: [5000, 5000, 5000] }]),
          );
        }),
      );
    },
  );

  it(
    title(
      'Turns use the line service price: an item discount does not reduce them; Cash counts like Other; an edited line price counts at the new price (TURN-038, TURN-039, TURN-040)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(T);
      const cfg = CFG_D(3000);
      await withCfg(this, cfg, () =>
        withTurnStaff(this, 1, async ([s]) => {
          const sa = s ?? '';
          await step('TURN-038 $30 Quick Pay with a 30 % item discount → still +1', async () => {
            await deltaAfter(cfg, sa, [[3000]], async () => {
              await voidDraft();
              await pickStaff(sa);
              await homePage.openQuickPay();
              await homePage.fillQuickPayAmount(3000);
              await homePage.fillQuickPayName('QA turn 30 disc');
              await homePage.applyQuickPayDiscount('%', '30');
              await homePage.submitQuickPay();
              await settle(800);
              await payDraft('other');
            });
          });
          await step('TURN-039 the same $30 paid in Cash → +1', async () => {
            await deltaAfter(cfg, sa, [[3000]], () => paidOrder([{ staff: sa, amounts: [3000] }], 'cash'));
          });
          await step('TURN-040 a service line re-priced to $15 → +0.5', async () => {
            await deltaAfter(cfg, sa, [[1500]], async () => {
              await voidDraft();
              await pickStaff(sa);
              await homePage.addServiceByIndex(0);
              await homePage.openServiceEditor();
              await homePage.setServiceEditorPrice(1500);
              await homePage.saveServiceEditor();
              await payDraft('other');
            });
          });
        }),
      );
    },
  );

  it(
    title(
      'Two-staff order: each staff counts their own services; the order re-sorts on Fewest; board, Turn Order and card agree (TURN-043, TURN-054, TURN-057)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(T);
      const cfg = CFG_D(3000);
      await withCfg(this, cfg, () =>
        withTurnStaff(this, 2, async ([s1, s2]) => {
          const sa = s1 ?? '';
          const sb = s2 ?? '';
          const a0 = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
          const b0 = (await waitTurn(sb, (x) => x !== null, 30_000)) ?? 0;
          await paidOrder([
            { staff: sa, amounts: [3000] },
            { staff: sb, amounts: [1500] },
          ]);
          const a1 = (await waitTurn(sa, (x) => x !== null && x !== a0)) ?? Number.NaN;
          const b1 = (await waitTurn(sb, (x) => x !== null && x !== b0)) ?? Number.NaN;
          // TURN-043 each staff gets their own share
          const da = expectedDelta(cfg, a0, [[3000]]);
          const db = expectedDelta(cfg, b0, [[1500]]);
          expect(Math.abs(a1 - a0 - da.delta)).toBeLessThanOrEqual(da.tolerance);
          expect(Math.abs(b1 - b0 - db.delta)).toBeLessThanOrEqual(db.tolerance);
          await step('TURN-057 SB pays $60 more → Fewest order follows the new counts', async () => {
            await paidOrder([{ staff: sb, amounts: [6000] }]);
            const b2 = (await waitTurn(sb, (x) => x !== null && x !== b1)) ?? Number.NaN;
            const d = expectedDelta(cfg, b1, [[6000]]);
            expect(Math.abs(b2 - b1 - d.delta)).toBeLessThanOrEqual(d.tolerance);
            await turnBoardDialog.open();
            await boardToToday();
            const rows = await turnBoardDialog.rows();
            await turnBoardDialog.close();
            for (let i = 1; i < rows.length; i += 1) {
              expect(rows[i - 1]?.turnCount ?? 0).toBeLessThanOrEqual(rows[i]?.turnCount ?? 0);
            }
            const names = rows.map((r) => r.staff);
            if (b2 > a1) expect(names.indexOf(sa)).toBeLessThan(names.indexOf(sb));
          });
          await step('TURN-054 board = Turn Order = card for both staff', async () => {
            await returnToHome();
            const q = await quickRows();
            for (const st of [sa, sb]) {
              const board = await turnOf(st);
              expect(q.find((r) => r.staff === st)?.count).toBe(board);
              expect((await cardTurn(st)).turn?.count).toBe(board);
            }
          });
        }),
      );
    },
  );

  it(
    title(
      "Cancel Order (void) on today's order takes its turns back (TURN-046)",
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(T);
      await withCfg(this, CFG_D(3000), () =>
        withTurnStaff(this, 1, async ([s]) => {
          const sa = s ?? '';
          const n0 = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
          const id = await paidOrder([{ staff: sa, amounts: [3000] }]);
          const n1 = (await waitTurn(sa, (x) => x !== null && x !== n0)) ?? Number.NaN;
          await voidPaidOrder(id);
          const n2 = (await waitTurn(sa, (x) => x !== null && x !== n1)) ?? Number.NaN;
          expect(Math.abs(n2 - n0)).toBeLessThanOrEqual(0.011);
        }),
      );
    },
  );

  it(
    title(
      'While an order is re-opened its turns are excluded and its staff is not Busy; Re-Open Done unchanged brings them back (TURN-025, TURN-051)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(T);
      await withCfg(this, CFG_D(3000), () =>
        withTurnStaff(this, 1, async ([s]) => {
          const sa = s ?? '';
          const n0 = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
          const id = await paidOrder([{ staff: sa, amounts: [3000] }]);
          const n = (await waitTurn(sa, (x) => x !== null && x !== n0)) ?? Number.NaN;
          try {
            await returnToHome();
            await openOrderDetail(id);
            await reopenOrder(id);
            await goToReopenEditor();
            await step('TURN-025 the re-opened order does not make its staff Busy', async () => {
              expect(await statusOf(sa)).not.toBe('Busy');
            });
            await step('TURN-051 the order is out of the count while re-opened', async () => {
              const during = await turnKeepingSearch(sa);
              expect(Math.abs((during ?? Number.NaN) - (n - 1))).toBeLessThanOrEqual(0.011);
            });
          } finally {
            await closeStray();
            await leaveReopenCheckout(id).catch(() => undefined);
          }
          await returnToHome();
          const back = await waitTurn(sa, (x) => x !== null && Math.abs(x - n) <= 0.011);
          expect(Math.abs((back ?? Number.NaN) - n)).toBeLessThanOrEqual(0.011);
        }),
      );
    },
  );

  it(
    title(
      'Saving the Turn value from board › Setting: toast, dialog closes, the board recomputes at once (past days too); Charge & Fee shows the same value (TURN-055, TURN-061)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(T);
      await withCfg(this, CFG_D(2500), () =>
        withTurnStaff(this, 1, async ([s]) => {
          const sa = s ?? '';
          await paidOrder([{ staff: sa, amounts: [3000] }]);
          const n25 = (await waitTurn(sa, (x) => x !== null && x > 0, 60_000)) ?? 0;
          const past = await findPastDayWithRows({ withTurns: true });
          const pastRow = past ? (await turnBoardDialog.rows()).find((r) => r.turnCount > 0) : undefined;
          if (past) await turnBoardDialog.pickDate(todayStart());
          await turnBoardDialog.close();
          let n30 = 0;
          await step(
            'TURN-061 save $30 from the board: toast, dialog closes, board recomputes while open',
            async () => {
              await turnBoardDialog.open();
              await boardToToday();
              await turnBoardDialog.applySettings(CFG_D(3000));
              expect(
                await P.poll(
                  () => P.has(VqcTurn.savedToast),
                  (v) => v,
                  8_000,
                ),
              ).toBe(true);
              expect(await turnBoardDialog.isSettingsOpen()).toBe(false);
              const row = await P.poll(
                () => turnBoardDialog.rowFor(sa),
                (r) => (r?.turnCount ?? n25) !== n25,
                30_000,
              );
              n30 = row?.turnCount ?? n25;
              expect(n30).not.toBe(n25);
              await turnBoardDialog.close();
            },
          );
          // n = Σprice / value + manual part A; two readings give Σprice, the third must match.
          const total = (n25 - n30) * 150;
          const manual = n25 - total / 25;
          expect(total).toBeGreaterThanOrEqual(28);
          await saveCfg(CFG_D(5000));
          const n50 = (await waitTurn(sa, (x) => x !== null && x !== n30, 30_000)) ?? Number.NaN;
          expect(Math.abs(n50 - (total / 50 + manual))).toBeLessThanOrEqual(0.06);
          if (past && pastRow) {
            await step('TURN-055 a past day is recomputed too', async () => {
              await turnBoardDialog.open();
              await turnBoardDialog.pickDate(past);
              const now = (await turnBoardDialog.rowFor(pastRow.staff))?.turnCount;
              await turnBoardDialog.pickDate(todayStart());
              await turnBoardDialog.close();
              expect(now).not.toBe(pastRow.turnCount);
            });
          }
          await step('TURN-061 Charge & Fee › Turn Settings shows $50.00', async () => {
            await goToSettings();
            await settingsPage.openSection('CHARGE_FEE');
            await P.waitFor(
              [VqcTurn.chargeFeeTurnCard, { css: 'input', nth: 0 }],
              15_000,
              'Charge & Fee Turn Settings card',
            );
            const values = (await P.infos([VqcTurn.chargeFeeTurnCard, { css: 'input' }])).map((i) => i.value);
            expect(values).toContain(formatMoney(5000));
            await returnToHome();
          });
        }),
      );
    },
  );

  it(
    title(
      'An order completed BEFORE the staff checks in still counts once they clock in (TURN-014)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(T);
      await withCfg(this, CFG_D(3000), async () => {
        await returnToHome();
        await timeKeepingDialog.open();
        const [sb] = await timeKeepingDialog.checkInCandidates(1);
        await timeKeepingDialog.close();
        if (!sb) this.skip(); // no staff OUT to use
        const name = sb ?? '';
        try {
          expect(await turnOf(name)).toBeNull();
          await paidOrder([{ staff: name, amounts: [3000] }]);
          expect(await turnOf(name)).toBeNull();
          await clockIn([name]);
          const n = (await waitTurn(name, (x) => x !== null, 60_000)) ?? 0;
          expect(n).toBeGreaterThanOrEqual(0.99);
        } finally {
          await clockOut([name]).catch(() => undefined);
        }
      });
    },
  );

  it(
    title(
      'Manual adjustments survive a counting-mode switch (decimal ↔ per order); a hidden negative adjustment left after a void swallows the next +1 (TURN-076, TURN-077)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(14 * 60_000);
      await returnToHome();
      const orig = await readCfg();
      if (orig.turnValueCents <= 0) this.skip();
      const D = CFG_D(orig.turnValueCents);
      const O = CFG_O(orig.turnValueCents);
      let cur = orig;
      const setCfg = async (c: TurnCfg): Promise<void> => {
        if (sameCfg(cur, c)) return;
        await saveCfg(c);
        cur = c;
      };
      try {
        await withTurnStaff(this, 1, async ([s]) => {
          const sa = s ?? '';
          let ledger = 0;
          try {
            await setCfg(O);
            const o0 = (await waitTurn(sa, (x) => x !== null && Number.isInteger(x), 30_000)) ?? 0;
            await setCfg(D);
            const d0 = (await waitTurn(sa, (x) => x !== null, 30_000)) ?? 0;
            const amount = 2 * orig.turnValueCents; // decimal: +2, per order: +1
            const id = await paidOrder([{ staff: sa, amounts: [amount] }]);
            const d1 = (await waitTurn(sa, (x) => x !== null && x !== d0)) ?? Number.NaN;
            await adjustTurn(sa, 1);
            ledger += 1;
            const d2 =
              (await waitTurn(sa, (x) => x !== null && Math.abs(x - (d1 + 1)) < 0.011, 30_000)) ?? Number.NaN;
            await step('TURN-076 per order → natural count of that mode + the manual +1', async () => {
              await setCfg(O);
              expect(await waitTurn(sa, (x) => x === o0 + 2, 30_000)).toBe(o0 + 2);
            });
            await step('TURN-076 back to decimal → as before the switch', async () => {
              await setCfg(D);
              const v = await waitTurn(sa, (x) => x !== null && Math.abs(x - d2) < 0.011, 30_000);
              expect(Math.abs((v ?? Number.NaN) - d2)).toBeLessThan(0.011);
            });
            await step('TURN-077 adjust to 0, void the order → still 0; +1 is swallowed', async () => {
              await setCfg(O);
              const o3 = (await waitTurn(sa, (x) => x === o0 + 2, 30_000)) ?? 0;
              await adjustTurn(sa, -o3);
              ledger -= o3;
              expect(await waitTurn(sa, (x) => x === 0, 30_000)).toBe(0);
              await voidPaidOrder(id);
              await settle(5_000);
              expect(await turnOf(sa)).toBe(0);
              await adjustTurn(sa, 1);
              ledger += 1;
              await settle(2_000);
              expect(await turnOf(sa)).toBe(0);
              await turnBoardDialog.open();
              await boardToToday();
              await turnBoardDialog.openAdjust();
              expect((await turnBoardDialog.adjustRowFor(sa))?.current).toBe(0);
              await turnBoardDialog.closeAdjust();
              await turnBoardDialog.close();
            });
          } finally {
            await revertAdjust(sa, ledger);
          }
        });
      } finally {
        await closeStray();
        if (!sameCfg(cur, orig)) await saveCfg(orig).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Turn value $0: tab and card turn lines hidden, board still opens from the sidebar and Setting can switch Turn back on; Charge & Fee keeps its Turn section; restoring brings the counts back (TURN-036, TURN-064)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      await withTurnStaff(this, 1, async ([s]) => {
        const sa = s ?? '';
        const orig = await readCfg();
        const n = await waitTurn(sa, (x) => x !== null, 30_000);
        let zeroed = false;
        try {
          await saveCfg({ ...orig, turnValueCents: 0 }, true);
          zeroed = true;
          await returnToHome();
          await step('TURN-036 no tab, no turn line on the card', async () => {
            expect(
              await P.poll(
                () => turnBoardDialog.hasQuickView(1_000),
                (v) => !v,
                15_000,
              ),
            ).toBe(false);
            expect((await cardTurn(sa)).turn).toBeNull();
          });
          await step(
            'TURN-036 / TURN-064 board from the sidebar: every count 0, Setting still opens',
            async () => {
              await appNav.openSidebar();
              await turnBoardDialog.pressSidebarEntry();
              await turnBoardDialog.waitOpen();
              await boardToToday();
              const rows = await turnBoardDialog.rows();
              for (const r of rows) expect(r.turnCount).toBe(0);
              await turnBoardDialog.openSettings();
              expect((await turnBoardDialog.readSettings()).turnValueCents).toBe(0);
              await turnBoardDialog.cancelSettings();
              await turnBoardDialog.close();
            },
          );
          await step('TURN-064 Charge & Fee still has the Turn Settings section', async () => {
            await goToSettings();
            await settingsPage.openSection('CHARGE_FEE');
            await P.waitFor(
              [VqcTurn.chargeFeeTurnCard, { css: 'input', nth: 0 }],
              15_000,
              'Charge & Fee Turn Settings card',
            );
            expect(await P.has(VqcTurn.chargeFeeTurnCard)).toBe(true);
            await returnToHome();
          });
        } finally {
          await closeStray();
          await returnToHome().catch(() => undefined);
          if (zeroed) await saveCfg(orig).catch(() => undefined);
        }
        await step('TURN-036 restored → the count comes back', async () => {
          expect(await waitTurn(sa, (x) => x === n, 30_000)).toBe(n);
        });
      });
    },
  );
});
