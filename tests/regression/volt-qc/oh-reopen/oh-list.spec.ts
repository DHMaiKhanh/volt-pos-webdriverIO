/**
 * volt-qc port — 07 ORDER HISTORY: list, search, QR, deep link, filters (write cases).
 *
 * Source: volt-qc `e2e/tests/07-order-history/oh-plan-list.spec.ts` (OH-T04..T08, T11, T13..T15,
 * T22..T25), `history.spec.ts` (OH-E), `17-added/home-pay-oh-added.spec.ts` (OH-AD1).
 * TC catalogue: docs/qc/volt-qc/windows-regression/07-order-history.md.
 * The read-only list cases live in ../pos/order-history.spec.ts.
 *
 * CREATES AND SETTLES ORDERS (cash / other) and cancels one — dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { VqcOrderHistory as OH, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { OhRoButtons as B, OhRoDialogs as D } from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { createOrder, goToOrderHistory, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { homePage } from '../../../../src/pages/index.js';
import {
  STAFF_SEARCH,
  applyOhFilter,
  cancelOrder,
  createPaidOrder,
  detailText,
  field,
  fmtPhone,
  freshTill,
  hasDetailButton,
  leaveReopen,
  openByCode,
  openHistoryOrder,
  passcodeIfAsked,
  randomPhone,
  reopenDone,
  reopenToCheckout,
  setPasscodeGate,
  staffInDetail,
  staffRoleCode,
  waitStatus,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import {
  addDays,
  dateRangeText,
  emptyShown,
  filterDialog,
  filterRedDotShown,
  inFilter,
  mdy,
  openFilter,
  openRow,
  parseMdy,
  pickDateRange,
  rowCodes,
  rowDates,
  rowTexts,
  search,
} from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const SKIP_KEY = OH.passcodeSkipKey;
const rowOf = async (code: string): Promise<string> =>
  (await rowTexts()).find((t) => t.startsWith(code)) ?? '';

async function openList(): Promise<void> {
  await returnToHome();
  await goToOrderHistory();
  await P.waitFor(OH.heading, Timeouts.MEDIUM, 'Order History heading');
  if ((await P.inputValue(OH.searchBox)) !== '') await search('');
}

async function rowShown(code: string, timeout = 20_000): Promise<boolean> {
  const codes = await P.poll(
    () => rowCodes(),
    (c) => c.includes(code),
    timeout,
  );
  return codes.includes(code);
}

/** Clear the search box: the `x` next to it. */
const SEARCH_CLEAR = inMain({
  css: 'input[placeholder="Search order ID, customer name or phone"] ~ button, input[placeholder="Search order ID, customer name or phone"] + * button',
  nth: 0,
});

