/**
 * Shared helpers for the per-ticket specs
 *   - vp-4375-fixed-discount-cap.spec.ts      (VP-4375)
 *   - vp-4376-gift-card-cancel-guard.spec.ts  (VP-4376)
 *   - vp-4802-promo-rewards-count.spec.ts     (VP-4802)
 *
 * Built on the volt-qc promo/split port (`src/pages/voltqc/promo-split/*`) — the
 * same Quick Pay, Promo & Rewards, checkout and Order History drivers the
 * PROMO-D* cases use — plus three things those modules do not have:
 *
 *   1. **Read-only GraphQL oracles** through the app's own `graphql` IPC
 *      (`src/api`): the order row + its lines as SAVED (`totalPromotionDiscount`,
 *      `rewardRedemptionAmount`, line `discountAmount`, `staffPromotionFeeAmount`),
 *      the customer's offers exactly as `use-promotion.ts` queries them, and the
 *      gift-card history of an order. Every document is transcribed from the app
 *      (`src/shared/graphql/order.gql.ts`, `-promotion/promotions.gql.ts`).
 *   2. **The Promo & Rewards badge** (VP-4802) — the trigger's accessible name
 *      changes once the badge renders, so the exact-name `VqpsHome.promoButton`
 *      cannot be used to open the dialog on an order that has a customer.
 *   3. **An in-page stub of ONE GraphQL operation** (`getGiftCardByCode`) for the
 *      VP-4376 guard. The ticket reproduces with Fiddler/Charles; here the
 *      webview's `__TAURI_INTERNALS__.invoke` is wrapped for that operation only
 *      and restored afterwards. Nothing is written through it.
 *
 * Money: the volt-qc helpers speak DOLLARS, the schema speaks CENTS. Every
 * function here says which in its name (`…Cents`) or its doc.
 */

import { env } from '../../../configs/env/loadEnv.js';
import { gql } from '../../../src/api/index.js';
import { btn, inMain, type VqcQuery } from '../../../src/constants/testids.voltqc-pos.js';
import { VqpsHistory } from '../../../src/constants/testids.voltqc-promo-split.js';
import { VpCancelGuard, VpPromoTrigger, vpPromoBadge } from '../../../src/constants/testids.vp-promo-gc.js';
import { activeGiftCards } from '../../../src/data/index.js';
import { settle } from '../../../src/helpers/wait.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  addGiftCardLine,
  applyPromo,
  attachExistingCustomer,
  fillCustom,
  homeCustomerStats,
  promoSplitInputs,
} from '../../../src/pages/voltqc/promo-split/promoFlows.js';
import { dismissCustomerNote } from '../../../src/pages/voltqc/promo-split/promoFlows.js';
import { addQuickPay, startOrder } from '../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  app,
  appears,
  escapeRe,
  money,
  visible,
  vqEnv,
  waitUntil,
} from '../../../src/pages/voltqc/promo-split/vqApp.js';

/* ------------------------------------------------------------------------- *
 * Test data
 * ------------------------------------------------------------------------- */

const str = (k: string): string => (process.env[k] ?? '').trim();
const digits = (s: string): string => s.replace(/\D/g, '');

/** An ACTIVE gift card of this merchant to top up into an order (VOLT_TEST_GIFT_CARD, else the catalog). */
export function vpGiftCardCode(): string {
  return vqEnv.testGiftCard || (activeGiftCards[0]?.code ?? '');
}

/** A customer phone for a case, falling back to the loyalty fixture. */
export function vpCustomerPhone(key: string): string {
  return digits(str(key)) || env.LOYALTY_CUSTOMER_PHONE;
}

/** `promotion` logic type the app stores for a FIXED amount (`PROMOTION_TYPE.FIXED`). */
export const FIXED = 'usd';

/** "now" the way `formatToUTCRFC3339` sends it. */
const rfc3339Now = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/* ------------------------------------------------------------------------- *
 * GraphQL oracles (read-only)
 * ------------------------------------------------------------------------- */

export interface VpOrderLine {
  id: string;
  serviceName: string | null;
  servicePrice: number | null;
  finalPrice: number | null;
  giftCardId: string | null;
  discountAmount: number | null;
  staffPromotionFeeAmount: number | null;
  staffId: string | null;
}

