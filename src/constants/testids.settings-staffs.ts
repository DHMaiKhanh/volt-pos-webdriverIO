/**
 * Employees (`/settings/staffs`, `/settings/staffs/$staffId`).
 *
 * Source: `docs/screens/settings-staffs/settings-staffs-test-cases.md`, the live
 * DOM dump of build 1.1.56
 * (`reports/scans/2026-10-25-feature-inventory/dom/settings-staffs.json`) and the
 * app source under `src/routes/_app/settings/staffs/`.
 *
 * ## No testids on this screen
 *
 * Build 1.1.56 ships none, and the code-detail doc names none, so every primary
 * below is the id the app SHOULD expose (`settings-staffs-<thing>`) with a
 * structural fallback. What the screen does give us:
 *
 * - the Information tab's text inputs render `<Input id={name}>`, so `#firstName`,
 *   `#nickname`, `#city` … are literal, untranslated handles (phone and staff code
 *   are custom inputs with generated ids — reached by `name`);
 * - the Compensation tab's mode/salary radios carry the app's enum as id
 *   (`#commission`, `#commission_salary`, `#salary`, `#salary_by_period`,
 *   `#wage_per_day`, `#wage_per_hour`) and the payroll-tip switch `#enablePayrollTip`;
 * - the Work Hours switches are `#monday` … `#sunday`;
 * - the Create New Staff dialog's inputs carry `name` (ids are generated).
 *
 * `EmployeeSettingsIds` in `testids.settings.ts` targets the same route for the
 * income suite; its heading fallback (`Employee`) does not match this build's
 * `All Employees`, so the list chrome is re-declared here rather than reused.
 */

import { Actions, both } from './labels.js';
import {
  buttonContainingAnyText,
  buttonWithAnyText,
  byRole,
  inputWithAnyPlaceholder,
  locator,
  type Locator,
} from '../helpers/selectors.js';

/** `[en, vi]` pairs read from `src/locales/{en,vi}/common.json` (app source, 2026-10-23). */
export const StaffsText = {
  allEmployees: ['All Employees', 'Tất cả nhân viên'],
  reorderEmployees: ['Reorder Employees', 'Sắp xếp nhân viên'],
  searchEmployee: ['Search employee', 'Tìm nhân viên'],
  selectStaff: ['Select a staff member to view details.', 'Chọn nhân viên để xem chi tiết.'],
  all: ['All', 'Tất cả'],
  active: ['Active', 'Đang hoạt động'],
  inactive: ['Inactive', 'Ngưng hoạt động'],
  /** Detail tabs in render order. */
  tabsEn: ['Information', 'Compensation', 'Service Skills', 'Work Hours', 'Permissions'],
  tabsVi: ['Thông tin', 'Thù lao', 'Kỹ năng dịch vụ', 'Giờ làm việc', 'Quyền hạn'],
  commission: ['Commission', 'Hoa hồng'],
  commissionSalary: ['Commission + Salary', 'Hoa hồng + Lương'],
  salary: ['Salary', 'Lương'],
  excludeTips: ['Exclude Tips From Cash/Check Income', 'Loại tiền boa khỏi thu nhập Tiền mặt/Séc'],
  syncBusinessHours: ['Sync with Business Hours', 'Đồng bộ với giờ kinh doanh'],
  assignedRole: ['Assigned Role', 'Vai trò được gán'],
  assignedRoleDescription: [
    'This role controls base permissions for this staff member.',
    'Vai trò này điều khiển các quyền cơ bản cho nhân viên này.',
  ],
  extraPermissionOnly: ['Extra Permission Only', 'Chỉ quyền bổ sung'],
  createNewStaff: ['Create New Staff', 'Tạo nhân viên mới'],
  create: ['Create', 'Tạo'],
  selectEmployeeGroup: ['Select employee group', 'Chọn nhóm nhân viên'],
  selectCountry: ['Select a country', 'Chọn quốc gia'],
  selectState: ['Select a state', 'Chọn tiểu bang'],
  confirm: ['Confirm', 'Xác nhận'],
  country: ['Country', 'Quốc gia'],
  state: ['State', 'Tiểu bang'],
} as const;

