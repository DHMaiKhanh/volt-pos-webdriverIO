import { Timeouts } from '../../../configs/constants/timeouts.js';
import { CheckoutIds, checkoutKeypadKey } from '../../constants/testids.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle, waitUntilPath } from '../../helpers/wait.js';
import { parseMoney } from '../../utils/money.js';
import { BasePage } from '../BasePage.js';
import paymentSuccessPage from './PaymentSuccessPage.js';
import type { PaymentSuccessPage } from './PaymentSuccessPage.js';

/** The four tender tabs, in the order `PAYMENT_METHODS` declares them. */
export type Tender = 'card' | 'cash' | 'gift-card' | 'other';

/**
 * Cash quick-select presets, in CENTS.
 *
 * `checkout-keypad.tsx` hardcodes `["10000", "5000", "1000", "500"]` — $100 / $50
 * / $10 / $5. VP-802's page object assumed a $20/$50/$100/$200 ladder, which is
 * the adjust-tip keypad's, not this one's.
 */
export type CashPreset = 500 | 1000 | 5000 | 10000;

/**
 * What the card-charging dialog is showing.
 *
 * Mirrors `PAYMENT_MESSAGE_STATUS` (`src/shared/types.ts`) as the cashier sees
 * it: `INSERT_CARD` and `PROCESSING` are both "the terminal has it, wait", so
 * they collapse into one state — nothing a spec can act on tells them apart.
 */
export const CardChargeState = {
  /** Dialog is not mounted. */
  CLOSED: 'closed',
  /** Terminal armed or mid-authorisation (`insert_card` / `processing`). */
  CHARGING: 'charging',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
} as const;

export type CardChargeState = (typeof CardChargeState)[keyof typeof CardChargeState];

const TENDER_TAB: Record<Tender, Locator> = {
  card: CheckoutIds.tabCard,
  cash: CheckoutIds.tabCash,
  'gift-card': CheckoutIds.tabGiftCard,
  other: CheckoutIds.tabOther,
};

/** `/order/{uuid}/checkout` — and nothing under it (`/checkout/view-cart`, `/checkout/processing-payment`). */
const CHECKOUT_PATH = /^\/order\/([^/]+)\/checkout\/?$/;

/**
 * One rendered money amount, e.g. `$1,234.56` or the `- $5.00` of a deduction row.
 *
 * `money()` always emits the `$`, which is what makes this safe under i18n — the
 * symbol is a currency.js default the app never overrides, not a translated
 * label.
 */
const RENDERED_AMOUNT = /-?\s*\$\s*[\d,]+(?:\.\d{1,2})?/g;

/**
 * Pull the amount out of a summary row.
 *
 * The testids on this screen are PENDING, so several of these locators resolve
 * through a fallback that matches the whole ROW — label and amount together
 * (`order-summary-detail.tsx` renders `<span>Subtotal</span><span>$12.34</span>`
 * inside one flex div). Handing that raw string to `parseMoney` fails on the
 * deduction rows, whose text is `Total Discount - $12.34`: the leading `-` of
 * the amount is not at the start of the string, so the sign is lost and the `$`
 * is left stranded mid-token. Isolating the LAST amount first keeps one code
 * path working whether the id lands on the row or on the amount span.
 */
function amountIn(text: string, what: string): string {
  const tokens = text.match(RENDERED_AMOUNT);
  const last = tokens?.[tokens.length - 1];
  if (last === undefined) {
    throw new Error(
      `${what} rendered "${text.replace(/\s+/g, ' ').trim()}", which holds no money amount. ` +
        `Either the row is not on screen for this order (discount, tip and change all render ` +
        `conditionally) or the locator matched a different element.`,
    );
  }
  return last;
}

