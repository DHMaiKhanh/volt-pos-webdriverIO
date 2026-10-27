import { browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../components/index.js';
import {
  VqcCommon,
  VqcHome,
  VqcPending,
  btn,
  inMain,
  type VqcQuery,
} from '../../../constants/testids.voltqc-pos.js';
import {
  VqhCustomer,
  VqhDialog,
  VqhEditor,
  VqhOrder,
  VqhPendingPage,
  VqhSidebar,
  inDlg,
} from '../../../constants/testids.voltqc-home-pend.js';
import { payInCash, returnToHome } from '../../../flows/index.js';
import { step } from '../../../helpers/steps.js';
import { settle } from '../../../helpers/wait.js';
import { checkoutPage, orderPendingPage } from '../../index.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../support/passcodeGrant.js';
import { quickCheckout, serviceTiles, visibleStaffNames } from '../pos/homeProbe.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';

/**
 * Order-building helpers for the volt-qc HOME / PEND WRITE ports
 * (volt-qc `e2e/src/flows/home.ts`, `flows/pending.ts`, `pages/app.ts`).
 *
 * ## No hard-coded merchant data
 *
 * volt-qc pins `VOLT_TEST_STAFF=Pamela` / `VOLT_TEST_SERVICE=Express Pedicure`.
 * Here {@link discover} reads the first staff names and priced service tiles the
 * till renders, so the same specs run on any merchant; a case that needs two
 * staff / two services skips when the till has fewer.
 *
 * ## Cleanup
 *
 * Every order a helper creates is recorded in {@link created}. {@link cleanupOrders}
 * (call it in `afterEach`) reopens each one that is still in the pending sidebar
 * and deletes it, so a failed assertion never leaves a draft on the shared till.
 */

/* ------------------------------------------------------------------------- *
 * Small utilities
 * ------------------------------------------------------------------------- */

/** "$1,234.56" / "-$3.00" / "- $3.00" → 1234.56 / -3. NaN when there is no amount. */
export function money(text: string | null | undefined): number {
  const m = /(-?)\s*\$\s?([\d,]+\.\d{2})/.exec(text ?? '');
  if (!m) return NaN;
  const v = Number((m[2] ?? '').replace(/,/g, ''));
  return m[1] === '-' ? -v : v;
}

/** 25 → "$25.00", 1500 → "$1,500.00". */
export const fmt = (n: number): string =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const r2 = (n: number): number => Math.round(n * 100) / 100;

/** A 10-digit US-style phone the dev merchant will not already hold (832xxxxxxx). */
export function randomPhone(): string {
  let s = '832';
  for (let i = 0; i < 7; i += 1) s += String(Math.floor(Math.random() * 10));
  return s;
}

/** A letters-only unique name ("QC Anna Kxqz"). Customer names reject digits. */
export function uniqueName(prefix: string): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz';
  let tail = '';
  for (let i = 0; i < 6; i += 1) tail += abc[Math.floor(Math.random() * abc.length)] ?? 'a';
  return `${prefix} ${tail.charAt(0).toUpperCase()}${tail.slice(1)}`;
}

export const fmtPhone = (p: string): string => `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}`;
export const masked = (p: string): string => `***-***-${p.slice(-4)}`;

/** A 4-digit code that belongs to no staff (volt-qc found 0000 taken on merchant 14). */
export const unknownCode = (): string => (process.env.VOLT_UNKNOWN_CODE ?? '').trim() || '9137';
/** Code of an Inactive staff — optional, cases skip without it. */
export const inactiveCode = (): string => (process.env.VOLT_INACTIVE_CODE ?? '').trim();
/** Code of a staff whose role LACKS Delete Order — optional. */
export const noDeleteCode = (): string => (process.env.VOLT_NO_DELETE_ORDER_CODE ?? '').trim();
/** Code of a staff whose role LACKS View Phone Number — optional. */
export const noViewPhoneCode = (): string => (process.env.VOLT_NO_VIEW_PHONE_CODE ?? '').trim();
/** A gift card number usable for a SALE line (never charged here) — optional. */
export const testGiftCard = (): string => (process.env.VOLT_TEST_GIFT_CARD ?? '').trim();

