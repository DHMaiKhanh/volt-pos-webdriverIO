/**
 * Permissions (`/settings/permissions`) — the permission × role matrix.
 *
 * Covers TC-PERM-01..23 from docs/screens/settings-permissions/settings-permissions-test-cases.md.
 *
 * ## Why most write cases are PENDING
 *
 * Every switch click (and Select All / Unselect All) is saved to the server
 * immediately — there is no Save to withhold — and the four roles are the
 * merchant's real, fixed system roles: no throwaway role can be created to
 * absorb the change. Flipping one, even for a second, changes what every Manager,
 * Partner or Staff login can open while the test runs, and a failure between the
 * flip and the revert leaves it changed. So TC-PERM-12/13/15/16/20/21 are
 * title-only PENDING. Everything else here is read-only or view state
 * (Expand / Collapse All is never persisted — TC-PERM-17).
 *
 * ## TC-PERM-22 and the passcode grant
 *
 * The route has its own passcode guard. TC-PERM-22 drops the run's 30-minute
 * grant, opens the screen, asserts the guard came up, then answers it with the
 * owner passcode (re-arming the grant). The `after` hook re-seeds the grant even
 * if the assertion failed, so later specs do not start prompting.
 *
 * Tagged `@regression` only: nothing here changes merchant data.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog } from '../../../src/components/index.js';
import { Routes } from '../../../src/constants/routes.js';
import { goToSettings, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import permissionsSettingsPage, {
  PERMISSION_COLUMNS,
  type PermissionRow,
} from '../../../src/pages/settings/PermissionsSettingsPage.js';
import { settingsPage } from '../../../src/pages/index.js';
import accessibilitySettingsPage from '../../../src/pages/settings/AccessibilitySettingsPage.js';
import { PERMISSION_TEXT } from '../../../src/constants/testids.settings-permissions.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';

/**
 * The permission tree on build 1.1.56 (English till). The doc recorded 19 rows;
 * Order Management has since gained Delete Order, Order History and Quick Pay → 22.
 */
const TREE: Record<string, string[]> = {
  'Order Management': [
    'Edit Order',
    'Cancel Order (Void)',
    'Refund',
    'Completed Payment',
    'Delete Order',
    'Order History',
    'Quick Pay',
  ],
  Income: ['Summary Income', 'Daily Income', 'Staff Income', 'Staff Payroll'],
  'Batch Management': ['Batch History', 'Batch Close'],
  'Cash Drawer': ['Open Cash Drawer'],
  'System Setting': ['POS Settings', 'View Phone Number', 'View Time Tracking'],
};
const PARENTS = Object.keys(TREE);
const TOTAL_ROWS = PARENTS.length + Object.values(TREE).flat().length; // 22

/** The rows rendered between `parent` and the next parent row, in the expanded matrix. */
function childrenOf(rows: PermissionRow[], parent: string): string[] {
  const names = rows.map((r) => r.name);
  const start = names.indexOf(parent);
  if (start < 0) return [];
  const rest = names.slice(start + 1);
  const next = rest.findIndex((n) => PARENTS.includes(n));
  return next < 0 ? rest : rest.slice(0, next);
}

/**
 * Re-open the screen through the settings sidebar — the suite's stand-in for the
 * doc's "reload route" (`browser.url()` would re-run the whole splash boot).
 */
async function reopenPermissions(): Promise<void> {
  await goToSettings();
  if (await permissionsSettingsPage.isActive()) await settingsPage.openSection('ROLES');
  await settingsPage.openSection('PERMISSIONS');
  await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
  await permissionsSettingsPage.waitForReady(Timeouts.MEDIUM);
}

