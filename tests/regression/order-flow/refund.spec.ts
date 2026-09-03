/**
 * Refund and Partial Refund — pending on a SETTLED order the suite cannot make.
 *
 * The Refund action mounts only on a "Successful - Settled" order
 * (`order-history-detail-actions.tsx`), and settlement is a batch close that
 * happens on the NEXT merchant day for cash / gift-card / other, while card needs
 * a physical terminal. So no order created in a run reaches the state these
 * cases need — the doc's own live-verify notes hit exactly this wall
 * (order-flow-test-cases.md §7, "Refund dialog ... VẪN chưa verify").
 *
 * The path forward is documented there: let a throwaway cash order settle
 * overnight, then run these against that pre-existing order id (pass it via an
 * env var and open it with `orderHistoryPage.openOrder(id)`). The page object is
 * ready — `orderHistoryDetailPage.refundFully()` / `refundPartially()` and the
 * `readRefundAmount()` reader — so only the fixture is missing.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-60  an un-batched credit transaction disables Refund + alerts
 *   - TC-ORDERFLOW-61  All services = full refund, amount autofills the total
 *   - TC-ORDERFLOW-62  a subset = partial refund, amount autofills the pro-rated price
 *   - TC-ORDERFLOW-63  the dialog exposes service / method / amount / reason
 */

import { title } from '../../../src/types/testTags.js';

describe('Order flow — Refund', () => {
  it(title('TC-ORDERFLOW-60: un-batched credit disables Refund — PENDING (needs a settled order)'));

  it(
    title('TC-ORDERFLOW-61: All services = full refund, autofilled total — PENDING (needs a settled order)'),
  );

  it(title('TC-ORDERFLOW-62: subset = partial refund, pro-rated amount — PENDING (needs a settled order)'));

  it(title('TC-ORDERFLOW-63: dialog exposes service/method/amount/reason — PENDING (needs a settled order)'));
});
