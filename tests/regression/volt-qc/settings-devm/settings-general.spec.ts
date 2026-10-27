/**
 * volt-qc port — 11-settings: Accessibility (Passcode Setting, Customer
 * Display), Language, Permissions and Roles.
 *
 * Source: volt-qc `e2e/tests/11-settings/set-plan-readonly-general.spec.ts`
 * (`@readonly` cases). TC definitions:
 * docs/qc/volt-qc/windows-regression/11-settings.md.
 *
 * ## Read-only
 *
 * Nothing is saved. Customer Display is toggled and thrown away through the
 * leave guard's "Discard & Leave"; the Roles Assign flow stops at the
 * confirmation and answers Cancel; the Permissions matrix is only read (every
 * switch there is a live write, so none is pressed).
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { Routes } from '../../../../src/constants/routes.js';
import type { RoleKey } from '../../../../src/constants/testids.settings-roles.js';
import {
  PASSCODE_GATES_VQ,
  PERMISSION_GROUPS_VQ,
  ROLES_VQ,
  Vq,
  VqAccessibility,
  VqLanguage,
  VqRoles,
  VqScope,
  type VqQuery,
} from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { step } from '../../../../src/helpers/steps.js';
import permissionsSettingsPage, {
  type PermissionRow,
} from '../../../../src/pages/settings/PermissionsSettingsPage.js';
import rolesSettingsPage from '../../../../src/pages/settings/RolesSettingsPage.js';
import {
  dismissOverlays,
  openSettingsVq,
  pressRailLink,
} from '../../../../src/pages/voltqc/settings-devm/nav.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const ROLE_KEYS: Record<(typeof ROLES_VQ)[number], RoleKey> = {
  Owner: 'owner',
  Manager: 'manager',
  Partner: 'partner',
  Staff: 'staff',
};

describe('volt-qc SET — Accessibility, Language, Permissions, Roles (read-only)', () => {
  afterEach(async () => {
    await dismissOverlays().catch(() => undefined);
  });

  /* ------------------------------------------------------------------ *
   * Accessibility
   * ------------------------------------------------------------------ */

  it(
    title(
      'Accessibility › Passcode Setting: Require Passcode For, Active All and the 14 gates in Reports / Orders / Others (SET-038)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('ACCESSIBILITY');
      await vqProbe.waitShown(VqAccessibility.gateAll(), Timeouts.MEDIUM);

      expect(await vqProbe.isShown(Vq.text('Require Passcode For', VqScope.main))).toBe(true);
      expect(await vqProbe.isShown(Vq.text('Active All', VqScope.main))).toBe(true);
      for (const [group, ids] of Object.entries(PASSCODE_GATES_VQ)) {
        expect({
          group,
          shown: await vqProbe.isShown(Vq.text(group, VqScope.card, 'Passcode Setting')),
        }).toEqual({
          group,
          shown: true,
        });
        for (const id of ids) {
          expect({ gate: id, shown: (await vqProbe.count(VqAccessibility.gate(id))) > 0 }).toEqual({
            gate: id,
            shown: true,
          });
        }
      }
      expect(await vqProbe.count(VqAccessibility.gates())).toBe(14);
    },
  );

  it(
    title(
      'Accessibility › Customer Display: labels, Save follows the change, leave guard Continue Editing / Discard & Leave (SET-039, SET-043)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('ACCESSIBILITY');
      const point = VqAccessibility.showPoint();
      const save = Vq.button('Save', VqScope.card, 'Customer Display');
      await vqProbe.waitShown(point, Timeouts.MEDIUM);
      const original = await vqProbe.isChecked(point);

      await step('Labels and the Save gate', async () => {
        const card = (text: string): VqQuery => Vq.text(text, VqScope.card, 'Customer Display');
        expect(
          await vqProbe.isShown(
            Vq.textContaining(
              'Choose what the customer-facing screen shows',
              VqScope.card,
              'Customer Display',
            ),
          ),
        ).toBe(true);
        expect(await vqProbe.isShown(card('Show Point'))).toBe(true);
        expect(await vqProbe.isShown(card('Show the customer point balance on the customer display'))).toBe(
          true,
        );
        expect(await vqProbe.isShown(card('Show Reward'))).toBe(true);
        expect(await vqProbe.isShown(card('Show reward redemption options on the customer display'))).toBe(
          true,
        );
        expect((await vqProbe.count(VqAccessibility.showReward())) > 0).toBe(true);

        expect(await vqProbe.isDisabled(save)).toBe(true);
        await vqProbe.press(point);
        expect(await vqProbe.poll(() => vqProbe.isDisabled(save), false)).toBe(false);
        await vqProbe.press(point);
        expect(await vqProbe.poll(() => vqProbe.isDisabled(save), true)).toBe(true);
      });

      await step(
        'Leaving with an unsaved change: Continue Editing stays, Discard & Leave drops it',
        async () => {
          await vqProbe.press(point);
          await pressRailLink('Language');
          expect(await vqProbe.isShown(Vq.text('Discard changes and leave?', VqScope.alertDialog))).toBe(
            true,
          );
          expect(
            await vqProbe.isShown(
              Vq.text(
                'You have unsaved changes. Do you want to undo changes and leave this page, or continue editing?',
                VqScope.alertDialog,
              ),
            ),
          ).toBe(true);
          await vqProbe.press(Vq.alertButton('Continue Editing'));
          expect(await vqProbe.isGone(Vq.alertDialog())).toBe(true);
          expect(await vqProbe.path()).toMatch(/\/settings\/accessibility/);
          expect(await vqProbe.isChecked(point)).toBe(!original);

          await pressRailLink('Language');
          expect(await vqProbe.isShown(Vq.alertDialog())).toBe(true);
          await vqProbe.press(Vq.alertButton('Discard & Leave'));
          expect(
            await vqProbe.poll(async () => (await vqProbe.path()).startsWith(Routes.SETTINGS_LANGUAGE), true),
          ).toBe(true);
          await openSettingsVq('ACCESSIBILITY');
          await vqProbe.waitShown(point, Timeouts.MEDIUM);
          expect(await vqProbe.poll(() => vqProbe.isChecked(point), original)).toBe(original);
        },
      );
    },
  );

  /* ------------------------------------------------------------------ *
   * Language
   * ------------------------------------------------------------------ */

  it(
    title('Language: heading, English / Tiếng Việt, exactly one selected (SET-105)', Tag.REGRESSION),
    async () => {
      await openSettingsVq('LANGUAGE');

      expect(await vqProbe.isShown(Vq.heading('Language'))).toBe(true);
      expect(await vqProbe.isShown(Vq.text('Choose your primary language', VqScope.main))).toBe(true);
      expect(await vqProbe.isShown(Vq.text('English', VqScope.main))).toBe(true);
      expect(await vqProbe.isShown(Vq.text('Tiếng Việt', VqScope.main))).toBe(true);
      const checked = [await vqProbe.isChecked(VqLanguage.en()), await vqProbe.isChecked(VqLanguage.vi())];
      expect(checked.filter(Boolean)).toHaveLength(1);
    },
  );

  /* ------------------------------------------------------------------ *
   * Permissions — read only (each switch is a live write)
   * ------------------------------------------------------------------ */

  it(
    title(
      'Permissions: Access header, 4 roles, 3 Select All buttons, 5 groups; Expand All shows 16 children, parent = all children, Owner on and locked (SET-115, SET-116)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('PERMISSIONS');
      await permissionsSettingsPage.waitForReady(Timeouts.MEDIUM);
      await permissionsSettingsPage.collapseAll();

      const rowOf = (rows: PermissionRow[], label: string): PermissionRow | undefined =>
        rows.find((r) => r.name === label || r.name.startsWith(`${label} `));

      await step('Header, roles and groups', async () => {
        expect(await vqProbe.isShown(Vq.text('Access', VqScope.main))).toBe(true);
        expect(await vqProbe.isShown(Vq.button('Expand All', VqScope.main))).toBe(true);
        const headers = await permissionsSettingsPage.roleHeaders();
        for (const role of ROLES_VQ)
          expect({ role, shown: headers[ROLE_KEYS[role]].shown }).toEqual({ role, shown: true });
        expect(await vqProbe.count(Vq.buttonMatching('^(Select All|Unselect All)$', VqScope.main))).toBe(3);
        const rows = await permissionsSettingsPage.readMatrix();
        for (const group of PERMISSION_GROUPS_VQ) {
          expect({ group: group.parent, present: rowOf(rows, group.parent) !== undefined }).toEqual({
            group: group.parent,
            present: true,
          });
        }
      });

      await step('Expand All: every child, parent ⇔ children, Owner on + disabled', async () => {
        await permissionsSettingsPage.expandAll();
        expect(await vqProbe.isShown(Vq.button('Collapse All', VqScope.main))).toBe(true);
        const rows = await permissionsSettingsPage.readMatrix();
        for (const group of PERMISSION_GROUPS_VQ) {
          const parent = rowOf(rows, group.parent);
          const children = group.children.map((child) => ({ child, row: rowOf(rows, child) }));
          for (const { child, row } of children) {
            expect({ child, present: row !== undefined }).toEqual({ child, present: true });
            expect({ child, ownerOn: row?.checked[0], ownerLocked: row?.disabled[0] }).toEqual({
              child,
              ownerOn: true,
              ownerLocked: true,
            });
          }
          ROLES_VQ.forEach((role, column) => {
            const all = children.every(({ row }) => row?.checked[column] === true);
            expect({ group: group.parent, role, parent: parent?.checked[column] }).toEqual({
              group: group.parent,
              role,
              parent: all,
            });
          });
        }
        await permissionsSettingsPage.collapseAll();
        expect(rowOf(await permissionsSettingsPage.readMatrix(), 'Summary Income')).toBeUndefined();
      });
    },
  );

  /* ------------------------------------------------------------------ *
   * Roles — the Assign flow stops at Cancel
   * ------------------------------------------------------------------ */

  it(
    title(
      'Roles: 4 roles with member counts, member table, Assign dialog search / tick gate, confirmation Cancel changes nothing (SET-120, SET-121, SET-123, SET-124)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('ROLES');
      await rolesSettingsPage.waitForReady(Timeouts.MEDIUM);
      const counts: Record<string, number> = {};

      await step('Role list', async () => {
        expect(await vqProbe.isShown(Vq.heading('Roles'))).toBe(true);
        expect(await vqProbe.isShown(Vq.text('Role', VqScope.main))).toBe(true);
        expect(await vqProbe.isShown(Vq.text('Members Count', VqScope.main))).toBe(true);
        const entries = await rolesSettingsPage.roleEntries();
        for (const role of ROLES_VQ) {
          const entry = entries.find((e) => e.name === role);
          expect({ role, label: entry?.countLabel }).toEqual({
            role,
            label: expect.stringMatching(/\d+ Members?/),
          });
          counts[role] = entry?.count ?? Number.NaN;
        }
        expect(await vqProbe.isShown(Vq.text('Select a Role to view details.', VqScope.main))).toBe(true);
      });

      await step('Member table of the smallest non-empty role', async () => {
        const small =
          [...ROLES_VQ]
            .filter((r) => (counts[r] ?? 0) > 0)
            .sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0))[0] ?? 'Staff';
        await rolesSettingsPage.openRole(ROLE_KEYS[small]);
        for (const header of ['Nick Name', 'Phone Number', 'Staff Code']) {
          expect({ header, shown: await vqProbe.isShown(Vq.text(header, VqScope.main)) }).toEqual({
            header,
            shown: true,
          });
        }
        const hrefs = await rolesSettingsPage.detailStaffHrefs();
        expect(hrefs.length).toBeGreaterThan(0);
        if ((counts[small] ?? 0) <= 6) expect(hrefs.length).toBe(counts[small]);
        await vqProbe.press(VqRoles.staffLinks());
        expect(
          await vqProbe.poll(async () => /^\/settings\/staffs\/[\w-]+/.test(await vqProbe.path()), true),
        ).toBe(true);
      });

      await step(
        'Assign dialog: search, tick enables Assign, untick disables it, Escape closes',
        async () => {
          await openSettingsVq('ROLES');
          await rolesSettingsPage.openRole('staff');
          await rolesSettingsPage.openAssignDialog();
          expect(
            await vqProbe.isShown(
              Vq.placeholder("Search for staff's nickname, first name or last name", VqScope.dialog),
            ),
          ).toBe(true);
          const first = (await rolesSettingsPage.assignItems()).find((item) => item.name !== '');
          if (first) {
            await rolesSettingsPage.searchAssign(first.name.slice(0, 3).toLowerCase());
            expect(await vqProbe.isShown(VqRoles.assignItems(first.name))).toBe(true);
          }
          expect(await rolesSettingsPage.isAssignEnabled()).toBe(false);
          await vqProbe.press(VqRoles.assignItemCheckbox(0));
          expect(await vqProbe.poll(() => rolesSettingsPage.isAssignEnabled(), true)).toBe(true);
          await vqProbe.press(VqRoles.assignItemCheckbox(0));
          expect(await vqProbe.poll(() => rolesSettingsPage.isAssignEnabled(), false)).toBe(false);
          await rolesSettingsPage.closeAssignDialog();
        },
      );

      await step('Assign → confirmation → Cancel: no role changes', async () => {
        await rolesSettingsPage.openAssignDialog();
        await vqProbe.press(VqRoles.assignItemCheckbox(0));
        await vqProbe.press(Vq.button('Assign', VqScope.dialog));
        expect(
          await vqProbe.isShown(
            Vq.text("Are you sure you want to change these staffs' roles?", VqScope.alertDialog),
          ),
        ).toBe(true);
        expect(
          await vqProbe.isShown(
            Vq.text(
              'Changing the role will reset the permissions for these staffs. Are you sure you want to continue?',
              VqScope.alertDialog,
            ),
          ),
        ).toBe(true);
        await vqProbe.press(Vq.alertButton('Cancel'));
        expect(await vqProbe.isGone(Vq.alertDialog())).toBe(true);
        await rolesSettingsPage.closeAssignDialog();

        await openSettingsVq('ROLES');
        await rolesSettingsPage.waitForReady(Timeouts.MEDIUM);
        const after = await rolesSettingsPage.roleEntries();
        for (const role of ROLES_VQ) {
          expect({ role, count: after.find((e) => e.name === role)?.count }).toEqual({
            role,
            count: counts[role],
          });
        }
      });
    },
  );
});
