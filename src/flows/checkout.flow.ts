import { Timeouts } from '../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../configs/env/loadEnv.js';
import { passcodeDialog } from '../components/index.js';
import { step } from '../helpers/steps.js';
import { checkoutPage, customerDisplayPage, paymentSuccessPage } from '../pages/index.js';
import type { PaymentSuccessPage } from '../pages/index.js';
import { CardChargeState } from '../pages/pos/CheckoutPage.js';
import type { TipChoice } from '../pages/pos/CustomerDisplayPage.js';

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
  /**
   * The tip to pick on the customer display IF this merchant runs a tip flow on
   * cash (20258 does — see {@link completeCustomerTipIfPrompted}). Defaults to
   * `'none'`. Ignored on a merchant that settles cash straight to the receipt,
   * where no tip prompt appears and nothing reads this.
   */
  tip?: TipChoice;
  /** A custom tip in cents, typed on the customer-display keypad — overrides {@link tip}. */
  customTipCents?: number;
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
    await completeCustomerTipIfPrompted(tender.tip ?? 'none', tender.customTipCents);

    return settle(orderId, 'cash', async () =>
      (await checkoutPage.isWaitingForCustomerTip())
        ? `The till is still parked on "Customer is adding a tip. Please wait…": this merchant runs a ` +
          `tip flow on the CASH tender and the customer-display handoff never completed. It needs the ` +
          `LAUNCH lane, where the customer window is a real WebDriver handle the tip screen can be ` +
          `driven on.`
        : '',
    );
  });
}

/** Options for {@link payWithCard}. */
export interface CardPayment {
  /**
   * The tip the customer picks on their display. Defaults to `'none'` — the one
   * choice that always renders, whatever the merchant's tip ladder (see
   * {@link CustomerDisplayPage}).
   */
  tip?: TipChoice;
  /**
   * A custom tip in cents, typed on the keypad. Set this — and `tip` is ignored —
   * on a merchant that exposes no percent presets (e.g. 20258 shows only Custom
   * Tip + No Tip), where a percentage is entered as its dollar value instead.
   */
  customTipCents?: number;
}

/**
 * Charge the order to a card and land on the receipt screen.
 *
 * ## The sequence is the app's, not an abbreviation of it
 *
 * On merchant 20258 Complete Payment is ENABLED on the card tender, so the flow
 * is pay-FIRST: press it, clear the permission guard, then the CUSTOMER DISPLAY
 * drives the rest. The till's charging dialog waits on that handoff, and only
 * once it completes does the terminal charge proceed — so skipping the customer
 * side parks the dialog on "charging" indefinitely (verified live 2026-09-10).
 *
 * The customer side is two steps, both driven here:
 *   1. the tip screen — {@link CardPayment.tip} (default No Tip), plus a signature
 *      when the tip screen carries one; then
 *   2. AFTER the tapped card is approved on the terminal, a standalone signature
 *      the app pushes on the display.
 *
 * ## What it needs
 *
 * The LAUNCH lane (the customer display is only a WebDriver handle there), a
 * STAFF_PASSCODE the merchant accepts for `completed_payment`, and a real Bamboo
 * DOT terminal that approves the tapped card. The approval is what makes the
 * charge outlast {@link Timeouts.API}, so the settle waits on
 * {@link Timeouts.CARD_CHARGE}.
 */
