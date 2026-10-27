import { btn, inMain, type VqcChain, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsHome, VqpsPromo } from '../../../constants/testids.voltqc-promo-split.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';
import {
  app,
  appears,
  clickFound,
  clickOrJs,
  cents,
  cust,
  customCheckboxChain,
  field,
  isCheckedChain,
  money,
  pick,
  r2,
  vqEnv,
  visible,
  waitUntil,
  type PayMethod,
} from './vqApp.js';

/**
 * Port of volt-qc `src/flows/pay.ts` + `src/flows/promo.ts` (the parts the
 * 04 PROMO / 05 SPLIT specs use). Amounts in DOLLARS.
 */

/* ------------------------------------------------------------------------- *
 * Quick Pay / items
 * ------------------------------------------------------------------------- */

const QP = VqpsHome.quickPayDialog;

/** Quick Pay tile → dialog. */
export async function openQuickPay(): Promise<void> {
  await P.clickQ(VqpsHome.quickPayTile);
  await P.waitFor(QP, 8_000, 'Quick Pay dialog');
}

/** Apply Discount switch + %/$ toggle + value (Quick Pay and the line editor share it). */
export async function setItemDiscountFields(
  dlg: VqcQuery,
  kind: '%' | '$',
  value: number | string,
): Promise<void> {
  const sw: readonly VqcQuery[] = [dlg, { role: 'switch', nth: 0 }];
  if ((await P.attrOf(sw, 'aria-checked')) !== 'true') await P.clickQ(sw);
  const radio: readonly VqcQuery[] = [
    dlg,
    { css: '[role="radio"],button', textRe: `^\\s*${kind === '$' ? '\\$' : '%'}\\s*$`, nth: 0 },
  ];
  await P.clickQ(radio);
  const raw = typeof value === 'string' ? value : kind === '%' ? String(value) : cents(value);
  await P.fillQ([dlg, { role: 'textbox', nth: -1 }], raw);
}

export interface QuickPayOpts {
  name?: string;
  note?: string;
  discount?: { kind: '%' | '$'; value: number };
}

/** One Quick Pay line (amount in dollars) for the staff on the order. */
export async function quickPay(amount: number, opts: QuickPayOpts = {}): Promise<void> {
  await openQuickPay();
  await P.fillQ([QP, { css: 'input[placeholder="0.00"]', nth: 0 }], cents(amount));
  if (opts.name) await P.fillQ([QP, { css: 'input[placeholder="Service Name"]' }], opts.name);
  if (opts.note)
    await P.fillQ([QP, { css: 'input[placeholder="Add note"],textarea[placeholder="Add note"]' }], opts.note);
  if (opts.discount) await setItemDiscountFields(QP, opts.discount.kind, opts.discount.value);
  const add: readonly VqcQuery[] = [QP, btn('Add')];
  for (let i = 0; i < 3 && (await visible(QP)); i += 1) {
    await P.clickQ(add, 3_000).catch(() => undefined);
    await P.waitGoneQ(QP, 4_000).catch(() => undefined);
  }
  await P.waitGoneQ(QP, 10_000, 'Quick Pay dialog');
  await app.idle(100);
}

/** Quick Checkout → (staff) → Quick Pay lines. Returns the order code. */
export async function createQuickPayOrder(
  items: { amount: number; name?: string; staff?: string }[],
): Promise<string> {
  await app.quickCheckout();
  let current = '';
  for (const it of items) {
    const staff = it.staff ?? vqEnv.testStaff;
    if (staff !== current) {
      await app.pickStaff(staff);
      current = staff;
    }
    await quickPay(it.amount, { name: it.name });
  }
  const id = await app.orderId();
  app.createdOrders.add(id);
  return id;
}

/** The line editor dialog (has Save/Update). */
export const itemDialog: VqcQuery = { role: 'dialog', hasCss: 'button', hasTextRe: 'Save|Update', nth: -1 };
export const itemSave: readonly VqcQuery[] = [
  itemDialog,
  { role: 'button', nameRe: '^(Save|Update)$', nth: 0 },
];

