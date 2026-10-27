/**
 * volt-qc port — Staff Income (V1 `/incomes/income-staff`), read-only.
 *
 * Source: volt-qc `e2e/tests/10-reports/rpt-plan-staff-income.spec.ts` —
 * RPT-T20a-d, T21a-c, T23 (`@readonly`).
 *
 * The "test staff" is chosen from live data (see reports-time.helpers.ts):
 * STAFF_NAME when it has orders in the last 7 days, else the busiest staff.
 *
 * Build drift: the installed 1.1.x Staff Income has no "Search staff" box
 * (develop re-adds it). The cases that need it skip with that reason rather
 * than fail on a missing control.
 */

import { expect } from '@wdio/globals';
import { browser } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import {
  RptCss,
  RptRoutes,
  RptText,
  STAFF_COLUMNS,
  STAFF_SUMMARY_LABELS,
} from '../../../../src/constants/testids.voltqc-reports-time.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  choosePreset,
  comboText,
  dayStart,
  fillInput,
  fmtDate,
  hasPair,
  hasText,
  MONTHS,
  openReport,
  paneText,
  pfull,
  pv,
  rangeDates,
  rangeOffset,
  searchParam,
  sum,
  waitNoSkeleton,
  ymd,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  clickListHeader,
  clickRow,
  clickTipTrigger,
  closeOrderDetails,
  commissionRates,
  hasStaffSearch,
  noIncomeToggleOn,
  openStaffIncome,
  printButtonState,
  selectStaffRow,
  setNoIncomeToggle,
  staffDetail,
  staffFilterXs,
  staffIncomeDetailFor,
  staffList,
  staffSearchBox,
  tipTriggerState,
  waitOrderDetails,
  waitStaffRow,
  waitStaffRows,
  type StaffRow,
  type StaffSummary,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { check, ensure, ensureCents, ensureEqual, note, testStaff } from './reports-time.helpers.js';

const L = RptCss.leftPane;
const R = RptCss.rightPane;

function expectSummaryMatchesRows(summary: StaffSummary, rows: StaffRow[], where: string): void {
  expect(summary.totalStaff).toBe(rows.length);
  expect(summary.totalOrders).toBe(sum(rows.map((r) => r.orders)));
  ensureCents(summary.totalSubtotal, sum(rows.map((r) => r.subtotal)), `${where}: Total subtotal`);
  ensureCents(summary.totalSupplyFee, sum(rows.map((r) => r.supply)), `${where}: Total supply fee`);
  ensureCents(summary.totalTip, sum(rows.map((r) => r.tip)), `${where}: Total tip`);
  ensureCents(summary.totalStaffIncome, sum(rows.map((r) => r.total)), `${where}: Total staff income`);
}

/** Make sure `name` is listed (turn "Show staff with no income" on when needed). */
async function ensureStaffRow(name: string): Promise<StaffRow | null> {
  if (!(await staffList()).rows.some((r) => r.name === name)) await setNoIncomeToggle(true);
  return waitStaffRow(name, 60_000);
}

async function firstStaff(ctx: Mocha.Context): Promise<string> {
  const [name] = await testStaff();
  if (name === undefined) {
    note('Staff Income: no staff with orders in the last 7 days');
    ctx.skip();
  }
  return name;
}

async function typeSearch(text: string): Promise<void> {
  await fillInput(await staffSearchBox(), text);
  await settle(500);
}

