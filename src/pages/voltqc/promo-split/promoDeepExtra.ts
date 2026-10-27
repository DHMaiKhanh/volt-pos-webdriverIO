import { expect } from '@wdio/globals';
import {
  VqcGiftCard,
  btn,
  btnRe,
  inMain,
  type VqcChain,
  type VqcQuery,
} from '../../../constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsHome, VqpsSplit } from '../../../constants/testids.voltqc-promo-split.js';
import { settle } from '../../../helpers/wait.js';
import {
  gcAdd,
  gcBonusOrDiscount,
  gcCustomAmount,
  gcEnterCode,
  gcQuick,
  gcSummary,
} from '../pos/giftCardProbe.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';
import { daysBetween, dayStart, detailIdOf, pv, rangeOffset, type Pair } from '../reports-time/rptDom.js';
import { dailyRows, openDaily, openSummary, summaryDetail } from '../reports-time/rptReports.js';
import { cashTotalOf, priceModel, type PriceModel } from './price.js';
import { setCashierTip } from './promoFlows.js';
import { app, appears, cust, escapeRe, field, money, vqEnv, visible, waitUntil } from './vqApp.js';

/**
 * Extra helpers for the volt-qc PROMO "points" + "deep" ports
 * (tests/regression/volt-qc/promo-split/promo-points.spec.ts, promo-deep.spec.ts).
 *
 * Ported from volt-qc `src/flows/deep-promo-split.ts`, `src/core/points.ts`,
 * `src/flows/rpt.ts` (note / ownDailyRows / pollDailyRow / order day),
 * `src/flows/pay.ts` (editReopenedOrder) and `src/flows/home.ts` (prices).
 * Money in DOLLARS (report readers of this repo return cents → converted here).
 */

/* ------------------------------------------------------------------------- *
 * Misc
 * ------------------------------------------------------------------------- */

/** volt-qc `note()` — a report annotation; here a console line. */
export function note(description: string, type = 'info'): void {
  console.warn(`[${type}] ${description}`);
}

/** Dollars → cents (compare to the cent). */
export const c = (n: number): number => Math.round(n * 100);

/** innerText of the first hit, lines joined with " | " (volt-qc `flat`). */
export async function flat(chain: VqcChain): Promise<string> {
  return ((await P.rawText(chain)) ?? '').replace(/\s*\n+\s*/g, ' | ');
}

/** Poll a predicate; true when it held within `timeout`. */
export async function eventually(
  fn: () => Promise<boolean>,
  timeout = 5_000,
  interval = 250,
): Promise<boolean> {
  return waitUntil(
    async () => {
      try {
        return await fn();
      } catch {
        return false;
      }
    },
    timeout,
    interval,
  );
}

/** Playwright `toBeDisabled()/toBeEnabled()` with auto-wait (returns the final state). */
export async function disabledSoon(chain: VqcChain, want: boolean, timeout = 5_000): Promise<boolean> {
  await eventually(async () => (await P.isDisabled(chain)) === want, timeout);
  return P.isDisabled(chain);
}

/** Playwright `toHaveValue()` with auto-wait (returns the final value). */
export async function valueSoon(chain: VqcChain, want: string, timeout = 5_000): Promise<string> {
  await eventually(async () => (await P.inputValue(chain)) === want, timeout);
  return P.inputValue(chain);
}

/** `process.env[key]` trimmed (volt-qc `proposedEnv`). */
export const proposedEnv = (key: string): string => (process.env[key] ?? '').trim();

/** volt-qc `H.prices`: price model + base price of each service tile. */
export async function prices(
  services: string[] = [vqEnv.testService],
): Promise<{ m: PriceModel; base: Record<string, number> }> {
  const m = await priceModel();
  await app.quickCheckout();
  const base: Record<string, number> = {};
  for (const s of services) base[s] = await app.basePrice(s);
  return { m, base };
}

/* ------------------------------------------------------------------------- *
 * Live point rates (volt-qc src/core/points.ts) — read-only graphql IPC
 * ------------------------------------------------------------------------- */

type PointMethodKey = 'cash' | 'card' | 'gift_card' | 'other';
let live: Partial<Record<PointMethodKey, { enabled: boolean; dollars: number }>> = {};
let readAt = 0;

