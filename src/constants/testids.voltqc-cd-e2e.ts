/**
 * Queries for the volt-qc CD (13 customer display) and E2E (14 end-to-end) ports
 * (`tests/regression/volt-qc/cd-e2e/*`).
 *
 * Same vocabulary as `testids.voltqc-pos.ts` — a {@link VqcQuery} chain resolved
 * in-page by `src/pages/voltqc/pos/VoltQcProbe.ts` — because build 1.1.x ships
 * almost no `data-testid` on the customer window and the volt-qc source drives
 * both windows by role + en-US label. Labels are the app's `locales/en/common.json`
 * strings as the volt-qc suite recorded them (customer display is English-only:
 * `CUSTOMER_DISPLAY_MULTI_LANGUAGE = false`).
 *
 * The SAME chain works on either window: the probe runs against whichever handle
 * the session is focused on, and `src/pages/voltqc/cd-e2e/customerScreen.ts`
 * wraps every customer read in `withCustomerWindow()`.
 */

import type { VqcQuery } from './testids.voltqc-pos.js';

export type { VqcChain, VqcQuery } from './testids.voltqc-pos.js';

const MAIN: VqcQuery = { css: 'main' };
const inMainQ = (q: VqcQuery): readonly VqcQuery[] => [MAIN, q];
const b = (name: string, nth?: number): VqcQuery => ({ role: 'button', name, nth });
const bRe = (nameRe: string, nth?: number): VqcQuery => ({ role: 'button', nameRe, nth });
const t = (text: string, nth = 0): VqcQuery => ({ text, nth });
const tRe = (textRe: string, flags?: string): VqcQuery => ({ textRe, flags, nth: 0 });

/* ------------------------------------------------------------------------- *
 * Main window (the till)
 * ------------------------------------------------------------------------- */