/* ------------------------------------------------------------------------- *
 * Discovery
 * ------------------------------------------------------------------------- */

export interface TillData {
  staff: string[];
  /** Priced services currently rendered (name + catalogue price). */
  services: { name: string; price: number }[];
}

/** Staff names and priced service tiles on an empty order frame. Distinct names only. */
export async function discover(): Promise<TillData> {
  await quickCheckout();
  const staff = [...new Set(await P.poll(visibleStaffNames, (n) => n.length > 0, Timeouts.MEDIUM))];
  const seen = new Set<string>();
  const services: TillData['services'] = [];
  for (const s of await P.poll(serviceTiles, (t) => t.length > 0, Timeouts.MEDIUM)) {
    const price = money(s.price);
    if (s.name === '' || seen.has(s.name) || !(price > 0)) continue;
    seen.add(s.name);
    services.push({ name: s.name, price });
  }
  return { staff, services };
}

/* ------------------------------------------------------------------------- *
 * Order lifecycle
 * ------------------------------------------------------------------------- */

/** Order codes created by the running spec. */
export const created = new Set<string>();

/** The `OD……-n` code in the order frame header ('' when the frame is empty). */
export async function currentOrderId(): Promise<string> {
  const t = await P.textOf(VqcHome.orderHeading);
  return /OD\d{6}-\d+/.exec(t)?.[0] ?? '';
}

export async function waitOrderId(timeout = 15_000): Promise<string> {
  const id = await P.poll(currentOrderId, (v) => v !== '', timeout);
  if (!id) throw new Error('No "#OD…" order header appeared — selecting the staff did not open an order.');
  return id;
}

/** Names of the staff blocks in the order frame (each has a Change Staff button). */
export async function orderStaffNames(): Promise<string[]> {
  return P.exec<string[]>(`
    return Array.prototype.filter.call(document.querySelectorAll('main button'), function (b) {
      return (b.textContent || '').trim() === 'Change Staff' && b.getClientRects().length > 0;
    }).map(function (b) {
      return String((b.parentElement && b.parentElement.innerText) || '').replace('Change Staff', '').replace(/\\s+/g, ' ').trim();
    });
  `);
}

/** Click a staff tile on the grid (not the sidebar) and wait for the order frame to follow. */
export async function pickStaff(name: string): Promise<void> {
  const before = (await orderStaffNames()).length;
  if (!(await P.has(VqhOrder.staffTile(name)))) {
    await P.fillQ(VqcHome.staffSearch, name);
    await settle(500);
  }
  await P.jsClickQ(VqhOrder.staffTile(name)).catch(() => P.clickQ(VqhOrder.staffTile(name)));
  await P.poll(
    async () => (await orderStaffNames()).length,
    (n) => n > before,
    1_500,
  );
  if ((await P.inputValue(VqcHome.staffSearch).catch(() => '')) !== '')
    await P.fillQ(VqcHome.staffSearch, '');
  await settle(300);
}

export interface OrderLine {
  name: string;
  priceText: string;
  price: number;
  note: string;
  /** "10% OFF -$3.00", '' when the line has no discount. */
  discount: string;
}

