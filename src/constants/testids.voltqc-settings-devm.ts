/**
 * Selector catalogue for the volt-qc port of modules 11-settings (SET-*) and
 * 16-devm (DEVM-*) — `tests/regression/volt-qc/settings-devm/`.
 *
 * ## Why these are queries, not plain `Locator`s
 *
 * Build 1.1.x stripped nearly every `data-testid` on the Settings screens, so
 * the volt-qc Playwright suite reached them by role + accessible name + exact
 * text (`getByRole('button', { name: 'Edit', exact: true })`). WebDriver has
 * no such engine, and an XPath `//button[normalize-space()="Edit"]` returns the
 * FIRST match in document order — which, with Radix keeping closed dialogs and
 * a hidden "Products" panel mounted, is routinely an invisible copy.
 *
 * A {@link VqQuery} is resolved IN THE PAGE by
 * `src/pages/voltqc/settings-devm/VqProbe.ts`: CSS candidates, filtered to the
 * visible ones, matched on normalized text / aria-label, optionally scoped to
 * the smallest container that holds a given title. The probe then tags the
 * winner with a one-off attribute and clicks / types through real WebDriver
 * events, so React sees exactly what a tap would produce.
 *
 * DOM ids (`#passcode-gate-all`, `#turn-service-based`, `#customer-display-show-point`,
 * the receipt toggles…) are NOT testids and survived the strip; they are used
 * as-is. Labels are the English locale strings (`src/locales/en/common.json`)
 * — every case here runs with the till in English.
 */

/** How {@link VqQuery.text} is compared with an element's text / aria-label. */
export type VqMatch = 'exact' | 'contains' | 'regex';

export interface VqQuery {
  /** Human name used in failure messages. */
  readonly name: string;
  /** CSS candidates. With {@link label} set: the control to pick inside the labelled field. */
  readonly css: string;
  /** Text (or aria-label) the element must carry. */
  readonly text?: string;
  /** Default `exact`. `regex` takes {@link text} as a RegExp source. */
  readonly match?: VqMatch;
  /** Resolve to the control labelled by a `<label>` with exactly this text. */
  readonly label?: string;
  /** Scope CSS: search only inside these containers. */
  readonly within?: string;
  /** Keep only scopes holding a descendant whose whole text is exactly this. */
  readonly withinText?: string;
  /** Pick the n-th match (0-based) after filtering. */
  readonly nth?: number;
  /** Consider elements that are not rendered (display:none / no box). */
  readonly hidden?: boolean;
  /**
   * After resolving, climb from the match to the first ancestor holding `until`,
   * and return its visible `css` descendants (optionally with exactly `text`) —
   * all of them, or only number `nth` (negative counts from the end).
   * Reaches a control that has no label of its own — a weekday's time pickers
   * from the day switch, the "+" next to the Reorder button.
   */
  readonly up?: {
    readonly until: string;
    readonly css: string;
    readonly nth?: number;
    readonly text?: string;
  };
}

const q = (query: VqQuery): VqQuery => query;

/** Scope CSS used by several queries. */
export const VqScope = {
  main: 'main',
  /** The settings rail — the only `<aside>` while the app drawer is closed. */
  rail: 'aside',
  dialog: '[role="dialog"]',
  alertDialog: '[role="alertdialog"]',
  card: '[data-slot="card"]',
  /** A popover (Radix portals them into this wrapper). */
  popover: '[data-radix-popper-content-wrapper]',
  table: 'table',
} as const;

const BUTTON = 'button, [role="button"]';

