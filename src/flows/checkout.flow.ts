import { Timeouts } from '../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../configs/env/loadEnv.js';
import { passcodeDialog } from '../components/index.js';
import { step } from '../helpers/steps.js';
import { checkoutPage, paymentSuccessPage } from '../pages/index.js';
import type { PaymentSuccessPage } from '../pages/index.js';
import { CardChargeState } from '../pages/pos/CheckoutPage.js';

/**
 * Taking an order that is already on `/order/{id}/checkout` through to settled.
 *
 * Every flow here starts on the checkout screen — `createOrder()` leaves the app
 * there — and ends on `/order/{id}/payment-success`, returning that page object
 * so the spec can read the receipt options, assert the order id off the URL, or
 * end the sale.
 *
 * ## Why they all take the order id
 *
 * It is a precondition, not a parameter the flow acts on: the id is compared
 * against the one in the checkout URL before a single tender is pressed. A spec
 * whose previous step silently navigated elsewhere would otherwise pay for
 * WHATEVER order happened to be on screen, and on a write-enabled till that is a
 * real charge against the wrong check. Passing it also documents, at the call
 * site, which order the money belongs to.
 *
 * ## The passcode guard is CONDITIONAL, and that is not a timing question
 *
 * Complete Payment is wrapped in `PermissionProtectedButton
 * requiredPermission="completed_payment"`
 * (`-order-checkout-detail/list-action-detail.tsx`), so pressing it either runs
 * the payment or raises the passcode guard first. Which one happens is MERCHANT
 * STATE, not a step of the flow: it depends on whether the signed-in staff holds
 * `completed_payment`, on the role permissions configured in
 * `/settings/permissions`, and on whether someone ticked "skip for the next 30
 * minutes" recently. A flow that always typed a passcode would fail on a till
 * configured without the guard, and one that never typed it would fail on a till
 * with it — hence `enterIfPresent`, which resolves `false` when nothing prompted
 * and is the only correct shape for this call.
 *
 * ## Why the id is never re-read AFTER the payment
 *
 * `CheckoutPage.awaitPaymentSuccess()` re-reads the uuid from the checkout URL,
 * so it only works while the router is still on checkout. A cash payment
 * routinely lands on payment-success while the passcode probe is still running,
 * and the call would then throw "Not on a checkout URL" for a payment that
 * worked. These flows check the id up front and wait on
 * {@link PaymentSuccessPage} instead.
 */

/** What the customer handed over. Empty settles the balance exactly. */
export interface CashTender {
  /**
   * Cash received, in CENTS — not the amount due.
   *
   * Passing more than the balance is how a change-due spec is written; the app
   * leaves `remainingAmount` clamped at 0 and renders the difference as Change.
   * Omit it to settle exactly: an effect in `checkout/index.tsx` re-fills the
   * entry field with the remaining due on every change of method, remaining or
   * tip, so pressing Complete Payment on an untouched field IS the full-amount
   * path.
   */
  tenderedCents?: number;
}

/**
 * Pay an order in cash and land on the receipt screen.
 *
 * Safe to call on a checkout a spec has already been driving: the tender tab is
 * a no-op when it is already active (`handleClick` returns early), and
 * `enterAmount()` clears the field before typing, so re-stating the same tender
 * changes nothing.
 */
export async function payInCash(orderId: string, tender: CashTender = {}): Promise<PaymentSuccessPage> {
  assertWritesAllowed('take a cash payment');

  return step('Pay in cash', async () => {
    await requireCheckoutFor(orderId, 'cash');

    await checkoutPage.payWithCash(tender.tenderedCents);
    await clearPasscodeGuard();

    return settle(orderId, 'cash');
  });
}

/**
 * Charge the order to a card and land on the receipt screen.
 *
 * ## Two things outside this flow's control
 *
 * 1. **Complete Payment starts DISABLED on the card tender.** The button unlocks
 *    only once the tip + signature handoff comes back from the customer display,
 *    so a card spec drives that second window first (see
 *    `withCustomerWindow()`), and this flow reports the disabled button rather
 *    than clicking into a "not clickable" timeout that names the wrong cause.
 * 2. **The charge needs a real terminal.** The dialog advances on the Bamboo DOT
 *    device's own reply; with no terminal attached it sits on "waiting for
 *    connect device" and never resolves. That is an environment fact, so the
 *    failure below says so instead of retrying.
 */
