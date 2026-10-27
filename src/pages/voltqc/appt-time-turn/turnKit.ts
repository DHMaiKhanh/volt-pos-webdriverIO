import { browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../components/modal/PasscodeDialog.js';
import { timeKeepingDialog } from '../../../components/modal/TimeKeepingDialog.js';
import { turnBoardDialog } from '../../../components/modal/TurnBoardDialog.js';
import { VqaTurn } from '../../../constants/testids.voltqc-appt-time-turn.js';
import { VqcHome } from '../../../constants/testids.voltqc-pos.js';
import { goToOrderHistory, payInCash, payWithOther, returnToHome } from '../../../flows/index.js';
import { step } from '../../../helpers/steps.js';
import { settle } from '../../../helpers/wait.js';
import { homePage, orderHistoryDetailPage, orderHistoryPage } from '../../index.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';

/**
 * Shared kit for the volt-qc 15-turn write-path ports
 * (tests/regression/volt-qc/appt-time-turn/turn-*.spec.ts).
 *
 * Mirrors volt-qc `src/flows/turn.ts` on top of this suite's page objects:
 * `turnBoardDialog` for the board / Adjust / Settings, `timeKeepingDialog` for
 * clock-in, `homePage` + checkout flows for the orders that earn turns. Only the
 * pieces those objects do not expose (Turn Order status chips, the Home staff
 * card's turn line, the board's whole text) go through the volt-qc probe.
 *
 * ## Data safety (same rules as the source suite)
 *
 * - Staff are picked at run time among those OUT now (`checkInCandidates`), and
 *   checked OUT again in `finally` — nobody already IN is touched.
 * - Manual adjustments are a ledger that cannot be deleted: every saved delta is
 *   reverted with the opposite delta in `finally` ({@link revertAdjust}).
 * - Turn Settings are merchant-GLOBAL: {@link withCfg} restores the original in
 *   `finally`; specs that call it carry `Tag.EXCLUSIVE`.
 * - Orders are small Quick Pay lines paid with "Other" (or Cash) on dev.
 */

/* ------------------------------------------------------------------------- *
 * Dates
 * ------------------------------------------------------------------------- */

export const todayStart = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/** EN `MM/DD/YYYY` and VI `DD/MM/YYYY` renderings of a date on the board trigger. */
export function dateLabels(date: Date): [string, string] {
  const p = (n: number): string => String(n).padStart(2, '0');
  const y = date.getFullYear();
  return [
    `${p(date.getMonth() + 1)}/${p(date.getDate())}/${y}`,
    `${p(date.getDate())}/${p(date.getMonth() + 1)}/${y}`,
  ];
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------------- *
 * Turn Settings
 * ------------------------------------------------------------------------- */

export interface TurnCfg {
  serviceBased: boolean;
  decimal: boolean;
  turnValueCents: number;
}

export const CFG_D = (tv: number): TurnCfg => ({ serviceBased: true, decimal: true, turnValueCents: tv });
export const CFG_S = (tv: number): TurnCfg => ({ serviceBased: true, decimal: false, turnValueCents: tv });
export const CFG_O = (tv: number): TurnCfg => ({ serviceBased: false, decimal: false, turnValueCents: tv });

export const sameCfg = (a: TurnCfg, b: TurnCfg): boolean =>
  a.serviceBased === b.serviceBased &&
  (!a.serviceBased || a.decimal === b.decimal) &&
  a.turnValueCents === b.turnValueCents;

/** The saved configuration (board › Setting, closed without saving). Leaves the board closed. */
export async function readCfg(): Promise<TurnCfg> {
  await turnBoardDialog.open();
  await turnBoardDialog.openSettings();
  const s = await turnBoardDialog.readSettings();
  await turnBoardDialog.cancelSettings();
  await turnBoardDialog.close();
  return {
    serviceBased: s.serviceBased,
    decimal: s.serviceBased && s.decimal,
    turnValueCents: s.turnValueCents,
  };
}

/** Save a configuration through board › Setting › Save. Refuses $0 unless `allowZero`. */
export async function saveCfg(cfg: TurnCfg, allowZero = false): Promise<void> {
  if (!allowZero && !(cfg.turnValueCents > 0))
    throw new Error('Refusing to save Turn value $0 (switches Turn off shop-wide).');
  await step(`Save Turn Settings ${JSON.stringify(cfg)}`, async () => {
    await turnBoardDialog.open();
    await turnBoardDialog.applySettings(cfg);
    await turnBoardDialog.close();
  });
}

/** Run `fn` under `cfg`, restoring the original configuration afterwards. Skips when Turn is off. */
export async function withCfg(ctx: Mocha.Context, cfg: TurnCfg, fn: () => Promise<void>): Promise<void> {
  const orig = await readCfg();
  if (orig.turnValueCents <= 0) ctx.skip(); // Turn is off: never switch it on (restoring would mean saving $0)
  if (sameCfg(orig, cfg)) return fn();
  try {
    await saveCfg(cfg);
    await fn();
  } finally {
    await closeStray();
    await saveCfg(orig).catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.log(`[turn] restoring Turn Settings ${JSON.stringify(orig)} failed: ${String(e)}`);
    });
  }
}

