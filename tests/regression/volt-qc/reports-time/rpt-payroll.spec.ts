/**
 * volt-qc port — Staff Payroll (V1 `/incomes/staff-payroll`) and its match with
 * Staff Income, read-only.
 *
 * Source: volt-qc `e2e/tests/10-reports/rpt-plan-payroll.spec.ts` — RPT-T27a-c,
 * T28a-b, T29a-b — and `rpt-plan-data.spec.ts` RPT-T48b (`@readonly`).
 *
 * Nothing is locked or saved. The Current Period vs Staff Income comparisons
 * are retried up to three times because a shared till keeps adding orders.
 */

import { expect } from '@wdio/globals';
import { RptCss, RptText } from '../../../../src/constants/testids.voltqc-reports-time.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  cents,
  dayStart,
  daysBetween,
  fillInput,
  fmtDate,
  hasText,
  paneText,
  pv,
  rangeDates,
  readGrid,
  readPairs,
  searchParam,
  sum,
  type Pair,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  choosePeriod,
  hasNoIncomeToggle,
  hasStaffSearch,
  headName,
  openPayroll,
  openStaffIncome,
  parsePeriod,
  payrollPeriods,
  selectStaffRow,
  setNoIncomeToggle,
  staffList,
  staffSearchBox,
  waitStaffRow,
  waitStaffRows,
  workingDaysLine,
  type PayrollPeriods,
  type StaffRow,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, ensureCents, ensureEqual, note, testStaff } from './reports-time.helpers.js';

const R = RptCss.rightPane;

const COMPARE_LABELS = [
  'Sale',
  'Refund',
  'Subtotal',
  'Supply Fee',
  'Staff Commission',
  'Card Charge Commission',
  'Clean Up Fee/Deduction',
  'Tip',
  'Card Charge Tip',
  'Discount Charge',
  'Total Income',
  'Pay 1',
  'Pay 2',
];

async function currentPeriod(): Promise<PayrollPeriods & { cur: { from: Date; to: Date } }> {
  await openPayroll();
  const p = await payrollPeriods();
  const cur = parsePeriod(p.current);
  ensure(cur !== null, `Current period not readable: "${p.current}"`);
  return { ...p, cur };
}

async function detailPairs(name: string): Promise<Pair[]> {
  await selectStaffRow(name);
  return readPairs(R);
}

const rowsKey = (rows: StaffRow[]): string =>
  rows
    .map(
      (r) =>
        `${r.name}|${String(r.orders)}|${String(r.subtotal)}|${String(r.supply)}|${String(r.tip)}|${String(r.total)}`,
    )
    .sort()
    .join('\n');

/** RPT-144: Working Days + the per-day table of the open payroll detail. */
async function checkDaily(pairs: Pair[]): Promise<void> {
  const wd = await workingDaysLine();
  const g = await readGrid(R);
  if (!wd || g.rows.length === 0) {
    note('RPT-144: Current Period has no working day yet (or salary view) — per-day table not checked');
    return;
  }
  expect(g.headers.map(headName)).toEqual(['Date', 'Sale', 'Refund', 'Supply Fee', 'Tip']);
  const n = Number(/\d+/.exec(wd)?.[0] ?? 'NaN');
  if (n !== g.rows.length) note(`RPT-144: Working Days ${String(n)} ≠ ${String(g.rows.length)} per-day rows`);
  expect(wd).toBe(n === 1 ? 'Working Days: 1 day' : `Working Days: ${String(n)} days`);
  const col = (i: number): number[] => g.rows.map((r) => cents(r.cells[i]));
  ensureCents(sum(col(1)), pv(pairs, 'Sale'), 'Σ per-day Sale');
  ensureCents(sum(col(3)), pv(pairs, 'Supply Fee'), 'Σ per-day Supply Fee');
  ensureCents(sum(col(4)), pv(pairs, 'Tip'), 'Σ per-day Tip');
  ensureCents(Math.abs(sum(col(2))), Math.abs(pv(pairs, 'Refund')), 'Σ per-day Refund');
  for (const r of g.rows) expect(r.cells[0]).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const key = (s: string): number => {
    const [m, d] = s.split(' ');
    return MON.indexOf(m ?? '') * 100 + Number(d);
  };
  const keys = g.rows.map((r) => key(r.cells[0] ?? ''));
  const wraps = keys.some((k, i) => i > 0 && k < (keys[i - 1] ?? 0) && (keys[i - 1] ?? 0) >= 1100);
  if (!wraps)
    for (let i = 1; i < keys.length; i += 1)
      ensure((keys[i] ?? 0) > (keys[i - 1] ?? 0), 'Per-day rows are not ascending');
}

