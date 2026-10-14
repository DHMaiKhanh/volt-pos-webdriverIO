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
import { env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/index.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage, orderHistoryDetailPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  createAndSettleCashOrder,
  openSettledOrderOrSkip,
  REFUND_SETTLE_ENABLED,
} from './payment-flows.helpers.js';

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
      // is covered by RFD-EXEC's precondition, not here.
      expect(await orderHistoryDetailPage.isRefundAvailable()).toBe(false);
    },
  );
});

describe('Payment flows — Refund on a settled order', () => {
  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title('The refund dialog autofills the full amount for "All" (RFD-02)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const { detail } = await openSettledOrderOrSkip(this);

      expect(await detail.isRefundAvailable()).toBe(true);
      await detail.openRefundDialog();

      // Selecting All = Full Refund autofills the whole order; the amount field is
      // app-computed and disabled, so a populated, positive figure IS the assertion.
      await detail.selectAllRefundServices();
      expect(await detail.readRefundAmount()).toBeGreaterThan(0);

      // Read-only: do not confirm. Partial autofill (= selected service prices) needs
      // the order-item ids, which this list view does not surface — see RFD-03/R1.
      await detail.closeRefundDialog();
      expect(await detail.isRefundDialogShown()).toBe(false);
    },
  );

  it(
    title('A full refund on a settled order completes (RFD-EXEC)', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
    async function (this: Mocha.Context): Promise<void> {
      if (!REFUND_SETTLE_ENABLED) {
        // Decision (b) lets us refund a found Settled order, but a refund is
        // irreversible — only run it when an operator opts in with REFUND_SETTLE=1.
        this.skip();
      }
      this.timeout(Timeouts.MOCHA_HOOK);

      const { orderId, detail } = await openSettledOrderOrSkip(this);
      await detail.refundFully({ reason: 'customer_request' });

      // Confirm fires the `refund` passcode guard; answer it like every other
      // permission-gated mutation (the page layer leaves it to the flow/spec).
      await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);

      // The dialog closes and the order leaves the refundable state.
      await detail.waitForOrder(orderId);
      expect(await detail.isRefundDialogShown()).toBe(false);
    },
  );

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
      'RFD-R2 (VP-3109): P8D "Refunding" while POS Refunded — PENDING 🌙 (cross-system, P8D not observable)',
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
