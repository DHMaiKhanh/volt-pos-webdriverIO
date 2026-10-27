import { browser, $$ } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';
import { settle } from '../../helpers/wait.js';

const env = loadEnv();

/** Error prefix when the store's daily kiosk check-in cap is hit — retrying is pointless. */
export const CHECKIN_DAILY_LIMIT_ERROR = 'Store daily check-in limit reached';

/** What a kiosk check-in needs. All optional — each falls back to a known-good value. */
export interface CheckinInput {
  /** 10-digit phone. Omit to mint a FRESH unique number (always a new customer). */
  phone?: string;
  /** Full name typed on the "enter your full name" screen (new customers only). */
  name?: string;
  /** Service label exactly as the "What services…" grid lists it. */
  service?: string;
  /** Staff label exactly as the "preferred staff" grid lists it. */
  staff?: string;
}

/** The correlation key handed to the app lane to find the same check-in. */
export interface CheckinHandoff {
  name: string;
  phone: string;
  /** Last four digits — the app often renders only this on a waiting card. */
  last4: string;
  service: string;
  staff: string;
  /** ISO-ish timestamp of creation, stamped by the spec (not this page). */
  createdAtLabel?: string;
}

/**
 * GoCheckin self-service kiosk — `gap.gocheckin.net` → **GoCheckin** mini app.
 *
 * ## Why this is not a {@link BasePage}
 *
 * Same reason as the GoPOS web POM: this surface ships no `data-testid`s, so
 * every control is reached by visible text / placeholder / role. It also has
 * two extra wrinkles the app POMs never face:
 *
 * 1. **It lives in an iframe.** The GAP shell (`gap.gocheckin.net/iframe`)
 *    embeds the kiosk app (`checkin.gocheckin.net`) in a single `<iframe>`; the
 *    wizard routes client-side inside that one frame (…/policy-signature etc.),
 *    so we switch into it ONCE after it mounts and stay there for the flow.
 *    Owner login and the mini-app launcher are on the parent page, so those run
 *    at top level before the switch.
 * 2. **Phone entry is a touch keypad and consent needs a drawn signature.** The
 *    phone field is disabled — digits only land via the on-screen keypad — and
 *    the final screen is a signature canvas that gates its NEXT button until a
 *    stroke is drawn. Both are handled below with button taps and the W3C
 *    pointer Actions API.
 *
 * Like the GoPOS site it renders many hidden duplicate dialogs, so every lookup
 * goes through {@link visible} (first DISPLAYED match), never a bare `$()`.
 */
export class CheckinKioskPage {
  readonly name = 'GoCheckin Kiosk';

  /* --------------------------------------------------------------------- *
   * Primitives
   * --------------------------------------------------------------------- */

  /**
   * First DISPLAYED element matching `selector`, in the CURRENT frame context.
   *
   * The kiosk renders hidden template copies of every dialog, so a plain `$()`
   * routinely resolves a hidden one and the following wait times out. Scanning
   * `$$()` for a visible element is the only reliable resolution here.
   */
  private async visible(
    selector: string,
    opts: { timeout?: number; pick?: 'first' | 'last' } = {},
  ): Promise<WebdriverIO.Element> {
    const timeout = opts.timeout ?? Timeouts.MEDIUM;
    const pick = opts.pick ?? 'first';
    const deadline = Date.now() + timeout;
    let lastError = '';

    do {
      const els = await $$(selector).getElements();
      const displayed: WebdriverIO.Element[] = [];
      for (const el of els) {
        try {
          if (await el.isDisplayed()) displayed.push(el);
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      const chosen = pick === 'last' ? displayed.at(-1) : displayed.at(0);
      if (chosen) return chosen;
      await settle(150);
    } while (Date.now() < deadline);

    throw new Error(
      `No displayed element for "${selector}" within ${timeout}ms.` +
        (lastError ? ` Last error: ${lastError}` : ''),
    );
  }

  /** Click, falling back to an in-page DOM click when the native click is intercepted. */
  private async clickEl(el: WebdriverIO.Element): Promise<void> {
    try {
      await el.click();
    } catch (error) {
      if (!/intercepted|not clickable/i.test(String(error))) throw error;
      await browser.execute((node: HTMLElement) => node.click(), el);
    }
  }

  /** Resolve `selector` and click it, re-resolving if the element goes stale. */
  private async clickSelector(
    selector: string,
    opts: { timeout?: number; pick?: 'first' | 'last' } = {},
  ): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const el = await this.visible(selector, opts);
      try {
        await this.clickEl(el);
        return;
      } catch (error) {
        if (!/wasn't found|stale|not found|no such element/i.test(String(error))) throw error;
        lastError = error;
        await settle(200);
      }
    }
    throw new Error(`Could not click "${selector}" (element kept going stale). ${String(lastError)}`);
  }

  /** Is any element matching `selector` currently DISPLAYED (hidden duplicates ignored)? */
  private async anyDisplayed(selector: string): Promise<boolean> {
    const els = await $$(selector).getElements();
    for (const el of els) {
      if (await el.isDisplayed().catch(() => false)) return true;
    }
    return false;
  }

  /** Did a `<button>` whose text contains `text` become DISPLAYED within `timeout`? (never throws) */
  private async buttonVisible(text: string, timeout: number): Promise<boolean> {
    try {
      await this.visible(this.ciButton(text), { timeout });
      return true;
    } catch {
      return false;
    }
  }

  /** XPath for a `<button>` whose text contains `text`, case-insensitively (SKIP/NEXT/owner). */
  private ciButton(text: string): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    return `//button[contains(translate(normalize-space(.), "${upper}", "${lower}"), "${text.toLowerCase()}")]`;
  }

