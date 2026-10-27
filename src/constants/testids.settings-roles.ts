/**
 * Roles — `/settings/roles` and `/settings/roles/$roleId`.
 *
 * Source: `docs/screens/settings-roles/settings-roles-test-cases.md` (playwright-mcp
 * scan, 2026-08-21) and the live DOM dump of build 1.1.56
 * (`reports/scans/2026-10-25-feature-inventory/dom/settings-roles.json`).
 *
 * ## No testids on this screen
 *
 * Build 1.1.56 ships none, and the code-detail doc names none, so every testid
 * below is the id this suite will ASK for (`settings-roles-<thing>`), paired with
 * a structural fallback. The one structural handle the screen does have is the
 * role link's `href`: TanStack renders `<a href="/settings/roles/<uuid>">`, which
 * does not translate. The settings sidebar's own Roles entry is the EXACT
 * `href="/settings/roles"`, so `^=` on the trailing slash never matches it.
 *
 * ## Text fallbacks
 *
 * The Vietnamese halves come from the i18n scan in the code-detail doc (`Vai trò`,
 * `Số thành viên`, `Chọn vai trò để xem chi tiết.`, `Chủ` / `Quản lý` / `Đối tác`
 * / `Nhân viên`). The Assign dialog was never scanned in Vietnamese, so its
 * strings are English-only — flagged where used.
 */

import { buttonContainingAnyText, byRole, locator, textIsAnyOf, type Locator } from '../helpers/selectors.js';

/** The four fixed system roles, EN + VI, in the order the doc lists them. */
export const ROLE_NAMES = {
  owner: ['Owner', 'Chủ'],
  manager: ['Manager', 'Quản lý'],
  partner: ['Partner', 'Đối tác'],
  staff: ['Staff', 'Nhân viên'],
} as const satisfies Record<string, readonly [string, string]>;

export type RoleKey = keyof typeof ROLE_NAMES;

/** Every role label in both languages — what a role badge's text can be. */
export const ALL_ROLE_LABELS: readonly string[] = Object.values(ROLE_NAMES).flat();

/** `11 Members` / `11 Thành viên` — the count line of a role link. */
export const MEMBERS_COUNT_PATTERN = /^(\d+)\s+(Members|Thành viên|thành viên)$/;

const ROLE_HREF_PREFIX = '/settings/roles/';

