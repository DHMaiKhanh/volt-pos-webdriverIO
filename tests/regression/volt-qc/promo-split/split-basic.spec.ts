/**
 * volt-qc port — 05 SPLIT: split bill basics.
 *
 * Source: volt-qc `e2e/tests/05-split/split.spec.ts` (SPLIT-A … SPLIT-D).
 *
 * The merchant may charge a Card service fee + tax: checks are split from the
 * Card Total on Home; Cash / Other ≈ check / (1 + fee). Money in DOLLARS.
 * SPLIT-D reads the order SPLIT-C paid (same describe, runs after it).
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsHome, VqpsSplit } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { step } from '../../../../src/helpers/steps.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { basePrice, cashTotalOf, priceModel } from '../../../../src/pages/voltqc/promo-split/price.js';
import * as S from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import { textQ } from '../../../../src/pages/voltqc/promo-split/splitPlanAExtra.js';
import {
  app,
  appears,
  clickOrJs,
  field,
  money,
  vqEnv,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

/** Order SPLIT-C completed (read by SPLIT-D). */
let splitOrderId = '';
/** Split SPLIT-C left half-paid (settled in afterEach). */
let openSplit = '';

/** Home → Split → passcode → /split-order (no wait for the check list, like the source). */
async function enterSplit(): Promise<void> {
  await clickOrJs(VqpsHome.splitButton);
  await app.passcodeIfAsked(2_000);
  await app.waitPath(/split-order/, 15_000);
}

