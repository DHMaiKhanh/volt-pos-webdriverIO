/**
 * Shared glue for the volt-qc `@mutation` / `@settings` port of APP / RPT / SET /
 * PERM (`tests/regression/volt-qc/app-rpt-set-perm/`).
 *
 * Builds on the read-only ports' probes — `gateProbe` (passcode guard),
 * `vqProbe` (in-page query resolver) and the report readers — and adds what a
 * WRITING case needs: a clean till, a settled cash order, the merchant-global
 * snapshot/restore of Passcode Setting, language switching that survives the
 * Vietnamese passcode guard, and a best-effort read of the customer window.
 *
 * Nothing here asserts; specs decide.
 */

import { $, browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { AspIds } from '../../../constants/testids.voltqc-app-rpt-set-perm.js';
import { Vq } from '../../../constants/testids.voltqc-settings-devm.js';
import {
  completeCustomerTipIfPrompted,
  goToSettings,
  payInCash,
  returnToHome,
} from '../../../flows/index.js';
import { settle, waitUntilPath } from '../../../helpers/wait.js';
import { withCustomerWindow } from '../../../helpers/window.js';
import {
  accessibilitySettingsPage,
  checkoutPage,
  homePage,
  paymentSuccessPage,
  settingsPage,
} from '../../index.js';
import permissionsSettingsPage from '../../settings/PermissionsSettingsPage.js';
import type { PasscodeGateState } from '../../index.js';
import { ensurePasscodeGrant } from '../../../support/passcodeGrant.js';
import { moduleLogger } from '../../../utils/logger.js';
import { gateProbe } from '../app-perm/GateProbe.js';
import { vqProbe } from '../settings-devm/VqProbe.js';

export const log = moduleLogger('volt-qc-asp');

export const ownerCode = (): string => env.OWNER_PASSCODE;

/** Short unique tag for names a case writes (`QC 1027-1532`). */
export function qcTag(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/* ------------------------------------------------------------------------- *
 * Navigation that works in either language
 * ------------------------------------------------------------------------- */

/**
 * Router-navigate to `route`, answer a guard (English OR Vietnamese heading)
 * with the owner code, and wait for the path. `passcodeDialog` only matches the
 * English copy, so a Vietnamese till needs this.
 */
export async function goAnyLang(route: string): Promise<void> {
  await gateProbe.dismiss();
  await gateProbe.routerNavigate(route);
  if (await gateProbe.waitOpen(2_500)) {
    const r = await gateProbe.submit(ownerCode());
    if (r.result !== 'allowed') throw new Error(`goAnyLang(${route}): owner code refused — ${r.error}`);
  }
  if ((await gateProbe.path()).startsWith('/settings')) await settingsPage.confirmLeaveGuardIfShown();
  await waitUntilPath((p) => p === route || p.startsWith(`${route}/`), {
    timeout: Timeouts.NAVIGATION,
    message: `goAnyLang(): never reached ${route}`,
  });
  await settle(400);
}

/** Which locale the till is on (the checked radio on Settings › Language). */
export async function currentLanguage(): Promise<'en' | 'vi'> {
  await goAnyLang('/settings/language');
  await vqProbe.waitShown(AspIds.language('en'), Timeouts.MEDIUM);
  return (await vqProbe.isChecked(AspIds.language('vi'))) ? 'vi' : 'en';
}

/** Switch the merchant-global UI language (Tag.EXCLUSIVE). */
export async function setLanguage(code: 'en' | 'vi'): Promise<void> {
  await goAnyLang('/settings/language');
  await vqProbe.waitShown(AspIds.language(code), Timeouts.MEDIUM);
  if (!(await vqProbe.isChecked(AspIds.language(code)))) {
    await vqProbe.press(AspIds.language(code));
    await settle(1_200);
  }
}

/** Put the till back on English whatever state a case died in. */
export async function restoreEnglish(): Promise<void> {
  try {
    await gateProbe.dismiss();
    await setLanguage('en');
  } catch (error) {
    log.warn(`restoreEnglish(): ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Visible text of `<body>` (textContent fallback), whitespace-collapsed. */
export async function bodyText(css = 'body'): Promise<string> {
  return browser.execute(function (sel: string) {
    const el = document.querySelector<HTMLElement>(sel);
    return el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ') : '';
  }, css);
}

/** Wait for a sonner toast containing `text`. */
export function toastShown(text: string, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
  return vqProbe.isShown(Vq.toast(text), timeout);
}

/* ------------------------------------------------------------------------- *
 * Theme / customer display
 * ------------------------------------------------------------------------- */

const darkScript = function (): boolean {
  const root = document.documentElement;
  return root.classList.contains('dark') || root.getAttribute('data-theme') === 'dark';
};

export function isDark(): Promise<boolean> {
  return browser.execute(darkScript);
}

/**
 * Run `fn` on the customer window; `null` when that window is not a WebDriver
 * handle (the attach lane has only the staff window).
 */
export async function onCustomer<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await withCustomerWindow(fn);
  } catch (error) {
    log.warn(`customer window unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export function customerIsDark(): Promise<boolean | null> {
  return onCustomer(() => browser.execute(darkScript));
}

export function customerText(): Promise<string | null> {
  return onCustomer(() => bodyText());
}

/** Poll the customer window's text until `re` matches (or `null` without a handle). */
export async function waitCustomerText(
  re: RegExp,
  timeout: number = Timeouts.MEDIUM,
): Promise<boolean | null> {
  const deadline = Date.now() + timeout;
  do {
    const t = await customerText();
    if (t === null) return null;
    if (re.test(t)) return true;
    await settle(500);
  } while (Date.now() < deadline);
  return false;
}

/* ------------------------------------------------------------------------- *
 * Orders
 * ------------------------------------------------------------------------- */

/** Back on /home with no draft open. */
export async function cleanTill(): Promise<void> {
  await gateProbe.dismiss();
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

/** A draft on /home (staff + `lines` services), NOT taken to checkout. */
export async function buildHomeDraft(lines = 1, staffIndex = 0): Promise<void> {
  await cleanTill();
  await homePage.selectStaffByIndex(staffIndex);
  const n = Math.max(await homePage.visibleServiceCount(), 1);
  for (let i = 0; i < lines; i += 1) await homePage.addServiceByIndex(i % n);
}

export interface DraftAtCheckout {
  orderId: string;
  /** Human order code as the header shows it (`#OD…`). */
  orderNumber: string;
}

/** Build a draft and press Pay; leaves the app on checkout (card tab). */
export async function draftToCheckout(lines = 1, staffIndex = 0): Promise<DraftAtCheckout> {
  await buildHomeDraft(lines, staffIndex);
  await homePage.pressPay();
  await checkoutPage.waitForReady();
  return { orderId: await checkoutPage.orderId(), orderNumber: (await checkoutPage.orderNumber()).trim() };
}

export interface SettledOrder extends DraftAtCheckout {
  /** What the cash tender charged, in cents. */
  totalCents: number;
}

/** Create a draft, settle it in cash exactly, end the sale. Back on /home. */
export async function settleCashOrder(lines = 1, staffIndex = 0): Promise<SettledOrder> {
  const draft = await draftToCheckout(lines, staffIndex);
  await checkoutPage.selectTender('cash');
  const totalCents = await checkoutPage.totalCents();
  const success = await payInCash(draft.orderId);
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();
  await returnToHome();
  return { ...draft, totalCents };
}

/** On checkout, settle the cash balance (prompted tip → none) and end the sale. */
export async function finishCashOnCheckout(orderId: string): Promise<void> {
  const success = await payInCash(orderId);
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();
}

/** After a Complete Payment pressed elsewhere: drive a customer tip prompt, then end the sale. */
export async function endSaleAfterComplete(): Promise<void> {
  await completeCustomerTipIfPrompted('none');
  await paymentSuccessPage.waitForReady(Timeouts.API);
  await paymentSuccessPage.continueToNextOrder();
  await paymentSuccessPage.waitForFlowToEnd();
}

/* ------------------------------------------------------------------------- *
 * Passcode Setting (merchant-global) snapshot / restore
 * ------------------------------------------------------------------------- */

export async function openAccessibility(): Promise<void> {
  await gateProbe.dismiss();
  await goToSettings();
  await settingsPage.openSection('ACCESSIBILITY');
  await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
}

export async function readGates(): Promise<PasscodeGateState> {
  await openAccessibility();
  return accessibilitySettingsPage.readGates();
}

/** Set some gates and Save once. Leaves the app on Accessibility. */
export async function saveGates(state: Partial<PasscodeGateState>): Promise<void> {
  await openAccessibility();
  await accessibilitySettingsPage.applyGates(state);
  await settle(Timeouts.DEBOUNCE);
}

/** Restore a full snapshot, re-arm the run's grant, back on /home. Never throws. */
export async function restoreGates(snapshot: PasscodeGateState | null): Promise<void> {
  try {
    await gateProbe.dismiss();
    if (snapshot) await saveGates(snapshot);
  } catch (error) {
    log.warn(`restoreGates(): ${error instanceof Error ? error.message : String(error)}`);
  }
  await ensurePasscodeGrant().catch(() => false);
  await returnToHome().catch(() => undefined);
}

/** Is any Passcode Setting gate different from `snapshot` right now? */
export async function gatesDiffer(snapshot: PasscodeGateState): Promise<string[]> {
  const now = await readGates();
  return (Object.keys(snapshot) as (keyof PasscodeGateState)[]).filter((g) => now[g] !== snapshot[g]);
}

/* ------------------------------------------------------------------------- *
 * Settings › Permissions matrix (merchant-global — writes on toggle, no Save)
 * ------------------------------------------------------------------------- */

const MARK = 'data-asp-mark';

/**
 * Stamp the switch of `rowLabel` × column `col` (0 Owner, 1 Manager, 2 Partner,
 * 3 Staff) with a one-off attribute and return its selector, or `null` when the
 * row is not rendered (collapsed group). Mirrors `PermissionsSettingsPage.readMatrix`.
 */
async function markPermSwitch(rowLabel: string, col: number): Promise<string | null> {
  const tag = `p${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`;
  const ok = await browser.execute(
    function (label: string, column: number, attr: string, value: string): boolean {
      const clean = (el: Element): string => {
        const c = el.cloneNode(true) as HTMLElement;
        c.querySelectorAll('.sr-only').forEach((n) => n.remove());
        return (c.textContent ?? '').replace(/\s+/g, ' ').trim();
      };
      const rows = new Map<Element, Element[]>();
      for (const sw of Array.from(document.querySelectorAll('[role="switch"]'))) {
        if (sw.getClientRects().length === 0) continue;
        let row: Element | null = sw.parentElement;
        while (row && row !== document.body) {
          const n = row.querySelectorAll('[role="switch"]').length;
          if (n > 4) {
            row = null;
            break;
          }
          if (n === 4 && clean(row) !== '') break;
          row = row.parentElement;
        }
        if (!row || row === document.body) continue;
        const list = rows.get(row) ?? [];
        list.push(sw);
        rows.set(row, list);
      }
      for (const [row, switches] of rows.entries()) {
        const p = row.querySelector('p');
        if ((p ? clean(p) : clean(row)) !== label) continue;
        const sw = switches[column];
        if (!sw) return false;
        sw.setAttribute(attr, value);
        return true;
      }
      return false;
    },
    rowLabel,
    col,
    MARK,
    tag,
  );
  return ok ? `[${MARK}="${tag}"]` : null;
}

export async function openPermissions(): Promise<void> {
  await gateProbe.dismiss();
  await goToSettings();
  await settingsPage.openSection('PERMISSIONS');
  await permissionsSettingsPage.waitForReady(Timeouts.MEDIUM);
  await permissionsSettingsPage.expandAll();
}

/** `rowLabel` × column: `aria-checked`, or `null` when not rendered. */
export async function readPerm(rowLabel: string, col: number): Promise<boolean | null> {
  const css = await markPermSwitch(rowLabel, col);
  if (!css) return null;
  return (await $(css).getAttribute('aria-checked')) === 'true';
}

/** Click `rowLabel` × column once (the matrix writes immediately, debounced per key). */
export async function clickPerm(rowLabel: string, col: number): Promise<void> {
  const css = await markPermSwitch(rowLabel, col);
  if (!css) throw new Error(`Permissions: no switch for "${rowLabel}" × column ${String(col)}`);
  await $(css).click();
}

/** Put `rowLabel` × column to `on` (click only when different). */
export async function setPerm(rowLabel: string, col: number, on: boolean): Promise<void> {
  if ((await readPerm(rowLabel, col)) === on) return;
  await clickPerm(rowLabel, col);
  await settle(Timeouts.DEBOUNCE);
}

/** A 10-digit US-style number no seed customer uses (`555` exchange). */
export function randomPhone(): string {
  const tail = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
  return `832555${tail}`;
}

/**
 * Draft + a BRAND-NEW customer (quick-add) + exact cash settle. Returns the
 * customer window's text on the success screen (`null` without a customer
 * handle), then ends the sale. Back on /home.
 */
export async function payCashWithNewCustomer(): Promise<{
  order: SettledOrder;
  customerSuccessText: string | null;
}> {
  await buildHomeDraft();
  await homePage.attachCustomerByPhone(randomPhone());
  if (await homePage.isNewCustomerFormShown()) await homePage.saveNewCustomer(`QC E2E ${qcTag()}`);
  await homePage.pressPay();
  await checkoutPage.waitForReady();
  const orderId = await checkoutPage.orderId();
  const orderNumber = (await checkoutPage.orderNumber()).trim();
  await checkoutPage.selectTender('cash');
  const totalCents = await checkoutPage.totalCents();
  const success = await payInCash(orderId);
  await settle(1_500);
  const customerSuccessText = await customerText();
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();
  await returnToHome();
  return { order: { orderId, orderNumber, totalCents }, customerSuccessText };
}

/* ------------------------------------------------------------------------- *
 * Cash order up to the customer's tip screen
 * ------------------------------------------------------------------------- */

export interface TipScreenResult extends DraftAtCheckout {
  /** The customer display is on "Add a tip" (false: the sale settled without one). */
  tipScreen: boolean;
  totalCents: number;
}

/**
 * On checkout (cash): press Complete Payment and wait until either the till
 * waits on the customer's tip or the sale lands on payment-success. Answers a
 * Completed Payment guard with the owner code.
 */
export async function cashToTipScreen(draft: DraftAtCheckout): Promise<TipScreenResult> {
  await checkoutPage.selectTender('cash');
  const totalCents = await checkoutPage.totalCents();
  await checkoutPage.pressCompletePayment();
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if ((await gateProbe.path()).includes('payment-success'))
      return { ...draft, totalCents, tipScreen: false };
    if (await gateProbe.isOpen()) {
      await gateProbe.submit(ownerCode());
      continue;
    }
    if (await checkoutPage.isWaitingForCustomerTip()) return { ...draft, totalCents, tipScreen: true };
    await settle(500);
  }
  throw new Error(
    `cashToTipScreen(${draft.orderNumber}): neither a tip screen nor payment-success after 45 s`,
  );
}

export interface CustomerPreset {
  percent: number | null;
  /** cents */
  amount: number;
}

/** Tip preset cards on the customer display, in order (`null` without a customer handle). */
export function customerTipPresets(): Promise<CustomerPreset[] | null> {
  return onCustomer(() =>
    browser.execute(function () {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('div.cursor-pointer')).filter((d) =>
        /^\s*(\d+%)?\s*\$[\d,.]+\s*$/.test(d.innerText.replace(/\n/g, ' ')),
      );
      return cards.map((c) => {
        const t = c.innerText.replace(/\n/g, ' ');
        const p = /(\d+)%/.exec(t);
        const a = /\$([\d,.]+)/.exec(t);
        return {
          percent: p ? Number(p[1]) : null,
          amount: a ? Math.round(Number((a[1] ?? '').replace(/,/g, '')) * 100) : Number.NaN,
        };
      });
    }),
  );
}

/** From the tip screen: tip (none, or a custom amount in cents), settle, return the success text, end the sale. */
export async function finishFromTipScreen(customTipCents?: number): Promise<string> {
  await completeCustomerTipIfPrompted(
    customTipCents === undefined ? 'none' : 'custom',
    customTipCents,
    Timeouts.MEDIUM,
  );
  await paymentSuccessPage.waitForReady(Timeouts.API);
  const text = await bodyText('main');
  await paymentSuccessPage.continueToNextOrder();
  await paymentSuccessPage.waitForFlowToEnd();
  await returnToHome();
  return text;
}

/** One full cash sale; returns the customer's tip presets when a tip screen showed, else `null`. */
export async function presetsOnNextCashOrder(): Promise<CustomerPreset[] | null> {
  const r = await cashToTipScreen(await draftToCheckout());
  if (!r.tipScreen) {
    await paymentSuccessPage.continueToNextOrder();
    await paymentSuccessPage.waitForFlowToEnd();
    await returnToHome();
    return null;
  }
  const presets = await customerTipPresets();
  await finishFromTipScreen();
  return presets;
}

/** Money text → cents (`$1,234.50` → 123450; `-$2.00` → -200). */
export function moneyCents(text: string | undefined | null): number {
  const m = /(-?)\$?\s*(-?)([\d,]+(?:\.\d+)?)/.exec(text ?? '');
  if (!m) return Number.NaN;
  const sign = m[1] === '-' || m[2] === '-' ? -1 : 1;
  return sign * Math.round(Number((m[3] ?? '').replace(/,/g, '')) * 100);
}
