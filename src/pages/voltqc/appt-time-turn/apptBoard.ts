import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../components/modal/PasscodeDialog.js';
import { VqaAppt as Q } from '../../../constants/testids.voltqc-appt-time-turn.js';
import { VqcAppointment as A, VqcHome } from '../../../constants/testids.voltqc-pos.js';
import { returnToHome } from '../../../flows/index.js';
import { settle } from '../../../helpers/wait.js';
import {
  ROW_PX_PER_MIN,
  closePopover,
  dayStart,
  gotoBoard,
  openStatusFilter,
  scrollBoardTo,
  unselectAll,
  filterCheckbox,
} from '../pos/appointmentProbe.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';

/**
 * Appointment cards, the detail popover, Checkout and Home › Appointments Today
 * for the volt-qc 08-appointment write-path port (volt-qc `src/flows/appointment.ts`).
 *
 * Build 1.1.56 cannot create appointments (no create form, P-VP-476 paused), so
 * every case works on appointments that already exist on the merchant: they are
 * DISCOVERED at runtime by {@link discoverCards} and the spec skips when none
 * of the wanted kind is found.
 */

export type ApptStatus = 'Scheduled' | 'Confirmed' | 'Done' | 'Canceled';

export interface BoardCard {
  /** Index among the rendered `[data-appointment-card]`s. */
  index: number;
  /** Normalised innerText, lines joined by " | ". */
  text: string;
  /** First line (the customer name). */
  name: string;
  status: string;
  ariaDisabled: string | null;
  /** `data-index` of the column the card sits in. */
  col: number;
  top: number;
  left: number;
  width: number;
  height: number;
  /** "hh:mm AM - hh:mm PM" footer, '' when absent. */
  timeRange: string;
  borderLeft: string;
}

/** Every rendered card of the viewed board day. */
export async function boardCards(): Promise<BoardCard[]> {
  return P.exec<BoardCard[]>(
    `
    return Array.prototype.map.call(document.querySelectorAll(arguments[0]), function (c, i) {
      var lines = String(c.innerText || '').split('\\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var badge = c.querySelector('[data-slot="badge"]');
      var col = c.closest('[data-index]');
      var r = c.getBoundingClientRect();
      var tr = /\\d{2}:\\d{2} (AM|PM) - \\d{2}:\\d{2} (AM|PM)/.exec(lines.join(' '));
      var inner = c.firstElementChild || c;
      return {
        index: i,
        text: lines.join(' | '),
        name: lines[0] || '',
        status: badge ? String(badge.textContent || '').trim() : '',
        ariaDisabled: c.getAttribute('aria-disabled'),
        col: col ? Number(col.getAttribute('data-index')) : -1,
        top: r.top, left: r.left, width: r.width, height: r.height,
        timeRange: tr ? tr[0] : '',
        borderLeft: getComputedStyle(inner).borderLeftColor
      };
    });
  `,
    Q.cardCss,
  );
}

export interface FoundCard {
  day: Date;
  card: BoardCard;
}

/**
 * Walk the board day by day (today, then +1, -1, +2, -2 … ±`span`) and return
 * the first rendered card satisfying `want`. With `allStatuses` the status
 * filter is widened to every status first (Canceled included). Leaves the board
 * on the hit's day; `null` when nothing matched.
 */
export async function findCard(
  want: (c: BoardCard) => boolean,
  opts: { span?: number; allStatuses?: boolean; from?: number } = {},
): Promise<FoundCard | null> {
  const { span = 10, allStatuses = false, from = 0 } = opts;
  const offsets = [from];
  for (let i = 1; i <= span; i += 1) offsets.push(from + i, from - i);
  let widened = false;
  for (const off of offsets) {
    const day = dayStart(off);
    await gotoBoard(day);
    if (allStatuses && !widened) {
      await setAllStatuses();
      widened = true;
    }
    await settle(400);
    const hit = (await boardCards()).find(want);
    if (hit) return { day, card: hit };
  }
  return null;
}

/** Tick every status (Scheduled, Canceled, Confirmed, Done). Persists in localStorage until Reset. */
export async function setAllStatuses(): Promise<void> {
  await openStatusFilter();
  await unselectAll(A.statusPopover, '#select-all-status');
  await P.clickQ([A.statusPopover, { css: '#select-all-status' }]);
  await closePopover();
  await settle(600);
}

