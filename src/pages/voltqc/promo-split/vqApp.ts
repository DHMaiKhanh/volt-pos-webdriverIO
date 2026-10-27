import { $, browser } from '@wdio/globals';
import { env } from '../../../../configs/env/loadEnv.js';
import {
  VqcCommon,
  VqcHome,
  btn,
  inMain,
  inTopDialog,
  type VqcChain,
  type VqcQuery,
} from '../../../constants/testids.voltqc-pos.js';
import {
  VqpsCheckout,
  VqpsCustomer,
  VqpsHistory,
  VqpsHome,
  VqpsPromo,
  VqpsSuccess,
} from '../../../constants/testids.voltqc-promo-split.js';
import { settle } from '../../../helpers/wait.js';
import { withCustomerWindow } from '../../../helpers/window.js';
import { quickCheckout as probeQuickCheckout } from '../pos/homeProbe.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';

/**
 * Port of the volt-qc `App` page object (`e2e/src/pages/app.ts`) on top of the
 * volt-qc query engine, for the 04 PROMO / 05 SPLIT specs.
 *
 * Every method keeps the volt-qc name and semantics so a ported test body reads
 * line-for-line like its source. Money comes back in DOLLARS (as in volt-qc);
 * compare with `toBeCloseTo(x, 2)`.
 *
 * Test data defaults are the volt-qc merchant-14 fixtures (staff Pamela /
 * Thalia, services Express Pedicure / Lavender Treatment) and can be overridden
 * with the same `VOLT_*` variables the source suite reads.
 */

const str = (k: string, d = ''): string => (process.env[k] ?? d).trim();

export const vqEnv = {
  staffCode: str('VOLT_STAFF_CODE') || env.STAFF_PASSCODE || env.OWNER_PASSCODE,
  testStaff: str('VOLT_TEST_STAFF', 'Pamela'),
  testStaff2: str('VOLT_TEST_STAFF_2', 'Thalia'),
  testService: str('VOLT_TEST_SERVICE', 'Express Pedicure'),
  testService2: str('VOLT_TEST_SERVICE_2', 'Lavender Treatment'),
  /** Gift card on THIS merchant used for redeem/top-up (volt-qc VOLT_TEST_GIFT_CARD). */
  testGiftCard: str('VOLT_TEST_GIFT_CARD'),
  giftCardTopUp: Number(str('VOLT_GIFT_CARD_TOPUP', '100')) || 100,
  /** Real card charges are opt-in, like the order-flow card specs. */
  cardSettle: str('CARD_SETTLE') === '1',
  roles: {
    manager: { name: str('VOLT_MANAGER_NAME'), code: str('VOLT_MANAGER_CODE') },
    partner: { name: str('VOLT_PARTNER_NAME'), code: str('VOLT_PARTNER_CODE') },
    staff: { name: str('VOLT_STAFFROLE_NAME'), code: str('VOLT_STAFFROLE_CODE') },
  },
};

/* ------------------------------------------------------------------------- *
 * Money / text helpers (volt-qc `money`, `pick`, `cents`, `usd`)
 * ------------------------------------------------------------------------- */

/** "$1,306.32" / "- $3.00" → dollars (NaN when no amount). */
export function money(s: string | null | undefined): number {
  const t = (s ?? '').replace(/,/g, '');
  const m = /-?\s*\$?\s*(-?\d+(?:\.\d+)?)/.exec(t);
  if (!m) return Number.NaN;
  const neg = /-\s*\$/.test(t) || m[0].trim().startsWith('-');
  return (neg ? -1 : 1) * Math.abs(Number(m[1]));
}

export const usd = (n: number): string =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const cents = (n: number): string => String(Math.round(n * 100));
export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Amount right after `label` in a " | "-joined text. NaN when absent. */
export function pick(t: string, label: string): number {
  const m = new RegExp(`(?:^|\\| )${escapeRe(label)} \\| (-?\\s*\\$[\\d,.]+)`).exec(t);
  return m ? money(m[1]) : Number.NaN;
}

/** `| Label | value |` field of an Order History detail text. */
export function field(detail: string, label: string): string {
  return new RegExp(`\\| ${escapeRe(label)} \\| ([^|]+)`).exec(detail)?.[1]?.trim() ?? '';
}

