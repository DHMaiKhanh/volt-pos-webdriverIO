import { $, browser } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { RptCss, RptRoutes, RptXpath } from '../../../constants/testids.voltqc-reports-time.js';
import { settle } from '../../../helpers/wait.js';
import {
  asText,
  clickIn,
  clickOption,
  closeStrayDialogs,
  comboOptions,
  countText,
  existsIn,
  fillInput,
  findIn,
  hasText,
  idle,
  navigateRaw,
  openReport,
  optionTexts,
} from './rptDom.js';
import { calendarDaySelector } from './rptReports.js';

/**
 * Time Keeping dialog + Time Tracking page helpers for the volt-qc 09-time
 * ports (volt-qc `e2e/src/flows/time.ts`). Read-only: nothing here checks a
 * staff in or out, or saves a record.
 */

/* ------------------------------------------------------------------------- *
 * Time Keeping dialog
 * ------------------------------------------------------------------------- */

/** Mark the visible Time Keeping dialog so scoped lookups can target it. */
const TK_SCOPE = '[data-voltqc-tk="1"]';

async function markTk(): Promise<boolean> {
  return browser.execute(function () {
    for (const e of Array.from(document.querySelectorAll('[data-voltqc-tk]')))
      e.removeAttribute('data-voltqc-tk');
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(function (d) {
      if (d.getClientRects().length === 0) return false;
      return Array.from(d.querySelectorAll('*')).some(function (e) {
        return e.children.length === 0 && (e.textContent ?? '').trim() === 'Time Keeping';
      });
    });
    const dlg = dialogs[dialogs.length - 1];
    if (!dlg) return false;
    dlg.setAttribute('data-voltqc-tk', '1');
    return true;
  });
}

export async function tkOpen(): Promise<boolean> {
  return markTk();
}

export async function waitTk(open: boolean, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
  return browser
    .waitUntil(async () => (await markTk()) === open, { timeout, interval: 200 })
    .then(
      () => true,
      () => false,
    );
}

/** Open Time Keeping by adding `dialog=time-keeping` to the current route's search. */
export async function openTimeKeepingByUrl(): Promise<void> {
  await closeStrayDialogs();
  await browser.execute(function () {
    const r = (window as unknown as Record<string, unknown>)['__TSR_ROUTER__'] as {
      state: { location: { pathname: string; search?: Record<string, unknown> } };
      navigate: (o: object) => unknown;
    };
    const loc = r.state.location;
    void r.navigate({
      to: loc.pathname,
      search: { ...(loc.search ?? {}), dialog: 'time-keeping' },
      replace: true,
    });
  });
  if (!(await waitTk(true))) throw new Error('Time Keeping dialog did not open from ?dialog=time-keeping');
  await idle(100);
}

/** Header clock button (no aria-label — identified by its svg clipPath id). */
export async function headerTimeKeepingPresent(): Promise<boolean> {
  return existsIn(
    'header, [role="banner"], body',
    `button:has(${RptCss.headerTimeKeepingIcon})`,
    Timeouts.SHORT,
  );
}

export async function clickHeaderTimeKeeping(): Promise<void> {
  await closeStrayDialogs();
  const btn = await $(`button:has(${RptCss.headerTimeKeepingIcon})`).getElement();
  await btn.waitForClickable({ timeout: Timeouts.MEDIUM });
  await btn.click();
  if (!(await waitTk(true))) throw new Error('Time Keeping dialog did not open from the header clock icon');
}

export async function closeTkWithEscape(): Promise<void> {
  if (!(await markTk())) return;
  await browser.keys([Key.Escape]);
  await waitTk(false, Timeouts.SHORT);
}

export async function closeTkWithX(): Promise<void> {
  await markTk();
  const close = await findIn(
    TK_SCOPE,
    './/button[@aria-label="Close" or normalize-space(.)="Close" or .//span[normalize-space(.)="Close"]]',
  );
  await close.click();
  await waitTk(false, Timeouts.SHORT);
}

/** Click the overlay at the far left edge of the viewport (the dialog is narrower than the window). */
export async function closeTkWithOverlay(): Promise<void> {
  await browser
    .action('pointer', { parameters: { pointerType: 'mouse' } })
    .move({ x: 5, y: 300, origin: 'viewport' })
    .down({ button: 0 })
    .up({ button: 0 })
    .perform();
  await waitTk(false, Timeouts.SHORT);
}

