import type { PayPeriod } from '../pages/settings/BusinessInfoPage.js';

/**
 * How long the pay period containing a given date is, in days.
 *
 * ## Why this matters to a money assertion
 *
 * It is the salary proration divisor. A staff member on `salary_by_period`
 * earns `salaryAmount ÷ periodDays` per day, so a spec that checks a salaried
 * payout has to know the period length or it is asserting against a number it
 * cannot predict. {@link computeIncomeSummary} takes it as `PeriodInput.periodDays`.
 *
 * ## When NOT to use this
 *
 * Only for an OPEN period. Once a period is finalized the backend stores the
 * exact window it settled with, and that window can differ from the nominal
 * length — a period closed early, or one that spanned a configuration change.
 * `StaffInput.finalizedSalary.workDays` carries it; prefer that whenever it is
 * available, and use this function for today and for open periods.
 *
 * The type union deliberately reuses `BusinessInfoPage`'s `PayPeriod`, so what
 * the screen reports and what this computes cannot drift apart.
 */

const daysInMonth = (year: number, monthIndex: number): number => new Date(year, monthIndex + 1, 0).getDate();

/**
 * The length of the period containing `date`.
 *
 * - `weekly` → 7, `biweekly` → 14. Fixed, independent of the date.
 * - `monthly` → the calendar month's length, so February is genuinely shorter.
 * - `custom` → see below.
 * - `unknown` → the calendar month's length. A fallback rather than a throw:
 *   the divisor must be non-zero or every salaried payout becomes zero, and a
 *   month is the least surprising guess. A spec that cares should assert the
 *   type it read is not `unknown` before trusting the number.
 *
 * ## Custom periods
 *
 * The configured days are the LAST day of each in-month period, not the first.
 * Periods partition the month: the first starts on the 1st, and each later one
 * starts the day after the previous cut. A cut-off greater than the month's
 * length means "end of month" — that is how a `31` behaves in February — so
 * they are clamped before use, and the month end is always appended so the last
 * period is bounded.
 */
export function computePeriodDays(payPeriod: PayPeriod, date: Date): number {
  const monthLength = daysInMonth(date.getFullYear(), date.getMonth());

  switch (payPeriod.type) {
    case 'weekly':
      return 7;

    case 'biweekly':
      return 14;

    case 'monthly':
      return monthLength;

    case 'custom': {
      const day = date.getDate();

      const cuts = [...new Set(payPeriod.customDays.map((cut) => Math.min(cut, monthLength)))]
        .filter((cut) => cut >= 1)
        .sort((a, b) => a - b);

      if (!cuts.includes(monthLength)) cuts.push(monthLength);

      let start = 1;
      for (const end of cuts) {
        if (day <= end) return end - start + 1;
        start = end + 1;
      }

      // Unreachable — the month end is always a cut — but a wrong divisor is
      // worse than a defensive one.
      return monthLength;
    }

    default:
      return monthLength;
  }
}

/**
 * The first and last day of the period containing `date`.
 *
 * For a spec that needs the RANGE rather than the length — fetching every day
 * of a period from `ReportService` to check that a payout sums correctly across
 * it. Weekly and biweekly are anchored to the month start rather than to a
 * weekday, matching how {@link computePeriodDays} partitions.
 */
export function computePeriodRange(payPeriod: PayPeriod, date: Date): { from: Date; to: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthLength = daysInMonth(year, month);
  const day = date.getDate();
  const length = computePeriodDays(payPeriod, date);

  if (payPeriod.type === 'monthly' || payPeriod.type === 'unknown') {
    return { from: new Date(year, month, 1), to: new Date(year, month, monthLength) };
  }

  if (payPeriod.type === 'custom') {
    const cuts = [...new Set(payPeriod.customDays.map((cut) => Math.min(cut, monthLength)))]
      .filter((cut) => cut >= 1)
      .sort((a, b) => a - b);
    if (!cuts.includes(monthLength)) cuts.push(monthLength);

    let start = 1;
    for (const end of cuts) {
      if (day <= end) return { from: new Date(year, month, start), to: new Date(year, month, end) };
      start = end + 1;
    }
    return { from: new Date(year, month, 1), to: new Date(year, month, monthLength) };
  }

  // Weekly / biweekly: fixed-length blocks counted from the 1st.
  const index = Math.floor((day - 1) / length);
  const from = index * length + 1;
  return {
    from: new Date(year, month, from),
    to: new Date(year, month, Math.min(from + length - 1, monthLength)),
  };
}
