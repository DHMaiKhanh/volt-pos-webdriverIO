import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import { LoginIds } from '../../constants/testids.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { waitUntilPath } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';
import homePage from './HomePage.js';
import type { HomePage } from './HomePage.js';

/**
 * The credential screen the splash redirects to when the device is not
 * authenticated.
 *
 * ## Read this before writing a spec against it
 *
 * `Routes.LOGIN` is the route the app redirects to, but on `develop` the screen
 * at `/login` is a **QR login**: `src/routes/login/index.tsx` renders a
 * `QRCodeSVG` and polls `useQrLogin` until the portal claims the device. There
 * is no username/password form on it.
 *
 * The credential form VP-802 automated lives on `/login-staff-token`, is reached
 * by tapping the version line in `AboutInfo`, and has a SINGLE `staffToken`
 * field rather than two. `/login-staff-token` still starts with `/login`, so
 * `isActive()` and the departure wait in {@link login} cover both screens
 * without a second route constant.
 *
 * That is why {@link enterCredentials} types the username unconditionally and
 * treats the password field as optional: on the staff-token screen the one
 * field IS the credential, and failing there would report a missing selector for
 * an input the app deliberately does not render. The warning it logs instead is
 * the honest signal — if a spec passes a password and nothing consumed it, the
 * run should say so out loud.
 */
export class LoginPage extends BasePage {
  readonly name = 'Login';
  readonly route = Routes.LOGIN;

  protected readonly readyAnchor: Locator = LoginIds.page;

  /**
   * Is the credential screen on screen right now?
   *
   * Deliberately checks the ROUTE as well as the card. The declared fallback for
   * the login card is `[data-slot="card"]`, which every shadcn `Card` in the app
   * matches — on its own it would report "login is showing" from the middle of
   * the settings screen.
   */
  async isDisplayed(): Promise<boolean> {
    if (!(await this.isActive())) return false;
    return this.isVisible(LoginIds.page, Timeouts.SHORT);
  }

  /** Fill the credential fields without submitting. */
  async enterCredentials(username: string, password: string): Promise<this> {
    await logStep(`Login: enter credentials for "${username}"`);
    await this.setValue(LoginIds.usernameInput, username);

    // Probed at animation length, not the usual SHORT budget: the form is
    // already rendered by the time the first field accepted text, so a second
    // field is either there now or is never coming, and a 5s probe would be
    // spent in full on every staff-token login.
    if (await this.exists(LoginIds.passwordInput, Timeouts.ANIMATION)) {
      await this.setValue(LoginIds.passwordInput, password);
      return this;
    }

    this.log.warn(
      `${this.name}: no password field on this screen, so the supplied password was not used. ` +
        `That is expected on /login-staff-token, which authenticates with a single staff token — ` +
        `pass the token as the username. If you meant to be on a two-field form, the app is not ` +
        `showing one.`,
    );
    return this;
  }

  /** Submit whatever is currently in the form. Does not wait for the outcome. */
  async submit(): Promise<this> {
    await logStep('Login: submit');
    await this.click(LoginIds.submitButton);
    return this;
  }

  /**
   * Enter credentials, submit, and wait until the router leaves the login route.
   *
   * Returns the home page WITHOUT waiting for it to be ready: the app can route
   * through `/splashscreen` again after authenticating, and a spec that wants a
   * usable till should chain `.waitForNavigation()` itself.
   *
   * For a negative-path spec — asserting that bad credentials are rejected —
   * call {@link enterCredentials} and {@link submit} instead, so the failure to
   * navigate is the assertion rather than a timeout thrown from here.
   */
  async login(username: string, password: string): Promise<HomePage> {
    await this.enterCredentials(username, password);
    await this.submit();

    try {
      await waitUntilPath((path) => !path.startsWith(this.route), {
        // Budgeted as an upstream call: the submit round-trips to the API before
        // the router is allowed to move.
        timeout: Timeouts.API,
        message: `Login did not navigate away from ${this.route}`,
      });
    } catch (error) {
      throw new Error(
        `${this.name}: still on ${this.route} after submitting as "${username}". ` +
          `Either the credentials were rejected, or this build shows the QR login at /login ` +
          `and the staff-token form was never opened — see the class note.`,
        { cause: error },
      );
    }

    return homePage;
  }
}

export default new LoginPage();