/**
 * `/order/{orderId}/checkout` — the tender screen.
 *
 * ## Amounts are CENTS, everywhere
 *
 * The Enter Amount display is driven by a **cents string**: `checkout-payment.tsx`
 * renders `money(amount || 0)` with currency.js's `fromCents`, and the keypad
 * appends raw digits to that string. Pressing `1`,`2`,`3` therefore shows
 * `$1.23`, not `$123`. Every amount this page object takes or returns is cents,
 * so {@link enterAmount}(1234) is $12.34.
 *
 * ## Two things about the entry field that bite
 *
 * 1. **It is pre-filled.** An effect in `checkout/index.tsx` runs
 *    `setAmount(remaining)` on every change of payment method, remaining or tip,
 *    so a freshly opened tab already holds the full amount due. A spec paying in
 *    full should press Complete Payment and enter nothing. {@link enterAmount}
 *    clears first for exactly this reason.
 * 2. **It is clamped on every tender but cash.** `maxValue` is
 *    `Number.MAX_SAFE_INTEGER` for cash and the *remaining due* for card, gift
 *    card and other (`appendCashDigit` in `@/shared/checkout/tender`). Typing
 *    $50 against a $30 balance on the card tab silently yields $30 — the app is
 *    refusing to over-tender, not dropping keystrokes.
 *
 * ## Why clicking a keypad key works at all
 *
 * The shared `Keypad` fires on `onMouseDown` and calls `preventDefault()` in its
 * `onClick`. A WebDriver click is a real input-level click, so mousedown fires
 * and the key registers; a scripted `HTMLElement.click()` through `execute()`
 * would not. Never "optimise" a keypad press into a JS click.
 */
export class CheckoutPage extends BasePage {
  readonly name = 'Checkout';

  /**
   * The order id sits in the MIDDLE of this path, so there is no usable static
   * prefix — `/order` also covers payment-success and split-order.
   * {@link isActive} carries the real shape.
   */
  readonly route = '/order';

  /**
   * Complete Payment, not the header: it renders from the order query, so its
   * presence proves the order arrived rather than that the shell painted.
   */
  protected readonly readyAnchor: Locator = CheckoutIds.completePaymentBtn;

  override async isActive(): Promise<boolean> {
    return CHECKOUT_PATH.test(await this.currentPath());
  }

  /**
   * The order's UUID, read off the URL.
   *
   * Deliberately not `checkout-order-id`: that element shows the human-facing
   * order CODE (`#1042`), while every route, query and assertion downstream
   * needs the uuid. {@link orderNumber} returns the other one.
   */
  async orderId(): Promise<string> {
    const path = await this.currentPath();
    const id = CHECKOUT_PATH.exec(path)?.[1];
    if (id === undefined) {
      throw new Error(`Not on a checkout URL — current path is "${path}", expected /order/{id}/checkout.`);
    }
    return id;
  }

  /* --------------------------------------------------------------------- *
   * Tender selection
   * --------------------------------------------------------------------- */

  /**
   * Switch tender tab.
   *
   * Clicking the active tab is a no-op in the app (`handleClick` returns early),
   * and `card` is the default on arrival, so this is safe to call unconditionally.
   * A tab the merchant cannot use right now is rendered `disabled` — offline
   * kills card, gift card and other — and the click then fails on
   * `waitForClickable` with that button named, which is the diagnosis.
   */
  async selectTender(tender: Tender): Promise<this> {
    await this.click(TENDER_TAB[tender]);
    // The switch re-runs the auto-fill effect AND swaps the keypad layout (the
    // $5/$10/$50/$100 column exists only on cash), so the next key press can
    // otherwise land on a button React is in the middle of replacing.
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Amount entry
   * --------------------------------------------------------------------- */

  /**
   * Replace the entry with `cents`.
   *
   * Clears first — the field arrives pre-filled with the remaining due, so
   * typing straight into it appends to an amount the spec never chose.
   */
  async enterAmount(cents: number): Promise<this> {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new Error(
        `enterAmount() takes a non-negative integer number of CENTS, received ${String(cents)}. ` +
          `Use toCents() from src/utils/money.ts if you are holding dollars.`,
      );
    }
    await this.clearAmount();
    return this.typeDigits(String(cents));
  }

  /** Press digit keys without clearing, for tests of the keypad's own behaviour. */
  async typeDigits(digits: string): Promise<this> {
    if (!/^\d+$/.test(digits)) {
      throw new Error(`typeDigits() takes digits only, received ${JSON.stringify(digits)}.`);
    }
    for (const digit of digits) {
      await this.click(checkoutKeypadKey(digit));
    }
    return this;
  }

  /** The `C` key. Resets the entry to `0`, not to empty. */
  async clearAmount(): Promise<this> {
    await this.click(CheckoutIds.keypadClear);
    return this;
  }

