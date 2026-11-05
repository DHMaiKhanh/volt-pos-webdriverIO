/**
 * VP-5634 helpers — the printed receipt carries each service at its
 * fee-inclusive price when "Group items by staff or guest" is off.
 *
 * NOT a spec. Adds, on top of the volt-qc CD layer (`app` / `cust`):
 *   - the merchant-global "Group items by staff or guest" switch (read / set + Save);
 *   - decoding a captured print (base64 ESC/POS, see `installPrintCapture`) into
 *     receipt lines and parsing its service lines / Subtotal / Total;
 *   - reading `name → $amount` service lines off the checkout panel, the
 *     customer display and the Order History detail;
 *   - Order History filtered to Card.
 *
 * Test data comes from env with merchant #14 defaults (dev only):
 *   VP5634_SERVICE_1 — fixed-price service  ("Tropical Deluxe", $54.00)
 *   VP5634_SERVICE_2 — fixed-price service  ("Full set Ombre (2 colors)", $50.00)
 */

import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../../src/constants/routes.js';
import { CdMain } from '../../../src/constants/testids.voltqc-cd-e2e.js';
import { VpReceiptSf as R } from '../../../src/constants/testids.vp-receipt-sf.js';
import { returnToHome } from '../../../src/flows/index.js';
import { settle } from '../../../src/helpers/wait.js';
import { switchToMain } from '../../../src/helpers/window.js';
import receiptSettingsPage from '../../../src/pages/settings/ReceiptSettingsPage.js';
import { app } from '../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { parseMoney } from '../../../src/utils/money.js';

export const vp5634 = {
  service1: process.env.VP5634_SERVICE_1?.trim() || 'Tropical Deluxe',
  service2: process.env.VP5634_SERVICE_2?.trim() || 'Full set Ombre (2 colors)',
} as const;

export const GROUP_TOGGLE = 'group-items-by-staff-or-guest' as const;

const MONEY_TOKEN = /^-?\$[\d,]+\.\d{2}$/;
const MONEY_AT_END = /(-?\$[\d,]+\.\d{2})\s*$/;

/** One `name … $amount` line (amount in cents). */
export interface Line {
  name: string;
  cents: number;
}

export const sumCents = (lines: readonly Line[]): number => lines.reduce((s, l) => s + l.cents, 0);

/* ----------------------------------------------------------------------- *
 * Settings → Receipt: "Group items by staff or guest"
 * ----------------------------------------------------------------------- */

export async function openReceiptSettings(): Promise<void> {
  await switchToMain();
  await app.go(Routes.SETTINGS_RECEIPT);
  await receiptSettingsPage.waitForReady();
}

/** Current SAVED value of the group switch (opens Settings → Receipt). */
export async function groupItemsOn(): Promise<boolean> {
  await openReceiptSettings();
  return receiptSettingsPage.isToggleOn(GROUP_TOGGLE);
}

/**
 * Put the group switch to `on` and Save (merchant-global). No-op when it
 * already is. Ends back on Home.
 */
export async function setGroupItems(on: boolean): Promise<void> {
  await openReceiptSettings();
  if ((await receiptSettingsPage.isToggleOn(GROUP_TOGGLE)) !== on) {
    await receiptSettingsPage.toggle(GROUP_TOGGLE);
    await P.poll(
      () => receiptSettingsPage.isToggleOn(GROUP_TOGGLE),
      (v) => v === on,
      Timeouts.SHORT,
    );
    await P.clickQ(R.settingsSave);
    const saved = await P.poll(
      async () => R.settingsSavedToast.test(await app.text('body')),
      (v) => v,
      Timeouts.MEDIUM,
    );
    if (!saved)
      throw new Error('Saving Settings → Receipt raised no "Receipt settings updated successfully".');
    await P.closeToasts().catch(() => undefined);
  }
  await returnToHome();
}

/* ----------------------------------------------------------------------- *
 * Print capture → receipt text
 * ----------------------------------------------------------------------- */

/**
 * Text lines of a base64 ESC/POS payload. ESC / GS commands are dropped, raster
 * images (`GS v 0` — logo, QR, signature) become `[IMAGE]`, line feeds split.
 */
