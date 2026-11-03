import { browser, $, $$ } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';
import { toHex } from '../../utils/color.js';

const env = loadEnv();

const SERVICES_PATH = (merchantId: string): string => `/pos/nail/${merchantId}/services`;
const STAFFS_PATH = (merchantId: string): string => `/pos/nail/${merchantId}/staffs`;

/**
 * The Portal's data API — `https://volt-pos.<portal host>`; the Portal scopes every
 * call to a merchant with the `X-Merch-Id` header (an admin session sees all merchants
 * without it). Read-only use here: TC-07 / TC-20 need `colorHex`, which the list
 * renders only as a colour dot (a colourless category and a Peach one look the same).
 */
const API_BASE = env.PORTAL_URL.replace('://', '://volt-pos.');

/* Selectors — the Portal ships no data-testid; reached by ARIA role / label / data-slot. */
const ADD_CATEGORY = 'button[aria-label="Add category"]';
const ADD_STAFF = '//button[normalize-space(.)="Add staff"]';
const OPEN_DIALOG = '[role="dialog"][data-state="open"]';
const DIALOG_TITLE = `${OPEN_DIALOG} [data-slot="dialog-title"]`;
const SWATCH = '[data-slot="pos-color-swatch"]';
const NAME_INPUT = `${OPEN_DIALOG} input[name="name"]`;
const ACTIVE_SWITCH = `${OPEN_DIALOG} button[role="switch"]#isActive`;
const SUBMIT = `${OPEN_DIALOG} button[type="submit"]`;
const CANCEL = `//*[@role="dialog"][@data-state="open"]//button[normalize-space(.)="Cancel"]`;
const STATUS_FILTER = (label: 'Active' | 'Inactive'): string => `//button[normalize-space(.)="${label}"]`;
/** The category row button: a colour dot `<span>` followed by the name `<span>`. */
const CATEGORY_ROW = (name: string): string =>
  `//button[@data-slot="pos-button"][./span[normalize-space(.)=${xpathLiteral(name)}]]`;
const ROW_ACTIONS = (name: string): string => `button[aria-label=${JSON.stringify(`Actions for ${name}`)}]`;
const MENU_EDIT = '//*[@role="menuitem"][normalize-space(.)="Edit"]';

function xpathLiteral(text: string): string {
  if (!text.includes('"')) return `"${text}"`;
  if (!text.includes("'")) return `'${text}'`;
  return `concat("${text.split('"').join(`", '"', "`)}")`;
}

export interface Swatch {
  /** The Portal's own colour name (`aria-label`) — differs from POS for some (Aqua ↔ Mint…). */
  name: string;
  /** `--pos-swatch`, normalised to `#RRGGBB`. */
  hex: string;
  checked: boolean;
}

export interface CategoryRow {
  name: string;
  /** The rendered dot colour, `#RRGGBB`. */
  dotHex: string;
}

export interface ApiCategory {
  id: string;
  name: string;
  status: string;
  /** As stored (mixed case or `null`). */
  colorHex: string | null;
  type: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fastboy Portal — Management → Services (category list + New / Edit category dialogs)
 * and the New staff dialog's colour picker (VP-5338).
 *
 * Same signing-in contract as {@link PortalSettingsPage}: Edge on `.portal-profile/`,
 * a /login redirect throws instead of waiting. Like that page, no `data-testid`s
 * exist — controls are reached by ARIA role / label and `data-slot`.
 */
export class PortalServicesPage {
  readonly name = 'Fastboy Portal services';

  get url(): string {
    return `${env.PORTAL_URL}${SERVICES_PATH(env.PORTAL_MERCHANT_ID)}`;
  }

  /** Navigate and wait for `anchor`; a /login redirect throws (session expired). */
  private async go(url: string, anchor: string): Promise<void> {
    await browser.url(url);
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/login') || (await $(anchor).isDisplayed()),
      {
        timeout: Timeouts.LONG,
        timeoutMsg: `${this.name}: neither /login nor ${anchor} rendered at ${url}.`,
      },
    );
    if ((await browser.getUrl()).includes('/login')) {
      throw new Error(
        `${this.name}: the Portal session in .portal-profile/ is missing or expired (redirected to /login). ` +
          'Run `npm run portal:login` and sign in, then re-run.',
      );
    }
  }

