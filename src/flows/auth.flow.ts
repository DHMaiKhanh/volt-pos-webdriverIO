import { Timeouts } from '../../configs/constants/timeouts.js';
import { env } from '../../configs/env/loadEnv.js';
import { hasHeaderNav } from '../components/index.js';
import { Routes } from '../constants/routes.js';
import { step } from '../helpers/steps.js';
import { waitUntilPath } from '../helpers/wait.js';
import { switchToMain } from '../helpers/window.js';
import { homePage, loginPage, splashPage } from '../pages/index.js';
import type { HomePage } from '../pages/index.js';
import { returnToHome } from './navigation.flow.js';

/**
 * Getting the app from "a window exists" to "a spec can work".
 *
 * ## The boot this models
 *
 * `/splashscreen` → (`/login` when the device is not authenticated) → `/home`.
 * The splash is not a brand screen: `splashscreen/index.tsx` opens a Tauri
 * channel into `commands.splash` and waits for Rust to finish migrations, three
 * SQLCipher database opens and a sync handshake. That is why every wait here is
 * budgeted on {@link Timeouts.APP_BOOT} rather than a navigation timeout — and
 * why {@link SplashPage.waitUntilLeft} is used instead of a bare path wait, so a
 * device that is stuck awaiting portal approval says so instead of timing out
 * anonymously.
 *
 * ## What these flows deliberately do NOT do
 *
 * They never navigate by URL. `browser.url()` works against the custom protocol,
 * but it is a document load: it reloads the WebView, re-runs the entire splash
 * boot, and discards the step overlay `AppLifecycleService` installed. So a
 * screen the app cannot reach on its own is reported as an error with the
 * remedy, not papered over with a reload.
 */

/**
 * Where a boot ended.
 *
 * `home` means **past the login gate**, which is usually `/home` but is any
 * authenticated route: a spec that boots after a previous test left the till on
 * checkout is signed in, and calling that `login` would be a lie. Read
 * {@link BootResult.path} when the exact screen matters.
 */
export type BootScreen = 'login' | 'home';

export interface BootResult {
  screen: BootScreen;
  /** The path the router settled on, exactly as `browser.getUrl()` reports it. */
  path: string;
}

const isSplash = (path: string): boolean => path.startsWith(Routes.SPLASH);

/** Covers `/login` (QR) and `/login-staff-token` (credentials) — see {@link LoginPage}. */
const isLogin = (path: string): boolean => path.startsWith(Routes.LOGIN);

/** `''` and `/` are the WebView before TanStack Router has resolved its first match. */
const isUnrouted = (path: string): boolean => path === '' || path === '/';

/**
 * What is left of a budget, floored rather than allowed to go negative.
 *
 * A wait handed a spent budget would expire before its first poll and report a
 * timeout for something that had not been looked at once, which reads in the
 * log as a failure of the screen rather than of the clock.
 */
const remaining = (deadline: number): number => Math.max(1_000, deadline - Date.now());

/**
 * Wait out the boot and report which side of the login gate the app landed on.
 *
 * Safe to call at any point of a session: it handles attaching before the router
 * has mounted (`/`), during the splash, and long after the app settled.
 *
 * The window switch comes first because the driver's initial handle is not
 * guaranteed to be the staff window — the app opens a second one (`VOLT POS -
 * Customer Display`) during startup, and VP-802 hit exactly this, which is why
 * its every entry point began with `ensureMainWindow()`.
 */
export async function bootApp(timeout: number = Timeouts.APP_BOOT): Promise<BootResult> {
  return step('Boot the app', async () => {
    const deadline = Date.now() + timeout;

    await switchToMain();

    let path = await splashPage.currentPath();

    if (isUnrouted(path)) {
      path = await waitUntilPath((p) => !isUnrouted(p), {
        timeout: Math.min(Timeouts.NAVIGATION, remaining(deadline)),
        message: 'The WebView never routed away from "/", so the React app did not mount',
      });
    }

    if (isSplash(path)) {
      await splashPage.waitUntilLeft(remaining(deadline));
      path = await splashPage.currentPath();
    }

    // The splash can hand over to `/` for a beat before the index route resolves.
    if (isUnrouted(path)) {
      path = await waitUntilPath((p) => !isUnrouted(p) && !isSplash(p), {
        timeout: Math.min(Timeouts.NAVIGATION, remaining(deadline)),
        message: 'The app left the splash but never resolved a route',
      });
    }

    return { screen: isLogin(path) ? 'login' : 'home', path };
  });
}

