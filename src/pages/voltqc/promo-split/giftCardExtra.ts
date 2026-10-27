import { btn, inMain, type VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsHistory, VqpsSplit } from '../../../constants/testids.voltqc-promo-split.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';
import { giftCardCooldown, markGiftCardUse, payCurrentWithGiftCard } from './promoFlows.js';
import { startGiftCardCheck, waitCheckPaid } from './splitFlows.js';
import { app, appears, clickFound, escapeRe, vqEnv, visible, waitUntil } from './vqApp.js';

/**
 * Extra helpers for the volt-qc 04 PROMO gift-card sell / redeem / card port
 * (`tests/regression/volt-qc/promo-split/promo-giftcard-*.spec.ts`,
 * `promo-card.spec.ts`). Ports of the volt-qc bits the shared promo-split
 * library does not cover: `removeStaffBlock`, `startCancelOrder`,
 * `typePasscode`, `roleWithoutPermission` (pay.ts / perm.ts / promo.ts) and the
 * split gift-card check helpers. Amounts in DOLLARS.
 */

/** "Gift Card [****-****-1234]" line label regex source for `code`. */
export const gcLineSrc = (code: string): string => `Gift Card \\[\\*+-\\*+-${escapeRe(code.slice(-4))}\\]`;

/** Gift card line(s) in the order panel / checkout. */
export const gcLine = (code: string): readonly VqcQuery[] => inMain({ textRe: gcLineSrc(code) });

/** Unknown staff code (volt-qc perm.ts `unknownCode`). */
export const unknownCode = (): string => (process.env.VOLT_UNKNOWN_CODE ?? '').trim() || '9137';

/** Quick Checkout (no staff) → Gift Card tile → Sell Gift Card dialog. */
export async function openSellFresh(): Promise<void> {
  await app.quickCheckout();
  await app.openSellGiftCard();
}

/** Trash "Delete Staff Order Item" of the staff block whose text contains `blockText`. */
export async function removeStaffBlock(blockText: string): Promise<void> {
  const ok = await clickFound(
    `var t = arguments[0];
     var bs = document.querySelectorAll('main button');
     for (var i = 0; i < bs.length; i++) {
       var b = bs[i];
       var nm = (b.getAttribute('aria-label') || b.textContent || '').trim();
       if (nm !== 'Delete Staff Order Item' || !b.getClientRects().length) continue;
       var block = b.parentElement ? b.parentElement.parentElement : null;
       if (block && String(block.innerText || '').indexOf(t) >= 0) return b;
     }
     return null;`,
    blockText,
  );
  if (!ok) throw new Error(`No "Delete Staff Order Item" button on a block containing "${blockText}"`);
}

/** Order History detail: Cancel Order → (passcode) → reason → Confirm Cancel. Does not wait for the outcome. */
export async function startCancelOrder(reasonIndex = 0): Promise<void> {
  await P.clickQ(VqpsHistory.cancelOrder);
  await app.passcodeIfAsked(2_000);
  await P.clickQ([VqpsHistory.cancelDialog, { role: 'combobox', nth: 0 }]);
  await P.clickQ({ role: 'option', nth: reasonIndex });
  await P.clickQ([VqpsHistory.cancelDialog, btn('Confirm Cancel')]);
}

/** Type `code` on the open passcode dialog; returns whether it stayed open and its text. */
export async function typePasscode(code: string): Promise<{ open: boolean; text: string }> {
  const dlg = app.passcodeDialog();
  for (const c of code) await P.clickQ([dlg, btn(c, 0)]);
  await settle(1_500);
  const open = await visible(dlg);
  const text = open ? ((await P.rawText(dlg).catch(() => '')) ?? '').replace(/\s*\n+\s*/g, ' | ') : '';
  return { open, text };
}

export interface PermRow {
  owner: boolean;
  manager: boolean;
  partner: boolean;
  staff: boolean;
}

