import { $, browser } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../components/modal/PasscodeDialog.js';
import { RptCss, RptRoutes, RptXpath, SKIP_KEY } from '../../../constants/testids.voltqc-reports-time.js';
import { goTo, type SearchParams } from '../../../helpers/navigate.js';
import { settle } from '../../../helpers/wait.js';

/**
 * Core DOM toolkit for the specs ported from volt-qc's report / time modules.
 *
 * It is the WebdriverIO counterpart of the Playwright helpers in volt-qc
 * `e2e/src/flows/rpt.ts` (`readPairs`, `readGrid`, `openReport`, the passcode
 * gate probes …): every reader runs as ONE `browser.execute` over the live DOM
 * so a table or a detail panel is read at a single instant, which is both
 * faster than cell-by-cell WebDriver calls and immune to the testid stripping
 * of build 1.1.x.
 *
 * Nothing here asserts; readers return what is on screen and the spec decides.
 */

/* ------------------------------------------------------------------------- *
 * Money / dates (pure)
 * ------------------------------------------------------------------------- */

/** `$1,234.56` / `-$1.00` / `−$1.00` / `($1.00)` → integer cents; NaN when not money. */
export function cents(text: string | undefined | null): number {
  if (text === undefined || text === null) return Number.NaN;
  let t = text.replace(/\s+/g, '').replace(/^−/, '-');
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  if (t.startsWith('-')) {
    neg = !neg;
    t = t.slice(1);
  }
  t = t.replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return Number.NaN;
  const value = Math.round(Number.parseFloat(t) * 100);
  return neg ? -value : value;
}

/** A bare count (`1,024`) → number; NaN otherwise. */
export function count(text: string | undefined | null): number {
  const t = (text ?? '').trim().replace(/,/g, '');
  return /^-?\d+$/.test(t) ? Number.parseInt(t, 10) : Number.NaN;
}

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

export function dayStart(offset = 0, base: Date = new Date()): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

export function dayEnd(offset = 0, base: Date = new Date()): Date {
  const d = new Date(base);
  d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() + offset);
  return d;
}

export const unix = (d: Date): number => Math.floor(d.getTime() / 1000);

export interface UnixRange {
  from: number;
  to: number;
}

/** Day range by offset from today (0 = today, -1 = yesterday) — `getDateRangeByPreset`. */
export const rangeOffset = (fromOffset: number, toOffset: number = fromOffset): UnixRange => ({
  from: unix(dayStart(fromOffset)),
  to: unix(dayEnd(toOffset)),
});

/** Absolute local-day range. */
export const rangeDates = (from: Date, to: Date): UnixRange => ({
  from: unix(dayStart(0, from)),
  to: unix(dayEnd(0, to)),
});

export const ymd = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);
export const detailIdOf = (r: UnixRange): string => `${String(r.from)}-${String(r.to)}`;
export const daysBetween = (a: Date, b: Date): number =>
  Math.round((dayStart(0, b).getTime() - dayStart(0, a).getTime()) / 86_400_000);

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n: number): string => String(n).padStart(2, '0');

export type DateFormat = 'MM/dd/yyyy' | 'MMM dd, yyyy' | 'MMM d' | 'MMM d, yyyy' | 'yyyy-MM-dd';

export function fmtDate(d: Date, f: DateFormat): string {
  const mon = MONTHS[d.getMonth()] ?? '';
  switch (f) {
    case 'MM/dd/yyyy':
      return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${String(d.getFullYear())}`;
    case 'MMM dd, yyyy':
      return `${mon} ${p2(d.getDate())}, ${String(d.getFullYear())}`;
    case 'MMM d':
      return `${mon} ${String(d.getDate())}`;
    case 'MMM d, yyyy':
      return `${mon} ${String(d.getDate())}, ${String(d.getFullYear())}`;
    case 'yyyy-MM-dd':
      return `${String(d.getFullYear())}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  }
}

/** "Oct 1, 2026" / "Oct 01, 2026" → local Date. */
export function parseMonDate(s: string): Date | null {
  const m = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[3]), MONTHS.indexOf(m[1] ?? ''), Number(m[2]));
}

/** "MM/dd/yyyy hh:mm AM" → local Date. */
export function parseUsDateTime(s: string): Date | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}) ([AP]M)/.exec(s);
  if (!m) return null;
  let h = Number(m[4]) % 12;
  if (m[6] === 'PM') h += 12;
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h, Number(m[5]));
}