export type TkColumn = 'Unavailable' | 'Available';

export interface TkTile {
  name: string;
  text: string;
  disabled: boolean;
  selected: boolean;
}

/** Tiles of one column, in display order. */
export async function tkTiles(kind: TkColumn): Promise<TkTile[]> {
  await markTk();
  return browser.execute(
    function (scope: string, k: string, tileCss: string, nameCss: string) {
      const dlg = document.querySelector(scope);
      if (!dlg) return [] as { name: string; text: string; disabled: boolean; selected: boolean }[];
      const card = Array.from(dlg.querySelectorAll('[data-slot="card"]')).find(function (c) {
        return Array.from(c.querySelectorAll('*')).some(function (e) {
          return e.children.length === 0 && (e.textContent ?? '').trim() === `${k} Staff`;
        });
      });
      if (!card) return [];
      return Array.from(card.querySelectorAll(tileCss)).map(function (t) {
        const el = t as HTMLElement;
        return {
          name: (el.querySelector<HTMLElement>(nameCss)?.innerText ?? '').trim(),
          text: (el.innerText || '').replace(/\s*\n+\s*/g, ' | '),
          disabled: el.className.includes('opacity-50'),
          selected: /(^|\s)bg-primary(\s|$)/.test(el.className),
        };
      });
    },
    TK_SCOPE,
    kind,
    RptCss.tkTile,
    RptCss.tkTileName,
  );
}

/** The number on a column's badge. */
export async function tkBadge(kind: TkColumn): Promise<number> {
  await markTk();
  return browser.execute(
    function (scope: string, k: string, badgeCss: string) {
      const dlg = document.querySelector(scope);
      if (!dlg) return Number.NaN;
      const card = Array.from(dlg.querySelectorAll('[data-slot="card"]')).find(function (c) {
        return Array.from(c.querySelectorAll('*')).some(function (e) {
          return e.children.length === 0 && (e.textContent ?? '').trim() === `${k} Staff`;
        });
      });
      const b = card?.querySelector(badgeCss);
      return b ? Number((b.textContent ?? '').trim()) : Number.NaN;
    },
    TK_SCOPE,
    kind,
    RptCss.badge,
  );
}

export async function tkSearch(text: string): Promise<void> {
  await markTk();
  const box = await findIn(TK_SCOPE, 'input[placeholder="Search staff"]');
  await fillInput(box, text);
  await settle(300);
}

/** Click the n-th ENABLED tile of a column. */
export async function tkClickTile(kind: TkColumn, enabledIndex: number): Promise<void> {
  await markTk();
  const marked = await browser.execute(
    function (scope: string, k: string, tileCss: string, n: number) {
      for (const e of Array.from(document.querySelectorAll('[data-voltqc-tile]')))
        e.removeAttribute('data-voltqc-tile');
      const dlg = document.querySelector(scope);
      if (!dlg) return false;
      const card = Array.from(dlg.querySelectorAll('[data-slot="card"]')).find(function (c) {
        return Array.from(c.querySelectorAll('*')).some(function (e) {
          return e.children.length === 0 && (e.textContent ?? '').trim() === `${k} Staff`;
        });
      });
      if (!card) return false;
      const tiles = Array.from(card.querySelectorAll(tileCss)).filter(function (t) {
        return !(t as HTMLElement).className.includes('opacity-50');
      });
      const t = tiles[n];
      if (!t) return false;
      t.setAttribute('data-voltqc-tile', '1');
      return true;
    },
    TK_SCOPE,
    kind,
    RptCss.tkTile,
    enabledIndex,
  );
  if (!marked) throw new Error(`No enabled ${kind} tile #${String(enabledIndex)}`);
  const el = await $('[data-voltqc-tile="1"]').getElement();
  await el.scrollIntoView({ block: 'center' }).catch(() => undefined);
  await el.click();
  await settle(250);
}

/** Visible "Check In" / "Check Out" buttons in the dialog. */
export async function tkActionButtons(): Promise<string[]> {
  await markTk();
  return browser.execute(function (scope: string) {
    const dlg = document.querySelector(scope);
    if (!dlg) return [] as string[];
    return Array.from(dlg.querySelectorAll('button'))
      .filter(function (b) {
        return b.getClientRects().length > 0 && /^Check (In|Out)$/.test((b.textContent ?? '').trim());
      })
      .map(function (b) {
        return (b.textContent ?? '').trim();
      });
  }, TK_SCOPE);
}

