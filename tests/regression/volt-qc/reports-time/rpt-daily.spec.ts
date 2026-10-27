/**
 * volt-qc port — Daily Sale Report (V1 `/incomes/income-daily`), read-only.
 *
 * Source: volt-qc `e2e/tests/10-reports/rpt-plan-daily.spec.ts` — RPT-T06,
 * T07, T08, T08c (`@readonly`). T08b (the hourly chart hovered column
 * by column for its tooltip) is not ported: it needs pixel-exact pointer hovers
 * over recharts, which the WebView2 driver does not deliver reliably.
 *
 * Shared till: the invariants compare the screen with itself (cards ↔ detail
 * ↔ table) on PAST days, so new orders arriving meanwhile cannot break them.
 */

import { expect } from '@wdio/globals';
import { browser } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import {
  DAILY_CARD_DESCRIPTIONS,
  DAILY_CARDS,
  RptCss,
  RptRoutes,
  RptText,
} from '../../../../src/constants/testids.voltqc-reports-time.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  clickIn,
  countCss,
  countText,
  dayStart,
  fmtDate,
  hasText,
  openReport,
  rangeDates,
  searchParam,
  sum,
  waitNoSkeleton,
  ymd,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  calendarDayDisabled,
  calendarDayExists,
  calendarOpen,
  chartTicks,
  clickCalendarDay,
  clickDailyCard,
  clickRow,
  closeOrderDetails,
  dailyCardTitles,
  dailyRead,
  dailySnapshot,
  dateRangeText,
  leftH3,
  monthNavButtons,
  openDaily,
  printButtonState,
  todayButtonOutlined,
  waitOrderDetails,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { check, ensure, ensureCents, note } from './reports-time.helpers.js';

const rightH2 = async (): Promise<string> =>
  browser.execute(function (right: string) {
    const h = document.querySelector<HTMLElement>(`${right} h2`);
    return (h?.innerText ?? '').trim();
  }, RptCss.rightPane);

