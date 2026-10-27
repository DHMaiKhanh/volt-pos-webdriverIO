import { expect } from '@wdio/globals';
import { btn, btnRe, inMain, type VqcChain, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { CdCustomer, TILE_OF } from '../../../constants/testids.voltqc-cd-e2e.js';
import {
  VqpsCustomer,
  VqpsHome,
  VqpsSplit,
  VqpsSuccess,
} from '../../../constants/testids.voltqc-promo-split.js';
import { settle } from '../../../helpers/wait.js';
import { withCustomerWindow } from '../../../helpers/window.js';
import { MERCHANT_TIME_ZONE } from '../../../utils/date.js';
import customerDisplayPage from '../../pos/CustomerDisplayPage.js';
import { appShellProbe } from '../app-perm/AppShellProbe.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';
import { rangeOffset } from '../reports-time/rptDom.js';
import { dailyRows, openDaily, staffIncomeDetailFor } from '../reports-time/rptReports.js';
import { basePrice, priceModel, type PriceModel } from './price.js';
import * as S from './splitFlows.js';
import {
  app,
  appears,
  clickFound,
  clickOrJs,
  cust,
  escapeRe,
  money,
  usd,
  visible,
  vqEnv,
  waitUntil,
} from './vqApp.js';

/**
 * Extra helpers for the volt-qc 05 SPLIT "deep" + "card" ports
 * (`tests/regression/volt-qc/promo-split/split-deep.spec.ts`, `split-card.spec.ts`).
 *
 * Port of what those specs need from volt-qc `e2e/src/flows/deep-promo-split.ts`,
 * `card.ts`, `tipping.ts`, `home.ts`, `order-history.ts`, `rpt.ts` that the shared
 * promo-split library does not already have. Money in DOLLARS (volt-qc style);
 * report readers of the WDIO reports-time port return CENTS and are converted here.
 */

/* ------------------------------------------------------------------------- *
 * Numbers / text
 * ------------------------------------------------------------------------- */

/** Dollars → integer cents (compare to the cent). */
export const c = (n: number): number => Math.round(n * 100);
export const sum2 = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
/** Regex source for one "$x.yy" amount. */
export const reUsd = (n: number): string => escapeRe(usd(n));
/** innerText of the first hit, lines joined with " | " (volt-qc `flat`). */
export async function flat(chain: VqcChain): Promise<string> {
  return ((await P.rawText(chain).catch(() => null)) ?? '').replace(/\s*\n+\s*/g, ' | ');
}
/** Big amount on Payment Successful ("Payment Successful! | $x"). */
export const successTotal = (s: string): number => money(/Payment Successful! \| (\$[\d,.]+)/.exec(s)?.[1]);
/** "<staff> - $x" on the success page / Order History. NaN when absent. */
export const staffTip = (text: string, staff: string): number =>
  money(new RegExp(`${escapeRe(staff)} - (\\$[\\d,.]+)`).exec(text)?.[1]);

/** volt-qc `note()` — an observation that never fails the test. */
export function note(description: string, type = 'info'): void {
  console.warn(`[volt-qc ${type}] ${description}`);
}

/** Poll `fn` until true; false on timeout (volt-qc `expect.poll(...).toBe(true)` without throwing). */
export async function pollTrue(
  fn: () => Promise<boolean>,
  timeout: number,
  interval = 1_000,
): Promise<boolean> {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await fn().catch(() => false)) return true;
    if (Date.now() >= deadline) return false;
    await settle(interval);
  }
}

/* ------------------------------------------------------------------------- *
 * Home
 * ------------------------------------------------------------------------- */

/** volt-qc `H.prices`: price model + tile base price of each service (Home must show the grid). */
export async function prices(
  services: string[] = [vqEnv.testService],
): Promise<{ m: PriceModel; base: Record<string, number> }> {
  const m = await priceModel();
  await app.quickCheckout();
  const base: Record<string, number> = {};
  for (const s of services) base[s] = await basePrice(s);
  return { m, base };
}

