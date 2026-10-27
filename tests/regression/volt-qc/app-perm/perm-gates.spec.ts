/**
 * volt-qc module 12-perm (PERM-*) — the passcode guard, the 30-minute skip,
 * Passcode Setting (drafts only) and the permission matrix (read). READ-ONLY.
 *
 * Ported from volt-qc `e2e/tests/12-perm/{perm-plan-dialog,perm-plan-skip,
 * perm-plan-gates,perm-deep,roles}.spec.ts` (`@readonly` cases only). TC
 * definitions: docs/qc/volt-qc/windows-regression/12-phan-quyen-passcode.md.
 *
 * Nothing is saved: the Passcode Setting cases flip DRAFT switches only, put the
 * draft back and leave through "Discard & Leave"; the matrix is read, never
 * clicked. The one piece of state touched is the `volt-passcode-skip` key — each
 * case drops it to see the guard and {@link recoverShell} re-arms the run grant.
 *
 * Codes: `<OWNER_CODE>` = OWNER_PASSCODE; `<UNKNOWN_CODE>` = VOLT_UNKNOWN_CODE
 * (default 9137); `<INACTIVE_CODE>` = VOLT_INACTIVE_CODE (case skips without it).
 * The role codes (Manager / Partner / Staff) the matrix-by-role cases need are
 * not in this suite's env, so those cases are not ported.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { appNav, passcodeDialog } from '../../../../src/components/index.js';
import { Routes } from '../../../../src/constants/routes.js';
import { goToSettings, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle, waitUntilPath } from '../../../../src/helpers/wait.js';
import {
  accessibilitySettingsPage,
  homePage,
  PASSCODE_GATES,
  settingsPage,
} from '../../../../src/pages/index.js';
import type { PasscodeGateState } from '../../../../src/pages/index.js';
import permissionsSettingsPage from '../../../../src/pages/settings/PermissionsSettingsPage.js';
import { appShellProbe } from '../../../../src/pages/voltqc/app-perm/AppShellProbe.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import { passcodeSettingProbe } from '../../../../src/pages/voltqc/app-perm/PasscodeSettingProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { inactiveCode, log, ownerCode, recoverShell, unknownCode } from './app-perm.helpers.js';

const onPath = (path: string): Promise<string> =>
  waitUntilPath((p) => p === path || p.startsWith(`${path}/`), {
    timeout: Timeouts.NAVIGATION,
    message: `never reached ${path}`,
  });

const OH = 'Order History';

/** Settings › Accessibility, Passcode Setting rendered. */
async function openAccessibility(): Promise<void> {
  await goToSettings();
  await settingsPage.openSection('ACCESSIBILITY');
  await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
}

/** Gate labels (`passcode-setting.constants.ts` + en locale), keyed by the `#passcode-gate-<id>` suffix. */
const GATE_LABEL: Record<(typeof PASSCODE_GATES)[number], string> = {
  summary_income: 'Summary Income',
  daily_income: 'Daily Income',
  staff_income: 'Staff Income',
  staff_payroll: 'Staff Payroll',
  batch_history: 'Batch History',
  complete_order: 'Completed Payment',
  cancel_order: 'Cancel Order (Void)',
  refund: 'Refund',
  reopen_order: 'Re-Open Order',
  delete_order: 'Delete Order',
  view_order_history: 'Order History',
  quick_pay: 'Quick Pay',
  open_cash_drawer: 'Open Cash Drawer',
  settings_page: 'POS Settings',
  time_tracking: 'Time Tracking',
};