export interface VpOrder {
  id: string;
  orderCode: string;
  status: string;
  customerId: string | null;
  total: number;
  totalDiscount: number;
  totalPromotionDiscount: number | null;
  itemDiscountPromotion: number | null;
  rewardRedemptionAmount: number | null;
  campaignId: string | null;
  redeemId: string | null;
  logicType: string | null;
  logicValue: number | null;
  merchantPromotionPercent: number | null;
  staffPromotionPercent: number | null;
  orderItemListById: VpOrderLine[];
}

const ORDER_SNAPSHOT = `
  query vpOrderSnapshot($code: String) {
    orderList(where: { orderCode: { eq: $code } }, limit: 1) {
      id
      orderCode
      status
      customerId
      total
      totalDiscount
      totalPromotionDiscount
      itemDiscountPromotion
      rewardRedemptionAmount
      campaignId
      redeemId
      logicType
      logicValue
      merchantPromotionPercent
      staffPromotionPercent
      orderItemListById(orderBy: { id: asc }, where: { status: { isNull: true } }) {
        id
        serviceName
        servicePrice
        finalPrice
        giftCardId
        discountAmount
        staffPromotionFeeAmount
        staffId
      }
    }
  }
`;

/** The order row + its live lines, as the local schema holds them (CENTS). */
export async function orderSnapshot(code: string): Promise<VpOrder | null> {
  const data = await gql().query<{ orderList: VpOrder[] }>(ORDER_SNAPSHOT, {
    operationName: 'vpOrderSnapshot',
    variables: { code },
  });
  return data.orderList[0] ?? null;
}

/** Poll the snapshot until `ok` holds (completion writes land a beat after Payment Successful). */
export async function waitOrderSnapshot(
  code: string,
  ok: (o: VpOrder) => boolean,
  timeoutMs = 30_000,
): Promise<VpOrder> {
  let last: VpOrder | null = null;
  await waitUntil(
    async () => {
      last = await orderSnapshot(code).catch(() => null);
      return last !== null && ok(last);
    },
    timeoutMs,
    1_000,
  );
  if (!last) throw new Error(`Order ${code} not found in the local schema`);
  return last;
}

/** The non-gift-card lines (the ones a promotion / reward may discount). */
export const serviceLines = (o: VpOrder): VpOrderLine[] => o.orderItemListById.filter((l) => !l.giftCardId);

export interface VpCampaign {
  id: string;
  name: string;
  logicType: string | null;
  /** USD for a FIXED campaign (the app cents-normalizes on read). */
  logicValue: number | null;
  isActive: boolean | null;
}

export interface VpReward {
  id: string;
  content: string;
  point: number;
  logicType: string | null;
  /** USD for a FIXED reward. */
  logicValue: number | null;
  isActive: boolean | null;
}

const CUSTOMER_CAMPAIGN_IDS = `
  query vpCustomerCampaignIds($where: CampaignCustomerComparisonExp!) {
    campaignCustomerList(where: $where) {
      campaignId
      isUsed
    }
  }
`;

const CAMPAIGNS_BY_IDS = `
  query vpCampaignsByIds($where: CampaignComparisonExp!) {
    campaignList(where: $where) {
      id
      name
      logicType
      logicValue
      isActive
    }
  }
`;

const REDEEM_LIST = `
  query vpRedeemList($where: RedeemComparisonExp!) {
    redeemList(where: $where, orderBy: [{ point: desc }]) {
      id
      content
      point
      logicType
      logicValue
      isActive
    }
  }
`;

/**
 * The customer's promotions exactly as the picker lists them
 * (`useGetCustomerPromotionInfo`): unused, campaign not expired. Note the app
 * does NOT filter `isActive` / `startDate` (QC note on VP-4802) — neither does this.
 */
