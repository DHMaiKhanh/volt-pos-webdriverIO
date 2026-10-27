import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { VqcOrderHistory as OH, inMain, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from './VoltQcProbe.js';

/**
 * Order History list, date picker and Filter dialog, for the volt-qc 07 / 19 port
 * (volt-qc `src/flows/order-history.ts`). Reads and filters only.
 */

/** react-day-picker `data-day` key on this screen: `M/D/YYYY` (en-US toLocaleDateString). */
export const dayKey = (d: Date): string =>
  `${String(d.getMonth() + 1)}/${String(d.getDate())}/${String(d.getFullYear())}`;
export const mdy = (d: Date): string =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear())}`;
export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Each rendered row as "OD…-… | rest | of | the | lines" (the code is split one char per span). */
export async function rowTexts(): Promise<string[]> {
  return P.exec<string[]>(
    `
    return Array.prototype.map.call(document.querySelectorAll(arguments[0]), function (e) {
      var m = (e.textContent || '').replace(/\\s/g, '').match(/OD\\d{6}-\\d+/);
      var code = m ? m[0] : '';
      var rest = String(e.innerText || '').split(/\\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
      var i = 0;
      while (i < rest.length && rest[i].length === 1 && code.indexOf(rest[i]) >= 0) i++;
      return [code].concat(rest.slice(i)).filter(Boolean).join(' | ');
    });
  `,
    OH.rowCss,
  );
}

export async function rowCodes(): Promise<string[]> {
  return (await rowTexts()).map((t) => /^OD\d{6}-\d+/.exec(t)?.[0] ?? '').filter(Boolean);
}

/** MM/dd/yyyy of each rendered row's time column. */
export async function rowDates(): Promise<string[]> {
  return (await rowTexts())
    .map((t) => /(\d{2}\/\d{2}\/\d{4}) \d{2}:\d{2} [AP]M/.exec(t)?.[1] ?? '')
    .filter(Boolean);
}

export const parseMdy = (s: string): Date => {
  const [m, d, y] = s.split('/').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

export async function rowCount(): Promise<number> {
  return P.count({ css: OH.rowCss });
}

/** Open the row whose code is `code` (the link carries the split-char code in its text). */
export async function openRow(code: string): Promise<void> {
  await P.clickQ({ css: OH.rowCss, hasTextRe: code.split('').join('\\s*') });
  await settle(600);
}

export async function search(term: string): Promise<void> {
  await P.fillQ(OH.searchBox, term);
  await settle(900);
}

export async function emptyShown(): Promise<boolean> {
  return P.has(inMain({ text: OH.noOrders }));
}

/* ------------------------------------------------------------------- *
 * Date range
 * ------------------------------------------------------------------- */

const POP = OH.datePopover;

export async function openDatePicker(): Promise<void> {
  await P.clickQ(OH.dateRange);
  await P.waitFor(POP, Timeouts.SHORT, 'date popover');
}

export async function dateRangeText(): Promise<string> {
  return (await P.textOf(OH.dateRange)).trim();
}

/** The day button for `d`, paging months (by the days shown, not by today) until it renders. */
export async function dayButton(d: Date, maxMonths = 90): Promise<readonly VqcQuery[]> {
  const q: readonly VqcQuery[] = [POP, { css: `button[data-day="${dayKey(d)}"]`, nth: 0 }];
  const target = startOfDay(d).getTime();
  for (let i = 0; i < maxMonths; i += 1) {
    if (await P.has(q)) return q;
    const shown = await P.exec<number[]>(`
      var pops = Array.prototype.filter.call(document.querySelectorAll('[data-radix-popper-content-wrapper]'), function (p) {
        return /Apply/.test(p.textContent || '');
      });
      var pop = pops[pops.length - 1];
      if (!pop) return [];
      return Array.prototype.map.call(pop.querySelectorAll('button[data-day]'), function (e) {
        var p = (e.getAttribute('data-day') || '').split('/').map(Number);
        return new Date(p[2], p[0] - 1, p[1]).getTime();
      });
    `);
    const goBack = shown.length > 0 ? target < Math.min(...shown) : target < startOfDay(new Date()).getTime();
    await P.clickQ([
      POP,
      { role: 'button', nameRe: goBack ? 'Previous Month' : 'Next Month', flags: 'i', nth: 0 },
    ]);
    await settle(120);
  }
  return q;
}

/**
 * Pick a range and Apply. The calendar is react-day-picker v9 in range mode:
 * with a range already set, one click only moves one END of it — so reset with
 * "Today" first, then from (→ from…today), then to.
 */
export async function pickDateRange(from: Date, to: Date): Promise<void> {
  const today = startOfDay(new Date()).getTime();
  await openDatePicker();
  await P.clickQ([POP, { role: 'button', name: 'Today' }]);
  await P.waitGoneQ(POP, Timeouts.SHORT, 'date popover');
  await settle(800);
  if (startOfDay(from).getTime() === today && startOfDay(to).getTime() === today) return;
  await openDatePicker();
  await P.clickQ(await dayButton(from));
  if (startOfDay(to).getTime() !== today) await P.clickQ(await dayButton(to));
  await P.clickQ([POP, { role: 'button', name: 'Apply' }]);
  await P.waitGoneQ(POP, Timeouts.SHORT, 'date popover');
  await settle(1_000);
}

/** Visible copies of a day cell, and how many of them are painted as the range end. */
export async function dayCellCounts(d: Date): Promise<{ shown: number; lit: number }> {
  return P.exec<{ shown: number; lit: number }>(
    `
    var pops = Array.prototype.filter.call(document.querySelectorAll('[data-radix-popper-content-wrapper]'), function (p) {
      return /Apply/.test(p.textContent || '');
    });
    var pop = pops[pops.length - 1];
    if (!pop) return { shown: 0, lit: 0 };
    var vis = function (sel) {
      return Array.prototype.filter.call(pop.querySelectorAll(sel), function (e) { return e.getClientRects().length > 0; }).length;
    };
    var key = arguments[0];
    return { shown: vis('button[data-day="' + key + '"]'), lit: vis('button[data-day="' + key + '"][data-range-end="true"]') };
  `,
    dayKey(d),
  );
}

/* ------------------------------------------------------------------- *
 * Filter dialog
 * ------------------------------------------------------------------- */

export const filterDialog: VqcQuery = {
  role: 'dialog',
  hasText: 'Filter',
  hasCss: '[role="combobox"]',
  nth: -1,
};
export const inFilter = (q: VqcQuery): readonly VqcQuery[] => [filterDialog, q];

export async function openFilter(): Promise<void> {
  await P.clickQ(OH.filterButton);
  await P.waitFor(filterDialog, Timeouts.SHORT, 'Filter dialog');
}

export async function filterRedDotShown(): Promise<boolean> {
  return P.has(OH.filterRedDot);
}

export interface HistoryFilter {
  clear?: boolean;
  sortBy?: 'Date completed' | 'Last updated';
  /** Status checkbox ids without the `status-` prefix. */
  statuses?: string[];
  /** Payment checkbox ids: card | cash | gift-card | other. */
  payments?: string[];
  confirm?: boolean;
}

/** Open Filter, set it, Confirm (or Close when Confirm stays disabled because nothing changed). */
export async function applyFilter(f: HistoryFilter): Promise<void> {
  await openFilter();
  if (f.clear) await P.clickQ(inFilter({ role: 'button', name: 'Clear' }));
  if (f.sortBy) {
    await P.clickQ(inFilter({ role: 'combobox', nth: 0 }));
    await P.clickQ({ role: 'option', name: f.sortBy });
  }
  if (f.payments?.length) {
    await P.clickQ(inFilter({ role: 'button', nameRe: 'Select payment method' }));
    for (const p of f.payments) await P.clickQ({ css: `[id="${p}"]` });
    await P.escape();
  }
  if (f.statuses?.length) {
    await P.clickQ(inFilter({ role: 'button', nameRe: 'Select status' }));
    for (const s of f.statuses) await P.clickQ({ css: `[id="status-${s}"]` });
    await P.escape();
  }
  if (f.confirm !== false) {
    await P.waitFor(filterDialog, Timeouts.SHORT, 'Filter dialog (after closing the popover)');
    const confirm = inFilter({ role: 'button', name: 'Confirm' });
    if (await P.isDisabled(confirm)) await P.clickQ(inFilter({ role: 'button', name: 'Close', nth: 0 }));
    else await P.clickQ(confirm);
    await P.waitGoneQ(filterDialog, Timeouts.SHORT, 'Filter dialog');
    await settle(800);
  }
}

/** Scroll the virtualised list to its end, collecting every code (stops when nothing new arrives 3×). */
export async function collectCodes(maxRounds = 60): Promise<string[]> {
  const seen: string[] = [];
  let stable = 0;
  for (let i = 0; i < maxRounds && stable < 3; i += 1) {
    const before = seen.length;
    for (const c of await rowCodes()) if (!seen.includes(c)) seen.push(c);
    stable = seen.length === before ? stable + 1 : 0;
    await P.exec<null>(
      `
      var rows = document.querySelectorAll(arguments[0]);
      var last = rows[rows.length - 1];
      if (last) last.scrollIntoView({ block: 'end' });
      return null;
    `,
      OH.rowCss,
    );
    await settle(700);
  }
  return seen;
}

/** Passcode-guard dots that are filled. */
export async function passcodeDotsFilled(): Promise<number> {
  return P.count([
    { role: 'dialog', hasTextRe: 'Enter staff code', nth: -1 },
    { css: 'div.rounded-full.bg-primary-500' },
  ]);
}
