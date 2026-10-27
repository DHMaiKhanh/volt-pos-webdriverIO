/**
 * Selectors for the volt-qc 04 PROMO / 05 SPLIT port
 * (`tests/regression/volt-qc/promo-split/*`).
 *
 * Same vocabulary as `testids.voltqc-pos.ts`: {@link VqcQuery} chains resolved
 * by `src/pages/voltqc/pos/VoltQcProbe.ts`. Build 1.1.x strips nearly every
 * `data-testid`, so — exactly like the volt-qc Playwright suite — everything is
 * reached by ARIA role + the app's en-US label (`src/locales/en/common.json`).
 */

import { btn, btnRe, inMain, inTopDialog, type VqcQuery } from './testids.voltqc-pos.js';

export const VqpsMain: VqcQuery = { css: 'main' };

/* ------------------------------------------------------------------------- *
 * Home / order panel
 * ------------------------------------------------------------------------- */

export const VqpsHome = {
  promoButton: btn('Promo & Rewards', 0),
  payButton: btn('Pay', 0),
  removeOrder: btn('Remove', 0),
  deleteOrderDialog: { role: 'dialog', name: 'Delete Order', nth: -1 } as VqcQuery,
  removeItemDialog: { role: 'dialog', name: 'Remove Service Item', nth: -1 } as VqcQuery,
  changeStaff: inMain(btn('Change Staff', 0)),
  /** The orange Split button of the order panel. */
  splitButton: inMain({ css: 'button.bg-orange', nth: 0 }),
  mergeOrder: inMain({ text: 'Merge Order' }),
  quickPayTile: inMain({ role: 'heading', name: 'Quick Pay', nth: 0 }),
  /** Quick Pay dialog (has "Custom Amount"). */
  quickPayDialog: { role: 'dialog', hasText: 'Custom Amount', nth: -1 } as VqcQuery,
  selectStaffFirst: { role: 'dialog', hasText: 'Select Staff First', nth: -1 } as VqcQuery,
  noteButton: btn('Note', 0),
  orderNoteDialog: { role: 'dialog', hasText: 'Order Note', nth: -1 } as VqcQuery,
  customerPlaceholder: 'Enter Customer Phone, Name or Email',
  pendingSidebar: { role: 'complementary', name: 'Pending Orders sidebar' } as VqcQuery,
  appliedToast: { css: '[data-sonner-toast]', hasText: 'Promo & Rewards applied successfully' } as VqcQuery,
  removeCustomerDialog: { role: 'dialog', name: 'Remove Customer Phone', nth: -1 } as VqcQuery,
  customerBarCss: 'main div.bg-turquoise-topaz-20',
} as const;

/* ------------------------------------------------------------------------- *
 * Promo & Rewards dialog
 * ------------------------------------------------------------------------- */

export const VqpsPromo = {
  dialog: { role: 'dialog', hasText: 'Promo & Rewards', nth: -1 } as VqcQuery,
  loadedRe: "No promotions available|Promotions and rewards don't apply to gift cards|Custom Discount",
  tabPercent: 'Percentage %',
  tabAmount: 'Amount $',
  ownerLabel: 'Percent for owner',
  staffLabel: 'Percent for staff',
  splitSetting: 'Order promotion discount setting',
  noRewards: 'No rewards available',
  maxPercent: 'Maximum discount is 100%',
  splitError: 'Percent must be a whole number between 0 and 100',
  giftOnly: "Promotions and rewards don't apply to gift cards",
} as const;

/* ------------------------------------------------------------------------- *
 * Checkout
 * ------------------------------------------------------------------------- */

export const VqpsCheckout = {
  complete: btn('Complete Payment', 0),
  methods: ['Card', 'Cash', 'Gift Card', 'Other'] as const,
  inputGiftCard: btn('Input Gift Card Code', 0),
  gcCodeDialog: { role: 'dialog', hasText: 'Enter Gift Card Code', nth: -1 } as VqcQuery,
  gcResultDialog: {
    role: 'dialog',
    hasTextRe: 'Gift Card Accepted|not valid|Insufficient|not enough|not Enough Balance',
    flags: 'i',
    nth: -1,
  } as VqcQuery,
  cashierTipDialog: { role: 'dialog', hasText: 'Enter Amount', hasCss: 'button', nth: -1 } as VqcQuery,
  otherNamePlaceholder: 'Input payment method name',
  editOrder: btn('Edit Order', 0),
  reopenDone: btn('Re-Open Done', 0),
} as const;

