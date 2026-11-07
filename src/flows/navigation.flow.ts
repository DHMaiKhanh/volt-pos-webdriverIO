import { browser } from '@wdio/globals';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { env } from '../../configs/env/loadEnv.js';
import { appNav, hasHeaderNav, passcodeDialog } from '../components/index.js';
import { Routes } from '../constants/routes.js';
import { step } from '../helpers/steps.js';
import { waitUntilPath } from '../helpers/wait.js';
import { clearPasscodeGrant } from '../support/passcodeGrant.js';
import {
  accessibilitySettingsPage,
  checkoutPage,
  customerDisplayPage,
  homePage,
  orderHistoryPage,
  paymentSuccessPage,
  settingsPage,
} from '../pages/index.js';
import type { HomePage, OrderHistoryPage, PasscodeGate, SettingsPage } from '../pages/index.js';

/**
 * Getting between screens.
 *
 * ## Why this is a flow and not a page-object method
 *
 * Every function here spans screens by construction: leaving payment-success is
 * a different action from leaving checkout, which is different again from
 * leaving order history, and NO page object may know about the screens either
 * side of it. The chrome itself (header links, sidebar drawer) belongs to
 * `components/nav/AppNav.ts`; this module is the routing decision on top of it,
 * which is exactly the split the flow layer exists for.
 *
 * ## Still no `browser.url()`
 *
 * The rule from `auth.flow.ts` holds here and matters more, not less: a URL
 * navigation is a document load, so it re-runs the entire splash boot — three
 * SQLCipher opens and a sync handshake — and discards the step overlay. Every
 * move below is a click a cashier could make, which also means a screen the app
 * refuses to leave is reported as such instead of being bulldozed.
 *
 * ## Nothing here is a write
 *
 * No `assertWritesAllowed()`: navigating creates no rows and pushes nothing
 * upstream, which is what makes these safe to call from the smoke suite and
 * from the root hooks on a production till.
 */

/**
 * How many screens {@link returnToHome} will walk through before giving up.
 *
 * The worst real path is three: payment-success hands back to a re-opened
 * order's history detail, that needs the logo, and the till then has to settle.
 * Four leaves one spare and still fails in seconds rather than looping on a
 * screen that is not moving.
 */
const MAX_HOPS = 4;

const isCheckout = (path: string): boolean => path.includes('/checkout');

const isPaymentSuccess = (path: string): boolean => path.includes('/payment-success');

const isPreAuth = (path: string): boolean => path.startsWith(Routes.SPLASH) || path.startsWith(Routes.LOGIN);

/**
 * Put the app back on the till, from wherever the last test left it.
 *
 * Idempotent, and cheap when it is already there: one URL read plus the home
 * screen's readiness probe. That is what makes it correct in a `before` hook as
 * well as in the root hooks' failure recovery.
 *
 * ## It walks, screen by screen
 *
 * Each of the three exits is the app's own, because they are not
 * interchangeable:
 *
 * - **payment-success** hides the header entirely (`header.tsx`), so the ONLY
 *   way out is a receipt-delivery button. "No Receipt" is the one that neither
 *   prints nor opens a dialog. It lands on `/home` for a normal sale and back on
 *   `/order-history/{id}` for an order re-opened from history — hence the loop
 *   rather than a single step.
 * - **checkout** replaces the whole left nav with a back arrow, which is why
 *   {@link CheckoutPage.pressBack} exists and why a fully-tendered order (no
 *   arrow at all) fails here with that explanation.
 * - **everything else** has the logo, which is a plain `<Link to="/home">`.
 *
 * A pre-auth screen is refused rather than handled: signing in is
 * {@link ensureLoggedIn}'s job, and quietly doing it here would let a spec that
 * lost its session report a pass.
 */
