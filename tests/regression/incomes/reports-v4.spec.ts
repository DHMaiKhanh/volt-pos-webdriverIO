/**
 * Reports V4 — `/report-pages/v4/{daily-sale-report|income-summary|staff-income|staff-payroll}` —
 * ported 1:1 from `docs/screens/reports-v4/reports-v4-test-cases.md`
 * (TC-RV4-01..18, live scan 2026-10-25, build 1.1.56, merchant 14).
 *
 * READ-ONLY: nothing prints, nothing is created. Money in integer cents;
 * invariants and V1↔V4 parity only, never the scan day's figures.
 *
 * Source legend: ✅ as written · ⚠️ real invariant, a known deviation fails
 * loudly naming the reason · 🧱 pending.
 *
 * Staff Payroll lists every staff of the merchant (337 on the scan day). If the
 * app ever virtualises those tables, a row count/sum mismatch reflects the
 * RENDERED subset — the failure messages say so.
 */

import { expect } from '@wdio/globals';
import { appNav } from '../../../src/components/nav/AppNav.js';
import {
  V4_ROUTE_PREFIX,
  V4_SLUGS,
  V4Labels,
  type Bilingual,
} from '../../../src/constants/testids.reports-v4.js';
import { returnToHome } from '../../../src/flows/navigation.flow.js';
import { step } from '../../../src/helpers/steps.js';
import incomeDailyPage from '../../../src/pages/incomes/IncomeDailyPage.js';
import incomeSummaryPage from '../../../src/pages/incomes/IncomeSummaryPage.js';
import reportsV4Page, {
  legacyStaffIncomeReport,
  legacyStaffPayrollReport,
  type LegacyReportPage,
  type StaffReportRow,
} from '../../../src/pages/incomes/ReportsV4Page.js';
import { isMoneyText, moneyCents } from '../../../src/pages/incomes/reportDom.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual, formatMoney, sumCents } from '../../../src/utils/money.js';

const fail = (problems: string[], context: string): void => {
  if (problems.length > 0) throw new Error(`${context}:\n  - ${problems.join('\n  - ')}`);
};

const VIRTUALISATION_NOTE =
  'If the table is virtualised, the row count / column sums cover only the RENDERED rows — rule that out first';

/** The six staff cards, keyed to the column each one totals. */
const STAFF_CARDS: {
  card: Bilingual;
  column: keyof Omit<StaffReportRow, 'name'> | 'count';
  money: boolean;
}[] = [
  { card: V4Labels.totalStaff, column: 'count', money: false },
  { card: V4Labels.totalOrders, column: 'orders', money: false },
  { card: V4Labels.totalSubtotal, column: 'subtotalCents', money: true },
  { card: V4Labels.totalSupplyFee, column: 'supplyFeeCents', money: true },
  { card: V4Labels.totalTip, column: 'tipCents', money: true },
  { card: V4Labels.totalStaffIncome, column: 'totalIncomeCents', money: true },
];

/** Read a staff card as a number (cents for money cards, plain count otherwise). */
async function readStaffCard(
  page: typeof reportsV4Page | LegacyReportPage,
  spec: (typeof STAFF_CARDS)[number],
): Promise<number> {
  return spec.money ? page.cardCents(spec.card) : page.cardCount(spec.card);
}

/** Compare every card except Total staff with the column sums. */
function staffSumProblems(cards: Map<string, number>, rows: StaffReportRow[]): string[] {
  const problems: string[] = [];
  for (const spec of STAFF_CARDS) {
    if (spec.column === 'count') continue;
    const column = spec.column;
    const sum =
      column === 'orders' ? rows.reduce((a, r) => a + r.orders, 0) : sumCents(rows.map((r) => r[column]));
    const card = cards.get(spec.card[0])!;
    if (sum !== card) {
      problems.push(
        `${spec.card[0]}: card ${spec.money ? formatMoney(card) : String(card)} vs Σ column ` +
          `${spec.money ? formatMoney(sum) : String(sum)}`,
      );
    }
  }
  return problems;
}

async function readAllStaffCards(
  page: typeof reportsV4Page | LegacyReportPage,
): Promise<Map<string, number>> {
  const cards = new Map<string, number>();
  for (const spec of STAFF_CARDS) cards.set(spec.card[0], await readStaffCard(page, spec));
  return cards;
}

