/**
 * `/settings/payment-transaction` — labelled "Tipping Settings" in the settings
 * sidebar (the path and the label disagree).
 *
 * Source: docs/screens/settings-payment-transaction (scan 2026-08-21) re-checked
 * against the live DOM dump of installed build 1.1.56, merchant 14
 * (reports/scans/2026-10-25-feature-inventory/dom/settings_payment-transaction.json).
 *
 * ## What the screen holds on 1.1.56
 *
 * The doc describes a single "Split Tip Setting" card. Build 1.1.56 renders four
 * collapsible cards — Tip Setting, Signature, Split Tip Setting, Supply Share —
 * and THREE Save buttons, in DOM order:
 *
 * 1. the page-header Save (Tip Setting + Signature — the controls that used to
 *    live on `/settings/charge-fee`, which still carry `charge-fee-*` DOM ids);
 * 2. the Save that follows the Split Tip radios;
 * 3. the Save that follows the Supply Share radios.
 *
 * Every Save is anchored on the DOM id of a control in ITS card
 * (`following::` / `preceding::`) instead of position, so a reorder of the cards
 * cannot silently swap which Save a spec presses.
 *
 * ## Why DOM ids first
 *
 * The build strips almost every `data-testid`, but the radios render literal
 * enum-derived ids (`split-tip-evenly`, `supply-deduct-after_commission`,
 * `tipping-signature-timing-before`). Those are untranslated, structural handles
 * and are used directly as the first fallback. The testids are the ones the app
 * team should add (`<screen>-<thing>-<role>`), not ids that exist today.
 */

import { Actions, both } from './labels.js';
import { byRole, locator, textIsAnyOf, type Locator } from '../helpers/selectors.js';

/** XPath predicate: a button labelled Save in either bundle. */
const SAVE_BUTTON = `button[${both(Actions.save)
  .map((t) => `normalize-space()="${t}"`)
  .join(' or ')}]`;

/** The Split Tip method values the app accepts as a merchant default. */
export type SplitTipMethod = 'evenly' | 'proportion';

/** The Supply Share deduction modes. */
export type SupplyShareMode = 'before_commission' | 'after_commission';

