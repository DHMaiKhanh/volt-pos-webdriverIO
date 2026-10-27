import { $, browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../components/index.js';
import { VqcCommon, btn, type VqcChain } from '../../../constants/testids.voltqc-pos.js';
import {
  PAY_METHODS,
  QUICK_CASH,
  TIP_PRESETS,
  VqcPay,
  type PayMethodLabel,
} from '../../../constants/testids.voltqc-pay.js';
import { completeCustomerTipIfPrompted, returnToHome } from '../../../flows/index.js';
import { settle } from '../../../helpers/wait.js';
import { withCustomerWindow } from '../../../helpers/window.js';
import { checkoutPage, homePage, paymentSuccessPage } from '../../index.js';
import type { Tender } from '../../pos/CheckoutPage.js';
import { parseMoney } from '../../../utils/money.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';

/**
 * Helpers for the volt-qc 03 PAY port (volt-qc `src/flows/pay.ts`), WebdriverIO
 * edition. Everything money-shaped is CENTS; `NaN` means "row not on screen".
 *
 * Built on the shared page objects (CheckoutPage, PaymentSuccessPage,
 * PasscodeDialog, CustomerDisplayPage) plus the role/name probe the other
 * volt-qc ports use, for the bits those page objects do not expose.
 */

export { P };

const MONEY = /-?\s*\$\s*[\d,]+(?:\.\d{1,2})?/g;

/** Last `$x.xx` in a string, in cents; NaN when there is none. */
export function lastMoney(text: string): number {
  const all = text.match(MONEY);
  const last = all?.[all.length - 1];
  return last === undefined ? Number.NaN : parseMoney(last);
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Amount right after `label` in a " | "-joined page text, in cents (NaN if absent). */
export function pick(text: string, label: string): number {
  const m = new RegExp(`(?:^|\\| )${escapeRe(label)} \\| (-?\\s*\\$[\\d,.]+)`).exec(text);
  return m?.[1] ? parseMoney(m[1]) : Number.NaN;
}

/** "$1,234.50" from cents. */
export function usd(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const s = `$${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}

/** "Card" → the CheckoutPage tender key. */
export const TENDER: Record<PayMethodLabel, Tender> = {
  Card: 'card',
  Cash: 'cash',
  'Gift Card': 'gift-card',
  Other: 'other',
};

/* ------------------------------------------------------------------------- *
 * Checkout reads
 * ------------------------------------------------------------------------- */

export type MethodAmounts = Record<PayMethodLabel, number>;

/** The amount printed on each tender button (NaN when a button shows a reason instead). */
export async function methodAmounts(): Promise<MethodAmounts> {
  const out = {} as MethodAmounts;
  for (const m of PAY_METHODS) {
    const t = (await P.has(VqcPay.methodButton(m))) ? await P.textOf(VqcPay.methodButton(m)) : '';
    out[m] = lastMoney(t);
  }
  return out;
}

/** Is the tender button rendered as the active one (`bg-primary-500`)? */
export async function isMethodActive(m: PayMethodLabel): Promise<boolean> {
  const cls = (await P.attrOf(VqcPay.methodButton(m), 'class')) ?? '';
  return /(^|\s)bg-primary-500(\s|$)/.test(cls);
}

export interface CheckoutState {
  text: string;
  entered: number;
  totalPaid: number;
  remaining: number;
  hasChange: boolean;
  change: number;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

/** One read of the checkout screen (main column + summary). */
export async function checkoutState(): Promise<CheckoutState> {
  const t = await P.pageText('main');
  const hasChange = /\| Change \| \$/.test(t);
  const entered = await checkoutPage.enteredAmountCents();
  return {
    text: t,
    entered,
    totalPaid: pick(t, 'Total Paid'),
    remaining: pick(t, 'Remaining'),
    hasChange,
    change: hasChange ? pick(t, 'Change') : 0,
    subtotal: pick(t, 'Subtotal'),
    tax: Number.isNaN(pick(t, 'Tax')) ? 0 : pick(t, 'Tax'),
    tip: Number.isNaN(pick(t, 'Tip')) ? 0 : pick(t, 'Tip'),
    total: pick(t, 'Total'),
  };
}

/** The human order code (`OD251027-12`) from the checkout header `Order #…`. */
export async function checkoutOrderCode(): Promise<string> {
  const t = await checkoutPage.orderNumber();
  return /#\s*(\S+)/.exec(t)?.[1] ?? t.trim();
}

/* ------------------------------------------------------------------------- *
 * Keypad
 * ------------------------------------------------------------------------- */

/**
 * Click an element the page stamps with `data-vqcpay-hit` (script returns true
 * when it stamped one). A REAL WebDriver click, so the keypad's onMouseDown fires.
 */
async function clickStamped(script: string, ...args: unknown[]): Promise<void> {
  const ok = await P.exec<boolean>(
    'var p = document.querySelectorAll("[data-vqcpay-hit]"); for (var i = 0; i < p.length; i++) p[i].removeAttribute("data-vqcpay-hit");' +
      script,
    ...args,
  );
  if (!ok) throw new Error('clickStamped(): the target was not found');
  await $('[data-vqcpay-hit]').click();
  await settle(150);
}

/**
 * Press the "9" key without hit-testing.
 *
 * On build 1.1.x the cash quick-select column is laid ON TOP of the digit
 * column and "$50" physically covers "9" (see the keypad-preset-overlap note),
 * so a real click lands on $50. The keypad listens on mousedown, so a
 * dispatched mousedown/mouseup on the key itself registers like a press.
 */
async function pressCoveredKey(k: string, scopeCss: string): Promise<void> {
  const ok = await P.exec<boolean>(
    'var key = arguments[0]; var root = document.querySelectorAll(arguments[1]); root = root[root.length - 1]; if (!root) return false;' +
      'var b = Array.prototype.filter.call(root.querySelectorAll("button"), function (x) { return (x.textContent || "").trim() === key; });' +
      'var el = b[b.length - 1]; if (!el) return false;' +
      'var o = { bubbles: true, cancelable: true, button: 0 };' +
      'el.dispatchEvent(new PointerEvent("pointerdown", o)); el.dispatchEvent(new MouseEvent("mousedown", o));' +
      'el.dispatchEvent(new PointerEvent("pointerup", o)); el.dispatchEvent(new MouseEvent("mouseup", o)); el.dispatchEvent(new MouseEvent("click", o));' +
      'return true;',
    k,
    scopeCss,
  );
  if (!ok) throw new Error(`pressCoveredKey(): no "${k}" key in ${scopeCss}`);
  await settle(150);
}

/**
 * Press checkout keypad keys: digits, `C`, `back`, `00` or a quick-cash label.
 * `9` goes through {@link pressCoveredKey} (covered by $50 on the cash tab).
 */
export async function keys(seq: readonly string[]): Promise<void> {
  for (const k of seq) {
    if (k === 'C') await checkoutPage.clearAmount();
    else if (k === 'back') await checkoutPage.pressBackspace();
    else if ((QUICK_CASH as readonly string[]).includes(k)) await P.clickQ(VqcPay.quickCash(k));
    else if (k === '9') await pressCoveredKey('9', 'main');
    else if (/^\d+$/.test(k)) {
      for (const d of k) {
        if (d === '9') await pressCoveredKey('9', 'main');
        else await checkoutPage.typeDigits(d);
      }
    } else await P.clickQ(VqcPay.keypadKey(k));
  }
}

/** `C` then the cents digits of `cents` (9s included). */
export async function typeAmount(cents: number): Promise<void> {
  await keys(['C', ...String(cents).split('')]);
}

/* ------------------------------------------------------------------------- *
 * Cashier Tip dialog
 * ------------------------------------------------------------------------- */

export async function isTipEnabled(): Promise<boolean> {
  if (!(await P.has(VqcPay.tipButton))) return false;
  return !(await P.isDisabled(VqcPay.tipButton));
}

export async function openCashierTip(): Promise<void> {
  await P.clickQ(VqcPay.tipButton);
  await P.waitFor(VqcPay.tipDialog, Timeouts.SHORT, 'cashier Tip dialog');
}

export async function tipKeys(seq: readonly string[]): Promise<void> {
  for (const k of seq) {
    if (k === 'back') {
      // The backspace is the icon button straight after "0" in the keypad row.
      await clickStamped(
        'var d = document.querySelectorAll("[role=dialog]"); d = Array.prototype.filter.call(d, function (x) { return (x.textContent || "").indexOf("Enter Amount") >= 0; }); d = d[d.length - 1]; if (!d) return false;' +
          'var z = Array.prototype.filter.call(d.querySelectorAll("button"), function (x) { return (x.textContent || "").trim() === "0"; })[0];' +
          'var n = z && z.nextElementSibling; if (!n) return false; n.setAttribute("data-vqcpay-hit", "1"); return true;',
      );
    } else if ((TIP_PRESETS as readonly string[]).includes(k) || k === '00' || k === 'C') {
      await P.clickQ(VqcPay.tipKey(k));
    } else {
      for (const d of k) await P.clickQ(VqcPay.tipKey(d));
    }
  }
}

/** The Enter Amount figure inside the Tip dialog, in cents. */
export async function tipDialogAmount(): Promise<number> {
  const raw = (await P.rawText(VqcPay.tipDialog)) ?? '';
  const t = raw.replace(/\s*\n+\s*/g, ' | ');
  const m = /Enter Amount \| (\$[\d,.]+)/.exec(t);
  return m?.[1] ? parseMoney(m[1]) : Number.NaN;
}

export async function addTipAndClose(): Promise<void> {
  await P.clickQ(VqcPay.tipAdd);
  await P.waitGoneQ(VqcPay.tipDialog, Timeouts.SHORT, 'cashier Tip dialog');
  await settle(900);
}

/** Tip → keys → Add. `['5','0','0']` = $5.00; `['$20']` adds $20. */
export async function setCashierTip(seq: readonly string[]): Promise<void> {
  await openCashierTip();
  await tipKeys(seq);
  await addTipAndClose();
}

/** Back-space the tip to $0 and Add (removes the tip row). */
export async function clearCashierTip(): Promise<void> {
  await openCashierTip();
  for (let i = 0; i < 10 && (await tipDialogAmount()) > 0; i += 1) await tipKeys(['back']);
  await addTipAndClose();
}

/* ------------------------------------------------------------------------- *
 * Passcode
 * ------------------------------------------------------------------------- */

/** Forget the "skip passcode for 30 minutes" grace window so the guard shows again. */
export async function clearPasscodeSkip(): Promise<void> {
  await P.localSet(VqcPay.passcodeSkipKey, null);
}

export async function passcodeText(): Promise<string> {
  const raw = (await P.rawText(VqcCommon.passcodeDialog)) ?? '';
  return raw.replace(/\s*\n+\s*/g, ' | ');
}

/** Tap digits on the open guard; returns whether it is still open and its text. */
export async function typePasscode(code: string): Promise<{ open: boolean; text: string }> {
  for (const d of code) await P.clickQ([VqcCommon.passcodeDialog, btn(d, 0)]);
  await settle(1_500);
  const open = await passcodeDialog.isPrompting(Timeouts.ANIMATION);
  return { open, text: open ? await passcodeText() : '' };
}

/* ------------------------------------------------------------------------- *
 * Complete Payment → customer tip handoff
 * ------------------------------------------------------------------------- */

/**
 * Complete Payment, answer the guard if asked, then wait for EITHER the
 * customer tip handoff (true) or the success screen (false).
 */
export async function completeUntilCustomerTip(timeout: number = Timeouts.LONG): Promise<boolean> {
  await checkoutPage.pressCompletePayment();
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await paymentSuccessPage.isActive()) return false;
    if (await passcodeDialog.isPrompting(Timeouts.ANIMATION)) {
      await passcodeDialog.enter(env.STAFF_PASSCODE);
      continue;
    }
    if (await checkoutPage.isWaitingForCustomerTip()) return true;
    await settle(400);
  }
  throw new Error('Complete Payment reached neither the customer tip handoff nor payment-success');
}

/** Press Complete Payment and drive guard + (no-tip) handoff to the success screen. */
export async function completeToSuccess(): Promise<string> {
  await checkoutPage.pressCompletePayment();
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
  await completeCustomerTipIfPrompted('none');
  return waitSuccess();
}

/* ------------------------------------------------------------------------- *
 * Customer display
 * ------------------------------------------------------------------------- */

export function customerText(): Promise<string> {
  return withCustomerWindow(() => P.pageText('body'));
}

export interface TipPreset {
  index: number;
  percent: number;
  amount: number;
  selected: boolean;
}

/** `%` preset tiles on the customer tip screen (`15%` + `$4.50`). */
export function customerTipPresets(): Promise<TipPreset[]> {
  return withCustomerWindow(async () => {
    const raw = await P.exec<{ t: string; c: string }[]>(
      'return Array.prototype.filter.call(document.querySelectorAll("div.cursor-pointer"), function (el) { return /\\d+(\\.\\d+)?%/.test(el.textContent || "") && el.getClientRects().length > 0 && !el.querySelector("div.cursor-pointer"); })' +
        '.map(function (el) { return { t: String(el.innerText || el.textContent || ""), c: String(el.className || "") }; });',
    );
    return raw.map((r, index) => {
      const p = /(\d+(?:\.\d+)?)%/.exec(r.t);
      return {
        index,
        percent: Number(p?.[1] ?? Number.NaN),
        amount: lastMoney(r.t.replace(p?.[0] ?? '', '')),
        selected: /bg-primary|border-primary|ring-/.test(r.c),
      };
    });
  });
}

export function clickCustomerPreset(index: number): Promise<void> {
  return withCustomerWindow(() =>
    clickStamped(
      'var t = Array.prototype.filter.call(document.querySelectorAll("div.cursor-pointer"), function (el) { return /\\d+(\\.\\d+)?%/.test(el.textContent || "") && el.getClientRects().length > 0 && !el.querySelector("div.cursor-pointer"); });' +
        'var el = t[arguments[0]]; if (!el) return false; el.setAttribute("data-vqcpay-hit", "1"); return true;',
      index,
    ),
  );
}

/** Click a customer-display element whose own text is exactly `text`. */
export function customerClickText(text: string): Promise<void> {
  return withCustomerWindow(() => P.clickQ({ text, nth: 0 }));
}

export function customerClickButton(name: string): Promise<void> {
  return withCustomerWindow(() => P.clickQ(btn(name, 0)));
}

export function customerHas(chain: VqcChain): Promise<boolean> {
  return withCustomerWindow(() => P.has(chain));
}

export function customerContinueDisabled(): Promise<boolean> {
  return withCustomerWindow(() => P.isDisabled(btn('Continue', 0)));
}

/** "Tip based on total: $x" on the customer tip screen, in cents. */
export async function customerTipBasedOn(): Promise<number> {
  const t = await customerText();
  const m = /Tip based on total:? \| ?(\$[\d,.]+)|Tip based on total:? (\$[\d,.]+)/.exec(t);
  const v = m?.[1] ?? m?.[2];
  return v ? parseMoney(v) : Number.NaN;
}

/** Wait for the customer tip screen to render. */
export async function waitCustomerTipScreen(timeout: number = Timeouts.LONG): Promise<void> {
  await browser.waitUntil(async () => /Add a tip/.test(await customerText()), {
    timeout,
    interval: 500,
    timeoutMsg: 'The customer display never showed "Add a tip"',
  });
}

/* ------------------------------------------------------------------------- *
 * Payment success
 * ------------------------------------------------------------------------- */

/** Wait for payment-success and return its " | "-joined body text. */
export async function waitSuccess(timeout: number = Timeouts.API): Promise<string> {
  await paymentSuccessPage.waitForNavigation(timeout);
  await browser.waitUntil(async () => (await P.pageText('body')).includes(VqcPay.successHeading), {
    timeout: Timeouts.MEDIUM,
    interval: 300,
    timeoutMsg: `"${VqcPay.successHeading}" never rendered`,
  });
  await settle(600);
  return P.pageText('body');
}

/** No Receipt → wait until the router leaves payment-success. */
export async function noReceipt(): Promise<void> {
  await paymentSuccessPage.continueToNextOrder();
  await paymentSuccessPage.waitForFlowToEnd();
}

/** Did a toast (or inline text) matching `re` show within `timeout`? */
export async function toastSeen(re: string, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
  return browser
    .waitUntil(async () => (await P.has(VqcPay.toast(re))) || new RegExp(re).test(await P.pageText('body')), {
      timeout,
      interval: 300,
    })
    .then(() => true)
    .catch(() => false);
}

/* ------------------------------------------------------------------------- *
 * Gift-card tender dialog
 * ------------------------------------------------------------------------- */

/**
 * Gift Card tender → Complete Payment → (guard, customer tip) → scan dialog →
 * "Input Gift Card Code". Leaves the code dialog open.
 */
export async function openGiftCardCodeDialog(): Promise<void> {
  await checkoutPage.selectTender('gift-card');
  await checkoutPage.pressCompletePayment();
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
  await completeCustomerTipIfPrompted('none', undefined, Timeouts.MEDIUM);
  await P.waitFor(VqcPay.gcInputCodeButton, Timeouts.MEDIUM, '"Input Gift Card Code" button');
  await P.clickQ(VqcPay.gcInputCodeButton);
  await P.waitFor(VqcPay.gcCodeDialog, Timeouts.SHORT, '"Enter Gift Card Code" dialog');
}

/** Type a code into the open code dialog (Confirm may need a second fill on a fresh dialog). */
export async function fillGiftCardCode(code: string): Promise<string> {
  return P.fillQ(VqcPay.gcCodeInput, code);
}

export function dialogText(chain: VqcChain): Promise<string> {
  return P.rawText(chain).then((t) => (t ?? '').replace(/\s*\n+\s*/g, ' | '));
}

/** Close whatever gift-card dialog is up (Cancel → Close, Escape as last resort). */
export async function closeGiftDialogs(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    if (
      !(await P.has(VqcPay.gcScanDialog)) &&
      !(await P.has(VqcPay.gcAcceptedDialog)) &&
      !(await P.has(VqcPay.gcNotEnoughDialog))
    ) {
      return;
    }
    const top = { role: 'dialog', nth: -1 } as const;
    if (await P.has([top, btn('Cancel', 0)])) await P.clickQ([top, btn('Cancel', 0)]);
    else if (await P.has([top, btn('Close', 0)])) await P.clickQ([top, btn('Close', 0)]);
    else await P.escape();
    await settle(500);
  }
}