/** Staff blocks of the open order ("Change Staff" button's parent, label stripped). */
export async function orderStaffNames(): Promise<string[]> {
  return P.exec<string[]>(
    `return Array.prototype.filter.call(document.querySelectorAll('main button'), function (b) {
       return (b.textContent || '').trim() === 'Change Staff' && b.getClientRects().length;
     }).map(function (b) { return String((b.parentElement && b.parentElement.innerText) || '').replace('Change Staff', '').trim(); });`,
  );
}

/** Add `name` again when the line did not show within 3 s (second staff block sometimes swallows the first tap). */
export async function ensureServiceLine(name: string): Promise<void> {
  if (!(await waitUntil(async () => (await app.itemRowCount(name)) > 0, 3_000))) await app.addService(name);
}

/** Open order on Home → Pay → Other → Complete → (customer Custom Tip cents | No Tip) → success text. */
export async function payOtherWithTip(tipCents?: string): Promise<string> {
  await app.pay();
  await app.selectMethod('Other');
  await P.clickQ(btn('Complete Payment', 0));
  const deadline = Date.now() + 45_000;
  let tipped = false;
  while (Date.now() < deadline) {
    if (/payment-success/.test(await app.path())) break;
    if (await app.passcodeVisible()) {
      await app.enterPasscode(vqEnv.staffCode);
      continue;
    }
    if (!tipped && (await cust.tipShown())) {
      if (tipCents) await cust.customTip(tipCents);
      else await cust.tip('none');
      tipped = true;
      continue;
    }
    await settle(150);
  }
  return app.successText();
}

/* ------------------------------------------------------------------------- *
 * Split screen
 * ------------------------------------------------------------------------- */

export const addCheckButton = VqpsSplit.addCheck;
export const selectCheckButton = (id: string, n: number): readonly VqcQuery[] => VqpsSplit.select(id, n);

/** Item labels inside a By Items check card. */
export async function itemsOfCheck(id: string, n: number): Promise<string[]> {
  return P.exec<string[]>(
    `var a = document.querySelector('main [aria-label="Select #' + arguments[0] + '-' + arguments[1] + '"], main [aria-label="Check Successful #' + arguments[0] + '-' + arguments[1] + '"]');
     var b = a ? (a.closest('div.rounded-lg') || a.parentElement) : null;
     if (!b) return [];
     return Array.prototype.map.call(b.querySelectorAll('label'), function (l) { return String(l.innerText || l.textContent || '').replace(/\\s+/g, ' ').trim(); });`,
    id,
    n,
  );
}

/** Pay the selected check (method + tip already set) up to "Check N Paid Successfully" (dialog left open). */
export async function payCurrentCheck(
  n: number,
  method: S.CheckMethod,
  o: S.PayCheckOpts = {},
): Promise<string> {
  await clickOrJs(S.payButton, 3_000);
  return S.drivePaid(n, method, o);
}

/** "Pay $x" button text (volt-qc `payButton.innerText()`). */
export async function payButtonText(): Promise<string> {
  return P.textOf(S.payButton);
}

export async function payAmount(): Promise<number> {
  return Number((await payButtonText()).replace(/[^\d.]/g, ''));
}

export async function payDisabled(): Promise<boolean> {
  return P.isDisabled(S.payButton).catch(() => true);
}

/* ------------------------------------------------------------------------- *
 * Order History receipts
 * ------------------------------------------------------------------------- */

async function readReceiptDialog(dlg: VqcQuery): Promise<string> {
  await P.waitFor(dlg, 10_000, 'receipt dialog');
  await P.waitFor([dlg, { textRe: 'Paid with', nth: 0 }], 15_000, 'receipt "Paid with"');
  const t = await flat(dlg);
  await P.clickQ([dlg, btn('Close', 0)], 3_000).catch(() => P.escape());
  if (!(await waitUntil(async () => !(await visible(dlg)), 5_000))) await app.closeStrayDialogs();
  return t;
}