/* ------------------------------------------------------------------------- *
 * Split order (/order/<uuid>/split-order)
 * ------------------------------------------------------------------------- */

export const VqpsSplit = {
  chooseCheck: 'Choose the check to pay',
  mode: (m: string): readonly VqcQuery[] => inMain(btn(m)),
  method: (m: string): readonly VqcQuery[] => inMain(btn(m)),
  pay: inMain(btnRe('^Pay\\s*\\$[\\d,.]+$', 0)),
  tip: inMain(btn('Tip', 0)),
  cashDrawer: inMain(btnRe('^Cash\\s*Drawer$', 0)),
  addCheck: inMain(btn('Add New Check', 0)),
  completeDone: inMain(btn('Complete Done', 0)),
  backToOrder: inMain(btnRe('Back to order', 0)),
  select: (id: string, n: number): readonly VqcQuery[] =>
    inMain({ css: `[aria-label="Select #${id}-${String(n)}"]`, nth: 0 }),
  paidMark: (id: string, n: number): readonly VqcQuery[] =>
    inMain({ css: `[aria-label="Check Successful #${id}-${String(n)}"]`, nth: 0 }),
  del: (id: string, n: number): readonly VqcQuery[] =>
    inMain({ css: `[aria-label="Delete #${id}-${String(n)}"]`, nth: 0 }),
  voidBtn: (id: string, n: number): readonly VqcQuery[] =>
    inMain({ css: `[aria-label="Void #${id}-${String(n)}"]`, nth: 0 }),
  cashDialog: (n: number): VqcQuery => ({
    role: 'dialog',
    hasCss: 'button',
    hasText: `Complete Check ${String(n)}`,
    nth: -1,
  }),
  otherDialog: { role: 'dialog', hasText: 'Other Payment', nth: -1 } as VqcQuery,
  paidDialog: (n: number): VqcQuery => ({
    role: 'dialog',
    name: `Check ${String(n)} Paid Successfully`,
    nth: -1,
  }),
  voidDialog: { role: 'dialog', name: 'Void Payment', nth: -1 } as VqcQuery,
  voidOk: { role: 'dialog', name: 'Void Payment Successful!', nth: -1 } as VqcQuery,
  amountKeypad: { css: '[data-radix-popper-content-wrapper]', hasText: '00', nth: -1 } as VqcQuery,
  splitTipDialog: { role: 'dialog', hasText: 'Total tip', nth: -1 } as VqcQuery,
  allPaid: 'All checks paid',
} as const;

/* ------------------------------------------------------------------------- *
 * Payment success / order history
 * ------------------------------------------------------------------------- */

export const VqpsSuccess = {
  title: 'Payment Successful!',
  noReceipt: btn('No Receipt', 0),
  splitTip: btn('Split Tip', 0),
} as const;

export const VqpsHistory = {
  heading: { role: 'heading', name: 'Order History' } as VqcQuery,
  search: inMain({ role: 'textbox', name: 'Search order ID, customer name or phone' }),
  rowCss: 'main a[href^="/order-history/"]',
  cancelOrder: inMain(btn('Cancel Order', 0)),
  cancelDialog: { role: 'dialog', name: 'Cancel Order', nth: -1 } as VqcQuery,
  reopen: inMain(btn('Re-Open Order', 0)),
  reopenConfirm: { role: 'dialog', name: 'Re-Open Order?', nth: -1 } as VqcQuery,
  adjustTip: inMain(btn('Adjust Tip', 0)),
} as const;

/* ------------------------------------------------------------------------- *
 * Customer display (second window)
 * ------------------------------------------------------------------------- */

export const VqpsCustomer = {
  addTip: { textRe: '^Add a tip', nth: 0 } as VqcQuery,
  noTip: btn('No Tip', 0),
  customTip: btn('Custom Tip', 0),
  cont: btn('Continue', 0),
  yes: btn('Yes', 0),
  earned: "Congrats! You've earned",
} as const;

/** Close button (sr-only "Close") of the top-most dialog. */
export const vqpsTopClose = inTopDialog(btn('Close', 0));
