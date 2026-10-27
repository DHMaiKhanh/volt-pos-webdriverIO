import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog } from '../../../components/index.js';
import { Routes } from '../../../constants/routes.js';
import {
  CdCustomer,
  CdMain,
  type VqcChain,
  type VqcQuery,
} from '../../../constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../flows/index.js';
import { dismissUpdaterIfPresent } from '../../../helpers/updater.js';
import { settle, waitUntilPath } from '../../../helpers/wait.js';
import { parseMoney } from '../../../utils/money.js';
import { homePage } from '../../index.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';
import { cust } from './customerScreen.js';

/**
 * The staff window for the volt-qc CD / E2E ports — volt-qc `src/pages/app.ts`
 * (`App`) re-expressed over the role/name probe, because build 1.1.x strips
 * the testids the page objects would otherwise use on these paths.
 *
 * ## Orders are addressed by their CODE
 *
 * volt-qc keys everything on the human order code (`OD261027-12`): the pending
 * sidebar search, Order History search and the detail heading all take it. So
 * does this layer; `createOrder()` returns the code, not the uuid
 * `src/flows/order.flow.ts` returns.
 *
 * ## Test data
 *
 * volt-qc pinned VOLT_TEST_STAFF / VOLT_TEST_SERVICE. Here the first rendered
 * staff card (STAFF_NAME when it is on screen) and the first rendered service
 * tile are discovered once per worker and reused, so every case in a run talks
 * about the same people and the same line.
 */

export type PayMethod = 'Card' | 'Cash' | 'Gift Card' | 'Other';
export type TipChoice = 'none' | `${number}%`;

export interface TestData {
  staff: string;
  staff2: string;
  service: string;
}

let data: TestData | null = null;

const ORDER_CODE = /OD\d{6}-\d+/;
const passcode = (): string => env.STAFF_PASSCODE || env.OWNER_PASSCODE;

