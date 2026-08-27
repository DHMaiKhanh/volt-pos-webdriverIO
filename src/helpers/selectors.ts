/**
 * Selector construction.
 *
 * ## Why this file exists
 *
 * The app under test currently ships only ~23 `data-testid` attributes on
 * `develop` (`npm run audit:testids` prints the live count). A large annotated
 * set exists on the unmerged branch `feat/VP-802`, but until that lands most
 * screens have to be reached some other way.
 *
 * So every locator in this framework declares a PRIMARY testid plus an explicit
 * fallback, and the fallback is a deliberate, reviewed choice rather than a
 * lucky CSS path. When `audit:testids` reports the testid has landed in the
 * app, the fallback is deleted — it is scaffolding, not a permanent strategy.
 */

/** `[data-testid="value"]` — the only selector shape that survives a refactor. */
export const byTestId = (value: string): string => `[data-testid="${value}"]`;

/** Any element whose testid begins with a prefix, for repeated rows/cards. */
export const byTestIdPrefix = (prefix: string): string => `[data-testid^="${prefix}"]`;

/** Any element whose testid contains a fragment. Weakest of the testid forms. */
export const byTestIdContains = (fragment: string): string => `[data-testid*="${fragment}"]`;

/** Accessible-name match — stable across restyling, but NOT across translation. */
export const byAriaLabel = (label: string): string => `[aria-label="${label}"]`;

/** ARIA role, used for Radix primitives (`dialog`, `alertdialog`, `tab`, …). */
export const byRole = (role: string): string => `[role="${role}"]`;

/**
 * Exact visible text via XPath.
 *
 * BEWARE: the app runs i18next and the UI language is merchant state, so a text
 * selector silently stops matching when someone switches the app to Vietnamese.
 * Use it only for values (a price, a customer name), never for chrome — labels
 * belong behind a testid or an aria-label.
 */
export const byExactText = (text: string): string => `//*[normalize-space(text())="${text}"]`;

/** Substring visible text. Same i18n warning as {@link byExactText}. */
export const byPartialText = (text: string): string => `//*[contains(normalize-space(.), "${text}")]`;

/** A button carrying exactly this label. Same i18n warning. */
export const buttonWithText = (text: string): string =>
  `//button[normalize-space(.)="${text}"] | //*[@role="button"][normalize-space(.)="${text}"]`;

/* ------------------------------------------------------------------------- *
 * Bilingual text selectors
 * ------------------------------------------------------------------------- */

/**
 * Text selectors that survive the merchant switching language.
 *
 * ## Why these exist
 *
 * The single-language helpers above carry a warning, and that warning is what
 * left most of this catalogue's PENDING entries with no fallback at all: a text
 * match stops resolving the moment the UI is not in the language it was written
 * for. The app language is merchant state in the local database, not a browser
 * setting, so a spec cannot pin it the way a Playwright project pins
 * `locale: 'en-US'`.
 *
 * The warning is narrower than it looks. The app ships exactly TWO locale
 * bundles — `src/locales/en/common.json` and `src/locales/vi/common.json` — so
 * "every language the app can be in" is a two-element set that can be
 * enumerated inside the selector. Matching BOTH strings is language-independent
 * for every state the app can actually reach, which is the property the warning
 * was really about.
 *
 * ## Two rules that keep this from rotting
 *
 * 1. Pass the values from the locale files VERBATIM, and pass BOTH. Called with
 *    one string these are single-language selectors wearing a bilingual name —
 *    use {@link byExactText} / {@link buttonWithText} and be honest about it.
 * 2. They stay FALLBACKS. When `npm run audit:testids` reports the testid has
 *    landed, delete the fallback instead of keeping "both ways in": a testid and
 *    a text match that disagree is a silent wrong-element click.
 *
 * A third locale bundle appearing in `src/locales/` invalidates every call
 * below, which is why `npm run audit:testids` is the gate rather than a comment.
 */

/** XPath predicate: the context node's own text is exactly one of `texts`. */
const anyExactText = (texts: readonly string[]): string =>
  texts.map((text) => `normalize-space()="${text}"`).join(' or ');

