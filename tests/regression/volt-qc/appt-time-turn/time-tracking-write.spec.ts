/**
 * volt-qc port — 09 TIME TRACKING: Add / Edit / Delete records and the
 * validation of the Add / Edit form.
 *
 * Source: volt-qc `e2e/tests/09-time/time-plan-tracking.spec.ts` (TIME-T12, T13,
 * T14, T16, T17, T18) and `time-deep.spec.ts` (TIME-D01, D02), plus TC row
 * TIME-043 of docs/qc/volt-qc/windows-regression/09-time-keeping.md.
 *
 * ## Data safety
 *
 * WRITES TIME RECORDS. Records go on today 00:10–08:30 (never a locked day) for
 * a staff picked at runtime among those OUT now (`pickTimeStaff`), and every
 * record of that staff created during the case is deleted in `finally`
 * (`ttCleanup`). The payroll lock is never touched.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { VqcTime as T } from '../../../../src/constants/testids.voltqc-appt-time-turn.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { timeTrackingPage } from '../../../../src/pages/index.js';
import {
  addDays,
  addRecord,
  addRecordOk,
  at,
  calendarDayState,
  cancelDelete,
  closeDlg,
  closeTkWithEscape,
  confirmDelete,
  dateText,
  deleteDialogOpen,
  deleteDialogText,
  deleteRow,
  fieldError,
  fillAdd,
  findRow,
  formErrors,
  hasButton,
  insertNote,
  mdy,
  nearMidnight,
  noteShown,
  noteValue,
  openAdd,
  openCalendar,
  openClock,
  openDelete,
  openEdit,
  openTimeKeepingByUrl,
  pickDate,
  pickTimeStaff,
  pickWheelTime,
  rows,
  rowsOf,
  setDateTime,
  setNote,
  showStaff,
  staffButtonDisabled,
  staffTriggerText,
  startOfDay,
  submit,
  submitEnabled,
  timeValue,
  tkTileInert,
  tkTileOf,
  tkToggle,
  toastShown,
  ttCleanup,
  ttOpen,
  ttPickRange,
  ttPreset,
  ttSearch,
  typeNoteAtEnd,
  usDateTime,
  waitDlg,
  wheelPopoverOpen,
  wheels,
} from '../../../../src/pages/voltqc/appt-time-turn/timeWrite.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { parseUsDateTime } from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import { tkActionButtons } from '../../../../src/pages/voltqc/reports-time/rptTime.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const OVERLAP = new RegExp(T.overlap.replace(/\./g, '\\.'));
const yesterday = (): Date => addDays(startOfDay(), -1);
const p2 = (n: number): string => String(n).padStart(2, '0');

/** One staff for the case, or skip. */
async function oneStaff(ctx: Mocha.Context, exclude: string[] = []): Promise<string> {
  const [s] = await pickTimeStaff(1, exclude);
  if (!s) ctx.skip();
  return s ?? '';
}

