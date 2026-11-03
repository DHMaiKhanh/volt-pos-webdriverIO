import { browser, $ } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';

const env = loadEnv();

/** The Portal's Store Settings tab that carries Setting point config. */
const SETTINGS_PATH = (merchantId: string): string =>
  `/pos/nail/${merchantId}/setting?tab=payment-transactions`;

const LABEL_EARN_ON_TIP = 'Earn points on tip';

/** The switch in the same card as the "Earn points on tip" label. */
const EARN_ON_TIP_SWITCH =
  `//*[normalize-space(text())="${LABEL_EARN_ON_TIP}"]` +
  `/ancestor::*[.//*[@role="switch"]][1]//*[@role="switch"]`;

/** The unsaved-changes bar's Save (the bar appears only once the form is dirty). */
const SAVE_BUTTON = '//button[normalize-space(.)="Save"]';
const SAVED_TOAST = '//*[normalize-space(.)="Point settings saved"]';

/** Store Settings tabs are Radix tabs; `?tab=configuration` alone does not select it. */
const CONFIGURATION_TAB = '//button[@role="tab"][normalize-space(.)="Configuration"]';
/** Configuration → "Font size" card (VP-4809): radios valued small / medium / large. */
const FONT_SIZE_GROUP = '[role="radiogroup"][aria-label="Font size"]';

export interface FontSizeOption {
  /** `small` | `medium` | `large` — the value saved to `merchant_theme_pos_style.font_size`. */
  value: string;
  label: string;
  checked: boolean;
}

/**
 * Fastboy Portal — Store Settings → Payment & transactions (VP-4812).
 *
 * ## Signing in
 *
 * The Portal offers only "Continue with GCI Business" (a QR the GCI Business
 * app scans) and Google — nothing a spec can type. The lane runs Edge on the
 * fixed `.portal-profile/` (`PORTAL_PROFILE=1`, see wdio.web.conf.ts): a person
 * scans the QR once via `npm run portal:login`, and the session cookie stays in
 * that profile for every later run. {@link open} refuses to wait for a scan
 * unless asked to, so an expired session fails loudly instead of hanging.
 *
 * ## Why not a BasePage
 *
 * Same reason as {@link OrderSitePage}: the Portal ships no `data-testid`s, so
 * controls are reached by visible text and ARIA role.
 */
export class PortalSettingsPage {
  readonly name = 'Fastboy Portal settings';

  get url(): string {
    return `${env.PORTAL_URL}${SETTINGS_PATH(env.PORTAL_MERCHANT_ID)}`;
  }

  private async onLoginPage(): Promise<boolean> {
    return (await browser.getUrl()).includes('/login');
  }

  /** On the Portal's own origin and past its login page (not mid-way through Google). */
  private async isSignedIn(): Promise<boolean> {
    const url = await browser.getUrl();
    return url.startsWith(env.PORTAL_URL) && !url.includes('/login');
  }

  /**
   * Open Store Settings for the merchant under test.
   *
   * `waitForScanMs > 0` (portal:login only) waits that long on the login page for a
   * person to sign in (QR or Google); otherwise a login redirect throws.
   */
  async open(waitForScanMs = 0): Promise<this> {
    await browser.url(this.url);
    await browser.waitUntil(
      async () => (await this.onLoginPage()) || (await $(EARN_ON_TIP_SWITCH).isDisplayed()),
      {
        timeout: Timeouts.LONG,
        timeoutMsg: `${this.name}: neither the login page nor "${LABEL_EARN_ON_TIP}" rendered at ${this.url}.`,
      },
    );
    if (!(await this.onLoginPage())) return this;

    if (waitForScanMs <= 0) {
      throw new Error(
        `${this.name}: the Portal session in .portal-profile/ is missing or expired (redirected to /login). ` +
          'Run `npm run portal:login` and scan the QR with the GCI Business app, then re-run.',
      );
    }

    // A person signs in by hand — GCI Business QR or Google, whichever they pick —
    // so nothing here clicks. Done only once the browser is back on the Portal
    // itself and off /login: leaving /login for accounts.google.com is the middle
    // of a Google sign-in, not the end of it.
    await browser.waitUntil(async () => await this.isSignedIn(), {
      timeout: waitForScanMs,
      interval: 2_000,
      timeoutMsg: `${this.name}: not signed in within ${String(waitForScanMs / 1000)} s (QR or Google).`,
    });
    await browser.url(this.url);
    await $(EARN_ON_TIP_SWITCH).waitForDisplayed({ timeout: Timeouts.LONG });
    return this;
  }

  /** Is "Earn points on tip" on, as the switch renders it now? */
  async isEarnOnTip(): Promise<boolean> {
    const toggle = $(EARN_ON_TIP_SWITCH);
    await toggle.waitForDisplayed({ timeout: Timeouts.MEDIUM });
    return (await toggle.getAttribute('aria-checked')) === 'true';
  }

  /**
   * Set "Earn points on tip" and save. A no-op (no Save) when it already reads
   * `on`. Waits for the "Point settings saved" toast, so the value is upstream
   * when this returns.
   */
  async setEarnOnTip(on: boolean): Promise<{ changed: boolean }> {
    if ((await this.isEarnOnTip()) === on) return { changed: false };

    const toggle = $(EARN_ON_TIP_SWITCH);
    await toggle.scrollIntoView({ block: 'center' });
    await toggle.click();
    await browser.waitUntil(async () => (await this.isEarnOnTip()) === on, {
      timeout: Timeouts.SHORT,
      timeoutMsg: `${this.name}: the "${LABEL_EARN_ON_TIP}" switch did not flip.`,
    });

    const save = $(SAVE_BUTTON);
    await save.waitForClickable({ timeout: Timeouts.MEDIUM });
    await save.click();
    await $(SAVED_TOAST).waitForDisplayed({
      timeout: Timeouts.LONG,
      timeoutMsg: `${this.name}: no "Point settings saved" toast after Save.`,
    });
    return { changed: true };
  }

  /** Store Settings → Configuration tab, waiting for the Font size card. */
  async openConfiguration(): Promise<this> {
    await this.open();
    await $(CONFIGURATION_TAB).click();
    await $(FONT_SIZE_GROUP).waitForDisplayed({
      timeout: Timeouts.LONG,
      timeoutMsg: `${this.name}: no "Font size" radio group on the Configuration tab.`,
    });
    return this;
  }

  /** The Font size choices in render order, with the one the merchant has saved checked. Read-only. */
  async fontSizeOptions(): Promise<FontSizeOption[]> {
    return browser.execute((group: string) => {
      const root = document.querySelector(group);
      return Array.from(root?.querySelectorAll('[role="radio"]') ?? []).map((radio) => ({
        value: radio.getAttribute('value') ?? '',
        label: (radio.closest('label')?.querySelector('span')?.textContent ?? '').trim(),
        checked: radio.getAttribute('aria-checked') === 'true',
      }));
    }, FONT_SIZE_GROUP);
  }
}

export const portalSettingsPage = new PortalSettingsPage();