/** Re-read `merchant_point_payment_config` if the last read is older than `maxAgeMs`. Errors keep the old value. */
export async function refreshPointRates(maxAgeMs = 5 * 60_000): Promise<void> {
  if (Date.now() - readAt < maxAgeMs) return;
  const raw = await P.exec<unknown>(
    `try {
       var q = 'query { sysSettingList(where: { key: { eq: "merchant_point_payment_config" } }) { value } }';
       return window.__TAURI_INTERNALS__.invoke('graphql', { query: q, variables: null, operation: null }).then(function (res) {
         var list = ((res && res.data) || res || {}).sysSettingList;
         return list && list[0] ? list[0].value : null;
       }).catch(function () { return '__ERR__'; });
     } catch (e) { return '__ERR__'; }`,
  ).catch(() => '__ERR__');
  if (raw === '__ERR__') return;
  let stored: Record<string, { enabled?: boolean; point?: number } | undefined> = {};
  try {
    stored = (typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {})) as typeof stored;
  } catch {
    /* keep {} */
  }
  const next: typeof live = {};
  for (const k of ['cash', 'card', 'gift_card', 'other'] as PointMethodKey[]) {
    const m = stored[k] ?? {};
    const centsPerPoint =
      typeof m.point === 'number' && Number.isFinite(m.point) && m.point >= 0 ? m.point : 100;
    next[k] = { enabled: m.enabled !== false, dollars: centsPerPoint / 100 };
  }
  live = next;
  readAt = Date.now();
}

function livePointRate(m: PointMethodKey): number | undefined {
  const e = Number(process.env[`VOLT_POINT_RATE_${m.toUpperCase()}`]);
  if (Number.isFinite(e) && e > 0) return e;
  const v = live[m];
  if (!v) return undefined;
  return v.enabled && v.dollars > 0 ? v.dollars : undefined;
}

/** $ per point (env override → live config → $2 measured 2026-10-09) — volt-qc `POINT_RATE`. */
export const POINT_RATE = {
  get cash(): number {
    return livePointRate('cash') ?? 2;
  },
  get other(): number {
    return livePointRate('other') ?? 2;
  },
};

/* ------------------------------------------------------------------------- *
 * Re-open / split bits
 * ------------------------------------------------------------------------- */

/** Re-open checkout → Edit Order → passcode → /home?editOrderId=… showing #code. */
export async function editReopenedOrder(code: string): Promise<void> {
  await P.clickQ(VqpsCheckout.editOrder);
  await app.passcodeIfAsked(2_000);
  await app.waitPath(/\/home\?editOrderId=/, 15_000);
  await P.waitFor(inMain({ hasText: `#${code}`, css: 'div,span,p,h1,h2,h3', nth: 0 }), 15_000, `#${code}`);
}

/** Close the paid-check dialog (Continue Payment / Done) — volt-qc `dismissCheckPaid`. */
export async function dismissCheckPaid(): Promise<void> {
  await P.clickQ([
    { role: 'dialog', nth: -1 },
    { role: 'button', nameRe: '^(Continue Payment|Done)$', nth: 0 },
  ]);
  await settle(600);
}

export const splitPayButton = VqpsSplit.pay;

/* ------------------------------------------------------------------------- *
 * Pay the open order
 * ------------------------------------------------------------------------- */

/** Big number on Payment Successful ("Payment Successful! | $x") = method amount + tip. */
export const successTotal = (s: string): number => money(/Payment Successful! \| (\$[\d,.]+)/.exec(s)?.[1]);

/**
 * Home order → Pay → method (cashier tip / Other name optional) → Complete → No Tip → Payment Successful.
 * Does NOT press No Receipt. Returns the method amount (button "<method> $x", before tip) + the success text.
 */
export async function payHere(
  id: string,
  method: 'Cash' | 'Other',
  o: { tipCents?: string; otherName?: string } = {},
): Promise<{ amount: number; success: string }> {
  await app.pay();
  const amount = await app.methodAmount(method);
  await app.selectMethod(method);
  if (method === 'Other' && o.otherName) {
    const box = { css: `input[placeholder="${VqpsCheckout.otherNamePlaceholder}"]`, nth: 0 } as const;
    if (await visible(box)) await P.fillQ(box, o.otherName);
  }
  if (o.tipCents) await setCashierTip([...o.tipCents]);
  await app.completePayment({ tip: 'none' });
  const success = await app.successText();
  rememberOrderDay(id);
  return { amount, success };
}

