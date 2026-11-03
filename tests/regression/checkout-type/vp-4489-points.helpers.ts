/**
 * VP-4489 / VP-5112 helpers — complete one order for a loyalty customer and
 * capture, in the same pass, what the CUSTOMER DISPLAY says about the points.
 *
 * NOT a spec. `checkout-type.helpers.ts#completeAndMeasure` already measures
 * the balance delta, but it presses "No Receipt" straight after payment, which
 * sends the customer window back to its welcome screen before the earned block
 * can be read. This variant reads the display between payment-success and
 * "No Receipt", then measures exactly like `completeAndMeasure` (same oracle:
 * src/domain/loyaltyPoints.ts#expectedAward over the order's real tenders).
 *
 * CREATES DATA and grows a real customer's balance. dev / staging only.
 */

import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import type { LivePointSetting, OrderPointState } from '../../../src/api/index.js';
import { VpEarnedPoints } from '../../../src/constants/testids.vp-loyalty-pending.js';
import { expectedAward, type ExpectedAward } from '../../../src/domain/index.js';
import { createOrder, openPendingOrder, payInCash, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { withCustomerWindow } from '../../../src/helpers/window.js';
import { moduleLogger } from '../../../src/utils/logger.js';
import { loyalty } from './checkout-type.helpers.js';

const log = moduleLogger('vp-4489');

/** What the customer display showed after payment. */
export interface EarnedDisplay {
  /** The earned block ("Congrats! You've earned") was rendered. */
  shown: boolean;
  /** Number on the value line, NaN when the block is absent. */
  points: number;
  /** Unit word exactly as rendered: `point` / `points` ('' when absent). */
  unit: string;
  /** "Your current points" figure, NaN when absent. */
  current: number;
  /** Whole display text, for the failure message. */
  text: string;
}

export interface DisplayRun {
  orderId: string;
  before: number;
  after: number;
  delta: number;
  expected: ExpectedAward;
  order: OrderPointState;
  display: EarnedDisplay;
}

export interface DisplayRunOptions {
  /** `pos` (default) — fresh Quick Checkout order; `gci` — the customer's kiosk check-in order. */
  source?: 'pos' | 'gci';
  /** Redeem this reward before Pay (gci only) — how the $0 case is built. */
  reward?: string;
}

/** The singular/plural label VP-5112 expects for `n` points. */
export const pointsLabel = (n: number): string =>
  `${n.toLocaleString('en-US')} ${n === 1 ? 'point' : 'points'}`;

const toNumber = (raw: string | undefined): number => (raw ? Number(raw.replace(/,/g, '')) : Number.NaN);

/** Parse the customer display's innerText into {@link EarnedDisplay}. */
export function parseEarnedDisplay(text: string): EarnedDisplay {
  const at = text.indexOf(VpEarnedPoints.heading);
  if (at < 0) return { shown: false, points: Number.NaN, unit: '', current: Number.NaN, text };
  const tail = text.slice(at + VpEarnedPoints.heading.length);
  const value = VpEarnedPoints.valueLineRe.exec(tail);
  const current = new RegExp(`${VpEarnedPoints.currentPoints}\\s*\\n?\\s*([\\d,]+)`).exec(tail);
  return {
    shown: true,
    points: toNumber(value?.[1]),
    unit: value?.[2] ?? '',
    current: toNumber(current?.[1]),
    text,
  };
}

/**
 * Read the earned block on the customer window. Polls until the value line is
 * rendered (the app shows a skeleton until the checkout response lands); when
 * `expectShown` is false the whole window is waited out so a late block is caught.
 */
export async function readEarnedDisplay(expectShown: boolean): Promise<EarnedDisplay> {
  return withCustomerWindow(async () => {
    let last = parseEarnedDisplay('');
    try {
      await browser.waitUntil(
        async () => {
          const text = await browser.execute(() => document.body.innerText);
          last = parseEarnedDisplay(text);
          return expectShown && last.shown && Number.isFinite(last.points);
        },
        { timeout: expectShown ? Timeouts.API : Timeouts.MEDIUM, interval: 500 },
      );
    } catch {
      // Timed out: hand back the last read; the spec's assertion names the gap.
    }
    return last;
  });
}

async function settledBalance(phone: string, before: number, target: number): Promise<number> {
  let last = await loyalty.currentPoints(phone);
  try {
    await browser.waitUntil(
      async () => {
        last = await loyalty.currentPoints(phone);
        return target !== before && last === target;
      },
      { timeout: Timeouts.API, interval: 1_000 },
    );
  } catch {
    // "No change" is only proven by outlasting the window.
  }
  return last;
}

/**
 * Pay one Cash order for `phone`, read the customer display, then measure the
 * balance delta against the award recomputed from the live setting.
 *
 * `gci` needs the customer's checked-in pending order to exist already — the
 * caller checks {@link loyalty.checkedInPendingOrder} and skips without one.
 */
export async function payCashAndReadDisplay(
  phone: string,
  setting: LivePointSetting,
  { source = 'pos', reward }: DisplayRunOptions = {},
): Promise<DisplayRun> {
  await returnToHome();
  const before = await step('Read customer points (before)', () => loyalty.currentPoints(phone));

  let orderId: string;
  if (source === 'gci') {
    const checkedIn = await loyalty.checkedInPendingOrder(phone);
    if (checkedIn === null) throw new Error(`No checked-in pending order for ${phone}.`);
    ({ orderId } = await openPendingOrder({ orderCode: checkedIn.orderCode, reward }));
  } else {
    ({ orderId } = await createOrder({ customerPhone: phone, quickCheckout: true }));
  }

  const success = await payInCash(orderId, { tip: 'none' });

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

  const display = await step(`Read the customer display (expecting ${pointsLabel(expected.points)})`, () =>
    readEarnedDisplay(expected.showEarned),
  );

  await success.continueToNextOrder();
  await success.waitForFlowToEnd();

  const after = await step(`Read customer points (after, expecting +${String(expected.points)})`, () =>
    settledBalance(phone, before, before + expected.points),
  );

  const run: DisplayRun = { orderId, before, after, delta: after - before, expected, order, display };
  log.info(
    `${setting.checkoutType} bonus=${String(setting.pointBonus)}: order ${orderId} total=${String(order.total)} ` +
      `points ${String(before)} → ${String(after)} (Δ${String(run.delta)}, expected ${String(expected.points)}); ` +
      `display shown=${String(display.shown)} "${String(display.points)} ${display.unit}" current=${String(display.current)}`,
  );
  return run;
}
