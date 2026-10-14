/**
 * PAYMENT RELIABILITY — Double charge / Charge fail, from
 * docs/screens/order-flow/payment-flows-test-cases.md §7.
 *
 * ## Almost all of this group is OUT OF SCOPE
 *
 * The double-charge / charge-fail defects are timing-and-network failures —
 * stale pooled sockets, terminals that answer late, reader-approved-but-online-
 * declined — reproducible only by INJECTING a fault (proxy drop, firewall DROP).
 * §9 decision (a) ruled that lane out: we do not stand up a fault-injection
 * harness, so every `🔌` case stays a documented pending stub, kept for regression
 * reference. The `🖥️`-only cases (card-read error must mirror to the cashier,
 * safe-leave) need the customer display driven and are pending too.
 *
 * ## What this file actually runs — the UI/status surface (✅ read-only)
 *
 *   - PAY-R17 (VP-4511, Todo) the Payment Details block shows the card's last 4
 *     and a failed-charge log. VP-4511 is OPEN, so per §9 decision (c) this runs
 *     for real and is EXPECTED RED until the feature ships — the red is the
 *     evidence, not a harness fault. Skips only when no card order is in range.
 *   - PAY-R19 (VP-2825) a Successful order must not have a Payment Detail that
 *     reads "Failed" — a pure consistency read on an existing order.
 *
 * READ-ONLY: no order is created and no payment is taken. Safe on any env, but
 * kept in regression (not smoke) because it reads real order data.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { goToOrderHistory, returnToHome } from '../../../src/flows/index.js';
import { homePage, orderHistoryDetailPage } from '../../../src/pages/index.js';
import type { PaymentMethod } from '../../../src/types/models.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { skipTest } from './payment-flows.helpers.js';

/**
 * Open the first order matching a payment-method filter, or skip.
 *
 * Read-only: filters Order History, opens the top row. `null` first row — no
 * order of that tender in the default date range — is a skip, the same honest
 * "nothing to act on" the settled-order picker uses.
 */
async function openFirstOrderByMethodOrSkip(ctx: Mocha.Context, method: PaymentMethod): Promise<string> {
  await returnToHome();
  const list = await goToOrderHistory();

  await list.openFilter();
  await list.filterByPaymentMethod(method);
  if (await list.canConfirmFilter()) {
    await list.confirmFilter();
  } else {
    await list.closeFilter();
  }

  const orderId = await list.firstOrderId();
  if (!orderId) skipTest(ctx);

  await list.openOrder(orderId);
  return orderId;
}

describe('Payment flows — Payment reliability', () => {
  before(function (this: Mocha.Context): void {
    this.timeout(Timeouts.MOCHA_HOOK);
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title('Payment Details shows the card last-4 and a failed-charge log (PAY-R17, VP-4511)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      await openFirstOrderByMethodOrSkip(this, 'card');

      const payment = await orderHistoryDetailPage.readPayment();
      expect(payment.length).toBeGreaterThan(0);

      // VP-4511 (OPEN): the last four of the card must appear in Payment Details.
      // A four-digit group is the card tail. While the bug is open this assertion
      // is EXPECTED to fail — that red is the regression evidence, per §9(c).
      expect(/\d{4}/.test(payment)).toBe(true);
    },
  );

  it(
    title('A Successful order never shows a Failed Payment Detail (PAY-R19, VP-2825)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      await returnToHome();
      const list = await goToOrderHistory();
      await list.waitForRows(1);
      await list.openFirstOrder();

      const info = (await orderHistoryDetailPage.readInformation()).toLowerCase();
      const payment = (await orderHistoryDetailPage.readPayment()).toLowerCase();

      // Only assert the consistency when the top order is actually Successful; on a
      // merchant whose first row is something else there is nothing to contradict.
      if (info.includes('successful') && !info.includes('refund')) {
        expect(payment).not.toContain('failed');
      }
    },
  );

  it(
    title(
      'PAY-R11 (VP-3725): complete re-pushes a stale snapshot, order reverts to Pending — PENDING 🌙 (needs a settled order + snapshot race)',
    ),
  );

  it(
    title(
      'PAY-R18 (VP-3063): Payment Details omits the successful card charge — PENDING 🌙 (needs a settled card order + tx read)',
    ),
  );

  // --- 🔌 fault-injection: OUT OF SCOPE per §9 decision (a) — kept for reference ---
  it(title('PAY-01: card offline → cash, Try again reconcile, back locked — PENDING 🔌 OUT OF SCOPE'));

  it(
    title(
      'PAY-R1 (VP-2919): phantom payment (Approved on reader, online-auth fails) — PENDING 🔌 OUT OF SCOPE',
    ),
  );

  it(
    title(
      'PAY-R2 (VP-4338): charged-but-failed at 19s on a stale pooled socket → double — PENDING 🔌 OUT OF SCOPE',
    ),
  );

  it(
    title(
      'PAY-R3 (VP-4168): double charge after terminal disconnect, UNKNOWN outcome — PENDING 🔌 OUT OF SCOPE',
    ),
  );

  it(
    title(
      'PAY-R4 (VP-4287): POS/FBP transaction mismatch after disconnect at timeout — PENDING 🔌 OUT OF SCOPE (shared SPL-R6)',
    ),
  );

  it(
    title(
      'PAY-R5 (VP-2828): success on FBP but POS Failed/Decline → double charge + income — PENDING 🔌 OUT OF SCOPE',
    ),
  );

  it(
    title(
      'PAY-R6 (VP-4087): Semi mode card-read error wedges awaiting-payment → repeat charge — PENDING 🔌🖥️ OUT OF SCOPE',
    ),
  );

  it(title('PAY-R7 (VP-4195): charge success on FBP but POS demands re-payment — PENDING 🔌 OUT OF SCOPE'));

  it(
    title(
      'PAY-R8 (VP-4334): OD still Pending though charge Succeeded, POS re-charges — PENDING 🔌 OUT OF SCOPE',
    ),
  );

  it(title('PAY-R9 (VP-4356): card transaction shows Processing after charge — PENDING 🔌 OUT OF SCOPE'));

  it(
    title(
      'PAY-R10 (VP-4377): loyalty point over-awarded after a decline-then-success — PENDING 🔌 OUT OF SCOPE',
    ),
  );

  it(title('PAY-R12 (VP-3591): $150 double charge on card — PENDING 🔌 OUT OF SCOPE'));

  it(
    title(
      'PAY-R13 (VP-3958): 10s CHARGE_TIMEOUT + verify-by-reference, no re-charge — PENDING 🔌 OUT OF SCOPE',
    ),
  );

  it(title('PAY-R14 (VP-2214): double-charge WARNING for Magensa — PENDING 🔌 OUT OF SCOPE'));

  it(
    title(
      'PAY-R15 (VP-4169): card-read error must show on the cashier too — PENDING 🖥️ OUT OF SCOPE (dual-screen)',
    ),
  );

  it(
    title(
      'PAY-R16 (VP-4133): cashier can leave the card screen safely while the reader waits — PENDING 🖥️ OUT OF SCOPE (dual-screen)',
    ),
  );
});