export async function customerPromotions(customerId: string): Promise<VpCampaign[]> {
  const now = rfc3339Now();
  const ids = await gql().query<{ campaignCustomerList: { campaignId: string | null }[] }>(
    CUSTOMER_CAMPAIGN_IDS,
    {
      operationName: 'vpCustomerCampaignIds',
      variables: {
        where: {
          customerId: { eq: customerId },
          isUsed: { eq: false },
          campaign: { expirationDate: { gte: now } },
        },
      },
    },
  );
  const campaignIds = ids.campaignCustomerList.map((c) => c.campaignId).filter((x): x is string => !!x);
  if (campaignIds.length === 0) return [];
  const list = await gql().query<{ campaignList: VpCampaign[] }>(CAMPAIGNS_BY_IDS, {
    operationName: 'vpCampaignsByIds',
    variables: { where: { id: { in: campaignIds }, expirationDate: { gte: now } } },
  });
  return list.campaignList;
}

/** Rewards the customer's points can afford (`useGetCustomerRedeemList`: `point <= points`, nothing else). */
export async function affordableRewards(points: number): Promise<VpReward[]> {
  const data = await gql().query<{ redeemList: VpReward[] }>(REDEEM_LIST, {
    operationName: 'vpRedeemList',
    variables: { where: { point: { lte: points } } },
  });
  return data.redeemList;
}

/** What the VP-4802 badge must show for this customer: promotions + affordable rewards. */
export async function expectedOfferCount(
  customerId: string,
  points: number,
): Promise<{ promotions: number; rewards: number; total: number }> {
  const [promos, rewards] = await Promise.all([customerPromotions(customerId), affordableRewards(points)]);
  return { promotions: promos.length, rewards: rewards.length, total: promos.length + rewards.length };
}

export interface VpGiftCardHistory {
  code: string | null;
  type: string | null;
  giftCardId: string | null;
  balanceChange: number | null;
  giftCard: { code: string | null; posGiftCard: { code: string | null } | null } | null;
}

const GIFT_CARD_HISTORY_BY_ORDER = `
  query vpGiftCardHistoryByOrder($orderId: String!) {
    giftCardHistoryList(where: { orderId: { eq: $orderId } }, orderBy: [{ createdAt: asc }]) {
      code
      type
      giftCardId
      balanceChange
      giftCard {
        code
        posGiftCard {
          code
        }
      }
    }
  }
`;

export async function giftCardHistoryOf(orderId: string): Promise<VpGiftCardHistory[]> {
  const data = await gql().query<{ giftCardHistoryList: VpGiftCardHistory[] }>(GIFT_CARD_HISTORY_BY_ORDER, {
    operationName: 'vpGiftCardHistoryByOrder',
    variables: { orderId },
  });
  return data.giftCardHistoryList;
}

/**
 * The guard's lookup order for one top-up history row (`resolveLookupCodes`):
 * `giftCard.code` → `history.code` → `giftCard.posGiftCard.code`, digits only, de-duplicated.
 */
export function lookupCodes(h: VpGiftCardHistory): string[] {
  const codes = [h.giftCard?.code, h.code, h.giftCard?.posGiftCard?.code]
    .map((c) => digits(c ?? ''))
    .filter(Boolean);
  return [...new Set(codes)];
}

/* ------------------------------------------------------------------------- *
 * Order building (volt-qc drivers)
 * ------------------------------------------------------------------------- */

/** Quick Checkout → staff → Quick Pay lines (cents, named). Returns the order code. */
export async function quickPayLinesOrder(lines: { cents: number; name: string }[]): Promise<string> {
  const code = await startOrder(vqEnv.testStaff);
  for (const l of lines) await addQuickPay(l);
  return code;
}

/** Top a gift card into the OPEN order (no payment). `dollars` 25/50/100 use the presets. */
export async function addGiftCardTopUp(dollars: number, code = vpGiftCardCode()): Promise<void> {
  if (!code) throw new Error('No active gift card: set VOLT_TEST_GIFT_CARD');
  await addGiftCardLine(code, dollars);
}

/** Remove a cart line by name; answers the passcode guard if the till asks. */
export async function removeLine(name: string): Promise<void> {
  await app.removeItem(name);
  await app.passcodeIfAsked(1_500);
  await waitUntil(async () => (await app.itemRowCount(name)) === 0, 8_000);
  await app.idle(300);
}

/** Open Promo & Rewards through the badge-tolerant trigger and wait for the lists to load. */
export async function openPromoDialog(): Promise<void> {
  await dismissCustomerNote();
  await P.clickQ(VpPromoTrigger.button);
  await P.waitFor(VpPromoTrigger.dialog, 8_000, 'Promo & Rewards');
  await P.waitFor(
    [VpPromoTrigger.dialog, { textRe: VpPromoTrigger.loadedRe, nth: 0 }],
    10_000,
    'promo lists',
  );
  await settle(500);
}

