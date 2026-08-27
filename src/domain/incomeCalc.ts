/**
 * The Income Summary money model, recomputed independently of the app.
 *
 * ## What this is for
 *
 * The strongest assertion a report spec can make. Reading a total off the screen
 * and comparing it to a column the same backend computed proves the screen can
 * read; comparing it to a figure derived HERE, from the raw inputs, proves the
 * arithmetic. That is the difference between catching a rendering bug and
 * catching a formula that drifted.
 *
 * ## Provenance, and why that matters more than usual
 *
 * This is a port of `report.rs`, the backend's own payout calculation, by way of
 * a Playwright suite that has been checking it against a live merchant since
 * June. The field names below map one-to-one onto `src-entity/src/compensation.rs`
 * (`percent_service_staff`, `cash_check_split`, `deduction_per_day`,
 * `salary_amount`, `enable_payroll_tip`) — verified, not assumed.
 *
 * An oracle that imports the implementation it is checking is not an oracle, so
 * nothing here calls into the app. The cost is that a deliberate change to the
 * backend's formula shows up as a failing spec, which is the intended behaviour:
 * someone has to come here and confirm the change was meant.
 *
 * ## Everything is integer cents
 *
 * No `Math.round`, no float division. {@link rdiv} is the ONLY division, and it
 * reproduces the backend's rounding exactly.
 *
 * ## The inputs are source-agnostic
 *
 * The same shapes can be filled from the GraphQL API (`src/api`), from the local
 * SQLCipher database (`src/db`), or by scraping the screens. That is deliberate:
 * a reconciliation spec fills them one way, a unit-style spec another, and both
 * get the same numbers out.
 */

/**
 * Round-half-up integer division — the backend's `rdiv`.
 *
 * `Math.round(n / d)` is NOT the same thing and the difference is a cent on
 * exactly the values a payout produces. `d <= 0` returns 0 rather than throwing,
 * matching the backend: a zero divisor here means a pay period of zero days,
 * which is a configuration state, not a crash.
 */
export const rdiv = (numerator: number, divisor: number): number =>
  divisor <= 0 ? 0 : Math.floor((numerator + Math.floor(divisor / 2)) / divisor);

/** A staff member's compensation rule — the fields the payout math reads. */
export interface CompensationInput {
  /** `commission` | `salary` | `commission_salary`. Anything else behaves as commission-less. */
  compType: string;
  /** Staff's share of service revenue, as a percentage. `percent_service_staff`. */
  percentService: number;
  /** How the payout splits between Pay 1 and Pay 2, as a percentage. `cash_check_split`. */
  pay1Split: number;
  /** Card fee charged against staff commission, as a percentage. `percent_staff_commission`. */
  cardFeeCommissionPct: number;
  /** Deducted once for any day the staff checked in. Cents. `deduction_per_day`. */
  deductionPerDay: number;
  /** Cents. `salary_amount`. */
  salaryAmount: number;
  /** `salary_by_period` | `wage_per_day` | `wage_per_hour`. */
  salarySetting: string;
  /**
   * `enable_payroll_tip`.
   *
   * Confusingly named: when TRUE the tip is EXCLUDED from the staff's total
   * income. The flag means "payroll handles the tip", not "pay the tip here".
   */
  enablePayrollTip: boolean;
}

/** One staff member's day. */
export interface StaffInput {
  staffId: string;
  name: string;
  /** Service revenue net of refunds, before supply fee. Cents. */
  serviceNet: number;
  /** Supply fee on this staff's service items, net of refunds. Cents. */
  supplyNet: number;
  /** This staff's tip for the day. Cents. */
  tip: number;
  /** Service-net on CARD-paid orders — the base the card fee is charged on. Cents. */
  cardBase: number;
  /** Did they clock in at all? Drives the clean-up deduction and `wage_per_day`. */
  checkedIn: boolean;
  /** Minutes between check-in and check-out, for `wage_per_hour`. */
  workedMinutes: number;
  comp: CompensationInput;
  /**
   * The settled salary for a LOCKED pay period, and the work-days it was
   * prorated over. Omit unless the period is finalized.
   */
  finalizedSalary?: { salary: number; workDays: number };
}

