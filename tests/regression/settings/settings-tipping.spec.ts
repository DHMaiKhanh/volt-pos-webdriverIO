/**
 * Tipping Settings (`/settings/payment-transaction`) — Split Tip Setting and the
 * unsaved-changes leave guard.
 *
 * Covers TC-TIP-01..14 from
 * docs/screens/settings-payment-transaction/settings-payment-transaction-test-cases.md.
 *
 * ## Drift from the doc (build 1.1.56)
 *
 * - The doc assumes the merchant sits on "Split Evenly". Merchant 14 was on
 *   "Proportion" in the 2026-10-25 dump, so the spec snapshots the ORIGINAL
 *   method in `before` and drives the OTHER one; "Split Evenly" in the doc reads
 *   as "the original value" here.
 * - TC-TIP-06 clicks "Payment Gateway" in the sidebar — that entry no longer
 *   exists. "Charge & Fee" is used as the navigation target instead.
 * - The screen now also hosts Tip Setting, Signature and Supply Share (each card
 *   with its own Save). Only the split-tip card's Save is pressed here.
 *
 * ## Data safety
 *
 * TC-TIP-01..09 only make the form dirty and drop the change. TC-TIP-10..14 must
 * Save (the save IS the behaviour under test): they flip to the other method,
 * save, then TC-TIP-14 saves the original back. The `after` hook re-selects the
 * original and saves it if the screen disagrees — so a failure half-way never
 * leaves the merchant's default split changed for the order specs that follow.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog, toastMessage } from '../../../src/components/index.js';
import { Routes } from '../../../src/constants/routes.js';
import { goToSettings, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { dismissUpdaterIfPresent } from '../../../src/helpers/updater.js';
import { waitUntilPath } from '../../../src/helpers/wait.js';
import { homePage, settingsPage } from '../../../src/pages/index.js';
import tippingSettingsPage, { type SplitTipMethod } from '../../../src/pages/settings/TippingSettingsPage.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** Where the leave-guard cases try to go. The doc's "Payment Gateway" entry is gone on 1.1.56. */
const LEAVE_TARGET = Routes.SETTINGS_CHARGE_FEE;

const SUCCESS_COPY = /split tip setting updated|chia tip/i;

let original: SplitTipMethod = 'evenly';
let other: SplitTipMethod = 'proportion';

async function openTipping(): Promise<void> {
  await goToSettings();
  if (!(await tippingSettingsPage.isActive())) await settingsPage.openSection('PAYMENT_TRANSACTION');
  await tippingSettingsPage.waitForReady(Timeouts.MEDIUM);
}

/** Make the split-tip form dirty (other method selected, unsaved). */
async function makeDirty(): Promise<void> {
  if (!(await tippingSettingsPage.isSplitTipChecked(other))) await tippingSettingsPage.chooseSplitTip(other);
}

/** Dirty form + a sidebar click, so the leave guard is up. */
async function raiseLeaveGuard(): Promise<void> {
  if (await tippingSettingsPage.isLeaveGuardShown(Timeouts.ANIMATION)) return;
  await makeDirty();
  await tippingSettingsPage.clickSidebarEntry(LEAVE_TARGET);
}

/** Save the split tip and return the success toast's type + text. */
async function saveAndReadToast(): Promise<{ type: string | null; text: string | null }> {
  await toastMessage.dismissAll(Timeouts.SHORT);
  await tippingSettingsPage.saveSplitTip();
  const type = await toastMessage.latestType(Timeouts.API);
  const text = await toastMessage.latest(Timeouts.SHORT);
  return { type, text };
}