/** XPath predicate: the context node's text CONTAINS one of `texts`. */
const anyPartialText = (texts: readonly string[]): string =>
  texts.map((text) => `contains(normalize-space(),"${text}")`).join(' or ');

/** A button whose whole label is one of `texts` — e.g. `('Save', 'Lưu')`. */
export const buttonWithAnyText = (...texts: string[]): string =>
  `//button[${anyExactText(texts)}] | //*[@role="button"][${anyExactText(texts)}]`;

/**
 * A button CONTAINING one of `texts`.
 *
 * For this app's icon-plus-label buttons. `Icon` renders a `<span>` holding a
 * raw SVG via `dangerouslySetInnerHTML`, so an icon carrying a `<text>` node
 * would break an exact match while leaving the label perfectly readable.
 * Strictly weaker than {@link buttonWithAnyText} — reach for it only where the
 * exact form is known to be unsafe, because a substring can match a longer
 * label ("Note" also matches "Order Note").
 */
export const buttonContainingAnyText = (...texts: string[]): string =>
  `//button[${anyPartialText(texts)}] | //*[@role="button"][${anyPartialText(texts)}]`;

/** Any element whose whole text is one of `texts`. For messages and headings. */
export const textIsAnyOf = (...texts: string[]): string => `//*[${anyExactText(texts)}]`;

/**
 * The VALUE span of a label/amount row.
 *
 * The app builds every money row the same way — one flex `div` holding a label
 * span and an amount span:
 *
 * ```html
 * <div class="flex items-center justify-between"><span>Subtotal</span><span>$12.34</span></div>
 * ```
 *
 * Returning `span[last()]` hands back the AMOUNT rather than the whole row,
 * which is what keeps `parseMoney()` working on deduction rows: their text is
 * `- $5.00`, and read off the row it arrives as `Total Discount - $5.00`, where
 * the minus is no longer leading and the sign is silently lost.
 */
export const rowAmount = (...labels: string[]): string =>
  `//div[./span[${anyExactText(labels)}]]/span[last()]`;

/**
 * {@link rowAmount}, restricted to one subtree.
 *
 * `ancestorClass` is matched with `contains()` against a `class` attribute, so
 * pass a stable single token (`is-changing-staff`), never a Tailwind utility
 * that restyling will move. Needed where the same label appears twice on one
 * screen and `find()` would return whichever comes first in document order.
 */
export const rowAmountUnder = (ancestorClass: string, ...labels: string[]): string =>
  `//*[contains(@class,"${ancestorClass}")]//div[./span[${anyExactText(labels)}]]/span[last()]`;

/** A shadcn `Card` whose `CardTitle` is one of `titles`. */
export const cardWithTitle = (...titles: string[]): string =>
  `//*[@data-slot="card"][.//*[@data-slot="card-title"][${anyExactText(titles)}]]`;

/** An input carrying one of these placeholders. */
export const inputWithAnyPlaceholder = (...placeholders: string[]): string =>
  placeholders.map((text) => `[placeholder="${text}"]`).join(', ');

/**
 * A locator with a declared fallback chain.
 *
 * `resolve()` returns the ordered candidates; the page object tries each in
 * turn. `primary` is always the testid the app SHOULD have — `audit:testids`
 * reads these to build its report, which is why they are declared as data
 * rather than inlined into a `$()` call.
 */
export interface Locator {
  /** Human name used in logs and failure messages. */
  readonly name: string;
  /** The `data-testid` the app is expected to expose. */
  readonly testId: string;
  /** Ordered fallbacks used while the testid is missing. */
  readonly fallbacks: readonly string[];
}

export function locator(name: string, testId: string, ...fallbacks: string[]): Locator {
  return { name, testId, fallbacks };
}

/** Full candidate list for a locator: testid first, then declared fallbacks. */
export function candidates(loc: Locator): string[] {
  return [byTestId(loc.testId), ...loc.fallbacks];
}
