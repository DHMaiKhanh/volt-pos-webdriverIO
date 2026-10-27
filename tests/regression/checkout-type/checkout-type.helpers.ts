/**
 * Shared scaffolding for the Checkout Type specs (VP-4591).
 *
 * NOT a spec (the runner globs `*.spec.ts`). It holds the one measurement every
 * case makes — read the customer's balance, complete an order for them on a
 * given tender, read the balance again — and the gates that decide whether a
 * case can run against the merchant's CURRENT setting.
 *
 * ## Why cases gate instead of setting up
 *
 * `merchant_point_payment_config` is changed on the Portal, and the API layer
 * here is read-only by rule (src/api/index.ts). So each case reads the live
 * setting and skips when its precondition does not hold; QA sets the Portal to
 * Manual, Auto, Hybrid in turn and re-runs the file.
 *
 * ## The oracle
 *
 * The expected award is recomputed from the live setting and the order's real
 * tenders by `src/domain/loyaltyPoints.ts`, not read off the app, and compared
 * with BOTH the customer's balance delta (GoCheckin) and the order's
 * `pointBonus` stamp. Hard-coded figures from the doc (40 points for $40) are
 * only true under the doc's 1 point / $1 config and a $40 service; the derived
 * figure is true on any merchant.
 *
 * ## Where the order comes from
 *
 * A GoCheckin kiosk check-in, not Quick Checkout. A check-in made on the GAP
 * kiosk lands on POS as a pending order that ALREADY carries an active
 * check-in; an order created on POS gets its check-in only at completion, so it
 * is not the flow Checkout Type is about (and Hybrid's end-of-day job never sees
 * it). The web half (`tests/web/checkout-type-checkins.spec.ts`) checks in one
 * fresh customer per case and records them in `.tmp/checkout-type-checkins.json`;
 * {@link gciCustomer} reads that back, and {@link completeAndMeasure} opens the
 * customer's checked-in pending order instead of building a new one. Only
 * CHK-POS-033 uses `source: 'pos'`.
 *
 * CREATES DATA and grows a real customer's balance. dev / staging only.
 */

import { browser } from '@wdio/globals';
import { env } from '../../../configs/env/loadEnv.js';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import {
  LoyaltyService,
  type CheckedInOrder,
  type LivePointSetting,
  type OrderPointState,
} from '../../../src/api/index.js';
import { requireGiftCardCode } from '../../../src/data/index.js';
import { expectedAward, type ExpectedAward } from '../../../src/domain/index.js';
import {
  createOrder,
  openPendingOrder,
  payInCash,
  payWithCard,
  payWithGiftCard,
  returnToHome,
} from '../../../src/flows/index.js';
import { checkoutPage, type PaymentSuccessPage } from '../../../src/pages/index.js';
import {
  CHECKOUT_TYPE_CHECKINS_FILE,
  readCheckoutTypeCheckins,
} from '../../../src/pages/web/checkinHandoff.js';
import { step } from '../../../src/helpers/steps.js';
import { moduleLogger } from '../../../src/utils/logger.js';

const log = moduleLogger('checkout-type');

export const loyalty = new LoyaltyService();

/** Opt-in for real card charges — same contract as card-payment.spec.ts. */
export const CARD_SETTLE_ENABLED = process.env.CARD_SETTLE === '1';

export type PointsTender = 'cash' | 'card' | 'gift-card';

/** `gci` — the customer's kiosk check-in order (default); `pos` — a fresh Quick Checkout order. */
export type OrderSource = 'gci' | 'pos';

/** How long a kiosk check-in may take to sync down to POS as a pending order. */
const GCI_SYNC_TIMEOUT = Timeouts.LONG * 2;

/**
 * The reward that zeroes an order: merchant #14's "test redeem 2109" is −$101
 * and costs 0 points, so any freshly checked-in customer can redeem it.
 * `CHECKOUT_TYPE_REWARD` names another one on a different merchant.
 */
