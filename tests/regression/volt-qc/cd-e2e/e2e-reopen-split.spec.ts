/**
 * volt-qc port — 14 E2E: re-open and split journeys.
 *
 * Source: volt-qc `e2e/tests/14-e2e/e2e-plan-reopen.spec.ts` (E2E-T13, T14) and
 * `e2e-plan-tip-split.spec.ts` (E2E-T09, T17, T19, T15).
 *
 * Adaptations:
 * - Report legs (Staff Income per-staff rows, Payroll Δ, Daily Sale tiles) are
 *   reduced to the order's own Daily Sale row; Staff-Income / Payroll tip shares
 *   are not re-derived.
 * - Split + gift card (T17, T19) need `VOLT_TEST_GIFT_CARD` with balance for one
 *   check; T15 reproduces volt-qc bug #22 (the order is left stuck) and runs only
 *   with `VOLT_RUN_STUCK_BUG_TESTS=1`, as in the source.
 * - Re-open mode hides the header: leaving goes through the router (as volt-qc did).
 */

import { expect } from '@wdio/globals';
import { CdCustomer, CdMain } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  app,
  field,
  moneyField,
  randomPhone,
  uniqueName,
} from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, expectCents, note, resetTill, track, untrack, usd } from './cd-e2e.helpers.js';

const GIFT_CARD = (process.env.VOLT_TEST_GIFT_CARD ?? '').trim();

function paymentDetails(dump: string): string {
  const i = dump.indexOf('Payment Details');
  if (i < 0) return '';
  const j = dump.indexOf('Order Note', i);
  return dump.slice(i, j > i ? j : undefined);
}

