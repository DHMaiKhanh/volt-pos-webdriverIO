/**
 * VP-2400 — Passcode Settings: the rows the main spec folds into composite
 * titles (`TC-04/06/11/12`, `TC-07/15`, `TC-01/18`) which the coverage matcher
 * cannot see (volt-qc per-ticket file
 * `docs/qc/volt-qc/vp-tickets/VP-2400-passcode-settings-test-cases.md`).
 *
 * Main spec: tests/regression/settings/vp-2400-passcode-settings.spec.ts. This
 * file states each remaining row on its own, driven on the Order History gate
 * exactly like the main spec, with the same snapshot → restore of every gate
 * (merchant-GLOBAL, hence @exclusive) and the 30-minute grant re-armed after.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog } from '../../../../src/components/index.js';
import { goToSettings, returnToHome } from '../../../../src/flows/index.js';
import { accessibilitySettingsPage, settingsPage } from '../../../../src/pages/index.js';
import type { PasscodeGateState } from '../../../../src/pages/index.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';

let snapshot: PasscodeGateState | null = null;

async function openAccessibility(): Promise<void> {
  await goToSettings();
  await settingsPage.openSection('ACCESSIBILITY');
  await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
}

async function setHistoryGate(on: boolean): Promise<void> {
  await openAccessibility();
  await accessibilitySettingsPage.setGate('view_order_history', on);
  await accessibilitySettingsPage.savePasscodeSettings();
}

/** Open Order History via the sidebar; report whether the guard came up (and answer it). */
async function historyPrompts(options: { clearGrant: boolean }): Promise<boolean> {
  await returnToHome();
  if (options.clearGrant) await clearPasscodeGrant();
  await appNav.goToOrderHistory();
  const prompted = await passcodeDialog.isPrompting(Timeouts.MEDIUM);
  if (prompted) await passcodeDialog.enter(env.STAFF_PASSCODE);
  await returnToHome();
  return prompted;
}

describe('VP-2400 — Passcode Settings (rows not titled individually in the main spec)', () => {
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
    title('VP-2400 TC-18 The "Passcode Setting" section renders with its gate list', Tag.REGRESSION),
    async () => {
      await openAccessibility();
      expect(await accessibilitySettingsPage.isPasscodeSectionShown()).toBe(true);
      expect(await accessibilitySettingsPage.hasGate('view_order_history')).toBe(true);
    },
  );

  it(
    title(
      'VP-2400 TC-06 Turning the gate OFF applies at once — no restart, no re-login',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await setHistoryGate(false);
      expect(await historyPrompts({ clearGrant: true })).toBe(false);
    },
  );

  it(
    title(
      'VP-2400 TC-11 Gate OFF: a staff with the permission runs the action with no modal',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await setHistoryGate(false);
      await returnToHome();
      await clearPasscodeGrant();
      await appNav.goToOrderHistory();
      expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(false);
      await returnToHome();
    },
  );

  it(
    title(
      'VP-2400 TC-12 Gate OFF: neither the modal nor its 30-minute option appears',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await setHistoryGate(false);
      await returnToHome();
      await clearPasscodeGrant();
      await appNav.goToOrderHistory();
      expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(false);
      expect(await passcodeDialog.canSkip()).toBe(false);
      await returnToHome();
    },
  );

  it(
    title(
      'VP-2400 TC-15 OFF → ON again: an old 30-minute bypass does not suppress the modal',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await returnToHome();
      if (!(await ensurePasscodeGrant())) this.skip(); // needs a live bypass to start from
      await setHistoryGate(false);
      await setHistoryGate(true);
      // Grant deliberately NOT cleared: the sheet says the global ON wins at once.
      expect(await historyPrompts({ clearGrant: false })).toBe(true);
    },
  );
});