/** "MM/dd/yyyy" → local Date. */
export function parseUsDate(s: string): Date | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  return m ? new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2])) : null;
}

/* ------------------------------------------------------------------------- *
 * Router / app state
 * ------------------------------------------------------------------------- */

export async function currentUrl(): Promise<URL> {
  return new URL(await browser.getUrl());
}

export async function searchParam(key: string): Promise<string | null> {
  return (await currentUrl()).searchParams.get(key);
}

export async function pathname(): Promise<string> {
  return (await currentUrl()).pathname;
}

/** Force every active react-query to refetch in place and wait until the app is idle. */
export async function refetch(timeoutMs = 20_000): Promise<void> {
  await browser
    .executeAsync(function (t: number, done: (v: null) => void) {
      const w = window as unknown as Record<string, unknown>;
      const router = w['__TSR_ROUTER__'] as
        | {
            options?: {
              context?: {
                queryClient?: { refetchQueries: (o: object) => Promise<void>; isFetching: () => number };
              };
            };
          }
        | undefined;
      const qc = router?.options?.context?.queryClient;
      if (!qc) {
        done(null);
        return;
      }
      const end = Date.now() + t;
      void Promise.race([
        qc.refetchQueries({ type: 'active' }).catch(function () {
          return undefined;
        }),
        new Promise(function (r) {
          setTimeout(r, t);
        }),
      ]).then(function () {
        let idle = 0;
        const tick = function (): void {
          if (Date.now() >= end || idle >= 2) {
            done(null);
            return;
          }
          idle = qc.isFetching() === 0 ? idle + 1 : 0;
          setTimeout(tick, 60);
        };
        tick();
      });
    }, timeoutMs)
    .catch(() => undefined);
}

/** Wait until react-query reports nothing fetching/mutating (min `minMs`). */
export async function idle(minMs = 350, timeoutMs = 8_000): Promise<void> {
  await settle(minMs);
  await browser
    .executeAsync(function (t: number, done: (v: null) => void) {
      const w = window as unknown as Record<string, unknown>;
      const router = w['__TSR_ROUTER__'] as
        | { options?: { context?: { queryClient?: { isFetching: () => number; isMutating: () => number } } } }
        | undefined;
      const qc = router?.options?.context?.queryClient;
      const end = Date.now() + t;
      let quiet = 0;
      const tick = function (): void {
        if (!qc || Date.now() >= end || quiet >= 2) {
          done(null);
          return;
        }
        quiet = qc.isFetching() === 0 && qc.isMutating() === 0 ? quiet + 1 : 0;
        setTimeout(tick, 60);
      };
      tick();
    }, timeoutMs)
    .catch(() => undefined);
}

/** Number of visible dialogs / alertdialogs on screen. */
export async function visibleDialogCount(): Promise<number> {
  return browser.execute(function (css: string) {
    return Array.from(document.querySelectorAll(css)).filter(function (e) {
      return e.getClientRects().length > 0;
    }).length;
  }, RptCss.visibleDialog);
}

/** Close whatever dialog is up with Escape (at most 4 rounds). */
export async function closeStrayDialogs(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    if ((await visibleDialogCount()) === 0) return;
    await browser.keys([Key.Escape]);
    await settle(350);
  }
}

/**
 * Client-side navigation WITHOUT answering any passcode gate.
 *
 * `goTo` waits until the router lands; a gated route still lands (the guard is
 * drawn over it), and a refused one stays put — both are fine for a caller
 * that inspects the gate itself, so a landing timeout is swallowed here.
 */
export async function navigateRaw(route: string, search?: SearchParams): Promise<void> {
  await closeStrayDialogs();
  await goTo(route, { search, timeout: Timeouts.SHORT }).catch(() => undefined);
  await settle(150);
}

/** Visible report content (left pane, a table or a heading) inside `<main>`. */
async function hasReportContent(): Promise<boolean> {
  return browser.execute(function (left: string) {
    const els = Array.from(document.querySelectorAll(`${left}, main table, main h1, main h2`));
    return els.some(function (e) {
      return e.getClientRects().length > 0;
    });
  }, RptCss.leftPane);
}

