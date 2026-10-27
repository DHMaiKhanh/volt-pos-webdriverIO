/**
 * Selectors and copy for the volt-qc `@mutation` / `@settings` port of modules
 * 01-app (APP-*), 10-reports (RPT-*), 11-settings (SET-*) and 12-perm (PERM-*) —
 * `tests/regression/volt-qc/app-rpt-set-perm/`.
 *
 * Build 1.1.x strips nearly every `data-testid`, so — like the read-only ports
 * (`testids.voltqc-settings-devm.ts`, `testids.voltqc-app-perm.ts`) — these are
 * {@link VqQuery}s resolved in the page by `vqProbe`: role, exact label, DOM id,
 * scoped to the card that carries a title. Ids are the ones volt-qc proved on
 * the live till (`e2e/src/flows/settings.ts`, `flows/perm.ts`, `flows/app-nav.ts`).
 */

import { Vq, VqScope, type VqQuery } from './testids.voltqc-settings-devm.js';

const q = (query: VqQuery): VqQuery => query;
const BUTTON = 'button, [role="button"]';

/** Settings section cards: `SectionCard` is a `div.rounded-xl` with an `h4` title (shadcn cards elsewhere). */
const CARD = `div.rounded-xl, ${VqScope.card}`;

/** A section card of a settings page, by its card title. */
export const AspCard = {
  /** The `Save` button inside the card titled `title`. */
  save: (title: string): VqQuery => Vq.button('Save', CARD, title),
  /** Any button by label inside the card titled `title`. */
  button: (title: string, label: string): VqQuery => Vq.button(label, CARD, title),
  /** Radix radios inside the card titled `title`. */
  radios: (title: string): VqQuery =>
    q({ name: `radios in "${title}"`, css: '[role="radio"]', within: CARD, withinText: title }),
  /** Every `<input>` in the card (Turn value etc.). */
  inputs: (title: string): VqQuery =>
    q({ name: `inputs in "${title}"`, css: 'input:not([role="switch"])', within: CARD, withinText: title }),
  /** A `<label>`-led field inside the card. */
  field: (title: string, label: string): VqQuery => Vq.labelled(label, CARD, title),
  /** Checkbox by label inside the card (Tip Method: Cash / Card …). */
  checkbox: (title: string, label: string): VqQuery =>
    Vq.labelled(label, CARD, title, '[role="checkbox"], input[type="checkbox"]'),
} as const;

/** The page-header `Save` next to a page heading (Tipping Settings, Receipt Setting, Charge & Fee). */
export const AspHeader = {
  save: (heading: string): VqQuery =>
    q({
      name: `"${heading}" header Save`,
      css: 'h1, h2, h3',
      text: heading,
      within: VqScope.main,
      up: { until: 'button', css: 'button', text: 'Save' },
    }),
} as const;

/** Tipping Settings › Tip Option table + its "Tip Settings" dialog. */
export const AspTip = {
  addButton: Vq.button('Add Tip Option', VqScope.main),
  dialog: Vq.dialog('Tip Settings'),
  dialogPercent: Vq.labelled('Percentage', VqScope.dialog),
  dialogDesc: Vq.placeholder('Enter description', VqScope.dialog),
  dialogStatus: q({ name: 'tip dialog status switch', css: '[role="switch"]', within: VqScope.dialog }),
  dialogAdd: Vq.button('Add', VqScope.dialog),
  /** A row's control by the row's description text. */
  rowButton: (desc: string, label: 'Edit Tip Option' | 'Delete Tip Option'): VqQuery =>
    q({
      name: `${label} of "${desc}"`,
      css: 'td',
      text: desc,
      match: 'contains',
      within: VqScope.main,
      up: { until: `button[aria-label="${label}"]`, css: `button[aria-label="${label}"]`, nth: 0 },
    }),
  rowSwitch: (desc: string): VqQuery =>
    q({
      name: `status switch of "${desc}"`,
      css: 'td',
      text: desc,
      match: 'contains',
      within: VqScope.main,
      up: { until: '[role="switch"]', css: '[role="switch"]', nth: 0 },
    }),
  /** Inline inputs of the row in edit mode (value = 0, description = 1). */
  editingInput: (nth: 0 | 1): VqQuery =>
    q({ name: `editing tip input ${String(nth)}`, css: 'tbody tr input:not([role="switch"])', nth }),
  deleteConfirm: Vq.alertButton('Delete'),
} as const;