/** Click a cart line by its name span → editor dialog. */
export async function openItemDialog(itemName: string): Promise<void> {
  const ok = await clickFound(
    `var name = arguments[0];
     var rows = document.querySelectorAll('main div.pr-11');
     for (var i = 0; i < rows.length; i++) {
       var s = Array.prototype.find.call(rows[i].querySelectorAll('span'), function (x) { return (x.textContent || '').trim() === name; });
       if (s && s.getClientRects().length) return s;
     }
     return null;`,
    itemName,
  );
  if (!ok) throw new Error(`Line "${itemName}" not on the order`);
  await P.waitFor(itemSave, 8_000, `editor of ${itemName}`);
}

export async function itemDiscount(itemName: string, kind: '%' | '$', value: number): Promise<void> {
  await openItemDialog(itemName);
  await setItemDiscountFields(itemDialog, kind, value);
  await P.clickQ(itemSave);
  await P.waitGoneQ(itemSave, 8_000);
  await app.idle(100);
}

/** Sell/top-up `code` into the open order (no payment). Uses the $25/$50/$100 presets when possible. */
export async function addGiftCardLine(code: string, value: number): Promise<void> {
  await app.openSellGiftCard();
  const dlg = { role: 'dialog', name: 'Sell Gift Card', nth: -1 } as const;
  await P.fillQ([dlg, { role: 'textbox', name: 'Enter gift card code' }], code);
  await P.waitFor([dlg, { textRe: 'Balance: \\$', nth: 0 }], 10_000, 'gift card Balance');
  if ([25, 50, 100].includes(value)) await P.clickQ([dlg, btn(`$${String(value)}`)]);
  else await P.fillQ([dlg, { role: 'textbox', name: '$0.00', nth: 0 }], cents(value));
  await P.clickQ([dlg, btn('Add')]);
  await P.waitGoneQ(dlg, 8_000);
  await settle(800);
  await P.waitFor(
    inMain({ textRe: `Gift Card \\[\\*+-\\*+-${code.slice(-4)}\\]`, nth: 0 }),
    8_000,
    'gift card line',
  );
}

/* ------------------------------------------------------------------------- *
 * Checkout reads
 * ------------------------------------------------------------------------- */

export const METHODS: PayMethod[] = ['Card', 'Cash', 'Gift Card', 'Other'];

export async function checkoutState(): Promise<{
  text: string;
  entered: number;
  totalPaid: number;
  remaining: number;
  hasChange: boolean;
  change: number;
  subtotal: number;
  tip: number;
  total: number;
}> {
  const t = await app.text('main');
  const hasChange = /\| Change \| \$/.test(t);
  return {
    text: t,
    entered: money(/Enter Amount \| (\$[\d,.]+)/.exec(t)?.[1]),
    totalPaid: pick(t, 'Total Paid'),
    remaining: pick(t, 'Remaining'),
    hasChange,
    change: hasChange ? pick(t, 'Change') : 0,
    subtotal: pick(t, 'Subtotal'),
    tip: pick(t, 'Tip'),
    total: pick(t, 'Total'),
  };
}

/** Amount printed on each method button (NaN when the button shows a reason instead). */
export async function methodAmounts(): Promise<Record<PayMethod, number>> {
  const r = {} as Record<PayMethod, number>;
  for (const m of METHODS) r[m] = await app.methodAmount(m);
  return r;
}

export async function feeConfigFromCheckout(): Promise<{
  card: number;
  cash: number;
  other: number;
  enabled: boolean;
}> {
  const a = await methodAmounts();
  return { card: a.Card, cash: a.Cash, other: a.Other, enabled: Math.abs(a.Card - a.Cash) > 0.001 };
}

