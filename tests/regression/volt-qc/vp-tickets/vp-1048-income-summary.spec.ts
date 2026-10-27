/**
 * VP-1048 — Income Summary (volt-qc per-ticket file
 * `docs/qc/volt-qc/vp-tickets/VP-1048-income-summary.md`, TC 1–65).
 *
 * ## Ids
 *
 * Shares the `VP-1048` ticket key with the Daily Sale Report sheet. Titles say
 * `VP-1048 IS TC-nn` (this file) vs `VP-1048 DSR TC-nn` — the coverage matcher
 * keys both by `VP-1048`, so the distinction is for people.
 *
 * ## How the numbers are asserted
 *
 * The sheet's figures belong to one merchant's week. Every automated row is a
 * reconciliation in integer cents — a total against its parts, the panel against
 * the table, the screen against `ReportService` (the same `vReportStoreDailyIncomeList`
 * view the screen renders from) — the pattern of
 * tests/regression/incomes/income-summary.spec.ts. Where the sheet's formula and
 * the shipped one differ (Net Total also nets Service Fee / Cash Discount), the
 * shipped formula is used and the comment says so.
 *
 * READ-ONLY. Behind the owner passcode (`openDefault` / `openRange` unlock it).
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { cents, ReportService } from '../../../../src/api/index.js';
import type { StoreIncomeSummaryRow } from '../../../../src/api/index.js';
import { IncomeSummaryLabels } from '../../../../src/constants/testids.income-summary.js';
import type { SummaryBlock, SummaryLabel } from '../../../../src/constants/testids.income-summary.js';
import { DATE_PRESETS } from '../../../../src/constants/testids.reports-v4.js';
import { returnToHome } from '../../../../src/flows/index.js';
import incomeSummaryPage, {
  detailCents,
  type DetailEntry,
  type SummaryDetail,
  type SummaryTableRow,
} from '../../../../src/pages/incomes/IncomeSummaryPage.js';
import { moneyCents } from '../../../../src/pages/incomes/reportDom.js';
import { ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../../src/utils/money.js';

const reports = new ReportService();

const fail = (problems: string[], context: string): void => {
  if (problems.length > 0) throw new Error(`${context}:\n  - ${problems.join('\n  - ')}`);
};

/** A detail figure that must be on screen. */
const need = (detail: SummaryDetail, block: SummaryBlock, label: SummaryLabel, occurrence = 0): number => {
  const value = detailCents(detail, block, label, occurrence);
  if (value === null) {
    throw new Error(
      `Income Summary detail: no "${label}" in ${block}. Parsed: ` +
        JSON.stringify(detail.blocks[block].map((e) => `${e.label}=${e.text}`)),
    );
  }
  return value;
};

interface TenderGroup {
  head: string;
  total: number;
  parts: Record<string, number>;
}

const TENDER_HEADS = ['Cash', 'Card', 'Others', 'Gift Card Redemption'];
const TENDER_PARTS = ['Sale', 'Refund', 'Tip', 'Tax'];

/** Payment Details read as tender groups: a head row (Cash/Card/…) then its Sale/Refund/Tip/Tax rows. */
function tenderGroups(entries: DetailEntry[]): TenderGroup[] {
  const groups: TenderGroup[] = [];
  let current: TenderGroup | null = null;
  for (const e of entries) {
    if (TENDER_HEADS.includes(e.label)) {
      current = { head: e.label, total: e.cents, parts: {} };
      groups.push(current);
    } else if (current && TENDER_PARTS.includes(e.label)) {
      current.parts[e.label] = e.cents;
    } else {
      current = null;
    }
  }
  return groups;
}

/** Sale − |Refund| + Tip + Tax — the refund row may render signed or unsigned. */
const groupFormula = (g: TenderGroup): number =>
  (g.parts.Sale ?? 0) - Math.abs(g.parts.Refund ?? 0) + (g.parts.Tip ?? 0) + (g.parts.Tax ?? 0);

const startOfYear = (year: number): Date => new Date(year, 0, 1);
const endOfYear = (year: number): Date => new Date(year, 11, 31);
const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