/** Tick / untick one status in the Statuses popover. */
export async function setStatusChecked(label: string, on: boolean): Promise<void> {
  await openStatusFilter();
  const cb = filterCheckbox(A.statusPopover, label);
  if (((await P.attrOf(cb, 'data-state')) === 'checked') !== on) await P.clickQ(cb);
  await closePopover();
  await settle(600);
}

/** Re-find a card by its text on the viewed day (indexes shift on websocket refreshes). */
export async function cardIndexByText(text: string): Promise<number> {
  const all = await P.poll(boardCards, (cs) => cs.some((c) => c.text === text), 10_000);
  return all.find((c) => c.text === text)?.index ?? -1;
}

/** Open the popover of the card with this text on the viewed day. */
export async function openCardByText(text: string): Promise<void> {
  const i = await cardIndexByText(text);
  if (i < 0) throw new Error(`appointment card not found on the board: ${text}`);
  await openCardAt(i);
}

export async function openCardAt(index: number): Promise<void> {
  await P.closeToasts();
  try {
    await P.clickQ(Q.card(index));
  } catch {
    await P.jsClickQ(Q.card(index)); // aria-disabled card: the Radix trigger still takes a DOM click
  }
  await P.waitFor(Q.popover, 10_000, 'appointment popover');
}

export async function popoverOpen(): Promise<boolean> {
  return P.has(Q.popover);
}

export interface PopoverInfo {
  text: string;
  status: string;
  heading: string;
  /** Visible button labels, the X (aria-label Close) excluded. */
  buttons: string[];
  hasNote: boolean;
  orderId: string;
  service: string;
}

export async function popoverInfo(): Promise<PopoverInfo> {
  const raw = await P.exec<{
    text: string;
    status: string;
    heading: string;
    buttons: string[];
    labels: string[];
  } | null>(`
    var pops = Array.prototype.filter.call(document.querySelectorAll('[data-slot="popover-content"]'), function (p) {
      return p.getClientRects().length > 0 && p.querySelector('button[aria-label="Close"]');
    });
    var p = pops[pops.length - 1];
    if (!p) return null;
    var badge = p.querySelector('[data-slot="badge"]');
    var h = p.querySelector('h3');
    var buttons = Array.prototype.filter.call(p.querySelectorAll('button'), function (b) {
      return b.getAttribute('aria-label') !== 'Close' && b.getClientRects().length > 0;
    }).map(function (b) { return String(b.innerText || b.textContent || '').trim(); }).filter(Boolean);
    var labels = Array.prototype.map.call(p.querySelectorAll('*'), function (e) {
      return e.children.length === 0 ? String(e.textContent || '').trim() : '';
    }).filter(Boolean);
    return {
      text: String(p.innerText || '').split('\\n').map(function (s) { return s.trim(); }).filter(Boolean).join(' | '),
      status: badge ? String(badge.textContent || '').trim() : '',
      heading: h ? String(h.textContent || '').trim() : '',
      buttons: buttons,
      labels: labels
    };
  `);
  if (!raw) throw new Error('no appointment popover is open');
  return {
    text: raw.text,
    status: raw.status,
    heading: raw.heading,
    buttons: raw.buttons,
    hasNote: raw.labels.includes('Note'),
    orderId: /#?(OD\d{6}-\d+)/.exec(raw.text)?.[1] ?? '',
    service: /(?:^| \| )Service \| ([^|]+)/.exec(raw.text)?.[1]?.trim() ?? '',
  };
}

/** Leaf-text labels of the popover (to check Service / Time / Staff / Note headings). */
export async function popoverHasLabel(label: string): Promise<boolean> {
  return P.has([Q.popover, { text: label }]);
}

export async function closePopoverX(): Promise<void> {
  if (!(await popoverOpen())) return;
  await P.clickQ(Q.popoverClose);
  await P.waitGoneQ(Q.popover, 5_000, 'appointment popover');
}