describe('volt-qc RPT — Daily Sale Report: UI & date (read-only)', () => {
  it(
    title(
      "Default view: Today, today's date, 4 cards in order with descriptions, card click switches the chart, skeleton clears (RPT-023, RPT-024, RPT-025, RPT-056)",
      Tag.REGRESSION,
    ),
    async () => {
      const today = dayStart(0);
      await openReport(RptRoutes.daily);

      await step('RPT-056 skeletons clear once data is loaded', async () => {
        await waitNoSkeleton(RptCss.main, 30_000);
        expect(await countCss(RptCss.main, RptCss.skeleton)).toBe(0);
      });

      await step("RPT-023 Today filled, today's date, heading, Print, default activeChart", async () => {
        expect(await todayButtonOutlined()).toBe(false);
        expect(await dateRangeText()).toContain(fmtDate(today, 'MM/dd/yyyy'));
        expect(await rightH2()).toBe(fmtDate(today, 'MMM dd, yyyy'));
        expect((await printButtonState()).present).toBe(true);
        expect((await searchParam('activeChart')) ?? 'sale').toBe('sale');
      });

      await step('RPT-024 card order, descriptions, % pill and "vs Yesterday"', async () => {
        expect(await dailyCardTitles()).toEqual([...DAILY_CARDS]);
        const s = await dailyRead();
        for (const c of DAILY_CARDS) {
          const card = s.cards[c];
          ensure(card !== undefined, `Card "${c}" missing`);
          expect(card.description).toBe(DAILY_CARD_DESCRIPTIONS[c]);
          ensure(Number.isFinite(card.pct), `Card "${c}" has no % pill`);
        }
        expect(await countText(RptCss.leftPane, 'vs Yesterday')).toBe(4);
      });

      await step(
        'RPT-025 clicking a card selects only it, retitles the chart and writes activeChart',
        async () => {
          const map: [string, string][] = [
            ['Total Order', 'totalOrder'],
            ['Total tip', 'totalTip'],
            ['Total Payment', 'totalPayment'],
            ['Sale', 'sale'],
          ];
          for (const [cardTitle, key] of map) {
            await clickDailyCard(cardTitle);
            await browser.waitUntil(
              async () => {
                const sel = Object.values((await dailyRead()).cards)
                  .filter((c) => c.selected)
                  .map((c) => c.title);
                return sel.length === 1 && sel[0] === cardTitle;
              },
              {
                timeout: Timeouts.MEDIUM,
                interval: 300,
                timeoutMsg: `Card "${cardTitle}" never became the only selected card`,
              },
            );
            expect(await leftH3()).toBe(cardTitle);
            expect(await searchParam('activeChart')).toBe(key);
          }
          const ticks = await chartTicks();
          if (ticks.length > 0) {
            expect(ticks[0]).toBe('12:00 AM');
            for (const t of ticks) expect(t).toMatch(/^\d{2}:00 (AM|PM)$/);
          } else note('Daily Sale: no x-axis ticks read (empty chart?)');
        },
      );
    },
  );

  it(
    title(
      'Pick another day, future days disabled, empty day state, row opens Order Details (RPT-026, RPT-027, RPT-028, RPT-030)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      await openDaily(0, 'totalTip');
      const today = dayStart(0);

      await step(
        'RPT-026 another day of this month → date + heading change, Today outlined; Today returns',
        async () => {
          if (today.getDate() === 1) {
            note('RPT-026: today is the 1st — no other day in the month to click without changing month');
            return;
          }
          const target = dayStart(-(today.getDate() - 1));
          await clickIn(RptCss.main, RptCss.dateRange);
          await clickCalendarDay(target);
          await browser.waitUntil(async () => !(await calendarOpen()), {
            timeout: Timeouts.SHORT,
            interval: 200,
          });
          expect(await dateRangeText()).toContain(fmtDate(target, 'MM/dd/yyyy'));
          await browser.waitUntil(async () => (await rightH2()) === fmtDate(target, 'MMM dd, yyyy'), {
            timeout: Timeouts.MEDIUM,
            interval: 250,
          });
          expect(await todayButtonOutlined()).toBe(true);
          expect(await searchParam('activeChart')).toBe('totalTip');
          await clickIn(RptCss.leftPane, './/button[normalize-space(.)="Today"]');
          await browser.waitUntil(
            async () => (await dateRangeText()).includes(fmtDate(today, 'MM/dd/yyyy')),
            {
              timeout: Timeouts.MEDIUM,
              interval: 250,
            },
          );
        },
      );

      await step('RPT-027 days after today are disabled and there is no month navigation', async () => {
        await clickIn(RptCss.main, RptCss.dateRange);
        const tomorrow = dayStart(1);
        if (await calendarDayExists(tomorrow)) expect(await calendarDayDisabled(tomorrow)).toBe(true);
        else note('RPT-027: tomorrow is not on the calendar (month end) — only the navigation check runs');
        expect(await monthNavButtons()).toBe(0);
        await browser.keys([Key.Escape]);
      });

      await step('RPT-028 a day without orders → empty states and $0 cards', async () => {
        await openDaily(rangeDates(ymd(2024, 1, 1), ymd(2024, 1, 1)));
        const s = await dailyRead();
        if ((s.cards['Total Order']?.value ?? 0) !== 0) {
          note('RPT-028: the shop has orders on 01/01/2024 — empty-day check not applicable');
          return;
        }
        expect(await hasText(RptCss.rightPane, RptText.noData)).toBe(true);
        expect(await hasText(RptCss.leftPane, RptText.noChartData)).toBe(true);
        expect(await hasText(RptCss.leftPane, RptText.tryDifferentDate)).toBe(true);
        for (const c of ['Sale', 'Total tip', 'Total Payment']) expect(s.cards[c]?.value).toBe(0);
      });

      await step('RPT-030 a row opens Order Details (orderId in URL); closing keeps the date', async () => {
        await openDaily(-1);
        const before = await searchParam('from');
        if (!(await clickRow(RptCss.rightPane, /OD\d{6}-\d{8}/))) {
          note('RPT-030: yesterday has no order rows to open');
          return;
        }
        expect(await waitOrderDetails(true)).toBe(true);
        await browser.waitUntil(async () => (await searchParam('orderId')) !== null, {
          timeout: Timeouts.MEDIUM,
          interval: 200,
        });
        await closeOrderDetails();
        expect(await waitOrderDetails(false)).toBe(true);
        expect(await searchParam('orderId')).toBeNull();
        expect(await searchParam('from')).toBe(before);
      });
    },
  );
});

