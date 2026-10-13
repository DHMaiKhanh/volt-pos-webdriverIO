/**
 * Shared scaffolding for the four "charge matrix" specs — 10 successful-charge
 * cases per tender (cash / other / card / gift card), each a distinct point in
 * the amount / discount / staff-service matrix.
 *
 * NOT a spec (the runner globs `*.spec.ts`, this is `*.helpers.ts`): it holds the
 * draft builder and the settle assertion the four files share, so a change to how
 * a draft is shaped or how "settled" is proven lands in one place instead of
 * four. The per-tender payment call (payInCash / payWithOther / payWithCard /
 * payWithGiftCard) stays in each spec, because that is the axis the files differ
 * on.
 *
 * ## Orders vary by POSITION, never a hard-coded account
 *
 * Every draft is built on staff/service TILES via `selectStaffByIndex` /
 * `addServiceByIndex`, the index taken modulo the mounted count so a short roster
 * still runs (it just repeats tile 0) — the same convention card-payment.spec.ts
 * and charge-discount-tip.spec.ts use. No spec here pins a staff or service id.
 *
 * CREATES DATA (drafts, voided when a case does not charge). The specs that call
 * a settle take REAL payments — see each file's gate. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { returnToHome } from '../../../src/flows/index.js';
import { checkoutPage, homePage, paymentSuccessPage } from '../../../src/pages/index.js';
import type { PaymentSuccessPage } from '../../../src/pages/index.js';
import type { Tender } from '../../../src/pages/pos/CheckoutPage.js';
import type { MoneyCents } from '../../../src/types/models.js';
import { expectCentsEqual } from '../../../src/utils/money.js';

/** How a matrix case wants its draft built. Every field is optional — {} is one line on tile 0. */
export interface DraftShape {
  /** Staff tile to book the line to (wrapped to the mounted count). Default 0. */
  staffIndex?: number;
  /** First service tile to sell (wrapped to the mounted count). Default 0. */
  serviceIndex?: number;
  /**
   * EXTRA service lines beyond the first, each stepping the tile index by one so
   * the order carries distinct items rather than the same line N times. Raises
   * the total — the cheapest way to vary the amount without a hard-coded price.
   */
  extraLines?: number;
  /**
   * Overwrite the FIRST line's price to this many cents. Used by the gift-card
   * matrix to keep each redemption small (the shared card drains on every spend),
   * and elsewhere to pin the total to a round figure.
   */
  priceCents?: MoneyCents;
  /** Flip the first line's Apply-Discount switch on, for the discount axis. */
  discount?: boolean;
  /**
   * Write a per-line note on the FIRST line (the app caps it at 50 characters).
   * Order metadata that rides through to the settle — it never changes the amount,
   * so it is a pure "does a noted line still charge" axis.
   */
  serviceNote?: string;
  /**
   * Build the order through QUICK PAY instead of the service tiles — an arbitrary
   * amount with no catalogue row. Mutually exclusive with the service-tile fields
   * (extraLines / priceCents / discount / serviceNote), which Quick Pay has no
   * editor for; when set they are ignored.
   */
  quickPay?: QuickPayShape;
}

/** A Quick Pay line: an arbitrary amount under a required name. */
export interface QuickPayShape {
  /** The line amount in cents. Quick Pay takes no item discount, so this IS the subtotal. */
  amountCents: MoneyCents;
  /** The service name — REQUIRED by the app to enable Add. Defaults to a suite label. */
  name?: string;
  /** Optional per-line note. */
  note?: string;
}

/** Leave the till empty for the next case, whatever state this one ended in. */
export async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

/** Take the index onto a tile that exists: `i % max(count, 1)` never throws on a short panel. */
function wrap(index: number, count: number): number {
  return index % Math.max(count, 1);
}

/**
 * Build a draft to `shape` on an EMPTY till, leaving the app on the /home cart
 * (before Pay). Voids any leftover draft first so a prior case cannot append its
 * lines onto this one.
 */
