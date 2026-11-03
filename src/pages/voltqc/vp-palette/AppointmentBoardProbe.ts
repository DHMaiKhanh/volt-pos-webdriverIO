import { browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { PaletteCss, PaletteIds } from '../../../constants/testids.vp-palette.js';
import { UiObject } from '../../../support/UiObject.js';
import { toHex } from '../../../utils/color.js';

/** One column of the Appointment Overview board, as rendered. */
export interface BoardColumn {
  /** The header's `translateX` — the column's position on the board. */
  x: number;
  /** The header label (nickname, or "Unassigned"); an "(Inactive)" suffix is dropped. */
  name: string;
  /** The header's bottom border colour = the column colour, upper-case `#RRGGBB`. */
  color: string;
}

/** One appointment card read off a column. */
export interface BoardCard {
  /** First line of the card (customer name). */
  title: string;
  /** Left border colour (`#RRGGBB`). */
  border: string;
  /** Inline `color-mix(…)` staff tint present (VP-4402). */
  tinted: boolean;
  /** Computed background (`#RRGGBB`, the mix already resolved). */
  background: string;
}

/**
 * Read-only probe of the Appointment Overview scheduler for VP-4402.
 *
 * The board virtualises its columns horizontally (200 px each, absolutely
 * positioned by `translateX`) and its time rows vertically, so neither a single
 * DOM read nor `findAll` sees the whole board. Both reads below sweep the
 * board's own scroll container in ONE `browser.execute` and put the scroll
 * position back where they found it. Nothing is clicked.
 */
export class AppointmentBoardProbe extends UiObject {
  readonly name = 'Appointment board';

  async waitForColumns(): Promise<void> {
    await this.find(PaletteIds.boardHeaderCells, { timeout: Timeouts.MEDIUM });
  }

  /** Every column header, left to right, Unassigned first. */
  async columns(): Promise<BoardColumn[]> {
    await this.waitForColumns();
    const raw = await browser.execute(async (headerCss: string) => {
      const cells = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(headerCss));
      const first = cells()[0];
      if (!first) return [];
      let scroller: HTMLElement | null = first.parentElement;
      while (scroller && !/(auto|scroll)/.test(window.getComputedStyle(scroller).overflowX)) {
        scroller = scroller.parentElement;
      }
      const seen = new Map<number, { name: string; color: string }>();
      const collect = (): void => {
        for (const cell of cells()) {
          const match = /translateX\((-?[\d.]+)px\)/.exec(cell.style.transform);
          if (!match) continue;
          const x = Number(match[1]);
          if (seen.has(x)) continue;
          const span = cell.querySelector('span');
          const label = span?.firstChild?.textContent ?? span?.textContent ?? '';
          seen.set(x, { name: label.trim(), color: window.getComputedStyle(cell).borderBottomColor });
        }
      };
      if (!scroller) {
        collect();
      } else {
        const start = scroller.scrollLeft;
        const step = Math.max(200, Math.floor(scroller.clientWidth * 0.8));
        for (let left = 0; ; left += step) {
          scroller.scrollLeft = left;
          await new Promise((resolve) => setTimeout(resolve, 150));
          collect();
          if (left >= scroller.scrollWidth - scroller.clientWidth) break;
        }
        scroller.scrollLeft = start;
      }
      return Array.from(seen.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([x, v]) => ({ x, name: v.name, color: v.color }));
    }, PaletteCss.boardHeaderCell);
    return raw.map((c) => ({ x: c.x, name: c.name, color: toHex(c.color) }));
  }

  /**
   * The cards rendered in the column headed `columnName` across the whole day:
   * scroll that column into view, then sweep the time rows top to bottom.
   */
  async cardsInColumn(columnName: string): Promise<BoardCard[]> {
    await this.waitForColumns();
    const raw = await browser.execute(
      async (headerCss: string, cardCss: string, wanted: string) => {
        const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
        const cells = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(headerCss));
        const labelOf = (cell: HTMLElement): string => {
          const span = cell.querySelector('span');
          return (span?.firstChild?.textContent ?? span?.textContent ?? '').trim();
        };
        const first = cells()[0];
        if (!first) return [];
        let scroller: HTMLElement | null = first.parentElement;
        while (scroller && !/(auto|scroll)/.test(window.getComputedStyle(scroller).overflowX)) {
          scroller = scroller.parentElement;
        }
        if (!scroller) return [];
        const startLeft = scroller.scrollLeft;
        const startTop = scroller.scrollTop;

        // 1. Horizontal sweep until the wanted header mounts, then centre it.
        let header: HTMLElement | undefined;
        const step = Math.max(200, Math.floor(scroller.clientWidth * 0.8));
        for (let left = 0; !header; left += step) {
          scroller.scrollLeft = left;
          await sleep(150);
          header = cells().find((c) => labelOf(c) === wanted);
          if (left >= scroller.scrollWidth - scroller.clientWidth) break;
        }
        if (!header) {
          scroller.scrollLeft = startLeft;
          return [];
        }
        const x = Number(/translateX\((-?[\d.]+)px\)/.exec(header.style.transform)?.[1] ?? '0');
        scroller.scrollLeft = Math.max(0, x - scroller.clientWidth / 2);
        await sleep(200);
        header = cells().find((c) => labelOf(c) === wanted) ?? header;
        const box = header.getBoundingClientRect();

        // 2. Vertical sweep over the day, collecting the cards under that header.
        const cards = new Map<
          string,
          { title: string; border: string; tinted: boolean; background: string }
        >();
        const vStep = Math.max(200, Math.floor(scroller.clientHeight * 0.8));
        for (let top = 0; ; top += vStep) {
          scroller.scrollTop = top;
          await sleep(150);
          for (const el of Array.from(document.querySelectorAll<HTMLElement>(cardCss))) {
            if (!el.style.borderTopColor || !el.style.borderLeftColor) continue;
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            if (cx < box.left || cx > box.right || r.height === 0) continue;
            const title = (el.innerText.split('\n')[0] ?? '').trim();
            const key = `${title}@${String(Math.round(r.top + scroller.scrollTop))}`;
            if (cards.has(key)) continue;
            const style = window.getComputedStyle(el);
            cards.set(key, {
              title,
              border: style.borderLeftColor,
              tinted: (el.getAttribute('style') ?? '').includes('color-mix'),
              background: style.backgroundColor,
            });
          }
          if (top >= scroller.scrollHeight - scroller.clientHeight) break;
        }
        scroller.scrollLeft = startLeft;
        scroller.scrollTop = startTop;
        return Array.from(cards.values());
      },
      PaletteCss.boardHeaderCell,
      PaletteCss.boardCard,
      columnName,
    );
    return raw.map((c) => ({
      title: c.title,
      border: toHex(c.border),
      tinted: c.tinted,
      background: toHex(c.background),
    }));
  }
}

export const appointmentBoardProbe = new AppointmentBoardProbe();