/* ------------------------------------------------------------------------- *
 * Order History
 * ------------------------------------------------------------------------- */

/** Wait for Status == want: refetch each round, re-open the order when it still differs. Returns the last Status. */
export async function waitHistoryStatusHard(
  id: string,
  want: string | RegExp,
  timeout = 120_000,
): Promise<string> {
  const ok = (s: string): boolean => (typeof want === 'string' ? s === want : want.test(s));
  let last = '';
  const good = await waitUntil(
    async () => {
      await app.refetch();
      last = field(await app.historyDetail(id), 'Status');
      if (ok(last)) return true;
      await app.openHistoryOrder(id).catch(() => undefined);
      last = field(await app.historyDetail(id), 'Status');
      return ok(last);
    },
    timeout,
    1_500,
  );
  if (!good) throw new Error(`Order History ${id}: Status never became ${String(want)} (last "${last}")`);
  return last;
}

/** Order History › Cancel Order → toast "Order canceled successfully" → Status Canceled (not stuck on Canceling). */
export async function cancelFromHistory(id: string, timeout = 150_000): Promise<string> {
  await app.openHistoryOrder(id);
  await app.cancelOrder(0);
  const toast = await appears({ textRe: 'Order canceled successfully', nth: 0 }, 20_000);
  expect(toast).toBe(true);
  return waitHistoryStatusHard(id, 'Canceled', timeout);
}

/* ------------------------------------------------------------------------- *
 * Gift card
 * ------------------------------------------------------------------------- */

export interface GcAdjust {
  unit: '%' | '$';
  raw: string;
}

export interface GcSummaryDollars {
  value: number;
  bonus: number;
  totalBalance: number;
  discount: number;
  customerPays: number;
  text: string;
}

const GC = VqcGiftCard.dialog;

/** Gift card line on the order panel for `code` (last 4 digits). */
export async function gcLineCount(code: string): Promise<number> {
  return P.count({ css: 'main div.pr-11', hasTextRe: `Gift Card \\[\\*+-\\*+-${code.slice(-4)}\\]` });
}

/**
 * Sell / top up `code` into an order: `fresh` = Quick Checkout first (gift-card-only order), else the open order.
 * value in $ (25/50/100 use the presets). Returns the order code + the dialog summary (DOLLARS) at Add time.
 */
export async function sellGiftCard(
  code: string,
  o: { value: number; bonus?: GcAdjust; discount?: GcAdjust; fresh?: boolean },
): Promise<{ id: string; summary: GcSummaryDollars }> {
  if (o.fresh) await app.quickCheckout();
  await app.openSellGiftCard();
  await gcEnterCode(code);
  if ([25, 50, 100].includes(o.value)) await P.clickQ(gcQuick(`$${String(o.value)}`));
  else await P.fillQ(gcCustomAmount, String(c(o.value)));
  if (o.bonus) await gcBonusOrDiscount('Bonus', o.bonus.unit, o.bonus.raw);
  if (o.discount) await gcBonusOrDiscount('Discount', o.discount.unit, o.discount.raw);
  const s = await gcSummary();
  const summary: GcSummaryDollars = {
    value: s.value / 100,
    bonus: s.bonus / 100,
    totalBalance: s.totalBalance / 100,
    discount: s.discount / 100,
    customerPays: s.customerPays / 100,
    text: s.text,
  };
  const enabled = !(await disabledSoon(gcAdd, false, 5_000));
  expect(enabled).toBe(true); // Sell Gift Card: Add must be enabled
  await P.clickQ(gcAdd);
  await P.waitGoneQ(GC, 8_000, 'Sell Gift Card');
  const id = await app.orderId();
  app.createdOrders.add(id);
  return { id, summary };
}

