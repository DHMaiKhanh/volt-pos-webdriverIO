import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import { settingsNavItem } from '../../constants/testids.js';
import {
  TippingSettingsIds,
  splitTipRadio,
  type SplitTipMethod,
} from '../../constants/testids.settings-tipping.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

export type { SplitTipMethod } from '../../constants/testids.settings-tipping.js';

/**
 * `/settings/payment-transaction` — "Tipping Settings" in the sidebar.
 *
 * ## What it covers
 *
 * The Split Tip Setting card (the method preselected when an order is completed:
 * Split Evenly / Proportion) and the screen's unsaved-changes leave guard —
 * the TanStack Router `blocker` that raises "Discard changes and leave?" when the
 * form is dirty and a sidebar link is clicked.
 *
 * On build 1.1.56 the screen also hosts Tip Setting, Signature and Supply Share
 * (the tip / signature controls moved here from `/settings/charge-fee`); their
 * selectors are catalogued in `testids.settings-tipping.ts`.
 *
 * ## Saving is explicit
 *
 * The split-tip value is MERCHANT config (server-side, survives a reload) and
 * changes the default split of every order a later spec completes. This page
 * object exposes {@link saveSplitTip} because the doc's TC-TIP-10..14 are about
 * the save itself; the spec owns restoring the original value.
 */
export class TippingSettingsPage extends BasePage {
  readonly name = 'Tipping settings';

  readonly route: string = Routes.SETTINGS_PAYMENT_TRANSACTION;

  /** A split-tip radio renders from the loaded merchant setting, so it proves the data arrived. */
  protected readonly readyAnchor: Locator = splitTipRadio('evenly');

  /* --------------------------------------------------------------------- *
   * Layout
   * --------------------------------------------------------------------- */

  isHeadingShown(): Promise<boolean> {
    return this.isVisible(TippingSettingsIds.heading, Timeouts.MEDIUM);
  }

  isDescriptionShown(): Promise<boolean> {
    return this.isVisible(TippingSettingsIds.description);
  }

  isSplitTipCardShown(): Promise<boolean> {
    return this.isVisible(TippingSettingsIds.splitTipTitle);
  }

  /* --------------------------------------------------------------------- *
   * Split Tip radios
   * --------------------------------------------------------------------- */

  /** The `value` attribute of every radio in the split-tip group, in DOM order. */
  async splitTipValues(): Promise<string[]> {
    const radios = await this.findAll(TippingSettingsIds.splitTipRadios, { timeout: Timeouts.MEDIUM });
    const values: string[] = [];
    for (const radio of radios) values.push((await radio.getAttribute('value')) ?? '');
    return values;
  }

  async isSplitTipChecked(method: SplitTipMethod): Promise<boolean> {
    const el = await this.find(splitTipRadio(method));
    const aria = await el.getAttribute('aria-checked');
    if (aria === 'true' || aria === 'false') return aria === 'true';
    return (await el.getAttribute('data-state')) === 'checked';
  }

  /** The method currently selected on screen, or `null` when neither radio is checked. */
  async selectedSplitTip(): Promise<SplitTipMethod | null> {
    if (await this.isSplitTipChecked('evenly')) return 'evenly';
    if (await this.isSplitTipChecked('proportion')) return 'proportion';
    return null;
  }

  async chooseSplitTip(method: SplitTipMethod): Promise<this> {
    await logStep(`Tipping: split tip → ${method}`);
    await this.click(splitTipRadio(method));
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Split Tip Save
   * --------------------------------------------------------------------- */

  async isSplitTipSaveEnabled(): Promise<boolean> {
    const save = await this.find(TippingSettingsIds.splitTipSaveBtn, { visible: true });
    return save.isEnabled();
  }

  /**
   * Press the split-tip card's Save. WRITES merchant config — the caller restores.
   * Returns once the click landed; the spec reads the toast / Save state.
   */
  async saveSplitTip(): Promise<this> {
    await logStep('Tipping: save split tip setting');
    await this.click(TippingSettingsIds.splitTipSaveBtn);
    return this;
  }

  /**
   * Wait for the split-tip Save to go disabled again (the mutation resolved and
   * the form reset its dirty flag). Resolves `false` instead of throwing so the
   * spec owns the verdict.
   */
  async waitSplitTipSaveDisabled(timeout: number = Timeouts.API): Promise<boolean> {
    try {
      await browser.waitUntil(async () => !(await this.isSplitTipSaveEnabled()), {
        timeout,
        interval: 250,
      });
      return true;
    } catch {
      return false;
    }
  }

  /* --------------------------------------------------------------------- *
   * Leave guard ("Discard changes and leave?")
   * --------------------------------------------------------------------- */

  /**
   * Click a settings-sidebar entry WITHOUT waiting for the route to change —
   * `SettingsPage.openSection()` waits on the path, which is exactly what a dirty
   * form's blocker prevents.
   */
  async clickSidebarEntry(path: string): Promise<this> {
    await logStep(`Tipping: click settings sidebar → ${path}`);
    await this.click(settingsNavItem(path));
    await settle();
    return this;
  }

  isLeaveGuardShown(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(TippingSettingsIds.leaveGuardDialog, timeout);
  }

  readLeaveGuardTitle(): Promise<string> {
    return this.text(TippingSettingsIds.leaveGuardTitle, { timeout: Timeouts.SHORT });
  }

  readLeaveGuardMessage(): Promise<string> {
    return this.text(TippingSettingsIds.leaveGuardMessage, { timeout: Timeouts.SHORT });
  }

  /** Labels of the guard's two actions, `[continue, discard]`. */
  async readLeaveGuardButtons(): Promise<[string, string]> {
    const keep = await this.text(TippingSettingsIds.leaveGuardContinueBtn, { timeout: Timeouts.SHORT });
    const discard = await this.text(TippingSettingsIds.leaveGuardDiscardBtn, { timeout: Timeouts.SHORT });
    return [keep, discard];
  }

  /** "Continue Editing" — stay on the screen with the change kept. */
  async continueEditing(): Promise<this> {
    await this.click(TippingSettingsIds.leaveGuardContinueBtn);
    await this.waitGone(TippingSettingsIds.leaveGuardDialog, Timeouts.SHORT);
    return this;
  }

  /** "Discard & Leave" — drop the change and let the blocked navigation proceed. */
  async discardAndLeave(): Promise<this> {
    await this.click(TippingSettingsIds.leaveGuardDiscardBtn);
    await this.waitGone(TippingSettingsIds.leaveGuardDialog, Timeouts.SHORT);
    return this;
  }
}

export default new TippingSettingsPage();
