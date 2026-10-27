/**
 * Selectors for the volt-qc HOME / PEND WRITE ports (`tests/regression/volt-qc/home-pend/*`).
 *
 * Same vocabulary as `testids.voltqc-pos.ts` (a {@link VqcQuery} chain resolved
 * by `src/pages/voltqc/pos/VoltQcProbe.ts`), extended with what the order-building
 * cases need: the order frame, the Quick Pay / line-editor dialogs, the customer
 * bar, the merge dialog and the pending sidebar.
 *
 * Every label is the app's en-US string as volt-qc recorded it
 * (`e2e/src/flows/home.ts`, `e2e/src/flows/pending.ts`, `e2e/src/pages/app.ts`).
 * Build 1.1.x ships almost no `data-testid`, so — like the source suite — these
 * key on role, accessible name, placeholder and the few stable Tailwind classes
 * volt-qc relied on (`div.pr-11` order line, `div.group.scroll-mt-4` staff group,
 * `div.h-24.bg-turquoise-topaz-20` customer bar, `button.bg-orange` Split).
 */

import { btn, btnRe, type VqcQuery } from './testids.voltqc-pos.js';

const MAIN: VqcQuery = { css: 'main' };

/** Escape a literal for use inside a `*Re` query. */
export const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------------- *
 * Pending Orders sidebar (Home)
 * ------------------------------------------------------------------------- */

const SIDEBAR: VqcQuery = { role: 'complementary', name: 'Pending Orders sidebar' };

export const VqhSidebar = {
  root: SIDEBAR,
  search: [SIDEBAR, { role: 'textbox', nth: 0 }] as readonly VqcQuery[],
  quickCheckout: [SIDEBAR, btn('Quick Checkout', 0)] as readonly VqcQuery[],
  cards: [SIDEBAR, btnRe('^\\s*OD\\d{6}-\\d+')] as readonly VqcQuery[],
  card: (id: string): readonly VqcQuery[] => [SIDEBAR, btnRe(`^\\s*${reEscape(id)}(?!\\d)`, 0)],
  /** `header` of the sidebar — "Pending Orders <badge>", date, clock. */
  header: [SIDEBAR, { css: 'header', nth: 0 }] as readonly VqcQuery[],
  badge: [SIDEBAR, { css: 'header span', nth: -1 }] as readonly VqcQuery[],
  title: [SIDEBAR, { text: 'Pending Orders' }] as readonly VqcQuery[],
} as const;

/* ------------------------------------------------------------------------- *
 * Order frame (Home centre panel)
 * ------------------------------------------------------------------------- */

export const VqhOrder = {
  /** Staff name spans on the staff grid (excludes the sidebar, which is an <aside>). */
  staffNameCss: 'main span.col-span-2.text-xl',
  staffTile: (name: string): VqcQuery => ({ css: 'main span.col-span-2.text-xl', text: name, nth: 0 }),
  /** Service tile name span (`li > … span.block`). Clicking it bubbles to the tile. */
  serviceTile: (name: string): VqcQuery => ({ css: 'main li span.block', text: name, nth: 0 }),
  /** One order line row. */
  lineCss: 'main div.pr-11',
  /** Line row whose name span is exactly `name`. */
  line: (name: string, nth = 0): readonly VqcQuery[] => [
    { css: 'main div.pr-11', hasTextRe: reEscape(name), nth: undefined },
    { css: 'span.truncate', text: name, nth },
  ],
  /** Staff / Store group blocks in the order frame. */
  groupCss: 'main div.group.scroll-mt-4',
  pay: [MAIN, btn('Pay', 0)] as readonly VqcQuery[],
  /** Split = the orange icon button in the totals block. */
  split: { css: 'main button.bg-orange', nth: 0 } as VqcQuery,
  remove: [MAIN, btn('Remove', 0)] as readonly VqcQuery[],
  cancelOrder: [MAIN, btn('Cancel Order', 0)] as readonly VqcQuery[],
  changeStaff: [MAIN, btn('Change Staff', 0)] as readonly VqcQuery[],
  changeFrom: [MAIN, { textRe: '^Change from', nth: 0 }] as readonly VqcQuery[],
  mergeOrder: [MAIN, btn('Merge Order', 0)] as readonly VqcQuery[],
  note: [MAIN, btn('Note', 0)] as readonly VqcQuery[],
  promo: [MAIN, btn('Promo & Rewards', 0)] as readonly VqcQuery[],
  chooseService: [MAIN, { text: 'Choose service', nth: 0 }] as readonly VqcQuery[],
  orderNoteLabel: [MAIN, { css: 'strong', hasText: 'Order Note:', nth: 0 }] as readonly VqcQuery[],
  selectStaffFirst: { role: 'dialog', hasText: 'Select Staff First', nth: -1 } as VqcQuery,
  selectStaffFirstText: 'Please select a staff before choosing services.',
  /** The customer field while an order has staff: collapsed text, not the input. */
  customerSlot: [MAIN, { text: 'Enter Customer Phone, Name or Email', nth: 0 }] as readonly VqcQuery[],
  back: [MAIN, btn('Back', 0)] as readonly VqcQuery[],
  errorToast: { css: '[data-sonner-toast][data-type="error"]' } as VqcQuery,
} as const;

/* ------------------------------------------------------------------------- *
 * Dialogs
 * ------------------------------------------------------------------------- */

/** Radix dialogs by CSS (the virtual keyboard aria-hides the dialog beneath it). */
const dialog = (hasText: string): VqcQuery => ({ css: '[role="dialog"]', hasText, nth: -1 });
const alert = (name: string): VqcQuery => ({
  role: 'dialog',
  css: '[role="alertdialog"]',
  hasText: name,
  nth: -1,
});

