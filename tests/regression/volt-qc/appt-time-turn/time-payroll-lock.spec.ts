/**
 * volt-qc port — 09 TIME TRACKING vs the payroll lock.
 *
 * Source: volt-qc `e2e/tests/09-time/time-plan-tracking.spec.ts` (TIME-T19,
 * TIME-T20). TC catalogue: docs/qc/volt-qc/windows-regression/09-time-keeping.md.
 *
 * The lock is DISCOVERED, never set: `probeLockedAt` adds a 01/01/2020 record —
 * a locked shop rejects it with "... (locked at: <time>)", an unlocked one saves
 * it (and the case deletes it again). The two cases are mutually exclusive:
 * exactly one of them skips on any merchant.
 *
 * WRITES TIME RECORDS (deleted in `finally`). Never locks or unlocks a payroll.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  addDays,
  addRecord,
  addRecordOk,
  at,
  closeDlg,
  dateButtonDisabled,
  noteDisabled,
  openEdit,
  pickTimeStaff,
  probeLockedAt,
  rowButtonDisabled,
  rows,
  submitEnabled,
  timeInputAttrs,
  ttCleanup,
  ttOpen,
  ttPickRange,
  usDateTime,
} from '../../../../src/pages/voltqc/appt-time-turn/timeWrite.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { parseUsDateTime } from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const log = (m: string): void => {
  // eslint-disable-next-line no-console
  console.log(`[time-lock] ${m}`);
};

describe('volt-qc 09 TIME — payroll lock (write)', () => {
  before(async () => {
    assertWritesAllowed('probe the payroll lock with a Time Tracking record');
    await returnToHome();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Locked payroll: Add blocked before / on lockedAt (2 errors), allowed after; records before the lock are view-only, no Delete (TIME-075, TIME-076, TIME-077, TIME-078, TIME-079, TIME-081)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(10 * 60_000);
      const [staff] = await pickTimeStaff(1);
      if (!staff) this.skip();
      const s = staff ?? '';
      const since = Date.now();
      const probe = await probeLockedAt(s);
      try {
        if (probe.saved || !probe.lockedAt) this.skip(); // no payroll locked on this shop → see TIME-082
        const L = probe.lockedAt;
        const label = usDateTime(L);
        log(`lockedAt = ${label}`);
        const lockErr = (kind: 'Check in' | 'Check out'): string =>
          `${kind} must be after the payroll lock time (locked at: ${label})`;

        await step('TIME-078 IN / OUT the day before the lock day → both errors', async () => {
          const d = addDays(L, -1);
          const r = await addRecord({ staff: s, in: at(d, 9), out: at(d, 10) });
          expect(r.ok).toBe(false);
          expect(r.errors).toContain(lockErr('Check in'));
          expect(r.errors).toContain(lockErr('Check out'));
        });
        await step('TIME-075 lock day, before lockedAt → both errors', async () => {
          if (L.getHours() < 2) return log('TIME-075 not checked: lockedAt too early in the day');
          const r = await addRecord({
            staff: s,
            in: new Date(L.getTime() - 2 * 3_600_000),
            out: new Date(L.getTime() - 3_600_000),
          });
          expect(r.errors).toContain(lockErr('Check in'));
          expect(r.errors).toContain(lockErr('Check out'));
        });
        await step(
          'TIME-077 lock day, after lockedAt → DEV saves it (prod blocks the whole day)',
          async () => {
            const a = new Date(L.getTime() + 15 * 60_000);
            const b = new Date(L.getTime() + 20 * 60_000);
            if (a.getDate() !== L.getDate() || b > new Date())
              return log('TIME-077 not checked: lockedAt too close to midnight');
            await addRecordOk({ staff: s, in: a, out: b });
          },
        );
        await step('TIME-076 the day after the lock day 12:00–01:00 AM → saved', async () => {
          const d = addDays(L, 1);
          if (at(d, 1) > new Date())
            return log('TIME-076 not checked: the day after the lock day is in the future');
          await addRecordOk({ staff: s, in: at(d, 0), out: at(d, 1) });
        });
        await step(
          'TIME-079 / TIME-081 a record before lockedAt: Delete disabled (no message), Edit read-only',
          async () => {
            await ttOpen();
            await ttPickRange(addDays(L, -10), L);
            const old = (await rows()).find(
              (r) => (parseUsDateTime(r.dateIn)?.getTime() ?? Infinity) < L.getTime(),
            );
            if (!old) return log('TIME-079/081 not checked: no record in the 10 days before lockedAt');
            expect(await rowButtonDisabled(old, 'Delete')).toBe(true);
            expect(await P.has({ role: 'dialog', hasText: 'Delete Time Keeping Record' })).toBe(false);
            await openEdit(old);
            expect(await submitEnabled('edit')).toBe(false);
            expect(await dateButtonDisabled('edit', 'Date IN')).toBe(true);
            expect((await timeInputAttrs('edit', 'Date IN')).disabled).toBe(true);
            expect(await noteDisabled('edit')).toBe(true);
            await closeDlg('edit');
          },
        );
      } finally {
        const range: [Date, Date] | undefined = probe.lockedAt
          ? [addDays(probe.lockedAt, -1), new Date()]
          : undefined;
        await ttCleanup([s], since, range);
      }
    },
  );

  it(
    title(
      'No payroll locked yet → no lock-date constraint: a 01/01/2020 record saves (TIME-082)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);
      const [staff] = await pickTimeStaff(1);
      if (!staff) this.skip();
      const s = staff ?? '';
      const since = Date.now();
      const probe = await probeLockedAt(s);
      try {
        if (!probe.saved) this.skip(); // this shop has a locked payroll → see TIME-075..081
        expect(probe.errors.join(' ')).not.toMatch(/payroll lock/);
      } finally {
        if (probe.saved) await ttCleanup([s], since, [new Date(2020, 0, 1), new Date(2020, 0, 1)]);
      }
    },
  );
});
