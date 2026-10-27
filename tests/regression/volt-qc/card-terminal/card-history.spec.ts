/**
 * volt-qc card terminal — what a real card order does AFTER the charge: Adjust
 * Tip on a card txn, re-opening a card order without a change, and the card order
 * in Daily Sale / Batch History.
 *
 * TC catalogue: docs/qc/volt-qc/windows-regression/07-order-history.md,
 * 10-bao-cao-payroll.md and 17-reopen.md. These rows were pending in ../_manual/
 * only because they needed a card order charged on the Bamboo DOT terminal.
 *
 * Gating and the operator tap: see ./card-terminal.helpers.ts (CARD_SETTLE=1 +
 * a connected terminal; an operator taps the card for each charge).
 *
 *     CARD_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/volt-qc/card-terminal/card-history.spec.ts
 *
 * Charges: 1 (Adjust Tip) + 1 (re-open) + 2 (reports) = 4 taps. The tips are
 * adjusted on unsettled orders only; nothing is refunded or settled.
 *
 * CREATES DATA AND TAKES CARD PAYMENTS. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import {
  OhRoButtons as B,
  OhRoDialogs as D,
  OhRoText as T,
} from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { RptText } from '../../../../src/constants/testids.voltqc-reports-time.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  adjustTipTo,
  centsIn,
  closeTipDialog,
  detailActions,
  detailText,
  enteredFor,
  field,
  openAdjustTip,
  openHistoryOrder,
  reopenDialogText,
  reopenDone,
  reopenToCheckout,
  saveTip,
  tipBackspace,
  tipCurrentCents,
  tipEnteredCents,
  tipKey,
  waitStatus,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { P } from '../../../../src/pages/voltqc/pay/payProbe.js';
import {
  batchRows,
  dailySnapshot,
  openBatch,
  type DailySnap,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import { VqcPay } from '../../../../src/constants/testids.voltqc-pay.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { abandonReopen } from '../../order-flow/reopen-flow.helpers.js';
import {
  ONE_CHARGE_MS,
  cardDialogShown,
  cleanAfterCard,
  createCardOrder,
  dollarsToCents,
  requireCardTerminal,
  successfulCardsOf,
} from './card-terminal.helpers.js';

const bare = (code: string): string => code.replace(/^#/, '').trim();

async function waitTip(code: string, usdText: string): Promise<string> {
  return P.poll(
    () => detailText(code),
    (d) => field(d, 'Tip') === usdText,
    30_000,
  );
}

/** Poll Daily Sale (today) until `ok`, re-opening the report every 3 s. */
async function dailyUntil(ok: (s: DailySnap) => boolean, budgetMs = 90_000): Promise<DailySnap> {
  const end = Date.now() + budgetMs;
  let s = await dailySnapshot(0);
  while (!ok(s) && Date.now() < end) {
    await settle(3_000);
    s = await dailySnapshot(0);
  }
  return s;
}

