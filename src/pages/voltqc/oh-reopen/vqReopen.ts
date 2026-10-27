import { browser } from '@wdio/globals';
import { giftCard } from '../../../data/index.js';
import { btn, inMain, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsHistory, VqpsHome } from '../../../constants/testids.voltqc-promo-split.js';
import { OhRoText as T } from '../../../constants/testids.voltqc-oh-reopen.js';
import { settle } from '../../../helpers/wait.js';
import { openDaily, dailyRows, type DailyRow } from '../reports-time/rptReports.js';
import { attachExistingCustomer, checkoutCustomerStats } from '../promo-split/promoFlows.js';
import {
  closePaidDialog,
  completeDone,
  drivePaid,
  methodButton as splitMethodButton,
  openSplit,
  payButton as splitPayButton,
  selectCheck,
  settleSplit,
  type CheckMethod,
} from '../promo-split/splitFlows.js';
import {
  app,
  clickOrJs,
  cust,
  escapeRe,
  field,
  money,
  vqEnv,
  visible,
  waitUntil,
  type PayMethod,
} from '../promo-split/vqApp.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';

/**
 * Code-based (OD……-n) re-open helpers on the volt-qc `app` port (src/pages/voltqc/promo-split/vqApp.ts) —
 * a 1:1 port of volt-qc `src/flows/reopen.ts` for the cases that need named staff / services, customers,
 * splits, gift cards or reports. Money in DOLLARS here, like the source suite and `app`.
 */

export const GC = (): string => vqEnv.testGiftCard || giftCard.code;

/** Detail → Re-Open Order → read the "Re-Open Order?" dialog → Cancel. */
export async function reopenDialogText(id: string): Promise<string> {
  await app.openHistoryOrder(id);
  await P.clickQ(VqpsHistory.reopen);
  await app.passcodeIfAsked(1_500);
  await P.waitFor(VqpsHistory.reopenConfirm, 8_000, 'Re-Open Order?');
  const text = ((await P.rawText(VqpsHistory.reopenConfirm)) ?? '').replace(/\s+/g, ' ').trim();
  await P.clickQ([VqpsHistory.reopenConfirm, btn('Cancel', 0)]);
  await P.waitGoneQ(VqpsHistory.reopenConfirm, 5_000);
  return text;
}

export async function reopenToCheckout(
  id: string,
  button: 'Re-Open Order' | 'Continue Re-open' = 'Re-Open Order',
): Promise<void> {
  if (button === 'Re-Open Order') {
    await app.reopenOrder(id);
    return;
  }
  await app.openHistoryOrder(id);
  await P.clickQ(inMain(btn(button, 0)));
  await app.passcodeIfAsked(2_000);
  if (await visible(VqpsHistory.reopenConfirm)) await P.clickQ([VqpsHistory.reopenConfirm, btn('Confirm')]);
  await app.passcodeIfAsked(2_500);
  await app.waitPath(/checkout/, 20_000);
  await settle(800);
}

export async function editOrderFromCheckout(): Promise<void> {
  await P.clickQ({ role: 'button', name: 'Edit Order', nth: 0 });
  await app.passcodeIfAsked(2_000);
  await app.waitPath(/\/home/, 15_000);
  await settle(600);
}

export async function reopenToHome(id: string): Promise<void> {
  await reopenToCheckout(id);
  await editOrderFromCheckout();
}

export async function payFromEdit(): Promise<void> {
  await P.clickQ(inMain(VqpsHome.payButton));
  await app.passcodeIfAsked(1_500);
  await app.waitPath(/checkout/, 15_000);
  await settle(500);
}

export const voidDialog: VqcQuery = { role: 'dialog', hasText: 'Void Order Transactions', nth: -1 };

export async function confirmVoidAll(): Promise<void> {
  await P.clickQ([voidDialog, btn('Confirm Void', 0)]);
  await app.passcodeIfAsked(3_000);
  await waitUntil(
    async () => (await app.text('body')).includes(T.voidDone) || !(await visible(voidDialog)),
    30_000,
  );
  await settle(1_500);
}

export async function payAndReopenDone(): Promise<void> {
  await app.finishReopen();
}

/** Best-effort cleanup for a case that died inside a reopen. */
export async function leaveReopenVq(): Promise<void> {
  try {
    if (await visible(voidDialog)) await P.clickQ([voidDialog, btn('Back to Order', 0)]);
    if (/editOrderId/.test(await app.url()) || (await visible(VqpsCheckout.reopenDone)))
      await app.finishReopen();
  } catch {
    // cleanup only
  }
}

