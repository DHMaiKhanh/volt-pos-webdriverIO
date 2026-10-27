/**
 * volt-qc port — 17 RE-OPEN (RO-*) and the Re-Open part of 07 ORDER HISTORY (OH-155..182),
 * cash / other orders.
 *
 * Source: volt-qc `e2e/tests/19-reopen/reopen-linear.spec.ts` (RO-A1..A5, B1, B5, C1, E2, G2, G3,
 * H1, H3, H5), `reopen-methods.spec.ts` (RO-301..303, 313, 501, 503, 507),
 * `07-order-history/oh-plan-reopen-tip.spec.ts` (OH-T72, T73), `history.spec.ts` (OH-D),
 * `oh-plan-detail.spec.ts` (OH-T52/T53 re-open half).
 * TC catalogues: docs/qc/volt-qc/windows-regression/17-reopen.md, 07-order-history.md.
 *
 * Reopen flow on this build: Order History › Re-Open Order › Confirm → checkout `?editOrderId`
 * → Edit Order → Home `?editOrderId` → Pay → Re-Open Done. Reopen mode hides every nav, so
 * "leaving" is a router history.back(); the reopened checkout has no Remaining row — the amount
 * owed is the pre-filled Enter Amount.
 *
 * CREATES, SETTLES, RE-OPENS AND RE-CHARGES ORDERS (cash / other) — dev / staging only.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import {
  OhRoButtons as B,
  OhRoDialogs as D,
  OhRoText as T,
} from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { payInCash, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { checkoutPage, homePage } from '../../../../src/pages/index.js';
import {
  adjustTipTo,
  backToOrderFromVoid,
  cancelOrder,
  cannotContinueText,
  cartLineCount,
  centsIn,
  changeStaffTo,
  checkoutState,
  confirmVoidAll,
  countPayments,
  createPaidOrder,
  detailActions,
  detailText,
  editOrderFromCheckout,
  enterCodeRaw,
  enteredFor,
  field,
  findHistoryCode,
  freshDetail,
  freshTill,
  isVoidDialogShown,
  leaveReopen,
  openByCode,
  openHistoryOrder,
  openReceipt,
  passcodeIfAsked,
  payDifference,
  payFromEdit,
  paymentSection,
  receiptText,
  removeCartLine,
  reopenDialogText,
  reopenDone,
  reopenToCheckout,
  reopenToHome,
  setPasscodeGate,
  staffInDetail,
  staffRoleCode,
  tenderAmountCents,
  tryAddService,
  waitStatus,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { openRow, rowDates, rowCodes } from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const SKIP_KEY = 'volt-passcode-skip';

/** Walk off the reopened checkout the way a closed app would (router history.back()). */
async function abandonReopen(): Promise<void> {
  await browser.execute(() => {
    window.history.back();
  });
  await P.poll(
    () => P.path(),
    (p) => p.startsWith('/order-history/'),
    Timeouts.NAVIGATION,
  );
  await settle(800);
}

/** Σ cart line prices vs footer Subtotal on the Home editor. */
async function linesAddUp(): Promise<{ sum: number; subtotal: number }> {
  const lines = await homePage.cartLinePricesCents();
  return { sum: lines.reduce((a, b) => a + b, 0), subtotal: await homePage.cartSubtotal() };
}

