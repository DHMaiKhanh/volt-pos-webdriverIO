/**
 * volt-qc port — 04 PROMO: customer points & visits (PROMO-M / M2 / J2 / PT).
 *
 * Source: volt-qc `e2e/tests/04-promo/promo-plan-points.spec.ts` (PROMO-M0..J2).
 * TC catalogue: docs/qc/volt-qc/windows-regression/04-khuyen-mai-diem-giftcard.md.
 *
 * Writes: every case creates and settles orders (Other / Cash) with new
 * customers (randomPhone / uniqueName); M2a / PT3 / J2 re-open paid orders.
 * Point rate ($ per point) = live `merchant_point_payment_config` (read-only
 * graphql IPC), `VOLT_POINT_RATE_CASH|OTHER` override, else $2.
 * Gift-card steps need `VOLT_TEST_GIFT_CARD` (skipped otherwise).
 *
 * Known issues kept as in the source (they fail on DEV until fixed):
 * - PROMO-M0: new customer shows "Visit: ###" (bug #7).
 * - PROMO-M1 / PT1 / PT2: Cash credits points per CENT (×100, bug #16).
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsHome, VqpsSplit } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  POINT_RATE,
  customerFieldLocked,
  dismissCheckPaid,
  editReopenedOrder,
  eventually,
  refreshPointRates,
  successTotal,
} from '../../../../src/pages/voltqc/promo-split/promoDeepExtra.js';
import {
  addGiftCardLine,
  attachExistingCustomer,
  checkoutBack,
  checkoutCustomerStats,
  createQuickPayOrder,
  customDiscountSplit,
  customerEarnedPoints,
  homeCustomerStats,
  pointsFor,
  readCustomerStats,
  removeCustomerFromOrder,
  setCashierTip,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import { openSplit, waitCheckPaid } from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  app,
  cust,
  escapeRe,
  money,
  randomPhone,
  uniqueName,
  vqEnv,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const NO_GC = 'VOLT_TEST_GIFT_CARD is not configured';

/** Attach a NEW customer (quick add) to the open order. Returns the phone. */
async function newCustomer(): Promise<string> {
  const phone = randomPhone();
  await app.attachNewCustomer(phone, uniqueName('QC E2E'));
  await app.customerConfirmPhone().catch(() => undefined);
  return phone;
}

/**
 * Open order → Pay → method (optional cashier tip) → complete (customer No Tip). No No Receipt.
 * Returns the paid amount on Payment Successful (method amount incl. tax, + tip) — points are computed on it.
 */
async function payOpen(method: 'Cash' | 'Other', tipCents?: string): Promise<number> {
  await app.pay();
  await app.selectMethod(method);
  if (tipCents) await setCashierTip([...tipCents]);
  await app.completePayment({ tip: 'none' });
  const s = await app.waitSuccess();
  const paid = successTotal(s);
  if (!(paid > 0)) console.warn(`Could not read the amount on Payment Successful: ${s.slice(0, 200)}`);
  expect(paid).toBeGreaterThan(0);
  return paid;
}

const paymentComplete = { text: 'Payment complete', nth: 0 } as const;
const congrats = { textRe: escapeRe("Congrats! You've earned"), nth: 0 } as const;