/** Cash/Other difference, no tip → success → No Receipt. */
export async function payDifference(method: 'Cash' | 'Other', otherName = 'E2E Other'): Promise<string> {
  await app.selectMethod(method);
  if (method === 'Other') await fillOtherName(otherName);
  await app.completePayment({ tip: 'none' });
  const s = await app.waitSuccess();
  await app.noReceipt();
  return s;
}

export async function fillOtherName(name: string): Promise<boolean> {
  const box = { css: 'input', placeholder: VqpsCheckout.otherNamePlaceholder, nth: 0 } as VqcQuery;
  if (!(await visible(box))) return false;
  await P.fillQ(box, name);
  return true;
}

/** Enter Amount after selecting `m`. */
export async function enteredFor(m: PayMethod): Promise<number> {
  await app.selectMethod(m);
  await settle(300);
  return app.enteredAmount();
}

export async function checkoutText(): Promise<string> {
  return app.text('main');
}

/** Pick `$label | $x` money out of the checkout text. */
export function pickMoney(t: string, label: string): number {
  return money(new RegExp(`\\| ${escapeRe(label)} \\| (-?\\$[\\d,.]+)`).exec(t)?.[1]);
}

export async function addServiceInReopen(service: string, staff = vqEnv.testStaff): Promise<void> {
  await app.pickStaff(staff);
  await app.addService(service);
}

const serviceTile = (name: string): VqcQuery[] => [{ css: 'main' }, { css: 'li', hasText: name, nth: 0 }];

/** Service tile locked (`pointer-events-none`) — or not reachable at all. */
export async function serviceLocked(service: string): Promise<boolean> {
  if (!(await visible(serviceTile(service)))) {
    const search = inMain({ css: 'input', placeholder: 'Search service', nth: 0 });
    if (!(await visible(search)) || (await P.isDisabled(search).catch(() => true))) return true;
    await P.fillQ(search, service);
    await settle(800);
    if (!(await visible(serviceTile(service)))) {
      await P.fillQ(search, '');
      return true;
    }
  }
  const cls = (await P.attrOf(serviceTile(service), 'class')) ?? '';
  return /pointer-events-none/.test(cls);
}

/** Click a tile (even locked); true when a line of it was added. */
export async function tryAddService(service: string): Promise<boolean> {
  const before = await app.itemRowCount(service);
  await P.jsClickQ(serviceTile(service)).catch(() => undefined);
  await settle(1_000);
  return (await app.itemRowCount(service)) > before;
}

/** "Cannot continue yet" text ('' when absent), OK-ing it. */
export async function cannotContinueText(timeout = 3_000): Promise<string> {
  const dlg: VqcQuery = { role: 'dialog', hasText: 'Cannot continue yet', nth: -1 };
  if (!(await waitUntil(() => visible(dlg), timeout))) return '';
  const t = ((await P.rawText(dlg)) ?? '').replace(/\s+/g, ' ');
  await P.clickQ([dlg, btn('OK', 0)]).catch(() => undefined);
  return t;
}

/** Re-open a 2-line order and drop `service`, Pay; throws when the build blocks a lower total. */
export async function decreaseOrFail(id: string, service = vqEnv.testService2): Promise<void> {
  await reopenToHome(id);
  await app.removeItem(service);
  await P.clickQ(inMain(VqpsHome.payButton));
  await app.passcodeIfAsked(1_500);
  const blocked = await cannotContinueText();
  if (blocked) {
    await addServiceInReopen(service);
    await app.finishReopen().catch(() => undefined);
    throw new Error(
      `A lower re-open total is blocked instead of voiding (VP-2585 §3 vs VP-3670): ${blocked}`,
    );
  }
  await app.waitPath(/checkout/, 15_000);
  await P.waitFor(voidDialog, 10_000, 'Void Order Transactions');
}

/** Detail text once the pane really loaded (Status + Payment Details), optionally until `until`. */
export async function freshDetail(
  id: string,
  until?: (d: string) => boolean,
  timeoutMs = 30_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let d = '';
  for (let round = 0; ; round += 1) {
    await app.openHistoryOrder(id);
    const t0 = Date.now();
    while (Date.now() - t0 < 10_000) {
      d = await app.historyDetail(id);
      const loaded = field(d, 'Status') !== '' && /Payment Details \| (?!Order Note)/.test(d);
      if (loaded && (!until || until(d))) return d;
      await settle(500);
    }
    if (Date.now() > deadline || round >= 2) return d;
  }
}

