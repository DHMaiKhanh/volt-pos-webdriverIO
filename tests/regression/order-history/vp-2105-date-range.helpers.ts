/**
 * Two-calendar reading / driving for the VP-2105 spec — the Order History date-range
 * popover (`src/components/date-range-picker.tsx`): two react-day-picker v9 calendars,
 * each a `data-slot="calendar"` root with its own Previous / Next Month buttons.
 *
 * NOT a spec (`*.helpers.ts`). Read-only: nothing here writes an order. Builds on the
 * volt-qc Order History probe (`src/pages/voltqc/pos/orderHistoryProbe.ts`).
 */

import { Timeouts } from '../../../configs/constants/timeouts.js';
import { VqcOrderHistory as OH, type VqcQuery } from '../../../src/constants/testids.voltqc-pos.js';
import { VpDateRange as DR } from '../../../src/constants/testids.vp-split-tip-history.js';
import { goToOrderHistory, returnToHome } from '../../../src/flows/index.js';
import { settle } from '../../../src/helpers/wait.js';
import { orderHistoryPage } from '../../../src/pages/index.js';
import { openDatePicker, search } from '../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';

const POP = OH.datePopover;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface CalDay {
  /** `YYYY-MM-DD` — the gridcell `<td>`'s `data-day`. The inner button's `data-day`
   * follows the OS locale (`02/11/2026` on a dd/MM machine), so it is never parsed. */
  key: string;
  year: number;
  /** 0-based month. */
  month: number;
  day: number;
  selected: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
}

export interface CalInfo {
  caption: string;
  year: number;
  /** 0-based month of the caption; -1 when the caption did not parse. */
  month: number;
  /** Day cells actually painted (visible, not `visibility: hidden`). */
  days: CalDay[];
}

/** Fresh Order History list (filters / range / search back to default). */
export async function openHistoryList(): Promise<void> {
  if (await orderHistoryPage.isActive()) await returnToHome();
  await goToOrderHistory();
  await P.waitFor(OH.heading, 15_000, 'Order History heading');
  if ((await P.inputValue(OH.searchBox)) !== '') await search('');
}

/** Both calendars of the open popover, left to right. */
export async function calendars(): Promise<CalInfo[]> {
  const raw = await P.exec<
    { caption: string; days: { key: string; sel: boolean; start: boolean; end: boolean }[] }[]
  >(
    `
    var pops = Array.prototype.filter.call(document.querySelectorAll('[data-radix-popper-content-wrapper]'), function (p) {
      return /Apply/.test(p.textContent || '');
    });
    var pop = pops[pops.length - 1];
    if (!pop) return [];
    var calCss = arguments[0], capCss = arguments[1], dayCss = arguments[2];
    var shown = function (e) {
      return e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
    };
    return Array.prototype.map.call(pop.querySelectorAll(calCss), function (cal) {
      var cap = cal.querySelector(capCss);
      return {
        caption: String((cap && cap.textContent) || '').trim(),
        days: Array.prototype.filter.call(cal.querySelectorAll(dayCss), shown).map(function (b) {
          var td = b.closest('td[data-day]');
          return {
            key: (td && td.getAttribute('data-day')) || '',
            sel: b.getAttribute('data-selected') === 'true',
            start: b.getAttribute('data-range-start') === 'true',
            end: b.getAttribute('data-range-end') === 'true',
          };
        }),
      };
    });
  `,
    DR.calendarCss,
    DR.captionCss,
    DR.dayCss,
  );
  return raw.map((c) => {
    const month = MONTHS.findIndex((m) => c.caption.startsWith(m));
    const year = Number(/(\d{4})/.exec(c.caption)?.[1] ?? Number.NaN);
    return {
      caption: c.caption,
      month,
      year,
      days: c.days.map((d) => {
        const [y, m, day] = d.key.split('-').map(Number);
        return {
          key: d.key,
          year: y ?? Number.NaN,
          month: (m ?? 0) - 1,
          day: day ?? Number.NaN,
          selected: d.sel,
          rangeStart: d.start,
          rangeEnd: d.end,
        };
      }),
    };
  });
}

