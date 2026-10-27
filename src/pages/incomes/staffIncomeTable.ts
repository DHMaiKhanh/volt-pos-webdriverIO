import { browser } from '@wdio/globals';
import { INCOME_PANEL_CSS } from '../../constants/testids.incomes.js';
import { parseMoney } from '../../utils/money.js';

/**
 * Readers shared by Staff Income and Staff Payroll.
 *
 * Both screens render the SAME list (`createIncomeStaffListColumns`) and the
 * SAME detail-row component (`IncomeStaffDetailRow`), so the two page objects
 * share these instead of carrying two copies that drift.
 *
 * ## Why not `readTable()` from `src/helpers/table.ts`
 *
 * That helper reads `textContent`, and the Name cell is a `StaffAvatar`
 * (initial letter) followed by the nickname span with no whitespace between —
 * `textContent` yields `"ZZelene Doyle"`. `innerText` keeps the line break the
 * layout puts between them (`"Z\nZelene Doyle"`, exactly what the live DOM dump
 * shows), so the name is the LAST line. An image avatar renders no letter and
 * the cell is then the name alone, which the same rule handles.
 */

/** One staff-list row, money in integer cents. */
export interface StaffListRow {
  /** 0-based display index — the only unambiguous handle (names repeat on payroll). */
  index: number;
  name: string;
  orders: number;
  subtotalCents: number;
  supplyFeeCents: number;
  tipCents: number;
  totalIncomeCents: number;
  /** Cell text as rendered (innerText, lines joined by a space). */
  cells: string[];
}

export interface StaffListData {
  headers: string[];
  rows: StaffListRow[];
}

/** Header spellings, EN + VI (`global.name/orders/subtotal/supplyFee/tip/staffTotalIncome`). */
const COLS = {
  name: ['Name', 'Tên', 'Staff', 'Nhân viên'],
  orders: ['Orders', 'Đơn', 'Đơn hàng'],
  subtotal: ['Subtotal', 'Tạm tính'],
  supplyFee: ['Supply Fee', 'Phí vật tư'],
  tip: ['Tip', 'Tiền boa'],
  totalIncome: ['Total Income', 'Thu nhập thực nhận', 'Tổng thu nhập'],
} as const;

const moneyOrZero = (text: string | undefined, what: string): number => {
  if (text === undefined || text.trim() === '' || text.trim() === '-') return 0;
  try {
    return parseMoney(text);
  } catch (error) {
    throw new Error(`Staff list: the ${what} cell read "${text}", which is not one money amount.`, {
      cause: error,
    });
  }
};

/** Read the left-panel staff list in ONE round trip. */
export async function readStaffList(): Promise<StaffListData> {
  const raw = await browser.execute(function (rootCss: string) {
    const root = document.querySelector(rootCss) ?? document;
    const table = root.querySelector('table');
    if (!table) return { headers: [] as string[], rows: [] as { name: string; cells: string[] }[] };

    const norm = function (value: string | null | undefined): string {
      return (value ?? '').replace(/\s+/g, ' ').trim();
    };
    const headers = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function (
      th: HTMLElement,
    ) {
      return norm(th.innerText || th.textContent);
    });
    const rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr')).map(function (
      tr: HTMLElement,
    ) {
      const tds = Array.prototype.slice.call(tr.querySelectorAll('td')) as HTMLElement[];
      const first = tds[0];
      const lines = first
        ? (first.innerText || first.textContent || '')
            .split('\n')
            .map(function (line: string) {
              return line.trim();
            })
            .filter(function (line: string) {
              return line !== '';
            })
        : [];
      return {
        name: lines.length > 0 ? (lines[lines.length - 1] ?? '') : '',
        cells: tds.map(function (td: HTMLElement) {
          return norm(td.innerText || td.textContent);
        }),
      };
    });
    return { headers: headers, rows: rows };
  }, INCOME_PANEL_CSS.left);

  const col = (names: readonly string[]): number => raw.headers.findIndex((h) => names.includes(h));
  const idx = {
    orders: col(COLS.orders),
    subtotal: col(COLS.subtotal),
    supplyFee: col(COLS.supplyFee),
    tip: col(COLS.tip),
    totalIncome: col(COLS.totalIncome),
  };
  // Fall back to the documented column order when a header is translated in a
  // way this table does not know yet — better a read than a silent zero.
  const at = (i: number, fallback: number): number => (i >= 0 ? i : fallback);

  return {
    headers: raw.headers,
    rows: raw.rows
      .filter((row) => row.cells.length > 1)
      .map((row, index) => ({
        index,
        name: row.name,
        orders: Number.parseInt((row.cells[at(idx.orders, 1)] ?? '0').replace(/[^\d-]/g, ''), 10) || 0,
        subtotalCents: moneyOrZero(row.cells[at(idx.subtotal, 2)], 'Subtotal'),
        supplyFeeCents: moneyOrZero(row.cells[at(idx.supplyFee, 3)], 'Supply Fee'),
        tipCents: moneyOrZero(row.cells[at(idx.tip, 4)], 'Tip'),
        totalIncomeCents: moneyOrZero(row.cells[at(idx.totalIncome, 5)], 'Total Income'),
        cells: row.cells,
      })),
  };
}