describe('volt-qc 05 SPLIT — split bill basics', () => {
  before(() => {
    assertWritesAllowed('volt-qc 05 SPLIT basics');
  });

  afterEach(async () => {
    await app.closeStrayDialogs().catch(() => undefined);
    if (openSplit) await S.settleSplit(openSplit).catch(() => undefined);
    openSplit = '';
    await app.cleanupOrders().catch(() => undefined);
  });

  it(
    title('SPLIT-A Order ≤ $5.00 disables the Split button (SPLIT-002, E2E-034)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(4 * 60_000);
      // Quick Pay base price chosen via the price model so the Card Total on Home is exactly $5.00.
      const { T } = await S.cardTotalOrder(500);
      // With 10% tax rounded half-up the Total may never be exactly $5.00 → take the closest Total ≤ $5.00.
      if (Math.abs(T - 5) > 0.001)
        console.warn(
          `[observation] SPLIT-002: could not build Total $5.00 with current fee/tax → using Total ${String(T)}`,
        );
      expect(T).toBeLessThanOrEqual(5);
      expect(T).toBeGreaterThan(4.9);
      expect(await P.isDisabled(VqpsHome.splitButton)).toBe(true);
      await app.deleteCurrentOrder();
    },
  );

  it(
    title(
      'SPLIT-B 1-item order: By Items disabled; leaving Split unpaid keeps the order (SPLIT-001, SPLIT-029, SPLIT-009)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const id = await app.createOrder();
      const total = (await app.orderTotals()).total;
      await enterSplit();
      await P.waitFor(inMain(btn('By Items')), 15_000, 'By Items');
      expect(await P.isDisabled(inMain(btn('By Items')))).toBe(true);
      const t = await app.text('main');
      // Even split by cents (floor(total/2) for check 1) — avoids float drift (36.30/2*100 = 1814.999…).
      const [half] = S.evenSplit(total, 2);
      expect(t).toContain('Check 1');
      expect(t).toContain('Check 2');
      expect(t).toContain(`$${(half ?? 0).toFixed(2)}`);
      await app.openPendingOrder(id);
      expect((await app.orderTotals()).total).toBeCloseTo(total, 2);
      await app.deleteCurrentOrder();
    },
  );

  it(
    title(
      'SPLIT-C Even split 2 checks: Check 1 Cash, Check 2 Other with name → Complete Done (SPLIT-036, SPLIT-039, OH-078)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const m = await priceModel(); // measure before opening the order
      await app.quickCheckout();
      const bases = [await basePrice(vqEnv.testService), await basePrice(vqEnv.testService2)];
      const id = await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
      const total = (await app.orderTotals()).total; // Card Total — checks are split from it
      await enterSplit();
      openSplit = id;
      const [c1 = 0, c2 = 0] = S.evenSplit(total, 2);

      await step('Pay Check 1 with Cash', async () => {
        await clickOrJs(inMain({ text: 'Check 1', nth: 0 }));
        await clickOrJs(inMain(btn('Cash')));
        await clickOrJs(VqpsSplit.pay);
        await app.passcodeIfAsked(1_500);
        await P.clickQ([S.cashDialog(1), btn('Complete Check 1')], 10_000);
        await S.waitCheckPaid(1);
        expect(await appears(textQ(`$${c2.toFixed(2)}`), 5_000)).toBe(true);
        await P.clickQ([{ role: 'dialog', nth: -1 }, btn('Continue Payment')]);
        expect(await appears(inMain({ textRe: 'Paid with Cash', nth: 0 }), 5_000)).toBe(true);
      });

      await step('Pay Check 2 with Other + method name', async () => {
        await clickOrJs(inMain(btn('Other')));
        await clickOrJs(VqpsSplit.pay);
        await app.passcodeIfAsked(1_500);
        const dlg = S.otherDialog;
        await P.fillQ([dlg, { role: 'textbox', name: 'Input payment method name' }], 'Zelle E2E');
        await P.clickQ([dlg, { role: 'button', nameRe: '^Pay \\$', nth: 0 }]);
        await S.waitCheckPaid(2);
        expect(await appears(textQ('All checks paid'), 5_000)).toBe(true);
        await P.clickQ([{ role: 'dialog', nth: -1 }, btn('Done')]);
      });

      const t = await app.text('main');
      expect(t).toMatch(/Remaining \| \$0\.00/);
      // Real amount paid = Total Paid (Cash/Other carry no service fee → below the Card Total when a fee is on).
      const paid = (await S.paidRemaining()).totalPaid;
      // Checked 2026-10-09: each check ≈ check / (1 + fee) (≤ 2¢ reconcile), SUM = the order's Cash/Other price.
      expect(paid).toBeCloseTo(S.nonCardShare(m, c1) + S.nonCardShare(m, c2), 1);
      expect(paid).toBeCloseTo(cashTotalOf(m, bases), 2); // Cash + Other paid = Cash price of the whole order
      await clickOrJs(inMain({ role: 'button', nameRe: 'Complete Done|^Done$', nth: -1 }));
      await app.passcodeIfAsked(2_000);
      const s = await app.successText();
      openSplit = '';
      expect(s).toContain(`$${paid.toFixed(2)}`);
      expect(s).toMatch(/Check 1 \| Paid by Cash/);
      expect(s).toMatch(/Check 2 \| Paid by Other \(Zelle E2E\)/);
      await app.noReceipt();

      await app.openHistoryOrder(id);
      const d = await app.historyDetail(id);
      expect(field(d, 'Status')).toMatch(/Successful/);
      // Order History "Total" of a split order = the amount actually paid (not the Home Card Total).
      expect(money(field(d, 'Total'))).toBeCloseTo(paid, 2);
      expect(d).toContain(`#${id}-1`);
      expect(d).toContain(`#${id}-2`);
      splitOrderId = id;
    },
  );

  it(
    title(
      'SPLIT-D Order History notes the Other method name of the paid check (PAY-032)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      // Known issue in the source suite (@known-issue).
      if (!splitOrderId) {
        console.warn('SPLIT-C did not produce a split order');
        this.skip();
      }
      this.timeout(2 * 60_000);
      await app.openHistoryOrder(splitOrderId);
      const d = await app.historyDetail(splitOrderId);
      const otherLine = /Other[^|]*\|[^|]*\|[^|]*/.exec(d)?.[0] ?? '';
      console.warn(`Other payment line in Order History: "${otherLine}"`);
      expect(d).toContain('Zelle E2E');
    },
  );
});
