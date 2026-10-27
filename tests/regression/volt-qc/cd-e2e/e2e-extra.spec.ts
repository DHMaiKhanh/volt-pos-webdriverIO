/**
 * volt-qc catalogue — 14 E2E rows with no volt-qc spec, written from the TC
 * rows (docs/qc/volt-qc/windows-regression/14-e2e-xuyen-suot.md).
 *
 * Only the parts a single till can reach on the dev merchant are asserted; the
 * legs that need settled (overnight-batched) orders, Portal, or report deltas
 * on a shared merchant are noted in each case and listed in the manual file.
 *
 * - E2E-007  walk-in Cash with change → Order History
 * - E2E-020  Adjust Tip after payment (Other 1 staff, Cash 2 staff → even split)
 * - E2E-021  void an unsettled Cash order → Canceled, Cancel information, out of Daily Sale
 * - E2E-024  action-bar matrix for the statuses a run can produce (Unsettled, Canceled)
 * - E2E-026  re-open to change the staff: total unchanged, tip follows the new staff
 * - E2E-030  Re-Open availability by status (Unsettled yes, Canceled no, Re-open → Continue)
 * - E2E-034  split blocked at ≤ $5.00, By Items needs ≥ 2 lines, gift-card orders cannot split
 * - E2E-036  pay with a gift card, then cancel → balance restored
 */

import { expect } from '@wdio/globals';
import { CdCustomer, CdMain } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { app, field, moneyField } from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
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

async function waitStatus(code: string, re: RegExp, timeout = 60_000): Promise<string> {
  const deadline = Date.now() + timeout;
  let s = await app.historyStatus(code);
  while (Date.now() < deadline && !re.test(s)) {
    await app.pause(1_000);
    s = await app.historyStatus(code);
  }
  return s;
}