describe('volt-qc 14 E2E — re-open & split', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'Re-Open restriction mode: other service/staff tiles do nothing, remove buttons disabled, line editor note-only, no Split / Promo → Re-Open Done adds no transaction (E2E-027)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const d = await app.testData();
      const phone = randomPhone();
      const code = track(await app.createOrder());
      await app.attachNewCustomer(phone, uniqueName('QC E2E'));
      await app.customerConfirmPhone();
      expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
      await app.payCurrentOrder('Cash');
      await app.noReceipt();
      untrack(code);
      await app.openHistoryOrder(code);
      const pdBefore = paymentDetails(await app.historyDetail(code));

      await app.reopenOrder(code);
      const before = await app.orderTotals();

      await step('other tiles: no effect', async () => {
        const otherService = (await app.texts({ css: 'main li span.block' })).find(
          (n) => n && n !== d.service,
        );
        if (otherService) await app.click(CdMain.serviceTile(otherService), 3_000).catch(() => undefined);
        if (d.staff2)
          await app.click({ css: CdMain.staffNameCss, text: d.staff2, nth: 0 }, 3_000).catch(() => undefined);
        await app.pause(1_500);
        await app.closeStrayDialogs();
        expect(await app.orderTotals()).toEqual(before);
        if (otherService) expect(await app.itemRowCount(otherService)).toBe(0);
      });

      await step('remove buttons disabled', async () => {
        expect(await app.isDisabled(CdMain.itemRowRemove(d.service))).toBe(true);
        const removeCustomer = [
          { css: 'main' },
          { css: 'button', hasCss: 'span[class*="stroke-destructive"]', nth: 0 },
        ] as const;
        if (await app.has(removeCustomer)) expect(await app.isDisabled(removeCustomer)).toBe(true);
        else note('E2E-027: no customer-remove button found on the re-open frame');
      });

      await step('line editor: price read-only, note + Save', async () => {
        await app.click(CdMain.itemRowName(d.service));
        const dlg = { role: 'dialog' as const, hasText: d.service, nth: -1 };
        expect(await app.waitFor(dlg)).toBe(true);
        expect(await app.has([dlg, { css: 'input,textarea', placeholder: 'Add note', nth: 0 }])).toBe(true);
        expect(await app.count([dlg, { role: 'textbox' }])).toBe(1);
        expect(await app.isDisabled([dlg, { role: 'button', name: 'Save', nth: 0 }])).toBe(true);
        await app.escape();
        expect(await app.waitGone(dlg)).toBe(true);
      });

      await step('no Split, no Promo & Rewards', async () => {
        expect(await app.has([{ css: 'main' }, { css: 'button.bg-orange', nth: 0 }])).toBe(false);
        expect(await app.has(CdMain.promoRewards)).toBe(false);
      });

      await step('Re-Open Done → no new payment line', async () => {
        await app.reopenDone();
        await app.openHistoryOrder(code);
        const dump = await app.historyDetail(code);
        expect(field(dump, 'Status')).toBe('Successful - Unsettled');
        expect(paymentDetails(dump)).toBe(pdBefore);
        expect(await cust.waitWelcome()).toBe(true);
      });
    },
  );

  it(
    title(
      'Leave a re-open midway → history shows "Re-open" with only Continue Re-open → Continue → Re-Open Done → Successful - Unsettled, Daily Sale keeps ONE row (E2E-028)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(10 * 60_000);
      const { code, total } = await app.createPaidOrder({ method: 'Cash' });
      ensure((await app.dailySaleRow(code)) !== null, `${code} never showed in Daily Sale`);

      await step('Re-Open → Confirm → leave via the router', async () => {
        await app.reopenOrder(code, { edit: false });
        await app.routerGoRaw('/order-pending');
        await app.passcodeIfAsked(2_000);
        await app.pause(1_500);
        expect(await app.path()).not.toMatch(/checkout/);
      });

      await step('Daily Sale while re-open (observation)', async () => {
        const r = await app.dailySaleRow(code, 10_000);
        note(`E2E-028 ${code} while re-open: Daily Sale row ${r ?? 'absent'}`);
      });

      await step('Order History: Re-open + Continue Re-open only', async () => {
        await app.go('/order-history');
        await app.fill(CdMain.historySearch, code);
        await app.pause(3_000);
        const rows = await app.texts({ css: CdMain.historyLinks });
        const row = rows.find((r) => r.replace(/\s/g, '').includes(code)) ?? '';
        expect(row).toMatch(/Re-open/i);
        await app.openHistoryOrder(code);
        expect(await app.has(CdMain.continueReopen)).toBe(true);
        expect(await app.has(CdMain.reopenOrder)).toBe(false);
        expect(await app.has(CdMain.cancelOrder)).toBe(false);
      });

      await step('Continue Re-open → Re-Open Done', async () => {
        await app.click(CdMain.continueReopen);
        if (await app.waitFor(CdMain.reopenConfirmDialog, 5_000)) {
          await app.click([CdMain.reopenConfirmDialog, { role: 'button', name: 'Confirm', nth: 0 }]);
        }
        await app.passcodeIfAsked(2_500);
        await app.waitPath(/checkout|\/home/, 20_000);
        await app.reopenDone();
        await app.openHistoryOrder(code);
        expect(field(await app.historyDetail(code), 'Status')).toBe('Successful - Unsettled');
      });

      await step('Daily Sale: one row with the paid total', async () => {
        const row = await app.dailySaleRow(code);
        ensure(row !== null, `${code} gone from Daily Sale`);
        expect(row ?? '').toContain(usd(total));
        const t = await app.text('main');
        expect(t.split(code).length - 1).toBe(1);
      });
    },
  );

  it(
    title(
      'Two-staff Cash order + cashier tip $3 → Split Tip evenly → each staff $1.50 on payment-success and Order History; Daily Sale row Tip $3.00 (E2E-018)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(10 * 60_000);
      const d = await app.testData();
      if (!d.staff2) this.skip();
      const code = track(await app.createOrder());
      await app.pickStaff(d.staff2);
      await app.addService(d.service);
      let cash = NaN;
      await step('Cash + tip $3.00', async () => {
        await app.pay();
        cash = await app.methodCents('Cash');
        await app.selectMethod('Cash');
        expect(await cust.waitActiveTiles(['cash'])).toEqual(['cash']);
        await app.cashierTip('300');
        expectCents(await app.enteredCents(), cash + 300, 'Enter Amount');
      });
      await step('Complete → Split Tip evenly', async () => {
        await app.completePayment('none');
        expect(await app.successText()).toContain('Total Tip: $3.00');
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        untrack(code);
        await app.click({ text: 'Split Tip', nth: 0 });
        const dlg = { role: 'dialog' as const, hasText: 'Split Tip', nth: -1 };
        expect(await app.waitFor(dlg)).toBe(true);
        await app.click([dlg, { role: 'tab', name: 'Split Evenly', nth: 0 }]);
        await app.click([dlg, { role: 'button', name: 'Confirm', nth: 0 }]);
        expect(await app.waitFor({ text: 'Tip updated successfully', nth: 0 })).toBe(true);
        expect(await app.waitGone(dlg)).toBe(true);
        const t = await app.text('main');
        expect(t).toContain(`${d.staff} - $1.50`);
        expect(t).toContain(`${d.staff2} - $1.50`);
        await app.noReceipt();
      });
      await step('Order History', async () => {
        await app.openHistoryOrder(code);
        const dump = await app.historyDetail(code);
        expect(dump).toContain(`${d.staff} - $1.50`);
        expect(dump).toContain(`${d.staff2} - $1.50`);
        expectCents(moneyField(dump, 'Total'), cash + 300, 'history Total');
      });
      await step('Daily Sale row', async () => {
        const row = await app.dailySaleRow(code);
        ensure(row !== null, `${code} never showed in Daily Sale`);
        expect(row ?? '').toContain('$3.00');
      });
    },
  );

  it(
    title(
      'Split 3 checks Cash + Other + Gift Card: equal checks, remaining totals, payment-success per check, points > 0, history #-1/#-2/#-3 with Cancel and no Refund, Daily Sale row, card balance − one check (E2E-031)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(12 * 60_000);
      if (!GIFT_CARD) this.skip();
      const d = await app.testData();
      const balance0 = await app.giftCardBalance(GIFT_CARD);
      const phone = randomPhone();
      const code = track(await app.createOrder({ services: [d.service, d.service, d.service] }));
      await app.attachNewCustomer(phone, uniqueName('QC E2E'));
      await app.customerConfirmPhone();
      expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
      const total = (await app.orderTotals()).total;
      const near = (t: string, x: number): number =>
        [...t.matchAll(/\$[\d,]+\.\d{2}/g)].filter(
          (m) => Math.abs(Number(m[0].replace(/[$,]/g, '')) * 100 - x) <= 1.1,
        ).length;

      await step('Split Equally: 2 checks → Add New Check → 3', async () => {
        await app.openSplit();
        await app
          .click([{ css: 'main' }, { role: 'button', name: 'Equally', nth: 0 }])
          .catch(() => undefined);
        const t0 = await app.text('main');
        expect(t0).toContain('Check 2');
        expect(near(t0, total / 2)).toBeGreaterThanOrEqual(1);
        await app.click([{ css: 'main' }, { text: 'Add New Check', nth: 0 }]);
        expect(await app.waitFor([{ css: 'main' }, { text: 'Check 3', nth: 0 }])).toBe(true);
        expect(near(await app.text('main'), total / 3)).toBeGreaterThanOrEqual(3);
      });
      let checkCents = NaN;
      await step('Check 1 Cash, 2 Other, 3 Gift Card', async () => {
        const t1 = await app.splitPayCheck(1, 'Cash');
        expect(t1).toContain('2 checks remaining - total');
        await app.closeCheckPaid();
        const t2 = await app.splitPayCheck(2, 'Other', { otherName: 'Zelle E2E' });
        expect(t2).toContain('1 check remaining - total');
        const rem = /remaining - total (\$[\d,.]+)/.exec(t2)?.[1];
        checkCents = rem ? Math.round(Number(rem.replace(/[$,]/g, '')) * 100) : NaN;
        await app.closeCheckPaid();
        expect(await app.splitPayCheck(3, 'Gift Card', { giftCode: GIFT_CARD })).toContain('All checks paid');
        await app.closeCheckPaid();
        await app.splitCompleteDone();
        untrack(code);
      });
      await step('payment-success + points', async () => {
        const s = await app.successText();
        expect(s).toMatch(/Check 1 \| Paid by Cash/);
        expect(s).toMatch(/Check 2 \| Paid by Other/);
        expect(s).toMatch(/Check 3 \| Paid by Gift Card/);
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        expect(await cust.earnedPoints()).toBeGreaterThan(0);
        await app.noReceipt();
      });
      await step('Order History', async () => {
        await app.openHistoryOrder(code);
        const dump = await app.historyDetail(code);
        expect(field(dump, 'Status')).toBe('Successful - Unsettled');
        for (const k of [1, 2, 3]) expect(dump).toContain(`#${code}-${String(k)}`);
        const pd = paymentDetails(dump);
        for (const m of ['Cash', 'Other', 'Gift Card']) expect(pd).toContain(m);
        expect(await app.has(CdMain.cancelOrder)).toBe(true);
        expect(await app.has([{ css: 'main' }, { role: 'button', nameRe: 'Refund', nth: 0 }])).toBe(false);
      });
      await step('Daily Sale row + gift card balance', async () => {
        ensure((await app.dailySaleRow(code)) !== null, `${code} never showed in Daily Sale`);
        const deadline = Date.now() + 180_000;
        let balance = await app.giftCardBalance(GIFT_CARD);
        while (Date.now() < deadline && balance >= balance0) {
          await app.pause(2_000);
          balance = await app.giftCardBalance(GIFT_CARD);
        }
        note(
          `E2E-031: balance ${usd(balance0)} → ${usd(balance)} (one check ≈ ${Number.isFinite(checkCents) ? usd(checkCents) : '?'})`,
        );
        expect(balance).toBeLessThan(balance0);
      });
    },
  );

  it(
    title(
      'Split: leaving with a paid check is blocked ("Please complete all checks before leaving"); void the Gift Card check (balance restored), then pay two Cash checks (E2E-033)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(10 * 60_000);
      if (!GIFT_CARD) this.skip();
      const d = await app.testData();
      const balance0 = await app.giftCardBalance(GIFT_CARD);
      const code = track(await app.createOrder({ services: [d.service, d.service] }));
      await app.openSplit();
      await app.click([{ css: 'main' }, { role: 'button', name: 'Equally', nth: 0 }]).catch(() => undefined);

      await step('Check 1 by Gift Card', async () => {
        expect(await app.splitPayCheck(1, 'Gift Card', { giftCode: GIFT_CARD })).toContain(
          '1 check remaining',
        );
        await app.closeCheckPaid();
      });
      await step('leaving is blocked', async () => {
        await app.routerGoRaw('/home');
        expect(await app.waitFor({ text: 'Please complete all checks before leaving', nth: 0 })).toBe(true);
        expect(await app.path()).toMatch(/split-order/);
      });
      await step('Void check 1', async () => {
        await app.click([{ css: 'main' }, { text: 'Void', nth: 0 }]);
        const dlg = { role: 'dialog' as const, hasText: 'Void Payment', nth: -1 };
        expect(await app.waitFor(dlg)).toBe(true);
        expect(await app.isDisabled([dlg, { role: 'button', name: 'Confirm Void', nth: 0 }])).toBe(true);
        await app.click([dlg, { role: 'combobox', nth: 0 }]);
        await app.click({ role: 'option', nth: 0 });
        await app.click([dlg, { role: 'button', name: 'Confirm Void', nth: 0 }]);
        await app.passcodeIfAsked(3_000);
        expect(await app.waitFor({ text: 'Void Payment Successful!', nth: 0 }, 20_000)).toBe(true);
        await app.click({ role: 'button', name: 'Done', nth: -1 });
      });
      await step('By Amount allowed → back to Equally → two Cash checks', async () => {
        await app.click([{ css: 'main' }, { role: 'button', name: 'By Amount', nth: 0 }]);
        expect(await app.has({ text: 'Please complete all checks before leaving', nth: 0 })).toBe(false);
        await app.click([{ css: 'main' }, { role: 'button', name: 'Equally', nth: 0 }]);
        expect(await app.splitPayCheck(1, 'Cash')).toContain('1 check remaining');
        await app.closeCheckPaid();
        expect(await app.splitPayCheck(2, 'Cash')).toContain('All checks paid');
        await app.closeCheckPaid();
        await app.splitCompleteDone();
        await app.successText();
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await app.noReceipt();
        untrack(code);
      });
      await step('balance restored; history Gift Card Voided + 2 Cash', async () => {
        const deadline = Date.now() + 150_000;
        let balance = await app.giftCardBalance(GIFT_CARD);
        while (Date.now() < deadline && balance !== balance0) {
          await app.pause(2_000);
          balance = await app.giftCardBalance(GIFT_CARD);
        }
        expectCents(balance, balance0, 'gift card balance after void', 0);
        await app.openHistoryOrder(code);
        const pd = paymentDetails(await app.historyDetail(code));
        expect(pd).toContain('Gift Card');
        expect(pd).toContain('Voided');
        expect((pd.match(/Cash/g) ?? []).length).toBeGreaterThanOrEqual(2);
      });
    },
  );

  it(
    title(
      'Re-open a split order (Cash + $1 tip, Other + $1 tip) with no change → every tender $0.00, no stray cent; history keeps #-1/#-2 and Tip $2.00 (E2E-029)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(10 * 60_000);
      if (process.env.VOLT_RUN_STUCK_BUG_TESTS !== '1') this.skip(); // volt-qc bug #22 leaves the order stuck
      const d = await app.testData();
      const code = track(await app.createOrder({ services: [d.service, d.service] }));
      await app.openSplit();
      await app.click([{ css: 'main' }, { role: 'button', name: 'Equally', nth: 0 }]).catch(() => undefined);
      await step('pay both checks with a $1 custom tip', async () => {
        expect(await app.splitPayCheck(1, 'Cash', { tip: { customCents: '100' } })).toContain(
          '1 check remaining',
        );
        await app.closeCheckPaid();
        expect(
          await app.splitPayCheck(2, 'Other', { otherName: 'Zelle E2E', tip: { customCents: '100' } }),
        ).toContain('All checks paid');
        await app.closeCheckPaid();
        await app.splitCompleteDone();
        expect(await app.successText()).toContain('Total Tip: $2.00');
        await app.noReceipt();
        untrack(code);
      });
      await step('Re-Open: all tenders $0.00 → Re-Open Done', async () => {
        await app.reopenOrder(code, { edit: false });
        for (const m of ['Card', 'Cash', 'Gift Card', 'Other'] as const)
          expect(await app.methodCents(m)).toBe(0);
        expect(await app.has(CdMain.reopenDone)).toBe(true);
        await app.reopenDone();
      });
      await step('history', async () => {
        await app.openHistoryOrder(code);
        const dump = await app.historyDetail(code);
        expect(dump).toContain(`#${code}-1`);
        expect(dump).toContain(`#${code}-2`);
        expect(field(dump, 'Tip')).toBe('$2.00');
        expect(field(dump, 'Status')).toMatch(/Successful/);
      });
    },
  );
});
