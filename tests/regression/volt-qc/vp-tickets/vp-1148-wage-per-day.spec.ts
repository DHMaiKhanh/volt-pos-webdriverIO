/**
 * VP-1148 — Compensation: Salary → Wage Per Day (volt-qc per-ticket file
 * `docs/qc/volt-qc/vp-tickets/VP-1148-compensation-salary-wage-per-day-test-cases.md`, TC 1–10).
 *
 * Automated (read-only): the option exists beside Salary by Period / Wage Per
 * Hour, and — for a staff the merchant already runs on Wage Per Day — the
 * current pay period's payroll detail obeys the formulas:
 * Salary = Wage Per Day × Working Days, Clean Up = Deduction Per Day × Working
 * Days, Pay 1 + Pay 2 = Total Income, Salary listed as an income line.
 * No staff on Wage Per Day (or none worked this period) → the case skips.
 *
 * Manual: saving a new configuration (mutates a real staff) and the attendance
 * rules (1+ check-ins = 1 day, no check-in = no pay, auto check-out), which need
 * check-ins placed on chosen days of a period.
 */

import { expect } from '@wdio/globals';
import { returnToHome } from '../../../../src/flows/index.js';
import { staffPayrollPage } from '../../../../src/pages/index.js';
import staffsSettingsPage from '../../../../src/pages/settings/StaffsSettingsPage.js';
import { ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../../src/utils/money.js';
import {
  PAYROLL_SCAN_TIMEOUT,
  findStaffWithSalaryKind,
  openStaffsSettings,
  payrollCents,
  payrollNumber,
  withinCents,
  type SalaryConfig,
} from './vp-tickets.helpers.js';
import type { DetailField } from '../../../../src/pages/incomes/staffIncomeTable.js';

describe('VP-1148 — Compensation Salary: Wage Per Day', () => {
  let config: SalaryConfig | null = null;
  let fields: DetailField[] | null = null;

  /** The Wage-Per-Day staff and their current payroll detail, or skip. */
  async function wagePerDayDetail(ctx: Mocha.Context): Promise<{ cfg: SalaryConfig; f: DetailField[] }> {
    if (config === null) config = await findStaffWithSalaryKind('wagePerDay');
    if (config === null) ctx.skip();
    if (fields === null) {
      await staffPayrollPage.open();
      await staffPayrollPage.openStaffDetail(config?.name ?? '');
      fields = await staffPayrollPage.detailFields();
    }
    return { cfg: config, f: fields };
  }

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(PAYROLL_SCAN_TIMEOUT);
    await staffsSettingsPage.closeAnything().catch(() => undefined);
    await ensurePasscodeGrant();
    await returnToHome();
  });

  it(
    title(
      'VP-1148 TC-01 Salary offers Wage Per Day beside Salary by Period and Wage Per Hour',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      await openStaffsSettings();
      const [first] = await staffsSettingsPage.staffRows();
      if (!first) this.skip();
      await staffsSettingsPage.openStaff(first?.name ?? '');
      await staffsSettingsPage.openTab(1);
      expect(await staffsSettingsPage.ensureSalaryControls()).toBe(true);
      const states = await staffsSettingsPage.salaryTypeStates();
      expect(Object.keys(states).sort()).toEqual(['salaryByPeriod', 'wagePerDay', 'wagePerHour']);
      expect(Object.values(states).filter(Boolean)).toHaveLength(1);
    },
  );

  it(
    title('VP-1148 TC-07 Payroll Salary = Wage Per Day × Working Days', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      const { cfg, f } = await wagePerDayDetail(this);
      const days = payrollNumber(f, 'workingDays');
      const salary = payrollCents(f, 'salaryAmount');
      if (days === null || salary === null) this.skip();
      expectCentsEqual(
        salary ?? 0,
        Math.round(cfg.amountCents * (days ?? 0)),
        `${cfg.name}: Salary vs Wage × Days`,
      );
    },
  );

  it(
    title('VP-1148 TC-08 Clean Up Fee/Deduction = Deduction Per Day × Working Days', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      const { cfg, f } = await wagePerDayDetail(this);
      const days = payrollNumber(f, 'workingDays');
      const cleanUp = payrollCents(f, 'cleanUpFee');
      if (days === null || cleanUp === null) this.skip();
      expectCentsEqual(
        Math.abs(cleanUp ?? 0),
        Math.round(cfg.deductionCents * (days ?? 0)),
        `${cfg.name}: Clean Up vs Deduction × Days`,
      );
    },
  );

  it(
    title('VP-1148 TC-09 Pay 1 + Pay 2 = Total Income (base includes Salary)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      const { cfg, f } = await wagePerDayDetail(this);
      const pay1 = payrollCents(f, 'pay1');
      const pay2 = payrollCents(f, 'pay2');
      const total = payrollCents(f, 'totalIncome');
      if (pay1 === null || pay2 === null || total === null) this.skip();
      expect(withinCents((pay1 ?? 0) + (pay2 ?? 0), total ?? 0)).toBe(true);
      void cfg;
    },
  );

  it(
    title('VP-1148 TC-10 Salary is listed as an income line on the staff check', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      const { f } = await wagePerDayDetail(this);
      expect(payrollCents(f, 'salaryAmount')).not.toBeNull();
      expect(await staffPayrollPage.payType()).toBe('salary');
    },
  );
});
