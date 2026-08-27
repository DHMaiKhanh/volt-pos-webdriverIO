import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import { CustomerDisplayIds, customerPayBy, customerTipOption } from '../../constants/testids.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle } from '../../helpers/wait.js';
import { withCustomerWindow } from '../../helpers/window.js';
import { BasePage } from '../BasePage.js';

/**
 * A tip choice as VP-802 named them.
 *
 * The percentages are the merchant's default ladder, NOT a fixed one — see the
 * class note on {@link CustomerDisplayPage}.
 */
export type TipChoice = 10 | 15 | 20 | 25 | 'none' | 'custom';

/** `PAYMENT_TYPE` values, as the customer-facing method buttons spell them. */
export type CustomerPaymentMethod = 'card' | 'cash' | 'gift_card' | 'other';

/** One signature stroke, as offsets from the canvas centre. */
const SIGNATURE_STROKE: ReadonlyArray<{ x: number; y: number }> = [
  { x: -160, y: 20 },
  { x: -60, y: -30 },
  { x: 40, y: 30 },
  { x: 160, y: -20 },
];

/**
 * The `customer` window — route `/customer`, title `VOLT POS - Customer Display`.
 *
 * ## Every method switches windows for you
 *
 * The staff and customer windows are two WebDriver window handles in one
 * session, and a command only reaches the one the session is focused on. Every
 * public method here runs inside {@link withCustomerWindow}, which switches,
 * runs, and switches back in a `finally` — so a failed assertion on the customer
 * display cannot strand the rest of the spec on the wrong window, where the
 * staff controls it looks for do not exist and the reported failure names the
 * wrong screen.
 *
 * A spec therefore never calls `switchToCustomer()` itself. It reads as:
 *
 * ```ts
 * await checkoutPage.pressTip();
 * await customerDisplayPage.completeTipPrompt(20);
 * await checkoutPage.waitForCustomerHandoff();
 * ```
 *
 * ## This window is a step machine, not a route tree
 *
 * `customer/index.tsx` renders welcome / cart / tip / signature / card-status /
 * receipt off a single `step` value in a store driven by Tauri events from the
 * main window. The URL never changes, so `isActive()` and `route` only tell you
 * which WINDOW you are on — never which screen. Wait on the screen's own anchor
 * ({@link waitForTipPrompt}, {@link waitForSignaturePad}) instead.
 *
 * ## The tip presets are merchant data
 *
 * `view-content-tip.tsx` renders whatever `buildTipQuickOptions()` returns from
 * the merchant's tip settings, in PERCENT or in fixed AMOUNT mode, and keys each
 * tile by its settings row id. `10/15/20/25` are the shape VP-802 annotated and
 * the common default, not a guarantee — on an amount-mode merchant those ids
 * match nothing. {@link selectNoTip} and {@link openCustomTip} are the only two
 * choices that always exist.
 */
export class CustomerDisplayPage extends BasePage {
  readonly name = 'Customer display';

  readonly route = Routes.CUSTOMER;

  /**
   * The welcome screen — the idle state, and the one VP-802 used to identify
   * this window at all. It is NOT present mid-flow: see the class note.
   */
  protected readonly readyAnchor: Locator = CustomerDisplayIds.welcomeScreen;

  /**
   * Wait for the customer display to reach its idle screen.
   *
   * Overridden purely to run the inherited check against the right window — the
   * base implementation reads `browser.getUrl()` and queries the DOM of whatever
   * handle the session happens to be on, which for this page object is the staff
   * window nine times out of ten. The readiness logic itself is unchanged.
   */
  override waitForReady(timeout: number = Timeouts.LONG): Promise<this> {
    return withCustomerWindow(() => super.waitForReady(timeout));
  }

  /** Is the idle welcome screen up? */
  isShowingWelcome(): Promise<boolean> {
    return withCustomerWindow(() => this.isVisible(CustomerDisplayIds.welcomeScreen));
  }

  /* --------------------------------------------------------------------- *
   * Payment method
   * --------------------------------------------------------------------- */

  /**
   * Tap a payment method on the customer-facing cart.
   *
   * The only family on this screen whose testid ships today
   * (`customer/-view-cart/payment-method-buttons.tsx`).
   */
  choosePaymentMethod(method: CustomerPaymentMethod): Promise<this> {
    return withCustomerWindow(async () => {
      await this.click(customerPayBy(method));
      return this;
    });
  }

  /* --------------------------------------------------------------------- *
   * Tip prompt
   * --------------------------------------------------------------------- */

  /** Block until the tip prompt is on screen. */
  waitForTipPrompt(timeout: number = Timeouts.MEDIUM): Promise<this> {
    return withCustomerWindow(async () => {
      await this.find(CustomerDisplayIds.tipPopup, { timeout, visible: true });
      return this;
    });
  }

  isTipPromptShown(): Promise<boolean> {
    return withCustomerWindow(() => this.isVisible(CustomerDisplayIds.tipPopup));
  }

  /** Pick a tip. See the class note before hardcoding a percentage. */
  chooseTip(choice: TipChoice): Promise<this> {
    return withCustomerWindow(async () => {
      await this.tapTip(choice);
      return this;
    });
  }

  /**
   * Pick a percent preset the merchant's own ladder defines.
   *
   * Use this over {@link chooseTip} when the spec read the ladder out of the tip
   * settings rather than assuming it.
   */
  selectTipPreset(percent: number | string): Promise<this> {
    return withCustomerWindow(async () => {
      await this.click(customerTipOption(percent));
      return this;
    });
  }

  /** Decline to tip. Always present while a tip section renders. */
  selectNoTip(): Promise<this> {
    return withCustomerWindow(async () => {
      await this.click(CustomerDisplayIds.tipOptionNone);
      return this;
    });
  }

