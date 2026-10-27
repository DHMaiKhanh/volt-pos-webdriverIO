import { browser } from '@wdio/globals';
import { btn, inMain, type VqcChain, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { VqcCommon } from '../../../constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsHistory } from '../../../constants/testids.voltqc-promo-split.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';
import { openReport, rangeOffset, waitNoSkeleton } from '../reports-time/rptDom.js';
import { ensureGiftCardBalance } from './promoFlows.js';
import { openSplitTip, splitTipDialog, tipInputs } from './splitFlows.js';
import { app, appears, clickFound, cust, escapeRe, vqEnv, visible, waitUntil } from './vqApp.js';

/**
 * Extra helpers for `split-plan-b.spec.ts` (volt-qc 05 SPLIT, SPLIT-K1 … SPLIT-Q1):
 * the bits of volt-qc `flows/home.ts`, `flows/reports.ts` and the local helpers of
 * `split-plan.spec.ts` that the shared promo-split library does not carry.
 */

export const sum = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

/** Any element whose text CONTAINS `s` (Playwright `getByText(s)` substring). */
export const textHas = (s: string, nth = 0): VqcQuery => ({ textRe: escapeRe(s), nth });

/** Wait until some element contains `s`; false on timeout. */
export async function textAppears(s: string, timeout = 8_000): Promise<boolean> {
  return appears(textHas(s), timeout);
}

/* ------------------------------------------------------------------------- *
 * Home / order
 * ------------------------------------------------------------------------- */

/** Staff names of the order panel (each staff block carries a "Change Staff" button). */
export async function orderStaffNames(): Promise<string[]> {
  return P.exec<string[]>(
    `var bs = Array.prototype.filter.call(document.querySelectorAll('main button'), function (b) {
       return (b.getAttribute('aria-label') || b.textContent || '').trim() === 'Change Staff' && b.getClientRects().length;
     });
     return bs.map(function (b) { var p = b.parentElement; return String((p && p.innerText) || '').replace('Change Staff', '').trim(); });`,
  );
}

/** Two-staff order (Pamela: service 1, Thalia: service 2). Returns its code. */
export async function twoStaffOrder(): Promise<string> {
  const id = await app.createOrder({ services: [vqEnv.testService] });
  await app.pickStaff(vqEnv.testStaff2);
  await app.addService(vqEnv.testService2);
  // The Thalia block may swallow the first tile click ("Choose service") — add once more.
  if (!(await waitUntil(async () => (await app.itemRowCount(vqEnv.testService2)) > 0, 3_000))) {
    await settle(800);
    await app.addService(vqEnv.testService2);
  }
  await waitUntil(
    async () =>
      JSON.stringify(await orderStaffNames()) === JSON.stringify([vqEnv.testStaff, vqEnv.testStaff2]),
    8_000,
  );
  const names = await orderStaffNames();
  if (JSON.stringify(names) !== JSON.stringify([vqEnv.testStaff, vqEnv.testStaff2])) {
    throw new Error(
      `Order staff are ${JSON.stringify(names)}, want [${vqEnv.testStaff}, ${vqEnv.testStaff2}]`,
    );
  }
  return id;
}

/** Test gift card balance; tops up when below `min` (volt-qc spec-local `ensureGiftBalance`). */
export async function ensureGiftBalance(min: number): Promise<number> {
  const b = await ensureGiftCardBalance(vqEnv.testGiftCard, min);
  await app.closeStrayDialogs();
  return b;
}

/** Gift card balance in cents (NaN-safe rounding). */
export async function giftBalanceCents(): Promise<number> {
  return Math.round((await app.giftCardBalance(vqEnv.testGiftCard)).balance * 100);
}

/** Poll the test card balance (cents) until `want`, up to `timeout`; returns the reads. */
export async function pollGiftBalanceCents(want: number, timeout: number): Promise<number[]> {
  const seen: number[] = [];
  const deadline = Date.now() + timeout;
  for (;;) {
    const c = await giftBalanceCents();
    seen.push(c);
    if (c === want || Date.now() > deadline) return seen;
    await settle(2_000);
  }
}

/** Staff names rendered on the (virtualised) Home staff grid. */
export async function visibleStaffNames(): Promise<string[]> {
  return (await P.texts(inMain({ css: 'span.col-span-2.text-xl' }))).map((s) => s.trim()).filter(Boolean);
}

/** Click the name span (`span.truncate`) of the first order line named `name`. */
export async function clickItemRowName(name: string): Promise<boolean> {
  return clickFound(
    `var name = arguments[0];
     var d = Array.prototype.find.call(document.querySelectorAll('main div.pr-11'), function (d) {
       return d.getClientRects().length && Array.prototype.some.call(d.querySelectorAll('span'), function (s) { return (s.textContent || '').trim() === name; });
     });
     return d ? d.querySelector('span.truncate') : null;`,
    name,
  );
}

/* ------------------------------------------------------------------------- *
 * Checkout / payment success
 * ------------------------------------------------------------------------- */

/** Open order → Pay → Other → Complete → (customer Custom Tip cents | No Tip) → success text. */
export async function payOtherWithTip(tipCents?: string): Promise<string> {
  await app.pay();
  await app.selectMethod('Other');
  await P.clickQ(VqpsCheckout.complete);
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

/** Split Tip dialog: the i-th staff amount input. */
export const tipInput = (i: number): readonly VqcQuery[] => [
  splitTipDialog,
  { css: 'input[placeholder="0.00"]', nth: i },
];
export const tipTab = (name: string): readonly VqcQuery[] => [splitTipDialog, { role: 'tab', name }];
export const tipConfirm: readonly VqcQuery[] = [splitTipDialog, btn('Confirm')];
export const tipClose: readonly VqcQuery[] = [splitTipDialog, btn('Close', 0)];

export async function selectedTipTab(): Promise<string> {
  return (await P.textOf([splitTipDialog, { role: 'tab', css: '[aria-selected="true"]', nth: 0 }])).trim();
}

export async function tipInputsDisabled(): Promise<boolean[]> {
  return (await P.infos(tipInputs)).map((i) => i.disabled || 'readonly' in i.attrs);
}

/**
 * Open Split Tip so that Proportion is NOT the saved method (merchant 14 saves Proportion by
 * default → the Proportion tab would be "no change" and Confirm disabled). Saves Split Evenly first.
 */
export async function openSplitTipNotProportion(): Promise<void> {
  await openSplitTip();
  if ((await selectedTipTab()) === 'Proportion') {
    console.warn(
      'Order saved Proportion (merchant setting) → saving Split Evenly first so Proportion is a change',
    );
    await P.clickQ(tipTab('Split Evenly'));
    await P.clickQ(tipConfirm);
    await P.waitFor(textHas('Tip updated successfully'), 10_000, 'Tip updated successfully');
    await P.waitGoneQ(splitTipDialog, 8_000, 'Split Tip dialog');
    await settle(1_500);
    await openSplitTip();
    const sel = await selectedTipTab();
    if (sel !== 'Split Evenly') throw new Error(`Split Tip re-opened on "${sel}", want Split Evenly`);
  }
}

/* ------------------------------------------------------------------------- *
 * Re-open
 * ------------------------------------------------------------------------- */

/** Order History › Re-Open Order → Confirm → checkout ?editOrderId= (Edit Order not pressed). */
export async function reopenToCheckout(id: string): Promise<void> {
  await app.openHistoryOrder(id);
  await P.clickQ(VqpsHistory.reopen);
  await app.passcodeIfAsked(2_000);
  await P.clickQ([VqpsHistory.reopenConfirm, btn('Confirm')]);
  await app.passcodeIfAsked(2_500);
  await app.waitPath(/checkout\?editOrderId=/, 20_000);
}

/* ------------------------------------------------------------------------- *
 * Passcode / permissions
 * ------------------------------------------------------------------------- */

/** Type `code` into the open passcode dialog; returns whether it stays open + its text. */
export async function typeCode(code: string): Promise<{ open: boolean; text: string }> {
  const dlg = VqcCommon.passcodeDialog;
  await P.waitFor(dlg, 8_000, 'passcode dialog');
  for (const c of code) await P.clickQ([dlg, btn(c, 0)]);
  await settle(1_500);
  const open = await visible(dlg);
  const text = open ? ((await P.rawText(dlg)) ?? '').replace(/\s*\n+\s*/g, ' | ') : '';
  return { open, text };
}

/** Close the passcode dialog (Escape). */
export async function closePasscode(): Promise<void> {
  if (!(await visible(VqcCommon.passcodeDialog))) return;
  await P.escape();
  await P.waitGoneQ(VqcCommon.passcodeDialog, 5_000, 'passcode dialog');
}

/** Settings › Permissions row for `label` (null when unreadable). */
export async function readPermission(
  label: string,
): Promise<{ owner: boolean; manager: boolean; partner: boolean; staff: boolean } | null> {
  if (!(await app.path()).startsWith('/settings/permissions')) {
    await app.go('/settings/permissions');
    await P.clickQ(inMain({ text: 'Expand All', nth: 0 }), 3_000).catch(() => undefined);
    await settle(800);
  }
  return P.exec(
    `var label = arguments[0];
     var labs = Array.prototype.filter.call(document.querySelectorAll('main *'), function (e) { return (e.textContent || '').trim() === label; });
     var lab = labs[labs.length - 1];
     if (!lab) return null;
     var row = lab;
     for (var i = 0; i < 6 && row; i++) { row = row.parentElement; if (row && row.querySelectorAll('[role=switch]').length >= 4) break; }
     var sw = row ? Array.prototype.map.call(row.querySelectorAll('[role=switch]'), function (s) { return s.getAttribute('aria-checked') === 'true'; }) : [];
     if (sw.length < 4) return null;
     return { owner: sw[0], manager: sw[1], partner: sw[2], staff: sw[3] };`,
    label,
  );
}

/** A role (staff/partner/manager) WITHOUT permission `label` that has a staff code in .env. */
export async function roleWithout(
  label: string,
): Promise<{ role: string; name: string; code: string } | null> {
  const roles = vqEnv.roles;
  if (!roles.staff.code && !roles.partner.code && !roles.manager.code) return null;
  const p = await readPermission(label);
  if (!p) return null;
  for (const r of ['staff', 'partner', 'manager'] as const) {
    if (!p[r] && roles[r].code) return { role: r, ...roles[r] };
  }
  return null;
}

/* ------------------------------------------------------------------------- *
 * Daily Sale Report row (volt-qc flows/reports.ts `dailySaleRow`)
 * ------------------------------------------------------------------------- */

async function dailySaleRowOn(id: string, day: number): Promise<string | null> {
  const r = rangeOffset(day);
  await openReport('/incomes/income-daily', { from: r.from, to: r.to, activeChart: 'sale' });
  await P.waitFor(textHas('Daily Sale Report'), 15_000, 'Daily Sale Report');
  await waitNoSkeleton('main').catch(() => undefined);
  // Virtual table: newest rows are at the BOTTOM → scan from the bottom up in one round trip.
  return P.exec<string | null>(
    `var id = arguments[0];
     var find = function () {
       var el = Array.prototype.find.call(document.querySelectorAll('tr, [role="row"]'), function (r) { return (r.textContent || '').indexOf(id) >= 0; });
       return el ? String(el.innerText).replace(/\\s*\\n+\\s*|\\t+/g, ' | ') : null;
     };
     var frame = function () { return new Promise(function (r) { setTimeout(r, 60); }); };
     var sc = Array.prototype.filter.call(document.querySelectorAll('main *'), function (e) {
       return e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY);
     });
     sc.forEach(function (s) { s.scrollTop = s.scrollHeight; });
     return frame().then(function loop(i) {
       i = i || 0;
       var row = find();
       if (row || i >= 400) return row;
       var moved = false;
       sc.forEach(function (s) { var b = s.scrollTop; s.scrollTop = Math.max(0, b - Math.max(200, s.clientHeight - 60)); if (s.scrollTop !== b) moved = true; });
       if (!moved) return find();
       return frame().then(function () { return loop(i + 1); });
     });`,
    id,
  );
}

/**
 * Row of order `id` in the Daily Sale Report (null when absent). The report day follows the
 * merchant timezone (bug #24: after noon CT a new order lands on TOMORROW's report day), so
 * today and tomorrow are both scanned.
 */
export async function dailySaleRow(id: string): Promise<string | null> {
  for (const day of [0, 1]) {
    const row = await dailySaleRowOn(id, day).catch(() => null);
    if (row) return row;
  }
  return null;
}

/* ------------------------------------------------------------------------- *
 * Viewport / theme / contrast
 * ------------------------------------------------------------------------- */

/**
 * Resize the app window so the page viewport is `width`×`height` (volt-qc used CDP device
 * metrics). Returns a restore function, or null when the window cannot reach that size
 * (screen smaller, window manager clamps, driver refuses).
 */
export async function emulateViewport(width: number, height: number): Promise<(() => Promise<void>) | null> {
  const before = await browser.getWindowSize().catch(() => null);
  if (!before) return null;
  const restore = async (): Promise<void> => {
    await browser.setWindowSize(before.width, before.height).catch(() => undefined);
    await settle(800);
  };
  const inner = await P.exec<{ w: number; h: number }>(
    'return { w: window.innerWidth, h: window.innerHeight };',
  );
  const dw = Math.max(0, before.width - inner.w);
  const dh = Math.max(0, before.height - inner.h);
  try {
    await browser.setWindowSize(width + dw, height + dh);
  } catch {
    return null;
  }
  await settle(1_000);
  const now = await P.exec<{ w: number; h: number }>(
    'return { w: window.innerWidth, h: window.innerHeight };',
  );
  if (Math.abs(now.w - width) > 2 || Math.abs(now.h - height) > 2) {
    console.warn(
      `emulateViewport: asked ${String(width)}×${String(height)}, got ${String(now.w)}×${String(now.h)}`,
    );
    await restore();
    return null;
  }
  return restore;
}

export const themeRadio = (t: 'light' | 'dark'): VqcChain =>
  inMain({
    css: `[data-testid="appearance-theme-${t}"], [id="${t}"][role="radio"], button[id="${t}"]`,
    nth: 0,
  });

/** WCAG contrast of the split method tile `m` (label vs first opaque background up the tree). */
export async function methodTileContrast(
  m: string,
): Promise<{ ratio: number; px: number; weight: number } | null> {
  return P.exec<{ ratio: number; px: number; weight: number } | null>(
    `var m = arguments[0];
     var norm = function (s) { return String(s || '').replace(/\\s+/g, ' ').trim(); };
     var el = Array.prototype.find.call(document.querySelectorAll('main button'), function (b) {
       return b.getClientRects().length && norm(b.getAttribute('aria-label') || b.textContent) === m;
     });
     if (!el) return null;
     var parse = function (c) { return (c.match(/[\\d.]+/g) || []).slice(0, 3).map(Number); };
     var lum = function (rgb) {
       var v = rgb.map(function (x) { var s = x / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
       return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
     };
     var bgEl = el;
     var bg = getComputedStyle(el).backgroundColor;
     while (bgEl && /rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) {
       bgEl = bgEl.parentElement;
       bg = bgEl ? getComputedStyle(bgEl).backgroundColor : 'rgb(255,255,255)';
     }
     var label = el.querySelector('span') || el;
     var st = getComputedStyle(label);
     var l1 = lum(parse(st.color));
     var l2 = lum(parse(bg));
     return { ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), px: parseFloat(st.fontSize), weight: Number(st.fontWeight) || 400 };`,
    m,
  );
}
