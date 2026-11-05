/**
 * VP-5195 helpers — the customer display's "No, enter again" takes the refused
 * customer off the staff order.
 *
 * NOT a spec. Builds on the volt-qc CD layer (`cdApp` / `customerScreen`) and
 * adds what that layer lacks for this ticket: picking a promotion / reward row
 * in Promo & Rewards, the toast the staff window raises, the Pending Orders
 * card total, and the order / customer rows the oracle reads over GraphQL.
 *
 * Test data comes from env with merchant #14 defaults (dev only):
 *   VP5195_PHONE_A   — refused customer, has points + rewards  (2052051122, Tuti)
 *   VP5195_PHONE_B   — the "other number" customer            (0250251234, Kong)
 *   VP5195_PROMOTION — a customer promotion listed for A        ("Remind after 15 days not visit")
 *   VP5195_REWARD    — a reward A can redeem                    ("Reward 10%")
 */

import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { gql } from '../../../src/api/index.js';
import { CdMain, type VqcQuery } from '../../../src/constants/testids.voltqc-cd-e2e.js';
import { settle } from '../../../src/helpers/wait.js';
import { switchToMain } from '../../../src/helpers/window.js';
import { app, moneyField } from '../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { parseMoney } from '../../../src/utils/money.js';

const digits = (v: string | undefined, fallback: string): string => (v ?? '').replace(/\D/g, '') || fallback;

export const vp5195 = {
  phoneA: digits(process.env.VP5195_PHONE_A, '2052051122'),
  phoneB: digits(process.env.VP5195_PHONE_B, '0250251234'),
  promotion: process.env.VP5195_PROMOTION?.trim() || 'Remind after 15 days not visit',
  reward: process.env.VP5195_REWARD?.trim() || 'Reward 10%',
} as const;

/** en / vi copy of `global.customerRejectedPhone`. */
export const REJECTED_TOAST_RE =
  /The customer said this is not their number|Khách xác nhận đây không phải số của mình/;

/* ----------------------------------------------------------------------- *
 * Staff window
 * ----------------------------------------------------------------------- */

/** Every sonner toast currently on the staff window. */
export function toastTexts(): Promise<string[]> {
  return P.exec<string[]>(
    'return Array.prototype.map.call(document.querySelectorAll("[data-sonner-toast]"), function (t) { return String(t.innerText || "").trim(); });',
  );
}

/** Wait for a toast matching `re`; '' when none showed within `timeout`. */
export async function waitToast(re: RegExp, timeout: number = Timeouts.MEDIUM): Promise<string> {
  await switchToMain();
  let hit = '';
  try {
    await browser.waitUntil(
      async () => {
        hit = (await toastTexts()).find((t) => re.test(t)) ?? '';
        return hit !== '';
      },
      { timeout, interval: 150 },
    );
  } catch {
    // Timed out: '' tells the spec no toast showed.
  }
  return hit;
}

/** Is the staff-side customer search keypad ("Phone, name or email" + Back/Done) open? */
export function staffKeypadOpen(): Promise<boolean> {
  return P.has([{ css: 'main' }, { role: 'button', name: 'Back', nth: 0 }]);
}

/** Close the staff customer keypad (Back) so the order totals are visible again. */
export async function closeStaffKeypad(): Promise<void> {
  if (await staffKeypadOpen()) {
    await P.clickQ([{ css: 'main' }, { role: 'button', name: 'Back', nth: 0 }]);
    await settle(500);
  }
}

/** Is a customer chip on the open order? */
export function hasCustomerChip(): Promise<boolean> {
  return P.has(CdMain.customerBox);
}

/** Wait until the customer chip is gone (or present when `present`). */
export async function waitCustomerChip(
  present: boolean,
  timeout: number = Timeouts.MEDIUM,
): Promise<boolean> {
  try {
    await browser.waitUntil(async () => (await hasCustomerChip()) === present, { timeout, interval: 250 });
    return true;
  } catch {
    return false;
  }
}

/** "Reward Redemption" line of the order panel in cents (NaN when absent). */
export async function rewardRedemptionCents(): Promise<number> {
  return moneyField(await app.text('main'), 'Reward Redemption');
}

/** Total printed on the Pending Orders card of `code` (cents, NaN when absent). */
export async function pendingCardTotal(code: string): Promise<number> {
  const card: readonly VqcQuery[] = [CdMain.pendingSidebar, { role: 'button', nameRe: `^${code}`, nth: 0 }];
  if (!(await P.has(card))) return Number.NaN;
  const m = /-?\$[\d,]+\.\d{2}/.exec(await P.textOf(card));
  return m ? parseMoney(m[0]) : Number.NaN;
}

/**
 * Poll the Pending Orders card of `code` until it shows `wantCents` (±1¢);
 * returns the last read either way, so a card that never catches up is told
 * apart from one that is merely slow.
 */
export async function waitPendingCardTotal(
  code: string,
  wantCents: number,
  timeout = 15_000,
): Promise<number> {
  let last = await pendingCardTotal(code);
  try {
    await browser.waitUntil(
      async () => {
        last = await pendingCardTotal(code);
        return Math.abs(last - wantCents) <= 1;
      },
      { timeout, interval: 500 },
    );
  } catch {
    // Timed out: the spec asserts on the last read.
  }
  return last;
}

/**
 * Promo & Rewards → tick each promotion / reward row by its label → Apply
 * (+ passcode). Rows are `button[role=checkbox]` next to the label; one already
 * ticked is left alone.
 */
