/**
 * VP-5020 helpers — Re-Open of a fully paid split order must not force "Void Order
 * Transactions". Reads the reopened checkout and Order Details as plain amounts so the
 * spec can compare them.
 */

import { VqpsCheckout } from '../../../src/constants/testids.voltqc-promo-split.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { settle } from '../../../src/helpers/wait.js';
import { countPayments, field, homeStaffNames } from '../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import {
  checkoutText,
  freshDetail,
  pickMoney,
  voidDialog,
} from '../../../src/pages/voltqc/oh-reopen/vqReopen.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  settleCardDialog,
  terminalConnected,
  watchCard,
} from '../../../src/pages/voltqc/promo-split/splitDeepExtra.js';
import * as S from '../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  app,
  clickOrJs,
  money,
  visible,
  vqEnv,
  waitUntil,
} from '../../../src/pages/voltqc/promo-split/vqApp.js';
import { escapeSplit } from './vp-split-payment.helpers.js';

export const CARD_STAFF = process.env.VP5020_CARD_STAFF ?? 'Zelene Doyle';
export const CARD_SERVICE = process.env.VP5020_CARD_SERVICE ?? 'Dark Queen';

export interface Totals {
  subtotal: number;
  tax: number;
  total: number;
}

/** Order Details of `id` (retries: a just-paid order can lag in the Order History list). */
export async function detailOf(id: string): Promise<{ t: Totals; detail: string }> {
  let d = '';
  for (let attempt = 1; ; attempt += 1) {
    try {
      d = await freshDetail(id);
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      await settle(4_000);
      await returnToHome().catch(() => undefined);
    }
  }
  return {
    detail: d,
    t: {
      subtotal: money(field(d, 'Subtotal')),
      tax: money(field(d, 'Tax')) || 0,
      total: money(field(d, 'Total')),
    },
  };
}

/** Subtotal / Tax / Total on the reopened checkout panel. */
export async function screenTotals(): Promise<Totals> {
  const t = await app.orderTotals();
  return { subtotal: t.subtotal, tax: t.tax, total: t.total };
}

/** Total Paid / Remaining on the reopened checkout. */
export async function paidState(): Promise<{ totalPaid: number; remaining: number }> {
  const t = await checkoutText();
  return { totalPaid: pickMoney(t, 'Total Paid'), remaining: pickMoney(t, 'Remaining') };
}

/**
 * Did "Void Order Transactions" come up within `ms`? Backs out of it ("Back to Order")
 * so the case can clean up without voiding anything.
 */
export async function voidForced(ms = 5_000): Promise<boolean> {
  const forced = await waitUntil(() => visible(voidDialog), ms);
  if (forced)
    await P.clickQ([voidDialog, { role: 'button', name: 'Back to Order', nth: 0 }]).catch(() => undefined);
  return forced;
}

export const reopenDoneShown = (): Promise<boolean> => visible(VqpsCheckout.reopenDone);

/** Payment Details mention a voided transaction. */
export const hasVoided = (detail: string): boolean => /Voided/i.test(detail);

export { countPayments };

/** Index of the first Home staff tile that is not `current` (-1 when none). */
export async function otherStaffIndex(current: string): Promise<{ index: number; name: string }> {
  const names = await homeStaffNames();
  const index = names.findIndex((n) => n.trim() !== '' && n.trim() !== current.trim());
  return { index, name: index >= 0 ? (names[index] ?? '').trim() : '' };
}

/** Card + Cash needs a real charge: CARD_SETTLE=1 and a connected terminal. */
export async function requireTerminal(ctx: Mocha.Context): Promise<void> {
  if (!vqEnv.cardSettle) {
    console.warn('VP-5020 Card + Cash: real card charge — set CARD_SETTLE=1');
    ctx.skip();
  }
  if (!(await terminalConnected({ fresh: true }))) {
    console.warn('VP-5020 Card + Cash: header Devices › Terminal is not Connected');
    ctx.skip();
  }
}

/**
 * Quick Checkout → CARD_STAFF → CARD_SERVICE → Split Equally → check 1 Card (real charge,
 * No Tip, signature on the customer display) → check 2 Cash → Complete Done → No Receipt.
 */
export async function splitCardCash(): Promise<string> {
  await returnToHome();
  const id = await app.createOrder({ staff: CARD_STAFF, services: [CARD_SERVICE] });
  await S.openSplit();
  try {
    await step('Check 1 → Card → Pay (terminal, No Tip, sign)', async () => {
      await S.selectCheck(id, 1);
      await clickOrJs(S.methodButton('Card'), 3_000);
      await settle(300);
      await clickOrJs(S.payButton, 3_000);
      await watchCard(async () => visible(S.paidDialog(1)), { timeoutMs: 180_000, reset: true });
      await S.closePaidDialog(1);
    });
    await step('Check 2 → Cash → Complete Check 2', async () => {
      await S.payCheck(id, 2, 'Cash');
    });
    await step('Complete Done → No Receipt', async () => {
      await S.completeDone();
      await app.noReceipt();
    });
    return id;
  } catch (e) {
    await settleCardDialog().catch(() => undefined);
    await escapeSplit().catch(() => undefined);
    throw e;
  }
}
