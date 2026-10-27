/**
 * Shared steps for reopen-flow.spec.ts — carrying a Re-Open Order out for real.
 *
 * NOT a spec (`*.helpers.ts`). Source of the behaviour: `volt-pos` branch
 * `feat/VP-2585` — see docs/screens/order-flow/reopen-test-cases.md §2.
 *
 * ## Why leaving a reopened checkout needs its own helper
 *
 * With `?editOrderId` in the URL, `header-left.tsx` renders ONLY the
 * "Edit Order" link — no back arrow — so `returnToHome()` (which leaves checkout
 * through the arrow) cannot get off this screen. The app's own exits are:
 *   - "Re-Open Done" (nothing owed) → cancels the reopen, lands on `/order-history/{id}`;
 *   - "Edit Order" → `/home?editOrderId=…`, which does have the header quick-nav.
 * {@link leaveReopenCheckout} takes whichever applies.
 *
 * The Home editor (`/home?editOrderId`) is no way out either: `HeaderLeft` swaps the
 * hamburger, logo and quick-nav for `HeaderReOpenOrder`, so there is no Order
 * History link. A cashier "walks away" from a reopen only by closing the app;
 * {@link abandonReopen} stands in for that with a router `history.back()`.
 */

import { browser } from '@wdio/globals';
import { env } from '../../../configs/env/loadEnv.js';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { passcodeDialog } from '../../../src/components/index.js';
import { Routes } from '../../../src/constants/routes.js';
import { goToOrderHistory } from '../../../src/flows/index.js';
import { waitUntilPath } from '../../../src/helpers/wait.js';
import {
  checkoutPage,
  homePage,
  orderHistoryDetailPage,
  orderHistoryPage,
} from '../../../src/pages/index.js';

/** Dialog sentence while the order still has its one money-edit (VP-3914). */
export const REOPEN_EDIT_AVAILABLE = 'One edit of items, prices left';
/** Dialog sentence once the money-edit was spent (VP-3913). */
export const REOPEN_EDIT_USED_UP = 'Items and prices are locked';
/** Action label while an order sits in `re_open`. */
export const CONTINUE_REOPEN = 'Continue Re-open';

const CHECKOUT_PATH = /^\/order\/[^/]+\/checkout$/;

/** Open one order's detail pane from anywhere that has a header. */
export async function openOrderDetail(orderId: string): Promise<void> {
  await goToOrderHistory();
  await orderHistoryPage.openOrder(orderId);
  await orderHistoryDetailPage.waitForOrder(orderId);
}

/** Open the re-open dialog on the current detail pane and return its full text. */
export async function readReopenDialog(): Promise<string> {
  await orderHistoryDetailPage.openReopenDialog();
  return orderHistoryDetailPage.readReopenDialogText();
}

/**
 * Confirm a re-open from the detail pane and wait for the reopened checkout.
 *
 * Opens the dialog if it is not already up, presses Confirm, answers the
 * `reopen_order` passcode guard when the merchant has one, and waits for
 * `/order/{id}/checkout` (the `?editOrderId` query is stripped by `pathOf`).
 */
export async function reopenOrder(orderId: string): Promise<void> {
  if (!(await orderHistoryDetailPage.isReopenDialogShown())) {
    await orderHistoryDetailPage.openReopenDialog();
  }
  await orderHistoryDetailPage.pressReopenConfirm();
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
  await waitUntilPath((path) => path === Routes.CHECKOUT(orderId), {
    timeout: Timeouts.NAVIGATION,
    message: `Re-opening ${orderId} never reached checkout`,
  });
  await checkoutPage.waitForReady(Timeouts.MEDIUM);
}

/**
 * Press "Re-Open Done" and wait to land back on the order's detail pane.
 * Only valid while the reopened order owes nothing.
 */
export async function finishReopenUnchanged(orderId: string): Promise<void> {
  await checkoutPage.pressReopenDone();
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
  await waitUntilPath((path) => path === Routes.ORDER_HISTORY_DETAIL(orderId), {
    timeout: Timeouts.NAVIGATION,
    message: `"Re-Open Done" on ${orderId} never returned to its order-history detail`,
  });
  await orderHistoryDetailPage.waitForOrder(orderId);
}

/** Follow the reopened checkout's "Edit Order" link to the Home editor. */
export async function goToReopenEditor(): Promise<void> {
  await checkoutPage.pressEditOrder();
  await waitUntilPath((path) => path.startsWith(Routes.HOME), {
    timeout: Timeouts.NAVIGATION,
    message: '"Edit Order" did not open the Home editor',
  });
}

/**
 * Walk away from a reopened checkout without finishing it — the state a cashier
 * leaves behind by closing the app mid-reopen. The order stays `re_open`.
 *
 * The checkout was pushed from `/order-history/{id}`, so one `history.back()`
 * (the same call the normal checkout back arrow makes) lands on its detail pane.
 */
export async function abandonReopen(orderId: string): Promise<void> {
  await browser.execute(() => {
    window.history.back();
  });
  await waitUntilPath((path) => path === Routes.ORDER_HISTORY_DETAIL(orderId), {
    timeout: Timeouts.NAVIGATION,
    message: `history.back() from the reopened checkout did not return to ${orderId}'s detail`,
  });
  await orderHistoryDetailPage.waitForOrder(orderId);
}

/**
 * Best-effort cleanup for an `after` hook: if a run died on a reopened checkout,
 * close the reopen ("Re-Open Done") or walk off it through "Edit Order" so the
 * next spec's `returnToHome()` does not hit an arrow-less header.
 */
export async function leaveReopenCheckout(orderId: string): Promise<void> {
  // Parked on the Home editor: Pay brings back the reopened checkout.
  if ((await browser.getUrl()).includes('editOrderId') && (await homePage.isActive())) {
    await homePage.pressPay();
  }
  if (!CHECKOUT_PATH.test(await checkoutPage.currentPath())) return;
  if (await checkoutPage.isReopenDoneShown()) {
    await finishReopenUnchanged(orderId);
    return;
  }
  if (await checkoutPage.isEditOrderLinkShown()) await goToReopenEditor();
}