describe('volt-qc RPT — Staff Income: list (read-only)', () => {
  it(
    title(
      'Layout: search → date filter → toggle; 6 summary figures in order; 6 columns; empty detail; slow list is polled (RPT-089, RPT-090)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await openReport(RptRoutes.staff);
      if (!(await hasStaffSearch())) {
        note('RPT-089: this build has no "Search staff" box on Staff Income (develop re-adds it)');
        this.skip();
      }
      const xs = await staffFilterXs();
      for (let i = 1; i < xs.length; i += 1) {
        ensure(
          (xs[i] ?? Number.NaN) > (xs[i - 1] ?? Number.NaN),
          `Filter order search → date → toggle label → switch: x=${xs.join(', ')}`,
        );
      }
      expect(await comboText(L)).toBe('Today');
      expect(await noIncomeToggleOn()).toBe(false);
      const t = await paneText(L);
      let pos = -1;
      for (const label of STAFF_SUMMARY_LABELS) {
        const i = t.indexOf(label, pos + 1);
        ensure(i > pos, `Summary figure "${label}" is not in order`);
        pos = i;
      }
      expect(await hasText(R, RptText.noDetail)).toBe(true);
      expect(await hasText(R, RptText.staffNoDetailHint)).toBe(true);

      await step(
        'RPT-090 the list loads late: poll for rows instead of concluding "No results"',
        async () => {
          ensure(await waitStaffRows(60_000), 'Staff Income listed no rows within 60 s');
          expect((await staffList()).headers).toEqual([...STAFF_COLUMNS]);
        },
      );
    },
  );

  it(
    title(
      'Search is case/space-insensitive; no match / special chars / 200 chars → no rows; figures = Σ visible rows (RPT-091, RPT-092, RPT-094)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      const target = await firstStaff(this);
      await openStaffIncome(rangeOffset(-6, 0));
      if (!(await hasStaffSearch())) {
        note('RPT-091/092: this build has no "Search staff" box on Staff Income');
        this.skip();
      }
      await waitStaffRows(60_000);
      const all = await staffList();
      expectSummaryMatchesRows(all.summary, all.rows, 'Unfiltered');

      await step('RPT-091 two first letters / upper case with spaces / cleared', async () => {
        const frag = target.slice(0, 2).toLowerCase();
        await typeSearch(frag);
        const l1 = await staffList();
        ensure(l1.rows.length > 0, `Search "${frag}" listed nothing`);
        for (const r of l1.rows) expect(r.name.toLowerCase()).toContain(frag);
        expectSummaryMatchesRows(l1.summary, l1.rows, `Filter "${frag}"`);
        await typeSearch(`  ${target.toUpperCase()}  `);
        const l2 = await staffList();
        for (const r of l2.rows) expect(r.name.toLowerCase()).toContain(target.toLowerCase());
        if (all.rows.some((r) => r.name === target)) expect(l2.rows.map((r) => r.name)).toContain(target);
        expectSummaryMatchesRows(l2.summary, l2.rows, 'Upper case + spaces');
        await typeSearch('');
        expect((await staffList()).rows.length).toBe(all.rows.length);
      });

      await step('RPT-092 no match / special characters / 200 characters', async () => {
        for (const q of ['zzzz', `%_*'"`, 'x'.repeat(200)]) {
          await typeSearch(q);
          const l = await staffList();
          expect(l.rows).toHaveLength(0);
          expect(l.noResults).toBe(true);
          expect(l.summary.totalStaff).toBe(0);
          expect(l.summary.totalOrders).toBe(0);
          expect(l.summary.totalStaffIncome).toBe(0);
        }
        await typeSearch('');
        expect((await staffList()).rows.length).toBe(all.rows.length);
      });
    },
  );

  it(
    title('"Show staff with no income" only adds $0 rows; total income unchanged (RPT-093)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      const t = dayStart(0);
      await openStaffIncome(rangeDates(new Date(t.getFullYear(), t.getMonth(), 1), t));
      if ((await noIncomeToggleOn()) === null) {
        note('RPT-093: no "Show staff with no income" switch on this build');
        this.skip();
      }
      ensure(await waitStaffRows(60_000), 'Staff Income listed no rows this month');
      const off = await staffList();
      await setNoIncomeToggle(true);
      const on = await staffList();
      ensure(on.summary.totalStaff >= off.summary.totalStaff, 'Toggle ON lists fewer staff than OFF');
      ensureCents(on.summary.totalStaffIncome, off.summary.totalStaffIncome, 'Total staff income ON vs OFF');
      const offNames = new Set(off.rows.map((r) => r.name));
      for (const r of on.rows.filter((x) => !offNames.has(x.name)))
        ensureCents(r.total, 0, `Added row ${r.name}`);
      await setNoIncomeToggle(false);
      expect((await staffList()).rows.length).toBe(off.rows.length);
    },
  );

  it(
    title(
      'Sorting keeps the figures; selecting a staff opens the detail; a new range keeps the staff; a day with no orders (RPT-095, RPT-096, RPT-097, RPT-134)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      const name = await firstStaff(this);
      await openStaffIncome(rangeOffset(0));
      ensure((await ensureStaffRow(name)) !== null, `${name} not in today's list even with the $0 toggle`);

      await step('RPT-095 Subtotal header ×3, Name ×1 — same figures, same staff set', async () => {
        const base = await staffList();
        for (const h of ['Subtotal', 'Subtotal', 'Subtotal', 'Name']) {
          await clickListHeader(h);
          const l = await staffList();
          ensureEqual(l.summary, base.summary, `Summary after sorting by ${h}`);
          ensureEqual(
            [...l.rows.map((r) => r.name)].sort(),
            [...base.rows.map((r) => r.name)].sort(),
            `Staff set after sorting by ${h}`,
          );
        }
      });

      await step('RPT-097 click the staff → selected, staffId, h2 + (date), Print, "Thank you"', async () => {
        await selectStaffRow(name);
        expect((await staffList()).rows.find((r) => r.name === name)?.selected).toBe(true);
        ensure((await searchParam('staffId')) !== null, 'staffId missing from the URL');
        const d = await staffDetail();
        expect(d.rangeText).toBe(fmtDate(dayStart(0), 'MM/dd/yyyy'));
        expect((await printButtonState()).enabled).toBe(true);
        expect(await hasText(R, `Thank you, ${name}!`)).toBe(true);
      });

      await step('RPT-096 preset This Week → same staff, range starts on Monday', async () => {
        await choosePreset(L, 'This Week');
        await waitNoSkeleton(R).catch(() => undefined);
        const d = await staffDetail();
        expect(d.name).toBe(name);
        const monday = dayStart(-((dayStart(0).getDay() + 6) % 7));
        const exp = fmtDate(monday, 'MM/dd/yyyy');
        ensure(
          d.rangeText === exp || d.rangeText.startsWith(`${exp} - `),
          `Range "${d.rangeText}" does not start on Monday ${exp}`,
        );
      });

      await step('RPT-134 range 01/01/2024 → No detail, or an empty table with $0.00 figures', async () => {
        const staffId = await searchParam('staffId');
        await openStaffIncome(rangeDates(ymd(2024, 1, 1), ymd(2024, 1, 1)), staffId);
        await settle(1500);
        await waitNoSkeleton(R).catch(() => undefined);
        if (await hasText(R, RptText.noDetail)) return;
        const d = await staffDetail();
        expect(d.name).toBe(name);
        expect(await hasText(R, RptText.noData)).toBe(true);
        expect(await hasText(R, RptText.noOrdersForDate)).toBe(true);
        for (const p of d.pairs) ensureCents(p.value, 0, `"${p.label}" on an empty day`);
      });
    },
  );
});