/** Every order line of the frame, in render order (volt-qc `orderLines`). */
export async function orderLines(): Promise<OrderLine[]> {
  const rows = await P.exec<Omit<OrderLine, 'price'>[]>(`
    return Array.prototype.map.call(document.querySelectorAll('main div.pr-11'), function (row) {
      var t = function (sel) { var e = row.querySelector(sel); return e ? (e.textContent || '').trim() : ''; };
      var disc = row.querySelector('[aria-label="Discount"]');
      var d = '';
      if (disc) {
        d = disc.children.length
          ? Array.prototype.map.call(disc.children, function (c) { return (c.textContent || '').trim(); }).join(' ')
          : (disc.textContent || '');
        d = d.replace(/\\s+/g, ' ').trim();
      }
      return { name: t('span.truncate'), priceText: t('span.text-right'), note: t('span.truncate.text-sm'), discount: d };
    });
  `);
  return rows.map((r) => ({ ...r, price: money(r.priceText) }));
}

export async function lineCount(name: string): Promise<number> {
  return (await orderLines()).filter((l) => l.name === name).length;
}

/** Click a service tile and wait for its line to appear (one retry, like volt-qc `addService`). */
export async function addService(name: string): Promise<void> {
  const before = await lineCount(name);
  if (!(await P.has(VqhOrder.serviceTile(name)))) {
    await P.fillQ(VqcHome.serviceSearch, name);
    await settle(600);
  }
  await P.clickQ(VqhOrder.serviceTile(name));
  let n = await P.poll(
    () => lineCount(name),
    (c) => c > before,
    3_000,
  );
  if (n <= before && !(await P.has(VqhOrder.selectStaffFirst))) {
    await P.clickQ(VqhOrder.serviceTile(name));
    n = await P.poll(
      () => lineCount(name),
      (c) => c > before,
      3_000,
    );
  }
  if ((await P.inputValue(VqcHome.serviceSearch).catch(() => '')) !== '')
    await P.fillQ(VqcHome.serviceSearch, '');
  // The order total is written ~500 ms after an edit (volt-qc bug #44) — leave room before navigating.
  await settle(700);
}

/** Quick Checkout → staff → (services). Records and returns the order code. */
export async function createOrder(staff: string, services: string[] = []): Promise<string> {
  assertWritesAllowed('create an order');
  return step(`Create order (${staff}${services.length ? ` + ${services.join(', ')}` : ''})`, async () => {
    await quickCheckout();
    await pickStaff(staff);
    const id = await waitOrderId();
    created.add(id);
    for (const s of services) await addService(s);
    return id;
  });
}

export interface Summary {
  subtotal: number | null;
  itemDiscount: number | null;
  promotion: number | null;
  rewardRedemption: number | null;
  tax: number | null;
  total: number | null;
}

/** The totals block of the order frame (null = row not rendered). Item Discount is negative. */
export async function summary(): Promise<Summary> {
  const t = await P.pageText('main');
  const pick = (label: string): number | null => {
    const m = new RegExp(`\\| ${label} \\| (-?\\s*\\$[\\d,.]+)`).exec(t);
    return m ? money(m[1]) : null;
  };
  return {
    subtotal: pick('Subtotal'),
    itemDiscount: pick('Item Discount'),
    promotion: pick('Promotion'),
    rewardRedemption: pick('Reward Redemption'),
    tax: pick('Tax'),
    total: pick('Total'),
  };
}

export async function payEnabled(): Promise<boolean> {
  return !(await P.isDisabled(VqhOrder.pay));
}

/** Open a pending order from the Home sidebar and wait for its header. */
export async function openPendingOrder(id: string): Promise<void> {
  await returnToHome();
  await P.fillQ(VqhSidebar.search, id);
  await P.clickQ(VqhSidebar.card(id), 15_000);
  await P.poll(currentOrderId, (v) => v === id, 15_000);
  await P.fillQ(VqhSidebar.search, '').catch(() => undefined);
  if ((await currentOrderId()) !== id) throw new Error(`Opening ${id} from the sidebar did not load it.`);
}

/** Is a card for `id` in the Home sidebar (searched)? */
export async function sidebarHas(id: string, timeout = 10_000): Promise<boolean> {
  await P.fillQ(VqhSidebar.search, id);
  const ok = await P.poll(
    () => P.has(VqhSidebar.card(id)),
    (v) => v,
    timeout,
  );
  return ok;
}