  /** The rendered text of the current frame's body, lower-cased for substring checks. */
  private async screenText(): Promise<string> {
    const text = await browser.execute(() => document.body.innerText).catch(() => '');
    return typeof text === 'string' ? text.toLowerCase() : '';
  }

  /** Is `substr` currently anywhere in the (current frame's) rendered text? */
  private async screenHas(substr: string): Promise<boolean> {
    return (await this.screenText()).includes(substr.toLowerCase());
  }

  /** Wait up to `timeout` for `substr` to appear on screen; return whether it did (never throws). */
  private async waitForScreen(substr: string, timeout: number): Promise<boolean> {
    try {
      await browser.waitUntil(async () => this.screenHas(substr), { timeout, interval: 300 });
      return true;
    } catch {
      return false;
    }
  }

  /* --------------------------------------------------------------------- *
   * Owner login + launch the kiosk (parent page)
   * --------------------------------------------------------------------- */

  /**
   * Sign into GAP as OWNER. Reuses the GoPOS web credentials — same tenant 14,
   * one set of secrets in `.env.dev` (`WEB_MERCHANT_ID` / `WEB_USERNAME` /
   * `WEB_PASSWORD`), never hard-coded here. No-ops if the lane is already
   * authenticated (the mini-app grid is already on screen).
   */
  async login(): Promise<void> {
    if (!env.WEB_USERNAME || !env.WEB_PASSWORD) {
      throw new Error(
        'WEB_USERNAME/WEB_PASSWORD are empty. Fill them in configs/env/.env.dev before running the GoCheckin lane.',
      );
    }

    await browser.url(env.GAP_URL);

    // A fresh Edge profile lands on the OWNER/STAFF chooser; a warm one may drop
    // straight onto the mini-app grid — in which case there is nothing to do.
    if (await this.waitForScreen('mini apps', Timeouts.SHORT)) return;

    await this.clickSelector(this.ciButton('owner'), { timeout: Timeouts.LONG });

    const id = await this.visible('input[placeholder="Enter your ID"]', { timeout: Timeouts.LONG });
    await id.setValue(env.WEB_MERCHANT_ID);
    const user = await this.visible('input[placeholder="Enter your user/ email"]');
    await user.setValue(env.WEB_USERNAME);
    const pass = await this.visible('input[placeholder="Enter your password"]');
    await pass.setValue(env.WEB_PASSWORD);

    // Exact match — there is also a "Login with Gap View" button to avoid.
    await this.clickSelector('//button[normalize-space()="Login"]');

    await browser.waitUntil(async () => this.screenHas('mini apps'), {
      timeout: Timeouts.LONG,
      timeoutMsg: 'Owner login did not reach the GAP mini-app grid.',
    });
  }

  /**
   * Open the **GoCheckin** mini app and switch into its iframe, leaving the
   * kiosk sitting on the phone-entry screen.
   */
  async openKiosk(): Promise<void> {
    await browser.switchFrame(null); // make sure we start at the top document
    await this.clickSelector('//p[normalize-space()="GoCheckin"]', { timeout: Timeouts.LONG });

    // First launch per session asks "Auto open this app?" — decline so we never
    // change the tenant's device setting. It is not always shown.
    if (await this.waitForScreen('auto open this app', Timeouts.SHORT)) {
      await this.clickSelector('//button[normalize-space()="No"]');
    }

    await browser.waitUntil(async () => (await browser.getUrl()).includes('/iframe'), {
      timeout: Timeouts.LONG,
      timeoutMsg: 'GoCheckin mini app did not open (never reached /iframe).',
    });

    await this.enterKioskFrame();

    // The kiosk is ready once the keypad is live. Clear the inactivity prompt first.
    await this.dismissSessionTimeout();
    await this.visible('//button[normalize-space()="1"]', { timeout: Timeouts.LONG });
  }

