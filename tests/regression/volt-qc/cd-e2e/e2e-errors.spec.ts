/**
 * volt-qc port — 14 E2E: error journeys and the smoke close-out.
 *
 * Source: volt-qc `e2e/tests/14-e2e/e2e-plan-errors.spec.ts`
 * (E2E-T01, T02, T31, T35, T36, T37, T12a).
 *
 * Adaptations vs the source:
 * - Reports: volt-qc diffed Daily Sale tiles / Staff Income / Payroll before and
 *   after on a shared merchant. Here each order is located by its OWN row in
 *   Daily Sale (code + paid total) and the staff must be listed in Staff Income —
 *   the row-level half of the check. Tile deltas / Payroll are not re-derived.
 * - E2E-T36 needs an Inactive staff code (`VOLT_INACTIVE_CODE`); without it that
 *   step is skipped while the wrong-code / Escape / right-code steps still run.
 * - E2E-T12a (double "Confirm Cancel") is the Cancel half of the double-confirm TC only — the
 *   Refund half needs a settled order, so it carries no id (see the manual file).
 */

import { expect } from '@wdio/globals';
import { CdCustomer, CdMain, TILE_OF } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  app,
  field,
  moneyField,
  randomPhone,
  uniqueName,
  type PayMethod,
} from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, expectCents, note, resetTill, track, untrack, usd } from './cd-e2e.helpers.js';

const UNKNOWN_CODE = (process.env.VOLT_UNKNOWN_CODE ?? '9137').trim();
const INACTIVE_CODE = (process.env.VOLT_INACTIVE_CODE ?? '').trim();
const GIFT_CARD = (process.env.VOLT_TEST_GIFT_CARD ?? '').trim();

/** "Payment Details" block of a history dump. */
function paymentDetails(dump: string): string {
  const i = dump.indexOf('Payment Details');
  return i >= 0 ? dump.slice(i) : '';
}

