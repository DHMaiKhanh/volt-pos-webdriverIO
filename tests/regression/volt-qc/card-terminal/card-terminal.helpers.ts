/**
 * Shared scaffolding for the volt-qc card-terminal specs (`./*.spec.ts`): the
 * cases that used to sit in `../_manual/` only because they needed a Bamboo DOT
 * terminal and a real card charge.
 *
 * NOT a spec (the runner globs `*.spec.ts`). It holds no TC ids on purpose: the
 * coverage script scans every `.ts` under tests/, so an id named here would be
 * counted as covered by a file that does not test it.
 *
 * ## Gating — the same as the order-flow card specs
 *
 * A card charge is real money on the dev gateway and cannot be undone by a late
 * `this.skip()`, so every case calls {@link requireCardTerminal} FIRST:
 *   1. `CARD_SETTLE=1` (`CARD_SETTLE_ENABLED`, the flag card-payment.spec.ts,
 *      charge-card-matrix*.spec.ts and tip-guards.spec.ts use) — off → skip;
 *   2. header Devices › "Terminal | Connected" — not connected → skip;
 * and {@link openCardCheckout} skips (after voiding the draft) when Complete
 * Payment is still disabled on the Card tender — the red "!" device badge state.
 *
 * ## A person taps the card
 *
 * Exactly like the settle case in order-flow/card-payment.spec.ts: automation drives the till, the passcode guard
 * and the customer display (No Tip, signatures), but the physical card has to be
 * tapped / inserted on the terminal when it shows "Present Card". The charge
 * waits up to {@link CARD_WAIT_MS} for that. Run these with an operator at the
 * terminal and without file retries:
 *
 *     CARD_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/volt-qc/card-terminal/<file>.spec.ts
 *
 * ## Why the charge is driven by `watchCard`, not `payWithCard`
 *
 * `payWithCard` hard-codes the 20258 sequence (tip screen, then a standalone
 * signature after approval). Several cases here flip the signature rule or charge
 * a re-opened checkout, so the card is driven by `watchCard`
 * (src/pages/voltqc/promo-split/splitDeepExtra.ts): it answers the passcode, picks
 * No Tip and signs WHENEVER the customer display asks, and records every
 * card-dialog / customer-screen state so a spec can assert their order.
 *
 * Money: CENTS throughout, except `CardPayment.amount` / `.tip` from
 * `cardPayments()`, which are dollars — convert with {@link dollarsToCents}.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { VqcPay } from '../../../../src/constants/testids.voltqc-pay.js';
import { settle } from '../../../../src/helpers/wait.js';
import { checkoutPage, homePage } from '../../../../src/pages/index.js';
import {
  readSignatureSettings,
  setSignatureSettings,
  type SignatureSettings,
} from '../../../../src/pages/voltqc/cd-e2e/settingsCd.js';
import {
  buildCart,
  centsIn,
  codeOf,
  detailText,
  field,
  freshDetail,
  openHistoryOrder,
  tenderAmountCents,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { cleanTill, noReceipt, P, waitSuccess } from '../../../../src/pages/voltqc/pay/payProbe.js';
import {
  cardDialog,
  cardPayments,
  paymentDetails,
  settleCardDialog,
  successfulCards,
  terminalConnected,
  watchCard,
  type CardPayment,
  type CardTrace,
} from '../../../../src/pages/voltqc/promo-split/splitDeepExtra.js';
import { app } from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { CARD_SETTLE_ENABLED } from '../../order-flow/payment-flows.helpers.js';

export { CARD_SETTLE_ENABLED };

/** How long a charge may wait for the operator's tap + the gateway approval. */
export const CARD_WAIT_MS = 150_000;

/** Mocha budget for a case that takes one card charge (build + tap + history). */
export const ONE_CHARGE_MS = 6 * 60_000;

export const dollarsToCents = (d: number): number => Math.round(d * 100);

/** `1234` → `$12.34`, as the app prints it. */
export const usd = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Skip unless a real card charge is allowed AND the till reports a connected
 * terminal. Call it before anything that writes, so a skipped case leaves no draft.
 */
export async function requireCardTerminal(ctx: Mocha.Context): Promise<void> {
  if (!CARD_SETTLE_ENABLED) {
    console.warn(
      '[card-terminal] skipped: real card charges are off — set CARD_SETTLE=1 with an operator at the terminal',
    );
    ctx.skip();
  }
  if (!(await terminalConnected({ fresh: true }))) {
    console.warn(
      '[card-terminal] skipped: header Devices does not show "Terminal | Connected" (red "!" badge)',
    );
    ctx.skip();
  }
}

/** An open Card checkout and the prices the till showed for it. */
export interface CardCheckout {
  orderId: string;
  /** The Card tile (card price, service fee included). */
  cardCents: number;
  /** The Cash tile (cash price, no service fee). */
  cashCents: number;
}

/**
 * Build `lines` (`[staffTile, serviceTile]`) on an empty till, press Pay and pick
 * the Card tender. Skips — voiding the draft first — when Complete Payment stays
 * disabled on Card (terminal not connected to the app).
 */