/** Close the dialog with its X. */
export async function closePromoDialog(): Promise<void> {
  await P.clickQ([VpPromoTrigger.dialog, btn('Close', 0)]);
  await P.waitGoneQ(VpPromoTrigger.dialog, 5_000);
}

/** Tick a promotion / reward row by its visible name (campaign.name / redeem.content). */
export async function selectOffer(name: string): Promise<void> {
  await P.clickQ([VpPromoTrigger.dialog, { css: VpPromoTrigger.offerRowCss, hasText: name, nth: 0 }]);
  await settle(300);
}

/** Selectable promotion + reward rows in the open dialog. */
export async function dialogOfferCount(): Promise<number> {
  return P.count([VpPromoTrigger.dialog, { css: VpPromoTrigger.offerRowCss }]);
}

/** Owner share in "Order promotion discount setting" (Staff auto-fills to 100 − owner). */
export async function setOwnerPercent(owner: number): Promise<void> {
  const { owner: box } = await promoSplitInputs();
  await P.fillQ(box, String(owner));
}

/** Custom Discount, Amount $ (`dollars`), optional Owner share — does NOT press Apply. */
export async function typeCustomFixed(dollars: number): Promise<void> {
  await fillCustom('$', String(Math.round(dollars * 100)));
}

/** Apply (passcode if asked) and wait the dialog out. */
export { applyPromo };

/**
 * The VP-4375 reproduction on a till whose dialog caps the typed amount
 * ("Discount cannot exceed $X"): two lines of `lineCents`, a custom FIXED of
 * `typedDollars` that fits the two-line budget, split Owner/Staff, then the
 * second line is removed so the promotion is larger than what it may discount.
 * Optionally a gift-card top-up line of `giftCardDollars` rides along.
 */
export async function overBudgetCustomOrder(o: {
  lineCents: number;
  typedDollars: number;
  ownerPercent?: number;
  giftCardDollars?: number;
}): Promise<{ code: string; keep: string; removed: string }> {
  const tag = String(Date.now()).slice(-5);
  const keep = `QC VP4375 A${tag}`;
  const removed = `QC VP4375 B${tag}`;
  const code = await quickPayLinesOrder([
    { cents: o.lineCents, name: keep },
    { cents: o.lineCents, name: removed },
  ]);
  if (o.giftCardDollars) await addGiftCardTopUp(o.giftCardDollars);
  await openPromoDialog();
  await typeCustomFixed(o.typedDollars);
  if (o.ownerPercent !== undefined) await setOwnerPercent(o.ownerPercent);
  await applyPromo();
  await removeLine(removed);
  return { code, keep, removed };
}

/** Attach an existing customer and return the points the Home bar shows. */
export async function attachCustomer(phone: string): Promise<number> {
  await attachExistingCustomer(phone);
  // A customer with a note raises "Customer Note" — its overlay eats the next tile click.
  await dismissCustomerNote();
  let point = Number.NaN;
  await waitUntil(
    async () => {
      point = (await homeCustomerStats()).point;
      return Number.isFinite(point);
    },
    10_000,
    300,
  );
  return point;
}

/* ------------------------------------------------------------------------- *
 * Reading discount lines
 * ------------------------------------------------------------------------- */

/** First amount after a label matching `labelRe` in a " | "-joined text (DOLLARS, NaN when absent). */
export function discountLine(text: string, labelRe: string): number {
  const m = new RegExp(`(?:^|\\| )(?:${labelRe}) \\| (-?\\s*\\$[\\d,.]+)`).exec(text);
  return m ? money(m[1]) : Number.NaN;
}

/** `| Label | value` with a literal label. */
export const lineByLabel = (text: string, label: string): number => discountLine(text, escapeRe(label));

/* ------------------------------------------------------------------------- *
 * VP-4802 badge
 * ------------------------------------------------------------------------- */

/** Badge text, or '' when the trigger shows no badge. */
export async function readPromoBadge(): Promise<string> {
  if (!(await visible(vpPromoBadge()))) return '';
  return (await P.textOf(vpPromoBadge())).trim();
}