/** One `IncomeStaffDetailRow` (or the Tip collapsible trigger) from the detail panel. */
export interface DetailField {
  /** The label with any `(description)` stripped, e.g. `Pay 1`. */
  label: string;
  /** The whole label text including its description, e.g. `Pay 1 (Staff Commission x 50% - Clean Up Fee)`. */
  fullLabel: string;
  /** The value as rendered, e.g. `$38.08`, `3`, `Wage Per Day`, `-`. */
  value: string;
}

/**
 * Every label/value row of the right-hand detail panel, in display order.
 *
 * A detail row is an element whose ONLY two element children are `<span>`s —
 * label then value (`income-staff-detail-row.tsx`); the Tip row is the same
 * shape on a `<button>` (`income-tip-row.tsx`); the per-period rate lines are
 * two spans too and come back with labels like `Commission Rate`. Rows inside a
 * `<table>` are excluded — that is the order list / daily breakdown.
 */
export async function readDetailFields(): Promise<DetailField[]> {
  return browser.execute(function (rootCss: string) {
    const root = document.querySelector(rootCss);
    if (!root) return [] as { label: string; fullLabel: string; value: string }[];

    const out: { label: string; fullLabel: string; value: string }[] = [];
    const all = Array.prototype.slice.call(root.querySelectorAll('div, button')) as HTMLElement[];
    for (const el of all) {
      if (el.closest('table')) continue;
      const kids = Array.prototype.slice.call(el.children) as HTMLElement[];
      const first = kids[0];
      const second = kids[1];
      if (kids.length !== 2 || !first || !second || first.tagName !== 'SPAN' || second.tagName !== 'SPAN')
        continue;
      const labelText = (first.innerText || first.textContent || '').trim();
      const value = (second.innerText || second.textContent || '').replace(/\s+/g, ' ').trim();
      if (labelText === '') continue;
      const firstLine = labelText.split('\n')[0] ?? '';
      const fullLabel = labelText.replace(/\s+/g, ' ').trim();
      const label = firstLine
        .replace(/\s*\(.*$/, '')
        .replace(/:\s*$/, '')
        .trim();
      out.push({ label: label, fullLabel: fullLabel, value: value });
    }
    return out;
  }, INCOME_PANEL_CSS.right);
}

/** The first field whose label is one of `labels`, or `null`. */
export function findField(fields: DetailField[], ...labels: string[]): DetailField | null {
  return fields.find((field) => labels.includes(field.label)) ?? null;
}

/** A field's value in cents; `null` when the label is absent or the value is not money. */
export function fieldCents(fields: DetailField[], ...labels: string[]): number | null {
  const field = findField(fields, ...labels);
  if (!field) return null;
  try {
    return parseMoney(field.value);
  } catch {
    return null;
  }
}
