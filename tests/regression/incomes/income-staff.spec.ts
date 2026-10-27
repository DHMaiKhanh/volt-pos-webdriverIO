/**
 * Staff Income — `/incomes/income-staff`.
 *
 * Source: docs/screens/income-staff/income-staff-test-cases.md, PHẦN C table
 * (TC-IST-01…18, one `it()` each, IDs unchanged). The legacy VP-1402 appendix in
 * the same doc is a different, Excel-style catalogue and is not ported here.
 *
 * ## Invariants, not the doc's numbers
 *
 * The doc's figures (Sophia $126.17, Teri Jennings −$369.72, …) came from
 * another merchant/day. Everything below asserts what must hold on ANY data:
 * the summary cards equal the column sums in cents (`income-staff-summary.tsx`
 * is a plain `sumBy` over the visible rows), the row count equals Total staff,
 * and the detail panel's own formula lines agree with each other.
 *
 * ## What the installed build differs on (live DOM 1.1.56, 2026-10-25)
 *
 * - There is NO "Search staff" box on this screen (develop re-adds it), so
 *   TC-IST-05/14 are pending with that reason.
 * - The first column is headed "Name", not "Staff".
 * - A "Show staff with no income" switch exists (off by default) and hides
 *   zero-income rows; the cards are computed from the same filtered list.
 *
 * ## Read-only
 *
 * Nothing here creates data. TC-IST-01/02 clear the 30-minute passcode grant to
 * observe the gate and re-arm it; the `after` hook re-arms it regardless.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/index.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { incomeStaffPage } from '../../../src/pages/index.js';
import {
  fieldCents,
  findField,
  type DetailField,
  type StaffListData,
} from '../../../src/pages/incomes/staffIncomeTable.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual, sumCents } from '../../../src/utils/money.js';

/* ------------------------------------------------------------------------- *
 * Pure helpers — dates and labels. No selectors.
 * ------------------------------------------------------------------------- */

const pad = (n: number): string => String(n).padStart(2, '0');

/** The two ways the app prints a day: `MM/dd/yyyy` (EN) and `dd/MM/yyyy` (VI). */
const dayStrings = (d: Date): string[] => [
  `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`,
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
];

const startOfDayUnix = (d: Date): number => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return Math.floor(x.getTime() / 1_000);
};

const endOfDayUnix = (d: Date): number => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return Math.floor(x.getTime() / 1_000);
};

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

/**
 * A day no merchant-14 staff can have income on: years before the shop's data
 * starts. If this ever lists rows, the date — not the screen — is the problem.
 */
const EMPTY_DAY = new Date(2001, 0, 1);

const TODAY = ['Today', 'Hôm nay'];
const YESTERDAY = ['Yesterday', 'Hôm qua'];

/** `$#,##0.00`, negatives as `-$…` (currency.js `negativePattern: '-!#'`). */
const USD = /^-?\$\d{1,3}(,\d{3})*\.\d{2}$/;

/** Detail labels (EN + VI, `locales/*\/common.json`). */
const L = {
  sale: ['Sale', 'Doanh số'],
  refund: ['Refund', 'Hoàn tiền'],
  subtotal: ['Subtotal', 'Tạm tính'],
  staffCommission: ['Staff Commission', 'Hoa hồng nhân viên'],
  cardChargeCommission: ['Card Charge Commission', 'Phí thẻ - Hoa hồng'],
  cleanUpFee: ['Clean Up Fee/Deduction', 'Phí dọn dẹp/Khấu trừ'],
  discountCharge: ['Discount Charge', 'Phí khuyến mãi'],
  tip: ['Tip', 'Tiền boa'],
  cardChargeTip: ['Card Charge Tip', 'Tiền boa thanh toán bằng thẻ'],
  /** `global.staffTotalIncome` — "Thu nhập thực nhận" in VI (NOT "Tổng thu nhập", that is Gross). */
  totalIncome: ['Total Income', 'Thu nhập thực nhận'],
  salaryType: ['Salary Type', 'Loại lương'],
  rate: ['Rate', 'Mức lương'],
  grossIncome: ['Gross Income', 'Tổng thu nhập'],
  workingDays: ['Working Days', 'Số ngày làm'],
  workingHours: ['Working Hours', 'Số giờ làm'],
  wagePerHour: ['Wage Per Hour', 'Lương giờ'],
} as const;