export const TippingSettingsIds = {
  heading: locator(
    'tipping settings heading',
    'tipping-settings-heading',
    // VI copy from the 2026-08-20 i18n scan ("Cài đặt tip" family).
    `//h3[${['Tipping Settings', 'Cài đặt tip', 'Cài đặt chia tip']
      .map((t) => `normalize-space()="${t}"`)
      .join(' or ')}]`,
    textIsAnyOf('Tipping Settings', 'Cài đặt tip', 'Cài đặt chia tip'),
  ),
  description: locator(
    'tipping settings description',
    'tipping-settings-description',
    textIsAnyOf('Manage how tips are handled during checkout.', 'Quản lý cách xử lý tip khi thanh toán.'),
  ),

  /* ------------------------------ Split Tip ------------------------------ */

  splitTipTitle: locator(
    'split tip setting title',
    'tipping-split-tip-title',
    // The collapsible card header is a <button>; its text is the card title.
    `//button[normalize-space()="Split Tip Setting" or normalize-space()="Cài đặt chia tip"]`,
    textIsAnyOf('Split Tip Setting', 'Cài đặt chia tip'),
  ),
  splitTipRadioGroup: locator(
    'split tip radio group',
    'tipping-split-tip-radiogroup',
    '//*[@role="radiogroup"][.//*[@id="split-tip-evenly"]]',
  ),
  /** Every radio inside the split-tip group — TC-TIP-03 counts them. */
  splitTipRadios: locator(
    'split tip radios',
    'tipping-split-tip-radio-',
    '//*[@role="radiogroup"][.//*[@id="split-tip-evenly"]]//*[@role="radio"]',
  ),
  splitTipSaveBtn: locator(
    'split tip save',
    'tipping-split-tip-save',
    `(//*[@id="split-tip-proportion"]/following::${SAVE_BUTTON})[1]`,
  ),

  /* ---------------------- Tip Setting (moved from charge-fee) ---------------------- */

  /** The page-header Save: the last Save BEFORE the first Tip Setting control. */
  headerSaveBtn: locator(
    'tipping header save',
    'tipping-settings-save',
    `(//*[@id="charge-fee-tip-method-card"]/preceding::${SAVE_BUTTON})[last()]`,
  ),
  tipMethodCheckboxes: locator(
    'tip method checkboxes',
    'tipping-tip-method-',
    '//*[@role="checkbox"][starts-with(@id,"charge-fee-tip-method-")]',
    byRole('checkbox'),
  ),
  tipTimingBefore: locator('tip timing before', 'tipping-tip-timing-before', '#charge-fee-tip-timing-before'),
  tipTimingAfter: locator('tip timing after', 'tipping-tip-timing-after', '#charge-fee-tip-timing-after'),
  tipTypePercent: locator('tip type percent', 'tipping-tip-type-percent', '#charge-fee-tip-type-percent'),
  tipTypeAmount: locator('tip type amount', 'tipping-tip-type-amount', '#charge-fee-tip-type-amount'),
  tipTable: locator('tip option table', 'tipping-tip-table', 'table'),
  tipRows: locator('tip option rows', 'tipping-tip-row-', 'tbody tr'),

  /* ------------------------------ Signature ------------------------------ */

  /**
   * Require Digital Signature. Its DOM id is a React `useId` (`_r_en_-form-item`)
   * and changes per mount, so it is reached through its `<label for>` and, failing
   * that, as the only switch on the screen outside the tip-option table.
   */
  signatureSwitch: locator(
    'require signature switch',
    'tipping-signature-switch',
    '//*[@role="switch"][@id=//label[normalize-space()="Require Digital Signature"]/@for]',
    '[aria-label="Require Digital Signature"]',
    '//*[@role="switch"][not(ancestor::tbody)]',
  ),
  signatureTimingBefore: locator(
    'signature timing before',
    'tipping-signature-timing-before',
    '#tipping-signature-timing-before',
  ),
  signatureTimingAfter: locator(
    'signature timing after',
    'tipping-signature-timing-after',
    '#tipping-signature-timing-after',
  ),

  /* ----------------------------- Supply Share ----------------------------- */

  supplyShareSaveBtn: locator(
    'supply share save',
    'tipping-supply-share-save',
    `(//*[@id="supply-deduct-after_commission"]/following::${SAVE_BUTTON})[1]`,
  ),

  /* ---------------------- Unsaved-changes leave guard ---------------------- */

  /**
   * "Discard changes and leave?" — TanStack Router `blocker` + `ConfirmDialog`.
   * It is the only alertdialog this screen raises.
   */
  leaveGuardDialog: locator(
    'discard changes dialog',
    'tipping-leave-guard-dialog',
    byRole('alertdialog'),
    '[data-slot="alert-dialog-content"]',
  ),
  leaveGuardTitle: locator(
    'discard changes title',
    'tipping-leave-guard-title',
    '//*[@role="alertdialog"]//*[@data-slot="alert-dialog-title"]',
    '//*[@role="alertdialog"]//h2',
  ),
  leaveGuardMessage: locator(
    'discard changes message',
    'tipping-leave-guard-message',
    '//*[@role="alertdialog"]//*[@data-slot="alert-dialog-description"]',
    '//*[@role="alertdialog"]//p',
  ),
  /** "Continue Editing" — the dismissive (first) footer button. */
  leaveGuardContinueBtn: locator(
    'continue editing',
    'tipping-leave-guard-continue',
    '//*[@role="alertdialog"]//button[normalize-space()="Continue Editing"]',
    '[role="alertdialog"] [data-slot="alert-dialog-footer"] button:first-of-type',
  ),
  /** "Discard & Leave" — the primary (last) footer button. */
  leaveGuardDiscardBtn: locator(
    'discard and leave',
    'tipping-leave-guard-discard',
    '//*[@role="alertdialog"]//button[normalize-space()="Discard & Leave"]',
    '[role="alertdialog"] [data-slot="alert-dialog-footer"] button:last-of-type',
  ),
} satisfies Record<string, Locator>;

/** One split-tip radio by its enum value — `#split-tip-evenly` / `#split-tip-proportion`. */
export const splitTipRadio = (method: SplitTipMethod): Locator =>
  locator(
    `split tip radio ${method}`,
    `tipping-split-tip-${method}`,
    `#split-tip-${method}`,
    `[role="radio"][value="${method}"]`,
  );

/** One supply-share radio by its enum value — `#supply-deduct-before_commission` etc. */
export const supplyShareRadio = (mode: SupplyShareMode): Locator =>
  locator(`supply share radio ${mode}`, `tipping-supply-share-${mode}`, `#supply-deduct-${mode}`);
