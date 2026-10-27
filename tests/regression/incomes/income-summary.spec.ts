/**
 * Income Summary (V1) — `/incomes/income-summary` — ported 1:1 from PHẦN D of
 * `docs/screens/income-summary/income-summary-test-cases.md` (TC-INCSUM-01..16,
 * live scan 2026-10-25, build 1.1.56, merchant 14). Parts A–C of that doc are
 * not in scope here.
 *
 * READ-ONLY. The screen is behind the owner passcode, which
 * `incomeSummaryPage.openDefault()` unlocks. Assertions are reconciliations in
 * integer cents, never the scan day's dollar figures.
 *
 * Source legend: ✅ as written · ⚠️ real invariant, known deviation fails loudly
 * with its bug ID · 🧱 pending.
 */

import { expect } from '@wdio/globals';
import { IncomeSummaryLabels } from '../../../src/constants/testids.income-summary.js';
import { DATE_PRESETS, GROUP_TABS, type GroupTab } from '../../../src/constants/testids.reports-v4.js';
import { Routes } from '../../../src/constants/routes.js';
import { step } from '../../../src/helpers/steps.js';
import incomeSummaryPage, {
  detailCents,
  type SummaryDetail,
  type SummaryTableRow,
} from '../../../src/pages/incomes/IncomeSummaryPage.js';
import reportsV4Page from '../../../src/pages/incomes/ReportsV4Page.js';
import { moneyCents } from '../../../src/pages/incomes/reportDom.js';
import type { SummaryBlock, SummaryLabel } from '../../../src/constants/testids.income-summary.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual, formatMoney } from '../../../src/utils/money.js';