/** `Staff: <name> | …` block of Service Details ('' when the staff is not on the order). */
export function staffSegment(detail: string, staff: string): string {
  const i = detail.indexOf(`Staff: ${staff}`);
  if (i < 0) return '';
  const rest = detail.slice(i + 7 + staff.length);
  const ends = [rest.indexOf('Staff: '), rest.indexOf('Payment Details')].filter((x) => x >= 0);
  return rest.slice(0, ends.length ? Math.min(...ends) : undefined);
}

export function staffTip(detail: string, staff: string): number {
  return money(new RegExp(`${escapeRe(staff)} - (\\$[\\d,.]+)`).exec(detail)?.[1]);
}

/** Two-check Equally split of 2 services, each paid by `methods[n]` (customer tip in cents when asked). */
export async function createSplitPaid(
  methods: [CheckMethod, CheckMethod],
  opts: { services?: string[]; tipCents?: string; giftCard?: string } = {},
): Promise<{ id: string }> {
  const id = await app.createOrder({ services: opts.services ?? [vqEnv.testService, vqEnv.testService2] });
  await openSplit();
  try {
    for (const n of [1, 2] as const) {
      const m = methods[n - 1] ?? 'Other';
      await selectCheck(id, n);
      await clickOrJs(splitMethodButton(m), 3_000);
      await settle(300);
      await clickOrJs(splitPayButton, 3_000);
      await drivePaid(n, m, {
        customerTipCents: opts.tipCents,
        otherName: 'E2E Other',
        giftCard: opts.giftCard,
      });
      await closePaidDialog(n);
    }
    await completeDone();
    await app.noReceipt();
  } catch (e) {
    await settleSplit(id);
    throw e;
  }
  return { id };
}

/** Customer points (through a throw-away order), polling up to `want`. */
export async function readPoints(phone: string, want?: number, timeoutMs = 60_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let last = Number.NaN;
  do {
    try {
      const id = await app.createOrder();
      await attachExistingCustomer(phone);
      const note: VqcQuery = { role: 'dialog', hasText: 'Customer Note', nth: -1 };
      if (await waitUntil(() => visible(note), 2_000)) await P.clickQ([note, btn('Done', 0)]);
      await app.pay();
      last = (await checkoutCustomerStats()).points;
      await app.openPendingOrder(id);
      await app.deleteCurrentOrder();
      app.createdOrders.delete(id);
    } catch (e) {
      if (Date.now() >= deadline) throw e;
      await app.closeStrayDialogs().catch(() => undefined);
    }
    if (want === undefined || last === want) return last;
    await settle(3_000);
  } while (Date.now() < deadline);
  return last;
}

/** Visits of a customer (same throw-away order trick). */
export async function readVisits(phone: string): Promise<number> {
  const id = await app.createOrder();
  await attachExistingCustomer(phone);
  await app.pay();
  const v = (await checkoutCustomerStats()).visits;
  await app.openPendingOrder(id);
  await app.deleteCurrentOrder();
  app.createdOrders.delete(id);
  return v;
}

/** Today's Daily Sale rows for `id` (polled; the report lags). */
export async function dailySaleRows(id: string, timeoutMs = 90_000): Promise<DailyRow[]> {
  let rows: DailyRow[] = [];
  await waitUntil(
    async () => {
      await openDaily(0);
      rows = (await dailyRows()).rows.filter((r) => r.order.includes(id));
      return rows.length > 0;
    },
    timeoutMs,
    5_000,
  );
  return rows;
}

/** Tip base the customer display shows ("Tip based on total: $x"); NaN when none. */
export async function customerTipBase(): Promise<number> {
  return money(/Tip based on total:? \|?\s*(\$[\d,.]+)/.exec(await cust.text())?.[1]);
}

/** Press Complete Payment and wait for the customer tip screen (true) or success (false). */
export async function completeUntilTipScreen(timeoutMs = 30_000): Promise<boolean> {
  await P.clickQ(VqpsCheckout.complete);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cust.tipShown()) return true;
    if (/payment-success/.test(await app.url())) return false;
    if (await app.passcodeVisible()) await app.enterPasscode(vqEnv.staffCode);
    await settle(300);
  }
  return false;
}

/** The current URL path (for the occasional history.back()). */
export async function historyBack(): Promise<void> {
  await browser.execute(() => {
    window.history.back();
  });
  await settle(1_500);
}
