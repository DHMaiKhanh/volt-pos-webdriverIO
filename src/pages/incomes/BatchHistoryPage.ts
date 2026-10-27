import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import {
  BatchHistoryIds,
  BatchLabels,
  batchReviewOrderButton,
  batchTotalAmountButton,
} from '../../constants/testids.batch-history.js';
import { ReportChromeIds } from '../../constants/testids.reports-v4.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { ReportBasePage } from './ReportBasePage.js';
import { findTable, visibleLines } from './reportDom.js';

/** One row of the batch list, as rendered (raw text; the spec parses). */
export interface BatchRow {
  batchDate: string;
  batchNumber: string;
  status: string;
  totalPayment: string;
  totalAmount: string;
}

/** One row of the Batch Close Review table, as rendered. */
export interface BatchReviewRow {
  odCode: string;
  subtotal: string;
  tip: string;
  total: string;
}

/**
 * Batch History — `/batch-history`.
 *
 * READ-ONLY by contract: this page object exposes no way to close a batch or
 * print, and must not grow one — the suite runs it against shared merchants.
 * (The scan found no Close Batch button on this screen anyway.)
 *
 * No passcode gate on build 1.1.56. The Batch Close Review panel opens from the
 * Total Amount BUTTON in a batch row; a click on the row does nothing.
 */
export class BatchHistoryPage extends ReportBasePage {
  readonly name = 'Batch History';
  readonly route = Routes.BATCH_HISTORY;

  /** The preset combobox mounts with the filter state the list query depends on. */
  protected readonly readyAnchor: Locator = ReportChromeIds.presetCombobox;

  /** Direct route (used when navigation is not what is under test). */
  async open(): Promise<this> {
    await logStep(`Open ${this.name}`);
    await goTo(this.route);
    await this.waitForReady();
    await this.waitForDataSettled();
    return this;
  }

  async headingText(): Promise<string> {
    return this.text(BatchHistoryIds.heading, { visible: true });
  }

  /** The batch list header texts. */
  async batchHeaders(): Promise<string[]> {
    return (await findTable(BatchLabels.batchNumber))?.head ?? [];
  }

  /** Every batch row currently listed. */
  async batchRows(): Promise<BatchRow[]> {
    const table = await findTable(BatchLabels.batchNumber);
    return (table?.rows ?? [])
      .filter((cells) => cells.length >= 5)
      .map(([batchDate, batchNumber, status, totalPayment, totalAmount]) => ({
        batchDate: (batchDate ?? '').replace(/\s+/g, ' '),
        batchNumber: batchNumber ?? '',
        status: status ?? '',
        totalPayment: totalPayment ?? '',
        totalAmount: totalAmount ?? '',
      }));
  }

  /** Is the right panel showing its "No item selected" empty state? */
  async isPanelEmpty(): Promise<boolean> {
    return this.isVisible(BatchHistoryIds.noItemSelected, Timeouts.SHORT);
  }

  /**
   * Open the Batch Close Review for the N-th (1-based) batch row by pressing
   * its Total Amount button, and wait for the review title.
   */
  async openReview(n = 1): Promise<this> {
    await logStep(`${this.name}: open Batch Close Review for row ${String(n)}`);
    await this.click(batchTotalAmountButton(n));
    await this.find(BatchHistoryIds.reviewTitle, { visible: true, timeout: Timeouts.MEDIUM });
    await this.waitForDataSettled();
    return this;
  }

  async isReviewOpen(): Promise<boolean> {
    return this.isVisible(BatchHistoryIds.reviewTitle, Timeouts.SHORT);
  }

  /** The status line rendered right under the review title (e.g. "Not closed yet"). */
  async reviewStatusText(): Promise<string> {
    const lines = await visibleLines();
    const index = lines.findIndex((line) => (BatchLabels.reviewTitle as readonly string[]).includes(line));
    return index >= 0 ? (lines[index + 1] ?? '') : '';
  }

  async reviewHeaders(): Promise<string[]> {
    return (await findTable(BatchLabels.odCode))?.head ?? [];
  }

  /**
   * Every review row currently rendered. If the app virtualises the list this is
   * the RENDERED subset — the spec says so in its failure message.
   */
  async reviewRows(): Promise<BatchReviewRow[]> {
    const table = await findTable(BatchLabels.odCode);
    return (table?.rows ?? [])
      .filter((cells) => cells.length >= 4)
      .map(([odCode, subtotal, tip, total]) => ({
        odCode: odCode ?? '',
        subtotal: subtotal ?? '',
        tip: tip ?? '',
        total: total ?? '',
      }));
  }

  /** Is a given OD Code rendered as a button (the review's link to the order)? */
  async isReviewOrderClickable(odCode: string): Promise<boolean> {
    return this.isVisible(batchReviewOrderButton(odCode), Timeouts.SHORT);
  }
}

export default new BatchHistoryPage();
