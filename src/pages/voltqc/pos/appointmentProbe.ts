import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../components/modal/PasscodeDialog.js';
import { VqcAppointment as A, VqcCommon, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from './VoltQcProbe.js';

/**
 * Appointment board (`/appointment`) reads, date navigation and the Staffs /
 * Statuses filters, for the volt-qc 08-appointment port (volt-qc
 * `src/flows/appointment.ts`). No card is opened and nothing is booked.
 */

export const ROW_PX_PER_MIN = 6;
export const DAY_HEIGHT = 24 * 60 * ROW_PX_PER_MIN;

export function dayStart(offset = 0, base = new Date()): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + offset);
  return d;
}
export const unixOf = (d: Date): number => Math.floor(dayStart(0, d).getTime() / 1000);
export const mdyOf = (d: Date): string =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear())}`;
export const isoOf = (d: Date): string =>
  `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface BoardSearch {
  date?: number;
  staffIds?: string[];
  statuses?: string[];
}

export async function boardSearch(): Promise<BoardSearch> {
  return P.routerSearch();
}

export async function readBoardStorage(): Promise<{ filters: string | null; date: string | null }> {
  return { filters: await P.localGet(A.filtersKey), date: await P.sessionGet(A.dateKey) };
}

export async function clearBoardStorage(): Promise<void> {
  await P.localSet(A.filtersKey, null);
  await P.sessionRemove(A.dateKey);
}

/** Board loaded: date selector up AND the filter init pushed staffIds + statuses into the URL. */
export async function waitBoard(): Promise<void> {
  await P.waitFor(A.prevDay, 20_000, 'board "Previous day"');
  await P.poll(
    async () => {
      const s = await boardSearch();
      return s.staffIds !== undefined && s.statuses !== undefined;
    },
    (v) => v,
    20_000,
  );
  await settle(500);
  await P.closeToasts();
}

/**
 * `/appointment?date=<unix>` through the router. Clears the remembered date
 * first unless asked not to — otherwise the board's init replaces `date` with it.
 */
export async function gotoBoard(date?: Date, keepStoredDate = false): Promise<void> {
  await P.escape();
  if (date !== undefined && !keepStoredDate) await P.sessionRemove(A.dateKey);
  await P.routerGo('/appointment', date === undefined ? {} : { date: unixOf(date) });
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE, { timeout: 1_000 });
  await waitBoard();
}

/** The header's appointment link — like a cashier; keeps the remembered date. */
export async function openBoardFromHeader(): Promise<void> {
  await P.escape();
  await P.clickQ(VqcCommon.headerAppointmentLink);
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE, { timeout: 1_000 });
  await waitBoard();
}

/** Number on the header link's red badge (0 when absent; "99+" → 100). */
export async function headerAppointmentBadge(): Promise<number> {
  const q: readonly VqcQuery[] = [VqcCommon.headerAppointmentLink, { css: '[data-slot="badge"]', nth: 0 }];
  if (!(await P.has(q))) return 0;
  const t = (await P.textOf(q)).trim();
  return t === '99+' ? 100 : Number(t);
}

export async function boardDateText(): Promise<string> {
  return /\d{2}\/\d{2}\/\d{4}/.exec(await P.textOf(A.dateButton))?.[0] ?? '';
}

export async function waitBoardDate(mdy: string, timeout = 10_000): Promise<string> {
  return P.poll(boardDateText, (t) => t === mdy, timeout);
}

export async function nextDay(): Promise<void> {
  await P.clickQ(A.nextDay);
  await settle(500);
}
export async function prevDay(): Promise<void> {
  await P.clickQ(A.prevDay);
  await settle(500);
}

/** Reset to Default (clears the saved filters, back to today). For `finally`. */
export async function resetBoard(): Promise<void> {
  if (!(await P.path()).startsWith('/appointment')) await gotoBoard();
  await P.escape();
  await P.clickQ(A.reset);
  await waitBoard();
}

export async function openDatePicker(): Promise<void> {
  await P.clickQ(A.dateButton);
  await P.waitFor(A.calendar, Timeouts.SHORT, 'board calendar');
}

/** A day cell `td[data-day=yyyy-MM-dd]` in the open calendar. */
export const calendarDay = (d: Date): readonly VqcQuery[] => [
  A.calendar,
  { css: `td[data-day="${isoOf(d)}"]`, nth: 0 },
];