/** DOM ids volt-qc relied on (they survived the testid strip). */
export const AspIds = {
  discountOwner: Vq.id('discount-setting-owner'),
  discountStaff: Vq.id('discount-setting-staff'),
  showPoint: Vq.id('customer-display-show-point'),
  showReward: Vq.id('customer-display-show-reward'),
  splitTipEvenly: Vq.id('split-tip-evenly'),
  splitTipProportion: Vq.id('split-tip-proportion'),
  tipTypePercent: Vq.id('charge-fee-tip-type-percent'),
  /** Accessibility › Keyboard › "Show the virtual keyboard" (DOM id is the misleading `sensitive-data`). */
  virtualKeyboard: Vq.id('sensitive-data'),
  themeLight: q({ name: 'theme light', css: '[data-testid="appearance-theme-light"], [id="light"]' }),
  themeDark: q({ name: 'theme dark', css: '[data-testid="appearance-theme-dark"], [id="dark"]' }),
  /** `language-list.tsx` puts the locale code straight into the radio id. */
  language: (code: 'en' | 'vi'): VqQuery => Vq.id(code),
  supplyBefore: q({
    name: 'Deduct Before Commission',
    css: '[role="radio"]',
    text: 'Deduct Before Commission',
  }),
  supplyAfter: q({ name: 'Deduct After Commission', css: '[role="radio"]', text: 'Deduct After Commission' }),
} as const;

/** The on-screen virtual keyboard (react-simple-keyboard in a drawer). */
export const AspKeyboard = {
  root: q({ name: 'virtual keyboard', css: '.simple-keyboard, .hg-theme-default' }),
  numeric: q({ name: 'numeric keyboard layout', css: '.kb-wrap-number' }),
  key: (k: string): VqQuery => q({ name: `keyboard key ${k}`, css: `[data-skbtn="${k}"]` }),
} as const;

/** App chrome. */
export const AspChrome = {
  openSidebar: q({
    name: 'open sidebar',
    css: BUTTON,
    text: '^(Open sidebar|Mở thanh điều hướng)$',
    match: 'regex',
    within: 'header',
  }),
  sidebar: q({ name: 'app sidebar', css: '[data-sidebar="sidebar"]' }),
  sidebarItems: q({
    name: 'sidebar items',
    css: '[data-sidebar="menu-button"], [data-sidebar="sidebar"] a, [data-sidebar="sidebar"] button',
    within: '[data-sidebar="sidebar"]',
  }),
  bell: q({
    name: 'notifications bell',
    css: BUTTON,
    text: '^(Notifications|Thông báo)$',
    match: 'regex',
    within: 'header',
  }),
  notificationsHeading: q({
    name: 'Notifications heading',
    css: 'h1, h2, h3, h4',
    text: '^(Notifications|Thông báo)$',
    match: 'regex',
    within: VqScope.popover,
  }),
  markAllRead: q({
    name: 'Mark all as read',
    css: BUTTON,
    text: '^(Mark all as read|Đánh dấu tất cả đã đọc)$',
    match: 'regex',
    within: VqScope.popover,
  }),
  headerAppointment: q({ name: 'header Appointment link', css: 'header a[href^="/appointment"]' }),
  pendingCards: q({ name: 'pending order cards', css: 'main [data-slot="card"], main a[href^="/order/"]' }),
} as const;

/** Pending-draft / checkout buttons by label (Remove, Cash Drawer, Complete Payment). */
export const AspOrder = {
  remove: Vq.button('Remove', VqScope.main),
  cashDrawer: Vq.button('Cash Drawer', VqScope.main),
  completePayment: Vq.button('Complete Payment'),
  deleteOrderDialog: q({
    name: 'Delete Order alert',
    css: VqScope.alertDialog,
    text: 'Delete Order',
    match: 'contains',
  }),
  /** A masked phone (`(***) ***-1234` / `***-***-1234`). */
  maskedPhone: q({ name: 'masked phone', css: 'main *', text: '\\*{3}.*\\d{2,4}$', match: 'regex' }),
} as const;

/** Settings › Permissions matrix. */
export const AspPerm = {
  /** The switch for one permission row × role column (resolved in-page; see aspPermSwitch). */
  selectAllButtons: q({
    name: 'Select All / Unselect All',
    css: BUTTON,
    text: '^(Select All|Unselect All)$',
    match: 'regex',
    within: VqScope.main,
  }),
  expandAll: q({
    name: 'Expand All',
    css: BUTTON,
    text: '^(Expand All|Mở rộng tất cả)$',
    match: 'regex',
    within: VqScope.main,
  }),
} as const;

/** Settings › Services reorder dialog. */
export const AspServices = {
  reorderButton: Vq.button('Reorder Categories or Services'),
  reorderDialog: Vq.dialog('Reorder Categories or Services'),
  grips: q({
    name: 'reorder grips',
    css: BUTTON,
    text: 'Reorder',
    within: VqScope.dialog,
    withinText: 'Reorder Categories or Services',
  }),
} as const;

/** Settings › Employees detail. */
export const AspStaff = {
  save: Vq.button('Save', VqScope.main),
  roleCombobox: q({
    name: 'Staff Role combobox',
    css: 'button[role="combobox"]',
    label: 'Staff Role',
  }),
  lastName: Vq.labelled('Last Name', VqScope.main),
  firstName: Vq.labelled('First Name', VqScope.main),
  nickName: Vq.labelled('Nick Name', VqScope.main),
  tab: (name: string): VqQuery => Vq.tab(name, VqScope.main),
  /** "Deduction Per Day" input — the first input in the block holding the label. */
  deductionPerDay: q({
    name: 'Deduction Per Day input',
    css: '*',
    text: 'Deduction Per Day',
    within: VqScope.main,
    up: { until: 'input', css: 'input', nth: 0 },
  }),
} as const;

