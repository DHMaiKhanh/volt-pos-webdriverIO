/**
 * Charge & Fee (`/settings/charge-fee`) — Tax, Discount and Turn settings.
 *
 * Covers the TC-CHF cases of docs/screens/charge-fee/charge-fee-test-cases.md
 * that still live on this screen: TC-CHF-01, 02, 18..20 and 26.
 *
 * ## Build 1.1.56 split the screen
 *
 * Tip Setting and Signature moved to Tipping Settings
 * (`/settings/payment-transaction`). Their cases — TC-CHF-03..17 and 21..25 —
 * run there, in `settings-tip-options.spec.ts`, against the same
 * `#charge-fee-tip-*` controls. What is left here is three cards: Tax Setting
 * (Product Tax, under the header Save; Service Tax read-only, synced from the
 * Portal), Discount Setting (owner / staff promotion split, its own Save) and
 * Turn Settings. The 1.1.56-only cards get "(1.1.56 probe)" cases below; Turn
 * Settings are exercised in depth by `home/turn-board-2.spec.ts`.
 *
 * ## Why this file is safe to run yet mutates controls
 *
 * Nothing here presses a Save. Each mutating case makes a card dirty, reads the
 * Save gate back and reverts the value, so the tax / discount config — global to
 * every order — never changes. The `after` hook restores both as a backstop, so
 * leaving the screen raises no unsaved-changes guard.
 */

import { expect } from '@wdio/globals';
import { goToSettings } from '../../../src/flows/index.js';
import { chargeFeePage, settingsPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

describe('Settings — Charge & Fee', () => {
  let initialTax = '';
  let initialSplit = { owner: '', staff: '' };

  before(async () => {
    await goToSettings();
    await settingsPage.openSection('CHARGE_FEE');
    await chargeFeePage.waitForReady();

    initialTax = await chargeFeePage.readTax();
    initialSplit = await chargeFeePage.readDiscountSplit();
  });

  after(async () => {
    // Belt-and-braces: undo any dirty state a failed case left behind. Skips
    // itself if a prior failure already recovered off the screen.
    if (!(await chargeFeePage.isActive())) return;
    if (initialTax !== '' && (await chargeFeePage.readTax()) !== initialTax) {
      await chargeFeePage.setTax(initialTax);
    }
    const split = await chargeFeePage.readDiscountSplit();
    if (split.owner !== initialSplit.owner) await chargeFeePage.setDiscountOwner(initialSplit.owner);
    if (split.staff !== initialSplit.staff) await chargeFeePage.setDiscountStaff(initialSplit.staff);
  });

  /* ------------------------------------------------------------------ *
   * Layout & defaults
   * ------------------------------------------------------------------ */

  it(title('Screen renders the Tax / Discount / Turn cards (TC-CHF-01)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.isHeadingShown()).toBe(true);
    expect(await chargeFeePage.cardTitles()).toEqual(['Tax Setting', 'Discount Setting', 'Turn Settings']);
  });

  it(title('Save is disabled with no changes (TC-CHF-02)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.isSaveEnabled()).toBe(false);
    expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   * Tax — mutate then revert
   * ------------------------------------------------------------------ */

  it(title('Tax shows the current percentage (TC-CHF-18)', Tag.REGRESSION), async () => {
    expect(initialTax).toMatch(/^\d+(\.\d+)?$/);
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

  it(title('Service Tax is shown read-only (1.1.56 probe)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.readServiceTax()).toMatch(/^\d+(\.\d+)?$/);
    expect(await chargeFeePage.isServiceTaxEditable()).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   * Discount Setting — mutate then revert
   * ------------------------------------------------------------------ */

  it(title('The owner / staff split adds up to 100 (1.1.56 probe)', Tag.REGRESSION), () => {
    expect(Number(initialSplit.owner) + Number(initialSplit.staff)).toBe(100);
  });

  it(
    title('A split that does not total 100 blocks the Discount Save (1.1.56 probe)', Tag.REGRESSION),
    async () => {
      const owner = Number(initialSplit.owner);
      const broken = String(owner === 100 ? 99 : owner + 1);

      await chargeFeePage.setDiscountOwner(broken);
      expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(false);

      await chargeFeePage.setDiscountOwner(initialSplit.owner);
      expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(false);
    },
  );

  it(
    title('A changed split that totals 100 enables the Discount Save (1.1.56 probe)', Tag.REGRESSION),
    async () => {
      const owner = Number(initialSplit.owner);
      const nextOwner = owner === 100 ? 90 : owner + 10 > 100 ? owner - 10 : owner + 10;

      await chargeFeePage.setDiscountOwner(String(nextOwner));
      await chargeFeePage.setDiscountStaff(String(100 - nextOwner));
      expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(true);

      await chargeFeePage.setDiscountOwner(initialSplit.owner);
      await chargeFeePage.setDiscountStaff(initialSplit.staff);
      expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(false);
    },
  );

  it(title('Turn Settings render both switches (1.1.56 probe)', Tag.REGRESSION), async () => {
    expect(typeof (await chargeFeePage.isTurnSwitchOn('service'))).toBe('boolean');
    expect(typeof (await chargeFeePage.isTurnSwitchOn('decimal'))).toBe('boolean');
  });

  /* ------------------------------------------------------------------ *
   * Final state
   * ------------------------------------------------------------------ */

  it(title('Everything is back to its original state (TC-CHF-26)', Tag.REGRESSION), async () => {
    expect(await chargeFeePage.readTax()).toBe(initialTax);
    expect(await chargeFeePage.readDiscountSplit()).toEqual(initialSplit);
    expect(await chargeFeePage.isSaveEnabled()).toBe(false);
    expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(false);
  });
});
