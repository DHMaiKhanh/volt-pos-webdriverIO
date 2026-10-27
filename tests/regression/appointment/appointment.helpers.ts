/**
 * Shared set-up for the VP-1615 appointment specs (appointment-*.spec.ts).
 *
 * Build 1.1.56 (the installed QC build, 2026-10-25 dump) renders ONLY the
 * Appointment Overview — no Create/New/+ entry. Linear P-VP-476 "Book
 * appointment from POS" is PAUSED. So:
 *
 *  - form TCs that create nothing and need only controls the dev-server scans
 *    recorded (dialog, phone, note, Save, Close, Repeat tag) are implemented
 *    behind {@link requireCreateForm}: they SKIP on a build without the entry
 *    and run unchanged the day it ships;
 *  - every other form TC is a title-only PENDING with its reason.
 *
 * No spec in this folder books an appointment today. Any future booking MUST use
 * {@link QA_APPOINTMENT_PREFIX} as the customer name and cancel it in `after`.
 */

import { returnToHome } from '../../../src/flows/index.js';
import { appointmentPage } from '../../../src/pages/index.js';

export { QA_APPOINTMENT_PREFIX } from '../../../src/constants/testids.appointment.js';

/** The reason every create/edit-form PENDING / skip carries. */
export const NO_FORM_REASON = 'create/edit form not present on build 1.1.56 (P-VP-476 paused)';

/** Land on the Appointment Overview from wherever the app is. */
export async function openOverview(): Promise<void> {
  if (await appointmentPage.isActive()) {
    await appointmentPage.closeDialog().catch(() => undefined);
    await appointmentPage.closeDetail().catch(() => undefined);
    await appointmentPage.waitForReady();
    return;
  }
  await returnToHome();
  await appointmentPage.open();
}

/**
 * Skip the current test with a reason printed to the log, and tell TypeScript
 * control does not continue (Mocha's `skip()` throws a pending signal).
 */
export function skipBecause(ctx: Mocha.Context, reason: string): never {
  // eslint-disable-next-line no-console
  console.log(`[appointment] SKIP "${ctx.test?.title ?? ''}": ${reason}`);
  ctx.skip();
  throw new Error('unreachable: Mocha ctx.skip() throws a pending signal');
}

/** Cached per spec file: does this build render the create-form entry point? */
let createFormProbe: boolean | null = null;

/** Probe once per file (SHORT budget) whether the create form is reachable. */
export async function hasCreateForm(): Promise<boolean> {
  if (createFormProbe === null) createFormProbe = await appointmentPage.hasCreateEntry();
  return createFormProbe;
}

/** Skip unless the create form exists, then open it fresh. */
export async function requireCreateForm(ctx: Mocha.Context): Promise<void> {
  if (!(await hasCreateForm())) skipBecause(ctx, NO_FORM_REASON);
  await appointmentPage.closeDialog();
  await appointmentPage.openCreateDialog();
}