export async function tkNoStaffCount(): Promise<number> {
  await markTk();
  return countText(TK_SCOPE, 'No staff found.');
}

/* ------------------------------------------------------------------------- *
 * Time Tracking page
 * ------------------------------------------------------------------------- */

export interface TtRow {
  index: number;
  no: string;
  staff: string;
  dateIn: string;
  dateOut: string;
  total: string;
  createdAt: string;
  updatedAt: string;
  note: string;
}

export async function ttHeadingVisible(): Promise<boolean> {
  return hasText(RptCss.main, 'Time Tracking', 'h1, h2, h3, [role="heading"]');
}

/** Open /time-tracking (answering the gate when it is on). */
export async function ttOpen(): Promise<void> {
  await openReport(RptRoutes.timeTracking, undefined, { fresh: true });
  await browser.waitUntil(ttHeadingVisible, {
    timeout: Timeouts.MEDIUM,
    interval: 250,
    timeoutMsg: 'Time Tracking heading never appeared',
  });
}

/** Navigate to /time-tracking WITHOUT answering the gate. */
export async function ttNavigateRaw(): Promise<void> {
  await navigateRaw(RptRoutes.home);
  await navigateRaw(RptRoutes.timeTracking);
}

export async function ttPresetOptions(): Promise<string[]> {
  return comboOptions(RptCss.main);
}

export async function ttPreset(label: string): Promise<void> {
  await clickIn(RptCss.main, RptCss.combobox);
  await clickOption(label);
  await idle(100);
}

export async function ttSearch(text: string): Promise<void> {
  const box = await findIn(RptCss.main, 'input[placeholder="Search staff"]');
  await fillInput(box, text);
  await idle(300);
}

export async function ttRows(): Promise<TtRow[]> {
  const raw = await browser.execute(function (css: string) {
    return Array.from(document.querySelectorAll(`main ${css}`)).map(function (tr) {
      return {
        index: Number(tr.getAttribute('data-index')),
        cells: Array.from(tr.querySelectorAll('td')).map(function (td) {
          return ((td as HTMLElement).innerText || '').trim();
        }),
      };
    });
  }, RptCss.ttRow);
  return raw
    .map(({ index, cells }) => ({
      index,
      no: cells[0] ?? '',
      staff: cells[1] ?? '',
      dateIn: cells[2] ?? '',
      dateOut: cells[3] ?? '',
      total: cells[4] ?? '',
      createdAt: cells[5] ?? '',
      updatedAt: cells[6] ?? '',
      note: cells[7] ?? '',
    }))
    .sort((a, b) => a.index - b.index);
}

/** Scroll the virtualised table to its end, collecting every row by data-index. */
export async function ttCollectRows(maxRounds = 40): Promise<TtRow[]> {
  const byIndex = new Map<number, TtRow>();
  let stable = 0;
  for (let i = 0; i < maxRounds && stable < 3; i += 1) {
    const before = byIndex.size;
    for (const r of await ttRows()) byIndex.set(r.index, r);
    stable = byIndex.size === before ? stable + 1 : 0;
    await browser.execute(function (css: string) {
      const rows = document.querySelectorAll(`main ${css}`);
      const last = rows[rows.length - 1] as HTMLElement | undefined;
      if (!last) return;
      last.scrollIntoView({ block: 'end' });
      let sc: HTMLElement | null = last;
      while (
        sc &&
        !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))
      )
        sc = sc.parentElement;
      if (sc) sc.scrollTop += 1200;
    }, RptCss.ttRow);
    await idle(150);
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

/** Row buttons (Edit / Delete …) of the row with this data-index. */
export async function ttRowButtons(index: number): Promise<string[]> {
  return browser.execute(function (i: number) {
    const tr = document.querySelector(`main tbody tr[data-index="${String(i)}"]`);
    if (!tr) return [] as string[];
    return Array.from(tr.querySelectorAll('button')).map(function (b) {
      return `${(b.textContent ?? '').trim()} ${b.getAttribute('aria-label') ?? ''}`.trim();
    });
  }, index);
}