describe('Settings — Tipping Settings (split tip)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await openTipping();
    const selected = await tippingSettingsPage.selectedSplitTip();
    if (selected === null) throw new Error('Tipping Settings: neither split-tip radio is checked on entry.');
    original = selected;
    other = original === 'evenly' ? 'proportion' : 'evenly';
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    // A failed leave-guard case can leave the dialog up — drop the change first.
    if (await tippingSettingsPage.isLeaveGuardShown(Timeouts.ANIMATION)) {
      await tippingSettingsPage.discardAndLeave();
    }
    await openTipping();
    // Re-select the original. If Save is still enabled afterwards, the SAVED value
    // differs from the original (a saving case failed before TC-TIP-14) → save it back.
    await tippingSettingsPage.chooseSplitTip(original);
    if (await tippingSettingsPage.isSplitTipSaveEnabled()) {
      assertWritesAllowed('restore the merchant split-tip default');
      await tippingSettingsPage.saveSplitTip();
      await tippingSettingsPage.waitSplitTipSaveDisabled();
    }
  });

  /* ------------------------------------------------------------------ *
   * Layout
   * ------------------------------------------------------------------ */

  it(
    title('Screen renders its heading, description and split-tip card (TC-TIP-01)', Tag.REGRESSION),
    async () => {
      expect(await tippingSettingsPage.isHeadingShown()).toBe(true);
      expect(await tippingSettingsPage.isDescriptionShown()).toBe(true);
      expect(await tippingSettingsPage.isSplitTipCardShown()).toBe(true);
    },
  );

  it(title('Opening the screen raises no passcode guard (TC-TIP-02)', Tag.REGRESSION), async () => {
    // goToSettings() answers the merchant-wide Settings gate once per run; what
    // this case checks is that THIS sub-screen adds no guard of its own.
    await step('Re-enter Tipping Settings from another section', async () => {
      await settingsPage.openSection('CHARGE_FEE');
      await settingsPage.openSection('PAYMENT_TRANSACTION');
    });
    expect(await passcodeDialog.isPrompting(Timeouts.SHORT)).toBe(false);
    await tippingSettingsPage.waitForReady(Timeouts.MEDIUM);
  });

  it(title('Exactly two split methods, no Manual (TC-TIP-03)', Tag.REGRESSION), async () => {
    const values = await tippingSettingsPage.splitTipValues();
    expect(values).toHaveLength(2);
    expect([...values].sort()).toEqual(['evenly', 'proportion']);
    expect(values).not.toContain('manual');
  });

  it(title('Save is disabled with no changes (TC-TIP-04)', Tag.REGRESSION), async () => {
    expect(await tippingSettingsPage.isSplitTipSaveEnabled()).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   * Dirty form + leave guard (nothing saved)
   * ------------------------------------------------------------------ */

  it(title('Choosing the other method enables Save (TC-TIP-05)', Tag.REGRESSION), async () => {
    await tippingSettingsPage.chooseSplitTip(other);

    expect(await tippingSettingsPage.isSplitTipChecked(other)).toBe(true);
    expect(await tippingSettingsPage.isSplitTipSaveEnabled()).toBe(true);
  });

  it(title('Leaving with unsaved changes is blocked (TC-TIP-06)', Tag.REGRESSION), async () => {
    await makeDirty();
    await tippingSettingsPage.clickSidebarEntry(LEAVE_TARGET);

    expect(await tippingSettingsPage.isLeaveGuardShown(Timeouts.MEDIUM)).toBe(true);
    expect(await tippingSettingsPage.currentPath()).toBe(Routes.SETTINGS_PAYMENT_TRANSACTION);
  });

  it(title('The leave guard carries the expected copy and actions (TC-TIP-07)', Tag.REGRESSION), async () => {
    await raiseLeaveGuard();

    // Copy is i18n; merchant 14 runs in English.
    expect(await tippingSettingsPage.readLeaveGuardTitle()).toContain('Discard changes and leave?');
    expect(await tippingSettingsPage.readLeaveGuardMessage()).toContain(
      'You have unsaved changes. Do you want to undo changes and leave this page, or continue editing?',
    );
    expect(await tippingSettingsPage.readLeaveGuardButtons()).toEqual([
      'Continue Editing',
      'Discard & Leave',
    ]);
  });

  it(title('Continue Editing keeps the change and the route (TC-TIP-08)', Tag.REGRESSION), async () => {
    await raiseLeaveGuard();
    await tippingSettingsPage.continueEditing();

    expect(await tippingSettingsPage.isLeaveGuardShown(Timeouts.ANIMATION)).toBe(false);
    expect(await tippingSettingsPage.currentPath()).toBe(Routes.SETTINGS_PAYMENT_TRANSACTION);
    expect(await tippingSettingsPage.isSplitTipChecked(other)).toBe(true);
    expect(await tippingSettingsPage.isSplitTipSaveEnabled()).toBe(true);
  });

  it(title('Discard & Leave navigates away and drops the change (TC-TIP-09)', Tag.REGRESSION), async () => {
    await raiseLeaveGuard();
    await tippingSettingsPage.discardAndLeave();

    await waitUntilPath((p) => p.startsWith(LEAVE_TARGET), {
      timeout: Timeouts.NAVIGATION,
      message: `Discard & Leave did not land on ${LEAVE_TARGET}`,
    });

    await settingsPage.openSection('PAYMENT_TRANSACTION');
    await tippingSettingsPage.waitForReady(Timeouts.MEDIUM);
    expect(await tippingSettingsPage.isSplitTipChecked(original)).toBe(true);
    expect(await tippingSettingsPage.isSplitTipSaveEnabled()).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   * Save (writes merchant config; TC-TIP-14 + after hook restore)
   * ------------------------------------------------------------------ */

  it(
    title('Save shows the success toast (TC-TIP-10)', Tag.REGRESSION, Tag.WRITE, Tag.EXCLUSIVE),
    async () => {
      assertWritesAllowed('save the merchant split-tip default');
      await openTipping();
      await tippingSettingsPage.chooseSplitTip(other);

      const toast = await saveAndReadToast();
      expect(toast.type).toBe('success');
      expect(toast.text ?? '').toMatch(SUCCESS_COPY);
    },
  );

  it(
    title(
      'Save goes disabled again and the new method stays selected (TC-TIP-11)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      expect(await tippingSettingsPage.waitSplitTipSaveDisabled()).toBe(true);
      expect(await tippingSettingsPage.isSplitTipChecked(other)).toBe(true);
    },
  );

  it(
    title('The saved method survives an app reload (TC-TIP-12)', Tag.REGRESSION, Tag.WRITE, Tag.SLOW),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await step('Reload the app', async () => {
        await returnToHome();
        await appNav.pressReload();
        await waitUntilPath((p) => p.startsWith(Routes.HOME), {
          timeout: Timeouts.APP_BOOT,
          message: 'Reload did not land on /home',
        });
        await dismissUpdaterIfPresent();
        await homePage.waitForReady(Timeouts.APP_BOOT);
      });

      await openTipping();
      expect(await tippingSettingsPage.isSplitTipChecked(other)).toBe(true);
      expect(await tippingSettingsPage.isSplitTipSaveEnabled()).toBe(false);
    },
  );

  it(title('A clean form navigates away without the guard (TC-TIP-13)', Tag.REGRESSION), async () => {
    await openTipping();
    expect(await tippingSettingsPage.isSplitTipSaveEnabled()).toBe(false);

    await tippingSettingsPage.clickSidebarEntry(LEAVE_TARGET);
    await waitUntilPath((p) => p.startsWith(LEAVE_TARGET), {
      timeout: Timeouts.NAVIGATION,
      message: `A clean Tipping Settings form did not navigate to ${LEAVE_TARGET}`,
    });
    expect(await tippingSettingsPage.isLeaveGuardShown(Timeouts.ANIMATION)).toBe(false);

    await openTipping();
  });

  it(
    title('Cleanup: the original method is saved back (TC-TIP-14)', Tag.REGRESSION, Tag.WRITE, Tag.EXCLUSIVE),
    async () => {
      assertWritesAllowed('restore the merchant split-tip default');
      await openTipping();
      await tippingSettingsPage.chooseSplitTip(original);

      const toast = await saveAndReadToast();
      expect(toast.type).toBe('success');
      expect(await tippingSettingsPage.waitSplitTipSaveDisabled()).toBe(true);
      expect(await tippingSettingsPage.isSplitTipChecked(original)).toBe(true);
    },
  );
});
