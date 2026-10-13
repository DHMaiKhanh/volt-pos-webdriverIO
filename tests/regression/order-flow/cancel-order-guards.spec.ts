/**
 * CANCEL ORDER — spec + regression guards from
 * docs/screens/order-flow/payment-flows-test-cases.md §3.
 *
 * Cancel is only offered on a **Successful - Unsettled** order; it voids every
 * payment, flips the order to Canceled (grey), and demands a staff code plus a
 * reason. This file builds that unsettled order in a cash settle and drives the
 * cancel DIALOG — it never confirms, because confirming voids a real payment
 * behind the passcode guard and leaves a dead order in history.
 *
 * ## What runs here, and what cannot
 *
 *   - CAN-01 (SPEC, ✅) the cancel dialog warns "all payments will be voided" and
 *     makes a reason mandatory — opened and read, not submitted.
 *
 * The rest are pending by construction, each with its reason:
 *   - CAN-02 (💳) gift-card auto-restore needs a gift-card settle + a real cancel.
 *   - CAN-03 (🔌) "Cancel Issue" needs a payment-cancel FAILURE injected — OUT OF
 *     SCOPE per §9 decision (a).
 *   - CAN-R1 (💳, VP-3727) needs an order paid by MULTIPLE gift cards, then cancelled.
 *   - CAN-R2 (🌙, VP-3374) POS↔P8D status sync is cross-system — the POS attach
 *     lane cannot observe the P8D side.
 *   - CAN-R3 (🌙, VP-3278) needs a batch-close running mid-cancel + an income read.
 *   - CAN-R4 (🌙, VP-4037, shared with ROP-R10) needs a Canceled order and an
 *     Edit-Order locator the catalogue does not carry yet.
 *
 * CREATES DATA AND TAKES A PAYMENT: one settled cash order is left in history
 * (the cancel dialog is opened but never confirmed). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage, orderHistoryDetailPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { createAndSettleCashOrder } from './payment-flows.helpers.js';

describe('Payment flows — Cancel Order', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await createAndSettleCashOrder();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title(
      'Cancel warns all payments will be voided and requires a reason (CAN-01)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      // Cancel is an unsettled-only action; it must be offered on this order.
      expect(await orderHistoryDetailPage.isCancelAvailable()).toBe(true);

      await orderHistoryDetailPage.openCancelDialog();
      expect(await orderHistoryDetailPage.isCancelDialogShown()).toBe(true);

      // The spec's core warning: cancelling voids every payment. Match it in a
      // case-insensitive, locale-tolerant way (en: "All payments will be voided").
      const body = (await orderHistoryDetailPage.readCancelDialogText()).toLowerCase();
      expect(body).toContain('void');

      // A reason is mandatory — the select is present and selectable.
      await orderHistoryDetailPage.chooseCancelReason('customer_request');

      // Do NOT confirm: the real void runs behind the passcode guard and would
      // leave a cancelled order in history. Opening + reading is the coverage.
      await orderHistoryDetailPage.closeCancelDialog();
      expect(await orderHistoryDetailPage.isCancelDialogShown()).toBe(false);
    },
  );

  it(
    title(
      'CAN-02: Gift Card cancel auto-restores balance — PENDING 💳 (needs a gift-card settle + real cancel)',
    ),
  );

  it(title('CAN-03: 1 payment cancel fails → Cancel Issue — PENDING 🔌 OUT OF SCOPE (fault-injection, §9a)'));

  it(
    title(
      'CAN-R1 (VP-3727): multi gift-card cancel restores wrong balance — PENDING 💳 (multi-gift-card settled order)',
    ),
  );

  it(
    title(
      'CAN-R2 (VP-3374): POS Canceled while P8D still Canceling — PENDING 🌙 (cross-system, P8D not observable from POS)',
    ),
  );

  it(
    title(
      'CAN-R3 (VP-3278): order stuck Canceling on batch-close race, income still counts — PENDING 🌙 (batch-close race + income read)',
    ),
  );

  it(
    title(
      'CAN-R4 (VP-4037): Edit Order still allowed while Cancel — PENDING 🌙 (needs Canceled order + Edit-Order locator)',
    ),
  );
});
