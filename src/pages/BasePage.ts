import { browser } from '@wdio/globals';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { pathOf } from '../constants/routes.js';
import { locator, type Locator } from '../helpers/selectors.js';
import { UiObject } from '../support/UiObject.js';

/**
 * The app's whole-screen failure states.
 *
 * Both replace the screen entirely, so waiting for a normal readiness anchor
 * just burns the full timeout and then reports "element not found" — which
 * blames the selector for what is actually an environment or account problem.
 * Racing the anchor against these turns a 30s mystery into a 1s diagnosis.
 */
const ERROR_BOUNDARY: Locator = locator(
  'app error boundary',
  'app-error-boundary',
  '//*[contains(normalize-space(.), "Something went wrong")]',
);

const FORCED_UPDATE: Locator = locator(
  'forced update screen',
  'forced-update-screen',
  '//*[contains(normalize-space(.), "Update Required")]',
  '//*[contains(normalize-space(.), "Cập nhật")]',
);

export abstract class BasePage extends UiObject {
  /** Name used in logs, screenshots and failure messages. */
  abstract readonly name: string;

  /**
   * The URL path this page owns, as reported by `browser.getUrl()` — i.e.
   * WITHOUT the `_app` layout segment. See `src/constants/routes.ts`.
   */
  abstract readonly route: string;

  /**
   * The one element that proves this screen finished rendering.
   *
   * Pick something that only exists once the data arrived — a table body, a
   * total, the primary action button — never a static header, which paints
   * before the GraphQL round trip and lets specs race ahead of their data.
   */
  protected abstract readonly readyAnchor: Locator;

  /** Current URL path, origin and query stripped. */
  async currentPath(): Promise<string> {
    return pathOf(await browser.getUrl());
  }

  /** Is the router sitting on this page right now? */
  async isActive(): Promise<boolean> {
    return (await this.currentPath()).startsWith(this.route);
  }

  /**
   * Block until the screen is usable, or fail fast with the real reason.
   *
   * Three outcomes race: the readiness anchor, the error boundary, and the
   * forced-update screen. Whichever resolves first decides the message.
   */
  async waitForReady(timeout: number = Timeouts.LONG): Promise<this> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (await this.exists(this.readyAnchor, 400)) {
        this.log.debug(`${this.name} ready`);
        return this;
      }
      if (await this.exists(ERROR_BOUNDARY, 200)) {
        const detail = await this.text(ERROR_BOUNDARY, { timeout: 1_000 }).catch(() => '');
        throw new Error(
          `${this.name}: the app rendered its error boundary instead of the screen. ` +
            `The query behind this page failed, so this is an environment/account problem, ` +
            `not a selector one.\nDetail: ${detail.replace(/\s+/g, ' ').slice(0, 240)}`,
        );
      }
      if (await this.exists(FORCED_UPDATE, 200)) {
        throw new Error(
          `${this.name}: the forced-update screen took over. The updater endpoint returned a ` +
            `payload with \`deprecated: true\` for this build. Install the version the ` +
            `environment expects, or run against a build the server still accepts.`,
        );
      }
      // The interval of a hand-rolled poll, not a pause standing in for a wait.
      // Three outcomes race above — the anchor, the error boundary, the forced
      // update screen — and no WebdriverIO wait takes more than one selector, so
      // the loop has to own its own tick.
      // eslint-disable-next-line wdio/no-pause
      await browser.pause(200);
    }

    throw new Error(
      `${this.name} did not become ready within ${timeout}ms ` +
        `(waiting for "${this.readyAnchor.name}", current path: ${await this.currentPath()}).`,
    );
  }

  /** Wait until the router lands on this page, then until it is ready. */
  async waitForNavigation(timeout: number = Timeouts.NAVIGATION): Promise<this> {
    await browser.waitUntil(async () => this.isActive(), {
      timeout,
      interval: 200,
      timeoutMsg: `Router never reached "${this.route}" (still on ${await this.currentPath()}).`,
    });
    return this.waitForReady(timeout);
  }
}