export interface OpenReportOptions {
  /** Remount the page so stale state (selection, toggles) resets — default true. */
  fresh?: boolean;
  /** Answer the passcode gate with the owner passcode — default true. */
  passcode?: boolean;
}

/**
 * Open a report (or any gated screen) with search params, unlock the gate,
 * force a refetch and wait for the skeletons to clear — volt-qc `openReport`.
 */
export async function openReport(
  route: string,
  search?: SearchParams,
  opts: OpenReportOptions = {},
): Promise<void> {
  const fresh = opts.fresh !== false;
  await closeStrayDialogs();
  if (fresh && (await pathname()) === route) await navigateRaw(RptRoutes.home);
  await navigateRaw(route, search);
  if (opts.passcode === false) return;

  // DEV can take > 3 s to raise the guard: wait for EITHER the guard OR content.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await passcodeDialog.isPrompting(Timeouts.ANIMATION)) {
      await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
      break;
    }
    if ((await pathname()) === route && (await hasReportContent())) break;
    await settle(300);
  }
  await browser.waitUntil(hasReportContent, { timeout: 10_000, interval: 250 }).catch(() => undefined);
  if (fresh) await refetch();
  await waitNoSkeleton(RptCss.main).catch(() => undefined);
}

/** Wait until `scope` holds no `[data-slot="skeleton"]`. */
export async function waitNoSkeleton(scopeCss: string, timeout = 30_000): Promise<void> {
  await browser.waitUntil(
    async () =>
      (await browser.execute(
        function (scope: string, sk: string) {
          const root = document.querySelector(scope);
          return root ? root.querySelectorAll(sk).length : 0;
        },
        scopeCss,
        RptCss.skeleton,
      )) === 0,
    {
      timeout,
      interval: 250,
      timeoutMsg: `"${scopeCss}" is still loading (skeleton) after ${String(timeout)}ms`,
    },
  );
}

/** Read repeatedly until two consecutive reads agree (a shared till keeps adding orders). */
export async function stableRead<T>(read: () => Promise<T>, tries = 4, gapMs = 800): Promise<T> {
  let prev = await read();
  for (let i = 0; i < tries; i += 1) {
    await settle(gapMs);
    const cur = await read();
    if (JSON.stringify(cur) === JSON.stringify(prev)) return cur;
    prev = cur;
  }
  return prev;
}

/* ------------------------------------------------------------------------- *
 * Generic readers
 * ------------------------------------------------------------------------- */

/** "label — money" pair of a detail panel. section = nearest h1..h6; group = indented (pl-6) block heading. */
export interface Pair {
  section: string;
  group: string;
  label: string;
  full: string;
  raw: string;
  /** cents */
  value: number;
}

