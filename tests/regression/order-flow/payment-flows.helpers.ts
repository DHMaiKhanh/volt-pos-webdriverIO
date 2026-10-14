/**
 * Shared scaffolding for the seven "payment flows" GUARD/SPEC specs
 * (split-order-guards / reopen-guards / cancel-order-guards / refund-guards /
 * tip-guards / gift-card-guards / payment-reliability), compiled from
 * docs/screens/order-flow/payment-flows-test-cases.md.
 *
 * NOT a spec (the runner globs `*.spec.ts`, this is `*.helpers.ts`): it holds the
 * fixtures those files share so a change to how an order is settled, how a
 * Settled order is located, or how a tip is seeded lands in one place.
 *
 * ## The three run conditions, encoded as gates
 *
 * The doc tags every case with the hardware/state it needs; §9 turned those into
 * the batch order. The gates below mirror the symbols:
 *
 *   - `✅`  cash / read-only — runs on any write-enabled till. No gate beyond
 *           `assertWritesAllowed`, which the flows already carry.
 *   - `💳`  real card + terminal — behind `CARD_SETTLE=1` (same flag
 *           charge-card-matrix.spec.ts uses). Off → the case skips.
 *   - `🌙`  needs an order already **Settled** — decision (b): we do NOT wait for
 *           the overnight batch close or seed one, we FILTER Order History for a
 *           Settled order and act on it. {@link openSettledOrderOrSkip} finds one
 *           or skips. A refund that actually moves money is further gated behind
 *           `REFUND_SETTLE=1` so a casual regression pass never refunds a real
 *           settled order — only reads its dialogs.
 *
 * `🔌` (fault-injection) is OUT OF SCOPE per §9 decision (a) and is never coded —
 * those cases live as documented pending `it()` stubs in the spec files.
 *
 * CREATES DATA. The cash fixture settles a real order; the refund gate, when on,
 * issues a real refund. dev / staging only.
 */

import { Timeouts } from '../../../configs/constants/timeouts.js';
import { giftCard } from '../../../src/data/index.js';
import {
  createOrder,
  goToOrderHistory,
  payInCash,
  payWithCard,
  returnToHome,
} from '../../../src/flows/index.js';
import {
  checkoutPage,
  homePage,
  orderHistoryDetailPage,
  orderHistoryPage,
} from '../../../src/pages/index.js';
import type { OrderHistoryDetailPage } from '../../../src/pages/index.js';
import { settle } from '../../../src/helpers/wait.js';
import { voidAnyDraft } from './charge-matrix.helpers.js';

/** `💳` opt-in: the real, money-moving card charge. Same flag as charge-card-matrix.spec.ts. */
export const CARD_SETTLE_ENABLED = process.env.CARD_SETTLE === '1';

/** `💳`/`🌙` opt-in for the cash/gift/other settles the charge matrices take. */
export const CHARGE_SETTLE_ENABLED = process.env.CHARGE_SETTLE === '1';

/**
 * `🌙` opt-in to actually CONFIRM a refund against a found Settled order.
 *
 * A refund moves money back and cannot be taken back, so a regression pass that
 * merely wants to prove the dialog autofills / offers the right methods must NOT
 * trigger one. With the flag off, the refund specs open the dialog, read it, and
 * close it; with it on, an operator who knows the order is a throwaway lets the
 * confirm go through.
 */
export const REFUND_SETTLE_ENABLED = process.env.REFUND_SETTLE === '1';

/** Does the merchant under test have a gift card configured to redeem? */
export const HAS_GIFT_CARD = giftCard.code !== '';

/**
 * Skip the current test, and tell TypeScript control does not continue.
 *
 * Mocha's `ctx.skip()` is typed `void` but THROWS a pending signal at runtime, so
 * code after it never runs. Returning `never` lets a caller write
 * `if (!orderId) skipTest(ctx)` and have `orderId` narrowed to a non-null string
 * on the next line — without a non-null assertion the lint config forbids.
 */
export function skipTest(ctx: Mocha.Context): never {
  ctx.skip();
  throw new Error('unreachable: Mocha ctx.skip() throws a pending signal');
}

/** A just-settled cash order, left on its Order History detail pane. */
export interface SettledCashOrder {
  orderId: string;
  /** What the cash tender actually charged, in cents — the figure the summary echoes. */
  paidTotalCents: number;
}

/**
 * Create a one-line order, settle it in cash, and leave the app on its Order
 * History detail pane.
 *
 * The workhorse behind every `✅`/unsettled GUARD: it manufactures a
 * "Successful - Unsettled" order — the richest action state (Cancel / Re-Open /
 * Adjust Tip) and the only status a single run can reach without the overnight
 * batch close. Mirrors the hook in order-detail-actions.spec.ts / adjust-tip.spec.ts.
 *
 * Needs the LAUNCH lane when the merchant pushes a tip prompt on cash (20258
 * does): `payInCash` drives the customer display, which is only a WebDriver
 * handle there — see [[cash-tip-flow-20258]].
 */
export async function createAndSettleCashOrder(): Promise<SettledCashOrder> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();

  const { orderId } = await createOrder();
  await checkoutPage.waitForReady();

  // Read the CASH total — what actually gets charged. createOrder leaves checkout
  // on the card tab, whose total carries the service fee, so reading it there
  // would compare history against a figure this cash order never charged.
  await checkoutPage.selectTender('cash');
  const paidTotalCents = await checkoutPage.totalCents();

  // Exact settle (no tendered amount): press Complete Payment on the pre-filled
  // balance rather than typing a total that might contain the preset-covered "9".
  const success = await payInCash(orderId);
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();

  await returnToHome();
  await goToOrderHistory();
  await orderHistoryPage.openOrder(orderId);
  await orderHistoryDetailPage.waitForOrder(orderId);

  return { orderId, paidTotalCents };
}

