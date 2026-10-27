/**
 * VP-2400 — Passcode Settings (Settings → General → Accessibility).
 *
 * Source: volt-qc `VP-2400-passcode-settings-test-cases.md` (TC 1–18).
 *
 * ## What the build ships vs the sheet
 *
 * The sheet describes one "Enable Passcode Verification" toggle. Build 1.1.40
 * renders "Passcode Setting → Require Passcode For": an "Active All" master switch
 * plus one switch per guarded action (`#passcode-gate-<permission>`), with a
 * section Save. The single toggle's cases are driven on the Order History gate
 * (the cheapest guarded action to reach), and the "every action" cases on the
 * master switch.
 *
 * ## Why this file is @exclusive
 *
 * The gates are MERCHANT-GLOBAL. The `before` hook snapshots every gate and the
 * `after` hook restores exactly that snapshot — even when an assertion failed
 * half-way — then re-arms the run's 30-minute passcode grant so later specs do
 * not start prompting.
 *
 * Each probe clears the 30-minute grant first: with a grant active the guard
 * never shows, which would make an "ON → prompts" assertion pass for the wrong
 * reason (or fail for it).
 *
 * Pending: TC-02 (factory default needs a fresh merchant), TC-08 (second till),
 * TC-09 (second merchant), TC-10/11/17 (a staff login without the permission),
 * TC-14 (waits out the 30-minute window).
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog } from '../../../src/components/index.js';
import { Routes } from '../../../src/constants/routes.js';
import { goToSettings, returnToHome } from '../../../src/flows/index.js';
import { dismissUpdaterIfPresent } from '../../../src/helpers/updater.js';
import { waitUntilPath } from '../../../src/helpers/wait.js';
import { accessibilitySettingsPage, homePage, settingsPage } from '../../../src/pages/index.js';
import type { PasscodeGateState } from '../../../src/pages/index.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';

let snapshot: PasscodeGateState | null = null;

async function openAccessibility(): Promise<void> {
  await goToSettings();
  await settingsPage.openSection('ACCESSIBILITY');
  await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
}

/**
 * Leave settings, drop the 30-minute grant, open a screen through the sidebar
 * WITHOUT unlocking, and report whether the passcode guard came up. Always
 * answers a guard that did come up, so the till is never left under a modal.
 */
async function guardShowsOn(path: string): Promise<boolean> {
  await returnToHome();
  await clearPasscodeGrant();
  if (path === Routes.ORDER_HISTORY) await appNav.goToOrderHistory();
  else await appNav.openSidebarLink(path);

  const prompted = await passcodeDialog.isPrompting(Timeouts.MEDIUM);
  if (prompted) await passcodeDialog.enter(env.STAFF_PASSCODE);
  await returnToHome();
  return prompted;
}

describe('VP-2400 — Passcode Settings', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('change merchant passcode gates');
    await openAccessibility();
    snapshot = await accessibilitySettingsPage.readGates();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    if (snapshot) {
      await openAccessibility();
      await accessibilitySettingsPage.applyGates(snapshot);
    }
    await returnToHome();
    await ensurePasscodeGrant();
  });

  it(
    title('TC-01/18 Accessibility shows the "Passcode Setting" section with its gate list', Tag.REGRESSION),
    async () => {
      await openAccessibility();
      expect(await accessibilitySettingsPage.isPasscodeSectionShown()).toBe(true);
      expect(await accessibilitySettingsPage.hasGate('view_order_history')).toBe(true);
      expect(await accessibilitySettingsPage.hasGate('refund')).toBe(true);
      expect(await accessibilitySettingsPage.hasGate('open_cash_drawer')).toBe(true);
    },
  );

  it(title('TC-02: default value is ON — PENDING (needs a merchant that never touched the setting)'));

  it(
    title(
      'TC-03 Gate ON → the guarded action asks for a passcode first',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openAccessibility();
      await accessibilitySettingsPage.setGate('view_order_history', true);
      await accessibilitySettingsPage.savePasscodeSettings();

      expect(await guardShowsOn(Routes.ORDER_HISTORY)).toBe(true);
    },
  );

  it(
    title(
      'TC-04/06/11/12 Gate OFF → the action runs at once, no modal, no restart needed',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openAccessibility();
      await accessibilitySettingsPage.setGate('view_order_history', false);
      await accessibilitySettingsPage.savePasscodeSettings();

      expect(await guardShowsOn(Routes.ORDER_HISTORY)).toBe(false);
    },
  );

  it(
    title(
      'TC-07/15 Gate back ON → the modal returns immediately (grant cleared)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openAccessibility();
      await accessibilitySettingsPage.setGate('view_order_history', true);
      await accessibilitySettingsPage.savePasscodeSettings();

      expect(await guardShowsOn(Routes.ORDER_HISTORY)).toBe(true);
    },
  );

  it(
    title(
      'TC-13 Gate ON with an active 30-minute grant → no modal (old behaviour kept)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await returnToHome();
      if (!(await ensurePasscodeGrant())) this.skip();
      await appNav.goToOrderHistory();

      expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(false);
      await returnToHome();
    },
  );

  it(
    title(
      'TC-05 "Active All" OFF → every guarded screen skips the modal',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await openAccessibility();
      // Turn the master ON first so the OFF below is a real transition that
      // switches every row, whatever mix the merchant had.
      await accessibilitySettingsPage.setGate('all', true);
      await accessibilitySettingsPage.setGate('all', false);
      await accessibilitySettingsPage.savePasscodeSettings();

      const gates = await accessibilitySettingsPage.readGates();
      expect(Object.values(gates).every((on) => !on)).toBe(true);

      expect(await guardShowsOn(Routes.ORDER_HISTORY)).toBe(false);
      expect(await guardShowsOn(Routes.BATCH_HISTORY)).toBe(false);
      expect(await guardShowsOn(Routes.TIME_TRACKING)).toBe(false);
    },
  );

  it(
    title('TC-16 The saved value survives an app reload', Tag.REGRESSION, Tag.WRITE, Tag.EXCLUSIVE, Tag.SLOW),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await openAccessibility();
      await accessibilitySettingsPage.setGate('view_order_history', false);
      await accessibilitySettingsPage.savePasscodeSettings();

      await returnToHome();
      await appNav.pressReload();
      await waitUntilPath((p) => p.startsWith(Routes.HOME), {
        timeout: Timeouts.APP_BOOT,
        message: 'Reload did not land on /home',
      });
      await dismissUpdaterIfPresent();
      await homePage.waitForReady(Timeouts.APP_BOOT);

      await openAccessibility();
      expect(await accessibilitySettingsPage.isGateOn('view_order_history')).toBe(false);
    },
  );

  it(title('TC-08: change applies to every till of the merchant — PENDING (needs a second till)'));
  it(title('TC-09: setting is per merchant — PENDING (needs a second merchant)'));
  it(title('TC-10/11/17: permissions are unaffected — PENDING (needs a staff login without the permission)'));
  it(title('TC-14: global OFF wins after the 30-minute window — PENDING (waits out 30 minutes)'));
});