export const Vq = {
  /* --------------------------- generic -------------------------------- */

  /** Any element whose whole text is exactly `text`. */
  text: (text: string, within?: string, withinText?: string): VqQuery =>
    q({ name: `text "${text}"`, css: '*', text, within, withinText }),

  /** Any element whose text contains `text`. */
  textContaining: (text: string, within?: string, withinText?: string): VqQuery =>
    q({ name: `text containing "${text}"`, css: '*', text, match: 'contains', within, withinText }),

  /** Any element whose text matches a RegExp source. */
  textMatching: (source: string, within?: string, withinText?: string): VqQuery =>
    q({ name: `text /${source}/`, css: '*', text: source, match: 'regex', within, withinText }),

  /** A button by its exact label or aria-label. */
  button: (text: string, within?: string, withinText?: string): VqQuery =>
    q({ name: `button "${text}"`, css: BUTTON, text, within, withinText }),

  /** A button whose label matches a RegExp source. */
  buttonMatching: (source: string, within?: string, withinText?: string): VqQuery =>
    q({ name: `button /${source}/`, css: BUTTON, text: source, match: 'regex', within, withinText }),

  /** Every button in a scope (for counting / listing). */
  anyButton: (within?: string, withinText?: string): VqQuery =>
    q({ name: 'any button', css: BUTTON, within, withinText }),

  /** An element by DOM id. */
  id: (id: string): VqQuery => q({ name: `#${id}`, css: `[id="${id}"]` }),

  /** Every element whose id starts with `prefix`. */
  idPrefix: (prefix: string): VqQuery => q({ name: `[id^=${prefix}]`, css: `[id^="${prefix}"]` }),

  /** The control a `<label>` with exactly this text points at. */
  labelled: (label: string, within?: string, withinText?: string, css = ''): VqQuery =>
    q({ name: `field "${label}"`, css, label, within, withinText }),

  /** An input / textarea by its react-hook-form `name`. */
  named: (name: string, within?: string): VqQuery =>
    q({ name: `[name=${name}]`, css: `input[name="${name}"], textarea[name="${name}"]`, within }),

  /** An input / textarea by placeholder. */
  placeholder: (placeholder: string, within?: string, withinText?: string): VqQuery =>
    q({
      name: `placeholder "${placeholder}"`,
      css: `input[placeholder="${placeholder}"], textarea[placeholder="${placeholder}"]`,
      within,
      withinText,
    }),

  tab: (text: string, within?: string): VqQuery =>
    q({ name: `tab "${text}"`, css: '[role="tab"]', text, within }),

  option: (text: string): VqQuery => q({ name: `option "${text}"`, css: '[role="option"]', text }),

  anyOption: (): VqQuery => q({ name: 'any option', css: '[role="option"]' }),

  /** Radix switches / checkboxes / radios in a scope. */
  switches: (within?: string, withinText?: string): VqQuery =>
    q({ name: 'switches', css: '[role="switch"]', within, withinText }),

  disabledSwitches: (within?: string, withinText?: string): VqQuery =>
    q({
      name: 'disabled switches',
      css: '[role="switch"]:disabled, [role="switch"][data-disabled], [role="switch"][aria-disabled="true"]',
      within,
      withinText,
    }),

  checkbox: (text: string, within?: string, withinText?: string): VqQuery =>
    q({ name: `checkbox "${text}"`, css: '[role="checkbox"]', text, within, withinText }),

  anyCheckbox: (within?: string, withinText?: string): VqQuery =>
    q({ name: 'checkboxes', css: '[role="checkbox"], input[type="checkbox"]', within, withinText }),

  combobox: (within?: string, withinText?: string): VqQuery =>
    q({ name: 'combobox', css: 'button[role="combobox"]', within, withinText }),

  /** Validation messages (`form-message` on the old forms, `field-error` on the new). */
  formMessages: (within?: string, withinText?: string): VqQuery =>
    q({
      name: 'form messages',
      css: '[data-slot="form-message"], [data-slot="field-error"]',
      within,
      withinText,
    }),

  /** Table header cells in a scope. */
  th: (text: string, within?: string, withinText?: string): VqQuery =>
    q({ name: `th "${text}"`, css: 'th', text, within, withinText }),

  thMatching: (source: string, within?: string): VqQuery =>
    q({ name: `th /${source}/`, css: 'th', text: source, match: 'regex', within }),

  tableRows: (within?: string, withinText?: string): VqQuery =>
    q({ name: 'table rows', css: 'tbody tr', within, withinText }),

  /** Headings of any level, plus shadcn card titles. */
  headings: (within: string = VqScope.main): VqQuery =>
    q({ name: 'headings', css: 'h1, h2, h3, h4, [data-slot="card-title"]', within }),

  heading: (text: string, within: string = VqScope.main): VqQuery =>
    q({ name: `heading "${text}"`, css: 'h1, h2, h3, h4, [data-slot="card-title"]', text, within }),

  cardTitles: (): VqQuery =>
    q({ name: 'card titles', css: '[data-slot="card-title"]', within: VqScope.main }),

  images: (within?: string, withinText?: string): VqQuery =>
    q({ name: 'images', css: 'img', within, withinText }),

  svgs: (within?: string, withinText?: string): VqQuery =>
    q({ name: 'svgs', css: 'svg', within, withinText }),

  /* --------------------------- chrome --------------------------------- */

  /** Every link in the settings rail. */
  railLinks: (): VqQuery =>
    q({ name: 'settings rail links', css: 'a[href^="/settings/"]', within: VqScope.rail }),

  /** One settings rail link by its label. */
  railLink: (label: string): VqQuery =>
    q({ name: `rail link "${label}"`, css: 'a[href^="/settings/"]', text: label, within: VqScope.rail }),

  /** The settings rail container. */
  rail: (): VqQuery => q({ name: 'settings rail', css: VqScope.rail }),

  mainArea: (): VqQuery => q({ name: 'main', css: VqScope.main }),

  body: (): VqQuery => q({ name: 'body', css: 'body' }),

  /** The open app drawer (Radix Sheet). */
  appDrawer: (): VqQuery =>
    q({ name: 'app drawer', css: '[data-slot="sidebar"], [data-slot="sheet-content"]' }),

  alertDialog: (): VqQuery => q({ name: 'alert dialog', css: VqScope.alertDialog }),

  anyDialog: (): VqQuery => q({ name: 'any dialog', css: VqScope.dialog }),

  alertButton: (text: string): VqQuery =>
    q({ name: `alert button "${text}"`, css: BUTTON, text, within: VqScope.alertDialog }),

  /** A dialog by its title text. */
  dialog: (title: string): VqQuery =>
    q({ name: `dialog "${title}"`, css: VqScope.dialog, text: title, match: 'contains' }),

  /** The dialog header's close (X) button. */
  dialogClose: (title: string): VqQuery =>
    q({
      name: `dialog "${title}" close`,
      css: 'button[aria-label="Close"], button[data-slot="dialog-close"], button',
      text: 'Close',
      within: VqScope.dialog,
      withinText: title,
    }),

  /** Sonner toast containing a text. */
  toast: (text: string): VqQuery =>
    q({ name: `toast "${text}"`, css: '[data-sonner-toast]', text, match: 'contains', hidden: true }),

  /** The app's environment badge (dev builds only). */
  envBadge: (): VqQuery => q({ name: 'env badge', css: '[data-testid="env-badge"]' }),
} as const;