export const VqhDialog = {
  quickPay: dialog('Custom Amount'),
  /** Quick Pay OR line editor — whichever is open (both carry "Apply Discount"). */
  editor: dialog('Apply Discount'),
  orderNote: dialog('Order Note'),
  merge: {
    css: '[role="dialog"]',
    hasText: 'Merge Order',
    hasCss: 'input[placeholder="Search order ID, customer name or phone"]',
    nth: -1,
  } as VqcQuery,
  quickAdd: {
    css: '[role="dialog"]',
    hasCss: 'input[placeholder="Enter customer name"]',
    nth: -1,
  } as VqcQuery,
  customerInfo: dialog('Customer Information'),
  timeKeeping: dialog('Time Keeping'),
  deleteOrder: alert('Delete Order'),
  removeService: alert('Remove Service Item'),
  removeStaff: alert('Remove Staff'),
  removeStore: alert('Remove Store'),
  removeCustomer: alert('Remove Customer Phone'),
  mergeConfirm: alert('Merge Orders'),
  changeStaffConfirm: {
    role: 'dialog',
    css: '[role="alertdialog"]',
    hasTextRe: 'Change from .* to .*\\?',
    nth: -1,
  } as VqcQuery,
  linkPending: alert('Link with pending order?'),
  customerSuggestions: {
    css: '[data-radix-popper-content-wrapper]',
    hasTextRe: 'Customers Found',
    nth: -1,
  } as VqcQuery,
  waitingTip: { css: '[role="dialog"]', hasTextRe: 'adding a tip', flags: 'i', nth: -1 } as VqcQuery,
  sellGiftCard: { role: 'dialog', name: 'Sell Gift Card', nth: -1 } as VqcQuery,
  /** Customer / quick-add dialogs close with the last header button (Escape does not). */
  headerCloseCss: '[data-slot="dialog-header"] button',
} as const;

/** Inside a dialog. */
export const inDlg = (d: VqcQuery, q: VqcQuery): readonly VqcQuery[] => [d, q];

export const VqhEditor = {
  amount: { css: 'input', placeholder: '0.00', nth: 0 } as VqcQuery,
  serviceName: { css: 'input', placeholder: 'Service Name', nth: 0 } as VqcQuery,
  note: { css: 'input,textarea', placeholder: 'Add note', nth: 0 } as VqcQuery,
  switch: { role: 'switch', nth: 0 } as VqcQuery,
  radio: (k: '%' | '$'): VqcQuery => ({ css: '[role="radio"]', name: k, nth: 0 }),
  /** The discount field is the dialog's last textbox (only while Apply Discount is on). */
  discount: { role: 'textbox', nth: -1 } as VqcQuery,
  add: btn('Add', 0),
  update: btn('Update', 0),
  save: btn('Save', 0),
  close: btn('Close', 0),
  reset: { css: '[aria-label="Reset amount"]', nth: 0 } as VqcQuery,
  zeroDiscountError: 'Discount amount must be greater than 0',
} as const;

/* ------------------------------------------------------------------------- *
 * Customer bar + passcode
 * ------------------------------------------------------------------------- */

export const VqhCustomer = {
  bar: { css: 'main div.h-24.bg-turquoise-topaz-20', nth: 0 } as VqcQuery,
  barButtons: [
    { css: 'main div.h-24.bg-turquoise-topaz-20', nth: 0 },
    { role: 'button' },
  ] as readonly VqcQuery[],
  groupChipCss: 'main div.h-24.bg-turquoise-topaz-20 span.bg-green',
  noCustomerFound: { text: 'No customer found', nth: 0 } as VqcQuery,
  nameBox: { css: 'input', placeholder: 'Enter customer name', nth: 0 } as VqcQuery,
} as const;

export const VqhPasscode = {
  skipLabel: 'Do not require passcode for the next 30 minutes',
  deleteOrderTitle: 'Enter staff code to access Delete Order',
  continueTitle: 'Enter staff code to continue',
  wrongCodeRe: 'Failed to verify staff code|Invalid staff code|Invalid passcode',
  inactiveText: 'This staff is inactive',
  noPermissionText: "You don't have permission for this action",
} as const;

/* ------------------------------------------------------------------------- *
 * /order-pending page (mutation cases)
 * ------------------------------------------------------------------------- */

export const VqhPendingPage = {
  card: (id: string): readonly VqcQuery[] => [MAIN, btnRe(`^\\s*${reEscape(id)}(?!\\d)`, 0)],
  staffPopover: {
    css: '[data-slot="popover-content"]',
    hasCss: 'input[placeholder="By Staff"]',
    nth: -1,
  } as VqcQuery,
  staffCheckbox: (name: string): readonly VqcQuery[] => [
    { css: '[data-slot="popover-content"]', hasCss: 'input[placeholder="By Staff"]', nth: -1 },
    { role: 'checkbox', name, nth: 0 },
  ],
  byStaff: { css: 'input', placeholder: 'By Staff', nth: 0 } as VqcQuery,
  inUseRe: 'In Use',
  openError: "Couldn't open pending orders. Please try again.",
  time12hRe: /\b\d{2}:\d{2} (AM|PM)\b/,
} as const;

/* ------------------------------------------------------------------------- *
 * Settings (virtual keyboard)
 * ------------------------------------------------------------------------- */

export const VqhSettings = {
  virtualKeyboardSwitch: { role: 'switch', name: 'Show the virtual keyboard', nth: 0 } as VqcQuery,
  virtualKeyboardCss: '.simple-keyboard',
  vkKey: (k: string): VqcQuery => ({ css: `.simple-keyboard [data-skbtn="${k}"]`, nth: 0 }),
} as const;