describe('volt-qc card terminal — after the charge (tip, re-open, reports)', function () {
  this.timeout(ONE_CHARGE_MS);

  before(() => assertWritesAllowed('take card payments (volt-qc card terminal)'));
  afterEach(cleanAfterCard);
  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Adjust Tip on an unsettled card order: the new card tip must be higher than the current one (Save disabled for equal / lower, X keeps it); a higher tip saves, the button stops "Adjusting tip", Tip / Total follow (OH-194, OH-196)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(ONE_CHARGE_MS + 2 * 60_000);
      await requireCardTerminal(this);
      const o = await createCardOrder(this);
      if (!(await detailActions())[B.adjustTip]) {
        console.warn(
          '[OH-194] skipped after the charge: tip-after-payment is off on this merchant (no Adjust Tip)',
        );
        this.skip();
      }

      // Seed the $3.00 tip both TCs start from (a tip raise from $0 is allowed).
      await adjustTipTo('300');
      const seeded = await waitTip(o.code, '$3.00');
      const totalAt3 = centsIn(field(seeded, 'Total'));

      await step('OH-194 equal ($3.00) and lower ($2.00) tips are refused, X changes nothing', async () => {
        await openAdjustTip();
        expect(await tipCurrentCents()).toBe(300);
        for (const k of '300') await tipKey(k);
        expect(await tipEnteredCents()).toBe(300);
        expect((await P.rawText(D.adjustTip)) ?? '').toContain('Card tip must be higher than $3.00');
        expect(await P.isDisabled([D.adjustTip, btn('Save', 0)])).toBe(true);
        for (let i = 0; i < 4; i += 1) await tipBackspace();
        for (const k of '200') await tipKey(k);
        expect(await tipEnteredCents()).toBe(200);
        expect((await P.rawText(D.adjustTip)) ?? '').toContain('Card tip must be higher than $3.00');
        expect(await P.isDisabled([D.adjustTip, btn('Save', 0)])).toBe(true);
        await closeTipDialog();
        expect(field(await detailText(o.code), 'Tip')).toBe('$3.00');
      });

      await step(
        'OH-196 $3.00 → $5.00 saves; the button finishes; Tip, Total and the card txn tip follow',
        async () => {
          await openAdjustTip();
          for (const k of '500') await tipKey(k);
          expect(await tipEnteredCents()).toBe(500);
          expect(await P.isDisabled([D.adjustTip, btn('Save', 0)])).toBe(false);
          await saveTip();
          const finished = await P.poll(
            async () => {
              const t = await P.pageText('main');
              return !/Adjusting tip/i.test(t) && (await P.has(inMain(btn(B.adjustTip, 0))));
            },
            (v) => v,
            60_000,
          );
          expect(finished).toBe(true);
          const d = await waitTip(o.code, '$5.00');
          expect(centsIn(field(d, 'Total'))).toBe(totalAt3 + 200);
          const card = successfulCardsOf(d);
          expect(card).toHaveLength(1);
          expect(dollarsToCents(card[0]?.tip ?? 0)).toBe(500);
        },
      );
    },
  );

  it(
    title(
      'Card order re-opened then abandoned: status Re-open, Continue Re-open, no Adjust Tip / Cancel / Refund; continued and closed unchanged: $0 owed on Card / Cash / Other, Re-Open Done (no Complete Payment, no terminal), still the one card txn, the edit left (RO-202, RO-201)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(ONE_CHARGE_MS + 2 * 60_000);
      await requireCardTerminal(this);
      const o = await createCardOrder(this);
      const cardBefore = successfulCardsOf(await detailText(o.code));
      expect(cardBefore).toHaveLength(1);
      const adjustBefore = (await detailActions())[B.adjustTip];

      await step('RO-202 leave the reopened checkout mid-way', async () => {
        await reopenToCheckout(o.orderId);
        await abandonReopen(o.orderId);
        await openHistoryOrder(o.orderId);
        expect(field(await detailText(o.code), 'Status')).toBe('Re-open');
        const a = await detailActions();
        expect(a[B.continueReopen]).toBe(true);
        for (const k of [B.adjustTip, B.cancelOrder, 'Refund']) expect(a[k]).toBe(false);
      });

      await step(
        'RO-201 Continue Re-open: nothing owed on any tender, Re-Open Done, terminal untouched',
        async () => {
          await reopenToCheckout(o.orderId, B.continueReopen);
          for (const t of ['card', 'cash', 'other'] as const) expect(await enteredFor(t)).toBe(0);
          expect(await P.has({ role: 'button', name: B.reopenDone })).toBe(true);
          expect(await P.has(VqcPay.completePayment)).toBe(false);
          expect(await cardDialogShown()).toBe(false);
          await reopenDone();
          expect(await waitStatus(o.code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
          const after = successfulCardsOf(await detailText(o.code));
          expect(after).toHaveLength(1);
          expect(after[0]?.amount).toBe(cardBefore[0]?.amount);
          expect(after[0]?.last4).toBe(cardBefore[0]?.last4);
          expect((await detailActions())[B.adjustTip]).toBe(adjustBefore);
          expect(await reopenDialogText(o.orderId)).toContain(T.msgHasEdit);
        },
      );
    },
  );

  it(
    title(
      'Two new card orders: each lands in Daily Sale once with Sale + Tax + Tip = Total = the order Total, Δ Card ≥ both totals; the Open batch gains 2 payments and both amounts, still "Not closed yet" (RPT-041, RPT-173)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(2 * ONE_CHARGE_MS + 3 * 60_000);
      await requireCardTerminal(this);
      const dailyBefore = await dailySnapshot(0);
      await openBatch();
      const openBefore = (await batchRows()).rows[0];
      expect(openBefore?.status).toBe('Open');

      const a = await createCardOrder(this);
      const totalA = centsIn(field(await detailText(a.code), 'Total'));
      const b = await createCardOrder(this, [[0, 1]]);
      const totalB = centsIn(field(await detailText(b.code), 'Total'));

      await step('RPT-041 Daily Sale: one row per card order, Δ Card', async () => {
        const has = (s: DailySnap, code: string): number =>
          s.rows.filter((r) => r.order.includes(bare(code))).length;
        const after = await dailyUntil((s) => has(s, a.code) > 0 && has(s, b.code) > 0);
        for (const [code, total] of [
          [a.code, totalA],
          [b.code, totalB],
        ] as const) {
          const rows = after.rows.filter((r) => r.order.includes(bare(code)));
          expect(rows).toHaveLength(1);
          const r = rows[0];
          expect((r?.sale ?? 0) + (r?.tax ?? 0) + (r?.tip ?? 0)).toBe(r?.total);
          expect(r?.total).toBe(total);
        }
        if (dailyBefore.detail && after.detail) {
          expect(after.detail.card - dailyBefore.detail.card).toBeGreaterThanOrEqual(totalA + totalB);
        }
      });

      await step('RPT-173 Batch History: the Open batch grows by both card payments', async () => {
        await openBatch();
        const open = (await batchRows()).rows[0];
        expect(open?.status).toBe('Open');
        expect(open?.date).toBe(RptText.notClosedYet);
        expect((open?.count ?? 0) - (openBefore?.count ?? 0)).toBeGreaterThanOrEqual(2);
        expect((open?.amount ?? 0) - (openBefore?.amount ?? 0)).toBeGreaterThanOrEqual(totalA + totalB);
      });
    },
  );
});