  async open(): Promise<this> {
    await this.go(this.url, ADD_CATEGORY);
    return this;
  }

  /** Switch the category list between Active and Inactive. */
  async showStatus(status: 'Active' | 'Inactive'): Promise<this> {
    const before = (await this.categoryRows()).map((r) => r.name).join('|');
    await $(STATUS_FILTER(status)).click();
    await browser.waitUntil(async () => (await this.categoryRows()).map((r) => r.name).join('|') !== before, {
      timeout: Timeouts.MEDIUM,
      timeoutMsg: `${this.name}: the category list did not change after picking "${status}".`,
    });
    return this;
  }

  /** Every category row currently listed, with its dot colour. */
  async categoryRows(): Promise<CategoryRow[]> {
    await $('[data-slot="pos-button"] > span.rounded-full').waitForExist({ timeout: Timeouts.LONG });
    const rows = await browser.execute(() =>
      Array.from(document.querySelectorAll('button[data-slot="pos-button"]'))
        .map((b) => {
          const spans = Array.from(b.children).filter((c) => c.tagName === 'SPAN') as HTMLElement[];
          const dot = spans.find((s) => s.classList.contains('rounded-full'));
          const label = spans.find((s) => s !== dot);
          return dot && label
            ? { name: (label.textContent ?? '').trim(), dot: getComputedStyle(dot).backgroundColor }
            : null;
        })
        .filter((r): r is { name: string; dot: string } => r !== null),
    );
    return rows.map((r) => ({ name: r.name, dotHex: toHex(r.dot) }));
  }

  /** The row for `name`, waiting for it to appear (e.g. right after Create). */
  async categoryRow(name: string): Promise<CategoryRow> {
    let found: CategoryRow | undefined;
    await browser.waitUntil(
      async () => {
        found = (await this.categoryRows()).find((r) => r.name === name);
        return found !== undefined;
      },
      { timeout: Timeouts.LONG, timeoutMsg: `${this.name}: category "${name}" is not listed.` },
    );
    return found as CategoryRow;
  }

  /* ---------------------------------------------------------------- dialogs */

  async dialogTitle(): Promise<string> {
    return (await $(DIALOG_TITLE).getText()).trim();
  }

  /** The colour swatches of the open dialog, in render order. */
  async swatches(): Promise<Swatch[]> {
    await $(`${OPEN_DIALOG} ${SWATCH}`).waitForDisplayed({ timeout: Timeouts.MEDIUM });
    const raw = await browser.execute(
      (dialog: string, swatch: string) =>
        Array.from(document.querySelectorAll(`${dialog} ${swatch}`)).map((b) => ({
          name: b.getAttribute('aria-label') ?? '',
          color: (b as HTMLElement).style.getPropertyValue('--pos-swatch').trim(),
          checked: b.getAttribute('aria-checked') === 'true',
        })),
      OPEN_DIALOG,
      SWATCH,
    );
    return raw.map((s) => ({ name: s.name, hex: toHex(s.color), checked: s.checked }));
  }

  /** Click the swatch whose colour is `hex` and wait for it to read checked. */
  async pickColor(hex: string): Promise<void> {
    const want = toHex(hex);
    const index = (await this.swatches()).findIndex((s) => s.hex === want);
    if (index < 0) throw new Error(`${this.name}: no ${want} swatch in the open dialog.`);
    const swatch = $$(`${OPEN_DIALOG} ${SWATCH}`)[index];
    if (!swatch) throw new Error(`${this.name}: swatch #${String(index)} vanished.`);
    await swatch.click();
    await browser.waitUntil(async () => (await this.swatches())[index]?.checked === true, {
      timeout: Timeouts.SHORT,
      timeoutMsg: `${this.name}: the ${want} swatch did not become checked.`,
    });
  }

  async openNewCategory(): Promise<void> {
    await $(ADD_CATEGORY).click();
    await $(NAME_INPUT).waitForDisplayed({ timeout: Timeouts.MEDIUM });
  }

