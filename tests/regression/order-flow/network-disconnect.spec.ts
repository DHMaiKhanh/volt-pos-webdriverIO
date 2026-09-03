/**
 * Handling a network disconnect during a card payment — pending.
 *
 * Both cases require cutting the network mid-charge and then observing how "Try
 * again" reconciles a card transaction that may or may not have gone through.
 * That needs (a) a real card charge in flight — which needs a physical Bamboo DOT
 * terminal the test environment does not have — and (b) a controlled way to drop
 * and restore the app's connection to the gateway. The doc carries both as
 * `[LINEAR-ONLY]` for exactly this reason.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-52  a new card transaction appears on "Try again" → complete, no $0 txn
 *   - TC-ORDERFLOW-53  no new transaction → pay by another method, then reconcile in history
 */

import { title } from '../../../src/types/testTags.js';

describe('Order flow — Network disconnect', () => {
  it(title('TC-ORDERFLOW-52: new card txn on Try Again → complete — PENDING (LINEAR-ONLY, needs terminal)'));

  it(title('TC-ORDERFLOW-53: no new txn → other tender + reconcile — PENDING (LINEAR-ONLY, needs terminal)'));
});
