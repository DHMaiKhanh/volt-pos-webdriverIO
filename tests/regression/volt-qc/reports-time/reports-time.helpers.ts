/**
 * Spec-side support for the volt-qc report / time ports: assertion helpers
 * with messages, an observation log, and the "test staff" choice.
 *
 * volt-qc pinned its staff with VOLT_TEST_STAFF / VOLT_TEST_STAFF_2. This suite
 * has STAFF_NAME at most, so the staff are chosen from live data: STAFF_NAME
 * when it has income in the last 7 days, otherwise the staff with the most
 * orders (commission staff with activity is what the volt-qc cases assume).
 */

import { env } from '../../../../configs/env/loadEnv.js';
import { rangeOffset } from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  openStaffIncome,
  staffList,
  waitStaffRows,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import { step } from '../../../../src/helpers/steps.js';
import { moduleLogger } from '../../../../src/utils/logger.js';

const log = moduleLogger('volt-qc:reports-time');

/** Throw `message` unless `condition` holds (keeps the failure self-explanatory). */
export function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function ensureEqual<T>(actual: T, expected: T, what: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e} but got ${a}`);
}

/** Integer-cent comparison with an optional tolerance. */
export function ensureCents(actual: number, expected: number, what: string, tolerance = 0): void {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `${what}: expected ${(expected / 100).toFixed(2)} but got ${(actual / 100).toFixed(2)}` +
        (tolerance ? ` (tolerance ${String(tolerance)}¢)` : ''),
    );
  }
}

/** Non-failing observation (volt-qc `note()`), written to the run log. */
export function note(message: string): void {
  log.info(`[observation] ${message}`);
}

let chosen: string[] | null = null;

/** Up to two staff names with orders in the last 7 days (STAFF_NAME first when it qualifies). */
export async function testStaff(): Promise<string[]> {
  if (chosen) return chosen;
  await openStaffIncome(rangeOffset(-6, 0));
  await waitStaffRows(60_000);
  const rows = (await staffList()).rows.filter((r) => r.orders > 0).sort((a, b) => b.orders - a.orders);
  const names = rows.map((r) => r.name);
  const preferred = env.STAFF_NAME.trim();
  const ordered =
    preferred && names.includes(preferred) ? [preferred, ...names.filter((n) => n !== preferred)] : names;
  chosen = ordered.slice(0, 2);
  note(`test staff: ${chosen.join(', ') || '(none with orders in the last 7 days)'}`);
  return chosen;
}

/** A named step whose body is synchronous assertions only. */
export async function check(name: string, fn: () => void): Promise<void> {
  await step(name, () => {
    fn();
    return Promise.resolve();
  });
}
