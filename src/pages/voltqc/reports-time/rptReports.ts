import { browser } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { RptCss, RptRoutes, RptText, RptXpath } from '../../../constants/testids.voltqc-reports-time.js';
import { settle } from '../../../helpers/wait.js';
import {
  asText,
  cents,
  clickIn,
  closeStrayDialogs,
  comboText,
  count,
  countCss,
  existsIn,
  findIn,
  hasText,
  openReport,
  paneText,
  parseMonDate,
  rangeOffset,
  readGrid,
  readPairs,
  refetch,
  scanGrid,
  searchParam,
  stableRead,
  waitNoSkeleton,
  type Pair,
  type UnixRange,
} from './rptDom.js';

/**
 * Report-specific readers for the volt-qc ports — Daily Sale, Income Summary,
 * Staff Income, Staff Payroll and Batch History (V1 routes). Mirrors volt-qc
 * `e2e/src/flows/rpt.ts`; all money is integer cents.
 */

const L = RptCss.leftPane;
const R = RptCss.rightPane;

/* ------------------------------------------------------------------------- *
 * Daily Sale Report
 * ------------------------------------------------------------------------- */

export interface DailyCard {
  title: string;
  /** cents, or a plain count for Total Order */
  value: number;
  pct: number;
  positive: boolean;
  selected: boolean;
  description: string;
}

export interface DailyRow {
  order: string;
  sale: number;
  tip: number;
  tax: number;
  total: number;
}

export interface DailyDetail {
  sale: number;
  tip: number;
  tax: number;
  incomeTotal: number;
  card: number;
  cash: number;
  others: number;
  amountCollected: number;
  gcRedemption: number;
  paymentTotal: number;
}

export interface DailySnap {
  heading: string;
  cards: Record<string, DailyCard>;
  detail: DailyDetail | null;
  rows: DailyRow[];
  headers: string[];
}

/** Open the Daily Sale Report for a day offset (0 = today) or a range. */
export async function openDaily(day: number | UnixRange = 0, activeChart = 'sale'): Promise<void> {
  const r = typeof day === 'number' ? rangeOffset(day) : day;
  // DEV sometimes answers an empty day for a moment — retry an offset day up to 3 times.
  const expectData = typeof day === 'number';
  for (let attempt = 0; ; attempt += 1) {
    await openReport(RptRoutes.daily, { from: r.from, to: r.to, activeChart });
    await waitNoSkeleton(RptCss.main).catch(() => undefined);
    await browser
      .waitUntil(
        async () => {
          const big = await browser.execute(function (left: string) {
            const el = document.querySelector(`${left} .text-3xl`);
            return (el?.textContent ?? '').trim();
          }, L);
          return big !== '' && big !== '0' ? true : hasText(R, RptText.noData);
        },
        { timeout: 10_000, interval: 300 },
      )
      .catch(() => undefined);
    const empty = await hasText(R, RptText.noData);
    if (!empty || !expectData || attempt >= 3) return;
    await settle(1500);
  }
}

export async function dailyCards(): Promise<Record<string, DailyCard>> {
  const list = await browser.execute(function (left: string) {
    const root = document.querySelector(left);
    const out: {
      title: string;
      valueText: string;
      pctText: string;
      positive: boolean;
      selected: boolean;
      description: string;
    }[] = [];
    if (!root) return out;
    for (const h of Array.from(root.querySelectorAll('h4'))) {
      const card = h.closest('[data-slot="card"]') ?? h.parentElement?.parentElement;
      if (!card) continue;
      const big = card.querySelector('.text-3xl');
      const pill = Array.from(card.querySelectorAll('span')).find(function (s) {
        return /^\d+%$/.test((s.textContent ?? '').trim());
      });
      const pillBox = pill?.parentElement;
      out.push({
        title: (h.textContent ?? '').trim(),
        valueText: (big?.textContent ?? '').trim(),
        pctText: (pill?.textContent ?? '').trim(),
        positive: !!pillBox && /text-green/.test(pillBox.className),
        selected: /border-primary/.test((card as HTMLElement).className),
        description: (card.querySelector('p')?.textContent ?? '').trim(),
      });
    }
    return out;
  }, L);
  const res: Record<string, DailyCard> = {};
  for (const c of list) {
    res[c.title] = {
      title: c.title,
      value: c.title === 'Total Order' ? count(c.valueText) : cents(c.valueText),
      pct: c.pctText === '' ? Number.NaN : Number(c.pctText.replace('%', '')),
      positive: c.positive,
      selected: c.selected,
      description: c.description,
    };
  }
  return res;
}