/* ------------------------------------------------------------------------- *
 * Screen-specific queries
 * ------------------------------------------------------------------------- */

export const WEEKDAYS_VQ = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type VqDay = (typeof WEEKDAYS_VQ)[number];

/** The settings rail, as `settings-sidebar.tsx` renders it (group, then its links). */
export const SETTINGS_NAV_VQ: readonly {
  group: string;
  links: readonly { label: string; path: string; heading: string }[];
}[] = [
  {
    group: 'Store & Account',
    links: [{ label: 'Business Info', path: '/settings/business', heading: 'Business Info' }],
  },
  {
    group: 'Service & Staff',
    links: [{ label: 'Services & Products', path: '/settings/services', heading: 'Category' }],
  },
  {
    group: 'Employees Management',
    links: [
      { label: 'Employees', path: '/settings/staffs', heading: 'All Employees' },
      { label: 'Roles', path: '/settings/roles', heading: 'Roles' },
      { label: 'Permissions', path: '/settings/permissions', heading: 'Permissions' },
    ],
  },
  {
    group: 'Payment & Receipt',
    links: [
      { label: 'Tipping Settings', path: '/settings/payment-transaction', heading: 'Tipping Settings' },
      { label: 'Charge & Fee', path: '/settings/charge-fee', heading: 'Charge & Fee' },
      { label: 'Receipt', path: '/settings/receipt', heading: 'Receipt Setting' },
    ],
  },
  {
    group: 'General',
    links: [
      { label: 'Accessibility', path: '/settings/accessibility', heading: 'Accessibility' },
      { label: 'Language', path: '/settings/language', heading: 'Language' },
    ],
  },
];

/** Passcode Setting gates by group (Accessibility › Passcode Setting). */
export const PASSCODE_GATES_VQ: Readonly<Record<string, readonly string[]>> = {
  Reports: ['summary_income', 'daily_income', 'staff_income', 'staff_payroll', 'batch_history'],
  Orders: [
    'complete_order',
    'cancel_order',
    'refund',
    'reopen_order',
    'delete_order',
    'view_order_history',
    'quick_pay',
  ],
  Others: ['open_cash_drawer', 'settings_page', 'time_tracking'],
};