describe('volt-qc 04 PROMO — customer points & visits (plan 04 — PROMO-M/M2/J2/PT)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create and settle orders with new customers (points / visits)');
    await refreshPointRates(0);
  });

  beforeEach(async () => {
    await refreshPointRates();
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders().catch(() => undefined);
  });

  it(
    title(
      'PROMO-M0 New customer: Point 0 / Visit 0 on the customer bar, checkout and Pending card (PROMO-075)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const id = await app.createOrder();
      await newCustomer();
      const h = await homeCustomerStats();
      expect(h.point).toBe(0);
      await app.pay();
      const cs = await checkoutCustomerStats();
      expect(cs.points).toBe(0);
      expect(cs.visits).toBe(0);
      await checkoutBack();
      const box = [VqpsHome.pendingSidebar, { role: 'textbox', nth: 0 }] as const;
      const card = [VqpsHome.pendingSidebar, { role: 'button', nameRe: `^${escapeRe(id)}`, nth: 0 }] as const;
      await P.fillQ(box, id);
      await eventually(async () => (await P.textOf(card)).includes('0 Pts'), 5_000);
      expect(await P.textOf(card)).toContain('0 Pts');
      await P.fillQ(box, '');
      // Bug #7 (docs/bugs-found-dev.md): a new customer shows "Visit: ###". The bar must show "Visit: 0".
      expect(h.visitRaw).toBe('0');
    },
  );

  it(
    title(
      'PROMO-M Points Other/Cash $2 = 1 point: customer display shows earned + current points; post-payment buttons; no customer → no Congrats (PROMO-076, PROMO-089, PROMO-091, PROMO-093)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      let n1 = 0;

      await step(
        'First payment Other → "Congrats! You\'ve earned" floor(paid / rate) points, current points = the same',
        async () => {
          await app.createOrder();
          await newCustomer();
          const paid = await payOpen('Other');
          const p = await customerEarnedPoints();
          n1 = pointsFor(paid, POINT_RATE.other);
          expect(p.earned).toBe(n1); // PROMO-076 / PROMO-091 points at the Other rate
          expect(p.current).toBe(n1); // PROMO-092 new customer: current = just earned
          expect(await cust.waitFor(paymentComplete, 15_000)).toBe(true);
          for (const b of ['No Receipt', 'Print', 'Text Message', 'Email']) {
            expect(await cust.has({ text: b, nth: 0 })).toBe(true); // PROMO-093
          }
          await app.noReceipt();
        },
      );

      await step(
        'PROMO-089 order without customer → Other: success, no "Congrats! You\'ve earned" on the customer display',
        async () => {
          await app.createOrder();
          await payOpen('Other');
          expect(await cust.waitFor(paymentComplete, 15_000)).toBe(true);
          expect(await cust.has(congrats)).toBe(false);
          await app.noReceipt();
        },
      );
    },
  );

  // Bug #16 (docs/bugs-found-dev.md): Cash credits points per CENT (×100): Cash $30 → 3,000 points.
  it(
    title(
      'PROMO-M1 Cash points $2 = 1 point; current points add up after one Other + one Cash payment (PROMO-077, PROMO-092)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      let phone = '';
      let n1 = 0;
      await step('First payment Other → points at the Other rate', async () => {
        await app.createOrder();
        phone = await newCustomer();
        const paid = await payOpen('Other');
        n1 = pointsFor(paid, POINT_RATE.other);
        expect((await customerEarnedPoints()).earned).toBe(n1);
        await app.noReceipt();
      });
      await step('Second payment same customer, Cash → +floor(paid / rate), current = N1 + N2', async () => {
        await app.createOrder();
        await attachExistingCustomer(phone);
        const paid = await payOpen('Cash');
        const p = await customerEarnedPoints();
        const n2 = pointsFor(paid, POINT_RATE.cash);
        expect(p.earned).toBe(n2); // PROMO-077
        expect(p.current).toBe(n1 + n2); // PROMO-092
        await app.noReceipt();
      });
    },
  );

  it(
    title(
      'PROMO-PT Points include the tip, the gift-card part earns nothing, a gift-card-only sale = 0 points (PROMO-080, PROMO-082, PROMO-083)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await app.createOrder();
      const phone = await newCustomer();
      await payOpen('Other');
      await app.noReceipt();

      await step('PROMO-080 Other + cashier tip $2 → points include the tip', async () => {
        await app.createOrder();
        await attachExistingCustomer(phone);
        const paid = await payOpen('Other', '200'); // the success amount already includes the $2 tip
        expect((await customerEarnedPoints()).earned).toBe(pointsFor(paid, POINT_RATE.other));
        await app.noReceipt();
      });

      if (!vqEnv.testGiftCard) {
        console.warn(`PROMO-082 / PROMO-083 skipped: ${NO_GC}`);
        this.skip();
      }

      await step(
        'PROMO-082 service + gift card sale $25 → Other: points on the service part only',
        async () => {
          const id = await app.createOrder();
          await addGiftCardLine(vqEnv.testGiftCard, 25);
          await app.openPendingOrder(id);
          await attachExistingCustomer(phone);
          const paid = await payOpen('Other');
          // Service part = paid − $25 gift card (gift-card lines carry no tax — checked 2026-10-09, SF 10% + Tax 10%).
          expect((await customerEarnedPoints()).earned).toBe(pointsFor(paid - 25, POINT_RATE.other));
          await app.noReceipt();
        },
      );

      await step('PROMO-083 gift card sale only $50 → Cash: +0 points', async () => {
        await app.quickCheckout();
        await addGiftCardLine(vqEnv.testGiftCard, 50);
        app.createdOrders.add(await app.orderId());
        await attachExistingCustomer(phone);
        await payOpen('Cash');
        expect(await cust.waitFor(paymentComplete, 15_000)).toBe(true);
        if (await cust.has(congrats)) expect((await customerEarnedPoints()).earned).toBe(0);
        await app.noReceipt();
      });
    },
  );

  // Bug #16: Cash credits points ×100.
  it(
    title(
      'PROMO-PT1 Floor rounding: Quick Pay $10.50 / $11.00 paid Cash → floor(paid incl. tax / rate) (PROMO-078, PROMO-079)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await app.createOrder();
      const phone = await newCustomer();
      await payOpen('Other');
      await app.noReceipt();

      for (const [ids, amount] of [
        ['PROMO-078', 10.5],
        ['PROMO-079', 11],
      ] as const) {
        await step(
          `${ids} Quick Pay $${String(amount)} Cash → floor(paid / ${String(POINT_RATE.cash)})`,
          async () => {
            await createQuickPayOrder([{ amount, name: `QC PT ${String(amount)}` }]);
            await attachExistingCustomer(phone);
            const paid = await payOpen('Cash'); // amount·(1+tax) when the shop has tax
            expect((await customerEarnedPoints()).earned).toBe(pointsFor(paid, POINT_RATE.cash));
            await app.noReceipt();
          },
        );
      }
    },
  );

  // Bug #16: Cash ×100 → split Cash + Other total is wrong.
  it(
    title(
      'PROMO-PT2 Split Cash + Other: points = sum of per-tender points (floor per method) (PROMO-086)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
      await newCustomer();
      await openSplit();
      // Each check's amount is read on the "Pay $x" button right after picking the method (Cash/Other carry no service fee).
      const payAmount = async (): Promise<number> => money(await P.textOf(VqpsSplit.pay));

      await P.clickQ(inMain({ text: 'Check 1', nth: 0 }));
      await P.clickQ(inMain(btn('Cash')));
      await settle(300);
      const c1 = await payAmount();
      await P.clickQ(VqpsSplit.pay);
      await app.passcodeIfAsked(1_500);
      await P.clickQ([VqpsSplit.cashDialog(1), btn('Complete Check 1')]);
      await waitCheckPaid(1);
      await dismissCheckPaid();

      await P.clickQ(inMain(btn('Other')));
      await settle(300);
      const c2 = await payAmount();
      await P.clickQ(VqpsSplit.pay);
      await app.passcodeIfAsked(1_500);
      const od = VqpsSplit.otherDialog;
      await P.fillQ(
        [od, { css: `input[placeholder="${VqpsCheckout.otherNamePlaceholder}"]`, nth: 0 }],
        'QC E2E',
      );
      await P.clickQ([od, { role: 'button', nameRe: '^Pay \\$', nth: 0 }]);
      await waitCheckPaid(2);
      await P.clickQ([{ role: 'dialog', nth: -1 }, btn('Done')]);
      await P.clickQ(inMain({ role: 'button', nameRe: 'Complete Done|^Done$', nth: -1 }));
      await app.waitSuccess();
      const p = await customerEarnedPoints();
      expect(p.earned).toBe(pointsFor(c1, POINT_RATE.cash) + pointsFor(c2, POINT_RATE.other));
      await app.noReceipt();
    },
  );

  it(
    title('PROMO-M2a Re-Open then finish again does not add a Visit (PROMO-098)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(6 * 60_000);
      const id = await app.createOrder();
      const phone = await newCustomer();
      await payOpen('Other');
      await app.noReceipt();
      const v1 = (await readCustomerStats(phone)).visits;
      await app.reopenOrder(id);
      await app.finishReopen();
      const v2 = (await readCustomerStats(phone)).visits;
      console.warn(`${id}: visit ${String(v1)} → ${String(v2)}`);
      expect(v2).toBe(v1);
    },
  );

  it(
    title(
      'PROMO-M2b Cancel an order that earned points: customer points not deducted, never negative',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    function () {
      // Source: test.skip(true, …) — cancelling an Other order with a customer right after payment never reached
      // Status Canceled within 90 s (3 runs; cancelling an older order by hand works) — app or timing, needs investigation.
      console.warn(
        'PROMO-M2b skipped (as in volt-qc): Status does not become Canceled within 90 s after cancelling a fresh Other order with a customer — needs investigation',
      );
      this.skip();
    },
  );

  it(
    title(
      'PROMO-M2c Change the customer before paying: only the last customer earns points (PROMO-100)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await app.createOrder();
      const a = await newCustomer();
      await removeCustomerFromOrder();
      await newCustomer();
      await payOpen('Other');
      const p = await customerEarnedPoints();
      expect(p.earned).toBeGreaterThan(0);
      expect(p.current).toBe(p.earned);
      await app.noReceipt();
      // The removed customer A earns nothing.
      expect((await readCustomerStats(a, 0, 20_000)).points).toBe(0);
    },
  );

  it(
    title(
      'PROMO-PT3 Re-Open an order without customer, add customer C, Re-Open Done → C earns the points',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const id = await app.createOrder();
      const total = await payOpen('Other'); // paid amount (Other, incl. tax)
      await app.noReceipt();
      await app.reopenOrder(id);
      await editReopenedOrder(id);
      // DEV: on Re-Open the customer field is locked (pointer-events-none opacity-50 when isReopen) → cannot add C.
      if (await customerFieldLocked()) {
        await app.finishReopen();
        console.warn(
          'PROMO-PT3 skipped: DEV locks the customer field on Re-Open (isReopen → pointer-events-none) — cannot add customer C (PROMO-097)',
        );
        this.skip();
      }
      const phone = await newCustomer();
      await app.finishReopen();
      const want = pointsFor(total, POINT_RATE.other);
      expect((await readCustomerStats(phone, want)).points).toBe(want);
    },
  );

  it(
    title(
      'PROMO-J2 Re-Open: Home has no Promo & Rewards; the gift card line is read-only and cannot be deleted (PROMO-047, PROMO-163)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await step(
        'PROMO-047 Custom 10% order paid Other → Re-Open → Edit Order: no Promo & Rewards button',
        async () => {
          const id = await app.createOrder();
          await customDiscountSplit('%', 10);
          await payOpen('Other');
          await app.noReceipt();
          await app.reopenOrder(id);
          await editReopenedOrder(id);
          expect(await P.count(btn('Promo & Rewards'))).toBe(0);
          await app.finishReopen();
        },
      );

      if (!vqEnv.testGiftCard) {
        console.warn(`PROMO-163 skipped: ${NO_GC}`);
        this.skip();
      }

      await step(
        'PROMO-163 order with a test-card top-up paid Other → Re-Open → Edit Order: gift card dialog read-only, delete disabled',
        async () => {
          const id = await app.createOrder();
          await addGiftCardLine(vqEnv.testGiftCard, 25);
          await app.openPendingOrder(id);
          await payOpen('Other');
          await app.noReceipt();
          await app.reopenOrder(id);
          await editReopenedOrder(id);
          await P.clickQ(inMain({ textRe: 'Gift Card \\[\\*+-\\*+-\\d{4}\\]', nth: 0 }));
          const dlg = { role: 'dialog', name: 'Sell Gift Card', nth: -1 } as const;
          await P.waitFor(dlg, 10_000, 'Sell Gift Card');
          expect(await P.count([dlg, { role: 'button', name: 'Add' }])).toBe(0);
          expect(await P.isDisabled([dlg, { role: 'textbox', name: 'Enter gift card code' }])).toBe(true);
          await P.clickQ([dlg, btn('Close', 0)]);
          const del = await P.infos(inMain({ role: 'button', name: 'Delete Staff Order Item' }));
          for (const d of del) expect(d.disabled).toBe(true);
          await app.finishReopen();
        },
      );
    },
  );
});
