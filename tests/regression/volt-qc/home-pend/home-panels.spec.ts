/**
 * volt-qc port — 02 HOME: Merge, Pending sidebar, staff picking, staff search/sort,
 * Order Note and header Search (WRITE cases).
 *
 * Source: volt-qc `e2e/tests/02-home/home-plan-panels.spec.ts` (HOME-S1, S2, H1…H3,
 * J1, J2, I2, TURN1, R1, R2, X2, X3). TC catalogue:
 * docs/qc/volt-qc/windows-regression/02-home-tao-order.md.
 *
 * Adaptations vs the source:
 * - Staff / services are discovered at runtime; two-staff cases skip on a till with one.
 * - HOME-X2 settles in Cash (this suite's proven tender) instead of "Other".
 * - Customer-display halves (Welcome screen) are not driven.
 */

import { expect } from '@wdio/globals';
import { VqcGlobalSearch, VqcHome, btn } from '../../../../src/constants/testids.voltqc-pos.js';
import {
  VqhDialog,
  VqhOrder,
  VqhSidebar,
  inDlg,
} from '../../../../src/constants/testids.voltqc-home-pend.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { orderHistoryDetailPage } from '../../../../src/pages/index.js';
import {
  addService,
  attachNewCustomer,
  backToHome,
  cleanupOrders,
  closeCustomerDialog,
  closeStrayDialogs,
  createOrder,
  created,
  currentOrderId,
  discover,
  orderLines,
  orderStaffNames,
  payCurrentInCash,
  pickStaff,
  pressPay,
  quickPayOrder,
  randomPhone,
  restoreGrant,
  sidebarBadge,
  sidebarCardText,
  sidebarHas,
  summary,
  uniqueName,
  waitOrderId,
} from '../../../../src/pages/voltqc/home-pend/homePendProbe.js';
import {
  closeGlobalSearch,
  globalSearchBox,
  globalSearchTab,
  openGlobalSearch,
  openStaffSort,
  quickCheckout,
  visibleStaffNames,
} from '../../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { passcodeDialog } from '../../../../src/components/index.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { Tag, title } from '../../../../src/types/testTags.js';

let staff: string[] = [];
let svc: string[] = [];
const A = (): string => staff[0] ?? '';
const B = (): string => staff[1] ?? '';
const S1 = (): string => svc[0] ?? '';
const S2 = (): string => svc[1] ?? svc[0] ?? '';