/** Permissions matrix: parent rows and their children (volt-qc `flows/settings.ts`). */
export const PERMISSION_GROUPS_VQ: readonly { parent: string; children: readonly string[] }[] = [
  {
    parent: 'Order Management',
    children: [
      'Edit Order',
      'Cancel Order (Void)',
      'Refund',
      'Completed Payment',
      'Delete Order',
      'Order History',
    ],
  },
  { parent: 'Income', children: ['Summary Income', 'Daily Income', 'Staff Income', 'Staff Payroll'] },
  { parent: 'Batch Management', children: ['Batch History', 'Batch Close'] },
  { parent: 'Cash Drawer', children: ['Open Cash Drawer'] },
  { parent: 'System Setting', children: ['POS Settings', 'View Phone Number', 'View Time Tracking'] },
];

export const ROLES_VQ = ['Owner', 'Manager', 'Partner', 'Staff'] as const;
export type VqRole = (typeof ROLES_VQ)[number];

export const VqBusiness = {
  /** A button in the Business Info header bar (Edit / Save / Cancel / refresh). */
  headerButton: (text: string): VqQuery =>
    q({
      name: `Business Info header "${text}"`,
      css: 'h1, h2, h3',
      text: 'Business Info',
      within: VqScope.main,
      up: { until: 'button', css: 'button', text },
    }),
  previewImages: (): VqQuery =>
    q({ name: 'preview images', css: 'img[alt="Preview"]', within: VqScope.main }),
  /** View mode marks the form container `data-readonly="true"`. */
  readonlyContainer: (): VqQuery =>
    q({ name: 'readonly form container', css: '[data-readonly]', hidden: true }),
  daySwitch: (day: VqDay): VqQuery =>
    q({ name: `Open on ${day}`, css: `[role="switch"][aria-label="Open on ${day}"], [id="${day}"]` }),
  /** One of a weekday's two `type="time"` pickers (0 = open, 1 = close), reached from its switch. */
  dayTime: (day: VqDay, which: 0 | 1): VqQuery =>
    q({
      name: `${day} time ${String(which)}`,
      css: `[role="switch"][aria-label="Open on ${day}"], [id="${day}"]`,
      up: { until: 'input', css: 'input[type="time"]', nth: which },
    }),
  payPeriodRadio: (type: 'weekly' | 'biweekly' | 'monthly' | 'custom'): VqQuery =>
    Vq.id(`pay-period-${type}`),
  /** Current-plan card: the testid was stripped, so the card holding the "Current plan" title. */
  currentPlan: (): VqQuery =>
    q({
      name: 'current plan card',
      css: '[data-testid="pay-period-current"], [data-slot="card"], div',
      text: 'Current plan',
      match: 'contains',
    }),
  scheduledPlan: (): VqQuery =>
    q({
      name: 'scheduled change card',
      css: '[data-testid="pay-period-scheduled"], [data-slot="card"], div',
      text: 'Scheduled change',
      match: 'contains',
    }),
  payrollDatesTrigger: (): VqQuery =>
    q({
      name: 'payroll dates trigger',
      css: BUTTON,
      text: '^(Select payroll dates|\\d{1,2}(, \\d{1,2})*)$',
      match: 'regex',
      within: VqScope.main,
    }),
  payrollPopover: (): VqQuery =>
    q({
      name: 'Set Payroll Dates popover',
      css: VqScope.popover,
      text: 'Set Payroll Dates',
      match: 'contains',
    }),
  payrollDay: (day: number): VqQuery =>
    q({
      name: `payroll day ${String(day)}`,
      css: '[data-slot="toggle-group-item"]',
      text: String(day),
      within: VqScope.popover,
      withinText: 'Set Payroll Dates',
    }),
  payrollDaysOn: (): VqQuery =>
    q({
      name: 'selected payroll days',
      css: '[data-slot="toggle-group-item"][data-state="on"]',
      within: VqScope.popover,
      withinText: 'Set Payroll Dates',
    }),
} as const;

/** Business Info fields by react-hook-form name (the 1.1.56 dump — see testids.settings-business-extra.ts). */
export const BUSINESS_FIELD_NAMES_VQ = {
  'Business Name': 'businessName',
  'Legal Name': 'legalName',
  'Business phone': 'businessPhone',
  Website: 'website',
  Address: 'address',
  City: 'city',
  'Postal / Zip Code': 'postalCode',
} as const;
export type VqBusinessField = keyof typeof BUSINESS_FIELD_NAMES_VQ;