describe('volt-qc RPT — Staff Payroll: periods (read-only)', () => {
  it(
    title('Default is "Current Period (… - today)", with no $0-staff toggle (RPT-135)', Tag.REGRESSION),
    async () => {
      const p = await currentPeriod();
      expect(p.current).toMatch(
        /^Current Period \([A-Z][a-z]{2} \d{1,2}, \d{4} - [A-Z][a-z]{2} \d{1,2}, \d{4}\)$/,
      );
      expect(fmtDate(p.cur.to, 'MMM d, yyyy')).toBe(fmtDate(dayStart(0), 'MMM d, yyyy'));
      expect(await hasNoIncomeToggle()).toBe(false);
      expect(await hasText(RptCss.leftPane, RptText.showNoIncome)).toBe(false);
    },
  );

  it(
    title('Periods are contiguous: no overlap, no gap', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      const p = await currentPeriod();
      const periods = p.options.map((o) => ({ label: o, r: parsePeriod(o) }));
      ensure(
        periods.every((x) => x.r !== null),
        `Period labels: ${p.options.join(' | ')}`,
      );
      if (periods.length < 2) {
        note('Staff Payroll: no locked period yet');
        this.skip();
      }
      for (let i = 1; i < periods.length; i += 1) {
        const newer = periods[i - 1]?.r;
        const older = periods[i]?.r;
        ensure(!!newer && !!older, 'period parse');
        ensure(
          daysBetween(older.to, newer.from) === 1,
          `"${periods[i]?.label ?? ''}" → "${periods[i - 1]?.label ?? ''}" are not adjacent`,
        );
      }
      const lens = periods.slice(1).map((x) => (x.r ? daysBetween(x.r.from, x.r.to) + 1 : 0));
      note(`${String(periods.length - 1)} locked periods; lengths ${[...new Set(lens)].join('/')} days`);
    },
  );

  it(
    title(
      'Switching from Current to a locked period keeps the staff, shows the locked range, drops "Estimated" (RPT-138)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      const [name] = await testStaff();
      const p = await currentPeriod();
      const locked = p.options[1];
      if (name === undefined || locked === undefined) {
        note('RPT-138: no test staff or no locked period');
        this.skip();
      }
      ensure((await waitStaffRow(name)) !== null, `${name} not in Current Period`);
      await selectStaffRow(name);
      expect(await hasText(R, RptText.estimated)).toBe(true);
      await choosePeriod(locked);
      if (await hasText(R, RptText.noDetail)) {
        note(`RPT-138: ${name} is not in the latest locked period`);
        this.skip();
      }
      const r = parsePeriod(locked);
      ensure(r !== null, `Unparsable period "${locked}"`);
      const text = await paneText(R);
      ensure(text.includes(name), `Detail no longer shows ${name}`);
      expect(text).toContain(`(${fmtDate(r.from, 'MM/dd/yyyy')} - ${fmtDate(r.to, 'MM/dd/yyyy')})`);
      expect(await hasText(R, RptText.estimated)).toBe(false);
    },
  );

  it(
    title(
      'More than 10 locked periods: the list scrolls and the oldest can be picked (RPT-136)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await openPayroll();
      const p = await payrollPeriods();
      if (p.options.length <= 11) {
        note(`RPT-136: only ${String(p.options.length - 1)} locked periods (needs > 10)`);
        this.skip();
      }
      ensure(p.scroll !== null, 'The period list has no scroll container');
      ensure(p.scroll.scrollHeight > p.scroll.clientHeight, 'The period list does not overflow');
      expect(p.options[0]).toMatch(/^Current Period/);
      const before = await searchParam('periodId');
      const oldest = p.options[p.options.length - 1] ?? '';
      await choosePeriod(oldest);
      expect(await searchParam('periodId')).not.toBe(before);
    },
  );
});