/** Open with defaults; widen to Last 7 Days when Today has no row. */
async function openWithRows(ctx: Mocha.Context): Promise<SummaryTableRow[]> {
  await incomeSummaryPage.openDefault();
  let rows = await incomeSummaryPage.tableRows();
  if (rows.length === 0) {
    await incomeSummaryPage.selectPreset('last7Days');
    rows = await incomeSummaryPage.tableRows();
  }
  if (rows.length === 0) ctx.skip();
  return rows;
}

describe('VP-1048 IS — Income Summary', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await ensurePasscodeGrant();
    await returnToHome();
  });

  describe('filters and table shape', () => {
    it(title('VP-1048 IS TC-01 Defaults to Day + Today', Tag.REGRESSION), async () => {
      await incomeSummaryPage.openDefault();
      expect(DATE_PRESETS.today as readonly string[]).toContain(await incomeSummaryPage.presetText());
      expect(await incomeSummaryPage.isTabActive('day')).toBe(true);
    });

    it(
      title('VP-1048 IS TC-03 Day over a 5-day range lists at most one row per day', Tag.REGRESSION),
      async () => {
        await incomeSummaryPage.openRange(daysAgo(4), new Date(), 'day');
        const rows = await incomeSummaryPage.tableRows();
        expect(rows.length).toBeLessThanOrEqual(5);
        expect(new Set(rows.map((r) => r.date)).size).toBe(rows.length);
      },
    );

    it(
      title('VP-1048 IS TC-04 Week (this year) lists weeks up to the current week only', Tag.REGRESSION),
      async () => {
        const now = new Date();
        await incomeSummaryPage.openRange(startOfYear(now.getFullYear()), now, 'week');
        const rows = await incomeSummaryPage.tableRows();
        const dayOfYear =
          Math.floor((now.getTime() - startOfYear(now.getFullYear()).getTime()) / 86_400_000) + 1;
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThanOrEqual(Math.ceil(dayOfYear / 7) + 1);
      },
    );

    it(
      title('VP-1048 IS TC-05 Week of a past year lists every week of that year (52–53)', Tag.REGRESSION),
      async () => {
        const year = new Date().getFullYear() - 1;
        await incomeSummaryPage.openRange(startOfYear(year), endOfYear(year), 'week');
        const rows = await incomeSummaryPage.tableRows();
        expect(rows.length).toBeGreaterThanOrEqual(52);
        expect(rows.length).toBeLessThanOrEqual(54);
      },
    );

    it(
      title('VP-1048 IS TC-06 Month (this year) lists months up to the current month', Tag.REGRESSION),
      async () => {
        const now = new Date();
        await incomeSummaryPage.openRange(startOfYear(now.getFullYear()), now, 'month');
        const rows = await incomeSummaryPage.tableRows();
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThanOrEqual(now.getMonth() + 1);
      },
    );

    it(title('VP-1048 IS TC-07 Month of a past year lists all 12 months', Tag.REGRESSION), async () => {
      const year = new Date().getFullYear() - 1;
      await incomeSummaryPage.openRange(startOfYear(year), endOfYear(year), 'month');
      expect((await incomeSummaryPage.tableRows()).length).toBe(12);
    });

    it(
      title(
        'VP-1048 IS TC-15 Table has a Tax column (Date | Sale | Tip | Tax | Total Payment)',
        Tag.REGRESSION,
      ),
      async () => {
        await incomeSummaryPage.openDefault();
        const head = await incomeSummaryPage.tableHeaders();
        const problems = IncomeSummaryLabels.tableHead
          .map((pair, i) =>
            (pair as readonly string[]).includes(head[i] ?? '')
              ? null
              : `col ${String(i + 1)}: "${head[i] ?? ''}"`,
          )
          .filter((p): p is string => p !== null);
        fail(problems, 'VP-1048 IS TC-15 header');
      },
    );

    it(title('VP-1048 IS TC-16 No "Net Income" column duplicating Sale', Tag.REGRESSION), async () => {
      await incomeSummaryPage.openDefault();
      const head = await incomeSummaryPage.tableHeaders();
      expect(head.filter((h) => /net income|thu nhập ròng/i.test(h))).toEqual([]);
    });

    it(title('VP-1048 IS TC-27 The 5th column header is "Total Payment"', Tag.REGRESSION), async () => {
      await incomeSummaryPage.openDefault();
      expect(IncomeSummaryLabels.totalPaymentHead as readonly string[]).toContain(
        (await incomeSummaryPage.tableHeaders())[4] ?? '',
      );
    });

    it(title('VP-1048 IS TC-18 Week rows print a label plus their date range', Tag.REGRESSION), async () => {
      const now = new Date();
      await incomeSummaryPage.openRange(startOfYear(now.getFullYear()), now, 'week');
      const rows = await incomeSummaryPage.tableRows();
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows)
        expect(r.date).toMatch(/\d{2}\/\d{2}\/\d{4}\s*[-–]\s*\d{2}\/\d{2}\/\d{4}|\w+ \d{1,2}.*[-–]/);
    });

    it(
      title(
        'VP-1048 IS TC-63 Past-year rows with no activity still render $0.00, never blank',
        Tag.REGRESSION,
      ),
      async () => {
        const year = new Date().getFullYear() - 1;
        await incomeSummaryPage.openRange(startOfYear(year), endOfYear(year), 'month');
        const problems: string[] = [];
        for (const r of await incomeSummaryPage.tableRows()) {
          for (const cell of [r.sale, r.tip, r.tax, r.totalPayment]) {
            try {
              moneyCents(cell);
            } catch {
              problems.push(`${r.date}: "${cell}"`);
            }
          }
        }
        fail(problems, 'VP-1048 IS TC-63 unparseable cells');
      },
    );

    it(
      title('VP-1048 IS TC-17 Table Total Payment = Sale + Tip + Tax on every row', Tag.REGRESSION),
      async function () {
        const rows = await openWithRows(this);
        const problems = rows
          .map((r) => ({
            r,
            d: moneyCents(r.totalPayment) - (moneyCents(r.sale) + moneyCents(r.tip) + moneyCents(r.tax)),
          }))
          .filter(({ d }) => d !== 0)
          .map(
            ({ r, d }) =>
              `${r.date}: off by ${String(d)} cents (service fee / cash discount are not columns)`,
          );
        fail(problems, 'VP-1048 IS TC-17');
      },
    );
  });

  describe('detail panel of the first row', () => {
    let row: SummaryTableRow;
    let detail: SummaryDetail;

    before(async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const rows = await openWithRows(this);
      row = rows[0] as SummaryTableRow;
      await incomeSummaryPage.openRowDetail(1);
      detail = await incomeSummaryPage.readDetail();
    });

    it(title('VP-1048 IS TC-19 Clicking a row loads the panel for that period', Tag.REGRESSION), () => {
      expect(detail.title).not.toBe('');
      expect(detail.blocksPresent).toContain('paymentDetails');
      expect(detail.blocksPresent).toContain('saleDetails');
    });

    for (const [tc, head] of [
      ['VP-1048 IS TC-20', 'Card'],
      ['VP-1048 IS TC-21', 'Cash'],
      ['VP-1048 IS TC-22', 'Others'],
    ] as const) {
      it(
        title(`${tc} Payment Details ${head} = Sale − Refund + Tip + Tax of ${head}`, Tag.REGRESSION),
        function () {
          const group = tenderGroups(detail.blocks.paymentDetails).find((g) => g.head === head);
          if (!group) this.skip();
          if (group) expectCentsEqual(group.total, groupFormula(group), `${tc} ${head}`);
        },
      );
    }

    it(
      title('VP-1048 IS TC-23 Amount Collected = Card + Cash + Others', Tag.REGRESSION, Tag.CRITICAL),
      () => {
        const groups = tenderGroups(detail.blocks.paymentDetails).filter(
          (g) => g.head !== 'Gift Card Redemption',
        );
        expectCentsEqual(
          need(detail, 'paymentDetails', 'amountCollected'),
          groups.reduce((s, g) => s + g.total, 0),
          'VP-1048 IS TC-23 Amount Collected vs Card + Cash + Others',
        );
      },
    );

    it(title('VP-1048 IS TC-24 Gift Card Redemption = its Sale + Tip + Tax', Tag.REGRESSION), function () {
      const group = tenderGroups(detail.blocks.paymentDetails).find((g) => g.head === 'Gift Card Redemption');
      if (!group || Object.keys(group.parts).length === 0) this.skip();
      if (group) expectCentsEqual(group.total, groupFormula(group), 'VP-1048 IS TC-24 Gift Card Redemption');
    });

    it(
      title(
        'VP-1048 IS TC-25 TOTAL PAYMENT = Amount Collected + Gift Card Redemption',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      () => {
        expectCentsEqual(
          need(detail, 'paymentDetails', 'totalPayment'),
          need(detail, 'paymentDetails', 'amountCollected') +
            need(detail, 'paymentDetails', 'giftCardRedemption'),
          'VP-1048 IS TC-25',
        );
      },
    );

    it(
      title('VP-1048 IS TC-26 Every Payment Details sub-row parses (negatives allowed)', Tag.REGRESSION),
      () => {
        for (const e of detail.blocks.paymentDetails) expect(Number.isInteger(e.cents)).toBe(true);
      },
    );

    it(
      title('VP-1048 IS TC-28 Total Sale = Gift Card Sale + Service Sale + Product Sale', Tag.REGRESSION),
      () => {
        expectCentsEqual(
          need(detail, 'saleDetails', 'totalSale'),
          need(detail, 'saleDetails', 'giftCardSale') +
            need(detail, 'saleDetails', 'serviceSale') +
            need(detail, 'saleDetails', 'productSale'),
          'VP-1048 IS TC-28',
        );
      },
    );

    it(title('VP-1048 IS TC-30 Subtotal = Total Sale − Total Refund', Tag.REGRESSION), () => {
      expectCentsEqual(
        need(detail, 'saleDetails', 'subtotal'),
        need(detail, 'saleDetails', 'totalSale') - Math.abs(need(detail, 'saleDetails', 'totalRefund')),
        'VP-1048 IS TC-30',
      );
    });

    it(
      title(
        'VP-1048 IS TC-32 Net Total = Subtotal − Total Discount (± Service Fee / Cash Discount)',
        Tag.REGRESSION,
      ),
      () => {
        // Shipped formula also adds Service Fee and nets Cash Discount (TC-INCSUM-10).
        const serviceFee = detailCents(detail, 'saleDetails', 'serviceFee') ?? 0;
        const cashDiscount = Math.abs(detailCents(detail, 'saleDetails', 'cashDiscount') ?? 0);
        expectCentsEqual(
          need(detail, 'saleDetails', 'netTotal'),
          need(detail, 'saleDetails', 'subtotal') -
            Math.abs(need(detail, 'saleDetails', 'totalDiscount')) +
            serviceFee -
            cashDiscount,
          'VP-1048 IS TC-32',
        );
      },
    );

    it(title('VP-1048 IS TC-33 Tax Collected = Σ Tax of every tender', Tag.REGRESSION), () => {
      const taxes = tenderGroups(detail.blocks.paymentDetails).reduce((s, g) => s + (g.parts.Tax ?? 0), 0);
      expectCentsEqual(need(detail, 'saleDetails', 'taxCollected'), taxes, 'VP-1048 IS TC-33');
    });

    it(title('VP-1048 IS TC-34 Sale Details TOTAL PAYMENT = Net Total + Tax + Tip', Tag.REGRESSION), () => {
      expectCentsEqual(
        need(detail, 'saleDetails', 'totalPayment'),
        need(detail, 'saleDetails', 'netTotal') +
          need(detail, 'saleDetails', 'taxCollected') +
          need(detail, 'saleDetails', 'tip'),
        'VP-1048 IS TC-34',
      );
    });

    it(
      title('VP-1048 IS TC-37 Salon Supply Share = Total supply fee − Staff Supply Share', Tag.REGRESSION),
      () => {
        expectCentsEqual(
          need(detail, 'supplyFee', 'salonSupplyShare'),
          need(detail, 'supplyFee', 'totalSupplyFee') - need(detail, 'supplyFee', 'staffSupplyShare'),
          'VP-1048 IS TC-37',
        );
      },
    );

    it(
      title(
        'VP-1048 IS TC-47 Pay 1 + Pay 2 (+ Staff Salary when listed apart) = Total Staff Payout',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      () => {
        const total = need(detail, 'staffPayout', 'totalStaffPayout');
        const pays = need(detail, 'staffPayout', 'pay1') + need(detail, 'staffPayout', 'pay2');
        const salary =
          detail.blocks.staffPayout.find((e) => e.label === 'Salary' || e.label === 'Staff Salary')?.cents ??
          0;
        expect([pays, pays + salary]).toContain(total);
      },
    );

    it(
      title(
        'VP-1048 IS TC-56 Total Payment agrees: table = Payment Details = Sale Details',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      () => {
        const table = moneyCents(row.totalPayment);
        expectCentsEqual(need(detail, 'paymentDetails', 'totalPayment'), table, 'Payment Details vs table');
        expectCentsEqual(need(detail, 'saleDetails', 'totalPayment'), table, 'Sale Details vs table');
      },
    );

    it(title('VP-1048 IS TC-58 Tax agrees: table = Tax Collected', Tag.REGRESSION), () => {
      expectCentsEqual(need(detail, 'saleDetails', 'taxCollected'), moneyCents(row.tax), 'VP-1048 IS TC-58');
    });

    it(title('VP-1048 IS TC-65 Every panel figure is a 2-decimal amount', Tag.REGRESSION), () => {
      for (const block of detail.blocksPresent) {
        for (const e of detail.blocks[block]) expect(e.text).toMatch(/^-?\(?-?\$[\d,]+\.\d{2}\)?$|^\d+$/);
      }
    });
  });

  describe('the report view behind the screen', () => {
    let r: StoreIncomeSummaryRow | null = null;

    before(async () => {
      r = await reports.incomeSummaryDay(new Date());
      for (let back = 1; r === null && back <= 7; back += 1)
        r = await reports.incomeSummaryDay(daysAgo(back));
    });

    const needRow = (ctx: Mocha.Context): StoreIncomeSummaryRow => {
      if (r === null) ctx.skip();
      return r;
    };

    it(title('VP-1048 IS TC-29 Total Refund = Service Refund + Product Refund', Tag.REGRESSION), function () {
      const x = needRow(this);
      expectCentsEqual(
        Math.abs(cents(x.incomeTotalRefund)),
        Math.abs(cents(x.incomeServiceRefund)) + Math.abs(cents(x.incomeProductRefund)),
        'VP-1048 IS TC-29',
      );
    });

    it(title('VP-1048 IS TC-31 Total Discount = Discount − Discount Reversed', Tag.REGRESSION), function () {
      const x = needRow(this);
      expectCentsEqual(
        Math.abs(cents(x.incomeTotalDiscount)),
        Math.abs(cents(x.incomeDiscount)) - Math.abs(cents(x.incomeDiscountReversed)),
        'VP-1048 IS TC-31 incomeTotalDiscount vs incomeDiscount − incomeDiscountReversed',
      );
    });

    it(
      title(
        'VP-1048 IS TC-59 Daily Sale Report and Income Summary agree on the same day',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async function () {
        const x = needRow(this);
        const day = new Date(`${x.date}T12:00:00`);
        const dsr = await reports.storeDay(day);
        if (!dsr) this.skip();
        expectCentsEqual(cents(dsr?.dailySaleTip), cents(x.incomeTip), 'Tip: DSR vs IS');
        expectCentsEqual(cents(dsr?.incomeTaxAmount), cents(x.incomeTaxAmount), 'Tax: DSR vs IS');
        expectCentsEqual(
          cents(dsr?.dailySaleTotalPayment),
          cents(x.incomeSummaryTotalPayment),
          'Total Payment: DSR vs IS',
        );
      },
    );
  });
});