export const FULL_REDEEM_REWARD = process.env.CHECKOUT_TYPE_REWARD ?? 'test redeem 2109';

/** How the order is built and paid, beyond the tender. */
export interface CompleteOptions {
  /** `gci` — the customer's kiosk check-in order (default); `pos` — a fresh Quick Checkout order. */
  source?: OrderSource;
  /** Redeem this reward before Pay (gci orders only). */
  reward?: string;
  /** Add this cashier tip, in cents, on the checkout before paying. */
  tipCents?: number;
}

export interface PointsRun {
  orderId: string;
  /** The order's check-in as it stood BEFORE payment — null for a `pos` order. */
  checkinBeforePay: CheckedInOrder | null;
  before: number;
  after: number;
  delta: number;
  expected: ExpectedAward;
  order: OrderPointState;
}

/**
 * Skip the running case with a reason in the log. Mocha's `this.skip()` throws
 * a Pending marker, so nothing after the call runs.
 */
export function skipUnless(ctx: Mocha.Context, condition: boolean, reason: string): void {
  if (condition) return;
  log.info(`SKIP — ${reason}`);
  ctx.skip();
}

/** The fixture customer, or skip: without one there is no balance to measure. */
export function loyaltyPhone(ctx: Mocha.Context): string {
  skipUnless(
    ctx,
    env.LOYALTY_CUSTOMER_PHONE !== '',
    'LOYALTY_CUSTOMER_PHONE is not set (configs/env/.env.<ENV>) — no customer to measure points on',
  );
  return env.LOYALTY_CUSTOMER_PHONE;
}

/**
 * The customer the web half checked in for `caseId`, or skip: without a kiosk
 * check-in there is no order of the right kind to complete.
 */
export function gciCustomer(ctx: Mocha.Context, caseId: string): string {
  const handoff = readCheckoutTypeCheckins()[caseId];
  if (handoff === undefined) {
    const reason =
      `no kiosk check-in for ${caseId} in ${CHECKOUT_TYPE_CHECKINS_FILE} — run ` +
      '`npm run web:checkout-type-checkin` first (or `npm run test:checkout-type-gci`)';
    skipUnless(ctx, false, reason);
    throw new Error(reason); // unreachable: skip() throws Mocha's Pending marker
  }
  return handoff.phone;
}

/**
 * Wait for `phone`'s kiosk check-in to sync down as a pending order with an
 * ACTIVE check-in. Throws when it never arrives: the web half said it checked
 * this customer in, so a missing order is a sync or wrong-store problem.
 */
async function waitForCheckedInOrder(phone: string): Promise<CheckedInOrder> {
  let found: CheckedInOrder | null = null;
  await browser.waitUntil(
    async () => {
      found = await loyalty.checkedInPendingOrder(phone);
      return found !== null;
    },
    {
      timeout: GCI_SYNC_TIMEOUT,
      interval: 2_000,
      timeoutMsg:
        `No pending order with an active check-in for ${phone} after ${String(GCI_SYNC_TIMEOUT)}ms. ` +
        'Check the kiosk check-in went through and that GAP and this till are the same store (#14).',
    },
  );
  if (found === null) throw new Error(`Checked-in order for ${phone} vanished after it was found.`);
  return found;
}

/** Skip a tender this machine cannot settle unattended. */
export function requireTender(ctx: Mocha.Context, tender: PointsTender): void {
  if (tender === 'card') {
    skipUnless(ctx, CARD_SETTLE_ENABLED, 'card tender needs CARD_SETTLE=1 SPEC_RETRIES=0 and a terminal');
  }
}

/**
 * The setting POS will read at completion. Re-read per case on purpose: a QA
 * who flips the Portal between runs must not be measured against a cached copy.
 */
export function liveSetting(): Promise<LivePointSetting> {
  return step('Read merchant_point_payment_config', () => loyalty.pointSetting());
}