/** Turn count for one staff under a configuration (pure formula of volt-qc `turnsFor`). */
export function turnsFor(cfg: TurnCfg, orders: number[][]): number {
  if (!cfg.serviceBased) return orders.filter((o) => o.some((c) => c > 0)).length;
  if (cfg.decimal) return round2(orders.flat().reduce((a, b) => a + b, 0) / cfg.turnValueCents);
  return orders.flat().filter((c) => c >= cfg.turnValueCents).length;
}

/**
 * The delta a spec should see after `addedOrders`, with its tolerance: decimal
 * mode rounds the DAY total, so the step may differ by 0.01 when the staff
 * already had turns today.
 */
export function expectedDelta(
  cfg: TurnCfg,
  before: number,
  addedOrders: number[][],
): { delta: number; tolerance: number } {
  if (cfg.serviceBased && cfg.decimal) {
    const raw = addedOrders.flat().reduce((a, b) => a + b, 0) / cfg.turnValueCents;
    return before === 0 ? { delta: round2(raw), tolerance: 0.001 } : { delta: raw, tolerance: 0.011 };
  }
  return { delta: turnsFor(cfg, addedOrders), tolerance: 0.001 };
}

/* ------------------------------------------------------------------------- *
 * Staff in / out
 * ------------------------------------------------------------------------- */

/** Check IN up to `count` staff who are OUT now (distinct check-in seconds). Returns who went IN. */
export async function clockInFresh(count: number): Promise<string[]> {
  assertWritesAllowed('clock staff in for the Turn board');
  return step(`Clock in ${count} staff`, async () => {
    await closeStray();
    await timeKeepingDialog.open();
    const names = await timeKeepingDialog.checkInCandidates(count);
    const done: string[] = [];
    for (const name of names) {
      await timeKeepingDialog.checkIn(name);
      done.push(name);
      await settle(1_100);
    }
    await timeKeepingDialog.clearSearch().catch(() => undefined);
    await timeKeepingDialog.close();
    return done;
  });
}

/** Check these staff IN (only those OUT now). */
export async function clockIn(names: readonly string[]): Promise<void> {
  assertWritesAllowed('clock staff in');
  await closeStray();
  await timeKeepingDialog.open();
  for (const name of names) {
    if ((await timeKeepingDialog.columnOf(name)) === 'unavailable') {
      await timeKeepingDialog.checkIn(name);
      await settle(1_100);
    }
  }
  await timeKeepingDialog.clearSearch().catch(() => undefined);
  await timeKeepingDialog.close();
}

/** Check these staff OUT (only those IN now). Never throws on a missing name. */
export async function clockOut(names: readonly string[]): Promise<void> {
  if (names.length === 0) return;
  await closeStray();
  await timeKeepingDialog.open();
  for (const name of names) {
    if ((await timeKeepingDialog.columnOf(name)) === 'available') await timeKeepingDialog.checkOut(name);
  }
  await timeKeepingDialog.clearSearch().catch(() => undefined);
  await timeKeepingDialog.close();
}

