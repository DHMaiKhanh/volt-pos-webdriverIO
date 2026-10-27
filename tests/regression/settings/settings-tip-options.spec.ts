/**
 * Tip options & Signature — the TC-CHF cases that moved to Tipping Settings.
 *
 * Covers TC-CHF-03..17 and 21..25 from
 * docs/screens/charge-fee/charge-fee-test-cases.md. Build 1.1.56 moved Tip
 * Setting and Signature off `/settings/charge-fee` onto Tipping Settings
 * (`/settings/payment-transaction`); the controls kept their `#charge-fee-tip-*`
 * ids, so these cases drive them through `chargeFeePage`'s tip methods from the
 * new screen. TC-CHF-01/02/18..20/26 stay in `charge-fee.spec.ts`.
 *
 * ## Defaults are read, not assumed
 *
 * The doc recorded After Payment / $ / signature OFF. Merchant 14 runs Before
 * Payment / % / signature ON, so each "default" case asserts a consistent state
 * and the unit / signature cases flip from whatever is saved and back.
 *
 * ## Why this file is safe to run yet mutates controls
 *
 * Tip and Signature sit behind the header Save, which nothing here presses. Each
 * mutating case reverts itself; the `after` hook restores unit and signature as a
 * backstop, so leaving raises no unsaved-changes guard.
 */

import { expect } from '@wdio/globals';
import { goToSettings } from '../../../src/flows/index.js';
import { chargeFeePage, settingsPage } from '../../../src/pages/index.js';
import type { TipUnit } from '../../../src/pages/settings/ChargeFeePage.js';
import { Tag, title } from '../../../src/types/testTags.js';

const otherUnit = (unit: TipUnit): TipUnit => (unit === 'percent' ? 'amount' : 'percent');

