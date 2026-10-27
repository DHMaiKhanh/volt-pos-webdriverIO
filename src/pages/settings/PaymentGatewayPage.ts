import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { settingsNavItem } from '../../constants/testids.js';
import {
  PAYMENT_GATEWAY_PATH,
  PAYMENT_GATEWAY_STORAGE_ITEM,
  PAYMENT_GATEWAY_STORE_KEY,
  PaymentGatewayIds,
} from '../../constants/testids.settings-gateway.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/**
 * `/settings/payment-gateway` — one switch: charge cards directly through the
 * Fastboy Payment gateway (ON) or through the legacy upstream API (OFF). No Save;
 * a toggle writes immediately to the DEVICE-scoped tauri store.
 *
 * ## Not reachable on build 1.1.56
 *
 * The settings sidebar has no entry for this path and the route renders "Not
 * Found" inside the settings shell (live dump 2026-10-25). Suites never navigate
 * by URL, so {@link isSidebarEntryShown} is the reachability probe; everything
 * else is ready for the day the screen comes back.
 */
export class PaymentGatewayPage extends BasePage {
  readonly name = 'Payment gateway';

  readonly route: string = PAYMENT_GATEWAY_PATH;

  protected readonly readyAnchor: Locator = PaymentGatewayIds.directSwitch;

  /** Is the settings sidebar offering this screen at all? */
  isSidebarEntryShown(): Promise<boolean> {
    return this.isVisible(settingsNavItem(PAYMENT_GATEWAY_PATH), Timeouts.SHORT);
  }

  async open(): Promise<this> {
    await logStep('Settings: open Payment Gateway');
    await this.click(settingsNavItem(PAYMENT_GATEWAY_PATH));
    return this.waitForNavigation();
  }

  isHeadingShown(): Promise<boolean> {
    return this.isVisible(PaymentGatewayIds.heading, Timeouts.MEDIUM);
  }

  isDescriptionShown(): Promise<boolean> {
    return this.isVisible(PaymentGatewayIds.description);
  }

  isNotFoundShown(): Promise<boolean> {
    return this.isVisible(PaymentGatewayIds.notFound);
  }

  async switchCount(): Promise<number> {
    try {
      return (await this.findAll(PaymentGatewayIds.anySwitch, { timeout: Timeouts.SHORT })).length;
    } catch {
      return 0;
    }
  }

  async directSwitchId(): Promise<string> {
    const el = await this.find(PaymentGatewayIds.directSwitch);
    return (await el.getAttribute('id')) ?? '';
  }

  async isDirectOn(): Promise<boolean> {
    const el = await this.find(PaymentGatewayIds.directSwitch);
    const aria = await el.getAttribute('aria-checked');
    if (aria === 'true' || aria === 'false') return aria === 'true';
    return (await el.getAttribute('data-state')) === 'checked';
  }

  /** Flip the switch. Saves immediately — the caller restores. */
  async toggleDirect(): Promise<this> {
    await this.click(PaymentGatewayIds.directSwitch);
    await settle();
    return this;
  }

  /** Flip the switch through its `<label for="direct-gateway">`. */
  async clickDirectLabel(): Promise<this> {
    await this.click(PaymentGatewayIds.directLabel);
    await settle();
    return this;
  }

  async setDirect(on: boolean): Promise<this> {
    if ((await this.isDirectOn()) !== on) await this.toggleDirect();
    return this;
  }

  hasSaveButton(): Promise<boolean> {
    return this.isVisible(PaymentGatewayIds.anySave, Timeouts.ANIMATION);
  }

  /**
   * `payment_direct_gateway` as stored by the plugin-store localStorage fallback,
   * or `null` when the key / item is absent (e.g. a real Tauri store on disk).
   */
  async readStoredDirect(): Promise<boolean | null> {
    const raw = await browser.execute(
      (item: string) => window.localStorage.getItem(item),
      PAYMENT_GATEWAY_STORAGE_ITEM,
    );
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const value = parsed[PAYMENT_GATEWAY_STORE_KEY];
      return typeof value === 'boolean' ? value : null;
    } catch {
      return null;
    }
  }
}

export default new PaymentGatewayPage();
