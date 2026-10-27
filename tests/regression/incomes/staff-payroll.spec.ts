/**
 * Staff Payroll — `/incomes/staff-payroll`.
 *
 * Source: docs/screens/staff-payroll/staff-payroll-test-cases.md, the "Test
 * Case" table (TC-01…TC-13, one `it()` each, IDs unchanged — scoped by this
 * `describe()` so the bare IDs stay unambiguous).
 *
 * ## Invariants, not the doc's numbers
 *
 * The doc's "26 rows", Tony/Hugo/Val and the Jun 28–29 −$8.00 came from shop
 * 100004 in July. On merchant 14 the roster is 337 and the period is whatever is
 * current, so every case asserts what must hold on any data:
 *
 * - row count == the Total staff card;
 * - Σ Orders / Subtotal / Supply Fee / Tip / Total Income == the matching card,
 *   in integer cents (the cards are a `sumBy` over the same list);
 * - a negative Total Income is rendered negative (searched across periods);
 * - the detail panel's layout is read from what it shows (salary vs commission).
 *
 * ## Pending
 *
 * TC-10/11/12 compare this screen with the FASTBOY Portal (another app, SSO
 * login). That lane is not wired into this suite.
 *
 * ## Read-only
 *
 * Nothing is created. TC-01 clears the passcode grant to observe the gate; the
 * `after` hook re-arms it regardless.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/index.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { staffPayrollPage } from '../../../src/pages/index.js';
import { PAYROLL_LABELS } from '../../../src/pages/payroll/StaffPayrollPage.js';
import {
  fieldCents,
  findField,
  type DetailField,
  type StaffListRow,
} from '../../../src/pages/incomes/staffIncomeTable.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual, sumCents } from '../../../src/utils/money.js';

/** Labels both layouts render (`staff-payroll-detail-salary/commission.tsx`). */
const COMMON_LABELS = [
  PAYROLL_LABELS.cleanUpFee,
  PAYROLL_LABELS.tip,
  PAYROLL_LABELS.cardChargeTip,
  PAYROLL_LABELS.totalIncome,
  PAYROLL_LABELS.pay1,
  PAYROLL_LABELS.pay2,
] as const;

const missingLabels = (fields: DetailField[], groups: readonly (readonly string[])[]): string[] =>
  groups.filter((labels) => findField(fields, ...labels) === null).map((labels) => labels[0] ?? '?');

/** How many periods TC-09 is willing to walk looking for a negative row. */
const MAX_PERIODS_SCANNED = 8;

