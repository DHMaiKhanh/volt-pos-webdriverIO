import { btn, inMain, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsSplit, VqpsSuccess } from '../../../constants/testids.voltqc-promo-split.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';
import { cardTotalOf, priceModel, type PriceModel } from './price.js';
import { openQuickPay } from './promoFlows.js';
import {
  app,
  appears,
  clickFound,
  clickOrJs,
  cust,
  money,
  r2 as pr2,
  vqEnv,
  visible,
  waitUntil,
} from './vqApp.js';

/**
 * Port of volt-qc `src/flows/split.ts` — the `/order/<uuid>/split-order` screen.
 * Check codes are `#<order code>-<n>` (aria-labels "Select #OD…-1",
 * "Check Successful #OD…-1", "Delete #…", "Void #…"). Amounts in DOLLARS.
 */

export type SplitMode = 'Equally' | 'By Amount' | 'By Items';
export type CheckMethod = 'Card' | 'Cash' | 'Gift Card' | 'Other';

/** Home (order open) → Split → passcode → split screen. */
export async function openSplit(): Promise<void> {
  await clickOrJs(inMain({ css: 'button.bg-orange', nth: 0 }));
  await app.passcodeIfAsked(2_000);
  await app.waitPath(/\/split-order/, 15_000);
  await P.waitFor(inMain({ text: VqpsSplit.chooseCheck, nth: 0 }), 15_000, VqpsSplit.chooseCheck);
  await app.idle(150);
}

export const splitButton = inMain({ css: 'button.bg-orange', nth: 0 });

