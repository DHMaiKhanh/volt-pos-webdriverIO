import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { pathOf, Routes } from '../../constants/routes.js';
import { appSidebarItem, CommonIds, headerMenuItem } from '../../constants/testids.js';
import { logStep } from '../../helpers/steps.js';
import { settle, waitUntilPath } from '../../helpers/wait.js';
import { UiObject } from '../../support/UiObject.js';

/**
 * The app chrome every authenticated screen shares: the header's left group and
 * the drawer behind its hamburger.
 *
 * ## Why this is not a `BaseComponent`
 *
 * A {@link BaseComponent} owns ONE subtree and scopes every lookup under it.
 * This owns two that are not nested: the header lives inside the `_app` layout,
 * while the sidebar is a Radix `Sheet` **portalled to `document.body`**. There
 * is no common root to scope to, and inventing one (`body`) would turn the
 * scoping guarantee into decoration. The two sidebar locators carry their own
 * `[data-slot="sidebar"]` scope instead, which is the part that actually
 * matters — see {@link appSidebarItem}.
 *
 * ## Why navigation needs a component at all
 *
 * Flows must not hold selectors and page objects must not reach outside their
 * own screen, so "get to order history from wherever we are" had nowhere to
 * live. It is chrome, and chrome is a component.
 *
 * ## The routes each entry point can actually reach
 *
 * The header quick-nav carries **order history and appointments only**
 * (`header-menu.tsx`). Everything else the suite drives — `/settings/*`,
 * `/incomes/*`, `/time-tracking`, `/batch-history` — is reachable **only**
 * through the sidebar, and `/home` only through the logo. That asymmetry is the
 * app's, not a gap here.
 */

/**
 * Does `path` render the full header nav — hamburger, logo, quick links?
 *
 * `header-left.tsx` swaps the whole left group per route: a checkout path gets a
 * lone back button (or nothing at all once the order is fully tendered), a
 * split-order path gets its own bar, and `header.tsx` hides the header outright
 * on payment-success. Every other authenticated screen renders the full set.
 *
 * Derived from the path rather than probed, because the app derives it the same
 * way — and because probing for an element that is legitimately absent burns a
 * full timeout on precisely the screens where a spec is already in trouble.
 *
 * ONE case this misses: an order re-opened from history carries `?editOrderId=`
 * and renders `HeaderReOpenOrder` on an otherwise ordinary path. Nothing in the
 * suite re-opens an order today; whatever does will have to read the query
 * string, which `pathOf()` strips.
 */
export function hasHeaderNav(path: string): boolean {
  return !path.includes('/checkout') && !path.includes('/split-order') && !path.includes('/payment-success');
}

export class AppNav extends UiObject {
  readonly name = 'App nav';

  /** Current URL path, origin and query stripped — same reading `BasePage` takes. */
  async currentPath(): Promise<string> {
    return pathOf(await browser.getUrl());
  }

  /* --------------------------------------------------------------------- *
   * Header
   * --------------------------------------------------------------------- */

  /**
   * Press the logo and land on the till.
   *
   * The logo is a TanStack `<Link to="/home">` (`header-logo.tsx`), i.e. a plain
   * `<a href="/home">` — the one piece of chrome in this app that is both always
   * present and immune to i18n. It is also the ONLY header route to `/home`.
   */
  async goHome(): Promise<void> {
    await logStep('Nav: home');
    await this.click(headerMenuItem(Routes.HOME));
    await waitUntilPath((path) => path.startsWith(Routes.HOME), {
      timeout: Timeouts.NAVIGATION,
      message: 'The header logo did not navigate to the till',
    });
  }

  /** Press the header's Order History link. */
  async goToOrderHistory(): Promise<void> {
    await logStep('Nav: order history');
    await this.click(headerMenuItem(Routes.ORDER_HISTORY));
    await waitUntilPath((path) => path.startsWith(Routes.ORDER_HISTORY), {
      timeout: Timeouts.NAVIGATION,
      message: 'The header Order History link did not navigate',
    });
  }

  /* --------------------------------------------------------------------- *
   * Sidebar
   * --------------------------------------------------------------------- */

  /** Is the drawer on screen? Radix unmounts it when closed, so this is unambiguous. */
  async isSidebarOpen(): Promise<boolean> {
    return this.isVisible(CommonIds.appSidebar, Timeouts.ANIMATION);
  }

  /**
   * Open the drawer, refusing the one screen where the button lies.
   *
   * On a checkout path the hamburger is replaced by a back button carrying the
   * SAME hardcoded `aria-label="Open sidebar"` (see
   * {@link CommonIds.sidebarToggle}), so pressing it there navigates away
   * instead of opening anything — and the failure would surface several steps
   * later as a missing sidebar link. Refusing up front names the real cause.
   */
  async openSidebar(): Promise<void> {
    if (await this.isSidebarOpen()) return;

    const path = await this.currentPath();
    if (!hasHeaderNav(path)) {
      throw new Error(
        `AppNav.openSidebar(): "${path}" renders no hamburger — header-left.tsx replaces the whole ` +
          `left nav on checkout / split-order paths and header.tsx hides the header on ` +
          `payment-success. Worse, the checkout back button reuses aria-label="Open sidebar", so ` +
          `pressing it here would leave the screen rather than fail. Return to a screen with the ` +
          `full nav first — returnToHome() knows how.`,
      );
    }

    await logStep('Nav: open the sidebar');
    await this.click(CommonIds.sidebarToggle);
    await this.find(CommonIds.appSidebar, { timeout: Timeouts.MEDIUM, visible: true });

    // The Sheet is hit-testable while it is still sliding in, so a link pressed
    // on the next line lands on a node that is about to move out from under it.
    await settle();
  }

  /**
   * Dismiss the drawer with Escape.
   *
   * Escape rather than the close button: `app-sidebar.tsx` renders that button
   * as a bare `variant="icon"` wrapping an `<Icon>`, which leaves nothing in the
   * DOM to address it by — `icon.tsx` inlines the SVG and drops the name.
   */
  async closeSidebar(): Promise<void> {
    if (!(await this.isSidebarOpen())) return;
    await browser.keys(['Escape']);
    await this.waitGone(CommonIds.appSidebar, Timeouts.MEDIUM);
  }

  /**
   * Open the drawer and follow one of its entries.
   *
   * The entry's own `onClick` runs `setOpen(false)`, so the drawer closes on its
   * own — waiting that out is what stops the caller's next click landing on the
   * overlay mid-exit. Waiting on the PATH first keeps the failure honest when
   * the link resolved but the route did not.
   */
  async openSidebarLink(path: string): Promise<void> {
    await this.openSidebar();

    await logStep(`Nav: sidebar → ${path}`);
    await this.click(appSidebarItem(path));

    await waitUntilPath((current) => current.startsWith(path), {
      timeout: Timeouts.NAVIGATION,
      message: `The sidebar entry for ${path} did not navigate`,
    });
    await this.waitGone(CommonIds.appSidebar, Timeouts.MEDIUM);
  }
}

/**
 * Shared instance.
 *
 * Chrome has no per-test identity: this object holds locators, and every call
 * re-resolves against the live DOM.
 */
export const appNav = new AppNav();
