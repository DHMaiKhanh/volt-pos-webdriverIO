/**
 * VP-5627 helpers — Discount Setting "Custom promotion" default Owner/Staff split.
 * docs/qc/volt-qc/vp-tickets/VP-5627-custom-promotion-default-split-test-cases.md
 */

import { btn, inMain, type VqcQuery } from '../../../src/constants/testids.voltqc-pos.js';
import { settle } from '../../../src/helpers/wait.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { dismissCustomerNote, inPromo } from '../../../src/pages/voltqc/promo-split/promoFlows.js';
import { app, waitUntil } from '../../../src/pages/voltqc/promo-split/vqApp.js';

const str = (k: string, d: string): string => process.env[k]?.trim() || d;

export const vp5627 = {
  service: str('VP5627_SERVICE', 'Tropical Deluxe'),
  service2: str('VP5627_SERVICE_2', 'Express Pedicure'),
  customer: str('VP5627_CUSTOMER', 'QC Camp Oxcqwp'),
  customerSearch: str('VP5627_CUSTOMER_SEARCH', 'QC Camp'),
  /** "New Client" is only offered to a customer with no paid visit yet — TC-15 never pays, so this one stays new. */
  promoCustomer: str('VP5627_PROMO_CUSTOMER', 'QC Camp Qbvzjg'),
  promotion: str('VP5627_PROMOTION', 'New Client'),
  reward: str('VP5627_REWARD', 'test redeem'),
};

export const SUBTITLE = 'Split of a promotion discount between the owner and the staff.';
export const TOTAL_ERROR_RE = '[Mm]ust total 100%';

/* ------------------------------------------------------------------------- *
 * Local DB (graphql IPC, read-only)
 * ------------------------------------------------------------------------- */

async function gql<T>(query: string): Promise<T> {
  return P.exec<T>(
    `return window.__TAURI_INTERNALS__.invoke('graphql', { query: arguments[0], variables: null, operation: null })
       .then(function (r) { return (r && r.data) || null; });`,
    query,
  );
}

export interface PromoSettings {
  custom: number;
  available: number;
}

/** Owner % of both promotion splits as stored on this device. */
export async function readSettings(): Promise<PromoSettings> {
  const d = await gql<{ sysSettingList: { key: string; value: string }[] }>(
    '{ sysSettingList(where:{key:{like:"%promotion_discount%"}}){ key value } }',
  );
  const v = (k: string): number => Number(d.sysSettingList.find((x) => x.key === k)?.value ?? NaN);
  return { custom: v('merchant_custom_promotion_discount'), available: v('merchant_promotion_discount') };
}

export interface OrderSplit {
  owner: number | null;
  staff: number | null;
  campaignId: string | null;
  redeemId: string | null;
  items: { fee: number | null; discountType: string | null; discountRate: number | null }[];
}

export async function readOrder(code: string): Promise<OrderSplit> {
  const d = await gql<{
    orderList: {
      merchantPromotionPercent: number | null;
      staffPromotionPercent: number | null;
      campaignId: string | null;
      redeemId: string | null;
      orderItemListById: {
        staffPromotionFeeAmount: number | null;
        discountType: string | null;
        discountRate: number | null;
      }[];
    }[];
  }>(
    `{ orderList(where:{orderCode:{eq:${JSON.stringify(code)}}}){ merchantPromotionPercent staffPromotionPercent campaignId redeemId
       orderItemListById { staffPromotionFeeAmount discountType discountRate } } }`,
  );
  const o = d.orderList[0];
  if (!o) throw new Error(`VP-5627: order ${code} not in the local DB`);
  return {
    owner: o.merchantPromotionPercent,
    staff: o.staffPromotionPercent,
    campaignId: o.campaignId,
    redeemId: o.redeemId,
    items: o.orderItemListById.map((i) => ({
      fee: i.staffPromotionFeeAmount,
      discountType: i.discountType,
      discountRate: i.discountRate,
    })),
  };
}

/** Poll the order until `ok` holds (the app writes the split a beat after Apply). */
export async function waitOrder(
  code: string,
  ok: (o: OrderSplit) => boolean,
  timeout = 10_000,
): Promise<OrderSplit> {
  let last = await readOrder(code);
  await waitUntil(
    async () => {
      last = await readOrder(code);
      return ok(last);
    },
    timeout,
    300,
  );
  return last;
}