/**
 * Clock `count` fresh staff IN, run `fn`, clock them OUT. Skips when Turn is off
 * (Turn value $0) or when fewer than `count` staff can be checked in.
 */
export async function withTurnStaff(
  ctx: Mocha.Context,
  count: number,
  fn: (staff: string[]) => Promise<void>,
): Promise<void> {
  await returnToHome();
  const cfg = await readCfg();
  if (cfg.turnValueCents <= 0) ctx.skip();
  const staff = await clockInFresh(count);
  if (staff.length < count) {
    await clockOut(staff);
    ctx.skip(); // not enough staff OUT to check in
  }
  try {
    await fn(staff);
  } finally {
    await closeStray();
    await returnToHome().catch(() => undefined);
    await clockOut(staff).catch(() => undefined);
  }
}

/** Escape every open dialog / popover (board, Adjust, Settings, quick view, Time Keeping). */
export async function closeStray(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    const open = await P.count({ css: '[role="dialog"],[role="alertdialog"],[data-slot="popover-content"]' });
    if (open === 0) return;
    await browser.keys(['Escape']);
    await settle(300);
  }
}

/* ------------------------------------------------------------------------- *
 * Board reads
 * ------------------------------------------------------------------------- */

/** Make sure the open board shows TODAY (the board keeps the picked day for the session). */
export async function boardToToday(): Promise<void> {
  if (!dateLabels(todayStart()).includes(await turnBoardDialog.dateText()))
    await turnBoardDialog.pickDate(todayStart());
}

/** Today's turn count of a staff on the board, `null` when not on the board. Leaves the board closed. */
export async function turnOf(staff: string): Promise<number | null> {
  await turnBoardDialog.open();
  await boardToToday();
  const row = await turnBoardDialog.rowFor(staff);
  await turnBoardDialog.close();
  return row ? row.turnCount : null;
}

/** Poll {@link turnOf} until `ok` holds (the board recomputes after a sync round trip). */
export async function waitTurn(
  staff: string,
  ok: (n: number | null) => boolean,
  timeout = 90_000,
): Promise<number | null> {
  let last: number | null = null;
  await browser
    .waitUntil(
      async () => {
        last = await turnOf(staff);
        return ok(last);
      },
      { timeout, interval: 1_500 },
    )
    .catch(() => undefined);
  return last;
}

/** Whole text of the open board dialog (lines joined by " | "). */
export async function boardText(): Promise<string> {
  return ((await P.rawText(VqaTurn.boardDialog)) ?? '').replace(/\s*\n+\s*/g, ' | ');
}

/** Does the board's row list scroll inside the dialog? */
export async function boardListScrolls(): Promise<boolean> {
  return P.exec<boolean>(
    `var d = Array.prototype.slice.call(document.querySelectorAll('[role="dialog"]')).filter(function (x) { return x.querySelector('#selected-date-range'); }).pop();
     if (!d) return false;
     return Array.prototype.slice.call(d.querySelectorAll('*')).some(function (el) {
       var st = getComputedStyle(el);
       return (st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
     });`,
  );
}

/* ------------------------------------------------------------------------- *
 * Adjust Manual Turn
 * ------------------------------------------------------------------------- */

/**
 * Save a manual delta (integer) for a staff. `viewDate` = the day the board is
 * on while saving (TURN-074). Returns the row's Current before the change.
 */
export async function adjustTurn(staff: string, delta: number, viewDate?: Date): Promise<number> {
  assertWritesAllowed('save a manual turn adjustment');
  return step(`Adjust ${staff} ${delta > 0 ? '+' : ''}${delta}`, async () => {
    await turnBoardDialog.open();
    if (viewDate) await turnBoardDialog.pickDate(viewDate);
    else await boardToToday();
    await turnBoardDialog.openAdjust();
    const before = await turnBoardDialog.adjustRowFor(staff);
    if (!before) throw new Error(`Adjust Manual Turn has no row for ${staff}.`);
    if (delta > 0) await turnBoardDialog.adjustIncrease(staff, delta);
    else if (delta < 0) await turnBoardDialog.adjustDecrease(staff, -delta);
    if (delta !== 0) await turnBoardDialog.adjustSave(staff);
    await turnBoardDialog.closeAdjust();
    if (viewDate) await turnBoardDialog.pickDate(todayStart());
    await turnBoardDialog.close();
    return before.current;
  });
}