/** Checkout header back button (aria-label "Open sidebar") → /home. */
export async function checkoutBack(): Promise<void> {
  await P.clickQ([{ role: 'banner' }, btn('Open sidebar', 0)]);
  await app.waitPath(/\/home/, 15_000);
  await settle(800);
}

/** Cashier tip on checkout / split: Tip → digits (cents) → Add. */
export async function setCashierTip(keys: string[]): Promise<void> {
  await P.clickQ(inMain(btn('Tip', 0)));
  const d = VqpsCheckout.cashierTipDialog;
  await P.waitFor([d, btn('Add')], 5_000, 'Tip dialog');
  for (const k of keys) await P.clickQ([d, btn(k, 0)]);
  await P.clickQ([d, btn('Add')]);
  await P.waitGoneQ([d, btn('Add')], 5_000);
  await settle(900);
}

export async function customerText(): Promise<string> {
  return cust.text();
}

/* ------------------------------------------------------------------------- *
 * Promo & Rewards
 * ------------------------------------------------------------------------- */

export const promoDlg = VqpsPromo.dialog;
export const inPromo = (q: VqcQuery): readonly VqcQuery[] => [promoDlg, q];
export const promoApply = inPromo(btn('Apply'));
export const promoInput = inPromo({ role: 'textbox', nth: 0 });

export async function openPromo(): Promise<void> {
  await P.clickQ(VqpsHome.promoButton);
  await P.waitFor(promoDlg, 8_000, 'Promo & Rewards');
  await P.waitFor(inPromo({ textRe: VqpsPromo.loadedRe, nth: 0 }), 10_000, 'promo list loaded');
  await settle(500);
}

export async function customChecked(): Promise<boolean> {
  return isCheckedChain(await customCheckboxChain());
}

/** Tick Custom Discount → tab → raw value (% integer, $ in cents). */
export async function fillCustom(kind: '%' | '$', raw: string): Promise<void> {
  const cb = await customCheckboxChain();
  if (!(await isCheckedChain(cb))) await P.clickQ(cb);
  await P.clickQ(inPromo({ role: 'tab', name: kind === '%' ? VqpsPromo.tabPercent : VqpsPromo.tabAmount }));
  await P.fillQ(promoInput, raw);
}

export async function applyPromo(): Promise<void> {
  await P.clickQ(promoApply);
  await app.passcodeIfAsked(2_000);
  await P.waitGoneQ(promoDlg, 8_000, 'Promo & Rewards');
  await settle(800);
}

/** Expand "Order promotion discount setting" and stamp the Owner/Staff boxes. */
export async function promoSplitInputs(): Promise<{ owner: VqcChain; staff: VqcChain }> {
  const stamp = (): Promise<boolean> =>
    P.exec<boolean>(
      `var dlgs = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"]'), function (d) { return /Promo & Rewards/.test(d.textContent || ''); });
       var dlg = dlgs[dlgs.length - 1]; if (!dlg) return false;
       var mark = function (label, attr) {
         var lab = Array.prototype.find.call(dlg.querySelectorAll('*'), function (e) { return e.children.length === 0 && (e.textContent || '').trim() === label; });
         var box = lab && lab.parentElement ? lab.parentElement.querySelector('input') : null;
         if (box && box.getClientRects().length) { box.setAttribute(attr, '1'); return true; }
         return false;
       };
       return mark('Percent for owner', 'data-vqps-owner') && mark('Percent for staff', 'data-vqps-staff');`,
    );
  if (!(await stamp())) {
    await P.clickQ(inPromo({ text: VqpsPromo.splitSetting, nth: 0 }));
    await waitUntil(stamp, 5_000);
  }
  return { owner: { css: '[data-vqps-owner="1"]', nth: 0 }, staff: { css: '[data-vqps-staff="1"]', nth: 0 } };
}