/** Pick a day of the shown month other than the selected one (15, 16, 14, …). */
export async function pickOtherDayInShownMonth(): Promise<Date> {
  await openDatePicker();
  const iso = await P.attrOf([A.calendar, { css: 'td[data-day]:not([data-outside])', nth: 0 }], 'data-day');
  const [y, m] = (iso ?? '').split('-').map(Number);
  for (const day of [15, 16, 14, 17, 20, 21]) {
    const d = new Date(y ?? 1970, (m ?? 1) - 1, day);
    const cell = await P.info(calendarDay(d));
    if (!cell) continue;
    if (cell.attrs['data-selected'] === 'true' || cell.attrs['data-disabled'] === 'true') continue;
    await P.clickQ([...calendarDay(d), { css: 'button' }]);
    await P.waitGoneQ(A.calendar, Timeouts.SHORT, 'board calendar');
    await settle(500);
    return d;
  }
  throw new Error(`No other selectable day in the shown month (${iso ?? '?'}).`);
}

/* ------------------------------------------------------------------- *
 * Staffs / Statuses filters
 * ------------------------------------------------------------------- */

export async function filterBadge(button: readonly VqcQuery[]): Promise<number> {
  const m = /(\d+)/.exec(await P.textOf(button));
  return m ? Number(m[1]) : 0;
}

export async function openStaffFilter(): Promise<void> {
  await P.closeToasts();
  await P.clickQ(A.staffsButton);
  await P.waitFor(A.staffPopover, Timeouts.SHORT, 'Staffs popover');
}

export async function openStatusFilter(): Promise<void> {
  await P.closeToasts();
  await P.clickQ(A.statusesButton);
  await P.waitFor(A.statusPopover, Timeouts.SHORT, 'Statuses popover');
}

export async function closePopover(): Promise<void> {
  await P.escape();
  await settle(300);
}

export const staffSearchBox: readonly VqcQuery[] = [A.staffPopover, { css: 'input', nth: 0 }];

export const filterCheckbox = (pop: VqcQuery, label: string): readonly VqcQuery[] => [
  pop,
  { role: 'checkbox', name: label },
];

/** Row labels of a filter popover (first = Select All / Unselect All). */
export async function filterLabels(pop: VqcQuery): Promise<string[]> {
  return (await P.texts([pop, { css: 'label:not([cmdk-label])' }])).map((s) => s.trim());
}

export async function checkedCount(pop: VqcQuery): Promise<number> {
  return P.count([pop, { css: '[role="checkbox"][data-state="checked"]' }]);
}

export async function unselectAll(
  pop: VqcQuery,
  selectAllId: '#select-all-staff' | '#select-all-status',
): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    if ((await checkedCount(pop)) === 0) return;
    await P.clickQ([pop, { css: selectAllId }]);
    await settle(400);
  }
}

/** Search a staff in the Staffs popover, set its tick, clear the search; returns the checkbox id (= staff id). */
export async function setStaffChecked(name: string, on: boolean): Promise<string> {
  await P.fillQ(staffSearchBox, name);
  const cb = filterCheckbox(A.staffPopover, name);
  await P.waitFor(cb, Timeouts.SHORT, `staff checkbox ${name}`);
  const checked = (await P.attrOf(cb, 'data-state')) === 'checked';
  if (checked !== on) await P.clickQ(cb);
  const id = (await P.attrOf(cb, 'id')) ?? '';
  await P.fillQ(staffSearchBox, '');
  return id;
}

export async function onlyStatuses(labels: string[]): Promise<void> {
  await openStatusFilter();
  await unselectAll(A.statusPopover, '#select-all-status');
  for (const l of labels) await P.clickQ(filterCheckbox(A.statusPopover, l));
  await closePopover();
  await settle(600);
}

/* ------------------------------------------------------------------- *
 * Grid
 * ------------------------------------------------------------------- */

export interface ColumnHeader {
  name: string;
  count: number;
}

