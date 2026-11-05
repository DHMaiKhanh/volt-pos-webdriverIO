/**
 * VP-5634 — receipt service lines carry the Service fee when items are not
 * grouped. Selectors for the print buttons the ticket touches and the Order
 * History Payment Method filter (volt-qc chain queries, see VoltQcProbe).
 */

import type { VqcQuery } from './testids.voltqc-cd-e2e.js';

const dialog = (text: string): VqcQuery => ({ role: 'dialog', hasText: text, nth: -1 });

export const VpReceiptSf = {
  /** "Print" on checkout (right panel) and on Payment Successful. */
  printButton: { role: 'button', name: 'Print', nth: 0 } as VqcQuery,

  /** Settings → Receipt screen-level Save. */
  settingsSave: [{ css: 'main' }, { role: 'button', name: 'Save', nth: 0 }] as readonly VqcQuery[],
  settingsSavedToast: /Receipt settings updated successfully/,

  /** Order History → filter funnel → Payment Method = Card → Confirm. */
  historyFilterButton: [{ role: 'button', name: 'Filter', nth: 0 }] as readonly VqcQuery[],
  historyFilterDialog: dialog('Payment Method'),
  historyPaymentSelect: [
    dialog('Payment Method'),
    { css: 'button', hasText: 'Select payment method', nth: 0 },
  ] as readonly VqcQuery[],
  historyPaymentOption: (label: string): VqcQuery => ({ text: label, nth: -1 }),
  historyFilterTitle: [dialog('Payment Method'), { text: 'Filter', nth: 0 }] as readonly VqcQuery[],
  historyFilterConfirm: [
    dialog('Payment Method'),
    { role: 'button', name: 'Confirm', nth: 0 },
  ] as readonly VqcQuery[],

  /** Order detail → Receipt → "Receipt Details" dialog and its Print. */
  historyReceiptButton: [{ css: 'main' }, { role: 'button', name: 'Receipt', nth: 0 }] as readonly VqcQuery[],
  receiptDialog: dialog('Receipt Details'),
  receiptDialogPrint: [
    dialog('Receipt Details'),
    { role: 'button', name: 'Print', nth: 0 },
  ] as readonly VqcQuery[],
} as const;
