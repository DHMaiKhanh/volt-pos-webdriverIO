/**
 * VP-4913 — Adjust Tip after a split payment lets the cashier pick the payment the tip
 * goes to (instead of silently adding it to the first payment).
 *
 * TC catalogue: docs/qc/volt-qc/vp-tickets/VP-4913-adjust-tip-split-payment-test-cases.md
 * (TC-VP4913-01…10). PR volt-pos#3163.
 *
 * TC-01…06 share ONE order in file order: a 2-check Equally split (Cash + Other) left on
 * Payment Success by TC-01, tipped per payment by TC-03/04, then read back in Order
 * History by TC-05/06. TC-07 (single payment) and TC-08 (Gift Card + Cash + Other) build
 * their own orders.
 *
 * No card terminal on this machine (Card → Pay is disabled): TC-10 stays PENDING. TC-08
 * needs a gift card with balance for one check (`VOLT_TEST_GIFT_CARD` / `GIFT_CARD_CODE`).
 *
 * CREATES AND SETTLES ORDERS and adds $15 of tip — dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { OhRoDialogs as D } from '../../../src/constants/testids.voltqc-oh-reopen.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import {
  closeTipDialog,
  countPayments,
  openAdjustTip,
  paymentSection,
  tipCurrentCents,
} from '../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { GC, freshDetail, staffTip } from '../../../src/pages/voltqc/oh-reopen/vqReopen.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { app, field, vqEnv } from '../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  adjustTipOnRow,
  closeTipDialogs,
  closeTipList,
  escapeSplit,
  leaveSuccessIfShown,
  openSuccessAdjustTip,
  splitPayToSuccess,
  successAdjustTipShown,
  tipRows,
  waitRowTip,
} from './vp-split-payment.helpers.js';

/** The Cash + Other split order TC-01 builds and TC-02…06 keep working on. */
let splitId = '';

function requireSplit(ctx: Mocha.Context): string {
  if (!splitId) ctx.skip(); // TC-01 did not build the split order
  return splitId;
}

/** Is the app still on THIS order's Payment Success screen? */
async function onSuccess(): Promise<boolean> {
  return /payment-success/.test(await app.url());
}