export function decodeReceipt(payload: string): string[] {
  const raw = Buffer.from(payload.trim(), 'base64');
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const b = raw[i] ?? 0;
    const c = raw[i + 1] ?? 0;
    if (b === 0x1d && c === 0x76 && raw[i + 2] === 0x30) {
      const w = (raw[i + 4] ?? 0) + (raw[i + 5] ?? 0) * 256;
      const h = (raw[i + 6] ?? 0) + (raw[i + 7] ?? 0) * 256;
      i += 8 + w * h;
      out += '[IMAGE]\n';
      continue;
    }
    if (b === 0x1b || b === 0x1d) {
      if (b === 0x1b && c === 0x40)
        i += 2; // ESC @ init
      else if (b === 0x1d && c === 0x28)
        i += 5 + (raw[i + 3] ?? 0) + (raw[i + 4] ?? 0) * 256; // GS ( fn
      else i += 3; // ESC/GS + 1 parameter byte
      continue;
    }
    if (b === 0x0a) out += '\n';
    else if (b >= 0x20 && b < 0x7f) out += String.fromCharCode(b);
    i += 1;
  }
  return out.split('\n').filter((l) => l.trim() !== '');
}

export interface Receipt {
  lines: string[];
  /** Lines between the header rule and the first "----" rule. */
  itemBlock: string[];
  services: Line[];
  /** Item-block lines without an amount (staff headings when grouped). */
  headings: string[];
  /** Service lines printed with a leading indent. */
  indented: number;
  subtotal: number;
  total: number;
  text: string;
}

function amountOf(lines: readonly string[], label: string): number {
  const line = lines.find((l) => l.trim().startsWith(label));
  const m = line ? MONEY_AT_END.exec(line) : null;
  return m?.[1] ? parseMoney(m[1]) : Number.NaN;
}

export function parseReceipt(payload: string): Receipt {
  const lines = decodeReceipt(payload);
  const rules = lines.map((l, idx) => (/^={10,}$/.test(l.trim()) ? idx : -1)).filter((idx) => idx >= 0);
  const start = (rules[1] ?? -1) + 1;
  const end = lines.findIndex((l, idx) => idx >= start && /^-{10,}$/.test(l.trim()));
  const itemBlock = start > 0 && end > start ? lines.slice(start, end) : [];
  const services: Line[] = [];
  const headings: string[] = [];
  let indented = 0;
  for (const l of itemBlock) {
    const m = MONEY_AT_END.exec(l);
    if (!m?.[1]) {
      if (!/^\(.*\)$/.test(l.trim())) headings.push(l.trim()); // "(note)" lines are not headings
      continue;
    }
    if (/^ {2}\S/.test(l)) indented += 1;
    services.push({ name: l.slice(0, m.index).trim(), cents: parseMoney(m[1]) });
  }
  return {
    lines,
    itemBlock,
    services,
    headings,
    indented,
    subtotal: amountOf(lines, 'Subtotal'),
    total: amountOf(lines, 'Total'),
    text: lines.join('\n'),
  };
}

/**
 * Record every `mutation print` the staff window sends, by wrapping
 * `window.fetch`: on 1.1.98 `__TAURI_INTERNALS__.invoke` is non-writable (the
 * VP-4809 wrap returns `none`), but IPC still goes out as
 * `fetch('http://ipc.localhost/graphql', { body: JSON })`. The call is passed
 * through untouched — without a printer the app then toasts "Printer not
 * connected", which changes nothing on the order. Idempotent: a second install
 * empties the buffer. A full reload drops the wrap.
 */
export async function installFetchPrintCapture(): Promise<void> {
  await switchToMain();
  await P.exec<void>(
    `var w = window;
     if (w.__vp5634Prints) { w.__vp5634Prints.length = 0; return; }
     w.__vp5634Prints = [];
     var orig = w.fetch;
     w.fetch = function (url, opts) {
       try {
         var body = opts && opts.body;
         if (String(url).indexOf('ipc.localhost/graphql') >= 0 && typeof body === 'string' && /mutation\\s+print\\b/.test(body)) {
           var parsed = JSON.parse(body);
           w.__vp5634Prints.push(String((parsed.variables && parsed.variables.data) || ''));
         }
       } catch (e) { /* never break the app's own call */ }
       return orig.apply(this, arguments);
     };`,
  );
}

async function fetchCapturedPrints(): Promise<string[]> {
  return P.exec<string[]>('return (window.__vp5634Prints || []).slice();');
}

/** Arm the capture (empties the buffer), run `press`, return the next receipt. */
export async function capturePrint(press: () => Promise<void>): Promise<Receipt> {
  await installFetchPrintCapture();
  await press();
  let prints: string[] = [];
  await browser.waitUntil(
    async () => {
      prints = await fetchCapturedPrints();
      return prints.length > 0;
    },
    {
      timeout: Timeouts.LONG,
      interval: 250,
      timeoutMsg: 'Print was pressed but no `mutation print` went out.',
    },
  );
  await P.closeToasts().catch(() => undefined); // "Printer not connected"
  return parseReceipt(prints[0] ?? '');
}