export async function buildDraft(shape: DraftShape = {}): Promise<void> {
  await voidAnyDraft();

  const staffCount = await homePage.visibleStaffCount();
  await homePage.selectStaffByIndex(wrap(shape.staffIndex ?? 0, staffCount));

  // Quick Pay is a separate creation path — an arbitrary-amount line with no
  // catalogue row — so it skips the service tiles and the line editor entirely.
  // It needs a staff on the order first (above) and a name to enable Add.
  if (shape.quickPay !== undefined) {
    await homePage.openQuickPay();
    await homePage.addQuickPayItem(shape.quickPay.amountCents, {
      name: shape.quickPay.name ?? 'E2E Quick Pay',
      note: shape.quickPay.note,
    });
    return;
  }

  const serviceCount = await homePage.visibleServiceCount();
  const baseService = shape.serviceIndex ?? 0;
  await homePage.addServiceByIndex(wrap(baseService, serviceCount));
  for (let line = 1; line <= (shape.extraLines ?? 0); line += 1) {
    await homePage.addServiceByIndex(wrap(baseService + line, serviceCount));
  }

  // Only open the line editor when something on it actually changes — a price
  // override, a note or the discount switch. Opening it needlessly is a slower,
  // flakier no-op.
  if (shape.priceCents !== undefined || shape.discount === true || shape.serviceNote !== undefined) {
    await homePage.openServiceEditor();
    if (shape.priceCents !== undefined) await homePage.setServiceEditorPrice(shape.priceCents);
    if (shape.serviceNote !== undefined) await homePage.setServiceNote(shape.serviceNote);
    if (shape.discount === true) {
      if (!(await homePage.isItemDiscountOn())) await homePage.toggleItemDiscount();
      // Flipping the switch on is not enough: the app keeps Save disabled until a
      // non-zero discount amount is entered in the field the switch reveals.
      await homePage.setItemDiscount('10');
    }
    await homePage.saveServiceEditor();
  }
}

/**
 * Build the draft, press Pay, open `tender`, and return the order id off the
 * checkout URL — the id every settle takes as its precondition.
 */
export async function openCheckout(shape: DraftShape, tender: Tender): Promise<string> {
  await buildDraft(shape);
  await homePage.pressPay();
  await checkoutPage.waitForReady();
  await checkoutPage.selectTender(tender);
  return checkoutPage.orderId();
}

/** End the sale so the next case starts from a clean till, not the receipt screen. */
export async function endSale(): Promise<void> {
  await paymentSuccessPage.continueToNextOrder();
  await paymentSuccessPage.waitForFlowToEnd();
}

/**
 * The shared post-condition: the payment landed on payment-success FOR THIS
 * ORDER, then end the sale. `success.orderId()` guards against a flow that
 * settled a different check — the same protection `requireCheckoutFor` gives on
 * the way in.
 */
export async function expectSettled(success: PaymentSuccessPage, orderId: string): Promise<void> {
  expect(await success.orderId()).toBe(orderId);
  expect(await success.isActive()).toBe(true);
  await endSale();
}

/**
 * A cash tender comfortably above any order this matrix builds, chosen 9-free.
 *
 * This build renders the $5/$10/$50/$100 preset column ON TOP of the digit keys,
 * so the "$50" button covers "9" and typing any amount containing a 9 stalls (see
 * the checkout-keypad-preset-overlap note). $888.88 clears the largest five-line /
 * price-override draft here with room to spare, and has no digit 9.
 */
export const OVER_TENDER_CENTS = 88_888;

/**
 * Over-tender the OPEN cash checkout and assert the change to the cent.
 *
 * Replaces the old "tap a $X preset, expect $X change" pattern, which assumed the
 * presets ACCUMULATE onto the pre-filled due. On build 1.1.x a preset REPLACES the
 * entry (empirically 264->50, clear->0->100), so change can no longer be dialled in
 * by preset; the robust equivalent is to type a fixed 9-free tender and assert
 * `change == tendered - due`, which holds whatever the order total happens to be.
 */
export async function expectCashOverTenderChange(): Promise<void> {
  const due = await checkoutPage.totalCents();
  await checkoutPage.setCashTendered(OVER_TENDER_CENTS);
  expect(await checkoutPage.isChangeShown()).toBe(true);
  expectCentsEqual(await checkoutPage.changeCents(), OVER_TENDER_CENTS - due, 'change owed (tendered - due)');
  expect(await checkoutPage.remainingCents()).toBe(0);
}
