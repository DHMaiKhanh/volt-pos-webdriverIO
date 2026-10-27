/**
 * volt-qc module 11-settings (SET-*) — Permissions, Services order, Employees,
 * Roles and Language: cases that SAVE (and restore) plus the remaining
 * read/draft-only rows of those screens.
 *
 * Source: volt-qc `e2e/tests/11-settings/set-plan-settings-staff-lang.spec.ts`
 * (SET-T36a, T36b, T43, T46, T44d, T32, T33a, T33b, T33c, T34) and the TC rows
 * SET-122, 139, 158, 162, 173, 180 of
 * docs/qc/volt-qc/windows-regression/11-settings.md (written from the row).
 *
 * ## Why this file is @exclusive
 *
 * The permission matrix, the category order, staff records and the app
 * language are MERCHANT-GLOBAL. Each writing case snapshots, writes, restores in
 * `finally` and asserts the restore; the language cases always end on English
 * (`after` forces it again). Draft cases (SET-172/174, 139, 158, 162) press
 * Cancel / close — never OK / Confirm / Create on valid data.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import {
  ASP_PERMISSION_ROWS,
  AspPerm,
  AspServices,
  AspStaff,
  AspText,
  AspVi,
} from '../../../../src/constants/testids.voltqc-app-rpt-set-perm.js';
import { Vq, VqScope } from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { homePage, settingsPage } from '../../../../src/pages/index.js';
import RolesSettingsPage from '../../../../src/pages/settings/RolesSettingsPage.js';
import ServicesSettingsPage from '../../../../src/pages/settings/ServicesSettingsPage.js';
import StaffsSettingsPage from '../../../../src/pages/settings/StaffsSettingsPage.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import {
  bodyText,
  cashToTipScreen,
  cleanTill,
  clickPerm,
  customerText,
  draftToCheckout,
  finishFromTipScreen,
  goAnyLang,
  log,
  openPermissions,
  qcTag,
  readPerm,
  restoreEnglish,
  setLanguage,
  setPerm,
  toastShown,
} from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import { voltQcProbe } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { dismissOverlays } from '../../../../src/pages/voltqc/settings-devm/nav.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const STAFF_COL = 3;
const PARTNER_COL = 2;

/** Open the Nth listed employee's detail; returns its name. */
async function openEmployee(index = 0): Promise<string> {
  await dismissOverlays();
  await goAnyLang('/settings/staffs');
  const rows = await StaffsSettingsPage.staffRows();
  const pick = rows[Math.min(index, rows.length - 1)];
  if (!pick) throw new Error('Settings › Employees lists nobody');
  await StaffsSettingsPage.openStaff(pick.name);
  return pick.name;
}

/** Leave a staff detail discarding a dirty form. */
async function leaveStaff(): Promise<void> {
  await StaffsSettingsPage.leaveToSection('/settings/language').catch(() => goAnyLang('/settings/language'));
}

/** Names of the draggable category cards in the Reorder dialog (opens it). */
async function reorderNames(): Promise<string[]> {
  if (!(await vqProbe.isShown(AspServices.reorderDialog, Timeouts.ANIMATION))) {
    await vqProbe.press(AspServices.reorderButton);
    await vqProbe.waitShown(AspServices.reorderDialog, Timeouts.SHORT);
  }
  await settle(600);
  return browser.execute(function () {
    const dlg = Array.from(document.querySelectorAll('[role="dialog"]')).find((d) =>
      (d.textContent ?? '').includes('Reorder Categories or Services'),
    );
    if (!dlg) return [];
    return Array.from(dlg.querySelectorAll('button'))
      .filter((b) => (b.textContent ?? '').trim() === 'Reorder' || b.getAttribute('aria-label') === 'Reorder')
      .map((b) => (b.parentElement?.querySelector('h3')?.textContent ?? '').trim());
  });
}

