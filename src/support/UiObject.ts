import { $, $$, browser } from '@wdio/globals';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { candidates, type Locator } from '../helpers/selectors.js';
import { moduleLogger } from '../utils/logger.js';

export interface FindOptions {
  /** How long to keep trying the whole candidate chain. */
  timeout?: number;
  /** Require the element to be displayed, not merely present in the DOM. */
  visible?: boolean;
  /** Scope the search under this element instead of the document. */
  within?: WebdriverIO.Element;
}

/**
 * Shared behaviour for every page object and component.
 *
 * ## The one rule this class enforces
 *
 * Nothing outside `src/pages` and `src/components` may call `$()` directly.
 * Selectors live in {@link Locator} declarations so that:
 *   - `npm run audit:testids` can enumerate every testid the suite depends on
 *     and diff it against the app source, and
 *   - a missing testid degrades to a REVIEWED fallback instead of whatever CSS
 *     path happened to work the day the spec was written.
 *
 * ## Why the retry loop is hand-rolled
 *
 * WebdriverIO's own `waitForExist` takes ONE selector. A locator here has a
 * chain, and the chain must be re-tried as a whole: on a slow screen the testid
 * may not be mounted yet while the fallback already matches a stale node from
 * the previous route. Polling the whole chain and preferring the earliest match
 * each round is what makes the fallback safe.
 */
export abstract class UiObject {
  protected readonly log = moduleLogger(this.constructor.name);

  /** First element matching any candidate of `loc`. Throws with the full chain on failure. */
  protected async find(loc: Locator, opts: FindOptions = {}): Promise<WebdriverIO.Element> {
    const timeout = opts.timeout ?? Timeouts.MEDIUM;
    const chain = candidates(loc);
    const deadline = Date.now() + timeout;
    let lastError = '';

    do {
      for (const selector of chain) {
        try {
          // WebdriverIO v9: `$()` returns a ChainablePromiseElement, which is NOT a
          // Promise at the type level — `getElement()` is the documented way to
          // materialise the real element. `await` happens to work at runtime, but it
          // does not narrow, and the resulting `any`-ish value defeats the point of
          // typing this layer at all.
          const chainable = opts.within ? opts.within.$(selector) : $(selector);
          const el = await chainable.getElement();
          if (!(await el.isExisting())) continue;
          if (opts.visible && !(await el.isDisplayed())) continue;
          return el;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      await browser.pause(120);
    } while (Date.now() < deadline);

    throw new Error(
      `Could not find "${loc.name}" within ${timeout}ms.\n` +
        `Tried, in order:\n${chain.map((s) => `  - ${s}`).join('\n')}\n` +
        (lastError ? `Last driver error: ${lastError}\n` : '') +
        `If the first candidate is the missing one, run \`npm run audit:testids\` — ` +
        `the app may simply not expose data-testid="${loc.testId}" yet.`,
    );
  }

  /** Every element matching the FIRST candidate that matches anything. */
  protected async findAll(loc: Locator, opts: FindOptions = {}): Promise<WebdriverIO.Element[]> {
    const timeout = opts.timeout ?? Timeouts.MEDIUM;
    const chain = candidates(loc);
    const deadline = Date.now() + timeout;

    do {
      for (const selector of chain) {
        // Same v9 rule as above: `.length` on a ChainablePromiseArray is itself a
        // Promise, so comparing it directly silently compares an object to a number.
        const chainable = opts.within ? opts.within.$$(selector) : $$(selector);
        const list = await chainable.getElements();
        if (list.length > 0) return [...list];
      }
      await browser.pause(120);
    } while (Date.now() < deadline);

    return [];
  }

  /** Non-throwing presence check. Use for optional UI (a toast, an empty state). */
  protected async exists(loc: Locator, timeout: number = Timeouts.SHORT): Promise<boolean> {
    try {
      await this.find(loc, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  /** Presence AND visibility. */
  protected async isVisible(loc: Locator, timeout: number = Timeouts.SHORT): Promise<boolean> {
    try {
      const el = await this.find(loc, { timeout, visible: true });
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Click, once the element is genuinely clickable.
   *
   * The extra `waitForClickable` matters here more than on the web: this UI is
   * built for a touch tablet and leans on Radix overlays, so a dialog's fade-in
   * routinely covers a button that is already visible. Clicking early lands on
   * the overlay and the test fails somewhere unrelated.
   */
  protected async click(loc: Locator, opts: FindOptions = {}): Promise<void> {
    const el = await this.find(loc, { visible: true, ...opts });
    await el.waitForClickable({ timeout: opts.timeout ?? Timeouts.MEDIUM });
    this.log.debug(`click ${loc.name}`);
    await el.click();
  }

  /**
   * Replace an input's value.
   *
   * `setValue` clears first, which is what almost every caller wants. The app's
   * virtual keyboard mirrors the real DOM input, so a WebDriver-level value set
   * is picked up by React's change handler the same way a tap is.
   */
  protected async setValue(loc: Locator, value: string, opts: FindOptions = {}): Promise<void> {
    const el = await this.find(loc, { visible: true, ...opts });
    await el.waitForEnabled({ timeout: opts.timeout ?? Timeouts.MEDIUM });
    this.log.debug(`setValue ${loc.name} = ${value}`);
    await el.setValue(value);
  }

  /** Append to an input without clearing it. */
  protected async addValue(loc: Locator, value: string, opts: FindOptions = {}): Promise<void> {
    const el = await this.find(loc, { visible: true, ...opts });
    await el.addValue(value);
  }

  /** Trimmed visible text. */
  protected async text(loc: Locator, opts: FindOptions = {}): Promise<string> {
    const el = await this.find(loc, opts);
    return (await el.getText()).trim();
  }

  /**
   * An input's current value.
   *
   * The `?? ''` is not decoration: WebdriverIO resolves `getValue()` to `null`
   * for an element that has no value attribute at all, and every caller here
   * wants "empty", not a null check of its own.
   */
  protected async value(loc: Locator, opts: FindOptions = {}): Promise<string> {
    const el = await this.find(loc, opts);
    return (await el.getValue()) ?? '';
  }

  /** Wait until a locator disappears — dialogs closing, spinners finishing. */
  protected async waitGone(loc: Locator, timeout: number = Timeouts.MEDIUM): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!(await this.exists(loc, 300))) return;
      await browser.pause(150);
    }
    throw new Error(`"${loc.name}" was still present after ${timeout}ms.`);
  }
}
