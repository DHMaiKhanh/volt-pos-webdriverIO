/**
 * Accessibility (`/settings/accessibility`) — Passcode Setting (VP-2400).
 *
 * Covers TC-PASSCODE-01..07 from
 * docs/screens/settings-accessibility/settings-accessibility-test-cases.md.
 *
 * ## Drift from the doc (build 1.1.56)
 *
 * The doc describes ONE "Enable Passcode Verification" switch. The build renders
 * "Passcode Setting → Require Passcode For": an "Active All" master switch plus
 * one switch per guarded action (`#passcode-gate-<permission>`), committed by the
 * section's own Save. The single switch's cases are driven on the ORDER HISTORY
 * gate (`view_order_history`) — the cheapest guarded action to reach, and the
 * same mapping `vp-2400-passcode-settings.spec.ts` uses. The doc's representative
 * gated route `/settings/business` is not used: Settings itself is behind the
 * separate "POS Settings" gate, and `goToSettings()` answers it once per run.
 *
 * ## Data safety (@exclusive)
 *
 * The gates are MERCHANT-GLOBAL. `before` snapshots every gate, the keyboard
 * switch and the theme; `after` re-applies the gate snapshot (saving only if it
 * differs), then re-arms the run's 30-minute passcode grant so later specs do not
 * start prompting. TC-PASSCODE-05 toggles a gate WITHOUT saving and reverts it.
 * Keyboard and theme are never changed here; the `after` hook only logs drift.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog } from '../../../src/components/index.js';
import { Routes } from '../../../src/constants/routes.js';
import { goToSettings, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { dismissUpdaterIfPresent } from '../../../src/helpers/updater.js';
import { waitUntilPath } from '../../../src/helpers/wait.js';
import {
  accessibilitySettingsPage,
  homePage,
  orderHistoryPage,
  settingsPage,
} from '../../../src/pages/index.js';
import type { PasscodeGateState } from '../../../src/pages/index.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { moduleLogger } from '../../../src/utils/logger.js';

const log = moduleLogger('settings-accessibility');

/** The per-action gate standing in for the doc's single switch. */
const GATE = 'view_order_history' as const;

let gateSnapshot: PasscodeGateState | null = null;
let keyboardSnapshot: boolean | null = null;
let themeSnapshot: 'light' | 'dark' | null = null;

async function openAccessibility(): Promise<void> {
  await goToSettings();
  await settingsPage.openSection('ACCESSIBILITY');
  await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
}

async function setGateAndSave(on: boolean): Promise<void> {
  await openAccessibility();
  await accessibilitySettingsPage.setGate(GATE, on);
  await accessibilitySettingsPage.savePasscodeSettings();
}

/**
 * From home, with the 30-minute grant cleared, open Order History and report
 * whether the guard came up. Never answers the guard — the caller decides.
 */
async function openOrderHistoryUnlocked(): Promise<boolean> {
  await returnToHome();
  await clearPasscodeGrant();
  await appNav.goToOrderHistory();
  return passcodeDialog.isPrompting(Timeouts.MEDIUM);
}

describe('Settings — Accessibility (Passcode Setting)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await openAccessibility();
    gateSnapshot = await accessibilitySettingsPage.readGates();
    keyboardSnapshot = await accessibilitySettingsPage.isVirtualKeyboardOn();
    themeSnapshot = await accessibilitySettingsPage.currentTheme();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    // A guard left up by a failed probe would cover the nav.
    await passcodeDialog.enterIfPresent(env.OWNER_PASSCODE);
    if (gateSnapshot) {
      await openAccessibility();
      await accessibilitySettingsPage.applyGates(gateSnapshot);
      if (
        keyboardSnapshot !== null &&
        (await accessibilitySettingsPage.isVirtualKeyboardOn()) !== keyboardSnapshot
      ) {
        log.warn('virtual keyboard switch drifted during the run (not changed by this spec).');
      }
      if (themeSnapshot !== null && (await accessibilitySettingsPage.currentTheme()) !== themeSnapshot) {
        log.warn('appearance theme drifted during the run (not changed by this spec).');
      }
    }
    await returnToHome();
    await ensurePasscodeGrant();
  });

  it(
    title(
      'Default passcode verification is ON (TC-PASSCODE-01) — PENDING (factory default needs a merchant that never touched the setting; the single switch is now a per-action gate list)',
    ),
  );

  it(
    title(
      'Gate OFF → the guarded screen opens with no passcode modal (TC-PASSCODE-02)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      assertWritesAllowed('change merchant passcode gates');
      await setGateAndSave(false);

      const prompted = await openOrderHistoryUnlocked();
      if (prompted) await passcodeDialog.enter(env.OWNER_PASSCODE);

      expect(prompted).toBe(false);
      expect(await orderHistoryPage.isActive()).toBe(true);
      await returnToHome();
    },
  );

  it(
    title(
      'Gate back ON → the modal returns and the owner passcode opens the screen (TC-PASSCODE-03)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      assertWritesAllowed('change merchant passcode gates');
      await setGateAndSave(true);

      const prompted = await openOrderHistoryUnlocked();
      expect(prompted).toBe(true);

      await passcodeDialog.enter(env.OWNER_PASSCODE);
      expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION)).toBe(false);
      expect(await orderHistoryPage.isActive()).toBe(true);
      await returnToHome();
    },
  );

  it(
    title(
      'The OFF state survives an app reload (TC-PASSCODE-04)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      assertWritesAllowed('change merchant passcode gates');
      await setGateAndSave(false);

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

      await openAccessibility();
      expect(await accessibilitySettingsPage.isGateOn(GATE)).toBe(false);
    },
  );

  it(
    title(
      'Toggling a passcode gate leaves the virtual-keyboard switch alone (TC-PASSCODE-05)',
      Tag.REGRESSION,
    ),
    async () => {
      await openAccessibility();
      const keyboardBefore = await accessibilitySettingsPage.isVirtualKeyboardOn();
      const gateBefore = await accessibilitySettingsPage.isGateOn(GATE);

      // Unsaved flip, then revert — nothing reaches the merchant.
      await accessibilitySettingsPage.setGate(GATE, !gateBefore);
      expect(await accessibilitySettingsPage.isGateOn(GATE)).toBe(!gateBefore);
      expect(await accessibilitySettingsPage.isVirtualKeyboardOn()).toBe(keyboardBefore);

      await accessibilitySettingsPage.setGate(GATE, gateBefore);
      expect(await accessibilitySettingsPage.isVirtualKeyboardOn()).toBe(keyboardBefore);
    },
  );

  it(
    title(
      'Known bug VP-2586: the setting does not sync to a second till without a reload (TC-PASSCODE-06) — PENDING (needs a second till / session of the same merchant)',
    ),
  );

  it(
    title(
      'Cleanup: the gate is back to its original state (TC-PASSCODE-07)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      assertWritesAllowed('change merchant passcode gates');
      // The doc says "ON"; the merchant's ORIGINAL value is what must come back.
      const wanted = gateSnapshot?.[GATE] ?? true;
      await setGateAndSave(wanted);

      await openAccessibility();
      expect(await accessibilitySettingsPage.isGateOn(GATE)).toBe(wanted);
    },
  );
});