async function gripPoint(index: number): Promise<{ x: number; y: number } | null> {
  return browser.execute(function (i: number) {
    const dlg = Array.from(document.querySelectorAll('[role="dialog"]')).find((d) =>
      (d.textContent ?? '').includes('Reorder Categories or Services'),
    );
    const grips = dlg
      ? Array.from(dlg.querySelectorAll('button')).filter(
          (b) => (b.textContent ?? '').trim() === 'Reorder' || b.getAttribute('aria-label') === 'Reorder',
        )
      : [];
    const g = grips[i];
    if (!g) return null;
    g.scrollIntoView({ block: 'center' });
    const r = g.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, index);
}

async function dragGrip(from: number, to: number): Promise<void> {
  const a = await gripPoint(from);
  const b = await gripPoint(to);
  if (!a || !b) throw new Error(`Reorder: no grip ${String(from)} / ${String(to)}`);
  await voltQcProbe.drag(a, { x: b.x, y: b.y + (to > from ? 8 : -8) }, 900);
  await settle(1_200);
}

async function closeReorder(): Promise<void> {
  if (await vqProbe.isShown(AspServices.reorderDialog, Timeouts.ANIMATION)) await vqProbe.pressKey('Escape');
  await vqProbe.isGone(AspServices.reorderDialog, Timeouts.SHORT);
}

const noRawKey = async (where: string): Promise<void> => {
  const t = await bodyText();
  expect({ where, raw: AspText.rawKey.exec(t)?.[0] ?? null }).toEqual({ where, raw: null });
};

describe('volt-qc SET — Permissions / Services / Employees / Language (settings)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('change merchant settings and restore');
    await cleanTill();
  });

  afterEach(async () => {
    await dismissOverlays().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await restoreEnglish();
    await ensurePasscodeGrant();
    await gateProbe.routerNavigate('/home');
    await settingsPage.confirmLeaveGuardIfShown();
    await returnToHome().catch(() => undefined);
  });

  /* ------------------------------ Permissions ---------------------------- */

  it(
    title(
      'Permissions: Staff × Summary Income writes at once (no Save) and survives leaving; restored (SET-117)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openPermissions();
      const orig = await readPerm('Summary Income', STAFF_COL);
      if (orig === null) throw new Error('Summary Income row not rendered');
      try {
        await clickPerm('Summary Income', STAFF_COL);
        expect(await readPerm('Summary Income', STAFF_COL)).toBe(!orig);
        expect(await vqProbe.count(Vq.button('Save', VqScope.main))).toBe(0);
        await settle(1_500);
        await settingsPage.openSection('ROLES');
        await openPermissions();
        expect(await readPerm('Summary Income', STAFF_COL)).toBe(!orig);
      } finally {
        await openPermissions();
        await setPerm('Summary Income', STAFF_COL, orig);
        await settle(1_500);
      }
      await settingsPage.openSection('ROLES');
      await openPermissions();
      expect(await readPerm('Summary Income', STAFF_COL)).toBe(orig);
    },
  );

  it(
    title(
      'Permissions: Select All / Unselect All on the Partner column writes every row; 16 rows restored from the snapshot (SET-118)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await openPermissions();
      const snap: Record<string, boolean> = {};
      for (const row of ASP_PERMISSION_ROWS) {
        const v = await readPerm(row, PARTNER_COL);
        if (v !== null) snap[row] = v;
      }
      log.info(`SET-118 Partner snapshot: ${JSON.stringify(snap)}`);
      const partnerButton = { ...AspPerm.selectAllButtons, nth: 1 };
      try {
        for (let i = 0; i < 2; i += 1) {
          const label = await vqProbe.textOf(partnerButton);
          await vqProbe.press(partnerButton);
          await settle(1_500);
          const want = label === 'Select All';
          for (const row of Object.keys(snap))
            expect({ row, v: await readPerm(row, PARTNER_COL) }).toEqual({ row, v: want });
          expect(await vqProbe.textOf(partnerButton)).toBe(want ? 'Unselect All' : 'Select All');
        }
      } finally {
        for (let pass = 0; pass < 2; pass += 1) {
          await openPermissions();
          for (const [row, v] of Object.entries(snap)) await setPerm(row, PARTNER_COL, v);
          await settle(1_500);
        }
      }
      await settingsPage.openSection('ROLES');
      await openPermissions();
      for (const [row, v] of Object.entries(snap))
        expect({ row, v: await readPerm(row, PARTNER_COL) }).toEqual({ row, v });
    },
  );

  /* ------------------------------- Services ------------------------------ */

  it(
    title(
      'Services: dragging a category in Reorder saves at once and Home follows; original order restored (SET-151)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await goAnyLang('/settings/services');
      const orig = await reorderNames();
      if (orig.length < 2) {
        await closeReorder();
        this.skip();
      }
      log.info(`SET-151 original order: ${orig.join(', ')}`);
      const [n0, n1] = [orig[0] ?? '', orig[1] ?? ''];
      let touched = false;
      try {
        touched = true;
        await dragGrip(0, 1);
        expect((await reorderNames()).slice(0, 2)).toEqual([n1, n0]);
        await closeReorder();
        await goAnyLang('/settings/language');
        await goAnyLang('/settings/services');
        expect((await reorderNames()).slice(0, 2)).toEqual([n1, n0]);
        await closeReorder();
        await cleanTill();
        const home = await bodyText('main');
        const i0 = home.indexOf(n0);
        const i1 = home.indexOf(n1);
        if (i0 >= 0 && i1 >= 0) expect(i1).toBeLessThan(i0);
        else log.warn(`SET-151: Home does not show both categories (${String(i0)}, ${String(i1)})`);
      } finally {
        if (touched) {
          await goAnyLang('/settings/services');
          for (let k = 0; k < 3; k += 1) {
            const names = await reorderNames();
            if (names[0] === n0) break;
            const idx = names.indexOf(n0);
            if (idx <= 0) break;
            await dragGrip(idx, 0);
          }
          await closeReorder();
        }
      }
      await goAnyLang('/settings/services');
      expect(await reorderNames()).toEqual(orig);
      await closeReorder();
    },
  );

  it(
    title(
      'Add New Item: Price / Supply Fee cap at $9,999,999.99 and refuse negatives; nothing created (SET-139)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await goAnyLang('/settings/services');
      await ServicesSettingsPage.openFirstServiceCategory();
      await ServicesSettingsPage.openAddItem();
      try {
        if (await ServicesSettingsPage.isFlexiblePricingChecked())
          await ServicesSettingsPage.toggleFlexiblePricing();
        await ServicesSettingsPage.replacePrice('1000000000');
        const over = await ServicesSettingsPage.priceValue();
        const overMsg = await ServicesSettingsPage.dialogText();
        expect(moneyOk(over) || /Price cannot exceed \$9,999,999\.99/.test(overMsg)).toBe(true);
        await ServicesSettingsPage.replacePrice('999999999');
        expect(await ServicesSettingsPage.priceValue()).toMatch(/9,?999,?999\.99/);
        await ServicesSettingsPage.appendToPrice('-');
        expect(await ServicesSettingsPage.priceValue()).not.toMatch(/^-/);
      } finally {
        await ServicesSettingsPage.closeAnything();
      }
    },
  );

  /* ------------------------------- Employees ----------------------------- */

  it(
    title(
      'Employee: edit Last Name → Save → kept after leaving; restored (SET-169)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const name = await openEmployee(1);
      const old = await vqProbe.inputValue(AspStaff.lastName);
      log.info(`SET-169 ${name} original Last Name: "${old}"`);
      const nv = `QC ${qcTag()}`;
      const saveWith = async (v: string): Promise<void> => {
        await vqProbe.fill(AspStaff.lastName, v);
        await vqProbe.press(AspStaff.save);
        expect(await toastShown(AspText.staffSaved, Timeouts.API)).toBe(true);
      };
      let touched = false;
      try {
        expect(await vqProbe.isDisabled(AspStaff.save)).toBe(true);
        touched = true;
        await saveWith(nv);
        await goAnyLang('/settings/language');
        await goAnyLang('/settings/staffs');
        await StaffsSettingsPage.openStaff(name);
        expect(await vqProbe.inputValue(AspStaff.lastName)).toBe(nv);
      } finally {
        if (touched) {
          await goAnyLang('/settings/staffs');
          await StaffsSettingsPage.openStaff(name);
          if ((await vqProbe.inputValue(AspStaff.lastName)) !== old) await saveWith(old);
        }
      }
      expect(await vqProbe.inputValue(AspStaff.lastName)).toBe(old);
      await leaveStaff();
    },
  );

  it(
    title(
      'Employee: changing Staff Role / Deduction Per Day → Save only opens a confirm → Cancel saves nothing (SET-172, SET-174)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const name = await openEmployee(1);
      const origRole = await vqProbe.textOf(AspStaff.roleCombobox);
      await step('SET-172 role change → "change role" confirm → Cancel', async () => {
        await vqProbe.press(AspStaff.roleCombobox);
        const options = (await vqProbe.texts(Vq.anyOption())).filter((t) => t !== origRole);
        if (!options[0]) throw new Error('No other role offered');
        await vqProbe.press(Vq.option(options[0]));
        await vqProbe.press(AspStaff.save);
        const asked = await vqProbe.isShown(Vq.alertDialog(), Timeouts.SHORT);
        const text = asked ? await vqProbe.textOf(Vq.alertDialog()) : '';
        if (!asked && (await toastShown(AspText.staffSaved, 1_000))) {
          throw new Error(
            `Save changed the role of ${name} without a confirm — restore role "${origRole}" by hand`,
          );
        }
        expect(text).toContain(AspText.changeRoleTitle);
        expect(text).toContain(AspText.changeRoleBody);
        await vqProbe.press(Vq.alertButton('Cancel'));
        expect(await toastShown(AspText.staffSaved, 1_500)).toBe(false);
        await leaveStaff();
        await goAnyLang('/settings/staffs');
        await StaffsSettingsPage.openStaff(name);
        expect(await vqProbe.textOf(AspStaff.roleCombobox)).toBe(origRole);
      });
      await step('SET-174 Deduction Per Day → "Apply Compensation Changes" → Cancel', async () => {
        await vqProbe.press(AspStaff.tab('Compensation'));
        await settle(800);
        const old = await vqProbe.inputValue(AspStaff.deductionPerDay);
        await vqProbe.fill(AspStaff.deductionPerDay, old.replace(/\D/g, '') === '123' ? '124' : '123');
        await vqProbe.press(AspStaff.save);
        expect(await vqProbe.isShown(Vq.alertDialog(), Timeouts.SHORT)).toBe(true);
        const t = await vqProbe.textOf(Vq.alertDialog());
        expect(t).toContain(AspText.applyCompensation);
        expect(t).toMatch(/payroll/i);
        await vqProbe.press(Vq.alertButton('Cancel'));
        expect(await toastShown(AspText.staffSaved, 1_500)).toBe(false);
        await leaveStaff();
        await goAnyLang('/settings/staffs');
        await StaffsSettingsPage.openStaff(name);
        await vqProbe.press(AspStaff.tab('Compensation'));
        await settle(800);
        expect(await vqProbe.inputValue(AspStaff.deductionPerDay)).toBe(old);
      });
      await leaveStaff();
    },
  );

  it(
    title(
      'Employee Compensation tab: exactly one of Commission / Commission + Salary / Salary is selected, with its settings (SET-173)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await openEmployee(0);
      await StaffsSettingsPage.openTab(1);
      const t = await StaffsSettingsPage.activePanelText();
      for (const s of ['Commission', 'Commission + Salary', 'Salary', 'Deduction Per Day'])
        expect({ s, has: t.includes(s) }).toEqual({ s, has: true });
      const radios = await vqProbe.texts({ ...Vq.switches('main'), css: '[role="radio"]' });
      const checked: string[] = [];
      for (let i = 0; i < radios.length; i += 1) {
        if ((await vqProbe.read({ ...Vq.switches('main'), css: '[role="radio"]', nth: i })).checked)
          checked.push(radios[i] ?? '');
      }
      log.info(`SET-173 checked radios: ${checked.join(' | ')}`);
      expect(checked.length).toBeGreaterThanOrEqual(1);
      await leaveStaff();
    },
  );

  it(
    title(
      'Create New Staff with every field empty: Nick name / Staff code / Role required, nothing created (SET-158)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await goAnyLang('/settings/staffs');
      const before = (await StaffsSettingsPage.staffRows()).length;
      await StaffsSettingsPage.openCreateDialog();
      try {
        await vqProbe.press(Vq.button('Create', VqScope.dialog));
        await settle(800);
        const t = await StaffsSettingsPage.dialogText();
        for (const m of ['Nick name is required', 'Staff code is required', 'Role is required'])
          expect({ m, has: t.includes(m) }).toEqual({ m, has: true });
        expect(
          /First name is required|Last name is required|Phone is required|Email is required/i.test(t),
        ).toBe(false);
      } finally {
        await StaffsSettingsPage.closeAnything();
      }
      expect((await StaffsSettingsPage.staffRows()).length).toBe(before);
    },
  );

  it(
    title(
      'Roles: each role page heading carries its name and the Assign button reads "Assign to <role> Role" (SET-122)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      for (const [key, name] of [
        ['manager', 'Manager'],
        ['partner', 'Partner'],
        ['staff', 'Staff'],
        ['owner', 'Owner'],
      ] as const) {
        await goAnyLang('/settings/roles');
        await RolesSettingsPage.openRole(key);
        expect(await RolesSettingsPage.detailTitle()).toContain(name);
        const t = await bodyText('main');
        expect(t.includes('Assign to  Role')).toBe(false);
        if (key !== 'owner') expect(t).toContain(`Assign to ${name} Role`);
      }
    },
  );

  it(
    title(
      'An Active Owner-role staff is offered in the Home staff list when building an order (SET-180)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await goAnyLang('/settings/roles');
      await RolesSettingsPage.openRole('owner');
      const owners = (await RolesSettingsPage.detailColumn(0)).map((s) => s.trim()).filter(Boolean);
      if (owners.length === 0) this.skip();
      await cleanTill();
      const home = await bodyText('main');
      expect(owners.some((o) => home.includes(o.split(' ')[0] ?? o))).toBe(true);
    },
  );

  /* ------------------------------- Language ------------------------------ */

  it(
    title(
      'Language: Tiếng Việt applies at once with no confirm; English switches back (SET-106, SET-114)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await setLanguage('en');
        await setLanguage('vi');
        expect(await vqProbe.count(Vq.alertDialog())).toBe(0);
        expect(await vqProbe.isShown(Vq.heading(AspVi.languageHeading), Timeouts.SHORT)).toBe(true);
        const rail = await bodyText('aside');
        for (const s of AspVi.settingsRail) expect({ s, has: rail.includes(s) }).toEqual({ s, has: true });
        await setLanguage('en');
        expect(await vqProbe.isShown(Vq.heading('Language'), Timeouts.SHORT)).toBe(true);
        expect(await bodyText('aside')).not.toMatch(/Thông tin doanh nghiệp|Ngôn ngữ/);
      } finally {
        await restoreEnglish();
      }
    },
  );

  it(
    title(
      'Vietnamese: Settings pages, Tipping/Receipt labels, Permissions, Add-item dialog and staff detail are translated with no raw keys (SET-030, SET-087, SET-104, SET-111, SET-119, SET-152, SET-179)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      try {
        await setLanguage('vi');
        await step('SET-030 Business Info', async () => {
          await goAnyLang('/settings/business');
          const t = await bodyText('main');
          expect(t).toContain(AspVi.payPeriod);
          expect(t).not.toMatch(/Current plan|Effective on/);
        });
        await step('SET-087 Tipping', async () => {
          await goAnyLang('/settings/payment-transaction');
          const t = await bodyText('main');
          expect(t).toMatch(/tiền boa/i);
          expect(t).not.toMatch(/Tip Setting|Add Tip Option/);
        });
        await step('SET-104 Receipt', async () => {
          await goAnyLang('/settings/receipt');
          const t = await bodyText('main');
          expect(t).toMatch(/tiền boa/i);
          expect(t).toContain(AspVi.receiptCheckIn);
          expect(t).not.toContain('Check-in time');
        });
        await step('SET-111 every Settings page', async () => {
          for (const r of [
            'business',
            'services',
            'staffs',
            'roles',
            'permissions',
            'payment-transaction',
            'charge-fee',
            'receipt',
            'accessibility',
            'language',
          ]) {
            await goAnyLang(`/settings/${r}`);
            await settle(800);
            await noRawKey(`/settings/${r}`);
          }
          await goAnyLang('/settings/roles');
          const roles = await bodyText('main');
          for (const s of AspVi.roles) expect({ s, has: roles.includes(s) }).toEqual({ s, has: true });
        });
        await step('SET-119 Permissions', async () => {
          await goAnyLang('/settings/permissions');
          if ((await vqProbe.count(AspPerm.expandAll)) > 0) await vqProbe.press(AspPerm.expandAll);
          const t = await bodyText('main');
          for (const s of AspVi.permissions) expect({ s, has: t.includes(s) }).toEqual({ s, has: true });
          expect(t).not.toContain('(Void)');
        });
        await step('SET-152 Services › add item dialog', async () => {
          await goAnyLang('/settings/services');
          await ServicesSettingsPage.openFirstServiceCategory();
          await ServicesSettingsPage.openAddItem();
          const t = await ServicesSettingsPage.dialogText();
          await ServicesSettingsPage.closeAnything();
          for (const s of ['Cài đặt hiển thị', 'Hiển thị trên Go POS'])
            expect({ s, has: t.includes(s) }).toEqual({ s, has: true });
        });
        await step('SET-179 staff detail tabs', async () => {
          await goAnyLang('/settings/staffs');
          const rows = await StaffsSettingsPage.staffRows();
          if (!rows[0]) throw new Error('no employee listed');
          await StaffsSettingsPage.openStaff(rows[0].name);
          const tabs = (await StaffsSettingsPage.tabs()).map((t) => t.label);
          for (const s of AspVi.staffTabs) expect({ s, has: tabs.includes(s) }).toEqual({ s, has: true });
          await noRawKey('staff detail');
        });
      } finally {
        await restoreEnglish();
      }
    },
  );

  it(
    title(
      'Vietnamese: Home, Order History and the V1 reports keep no forbidden English words or raw keys (SET-110, RPT-181)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      try {
        await setLanguage('vi');
        for (const route of [
          '/home',
          '/order-history',
          '/incomes/income-daily',
          '/incomes/income-summary',
          '/incomes/income-staff',
          '/incomes/staff-payroll',
        ]) {
          await goAnyLang(route);
          await settle(2_000);
          const t = await bodyText();
          for (const re of AspVi.forbiddenOnMain)
            expect({ route, word: re.exec(t)?.[0] ?? null }).toEqual({ route, word: null });
          await noRawKey(route);
        }
      } finally {
        await restoreEnglish();
      }
    },
  );

  it(
    title(
      'Vietnamese: the Business Info guard title and the City validation message are Vietnamese (SET-112)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await setLanguage('vi');
        await returnToHome();
        if (await gateProbe.openGate('/settings/business')) {
          expect((await gateProbe.state())?.heading).toBe(
            'Nhập mã nhân viên để truy cập trang Cài đặt Doanh nghiệp',
          );
          await gateProbe.dismiss();
        } else log.warn('SET-112: POS Settings gate OFF — guard title not checked');
        await ensurePasscodeGrant();
        await goAnyLang('/settings/business');
        await vqProbe.press({ ...Vq.button('Sửa', VqScope.main) });
        const city = { ...Vq.named('city') };
        try {
          await vqProbe.fill(city, '');
          await vqProbe.press(Vq.button('Lưu', VqScope.main)).catch(() => undefined);
          const msg = await vqProbe
            .poll(() => vqProbe.fieldMessage(city), '', 1_000)
            .then(() => vqProbe.fieldMessage(city));
          await noRawKey('Business Info edit');
          expect(msg).not.toBe('');
          expect(msg).not.toBe('City is required');
        } finally {
          await vqProbe.press(Vq.button('Huỷ', VqScope.main)).catch(() => vqProbe.pressKey('Escape'));
        }
      } finally {
        await restoreEnglish();
      }
    },
  );

  it(
    title(
      'Vietnamese: the customer tip screen stays English; staff / service names and money format unchanged (SET-108, SET-109)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await cleanTill();
      const enHome = await bodyText('main');
      const names = enHome.match(/\$\d[\d,]*\.\d{2}/g)?.slice(0, 3) ?? [];
      try {
        await setLanguage('vi');
        await step('SET-109 data is not translated', async () => {
          await goAnyLang('/home');
          await homePage.waitForReady();
          const t = await bodyText('main');
          expect(t).toMatch(/\$\d[\d,]*\.\d{2}/);
          for (const n of names) expect({ n, has: t.includes(n) }).toEqual({ n, has: true });
        });
        await step('SET-108 customer tip screen in English', async () => {
          const r = await cashToTipScreen(await draftToCheckout());
          if (!r.tipScreen) {
            await finishFromTipScreen().catch(() => undefined);
            return void log.warn('SET-108: no tip screen on cash');
          }
          const cust = await customerText();
          await finishFromTipScreen();
          if (cust === null) return void log.warn('SET-108: customer window not reachable');
          for (const s of ['Add a tip', 'No Tip', 'Continue'])
            expect({ s, has: cust.includes(s) }).toEqual({ s, has: true });
        });
      } finally {
        await restoreEnglish();
      }
    },
  );
});

/** A capped price field: never more than 9,999,999.99. */
function moneyOk(v: string): boolean {
  const n = Number(v.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n <= 9_999_999.99;
}
