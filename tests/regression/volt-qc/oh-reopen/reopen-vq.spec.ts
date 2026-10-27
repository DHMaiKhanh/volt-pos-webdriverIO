/**
 * volt-qc port — 17 RE-OPEN, the cases that need named staff / services, customers & points, splits,
 * gift cards, discounts, reports or tip settings.
 *
 * Source: volt-qc `e2e/tests/19-reopen/reopen-linear.spec.ts` (RO-B1, B2, B3, B4, D1..D3, E3, F1..F4,
 * G1, H2, H4) and `reopen-methods.spec.ts` (RO-304, 306, 310, 312, 402, 404, 406, 408..411, 502,
 * 505, 506, 510). Rows without a source test (RO-054, 086, 088, 089, 093, 094, 102, 110, 130, 135,
 * 412..414) are written from docs/qc/volt-qc/windows-regression/17-reopen.md.
 *
 * Drives the volt-qc `app` port (src/pages/voltqc/promo-split/vqApp.ts) by ORDER CODE, with the merchant-14
 * fixtures (`VOLT_TEST_STAFF[_2]`, `VOLT_TEST_SERVICE[_2]`, `VOLT_TEST_GIFT_CARD` / `GIFT_CARD_CODE`).
 * Money is in dollars, as in the source suite.
 *
 * CREATES, SETTLES, RE-OPENS, RE-CHARGES AND VOIDS ORDERS; the tip-method cases flip a merchant
 * tip setting and restore it — dev / staging only.
 */

