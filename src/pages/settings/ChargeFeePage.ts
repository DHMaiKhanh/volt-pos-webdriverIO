import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import {
  ChargeFeeIds,
  chargeFeeDeleteTipOption,
  chargeFeeEditTipOption,
} from '../../constants/testids.settings.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/** Which tip unit the Tip Amount radio group is on. */
export type TipUnit = 'amount' | 'percent';

/**
 * `/settings/charge-fee` — the Charge & Fee screen: Tip Setting, Tax Setting and
 * Signature, under a single screen-level Save.
 *
 * ## Nothing here persists unless Save is pressed
 *
 * Every control is dirty-tracked locally and only written when the screen-level
 * Save is clicked (`isSaveEnabled()` reads that gate). This page object
 * deliberately exposes NO save method: the charge-fee specs verify behaviour by
 * making the screen dirty and reading it back, then reverting — so a run never
 * changes the merchant's tip/tax/signature configuration, which is global to
 * every order.
 *
 * ## Collapsing a section does not unmount it
 *
 * The three sections are `button[aria-expanded]` headers; collapsing one hides
 * its body but leaves it in the DOM (`docs/screens/charge-fee` §5). So
 * {@link isTipTableVisible} tests VISIBILITY, never element count — a collapsed
 * table still exists.
 *
 * ## Editing a tip option is inline, not a dialog
 *
 * Add opens the "Tip Settings" dialog; Edit turns the row's cells into inputs in
 * place, and — a known app quirk — Escape does NOT leave inline-edit mode (only
 * clicking Edit again does). {@link isRowEditing} counts the row's inputs to tell
 * the two states apart.
 */
export class ChargeFeePage extends BasePage {
  readonly name = 'Charge & Fee';

  readonly route: string = Routes.SETTINGS_CHARGE_FEE;

  /**
   * A tip-timing radio, not the heading: the heading is static chrome, while the
   * radio renders from the loaded tip settings, so its presence means the
   * screen's data arrived. `exists` (not visibility) is what `waitForReady` uses,
   * so a structurally-present Radix radio qualifies.
   */
  protected readonly readyAnchor: Locator = ChargeFeeIds.tipTimingAfter;

  /* --------------------------------------------------------------------- *
   * Sections
   * --------------------------------------------------------------------- */

  isHeadingShown(): Promise<boolean> {
    return this.isVisible(ChargeFeeIds.heading);
  }

  /** How many collapsible section headers are on screen. Expected: 3. */
  async sectionCount(): Promise<number> {
    return (await this.findAll(ChargeFeeIds.sectionHeaders, { timeout: Timeouts.MEDIUM })).length;
  }

  /** Is the section at `index` (1-based, in render order Tip/Tax/Signature) expanded? */
  async isSectionExpanded(index: number): Promise<boolean> {
    const header = await this.sectionHeaderAt(index);
    return (await header.getAttribute('aria-expanded')) === 'true';
  }

  /** Collapse or expand the section at `index`, whichever it currently is. */
  async toggleSection(index: number): Promise<this> {
    const header = await this.sectionHeaderAt(index);
    await header.waitForClickable({ timeout: Timeouts.SHORT });
    await header.click();
    await settle();
    return this;
  }

  /** Is the tip-option table currently VISIBLE (not merely mounted)? */
  isTipTableVisible(): Promise<boolean> {
    return this.isVisible(ChargeFeeIds.tipTable, Timeouts.ANIMATION);
  }

  /* --------------------------------------------------------------------- *
   * Save gate
   * --------------------------------------------------------------------- */

  /** Is the screen-level Save button pressable (i.e. is the screen dirty)? */
  async isSaveEnabled(): Promise<boolean> {
    const button = await this.find(ChargeFeeIds.saveBtn, { visible: true });
    return button.isEnabled();
  }

  /* --------------------------------------------------------------------- *
   * Tip Setting
   * --------------------------------------------------------------------- */

  /** How many tip-method checkboxes render. Expected: 4 (Card / Cash / Gift Card / Other). */
  async tipMethodCount(): Promise<number> {
    return (await this.findAll(ChargeFeeIds.tipMethodCheckboxes, { timeout: Timeouts.MEDIUM })).length;
  }

  isTipTimingAfterChecked(): Promise<boolean> {
    return this.isAriaChecked(ChargeFeeIds.tipTimingAfter);
  }

  isTipTypeAmountChecked(): Promise<boolean> {
    return this.isAriaChecked(ChargeFeeIds.tipTypeAmount);
  }

  /** Switch the Tip Amount unit. Changes the whole displayed option set — it is not a conversion. */
  async selectTipUnit(unit: TipUnit): Promise<this> {
    await this.click(unit === 'percent' ? ChargeFeeIds.tipTypePercent : ChargeFeeIds.tipTypeAmount);
    await settle();
    return this;
  }

  /** The tip-option table header row, as text — column titles. */
  readTableHeader(): Promise<string> {
    return this.text(ChargeFeeIds.tipTableHead, { timeout: Timeouts.MEDIUM });
  }

  async tipRowCount(): Promise<number> {
    return (await this.findAll(ChargeFeeIds.tipRows, { timeout: Timeouts.SHORT })).length;
  }

  /** Does the row carry its controls — a Status switch plus Edit and Delete buttons? */
  async hasRowControls(row: number): Promise<boolean> {
    const rows = await this.findAll(ChargeFeeIds.tipRows, { timeout: Timeouts.SHORT });
    const target = rows[row - 1];
    if (!target) return false;
    const switches = await target.$$('[role="switch"]').getElements();
    const buttons = await target.$$('button').getElements();
    // A Status switch, and at least Edit + Delete among the row's buttons.
    return switches.length >= 1 && buttons.length >= 2;
  }