/** Note element of the open popover: its text and computed white-space. */
export async function popoverNoteStyle(): Promise<{ text: string; whiteSpace: string } | null> {
  return P.exec(`
    var pops = Array.prototype.filter.call(document.querySelectorAll('[data-slot="popover-content"]'), function (p) {
      return p.getClientRects().length > 0 && p.querySelector('button[aria-label="Close"]');
    });
    var p = pops[pops.length - 1];
    if (!p) return null;
    var label = Array.prototype.find.call(p.querySelectorAll('*'), function (e) {
      return e.children.length === 0 && String(e.textContent || '').trim() === 'Note';
    });
    if (!label) return null;
    var el = label.nextElementSibling || (label.parentElement && label.parentElement.nextElementSibling);
    if (!el) return null;
    var deep = el;
    while (deep.firstElementChild && deep.children.length === 1) deep = deep.firstElementChild;
    return { text: String(el.innerText || ''), whiteSpace: getComputedStyle(deep).whiteSpace };
  `);
}

/* ------------------------------------------------------------------- *
 * Board geometry
 * ------------------------------------------------------------------- */

/** Bounding box of column `data-index=i`. */
export async function columnBox(i: number): Promise<{ x: number; y: number; w: number; h: number } | null> {
  return P.exec(
    `
    var col = document.querySelector('main [data-index="' + arguments[0] + '"]');
    if (!col) return null;
    var r = col.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  `,
    i,
  );
}

/**
 * Click column `i` at `minute` of the day, unless a card sits there. Returns
 * whether the click happened (volt-qc `clickBoardAt`).
 */
export async function clickBoardAt(i: number, minute: number): Promise<boolean> {
  await scrollBoardTo(Math.max(0, minute * ROW_PX_PER_MIN - 200));
  const box = await columnBox(i);
  if (!box) return false;
  const x = box.x + box.w / 2;
  const y = box.y + minute * ROW_PX_PER_MIN + 3;
  const onCard = await P.exec<boolean>(
    `var el = document.elementFromPoint(arguments[0], arguments[1]); return !!(el && el.closest('[data-appointment-card]'));`,
    x,
    y,
  );
  if (onCard) return false;
  await P.clickAt(x, y);
  return true;
}

/** Hatched blocks (top/height px + pointer-events) of column `i`. */
export async function hatchedBlocks(
  i: number,
): Promise<{ top: number; height: number; pointerEvents: string }[]> {
  return P.exec(
    `
    var col = document.querySelector('main [data-index="' + arguments[0] + '"]');
    if (!col) return [];
    return Array.prototype.filter.call(col.querySelectorAll('div'), function (d) {
      return (d.style.backgroundImage || '').indexOf('repeating-linear-gradient') >= 0 && d.style.top !== '';
    }).map(function (d) {
      return { top: parseFloat(d.style.top), height: parseFloat(d.style.height), pointerEvents: getComputedStyle(d).pointerEvents };
    });
  `,
    i,
  );
}

/** Raw header cells (text incl. "(Inactive)" + lowest opacity inside the cell). */
export async function rawColumnHeaders(): Promise<{ text: string; minOpacity: number }[]> {
  return P.exec(`
    var row = document.querySelector('main div.sticky.top-0.z-60 > div');
    if (!row) return [];
    return Array.prototype.map.call(row.children, function (c) {
      var min = 1;
      var all = [c].concat(Array.prototype.slice.call(c.querySelectorAll('*')));
      for (var i = 0; i < all.length; i++) { var o = Number(getComputedStyle(all[i]).opacity); if (o < min) min = o; }
      return { text: String(c.innerText || '').replace(/\\s+/g, ' ').trim(), minOpacity: min };
    });
  `);
}

/** Minutes since midnight of "hh:mm AM". */
export function minutesOf(t: string): number {
  const m = /(\d{1,2}):(\d{2}) (AM|PM)/.exec(t);
  if (!m) return Number.NaN;
  return ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
}

/** Duration (min) of a "hh:mm AM - hh:mm PM" range; NaN when unparsable / crossing midnight. */
export function durationOf(range: string): number {
  const [a, b] = range.split(' - ');
  const d = minutesOf(b ?? '') - minutesOf(a ?? '');
  return d > 0 ? d : Number.NaN;
}

/* ------------------------------------------------------------------- *
 * Checkout from an appointment
 * ------------------------------------------------------------------- */

/** `#ODyymmdd-n` of the order open on /home ('' when none). */
export async function homeOrderId(): Promise<string> {
  if (!(await P.has(VqcHome.orderHeading))) return '';
  return /OD\d{6}-\d+/.exec(await P.textOf(VqcHome.orderHeading))?.[0] ?? '';
}

