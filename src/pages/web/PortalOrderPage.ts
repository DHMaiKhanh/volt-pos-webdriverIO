import { $, browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';

const env = loadEnv();

const ORDER_PATH = (merchantId: string, orderId: string): string =>
  `/pos/nail/${merchantId}/orders/${orderId}`;

/** Header button that opens the receipt side panel. */
const RECEIPT_BUTTON = '//button[normalize-space(.)="Receipt"]';
/** The receipt side panel (Radix dialog) once open. */
const RECEIPT_PANEL = '//*[@role="dialog"][.//*[normalize-space(.)="Receipt details"]]';

/**
 * Fastboy Portal — Orders → order detail → "Receipt details" panel (VP-4390).
 *
 * Signs in like {@link PortalSettingsPage}: the lane runs on the fixed
 * `.portal-profile/` (`PORTAL_PROFILE=1`); an expired session redirects to
 * `/login` and {@link open} throws instead of waiting. No `data-testid`s on the
 * Portal — controls are reached by visible text and ARIA role.
 */
export class PortalOrderPage {
  readonly name = 'Fastboy Portal order detail';

  url(orderId: string): string {
    return `${env.PORTAL_URL}${ORDER_PATH(env.PORTAL_MERCHANT_ID, orderId)}`;
  }

  /** Open the order detail page (by Portal order id). */
  async open(orderId: string): Promise<this> {
    await browser.url(this.url(orderId));
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/login') || (await $(RECEIPT_BUTTON).isDisplayed()),
      {
        timeout: Timeouts.LONG,
        timeoutMsg: `${this.name}: neither the login page nor the Receipt button rendered at ${this.url(orderId)}.`,
      },
    );
    if ((await browser.getUrl()).includes('/login')) {
      throw new Error(
        `${this.name}: the Portal session in .portal-profile/ is missing or expired (redirected to /login). ` +
          'Run `npm run portal:login`, sign in, then re-run.',
      );
    }
    return this;
  }

  /** Visible text of the whole order page. */
  async pageText(): Promise<string> {
    return $('body').getText();
  }

  /** Press Receipt and return the "Receipt details" panel's text. */
  async receiptText(): Promise<string> {
    await $(RECEIPT_BUTTON).click();
    const panel = $(RECEIPT_PANEL);
    await panel.waitForDisplayed({ timeout: Timeouts.MEDIUM });
    return panel.getText();
  }
}

export const portalOrderPage = new PortalOrderPage();