/** Unique letters-only name (`prefix Abcde`). */
export function uniqueName(prefix: string): string {
  let n = Date.now() % 26 ** 5;
  let s = '';
  for (let i = 0; i < 5; i += 1) {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return `${prefix} ${(s[0] ?? 'a').toUpperCase()}${s.slice(1)}`;
}

export const randomPhone = (): string => '832' + String(Date.now()).slice(-7);

/* ------------------------------------------------------------------------- *
 * Low-level marking click (for elements the query language cannot express)
 * ------------------------------------------------------------------------- */

let markSeq = 0;

/**
 * Run `findBody` in the page (string body; must `return` an Element or null),
 * stamp the hit and WebDriver-click it. Returns false when nothing was found.
 */
export async function clickFound(findBody: string, ...args: unknown[]): Promise<boolean> {
  const token = `m${String((markSeq += 1))}`;
  const ok = await P.exec<boolean>(
    `var el = (function () { ${findBody} }).apply(null, arguments[0]);
     if (!el) return false;
     el.setAttribute('data-vqps-hit', arguments[1]);
     el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
     return true;`,
    args,
    token,
  );
  if (!ok) return false;
  await $(`[data-vqps-hit="${token}"]`).click();
  await settle(150);
  return true;
}

/** Click; if WebDriver refuses (overlay / interception), fall back to an in-page click. */
export async function clickOrJs(chain: VqcChain, timeout = 5_000): Promise<void> {
  try {
    await P.clickQ(chain, timeout);
  } catch {
    await P.jsClickQ(chain);
  }
}

export async function visible(chain: VqcChain): Promise<boolean> {
  return P.has(chain).catch(() => false);
}

/** Wait until `chain` is visible; false on timeout (no throw). */
export async function appears(chain: VqcChain, timeout: number): Promise<boolean> {
  return P.waitFor(chain, timeout)
    .then(() => true)
    .catch(() => false);
}

export async function waitUntil(
  fn: () => Promise<boolean>,
  timeout: number,
  interval = 200,
): Promise<boolean> {
  return browser
    .waitUntil(fn, { timeout, interval })
    .then(() => true)
    .catch(() => false);
}

/* ------------------------------------------------------------------------- *
 * Customer display (second window)
 * ------------------------------------------------------------------------- */

export const cust = {
  async text(): Promise<string> {
    return withCustomerWindow(() => P.pageText('body')).catch(() => '');
  },
  async has(chain: VqcChain): Promise<boolean> {
    return withCustomerWindow(() => P.has(chain)).catch(() => false);
  },
  async click(chain: VqcChain): Promise<void> {
    await withCustomerWindow(() => P.clickQ(chain));
  },
  async waitFor(chain: VqcChain, timeout: number): Promise<boolean> {
    return waitUntil(() => cust.has(chain), timeout, 400);
  },
  async tipShown(): Promise<boolean> {
    return cust.has(VqpsCustomer.addTip);
  },
  /** volt-qc `customerTip`: 'none' → No Tip; '15%' → preset; then Continue. */
  async tip(choice: TipChoice): Promise<void> {
    await withCustomerWindow(async () => {
      if (choice === 'none') await P.clickQ(VqpsCustomer.noTip);
      else await P.clickQ({ text: choice, nth: 0 });
      for (let i = 0; i < 4; i += 1) {
        const ok = await P.clickQ(VqpsCustomer.cont, 2_500)
          .then(() => true)
          .catch(() => false);
        if (ok || !(await P.has(VqpsCustomer.addTip))) break;
      }
    });
  },
  /** Custom Tip → C → digits (cents) → Done → Continue. */
  async customTip(centsStr: string, cont = true): Promise<void> {
    await withCustomerWindow(async () => {
      await P.clickQ(VqpsCustomer.customTip);
      await P.clickQ(btn('C', 0));
      for (const k of centsStr) await P.clickQ(btn(k, 0));
      await P.clickQ(btn('Done', 0));
      if (cont) await P.clickQ(VqpsCustomer.cont);
    });
  },
  async confirmPhone(): Promise<void> {
    await withCustomerWindow(async () => {
      if (await appears(VqpsCustomer.yes, 10_000)) await P.clickQ(VqpsCustomer.yes);
    });
  },
};

export type TipChoice = 'none' | `${number}%`;
export type PayMethod = 'Card' | 'Cash' | 'Gift Card' | 'Other';

/* ------------------------------------------------------------------------- *
 * The App port
 * ------------------------------------------------------------------------- */

export interface OrderTotals {
  subtotal: number;
  promotion: number;
  tax: number;
  total: number;
}

class VqApp {
  /** Order codes this spec created — {@link cleanupOrders} deletes the ones still pending. */
  readonly createdOrders = new Set<string>();

  /* ------------------------------- common -------------------------------- */

  /** volt-qc `app.text(main, sel)`: innerText joined with " | ". */
  async text(sel = 'main'): Promise<string> {
    return P.pageText(sel);
  }

  async path(): Promise<string> {
    return P.path();
  }

  async url(): Promise<string> {
    return P.exec<string>('return window.location.pathname + window.location.search;');
  }

  async waitPath(re: RegExp, timeout = 15_000): Promise<void> {
    const ok = await waitUntil(async () => re.test(await this.url()), timeout, 150);
    if (!ok) throw new Error(`URL never matched ${String(re)} (now ${await this.url()})`);
  }

  passcodeDialog(): VqcQuery {
    return VqcCommon.passcodeDialog;
  }

  async passcodeVisible(): Promise<boolean> {
    return visible(VqcCommon.passcodeDialog);
  }

  /** Type `code` on the passcode keypad; optionally tick "Do not require passcode for the next 30 minutes". */
  async enterPasscode(code: string = vqEnv.staffCode, opts: { skip30?: boolean } = {}): Promise<void> {
    if (!code)
      throw new Error('The app asks for a staff code but VOLT_STAFF_CODE / STAFF_PASSCODE is empty.');
    const dlg = VqcCommon.passcodeDialog;
    if (opts.skip30) {
      const cb: readonly VqcQuery[] = [dlg, { role: 'checkbox', nth: 0 }];
      if (await visible(cb)) {
        const state = await P.attrOf(cb, 'data-state');
        if (state !== 'checked' && (await P.attrOf(cb, 'aria-checked')) !== 'true')
          await P.clickQ(cb).catch(() => undefined);
      }
    }
    for (let attempt = 0; ; attempt += 1) {
      try {
        for (const c of code) await P.clickQ([dlg, btn(c, 0)], 4_000);
        break;
      } catch (e) {
        if (!(await visible(dlg))) return;
        if (attempt >= 1) throw e;
        await settle(500);
      }
    }
    await P.waitGoneQ(dlg, 1_500).catch(() => undefined);
  }

  /** If the passcode guard shows within `waitMs`, answer it. Returns whether it showed. */
  async passcodeIfAsked(waitMs = 2_500): Promise<boolean> {
    if (!(await appears(VqcCommon.passcodeDialog, waitMs))) return false;
    await this.enterPasscode(vqEnv.staffCode);
    return true;
  }

  async skipActive(): Promise<boolean> {
    return P.exec<boolean>(
      "try { var s = JSON.parse(localStorage.getItem('volt-passcode-skip') || 'null'); return !!s && typeof s.expiresAt === 'number' && s.expiresAt > Date.now() + 5000; } catch (e) { return false; }",
    );
  }

  async clearPasscodeSkip(): Promise<void> {
    await P.localSet('volt-passcode-skip', null);
  }

  async discardLeaveIfAsked(): Promise<boolean> {
    const b = { role: 'button', nameRe: '^(Discard & Leave|Bỏ thay đổi.*)$', nth: 0 } as const;
    if (!(await visible(b))) return false;
    await P.clickQ(b);
    await settle(500);
    return true;
  }

  /** Close leftover dialogs (Done/Close/OK/Keep Order/Cancel/Continue Editing, else Escape). */
  async closeStrayDialogs(): Promise<void> {
    for (let i = 0; i < 4; i += 1) {
      const n = await P.count({ role: 'dialog' }).catch(() => 0);
      if (!n) return;
      if (await this.discardLeaveIfAsked()) continue;
      const b = inTopDialog({
        css: 'button',
        textRe: '^\\s*(Done|Close|OK|Keep Order|Cancel|Continue Editing)\\s*$',
        nth: 0,
      });
      const named = inTopDialog({
        role: 'button',
        nameRe: '^(Done|Close|OK|Keep Order|Cancel|Continue Editing)$',
        nth: 0,
      });
      if (await visible(named)) await P.clickQ(named, 2_000).catch(() => P.escape());
      else if (await visible(b)) await P.clickQ(b, 2_000).catch(() => P.escape());
      else await P.escape();
      await waitUntil(async () => (await P.count({ role: 'dialog' }).catch(() => 0)) < n, 600, 100);
    }
  }

  /** Router navigation, answering a Discard prompt / passcode guard on the way. */
  async go(to: string, opts: { passcode?: boolean } = {}): Promise<void> {
    await this.closeStrayDialogs();
    await P.routerGo(to).catch(() => undefined);
    const target = to.split('?')[0] ?? to;
    const deadline = Date.now() + 3_500;
    let quietSince = 0;
    while (Date.now() < deadline) {
      if (await this.discardLeaveIfAsked()) {
        await P.routerGo(to).catch(() => undefined);
        quietSince = 0;
        continue;
      }
      if (opts.passcode !== false && (await this.passcodeVisible())) {
        await this.enterPasscode(vqEnv.staffCode);
        quietSince = 0;
        continue;
      }
      if ((await this.path()).startsWith(target)) {
        quietSince ||= Date.now();
        if (Date.now() - quietSince >= (target === '/home' ? 100 : 600)) break;
      }
      await settle(60);
    }
  }

  async closeToasts(): Promise<void> {
    await P.closeToasts().catch(() => undefined);
  }

  /** Wait for react-query to go idle (volt-qc `app.idle`). */
  async idle(minMs = 350, timeoutMs = 8_000): Promise<void> {
    await P.exec<null>(
      `var minMs = arguments[0], t = arguments[1];
       var qc = window.__TSR_ROUTER__ && window.__TSR_ROUTER__.options && window.__TSR_ROUTER__.options.context ? window.__TSR_ROUTER__.options.context.queryClient : null;
       var end = Date.now() + t;
       return new Promise(function (resolve) {
         setTimeout(function tick(idle) {
           idle = idle || 0;
           if (!qc || Date.now() > end || idle >= 2) return resolve(null);
           var now = qc.isFetching() === 0 && qc.isMutating() === 0 ? idle + 1 : 0;
           setTimeout(function () { tick(now); }, 60);
         }, minMs);
       });`,
      minMs,
      timeoutMs,
    ).catch(() => undefined);
  }

  /** Force-refetch every active query in place (volt-qc `app.refetch`). */
  async refetch(timeoutMs = 20_000): Promise<void> {
    await P.exec<null>(
      `var t = arguments[0];
       var qc = window.__TSR_ROUTER__ && window.__TSR_ROUTER__.options && window.__TSR_ROUTER__.options.context ? window.__TSR_ROUTER__.options.context.queryClient : null;
       if (!qc) return null;
       return Promise.race([qc.refetchQueries({ type: 'active' }).catch(function () {}), new Promise(function (r) { setTimeout(r, t); })]).then(function () { return null; });`,
      timeoutMs,
    ).catch(() => undefined);
    await this.idle(100, 5_000);
  }

  /* ------------------------------ Home / order ----------------------------- */

  async quickCheckout(): Promise<void> {
    await this.go('/home');
    await probeQuickCheckout();
    await this.idle(0);
  }

  async orderId(): Promise<string> {
    await P.waitFor(VqcHome.orderHeading, 15_000, 'order header #OD…');
    const t = await P.textOf(VqcHome.orderHeading);
    const m = /OD\d{6}-\d+/.exec(t);
    if (!m) throw new Error(`No order code in "${t}"`);
    return m[0];
  }

  async hasOrderId(): Promise<boolean> {
    return visible(VqcHome.orderHeading);
  }

  /** Subtotal / Promotion / Tax / Total of the order panel or checkout (NaN when a line is absent; Tax 0). */
  async orderTotals(): Promise<OrderTotals> {
    const t = await this.text('main');
    const p = (label: string): number => {
      const m = new RegExp(`\\| ${label} \\| (-?\\s*\\$[\\d,.]+)`).exec(t);
      return m ? money(m[1]) : Number.NaN;
    };
    const tax = p('Tax');
    return {
      subtotal: p('Subtotal'),
      promotion: p('Promotion'),
      tax: Number.isFinite(tax) ? tax : 0,
      total: p('Total'),
    };
  }

  async changeStaffCount(): Promise<number> {
    return P.count(inMain(btn('Change Staff')));
  }

  /** Staff tile by exact name, outside the Pending sidebar (`aside`). */
  async pickStaff(name: string = vqEnv.testStaff): Promise<void> {
    const before = await this.changeStaffCount();
    const clicked = await clickFound(
      `var name = arguments[0];
       var els = document.querySelectorAll('main *');
       for (var i = 0; i < els.length; i++) {
         var e = els[i];
         if (e.closest('aside,[role="complementary"]')) continue;
         if (e.children.length > 0) continue;
         if ((e.textContent || '').trim() !== name) continue;
         if (!e.getClientRects().length) continue;
         return e;
       }
       return null;`,
      name,
    );
    if (!clicked) {
      // The grid is virtualised: narrow it with the staff search, then retry.
      if (await visible(VqcHome.staffSearch)) {
        await P.fillQ(VqcHome.staffSearch, name);
        await settle(500);
        await this.pickStaff(name);
        await P.fillQ(VqcHome.staffSearch, '').catch(() => undefined);
        return;
      }
      throw new Error(`Staff tile "${name}" not found on Home`);
    }
    await waitUntil(async () => (await this.changeStaffCount()) > before, 1_500, 100);
    await this.idle(0, 400);
  }

  /** Order-panel line rows (`div.pr-11`) whose name span is exactly `name`. */
  async itemRowCount(name: string): Promise<number> {
    return P.exec<number>(
      `var name = arguments[0];
       return Array.prototype.filter.call(document.querySelectorAll('main div.pr-11'), function (d) {
         return d.getClientRects().length && Array.prototype.some.call(d.querySelectorAll('span'), function (s) { return (s.textContent || '').trim() === name; });
       }).length;`,
      name,
    );
  }

  /** innerText of the first line row named `name` (" | "-joined). */
  async itemRowText(name: string): Promise<string> {
    return P.exec<string>(
      `var name = arguments[0];
       var d = Array.prototype.find.call(document.querySelectorAll('main div.pr-11'), function (d) {
         return d.getClientRects().length && Array.prototype.some.call(d.querySelectorAll('span'), function (s) { return (s.textContent || '').trim() === name; });
       });
       return d ? String(d.innerText || '').replace(/\\s*\\n+\\s*/g, ' | ') : '';`,
      name,
    );
  }

  async serviceTileVisible(name: string): Promise<boolean> {
    return visible(inMain({ css: 'li', hasText: name, nth: 0 }));
  }

  /** Base price printed on a service tile (volt-qc `basePrice`). */
  async basePrice(service: string): Promise<number> {
    const tile = inMain({ css: 'li', hasText: service, nth: 0 });
    if (!(await appears(tile, 3_000)) && (await visible(VqcHome.serviceSearch))) {
      await P.fillQ(VqcHome.serviceSearch, service);
      await P.waitFor(tile, 10_000, `service tile ${service}`);
      const v = money(/\$[\d,.]+/.exec(await P.textOf(tile))?.[0]);
      await P.fillQ(VqcHome.serviceSearch, '');
      return v;
    }
    return money(/\$[\d,.]+/.exec(await P.textOf(tile))?.[0]);
  }

  async addService(name: string = vqEnv.testService): Promise<void> {
    const tile = inMain({ css: 'li', hasText: name, nth: 0 });
    const before = await this.itemRowCount(name);
    const sub0 = (await this.orderTotals()).subtotal;
    const added = (): Promise<boolean> =>
      waitUntil(
        async () => (await this.itemRowCount(name)) > before && (await this.orderTotals()).subtotal !== sub0,
        1_500,
        100,
      );
    const clickAdded = async (): Promise<void> => {
      await P.clickQ(tile);
      if ((await added()) || before > 0) return;
      await settle(1_000);
      if ((await this.itemRowCount(name)) > before) return;
      if (await visible(VqpsHome.selectStaffFirst)) return;
      await P.clickQ(tile);
      await added();
    };
    if (!(await visible(tile))) {
      await P.fillQ(VqcHome.serviceSearch, name);
      await P.waitFor(tile, 8_000, `service tile ${name}`);
      await clickAdded();
      await P.fillQ(VqcHome.serviceSearch, '');
      return;
    }
    await clickAdded();
  }

  /** Quick Checkout → staff → services. Returns the order code. */
  async createOrder(opts: { staff?: string; services?: string[] } = {}): Promise<string> {
    await this.quickCheckout();
    await this.pickStaff(opts.staff ?? vqEnv.testStaff);
    const id = await this.orderId();
    this.createdOrders.add(id);
    for (const s of opts.services ?? [vqEnv.testService]) await this.addService(s);
    return id;
  }

  /** Trash icon on a line → "Remove Service Item" → Remove. */
  async removeItem(name: string): Promise<void> {
    const ok = await clickFound(
      `var name = arguments[0];
       var d = Array.prototype.find.call(document.querySelectorAll('main div.pr-11'), function (d) {
         return d.getClientRects().length && Array.prototype.some.call(d.querySelectorAll('span'), function (s) { return (s.textContent || '').trim() === name; });
       });
       return d ? d.querySelector('button.text-destructive') : null;`,
      name,
    );
    if (!ok) throw new Error(`No remove button on line "${name}"`);
    await P.clickQ([VqpsHome.removeItemDialog, btn('Remove')]);
    await P.waitGoneQ(VqpsHome.removeItemDialog, 5_000);
  }

  async changeStaff(to: string): Promise<void> {
    await P.clickQ(VqpsHome.changeStaff);
    await P.waitFor(inMain({ hasText: 'Change from', css: 'div', nth: 0 }), 5_000);
    await clickFound(
      `var name = arguments[0];
       var els = document.querySelectorAll('main *');
       for (var i = 0; i < els.length; i++) {
         var e = els[i];
         if (e.closest('aside,[role="complementary"]') || e.children.length) continue;
         if ((e.textContent || '').trim() === name && e.getClientRects().length) return e;
       }
       return null;`,
      to,
    );
    const dlg = { role: 'dialog', nameRe: `to ${escapeRe(to)}\\?`, nth: -1 } as const;
    await P.clickQ([dlg, btn('Confirm')]);
    await P.waitGoneQ(dlg, 5_000);
  }

  /** Remove → passcode → "Delete Order" → Delete. */
  async deleteCurrentOrder(): Promise<void> {
    await P.clickQ(VqpsHome.removeOrder);
    await this.passcodeIfAsked(3_000);
    await P.clickQ([VqpsHome.deleteOrderDialog, btn('Delete')]);
    await P.waitGoneQ(VqpsHome.deleteOrderDialog, 8_000);
  }

  async addNote(note: string): Promise<void> {
    await P.clickQ(VqpsHome.noteButton);
    await P.fillQ([VqpsHome.orderNoteDialog, { role: 'textbox', name: 'Order note' }], note);
    await P.clickQ([VqpsHome.orderNoteDialog, btn('Save')]);
    await P.waitFor(inMain({ hasText: note, css: 'div', nth: 0 }), 5_000);
  }

  customerField(): VqcChain {
    return [{ css: 'body' }, { css: `input[placeholder="${VqpsHome.customerPlaceholder}"]`, nth: 0 }];
  }

  async clickCustomerField(): Promise<void> {
    if (await visible(this.customerField())) await P.clickQ(this.customerField());
    else await P.clickQ(inMain({ text: VqpsHome.customerPlaceholder, nth: 0 }));
  }

  /** New customer: phone on the keypad → Done → name → Save; the customer display confirms Yes. */
  async attachNewCustomer(phone: string, name: string): Promise<void> {
    await this.clickCustomerField();
    for (const c of phone) await P.clickQ(inMain(btn(c, 0)));
    await P.clickQ(inMain(btn('Done', 0)));
    const dlg = { role: 'dialog', hasCss: 'input[placeholder="Enter customer name"]', nth: -1 } as const;
    await P.fillQ([dlg, { css: 'input[placeholder="Enter customer name"]' }], name);
    await P.clickQ([dlg, btn('Save')]);
    await P.waitFor(inMain({ hasText: name, css: 'div', nth: 0 }), 10_000, `customer ${name}`);
  }

  async customerConfirmPhone(): Promise<void> {
    await cust.confirmPhone().catch(() => undefined);
  }

  /** Custom Discount via Promo & Rewards. `$` values in dollars. */
  async customDiscount(kind: '%' | '$', value: number): Promise<void> {
    await P.clickQ(VqpsHome.promoButton);
    const dlg = VqpsPromo.dialog;
    await P.waitFor(dlg, 10_000, 'Promo & Rewards');
    const cb = await customCheckboxChain();
    if (!(await isCheckedChain(cb))) await P.clickQ(cb);
    await P.clickQ([dlg, { role: 'tab', name: kind === '%' ? VqpsPromo.tabPercent : VqpsPromo.tabAmount }]);
    await P.fillQ([dlg, { role: 'textbox', nth: 0 }], kind === '%' ? String(value) : cents(value));
    await P.clickQ([dlg, btn('Apply')]);
    await this.passcodeIfAsked(2_000);
    await P.waitGoneQ(dlg, 8_000, 'Promo & Rewards');
  }

  /** Pending sidebar search → open the card. */
  async openPendingOrder(code: string): Promise<void> {
    await this.go('/home');
    const box: readonly VqcQuery[] = [VqpsHome.pendingSidebar, { role: 'textbox', nth: 0 }];
    await P.fillQ(box, code);
    await P.clickQ([VqpsHome.pendingSidebar, { role: 'button', nameRe: `^${code}`, nth: 0 }], 10_000);
    await P.waitFor(inMain({ textRe: `^#${code}`, nth: 0 }), 15_000, `order #${code}`);
    await P.fillQ(box, '').catch(() => undefined);
  }

  async pendingHas(code: string): Promise<boolean> {
    await this.go('/home');
    const box: readonly VqcQuery[] = [VqpsHome.pendingSidebar, { role: 'textbox', nth: 0 }];
    await P.fillQ(box, code);
    const has = await appears(
      [VqpsHome.pendingSidebar, { role: 'button', nameRe: `^${code}`, nth: 0 }],
      1_500,
    );
    await P.fillQ(box, '').catch(() => undefined);
    return has;
  }

  /** Order status in the local DB by code (one read-only graphql IPC); null when unreadable. */
  async orderStatuses(ids: string[]): Promise<Record<string, string> | null> {
    if (!ids.length) return {};
    return P.exec<Record<string, string> | null>(
      `var ids = arguments[0];
       try {
         var q = 'query { orderList(where: { orderCode: { in: ' + JSON.stringify(ids) + ' } }) { orderCode status } }';
         return window.__TAURI_INTERNALS__.invoke('graphql', { query: q, variables: null, operation: null }).then(function (res) {
           var list = ((res && res.data) || res || {}).orderList;
           if (!Array.isArray(list)) return null;
           var o = {}; list.forEach(function (x) { o[x.orderCode] = x.status; }); return o;
         }).catch(function () { return null; });
       } catch (e) { return null; }`,
      ids,
    ).catch(() => null);
  }

  /** Delete the still-pending orders this spec created (best effort). */
  async cleanupOrders(): Promise<void> {
    const ids = [...this.createdOrders];
    const status = await this.orderStatuses(ids);
    for (const id of ids) {
      const st = status?.[id];
      if (st && st !== 'pending') {
        this.createdOrders.delete(id);
        continue;
      }
      try {
        await this.closeStrayDialogs();
        if (await this.pendingHas(id)) {
          await this.openPendingOrder(id);
          await this.deleteCurrentOrder();
        }
      } catch {
        /* best effort */
      }
      this.createdOrders.delete(id);
    }
  }

  /* -------------------------------- Checkout -------------------------------- */

  async pay(): Promise<void> {
    await P.clickQ(inMain(VqpsHome.payButton));
    await this.waitPath(/\/checkout/, 15_000);
    await P.waitFor(VqpsCheckout.complete, 15_000, 'Complete Payment');
  }

  methodButton(m: PayMethod): readonly VqcQuery[] {
    return inMain({ role: 'button', nameRe: `^${escapeRe(m)} \\$`, nth: 0 });
  }

  async methodAmount(m: PayMethod): Promise<number> {
    return money(await P.textOf(this.methodButton(m)).catch(() => ''));
  }

  async selectMethod(m: PayMethod): Promise<void> {
    await clickOrJs(this.methodButton(m));
    await settle(300);
  }

  /** Checkout keypad (cents). */
  async keypad(keys: string): Promise<void> {
    for (const k of keys) await P.clickQ(inMain(btn(k, 0)));
  }

  async enteredAmount(): Promise<number> {
    return money(/Enter Amount \| (\$[\d,.]+)/.exec(await this.text('main'))?.[1]);
  }

  async completePayment(opts: { tip?: TipChoice; button?: VqcChain } = {}): Promise<void> {
    await P.clickQ(opts.button ?? VqpsCheckout.complete);
    await this.driveToSuccess(opts.tip ?? 'none');
  }

  /** Answer passcode / customer tip until /payment-success. */
  async driveToSuccess(tip: TipChoice = 'none', timeoutMs = 45_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let tipped = false;
    while (Date.now() < deadline) {
      if (/payment-success/.test(await this.path())) return;
      if (await this.passcodeVisible()) {
        await this.enterPasscode(vqEnv.staffCode).catch(() => undefined);
        await P.waitGoneQ(VqcCommon.passcodeDialog, 8_000).catch(() => undefined);
        continue;
      }
      if (!tipped && (await cust.tipShown())) {
        await cust.tip(tip);
        tipped = true;
        continue;
      }
      await settle(200);
    }
    throw new Error(
      `Never reached Payment Successful within ${String(timeoutMs / 1000)}s (URL ${await this.url()}).`,
    );
  }

  async successText(): Promise<string> {
    await P.waitFor({ text: VqpsSuccess.title, nth: 0 }, 20_000, 'Payment Successful!');
    return this.text('body');
  }

  async waitSuccess(): Promise<string> {
    await this.waitPath(/payment-success/, 45_000);
    return this.successText();
  }

  async noReceipt(): Promise<void> {
    await P.clickQ(VqpsSuccess.noReceipt);
    await waitUntil(async () => !/payment-success/.test(await this.path()), 15_000, 150);
  }

  /** Open order → Pay → method → Complete → success text. */
  async payCurrentOrder(
    m: 'Cash' | 'Other',
    opts: { cashKeys?: string; tip?: TipChoice } = {},
  ): Promise<string> {
    await this.pay();
    await this.selectMethod(m);
    if (opts.cashKeys) {
      await this.keypad('C');
      await this.keypad(opts.cashKeys);
    }
    await this.completePayment({ tip: opts.tip });
    return this.successText();
  }

  /** Create + settle a walk-in order (Cash by default). Returns its code and what was paid. */
  async createPaidOrder(
    opts: { method?: 'Cash' | 'Other'; staff?: string; services?: string[]; tip?: TipChoice } = {},
  ): Promise<{ id: string; total: number }> {
    const id = await this.createOrder({ staff: opts.staff, services: opts.services });
    const m = opts.method ?? 'Cash';
    let total = (await this.orderTotals()).total;
    await this.pay();
    const b = await this.methodAmount(m);
    if (!Number.isNaN(b)) total = b;
    await this.selectMethod(m);
    await this.completePayment({ tip: opts.tip });
    await this.successText();
    await this.noReceipt();
    return { id, total };
  }

  /* -------------------------------- Gift card ------------------------------- */

  async openSellGiftCard(): Promise<void> {
    await P.clickQ(VqcHome.giftCardTile);
    await P.waitFor({ role: 'dialog', name: 'Sell Gift Card', nth: -1 }, 10_000, 'Sell Gift Card');
  }

  /** Balance read in the Sell Gift Card dialog (writes nothing). */
  async giftCardBalance(code: string): Promise<{ status: string; balance: number }> {
    await this.quickCheckout();
    await this.openSellGiftCard();
    const dlg = { role: 'dialog', name: 'Sell Gift Card', nth: -1 } as const;
    await P.fillQ([dlg, { role: 'textbox', name: 'Enter gift card code' }], code);
    const bal = [dlg, { textRe: '^.*Balance: \\$[\\d,.]+$', nth: 0 }] as const;
    await P.waitFor([dlg, { textRe: 'Balance: \\$', nth: 0 }], 10_000, 'gift card Balance');
    const t = (await P.textOf(bal)) || (await P.textOf([dlg, { textRe: 'Balance: \\$', nth: 0 }]));
    await P.clickQ([dlg, btn('Close', 0)]);
    return {
      status: /^(\w[\w ]*?) ?Balance/.exec(t)?.[1]?.trim() ?? '',
      balance: money(/Balance: (\$[\d,.]+)/.exec(t)?.[1]),
    };
  }

  /** Top up `code` by `amount` dollars, paid in Cash. Returns the sale order code. */
  async topUpGiftCard(code: string, amount: number): Promise<string> {
    await this.quickCheckout();
    await this.openSellGiftCard();
    const dlg = { role: 'dialog', name: 'Sell Gift Card', nth: -1 } as const;
    await P.fillQ([dlg, { role: 'textbox', name: 'Enter gift card code' }], code);
    await P.waitFor([dlg, { textRe: 'Balance: \\$', nth: 0 }], 10_000);
    await P.fillQ([dlg, { role: 'textbox', name: '$0.00', nth: 0 }], cents(amount));
    await P.clickQ([dlg, btn('Add')]);
    await P.waitGoneQ(dlg, 8_000);
    const id = await this.orderId();
    this.createdOrders.add(id);
    await this.payCurrentOrder('Cash');
    await this.noReceipt();
    return id;
  }

  /** At checkout: Gift Card → Complete → (tip) → Input Gift Card Code → Confirm; returns the verdict dialog text. */
  async payWithGiftCard(code: string): Promise<{ info: string }> {
    await this.selectMethod('Gift Card');
    await P.clickQ(VqpsCheckout.complete);
    await this.reachGiftCardInput();
    return this.confirmGiftCardCode(code);
  }

  /** Poll passcode / customer tip until "Input Gift Card Code" shows. */
  async reachGiftCardInput(timeoutMs = 40_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let tipped = false;
    while (Date.now() < deadline) {
      if (await this.passcodeVisible()) {
        await this.enterPasscode(vqEnv.staffCode);
        continue;
      }
      if (!tipped && (await cust.tipShown())) {
        await cust.tip('none');
        tipped = true;
        continue;
      }
      if (await visible(VqpsCheckout.inputGiftCard)) return;
      await settle(200);
    }
    throw new Error('"Input Gift Card Code" never showed');
  }

  async confirmGiftCardCode(code: string): Promise<{ info: string }> {
    await P.clickQ(VqpsCheckout.inputGiftCard);
    const box: readonly VqcQuery[] = [VqpsCheckout.gcCodeDialog, { role: 'textbox', nth: 0 }];
    await P.fillQ(box, code);
    const confirm: readonly VqcQuery[] = [VqpsCheckout.gcCodeDialog, btn('Confirm')];
    if (await P.isDisabled(confirm).catch(() => true)) {
      await P.fillQ(box, '');
      await P.typeQ(box, code);
    }
    await P.clickQ(confirm);
    await P.waitFor(VqpsCheckout.gcResultDialog, 15_000, 'gift card verdict');
    return { info: ((await P.rawText(VqpsCheckout.gcResultDialog)) ?? '').replace(/\s*\n+\s*/g, ' | ') };
  }

  /* ------------------------------ Order History ----------------------------- */

  async openHistoryOrder(code: string): Promise<void> {
    if ((await this.path()).startsWith('/order-history')) await this.go('/home', { passcode: false });
    await this.go('/order-history');
    await P.waitFor(VqpsHistory.heading, 15_000, 'Order History');
    await P.fillQ(VqpsHistory.search, code);
    const ok = await waitUntil(
      async () =>
        (
          await P.exec<string>(
            'var a = document.querySelector(arguments[0]); return a ? (a.textContent || "").replace(/\\s/g, "") : "";',
            VqpsHistory.rowCss,
          )
        ).includes(code),
      20_000,
      300,
    );
    if (!ok) throw new Error(`Order ${code} not found in Order History`);
    await P.clickQ({ css: VqpsHistory.rowCss, nth: 0 });
    await P.waitFor(inMain({ text: `Order #${code}` }), 15_000, `Order #${code}`);
    await this.closeToasts();
  }

  /** Detail-pane text from "Order #code" on. */
  async historyDetail(code: string): Promise<string> {
    const t = await this.text('main');
    const i = t.indexOf(`Order #${code}`);
    return i >= 0 ? t.slice(i) : t;
  }

  async waitHistoryStatus(code: string, want: RegExp, timeoutMs = 120_000): Promise<string> {
    let st = '';
    await waitUntil(
      async () => {
        st = field(await this.historyDetail(code), 'Status');
        return want.test(st);
      },
      timeoutMs,
      1_000,
    );
    return st;
  }

  /** Cancel Order → first reason → Confirm Cancel → passcode → dialog gone. */
  async cancelOrder(reasonIndex = 0): Promise<void> {
    await this.closeToasts();
    await P.clickQ(VqpsHistory.cancelOrder);
    await this.passcodeIfAsked(2_000);
    await P.clickQ([VqpsHistory.cancelDialog, { role: 'combobox', nth: 0 }]);
    await P.clickQ({ role: 'option', nth: reasonIndex });
    await P.clickQ([VqpsHistory.cancelDialog, btn('Confirm Cancel')]);
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      if (await this.passcodeVisible()) {
        await this.enterPasscode(vqEnv.staffCode);
        break;
      }
      if (await visible({ textRe: 'Order canceled successfully|Unable to Cancel Order', nth: 0 })) break;
      if (!(await visible(VqpsHistory.cancelDialog))) break;
      await settle(300);
    }
    await P.waitGoneQ(VqpsHistory.cancelDialog, 15_000);
  }

  /** Order History › Re-Open Order → Confirm → passcode → checkout ?editOrderId= */
  async reopenOrder(code: string): Promise<void> {
    await this.openHistoryOrder(code);
    await P.clickQ(VqpsHistory.reopen);
    await this.passcodeIfAsked(2_000);
    await P.clickQ([VqpsHistory.reopenConfirm, btn('Confirm')]);
    await this.passcodeIfAsked(2_500);
    await this.waitPath(/checkout\?editOrderId=/, 20_000);
    await settle(1_000);
  }

  /** Checkout (re-open) → Re-Open Done → back on /order-history/… */
  async finishReopen(): Promise<void> {
    if ((await this.path()).startsWith('/home')) {
      await P.clickQ(inMain(VqpsHome.payButton));
      await this.waitPath(/checkout/, 15_000);
    }
    await P.clickQ(VqpsCheckout.reopenDone);
    await this.passcodeIfAsked(2_500);
    await this.waitPath(/\/order-history\//, 20_000);
  }
}

export const app = new VqApp();

/* ------------------------------------------------------------------------- *
 * Promo dialog bits used by App.customDiscount
 * ------------------------------------------------------------------------- */

/** The RadioCheckbox beside the "Custom Discount" label (stamped so the chain is stable). */
export async function customCheckboxChain(): Promise<readonly VqcQuery[]> {
  await P.exec<null>(
    `var dlgs = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"]'), function (d) { return /Promo & Rewards/.test(d.textContent || ''); });
     var dlg = dlgs[dlgs.length - 1];
     if (!dlg) return null;
     var lab = Array.prototype.find.call(dlg.querySelectorAll('*'), function (e) { return e.children.length === 0 && (e.textContent || '').trim() === 'Custom Discount'; });
     var host = lab ? lab.parentElement : null;
     var cb = null;
     for (var i = 0; i < 4 && host && !cb; i++) { cb = host.querySelector('[role="checkbox"]'); host = host.parentElement; }
     var prev = document.querySelectorAll('[data-vqps-custom]');
     for (var j = 0; j < prev.length; j++) prev[j].removeAttribute('data-vqps-custom');
     if (cb) cb.setAttribute('data-vqps-custom', '1');
     return null;`,
  );
  return [{ css: '[data-vqps-custom="1"]', nth: 0 }];
}

export async function isCheckedChain(chain: VqcChain): Promise<boolean> {
  const i = await P.info(chain);
  if (!i) return false;
  return i.attrs['data-state'] === 'checked' || i.attrs['aria-checked'] === 'true';
}