  async openEditCategory(name: string): Promise<void> {
    const row = $(CATEGORY_ROW(name));
    await row.waitForExist({
      timeout: Timeouts.LONG,
      timeoutMsg: `${this.name}: category "${name}" is not listed.`,
    });
    await row.scrollIntoView({ block: 'center' });
    await row.moveTo(); // the ⋯ actions button is width-0 until the row is hovered
    const actions = $(ROW_ACTIONS(name));
    await actions.waitForClickable({ timeout: Timeouts.SHORT });
    await actions.click();
    const edit = $(MENU_EDIT);
    await edit.waitForDisplayed({ timeout: Timeouts.SHORT });
    await edit.click();
    await $(NAME_INPUT).waitForDisplayed({ timeout: Timeouts.MEDIUM });
  }

  async setName(name: string): Promise<void> {
    await $(NAME_INPUT).setValue(name);
  }

  /** Set the dialog's Active switch (cleanup only — the Portal has no category Delete). */
  async setActive(on: boolean): Promise<void> {
    const toggle = $(ACTIVE_SWITCH);
    if ((await toggle.getAttribute('aria-checked')) === String(on)) return;
    await toggle.click();
  }

  /**
   * Submit ("Create category" / "Save changes") and wait for the dialog to close.
   *
   * The name field runs a debounced, async uniqueness check (`GET /categories?name[]=…`);
   * a click that lands while it is pending is dropped silently — no request, no message
   * (seen 03/11 on dev). So the click is repeated while the dialog stays open and no
   * field reports itself invalid; a duplicate is impossible because the check runs first.
   */
  async submit(): Promise<void> {
    const closed = async (): Promise<boolean> => !(await $(OPEN_DIALOG).isExisting());
    for (let attempt = 1; attempt <= 3; attempt++) {
      await $(SUBMIT).click();
      const done = await browser
        .waitUntil(closed, { timeout: Timeouts.SHORT, interval: 250 })
        .catch(() => false);
      if (done) return;
      if (await $(`${OPEN_DIALOG} [data-invalid="true"]`).isExisting()) {
        const message = await $(OPEN_DIALOG).getText();
        throw new Error(`${this.name}: the dialog rejected the form —\n${message}`);
      }
    }
    await browser.waitUntil(closed, {
      timeout: Timeouts.LONG,
      timeoutMsg: `${this.name}: the dialog did not close after submit.`,
    });
  }

  /** Close the open dialog without saving (Cancel, Escape as fallback). No-op when none is open. */
  async cancel(): Promise<void> {
    if (!(await $(OPEN_DIALOG).isExisting())) return;
    const cancel = $(CANCEL);
    if (await cancel.isDisplayed().catch(() => false)) await cancel.click();
    else await browser.keys('Escape');
    await $(OPEN_DIALOG).waitForExist({ reverse: true, timeout: Timeouts.MEDIUM });
  }

  /** Staff Members → Add staff; leaves the New staff dialog open (call {@link cancel}). */
  async openNewStaff(): Promise<void> {
    await this.go(`${env.PORTAL_URL}${STAFFS_PATH(env.PORTAL_MERCHANT_ID)}`, ADD_STAFF);
    await $(ADD_STAFF).click();
    await $(`${OPEN_DIALOG} ${SWATCH}`).waitForDisplayed({ timeout: Timeouts.MEDIUM });
  }

  /* -------------------------------------------------------------------- API */

  /** Every category of the merchant (both statuses), as the Portal's API stores it. */
  async apiCategories(): Promise<ApiCategory[]> {
    const result = await browser.execute(
      async (base: string, merchantId: string) => {
        const out: unknown[] = [];
        for (const status of ['active', 'inactive']) {
          let seen = 0;
          for (let page = 1; page <= 50; page++) {
            const res = await fetch(
              `${base}/categories?status[]=${status}&type[]=service&type[]=product&page=${String(page)}`,
              {
                credentials: 'include',
                headers: { accept: 'application/ld+json', 'X-Merch-Id': merchantId },
              },
            );
            if (!res.ok) return `HTTP ${String(res.status)} on ${res.url}`;
            const body = (await res.json()) as { member?: unknown[]; totalItems?: number };
            const members = body.member ?? [];
            out.push(...members);
            seen += members.length;
            if (members.length === 0 || seen >= (body.totalItems ?? 0)) break;
          }
        }
        return out;
      },
      API_BASE,
      env.PORTAL_MERCHANT_ID,
    );
    if (typeof result === 'string') throw new Error(`${this.name}: category API failed — ${result}`);
    return result as ApiCategory[];
  }
}

export const portalServicesPage = new PortalServicesPage();
