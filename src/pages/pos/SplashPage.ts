import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import { SplashIds } from '../../constants/testids.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { waitUntilPath } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * `/splashscreen` — the boot gate.
 *
 * ## Why this page object is nothing but waiting
 *
 * The screen has no controls. `src/routes/splashscreen/index.tsx` opens a Tauri
 * `Channel<SplashState>` into `commands.splash` and does nothing else until the
 * Rust side reports `finished`: migrations, three SQLCipher database opens and a
 * sync handshake, then `navigate({ to: '/' })`. Everything a spec can do here is
 * wait for that to end, which is why the only real method is
 * {@link waitUntilLeft}.
 *
 * ## Why it can end somewhere other than /home
 *
 * The route's `loader` fetches `deviceContext` and throws
 * `redirect({ to: '/login' })` when `authenticated === false`, so leaving the
 * splash means "/login" just as often as it means "/home" on a fresh machine.
 * {@link waitUntilLeft} therefore asserts departure only; deciding which screen
 * came next belongs to the caller.
 *
 * ## Why the status text is worth ten extra seconds on failure
 *
 * Three of the app's states park here FOREVER rather than erroring out, and a
 * bare "still on /splashscreen after 90s" cannot tell them apart:
 *
 * - a 403 from the upstream API (the device is not yet approved in the portal)
 *   latches `awaitingApproval` and slow-polls every 6s for two minutes;
 * - once that window is spent the screen swaps to "contact support";
 * - a non-403 error retries three times and then sits on the last message.
 *
 * All three are environment/account problems, not test bugs, and the on-screen
 * line names which one. {@link statusMessage} is what puts it in the failure.
 */
export class SplashPage extends BasePage {
  readonly name = 'Splash';
  readonly route = Routes.SPLASH;

  protected readonly readyAnchor: Locator = SplashIds.screen;

  /**
   * Block until the router is off `/splashscreen`.
   *
   * Budgeted at {@link Timeouts.APP_BOOT} (90s) because this is the one wait in
   * the suite that covers disk migrations plus a network round trip; the usual
   * navigation budget expires while the app is still legitimately working.
   */
  async waitUntilLeft(timeout: number = Timeouts.APP_BOOT): Promise<void> {
    await logStep('Splash: wait for the app to finish booting');

    try {
      await waitUntilPath((path) => !path.startsWith(this.route), {
        timeout,
        message: `The app never left ${this.route}`,
      });
    } catch (error) {
      const status = await this.statusMessage();
      throw new Error(
        `${this.name}: the app was still on ${this.route} after ${timeout}ms.\n` +
          (status
            ? `On-screen status: "${status}".`
            : `The screen showed no readable status line, which usually means the WebView ` +
              `never painted the splash at all — check the app logs under %LOCALAPPDATA%\\VoltPOS\\logs.`) +
          `\nA splash that hangs is a backend or device-approval problem: the boot channel only ` +
          `advances once migrations, the three database opens and the first sync all succeed.`,
        { cause: error },
      );
    }
  }

  /**
   * The line the splash is currently showing, or `''` when none is readable.
   *
   * Returns text rather than an element on purpose — a spec that wants to assert
   * on progress should compare strings, not reach into the DOM.
   *
   * Two sources, because the message moves depending on the state. In the normal
   * case it is a `<p>` rendered as the SIBLING of the progress track inside one
   * flex column, so the track's parent is the narrowest node that contains it —
   * and the track is the only element on this screen the catalogue can address
   * today. In the waiting-for-approval and contact-support states the progress
   * bar is not rendered at all, and only the whole-screen container has the text.
   */
  async statusMessage(): Promise<string> {
    try {
      const track = await this.find(SplashIds.progress, { timeout: Timeouts.SHORT });
      const row = await track.parentElement().getElement();
      const text = (await row.getText()).trim();
      if (text) return text.replace(/\s+/g, ' ');
    } catch (error) {
      this.log.debug(`No progress row to read: ${reason(error)}`);
    }

    try {
      // Only pays off once `splash-screen` lands as a real testid: the declared
      // fallback (`div.bg-slate-950`) is the full-bleed backdrop, which the app
      // renders self-closing and therefore holds no text.
      const text = await this.text(SplashIds.screen, { timeout: Timeouts.SHORT });
      if (text) return text.replace(/\s+/g, ' ');
    } catch (error) {
      this.log.debug(`No splash container to read: ${reason(error)}`);
    }

    return '';
  }
}

export default new SplashPage();
