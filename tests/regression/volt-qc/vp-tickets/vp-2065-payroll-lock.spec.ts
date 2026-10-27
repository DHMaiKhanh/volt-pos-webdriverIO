/**
 * VP-2065 — Payroll-lock date validation in the Time Tracking form (volt-qc
 * per-ticket file `docs/qc/volt-qc/vp-tickets/VP-2065-payroll-lock-date-validation-test-cases.md`,
 * TC 1–11).
 *
 * Automated: the two rows that need no payroll lock — TC-08 (no lock applies to
 * today → the form adds a record normally; the record is deleted again) and
 * TC-10 (the existing form validation still holds: Staff is required).
 *
 * Manual: every lock-boundary row. They need a payroll period LOCKED at a chosen
 * `lockedAt` (00:00 / 23:30 …) — locking happens on the Portal / by the payroll
 * close job — and a check-in/out typed for the lock day, the day after, or the
 * midnight boundary.
 *
 * TC-08 WRITES one time-keeping record (deleted in the same case).
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { timeTrackingPage } from '../../../../src/pages/index.js';
import { ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const MARKER = `VP2065-${String(Date.now()).slice(-6)}`;

describe('VP-2065 — Payroll-lock date validation (Time Tracking form)', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    if (await timeTrackingPage.hasRecordWithNote(MARKER).catch(() => false)) {
      await timeTrackingPage.openDeleteFor(MARKER).catch(() => undefined);
      await timeTrackingPage.confirmDelete().catch(() => undefined);
    }
    await ensurePasscodeGrant();
    await returnToHome();
  });

  it(
    title('VP-2065 TC-08 With no lock on today, Add check-in saves normally', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      assertWritesAllowed('add a time keeping record');
      await timeTrackingPage.open();
      await timeTrackingPage.addRecord(MARKER);
      await timeTrackingPage.waitRecord(MARKER);
      expect(await timeTrackingPage.hasRecordWithNote(MARKER)).toBe(true);

      await timeTrackingPage.openDeleteFor(MARKER);
      await timeTrackingPage.confirmDelete();
      await timeTrackingPage.waitRecordGone(MARKER);
    },
  );

  it(
    title('VP-2065 TC-10 Existing form validation still holds — Staff is required', Tag.REGRESSION),
    async () => {
      await timeTrackingPage.open();
      await timeTrackingPage.openAddDialog();
      try {
        await timeTrackingPage.pressSubmit();
        expect((await timeTrackingPage.formMessages()).join(' | ')).toMatch(/Staff is required|Nhân viên/);
        expect(await timeTrackingPage.isStaffInvalid()).toBe(true);
      } finally {
        await timeTrackingPage.closeDialog();
      }
    },
  );
});
