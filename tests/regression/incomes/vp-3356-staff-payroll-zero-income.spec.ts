/**
 * VP-3356 (+ sub-bug VP-3891) — Staff Payroll lists staff whose Total Income is $0.
 *
 * Source: docs/qc/volt-qc/vp-tickets/VP-3356-staff-payroll-zero-income-staff-test-cases.md
 * (TC-VP3356-01…12, one `it()` each; 🧱 rows are title-only PENDING).
 *
 * ## What the fix changed (volt-pos#2699)
 *
 * Before: the live (Current Period) list reused Staff Income's
 * `transformStaffIncomeList` with `includeNoIncome = false`, so every row with
 * `totalIncome === 0` vanished — and the summary cards, summed over the same
 * filtered list, lost those rows too. Closed periods queried `status = active`
 * only. After: every staff member is listed in both cases.
 *
 * ## Invariants first, fixtures second
 *
 * TC-01/02/03/07/11/12 assert what must hold on ANY data (a $0 row exists, 0-order
 * rows exist, Σ columns == cards, Staff Income still hides $0 rows). TC-04/05/06/08
 * read the ticket's own fixtures on merchant 14 (`1001bc`, `THONG`, `JD53001` in
 * old periods) and skip when that period is no longer offered.
 *
 * ## Writes
 *
 * Only TC-10 writes: one cash order booked to JD53001 (a staff member on no
 * commission, so Total Income stays $0.00) — the VP-3891 reproduction. It
 * skips when JD53001 is missing or inactive on the merchant.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { StaffService } from '../../../src/api/index.js';
import { V4Labels } from '../../../src/constants/testids.reports-v4.js';
import { createOrder, payInCash, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { settle } from '../../../src/helpers/wait.js';
import reportsV4Page, { legacyStaffIncomeReport } from '../../../src/pages/incomes/ReportsV4Page.js';
import { fieldCents, type StaffListRow } from '../../../src/pages/incomes/staffIncomeTable.js';
import { staffPayrollPage } from '../../../src/pages/index.js';
import { PAYROLL_LABELS } from '../../../src/pages/payroll/StaffPayrollPage.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { moduleLogger } from '../../../src/utils/logger.js';
import { expectCentsEqual, sumCents } from '../../../src/utils/money.js';

const log = moduleLogger('vp-3356');

/** Ticket fixtures (merchant 14). */
const FIXTURE = {
  aug20Period: /Aug 20, 2026/,
  sep10Period: /Sep 10, 2026/,
  refundStaff: '1001bc',
  refundSubtotalCents: -6_200,
  inactiveStaff: 'THONG',
  inactiveSubtotalCents: 3_000,
  zeroCommissionStaff: 'JD53001',
  jdSep10Orders: 2,
  jdSep10SubtotalCents: 11_550,
} as const;

const CURRENT_PERIOD = /^(Current Period|Kỳ hiện tại)/;

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Choose the period whose label matches; `null` when the select no longer offers it. */
async function selectPeriodMatching(re: RegExp): Promise<string | null> {
  const current = await staffPayrollPage.periodText();
  if (re.test(current)) return current;
  const options = await staffPayrollPage.periodOptions();
  const index = options.findIndex((label) => re.test(label));
  if (index < 0) {
    log.info(`No pay period matches ${String(re)} — offered: ${options.slice(0, 12).join(' / ')}`);
    return null;
  }
  return staffPayrollPage.selectPeriodAt(index);
}

/** Σ columns vs the six cards, as a list of mismatches (empty = all agree). */
async function summaryMismatches(rows: StaffListRow[], where: string): Promise<string[]> {
  const problems: string[] = [];
  const totalStaff = await staffPayrollPage.statCount('totalStaff');
  if (rows.length !== totalStaff)
    problems.push(`${where}: ${String(rows.length)} rows vs Total staff ${String(totalStaff)}`);
  const orders = rows.reduce((n, r) => n + r.orders, 0);
  const ordersCard = await staffPayrollPage.statCount('totalOrders');
  if (orders !== ordersCard)
    problems.push(`${where}: Σ Orders ${String(orders)} vs card ${String(ordersCard)}`);
  for (const [stat, pick] of [
    ['totalSubtotal', (r: StaffListRow) => r.subtotalCents],
    ['totalSupplyFee', (r: StaffListRow) => r.supplyFeeCents],
    ['totalTip', (r: StaffListRow) => r.tipCents],
    ['totalStaffIncome', (r: StaffListRow) => r.totalIncomeCents],
  ] as const) {
    const sum = sumCents(rows.map(pick));
    const card = await staffPayrollPage.statCents(stat);
    if (sum !== card) problems.push(`${where}: Σ ${stat} ${String(sum)}¢ vs card ${String(card)}¢`);
  }
  return problems;
}