/** Painted cells of `cal` that belong to another month than its caption. */
export const foreignDays = (cal: CalInfo): CalDay[] =>
  cal.days.filter((d) => d.month !== cal.month || d.year !== cal.year);

/** Day keys painted in BOTH calendars. */
export function sharedKeys(cals: readonly CalInfo[]): string[] {
  const [a, b] = cals;
  if (!a || !b) return [];
  const right = new Set(b.days.map((d) => d.key));
  return [...new Set(a.days.map((d) => d.key))].filter((k) => right.has(k));
}

/** Day-of-month of every selected cell of `cal`, ascending. */
export const selectedDays = (cal: CalInfo | undefined): number[] =>
  (cal?.days ?? [])
    .filter((d) => d.selected)
    .map((d) => d.day)
    .sort((x, y) => x - y);

/** `YYYY-MM-DD`, matching the gridcell `<td data-day>` (locale-independent). */
export const isoDay = (d: Date): string =>
  `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const calendar = (i: number): VqcQuery => ({ css: DR.calendarCss, nth: i });

const monthIndex = (year: number, month: number): number => year * 12 + month;

/** Page calendar `i` (0 = left, 1 = right) until its caption shows `target`'s month. */
export async function showMonth(i: number, target: Date): Promise<void> {
  const want = monthIndex(target.getFullYear(), target.getMonth());
  for (let guard = 0; guard < 120; guard += 1) {
    const cal = (await calendars())[i];
    if (!cal || cal.month < 0) throw new Error(`Calendar ${String(i)} has no readable caption`);
    const diff = want - monthIndex(cal.year, cal.month);
    if (diff === 0) return;
    await P.clickQ([POP, calendar(i), diff < 0 ? DR.previousMonth : DR.nextMonth]);
    await settle(120);
  }
  throw new Error(
    `Calendar ${String(i)} never reached ${String(target.getMonth() + 1)}/${String(target.getFullYear())}`,
  );
}

/** Left calendar on `left`'s month, right calendar on the month after. */
export async function showMonths(left: Date): Promise<void> {
  await showMonth(0, left);
  await showMonth(1, new Date(left.getFullYear(), left.getMonth() + 1, 1));
}

/** Click day `d` inside calendar `i` (never its twin in the other calendar). */
export async function clickDay(i: number, d: Date): Promise<void> {
  await P.clickQ([POP, calendar(i), { css: `td[data-day="${isoDay(d)}"] button`, nth: 0 }]);
  await settle(150);
}

/**
 * Reset to Today (one click on a set range only moves one end — see
 * `orderHistoryProbe.pickDateRange`), reopen, put `left` / `left + 1` on screen and
 * pick `from` → `to` in their own calendars. The popover stays OPEN (no Apply).
 */
export async function selectRangeInPopover(left: Date, from: Date, to: Date): Promise<void> {
  await openDatePicker();
  await P.clickQ([POP, DR.today]);
  await P.waitGoneQ(POP, Timeouts.SHORT, 'date popover');
  await settle(800);
  await openDatePicker();
  const calOf = (d: Date): number =>
    monthIndex(d.getFullYear(), d.getMonth()) === monthIndex(left.getFullYear(), left.getMonth()) ? 0 : 1;
  await showMonths(left);
  await clickDay(calOf(from), from);
  await showMonths(left);
  await clickDay(calOf(to), to);
}

export async function applyPopover(): Promise<void> {
  await P.clickQ([POP, DR.apply]);
  await P.waitGoneQ(POP, Timeouts.SHORT, 'date popover');
  await settle(1_000);
}

export async function cancelPopover(): Promise<void> {
  if (!(await P.has(POP))) return;
  await P.clickQ([POP, DR.cancel]);
  await P.waitGoneQ(POP, Timeouts.SHORT, 'date popover');
}

export async function todayPopover(): Promise<void> {
  await P.clickQ([POP, DR.today]);
  await P.waitGoneQ(POP, Timeouts.SHORT, 'date popover');
  await settle(1_500);
}

export const isPopoverOpen = (): Promise<boolean> => P.has(POP);
