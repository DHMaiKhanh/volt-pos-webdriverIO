/**
 * Re-open Order — pending.
 *
 * Re-open IS offered on the unsettled order this suite can build (asserted in
 * order-detail-actions.spec.ts, TC-ORDERFLOW-55), but every case below asserts
 * the CONSEQUENCES of confirming a re-open — the once-per-order limit, the "Void
 * all" affordance, the fields that stay locked to the pre-reopen version. Each
 * one mutates the order heavily and irreversibly (it is removed from every report
 * until re-completed) and depends on state a confirmed re-open leaves behind, so
 * these are not run against a live merchant as a side effect of coverage. The
 * doc marks them `[LINEAR-ONLY]` for the same reason.
 *
 * The page object is ready for a dedicated, isolated fixture:
 * `orderHistoryDetailPage.openReopenDialog()` / `confirmReopen(orderId)`.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-65  re-open is allowed only once
 *   - TC-ORDERFLOW-66  the button reads "Continue Re-open" while one is in progress
 *   - TC-ORDERFLOW-67  "Void all" replaces per-transaction voids
 *   - TC-ORDERFLOW-68  Discount/Tax stay locked; Service fee/Cashback recompute
 */

import { title } from '../../../src/types/testTags.js';

describe('Order flow — Re-open Order', () => {
  it(title('TC-ORDERFLOW-65: re-open allowed only once — PENDING (LINEAR-ONLY, mutating)'));

  it(title('TC-ORDERFLOW-66: button reads "Continue Re-open" mid-flow — PENDING (LINEAR-ONLY, mutating)'));

  it(title('TC-ORDERFLOW-67: "Void all" replaces per-transaction voids — PENDING (LINEAR-ONLY, mutating)'));

  it(title('TC-ORDERFLOW-68: Discount/Tax locked, fee/cashback recompute — PENDING (LINEAR-ONLY, mutating)'));
});