export async function openCardCheckout(
  ctx: Mocha.Context,
  lines: readonly (readonly [number, number])[] = [[0, 0]],
): Promise<CardCheckout> {
  await buildCart(lines);
  const checkout = await homePage.pressPay();
  await checkout.waitForReady();
  const orderId = await checkout.orderId();
  const cashCents = await tenderAmountCents('Cash');
  const cardCents = await tenderAmountCents('Card');
  await checkoutPage.selectTender('card');
  await settle(Timeouts.DEBOUNCE);
  await assertCardPayable(ctx);
  return { orderId, cardCents, cashCents };
}

/**
 * On a checkout with Card selected: skip when Complete Payment is disabled (the
 * terminal is not connected to the app). Leaves the till clean before skipping.
 */
export async function assertCardPayable(ctx: Mocha.Context): Promise<void> {
  if (await checkoutPage.isCompletePaymentEnabled()) return;
  console.warn(
    '[card-terminal] skipped: Complete Payment is disabled on Card — the terminal is not connected to the app',
  );
  await cleanTill().catch(() => undefined);
  ctx.skip();
}

/**
 * Press Complete Payment on the selected Card tender and drive the charge to the
 * payment-success screen: passcode, customer No Tip, any signature. The operator
 * taps the card on the terminal. Returns the recorded states.
 */
export async function chargeSelectedCard(opts: { double?: boolean } = {}): Promise<CardTrace> {
  if (opts.double) {
    const i = await P.info(VqcPay.completePayment);
    if (!i) throw new Error('Complete Payment is not on screen');
    const x = Math.round(i.rect.x + i.rect.w / 2);
    const y = Math.round(i.rect.y + i.rect.h / 2);
    await browser.action('pointer').move({ x, y }).down().up().pause(60).down().up().perform();
  } else {
    await checkoutPage.pressCompletePayment();
  }
  return watchCard(({ url }) => /payment-success/.test(url), { timeoutMs: CARD_WAIT_MS, reset: true });
}

/** A charged card order, left on its Order History detail. */
export interface ChargedCardOrder extends CardCheckout {
  code: string;
  trace: CardTrace;
  /** The payment-success body text (" | "-joined). */
  successText: string;
}

/**
 * Build, charge by card (No Tip), end the sale with No Receipt and open the
 * order's Order History detail. The caller has already passed
 * {@link requireCardTerminal}.
 */
export async function createCardOrder(
  ctx: Mocha.Context,
  lines: readonly (readonly [number, number])[] = [[0, 0]],
): Promise<ChargedCardOrder> {
  const checkout = await openCardCheckout(ctx, lines);
  const trace = await chargeSelectedCard();
  const successText = await waitSuccess(Timeouts.CARD_CHARGE);
  await noReceipt();
  const code = await openHistoryOrder(checkout.orderId);
  return { ...checkout, code, trace, successText };
}

/** Card transactions of a detail text. */
export function cardsOf(detail: string): CardPayment[] {
  return cardPayments(paymentDetails(detail));
}

/** Successful card transactions of a detail text. */
export function successfulCardsOf(detail: string): CardPayment[] {
  return successfulCards(paymentDetails(detail));
}

/** Re-read the detail (from a reset list) until it lists `n` successful card txns. */
export async function detailWithCards(orderId: string, n: number, timeout = 60_000): Promise<string> {
  return freshDetail(orderId, (d) => successfulCardsOf(d).length === n, timeout);
}

/** The order's `Total` on its detail, in cents. */
export async function detailTotalCents(code: string): Promise<number> {
  return centsIn(field(await detailText(code), 'Total'));
}

/** True while a card-progress dialog (Present Card / Processing / …) is up on the main window. */
export async function cardDialogShown(): Promise<boolean> {
  return P.has(cardDialog);
}

/**
 * Run `fn` with the store's signature rule set to `want`; always put the old rule
 * back. Store-wide (Settings › Payment & Transaction › Tipping), so callers tag
 * the case EXCLUSIVE.
 */
export async function withSignatureRule(want: SignatureSettings, fn: () => Promise<void>): Promise<void> {
  const before = await readSignatureSettings();
  try {
    await setSignatureSettings(want);
    expect(await readSignatureSettings()).toEqual(want);
    await app.go('/home', { passcode: false });
    await fn();
  } finally {
    await settleCardDialog().catch(() => undefined);
    await app.closeStrayDialogs().catch(() => undefined);
    await setSignatureSettings(before).catch((e: unknown) => {
      console.warn(`[card-terminal] restoring the signature rule failed: ${String(e)}`);
    });
    await cleanTill().catch(() => undefined);
  }
}

/** afterEach for every card spec: close a leftover card dialog / signature, empty the till. */
export async function cleanAfterCard(): Promise<void> {
  await settleCardDialog().catch(() => undefined);
  await app.closeStrayDialogs().catch(() => undefined);
  await cleanTill().catch(() => undefined);
}

export { codeOf };
