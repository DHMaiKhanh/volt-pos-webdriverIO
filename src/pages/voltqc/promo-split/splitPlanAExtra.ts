import { $, browser } from '@wdio/globals';
import { btn, inMain, type VqcChain, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { VqcCommon } from '../../../constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsSplit } from '../../../constants/testids.voltqc-promo-split.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';
import { priceModel, type PriceModel } from './price.js';
import { app, clickFound, escapeRe, money, vqEnv, visible } from './vqApp.js';

/**
 * Extra helpers for the 05 SPLIT plan specs (split-basic / split-plan-a):
 * the volt-qc `flows/home.ts` bits (summary, prices, typeCode, closePasscode,
 * roleWithout, reopenToHome) and the split-row locators that need an
 * `ancestor::div.rounded-lg` hop the query language cannot express.
 */

export const unknownCode = (): string => (process.env.VOLT_UNKNOWN_CODE ?? '').trim() || '9137';
export const hasHardware = /^(1|true|yes)$/i.test((process.env.VOLT_HAS_HARDWARE ?? '').trim());
export const sum = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

/* ------------------------------------------------------------------------- *
 * Home bits (volt-qc flows/home.ts)
 * ------------------------------------------------------------------------- */

/** Order-panel Total (Card price). */
export async function summaryTotal(): Promise<number> {
  return (await app.orderTotals()).total;
}

/** Price model + tile base prices (call BEFORE opening the order). */
export async function prices(
  services: string[] = [vqEnv.testService],
): Promise<{ m: PriceModel; base: Record<string, number> }> {
  const m = await priceModel();
  await app.quickCheckout();
  const base: Record<string, number> = {};
  for (const s of services) base[s] = await app.basePrice(s);
  return { m, base };
}

/** Type `code` into the open passcode dialog; returns whether it stays open + its text. */
export async function typeCode(
  code: string,
  opts: { skip30?: boolean } = {},
): Promise<{ open: boolean; text: string }> {
  const dlg = VqcCommon.passcodeDialog;
  await P.waitFor(dlg, 8_000, 'passcode dialog');
  if (opts.skip30) await P.clickQ([dlg, { role: 'checkbox', nth: 0 }]);
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

/** Settings › Permissions row for `label`: owner/manager/partner/staff switches (null when unreadable). */
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

/** A role (staff/partner/manager) WITHOUT permission `label` that has a staff code in the env. */
export async function roleWithout(
  label: string,
): Promise<{ role: string; name: string; code: string } | null> {
  const p = await readPermission(label);
  if (!p) return null;
  for (const r of ['staff', 'partner', 'manager'] as const) {
    if (!p[r] && vqEnv.roles[r].code) return { role: r, ...vqEnv.roles[r] };
  }
  return null;
}

/** Order History › Re-Open → Confirm → checkout → Edit Order → Home in edit mode. */
export async function reopenToHome(id: string): Promise<void> {
  await app.reopenOrder(id);
  await P.clickQ(VqpsCheckout.editOrder);
  await app.passcodeIfAsked(2_000);
  await app.waitPath(/\/home\?editOrderId=/, 15_000);
}

/** `__TSR_ROUTER__.navigate({ to, params, search })` without waiting. */
export async function routerNavigate(
  to: string,
  params?: Record<string, string>,
  search?: Record<string, string>,
): Promise<void> {
  await P.exec<null>(
    'var o = { to: arguments[0] }; if (arguments[1]) o.params = arguments[1]; if (arguments[2]) o.search = arguments[2]; void window.__TSR_ROUTER__.navigate(o); return null;',
    to,
    params ?? null,
    search ?? null,
  );
}

/* ------------------------------------------------------------------------- *
 * Split screen locators
 * ------------------------------------------------------------------------- */

export const addCheckButton = VqpsSplit.addCheck;
export const selectCheckButton = (id: string, n: number): readonly VqcQuery[] => VqpsSplit.select(id, n);
export const deleteCheckButton = (id: string, n: number): readonly VqcQuery[] => VqpsSplit.del(id, n);
export const cashDrawerButton = VqpsSplit.cashDrawer;

export async function isEnabled(chain: VqcChain): Promise<boolean> {
  return !(await P.isDisabled(chain));
}

/** In-page JS: the rounded-lg block of check n (var `row`). */
const ROW_JS = `var a = document.querySelector('main [aria-label="Select #' + arguments[0] + '-' + arguments[1] + '"], main [aria-label="Check Successful #' + arguments[0] + '-' + arguments[1] + '"]');
     var row = a ? (a.closest('div.rounded-lg') || a.parentElement) : null;`;

const vis = 'function vis(e) { return !!e && e.getClientRects().length > 0; }';

/** Visible `label` elements (item rows) in check n, optionally filtered by text. */
export async function rowLabelCount(id: string, n: number, hasText?: string): Promise<number> {
  return P.exec<number>(
    `${ROW_JS}
     ${vis}
     if (!row) return 0;
     var t = arguments[2];
     return Array.prototype.filter.call(row.querySelectorAll('label'), function (l) { return vis(l) && (!t || (l.textContent || '').indexOf(t) >= 0); }).length;`,
    id,
    n,
    hasText ?? '',
  );
}

/** Text of the check's amount box (`div[class*="w-[360px]"]`). */
export async function amountBoxText(id: string, n: number): Promise<string> {
  return P.exec<string>(
    `${ROW_JS}
     var b = row ? row.querySelector('div[class*="w-[360px]"]') : null;
     return b ? String(b.innerText || b.textContent || '').replace(/\\s+/g, ' ').trim() : '';`,
    id,
    n,
  );
}

/** Poll the amount box until it reads `want` (Playwright toHaveText auto-retry); returns the last text. */
export async function waitAmountBox(id: string, n: number, want: string, timeout = 5_000): Promise<string> {
  return P.poll(
    () => amountBoxText(id, n),
    (t) => t === want,
    timeout,
  );
}

/** One tap on the amount box (first tap selects, second opens the keypad). */
export async function tapAmountBox(id: string, n: number): Promise<void> {
  const ok = await clickFound(
    `${ROW_JS} return row ? row.querySelector('div[class*="w-[360px]"]') : null;`,
    id,
    n,
  );
  if (!ok) throw new Error(`No amount box on check ${String(n)}`);
  await settle(300);
}

/** Click the check row itself. */
export async function clickCheckRow(id: string, n: number): Promise<void> {
  const ok = await clickFound(`${ROW_JS} return row;`, id, n);
  if (!ok) throw new Error(`No row for check ${String(n)}`);
  await settle(300);
}

/** Tick item `name` (label checkbox) in check `from`. */
async function tickItem(id: string, from: number, name: string): Promise<void> {
  const ok = await clickFound(
    `${ROW_JS}
     ${vis}
     if (!row) return null;
     var name = arguments[2];
     var l = Array.prototype.find.call(row.querySelectorAll('label'), function (l) { return vis(l) && (l.textContent || '').indexOf(name) >= 0; });
     return l ? (l.querySelector('[role="checkbox"],input[type="checkbox"]') || l) : null;`,
    id,
    from,
    name,
  );
  if (!ok) throw new Error(`No item "${name}" in check ${String(from)}`);
}

/** The exact "Check N" title inside check row n. */
const TITLE_JS = `${ROW_JS}
     if (!row) return null;
     var want = 'Check ' + arguments[1];
     return Array.prototype.find.call(row.querySelectorAll('*'), function (e) { return e.children.length === 0 && (e.textContent || '').trim() === want && e.getClientRects().length; }) || null;`;

/** Tick item in check `from`, then tap the title of check `to` (click-to-move). */
export async function moveItem(id: string, from: number, name: string, to: number): Promise<void> {
  await tickItem(id, from, name);
  const ok = await clickFound(TITLE_JS, id, to);
  if (!ok) throw new Error(`No "Check ${String(to)}" title`);
  await settle(500);
}

/** Collapse / Expand button of check row n. */
export async function clickRowButton(id: string, n: number, name: 'Collapse' | 'Expand'): Promise<void> {
  const ok = await clickFound(
    `${ROW_JS}
     if (!row) return null;
     var nm = arguments[2];
     return Array.prototype.find.call(row.querySelectorAll('button,[role="button"]'), function (b) { return ((b.getAttribute('aria-label') || b.textContent || '').trim() === nm) && b.getClientRects().length; }) || null;`,
    id,
    n,
    name,
  );
  if (!ok) throw new Error(`No ${name} button on check ${String(n)}`);
  await settle(300);
}

/** Rect (viewport CSS px) of item `name` in check `from` and of the "Check `to`" title. */
async function rectOf(
  body: string,
  ...args: unknown[]
): Promise<{ x: number; y: number; w: number; h: number } | null> {
  return P.exec(
    `var el = (function () { ${body} }).apply(null, arguments[0]);
     if (!el) return null;
     el.scrollIntoView({ block: 'nearest' });
     var r = el.getBoundingClientRect();
     return { x: r.x, y: r.y, w: r.width, h: r.height };`,
    args,
  );
}

/** dnd-kit drag: mouse down on the item, small nudge, multi-step move to the target title, up. */
export async function dragItemToCheck(id: string, from: number, name: string, to: number): Promise<void> {
  const a = await rectOf(
    `${ROW_JS}
     ${vis}
     if (!row) return null;
     var name = arguments[2];
     return Array.prototype.find.call(row.querySelectorAll('label'), function (l) { return vis(l) && (l.textContent || '').indexOf(name) >= 0; }) || null;`,
    id,
    from,
    name,
  );
  const b = await rectOf(TITLE_JS, id, to);
  if (!a || !b) throw new Error(`drag: item "${name}" or "Check ${String(to)}" not found`);
  const ax = Math.round(a.x + a.w / 2);
  const ay = Math.round(a.y + a.h / 2);
  const bx = Math.round(b.x + b.w / 2);
  const by = Math.round(b.y + b.h / 2);
  const act = browser
    .action('pointer')
    .move({ x: ax, y: ay })
    .down()
    .move({ x: ax + 10, y: ay + 10, duration: 100 });
  for (let i = 1; i <= 20; i += 1) {
    act.move({
      x: Math.round(ax + 10 + ((bx - ax - 10) * i) / 20),
      y: Math.round(ay + 10 + ((by - ay - 10) * i) / 20),
      duration: 25,
    });
  }
  await act.up().perform();
  await settle(800);
}

/* ------------------------------------------------------------------------- *
 * Misc
 * ------------------------------------------------------------------------- */

/** Double-click the "Pay $x" button of the Other Payment dialog. */
export async function dblClickOtherPay(): Promise<void> {
  const ok = await P.exec<boolean>(
    `var dlgs = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"],[role="alertdialog"]'), function (d) { return (d.textContent || '').indexOf('Other Payment') >= 0 && d.getClientRects().length; });
     var d = dlgs[dlgs.length - 1];
     if (!d) return false;
     var b = Array.prototype.find.call(d.querySelectorAll('button'), function (b) { return /^Pay\\s*\\$/.test((b.getAttribute('aria-label') || b.textContent || '').replace(/\\s+/g, ' ').trim()) && b.getClientRects().length; });
     if (!b) return false;
     b.setAttribute('data-vqps-dbl', '1');
     return true;`,
  );
  if (!ok) throw new Error('No "Pay $x" in Other Payment dialog');
  await $('[data-vqps-dbl="1"]').doubleClick();
  await P.exec<null>(
    'var e = document.querySelector(\'[data-vqps-dbl="1"]\'); if (e) e.removeAttribute("data-vqps-dbl"); return null;',
  );
  await settle(300);
}

/** `getByText(s).first()` visible (substring, innermost). */
export const textQ = (s: string): VqcQuery => ({ textRe: escapeRe(s), nth: 0 });

/** Pay button amount on the split screen. */
export async function payButtonAmount(): Promise<number> {
  return money(await P.textOf(VqpsSplit.pay));
}
