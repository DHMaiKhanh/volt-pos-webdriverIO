/**
 * Employees (`/settings/staffs`, `/settings/staffs/$staffId`) — the list
 * (search, status filter), the five detail tabs, the screen-level Save gate and
 * the Create New Staff dialog.
 *
 * Covers TC-EMP-01..30 from
 * docs/screens/settings-staffs/settings-staffs-test-cases.md.
 *
 * ## Why this file never writes
 *
 * The detail has ONE Save shared by its five tabs and no case presses it; Create
 * New Staff is opened, read and dismissed with Escape, never submitted. The one
 * mutation is TC-EMP-23 typing into City to prove the Save gate — TC-EMP-24 then
 * discards it through the app's own leave-with-unsaved-changes guard, and the
 * `after` hook does the same as a backstop, so no staff record changes.
 *
 * ## Fixtures
 *
 * The doc was scanned with a staff member `Kevin` (code 0002, salary $2,000.00).
 * Merchant 14 on build 1.1.56 has no Kevin, so `before` picks the FIRST ACTIVE
 * staff in the list and the cases assert the doc's rules against that person
 * (prefill matches the row clicked, money fields are money-formatted, …) rather
 * than its literal values.
 *
 * ## Doc vs build
 *
 * - TC-EMP-24 says "reload". A document reload re-runs the whole splash boot, so
 *   the discard is done the way a cashier would leave — through the settings
 *   rail — and the router's unsaved-changes guard is answered with Confirm. The
 *   doc's "no warning on leave" holds only for a hard reload; in-app navigation
 *   DOES warn (`staff-detail-pending-update-confirm.tsx`).
 * - TC-EMP-18's "-" is the separator BETWEEN the two time pickers (their values
 *   are not innerText), not a missing time — the case asserts the pickers.
 * - TC-EMP-20 is a hardcoded string: `global.extraPermissionOnlyDescription`
 *   literally says "Manager" in both bundles. Asserted as the correct behaviour,
 *   so it fails until the app interpolates the real role — known bug.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../../src/constants/routes.js';
import { StaffsText } from '../../../src/constants/testids.settings-staffs.js';
import { goToSettings } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import settingsPage from '../../../src/pages/settings/SettingsPage.js';
import staffsSettingsPage from '../../../src/pages/settings/StaffsSettingsPage.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** Is `text` one of a bilingual pair? */
const isOneOf = (pair: readonly string[], text: string): boolean => pair.includes(text.trim());

/** The console noise the doc says this screen emits — never a test failure. */
const CONSOLE_WHITELIST: readonly RegExp[] = [
  /uncontrolled input to be controlled/i,
  /Switch is changing from uncontrolled to controlled/i,
  /Missing `?'?Description'?`? or `?'?aria-describedby'?`?/i,
  /ERR_UNKNOWN_URL_SCHEME|asset:\/\/localhost/i,
];

