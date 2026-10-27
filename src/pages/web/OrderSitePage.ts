import { browser, $, $$ } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';
import { settle } from '../../helpers/wait.js';

const env = loadEnv();

/** What an appointment needs. All optional — each falls back to a known-good value. */
export interface AppointmentInput {
  /** Phone of an EXISTING customer to attach the appointment to. */
  customerPhone?: string;
  /** Exact customer name shown in the phone-search dropdown. */
  customerName?: string;
  /** Staff name exactly as the "Change Staff" picker lists it. */
  staff?: string;
  /** Service name exactly as the "Change Service" picker lists it. */
  service?: string;
}

/** The correlation key handed to the app lane to find the same appointment. */
export interface AppointmentHandoff {
  customerName: string;
  customerPhone: string;
  staff: string;
  service: string;
  /** ISO-ish timestamp of creation, stamped by the spec (not this page). */
  createdAtLabel?: string;
}

/**
 * GoPOS web POS — `pos.gocheckin.net`.
 *
 * ## Why this is not a {@link BasePage}
 *
 * `BasePage`/`UiObject` resolve elements by the app's `data-testid`s. This site
 * ships none — its DOM is a tree of anonymous `div`s — so every control here is
 * reached by visible text, placeholder or ARIA role instead. Mixing that into
 * the testid-based hierarchy would only lie about what is available, so the web
 * POM stands alone.
 *
 * ## The two picker shape
 *
 * Staff and Service are not `<select>`s: clicking the field opens a full-screen
 * modal ("Change Staff" / "Change Service") with its OWN search box. Typing the
 * target into that search box collapses the list to one card, which sidesteps
 * the duplicate-text trap — the same staff name also appears in the calendar
 * grid behind the modal, and a bare text click would hit whichever came first
 * in the DOM.
 */
export class OrderSitePage {
  readonly name = 'GoPOS Web';

  /* --------------------------------------------------------------------- *
   * Primitives
   * --------------------------------------------------------------------- */

  /**
   * First (or last) DISPLAYED element matching `selector`.
   *
   * This site renders many hidden duplicates of each dialog in the DOM, so a
   * plain `$()` routinely returns a hidden copy and every wait then times out.
   * Scanning `$$()` for a visible one is the only reliable resolution here.
   *
   * `pick: 'last'` is for options that also appear behind the current modal — a
   * staff name is both a calendar column header and a card in the "Change Staff"
   * portal; the portal mounts later in the DOM, so the last visible match is it.
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

  /**
   * Click, falling back to a DOM click when the native click is intercepted.
   *
   * The dialog's option cards (`customer_info_name`, staff/service cards) carry
   * their onClick on a wrapper, while the visible text sits in an inner `<p>`
   * whose centre point is covered by a sibling overlay — WebDriver then refuses
   * the click as "not clickable at point". A `node.click()` dispatched in-page
   * bypasses the hit-test and still fires the handler.
   */
  private async clickEl(el: WebdriverIO.Element): Promise<void> {
    try {
      await el.click();
    } catch (error) {
      if (!/intercepted|not clickable/i.test(String(error))) throw error;
      await browser.execute((node: HTMLElement) => node.click(), el);
    }
  }

  /** Is any element matching `selector` currently DISPLAYED? */
  private async anyDisplayed(selector: string): Promise<boolean> {
    const els = await $$(selector).getElements();
    for (const el of els) {
      if (await el.isDisplayed().catch(() => false)) return true;
    }
    return false;
  }

  /** Wait until no element matching `selector` is DISPLAYED (hidden duplicates are ignored). */
  private async waitGone(selector: string, label: string, timeout: number = Timeouts.MEDIUM): Promise<void> {
    await browser.waitUntil(
      async () => {
        const els = await $$(selector).getElements();
        for (const el of els) {
          if (await el.isDisplayed().catch(() => false)) return false;
        }
        return true;
      },
      { timeout, timeoutMsg: `${label} is still visible.` },
    );
  }

  /**
   * Resolve `selector` and click it, re-resolving if the element goes stale.
   *
   * Dropdown and modal lists re-render while results stream in, so an element
   * resolved one tick can detach the next ("element wasn't found" on click).
   * Re-finding and retrying rides over that.
   */
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

  /** Click a `<button>` by its exact visible text (text may live in a child <p>). */
  private async clickButton(text: string, timeout: number = Timeouts.MEDIUM): Promise<void> {
    await this.clickSelector(`//button[normalize-space(.)="${text}"]`, { timeout });
  }