/** Order History › Receipt → "Receipt Details" text (" | "-joined). */
export async function historyReceiptText(): Promise<string> {
  await clickOrJs(inMain(btn('Receipt', 0)));
  return readReceiptDialog({ role: 'dialog', hasText: 'Receipt Details', nth: -1 });
}

/** Order History › Payment Details › "View receipt for check N" → "Receipt #<id>-N". */
export async function checkReceiptText(id: string, n: number): Promise<string> {
  await clickOrJs(inMain(btn(`View receipt for check ${String(n)}`, 0)));
  return readReceiptDialog({ role: 'dialog', hasText: `Receipt #${id}-${String(n)}`, nth: -1 });
}

/* ------------------------------------------------------------------------- *
 * Reports (Daily Sale / Staff Income) — merchant report day
 * ------------------------------------------------------------------------- */

export const POLL_TIMEOUT = Number(process.env.VOLT_REPORT_POLL_SEC ?? 180) * 1000;

const orderDays = new Map<string, string>();

function merchantYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MERCHANT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function ymdOffset(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime() - today.getTime()) / 86_400_000);
}

/** Record the report day of an order at payment time. */
export function rememberOrderDay(id: string, at = new Date()): void {
  orderDays.set(id, merchantYmd(at));
}

/** Machine-calendar offset of the order's report day (today's report day when not recorded). */
export function orderDayOffset(id: string): number {
  return ymdOffset(orderDays.get(id) ?? merchantYmd());
}

export interface DailyRowUsd {
  order: string;
  sale: number;
  tip: number;
  tax: number;
  total: number;
}