/** Custom Discount (+ optional Owner share) → Apply. `$` values in dollars. */
export async function customDiscountSplit(
  kind: '%' | '$',
  value: number,
  ownerPercent?: number,
): Promise<void> {
  await openPromo();
  await fillCustom(kind, kind === '%' ? String(value) : cents(value));
  if (ownerPercent !== undefined) {
    const { owner } = await promoSplitInputs();
    await P.fillQ(owner, String(ownerPercent));
  }
  await applyPromo();
}

export async function closeDialogX(dlg: VqcQuery = promoDlg): Promise<void> {
  await P.clickQ([dlg, btn('Close', 0)]);
  await P.waitGoneQ(dlg, 5_000);
}

/* ------------------------------------------------------------------------- *
 * Gift card balance / redeem
 * ------------------------------------------------------------------------- */

let gcLastUse = 0;

/** VP-3761: two transactions on one card within 10 s are rejected — wait until 11 s passed. */
export async function giftCardCooldown(): Promise<void> {
  const wait = gcLastUse + 11_000 - Date.now();
  if (wait > 0) await settle(wait);
}

export function markGiftCardUse(): void {
  gcLastUse = Date.now();
}

/** Balance once two consecutive reads agree (DEV writes card ledgers asynchronously). */
export async function settledGiftCardBalance(code: string, timeoutMs = 45_000): Promise<number> {
  let prev = (await app.giftCardBalance(code)).balance;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await settle(3_000);
    const now = (await app.giftCardBalance(code)).balance;
    if (Math.abs(now - prev) < 0.005) return now;
    prev = now;
  }
  return prev;
}

/** Poll the balance until it equals `want` (returns the last read either way). */
export async function waitGiftCardBalance(code: string, want: number, timeoutMs = 60_000): Promise<number> {
  let now = Number.NaN;
  const deadline = Date.now() + timeoutMs;
  do {
    now = (await app.giftCardBalance(code)).balance;
    if (Math.abs(now - want) < 0.005) return now;
    await settle(1_000);
  } while (Date.now() < deadline);
  return now;
}

/** Make sure the card holds at least `min` (Cash top-up when short). */
export async function ensureGiftCardBalance(code: string, min: number): Promise<number> {
  let balance = await settledGiftCardBalance(code);
  if (!(balance >= min)) {
    const topUp = Math.max(
      vqEnv.giftCardTopUp,
      Math.ceil(min - (Number.isFinite(balance) ? balance : 0)) + 10,
    );
    await app.topUpGiftCard(code, topUp);
    balance = await waitGiftCardBalance(code, balance + topUp);
  }
  return balance;
}

/** At checkout: pay the whole order with `code` (Accepted → Pay → success). Returns the verdict text. */
export async function payCurrentWithGiftCard(code: string): Promise<string> {
  await giftCardCooldown();
  const r = await app.payWithGiftCard(code);
  if (!r.info.includes('Gift Card Accepted'))
    throw new Error(`Card ****${code.slice(-4)} not accepted: ${r.info}`);
  await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
  await app.driveToSuccess('none');
  markGiftCardUse();
  return r.info;
}

/* ------------------------------------------------------------------------- *
 * Cancel from Order History
 * ------------------------------------------------------------------------- */

/** Cancel the paid order shown in Order History and wait for Status = Canceled. */
export async function cancelPaidOrder(code: string): Promise<string> {
  await app.cancelOrder(0);
  return app.waitHistoryStatus(code, /^Canceled$/, 90_000);
}

/* ------------------------------------------------------------------------- *
 * Staff Income (V1) — Discount Charge
 * ------------------------------------------------------------------------- */

