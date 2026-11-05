/**
 * VP-5195 — the customer display's "No, enter again" left the refused customer
 * on the staff order (points could land on the wrong customer). Fix: PR #3250 →
 * develop #3258 (>= 1.1.98). Sub-bug VP-5711: the Pending Orders card / stored
 * `total` keep the pre-removal total after "No".
 *
 * docs/qc/volt-qc/vp-tickets/VP-5195-customer-display-phone-reject-test-cases.md (TC-VP5195-01..13)
 *
 *   npm run test:attach -- --spec tests/regression/customer-display/vp-5195-phone-reject.spec.ts
 *
 * Every case opens its own Quick Checkout order (deleted by `resetTill`), types
 * customer A's phone on the staff keypad and answers on the customer window.
 * TC-10 pays one order in Cash. Test data: see vp-5195.helpers.ts.
 *
 * CREATES DATA. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { CdCustomer, CdMain } from '../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { switchToMain } from '../../../src/helpers/window.js';
import { app, masked } from '../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { ensure, expectCents, resetTill, track, untrack } from '../volt-qc/cd-e2e/cd-e2e.helpers.js';
import {
  applyPromoRows,
  closeStaffKeypad,
  customerByPhone,
  hasCustomerChip,
  orderRow,
  waitPendingCardTotal,
  REJECTED_TOAST_RE,
  rewardRedemptionCents,
  staffKeypadOpen,
  toastTexts,
  vp5195,
  waitCustomerChip,
  waitOrderRow,
  waitToast,
} from './vp-5195.helpers.js';

/** New order, A typed on the staff keypad; the customer window asks "Is this your phone number?". */
async function orderAskingA(): Promise<string> {
  const code = track(await app.createOrder());
  await app.attachExistingCustomer(vp5195.phoneA);
  expect(await cust.waitFor(CdCustomer.isThisYourPhone)).toBe(true);
  await app.closeStrayDialogs(); // Customer Note pop-up
  return code;
}

/** Customer presses "No, enter again"; returns the rejection toast text ('' when none). */
async function customerRefuses(): Promise<string> {
  await cust.confirm('No, enter again');
  return waitToast(REJECTED_TOAST_RE);
}

