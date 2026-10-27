import { browser } from '@wdio/globals';
import { VqTipTableCss } from '../../../constants/testids.voltqc-settings-devm.js';
import { VqProbe } from './VqProbe.js';

/** One Tip Option row as displayed on Tipping Settings. */
export interface VqTipRow {
  /** The priority number in the first column — `''` on an Inactive row. */
  pos: string;
  /** Column 2: the input value while editing, else the cell text. */
  value: string;
  desc: string;
  active: boolean;
}

/**
 * Tipping Settings › Tip Option table, read in one round trip.
 *
 * The table is the one holding a "Tip Suggestion" header; a row is a
 * `tbody tr` with the five data cells (the empty-state row has one).
 */
export class VqTipTable extends VqProbe {
  async rows(): Promise<VqTipRow[]> {
    return browser.execute((css: { table: string; header: string }) => {
      const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
      const table = Array.from(document.querySelectorAll(css.table)).find(
        (t) =>
          t.getClientRects().length > 0 &&
          Array.from(t.querySelectorAll('th')).some((th) => norm(th.textContent) === css.header),
      );
      if (!table) return [];
      return Array.from(table.querySelectorAll('tbody tr'))
        .filter((tr) => tr.querySelectorAll('td').length >= 5)
        .map((tr) => {
          const td = Array.from(tr.querySelectorAll('td'));
          const valueInput = td[1]?.querySelector('input');
          const descInput = td[2]?.querySelector('input');
          return {
            pos: norm(td[0]?.textContent),
            value: valueInput ? valueInput.value : norm(td[1]?.textContent),
            desc: descInput ? descInput.value : norm(td[2]?.textContent),
            active: tr.querySelector('[role="switch"]')?.getAttribute('aria-checked') === 'true',
          };
        });
    }, VqTipTableCss);
  }
}

export const vqTipTable = new VqTipTable();
