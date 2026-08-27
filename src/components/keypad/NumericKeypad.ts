import { Timeouts } from '../../../configs/constants/timeouts.js';
import { byTestId, locator } from '../../helpers/selectors.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle } from '../../helpers/wait.js';
import { BaseComponent } from '../BaseComponent.js';

/**
 * Driver for the app's on-screen numeric keypads.
 *
 * ## Why a keypad component exists at all
 *
 * On the money screens there is no input to type into. The checkout amount is a
 * `div.text-8xl` and the adjust-tip amount a `div.text-7xl` — plain text nodes
 * rendered from React state that only `Keypad`'s `onInput` ever writes to. A
 * WebDriver `setValue` has nothing to attach to, and even where an input does
 * exist (the customer phone field) driving it directly skips
 * `applyKeypadKey()`'s clamping and normalisation. Pressing the keys is the only
 * path a real cashier has, so it is the only path the suite takes.
 *
 * ## What the keys are worth
 *
 * `src/components/keypad.tsx` renders `{key.label ?? key.value}`, so a digit key's
 * own digit IS its text — the one text selector in this app that survives i18next,
 * because digits and `$50` read the same in English and Vietnamese. Backspace is
 * the exception: it labels itself with an `<Icon>`, which `src/components/icon.tsx`
 * inlines as an anonymous `<span>`, leaving the button with no text, no aria-label
 * and no icon name in the DOM.
 *
 * ## Presses, not clicks
 *
 * `Keypad` binds `onMouseDown` and calls `preventDefault()` in `onClick`. A
 * WebDriver `click()` is a real pointer sequence (mousedown → mouseup → click) so
 * the handler fires; a JS-dispatched `element.click()` via `browser.execute` would
 * NOT — do not "optimise" the presses below into script clicks. For the same
 * reason a press must stay short: holding backspace for 300ms starts a 150ms
 * auto-repeat (`handlePress`), which is how a two-digit entry quietly becomes an
 * empty one.
 *
 * ## Values are CENTS
 *
 * `appendCashDigit` / `appendTipDigit` (`@/shared/checkout/*`) append to a cents
 * string, so `type('2500')` enters $25.00 and the presets are `'500'` … `'20000'`.
 */

/**
 * The keypads this class can drive, by the testid prefix each one uses.
 *
 * A closed set on purpose: every value here is a prefix `src/constants/testids.ts`
 * already registers in `FACTORY_TESTID_PREFIXES`, and the app has other keypads
 * (the split-order check keypad, the customer-display tip keypad) that neither
 * source has ever named. Adding one is a one-line reviewed change; guessing a
 * prefix at a call site is not.
 */
export const KEYPAD_PREFIXES = {
  /** `/order/{id}/checkout` — cash tender entry, with the $5/$10/$50/$100 presets. */
  checkout: 'checkout-keypad-',
  /** `/home` — the customer phone lookup. */
  homeCustomer: 'home-customer-keypad-',
  /** The adjust-tip dialog, with the $20/$50/$100/$200 presets. */
  adjustTip: 'adjust-tip-keypad-',
} as const;

export type KeypadPrefix = (typeof KEYPAD_PREFIXES)[keyof typeof KEYPAD_PREFIXES];

/**
 * Settle between two presses.
 *
 * Each press re-renders the whole grid through the owning screen's `setAmount`,
 * so back-to-back presses can be delivered while React is committing. The
 * lookup is redone per press, which handles a detached node, but VP-802 settled
 * 100ms between digits on real hardware and paying ~100ms a digit is cheaper
 * than one flaky money assertion.
 */
const KEY_PRESS_MS = 120;

/** Cent value → the dollar label the preset keys actually render. */
const PRESET_LABELS: Record<string, string> = {
  '500': '$5',
  '1000': '$10',
  '2000': '$20',
  '5000': '$50',
  '10000': '$100',
  '20000': '$200',
};

/** The `C` key's value in every layout that ships one. */
const CLEAR_KEY = 'C';