const must = (fields: DetailField[], labels: readonly string[], what: string): number => {
  const cents = fieldCents(fields, ...labels);
  if (cents === null) {
    throw new Error(
      `Staff Income detail: no money value for "${labels[0] ?? what}". The panel shows: ` +
        fields.map((f) => `${f.label}=${f.value}`).join(' | '),
    );
  }
  return cents;
};

const within = (actual: number, expected: number, tolerance: number, label: string): void => {
  if (Math.abs(actual - expected) > tolerance) {
    expectCentsEqual(actual, expected, `${label} (tolerance ${String(tolerance)}¢)`);
  }
};

/**
 * Open a range that HAS staff rows — today first, the last 30 days as the
 * fallback — for the [data] cases. Throws, naming the cause, when neither does:
 * a [data] case on an empty list would pass without testing anything.
 */
async function openWithData(): Promise<StaffListData> {
  await incomeStaffPage.open(new Date());
  let list = await incomeStaffPage.readList();
  if (list.rows.length > 0) return list;

  await incomeStaffPage.openRange(daysAgo(29), new Date());
  list = await incomeStaffPage.readList();
  if (list.rows.length > 0) return list;

  throw new Error(
    'Staff Income lists no staff for today nor the last 30 days, so this [data] case has nothing to ' +
      'check. Take one payment on this till (or point MERCHANT_ID at a shop with activity) and re-run.',
  );
}

type Layout = 'commission' | 'salary';

const layoutOf = (fields: DetailField[]): Layout | null => {
  if (findField(fields, ...L.salaryType) || findField(fields, ...L.grossIncome)) return 'salary';
  if (findField(fields, ...L.staffCommission)) return 'commission';
  return null;
};

/**
 * Open staff details until one renders `wanted`'s layout. Rows most likely to be
 * that kind are tried first: commission staff have orders, salary staff earn
 * with zero orders.
 */
async function openDetailOfLayout(
  list: StaffListData,
  wanted: Layout,
  maxTries = 20,
): Promise<DetailField[]> {
  const ordered = [...list.rows].sort((a, b) => {
    const score = (r: (typeof list.rows)[number]): number =>
      wanted === 'commission' ? (r.orders > 0 ? 0 : 1) : r.orders === 0 && r.totalIncomeCents !== 0 ? 0 : 1;
    return score(a) - score(b);
  });

  const seen: string[] = [];
  for (const row of ordered.slice(0, maxTries)) {
    await incomeStaffPage.openStaffDetailAt(row.index);
    const fields = await incomeStaffPage.detailFields();
    const layout = layoutOf(fields);
    seen.push(`${row.name}:${layout ?? '?'}`);
    if (layout === wanted) return fields;
  }
  throw new Error(
    `No staff with a ${wanted} detail layout among the first ${String(maxTries)} rows (${seen.join(', ')}). ` +
      `The merchant needs at least one staff paid by ${wanted} with income in the range.`,
  );
}

/* ------------------------------------------------------------------------- *
 * Spec
 * ------------------------------------------------------------------------- */

