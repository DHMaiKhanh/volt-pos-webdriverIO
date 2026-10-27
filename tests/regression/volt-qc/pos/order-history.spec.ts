/**
 * volt-qc port — 07 ORDER HISTORY (read-only cases).
 *
 * Source: volt-qc `e2e/tests/07-order-history/oh-plan-list.spec.ts` (OH-T01, T03, T09, T10,
 * T12, T16, T18, T21, T36) and `oh-deep.spec.ts` (OH-D01).
 * TC catalogue: docs/qc/volt-qc/windows-regression/07-order-history.md.
 *
 * Reads, searches, date ranges and the Filter dialog only — no order is opened
 * for editing, nothing is paid or cancelled.
 *
 * The two passcode-gate cases clear the "skip for 30 minutes" grant
 * (`localStorage['volt-passcode-skip']`) to see the guard, and put the grant the
 * run had back in `finally`, so later specs keep their cached unlock. If the
 * merchant has the Order History gate OFF, they skip.
 */

import { expect } from '@wdio/globals';
import { env } from '../../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog } from '../../../../src/components/index.js';
import {
  VqcCommon,
  VqcOrderHistory as OH,
  btn,
  inMain,
} from '../../../../src/constants/testids.voltqc-pos.js';
import { goToOrderHistory, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { orderHistoryPage } from '../../../../src/pages/index.js';
import {
  addDays,
  applyFilter,
  collectCodes,
  dateRangeText,
  dayButton,
  dayCellCounts,
  filterDialog,
  filterRedDotShown,
  inFilter,
  mdy,
  openDatePicker,
  openFilter,
  openRow,
  parseMdy,
  passcodeDotsFilled,
  pickDateRange,
  rowCodes,
  rowCount,
  rowDates,
  search,
  startOfDay,
} from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const GUARD = VqcCommon.passcodeDialog;
const SKIP_KEY = OH.passcodeSkipKey;
/** A 4-digit code that is neither the staff nor the owner passcode. */
const WRONG_CODE =
  ['0000', '1357', '2468'].find((c) => c !== env.STAFF_PASSCODE && c !== env.OWNER_PASSCODE) ?? '1357';

/** Fresh Order History list: leave and re-enter so filters/range/search are back to default. */
async function openHistoryList(): Promise<void> {
  if (await orderHistoryPage.isActive()) await returnToHome();
  await goToOrderHistory();
  await P.waitFor(OH.heading, 15_000, 'Order History heading');
  if ((await P.inputValue(OH.searchBox)) !== '') await search('');
}

async function tapGuardDigits(code: string): Promise<void> {
  for (const c of code) await P.clickQ([GUARD, btn(c)]);
}

async function guardShown(timeout = 3_000): Promise<boolean> {
  const v = await P.poll(
    () => P.has(GUARD),
    (x) => x,
    timeout,
  );
  return v;
}

describe('volt-qc 07 ORDER HISTORY — read-only', () => {
  after(async () => {
    await P.escape().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Order History passcode gate: from the sidebar, wrong code, digit delete, close X/Escape → Pending (OH-002, OH-003, OH-004, OH-005)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await returnToHome();
      const saved = await P.localGet(SKIP_KEY);
      await P.localSet(SKIP_KEY, null);
      try {
        await step(
          'OH-002 Sidebar › Order History asks for the code; after it the list opens, link active',
          async () => {
            await appNav.openSidebar();
            await P.clickQ([VqcCommon.sidebar, { text: 'Order History', nth: 0 }]);
            if (!(await guardShown(5_000))) this.skip(); // gate OFF on this merchant
            expect(await P.has([GUARD, { role: 'heading', name: OH.accessTitle }])).toBe(true);
            await passcodeDialog.enter(env.STAFF_PASSCODE);
            await P.waitFor(OH.heading, 15_000, 'Order History heading');
            await appNav.openSidebar();
            expect(
              await P.attrOf([VqcCommon.sidebar, { css: 'a[href="/order-history"]', nth: 0 }], 'data-status'),
            ).toBe('active');
            await P.escape();
          },
        );

        await step('OH-003 wrong code: guard stays, error shown, no rows; right code gets in', async () => {
          await P.routerGo('/home');
          await P.routerGo('/order-history');
          expect(await guardShown()).toBe(true);
          await tapGuardDigits(WRONG_CODE);
          await settle(1_500);
          expect(await P.has(GUARD)).toBe(true);
          expect((await P.rawText(GUARD)) ?? '').toMatch(OH.wrongCode);
          expect(await rowCount()).toBe(0);
          await passcodeDialog.enter(env.STAFF_PASSCODE);
          await P.waitFor(OH.heading, 15_000, 'Order History heading');
        });

        await step(
          'OH-004 closing with X and with Escape lands on /order-pending, no order exposed',
          async () => {
            for (const how of ['x', 'escape'] as const) {
              await P.routerGo('/home');
              await P.routerGo('/order-history');
              expect(await guardShown()).toBe(true);
              expect(await rowCount()).toBe(0);
              if (how === 'x') await P.clickQ([GUARD, { css: 'button', nth: 0 }]);
              else await P.escape();
              await P.waitGoneQ(GUARD, 5_000, 'passcode guard');
              const path = await P.poll(
                () => P.path(),
                (p) => p.startsWith('/order-pending'),
                10_000,
              );
              expect(path).toMatch(/^\/order-pending/);
            }
          },
        );

        await step(
          'OH-005 fewer than 4 digits never submit; Backspace / the delete key drop the last digit',
          async () => {
            await P.routerGo('/home');
            await P.routerGo('/order-history');
            expect(await guardShown()).toBe(true);
            await tapGuardDigits('123');
            await settle(800);
            expect(await P.has(GUARD)).toBe(true);
            expect(await passcodeDotsFilled()).toBe(3);
            await P.press('Backspace');
            expect(await passcodeDotsFilled()).toBe(2);
            const bksp = await P.exec<boolean>(`
            var dlgs = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"]'), function (d) { return /Enter staff code/.test(d.textContent || ''); });
            var dlg = dlgs[dlgs.length - 1];
            var zero = dlg && Array.prototype.find.call(dlg.querySelectorAll('button'), function (b) { return (b.textContent || '').trim() === '0'; });
            var next = zero && zero.nextElementSibling;
            if (!next) return false;
            next.setAttribute('data-vqc-bksp', '1');
            return true;
          `);
            expect(bksp).toBe(true);
            await P.clickQ({ css: '[data-vqc-bksp="1"]' });
            expect(await passcodeDotsFilled()).toBe(1);
            await P.clickQ({ css: '[data-vqc-bksp="1"]' });
            expect(await passcodeDotsFilled()).toBe(0);
            await passcodeDialog.enter(env.STAFF_PASSCODE);
            await P.waitFor(OH.heading, 15_000, 'Order History heading');
          },
        );
      } finally {
        await P.escape().catch(() => undefined);
        await P.localSet(SKIP_KEY, saved);
      }
    },
  );

  it(
    title(
      'Ticking "no passcode for 30 minutes" stops the prompt; clearing the flag brings it back (OH-009)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      const saved = await P.localGet(SKIP_KEY);
      await P.localSet(SKIP_KEY, null);
      try {
        await P.routerGo('/order-history');
        if (!(await guardShown(5_000))) this.skip(); // gate OFF on this merchant
        if (!(await passcodeDialog.canSkip())) this.skip(); // no 30-minute checkbox on this build
        const t0 = Date.now();
        await passcodeDialog.enter(env.STAFF_PASSCODE, { skipForNext30Min: true });
        await P.waitFor(OH.heading, 15_000, 'Order History heading');

        await P.routerGo('/home');
        await P.routerGo('/order-history');
        expect(await guardShown(2_500)).toBe(false);
        await P.waitFor(OH.heading, 15_000, 'Order History heading');

        const raw = await P.localGet(SKIP_KEY);
        const grant = raw ? (JSON.parse(raw) as { staffId?: string; expiresAt?: number | string }) : null;
        expect(Boolean(grant?.staffId)).toBe(true);
        const exp =
          typeof grant?.expiresAt === 'number' ? grant.expiresAt : Date.parse(String(grant?.expiresAt));
        expect(Math.abs(exp - (t0 + 30 * 60_000))).toBeLessThan(2 * 60_000);

        await P.localSet(SKIP_KEY, null);
        await P.routerGo('/home');
        await P.routerGo('/order-history');
        expect(await guardShown()).toBe(true);
        await P.escape();
      } finally {
        await P.escape().catch(() => undefined);
        await P.localSet(SKIP_KEY, saved);
      }
    },
  );

  it(
    title('Infinite scroll over 30 days loads more pages with no duplicate code (OH-018)', Tag.REGRESSION),
    async function () {
      this.timeout(5 * 60_000);
      await openHistoryList();
      const today = new Date();
      await pickDateRange(addDays(today, -29), today);
      const first = await rowCodes();
      expect(new Set(first).size).toBe(first.length);
      const all = await collectCodes();
      // Needs ≥ 41 orders in 30 days to reach page 3.
      if (all.length < 41) this.skip();
      expect(all.length).toBeGreaterThanOrEqual(40);
      const now = await rowCodes();
      expect(new Set(now).size).toBe(now.length);
      expect(await P.count(inMain({ css: '.animate-spin' }))).toBe(0);
    },
  );

  it(
    title(
      'Empty states: 2020 range, no-match keyword, whitespace-only keyword, deep link ?search= with no match (OH-019, OH-029, OH-031, OH-041)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await openHistoryList();
      await step('OH-019 range 01/01/2020 - 01/02/2020', async () => {
        await pickDateRange(new Date(2020, 0, 1), new Date(2020, 0, 2));
        await P.waitFor(inMain({ text: OH.noOrders }), 15_000, '"No Orders Found"');
        expect(await P.has(inMain({ text: OH.noOrdersDesc }))).toBe(true);
        expect(await P.has(inMain({ text: OH.selectOrder }))).toBe(true);
      });
      await step('OH-029 keyword that matches nothing', async () => {
        await openHistoryList();
        await search('ZZZNOMATCH999');
        await P.waitFor(inMain({ text: OH.noOrders }), 15_000, '"No Orders Found"');
        expect(await P.has(inMain({ text: OH.noSearchResults }))).toBe(true);
      });
      await step('OH-031 whitespace only = no filter', async () => {
        await search('');
        const n0 = (await rowCodes()).length;
        await search('   ');
        expect(await P.count(inMain({ text: OH.noOrders }))).toBe(0);
        expect((await rowCodes()).length).toBe(n0);
      });
      await step('OH-041 deep link ?search=NOPE123', async () => {
        await returnToHome();
        await P.routerGo('/order-history', { search: 'NOPE123' });
        await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
        await P.waitFor(inMain({ text: OH.noOrders }), 15_000, '"No Orders Found"');
        expect(await P.has(inMain({ text: OH.selectOrder }))).toBe(true);
        expect(await P.pageText()).not.toMatch(/\b404\b|Something went wrong/);
      });
    },
  );

  it(title('Search only looks inside the selected date range (OH-033)', Tag.REGRESSION), async function () {
    this.timeout(4 * 60_000);
    await openHistoryList();
    const today = new Date();
    await pickDateRange(addDays(today, -60), addDays(today, -9));
    const old = (await rowCodes())[0];
    // Needs an order older than 8 days.
    if (!old) this.skip();
    await pickDateRange(addDays(today, -7), today);
    await search(old ?? '');
    await P.waitFor(inMain({ text: OH.noOrders }), 15_000, '"No Orders Found" for an out-of-range order');
    await pickDateRange(addDays(today, -60), today);
    const found = await P.poll(rowCodes, (c) => c.includes(old ?? ''), 20_000);
    expect(found).toContain(old);
  });

  it(
    title(
      'Date range picker: Apply, Today, Cancel, future days disabled (OH-043, OH-044, OH-045, OH-046)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const today = startOfDay(new Date());
      await openHistoryList();

      await step('OH-043 pick a range → Apply', async () => {
        await openDatePicker();
        for (const b of ['Today', 'Cancel', 'Apply']) {
          expect(await P.has([OH.datePopover, { role: 'button', name: b }])).toBe(true);
        }
        expect(await P.count([OH.datePopover, { role: 'grid' }])).toBeGreaterThanOrEqual(2);
        await P.clickQ([OH.datePopover, { role: 'button', name: 'Cancel' }]);
        const from = addDays(today, -6);
        const to = addDays(today, -3);
        await pickDateRange(from, to);
        expect(await P.count(OH.datePopover)).toBe(0);
        expect(await dateRangeText()).toMatch(new RegExp(`${mdy(from)} - ${mdy(to)}`));
        for (const d of await rowDates()) {
          const t = parseMdy(d);
          expect(t >= from && t <= to).toBe(true);
        }
      });

      await step('OH-044 Today', async () => {
        await openDatePicker();
        await P.clickQ([OH.datePopover, { role: 'button', name: 'Today' }]);
        await P.waitGoneQ(OH.datePopover, 5_000, 'date popover');
        await settle(1_500);
        expect(await dateRangeText()).toMatch(new RegExp(`(^|\\s)${mdy(today)}( - ${mdy(today)})?\\s*$`));
        for (const d of await rowDates()) expect(d).toBe(mdy(today));
      });

      await step('OH-045 Cancel keeps the range', async () => {
        const t0 = await dateRangeText();
        const codes0 = await rowCodes();
        await openDatePicker();
        await P.clickQ(await dayButton(addDays(today, -10)));
        await P.clickQ(await dayButton(addDays(today, -2)));
        await P.clickQ([OH.datePopover, { role: 'button', name: 'Cancel' }]);
        await P.waitGoneQ(OH.datePopover, 5_000, 'date popover');
        expect(await dateRangeText()).toBe(t0);
        expect(await rowCodes()).toEqual(codes0);
      });

      await step('OH-046 tomorrow is disabled', async () => {
        const t0 = await dateRangeText();
        await openDatePicker();
        const tomorrow = await dayButton(addDays(today, 1), 2);
        expect(await P.isDisabled(tomorrow)).toBe(true);
        await P.escape();
        expect(await dateRangeText()).toBe(t0);
      });
    },
  );

  it(title('A range longer than 6 months is not blocked on dev (OH-050)', Tag.REGRESSION), async () => {
    const today = new Date();
    await openHistoryList();
    await pickDateRange(new Date(today.getFullYear(), 0, 1), today);
    expect(await P.count({ text: OH.rangeLimit })).toBe(0);
    expect(await dateRangeText()).toMatch(new RegExp(`01/01/${String(today.getFullYear())} - ${mdy(today)}`));
    expect(await P.has(OH.heading)).toBe(true);
    expect(await P.pageText()).not.toMatch(/Something went wrong/);
  });

  it(
    title(
      'Two-month calendar: range 15th → month end applies; the boundary day is shown and painted once (VP-2105) (OH-049)',
      Tag.REGRESSION,
    ),
    async () => {
      const today = new Date();
      // A past month whose next month does not start on a Monday, so the right
      // calendar's outside-days include this month's last day.
      let end = new Date(today.getFullYear(), today.getMonth(), 0);
      while (new Date(end.getFullYear(), end.getMonth() + 1, 1).getDay() === 1) {
        end = new Date(end.getFullYear(), end.getMonth(), 0);
      }
      const from = new Date(end.getFullYear(), end.getMonth(), 15);
      await openHistoryList();
      await pickDateRange(from, end);
      expect(await dateRangeText()).toMatch(new RegExp(`${mdy(from)} - ${mdy(end)}`));
      // Rows show the COMPLETION date while the range filters on creation — only
      // a row completed BEFORE the range is wrong.
      for (const s of await rowDates()) expect(parseMdy(s) >= from).toBe(true);

      await openDatePicker();
      const { shown, lit } = await dayCellCounts(end);
      await P.clickQ([OH.datePopover, { role: 'button', name: 'Cancel' }]);
      // Fails until VP-2105 ships (volt-qc marks this test.fail while the bug is open).
      expect(shown).toBe(1);
      expect(lit).toBe(1);
    },
  );

  it(
    title(
      'Filter dialog: defaults, Sort "Last updated" raises the red dot, Clear / Close / Clear+Confirm (OH-053, OH-054, OH-063, OH-064, OH-065)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await openHistoryList();

      await step('OH-053 defaults', async () => {
        expect(await filterRedDotShown()).toBe(false);
        await openFilter();
        expect(await P.textOf(inFilter({ role: 'combobox', nth: 0 }))).toMatch(/Date completed/);
        for (const b of ['Select staff', 'Select payment method', 'Select status']) {
          expect(await P.has(inFilter({ role: 'button', nameRe: b }))).toBe(true);
        }
        expect(await P.has(inFilter({ role: 'button', name: 'Clear' }))).toBe(true);
        expect(await P.isDisabled(inFilter({ role: 'button', name: 'Confirm' }))).toBe(true);
        await P.escape();
        await P.waitGoneQ(filterDialog, 5_000, 'Filter dialog');
      });

      await step('OH-054 Sort by Last updated → red dot', async () => {
        await applyFilter({ sortBy: 'Last updated' });
        expect(await filterRedDotShown()).toBe(true);
        await applyFilter({ clear: true });
        expect(await filterRedDotShown()).toBe(false);
      });

      await step('OH-063 Clear resets only inside the dialog; Confirm drops the filter', async () => {
        await applyFilter({ statuses: ['canceled'] });
        expect(await filterRedDotShown()).toBe(true);
        const codes = await rowCodes();
        await openFilter();
        await P.clickQ(inFilter({ role: 'button', name: 'Clear' }));
        expect(await P.has(inFilter({ role: 'button', nameRe: 'Select status' }))).toBe(true);
        expect(await P.textOf(inFilter({ role: 'combobox', nth: 0 }))).toMatch(/Date completed/);
        expect(await rowCodes()).toEqual(codes);
        await P.clickQ(inFilter({ role: 'button', name: 'Confirm' }));
        await P.waitGoneQ(filterDialog, 5_000, 'Filter dialog');
        await settle(800);
        expect(await filterRedDotShown()).toBe(false);
      });

      await step('OH-064 tick then close with X does not apply', async () => {
        const codes = await rowCodes();
        await openFilter();
        await P.clickQ(inFilter({ role: 'button', nameRe: 'Select status' }));
        await P.clickQ({ css: '[id="status-refunded"]' });
        await P.escape();
        await P.clickQ(inFilter({ role: 'button', name: 'Close', nth: 0 }));
        await P.waitGoneQ(filterDialog, 5_000, 'Filter dialog');
        await settle(1_000);
        expect(await rowCodes()).toEqual(codes);
        await openFilter();
        expect(await P.has(inFilter({ role: 'button', nameRe: 'Select status' }))).toBe(true);
        await P.escape();
      });

      await step('OH-065 Clear + Confirm empties the keyword, keeps the default date range', async () => {
        const range0 = await dateRangeText();
        await search('OD');
        await applyFilter({ clear: true });
        expect(await P.inputValue(OH.searchBox)).toBe('');
        expect(await dateRangeText()).toBe(range0);
        const today = startOfDay(new Date());
        for (const d of await rowDates()) expect(parseMdy(d) >= addDays(today, -7)).toBe(true);
      });
    },
  );

  it(title('A "Cancel Issue" order still offers Cancel Order (OH-106)', Tag.REGRESSION), async function () {
    await openHistoryList();
    const today = new Date();
    await pickDateRange(addDays(today, -29), today);
    await applyFilter({ statuses: ['cancel-issue'] });
    const code = (await rowCodes())[0];
    // Needs a card void that failed — cannot be produced on purpose.
    if (!code) this.skip();
    await openRow(code ?? '');
    await P.waitFor(inMain({ text: `Order #${code ?? ''}` }), 15_000, 'order detail');
    expect(await P.has(inMain(btn('Receipt')))).toBe(true);
    expect(await P.has(inMain(btn('Cancel Order')))).toBe(true);
    expect(await P.count(inMain(btn('Re-Open Order')))).toBe(0);
    expect(await P.count({ css: '[data-testid="order-action-refund"]' })).toBe(0);
  });
});