export async function dailyDetail(): Promise<DailyDetail | null> {
  const pairs = await readPairs(R);
  if (!pairs.some((p) => p.section === 'Income Details')) return null;
  const I = { section: 'Income Details' };
  const P = { section: 'Payment Details' };
  const v = (label: string, where: { section: string }): number => {
    const p = pairs.find((x) => x.label === label && x.section === where.section);
    if (!p) throw new Error(`Daily Sale detail has no "${label}" in ${where.section}`);
    return p.value;
  };
  return {
    sale: v('Sale', I),
    tip: v('Tip', I),
    tax: v('Tax Collected', I),
    incomeTotal: v('Total Payment', I),
    card: v('Card', P),
    cash: v('Cash', P),
    others: v('Others', P),
    amountCollected: v('Amount Collected', P),
    gcRedemption: v('Gift Card Redemption', P),
    paymentTotal: v('Total Payment', P),
  };
}

export async function dailyRows(): Promise<{ headers: string[]; rows: DailyRow[] }> {
  const s = await scanGrid(R);
  return {
    headers: s.headers,
    rows: s.cells.map((c) => ({
      order: c[0] ?? '',
      sale: cents(c[1]),
      tip: cents(c[2]),
      tax: cents(c[3]),
      total: cents(c[4]),
    })),
  };
}

async function rightHeading(): Promise<string> {
  return browser.execute(function (right: string) {
    const h = document.querySelector<HTMLElement>(`${right} h2`);
    return (h?.innerText ?? '').trim();
  }, R);
}

export async function dailyRead(): Promise<DailySnap> {
  const heading = await rightHeading();
  const cards = await dailyCards();
  const detail = await dailyDetail();
  const { headers, rows } = await dailyRows();
  return { heading, cards, detail, rows, headers };
}

/** Open (fresh) and read stably — cards and detail twice in a row equal; rows once. */
export async function dailySnapshot(day: number | UnixRange = 0): Promise<DailySnap> {
  await openDaily(day);
  const head = await stableRead(async () => {
    await refetch();
    return { heading: await rightHeading(), cards: await dailyCards(), detail: await dailyDetail() };
  });
  const { headers, rows } = await dailyRows();
  return { ...head, rows, headers };
}

/** Texts of the left pane h4 card titles, in order. */
export async function dailyCardTitles(): Promise<string[]> {
  return browser.execute(function (left: string) {
    return Array.from(document.querySelectorAll(`${left} h4`)).map(function (h) {
      return (h.textContent ?? '').trim();
    });
  }, L);
}

export async function clickDailyCard(title: string): Promise<void> {
  await clickIn(L, RptXpath.exactText('h4', title));
}

/** The chart heading (first h3 of the left pane). */
export async function leftH3(): Promise<string> {
  return browser.execute(function (left: string) {
    const h = document.querySelector<HTMLElement>(`${left} h3`);
    return (h?.innerText ?? '').trim();
  }, L);
}

/** Recharts x-axis tick labels of the left pane. */
export async function chartTicks(): Promise<string[]> {
  return browser.execute(function (left: string) {
    return Array.from(document.querySelectorAll(`${left} .recharts-xAxis .recharts-cartesian-axis-tick`))
      .map(function (t) {
        return (t.textContent ?? '').trim();
      })
      .filter(Boolean);
  }, L);
}

/** Is the left pane's "Today" button in its outline (link) style? */
export async function todayButtonOutlined(): Promise<boolean> {
  const el = await findIn(L, RptXpath.buttonText('Today'));
  return /text-link/.test((await el.getAttribute('class')) ?? '');
}

/** The date-range button text (`#selected-date-range`). */
export async function dateRangeText(scopeCss: string = RptCss.main): Promise<string> {
  const el = await findIn(scopeCss, RptCss.dateRange);
  const t = (await el.getText()).trim();
  return t !== '' ? t : asText(await el.getProperty('textContent'));
}

/* ------------------------------------------------------------------------- *
 * Calendar popover (react-day-picker)
 * ------------------------------------------------------------------------- */

/** `td[data-day=yyyy-MM-dd] button` or `button[data-day=M/d/yyyy]` for `d`. */
export function calendarDaySelector(d: Date): string {
  const iso = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const us = `${String(d.getMonth() + 1)}/${String(d.getDate())}/${String(d.getFullYear())}`;
  return `td[data-day="${iso}"] button, button[data-day="${us}"]`;
}

export async function calendarDayExists(d: Date): Promise<boolean> {
  return existsIn(RptCss.popper, calendarDaySelector(d), Timeouts.SHORT);
}

export async function calendarDayDisabled(d: Date): Promise<boolean> {
  const el = await findIn(RptCss.popper, calendarDaySelector(d), 0, Timeouts.SHORT);
  return !(await el.isEnabled());
}