export async function readPairs(scopeCss: string): Promise<Pair[]> {
  const list = await browser.execute(function (scope: string) {
    const root = document.querySelector(scope);
    if (!root) return [] as { section: string; group: string; label: string; full: string; raw: string }[];
    const MONEY = /^-?\s*\$[\d,]+(?:\.\d+)?$/;
    const txt = function (e: Element): string {
      return ((e as HTMLElement).innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
    };
    const isPair = function (e: Element): boolean {
      if (e.children.length !== 2) return false;
      const a = txt(e.children[0] as Element);
      return a !== '' && !a.includes('$') && MONEY.test(txt(e.children[1] as Element));
    };
    const out: { section: string; group: string; label: string; full: string; raw: string }[] = [];
    let section = '';
    let group = '';
    for (const e of Array.from(root.querySelectorAll('*'))) {
      if (/^H[1-6]$/.test(e.tagName)) {
        const p = e.parentElement;
        if (p && isPair(p)) group = txt(e);
        else {
          section = txt(e);
          group = '';
        }
        continue;
      }
      if (!isPair(e)) continue;
      const full = txt(e.children[0] as Element);
      const inGroup = e.classList.contains('pl-6') || !!e.parentElement?.closest('.pl-6');
      out.push({
        section,
        group: inGroup ? group : '',
        label: full.replace(/\s*\(.*$/, '').trim(),
        full,
        raw: txt(e.children[1] as Element),
      });
    }
    return out;
  }, scopeCss);
  return list.map((p) => ({ ...p, value: cents(p.raw) }));
}

export interface PairWhere {
  section?: string | RegExp;
  /** '' = not inside a group; undefined = any. */
  group?: string;
  nth?: number;
}

function pairMatches(p: Pair, label: string, where: PairWhere): boolean {
  if (p.label !== label) return false;
  if (where.section !== undefined) {
    if (typeof where.section === 'string' ? p.section !== where.section : !where.section.test(p.section))
      return false;
  }
  return where.group === undefined || p.group === where.group;
}

/** Value (cents) of `label`; throws listing what IS there when absent. */
export function pv(pairs: Pair[], label: string, where: PairWhere = {}): number {
  const p = pairs.filter((x) => pairMatches(x, label, where))[where.nth ?? 0];
  if (!p) {
    throw new Error(
      `No "${label}" line (${JSON.stringify(where)}). Present: ` +
        pairs.map((x) => `${x.section}/${x.group}/${x.label}`).join('; '),
    );
  }
  return p.value;
}

export const hasPair = (pairs: Pair[], label: string, where: PairWhere = {}): boolean =>
  pairs.some((x) => pairMatches(x, label, where));

/** Full label text (with its parenthesised caption) of `label`. */
export function pfull(pairs: Pair[], label: string, nth = 0): string {
  return pairs.filter((p) => p.label === label)[nth]?.full ?? '';
}

export interface Grid {
  headers: string[];
  rows: { cells: string[]; selected: boolean }[];
}

/** A DataTable inside `scope`: th texts + body rows with as many cells (split header/body tables re-joined). */
export async function readGrid(scopeCss: string, tableIndex = 0): Promise<Grid> {
  return browser.execute(
    function (scope: string, idx: number) {
      const root = document.querySelector(scope);
      if (!root) return { headers: [] as string[], rows: [] as { cells: string[]; selected: boolean }[] };
      const clean = function (e: Element): string {
        return ((e as HTMLElement).innerText || e.textContent || '')
          .split('\n')
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean)
          .join('\n');
      };
      const tables = Array.from(root.querySelectorAll('table'));
      const withHead = tables.filter(function (t) {
        return !!t.querySelector('th');
      });
      const head = withHead[idx];
      if (!head) return { headers: [] as string[], rows: [] as { cells: string[]; selected: boolean }[] };
      const headers = Array.from(head.querySelectorAll('th')).map(clean);
      let body: Element = head;
      if (!head.querySelector('tbody tr td')) {
        const next = tables[tables.indexOf(head) + 1];
        if (next) body = next;
      }
      const rows = Array.from(body.querySelectorAll('tbody tr'))
        .filter(function (tr) {
          return tr.querySelectorAll('td').length === headers.length;
        })
        .map(function (tr) {
          return {
            cells: Array.from(tr.querySelectorAll('td')).map(clean),
            selected: tr.getAttribute('data-state') === 'selected',
          };
        });
      return { headers, rows };
    },
    scopeCss,
    tableIndex,
  );
}

/**
 * Read a VIRTUALISED table end to end: scroll its nearest scroll container from
 * top to bottom inside one async script and collect unique rows in order.
 */
export async function scanGrid(scopeCss: string): Promise<{ headers: string[]; cells: string[][] }> {
  return browser.executeAsync(function (
    scope: string,
    done: (v: { headers: string[]; cells: string[][] }) => void,
  ) {
    const root = document.querySelector(scope);
    if (!root) {
      done({ headers: [], cells: [] });
      return;
    }
    const clean = function (e: Element): string {
      return ((e as HTMLElement).innerText || e.textContent || '')
        .split('\n')
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean)
        .join('\n');
    };
    const headOf = function (): Element | undefined {
      return Array.from(root.querySelectorAll('table')).find(function (t) {
        return !!t.querySelector('th');
      });
    };
    const head = headOf();
    if (!head) {
      done({ headers: [], cells: [] });
      return;
    }
    const headers = Array.from(head.querySelectorAll('th')).map(clean);
    const bodyOf = function (): Element {
      const ts = Array.from(root.querySelectorAll('table'));
      const h = headOf() ?? head;
      return h.querySelector('tbody tr td') ? h : (ts[ts.indexOf(h as HTMLTableElement) + 1] ?? h);
    };
    let sc: HTMLElement | null = bodyOf() as HTMLElement;
    while (
      sc &&
      !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))
    ) {
      sc = sc.parentElement;
    }
    const seen = new Map<string, string[]>();
    const grab = function (): void {
      for (const tr of Array.from(bodyOf().querySelectorAll('tbody tr'))) {
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length !== headers.length) continue;
        const cells = tds.map(clean);
        const top = Math.round((tr as HTMLElement).getBoundingClientRect().top + (sc ? sc.scrollTop : 0));
        const key = (tr as HTMLElement).dataset['index'] ?? `${String(top)}|${cells.join('|')}`;
        if (!seen.has(key)) seen.set(key, cells);
      }
    };
    if (!sc) {
      grab();
      done({ headers, cells: Array.from(seen.values()) });
      return;
    }
    const box = sc;
    const keep = box.scrollTop;
    box.scrollTop = 0;
    let i = 0;
    const step = function (): void {
      grab();
      const before = box.scrollTop;
      box.scrollTop += Math.max(200, box.clientHeight - 60);
      i += 1;
      setTimeout(function () {
        if (box.scrollTop === before || i >= 400) {
          grab();
          box.scrollTop = keep;
          done({ headers, cells: Array.from(seen.values()) });
          return;
        }
        step();
      }, 40);
    };
    setTimeout(step, 40);
  }, scopeCss);
}