/**
 * Boot, sign in when the login screen is up, and return a ready `/home`.
 *
 * Idempotent: on an app that is already signed in and sitting on the till this
 * costs one URL read plus the readiness probe, so it belongs in every `before`
 * hook rather than behind a flag.
 *
 * It refuses one case on purpose. If the app is authenticated but parked on
 * another route — a previous test that ended at checkout or payment-success —
 * there is no navigation this flow is willing to perform (see the module note),
 * so it throws and names the remedy. Ending the previous flow is the spec's job.
 */
export async function ensureLoggedIn(timeout: number = Timeouts.APP_BOOT): Promise<HomePage> {
  const deadline = Date.now() + timeout;
  const boot = await bootApp(timeout);

  if (boot.screen === 'home') {
    if (!boot.path.startsWith(Routes.HOME)) {
      // A device with a live backlog boots straight into the pending-orders
      // queue (`/order-pending`), not `/home` — and `/order-history` is the same
      // kind of landing. Those are legitimate authenticated screens, not a spec
      // that left a flow open, and `returnToHome()` reaches the till from them
      // with a single header click. Recover rather than refuse.
      //
      // Checkout, split-order and payment-success are deliberately NOT recovered
      // here: `hasHeaderNav()` is false for exactly those, and each means a
      // PREVIOUS flow did not end itself — the spec's job, per the module note.
      // `returnToHome()` throws on them with that diagnosis, so a real hand-off
      // bug still fails loudly instead of being bulldozed.
      if (hasHeaderNav(boot.path)) {
        return returnToHome();
      }
      throw new Error(
        `ensureLoggedIn(): the app is signed in but parked on "${boot.path}", not ${Routes.HOME}. ` +
          `Flows never navigate by URL — that would reload the WebView and re-run the whole splash ` +
          `boot — so finish the previous flow first (paymentSuccessPage.continueToNextOrder(), ` +
          `homePage.deleteOrder()), or start this spec in a fresh session.`,
      );
    }
    return homePage.waitForReady(remaining(deadline));
  }

  const staffToken = requireStaffToken();

  await step('Sign in with the staff token', async () => {
    await loginPage.waitForReady(remaining(deadline));
    await loginPage.login(staffToken, '');
  });

  // Authenticating can drop the app back onto the splash: the device context is
  // re-fetched and the sync handshake runs again for the newly-known merchant.
  const afterLogin = await waitUntilPath((p) => isSplash(p) || p.startsWith(Routes.HOME), {
    timeout: remaining(deadline),
    message: 'Login succeeded but the app never reached the splash or the till',
  });

  if (isSplash(afterLogin)) {
    await splashPage.waitUntilLeft(remaining(deadline));
    await waitUntilPath((p) => p.startsWith(Routes.HOME), {
      timeout: remaining(deadline),
      message: 'The post-login splash finished somewhere other than the till',
    });
  }

  return homePage.waitForReady(remaining(deadline));
}

/**
 * The staff token, or a failure that names what to set.
 *
 * ## There is only one credential in this app
 *
 * `/login` renders a QR code and polls `useQrLogin` until the portal claims the
 * device — nothing typed can satisfy it. The only credential field anywhere is
 * `staffToken` on `/login-staff-token`, reached by the secret tap on the version
 * line of `AboutInfo`. So the suite carries ONE secret, `STAFF_TOKEN`, and the
 * username/password pair this function used to demand could never be spent.
 *
 * Checked BEFORE anything is typed. Submitting an empty string puts the app's
 * own validation on screen and the run then fails several steps later on a
 * missing home-screen element — a diagnosis three files away from the real
 * problem, which is an unset environment variable.
 */
function requireStaffToken(): string {
  if (env.STAFF_TOKEN !== '') return env.STAFF_TOKEN;

  throw new Error(
    'The app is showing the login screen but STAFF_TOKEN is empty, so there is nothing to sign ' +
      'in with.\n' +
      `Set STAFF_TOKEN in configs/env/.env.${env.ENV} or configs/env/.env.local (copy ` +
      'configs/env/.env.example), or export it from the CI secret store — the real process ' +
      'environment wins over both files.\n' +
      'Note that /login itself is a QR login and cannot be automated at all; the token drives ' +
      '/login-staff-token, which is the only typed credential the app accepts. A device that is ' +
      'already signed in never reaches either screen, which is why this is not checked up front.',
  );
}