export async function returnToHome(): Promise<HomePage> {
  return step('Return to the till', async () => {
    for (let hop = 0; hop < MAX_HOPS; hop += 1) {
      const path = await appNav.currentPath();

      if (path.startsWith(Routes.HOME)) {
        // A dialog left open blocks every click; a filter left in the search
        // boxes hides the staff cards the ready check waits for.
        await homePage.dismissOpenDialogs();
        await homePage.clearSearches();
        await homePage.ensurePendingSidebarOpen();
        return homePage.waitForReady(Timeouts.MEDIUM);
      }

      if (isPreAuth(path)) {
        throw new Error(
          `returnToHome(): the app is on "${path}", which is the login gate rather than a screen ` +
            `to navigate away from. The session was lost mid-run — call ensureLoggedIn() instead; ` +
            `signing in from a recovery helper would let a spec that lost its session pass.`,
        );
      }

      if (isPaymentSuccess(path)) {
        await leavePaymentSuccess();
        continue;
      }

      if (isCheckout(path)) {
        await leaveCheckout();
        continue;
      }

      if (!hasHeaderNav(path)) {
        throw new Error(
          `returnToHome(): "${path}" renders no header nav and no exit this flow knows. ` +
            `header-left.tsx gives split-order its own bar; drive that screen's own way out ` +
            `(finish or void the split) before handing control back.`,
        );
      }

      // A dirty settings form blocks the router with a leave guard — possibly
      // already up from the case that failed. Discard it on either side of the hop.
      // A guard already up is on screen at once, so a short look is enough; one
      // the logo click raises blocks goHome's path wait, so it is handled there.
      // (Two full SHORT probes here cost ~10s on every settings test's way home.)
      if (!path.startsWith(Routes.SETTINGS)) {
        // A modal the failed case left open (Adjust Tip on order history, …)
        // sits over the logo: 13 recoveries in one full run died on exactly that.
        await homePage.dismissOpenDialogs();
        await appNav.goHome();
        continue;
      }
      await settingsPage.confirmLeaveGuardIfShown(Timeouts.ANIMATION);
      try {
        await appNav.goHome();
      } catch (error) {
        if (!(await settingsPage.confirmLeaveGuardIfShown(Timeouts.ANIMATION))) throw error;
      }
    }

    throw new Error(
      `returnToHome(): still not on ${Routes.HOME} after ${String(MAX_HOPS)} screens — last seen ` +
        `"${await appNav.currentPath()}". Something is bouncing the router; read the step log for ` +
        `the order the screens came in.`,
    );
  });
}

/**
 * Open the order-history list.
 *
 * Reached through the header's own quick-nav link, which exists on every screen
 * that has a header at all. From a screen that has none (checkout,
 * payment-success, split-order) it returns to the till first — the header is
 * where the link lives, so there is no shorter route.
 *
 * Already anywhere under `/order-history` counts as arrived, the detail pane
 * included: `/order-history` is a TanStack layout route, so the list stays
 * mounted beside `$orderId.tsx` and every {@link OrderHistoryPage} method keeps
 * working. Re-navigating would only throw away the row a spec just opened.
 */
export async function goToOrderHistory(): Promise<OrderHistoryPage> {
  return step('Go to order history', async () => {
    await ensureHeaderNav();

    if (!(await orderHistoryPage.isActive())) {
      await appNav.goToOrderHistory();
    }

    // Order History is a permission-gated screen on some merchants: opening it
    // raises the "Enter staff code to access Order History" guard, a modal that
    // covers the header and the search box. Left unanswered it surfaces
    // downstream as the misleading pair "search input never became ready" (the
    // readyAnchor is behind the overlay) and a header logo that no longer takes
    // a click. Satisfy it the way every other gated screen does — one unlock per
    // run, then a cached 30-minute grant — before waiting on the page itself.
    await passcodeDialog.unlockForRun(env.STAFF_PASSCODE);

    return orderHistoryPage.waitForReady(Timeouts.MEDIUM);
  });
}

/**
 * Open settings, on `/settings/business`.
 *
 * The sidebar is the only way in — the header quick-nav carries order history
 * and appointments and nothing else — and the sidebar's own entry points at
 * `/settings/business` rather than `/settings`, which is moot either way:
 * `settings/index.tsx` is a `beforeLoad` redirect onto exactly that screen.
 *
 * Switch sub-screens with `settingsPage.openSection()`; being on any of them
 * already counts as arrived, so this will not walk a spec back to Business
 * halfway through.
 */
export async function goToSettings(): Promise<SettingsPage> {
  return step('Go to settings', async () => {
    await ensureHeaderNav();

    if (!(await settingsPage.isActive())) {
      await appNav.openSidebarLink(Routes.SETTINGS_BUSINESS);
    }

    // Merchant Settings is a permission-gated area on some merchants (20258 does
    // this): opening it raises the "Enter staff code to access Merchant Settings"
    // guard, a modal that covers the sub-nav rail. Left unanswered it surfaces
    // downstream as `settingsPage.openSection()` finding the section link "still
    // not clickable" — the link is behind the overlay, not missing. Satisfy it the
    // way `goToOrderHistory` does: one unlock per run, then a cached 30-minute
    // grant. Settings is owner-gated, so it takes OWNER_PASSCODE.
    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);

    return settingsPage.waitForReady(Timeouts.MEDIUM);
  });
}

/**
 * Is this passcode gate switched ON in Settings → Accessibility → Passcode Setting?
 *
 * A gate test only means something while its gate is on. With it off the app
 * opens the screen straight away BY DESIGN — `resolvePasscodeBypass` in
 * volt-pos `use-passcode-verification.ts` (per-gate settings, app #2618) — and a
 * missing prompt would read as a regression it is not. Ends back on the till.
 */