describe('volt-qc RPT — Staff Income: commission detail (read-only)', () => {
  it(
    title(
      'Detail table: columns, service names, newest first; a row opens Order Details (RPT-098, RPT-100)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      const name = await firstStaff(this);
      const got = await staffIncomeDetailFor(name, rangeOffset(-6, 0));
      ensure(got !== null, `${name} not found in Staff Income (last 7 days)`);
      const { detail } = got;
      expect(detail.headers).toEqual(['Date', 'Order #', 'Service', 'Sale/Refund', 'Supply', 'Tip']);
      if (detail.rows.length < 2) {
        note(`RPT-098: ${name} has < 2 orders in 7 days`);
        this.skip();
      }
      for (const r of detail.rows.filter((x) => !x.refund))
        ensure(/\S/.test(r.service), `Order ${r.order} has no service name`);
      const year = dayStart(0).getFullYear();
      const toTime = (s: string): number => {
        const m = /([A-Z][a-z]{2}) (\d{1,2})/.exec(s);
        if (!m) return Number.NaN;
        const d = new Date(year, MONTHS.indexOf(m[1] ?? ''), Number(m[2]));
        if (d.getTime() > dayStart(0).getTime()) d.setFullYear(year - 1);
        return d.getTime();
      };
      const times = detail.rows.map((r) => toTime(r.date)).filter((t) => !Number.isNaN(t));
      for (let i = 1; i < times.length; i += 1)
        ensure((times[i] ?? 0) <= (times[i - 1] ?? 0), 'Detail rows are not newest → oldest');

      await step('RPT-100 a row → Order Details (orderId); closing keeps the staff selected', async () => {
        await clickRow(R, 0);
        expect(await waitOrderDetails(true)).toBe(true);
        await browser.waitUntil(async () => (await searchParam('orderId')) !== null, {
          timeout: Timeouts.MEDIUM,
          interval: 200,
        });
        await closeOrderDetails();
        expect(await waitOrderDetails(false)).toBe(true);
        expect(await searchParam('orderId')).toBeNull();
        expect((await staffDetail()).name).toBe(name);
      });
    },
  );

  it(
    title(
      'Formulas: Subtotal, Staff Commission by rate, Total Income, Pay 1/Pay 2, Tip split by method (RPT-101, RPT-102, RPT-122)',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context) {
      const name = await firstStaff(this);
      const got = await staffIncomeDetailFor(name, rangeOffset(-6, 0));
      ensure(got !== null, `${name} not found in Staff Income (last 7 days)`);
      const P = got.detail.pairs;
      if (!hasPair(P, 'Staff Commission')) {
        note(`RPT-101: ${name} is not on the commission layout (salary view)`);
        this.skip();
      }
      const v = (l: string): number => pv(P, l);
      const abs = Math.abs;

      await check(
        'RPT-101 Subtotal = Sale + Refund; Staff Commission per caption; Total Income per caption',
        () => {
          ensureCents(v('Subtotal'), v('Sale') + v('Refund'), 'Subtotal');
          const rates = commissionRates(got.detail.text);
          const caption = pfull(P, 'Staff Commission');
          const after = caption.includes('(Subtotal x Staff Commission Rate) - Supply Fee');
          ensure(
            after || caption.includes('(Subtotal - Supply Fee) x Staff Commission Rate'),
            `Staff Commission caption: "${caption}"`,
          );
          if (rates.length === 1) {
            const r = (rates[0] ?? 0) / 100;
            const expected = after
              ? v('Subtotal') * r - abs(v('Supply Fee'))
              : (v('Subtotal') - abs(v('Supply Fee'))) * r;
            // Rounded per order/day → a few cents of drift allowed.
            ensureCents(
              v('Staff Commission'),
              Math.round(expected),
              `Staff Commission at ${String(rates[0])}%`,
              5,
            );
          } else
            note(
              `RPT-101: several rates in range (${rates.join(', ')}) — Commission = Subtotal × rate not checked`,
            );
          expect(pfull(P, 'Total Income')).toContain(
            'Staff Commission - Clean Up Fee + Tip - Card Charge Commission - Card Charge Tip - Discount Charge',
          );
          const total =
            v('Staff Commission') -
            abs(v('Clean Up Fee/Deduction')) +
            v('Tip') -
            abs(v('Card Charge Commission')) -
            abs(v('Card Charge Tip')) -
            abs(v('Discount Charge'));
          ensureCents(v('Total Income'), total, 'Total Income');
          ensureCents(v('Pay 1') + v('Pay 2'), v('Total Income'), 'Pay 1 + Pay 2');
        },
      );

      await check('RPT-122 Pay 1 = Total × p% (caption), Pay 2 = Total − Pay 1', () => {
        const cap = pfull(P, 'Pay 1');
        const m = /Total Income x (\d+(?:\.\d+)?)%/.exec(cap);
        ensure(m !== null, `Pay 1 caption: "${cap}"`);
        ensureCents(
          v('Pay 1'),
          Math.round((v('Total Income') * Number(m[1])) / 100),
          `Pay 1 at ${m[1] ?? ''}%`,
          1,
        );
        expect(pfull(P, 'Pay 2')).toContain('Total Income - Pay 1');
        ensureCents(v('Pay 2'), v('Total Income') - v('Pay 1'), 'Pay 2');
      });

      await step(
        'RPT-102 Tip collapsed by default; open → Card/Cash/Gift Card/Other sum to Tip; reselecting collapses',
        async () => {
          expect(await tipTriggerState()).toBe('closed');
          await clickTipTrigger();
          expect(await tipTriggerState()).toBe('open');
          const p2 = (await staffDetail()).pairs;
          ensureCents(
            sum(['Card', 'Cash', 'Gift Card', 'Other'].map((l) => pv(p2, l))),
            v('Tip'),
            'Σ tip by method',
          );
          const other = (await staffList()).rows.find((r) => r.name !== name);
          if (other) {
            await selectStaffRow(other.name);
            await selectStaffRow(name);
            expect(await tipTriggerState()).toBe('closed');
          }
        },
      );
    },
  );

  it(
    title(
      'Pay 1 + Pay 2 = Total Income for 2 staff × Today / This Week / This Month (RPT-123)',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context) {
      this.timeout(6 * 60_000);
      const names = await testStaff();
      if (names.length === 0) this.skip();
      const t = dayStart(0);
      const monday = dayStart(-((t.getDay() + 6) % 7));
      const ranges: [string, ReturnType<typeof rangeOffset>][] = [
        ['Today', rangeOffset(0)],
        ['This Week', rangeDates(monday, t)],
        ['This Month', rangeDates(new Date(t.getFullYear(), t.getMonth(), 1), t)],
      ];
      let checked = 0;
      for (const name of names) {
        for (const [label, r] of ranges) {
          await step(`${name} — ${label}`, async () => {
            await openStaffIncome(r);
            if (!(await ensureStaffRow(name))) return;
            await selectStaffRow(name);
            const P = (await staffDetail()).pairs;
            if (!hasPair(P, 'Pay 1')) return;
            const [tot, a, b] = ['Total Income', 'Pay 1', 'Pay 2'].map((l) => pv(P, l));
            ensureCents((a ?? 0) + (b ?? 0), tot ?? Number.NaN, `${name} ${label}: Pay 1 + Pay 2`);
            checked += 1;
          });
        }
      }
      ensure(checked > 0, 'No staff/range showed Pay 1 / Pay 2 to check');
    },
  );

  it(
    title(
      "A staff's Orders equals the distinct order codes (refund-only orders included) of the detail table",
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      const name = await firstStaff(this);
      const got = await staffIncomeDetailFor(name, rangeOffset(0));
      ensure(got !== null, `${name} not found in today's Staff Income`);
      const codes = new Set(got.detail.rows.map((r) => r.order));
      expect(got.listRow.orders).toBe(codes.size);
      await browser.keys([Key.Escape]);
    },
  );
});