export async function staffDiscountCharge(staff: string): Promise<number> {
  const onIt =
    (await app.path()).startsWith('/incomes/income-staff') &&
    !(await P.count({ role: 'dialog' }).catch(() => 0)) &&
    (await P.textOf({ css: '[data-slot="income-layout-right"] h2', nth: 0 }).catch(() => '')).trim() ===
      staff;
  if (onIt) {
    await app.refetch();
  } else {
    await app.go('/home', { passcode: false });
    await app.go('/incomes/income-staff');
    const search = { css: 'input[placeholder="Search staff"]', nth: 0 } as const;
    await P.waitFor(search, 15_000, 'Staff Income search');
    await P.fillQ(search, staff);
    const row = inMain({ css: 'tbody tr', hasText: staff, nth: 0 });
    if (!(await appears(row, 5_000))) {
      const sw = [
        { css: '[data-slot="income-layout-left"]', nth: 0 },
        { role: 'switch', nth: 0 },
      ] as const;
      if ((await P.attrOf(sw, 'aria-checked').catch(() => null)) !== 'true')
        await P.clickQ(sw).catch(() => undefined);
      await appears(row, 10_000);
    }
    await P.clickQ(inMain({ text: staff, nth: 0 }));
    await P.waitFor(inMain({ text: 'Discount Charge', nth: 0 }), 15_000, 'Discount Charge');
    await app.refetch();
  }
  return pick(await app.text('main'), 'Discount Charge');
}

export async function waitDiscountChargeDelta(
  staff: string,
  before: number,
  delta: number,
  timeoutMs = 120_000,
): Promise<number> {
  let now = Number.NaN;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    now = await staffDiscountCharge(staff);
    if (Math.abs(now - before - delta) < 0.005) return now;
    await settle(1_000);
  }
  return now;
}

/* ------------------------------------------------------------------------- *
 * Customer & points
 * ------------------------------------------------------------------------- */

/** floor(amount incl. tip / $-per-point) — shared/checkout/points.ts. */
export const pointsFor = (amountWithTip: number, dollarsPerPoint: number): number =>
  Math.floor(Math.round(amountWithTip * 100) / Math.round(dollarsPerPoint * 100));

/** $ per point (VOLT_POINT_RATE_CASH / _OTHER override; volt-qc measured $2 on DEV 2026-10-09). */
export const POINT_RATE = {
  cash: Number(process.env.VOLT_POINT_RATE_CASH ?? '') || 2,
  other: Number(process.env.VOLT_POINT_RATE_OTHER ?? '') || 2,
};