export async function isPasscodeGateOn(gate: PasscodeGate): Promise<boolean> {
  return step(`Read the "${gate}" passcode gate`, async () => {
    await goToSettings();
    await settingsPage.openSection('ACCESSIBILITY');
    await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
    const on = await accessibilitySettingsPage.isGateOn(gate);
    await returnToHome();
    return on;
  });
}

/**
 * Make sure a passcode gate is ON before a spec that asserts its prompt — a
 * leftover OFF from another spec (or a Portal change) would otherwise read as
 * "the guard is gone". Saves only when it had to flip it. Ends back on the till.
 */
export async function ensurePasscodeGateOn(gate: PasscodeGate): Promise<boolean> {
  return step(`Ensure the "${gate}" passcode gate is ON`, async () => {
    await goToSettings();
    await settingsPage.openSection('ACCESSIBILITY');
    await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
    const was = await accessibilitySettingsPage.isGateOn(gate);
    if (!was) {
      await accessibilitySettingsPage.applyGates({ [gate]: true });
      // Fail here, by name, rather than later as "the prompt never appeared".
      if (!(await accessibilitySettingsPage.isGateOn(gate))) {
        throw new Error(
          `The "${gate}" passcode gate is OFF and could not be switched ON in Passcode Setting.`,
        );
      }
    }
    await returnToHome();
    return was;
  });
}

/**
 * Arm one gate for a test that asserts its prompt: the gate switched ON (another
 * spec or a Portal change may have left it off) AND the run's 30-minute grant
 * dropped — either one alone lets the app skip the prompt by design. Ends back on
 * the till. The caller re-seeds the grant afterwards with `ensurePasscodeGrant()`.
 */
export async function armPasscodeGate(gate: PasscodeGate): Promise<void> {
  await ensurePasscodeGateOn(gate);
  await clearPasscodeGrant();
}

/* --------------------------------------------------------------------- *
 * Internals
 * --------------------------------------------------------------------- */

/**
 * Guarantee a screen whose header carries the nav, returning to the till if not.
 *
 * The header link and the hamburger are both absent on checkout, split-order and
 * payment-success, and on checkout the back button impersonates the hamburger
 * (same `aria-label`), so "just click it" would navigate somewhere unrelated
 * rather than fail. Going home first is the only move that works from all three.
 */
async function ensureHeaderNav(): Promise<void> {
  if (hasHeaderNav(await appNav.currentPath())) return;
  await returnToHome();
}

/** Decline the receipt, which is the only exit the payment-success screen offers. */
async function leavePaymentSuccess(): Promise<void> {
  await paymentSuccessPage.waitForReady(Timeouts.MEDIUM);
  await paymentSuccessPage.continueToNextOrder();
  await paymentSuccessPage.waitForFlowToEnd();
}

/**
 * Sign on the customer display when the till waits for it. Returns whether that
 * let the till go (it moves on to payment-success).
 *
 * A card payment that went through but whose spec died before the customer
 * signed parks the till on "Payment Successful! Customer is adding signature.
 * Please wait…" — a modal with no button over the back arrow; only the customer
 * display releases it. One launch group of a full run spent every remaining test
 * on that screen. Launch mode only: an attached session cannot reach the customer
 * window.
 */
async function signToReleaseTill(): Promise<boolean> {
  const waiting = await browser.execute(function () {
    return Array.from(document.querySelectorAll('[data-slot="dialog-content"],[role="dialog"]')).some(
      function (el) {
        return /adding (a )?signature|chữ ký/i.test(el.textContent || '');
      },
    );
  });
  if (!waiting || env.MODE === 'attach') return false;
  try {
    await customerDisplayPage.signAndContinue();
    await waitUntilPath((path) => !isCheckout(path), {
      timeout: Timeouts.NAVIGATION,
      message: 'Signing on the customer display did not release the till',
    });
    return true;
  } catch {
    return false; // the back arrow attempt below reports the stuck screen
  }
}

/**
 * Back out of checkout, leaving the draft order intact.
 *
 * Deliberately does NOT delete the draft. A recovery helper that discarded an
 * order would destroy the evidence of whatever just failed, and `/home` shows
 * the draft to whoever looks next — which is the honest hand-off. A spec that
 * wants the till empty calls `homePage.deleteOrder()` itself, as
 * `create-order.spec.ts` does.
 */
async function leaveCheckout(): Promise<void> {
  // A spec that failed mid-tip leaves the modal tip-wait dialog over the back button.
  await checkoutPage.cancelCustomerTipWaitIfShown();
  // Paid, but the customer never signed: the till is past checkout already.
  if (await signToReleaseTill()) return;
  await checkoutPage.pressBack();
  await waitUntilPath((path) => !isCheckout(path), {
    timeout: Timeouts.NAVIGATION,
    message: 'The checkout back button did not leave the checkout screen',
  });
}