export async function payWithCard(orderId: string): Promise<PaymentSuccessPage> {
  assertWritesAllowed('take a card payment');

  return step('Pay by card', async () => {
    await requireCheckoutFor(orderId, 'card');

    await checkoutPage.selectTender('card');

    if (!(await checkoutPage.isCompletePaymentEnabled())) {
      throw new Error(
        `Complete Payment is disabled on the card tender for order ${orderId}. ` +
          `The card flow unlocks it only after the customer display returns the tip and the ` +
          `signature — drive that window first (helpers/window.ts → withCustomerWindow) and wait ` +
          `for checkoutPage.waitForCustomerHandoff() before calling payWithCard().`,
      );
    }

    await checkoutPage.pressCompletePayment();
    await clearPasscodeGuard();

    await checkoutPage.waitForCardChargingDialog(Timeouts.MEDIUM);

    // Deliberately NOT waitForCardChargeState(SUCCESS): the dialog unmounts as the
    // router leaves for payment-success, so a poll that samples one beat late reads
    // "closed" and burns the full budget on a charge that was approved. The
    // navigation is the outcome; the dialog state is only worth reading if it stalls.
    return settle(orderId, 'card', async () => {
      const state = await checkoutPage.cardChargeState();
      return state === CardChargeState.CHARGING
        ? `The charging dialog is still "${state}", which is where it parks with no terminal attached.`
        : `The charging dialog reports "${state}".`;
    });
  });
}

/**
 * Redeem a gift card for the balance due and land on the receipt screen.
 *
 * The sequence is the app's, not an abbreviation of it: Complete Payment opens
 * the scan dialog (`checkout-gift-card-payment.tsx` → `openGiftCardInput`),
 * "Input Gift Card Code" swaps the QR scanner for an `InputCode`, and the
 * balance lookup runs only when Confirm is pressed — `content-gift-card-dialog.tsx`
 * calls `checkBalance()` from that button and from `Enter`, never from the change
 * handler, so typing a code and waiting for a verdict waits forever.
 *
 * Two merchant settings change what happens between the press and the dialog:
 * the tender is refused offline (the dialog only renders while `isOnline`), and
 * a BEFORE-style tip flow pushes the tip screen to the customer display first.
 */
export async function payWithGiftCard(orderId: string, code: string): Promise<PaymentSuccessPage> {
  assertWritesAllowed('take a gift-card payment');

  if (code.trim() === '') {
    throw new Error(
      'payWithGiftCard() needs a gift-card number. Set GIFT_CARD_CODE for the merchant under ' +
        'test — see src/data/static/paymentMethods.ts — or use INVALID_GIFT_CARD_CODE from there ' +
        'when the rejection path is the subject.',
    );
  }

  return step(`Pay with gift card ${code}`, async () => {
    await requireCheckoutFor(orderId, 'gift card');

    await checkoutPage.selectTender('gift-card');
    await checkoutPage.pressCompletePayment();
    await clearPasscodeGuard();

    await checkoutPage.waitForGiftCardScanDialog(Timeouts.MEDIUM);
    await checkoutPage.enterGiftCardCode(code);
    await checkoutPage.redeemGiftCard();

    if (!(await checkoutPage.isGiftCardAccepted())) {
      throw new Error(await giftCardRejection(code, orderId));
    }

    await checkoutPage.payWithGiftCardBalance();

    return settle(orderId, 'gift card');
  });
}

/**
 * Settle an order with the "Other" tender under a label and land on the receipt.
 *
 * `methodName` is what the cashier types for a tender the app has no button for —
 * "Zelle", "Bank Transfer", "Personal Check". It is recorded on the transaction
 * and echoed on the payment-success screen as `Other (<name>)`, which is what
 * makes it assertable downstream.
 *
 * ## Two things it is NOT
 *
 * 1. **Untaxed.** Other is a *labelled* tender, not a tax-free one — tax stays
 *    applied exactly as it does for card, so omitting `amountCents` settles the
 *    full TAXED balance rather than the pre-tax figure.
 * 2. **Offline-capable.** The tab renders disabled while the till is offline
 *    (only cash survives a disconnected till), so a not-clickable failure names
 *    the Other tab rather than surfacing here.
 *
 * Omit `amountCents` to settle the pre-filled balance in full — the cleanest
 * path, since it presses Complete Payment without touching the checkout keypad.
 */