/** How the app renders a count: nothing for 0, "99+" past 99. */
export const badgeText = (n: number): string => (n <= 0 ? '' : n > 99 ? '99+' : String(n));

/** Wait until the badge shows `badgeText(expected)` (it is held until both lists settle). Returns the last read. */
export async function waitPromoBadge(expected: number, timeoutMs = 15_000): Promise<string> {
  const want = badgeText(expected);
  let last = '';
  await waitUntil(
    async () => {
      last = await readPromoBadge();
      return last === want;
    },
    timeoutMs,
    400,
  );
  return last;
}

/* ------------------------------------------------------------------------- *
 * VP-4376 — gift-card lookup stub + cancel attempt
 * ------------------------------------------------------------------------- */

/** What the stub answers for a code: the API's "unresolved" empty card, a real card, or a transport error. */
export type GcStubAnswer =
  { kind: 'empty' } | { kind: 'card'; currentBalanceCents: number; status?: string } | { kind: 'error' };

/**
 * Wrap `__TAURI_INTERNALS__.invoke` (or, where invoke is non-writable, the
 * `window.fetch` that carries IPC to `ipc.localhost/graphql`) so `getGiftCardByCode`
 * answers `answer` for the listed codes (`'*'` = every code). Every other call
 * passes through. Returns false when neither can be wrapped — the caller skips then. Always pair with {@link removeGiftCardStub}.
 */
export async function installGiftCardStub(stubs: Record<string, GcStubAnswer>): Promise<boolean> {
  return P.exec<boolean>(
    `var stubs = arguments[0];
     var I = window.__TAURI_INTERNALS__;
     if (!I || typeof I.invoke !== 'function') return false;
     if (!window.__vpOrigInvoke) window.__vpOrigInvoke = I.invoke;
     window.__vpGcStubs = stubs;
     var wrapper = function (cmd, args) {
       try {
         var q = args && typeof args.query === 'string' ? args.query : '';
         if (cmd === 'graphql' && q.indexOf('giftCardQueryByCode') >= 0) {
           var code = String((args.variables && args.variables.code) || '').replace(/\\D/g, '');
           var s = window.__vpGcStubs && (window.__vpGcStubs[code] || window.__vpGcStubs['*']);
           if (s && s.kind === 'error') return Promise.reject('vp-stub: gift card lookup failed');
           if (s && s.kind === 'empty')
             return Promise.resolve({ data: { giftCardQueryByCode: { id: '', code: '', currentBalance: 0, posGiftCard: null, status: '' } } });
           if (s && s.kind === 'card')
             return Promise.resolve({ data: { giftCardQueryByCode: { id: 'vp-stub-' + code, code: code, currentBalance: s.currentBalanceCents, posGiftCard: null, status: s.status || 'active' } } });
         }
       } catch (e) { /* fall through to the real call */ }
       return window.__vpOrigInvoke.apply(I, arguments);
     };
     try { I.invoke = wrapper; } catch (e) { /* non-writable on newer builds */ }
     if (I.invoke === wrapper) return true;
     // Newer builds (seen on dev 1.1.106) define invoke non-writable, but IPC still
     // travels as fetch POST http://ipc.localhost/graphql — answer the lookup there.
     if (typeof window.fetch !== 'function') return false;
     if (!window.__vpOrigFetch) window.__vpOrigFetch = window.fetch;
     var reply = function (status, body, ok) {
       return Promise.resolve(new Response(body, { status: status, headers: { 'Content-Type': 'application/json', 'Tauri-Response': ok ? 'ok' : 'error' } }));
     };
     var fetchWrapper = function (input, init) {
       try {
         var url = typeof input === 'string' ? input : (input && input.url) || '';
         var body = init && typeof init.body === 'string' ? init.body : '';
         if (url.indexOf('ipc.localhost/graphql') >= 0 && body.indexOf('giftCardQueryByCode') >= 0) {
           var a = JSON.parse(body);
           var code = String((a.variables && a.variables.code) || '').replace(/\\D/g, '');
           var s = window.__vpGcStubs && (window.__vpGcStubs[code] || window.__vpGcStubs['*']);
           if (s && s.kind === 'error') return reply(200, JSON.stringify('vp-stub: gift card lookup failed'), false);
           if (s && s.kind === 'empty')
             return reply(200, JSON.stringify({ data: { giftCardQueryByCode: { id: '', code: '', currentBalance: 0, posGiftCard: null, status: '' } } }), true);
           if (s && s.kind === 'card')
             return reply(200, JSON.stringify({ data: { giftCardQueryByCode: { id: 'vp-stub-' + code, code: code, currentBalance: s.currentBalanceCents, posGiftCard: null, status: s.status || 'active' } } }), true);
         }
       } catch (e) { /* fall through to the real call */ }
       return window.__vpOrigFetch.apply(window, arguments);
     };
     try { window.fetch = fetchWrapper; } catch (e) { return false; }
     return window.fetch === fetchWrapper;`,
    stubs,
  );
}