/** innerText of `scope`, newlines collapsed to " | ". */
export async function paneText(scopeCss: string): Promise<string> {
  return browser.execute(function (scope: string) {
    const root = document.querySelector<HTMLElement>(scope);
    return root ? (root.innerText || root.textContent || '').replace(/\s*\n+\s*/g, ' | ') : '';
  }, scopeCss);
}

/** Every visible line of `scope` (innerText split on newlines, trimmed, non-empty). */
export async function paneLines(scopeCss: string): Promise<string[]> {
  return browser.execute(function (scope: string) {
    const root = document.querySelector<HTMLElement>(scope);
    if (!root) return [] as string[];
    return (root.innerText || '')
      .split('\n')
      .map(function (s: string) {
        return s.trim();
      })
      .filter(Boolean);
  }, scopeCss);
}

/** How many VISIBLE elements inside `scope` have exactly this normalised text (or match the regex). */
export async function countText(scopeCss: string, text: string | RegExp, tags = '*'): Promise<number> {
  const src = typeof text === 'string' ? null : text.source;
  const flags = typeof text === 'string' ? '' : text.flags;
  const literal = typeof text === 'string' ? text : '';
  return browser.execute(
    function (scope: string, lit: string, source: string | null, fl: string, sel: string) {
      const root = document.querySelector(scope);
      if (!root) return 0;
      const re = source === null ? null : new RegExp(source, fl);
      let n = 0;
      for (const e of Array.from(root.querySelectorAll(sel))) {
        if (e.getClientRects().length === 0) continue;
        // Own text only: skip elements whose text comes from a child that also matches.
        const t = (e.textContent || '').replace(/\s+/g, ' ').trim();
        const ok = re ? re.test(t) : t === lit;
        if (!ok) continue;
        const childMatches = Array.from(e.children).some(function (c) {
          const ct = (c.textContent || '').replace(/\s+/g, ' ').trim();
          return re ? re.test(ct) : ct === lit;
        });
        if (!childMatches) n += 1;
      }
      return n;
    },
    scopeCss,
    literal,
    src,
    flags,
    tags,
  );
}

export async function hasText(scopeCss: string, text: string | RegExp, tags = '*'): Promise<boolean> {
  return (await countText(scopeCss, text, tags)) > 0;
}

/** Number of visible elements matching `css` inside `scope`. */
export async function countCss(scopeCss: string, css: string): Promise<number> {
  return browser.execute(
    function (scope: string, sel: string) {
      const root = document.querySelector(scope);
      if (!root) return 0;
      return Array.from(root.querySelectorAll(sel)).filter(function (e) {
        return e.getClientRects().length > 0;
      }).length;
    },
    scopeCss,
    css,
  );
}

/** Visible role=option texts anywhere in the document. */
export async function optionTexts(): Promise<string[]> {
  return browser.execute(function (css: string) {
    return Array.from(document.querySelectorAll(css))
      .filter(function (e) {
        return e.getClientRects().length > 0;
      })
      .map(function (e) {
        return ((e as HTMLElement).innerText || e.textContent || '').trim();
      });
  }, RptCss.option);
}