/** Sidebar badge (the number beside "Pending Orders"). */
export async function sidebarBadge(): Promise<number> {
  const t = await P.textOf(VqhSidebar.header);
  const m = /Pending Orders\s*(\d+)/.exec(t) ?? /(\d+)\s*$/.exec(t);
  return Number(m?.[1] ?? NaN);
}

/** Text of the sidebar card for `id` (search must already narrow to it). */
export async function sidebarCardText(id: string): Promise<string> {
  return ((await P.rawText(VqhSidebar.card(id))) ?? '').replace(/\s*\n+\s*/g, ' | ');
}

/* ------------------------------------------------------------------------- *
 * Passcode
 * ------------------------------------------------------------------------- */

/** Drop the run's 30-minute grant so the next gated action prompts. */
export async function dropGrant(): Promise<void> {
  await clearPasscodeGrant();
  await P.localSet('volt-passcode-skip', null);
}

/** Re-arm the grant afterwards (best effort). */
export async function restoreGrant(): Promise<void> {
  await ensurePasscodeGrant().catch(() => false);
}

export async function passcodeShown(timeout = 8_000): Promise<boolean> {
  return P.poll(
    () => P.has([VqcCommon.passcodeDialog, btn('1', 0)]),
    (v) => v,
    timeout,
  );
}

export async function passcodeTitle(): Promise<string> {
  return P.textOf([VqcCommon.passcodeDialog, { role: 'heading', nth: 0 }]);
}

/** Type a code on the open passcode keypad; returns whether it is still open + its text. */
export async function typeCode(
  code: string,
  opts: { skip30?: boolean } = {},
): Promise<{ open: boolean; text: string }> {
  if (!(await passcodeShown())) throw new Error('typeCode(): no passcode dialog is open');
  if (opts.skip30) await P.clickQ([VqcCommon.passcodeDialog, { role: 'checkbox', nth: 0 }]);
  for (const c of code) await P.clickQ([VqcCommon.passcodeDialog, btn(c, 0)]);
  await settle(1_500);
  const open = await P.has(VqcCommon.passcodeDialog);
  const text = open ? ((await P.rawText(VqcCommon.passcodeDialog)) ?? '').replace(/\s*\n+\s*/g, ' | ') : '';
  return { open, text };
}

export async function closePasscode(): Promise<void> {
  if (!(await P.has(VqcCommon.passcodeDialog))) return;
  await P.escape();
  await P.waitGoneQ(VqcCommon.passcodeDialog, 5_000, 'passcode dialog');
}

/* ------------------------------------------------------------------------- *
 * Deleting
 * ------------------------------------------------------------------------- */

/** Remove → (passcode) → Delete Order → Delete, for the order on screen. */
export async function deleteCurrentOrder(): Promise<void> {
  const id = await currentOrderId();
  await P.clickQ(VqhOrder.remove);
  await passcodeDialog.unlockForRun(env.STAFF_PASSCODE, { timeout: 3_000 });
  await P.clickQ(inDlg(VqhDialog.deleteOrder, btn('Delete', 0)));
  await P.waitGoneQ(VqhDialog.deleteOrder, Timeouts.MEDIUM, 'Delete Order dialog');
  if (id) created.delete(id);
  await settle(500);
}

/** Close any dialog a failed step left up (customer dialogs ignore Escape). */
export async function closeStrayDialogs(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    if (await P.has(VqcCommon.passcodeDialog)) {
      await P.escape();
      continue;
    }
    const hdr = { css: VqhDialog.headerCloseCss, nth: -1 } as VqcQuery;
    if (await P.has([{ css: '[role="dialog"]', nth: -1 }, hdr])) {
      await P.clickQ([{ css: '[role="dialog"]', nth: -1 }, hdr]).catch(() => undefined);
      await settle(400);
      continue;
    }
    if (await P.has({ css: '[role="dialog"],[role="alertdialog"]' })) {
      const cancel = [
        { css: '[role="dialog"],[role="alertdialog"]', nth: -1 },
        btn('Cancel', 0),
      ] as readonly VqcQuery[];
      if (await P.has(cancel)) await P.clickQ(cancel).catch(() => undefined);
      else await P.escape();
      await settle(300);
      continue;
    }
    break;
  }
}

