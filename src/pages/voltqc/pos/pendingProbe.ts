import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { VqcPending, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from './VoltQcProbe.js';

/**
 * /order-pending filter bar + grid, for the volt-qc 06-pending port
 * (volt-qc `src/flows/pending.ts`). Filters only — nothing here opens a card.
 */

/** Date → "MM/dd/yyyy" (the `#selected-date-range` label, en-US). */
export const mdy = (d: Date): string =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear())}`;

/** Date → "yyyy-MM-dd" (react-day-picker 9 `td[data-day]`). */
export const isoDay = (d: Date): string =>
  `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};

/** "MMM d, yyyy hh:mm a" — the card time when the range spans several days. */
export const DATETIME_MEDIUM_RE = /\b[A-Z][a-z]{2} \d{1,2}, \d{4} \d{2}:\d{2} (AM|PM)\b/;

const POP = VqcPending.calendarPopover;

/** Preset combobox → read its option labels → Escape. */
export async function presetOptions(): Promise<string[]> {
  await P.clickQ(VqcPending.presetCombo);
  await P.waitFor({ role: 'option' }, Timeouts.SHORT, 'preset options');
  const names = (await P.texts({ role: 'option' })).map((t) => t.trim()).filter(Boolean);
  await P.escape();
  return names;
}

export async function choosePreset(label: string): Promise<void> {
  await P.clickQ(VqcPending.presetCombo);
  await P.clickQ({ role: 'option', name: label });
  await settle(500);
}

export async function openCalendar(): Promise<void> {
  await P.clickQ(VqcPending.dateRange);
  await P.waitFor(POP, Timeouts.SHORT, 'date popover');
}

/** Click one day cell, stepping the RIGHT calendar back a month at a time until it shows. */
export async function clickCalendarDay(day: Date): Promise<void> {
  const cell: readonly VqcQuery[] = [
    POP,
    { css: `td[data-day="${isoDay(day)}"]:not([data-outside]) button`, nth: 0 },
  ];
  for (let i = 0; i < 40 && !(await P.has(cell)); i += 1) {
    await P.clickQ([POP, { role: 'button', nameRe: 'previous month', flags: 'i', nth: -1 }]);
    await settle(150);
  }
  await P.clickQ(cell);
  await settle(200);
}

/** Range = click `from` twice (resets to {from, from}), then `to`; Apply or Cancel. */
export async function pickDateRange(from: Date, to: Date, apply = true): Promise<void> {
  await openCalendar();
  await clickCalendarDay(from);
  await clickCalendarDay(from);
  if (isoDay(to) !== isoDay(from)) await clickCalendarDay(to);
  await P.clickQ([POP, { role: 'button', name: apply ? 'Apply' : 'Cancel' }]);
  await P.waitGoneQ(POP, Timeouts.SHORT, 'date popover');
  await settle(500);
}

export interface PendingCard {
  id: string;
  text: string;
}

export async function renderedCards(): Promise<PendingCard[]> {
  const raw = await P.exec<string[]>(`
    return Array.prototype.filter.call(document.querySelectorAll('main button'), function (b) {
      return /^\\s*OD\\d{6}-\\d+/.test(b.textContent || '') && b.getClientRects().length > 0;
    }).map(function (b) { return String(b.innerText || b.textContent || ''); });
  `);
  return raw
    .map((t) => ({ id: /OD\d{6}-\d+/.exec(t)?.[0] ?? '', text: t.replace(/\s*\n+\s*/g, ' | ') }))
    .filter((c) => c.id !== '');
}

export async function renderedIds(): Promise<string[]> {
  return (await renderedCards()).map((c) => c.id);
}

const SCROLLER = `
  var card = Array.prototype.find.call(document.querySelectorAll('main button'), function (b) {
    return /^\\s*OD\\d{6}-\\d+/.test(b.textContent || '');
  });
  var el = card ? card.parentElement : null;
  while (el && !(el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
`;

/** Scroll the card grid's own scroller to the top or bottom. */
export async function scrollList(where: 'top' | 'bottom'): Promise<boolean> {
  const ok = await P.exec<boolean>(
    `${SCROLLER} if (!el) return false; el.scrollTop = arguments[0] === 'top' ? 0 : el.scrollHeight; return true;`,
    where,
  );
  await settle(700);
  return ok;
}

/** Scroll down step by step, collecting every card id the virtualised grid renders. */
export async function collectAllIds(maxSteps = 60): Promise<string[]> {
  const seen = new Set<string>();
  await scrollList('top');
  for (let i = 0; i < maxSteps; i += 1) {
    for (const id of await renderedIds()) seen.add(id);
    const moved = await P.exec<boolean>(
      `${SCROLLER} if (!el) return false; var before = el.scrollTop; el.scrollTop += Math.max(200, el.clientHeight - 100); return el.scrollTop !== before;`,
    );
    await settle(350);
    if (!moved) {
      for (const id of await renderedIds()) seen.add(id);
      break;
    }
  }
  return [...seen];
}

/** Cards per grid row (`div.grid.grid-cols-4 > button`). */
export async function cardsPerRow(): Promise<number[]> {
  return P.exec<number[]>(`
    return Array.prototype.map.call(document.querySelectorAll('main div.grid.grid-cols-4'), function (r) {
      return r.querySelectorAll(':scope > button').length;
    });
  `);
}