/** Daily Sale rows of order `id` on its report day (dollars). */
export async function ownDailyRows(id: string): Promise<DailyRowUsd[]> {
  await openDaily(orderDayOffset(id));
  const { rows } = await dailyRows();
  return rows
    .filter((r) => r.order.replace(/\s/g, '').replace(/^#/, '') === id)
    .map((r) => ({
      order: r.order,
      sale: r.sale / 100,
      tip: r.tip / 100,
      tax: r.tax / 100,
      total: r.total / 100,
    }));
}

/** Poll until the order has (or no longer has) a Daily Sale row; throws on timeout. */
export async function pollDailyRow(
  id: string,
  present: boolean,
  timeout = POLL_TIMEOUT,
  check?: (rows: DailyRowUsd[]) => boolean,
): Promise<DailyRowUsd[]> {
  let last: DailyRowUsd[] = [];
  const ok = await pollTrue(
    async () => {
      last = await ownDailyRows(id);
      if (!present) return last.length === 0;
      return last.length > 0 && (!check || check(last));
    },
    timeout,
    1_000,
  );
  if (!ok)
    throw new Error(
      `Daily Sale: order ${id} ${present ? 'missing / not yet right' : 'still listed'} after ${String(timeout / 1000)}s (${JSON.stringify(last)})`,
    );
  return last;
}

/** Staff Income detail rows (non-refund) of order `id` for `staff` on the order's report day; tip/sale in dollars. */
export async function staffIncomeOrderRows(
  staff: string,
  id: string,
): Promise<{ tip: number; sale: number }[]> {
  const r = await staffIncomeDetailFor(staff, rangeOffset(orderDayOffset(id)));
  if (!r) return [];
  return r.detail.rows
    .filter((x) => x.order.replace(/^#/, '') === id && !x.refund)
    .map((x) => ({ tip: x.tip / 100, sale: x.sale / 100 }));
}

/* ------------------------------------------------------------------------- *
 * Settings › Payment & Transaction › Split Tip Setting
 * ------------------------------------------------------------------------- */

export type SplitTipMode = 'evenly' | 'proportion';

const splitTipRadio = (mode: SplitTipMode): VqcQuery => ({ css: `[id="split-tip-${mode}"]`, nth: 0 });

async function radioOn(q: VqcQuery): Promise<boolean> {
  const i = await P.info(q);
  return !!i && (i.attrs['aria-checked'] === 'true' || i.attrs['data-state'] === 'checked');
}

async function openPaymentTransaction(): Promise<void> {
  await app.go('/settings/payment-transaction');
  await P.waitFor(splitTipRadio('evenly'), 15_000, '#split-tip-evenly');
}

/** Current Split Tip Setting ('' when unreadable). */
export async function readSplitTipMode(): Promise<SplitTipMode | ''> {
  await openPaymentTransaction();
  if (await radioOn(splitTipRadio('evenly'))) return 'evenly';
  if (await radioOn(splitTipRadio('proportion'))) return 'proportion';
  return '';
}

/** Set the Split Tip Setting and press the card's own Save. true = saved (toast seen), false = already that value. */
export async function setSplitTipSetting(mode: SplitTipMode): Promise<boolean> {
  await openPaymentTransaction();
  const radio = splitTipRadio(mode);
  if (await radioOn(radio)) return false;
  await P.clickQ(radio);
  const ok = await clickFound(
    `var r = document.getElementById('split-tip-' + arguments[0]);
     for (var host = r; host; host = host.parentElement) {
       var b = Array.prototype.find.call(host.querySelectorAll('button'), function (x) { return (x.textContent || '').trim() === 'Save'; });
       if (b) return b;
     }
     return null;`,
    mode,
  );
  if (!ok) throw new Error('Split Tip Setting: no Save button near the radio group');
  await app.passcodeIfAsked(1_500);
  await P.waitFor(
    { textRe: 'Split tip setting updated', nth: 0 },
    15_000,
    'toast "Split tip setting updated"',
  );
  if (!(await waitUntil(() => radioOn(radio), 10_000)))
    throw new Error(`Split Tip Setting never showed ${mode} after Save`);
  return true;
}

/** Selected tab of the Split Tip dialog ("Split Evenly" | "Proportion" | "Manual"). */
export async function selectedSplitTipTab(): Promise<string> {
  const tabs = await P.infos([S.splitTipDialog, { role: 'tab' }]);
  return (
    tabs.find((t) => t.attrs['aria-selected'] === 'true' || t.attrs['data-state'] === 'active')?.text ?? ''
  ).trim();
}

export const splitTipTab = (name: string): readonly VqcQuery[] => [S.splitTipDialog, { role: 'tab', name }];
export const splitTipButton = (name: string): readonly VqcQuery[] => [S.splitTipDialog, btn(name, 0)];
export const tipInput = (i: number): readonly VqcQuery[] => [
  S.splitTipDialog,
  { css: 'input[placeholder="0.00"]', nth: i },
];

/* ------------------------------------------------------------------------- *
 * Vietnamese (I18N)
 * ------------------------------------------------------------------------- */

/** VI labels (src/locales/vi/common.json, develop 1.1.32). */
export const VI = {
  pay: 'Thanh toán',
  cash: 'Tiền mặt',
  other: 'Khác',
  confirm: 'Xác nhận',
  equally: 'Chia đều',
  byAmount: 'Theo số tiền',
  byItems: 'Theo món',
  addNewCheck: 'Thêm thanh toán đơn mới',
  chooseCheck: 'Chọn thanh toán đơn để trả',
  choosePaymentMethod: 'Chọn phương thức thanh toán',
  check: (n: number): string => `Thanh toán đơn ${String(n)}`,
  completeCheck: (n: number): string => `Hoàn tất Thanh toán đơn ${String(n)}`,
  checkPaidTitle: (n: number): string => `Thanh toán đơn ${String(n)} thành công`,
  checksRemaining: (count: number): string => `Còn ${String(count)} thanh toán đơn - tổng`,
  allChecksPaid: 'Đã hoàn tất tất cả thanh toán đơn',
  continuePayment: 'Tiếp tục thanh toán',
  done: 'Hoàn tất',
  completeDone: 'Hoàn tất - Xong',
  paidWith: 'Thanh toán bằng',
  paidBy: (method: string): string => `Trả bằng ${method}`,
  otherPayment: 'Thanh toán khác',
  inputPaymentMethodName: 'Nhập tên phương thức thanh toán',
  paymentSuccessful: 'Thanh toán thành công!',
  splitTip: 'Chia tiền boa',
  totalTip: 'Tổng tiền boa',
  splitEvenly: 'Chia đều',
  proportion: 'Theo tỉ lệ',
  manual: 'Thủ công',
  noReceipt: 'Không hoá đơn',
} as const;

/** `text` contains none of the English `words` (\b only where the word starts/ends with a word char). */
export function expectNoEnglish(text: string, words: (string | RegExp)[], where: string): void {
  const wordRe = (w: string): RegExp =>
    new RegExp(`${/^\w/.test(w) ? '\\b' : ''}${escapeRe(w)}${/\w$/.test(w) ? '\\b' : ''}`);
  for (const w of words) {
    const re = typeof w === 'string' ? wordRe(w) : w;
    if (re.test(text)) console.warn(`${where}: English "${String(w)}" still shown`);
    expect(text).not.toMatch(re);
  }
}

/** Open pending order `id` in any language (sidebar by role, not label). */
export async function openPendingAnyLang(id: string): Promise<void> {
  await app.go('/home', { passcode: false });
  const side: VqcQuery = { role: 'complementary', nth: 0 };
  const box: readonly VqcQuery[] = [side, { role: 'textbox', nth: 0 }];
  await P.fillQ(box, id);
  await P.clickQ([side, { role: 'button', nameRe: `^${escapeRe(id)}`, nth: 0 }], 10_000);
  await P.waitFor(inMain({ textRe: `#${escapeRe(id)}`, nth: 0 }), 15_000, `#${id}`);
  await P.fillQ(box, '').catch(() => undefined);
}

/** Wait until `until()`; answer the passcode guard (EN/VI) and the customer tip (No Tip or Custom Tip cents). */
export async function driveUntil(
  until: () => Promise<boolean>,
  o: { customerTipCents?: string; timeoutMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + (o.timeoutMs ?? 45_000);
  let tipped = false;
  while (Date.now() < deadline) {
    if (await until()) return;
    if (await app.passcodeVisible()) {
      await app.enterPasscode(vqEnv.staffCode).catch(() => undefined);
      continue;
    }
    if (!tipped && (await cust.tipShown())) {
      if (o.customerTipCents) await cust.customTip(o.customerTipCents);
      else await cust.tip('none');
      tipped = true;
      continue;
    }
    await settle(250);
  }
  throw new Error(`driveUntil timed out (URL ${await app.url()})`);
}

const SPLIT_PAY_RE = '^(Pay|Thanh toán)\\s*\\$[\\d,.]+$';
const PAID_TITLE_RE = '^(Check \\d+ Paid Successfully|Thanh toán đơn \\d+ thành công)$';
const PAID_NEXT_RE = '^(Continue Payment|Done|Tiếp tục thanh toán|Hoàn tất)$';

/** Finish a half-paid split in ANY language: remaining checks with Other → Complete Done → No Receipt. */
export async function settleSplitAnyLang(id: string): Promise<void> {
  if (!/split-order/.test(await app.url())) return;
  for (let i = 0; i < 4; i += 1) {
    if (!(await P.count({ role: 'dialog' }).catch(() => 0))) break;
    const b = [
      { role: 'dialog', nth: -1 },
      {
        role: 'button',
        nameRe:
          '^(Continue Payment|Done|Close|Keep|Cancel|Select Another Method|Tiếp tục thanh toán|Hoàn tất|Đóng|Huỷ|Chọn phương thức khác)$',
        nth: 0,
      },
    ] as const;
    if (await visible(b)) await P.clickQ(b).catch(() => undefined);
    else await P.escape();
    await settle(250);
  }
  if (!(await P.count(inMain({ css: `[aria-label^="Check Successful #${id}-"]` })))) return;
  const paid: VqcQuery = { role: 'dialog', nameRe: PAID_TITLE_RE, nth: -1 };
  for (let i = 0; i < 6; i += 1) {
    const left = await S.unpaidChecks(id);
    const first = left[0];
    if (first === undefined) break;
    await S.selectCheck(id, first);
    await clickOrJs(inMain(btnRe('^(Other|Khác)$', 0)));
    await clickOrJs(inMain(btnRe(SPLIT_PAY_RE, 0)));
    let otherDone = false;
    const other: VqcQuery = {
      role: 'dialog',
      hasCss:
        'input[placeholder="Input payment method name"], input[placeholder="Nhập tên phương thức thanh toán"]',
      nth: -1,
    };
    await driveUntil(async () => {
      if (await visible(paid)) return true;
      if (!otherDone && (await visible(other))) {
        await P.fillQ([other, { role: 'textbox', nth: 0 }], 'E2E cleanup');
        await P.clickQ([other, btnRe(SPLIT_PAY_RE, 0)]);
        otherDone = true;
      }
      return false;
    });
    await P.clickQ([paid, btnRe(PAID_NEXT_RE, 0)]);
    await P.waitGoneQ(paid, 8_000);
  }
  await clickOrJs(inMain(btnRe('^(Complete Done|Hoàn tất - Xong)$', 0)));
  await driveUntil(async () => /payment-success/.test(await app.path()));
  await P.clickQ(btnRe('^(No Receipt|Không hoá đơn)$', 0));
  await waitUntil(async () => !/payment-success/.test(await app.path()), 15_000, 150);
  app.createdOrders.delete(id);
}

/* ------------------------------------------------------------------------- *
 * Card (Bamboo Dot) — port of volt-qc card.ts (no IPC interceptor / net proxy)
 * ------------------------------------------------------------------------- */

const CARD_DIALOG_RE =
  'Getting ready to charge|Waiting for connect device|Processing Payment|Payment Successful!|Payment failed!|Transaction timeout!|already paid successfully|Customer is adding signature';

/** The card-progress dialog on the main window (accessible name hidden → by content). */
export const cardDialog: VqcQuery = { role: 'dialog', hasTextRe: CARD_DIALOG_RE, nth: -1 };

let terminalCache: { ok: boolean; at: number } | null = null;

/** Header Devices popover text ("Devices | Terminal | Connected | Printer | …"). */
export async function devicesText(): Promise<string> {
  await app.go('/home', { passcode: false });
  await appShellProbe.clickDevices();
  const pop: VqcQuery = { css: '[data-radix-popper-content-wrapper]', hasText: 'Terminal', nth: -1 };
  await appears(pop, 5_000);
  const t = await flat(pop);
  await P.escape();
  return t;
}

/** Header Devices reports "Terminal | Connected" (cached 5 min unless `fresh`). */
export async function terminalConnected(opts: { fresh?: boolean } = {}): Promise<boolean> {
  if (!opts.fresh && terminalCache && Date.now() - terminalCache.at < 5 * 60_000) return terminalCache.ok;
  const ok = /Terminal \| Connected/.test(await devicesText().catch(() => ''));
  terminalCache = { ok, at: Date.now() };
  return ok;
}

export interface CardTrace {
  main: string[];
  customer: string[];
}

/**
 * In-page MutationObserver that records every card-dialog (main) / body
 * (customer) text change into `window.__e2eCard`, so a short state such as
 * "Processing Payment" is never missed between two polls.
 */
const OBSERVE = `
  var kind = arguments[0], reset = arguments[1], src = arguments[2];
  var w = window;
  if (w.__e2eCard && !reset) return null;
  if (w.__e2eCard) w.__e2eCard.obs.disconnect();
  var re = new RegExp(src);
  var clean = function (t) { return String(t || '').replace(/\\s*\\n+\\s*/g, ' | '); };
  var st = { states: [], now: '', pending: false, obs: null, snap: null };
  st.snap = function () {
    st.pending = false;
    var t = '';
    if (kind === 'dialog') {
      var d = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"],[role="alertdialog"]'), function (x) { return x.getClientRects().length && re.test(x.textContent || ''); });
      t = d.length ? clean(d[d.length - 1].innerText) : '';
    } else t = clean(document.body.innerText).slice(0, 400);
    st.now = t;
    if (t && t !== st.states[st.states.length - 1]) { st.states.push(t); if (st.states.length > 200) st.states.shift(); }
  };
  st.obs = new MutationObserver(function () { if (!st.pending) { st.pending = true; setTimeout(st.snap, 50); } });
  st.obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-state', 'hidden', 'style'] });
  w.__e2eCard = st;
  st.snap();
  return null;`;

const DRAIN = `
  var st = window.__e2eCard;
  if (!st) return null;
  st.snap();
  var s = st.states; st.states = [];
  return { states: s, now: st.now };`;

async function observe(kind: 'dialog' | 'body', reset: boolean): Promise<void> {
  const run = (): Promise<null> => P.exec<null>(OBSERVE, kind, reset, CARD_DIALOG_RE);
  if (kind === 'dialog') await run().catch(() => undefined);
  else await withCustomerWindow(run).catch(() => undefined);
}

async function drain(kind: 'dialog' | 'body', arr: string[]): Promise<string> {
  const run = (): Promise<{ states: string[]; now: string } | null> =>
    P.exec<{ states: string[]; now: string } | null>(DRAIN);
  let o = await (kind === 'dialog' ? run() : withCustomerWindow(run)).catch(() => null);
  if (!o) {
    await observe(kind, false);
    o = { states: [], now: kind === 'dialog' ? await flat(cardDialog) : (await cust.text()).slice(0, 400) };
  }
  for (const t of [...o.states, o.now]) if (t && t !== arr[arr.length - 1]) arr.push(t);
  return o.now;
}

/**
 * Follow the card dialog (main) + customer screen until `until` holds,
 * answering passcode / customer tip (No Tip) and signing when asked.
 */
export async function watchCard(
  until: (s: { main: string; customer: string; url: string }) => boolean | Promise<boolean>,
  opts: { timeoutMs?: number; sign?: boolean; trace?: CardTrace; reset?: boolean } = {},
): Promise<CardTrace> {
  const trace = opts.trace ?? { main: [], customer: [] };
  const deadline = Date.now() + (opts.timeoutMs ?? 150_000);
  let signed = false;
  let tipped = false;
  let failedSince = 0;
  await observe('dialog', opts.reset ?? false);
  await observe('body', opts.reset ?? false);
  while (Date.now() < deadline) {
    const main = await drain('dialog', trace.main);
    const customer = await drain('body', trace.customer);
    const url = await app.url();
    if (await until({ main, customer, url })) return trace;
    if (/Payment failed!/.test(main)) {
      failedSince ||= Date.now();
      if (Date.now() - failedSince > 20_000) throw new Error(`Card says "Payment failed!": "${main}"`);
    } else failedSince = 0;
    if (await app.passcodeVisible()) {
      await app.enterPasscode(vqEnv.staffCode).catch(() => undefined);
      continue;
    }
    if (!tipped && /Add a tip/.test(customer) && !/Sign here/.test(customer)) {
      await cust.tip('none').catch(() => undefined);
      tipped = true;
      continue;
    }
    if (opts.sign !== false && !signed && /Add Signature|Sign here/.test(customer)) {
      await signOnCustomer().catch(() => undefined);
      signed = true;
      continue;
    }
    await settle(150);
  }
  throw new Error(
    `watchCard timed out. Main: ${trace.main.slice(-4).join(' ⟶ ')} | Customer: ${trace.customer.slice(-3).join(' ⟶ ')}`,
  );
}

/** Sign on the customer pad, then Continue. */
export async function signOnCustomer(): Promise<void> {
  await customerDisplayPage.sign();
  await cust.click(VqpsCustomer.cont);
}

/** After a card test: sign a pending signature, OK an "already paid" box, close a leftover card dialog. */
export async function settleCardDialog(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    if (await cust.has({ textRe: 'Sign here', nth: 0 })) {
      await signOnCustomer().catch(() => undefined);
      await settle(1_500);
      continue;
    }
    if (!(await visible(cardDialog))) return;
    const ok = [cardDialog, btn('OK')] as const;
    if (await visible(ok)) await P.clickQ(ok).catch(() => undefined);
    else await P.clickQ([cardDialog, btn('Close', 0)], 2_000).catch(() => undefined);
    await settle(1_500);
  }
}

export interface CardPayment {
  brand: string;
  last4: string;
  kind: string;
  amount: number;
  tip: number;
  auth: string;
  status: string;
  raw: string;
}

/** "Payment Details" … "Order Note" segment of an Order History detail. */
export function paymentDetails(detail: string): string {
  const i = detail.indexOf('Payment Details');
  if (i < 0) return '';
  const j = detail.indexOf('Order Note', i);
  return detail.slice(i, j > i ? j : undefined);
}

/** Card transactions of a Payment Details text (volt-qc `cardPayments`). */
export function cardPayments(pd: string): CardPayment[] {
  const parts = pd.split(' | ').map((s) => s.trim());
  const out: CardPayment[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const isVoidRow =
      parts[i] === '-' &&
      /^\d{2}\/\d{2}\/\d{4}/.test(parts[i + 1] ?? '') &&
      / - (Credit|Debit)|^Amount: \$/.test(parts[i + 2] ?? '');
    if (parts[i] !== 'Card -' && !isVoidRow) continue;
    let j = i + 1;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(parts[j] ?? '')) j += 1;
    const desc = parts[j] ?? '';
    const m = /^(?:(.+?) (\d{4}) - (Credit|Debit)?:? ?|Amount: )(\$[\d,.]+)(?: \+ Tip: (\$[\d,.]+))?$/.exec(
      desc,
    );
    if (!m) throw new Error(`Unreadable card row in Payment Details: "${parts.slice(i, i + 6).join(' | ')}"`);
    j += 1;
    const auth = /^Auth Code: (\S+)$/.exec(parts[j] ?? '')?.[1] ?? '';
    if (auth) j += 1;
    out.push({
      brand: m[1] ?? '',
      last4: m[2] ?? '',
      kind: m[3] ?? '',
      amount: money(m[4]),
      tip: m[5] ? money(m[5]) : 0,
      auth,
      status: parts[j] ?? '',
      raw: parts.slice(i, j + 2).join(' | '),
    });
  }
  return out;
}

export const successfulCards = (pd: string): CardPayment[] =>
  cardPayments(pd).filter((x) => x.status === 'Successful');

/** Is the customer-display tile of `m` highlighted (class bg-primary-500) within `timeout`? */
export async function customerTileLit(
  m: 'Card' | 'Cash' | 'Other' | 'Gift Card',
  timeout = 10_000,
): Promise<boolean> {
  return waitUntil(
    async () =>
      /(^|\s)bg-primary-500(\s|$)/.test(
        (await withCustomerWindow(() => P.attrOf(CdCustomer.tile(TILE_OF[m]), 'class')).catch(() => null)) ??
          '',
      ),
    timeout,
    300,
  );
}

/** Main-window dialogs used by the card specs. */
export const waitingDialog: VqcQuery = { role: 'dialog', hasTextRe: 'Customer is adding', nth: -1 };
export const signatureWaitDialog: VqcQuery = {
  role: 'dialog',
  hasTextRe: 'Payment Successful! Customer is adding signature\\.',
  nth: -1,
};

export { VqpsHome, VqpsSuccess };
