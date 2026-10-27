/**
 * Selectors + copy for the volt-qc port of 07 ORDER HISTORY (OH-*) and 17 RE-OPEN (RO-*)
 * write cases (`tests/regression/volt-qc/oh-reopen/*`).
 *
 * Same {@link VqcQuery} vocabulary as `testids.voltqc-pos.ts` (role/name/text chains resolved
 * by `VoltQcProbe` in one round trip) — build 1.1.x strips most `data-testid`, so the port
 * addresses what the cashier reads. Strings are the en-US labels the volt-qc suite recorded
 * (`e2e/src/flows/order-history.ts`, `reopen.ts`, `pay.ts`).
 */

import { btn, type VqcQuery } from './testids.voltqc-pos.js';

/** Any open alertdialog whose text contains `hasText` (top-most). */
const alert = (hasText: string): VqcQuery => ({ css: '[role="alertdialog"]', hasText, nth: -1 });

export const OhRoDialogs = {
  reopen: alert('Re-Open Order?'),
  cancel: {
    css: '[role="alertdialog"]',
    hasText: 'Cancel Order',
    hasCss: '[role="combobox"]',
    nth: -1,
  } as VqcQuery,
  unableToCancel: alert('Unable to Cancel Order'),
  voidTransactions: alert('Void Order Transactions'),
  removeServiceItem: alert('Remove Service Item'),
  refund: {
    css: '[data-testid="order-refund-dialog"], [role="alertdialog"]',
    hasTextRe: 'Refund',
    hasCss: '[role="combobox"], [data-testid="oh-refund-reason-select"]',
    nth: -1,
  } as VqcQuery,
  adjustTip: { role: 'dialog', hasText: 'Current Tip', nth: -1 } as VqcQuery,
  adjustOrderTipList: { role: 'dialog', hasText: 'Adjust Order Tip', nth: -1 } as VqcQuery,
  splitTip: { role: 'dialog', hasTextRe: 'Split Tip|Split Evenly', nth: -1 } as VqcQuery,
  receipt: { role: 'dialog', hasText: 'Receipt Details', nth: -1 } as VqcQuery,
  customerPhone: { role: 'dialog', hasText: 'Customer Phone', nth: -1 } as VqcQuery,
  customerEmail: {
    role: 'dialog',
    hasTextRe: 'Customer Email|Send Email',
    hasCss: 'input',
    nth: -1,
  } as VqcQuery,
  itemEditor: { role: 'dialog', hasCss: 'textarea, input[placeholder="Add note"]', nth: -1 } as VqcQuery,
  passcode: { role: 'dialog', hasTextRe: 'Enter staff code|Nhập mã nhân viên', nth: -1 } as VqcQuery,
} as const;

export const OhRoButtons = {
  reopen: 'Re-Open Order',
  continueReopen: 'Continue Re-open',
  reopenDone: 'Re-Open Done',
  editOrder: 'Edit Order',
  cancelOrder: 'Cancel Order',
  keepOrder: 'Keep Order',
  confirmCancel: 'Confirm Cancel',
  adjustTip: 'Adjust Tip',
  splitTip: 'Split Tip',
  receipt: 'Receipt',
  print: 'Print',
  sendSms: 'Send SMS',
  sendEmail: 'Send Email',
  confirmVoid: 'Confirm Void',
  backToOrder: 'Back to Order',
  completePayment: 'Complete Payment',
} as const;

export const OhRoText = {
  reopenBody: 'Re-opening this order will allow you to edit items or payments before settlement.',
  /** Dialog sentence while the one money-edit is still available (VP-3914). */
  msgHasEdit: 'One edit of items, prices left',
  /** Dialog sentence once it was spent (VP-3913). */
  msgNoEdit: 'Items and prices are locked',
  voidBody: 'you must void all previous transactions and process a new payment',
  voidDone: 'Order transactions canceled successfully',
  noTips: 'No tips details available.',
  noNote: 'No note for this order.',
  statusUpdating: 'Status is being updated',
  printerNotConnected: /Printer not connected|No printer/i,
  orderHasPayment: 'Order already has a payment',
  cancelReasons: 7,
  maxReason: 80,
  maxTipCents: 1_000_000,
} as const;

/** Detail-pane action buttons (main › button by name). */
export const ohDetailButton = (name: string): VqcQuery => btn(name);

/** Checkout tender tile whose label starts with `<method> $` (Cash $12.00). */
export const tenderTile = (method: 'Card' | 'Cash' | 'Gift Card' | 'Other'): VqcQuery => ({
  role: 'button',
  nameRe: `^${method}\\s*\\$`,
  nth: 0,
});

/** Settings › Accessibility › Passcode Setting switch for one gate. */
export const passcodeGateSwitch = (gate: string): VqcQuery => ({
  css: `[id="passcode-gate-${gate}"]`,
  nth: 0,
});

export type PasscodeGate = 'view_order_history' | 'cancel_order' | 'refund' | 'reopen_order';

/** Cart service rows on Home (volt-qc `app.itemRow`: `div.pr-11`). */
export const CART_ROW_CSS = 'main div.pr-11';