export async function payWithCard(orderId: string, payment: CardPayment = {}): Promise<PaymentSuccessPage> {
  assertWritesAllowed('take a card payment');

  return step('Pay by card', async () => {
    await requireCheckoutFor(orderId, 'card');
    await checkoutPage.selectTender('card');

    await checkoutPage.pressCompletePayment();
    await clearPasscodeGuard();

    // 1) The customer's tip screen. No Tip is the choice that always exists; the
    //    screen also carries a signature region on a merchant that signs. A
    //    `customTipCents` overrides the preset path, for a merchant that offers
    //    only Custom Tip + No Tip (its keypad appends the amount as cents).
    await customerDisplayPage.waitForTipPrompt(Timeouts.LONG);
    if (payment.customTipCents !== undefined) {
      await customerDisplayPage.enterCustomTip(payment.customTipCents);
    } else {
      await customerDisplayPage.chooseTip(payment.tip ?? 'none');
    }
    if (await customerDisplayPage.isSignaturePadShown()) {
      await customerDisplayPage.sign();
    }
    await customerDisplayPage.pressContinue();

    // 2) Once the tapped card is APPROVED on the terminal, the display pushes a
    //    standalone signature — wait it out on the card budget, since the approval
    //    is what takes the time, then sign and confirm.
    await customerDisplayPage.waitForSignaturePad(Timeouts.CARD_CHARGE);
    await customerDisplayPage.signAndContinue();

    // The navigation is the outcome; the dialog state is only worth reading if the
    // settle stalls.
    return settle(
      orderId,
      'card',
      async () => {
        const state = await checkoutPage.cardChargeState();
        return state === CardChargeState.CHARGING
          ? `The charging dialog is still "${state}" after ${String(Timeouts.CARD_CHARGE / 1000)}s — ` +
              `the terminal never approved the tapped card, or the customer-display handoff stalled.`
          : `The charging dialog reports "${state}".`;
      },
      Timeouts.CARD_CHARGE,
    );
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
    // Same BEFORE-style tip handoff as cash/other on 20258 — drive it (no-op when
    // absent) before the scan dialog, which only opens once the tip is resolved.
    // The wait dialog rides the settle API round-trip and can take longer than the
    // cash path's, so give its appearance the MEDIUM budget.
    await completeCustomerTipIfPrompted('none', undefined, Timeouts.MEDIUM);

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
 * Redeem SEVERAL gift cards onto one order — the app's native partial-redemption
 * path — and land on the receipt screen.
 *
 * ## The sequence is the app's, verified live (2026-10-13, dev build)
 *
 * When a redeemed card holds LESS than the amount due, the dialog does not reject
 * it: it offers **"Redeem & Add New Check"** under "Gift card not Enough Balance —
 * Redeem with current balance and add a new check for the remaining amount?".
 * Pressing it spends that card's WHOLE balance toward the order, drops the
 * remaining due, and returns the SAME dialog to its scan screen so the next card
 * can be entered — no second Complete Payment. The first card that COVERS what is
 * left comes back "Gift Card Accepted" with a Pay button, and pressing Pay settles
 * the order to `/payment-success`.
 *
 * So the loop is: redeem a card; if it covers, Pay and we are done; if it is short,
 * Redeem & Add New Check and move to the next card. The caller passes the cards in
 * spend order, leanest first being the natural choice.
 *
 * Two ways it fails LOUDLY rather than hanging:
 *   - a card the server rejects (invalid / wrong merchant) — same diagnosis as the
 *     single-card flow; and
 *   - the cards run out while the order is still short — the LAST card was itself
 *     insufficient, so there is nothing left to cover the remainder. The error says
 *     to pass another card or settle the rest on a different tender.
 */
export async function payWithGiftCards(
  orderId: string,
  codes: readonly string[],
): Promise<PaymentSuccessPage> {
  assertWritesAllowed('take a gift-card payment');

  if (codes.length === 0 || codes.some((code) => code.trim() === '')) {
    throw new Error(
      'payWithGiftCards() needs at least one non-empty gift-card number. For a single card use ' +
        'payWithGiftCard(); this flow is for splitting one order across two or more cards.',
    );
  }

  return step(
    `Pay with ${String(codes.length)} gift cards [${codes.map((c) => `••••${c.slice(-4)}`).join(', ')}]`,
    async () => {
      await requireCheckoutFor(orderId, 'gift card');

      await checkoutPage.selectTender('gift-card');
      await checkoutPage.pressCompletePayment();
      await clearPasscodeGuard();
      // Same BEFORE-style tip handoff as the single-card flow — drive it once, before
      // the scan dialog opens. It does NOT re-prompt per partial redemption.
      await completeCustomerTipIfPrompted('none', undefined, Timeouts.MEDIUM);
      await checkoutPage.waitForGiftCardScanDialog(Timeouts.MEDIUM);

      let covered = false;
      for (let i = 0; i < codes.length; i += 1) {
        const code = codes[i]!;
        const isLast = i === codes.length - 1;

        await checkoutPage.enterGiftCardCode(code);
        await checkoutPage.redeemGiftCard();

        if (await checkoutPage.isGiftCardAccepted()) {
          await checkoutPage.payWithGiftCardBalance();
          covered = true;
          break;
        }

        // Short of the balance. Partial-redeem this card and carry on — unless it was
        // the last one, in which case the cards simply did not add up.
        if (await checkoutPage.isGiftCardInsufficient()) {
          if (isLast) {
            throw new Error(
              `The ${String(codes.length)} gift cards for order ${orderId} did not cover the balance: ` +
                `the last card (••••${code.slice(-4)}) was still short after the earlier ones were ` +
                `redeemed. Pass another funded card, or settle the remainder on a different tender.`,
            );
          }
          await checkoutPage.redeemAndAddNewCheck();
          // The redeem is an API round-trip; wait for the dialog to return to its scan
          // screen before the next code is typed.
          await checkoutPage.waitForGiftCardScanDialog(Timeouts.MEDIUM);
          continue;
        }

        // Neither accepted nor insufficient — invalid / wrong merchant / no verdict.
        throw new Error(await giftCardRejection(code, orderId));
      }

      if (!covered) {
        throw new Error(
          `Exhausted all ${String(codes.length)} gift cards for order ${orderId} without one covering ` +
            `the remaining balance. Nothing settled.`,
        );
      }

      return settle(orderId, 'gift card');
    },
  );
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
    // 20258 runs a BEFORE-style tip flow on non-card tenders too (see
    // completeCustomerTipIfPrompted): pressing Complete Payment parks the till on
    // "Customer is adding a tip. Please wait…" and pushes the tip screen to the
    // customer display, so "other" must drive that handoff exactly as cash does —
    // without it the settle sits on the wait dialog until the API timeout. A
    // no-op on a merchant that settles "other" straight to the receipt.
    await completeCustomerTipIfPrompted('none');

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
 * Drive the customer-display tip prompt when the merchant pushes one on a
 * non-card tender.
 *
 * A merchant can run a BEFORE-style tip flow on CASH (and gift-card / other),
 * not only on card — 20258 does exactly this on cash. Pressing Complete Payment
 * then does NOT go straight to the receipt: it parks the till on its "Customer
 * is adding a tip. Please wait…" dialog ({@link CheckoutPage.isWaitingForCustomerTip})
 * and pushes the tip screen to the customer display, and the sale settles only
 * once the customer side picks a tip and presses Continue. A merchant without
 * that flow settles cash straight to payment-success and never shows the dialog.
 *
 * So this is CONDITIONAL — the same shape as {@link clearPasscodeGuard}: it
 * drives the handoff only while the till is actually waiting, and returns a
 * no-op otherwise, so it is safe on a merchant that does not tip cash.
 *
 * Needs the LAUNCH lane, where the customer display is a real WebDriver handle.
 */
export async function completeCustomerTipIfPrompted(
  tip: TipChoice,
  customTipCents?: number,
  appearTimeout: number = Timeouts.SHORT,
): Promise<void> {
  // The "Customer is adding a tip. Please wait…" dialog renders a BEAT after
  // Complete Payment — it rides the settle's API round-trip — so a single read
  // races it: it returns false, the caller then waits on the scan/receipt and the
  // un-driven tip wedges the sale. On gift card the gap is wider (the scan dialog
  // only opens AFTER the tip resolves), so that path passes a longer
  // `appearTimeout`. A merchant that settles without a before-tip handoff never
  // shows the dialog, so the poll expires and this is a no-op.
  const waiting = await browser
    .waitUntil(() => checkoutPage.isWaitingForCustomerTip(), { timeout: appearTimeout, interval: 250 })
    .then(() => true)
    .catch(() => false);
  if (!waiting) return;

  await customerDisplayPage.waitForTipPrompt(Timeouts.LONG);
  if (customTipCents !== undefined) {
    await customerDisplayPage.enterCustomTip(customTipCents);
  } else {
    await customerDisplayPage.chooseTip(tip);
  }
  // A cash tip screen carries no signature on 20258, but a merchant that signs
  // renders the pad inside this same screen — sign it when it is there.
  if (await customerDisplayPage.isSignaturePadShown()) {
    await customerDisplayPage.sign();
  }
  await customerDisplayPage.pressContinue();
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
  timeout: number = Timeouts.API,
): Promise<PaymentSuccessPage> {
  try {
    return await paymentSuccessPage.waitForNavigation(timeout);
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
