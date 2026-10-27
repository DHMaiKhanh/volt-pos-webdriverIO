/**
 * Roles (`/settings/roles`, `/settings/roles/$roleId`) — the four fixed system
 * roles, each role's staff table, and the "Assign to Staff Role" dialog.
 *
 * Covers TC-ROLE-01..20 from docs/screens/settings-roles/settings-roles-test-cases.md.
 *
 * ## Why this file is safe to run
 *
 * Assigning a staff member MOVES them to another role, which changes what they
 * can open on the till. Nothing here presses the dialog's `Assign`: the dialog
 * cases open it, search, tick a checkbox, read the button state and close it with
 * Escape — the doc's own observed flow, which assigns nobody (TC-ROLE-16 proves
 * the table and badges did not change). The roles themselves cannot be created,
 * renamed or deleted, so there is nothing else to write.
 *
 * ## Bug-characterisation cases
 *
 * TC-ROLE-08/09/10/17/18 are marked 🐞/⚠️ in the doc: their "expected result" IS
 * the observed defect (empty detail title, badge ≠ row count, empty phone column,
 * nameless / badge-less dialog items). They assert the defect as documented so a
 * fix shows up as a failure here — invert the assertion in the same PR as the fix.
 * TC-ROLE-17/18 depend on named staff (`Annie`, `Beo*`) from the scan's merchant
 * and skip themselves when those staff are not on this one.
 *
 * Prerequisite: the merchant has staff in the Owner and Partner roles.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { goToSettings } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import rolesSettingsPage from '../../../src/pages/settings/RolesSettingsPage.js';
import { settingsPage } from '../../../src/pages/index.js';
import { ROLE_NAMES, type RoleKey } from '../../../src/constants/testids.settings-roles.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** Back on the bare list with no role selected (the placeholder state). */
async function openRolesList(): Promise<void> {
  await goToSettings();
  // Bounce through another section so the list re-mounts with nothing selected.
  if (await rolesSettingsPage.isActive()) await settingsPage.openSection('RECEIPT');
  await settingsPage.openSection('ROLES');
  await rolesSettingsPage.waitForReady(Timeouts.MEDIUM);
}

/** On a role's detail panel. */
async function openRole(role: RoleKey): Promise<void> {
  if (!(await rolesSettingsPage.isActive())) await openRolesList();
  await rolesSettingsPage.openRole(role);
}

/** Run `fn` with the Assign dialog open on `role`, always closing it with Escape. */
async function withAssignDialog(role: RoleKey, fn: () => Promise<void>): Promise<void> {
  await openRole(role);
  await rolesSettingsPage.openAssignDialog();
  try {
    await fn();
  } finally {
    if (await rolesSettingsPage.isAssignDialogShown()) await rolesSettingsPage.closeAssignDialog();
  }
}

const isRoleLabel = (text: string | null): boolean =>
  text !== null && Object.values(ROLE_NAMES).some((names) => (names as readonly string[]).includes(text));

