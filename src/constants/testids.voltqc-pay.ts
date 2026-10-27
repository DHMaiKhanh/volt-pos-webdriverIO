/**
 * Selectors for the specs ported from volt-qc module 03 — Checkout & payment
 * (`tests/regression/volt-qc/pay/*`, TC ids `PAY-*`).
 *
 * Same vocabulary as `testids.voltqc-pos.ts`: plain-data {@link VqcQuery}
 * chains resolved by `src/pages/voltqc/pos/VoltQcProbe.ts`. Build 1.1.x strips
 * almost every `data-testid`, so these address the app the way the volt-qc
 * suite did — by role, accessible name and the app's en-US labels
 * (`src/locales/en/common.json`). The ported specs assume an English till.
 *
 * Anything the shared page objects (`CheckoutPage`, `PaymentSuccessPage`,
 * `PasscodeDialog`, `CustomerDisplayPage`) already cover is NOT repeated here —
 * the specs call those. This file only carries what they do not expose: the
 * cashier Tip dialog, the gift-card code dialog's own controls, the receipt
 * SMS/Email dialogs and the checkout text anchors.
 */

import { btn, btnRe, inMain, type VqcQuery } from './testids.voltqc-pos.js';

/** The four tender buttons, in on-screen order, as the volt-qc suite names them. */
export const PAY_METHODS = ['Card', 'Cash', 'Gift Card', 'Other'] as const;
export type PayMethodLabel = (typeof PAY_METHODS)[number];

/** The cash quick-select column, top to bottom. */
export const QUICK_CASH = ['$5', '$10', '$50', '$100'] as const;

/** The cashier Tip dialog's preset column. They ADD to the current tip. */
export const TIP_PRESETS = ['$20', '$50', '$100', '$200'] as const;

const TIP_DIALOG: VqcQuery = { role: 'dialog', hasText: 'Enter Amount', hasCss: 'button', nth: -1 };
const GC_CODE_DIALOG: VqcQuery = { role: 'dialog', hasText: 'Enter Gift Card Code', nth: -1 };

export const VqcPay = {
  /** Tender button (`Card $12.34`). Matched by name PREFIX — the amount is order data. */
  methodButton: (m: PayMethodLabel): readonly VqcQuery[] => inMain(btnRe(`^${m.replace(' ', '\\s*')}\\b`, 0)),
  /** The tender column: the 4 buttons in DOM order. */
  methodButtons: { css: 'main div[class*="max-w-[600px]"] > button' } as VqcQuery,
  completePayment: inMain(btn('Complete Payment', 0)),
  tipButton: inMain(btn('Tip', 0)),
  printButton: inMain(btn('Print', 0)),
  cashDrawer: inMain(btn('Cash Drawer', 0)),
  continuePayment: btn('Continue Payment'),
  quickCash: (label: string): readonly VqcQuery[] => inMain(btn(label, 0)),
  otherNameInput: { css: 'input', placeholder: 'Input payment method name', nth: 0 } as VqcQuery,
  /** Checkout keypad digit/`C` key inside `<main>`. */
  keypadKey: (k: string): readonly VqcQuery[] => inMain(btn(k, 0)),

  /* --- Cashier Tip dialog (Tip → Enter Amount + $20/$50/$100/$200 + keypad + Add) --- */
  tipDialog: TIP_DIALOG,
  tipKey: (k: string): readonly VqcQuery[] => [TIP_DIALOG, btn(k, 0)],
  tipAdd: [TIP_DIALOG, btn('Add', 0)] as readonly VqcQuery[],
  tipClose: [TIP_DIALOG, btn('Close', 0)] as readonly VqcQuery[],

  /* --- "Customer is adding a tip. Please wait..." on the cashier window --- */
  waitingTipDialog: { role: 'dialog', hasText: 'Customer is adding a tip', nth: -1 } as VqcQuery,
  waitingTipCancel: [
    { role: 'dialog', hasText: 'Customer is adding a tip', nth: -1 },
    btn('Cancel', 0),
  ] as readonly VqcQuery[],

  /* --- Gift-card tender dialog --- */
  gcScanDialog: { role: 'dialog', hasTextRe: 'Scan QR code|Enter Gift Card Code', nth: -1 } as VqcQuery,
  gcInputCodeButton: btn('Input Gift Card Code', 0),
  gcCodeDialog: GC_CODE_DIALOG,
  gcCodeInput: [GC_CODE_DIALOG, { css: 'input', nth: 0 }] as readonly VqcQuery[],
  gcConfirm: [GC_CODE_DIALOG, btn('Confirm', 0)] as readonly VqcQuery[],
  gcAcceptedDialog: { role: 'dialog', hasText: 'Gift Card Accepted', nth: -1 } as VqcQuery,
  gcNotEnoughDialog: { role: 'dialog', hasTextRe: 'not Enough Balance', flags: 'i', nth: -1 } as VqcQuery,
  gcCannotBuyGiftCard: 'Cannot use Gift Card to buy a Gift Card.',

  /* --- Payment success: receipt dialogs --- */
  smsDialog: { role: 'dialog', hasText: 'Customer Phone', nth: -1 } as VqcQuery,
  smsPhone: [
    { role: 'dialog', hasText: 'Customer Phone', nth: -1 },
    { css: 'input', nth: 0 },
  ] as readonly VqcQuery[],
  smsSend: [{ role: 'dialog', hasText: 'Customer Phone', nth: -1 }, btn('Send', 0)] as readonly VqcQuery[],
  smsClose: [{ role: 'dialog', hasText: 'Customer Phone', nth: -1 }, btn('Close', 0)] as readonly VqcQuery[],
  emailDialog: { role: 'dialog', hasText: 'Customer Email', nth: -1 } as VqcQuery,
  emailInput: [
    { role: 'dialog', hasText: 'Customer Email', nth: -1 },
    { css: 'input', nth: 0 },
  ] as readonly VqcQuery[],
  emailSend: [{ role: 'dialog', hasText: 'Customer Email', nth: -1 }, btn('Send', 0)] as readonly VqcQuery[],
  emailClose: [
    { role: 'dialog', hasText: 'Customer Email', nth: -1 },
    btn('Close', 0),
  ] as readonly VqcQuery[],
  receiptButtons: ['No Receipt', 'Print', 'Text Message', 'Email'] as const,

  /* --- Home --- */
  homePay: inMain(btn('Pay', 0)),
  /** Pending sidebar card for an order code (`OD251027-12 …`). */
  pendingCard: (code: string): readonly VqcQuery[] => [
    { css: 'aside, [role="complementary"]', nth: 0 },
    btnRe(`^\\s*${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 0),
  ],

  /* --- Toasts --- */
  toast: (re: string): VqcQuery => ({ css: '[data-sonner-toast]', hasTextRe: re, nth: 0 }),

  /* --- Texts --- */
  successHeading: 'Payment Successful!',
  passcodeCompleteTitle: 'Enter staff code to complete payment',
  passcodeDrawerTitle: 'Enter staff code to open cash drawer',
  skip30Label: 'Do not require passcode for the next 30 minutes',
  transactionNotFound: 'Transaction Not Found',
  printerErrorRe: 'Printer not connected|Receipt not found|printer',
  drawerErrorRe: 'Open cash drawer failed|Check printer connection',
  passcodeSkipKey: 'volt-passcode-skip',
} as const;
