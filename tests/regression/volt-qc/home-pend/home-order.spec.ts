/**
 * volt-qc port — 02 HOME: building, totalling, deleting and re-staffing an order (WRITE cases).
 *
 * Source: volt-qc `e2e/tests/02-home/order.spec.ts` (HOME-B, C, F),
 * `home-plan-order.spec.ts` (HOME-W1…W6, U1…U3, M1…M4, N1…N3, T1…T3, V1, V2, REOPEN)
 * and the shortcut step of `home-deep.spec.ts` (HOME-D01 step 4).
 * TC catalogue: docs/qc/volt-qc/windows-regression/02-home-tao-order.md.
 *
 * Adaptations vs the source:
 * - Staff / services are discovered at runtime (first staff names, first priced
 *   service tiles); a case that needs two of either skips on a smaller till.
 * - Totals are checked against identities (Σ lines = Subtotal, Total = Subtotal +
 *   Item Discount + Tax) instead of volt-qc's merchant price model.
 * - The settle uses Cash (`payInCash`) — the flow this suite has proven on merchant 14 —
 *   where volt-qc paid "Other".
 * - Passcode cases drop the run's 30-minute grant first so the guard really
 *   appears, and re-arm it afterwards.
 * - Customer-display halves (Welcome screen, Card/Cash tiles) are not driven.
 */

import { expect } from '@wdio/globals';
import { env } from '../../../../configs/env/loadEnv.js';
import { VqcCommon, VqcGiftCard, btn } from '../../../../src/constants/testids.voltqc-pos.js';
import {
  VqhDialog,
  VqhOrder,
  VqhPasscode,
  VqhSidebar,
  inDlg,
} from '../../../../src/constants/testids.voltqc-home-pend.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { checkoutPage, orderHistoryDetailPage } from '../../../../src/pages/index.js';
import {
  addService,
  attachNewCustomer,
  backToHome,
  cleanupOrders,
  clickRemoveLine,
  closePasscode,
  closeStrayDialogs,
  createOrder,
  created,
  currentOrderId,
  deleteCurrentOrder,
  discover,
  dropGrant,
  editItem,
  enteredAmount,
  fmt,
  inactiveCode,
  noDeleteCode,
  openLine,
  openPendingOrder,
  orderLines,
  orderStaffNames,
  passcodeShown,
  passcodeTitle,
  payCurrentInCash,
  payEnabled,
  pickStaff,
  pressPay,
  qp,
  quickPay,
  quickPayOrder,
  r2,
  randomPhone,
  removeLine,
  restoreGrant,
  selectTender,
  setDiscount,
  setEditorAmount,
  sidebarCardText,
  sidebarHas,
  summary,
  tenderAmount,
  testGiftCard,
  typeCode,
  uniqueName,
  unknownCode,
} from '../../../../src/pages/voltqc/home-pend/homePendProbe.js';
import {
  gcAdd,
  gcEnterCode,
  gcQuick,
  openSellGiftCard,
} from '../../../../src/pages/voltqc/pos/giftCardProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import {
  goToReopenEditor,
  leaveReopenCheckout,
  openOrderDetail,
  reopenOrder,
} from '../../order-flow/reopen-flow.helpers.js';

let staff: string[] = [];
let svc: string[] = [];

const A = (): string => staff[0] ?? '';
const B = (): string => staff[1] ?? '';
const S1 = (): string => svc[0] ?? '';
const S2 = (): string => svc[1] ?? '';

async function expectIdentity(): Promise<void> {
  const s = await summary();
  expect(s.total ?? NaN).toBeCloseTo(
    (s.subtotal ?? 0) + (s.itemDiscount ?? 0) + (s.promotion ?? 0) + (s.tax ?? 0),
    1,
  );
}

async function confirmDelete(choice: 'Delete' | 'Cancel'): Promise<void> {
  await P.waitFor(VqhDialog.deleteOrder, 8_000, 'Delete Order dialog');
  await P.clickQ(inDlg(VqhDialog.deleteOrder, btn(choice, 0)));
  await P.waitGoneQ(VqhDialog.deleteOrder, 8_000);
}