describe('VP-4913 — Adjust Tip after a split payment picks the payment', () => {
  before(async () => {
    assertWritesAllowed('settle split orders and adjust their tips');
    await returnToHome();
  });

  after(async () => {
    await closeTipDialogs().catch(() => undefined);
    await escapeSplit().catch(() => undefined);
    await leaveSuccessIfShown().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  describe('1. Payment Success after a split', () => {
    it(
      title(
        'TC-VP4913-01: Split Cash + Other → Payment Success shows Adjust Tip',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(6 * 60_000);
        const r = await splitPayToSuccess(['Cash', 'Other']);
        splitId = r.id;
        expect(r.allChecksPaid).toBe(true);
        expect(r.successText).toContain('Payment Successful!');
        expect(await successAdjustTipShown()).toBe(true);
      },
    );

    it(
      title(
        'TC-VP4913-02: Adjust Tip opens "Adjust Order Tip" listing Cash and Other, no tip auto-added',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(2 * 60_000);
        requireSplit(this);
        if (!(await onSuccess())) this.skip(); // TC-01 left Payment Success
        expect(await openSuccessAdjustTip()).toBe('list');
        const rows = await tipRows();
        expect(rows).toHaveLength(2);
        expect(rows.some((r) => r.method.startsWith('Cash'))).toBe(true);
        expect(rows.some((r) => r.method.startsWith('Other'))).toBe(true);
        // Nothing was tipped yet — the first payment did not silently take one.
        expect(rows.map((r) => r.tipCents)).toEqual([0, 0]);
      },
    );

    it(
      title('TC-VP4913-03: $10 tip on the Other row lands on Other only', Tag.REGRESSION, Tag.WRITE),
      async function () {
        this.timeout(2 * 60_000);
        requireSplit(this);
        if (!(await P.has(D.adjustOrderTipList))) {
          if (!(await onSuccess())) this.skip();
          await openSuccessAdjustTip();
        }
        await adjustTipOnRow('Other', '1000');
        const rows = await waitRowTip('Other', 1_000);
        expect(rows.find((r) => r.method.startsWith('Other'))?.tipCents).toBe(1_000);
        expect(rows.find((r) => r.method.startsWith('Cash'))?.tipCents).toBe(0);
      },
    );

    it(
      title(
        'TC-VP4913-04: $5 tip on the Cash row lands on Cash; Other keeps its $10',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(2 * 60_000);
        requireSplit(this);
        if (!(await P.has(D.adjustOrderTipList))) {
          if (!(await onSuccess())) this.skip();
          await openSuccessAdjustTip();
        }
        await adjustTipOnRow('Cash', '500');
        const rows = await waitRowTip('Cash', 500);
        expect(rows.find((r) => r.method.startsWith('Cash'))?.tipCents).toBe(500);
        expect(rows.find((r) => r.method.startsWith('Other'))?.tipCents).toBe(1_000);
        await closeTipList();
        await leaveSuccessIfShown();
      },
    );
  });

  describe('2. Order History', () => {
    it(
      title(
        "TC-VP4913-05: Order History shows Tip $15.00, the staff share and each payment's own tip",
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = requireSplit(this);
        await leaveSuccessIfShown();
        const d = await freshDetail(id, (x) => field(x, 'Tip') === '$15.00');
        expect(field(d, 'Tip')).toBe('$15.00');
        expect(staffTip(d, vqEnv.testStaff)).toBeCloseTo(15, 2);
        expect(countPayments(d, 'Cash')).toBe(1);
        expect(countPayments(d, 'Other')).toBe(1);
        const pay = paymentSection(d);
        expect(pay).toContain('$5.00');
        expect(pay).toContain('$10.00');
      },
    );

    it(
      title(
        'TC-VP4913-06: Order History › Adjust Tip lists both payments with their current tips',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(2 * 60_000);
        const id = requireSplit(this);
        if (!(await app.path()).startsWith('/order-history/')) await app.openHistoryOrder(id);
        await openAdjustTip();
        try {
          expect(await P.has(D.adjustOrderTipList)).toBe(true);
          const rows = await tipRows();
          expect(rows).toHaveLength(2);
          expect(rows.find((r) => r.method.startsWith('Cash'))?.tipCents).toBe(500);
          expect(rows.find((r) => r.method.startsWith('Other'))?.tipCents).toBe(1_000);
        } finally {
          await closeTipList();
        }
      },
    );
  });

  describe('3. Other cases', () => {
    it(
      title(
        'TC-VP4913-07: single-payment order → Adjust Tip opens the keypad directly, no payment list',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await returnToHome();
        await app.createOrder();
        await app.pay();
        await app.selectMethod('Cash');
        await app.completePayment({ tip: 'none' });
        await app.waitSuccess();
        try {
          expect(await successAdjustTipShown()).toBe(true);
          expect(await openSuccessAdjustTip()).toBe('keypad');
          expect(await P.has(D.adjustOrderTipList)).toBe(false);
          expect(await tipCurrentCents()).toBe(0);
          await closeTipDialog();
        } finally {
          await closeTipDialogs();
          await leaveSuccessIfShown();
        }
      },
    );

    it(
      title(
        'TC-VP4913-08: Gift Card + Cash + Other split → Adjust Tip still shown; the list has Cash and Other, no Gift Card',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(8 * 60_000);
        const giftCard = GC();
        if (!giftCard) this.skip(); // no VOLT_TEST_GIFT_CARD / GIFT_CARD_CODE on this run
        await returnToHome();
        const r = await splitPayToSuccess(['Gift Card', 'Cash', 'Other'], { giftCard });
        try {
          expect(r.allChecksPaid).toBe(true);
          await step('Adjust Tip is offered although check 1 is a gift card', async () => {
            expect(await successAdjustTipShown()).toBe(true);
          });
          await step('the list leaves the gift card out', async () => {
            expect(await openSuccessAdjustTip()).toBe('list');
            const methods = (await tipRows()).map((x) => x.method);
            expect(methods).toHaveLength(2);
            expect(methods.some((m) => m.startsWith('Cash'))).toBe(true);
            expect(methods.some((m) => m.startsWith('Other'))).toBe(true);
            expect(methods.some((m) => /Gift Card/i.test(m))).toBe(false);
            await closeTipList();
          });
        } finally {
          await closeTipDialogs();
          await leaveSuccessIfShown();
        }
      },
    );

    it(title('TC-VP4913-09: POS version recorded (Menu › Version Update) — PENDING (doc-only)'));

    it(
      title(
        'TC-VP4913-10: split with a Card payment → Card listed and tippable — PENDING (no card terminal: Card → Pay disabled)',
      ),
    );
  });
});