/** Delete every order this spec created that is still pending. Never touches anyone else's. */
export async function cleanupOrders(): Promise<void> {
  await closeStrayDialogs().catch(() => undefined);
  for (const id of [...created]) {
    try {
      await returnToHome();
      await P.fillQ(VqhSidebar.search, id);
      const pending = await P.poll(
        () => P.has(VqhSidebar.card(id)),
        (v) => v,
        1_500,
      );
      if (pending) {
        await P.clickQ(VqhSidebar.card(id));
        await P.poll(currentOrderId, (v) => v === id, 10_000);
        if ((await currentOrderId()) === id && (await P.has(VqhOrder.remove))) await deleteCurrentOrder();
      }
      await P.fillQ(VqhSidebar.search, '').catch(() => undefined);
    } catch {
      // best effort — a paid / merged / foreign order is simply not ours to delete
    }
    created.delete(id);
  }
}

/* ------------------------------------------------------------------------- *
 * Lines: remove / edit / Quick Pay
 * ------------------------------------------------------------------------- */

/** The red trash on the `nth` line named `name`. */
export async function clickRemoveLine(name: string, nth = 0): Promise<void> {
  const ok = await P.exec<boolean>(
    `
    var name = arguments[0], nth = arguments[1];
    var rows = Array.prototype.filter.call(document.querySelectorAll('main div.pr-11'), function (r) {
      var s = r.querySelector('span.truncate'); return !!s && (s.textContent || '').trim() === name;
    });
    var row = rows[nth];
    var b = row && row.querySelector('button.text-destructive');
    if (!b) return false;
    b.setAttribute('data-vqh-rm', '1');
    return true;
  `,
    name,
    nth,
  );
  if (!ok) throw new Error(`No remove button on order line "${name}" #${String(nth)}`);
  await P.clickQ({ css: '[data-vqh-rm="1"]' });
  await P.exec<null>(
    'var e = document.querySelector("[data-vqh-rm]"); if (e) e.removeAttribute("data-vqh-rm"); return null;',
  );
}

export async function removeLine(name: string, nth = 0): Promise<void> {
  await clickRemoveLine(name, nth);
  await P.clickQ(inDlg(VqhDialog.removeService, btn('Remove', 0)));
  await P.waitGoneQ(VqhDialog.removeService, Timeouts.MEDIUM, 'Remove Service Item');
  await settle(700);
}

/** Click a line to open its editor (Quick Pay dialog for a Quick Pay line). */
export async function openLine(name: string, nth = 0): Promise<void> {
  await P.clickQ(VqhOrder.line(name, nth));
  await P.waitFor(VqhDialog.editor, Timeouts.MEDIUM, `editor for "${name}"`);
}

export const ed = (q: VqcQuery): readonly VqcQuery[] => inDlg(VqhDialog.editor, q);
export const qp = (q: VqcQuery): readonly VqcQuery[] => inDlg(VqhDialog.quickPay, q);

export async function editorAmount(): Promise<string> {
  return P.inputValue(ed(VqhEditor.amount));
}

/** Type cents into the open editor's amount ("2500" → $25.00), clearing it first. */
export async function setEditorAmount(cents: string): Promise<void> {
  if (await P.has(ed(VqhEditor.reset))) await P.clickQ(ed(VqhEditor.reset));
  await P.fillQ(ed(VqhEditor.amount), cents);
}

export async function switchOn(): Promise<boolean> {
  return (await P.attrOf(ed(VqhEditor.switch), 'aria-checked')) === 'true';
}