describe('volt-qc 02 HOME — order building & deleting (write)', () => {
  before(async () => {
    await returnToHome();
    const d = await discover();
    staff = d.staff;
    svc = d.services.map((s) => s.name);
  });

  beforeEach(function () {
    // Needs a staff and a priced service on this till.
    if (staff.length === 0 || svc.length === 0) this.skip();
  });

  afterEach(async () => {
    await closePasscode().catch(() => undefined);
    await closeStrayDialogs().catch(() => undefined);
    await restoreGrant();
    await cleanupOrders();
  });

  /* ---------------------------------------------------------------- B / C / F */

  it(
    title(
      'Staff + 2 services: Subtotal = Σ lines, Pay enabled, the order is in the sidebar with its staff/service (HOME-007, HOME-031, HOME-043)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      // Needs two priced services.
      if (svc.length < 2) this.skip();
      const id = await createOrder(A());
      expect(id).toMatch(/^OD\d{6}-\d+$/);
      expect(await P.has(VqhOrder.chooseService)).toBe(true);
      await addService(S1());
      await addService(S2());
      const lines = await orderLines();
      expect(lines.map((l) => l.name)).toEqual([S1(), S2()]);
      const s = await summary();
      expect(s.subtotal ?? NaN).toBeCloseTo(r2(lines.reduce((a, l) => a + l.price, 0)), 2);
      await expectIdentity();
      expect(await payEnabled()).toBe(true);
      expect(await sidebarHas(id, 15_000)).toBe(true);
      const card = await P.poll(
        () => sidebarCardText(id),
        (t) => t.includes(S1()),
        15_000,
      );
      expect(card).toContain(S1());
      expect(card).toContain(A());
      await P.fillQ(VqhSidebar.search, '');
    },
  );

  it(
    title(
      'Remove one service with confirmation, then change all services from staff A to staff B (HOME-078, HOME-084)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      // Needs two staff and two services.
      if (staff.length < 2 || svc.length < 2) this.skip();
      await createOrder(A(), [S1(), S2()]);
      await removeLine(S2());
      expect((await orderLines()).map((l) => l.name)).toEqual([S1()]);
      const s = await summary();
      expect(s.subtotal ?? NaN).toBeCloseTo((await orderLines())[0]?.price ?? NaN, 2);

      await P.clickQ(VqhOrder.changeStaff);
      await P.waitFor(VqhOrder.changeFrom, 5_000, '"Change from"');
      await P.jsClickQ(VqhOrder.staffTile(B()));
      await P.clickQ(inDlg(VqhDialog.changeStaffConfirm, btn('Confirm', 0)));
      await P.waitGoneQ(VqhDialog.changeStaffConfirm, 8_000);
      expect(await P.poll(orderStaffNames, (n) => n.includes(B()), 10_000)).toEqual([B()]);
    },
  );

  it(
    title(
      "Switching between two pending orders via the sidebar keeps each order's data (HOME-010, PEND-040)",
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (staff.length < 2 || svc.length < 2) this.skip();
      const a = await createOrder(A(), [S1()]);
      const b = await createOrder(B(), [S2()]);
      await openPendingOrder(a);
      expect((await orderLines()).map((l) => l.name)).toEqual([S1()]);
      expect(await orderStaffNames()).toEqual([A()]);
      await openPendingOrder(b);
      expect((await orderLines()).map((l) => l.name)).toEqual([S2()]);
      expect(await orderStaffNames()).toEqual([B()]);
    },
  );

  /* ---------------------------------------------------------------- W: delete */

  it(
    title(
      'An unpaid order has Remove (no Cancel Order); Remove → passcode FIRST → confirm → order gone (HOME-146, HOME-147)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      await attachNewCustomer(randomPhone(), uniqueName('QC Del'));
      expect(await P.has(VqhOrder.remove)).toBe(true);
      expect(await P.count(VqhOrder.cancelOrder)).toBe(0);

      await dropGrant();
      await P.clickQ(VqhOrder.remove);
      expect(await passcodeShown()).toBe(true);
      expect(await passcodeTitle()).toBe(VqhPasscode.deleteOrderTitle);
      expect(await P.count(VqhDialog.deleteOrder)).toBe(0);
      const r = await typeCode(env.STAFF_PASSCODE);
      expect(r.open).toBe(false);
      await P.waitFor(VqhDialog.deleteOrder, 8_000, 'Delete Order');
      expect(
        await P.has([VqhDialog.deleteOrder, { text: 'Are you sure you want to delete this entire order?' }]),
      ).toBe(true);
      await confirmDelete('Delete');
      created.delete(id);
      expect(await sidebarHas(id, 3_000)).toBe(false);
      await P.fillQ(VqhSidebar.search, '');
    },
  );

  it(
    title(
      'Remove → passcode → Cancel on "Delete Order" keeps the order, its line and customer (HOME-148)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      const name = uniqueName('QC Keep');
      await attachNewCustomer(randomPhone(), name);
      await dropGrant();
      await P.clickQ(VqhOrder.remove);
      expect(await passcodeShown()).toBe(true);
      expect(await P.count(VqhDialog.deleteOrder)).toBe(0);
      await typeCode(env.STAFF_PASSCODE);
      await confirmDelete('Cancel');
      expect(await currentOrderId()).toBe(id);
      expect((await orderLines()).map((l) => l.name)).toEqual([S1()]);
      expect(await P.pageText()).toContain(name);
    },
  );

  it(
    title(
      'Remove → close the passcode with Escape / X: no confirm opens, the order stays (HOME-149)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      await dropGrant();
      await P.clickQ(VqhOrder.remove);
      expect(await passcodeShown()).toBe(true);
      await P.escape();
      await P.waitGoneQ(VqcCommon.passcodeDialog, 5_000);
      expect(await P.count(VqhDialog.deleteOrder)).toBe(0);

      await P.clickQ(VqhOrder.remove);
      expect(await passcodeShown()).toBe(true);
      await P.clickQ([VqcCommon.passcodeDialog, { css: 'button', nth: 0 }]);
      await P.waitGoneQ(VqcCommon.passcodeDialog, 5_000);
      expect(await P.count(VqhDialog.deleteOrder)).toBe(0);
      expect(await currentOrderId()).toBe(id);
      expect((await orderLines()).map((l) => l.name)).toEqual([S1()]);
    },
  );

  it(
    title(
      'Remove → an unknown code is rejected; an Inactive staff code says "This staff is inactive" (HOME-150)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(A(), [S1()]);
      await dropGrant();
      await P.clickQ(VqhOrder.remove);
      const wrong = await typeCode(unknownCode());
      expect(wrong.open).toBe(true);
      expect(wrong.text).toMatch(new RegExp(VqhPasscode.wrongCodeRe));
      expect(await P.count(VqhDialog.deleteOrder)).toBe(0);
      await closePasscode();
      if (inactiveCode()) {
        await P.clickQ(VqhOrder.remove);
        const inactive = await typeCode(inactiveCode());
        expect(inactive.open).toBe(true);
        expect(inactive.text).toContain(VqhPasscode.inactiveText);
        await closePasscode();
        expect(await P.count(VqhDialog.deleteOrder)).toBe(0);
      }
    },
  );

  it(
    title(
      'A role without Delete Order gets "You don\'t have permission for this action" and no confirm (HOME-151)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      // Needs VOLT_NO_DELETE_ORDER_CODE: the code of a staff whose role lacks Delete Order.
      if (!noDeleteCode()) this.skip();
      await createOrder(A(), [S1()]);
      await dropGrant();
      await P.clickQ(VqhOrder.remove);
      const r = await typeCode(noDeleteCode());
      expect(r.open).toBe(true);
      expect(r.text).toContain(VqhPasscode.noPermissionText);
      await closePasscode();
      expect(await P.count(VqhDialog.deleteOrder)).toBe(0);
    },
  );

  it(
    title(
      'Ticking "Do not require passcode for the next 30 minutes" on order 1 → order 2 Remove goes straight to confirm (HOME-152)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(A(), [S1()]);
      await dropGrant();
      await P.clickQ(VqhOrder.remove);
      expect(await passcodeShown()).toBe(true);
      expect(await P.has([VqcCommon.passcodeDialog, { text: VqhPasscode.skipLabel }])).toBe(true);
      await typeCode(env.STAFF_PASSCODE, { skip30: true });
      await confirmDelete('Delete');

      await createOrder(A(), [S1()]);
      await P.clickQ(VqhOrder.remove);
      await P.waitFor(VqhDialog.deleteOrder, 8_000, 'Delete Order (no passcode)');
      expect(await P.count(VqcCommon.passcodeDialog)).toBe(0);
      await confirmDelete('Delete');
      for (const id of [...created]) if (!(await sidebarHas(id, 1_000))) created.delete(id);
    },
  );

  /* ---------------------------------------------------------------- U: Pay / Print / Split */

  it(
    title(
      'Staff only (no service): Pay, Print and Split are all disabled (HOME-136)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(A());
      expect(await P.has(VqhOrder.chooseService)).toBe(true);
      expect(await P.isDisabled(VqhOrder.pay)).toBe(true);
      expect(await P.isDisabled(VqhOrder.split)).toBe(true);
      // Print = the icon button right before Split.
      const printDisabled = await P.exec<boolean>(
        'var s = document.querySelector("main button.bg-orange"); var p = s && s.previousElementSibling; return !!p && (p.disabled || p.getAttribute("aria-disabled") === "true");',
      );
      expect(printDisabled).toBe(true);
    },
  );

  it(
    title(
      'Pay (double-clicked) opens one checkout with Enter Amount = Total; back returns Home with the Total unchanged (HOME-137, HOME-138)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      const total = (await summary()).total ?? NaN;
      await P.exec<null>(
        'var b = Array.prototype.find.call(document.querySelectorAll("main button"), function (x) { return (x.textContent || "").trim() === "Pay"; }); if (b) { b.click(); b.click(); } return null;',
      );
      await P.poll(
        () => P.path(),
        (p) => /\/order\/[^/]+\/checkout/.test(p),
        15_000,
      );
      await checkoutPage.waitForReady();
      await selectTender('Card');
      expect(await enteredAmount()).toBeCloseTo(total, 2);
      await backToHome(id);
      expect(await currentOrderId()).toBe(id);
      expect((await summary()).total ?? NaN).toBeCloseTo(total, 2);
      expect(await sidebarHas(id)).toBe(true);
      expect((await P.texts(VqhSidebar.cards)).filter((t) => t.includes(id))).toHaveLength(1);
      await P.fillQ(VqhSidebar.search, '');
    },
  );

  it(
    title('Split is disabled at Total ≤ $5.00 and enabled above $5.00 (HOME-139)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await quickPayOrder(A(), [{ cents: 100, name: 'QP five' }]);
      let total = await P.poll(
        async () => (await summary()).total ?? NaN,
        (t) => t > 0,
        10_000,
      );
      expect(total).toBeLessThanOrEqual(5);
      expect(await P.isDisabled(VqhOrder.split)).toBe(true);
      await openLine('QP five');
      await setEditorAmount('1000');
      await P.clickQ(qp(btn('Update', 0)));
      await P.waitGoneQ(VqhDialog.quickPay, 10_000);
      total = await P.poll(
        async () => (await summary()).total ?? NaN,
        (t) => t > 5,
        10_000,
      );
      expect(total).toBeGreaterThan(5);
      expect(await P.isDisabled(VqhOrder.split)).toBe(false);
    },
  );

  /* ---------------------------------------------------------------- M: removing */

  it(
    title('Remove a line → Cancel keeps the line and the Total (HOME-079)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      if (svc.length < 2) this.skip();
      await createOrder(A(), [S1(), S2()]);
      const before = (await summary()).total ?? NaN;
      await clickRemoveLine(S2());
      await P.waitFor(VqhDialog.removeService, 5_000, 'Remove Service Item');
      await P.clickQ(inDlg(VqhDialog.removeService, btn('Cancel', 0)));
      await P.waitGoneQ(VqhDialog.removeService, 5_000);
      expect((await orderLines()).map((l) => l.name)).toEqual([S1(), S2()]);
      expect((await summary()).total ?? NaN).toBeCloseTo(before, 2);
    },
  );

  it(
    title(
      'Remove Staff removes every service of that staff and keeps the other group (HOME-080)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (staff.length < 2 || svc.length < 2) this.skip();
      await createOrder(A(), [S1(), S1()]);
      await pickStaff(B());
      await addService(S2());
      expect(await P.poll(orderStaffNames, (n) => n.length === 2, 10_000)).toEqual([A(), B()]);
      await P.clickQ([{ css: VqhOrder.groupCss, hasText: A(), nth: 0 }, btn('Delete Staff Order Item', 0)]);
      await P.waitFor(VqhDialog.removeStaff, 5_000, 'Remove Staff');
      expect(
        await P.has([
          VqhDialog.removeStaff,
          { text: 'Are you sure you want to remove this staff and all services assigned to them?' },
        ]),
      ).toBe(true);
      await P.clickQ(inDlg(VqhDialog.removeStaff, btn('Remove', 0)));
      await P.waitGoneQ(VqhDialog.removeStaff, 5_000);
      expect(await P.poll(orderStaffNames, (n) => !n.includes(A()), 10_000)).toEqual([B()]);
      expect((await orderLines()).map((l) => l.name)).toEqual([S2()]);
      await expectIdentity();
    },
  );

  it(
    title(
      'Store group (gift card sale): Split locked while it is there; no Change Staff on Store or a draft staff; Remove Store asks first (HOME-081, HOME-087, HOME-140)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      // Needs VOLT_TEST_GIFT_CARD (a card number used for a sale line — never paid here) and two staff.
      if (!testGiftCard() || staff.length < 2) this.skip();
      await createOrder(A(), [S1()]);
      await openSellGiftCard();
      await gcEnterCode(testGiftCard());
      await P.clickQ(gcQuick('$25'));
      await P.clickQ(gcAdd);
      await P.waitGoneQ(VqcGiftCard.dialog, 10_000);
      const store = {
        css: VqhOrder.groupCss,
        hasCss: 'span',
        hasTextRe: '(^|\\s)Store(\\s|$)',
        nth: 0,
      } as const;
      await P.waitFor(store, 10_000, 'Store group');
      expect(await P.count([store, btn('Change Staff')])).toBe(0);
      await step('HOME-140 a gift card line locks Split; Pay stays enabled', async () => {
        expect(await P.isDisabled(VqhOrder.split)).toBe(true);
        expect(await payEnabled()).toBe(true);
      });

      await step('HOME-087 a draft staff group ("Choose service") has no Change Staff', async () => {
        await pickStaff(B());
        const draft = { css: VqhOrder.groupCss, hasText: 'Choose service', nth: 0 } as const;
        await P.waitFor(draft, 8_000, 'draft staff group');
        expect(await P.count([draft, btn('Change Staff')])).toBe(0);
      });

      await P.clickQ([store, btn('Delete Staff Order Item', 0)]);
      await P.waitFor(VqhDialog.removeStore, 5_000, 'Remove Store');
      expect(
        await P.has([
          VqhDialog.removeStore,
          { text: 'Are you sure you want to remove this store and all products/gift cards?' },
        ]),
      ).toBe(true);
      await P.clickQ(inDlg(VqhDialog.removeStore, btn('Remove', 0)));
      await P.waitGoneQ(VqhDialog.removeStore, 5_000);
      expect(
        await P.poll(
          () => P.count(store),
          (n) => n === 0,
          8_000,
        ),
      ).toBe(0);
      expect((await orderLines()).some((l) => /^Gift Card \[/.test(l.name))).toBe(false);
    },
  );

  it(
    title(
      'Removing the last line keeps the order empty: "Choose service", Pay/Split disabled, Merge hidden, sidebar card $0.00 (HOME-082)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      await removeLine(S1());
      expect(await P.has(VqhOrder.chooseService)).toBe(true);
      expect(await P.isDisabled(VqhOrder.pay)).toBe(true);
      expect(await P.isDisabled(VqhOrder.split)).toBe(true);
      expect(await P.count(VqhOrder.mergeOrder)).toBe(0);
      expect(await currentOrderId()).toBe(id);
      expect(await sidebarHas(id, 15_000)).toBe(true);
      expect(
        await P.poll(
          () => sidebarCardText(id),
          (t) => t.includes('$0.00'),
          15_000,
        ),
      ).toContain('$0.00');
      await P.fillQ(VqhSidebar.search, '');
    },
  );

  /* ---------------------------------------------------------------- N: change staff */

  it(
    title(
      'Change Staff → pick B → Cancel on the confirm → red Cancel: services stay with A, change mode ends (HOME-085)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (staff.length < 2) this.skip();
      await createOrder(A(), [S1()]);
      await P.clickQ(VqhOrder.changeStaff);
      await P.waitFor(VqhOrder.changeFrom, 5_000, '"Change from"');
      await P.jsClickQ(VqhOrder.staffTile(B()));
      await P.waitFor(VqhDialog.changeStaffConfirm, 5_000, 'change-staff confirm');
      await P.clickQ(inDlg(VqhDialog.changeStaffConfirm, btn('Cancel', 0)));
      await P.waitGoneQ(VqhDialog.changeStaffConfirm, 5_000);
      await P.clickQ([{ css: VqhOrder.groupCss, nth: 0 }, btn('Cancel', 0)]);
      expect(
        await P.poll(
          () => P.count(VqhOrder.changeFrom),
          (n) => n === 0,
          5_000,
        ),
      ).toBe(0);
      expect(await orderStaffNames()).toEqual([A()]);
    },
  );

  it(
    title('Change A → B then pay: Order History records staff B only (HOME-086)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      if (staff.length < 2) this.skip();
      this.timeout(5 * 60_000);
      await createOrder(A(), [S1()]);
      await P.clickQ(VqhOrder.changeStaff);
      await P.waitFor(VqhOrder.changeFrom, 5_000);
      await P.jsClickQ(VqhOrder.staffTile(B()));
      await P.clickQ(inDlg(VqhDialog.changeStaffConfirm, btn('Confirm', 0)));
      expect(await P.poll(orderStaffNames, (n) => n.includes(B()), 10_000)).toEqual([B()]);
      const uuid = await payCurrentInCash();
      await openOrderDetail(uuid);
      const detail = await orderHistoryDetailPage.readServices().catch(async () => P.pageText());
      expect(detail).toContain(B());
      expect(detail).not.toContain(`Staff: ${A()}`);
      await returnToHome();
    },
  );

  it(
    title(
      'A group with 3 services has ONE Change Staff button for the whole group (HOME-088)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(A(), [S1(), S1(), S1()]);
      const group = { css: VqhOrder.groupCss, nth: 0 } as const;
      expect(await P.count([group, btn('Change Staff')])).toBe(1);
      expect(await P.count([group, { css: 'div.pr-11' }])).toBe(3);
      expect(await P.count([group, { css: 'div.pr-11' }, btn('Change Staff')])).toBe(0);
    },
  );

  /* ---------------------------------------------------------------- T: totals */

  it(
    title(
      'Quick Pay $20 + $30: Subtotal = Σ lines, no discount rows; 10% on $30 → Item Discount -$3.00 (HOME-130, HOME-131)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await quickPayOrder(A(), [
        { cents: 2000, name: 'QP twenty' },
        { cents: 3000, name: 'QP thirty' },
      ]);
      let s = await summary();
      const lines = await orderLines();
      expect(s.subtotal ?? NaN).toBeCloseTo(r2(lines.reduce((a, l) => a + l.price, 0)), 2);
      expect(s.subtotal ?? 0).toBeGreaterThanOrEqual(50 - 0.001);
      expect(s.itemDiscount).toBeNull();
      expect(s.promotion).toBeNull();
      expect(s.rewardRedemption).toBeNull();
      await expectIdentity();

      await openLine('QP thirty');
      await setDiscount('%', '10');
      await P.clickQ(qp(btn('Update', 0)));
      await P.waitGoneQ(VqhDialog.quickPay, 10_000);
      s = await P.poll(summary, (x) => x.itemDiscount !== null, 10_000);
      expect(s.itemDiscount ?? NaN).toBeCloseTo(-3, 2);
      await expectIdentity();
    },
  );

  it(
    title(
      'Three $10.01 Quick Pay lines: no cent lost — Subtotal = Σ lines (HOME-132)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await quickPayOrder(
        A(),
        ['a', 'b', 'c'].map((x) => ({ cents: 1001, name: `QP cent ${x}` })),
      );
      const lines = await orderLines();
      expect(lines).toHaveLength(3);
      const first = lines[0]?.price ?? NaN;
      for (const l of lines) expect(l.price).toBeCloseTo(first, 2);
      expect(first).toBeGreaterThanOrEqual(10.01 - 0.001);
      expect((await summary()).subtotal ?? NaN).toBeCloseTo(r2(first * 3), 2);
      await expectIdentity();
    },
  );

  it(
    title(
      'Zero rows are hidden; Tax shows only when > 0 and Total adds it; Home Total = the Card amount at checkout (HOME-133, HOME-134, HOME-135)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      const s = await summary();
      expect(s.itemDiscount).toBeNull();
      expect(s.promotion).toBeNull();
      expect(s.rewardRedemption).toBeNull();
      const text = await P.pageText();
      expect(text).not.toMatch(/\| Tax \| \$0\.00/);
      if (s.tax !== null) {
        expect(s.tax).toBeGreaterThan(0);
        expect(s.total ?? NaN).toBeCloseTo((s.subtotal ?? 0) + s.tax, 2);
      } else {
        expect(s.total ?? NaN).toBeCloseTo(s.subtotal ?? NaN, 2);
      }
      await pressPay();
      expect(await tenderAmount('Card')).toBeCloseTo(s.total ?? NaN, 2);
      await backToHome(id);
    },
  );

  /* ---------------------------------------------------------------- V: large amounts */

  it(
    title(
      'Two $10,000.00 Quick Pay lines: the order takes a > $10,000 Total with no warning popup (HOME-143)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await quickPayOrder(A(), [
        { cents: 1000000, name: 'QP max a' },
        { cents: 1000000, name: 'QP max b' },
      ]);
      expect((await summary()).total ?? 0).toBeGreaterThanOrEqual(20_000 - 0.01);
      expect(await P.pageText('body')).not.toMatch(/unusually high/i);
    },
  );

  it(
    title(
      'Line price $1,500.00 / $10,000.00 / $9,999.99 save exactly, no "Max Price Per Service" popup (HOME-144, HOME-145)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(A(), [S1()]);
      const amount = async (): Promise<string> => {
        await openLine(S1());
        const v = await P.inputValue([VqhDialog.editor, { css: 'input', placeholder: '0.00', nth: 0 }]);
        await P.clickQ([VqhDialog.editor, btn('Close', 0)]);
        await P.waitGoneQ(VqhDialog.editor, 5_000);
        return v;
      };
      await editItem(S1(), { cents: '150000' });
      expect(await P.pageText('body')).not.toMatch(/unusually high|Max Price Per Service/i);
      expect(await amount()).toBe('$1,500.00');
      await editItem(S1(), { cents: '1000000' });
      expect(await amount()).toBe('$10,000.00');
      const t1 = (await summary()).total ?? NaN;
      await editItem(S1(), { cents: '999999' });
      expect(await amount()).toBe('$9,999.99');
      const t2 = (await summary()).total ?? NaN;
      expect(t1).toBeGreaterThan(t2);
      expect(fmt(t2)).toMatch(/\.\d{2}$/);
    },
  );

  /* ---------------------------------------------------------------- shortcuts */

  it(
    title(
      'Keyboard shortcuts F1 / F2 / F8 / Ctrl+N do nothing on Home yet (HOME-047)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      const before = { path: await P.path(), lines: (await orderLines()).length };
      for (const k of ['F1', 'F2', 'F8']) {
        await P.press(k);
        await settle(500);
      }
      await P.press('Control', 'n');
      await P.press('Control');
      await settle(500);
      expect(await P.path()).toBe(before.path);
      expect(await currentOrderId()).toBe(id);
      expect((await orderLines()).length).toBe(before.lines);
      expect(await P.count({ css: '[role="dialog"]' })).toBe(0);
    },
  );

  /* ---------------------------------------------------------------- re-open mode */

  it(
    title(
      'Re-open a paid order → Edit Order: the Pending sidebar is hidden on Home (HOME-015)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await createOrder(A(), [S1()]);
      const uuid = await payCurrentInCash();
      await openOrderDetail(uuid);
      await reopenOrder(uuid);
      try {
        // Build 1.1.56 locks Edit Order on some checkout types (VP-4591).
        if (!(await checkoutPage.isEditOrderLinkShown())) this.skip();
        await goToReopenEditor();
        await settle(1_000);
        expect(await P.count(VqhSidebar.root)).toBe(0);
        expect(await P.count(VqhOrder.split)).toBe(0);
      } finally {
        await leaveReopenCheckout(uuid).catch(() => undefined);
        await returnToHome().catch(() => undefined);
      }
    },
  );

  /* Quick Pay on an order with a $0 base is also covered by home-quick-pay.spec.ts. */
  it(
    title(
      'Quick Pay line + service line on one order: Pay opens checkout with the Home Total (HOME-137)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      await quickPay({ cents: 1500, name: 'QP mix' });
      const total = (await summary()).total ?? NaN;
      await pressPay();
      expect(await enteredAmount()).toBeCloseTo(total, 2);
      await backToHome(id);
      await deleteCurrentOrder();
    },
  );
});