const mmddyyyy = (d: Date): string =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear())}`;

const fail = (problems: string[], context: string): void => {
  if (problems.length > 0) throw new Error(`${context}:\n  - ${problems.join('\n  - ')}`);
};

/** A detail figure that MUST be on screen; names the block when it is not. */
const need = (detail: SummaryDetail, block: SummaryBlock, label: SummaryLabel, occurrence = 0): number => {
  const value = detailCents(detail, block, label, occurrence);
  if (value === null) {
    throw new Error(
      `Income Summary detail: no "${label}" in the ${block} block. Parsed entries: ` +
        JSON.stringify(detail.blocks[block].map((e) => `${e.label}=${e.text}`)),
    );
  }
  return value;
};

/** `Oct 25` → a Date in the current year (or last year when that would be in the future). */
const parsePeriodDate = (text: string, today: Date): Date | null => {
  const parsed = new Date(`${text} ${String(today.getFullYear())}`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() > today.getTime() + 86_400_000) parsed.setFullYear(parsed.getFullYear() - 1);
  return parsed;
};

/** Open with defaults; if Today has no row, widen to Last 7 Days so detail checks have data. */
async function openWithRows(): Promise<SummaryTableRow[]> {
  await incomeSummaryPage.openDefault();
  let rows = await incomeSummaryPage.tableRows();
  if (rows.length === 0) {
    await incomeSummaryPage.selectPreset('last7Days');
    rows = await incomeSummaryPage.tableRows();
  }
  if (rows.length === 0) {
    throw new Error(
      'Precondition: Income Summary has no period row for Today nor the Last 7 Days. Take a payment on this ' +
        'merchant and re-run — reconciling an empty table would pass without testing anything.',
    );
  }
  return rows;
}

describe('Income Summary (V1) — live scan 2026-10-25', () => {
  describe('screen chrome', () => {
    beforeEach(async () => {
      await incomeSummaryPage.openDefault();
    });

    it(
      title(
        'TC-INCSUM-01: opens through the owner passcode with heading and Date/Sale/Tip/Tax/Total Payment header',
        Tag.REGRESSION,
      ),
      async () => {
        expect(await incomeSummaryPage.currentPath()).toBe(Routes.INCOME_SUMMARY);
        expect(IncomeSummaryLabels.title as readonly string[]).toContain(
          await incomeSummaryPage.headingText(),
        );

        const head = await incomeSummaryPage.tableHeaders();
        const problems = IncomeSummaryLabels.tableHead
          .map((pair, i) =>
            (pair as readonly string[]).includes(head[i] ?? '')
              ? null
              : `column ${String(i + 1)}: expected "${pair[0]}", got "${head[i] ?? '(none)'}"`,
          )
          .filter((p): p is string => p !== null);
        fail(problems, 'TC-INCSUM-01 table header');
      },
    );

    it(
      title('TC-INCSUM-02: default preset is Today and the date button shows today', Tag.REGRESSION),
      async () => {
        expect(DATE_PRESETS.today as readonly string[]).toContain(await incomeSummaryPage.presetText());
        expect(await incomeSummaryPage.dateRangeText()).toBe(mmddyyyy(new Date()));
      },
    );

    it(
      title('TC-INCSUM-03: the preset combobox lists the 10 presets (Today … Last Year)', Tag.REGRESSION),
      async () => {
        const options = await step('Read the preset options', () => incomeSummaryPage.presetOptions());
        const expected = Object.values(DATE_PRESETS);
        const problems: string[] = [];
        if (options.length !== expected.length) {
          problems.push(
            `expected ${String(expected.length)} options, got ${String(options.length)}: ${options.join(' | ')}`,
          );
        }
        expected.forEach((pair, i) => {
          if (!(pair as readonly string[]).includes(options[i] ?? '')) {
            problems.push(`option ${String(i + 1)}: expected "${pair[0]}", got "${options[i] ?? '(none)'}"`);
          }
        });
        fail(problems, 'TC-INCSUM-03 preset list');
      },
    );

    it(
      title(
        'TC-INCSUM-04: Day/Week/Month tabs — Day active by default, pressing Week/Month activates it',
        Tag.REGRESSION,
      ),
      async () => {
        const tabs = Object.keys(GROUP_TABS) as GroupTab[];
        for (const tab of tabs) {
          expect(await incomeSummaryPage.hasTab(tab)).toBe(true);
        }
        expect(await incomeSummaryPage.isTabActive('day')).toBe(true);

        for (const tab of ['week', 'month'] as const) {
          await incomeSummaryPage.selectTab(tab);
          expect(await incomeSummaryPage.isTabActive(tab)).toBe(true);
          for (const other of tabs.filter((t) => t !== tab)) {
            expect(await incomeSummaryPage.isTabActive(other)).toBe(false);
          }
        }
        await incomeSummaryPage.selectTab('day');
      },
    );

    it(title('TC-INCSUM-05: the detail panel defaults to "No detail to show"', Tag.REGRESSION), async () => {
      expect(await incomeSummaryPage.isDetailEmpty()).toBe(true);
    });
  });

  it(title('TC-INCSUM-06: every row parses as money and Total Payment ≥ Sale', Tag.REGRESSION), async () => {
    const rows = await openWithRows();
    const problems: string[] = [];
    for (const row of rows) {
      try {
        const sale = moneyCents(row.sale);
        moneyCents(row.tip);
        moneyCents(row.tax);
        const total = moneyCents(row.totalPayment);
        if (total < sale) problems.push(`${row.date}: Total Payment ${row.totalPayment} < Sale ${row.sale}`);
      } catch (error) {
        problems.push(`${row.date}: unparseable cell — ${(error as Error).message}`);
      }
    }
    fail(
      problems,
      'TC-INCSUM-06 (⚠️ in the scan: Total Payment = Sale + Tip + Tax ± fees is not exact because service fee / ' +
        'cash discount are not columns; asserting parse + Total Payment ≥ Sale)',
    );
  });

  describe('detail panel of the first row', () => {
    let row: SummaryTableRow;
    let detail: SummaryDetail;

    before(async () => {
      const rows = await openWithRows();
      row = rows[0]!;
      await incomeSummaryPage.openRowDetail(1);
      detail = await incomeSummaryPage.readDetail();
    });

    it(
      title(
        'TC-INCSUM-07: clicking a row shows the period title, Print, and all five blocks',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        expect(detail.title).toMatch(/\w+ \d{1,2}(, \d{4})?/);
        expect(await incomeSummaryPage.hasPrintButton()).toBe(true);
        const missing = (
          ['paymentDetails', 'saleDetails', 'supplyFee', 'staffPayout', 'salonEarnings'] as const
        ).filter((b) => !detail.blocksPresent.includes(b));
        fail(
          missing.map((b) => `block ${b} not rendered`),
          'TC-INCSUM-07 detail blocks',
        );
      },
    );

    it(
      title(
        'TC-INCSUM-08: Payment Details Total Payment equals the selected row’s Total Payment',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      () => {
        expectCentsEqual(
          need(detail, 'paymentDetails', 'totalPayment'),
          moneyCents(row.totalPayment),
          `TC-INCSUM-08 ${row.date}: Payment Details Total Payment vs table Total Payment`,
        );
      },
    );

    it(
      title(
        'TC-INCSUM-09: Payment Details Total Payment = Amount Collected + Gift Card Redemption',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      () => {
        const total = need(detail, 'paymentDetails', 'totalPayment');
        const collected = need(detail, 'paymentDetails', 'amountCollected');
        const giftCard = need(detail, 'paymentDetails', 'giftCardRedemption');
        if (total !== collected + giftCard) {
          throw new Error(
            `TC-INCSUM-09 ${detail.title} — BUG-INCSUM-02 (suspected): Total Payment ${formatMoney(total)} ≠ ` +
              `Amount Collected ${formatMoney(collected)} + Gift Card Redemption ${formatMoney(giftCard)} ` +
              `(= ${formatMoney(collected + giftCard)}, off by ${formatMoney(total - collected - giftCard)}).`,
          );
        }
      },
    );

    it(
      title(
        'TC-INCSUM-10: Sale Details Net Total = Subtotal − Total Discount + Service Fee − Cash Discount',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      () => {
        const subtotal = need(detail, 'saleDetails', 'subtotal');
        const discount = Math.abs(need(detail, 'saleDetails', 'totalDiscount'));
        const serviceFee = need(detail, 'saleDetails', 'serviceFee');
        const cashDiscount = Math.abs(need(detail, 'saleDetails', 'cashDiscount'));
        expectCentsEqual(
          need(detail, 'saleDetails', 'netTotal'),
          subtotal - discount + serviceFee - cashDiscount,
          `TC-INCSUM-10 ${detail.title}: Net Total vs Subtotal − Total Discount + Service Fee − Cash Discount`,
        );
      },
    );

    it(
      title(
        'TC-INCSUM-11 [BUG-INCSUM-01]: Sale Details Total Payment equals Payment Details Total Payment',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      () => {
        const payment = need(detail, 'paymentDetails', 'totalPayment');
        const sale = need(detail, 'saleDetails', 'totalPayment');
        if (payment !== sale) {
          throw new Error(
            `TC-INCSUM-11 ${detail.title} — BUG-INCSUM-01: two different "Total Payment" figures in one panel — ` +
              `Payment Details ${formatMoney(payment)} vs Sale Details ${formatMoney(sale)} ` +
              `(off by ${formatMoney(payment - sale)}). Expected to fail until the bug is fixed or one label is renamed.`,
          );
        }
      },
    );

    it(
      title('TC-INCSUM-12: Supply Fee total = Staff Supply Share + Salon Supply Share', Tag.REGRESSION),
      () => {
        expectCentsEqual(
          need(detail, 'supplyFee', 'totalSupplyFee'),
          need(detail, 'supplyFee', 'staffSupplyShare') + need(detail, 'supplyFee', 'salonSupplyShare'),
          `TC-INCSUM-12 ${detail.title}: Total supply fee vs Staff + Salon share`,
        );
      },
    );

    it(
      title('TC-INCSUM-13: Staff Payout Pay 1 + Pay 2 = Total Staff Payout', Tag.REGRESSION, Tag.CRITICAL),
      () => {
        expectCentsEqual(
          need(detail, 'staffPayout', 'pay1') + need(detail, 'staffPayout', 'pay2'),
          need(detail, 'staffPayout', 'totalStaffPayout'),
          `TC-INCSUM-13 ${detail.title}: Pay 1 + Pay 2 vs Total Staff Payout`,
        );
      },
    );

    it(title('TC-INCSUM-16: Print sends the period detail to the printer — PENDING (needs a printer)'));
  });

  it(
    title('TC-INCSUM-14: Last 7 Days lists 1–7 daily rows in a consistent date order', Tag.REGRESSION),
    async () => {
      await incomeSummaryPage.openDefault();
      await incomeSummaryPage.selectPreset('last7Days');
      expect(DATE_PRESETS.last7Days as readonly string[]).toContain(await incomeSummaryPage.presetText());

      const rows = await incomeSummaryPage.tableRows();
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.length).toBeLessThanOrEqual(7);

      const today = new Date();
      const dates = rows.map((r) => parsePeriodDate(r.date, today));
      const unparsed = rows.filter((_, i) => dates[i] === null).map((r) => r.date);
      fail(
        unparsed.map((d) => `unparseable date "${d}"`),
        'TC-INCSUM-14 row dates',
      );

      const times = dates.map((d) => d!.getTime());
      const ascending = times.every((t, i) => i === 0 || t > times[i - 1]!);
      const descending = times.every((t, i) => i === 0 || t < times[i - 1]!);
      if (!ascending && !descending) {
        throw new Error(
          `TC-INCSUM-14: rows are neither strictly ascending nor descending: ${rows.map((r) => r.date).join(', ')}`,
        );
      }
    },
  );

  it(
    title(
      'TC-INCSUM-15: V1 Today row matches /report-pages/v4/income-summary (Sale, Tip, Tax, Total Payment)',
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async () => {
      const v1 = await step('Read the V1 Today row', async () => {
        await incomeSummaryPage.openDefault();
        return incomeSummaryPage.tableRows();
      });
      if (v1.length === 0) {
        throw new Error('TC-INCSUM-15 precondition: V1 has no row for Today — take a payment first.');
      }
      const v4 = await step('Read the V4 Today row', async () => {
        await reportsV4Page.open('income-summary');
        return reportsV4Page.incomePeriodRows();
      });

      const v1Row = v1[0]!;
      const v4Row = v4.find((r) => r.date === v1Row.date) ?? v4[0];
      if (!v4Row) throw new Error(`TC-INCSUM-15: V4 shows no row while V1 shows ${v1Row.date}.`);

      expectCentsEqual(v4Row.saleCents, moneyCents(v1Row.sale), `TC-INCSUM-15 ${v1Row.date} Sale V4 vs V1`);
      expectCentsEqual(v4Row.tipCents, moneyCents(v1Row.tip), `TC-INCSUM-15 ${v1Row.date} Tip V4 vs V1`);
      expectCentsEqual(v4Row.taxCents, moneyCents(v1Row.tax), `TC-INCSUM-15 ${v1Row.date} Tax V4 vs V1`);
      expectCentsEqual(
        v4Row.totalPaymentCents,
        moneyCents(v1Row.totalPayment),
        `TC-INCSUM-15 ${v1Row.date} Total Payment V4 vs V1`,
      );
    },
  );
});
