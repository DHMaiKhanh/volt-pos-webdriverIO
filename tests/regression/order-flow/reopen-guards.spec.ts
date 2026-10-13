/**
 * REOPEN ORDER — spec + regression guards from
 * docs/screens/order-flow/payment-flows-test-cases.md §2.
 *
 * Re-open is offered on a **Successful - Unsettled** order (the one this run can
 * build). Confirming it fires the `edit_order` passcode guard, navigates to
 * checkout, and demands a fresh successful payment to complete the re-open — a
 * heavy, stateful mutation. So the runnable surface here is the DIALOG: the action
 * is present, it opens, and it carries the one-time / "Void all" warning. The
 * passcode guard only fires on CONFIRM, so opening and closing is safe.
 *
 * ## Why the recompute guards are all pending
 *
 * ROP-R1..R14 are about what re-open RECOMPUTES (tax base, service fee, points,
 * discount lock, customer visit) — every one needs the re-open actually carried
 * out AND a settled / card / point context the attach lane cannot assemble in one
 * pass. They stay documented pending stubs with their VP ids so the backlog is
 * visible in the suite, not just the doc.
 *
 * CREATES DATA AND TAKES A PAYMENT: one settled cash order (the re-open dialog is
 * opened but never confirmed). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage, orderHistoryDetailPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { createAndSettleCashOrder } from './payment-flows.helpers.js';

describe('Payment flows — Reopen Order', () => {
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
      'Re-Open is offered on an unsettled order and its dialog opens (ROP-01)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      // Re-open is an unsettled-only action; Refund (settled-only) must be absent.
      expect(await orderHistoryDetailPage.isReopenAvailable()).toBe(true);
      expect(await orderHistoryDetailPage.isRefundAvailable()).toBe(false);

      await orderHistoryDetailPage.openReopenDialog();
      expect(await orderHistoryDetailPage.isReopenDialogShown()).toBe(true);

      // The dialog is the confirmation gate before the passcode guard. Reading it is
      // the coverage; confirming would navigate to checkout and demand a re-payment.
      const body = await orderHistoryDetailPage.readReopenDialogText();
      expect(body.length).toBeGreaterThan(0);

      await orderHistoryDetailPage.closeReopenDialog();
      expect(await orderHistoryDetailPage.isReopenDialogShown()).toBe(false);
    },
  );

  it(
    title(
      'ROP-01 full (VP-2585): re-open is one-time, 2nd press is Continue/hidden — PENDING 🌙 (needs the re-open carried out)',
    ),
  );

  it(
    title(
      'ROP-02: "Void all" appears when totalPaid < newTotal or tax changes — PENDING 🌙 (needs re-open + edit)',
    ),
  );

  it(
    title(
      'ROP-03 (VP-2585): re-open allows one service/price/staff edit — PENDING 🌙 (needs re-open carried out)',
    ),
  );

  it(
    title(
      'ROP-04: discount/promo/reward/tax lock to the old version, SF recomputes — PENDING 🌙 (needs re-open + recompute read)',
    ),
  );

  it(
    title(
      'ROP-R1 (VP-3913): re-open with no limit despite reopenEditCount — PENDING 🌙 (needs re-open carried out)',
    ),
  );

  it(
    title(
      'ROP-R2 (VP-3914): Re-Open shows no "edits remaining" message — PENDING 🌙 (needs re-open carried out)',
    ),
  );

  it(
    title(
      'ROP-R3 (VP-4067): re-open after split settle charges the odd cent again — PENDING 🌙 (needs a split settle)',
    ),
  );

  it(
    title(
      'ROP-R4 (VP-4013): re-open +service, Cash shows $110.17 not $110.00 — PENDING 🌙 (needs re-open + recompute)',
    ),
  );

  it(
    title(
      'ROP-R5 (VP-4012): re-open +item, Card tax base misses Service Fee — PENDING 🌙💳 (needs re-open + card)',
    ),
  );

  it(
    title(
      'ROP-R6 (VP-3957): re-open +service Card total wrong with SF + Tax — PENDING 🌙💳 (needs re-open + card)',
    ),
  );

  it(
    title(
      'ROP-R7 (VP-3931): re-open +service Cash skips new service tax ($67.20 vs $68.20) — PENDING 🌙 (needs re-open + recompute)',
    ),
  );

  it(
    title(
      'ROP-R8 (VP-4079): re-open +Product Card, product tax not applied — PENDING 🌙💳 (needs re-open + card)',
    ),
  );

  it(
    title(
      'ROP-R9 (VP-4077): re-open recompute must honor the saved gift-card SF toggle — PENDING 🌙 (needs re-open + setting)',
    ),
  );

  it(
    title(
      'ROP-R10 (VP-4037): Edit Order still allowed in Reopen/Pending/Cancel — PENDING 🌙 (needs those statuses + Edit-Order locator)',
    ),
  );

  it(
    title(
      'ROP-R11 (VP-3982): re-open remove-then-add customer fails — PENDING 🌙 (needs re-open carried out)',
    ),
  );

  it(
    title('ROP-R12 (VP-3969): re-open bumps customer visit +1 — PENDING 🌙 (needs re-open + customer read)'),
  );

  it(
    title(
      'ROP-R13 (VP-4085): re-open point & check-in/out per the new point model — PENDING 🌙 (needs re-open + point read)',
    ),
  );

  it(
    title(
      'ROP-R14 (VP-4405): PR#2175 side-effects cluster (tax 1¢, split total, point revoke, Quick Pay $25→$27.50) — PENDING 🌙💳 (split into ROP-R14a..e on implementation)',
    ),
  );
});
