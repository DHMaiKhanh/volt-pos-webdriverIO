/**
 * card-charge-test-cases — Card Charge (card fee) in Staff Payroll / Income
 * (volt-qc per-ticket file `docs/qc/volt-qc/vp-tickets/card-charge-test-cases.md`).
 *
 * Automated (read-only, current pay period): invariants that hold for whatever
 * staff the merchant has —
 *   - B1  a SALARY-path staff is never charged a card commission fee;
 *   - A12 a commission staff with no orders carries no card charge;
 *   - B11 a card charge never exceeds the staff's own Sale (a sign/supply bug
 *         would blow it past it).
 * No matching staff in the period → the case skips with that reason.
 *
 * Manual: every row that needs a chosen payment mix (Card / Cash / Gift Card /
 * split) on orders of a configured staff (card_comm% / card_tip%, supply fee,
 * Commission + Salary path), refunds/voids, or card-brand fees.
 */

import { expect } from '@wdio/globals';
import { returnToHome } from '../../../../src/flows/index.js';
import { staffPayrollPage } from '../../../../src/pages/index.js';
import { ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { PAYROLL_SCAN_TIMEOUT, findPayrollDetail, payrollCents } from './vp-tickets.helpers.js';

describe('card-charge-test-cases — Card Charge in Staff Payroll', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(PAYROLL_SCAN_TIMEOUT);
    await ensurePasscodeGrant();
    await returnToHome();
  });

  it(
    title(
      'card-charge-test-cases B1 A salary-path staff is never charged a card commission fee',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      const probe = await findPayrollDetail((p) => p.type === 'salary');
      if (!probe) this.skip();
      expect(Math.abs(payrollCents(probe?.fields ?? [], 'cardChargeCommission') ?? 0)).toBe(0);
    },
  );

  it(
    title(
      'card-charge-test-cases A12 A commission staff with no orders in the period has no card charge',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      await staffPayrollPage.open();
      const { rows } = await staffPayrollPage.readList();
      const idle = rows.filter((r) => r.orders === 0).slice(0, 10);
      let checked = false;
      for (const row of idle) {
        await staffPayrollPage.openStaffDetailAt(row.index);
        if ((await staffPayrollPage.payType()) !== 'commission') continue;
        const f = await staffPayrollPage.detailFields();
        expect(Math.abs(payrollCents(f, 'cardChargeCommission') ?? 0)).toBe(0);
        expect(Math.abs(payrollCents(f, 'cardChargeTip') ?? 0)).toBe(0);
        checked = true;
        break;
      }
      if (!checked) this.skip();
    },
  );

  it(
    title(
      'card-charge-test-cases B11 A card charge never exceeds the staff Sale (no sign / supply blow-up)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(PAYROLL_SCAN_TIMEOUT);
      const probe = await findPayrollDetail(
        (p) => p.type === 'commission' && Math.abs(payrollCents(p.fields, 'cardChargeCommission') ?? 0) > 0,
      );
      if (!probe) this.skip();
      const f = probe?.fields ?? [];
      const charge = Math.abs(payrollCents(f, 'cardChargeCommission') ?? 0);
      const sale = Math.abs(payrollCents(f, 'sale') ?? 0);
      expect(charge).toBeLessThanOrEqual(sale);
    },
  );
});
