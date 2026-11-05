/**
 * VP-4390 helpers — the receipt shows the business phone in full; only the
 * customer's phone stays masked.
 *
 * NOT a spec. Test data from env with merchant #14 defaults (dev only):
 *   VP4390_CUSTOMER_ORDER — paid order with a customer phone ("OD261104-30413574")
 */

import { Routes } from '../../../src/constants/routes.js';
import { VpReceiptSf as R } from '../../../src/constants/testids.vp-receipt-sf.js';
import { CdMain } from '../../../src/constants/testids.voltqc-cd-e2e.js';
import { switchToMain } from '../../../src/helpers/window.js';
import businessInfoPage from '../../../src/pages/settings/BusinessInfoPage.js';
import receiptSettingsPage from '../../../src/pages/settings/ReceiptSettingsPage.js';
import { app } from '../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';

export const vp4390 = {
  customerOrder: process.env.VP4390_CUSTOMER_ORDER?.trim() || 'OD261104-30413574',
} as const;

export const PHONE_TOGGLE = 'show-business-phone' as const;

/** `(888) 887-6789` — the unmasked US display format. */
export const FULL_PHONE = /\(\d{3}\) \d{3}-\d{4}/;
/** Any masked phone: `***-***-1234`, `(***) ***-1234`. */
export const MASKED_PHONE = /\(?\*{3}\)?[ -]\*{3}-\d{4}/;

export const digits = (s: string): string => s.replace(/\D/g, '');

/** Display a 10-digit (or +1…) number the way the receipt does: `(xxx) xxx-xxxx`. */
export function displayPhone(raw: string): string {
  const d = digits(raw).slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : '';
}

export async function openReceiptSettings(): Promise<void> {
  await switchToMain();
  await app.go(Routes.SETTINGS_RECEIPT);
  await receiptSettingsPage.waitForReady();
}

/** Business phone as saved in Settings → Business Info, displayed `(xxx) xxx-xxxx`. */
export async function businessPhone(): Promise<string> {
  await switchToMain();
  await app.go(Routes.SETTINGS_BUSINESS);
  await businessInfoPage.waitForForm();
  return displayPhone(await businessInfoPage.readFieldByName('businessPhone'));
}

/** Header part of a receipt text: everything before the first order/cashier block. */
export function header(text: string, until: string): string {
  const i = text.indexOf(until);
  return i > 0 ? text.slice(0, i) : text;
}

/** Order History → open `code` (search) → Receipt → text of "Receipt Details". */
export async function openReceiptDialog(code?: string): Promise<{ code: string; text: string }> {
  await switchToMain();
  let opened = code ?? '';
  if (code) {
    await app.openHistoryOrder(code);
  } else {
    await app.go(Routes.ORDER_HISTORY);
    await P.waitFor(CdMain.historyLink, 20_000, 'an Order History row');
    opened = /OD\d{6}-\d+/.exec(await P.textOf(CdMain.historyLink))?.[0] ?? '';
    await P.clickQ(CdMain.historyLink);
    await P.waitFor(
      [{ css: 'main' }, { hasText: `Order #${opened}`, css: 'h1,h2,h3,p,span,div', nth: 0 }],
      20_000,
      `Order #${opened}`,
    );
  }
  await P.clickQ(R.historyReceiptButton);
  await P.waitFor(R.receiptDialog, 15_000, 'Receipt Details');
  return { code: opened, text: await P.textOf(R.receiptDialog) };
}