/* ------------------------------------------------------------------------- *
 * POS › Setting › Charge & Fee
 * ------------------------------------------------------------------------- */

const IN = (k: string): VqcQuery => ({ css: `[data-vp5627="${k}"]`, nth: 0 });
export const chargeFee = {
  availableOwner: IN('a0'),
  availableStaff: IN('a1'),
  customOwner: IN('c0'),
  customStaff: IN('c1'),
  save: IN('save'),
};

/** Tag the 4 split inputs and the Discount Setting card's own Save button. */
async function stampChargeFee(): Promise<boolean> {
  return P.exec<boolean>(
    `var leaf = function (t) { return Array.prototype.find.call(document.querySelectorAll('main *'), function (e) { return e.children.length === 0 && (e.textContent || '').trim() === t; }); };
     var tag = function (heading, p) {
       var box = leaf(heading); while (box && box.querySelectorAll('input').length < 2) box = box.parentElement;
       if (!box) return false;
       var ins = box.querySelectorAll('input'); ins[0].setAttribute('data-vp5627', p + '0'); ins[1].setAttribute('data-vp5627', p + '1'); return true;
     };
     var sub = leaf(arguments[0]); var save = sub && sub.parentElement ? sub.parentElement.querySelector('button') : null;
     if (save) save.setAttribute('data-vp5627', 'save');
     return tag('Available promotions', 'a') && tag('Custom promotion', 'c') && !!save;`,
    SUBTITLE,
  );
}

export async function openChargeFee(): Promise<void> {
  await app.go('/settings/charge-fee');
  await P.waitFor(inMain({ text: 'Custom promotion', nth: 0 }), 15_000, 'Charge & Fee › Custom promotion');
  // The card renders 100/0 for ~1s before the stored values load.
  const s = await readSettings();
  const ok = await waitUntil(
    async () => (await stampChargeFee()) && Number(await P.inputValue(chargeFee.customOwner)) === s.custom,
    10_000,
    250,
  );
  if (!ok) await stampChargeFee();
}

export async function chargeFeeValues(): Promise<{ a: [number, number]; c: [number, number] }> {
  const n = async (q: VqcQuery): Promise<number> => Number(await P.inputValue(q));
  return {
    a: [await n(chargeFee.availableOwner), await n(chargeFee.availableStaff)],
    c: [await n(chargeFee.customOwner), await n(chargeFee.customStaff)],
  };
}

export async function typeCustom(owner: number, staff: number): Promise<void> {
  await P.fillQ(chargeFee.customOwner, String(owner));
  await P.fillQ(chargeFee.customStaff, String(staff));
  await settle(400);
}

/** Set the Custom split on POS and wait until the device stores it. */
export async function setCustomOnPos(owner: number): Promise<void> {
  await openChargeFee();
  if ((await readSettings()).custom === owner) return;
  await typeCustom(owner, 100 - owner);
  await P.clickQ(chargeFee.save);
  const ok = await waitUntil(async () => (await readSettings()).custom === owner, 15_000, 400);
  if (!ok) throw new Error(`VP-5627: Custom owner share never became ${String(owner)} on the device`);
}

/* ------------------------------------------------------------------------- *
 * Order helpers
 * ------------------------------------------------------------------------- */

/** Search an existing customer on the order keypad and pick it from "Customers Found". */
export async function attachCustomer(search: string, name: string): Promise<boolean> {
  await app.clickCustomerField();
  const box = inMain({ css: 'input[placeholder="Phone, name or email"]', nth: 0 });
  await P.fillQ(box, search);
  const row: VqcQuery = { textRe: `^${name}$`, nth: -1 };
  if (!(await waitUntil(() => P.has(row), 8_000, 250))) return false;
  await P.clickQ(row);
  await dismissCustomerNote();
  return waitUntil(() => P.has(inMain({ text: name, nth: 0 })), 8_000, 250);
}

/** A promotion / reward row in the open Promo & Rewards dialog. */
export const promoRow = (name: string): readonly VqcQuery[] => inPromo({ textRe: `^${name}$`, nth: 0 });

export async function closePromoIfOpen(): Promise<void> {
  if (await P.has(inPromo(btn('Close', 0)))) await P.clickQ(inPromo(btn('Close', 0))).catch(() => undefined);
}
