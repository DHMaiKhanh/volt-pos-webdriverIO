/**
 * volt-qc port — 11-settings: Services & Products (category lists, tables,
 * dialogs) and Employees (list, detail tabs, Information validation, Work
 * Hours sync).
 *
 * Source: volt-qc `e2e/tests/11-settings/set-plan-readonly-general.spec.ts`
 * and `set-plan-readonly-business.spec.ts` (`@readonly` cases). TC
 * definitions: docs/qc/volt-qc/windows-regression/11-settings.md.
 *
 * ## Read-only
 *
 * No Create / Update / Add / Save is pressed. Dialogs are validated and closed;
 * a dirty staff form is thrown away by leaving through the rail and confirming
 * the guard (`staffsSettingsPage.leaveToSection`). The staff under test is the
 * first active one listed; the duplicate checks borrow the second.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { Routes } from '../../../../src/constants/routes.js';
import { ServicesText } from '../../../../src/constants/testids.settings-services.js';
import { StaffsText } from '../../../../src/constants/testids.settings-staffs.js';
import {
  Vq,
  VqScope,
  VqServices,
  VqStaff,
  type VqQuery,
} from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import businessInfoPage from '../../../../src/pages/settings/BusinessInfoPage.js';
import servicesSettingsPage, {
  type CategoryRow,
} from '../../../../src/pages/settings/ServicesSettingsPage.js';
import staffsSettingsPage from '../../../../src/pages/settings/StaffsSettingsPage.js';
import {
  dismissOverlays,
  openBusinessVq,
  openSettingsVq,
} from '../../../../src/pages/voltqc/settings-devm/nav.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const SYSTEM_NAMES = ['Gift Card', 'Quick Pay'];

/** Every category of the current tab, scrolling the virtualised list top to bottom. */
async function collectCategories(): Promise<CategoryRow[]> {
  const seen = new Map<string, CategoryRow>();
  await vqProbe.scroll(VqServices.categoryLinks(), 'top');
  for (let i = 0; i < 40; i += 1) {
    for (const row of await servicesSettingsPage.categoryRows())
      if (!seen.has(row.name)) seen.set(row.name, row);
    if (!(await vqProbe.scroll(VqServices.categoryLinks(), 'step'))) break;
  }
  for (const row of await servicesSettingsPage.categoryRows())
    if (!seen.has(row.name)) seen.set(row.name, row);
  await vqProbe.scroll(VqServices.categoryLinks(), 'top');
  return [...seen.values()];
}

/** The validation message under a labelled field, polled until it equals `expected`. */
async function messageUnder(
  query: VqQuery,
  expected: string,
  timeout = Timeouts.ANIMATION * 4,
): Promise<string> {
  return vqProbe.poll(() => vqProbe.fieldMessage(query), expected, timeout);
}