/**
 * Press Checkout in the open popover. When the "Open Appointment Order" alert
 * shows, press `onDialog` (default Continue). Waits for /home unless cancelled.
 */
export async function popoverCheckout(
  onDialog: 'Continue' | 'Cancel' = 'Continue',
): Promise<{ dialogShown: boolean }> {
  await P.clickQ(Q.popoverCheckout);
  const dialogShown = await P.poll(
    () => P.has(Q.openOrderDialog),
    (v) => v,
    2_500,
  );
  if (dialogShown) {
    await P.clickQ([Q.openOrderDialog, { role: 'button', name: onDialog, nth: 0 }]);
    await P.waitGoneQ(Q.openOrderDialog, 5_000, 'Open Appointment Order');
    if (onDialog === 'Cancel') return { dialogShown };
  }
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE, { timeout: 2_000 });
  await P.poll(
    () => P.path(),
    (p) => p === '/home',
    20_000,
  );
  await P.poll(homeOrderId, (id) => id !== '', 15_000);
  return { dialogShown };
}

/** Open a pending order from the /home Pending Orders sidebar. */
export async function openFromPendingSidebar(orderId: string): Promise<boolean> {
  if ((await P.path()) !== '/home') await returnToHome();
  if (!(await P.has(Q.pendingSideSearch))) return false;
  await P.fillQ(Q.pendingSideSearch, orderId);
  const hit = await P.poll(
    () => P.has(Q.pendingSideCard(orderId)),
    (v) => v,
    8_000,
  );
  if (hit) {
    await P.clickQ(Q.pendingSideCard(orderId));
    await P.poll(homeOrderId, (id) => id === orderId, 10_000);
  }
  await P.fillQ(Q.pendingSideSearch, '').catch(() => '');
  return hit && (await homeOrderId()) === orderId;
}

/* ------------------------------------------------------------------- *
 * Home › Appointments Today
 * ------------------------------------------------------------------- */

/** Open the accordion on /home; returns the (N) of its title. */
export async function openAppointmentsToday(): Promise<number> {
  if ((await P.path()) !== '/home') await returnToHome();
  await P.waitFor(VqcHome.appointmentsToday, 15_000, 'Appointments Today');
  if (!/Hide/.test(await P.textOf(VqcHome.appointmentsToday))) await P.clickQ(VqcHome.appointmentsToday);
  await settle(500);
  return Number(/\((\d+)\)/.exec(await P.textOf(VqcHome.appointmentsToday))?.[1] ?? Number.NaN);
}

export async function closeAppointmentsToday(): Promise<void> {
  if (!(await P.has(VqcHome.appointmentsToday))) return;
  if (/Hide/.test(await P.textOf(VqcHome.appointmentsToday))) await P.clickQ(VqcHome.appointmentsToday);
}

/** Rows of the open accordion, " | "-joined. */
export async function homeRows(): Promise<string[]> {
  const raw = await P.exec<string[]>(
    `
    var rows = Array.prototype.filter.call(document.querySelectorAll(arguments[0]), function (d) {
      return d.getClientRects().length > 0 && /Staff:/.test(d.textContent || '') && !d.querySelector('div.cursor-pointer');
    });
    return rows.map(function (d) { return String(d.innerText || ''); });
  `,
    Q.homeRowCss,
  );
  return raw.map((t) =>
    t
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' | '),
  );
}

export async function clickHomeRow(index: number): Promise<void> {
  await P.clickQ({ css: Q.homeRowCss, hasTextRe: 'Staff:', nth: index });
  await P.waitFor(Q.popover, 10_000, 'appointment popover from Home');
}

/* ------------------------------------------------------------------- *
 * Passcode skip (phone reveal)
 * ------------------------------------------------------------------- */

/** Raw `volt-passcode-skip` — read before a phone case clears it, restored after. */
export async function readSkipRaw(): Promise<string | null> {
  return P.localGet(Q.passcodeSkipKey);
}

export async function writeSkipRaw(raw: string | null): Promise<void> {
  await P.localSet(Q.passcodeSkipKey, raw);
}

/** Does the open popover show an unmasked phone (digits, no `***`)? */
export async function popoverPhoneUnmasked(): Promise<boolean> {
  const t = (await popoverInfo()).text;
  return !/\*\*\*-\*\*\*-/.test(t) && /\(?\d{3}\)?\D{0,2}\d{3}-\d{4}/.test(t);
}