describe('Reports V4', () => {
  /* ------------------------------------------------------------------ *
   * Menu & badge
   * ------------------------------------------------------------------ */

  it(
    title('TC-RV4-01: the ☰ "Reports V4" group holds exactly the 4 V4 report links', Tag.REGRESSION),
    async () => {
      const hrefs = await step('☰ → expand Reports V4 → read links', async () => {
        await returnToHome();
        await appNav.openSidebar();
        await reportsV4Page.expandMenuGroup();
        const found = await reportsV4Page.menuHrefs();
        await appNav.closeSidebar();
        return found;
      });

      const expected = V4_SLUGS.map((slug) => `${V4_ROUTE_PREFIX}${slug}`).sort();
      expect([...new Set(hrefs)].sort()).toEqual(expected);
    },
  );

  it(title('TC-RV4-02: every V4 report shows a "V4" badge beside its title', Tag.REGRESSION), async () => {
    const problems: string[] = [];
    for (const slug of V4_SLUGS) {
      await reportsV4Page.open(slug);
      if (!(await reportsV4Page.isHeadingVisible(slug))) problems.push(`${slug}: title not visible`);
      if (!(await reportsV4Page.hasV4Badge())) problems.push(`${slug}: no "V4" badge`);
    }
    fail(problems, 'TC-RV4-02');
  });

  /* ------------------------------------------------------------------ *
   * Daily Sale Report V4
   * ------------------------------------------------------------------ */

  describe('Daily Sale Report V4', () => {
    beforeEach(async () => {
      await reportsV4Page.open('daily-sale-report');
    });

    it(
      title(
        'TC-RV4-03: four tiles (Total Order, Sale, Total tip, Total Payment), each with "vs Yesterday"',
        Tag.REGRESSION,
      ),
      async () => {
        const problems: string[] = [];
        for (const tile of [V4Labels.totalOrder, V4Labels.sale, V4Labels.totalTip, V4Labels.totalPayment]) {
          if ((await reportsV4Page.cardText(tile)) === null) {
            problems.push(`${tile[0]}: tile or its value not found`);
            continue;
          }
          const trailing = await reportsV4Page.cardTrailingLines(tile, 6);
          if (!trailing.some((l) => (V4Labels.vsYesterday as readonly string[]).includes(l))) {
            problems.push(`${tile[0]}: no "vs Yesterday" line (read ${JSON.stringify(trailing)})`);
          }
        }
        fail(problems, 'TC-RV4-03 DSR V4 tiles');
      },
    );

    it(
      title('TC-RV4-04: Total Order equals the number of order rows', Tag.REGRESSION, Tag.CRITICAL),
      async () => {
        const tile = await reportsV4Page.cardCount(V4Labels.totalOrder);
        const rows = await reportsV4Page.orderRows();
        expect(rows.length).toBe(tile);
      },
    );

    it(
      title(
        'TC-RV4-05: Σ order Total equals the Total Payment tile (± Gift Card Redemption)',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        const rows = await reportsV4Page.orderRows();
        const sum = sumCents(rows.map((r) => r.totalCents));
        const tile = await reportsV4Page.cardCents(V4Labels.totalPayment);
        const giftCard = (await reportsV4Page.giftCardRedemptionCents()) ?? 0;

        if (sum !== tile && sum + giftCard !== tile && sum !== tile + giftCard) {
          throw new Error(
            `TC-RV4-05 (⚠️ in the scan): Σ order Total ${formatMoney(sum)} over ${String(rows.length)} orders ≠ ` +
              `Total Payment tile ${formatMoney(tile)}, and Gift Card Redemption ${formatMoney(giftCard)} does not ` +
              `explain the gap (off by ${formatMoney(tile - sum)}).`,
          );
        }
      },
    );

    it(
      title(
        'TC-RV4-06: DSR V4 Sale / Total tip / Total Payment match DSR V1 (/incomes/income-daily) today',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        const v4 = {
          sale: await reportsV4Page.cardCents(V4Labels.sale),
          tip: await reportsV4Page.cardCents(V4Labels.totalTip),
          total: await reportsV4Page.cardCents(V4Labels.totalPayment),
        };
        const v1 = await step('Read DSR V1 for today', async () => {
          await incomeDailyPage.open(new Date());
          return {
            sale: await incomeDailyPage.cardCents('sale'),
            tip: await incomeDailyPage.cardCents('totalTip'),
            total: await incomeDailyPage.cardCents('totalPayment'),
          };
        });

        const problems = (['sale', 'tip', 'total'] as const)
          .filter((k) => v4[k] !== v1[k])
          .map((k) => `${k}: V4 ${formatMoney(v4[k])} vs V1 ${formatMoney(v1[k])}`);
        fail(problems, 'TC-RV4-06 (⚠️ in the scan) DSR V4 vs V1 parity');
      },
    );

    it(title('TC-RV4-18: Print the DSR V4 — PENDING (needs a printer)'));
  });

  /* ------------------------------------------------------------------ *
   * Income Summary V4
   * ------------------------------------------------------------------ */

  describe('Income Summary V4', () => {
    it(
      title(
        'TC-RV4-07: Income Summary V4 Today row matches V1 (Sale / Tip / Tax / Total Payment)',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        await reportsV4Page.open('income-summary');
        const v4 = await reportsV4Page.incomePeriodRows();
        const v1 = await step('Read V1 Income Summary (Today)', async () => {
          await incomeSummaryPage.openDefault();
          return incomeSummaryPage.tableRows();
        });
        if (v1.length === 0 && v4.length === 0) {
          throw new Error(
            'TC-RV4-07 precondition: neither V1 nor V4 has a row for Today — take a payment first.',
          );
        }
        const v1Row = v1[0];
        const v4Row = v4.find((r) => r.date === v1Row?.date) ?? v4[0];
        if (!v1Row || !v4Row) {
          throw new Error(
            `TC-RV4-07: one side has no Today row (V1 ${String(v1.length)} rows, V4 ${String(v4.length)} rows).`,
          );
        }
        expectCentsEqual(v4Row.saleCents, moneyCents(v1Row.sale), `TC-RV4-07 ${v1Row.date} Sale V4 vs V1`);
        expectCentsEqual(v4Row.tipCents, moneyCents(v1Row.tip), `TC-RV4-07 ${v1Row.date} Tip V4 vs V1`);
        expectCentsEqual(v4Row.taxCents, moneyCents(v1Row.tax), `TC-RV4-07 ${v1Row.date} Tax V4 vs V1`);
        expectCentsEqual(
          v4Row.totalPaymentCents,
          moneyCents(v1Row.totalPayment),
          `TC-RV4-07 ${v1Row.date} Total Payment V4 vs V1`,
        );
      },
    );

    it(
      title(
        'TC-RV4-08: clicking a non-zero row opens a detail panel with non-$0.00 figures (VP-4850)',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        await reportsV4Page.open('income-summary');
        const rows = await reportsV4Page.incomePeriodRows();
        const index = rows.findIndex((r) => r.totalPaymentCents !== 0);
        if (index < 0) {
          throw new Error(
            `TC-RV4-08 precondition: no Income Summary V4 row with a non-zero Total Payment (${String(rows.length)} rows).`,
          );
        }
        await reportsV4Page.openIncomeRow(index + 1);
        const lines = await reportsV4Page.incomeDetailLines();
        const amounts = lines.filter(isMoneyText).map(moneyCents);

        const problems: string[] = [];
        if (lines.some((l) => (V4Labels.noDetail as readonly string[]).includes(l))) {
          problems.push('the panel still shows "No detail to show" after the row click');
        }
        if (!amounts.some((c) => c !== 0)) {
          problems.push(
            `every amount in the panel is $0.00 (${String(amounts.length)} amounts read) — VP-4850 regression`,
          );
        }
        fail(
          problems,
          `TC-RV4-08 (⚠️ in the scan) row ${rows[index]!.date} = ${formatMoney(rows[index]!.totalPaymentCents)}`,
        );
      },
    );
  });

  /* ------------------------------------------------------------------ *
   * Staff Income V4
   * ------------------------------------------------------------------ */

  describe('Staff Income V4', () => {
    beforeEach(async () => {
      await reportsV4Page.open('staff-income');
    });

    it(title('TC-RV4-09: Total staff equals the number of staff rows', Tag.REGRESSION), async () => {
      const card = await reportsV4Page.cardCount(V4Labels.totalStaff);
      const rows = await reportsV4Page.staffRows();
      expect(rows.length).toBe(card);
    });

    it(
      title(
        'TC-RV4-10: Σ Orders / Subtotal / Supply Fee / Tip / Total Income equal their cards',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        const cards = await readAllStaffCards(reportsV4Page);
        const rows = await reportsV4Page.staffRows();
        fail(
          staffSumProblems(cards, rows),
          `TC-RV4-10 (⚠️ in the scan) over ${String(rows.length)} staff rows. ${VIRTUALISATION_NOTE}`,
        );
      },
    );

    it(
      title(
        'TC-RV4-11: "Show staff with no income" keeps or grows the list and Total staff follows',
        Tag.REGRESSION,
      ),
      async () => {
        if (await reportsV4Page.isNoIncomeSwitchOn()) await reportsV4Page.toggleNoIncomeSwitch();
        const before = (await reportsV4Page.staffRows()).length;

        await reportsV4Page.toggleNoIncomeSwitch();
        try {
          expect(await reportsV4Page.isNoIncomeSwitchOn()).toBe(true);
          const after = (await reportsV4Page.staffRows()).length;
          expect(after).toBeGreaterThanOrEqual(before);
          expect(await reportsV4Page.cardCount(V4Labels.totalStaff)).toBe(after);
        } finally {
          await reportsV4Page.toggleNoIncomeSwitch();
        }
      },
    );

    it(
      title('TC-RV4-12: Search by the first staff name leaves only matching rows', Tag.REGRESSION),
      async () => {
        const rows = await reportsV4Page.staffRows();
        if (rows.length === 0) throw new Error('TC-RV4-12 precondition: Staff Income V4 lists no staff.');
        const name = rows[0]!.name;

        await reportsV4Page.search(name);
        try {
          const filtered = await reportsV4Page.staffRows();
          expect(filtered.length).toBeGreaterThanOrEqual(1);
          const strays = filtered.filter((r) => !r.name.toLowerCase().includes(name.toLowerCase()));
          fail(
            strays.map((r) => `"${r.name}" does not match "${name}"`),
            'TC-RV4-12 search filter',
          );
        } finally {
          await reportsV4Page.clearSearch();
        }
      },
    );

    it(
      title(
        'TC-RV4-13: Staff Income V4 totals match V1 (/incomes/income-staff) for the same day',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        const subset = STAFF_CARDS.filter((s) =>
          ['orders', 'subtotalCents', 'supplyFeeCents', 'tipCents'].includes(s.column),
        );
        const v4 = new Map<string, number>();
        for (const spec of subset) v4.set(spec.card[0], await readStaffCard(reportsV4Page, spec));

        await legacyStaffIncomeReport.open();
        const problems: string[] = [];
        for (const spec of subset) {
          const v1 = await readStaffCard(legacyStaffIncomeReport, spec);
          const v4Value = v4.get(spec.card[0])!;
          if (v1 !== v4Value) {
            const fmt = (n: number): string => (spec.money ? formatMoney(n) : String(n));
            problems.push(`${spec.card[0]}: V4 ${fmt(v4Value)} vs V1 ${fmt(v1)}`);
          }
        }
        fail(problems, 'TC-RV4-13 (⚠️ in the scan) Staff Income V4 vs V1 parity');
      },
    );
  });

  /* ------------------------------------------------------------------ *
   * Staff Payroll V4
   * ------------------------------------------------------------------ */

  describe('Staff Payroll V4', () => {
    beforeEach(async () => {
      await reportsV4Page.open('staff-payroll');
    });

    it(
      title('TC-RV4-14: defaults to the current period with period_id in the URL', Tag.REGRESSION),
      async () => {
        const url = await reportsV4Page.waitForPeriodIdInUrl();
        const combobox = await reportsV4Page.firstComboboxText();
        expect(V4Labels.currentPeriod.some((t) => combobox.startsWith(t))).toBe(true);
        expect(new URL(url).searchParams.get('period_id')).toBeTruthy();
      },
    );

    it(
      title(
        'TC-RV4-15: Total staff equals the row count and Σ columns equal their cards',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        const cards = await readAllStaffCards(reportsV4Page);
        const rows = await reportsV4Page.staffRows();
        const problems = staffSumProblems(cards, rows);
        const totalStaff = cards.get(V4Labels.totalStaff[0])!;
        if (totalStaff !== rows.length)
          problems.unshift(`Total staff card ${String(totalStaff)} vs ${String(rows.length)} rows`);
        fail(problems, `TC-RV4-15 (⚠️ in the scan). ${VIRTUALISATION_NOTE}`);
      },
    );

    it(
      title(
        'TC-RV4-16: Staff Payroll V4 totals match V1 (/incomes/staff-payroll) for the same period',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        const v4Period = await reportsV4Page.firstComboboxText();
        const v4 = await readAllStaffCards(reportsV4Page);

        await legacyStaffPayrollReport.open();
        const v1Period = await legacyStaffPayrollReport.firstComboboxText();
        const v1 = await readAllStaffCards(legacyStaffPayrollReport);

        const problems: string[] = [];
        if (v1Period !== v4Period) problems.push(`period differs: V4 "${v4Period}" vs V1 "${v1Period}"`);
        for (const spec of STAFF_CARDS) {
          const a = v4.get(spec.card[0])!;
          const b = v1.get(spec.card[0])!;
          if (a !== b) {
            const fmt = (n: number): string => (spec.money ? formatMoney(n) : String(n));
            problems.push(`${spec.card[0]}: V4 ${fmt(a)} vs V1 ${fmt(b)}`);
          }
        }
        fail(problems, 'TC-RV4-16 (⚠️ in the scan) Staff Payroll V4 vs V1 parity');
      },
    );
  });

  it(
    title(
      'TC-RV4-17: a date range longer than 1 year is blocked or rejected clearly (VP-4883 / VP-4927) — PENDING (date picker not scanned yet)',
    ),
  );
});
