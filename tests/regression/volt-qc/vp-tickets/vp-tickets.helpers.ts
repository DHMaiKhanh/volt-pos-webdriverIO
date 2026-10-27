/**
 * Shared scaffolding for the volt-qc per-ticket specs
 * (`docs/qc/volt-qc/vp-tickets/*.md` → `tests/regression/volt-qc/vp-tickets/*.spec.ts`).
 *
 * NOT a spec (the runner globs `*.spec.ts`). It holds:
 *
 *   - {@link manualRows} — the `[MANUAL]` pending stubs (used by the `_manual/` spec) for rows the WDIO lane
 *     cannot drive (Portal web, CSV import, overnight jobs, card terminals,
 *     printers, a second till, a cut network). Each row carries the REASON it is
 *     manual; the reason is the "comment" the convention asks for, kept beside
 *     the id so it cannot drift from it.
 *   - the cart/split fixture the Split-Order spec repeats per case;
 *   - the Staff Payroll / Staff settings probes the payroll specs share.
 *
 * Coverage matcher note (scripts/volt-qc-coverage.ts): a row counts as MANUAL
 * only when every spec naming it sits under `_manual/`, so the automated specs
 * in this folder name only the rows they automate. Files that share a ticket
 * number use their own key written right before the row (`<key> TC-<n>`,
 * key = `VP-1048 DSR` / `VP-1048 IS` / `VP-1252-5`).
 */

