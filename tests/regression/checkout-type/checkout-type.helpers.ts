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
 * CREATES DATA and grows a real customer's balance. dev / staging only.
 */

import { browser } from '@wdio/globals';
import { env } from '../../../configs/env/loadEnv.js';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { LoyaltyService, type LivePointSetting, type OrderPointState } from '../../../src/api/index.js';
import { requireGiftCardCode } from '../../../src/data/index.js';
import { expectedAward, type ExpectedAward } from '../../../src/domain/index.js';
import {
  createOrder,
  payInCash,
  payWithCard,
  payWithGiftCard,
  returnToHome,
} from '../../../src/flows/index.js';
import type { PaymentSuccessPage } from '../../../src/pages/index.js';
import { step } from '../../../src/helpers/steps.js';
import { moduleLogger } from '../../../src/utils/logger.js';

const log = moduleLogger('checkout-type');

export const loyalty = new LoyaltyService();

/** Opt-in for real card charges — same contract as card-payment.spec.ts. */
export const CARD_SETTLE_ENABLED = process.env.CARD_SETTLE === '1';

export type PointsTender = 'cash' | 'card' | 'gift-card';

export interface PointsRun {
  orderId: string;
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
 * Complete one order for the fixture customer on `tender` and measure the award.
 *
 * Leaves the app on /home, ready for the next case.
 */
export async function completeAndMeasure(
  phone: string,
  tender: PointsTender,
  setting: LivePointSetting,
): Promise<PointsRun> {
  await returnToHome();
  const before = await step('Read customer points (before)', () => loyalty.currentPoints(phone));

  const { orderId } = await createOrder({ customerPhone: phone });
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

  const run: PointsRun = { orderId, before, after, delta: after - before, expected, order };
  log.info(
    `${setting.checkoutType} / ${tender}: order ${orderId} total=${String(order.total)} ` +
      `points ${String(before)} → ${String(after)} (Δ${String(run.delta)}, expected ${String(expected.points)}), ` +
      `pointBonus stamp=${String(order.pointBonus)}`,
  );
  return run;
}
