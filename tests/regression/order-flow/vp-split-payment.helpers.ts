/**
 * Shared steps for the VP-4912 / VP-4913 ticket specs — a split payment taken all the
 * way to Payment Success, and the post-payment "Adjust Order Tip" list.
 *
 * NOT a spec (`*.helpers.ts`). Builds on the volt-qc split port
 * (`src/pages/voltqc/promo-split/splitFlows.ts`) and the order-history tip helpers
 * (`src/pages/voltqc/oh-reopen/ohReopen.ts`). Orders are addressed by their CODE
 * (`OD……-n`), like the rest of the `vqApp` port.
 *
 * No card terminal on the QC machine (Card → Pay stays disabled), so callers split with
 * Cash / Other / Gift Card only.
 */

import { VqpsSplit } from '../../../src/constants/testids.voltqc-promo-split.js';
import { OhRoDialogs as D } from '../../../src/constants/testids.voltqc-oh-reopen.js';
import { btn } from '../../../src/constants/testids.voltqc-pos.js';
import { VpSplitTip } from '../../../src/constants/testids.vp-split-tip-history.js';
import { settle } from '../../../src/helpers/wait.js';
import { centsIn, passcodeIfAsked, saveTip, tipKey } from '../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  closePaidDialog,
  completeDone,
  drivePaid,
  methodButton,
  openSplit,
  payButton,
  selectCheck,
  settleSplit,
  type CheckMethod,
} from '../../../src/pages/voltqc/promo-split/splitFlows.js';
import { app, clickOrJs, visible, waitUntil } from '../../../src/pages/voltqc/promo-split/vqApp.js';

export type { CheckMethod };

export interface SplitToSuccess {
  /** Order code `OD……-n`. */
  id: string;
  /** "All checks paid" was on the split screen before Complete Done. */
  allChecksPaid: boolean;
  /** Body text of the Payment Successful screen. */
  successText: string;
}

/**
 * Quick Checkout → staff → service(s) → Split (Equally) → one check per entry of
 * `methods`, each paid (customer display answered "No Tip") → Complete Done.
 * Leaves the app ON Payment Success — the caller presses No Receipt.
 */
export async function splitPayToSuccess(
  methods: readonly CheckMethod[],
  opts: { services?: string[]; giftCard?: string; otherName?: string } = {},
): Promise<SplitToSuccess> {
  if (methods.length < 2) throw new Error('A split needs at least two checks');
  const id = await app.createOrder({ services: opts.services });
  await openSplit();
  try {
    // Equally opens with two checks; Add New Check re-divides the total evenly.
    for (let n = 3; n <= methods.length; n += 1) {
      await clickOrJs(VqpsSplit.addCheck);
      await P.waitFor(VqpsSplit.select(id, n), 10_000, `Check ${String(n)}`);
    }
    let lastPaid = '';
    for (const [i, method] of methods.entries()) {
      const n = i + 1;
      await selectCheck(id, n);
      await clickOrJs(methodButton(method), 3_000);
      await settle(300);
      await clickOrJs(payButton, 3_000);
      lastPaid = await drivePaid(n, method, {
        otherName: opts.otherName ?? 'E2E Other',
        giftCard: opts.giftCard,
      });
      await closePaidDialog(n);
    }
    // 1.1.90 prints "All checks paid" in the LAST check's "Paid Successfully" dialog
    // (closed above), not in <main>; older builds showed it on the split screen.
    const allChecksPaid =
      lastPaid.includes(VqpsSplit.allPaid) ||
      (await waitUntil(async () => (await P.pageText('main')).includes(VqpsSplit.allPaid), 3_000));
    const successText = await completeDone();
    return { id, allChecksPaid, successText };
  } catch (e) {
    await settleSplit(id);
    await escapeSplit();
    throw e;
  }
}

/**
 * Leave `/split-order` when nothing on it is paid yet — `settleSplit` only settles a
 * split that already took a payment. Without this a failed case (e.g. a tip wait the
 * customer display never answered) parks the app there, and `returnToHome()` refuses
 * that screen, so every later case and spec file fails in its hooks.
 */
export async function escapeSplit(): Promise<void> {
  if (!/split-order/.test(await app.url())) return;
  await P.escape().catch(() => undefined);
  await clickOrJs(VpSplitTip.backToOrder, 3_000).catch(() => undefined);
  await settle(800);
}

/** Payment Success → No Receipt, when the app is still on that screen. */
export async function leaveSuccessIfShown(): Promise<void> {
  if (/payment-success/.test(await app.url())) await app.noReceipt();
}