export async function orderUuidFromUrl(): Promise<string> {
  return /\/order\/([^/?#]+)/.exec(await app.url())?.[1] ?? '';
}

export const modeButton = (m: SplitMode): readonly VqcQuery[] => VqpsSplit.mode(m);
export const methodButton = (m: CheckMethod): readonly VqcQuery[] => VqpsSplit.method(m);
export const payButton = VqpsSplit.pay;

export async function isModeActive(m: SplitMode): Promise<boolean> {
  const cls = (await P.attrOf(modeButton(m), 'class')) ?? '';
  return /(^|\s)bg-primary(\s|$)/.test(cls) && /(^|\s)text-white(\s|$)/.test(cls);
}

/** innerText of the rounded-lg block holding check `n` (row, By Items card or paid row). */
export async function checkRowText(id: string, n: number): Promise<string> {
  return P.exec<string>(
    `var a = document.querySelector('main [aria-label="Select #' + arguments[0] + '-' + arguments[1] + '"], main [aria-label="Check Successful #' + arguments[0] + '-' + arguments[1] + '"]');
     if (!a) return '';
     var b = a.closest('div.rounded-lg') || a.parentElement;
     return String((b && b.innerText) || '').replace(/\\s+/g, ' ');`,
    id,
    n,
  );
}

/** Check numbers on screen (paid + unpaid), ascending. */
export async function checkNumbers(id: string): Promise<number[]> {
  const labels = await P.exec<string[]>(
    `var id = arguments[0];
     return Array.prototype.map.call(document.querySelectorAll('main [aria-label^="Select #' + id + '-"], main [aria-label^="Check Successful #' + id + '-"]'), function (e) { return e.getAttribute('aria-label') || ''; });`,
    id,
  );
  return [...new Set(labels.map((l) => Number(/-(\d+)$/.exec(l)?.[1])))]
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

export async function unpaidChecks(id: string): Promise<number[]> {
  const labels = await P.exec<string[]>(
    `var id = arguments[0];
     return Array.prototype.map.call(document.querySelectorAll('main [aria-label^="Select #' + id + '-"]'), function (e) { return e.getAttribute('aria-label') || ''; });`,
    id,
  );
  return [...new Set(labels.map((l) => Number(/-(\d+)$/.exec(l)?.[1])))]
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

export async function isCheckPaid(id: string, n: number): Promise<boolean> {
  return (await P.count(VqpsSplit.paidMark(id, n))) > 0;
}

/** Paid row → "Total Paid: $x"; unpaid → first amount on the row. */
export async function checkAmount(id: string, n: number): Promise<number> {
  const t = await checkRowText(id, n);
  const paid = /Total Paid: (\$[\d,.]+)/.exec(t);
  if (paid) return money(paid[1]);
  return money(/\$[\d,.]+/.exec(t)?.[0]);
}

export async function checkAmounts(id: string): Promise<number[]> {
  const out: number[] = [];
  for (const n of await checkNumbers(id)) out.push(await checkAmount(id, n));
  return out;
}

export async function paidRemaining(): Promise<{ totalPaid: number; remaining: number }> {
  const t = await app.text('main');
  return {
    totalPaid: money(/\| Total Paid \| (\$[\d,.]+)/.exec(t)?.[1]),
    remaining: money(/\| Remaining \| (\$[\d,.]+)/.exec(t)?.[1]),
  };
}

export async function selectCheck(id: string, n: number): Promise<void> {
  await clickOrJs(VqpsSplit.select(id, n));
  await settle(300);
}

/** Cashier tip on the selected check: Tip → cents (first key replaces) → Add. */
export async function cashierTip(centsStr: string): Promise<void> {
  await clickOrJs(VqpsSplit.tip);
  const d = VqpsCheckout.cashierTipDialog;
  await P.waitFor([d, btn('Add')], 5_000, 'Tip dialog');
  for (const k of centsStr) await P.clickQ([d, btn(k, 0)]);
  await P.clickQ([d, btn('Add')]);
  await P.waitGoneQ([d, btn('Add')], 5_000);
  await settle(500);
}

export const cashDialog = (n: number): VqcQuery => VqpsSplit.cashDialog(n);
export const otherDialog = VqpsSplit.otherDialog;
export const paidDialog = (n: number): VqcQuery => VqpsSplit.paidDialog(n);
export const giftCardResultDialog = VqpsCheckout.gcResultDialog;

export async function dialogKeys(dlg: VqcQuery, keys: string[]): Promise<void> {
  for (const k of keys) await P.clickQ([dlg, btn(k, 0)]);
}

export interface PayCheckOpts {
  otherName?: string;
  /** Cash: keys typed after C (e.g. ['2','0','0','0'] = $20.00). */
  cashKeys?: string[];
  cashierTipCents?: string;
  /** Customer-side Custom Tip (cents) when the display asks; default No Tip. */
  customerTipCents?: string;
  giftCard?: string;
  next?: 'auto' | 'none';
  skipPasscode?: boolean;
}

/** After Pay: drive passcode / Cash / Other / gift card / customer tip until "Check N Paid Successfully". */
export async function drivePaid(n: number, method: CheckMethod, o: PayCheckOpts = {}): Promise<string> {
  const deadline = Date.now() + 60_000;
  let cashDone = false;
  let otherDone = false;
  let tipped = false;
  let gcStage = 0;
  while (Date.now() < deadline) {
    if (await visible(paidDialog(n)))
      return ((await P.rawText(paidDialog(n))) ?? '').replace(/\s*\n+\s*/g, ' | ');
    if (!o.skipPasscode && (await app.passcodeVisible())) {
      await app.enterPasscode(vqEnv.staffCode);
      continue;
    }
    if (!tipped && (await cust.tipShown())) {
      if (o.customerTipCents) await cust.customTip(o.customerTipCents);
      else await cust.tip('none');
      tipped = true;
      continue;
    }
    if (method === 'Cash' && !cashDone && (await visible(cashDialog(n)))) {
      if (o.cashKeys) await dialogKeys(cashDialog(n), ['C', ...o.cashKeys]);
      await P.clickQ([cashDialog(n), btn(`Complete Check ${String(n)}`)]);
      cashDone = true;
      continue;
    }
    if (method === 'Other' && !otherDone && (await visible(otherDialog))) {
      if (o.otherName)
        await P.fillQ(
          [otherDialog, { css: `input[placeholder="${VqpsCheckout.otherNamePlaceholder}"]` }],
          o.otherName,
        );
      await P.clickQ([otherDialog, { role: 'button', nameRe: '^Pay\\s*\\$', nth: 0 }]);
      otherDone = true;
      continue;
    }
    if (method === 'Gift Card') {
      if (gcStage === 0 && (await visible(VqpsCheckout.inputGiftCard))) {
        await P.clickQ(VqpsCheckout.inputGiftCard);
        await P.fillQ(
          [VqpsCheckout.gcCodeDialog, { role: 'textbox', nth: 0 }],
          o.giftCard ?? vqEnv.testGiftCard,
        );
        await P.clickQ([VqpsCheckout.gcCodeDialog, btn('Confirm')]);
        gcStage = 1;
        continue;
      }
      if (gcStage === 1 && (await visible(giftCardResultDialog))) {
        const txt = (await P.rawText(giftCardResultDialog)) ?? '';
        if (!/Gift Card Accepted/i.test(txt))
          throw new Error(`Gift card not accepted: ${txt.replace(/\s*\n+\s*/g, ' | ')}`);
        await P.clickQ([giftCardResultDialog, btn('Pay')]);
        gcStage = 2;
        continue;
      }
    }
    await settle(200);
  }
  throw new Error(`"Check ${String(n)} Paid Successfully" never showed (method ${method})`);
}

export async function closePaidDialog(n: number): Promise<void> {
  await P.clickQ([paidDialog(n), { role: 'button', nameRe: '^(Continue Payment|Done)$', nth: 0 }]);
  await P.waitGoneQ(paidDialog(n), 8_000);
}

/** Select check n → method → (cashier tip) → Pay → … → paid. Returns the paid-dialog text. */
export async function payCheck(
  id: string,
  n: number,
  method: CheckMethod,
  o: PayCheckOpts = {},
): Promise<string> {
  await selectCheck(id, n);
  await clickOrJs(methodButton(method), 3_000);
  await settle(300);
  if (o.cashierTipCents) await cashierTip(o.cashierTipCents);
  await clickOrJs(payButton, 3_000);
  const text = await drivePaid(n, method, o);
  if ((o.next ?? 'auto') === 'auto') await closePaidDialog(n);
  return text;
}

/** Gift card on check n up to the verdict dialog (does NOT press Pay). */
export async function startGiftCardCheck(id: string, n: number, code = vqEnv.testGiftCard): Promise<string> {
  await selectCheck(id, n);
  await clickOrJs(methodButton('Gift Card'));
  await clickOrJs(payButton);
  await app.reachGiftCardInput();
  const r = await app.confirmGiftCardCode(code);
  return r.info;
}

export const voidDialog = VqpsSplit.voidDialog;

export async function pickVoidReason(reason: string): Promise<void> {
  await P.clickQ([voidDialog, { role: 'combobox', nth: 0 }]);
  await P.clickQ({ role: 'option', name: reason });
}

/** Void a paid check: Void → reason → Confirm Void → passcode → "Void Payment Successful!" → Done. */
export async function voidCheck(
  id: string,
  n: number,
  reason = 'Customer Request',
  otherText?: string,
): Promise<void> {
  await clickOrJs(VqpsSplit.voidBtn(id, n));
  await P.waitFor(voidDialog, 8_000, 'Void Payment');
  await pickVoidReason(reason);
  if (otherText !== undefined) {
    await P.fillQ(
      [
        voidDialog,
        { css: '[data-testid="split-void-reason-other-input"], textarea, input[type="text"]', nth: -1 },
      ],
      otherText,
    );
  }
  await P.clickQ([voidDialog, btn('Confirm Void')]);
  await app.passcodeIfAsked(4_000);
  await P.waitFor(VqpsSplit.voidOk, 30_000, 'Void Payment Successful!');
  await P.clickQ([VqpsSplit.voidOk, btn('Done')]);
  await P.waitGoneQ(VqpsSplit.voidOk, 8_000);
  await settle(800);
}

/** By Amount: set check n (cents) through the keypad popover → Done. */
export async function setCheckAmount(id: string, n: number, centsStr: string): Promise<void> {
  await selectCheck(id, n);
  await openAmountKeypad(id, n);
  const kp = VqpsSplit.amountKeypad;
  const back: readonly VqcQuery[] = [kp, { role: 'button', nth: 11 }];
  for (let i = 0; i < 10; i += 1) await P.clickQ(back);
  for (const d of centsStr) await P.clickQ([kp, btn(d)]);
  await P.clickQ([kp, btn('Done')]);
  await P.waitGoneQ(kp, 5_000);
  await settle(500);
}

/** Second tap on the check's amount box opens the keypad popover. */
export async function openAmountKeypad(id: string, n: number): Promise<void> {
  const ok = await clickFound(
    `var a = document.querySelector('main [aria-label="Select #' + arguments[0] + '-' + arguments[1] + '"]');
     var row = a ? (a.closest('div.rounded-lg') || a.parentElement) : null;
     return row ? row.querySelector('div[class*="w-[360px]"]') : null;`,
    id,
    n,
  );
  if (!ok) throw new Error(`No amount box on check ${String(n)}`);
  await P.waitFor(VqpsSplit.amountKeypad, 5_000, 'amount keypad');
}

export async function completeDone(): Promise<string> {
  await clickOrJs(VqpsSplit.completeDone);
  await app.passcodeIfAsked(2_000);
  await app.waitPath(/payment-success/, 20_000);
  return app.successText();
}

/** Finish a half-paid split: pay every open check with Other, Complete Done, No Receipt. */
export async function settleSplit(id: string): Promise<void> {
  try {
    for (let i = 0; i < 4; i += 1) {
      if (!(await P.count({ role: 'dialog' }).catch(() => 0))) break;
      const b = [
        { role: 'dialog', nth: -1 },
        {
          role: 'button',
          nameRe: '^(Continue Payment|Done|Close|Keep|Cancel|Select Another Method)$',
          nth: 0,
        },
      ] as const;
      if (await visible(b)) await P.clickQ(b).catch(() => undefined);
      else await P.escape();
      await settle(400);
    }
    if (!/split-order/.test(await app.url())) return;
    if (!(await P.count(inMain({ css: `[aria-label^="Check Successful #${id}-"]` })))) return;
    for (let i = 0; i < 8; i += 1) {
      const left = await unpaidChecks(id);
      const first = left[0];
      if (first === undefined) break;
      await payCheck(id, first, 'Other', { otherName: 'E2E cleanup' });
    }
    await completeDone();
    await app.noReceipt();
    app.createdOrders.delete(id);
  } catch (e) {
    console.warn(`settleSplit(${id}) failed: ${(e as Error).message}`);
  }
}

/* ------------------------------------------------------------------------- *
 * Amount model
 * ------------------------------------------------------------------------- */

/** App rule (VP-1865): each check floor(T/n), remainder cents go to the LAST checks. */
export function evenSplit(total: number, n: number): number[] {
  const c = Math.round(total * 100);
  const b = Math.floor(c / n);
  const rem = c - b * n;
  return Array.from({ length: n }, (_, i) => (b + (i >= n - rem ? 1 : 0)) / 100);
}

export const nonCardShare = (m: PriceModel, checkAmount: number): number => pr2(checkAmount / (1 + m.fee));

/** Quick Pay base lines (cents) whose Card Total on Home equals `targetCents` under the model. */
export function quickPayLinesFor(m: PriceModel, targetCents: number): number[] {
  const tot = (cs: number[]): number =>
    Math.round(
      cardTotalOf(
        m,
        cs.map((c) => c / 100),
      ) * 100,
    );
  const mid = Math.round(targetCents / ((1 + m.fee) * (1 + m.tax)));
  let best = [mid];
  for (let d = 0; d <= 5; d += 1) {
    for (const c of [mid - d, mid + d]) {
      if (c <= 0) continue;
      if (tot([c]) === targetCents) return [c];
      if (Math.abs(tot([c]) - targetCents) < Math.abs(tot(best) - targetCents)) best = [c];
    }
  }
  for (let c2 = 100; c2 < 2_000; c2 += 1) {
    const c1mid = mid - c2;
    for (let d = -3; d <= 3; d += 1) {
      const c1 = c1mid + d;
      if (c1 >= 100 && tot([c1, c2]) === targetCents) return [c1, c2];
    }
  }
  return best;
}

/** One Quick Pay line, retrying Add while the dialog stays open. */
export async function addQuickPay(o: { cents: number; name?: string }): Promise<void> {
  const name = o.name ?? `QP ${String(o.cents)}`;
  await openQuickPay();
  const dlg = { role: 'dialog', hasText: 'Custom Amount', nth: -1 } as const;
  await P.fillQ([dlg, { css: 'input[placeholder="0.00"]', nth: 0 }], String(o.cents));
  await P.fillQ([dlg, { css: 'input[placeholder="Service Name"]' }], name);
  for (let i = 0; i < 3 && (await visible(dlg)); i += 1) {
    await P.clickQ([dlg, btn('Add')], 3_000).catch(() => undefined);
    await P.waitGoneQ(dlg, 4_000).catch(() => undefined);
  }
  await P.waitGoneQ(dlg, 5_000, 'Quick Pay dialog');
  await waitUntil(async () => (await app.itemRowCount(name)) > 0, 5_000);
  await settle(500);
}

/** Quick Checkout → staff (returns the code). */
export async function startOrder(staff = vqEnv.testStaff): Promise<string> {
  await app.quickCheckout();
  await app.pickStaff(staff);
  const id = await app.orderId();
  app.createdOrders.add(id);
  return id;
}

/** Order of Quick Pay lines (cents) for one staff. */
export async function quickPayOrder(
  lines: (number | { cents: number; name?: string })[],
  staff = vqEnv.testStaff,
): Promise<string> {
  const id = await startOrder(staff);
  for (const l of lines) await addQuickPay(typeof l === 'number' ? { cents: l } : l);
  return id;
}

/** Quick Pay order whose Card Total on Home ≈ `targetCents`. */
export async function cardTotalOrder(
  targetCents: number,
): Promise<{ id: string; T: number; m: PriceModel; lines: number[] }> {
  const m = await priceModel();
  const lines = quickPayLinesFor(m, targetCents);
  const id = await quickPayOrder(lines);
  const want = Math.round(
    cardTotalOf(
      m,
      lines.map((c) => c / 100),
    ) * 100,
  );
  await waitUntil(async () => Math.round((await app.orderTotals()).total * 100) === want, 8_000);
  const T = (await app.orderTotals()).total;
  return { id, T, m, lines };
}

/** Select check n + method and read the "Pay $x" button (does not pay). */
export async function methodPrice(id: string, n: number, method: CheckMethod): Promise<number> {
  await selectCheck(id, n);
  await clickOrJs(methodButton(method));
  await settle(300);
  return money(await P.textOf(payButton));
}

/** Wait for "Check N Paid Successfully" (answering passcode / customer tip). */
export async function waitCheckPaid(n: number, timeoutMs = 40_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await visible(paidDialog(n))) return;
    if (await app.passcodeVisible()) await app.enterPasscode(vqEnv.staffCode);
    else if (await cust.tipShown()) await cust.tip('none');
    await settle(400);
  }
  throw new Error(`"Check ${String(n)} Paid Successfully" never showed`);
}

/* ------------------------------------------------------------------------- *
 * Split Tip (payment success)
 * ------------------------------------------------------------------------- */

export const splitTipDialog = VqpsSplit.splitTipDialog;

export async function openSplitTip(): Promise<void> {
  await P.clickQ(VqpsSuccess.splitTip);
  await P.waitFor(splitTipDialog, 8_000, 'Split Tip dialog');
}

export const tipInputs: readonly VqcQuery[] = [splitTipDialog, { css: 'input[placeholder="0.00"]' }];

export async function tipValues(): Promise<number[]> {
  const infos = await P.infos(tipInputs);
  return infos.map((i) => money(i.value));
}

export async function waitAppears(chain: Parameters<typeof appears>[0], timeout: number): Promise<boolean> {
  return appears(chain, timeout);
}