/** XPath predicate: own text is exactly one of the pair. */
const isText = (pair: readonly string[]): string => pair.map((t) => `normalize-space()="${t}"`).join(' or ');
const attrIs = (attr: string, pair: readonly string[]): string =>
  pair.map((t) => `@${attr}="${t}"`).join(' or ');

/** Raw CSS for `browser.execute` reads, which cannot take a `Locator`. */
export const StaffsCss = {
  staffLinks: 'a[href^="/settings/staffs/"]',
  activeTabpanel: '[role="tabpanel"][data-state="active"]',
  openDialog: '[role="dialog"][data-state="open"]',
} as const;

/** The Information-tab fields TC-EMP-10 expects, by their literal DOM handle. */
export const STAFF_INFO_FIELDS: readonly { name: string; css: string }[] = [
  { name: 'isAllowBooking', css: '#isAllowBooking' },
  { name: 'firstName', css: '#firstName' },
  { name: 'lastName', css: '#lastName' },
  { name: 'nickname', css: '#nickname' },
  { name: 'phone', css: 'input[name="phone"]' },
  { name: 'email', css: '#email' },
  { name: 'ssn', css: '#ssn' },
  { name: 'staffCode', css: 'input[name="staffCode"]' },
  { name: 'address', css: '#address' },
  { name: 'city', css: '#city' },
  { name: 'postalCode', css: '#postalCode' },
];

/** The Create New Staff inputs (all `name`-addressed — ids are generated). */
export const CREATE_STAFF_INPUTS = [
  'firstName',
  'lastName',
  'nickname',
  'phone',
  'email',
  'ssn',
  'staffCode',
  'address',
  'city',
  'postalCode',
] as const;