  /**
   * Open the custom-amount keypad.
   *
   * Only opens it. Driving that keypad needs a `customer-tip-keypad-*` locator
   * family, which neither VP-802 nor the app declares yet — the view reuses the
   * shared `Keypad` through `-components/tip-keypad.tsx` with no testids on it.
   */
  openCustomTip(): Promise<this> {
    return withCustomerWindow(async () => {
      await this.click(CustomerDisplayIds.tipOptionCustom);
      return this;
    });
  }

  /**
   * Confirm the screen and hand control back to the till.
   *
   * Disabled until the customer has made a choice, and — when the merchant runs
   * `signatureSetting` on — until the pad holds a stroke, which is why
   * {@link completeTipPrompt} signs before pressing it.
   */
  pressContinue(): Promise<this> {
    return withCustomerWindow(async () => {
      await this.click(CustomerDisplayIds.tipContinueBtn);
      return this;
    });
  }

  isContinueEnabled(): Promise<boolean> {
    return withCustomerWindow(async () => {
      const button = await this.find(CustomerDisplayIds.tipContinueBtn, { visible: true });
      return button.isEnabled();
    });
  }

  /**
   * The whole customer-side handoff in one window switch.
   *
   * Tip, then a signature when the flow asks for one, then Continue. Doing it as
   * a single switch matters: each `withCustomerWindow` round trip enumerates
   * every window and reads its title and URL, so composing this out of four
   * public calls costs four full enumerations while the till sits on its
   * "waiting for customer" dialog.
   *
   * Pass `sign: true` for the card tender, where the tip screen carries a
   * signature region and Continue stays disabled until the pad is drawn on.
   */
  completeTipPrompt(choice: TipChoice, opts: { sign?: boolean } = {}): Promise<this> {
    return withCustomerWindow(async () => {
      await this.find(CustomerDisplayIds.tipPopup, { timeout: Timeouts.MEDIUM, visible: true });
      await this.tapTip(choice);
      if (opts.sign === true) await this.drawSignature();
      await this.click(CustomerDisplayIds.tipContinueBtn);
      return this;
    });
  }

  /* --------------------------------------------------------------------- *
   * Signature pad
   * --------------------------------------------------------------------- */

  /**
   * Block until a signature pad is on screen.
   *
   * Matches both places one appears: the region embedded in the tip screen
   * (BEFORE timing) and the standalone signature step the app pushes after an
   * approved card charge (AFTER timing).
   */
  waitForSignaturePad(timeout: number = Timeouts.MEDIUM): Promise<this> {
    return withCustomerWindow(async () => {
      await this.find(CustomerDisplayIds.signaturePad, { timeout, visible: true });
      return this;
    });
  }

  isSignaturePadShown(): Promise<boolean> {
    return withCustomerWindow(() => this.isVisible(CustomerDisplayIds.signaturePad));
  }

  /** Draw a signature on the pad. */
  sign(): Promise<this> {
    return withCustomerWindow(async () => {
      await this.drawSignature();
      return this;
    });
  }

  /** Sign the standalone signature step and confirm it. */
  signAndContinue(): Promise<this> {
    return withCustomerWindow(async () => {
      await this.find(CustomerDisplayIds.signaturePad, { timeout: Timeouts.MEDIUM, visible: true });
      await this.drawSignature();
      await this.click(CustomerDisplayIds.tipContinueBtn);
      return this;
    });
  }

  /* --------------------------------------------------------------------- *
   * Internals — already inside the customer window
   * --------------------------------------------------------------------- */

  private async tapTip(choice: TipChoice): Promise<void> {
    if (choice === 'none') {
      await this.click(CustomerDisplayIds.tipOptionNone);
      return;
    }
    if (choice === 'custom') {
      await this.click(CustomerDisplayIds.tipOptionCustom);
      return;
    }
    await this.click(customerTipOption(choice));
  }

  /**
   * Drag a stroke across the signature canvas.
   *
   * Three things this has to get right:
   *
   * - **Real pointer events.** `signature_pad` binds `pointerdown`/`pointermove`
   *   /`pointerup` on the canvas and only emits its `endStroke` — the event the
   *   app stores the signature from — after a genuine down-move-up sequence. A
   *   click does nothing at all here.
   * - **Offsets from the element, never viewport coordinates.** The customer
   *   window wraps its whole tree in `zoom: 2/3` in a packaged build (it is `1`
   *   only under `import.meta.env.DEV`), so any coordinate computed by hand from
   *   a bounding box is off by a third. `origin` offsets are resolved by the
   *   driver against the element's own box.
   * - **Pauses between the moves.** Consecutive moves with no time between them
   *   arrive as one jump; `signature_pad` then records two points and draws a
   *   line so short that `isEmpty()` can still be true.
   */
  private async drawSignature(): Promise<void> {
    const canvas = await this.find(CustomerDisplayIds.signaturePad, { visible: true });
    const [first, ...rest] = SIGNATURE_STROKE;
    if (first === undefined) throw new Error('SIGNATURE_STROKE is empty — nothing to draw.');

    let stroke = browser.action('pointer').move({ origin: canvas, x: first.x, y: first.y }).down().pause(60);

    for (const point of rest) {
      stroke = stroke.move({ origin: canvas, x: point.x, y: point.y, duration: 80 }).pause(60);
    }

    await stroke.up().perform();
    // The pointer stays "down" in the driver's own input state until released,
    // and a leftover pressed button silently breaks the next window's clicks.
    await browser.releaseActions();
    // `endStroke` writes the data URL into the store on the next tick; Continue
    // reads `hasSignature` from that store to decide whether it is enabled.
    await settle();
  }
}

export default new CustomerDisplayPage();