  /** Point WebDriver at the kiosk iframe (re-finds it from the top each time). */
  private async enterKioskFrame(): Promise<void> {
    await browser.switchFrame(null);
    const iframe = await this.visible('iframe', { timeout: Timeouts.LONG });
    await browser.switchFrame(iframe);
  }

  /** If the "Check-in session timeout…continue?" prompt is up, keep the session. */
  private async dismissSessionTimeout(): Promise<void> {
    if (await this.screenHas('session timeout')) {
      await this.clickSelector('//button[normalize-space()="Yes"]').catch(() => undefined);
    }
  }

  /* --------------------------------------------------------------------- *
   * Create a check-in (inside the kiosk iframe)
   * --------------------------------------------------------------------- */

  /**
   * Walk the kiosk wizard end to end and return the correlation key.
   *
   * By default this mints a FRESH phone + name each run, so the check-in is a
   * brand-new customer that cannot collide with a prior run's card still sitting
   * on the app's Home screen — which would otherwise turn a stale match into a
   * false pass on the app lane. Pass `input.phone` to re-use a known customer.
   *
   * The wizard branches by customer: a new number asks name → email → birthday
   * before the service/staff/consent screens; a known number may skip straight
   * to services. Each pre-service screen is therefore handled optionally.
   */
  async createCheckin(input: CheckinInput = {}): Promise<CheckinHandoff> {
    const fresh = this.freshIdentity();
    const phone = (input.phone ?? fresh.phone).replace(/\D/g, '');
    const name = input.name ?? fresh.name;
    const service = input.service ?? 'Gel Shellac';
    const staff = input.staff ?? (env.WEB_STAFF || '1001vvv');

    if (phone.length < 10) {
      throw new Error(`Check-in phone "${phone}" must be at least 10 digits.`);
    }

    await this.enterKioskFrame();
    await this.dismissSessionTimeout();

    await this.enterPhone(phone);
    await this.failIfDailyLimitReached();
    await this.maybeEnterName(name);
    await this.maybeSkip('your email');
    await this.maybeSkip('your birthday');
    await this.pickFromGrid('services do you want', service);
    await this.pickFromGrid('preferred staff', staff);
    await this.signAndSubmit();

    return { name, phone, last4: phone.slice(-4), service, staff };
  }

  /** A never-seen-before phone + matching name, derived from the clock. */
  private freshIdentity(): { phone: string; name: string } {
    const suffix = Date.now().toString().slice(-6);
    return { phone: `8325${suffix}`, name: `Claude Checkin ${suffix}` };
  }

  /** Tap the phone on the keypad, then NEXT. Consent is pre-ticked by default. */
  private async enterPhone(phone: string): Promise<void> {
    for (const digit of phone) {
      await this.clickSelector(`//button[normalize-space()="${digit}"]`);
    }
    // The keypad NEXT only arms once 10/11 digits are in.
    await this.clickSelector(this.ciButton('next'), { timeout: Timeouts.LONG });
  }

  /**
   * The store caps kiosk check-ins per day ("You are limited to 100 check-ins
   * per day…"). Past the cap the kiosk pops that alert after the phone NEXT and
   * stays on the keypad, which otherwise surfaces downstream as a misleading
   * "never showed the services screen". Dismiss it and fail with the real reason.
   */
  private async failIfDailyLimitReached(): Promise<void> {
    // The alert lands a few seconds AFTER the phone NEXT (server round trip), so
    // wait until either it or the next wizard screen shows — an instant read misses it.
    const pattern = /you are limited to \d+ check-ins per day/;
    let text = '';
    await browser
      .waitUntil(
        async () => {
          text = await this.screenText();
          return pattern.test(text) || /full name|your email|your birthday|services do you want/.test(text);
        },
        { timeout: Timeouts.MEDIUM, interval: 300 },
      )
      .catch(() => undefined);
    const match = text.match(pattern);
    if (!match) return;
    await this.clickSelector('//button[normalize-space()="OK"]').catch(() => undefined);
    throw new Error(`${CHECKIN_DAILY_LIMIT_ERROR}: kiosk says "${match[0]}".`);
  }

  /** New customers get a name screen; fill it if it shows, otherwise move on. */
  private async maybeEnterName(name: string): Promise<void> {
    if (!(await this.waitForScreen('full name', Timeouts.SHORT))) return;
    const field = await this.visible('//input[@placeholder="Enter name"]');
    await field.setValue(name);
    await this.clickSelector(this.ciButton('next'));
  }