  /**
   * The backspace key.
   *
   * The checkout layout names this key `back`, not the shared keypad's
   * `Backspace`, which is why it does NOT auto-repeat when held — the repeat
   * timer in `keypad.tsx` only arms for the literal value `Backspace`.
   */
  async pressBackspace(): Promise<this> {
    await this.click(CheckoutIds.keypadBackspace);
    return this;
  }

  /**
   * Add a cash quick-select preset to the entry.
   *
   * Presets ADD to whatever is already entered rather than replacing it, and the
   * column only exists on the cash tab (`showLayoutQuickSelect = paymentMethod
   * === CASH`), so calling this on any other tender finds nothing.
   */
  async addCashPreset(preset: CashPreset): Promise<this> {
    await this.click(checkoutKeypadKey(String(preset)));
    return this;
  }

  /** What the big Enter Amount display currently shows, in cents. */
  enteredAmountCents(): Promise<number> {
    return this.centsOf(CheckoutIds.enterAmountInput);
  }

  /* --------------------------------------------------------------------- *
   * Order detail column
   * --------------------------------------------------------------------- */

  /** The human-facing order code shown on the checkout header. See {@link orderId}. */
  orderNumber(): Promise<string> {
    return this.text(CheckoutIds.orderId);
  }

  customerName(): Promise<string> {
    return this.text(CheckoutIds.customerName);
  }

  customerPhone(): Promise<string> {
    return this.text(CheckoutIds.customerPhone);
  }

  orderNote(): Promise<string> {
    return this.text(CheckoutIds.notes);
  }

  /* --------------------------------------------------------------------- *
   * Summary — all reads return CENTS
   * --------------------------------------------------------------------- */

  subtotalCents(): Promise<number> {
    return this.centsOf(CheckoutIds.subtotal);
  }

  /**
   * The Total Discount row, as rendered — i.e. NEGATIVE.
   *
   * `order-summary-detail.tsx` prints deductions with a leading `- `, and this
   * page object reports what the cashier sees rather than re-interpreting it. A
   * $5 discount comes back as `-500`.
   */
  discountCents(): Promise<number> {
    return this.centsOf(CheckoutIds.discount);
  }

  tipCents(): Promise<number> {
    return this.centsOf(CheckoutIds.tipAmount);
  }

  totalCents(): Promise<number> {
    return this.centsOf(CheckoutIds.total);
  }

  totalPaidCents(): Promise<number> {
    return this.centsOf(CheckoutIds.totalPaid);
  }

  /**
   * Amount still owed, in cents — always POSITIVE.
   *
   * `change-remaining-amount.tsx` renders `money(Math.abs(remainingAmount))`, so
   * an over-tender does not come back negative here; it turns the row red and
   * surfaces as {@link changeCents} instead.
   */
  remainingCents(): Promise<number> {
    return this.centsOf(CheckoutIds.remaining);
  }

  /**
   * Change owed back, in cents.
   *
   * The row is cash-only and only rendered while change is > 0, so this throws
   * on any other tender or on an exact tender. Probe with {@link isChangeShown}
   * when its absence is the thing under test.
   */
  changeCents(): Promise<number> {
    return this.centsOf(CheckoutIds.change);
  }

  /** Is the cash Change row on screen? Non-throwing — it is hidden until change > 0. */
  isChangeShown(): Promise<boolean> {
    return this.isVisible(CheckoutIds.change);
  }

  /** Is the Tip row on screen? The summary omits it entirely while the tip is 0. */
  isTipShown(): Promise<boolean> {
    return this.isVisible(CheckoutIds.tipAmount);
  }

  /** Is the Total Discount row on screen? Omitted entirely while the discount is 0. */
  isDiscountShown(): Promise<boolean> {
    return this.isVisible(CheckoutIds.discount);
  }

  /* --------------------------------------------------------------------- *
   * Actions
   * --------------------------------------------------------------------- */

  /**
   * Press Complete Payment.
   *
   * Where this lands depends on the tender: cash, gift card and other go
   * straight to `/order/{id}/payment-success`, while card opens the charging
   * dialog first and navigates only once the terminal approves. Chain
   * {@link awaitPaymentSuccess} when the spec wants the success screen either way.
   *
   * The button is wrapped in `PermissionProtectedButton requiredPermission=
   * "completed_payment"`, so a merchant with that permission on gets the
   * passcode-guard dialog here instead of a completed sale.
   */
  async pressCompletePayment(): Promise<this> {
    await this.click(CheckoutIds.completePaymentBtn);
    return this;
  }