describe('VP-5195 — customer display "No, enter again" takes the refused customer off the order', () => {
  before(async () => {
    // The attach lane can hand the session over on the customer window.
    await switchToMain();
    await returnToHome();
    // Fail fast on ambiguous test data rather than in the middle of a case.
    await customerByPhone(vp5195.phoneA);
    await customerByPhone(vp5195.phoneB);
  });

  beforeEach(async () => {
    await switchToMain();
  });

  afterEach(async () => {
    // returnToHome on the customer window would route it onto a staff page.
    await switchToMain().catch(() => undefined);
    await resetTill();
  });

  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  describe('1. "No, enter again"', () => {
    it(
      title(
        'TC-VP5195-01: No → staff order drops the customer, shows the toast, reopens the keypad',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const code = await orderAskingA();
        expect(await hasCustomerChip()).toBe(true);

        const toast = await customerRefuses();
        ensure(toast !== '', `no rejection toast; toasts on screen: ${JSON.stringify(await toastTexts())}`);
        expect(await waitCustomerChip(false)).toBe(true);
        expect(await staffKeypadOpen()).toBe(true);

        const row = await waitOrderRow(code, (r) => r.customerId === null);
        expect(row.customerId).toBeNull();
      },
    );

    it(
      title(
        'TC-VP5195-02: after No the customer display is back on an empty keypad with the cart still shown',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const d = await app.testData();
        await orderAskingA();
        await customerRefuses();

        expect(await cust.waitFor(CdCustomer.phoneInput)).toBe(true);
        expect(await cust.phoneValue()).toBe('');
        expect(await cust.has(CdCustomer.isThisYourPhone)).toBe(false);
        expect(await cust.isWelcome()).toBe(false);
        expect(await cust.has(CdCustomer.orderDetails)).toBe(true);
        expect(await cust.has(CdCustomer.staffGroup(d.staff))).toBe(true);
      },
    );

    it(
      title(
        'TC-VP5195-03: after No the customer keys another number → that customer is attached, not the refused one',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const a = await customerByPhone(vp5195.phoneA);
        const b = await customerByPhone(vp5195.phoneB);
        const code = await orderAskingA();
        await customerRefuses();

        await cust.enterPhone(vp5195.phoneB);
        expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
        expect(await cust.has({ text: masked(vp5195.phoneB), nth: 0 })).toBe(true);
        expect(await cust.currentPoints()).toBe(b.pointBalance);

        expect(await app.waitFor(CdMain.customerBox)).toBe(true);
        await app.closeStrayDialogs();
        const box = await app.customerBoxText();
        expect(box).toContain(masked(vp5195.phoneB));
        expect(box).not.toContain(masked(vp5195.phoneA));
        const row = await waitOrderRow(code, (r) => r.customerId === b.id);
        expect(row.customerId).toBe(b.id);
        expect(row.customerId).not.toBe(a.id);
      },
    );

    it(
      title(
        'TC-VP5195-04: after No the customer keys the same number again → re-attached',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const a = await customerByPhone(vp5195.phoneA);
        const code = await orderAskingA();
        await customerRefuses();

        await cust.enterPhone(vp5195.phoneA);
        expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
        expect(await cust.currentPoints()).toBe(a.pointBalance);
        expect(await waitCustomerChip(true)).toBe(true);
        await app.closeStrayDialogs();
        expect(await app.customerBoxText()).toContain(masked(vp5195.phoneA));
        expect((await waitOrderRow(code, (r) => r.customerId === a.id)).customerId).toBe(a.id);
      },
    );

    it(
      title(
        'TC-VP5195-05: Yes keeps the customer and raises no rejection toast (regression)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const a = await customerByPhone(vp5195.phoneA);
        const code = await orderAskingA();

        await cust.confirm('Yes');
        expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
        expect(await waitToast(REJECTED_TOAST_RE, 3_000)).toBe('');
        expect(await hasCustomerChip()).toBe(true);
        expect((await orderRow(code)).customerId).toBe(a.id);
      },
    );
  });

  describe('2. Rewards / promotions / custom discount', () => {
    it(
      title(
        'TC-VP5195-06: No with a promotion + reward → both dropped; Pending card and stored total follow the panel (VP-5711)',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
        Tag.BROKEN,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const code = await orderAskingA();
        const base = (await app.orderTotals()).total;

        await step(`Apply "${vp5195.promotion}" + "${vp5195.reward}"`, () =>
          applyPromoRows([vp5195.promotion, vp5195.reward]),
        );
        const discounted = (await app.orderTotals()).total;
        ensure(
          discounted < base,
          `promo + reward did not lower the total (${String(base)} → ${String(discounted)})`,
        );
        const applied = await orderRow(code);
        ensure(applied.redeemId !== null, 'reward was not stamped on the order before "No"');

        await customerRefuses();
        await waitCustomerChip(false);
        await closeStaffKeypad();

        const row = await waitOrderRow(code, (r) => r.customerId === null && r.redeemId === null);
        expect(row.customerId).toBeNull();
        expect(row.redeemId).toBeNull();
        expect(row.campaignId).toBeNull();
        expect(Number.isNaN(await rewardRedemptionCents())).toBe(true);

        const panel = (await app.orderTotals()).total;
        expectCents(panel, base, 'panel Total after "No"');
        // VP-5711: the card and the stored total keep the discounted figure.
        expectCents(
          await waitPendingCardTotal(code, panel),
          panel,
          'Pending Orders card total 15 s after "No"',
        );
        expectCents((await waitOrderRow(code, (r) => r.total === panel)).total, panel, 'stored order total');
      },
    );

    it(
      title(
        'TC-VP5195-07: No with custom discount + reward → reward dropped, custom discount kept',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const code = await orderAskingA();
        await step(`Custom Discount 10% + "${vp5195.reward}"`, () => applyPromoRows([vp5195.reward], 10));
        ensure((await orderRow(code)).redeemId !== null, 'reward was not stamped on the order before "No"');

        await customerRefuses();
        await waitCustomerChip(false);
        await closeStaffKeypad();

        const row = await waitOrderRow(code, (r) => r.customerId === null && r.redeemId === null);
        expect(row.customerId).toBeNull();
        expect(row.redeemId).toBeNull();
        expect(Number.isNaN(await rewardRedemptionCents())).toBe(true);
        const t = await app.orderTotals();
        ensure(
          Number.isFinite(t.promotion) && t.promotion !== 0,
          `custom discount line gone: ${JSON.stringify(t)}`,
        );
      },
    );

    it(
      title(
        'TC-VP5195-08: cashier removes the customer by hand → promotion + reward dropped, card total updated',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const code = await orderAskingA();
        await cust.confirm('Yes');
        await app.closeStrayDialogs();
        const base = (await app.orderTotals()).total;
        await applyPromoRows([vp5195.promotion, vp5195.reward]);

        await app.removeCustomer();
        await closeStaffKeypad();

        const row = await waitOrderRow(code, (r) => r.customerId === null && r.redeemId === null);
        expect(row.redeemId).toBeNull();
        expect(row.campaignId).toBeNull();
        const panel = (await app.orderTotals()).total;
        expectCents(panel, base, 'panel Total after manual remove');
        expectCents(
          await waitPendingCardTotal(code, panel),
          panel,
          'Pending Orders card total 15 s after manual remove',
        );
      },
    );
  });

  describe('3. Lock while paying, and payment after "No"', () => {
    it(
      title(
        'TC-VP5195-09: Pay while the display still asks → "No, enter again" is no longer offered',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await orderAskingA();
        expect(await cust.has(CdCustomer.noEnterAgain)).toBe(true);

        await app.pay();
        expect(await cust.waitGone(CdCustomer.noEnterAgain)).toBe(true);
      },
    );

    it(
      title(
        'TC-VP5195-10: pay after No without re-keying → order paid with no customer, refused customer earns nothing',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const before = await customerByPhone(vp5195.phoneA);
        const code = await orderAskingA();
        await customerRefuses();
        await waitCustomerChip(false);
        await closeStaffKeypad();

        await app.pay();
        await app.selectMethod('Cash');
        await app.completePayment('none');
        untrack(code);
        await app.noReceipt();

        const row = await waitOrderRow(code, (r) => r.status === 'successful');
        expect(row.status).toBe('successful');
        expect(row.customerId).toBeNull();
        expect((await customerByPhone(vp5195.phoneA)).pointBalance).toBe(before.pointBalance);
      },
    );

    // PENDING — commented out so the run reports no SKIP rows (see the doc's "Ghi chú automation"):
    // TC-VP5195-11: re-opened order offers no "No, enter again"
    //   (covered by tests/regression/volt-qc/cd-e2e/cd-phone.spec.ts CD-028)
    // TC-VP5195-12: Vietnamese toast copy
    //   (app language is merchant-global @exclusive state; run by hand)
    // TC-VP5195-13: semi / D5 customer display
    //   (Android devices, not on the Windows lane)
  });
});