describe('Settings — Tipping: tip options & signature', () => {
  let initialUnit: TipUnit = 'amount';
  let initialSignature = false;
  let initialTipAmounts: string[] = [];

  before(async () => {
    await goToSettings();
    await settingsPage.openSection('PAYMENT_TRANSACTION');
    await chargeFeePage.tipRowCount(); // waits for the tip table to load

    initialUnit = await chargeFeePage.currentTipUnit();
    initialSignature = await chargeFeePage.isSignatureOn();
    initialTipAmounts = await chargeFeePage.tipAmountCells();
  });

  // The harness returns to the till after a failed case; come back so one
  // failure does not cascade into every case after it.
  beforeEach(async () => {
    if ((await settingsPage.currentSection()) !== '/settings/payment-transaction') {
      await goToSettings();
      await settingsPage.openSection('PAYMENT_TRANSACTION');
      await chargeFeePage.tipRowCount();
    }
  });

  after(async () => {
    if (!(await settingsPage.isActive())) return;
    if ((await chargeFeePage.currentTipUnit()) !== initialUnit)
      await chargeFeePage.selectTipUnit(initialUnit);
    if ((await chargeFeePage.isSignatureOn()) !== initialSignature) await chargeFeePage.toggleSignature();
    if (!(await chargeFeePage.isTipSectionExpanded())) await chargeFeePage.toggleTipSection();
  });

  /* ------------------------------------------------------------------ *
   * Layout & defaults
   * ------------------------------------------------------------------ */

  it(title('Tip Method offers exactly four options (TC-CHF-03)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.tipMethodCount()).toBe(4);
  });

  it(title('Exactly one Tip Timing is selected (TC-CHF-04)', Tag.REGRESSION), async () => {
    const before = await chargeFeePage.isTipTimingBeforeChecked();
    const after = await chargeFeePage.isTipTimingAfterChecked();
    expect(before !== after).toBe(true);
  });

  it(title('Exactly one Tip Amount unit is selected (TC-CHF-05)', Tag.REGRESSION), async () => {
    const percent = await chargeFeePage.isTipTypePercentChecked();
    const amount = await chargeFeePage.isTipTypeAmountChecked();
    expect(percent !== amount).toBe(true);
  });

  it(title('The tip-option table has its columns (TC-CHF-06)', Tag.REGRESSION), async () => {
    const header = await chargeFeePage.readTableHeader();
    expect(header).toContain('Tip Suggestion');
    expect(header).toContain('Status');
    expect(header).toContain('Action');
  });

  it(title('Each option row carries a switch, Edit and Delete (TC-CHF-07)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.tipRowCount()).toBeGreaterThan(0);
    expect(await chargeFeePage.hasRowControls(1)).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   * Tip unit ($ ↔ %) — mutate then revert
   * ------------------------------------------------------------------ */

  it(title('Switching the unit swaps the data set (TC-CHF-08)', Tag.REGRESSION), async () => {
    await chargeFeePage.selectTipUnit(otherUnit(initialUnit));

    // A different data set, not a conversion of the saved values.
    expect(await chargeFeePage.tipAmountCells()).not.toEqual(initialTipAmounts);
    // The screen is dirty either way; Save only lights up if the other unit's
    // option set is valid — merchant 14's $ set repeats $0.02, which the app flags
    // inline and holds Save disabled for (findDuplicateTipOptionIds).
    const saveEnabled = await chargeFeePage.isSaveEnabled();
    expect(saveEnabled || (await chargeFeePage.hasDuplicateTipWarning())).toBe(true);
  });

  it(title('Switching back restores the data and clears dirty (TC-CHF-09)', Tag.REGRESSION), async () => {
    await chargeFeePage.selectTipUnit(initialUnit);

    expect(await chargeFeePage.tipAmountCells()).toEqual(initialTipAmounts);
    // Dirty is tracked by VALUE — back to the original set means Save disabled again.
    expect(await chargeFeePage.isSaveEnabled()).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   * Add Tip Option dialog
   * ------------------------------------------------------------------ */

  it(title('Add Tip Option opens a dialog with Add disabled (TC-CHF-10)', Tag.REGRESSION), async () => {
    await chargeFeePage.openAddTipDialog();

    expect(await chargeFeePage.isAddTipDialogShown()).toBe(true);
    expect(await chargeFeePage.readAddTipAmount()).toMatch(/^\$?0(\.00)?%?$|^$/);
    expect(await chargeFeePage.isAddTipAddEnabled()).toBe(false);

    await chargeFeePage.closeAddTipDialog();
  });

  it(title('Entering a value enables Add (TC-CHF-11)', Tag.REGRESSION), async () => {
    await chargeFeePage.openAddTipDialog();
    const before = await chargeFeePage.readAddTipAmount();

    await chargeFeePage.typeAddTipAmount('37');

    expect(await chargeFeePage.readAddTipAmount()).not.toBe(before);
    expect(await chargeFeePage.isAddTipAddEnabled()).toBe(true);

    await chargeFeePage.closeAddTipDialog();
  });

  it(title('Escape closes the dialog and adds no row (TC-CHF-12)', Tag.REGRESSION), async () => {
    const rowsBefore = await chargeFeePage.tipRowCount();

    await chargeFeePage.openAddTipDialog();
    await chargeFeePage.typeAddTipAmount('37');
    await chargeFeePage.closeAddTipDialog();

    expect(await chargeFeePage.isAddTipDialogShown()).toBe(false);
    expect(await chargeFeePage.tipRowCount()).toBe(rowsBefore);
  });

  /* ------------------------------------------------------------------ *
   * Delete confirmation
   * ------------------------------------------------------------------ */

  it(title('Delete asks for confirmation (TC-CHF-13)', Tag.REGRESSION), async () => {
    const rows = await chargeFeePage.tipRowCount();

    await chargeFeePage.openDeleteConfirm(rows);
    expect(await chargeFeePage.isDeleteConfirmShown()).toBe(true);

    await chargeFeePage.cancelDelete();
  });

  it(title('Cancel keeps every row (TC-CHF-14)', Tag.REGRESSION), async () => {
    const rowsBefore = await chargeFeePage.tipRowCount();

    await chargeFeePage.openDeleteConfirm(rowsBefore);
    await chargeFeePage.cancelDelete();

    expect(await chargeFeePage.isDeleteConfirmShown()).toBe(false);
    expect(await chargeFeePage.tipRowCount()).toBe(rowsBefore);
  });

  /* ------------------------------------------------------------------ *
   * Inline edit
   * ------------------------------------------------------------------ */

  it(title('Edit turns the row into inline inputs (TC-CHF-15)', Tag.REGRESSION), async () => {
    await chargeFeePage.startInlineEdit(1);
    expect(await chargeFeePage.isRowEditing(1)).toBe(true);
    await chargeFeePage.stopInlineEdit(1);
  });

  it(title('Escape does NOT leave inline-edit mode (TC-CHF-16)', Tag.REGRESSION), async () => {
    await chargeFeePage.startInlineEdit(1);

    await chargeFeePage.pressEscape();
    // The app quirk: unlike every dialog, inline edit ignores Escape.
    expect(await chargeFeePage.isRowEditing(1)).toBe(true);

    await chargeFeePage.stopInlineEdit(1);
  });

  it(title('Clicking Edit again exits inline-edit (TC-CHF-17)', Tag.REGRESSION), async () => {
    await chargeFeePage.startInlineEdit(1);
    await chargeFeePage.stopInlineEdit(1);

    expect(await chargeFeePage.isRowEditing(1)).toBe(false);
    // Nothing was changed, so the screen is not dirty.
    expect(await chargeFeePage.isSaveEnabled()).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   * Signature — mutate then revert
   * ------------------------------------------------------------------ */

  it(title('Signature switch reflects the saved setting (TC-CHF-21)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.isSignatureOn()).toBe(initialSignature);
    expect(await chargeFeePage.isSaveEnabled()).toBe(false);
  });

  it(title('Signature Timing stays enabled while signing is OFF (TC-CHF-22)', Tag.REGRESSION), async () => {
    // Documented quirk: the timing radios are NOT disabled even though the
    // signature switch is off — worth confirming, not asserting it "should" be off.
    if (initialSignature) await chargeFeePage.toggleSignature();
    expect(await chargeFeePage.isSignatureOn()).toBe(false);
    expect(await chargeFeePage.isSignatureTimingEnabled()).toBe(true);

    if (initialSignature) await chargeFeePage.toggleSignature();
  });

  it(title('Flipping Signature makes the screen dirty (TC-CHF-23)', Tag.REGRESSION), async () => {
    await chargeFeePage.toggleSignature();
    expect(await chargeFeePage.isSignatureOn()).toBe(!initialSignature);
    expect(await chargeFeePage.isSaveEnabled()).toBe(true);

    // Cleanup: back to the saved value, and dirty clears.
    await chargeFeePage.toggleSignature();
    expect(await chargeFeePage.isSignatureOn()).toBe(initialSignature);
    expect(await chargeFeePage.isSaveEnabled()).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   * Collapse / expand
   * ------------------------------------------------------------------ */

  it(title('Collapsing the Tip card hides its body (TC-CHF-24)', Tag.REGRESSION), async () => {
    if (!(await chargeFeePage.isTipSectionExpanded())) await chargeFeePage.toggleTipSection();

    await chargeFeePage.toggleTipSection();
    expect(await chargeFeePage.isTipSectionExpanded()).toBe(false);
    // The body hides but stays in the DOM — assert on visibility, not count.
    expect(await chargeFeePage.isTipTableVisible()).toBe(false);

    // Restore expanded for the next case.
    await chargeFeePage.toggleTipSection();
  });

  it(title('Re-opening the Tip card shows its body again (TC-CHF-25)', Tag.REGRESSION), async () => {
    await chargeFeePage.toggleTipSection(); // collapse
    await chargeFeePage.toggleTipSection(); // expand

    expect(await chargeFeePage.isTipSectionExpanded()).toBe(true);
    expect(await chargeFeePage.isTipTableVisible()).toBe(true);
    expect(await chargeFeePage.tipRowCount()).toBeGreaterThan(0);
  });
});