  /**
   * Is Complete Payment pressable?
   *
   * Card orders keep it disabled until the tip + signature handoff has come back
   * from the customer display, which is the assertion VP-802's CD_07 makes.
   */
  async isCompletePaymentEnabled(): Promise<boolean> {
    const button = await this.find(CheckoutIds.completePaymentBtn, { visible: true });
    return button.isEnabled();
  }

  /** Hand the tip screen to the customer display. Disabled when the order cannot be tipped. */
  async pressTip(): Promise<this> {
    await this.click(CheckoutIds.tipBtn);
    return this;
  }

  async pressPrint(): Promise<this> {
    await this.click(CheckoutIds.printBtn);
    return this;
  }

  /** Open the cash drawer. Guarded by the `open_cash_drawer` permission. */
  async pressCashDrawer(): Promise<this> {
    await this.click(CheckoutIds.cashDrawerBtn);
    return this;
  }

  /**
   * Leave checkout the way a cashier does — the header's back arrow.
   *
   * The only exit that is not a payment. `header-left.tsx` strips the logo and
   * the quick-nav on every checkout path, so nothing else on this screen routes
   * anywhere; the arrow calls `router.history.back()`, which normally means the
   * till.
   *
   * The presence check is not defensive padding. `HeaderLeft` renders `null`
   * instead of the arrow once `canCompleteSale()` reports the order fully
   * tendered, so on a checkout that is ready to close there is genuinely no way
   * back — and without this the failure would read as a missing testid rather
   * than as "finish the payment".
   */
  async pressBack(): Promise<this> {
    if (!(await this.exists(CheckoutIds.backBtn, Timeouts.SHORT))) {
      throw new Error(
        `${this.name}: no back button on ${await this.currentPath()}. header-left.tsx hides it once ` +
          `canCompleteSale() reports the order fully tendered, which is the app refusing to let a ` +
          `paid-up order be walked away from — complete the payment, or delete the draft from /home.`,
      );
    }
    await this.click(CheckoutIds.backBtn);
    return this;
  }

  /** Select a tender, optionally set an amount, then complete. Omit the amount to pay the pre-filled balance. */
  async payWith(tender: Tender, amountCents?: number): Promise<this> {
    await this.selectTender(tender);
    if (amountCents !== undefined) await this.enterAmount(amountCents);
    return this.pressCompletePayment();
  }

  /** Cash tender end to end. `amountCents` is what the customer handed over. */
  payWithCash(amountCents?: number): Promise<this> {
    return this.payWith('cash', amountCents);
  }

  /* --------------------------------------------------------------------- *
   * "Other" tender
   * --------------------------------------------------------------------- */

  /**
   * Switch to Other and wait for its name field.
   *
   * The field is the readiness signal rather than the tab's own state:
   * `checkout-payment.tsx` renders it only while `paymentMethod === "other"`,
   * whereas the tab's selected styling is a class that lands a frame early.
   *
   * Note what Other is NOT: a *labelled* tender, not an untaxed one. Tax stays
   * applied exactly as it does for card — a $15 service tenders $16.50, not
   * $15.00 — so a spec expecting the cash figure here is asserting the wrong
   * number.
   */
  async selectOtherTender(): Promise<this> {
    await this.selectTender('other');
    await this.find(CheckoutIds.otherMethodName, { visible: true, timeout: Timeouts.SHORT });
    return this;
  }

  /**
   * Name the Other tender — "Zelle", "Bank Transfer", "Personal Check".
   *
   * Recorded on the transaction and echoed on the payment-success screen as
   * `Other (<name>)`, which is what makes it assertable downstream. The app caps
   * it at 255 characters and truncates silently, so anything longer is rejected
   * here instead: a spec that thinks it wrote 300 characters and reads back 255
   * has a far harder failure to diagnose than this one.
   */
  async enterOtherMethodName(name: string): Promise<this> {
    if (name.length > 255) {
      throw new Error(
        `enterOtherMethodName() received ${String(name.length)} characters; the input is ` +
          'maxLength={255} and would truncate silently.',
      );
    }
    await this.setValue(CheckoutIds.otherMethodName, name);
    return this;
  }

