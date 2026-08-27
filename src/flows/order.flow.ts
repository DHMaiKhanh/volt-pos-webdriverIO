import { assertWritesAllowed } from '../../configs/env/loadEnv.js';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { Routes } from '../constants/routes.js';
import { step } from '../helpers/steps.js';
import { homePage } from '../pages/index.js';
import type { ServiceRef, StaffRef } from '../types/models.js';

/**
 * Building an order on the till.
 *
 * One flow, because one sequence covers every write spec in the suite: put a
 * staff member on the order, add a line, press Pay. Everything downstream —
 * cash, card, gift card, split, refund — starts from that and is driven by
 * `checkout.flow.ts`.
 */

export interface CreateOrderInput {
  /**
   * Who the line is booked to. Omitted, the first tile in the panel is used —
   * fine when the order is the subject, wrong when the spec asserts on a person
   * (tile order follows the merchant's sort setting).
   */
  staff?: StaffRef;
  /** What to sell. Omitted, the first tile in the service panel is used. */
  service?: ServiceRef;
}

export interface CreatedOrder {
  /** The order's UUID, as the checkout URL carries it. */
  orderId: string;
}

/**
 * Create a draft order and take it to checkout.
 *
 * Returns the order's UUID — read off `/order/{id}/checkout`, which is the only
 * place the app publishes it. The `checkout-order-id` element shows the human
 * ORDER CODE (`#1042`), and every route and assertion downstream needs the uuid.
 *
 * ## Where this leaves the app
 *
 * On the checkout screen, ready for a `checkout.flow.ts` call. It deliberately
 * does not return home: a spec that wants to abandon the order presses back /
 * deletes it explicitly, so an accidental navigation can never silently discard
 * a draft the spec was about to assert on.
 *
 * ## What it assumes
 *
 * An EMPTY till. Adding a service to a draft that already has lines appends to
 * it, which is the app's real behaviour and not something this flow tries to
 * undo — `home-order-delete-btn` only exists while a draft is open, so probing
 * for it would cost a full timeout on every clean run. Start from
 * `ensureLoggedIn()` or from `paymentSuccessPage.continueToNextOrder()`.
 */
export async function createOrder(input: CreateOrderInput = {}): Promise<CreatedOrder> {
  // First statement in the flow, before a single click: a production build talks
  // to the live gateway and pushes every row upstream, so an order created there
  // is a real one on a real merchant's books.
  assertWritesAllowed('create an order');

  return step('Create an order', async () => {
    if (!(await homePage.isActive())) {
      throw new Error(
        `createOrder(): the app is on "${await homePage.currentPath()}", not ${Routes.HOME}. ` +
          `Flows never navigate by URL (it reloads the WebView and re-runs the splash boot), so ` +
          `call ensureLoggedIn() in the before hook and end each order before starting the next.`,
      );
    }
    await homePage.waitForReady(Timeouts.MEDIUM);

    await addStaff(input.staff);
    await addService(input.service);

    const checkout = await homePage.pressPay();
    return { orderId: await checkout.orderId() };
  });
}

/**
 * Put a staff member on the order.
 *
 * A named staff member is searched for first. Both tile grids run
 * `@tanstack/react-virtual`, so only the rows near the scroll position are
 * mounted: addressing a tile by id works for whoever happens to be on screen and
 * fails for everyone else, on a merchant with a long directory, in a way that
 * looks like a missing testid. Narrowing the list is what makes the id reliable.
 */
async function addStaff(staff?: StaffRef): Promise<void> {
  if (!staff) {
    await homePage.selectFirstStaff();
    return;
  }

  requireId(staff.id, 'staff', staff.nickname);
  if (staff.nickname !== '') await homePage.searchStaff(staff.nickname);
  await homePage.selectStaff(staff.id);
}

/** Add one line to the order. Same virtualization caveat as {@link addStaff}. */
async function addService(service?: ServiceRef): Promise<void> {
  if (!service) {
    await homePage.addFirstService();
    return;
  }

  requireId(service.id, 'service', service.name);
  if (service.name !== '') await homePage.searchService(service.name);
  await homePage.addService(service.id);
}

/**
 * Reject a reference with no id before it reaches a locator.
 *
 * An empty id builds `[data-testid="staff-item-"]`, which matches nothing, and
 * the failure then reads as "the app does not expose this testid" — pointing at
 * the app team for what is an unset environment variable in the runner's own
 * `.env`. The static fixtures under `src/data/static/` are the usual source.
 */
function requireId(id: string, kind: 'staff' | 'service', label: string): void {
  if (id !== '') return;
  throw new Error(
    `createOrder() was given a ${kind} reference with an empty id` +
      (label === '' ? '' : ` (${label})`) +
      `. Set the matching id in configs/env/.env.<ENV> — see src/data/static/${kind === 'staff' ? 'staff' : 'services'}.ts ` +
      `for the variable name and how to look the value up — or omit the reference to use the first tile.`,
  );
}