/** Customer display after payment: "Congrats! You've earned | N points | Your current points | M". */
export async function customerEarnedPoints(
  timeoutMs = 20_000,
): Promise<{ earned: number; current: number; text: string }> {
  let t = '';
  await waitUntil(
    async () => {
      t = await cust.text();
      return t.includes("Congrats! You've earned") && /\| [\d,]+ points/.test(t);
    },
    timeoutMs,
    500,
  );
  const earned = Number((/You've earned \| ([\d,]+) points/.exec(t)?.[1] ?? 'NaN').replace(/,/g, ''));
  const current = Number((/Your current points \| ([\d,]+)/.exec(t)?.[1] ?? 'NaN').replace(/,/g, ''));
  return { earned, current, text: t };
}

/** Attach an EXISTING customer (keypad phone → Done; the app picks the first match). */
export async function attachExistingCustomer(phone: string): Promise<void> {
  await app.clickCustomerField();
  for (const c of phone) await P.clickQ(inMain(btn(c, 0)));
  await P.clickQ(inMain(btn('Done', 0)));
  const sep = btn('Create Separately', 0);
  if (await appears(sep, 2_000)) await P.clickQ(sep);
  await P.waitFor(
    inMain({ hasText: `***-***-${phone.slice(-4)}`, css: 'div,span,p', nth: 0 }),
    15_000,
    'customer attached',
  );
  await app.customerConfirmPhone();
}

/** "Point: N | Visit: V" in the Home customer bar. */
export async function homeCustomerStats(): Promise<{ point: number; visitRaw: string; visit: number }> {
  const t = await app.text('main');
  return {
    point: Number(/Point: ([\d,]+)/.exec(t)?.[1]?.replace(/,/g, '') ?? Number.NaN),
    visitRaw: /Visit: ([^|]+)/.exec(t)?.[1]?.trim() ?? '',
    visit: Number(/Visit: ([\d,]+)/.exec(t)?.[1]?.replace(/,/g, '') ?? Number.NaN),
  };
}

/** Checkout header "Points: N" / "Total visits: N". */
export async function checkoutCustomerStats(): Promise<{ points: number; visits: number }> {
  const t = await app.text('main');
  return {
    points: Number(/Points: ([\d,]+)/.exec(t)?.[1]?.replace(/,/g, '') ?? Number.NaN),
    visits: Number(/Total visits: ([\d,]+)/.exec(t)?.[1]?.replace(/,/g, '') ?? Number.NaN),
  };
}

/** Read points/visits through a throw-away order (polls until `expectPoint` when given). */
export async function readCustomerStats(
  phone: string,
  expectPoint?: number,
  timeoutMs = 60_000,
): Promise<{ points: number; visits: number }> {
  const deadline = Date.now() + timeoutMs;
  let last = { points: Number.NaN, visits: Number.NaN };
  do {
    const id = await app.createOrder();
    await attachExistingCustomer(phone);
    await app.pay();
    last = await checkoutCustomerStats();
    await app.openPendingOrder(id);
    await app.deleteCurrentOrder();
    app.createdOrders.delete(id);
    if (expectPoint === undefined || last.points === expectPoint) return last;
    await settle(3_000);
  } while (Date.now() < deadline);
  return last;
}

/** Customer bar → remove icon → "Remove Customer Phone" → Remove. */
export async function removeCustomerFromOrder(): Promise<void> {
  const ok = await clickFound(
    `var bar = document.querySelector(arguments[0]); if (!bar) return null; var b = bar.querySelectorAll('button'); return b[b.length - 1] || null;`,
    VqpsHome.customerBarCss,
  );
  if (!ok) throw new Error('No customer bar on the order');
  await P.clickQ([VqpsHome.removeCustomerDialog, btn('Remove')]);
  await P.waitGoneQ(VqpsHome.removeCustomerDialog, 5_000);
}

/* ------------------------------------------------------------------------- *
 * Misc
 * ------------------------------------------------------------------------- */

/** Pay the open order (Home) with Cash/Other, no tip, No Receipt. */
export async function payOpenOrder(method: 'Other' | 'Cash'): Promise<string> {
  await app.pay();
  await app.selectMethod(method);
  await app.completePayment({ tip: 'none' });
  const s = await app.waitSuccess();
  await app.noReceipt();
  return s;
}

/** Order code shown on checkout ("Order #OD…"). */
export async function checkoutOrderCode(): Promise<string> {
  return (
    /Order #(OD\d{6}-\d+)/.exec(await app.text('main'))?.[1] ??
    /#(OD\d{6}-\d+)/.exec(await app.text('main'))?.[1] ??
    ''
  );
}

/** Count payment lines of `method` in the Payment Details block of an Order History detail. */
export function countPayments(detail: string, method: 'Cash' | 'Other' | 'Gift Card'): number {
  const i = detail.indexOf('Payment Details');
  const end = i >= 0 ? detail.indexOf('Order Note', i) : -1;
  const seg = i >= 0 ? detail.slice(i, end > 0 ? end : undefined) : detail;
  return seg.split(' | ').filter((s) => s.trim() === method || s.trim().startsWith(`${method} -`)).length;
}

export { clickOrJs, field, r2 };

/** Small poll helper mirroring `expect.poll(...).toBe...` without asserting. */
export async function pollValue<T>(
  fn: () => Promise<T>,
  ok: (v: T) => boolean,
  timeout = 10_000,
): Promise<T> {
  let last = await fn();
  const deadline = Date.now() + timeout;
  while (!ok(last) && Date.now() < deadline) {
    await settle(300);
    last = await fn();
  }
  return last;
}