describe('Staff Payroll', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await ensurePasscodeGrant();
  });

  it(
    title('Passcode gate hides the page until the passcode is entered (TC-01)', Tag.REGRESSION),
    async () => {
      await step('Drop the 30-minute grant and open the route', async () => {
        await returnToHome();
        await clearPasscodeGrant();
        await staffPayrollPage.navigateGated();
      });

      expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(true);
      expect(await staffPayrollPage.gateTitle()).toMatch(/Staff Payroll|Bảng lương nhân viên/);
      expect(await staffPayrollPage.isLoaded(Timeouts.ANIMATION)).toBe(false);

      await step('Enter the owner passcode', () => passcodeDialog.unlockForRun(env.OWNER_PASSCODE));
      expect(await staffPayrollPage.isLoaded(Timeouts.MEDIUM)).toBe(true);
    },
  );

  it(title('The summary bar shows all 6 statistic cards (TC-02)', Tag.REGRESSION), async () => {
    await staffPayrollPage.open();
    const stats = await staffPayrollPage.allStats();

    // A named list rather than a boolean, so a failure says WHICH card is blank.
    expect(
      Object.entries(stats)
        .filter(([, text]) => text === '')
        .map(([stat]) => stat),
    ).toEqual([]);
  });

  it(title('Table row count equals the Total staff card (TC-03)', Tag.REGRESSION), async () => {
    await staffPayrollPage.open();
    const { rows } = await staffPayrollPage.readList();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBe(await staffPayrollPage.statCount('totalStaff'));
  });

  it(title('Column sums equal the summary cards (TC-04)', Tag.REGRESSION, Tag.CRITICAL), async () => {
    await staffPayrollPage.open();
    const { rows } = await staffPayrollPage.readList();

    expect(rows.reduce((n, r) => n + r.orders, 0)).toBe(await staffPayrollPage.statCount('totalOrders'));
    expectCentsEqual(
      sumCents(rows.map((r) => r.subtotalCents)),
      await staffPayrollPage.statCents('totalSubtotal'),
      'Staff Payroll: Σ Subtotal vs Total subtotal',
    );
    expectCentsEqual(
      sumCents(rows.map((r) => r.supplyFeeCents)),
      await staffPayrollPage.statCents('totalSupplyFee'),
      'Staff Payroll: Σ Supply Fee vs Total supply fee',
    );
    expectCentsEqual(
      sumCents(rows.map((r) => r.tipCents)),
      await staffPayrollPage.statCents('totalTip'),
      'Staff Payroll: Σ Tip vs Total tip',
    );
    // Negative rows included as negatives — clamping one to 0 breaks this too.
    expectCentsEqual(
      sumCents(rows.map((r) => r.totalIncomeCents)),
      await staffPayrollPage.statCents('totalStaffIncome'),
      'Staff Payroll: Σ Total Income vs Total staff income',
    );
  });

  it(title('Search filters the staff list by nickname (TC-05)', Tag.REGRESSION), async () => {
    await staffPayrollPage.open();
    const { rows } = await staffPayrollPage.readList();

    // A nickname that is distinctive enough to search for: prefer someone with
    // orders, and at least 3 characters so the filter actually narrows.
    const target =
      rows.find((r) => r.orders > 0 && r.name.length >= 3) ?? rows.find((r) => r.name.length >= 3) ?? rows[0];
    if (!target) throw new Error('Staff Payroll listed no staff to search for.');

    try {
      await staffPayrollPage.search(target.name);
      const filtered = (await staffPayrollPage.readList()).rows;

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.length).toBeLessThanOrEqual(rows.length);
      expect(filtered.map((r) => r.name)).toContain(target.name);
      const strays = filtered.filter((r) => !r.name.toLowerCase().includes(target.name.toLowerCase()));
      expect(strays.map((r) => r.name)).toEqual([]);
    } finally {
      await staffPayrollPage.search('');
    }
  });

  it(
    title('Changing the pay period updates the URL and reloads the table (TC-06)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await staffPayrollPage.open();
      const labelBefore = await staffPayrollPage.periodText();
      const periodBefore = await staffPayrollPage.periodIdFromUrl();

      const options = await staffPayrollPage.periodOptions();
      const otherIndex = options.findIndex((label) => label !== labelBefore);
      if (otherIndex < 0) {
        throw new Error(
          `Staff Payroll offers only one pay period (${options.join(', ')}); nothing to switch to.`,
        );
      }

      const chosen = await staffPayrollPage.selectPeriodAt(otherIndex);

      expect(await staffPayrollPage.periodText()).toBe(chosen);
      const periodAfter = await staffPayrollPage.periodIdFromUrl();
      expect(periodAfter).not.toBeNull();
      expect(periodAfter).not.toBe(periodBefore);

      // Reloaded, and internally consistent for the NEW period.
      const { rows } = await staffPayrollPage.readList();
      expect(rows.length).toBe(await staffPayrollPage.statCount('totalStaff'));
      expectCentsEqual(
        sumCents(rows.map((r) => r.totalIncomeCents)),
        await staffPayrollPage.statCents('totalStaffIncome'),
        `Staff Payroll (${chosen}): Σ Total Income vs Total staff income`,
      );
    },
  );

  it(title('Clicking a row with orders opens the payroll detail panel (TC-07)', Tag.REGRESSION), async () => {
    await staffPayrollPage.open();
    const { rows } = await staffPayrollPage.readList();
    const row = rows.find((r) => r.orders > 0);
    if (!row)
      throw new Error(
        'No staff member has orders in the current pay period — nothing to open (TC-07 precondition).',
      );

    await staffPayrollPage.openStaffDetailAt(row.index);
    const header = await staffPayrollPage.detailHeader();
    const fields = await staffPayrollPage.detailFields();

    expect(header.name).toBe(row.name);
    expect(header.range).not.toBe('');
    expect(missingLabels(fields, COMMON_LABELS)).toEqual([]);

    // Layout-specific base figures (TC-13 checks the split in depth).
    const type = await staffPayrollPage.payType();
    expect(['salary', 'commission']).toContain(type);
    if (type === 'salary') {
      expect(
        missingLabels(fields, [
          PAYROLL_LABELS.workingDays,
          PAYROLL_LABELS.workingHours,
          PAYROLL_LABELS.salaryAmount,
        ]),
      ).toEqual([]);
    }

    // The listing and the panel describe the same payroll.
    const total = fieldCents(fields, ...PAYROLL_LABELS.totalIncome);
    expect(total).not.toBeNull();
    expectCentsEqual(
      total ?? 0,
      row.totalIncomeCents,
      `Staff Payroll: ${row.name} detail Total Income vs listing`,
    );
    expect(await staffPayrollPage.thankYouText()).toContain(row.name);
  });

  it(
    title('A staff member with 0 orders shows zeros / No Data, not an error (TC-08)', Tag.REGRESSION),
    async () => {
      await staffPayrollPage.open();
      const { rows } = await staffPayrollPage.readList();
      const row =
        rows.find((r) => r.orders === 0 && r.totalIncomeCents === 0) ?? rows.find((r) => r.orders === 0);
      if (!row)
        throw new Error(
          'Every staff member has orders this period — no 0-order row to open (TC-08 precondition).',
        );

      await staffPayrollPage.openStaffDetailAt(row.index);

      expect(await staffPayrollPage.hasLoadError()).toBe(false);
      expect((await staffPayrollPage.detailHeader()).name).toBe(row.name);

      if (await staffPayrollPage.hasNoData()) return; // `global.noData` — the app's own empty state

      // Otherwise the panel renders: its sales-side money must be zero.
      const fields = await staffPayrollPage.detailFields();
      for (const labels of [
        PAYROLL_LABELS.sale,
        PAYROLL_LABELS.refund,
        PAYROLL_LABELS.subtotal,
        PAYROLL_LABELS.supplyFee,
      ]) {
        const cents = fieldCents(fields, ...labels);
        if (cents !== null)
          expectCentsEqual(cents, 0, `Staff Payroll: ${row.name} (0 orders) ${labels[0] ?? ''}`);
      }
      const total = fieldCents(fields, ...PAYROLL_LABELS.totalIncome);
      expect(total).not.toBeNull();
      expectCentsEqual(
        total ?? 0,
        row.totalIncomeCents,
        `Staff Payroll: ${row.name} detail Total Income vs listing`,
      );
    },
  );

  it(
    title('A negative Total Income is shown negative, not clamped to $0.00 (TC-09)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await staffPayrollPage.open();

      let period = await staffPayrollPage.periodText();
      const options = await staffPayrollPage.periodOptions();
      const findNegative = async (): Promise<StaffListRow | undefined> =>
        (await staffPayrollPage.readList()).rows.find((r) => r.totalIncomeCents < 0);

      // Walk periods until one has a negative row (merchant 14's current period
      // had one on 2026-10-25: −$257.91). Fail only when none of them do.
      let negative = await findNegative();
      for (let idx = 0; !negative && idx < Math.min(options.length, MAX_PERIODS_SCANNED); idx++) {
        if (options[idx] === period) continue;
        period = await staffPayrollPage.selectPeriodAt(idx);
        negative = await findNegative();
      }
      if (!negative) {
        throw new Error(
          `No staff member has a negative Total Income in the first ${String(MAX_PERIODS_SCANNED)} pay periods — ` +
            'the fixture this case needs (refunds exceeding sales) is absent.',
        );
      }

      expect(negative.cells[5] ?? '').toMatch(/^-/);

      await staffPayrollPage.openStaffDetailAt(negative.index);
      const total = fieldCents(await staffPayrollPage.detailFields(), ...PAYROLL_LABELS.totalIncome);
      expect(total).not.toBeNull();
      expect(total ?? 0).toBeLessThan(0);
      expectCentsEqual(
        total ?? 0,
        negative.totalIncomeCents,
        `Staff Payroll (${period}): negative Total Income, detail vs listing`,
      );
    },
  );

  it(
    title(
      'TC-10: cross-app — Volt POS vs FASTBOY Portal, same period, every row and summary — PENDING (needs the Portal lane: SSO login to dev.v2.fastboypay.com, not wired into this suite)',
    ),
  );

  it(
    title(
      'TC-11: cross-app comparison holds over at least 3 periods — PENDING (needs the Portal lane: SSO login to dev.v2.fastboypay.com, not wired into this suite)',
    ),
  );

  it(
    title(
      'TC-12: cross-app — every staff detail panel matches the Portal field by field — PENDING (needs the Portal lane: SSO login to dev.v2.fastboypay.com, not wired into this suite)',
    ),
  );

  it(
    title('The detail layout matches payType: salary vs commission (TC-13)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await staffPayrollPage.open();
      const { rows } = await staffPayrollPage.readList();

      // Commission staff with orders show the daily table; salary staff often
      // earn with 0 orders. Try the likeliest rows first, at most 25 openings.
      const candidates = [
        ...rows.filter((r) => r.orders > 0),
        ...rows.filter((r) => r.orders === 0 && r.totalIncomeCents !== 0),
      ].slice(0, 25);

      let salary: { row: StaffListRow; fields: DetailField[]; daily: boolean } | null = null;
      let commission: { row: StaffListRow; fields: DetailField[]; daily: boolean } | null = null;
      const seen: string[] = [];

      for (const row of candidates) {
        if (salary && commission) break;
        await staffPayrollPage.openStaffDetailAt(row.index);
        const type = await staffPayrollPage.payType();
        seen.push(`${row.name}:${type}`);
        const probe = {
          row,
          fields: await staffPayrollPage.detailFields(),
          daily: await staffPayrollPage.hasDailyBreakdown(),
        };
        if (type === 'salary' && !salary) salary = probe;
        if (type === 'commission' && !commission && row.orders > 0) commission = probe;
      }

      if (!salary || !commission) {
        throw new Error(
          `Need one salary and one commission (with orders) staff member in the current period; saw ${seen.join(', ') || 'nobody'}.`,
        );
      }

      // Salary: Working Hours + Salary Amount, no per-day table, no commission lines.
      expect(
        missingLabels(salary.fields, [PAYROLL_LABELS.workingHours, PAYROLL_LABELS.salaryAmount]),
      ).toEqual([]);
      expect(salary.daily).toBe(false);
      expect(findField(salary.fields, ...PAYROLL_LABELS.staffCommission)).toBeNull();
      expect(findField(salary.fields, ...PAYROLL_LABELS.discountCharge)).toBeNull();

      // Commission: per-day table + Sale/Refund/Staff Commission/Discount Charge,
      // no Working Hours / Salary Amount.
      expect(commission.daily).toBe(true);
      expect(
        missingLabels(commission.fields, [
          PAYROLL_LABELS.sale,
          PAYROLL_LABELS.refund,
          PAYROLL_LABELS.staffCommission,
          PAYROLL_LABELS.discountCharge,
        ]),
      ).toEqual([]);
      expect(findField(commission.fields, ...PAYROLL_LABELS.workingHours)).toBeNull();
      expect(findField(commission.fields, ...PAYROLL_LABELS.salaryAmount)).toBeNull();
    },
  );
});