export async function clickCalendarDay(d: Date): Promise<void> {
  await clickIn(RptCss.popper, calendarDaySelector(d));
  await settle(250);
}

/** Click a button inside the open calendar popover (Apply / Cancel / Today). */
export async function clickPopoverButton(name: string): Promise<void> {
  await clickIn(RptCss.popper, RptXpath.buttonText(name));
  await settle(400);
}

/** Is any popover holding a day grid / an Apply button still open? */
export async function calendarOpen(): Promise<boolean> {
  return browser.execute(function (css: string) {
    return Array.from(document.querySelectorAll(css)).some(function (p) {
      return p.getClientRects().length > 0 && !!p.querySelector('td[data-day], button[data-day]');
    });
  }, RptCss.popper);
}

/** Month-navigation buttons on screen (previous/next month). */
export async function monthNavButtons(): Promise<number> {
  return browser.execute(function () {
    return Array.from(document.querySelectorAll('button')).filter(function (b) {
      const n = `${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`;
      return b.getClientRects().length > 0 && /previous month|next month/i.test(n);
    }).length;
  });
}

/* ------------------------------------------------------------------------- *
 * Order Details dialog (opened from a report row)
 * ------------------------------------------------------------------------- */

export async function orderDetailsOpen(): Promise<boolean> {
  return browser.execute(function (title: string) {
    return Array.from(document.querySelectorAll('[role="dialog"]')).some(function (d) {
      return d.getClientRects().length > 0 && (d.textContent ?? '').includes(title);
    });
  }, RptText.orderDetails);
}

export async function waitOrderDetails(open: boolean, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
  return browser
    .waitUntil(async () => (await orderDetailsOpen()) === open, { timeout, interval: 200 })
    .then(
      () => true,
      () => false,
    );
}

/** Names of visible buttons inside the Order Details dialog. */
export async function orderDetailsButtons(): Promise<string[]> {
  return browser.execute(function (title: string) {
    const d = Array.from(document.querySelectorAll('[role="dialog"]')).find(function (x) {
      return x.getClientRects().length > 0 && (x.textContent ?? '').includes(title);
    });
    if (!d) return [] as string[];
    return Array.from(d.querySelectorAll('button'))
      .filter(function (b) {
        return b.getClientRects().length > 0;
      })
      .map(function (b) {
        return `${(b.textContent ?? '').trim()} ${b.getAttribute('aria-label') ?? ''}`.trim();
      });
  }, RptText.orderDetails);
}

export async function orderDetailsText(): Promise<string> {
  return browser.execute(function (title: string) {
    const d = Array.from(document.querySelectorAll('[role="dialog"]')).find(function (x) {
      return x.getClientRects().length > 0 && (x.textContent ?? '').includes(title);
    }) as HTMLElement | undefined;
    return d ? (d.innerText || '').replace(/\s*\n+\s*/g, ' | ') : '';
  }, RptText.orderDetails);
}

export async function closeOrderDetails(): Promise<void> {
  await browser.keys([Key.Escape]);
  await waitOrderDetails(false, Timeouts.SHORT);
}

/** Click the first body row of `scope` whose text matches `re` (or the nth row). */
export async function clickRow(scopeCss: string, match: RegExp | number = 0): Promise<boolean> {
  if (typeof match === 'number') {
    if (!(await existsIn(scopeCss, 'tbody tr', Timeouts.SHORT))) return false;
    await clickIn(scopeCss, 'tbody tr', match);
    return true;
  }
  const idx = await browser.execute(
    function (scope: string, src: string) {
      const root = document.querySelector(scope);
      if (!root) return -1;
      const re = new RegExp(src);
      const rows = Array.from(root.querySelectorAll('tbody tr')).filter(function (tr) {
        return tr.getClientRects().length > 0;
      });
      return rows.findIndex(function (tr) {
        return re.test(tr.textContent ?? '');
      });
    },
    scopeCss,
    match.source,
  );
  if (idx < 0) return false;
  await clickIn(scopeCss, 'tbody tr', idx);
  return true;
}

/* ------------------------------------------------------------------------- *
 * Income Summary
 * ------------------------------------------------------------------------- */

export interface SummaryRow {
  date: string;
  sale: number;
  tip: number;
  tax: number;
  total: number;
  selected: boolean;
}

export interface SummaryState {
  heading: string;
  totalIncome: number;
  pctText: string;
  positive: boolean;
  comparison: string;
  preset: string;
  rangeText: string;
  rows: SummaryRow[];
  placeholder: boolean;
}