const mmddyyyy = (d: Date): string =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear())}`;

/** Search-input clear (x) button of the staff search. */
const staffSearchClear = {
  css: 'main [data-slot="input-group"]:has(input[placeholder="Search staff"]) button',
  nth: 0,
} as const;

describe('volt-qc 02 HOME — panels (write)', () => {
  before(async () => {
    await returnToHome();
    const d = await discover();
    staff = d.staff;
    svc = d.services.map((s) => s.name);
  });

  beforeEach(function () {
    if (staff.length === 0 || svc.length === 0) this.skip();
  });

  afterEach(async () => {
    await closeGlobalSearch().catch(() => undefined);
    for (let i = 0; i < 2; i += 1) await closeCustomerDialog().catch(() => undefined);
    await closeStrayDialogs().catch(() => undefined);
    await restoreGrant();
    await P.fillQ(VqhSidebar.search, '').catch(() => undefined);
    await cleanupOrders();
  });

  /* ---------------------------------------------------------------- S: merge */

  it(
    title(
      'Merge Order: hidden on an empty order, shown once it has an item, hidden after a Custom Discount (HOME-125)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(A());
      expect(await P.count(VqhOrder.mergeOrder)).toBe(0);
      await addService(S1());
      expect(await P.has(VqhOrder.mergeOrder)).toBe(true);
      await P.clickQ(VqhOrder.promo);
      const dlg = { css: '[role="dialog"]', hasText: 'Promo & Rewards', nth: -1 } as const;
      await P.waitFor(dlg, 8_000, 'Promo & Rewards');
      if ((await P.attrOf([dlg, { role: 'checkbox', nth: 0 }], 'aria-checked')) !== 'true')
        await P.clickQ([dlg, { role: 'checkbox', nth: 0 }]);
      await P.clickQ([dlg, { role: 'tab', name: 'Percentage %' }]);
      await P.fillQ([dlg, { role: 'textbox', nth: 0 }], '10');
      await P.clickQ([dlg, btn('Apply', 0)]);
      await passcodeDialog.unlockForRun(env.STAFF_PASSCODE, { timeout: 2_000 });
      await P.waitGoneQ(dlg, 8_000);
      // Known dev bug #11: Merge Order still shows after a Custom Discount.
      expect(
        await P.poll(
          () => P.count(VqhOrder.mergeOrder),
          (n) => n === 0,
          5_000,
        ),
      ).toBe(0);
    },
  );

  it(
    title(
      'Merge dialog: lists B (not A), Merge disabled until picked; No keeps both; Merge folds B into A (HOME-126, HOME-127, HOME-128)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const b = await quickPayOrder(A(), [{ cents: 4500, name: 'QP merge B' }]);
      const a = await createOrder(A(), [S1()]);
      const totalA = (await summary()).total ?? NaN;
      await P.clickQ(VqhOrder.mergeOrder);
      await P.waitFor(VqhDialog.merge, 8_000, 'Merge Order dialog');
      const box = inDlg(VqhDialog.merge, {
        css: 'input',
        placeholder: 'Search order ID, customer name or phone',
      });
      const mergeBtn = inDlg(VqhDialog.merge, btn('Merge', 0));
      expect(await P.isDisabled(mergeBtn)).toBe(true);
      await P.fillQ(box, a);
      await settle(800);
      expect(await P.count(inDlg(VqhDialog.merge, { role: 'button', nameRe: `^${a}` }))).toBe(0);
      await P.fillQ(box, b);
      const cardB = inDlg(VqhDialog.merge, { role: 'button', nameRe: `^${b}`, nth: 0 });
      await P.waitFor(cardB, 15_000, 'order B in the merge list');
      expect(await P.isDisabled(mergeBtn)).toBe(true);
      await P.clickQ(cardB);
      expect(await P.isDisabled(mergeBtn)).toBe(false);

      await step('HOME-128 Merge → No: B kept, A unchanged', async () => {
        await P.clickQ(mergeBtn);
        await P.waitFor(VqhDialog.mergeConfirm, 5_000, 'Merge Orders confirm');
        expect(await P.has([VqhDialog.mergeConfirm, { textRe: 'This action cannot be reverted\\.' }])).toBe(
          true,
        );
        await P.clickQ(inDlg(VqhDialog.mergeConfirm, btn('No', 0)));
        await P.waitGoneQ(VqhDialog.mergeConfirm, 5_000);
        expect((await orderLines()).some((l) => l.name === 'QP merge B')).toBe(false);
      });

      await step('HOME-127 Merge → Merge: A holds both lines, B leaves the sidebar', async () => {
        if (!(await P.has(VqhDialog.merge))) {
          await P.clickQ(VqhOrder.mergeOrder);
          await P.fillQ(box, b);
          await P.clickQ(cardB, 15_000);
        }
        await P.clickQ(mergeBtn);
        await P.clickQ(inDlg(VqhDialog.mergeConfirm, btn('Merge', 0)));
        await P.waitGoneQ(VqhDialog.mergeConfirm, 8_000);
        await P.waitGoneQ(VqhDialog.merge, 15_000);
        const names = (await P.poll(orderLines, (l) => l.some((x) => x.name === 'QP merge B'), 15_000)).map(
          (l) => l.name,
        );
        expect(names).toContain('QP merge B');
        expect(names).toContain(S1());
        expect((await summary()).total ?? 0).toBeGreaterThan(totalA);
        created.delete(b);
        expect(await sidebarHas(b, 3_000)).toBe(false);
        await P.fillQ(VqhSidebar.search, '');
      });
    },
  );

  /* ---------------------------------------------------------------- H: sidebar */

  it(
    title(
      'Sidebar header: "Pending Orders" + badge, today MM/DD/YYYY, Quick Checkout, search; badge follows the filter (HOME-006)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      expect(await P.has(VqhSidebar.title)).toBe(true);
      expect(await P.has([VqhSidebar.root, { text: mmddyyyy(new Date()) }])).toBe(true);
      expect(await P.has(VqhSidebar.quickCheckout)).toBe(true);
      expect(await P.has(VqhSidebar.search)).toBe(true);
      expect(await sidebarBadge()).toBeGreaterThanOrEqual((await P.texts(VqhSidebar.cards)).length);
      await P.fillQ(VqhSidebar.search, id);
      expect(await P.poll(sidebarBadge, (n) => n === 1, 10_000)).toBe(1);
      expect(await P.count(VqhSidebar.cards)).toBe(1);
    },
  );

  it(
    title(
      'Sidebar search by order code, customer name, last 4 phone digits, "ORDER:<code>"; junk → 0 cards, badge 0 (HOME-008, HOME-009)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      const phone = randomPhone();
      const name = uniqueName('QC Find');
      await attachNewCustomer(phone, name);
      for (const term of [id, name.toLowerCase(), phone.slice(-4), `ORDER:${id}`]) {
        await P.fillQ(VqhSidebar.search, term);
        expect(
          await P.poll(
            () => P.has(VqhSidebar.card(id)),
            (v) => v,
            15_000,
          ),
        ).toBe(true);
        expect(await sidebarBadge()).toBeGreaterThanOrEqual(1);
      }
      await P.fillQ(VqhSidebar.search, 'zzzz-khongco');
      expect(
        await P.poll(
          () => P.count(VqhSidebar.cards),
          (n) => n === 0,
          8_000,
        ),
      ).toBe(0);
      expect(await P.poll(sidebarBadge, (n) => n === 0, 8_000)).toBe(0);
    },
  );

  it(
    title(
      'Open order A → sidebar Quick Checkout: customer entry screen, no new order, A still in the sidebar (HOME-011, PEND-036)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      await P.fillQ(VqhSidebar.search, '');
      const before = await sidebarBadge();
      await P.clickQ(VqhSidebar.quickCheckout);
      await P.waitFor(VqcHome.customerInput, 10_000, 'customer input');
      expect(await P.has(VqcHome.checkinToday)).toBe(true);
      expect(await currentOrderId()).toBe('');
      expect(await sidebarBadge()).toBe(before);
      expect(await sidebarHas(id, 15_000)).toBe(true);
      const cls = (await P.attrOf(VqhSidebar.card(id), 'class')) ?? '';
      expect(cls).not.toMatch(/(^|\s)border-2(\s|$)/);
    },
  );

  /* ---------------------------------------------------------------- J: staff picking */

  it(
    title(
      "Two-staff order: card names staff B; B then A + service lands in A's group, no duplicate group, still one card (HOME-032, HOME-034)",
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (staff.length < 2) this.skip();
      const id = await createOrder(A(), [S1()]);
      await pickStaff(B());
      await addService(S2());
      expect(await P.poll(orderStaffNames, (n) => n.length === 2, 10_000)).toEqual([A(), B()]);
      expect(await sidebarHas(id, 15_000)).toBe(true);
      expect(
        await P.poll(
          () => sidebarCardText(id),
          (t) => t.includes(B()),
          15_000,
        ),
      ).toContain(B());

      await pickStaff(B());
      await pickStaff(A());
      await addService(S1());
      expect(await orderStaffNames()).toEqual([A(), B()]);
      expect(await P.count([{ css: VqhOrder.groupCss, hasText: A(), nth: 0 }, { css: 'div.pr-11' }])).toBe(2);
      await P.fillQ(VqhSidebar.search, id);
      expect(await P.count(VqhSidebar.cards)).toBe(1);
    },
  );

  it(
    title(
      'Staff then service clicked back-to-back: exactly one order holds the line, no error toast (HOME-033)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await quickCheckout();
      await P.jsClickQ(VqhOrder.staffTile(A()));
      await P.clickQ(VqhOrder.serviceTile(S1()));
      const id = await waitOrderId();
      created.add(id);
      expect(
        await P.poll(
          async () => (await orderLines()).length,
          (n) => n === 1,
          10_000,
        ),
      ).toBe(1);
      expect(await P.count(VqhOrder.errorToast)).toBe(0);
      await P.fillQ(VqhSidebar.search, id);
      expect(
        await P.poll(
          () => P.count(VqhSidebar.cards),
          (n) => n === 1,
          15_000,
        ),
      ).toBe(1);
    },
  );

  it(
    title(
      'Staff search is case-insensitive with an x; junk empties the grid; x restores it; picking after a search opens an order (HOME-019, HOME-020, HOME-021)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await quickCheckout();
      const before = await visibleStaffNames();
      await P.fillQ(VqcHome.staffSearch, A().toLowerCase());
      expect(await P.poll(visibleStaffNames, (n) => n.includes(A()), 8_000)).toContain(A());
      expect(await P.has(staffSearchClear)).toBe(true);
      for (const k of ['VOLT_TEST_STAFF_FIRST_NAME', 'VOLT_TEST_STAFF_LAST_NAME']) {
        const v = (process.env[k] ?? '').trim();
        if (!v) continue;
        await P.fillQ(VqcHome.staffSearch, v);
        expect(await P.poll(visibleStaffNames, (n) => n.length > 0, 8_000)).not.toEqual([]);
      }
      await P.fillQ(VqcHome.staffSearch, 'zzqq');
      expect(await P.poll(visibleStaffNames, (n) => n.length === 0, 8_000)).toEqual([]);
      expect(await P.count(VqhOrder.errorToast)).toBe(0);
      await P.clickQ(staffSearchClear);
      expect(await P.inputValue(VqcHome.staffSearch)).toBe('');
      expect(await P.poll(visibleStaffNames, (n) => n.length >= before.length, 8_000)).toEqual(
        expect.arrayContaining(before.slice(0, 2)),
      );

      await P.fillQ(VqcHome.staffSearch, A());
      await settle(500);
      await P.jsClickQ(VqhOrder.staffTile(A()));
      const id = await waitOrderId();
      created.add(id);
      expect(id).toMatch(/^OD\d{6}-\d+$/);
      expect(await P.has([{ css: VqhOrder.groupCss, hasText: 'Choose service', nth: 0 }])).toBe(true);
      await P.fillQ(VqcHome.staffSearch, '');
    },
  );

  it(
    title(
      'Sort "Staff Checked In": a staff who clocked in (Time Keeping) sorts above one who did not (HOME-025)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (staff.length < 2) this.skip();
      this.timeout(4 * 60_000);
      const tk = VqhDialog.timeKeeping;
      const card = (name: string) => [tk, { css: 'div[class*="w-[220px]"]', hasText: name, nth: 0 }] as const;
      const open = async (): Promise<void> => {
        await returnToHome();
        await P.routerGo('/home', { dialog: 'time-keeping' });
        await passcodeDialog.unlockForRun(env.STAFF_PASSCODE, { timeout: 2_000 });
        await P.waitFor(tk, 10_000, 'Time Keeping dialog');
      };
      const status = async (name: string): Promise<'in' | 'out' | 'none'> => {
        await P.fillQ([tk, { css: 'input', placeholder: 'Search staff' }], name);
        await P.waitFor(card(name), 10_000, `time-keeping card ${name}`);
        const t = await P.textOf(card(name));
        return /\bIN\b/i.test(t) ? 'in' : /\bOUT\b/i.test(t) ? 'out' : 'none';
      };
      const act = async (name: string, action: 'Check In' | 'Check Out'): Promise<void> => {
        await P.clickQ(card(name));
        await P.clickQ([tk, btn(action, 0)]);
        await P.waitFor(
          { textRe: action === 'Check In' ? 'Check in successfully' : 'Check out successfully', nth: 0 },
          10_000,
        );
      };

      await open();
      // Needs staff B NOT clocked in (someone else may have done it).
      if ((await status(B())) === 'in') this.skip();
      let checkedInHere = false;
      try {
        if ((await status(A())) !== 'in') {
          await act(A(), 'Check In');
          checkedInHere = true;
        }
        await closeStrayDialogs();
        await quickCheckout();
        await openStaffSort();
        const pop = VqcHome.sortPopover;
        await P.clickQ([pop, { text: 'Staff Checked In' }]);
        if (await P.has([pop, { text: 'Ascending' }])) await P.clickQ([pop, { text: 'Ascending' }]);
        await P.escape();
        await settle(1_000);
        const names = await visibleStaffNames();
        expect(names).toContain(A());
        const iB = names.indexOf(B());
        if (iB >= 0) expect(names.indexOf(A())).toBeLessThan(iB);
        await P.fillQ(VqcHome.staffSearch, B());
        expect(await P.poll(visibleStaffNames, (n) => n.includes(B()), 8_000)).toContain(B());
        await P.fillQ(VqcHome.staffSearch, '');
      } finally {
        await openStaffSort().catch(() => undefined);
        await P.clickQ([VqcHome.sortPopover, { text: 'Default Order' }]).catch(() => undefined);
        await P.escape().catch(() => undefined);
        if (checkedInHere) {
          await open().catch(() => undefined);
          await status(A()).catch(() => undefined);
          await act(A(), 'Check Out').catch(() => undefined);
          await closeStrayDialogs().catch(() => undefined);
        }
      }
    },
  );

  /* ---------------------------------------------------------------- R: order note */

  it(
    title(
      'Order Note dialog (Save disabled), max 80 chars; save shows "Order Note:" + x; x clears it (HOME-119, HOME-120, HOME-121, HOME-122)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(A(), [S1()]);
      await P.clickQ(VqhOrder.note);
      await P.waitFor(VqhDialog.orderNote, 8_000, 'Order Note');
      const ta = inDlg(VqhDialog.orderNote, { css: 'textarea,input', placeholder: 'Order note' });
      expect(await P.has(ta)).toBe(true);
      expect(await P.isDisabled(inDlg(VqhDialog.orderNote, btn('Save', 0)))).toBe(true);
      await P.fillQ(ta, 'k'.repeat(81));
      expect(await P.inputValue(ta)).toBe('k'.repeat(80));
      await P.fillQ(ta, 'Khach di ung acetone');
      await P.clickQ(inDlg(VqhDialog.orderNote, btn('Save', 0)));
      await P.waitGoneQ(VqhDialog.orderNote, 8_000);

      await P.waitFor(VqhOrder.orderNoteLabel, 8_000, '"Order Note:"');
      expect(await P.pageText()).toContain('Khach di ung acetone');
      const cleared = await P.exec<boolean>(`
        var s = Array.prototype.find.call(document.querySelectorAll('main strong'), function (e) { return /Order Note:/.test(e.textContent || ''); });
        var row = s && s.parentElement && s.parentElement.parentElement;
        var xs = row ? row.querySelectorAll('span.cursor-pointer') : [];
        var x = xs[xs.length - 1];
        if (!x) return false;
        x.setAttribute('data-vqh-note-x', '1');
        return true;
      `);
      expect(cleared).toBe(true);
      await P.clickQ({ css: '[data-vqh-note-x="1"]' });
      expect(
        await P.poll(
          () => P.count(VqhOrder.orderNoteLabel),
          (n) => n === 0,
          10_000,
        ),
      ).toBe(0);
      await P.clickQ(VqhOrder.note);
      await P.waitFor(VqhDialog.orderNote, 8_000);
      expect(await P.inputValue(ta)).toBe('');
      await P.clickQ(inDlg(VqhDialog.orderNote, btn('Close', 0)));
    },
  );

  it(
    title(
      'Note "A" → edit to "B" then close X: still "A"; Pay → checkout shows "Order Note: A" (HOME-123, HOME-124)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      const ta = inDlg(VqhDialog.orderNote, { css: 'textarea,input', placeholder: 'Order note' });
      await P.clickQ(VqhOrder.note);
      await P.fillQ(ta, 'Note A e2e');
      await P.clickQ(inDlg(VqhDialog.orderNote, btn('Save', 0)));
      await P.waitGoneQ(VqhDialog.orderNote, 8_000);
      await P.clickQ(VqhOrder.note);
      await P.fillQ(ta, 'Note B e2e');
      await P.clickQ(inDlg(VqhDialog.orderNote, btn('Close', 0)));
      await P.waitGoneQ(VqhDialog.orderNote, 8_000);
      const t = await P.pageText();
      expect(t).toContain('Note A e2e');
      expect(t).not.toContain('Note B e2e');
      await pressPay();
      expect(
        await P.poll(
          () => P.pageText(),
          (x) => x.includes('Order Note: Note A e2e'),
          10_000,
        ),
      ).toContain('Order Note: Note A e2e');
      await backToHome(id);
    },
  );

  /* ---------------------------------------------------------------- X: header search */

  it(
    title(
      'Header Search for a customer with a paid order: tab counts, per-tab rows, highlight; open the customer; open the order in Order History (HOME-156, HOME-157, HOME-158)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const phone = randomPhone();
      const name = uniqueName('QC Srch');
      const id = await createOrder(A(), [S1()]);
      await attachNewCustomer(phone, name);
      await payCurrentInCash();

      const dlg = VqcGlobalSearch.dialog;
      const rows = [dlg, { css: VqcGlobalSearch.resultCss }] as const;
      await openGlobalSearch();
      await P.fillQ(globalSearchBox, phone);
      expect(
        await P.poll(
          () => P.textOf(globalSearchTab('^Customer')),
          (t) => /\(1\)/.test(t),
          20_000,
        ),
      ).toMatch(/Customer \(1\)/);
      expect(
        await P.poll(
          () => P.textOf(globalSearchTab('^Order')),
          (t) => /\(1\)/.test(t),
          20_000,
        ),
      ).toMatch(/Order \(1\)/);
      await P.clickQ(globalSearchTab('^Customer'));
      expect(await P.count(rows)).toBe(1);
      expect(await P.textOf(rows)).toContain(name);
      await P.clickQ(globalSearchTab('^Order'));
      expect(await P.count(rows)).toBe(1);
      expect(await P.textOf(rows)).toContain(`#${id}`);

      await step('the matched text is highlighted (search by name)', async () => {
        await P.fillQ(globalSearchBox, name);
        await P.clickQ(globalSearchTab('^All'));
        await P.waitFor([dlg, { css: 'mark', nth: 0 }], 15_000, '<mark>');
        expect((await P.textOf([dlg, { css: 'mark', nth: 0 }])).toLowerCase()).toContain(
          name.toLowerCase().split(' ')[0] ?? '',
        );
      });

      await step('HOME-157 a customer row opens Customer Information over the modal', async () => {
        await P.clickQ(globalSearchTab('^Customer'));
        await P.clickQ([dlg, { css: VqcGlobalSearch.resultCss, nth: 0 }]);
        await P.waitFor(VqhDialog.customerInfo, 8_000, 'Customer Information');
        await closeCustomerDialog();
        expect(await P.has(dlg)).toBe(true);
      });

      await step('HOME-158 order code → Order tab → row opens /order-history/<id>', async () => {
        await P.fillQ(globalSearchBox, id);
        await P.clickQ(globalSearchTab('^Order'));
        expect(
          await P.poll(
            () => P.textOf(rows),
            (t) => t.includes(`#${id}`),
            15_000,
          ),
        ).toContain(`#${id}`);
        await P.clickQ(rows);
        await passcodeDialog.unlockForRun(env.STAFF_PASSCODE, { timeout: 3_000 });
        expect(
          await P.poll(
            () => P.path(),
            (p) => /^\/order-history\/[^/?]+/.test(p),
            15_000,
          ),
        ).toMatch(/^\/order-history\//);
        expect(
          await P.poll(
            () => P.pageText(),
            (t) => t.includes(`Order #${id}`),
            15_000,
          ),
        ).toContain(`Order #${id}`);
        expect(await orderHistoryDetailPage.isActive().catch(() => true)).toBe(true);
      });
      await returnToHome();
    },
  );

  it(
    title('A pending order is not in the header Search "Order" tab (HOME-159)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      const id = await createOrder(A(), [S1()]);
      await openGlobalSearch();
      await P.fillQ(globalSearchBox, id);
      await P.clickQ(globalSearchTab('^Order'));
      await settle(3_000);
      expect(
        await P.count([VqcGlobalSearch.dialog, { css: VqcGlobalSearch.resultCss, hasText: `#${id}` }]),
      ).toBe(0);
      expect(await P.has([VqcGlobalSearch.dialog, { textRe: `No results found for "${id}"`, nth: 0 }])).toBe(
        true,
      );
      await closeGlobalSearch();
    },
  );

  it(
    title(
      'Staff group tabs: "All" first and selected by default; another tab narrows the grid (HOME-022)',
      Tag.REGRESSION,
    ),
    async function () {
      await quickCheckout();
      const tabs = { css: 'main [role="tab"]' } as const;
      const names = (await P.texts(tabs)).map((t) => t.trim()).filter(Boolean);
      // Needs staff groups configured on this merchant (otherwise no tab strip).
      if (names.length < 2) this.skip();
      expect(names[0]).toBe('All');
      expect(await P.attrOf({ ...tabs, nth: 0 }, 'aria-selected')).toBe('true');
      const all = await visibleStaffNames();
      try {
        await P.clickQ({ ...tabs, nth: 1 });
        await settle(800);
        const group = await visibleStaffNames();
        expect(group.length).toBeLessThanOrEqual(all.length);
        expect(await P.attrOf({ ...tabs, nth: 1 }, 'aria-selected')).toBe('true');
      } finally {
        await P.clickQ({ ...tabs, nth: 0 }).catch(() => undefined);
      }
    },
  );

  it(title('Staff cards show the nickname and an avatar / initial (HOME-028)', Tag.REGRESSION), async () => {
    await quickCheckout();
    const cards = await P.exec<{ name: string; hasAvatar: boolean }[]>(`
      return Array.prototype.map.call(document.querySelectorAll('main span.col-span-2.text-xl'), function (n) {
        var card = n.parentElement;
        return { name: (n.textContent || '').trim(), hasAvatar: !!(card && (card.querySelector('img, [data-slot="avatar"], .rounded-full'))) };
      });
    `);
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      expect(c.name).not.toBe('');
      expect(c.hasAvatar).toBe(true);
    }
  });
});