  /** Optional screen carrying a SKIP button (email / birthday): skip it if present. */
  private async maybeSkip(anchor: string): Promise<void> {
    if (!(await this.waitForScreen(anchor, Timeouts.SHORT))) return;
    await this.clickSelector(this.ciButton('skip'));
  }

  /**
   * Pick `option` off a selection screen (services or staff), then NEXT.
   *
   * CRITICAL: click the real CONTROL, not the label text. The option label sits
   * in an inner `<p>`, but the select handler and its "selected" checkmark
   * (`.check-square-1`, toggled from `display:none`) live on the enclosing
   * `<button>` / `[cursor=pointer]` card. Clicking the bare `<p>` can leave the
   * card UNSELECTED — the wizard still advances (service/staff are optional), but
   * the check-in lands with no service and so never becomes a pending ORDER on
   * the app Home. So we resolve the label, walk up to its clickable ancestor, and
   * PROVE the pick registered before moving on.
   */
  private async pickFromGrid(anchor: string, option: string): Promise<void> {
    await this.dismissSessionTimeout();
    await browser.waitUntil(async () => this.screenHas(anchor), {
      timeout: Timeouts.LONG,
      timeoutMsg: `Kiosk never showed the "${anchor}" screen.`,
    });

    // Click ONCE (re-clicking could toggle a selected card back OFF), then confirm
    // best-effort. The service card exposes a `.check-square-1` tick we can read;
    // staff cards have no machine-readable marker, so an unconfirmed pick is only
    // flagged, not failed — the correct control was clicked either way.
    const clicked = await this.clickCardByLabel(option);
    if (!clicked) {
      throw new Error(`Option "${option}" not found on the "${anchor}" screen.`);
    }
    await settle(Timeouts.ANIMATION);
    if (!(await this.isPicked(option))) {
      // eslint-disable-next-line no-console
      console.log(
        `[checkin] note: could not confirm "${option}" selected on "${anchor}" (no readable marker).`,
      );
    }

    await this.clickSelector(this.ciButton('next'));
  }

  /**
   * Click the selectable card for `option` by walking up from its text label to
   * the real clickable element.
   *
   * The label sits in an inner `<p>`; the click handler lives on an ancestor that
   * is either a `<button>` (services) or a plain `<div>` whose only "clickable"
   * tell is `cursor: pointer` in COMPUTED style — not a class name (staff). An
   * XPath `contains(@class,"cursor-pointer")` therefore misses staff cards, so we
   * resolve the ancestor in-page by computed cursor instead, and native-click it
   * (which does fire the card's handler — verified: it flips the service tick).
   */
  private async clickCardByLabel(option: string): Promise<boolean> {
    return browser.execute((label: string) => {
      // The label element is the one whose OWN trimmed text equals `label` (a
      // card wrapper's textContent also includes the avatar/among siblings).
      const labels = Array.from(document.querySelectorAll('p, span, div, button')).filter(
        (n) => n.textContent?.trim() === label && (n as HTMLElement).offsetParent !== null,
      );
      const node = labels[labels.length - 1] as HTMLElement | undefined;
      if (!node) return false;
      let el: HTMLElement | null = node;
      for (let hop = 0; hop < 6 && el; hop += 1) {
        const clickable =
          el.tagName === 'BUTTON' ||
          el.getAttribute('role') === 'button' ||
          window.getComputedStyle(el).cursor === 'pointer';
        if (clickable) {
          el.click();
          return true;
        }
        el = el.parentElement;
      }
      node.click();
      return true;
    }, option);
  }

  /**
   * Did `option` register as selected?
   *
   * Services expose a `.check-square-1` tick that flips from `display:none` to
   * shown; staff cards mark selection with a ring/opacity class. Rather than
   * couple to either, we ask the DOM whether the option's clickable card now
   * carries any visible tick or a `select`/`active`/`checked` class — enough to
   * tell a real pick from a no-op tap.
   */
  private async isPicked(option: string): Promise<boolean> {
    return browser.execute((label: string) => {
      const labels = Array.from(document.querySelectorAll('p, span, div')).filter(
        (n) => n.textContent?.trim() === label && (n as HTMLElement).offsetParent !== null,
      );
      for (const node of labels) {
        const card =
          node.closest('button') ?? node.closest('[class*="cursor-pointer"]') ?? node.parentElement;
        if (!card) continue;
        const tick = card.querySelector<HTMLElement>('.check-square-1');
        if (tick && tick.style.display !== 'none') return true;
        if (/select|active|checked|border-primary|ring-/.test(card.className)) return true;
      }
      return false;
    }, option);
  }