export async function radioPressed(k: '%' | '$'): Promise<boolean> {
  const i = await P.info(ed(VqhEditor.radio(k)));
  if (!i) return false;
  return (
    i.attrs['aria-checked'] === 'true' || i.attrs['data-state'] === 'on' || i.attrs['aria-pressed'] === 'true'
  );
}

/** Apply Discount on, pick % / $, type the value (% whole number; $ in cents). */
export async function setDiscount(kind: '%' | '$', typed: string): Promise<void> {
  if (!(await switchOn())) await P.clickQ(ed(VqhEditor.switch));
  await P.clickQ(ed(VqhEditor.radio(kind)));
  await P.fillQ(ed(VqhEditor.discount), typed);
}

export async function closeEditor(): Promise<void> {
  if (!(await P.has(VqhDialog.editor))) return;
  await P.clickQ(ed(VqhEditor.close));
  await P.waitGoneQ(VqhDialog.editor, Timeouts.SHORT, 'editor dialog');
}

export interface ItemEdit {
  cents?: string;
  note?: string;
  discount?: { kind: '%' | '$'; typed: string };
}

/** Open a line, change it, Save (or Update for Quick Pay). */
export async function editItem(name: string, o: ItemEdit, nth = 0): Promise<void> {
  await openLine(name, nth);
  if (o.cents !== undefined) await setEditorAmount(o.cents);
  if (o.note !== undefined) await P.fillQ(ed(VqhEditor.note), o.note);
  if (o.discount) await setDiscount(o.discount.kind, o.discount.typed);
  const save = (await P.has(ed(VqhEditor.save))) ? VqhEditor.save : VqhEditor.update;
  await P.clickQ(ed(save));
  await P.waitGoneQ(VqhDialog.editor, Timeouts.MEDIUM, 'editor dialog');
  await settle(700);
}

/** Quick Pay tile → (passcode gate VP-3115) → wait for the dialog. */
export async function openQuickPay(): Promise<void> {
  await P.clickQ(VqcHome.quickPayTile);
  await passcodeDialog.unlockForRun(env.STAFF_PASSCODE, { timeout: 2_000 });
  await P.waitFor(VqhDialog.quickPay, Timeouts.MEDIUM, 'Quick Pay dialog');
}

export interface QuickPayOpts {
  cents: number | string;
  name?: string;
  note?: string;
  discount?: { kind: '%' | '$'; typed: string };
}

/** Add one Quick Pay line to the open order. */
export async function quickPay(o: QuickPayOpts): Promise<void> {
  await openQuickPay();
  await P.fillQ(qp(VqhEditor.amount), String(o.cents));
  if (o.name !== undefined) await P.fillQ(qp(VqhEditor.serviceName), o.name);
  if (o.note) await P.fillQ(qp(VqhEditor.note), o.note);
  if (o.discount) await setDiscount(o.discount.kind, o.discount.typed);
  await P.clickQ(qp(VqhEditor.add));
  const stillOpen = await P.poll(
    () => P.has(VqhDialog.quickPay),
    (v) => !v,
    4_000,
  );
  if (stillOpen) await P.clickQ(qp(VqhEditor.add)).catch(() => undefined);
  await P.waitGoneQ(VqhDialog.quickPay, 10_000, 'Quick Pay dialog');
  await settle(700);
}

/** New order (staff) with Quick Pay lines only. */
export async function quickPayOrder(staff: string, lines: QuickPayOpts[]): Promise<string> {
  const id = await createOrder(staff);
  for (const l of lines) await quickPay(l);
  return id;
}

/* ------------------------------------------------------------------------- *
 * Customer
 * ------------------------------------------------------------------------- */