/** Rendered column headers left → right (sorted by their translateX). */
export async function columnHeaders(): Promise<ColumnHeader[]> {
  return P.exec<ColumnHeader[]>(`
    var row = document.querySelector('main div.sticky.top-0.z-60 > div');
    if (!row) return [];
    var x = function (el) { var m = /translateX\\((-?[\\d.]+)px\\)/.exec(el.style.transform || ''); return m ? Number(m[1]) : 0; };
    return Array.prototype.slice.call(row.children).sort(function (a, b) { return x(a) - x(b); }).map(function (c) {
      var lines = String(c.innerText || '').split('\\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var count = Number(lines[lines.length - 1]);
      var name = lines.slice(0, -1).join(' ').replace(/\\s*\\((Inactive|Ngưng hoạt động)\\)\\s*$/, '');
      return { name: name, count: isFinite(count) ? count : NaN };
    });
  `);
}

export async function cardCount(): Promise<number> {
  return P.count({ css: 'main [data-appointment-card]' });
}

/** Hatched (out-of-hours) blocks of column `index`. */
export async function nonWorkingBlocks(index: number): Promise<{ top: number; height: number }[]> {
  return P.exec<{ top: number; height: number }[]>(
    `
    var col = document.querySelector('main [data-index="' + arguments[0] + '"]');
    if (!col) return [];
    return Array.prototype.filter.call(col.querySelectorAll('div'), function (d) {
      return (d.style.backgroundImage || '').indexOf('repeating-linear-gradient') >= 0 && d.style.top !== '';
    }).map(function (d) { return { top: parseFloat(d.style.top), height: parseFloat(d.style.height) }; });
  `,
    index,
  );
}

/** The 96 time labels of the left axis. */
export async function timeLabels(): Promise<string[]> {
  return P.exec<string[]>(`
    var side = document.querySelector('main div.sticky.left-0');
    return side ? Array.prototype.map.call(side.querySelectorAll('span'), function (s) { return (s.textContent || '').trim(); }).filter(Boolean) : [];
  `);
}

const SCROLLER = `
  var el = Array.prototype.find.call(document.querySelectorAll('main div.overflow-auto'), function (e) { return e.scrollHeight > 8000; });
  if (!el) throw new Error('board scroller not found');
`;

export async function boardScroll(): Promise<{
  top: number;
  left: number;
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  return P.exec(`${SCROLLER}
    var r = el.getBoundingClientRect();
    return { top: el.scrollTop, left: el.scrollLeft, x: r.x, y: r.y, width: r.width, height: r.height };
  `);
}

export async function scrollBoardTo(pos: number | 'top' | 'bottom'): Promise<void> {
  await P.exec<null>(
    `${SCROLLER}
    var p = arguments[0];
    el.scrollTo({ top: p === 'top' ? 0 : p === 'bottom' ? el.scrollHeight : p, behavior: 'instant' });
    return null;
  `,
    pos,
  );
  await settle(200);
}

export async function scrollBoardX(where: 'start' | 'end'): Promise<void> {
  await P.exec<null>(
    `${SCROLLER}
    el.scrollTo({ left: arguments[0] === 'start' ? 0 : el.scrollWidth, behavior: 'instant' });
    return null;
  `,
    where,
  );
  await settle(600);
}

/** A synthetic WheelEvent on the board (the date-navigation listener reads deltaY). */
export async function dispatchBoardWheel(deltaY: number, edge?: 'top' | 'bottom'): Promise<void> {
  await P.exec<null>(
    `${SCROLLER}
    if (arguments[1] === 'top') el.scrollTop = 0;
    if (arguments[1] === 'bottom') el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: Number(arguments[0]), bubbles: true }));
    return null;
  `,
    deltaY,
    edge ?? '',
  );
}

/** The "Now" line: style.top px and whether it renders (null when absent). */
export async function nowLine(): Promise<{ top: number; visible: boolean; y: number } | null> {
  return P.exec(`
    var pill = Array.prototype.find.call(document.querySelectorAll('main span.bg-destructive'), function (s) {
      return /^(Now|Bây giờ)$/.test((s.textContent || '').trim());
    });
    if (!pill) return null;
    var line = pill.closest('div.pointer-events-none.absolute');
    if (!line) return null;
    var r = line.getBoundingClientRect();
    return { top: parseFloat(line.style.top), visible: !!line.offsetParent && r.height > 0, y: r.y };
  `);
}

export async function nowLineInViewport(): Promise<boolean> {
  const line = await nowLine();
  if (!line?.visible) return false;
  const box = await boardScroll();
  return line.y >= box.y && line.y <= box.y + box.height;
}
