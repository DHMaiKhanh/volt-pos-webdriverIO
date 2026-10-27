/**
 * VP-1341 — Staff Payroll: Salary amount & Exclude Tips From Cash/Check Income
 * (volt-qc per-ticket file
 * `docs/qc/volt-qc/vp-tickets/VP-1341-staff-payroll-salary-test-cases.md`, TC 1–10).
 *
 * Automated (read-only): the Exclude-Tips switch on the Compensation tab, and —
 * for staff the merchant already runs on each salary type — the payroll detail
 * of the CURRENT period: Salary Amount = config (by period) / Wage × Days /
 * Wage × Hours, and Pay 1 + Pay 2 = Total Income. A salary type nobody uses on
 * this merchant skips with that reason.
 *
 * Manual: anything that flips the switch on a real staff and then reads an
 * income report after a tipped cash order (needs a disposable staff + a settled
 * order), and the Commission + Salary violation flag (days-off rules, kept manual).
 */

import { expect } from '@wdio/globals';
import { returnToHome } from '../../../../src/flows/index.js';
import { staffPayrollPage } from '../../../../src/pages/index.js';
import staffsSettingsPage from '../../../../src/pages/settings/StaffsSettingsPage.js';
import { StaffsText } from '../../../../src/constants/testids.settings-staffs.js';
import { ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../../src/utils/money.js';
import {
  PAYROLL_SCAN_TIMEOUT,
  findPayrollDetail,
  findStaffWithSalaryKind,
  openStaffsSettings,
  payrollCents,
  payrollNumber,
  withinCents,
  type SalaryConfig,
  type SalaryKind,
} from './vp-tickets.helpers.js';
import type { DetailField } from '../../../../src/pages/incomes/staffIncomeTable.js';

/** Salary-type staff's payroll fields for the current period, or skip. */
async function salaryDetail(
  ctx: Mocha.Context,
  kind: SalaryKind,
): Promise<{ cfg: SalaryConfig; f: DetailField[] }> {
  const cfg = await findStaffWithSalaryKind(kind);
  if (!cfg) ctx.skip();
  await staffPayrollPage.open();
  await staffPayrollPage.openStaffDetail(cfg?.name ?? '');
  if ((await staffPayrollPage.payType()) !== 'salary') ctx.skip();
  return { cfg: cfg, f: await staffPayrollPage.detailFields() };
}

describe('VP-1341 — Staff Payroll salary & Exclude Tips', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(PAYROLL_SCAN_TIMEOUT);
    await staffsSettingsPage.closeAnything().catch(() => undefined);
    await ensurePasscodeGrant();
    await returnToHome();
  });

  it(
    title('VP-1341 TC-01 "Exclude Tips From Cash/Check Income" is on the Compensation tab', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      await openStaffsSettings();
      const [first] = await staffsSettingsPage.staffRows();
      if (!first) this.skip();
      await staffsSettingsPage.openStaff(first?.name ?? '');
      await staffsSettingsPage.openTab(1);
      const tip = await staffsSettingsPage.payrollTipSwitch();
      expect(tip.present).toBe(true);
      expect(StaffsText.excludeTips.some((label) => tip.label.includes(label))).toBe(true);
      expect(['true', 'false']).toContain(tip.checked);
    },
  );

  it(
    title('VP-1341 TC-06 Salary by Period: Salary Amount = the configured Salary by Period', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      const { cfg, f } = await salaryDetail(this, 'salaryByPeriod');
      expectCentsEqual(
        payrollCents(f, 'salaryAmount') ?? 0,
        cfg.amountCents,
        `${cfg.name}: Salary Amount vs config`,
      );
    },
  );

  it(
    title('VP-1341 TC-07 Wage Per Day: Salary Amount = Wage Per Day × Working Days', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      const { cfg, f } = await salaryDetail(this, 'wagePerDay');
      const days = payrollNumber(f, 'workingDays') ?? 0;
      expectCentsEqual(
        payrollCents(f, 'salaryAmount') ?? 0,
        Math.round(cfg.amountCents * days),
        `${cfg.name}: Wage × Days`,
      );
    },
  );

  it(
    title('VP-1341 TC-08 Wage Per Hour: Salary Amount = Wage Per Hour × Working Hours', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      const { cfg, f } = await salaryDetail(this, 'wagePerHour');
      const hours = payrollNumber(f, 'workingHours') ?? 0;
      const salary = payrollCents(f, 'salaryAmount') ?? 0;
      // Hours render rounded to 2 decimals; allow the cents that rounding can move.
      expect(withinCents(salary, Math.round(cfg.amountCents * hours), Math.ceil(cfg.amountCents / 100))).toBe(
        true,
      );
    },
  );

  it(
    title('VP-1341 TC-09 Pay 1 + Pay 2 = Total Income on the payroll detail', Tag.REGRESSION, Tag.CRITICAL),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      const probe = await findPayrollDetail(
        (p) => payrollCents(p.fields, 'pay1') !== null && payrollCents(p.fields, 'totalIncome') !== null,
      );
      if (!probe) this.skip();
      const f = probe?.fields ?? [];
      const sum = (payrollCents(f, 'pay1') ?? 0) + (payrollCents(f, 'pay2') ?? 0);
      expect(withinCents(sum, payrollCents(f, 'totalIncome') ?? 0)).toBe(true);
    },
  );
});
