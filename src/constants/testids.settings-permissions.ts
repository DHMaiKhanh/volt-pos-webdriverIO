/**
 * Permissions — `/settings/permissions`.
 *
 * Source: `docs/screens/settings-permissions/settings-permissions-test-cases.md`
 * (playwright-mcp scan, 2026-08-21) and the live DOM dump of build 1.1.56
 * (`reports/scans/2026-10-25-feature-inventory/dom/settings-permissions.json`).
 *
 * ## The matrix has no handles at all
 *
 * A permission row is a grid of one label `p` + four `[role="switch"]` (Owner,
 * Manager, Partner, Staff — fixed order). The switches carry no id, no testid and
 * no accessible name, so the matrix is read STRUCTURALLY by
 * `PermissionsSettingsPage.readMatrix()`: a row is the nearest ancestor of a
 * switch holding exactly four switches and some text. The CSS strings that walk
 * needs are {@link PERMISSION_DOM} below, so they still live in this catalogue.
 *
 * The doc's trap applies: `Cash Drawer` is a SUBSTRING of `Open Cash Drawer`, so a
 * row is only ever matched on its exact label (TC-PERM-23 proves it).
 *
 * ## Text fallbacks
 *
 * Vietnamese halves are from the i18n scan (`Truy cập`, `Chọn tất cả`,
 * `Mở rộng tất cả`, `Chủ`/`Quản lý`/`Đối tác`/`Nhân viên`). `Collapse All` and
 * `Unselect All` were never scanned in Vietnamese: `Thu gọn tất cả` /
 * `Bỏ chọn tất cả` are UNVERIFIED guesses — harmless on an English till, and the
 * first thing to check if a Vietnamese run cannot find the toggle.
 */

import { buttonWithAnyText, byRole, locator, textIsAnyOf, type Locator } from '../helpers/selectors.js';
import { ROLE_NAMES } from './testids.settings-roles.js';

export { ROLE_NAMES };

/** Header / button labels, EN + VI. */
export const PERMISSION_TEXT = {
  access: ['Access', 'Truy cập'],
  expandAll: ['Expand All', 'Mở rộng tất cả'],
  /** VI unverified — see the file note. */
  collapseAll: ['Collapse All', 'Thu gọn tất cả'],
  selectAll: ['Select All', 'Chọn tất cả'],
  /** VI unverified — see the file note. */
  unselectAll: ['Unselect All', 'Bỏ chọn tất cả'],
} as const satisfies Record<string, readonly [string, string]>;

/** Raw CSS handed to the in-page matrix walk (`browser.execute`). */
export const PERMISSION_DOM = {
  switch: '[role="switch"]',
  label: 'p',
  srOnly: '.sr-only',
  button: 'button:not([role="switch"])',
} as const;

export const PermissionsSettingsIds = {
  /** Level-1 heading (other settings screens use level 3 — TC-PERM-01). */
  heading: locator(
    'permissions heading',
    'settings-permissions-heading',
    '//h1[normalize-space()="Permissions" or normalize-space()="Quyền" or normalize-space()="Quyền hạn"]',
  ),
  /** Any heading carrying the title, whatever its level — to tell "missing" from "wrong level". */
  anyHeading: locator(
    'permissions heading (any level)',
    'settings-permissions-heading',
    textIsAnyOf('Permissions', 'Quyền', 'Quyền hạn'),
  ),

  accessHeader: locator(
    'access column header',
    'settings-permissions-header-access',
    textIsAnyOf(...PERMISSION_TEXT.access),
  ),

  /** The Expand All ⇄ Collapse All button — one element whose label flips. */
  expandToggle: locator(
    'expand / collapse all',
    'settings-permissions-expand-toggle',
    buttonWithAnyText(...PERMISSION_TEXT.expandAll, ...PERMISSION_TEXT.collapseAll),
  ),

  /** Every permission switch. Data-dependent — the readiness anchor. */
  switches: locator('permission switches', 'settings-permissions-switch-', byRole('switch')),

  /** Declared so TC-PERM-14 can prove its ABSENCE — the screen saves on every click. */
  saveOrApply: locator(
    'save / apply button',
    'settings-permissions-save',
    buttonWithAnyText('Save', 'Lưu', 'Apply', 'Áp dụng'),
  ),
} satisfies Record<string, Locator>;

/** A role's column-header label, e.g. `permissionRoleHeader(ROLE_NAMES.manager)`. */
export const permissionRoleHeader = (names: readonly string[]): Locator =>
  locator(
    `permissions header ${names[0] ?? ''}`,
    `settings-permissions-header-${(names[0] ?? '').toLowerCase()}`,
    // Not inside a link: in Vietnamese the settings sidebar's "Employees" entry
    // also reads "Nhân viên", the same as the Staff role.
    `//*[not(ancestor::a)][${names.map((n) => `normalize-space()="${n}"`).join(' or ')}]`,
  );

/** For the parent session to register with the audit script via `testids.ts`. */
export const SETTINGS_PERMISSIONS_LOCATOR_GROUPS: Record<string, Record<string, Locator>> = {
  PermissionsSettingsIds,
};