export const RolesSettingsIds = {
  heading: locator(
    'roles heading',
    'settings-roles-heading',
    '//h1[normalize-space()="Roles" or normalize-space()="Vai trò"]',
    textIsAnyOf('Roles', 'Vai trò'),
  ),

  /** Every role entry in the left list. Data-dependent — the readiness anchor. */
  roleLinks: locator('role links', 'settings-roles-item-', `a[href^="${ROLE_HREF_PREFIX}"]`),

  /** The list's column headers — `p` elements per the scan. */
  listHeaderRole: locator(
    'role column header',
    'settings-roles-header-role',
    '//p[normalize-space()="Role" or normalize-space()="Vai trò"]',
  ),
  listHeaderMembers: locator(
    'members count column header',
    'settings-roles-header-members',
    '//p[normalize-space()="Members Count" or normalize-space()="Số thành viên"]',
    textIsAnyOf('Members Count', 'Số thành viên'),
  ),

  /** Right panel before any role is chosen. */
  detailPlaceholder: locator(
    'select-a-role placeholder',
    'settings-roles-detail-placeholder',
    textIsAnyOf('Select a Role to view details.', 'Chọn vai trò để xem chi tiết.'),
  ),

  /**
   * A "create role" affordance — declared so TC-ROLE-01 can prove its ABSENCE.
   * The roles are fixed; the app has no such button and none is being requested.
   */
  createRoleButton: locator(
    'create role button',
    'settings-roles-create',
    buttonContainingAnyText('Create Role', 'Add Role', 'New Role', 'Tạo vai trò', 'Thêm vai trò'),
  ),

  /** `Assign to Role` on the detail panel. English-only: not covered by the i18n scan. */
  assignToRoleButton: locator(
    'assign to role button',
    'settings-roles-assign-btn',
    buttonContainingAnyText('Assign to Role'),
  ),

  /** The detail panel's staff table — the only `table` on the screen. */
  detailTable: locator('role staff table', 'settings-roles-staff-table', 'table', byRole('table')),
  detailTableHead: locator('role staff table head', 'settings-roles-staff-thead', 'table thead'),
  detailRows: locator('role staff rows', 'settings-roles-staff-row-', 'table tbody tr'),
  /** Every cell is a link to `/settings/staffs/<staffId>`. */
  detailStaffLinks: locator(
    'role staff links',
    'settings-roles-staff-link-',
    'table tbody a[href*="/settings/staffs/"]',
  ),

  /**
   * The detail panel's `h1` (renders EMPTY on 1.1.56 — TC-ROLE-08).
   *
   * Reached as "the h1 nearest the staff table that is not the list's Roles
   * heading": an empty heading has no text to match on, so the table is the anchor.
   */
  detailTitle: locator(
    'role detail title',
    'settings-roles-detail-title',
    '(//table/ancestor::*[.//h1][1]//h1[not(normalize-space()="Roles" or normalize-space()="Vai trò")])[1]',
  ),

  /* --- "Assign to Staff Role" dialog --- */

  assignDialog: locator(
    'assign to staff role dialog',
    'settings-roles-assign-dialog',
    '//*[@role="dialog"][.//input]',
    byRole('dialog'),
  ),
  assignDialogTitle: locator(
    'assign dialog title',
    'settings-roles-assign-dialog-title',
    '//*[@role="dialog"]//h2',
    '[role="dialog"] [data-slot="dialog-title"]',
  ),
  assignSearch: locator(
    'assign dialog search',
    'settings-roles-assign-search',
    `[role="dialog"] input[placeholder="Search for staff's nickname, first name or last name"]`,
    '[role="dialog"] input[type="text"]',
    '[role="dialog"] input',
  ),
  /** The dialog's `Assign` submit. English-only — the dialog was never scanned in VI. */
  assignSubmit: locator(
    'assign dialog submit',
    'settings-roles-assign-submit',
    '//*[@role="dialog"]//button[normalize-space()="Assign"]',
    '//*[@role="dialog"]//button[@type="submit"]',
  ),
  /** One `li` per staff member: checkbox + avatar + nickname + current-role badge. */
  assignItems: locator('assign dialog items', 'settings-roles-assign-item-', '//*[@role="dialog"]//li'),
  /** The checkbox INSIDE one item — always used with `within: <li>`, so CSS only. */
  assignItemCheckbox: locator(
    'assign item checkbox',
    'settings-roles-assign-item-checkbox',
    '[role="checkbox"]',
    'input[type="checkbox"]',
  ),
} satisfies Record<string, Locator>;

/**
 * One role link by name, e.g. `roleLink(ROLE_NAMES.partner)`.
 *
 * The link holds the name and the count as separate children; the first fallback
 * matches the name child exactly, the second the link's leading text, so `Staff`
 * never matches a link that merely mentions staff.
 */
export const roleLink = (names: readonly string[]): Locator => {
  const exact = names.map((n) => `normalize-space()="${n}"`).join(' or ');
  const leading = names.map((n) => `starts-with(normalize-space(),"${n} ")`).join(' or ');
  return locator(
    `role link ${names[0] ?? ''}`,
    `settings-roles-item-${(names[0] ?? '').toLowerCase()}`,
    `//a[starts-with(@href,"${ROLE_HREF_PREFIX}")][.//*[${exact}]]`,
    `//a[starts-with(@href,"${ROLE_HREF_PREFIX}")][${leading}]`,
  );
};

/** For the parent session to register with the audit script via `testids.ts`. */
export const SETTINGS_ROLES_LOCATOR_GROUPS: Record<string, Record<string, Locator>> = {
  RolesSettingsIds,
};