describe('Settings — Roles', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await openRolesList();
  });

  after(async () => {
    // Belt-and-braces: never leave the Assign dialog over the screen.
    if ((await rolesSettingsPage.isActive()) && (await rolesSettingsPage.isAssignDialogShown())) {
      await rolesSettingsPage.closeAssignDialog();
    }
  });

  /* ------------------------------------------------------------------ *
   * Role list
   * ------------------------------------------------------------------ */

  it(title('The screen lists exactly the 4 system roles (TC-ROLE-01)', Tag.REGRESSION), async () => {
    await openRolesList();
    const names = (await rolesSettingsPage.roleEntries()).map((e) => e.name);

    expect(names).toHaveLength(4);
    for (const role of Object.values(ROLE_NAMES)) {
      expect(names.some((n) => (role as readonly string[]).includes(n))).toBe(true);
    }
    expect(await rolesSettingsPage.hasCreateRoleButton()).toBe(false);
  });

  it(title('The list has Role / Members Count column headers (TC-ROLE-02)', Tag.REGRESSION), async () => {
    expect(await rolesSettingsPage.isHeadingShown()).toBe(true);
    expect(await rolesSettingsPage.areListHeadersShown()).toEqual({ role: true, members: true });
  });

  it(
    title('The detail panel shows a placeholder before a role is picked (TC-ROLE-03)', Tag.REGRESSION),
    async () => {
      await openRolesList();
      expect(await rolesSettingsPage.isDetailPlaceholderShown()).toBe(true);
    },
  );

  it(title('Every role shows a member count (TC-ROLE-04)', Tag.REGRESSION), async () => {
    const entries = await rolesSettingsPage.roleEntries();

    expect(entries).toHaveLength(4);
    for (const entry of entries) {
      expect(entry.countLabel).toMatch(/^\d+ (Members|Thành viên|thành viên)$/);
      expect(Number.isInteger(entry.count)).toBe(true);
    }
  });

  /* ------------------------------------------------------------------ *
   * Detail panel
   * ------------------------------------------------------------------ */

  it(
    title('Clicking a role navigates to it and renders its staff table (TC-ROLE-05)', Tag.REGRESSION),
    async () => {
      await openRolesList();
      await rolesSettingsPage.openRole('partner');

      expect(await rolesSettingsPage.currentPath()).toMatch(/^\/settings\/roles\/[^/]+$/);
      expect(await rolesSettingsPage.isRoleActive('partner')).toBe(true);
      expect(await rolesSettingsPage.isDetailTableShown()).toBe(true);
      expect(await rolesSettingsPage.isDetailPlaceholderShown()).toBe(false);
    },
  );

  it(title('The staff table has its 3 columns (TC-ROLE-06)', Tag.REGRESSION), async () => {
    await openRole('partner');
    const header = await rolesSettingsPage.detailTableHeader();

    expect(header).toContain('Nick Name');
    expect(header).toContain('Phone Number');
    expect(header).toContain('Staff Code');
  });

  it(title('Each staff row links to the staff detail page (TC-ROLE-07)', Tag.REGRESSION), async () => {
    await openRole('owner');
    const hrefs = await rolesSettingsPage.detailStaffHrefs();

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/\/settings\/staffs\/[^/]+$/);
  });

  it(title('🐞 The role detail title renders empty (TC-ROLE-08)', Tag.REGRESSION), async () => {
    // Documented defect, reproduced on two roles. Expected once fixed: the role name.
    for (const role of ['owner', 'partner'] as const) {
      await openRole(role);
      const heading = await step(`Read the ${role} detail h1`, () => rolesSettingsPage.detailTitle());
      expect(heading).toBe('');
    }
  });

  it(title('🐞 Members Count disagrees with the table row count (TC-ROLE-09)', Tag.REGRESSION), async () => {
    const mismatches: string[] = [];
    for (const role of ['owner', 'partner'] as const) {
      await openRolesList();
      const badge = await rolesSettingsPage.memberCount(role);
      await rolesSettingsPage.openRole(role);
      const rows = await rolesSettingsPage.detailRowCount();
      if (badge !== rows) mismatches.push(`${role}: badge ${String(badge)} vs ${String(rows)} rows`);
    }
    // The doc saw BOTH roles off (Owner 11 vs 5, Partner 5 vs 1); the counts are data,
    // so the stable claim is that the badge and the table do not agree.
    expect(mismatches.length).toBeGreaterThan(0);
  });

  // The doc recorded an empty Phone column; build 1.1.56 fills it, so this now guards the fix.
  it(title('The Phone Number column is populated (TC-ROLE-10)', Tag.REGRESSION), async () => {
    await openRole('owner');
    const phones = await rolesSettingsPage.detailColumn(2);

    expect(phones.length).toBeGreaterThan(0);
    expect(phones.some((p) => /\(\d{3}\) \d{3}-\d{3,4}/.test(p))).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   * Assign dialog — opened, read, closed with Escape; never submitted
   * ------------------------------------------------------------------ */

  it(title('Assign to Role opens the dialog with Assign disabled (TC-ROLE-11)', Tag.REGRESSION), async () => {
    await withAssignDialog('partner', async () => {
      expect(await rolesSettingsPage.isAssignDialogShown()).toBe(true);
      expect(await rolesSettingsPage.assignDialogTitle()).toBe('Assign to Staff Role');
      expect(await rolesSettingsPage.isAssignEnabled()).toBe(false);
      expect(await rolesSettingsPage.hasAssignSearch()).toBe(true);
      expect((await rolesSettingsPage.assignItems()).length).toBeGreaterThan(0);
    });
  });

  it(
    title('Dialog items show checkbox, avatar, nickname and current-role badge (TC-ROLE-12)', Tag.REGRESSION),
    async () => {
      await withAssignDialog('partner', async () => {
        const items = await rolesSettingsPage.assignItems();

        expect(items.length).toBeGreaterThan(0);
        expect(items.every((i) => i.hasCheckbox)).toBe(true);
        expect(items.some((i) => i.avatarAlt !== null)).toBe(true);
        expect(items.some((i) => i.name !== '')).toBe(true);
        // Some items have no badge (TC-ROLE-18) — but every badge shown is a real role.
        const badges = items.map((i) => i.badge).filter((b): b is string => b !== null);
        expect(badges.length).toBeGreaterThan(0);
        expect(badges.every((b) => isRoleLabel(b))).toBe(true);
      });
    },
  );

  it(title('Staff already in the role are pre-ticked (TC-ROLE-13)', Tag.REGRESSION), async () => {
    await withAssignDialog('owner', async () => {
      const owners = (await rolesSettingsPage.assignItems()).filter((i) =>
        (ROLE_NAMES.owner as readonly string[]).includes(i.badge ?? ''),
      );

      expect(owners.length).toBeGreaterThan(0);
      expect(owners.filter((i) => !i.checked)).toEqual([]);
    });
  });

  it(title('Search filters by nickname, case-insensitively (TC-ROLE-14)', Tag.REGRESSION), async () => {
    await withAssignDialog('partner', async () => {
      await rolesSettingsPage.searchAssign('mai');
      const items = await rolesSettingsPage.assignItems();

      // The doc saw exactly one "Mai | Partner"; which staff match is merchant data,
      // so the stable claim is: at least one match, and every match contains "mai".
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) expect(item.name.toLowerCase()).toContain('mai');
    });
  });

  it(title('Ticking a staff member enables Assign (TC-ROLE-15)', Tag.REGRESSION), async () => {
    await withAssignDialog('partner', async () => {
      await rolesSettingsPage.searchAssign('mai');
      const before = await rolesSettingsPage.assignItems();
      expect(before.length).toBeGreaterThan(0);

      await rolesSettingsPage.toggleAssignItem(1);

      const after = await rolesSettingsPage.assignItems();
      // A pre-ticked member unticks instead; either way the selection changed.
      expect(after[0]?.checked).toBe(!before[0]?.checked);
      expect(await rolesSettingsPage.isAssignEnabled()).toBe(true);
    });
  });

  it(title('Escape closes the dialog and assigns nobody (TC-ROLE-16)', Tag.REGRESSION), async () => {
    await openRolesList();
    const badgesBefore = (await rolesSettingsPage.roleEntries()).map((e) => `${e.name}:${String(e.count)}`);
    await rolesSettingsPage.openRole('partner');
    const rowsBefore = await rolesSettingsPage.detailRowCount();

    await rolesSettingsPage.openAssignDialog();
    await rolesSettingsPage.searchAssign('mai');
    await rolesSettingsPage.toggleAssignItem(1);
    await rolesSettingsPage.closeAssignDialog();

    expect(await rolesSettingsPage.isAssignDialogShown()).toBe(false);
    expect(await rolesSettingsPage.detailRowCount()).toBe(rowsBefore);
    const badgesAfter = (await rolesSettingsPage.roleEntries()).map((e) => `${e.name}:${String(e.count)}`);
    expect(badgesAfter).toEqual(badgesBefore);
  });

  it(
    title('🐞 A dialog item renders without its name (Annie) (TC-ROLE-17)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      let annie: { name: string } | undefined;
      await withAssignDialog('partner', async () => {
        annie = (await rolesSettingsPage.assignItems()).find((i) => i.avatarAlt === 'Annie');
      });
      // Fixture from the scan's merchant; absent here means nothing to characterise.
      if (!annie) this.skip();
      expect(annie?.name).toBe('');
    },
  );

  it(
    title('⚠️ Some staff show no role badge (Beo, Beo11, Beo2222) (TC-ROLE-18)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      const targets = ['Beo', 'Beo11', 'Beo2222'];
      let found: Array<{ name: string; badge: string | null }> = [];
      await withAssignDialog('partner', async () => {
        found = (await rolesSettingsPage.assignItems()).filter((i) => targets.includes(i.name));
      });
      if (found.length === 0) this.skip();
      // Recorded as the doc saw it — confirm with the team whether these staff are
      // genuinely unassigned or the badge fails to render.
      expect(found.filter((i) => i.badge !== null)).toEqual([]);
    },
  );

  it(title('A search with no match empties the list (TC-ROLE-19)', Tag.REGRESSION), async () => {
    await withAssignDialog('partner', async () => {
      await rolesSettingsPage.searchAssign('zzzznotexist');
      expect(await rolesSettingsPage.assignItems()).toEqual([]);
    });
  });

  it(title('Switching to another role swaps the staff table (TC-ROLE-20)', Tag.REGRESSION), async () => {
    await openRole('owner');
    const ownerPath = await rolesSettingsPage.currentPath();
    const ownerStaff = await rolesSettingsPage.detailStaffHrefs();

    await rolesSettingsPage.openRole('staff');

    expect(await rolesSettingsPage.currentPath()).not.toBe(ownerPath);
    expect(await rolesSettingsPage.isRoleActive('staff')).toBe(true);
    expect(await rolesSettingsPage.detailStaffHrefs()).not.toEqual(ownerStaff);
  });
});
