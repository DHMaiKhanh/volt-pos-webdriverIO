import { browser } from '@wdio/globals';
import { env } from '../../../../configs/env/loadEnv.js';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { passcodeDialog } from '../../../components/index.js';
import { btn, inMain, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import {
  CART_ROW_CSS,
  OhRoButtons as B,
  OhRoDialogs as D,
  OhRoText as T,
  passcodeGateSwitch,
  tenderTile,
  type PasscodeGate,
} from '../../../constants/testids.voltqc-oh-reopen.js';
import { goToOrderHistory, payInCash, payWithOther, returnToHome } from '../../../flows/index.js';
import { settle } from '../../../helpers/wait.js';
import { checkoutPage, homePage, orderHistoryDetailPage, orderHistoryPage } from '../../index.js';
import {
  addDays,
  applyFilter,
  filterDialog,
  inFilter,
  openFilter,
  openRow,
  pickDateRange,
  rowCodes,
  search,
  type HistoryFilter,
} from '../pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';

/**
 * Write-side helpers for the volt-qc 07 ORDER HISTORY / 17 RE-OPEN port
 * (volt-qc `src/flows/order-history.ts`, `reopen.ts`, `pay.ts`, `App.createPaidOrder`).
 *
 * They act; the specs assert. Money is handled in CENTS throughout (the source suite used
 * dollars) — `centsIn()` parses the rendered `$1,234.56` the app prints.
 *
 * Every builder here creates and settles real orders: dev / staging only. `createOrder`,
 * `payInCash` and `payWithOther` each open with `assertWritesAllowed()`.
 */

/* ------------------------------------------------------------------- *
 * Text reading (volt-qc `App.text` / `App.field` / `money`)
 * ------------------------------------------------------------------- */

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `$1,234.56` (first amount in `s`) → cents; NaN when there is none. */
export function centsIn(s: string | null | undefined): number {
  const m = /(-?)\$\s?([\d,]+\.\d{2})/.exec(s ?? '');
  if (!m) return Number.NaN;
  const v = Math.round(Number((m[2] ?? '').replace(/,/g, '')) * 100);
  return m[1] === '-' ? -v : v;
}

/** `main` innerText with line breaks turned into ` | ` (volt-qc `app.text(main, 'main')`). */
export function mainText(): Promise<string> {
  return P.pageText('main');
}

/** The detail pane text from `Order #<code>` on (the list on the left is cut off). */
export async function detailText(code = ''): Promise<string> {
  const t = await mainText();
  const i = code ? t.indexOf(`Order #${code}`) : t.indexOf('Order #');
  return i >= 0 ? t.slice(i) : t;
}

/** `| Label | value |` → value (volt-qc `App.field`). */
export function field(detail: string, label: string): string {
  return new RegExp(`\\| ${escRe(label)} \\| ([^|]+)`).exec(detail)?.[1]?.trim() ?? '';
}

/** How many tender lines of `method` the Payment Details section lists (volt-qc `countPayments`). */
export function countPayments(detail: string, method: 'Cash' | 'Other' | 'Gift Card' | 'Card'): number {
  const i = detail.indexOf('Payment Details');
  const end = i >= 0 ? detail.indexOf('Order Note', i) : -1;
  const seg = i >= 0 ? detail.slice(i, end > 0 ? end : undefined) : detail;
  return seg
    .split(' | ')
    .map((s) => s.trim())
    .filter((s) => s === method || s.startsWith(`${method} -`) || s.startsWith(`${method} (`)).length;
}

/** The `Payment Details` → `Order Note` slice of a detail text. */
export function paymentSection(detail: string): string {
  const i = detail.indexOf('Payment Details');
  if (i < 0) return '';
  const end = detail.indexOf('Order Note', i);
  return detail.slice(i, end > 0 ? end : undefined);
}

/** The `Service Details` → `Payment Details` slice. */
export function serviceSection(detail: string): string {
  const i = detail.indexOf('Service Details');
  if (i < 0) return '';
  const end = detail.indexOf('Payment Details', i);
  return detail.slice(i, end > 0 ? end : undefined);
}

/** Staff names the Service Details section groups by (`Staff: <name>`). */
export function staffInDetail(detail: string): string[] {
  return [...serviceSection(detail).matchAll(/Staff: ([^|]+)/g)]
    .map((m) => (m[1] ?? '').trim())
    .filter(Boolean);
}

export const codeOf = (detail: string): string => /Order #(OD\d{6}-\d+)/.exec(detail)?.[1] ?? '';

/* ------------------------------------------------------------------- *
 * Passcode + small UI verbs
 * ------------------------------------------------------------------- */

/** Answer the staff-code guard if it shows within `timeout` (volt-qc `passcodeIfAsked`). */
export async function passcodeIfAsked(timeout = 2_500): Promise<boolean> {
  const shown = await P.poll(
    () => P.has(D.passcode),
    (v) => v,
    timeout,
  );
  if (!shown) return false;
  await passcodeDialog.enter(env.STAFF_PASSCODE);
  await settle(300);
  return true;
}

/** Type `code` on the open guard's keypad without waiting for it to close; return whether it is still up. */
export async function enterCodeRaw(code: string): Promise<{ visible: boolean; text: string }> {
  await P.waitFor(D.passcode, Timeouts.SHORT, 'staff-code guard');
  for (const c of code) await P.clickQ([D.passcode, btn(c, 0)]);
  await settle(1_500);
  const visible = await P.has(D.passcode);
  return { visible, text: visible ? ((await P.rawText(D.passcode)) ?? '') : '' };
}

export const detailBtn = (name: string): readonly VqcQuery[] => inMain(btn(name, 0));

export async function hasDetailButton(name: string): Promise<boolean> {
  return P.has(inMain(btn(name)));
}

/** Refund action (testid on dev builds, the button label on 1.1.x). */
export async function hasRefundButton(): Promise<boolean> {
  return (
    (await P.has({ css: '[data-testid="order-action-refund"]' })) ||
    (await P.has(inMain({ role: 'button', nameRe: '^(Partial )?Refund$' })))
  );
}

/** Which of the detail actions are on screen. */
export async function detailActions(): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const name of [B.receipt, B.reopen, B.continueReopen, B.cancelOrder, B.adjustTip, B.splitTip]) {
    out[name] = await hasDetailButton(name);
  }
  out.Refund = await hasRefundButton();
  return out;
}