  /* --------------------------------------------------------------------- *
   * Login (two steps)
   * --------------------------------------------------------------------- */

  /**
   * Sign in: merchant ID → Log In → username + password → Log In.
   *
   * Credentials come from `.env.dev` (`WEB_MERCHANT_ID` / `WEB_USERNAME` /
   * `WEB_PASSWORD`), never hard-coded here.
   */
  async login(): Promise<void> {
    if (!env.WEB_USERNAME || !env.WEB_PASSWORD) {
      throw new Error(
        'WEB_USERNAME/WEB_PASSWORD are empty. Fill them in configs/env/.env.dev before running the web lane.',
      );
    }

    await browser.url(env.WEB_URL);

    // Step 1 — merchant ID.
    const idInput = await this.visible('input[placeholder="ID"]');
    await idInput.setValue(env.WEB_MERCHANT_ID);
    await this.clickButton('Log In');

    // Step 2 — the confirm screen ("Welcome <merchant>").
    await browser.waitUntil(async () => (await browser.getUrl()).includes('/login/confirm'), {
      timeout: Timeouts.NAVIGATION,
      timeoutMsg: 'Did not reach /login/confirm after merchant ID.',
    });
    const userInput = await this.visible('input[placeholder="Username"]');
    await userInput.setValue(env.WEB_USERNAME);
    const passInput = await this.visible('input[placeholder="Password"]');
    await passInput.setValue(env.WEB_PASSWORD);
    await this.clickButton('Log In');

    // Landing is the calendar at the site root; the URL drops `/login`.
    await browser.waitUntil(async () => !(await browser.getUrl()).includes('/login'), {
      timeout: Timeouts.NAVIGATION,
      timeoutMsg: 'Login did not land on the calendar (still on a /login route).',
    });
    await this.dismissPosVersionDialog();
    // The "New Appointment" button proves the calendar finished mounting.
    await this.visible('//button[contains(normalize-space(.), "New Appointment")]', {
      timeout: Timeouts.LONG,
    });
  }

  /** Some sessions pop a "Choose POS version" dialog on first load. Confirm it if present. */
  private async dismissPosVersionDialog(): Promise<void> {
    const confirm = $('//button[normalize-space(.)="Confirm"]');
    if (await confirm.isDisplayed().catch(() => false)) {
      await confirm.click();
    }
  }

  /* --------------------------------------------------------------------- *
   * Create appointment
   * --------------------------------------------------------------------- */

  /**
   * Create one appointment and return its correlation key.
   *
   * The customer / staff / service default to the `WEB_*` values in `.env.dev`
   * (the customer fields are real PII, so they are never hard-coded here). Date,
   * start time and duration keep the form defaults.
   */
  async createAppointment(input: AppointmentInput = {}): Promise<AppointmentHandoff> {
    const customerPhone = input.customerPhone ?? env.WEB_CUSTOMER_PHONE;
    const customerName = input.customerName ?? env.WEB_CUSTOMER_NAME;
    const staff = input.staff ?? env.WEB_STAFF;
    const service = input.service ?? env.WEB_SERVICE;

    const missing = Object.entries({ customerPhone, customerName, staff, service })
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length > 0) {
      throw new Error(
        `Missing appointment inputs: ${missing.join(', ')}. ` +
          'Set WEB_CUSTOMER_PHONE / WEB_CUSTOMER_NAME / WEB_STAFF / WEB_SERVICE in configs/env/.env.dev, ' +
          'or pass them to createAppointment().',
      );
    }

    await this.clickButton('New Appointment');

    // The live appointment dialog mounts under #home-left-scroll; scope to it so
    // the many hidden duplicate forms elsewhere in the DOM are never matched.
    const DIALOG = '//*[@id="home-left-scroll"]';

    await this.selectCustomer(DIALOG, customerPhone, customerName);

    // Staff and Service each open a modal with its own search box.
    await this.pickFromModal('Staff', 'Search staff', staff);
    await this.pickFromModal('Service', 'Search service', service);

    await this.clickButton('Save Appointment');

    // Success: the appointment dialog closes, so its Save button stops being
    // displayed (hidden template copies elsewhere are ignored by waitGone).
    await this.waitGone(
      '//*[@id="home-left-scroll"]//button[normalize-space(.)="Save Appointment"]',
      'Appointment dialog',
      Timeouts.LONG,
    );