export async function openSummary(
  s: UnixRange & { groupBy?: 'day' | 'week' | 'month'; detailId?: string },
): Promise<void> {
  await openReport(RptRoutes.summary, {
    from: s.from,
    to: s.to,
    groupBy: s.groupBy ?? 'day',
    detailId: s.detailId,
  });
  await waitNoSkeleton(L).catch(() => undefined);
}

export async function summaryState(): Promise<SummaryState> {
  const s = await browser.execute(function (left: string) {
    const root = document.querySelector(left);
    const tx = function (e: Element | null | undefined): string {
      return (e?.textContent ?? '').trim();
    };
    if (!root)
      return {
        heading: '',
        big: '',
        pctText: '',
        positive: false,
        comparison: '',
        preset: '',
        rangeText: '',
      };
    const pill = Array.from(root.querySelectorAll('span')).find(function (x) {
      return /^\d+(\.\d+)?%$/.test(tx(x));
    });
    const cmp = Array.from(root.querySelectorAll('span')).find(function (x) {
      return /^vs\. /.test(tx(x));
    });
    const dr = root.querySelector<HTMLElement>('#selected-date-range');
    return {
      heading: tx(root.querySelector('h2')),
      big: tx(root.querySelector('.text-4xl')),
      pctText: tx(pill),
      positive: !!pill?.parentElement && /success/.test(pill.parentElement.className),
      comparison: tx(cmp),
      preset: tx(root.querySelector('[role="combobox"]')),
      rangeText: (dr?.innerText ?? '').trim(),
    };
  }, L);
  const g = await readGrid(L);
  const rows = g.rows.map((r) => ({
    date: (r.cells[0] ?? '').replace(/\n/g, ' '),
    sale: cents(r.cells[1]),
    tip: cents(r.cells[2]),
    tax: cents(r.cells[3]),
    total: cents(r.cells[4]),
    selected: r.selected,
  }));
  const placeholder = await hasText(R, RptText.noDetail);
  return {
    heading: s.heading,
    totalIncome: cents(s.big),
    pctText: s.pctText,
    positive: s.positive,
    comparison: s.comparison,
    preset: s.preset,
    rangeText: s.rangeText,
    rows,
    placeholder,
  };
}

/** Income Summary detail pairs; with `requireData`, polls until Payment Details Total Payment ≠ $0.00. */
export async function summaryDetail(requireData = false, timeout = 60_000): Promise<Pair[]> {
  await browser.waitUntil(async () => hasText(R, 'Payment Details'), {
    timeout: 20_000,
    interval: 250,
    timeoutMsg: 'Income Summary detail never showed "Payment Details"',
  });
  let pairs: Pair[] = [];
  if (requireData) {
    await browser.waitUntil(
      async () => {
        pairs = await readPairs(R);
        const tp = pairs.find((p) => p.section === 'Payment Details' && p.label === 'Total Payment');
        return (tp?.value ?? 0) !== 0;
      },
      { timeout, interval: 500, timeoutMsg: 'Income Summary detail still shows $0.00 Total Payment' },
    );
  } else {
    await settle(1500);
    pairs = await readPairs(R);
  }
  return pairs;
}

/** Visible recharts bars of the left pane: centre point + size. */
export async function summaryBars(): Promise<{ x: number; y: number; h: number; w: number }[]> {
  return browser.execute(function (left: string) {
    return Array.from(document.querySelectorAll(`${left} .recharts-bar-rectangle`)).map(function (e) {
      const r = e.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width };
    });
  }, L);
}

/** Click a viewport point (the chart bar) through a pointer action. */
export async function clickPoint(x: number, y: number): Promise<void> {
  await browser
    .action('pointer', { parameters: { pointerType: 'mouse' } })
    .move({ x: Math.round(x), y: Math.round(y), origin: 'viewport' })
    .down({ button: 0 })
    .up({ button: 0 })
    .perform();
  await settle(500);
}

/** Show less / Show more collapse metrics of the summary detail. */
export async function summaryCollapseBox(): Promise<{
  wrapH: number;
  staffPayoutHidden: boolean;
  salonVisible: boolean;
} | null> {
  return browser.execute(function (right: string) {
    const root = document.querySelector(right);
    if (!root) return null;
    const h3s = Array.from(root.querySelectorAll('h3'));
    const h = h3s.find(function (x) {
      return (x.textContent ?? '').trim() === 'Staff Payout';
    });
    const salon = h3s.find(function (x) {
      return (x.textContent ?? '').trim() === 'Salon Earnings';
    });
    const wrap = h?.closest('.transition-all');
    if (!h || !wrap || !salon) return null;
    const wr = wrap.getBoundingClientRect();
    const hr = h.getBoundingClientRect();
    return {
      wrapH: wr.height,
      staffPayoutHidden: hr.top >= wr.bottom,
      salonVisible: salon.getBoundingClientRect().height > 0,
    };
  }, R);
}