/**
 * The keypad's own wrapper.
 *
 * `Keypad` renders `<div class="flex size-full … flex-col gap-4">` holding one
 * `<div>` per row holding the buttons, and passes its `className` through
 * `cn()`, so `size-full`/`flex-col`/`gap-4` survive in all three call sites while
 * the `min-h-*` and `h-*` overrides do not. `:has()` is what turns that shape
 * into an anchor; WebView2 is evergreen Chromium, so it is available.
 *
 * The class-only fallback matches ANY keypad on screen and `find()` returns the
 * first in document order — which is wrong the moment a keypad dialog opens over
 * a keypad screen (the cashier tip dialog over checkout). Pass an explicit scope
 * for those, e.g. `new NumericKeypad(KEYPAD_PREFIXES.adjustTip, OrderHistoryDetailIds.adjustTipTransactionDialog)`.
 */
const containerFor = (prefix: KeypadPrefix): Locator =>
  locator(
    `${prefix} container`,
    `${prefix}container`,
    `div:has(> div > [data-testid^="${prefix}"])`,
    'div.size-full.flex-col.gap-4:has(> div > button)',
  );

export class NumericKeypad extends BaseComponent {
  readonly name: string;

  protected readonly root: Locator;

  private readonly prefix: KeypadPrefix;

  /**
   * @param prefix Which keypad to drive.
   * @param scope  Optional subtree to look inside — the dialog the keypad lives
   *               in. Supply it whenever two keypads can be mounted at once.
   */
  constructor(prefix: KeypadPrefix, scope?: Locator) {
    super();
    this.prefix = prefix;
    this.root = scope ?? containerFor(prefix);
    this.name = `${prefix}keypad`;
  }

  /**
   * Press each character of `value` in order.
   *
   * Cents on the money keypads: `type('2500')` is $25.00. Only characters that
   * are keys on the target layout can be typed — a decimal point is not one of
   * them anywhere in this app, because no keypad has that key.
   */
  async type(value: string): Promise<void> {
    this.log.debug(`type ${value}`);
    for (const char of value) {
      await this.press(char);
    }
  }

  /**
   * Press one key by its raw value — a digit, `'00'`, or a preset in cents
   * (`'500'` = $5). Presets ADD to the current entry rather than replacing it.
   */
  async press(key: string): Promise<void> {
    await this.tap(this.key(key));
  }

  /**
   * Press `C`.
   *
   * The adjust-tip keypad (`src/components/tip/custom-tip-keypad.tsx`) ships **no**
   * `C` key — its layout is the preset row, the digits, then `00`/`0`/`back` — so
   * this throws there rather than pretending to have cleared anything. Reset that
   * entry with {@link backspace} instead.
   */
  async clear(): Promise<void> {
    await this.tap(this.key(CLEAR_KEY));
  }

  /**
   * Press backspace once.
   *
   * Three spellings are declared because the app really does use three. The
   * checkout and custom-tip layouts send `back`; the shared `DEFAULT_LAYOUT`
   * behind the home customer keypad sends `Backspace` (`applyKeypadKey()` in
   * `customer-search-input.utils.ts` matches on exactly that); VP-802 annotated
   * the id as `-backspace`. Whichever one the app ships, one of these resolves.
   * There is no text or aria fallback — see the class note on the icon label — so
   * this key genuinely blocks until an id lands.
   */
  async backspace(): Promise<void> {
    await this.tap(
      locator(
        `${this.prefix}backspace key`,
        `${this.prefix}backspace`,
        byTestId(`${this.prefix}back`),
        byTestId(`${this.prefix}Backspace`),
      ),
    );
  }

  private key(value: string): Locator {
    const label = PRESET_LABELS[value] ?? value;
    return locator(
      `${this.prefix}${value} key`,
      `${this.prefix}${value}`,
      // Relative XPath: WebdriverIO routes a `./` selector through
      // `findElementFromElement`, so the text match stays inside this keypad. A
      // leading `//` is evaluated from the document even when the search is
      // scoped, and would match the same digit on another keypad or dialog.
      `.//button[normalize-space(.)="${label}"]`,
    );
  }

  private async tap(loc: Locator): Promise<void> {
    const el = await this.inside(loc, { timeout: Timeouts.SHORT, visible: true });
    await el.waitForClickable({ timeout: Timeouts.SHORT });
    this.log.debug(`press ${loc.name}`);
    await el.click();
    await settle(KEY_PRESS_MS);
  }
}
