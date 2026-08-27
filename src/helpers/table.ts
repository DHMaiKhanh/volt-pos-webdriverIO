import { browser } from '@wdio/globals';

/**
 * Reading a data table.
 *
 * ## One round trip, not one per cell
 *
 * A day's Time Tracking or Order History table is routinely dozens of rows of
 * eight columns. Walking it with `$$('tr')` then `$$('td')` then `getText()` is
 * hundreds of WebDriver round trips — each one a full HTTP request to the
 * driver — and turns a sub-second read into ten seconds. Everything here goes
 * through a single `browser.execute`, which runs in the page and returns the
 * whole table at once. That is the same trick the Playwright suite used, and it
 * matters more here because a WebDriver round trip costs more than a CDP one.
 *
 * ## Columns are addressed by HEADER, never by index
 *
 * The app's tables change shape with merchant configuration — a salon paying
 * salary shows columns a commission-only salon does not — so `cells[3]` is
 * wrong on the next merchant and silently returns a different figure rather
 * than failing. {@link readTable} maps header text to index once, and
 * {@link cell} looks a column up by name.
 *
 * Header text is TRANSLATED, so every lookup takes both spellings. That is the
 * single reason this file exists rather than a three-line inline helper.
 */

export interface TableRow {
  /** Cell text by column index, whitespace-collapsed. */
  cells: string[];
  /** The whole row's text, for a regex that spans columns (an order code). */
  text: string;
}

export interface TableData {
  /** Header text, in column order. Empty when the table has no `thead`. */
  headers: string[];
  rows: TableRow[];
}

/**
 * Read a whole table in one call.
 *
 * `selector` must match the `<table>` (or `[role="table"]`) itself. A table
 * that is not present resolves to empty headers and rows rather than throwing —
 * "no rows" is a legitimate state on every screen this is used for, and a
 * caller that needs a table to exist should have waited for it already.
 */
export async function readTable(selector: string): Promise<TableData> {
  return browser.execute(function (sel: string): TableData {
    const norm = function (value: string | null): string {
      return (value ?? '').replace(/\s+/g, ' ').trim();
    };

    const table = document.querySelector(sel);
    if (!table) return { headers: [], rows: [] };

    const headers = Array.prototype.slice
      .call(table.querySelectorAll('thead th, thead [role="columnheader"]'))
      .map(function (th: Element) {
        return norm(th.textContent);
      });

    const rows = Array.prototype.slice
      .call(table.querySelectorAll('tbody tr, tbody [role="row"]'))
      .map(function (tr: Element) {
        const cells = Array.prototype.slice.call(tr.querySelectorAll('td, [role="cell"]')).map(function (
          td: Element,
        ) {
          return norm(td.textContent);
        });
        return { cells: cells, text: norm(tr.textContent) };
      });

    return { headers: headers, rows: rows };
  }, selector);
}

/**
 * The index of a column, by any of its spellings.
 *
 * Returns `-1` when none match, which every caller must handle — a column that
 * this merchant's configuration does not render is a normal state, not an
 * error. Matching is exact after whitespace collapsing; a `contains` match
 * would make `Total` also hit `Total Hours`.
 */
export function columnIndex(table: TableData, ...names: string[]): number {
  return table.headers.findIndex((header) => names.includes(header));
}

/**
 * One cell, by column name.
 *
 * `null` distinguishes "this table has no such column" from "the cell is
 * empty", which are different problems: the first is a merchant-configuration
 * or translation issue, the second is data.
 */
export function cell(table: TableData, row: TableRow, ...names: string[]): string | null {
  const index = columnIndex(table, ...names);
  if (index < 0) return null;
  return row.cells[index] ?? null;
}

/**
 * Is a cell one of the app's "nothing here" renderings?
 *
 * The app prints an em dash, a hyphen or nothing at all depending on the
 * column, and treating those as data is how a `parseMoney()` failure ends up
 * blaming a selector.
 */
export function isBlankCell(value: string | null | undefined): boolean {
  const text = (value ?? '').trim();
  return text === '' || text === '-' || text === '—' || text === '–';
}