/** Settings › Permissions: the 4 role switches (Owner/Manager/Partner/Staff) of the row `label`. */
export async function readPermission(label: string): Promise<PermRow | null> {
  if (!(await app.path()).startsWith('/settings/permissions')) {
    await app.go('/settings/permissions');
    await P.clickQ(inMain({ text: 'Expand All', nth: 0 }), 3_000).catch(() => undefined);
    await settle(800);
  }
  return P.exec<PermRow | null>(
    `var label = arguments[0];
     var labs = Array.prototype.filter.call(document.querySelectorAll('main *'), function (e) { return (e.textContent || '').trim() === label; });
     var row = labs[labs.length - 1];
     if (!row) return null;
     for (var i = 0; i < 6 && row; i++) {
       row = row.parentElement;
       if (row && row.querySelectorAll('[role=switch]').length >= 4) break;
     }
     var sw = row ? Array.prototype.map.call(row.querySelectorAll('[role=switch]'), function (s) { return s.getAttribute('aria-checked') === 'true'; }) : [];
     if (sw.length < 4) return null;
     return { owner: sw[0], manager: sw[1], partner: sw[2], staff: sw[3] };`,
    label,
  );
}

/** A role (manager/partner/staff) with a code in env whose `label` permission is OFF; null when none. */
export async function roleWithoutPermission(
  label: string,
): Promise<{ role: 'manager' | 'partner' | 'staff'; name: string; code: string } | null> {
  const roles = ['manager', 'partner', 'staff'] as const;
  if (!roles.some((r) => vqEnv.roles[r].code)) return null;
  const perm = await readPermission(label);
  if (!perm) return null;
  for (const r of roles) {
    if (!perm[r] && vqEnv.roles[r].code) return { role: r, ...vqEnv.roles[r] };
  }
  return null;
}

/** Create the standard order and pay it all with `code`. Returns the code + what the card was charged (Gift Card button). */
export async function paidByGiftCard(code: string): Promise<{ id: string; total: number }> {
  const id = await app.createOrder();
  await app.pay();
  const total = await app.methodAmount('Gift Card');
  await payCurrentWithGiftCard(code);
  await app.waitSuccess();
  await app.noReceipt();
  return { id, total };
}

/** Split: close the "Check N Paid Successfully" dialog (Continue Payment / Done). */
export async function dismissCheckPaid(): Promise<void> {
  await P.clickQ([
    { role: 'dialog', nth: -1 },
    { role: 'button', nameRe: '^(Continue Payment|Done)$', nth: 0 },
  ]);
  await settle(600);
}

/** Split: pay check `n` with `code` (cooldown → verdict must be Accepted → Pay → paid). Returns the verdict text. */
export async function payCheckWithGiftCard(id: string, n: number, code: string): Promise<string> {
  await giftCardCooldown();
  const info = await startGiftCardCheck(id, n, code);
  if (!info.includes('Gift Card Accepted'))
    throw new Error(`Check ${String(n)}: card ****${code.slice(-4)} not accepted: ${info}`);
  await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
  await waitCheckPaid(n);
  markGiftCardUse();
  return info;
}

/** Split: "All checks paid" → Done → Complete Done → payment-success → No Receipt. */
export async function finishSplit(): Promise<void> {
  if (!(await appears({ text: VqpsSplit.allPaid, nth: 0 }, 15_000))) {
    throw new Error('"All checks paid" never showed');
  }
  await P.clickQ([{ role: 'dialog', nth: -1 }, btn('Done', 0)]);
  await P.clickQ(inMain({ role: 'button', nameRe: 'Complete Done|^Done$', nth: -1 }));
  await app.passcodeIfAsked(2_000);
  await app.waitSuccess();
  await app.noReceipt();
}

/** "Current Balance | $x" from a gift card verdict text. */
export const currentBalanceOf = (info: string): string | undefined =>
  /Current Balance \| (\$[\d,.]+)/.exec(info)?.[1];

/**
 * After pressing Pay on the second in-cooldown transaction: which comes first within
 * `timeoutMs` — /payment-success ('success'), a toast / dialog reading like an error
 * ('error'), or neither ('none').
 */
export async function payOutcome(timeoutMs = 20_000): Promise<'success' | 'error' | 'none'> {
  let outcome: 'success' | 'error' | 'none' = 'none';
  await waitUntil(
    async () => {
      if (/payment-success/.test(await app.path())) {
        outcome = 'success';
        return true;
      }
      const err = await P.exec<boolean>(
        `var re = /error|fail|try again|not|unable|wait/i;
         return Array.prototype.some.call(document.querySelectorAll('[data-sonner-toast], [role=alertdialog], [role=dialog]'), function (e) {
           return e.getClientRects().length > 0 && re.test(e.textContent || '');
         });`,
      ).catch(() => false);
      if (err) {
        outcome = 'error';
        return true;
      }
      return false;
    },
    timeoutMs,
    250,
  );
  return outcome;
}