/** Status badge + balance read in the Sell Gift Card dialog (saves nothing). The dialog is LEFT OPEN. */
export async function giftCardState(code: string): Promise<{ status: string; balance: number }> {
  await app.quickCheckout();
  await app.openSellGiftCard();
  await gcEnterCode(code);
  const t = await flat(GC);
  const status = /\b(Not Sold Yet|Active|Used Up|Inactive)\b/.exec(t)?.[1] ?? '';
  const balance = money(/Balance: (\$[\d,.]+)/.exec(t)?.[1]);
  return { status, balance };
}

export interface GcHistoryRow {
  order: string;
  amount: string;
  balance: string;
  value: number;
  after: number;
}

/** View Details › Gift card history rows (latest ≤ 5). The Sell Gift Card dialog must be open with the code. */
export async function giftCardHistoryRows(): Promise<GcHistoryRow[]> {
  await P.clickQ([GC, btn('View Details')]);
  const det: VqcQuery = { role: 'dialog', name: 'Gift Card Details', nth: -1 };
  await P.waitFor(det, 10_000, 'Gift Card Details');
  await P.waitFor([det, { css: 'tbody tr', nth: 0 }], 15_000, 'gift card history rows');
  const rows = await P.exec<{ order: string; amount: string; balance: string }[]>(
    `var ds = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"]'), function (d) { return /Gift Card Details/.test(d.textContent || '') && d.getClientRects().length; });
     var d = ds[ds.length - 1]; if (!d) return [];
     return Array.prototype.map.call(d.querySelectorAll('tbody tr'), function (tr) {
       var td = tr.querySelectorAll('td');
       var t = function (i) { return td[i] ? (td[i].textContent || '').trim() : ''; };
       return { order: t(0), amount: t(2), balance: t(3) };
     });`,
  );
  await P.clickQ([det, btn('Close', 0)]).catch(() => P.escape());
  return rows.map((r) => ({
    ...r,
    value: (r.amount.startsWith('-') ? -1 : 1) * money(r.amount.replace(/^[+-]/, '')),
    after: money(r.balance),
  }));
}

/**
 * Base price (cents) of one Quick Pay line so the order's Cash/Other/Gift Card amount is exactly `targetCents`
 * (= base·(1+tax), rounded). Picks the value farthest from the half-cent edge. null when none.
 */
export function baseForCashTotal(m: PriceModel, targetCents: number): number | null {
  const mid = Math.round(targetCents / (1 + m.tax));
  let best: { c: number; gap: number } | null = null;
  for (let d = -5; d <= 5; d += 1) {
    const cb = mid + d;
    if (cb <= 0) continue;
    const exact = cb * (1 + m.tax);
    if (Math.round(cashTotalOf(m, [cb / 100]) * 100) !== targetCents) continue;
    const gap = Math.abs(exact - Math.round(exact));
    if (!best || gap < best.gap) best = { c: cb, gap };
  }
  return best ? best.c : null;
}

/* ------------------------------------------------------------------------- *
 * Report day of an order (volt-qc src/core/order-day.ts + rpt.ts)
 * ------------------------------------------------------------------------- */

export const MERCHANT_TZ = (process.env.VOLT_MERCHANT_TZ ?? '').trim() || 'Asia/Ho_Chi_Minh';
export const POLL_TIMEOUT = Number(process.env.VOLT_REPORT_POLL_SEC ?? 180) * 1000;

const orderDays = new Map<string, string>();

export function merchantYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MERCHANT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function rememberOrderDay(id: string, at = new Date()): void {
  orderDays.set(id, merchantYmd(at));
}