/** font-weight of h3 section titles and of total-row labels in the right pane. */
export async function detailFontWeights(): Promise<Record<string, number>> {
  return browser.execute(function (right: string) {
    const root = document.querySelector(right);
    const res: Record<string, number> = {};
    if (!root) return res;
    for (const h of Array.from(root.querySelectorAll('h3'))) {
      res[`h3:${(h.textContent ?? '').trim()}`] = Number(getComputedStyle(h).fontWeight);
    }
    for (const el of Array.from(root.querySelectorAll('div'))) {
      if (el.children.length !== 2) continue;
      const first = el.children[0] as Element;
      const label = (first.textContent ?? '').trim();
      if (res[`row:${label}`] === undefined) res[`row:${label}`] = Number(getComputedStyle(first).fontWeight);
    }
    return res;
  }, R);
}

/** Click a group-by tab (Day / Week / Month) of the left pane. */
export async function clickTab(name: string): Promise<void> {
  await clickIn(L, RptXpath.tab(name));
  await settle(400);
  await waitNoSkeleton(L).catch(() => undefined);
}

export async function tabActive(name: string): Promise<boolean> {
  const el = await findIn(L, RptXpath.tab(name));
  const state = await el.getAttribute('data-state');
  if (state !== null) return state === 'active';
  return (await el.getAttribute('aria-selected')) === 'true';
}

/* ------------------------------------------------------------------------- *
 * Staff Income / Staff Payroll (same list component)
 * ------------------------------------------------------------------------- */

export interface StaffRow {
  name: string;
  orders: number;
  subtotal: number;
  supply: number;
  tip: number;
  total: number;
  selected: boolean;
}

export interface StaffSummary {
  totalStaff: number;
  totalOrders: number;
  totalSubtotal: number;
  totalSupplyFee: number;
  totalTip: number;
  totalStaffIncome: number;
}

export interface StaffList {
  rows: StaffRow[];
  summary: StaffSummary;
  headers: string[];
  noResults: boolean;
  text: string;
}

const lastLine = (s: string): string => (s.split('\n').pop() ?? '').trim();
export const headName = (s: string): string => (s.split('\n')[0] ?? '').trim();

export async function openStaffIncome(r: UnixRange = rangeOffset(0), staffId?: string | null): Promise<void> {
  await openReport(RptRoutes.staff, { from: r.from, to: r.to, staffId: staffId ?? undefined });
  await browser
    .waitUntil(async () => hasText(L, 'Total staff income'), { timeout: Timeouts.MEDIUM, interval: 250 })
    .catch(() => undefined);
}