/** Whole-shop sale figures for the day. All cents. */
export interface StoreSaleInput {
  serviceSale: number;
  serviceRefund: number;
  productSale: number;
  productRefund: number;
  giftCardSale: number;
  totalDiscount: number;
  /** Total supply fee across all service items, net of refunds. */
  supplyTotal: number;
}

/** Pay-period context, from Settings → Business Info. */
export interface PeriodInput {
  /** Days in the active pay period — the salary proration divisor. */
  periodDays: number;
  /** Is the period locked? A finalized period uses the settled salary. */
  finalized: boolean;
}

/** One row of the Staff Payout breakdown. */
export interface StaffPayoutRow {
  staffId: string;
  name: string;
  percentService: number;
  compType: string;
  serviceNet: number;
  supplyNet: number;
  commission: number;
  supplyShare: number;
  salonCommission: number;
  /** The EFFECTIVE tip — zero when `enablePayrollTip` excluded it. */
  tip: number;
  cleanUp: number;
  cardFee: number;
  salary: number;
  total: number;
  pay1: number;
  pay2: number;
}

/** Everything the Income Summary screen should be showing. All cents. */
export interface IncomeSummaryResult {
  // ── Sale Details ─────────────────────────────────────────────────────────
  serviceSale: number;
  serviceRefund: number;
  productSale: number;
  productRefund: number;
  giftCardSale: number;
  totalDiscount: number;
  totalService: number;

  // ── Supply fee split ─────────────────────────────────────────────────────
  supplyTotal: number;
  staffSupplyShare: number;
  salonSupplyShare: number;

  // ── Staff Payout (the store rollup IS the sum of the per-staff rows) ─────
  commission: number;
  payoutTip: number;
  cleanUp: number;
  cardCharge: number;
  salary: number;
  payoutTotal: number;
  pay1: number;
  pay2: number;

  // ── Salon Earnings ───────────────────────────────────────────────────────
  salonCommission: number;
  netEarnings: number;
  totalEarning: number;

  staff: StaffPayoutRow[];
}

/**
 * One staff member's salary for the day.
 *
 * Three settings, three rules:
 *
 * - `wage_per_hour` — rate × minutes ÷ 60. Independent of the pay period.
 * - `wage_per_day` — the full day rate, but ONLY if they clocked in. On a
 *   finalized period the settled salary is prorated over the work-days it was
 *   settled with, not over the period length.
 * - anything else (`salary_by_period`) — the salary prorated over the period.
 */
function dailySalary(staff: StaffInput, period: PeriodInput): number {
  const comp = staff.comp;
  const finalized = staff.finalizedSalary ?? { salary: 0, workDays: 0 };
  const workDays = finalized.workDays > 0 ? finalized.workDays : period.periodDays;

  if (comp.salarySetting === 'wage_per_hour') {
    return rdiv(comp.salaryAmount * staff.workedMinutes, 60);
  }

  if (comp.salarySetting === 'wage_per_day') {
    if (!staff.checkedIn) return 0;
    return period.finalized ? rdiv(finalized.salary, workDays) : comp.salaryAmount;
  }

  const amount = period.finalized ? finalized.salary : comp.salaryAmount;
  return rdiv(amount, period.periodDays);
}

/**
 * The whole Income Summary, from raw inputs. Pure — no I/O, no app imports.
 *
 * ## Two formulas worth reading before trusting a failure
 *
 * **`commission_salary` is a MAX, not a sum.** On an open period a staff on
 * `commission_salary` is reported a salary only when the salary would beat their
 * commission; otherwise the salary line is zero and the commission stands. On a
 * finalized period the settled salary is used unconditionally. A spec that adds
 * the two together will disagree with the screen, and the screen is right.
 *
 * **The card fee applies to `commission` only.** A salaried staff member has no
 * commission for the fee to be charged against, so `cardFee` is zero for them
 * even when the merchant's percentage is set.
 *
 * The staff rows come back sorted by total income, descending — the order the
 * screen renders them in, so a row-by-row comparison lines up without sorting.
 */