async function pay(tender: PointsTender, orderId: string): Promise<PaymentSuccessPage> {
  switch (tender) {
    case 'cash':
      return payInCash(orderId);
    case 'card':
      return payWithCard(orderId);
    case 'gift-card':
      return payWithGiftCard(orderId, requireGiftCardCode());
  }
}

/**
 * Wait for the balance to reach `target`, or give up and return the last read.
 *
 * `checkinAndCheckout` is awaited before payment-success renders, so the credit
 * is normally already there; the poll only absorbs GoCheckin's own lag. When
 * the expectation is "no change", the full window is waited out so a late
 * credit is still caught.
 */
async function settledBalance(phone: string, before: number, target: number): Promise<number> {
  let last = await loyalty.currentPoints(phone);
  try {
    await browser.waitUntil(
      async () => {
        last = await loyalty.currentPoints(phone);
        // "No change" is only proven by outlasting the window, so it never resolves early.
        return target !== before && last === target;
      },
      { timeout: Timeouts.API, interval: 1_000 },
    );
  } catch {
    // Timed out: hand back the last read and let the spec's assertion name the gap.
  }
  return last;
}

/**
 * Complete one order for `phone` on `tender` and measure the award.
 *
 * `source: 'gci'` (default) completes the customer's checked-in pending order
 * from the kiosk; `'pos'` builds a fresh Quick Checkout order for them.
 * `reward` and `tipCents` shape the order the $0 cases need.
 *
 * Leaves the app on /home, ready for the next case.
 */
export async function completeAndMeasure(
  phone: string,
  tender: PointsTender,
  setting: LivePointSetting,
  { source = 'gci', reward, tipCents }: CompleteOptions = {},
): Promise<PointsRun> {
  if (reward !== undefined && source !== 'gci') {
    throw new Error('completeAndMeasure: `reward` is only wired for kiosk (gci) orders.');
  }
  await returnToHome();
  const before = await step('Read customer points (before)', () => loyalty.currentPoints(phone));

  let checkinBeforePay: CheckedInOrder | null = null;
  let orderId: string;
  if (source === 'gci') {
    const checkedIn = await step(`Wait for ${phone}'s checked-in pending order`, () =>
      waitForCheckedInOrder(phone),
    );
    checkinBeforePay = checkedIn;
    ({ orderId } = await openPendingOrder({ orderCode: checkedIn.orderCode, reward }));
    if (orderId !== checkedIn.id) {
      throw new Error(
        `Opened ${checkedIn.orderCode} (${checkedIn.id}) but checkout is for ${orderId} — wrong card clicked.`,
      );
    }
  } else {
    ({ orderId } = await createOrder({ customerPhone: phone }));
  }
  if (tipCents !== undefined) {
    await step(`Add a cashier tip of ${String(tipCents)}¢`, () => checkoutPage.addCashierTip(tipCents));
  }
  const success = await pay(tender, orderId);
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();

  const order = await step('Read the order the completion stamped', async () => {
    const row = await loyalty.orderPointState(orderId);
    if (!row) throw new Error(`Order ${orderId} is not in the schema after completion.`);
    return row;
  });

  const expected = expectedAward({
    setting,
    transactions: order.transactions,
    items: order.items,
    orderTotal: order.total,
    tipTotal: order.tipAmount ?? 0,
  });

  const after = await step(`Read customer points (after, expecting +${String(expected.points)})`, () =>
    settledBalance(phone, before, before + expected.points),
  );

  const run: PointsRun = {
    orderId,
    checkinBeforePay,
    before,
    after,
    delta: after - before,
    expected,
    order,
  };
  log.info(
    `${setting.checkoutType} / ${tender} / ${source}: order ${orderId} total=${String(order.total)} ` +
      `points ${String(before)} → ${String(after)} (Δ${String(run.delta)}, expected ${String(expected.points)}), ` +
      `pointBonus stamp=${String(order.pointBonus)}`,
  );
  return run;
}