describe('volt-qc SET — Services & Products, Employees (read-only)', () => {
  /** First and second active staff on /settings/staffs (resolved in `before`). */
  let staff = '';
  let otherStaff = '';

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await openSettingsVq('STAFFS');
    await staffsSettingsPage.waitForReady(Timeouts.MEDIUM);
    const active = (await staffsSettingsPage.staffRows()).filter((row) =>
      (StaffsText.active as readonly string[]).includes(row.status),
    );
    staff = active[0]?.name ?? '';
    otherStaff = active[1]?.name ?? '';
  });

  afterEach(async () => {
    await servicesSettingsPage.closeAnything().catch(() => undefined);
    await dismissOverlays().catch(() => undefined);
    if (await staffsSettingsPage.isActive()) {
      await staffsSettingsPage.leaveToSection(Routes.SETTINGS_LANGUAGE).catch(() => undefined);
    }
  });

  /* ------------------------------------------------------------------ *
   * Services & Products
   * ------------------------------------------------------------------ */

  it(
    title(
      'Services: Active tab ends with Other (no Update); Gift Card / Quick Pay only as ordinary categories; Inactive has no Other / Quick Pay (SET-128, SET-129)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('SERVICES');
      expect(await vqProbe.isShown(VqServices.reorderButton(), Timeouts.MEDIUM)).toBe(true);
      expect(await servicesSettingsPage.isSelectCategoryPlaceholderShown()).toBe(true);

      const active = await collectCategories();
      expect(active.at(-1)?.name).toBe('Other');
      expect(active.find((row) => row.name === 'Other')?.hasUpdate).toBe(false);
      for (const row of active.filter((r) => SYSTEM_NAMES.includes(r.name))) {
        // A user-made category may share the name; the system one would have no Update.
        expect({ category: row.name, hasUpdate: row.hasUpdate }).toEqual({
          category: row.name,
          hasUpdate: true,
        });
      }

      await servicesSettingsPage.selectCategoryTab('inactive');
      try {
        const inactive = (await collectCategories()).map((row) => row.name);
        expect(inactive).not.toContain('Other');
        expect(inactive.filter((name) => name === 'Quick Pay')).toEqual([]);
      } finally {
        await servicesSettingsPage.selectCategoryTab('active');
      }
    },
  );

  it(
    title(
      'Services: a service table has its columns and the status filter narrows rows; Other has no Active Status column (SET-130)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('SERVICES');
      const name = await servicesSettingsPage.openFirstServiceCategory(['Other', ...SYSTEM_NAMES]);
      expect(await servicesSettingsPage.detailHeading()).toBe(name);
      const headers = await servicesSettingsPage.tableHeaders();
      for (const header of [
        'Service name & Description',
        'Price',
        'Duration',
        'Supply Fee',
        'Active Status',
        'Action',
      ]) {
        expect({ header, shown: headers.includes(header) }).toEqual({ header, shown: true });
      }

      try {
        await servicesSettingsPage.chooseStatusFilter(ServicesText.inactive);
        for (const row of await servicesSettingsPage.rows()) {
          expect({ row: row.name, on: row.switchOn }).toEqual({ row: row.name, on: false });
        }
        await servicesSettingsPage.chooseStatusFilter(ServicesText.active);
        for (const row of await servicesSettingsPage.rows()) {
          expect({ row: row.name, on: row.switchOn }).toEqual({ row: row.name, on: true });
        }
      } finally {
        await servicesSettingsPage.chooseStatusFilter(ServicesText.all);
      }

      await step('Other: no Active Status column', async () => {
        await servicesSettingsPage.openCategory('Other');
        expect(['Other', 'Unnamed Category']).toContain(await servicesSettingsPage.detailHeading());
        expect(await servicesSettingsPage.tableHeaders()).not.toContain('Active Status');
      });
    },
  );

  it(
    title('Services: the Products category table has no Duration / Supply Fee (SET-131)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      await openSettingsVq('SERVICES');
      let found = false;
      for (const name of (await servicesSettingsPage.categoryNames()).slice(0, 25)) {
        await servicesSettingsPage.openCategory(name);
        if ((await servicesSettingsPage.detailHeading()) === 'Products') {
          found = true;
          break;
        }
      }
      if (!found) this.skip(); // this merchant has no Products category yet
      const headers = await servicesSettingsPage.tableHeaders();
      for (const header of ['Product name & Description', 'Price', 'Active Status', 'Action']) {
        expect({ header, shown: headers.includes(header) }).toEqual({ header, shown: true });
      }
      expect(headers.filter((h) => h === 'Duration' || h === 'Supply Fee')).toEqual([]);
    },
  );

  it(
    title(
      'Services: Create Category validation (no Create), Update Category closes without saving, Reorder dialog pins Quick Pay / Gift Card (SET-133, SET-134, SET-150)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('SERVICES');
      const before = await collectCategories();
      const existing = before
        .map((row) => row.name)
        .find((name) => name !== 'Other' && !SYSTEM_NAMES.includes(name));

      await step('Create Category: name validation, Create stays disabled', async () => {
        await servicesSettingsPage.openCreateCategory();
        expect(await servicesSettingsPage.dialogTitle()).toBe('Create Category');
        const input = Vq.placeholder('e.g. Manicure', VqScope.dialog);
        const check = async (value: string, expected: string): Promise<void> => {
          await vqProbe.fill(input, value);
          const shown = value.length > 20 ? `${String(value.length)} chars` : `"${value}"`;
          expect({ value: shown, message: await messageUnder(input, expected, Timeouts.SHORT) }).toEqual({
            value: shown,
            message: expected,
          });
        };
        await check('x', '');
        await check('', 'Category name is required');
        await check('K'.repeat(51), 'Category name must be less than 50 characters');
        await check('K'.repeat(50), '');
        if (existing) await check(existing, 'Category name already exists');
        await check('Product', 'Cannot use this category name');
        await check('other', 'Cannot use this category name');
        expect(await servicesSettingsPage.isSubmitEnabled('create')).toBe(false);
        await servicesSettingsPage.closeDialogWithEscape();
        expect((await collectCategories()).map((row) => row.name)).toEqual(before.map((row) => row.name));
      });

      if (existing) {
        await step('Update Category: prefilled; an edit closed without Update is dropped', async () => {
          await servicesSettingsPage.openUpdateCategory(existing);
          expect(await servicesSettingsPage.dialogNameValue()).toBe(existing);
          await vqProbe.fill(Vq.placeholder('e.g. Manicure', VqScope.dialog), 'QC Tmp Category');
          await servicesSettingsPage.closeDialogWithEscape();
          await servicesSettingsPage.openUpdateCategory(existing);
          expect(await servicesSettingsPage.dialogNameValue()).toBe(existing);
          await servicesSettingsPage.closeDialogWithEscape();
        });
      }

      await step(
        'Reorder dialog: Quick Pay and Gift Card pinned, All services tab, close changes nothing',
        async () => {
          await servicesSettingsPage.openReorder();
          expect((await servicesSettingsPage.reorderTabs()).map((tab) => tab.label)).toContain('Category');
          expect(await vqProbe.isShown(Vq.text('Quick Pay', VqScope.dialog), Timeouts.MEDIUM)).toBe(true);
          expect(await vqProbe.isShown(Vq.text('Gift Card', VqScope.dialog))).toBe(true);
          const pinnedButDraggable = (await servicesSettingsPage.reorderCards('preview')).filter(
            (card) => SYSTEM_NAMES.includes(card.name) && card.count === null && card.draggable,
          );
          expect(pinnedButDraggable).toEqual([]);
          await servicesSettingsPage.selectReorderTab(ServicesText.allServices);
          expect(
            (await servicesSettingsPage.reorderTabs()).find((tab) => tab.label === 'All services')?.selected,
          ).toBe(true);
          await servicesSettingsPage.closeDialogWithEscape();
          expect(await servicesSettingsPage.isDialogOpen()).toBe(false);
        },
      );
    },
  );

  it(
    title(
      'Add New Item (no Add): name / description limits, Category Name prefilled, Flexible Pricing locks the price, Duration 0-8 h / 0-55 min, Inactive locks "Shown on" (SET-137, SET-138, SET-140, SET-141, SET-142)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('SERVICES');
      const category = await servicesSettingsPage.openFirstServiceCategory(['Other', ...SYSTEM_NAMES]);
      await servicesSettingsPage.openAddItem();
      expect(await servicesSettingsPage.dialogTitle()).toBe('Add New Item');

      try {
        await step('Service name: required, max 50', async () => {
          const name = Vq.placeholder('Enter service name', VqScope.dialog);
          await vqProbe.fill(name, 'x');
          await vqProbe.fill(name, '');
          expect(await vqProbe.isShown(Vq.text('Service name is required', VqScope.dialog))).toBe(true);
          await vqProbe.fill(name, 'S'.repeat(51));
          expect(
            await vqProbe.isShown(Vq.text('Service name must be less than 50 characters', VqScope.dialog)),
          ).toBe(true);
          await vqProbe.fill(name, 'S'.repeat(50));
          expect(
            await vqProbe.isGone(Vq.text('Service name must be less than 50 characters', VqScope.dialog)),
          ).toBe(true);
        });

        await step('Category Name is prefilled with the open category', async () => {
          expect(await vqProbe.textOf(VqServices.categorySelect())).toContain(category);
        });

        await step('Description: max 255', async () => {
          const desc = Vq.placeholder('Enter service description', VqScope.dialog);
          await vqProbe.fill(desc, 'D'.repeat(256));
          expect(
            await vqProbe.isShown(
              Vq.text('Service description must be less than 255 characters', VqScope.dialog),
            ),
          ).toBe(true);
          await vqProbe.fill(desc, 'D'.repeat(255));
          expect(
            await vqProbe.isGone(
              Vq.text('Service description must be less than 255 characters', VqScope.dialog),
            ),
          ).toBe(true);
        });

        await step('Flexible Pricing locks the price; Duration options', async () => {
          await vqProbe.setChecked(VqServices.flexiblePricing(), true);
          expect(await servicesSettingsPage.isPriceDisabled()).toBe(true);
          await vqProbe.setChecked(VqServices.flexiblePricing(), false);
          expect(await servicesSettingsPage.isPriceDisabled()).toBe(false);

          const options = async (which: 0 | 1): Promise<string[]> => {
            await vqProbe.press(VqServices.durationSelect(which));
            await vqProbe.waitShown(Vq.anyOption(), Timeouts.SHORT);
            const list = await vqProbe.texts(Vq.anyOption());
            await vqProbe.pressKey('Escape');
            return list;
          };
          expect(await options(0)).toEqual([
            '0 hours',
            '1 hour',
            ...Array.from({ length: 7 }, (_, i) => `${String(i + 2)} hours`),
          ]);
          expect(await options(1)).toEqual(Array.from({ length: 12 }, (_, i) => `${String(i * 5)} mins`));
        });

        await step('Status Inactive locks the three "Shown on" switches', async () => {
          await vqProbe.setChecked(VqServices.visibilityStatusSwitch(), false);
          for (const label of ['Shown on Web Booking', 'Shown on Go Checkin', 'Shown on Go POS']) {
            expect({ label, disabled: await vqProbe.isDisabled(VqServices.visibilitySwitch(label)) }).toEqual(
              {
                label,
                disabled: true,
              },
            );
          }
        });

        expect(await vqProbe.isShown(Vq.button('Add', VqScope.dialog))).toBe(true);
      } finally {
        await servicesSettingsPage.closeAnything();
      }
    },
  );

  /* ------------------------------------------------------------------ *
   * Employees
   * ------------------------------------------------------------------ */

  it(
    title(
      'Employees: list layout, search and status filter, Reorder Employees dialog closes unchanged (SET-153, SET-154, SET-176)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      if (staff === '') this.skip(); // no active staff on this merchant
      await openSettingsVq('STAFFS');
      await staffsSettingsPage.waitForReady(Timeouts.MEDIUM);

      await step('Layout', async () => {
        expect(await staffsSettingsPage.isHeadingShown()).toBe(true);
        expect(await staffsSettingsPage.isReorderShown()).toBe(true);
        expect(await vqProbe.isShown(Vq.placeholder('Search employee'))).toBe(true);
        expect(await staffsSettingsPage.statusFilterText()).toBe('All');
        for (const row of (await staffsSettingsPage.staffRows()).slice(0, 10)) {
          expect({ staff: row.name, status: row.status }).toEqual({
            staff: row.name,
            status: expect.stringMatching(/^(Active|Inactive)$/),
          });
        }
        expect(await staffsSettingsPage.isSelectStaffPlaceholderShown()).toBe(true);
      });

      await step('Search and filter', async () => {
        await staffsSettingsPage.search(staff.slice(0, 3).toLowerCase());
        expect((await staffsSettingsPage.staffRows()).map((row) => row.name)).toContain(staff);
        await staffsSettingsPage.search(`zzzz${String(Date.now())}`);
        expect(await vqProbe.isShown(Vq.text('No found results.', VqScope.main))).toBe(true);
        await staffsSettingsPage.clearSearch();
        try {
          await staffsSettingsPage.chooseStatusFilter(StaffsText.inactive);
          for (const row of (await staffsSettingsPage.staffRows()).slice(0, 15))
            expect(row.status).toBe('Inactive');
          await staffsSettingsPage.chooseStatusFilter(StaffsText.active);
          for (const row of (await staffsSettingsPage.staffRows()).slice(0, 15))
            expect(row.status).toBe('Active');
        } finally {
          await staffsSettingsPage.chooseStatusFilter(StaffsText.all);
        }
      });

      await step('Reorder Employees dialog opens with the staff and closes', async () => {
        await vqProbe.press(Vq.buttonMatching('Reorder Employees', VqScope.main));
        expect(await vqProbe.isShown(Vq.dialog('Reorder Employees'))).toBe(true);
        expect(await vqProbe.isShown(Vq.text(staff, VqScope.dialog), Timeouts.MEDIUM)).toBe(true);
        await vqProbe.pressKey('Escape');
        expect(await vqProbe.isGone(Vq.dialog('Reorder Employees'))).toBe(true);
      });
    },
  );

  it(
    title(
      'Staff detail: header, 5 tabs, Information fields; a tab change with unsaved edits asks first; Service Skills and Permissions tabs (SET-156, SET-171, SET-175)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      if (staff === '') this.skip();
      await openSettingsVq('STAFFS');
      await staffsSettingsPage.openStaff(staff);

      await step('Header, tabs and the Information form', async () => {
        expect(await staffsSettingsPage.detailHeading()).toContain(staff);
        expect((await vqProbe.count(VqStaff.status())) > 0).toBe(true);
        expect(await staffsSettingsPage.isSaveEnabled()).toBe(false);
        expect((await staffsSettingsPage.tabs()).map((tab) => tab.label)).toEqual([...StaffsText.tabsEn]);
        for (const label of [
          'First Name',
          'Last Name',
          'Nick Name',
          'Email',
          'SSN (Optional)',
          'Staff Group',
          'Staff Code',
          'Staff Role',
          'Profile',
          'Appointment Staff',
          'Color',
        ]) {
          expect({ label, shown: await vqProbe.isShown(Vq.text(label, VqScope.main)) }).toEqual({
            label,
            shown: true,
          });
        }
      });

      await step('Edit Last Name, change tab: Cancel keeps it, Confirm drops it', async () => {
        const lastName = Vq.labelled('Last Name', VqScope.main);
        const original = await vqProbe.inputValue(lastName);
        await vqProbe.fill(lastName, `${original}Qc`);
        await vqProbe.press(Vq.tab('Compensation'));
        expect(
          await vqProbe.isShown(Vq.text('Are you sure you want to change tab?', VqScope.alertDialog)),
        ).toBe(true);
        expect(
          await vqProbe.isShown(
            Vq.text('You have unsaved changes. Are you sure you want to change tab?', VqScope.alertDialog),
          ),
        ).toBe(true);
        await vqProbe.press(Vq.alertButton('Cancel'));
        expect((await staffsSettingsPage.tabs()).find((tab) => tab.selected)?.label).toBe('Information');
        expect(await vqProbe.inputValue(lastName)).toBe(`${original}Qc`);

        await vqProbe.press(Vq.tab('Compensation'));
        await vqProbe.press(Vq.alertButton('Confirm'));
        expect(
          await vqProbe.poll(
            async () => (await staffsSettingsPage.tabs()).find((t) => t.selected)?.label,
            'Compensation',
          ),
        ).toBe('Compensation');
        await staffsSettingsPage.openTab(0);
        expect(await vqProbe.inputValue(lastName)).toBe(original);
      });

      await step('Service Skills and Permissions tabs', async () => {
        await staffsSettingsPage.openTab(2);
        if ((await staffsSettingsPage.serviceSkills()).checkboxes === 0) {
          expect(await vqProbe.isShown(Vq.text('No service skills available.', VqScope.main))).toBe(true);
        }
        await staffsSettingsPage.openTab(4);
        expect(await vqProbe.isShown(Vq.text('Assigned Role', VqScope.main))).toBe(true);
        expect(await vqProbe.isShown(Vq.text('Extra Permission Only', VqScope.main))).toBe(true);
        if (await vqProbe.isShown(Vq.button('Expand All', VqScope.main), Timeouts.ANIMATION)) {
          await vqProbe.press(Vq.button('Expand All', VqScope.main));
        }
        expect(await vqProbe.count(Vq.switches(VqScope.main))).toBeGreaterThan(0);
        expect(await vqProbe.count(Vq.disabledSwitches(VqScope.main))).toBeGreaterThan(0);
      });

      expect(await staffsSettingsPage.isSaveEnabled()).toBe(false);
    },
  );

  it(
    title(
      'Staff Information validation (no Save): nickname, staff code, names, email, phone, SSN, postal; duplicate nickname in Create New Staff (SET-159, SET-160, SET-161, SET-163, SET-164, SET-165)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      if (staff === '' || otherStaff === '') this.skip(); // needs two active staff
      await openSettingsVq('STAFFS');
      await staffsSettingsPage.openStaff(otherStaff);
      const otherEmail = (await vqProbe.inputValue(Vq.labelled('Email', VqScope.main))).trim();
      await openSettingsVq('STAFFS');
      await staffsSettingsPage.openStaff(staff);

      const check = async (
        label: string,
        value: string,
        expected: string,
        timeout = Timeouts.ANIMATION * 4,
      ): Promise<void> => {
        const input = Vq.labelled(label, VqScope.main);
        await vqProbe.fill(input, value);
        const message = await messageUnder(input, expected, timeout);
        const shown = value.length > 25 ? `${String(value.length)} chars` : `"${value}"`;
        expect({ label, value: shown, message }).toEqual({ label, value: shown, message: expected });
      };

      try {
        await step('Nick Name', async () => {
          await check('Nick Name', 'Jen@#', 'Nickname can only contain letters, numbers and spaces');
          await check('Nick Name', 'Jen 2', '', Timeouts.SHORT);
          await check('Nick Name', otherStaff, 'Nickname is already exists', Timeouts.SHORT);
          await check('Nick Name', ` ${otherStaff} `, 'Nickname is already exists', Timeouts.SHORT);
        });
        await step('Staff Code', async () => {
          await check('Staff Code', '123', 'Staff code must be 4 digits');
          await check('Staff Code', '12a4', 'Staff code must be a number');
          const code = Vq.labelled('Staff Code', VqScope.main);
          await vqProbe.fill(code, '0123');
          await settle(Timeouts.DEBOUNCE * 2); // the duplicate-code check runs async
          expect(await vqProbe.fieldMessage(code)).not.toMatch(/4 digits|must be a number/);
        });
        await step('First / Last Name', async () => {
          await check('First Name', 'F'.repeat(256), 'First name must be less than 255 characters');
          await check('First Name', 'F'.repeat(255), '');
          await check('Last Name', 'Nguyễn!', 'Last name can only contain letters, numbers and spaces');
        });
        await step('Email / Phone / SSN / Postal', async () => {
          await check('Email', 'abc@', 'Email is invalid');
          if (otherEmail !== '') await check('Email', otherEmail, 'Email is already used', Timeouts.SHORT);
          await check('Phone', '123456789', 'Phone number is invalid');
          await check('SSN (Optional)', '12ab', 'SSN must be a number');
          await check('SSN (Optional)', '1'.repeat(21), 'SSN must be less than 20 characters');
          await check('Postal / Zip Code', '123456', 'Postal code must be less than 5 characters');
        });
      } finally {
        await staffsSettingsPage.leaveToSection(Routes.SETTINGS_LANGUAGE);
      }
      expect(await vqProbe.count(Vq.toast('Staff updated successfully!'))).toBe(0);

      await step(
        'Create New Staff: a nickname already in use is flagged (dialog closed, nothing created)',
        async () => {
          await openSettingsVq('STAFFS');
          await staffsSettingsPage.openCreateDialog();
          await vqProbe.fill(Vq.labelled('Nick Name', VqScope.dialog), otherStaff);
          expect(
            await vqProbe.isShown(Vq.text('Nick name is already exists', VqScope.dialog), Timeouts.SHORT),
          ).toBe(true);
          await staffsSettingsPage.closeDialogWithEscape();
        },
      );
    },
  );

  it(
    title(
      'Employees › Work Hours: Sync with Business Hours copies all 7 days (not saved) (SET-022)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      if (staff === '') this.skip();
      await openBusinessVq();
      const business = await businessInfoPage.workHourRows();

      await openSettingsVq('STAFFS');
      await staffsSettingsPage.openStaff(staff);
      await staffsSettingsPage.openTab(3);
      try {
        await vqProbe.press(Vq.button('Sync with Business Hours', VqScope.main));
        expect(await vqProbe.isShown(Vq.text('Sync with Business Hours?', VqScope.alertDialog))).toBe(true);
        await vqProbe.press(Vq.alertButton('Sync'));
        expect(
          await vqProbe.isShown(Vq.toast('Work hours synced with business hours'), Timeouts.MEDIUM),
        ).toBe(true);

        const synced = await staffsSettingsPage.workHours();
        for (const day of business) {
          const mine = synced.find((d) => d.day.toLowerCase() === day.day);
          const bizTimes = day.inputs.filter((i) => i.type === 'time').map((i) => i.value.slice(0, 5));
          expect({
            day: day.day,
            on: mine?.on,
            times: day.on ? mine?.times.map((t) => t.slice(0, 5)) : [],
          }).toEqual({
            day: day.day,
            on: day.on,
            times: day.on ? bizTimes : [],
          });
        }
      } finally {
        // Not saved: leaving through the rail confirms the guard and drops the sync.
        await staffsSettingsPage.leaveToSection(Routes.SETTINGS_LANGUAGE);
      }
      expect(await vqProbe.count(Vq.toast('Staff updated successfully!'))).toBe(0);
    },
  );
});
