/**
 * Spec-side support shared by the volt-qc CD / E2E ports: order bookkeeping
 * (every draft a case opens is deleted afterwards, as volt-qc's fixture did),
 * the after-each reset, and a couple of assertion shorthands.
 */

import { expect } from '@wdio/globals';
import { CdMain } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { app } from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { moduleLogger } from '../../../../src/utils/logger.js';
import { formatMoney } from '../../../../src/utils/money.js';

const log = moduleLogger('volt-qc:cd-e2e');

/** Draft order codes the current case opened and has not paid / deleted yet. */
export const drafts = new Set<string>();

/** Remember a draft for clean-up. */
export function track(code: string): string {
  drafts.add(code);
  return code;
}

/** The draft was paid or deleted by the case itself. */
export function untrack(code: string): void {
  drafts.delete(code);
}

/**
 * After-each reset: back out of a waiting-for-customer dialog, leave checkout /
 * payment-success, then delete every still-tracked draft.
 */
export async function resetTill(): Promise<void> {
  await app.closeStrayDialogs().catch(() => undefined);
  if (await app.has(CdMain.waitingDialog).catch(() => false))
    await app.cancelWaitingTip().catch(() => undefined);
  if (/payment-success/.test(await app.path().catch(() => ''))) await app.noReceipt().catch(() => undefined);
  await returnToHome().catch(() => undefined);
  for (const code of [...drafts]) {
    await app.deleteOrderQuietly(code);
    drafts.delete(code);
  }
}

/** `$x.xx` for cents. */
export const usd = (cents: number): string => formatMoney(Math.round(cents));

/** Non-failing observation, written to the run log (volt-qc `annotations.push`). */
export function note(message: string): void {
  log.info(`[observation] ${message}`);
}

/** Cent amounts equal within `tol` cents, with a readable message. */
export function expectCents(actual: number, expected: number, what: string, tol = 1): void {
  const ok = Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= tol;
  expect(
    ok
      ? 'ok'
      : `${what}: expected ${usd(expected)} got ${Number.isFinite(actual) ? usd(actual) : String(actual)}`,
  ).toBe('ok');
}

/** Assert with a message (expect-webdriverio has no message arg). */
export function ensure(condition: boolean, message: string): void {
  expect(condition ? 'ok' : message).toBe('ok');
}