/* ------------------------------------------------------------------------- *
 * Interactions
 * ------------------------------------------------------------------------- */

type El = WebdriverIO.Element;

/** A `getProperty()` result as trimmed text ('' for non-strings). */
export const asText = (raw: unknown): string => (typeof raw === 'string' ? raw.trim() : '');

/** The `nth` element matching `sel` (CSS or relative XPath) inside the first `scope`, waited for. */
export async function findIn(
  scopeCss: string,
  sel: string,
  nth = 0,
  timeout: number = Timeouts.MEDIUM,
): Promise<El> {
  let found: El | undefined;
  await browser.waitUntil(
    async () => {
      const scope = await $(scopeCss).getElement();
      if (!(await scope.isExisting())) return false;
      const els = await scope.$$(sel).getElements();
      const shown: El[] = [];
      for (const e of els) if (await e.isDisplayed().catch(() => false)) shown.push(e);
      found = shown[nth];
      return found !== undefined;
    },
    { timeout, interval: 200, timeoutMsg: `No visible "${sel}" #${String(nth)} inside "${scopeCss}"` },
  );
  return found as El;
}

/** Is there a visible match for `sel` inside `scope` (short probe)? */
export async function existsIn(
  scopeCss: string,
  sel: string,
  timeout: number = Timeouts.ANIMATION,
): Promise<boolean> {
  return findIn(scopeCss, sel, 0, timeout).then(
    () => true,
    () => false,
  );
}

export async function clickIn(
  scopeCss: string,
  sel: string,
  nth = 0,
  timeout: number = Timeouts.MEDIUM,
): Promise<void> {
  const el = await findIn(scopeCss, sel, nth, timeout);
  await el.scrollIntoView({ block: 'center' }).catch(() => undefined);
  await el.click();
}

/** Click a role=option (portalled, so searched from the document) by exact text. */
export async function clickOption(text: string): Promise<void> {
  await clickIn('body', RptXpath.option(text));
}

/** Open the first combobox of `scope`, pick `name`, let the data reload. */
export async function choosePreset(scopeCss: string, name: string): Promise<void> {
  await clickIn(scopeCss, RptCss.combobox);
  await clickOption(name);
  await settle(800);
}

/** Open the first combobox of `scope`, read its options, close with Escape. */
export async function comboOptions(scopeCss: string): Promise<string[]> {
  await clickIn(scopeCss, RptCss.combobox);
  await browser
    .waitUntil(async () => (await optionTexts()).length > 0, { timeout: Timeouts.SHORT, interval: 150 })
    .catch(() => undefined);
  const opts = await optionTexts();
  await browser.keys([Key.Escape]);
  await settle(300);
  return opts;
}

/** Text of the first combobox in `scope`. */
export async function comboText(scopeCss: string): Promise<string> {
  const el = await findIn(scopeCss, RptCss.combobox);
  const t = (await el.getText()).trim();
  return t !== '' ? t : asText(await el.getProperty('textContent'));
}

/** Clear an input with select-all + Backspace, then type `text` (React sees real input events). */
export async function fillInput(el: El, text: string): Promise<void> {
  await el.click();
  await browser.keys([Key.Ctrl, 'a']);
  await browser.keys([Key.Backspace]);
  if (text !== '') await el.addValue(text);
}

/** Element text with the WebView2 `getText() === ''` fallback. */
export async function elText(el: El): Promise<string> {
  const t = (await el.getText()).trim();
  if (t !== '') return t;
  const raw = await el.getProperty('textContent');
  return typeof raw === 'string' ? raw.trim() : '';
}

/* ------------------------------------------------------------------------- *
 * Toasts / offline
 * ------------------------------------------------------------------------- */

/** Visible sonner toasts containing `text`. */
export async function toastCount(text: string | RegExp): Promise<number> {
  return countTextContains(RptCss.toast, text);
}

async function countTextContains(css: string, text: string | RegExp): Promise<number> {
  const src = typeof text === 'string' ? null : text.source;
  const lit = typeof text === 'string' ? text : '';
  return browser.execute(
    function (sel: string, l: string, source: string | null) {
      const re = source === null ? null : new RegExp(source);
      return Array.from(document.querySelectorAll(sel)).filter(function (e) {
        const t = (e.textContent || '').replace(/\s+/g, ' ');
        return e.getClientRects().length > 0 && (re ? re.test(t) : t.includes(l));
      }).length;
    },
    css,
    lit,
    src,
  );
}