export const fmtPhone = (p: string): string => `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}`;
export const masked = (p: string): string => `***-***-${p.slice(-4)}`;
export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Unique letters-only name (GoCheckin drops digits from names). */
export function uniqueName(prefix: string): string {
  let n = Date.now() % 26 ** 5;
  let s = '';
  for (let i = 0; i < 5; i += 1) {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return `${prefix} ${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}

/** A test phone unlikely to collide: 832 + 7 digits off the clock. */
export const randomPhone = (): string => `832${String(Date.now()).slice(-7)}`;

/** `| Label | value |` field of a `a | b | c` page dump. */
export function field(detail: string, label: string): string {
  return new RegExp(`\\| ${escapeRe(label)} \\| ([^|]+)`).exec(detail)?.[1]?.trim() ?? '';
}

/** First `$x.xx` after `| Label |` in a page dump, in cents (NaN when absent). */
export function moneyField(dump: string, label: string): number {
  const m = new RegExp(`\\| ${escapeRe(label)} \\| (-?\\s*\\$[\\d,]+\\.\\d{2})`).exec(dump);
  return m?.[1] ? parseMoney(m[1]) : NaN;
}

class CdApp {
  /* --------------------------------------------------------------------- *
   * Generic
   * --------------------------------------------------------------------- */

  /** `main` (or `sel`) as `a | b | c`. */
  text(sel = 'main'): Promise<string> {
    return P.pageText(sel);
  }

  has(chain: VqcChain): Promise<boolean> {
    return P.has(chain);
  }

  count(chain: VqcChain): Promise<number> {
    return P.count(chain);
  }

  click(chain: VqcChain, timeout?: number): Promise<void> {
    return P.clickQ(chain, timeout);
  }

  path(): Promise<string> {
    return P.path();
  }

  /** Normalised text of every hit. */
  texts(chain: VqcChain): Promise<string[]> {
    return P.texts(chain);
  }

  textOf(chain: VqcChain): Promise<string> {
    return P.textOf(chain);
  }

  attr(chain: VqcChain, name: string): Promise<string | null> {
    return P.attrOf(chain, name);
  }

  /** Switch / checkbox / radio state (`aria-checked` or `data-state`). */
  async isOn(chain: VqcChain): Promise<boolean> {
    return (
      (await P.attrOf(chain, 'aria-checked')) === 'true' ||
      (await P.attrOf(chain, 'data-state')) === 'checked'
    );
  }

  /** Playwright-style fill (select all, insert). */
  fill(chain: VqcChain, value: string): Promise<string> {
    return P.fillQ(chain, value);
  }

  isDisabled(chain: VqcChain): Promise<boolean> {
    return P.isDisabled(chain);
  }

  async waitFor(chain: VqcChain, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    return P.poll(() => P.has(chain), Boolean, timeout);
  }

  async waitGone(chain: VqcChain, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    return !(await P.poll(
      () => P.has(chain),
      (v) => !v,
      timeout,
    ));
  }

  async waitPath(re: RegExp, timeout: number = Timeouts.NAVIGATION): Promise<boolean> {
    return re.test(
      await P.poll(
        () => P.path(),
        (p) => re.test(p),
        timeout,
      ),
    );
  }

  /* --------------------------------------------------------------------- *
   * Passcode, dialogs, navigation
   * --------------------------------------------------------------------- */

  passcodeShown(): Promise<boolean> {
    return passcodeDialog.isPrompting(Timeouts.ANIMATION).catch(() => false);
  }

  /** Enter the staff passcode when the guard comes up within `waitMs`; true when it did. */
  async passcodeIfAsked(waitMs = 2_500): Promise<boolean> {
    return passcodeDialog.enterIfPresent(passcode(), { timeout: waitMs }).catch(async (error: unknown) => {
      // The guard can close itself mid-typing (gate re-evaluated); only a guard
      // that is STILL up after the attempt is a real rejection.
      if (await this.passcodeShown()) throw error;
      return true;
    });
  }

  /** Type digits into the open guard without waiting for a verdict (wrong-code cases). */
  async typeIntoPasscode(code: string): Promise<void> {
    for (const c of code) await P.clickQ([CdMain.passcodeDialog, { role: 'button', name: c, nth: 0 }]);
    await settle(1_500);
  }

  async discardLeaveIfAsked(): Promise<boolean> {
    if (!(await P.has(CdMain.discardLeave))) return false;
    await P.clickQ(CdMain.discardLeave);
    await settle(500);
    return true;
  }

  /** Close leftover dialogs (Done / Close / OK / Keep Order / Cancel / Escape). */
  async closeStrayDialogs(): Promise<void> {
    for (let i = 0; i < 4; i += 1) {
      const open = await P.count({ role: 'dialog' });
      if (open === 0) return;
      if (await this.discardLeaveIfAsked()) continue;
      const close: readonly VqcQuery[] = [
        { role: 'dialog', nth: -1 },
        { role: 'button', nameRe: CdMain.strayCloseRe, nth: 0 },
      ];
      if (await P.has(close)) await P.clickQ(close).catch(() => P.escape());
      else await P.escape();
      await P.poll(
        () => P.count({ role: 'dialog' }),
        (n) => n < open,
        800,
      );
    }
  }

  /**
   * Router navigation with the volt-qc `go()` loop: answers the leave guard and
   * the passcode guard as they appear, done once the path is the target.
   * `/home` goes through {@link returnToHome} (it knows every exit).
   */
  async go(to: string, opts: { passcode?: boolean } = {}): Promise<void> {
    await this.closeStrayDialogs();
    if (to === Routes.HOME) {
      if (/payment-success|\/checkout/.test(await P.path())) {
        await returnToHome();
        return;
      }
    }
    await P.routerGo(to);
    const target = to.split('?')[0] ?? to;
    const deadline = Date.now() + 6_000;
    let quietSince = 0;
    while (Date.now() < deadline) {
      if (await this.discardLeaveIfAsked()) {
        await P.routerGo(to);
        quietSince = 0;
        continue;
      }
      if (opts.passcode !== false && (await this.passcodeShown())) {
        await this.passcodeIfAsked(Timeouts.ANIMATION);
        quietSince = 0;
        continue;
      }
      if ((await P.path()).startsWith(target)) {
        quietSince ||= Date.now();
        if (Date.now() - quietSince >= 800) break;
      }
      await settle(100);
    }
  }

  /* --------------------------------------------------------------------- *
   * Home / order building
   * --------------------------------------------------------------------- */

  /** Quick Checkout until an EMPTY order frame holds for 400 ms (the till can bounce back). */
  async quickCheckout(): Promise<void> {
    await this.go(Routes.HOME);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await P.clickQ(CdMain.quickCheckout);
      const deadline = Date.now() + 3_000;
      let emptySince = 0;
      while (Date.now() < deadline) {
        const hasOrder = await P.has(CdMain.orderHeading);
        const empty =
          !hasOrder && ((await P.has(CdMain.customerInput)) || (await P.has(CdMain.customerFieldText)));
        if (!empty) emptySince = 0;
        else if (!emptySince) emptySince = Date.now();
        else if (Date.now() - emptySince >= 400) return;
        await settle(80);
      }
    }
    throw new Error('Quick Checkout never produced an empty order frame (an "#OD…" header kept showing).');
  }

  /** Staff + service + second staff the run talks about (discovered once). */
  async testData(): Promise<TestData> {
    if (data) return data;
    await this.quickCheckout();
    const names = (await P.texts({ css: CdMain.staffNameCss })).filter(Boolean);
    const preferred = env.STAFF_NAME.trim();
    const staff = preferred && names.includes(preferred) ? preferred : (names[0] ?? '');
    const staff2 = names.find((n) => n !== staff) ?? '';
    const services = await P.exec<string[]>(
      'return Array.prototype.filter.call(document.querySelectorAll("main li"), function (li) { return !!li.querySelector("span.block") && li.getClientRects().length > 0; }).map(function (li) { return (li.querySelector("span.block").textContent || "").trim(); });',
    );
    const service = services.find(Boolean) ?? '';
    if (!staff || !service) {
      throw new Error(
        `No staff card / service tile rendered on Home (staff=${JSON.stringify(names)}, services=${JSON.stringify(services)}).`,
      );
    }
    data = { staff, staff2, service };
    return data;
  }

  async pickStaff(name: string): Promise<void> {
    const tile: VqcQuery = { css: CdMain.staffNameCss, text: name, nth: 0 };
    if (!(await P.has(tile))) {
      await P.fillQ([{ css: 'main' }, { css: 'input', placeholder: 'Search staff', nth: 0 }], name).catch(
        () => '',
      );
    }
    const before = await P.count({ role: 'button', name: 'Change Staff' });
    await P.clickQ(tile).catch(() => P.jsClickQ(tile));
    await P.poll(
      () => P.count({ role: 'button', name: 'Change Staff' }),
      (n) => n > before,
      1_500,
    );
    await settle(300);
  }

  async addService(name: string): Promise<void> {
    const tile = CdMain.serviceTile(name);
    const before = await P.count(CdMain.itemRow(name));
    if (!(await P.has(tile))) await P.fillQ(CdMain.serviceSearch, name);
    await P.clickQ(tile);
    const added = await P.poll(
      () => P.count(CdMain.itemRow(name)),
      (n) => n > before,
      2_500,
    );
    if (added <= before && before === 0 && !(await P.has({ text: 'Select Staff First' }))) {
      await settle(1_000);
      if ((await P.count(CdMain.itemRow(name))) === 0) await P.clickQ(tile);
    }
    if (await P.has(CdMain.serviceSearch)) {
      const v = await P.inputValue(CdMain.serviceSearch);
      if (v) await P.fillQ(CdMain.serviceSearch, '');
    }
    // The order total is written 500 ms after the last edit (use-order-total-sync.ts).
    await settle(700);
  }

  async orderCode(timeout: number = Timeouts.MEDIUM): Promise<string> {
    if (!(await this.waitFor(CdMain.orderHeading, timeout)))
      throw new Error('No "#OD…" order header on Home.');
    const m = ORDER_CODE.exec(await P.textOf(CdMain.orderHeading));
    if (!m) throw new Error('Order header did not carry an OD code.');
    return m[0];
  }

  /** Quick Checkout → staff → services. Stays on Home. Returns the order code. */
  async createOrder(opts: { staff?: string; services?: string[] } = {}): Promise<string> {
    assertWritesAllowed('create an order (volt-qc CD/E2E)');
    const d = await this.testData();
    await this.quickCheckout();
    await this.pickStaff(opts.staff ?? d.staff);
    const code = await this.orderCode();
    for (const s of opts.services ?? [d.service]) await this.addService(s);
    return code;
  }

  /** Subtotal / Promotion / Tax / Total of the Home order panel (cents; NaN when absent). */
  async orderTotals(): Promise<{ subtotal: number; promotion: number; tax: number; total: number }> {
    const t = await this.text('main');
    const tax = moneyField(t, 'Tax');
    return {
      subtotal: moneyField(t, 'Subtotal'),
      promotion: moneyField(t, 'Promotion'),
      tax: Number.isFinite(tax) ? tax : 0,
      total: moneyField(t, 'Total'),
    };
  }

  itemRowCount(name: string): Promise<number> {
    return P.count(CdMain.itemRow(name));
  }

  itemRowText(name: string): Promise<string> {
    return P.textOf(CdMain.itemRow(name));
  }

  async removeItem(name: string): Promise<void> {
    await P.clickQ(CdMain.itemRowRemove(name));
    await this.passcodeIfAsked(1_500);
    await P.clickQ([CdMain.removeServiceDialog, { role: 'button', name: 'Remove', nth: 0 }]);
    await this.waitGone(CdMain.removeServiceDialog);
    await settle(700);
  }

  /** Change Staff on the first staff block → `to` → confirm "Change from X to Y?". */
  async changeStaff(to: string): Promise<void> {
    await P.clickQ([{ css: 'main' }, { role: 'button', name: 'Change Staff', nth: 0 }]);
    await P.waitFor([{ css: 'main' }, { textRe: '^Change from', nth: 0 }], Timeouts.SHORT, 'Change from');
    await P.clickQ({ css: CdMain.staffNameCss, text: to, nth: 0 });
    const dlg: VqcQuery = { role: 'dialog', hasTextRe: `to ${escapeRe(to)}\\?`, nth: -1 };
    await P.clickQ([dlg, { role: 'button', name: 'Confirm', nth: 0 }], Timeouts.MEDIUM);
    await this.passcodeIfAsked(1_500);
    await this.waitGone(dlg);
    await settle(700);
  }

  /** Order History detail → Adjust Tip → digits (cents) → Save (+ passcode). */
  async adjustTip(cents: string): Promise<void> {
    await P.clickQ(CdMain.adjustTip);
    await this.passcodeIfAsked(2_000);
    if (!(await this.waitFor(CdMain.adjustTipDialog, Timeouts.SHORT))) {
      // Multi-tender orders open a tender picker first: take the first tender.
      await P.clickQ([
        { role: 'dialog', nth: -1 },
        { role: 'button', nth: 0 },
      ]);
      await P.waitFor(CdMain.adjustTipDialog, Timeouts.SHORT, 'Adjust Tip keypad');
    }
    for (const c of cents) await P.clickQ([CdMain.adjustTipDialog, { role: 'button', name: c, nth: 0 }]);
    await P.clickQ([CdMain.adjustTipDialog, { role: 'button', name: 'Save', nth: 0 }]);
    await this.passcodeIfAsked(2_500);
    await this.waitGone(CdMain.adjustTipDialog);
    await settle(1_500);
  }

  /** Remove → (passcode) → Delete. */
  async deleteCurrentOrder(): Promise<void> {
    await P.clickQ([{ css: 'main' }, { role: 'button', name: 'Remove', nth: 0 }]);
    await this.passcodeIfAsked(3_000);
    await P.clickQ([CdMain.deleteOrderDialog, { role: 'button', name: 'Delete', nth: 0 }]);
    await this.passcodeIfAsked(1_500);
    await this.waitGone(CdMain.deleteOrderDialog);
  }

  /** Best-effort clean-up: open the order and delete it; never throws. */
  async deleteOrderQuietly(code: string | undefined): Promise<void> {
    if (!code) return;
    try {
      await this.closeStrayDialogs();
      await this.openPendingOrder(code);
      await this.deleteCurrentOrder();
    } catch {
      /* already paid / gone */
    }
  }

  private async typeOnMainKeypad(digits: string): Promise<void> {
    for (const c of digits) await P.clickQ(CdMain.keypadKey(c));
  }

  private async openCustomerField(): Promise<void> {
    if (await P.has(CdMain.customerInput)) await P.clickQ(CdMain.customerInput);
    else await P.clickQ(CdMain.customerFieldText);
    await P.waitFor(CdMain.customerInput, Timeouts.SHORT, 'customer phone box');
  }

  /** Keypad a phone into the customer box → Done → name → Save. */
  async attachNewCustomer(phone: string, name: string): Promise<void> {
    await this.openCustomerField();
    await this.typeOnMainKeypad(phone);
    await P.clickQ(CdMain.done);
    await P.waitFor(CdMain.newCustomerName, Timeouts.MEDIUM, 'quick-add customer dialog');
    await P.fillQ(CdMain.newCustomerName, name);
    await P.clickQ([CdMain.newCustomerDialog, { role: 'button', name: 'Save', nth: 0 }]);
    await P.waitFor(
      [{ css: 'main' }, { hasText: name, css: 'div', nth: 0 }],
      Timeouts.MEDIUM,
      `customer ${name} on the order`,
    );
    await settle(700);
  }

  /** Keypad an EXISTING customer's phone → Done; the customer display flips to "Is this your phone number?". */
  async attachExistingCustomer(phone: string): Promise<void> {
    await this.openCustomerField();
    await this.typeOnMainKeypad(phone);
    await P.clickQ(CdMain.done);
    await P.waitFor(
      [{ css: 'main' }, { text: masked(phone), nth: 0 }],
      Timeouts.MEDIUM,
      `${masked(phone)} on the order`,
    );
  }

  /** Customer presses Yes on "Is this your phone number?". */
  customerConfirmPhone(): Promise<void> {
    return cust.click(CdCustomer.yes, Timeouts.MEDIUM);
  }

  customerBoxText(): Promise<string> {
    return P.textOf(CdMain.customerBox);
  }

  /** "Point: N" on the order's customer chip (NaN when absent). */
  async customerPoints(): Promise<number> {
    const m = /Point:\s*([\d,]+)/.exec(await this.customerBoxText());
    return m?.[1] ? Number(m[1].replace(/,/g, '')) : NaN;
  }

  /** Red x on the customer chip → "Remove Customer Phone" → Remove. */
  async removeCustomer(): Promise<void> {
    await P.clickQ([
      { css: 'main' },
      { css: 'div.bg-turquoise-topaz-20', nth: 0 },
      { css: 'button', nth: -1 },
    ]);
    await P.clickQ([CdMain.removeCustomerDialog, { role: 'button', name: 'Remove', nth: 0 }]);
    await this.waitGone(CdMain.removeCustomerDialog);
    await P.poll(
      async () => (await P.has(CdMain.customerInput)) || P.has(CdMain.customerFieldText),
      Boolean,
      Timeouts.MEDIUM,
    );
  }

  /** Input value of the first hit. */
  value(chain: VqcChain): Promise<string> {
    return P.inputValue(chain);
  }

  /** Promo & Rewards → Custom Discount on → `%`/`$` tab → value; NOT applied. */
  async openCustomDiscount(kind: '%' | '$', value: number): Promise<void> {
    await P.clickQ(CdMain.promoRewards);
    await P.waitFor(CdMain.promoDialog, Timeouts.SHORT, 'Promo & Rewards dialog');
    const cb: readonly VqcQuery[] = [CdMain.promoDialog, { role: 'checkbox', nth: 0 }];
    if ((await P.attrOf(cb, 'aria-checked')) !== 'true' && (await P.attrOf(cb, 'data-state')) !== 'checked')
      await P.clickQ(cb);
    await P.clickQ([
      CdMain.promoDialog,
      { role: 'tab', name: kind === '%' ? 'Percentage %' : 'Amount $', nth: 0 },
    ]);
    await P.fillQ(
      [CdMain.promoDialog, { role: 'textbox', nth: 0 }],
      kind === '%' ? String(value) : String(Math.round(value * 100)),
    );
  }

  /** Owner / staff split inputs of "Order promotion discount setting" (opens the collapsible). */
  async promoSplitInputs(): Promise<{ owner: readonly VqcQuery[]; staff: readonly VqcQuery[] }> {
    const row = (label: string): readonly VqcQuery[] => [
      CdMain.promoDialog,
      { css: 'div.flex.items-center.justify-between', hasText: label, nth: -1 },
      { role: 'textbox', nth: 0 },
    ];
    const owner = row('Percent for owner');
    if (!(await P.has(owner)))
      await P.clickQ([CdMain.promoDialog, { text: 'Order promotion discount setting', nth: 0 }]);
    await P.waitFor(owner, Timeouts.SHORT, 'Percent for owner');
    return { owner, staff: row('Percent for staff') };
  }

  /** Apply in the open Promo & Rewards dialog (+ passcode), wait for it to close. */
  async applyPromo(): Promise<void> {
    await P.clickQ([CdMain.promoDialog, { role: 'button', name: 'Apply', nth: 0 }]);
    await this.passcodeIfAsked(2_000);
    await this.waitGone(CdMain.promoDialog);
    await settle(700);
  }

  /** Promo & Rewards → Custom Discount (`%` integer, `$` dollars) → Apply. */
  async customDiscount(kind: '%' | '$', value: number): Promise<void> {
    await P.clickQ(CdMain.promoRewards);
    await P.waitFor(CdMain.promoDialog, Timeouts.SHORT, 'Promo & Rewards dialog');
    const cb: readonly VqcQuery[] = [CdMain.promoDialog, { role: 'checkbox', nth: 0 }];
    if ((await P.attrOf(cb, 'aria-checked')) !== 'true' && (await P.attrOf(cb, 'data-state')) !== 'checked')
      await P.clickQ(cb);
    await P.clickQ([
      CdMain.promoDialog,
      { role: 'tab', name: kind === '%' ? 'Percentage %' : 'Amount $', nth: 0 },
    ]);
    await P.fillQ(
      [CdMain.promoDialog, { role: 'textbox', nth: 0 }],
      kind === '%' ? String(value) : String(Math.round(value * 100)),
    );
    await P.clickQ([CdMain.promoDialog, { role: 'button', name: 'Apply', nth: 0 }]);
    await this.passcodeIfAsked(2_000);
    await this.waitGone(CdMain.promoDialog);
    await settle(700);
  }

  /** Quick Pay tile → amount (cents) → optional name → Add. Needs a staff on the order. */
  async quickPay(cents: number, name = ''): Promise<void> {
    await P.clickQ(CdMain.quickPayTile);
    await P.waitFor(CdMain.quickPayDialog, Timeouts.SHORT, 'Quick Pay dialog');
    await P.fillQ([CdMain.quickPayDialog, { css: 'input', placeholder: '0.00', nth: 0 }], String(cents));
    if (name)
      await P.fillQ([CdMain.quickPayDialog, { css: 'input', placeholder: 'Service Name', nth: 0 }], name);
    const add: readonly VqcQuery[] = [CdMain.quickPayDialog, { role: 'button', name: 'Add', nth: 0 }];
    await P.clickQ(add);
    if (!(await this.waitGone(CdMain.quickPayDialog, 4_000))) await P.clickQ(add).catch(() => undefined);
    await this.waitGone(CdMain.quickPayDialog);
    await settle(700);
  }

  /** Line editor (click the row name) → price (cents) → Save. */
  async editItemPrice(name: string, cents: number): Promise<void> {
    await P.clickQ(CdMain.itemRowName(name));
    const dlg: VqcQuery = { role: 'dialog', hasText: name, hasCss: 'input', nth: -1 };
    await P.waitFor(dlg, Timeouts.SHORT, `editor for ${name}`);
    const reset: readonly VqcQuery[] = [dlg, { role: 'button', name: 'Reset amount', nth: 0 }];
    if (await P.has(reset)) await P.clickQ(reset);
    await P.fillQ([dlg, { role: 'textbox', nth: 0 }], String(cents));
    await this.saveItemDialog(dlg);
  }

  /** Line editor → Apply Discount → `%`/`$` → value → Save. */
  async itemDiscount(name: string, kind: '%' | '$', value: number): Promise<void> {
    await P.clickQ(CdMain.itemRowName(name));
    const dlg: VqcQuery = { role: 'dialog', hasText: name, hasCss: 'input', nth: -1 };
    await P.waitFor(dlg, Timeouts.SHORT, `editor for ${name}`);
    const sw: readonly VqcQuery[] = [dlg, { role: 'switch', nth: 0 }];
    if ((await P.attrOf(sw, 'aria-checked')) !== 'true') await P.clickQ(sw);
    await P.clickQ([dlg, { css: '[role="radio"]', name: kind, nth: 0 }]).catch(() =>
      P.clickQ([dlg, { role: 'button', name: kind, nth: 0 }]),
    );
    await P.fillQ(
      [dlg, { role: 'textbox', nth: 2 }],
      kind === '%' ? String(value) : String(Math.round(value * 100)),
    );
    await this.saveItemDialog(dlg);
  }

  /** Line editor → "Add note" → Save. */
  async addItemNote(name: string, note: string): Promise<void> {
    await P.clickQ(CdMain.itemRowName(name));
    const dlg: VqcQuery = { role: 'dialog', hasText: name, hasCss: 'input', nth: -1 };
    await P.waitFor(dlg, Timeouts.SHORT, `editor for ${name}`);
    await P.fillQ([dlg, { css: 'input,textarea', placeholder: 'Add note', nth: 0 }], note);
    await this.saveItemDialog(dlg);
  }

  private async saveItemDialog(dlg: VqcQuery): Promise<void> {
    await P.clickQ([dlg, { role: 'button', name: 'Save', nth: 0 }]);
    await this.passcodeIfAsked(1_500);
    await this.waitGone(dlg);
    await settle(700);
  }

  /** Open a pending order by code through the Pending Orders sidebar search. */
  async openPendingOrder(code: string): Promise<void> {
    await this.go(Routes.HOME);
    const box: readonly VqcQuery[] = [CdMain.pendingSidebar, { role: 'textbox', nth: 0 }];
    await P.fillQ(box, code);
    await P.clickQ([CdMain.pendingSidebar, { role: 'button', nameRe: `^${code}`, nth: 0 }], Timeouts.MEDIUM);
    await P.waitFor(
      [{ css: 'main' }, { text: `#${code}`, nth: 0 }],
      Timeouts.MEDIUM,
      `order #${code} on Home`,
    );
    await P.fillQ(box, '').catch(() => '');
  }

  /** Is `code` still a card in the Pending sidebar search? */
  async pendingHas(code: string, waitMs = 3_000): Promise<boolean> {
    await this.go(Routes.HOME);
    const box: readonly VqcQuery[] = [CdMain.pendingSidebar, { role: 'textbox', nth: 0 }];
    await P.fillQ(box, code);
    await settle(waitMs);
    const found = await P.has([CdMain.pendingSidebar, { role: 'button', nameRe: `^${code}`, nth: 0 }]);
    await P.fillQ(box, '').catch(() => '');
    return found;
  }

  /* --------------------------------------------------------------------- *
   * Checkout
   * --------------------------------------------------------------------- */

  async pay(): Promise<void> {
    await P.clickQ([{ css: 'main' }, CdMain.pay]);
    if (!(await this.waitPath(/\/checkout/, Timeouts.MEDIUM))) throw new Error('Pay did not open checkout.');
    await P.waitFor(CdMain.completePayment, Timeouts.MEDIUM, 'Complete Payment');
  }

  /** Amount printed on a tender button ("Other $30.90" → 3090). */
  async methodCents(m: PayMethod): Promise<number> {
    const txt = await P.textOf(CdMain.method(m));
    const mm = /-?\$[\d,]+\.\d{2}/.exec(txt);
    return mm ? parseMoney(mm[0]) : NaN;
  }

  async selectMethod(m: PayMethod): Promise<void> {
    await P.clickQ(CdMain.method(m));
    await settle(300);
  }

  async keypad(keys: string): Promise<void> {
    for (const k of keys) await P.clickQ([{ css: 'main' }, { role: 'button', name: k, nth: 0 }]);
  }

  async enteredCents(): Promise<number> {
    return moneyField(await this.text('main'), 'Enter Amount');
  }

  async totalPaidCents(): Promise<number> {
    return moneyField(await this.text('main'), 'Total Paid');
  }

  waitingTipShown(): Promise<boolean> {
    return P.has(CdMain.waitingDialog);
  }

  waitingTipText(): Promise<string> {
    return P.textOf(CdMain.waitingDialog);
  }

  /** Cancel on "Customer is adding a tip/signature." and wait for it to close. */
  async cancelWaitingTip(): Promise<void> {
    await P.clickQ([CdMain.waitingDialog, { role: 'button', name: 'Cancel', nth: 0 }]);
    await this.waitGone(CdMain.waitingDialog);
  }

  /**
   * Complete Payment (tender already chosen), answer the passcode, STOP once the
   * customer shows "Add a tip". false when the app went straight to success.
   */
  async completeUntilTipScreen(timeout = 30_000): Promise<boolean> {
    await P.clickQ(CdMain.completePayment);
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.passcodeShown()) {
        await this.passcodeIfAsked(Timeouts.ANIMATION);
        continue;
      }
      if (await this.waitingTipShown()) {
        if (await cust.waitFor(CdCustomer.addTip, 3_000)) return true;
      }
      if (/payment-success/.test(await P.path())) return false;
      await settle(400);
    }
    throw new Error('After Complete Payment the customer display never showed "Add a tip".');
  }

  /** Wait for /payment-success, answering the passcode; does NOT touch the tip screen. */
  async waitPaymentSuccess(timeout = 45_000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (/payment-success/.test(await P.path())) return;
      if (await this.passcodeShown()) {
        await this.passcodeIfAsked(Timeouts.ANIMATION);
        continue;
      }
      await settle(400);
    }
    throw new Error(
      `Never reached Payment Successful within ${String(timeout / 1000)}s (path ${await P.path()}).`,
    );
  }

  /** Answer passcode + the customer tip screen until /payment-success. */
  async driveToSuccess(tip: TipChoice = 'none', timeout = 45_000): Promise<void> {
    const deadline = Date.now() + timeout;
    let tipped = false;
    while (Date.now() < deadline) {
      if (/payment-success/.test(await P.path())) return;
      if (await this.passcodeShown()) {
        await this.passcodeIfAsked(Timeouts.ANIMATION);
        continue;
      }
      if (!tipped && (await this.waitingTipShown())) {
        if (await cust.waitFor(CdCustomer.addTip, 5_000)) {
          await cust.chooseTipAndContinue(tip);
          tipped = true;
          continue;
        }
      }
      await settle(300);
    }
    throw new Error(
      `Never reached Payment Successful within ${String(timeout / 1000)}s (path ${await P.path()}).`,
    );
  }

  async completePayment(tip: TipChoice = 'none'): Promise<void> {
    await P.clickQ(CdMain.completePayment);
    await this.driveToSuccess(tip);
  }

  /** "Payment Successful!" page dump. */
  async successText(): Promise<string> {
    if (!(await this.waitFor(CdMain.paymentSuccessful, 20_000)))
      throw new Error('"Payment Successful!" never showed.');
    return this.text('body');
  }

  async noReceipt(): Promise<void> {
    await P.clickQ(CdMain.noReceipt);
    await this.waitPath(/^(?!.*payment-success)/, Timeouts.MEDIUM);
  }

  /** Home order → Pay → tender → (cash keys) → Complete → success page dump. */
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
    await this.completePayment(opts.tip ?? 'none');
    return this.successText();
  }

  /** Create + pay a walk-in order; ends back on Home. Returns code and the tender amount. */
  async createPaidOrder(
    opts: { method?: 'Cash' | 'Other'; tip?: TipChoice } = {},
  ): Promise<{ code: string; total: number }> {
    const code = await this.createOrder();
    const m = opts.method ?? 'Cash';
    await this.pay();
    const total = await this.methodCents(m);
    await this.selectMethod(m);
    await this.completePayment(opts.tip ?? 'none');
    await this.successText();
    await this.noReceipt();
    return { code, total };
  }

  /** Checkout "Tip" → keypad dialog (cents) → Add. Does not push a tip screen to the customer. */
  async cashierTip(cents: string): Promise<void> {
    await P.clickQ(CdMain.tip);
    await this.passcodeIfAsked(1_500);
    await P.waitFor(CdMain.cashierTipDialog, Timeouts.SHORT, 'cashier tip dialog');
    for (const d of cents) await P.clickQ([CdMain.cashierTipDialog, { role: 'button', name: d, nth: 0 }]);
    await P.clickQ([CdMain.cashierTipDialog, { role: 'button', name: 'Add', nth: 0 }]);
    await this.waitGone(CdMain.cashierTipDialog);
  }

  /** Card: after the tip step, wait for "Present Card" and Close it WITHOUT a card. */
  async closePresentCard(timeout = 30_000): Promise<'present' | 'no-terminal'> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.passcodeShown()) {
        await this.passcodeIfAsked(Timeouts.ANIMATION);
        continue;
      }
      if (await P.has(CdMain.presentCardDialog)) {
        await P.clickQ([CdMain.presentCardDialog, { role: 'button', name: 'Close', nth: 0 }]);
        await this.waitGone(CdMain.presentCardDialog);
        return 'present';
      }
      if (await P.has({ textRe: 'terminal|not connected|No device', flags: 'i', nth: 0 }))
        return 'no-terminal';
      await settle(400);
    }
    throw new Error('Neither "Present Card" nor a missing-terminal message showed.');
  }

  /* --------------------------------------------------------------------- *
   * Split
   * --------------------------------------------------------------------- */

  /** Home: the orange Split button → /split-order. */
  async openSplit(): Promise<void> {
    await P.clickQ([{ css: 'main' }, { css: 'button.bg-orange', nth: 0 }]);
    await this.passcodeIfAsked(2_000);
    if (!(await this.waitPath(/split-order/, Timeouts.MEDIUM)))
      throw new Error('Split did not open /split-order.');
  }

  /** "Check N Paid Successfully" text, answering passcode + the customer tip screen meanwhile. */
  async waitCheckPaid(n: number, tip: 'none' | { customCents: string } = 'none'): Promise<string> {
    const paid: VqcQuery = { role: 'dialog', hasText: `Check ${String(n)} Paid Successfully`, nth: -1 };
    const deadline = Date.now() + 45_000;
    let tipped = false;
    while (Date.now() < deadline) {
      if (await P.has(paid)) return ((await P.rawText(paid)) ?? '').replace(/\s*\n+\s*/g, ' | ');
      if (await this.passcodeShown()) await this.passcodeIfAsked(Timeouts.ANIMATION);
      else if (!tipped && (await this.waitingTipShown()) && (await cust.waitFor(CdCustomer.addTip, 3_000))) {
        if (tip === 'none') await cust.chooseTipAndContinue('none');
        else await cust.customTip(tip.customCents);
        tipped = true;
      }
      await settle(400);
    }
    throw new Error(`"Check ${String(n)} Paid Successfully" never showed.`);
  }

  /** Pay check `n` on the split screen; returns the paid dialog text. Does not close it. */
  async splitPayCheck(
    n: number,
    method: 'Cash' | 'Other' | 'Gift Card',
    opts: { otherName?: string; giftCode?: string; tip?: 'none' | { customCents: string } } = {},
  ): Promise<string> {
    await P.clickQ([{ css: 'main' }, { text: `Check ${String(n)}`, nth: 0 }]);
    await P.clickQ([{ css: 'main' }, { role: 'button', name: method, nth: 0 }]);
    await P.clickQ([{ css: 'main' }, { role: 'button', nameRe: '^Pay', nth: 0 }]);
    await this.passcodeIfAsked(1_500);
    if (method === 'Cash') {
      await P.clickQ({ role: 'button', name: `Complete Check ${String(n)}`, nth: 0 }, Timeouts.MEDIUM);
    } else if (method === 'Other') {
      const dlg: VqcQuery = { role: 'dialog', hasText: 'Other Payment', nth: -1 };
      await P.fillQ(
        [dlg, { role: 'textbox', name: 'Input payment method name', nth: 0 }],
        opts.otherName ?? 'QC Other',
      );
      await P.clickQ([dlg, { role: 'button', nameRe: '^Pay \\$', nth: 0 }]);
    } else {
      if (!opts.giftCode) throw new Error('splitPayCheck(Gift Card) needs giftCode');
      const deadline = Date.now() + 40_000;
      let tipped = false;
      while (Date.now() < deadline && !(await P.has(CdMain.inputGiftCardCode))) {
        if (await this.passcodeShown()) await this.passcodeIfAsked(Timeouts.ANIMATION);
        else if (!tipped && (await this.waitingTipShown())) {
          await cust.chooseTipAndContinue('none');
          tipped = true;
        }
        await settle(400);
      }
      await P.clickQ(CdMain.inputGiftCardCode);
      await P.fillQ([CdMain.enterGiftCardDialog, { role: 'textbox', nth: 0 }], opts.giftCode);
      await P.clickQ([CdMain.enterGiftCardDialog, { role: 'button', name: 'Confirm', nth: 0 }]);
      const accepted: VqcQuery = { role: 'dialog', hasText: 'Gift Card Accepted', nth: -1 };
      if (!(await this.waitFor(accepted, Timeouts.MEDIUM)))
        throw new Error('Gift card not accepted on the split check.');
      await P.clickQ([accepted, { role: 'button', name: 'Pay', nth: 0 }]);
    }
    return this.waitCheckPaid(n, opts.tip ?? 'none');
  }

  /** Close the "Check N Paid" dialog (Continue Payment / Done). */
  async closeCheckPaid(): Promise<void> {
    await P.clickQ([
      { role: 'dialog', nth: -1 },
      { role: 'button', nameRe: '^(Continue Payment|Done)$', nth: 0 },
    ]);
    await settle(800);
  }

  /** "Complete Done" on the split screen → payment-success. */
  async splitCompleteDone(): Promise<void> {
    await P.clickQ([{ css: 'main' }, { role: 'button', nameRe: 'Complete Done|^Done$', nth: -1 }]);
    await this.driveToSuccess('none');
  }

  /* --------------------------------------------------------------------- *
   * Gift card
   * --------------------------------------------------------------------- */

  async openSellGiftCard(): Promise<void> {
    await P.clickQ(CdMain.giftCardTile);
    await P.waitFor(CdMain.sellGiftCardDialog, Timeouts.SHORT, 'Sell Gift Card dialog');
  }

  /** Read a card's balance (cents) in the Sell Gift Card dialog, saving nothing. */
  async giftCardBalance(code: string): Promise<number> {
    await this.quickCheckout();
    await this.openSellGiftCard();
    const dlg = CdMain.sellGiftCardDialog;
    await P.fillQ([dlg, { role: 'textbox', name: 'Enter gift card code', nth: 0 }], code);
    const bal: readonly VqcQuery[] = [dlg, { textRe: '^(\\w+ )?Balance: \\$', nth: 0 }];
    await P.waitFor(bal, Timeouts.MEDIUM, 'gift card balance');
    const m = /\$[\d,]+\.\d{2}/.exec(await P.textOf(bal));
    await P.clickQ([dlg, { role: 'button', name: 'Close', nth: 0 }]).catch(() => P.escape());
    return m ? parseMoney(m[0]) : NaN;
  }

  /** Add a gift-card line (code + preset) from the Sell Gift Card dialog. */
  async sellGiftCardLine(code: string, preset: '$25' | '$50' | '$100'): Promise<void> {
    await this.openSellGiftCard();
    const dlg = CdMain.sellGiftCardDialog;
    await P.fillQ([dlg, { role: 'textbox', name: 'Enter gift card code', nth: 0 }], code);
    await P.waitFor([dlg, { textRe: 'Balance: \\$', nth: 0 }], Timeouts.MEDIUM, 'gift card balance');
    await P.clickQ([dlg, { role: 'button', name: preset, nth: 0 }]);
    await P.clickQ([dlg, { role: 'button', name: 'Add', nth: 0 }]);
    await this.waitGone(dlg);
    await settle(700);
  }

  /** Checkout: Gift Card → Complete → (tip) → Input code → Confirm. Returns the verdict dialog text. */
  async payWithGiftCard(code: string): Promise<string> {
    await this.selectMethod('Gift Card');
    await P.clickQ(CdMain.completePayment);
    const deadline = Date.now() + 40_000;
    let tipped = false;
    while (Date.now() < deadline) {
      if (await this.passcodeShown()) {
        await this.passcodeIfAsked(Timeouts.ANIMATION);
        continue;
      }
      if (!tipped && (await this.waitingTipShown()) && (await cust.waitFor(CdCustomer.addTip, 3_000))) {
        await cust.chooseTipAndContinue('none');
        tipped = true;
        continue;
      }
      if (await P.has(CdMain.inputGiftCardCode)) break;
      await settle(200);
    }
    await P.clickQ(CdMain.inputGiftCardCode);
    await P.fillQ([CdMain.enterGiftCardDialog, { role: 'textbox', nth: 0 }], code);
    const confirm: readonly VqcQuery[] = [
      CdMain.enterGiftCardDialog,
      { role: 'button', name: 'Confirm', nth: 0 },
    ];
    if (await P.isDisabled(confirm).catch(() => true)) {
      await P.fillQ([CdMain.enterGiftCardDialog, { role: 'textbox', nth: 0 }], '');
      await P.typeQ([CdMain.enterGiftCardDialog, { role: 'textbox', nth: 0 }], code);
    }
    await P.clickQ(confirm);
    await P.waitFor(CdMain.giftCardVerdictDialog, Timeouts.MEDIUM, 'gift card verdict');
    return P.textOf(CdMain.giftCardVerdictDialog);
  }

  /** Press Pay on the accepted gift-card dialog. */
  async confirmGiftCardPay(): Promise<void> {
    await P.clickQ([CdMain.giftCardVerdictDialog, { role: 'button', name: 'Pay', nth: 0 }]);
  }

  /* --------------------------------------------------------------------- *
   * Order History
   * --------------------------------------------------------------------- */

  async openHistoryOrder(code: string): Promise<void> {
    if ((await P.path()).startsWith(Routes.ORDER_HISTORY)) await this.go(Routes.HOME, { passcode: false });
    await this.go(Routes.ORDER_HISTORY);
    await P.waitFor(CdMain.historySearch, Timeouts.MEDIUM, 'Order History search');
    await P.fillQ(CdMain.historySearch, code);
    const ok = await P.poll(
      async () => (await P.textOf(CdMain.historyLink)).replace(/\s/g, ''),
      (s) => s.includes(code),
      20_000,
    );
    if (!ok.includes(code)) throw new Error(`Order ${code} not found in Order History.`);
    await P.clickQ(CdMain.historyLink);
    await P.waitFor(
      [{ css: 'main' }, { hasText: `Order #${code}`, css: 'h1,h2,h3,p,span,div', nth: 0 }],
      Timeouts.MEDIUM,
      `Order #${code}`,
    );
    await P.closeToasts();
  }

  /** Is `code` listed in Order History (search, then read the rows)? */
  async historyHas(code: string): Promise<boolean> {
    await this.go(Routes.ORDER_HISTORY);
    await P.waitFor(CdMain.historySearch, Timeouts.MEDIUM, 'Order History search');
    await P.fillQ(CdMain.historySearch, code);
    await settle(3_000);
    const rows = await P.texts({ css: CdMain.historyLinks });
    return rows.some((r) => r.replace(/\s/g, '').includes(code));
  }

  /** Detail pane dump from "Order #code" on. */
  async historyDetail(code: string): Promise<string> {
    const t = await this.text('main');
    const i = t.indexOf(`Order #${code}`);
    return i >= 0 ? t.slice(i) : t;
  }

  async historyStatus(code: string): Promise<string> {
    return field(await this.historyDetail(code), 'Status');
  }

  /** Cancel Order → reason → Confirm Cancel (+ passcode). */
  async cancelOrder(reasonIndex = 0): Promise<void> {
    await P.clickQ(CdMain.cancelOrder);
    await this.passcodeIfAsked(2_000);
    await P.clickQ([CdMain.cancelDialog, { role: 'combobox', nth: 0 }]);
    await P.clickQ({ role: 'option', nth: reasonIndex });
    await P.clickQ([CdMain.cancelDialog, { role: 'button', name: 'Confirm Cancel', nth: 0 }]);
    await this.passcodeIfAsked(3_000);
    await this.waitGone(CdMain.cancelDialog);
  }

  /** Re-Open from history → Confirm → Edit Order → Home (`?editOrderId=`). */
  async reopenOrder(code: string, opts: { edit?: boolean } = {}): Promise<void> {
    await this.openHistoryOrder(code);
    await P.clickQ(CdMain.reopenOrder);
    await this.passcodeIfAsked(2_000);
    await P.clickQ([CdMain.reopenConfirmDialog, { role: 'button', name: 'Confirm', nth: 0 }]);
    await this.passcodeIfAsked(2_500);
    await this.waitPath(/\/checkout/, 20_000);
    if (opts.edit === false) return;
    await P.clickQ(CdMain.editOrder);
    await this.passcodeIfAsked(2_000);
    await this.waitPath(/\/home/, Timeouts.MEDIUM);
    await P.waitFor([{ css: 'main' }, { text: `#${code}`, nth: 0 }], Timeouts.MEDIUM, `#${code} in re-open`);
  }

  /** Finish a re-open without changes: (Pay from Home) → Re-Open Done → /order-history/<id>. */
  async reopenDone(): Promise<void> {
    if ((await P.path()).startsWith(Routes.HOME)) await P.clickQ([{ css: 'main' }, CdMain.pay]);
    await P.clickQ(CdMain.reopenDone, Timeouts.MEDIUM);
    await this.passcodeIfAsked(2_500);
    await this.driveToSuccess('none', 30_000).catch(() => undefined);
    if (/payment-success/.test(await P.path())) await this.noReceipt().catch(() => undefined);
    await this.waitPath(/\/order-history\//, 20_000);
  }

  /* --------------------------------------------------------------------- *
   * Reports
   * --------------------------------------------------------------------- */

  /** Open a report route through its owner-gated guard. */
  async openReport(route: string): Promise<void> {
    await this.go(route, { passcode: false });
    await passcodeDialog.enterIfPresent(env.OWNER_PASSCODE, { timeout: Timeouts.SHORT }).catch(() => false);
    await settle(1_000);
  }

  /**
   * The Daily Sale (today) row of `code` as `a | b | c`, polled until it shows
   * (the report ingests a new order after a sync round trip); null on timeout.
   */
  async dailySaleRow(code: string, timeout = 180_000): Promise<string | null> {
    await this.openReport(Routes.INCOME_DAILY);
    const deadline = Date.now() + timeout;
    const row: VqcQuery = { css: 'tr,[role="row"]', hasText: code, nth: 0 };
    while (Date.now() < deadline) {
      if (await P.has(row)) return ((await P.rawText(row)) ?? '').replace(/\s*[\t\n]+\s*/g, ' | ');
      const t = await this.text('main');
      const i = t.indexOf(code);
      if (i >= 0) return t.slice(i, i + 240);
      // The list is fetched on mount: re-enter through Home to refresh it.
      await settle(3_000);
      await this.go(Routes.HOME, { passcode: false });
      await this.openReport(Routes.INCOME_DAILY);
    }
    return null;
  }

  /** Staff Income (default range) lists `name`. */
  async staffIncomeLists(name: string): Promise<boolean> {
    await this.openReport(Routes.INCOME_STAFF);
    return this.waitFor([{ css: 'main' }, { text: name, nth: 0 }], Timeouts.LONG);
  }

  /* --------------------------------------------------------------------- *
   * App
   * --------------------------------------------------------------------- */

  /** Sidebar › Reload; waits until Home is usable again. */
  async reloadApp(): Promise<void> {
    await this.closeStrayDialogs();
    await appNav.pressReload();
    await waitUntilPath((p) => p.startsWith(Routes.HOME), {
      timeout: Timeouts.APP_BOOT,
      message: 'Reload did not land on /home',
    });
    await dismissUpdaterIfPresent();
    await homePage.waitForReady(Timeouts.APP_BOOT);
  }

  /** "volt-passcode-skip" (the 30-minute grant) is in localStorage. */
  async skipGrantActive(): Promise<boolean> {
    return (await P.localGet('volt-passcode-skip')) !== null;
  }

  async clearPasscodeSkip(): Promise<void> {
    await P.localSet('volt-passcode-skip', null);
  }

  /**
   * Try a gated route with `code`: 'denied' | 'allowed' | 'invalid' | 'inactive' | 'no-gate'.
   * Clears the 30-minute grant first so the guard really asks.
   */
  async tryGate(
    route: string,
    code: string,
  ): Promise<'allowed' | 'denied' | 'inactive' | 'invalid' | 'no-gate'> {
    await this.clearPasscodeSkip();
    await this.go(Routes.HOME, { passcode: false });
    await P.routerGo(route);
    if (!(await passcodeDialog.isPrompting(Timeouts.SHORT).catch(() => false))) return 'no-gate';
    await this.typeIntoPasscode(code);
    const body = await this.text('body');
    if (/This staff is inactive/.test(body)) return 'inactive';
    if (/Failed to verify staff code|Invalid staff code/.test(body)) return 'invalid';
    if (/You don't have permission to access this page/.test(body)) return 'denied';
    return 'allowed';
  }

  /** Fire a router navigation WITHOUT waiting (a leave guard keeps the promise pending). */
  async routerGoRaw(to: string): Promise<void> {
    await P.exec<null>(
      'var r = window.__TSR_ROUTER__; if (r) void r.navigate({ to: arguments[0] }); return null;',
      to,
    );
    await settle(500);
  }

  /** Press Escape in the main window. */
  escape(): Promise<void> {
    return P.escape();
  }

  /** Wait a fixed beat (named so the reason sits next to the call). */
  pause(ms: number): Promise<void> {
    return settle(ms);
  }
}

export const app = new CdApp();
export type { CdApp };
