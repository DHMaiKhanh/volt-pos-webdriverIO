/**
 * REFUND / PARTIAL REFUND — spec + regression guards from
 * docs/screens/order-flow/payment-flows-test-cases.md §4.
 *
 * Refund is a **Settled-only** action, and a settle happens at the overnight batch
 * close. §9 decision (b): we do NOT wait for it or seed one — we FILTER Order
 * History for a Settled order and act on it ({@link openSettledOrderOrSkip}).
 *
 * ## Two describe blocks, by what they need
 *
 *   - **Gating (unsettled)** builds an order this run can make and proves Refund is
 *     NOT offered on it (RFD-01, the Settled precondition).
 *   - **Settled dialog** finds a Settled order and READS its refund dialog without
 *     confirming — the autofill (RFD-02). A refund that actually moves money is
 *     behind `REFUND_SETTLE=1` (RFD-EXEC); off by default so a regression pass
 *     never refunds a real order.
 *
 * Pending, each with its reason:
 *   - RFD-03 (🌙) refund-on-discounted-price needs a DISCOUNTED settled order.
 *   - RFD-04 (🌙💳) Auth+Tip vs Sale tip rules need a card order of each kind.
 *   - RFD-05 (💳) "Gift Card is not a refund method" needs a settled gift-card order.
 *   - RFD-06 (🔌) multi-partial → Refunded / fail → Refund Issue — fault-injection, OUT OF SCOPE.
 *   - RFD-R1 (🌙, VP-4051) edit-after-refund needs a partially-refunded order.
 *   - RFD-R2 (🌙, VP-3109) POS↔P8D "Refunding" sync is cross-system.
 *   - RFD-R3 (🌙, VP-3342) refund-shows-on-its-day needs a date-range nav the list has no locator for.
 *   - RFD-R4 (🌙, VP-3335) service-tax-everywhere needs a refunded order + receipt read.
 *
 * CREATES DATA: the gating block settles one cash order. The settled block is
 * read-only unless REFUND_SETTLE=1, which issues a REAL refund. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage, orderHistoryDetailPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { createAndSettleCashOrder } from './payment-flows.helpers.js';

describe('Payment flows — Refund gating (unsettled)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await createAndSettleCashOrder();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title('Refund is not offered on a Successful - Unsettled order (RFD-01)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      // Refund requires Settled; the unsettled order offers Cancel / Re-Open instead.
      // The "card not batched → disable + alert" half needs a settled card order and
      // needs a settled card order, not here.
      expect(await orderHistoryDetailPage.isRefundAvailable()).toBe(false);
    },
  );
});

// RFD-02 (All = full amount, locked) and RFD-EXEC (full refund completes) run as
// volt-qc/oh-reopen/oh-refund OH-131 / OH-140.
describe('Payment flows — Refund on a settled order', () => {
  it(
    title(
      'RFD-03: refund on the discounted price, promotion preserved — PENDING 🌙 (needs a discounted settled order)',
    ),
  );

  it(
    title(
      'RFD-04: Auth+Tip refunds base only; Sale refunds Amount+Tip — PENDING 🌙💳 (needs card Auth / Sale orders)',
    ),
  );

  it(title('RFD-05: Gift Card is never a refund method — PENDING 💳 (needs a settled gift-card order)'));

  it(
    title(
      'RFD-06: multi-partial → Refunded; card fail → Refund Issue — PENDING 🔌 OUT OF SCOPE (fault-injection, §9a)',
    ),
  );

  it(
    title(
      'RFD-R1 (VP-4051): a refunded service is still editable — PENDING 🌙 (needs a partially-refunded order)',
    ),
  );

  it(
    title(
      'RFD-R3 (VP-3342): refund appears in Order History on its refund day — PENDING 🌙 (needs date-range nav, no locator yet)',
    ),
  );

  it(
    title(
      'RFD-R4 (VP-3335): service tax correct in cancel/refund/history/receipt — PENDING 🌙 (needs a refunded order + receipt read)',
    ),
  );
});
