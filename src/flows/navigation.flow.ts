import { Timeouts } from '../../configs/constants/timeouts.js';
import { appNav, hasHeaderNav } from '../components/index.js';
import { Routes } from '../constants/routes.js';
import { step } from '../helpers/steps.js';
import { waitUntilPath } from '../helpers/wait.js';
import {
  checkoutPage,
  homePage,
  orderHistoryPage,
  paymentSuccessPage,
  settingsPage,
} from '../pages/index.js';
import type { HomePage, OrderHistoryPage, SettingsPage } from '../pages/index.js';

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

      if (path.startsWith(Routes.HOME)) return homePage.waitForReady(Timeouts.MEDIUM);

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

      await appNav.goHome();
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
    return settingsPage.waitForReady(Timeouts.MEDIUM);
  });
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
 * Back out of checkout, leaving the draft order intact.
 *
 * Deliberately does NOT delete the draft. A recovery helper that discarded an
 * order would destroy the evidence of whatever just failed, and `/home` shows
 * the draft to whoever looks next — which is the honest hand-off. A spec that
 * wants the till empty calls `homePage.deleteOrder()` itself, as
 * `create-order.spec.ts` does.
 */
async function leaveCheckout(): Promise<void> {
  await checkoutPage.pressBack();
  await waitUntilPath((path) => !isCheckout(path), {
    timeout: Timeouts.NAVIGATION,
    message: 'The checkout back button did not leave the checkout screen',
  });
}