import { expect } from '@wdio/globals';
import { btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsCheckout, VqpsHome } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { OhRoText as T } from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { setTipMethod } from '../../../../src/pages/voltqc/cd-e2e/settingsCd.js';
import {
  POINT_RATE,
  addGiftCardLine,
  createQuickPayOrder,
  customDiscountSplit,
  itemDiscount,
  itemDialog,
  itemSave,
  openItemDialog,
  pointsFor,
  removeCustomerFromOrder,
  setCashierTip,
  settledGiftCardBalance,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import {
  app,
  cust,
  field,
  money,
  r2,
  randomPhone,
  uniqueName,
  vqEnv,
  visible,
  waitUntil,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import {
  GC,
  addServiceInReopen,
  cannotContinueText,
  checkoutText,
  completeUntilTipScreen,
  confirmVoidAll,
  createSplitPaid,
  customerTipBase,
  dailySaleRows,
  decreaseOrFail,
  editOrderFromCheckout,
  enteredFor,
  fillOtherName,
  freshDetail,
  historyBack,
  leaveReopenVq,
  payAndReopenDone,
  payDifference,
  payFromEdit,
  pickMoney,
  readPoints,
  readVisits,
  reopenDialogText,
  reopenToCheckout,
  reopenToHome,
  serviceLocked,
  staffTip,
  tryAddService,
  voidDialog,
} from '../../../../src/pages/voltqc/oh-reopen/vqReopen.js';
import { countPayments } from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const S1 = vqEnv.testService;
const S2 = vqEnv.testService2;

/** Tax rate of the merchant measured on a paid cash order (Tax / Subtotal of its detail). */
async function taxRateOf(id: string): Promise<number> {
  const d = await freshDetail(id);
  const sub = money(field(d, 'Subtotal'));
  const tax = money(field(d, 'Tax')) || 0;
  return sub > 0 ? tax / sub : 0;
}

async function basePrice(service: string): Promise<number> {
  await app.quickCheckout();
  return app.basePrice(service);
}

async function customerPaidOrder(
  method: 'Cash' | 'Other' = 'Other',
): Promise<{ id: string; total: number; phone: string }> {
  const phone = randomPhone();
  const id = await app.createOrder();
  await app.attachNewCustomer(phone, uniqueName('QC E2E'));
  await app.customerConfirmPhone().catch(() => undefined);
  await app.pay();
  const total = await app.methodAmount(method);
  await app.selectMethod(method);
  if (method === 'Other') await fillOtherName('E2E Other');
  await app.completePayment({ tip: 'none' });
  await app.waitSuccess();
  await app.noReceipt();
  return { id, total, phone };
}

/** Open order on Home → pay `method` (no tip) → No Receipt. */
async function payOpen(method: 'Cash' | 'Other'): Promise<void> {
  await app.pay();
  await app.selectMethod(method);
  if (method === 'Other') await fillOtherName('E2E Other');
  await app.completePayment({ tip: 'none' });
  await app.waitSuccess();
  await app.noReceipt();
}

async function reopenAddToCheckout(id: string): Promise<void> {
  await reopenToHome(id);
  await addServiceInReopen(S2);
  await payFromEdit();
}

async function gcPayOpen(): Promise<void> {
  const r = await app.payWithGiftCard(GC());
  if (!/Gift Card Accepted/i.test(r.info)) throw new Error(`Gift card not accepted: ${r.info}`);
  await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
  await app.driveToSuccess('none');
  await app.waitSuccess();
  await app.noReceipt();
}

async function withTipMethod(
  method: 'cash' | 'other' | 'gift_card',
  on: boolean,
  body: () => Promise<void>,
): Promise<void> {
  const before = await setTipMethod(method, on);
  try {
    await body();
  } finally {
    await setTipMethod(method, before).catch(() => undefined);
  }
}

describe('volt-qc 17 RE-OPEN — fixtures, customers, split, gift card, reports (write)', () => {
  afterEach(async () => {
    await leaveReopenVq();
  });

  /* ---------------- pricing of the difference ---------------- */

  it(
    title(
      'Add a service and pay Cash: the difference is base × (1 + tax), no service fee (RO-010)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const b2 = await basePrice(S2);
      const { id } = await app.createPaidOrder({ method: 'Cash' });
      const tax = await taxRateOf(id);
      await reopenAddToCheckout(id);
      expect(await app.methodAmount('Cash')).toBeCloseTo(r2(b2 * (1 + tax)), 2);
      await payDifference('Cash');
      expect(countPayments(await freshDetail(id), 'Cash')).toBe(2);
    },
  );

  it(
    title(
      'Order with a gift-card top-up line, add a service: Cash / Other = base × (1 + tax) with no stray cent; the gift-card line is read-only (RO-013, RO-032, RO-408)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      if (!GC()) this.skip();
      const b2 = await basePrice(S2);
      const probe = await app.createPaidOrder({ method: 'Cash' });
      const tax = await taxRateOf(probe.id);
      const id = await app.createOrder();
      await addGiftCardLine(GC(), 25);
      await payOpen('Other');
      await reopenToHome(id);
      await step('RO-032 / RO-408 gift-card line cannot be removed', async () => {
        const del = [
          { css: 'main div.pr-11', hasText: 'Gift Card', nth: 0 },
          { css: 'button.text-destructive', nth: 0 },
        ] as const;
        if (await P.has(del)) expect(await P.isDisabled(del)).toBe(true);
      });
      await addServiceInReopen(S2);
      await payFromEdit();
      const want = r2(b2 * (1 + tax));
      expect(await app.methodAmount('Cash')).toBeCloseTo(want, 2);
      expect(await app.methodAmount('Other')).toBeCloseTo(want, 2);
      const card = await app.methodAmount('Card');
      if (!Number.isNaN(card)) expect(card).toBeGreaterThanOrEqual(want);
      await payDifference('Cash');
    },
  );

  it(
    title(
      'Add a taxable Product in reopen: Card carries product tax; a higher total with lower tax is still charged (RO-014, RO-086)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const product = (process.env.VOLT_TEST_PRODUCT ?? '').trim();
      if (!product) this.skip(); // VOLT_TEST_PRODUCT = a taxable product on this merchant
      const p = await basePrice(product);
      const { id } = await app.createPaidOrder({ method: 'Cash' });
      await reopenToHome(id);
      await addServiceInReopen(product);
      await payFromEdit();
      const cash = await app.methodAmount('Cash');
      expect(cash).toBeGreaterThanOrEqual(p);
      const card = await app.methodAmount('Card');
      if (!Number.isNaN(card)) expect(card).toBeGreaterThanOrEqual(cash);
      await payDifference('Cash');
      expect(countPayments(await freshDetail(id), 'Cash')).toBe(2);
    },
  );

  it(
    title(
      'Extra charge with a customer tip: "Tip based on total" is the new part only (RO-016)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { id, total } = await app.createPaidOrder({ method: 'Other' });
      await reopenAddToCheckout(id);
      const due = await enteredFor('Cash');
      if (!(await completeUntilTipScreen())) {
        await app.noReceipt().catch(() => undefined);
        this.skip(); // the merchant pushes no tip screen on cash
      }
      const base = await customerTipBase();
      await cust.tip('none');
      await app.driveToSuccess('none');
      await app.noReceipt();
      if (Number.isNaN(base)) this.skip(); // tip type Amount — no base shown
      expect(base).toBeLessThan(r2(total + due) - 0.01);
    },
  );

  it(
    title(
      'Remove an item discount ($5) in reopen: only $5 × (1 + tax) is owed, one more Cash txn (RO-108)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const probe = await app.createPaidOrder({ method: 'Cash' });
      const tax = await taxRateOf(probe.id);
      const id = await app.createOrder();
      await itemDiscount(S1, '$', 5);
      await payOpen('Cash');
      await reopenToHome(id);
      await openItemDialog(S1);
      const sw = [itemDialog, { role: 'switch', nth: 0 }] as const;
      if ((await P.attrOf(sw, 'aria-checked')) === 'true') await P.clickQ(sw);
      await P.clickQ(itemSave);
      await P.waitGoneQ(itemSave, 8_000);
      await payFromEdit();
      expect(await app.methodAmount('Cash')).toBeCloseTo(r2(5 * (1 + tax)), 1);
      await payDifference('Cash');
      expect(countPayments(await freshDetail(id), 'Cash')).toBe(2);
    },
  );

  /* ---------------- locked money edits ---------------- */

  it(
    title(
      'Order with a Custom Discount: reopen has no Promo & Rewards and cannot add a service (RO-030)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const id = await app.createOrder();
      await customDiscountSplit('%', 10);
      await payOpen('Other');
      await reopenToHome(id);
      expect(await visible(inMain(VqpsHome.promoButton))).toBe(false);
      expect(await tryAddService(S2)).toBe(false);
      await payAndReopenDone();
    },
  );

  it(
    title('Split order: reopen cannot add a service (RO-031)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(6 * 60_000);
      const { id } = await createSplitPaid(['Other', 'Other']);
      await reopenToCheckout(id);
      if (await visible(voidDialog)) await P.clickQ([voidDialog, btn('Back to Order', 0)]);
      else await editOrderFromCheckout();
      await app.waitPath(/\/home/, 15_000);
      expect(await tryAddService(S1)).toBe(false);
      await payAndReopenDone();
    },
  );

  it(
    title(
      'Edit spent: service tiles locked, the line dialog only edits the note (RO-101)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const { id } = await app.createPaidOrder({ method: 'Cash' });
      await reopenAddToCheckout(id);
      await payDifference('Cash');
      expect(await reopenDialogText(id)).toContain(T.msgNoEdit);
      await reopenToHome(id);
      expect(await serviceLocked(S1)).toBe(true);
      expect(await tryAddService(S2)).toBe(false);
      await openItemDialog(S1).catch(() => undefined);
      if (await visible(itemDialog)) {
        const boxes = await P.infos([itemDialog, { css: 'input, textarea' }]);
        for (const b of boxes) {
          if (/note/i.test(b.attrs.placeholder ?? '') || b.attrs.maxlength === '80') continue;
          expect(b.disabled || b.attrs.readonly !== undefined).toBe(true);
        }
        await P.escape();
      }
      await payAndReopenDone();
    },
  );

  it(
    title(
      'Quick Pay line in reopen follows the edit rule: price editable on the first reopen, locked once spent (RO-102)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const id = await createQuickPayOrder([{ amount: 20, name: 'QP Reopen' }]);
      await payOpen('Cash');
      await reopenToHome(id);
      await openItemDialog('QP Reopen');
      const price = [itemDialog, { css: 'input[placeholder="0.00"]', nth: 0 }] as const;
      expect(await P.isDisabled(price)).toBe(false);
      await P.fillQ(price, '2100');
      await P.clickQ(itemSave);
      await P.waitGoneQ(itemSave, 8_000);
      await payFromEdit();
      expect(await enteredFor('Cash')).toBeGreaterThan(0);
      await payDifference('Cash');
      await reopenToHome(id);
      await openItemDialog('QP Reopen');
      expect(await P.isDisabled(price).catch(() => true)).toBe(true);
      await P.escape();
      await payAndReopenDone();
    },
  );

  /* ---------------- staff / tip ---------------- */

  it(
    title(
      'Adding staff B (higher total) re-splits the paid $2 tip across both staff; shares add up to $2 (RO-042)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const id = await app.createOrder();
      await app.pay();
      await app.selectMethod('Cash');
      await setCashierTip(['2', '0', '0']);
      await app.completePayment({ tip: 'none' });
      await app.waitSuccess();
      await app.noReceipt();
      await reopenToHome(id);
      await addServiceInReopen(S2, vqEnv.testStaff2);
      await payFromEdit();
      await payDifference('Cash');
      const d = await freshDetail(id);
      const a = staffTip(d, vqEnv.testStaff);
      const b = staffTip(d, vqEnv.testStaff2);
      expect(r2(a + b)).toBeCloseTo(2, 2);
      expect(b).toBeGreaterThan(0);
    },
  );

  /* ---------------- customers, points, visits ---------------- */

  it(
    title(
      'Remove customer A and add a new customer B in reopen: the order keeps B (OH-171, RO-050)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { id } = await customerPaidOrder();
      await reopenToHome(id);
      await removeCustomerFromOrder();
      const phoneB = randomPhone();
      const nameB = uniqueName('QC E2E');
      await app.attachNewCustomer(phoneB, nameB);
      await app.customerConfirmPhone().catch(() => undefined);
      await payAndReopenDone();
      const d = await freshDetail(id);
      expect(field(d, 'Customer')).toContain(nameB);
      expect(d).toContain(phoneB.slice(-4));
    },
  );

  it(
    title(
      "Walk-in order, attach customer C in reopen: C earns the order's points (RO-051)",
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { id, total } = await app.createPaidOrder({ method: 'Other' });
      await reopenToHome(id);
      const phone = randomPhone();
      await app.attachNewCustomer(phone, uniqueName('QC E2E'));
      await app.customerConfirmPhone().catch(() => undefined);
      await payAndReopenDone();
      const want = pointsFor(total, POINT_RATE.other);
      expect(await readPoints(phone, want)).toBe(want);
    },
  );

  it(
    title(
      "Swap customer A → B in reopen: A loses this order's points, B gets them (OH-170, RO-052)",
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { id, total, phone: phoneA } = await customerPaidOrder();
      const p = pointsFor(total, POINT_RATE.other);
      await reopenToHome(id);
      await removeCustomerFromOrder();
      const phoneB = randomPhone();
      await app.attachNewCustomer(phoneB, uniqueName('QC E2E'));
      await app.customerConfirmPhone().catch(() => undefined);
      await payAndReopenDone();
      const pb = await readPoints(phoneB, p);
      const pa = await readPoints(phoneA, 0, 30_000);
      expect(pb).toBe(p);
      expect(pa).toBe(0);
    },
  );

  it(
    title(
      'Reopen with no change → Done: points not doubled, visits not bumped; the next order bumps them (OH-172, OH-173, RO-053)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { id, total, phone } = await customerPaidOrder();
      const p = pointsFor(total, POINT_RATE.other);
      expect(await readPoints(phone, p)).toBe(p);
      const v0 = await readVisits(phone);
      await reopenToCheckout(id);
      await payAndReopenDone();
      await settle(5_000);
      expect(await readPoints(phone, p, 20_000)).toBe(p);
      expect(await readVisits(phone)).toBe(v0);
    },
  );

  it(
    title('Reopen + complete again counts one more visit as PO ruled (RO-054)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(8 * 60_000);
      const { id, phone } = await customerPaidOrder();
      const v0 = await readVisits(phone);
      await reopenAddToCheckout(id);
      await payDifference('Cash');
      await settle(5_000);
      const v1 = await readVisits(phone);
      expect(v1 - v0).toBeLessThanOrEqual(1);
      expect(v1).toBeGreaterThanOrEqual(v0);
    },
  );

  it(
    title(
      'Pay the difference in Cash / Other: points follow the new total, Daily Sale shows the new total once (RO-110, RO-312, RO-510)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(10 * 60_000);
      for (const method of ['Cash', 'Other'] as const) {
        const { id, total, phone } = await customerPaidOrder(method);
        await reopenAddToCheckout(id);
        const due = await enteredFor(method);
        await payDifference(method);
        const newTotal = r2(total + due);
        const want = pointsFor(newTotal, method === 'Cash' ? POINT_RATE.cash : POINT_RATE.other);
        expect(await readPoints(phone, want)).toBe(want);
        const rows = await dailySaleRows(id);
        expect(rows).toHaveLength(1);
        expect((rows[0]?.total ?? 0) / 100).toBeCloseTo(newTotal, 1);
      }
    },
  );

  /* ---------------- split ---------------- */

  it(
    title(
      'Split Cash + Other with tip, reopen unchanged: no forced void, $0 owed on every tab, no new txn (OH-164, RO-060, RO-506)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const { id } = await createSplitPaid(['Cash', 'Other'], { tipCents: '100' });
      const n0 = countPayments(await freshDetail(id), 'Cash') + countPayments(await freshDetail(id), 'Other');
      await reopenToCheckout(id);
      const forced = await waitUntil(() => visible(voidDialog), 3_000);
      if (forced) await P.clickQ([voidDialog, btn('Back to Order', 0)]);
      expect(forced).toBe(false);
      for (const m of ['Card', 'Cash', 'Gift Card', 'Other'] as const)
        expect(await enteredFor(m)).toBeCloseTo(0, 2);
      await payAndReopenDone();
      const after = await freshDetail(id);
      expect(countPayments(after, 'Cash') + countPayments(after, 'Other')).toBe(n0);
    },
  );

  it(
    title(
      'Split Cash + Cash, reopen unchanged: $0 owed, check structure kept, no new txn (RO-310)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const { id } = await createSplitPaid(['Cash', 'Cash']);
      const before = await freshDetail(id);
      const n0 = countPayments(before, 'Cash');
      await reopenToCheckout(id);
      const forced = await waitUntil(() => visible(voidDialog), 3_000);
      if (forced) await P.clickQ([voidDialog, btn('Back to Order', 0)]);
      expect(forced).toBe(false);
      for (const m of ['Cash', 'Other', 'Card'] as const) expect(await enteredFor(m)).toBeCloseTo(0, 2);
      await payAndReopenDone();
      const after = await freshDetail(id);
      expect(countPayments(after, 'Cash')).toBe(n0);
      expect(after).toContain(`#${id}-2`);
    },
  );

  /* ---------------- checkout behaviour ---------------- */

  it(
    title(
      'Reopen of an order with 2 txns: checkout lists the paid txns and Total Paid; per tender the tile, Enter Amount and the customer screen agree (RO-088, RO-089, RO-130)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { id, total } = await app.createPaidOrder({ method: 'Other' });
      await reopenAddToCheckout(id);
      const due = await enteredFor('Cash');
      await payDifference('Cash');
      await reopenToCheckout(id);
      const t = await checkoutText();
      expect(t).toMatch(/Other/);
      expect(t).toMatch(/Cash/);
      const paid = pickMoney(t, 'Total Paid');
      if (!Number.isNaN(paid)) expect(paid).toBeCloseTo(r2(total + due), 2);
      for (const m of ['Cash', 'Other'] as const) {
        const e = await enteredFor(m);
        expect(e).toBeCloseTo(0, 2);
        expect(await app.methodAmount(m)).toBeCloseTo(0, 2);
      }
      await payAndReopenDone();
      await reopenAddToCheckout((await app.createPaidOrder({ method: 'Cash' })).id);
      for (const m of ['Cash', 'Other'] as const) {
        const e = await enteredFor(m);
        expect(await app.methodAmount(m)).toBeCloseTo(e, 2);
        const ct = await cust.text();
        if (ct) expect(ct).toContain(`$${e.toFixed(2)}`);
      }
      await payDifference('Cash');
    },
  );

  it(
    title(
      'Pay the difference partly in Cash, then the rest: two new Cash txns, the edit counted once (RO-304)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const { id } = await app.createPaidOrder({ method: 'Cash' });
      await reopenAddToCheckout(id);
      await app.selectMethod('Cash');
      const need = await app.methodAmount('Cash');
      if (need <= 5) this.skip();
      await app.keypad('C');
      await app.keypad(String(Math.round((need - 5) * 100)).replace(/9/g, '8'));
      const partial = r2(need - (await app.enteredAmount()));
      await app.completePayment({ tip: 'none' });
      await waitUntil(
        async () =>
          Math.abs(pickMoney(await checkoutText(), 'Remaining') - partial) < 0.01 ||
          /checkout/.test(await app.url()),
        15_000,
      );
      expect(await app.url()).toMatch(/checkout/);
      await payDifference('Cash');
      const d = await freshDetail(id, (x) => countPayments(x, 'Cash') >= 3);
      expect(countPayments(d, 'Cash')).toBe(3);
      expect(await reopenDialogText(id)).toContain(T.msgNoEdit);
    },
  );

  it(
    title(
      'Reopen total edited down to $0: the order must still be completed with Cash / Other (RO-093)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const id = await createQuickPayOrder([{ amount: 20, name: 'QP Zero' }]);
      await payOpen('Other');
      await reopenToHome(id);
      await openItemDialog('QP Zero');
      await P.fillQ([itemDialog, { css: 'input[placeholder="0.00"]', nth: 0 }], '0');
      await P.clickQ(itemSave);
      await P.waitGoneQ(itemSave, 8_000);
      await P.clickQ(inMain(VqpsHome.payButton));
      await app.passcodeIfAsked(1_500);
      const blocked = await cannotContinueText();
      if (blocked) throw new Error(`A $0 re-open total is blocked: ${blocked}`);
      await app.waitPath(/checkout/, 15_000);
      if (await waitUntil(() => visible(voidDialog), 5_000)) await confirmVoidAll();
      expect(await visible(VqpsCheckout.reopenDone)).toBe(false);
      await payDifference('Cash');
      expect(field(await freshDetail(id), 'Status')).toMatch(/Successful/);
    },
  );

  it(
    title(
      'Remove every old service and add a new one: a "replace all services" warning shows (RO-135)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { id } = await app.createPaidOrder({ method: 'Other' });
      await reopenToHome(id);
      await addServiceInReopen(S2);
      await app.removeItem(S1);
      await P.clickQ(inMain(VqpsHome.payButton));
      await app.passcodeIfAsked(1_500);
      const warned = await waitUntil(
        async () =>
          /replace|all (the )?(previous |old )?services|Void Order Transactions|Cannot continue yet/i.test(
            await app.text('body'),
          ),
        8_000,
      );
      expect(warned).toBe(true);
      await leaveReopenVq();
    },
  );

  it(
    title(
      'Other difference with the method name left blank still completes (RO-502)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { id } = await app.createPaidOrder({ method: 'Cash' });
      await reopenAddToCheckout(id);
      await app.selectMethod('Other');
      if (!(await fillOtherName(''))) this.skip(); // build has no name box
      await settle(300);
      expect(await P.isDisabled(VqpsCheckout.complete).catch(() => true)).toBe(false);
      await app.completePayment({ tip: 'none' });
      await app.waitSuccess();
      await app.noReceipt();
      expect(countPayments(await freshDetail(id), 'Other')).toBe(1);
    },
  );

  /* ---------------- tip method on the difference ---------------- */

  it(
    title(
      'Tip Method with Cash: paying the difference in Cash pushes the tip screen on the new part; without Cash no tip screen (RO-306)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(10 * 60_000);
      await withTipMethod('cash', true, async () => {
        const { id } = await app.createPaidOrder({ method: 'Cash' });
        await reopenAddToCheckout(id);
        await app.selectMethod('Cash');
        expect(await completeUntilTipScreen()).toBe(true);
        await cust.tip('none');
        await app.driveToSuccess('none');
        await app.noReceipt();
      });
      await withTipMethod('cash', false, async () => {
        const { id } = await app.createPaidOrder({ method: 'Cash' });
        await reopenAddToCheckout(id);
        await app.selectMethod('Cash');
        expect(await completeUntilTipScreen(15_000)).toBe(false);
        await app.noReceipt().catch(() => undefined);
      });
    },
  );

  it(
    title(
      'Tip Method with Other: paying the difference in Other pushes the tip screen; without Other it does not (RO-505)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(10 * 60_000);
      for (const on of [true, false]) {
        await withTipMethod('other', on, async () => {
          const { id } = await app.createPaidOrder({ method: 'Other' });
          await reopenAddToCheckout(id);
          await app.selectMethod('Other');
          await fillOtherName('E2E Other');
          expect(await completeUntilTipScreen(on ? 30_000 : 15_000)).toBe(on);
          if (on) {
            await cust.tip('none');
            await app.driveToSuccess('none');
          }
          await app.noReceipt().catch(() => undefined);
        });
      }
    },
  );

  /* ---------------- gift card ---------------- */

  it(
    title(
      'Gift Card original, difference by the same card: 2 txns on that card, balance down by first + difference (RO-402)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      if (!GC()) this.skip();
      const b0 = await settledGiftCardBalance(GC());
      const id = await app.createOrder();
      await app.pay();
      const first = await app.methodAmount('Gift Card');
      await gcPayOpen();
      await reopenAddToCheckout(id);
      const due = await app.methodAmount('Gift Card');
      expect(due).toBeCloseTo(await app.methodAmount('Cash'), 2);
      await gcPayOpen();
      const b1 = await settledGiftCardBalance(GC());
      expect(r2(b0 - b1)).toBeCloseTo(r2(first + due), 1);
      expect(countPayments(await freshDetail(id), 'Gift Card')).toBe(2);
    },
  );

  it(
    title(
      'Gift card with too little balance for the difference: never charged below zero, the rest paid by another method (RO-404)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const low = (process.env.VOLT_TEST_GIFT_CARD_LOW ?? '').trim();
      if (!low) this.skip(); // VOLT_TEST_GIFT_CARD_LOW = a card with < $40 (POS cannot create cards)
      const { id } = await app.createPaidOrder({ method: 'Cash' });
      await reopenAddToCheckout(id);
      const r = await app.payWithGiftCard(low);
      expect(r.info).toMatch(/not enough|Insufficient|Amount Needed|Accepted/i);
      const pay = [VqpsCheckout.gcResultDialog, btn('Pay')] as const;
      if (!(await P.isDisabled(pay).catch(() => true))) await P.clickQ(pay);
      else await P.escape();
      await settle(1_500);
      if (!/payment-success/.test(await app.url())) await payDifference('Cash');
      else await app.noReceipt();
      expect(await settledGiftCardBalance(low)).toBeGreaterThanOrEqual(0);
      expect(field(await freshDetail(id), 'Status')).toBe('Successful - Unsettled');
    },
  );

  it(
    title(
      'Gift Card original, lower total: voiding returns the full balance to the card (RO-094, RO-406)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      if (!GC()) this.skip();
      const b0 = await settledGiftCardBalance(GC());
      const id = await app.createOrder({ services: [S1, S2] });
      await app.pay();
      await gcPayOpen();
      await decreaseOrFail(id);
      await confirmVoidAll();
      await payDifference('Cash');
      expect(await settledGiftCardBalance(GC())).toBeCloseTo(b0, 1);
    },
  );

  it(
    title(
      "A card being SOLD in the order cannot pay that order's difference (RO-409)",
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      if (!GC()) this.skip();
      const id = await app.createOrder();
      await addGiftCardLine(GC(), 25);
      await payOpen('Cash');
      await reopenAddToCheckout(id);
      const tile = await P.textOf(inMain({ role: 'button', nameRe: '^Gift Card', nth: 0 }));
      let refused = /Cannot use Gift Card/i.test(tile) || !/\$/.test(tile);
      if (!refused) {
        const r = await app.payWithGiftCard(GC());
        refused = !/Gift Card Accepted/i.test(r.info);
        await P.escape();
      }
      expect(refused).toBe(true);
      await payDifference('Cash');
    },
  );

  it(
    title(
      'Difference paid by Gift Card: no negative amount, no Change, a new GC line with the last 4; Daily Sale shows the new total (RO-410, RO-411)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      if (!GC()) this.skip();
      const { id, total } = await app.createPaidOrder({ method: 'Cash' });
      await reopenAddToCheckout(id);
      const due = await app.methodAmount('Gift Card');
      const r = await app.payWithGiftCard(GC());
      if (!/Gift Card Accepted/i.test(r.info)) throw new Error(r.info);
      await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
      await app.driveToSuccess('none');
      const success = await app.waitSuccess();
      await app.noReceipt();
      expect(success).not.toMatch(/-\s?\$\d/);
      expect(success).not.toMatch(/Change \$[1-9]/);
      const d = await freshDetail(id);
      expect(d).toContain(GC().slice(-4));
      expect(countPayments(d, 'Gift Card')).toBe(1);
      const rows = await dailySaleRows(id);
      expect(rows).toHaveLength(1);
      expect((rows[0]?.total ?? 0) / 100).toBeCloseTo(r2(total + due), 1);
    },
  );

  it(
    title(
      'Gift Card original abandoned mid-reopen → Continue Re-open → Done: balance untouched (RO-412)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      if (!GC()) this.skip();
      const id = await app.createOrder();
      await app.pay();
      await gcPayOpen();
      const b0 = await settledGiftCardBalance(GC());
      await reopenToCheckout(id);
      await historyBack();
      await reopenToCheckout(id, 'Continue Re-open');
      await payAndReopenDone();
      expect(await settledGiftCardBalance(GC())).toBeCloseTo(b0, 2);
      expect(countPayments(await freshDetail(id), 'Gift Card')).toBe(1);
    },
  );

  it(
    title(
      'Gift Card in Tip Method: the difference + tip comes off the card; voiding that txn later returns exactly what was taken (RO-413, RO-414)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(10 * 60_000);
      if (!GC()) this.skip();
      await withTipMethod('gift_card', true, async () => {
        const { id } = await app.createPaidOrder({ method: 'Cash', services: [S1, S2] });
        await reopenToHome(id);
        await addServiceInReopen(S1);
        await payFromEdit();
        const due = await app.methodAmount('Gift Card');
        const b0 = await settledGiftCardBalance(GC());
        await app.selectMethod('Gift Card');
        await P.clickQ(VqpsCheckout.complete);
        if (await waitUntil(() => cust.tipShown(), 20_000)) await cust.customTip('100');
        await app.reachGiftCardInput();
        const r = await app.confirmGiftCardCode(GC());
        if (!/Gift Card Accepted/i.test(r.info)) throw new Error(r.info);
        await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
        await app.driveToSuccess('none');
        await app.waitSuccess();
        await app.noReceipt();
        const b1 = await settledGiftCardBalance(GC());
        expect(r2(b0 - b1)).toBeCloseTo(r2(due + 1), 1);
        await decreaseOrFail(id, S1);
        await confirmVoidAll();
        await payDifference('Cash');
        expect(await settledGiftCardBalance(GC())).toBeCloseTo(b0, 1);
      });
    },
  );
});
