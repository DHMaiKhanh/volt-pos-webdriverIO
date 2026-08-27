import { Timeouts } from '../../../configs/constants/timeouts.js';
import { byTestIdPrefix, locator } from '../../helpers/selectors.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle } from '../../helpers/wait.js';
import { BaseComponent } from '../BaseComponent.js';

/**
 * Reader for the sonner toasts (`src/components/ui/sonner.tsx`, top-right).
 *
 * Toasts are how this app reports the outcome of almost every write — order
 * saved, refund issued, payment failed, sync error — so this is the component
 * specs assert feedback with.
 *
 * ## Facts taken from sonner 2.0.7 itself, not from styling
 *
 * - The `<ol data-sonner-toaster>` is rendered only while at least one toast is
 *   live (`if (!filteredToasts.length) return null`). So `isOpen()` here reads as
 *   "a toast is on screen", and an absent root is a normal state rather than a
 *   broken selector.
 * - The `Toaster` PREPENDS new toasts to its own state (`return [toast, ...toasts]`),
 *   so the first `[data-sonner-toast]` in document order is the NEWEST. That is
 *   what makes {@link latest} well defined.
 * - A dismissed toast keeps its node for the length of its exit animation, marked
 *   `data-removed="true"`. Every lookup below excludes those, otherwise a toast
 *   that is already fading reads as current.
 * - Each toast carries `data-type` (`success` / `error` / `warning` / `info`) and
 *   a `[data-close-button]`, the latter because the app passes `closeButton`.
 *
 * ## The i18n rule
 *
 * Toast copy comes from i18next and the merchant can switch the till to
 * Vietnamese, so {@link waitFor} is only safe when the spec knows the run's
 * language. Where the assertion is really "did it succeed", use {@link latestType}
 * — `data-type` is set in code and never translated.
 *
 * The updater also posts a toast on mount (`SoftwareUpdaterTrigger`), so on a
 * fresh boot the newest toast may not be the one the spec caused. `waitFor()`
 * matches on content precisely so it can step over that one, and
 * `dismissUpdaterIfPresent()` in `src/helpers/updater.ts` clears it deliberately.
 */

/**
 * The toast list.
 *
 * `[data-sonner-toaster]` is sonner's own attribute rather than an app class, so
 * unlike the fallbacks elsewhere in this suite it is not scaffolding waiting on a
 * testid — it only changes if the library does.
 */
const TOASTER: Locator = locator('toast region', 'toaster', '[data-sonner-toaster]', 'ol.toaster');

/** One toast row, newest first, ignoring any that is already animating out. */
const TOAST_ITEMS: Locator = locator(
  'toast rows',
  'toast-item-',
  `${byTestIdPrefix('toast-item-')}:not([data-removed="true"])`,
  '[data-sonner-toast]:not([data-removed="true"])',
);

const CLOSE_BUTTON: Locator = locator('toast close button', 'toast-close-btn', '[data-close-button]');

export class ToastMessage extends BaseComponent {
  readonly name = 'toast';

  protected readonly root: Locator = TOASTER;

  /**
   * Text of the newest toast — title and description — or `null` when none is up.
   *
   * The default timeout is the wait for a toast to APPEAR, so pass
   * `Timeouts.ANIMATION` for a quick "is anything showing" probe and a longer
   * budget when the toast follows an upstream call.
   */
  async latest(timeout: number = Timeouts.SHORT): Promise<string | null> {
    const [newest] = await this.items(timeout);
    if (!newest) return null;
    return (await newest.getText()).trim();
  }

  /**
   * `data-type` of the newest toast: `success`, `error`, `warning`, `info`.
   *
   * The i18n-proof half of this component — prefer it over matching copy whenever
   * the assertion is about the outcome rather than the wording.
   */
  async latestType(timeout: number = Timeouts.SHORT): Promise<string | null> {
    const [newest] = await this.items(timeout);
    if (!newest) return null;
    return (await newest.getAttribute('data-type')) ?? null;
  }

  /**
   * Block until some toast contains `text` (case-insensitive) and return its full
   * text. Throws listing every toast that WAS on screen, which is the difference
   * between "no feedback at all" and "the app said something else".
   */
  async waitFor(text: string, timeout: number = Timeouts.MEDIUM): Promise<string> {
    const wanted = text.toLowerCase();
    const deadline = Date.now() + timeout;
    let seen: string[] = [];

    while (Date.now() < deadline) {
      seen = await this.texts(Timeouts.ANIMATION);
      const match = seen.find((toast) => toast.toLowerCase().includes(wanted));
      if (match !== undefined) return match;
      await settle(Timeouts.ANIMATION / 2);
    }

    throw new Error(
      `No toast containing "${text}" appeared within ${timeout}ms. ` +
        `On screen at the end: ${seen.length > 0 ? seen.map((toast) => `"${toast}"`).join(', ') : '(none)'}. ` +
        `Toast copy is translated — if the till is not running the language this text was written in, ` +
        `assert on latestType() instead.`,
    );
  }

  /**
   * Close every toast that is up.
   *
   * Used between tests so one step's feedback cannot be read as the next step's.
   * Toasts also expire on their own, so a row can vanish mid-loop: that race is
   * expected and skipped rather than reported. If some toast still refuses to go
   * the method logs and returns instead of throwing — this runs in cleanup, and a
   * failure raised here would mask the assertion failure that is the real finding.
   */
  async dismissAll(timeout: number = Timeouts.MEDIUM): Promise<void> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const open = await this.items(Timeouts.ANIMATION);
      if (open.length === 0) return;

      for (const toast of open) {
        try {
          // `within` is the toast row itself, which came out of `insideAll()`, so
          // this stays scoped the same way every other lookup in the class is.
          const close = await this.find(CLOSE_BUTTON, { within: toast, timeout: Timeouts.ANIMATION });
          await close.click();
        } catch {
          continue;
        }
      }

      await settle(Timeouts.ANIMATION);
    }

    const left = await this.texts(Timeouts.ANIMATION);
    if (left.length > 0) {
      this.log.warn(`${left.length} toast(s) still on screen after ${timeout}ms: ${left.join(' | ')}`);
    }
  }

  /** Trimmed text of every live toast, newest first. */
  private async texts(timeout: number): Promise<string[]> {
    const open = await this.items(timeout);
    const texts: string[] = [];
    for (const toast of open) {
      try {
        texts.push((await toast.getText()).trim());
      } catch {
        // Expired between the query and the read — nothing to report.
        continue;
      }
    }
    return texts;
  }

  /**
   * Live toast rows, or an empty list.
   *
   * `insideAll()` resolves the root first and throws when the toaster is not
   * mounted, which for this component is simply "no toasts" — an empty list says
   * that without making every caller write a try/catch.
   */
  private async items(timeout: number): Promise<WebdriverIO.Element[]> {
    try {
      return await this.insideAll(TOAST_ITEMS, { timeout });
    } catch {
      return [];
    }
  }
}

/** Shared instance — the component keeps no state between calls. */
export const toastMessage = new ToastMessage();