function ymdOffset(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return daysBetween(dayStart(0), new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** Local-calendar offset of the merchant's CURRENT report day. */
export function nowDay(at = new Date()): number {
  return ymdOffset(merchantYmd(at));
}

export function orderDayOffset(id: string): number {
  const d = orderDays.get(id);
  return d ? ymdOffset(d) : nowDay();
}

/* ------------------------------------------------------------------------- *
 * Daily Sale (dollars)
 * ------------------------------------------------------------------------- */

export interface DailyRowUsd {
  order: string;
  sale: number;
  tip: number;
  tax: number;
  total: number;
}

/** Rows of order `id` in Daily Sale of its report day (page re-opened = refetch). */
export async function ownDailyRows(id: string, day: number = orderDayOffset(id)): Promise<DailyRowUsd[]> {
  await openDaily(day);
  const { rows } = await dailyRows();
  return rows
    .filter((r) => r.order.replace(/\s/g, '') === id)
    .map((r) => ({
      order: r.order,
      sale: r.sale / 100,
      tip: r.tip / 100,
      tax: r.tax / 100,
      total: r.total / 100,
    }));
}

/** Poll until the order has (or no longer has) a Daily Sale row. Throws on timeout. */
export async function pollDailyRow(
  id: string,
  present: boolean,
  timeout = POLL_TIMEOUT,
): Promise<DailyRowUsd[]> {
  let last: DailyRowUsd[] = [];
  const ok = await waitUntil(
    async () => {
      last = await ownDailyRows(id).catch(() => []);
      return present ? last.length > 0 : last.length === 0;
    },
    timeout,
    1_000,
  );
  if (!ok)
    throw new Error(
      `Daily Sale: order ${id} ${present ? 'never appeared' : 'still present'} after ${String(timeout / 1000)}s`,
    );
  return last;
}

/* ------------------------------------------------------------------------- *
 * Income Summary (V1) — gift card figures (dollars)
 * ------------------------------------------------------------------------- */

export interface GcReport {
  gcSale: number;
  serviceSale: number;
  productSale: number;
  totalSale: number;
  gcRedemption: number;
  gcRedemptionSale: number;
  totalPayment: number;
  pairs: Pair[];
}

/** Income Summary detail of the CURRENT report day: Sale Details › Total Sale group + Payment Details › Gift Card Redemption. */
export async function incomeSummaryToday(day = nowDay()): Promise<GcReport> {
  const r = rangeOffset(day);
  await openSummary({ ...r, detailId: detailIdOf(r) });
  const pairs = await summaryDetail(false);
  const SD = { section: 'Sale Details' };
  const PD = { section: 'Payment Details' };
  const d = (n: number): number => n / 100;
  return {
    gcSale: d(pv(pairs, 'Gift Card Sale', { ...SD, group: 'Total Sale' })),
    serviceSale: d(pv(pairs, 'Service Sale', { ...SD, group: 'Total Sale' })),
    productSale: d(pv(pairs, 'Product Sale', { ...SD, group: 'Total Sale' })),
    totalSale: d(pv(pairs, 'Total Sale', { ...SD, group: '' })),
    gcRedemption: d(pv(pairs, 'Gift Card Redemption', { ...PD, group: '' })),
    gcRedemptionSale: d(pv(pairs, 'Sale', { ...PD, group: 'Gift Card Redemption' })),
    totalPayment: d(pv(pairs, 'Total Payment', PD)),
    pairs,
  };
}

export const reportDelta = (a: GcReport, b: GcReport): Omit<GcReport, 'pairs'> => ({
  gcSale: b.gcSale - a.gcSale,
  serviceSale: b.serviceSale - a.serviceSale,
  productSale: b.productSale - a.productSale,
  totalSale: b.totalSale - a.totalSale,
  gcRedemption: b.gcRedemption - a.gcRedemption,
  gcRedemptionSale: b.gcRedemptionSale - a.gcRedemptionSale,
  totalPayment: b.totalPayment - a.totalPayment,
});

/* ------------------------------------------------------------------------- *
 * Vietnamese (I18N)
 * ------------------------------------------------------------------------- */

/** VI labels (src/locales/vi/common.json, develop 1.1.32) used by PROMO-D07. */
export const VI = {
  promoRewards: 'Khuyến mãi & Phần thưởng',
  promotions: 'Khuyến mãi',
  customDiscount: 'Giảm giá tuỳ chỉnh',
  percentageTab: 'Phần trăm %',
  amountTab: 'Số tiền $',
  orderPromoSetting: 'Thiết lập chia giảm giá khuyến mãi',
  percentOwner: 'Phần trăm cho chủ',
  percentStaff: 'Phần trăm cho nhân viên',
  rewards: 'Phần thưởng',
  noRewards: 'Không có phần thưởng',
  apply: 'Áp dụng',
  store: 'Cửa hàng',
  giftCard: 'Thẻ quà tặng',
  cannotUseGiftCard: 'Không thể dùng thẻ quà tặng để mua thẻ quà tặng. Hãy chọn phương thức thanh toán khác.',
  completePayment: 'Hoàn tất thanh toán',
  inputGiftCardCode: 'Nhập mã thẻ quà tặng',
  confirm: 'Xác nhận',
  cancel: 'Huỷ',
  notEnoughBalance: 'Thẻ quà tặng không đủ số dư',
  redeemQuestion: 'Dùng số dư hiện tại và thêm thanh toán đơn mới cho phần còn lại?',
  redeemAddNewCheck: 'Dùng số dư & Thêm thanh toán đơn mới',
} as const;

/** Assert none of the English `words` remain (\b only where the word starts/ends with a word char). */
export function expectNoEnglish(text: string, words: (string | RegExp)[], where: string): void {
  const wordRe = (w: string): RegExp =>
    new RegExp(`${/^\w/.test(w) ? '\\b' : ''}${escapeRe(w)}${/\w$/.test(w) ? '\\b' : ''}`);
  for (const w of words) {
    const re = typeof w === 'string' ? wordRe(w) : w;
    if (re.test(text)) console.warn(`${where}: English "${String(w)}" still shown`);
    expect(text).not.toMatch(re);
  }
}

/** Open pending order `id` in any language (sidebar found by role, not label). */
export async function openPendingAnyLang(id: string): Promise<void> {
  await app.go('/home', { passcode: false });
  const box: readonly VqcQuery[] = [
    { role: 'complementary', nth: 0 },
    { role: 'textbox', nth: 0 },
  ];
  await P.fillQ(box, id);
  await P.clickQ(
    [
      { role: 'complementary', nth: 0 },
      { role: 'button', nameRe: `^${escapeRe(id)}`, nth: 0 },
    ],
    10_000,
  );
  await P.waitFor(inMain({ textRe: `#${escapeRe(id)}`, nth: 0 }), 15_000, `#${id}`);
  await P.fillQ(box, '').catch(() => undefined);
}

/** Home → Pay / Thanh toán → checkout. */
export async function payAnyLang(): Promise<void> {
  await P.clickQ(btnRe('^(Pay|Thanh toán)$', 0));
  await app.waitPath(/\/checkout/, 15_000);
}

/** Checkout method button by any-language label ("Thẻ quà tặng $33.00"). */
export const methodButtonByLabel = (label: string): readonly VqcQuery[] =>
  inMain({ role: 'button', nameRe: `^${escapeRe(label)} \\$`, nth: 0 });

/** Wait until `until()`; answer the passcode (EN/VI) and pick No Tip on the customer display when asked. */
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

/**
 * Stamp the element of `role` that sits beside a leaf label `label` (label's parent, up to 4 levels)
 * inside the last dialog containing `dialogText`. Returns a chain to it (volt-qc `getByText(label).locator('xpath=..').getByRole(role)`).
 */
export async function besideLabel(
  dialogText: string,
  label: string,
  css: string,
  attr: string,
): Promise<readonly VqcQuery[]> {
  await P.exec<boolean>(
    `var dt = arguments[0], label = arguments[1], css = arguments[2], attr = arguments[3];
     var prev = document.querySelectorAll('[' + attr + ']');
     for (var j = 0; j < prev.length; j++) prev[j].removeAttribute(attr);
     var dlgs = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"]'), function (d) { return (d.textContent || '').indexOf(dt) >= 0 && d.getClientRects().length; });
     var dlg = dlgs[dlgs.length - 1]; if (!dlg) return false;
     var lab = Array.prototype.find.call(dlg.querySelectorAll('*'), function (e) { return e.children.length === 0 && (e.textContent || '').trim() === label; });
     var host = lab ? lab.parentElement : null, hit = null;
     for (var i = 0; i < 4 && host && !hit; i++) { hit = host.querySelector(css); host = host.parentElement; }
     if (hit) hit.setAttribute(attr, '1');
     return !!hit;`,
    dialogText,
    label,
    css,
    attr,
  );
  return [{ css: `[${attr}="1"]`, nth: 0 }];
}

/** Home order panel: is the customer field locked (Re-Open: pointer-events-none)? */
export async function customerFieldLocked(): Promise<boolean> {
  const cls =
    (await P.attrOf(inMain({ text: VqpsHome.customerPlaceholder, nth: 0 }), 'class').catch(() => null)) ?? '';
  return /pointer-events-none/.test(cls);
}