export const CdMain = {
  quickCheckout: b('Quick Checkout', 0),
  orderHeading: inMainQ({ textRe: '^#OD\\d{6}-\\d+', nth: 0 }),
  customerInput: { css: 'input', placeholder: 'Enter Customer Phone, Name or Email', nth: 0 } as VqcQuery,
  customerFieldText: inMainQ({ text: 'Enter Customer Phone, Name or Email', nth: 0 }),
  keypadKey: (key: string): readonly VqcQuery[] => inMainQ(b(key, 0)),
  done: inMainQ(b('Done', 0)),
  staffNameCss: 'main span.col-span-2.text-xl',
  serviceTile: (name: string): readonly VqcQuery[] =>
    inMainQ({ css: 'li', hasCss: 'span.block', hasText: name, nth: 0 }),
  serviceTileCss: 'main li',
  serviceSearch: inMainQ({ css: 'input', placeholder: 'Search service', nth: 0 }),
  /** One cart row (`div.pr-11`) of the order panel. */
  itemRow: (name: string): readonly VqcQuery[] => inMainQ({ css: 'div.pr-11', hasText: name }),
  itemRowRemove: (name: string): readonly VqcQuery[] => [
    MAIN,
    { css: 'div.pr-11', hasText: name, nth: 0 },
    { css: 'button.text-destructive', nth: 0 },
  ],
  itemRowName: (name: string): readonly VqcQuery[] => [
    MAIN,
    { css: 'div.pr-11', hasText: name, nth: 0 },
    { css: 'span', text: name, nth: 0 },
  ],
  removeServiceDialog: { role: 'dialog', hasText: 'Remove Service Item', nth: -1 } as VqcQuery,
  removeOrder: b('Remove', 0),
  deleteOrderDialog: { role: 'dialog', hasText: 'Delete Order', nth: -1 } as VqcQuery,
  newCustomerDialog: {
    role: 'dialog',
    hasCss: 'input[placeholder="Enter customer name"]',
    nth: -1,
  } as VqcQuery,
  newCustomerName: { css: 'input', placeholder: 'Enter customer name', nth: 0 } as VqcQuery,
  /** Customer chip on the order (`div.bg-turquoise-topaz-20`). */
  customerBox: inMainQ({ css: 'div.bg-turquoise-topaz-20', nth: 0 }),
  removeCustomerDialog: { role: 'dialog', hasText: 'Remove Customer Phone', nth: -1 } as VqcQuery,
  promoRewards: b('Promo & Rewards', 0),
  promoDialog: { role: 'dialog', hasText: 'Promo & Rewards', nth: -1 } as VqcQuery,
  pendingSidebar: { role: 'complementary', name: 'Pending Orders sidebar' } as VqcQuery,
  quickPayTile: inMainQ({ role: 'heading', name: 'Quick Pay', nth: 0 }),
  quickPayDialog: {
    role: 'dialog',
    hasText: 'Quick Pay',
    hasCss: 'input[placeholder="Service Name"]',
    nth: -1,
  } as VqcQuery,
  giftCardTile: inMainQ({ role: 'heading', name: 'Gift Card', nth: 0 }),
  sellGiftCardDialog: { role: 'dialog', hasText: 'Sell Gift Card', nth: -1 } as VqcQuery,
  pay: b('Pay', 0),
  completePayment: b('Complete Payment', 0),
  method: (m: string): readonly VqcQuery[] => inMainQ(bRe(`^${m} \\$`, 0)),
  tip: inMainQ(b('Tip', 0)),
  cashierTipDialog: { role: 'dialog', hasText: 'Enter Amount', hasTextRe: '\\bAdd\\b', nth: -1 } as VqcQuery,
  waitingDialog: {
    role: 'dialog',
    hasTextRe: 'Customer is adding (a tip|signature)\\.',
    nth: -1,
  } as VqcQuery,
  presentCardDialog: { role: 'dialog', hasText: 'Present Card', nth: -1 } as VqcQuery,
  giftCardScanDialog: { role: 'dialog', hasTextRe: 'Scan|Input Gift Card Code', nth: -1 } as VqcQuery,
  inputGiftCardCode: b('Input Gift Card Code', 0),
  enterGiftCardDialog: { role: 'dialog', hasText: 'Enter Gift Card Code', nth: -1 } as VqcQuery,
  giftCardVerdictDialog: {
    role: 'dialog',
    hasTextRe: 'Gift Card Accepted|not valid|Insufficient|not enough',
    flags: 'i',
    nth: -1,
  } as VqcQuery,
  paymentSuccessful: t('Payment Successful!'),
  noReceipt: b('No Receipt', 0),
  passcodeDialog: { role: 'dialog', hasTextRe: 'Enter staff code|Nhập mã', nth: -1 } as VqcQuery,
  historySearch: inMainQ({ css: 'input', placeholder: 'Search order ID, customer name or phone', nth: 0 }),
  historyLink: inMainQ({ css: 'a[href^="/order-history/"]', nth: 0 }),
  historyLinks: 'main a[href^="/order-history/"]',
  cancelOrder: inMainQ(b('Cancel Order', 0)),
  cancelDialog: { role: 'dialog', hasText: 'Cancel Order', hasCss: '[role="combobox"]', nth: -1 } as VqcQuery,
  reopenOrder: inMainQ(b('Re-Open Order', 0)),
  reopenConfirmDialog: { role: 'dialog', hasText: 'Re-Open Order?', nth: -1 } as VqcQuery,
  editOrder: b('Edit Order', 0),
  reopenDone: b('Re-Open Done', 0),
  continueReopen: inMainQ(bRe('^Continue Re-?open', 0)),
  adjustTip: inMainQ(b('Adjust Tip', 0)),
  adjustTipDialog: { role: 'dialog', hasText: 'Current Tip', nth: -1 } as VqcQuery,
  splitTip: inMainQ(bRe('^Split Tip', 0)),
  leaveDialog: { role: 'dialog', hasText: 'Discard changes and leave?', nth: -1 } as VqcQuery,
  discardLeave: bRe('^(Discard & Leave|Bỏ thay đổi.*)$', 0),
  continueEditing: b('Continue Editing', 0),
  /** Close-ish buttons in the top-most dialog (volt-qc `closeStrayDialogs`). */
  strayCloseRe: '^(Done|Close|OK|Keep Order|Cancel|Continue Editing)$',
  sidebarOpen: b('Open sidebar', 0),
  noPermission: t("You don't have permission to access this page"),
} as const;

/* ------------------------------------------------------------------------- *
 * Customer window (`/customer`)
 * ------------------------------------------------------------------------- */