/** Open a row's detail and check it renders a $0.00 Total Income that matches the list. */
async function expectZeroIncomeDetail(row: StaffListRow, where: string): Promise<void> {
  await staffPayrollPage.openStaffDetailAt(row.index);
  expect(await staffPayrollPage.hasLoadError()).toBe(false);
  expect((await staffPayrollPage.detailHeader()).name).toBe(row.name);
  if (await staffPayrollPage.hasNoData()) return; // the app's own empty state is not an error
  const total = fieldCents(await staffPayrollPage.detailFields(), ...PAYROLL_LABELS.totalIncome);
  expect(total).not.toBeNull();
  expectCentsEqual(total ?? 0, 0, `${where}: ${row.name} detail Total Income`);
}

describe('VP-3356 — Staff Payroll lists $0-income staff', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await returnToHome();
  });

  /* ------------------------------------------------------------------ *
   * 1. Current Period (Unclosed)
   * ------------------------------------------------------------------ */

  describe('1. Current Period (Unclosed)', () => {
    it(
      title(
        'TC-VP3356-01: staff with Total Income $0.00 stay in the Current Period list (AC1)',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        await staffPayrollPage.open();
        expect(await staffPayrollPage.periodText()).toMatch(CURRENT_PERIOD);
        const { rows } = await staffPayrollPage.readList();

        const zero = rows.filter((r) => r.totalIncomeCents === 0);
        // The pre-fix filter removed EVERY $0 row; one is enough to prove it is gone.
        expect(zero.length).toBeGreaterThan(0);

        const withOrders = zero.filter((r) => r.orders > 0 || r.subtotalCents !== 0);
        log.info(
          `Current period: ${String(rows.length)} rows, ${String(zero.length)} at $0.00, ${String(withOrders.length)} of them with orders/subtotal.`,
        );
        for (const row of withOrders)
          expect({ name: row.name, income: row.cells[5] }).toEqual({ name: row.name, income: '$0.00' });
      },
    );

    it(
      title(
        'TC-VP3356-02: the Current Period lists every staff, 0-order ones included (VP-3891)',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async () => {
        await staffPayrollPage.open();
        const { rows } = await staffPayrollPage.readList();
        const active = await new StaffService().active();

        expect(rows.filter((r) => r.orders === 0).length).toBeGreaterThan(0);
        expect(rows.length).toBeGreaterThanOrEqual(active.length);
        expect(rows.length).toBe(await staffPayrollPage.statCount('totalStaff'));
      },
    );

    it(
      title(
        'TC-VP3356-03: summary cards equal the column sums with the $0 rows included — Current Period (AC4)',
        Tag.REGRESSION,
      ),
      async () => {
        await staffPayrollPage.open();
        const { rows } = await staffPayrollPage.readList();
        expect(await summaryMismatches(rows, 'Current Period')).toEqual([]);
      },
    );

    it(
      title(
        'TC-VP3356-04: the detail of a staff with orders but $0.00 income opens without error (AC5)',
        Tag.REGRESSION,
      ),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        await staffPayrollPage.open();
        const pick = (rows: StaffListRow[]): StaffListRow | undefined =>
          rows.find((r) => r.totalIncomeCents === 0 && (r.orders > 0 || r.subtotalCents !== 0));

        let where = 'Current Period';
        let row = pick((await staffPayrollPage.readList()).rows);
        if (!row) {
          // Fall back to the ticket's period, where THONG / 1001bc are exactly this case.
          const period = await selectPeriodMatching(FIXTURE.aug20Period);
          if (!period) this.skip();
          where = period;
          row = pick((await staffPayrollPage.readList()).rows);
        }
        if (!row) {
          log.warn('SKIP — no staff with orders and $0.00 income in the current or the Aug 20 period.');
          this.skip();
        }
        await expectZeroIncomeDetail(row, where);
      },
    );
  });

  /* ------------------------------------------------------------------ *
   * 2. Closed periods
   * ------------------------------------------------------------------ */

  describe('2. Closed periods', () => {
    it(
      title(
        'TC-VP3356-05: the 1001bc refund shows a negative subtotal and is not hidden (AC2)',
        Tag.REGRESSION,
      ),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        await staffPayrollPage.open();
        if (!(await selectPeriodMatching(FIXTURE.aug20Period))) this.skip();

        const row = (await staffPayrollPage.readList()).rows.find((r) =>
          sameName(r.name, FIXTURE.refundStaff),
        );
        expect(row?.name ?? '(no 1001bc row)').toMatch(new RegExp(`^${FIXTURE.refundStaff}$`, 'i'));
        if (!row) return;
        expect(row.orders).toBe(1);
        expect(row.cells[2] ?? '').toMatch(/^-/);
        expectCentsEqual(row.subtotalCents, FIXTURE.refundSubtotalCents, '1001bc Subtotal (Aug 20–26)');
        expectCentsEqual(row.totalIncomeCents, 0, '1001bc Total Income (Aug 20–26)');
      },
    );

    it(
      title(
        'TC-VP3356-06: inactive staff THONG with figures is listed in a closed period and its detail opens',
        Tag.REGRESSION,
      ),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        await staffPayrollPage.open();
        const period = await selectPeriodMatching(FIXTURE.aug20Period);
        if (!period) this.skip();

        const row = (await staffPayrollPage.readList()).rows.find((r) =>
          sameName(r.name, FIXTURE.inactiveStaff),
        );
        expect(row?.name ?? '(no THONG row)').toMatch(new RegExp(`^${FIXTURE.inactiveStaff}$`, 'i'));
        if (!row) return;
        expect(row.orders).toBe(1);
        expectCentsEqual(row.subtotalCents, FIXTURE.inactiveSubtotalCents, 'THONG Subtotal (Aug 20–26)');
        expectCentsEqual(row.totalIncomeCents, 0, 'THONG Total Income (Aug 20–26)');
        await expectZeroIncomeDetail(row, period);
      },
    );

    it(
      title('TC-VP3356-07: summary cards equal the column sums — latest closed period (AC4)', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        await staffPayrollPage.open();
        const options = await staffPayrollPage.periodOptions();
        const index = options.findIndex((label) => !CURRENT_PERIOD.test(label));
        if (index < 0) this.skip();

        const period = await staffPayrollPage.selectPeriodAt(index);
        const { rows } = await staffPayrollPage.readList();
        expect(rows.length).toBeGreaterThan(0);
        expect(await summaryMismatches(rows, period)).toEqual([]);
      },
    );

    it(
      title(
        'TC-VP3356-08: JD53001 shows 2 orders, $115.50, $0.00 in Sep 10 – Sep 16, 2026 (VP-3891)',
        Tag.REGRESSION,
      ),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        await staffPayrollPage.open();
        if (!(await selectPeriodMatching(FIXTURE.sep10Period))) this.skip();

        const row = (await staffPayrollPage.readList()).rows.find((r) =>
          sameName(r.name, FIXTURE.zeroCommissionStaff),
        );
        expect(row?.name ?? '(no JD53001 row)').toMatch(new RegExp(`^${FIXTURE.zeroCommissionStaff}$`, 'i'));
        if (!row) return;
        expect(row.orders).toBe(FIXTURE.jdSep10Orders);
        expectCentsEqual(row.subtotalCents, FIXTURE.jdSep10SubtotalCents, 'JD53001 Subtotal (Sep 10–16)');
        expectCentsEqual(row.totalIncomeCents, 0, 'JD53001 Total Income (Sep 10–16)');
      },
    );

    it(
      title(
        'TC-VP3356-09: POS list + summary match the Portal for Unclosed and closed periods — PENDING (cross-surface: Portal change + POS check in one run; Portal lane is ready (`.portal-profile`), POS side not wired; passed manually 26/10)',
      ),
    );
  });

  /* ------------------------------------------------------------------ *
   * 3. Sub-bug VP-3891 — JD53001 in the Current Period
   * ------------------------------------------------------------------ */

  describe('3. VP-3891 — JD53001 (Current Period)', () => {
    it(
      title(
        'TC-VP3356-10: an order for JD53001 (no commission) makes it appear in the list, Total Income ≤ $0.00',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.CRITICAL,
      ),
      async function (this: Mocha.Context): Promise<void> {
        this.timeout(Timeouts.MOCHA_HOOK);
        const staff = await new StaffService().findByNickname(FIXTURE.zeroCommissionStaff);
        if (staff?.status !== 'active') {
          log.warn(
            `SKIP — ${FIXTURE.zeroCommissionStaff} is ${staff ? `"${String(staff.status)}"` : 'absent'} on this merchant.`,
          );
          this.skip();
        }

        await step(`Book and pay one cash order for ${staff.nickname}`, async () => {
          await returnToHome();
          const { orderId } = await createOrder({ staff: { id: staff.id, nickname: staff.nickname } });
          await payInCash(orderId);
          await returnToHome();
        });

        // The payroll report is rebuilt asynchronously after a payment, so read it until
        // the new order shows (≤90s) instead of once straight after paying.
        let row: StaffListRow | undefined;
        const deadline = Date.now() + 90_000;
        do {
          await staffPayrollPage.open();
          expect(await staffPayrollPage.periodText()).toMatch(CURRENT_PERIOD);
          row = (await staffPayrollPage.readList()).rows.find((r) => sameName(r.name, staff.nickname));
          if ((row?.orders ?? 0) >= 1) break;
          await returnToHome();
          await settle(10_000);
        } while (Date.now() < deadline);

        expect(row?.name ?? '(JD53001 not listed)').toMatch(new RegExp(`^${staff.nickname}$`, 'i'));
        if (!row) return;
        expect(row.orders).toBeGreaterThanOrEqual(1);
        expect(row.subtotalCents).toBeGreaterThan(0);
        // JD53001 earns no commission, so its income is never positive. It is $0.00
        // only when the booked service has no supply fee: the default first service
        // carries $7, which payroll deducts (seen 03/11: -$7.00). VP-3891 is about
        // the row being LISTED, which the checks above assert.
        log.info(`${staff.nickname} Total Income (Current Period): ${row.cells[5] ?? '?'}`);
        expect(row.totalIncomeCents).toBeLessThanOrEqual(0);
      },
    );
  });

  /* ------------------------------------------------------------------ *
   * 4. Staff Income keeps hiding $0 staff (VP-2460)
   * ------------------------------------------------------------------ */

  describe('4. No regression on Staff Income (VP-2460)', () => {
    for (const [tc, label, page, open] of [
      ['11', 'V1', legacyStaffIncomeReport, () => legacyStaffIncomeReport.open()],
      ['12', 'V4', reportsV4Page, () => reportsV4Page.open('staff-income')],
    ] as const) {
      it(
        title(
          `TC-VP3356-${tc}: Staff Income ${label} hides $0.00 staff while "Show staff with no income" is off (AC6)`,
          Tag.REGRESSION,
        ),
        async function (this: Mocha.Context): Promise<void> {
          this.timeout(Timeouts.MOCHA_HOOK);
          await open();
          const wasOn = await page.isNoIncomeSwitchOn();
          if (wasOn) {
            log.warn(
              `Staff Income ${label} opened with the no-income switch ON — turning it off for the check.`,
            );
            await page.toggleNoIncomeSwitch();
          }

          try {
            const off = await page.staffRows();
            expect(off.filter((r) => r.totalIncomeCents === 0).map((r) => r.name)).toEqual([]);
            expect(off.length).toBe(await page.cardCount(V4Labels.totalStaff));

            await page.toggleNoIncomeSwitch();
            expect(await page.isNoIncomeSwitchOn()).toBe(true);
            const on = await page.staffRows();
            expect(on.length).toBeGreaterThanOrEqual(off.length);
            expect(await page.cardCount(V4Labels.totalStaff)).toBe(on.length);
          } finally {
            if (await page.isNoIncomeSwitchOn()) await page.toggleNoIncomeSwitch();
          }
        },
      );
    }
  });
});
