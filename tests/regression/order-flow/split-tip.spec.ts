/**
 * Split Tip across staff — pending on a fixture a single run cannot build.
 *
 * Every case here needs a settled order that has (a) MORE THAN ONE staff and
 * (b) a tip on it. The tip is collected on the customer display during checkout,
 * which is a dual-window, tip-after-payment flow the suite does not script in one
 * pass, and a two-staff order has to be composed by hand (select staff, add a
 * line, select a second staff, add another). Until a helper builds that fixture,
 * these stay pending — the page object is ready: `orderHistoryDetailPage`
 * exposes `openSplitTip()`, `chooseSplitMethod('evenly'|'proportion'|'manual')`
 * and `confirmSplitTip()`.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (verified live 2026-09-03,
 * not yet ported to a suite lane):
 *   - TC-ORDERFLOW-34  Split Tip hidden on a single-staff order
 *   - TC-ORDERFLOW-35  Split Evenly divides the tip equally
 *   - TC-ORDERFLOW-36  Proportion divides by each staff's service share
 *   - TC-ORDERFLOW-37  Manual makes each staff's amount editable
 *   - TC-ORDERFLOW-38  the dialog shows Total Tip + three tabs + Confirm
 */

import { title } from '../../../src/types/testTags.js';

describe('Order flow — Split Tip', () => {
  it(title('TC-ORDERFLOW-34: Split Tip hidden on a single-staff order — PENDING (needs 2-staff + tip)'));

  it(title('TC-ORDERFLOW-35: Split Evenly divides equally — PENDING (needs 2-staff order + tip)'));

  it(title('TC-ORDERFLOW-36: Proportion divides by service share — PENDING (needs 2-staff order + tip)'));

  it(title('TC-ORDERFLOW-37: Manual makes each amount editable — PENDING (needs 2-staff order + tip)'));

  it(title('TC-ORDERFLOW-38: dialog shows Total Tip + three tabs + Confirm — PENDING (needs the fixture)'));
});