describe('volt-qc 17 RE-OPEN — cash / other orders (write)', () => {
  afterEach(async () => {
    await leaveReopen();
  });
  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Re-Open dialog: copy + "one edit left" message; Cancel keeps Successful - Unsettled (OH-155, OH-174, RO-001)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'other' });
      const text = await reopenDialogText(orderId);
      expect(text).toContain(T.reopenBody);
      expect(text).toContain(T.msgHasEdit);
      expect(text).not.toContain(T.msgNoEdit);
      expect(await waitStatus(code, /^Successful - Unsettled$/, 10_000)).toBe('Successful - Unsettled');
    },
  );

  it(
    title(
      'Confirm + code → reopened checkout (Edit Order, Re-Open Done, $0 owed on every tender); Done with no change restores the order, one Cash txn (OH-156, OH-159, RO-005, RO-061)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'cash' });
      await reopenToCheckout(orderId);
      expect(await browser.getUrl()).toContain('editOrderId=');
      expect(await P.has({ role: 'button', name: B.editOrder })).toBe(true);
      expect(await P.has({ role: 'button', name: B.reopenDone })).toBe(true);
      expect(await isVoidDialogShown()).toBe(false);
      for (const t of ['cash', 'other', 'card'] as const) expect(await enteredFor(t)).toBe(0);
      expect(await P.pageText('body')).not.toMatch(/tax (has )?increased/i);
      await reopenDone();
      expect(await waitStatus(code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
      expect(countPayments(await detailText(code), 'Cash')).toBe(1);
    },
  );

  it(
    title(
      'Leaving mid-reopen: status Re-open, Receipt + Continue Re-open only; continue → Done, still one Cash txn and the edit left (OH-160, RO-006, RO-136, RO-301)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'cash' });
      await reopenToCheckout(orderId);
      await abandonReopen();
      await openHistoryOrder(orderId);
      expect(field(await detailText(code), 'Status')).toBe('Re-open');
      const a = await detailActions();
      expect(a[B.continueReopen]).toBe(true);
      expect(a[B.receipt]).toBe(true);
      for (const k of [B.cancelOrder, B.adjustTip, B.splitTip, 'Refund']) expect(a[k]).toBe(false);
      await reopenToCheckout(orderId, B.continueReopen);
      await reopenDone();
      expect(await waitStatus(code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
      expect(countPayments(await detailText(code), 'Cash')).toBe(1);
      expect(await reopenDialogText(orderId)).toContain(T.msgHasEdit);
    },
  );

  it(
    title(
      'Reopen mode: header "Edit Order", staff/service tiles locked after the edit is spent, no Split; item dialog only edits the note (≤ 80) (OH-157, OH-158)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'other' });
      await reopenToHome(orderId);
      await step('OH-157 header + no Split', async () => {
        expect(await P.pageText('body')).toMatch(new RegExp(`Edit Order:? ?#?${code}`));
        expect(await homePage.isSplitOrderAvailable().catch(() => false)).toBe(false);
      });
      await step('OH-158 item dialog: note only, Save off until changed, 80 max', async () => {
        await P.clickQ([
          { css: 'main div.pr-11', nth: 0 },
          { css: 'span', nth: 0 },
        ]);
        const note = [D.itemEditor, { css: 'textarea, input[placeholder="Add note"]', nth: 0 }] as const;
        await P.waitFor(D.itemEditor, Timeouts.SHORT, 'item dialog');
        expect(await P.isDisabled([D.itemEditor, btn('Save', 0)])).toBe(true);
        await P.fillQ(note, 'x'.repeat(81));
        expect((await P.inputValue(note)).length).toBe(T.maxReason);
        await P.fillQ(note, 'Reopen note E2E');
        expect(await P.isDisabled([D.itemEditor, btn('Save', 0)])).toBe(false);
        await P.clickQ([D.itemEditor, btn('Save', 0)]);
        await P.waitGoneQ(D.itemEditor, Timeouts.SHORT, 'item dialog');
        expect(await P.pageText('main')).toContain('Reopen note E2E');
      });
      await reopenDone();
      expect(await waitStatus(code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
    },
  );

  it(
    title(
      'Add a service and pay the difference in Cash: Σ lines = Subtotal, Other = Cash, Enter Amount = new total − paid (refilled on return), second txn, receipt + Payment Details list both; edit spent → locked message, 2nd reopen cannot add (OH-165, OH-174, RO-002, RO-003, RO-012, RO-015, RO-062, RO-131, RO-132, RO-302, RO-311, RO-313)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { orderId, code, paidCents } = await createPaidOrder({ method: 'other' });
      await reopenToHome(orderId);
      expect(await tryAddService(1)).toBe(true);
      await step('RO-062 lines add up to Subtotal', async () => {
        const { sum, subtotal } = await linesAddUp();
        expect(sum).toBe(subtotal);
      });
      await payFromEdit();
      expect(await isVoidDialogShown()).toBe(false);
      let due = 0;
      await step('RO-012 / RO-302 / RO-313 amounts owed', async () => {
        const cash = await tenderAmountCents('Cash');
        const other = await tenderAmountCents('Other');
        expect(other).toBe(cash);
        const card = await tenderAmountCents('Card');
        if (!Number.isNaN(card)) expect(card).toBeGreaterThanOrEqual(cash);
        due = await enteredFor('cash');
        expect(due).toBeGreaterThan(0);
        expect(due).toBe(cash);
        await checkoutPage.clearAmount();
        expect(await checkoutPage.enteredAmountCents()).toBe(0);
        await enteredFor('other');
        expect(await enteredFor('cash')).toBe(due);
      });
      await payDifference(orderId, 'cash');
      let d = await freshDetail(orderId, (x) => countPayments(x, 'Cash') === 1);
      {
        // RO-015 / OH-165 / RO-132 second transaction, listed after the first
        expect(field(d, 'Status')).toBe('Successful - Unsettled');
        expect(countPayments(d, 'Other')).toBe(1);
        expect(countPayments(d, 'Cash')).toBe(1);
        expect(centsIn(field(d, 'Total'))).toBe(paidCents + due);
        const pay = paymentSection(d);
        expect(pay.indexOf('Other')).toBeLessThan(pay.lastIndexOf('Cash'));
      }
      await step('RO-131 / RO-311 receipt shows both payments', async () => {
        await openReceipt();
        const r = await receiptText();
        expect(r).toMatch(/Other/);
        expect(r).toMatch(/Cash/);
        await P.escape();
      });
      await step('RO-002 / OH-174 dialog now says items and prices are locked', async () => {
        const text = await reopenDialogText(orderId);
        expect(text).toContain(T.msgNoEdit);
        expect(text).not.toContain(T.msgHasEdit);
      });
      await step('RO-003 second reopen cannot add a service; Done makes no txn', async () => {
        await reopenToHome(orderId);
        expect(await tryAddService(0)).toBe(false);
        await payFromEdit();
        expect(await checkoutPage.enteredAmountCents()).toBe(0);
        await reopenDone();
        d = await freshDetail(orderId);
        expect(countPayments(d, 'Other') + countPayments(d, 'Cash')).toBe(2);
        expect(code).toBe(field(d, 'Order ID'));
      });
    },
  );

  it(
    title(
      'Remove a line and add the same service back: total unchanged → no void, $0 owed, Done, no txn and the edit is not spent (OH-166, RO-004)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'other' });
      await reopenToHome(orderId);
      await removeCartLine(0);
      await homePage.selectStaffByIndex(0);
      await homePage.addServiceByIndex(0);
      await settle(Timeouts.DEBOUNCE);
      await payFromEdit();
      expect(await isVoidDialogShown()).toBe(false);
      expect(await checkoutPage.enteredAmountCents()).toBe(0);
      await reopenDone();
      expect(await waitStatus(code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
      expect(countPayments(await detailText(code), 'Other')).toBe(1);
      expect(await reopenDialogText(orderId)).toContain(T.msgHasEdit);
    },
  );

  it(
    title(
      'Lower total (drop a service): Void Order Transactions; Back to Order keeps the txn; Confirm Void → $0 paid → pay the new total again in Other (OH-167, RO-020, RO-021, RO-507)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { orderId, code } = await createPaidOrder({
        method: 'other',
        lines: [
          [0, 0],
          [0, 1],
        ],
      });
      await reopenToHome(orderId);
      await removeCartLine(-1);
      await P.clickQ(inMain(btn('Pay', 0)));
      await passcodeIfAsked(1_500);
      const blocked = await cannotContinueText();
      if (blocked) {
        await homePage.addServiceByIndex(1).catch(() => undefined);
        await reopenDone().catch(() => undefined);
        throw new Error(
          `A lower re-open total is blocked instead of voiding (VP-2585 §3 vs VP-3670): ${blocked}`,
        );
      }
      await P.waitFor(D.voidTransactions, Timeouts.MEDIUM, 'Void Order Transactions');
      expect((await P.rawText(D.voidTransactions)) ?? '').toContain(T.voidBody);
      await step('RO-021 Back to Order keeps the old payment', async () => {
        await backToOrderFromVoid();
        await P.poll(
          () => P.path(),
          (p) => p.startsWith('/home'),
          Timeouts.MEDIUM,
        );
        await payFromEdit();
        await P.waitFor(D.voidTransactions, Timeouts.MEDIUM, 'Void Order Transactions');
      });
      await step('RO-020 / RO-507 Confirm Void → re-pay in Other', async () => {
        await confirmVoidAll();
        const st = await checkoutState();
        if (!Number.isNaN(st.totalPaid)) expect(st.totalPaid).toBe(0);
        const owed = await enteredFor('other');
        expect(owed).toBeGreaterThan(0);
        await payDifference(orderId, 'other');
        expect(await waitStatus(code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
        const d = await freshDetail(orderId);
        expect(centsIn(field(d, 'Total'))).toBe(owed);
        expect(paymentSection(d)).toMatch(/Voided/);
      });
    },
  );

  it(
    title(
      "Change the whole order's staff in reopen: detail shows the new staff, total and the $2 tip move with it, still one Cash txn (OH-161, RO-041, RO-103, RO-017)",
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await freshTill();
      if ((await homePage.visibleStaffCount()) < 2) this.skip();
      const { orderId, code, paidCents } = await createPaidOrder({ method: 'cash' });
      const before = staffInDetail(await detailText(code))[0] ?? '';
      await adjustTipTo('200');
      await P.poll(
        () => detailText(code),
        (t) => field(t, 'Tip') === '$2.00',
        15_000,
      );
      await reopenToCheckout(orderId);
      await step('RO-017 reopened checkout keeps the paid tip', async () => {
        const st = await checkoutState();
        if (!Number.isNaN(st.tip)) expect(st.tip).toBe(200);
      });
      await editOrderFromCheckout();
      await changeStaffTo(1);
      await reopenDone();
      const d = await freshDetail(orderId, (x) => !staffInDetail(x).includes(before));
      const after = staffInDetail(d);
      expect(after).not.toContain(before);
      expect(after.length).toBe(1);
      expect(d).toContain(`${after[0] ?? ''} - $2.00`);
      expect(field(d, 'Tip')).toBe('$2.00');
      expect(centsIn(field(d, 'Total'))).toBe(paidCents + 200);
      expect(countPayments(d, 'Cash')).toBe(1);
    },
  );

  it(
    title(
      'Move one service from staff A to staff B in reopen: total unchanged, detail lists both staff (RO-040)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await freshTill();
      if ((await homePage.visibleStaffCount()) < 2) this.skip();
      const { orderId, code, paidCents } = await createPaidOrder({
        method: 'other',
        lines: [
          [0, 0],
          [0, 1],
        ],
      });
      const a = staffInDetail(await detailText(code))[0] ?? '';
      await reopenToHome(orderId);
      // Re-book the last line to staff tile 1: remove it, add the same tile under staff 1.
      await removeCartLine(-1);
      await homePage.selectStaffByIndex(1);
      await homePage.addServiceByIndex(1);
      await settle(Timeouts.DEBOUNCE);
      await payFromEdit();
      expect(await isVoidDialogShown()).toBe(false);
      expect(await checkoutPage.enteredAmountCents()).toBe(0);
      await reopenDone();
      const d = await freshDetail(orderId);
      const staff = staffInDetail(d);
      expect(staff).toContain(a);
      expect(staff.length).toBe(2);
      expect(centsIn(field(d, 'Total'))).toBe(paidCents);
    },
  );

  it(
    title(
      'Raise a service price in reopen: only the difference is owed and charged (RO-107)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { orderId, code, paidCents } = await createPaidOrder({ method: 'cash' });
      await reopenToHome(orderId);
      await homePage.openServiceEditor();
      const price = await homePage.serviceEditorPriceCents();
      await homePage.setServiceEditorPrice(price + 1_000);
      await homePage.saveServiceEditor();
      await settle(Timeouts.DEBOUNCE);
      await payFromEdit();
      const due = await enteredFor('cash');
      expect(due).toBeGreaterThanOrEqual(1_000);
      expect(due).toBeLessThan(paidCents + 1_000);
      await payDifference(orderId, 'cash');
      const d = await freshDetail(orderId, (x) => countPayments(x, 'Cash') === 2);
      expect(countPayments(d, 'Cash')).toBe(2);
      expect(centsIn(field(d, 'Total'))).toBe(paidCents + due);
      expect(field(d, 'Order ID')).toBe(code);
    },
  );

  it(
    title(
      'Pay the difference in Cash with too much cash: Change shows, the new txn records only the difference (RO-096)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { orderId, paidCents } = await createPaidOrder({ method: 'cash' });
      await reopenToHome(orderId);
      expect(await tryAddService(1)).toBe(true);
      await payFromEdit();
      const due = await enteredFor('cash');
      if (due >= 88_888) this.skip();
      const success = await payInCash(orderId, { tenderedCents: 88_888 });
      await success.continueToNextOrder();
      await success.waitForFlowToEnd();
      const d = await freshDetail(orderId, (x) => countPayments(x, 'Cash') === 2);
      expect(centsIn(field(d, 'Total'))).toBe(paidCents + due);
      const pay = paymentSection(d);
      expect(pay).toMatch(/Change:? \|?\s*\$[1-9][\d,]*\.\d{2}/);
    },
  );

  it(
    title(
      'Cash presets REPLACE the entered amount while paying the difference (RO-303)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { orderId } = await createPaidOrder({ method: 'cash' });
      await reopenToHome(orderId);
      expect(await tryAddService(1)).toBe(true);
      await payFromEdit();
      await enteredFor('cash');
      const presets = (await checkoutPage.cashPresetLabels())
        .map((l) => centsIn(l))
        .filter((c) => !Number.isNaN(c));
      if (presets.length < 2) this.skip();
      for (const p of presets.slice(0, 2)) {
        await P.clickQ(inMain(btn(`$${String(p / 100)}`, 0)));
        await settle(300);
        expect(await checkoutPage.enteredAmountCents()).toBe(p);
      }
      await enteredFor('other');
      await enteredFor('cash');
      await payDifference(orderId, 'cash');
    },
  );

  it(
    title(
      'Other order, add a service, pay the difference in Other: amount = Cash (no SF), Other cannot exceed what is owed, a 2nd Other txn; edit spent afterwards (RO-084, RO-501, RO-503, RO-509)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      const { orderId, paidCents } = await createPaidOrder({ method: 'other' });
      await reopenToHome(orderId);
      expect(await tryAddService(1)).toBe(true);
      await payFromEdit();
      const cash = await enteredFor('cash');
      const other = await enteredFor('other');
      expect(other).toBe(cash);
      await step('RO-503 typing more than owed on Other clamps to the difference', async () => {
        await checkoutPage.enterAmount(other + 1_000);
        await settle(300);
        expect(await checkoutPage.enteredAmountCents()).toBeLessThanOrEqual(other);
        await checkoutPage.enterAmount(other);
      });
      await payDifference(orderId, 'other', 'E2E Other 2');
      const d = await freshDetail(orderId, (x) => countPayments(x, 'Other') === 2);
      expect(countPayments(d, 'Other')).toBe(2);
      expect(centsIn(field(d, 'Total'))).toBe(paidCents + other);
      await step('RO-509 second reopen cannot add a service', async () => {
        expect(await reopenDialogText(orderId)).toContain(T.msgNoEdit);
        await reopenToHome(orderId);
        expect(await tryAddService(0)).toBe(false);
        await reopenDone();
      });
    },
  );

  it(
    title(
      'Quick Pay $25 added in reopen: its line price agrees with Subtotal (RO-063)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'other' });
      await reopenToHome(orderId);
      const before = await cartLineCount();
      await homePage.addQuickPayItem(2_500);
      await settle(Timeouts.DEBOUNCE);
      if ((await cartLineCount()) === before) this.skip(); // Quick Pay locked in reopen on this build
      const { sum, subtotal } = await linesAddUp();
      expect(sum).toBe(subtotal);
      await removeCartLine(-1);
      await payFromEdit();
      expect(await checkoutPage.enteredAmountCents()).toBe(0);
      await reopenDone();
      expect(await waitStatus(code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
    },
  );

  it(
    title(
      'Canceled orders cannot be re-opened or edited; only allowed statuses show Re-Open (OH-178, OH-182)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { code } = await createPaidOrder({ method: 'other' });
      expect((await detailActions())[B.reopen]).toBe(true);
      await cancelOrder(0);
      expect(await waitStatus(code, /^Canceled$/, 90_000)).toBe('Canceled');
      const a = await detailActions();
      expect(a[B.reopen]).toBe(false);
      expect(a[B.continueReopen]).toBe(false);
      expect(await P.has({ role: 'button', name: B.editOrder })).toBe(false);
    },
  );

  it(
    title('An order from a previous business day has no Re-Open (VP-3060) (OH-175)', Tag.REGRESSION),
    async function () {
      this.timeout(4 * 60_000);
      await findHistoryCode(['successful'], [], 7);
      const today = new Date();
      const codes = await rowCodes();
      const dates = await rowDates();
      const todayMdy = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${String(today.getFullYear())}`;
      const i = dates.findIndex((d) => d !== todayMdy);
      const old = i >= 0 ? codes[i] : undefined;
      if (!old) this.skip();
      await openRow(old ?? '');
      await P.waitFor({ css: 'main', hasText: `Order #${old ?? ''}` }, Timeouts.MEDIUM, 'old order');
      expect((await detailActions())[B.reopen]).toBe(false);
    },
  );

  it(
    title(
      'Re-Open Order gate OFF: Confirm opens the checkout with no passcode (OH-177)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { orderId } = await createPaidOrder({ method: 'other' });
      const saved = await P.localGet(SKIP_KEY);
      const before = await setPasscodeGate('reopen_order', false);
      try {
        await P.localSet(SKIP_KEY, null);
        await openHistoryOrder(orderId);
        await P.clickQ(inMain(btn(B.reopen, 0)));
        await P.waitFor(D.reopen, Timeouts.MEDIUM, 'Re-Open Order?');
        await P.clickQ([D.reopen, btn('Confirm', 0)]);
        expect(
          await P.poll(
            () => P.has(D.passcode),
            (v) => v,
            2_500,
          ),
        ).toBe(false);
        expect(
          await P.poll(
            () => P.path(),
            (p) => /\/checkout$/.test(p),
            Timeouts.NAVIGATION,
          ),
        ).toMatch(/\/checkout$/);
        await reopenDone();
      } finally {
        await leaveReopen();
        await setPasscodeGate('reopen_order', before);
        await P.localSet(SKIP_KEY, saved);
      }
    },
  );

  it(
    title(
      'A Staff-role code without Edit Order permission cannot re-open (OH-176)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const staffCode = staffRoleCode();
      if (!staffCode) this.skip();
      const { code } = await createPaidOrder({ method: 'other' });
      const saved = await P.localGet(SKIP_KEY);
      await P.localSet(SKIP_KEY, null);
      try {
        await P.clickQ(inMain(btn(B.reopen, 0)));
        if (
          await P.poll(
            () => P.has(D.reopen),
            (v) => v,
            2_500,
          )
        )
          await P.clickQ([D.reopen, btn('Confirm', 0)]);
        if (
          !(await P.poll(
            () => P.has(D.passcode),
            (v) => v,
            3_000,
          ))
        )
          this.skip();
        const r = await enterCodeRaw(staffCode);
        if (!r.visible) this.skip(); // the Staff role may edit orders here
        expect(r.text).toContain("You don't have permission for this action");
        await P.escape();
        expect(await browser.getUrl()).not.toMatch(/editOrderId=/);
      } finally {
        await leaveReopen();
        await P.localSet(SKIP_KEY, saved);
      }
      await openByCode(code);
      expect(field(await detailText(code), 'Status')).toBe('Successful - Unsettled');
    },
  );

  it(
    title('Confirm Void asks for the staff code (VP-687) (RO-104)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(6 * 60_000);
      const { orderId, code } = await createPaidOrder({
        method: 'other',
        lines: [
          [0, 0],
          [0, 1],
        ],
      });
      const saved = await P.localGet(SKIP_KEY);
      try {
        await reopenToHome(orderId);
        await removeCartLine(-1);
        await P.clickQ(inMain(btn('Pay', 0)));
        await passcodeIfAsked(1_500);
        if (await cannotContinueText()) this.skip(); // lower totals blocked on this build (see the void case)
        await P.waitFor(D.voidTransactions, Timeouts.MEDIUM, 'Void Order Transactions');
        await P.localSet(SKIP_KEY, null);
        await P.clickQ([D.voidTransactions, btn(B.confirmVoid, 0)]);
        expect(
          await P.poll(
            () => P.has(D.passcode),
            (v) => v,
            5_000,
          ),
        ).toBe(true);
        await passcodeIfAsked(1_000);
        await P.poll(
          () => P.pageText('body'),
          (t) => t.includes(T.voidDone),
          Timeouts.LONG,
        );
        await payDifference(orderId, 'other');
        expect(await waitStatus(code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
      } finally {
        await P.localSet(SKIP_KEY, saved);
      }
    },
  );

  it(
    title(
      'Cash order, drop a service: the Cash txn is voided (not refunded) and the new total is paid again in Cash (RO-308)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { orderId, code } = await createPaidOrder({
        method: 'cash',
        lines: [
          [0, 0],
          [0, 1],
        ],
      });
      await reopenToHome(orderId);
      await removeCartLine(-1);
      await P.clickQ(inMain(btn('Pay', 0)));
      await passcodeIfAsked(1_500);
      const blocked = await cannotContinueText();
      if (blocked) {
        await homePage.addServiceByIndex(1).catch(() => undefined);
        await reopenDone().catch(() => undefined);
        throw new Error(
          `A lower re-open total is blocked instead of voiding (VP-2585 §3 vs VP-3670): ${blocked}`,
        );
      }
      await P.waitFor(D.voidTransactions, Timeouts.MEDIUM, 'Void Order Transactions');
      await confirmVoidAll();
      const owed = await enteredFor('cash');
      expect(owed).toBeGreaterThan(0);
      await payDifference(orderId, 'cash');
      expect(await waitStatus(code, /^Successful - Unsettled$/)).toBe('Successful - Unsettled');
      const d = await freshDetail(orderId);
      expect(paymentSection(d)).toMatch(/Voided/);
      expect(paymentSection(d)).not.toMatch(/Refunded/);
      expect(centsIn(field(d, 'Total'))).toBe(owed);
    },
  );

  it(
    title(
      'Other order named "Zelle", reopen without change → Done: the old txn keeps its method name (RO-511)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'other', otherName: 'Zelle' });
      expect(paymentSection(await detailText(code))).toContain('Zelle');
      await reopenToCheckout(orderId);
      await reopenDone();
      const d = await freshDetail(orderId);
      expect(paymentSection(d)).toContain('Zelle');
      expect(countPayments(d, 'Other')).toBe(1);
    },
  );

  it(
    title(
      'An order edited through reopen carries the "Updated" tag (VP-3825) (OH-090)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await freshTill();
      if ((await homePage.visibleStaffCount()) < 2) this.skip();
      const { orderId, code } = await createPaidOrder({ method: 'other' });
      expect(await detailText(code)).not.toMatch(/\| Updated \|/);
      await reopenToHome(orderId);
      await changeStaffTo(1);
      await reopenDone();
      const d = await freshDetail(orderId, (x) => /\bUpdated\b/.test(x));
      expect(d).toMatch(/\bUpdated\b/);
    },
  );
});