export const CdCustomer = {
  welcome: tRe('^welcome to$', 'i'),
  orderDetails: t('Order Details'),
  staffGroup: (name: string): VqcQuery => t(`Staff: ${name}`),
  phoneInput: { css: 'input', placeholder: 'Enter Customer Phone', nth: 0 } as VqcQuery,
  key: (k: string): VqcQuery => b(k, 0),
  done: b('Done', 0),
  doneLast: b('Done', -1),
  agree: t('By entering your phone number, you agree to receive reminders and promotions.'),
  terms: t('Terms'),
  privacy: t('Privacy Policy'),
  isThisYourPhone: t('Is this your phone number?'),
  helloThere: tRe('^Hello there!?$'),
  yes: b('Yes', 0),
  noEnterAgain: b('No, enter again', 0),
  checkinSuccessful: t('Check-in Successful'),
  currentPoints: t('Your current points'),
  redeemPointsFor: tRe('^Redeem your points for'),
  addTip: t('Add a tip'),
  addSignature: t('Add Signature'),
  pleaseSign: t('Please sign your name.'),
  noTip: b('No Tip', 0),
  customTip: b('Custom Tip', 0),
  continue: b('Continue', 0),
  clear: b('Clear', 0),
  customTipTitle: tRe('^Custom tip on \\$'),
  tipAmountRe: 'Tip Amount:?\\s*\\$([\\d,]+(?:\\.\\d+)?)',
  tipBaseRe: 'Tip based on total:?\\s*\\$([\\d,]+(?:\\.\\d+)?)',
  presetLabelRe: '^\\d+(\\.\\d+)?%$',
  paymentComplete: t('Payment complete'),
  paymentSuccessful: t('Payment Successful!'),
  earned: t("Congrats! You've earned"),
  earnedPoints: tRe('^\\d[\\d,]* points$'),
  noReceipt: b('No Receipt', 0),
  textMessage: b('Text Message', 0),
  email: b('Email', 0),
  send: b('Send', 0),
  emailInput: { css: 'input', placeholder: 'Enter Customer Email', nth: 0 } as VqcQuery,
  /** Back arrow of the send-receipt screen (`button.absolute.top-6.left-6`). */
  sendBack: { css: 'button.absolute.top-6.left-6', nth: 0 } as VqcQuery,
  keyboardSend: { css: '.hg-button[data-skbtn="{enter}"]', nth: 0 } as VqcQuery,
  dialog: (title: string): VqcQuery => ({ role: 'dialog', hasText: title, nth: -1 }),
  closeIn: (title: string): readonly VqcQuery[] => [
    { role: 'dialog', hasText: title, nth: -1 },
    bRe('^(Close|Đóng)$', 0),
  ],
  canvas: { css: 'canvas', nth: 0 } as VqcQuery,
  anyButton: { role: 'button' } as VqcQuery,
  tile: (id: string): VqcQuery => ({ css: `[data-testid="customer-pay-by-${id}"]`, nth: 0 }),
} as const;

/** `customer-pay-by-<id>` in their rendered order (`payment-method-buttons.tsx`). */
export const CUSTOMER_TILE_IDS = ['card', 'cash', 'other', 'gift_card'] as const;
export type CustomerTileId = (typeof CUSTOMER_TILE_IDS)[number];

/** Main-window tender label ↔ customer tile id. */
export const TILE_OF: Record<'Card' | 'Cash' | 'Other' | 'Gift Card', CustomerTileId> = {
  Card: 'card',
  Cash: 'cash',
  Other: 'other',
  'Gift Card': 'gift_card',
};

/* ------------------------------------------------------------------------- *
 * Settings
 * ------------------------------------------------------------------------- */

export const CdSettings = {
  themeRadio: (theme: 'light' | 'dark'): VqcQuery => ({
    css: `[data-testid="appearance-theme-${theme}"]`,
    nth: 0,
  }),
  languageRadio: (code: 'en' | 'vi'): VqcQuery => ({ css: `button#${code}`, nth: 0 }),
  showPoint: { css: '#customer-display-show-point', nth: 0 } as VqcQuery,
  showReward: { css: '#customer-display-show-reward', nth: 0 } as VqcQuery,
  customerDisplaySave: [
    { css: '[data-slot="card"]', hasCss: '#customer-display-show-point', nth: 0 },
    b('Save', 0),
  ] as readonly VqcQuery[],
  customerDisplaySaved: t('Customer display setting updated successfully'),
  tipMethod: (id: string): VqcQuery => ({ css: `#charge-fee-tip-method-${id}`, nth: 0 }),
  tippingSave: inMainQ(b('Save', 0)),
  tippingSaved: t('Tipping settings updated successfully'),
  signatureSwitch: [
    { css: 'div', hasText: 'Require Digital Signature', hasCss: '[role="switch"]', nth: -1 },
    { role: 'switch', nth: 0 },
  ] as readonly VqcQuery[],
  signatureTiming: (timing: 'before' | 'after'): VqcQuery => ({
    css: `#tipping-signature-timing-${timing}`,
    nth: 0,
  }),
} as const;