describe('volt-qc RPT — Daily Sale Report: invariants (read-only, past days)', () => {
  it(
    title(
      'Yesterday: cards = Income/Payment Details, Amount Collected = Card+Cash+Others, each row Total = Sale+Tax+Tip (RPT-031, RPT-032, RPT-033, RPT-034, RPT-050)',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      const s = await dailySnapshot(-1);
      const d = s.detail;
      if (d === null) {
        note('Daily Sale: yesterday has no Income Details (no orders) — nothing to reconcile');
        this.skip();
      }
      const card = (t: string): number => s.cards[t]?.value ?? Number.NaN;

      await check('RPT-050 a day with payments is not shown as 0', () => {
        ensure(card('Total Order') > 0, `Total Order card is ${String(card('Total Order'))}`);
        ensure(card('Sale') > 0, `Sale card is ${String(card('Sale'))}`);
      });
      await check('RPT-031 cards match the detail panel', () => {
        ensureCents(card('Sale'), d.sale, 'Sale card vs Income Details Sale');
        ensureCents(card('Total tip'), d.tip, 'Total tip card vs Income Details Tip');
        ensureCents(
          card('Total Payment'),
          d.paymentTotal,
          'Total Payment card vs Payment Details Total Payment',
        );
      });
      await check(
        'RPT-032 Amount Collected = Card + Cash + Others; Total Payment = Amount Collected + GC Redemption',
        () => {
          ensureCents(d.amountCollected, d.card + d.cash + d.others, 'Amount Collected');
          ensureCents(d.paymentTotal, d.amountCollected + d.gcRedemption, 'Payment Details Total Payment');
          if (d.paymentTotal !== d.incomeTotal) {
            note(
              `Payment Details Total Payment ${String(d.paymentTotal)} ≠ Income Details Total Payment ${String(d.incomeTotal)}`,
            );
          }
        },
      );
      await check('RPT-033 Income Details: Sale + Tip + Tax Collected = Total Payment', () => {
        ensureCents(d.incomeTotal, d.sale + d.tip + d.tax, 'Income Details Total Payment');
      });
      await check('RPT-034 every row Total = Sale/Refund + Tax + Tip; Σ Tip = Total tip card', () => {
        ensure(s.rows.length > 0, 'Yesterday has no rows in the order table');
        for (const r of s.rows) ensureCents(r.total, r.sale + r.tax + r.tip, `Row ${r.order} Total`);
        ensureCents(sum(s.rows.map((r) => r.tip)), card('Total tip'), 'Σ row Tip vs Total tip card');
        const sSale = sum(s.rows.map((r) => r.sale));
        const sTotal = sum(s.rows.map((r) => r.total));
        if (sSale !== card('Sale'))
          note(`Σ Sale/Refund ${String(sSale)} vs Sale card ${String(card('Sale'))}`);
        if (sTotal !== card('Total Payment'))
          note(`Σ Total ${String(sTotal)} vs Total Payment ${String(card('Total Payment'))}`);
      });
    },
  );

  it(
    title(
      'The % pill vs the previous day is rounded to 0 digits, coloured by sign; 0 vs 0 → 0% green (RPT-036, RPT-037)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);
      await step('RPT-036 yesterday vs the day before', async () => {
        const p = (await dailySnapshot(-2)).cards['Sale']?.value ?? Number.NaN;
        const cur = await dailySnapshot(-1);
        const sale = cur.cards['Sale'];
        ensure(sale !== undefined && Number.isFinite(p), 'Sale card not readable');
        const c = sale.value;
        const expected = p === 0 ? (c === 0 ? 0 : 100) : Math.round(Math.abs(((c - p) / p) * 100));
        ensure(
          sale.pct === expected,
          `Sale pill ${String(sale.pct)}% vs expected ${String(expected)}% (c=${String(c)}, p=${String(p)})`,
        );
        const pct = p === 0 ? (c === 0 ? 0 : c > 0 ? 100 : -100) : ((c - p) / p) * 100;
        expect(sale.positive).toBe(pct >= 0);
      });

      await step('RPT-037 two consecutive empty days → 0% green', async () => {
        const s = await dailySnapshot(rangeDates(ymd(2024, 1, 1), ymd(2024, 1, 1)));
        const prev = await dailySnapshot(rangeDates(ymd(2023, 12, 31), ymd(2023, 12, 31)));
        if ((s.cards['Sale']?.value ?? 0) !== 0 || (prev.cards['Sale']?.value ?? 0) !== 0) {
          note('RPT-037: the shop has data on 12/31/2023–01/01/2024 — empty-days branch not applicable');
          return;
        }
        for (const c of DAILY_CARDS) {
          expect(s.cards[c]?.pct).toBe(0);
          expect(s.cards[c]?.positive).toBe(true);
        }
      });
    },
  );
});
