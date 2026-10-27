import { browser } from '@wdio/globals';
import { ReportDomCss, type Bilingual } from '../../constants/testids.reports-v4.js';
import { parseMoney } from '../../utils/money.js';

/**
 * In-page readers shared by the report page objects (Batch History, Income
 * Summary, Reports V4).
 *
 * ## Why one `browser.execute` instead of element-by-element reads
 *
 * The report tables run to hundreds of rows (Batch Close Review listed 985 on
 * the scan day, Staff Payroll 337). Reading them cell by cell over WebDriver is
 * thousands of round trips; one script returns the whole table in a single
 * call, and it reads the DOM exactly as rendered at one instant instead of
 * stitching a table together across re-renders.
 *
 * ## Two DOM shapes this has to absorb
 *
 * - **Split tables.** Batch History renders its header as one `<table>` with no
 *   rows and its body as a second, headless `<table>`. {@link readTables}
 *   re-joins a header-only table with the headless table that follows it.
 * - **Repeated labels.** Detail panels repeat "Total Payment" / "Tip" across
 *   blocks, so they are read as an ordered list of visible text lines
 *   ({@link visibleLines}) and parsed by position, not located by label.
 *
 * Neither reader asserts anything; they return what is on screen.
 */

/** A logical table: header texts and body rows of cell texts (newlines kept inside cells). */
export interface ReportTable {
  head: string[];
  rows: string[][];
}

/** Every visible table on the screen, split header/body tables re-joined. */
export async function readTables(): Promise<ReportTable[]> {
  return browser.execute(function (css: typeof ReportDomCss) {
    const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
    const shown = (el: Element): boolean => el.getClientRects().length > 0;
    const raw: { head: string[]; rows: string[][] }[] = [];

    for (const table of Array.from(document.querySelectorAll(css.table))) {
      if (!shown(table)) continue;
      const head = Array.from(table.querySelectorAll(css.headCell)).map((th) =>
        norm((th as HTMLElement).innerText || th.textContent || ''),
      );
      const rows: string[][] = [];
      for (const tr of Array.from(table.querySelectorAll(css.bodyRow))) {
        const cells = Array.from(tr.querySelectorAll(css.cell));
        if (cells.length === 0) continue;
        rows.push(
          cells.map((td) =>
            ((td as HTMLElement).innerText || td.textContent || '')
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line !== '')
              .join('\n'),
          ),
        );
      }
      raw.push({ head, rows });
    }

    const out: { head: string[]; rows: string[][] }[] = [];
    for (let i = 0; i < raw.length; i += 1) {
      const current = raw[i]!;
      const next = raw[i + 1];
      if (current.head.length > 0 && current.rows.length === 0 && next && next.head.length === 0) {
        out.push({ head: current.head, rows: next.rows });
        i += 1;
      } else {
        out.push(current);
      }
    }
    return out;
  }, ReportDomCss);
}

/** The first table whose header contains one of `marker`'s texts, or `null`. */
export async function findTable(marker: Bilingual): Promise<ReportTable | null> {
  const tables = await readTables();
  return tables.find((t) => t.head.some((h) => marker.includes(h))) ?? null;
}

export interface VisibleLinesOptions {
  /**
   * Only return text that comes AFTER (in document order, outside) the first
   * table whose header carries one of these texts — i.e. a report's detail
   * panel, which renders after its table.
   */
  afterTableWithHead?: Bilingual;
}

/**
 * Visible text of the screen, one entry per element, in document order.
 *
 * Consecutive text nodes of the SAME element are joined (React renders
 * `Total Income {date}` as two nodes), different elements stay separate lines.
 */
export async function visibleLines(opts: VisibleLinesOptions = {}): Promise<string[]> {
  return browser.execute(
    function (css: typeof ReportDomCss, marker: readonly string[] | null) {
      let anchor: Element | null = null;
      if (marker) {
        for (const table of Array.from(document.querySelectorAll(css.table))) {
          const heads = Array.from(table.querySelectorAll(css.headCell)).map((th) =>
            (th.textContent || '').replace(/\s+/g, ' ').trim(),
          );
          if (heads.some((h) => marker.includes(h))) {
            anchor = table;
            break;
          }
        }
        if (!anchor) return [];
      }

      const lines: string[] = [];
      let lastParent: Element | null = null;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent) continue;
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (text === '') continue;
        if (parent.closest('script, style, noscript')) continue;
        if (parent.getClientRects().length === 0) continue;
        const style = window.getComputedStyle(parent);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        if (anchor) {
          if (anchor.contains(node)) continue;
          if (!(anchor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        }
        if (parent === lastParent && lines.length > 0) {
          lines[lines.length - 1] = `${lines[lines.length - 1]!} ${text}`;
        } else {
          lines.push(text);
        }
        lastParent = parent;
      }
      return lines;
    },
    ReportDomCss,
    opts.afterTableWithHead ?? null,
  );
}

/* ------------------------------------------------------------------------- *
 * Pure parsing helpers (Node side)
 * ------------------------------------------------------------------------- */

const MONEY_LINE = /^[-−]?\s*\$\s?[\d,]+(?:\.\d+)?$/;
const COUNT_LINE = /^-?[\d,]+$/;

export const isMoneyText = (text: string): boolean => MONEY_LINE.test(text.trim());
export const isCountText = (text: string): boolean => COUNT_LINE.test(text.trim());

/** `parseMoney` that tolerates the typographic minus some cells render. */
export function moneyCents(text: string): number {
  return parseMoney(text.trim().replace(/^−/, '-'));
}

/** A bare integer count (`4414`, `1,024`). Throws on anything else. */
export function countOf(text: string): number {
  const trimmed = text.trim();
  if (!isCountText(trimmed)) {
    throw new Error(`countOf(): ${JSON.stringify(text)} is not a bare integer count.`);
  }
  return Number.parseInt(trimmed.replace(/,/g, ''), 10);
}

/**
 * The value of a card/tile: the first money or count line within `lookahead`
 * lines after the first line equal to one of `title`'s texts. Percent badges
 * and description sentences are skipped. `null` when the title is not on screen.
 */
export function cardValueText(lines: string[], title: Bilingual, lookahead = 4): string | null {
  const index = lines.findIndex((line) => title.includes(line));
  if (index < 0) return null;
  for (let i = index + 1; i <= Math.min(lines.length - 1, index + lookahead); i += 1) {
    const line = lines[i]!;
    if (isMoneyText(line) || isCountText(line)) return line;
  }
  return null;
}

/** Up to `lookahead` lines following a card title — used to check a tile's "vs Yesterday" line. */
export function linesAfter(lines: string[], title: Bilingual, lookahead = 5): string[] {
  const index = lines.findIndex((line) => title.includes(line));
  return index < 0 ? [] : lines.slice(index + 1, index + 1 + lookahead);
}

/** Pair every label line with the money line right after it (one parenthesised note line allowed between). */
export function labelMoneyPairs(lines: string[]): { label: string; text: string }[] {
  const pairs: { label: string; text: string }[] = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const label = lines[i]!;
    if (isMoneyText(label)) continue;
    let j = i + 1;
    if (lines[j]!.startsWith('(') && j + 1 < lines.length) j += 1;
    if (isMoneyText(lines[j]!)) {
      pairs.push({ label, text: lines[j]! });
      i = j;
    }
  }
  return pairs;
}
