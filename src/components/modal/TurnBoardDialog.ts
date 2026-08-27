import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { TurnIds } from '../../constants/testids.payroll.js';
import { logStep } from '../../helpers/steps.js';
import { cell, isBlankCell, readTable } from '../../helpers/table.js';
import { settle } from '../../helpers/wait.js';
import { BaseComponent } from '../BaseComponent.js';

/** How the board orders its rows. Values are the `turn.sort*` i18n keys. */
export type TurnSort = 'countAsc' | 'countDesc' | 'checkinAsc' | 'checkinDesc';

const SORT_LABELS: Record<TurnSort, [string, string]> = {
  countAsc: ['Fewest turns first', 'Ít lượt nhất trước'],
  countDesc: ['Most turns first', 'Nhiều lượt nhất trước'],
  checkinAsc: ['Earliest check-in first', 'Check-in sớm nhất trước'],
  checkinDesc: ['Latest check-in first', 'Check-in muộn nhất trước'],
};

/** One staff member's line on the board. */
export interface TurnRow {
  staff: string;
  /** The turn count as text — may carry decimals when the decimal setting is on. */
  turnCountText: string;
  /** {@link turnCountText} as a number; `0` when the cell is blank. */
  turnCount: number;
  /** Every other cell, by column order, for assertions this interface has not named. */
  cells: string[];
}

/**
 * The turn board.
 *
 * ## It is a dialog, and it has no URL
 *
 * The Playwright suite this was ported from models the board as a page with
 * `path = '/turn'`. No such route exists: `TurnBoardDialog` is mounted app-wide
 * in `volt-pos/src/routes/_app.tsx:77`, and the only way in is the floating
 * `TurnQuickView` launcher — which itself renders only on `/home`,
 * `/order-pending` and `/order-history` (`pathTurnQuickView`, same file).
 *
 * So {@link open} does not navigate. It presses the launcher, and it fails with
 * that explanation when the launcher is absent, because "the board would not
 * open" and "this screen never shows the launcher" are different problems.
 *
 * ## Turn counts are configurable, so do not hardcode arithmetic
 *
 * Three merchant settings change what a turn IS: a value threshold (`$25` means
 * a `$50` service is 2 turns), service-based vs order-based counting, and
 * whether counts carry decimals. A spec asserting "one order equals one turn"
 * is only right on a default configuration — read the settings, or assert on
 * relative change rather than absolute counts.
 */
export class TurnBoardDialog extends BaseComponent {
  readonly name = 'turn board';

  protected readonly root = TurnIds.dialog;

  /** Is the quick-view launcher on this screen at all? */
  hasLauncher(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(TurnIds.quickViewLauncher, timeout);
  }

  /**
   * Open the board from the quick-view.
   *
   * Idempotent — already-open returns immediately, so a spec can call it
   * without tracking state.
   */
  async open(): Promise<this> {
    if (await this.isOpen(Timeouts.ANIMATION)) return this;

    if (!(await this.hasLauncher())) {
      throw new Error(
        'The turn quick-view launcher is not on this screen, so the board cannot be opened.\n' +
          'It renders only on /home, /order-pending and /order-history (pathTurnQuickView in ' +
          'volt-pos/src/routes/_app.tsx). Navigate to one of those first — there is no /turn ' +
          'route to go to.',
      );
    }

    await logStep('Open the turn board');
    await this.click(TurnIds.quickViewLauncher);

    // The launcher opens a small panel; "View Turn" inside it opens the board.
    // The panel is skipped on some builds where the launcher opens the board
    // directly, so the button is optional rather than awaited.
    if (await this.isVisible(TurnIds.viewTurn, Timeouts.SHORT)) {
      await this.click(TurnIds.viewTurn);
    }

    await this.waitOpen();
    return this;
  }

  async close(): Promise<void> {
    if (!(await this.isOpen(Timeouts.ANIMATION))) return;
    await browser.keys(['Escape']);
    await this.waitClosed(Timeouts.SHORT);
  }

  /* --------------------------------------------------------------------- *
   * Reading the board
   * --------------------------------------------------------------------- */

  /** Is the board showing its "nobody clocked in" state? A real state, not empty data. */
  hasNoStaff(): Promise<boolean> {
    return this.isVisible(TurnIds.noStaff, Timeouts.SHORT);
  }

  /**
   * Every row on the board.
   *
   * Read through `readTable` rather than element-by-element: the board is a
   * dialog over a live screen and each WebDriver round trip is a chance for a
   * re-render to invalidate the handle mid-loop.
   */
  async rows(): Promise<TurnRow[]> {
    await this.waitOpen(Timeouts.SHORT);
    const table = await readTable('[role="dialog"] table');

    return table.rows
      .map((row) => {
        const staff = cell(table, row, 'Staff', 'Nhân viên') ?? row.cells[0] ?? '';
        const turnCountText = cell(table, row, 'Turn count', 'Số lượt') ?? '';
        const parsed = Number.parseFloat(turnCountText.replace(/[^\d.-]/g, ''));

        return {
          staff,
          turnCountText,
          turnCount: Number.isFinite(parsed) && !isBlankCell(turnCountText) ? parsed : 0,
          cells: row.cells,
        };
      })
      .filter((row) => row.staff !== '');
  }

  /** One staff member's row, or `null` when they are not on the board. */
  async rowFor(staffName: string): Promise<TurnRow | null> {
    return (await this.rows()).find((row) => row.staff.includes(staffName)) ?? null;
  }

  /** Staff names in the order the board currently lists them. */
  async staffOrder(): Promise<string[]> {
    return (await this.rows()).map((row) => row.staff);
  }

  /* --------------------------------------------------------------------- *
   * Controls
   * --------------------------------------------------------------------- */

  /** Re-sort the board. */
  async setSort(sort: TurnSort): Promise<this> {
    await logStep(`Turn board: sort ${sort}`);
    await this.click(TurnIds.sortSelect);

    const [en, vi] = SORT_LABELS[sort];
    const options = await this.findAll(TurnIds.sortOptions, { timeout: Timeouts.SHORT });

    for (const option of options) {
      const text = (await option.getText()).trim();
      if (text === en || text === vi) {
        await option.click();
        await settle();
        return this;
      }
    }

    await browser.keys(['Escape']);
    throw new Error(`Turn board: the sort dropdown offers no "${en}" / "${vi}" option.`);
  }

  /** Open the manual-adjustment dialog. */
  async openAdjust(): Promise<this> {
    await this.click(TurnIds.adjustTurn);
    await this.find(TurnIds.adjustDialog, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  /** Open the turn-settings dialog — threshold, service-based, decimals. */
  async openSettings(): Promise<this> {
    await this.click(TurnIds.settings);
    await this.find(TurnIds.settingsDialog, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }
}

export const turnBoardDialog = new TurnBoardDialog();
