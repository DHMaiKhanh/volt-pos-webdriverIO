/**
 * volt-qc port — Income Summary (V1 `/incomes/income-summary`), read-only.
 *
 * Source: volt-qc `e2e/tests/10-reports/rpt-plan-summary.spec.ts` — RPT-T13a-d,
 * T14, T15a-c, T16a-c (`@readonly`). Detail-panel cases read YESTERDAY so the
 * shared till's new orders cannot move the figures mid-read.
 *
 * Known issue carried over from volt-qc (bug #25, docs/bugs-found-dev.md):
 * the % pill does not always equal |(c−p)/p| — RPT-069 has its own `it()` so
 * that defect cannot mask RPT-066/067.
 */

import { expect } from '@wdio/globals';
import { browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import {
  DATE_PRESETS,
  RptCss,
  RptRoutes,
  RptText,
  SUMMARY_COMPARISON,
} from '../../../../src/constants/testids.voltqc-reports-time.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  choosePreset,
  clickIn,
  clickOption,
  comboOptions,
  comboText,
  countCss,
  dayStart,
  daysBetween,
  detailIdOf,
  fmtDate,
  hasText,
  openReport,
  parseMonDate,
  pv,
  rangeDates,
  rangeOffset,
  searchParam,
  sum,
  waitNoSkeleton,
  ymd,
  type Pair,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  calendarOpen,
  clickCalendarDay,
  clickPoint,
  clickPopoverButton,
  clickRow,
  clickTab,
  detailFontWeights,
  openSummary,
  printButtonState,
  summaryBars,
  summaryCollapseBox,
  summaryDetail,
  summaryState,
  tabActive,
  type SummaryRow,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { check, ensure, ensureCents, ensureEqual, note } from './reports-time.helpers.js';

const L = RptCss.leftPane;
const R = RptCss.rightPane;

const colSum = (rows: SummaryRow[]): { sale: number; tip: number; tax: number; total: number } => ({
  sale: sum(rows.map((r) => r.sale)),
  tip: sum(rows.map((r) => r.tip)),
  tax: sum(rows.map((r) => r.tax)),
  total: sum(rows.map((r) => r.total)),
});

const rightH2 = async (): Promise<string> =>
  browser.execute(function (right: string) {
    const h = document.querySelector<HTMLElement>(`${right} h2`);
    return (h?.innerText ?? '').trim();
  }, R);

/** Pick a year in the left pane's first combobox (Week / Month tabs). */
async function chooseYear(year: number): Promise<void> {
  await clickIn(L, RptCss.combobox);
  await clickOption(String(year));
  await settle(400);
  await waitNoSkeleton(L).catch(() => undefined);
}

describe('volt-qc RPT — Income Summary: filters & grouping (read-only)', () => {
  it(
    title(
      'Default: Day tab, Today, "Total Income <date>" heading, % pill, legend, empty detail panel (RPT-057)',
      Tag.REGRESSION,
    ),
    async () => {
      await openReport(RptRoutes.summary);
      await waitNoSkeleton(L, 30_000);
      expect(await tabActive('Day')).toBe(true);
      const s = await summaryState();
      expect(s.preset).toBe('Today');
      expect(s.heading).toBe(`Total Income ${fmtDate(dayStart(0), 'MMM dd, yyyy')}`);
      expect(s.pctText).toMatch(/^\d+\.\d{2}%$/);
      expect(s.comparison).toBe('vs. Same day last week');
      expect(s.rows).toHaveLength(1);
      for (const l of ['Gross Income', 'Net Income', 'Total tip']) expect(await hasText(L, l)).toBe(true);
      expect(await hasText(R, RptText.noDetail)).toBe(true);
      expect(await hasText(R, RptText.summaryNoDetailHint)).toBe(true);
      expect((await printButtonState()).present).toBe(false);
    },
  );

  it(
    title(
      'The 10 presets in order, each with its comparison label; Last 7 Days = 7 rows (RPT-058)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);
      await openSummary(rangeOffset(0));
      expect(await comboOptions(L)).toEqual([...DATE_PRESETS]);
      for (const p of DATE_PRESETS) {
        await step(p, async () => {
          await choosePreset(L, p);
          await waitNoSkeleton(L, 30_000);
          const s = await summaryState();
          // A preset can coincide with another (Monday: This Week = Today) — compare by what the combobox shows.
          if (s.preset !== p) note(`RPT-058: chose "${p}", combobox shows "${s.preset}" (same range)`);
          expect(s.comparison).toBe(`vs. ${SUMMARY_COMPARISON[s.preset] ?? '?'}`);
          if (p === 'Last 7 Days') expect(s.rows).toHaveLength(7);
        });
      }
    },
  );

  it(
    title(
      'Custom range via the calendar: Apply applies, Cancel keeps, Today, a 7-day range becomes Last 7 Days (RPT-059, RPT-060)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      const t = dayStart(0);
      const prev25 = new Date(t.getFullYear(), t.getMonth() - 1, 25);
      const d1 = new Date(prev25.getFullYear(), prev25.getMonth(), 1);
      const d5 = new Date(prev25.getFullYear(), prev25.getMonth(), 5);
      await openSummary(rangeDates(prev25, prev25));

      await step('RPT-059 two days picked → table unchanged until Apply → Custom, 5 rows', async () => {
        const before = await summaryState();
        await clickIn(L, RptCss.dateRange);
        await clickCalendarDay(d1);
        await clickCalendarDay(d5);
        ensureEqual((await summaryState()).rows, before.rows, 'Rows before Apply');
        await clickPopoverButton('Apply');
        await waitNoSkeleton(L, 30_000);
        const s = await summaryState();
        expect(s.rangeText).toContain(`${fmtDate(d1, 'MM/dd/yyyy')} - ${fmtDate(d5, 'MM/dd/yyyy')}`);
        expect(s.preset).toBe('Custom');
        expect(s.comparison).toBe('vs. Previous period');
        expect(s.rows).toHaveLength(5);
      });

      await step(
        'RPT-060 Cancel keeps the range; Today applies at once; 7 days to today → Last 7 Days',
        async () => {
          const keep = (await summaryState()).rangeText;
          await clickIn(L, RptCss.dateRange);
          await clickCalendarDay(new Date(d1.getFullYear(), d1.getMonth(), 10));
          await clickCalendarDay(new Date(d1.getFullYear(), d1.getMonth(), 12));
          await clickPopoverButton('Cancel');
          expect((await summaryState()).rangeText).toBe(keep);

          await clickIn(L, RptCss.dateRange);
          await clickPopoverButton('Today');
          await browser.waitUntil(async () => !(await calendarOpen()), {
            timeout: Timeouts.SHORT,
            interval: 200,
          });
          await browser.waitUntil(async () => (await summaryState()).preset === 'Today', {
            timeout: Timeouts.MEDIUM,
            interval: 300,
          });

          const start = dayStart(-6);
          if (start.getMonth() !== t.getMonth()) {
            note('RPT-060: 6 days ago is last month (not on the left calendar) — 7-day pick skipped');
            return;
          }
          await clickIn(L, RptCss.dateRange);
          await clickCalendarDay(start);
          await clickPopoverButton('Apply');
          await browser.waitUntil(async () => (await summaryState()).preset === 'Last 7 Days', {
            timeout: Timeouts.MEDIUM,
            interval: 300,
            timeoutMsg: 'A 7-day range ending today was not recognised as Last 7 Days',
          });
        },
      );
    },
  );

  it(title('This Month lists one row per day up to today (RPT-061)', Tag.REGRESSION), async () => {
    const t = dayStart(0);
    await openSummary(rangeDates(new Date(t.getFullYear(), t.getMonth(), 1), t));
    const s = await summaryState();
    expect(s.preset).toBe('This Month');
    expect(s.rows).toHaveLength(t.getDate());
    expect(s.rows[s.rows.length - 1]?.date).toBe(fmtDate(t, 'MMM d'));
  });

  it(
    title(
      'Week / Month / Day tabs: current year, 2025, back to Day = Last 30 Days (RPT-062, RPT-063, RPT-064, RPT-065)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);
      const t = dayStart(0);
      await openSummary(rangeOffset(0));

      await step('RPT-062 Week: this year, first row from Jan 1, last row up to today', async () => {
        await clickTab('Week');
        expect(await comboText(L)).toBe(String(t.getFullYear()));
        const s = await summaryState();
        expect(s.rows[0]?.date).toMatch(/^Week \d+ \(Jan 1/);
        expect(s.rows[s.rows.length - 1]?.date).toContain(fmtDate(t, 'MMM d, yyyy'));
      });

      await step('RPT-063 Week 2025: 53 rows, the last (Dec 29 - Dec 31, 2025)', async () => {
        await chooseYear(2025);
        const s = await summaryState();
        expect(s.rows).toHaveLength(53);
        expect(s.rows[s.rows.length - 1]?.date).toContain('(Dec 29 - Dec 31, 2025)');
        const labels = s.rows.map((r) => r.date.split(' (')[0]);
        const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
        if (dup.length) note(`RPT-063: duplicate week labels in 2025: ${[...new Set(dup)].join(', ')}`);
      });

      await step('RPT-064 Month: Jan → this month this year; 12 months in 2025', async () => {
        await clickTab('Month');
        await chooseYear(t.getFullYear());
        let s = await summaryState();
        expect(s.rows.map((r) => r.date)).toEqual(
          ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].slice(
            0,
            t.getMonth() + 1,
          ),
        );
        await chooseYear(2025);
        s = await summaryState();
        expect(s.rows).toHaveLength(12);
      });

      await step(
        'RPT-065 Month with a selected row → Day: Last 30 Days, 30 rows, empty panel; Day again changes nothing',
        async () => {
          await clickRow(L, 0);
          await browser.waitUntil(async () => hasText(R, 'Payment Details'), {
            timeout: Timeouts.MEDIUM,
            interval: 250,
          });
          await clickTab('Day');
          const s = await summaryState();
          expect(s.preset).toBe('Last 30 Days');
          expect(s.rows).toHaveLength(30);
          expect(s.placeholder).toBe(true);
          const url = await browser.getUrl();
          await clickTab('Day');
          await settle(800);
          expect(await browser.getUrl()).toBe(url);
        },
      );
    },
  );
});

describe('volt-qc RPT — Income Summary: table & statistics (read-only)', () => {
  it(
    title(
      'Σ Sale = Total Income over 7 days; a range with empty days lists each day at $0.00 (RPT-066, RPT-067)',
      Tag.REGRESSION,
    ),
    async () => {
      await step('RPT-066 Custom 7 days ending yesterday', async () => {
        await openSummary(rangeOffset(-7, -1));
        const s = await summaryState();
        expect(s.rows).toHaveLength(7);
        ensureCents(sum(s.rows.map((r) => r.sale)), s.totalIncome, 'Σ Sale vs Total Income');
      });
      await step('RPT-067 range with no orders → one $0.00 row per day', async () => {
        await openSummary(rangeDates(ymd(2023, 12, 30), ymd(2024, 1, 2)));
        const s = await summaryState();
        expect(s.rows).toHaveLength(4);
        if (s.totalIncome !== 0) {
          note('RPT-067: the shop has orders 12/30/2023–01/02/2024 — $0 branch not applicable');
          return;
        }
        for (const r of s.rows) expect([r.sale, r.tip, r.tax, r.total]).toEqual([0, 0, 0, 0]);
      });
    },
  );

  it(
    title('The % pill = |(c−p)/p|×100 with 2 decimals, coloured by sign (RPT-069)', Tag.REGRESSION),
    async () => {
      await openSummary(rangeOffset(-14, -8));
      const p = (await summaryState()).totalIncome;
      await openSummary(rangeOffset(-7, -1));
      const s = await summaryState();
      const c = s.totalIncome;
      const pct = p === 0 ? (c === 0 ? 0 : c > 0 ? 100 : -100) : ((c - p) / p) * 100;
      ensure(
        s.pctText === `${Math.abs(pct).toFixed(2)}%`,
        `Pill "${s.pctText}" vs expected ${Math.abs(pct).toFixed(2)}% (c=${String(c)}, p=${String(p)}) — volt-qc bug #25`,
      );
      expect(s.positive).toBe(pct >= 0);
    },
  );

  it(
    title('2025 totals are equal grouped by Month / Week / Day (RPT-068)', Tag.REGRESSION, Tag.SLOW),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);
      const y = rangeDates(ymd(2025, 1, 1), ymd(2025, 12, 31));
      await openSummary({ ...y, groupBy: 'month' });
      const month = colSum((await summaryState()).rows);
      await openSummary({ ...y, groupBy: 'week' });
      const week = colSum((await summaryState()).rows);
      await openSummary({ ...y, groupBy: 'day' });
      const dayRows = (await summaryState()).rows;
      expect(dayRows).toHaveLength(365);
      ensureEqual(week, month, '2025 Σ by Week vs by Month');
      ensureEqual(colSum(dayRows), month, '2025 Σ by Day vs by Month');
    },
  );

  it(
    title(
      'Chart: ≤ 3 bars per period, a bar click selects nothing; a row opens its detail; changing range clears it; Week detail spans Mon–Sun (RPT-070, RPT-071, RPT-072)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      await step('RPT-070 chart bars', async () => {
        await openSummary(rangeOffset(-7, -1));
        let bars = await summaryBars();
        expect(bars.length).toBeLessThanOrEqual(21);
        expect(bars.length).toBeGreaterThan(0);
        await browser
          .waitUntil(async () => (bars = await summaryBars()).some((b) => b.h > 2 && b.w > 0), {
            timeout: 8_000,
            interval: 300,
          })
          .catch(() => undefined);
        const bar = bars.find((b) => b.h > 2 && b.w > 0);
        ensure(bar !== undefined, 'No chart bar with a height > 0');
        const url = await browser.getUrl();
        await clickPoint(bar.x, bar.y);
        expect(await browser.getUrl()).toBe(url);
        expect((await summaryState()).rows.some((r) => r.selected)).toBe(false);
      });

      await step(
        "RPT-071 today's row → selected, detailId, heading, Print, Show less; another preset → No detail",
        async () => {
          await openSummary(rangeOffset(0));
          await clickRow(L, 0);
          await browser.waitUntil(
            async () => (await searchParam('detailId')) === detailIdOf(rangeOffset(0)),
            {
              timeout: Timeouts.MEDIUM,
              interval: 250,
            },
          );
          expect((await summaryState()).rows[0]?.selected).toBe(true);
          await browser.waitUntil(async () => (await rightH2()) === fmtDate(dayStart(0), 'MMM dd, yyyy'), {
            timeout: Timeouts.MEDIUM,
            interval: 250,
          });
          expect((await printButtonState()).present).toBe(true);
          expect(await hasText(R, 'Show less', 'button, button *')).toBe(true);
          await choosePreset(L, 'Yesterday');
          await browser.waitUntil(async () => hasText(R, RptText.noDetail), {
            timeout: Timeouts.MEDIUM,
            interval: 250,
          });
        },
      );

      await step("RPT-072 Week: last week's row → Monday–Sunday heading, Total Payment = row", async () => {
        const t = dayStart(0);
        await openSummary({ ...rangeDates(new Date(t.getFullYear(), 0, 1), t), groupBy: 'week' });
        const s = await summaryState();
        if (s.rows.length < 2) {
          note('RPT-072: the year has only one week so far');
          return;
        }
        const n = s.rows.length - 2;
        const row = s.rows[n];
        ensure(row !== undefined, 'Previous-week row missing');
        await clickRow(L, n);
        await browser.waitUntil(async () => / - /.test(await rightH2()), {
          timeout: Timeouts.MEDIUM,
          interval: 250,
        });
        const heading = await rightH2();
        const m = /^([A-Z][a-z]{2} \d{2}, \d{4}) - ([A-Z][a-z]{2} \d{2}, \d{4})$/.exec(heading);
        ensure(m !== null, `Week detail heading "${heading}"`);
        const from = parseMonDate(m[1] ?? '');
        const to = parseMonDate(m[2] ?? '');
        ensure(from !== null && to !== null, `Unparsable heading "${heading}"`);
        expect(from.getDay()).toBe(1);
        expect(to.getDay()).toBe(0);
        expect(daysBetween(from, to)).toBe(6);
        const pairs = await summaryDetail(true);
        ensureCents(
          pv(pairs, 'Total Payment', { section: 'Payment Details' }),
          row.total,
          'Week detail Total Payment vs row',
        );
      });
    },
  );
});