/* ------------------------------------------------------------------- *
 * "Adjust Order Tip" list (VP-4913)
 * ------------------------------------------------------------------- */

export interface TipRow {
  /** Payment method label of the row ("Cash", "Other", …). */
  method: string;
  /** Whitespace-collapsed row text. */
  text: string;
  /** Tip already on this payment (cents); 0 when the row has no " + $x Tip". */
  tipCents: number;
}

/** Is the Payment Success "Adjust Tip" link on screen? */
export async function successAdjustTipShown(): Promise<boolean> {
  return visible(VpSplitTip.successAdjustTip);
}

/**
 * Payment Success → Adjust Tip. Resolves once either the per-payment list
 * ("Adjust Order Tip") or the single-payment keypad ("Current Tip") is up.
 */
export async function openSuccessAdjustTip(): Promise<'list' | 'keypad'> {
  await P.clickQ(VpSplitTip.successAdjustTip);
  await passcodeIfAsked(2_000);
  const shown = await P.poll(
    async () => {
      if (await P.has(D.adjustOrderTipList)) return 'list' as const;
      if (await P.has(D.adjustTip)) return 'keypad' as const;
      return null;
    },
    (v) => v !== null,
    10_000,
  );
  if (shown === null) throw new Error('Adjust Tip opened neither the payment list nor the keypad');
  return shown;
}

/** Rows of the open "Adjust Order Tip" list, top to bottom. */
export async function tipRows(): Promise<TipRow[]> {
  const raw = await P.exec<{ method: string; text: string }[]>(
    `
    var dl = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"]'), function (d) {
      return /Adjust Order Tip/.test(d.textContent || '') && d.getClientRects().length > 0;
    });
    var dlg = dl[dl.length - 1];
    if (!dlg) return [];
    var label = arguments[0], rowCss = arguments[1];
    return Array.prototype.filter.call(dlg.querySelectorAll('button'), function (b) {
      return (b.textContent || '').trim() === label;
    }).map(function (b) {
      var row = b.closest(rowCss) || b.parentElement;
      var first = row ? row.querySelector('span') : null;
      return {
        method: String((first && first.textContent) || '').trim(),
        text: String((row && row.innerText) || '').replace(/\\s+/g, ' ').trim(),
      };
    });
  `,
    VpSplitTip.rowAdjustTipLabel,
    VpSplitTip.rowCss,
  );
  const plus = new RegExp(VpSplitTip.plusTipRe);
  return raw.map((r) => {
    const m = plus.exec(r.text);
    return { ...r, tipCents: m ? centsIn(m[1]) : 0 };
  });
}

/** Index of the first row whose method label starts with `method`; -1 when absent. */
export async function tipRowIndex(method: string): Promise<number> {
  return (await tipRows()).findIndex((r) => r.method.startsWith(method));
}

/** In the open list: Adjust Tip on the `method` row → type `digits` (cents) → Save. List stays open. */
export async function adjustTipOnRow(method: string, digits: string): Promise<void> {
  const i = await tipRowIndex(method);
  if (i < 0) throw new Error(`"Adjust Order Tip" has no ${method} row`);
  await P.clickQ([D.adjustOrderTipList, btn(VpSplitTip.rowAdjustTipLabel, i)]);
  await passcodeIfAsked(1_500);
  await P.waitFor(D.adjustTip, 8_000, 'Adjust Tip keypad');
  for (const k of digits) await tipKey(k);
  await saveTip();
}

/** Poll the list until the `method` row carries `cents` of tip; returns the rows last read. */
export async function waitRowTip(method: string, cents: number, timeout = 20_000): Promise<TipRow[]> {
  let rows: TipRow[] = [];
  await waitUntil(
    async () => {
      rows = await tipRows();
      return rows.find((r) => r.method.startsWith(method))?.tipCents === cents;
    },
    timeout,
    500,
  );
  return rows;
}

/** Close the "Adjust Order Tip" list with its X (Escape is swallowed by the dialog). */
export async function closeTipList(): Promise<void> {
  if (!(await P.has(D.adjustOrderTipList))) return;
  await P.clickQ([D.adjustOrderTipList, { css: 'button', nth: 0 }]);
  await P.waitGoneQ(D.adjustOrderTipList, 8_000, 'Adjust Order Tip');
}

/** Best-effort: close any tip dialog left open by a failed case. */
export async function closeTipDialogs(): Promise<void> {
  for (const dlg of [D.adjustTip, D.adjustOrderTipList]) {
    if (await P.has(dlg).catch(() => false)) {
      await P.clickQ([dlg, { css: 'button', nth: 0 }]).catch(() => undefined);
      await settle(400);
    }
  }
}