export const VqAccessibility = {
  gateAll: (): VqQuery => Vq.id('passcode-gate-all'),
  gate: (id: string): VqQuery => Vq.id(`passcode-gate-${id}`),
  gates: (): VqQuery =>
    q({ name: 'passcode gates', css: '[id^="passcode-gate-"]:not([id="passcode-gate-all"])' }),
  showPoint: (): VqQuery => Vq.id('customer-display-show-point'),
  showReward: (): VqQuery => Vq.id('customer-display-show-reward'),
} as const;

export const VqLanguage = {
  en: (): VqQuery => Vq.id('en'),
  vi: (): VqQuery => Vq.id('vi'),
} as const;

export const VqRoles = {
  staffLinks: (): VqQuery =>
    q({ name: 'role member rows', css: 'a[href^="/settings/staffs/"]', within: VqScope.main }),
  assignButton: (): VqQuery => Vq.buttonMatching('^Assign to'),
  assignDialog: (): VqQuery =>
    q({ name: 'assign dialog', css: VqScope.dialog, text: 'Assign to', match: 'contains' }),
  assignItemCheckbox: (nth = 0): VqQuery =>
    q({
      name: 'assign item checkbox',
      css: 'li [role="checkbox"], li input[type="checkbox"]',
      within: VqScope.dialog,
      nth,
    }),
  assignItems: (text?: string): VqQuery =>
    q({ name: 'assign items', css: 'li', text, match: 'contains', within: VqScope.dialog }),
} as const;

export const VqServices = {
  categoryList: '#category-list-container',
  categoryLinks: (): VqQuery =>
    q({ name: 'category links', css: 'a[href^="/settings/services/"]', within: VqScope.main }),
  categoryLink: (name: string): VqQuery =>
    q({
      name: `category ${name}`,
      css: 'a[href^="/settings/services/"]',
      text: `^${escapeRegex(name)}(\\s|$)`,
      match: 'regex',
      within: VqScope.main,
    }),
  /** The Update (pencil) button inside one category entry. */
  categoryUpdate: (name: string): VqQuery =>
    q({
      name: `update ${name}`,
      css: 'button',
      text: 'Update',
      within: 'a[href^="/settings/services/"]',
      withinText: name,
    }),
  reorderButton: (): VqQuery => Vq.buttonMatching('Reorder Categories or Services'),
  visibleH2: (): VqQuery => q({ name: 'visible h2', css: 'h2', within: VqScope.main }),
  flexiblePricing: (): VqQuery => Vq.id('flexible-pricing'),
  /** Hours (0) / minutes (1) select of the Add New Item dialog's Service Duration. */
  durationSelect: (which: 0 | 1): VqQuery =>
    q({
      name: `service duration select ${String(which)}`,
      css: 'button[role="combobox"]',
      within: '[data-slot="form-item"], [data-slot="field"]',
      withinText: 'Service Duration',
      nth: which,
    }),
  categorySelect: (): VqQuery =>
    q({
      name: 'category name select',
      css: 'button[role="combobox"]',
      within: '[data-slot="form-item"], [data-slot="field"]',
      withinText: 'Category Name',
    }),
  /** The switch beside one Visibility Setting row ("Shown on Go POS"…); `Status` is the card's first. */
  visibilitySwitch: (label: string): VqQuery =>
    q({ name: `visibility switch "${label}"`, css: '[role="switch"]', within: 'div', withinText: label }),
  visibilityStatusSwitch: (): VqQuery =>
    q({
      name: 'visibility status switch',
      css: '[role="switch"]',
      within: VqScope.card,
      withinText: 'Visibility Setting',
    }),
} as const;

export const VqStaff = {
  list: (): VqQuery => q({ name: 'staff links', css: 'a[href^="/settings/staffs/"]', within: VqScope.main }),
  status: (): VqQuery => Vq.id('status'),
} as const;