export async function openPayroll(periodId?: string): Promise<void> {
  await openReport(RptRoutes.payroll, periodId ? { periodId } : undefined);
  await browser
    .waitUntil(async () => hasText(L, 'Total staff income'), { timeout: Timeouts.MEDIUM, interval: 250 })
    .catch(() => undefined);
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function staffList(): Promise<StaffList> {
  const t = await paneText(L);
  const num = (label: string): number => {
    const m = new RegExp(`${escapeRe(label)} \\| (-?\\$?[\\d,.]+)`).exec(t);
    if (!m) return Number.NaN;
    const raw = m[1] ?? '';
    return raw.includes('$') ? cents(raw) : count(raw);
  };
  const g = await readGrid(L);
  const rows = g.rows.map((r) => ({
    name: lastLine(r.cells[0] ?? ''),
    orders: count(r.cells[1]),
    subtotal: cents(r.cells[2]),
    supply: cents(r.cells[3]),
    tip: cents(r.cells[4]),
    total: cents(r.cells[5]),
    selected: r.selected,
  }));
  return {
    rows,
    summary: {
      totalStaff: num('Total staff'),
      totalOrders: num('Total orders'),
      totalSubtotal: num('Total subtotal'),
      totalSupplyFee: num('Total supply fee'),
      totalTip: num('Total tip'),
      totalStaffIncome: num('Total staff income'),
    },
    headers: g.headers.map(headName),
    noResults: /No results found\./.test(t),
    text: t,
  };
}

/** Poll the list until it has at least one row. */
export async function waitStaffRows(timeout = 60_000): Promise<boolean> {
  return browser
    .waitUntil(async () => (await staffList()).rows.length > 0, { timeout, interval: 500 })
    .then(
      () => true,
      () => false,
    );
}

export async function waitStaffRow(name: string, timeout = 60_000): Promise<StaffRow | null> {
  let row: StaffRow | undefined;
  const ok = await browser
    .waitUntil(
      async () => {
        row = (await staffList()).rows.find((r) => r.name === name);
        return row !== undefined;
      },
      { timeout, interval: 500 },
    )
    .then(
      () => true,
      () => false,
    );
  return ok ? (row ?? null) : null;
}

export async function hasStaffSearch(): Promise<boolean> {
  return existsIn(L, 'input[placeholder="Search staff"]', Timeouts.ANIMATION);
}

export async function staffSearchBox(): Promise<WebdriverIO.Element> {
  return findIn(L, 'input[placeholder="Search staff"]');
}

export async function hasNoIncomeToggle(): Promise<boolean> {
  return (await countCss(L, RptCss.switch)) > 0;
}

export async function noIncomeToggleOn(): Promise<boolean | null> {
  if (!(await hasNoIncomeToggle())) return null;
  const sw = await findIn(L, RptCss.switch);
  return (
    (await sw.getAttribute('aria-checked')) === 'true' || (await sw.getAttribute('data-state')) === 'checked'
  );
}

/** Turn "Show staff with no income" on/off (Staff Income only). */
export async function setNoIncomeToggle(on: boolean): Promise<void> {
  const cur = await noIncomeToggleOn();
  if (cur === null || cur === on) return;
  await clickIn(L, RptCss.switch);
  await settle(800);
}

/** Click a staff row (by name) and wait for the detail header to show that name. */
export async function selectStaffRow(name: string): Promise<void> {
  const idx = (await staffList()).rows.findIndex((r) => r.name === name);
  if (idx < 0) throw new Error(`No staff row "${name}" in the list`);
  await clickIn(L, 'tbody tr', idx);
  await browser.waitUntil(async () => (await rightHeading()) === name, {
    timeout: 20_000,
    interval: 250,
    timeoutMsg: `Detail header never showed "${name}" (shows "${await rightHeading()}")`,
  });
  await waitNoSkeleton(R).catch(() => undefined);
}

export interface StaffDetailRow {
  date: string;
  order: string;
  service: string;
  sale: number;
  supply: number;
  tip: number;
  refund: boolean;
}

export interface StaffDetail {
  name: string;
  rangeText: string;
  headers: string[];
  rows: StaffDetailRow[];
  pairs: Pair[];
  text: string;
}

export async function staffDetail(): Promise<StaffDetail> {
  const name = await rightHeading();
  const text = await paneText(R);
  const rangeText = /\((\d{2}\/\d{2}\/\d{4}(?: - \d{2}\/\d{2}\/\d{4})?)\)/.exec(text)?.[1] ?? '';
  const g = await readGrid(R);
  const h = g.headers.map(headName);
  const idx = (c: string): number => h.indexOf(c);
  const cell = (cells: string[], c: string): string => (idx(c) >= 0 ? (cells[idx(c)] ?? '') : '');
  const rows = g.rows.map((r) => ({
    date: cell(r.cells, 'Date'),
    order: cell(r.cells, 'Order #').replace(/\s/g, ''),
    service: cell(r.cells, 'Service'),
    sale: cents(cell(r.cells, 'Sale/Refund')),
    supply: idx('Supply') >= 0 ? cents(cell(r.cells, 'Supply')) : Number.NaN,
    tip: cents(cell(r.cells, 'Tip')),
    refund: cents(cell(r.cells, 'Sale/Refund')) < 0,
  }));
  return { name, rangeText, headers: h, rows, pairs: await readPairs(R), text };
}

/** Open Staff Income for `r`, make sure `name` is listed (toggle on if needed), select it, read the detail. */
export async function staffIncomeDetailFor(
  name: string,
  r: UnixRange,
): Promise<{ listRow: StaffRow; detail: StaffDetail } | null> {
  await openStaffIncome(r);
  let row = await waitStaffRow(name, 20_000);
  if (!row) {
    await setNoIncomeToggle(true);
    row = await waitStaffRow(name, 30_000);
  }
  if (!row) return null;
  await selectStaffRow(name);
  const listRow = (await staffList()).rows.find((x) => x.name === name) ?? row;
  return { listRow, detail: await staffDetail() };
}

/** Click a column header (by its first-line text) of the left list. */
export async function clickListHeader(text: string): Promise<void> {
  await clickIn(L, `.//th[normalize-space(.)="${text}"]//div | .//th[normalize-space(.)="${text}"]`);
  await settle(300);
}

/** The "Tip" collapsible trigger state of the staff detail ('open' | 'closed' | null). */
export async function tipTriggerState(): Promise<string | null> {
  return browser.execute(function (right: string) {
    const root = document.querySelector(right);
    if (!root) return null;
    const b = Array.from(root.querySelectorAll('button[data-state]')).find(function (x) {
      return /^Tip/.test((x.textContent ?? '').trim());
    });
    return b ? b.getAttribute('data-state') : null;
  }, R);
}

export async function clickTipTrigger(): Promise<void> {
  await clickIn(R, './/button[@data-state][starts-with(normalize-space(.), "Tip")]');
  await settle(300);
}

/** Is the right pane's Print button present / enabled? */
export async function printButtonState(): Promise<{ present: boolean; enabled: boolean }> {
  if (!(await existsIn(R, RptXpath.buttonText('Print'), Timeouts.ANIMATION)))
    return { present: false, enabled: false };
  const el = await findIn(R, RptXpath.buttonText('Print'));
  return { present: true, enabled: await el.isEnabled() };
}

/* ------------------------------------------------------------------------- *
 * Staff Payroll periods
 * ------------------------------------------------------------------------- */

export interface PayrollPeriods {
  current: string;
  options: string[];
  scroll: { scrollHeight: number; clientHeight: number } | null;
}

export async function payrollPeriods(): Promise<PayrollPeriods> {
  await closeStrayDialogs();
  const current = await comboText(L);
  await clickIn(L, RptCss.combobox);
  await browser
    .waitUntil(async () => (await countCss('body', RptCss.listbox)) > 0, {
      timeout: Timeouts.SHORT,
      interval: 150,
    })
    .catch(() => undefined);
  const info = await browser.execute(
    function (lb: string, opt: string) {
      const boxes = Array.from(document.querySelectorAll(lb)).filter(function (e) {
        return e.getClientRects().length > 0;
      });
      const box = boxes[boxes.length - 1];
      const options = Array.from(document.querySelectorAll(opt))
        .filter(function (e) {
          return e.getClientRects().length > 0;
        })
        .map(function (e) {
          return ((e as HTMLElement).innerText || e.textContent || '').trim();
        });
      let scroll: { scrollHeight: number; clientHeight: number } | null = null;
      if (box) {
        const sc = [box, ...Array.from(box.querySelectorAll('*'))].find(function (e) {
          return e.scrollHeight > e.clientHeight + 4;
        });
        if (sc) scroll = { scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight };
      }
      return { options, scroll };
    },
    RptCss.listbox,
    RptCss.option,
  );
  await browser.keys([Key.Escape]);
  await settle(300);
  return { current, ...info };
}

/** "Current Period (Oct 1, 2026 - Oct 14, 2026)" / "Oct 1, 2026 - Oct 14, 2026" → {from,to}. */
export function parsePeriod(label: string): { from: Date; to: Date } | null {
  const m = /([A-Z][a-z]{2} \d{1,2}, \d{4}) - ([A-Z][a-z]{2} \d{1,2}, \d{4})/.exec(label);
  if (!m) return null;
  const from = parseMonDate(m[1] ?? '');
  const to = parseMonDate(m[2] ?? '');
  return from && to ? { from, to } : null;
}

export async function choosePeriod(label: string): Promise<void> {
  await clickIn(L, RptCss.combobox);
  const opt = await findIn('body', RptXpath.option(label));
  await opt.scrollIntoView({ block: 'center' }).catch(() => undefined);
  await opt.click();
  await settle(1500);
  await waitNoSkeleton(R).catch(() => undefined);
}

export { searchParam };

/* ------------------------------------------------------------------------- *
 * Batch History
 * ------------------------------------------------------------------------- */

export interface BatchRow {
  date: string;
  number: string;
  status: string;
  count: number;
  amount: number;
  index: number;
}

export async function openBatch(r?: UnixRange): Promise<void> {
  await openReport(RptRoutes.batch, r ? { from: r.from, to: r.to } : undefined);
  await settle(1500);
}

export async function batchRows(): Promise<{ headers: string[]; rows: BatchRow[] }> {
  const g = await readGrid(RptCss.main);
  return {
    headers: g.headers.map(headName),
    rows: g.rows.map((r, index) => ({
      date: r.cells[0] ?? '',
      number: r.cells[1] ?? '',
      status: r.cells[2] ?? '',
      count: count(r.cells[3]),
      amount: cents(r.cells[4]),
      index,
    })),
  };
}

/** Click the Total Amount button of batch row `i`. */
export async function clickBatchAmount(i: number): Promise<void> {
  const g = await browser.execute(function () {
    return Array.from(document.querySelectorAll('main tbody tr')).filter(function (tr) {
      return tr.getClientRects().length > 0 && tr.querySelectorAll('td').length >= 5;
    }).length;
  });
  if (i >= g) throw new Error(`Batch row ${String(i)} does not exist (${String(g)} rows)`);
  await clickIn(
    RptCss.main,
    `(.//tbody/tr[count(td)>=5])[${String(i + 1)}]/td[last()]//button | (.//tbody/tr[count(td)>=5])[${String(i + 1)}]/td[last()]`,
  );
  await settle(800);
}

/** Batch review panel text and its grid. */
export async function batchReview(): Promise<{ text: string; headers: string[]; rows: string[][] }> {
  const text = await browser.execute(function (css: string) {
    const all = Array.from(document.querySelectorAll(css));
    const el = all[all.length - 1] as HTMLElement | undefined;
    return el ? (el.innerText || '').replace(/\s*\n+\s*/g, ' | ') : '';
  }, RptCss.batchReview);
  const grid = await browser.execute(function (css: string) {
    const all = Array.from(document.querySelectorAll(css));
    const root = all[all.length - 1];
    if (!root) return { headers: [] as string[], rows: [] as string[][] };
    const clean = function (e: Element): string {
      return ((e as HTMLElement).innerText || '')
        .split('\n')
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean)
        .join('\n');
    };
    const tables = Array.from(root.querySelectorAll('table'));
    const head = tables.find(function (t) {
      return !!t.querySelector('th');
    });
    if (!head) return { headers: [] as string[], rows: [] as string[][] };
    const headers = Array.from(head.querySelectorAll('th')).map(clean);
    const body = head.querySelector('tbody tr td') ? head : (tables[tables.indexOf(head) + 1] ?? head);
    const rows = Array.from(body.querySelectorAll('tbody tr'))
      .filter(function (tr) {
        return tr.querySelectorAll('td').length === headers.length;
      })
      .map(function (tr) {
        return Array.from(tr.querySelectorAll('td')).map(clean);
      });
    return { headers, rows };
  }, RptCss.batchReview);
  return { text, headers: grid.headers.map(headName), rows: grid.rows };
}