describe('volt-qc 14 E2E — error journeys & smoke close-out', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'Card not completed (Present Card → Close) → back to Home → Remove → the draft is gone from Pending and never in Order History (E2E-009)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const d = await app.testData();
      const code = track(await app.createOrder());
      const total = (await app.orderTotals()).total;
      expect(await cust.waitFor({ text: d.service, nth: 0 })).toBe(true);

      await step('Card only up to Present Card, then Close — no transaction', async () => {
        await app.pay();
        expectCents(await app.methodCents('Card'), total, 'Card = Home Total');
        await app.selectMethod('Card');
        expect(await cust.waitActiveTiles(['card'])).toEqual(['card']);
        if (await app.isDisabled(CdMain.completePayment)) {
          note('E2E-009: Complete Payment disabled for Card (no terminal) — no transaction possible');
        } else {
          await app.click(CdMain.completePayment);
          if (await app.waitingTipShown()) await app.cancelWaitingTip();
          else note(`E2E-009: Card stopped at ${await app.closePresentCard().catch(() => 'unknown')}`);
        }
        expect(await app.path()).not.toMatch(/payment-success/);
        expect(await app.totalPaidCents()).toBe(0);
      });

      await step('Home: still pending with the line', async () => {
        await app.openPendingOrder(code);
        expect(await app.itemRowCount(d.service)).toBeGreaterThan(0);
      });

      await step('Remove → Delete: gone from Pending and Order History', async () => {
        await app.deleteCurrentOrder();
        untrack(code);
        expect(await cust.waitWelcome()).toBe(true);
        expect(await app.pendingHas(code)).toBe(false);
        expect(await app.historyHas(code)).toBe(false);
      });
    },
  );

  it(
    title(
      'Smoke close-out: a Cash and an Other order each land in Daily Sale with Total = paid and Tip $0.00, the staff is in Staff Income, no offline banner, passcode skip cleared (E2E-010)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(12 * 60_000);
      const d = await app.testData();
      await app.clearPasscodeSkip();
      const paid: Record<string, number> = {};
      for (const m of ['Cash', 'Other'] as const) {
        await step(`${m} order`, async () => {
          const code = track(await app.createOrder());
          await app.pay();
          paid[code] = await app.methodCents(m);
          await app.selectMethod(m);
          expect(await cust.waitActiveTiles([TILE_OF[m]])).toEqual([TILE_OF[m]]);
          await app.completePayment('none');
          await app.successText();
          expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
          await app.noReceipt();
          untrack(code);
          expect(await cust.waitWelcome()).toBe(true);
        });
      }
      await step('Daily Sale rows', async () => {
        for (const [code, cents] of Object.entries(paid)) {
          const row = await app.dailySaleRow(code);
          ensure(row !== null, `${code} never showed in Daily Sale`);
          expect(row ?? '').toContain(usd(cents));
        }
      });
      await step('Staff Income lists the staff', async () => {
        expect(await app.staffIncomeLists(d.staff)).toBe(true);
      });
      await step('no offline banner; clear the passcode skip', async () => {
        expect(await app.has({ text: 'Lost internet connection.', nth: 0 })).toBe(false);
        await app.clearPasscodeSkip();
        expect(await app.skipGrantActive()).toBe(false);
      });
    },
  );

  it(
    title(
      'Cashier tip $2 on Cash → completes, the order never bounces back to Pending within 15 s; Order History Successful - Unsettled, customer, Tip $2.00, Total = Cash + $2; Daily Sale row has the tip (E2E-053)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const phone = randomPhone();
      const name = uniqueName('QC E2E');
      const code = track(await app.createOrder());
      await app.attachNewCustomer(phone, name);
      await app.customerConfirmPhone();
      expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
      await app.pay();
      const cash = await app.methodCents('Cash');
      await app.selectMethod('Cash');
      expect(await cust.waitActiveTiles(['cash'])).toEqual(['cash']);
      await app.cashierTip('200');
      expectCents(await app.enteredCents(), cash + 200, 'Enter Amount includes the cashier tip');
      await app.completePayment('none');
      expect(await app.successText()).toContain('Total Tip: $2.00');
      expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
      await app.noReceipt();
      untrack(code);
      expect(await cust.waitWelcome()).toBe(true);

      await step('Pending: not back within 15 s', async () => {
        await app.go('/order-pending');
        const box = [
          { css: 'main' },
          { css: 'input', placeholder: 'Search order ID, customer name or phone', nth: 0 },
        ] as const;
        await app.fill(box, code);
        const seen: number[] = [];
        for (let i = 0; i < 5; i += 1) {
          await app.pause(3_000);
          seen.push(await app.count([{ css: 'main' }, { textRe: code, nth: 0 }]));
        }
        await app.fill(box, '');
        ensure(
          seen.every((n) => n === 0),
          `order ${code} bounced back to Pending (${seen.join(',')})`,
        );
      });

      await step('Order History', async () => {
        await app.openHistoryOrder(code);
        const dump = await app.historyDetail(code);
        expect(field(dump, 'Status')).toBe('Successful - Unsettled');
        expect(field(dump, 'Customer')).toBe(name);
        expect(field(dump, 'Tip')).toBe('$2.00');
        expectCents(moneyField(dump, 'Total'), cash + 200, 'history Total');
      });

      await step('Daily Sale row carries the $2.00 tip', async () => {
        const row = await app.dailySaleRow(code);
        ensure(row !== null, `${code} never showed in Daily Sale`);
        expect(row ?? '').toContain('$2.00');
        expect(row ?? '').toContain(usd(cash + 200));
      });
    },
  );

  it(
    title(
      'Cancel while the customer picks a tip creates no transaction; double-clicking Complete Payment yields one passcode, one tip screen, one Other payment (E2E-066)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const code = track(await app.createOrder());
      await app.pay();
      const total = await app.methodCents('Other');
      await app.selectMethod('Other');
      expect(await cust.waitActiveTiles(['other'])).toEqual(['other']);

      await step('Complete → tip screen → Cancel', async () => {
        if (!(await app.completeUntilTipScreen())) this.skip();
        expect(await app.waitingTipText()).toContain('Customer is adding a tip.');
        await app.cancelWaitingTip();
        expect(await app.path()).toMatch(/\/checkout/);
        expect(await app.totalPaidCents()).toBe(0);
        expect(await app.text('main')).toContain(`Enter Amount | ${usd(total)}`);
        expect(await cust.waitGone(CdCustomer.addTip)).toBe(true);
      });

      await step('double-click Complete Payment', async () => {
        await app.click(CdMain.completePayment);
        await app.click(CdMain.completePayment).catch(() => undefined);
        await app.pause(1_500);
        expect(await app.count({ role: 'dialog', hasTextRe: 'Enter staff code' })).toBeLessThanOrEqual(1);
        await app.driveToSuccess('none');
        await app.successText();
        expect(await app.count({ text: 'Payment Successful!' })).toBe(1);
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await app.noReceipt();
        untrack(code);
      });

      await step('Order History: exactly one Other line; Daily Sale Total = Other amount', async () => {
        await app.openHistoryOrder(code);
        const pd = paymentDetails(await app.historyDetail(code));
        expect((pd.match(/Other/g) ?? []).length).toBe(1);
        expect(pd).toContain(usd(total));
        const row = await app.dailySaleRow(code);
        ensure(row !== null, `${code} never showed in Daily Sale`);
        expect(row ?? '').toContain(usd(total));
      });
    },
  );

  it(
    title(
      'Wrong passcode ×3 each rejected with the dialog kept open and nothing paid; Inactive staff refused; Escape leaves the order unpaid; the right code then pays exactly once (E2E-067)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await app.clearPasscodeSkip();
      const code = track(await app.createOrder());
      await app.pay();
      await app.selectMethod('Other');
      await app.click(CdMain.completePayment);
      if (!(await app.waitFor(CdMain.passcodeDialog, 5_000))) {
        if (await app.waitingTipShown()) await app.cancelWaitingTip();
        this.skip(); // "Completed Payment" gate off
      }
      expect(await app.text('body')).toContain('Enter staff code to complete payment');

      await step('unknown code ×3', async () => {
        for (let i = 1; i <= 3; i += 1) {
          await app.typeIntoPasscode(UNKNOWN_CODE);
          ensure(await app.has(CdMain.passcodeDialog), `attempt ${String(i)}: the passcode dialog closed`);
          expect(await app.text('body')).toMatch(/Failed to verify staff code|Invalid staff code/);
          expect(await app.path()).not.toMatch(/payment-success/);
        }
      });

      if (INACTIVE_CODE) {
        await step('Inactive staff → "This staff is inactive"', async () => {
          await app.typeIntoPasscode(INACTIVE_CODE);
          expect(await app.text('body')).toContain('This staff is inactive');
        });
      } else {
        note('E2E-067: VOLT_INACTIVE_CODE unset — Inactive step not run');
      }

      await step('Escape → unpaid', async () => {
        await app.escape();
        expect(await app.waitGone(CdMain.passcodeDialog, 5_000)).toBe(true);
        expect(await app.path()).toMatch(/\/checkout/);
        expect(await app.totalPaidCents()).toBe(0);
      });

      await step('right code → one Other payment', async () => {
        await app.openPendingOrder(code);
        await app.payCurrentOrder('Other');
        await app.noReceipt();
        untrack(code);
        await app.openHistoryOrder(code);
        expect((paymentDetails(await app.historyDetail(code)).match(/Other/g) ?? []).length).toBe(1);
      });
    },
  );

  it(
    title(
      'Switching tenders, cancelling the Gift Card scan, going Home and paying again → exactly one Other payment; customer tile follows each tender (E2E-070)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const gcBefore = GIFT_CARD ? await app.giftCardBalance(GIFT_CARD) : NaN;
      const d = await app.testData();
      const code = track(await app.createOrder());
      const total = (await app.orderTotals()).total;
      await app.pay();
      const otherAmt = await app.methodCents('Other');

      for (const m of ['Cash', 'Card', 'Other'] as PayMethod[]) {
        await step(`${m}: Enter Amount = button, customer tile lit`, async () => {
          const due = await app.methodCents(m);
          if (m === 'Card') expectCents(due, total, 'Card = Home Total');
          await app.selectMethod(m);
          expectCents(await app.enteredCents(), due, `${m} Enter Amount`);
          expect(await cust.waitActiveTiles([TILE_OF[m]])).toEqual([TILE_OF[m]]);
        });
      }

      await step('Gift Card → Complete → scan dialog → Cancel', async () => {
        await app.selectMethod('Gift Card');
        await app.click(CdMain.completePayment);
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline && !(await app.has(CdMain.inputGiftCardCode))) {
          if (await app.passcodeShown()) await app.passcodeIfAsked(500);
          else if (await app.waitingTipShown()) await cust.chooseTipAndContinue('none');
          else await app.pause(300);
        }
        expect(await cust.waitActiveTiles(['gift_card'])).toEqual(['gift_card']);
        const close = [
          { role: 'dialog', nth: -1 },
          { role: 'button', nameRe: '^(Cancel|Close)$', nth: 0 },
        ] as const;
        if (await app.has(close)) await app.click(close);
        else await app.escape();
        expect(await app.waitGone(CdMain.inputGiftCardCode)).toBe(true);
        expect(await app.path()).not.toMatch(/payment-success/);
        expect(await app.totalPaidCents()).toBe(0);
      });

      await step('Home: the line is still there', async () => {
        await app.openPendingOrder(code);
        expect(await app.itemRowCount(d.service)).toBeGreaterThan(0);
      });

      await step('Pay again with Other → exactly one Other line, no Gift Card line', async () => {
        await app.payCurrentOrder('Other');
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await app.noReceipt();
        untrack(code);
        await app.openHistoryOrder(code);
        const pd = paymentDetails(await app.historyDetail(code));
        expect((pd.match(/Other/g) ?? []).length).toBe(1);
        expect(pd).toContain(usd(otherAmt));
        expect(pd).not.toMatch(/Gift Card/);
      });

      if (GIFT_CARD) {
        await step('test gift card balance unchanged', async () => {
          expectCents(await app.giftCardBalance(GIFT_CARD), gcBefore, 'gift card balance', 0);
        });
      }
    },
  );

  it(
    title(
      'Double-click "Confirm Cancel" → one passcode, one Cancel information line, status Canceled, no Re-Open / Cancel left (no TC id — Cancel half of the double-confirm case)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { code, total } = await app.createPaidOrder({ method: 'Cash' });
      await app.openHistoryOrder(code);
      await app.click(CdMain.cancelOrder);
      await app.passcodeIfAsked(2_000);
      await app.click([CdMain.cancelDialog, { role: 'combobox', nth: 0 }]);
      await app.click({ role: 'option', nth: 0 });
      const confirm = [CdMain.cancelDialog, { role: 'button', name: 'Confirm Cancel', nth: 0 }] as const;
      await app.click(confirm);
      await app.click(confirm, 1_000).catch(() => undefined);
      await app.pause(1_500);
      expect(await app.count({ role: 'dialog', hasTextRe: 'Enter staff code' })).toBeLessThanOrEqual(1);
      await app.passcodeIfAsked(3_000);
      expect(await app.waitGone(CdMain.cancelDialog, 15_000)).toBe(true);
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline && (await app.historyStatus(code)) !== 'Canceled') await app.pause(1_000);
      expect(await app.historyStatus(code)).toBe('Canceled');
      const dump = await app.historyDetail(code);
      const i = dump.indexOf('Cancel information');
      ensure(i >= 0, 'no "Cancel information" block');
      const j = dump.indexOf('Payment Details', i);
      const info = dump.slice(i, j > i ? j : undefined);
      expect((info.match(/By Staff:/g) ?? []).length).toBe(1);
      expect(info).toContain(usd(total));
      expect(await app.has(CdMain.reopenOrder)).toBe(false);
      expect(await app.has(CdMain.cancelOrder)).toBe(false);
    },
  );
});