describe('Settings — Permissions', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await reopenPermissions();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    // A failed TC-PERM-22 can leave the guard up and the grant gone.
    if (await passcodeDialog.isPrompting()) await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await ensurePasscodeGrant();
    // Leave the tree collapsed, as a fresh visit would show it.
    if (await permissionsSettingsPage.isActive()) await permissionsSettingsPage.collapseAll();
  });

  /* ------------------------------------------------------------------ *
   * Layout & default state
   * ------------------------------------------------------------------ */

  it(title('The screen renders the Permissions heading as h1 (TC-PERM-01)', Tag.REGRESSION), async () => {
    expect(await permissionsSettingsPage.isLevelOneHeadingShown()).toBe(true);
  });

  it(title('The header shows Access plus the 4 role columns (TC-PERM-02)', Tag.REGRESSION), async () => {
    expect(await permissionsSettingsPage.isAccessHeaderShown()).toBe(true);
    for (const role of PERMISSION_COLUMNS) {
      expect(await permissionsSettingsPage.isRoleHeaderShown(role)).toBe(true);
    }
  });

  it(title('The tree opens collapsed: 5 parent rows, Expand All (TC-PERM-03)', Tag.REGRESSION), async () => {
    await reopenPermissions();

    expect(await permissionsSettingsPage.readMatrix()).toHaveLength(PARENTS.length);
    expect(PERMISSION_TEXT.expandAll).toContain(await permissionsSettingsPage.expandToggleLabel());
  });

  it(title('Expand All shows all 22 rows / 88 switches (TC-PERM-04)', Tag.REGRESSION), async () => {
    await permissionsSettingsPage.expandAll();

    expect(await permissionsSettingsPage.readMatrix()).toHaveLength(TOTAL_ROWS);
    expect(await permissionsSettingsPage.visibleSwitchCount()).toBe(TOTAL_ROWS * 4);
    expect(PERMISSION_TEXT.collapseAll).toContain(await permissionsSettingsPage.expandToggleLabel());
  });

  it(title('The tree has exactly the 5 parent groups (TC-PERM-05)', Tag.REGRESSION), async () => {
    await permissionsSettingsPage.collapseAll();
    const collapsed = (await permissionsSettingsPage.readMatrix()).map((r) => r.name);
    expect(collapsed).toEqual(PARENTS);

    await permissionsSettingsPage.expandAll();
    const expanded = (await permissionsSettingsPage.readMatrix()).map((r) => r.name);
    for (const parent of PARENTS) expect(expanded).toContain(parent);
  });

  it(title('Order Management has its 7 children (TC-PERM-06)', Tag.REGRESSION), async () => {
    await permissionsSettingsPage.expandAll();
    expect(childrenOf(await permissionsSettingsPage.readMatrix(), 'Order Management')).toEqual(
      TREE['Order Management'],
    );
  });

  it(title('Income has its 4 children (TC-PERM-07)', Tag.REGRESSION), async () => {
    await permissionsSettingsPage.expandAll();
    expect(childrenOf(await permissionsSettingsPage.readMatrix(), 'Income')).toEqual(TREE.Income);
  });

  it(title('Batch Management has its 2 children (TC-PERM-08)', Tag.REGRESSION), async () => {
    await permissionsSettingsPage.expandAll();
    expect(childrenOf(await permissionsSettingsPage.readMatrix(), 'Batch Management')).toEqual(
      TREE['Batch Management'],
    );
  });

  it(title('System Setting has its 3 children (TC-PERM-09)', Tag.REGRESSION), async () => {
    await permissionsSettingsPage.expandAll();
    expect(childrenOf(await permissionsSettingsPage.readMatrix(), 'System Setting')).toEqual(
      TREE['System Setting'],
    );
  });

  it(title('The Owner column is always on and disabled (TC-PERM-10)', Tag.REGRESSION), async () => {
    await permissionsSettingsPage.expandAll();
    const rows = await permissionsSettingsPage.readMatrix();

    expect(rows).toHaveLength(TOTAL_ROWS);
    const offenders = rows.filter((r) => r.checked[0] !== true || r.disabled[0] !== true).map((r) => r.name);
    expect(offenders).toEqual([]);
  });

  it(title('Collapse All folds back to the 5 parent rows (TC-PERM-11)', Tag.REGRESSION), async () => {
    await permissionsSettingsPage.expandAll();
    await permissionsSettingsPage.collapseAll();

    expect(await permissionsSettingsPage.readMatrix()).toHaveLength(PARENTS.length);
    expect(PERMISSION_TEXT.expandAll).toContain(await permissionsSettingsPage.expandToggleLabel());
  });

  /* ------------------------------------------------------------------ *
   * Live writes — PENDING (see the file header)
   * ------------------------------------------------------------------ */

  it(
    title(
      'TC-PERM-12: turning a parent ON cascades to its children — PENDING (each click saves to a real system role; no throwaway role exists)',
    ),
  );

  it(
    title(
      'TC-PERM-13: turning a parent OFF cascades to its children — PENDING (each click saves to a real system role; no throwaway role exists)',
    ),
  );

  it(title('No Save / Apply button — changes save on click (TC-PERM-14)', Tag.REGRESSION), async () => {
    await permissionsSettingsPage.expandAll();
    const labels = await permissionsSettingsPage.tableButtonLabels();

    expect(await permissionsSettingsPage.hasSaveOrApply()).toBe(false);
    expect(labels.filter((l) => /^(save|apply|lưu|áp dụng)$/i.test(l))).toEqual([]);
    // What the table does carry: the expand toggle and the per-role Select buttons.
    expect(labels.some((l) => (PERMISSION_TEXT.collapseAll as readonly string[]).includes(l))).toBe(true);
    const selectLabels: readonly string[] = [...PERMISSION_TEXT.selectAll, ...PERMISSION_TEXT.unselectAll];
    expect(labels.some((l) => selectLabels.includes(l))).toBe(true);
  });

  it(
    title(
      'TC-PERM-15: toggling a switch shows no toast — PENDING (needs a live toggle of a real system role)',
    ),
  );

  it(
    title(
      'TC-PERM-16: a toggle survives a reload (saved server-side) — PENDING (needs a live toggle of a real system role)',
    ),
  );

  it(title('Expand state is not persisted across a re-visit (TC-PERM-17)', Tag.REGRESSION), async () => {
    await permissionsSettingsPage.expandAll();
    expect(await permissionsSettingsPage.isExpanded()).toBe(true);

    await step('Re-open the screen', () => reopenPermissions());

    expect(await permissionsSettingsPage.isExpanded()).toBe(false);
    expect(await permissionsSettingsPage.readMatrix()).toHaveLength(PARENTS.length);
  });

  it(
    title('Each role button label reflects whether the role has everything (TC-PERM-18)', Tag.REGRESSION),
    async () => {
      await permissionsSettingsPage.expandAll();
      const rows = await permissionsSettingsPage.readMatrix();
      const headers = await permissionsSettingsPage.roleHeaders();

      expect(rows).toHaveLength(TOTAL_ROWS);
      for (const [column, role] of PERMISSION_COLUMNS.entries()) {
        if (role === 'owner') continue;
        const allOn = rows.every((r) => r.checked[column] === true);
        const expected: readonly string[] = allOn ? PERMISSION_TEXT.unselectAll : PERMISSION_TEXT.selectAll;
        expect(expected).toContain(headers[role].button ?? '<no button>');
      }
    },
  );

  it(title('The Owner column has no Select All button (TC-PERM-19)', Tag.REGRESSION), async () => {
    const headers = await permissionsSettingsPage.roleHeaders();

    expect(headers.owner.shown).toBe(true);
    expect(headers.owner.button).toBeNull();
    // Sanity: the walk does find the buttons that ARE there.
    expect(headers.manager.button).not.toBeNull();
  });

  it(
    title(
      'TC-PERM-20: Select All turns on every permission of a role — PENDING (writes the whole column of a real system role)',
    ),
  );

  it(
    title(
      'TC-PERM-21: Unselect All turns off every permission of a role — PENDING (writes the whole column of a real system role)',
    ),
  );

  /* ------------------------------------------------------------------ *
   * Passcode gate
   * ------------------------------------------------------------------ */

  // On 1.1.56 the permissions route carries no guard of its own — the app's
  // `PasscodeProtectedRoute` exists but is not mounted on it. What protects it is
  // the Merchant Settings gate at the section's entry, and that gate is itself a
  // merchant toggle (Accessibility → Require Passcode For → POS Settings), off on
  // merchant 14. So the case reads the toggle and asserts the entry follows it:
  // leave Settings, drop the grant, come back in.
  it(
    title(
      'Entering Settings without the 30-min grant follows the POS Settings gate (TC-PERM-22)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await settingsPage.openSection('ACCESSIBILITY');
      const gateOn = await accessibilitySettingsPage.isGateOn('settings_page');

      await returnToHome();
      await clearPasscodeGrant();
      await appNav.openSidebarLink(Routes.SETTINGS_BUSINESS);
      const prompted = await passcodeDialog.isPrompting(Timeouts.MEDIUM);

      // Answer it before asserting, so a failure never strands the till under a modal.
      if (prompted) await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
      await ensurePasscodeGrant();

      expect(prompted).toBe(gateOn);
      await reopenPermissions();
    },
  );

  it(
    title('A non-exact label filter hits 2 rows for "Cash Drawer" (TC-PERM-23)', Tag.REGRESSION),
    async () => {
      if (!(await permissionsSettingsPage.isActive())) await reopenPermissions();
      await permissionsSettingsPage.expandAll();
      const names = (await permissionsSettingsPage.readMatrix()).map((r) => r.name);

      const loose = names.filter((n) => n.includes('Cash Drawer'));
      expect(loose).toEqual(['Cash Drawer', 'Open Cash Drawer']);
      // Exact matching is what tells them apart.
      expect(names.filter((n) => n === 'Cash Drawer')).toHaveLength(1);
    },
  );
});
