/**
 * RE-OPEN ORDER — carried out for real, one order end to end.
 *
 * Test cases: docs/screens/order-flow/reopen-test-cases.md (RO-xx), compiled from
 * every Linear VP issue about Re-Open (VP-2585 and the bugs it spawned).
 * reopen-guards.spec.ts only opens the dialog; this file CONFIRMS the reopen and
 * walks the whole one-time-edit lifecycle on a single cash order:
 *
 *   RO-01/02  dialog opens, says the order still has its one money-edit (VP-3914)
 *   RO-03     confirm → reopened checkout owes $0.00 and offers "Re-Open Done"
 *   RO-04     abandon mid-reopen (app closed) → the action reads "Continue Re-open"
 *   RO-05     "Re-Open Done" with no edit → back to Successful, edit NOT spent
 *   RO-06/09  reopen → add a service → Home lines add up to Subtotal (VP-4405 §4)
 *             → charge only the difference in cash (VP-2585 §3)
 *   RO-07     the dialog now says items/prices are locked (VP-3913)
 *   RO-08     a second reopen cannot add a money line; it closes with "Re-Open Done"
 *
 * The cases are ORDERED and share the order — each starts where the last one left
 * the app. A failure early on skips nothing explicitly, but later cases will fail
 * on their own precondition with a message saying so.
 *
 * Needs the build carrying VP-2585 (branch `feat/VP-2585`, PR #2175): on a build
 * without it the dialog has no edit-allowance sentence and RO-02/07 fail — that is
 * the honest report, not a selector problem.
 *
 * CREATES DATA AND TAKES TWO CASH PAYMENTS (the order, then the reopen difference).
 * dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { payInCash, returnToHome } from '../../../src/flows/index.js';
import { checkoutPage, homePage, orderHistoryDetailPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { settle } from '../../../src/helpers/wait.js';
import { createAndSettleCashOrder } from './payment-flows.helpers.js';
import {
  CONTINUE_REOPEN,
  REOPEN_EDIT_AVAILABLE,
  REOPEN_EDIT_USED_UP,
  abandonReopen,
  finishReopenUnchanged,
  goToReopenEditor,
  leaveReopenCheckout,
  openOrderDetail,
  readReopenDialog,
  reopenOrder,
} from './reopen-flow.helpers.js';

describe('Order flow — Re-open Order lifecycle (VP-2585)', () => {
  let orderId = '';
  let paidCents = 0;

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    ({ orderId, paidTotalCents: paidCents } = await createAndSettleCashOrder());
  });

  after(async () => {
    if (orderId) await leaveReopenCheckout(orderId).catch(() => undefined);
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title(
      'RO-01/RO-02 (VP-3914): Re-Open dialog opens and says one money-edit is left',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      expect(await orderHistoryDetailPage.isReopenAvailable()).toBe(true);
      expect(await orderHistoryDetailPage.isRefundAvailable()).toBe(false);
      expect(await orderHistoryDetailPage.readReopenButtonLabel()).toContain('Re-Open');

      const body = await readReopenDialog();
      expect(body).toContain(REOPEN_EDIT_AVAILABLE);

      await orderHistoryDetailPage.closeReopenDialog();
      expect(await orderHistoryDetailPage.isReopenDialogShown()).toBe(false);
    },
  );

  it(
    title(
      'RO-03 (VP-2585/VP-4067): confirming re-open lands on checkout owing $0.00 with "Re-Open Done"',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await reopenOrder(orderId);

      expect(await checkoutPage.enteredAmountCents()).toBe(0);
      expect(await checkoutPage.isReopenDoneShown(Timeouts.MEDIUM)).toBe(true);
      expect(await checkoutPage.isEditOrderLinkShown()).toBe(true);
    },
  );

  it(
    title(
      'RO-04 (TC-ORDERFLOW-66): leaving mid-reopen turns the action into "Continue Re-open"',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      // No nav exists in reopen mode, so "leaving" is closing the app mid-reopen —
      // stood in for by a router history.back() to the detail pane it came from.
      await abandonReopen(orderId);

      expect(await orderHistoryDetailPage.readReopenButtonLabel()).toContain(CONTINUE_REOPEN);
    },
  );

  it(
    title(
      'RO-05 (VP-2585 §3): "Re-Open Done" with no edit restores the order and keeps the edit allowance',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await reopenOrder(orderId);
      expect(await checkoutPage.isReopenDoneShown(Timeouts.MEDIUM)).toBe(true);

      await finishReopenUnchanged(orderId);

      expect(await orderHistoryDetailPage.readReopenButtonLabel()).not.toContain(CONTINUE_REOPEN);
      const body = await readReopenDialog();
      expect(body).toContain(REOPEN_EDIT_AVAILABLE);
      await orderHistoryDetailPage.closeReopenDialog();
    },
  );

  it(
    title(
      'RO-06/RO-09 (VP-2585, VP-4405 §4): re-open + add a service charges only the difference in cash',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await reopenOrder(orderId);
      await goToReopenEditor();
      await homePage.waitForReady(Timeouts.MEDIUM);

      const linesBefore = (await homePage.cartLinePricesCents()).length;
      expect(linesBefore).toBeGreaterThan(0);

      await homePage.selectStaffByIndex(0);
      await homePage.addServiceByIndex(1);
      await settle(Timeouts.DEBOUNCE);

      const lines = await homePage.cartLinePricesCents();
      expect(lines.length).toBe(linesBefore + 1);

      // VP-4405 §4: on a merchant with a service fee the already-paid line used to be
      // re-priced at card rate, so the lines stopped adding up to the footer Subtotal.
      const lineSum = lines.reduce((a, b) => a + b, 0);
      expect(lineSum).toBe(await homePage.cartSubtotal());

      await homePage.pressPay();
      await checkoutPage.waitForReady(Timeouts.MEDIUM);
      await checkoutPage.selectTender('cash');
      await settle(Timeouts.DEBOUNCE);

      // Only the difference is owed. The reopened checkout renders no Remaining /
      // Total Paid rows — the amount due is what "Enter Amount" pre-fills (and the
      // Cash tile echoes): the new cash Total minus what the first sale already
      // took, to the cent (VP-4013 / VP-3931 / VP-4067). Verified live 2026-10-17:
      // $60 cash line + $100 service on SF 10% / Tax 10% → Total $176, due $110.00.
      const total = await checkoutPage.totalCents();
      const due = await checkoutPage.enteredAmountCents();
      expect(due).toBeGreaterThan(0);
      expect(due).toBe(total - paidCents);

      const success = await payInCash(orderId);
      await success.continueToNextOrder();
      await success.waitForFlowToEnd();
    },
  );

  it(
    title(
      'RO-07 (VP-3913): after the paid edit the Re-Open dialog says items and prices are locked',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await openOrderDetail(orderId);

      expect(await orderHistoryDetailPage.isReopenAvailable()).toBe(true);
      const body = await readReopenDialog();
      expect(body).toContain(REOPEN_EDIT_USED_UP);
      expect(body).not.toContain(REOPEN_EDIT_AVAILABLE);
    },
  );

  it(
    title(
      'RO-08 (VP-3913): a re-open past the limit cannot add a money line and closes with "Re-Open Done"',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await reopenOrder(orderId);
      expect(await checkoutPage.enteredAmountCents()).toBe(0);

      await goToReopenEditor();
      await homePage.waitForReady(Timeouts.MEDIUM);
      const linesBefore = (await homePage.cartLinePricesCents()).length;

      // The tile is either disabled or the add is refused — both leave the cart as it was.
      await homePage.selectStaffByIndex(0).catch(() => undefined);
      await homePage.addServiceByIndex(1).catch(() => undefined);
      await settle(Timeouts.DEBOUNCE);
      expect((await homePage.cartLinePricesCents()).length).toBe(linesBefore);

      await homePage.pressPay();
      await checkoutPage.waitForReady(Timeouts.MEDIUM);
      expect(await checkoutPage.enteredAmountCents()).toBe(0);
      expect(await checkoutPage.isReopenDoneShown(Timeouts.MEDIUM)).toBe(true);
      await finishReopenUnchanged(orderId);
    },
  );

  // --- Not runnable in one pass on this lane — see the doc for the fixture each needs.
  it(title('RO-10 (VP-3957/VP-4012): re-open + service paid by CARD, Card = (Δ+SF)+tax — PENDING 💳'));
  it(
    title(
      'RO-11 (VP-4079): re-open + PRODUCT, product tax applied on Card — PENDING 💳 (product + tax fixture)',
    ),
  );
  it(title('RO-12 (VP-4013): Cash is $110.00 not $110.17 on SF 5%/Tax 10% — PENDING (fixed-rate merchant)'));
  it(title('RO-13 (VP-3931): Cash re-open of +$62 is $68.20 not $67.20 — PENDING (fixed-rate merchant)'));
  it(title('RO-14 (VP-4067): re-open a Cash+Other split owes $0.00 — PENDING (split fixture)'));
  it(
    title('RO-15..17 (VP-4405 §1/§2/§5): 1¢ tax, split Total, Quick Pay $25 vs $27.50 — PENDING (PO ruling)'),
  );
  it(title('RO-18 (VP-3982): remove then add a customer during re-open — PENDING (customer fixture)'));
  it(title('RO-19 (VP-3969): re-open + re-complete does not bump visits — PENDING (visit read-back)'));
  it(
    title('RO-20..23 (VP-4085/VP-3598/VP-3726/VP-3200): loyalty points on swap/detach/re-complete — PENDING'),
  );
  it(
    title(
      'RO-24..27 (VP-3148/VP-3670/VP-3376/VP-3279/VP-2939): per-service staff move, delete, tip — PENDING',
    ),
  );
  it(title('RO-28..30 (VP-2585 §1-§3): promo/gift-card lock, lower-total gate — PENDING'));
  it(title('RO-31 (VP-4037): Edit Order only on allowed statuses — PENDING'));
  it(title('RO-32 (VP-4077): recompute honours the saved gift-card SF toggle — PENDING (Portal toggle)'));
});