  /** What the Other name field currently holds. */
  otherMethodName(): Promise<string> {
    return this.value(CheckoutIds.otherMethodName);
  }

  /** Is the Other name field on screen? Proof that Other is the selected tab. */
  isOtherMethodNameShown(): Promise<boolean> {
    return this.isVisible(CheckoutIds.otherMethodName, Timeouts.ANIMATION);
  }

  /** Other tender end to end: select, label, complete. The passcode guard is the caller's. */
  async payWithOther(methodName: string, amountCents?: number): Promise<this> {
    await this.selectOtherTender();
    await this.enterOtherMethodName(methodName);
    if (amountCents !== undefined) await this.enterAmount(amountCents);
    return this.pressCompletePayment();
  }

  /**
   * Block until the router reaches the payment-success screen, then hand it over.
   *
   * The target is `/order/{id}/payment-success`. There is also a
   * `/order/{id}/checkout/payment-success` route in the tree, but it is an
   * unfinished TanStack scaffold ("Hello ...") that nothing navigates to — do
   * not wait on it.
   */
  async awaitPaymentSuccess(timeout: number = Timeouts.API): Promise<PaymentSuccessPage> {
    const orderId = await this.orderId();
    await waitUntilPath((path) => path.startsWith(`/order/${orderId}/payment-success`), {
      timeout,
      message: `Payment for order ${orderId} never reached the payment-success screen`,
    });
    return paymentSuccessPage.waitForReady(timeout);
  }

  /* --------------------------------------------------------------------- *
   * Waiting on the customer display
   * --------------------------------------------------------------------- */

  /** Is the "customer is adding a tip" wait dialog up on this window? */
  isWaitingForCustomerTip(): Promise<boolean> {
    return this.isVisible(CheckoutIds.waitingCustomerTipDialog);
  }

  /** Is the "customer is signing" wait dialog up on this window? */
  isWaitingForCustomerSignature(): Promise<boolean> {
    return this.isVisible(CheckoutIds.waitingCustomerSignatureDialog);
  }