/** A Settled order located in Order History, open on its detail pane. */
export interface OpenedSettledOrder {
  orderId: string;
  detail: OrderHistoryDetailPage;
}

/**
 * `🌙` Filter Order History for a **Successful - Settled** order and open it, or
 * skip the test when none is in range.
 *
 * Decision (b) made concrete: we do not seed or wait for a settle, we pick one
 * that already exists. Two reasons a run finds nothing, both legitimate and both
 * a `skip` rather than a failure:
 *   1. No order has been batch-closed yet (a fresh merchant, or mid-day).
 *   2. The settled orders are older than the list's default date range, which has
 *      no addressable calendar yet (`OrderHistoryPage.openDateRange` notes this),
 *      so this cannot widen it.
 *
 * The caller passes its Mocha context so the skip is reported against the case.
 */
export async function openSettledOrderOrSkip(ctx: Mocha.Context): Promise<OpenedSettledOrder> {
  await returnToHome();
  const list = await goToOrderHistory();

  await list.openFilter();
  await list.filterByStatus('status-successful-settled');
  if (await list.canConfirmFilter()) {
    await list.confirmFilter();
  } else {
    // The checkbox was already applied from a prior case — nothing to confirm.
    await list.closeFilter();
  }
  await settle(Timeouts.DEBOUNCE);

  const orderId = await list.firstOrderId();
  if (!orderId) skipTest(ctx);

  const detail = await list.openOrder(orderId);
  return { orderId, detail };
}

/**
 * Compose a TWO-staff draft on the till, or skip when the roster is too short.
 *
 * Split Tip and the proportional-tip rules only engage with more than one staff
 * on the order, so several TIP cases need this. Leaves the app on the /home cart,
 * before Pay — the caller settles and seeds a tip. Books line 0 to staff tile 0,
 * then a second distinct line to staff tile 1, which the cart renders as a second
 * staff column (it groups by staff).
 */
export async function buildTwoStaffDraftOrSkip(ctx: Mocha.Context): Promise<void> {
  await voidAnyDraft();

  const staffCount = await homePage.visibleStaffCount();
  if (staffCount < 2) skipTest(ctx);

  await homePage.selectStaffByIndex(0);
  const serviceCount = await homePage.visibleServiceCount();
  await homePage.addServiceByIndex(0);

  await homePage.selectStaffByIndex(1);
  await homePage.addServiceByIndex(1 % Math.max(serviceCount, 1));
}

/** A just-charged card order (Auth, Successful - Unsettled), left on its Order History detail pane. */
export interface SettledCardOrder {
  orderId: string;
}

/**
 * `💳` Create a one-line order, charge it to a CARD with no tip, and leave the app
 * on its Order History detail pane.
 *
 * The card sibling of {@link createAndSettleCashOrder}: it manufactures a
 * "Successful - Unsettled" order whose single tender is a Card **Auth**, the state
 * Adjust Tip on card needs (TIP-R3 / VP-4157). Pays `tip: 'none'` so the tip starts
 * at $0 and the adjust is the thing under test, not the charge-time tip.
 *
 * Needs the LAUNCH lane + a real terminal — {@link payWithCard} drives the customer
 * display and waits on the Bamboo DOT approval — so a caller gates on
 * {@link CARD_SETTLE_ENABLED} and skips BEFORE calling this (a charge cannot be
 * un-taken by a late `this.skip()`).
 */
export async function createAndSettleCardOrder(): Promise<SettledCardOrder> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();

  const { orderId } = await createOrder();
  await checkoutPage.waitForReady();

  const success = await payWithCard(orderId, { tip: 'none' });
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();

  await returnToHome();
  await goToOrderHistory();
  await orderHistoryPage.openOrder(orderId);
  await orderHistoryDetailPage.waitForOrder(orderId);

  return { orderId };
}

/**
 * `💳` Build a TWO-staff order, charge it to a CARD with a seeded tip, and leave the
 * app on its Order History detail pane — the fixture Split Tip on card needs
 * (TIP-R7 / VP-4209).
 *
 * Split Tip engages only with more than one staff AND a tip on the order, so the
 * tip is seeded on the customer display during the charge (`customTipCents`). Skips
 * (via {@link buildTwoStaffDraftOrSkip}) when the roster is too short. Same launch
 * lane + terminal requirement as {@link createAndSettleCardOrder}; the caller gates
 * on {@link CARD_SETTLE_ENABLED} first.
 */
export async function createAndSettleTwoStaffCardOrderWithTip(
  ctx: Mocha.Context,
  tipCents: number,
): Promise<SettledCardOrder> {
  await buildTwoStaffDraftOrSkip(ctx);

  const checkout = await homePage.pressPay();
  await checkout.waitForReady();
  const orderId = await checkout.orderId();

  const success = await payWithCard(orderId, { customTipCents: tipCents });
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();

  await returnToHome();
  await goToOrderHistory();
  await orderHistoryPage.openOrder(orderId);
  await orderHistoryDetailPage.waitForOrder(orderId);

  return { orderId };
}