describe('Settings — Employees', () => {
  /** The staff member the detail cases run against (resolved in `before`). */
  let staff = '';
  /** City as loaded, captured by TC-EMP-23 so TC-EMP-24 can prove the discard. */
  let originalCity: string | null = null;

  /** On the staff list with nothing open, filter All, search empty. */
  async function onStaffsScreen(): Promise<void> {
    await staffsSettingsPage.closeAnything();
    if (!(await staffsSettingsPage.isActive())) {
      await goToSettings();
      await settingsPage.openSection('STAFFS');
    }
    await staffsSettingsPage.waitForReady(Timeouts.MEDIUM);
  }

  /** On the chosen staff member's detail. */
  async function onStaffDetail(): Promise<void> {
    await onStaffsScreen();
    await staffsSettingsPage.openStaff(staff);
  }

  /** Leave the detail, discarding any unsaved edit, and come back to the list. */
  async function discardAndReturn(): Promise<boolean> {
    const sawGuard = await staffsSettingsPage.leaveToSection(Routes.SETTINGS_SERVICES);
    await settingsPage.openSection('STAFFS');
    await staffsSettingsPage.waitForReady(Timeouts.MEDIUM);
    return sawGuard;
  }

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await goToSettings();
    await settingsPage.openSection('STAFFS');
    await staffsSettingsPage.waitForReady(Timeouts.MEDIUM);

    staff = await step('Pick the first active staff member', async () => {
      const first = (await staffsSettingsPage.staffRows()).find((row) =>
        isOneOf(StaffsText.active, row.status),
      );
      if (!first) throw new Error('No active staff member listed on /settings/staffs.');
      return first.name;
    });
  });

  beforeEach(async () => {
    await onStaffsScreen();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await staffsSettingsPage.closeAnything();
    // Backstop for TC-EMP-23: never leave a dirty staff form behind.
    if (
      (await staffsSettingsPage.isActive()) &&
      (await staffsSettingsPage.isSaveEnabled().catch(() => false))
    ) {
      await discardAndReturn();
    }
  });

  /* ------------------------------------------------------------------ *
   * List
   * ------------------------------------------------------------------ */

  it(
    title('The list renders its heading, controls and placeholder (TC-EMP-01)', Tag.REGRESSION),
    async () => {
      // The bare list route — a staff opened by an earlier case would hide the placeholder.
      await settingsPage.openSection('SERVICES');
      await settingsPage.openSection('STAFFS');

      expect(await staffsSettingsPage.isHeadingShown()).toBe(true);
      expect(await staffsSettingsPage.isReorderShown()).toBe(true);
      expect(await staffsSettingsPage.isCreateShown()).toBe(true);
      expect(await staffsSettingsPage.isSearchShown()).toBe(true);
      expect(isOneOf(StaffsText.all, await staffsSettingsPage.statusFilterText())).toBe(true);
      expect(await staffsSettingsPage.isSelectStaffPlaceholderShown()).toBe(true);
    },
  );

  it(
    title('Each staff row links to its detail and carries a status badge (TC-EMP-02)', Tag.REGRESSION),
    async () => {
      const rows = await staffsSettingsPage.staffRows();

      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.href).toMatch(/^\/settings\/staffs\/[^/]+$/);
        expect({
          name: row.name,
          badge: isOneOf([...StaffsText.active, ...StaffsText.inactive], row.status),
        }).toEqual({
          name: row.name,
          badge: true,
        });
      }
    },
  );

  it(title('The status filter offers All / Active / Inactive (TC-EMP-03)', Tag.REGRESSION), async () => {
    const options = await staffsSettingsPage.openStatusFilter();
    await staffsSettingsPage.closeAnything();

    expect(['All|Active|Inactive', 'Tất cả|Đang hoạt động|Ngưng hoạt động']).toContain(options.join('|'));
  });

  it(title('Filter Active keeps only active staff (TC-EMP-04)', Tag.REGRESSION), async () => {
    const total = (await staffsSettingsPage.staffRows()).length;

    try {
      await staffsSettingsPage.chooseStatusFilter(StaffsText.active);
      const rows = await staffsSettingsPage.staffRows();

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(total);
      expect(rows.filter((row) => !isOneOf(StaffsText.active, row.status))).toEqual([]);
    } finally {
      await staffsSettingsPage.chooseStatusFilter(StaffsText.all);
    }
  });

  it(title('Filter Inactive keeps only inactive staff (TC-EMP-05)', Tag.REGRESSION), async () => {
    try {
      await staffsSettingsPage.chooseStatusFilter(StaffsText.inactive);
      const rows = await staffsSettingsPage.staffRows();

      expect(rows.filter((row) => !isOneOf(StaffsText.inactive, row.status))).toEqual([]);
    } finally {
      await staffsSettingsPage.chooseStatusFilter(StaffsText.all);
    }
  });

  it(title('Search filters the list by name, case-insensitively (TC-EMP-06)', Tag.REGRESSION), async () => {
    const total = (await staffsSettingsPage.staffRows()).length;
    // The doc searched "kevin"; the equivalent here is the chosen staff's first word, lowercased.
    const query = (staff.split(/\s+/)[0] ?? staff).toLowerCase();

    try {
      await staffsSettingsPage.search(query);
      const rows = await staffsSettingsPage.staffRows();

      expect(rows.map((row) => row.name)).toContain(staff);
      expect(rows.length).toBeLessThanOrEqual(total);
      expect(rows.filter((row) => !row.name.toLowerCase().includes(query))).toEqual([]);
    } finally {
      await staffsSettingsPage.clearSearch();
    }
  });

  it(title('A search with no match leaves the list empty (TC-EMP-07)', Tag.REGRESSION), async () => {
    try {
      await staffsSettingsPage.search('zzzznotexist');
      expect(await staffsSettingsPage.staffRows()).toEqual([]);
    } finally {
      await staffsSettingsPage.clearSearch();
    }
  });

  /* ------------------------------------------------------------------ *
   * Detail — header & tabs
   * ------------------------------------------------------------------ */

  it(
    title('Clicking a staff member opens the detail with Save disabled (TC-EMP-08)', Tag.REGRESSION),
    async () => {
      const path = await staffsSettingsPage.openStaff(staff);

      expect(path).toMatch(/^\/settings\/staffs\/[^/]+$/);
      expect(await staffsSettingsPage.detailHeading()).toBe(staff);
      expect(await staffsSettingsPage.isSaveEnabled()).toBe(false);
    },
  );

  it(
    title('The detail has exactly five tabs, Information selected (TC-EMP-09)', Tag.REGRESSION),
    async () => {
      await onStaffDetail();

      const tabs = await staffsSettingsPage.tabs();
      const labels = tabs.map((tab) => tab.label).join('|');
      expect([StaffsText.tabsEn.join('|'), StaffsText.tabsVi.join('|')]).toContain(labels);
      expect(tabs[0]?.selected).toBe(true);
      expect(tabs.filter((tab) => tab.selected)).toHaveLength(1);
    },
  );

  /* ------------------------------------------------------------------ *
   * Information
   * ------------------------------------------------------------------ */

  it(title('The Information tab renders every profile field (TC-EMP-10)', Tag.REGRESSION), async () => {
    await onStaffDetail();

    expect(await staffsSettingsPage.missingInfoFields()).toEqual([]);
  });

  it(
    title('Nickname and Staff Code prefill from the staff clicked (TC-EMP-11)', Tag.REGRESSION),
    async () => {
      await onStaffDetail();

      // The list row shows the nickname — the doc's "Kevin / 0002".
      expect(await staffsSettingsPage.nicknameValue()).toBe(staff);
      expect(await staffsSettingsPage.staffCodeValue()).toMatch(/^\d{4}$/);
    },
  );

  /* ------------------------------------------------------------------ *
   * Compensation
   * ------------------------------------------------------------------ */

  it(title('Compensation offers the three pay modes (TC-EMP-12)', Tag.REGRESSION), async () => {
    await onStaffDetail();
    await staffsSettingsPage.openTab(1);

    const text = await staffsSettingsPage.activePanelText();
    for (const pair of [StaffsText.commission, StaffsText.commissionSalary, StaffsText.salary]) {
      expect({ mode: pair[0], shown: pair.some((label) => text.includes(label)) }).toEqual({
        mode: pair[0],
        shown: true,
      });
    }
  });

  it(
    title('The salary type is one of three radios, exactly one checked (TC-EMP-13)', Tag.REGRESSION),
    async () => {
      await onStaffDetail();
      await staffsSettingsPage.openTab(1);

      expect(await staffsSettingsPage.ensureSalaryControls()).toBe(true);
      const states = await staffsSettingsPage.salaryTypeStates();
      // The doc's Kevin is on salary-by-period; this merchant's staff may differ,
      // so the invariant is "a radio group": exactly one of the three is on.
      expect(Object.values(states).filter(Boolean)).toHaveLength(1);
      expect(await staffsSettingsPage.isSaveEnabled()).toBe(false);
    },
  );

  it(
    title('Money fields show $ and separators; percents are bare numbers (TC-EMP-14)', Tag.REGRESSION),
    async () => {
      await onStaffDetail();
      await staffsSettingsPage.openTab(1);
      await staffsSettingsPage.ensureSalaryControls();

      const values = await staffsSettingsPage.compensationValues();
      expect(values.salaryAmount).toMatch(/^\$\d{1,3}(,\d{3})*\.\d{2}$/);
      expect(values.deductionPerDay).toMatch(/^\$\d{1,3}(,\d{3})*\.\d{2}$/);
      expect(values.cashCheckSplit).toMatch(/^\d+$/);
      expect(values.percentCreditCardTip).toMatch(/^\d+$/);
    },
  );

  it(
    title('The Exclude-Tips-From-Cash/Check switch is present and off (TC-EMP-15)', Tag.REGRESSION),
    async () => {
      await onStaffDetail();
      await staffsSettingsPage.openTab(1);

      const tip = await staffsSettingsPage.payrollTipSwitch();
      expect(tip.present).toBe(true);
      expect(StaffsText.excludeTips.some((label) => tip.label.includes(label))).toBe(true);
      expect(tip.checked).toBe('false');
    },
  );

  /* ------------------------------------------------------------------ *
   * Service Skills / Work Hours / Permissions
   * ------------------------------------------------------------------ */

  it(
    title('Service Skills groups toggleable services under categories (TC-EMP-16)', Tag.REGRESSION),
    async () => {
      await onStaffDetail();
      await staffsSettingsPage.openTab(2);

      const skills = await staffsSettingsPage.serviceSkills();
      // One checkbox per category header, plus a toggle per service.
      expect(skills.checkboxes).toBeGreaterThan(0);
      expect(skills.toggles + skills.checkboxes).toBeGreaterThan(1);
      expect(skills.text.length).toBeGreaterThan(0);
    },
  );

  it(
    title('Work Hours has seven weekday switches and Sync with Business Hours (TC-EMP-17)', Tag.REGRESSION),
    async () => {
      await onStaffDetail();
      await staffsSettingsPage.openTab(3);

      const days = await staffsSettingsPage.workHours();
      expect(days.map((d) => d.day)).toEqual([
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]);
      expect(await staffsSettingsPage.isSyncBusinessHoursShown()).toBe(true);
    },
  );

  it(title('Every day switched on has its two times set (TC-EMP-18)', Tag.REGRESSION), async () => {
    await onStaffDetail();
    await staffsSettingsPage.openTab(3);

    // ⚠️ in the doc ("ON but the range is -"): the "-" is the separator between
    // the pickers. What matters is that an open day carries a start and an end.
    for (const day of (await staffsSettingsPage.workHours()).filter((d) => d.on)) {
      expect({
        day: day.day,
        times: day.times.length,
        blank: day.times.filter((t) => t === '').length,
      }).toEqual({
        day: day.day,
        times: 2,
        blank: 0,
      });
    }
  });

  it(
    title('Permissions shows the assigned role and its description (TC-EMP-19)', Tag.REGRESSION),
    async () => {
      await onStaffDetail();
      await staffsSettingsPage.openTab(4);

      const perms = await staffsSettingsPage.permissions();
      expect(StaffsText.assignedRole.some((label) => perms.text.includes(label))).toBe(true);
      expect(StaffsText.assignedRoleDescription.some((label) => perms.text.includes(label))).toBe(true);
      expect(perms.role.length).toBeGreaterThan(0);
    },
  );

  it(
    title("The Extra Permission note names the staff's real role — known bug (TC-EMP-20)", Tag.REGRESSION),
    async () => {
      await onStaffDetail();
      await staffsSettingsPage.openTab(4);

      const perms = await staffsSettingsPage.permissions();
      expect(StaffsText.extraPermissionOnly.some((label) => perms.text.includes(label))).toBe(true);
      // The note is the hardcoded "…not included in the Manager role…". For a
      // staff member whose role is not Manager that is wrong.
      if (!/^(manager|quản lý)$/i.test(perms.role)) {
        expect(perms.text).not.toMatch(/not included in the Manager role|không có trong vai trò Quản lý/);
        expect(perms.text).toContain(perms.role);
      }
    },
  );

  it(
    title('The extra-permission tree has switches, one column only (TC-EMP-21)', Tag.REGRESSION),
    async () => {
      await onStaffDetail();
      await staffsSettingsPage.openTab(4);

      // The doc counted 14 for a Staff-role member; the count is role-dependent
      // (only permissions the role lacks are listed), so pin "some, and not doubled".
      const { switches } = await staffsSettingsPage.permissions();
      expect(switches).toBeGreaterThan(0);
      expect(switches).toBeLessThanOrEqual(40);
    },
  );

  /* ------------------------------------------------------------------ *
   * Save gate
   * ------------------------------------------------------------------ */

  it(title('Visiting all five tabs does not make the form dirty (TC-EMP-22)', Tag.REGRESSION), async () => {
    await onStaffDetail();

    for (let tab = 0; tab < 5; tab += 1) await staffsSettingsPage.openTab(tab);
    await staffsSettingsPage.openTab(0);

    expect(await staffsSettingsPage.isSaveEnabled()).toBe(false);
  });

  it(title('Editing a field makes the form dirty and enables Save (TC-EMP-23)', Tag.REGRESSION), async () => {
    await onStaffDetail();
    originalCity = await staffsSettingsPage.cityValue();

    await staffsSettingsPage.setCity('QA City');

    expect(await staffsSettingsPage.cityValue()).toBe('QA City');
    expect(await staffsSettingsPage.isSaveEnabled()).toBe(true);
    // NOT saved — TC-EMP-24 discards it (and `after` backstops).
  });

  it(title('Leaving discards the unsaved edit (TC-EMP-24)', Tag.REGRESSION), async () => {
    if (originalCity === null || !(await staffsSettingsPage.isSaveEnabled().catch(() => false))) {
      // Self-sufficient when TC-EMP-23 did not leave the form dirty.
      await onStaffDetail();
      originalCity = await staffsSettingsPage.cityValue();
      await staffsSettingsPage.setCity('QA City');
    }

    const sawGuard = await step('Leave through the settings rail, discarding', discardAndReturn);
    await staffsSettingsPage.openStaff(staff);

    expect(await staffsSettingsPage.cityValue()).toBe(originalCity);
    expect(await staffsSettingsPage.isSaveEnabled()).toBe(false);
    // In-app navigation with a dirty form is guarded (unlike the doc's hard reload).
    expect(sawGuard).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   * Create New Staff — never submitted
   * ------------------------------------------------------------------ */

  it(title('Create New Staff shows every field and select (TC-EMP-25)', Tag.REGRESSION), async () => {
    await staffsSettingsPage.openCreateDialog();

    expect(isOneOf(StaffsText.createNewStaff, await staffsSettingsPage.dialogTitle())).toBe(true);
    expect(await staffsSettingsPage.missingCreateInputs()).toEqual([]);
    const text = await staffsSettingsPage.dialogText();
    for (const pair of [StaffsText.selectEmployeeGroup, StaffsText.selectCountry, StaffsText.selectState]) {
      expect({ select: pair[0], shown: pair.some((label) => text.includes(label)) }).toEqual({
        select: pair[0],
        shown: true,
      });
    }
    // The role select defaults to the "Staff" role (role names are data).
    expect(text).toMatch(/\bStaff\b|Nhân viên/);

    await staffsSettingsPage.closeDialogWithEscape();
  });

  it(title('State stays disabled until a Country is chosen (TC-EMP-26)', Tag.REGRESSION), async () => {
    await staffsSettingsPage.openCreateDialog();

    expect(await staffsSettingsPage.isCreateStateDisabled()).toBe(true);

    await staffsSettingsPage.closeDialogWithEscape();
  });

  it(
    title('Create is enabled on an empty form — validation on submit (TC-EMP-27)', Tag.REGRESSION),
    async () => {
      await staffsSettingsPage.openCreateDialog();

      // ⚠️ in the doc: documents today's behaviour. Not pressed — an empty submit
      // that slipped past validation would create a real staff record.
      expect(await staffsSettingsPage.isCreateEnabled()).toBe(true);

      await staffsSettingsPage.closeDialogWithEscape();
    },
  );

  it(title('Escape closes Create New Staff without adding anyone (TC-EMP-28)', Tag.REGRESSION), async () => {
    const before = (await staffsSettingsPage.staffRows()).length;

    await staffsSettingsPage.openCreateDialog();
    await staffsSettingsPage.closeDialogWithEscape();

    expect(await staffsSettingsPage.isDialogOpen()).toBe(false);
    expect((await staffsSettingsPage.staffRows()).length).toBe(before);
  });

  it(title('Create New Staff placeholders are as specified (TC-EMP-29)', Tag.REGRESSION), async () => {
    await staffsSettingsPage.openCreateDialog();
    const placeholders = await staffsSettingsPage.createPlaceholders();
    await staffsSettingsPage.closeDialogWithEscape();

    expect(['e.g. Jenny', 'VD: Jenny']).toContain(placeholders.firstName);
    expect(['e.g. Nguyen', 'VD: Nguyễn']).toContain(placeholders.lastName);
    expect(['e.g. Jen', 'VD: Jen']).toContain(placeholders.nickname);
    expect(['Enter 4 digit code', 'Nhập mã 4 chữ số']).toContain(placeholders.staffCode);
    expect(['Enter 5 digit zip code', 'Nhập mã ZIP 5 chữ số']).toContain(placeholders.postalCode);
    expect(['e.g. 2799 Katy Fwy .Ste. 130', 'VD: 2799 Katy Fwy .Ste. 130']).toContain(placeholders.address);
  });

  /* ------------------------------------------------------------------ *
   * Console noise
   * ------------------------------------------------------------------ */

  it(
    title(
      'Opening a staff detail logs only the known, whitelisted console noise (TC-EMP-30)',
      Tag.REGRESSION,
    ),
    async () => {
      await staffsSettingsPage.startConsoleCapture();

      // Re-mount the screen so its render-time warnings fire under the hook.
      await staffsSettingsPage.leaveToSection(Routes.SETTINGS_SERVICES);
      await settingsPage.openSection('STAFFS');
      await staffsSettingsPage.waitForReady(Timeouts.MEDIUM);
      await staffsSettingsPage.openStaff(staff);
      await staffsSettingsPage.openCreateDialog();
      await staffsSettingsPage.closeDialogWithEscape();

      const captured = await staffsSettingsPage.readConsoleCapture();
      const unexpected = captured
        .filter((entry) => entry.level === 'error')
        .filter((entry) => !CONSOLE_WHITELIST.some((pattern) => pattern.test(entry.text)))
        .map((entry) => entry.text.slice(0, 200));

      // The doc's four messages are dev-build React warnings plus the Tauri
      // `asset://` avatar; anything ELSE logged as an error is a finding.
      expect(unexpected).toEqual([]);
    },
  );
});