/** Press keys on the centre customer keypad (C first so a stale value is cleared). */
export async function typeCustomerPhone(phone: string): Promise<void> {
  if (!(await P.has(VqcHome.customerInput)) && (await P.has(VqhOrder.customerSlot))) {
    await P.clickQ(VqhOrder.customerSlot);
    await P.waitFor(VqcHome.customerInput, Timeouts.SHORT, 'customer input');
  }
  await P.clickQ(VqcHome.keypadKey('C'));
  for (const k of phone) await P.clickQ(VqcHome.keypadKey(k));
  await settle(200);
}

/** If the "Link with pending order?" prompt comes up, keep orders apart (never touch someone else's). */
export async function dismissLinkPrompt(): Promise<void> {
  if (
    await P.poll(
      () => P.has(VqhDialog.linkPending),
      (v) => v,
      2_500,
    )
  ) {
    await P.clickQ(inDlg(VqhDialog.linkPending, btn('Create Separately', 0)));
  }
}

/** Keypad phone → Done → quick-add name → Save. Leaves the customer on the open order. */
export async function attachNewCustomer(phone: string, name: string): Promise<void> {
  await typeCustomerPhone(phone);
  await P.clickQ(VqcHome.doneButton);
  await P.waitFor(VqhDialog.quickAdd, Timeouts.MEDIUM, 'quick-add dialog');
  await P.fillQ(inDlg(VqhDialog.quickAdd, VqhCustomer.nameBox), name);
  await P.clickQ(inDlg(VqhDialog.quickAdd, btn('Save', 0)));
  await P.waitGoneQ(VqhDialog.quickAdd, Timeouts.MEDIUM, 'quick-add dialog');
  await P.poll(
    () => P.textOf(VqhCustomer.bar),
    (t) => t.includes(name),
    10_000,
  );
  await settle(500);
}

/** Create a customer through a throw-away order, then delete that order. */
export async function seedCustomer(staff: string, name: string, phone: string): Promise<void> {
  await createOrder(staff);
  await attachNewCustomer(phone, name);
  await closeStrayDialogs();
  await deleteCurrentOrder();
}

export async function closeCustomerDialog(): Promise<void> {
  const top = [
    { css: '[role="dialog"]', hasCss: '[data-slot="dialog-header"]', nth: -1 },
    { css: VqhDialog.headerCloseCss, nth: -1 },
  ] as readonly VqcQuery[];
  if (await P.has(top)) await P.clickQ(top);
  await settle(400);
}

/* ------------------------------------------------------------------------- *
 * Checkout
 * ------------------------------------------------------------------------- */

/** Press Pay; returns the order uuid once on checkout. */
export async function pressPay(): Promise<string> {
  await P.clickQ(VqhOrder.pay);
  await P.poll(
    () => P.path(),
    (p) => /\/order\/[^/]+\/checkout/.test(p),
    15_000,
  );
  await checkoutPage.waitForReady(Timeouts.MEDIUM);
  return checkoutPage.orderId();
}

/** "Enter Amount" on the checkout keypad. */
export async function enteredAmount(): Promise<number> {
  const t = await P.pageText('main');
  return money(/Enter Amount \| (\$[\d,.]+)/.exec(t)?.[1]);
}

/** Amount printed on a tender button ("Cash $33.00"). */
export async function tenderAmount(method: 'Card' | 'Cash' | 'Other' | 'Gift Card'): Promise<number> {
  return money(await P.textOf(inMain({ role: 'button', nameRe: `^${method} \\$`, nth: 0 })));
}

export async function selectTender(method: 'Card' | 'Cash' | 'Other' | 'Gift Card'): Promise<void> {
  await P.clickQ(inMain({ role: 'button', nameRe: `^${method} \\$`, nth: 0 }));
  await settle(300);
}

/** Leave checkout back to the Home order ("Open sidebar" in the checkout header). */
export async function backToHome(id: string): Promise<void> {
  if (await P.has(btn('Open sidebar', 0))) {
    await P.clickQ(btn('Open sidebar', 0));
    await P.poll(
      () => P.path(),
      (p) => p.startsWith('/home'),
      6_000,
    );
  }
  if (!(await P.path()).startsWith('/home')) await returnToHome();
  if ((await currentOrderId()) !== id) await openPendingOrder(id);
}