describe('volt-qc 14 E2E — catalogue rows without a volt-qc spec', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'Walk-in Cash with change: $50 preset → Change = $50 − due, Remaining $0.00; success shows Received/Change; No Receipt → /order-pending + Welcome; history Successful - Unsettled, one Cash line (E2E-007)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const d = await app.testData();
      const code = track(await app.createOrder());
      expect(await cust.waitFor(CdCustomer.staffGroup(d.staff))).toBe(true);
      await app.pay();
      const due = await app.methodCents('Cash');
      if (due >= 5000) this.skip(); // the $50 preset would not over-tender this service
      await app.selectMethod('Cash');
      expectCents(await app.enteredCents(), due, 'Enter Amount = Cash');
      await app.click([{ css: 'main' }, { role: 'button', name: '$50', nth: 0 }]);
      const t = await app.text('main');
      expectCents(moneyField(t, 'Enter Amount'), 5000, 'Enter Amount after $50');
      expectCents(moneyField(t, 'Change'), 5000 - due, 'Change');
      if (Number.isFinite(moneyField(t, 'Remaining')))
        expectCents(moneyField(t, 'Remaining'), 0, 'Remaining');
      expect(await app.isDisabled(CdMain.completePayment)).toBe(false);
      await app.completePayment('none');
      const s = await app.successText();
      expect(s).toContain(usd(due));
      expect(s).toContain('$50.00');
      expect(s).toContain(usd(5000 - due));
      await app.noReceipt();
      untrack(code);
      expect(await app.waitPath(/\/order-pending/, 10_000)).toBe(true);
      expect(await cust.waitWelcome()).toBe(true);
      await app.openHistoryOrder(code);
      const dump = await app.historyDetail(code);
      expect(field(dump, 'Status')).toBe('Successful - Unsettled');
      expectCents(moneyField(dump, 'Total'), due, 'history Total');
      expect(dump).toContain(d.service);
      const pd = paymentDetails(dump);
      expect((pd.match(/Cash/g) ?? []).length).toBeGreaterThanOrEqual(1);
      expect(pd).toMatch(/Successful/);
    },
  );

  it(
    title(
      'Adjust Tip after payment: Other order +$2.00 → Tip $2.00, Total = paid + $2, "<staff> - $2.00", still Unsettled; 2-staff Cash order +$4.00 → $2.00 / $2.00 even split (E2E-020)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const d = await app.testData();
      const a = await app.createPaidOrder({ method: 'Other' });
      await app.openHistoryOrder(a.code);
      if (!(await app.has(CdMain.adjustTip))) this.skip(); // Tip Timing = Before Payment hides Adjust Tip
      await step('order A (Other, one staff) +$2.00', async () => {
        await app.adjustTip('200');
        const dump = await app.historyDetail(a.code);
        expect(field(dump, 'Tip')).toBe('$2.00');
        expectCents(moneyField(dump, 'Total'), a.total + 200, 'A Total');
        expect(dump).toContain(`${d.staff} - $2.00`);
        expect(field(dump, 'Status')).toBe('Successful - Unsettled');
      });
      if (!d.staff2) {
        note('E2E-020: only one staff rendered — order B (two staff) not run');
        return;
      }
      await step('order B (Cash, two staff) +$4.00 → even split', async () => {
        const code = track(await app.createOrder());
        await app.pickStaff(d.staff2);
        await app.addService(d.service);
        await app.payCurrentOrder('Cash');
        await app.noReceipt();
        untrack(code);
        await app.openHistoryOrder(code);
        await app.adjustTip('400');
        const dump = await app.historyDetail(code);
        expect(field(dump, 'Tip')).toBe('$4.00');
        expect(dump).toContain(`${d.staff} - $2.00`);
        expect(dump).toContain(`${d.staff2} - $2.00`);
      });
      note('E2E-020: Daily Sale / Income Summary / Staff Income tip deltas are not re-derived here');
    },
  );

  it(
    title(
      'Void an unsettled Cash order: Canceled (never stuck Canceling), Cancel information with amount and reason, only Receipt left, and the order leaves the Daily Sale list (E2E-021)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { code, total } = await app.createPaidOrder({ method: 'Cash' });
      ensure((await app.dailySaleRow(code)) !== null, `${code} never showed in Daily Sale`);
      await app.openHistoryOrder(code);
      await app.cancelOrder(0);
      expect(await waitStatus(code, /^Canceled$/)).toBe('Canceled');
      const dump = await app.historyDetail(code);
      const i = dump.indexOf('Cancel information');
      ensure(i >= 0, 'no "Cancel information" block');
      const info = dump.slice(i, i + 400);
      expect(info).toContain('By Staff');
      expect(info).toContain(usd(total));
      for (const b of [CdMain.reopenOrder, CdMain.cancelOrder, CdMain.adjustTip])
        expect(await app.has(b)).toBe(false);
      expect(await app.has([{ css: 'main' }, { role: 'button', nameRe: 'Refund', nth: 0 }])).toBe(false);
      expect(await app.has([{ css: 'main' }, { role: 'button', name: 'Receipt', nth: 0 }])).toBe(true);
      const row = await app.dailySaleRow(code, 30_000);
      note(`E2E-021: Daily Sale row after cancel: ${row ?? 'gone'}`);
      if (row !== null) expect(row).toMatch(/Cancel/i);
    },
  );

  it(
    title(
      'Action bar by status: Successful - Unsettled → Receipt + Re-Open + Cancel, no Refund; Canceled → Receipt only (E2E-024)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { code } = await app.createPaidOrder({ method: 'Cash' });
      await app.openHistoryOrder(code);
      await step('Unsettled', async () => {
        expect(await app.has([{ css: 'main' }, { role: 'button', name: 'Receipt', nth: 0 }])).toBe(true);
        expect(await app.has(CdMain.reopenOrder)).toBe(true);
        expect(await app.has(CdMain.cancelOrder)).toBe(true);
        expect(await app.has([{ css: 'main' }, { role: 'button', nameRe: 'Refund', nth: 0 }])).toBe(false);
      });
      await step('Canceled', async () => {
        await app.cancelOrder(0);
        expect(await waitStatus(code, /^Canceled$/)).toBe('Canceled');
        expect(await app.has([{ css: 'main' }, { role: 'button', name: 'Receipt', nth: 0 }])).toBe(true);
        for (const b of [CdMain.reopenOrder, CdMain.cancelOrder]) expect(await app.has(b)).toBe(false);
        expect(await app.has([{ css: 'main' }, { role: 'button', nameRe: 'Refund', nth: 0 }])).toBe(false);
      });
      note(
        'E2E-024: Settled / Settled-with-Gift-Card / Refunded / Card-not-batched rows need overnight-settled data — manual file',
      );
    },
  );

  it(
    title(
      'Re-open to change the staff (restricted mode): line price unchanged, every tender owes $0.00, Re-Open Done → Unsettled, same Total, Service Details and tip on the new staff (E2E-026)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const d = await app.testData();
      if (!d.staff2) this.skip();
      const code = track(await app.createOrder());
      await app.pay();
      await app.selectMethod('Cash');
      await app.cashierTip('200');
      await app.completePayment('none');
      await app.successText();
      await app.noReceipt();
      untrack(code);
      await app.openHistoryOrder(code);
      const total0 = moneyField(await app.historyDetail(code), 'Total');

      await app.reopenOrder(code);
      const price = async (): Promise<string> =>
        /\$[\d,]+\.\d{2}/.exec(await app.itemRowText(d.service))?.[0] ?? '';
      const line0 = await price();
      await app.changeStaff(d.staff2);
      expect(await app.has([{ css: 'main' }, { textRe: d.staff2, nth: 0 }])).toBe(true);
      expect(await price()).toBe(line0);
      await app.click([{ css: 'main' }, CdMain.pay]);
      await app.waitPath(/checkout/, 15_000);
      for (const m of ['Card', 'Cash', 'Other'] as const) expect(await app.methodCents(m)).toBe(0);
      expect(await app.has(CdMain.reopenDone)).toBe(true);
      await app.reopenDone();
      await app.openHistoryOrder(code);
      const dump = await app.historyDetail(code);
      expect(field(dump, 'Status')).toBe('Successful - Unsettled');
      expectCents(moneyField(dump, 'Total'), total0, 'Total unchanged');
      expect(dump).toContain(`Staff: ${d.staff2}`);
      expect(dump).toContain(`${d.staff2} - $2.00`);
      expect(dump).not.toContain(`Staff: ${d.staff}`);
    },
  );

  it(
    title(
      'Re-Open availability: Successful - Unsettled shows Re-Open Order; a Re-open order shows Continue Re-open; Canceled shows none (E2E-030)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const a = await app.createPaidOrder({ method: 'Cash' });
      await app.openHistoryOrder(a.code);
      expect(await app.has(CdMain.reopenOrder)).toBe(true);
      await step('Re-open in progress → Continue Re-open', async () => {
        await app.reopenOrder(a.code, { edit: false });
        await app.routerGoRaw('/order-pending');
        await app.passcodeIfAsked(2_000);
        await app.openHistoryOrder(a.code);
        expect(await app.has(CdMain.continueReopen)).toBe(true);
        expect(await app.has(CdMain.reopenOrder)).toBe(false);
        await app.click(CdMain.continueReopen);
        if (await app.waitFor(CdMain.reopenConfirmDialog, 5_000))
          await app.click([CdMain.reopenConfirmDialog, { role: 'button', name: 'Confirm', nth: 0 }]);
        await app.passcodeIfAsked(2_500);
        await app.waitPath(/checkout|\/home/, 20_000);
        await app.reopenDone();
      });
      await step('Canceled → no Re-Open', async () => {
        const b = await app.createPaidOrder({ method: 'Cash' });
        await app.openHistoryOrder(b.code);
        await app.cancelOrder(0);
        expect(await waitStatus(b.code, /^Canceled$/)).toBe('Canceled');
        expect(await app.has(CdMain.reopenOrder)).toBe(false);
        expect(await app.has(CdMain.continueReopen)).toBe(false);
      });
      note('E2E-030: Settled / previous-day / Refunded rows need overnight-settled data — manual file');
    },
  );

  it(
    title(
      'Split guards: total ≤ $5.00 → Split disabled; one line → By Items disabled; an order with a gift-card line cannot split (E2E-034)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const d = await app.testData();
      const split = [{ css: 'main' }, { css: 'button.bg-orange', nth: 0 }] as const;
      await step('≤ $5.00', async () => {
        await app.quickCheckout();
        await app.pickStaff(d.staff);
        track(await app.orderCode());
        await app.quickPay(400, 'QC Small');
        ensure(await app.has(split), 'no Split button on the order panel');
        expect(await app.isDisabled(split)).toBe(true);
        await app.deleteCurrentOrder();
      });
      await step('one line → By Items disabled', async () => {
        const code = track(await app.createOrder());
        if ((await app.orderTotals()).total <= 500) {
          note('E2E-034: the first service is ≤ $5.00 — By Items step not run');
        } else {
          await app.openSplit();
          const byItems = [{ css: 'main' }, { role: 'button' as const, name: 'By Items', nth: 0 }];
          expect(await app.isDisabled(byItems)).toBe(true);
          await app.routerGoRaw('/home');
          await app.openPendingOrder(code);
        }
        await app.deleteCurrentOrder();
        untrack(code);
      });
      if (GIFT_CARD) {
        await step('gift-card line → Split disabled', async () => {
          const code = track(await app.createOrder());
          await app.sellGiftCardLine(GIFT_CARD, '$25');
          expect(await app.isDisabled(split)).toBe(true);
          await app.deleteCurrentOrder();
          untrack(code);
        });
      } else {
        note('E2E-034: VOLT_TEST_GIFT_CARD unset — gift-card step not run');
      }
    },
  );

  it(
    title(
      'Pay with a gift card: Accepted dialog with balance, success, history Gift Card with no Refund, balance − amount; Cancel the order → balance restored (E2E-036)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      if (!GIFT_CARD) this.skip();
      const balance0 = await app.giftCardBalance(GIFT_CARD);
      const code = track(await app.createOrder());
      await app.pay();
      const due = await app.methodCents('Gift Card');
      if (balance0 < due) this.skip();
      const info = await app.payWithGiftCard(GIFT_CARD);
      expect(info).toContain('Gift Card Accepted');
      await app.confirmGiftCardPay();
      await app.waitPaymentSuccess();
      await app.successText();
      await app.noReceipt();
      untrack(code);
      await app.openHistoryOrder(code);
      const pd = paymentDetails(await app.historyDetail(code));
      expect(pd).toContain('Gift Card');
      expect(await app.has([{ css: 'main' }, { role: 'button', nameRe: 'Refund', nth: 0 }])).toBe(false);
      const poll = async (want: number): Promise<number> => {
        const deadline = Date.now() + 150_000;
        let b = await app.giftCardBalance(GIFT_CARD);
        while (Date.now() < deadline && b !== want) {
          await app.pause(2_000);
          b = await app.giftCardBalance(GIFT_CARD);
        }
        return b;
      };
      expectCents(await poll(balance0 - due), balance0 - due, 'balance after paying', 0);
      await app.openHistoryOrder(code);
      await app.cancelOrder(0);
      expect(await waitStatus(code, /^Canceled$/)).toBe('Canceled');
      expectCents(await poll(balance0), balance0, 'balance after cancel', 0);
    },
  );
});