/**
 * Tag the LAST element matching the batch-review panel CSS so later scoped
 * lookups hit that one panel (the selector also matches layout columns).
 */
async function reviewScope(): Promise<string | null> {
  const ok = await browser.execute(function (css: string) {
    const all = Array.from(document.querySelectorAll(css));
    for (const e of all) e.removeAttribute('data-voltqc-review');
    const el = all[all.length - 1];
    if (!el) return false;
    el.setAttribute('data-voltqc-review', '1');
    return true;
  }, RptCss.batchReview);
  return ok ? '[data-voltqc-review="1"]' : null;
}

/** Click the first OD Code button of the batch review; false when there is none. */
export async function clickFirstReviewOrder(): Promise<boolean> {
  const scope = await reviewScope();
  if (scope === null) return false;
  const sel = '(.//tbody/tr/td[1]//button)[1]';
  if (!(await existsIn(scope, sel, Timeouts.SHORT))) return false;
  await clickIn(scope, sel);
  return true;
}

/** Click a column header by its exact text inside `<main>`. */
export async function clickMainHeader(text: string): Promise<void> {
  await clickIn(RptCss.main, `.//th//*[normalize-space(text())="${text}"]`);
  await settle(800);
}

/** Left-edge x of the Staff Income filter controls: [search, date combobox, toggle label, switch]. NaN when absent. */
export async function staffFilterXs(): Promise<number[]> {
  return browser.execute(
    function (left: string, label: string) {
      const root = document.querySelector(left);
      const x = function (e: Element | null | undefined): number {
        return e && e.getClientRects().length > 0 ? e.getBoundingClientRect().x : Number.NaN;
      };
      if (!root) return [Number.NaN, Number.NaN, Number.NaN, Number.NaN];
      const lab = Array.from(root.querySelectorAll('*')).find(function (e) {
        return e.children.length === 0 && (e.textContent ?? '').trim() === label;
      });
      return [
        x(root.querySelector('input[placeholder="Search staff"]')),
        x(root.querySelector('[role="combobox"]')),
        x(lab),
        x(root.querySelector('[role="switch"]')),
      ];
    },
    L,
    RptText.showNoIncome,
  );
}

/** Rate captions "Commission Rate (...): NN%" found in a detail text. */
export function commissionRates(text: string): number[] {
  return [...text.matchAll(/Commission Rate \([^)]*\):\s*(?:\|\s*)?(\d+(?:\.\d+)?)%/g)].map((m) =>
    Number(m[1]),
  );
}

/** "Working Days: N day(s)" line of the payroll detail, '' when absent. */
export async function workingDaysLine(): Promise<string> {
  return browser.execute(function (right: string) {
    const root = document.querySelector(right);
    if (!root) return '';
    const el = Array.from(root.querySelectorAll('*')).find(function (e) {
      return e.getClientRects().length > 0 && /^Working Days: \d+ days?$/.test((e.textContent ?? '').trim());
    });
    return el ? (el.textContent ?? '').trim() : '';
  }, R);
}