describe('Staff Income', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    // TC-IST-01 drops the grant on purpose; never leave the lane prompting.
    await ensurePasscodeGrant();
  });

  it(
    title('Route is blocked by the passcode dialog before any data renders (TC-IST-01)', Tag.REGRESSION),
    async () => {
      await step('Drop the 30-minute grant and open the route', async () => {
        await returnToHome();
        await clearPasscodeGrant();
        await incomeStaffPage.navigateGated();
      });

      expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(true);
      // `global.enterStaffCodeToAccess` with the screen name interpolated.
      expect(await incomeStaffPage.gateTitle()).toMatch(/Staff Income|Thu nhập nhân viên/);
      // The report body does not mount behind the guard.
      expect(await incomeStaffPage.isLoaded(Timeouts.ANIMATION)).toBe(false);
    },
  );

  it(
    title(
      'The correct passcode opens the screen with the "Staff Income" title and summary (TC-IST-02)',
      Tag.REGRESSION,
    ),
    async () => {
      if (!(await passcodeDialog.isPrompting(Timeouts.SHORT))) {
        await returnToHome();
        await clearPasscodeGrant();
        await incomeStaffPage.navigateGated();
      }

      await step('Enter the owner passcode', () => passcodeDialog.unlockForRun(env.OWNER_PASSCODE));

      expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION)).toBe(false);
      expect(await incomeStaffPage.isLoaded(Timeouts.MEDIUM)).toBe(true);
      expect(await incomeStaffPage.statText('totalStaff')).not.toBe('');
    },
  );

  it(title('Default filter is Today and the range is today (TC-IST-03)', Tag.REGRESSION), async () => {
    await incomeStaffPage.openDefault();
    const today = new Date();

    expect(TODAY).toContain(await incomeStaffPage.presetText());
    expect(dayStrings(today)).toContain(await incomeStaffPage.dateRangeText());

    // The route fills from/to from a zod default; when the URL carries them they
    // must be today's midnight → end of day.
    const range = await incomeStaffPage.urlRange();
    if (range !== null) {
      expect(range.from).toBe(startOfDayUnix(today));
      expect(range.to).toBeGreaterThanOrEqual(startOfDayUnix(today));
      expect(range.to).toBeLessThanOrEqual(endOfDayUnix(today));
    }
  });

  it(title('The summary bar shows all 6 figures (TC-IST-04)', Tag.REGRESSION), async () => {
    await incomeStaffPage.open(new Date());
    const stats = await incomeStaffPage.allStats();

    // A named list rather than a boolean, so a failure says WHICH card is blank.
    expect(
      Object.entries(stats)
        .filter(([, text]) => text === '')
        .map(([stat]) => stat),
    ).toEqual([]);
    // Counts are integers, money parses — a card caught mid-load fails here, not later.
    expect(Number.isInteger(await incomeStaffPage.statCount('totalStaff'))).toBe(true);
    expect(Number.isInteger(await incomeStaffPage.statCount('totalOrders'))).toBe(true);
    await incomeStaffPage.statCents('totalStaffIncome');
  });

  it(
    title(
      'TC-IST-05: Search staff box is shown and accepts input — PENDING (build 1.1.56 renders no Search staff box on Staff Income; live DOM 2026-10-25)',
    ),
  );

  it(title('The date preset defaults to "Today" (TC-IST-06)', Tag.REGRESSION), async () => {
    await incomeStaffPage.open(new Date());
    expect(TODAY).toContain(await incomeStaffPage.presetText());
  });

  it(
    title('The calendar button shows the selected day as MM/DD/YYYY (TC-IST-07)', Tag.REGRESSION),
    async () => {
      await incomeStaffPage.open(new Date());
      const text = await incomeStaffPage.dateRangeText();

      expect(text).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(dayStrings(new Date())).toContain(text);
    },
  );

  it(
    title('The detail panel is empty until a staff member is chosen (TC-IST-08)', Tag.REGRESSION),
    async () => {
      // `open()` writes only from/to, never staffId, so nobody is selected.
      await incomeStaffPage.open(new Date());

      expect(await incomeStaffPage.hasNoDetail()).toBe(true);
      expect(await incomeStaffPage.noDetailHint()).toMatch(
        /Select staff to preview income details or print reports\.|Chọn nhân viên để xem chi tiết thu nhập hoặc in báo cáo\./,
      );
    },
  );

  it(
    title(
      'A day with no staff shows "No results found." and all totals at $0.00 / 0 (TC-IST-09)',
      Tag.REGRESSION,
    ),
    async () => {
      await incomeStaffPage.open(EMPTY_DAY);

      expect(await incomeStaffPage.isListEmpty()).toBe(true);
      expect(await incomeStaffPage.statCount('totalStaff')).toBe(0);
      expect(await incomeStaffPage.statCount('totalOrders')).toBe(0);
      for (const stat of ['totalSubtotal', 'totalSupplyFee', 'totalTip', 'totalStaffIncome'] as const) {
        expectCentsEqual(await incomeStaffPage.statCents(stat), 0, `Staff Income ${stat} on an empty day`);
      }
    },
  );

  it(title('Choosing a past day moves from/to in the URL (TC-IST-10)', Tag.REGRESSION), async () => {
    await incomeStaffPage.open(new Date());
    const yesterday = daysAgo(1);

    await incomeStaffPage.selectPreset(...YESTERDAY);

    const range = await incomeStaffPage.urlRange();
    expect(range).not.toBeNull();
    expect(range?.from).toBe(startOfDayUnix(yesterday));
    expect(range?.to ?? 0).toBeGreaterThanOrEqual(startOfDayUnix(yesterday));
    expect(range?.to ?? 0).toBeLessThanOrEqual(endOfDayUnix(yesterday));
    expect(dayStrings(yesterday)).toContain(await incomeStaffPage.dateRangeText());
  });

  it(
    title('Re-opening from the URL keeps from/to and the UI in step (TC-IST-11)', Tag.REGRESSION),
    async () => {
      const yesterday = daysAgo(1);
      await incomeStaffPage.open(yesterday);
      const before = await incomeStaffPage.urlRange();

      // Not a document reload — that re-runs the Tauri splash boot. Leaving and
      // re-entering with the same search is the same "rebuild from URL" path.
      await incomeStaffPage.remountFromUrl();

      expect(await incomeStaffPage.urlRange()).toEqual(before);
      expect(dayStrings(yesterday)).toContain(await incomeStaffPage.dateRangeText());
      expect(YESTERDAY).toContain(await incomeStaffPage.presetText());
    },
  );

  it(title('Every money figure in the summary bar is $#,##0.00 (TC-IST-12)', Tag.REGRESSION), async () => {
    await incomeStaffPage.open(new Date());

    const offenders: string[] = [];
    for (const stat of ['totalSubtotal', 'totalSupplyFee', 'totalTip', 'totalStaffIncome'] as const) {
      const text = await incomeStaffPage.statText(stat);
      if (!USD.test(text)) offenders.push(`${stat}="${text}"`);
    }
    expect(offenders).toEqual([]);
  });

  it(
    title(
      '[data] The staff table has the Name/Orders/Subtotal/Supply Fee/Tip/Total Income columns (TC-IST-13)',
      Tag.REGRESSION,
    ),
    async () => {
      const list = await openWithData();

      // The doc says "Staff"; the build heads the column "Name" (`global.name`).
      expect(['Name', 'Tên', 'Staff', 'Nhân viên']).toContain(list.headers[0]);
      expect(list.headers.slice(1)).toEqual([
        expect.stringMatching(/^(Orders|Đơn|Đơn hàng)$/),
        expect.stringMatching(/^(Subtotal|Tạm tính)$/),
        expect.stringMatching(/^(Supply Fee|Phí vật tư)$/),
        expect.stringMatching(/^(Tip|Tiền boa)$/),
        expect.stringMatching(/^(Total Income|Thu nhập thực nhận)$/),
      ]);
    },
  );

  it(
    title(
      'TC-IST-14: [data] Search filters by nickname — PENDING (build 1.1.56 renders no Search staff box on Staff Income; live DOM 2026-10-25)',
    ),
  );

  it(
    title(
      '[data] Clicking a staff row opens the detail panel with Print enabled (TC-IST-15)',
      Tag.REGRESSION,
    ),
    async () => {
      const list = await openWithData();
      const row = list.rows[0];
      if (!row) throw new Error('openWithData() returned no row');

      await incomeStaffPage.openStaffDetailAt(row.index);
      const header = await incomeStaffPage.detailHeader();

      expect(header.name).toBe(row.name);
      expect(header.range).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(await incomeStaffPage.isPrintEnabled()).toBe(true);
      expect(await incomeStaffPage.thankYouText()).toContain(row.name);
    },
  );

  it(
    title(
      '[data] Commission detail: Subtotal = Sale − Refund; Total = Commission − Clean up + Tip (TC-IST-16)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const list = await openWithData();
      const f = await step('Find a commission-paid staff member', () =>
        openDetailOfLayout(list, 'commission'),
      );

      const sale = must(f, L.sale, 'Sale');
      const refund = must(f, L.refund, 'Refund');
      const subtotal = must(f, L.subtotal, 'Subtotal');
      // The panel prints Refund as a magnitude (`refund * -1` in the mapper),
      // so the identity uses its absolute value.
      expectCentsEqual(subtotal, sale - Math.abs(refund), 'Staff Income detail: Subtotal vs Sale − Refund');

      // Total = Commission − Clean Up + Tip, minus the three charges the label
      // does not spell out (Card Charge Commission / Tip, Discount Charge) when ≠ 0.
      const expected =
        must(f, L.staffCommission, 'Staff Commission') -
        must(f, L.cleanUpFee, 'Clean Up Fee') +
        must(f, L.tip, 'Tip') -
        (fieldCents(f, ...L.cardChargeCommission) ?? 0) -
        (fieldCents(f, ...L.cardChargeTip) ?? 0) -
        (fieldCents(f, ...L.discountCharge) ?? 0);
      // ±2¢: each term is rounded by the backend independently.
      within(
        must(f, L.totalIncome, 'Total Income'),
        expected,
        2,
        'Staff Income detail: Total Income formula',
      );
    },
  );

  it(
    title(
      '[data] Salary detail: Gross Income = days/hours × Rate; Total = Gross − Clean up + Tip (TC-IST-17)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const list = await openWithData();
      const f = await step('Find a salary-paid staff member', () => openDetailOfLayout(list, 'salary'));

      const gross = must(f, L.grossIncome, 'Gross Income');
      const expectedTotal =
        gross -
        must(f, L.cleanUpFee, 'Clean Up Fee') +
        must(f, L.tip, 'Tip') -
        (fieldCents(f, ...L.cardChargeTip) ?? 0);
      within(
        must(f, L.totalIncome, 'Total Income'),
        expectedTotal,
        2,
        'Staff Income detail: salary Total Income formula',
      );

      // Gross = Rate × Working Days (or × Working Hours for Wage Per Hour). Only
      // checkable when the panel shows ONE rate as money — a mixed-setting or
      // multi-rate range prints "-" or a per-period list instead.
      const rate = fieldCents(f, ...L.rate);
      const type = findField(f, ...L.salaryType)?.value ?? '-';
      if (rate !== null && type !== '-') {
        const perHour = (L.wagePerHour as readonly string[]).includes(type);
        const unitsText = findField(f, ...(perHour ? L.workingHours : L.workingDays))?.value ?? '';
        const units = Number.parseFloat(unitsText);
        expect(Number.isFinite(units)).toBe(true);
        // Hours are displayed to 2 decimals, so allow half a hundredth of the rate.
        const tolerance = perHour ? Math.ceil(Math.abs(rate) * 0.005) + 1 : 1;
        within(
          gross,
          Math.round(rate * units),
          tolerance,
          `Staff Income detail: Gross vs Rate × ${perHour ? 'hours' : 'days'}`,
        );
      }
    },
  );

  it(
    title(
      "[data] Total staff income equals the sum of every row's Total Income (TC-IST-18)",
      Tag.REGRESSION,
      Tag.CRITICAL,
    ),
    async () => {
      const list = await openWithData();

      expectCentsEqual(
        await incomeStaffPage.statCents('totalStaffIncome'),
        sumCents(list.rows.map((r) => r.totalIncomeCents)),
        'Staff Income: Total staff income card vs Σ Total Income column',
      );
      // The same list feeds both — a mismatch means a row is hidden or doubled.
      expect(await incomeStaffPage.statCount('totalStaff')).toBe(list.rows.length);
    },
  );
});
