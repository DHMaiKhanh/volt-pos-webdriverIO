/**
 * The money model, checked without the app.
 *
 * ## Why these exist at all
 *
 * `src/domain/incomeCalc.ts` is a port — of `report.rs`, by way of a Playwright
 * suite. Every income oracle in this repo is built on it, so a transcription
 * slip here would not surface as a failing spec; it would surface as an ORACLE
 * that agrees with the wrong number and a suite that reports green while the
 * payout is broken. That is the one failure mode automation cannot catch by
 * running more of itself.
 *
 * These are pure-function tests: no app, no driver, no merchant. They run with
 * `npm run test:unit` in about a second, so they can gate a commit.
 *
 * ## What is asserted
 *
 * The rules a reader would otherwise have to trust the comments for — the
 * rounding, the `commission_salary` maximum, the tip-exclusion flag's inverted
 * name, who the card fee applies to, and how Pay 1 absorbs the deductions.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeIncomeSummary,
  computePeriodDays,
  rdiv,
  type CompensationInput,
  type PeriodInput,
  type StaffInput,
  type StoreSaleInput,
} from '../../src/domain/index.js';

const comp = (overrides: Partial<CompensationInput> = {}): CompensationInput => ({
  compType: 'commission',
  percentService: 60,
  pay1Split: 100,
  cardFeeCommissionPct: 0,
  deductionPerDay: 0,
  salaryAmount: 0,
  salarySetting: 'salary_by_period',
  enablePayrollTip: false,
  ...overrides,
});

const staff = (overrides: Partial<StaffInput> = {}): StaffInput => ({
  staffId: 'staff-1',
  name: 'Amelia',
  serviceNet: 0,
  supplyNet: 0,
  tip: 0,
  cardBase: 0,
  checkedIn: true,
  workedMinutes: 0,
  comp: comp(),
  ...overrides,
});

const NO_SALES: StoreSaleInput = {
  serviceSale: 0,
  serviceRefund: 0,
  productSale: 0,
  productRefund: 0,
  giftCardSale: 0,
  totalDiscount: 0,
  supplyTotal: 0,
};

const OPEN_MONTH: PeriodInput = { periodDays: 30, finalized: false };

describe('rdiv', () => {
  it('rounds half UP, which Math.round does not for negatives', () => {
    assert.equal(rdiv(10, 4), 3); // 2.5 → 3
    assert.equal(rdiv(14, 4), 4); // 3.5 → 4
    assert.equal(rdiv(9, 4), 2); // 2.25 → 2
  });

  it('returns 0 for a non-positive divisor instead of throwing', () => {
    // A zero pay period is a configuration state, not a crash — the backend
    // behaves the same way, and a throw here would fail a spec on a merchant
    // whose pay period is simply unset.
    assert.equal(rdiv(1_000, 0), 0);
    assert.equal(rdiv(1_000, -5), 0);
  });

  it('is exact where a float would not be', () => {
    // 4.615 * 100 is 461.49999999999994 in IEEE-754. Integer arithmetic has no
    // such value, which is the whole reason this function exists.
    assert.equal(rdiv(4_615 * 100, 100), 4_615);
  });
});

describe('computeIncomeSummary — commission', () => {
  it('splits service revenue by the staff percentage', () => {
    const result = computeIncomeSummary(
      NO_SALES,
      [staff({ serviceNet: 10_000, comp: comp({ percentService: 60 }) })],
      OPEN_MONTH,
    );

    assert.equal(result.commission, 6_000);
    // The salon keeps the remaining 40%, less its share of the supply fee.
    assert.equal(result.salonCommission, 4_000);
  });

  it('charges the supply fee before commission, then splits the fee itself', () => {
    const result = computeIncomeSummary(
      { ...NO_SALES, supplyTotal: 1_000 },
      [staff({ serviceNet: 10_000, supplyNet: 1_000, comp: comp({ percentService: 60 }) })],
      OPEN_MONTH,
    );

    // 60% of (10_000 - 1_000), not of 10_000.
    assert.equal(result.commission, 5_400);
    assert.equal(result.staffSupplyShare, 600);
    assert.equal(result.salonSupplyShare, 400);
  });

  it('charges the card fee only to commission staff', () => {
    const withFee = comp({ cardFeeCommissionPct: 3, percentService: 60 });

    const commissionStaff = computeIncomeSummary(
      NO_SALES,
      [staff({ serviceNet: 10_000, cardBase: 10_000, comp: withFee })],
      OPEN_MONTH,
    );
    // 3% of (60% of 10_000) = 3% of 6_000 = 180.
    assert.equal(commissionStaff.cardCharge, 180);

    const salariedStaff = computeIncomeSummary(
      NO_SALES,
      [
        staff({
          serviceNet: 10_000,
          cardBase: 10_000,
          comp: comp({ ...withFee, compType: 'salary', salaryAmount: 30_000 }),
        }),
      ],
      OPEN_MONTH,
    );
    // A salaried staff member has no commission for the fee to be charged on.
    assert.equal(salariedStaff.cardCharge, 0);
  });
});

describe('computeIncomeSummary — tips', () => {
  it('adds the tip to total income by default', () => {
    const result = computeIncomeSummary(NO_SALES, [staff({ serviceNet: 10_000, tip: 500 })], OPEN_MONTH);
    assert.equal(result.payoutTip, 500);
    assert.equal(result.payoutTotal, 6_000 + 500);
  });

  it('EXCLUDES the tip when enablePayrollTip is true, despite the name', () => {
    // The flag reads as "pay the tip here" and means the opposite: payroll
    // handles it, so the payout drops it. Asserted because the name invites the
    // wrong reading and a spec written on that reading would be off by the tip.
    const result = computeIncomeSummary(
      NO_SALES,
      [staff({ serviceNet: 10_000, tip: 500, comp: comp({ enablePayrollTip: true }) })],
      OPEN_MONTH,
    );
    assert.equal(result.payoutTip, 0);
    assert.equal(result.payoutTotal, 6_000);
  });
});

describe('computeIncomeSummary — salary', () => {
  it('prorates salary_by_period over the period length', () => {
    const result = computeIncomeSummary(
      NO_SALES,
      [
        staff({
          comp: comp({ compType: 'salary', salaryAmount: 300_000, salarySetting: 'salary_by_period' }),
        }),
      ],
      { periodDays: 30, finalized: false },
    );
    assert.equal(result.salary, 10_000);
  });

  it('pays wage_per_day only when the staff clocked in', () => {
    const paid = comp({ compType: 'salary', salaryAmount: 12_000, salarySetting: 'wage_per_day' });

    const clockedIn = computeIncomeSummary(NO_SALES, [staff({ checkedIn: true, comp: paid })], OPEN_MONTH);
    assert.equal(clockedIn.salary, 12_000);

    const absent = computeIncomeSummary(NO_SALES, [staff({ checkedIn: false, comp: paid })], OPEN_MONTH);
    assert.equal(absent.salary, 0);
  });

  it('pays wage_per_hour by the minute, independent of the period', () => {
    const result = computeIncomeSummary(
      NO_SALES,
      [
        staff({
          workedMinutes: 90,
          comp: comp({ compType: 'salary', salaryAmount: 2_000, salarySetting: 'wage_per_hour' }),
        }),
      ],
      OPEN_MONTH,
    );
    // $20/hour for 90 minutes = $30.
    assert.equal(result.salary, 3_000);
  });

  it('treats commission_salary as a MAXIMUM on an open period, not a sum', () => {
    const salaryWins = computeIncomeSummary(
      NO_SALES,
      [
        staff({
          serviceNet: 1_000, // commission = 600
          comp: comp({ compType: 'commission_salary', salaryAmount: 300_000 }), // 10_000/day
        }),
      ],
      OPEN_MONTH,
    );
    assert.equal(salaryWins.salary, 10_000);

    const commissionWins = computeIncomeSummary(
      NO_SALES,
      [
        staff({
          serviceNet: 100_000, // commission = 60_000
          comp: comp({ compType: 'commission_salary', salaryAmount: 300_000 }), // 10_000/day
        }),
      ],
      OPEN_MONTH,
    );
    // The salary LINE is zero — the commission stands on its own. Adding the two
    // would disagree with the screen, and the screen is right.
    assert.equal(commissionWins.salary, 0);
  });
});

describe('computeIncomeSummary — Pay 1 / Pay 2', () => {
  it('takes the clean-up deduction and card fee entirely out of Pay 1', () => {
    const result = computeIncomeSummary(
      NO_SALES,
      [
        staff({
          serviceNet: 10_000,
          cardBase: 10_000,
          tip: 1_000,
          comp: comp({ percentService: 60, pay1Split: 50, deductionPerDay: 500, cardFeeCommissionPct: 3 }),
        }),
      ],
      OPEN_MONTH,
    );

    const commission = 6_000;
    const cardFee = 180;
    const cleanUp = 500;
    const expectedPay1 = rdiv(commission * 50, 100) - cleanUp - cardFee;

    assert.equal(result.pay1, expectedPay1);
    // Pay 2 is the remainder, so the two always reconstruct the total exactly —
    // it is not a second percentage of the base.
    assert.equal(result.pay1 + result.pay2, result.payoutTotal);
  });
});

describe('computePeriodDays', () => {
  const date = new Date(2026, 1, 15); // 15 Feb 2026 — a 28-day month.

  it('is fixed for weekly and biweekly', () => {
    assert.equal(computePeriodDays({ type: 'weekly', customDays: [] }, date), 7);
    assert.equal(computePeriodDays({ type: 'biweekly', customDays: [] }, date), 14);
  });

  it('follows the calendar for monthly, so February is genuinely shorter', () => {
    assert.equal(computePeriodDays({ type: 'monthly', customDays: [] }, date), 28);
    assert.equal(computePeriodDays({ type: 'monthly', customDays: [] }, new Date(2026, 0, 15)), 31);
  });

  it('partitions the month at the custom cut-off days', () => {
    const custom = { type: 'custom' as const, customDays: [15, 31] };
    // 10th falls in the first period: days 1..15.
    assert.equal(computePeriodDays(custom, new Date(2026, 0, 10)), 15);
    // 20th falls in the second: days 16..31.
    assert.equal(computePeriodDays(custom, new Date(2026, 0, 20)), 16);
  });

  it('clamps a cut-off past the month end, which is how 31 behaves in February', () => {
    const custom = { type: 'custom' as const, customDays: [15, 31] };
    // 31 clamps to 28, so the second period is 16..28 — thirteen days.
    assert.equal(computePeriodDays(custom, new Date(2026, 1, 20)), 13);
  });

  it('falls back to the month length when the type could not be read', () => {
    // A non-zero divisor matters more than being right: zero would make every
    // salaried payout zero, which looks like a data problem rather than a
    // scraping one.
    assert.equal(computePeriodDays({ type: 'unknown', customDays: [] }, date), 28);
  });
});
