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
 * `/settings/charge-fee` — the Charge & Fee screen.
 *
 * ## Build 1.1.56 moved half of it
 *
 * The screen now holds three cards — Tax Setting (Product Tax under the header
 * Save; Service Tax read-only, synced from the Portal), Discount Setting (owner /
 * staff promotion split, its own Save, blocked unless the two add up to 100) and
 * Turn Settings. Tip Setting and Signature moved to Tipping Settings
 * (`/settings/payment-transaction`) with their `#charge-fee-tip-*` ids intact, so
 * the tip/signature methods below are still used — from that screen — by
 * `settings-tip-options.spec.ts`.
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
   * The Discount owner field, not the heading: it renders from the loaded
   * discount split, so its presence means the screen's data arrived. (The old
   * anchor, a tip-timing radio, moved to Tipping Settings in 1.1.56.)
   */
  protected readonly readyAnchor: Locator = ChargeFeeIds.discountOwnerInput;

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

  isTipTimingBeforeChecked(): Promise<boolean> {
    return this.isAriaChecked(ChargeFeeIds.tipTimingBefore);
  }

  isTipTypePercentChecked(): Promise<boolean> {
    return this.isAriaChecked(ChargeFeeIds.tipTypePercent);
  }

  /** Which tip unit is selected right now. */
  async currentTipUnit(): Promise<TipUnit> {
    return (await this.isTipTypePercentChecked()) ? 'percent' : 'amount';
  }

  /** Is the Tip Setting card expanded? Addressed by title, not position. */
  async isTipSectionExpanded(): Promise<boolean> {
    const header = await this.find(ChargeFeeIds.tipSectionHeader);
    return (await header.getAttribute('aria-expanded')) === 'true';
  }

  async toggleTipSection(): Promise<this> {
    await this.click(ChargeFeeIds.tipSectionHeader);
    await settle();
    return this;
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

  /** Does a row flag a duplicate tip value? The header Save stays disabled while one does. */
  hasDuplicateTipWarning(): Promise<boolean> {
    return this.isVisible(ChargeFeeIds.tipDuplicateWarning, Timeouts.ANIMATION);
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

  /** The value field's current value, as rendered (e.g. `$0.00`, or `0` in % mode). */
  async readAddTipAmount(): Promise<string> {
    return this.value(await this.addTipValueField());
  }

  /** Type into the dialog's value field — Percentage in % mode, Amount in $ mode. */
  async typeAddTipAmount(text: string): Promise<this> {
    await this.setValue(await this.addTipValueField(), text);
    await settle();
    return this;
  }

  /**
   * The dialog renders BOTH Amount and Percentage fields; which one defines the
   * option follows the screen's tip unit.
   */
  private async addTipValueField(): Promise<Locator> {
    return (await this.currentTipUnit()) === 'percent'
      ? ChargeFeeIds.tipDialogPercent
      : ChargeFeeIds.tipDialogAmount;
  }

  /** Is the dialog's Add button pressable? Disabled until an amount/percentage is entered. */
  async isAddTipAddEnabled(): Promise<boolean> {
    const button = await this.find(ChargeFeeIds.tipDialogAddBtn, { visible: true });
    return button.isEnabled();
  }

  /** Close the Add Tip Option dialog with Escape, adding nothing. */
  async closeAddTipDialog(): Promise<this> {
    await browser.keys(['Escape']);
    // Escape normally closes it (after a fade); the header Close is the fallback.
    const closed = await this.waitGone(ChargeFeeIds.tipDialog, Timeouts.SHORT)
      .then(() => true)
      .catch(() => false);
    if (!closed) {
      await this.click(ChargeFeeIds.tipDialogCloseBtn);
      await this.waitGone(ChargeFeeIds.tipDialog, Timeouts.SHORT);
    }
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

  /** Service Tax — read-only on the POS (configured on the Portal). */
  readServiceTax(): Promise<string> {
    return this.value(ChargeFeeIds.serviceTaxInput);
  }

  async isServiceTaxEditable(): Promise<boolean> {
    return (await this.find(ChargeFeeIds.serviceTaxInput)).isEnabled();
  }

  /* --------------------------------------------------------------------- *
   * 1.1.56 cards — Tax / Discount / Turn
   * --------------------------------------------------------------------- */

  /** The card titles in render order, e.g. `['Tax Setting', 'Discount Setting', 'Turn Settings']`. */
  async cardTitles(): Promise<string[]> {
    const titles = await this.findAll(ChargeFeeIds.cardTitles, { timeout: Timeouts.MEDIUM });
    const texts: string[] = [];
    for (const el of titles) {
      if (await el.isDisplayed()) texts.push((await el.getText()).trim());
    }
    return [...new Set(texts)];
  }

  /** The owner / staff promotion split, as the fields show it (e.g. `{ owner: '60', staff: '40' }`). */
  async readDiscountSplit(): Promise<{ owner: string; staff: string }> {
    return {
      owner: await this.value(ChargeFeeIds.discountOwnerInput),
      staff: await this.value(ChargeFeeIds.discountStaffInput),
    };
  }

  /** Replace the owner percentage. Leaves the card dirty — Save is never pressed here. */
  async setDiscountOwner(value: string): Promise<this> {
    await this.setValue(ChargeFeeIds.discountOwnerInput, value);
    await settle();
    return this;
  }

  /** Replace the staff percentage. */
  async setDiscountStaff(value: string): Promise<this> {
    await this.setValue(ChargeFeeIds.discountStaffInput, value);
    await settle();
    return this;
  }

  /** Is the Discount card's own Save pressable? Needs a change AND a 100% total. */
  async isDiscountSaveEnabled(): Promise<boolean> {
    return (await this.find(ChargeFeeIds.discountSaveBtn, { visible: true })).isEnabled();
  }

  /** Turn Settings switches: `service` = turns per service, `decimal` = keep decimals. */
  isTurnSwitchOn(which: 'service' | 'decimal'): Promise<boolean> {
    return this.isAriaChecked(
      which === 'service' ? ChargeFeeIds.turnServiceBasedSwitch : ChargeFeeIds.turnDecimalSwitch,
    );
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