describe('volt-qc PERM — passcode guard, skip, Passcode Setting, matrix (read-only)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await returnToHome();
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await recoverShell();
  });

  /* ------------------------------------------------------------------ *
   * The guard dialog
   * ------------------------------------------------------------------ */

  it(
    title(
      'The page gate opens in its initial state and the on-screen keypad auto-submits on the 4th digit (PERM-001, PERM-002)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!(await gateProbe.openGate(Routes.ORDER_HISTORY))) this.skip(); // Order History gate OFF

      await step('Initial state', async () => {
        const s = await gateProbe.state();
        expect(s?.heading).toBe('Enter staff code to access Order History');
        expect([s?.empty, s?.filled]).toEqual([4, 0]);
        expect([...(s?.digits ?? [])].sort()).toEqual([...'0123456789']);
        expect(s?.backspaceDisabled).toBe(true);
        expect(s?.hasClose).toBe(true);
        expect(s?.skipChecked).toBe(false);
        expect(s?.skipLabelShown).toBe(true);
        expect(s?.hasSubmit).toBe(false);
        expect(await gateProbe.mainHeadingShown(OH)).toBe(false);
      });

      await step('Each key paints one dot; the 4th validates by itself', async () => {
        const code = ownerCode();
        for (let i = 0; i < 3; i += 1) {
          await gateProbe.pressDigits(code.charAt(i));
          expect(await gateProbe.waitFilled(i + 1)).toBe(i + 1);
        }
        await gateProbe.pressDigits(code.charAt(3));
        expect(await gateProbe.waitClosed()).toBe(true);
        await onPath(Routes.ORDER_HISTORY);
        expect(await gateProbe.waitMainHeading(OH)).toBe(true);
      });
    },
  );

  it(
    title(
      'The physical keyboard: other keys ignored, Backspace/Delete erase, under 4 digits never validates, the 4th submits (PERM-003, PERM-004, PERM-005, PERM-006)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!(await gateProbe.openGate(Routes.ORDER_HISTORY))) this.skip();
      const code = ownerCode();

      await step('PERM-005 letters / symbols paint no dot', async () => {
        await gateProbe.typeKeys('ab#.');
        expect(await gateProbe.waitFilled(0)).toBe(0);
        await gateProbe.typeKeys('1');
        expect(await gateProbe.waitFilled(1)).toBe(1);
      });

      await step('PERM-004 backspace button, Backspace key, Delete key', async () => {
        await gateProbe.typeKeys('23');
        expect(await gateProbe.waitFilled(3)).toBe(3);
        await gateProbe.clickBackspace();
        expect(await gateProbe.waitFilled(2)).toBe(2);
        await gateProbe.pressBackspaceKey();
        expect(await gateProbe.waitFilled(1)).toBe(1);
        await gateProbe.pressDeleteKey();
        expect(await gateProbe.waitFilled(0)).toBe(0);
        const s = await gateProbe.state();
        expect(s?.backspaceDisabled).toBe(true);
        expect(s?.error).toBe('');
      });

      await step('PERM-006 three digits, wait 3 s: nothing validates', async () => {
        await gateProbe.typeKeys(code.slice(0, 3));
        expect(await gateProbe.waitFilled(3)).toBe(3);
        await settle(3_000);
        const s = await gateProbe.state();
        expect(s).not.toBeNull();
        expect(s?.error).toBe('');
        expect(await gateProbe.mainHeadingShown(OH)).toBe(false);
      });

      await step('PERM-003 the last digit on the keyboard submits and the page opens', async () => {
        await gateProbe.typeKeys(code.slice(3));
        expect(await gateProbe.waitClosed()).toBe(true);
        expect(await gateProbe.waitMainHeading(OH)).toBe(true);
      });
    },
  );

  it(
    title(
      'A code of no staff reports "Failed to verify staff code", clears the dots, keeps the dialog; typing again clears the error (PERM-007, PERM-008)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!(await gateProbe.openGate(Routes.ORDER_HISTORY))) this.skip();
      const r = await gateProbe.submit(unknownCode());
      // The default code may belong to someone on another merchant — set VOLT_UNKNOWN_CODE.
      if (r.result === 'allowed') this.skip();

      expect(r).toEqual({ result: 'unknown', error: 'Failed to verify staff code' });
      expect(await gateProbe.waitFilled(0)).toBe(0);
      expect(await gateProbe.isOpen()).toBe(true);
      expect(await gateProbe.mainHeadingShown(OH)).toBe(false);

      await gateProbe.pressDigits('1');
      const s = await gateProbe.state();
      expect(s?.error).toBe('');
      expect(s?.filled).toBe(1);
    },
  );

  it(
    title('The code of an Inactive staff is refused with its own message (PERM-009)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      if (inactiveCode() === '') this.skip(); // VOLT_INACTIVE_CODE not set
      if (!(await gateProbe.openGate(Routes.INCOME_SUMMARY))) this.skip();
      const r = await gateProbe.submit(inactiveCode());
      expect(r).toEqual({ result: 'inactive', error: 'This staff is inactive' });
      expect(await gateProbe.isOpen()).toBe(true);
    },
  );

  it(
    title(
      'Cancelling a page gate by X or Escape returns to Pending Orders and renders nothing of the page (PERM-016, PERM-018, APP-077)',
      Tag.REGRESSION,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const backOnPending = async (): Promise<void> => {
        await onPath(Routes.ORDER_PENDING);
        expect(await appShellProbe.mainButtonShown('Quick Checkout')).toBe(true);
      };

      await step('Order History: X, then Escape', async () => {
        if (!(await gateProbe.openGate(Routes.ORDER_HISTORY))) this.skip();
        await gateProbe.clickClose();
        expect(await gateProbe.waitClosed()).toBe(true);
        await backOnPending();
        expect(await gateProbe.mainHeadingShown(OH)).toBe(false);

        expect(await gateProbe.openGate(Routes.ORDER_HISTORY)).toBe(true);
        await gateProbe.pressEscape();
        expect(await gateProbe.waitClosed()).toBe(true);
        await backOnPending();
      });

      const pages: [string, RegExp][] = [
        [Routes.INCOME_SUMMARY, /Total Payment/],
        [Routes.INCOME_DAILY, /Total Order/],
        [Routes.INCOME_STAFF, /Total staff income/i],
        [Routes.STAFF_PAYROLL, /Current Period/],
        [Routes.BATCH_HISTORY, /Batch Number/],
        [Routes.TIME_TRACKING, /Date IN/],
      ];
      for (const [route, data] of pages) {
        await step(`${route}: Escape`, async () => {
          if (!(await gateProbe.openGate(route))) {
            log.info(`PERM-018: ${route} gate is OFF — nothing to cancel`);
            return;
          }
          await gateProbe.pressEscape();
          expect(await gateProbe.waitClosed()).toBe(true);
          await backOnPending();
          expect({ route, leaked: data.test(await gateProbe.mainText()) }).toEqual({ route, leaked: false });
        });
      }
    },
  );

  it(
    title('Order History content never flashes before the passcode is verified (PERM-029)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      await gateProbe.clearSkip();
      await gateProbe.watchHeadingFlash(OH);
      await gateProbe.routerNavigate(Routes.ORDER_HISTORY);
      if (!(await gateProbe.waitOpen(4_000))) {
        await gateProbe.flashCount();
        this.skip(); // Order History gate OFF
      }
      await settle(1_000);
      expect(await gateProbe.flashCount()).toBe(0);
    },
  );

  /* ------------------------------------------------------------------ *
   * The 30-minute skip
   * ------------------------------------------------------------------ */

  it(
    title(
      'Without ticking the skip no key is stored and the next visit asks again (PERM-025)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!(await gateProbe.openGate(Routes.ORDER_HISTORY))) this.skip();
      expect((await gateProbe.state())?.skipChecked).toBe(false);
      expect((await gateProbe.submit(ownerCode())).result).toBe('allowed');
      expect(await gateProbe.readSkip()).toBeNull();
      // openGate() drops the key again — harmless here, it is already absent.
      expect(await gateProbe.openGate(Routes.ORDER_HISTORY)).toBe(true);
    },
  );

  it(
    title('An expired skip asks for the passcode again and removes the key (PERM-023)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      if (!(await gateProbe.activateSkip(Routes.ORDER_HISTORY, ownerCode()))) this.skip();
      await gateProbe.setSkipExpiry((await gateProbe.now()) - 1_000);

      // Not openGate(): that would drop the key itself and prove nothing.
      await gateProbe.routerNavigate(Routes.HOME);
      await onPath(Routes.HOME);
      await gateProbe.routerNavigate(Routes.ORDER_HISTORY);
      expect(await gateProbe.waitOpen(4_000)).toBe(true);
      expect(await gateProbe.readSkip()).toBeNull();
    },
  );

  it(
    title(
      'A live skip survives Reload App from the sidebar: same key, Order History opens straight; dropping it asks again (PERM-027)',
      Tag.REGRESSION,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      // A real restart is outside the lane; Reload re-initialises the WebView document and
      // keeps localStorage the way a relaunch does.
      if (!(await gateProbe.activateSkip(Routes.ORDER_HISTORY, ownerCode()))) this.skip();
      const before = await gateProbe.readSkip();
      expect(before).not.toBeNull();

      await returnToHome();
      await appNav.pressReload();
      await waitUntilPath((p) => p.startsWith(Routes.HOME), {
        timeout: Timeouts.APP_BOOT,
        message: 'Reload did not land on /home',
      });
      await homePage.waitForReady(Timeouts.APP_BOOT);
      expect(await gateProbe.readSkip()).toEqual(before);

      await gateProbe.watchGates();
      await gateProbe.routerNavigate(Routes.ORDER_HISTORY);
      expect(await gateProbe.waitMainHeading(OH)).toBe(true);
      expect(await gateProbe.gatesSeen()).toEqual([]);

      await step('Control: drop the key → the gate asks again', async () => {
        expect(await gateProbe.openGate(Routes.ORDER_HISTORY)).toBe(true);
      });
    },
  );

  /* ------------------------------------------------------------------ *
   * Passcode Setting (Settings › Accessibility) — drafts only, never saved
   * ------------------------------------------------------------------ */

  it(
    title(
      'Passcode Setting lists 14 gates with their labels in 3 groups, Save disabled, no big gap under the title (PERM-031, PERM-037)',
      Tag.REGRESSION,
    ),
    async () => {
      await openAccessibility();
      const card = await passcodeSettingProbe.readCard(PASSCODE_GATES);
      expect(card.found).toBe(true);
      expect(await accessibilitySettingsPage.isPasscodeSaveEnabled()).toBe(false);
      for (const copy of [
        'Require Passcode For',
        'Turn an item off to run that action immediately, without asking for a passcode.',
        'Active All',
        'Turn every item below on or off at once.',
      ]) {
        expect({ copy, shown: card.text.includes(copy) }).toEqual({ copy, shown: true });
      }
      for (const group of ['Reports', 'Orders', 'Others']) {
        expect({ group, shown: new RegExp(`\\b${group}\\b`, 'i').test(card.text) }).toEqual({
          group,
          shown: true,
        });
      }
      expect(card.labels).toEqual(GATE_LABEL);
      expect(card.switchCount).toBe(PASSCODE_GATES.length + 1);

      log.info(`PERM-037: title → "Require Passcode For" gap ${String(card.titleGap)}px`);
      expect(card.titleGap).not.toBeNull();
      expect(card.titleGap ?? Infinity).toBeLessThanOrEqual(80);
    },
  );

  it(
    title(
      'Active All follows the gates and flips them all (draft); leaving a dirty draft asks Discard and keeps the saved value (PERM-032, PERM-036)',
      Tag.REGRESSION,
    ),
    async () => {
      await openAccessibility();
      const snap: PasscodeGateState = await accessibilitySettingsPage.readGates();
      const every = async (): Promise<boolean> =>
        Object.values(await accessibilitySettingsPage.readGates()).every(Boolean);
      const restoreDraft = async (): Promise<void> => {
        for (const g of PASSCODE_GATES) await accessibilitySettingsPage.setGate(g, snap[g]);
      };

      try {
        await step('PERM-032 Active All = every gate; toggling it sets all 14', async () => {
          await accessibilitySettingsPage.setGate('refund', !snap.refund);
          expect(await accessibilitySettingsPage.isGateOn('all')).toBe(await every());
          await accessibilitySettingsPage.setGate('refund', snap.refund);
          expect(await accessibilitySettingsPage.isGateOn('all')).toBe(await every());

          for (let i = 0; i < 2; i += 1) {
            const target = !(await accessibilitySettingsPage.isGateOn('all'));
            await accessibilitySettingsPage.setGate('all', target);
            const now = await accessibilitySettingsPage.readGates();
            expect({ activeAll: target, allMatch: Object.values(now).every((v) => v === target) }).toEqual({
              activeAll: target,
              allMatch: true,
            });
          }
          await restoreDraft();
          expect(await accessibilitySettingsPage.isPasscodeSaveEnabled()).toBe(false);
        });

        await step(
          'PERM-036 dirty draft → leave → "Discard changes and leave?" → Discard & Leave',
          async () => {
            await accessibilitySettingsPage.setGate('refund', !snap.refund);
            await gateProbe.routerNavigate(Routes.SETTINGS_LANGUAGE);
            expect(await passcodeSettingProbe.leaveGuardShown()).toBe(true);
            expect(await settingsPage.confirmLeaveGuardIfShown()).toBe(true);
            await onPath(Routes.SETTINGS_LANGUAGE);

            await settingsPage.openSection('ACCESSIBILITY');
            await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
            expect(await accessibilitySettingsPage.isGateOn('refund')).toBe(snap.refund);
            expect(await accessibilitySettingsPage.isPasscodeSaveEnabled()).toBe(false);
          },
        );
      } finally {
        // Drafts only: put the draft back; never Save.
        if (await accessibilitySettingsPage.isActive()) await restoreDraft().catch(() => undefined);
      }
    },
  );

  /* ------------------------------------------------------------------ *
   * Permission matrix (Settings › Permissions) — read only
   * ------------------------------------------------------------------ */

  it(
    title(
      'The matrix has the 16 permissions, the Owner column is on and locked, Batch Close has no consumer, no Delete Settled Cash Order; Owner passes every page gate (PERM-062, PERM-074, PERM-079, PERM-092)',
      Tag.REGRESSION,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      const labels = [
        'Edit Order',
        'Cancel Order (Void)',
        'Refund',
        'Completed Payment',
        'Delete Order',
        'Order History',
        'Summary Income',
        'Daily Income',
        'Staff Income',
        'Staff Payroll',
        'Batch History',
        'Batch Close',
        'Open Cash Drawer',
        'POS Settings',
        'View Phone Number',
        'View Time Tracking',
      ];
      const seed: Record<'manager' | 'partner' | 'staff', string[]> = {
        manager: labels.filter((l) => l !== 'View Time Tracking'),
        partner: [
          'Summary Income',
          'Daily Income',
          'Staff Payroll',
          'Batch History',
          'Cancel Order (Void)',
          'Refund',
          'Edit Order',
          'POS Settings',
          'Completed Payment',
          'View Phone Number',
        ],
        staff: [
          'Edit Order',
          'POS Settings',
          'Completed Payment',
          'Cancel Order (Void)',
          'View Phone Number',
          'Staff Payroll',
          'Delete Order',
          'Order History',
        ],
      };

      await goToSettings();
      await settingsPage.openSection('PERMISSIONS');
      await passcodeDialog.unlockForRun(ownerCode());
      await permissionsSettingsPage.waitForReady(Timeouts.MEDIUM);
      await permissionsSettingsPage.expandAll();
      const rows = await permissionsSettingsPage.readMatrix();
      const byName = new Map(rows.map((r) => [r.name, r]));

      // PERM-062: the 16 rows exist; differences from the production seed are recorded, not failed.
      {
        const missing = labels.filter((l) => !byName.has(l));
        expect(missing).toEqual([]);
        const diffs: string[] = [];
        for (const l of labels) {
          const row = byName.get(l);
          if (!row) continue;
          (['manager', 'partner', 'staff'] as const).forEach((role, i) => {
            const want = seed[role].includes(l);
            if (row.checked[i + 1] !== want)
              diffs.push(`${l}/${role}: ${row.checked[i + 1] ? 'ON' : 'OFF'} (seed ${want ? 'ON' : 'OFF'})`);
          });
        }
        log.info(
          `PERM-062: ${diffs.length ? `differs from seed — ${diffs.join('; ')}` : 'matches the production seed'}`,
        );
      }

      await step(
        'PERM-079 Owner column: every switch on and disabled; Select All only on the other 3',
        async () => {
          for (const l of labels) {
            const row = byName.get(l);
            expect({ l, owner: [row?.checked[0], row?.disabled[0]] }).toEqual({ l, owner: [true, true] });
          }
          const selectAll = (await permissionsSettingsPage.tableButtonLabels()).filter((b) =>
            /^(Select All|Unselect All)$/.test(b),
          );
          expect(selectAll.length).toBe(3);
        },
      );

      // PERM-092: there is no "Delete Settled Cash Order" permission yet.
      expect(byName.has('Delete Settled Cash Order')).toBe(false);

      await permissionsSettingsPage.collapseAll();

      await step('PERM-074 Batch Close exists but Batch History offers no close-batch action', async () => {
        expect(byName.has('Batch Close')).toBe(true);
        await returnToHome();
        await gateProbe.routerNavigate(Routes.BATCH_HISTORY);
        await passcodeDialog.unlockForRun(ownerCode());
        expect(await gateProbe.waitMainText(/Batch Number/)).toBe(true);
        expect(await appShellProbe.mainButtonShown('Close Batch', Timeouts.ANIMATION)).toBe(false);
        expect(await appShellProbe.mainButtonShown('Batch Close', Timeouts.ANIMATION)).toBe(false);
      });

      await step('PERM-079 the Owner code passes every page gate', async () => {
        for (const route of [
          Routes.ORDER_HISTORY,
          Routes.BATCH_HISTORY,
          Routes.INCOME_DAILY,
          Routes.INCOME_SUMMARY,
          Routes.INCOME_STAFF,
          Routes.STAFF_PAYROLL,
          Routes.TIME_TRACKING,
          Routes.SETTINGS_BUSINESS,
        ]) {
          const got = await gateProbe.tryGate(route, ownerCode());
          expect({ route, got: got === 'no-gate' ? 'allowed' : got }).toEqual({ route, got: 'allowed' });
        }
      });
    },
  );
});