export const StaffsIds = {
  heading: locator(
    'all employees heading',
    'settings-staffs-heading',
    `//h3[${isText(StaffsText.allEmployees)}]`,
  ),

  reorderButton: locator(
    'reorder employees button',
    'settings-staffs-reorder-btn',
    `//button[${attrIs('aria-label', StaffsText.reorderEmployees)}]`,
  ),

  /** The nameless `+` beside Reorder — opens Create New Staff. */
  createButton: locator(
    'create staff button',
    'settings-staffs-create-btn',
    `//button[${attrIs('aria-label', StaffsText.reorderEmployees)}]/following-sibling::button[1]`,
  ),

  search: locator(
    'employee search',
    'settings-staffs-search',
    inputWithAnyPlaceholder(...StaffsText.searchEmployee),
  ),

  /** The status filter — the first combobox after the search box (the detail form has comboboxes too). */
  statusFilter: locator(
    'employee status filter',
    'settings-staffs-status-filter',
    `//input[${attrIs('placeholder', StaffsText.searchEmployee)}]/following::button[@role="combobox"][1]`,
  ),

  selectOptions: locator(
    'select options',
    'settings-staffs-filter-option-',
    `${byRole('listbox')} ${byRole('option')}`,
  ),

  /** Staff rows — data-dependent, the ready anchor. */
  staffLinks: locator('employee links', 'settings-staffs-link-', StaffsCss.staffLinks),

  selectStaffPlaceholder: locator(
    'select-a-staff placeholder',
    'settings-staffs-empty-detail',
    `//p[${isText(StaffsText.selectStaff)}]`,
  ),

  saveButton: locator('staff save button', 'settings-staffs-save', buttonWithAnyText(...both(Actions.save))),

  /** Detail tabs (scoped to the detail by role; the list has no tabs). */
  detailTabs: locator('staff detail tabs', 'settings-staffs-tab-', byRole('tab')),

  activeTabpanel: locator('active staff tabpanel', 'settings-staffs-tabpanel', StaffsCss.activeTabpanel),

  // --- Information ---
  nickname: locator('nickname field', 'settings-staffs-nickname', '#nickname'),
  staffCode: locator('staff code field', 'settings-staffs-staff-code', 'input[name="staffCode"]'),
  city: locator('city field', 'settings-staffs-city', '#city'),
  countrySelect: locator(
    'country select',
    'settings-staffs-country',
    `//label[${isText(StaffsText.country)}]/following::button[1]`,
  ),
  stateSelect: locator(
    'state select',
    'settings-staffs-state',
    `//label[${isText(StaffsText.state)}]/following::button[1]`,
  ),

  // --- Compensation ---
  salaryByPeriod: locator('salary by period radio', 'settings-staffs-salary-by-period', '#salary_by_period'),
  wagePerDay: locator('wage per day radio', 'settings-staffs-wage-per-day', '#wage_per_day'),
  wagePerHour: locator('wage per hour radio', 'settings-staffs-wage-per-hour', '#wage_per_hour'),
  salaryAmount: locator('salary amount', 'settings-staffs-salary-amount', 'input[name="salaryAmount"]'),
  deductionPerDay: locator('deduction per day', 'settings-staffs-deduction', 'input[name="deductionPerDay"]'),
  cashCheckSplit: locator(
    'cash/check split',
    'settings-staffs-cash-check-split',
    'input[name="cashCheckSplit"]',
  ),
  percentCreditCardTip: locator(
    'credit card tip %',
    'settings-staffs-cc-tip',
    'input[name="percentCreditCardTip"]',
  ),
  payrollTipSwitch: locator('exclude tips switch', 'settings-staffs-payroll-tip', '#enablePayrollTip'),
  /** Collapsed compensation accordion headers (expanding one does not change the mode). */
  collapsedAccordion: locator(
    'collapsed compensation section',
    'settings-staffs-compensation-section-',
    `${StaffsCss.activeTabpanel} button[aria-expanded="false"]`,
  ),

  // --- Work Hours / Permissions ---
  syncBusinessHours: locator(
    'sync with business hours',
    'settings-staffs-sync-hours',
    buttonContainingAnyText(...StaffsText.syncBusinessHours),
  ),

  // --- Create New Staff dialog (scope with `within`) ---
  dialog: locator('open dialog', 'settings-staffs-dialog', StaffsCss.openDialog, byRole('dialog')),
  dialogTitle: locator('dialog title', 'settings-staffs-dialog-title', '[data-slot="dialog-title"]', 'h2'),
  /** The header Close (an icon button with an sr-only "Close" label). */
  dialogClose: locator(
    'dialog close',
    'settings-staffs-dialog-close',
    '//*[@role="dialog"]//button[normalize-space()="Close" or normalize-space()="Đóng" or @aria-label="Close"]',
  ),
  dialogCreateBtn: locator(
    'dialog Create button',
    'settings-staffs-create-submit',
    `.//button[${isText(StaffsText.create)}]`,
  ),
  dialogStateTrigger: locator(
    'dialog state select',
    'settings-staffs-create-state',
    `.//button[${StaffsText.selectState.map((t) => `contains(normalize-space(),"${t}")`).join(' or ')}]`,
  ),

  // --- leave-with-unsaved-changes guard (router blocker) ---
  unsavedGuard: locator(
    'unsaved staff changes guard',
    'settings-staffs-unsaved-guard',
    byRole('alertdialog'),
  ),
  unsavedGuardConfirm: locator(
    'unsaved guard confirm',
    'settings-staffs-unsaved-confirm',
    `//*[@role="alertdialog"]//button[${isText(StaffsText.confirm)}]`,
    '[data-slot="alert-dialog-footer"] button:last-of-type',
  ),
} satisfies Record<string, Locator>;

/** A detail tab by its label pair. */
export const staffsTab = (en: string, vi: string): Locator =>
  locator(
    `staff tab ${en}`,
    `settings-staffs-tab-${en.toLowerCase().replace(/\s+/g, '-')}`,
    `//*[@role="tab"][${isText([en, vi])}]`,
  );

/** A select option by its label pair. */
export const staffsSelectOption = (pair: readonly string[]): Locator =>
  locator(
    `select option ${pair[0] ?? ''}`,
    `settings-staffs-filter-option-${(pair[0] ?? '').toLowerCase()}`,
    `//*[@role="option"][${isText(pair)}]`,
  );

/** A staff row by its (data) name. */
export const staffsLink = (name: string): Locator =>
  locator(
    `staff link ${name}`,
    `settings-staffs-link-${name}`,
    `//a[starts-with(@href,"/settings/staffs/")][.//span[normalize-space()="${name}"]]`,
  );

/** A Create New Staff input by `name` (scope with `within`). */
export const staffsCreateInput = (name: string): Locator =>
  locator(`create staff ${name}`, `settings-staffs-create-${name}`, `input[name="${name}"]`);