/* ------------------------------------------------------------------------- *
 * Home / drafts
 * ------------------------------------------------------------------------- */

/** Leave the till on an empty /home whatever state the case ended in. */
export async function cleanTill(): Promise<void> {
  await closeGiftDialogs().catch(() => undefined);
  if (await paymentSuccessPage.isActive().catch(() => false)) await noReceipt().catch(() => undefined);
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

export async function isHomePayDisabled(): Promise<boolean> {
  return P.isDisabled(VqcPay.homePay);
}

/** A real double click (two quick down/up pairs) on the centre of the first hit. */
export async function doubleClickQ(chain: VqcChain): Promise<void> {
  const i = await P.info(chain);
  if (!i) throw new Error(`doubleClickQ(): nothing matches ${JSON.stringify(chain)}`);
  const x = Math.round(i.rect.x + i.rect.w / 2);
  const y = Math.round(i.rect.y + i.rect.h / 2);
  await browser.action('pointer').move({ x, y }).down().up().pause(60).down().up().perform();
  await settle(300);
}

/** Computed white-space / text-overflow / height of the first element whose text starts with `prefix`. */
export function ellipsisStyle(
  prefix: string,
): Promise<{ ws: string; to: string; h: number; lh: number } | null> {
  return P.exec<{ ws: string; to: string; h: number; lh: number } | null>(
    'var pre = arguments[0]; var els = Array.prototype.filter.call(document.querySelectorAll("body *"), function (el) { var t = (el.textContent || "").trim(); return (t.charAt(0) === "(" ? t.slice(1) : t).indexOf(pre) === 0 && el.children.length === 0; });' +
      'var el = els[0]; if (!el) return null; var cs = getComputedStyle(el); var lh = parseFloat(cs.lineHeight) || 28;' +
      'return { ws: cs.whiteSpace, to: cs.textOverflow, h: el.getBoundingClientRect().height, lh: lh };',
    prefix,
  );
}

/** The back arrow of the customer Custom Tip keypad (the button just before "Custom tip on …"). */
export function customerCustomTipBack(): Promise<void> {
  return withCustomerWindow(() =>
    clickStamped(
      'var h = Array.prototype.filter.call(document.querySelectorAll("body *"), function (el) { return /^Custom tip on/.test((el.textContent || "").trim()) && el.children.length === 0; })[0];' +
        'if (!h) return false; var b = h.previousElementSibling; while (b && b.tagName !== "BUTTON") b = b.previousElementSibling;' +
        'if (!b && h.parentElement) b = h.parentElement.querySelector("button");' +
        'if (!b) return false; b.setAttribute("data-vqcpay-hit", "1"); return true;',
    ),
  );
}