export function computeIncomeSummary(
  store: StoreSaleInput,
  staffInputs: StaffInput[],
  period: PeriodInput,
): IncomeSummaryResult {
  const totals = {
    commission: 0,
    tip: 0,
    cleanUp: 0,
    cardFee: 0,
    salary: 0,
    total: 0,
    pay1: 0,
    pay2: 0,
    supplyShare: 0,
    salonCommission: 0,
  };

  const staff: StaffPayoutRow[] = [];

  for (const input of staffInputs) {
    const comp = input.comp;

    const commission = rdiv((input.serviceNet - input.supplyNet) * comp.percentService, 100);
    const supplyShare = rdiv(input.supplyNet * comp.percentService, 100);
    const salonCommissionForStaff = rdiv(input.serviceNet * (100 - comp.percentService), 100);

    totals.supplyShare += supplyShare;
    totals.salonCommission += salonCommissionForStaff;

    const cleanUp = input.checkedIn ? comp.deductionPerDay : 0;
    // See CompensationInput.enablePayrollTip — TRUE removes the tip.
    const effectiveTip = comp.enablePayrollTip ? 0 : input.tip;

    const isSalaried = comp.compType === 'salary' || comp.compType === 'commission_salary';
    const salaryForDay = dailySalary(input, period);

    let reportedSalary = 0;
    if (comp.compType === 'salary') {
      reportedSalary = salaryForDay;
    } else if (comp.compType === 'commission_salary') {
      // The MAX rule — see the doc comment.
      reportedSalary = period.finalized ? salaryForDay : salaryForDay > commission ? salaryForDay : 0;
    }

    const cardFee =
      comp.cardFeeCommissionPct > 0 && comp.compType === 'commission'
        ? rdiv(rdiv(input.cardBase * comp.percentService, 100) * comp.cardFeeCommissionPct, 100)
        : 0;

    const base = isSalaried ? salaryForDay : commission;
    const totalIncome = base - cleanUp - cardFee + effectiveTip;

    // Pay 1 takes the whole clean-up deduction and, for commission staff, the
    // whole card fee — Pay 2 is the remainder rather than its own percentage.
    const pay1 = rdiv(base * comp.pay1Split, 100) - cleanUp - (comp.compType === 'commission' ? cardFee : 0);
    const pay2 = totalIncome - pay1;

    totals.commission += commission;
    totals.tip += effectiveTip;
    totals.cleanUp += cleanUp;
    totals.cardFee += cardFee;
    totals.salary += reportedSalary;
    totals.total += totalIncome;
    totals.pay1 += pay1;
    totals.pay2 += pay2;

    staff.push({
      staffId: input.staffId,
      name: input.name,
      percentService: comp.percentService,
      compType: comp.compType,
      serviceNet: input.serviceNet,
      supplyNet: input.supplyNet,
      commission,
      supplyShare,
      salonCommission: salonCommissionForStaff,
      tip: effectiveTip,
      cleanUp,
      cardFee,
      salary: reportedSalary,
      total: totalIncome,
      pay1,
      pay2,
    });
  }

  const staffSupplyShare = totals.supplyShare;
  const salonSupplyShare = store.supplyTotal - staffSupplyShare;
  const salonCommission = totals.salonCommission - salonSupplyShare;
  const totalService = store.serviceSale - store.serviceRefund;

  const netEarnings = salonCommission + store.productSale - store.productRefund - store.totalDiscount;

  // The salon keeps the staff's supply share and clean-up deductions, pays out
  // salary, and recovers the card fee — hence the signs.
  const totalEarning = netEarnings + staffSupplyShare + totals.cleanUp - totals.salary + totals.cardFee;

  return {
    serviceSale: store.serviceSale,
    serviceRefund: store.serviceRefund,
    productSale: store.productSale,
    productRefund: store.productRefund,
    giftCardSale: store.giftCardSale,
    totalDiscount: store.totalDiscount,
    totalService,

    supplyTotal: store.supplyTotal,
    staffSupplyShare,
    salonSupplyShare,

    commission: totals.commission,
    payoutTip: totals.tip,
    cleanUp: totals.cleanUp,
    cardCharge: totals.cardFee,
    salary: totals.salary,
    payoutTotal: totals.total,
    pay1: totals.pay1,
    pay2: totals.pay2,

    salonCommission,
    netEarnings,
    totalEarning,

    staff: staff.sort((a, b) => b.total - a.total),
  };
}