export const VqChargeFee = {
  serviceTax: (): VqQuery => Vq.id('charge-fee-service-tax'),
  discountOwner: (): VqQuery => Vq.id('discount-setting-owner'),
  discountStaff: (): VqQuery => Vq.id('discount-setting-staff'),
  turnServiceBased: (): VqQuery => Vq.id('turn-service-based'),
  turnDecimal: (): VqQuery => Vq.id('turn-decimal'),
  /** A section card by its `<h4>` title — the smallest container holding it. */
  sectionWithin: (title: string): { within: string; withinText: string } => ({
    within: 'div, section, form',
    withinText: title,
  }),
  sectionError: (title: string): VqQuery =>
    q({ name: `${title} error`, css: 'p.text-destructive', within: 'div, section, form', withinText: title }),
  turnValue: (): VqQuery =>
    q({
      name: 'turn value input',
      css: 'input:not([role="switch"])',
      within: 'div, section, form',
      withinText: 'Turn Settings',
    }),
} as const;

export const VqTipping = {
  timingBefore: (): VqQuery => Vq.id('charge-fee-tip-timing-before'),
  timingAfter: (): VqQuery => Vq.id('charge-fee-tip-timing-after'),
  typePercent: (): VqQuery => Vq.id('charge-fee-tip-type-percent'),
  typeAmount: (): VqQuery => Vq.id('charge-fee-tip-type-amount'),
  signatureBefore: (): VqQuery => Vq.id('tipping-signature-timing-before'),
  signatureAfter: (): VqQuery => Vq.id('tipping-signature-timing-after'),
  tipRows: (): VqQuery => q({ name: 'tip option rows', css: 'tbody tr', within: VqScope.main }),
  rowEdit: (row: number): VqQuery =>
    q({ name: `edit tip row ${String(row)}`, css: 'button[aria-label="Edit Tip Option"]', nth: row }),
  rowDelete: (row: number): VqQuery =>
    q({ name: `delete tip row ${String(row)}`, css: 'button[aria-label="Delete Tip Option"]', nth: row }),
  /** The inline input of the row being edited (second cell). */
  rowInput: (): VqQuery => q({ name: 'inline tip input', css: 'tbody tr td:nth-child(2) input' }),
  dialogPercent: (): VqQuery => Vq.labelled('Percentage', VqScope.dialog),
} as const;

/** The Tip Option table: the visible `<table>` carrying a "Tip Suggestion" header. */
export const VqTipTableCss = { table: 'table', header: 'Tip Suggestion' } as const;

/** The receipt preview "paper" (`receipt-preview.tsx`). */
const RECEIPT_PAPER = 'div.paper';

export const VqReceipt = {
  paper: RECEIPT_PAPER,
  /** A receipt form toggle by id — scoped to the form (`#tip`, `#total` repeat elsewhere). */
  toggle: (id: string): VqQuery => q({ name: `receipt toggle #${id}`, css: `[id="${id}"]`, within: 'form' }),
  textarea: (id: string): VqQuery =>
    q({ name: `receipt textarea #${id}`, css: `[id="${id}"]`, within: 'form' }),
  /** One preview line: a `<p>` whose whole text is `label`. */
  line: (label: string): VqQuery =>
    q({ name: `preview line "${label}"`, css: 'p', text: label, within: RECEIPT_PAPER }),
  previewText: (source: string): VqQuery =>
    q({ name: `preview /${source}/`, css: '*', text: source, match: 'regex', within: RECEIPT_PAPER }),
  previewContains: (text: string): VqQuery =>
    q({ name: `preview contains "${text}"`, css: '*', text, match: 'contains', within: RECEIPT_PAPER }),
  previewExact: (text: string): VqQuery =>
    q({ name: `preview "${text}"`, css: '*', text, within: RECEIPT_PAPER }),
  paperEl: (): VqQuery => q({ name: 'receipt paper', css: RECEIPT_PAPER }),
  images: (): VqQuery => q({ name: 'preview images', css: 'img', within: RECEIPT_PAPER }),
  svgs: (): VqQuery => q({ name: 'preview svgs', css: 'svg', within: RECEIPT_PAPER }),
  maskedPhone: (): VqQuery =>
    q({
      name: 'masked phone',
      css: '*',
      text: String.raw`\*\*\*-\*\*\*-\d{4}`,
      match: 'regex',
      within: RECEIPT_PAPER,
    }),
  formMessages: (): VqQuery => Vq.formMessages(VqScope.main),
} as const;

/** The marker attribute the probe stamps on a resolved element before acting on it. */
export const VQ_MARK_ATTR = 'data-vq-mark';

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