/** Undo a saved delta (best effort, for `finally`). */
export async function revertAdjust(staff: string, saved: number, viewDate?: Date): Promise<void> {
  if (!saved) return;
  try {
    await closeStray();
    await adjustTurn(staff, -saved, viewDate);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`[turn] reverting adjustment ${staff} ${-saved} failed: ${String(e)}`);
  }
}

/** Is the "Turn adjustments saved" toast on screen? */
export async function adjustToastShown(timeout = 5_000): Promise<boolean> {
  return P.poll(
    () => P.has(VqaTurn.adjustSavedToast),
    (v) => v,
    timeout,
  );
}

/* ------------------------------------------------------------------------- *
 * Turn Order quick view + Home staff card
 * ------------------------------------------------------------------------- */

export interface QuickRow {
  rank: number;
  staff: string;
  status: string;
  count: number;
}

/** Rows of the open Turn Order popover, with their status chip. */
export async function readQuickRows(): Promise<QuickRow[]> {
  return P.exec<QuickRow[]>(
    `var titles = arguments[0], statusRe = new RegExp(arguments[1]), css = arguments[2];
     var pop = Array.prototype.slice.call(document.querySelectorAll(css)).filter(function (el) {
       return Array.prototype.slice.call(el.querySelectorAll('p')).some(function (p) { return titles.indexOf((p.textContent || '').trim()) >= 0; });
     }).pop();
     if (!pop) return [];
     return Array.prototype.slice.call(pop.querySelectorAll('div')).filter(function (d) {
       var f = d.firstElementChild;
       return f && f.tagName === 'SPAN' && /^\\d+$/.test((f.textContent || '').trim()) && d.querySelector(':scope > div > p');
     }).map(function (d) {
       var st = Array.prototype.slice.call(d.querySelectorAll('span')).filter(function (s) { return statusRe.test((s.textContent || '').trim()); })[0];
       return {
         rank: Number((d.firstElementChild.textContent || '0').trim()),
         staff: (d.querySelector(':scope > div > p').textContent || '').trim(),
         status: st ? (st.textContent || '').trim() : '',
         count: Number(((d.lastElementChild && d.lastElementChild.textContent) || '').replace(/[^\\d.]/g, '')) || 0
       };
     });`,
    VqaTurn.quickTitles,
    VqaTurn.statusRe,
    VqaTurn.popoverCss,
  );
}

/** Open the quick view, read it, close it. `[]` when the tab is not rendered. */
export async function quickRows(): Promise<QuickRow[]> {
  if (!(await turnBoardDialog.hasQuickView(Timeouts.MEDIUM))) return [];
  await turnBoardDialog.openQuickView();
  await settle(500);
  const rows = await readQuickRows();
  await turnBoardDialog.closeQuickView();
  return rows;
}

export async function quickOf(staff: string): Promise<QuickRow | null> {
  return (await quickRows()).find((r) => r.staff === staff) ?? null;
}

/** Bounding boxes of the quick-view tab and its popover (null when absent). */
export async function quickGeometry(): Promise<{
  tab: { x: number; y: number; w: number; h: number } | null;
  pop: { x: number; y: number; w: number; h: number } | null;
  vw: number;
  vh: number;
  chevron: string;
}> {
  return P.exec(
    `var texts = arguments[0], titles = arguments[1], css = arguments[2], lcss = arguments[3];
     var rect = function (el) { if (!el) return null; var r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
     var tab = Array.prototype.slice.call(document.querySelectorAll(lcss)).filter(function (b) {
       var s = b.querySelector('span'); return s && texts.indexOf((s.textContent || '').trim().toLowerCase()) >= 0;
     })[0];
     var pop = Array.prototype.slice.call(document.querySelectorAll(css)).filter(function (el) {
       return Array.prototype.slice.call(el.querySelectorAll('p')).some(function (p) { return titles.indexOf((p.textContent || '').trim()) >= 0; });
     }).pop();
     var svg = tab ? tab.querySelector('svg') : null;
     return { tab: rect(tab), pop: rect(pop), vw: innerWidth, vh: innerHeight, chevron: svg ? String(svg.getAttribute('class') || '') : '' };`,
    VqaTurn.launcherTexts,
    VqaTurn.quickTitles,
    VqaTurn.popoverCss,
    VqaTurn.launcherCss,
  );
}