import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { StaffsText } from '../../../../src/constants/testids.settings-staffs.js';
import { goToSettings, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { homePage, settingsPage, splitOrderPage, staffPayrollPage } from '../../../../src/pages/index.js';
import staffsSettingsPage from '../../../../src/pages/settings/StaffsSettingsPage.js';
import { PAYROLL_LABELS, type PayType } from '../../../../src/pages/payroll/StaffPayrollPage.js';
import { fieldCents, findField, type DetailField } from '../../../../src/pages/incomes/staffIncomeTable.js';
import { Tag, title } from '../../../../src/types/testTags.js';

/* ======================================================================= *
 * Manual (pending) rows
 * ======================================================================= */

/** One row the lane cannot automate: `[fullId, summary, reason]` (`<ticket key> TC-<n>`). */
export type ManualRow = readonly [id: string, summary: string, reason: string];

/**
 * Register one Mocha PENDING test per row:
 * `it.skip(title('[MANUAL] <summary> (<fullId>)', Tag.REGRESSION), () => {})`.
 *
 * Used only by tests/regression/volt-qc/_manual/vp-tickets.manual.spec.ts. The
 * full id (`<ticket key> TC-<n>`) is written literally in each row so the
 * coverage script sees it. The reason lives in the row beside the id.
 */
export function manualRows(rows: readonly ManualRow[]): void {
  for (const [id, summary, reason] of rows) {
    it.skip(title(`[MANUAL] ${summary} (${id})`, Tag.REGRESSION), () => {
      // Manual: see the reason in the row table.
      void reason;
    });
  }
}

/* ======================================================================= *
 * Cart / split fixture
 * ======================================================================= */

/** Leave the till empty — the convention every order spec starts from. */
export async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

/**
 * A fresh single-line draft whose only service is re-priced to `priceCents`
 * (a service line is untaxed, so the order total equals the price unless the
 * merchant charges a service fee — callers read the total from the screen).
 */
export async function draftWithPrice(priceCents: number): Promise<void> {
  await step(`Build a draft priced ${String(priceCents)} cents`, async () => {
    await voidAnyDraft();
    await homePage.selectFirstStaff();
    await homePage.addFirstService();
    await homePage.openServiceEditor();
    await homePage.setServiceEditorPrice(priceCents);
    await homePage.saveServiceEditor();
  });
}

/** {@link draftWithPrice} and open the Split Order screen on it. */
export async function splitWithPrice(priceCents: number): Promise<void> {
  await draftWithPrice(priceCents);
  await homePage.openSplitOrder();
  await splitOrderPage.waitForReady();
}

/** Back out of the split screen (if on it) and void the never-paid draft. */
export async function leaveSplitAndVoid(): Promise<void> {
  if (await splitOrderPage.isActive().catch(() => false)) {
    await splitOrderPage.backToOrder().catch(() => undefined);
  }
  await voidAnyDraft().catch(() => undefined);
}

/** Add checks until the split shows `n` of them. */
export async function growChecksTo(n: number): Promise<void> {
  while ((await splitOrderPage.checkCount()) < n) await splitOrderPage.addCheck();
}

/* ======================================================================= *
 * Staff Payroll probes
 * ======================================================================= */

export interface PayrollProbe {
  name: string;
  type: PayType;
  fields: DetailField[];
}

/**
 * Open payroll details in the CURRENT pay period until one matches `accept`.
 * Rows with orders first, then rows with non-zero income; at most `max` opens.
 * `null` when none matches — the caller skips with the reason.
 */
export async function findPayrollDetail(
  accept: (probe: PayrollProbe) => boolean,
  max = 20,
): Promise<PayrollProbe | null> {
  await staffPayrollPage.open();
  const { rows } = await staffPayrollPage.readList();
  const candidates = [
    ...rows.filter((r) => r.orders > 0),
    ...rows.filter((r) => r.orders === 0 && r.totalIncomeCents !== 0),
  ].slice(0, max);
  for (const row of candidates) {
    await staffPayrollPage.openStaffDetailAt(row.index);
    const probe: PayrollProbe = {
      name: row.name,
      type: await staffPayrollPage.payType(),
      fields: await staffPayrollPage.detailFields(),
    };
    if (accept(probe)) return probe;
  }
  return null;
}

/** A money field of a payroll detail, or `null`. */
export const payrollCents = (fields: DetailField[], key: keyof typeof PAYROLL_LABELS): number | null =>
  fieldCents(fields, ...PAYROLL_LABELS[key]);

/** A plain-number field (Working Days / Working Hours), or `null`. */
export function payrollNumber(fields: DetailField[], key: keyof typeof PAYROLL_LABELS): number | null {
  const field = findField(fields, ...PAYROLL_LABELS[key]);
  if (!field) return null;
  const match = /-?\d+(?:\.\d+)?/.exec(field.value.replace(/,/g, ''));
  return match ? Number.parseFloat(match[0]) : null;
}

/** `|a − b| ≤ tolerance` cents — payroll splits round per line. */
export const withinCents = (a: number, b: number, tolerance = 1): boolean => Math.abs(a - b) <= tolerance;

/** Hook timeout for specs that open many payroll details. */
export const PAYROLL_SCAN_TIMEOUT = Timeouts.MOCHA_HOOK * 2;

/* ======================================================================= *
 * Staff compensation (Settings → Staffs → Compensation tab)
 * ======================================================================= */

export type SalaryKind = 'salaryByPeriod' | 'wagePerDay' | 'wagePerHour';

export interface SalaryConfig {
  name: string;
  kind: SalaryKind;
  /** The Salary Amount field (the per-period / per-day / per-hour figure), in cents. */
  amountCents: number;
  /** Deduction Per Day, in cents (0 when not rendered). */
  deductionCents: number;
}

const moneyToCents = (text: string | null): number => {
  if (!text) return 0;
  const digits = text.replace(/[^\d.-]/g, '');
  return digits === '' ? 0 : Math.round(Number.parseFloat(digits) * 100);
};

/** Land on the Staffs settings list. */
export async function openStaffsSettings(): Promise<void> {
  await goToSettings();
  await settingsPage.openSection('STAFFS');
  await staffsSettingsPage.waitForReady(Timeouts.MEDIUM);
}

/**
 * The first ACTIVE staff whose compensation tab has `kind` selected, read-only
 * (no field is touched, so the form is never dirty). At most `max` staff opened.
 */
export async function findStaffWithSalaryKind(kind: SalaryKind, max = 15): Promise<SalaryConfig | null> {
  await openStaffsSettings();
  const names = (await staffsSettingsPage.staffRows())
    .filter((r) => (StaffsText.active as readonly string[]).includes(r.status.trim()))
    .map((r) => r.name)
    .slice(0, max);
  for (const name of names) {
    await openStaffsSettings();
    await staffsSettingsPage.openStaff(name);
    await staffsSettingsPage.openTab(1);
    if (!(await staffsSettingsPage.ensureSalaryControls())) continue;
    const states = await staffsSettingsPage.salaryTypeStates();
    if (!states[kind]) continue;
    const values = await staffsSettingsPage.compensationValues();
    return {
      name,
      kind,
      amountCents: moneyToCents(values.salaryAmount),
      deductionCents: moneyToCents(values.deductionPerDay),
    };
  }
  return null;
}