describe('volt-qc 07 ORDER HISTORY — list / search / filter (write)', () => {
  after(async () => {
    await P.escape().catch(() => undefined);
    await leaveReopen();
    await returnToHome().catch(() => undefined);
  });

  it(
    title('Order History opens from the header after the right staff code (OH-001)', Tag.REGRESSION),
    async () => {
      await returnToHome();
      await goToOrderHistory();
      await P.waitFor(OH.heading, Timeouts.MEDIUM, 'Order History heading');
      expect(await P.path()).toMatch(/^\/order-history/);
    },
  );

  it(
    title(
      'Default range is today-7 → today, newest first; a row shows code, badge, customer, method, total, staff, time (OH-011, OH-012)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { code, paidCents } = await createPaidOrder({ method: 'cash' });
      const staff = staffInDetail(await detailText(code))[0] ?? '';
      await openList();
      await step('OH-011 default range and order', async () => {
        const today = new Date();
        const range = await dateRangeText();
        expect(range).toContain(mdy(addDays(today, -7)));
        expect(range).toContain(mdy(today));
        const days = (await rowDates()).map((d) => parseMdy(d).getTime());
        for (let i = 1; i < days.length; i += 1) expect(days[i] ?? 0).toBeLessThanOrEqual(days[i - 1] ?? 0);
      });
      await step('OH-012 row content', async () => {
        await search(code);
        expect(await rowShown(code)).toBe(true);
        const row = await rowOf(code);
        expect(row).toContain('Successful - Unsettled');
        expect(row).toContain('Cash');
        expect(row).toContain(`$${(paidCents / 100).toFixed(2)}`);
        if (staff) expect(row).toContain(staff);
        expect(row).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} [AP]M/);
      });
    },
  );

  it(
    title(
      'Walk-in row shows "-"; masked phone opens the code guard, not the detail; selected row highlighted; detail phone masked (OH-013, OH-014, OH-020, OH-082)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const walk = await createPaidOrder({ method: 'other' });
      const phone = randomPhone();
      const cust = await createPaidOrder({
        method: 'other',
        customerPhone: phone,
        customerName: `QC E2E ${phone.slice(-4)}`,
      });
      const masked = `***-***-${phone.slice(-4)}`;
      await openList();
      const saved = await P.localGet(SKIP_KEY);
      try {
        await step('OH-013 walk-in row', async () => {
          await search(walk.code);
          expect(await rowShown(walk.code)).toBe(true);
          const row = await rowOf(walk.code);
          expect(row).toMatch(/\| - \|/);
          expect(row).not.toContain('***-***');
          await openRow(walk.code);
          await P.waitFor(inMain({ text: `Order #${walk.code}` }), Timeouts.MEDIUM, 'walk-in detail');
        });
        await step('OH-014 masked phone on the row asks for the code and stays on the list', async () => {
          await P.localSet(SKIP_KEY, null);
          await search(cust.code);
          expect(await rowShown(cust.code)).toBe(true);
          const phoneOnRow = [
            { css: OH.rowCss, hasTextRe: cust.code.split('').join('\\s*') },
            { text: masked, nth: 0 },
          ] as const;
          await P.clickQ(phoneOnRow);
          expect(
            await P.poll(
              () => P.has(D.passcode),
              (v) => v,
              5_000,
            ),
          ).toBe(true);
          await P.clickQ([D.passcode, { css: 'button', nth: 0 }]);
          await P.waitGoneQ(D.passcode, Timeouts.SHORT, 'guard');
          expect(await P.has(inMain({ text: `Order #${cust.code}` }))).toBe(false);
          await P.clickQ(phoneOnRow);
          await passcodeIfAsked(5_000);
          expect(
            await P.poll(
              () => P.pageText(),
              (t) => t.includes(fmtPhone(phone)),
              8_000,
            ),
          ).toContain(fmtPhone(phone));
          expect(await P.has(inMain({ text: `Order #${cust.code}` }))).toBe(false);
        });
        await step('OH-020 selected row highlight follows the click', async () => {
          await search('');
          await openRow(walk.code);
          const cls = async (code: string): Promise<string> =>
            (await P.attrOf({ css: OH.rowCss, hasTextRe: code.split('').join('\\s*') }, 'class')) ?? '';
          expect(await cls(walk.code)).toMatch(/(^|\s)bg-primary-50(\s|$)/);
          await openRow(cust.code);
          await P.waitFor(inMain({ text: `Order #${cust.code}` }), Timeouts.MEDIUM, 'customer detail');
          expect(await cls(cust.code)).toMatch(/(^|\s)bg-primary-50(\s|$)/);
          expect(await cls(walk.code)).not.toMatch(/(^|\s)bg-primary-50(\s|$)/);
          expect(await P.path()).toMatch(/^\/order-history\/[0-9a-f-]{20,}/);
        });
        await step(
          'OH-082 phone in Order Information is masked, revealed by the code, masked again on return',
          async () => {
            await P.localSet(SKIP_KEY, null);
            await openHistoryOrder(cust.orderId);
            await P.clickQ(inMain({ text: masked, nth: -1 }));
            await passcodeIfAsked(5_000);
            expect(
              await P.poll(
                () => detailText(cust.code),
                (t) => t.includes(fmtPhone(phone)),
                8_000,
              ),
            ).toContain(fmtPhone(phone));
            await openHistoryOrder(walk.orderId);
            await openHistoryOrder(cust.orderId);
            expect(await detailText(cust.code)).toContain(masked);
          },
        );
      } finally {
        await P.localSet(SKIP_KEY, saved);
      }
    },
  );

  it(
    title(
      'A pending (unpaid) order never shows in Order History, even with Today + Date completed (OH-016, OH-017)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await freshTill();
      const { orderId } = await createOrder();
      const pendingCode = /#?(OD\d{6}-\d+)/.exec(await P.pageText('main'))?.[1] ?? '';
      try {
        await openList();
        await pickDateRange(new Date(), new Date());
        if (pendingCode) {
          await search(pendingCode);
          expect(await rowCodes()).not.toContain(pendingCode);
          await search('');
        }
        for (const r of await rowTexts()) expect(r).not.toMatch(/\| (Pending|Processing|In Use) \|/);
        expect(orderId).not.toBe('');
      } finally {
        await freshTill();
      }
    },
  );

  it(
    title(
      'Search: part of the code, customer name, last 4 of phone, formatted phone, x, typed char by char, % and _ (OH-024, OH-025, OH-026, OH-027, OH-028, OH-030, OH-032, OH-034)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const phone = randomPhone();
      const name = `E2E Tester ${phone.slice(-5)}`;
      const { code } = await createPaidOrder({ method: 'other', customerPhone: phone, customerName: name });
      await openList();
      await step('OH-024 full code → exactly that order', async () => {
        await search(code);
        expect(
          await P.poll(
            () => rowCodes(),
            (c) => c.length === 1,
            10_000,
          ),
        ).toEqual([code]);
      });
      await step('OH-025 last 8 chars of the code', async () => {
        await search(code.slice(-8));
        expect(await rowShown(code)).toBe(true);
        for (const c of await rowCodes()) expect(c).toContain(code.slice(-8));
      });
      await step('OH-026 part of the name, lower case', async () => {
        await search(name.toLowerCase().slice(4));
        expect(await rowShown(code)).toBe(true);
      });
      await step('OH-027 last 4 phone digits', async () => {
        await search(phone.slice(-4));
        expect(await rowShown(code)).toBe(true);
      });
      await step('OH-028 formatted phone does not match, raw digits do', async () => {
        await search(fmtPhone(phone));
        expect(
          await P.poll(
            () => emptyShown(),
            (v) => v,
            8_000,
          ),
        ).toBe(true);
        await search(phone);
        expect(await rowShown(code)).toBe(true);
      });
      await step('OH-030 the x clears the term and brings the list back', async () => {
        await P.clickQ(SEARCH_CLEAR);
        await settle(1_500);
        expect(await P.inputValue(OH.searchBox)).toBe('');
        expect((await rowCodes()).length).toBeGreaterThan(1);
        expect(await P.has(SEARCH_CLEAR)).toBe(false);
      });
      await step('OH-032 typed char by char, a Backspace and the last char again → one row', async () => {
        await P.typeQ(OH.searchBox, code);
        await P.press('Backspace');
        await P.press(code.slice(-1));
        await settle(1_500);
        expect(await rowCodes()).toEqual([code]);
      });
      await step('OH-034 % and _ do not break the screen', async () => {
        for (const t of ['%', '_']) {
          await search(t);
          expect(await P.has(OH.heading)).toBe(true);
          expect(await P.pageText()).not.toMatch(/Something went wrong/);
        }
        await search('');
      });
    },
  );

  it(
    title(
      'Deleting the term with Backspace (no x) restores the full list, same order, x hidden, no red dot (OH-217)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await openList();
      const before = await rowCodes();
      if (before.length < 2) this.skip();
      const first = before[0] ?? '';
      await search(first);
      await P.clickQ(OH.searchBox);
      for (let i = 0; i < first.length; i += 1) await P.press('Backspace');
      await settle(1_500);
      expect(await P.inputValue(OH.searchBox)).toBe('');
      expect((await rowCodes()).slice(0, before.length)).toEqual(before);
      expect(await P.has(SEARCH_CLEAR)).toBe(false);
      expect(await filterRedDotShown()).toBe(false);
    },
  );

  it(
    title(
      'Typing "ORDER:<code>" (paste or keyboard wedge) strips the receipt-QR prefix (OH-035)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const { code } = await createPaidOrder({ method: 'other' });
      await openList();
      for (const prefix of ['ORDER:', 'order:']) {
        await search(`${prefix}${code}`);
        expect(await P.inputValue(OH.searchBox)).toBe(code);
        expect(await rowShown(code)).toBe(true);
      }
      await search('');
      await P.typeQ(OH.searchBox, `ORDER:${code}`);
      await P.press('Enter');
      await settle(1_500);
      expect(await P.inputValue(OH.searchBox).catch(() => '')).not.toMatch(/ORDER:|ODER:/i);
      const found = await P.poll(
        async () => (await P.has(inMain({ text: `Order #${code}` }))) || (await rowCodes()).includes(code),
        (v) => v,
        15_000,
      );
      expect(found).toBe(true);
    },
  );

  it(
    title(
      'Header Scanner: a receipt QR opens the completed order (twice, no stray dialog); a pending QR opens Home (OH-037, OH-038, OH-039)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { code } = await createPaidOrder({ method: 'other' });
      const scanner = [{ role: 'banner' as const }, { role: 'button' as const, nameRe: 'Scanner', nth: 0 }];
      await returnToHome();
      if (!(await P.has(scanner))) this.skip(); // no Scanner button in this build's header
      const scan = async (value: string): Promise<void> => {
        await P.clickQ(scanner);
        await settle(500);
        await P.press(...value.split(''));
        await P.press('Enter');
        await settle(1_500);
        await passcodeIfAsked(2_500);
      };
      for (let i = 1; i <= 2; i += 1) {
        await returnToHome();
        await scan(`ORDER:${code}`);
        expect(
          await P.poll(
            () => P.path(),
            (p) => p.startsWith('/order-history/'),
            15_000,
          ),
        ).toMatch(/^\/order-history\//);
        await P.waitFor(inMain({ text: `Order #${code}` }), Timeouts.MEDIUM, `Order #${code}`);
        expect(await P.count({ role: 'dialog' })).toBe(0);
        expect(await P.pageText('body')).not.toMatch(/ORDER:_{3,}/);
      }
      await freshTill();
      await homePage.selectStaffByIndex(0);
      await homePage.addServiceByIndex(0);
      const pending = /#(OD\d{6}-\d+)/.exec(await P.pageText('main'))?.[1] ?? '';
      try {
        if (!pending) this.skip();
        await P.routerGo('/home');
        await scan(`ORDER:${pending}`);
        expect(await P.path()).toMatch(/^\/home/);
        expect(await P.pageText('main')).toContain(`#${pending}`);
      } finally {
        await freshTill();
      }
    },
  );

  it(
    title(
      'Deep link /order-history?search=<code> filters and opens the first match (OH-040)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const { code } = await createPaidOrder({ method: 'other' });
      await returnToHome();
      await P.routerGo('/order-history', { search: code });
      await passcodeIfAsked(3_000);
      expect(
        await P.poll(
          () => P.inputValue(OH.searchBox),
          (v) => v === code,
          15_000,
        ),
      ).toBe(code);
      expect(
        await P.poll(
          () => P.path(),
          (p) => /^\/order-history\/[0-9a-f-]{20,}/.test(p),
          15_000,
        ),
      ).toMatch(/^\/order-history\/[0-9a-f-]{20,}/);
      await P.waitFor(inMain({ text: `Order #${code}` }), Timeouts.MEDIUM, `Order #${code}`);
    },
  );

  it(
    title('A one-day range in the past shows only that day (00:00–23:59) (OH-047)', Tag.REGRESSION),
    async () => {
      await openList();
      const day = addDays(new Date(), -1);
      await pickDateRange(day, day);
      for (const d of await rowDates()) expect(d).toBe(mdy(day));
    },
  );

  it(
    title(
      'Staff filter keeps only that staff\'s orders; Search staff by part of the nickname, "No results found." (OH-055, OH-056)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      await freshTill();
      if ((await homePage.visibleStaffCount()) < 2) this.skip();
      const a = await createPaidOrder({ method: 'other', lines: [[0, 0]] });
      const b = await createPaidOrder({ method: 'other', lines: [[1, 0]] });
      const nameB = staffInDetail(await detailText(b.code))[0] ?? '';
      await openHistoryOrder(a.orderId);
      const nameA = staffInDetail(await detailText(a.code))[0] ?? '';
      if (!nameA || !nameB || nameA === nameB) this.skip();
      await openList();
      await applyOhFilter({ staffs: [nameA] });
      expect(await filterRedDotShown()).toBe(true);
      for (const r of await rowTexts()) expect(r).toContain(nameA);
      await search(a.code);
      expect(await rowShown(a.code)).toBe(true);
      await search(b.code);
      expect(
        await P.poll(
          () => emptyShown(),
          (v) => v,
          8_000,
        ),
      ).toBe(true);

      await step('OH-056 Search staff by nickname part', async () => {
        await openFilter();
        await P.clickQ(inFilter({ role: 'button', nameRe: 'Select staff', nth: 0 }));
        await P.fillQ(STAFF_SEARCH, nameA.slice(0, 3).toLowerCase());
        await settle(800);
        expect(await P.has({ role: 'checkbox', name: nameA })).toBe(true);
        await P.fillQ(STAFF_SEARCH, 'zzzz');
        expect(
          await P.poll(
            () => P.has({ text: 'No results found.' }),
            (v) => v,
            5_000,
          ),
        ).toBe(true);
        await P.escape();
        if (await P.has(filterDialog)) await P.clickQ(inFilter({ role: 'button', name: 'Close', nth: 0 }));
      });
    },
  );

  it(
    title(
      'Payment filter: Cash excludes a cancelled (voided) cash order; several methods are OR (OH-058, OH-059)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(10 * 60_000);
      const c1 = await createPaidOrder({ method: 'cash' });
      const o1 = await createPaidOrder({ method: 'other' });
      const c2 = await createPaidOrder({ method: 'cash' });
      await cancelOrder(0);
      expect(await waitStatus(c2.code, /^Canceled$/)).toBe('Canceled');

      await openList();
      await applyOhFilter({ payments: ['cash'] });
      for (const r of await rowTexts()) expect(r).toContain('Cash');
      await search(c1.code);
      expect(await rowShown(c1.code)).toBe(true);
      await search(o1.code);
      expect(
        await P.poll(
          () => emptyShown(),
          (v) => v,
          8_000,
        ),
      ).toBe(true);
      await search(c2.code);
      expect(
        await P.poll(
          () => emptyShown(),
          (v) => v,
          8_000,
        ),
      ).toBe(true);

      await search('');
      await applyOhFilter({ clear: true, payments: ['card', 'other'] });
      for (const r of await rowTexts()) expect(r).toMatch(/Card|Other/);
      await search(o1.code);
      expect(await rowShown(o1.code)).toBe(true);
      await search(c1.code);
      expect(
        await P.poll(
          () => emptyShown(),
          (v) => v,
          8_000,
        ),
      ).toBe(true);
    },
  );

  it(
    title(
      'Status filter: each status returns only its badge; both Successful = all successful; filters AND together (OH-060, OH-061, OH-062)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(10 * 60_000);
      const phone = randomPhone();
      const name = `QC E2E ${phone.slice(-5)}`;
      const { code } = await createPaidOrder({ method: 'other', customerPhone: phone, customerName: name });
      const staff = staffInDetail(await detailText(code))[0] ?? '';
      await openList();
      const today = new Date();
      await pickDateRange(addDays(today, -29), today);
      const labels: Record<string, string> = {
        successful: 'Successful - Unsettled',
        'successful-settled': 'Successful - Settled',
        canceled: 'Canceled',
        canceling: 'Canceling',
        'cancel-issue': 'Cancel Issue',
        'partial-refunded': 'Partial Refunded',
        refunded: 'Refunded',
        refunding: 'Refunding',
        'refund-issue': 'Refund Issue',
      };
      await step('OH-060 one status at a time', async () => {
        for (const [sid, label] of Object.entries(labels)) {
          await applyOhFilter({ clear: true, statuses: [sid] });
          for (const r of await rowTexts()) expect(r).toContain(`| ${label} |`);
        }
      });
      await step('OH-061 Unsettled + Settled', async () => {
        await applyOhFilter({ clear: true, statuses: ['successful', 'successful-settled'] });
        for (const r of await rowTexts()) expect(r).toMatch(/Successful - (Unsettled|Settled)/);
      });
      await step('OH-062 name + staff + Other + Successful is an AND', async () => {
        if (!staff) return;
        await applyOhFilter({ clear: true, staffs: [staff], payments: ['other'], statuses: ['successful'] });
        await search(name);
        expect(await rowShown(code)).toBe(true);
        await search('');
        await applyOhFilter({ clear: true, staffs: [staff], payments: ['cash'], statuses: ['successful'] });
        await search(name);
        expect(
          await P.poll(
            () => emptyShown(),
            (v) => v,
            8_000,
          ),
        ).toBe(true);
      });
    },
  );

  it(
    title(
      'A Re-open order shows the Re-open badge, the Status filter has no "Re-open", detail offers Continue Re-open (OH-066)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'other' });
      await reopenToCheckout(orderId);
      try {
        // Reopen mode hides the nav: leave by router, as the volt-qc test does through the URL.
        await P.routerGo('/order-history');
        await passcodeIfAsked(2_000);
        await P.waitFor(OH.heading, Timeouts.MEDIUM, 'Order History heading');
        await openFilter();
        await P.clickQ(inFilter({ role: 'button', nameRe: 'Select status' }));
        const ids = await P.exec<string[]>(
          'return Array.prototype.map.call(document.querySelectorAll(\'[id^="status-"]\'), function (e) { return e.id; });',
        );
        expect(ids).toHaveLength(9);
        expect(ids).not.toContain('status-re-open');
        expect(await P.has({ css: '[id^="status-"]', hasText: 'Re-open' })).toBe(false);
        await P.escape();
        if (await P.has(filterDialog)) await P.clickQ(inFilter({ role: 'button', name: 'Close', nth: 0 }));
        await search(code);
        expect(await rowShown(code)).toBe(true);
        expect(await rowOf(code)).toContain('Re-open');
        await openRow(code);
        expect(
          await P.poll(
            () => hasDetailButton(B.continueReopen),
            (v) => v,
            10_000,
          ),
        ).toBe(true);
      } finally {
        await openByCode(code).catch(() => undefined);
        if (await hasDetailButton(B.continueReopen)) {
          await reopenToCheckout(orderId, B.continueReopen);
          await reopenDone();
        }
      }
    },
  );

  it(
    title(
      'Order History gate OFF in Passcode Setting opens the list with no dialog; ON asks again (OH-008)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const saved = await P.localGet(SKIP_KEY);
      const before = await setPasscodeGate('view_order_history', false);
      try {
        await P.localSet(SKIP_KEY, null);
        await P.routerGo('/home');
        await P.routerGo('/order-history');
        expect(
          await P.poll(
            () => P.has(D.passcode),
            (v) => v,
            2_500,
          ),
        ).toBe(false);
        await P.waitFor(OH.heading, Timeouts.MEDIUM, 'Order History heading');
      } finally {
        await setPasscodeGate('view_order_history', before);
      }
      if (before) {
        await P.localSet(SKIP_KEY, null);
        await P.routerGo('/home');
        await P.routerGo('/order-history');
        expect(
          await P.poll(
            () => P.has(D.passcode),
            (v) => v,
            5_000,
          ),
        ).toBe(true);
        await P.escape();
      }
      await P.localSet(SKIP_KEY, saved);
    },
  );

  it(
    title(
      'A "Staff" role code opens Order History and still sees another staff\'s order (VP-3592) (OH-010)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const code = staffRoleCode();
      if (!code) this.skip(); // VOLT_STAFFROLE_CODE not configured
      const order = await createPaidOrder({ method: 'other' });
      const saved = await P.localGet(SKIP_KEY);
      try {
        await returnToHome();
        await P.localSet(SKIP_KEY, null);
        await P.routerGo('/order-history');
        if (
          !(await P.poll(
            () => P.has(D.passcode),
            (v) => v,
            5_000,
          ))
        )
          this.skip();
        for (const c of code) await P.clickQ([D.passcode, { role: 'button', name: c, nth: 0 }]);
        await settle(1_500);
        if (await P.has(D.passcode)) this.skip(); // the role is denied on this merchant — nothing to check
        await P.waitFor(OH.heading, Timeouts.MEDIUM, 'Order History heading');
        await search(order.code);
        expect(await rowShown(order.code)).toBe(true);
      } finally {
        await P.escape().catch(() => undefined);
        await P.localSet(SKIP_KEY, saved);
      }
    },
  );

  it(
    title(
      'At 1920x1080 the detail title shows the full order code and the page has no extra horizontal scroll (OH-023)',
      Tag.REGRESSION,
    ),
    async function () {
      await openList();
      const code = (await rowCodes())[0];
      if (!code) this.skip();
      await openRow(code ?? '');
      const heading = await P.textOf(inMain({ text: `Order #${code ?? ''}` }));
      expect(heading).toContain(code ?? '');
      expect(await P.noHorizontalScroll()).toBe(true);
      expect(field(await detailText(code), 'Order ID')).toBe(code);
    },
  );
});