export async function applyPromoRows(labels: readonly string[], customPercent?: number): Promise<void> {
  await switchToMain();
  // Not `CdMain.promoRewards`: with a customer on the order the button carries a
  // count badge ("Promo & Rewards 7"), so an exact accessible name never matches.
  await P.clickQ(PROMO_BUTTON);
  await P.waitFor(CdMain.promoDialog, Timeouts.SHORT, 'Promo & Rewards dialog');
  if (customPercent !== undefined) {
    await tickPromoRow('Custom Discount');
    await P.clickQ([CdMain.promoDialog, { role: 'tab', name: 'Percentage %', nth: 0 }]);
    await P.fillQ([CdMain.promoDialog, { role: 'textbox', nth: 0 }], String(customPercent));
  }
  for (const label of labels) await tickPromoRow(label);
  await P.clickQ([CdMain.promoDialog, { role: 'button', name: 'Apply', nth: 0 }]);
  await answerApplyDiscountGuard();
  await P.waitGoneQ(CdMain.promoDialog, Timeouts.MEDIUM, 'Promo & Rewards dialog');
  await settle(700);
}

/**
 * The "Enter staff code to access Apply Discount" guard. `app.applyPromo` only
 * waits 2.5 s for it; on a freshly booted app (no 30-minute skip yet) it comes
 * up later than that and the apply silently never happens.
 */
async function answerApplyDiscountGuard(timeout = 8_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await P.has(CdMain.passcodeDialog)) {
      const code = env.STAFF_PASSCODE || env.OWNER_PASSCODE;
      for (const c of code) await P.clickQ([CdMain.passcodeDialog, { role: 'button', name: c, nth: 0 }]);
      await P.waitGoneQ(CdMain.passcodeDialog, Timeouts.MEDIUM, 'staff code guard');
      return;
    }
    if (!(await P.has(CdMain.promoDialog))) return; // applied without a guard
    await settle(250);
  }
}

const PROMO_BUTTON: readonly VqcQuery[] = [
  { css: 'main' },
  { role: 'button', nameRe: '^Promo & Rewards', nth: 0 },
];

async function tickPromoRow(label: string): Promise<void> {
  const box: readonly VqcQuery[] = [
    CdMain.promoDialog,
    { css: 'div', hasText: label, hasCss: 'button[role="checkbox"]', nth: -1 },
    { role: 'checkbox', nth: 0 },
  ];
  await P.waitFor(box, Timeouts.MEDIUM, `"${label}" row in Promo & Rewards`);
  if ((await P.attrOf(box, 'aria-checked')) !== 'true') await P.clickQ(box);
}

/* ----------------------------------------------------------------------- *
 * Oracle (GraphQL)
 * ----------------------------------------------------------------------- */

export interface OrderRow {
  id: string;
  customerId: string | null;
  redeemId: string | null;
  campaignId: string | null;
  total: number;
  status: string;
}

const ORDER_BY_CODE = `query vp5195Order($code: String!) {
  orderList(where: { orderCode: { eq: $code } }) { id customerId redeemId campaignId total status }
}`;

const CUSTOMER_BY_PHONE = `query vp5195Customer($phone: String!) {
  customerList(where: { phone: { eq: $phone } }) { id name pointBalance }
}`;

/*
 * The oracle must query from the STAFF window: the customer webview answers the
 * same `graphql` command against a reduced schema (no `customerList`, empty
 * lists), so each entry point switches there first.
 */

async function readOrder(code: string): Promise<OrderRow> {
  const data = await gql().query<{ orderList: OrderRow[] }>(ORDER_BY_CODE, {
    operationName: 'vp5195Order',
    variables: { code },
  });
  const row = data.orderList[0];
  if (!row) throw new Error(`Order ${code} is not in the local schema.`);
  return row;
}

export async function orderRow(code: string): Promise<OrderRow> {
  await switchToMain();
  return readOrder(code);
}

/** Poll the order row until `ok` holds; returns the last read either way. */
export async function waitOrderRow(
  code: string,
  ok: (r: OrderRow) => boolean,
  timeout: number = Timeouts.MEDIUM,
): Promise<OrderRow> {
  let last = await orderRow(code);
  try {
    await browser.waitUntil(
      async () => {
        last = await readOrder(code);
        return ok(last);
      },
      { timeout, interval: 500 },
    );
  } catch {
    // Timed out: the spec asserts on the last read.
  }
  return last;
}

export interface CustomerRow {
  id: string;
  name: string;
  pointBalance: number;
}

/**
 * The single customer with `phone`; throws when none or several share it.
 * Polls while the list is empty: right after an app boot the customer table is
 * still syncing and answers with no rows for a few seconds.
 */
export async function customerByPhone(phone: string, timeout: number = Timeouts.API): Promise<CustomerRow> {
  await switchToMain();
  const read = async (): Promise<CustomerRow[]> =>
    (
      await gql().query<{ customerList: CustomerRow[] }>(CUSTOMER_BY_PHONE, {
        operationName: 'vp5195Customer',
        variables: { phone },
      })
    ).customerList;
  let rows = await read();
  if (rows.length === 0) {
    try {
      await browser.waitUntil(
        async () => {
          rows = await read();
          return rows.length > 0;
        },
        { timeout, interval: 1_000 },
      );
    } catch {
      // Still empty: reported below with the window the query ran in.
    }
  }
  if (rows.length !== 1) {
    throw new Error(
      `Phone ${phone} matches ${String(rows.length)} customers (window ${await browser.getUrl()}) — ` +
        'set VP5195_PHONE_A/B to a unique number.',
    );
  }
  return rows[0] as CustomerRow;
}