/** Restore the original invoke (idempotent). */
export async function removeGiftCardStub(): Promise<void> {
  await P.exec<null>(
    `var I = window.__TAURI_INTERNALS__;
     if (I && window.__vpOrigInvoke) { try { I.invoke = window.__vpOrigInvoke; } catch (e) {} }
     if (window.__vpOrigFetch) { try { window.fetch = window.__vpOrigFetch; } catch (e) {} window.__vpOrigFetch = undefined; }
     window.__vpOrigInvoke = undefined;
     window.__vpGcStubs = undefined;
     return null;`,
  ).catch(() => null);
}

export interface CancelAttempt {
  /** The guard replaced the Cancel Order dialog with "Unable to Cancel Order". */
  blocked: boolean;
  /** The blocked dialog's text ('' when not blocked). */
  message: string;
  /** "Order canceled successfully" was seen. */
  canceled: boolean;
}

/**
 * Order History → order → Cancel Order → first reason → Confirm Cancel →
 * passcode → read which way the guard went. A blocked dialog is LEFT OPEN
 * (see {@link dismissCancelBlocked}).
 */
export async function attemptCancel(code: string): Promise<CancelAttempt> {
  await app.openHistoryOrder(code);
  await app.cancelOrder(0);
  const blockedOrDone = await waitUntil(
    async () =>
      (await visible(VpCancelGuard.blockedDialog)) ||
      (await visible({ textRe: escapeRe(VpCancelGuard.canceledToast), nth: 0 })),
    20_000,
    300,
  );
  if (!blockedOrDone) return { blocked: false, message: '', canceled: false };
  if (await visible(VpCancelGuard.blockedDialog)) {
    const message = ((await P.rawText(VpCancelGuard.blockedDialog)) ?? '').replace(/\s+/g, ' ').trim();
    return { blocked: true, message, canceled: false };
  }
  return { blocked: false, message: '', canceled: true };
}

/** OK on the blocked dialog. */
export async function dismissCancelBlocked(): Promise<void> {
  const ok: readonly VqcQuery[] = [VpCancelGuard.blockedDialog, btn('OK', 0)];
  if (await appears(ok, 2_000)) await P.clickQ(ok);
  await P.waitGoneQ(VpCancelGuard.blockedDialog, 5_000).catch(() => undefined);
}

/** Status field of the open Order History detail. */
export async function historyStatus(code: string): Promise<string> {
  const d = await app.historyDetail(code);
  return new RegExp(`\\| Status \\| ([^|]+)`).exec(d)?.[1]?.trim() ?? '';
}

/** A gift-card TOP-UP order paid in Cash; returns its code (No Receipt pressed). */
export async function paidGiftCardTopUpOrder(dollars: number, cardCode = vpGiftCardCode()): Promise<string> {
  if (!cardCode) throw new Error('No active gift card: set VOLT_TEST_GIFT_CARD');
  await app.quickCheckout();
  await addGiftCardLine(cardCode, dollars);
  const code = await app.orderId();
  app.createdOrders.add(code);
  await app.payCurrentOrder('Cash');
  await app.noReceipt();
  return code;
}

/** Cancel Order button on the Order History detail (Successful - Unsettled only). */
export const cancelOrderButton = VqpsHistory.cancelOrder;

/** `main` › text contains — tiny convenience for the order panel. */
export const inMainText = (text: string): readonly VqcQuery[] =>
  inMain({ hasText: text, css: 'div', nth: 0 });