describe('volt-qc 09 TIME — Time Tracking records (write)', () => {
  before(async () => {
    assertWritesAllowed('add, edit and delete Time Tracking records');
    await returnToHome();
  });

  afterEach(async () => {
    await closeDlg('add').catch(() => undefined);
    await closeDlg('edit').catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Page layout: title, Today preset, Search staff, (+), and the nine columns with Edit / Delete (TIME-043)',
      Tag.REGRESSION,
    ),
    async () => {
      await ttOpen();
      expect(await P.has({ role: 'heading', name: T.pageHeading })).toBe(true);
      expect(await timeTrackingPage.presetText()).toContain('Today');
      expect(await P.has({ css: `main input[placeholder="${T.staffSearchPlaceholder}"]` })).toBe(true);
      expect(await P.has({ css: 'main button[class*="size-13"][class*="rounded-full"]' })).toBe(true);
      expect(await timeTrackingPage.headers()).toEqual([...T.headers]);
      await ttPreset('Last 7 Days');
      const first = (await rows())[0];
      if (first) {
        expect(await P.has({ css: `${T.rowCss(first.index)} button[aria-label="Edit"]` })).toBe(true);
        expect(await P.has({ css: `${T.rowCss(first.index)} button[aria-label="Delete"]` })).toBe(true);
      }
    },
  );

  it(
    title(
      'Add dialog defaults and validation, nothing saved: staff required, Date IN kept, 300-char paste, OUT ≤ IN, OUT on another day, Close (TIME-053, TIME-055, TIME-056, TIME-057, TIME-058, TIME-059, TIME-066, TIME-069)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(6 * 60_000);
      if (nearMidnight()) this.skip();
      const staff = await oneStaff(this);
      const since = Date.now();
      const today = startOfDay();
      try {
        await ttOpen();
        await step(
          'TIME-053 defaults: Add + Close, "Select staff", Date IN = today/now, Date OUT empty, Note',
          async () => {
            await openAdd();
            expect(await hasButton('add', 'Add')).toBe(true);
            expect(await hasButton('add', 'Close')).toBe(true);
            expect(await staffTriggerText('add')).toMatch(/Select staff/);
            expect(await dateText('add', 'Date IN')).toBe(mdy(today));
            const [h = 0, m = 0] = (await timeValue('add', 'Date IN')).split(':').map(Number);
            const now = new Date();
            expect(Math.abs(h * 60 + m - (now.getHours() * 60 + now.getMinutes()))).toBeLessThanOrEqual(2);
            expect(await dateText('add', 'Date OUT')).toBe('');
            expect(await timeValue('add', 'Date OUT')).toBe('');
            expect(await P.has({ role: 'dialog', hasText: T.noteLabel })).toBe(true);
            expect(await noteShown('add')).toBe(true);
          },
        );
        await step('TIME-055 no staff → "Staff is required", dialog stays', async () => {
          await submit('add');
          expect(await fieldError('add', 'Staff')).toBe(T.staffRequired);
          expect(await waitDlg('add', true, Timeouts.ANIMATION)).toBe(true);
        });
        await step('TIME-056 picking the selected day again keeps Date IN', async () => {
          await pickDate('add', 'Date IN', today);
          await P.escape();
          expect(await dateText('add', 'Date IN')).toBe(mdy(today));
          expect(await formErrors('add')).not.toContain('Date IN is required');
        });
        await step('TIME-066 a 300-char paste into Note keeps ≤ 255', async () => {
          await insertNote('add', 'n'.repeat(300));
          expect((await noteValue('add')).length).toBeLessThanOrEqual(255);
          await closeDlg('add');
        });

        const expectErr = async (inAt: Date, outAt: Date, re: RegExp): Promise<void> => {
          await fillAdd({ staff, in: inAt, out: outAt });
          await submit('add');
          expect(await toastShown(T.toastAdded, 3_000)).toBe(false);
          expect((await formErrors('add')).join(' / ')).toMatch(re);
          await closeDlg('add');
        };
        await step('TIME-057 OUT before IN', () =>
          expectErr(
            at(today, 5),
            at(today, 1),
            new RegExp(`Check out must be after: ${mdy(today)} 05:00 AM`),
          ),
        );
        await step('TIME-058 OUT = IN', () =>
          expectErr(
            at(today, 1),
            at(today, 1),
            new RegExp(`Check out must be after: ${mdy(today)} 01:00 AM`),
          ),
        );
        await step('TIME-059 OUT on another day', () =>
          expectErr(
            at(yesterday(), 22),
            at(today, 2),
            new RegExp(`Check out must be on the same day: ${mdy(yesterday())}`),
          ),
        );
        await step('TIME-069 valid form + Close → nothing saved', async () => {
          await fillAdd({ staff, in: at(today, 0, 20), out: at(today, 0, 40) });
          await closeDlg('add');
          await showStaff(staff);
          expect(await findRow(staff, at(today, 0, 20))).toBeNull();
        });
      } finally {
        await ttCleanup([staff], since);
      }
    },
  );

  it(
    title(
      'Valid records: Total Hours rounded (1 / 1.33 / 1.5 / 1.17), yesterday with a note, "-" without, 255-char note (TIME-044, TIME-046, TIME-054, TIME-065)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(8 * 60_000);
      if (nearMidnight()) this.skip();
      const staff = await oneStaff(this);
      const since = Date.now();
      const today = startOfDay();
      try {
        await ttOpen();
        await step('TIME-044 Total Hours 1 / 1.33 / 1.5 / 1.17', async () => {
          const slots: [number, number, number, number, string][] = [
            [0, 10, 1, 10, '1'],
            [1, 20, 2, 40, '1.33'],
            [2, 50, 4, 20, '1.5'],
            [4, 30, 5, 40, '1.17'],
          ];
          for (const [h1, m1, h2, m2] of slots)
            await addRecordOk({ staff, in: at(today, h1, m1), out: at(today, h2, m2) });
          await showStaff(staff);
          for (const [h1, m1, h2, m2, want] of slots) {
            const row = await findRow(staff, at(today, h1, m1));
            expect(row).not.toBeNull();
            expect(row?.total).toBe(want);
            expect(row?.dateOut).toBe(usDateTime(at(today, h2, m2)));
          }
        });
        await step(
          'TIME-054 / TIME-046 yesterday 09:00 AM–05:00 PM with note "forgot"; a row without note shows "-"',
          async () => {
            const y = yesterday();
            const r = await addRecord({ staff, in: at(y, 9), out: at(y, 17), note: 'forgot' });
            if (!r.ok && /payroll lock/i.test(r.errors.join(' '))) {
              // eslint-disable-next-line no-console
              console.log(`[TIME-054] yesterday is inside a locked payroll: ${r.errors.join(' / ')}`);
              return;
            }
            expect(r.errors).toEqual([]);
            await ttPreset('Yesterday');
            await ttSearch(staff);
            const row = await findRow(staff, at(y, 9));
            expect(row?.total).toBe('8');
            expect(row?.note).toBe('forgot');
            expect(
              Math.abs((parseUsDateTime(row?.createdAt ?? '')?.getTime() ?? 0) - Date.now()),
            ).toBeLessThan(3 * 60_000);
            await showStaff(staff);
            expect((await findRow(staff, at(today, 0, 10)))?.note).toBe('-');
          },
        );
        await step('TIME-065 a 255-char note saves; a 256th char is not taken', async () => {
          const note = 'x'.repeat(255);
          await addRecordOk({ staff, in: at(today, 6), out: at(today, 6, 30), note });
          await showStaff(staff);
          const row = await findRow(staff, at(today, 6));
          expect(row).not.toBeNull();
          if (!row) return;
          await openEdit(row);
          expect(await noteValue('edit')).toBe(note);
          await typeNoteAtEnd('edit', 'y');
          expect((await noteValue('edit')).length).toBe(255);
          await closeDlg('edit');
        });
      } finally {
        await ttCleanup([staff], since);
      }
    },
  );

  it(
    title(
      'Overlap check on Add: inside, adjacent, open shift to end of day, one minute, other staff (TIME-060, TIME-061, TIME-062, TIME-063, TIME-064)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(8 * 60_000);
      if (nearMidnight()) this.skip();
      const two = await pickTimeStaff(2);
      if (two.length < 2) this.skip();
      const [staff = '', staff2 = ''] = two;
      const since = Date.now();
      const today = startOfDay();
      try {
        await ttOpen();
        await addRecordOk({ staff, in: at(today, 1), out: at(today, 3) });
        await step('TIME-060 inside an existing record → overlap, not saved', async () => {
          const r = await addRecord({ staff, in: at(today, 2), out: at(today, 2, 30) });
          expect(r.ok).toBe(false);
          expect(r.errors.join(' ')).toMatch(OVERLAP);
        });
        await step('TIME-061 adjacent 03:00–04:00 → saved', () =>
          addRecordOk({ staff, in: at(today, 3), out: at(today, 4) }),
        );
        await step('TIME-063 02:59 → overlap (03:00 was fine above)', async () => {
          const r = await addRecord({ staff, in: at(today, 2, 59), out: at(today, 4, 30) });
          expect(r.errors.join(' ')).toMatch(OVERLAP);
        });
        await step('TIME-062 an open shift yesterday counts to the end of that day', async function () {
          const y = yesterday();
          const r0 = await addRecord({ staff, in: at(y, 9) });
          if (!r0.ok) {
            // eslint-disable-next-line no-console
            console.log(`[TIME-062] skipped: yesterday's open shift was refused (${r0.errors.join(' / ')})`);
            return;
          }
          const r = await addRecord({ staff, in: at(y, 14), out: at(y, 15) });
          expect(r.errors.join(' ')).toMatch(OVERLAP);
        });
        await step('TIME-064 same slot, other staff → both saved', async () => {
          await addRecordOk({ staff: staff2, in: at(today, 6), out: at(today, 7) });
          await addRecordOk({ staff, in: at(today, 6), out: at(today, 7) });
        });
      } finally {
        await ttCleanup([staff, staff2], since, [yesterday(), startOfDay()]);
      }
    },
  );

  it(
    title(
      'Records drive the Time Keeping tile: inside a closed shift → inert; open record → Available; set OUT → Unavailable; delete the open one → previous OUT; yesterday without OUT is closed at 11:59 PM (TIME-022, TIME-023, TIME-068, TIME-086, TIME-090)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(10 * 60_000);
      const now = new Date();
      if (now.getHours() < 1 || now.getHours() >= 23) this.skip(); // needs now ± 1 h inside today
      const staff = await oneStaff(this);
      const since = Date.now();
      const minute = new Date(Math.floor(Date.now() / 60_000) * 60_000);
      try {
        await ttOpen();
        await step('TIME-022 now inside a closed shift → tile inert, no action', async () => {
          await addRecordOk({
            staff,
            in: new Date(minute.getTime() - 3_600_000),
            out: new Date(minute.getTime() + 3_600_000),
          });
          await returnToHome();
          await openTimeKeepingByUrl();
          const inert = await tkTileInert(staff);
          expect(inert).toEqual({ opacity: true, pointerNone: true });
          await P.jsClickQ({ css: '[data-voltqc-tk="1"] div[class*="h-[108px]"]', hasText: staff, nth: 0 });
          expect(await tkActionButtons()).toEqual([]);
          await closeTkWithEscape();
          await ttCleanup([staff], since); // free the current slot for the next steps
        });

        const openIn = new Date(minute.getTime() - 3_600_000);
        await step(
          'TIME-068 add an open record today → the staff is Available with IN = that time',
          async () => {
            await ttOpen();
            await addRecordOk({ staff, in: openIn });
            await returnToHome();
            await openTimeKeepingByUrl();
            const t = await tkTileOf(staff);
            expect(t.column).toBe('Available');
            expect(t.text).toContain(`IN | ${usDateTime(openIn)}`);
            await closeTkWithEscape();
          },
        );

        const outAt = new Date(minute);
        await step('TIME-086 Edit the open record: Date OUT = now → Unavailable with that OUT', async () => {
          await showStaff(staff);
          const row = await findRow(staff, openIn);
          expect(row).not.toBeNull();
          if (!row) return;
          await openEdit(row);
          await setDateTime('edit', 'Date OUT', outAt);
          await submit('edit');
          expect(await toastShown(T.toastUpdated)).toBe(true);
          await returnToHome();
          await openTimeKeepingByUrl();
          const t = await tkTileOf(staff);
          expect(t.column).toBe('Unavailable');
          expect(t.text).toContain(`OUT | ${usDateTime(outAt)}`);
          await closeTkWithEscape();
        });

        await step(
          'TIME-090 Check In, then delete that open record → Unavailable, OUT = the previous one',
          async () => {
            await tkToggle(staff, 'Check In');
            await closeTkWithEscape();
            await showStaff(staff);
            const open = (await rowsOf(staff)).find((r) => r.dateOut === '-');
            expect(open).toBeDefined();
            if (!open) return;
            await openDelete(open);
            expect(await confirmDelete()).toBe(true);
            await returnToHome();
            await openTimeKeepingByUrl();
            const t = await tkTileOf(staff);
            expect(t.column).toBe('Unavailable');
            expect(t.text).toContain(`OUT | ${usDateTime(outAt)}`);
            await closeTkWithEscape();
          },
        );

        await step(
          'TIME-023 an open record yesterday is not an open shift today; the table shows OUT 11:59 PM, 14.98 h',
          async () => {
            const y = yesterday();
            await ttOpen();
            const r = await addRecord({ staff, in: at(y, 9) });
            if (!r.ok) {
              // eslint-disable-next-line no-console
              console.log(`[TIME-023] skipped: yesterday's record was refused (${r.errors.join(' / ')})`);
              return;
            }
            await returnToHome();
            await openTimeKeepingByUrl();
            expect((await tkTileOf(staff)).column).toBe('Unavailable');
            await closeTkWithEscape();
            await ttOpen();
            await ttPreset('Yesterday');
            await ttSearch(staff);
            const row = await findRow(staff, at(y, 9));
            expect(row?.dateOut).toBe(`${mdy(y)} 11:59 PM`);
            expect(row?.total).toBe('14.98');
          },
        );
      } finally {
        await closeTkWithEscape().catch(() => undefined);
        await ttCleanup([staff], since, [yesterday(), startOfDay()]);
      }
    },
  );

  it(
    title(
      'Edit: Staff read-only, Save locked until changed, hours recomputed, Created At kept; overlap ignores itself but blocks another record; undo → Save locked (TIME-083, TIME-084, TIME-085, TIME-087)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(8 * 60_000);
      if (nearMidnight()) this.skip();
      const staff = await oneStaff(this);
      const since = Date.now();
      const today = startOfDay();
      try {
        await ttOpen();
        await addRecordOk({ staff, in: at(today, 1), out: at(today, 3) });
        await showStaff(staff);
        await step('TIME-083 OUT 04:00 → 3 h; Created At kept, Updated At changed', async () => {
          const row = await findRow(staff, at(today, 1));
          expect(row).not.toBeNull();
          if (!row) return;
          await openEdit(row);
          expect(await staffButtonDisabled()).toBe(true);
          expect(await submitEnabled('edit')).toBe(false);
          await settle(61_000 - (Date.now() % 60_000)); // Updated At must land on another minute
          await setDateTime('edit', 'Date OUT', at(today, 4));
          expect(await submitEnabled('edit')).toBe(true);
          await submit('edit');
          expect(await toastShown(T.toastUpdated)).toBe(true);
          const after = await findRow(staff, at(today, 1));
          expect(after?.total).toBe('3');
          expect(after?.createdAt).toBe(row.createdAt);
          expect(after?.updatedAt).not.toBe(row.updatedAt);
        });
        await step('TIME-084 IN 01:00 → 01:30 does not overlap itself → 2.5 h', async () => {
          const row = await findRow(staff, at(today, 1));
          if (!row) throw new Error('record 01:00 vanished');
          await openEdit(row);
          await setDateTime('edit', 'Date IN', at(today, 1, 30));
          await submit('edit');
          expect(await toastShown(T.toastUpdated)).toBe(true);
          expect((await findRow(staff, at(today, 1, 30)))?.total).toBe('2.5');
        });
        await addRecordOk({ staff, in: at(today, 4, 30), out: at(today, 5, 30) });
        await showStaff(staff);
        await step('TIME-085 move record 2 onto record 1 → overlap', async () => {
          const row = await findRow(staff, at(today, 4, 30));
          if (!row) throw new Error('record 04:30 missing');
          await openEdit(row);
          await setDateTime('edit', 'Date IN', at(today, 3));
          await submit('edit');
          expect(await fieldError('edit', 'Date IN')).toMatch(OVERLAP);
          await closeDlg('edit');
        });
        await step('TIME-087 type then clear back → Save locked again', async () => {
          const row = await findRow(staff, at(today, 4, 30));
          if (!row) throw new Error('record 04:30 missing');
          await openEdit(row);
          await setNote('edit', 'a');
          expect(await submitEnabled('edit')).toBe(true);
          await setNote('edit', '');
          expect(await submitEnabled('edit')).toBe(false);
          await closeDlg('edit');
        });
      } finally {
        await ttCleanup([staff], since);
      }
    },
  );

  it(
    title(
      'Delete: confirm text, Cancel keeps the record, Delete removes it (TIME-088, TIME-089)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);
      if (nearMidnight()) this.skip();
      const staff = await oneStaff(this);
      const since = Date.now();
      const today = startOfDay();
      try {
        await ttOpen();
        await addRecordOk({ staff, in: at(today, 8), out: at(today, 8, 30) });
        await showStaff(staff);
        const row = await findRow(staff, at(today, 8));
        expect(row).not.toBeNull();
        if (!row) return;
        await openDelete(row);
        expect(await deleteDialogOpen()).toBe(true);
        expect(await deleteDialogText()).toContain(
          `Are you sure you want to delete this time record for ${staff}? This action cannot be undone.`,
        );
        await cancelDelete();
        expect(await findRow(staff, at(today, 8))).not.toBeNull();
        await deleteRow(row);
        expect(
          await P.poll(
            () => findRow(staff, at(today, 8)),
            (r) => r === null,
            10_000,
          ),
        ).toBeNull();
      } finally {
        await ttCleanup([staff], since);
      }
    },
  );

  it(
    title(
      'Date OUT clock: 3 wheels (01–12, 00–59, AM/PM) pick 08:45 PM → record 08:00–08:45 PM is 0.75 h; future time today saves; tomorrow on the Date IN calendar (TIME-070, TIME-072)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(6 * 60_000);
      if (nearMidnight()) this.skip();
      const staff = await oneStaff(this);
      const since = Date.now();
      const today = startOfDay();
      const tomorrow = addDays(today, 1);
      const inAt = at(today, 20, 0);
      const outAt = at(today, 20, 45);
      let future: Date | null = null;
      try {
        await ttOpen();
        await step('TIME-072 the wheels pick 08 / 45 / PM → Date OUT = 20:45', async () => {
          await openAdd();
          await setDateTime('add', 'Date IN', inAt);
          expect(await timeValue('add', 'Date OUT')).toBe('');
          await openClock('add', 'Date OUT');
          const w = await wheels();
          expect(w).toHaveLength(3);
          expect(w[0]?.labels).toEqual(Array.from({ length: 12 }, (_, i) => p2(i + 1)));
          expect(w[1]?.labels).toEqual(Array.from({ length: 60 }, (_, i) => p2(i)));
          expect(w[2]?.labels).toEqual(['AM', 'PM']);
          await pickWheelTime(8, 45, 'PM');
          expect(await timeValue('add', 'Date OUT')).toBe('20:45');
          await P.escape();
          expect(await wheelPopoverOpen()).toBe(false);
          expect(await waitDlg('add', true, Timeouts.ANIMATION)).toBe(true);
          expect(await timeValue('add', 'Date OUT')).toBe('20:45');
          expect(await dateText('add', 'Date OUT')).toBe(mdy(today));
          await closeDlg('add');
          // Save through the regular path (staff picked first) with the same times.
          await addRecordOk({ staff, in: inAt, out: outAt });
        });
        await step(
          'TIME-070 the record (a future time when run before 08:00 PM) is listed 08:00 → 08:45 PM, 0.75 h',
          async () => {
            await showStaff(staff);
            const row = await findRow(staff, inAt);
            expect(row?.dateOut).toBe(usDateTime(outAt));
            expect(row?.total).toBe('0.75');
          },
        );
        await step(
          'TIME-070 tomorrow on the Date IN calendar: either locked, or a record there saves (8 h)',
          async () => {
            await openAdd();
            await openCalendar('add', 'Date IN');
            const day = await calendarDayState(tomorrow);
            await P.escape();
            if (day === null || day.disabled) {
              // eslint-disable-next-line no-console
              console.log(
                `[TIME-070] tomorrow ${mdy(tomorrow)} ${day === null ? 'not in the shown month' : 'is disabled'} on the Date IN calendar`,
              );
              await closeDlg('add');
              return;
            }
            await closeDlg('add');
            await addRecordOk({ staff, in: at(tomorrow, 9), out: at(tomorrow, 17) });
            future = at(tomorrow, 9);
            await ttOpen();
            await ttPickRange(today, tomorrow).catch(() => undefined);
            await ttSearch(staff);
            expect((await findRow(staff, future))?.total).toBe('8');
          },
        );
      } finally {
        await ttCleanup([staff], since);
        if (future) await ttCleanup([staff], since, [tomorrow, tomorrow]);
      }
    },
  );

  it(
    title(
      'Boundary records 12:00–12:01 AM, adjacent 12:01–12:02, 11:00–11:59 PM; overlap at the day end; bad edit not saved; Today / Yesterday / Custom range totals; staff search (TIME-044, TIME-048, TIME-049, TIME-060, TIME-061)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(8 * 60_000);
      if (nearMidnight()) this.skip();
      const staff = await oneStaff(this);
      const since = Date.now();
      const today = startOfDay();
      const y = yesterday();
      const recs = [
        { in: at(today, 0, 0), out: at(today, 0, 1), total: '0.02' },
        { in: at(today, 0, 1), out: at(today, 0, 2), total: '0.02' },
        { in: at(today, 23, 0), out: at(today, 23, 59), total: '0.98' },
      ];
      const yRec = { in: at(y, 23, 0), out: at(y, 23, 59), total: '0.98' };
      let yOk = false;
      const hours = (list: { total: string }[]): number =>
        Math.round(list.reduce((s, r) => s + (Number(r.total) || 0), 0) * 100) / 100;
      try {
        await ttOpen();
        await step('add 3 boundary records today (one adjacent) + 11 PM yesterday', async () => {
          for (const r of recs) await addRecordOk({ staff, in: r.in, out: r.out });
          yOk = (await addRecord({ staff, in: yRec.in, out: yRec.out })).ok;
        });
        await step('TIME-060 11:58–11:59 PM inside 11:00–11:59 PM → overlap', async () => {
          const r = await addRecord({ staff, in: at(today, 23, 58), out: at(today, 23, 59) });
          expect(r.ok).toBe(false);
          expect(r.errors.join(' ')).toMatch(OVERLAP);
        });
        await step('Edit 12:00 AM with OUT = IN → "Check out must be after"; Close → unchanged', async () => {
          await showStaff(staff, 'Today');
          const row = await findRow(staff, recs[0]?.in ?? today);
          if (!row) throw new Error('12:00 AM record missing');
          await openEdit(row);
          await setDateTime('edit', 'Date OUT', recs[0]?.in ?? today);
          await submit('edit');
          expect(await fieldError('edit', 'Date OUT')).toBe(
            `Check out must be after: ${usDateTime(recs[0]?.in ?? today)}`,
          );
          expect(await toastShown(T.toastUpdated, 1_500)).toBe(false);
          await closeDlg('edit');
          expect((await findRow(staff, recs[0]?.in ?? today))?.dateOut).toBe(
            usDateTime(recs[0]?.out ?? today),
          );
        });
        const mine = (
          list: { dateIn: string }[],
          want: { in: Date }[],
        ): { dateIn: string; total: string }[] =>
          (list as { dateIn: string; total: string }[]).filter((r) =>
            want.some((x) => r.dateIn === usDateTime(x.in)),
          );
        await step(
          'TIME-044 / TIME-061 Today: only today; 0.02 / 0.02 / 0.98 (adjacent saved), sum 1.02',
          async () => {
            const list = await rowsOf(staff);
            for (const r of list) expect(r.dateIn.startsWith(mdy(today))).toBe(true);
            for (const r of recs) expect((await findRow(staff, r.in))?.total).toBe(r.total);
            expect(mine(list, recs)).toHaveLength(3);
            expect(hours(mine(list, recs))).toBe(1.02);
          },
        );
        await step('Yesterday: only yesterday', async () => {
          await ttPreset('Yesterday');
          await ttSearch(staff);
          for (const r of await rowsOf(staff)) expect(r.dateIn.startsWith(mdy(y))).toBe(true);
          if (yOk) expect((await findRow(staff, yRec.in))?.total).toBe(yRec.total);
        });
        await step('TIME-048 Custom yesterday → today: both days, nothing outside; total', async () => {
          await ttPickRange(y, today);
          await ttSearch(staff);
          const list = await rowsOf(staff);
          for (const r of list) {
            const d = parseUsDateTime(r.dateIn);
            expect(!!d && d >= at(y, 0) && d <= at(today, 23, 59)).toBe(true);
          }
          const want = yOk ? [...recs, yRec] : recs;
          for (const r of want) expect(await findRow(staff, r.in)).not.toBeNull();
          expect(hours(mine(list, want))).toBe(yOk ? 2 : 1.02);
        });
        await step('TIME-049 search by 3 lower-case letters; no match → empty state', async () => {
          const part = staff.slice(0, 3).toLowerCase();
          await ttSearch(part);
          const list = await rows();
          expect(list.length).toBeGreaterThan(0);
          for (const r of list) expect(r.staff.toLowerCase()).toContain(part);
          expect(list.some((r) => r.staff === staff)).toBe(true);
          await ttSearch('zzz');
          expect(await P.has({ css: 'main', hasText: 'No time tracking records' })).toBe(true);
          expect(
            await P.has({
              css: 'main',
              hasText: 'No records found for "zzz". Try a different search or date range.',
            }),
          ).toBe(true);
        });
      } finally {
        await ttCleanup([staff], since, [y, today]);
      }
    },
  );
});
