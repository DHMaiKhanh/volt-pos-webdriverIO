/**
 * Charge & Fee (`/settings/charge-fee`) — Tip Setting, Tax Setting, Signature.
 *
 * Covers TC-CHF-01..26 from docs/screens/charge-fee/charge-fee-test-cases.md.
 *
 * ## Why this file is safe to run yet mutates controls
 *
 * The whole screen is dirty-tracked behind ONE screen-level Save. Nothing here
 * ever presses Save (nor confirms a Delete or an Add), so no change reaches the
 * merchant — the tip/tax/signature config is global to every order, and these
 * tests only make the screen dirty and read it back. Each mutating case reverts
 * itself (the doc's own design), and the `after` hook restores defaults as a
 * belt-and-braces so leaving the screen raises no unsaved-changes guard.
 *
 * Tagged `@regression` only: with no Save there is no upstream write and no
 * global state left changed for a neighbouring spec to trip over.
 */

import { expect } from '@wdio/globals';
import { goToSettings } from '../../../src/flows/index.js';
import { chargeFeePage, settingsPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

describe('Settings — Charge & Fee', () => {
  let initialTax = '';
  let initialTipAmounts: string[] = [];

  before(async () => {
    await goToSettings();
    await settingsPage.openSection('CHARGE_FEE');
    await chargeFeePage.waitForReady();

    initialTax = await chargeFeePage.readTax();
    initialTipAmounts = await chargeFeePage.tipAmountCells();
  });

  after(async () => {
    // Belt-and-braces: undo any dirty state a failed case left behind, so the
    // screen is clean when the next file navigates away. Skips itself if a prior
    // failure already recovered off the screen.
    if (!(await chargeFeePage.isActive())) return;
    if (!(await chargeFeePage.isTipTypeAmountChecked())) await chargeFeePage.selectTipUnit('amount');
    if (initialTax !== '' && (await chargeFeePage.readTax()) !== initialTax) {
      await chargeFeePage.setTax(initialTax);
    }
    if (await chargeFeePage.isSignatureOn()) await chargeFeePage.toggleSignature();
  });

  /* ------------------------------------------------------------------ *
   * Layout & defaults
   * ------------------------------------------------------------------ */

  it(title('Screen renders three expanded sections (TC-CHF-01)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.isHeadingShown()).toBe(true);
    expect(await chargeFeePage.sectionCount()).toBe(3);
    expect(await chargeFeePage.isSectionExpanded(1)).toBe(true);
    expect(await chargeFeePage.isSectionExpanded(2)).toBe(true);
    expect(await chargeFeePage.isSectionExpanded(3)).toBe(true);
  });

  it(title('Save is disabled with no changes (TC-CHF-02)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.isSaveEnabled()).toBe(false);
  });

  it(title('Tip Method offers exactly four options (TC-CHF-03)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.tipMethodCount()).toBe(4);
  });

  it(title('Tip Timing defaults to After Payment (TC-CHF-04)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.isTipTimingAfterChecked()).toBe(true);
  });

  it(title('Tip Amount defaults to the $ unit (TC-CHF-05)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.isTipTypeAmountChecked()).toBe(true);
  });

  it(title('The tip-option table has its columns (TC-CHF-06)', Tag.REGRESSION), async () => {
    const header = await chargeFeePage.readTableHeader();
    expect(header).toContain('Tip Amount');
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

  it(title('Switching to % swaps the header and the data set (TC-CHF-08)', Tag.REGRESSION), async () => {
    await chargeFeePage.selectTipUnit('percent');

    // A different data set, not a conversion of the $ values.
    expect(await chargeFeePage.tipAmountCells()).not.toEqual(initialTipAmounts);
    expect(await chargeFeePage.readTableHeader()).toContain('%');
    expect(await chargeFeePage.isSaveEnabled()).toBe(true);
  });

  it(
    title('Switching back to $ restores the data and clears dirty (TC-CHF-09)', Tag.REGRESSION),
    async () => {
      await chargeFeePage.selectTipUnit('amount');

      expect(await chargeFeePage.tipAmountCells()).toEqual(initialTipAmounts);
      expect(await chargeFeePage.readTableHeader()).toContain('$');
      // Dirty is tracked by VALUE — back to the original set means Save disabled again.
      expect(await chargeFeePage.isSaveEnabled()).toBe(false);
    },
  );

  /* ------------------------------------------------------------------ *
   * Add Tip Option dialog
   * ------------------------------------------------------------------ */

  it(title('Add Tip Option opens a dialog with Add disabled (TC-CHF-10)', Tag.REGRESSION), async () => {
    await chargeFeePage.openAddTipDialog();

    expect(await chargeFeePage.isAddTipDialogShown()).toBe(true);
    expect(await chargeFeePage.readAddTipAmount()).toContain('0.00');
    expect(await chargeFeePage.isAddTipAddEnabled()).toBe(false);

    await chargeFeePage.closeAddTipDialog();
  });

  it(title('Entering an amount enables Add (TC-CHF-11)', Tag.REGRESSION), async () => {
    await chargeFeePage.openAddTipDialog();
    const before = await chargeFeePage.readAddTipAmount();

    await chargeFeePage.typeAddTipAmount('7');

    expect(await chargeFeePage.readAddTipAmount()).not.toBe(before);
    expect(await chargeFeePage.isAddTipAddEnabled()).toBe(true);

    await chargeFeePage.closeAddTipDialog();
  });

  it(title('Escape closes the dialog and adds no row (TC-CHF-12)', Tag.REGRESSION), async () => {
    const rowsBefore = await chargeFeePage.tipRowCount();

    await chargeFeePage.openAddTipDialog();
    await chargeFeePage.typeAddTipAmount('7');
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
   * Tax — mutate then revert
   * ------------------------------------------------------------------ */

  it(title('Tax shows the current percentage (TC-CHF-18)', Tag.REGRESSION), async () => {
    expect(initialTax).toMatch(/^\d+$/);
    expect(await chargeFeePage.readTax()).toBe(initialTax);
  });

  it(title('Tax strips non-digits and clamps at 100 (TC-CHF-19)', Tag.REGRESSION), async () => {
    await chargeFeePage.setTax('abc-999');

    expect(await chargeFeePage.readTax()).toBe('100');
    expect(await chargeFeePage.isSaveEnabled()).toBe(true);
  });

  it(title('Restoring the tax clears dirty (TC-CHF-20)', Tag.REGRESSION), async () => {
    await chargeFeePage.setTax(initialTax);

    expect(await chargeFeePage.readTax()).toBe(initialTax);
    expect(await chargeFeePage.isSaveEnabled()).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   * Signature — mutate then revert
   * ------------------------------------------------------------------ */

  it(title('Signature switch defaults to OFF (TC-CHF-21)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.isSignatureOn()).toBe(false);
  });

  it(title('Signature Timing stays enabled while signing is OFF (TC-CHF-22)', Tag.REGRESSION), async () => {
    // Documented quirk: the timing radios are NOT disabled even though the
    // signature switch is off — worth confirming, not asserting it "should" be off.
    expect(await chargeFeePage.isSignatureOn()).toBe(false);
    expect(await chargeFeePage.isSignatureTimingEnabled()).toBe(true);
  });

  it(title('Turning Signature on makes the screen dirty (TC-CHF-23)', Tag.REGRESSION), async () => {
    await chargeFeePage.toggleSignature();
    expect(await chargeFeePage.isSignatureOn()).toBe(true);
    expect(await chargeFeePage.isSaveEnabled()).toBe(true);

    // Cleanup: back to OFF.
    await chargeFeePage.toggleSignature();
    expect(await chargeFeePage.isSignatureOn()).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   * Collapse / expand
   * ------------------------------------------------------------------ */

  it(title('Collapsing a section hides its body (TC-CHF-24)', Tag.REGRESSION), async () => {
    if (!(await chargeFeePage.isSectionExpanded(1))) await chargeFeePage.toggleSection(1);

    await chargeFeePage.toggleSection(1);
    expect(await chargeFeePage.isSectionExpanded(1)).toBe(false);
    // The body hides but stays in the DOM — assert on visibility, not count.
    expect(await chargeFeePage.isTipTableVisible()).toBe(false);

    // Restore expanded for the next case.
    await chargeFeePage.toggleSection(1);
  });

  it(title('Re-opening a section shows its body again (TC-CHF-25)', Tag.REGRESSION), async () => {
    await chargeFeePage.toggleSection(1); // collapse
    await chargeFeePage.toggleSection(1); // expand

    expect(await chargeFeePage.isSectionExpanded(1)).toBe(true);
    expect(await chargeFeePage.isTipTableVisible()).toBe(true);
    expect(await chargeFeePage.tipRowCount()).toBeGreaterThan(0);
  });

  /* ------------------------------------------------------------------ *
   * Final state
   * ------------------------------------------------------------------ */

  it(title('Everything is back to its original state (TC-CHF-26)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.isTipTypeAmountChecked()).toBe(true);
    expect(await chargeFeePage.readTax()).toBe(initialTax);
    expect(await chargeFeePage.isSignatureOn()).toBe(false);
    expect(await chargeFeePage.tipAmountCells()).toEqual(initialTipAmounts);
    expect(await chargeFeePage.isSaveEnabled()).toBe(false);
  });
});