/** Fake offline/online for `useOnlineStatus` (navigator.onLine + event) — the network is not touched. */
export async function fakeOnline(online: boolean): Promise<void> {
  await browser.execute(function (on: boolean) {
    if (on) delete (navigator as unknown as Record<string, unknown>)['onLine'];
    else
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: function () {
          return false;
        },
      });
    window.dispatchEvent(new Event(on ? 'online' : 'offline'));
  }, online);
  await settle(500);
}

/** The offline banner: by testid when the build keeps it, else by its copy. */
export async function offlineBanner(): Promise<{ visible: boolean; role: string | null; text: string }> {
  return browser.execute(
    function (css: string, copy: string) {
      let el = document.querySelector<HTMLElement>(css);
      if (!el || el.getClientRects().length === 0) {
        el =
          (Array.from(document.querySelectorAll('[role="alert"], div, p, span')).find(function (e) {
            return (
              e.getClientRects().length > 0 &&
              (e.textContent || '').replace(/\s+/g, ' ').trim() === copy &&
              !Array.from(e.children).some(function (c) {
                return (c.textContent || '').replace(/\s+/g, ' ').trim() === copy;
              })
            );
          }) as HTMLElement | undefined) ?? null;
        // Prefer the role=alert ancestor when the copy sits in a child.
        const alert = el?.closest<HTMLElement>('[role="alert"]');
        if (alert) el = alert;
      }
      if (!el || el.getClientRects().length === 0) return { visible: false, role: null, text: '' };
      return { visible: true, role: el.getAttribute('role'), text: (el.innerText || '').trim() };
    },
    RptCss.offlineBanner,
    'The data is not accurate when the app is offline',
  );
}

/* ------------------------------------------------------------------------- *
 * Passcode gate (for the specs that inspect the guard itself)
 * ------------------------------------------------------------------------- */

/** The guard dialog: a role=dialog that carries the 0-9 keypad. */
const GATE_XPATH =
  '//*[@role="dialog"][.//button[normalize-space(.)="0"]][.//button[normalize-space(.)="5"]][.//button[normalize-space(.)="9"]]';

export async function gateElement(timeout: number = Timeouts.SHORT): Promise<El | null> {
  try {
    const el = await $(GATE_XPATH).getElement();
    await el.waitForDisplayed({ timeout });
    return el;
  } catch {
    return null;
  }
}

/** Navigate to `route` from Home WITHOUT a passcode; returns whether the guard came up. */
export async function openGate(route: string, search?: SearchParams): Promise<boolean> {
  await navigateRaw(RptRoutes.home);
  await navigateRaw(route, search);
  return (await gateElement(4_000)) !== null;
}

export async function gateKey(digit: string): Promise<void> {
  const dlg = await gateElement();
  if (!dlg) throw new Error('Passcode guard is not on screen');
  const key = await dlg.$(RptXpath.buttonText(digit)).getElement();
  await key.click();
  await settle(150);
}

export async function gateType(code: string): Promise<void> {
  for (const d of code) await gateKey(d);
}

/** The backspace key = the button right after "0" (no aria-label). */
export async function gateBackspace(): Promise<El> {
  const dlg = await gateElement();
  if (!dlg) throw new Error('Passcode guard is not on screen');
  return dlg.$('.//button[normalize-space(.)="0"]/following-sibling::button[1]').getElement();
}

export interface GateState {
  open: boolean;
  heading: string;
  filled: number;
  empty: number;
  error: string;
  text: string;
}

export async function gateState(): Promise<GateState> {
  return browser.execute(
    function (xp: string, filledCss: string, emptyCss: string, errCss: string) {
      const dlg = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue as HTMLElement | null;
      if (!dlg || dlg.getClientRects().length === 0) {
        return { open: false, heading: '', filled: 0, empty: 0, error: '', text: '' };
      }
      const h = dlg.querySelector<HTMLElement>('h1, h2, h3, [role="heading"]');
      const err = dlg.querySelector<HTMLElement>(errCss);
      return {
        open: true,
        heading: (h?.innerText || '').trim(),
        filled: dlg.querySelectorAll(filledCss).length,
        empty: dlg.querySelectorAll(emptyCss).length,
        error: err && err.getClientRects().length > 0 ? (err.innerText || '').trim() : '',
        text: (dlg.innerText || '').replace(/\s*\n+\s*/g, ' | '),
      };
    },
    GATE_XPATH,
    RptCss.gateFilledDot,
    RptCss.gateEmptyDot,
    RptCss.gateError,
  );
}