describe('volt-qc RPT — Income Summary: detail panel (read-only, yesterday)', () => {
  const PD = { section: 'Payment Details' };
  const SD = { section: 'Sale Details' };
  const SF = { section: 'Supply Fee' };
  const SP = { section: 'Staff Payout' };
  const SE = { section: 'Salon Earnings' };
  const abs = Math.abs;

  async function detailYesterday(ctx: Mocha.Context): Promise<{ pairs: Pair[]; row: SummaryRow }> {
    const r = rangeOffset(-1);
    await openSummary({ ...r, detailId: detailIdOf(r) });
    const pairs = await summaryDetail(true).catch(() => null);
    const row = (await summaryState()).rows[0];
    if (pairs === null || row === undefined) {
      note('Income Summary: yesterday has no revenue — detail cases have nothing to check');
      ctx.skip();
    }
    return { pairs, row };
  }

  it(
    title(
      'Detail loads past the $0.00 placeholder, row = detail, Show less / Show more keeps Salon Earnings (RPT-073, RPT-074, RPT-075)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      // RPT-074: summaryDetail(true) polls until Total Payment is no longer the $0.00 placeholder.
      const { pairs, row } = await detailYesterday(this);
      expect(pv(pairs, 'Total Payment', PD)).not.toBe(0);

      await check('RPT-075 Tip / Tax / Total Payment of the row = detail', () => {
        ensureCents(pv(pairs, 'Tip', SD), row.tip, 'Sale Details Tip vs row Tip');
        ensureCents(pv(pairs, 'Tax Collected', SD), row.tax, 'Sale Details Tax vs row Tax');
        ensureCents(pv(pairs, 'Tax Collected', SE), row.tax, 'Salon Earnings Tax vs row Tax');
        ensureCents(pv(pairs, 'Total Payment', PD), row.total, 'Payment Details Total Payment vs row Total');
      });

      await step(
        'RPT-073 Show less collapses the 4 upper blocks, Salon Earnings stays; Show more reopens',
        async () => {
          await clickIn(R, './/button[normalize-space(.)="Show less"]');
          await browser.waitUntil(async () => ((await summaryCollapseBox())?.wrapH ?? 999) <= 40, {
            timeout: Timeouts.SHORT,
            interval: 200,
          });
          const collapsed = await summaryCollapseBox();
          ensure(collapsed !== null, 'Detail blocks not found');
          expect(collapsed.staffPayoutHidden).toBe(true);
          expect(collapsed.salonVisible).toBe(true);
          await clickIn(R, './/button[normalize-space(.)="Show more"]');
          await browser.waitUntil(async () => ((await summaryCollapseBox())?.wrapH ?? 0) > 200, {
            timeout: Timeouts.SHORT,
            interval: 200,
          });
          expect((await summaryCollapseBox())?.staffPayoutHidden).toBe(false);
        },
      );
    },
  );

  it(
    title(
      'Payment Details & Sale Details group formulas; Service Fee and Cash Discount are separate lines (RPT-076, RPT-077, RPT-085)',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context) {
      const { pairs } = await detailYesterday(this);

      await check(
        'RPT-076 each method = Sale + Refund + Tip + Tax; Cash+Card+Others = Amount Collected; + GC = Total Payment',
        () => {
          for (const g of ['Cash', 'Card', 'Others']) {
            const total = pv(pairs, g, { ...PD, group: '' });
            const parts = ['Sale', 'Refund', 'Tip', 'Tax'].map((l) => pv(pairs, l, { ...PD, group: g }));
            ensureCents(total, sum(parts), `Payment group ${g}`);
          }
          const gc = pv(pairs, 'Gift Card Redemption', { ...PD, group: '' });
          ensureCents(
            gc,
            sum(['Sale', 'Tip', 'Tax'].map((l) => pv(pairs, l, { ...PD, group: 'Gift Card Redemption' }))),
            'Gift Card Redemption',
          );
          const ac = pv(pairs, 'Amount Collected', PD);
          ensureCents(
            ac,
            pv(pairs, 'Cash', { ...PD, group: '' }) +
              pv(pairs, 'Card', { ...PD, group: '' }) +
              pv(pairs, 'Others', { ...PD, group: '' }),
            'Amount Collected',
          );
          ensureCents(pv(pairs, 'Total Payment', PD), ac + gc, 'Payment Details Total Payment');
        },
      );

      await check(
        'RPT-077 / RPT-085 Sale Details: Total Sale, Subtotal, Total Discount, Net Total (+SF −CD), Total Payment',
        () => {
          const g = (l: string, group = ''): number => pv(pairs, l, { ...SD, group });
          ensureCents(
            g('Total Sale'),
            g('Service Sale', 'Total Sale') +
              g('Product Sale', 'Total Sale') +
              g('Gift Card Sale', 'Total Sale'),
            'Total Sale',
          );
          ensureCents(
            abs(g('Total Refund')),
            abs(g('Service Refund', 'Total Refund')) + abs(g('Product Refund', 'Total Refund')),
            'Total Refund',
          );
          ensureCents(g('Subtotal'), g('Total Sale') - abs(g('Total Refund')), 'Subtotal');
          ensureCents(
            abs(g('Total Discount')),
            abs(g('Discount', 'Total Discount')) - abs(g('Discount Reversed', 'Total Discount')),
            'Total Discount',
          );
          const sf = g('Service Fee');
          const cd = g('Cash Discount');
          ensure(sf >= 0, `Service Fee ${String(sf)} < 0`);
          ensure(cd >= 0, `Cash Discount ${String(cd)} < 0`);
          ensureCents(g('Net Total'), g('Subtotal') - abs(g('Total Discount')) + sf - abs(cd), 'Net Total');
          ensureCents(
            g('Total Payment'),
            g('Net Total') + g('Tip') + g('Tax Collected'),
            'Sale Details Total Payment',
          );
        },
      );
    },
  );

  it(
    title(
      'Supply Fee, Staff Payout, Salon Earnings formulas; block titles and total rows are bold (RPT-078, RPT-079, RPT-080, RPT-086)',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context) {
      const { pairs } = await detailYesterday(this);

      await check(
        'RPT-078 Total supply fee = Staff + Salon Supply Share; Staff Supply Share equal in both blocks',
        () => {
          ensureCents(
            pv(pairs, 'Total supply fee', SF),
            pv(pairs, 'Staff Supply Share', SF) + pv(pairs, 'Salon Supply Share', SF),
            'Total supply fee',
          );
          ensureCents(
            pv(pairs, 'Staff Supply Share', SF),
            pv(pairs, 'Staff Supply Share', SP),
            'Staff Supply Share (Supply Fee vs Staff Payout)',
          );
        },
      );
      await check('RPT-079 Pay 1 + Pay 2 = Total Staff Payout', () => {
        ensureCents(
          pv(pairs, 'Pay 1', { ...SP, group: 'Total Staff Payout' }) +
            pv(pairs, 'Pay 2', { ...SP, group: 'Total Staff Payout' }),
          pv(pairs, 'Total Staff Payout', { ...SP, group: '' }),
          'Pay 1 + Pay 2',
        );
      });
      await check('RPT-080 Salon Earnings: Total Earnings formula; copied lines equal their source', () => {
        const e = (l: string, group = ''): number => pv(pairs, l, { ...SE, group });
        const expected =
          e('Net Earnings') +
          e('Staff Supply Share') +
          e('Clean Up Fee') +
          e('Discount Charge') -
          e('Staff Salary') +
          e('Card Charge Commission') +
          e('Card Charge Tip');
        ensureCents(e('Total Earnings'), expected, 'Salon Earnings Total Earnings');
        const same: [string, { section: string; group?: string }][] = [
          ['Total Service', SP],
          ['Salon Supply Share', SF],
          ['Product Sale', { ...SD, group: 'Total Sale' }],
          ['Staff Supply Share', SP],
          ['Clean Up Fee', SP],
          ['Discount Charge', SP],
          ['Card Charge Commission', SP],
          ['Card Charge Tip', SP],
          ['Staff Salary', SP],
          ['Tax Collected', SD],
        ];
        for (const [l, src] of same)
          ensureCents(abs(e(l)), abs(pv(pairs, l, src)), `Salon Earnings "${l}" vs source`);
      });
      await step('RPT-086 block titles and total rows are bold (≥ 600)', async () => {
        const w = await detailFontWeights();
        for (const h of ['Payment Details', 'Sale Details', 'Supply Fee', 'Staff Payout', 'Salon Earnings']) {
          ensure((w[`h3:${h}`] ?? 0) >= 600, `Title "${h}" weight ${String(w[`h3:${h}`])}`);
        }
        for (const r of [
          'Amount Collected',
          'Total Payment',
          'Subtotal',
          'Net Total',
          'Staff Commission',
          'Net Earnings',
          'Total Earnings',
        ]) {
          ensure((w[`row:${r}`] ?? 0) >= 600, `Row "${r}" weight ${String(w[`row:${r}`])}`);
        }
      });
      expect(await countCss(R, RptCss.skeleton)).toBe(0);
    },
  );
});
