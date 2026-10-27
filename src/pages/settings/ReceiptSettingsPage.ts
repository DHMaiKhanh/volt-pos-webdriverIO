import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import {
  ReceiptSettingsIds,
  receiptSectionHeader,
  receiptTextarea,
  receiptToggle,
  type ReceiptSection,
  type ReceiptTextareaId,
  type ReceiptToggleId,
} from '../../constants/testids.settings-receipt.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/**
 * `/settings/receipt` — the Receipt Setting form (four accordion sections) and
 * the Receipt Preview, which re-renders LIVE from the form's unsaved state.
 *
 * ## Nothing here persists unless Save is pressed
 *
 * The form is dirty-tracked behind one screen-level Save and the receipt
 * template is merchant-global. This page object deliberately exposes NO save
 * method: the specs flip a toggle, read the preview and the Save gate, then put
 * the toggle back — and discard anything left over by leaving the screen (the
 * doc confirms there is no unsaved-changes guard here).
 *
 * ## The preview is the oracle
 *
 * Because the preview tracks the form without a Save, it is how the specs prove
 * a Display Option does what it says — no printer needed. {@link previewText}
 * reads the preview card's `innerText` once; callers search it.
 *
 * ## The custom-logo upload is out of reach
 *
 * `Choose file` opens the OS (Tauri) file dialog — there is no
 * `input[type="file"]` to drive. Nothing here ever clicks it.
 */
export class ReceiptSettingsPage extends BasePage {
  readonly name = 'Settings — Receipt';

  readonly route: string = Routes.SETTINGS_RECEIPT;

  /**
   * A Display Option toggle, not the heading: the heading is static chrome, the
   * toggle renders from the loaded receipt settings.
   */
  protected readonly readyAnchor: Locator = receiptToggle('customer-info');

  /* --------------------------------------------------------------------- *
   * Layout
   * --------------------------------------------------------------------- */

  isSettingHeadingShown(): Promise<boolean> {
    return this.isVisible(ReceiptSettingsIds.heading);
  }

  isPreviewHeadingShown(): Promise<boolean> {
    return this.isVisible(ReceiptSettingsIds.previewHeading);
  }

  async isSectionExpanded(section: ReceiptSection): Promise<boolean> {
    const header = await this.find(receiptSectionHeader(section), { timeout: Timeouts.MEDIUM });
    return (await header.getAttribute('aria-expanded')) === 'true';
  }

  /** The header's Radix `data-state` — `open` / `closed`. */
  async sectionState(section: ReceiptSection): Promise<string> {
    const header = await this.find(receiptSectionHeader(section), { timeout: Timeouts.MEDIUM });
    return (await header.getAttribute('data-state')) ?? '';
  }

  /** Collapse or expand a section, whichever it currently is. */
  async toggleSection(section: ReceiptSection): Promise<this> {
    await this.click(receiptSectionHeader(section));
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Save gate
   * --------------------------------------------------------------------- */

  /** Is the screen-level Save pressable (i.e. is the form dirty)? */
  async isSaveEnabled(): Promise<boolean> {
    const button = await this.find(ReceiptSettingsIds.saveBtn, { visible: true });
    return button.isEnabled();
  }

  /* --------------------------------------------------------------------- *
   * Toggles (switches and checkboxes — both expose aria-checked)
   * --------------------------------------------------------------------- */

  /** Is the toggle mounted at all? */
  hasToggle(id: ReceiptToggleId): Promise<boolean> {
    return this.exists(receiptToggle(id), Timeouts.ANIMATION);
  }

  isToggleVisible(id: ReceiptToggleId): Promise<boolean> {
    return this.isVisible(receiptToggle(id), Timeouts.ANIMATION);
  }

  async isToggleOn(id: ReceiptToggleId): Promise<boolean> {
    const el = await this.find(receiptToggle(id), { timeout: Timeouts.SHORT });
    return (await el.getAttribute('aria-checked')) === 'true';
  }

  async toggle(id: ReceiptToggleId): Promise<this> {
    await this.click(receiptToggle(id));
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Logo radios
   * --------------------------------------------------------------------- */

  /** State and `value` of one logo radio. */
  async logoRadio(which: 'default' | 'custom'): Promise<{ checked: boolean; value: string }> {
    const el = await this.find(
      which === 'default' ? ReceiptSettingsIds.logoDefault : ReceiptSettingsIds.logoCustom,
    );
    let value = (await el.getAttribute('value')) ?? '';
    if (value === '') {
      // Radix mirrors the value onto a hidden sibling <input type="radio">.
      const sibling = await el.$('./following-sibling::input[1]').getElement();
      if (await sibling.isExisting()) value = (await sibling.getAttribute('value')) ?? '';
    }
    return { checked: (await el.getAttribute('aria-checked')) === 'true', value };
  }

  async selectLogo(which: 'default' | 'custom'): Promise<this> {
    await this.click(which === 'default' ? ReceiptSettingsIds.logoDefault : ReceiptSettingsIds.logoCustom);
    await settle();
    return this;
  }

  /** Is `Choose file` visible AND enabled? Never clicked — it opens an OS dialog. */
  async isChooseFileUsable(): Promise<boolean> {
    if (!(await this.isVisible(ReceiptSettingsIds.chooseFileBtn))) return false;
    return (await this.find(ReceiptSettingsIds.chooseFileBtn)).isEnabled();
  }

  /** How many HTML `input[type="file"]` exist anywhere in the DOM. */
  async fileInputCount(): Promise<number> {
    return (await this.findAll(ReceiptSettingsIds.fileInputs, { timeout: Timeouts.ANIMATION })).length;
  }

  /* --------------------------------------------------------------------- *
   * Receipt Message textareas
   * --------------------------------------------------------------------- */

  readTextarea(id: ReceiptTextareaId): Promise<string> {
    return this.value(receiptTextarea(id));
  }

  async textareaPlaceholder(id: ReceiptTextareaId): Promise<string> {
    return (await (await this.find(receiptTextarea(id))).getAttribute('placeholder')) ?? '';
  }

  async setTextarea(id: ReceiptTextareaId, text: string): Promise<this> {
    await this.setValue(receiptTextarea(id), text);
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Preview
   * --------------------------------------------------------------------- */

  /** The preview card's rendered text (`innerText`, so hidden parts are excluded). */
  async previewText(): Promise<string> {
    const panel = await this.find(ReceiptSettingsIds.previewPanel, { timeout: Timeouts.MEDIUM });
    const raw = await panel.getProperty('innerText');
    return typeof raw === 'string' && raw.trim() !== '' ? raw : await panel.getText();
  }

  /** `src` of the preview logo, or `null` when the preview shows no logo image. */
  async logoSrc(): Promise<string | null> {
    if (!(await this.exists(ReceiptSettingsIds.logoImg, Timeouts.SHORT))) return null;
    return (await this.find(ReceiptSettingsIds.logoImg)).getAttribute('src');
  }
}

export default new ReceiptSettingsPage();