/** Pay the open order in cash (exact), land back on Home. */
export async function payCurrentInCash(): Promise<string> {
  const id = await currentOrderId();
  const uuid = await pressPay();
  await payInCash(uuid);
  if (id) created.delete(id);
  await returnToHome();
  return uuid;
}

/* ------------------------------------------------------------------------- *
 * /order-pending page
 * ------------------------------------------------------------------------- */

export async function gotoPendingPage(): Promise<void> {
  if (!(await orderPendingPage.isActive())) await orderPendingPage.open();
  await P.waitFor(VqcPending.dateRange, 15_000, 'pending date range');
  await settle(300);
}

export async function searchPending(text: string): Promise<void> {
  await P.fillQ(VqcPending.searchBox, text);
  await settle(400);
}

export async function pendingCardText(id: string): Promise<string> {
  return ((await P.rawText(VqhPendingPage.card(id))) ?? '').replace(/\s*\n+\s*/g, ' | ');
}

export async function pendingHas(id: string, timeout = 10_000): Promise<boolean> {
  return P.poll(
    () => P.has(VqhPendingPage.card(id)),
    (v) => v,
    timeout,
  );
}

export async function openFromPendingPage(id: string): Promise<void> {
  await gotoPendingPage();
  await searchPending(id);
  await P.clickQ(VqhPendingPage.card(id), 15_000);
  await P.poll(currentOrderId, (v) => v === id, 15_000);
}

/** Header "Pending Orders" button (aria-label "Open pending orders"). */
export async function headerPending(): Promise<void> {
  await P.clickQ(VqcCommon.headerOpenPending);
  await P.poll(
    () => P.path(),
    (p) => p.startsWith('/order-pending'),
    15_000,
  );
}

export async function staffFilterBadge(): Promise<number | null> {
  const t = (await P.textOf(VqcPending.staffButton)).replace(/\D+/g, ' ').trim();
  return t ? Number(t.split(' ').pop()) : null;
}

async function checked(chain: readonly VqcQuery[]): Promise<boolean> {
  const i = await P.info(chain);
  return i?.attrs['aria-checked'] === 'true' || i?.attrs['data-state'] === 'checked';
}

export async function openStaffPopover(): Promise<void> {
  if (!(await P.has(VqhPendingPage.staffPopover))) await P.clickQ(VqcPending.staffButton);
  await P.waitFor(VqhPendingPage.staffPopover, Timeouts.SHORT, 'staff popover');
}

export const allChecked = (): Promise<boolean> => checked(VqhPendingPage.staffCheckbox('All'));

/** null = All; [] = nobody; names = only those. Closes the popover. */
export async function staffFilter(names: string[] | null): Promise<void> {
  await openStaffPopover();
  const all = VqhPendingPage.staffCheckbox('All');
  if (names === null) {
    if (!(await allChecked())) await P.clickQ(all);
  } else {
    if (!(await allChecked())) await P.clickQ(all);
    await P.clickQ(all);
    for (const n of names) await P.clickQ(VqhPendingPage.staffCheckbox(n));
  }
  await settle(400);
  await P.escape();
  await settle(400);
}

/** Pending-page sort combobox → Latest / Oldest. */
export async function sortBy(label: 'Latest' | 'Oldest'): Promise<void> {
  await P.clickQ(VqcPending.sortCombo);
  await P.clickQ({ role: 'option', name: label, nth: 0 });
  await settle(400);
}

/* ------------------------------------------------------------------------- *
 * Misc
 * ------------------------------------------------------------------------- */

/** The browser's current URL (Tauri asset origin + path + search). */
export async function url(): Promise<string> {
  return browser.getUrl();
}