describe('volt-qc RPT — Staff Payroll ↔ Staff Income (read-only)', () => {
  it(
    title(
      'Current Period list = Staff Income over the same range ($0 staff shown) (RPT-139)',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context) {
      this.timeout(6 * 60_000);
      const { cur } = await currentPeriod();
      let pay = await staffList();
      let inc = pay;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await openPayroll();
        await waitStaffRows(60_000);
        pay = await staffList();
        await openStaffIncome(rangeDates(cur.from, dayStart(0)));
        await setNoIncomeToggle(true);
        await waitStaffRows(60_000);
        inc = await staffList();
        if (rowsKey(pay.rows) === rowsKey(inc.rows)) break;
        note(`RPT-139 attempt ${String(attempt + 1)}: lists differ (new orders?) — reading again`);
      }
      ensureEqual(rowsKey(pay.rows), rowsKey(inc.rows), 'Payroll Current rows vs Staff Income rows');
      ensureEqual(pay.summary, inc.summary, 'Payroll Current summary vs Staff Income summary');
    },
  );

  it(
    title('Payroll search: case/space-insensitive; figures = Σ visible rows (RPT-142)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      const [name] = await testStaff();
      await openPayroll();
      if (name === undefined || !(await hasStaffSearch())) {
        note('RPT-142: no test staff, or no "Search staff" box on Staff Payroll');
        this.skip();
      }
      await waitStaffRows(60_000);
      const all = await staffList();
      const check = async (q: string, rowsOk: (rows: StaffRow[]) => void): Promise<boolean> => {
        await fillInput(await staffSearchBox(), q);
        await settle(500);
        const l = await staffList();
        rowsOk(l.rows);
        expect(l.summary.totalStaff).toBe(l.rows.length);
        expect(l.summary.totalOrders).toBe(sum(l.rows.map((r) => r.orders)));
        ensureCents(
          l.summary.totalStaffIncome,
          sum(l.rows.map((r) => r.total)),
          `Search "${q}": Total staff income`,
        );
        return l.noResults;
      };
      const frag = name.slice(0, 2).toLowerCase();
      await check(frag, (rows) => {
        ensure(rows.length > 0, `Search "${frag}" listed nothing`);
        for (const r of rows) expect(r.name.toLowerCase()).toContain(frag);
      });
      await fillInput(await staffSearchBox(), '');
      await settle(500);
      expect((await staffList()).rows.length).toBe(all.rows.length);
      expect(await check('zzzz', (rows) => expect(rows).toHaveLength(0))).toBe(true);
      await check(`  ${name.toLowerCase()}  `, (rows) => expect(rows.map((r) => r.name)).toContain(name));
    },
  );

  it(
    title(
      'Current Period detail = Staff Income over the same range; "Estimated"; per-day table adds up (RPT-143, RPT-144, RPT-177)',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context) {
      this.timeout(8 * 60_000);
      const { cur } = await currentPeriod();
      const names = [...(await testStaff())];
      await openPayroll();
      await waitStaffRows(60_000);
      const third = (await staffList()).rows.find((r) => !names.includes(r.name) && r.orders > 0);
      if (third) names.push(third.name);
      if (names.length === 0) this.skip();

      for (const [i, name] of names.entries()) {
        await step(`${name}: Payroll Current vs Staff Income`, async () => {
          let pay: Pair[] = [];
          let inc: Pair[] = [];
          let common: string[] = [];
          const pick = (P: Pair[]): string[] => common.map((l) => `${l}=${String(pv(P, l))}`);
          for (let attempt = 0; attempt < 3; attempt += 1) {
            await openPayroll();
            ensure((await waitStaffRow(name)) !== null, `${name} not in Payroll Current`);
            pay = await detailPairs(name);
            expect(await hasText(R, RptText.estimated)).toBe(true);
            if (i === 0 && attempt === 0) await checkDaily(pay);
            await openStaffIncome(rangeDates(cur.from, dayStart(0)));
            await setNoIncomeToggle(true);
            ensure((await waitStaffRow(name)) !== null, `${name} not in Staff Income`);
            inc = await detailPairs(name);
            common = COMPARE_LABELS.filter(
              (l) => pay.some((p) => p.label === l) && inc.some((p) => p.label === l),
            );
            if (JSON.stringify(pick(pay)) === JSON.stringify(pick(inc))) break;
          }
          ensure(common.length > 2, `${name}: Payroll and Staff Income share no detail labels`);
          ensureEqual(pick(pay), pick(inc), `${name}: Payroll vs Staff Income detail`);
        });
      }
    },
  );

  it(
    title(
      "Every staff's Tip in Payroll Current = Staff Income; locked period Pay 1 + Pay 2 = Total Income = list (RPT-145, RPT-150)",
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context) {
      this.timeout(6 * 60_000);
      const p = await currentPeriod();

      await step('RPT-150 Tip per staff (Current) = Staff Income over the same range', async () => {
        let diff: string[] = [];
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await openStaffIncome(rangeDates(p.cur.from, dayStart(0)));
          await waitStaffRows(60_000);
          const inc = (await staffList()).rows.filter((r) => r.tip > 0);
          await openPayroll();
          await waitStaffRows(60_000);
          const pay = new Map((await staffList()).rows.map((r) => [r.name, r.tip]));
          diff = inc
            .filter((r) => pay.get(r.name) !== r.tip)
            .map((r) => `${r.name}: income ${String(r.tip)} / payroll ${String(pay.get(r.name))}`);
          if (diff.length === 0) break;
        }
        ensureEqual(diff, [], 'Tip mismatches (cents)');
      });

      await step('RPT-145 latest locked period', async () => {
        const locked = p.options[1];
        if (locked === undefined) {
          note('RPT-145: no locked period yet');
          return;
        }
        await openPayroll();
        await choosePeriod(locked);
        const rows = (await staffList()).rows.filter((r) => r.total !== 0);
        if (rows.length === 0) {
          note('RPT-145: the locked period has no staff with income');
          return;
        }
        const [first] = await testStaff();
        const r = rows.find((x) => x.name === first) ?? rows[0];
        ensure(r !== undefined, 'no row');
        const P = await detailPairs(r.name);
        const [t, a, b] = ['Total Income', 'Pay 1', 'Pay 2'].map((l) => pv(P, l));
        ensureCents((a ?? 0) + (b ?? 0), t ?? Number.NaN, `${r.name}: Pay 1 + Pay 2`);
        ensureCents(t ?? Number.NaN, r.total, `${r.name}: detail Total Income vs list`);
      });
    },
  );
});