/* ------------------------------------------------------------------- *
 * Building settled orders (volt-qc `App.createPaidOrder` and friends)
 * ------------------------------------------------------------------- */

export type PaidMethod = 'cash' | 'other';

export interface PaidOrderOptions {
  method?: PaidMethod;
  /** Tender label for `other`. */
  otherName?: string;
  /**
   * One entry per line: `[staffTileIndex, serviceTileIndex]`. Default `[[0, 0]]`.
   * A second distinct staff index makes a two-staff order.
   */
  lines?: readonly (readonly [number, number])[];
  /** Phone (10 digits) to attach before Pay; a new customer is created as `customerName` when unknown. */
  customerPhone?: string;
  customerName?: string;
}

export interface PaidOrder {
  orderId: string;
  /** Human code `OD……-n`. */
  code: string;
  /** What the tender charged (cash/other price — no card fee), in cents. */
  paidCents: number;
  /** The Card tile amount at checkout (card price incl. service fee); NaN when not shown. */
  cardCents: number;
}

/** Empty till on /home: leave any screen, drop a stray draft. */
export async function freshTill(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

/** Build the cart from `lines` on an empty till (does not press Pay). */
export async function buildCart(lines: readonly (readonly [number, number])[] = [[0, 0]]): Promise<void> {
  await freshTill();
  for (const [staff, service] of lines) {
    await homePage.selectStaffByIndex(staff);
    await homePage.addServiceByIndex(service);
  }
}

/** Create, settle and open a cash / other order; leaves the app on its Order History detail. */
export async function createPaidOrder(opts: PaidOrderOptions = {}): Promise<PaidOrder> {
  await buildCart(opts.lines ?? [[0, 0]]);
  if (opts.customerPhone) {
    await homePage.attachCustomerByPhone(opts.customerPhone);
    if (await homePage.isNewCustomerFormShown())
      await homePage.saveNewCustomer(opts.customerName ?? 'QC E2E');
  }
  const checkout = await homePage.pressPay();
  await checkout.waitForReady();
  const orderId = await checkout.orderId();
  const method = opts.method ?? 'cash';
  const cardCents = await tenderAmountCents('Card');
  await checkoutPage.selectTender(method);
  await settle(Timeouts.DEBOUNCE);
  const paidCents = await checkoutPage.totalCents();
  const success =
    method === 'cash' ? await payInCash(orderId) : await payWithOther(orderId, opts.otherName ?? 'E2E Other');
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();
  const code = await openHistoryOrder(orderId);
  return { orderId, code, paidCents, cardCents };
}

/**
 * Open one order's detail from a reset list (leaves via /home first so filters / range /
 * search are back to default, as volt-qc `openHistoryOrder` does). Returns its code.
 */
export async function openHistoryOrder(orderId: string): Promise<string> {
  await returnToHome();
  await goToOrderHistory();
  await orderHistoryPage.openOrder(orderId);
  await orderHistoryDetailPage.waitForOrder(orderId);
  await P.closeToasts();
  const t = await P.poll(
    () => detailText(),
    (d) => codeOf(d) !== '',
    Timeouts.MEDIUM,
  );
  return codeOf(t);
}

/** Open an order by its code through the search box (works for any order in the default range). */
export async function openByCode(code: string): Promise<void> {
  await returnToHome();
  await goToOrderHistory();
  await search(code);
  await P.poll(
    () => rowCodes(),
    (c) => c.includes(code),
    Timeouts.MEDIUM,
  );
  await openRow(code);
  await P.waitFor(inMain({ text: `Order #${code}` }), Timeouts.MEDIUM, `Order #${code}`);
  await P.closeToasts();
}

/** Poll the detail until its Status matches. Returns the last status read. */
export async function waitStatus(code: string, want: RegExp, timeout = 45_000): Promise<string> {
  return P.poll(
    async () => field(await detailText(code), 'Status'),
    (s) => want.test(s),
    timeout,
  );
}

/**
 * First order in the last `daysBack` days with one of `statuses` (filter ids without
 * `status-`) and, optionally, one of `payments`. Leaves the filtered list on screen.
 */
export async function findHistoryCode(
  statuses: string[],
  payments: string[] = [],
  daysBack = 7,
): Promise<string | null> {
  await returnToHome();
  await goToOrderHistory();
  if (
    (await P.inputValue(inMain({ role: 'textbox', name: 'Search order ID, customer name or phone' }))) !== ''
  )
    await search('');
  const today = new Date();
  await pickDateRange(addDays(today, -(daysBack - 1)), today);
  await applyFilter({ statuses, payments });
  return (await rowCodes())[0] ?? null;
}

/* ------------------------------------------------------------------- *
 * Re-open (volt-qc `reopen.ts`)
 * ------------------------------------------------------------------- */

const CHECKOUT_RE = /^\/order\/[^/]+\/checkout$/;

export async function openReopenDialog(button: string = B.reopen): Promise<void> {
  await P.clickQ(detailBtn(button));
  await passcodeIfAsked(1_500);
  await P.waitFor(D.reopen, Timeouts.MEDIUM, 'Re-Open Order? dialog');
}

export async function reopenDialogText(orderId: string): Promise<string> {
  await openHistoryOrder(orderId);
  await openReopenDialog();
  const text = ((await P.rawText(D.reopen)) ?? '').replace(/\s+/g, ' ').trim();
  await P.clickQ([D.reopen, btn('Cancel', 0)]);
  await P.waitGoneQ(D.reopen, Timeouts.SHORT, 'Re-Open Order? dialog');
  return text;
}

/** Detail → Re-Open (or Continue Re-open) → Confirm → passcode → reopened checkout. */
export async function reopenToCheckout(orderId: string, button: string = B.reopen): Promise<void> {
  await openHistoryOrder(orderId);
  await openReopenDialog(button);
  await P.clickQ([D.reopen, btn('Confirm', 0)]);
  await passcodeIfAsked(2_500);
  const path = await P.poll(
    () => P.path(),
    (p) => CHECKOUT_RE.test(p),
    Timeouts.NAVIGATION,
  );
  if (!CHECKOUT_RE.test(path)) throw new Error(`Re-open of ${orderId} never reached checkout (on ${path})`);
  await checkoutPage.waitForReady(Timeouts.MEDIUM);
  await settle(600);
}

/** Reopened checkout → Edit Order → Home `?editOrderId`. */
export async function editOrderFromCheckout(): Promise<void> {
  await P.clickQ({ role: 'button', name: B.editOrder, nth: 0 });
  await passcodeIfAsked(2_000);
  await P.poll(
    () => P.path(),
    (p) => p.startsWith('/home'),
    Timeouts.MEDIUM,
  );
  await homePage.waitForReady(Timeouts.MEDIUM);
}

export async function reopenToHome(orderId: string): Promise<void> {
  await reopenToCheckout(orderId);
  await editOrderFromCheckout();
}

/** Home editor → Pay → reopened checkout (a Void dialog may come up there). */
export async function payFromEdit(): Promise<void> {
  await P.clickQ(inMain(btn('Pay', 0)));
  await passcodeIfAsked(1_500);
  await P.poll(
    () => P.path(),
    (p) => CHECKOUT_RE.test(p),
    Timeouts.MEDIUM,
  );
  await settle(800);
}

export async function isVoidDialogShown(): Promise<boolean> {
  return P.has(D.voidTransactions);
}

/** Void Order Transactions → Confirm Void → passcode → "canceled successfully". */
export async function confirmVoidAll(): Promise<void> {
  await P.clickQ([D.voidTransactions, btn(B.confirmVoid, 0)]);
  await passcodeIfAsked(3_000);
  await P.poll(
    () => mainText(),
    (t) => t.includes(T.voidDone) || !t.includes('Void Order Transactions'),
    Timeouts.LONG,
  );
  await settle(1_000);
}

export async function backToOrderFromVoid(): Promise<void> {
  await P.clickQ([D.voidTransactions, btn(B.backToOrder, 0)]);
  await P.waitGoneQ(D.voidTransactions, Timeouts.SHORT, 'Void dialog');
}

/** From the Home editor (Pay first) or the reopened checkout: Re-Open Done → back to the detail. */
export async function reopenDone(): Promise<void> {
  if ((await P.path()).startsWith('/home')) await payFromEdit();
  await P.clickQ({ role: 'button', name: B.reopenDone, nth: 0 });
  await passcodeIfAsked(2_500);
  await P.poll(
    () => P.path(),
    (p) => p.startsWith('/order-history/'),
    Timeouts.NAVIGATION,
  );
  await settle(800);
}

/** Best-effort `after` cleanup when a case died inside a reopen. */
export async function leaveReopen(): Promise<void> {
  try {
    if (await isVoidDialogShown()) await backToOrderFromVoid();
    const path = await P.path();
    if (path.startsWith('/home') && (await browser.getUrl()).includes('editOrderId')) await payFromEdit();
    if (CHECKOUT_RE.test(await P.path()) && (await P.has({ role: 'button', name: B.reopenDone })))
      await reopenDone();
  } catch {
    // cleanup only
  }
}

/** Cart line count on Home. */
export async function cartLineCount(): Promise<number> {
  return P.count({ css: CART_ROW_CSS });
}

/** Try to add service tile `serviceIndex` for staff tile `staffIndex`; true when a line was added. */
export async function tryAddService(serviceIndex: number, staffIndex = 0): Promise<boolean> {
  const before = await cartLineCount();
  await homePage.selectStaffByIndex(staffIndex).catch(() => undefined);
  await homePage.addServiceByIndex(serviceIndex).catch(() => undefined);
  await settle(Timeouts.DEBOUNCE);
  return (await cartLineCount()) > before;
}

/** Remove the `nth` cart line (trash icon → Remove Service Item → Remove). */
export async function removeCartLine(nth = -1): Promise<void> {
  await P.clickQ([
    { css: CART_ROW_CSS, nth },
    { css: 'button.text-destructive', nth: 0 },
  ]);
  await passcodeIfAsked(1_500);
  if (
    await P.poll(
      () => P.has(D.removeServiceItem),
      (v) => v,
      3_000,
    )
  ) {
    await P.clickQ([D.removeServiceItem, btn('Remove', 0)]);
    await P.waitGoneQ(D.removeServiceItem, Timeouts.SHORT, 'Remove Service Item');
  }
  await settle(Timeouts.DEBOUNCE);
}

/** Price printed on a checkout tender tile (`Cash $12.00`), in cents; NaN when the tile shows no amount. */
export async function tenderAmountCents(method: 'Card' | 'Cash' | 'Gift Card' | 'Other'): Promise<number> {
  return centsIn(await P.textOf(inMain(tenderTile(method))));
}

/** Checkout amounts read from the rendered text (volt-qc `checkoutState`). */
export async function checkoutState(): Promise<{
  entered: number;
  totalPaid: number;
  remaining: number;
  change: number;
  total: number;
  tip: number;
  text: string;
}> {
  const t = await mainText();
  const pick = (label: string): number =>
    centsIn(new RegExp(`\\| ${escRe(label)} \\| (-?\\$[\\d,.]+)`).exec(t)?.[1]);
  return {
    entered: centsIn(/Enter Amount \| (\$[\d,.]+)/.exec(t)?.[1]),
    totalPaid: pick('Total Paid'),
    remaining: pick('Remaining'),
    change: pick('Change'),
    total: pick('Total'),
    tip: pick('Tip'),
    text: t,
  };
}

/** Select a tender and read the pre-filled Enter Amount (the amount still owed on that tender). */
export async function enteredFor(tender: 'cash' | 'other' | 'card'): Promise<number> {
  await checkoutPage.selectTender(tender);
  await settle(Timeouts.DEBOUNCE);
  return checkoutPage.enteredAmountCents();
}

/** Pay the reopen difference in cash/other with no tip and come back to the detail. */
export async function payDifference(
  orderId: string,
  method: PaidMethod,
  otherName = 'E2E Other',
): Promise<void> {
  const success = method === 'cash' ? await payInCash(orderId) : await payWithOther(orderId, otherName);
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();
}

/** Detail text re-read after re-opening the order from a reset list. */
export async function freshDetail(
  orderId: string,
  until?: (d: string) => boolean,
  timeout = 30_000,
): Promise<string> {
  const code = await openHistoryOrder(orderId);
  return P.poll(
    () => detailText(code),
    (d) => (until ? until(d) : true),
    timeout,
  );
}

/** Staff-name label of the first staff block on the Home editor. */
export async function homeStaffNames(): Promise<string[]> {
  return P.texts({ css: 'main span.col-span-2.text-xl' });
}

/* ------------------------------------------------------------------- *
 * Cancel (volt-qc `openCancelDialog` / `selectReason` / `App.cancelOrder`)
 * ------------------------------------------------------------------- */

export async function openCancelDialog(): Promise<void> {
  await P.clickQ(detailBtn(B.cancelOrder));
  await passcodeIfAsked(1_500);
  await P.waitFor(D.cancel, Timeouts.MEDIUM, 'Cancel Order dialog');
}

/** Open the reason combobox of `dialog` and list the options. */
export async function reasonOptions(dialog: VqcQuery): Promise<string[]> {
  await P.clickQ([dialog, { role: 'combobox', nth: 0 }]);
  const opts = await P.texts({ role: 'option' });
  await P.escape();
  return opts.map((o) => o.trim()).filter(Boolean);
}

export async function selectReason(dialog: VqcQuery, reason: string | number): Promise<void> {
  await P.clickQ([dialog, { role: 'combobox', nth: 0 }]);
  if (typeof reason === 'number') await P.clickQ({ role: 'option', nth: reason });
  else await P.clickQ({ role: 'option', name: reason });
  await settle(250);
}

export async function isConfirmCancelDisabled(): Promise<boolean> {
  return P.isDisabled([D.cancel, btn(B.confirmCancel, 0)]);
}

/** Cancel the open order with reason `reason` (index or label). Passcode answered. */
export async function cancelOrder(reason: string | number = 0, otherText?: string): Promise<void> {
  await openCancelDialog();
  await selectReason(D.cancel, reason);
  if (otherText !== undefined)
    await P.fillQ([D.cancel, { css: 'textarea, input[type="text"]', nth: 0 }], otherText);
  await P.clickQ([D.cancel, btn(B.confirmCancel, 0)]);
  await passcodeIfAsked(3_000);
  await P.waitGoneQ(D.cancel, Timeouts.MEDIUM, 'Cancel Order dialog');
}

/* ------------------------------------------------------------------- *
 * Adjust Tip (volt-qc `openAdjustTip` / `tipKey` / `tipEntered`)
 * ------------------------------------------------------------------- */

export async function openAdjustTip(): Promise<void> {
  await P.clickQ(detailBtn(B.adjustTip));
  await passcodeIfAsked(2_000);
  await P.poll(
    async () => (await P.has(D.adjustTip)) || (await P.has(D.adjustOrderTipList)),
    (v) => v,
    Timeouts.MEDIUM,
  );
}

async function tipDialogText(): Promise<string> {
  return ((await P.rawText(D.adjustTip)) ?? '').replace(/\s*\n+\s*/g, ' | ');
}

export async function tipEnteredCents(): Promise<number> {
  return centsIn(/Enter Amount \| (\$[\d,.]+)/.exec(await tipDialogText())?.[1]);
}

export async function tipCurrentCents(): Promise<number> {
  return centsIn(/Current Tip:?\s*\|?\s*(\$[\d,.]+)/.exec(await tipDialogText())?.[1]);
}

/** A key of the tip keypad: `$20` `$50` `$100` `$200`, a digit, or `00`. */
export async function tipKey(key: string): Promise<void> {
  await P.clickQ([D.adjustTip, btn(key, 0)]);
}

/** The keypad delete key (the button right after "0"). */
export async function tipBackspace(): Promise<void> {
  const ok = await P.exec<boolean>(`
    var dl = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"]'), function (d) { return /Current Tip/.test(d.textContent || ''); });
    var dlg = dl[dl.length - 1];
    var zero = dlg && Array.prototype.find.call(dlg.querySelectorAll('button'), function (b) { return (b.textContent || '').trim() === '0'; });
    var next = zero && zero.nextElementSibling;
    if (!next) return false;
    next.setAttribute('data-vqc-tipbk', '1');
    return true;
  `);
  if (!ok) throw new Error('Adjust Tip keypad has no delete key after "0"');
  await P.clickQ({ css: '[data-vqc-tipbk="1"]' });
}

export async function saveTip(): Promise<void> {
  await P.clickQ([D.adjustTip, btn('Save', 0)]);
  await passcodeIfAsked(2_500);
  await P.waitGoneQ(D.adjustTip, Timeouts.MEDIUM, 'Adjust Tip dialog');
}

/** Single-tender order: Adjust Tip → type `digits` (cents) → Save. */
export async function adjustTipTo(digits: string): Promise<void> {
  await openAdjustTip();
  for (const c of digits) await tipKey(c);
  await saveTip();
}

export async function closeTipDialog(): Promise<void> {
  await P.clickQ([D.adjustTip, { css: 'button', nth: 0 }]);
  await P.waitGoneQ(D.adjustTip, Timeouts.SHORT, 'Adjust Tip dialog');
}

/* ------------------------------------------------------------------- *
 * Receipt
 * ------------------------------------------------------------------- */

export async function openReceipt(): Promise<void> {
  await P.clickQ(detailBtn(B.receipt));
  await P.waitFor(D.receipt, Timeouts.MEDIUM, 'Receipt Details');
}

export async function receiptText(): Promise<string> {
  return ((await P.rawText(D.receipt)) ?? '').replace(/\s*\n+\s*/g, ' | ');
}

/* ------------------------------------------------------------------- *
 * Refund dialog (volt-qc `openRefundDialog` / `refundAmount` / `submitRefund`)
 * ------------------------------------------------------------------- */

export async function openRefundDialog(): Promise<void> {
  if (await P.has({ css: '[data-testid="order-action-refund"]' }))
    await P.clickQ({ css: '[data-testid="order-action-refund"]' });
  else await P.clickQ(inMain({ role: 'button', nameRe: '^(Partial )?Refund$', nth: 0 }));
  await passcodeIfAsked(1_500);
  await P.waitFor(D.refund, Timeouts.MEDIUM, 'Refund dialog');
}

export async function refundDialogText(): Promise<string> {
  return ((await P.rawText(D.refund)) ?? '').replace(/\s*\n+\s*/g, ' | ');
}

/** Refund amount field (disabled currency input). */
export async function refundAmountCents(): Promise<number> {
  const v = await P.inputValue([
    D.refund,
    { css: '[data-testid="order-refund-amount"], input[inputmode="decimal"], input', nth: 0 },
  ]);
  return centsIn(v.startsWith('$') ? v : `$${v}`);
}

export async function closeRefundDialog(): Promise<void> {
  await P.clickQ([D.refund, { role: 'button', nameRe: '^(Cancel|Close)$', nth: 0 }]);
  await P.waitGoneQ(D.refund, Timeouts.SHORT, 'Refund dialog');
}

/* ------------------------------------------------------------------- *
 * Settings › Accessibility › Passcode Setting (volt-qc `setPasscodeGate`)
 * ------------------------------------------------------------------- */

/** Flip one passcode gate and Save; returns what it was so the caller can put it back. */
export async function setPasscodeGate(gate: PasscodeGate, on: boolean): Promise<boolean> {
  await returnToHome();
  await P.routerGo('/settings/accessibility');
  await passcodeIfAsked(2_000);
  const sw = passcodeGateSwitch(gate);
  await P.waitFor(sw, Timeouts.MEDIUM, `passcode gate ${gate}`);
  const before = (await P.attrOf(sw, 'aria-checked')) === 'true';
  if (before !== on) {
    await P.clickQ(sw);
    const save = await P.infos(inMain(btn('Save')));
    const idx = save.findIndex((s) => !s.disabled);
    await P.clickQ(inMain(btn('Save', Math.max(idx, 0))));
    await passcodeIfAsked(1_500);
    await P.poll(
      () => P.attrOf(sw, 'aria-checked'),
      (v) => v === String(on),
      Timeouts.SHORT,
    );
    await settle(800);
  }
  return before;
}

/** Random 10-digit US-like phone (volt-qc `randomPhone`). */
export function randomPhone(): string {
  return `832${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
}

export const fmtPhone = (p: string): string => `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}`;

/** Staff-role code from the env (volt-qc `VOLT_STAFFROLE_CODE`); '' when not configured. */
export const staffRoleCode = (): string => (process.env.VOLT_STAFFROLE_CODE ?? '').trim();

/* ------------------------------------------------------------------- *
 * Filter with staff (volt-qc `applyHistoryFilter({ staffs })`)
 * ------------------------------------------------------------------- */

export interface OhFilter extends HistoryFilter {
  staffs?: string[];
}

/** Like `applyFilter` from orderHistoryProbe, plus the Staff multi-select. */
export async function applyOhFilter(f: OhFilter): Promise<void> {
  if (!f.staffs?.length) {
    await applyFilter(f);
    return;
  }
  await openFilter();
  if (f.clear) await P.clickQ(inFilter({ role: 'button', name: 'Clear' }));
  if (f.sortBy) {
    await P.clickQ(inFilter({ role: 'combobox', nth: 0 }));
    await P.clickQ({ role: 'option', name: f.sortBy });
  }
  await P.clickQ(inFilter({ role: 'button', nameRe: 'Select staff', nth: 0 }));
  for (const s of f.staffs) {
    await P.fillQ(STAFF_SEARCH, s);
    await settle(700);
    await P.clickQ({ role: 'checkbox', name: s, nth: 0 });
    await P.fillQ(STAFF_SEARCH, '');
  }
  await P.escape();
  if (f.payments?.length) {
    await P.clickQ(inFilter({ role: 'button', nameRe: 'Select payment method' }));
    for (const p of f.payments) await P.clickQ({ css: `[id="${p}"]` });
    await P.escape();
  }
  if (f.statuses?.length) {
    await P.clickQ(inFilter({ role: 'button', nameRe: 'Select status' }));
    for (const s of f.statuses) await P.clickQ({ css: `[id="status-${s}"]` });
    await P.escape();
  }
  if (f.confirm === false) return;
  await P.waitFor(filterDialog, Timeouts.SHORT, 'Filter dialog');
  const confirm = inFilter({ role: 'button', name: 'Confirm' });
  if (await P.isDisabled(confirm)) await P.clickQ(inFilter({ role: 'button', name: 'Close', nth: 0 }));
  else await P.clickQ(confirm);
  await P.waitGoneQ(filterDialog, Timeouts.SHORT, 'Filter dialog');
  await settle(800);
}

export const STAFF_SEARCH: VqcQuery = { css: 'input', placeholder: 'Search staff', nth: -1 };

/* ------------------------------------------------------------------- *
 * Home editor extras (volt-qc `App.changeStaff`, `cannotContinueText`)
 * ------------------------------------------------------------------- */

/** Change Staff on the open order → pick staff tile `staffIndex` → confirm "… to <name>?". */
export async function changeStaffTo(staffIndex: number): Promise<void> {
  await P.clickQ({ role: 'button', name: 'Change Staff', nth: 0 });
  await P.waitFor(inMain({ textRe: 'Change from', nth: 0 }), Timeouts.SHORT, 'change-staff mode');
  await homePage.selectStaffByIndex(staffIndex);
  const confirm: VqcQuery = { css: '[role="alertdialog"]', hasTextRe: 'to .+\\?', nth: -1 };
  await P.waitFor(confirm, Timeouts.SHORT, 'change-staff confirm');
  await P.clickQ([confirm, btn('Confirm', 0)]);
  await P.waitGoneQ(confirm, Timeouts.SHORT, 'change-staff confirm');
  await settle(Timeouts.DEBOUNCE);
}

/** The "Cannot continue yet" block a lower re-open total raises on some builds; '' when absent. */
export async function cannotContinueText(timeout = 3_000): Promise<string> {
  const t = await P.poll(
    () => P.pageText('body'),
    (x) => x.includes('Cannot continue yet'),
    timeout,
  );
  const i = t.indexOf('Cannot continue yet');
  return i >= 0 ? t.slice(i, i + 200) : '';
}