export async function payWithOther(
  orderId: string,
  methodName: string,
  amountCents?: number,
): Promise<PaymentSuccessPage> {
  assertWritesAllowed('take an "other" payment');

  if (methodName.trim() === '') {
    throw new Error(
      'payWithOther() needs a tender name — the label the sale is recorded under, e.g. "Zelle". ' +
        'It is echoed on the payment-success screen as `Other (<name>)`; settling under an empty ' +
        'label would leave the receipt reading plain "Other".',
    );
  }

  return step(`Pay with other (${methodName})`, async () => {
    await requireCheckoutFor(orderId, 'other');

    await checkoutPage.payWithOther(methodName, amountCents);
    await clearPasscodeGuard();

    return settle(orderId, 'other');
  });
}

/**
 * Refuse to take money unless the till is on THIS order's checkout.
 *
 * Two failures at once, and both are cheap here and expensive later.
 * `checkoutPage.orderId()` only resolves on `/order/{id}/checkout`, so a spec
 * that skipped `createOrder()` fails on the flow's first line instead of on a
 * tender tab that was never mounted. And when the app is on a DIFFERENT order's
 * checkout — a previous step navigated, a re-opened order took over — every
 * click below would work perfectly and charge the wrong check.
 */
async function requireCheckoutFor(orderId: string, tender: string): Promise<void> {
  await checkoutPage.waitForReady(Timeouts.MEDIUM);

  const onScreen = await checkoutPage.orderId();
  if (onScreen === orderId) return;

  throw new Error(
    `Refusing to take a ${tender} payment for order ${orderId}: the checkout on screen is for ` +
      `order ${onScreen}. Nothing was charged. Pass the id the flow that created this order ` +
      `returned (createOrder() → CreatedOrder.orderId, or checkoutPage.orderId()), and check what ` +
      `navigated in between — flows never navigate by URL, so something else did.`,
  );
}

/**
 * Answer the passcode guard if it came up.
 *
 * See the module note: whether it appears at all is merchant configuration, so
 * the return value is information, not a branch anything acts on.
 */
async function clearPasscodeGuard(): Promise<void> {
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
}

/**
 * Wait for the payment to land on the success screen.
 *
 * `diagnose` is what turns a timeout into a report: the tender knows what its
 * own stall looks like (a terminal that never answered, a gift card the server
 * rejected late) and nothing else in the stack can name it.
 */
async function settle(
  orderId: string,
  tender: string,
  diagnose?: () => Promise<string>,
): Promise<PaymentSuccessPage> {
  try {
    return await paymentSuccessPage.waitForNavigation(Timeouts.API);
  } catch (error) {
    const detail = diagnose ? await diagnose().catch(() => '') : '';
    throw new Error(
      `The ${tender} payment for order ${orderId} never reached the payment-success screen.` +
        (detail ? ` ${detail}` : '') +
        ` If the passcode guard is still up, the staff behind STAFF_PASSCODE does not hold the ` +
        `"completed_payment" permission.`,
      { cause: error },
    );
  }
}

/** Why the card was not accepted, phrased so the reader knows whose problem it is. */
async function giftCardRejection(code: string, orderId: string): Promise<string> {
  if (await checkoutPage.isGiftCardInvalid()) {
    return (
      `The server rejected gift card "${code}" as invalid, so order ${orderId} was not paid. ` +
      `Check the number against the merchant under test — a card from another merchant reads as ` +
      `invalid rather than as unknown.`
    );
  }

  if (await checkoutPage.isGiftCardInsufficient()) {
    return (
      `Gift card "${code}" does not cover the balance of order ${orderId}. That is a split ` +
      `payment, not a failure: press checkoutPage.redeemGiftCard() to redeem what it holds onto a ` +
      `new check, then settle the remainder with a second tender.`
    );
  }

  return (
    `Gift card "${code}" produced neither an accepted, invalid nor insufficient-balance verdict ` +
    `for order ${orderId} within ${String(Timeouts.SHORT)}ms. The lookup is an upstream call — an ` +
    `offline till never opens this dialog at all.`
  );
}