  /** The Tip Amount cell (column 2) of each option row, top to bottom. */
  async tipAmountCells(): Promise<string[]> {
    const rows = await this.findAll(ChargeFeeIds.tipRows, { timeout: Timeouts.SHORT });
    const values: string[] = [];
    for (const row of rows) {
      const cell = await row.$('td:nth-child(2)').getElement();
      values.push((await cell.getText()).trim());
    }
    return values;
  }

  /* --------------------------------------------------------------------- *
   * Add Tip Option dialog
   * --------------------------------------------------------------------- */

  async openAddTipDialog(): Promise<this> {
    await this.click(ChargeFeeIds.addTipOptionBtn);
    await this.find(ChargeFeeIds.tipDialog, { timeout: Timeouts.MEDIUM, visible: true });
    return this;
  }

  isAddTipDialogShown(): Promise<boolean> {
    return this.isVisible(ChargeFeeIds.tipDialog);
  }

  /** The amount field's current value, as rendered (e.g. `$0.00`). */
  readAddTipAmount(): Promise<string> {
    return this.value(ChargeFeeIds.tipDialogAmount);
  }

  /** Type into the dialog's Amount field. */
  async typeAddTipAmount(text: string): Promise<this> {
    await this.setValue(ChargeFeeIds.tipDialogAmount, text);
    await settle();
    return this;
  }

  /** Is the dialog's Add button pressable? Disabled until an amount/percentage is entered. */
  async isAddTipAddEnabled(): Promise<boolean> {
    const button = await this.find(ChargeFeeIds.tipDialogAddBtn, { visible: true });
    return button.isEnabled();
  }

  /** Close the Add Tip Option dialog with Escape, adding nothing. */
  async closeAddTipDialog(): Promise<this> {
    await browser.keys(['Escape']);
    await this.waitGone(ChargeFeeIds.tipDialog, Timeouts.SHORT);
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Delete confirm
   * --------------------------------------------------------------------- */

  async openDeleteConfirm(row: number): Promise<this> {
    await this.click(chargeFeeDeleteTipOption(row));
    await this.find(ChargeFeeIds.deleteDialog, { timeout: Timeouts.MEDIUM, visible: true });
    return this;
  }

  isDeleteConfirmShown(): Promise<boolean> {
    return this.isVisible(ChargeFeeIds.deleteDialog);
  }

  /** Cancel the delete — the safe branch, deleting nothing. */
  async cancelDelete(): Promise<this> {
    await this.click(ChargeFeeIds.deleteCancelBtn);
    await this.waitGone(ChargeFeeIds.deleteDialog, Timeouts.SHORT);
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Inline edit
   * --------------------------------------------------------------------- */

  /** Enter inline-edit on a tip-option row (turns its cells into inputs). */
  async startInlineEdit(row: number): Promise<this> {
    await this.click(chargeFeeEditTipOption(row));
    await settle();
    return this;
  }

  /** Leave inline-edit — clicking Edit again is the ONLY way out (Escape does not work). */
  async stopInlineEdit(row: number): Promise<this> {
    await this.click(chargeFeeEditTipOption(row));
    await settle();
    return this;
  }

  /** Is the row in inline-edit mode? True while it holds text inputs. */
  async isRowEditing(row: number): Promise<boolean> {
    const rows = await this.findAll(ChargeFeeIds.tipRows, { timeout: Timeouts.SHORT });
    const target = rows[row - 1];
    if (!target) {
      throw new Error(`${this.name}: no tip-option row ${String(row)} (only ${String(rows.length)} rows).`);
    }
    const inputs = await target.$$('input').getElements();
    return inputs.length > 0;
  }

  /** Press Escape without asserting anything closed — for the inline-edit quirk (TC-CHF-16). */
  async pressEscape(): Promise<this> {
    await browser.keys(['Escape']);
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Tax Setting
   * --------------------------------------------------------------------- */

  /** The tax percentage field's value, e.g. `10`. */
  readTax(): Promise<string> {
    return this.value(ChargeFeeIds.taxInput);
  }

  /** Replace the tax value. Non-digits and a leading minus are stripped; the field clamps at 100. */
  async setTax(value: string): Promise<this> {
    await this.setValue(ChargeFeeIds.taxInput, value);
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Signature
   * --------------------------------------------------------------------- */

  isSignatureOn(): Promise<boolean> {
    return this.isAriaChecked(ChargeFeeIds.signatureSwitch);
  }

  async toggleSignature(): Promise<this> {
    await this.click(ChargeFeeIds.signatureSwitch);
    await settle();
    return this;
  }

  /** Are BOTH signature-timing radios interactive (not disabled)? */
  async isSignatureTimingEnabled(): Promise<boolean> {
    const before = await this.find(ChargeFeeIds.signatureTimingBefore);
    const after = await this.find(ChargeFeeIds.signatureTimingAfter);
    return (await before.isEnabled()) && (await after.isEnabled());
  }

  /* --------------------------------------------------------------------- *
   * Internals
   * --------------------------------------------------------------------- */

  private async isAriaChecked(loc: Locator): Promise<boolean> {
    const el = await this.find(loc);
    return (await el.getAttribute('aria-checked')) === 'true';
  }

  private async sectionHeaderAt(index: number): Promise<WebdriverIO.Element> {
    const headers = await this.findAll(ChargeFeeIds.sectionHeaders, { timeout: Timeouts.MEDIUM });
    const header = headers[index - 1];
    if (!header) {
      throw new Error(
        `${this.name}: no section header ${String(index)} (found ${String(headers.length)} — ` +
          `expected 3: Tip / Tax / Signature).`,
      );
    }
    return header;
  }
}

export default new ChargeFeePage();