/** Pick a Custom range in the page date picker: Today first, then from/to + Apply. */
export async function ttPickRange(from: Date, to: Date): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sod = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  await clickIn(RptCss.main, RptCss.dateRange);
  await clickIn(RptCss.popper, RptXpath.buttonText('Today'));
  await settle(400);
  if (sod(from) === today.getTime() && sod(to) === today.getTime()) return;

  await clickIn(RptCss.main, RptCss.dateRange);
  await navigateCalendarTo(from);
  await clickIn(RptCss.popper, calendarDaySelector(from));
  await settle(200);
  if (sod(to) !== today.getTime()) {
    await navigateCalendarTo(to);
    await clickIn(RptCss.popper, calendarDaySelector(to));
    await settle(200);
  }
  await clickIn(RptCss.popper, RptXpath.buttonText('Apply'));
  await idle(300);
}

/** If `d` is not rendered, walk the calendar back with its month dropdowns / previous buttons. */
async function navigateCalendarTo(d: Date): Promise<void> {
  if (await existsIn(RptCss.popper, calendarDaySelector(d), Timeouts.ANIMATION)) return;
  // Caption dropdowns (react-day-picker `captionLayout="dropdown"`): native <select> month / year.
  const moved = await browser.execute(
    function (css: string, y: number, m: number) {
      const pops = Array.from(document.querySelectorAll(css)).filter(function (p) {
        return p.getClientRects().length > 0;
      });
      const pop = pops[pops.length - 1];
      if (!pop) return false;
      const selects = Array.from(pop.querySelectorAll('select'));
      if (selects.length < 2) return false;
      const set = function (s: HTMLSelectElement, v: string): void {
        s.value = v;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set(selects[1] as HTMLSelectElement, String(y));
      set(selects[0] as HTMLSelectElement, String(m));
      return true;
    },
    RptCss.popper,
    d.getFullYear(),
    d.getMonth(),
  );
  if (moved) {
    await settle(300);
    if (await existsIn(RptCss.popper, calendarDaySelector(d), Timeouts.ANIMATION)) return;
  }
  for (let i = 0; i < 120; i += 1) {
    if (await existsIn(RptCss.popper, calendarDaySelector(d), 200)) return;
    const prev = await existsIn(
      RptCss.popper,
      './/button[contains(@aria-label, "previous") or contains(@aria-label, "Previous")]',
      200,
    );
    if (!prev) break;
    await clickIn(
      RptCss.popper,
      './/button[contains(@aria-label, "previous") or contains(@aria-label, "Previous")]',
    );
    await settle(120);
  }
}

/* ------------------------------------------------------------------------- *
 * Add Time Keeping dialog (opened, inspected, closed — never submitted)
 * ------------------------------------------------------------------------- */

const ADD_SCOPE = '[data-voltqc-tt-add="1"]';

async function markAdd(): Promise<boolean> {
  return browser.execute(function () {
    for (const e of Array.from(document.querySelectorAll('[data-voltqc-tt-add]')))
      e.removeAttribute('data-voltqc-tt-add');
    const d = Array.from(document.querySelectorAll('[role="dialog"]')).filter(function (x) {
      return x.getClientRects().length > 0 && (x.textContent ?? '').includes('Add New Time Keeping');
    });
    const dlg = d[d.length - 1];
    if (!dlg) return false;
    dlg.setAttribute('data-voltqc-tt-add', '1');
    return true;
  });
}

/** Click the round (+) button next to the search box and wait for "Add New Time Keeping". */
export async function ttOpenAdd(): Promise<void> {
  await clickIn(RptCss.main, 'button[class*="size-13"][class*="rounded-full"]');
  const ok = await browser.waitUntil(markAdd, { timeout: Timeouts.MEDIUM, interval: 200 }).then(
    () => true,
    () => false,
  );
  if (!ok) throw new Error('"Add New Time Keeping" dialog did not open');
}

export async function addDialogOpen(): Promise<boolean> {
  return markAdd();
}

/** The form-item of `label` inside the Add dialog, tagged for scoping. */
async function formItemScope(label: string): Promise<string> {
  await markAdd();
  const ok = await browser.execute(
    function (scope: string, l: string, itemCss: string, labelCss: string) {
      for (const e of Array.from(document.querySelectorAll('[data-voltqc-fi]')))
        e.removeAttribute('data-voltqc-fi');
      const dlg = document.querySelector(scope);
      if (!dlg) return false;
      const item = Array.from(dlg.querySelectorAll(itemCss)).find(function (fi) {
        const lab = fi.querySelector(labelCss);
        return !!lab && (lab.textContent ?? '').trim() === l;
      });
      if (!item) return false;
      item.setAttribute('data-voltqc-fi', '1');
      return true;
    },
    ADD_SCOPE,
    label,
    RptCss.formItem,
    RptCss.formLabel,
  );
  if (!ok) throw new Error(`Add dialog has no form item "${label}"`);
  return '[data-voltqc-fi="1"]';
}

export async function addOpenStaffCombobox(): Promise<void> {
  const scope = await formItemScope('Staff');
  await clickIn(scope, RptCss.combobox);
  await settle(300);
}

/** The staff popover's search box (portalled or inside the dialog). */
export async function addStaffSearch(text: string): Promise<void> {
  const box = await findIn('body', 'input[placeholder="Search staff"]');
  await fillInput(box, text);
  await settle(300);
}

export async function addStaffSearchVisible(): Promise<boolean> {
  return existsIn('body', 'input[placeholder="Search staff"]', Timeouts.SHORT);
}

export async function addOptionCount(): Promise<number> {
  return (await optionTexts()).length;
}

export async function noResultsVisible(): Promise<boolean> {
  return hasText('body', 'No results found.');
}

/** Attributes of the Date IN / Date OUT time input. */
export async function addTimeInputAttrs(
  label: 'Date IN' | 'Date OUT',
): Promise<{ type: string | null; inputmode: string | null; value: string }> {
  const scope = await formItemScope(label);
  const el = await findIn(scope, RptCss.timeInput);
  return {
    type: await el.getAttribute('type'),
    inputmode: await el.getAttribute('inputmode'),
    value: asText(await el.getProperty('value')),
  };
}

/** Focus the time input (hours segment first) and type raw keys. */
export async function addTypeTime(label: 'Date IN' | 'Date OUT', keys: string): Promise<void> {
  const scope = await formItemScope(label);
  const el = await findIn(scope, RptCss.timeInput);
  await browser.execute(
    function (e: HTMLElement) {
      e.focus();
    },
    el as unknown as HTMLElement,
  );
  await browser.keys(keys.split(''));
  await settle(200);
}

export async function addDateText(label: 'Date IN' | 'Date OUT'): Promise<string> {
  const scope = await formItemScope(label);
  const el = await findIn(scope, RptCss.dateRange);
  const t = (await el.getText()).trim();
  return t !== '' ? t : asText(await el.getProperty('textContent'));
}

/** Pick a day in the Date IN / OUT calendar (single-month picker, month/year dropdown caption). */
export async function addPickDate(label: 'Date IN' | 'Date OUT', d: Date): Promise<void> {
  const scope = await formItemScope(label);
  await clickIn(scope, RptCss.dateRange);
  await settle(300);
  const key = `${String(d.getMonth() + 1)}/${String(d.getDate())}/${String(d.getFullYear())}`;
  const sel = `button[data-day="${key}"]`;
  if (!(await existsIn(RptCss.popper, sel, 1500))) {
    // Month/year caption are Select comboboxes [month, year].
    await clickIn(RptCss.popper, RptCss.combobox, 1);
    await clickOption(String(d.getFullYear()));
    await clickIn(RptCss.popper, RptCss.combobox, 0);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    await clickIn(
      'body',
      `//*[@role="option"][starts-with(normalize-space(.), "${months[d.getMonth()] ?? ''}")]`,
    );
    await settle(200);
  }
  await clickIn(RptCss.popper, sel);
  await settle(200);
}

/** Close the Add dialog WITHOUT submitting. */
export async function addClose(): Promise<void> {
  await markAdd();
  const closeSel =
    './/button[@aria-label="Close" or normalize-space(.)="Close" or .//span[normalize-space(.)="Close"]]';
  if (await existsIn(ADD_SCOPE, closeSel, Timeouts.ANIMATION)) await clickIn(ADD_SCOPE, closeSel);
  else await browser.keys([Key.Escape]);
  await browser
    .waitUntil(async () => !(await markAdd()), { timeout: Timeouts.SHORT, interval: 200 })
    .catch(() => undefined);
}

export const mdy = (d: Date): string =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear())}`;

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