/** Tick the guard's "Do not require passcode for the next 30 minutes" box. */
export async function gateTickSkip(): Promise<void> {
  const dlg = await gateElement();
  if (!dlg) throw new Error('Passcode guard is not on screen');
  const box = await dlg.$('#passcode-skip-30min').getElement();
  if (await box.isExisting()) {
    await box.click();
    return;
  }
  await (await dlg.$('.//*[@role="checkbox"]').getElement()).click();
}

export async function gateSkipChecked(): Promise<boolean | null> {
  const dlg = await gateElement();
  if (!dlg) return null;
  let box = await dlg.$('#passcode-skip-30min').getElement();
  if (!(await box.isExisting())) box = await dlg.$('.//*[@role="checkbox"]').getElement();
  if (!(await box.isExisting())) return null;
  const aria = await box.getAttribute('aria-checked');
  if (aria !== null) return aria === 'true';
  return (await box.getAttribute('data-state')) === 'checked';
}

/** A 4-digit code that is NOT the configured owner/staff passcode. */
export function unknownCode(): string {
  const fromEnv = (process.env['VOLT_RPT_INVALID_CODE'] ?? '').trim();
  if (fromEnv !== '') return fromEnv;
  const known = new Set([env.OWNER_PASSCODE, env.STAFF_PASSCODE]);
  return ['1357', '2468', '9753', '8642'].find((c) => !known.has(c)) ?? '1357';
}

export interface SkipGrant {
  staffId: string;
  expiresAt: number;
}

export async function readSkip(): Promise<SkipGrant | null> {
  return browser.execute(function (k: string) {
    try {
      const raw = window.localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as { staffId: string; expiresAt: number }) : null;
    } catch {
      return null;
    }
  }, SKIP_KEY);
}

/** Push the stored grant's expiry into the past. */
export async function expireSkip(): Promise<void> {
  await browser.execute(function (k: string) {
    try {
      const s = JSON.parse(window.localStorage.getItem(k) ?? '{}') as Record<string, unknown>;
      s['expiresAt'] = Date.now() - 1000;
      window.localStorage.setItem(k, JSON.stringify(s));
    } catch {
      // storage unavailable — nothing to expire
    }
  }, SKIP_KEY);
}

/* ------------------------------------------------------------------------- *
 * Sidebar
 * ------------------------------------------------------------------------- */

/** Open the ☰ sidebar and return its visible lines. */
export async function openSidebar(): Promise<string[]> {
  await closeStrayDialogs();
  const btn = await $('button[aria-label="Open sidebar"]').getElement();
  await btn.waitForClickable({ timeout: Timeouts.MEDIUM });
  await btn.click();
  await browser.waitUntil(async () => (await countCss('body', RptCss.sidebar)) > 0, {
    timeout: Timeouts.SHORT,
    interval: 150,
    timeoutMsg: 'Sidebar did not open',
  });
  await settle(300);
  return paneLines(RptCss.sidebar);
}

export async function sidebarOpen(): Promise<boolean> {
  return (await countCss('body', RptCss.sidebar)) > 0;
}

/** A sidebar link's `aria-current` and class list. */
export async function sidebarLinkState(
  text: string,
): Promise<{ ariaCurrent: string | null; classes: string } | null> {
  return browser.execute(
    function (css: string, t: string) {
      const sb = document.querySelector(css);
      if (!sb) return null;
      const a = Array.from(sb.querySelectorAll('a')).find(function (x) {
        return (x.textContent || '').replace(/\s+/g, ' ').trim() === t;
      });
      return a ? { ariaCurrent: a.getAttribute('aria-current'), classes: a.className } : null;
    },
    RptCss.sidebar,
    text,
  );
}

export async function clickSidebarLink(text: string): Promise<void> {
  await clickIn(RptCss.sidebar, `.//a[normalize-space(.)="${text}"]`);
}
