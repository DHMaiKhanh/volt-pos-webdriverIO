import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import {
  DATE_PRESETS,
  groupTab,
  presetOption,
  ReportChromeIds,
  type DatePreset,
  type GroupTab,
} from '../../constants/testids.reports-v4.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/**
 * The report chrome every date-ranged report screen shares — preset combobox,
 * date-range button, Day/Week/Month tabs, loading skeletons.
 *
 * Batch History, Income Summary and the V4 reports render the very same
 * components, so the reads and the preset change live here once instead of
 * being re-typed per page object.
 */
export abstract class ReportBasePage extends BasePage {
  /** Wait for loading placeholders to clear, then one re-render. */
  async waitForDataSettled(timeout: number = Timeouts.MEDIUM): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!(await this.exists(ReportChromeIds.skeleton, 300))) break;
      await settle(200);
    }
    await settle(300);
  }

  async presetText(): Promise<string> {
    return this.text(ReportChromeIds.presetCombobox, { visible: true });
  }

  async dateRangeText(): Promise<string> {
    return this.text(ReportChromeIds.dateRange, { visible: true });
  }

  /** Open the preset combobox, read every option in order, close it with Escape. */
  async presetOptions(): Promise<string[]> {
    await this.click(ReportChromeIds.presetCombobox);
    const options = await this.findAll(ReportChromeIds.options, { timeout: Timeouts.SHORT });
    const texts: string[] = [];
    for (const option of options) texts.push((await option.getText()).trim());
    await browser.keys(['Escape']);
    await this.waitGone(ReportChromeIds.options, Timeouts.SHORT).catch(() => undefined);
    return texts;
  }

  async selectPreset(preset: DatePreset): Promise<this> {
    await logStep(`${this.name}: preset → ${DATE_PRESETS[preset][0]}`);
    await this.click(ReportChromeIds.presetCombobox);
    await this.click(presetOption(preset));
    await this.waitGone(ReportChromeIds.options, Timeouts.SHORT).catch(() => undefined);
    await this.waitForDataSettled();
    return this;
  }

  /** Is the group-by tab rendered? */
  async hasTab(tab: GroupTab): Promise<boolean> {
    return this.isVisible(groupTab(tab), Timeouts.SHORT);
  }

  /** Is the group-by tab the active one (Radix `data-state` / `aria-selected`)? */
  async isTabActive(tab: GroupTab): Promise<boolean> {
    const el = await this.find(groupTab(tab), { visible: true, timeout: Timeouts.SHORT });
    const state = await el.getAttribute('data-state');
    if (state !== null) return state === 'active';
    return (await el.getAttribute('aria-selected')) === 'true';
  }

  async selectTab(tab: GroupTab): Promise<this> {
    await logStep(`${this.name}: group by ${tab}`);
    await this.click(groupTab(tab));
    // Give the tab a moment to flip; the SPEC decides whether it did.
    await browser
      .waitUntil(async () => this.isTabActive(tab), { timeout: Timeouts.SHORT, interval: 150 })
      .catch(() => undefined);
    await this.waitForDataSettled();
    return this;
  }
}