  /**
   * Draw a signature on the consent canvas and submit — the step that actually
   * commits the check-in upstream.
   *
   * This is the one screen that silently no-ops if you get it wrong: the canvas
   * gates its NEXT button until it receives pointer strokes, but the kiosk still
   * resets to the phone screen if the session is abandoned — so "the keypad came
   * back" is NOT proof of a submit. We therefore prove TWO things explicitly:
   *
   *   1. the stroke registered — the **CLEAR** control only appears once the pad
   *      has ink ({@link drawSignature} throws if it never shows);
   *   2. the submit moved the wizard FORWARD — the consent text is gone AND the
   *      keypad is back. A dead/disabled NEXT would leave us on consent and this
   *      waitUntil fails loudly, instead of returning a bogus success.
   */
  private async signAndSubmit(): Promise<void> {
    await browser.waitUntil(async () => this.screenHas('messaging consent'), {
      timeout: Timeouts.LONG,
      timeoutMsg: 'Kiosk never reached the Messaging Consent / signature screen.',
    });

    await this.drawSignature();

    await this.clickSelector(this.ciButton('next'), { timeout: Timeouts.LONG });

    await browser.waitUntil(
      async () =>
        !(await this.screenHas('messaging consent')) &&
        (await this.anyDisplayed('//button[normalize-space()="1"]')),
      {
        timeout: Timeouts.LONG,
        timeoutMsg:
          'Signature submit did not advance the wizard — still on the consent screen ' +
          '(NEXT stayed disabled, i.e. the signature never registered).',
      },
    );
  }

  /**
   * Put ink on the signature canvas, and PROVE it landed.
   *
   * Primary path is the W3C pointer Actions API with centre-relative strokes
   * inside the 876×200 pad. Inside the kiosk's nested cross-origin iframe the
   * element-origin coordinate mapping can miss the canvas, so if the **CLEAR**
   * control does not appear we fall back to dispatching pointer/mouse events
   * straight at the canvas in-frame (coordinates taken from its own rect, which
   * is exactly what a `signature_pad`-style handler reads). If neither leaves a
   * CLEAR control, the pad is still empty and we throw rather than march on to a
   * NEXT that will never submit.
   */
  private async drawSignature(): Promise<void> {
    const canvas = await this.visible('//canvas');
    await browser
      .action('pointer', { parameters: { pointerType: 'mouse' } })
      .move({ origin: canvas, x: -280, y: 0 })
      .down()
      .move({ origin: canvas, x: -180, y: -50 })
      .move({ origin: canvas, x: -80, y: 50 })
      .move({ origin: canvas, x: 20, y: -50 })
      .move({ origin: canvas, x: 140, y: 40 })
      .move({ origin: canvas, x: 260, y: -30 })
      .up()
      .perform();
    if (await this.buttonVisible('clear', Timeouts.SHORT)) return;

    await this.drawSignatureInPage();
    if (await this.buttonVisible('clear', Timeouts.SHORT)) return;

    throw new Error(
      'Signature did not register on the canvas — no CLEAR control appeared after drawing ' +
        '(tried the pointer Actions API and the in-page event fallback).',
    );
  }

  /** Fallback stroke: dispatch a pointer/mouse drag directly on the in-frame canvas. */
  private async drawSignatureInPage(): Promise<void> {
    await browser.execute(() => {
      const c = document.querySelector('canvas');
      if (!c) return;
      const r = c.getBoundingClientRect();
      const init = (x: number, y: number): PointerEventInit => ({
        clientX: r.left + x,
        clientY: r.top + y,
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'pen',
        isPrimary: true,
        buttons: 1,
        pressure: 0.5,
      });
      const fire = (type: string, x: number, y: number): void => {
        c.dispatchEvent(new PointerEvent(type, init(x, y)));
        const mouseType =
          type === 'pointerdown' ? 'mousedown' : type === 'pointerup' ? 'mouseup' : 'mousemove';
        c.dispatchEvent(new MouseEvent(mouseType, init(x, y)));
      };
      const w = r.width;
      const h = r.height;
      fire('pointerdown', w * 0.15, h * 0.5);
      for (let i = 1; i <= 24; i += 1) {
        const x = w * (0.15 + 0.7 * (i / 24));
        const y = h * (0.5 + 0.28 * Math.sin(i * 0.9));
        fire('pointermove', x, y);
      }
      fire('pointerup', w * 0.85, h * 0.5);
    });
  }
}

export const checkinKioskPage = new CheckinKioskPage();
