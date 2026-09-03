import { Timeouts } from '../../../configs/constants/timeouts.js';
import { PaymentSuccessIds } from '../../constants/testids.js';
import type { Locator } from '../../helpers/selectors.js';
import { waitUntilPath } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/** How the customer wants their receipt. Values are `actionButtons[].value`. */
export type ReceiptDelivery = 'no_receipt' | 'print' | 'sms' | 'email';

/** `/order/{uuid}/payment-success`, and nothing under it. */
const PAYMENT_SUCCESS_PATH = /^\/order\/([^/]+)\/payment-success\/?$/;

/**
 * `/order/{orderId}/payment-success` — the post-payment screen.
 *
 * ## The four buttons are the whole screen
 *
 * Everything else here is a read-out: the total, the tip split, the tender line.
 * The only way forward is one of the receipt-delivery buttons, and three of the
 * four end the order:
 *
 * - **No Receipt** and **Print** both call `redirectAfterPaymentSuccess`, which
 *   goes to `/home` for a new sale, or back to `/order-history/{editOrderId}`
 *   when the order was reopened from history. That is why {@link printReceipt}
 *   and {@link continueToNextOrder} behave the same way about navigation.
 * - **Text Message** and **Email** open a dialog first and leave the screen up.
 *
 * ## Why this page object does not read the total
 *
 * The headline amount (`text-5xl font-bold`) and the tender line carry no
 * testid in either source, and the honest fallbacks for them are typography
 * classes shared with other screens. The amount that matters is asserted at the
 * checkout, before the money moves, and again in order history afterwards.
 */
export class PaymentSuccessPage extends BasePage {
  readonly name = 'Payment success';

  /**
   * The order id sits in the middle of the path, so `/order` is the only static
   * prefix. {@link isActive} holds the real shape.
   */
  readonly route = '/order';

  /**
   * The No Receipt button.
   *
   * `index.tsx` returns `null` while the transaction query is in flight and the
   * error screen if it comes back empty, so the action grid existing is proof
   * the completed transaction was actually read back.
   */
  protected readonly readyAnchor: Locator = PaymentSuccessIds.noReceiptBtn;

  override async isActive(): Promise<boolean> {
    return PAYMENT_SUCCESS_PATH.test(await this.currentPath());
  }

  /**
   * Are all four receipt-delivery actions on screen?
   *
   * No Receipt / Print / Text Message / Email — the whole action grid, which is
   * the reception side of the "Payment Successful!" screen (TC-ORDERFLOW-50).
   */
  async areAllReceiptActionsShown(): Promise<boolean> {
    return (
      (await this.isVisible(PaymentSuccessIds.noReceiptBtn)) &&
      (await this.isVisible(PaymentSuccessIds.printReceiptBtn)) &&
      (await this.isVisible(PaymentSuccessIds.smsReceiptBtn)) &&
      (await this.isVisible(PaymentSuccessIds.emailReceiptBtn))
    );
  }

  /**
   * The order's UUID, read off the URL.
   *
   * The screen itself never prints it: the order CODE only appears in the split
   * layout's per-check headings, and the plain layout shows the tender and the
   * amount. The URL is the one place it is always available.
   */
  async orderId(): Promise<string> {
    const path = await this.currentPath();
    const id = PAYMENT_SUCCESS_PATH.exec(path)?.[1];
    if (id === undefined) {
      throw new Error(
        `Not on a payment-success URL — current path is "${path}", expected /order/{id}/payment-success.`,
      );
    }
    return id;
  }

  /**
   * Print the receipt on the attached printer.
   *
   * Fires the print job and then leaves the screen exactly like No Receipt does.
   * With no printer bound the app raises a "receipt not found" toast and stays
   * put, so chain {@link waitForFlowToEnd} when the spec depends on the exit.
   */
  async printReceipt(): Promise<this> {
    await this.click(PaymentSuccessIds.printReceiptBtn);
    return this;
  }

  /** Open the "text the receipt" dialog. The screen stays up behind it. */
  async textReceipt(): Promise<this> {
    await this.click(PaymentSuccessIds.smsReceiptBtn);
    return this;
  }

  /** Open the "email the receipt" dialog. The screen stays up behind it. */
  async emailReceipt(): Promise<this> {
    await this.click(PaymentSuccessIds.emailReceiptBtn);
    return this;
  }

  /**
   * Decline the receipt and end the order.
   *
   * Returns `this` rather than the next page object because the destination is
   * the order's own history: a normal sale lands on `/home`, while an order
   * reopened from history goes back to its detail pane. The spec knows which one
   * it set up; this page object does not.
   */
  async continueToNextOrder(): Promise<this> {
    await this.click(PaymentSuccessIds.noReceiptBtn);
    return this;
  }

  /** Pick a receipt-delivery option by its app-side value. */
  chooseReceiptDelivery(delivery: ReceiptDelivery): Promise<this> {
    switch (delivery) {
      case 'no_receipt':
        return this.continueToNextOrder();
      case 'print':
        return this.printReceipt();
      case 'sms':
        return this.textReceipt();
      case 'email':
        return this.emailReceipt();
    }
  }

  /**
   * Block until the router leaves this screen.
   *
   * Waits on the PATH rather than on the button disappearing: the redirect
   * unmounts the whole route, so polling for a gone element races the unmount
   * and can report success from a half-torn-down DOM.
   */
  async waitForFlowToEnd(timeout: number = Timeouts.NAVIGATION): Promise<this> {
    await waitUntilPath((path) => !PAYMENT_SUCCESS_PATH.test(path), {
      timeout,
      message: 'The payment-success screen never handed over to the next order',
    });
    return this;
  }
}

export default new PaymentSuccessPage();