    return { customerName, customerPhone, staff, service };
  }

  /**
   * Attach an existing customer by phone, and PROVE the attachment took.
   *
   * The trap: `#home-left-scroll` wraps BOTH the dialog and the calendar behind
   * it, and every appointment this flow has ever booked leaves a card there
   * carrying the customer's name. A bare "match the name" click therefore lands
   * on a calendar card, not the phone suggestion, and no customer is attached —
   * Save then silently no-ops and the dialog hangs.
   *
   * So the suggestion is addressed precisely: the `<li>` inside the phone box's
   * own dropdown (`ul.overflow-auto`), which no calendar card lives in. Success
   * is confirmed by that dropdown closing; otherwise the attempt retries.
   */
  private async selectCustomer(dialog: string, phone: string, name: string): Promise<void> {
    // The phone suggestions are <li class="...cursor-pointer">; calendar cards
    // carrying the same name are <div>s, so keying on the <li> tag alone avoids
    // them without having to reason about DOM order or which container wraps what.
    const optionSel = `//li[contains(@class,"cursor-pointer") and contains(normalize-space(.),"${name}")]`;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const phoneInput = await this.visible(`${dialog}//input[@placeholder="Search for Customer Phone"]`);
      await this.typePhone(phoneInput, phone);
      // Let the suggestion list finish streaming before resolving the option,
      // so the <li> is stable when clicked.
      await settle(Timeouts.DEBOUNCE);

      await this.clickSelector(optionSel, { timeout: Timeouts.LONG });
      await settle(Timeouts.DEBOUNCE);

      // Choosing a suggestion closes the dropdown — the <li> is gone. That is
      // the signal the pick actually attached a customer.
      if (!(await this.anyDisplayed(optionSel))) return;
    }

    throw new Error(`Customer "${name}" (${phone}) did not attach after 3 attempts.`);
  }

  /**
   * Type a phone into the masked search box and PROVE all its digits landed.
   *
   * The field reformats on input (`(xxx) xxx-xxxx`), and a bulk `setValue`
   * routinely drops digits — the form then shows "Phone number must be 10 or 11
   * digits" and the suggestions never narrow to the customer. Typing one digit
   * at a time, then reading the value back and retyping if short, is what makes
   * it reliable.
   */
  private async typePhone(input: WebdriverIO.Element, phone: string): Promise<void> {
    const digitsOf = (s: string): string => s.replace(/\D/g, '');

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await input.click();
      await input.clearValue();
      for (const ch of phone) {
        await input.addValue(ch);
      }
      await settle(Timeouts.ANIMATION);
      if (digitsOf((await input.getValue().catch(() => '')) || '').length >= phone.length) return;
    }

    throw new Error(`Could not enter the full phone "${phone}" — the mask kept dropping digits.`);
  }

  /**
   * Open the picker next to `fieldLabel`, filter by `optionText` in its search
   * box, and click the result.
   */
  private async pickFromModal(
    fieldLabel: string,
    searchPlaceholder: string,
    optionText: string,
  ): Promise<void> {
    // Open the picker by clicking the COMBOBOX — the sibling right after the
    // field's label <p>. Clicking the whole listitem sometimes misses the
    // control and the modal never opens.
    const field = await this.visible(
      `//*[@id="home-left-scroll"]//p[normalize-space()="${fieldLabel}"]/following-sibling::*[1]`,
    );
    await this.clickEl(field);

    const search = await this.visible(`//input[@placeholder="${searchPlaceholder}"]`, {
      timeout: Timeouts.LONG,
    });
    await search.setValue(optionText);
    await settle(Timeouts.DEBOUNCE);

    // Filtered list collapses to the target card. The same text can sit in the
    // calendar behind the modal, so take the LAST visible match — the picker
    // portal mounts later in the DOM.
    await this.clickSelector(`//*[normalize-space(text())="${optionText}"]`, {
      timeout: Timeouts.LONG,
      pick: 'last',
    });

    // The modal closes once a card is chosen. Detect close by the search box no
    // longer being DISPLAYED — hidden duplicate modals keep "existing" forever,
    // so an existence check would never resolve.
    await this.waitGone(`//input[@placeholder="${searchPlaceholder}"]`, `${fieldLabel} picker`);
  }
}

export const orderSitePage = new OrderSitePage();