/** The turn line of a Home staff card: `{count, status}` or `null` (staff OUT / Turn off). */
export async function cardTurn(
  staff: string,
): Promise<{ text: string; turn: { count: number; status: string } | null }> {
  await homePage.searchStaff(staff);
  const text = await P.exec<string>(
    `var name = arguments[0];
     var card = Array.prototype.slice.call(document.querySelectorAll(arguments[1])).filter(function (c) {
       return Array.prototype.slice.call(c.querySelectorAll('span')).some(function (s) { return (s.textContent || '').trim() === name; });
     })[0];
     return card ? String(card.innerText || card.textContent || '').replace(/\\s*\\n+\\s*/g, ' | ') : '';`,
    staff,
    VqaTurn.staffCardCss,
  );
  await homePage.searchStaff('');
  const m = /(\d+(?:\.\d+)?)\s*\|\s*(Available|Busy)/.exec(text);
  return { text, turn: m ? { count: Number(m[1]), status: m[2] ?? '' } : null };
}

/* ------------------------------------------------------------------------- *
 * Orders that earn turns
 * ------------------------------------------------------------------------- */

/** Empty till: back on /home with no draft open. */
export async function voidDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

/** Put a named staff on the current draft (opens a draft when none). */
export async function pickStaff(staff: string): Promise<void> {
  await homePage.searchStaff(staff);
  await P.clickQ(VqaTurn.staffName(staff));
  await settle();
  await homePage.searchStaff('');
}

/** `#OD…` code of the open draft on /home ('' when none). */
export async function draftCode(): Promise<string> {
  const t = await P.textOf(VqcHome.orderHeading).catch(() => '');
  return /#OD\d{6}-\d+/.exec(t)?.[0] ?? '';
}

export interface TurnLine {
  staff: string;
  /** Quick Pay amounts in cents (= service price the turn is computed on). */
  amounts: number[];
}

/** A draft of Quick Pay lines per staff, left on the /home cart. Returns its `#OD` code. */
export async function buildDraft(lines: readonly TurnLine[]): Promise<string> {
  assertWritesAllowed('create a Quick Pay order for turns');
  await voidDraft();
  for (const line of lines) {
    await pickStaff(line.staff);
    for (const cents of line.amounts) {
      await homePage.openQuickPay();
      await homePage.addQuickPayItem(cents, { name: `QA turn ${String(cents / 100)}` });
      await settle(800);
    }
  }
  return draftCode();
}

/** Pay the draft on /home. Returns the order id; leaves the till on an empty /home. */
export async function payDraft(method: 'other' | 'cash' = 'other'): Promise<string> {
  const checkout = await homePage.pressPay();
  const id = await checkout.orderId();
  const success = method === 'cash' ? await payInCash(id) : await payWithOther(id, 'Zelle');
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();
  await returnToHome();
  return id;
}

/** Build + pay. */
export async function paidOrder(
  lines: readonly TurnLine[],
  method: 'other' | 'cash' = 'other',
): Promise<string> {
  await buildDraft(lines);
  return payDraft(method);
}

/** Cancel (void) a paid order from Order History. */
export async function voidPaidOrder(orderId: string): Promise<void> {
  assertWritesAllowed('cancel a paid order');
  await returnToHome();
  await goToOrderHistory();
  await orderHistoryPage.openOrder(orderId);
  await orderHistoryDetailPage.waitForOrder(orderId);
  await orderHistoryDetailPage.cancelOrder('staff_mistake');
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
  await settle(1_500);
  await returnToHome();
}