/* ----------------------------------------------------------------------- *
 * "name | $amount" pairs off rendered text (`a | b | c` page dumps)
 * ----------------------------------------------------------------------- */

/**
 * Every `name, $amount` token pair in `dump` between `from` and `to`
 * (exclusive). Staff headings, notes, discount captions are skipped.
 */
export function moneyPairs(dump: string, from: string, to: string | readonly string[]): Line[] {
  const stops = typeof to === 'string' ? [to] : to;
  const tokens = dump.split(' | ').map((t) => t.trim());
  const a = tokens.findIndex((t) => t.startsWith(from));
  const b = tokens.findIndex((t, idx) => idx > a && stops.some((s) => t.startsWith(s)));
  const slice = tokens.slice(a < 0 ? 0 : a + 1, b < 0 ? tokens.length : b);
  const out: Line[] = [];
  for (let k = 1; k < slice.length; k += 1) {
    const amount = slice[k] ?? '';
    const name = slice[k - 1] ?? '';
    if (!MONEY_TOKEN.test(amount) || amount.startsWith('-')) continue;
    if (!name || MONEY_TOKEN.test(name) || /^Staff:|OFF|^Last updated/.test(name)) continue;
    out.push({ name, cents: parseMoney(amount) });
  }
  return out;
}

/** Service lines + Subtotal of the checkout right panel (for the chosen tender). */
export async function checkoutPanel(): Promise<{ services: Line[]; subtotal: number }> {
  const dump = await app.text('main');
  const i = dump.indexOf('Order #');
  const part = i >= 0 ? dump.slice(i) : dump;
  return { services: moneyPairs(part, 'Order #', 'Order Note'), subtotal: moneyAfter(part, 'Subtotal') };
}

/** Menu price on a Home service tile (cents). */
export async function tilePrice(name: string): Promise<number> {
  const m = /\$[\d,]+\.\d{2}/.exec(await P.textOf(CdMain.serviceTile(name)));
  if (!m) throw new Error(`No price on the "${name}" service tile.`);
  return parseMoney(m[0]);
}

export function moneyAfter(dump: string, label: string): number {
  const tokens = dump.split(' | ').map((t) => t.trim());
  const k = tokens.findIndex((t) => t === label);
  const v = k >= 0 ? (tokens[k + 1] ?? '') : '';
  return MONEY_TOKEN.test(v) ? parseMoney(v) : Number.NaN;
}

/** Wait until the checkout panel shows `n` service lines (tender switch re-renders it). */
export async function waitCheckoutLines(n: number): Promise<{ services: Line[]; subtotal: number }> {
  let last = await checkoutPanel();
  await browser
    .waitUntil(
      async () => {
        last = await checkoutPanel();
        return last.services.length >= n && Number.isFinite(last.subtotal);
      },
      { timeout: Timeouts.MEDIUM, interval: 250 },
    )
    .catch(() => undefined);
  return last;
}

/* ----------------------------------------------------------------------- *
 * Order History: newest Card order
 * ----------------------------------------------------------------------- */

/** Order History → Filter Payment Method = Card → open the newest row; returns its code. */
export async function openNewestCardOrder(): Promise<string> {
  await switchToMain();
  await app.go(Routes.ORDER_HISTORY);
  await P.waitFor(CdMain.historySearch, Timeouts.MEDIUM, 'Order History search');
  await P.clickQ(R.historyFilterButton);
  await P.waitFor(R.historyFilterDialog, Timeouts.SHORT, 'Order History filter');
  await P.clickQ(R.historyPaymentSelect);
  await settle(400);
  await P.clickQ(R.historyPaymentOption('Card'));
  await settle(300);
  // Close the option popover by clicking the dialog title (Escape would close the dialog too).
  await P.clickQ(R.historyFilterTitle);
  await settle(300);
  await P.clickQ(R.historyFilterConfirm);
  await settle(2_000);
  if (!(await P.has(CdMain.historyLink))) {
    throw new Error('No Card order in Order History (default 7-day range) — pay one by card first.');
  }
  const code = /OD\d{6}-\d+/.exec(await P.textOf(CdMain.historyLink))?.[0] ?? '';
  await P.clickQ(CdMain.historyLink);
  await P.waitFor(
    [{ css: 'main' }, { hasText: `Order #${code}`, css: 'h1,h2,h3,p,span,div', nth: 0 }],
    Timeouts.MEDIUM,
    `Order #${code}`,
  );
  return code;
}

/** Service lines in the open Order History detail ("Service Details" card). */
export async function historyServiceLines(): Promise<Line[]> {
  return moneyPairs(await app.text('main'), 'Service Details', ['Tip', 'Payment Details', 'Order Note']);
}