  /**
   * Wait for both customer-handoff dialogs to close.
   *
   * They are cashier-side mirrors of the customer display's tip and signature
   * steps, so this is what a dual-window spec waits on after driving the second
   * window — the tip lands on the summary only once the dialog is gone.
   */
  async waitForCustomerHandoff(timeout: number = Timeouts.API): Promise<this> {
    await this.waitGone(CheckoutIds.waitingCustomerTipDialog, timeout);
    await this.waitGone(CheckoutIds.waitingCustomerSignatureDialog, timeout);
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Card charging dialog
   * --------------------------------------------------------------------- */

  /** Wait for the charging dialog to mount after Complete Payment on the card tender. */
  async waitForCardChargingDialog(timeout: number = Timeouts.MEDIUM): Promise<this> {
    await this.find(CheckoutIds.cardChargingDialog, { timeout, visible: true });
    return this;
  }

  /**
   * Which screen the charging dialog is on.
   *
   * Resolved by probing the three terminal-state messages, because the dialog
   * swaps its whole body per status and only the message elements distinguish
   * them — the icons are inlined SVG with the icon name stripped
   * (`src/components/icon.tsx`), so nothing else in the DOM names the state.
   * Anything mounted but not yet resolved is {@link CardChargeState.CHARGING}.
   */
  async cardChargeState(): Promise<CardChargeState> {
    if (!(await this.exists(CheckoutIds.cardChargingDialog, Timeouts.ANIMATION))) {
      return CardChargeState.CLOSED;
    }
    if (await this.exists(CheckoutIds.cardSuccessMsg, Timeouts.ANIMATION)) return CardChargeState.SUCCESS;
    if (await this.exists(CheckoutIds.cardFailedMsg, Timeouts.ANIMATION)) return CardChargeState.FAILED;
    if (await this.exists(CheckoutIds.cardTimeoutMsg, Timeouts.ANIMATION)) return CardChargeState.TIMEOUT;
    return CardChargeState.CHARGING;
  }

  /**
   * Poll {@link cardChargeState} until it reports `state`.
   *
   * Budgeted on `Timeouts.API` by default: the terminal's own window is
   * `APP_CONFIG.transaction.timeoutSeconds`, and the authorisation round trip
   * that resolves it is an upstream call, not a local one.
   */
  async waitForCardChargeState(state: CardChargeState, timeout: number = Timeouts.API): Promise<this> {
    const deadline = Date.now() + timeout;
    let seen: CardChargeState = CardChargeState.CLOSED;

    while (Date.now() < deadline) {
      seen = await this.cardChargeState();
      if (seen === state) return this;
      await settle();
    }

    throw new Error(
      `The card charging dialog never reached "${state}" within ${String(timeout)}ms — ` +
        `last seen "${seen}". A charge only advances with a real Bamboo DOT terminal attached; ` +
        `without one the dialog sits on "waiting for connect device" and reports "charging".`,
    );
  }

  /** The amount being charged, in cents, as printed inside the charging dialog. */
  cardChargeAmountCents(): Promise<number> {
    return this.centsOf(CheckoutIds.cardChargeAmount);
  }

  /**
   * Seconds left on the charging countdown.
   *
   * `AnimatedLoadingCircleTimer` draws it as an SVG `<text>` reading `30s`, and
   * removes the node entirely at zero — so this throws once the countdown
   * elapses rather than returning 0.
   */
  async cardCountdownSeconds(): Promise<number> {
    const rendered = await this.text(CheckoutIds.cardCountdown);
    const seconds = /\d+/.exec(rendered)?.[0];
    if (seconds === undefined) {
      throw new Error(`The card countdown rendered "${rendered}", which holds no number of seconds.`);
    }
    return Number(seconds);
  }

  /** Is the Try Again button offered? It is hidden on failures the app refuses to retry. */
  isCardTryAgainOffered(): Promise<boolean> {
    return this.isVisible(CheckoutIds.cardTryAgainBtn);
  }

  /**
   * Re-arm the terminal after a failure or a timeout.
   *
   * The button spends its first 3 seconds disabled (`FAILED_RETRY_COOLDOWN_SEC`
   * in `content-progress-dialog.tsx`); the inherited click waits that out via
   * `waitForClickable` rather than needing a pause here.
   */
  async pressCardTryAgain(): Promise<this> {
    await this.click(CheckoutIds.cardTryAgainBtn);
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Gift card tender
   * --------------------------------------------------------------------- */

  /** Wait for the scan dialog that opens with the gift-card tender. */
  async waitForGiftCardScanDialog(timeout: number = Timeouts.MEDIUM): Promise<this> {
    await this.find(CheckoutIds.gcScanDialog, { timeout, visible: true });
    return this;
  }

  /**
   * Type a gift-card number instead of scanning it.
   *
   * `InputCode` renders the real `<input>` as `absolute inset-0 opacity-0` over
   * a formatted display div, so it is present but never "displayed" by the
   * WebDriver definition — hence `visible: false`. Setting its value still
   * reaches React's change handler normally.
   */
  async enterGiftCardCode(code: string): Promise<this> {
    await this.click(CheckoutIds.gcInputCodeBtn);
    await this.setValue(CheckoutIds.gcCodeInput, code, { visible: false });
    return this;
  }

  /** Confirm the entered code and look the card up. */
  async redeemGiftCard(): Promise<this> {
    await this.click(CheckoutIds.gcRedeemBtn);
    return this;
  }

  /** Pay with the accepted card's balance. */
  async payWithGiftCardBalance(): Promise<this> {
    await this.click(CheckoutIds.gcPayBtn);
    return this;
  }

  isGiftCardInvalid(): Promise<boolean> {
    return this.isVisible(CheckoutIds.gcInvalidMsg);
  }

  isGiftCardInsufficient(): Promise<boolean> {
    return this.isVisible(CheckoutIds.gcInsufficientMsg);
  }

  isGiftCardAccepted(): Promise<boolean> {
    return this.isVisible(CheckoutIds.gcAcceptedMsg);
  }

  /** The card's remaining balance, in cents, as shown after a successful lookup. */
  giftCardBalanceCents(): Promise<number> {
    return this.centsOf(CheckoutIds.gcBalanceInfo);
  }

  /* --------------------------------------------------------------------- *
   * Internals
   * --------------------------------------------------------------------- */

  private async centsOf(loc: Locator, timeout: number = Timeouts.MEDIUM): Promise<number> {
    const rendered = await this.text(loc, { timeout });
    return parseMoney(amountIn(rendered, loc.name));
  }
}

export default new CheckoutPage();