/** Copy asserted on (en locale, build 1.1.x). */
export const AspText = {
  customerDisplaySaved: 'Customer display setting updated successfully',
  discountSaved: 'Discount setting updated',
  turnSaved: 'Turn value saved',
  splitTipSaved: 'Split tip setting updated',
  supplySaved: 'Supply share setting updated',
  staffSaved: 'Staff updated successfully!',
  changeRoleTitle: 'Are you sure you want to change role?',
  changeRoleBody: 'Changing the role will reset the permissions for this staff.',
  applyCompensation: 'Apply Compensation Changes',
  orderCanceled: 'Order canceled successfully',
  gateContinue: 'Enter staff code to continue',
  gateAccess: (page: string): string => `Enter staff code to access ${page}`,
  gateReopen: 'Enter staff code to re-open order',
  gateCashDrawer: 'Enter staff code to open cash drawer',
  gateCompletePayment: 'Enter staff code to complete payment',
  gateDeleteOrder: 'Enter staff code to access Delete Order',
  welcome: /welcome to/i,
  pointsOnCustomer: /Your current points|You've earned/,
  /** Raw i18n key leaking into the UI. */
  rawKey: /\b(global|actions|common|turn)\.[a-z][A-Za-z0-9_.]+/,
} as const;

/** Vietnamese copy (vi/common.json, build 1.1.x). */
export const AspVi = {
  settingsRail: ['Thông tin doanh nghiệp', 'Hóa đơn', 'Quyền', 'Vai trò', 'Ngôn ngữ'],
  languageHeading: 'Ngôn ngữ',
  sidebarHome: 'Trang chủ',
  gateHeadingPrefix: 'Nhập mã nhân viên',
  passcodeCard: ['Bật tất cả', 'Yêu cầu Passcode cho'],
  roles: ['Chủ', 'Quản lý', 'Đối tác', 'Nhân viên'],
  permissions: ['Quản lý đơn hàng', 'Huỷ đơn hàng', 'Cài đặt POS'],
  payPeriod: 'Kỳ trả lương',
  receiptCheckIn: 'Giờ check-in',
  staffTabs: ['Thông tin', 'Thù lao', 'Giờ làm việc', 'Quyền hạn'],
  /** English words that must not survive on the main screens in VI (SET-110). */
  forbiddenOnMain: [/\bUnknown\b/, /Gross Income/, /Net Income/],
  /** English chrome words that must not survive in the sidebar / header (APP-134). */
  forbiddenChrome: [/\bHome\b/, /\bOrder History\b/, /\bSettings\b/, /\bAppointment\b/],
} as const;

/** The 16 permission rows of the matrix, in render order. */
export const ASP_PERMISSION_ROWS = [
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
] as const;

/** Matrix role columns (Owner column is locked). */
export const ASP_ROLE_COLUMNS = ['Owner', 'Manager', 'Partner', 'Staff'] as const;
export type AspRole = (typeof ASP_ROLE_COLUMNS)[number];

/** Page gates: route, the name in "Enter staff code to access <name>", a content marker, TC id. */
export const ASP_PAGE_GATES = [
  {
    gate: 'summary_income',
    route: '/incomes/income-summary',
    page: 'Income Summary',
    content: /Total (Payment|Income)/,
    id: 'PERM-041',
  },
  {
    gate: 'daily_income',
    route: '/incomes/income-daily',
    page: 'Daily Sale Report',
    content: /Total Order/,
    id: 'PERM-042',
  },
  {
    gate: 'staff_income',
    route: '/incomes/income-staff',
    page: 'Staff Income',
    content: /Total staff income/,
    id: 'PERM-040, PERM-043',
  },
  {
    gate: 'staff_payroll',
    route: '/incomes/staff-payroll',
    page: 'Staff Payroll',
    content: /Current Period|Total staff income/,
    id: 'PERM-044',
  },
  {
    gate: 'batch_history',
    route: '/batch-history',
    page: 'Batch History',
    content: /Batch Number|Batch/,
    id: 'PERM-045',
  },
  {
    gate: 'view_order_history',
    route: '/order-history',
    page: 'Order History',
    content: /Order History/,
    id: 'PERM-052',
  },
  {
    gate: 'settings_page',
    route: '/settings/business',
    page: 'Merchant Settings Page',
    content: /Business Info/,
    id: 'PERM-054',
  },
  {
    gate: 'time_tracking',
    route: '/time-tracking',
    page: 'Time Tracking',
    content: /Date IN|Time Tracking/,
    id: 'PERM-055',
  },
] as const;
