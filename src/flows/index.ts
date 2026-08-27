/**
 * The flow barrel.
 *
 * ## What a flow is
 *
 * A business action that spans more than one screen — "sign in", "create an
 * order", "pay it in cash". Flows call page objects; specs call flows. The two
 * rules that keep the layer worth having:
 *
 * - **A flow contains no selector.** If a flow needs an element, the page object
 *   is missing a method. That is what keeps 157 testids in one catalogue instead
 *   of scattered through business logic.
 * - **A flow does not assert.** It acts, and it fails loudly when the app cannot
 *   do what was asked. Deciding whether the RESULT is correct belongs to the
 *   spec, which is the only place a reader looks for the intent of a test.
 *
 * ## Why every write flow opens with `assertWritesAllowed()`
 *
 * A production build talks to the live payment gateway and pushes every local
 * row upstream through `/syncing/pushing`. A checkout flow run there does not
 * simulate a sale, it makes one. The guard throws rather than skips, so a lane
 * that was never covered cannot read as a pass.
 *
 * Types stay with their module, as they do in the page and component barrels: a
 * spec that needs `BootResult` imports it from `./auth.flow.js`.
 */

export { bootApp, ensureLoggedIn } from './auth.flow.js';
export type { BootResult, BootScreen } from './auth.flow.js';

/**
 * Moving between screens. The only flows with no write rail — navigating
 * creates nothing — which is what lets the smoke suite and the root hooks call
 * them against a production till.
 */
export { goToOrderHistory, goToSettings, returnToHome } from './navigation.flow.js';

export { createOrder } from './order.flow.js';
export type { CreatedOrder, CreateOrderInput } from './order.flow.js';

export { payInCash, payWithCard, payWithGiftCard } from './checkout.flow.js';
export type { CashTender } from './checkout.flow.js';
