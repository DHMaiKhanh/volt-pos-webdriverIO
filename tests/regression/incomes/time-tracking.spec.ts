/**
 * Time Tracking — `/time-tracking` (the owner-facing clock-in management table).
 *
 * Source: docs/screens/time-tracking/time-tracking-test-cases.md
 * (TC-TT-01…12, one `it()` each, IDs unchanged).
 *
 * ## Writes — DEV only, own records only
 *
 * TC-TT-05…08/10 create, edit and delete ONE record whose note carries
 * {@link QA_MARKER}. Pre-existing records are never edited or deleted — every
 * Edit/Delete is addressed by that marker. The `after` hook deletes any record
 * still carrying the marker (a failed run included), so the staff member it
 * clocked in does not stay "clocked in" on the till.
 *
 * Each write case is self-sufficient: {@link ensureQaRecord} creates the record
 * when an earlier case failed before making it (or TC-TT-07 already deleted it).
 *
 * ## What the installed build differs on (1.1.56 / develop source)
 *
 * - Note has a hard `maxLength=255`, so TC-TT-11 observes truncation, not a
 *   validation message.
 * - A record inside a locked payroll gets a DISABLED Delete button
 *   (`isReadOnly`) rather than the message the Linear doc describes — TC-TT-12
 *   stays pending until a locked-payroll fixture exists.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/index.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { timeTrackingPage } from '../../../src/pages/index.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** The only records this spec may touch. Edits APPEND to it, so `contains` still finds them. */
const QA_MARKER = 'QA-SCAN-20261025';
const QA_NOTE_EDITED = `${QA_MARKER} edited`;

const TODAY = ['Today', 'Hôm nay'];
const THIS_WEEK = ['This Week', 'Tuần này'];

const STAFF_REQUIRED = /Staff is required/;
const ADDED_TOAST = /Time keeping added successfully|Đã thêm chấm công thành công/;
const DELETED_TOAST = /Time Keeping record deleted successfully|Đã xoá bản ghi chấm công thành công/;
const EMPTY_RANGE_HINT =
  /No time tracking data for the selected date range\.|Không có dữ liệu chấm công cho khoảng ngày đã chọn\./;
const EMPTY_SEARCH_HINT = /No records found for|Không tìm thấy bản ghi cho/;

/** A search string no staff nickname contains. */
const NO_SUCH_STAFF = 'zzqa-no-such-staff-9';

/** Staff chosen when the QA record was created — read back by later cases. */
let qaStaff = '';

/**
 * Make sure exactly the QA record exists for today, creating it when missing.
 * Returns the staff nickname on it.
 */
async function ensureQaRecord(): Promise<string> {
  await timeTrackingPage.open();
  const existing = await timeTrackingPage.recordByNote(QA_MARKER);
  if (existing) {
    qaStaff = existing.staff;
    return qaStaff;
  }
  assertWritesAllowed('create a time keeping record');
  qaStaff = await step('Create the QA time keeping record', () => timeTrackingPage.addRecord(QA_MARKER));
  await timeTrackingPage.waitRecord(QA_MARKER);
  return qaStaff;
}

/** Delete every record (today) whose note carries the marker. Never touches anything else. */
async function deleteQaRecords(): Promise<void> {
  await timeTrackingPage.open();
  for (let i = 0; i < 5 && (await timeTrackingPage.hasRecordWithNote(QA_MARKER, Timeouts.SHORT)); i++) {
    await timeTrackingPage.openDeleteFor(QA_MARKER);
    await timeTrackingPage.confirmDelete();
  }
}

describe('Time Tracking', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    try {
      await deleteQaRecords();
    } finally {
      await ensurePasscodeGrant();
    }
  });

  it(title('The passcode gate blocks /time-tracking (TC-TT-01)', Tag.REGRESSION), async () => {
    await step('Drop the 30-minute grant and open the route', async () => {
      await returnToHome();
      await clearPasscodeGrant();
      await timeTrackingPage.navigateGated();
    });

    expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(true);
    expect(await timeTrackingPage.gateTitle()).toMatch(/Time Tracking|Quản lý chấm công/);
    expect(await timeTrackingPage.isLoaded(Timeouts.ANIMATION)).toBe(false);
  });

  it(
    title('The correct passcode opens Time Tracking with its table and filters (TC-TT-02)', Tag.REGRESSION),
    async () => {
      if (!(await passcodeDialog.isPrompting(Timeouts.SHORT))) {
        await returnToHome();
        await clearPasscodeGrant();
        await timeTrackingPage.navigateGated();
      }

      await step('Enter the owner passcode', () => passcodeDialog.unlockForRun(env.OWNER_PASSCODE));

      expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION)).toBe(false);
      expect(await timeTrackingPage.isLoaded(Timeouts.MEDIUM)).toBe(true);
      expect(await timeTrackingPage.filtersVisible()).toBe(true);
      expect(await timeTrackingPage.headers()).toEqual([
        '#',
        expect.stringMatching(/^(Staff|Nhân viên)$/),
        expect.stringMatching(/^(Date IN|Giờ vào)$/),
        expect.stringMatching(/^(Date OUT|Giờ ra)$/),
        expect.stringMatching(/^(Total Hours|Tổng giờ)$/),
        expect.stringMatching(/^(Created At|Ngày tạo)$/),
        expect.stringMatching(/^(Updated At|Ngày cập nhật)$/),
        expect.stringMatching(/^(Note|Lưu ý|Ghi chú)$/),
        expect.stringMatching(/^(Action|Hành động)$/),
      ]);
    },
  );

  it(title('Empty state when there are no records (TC-TT-03)', Tag.REGRESSION), async () => {
    await timeTrackingPage.open();
    const records = await timeTrackingPage.readRecords();

    if (records.length === 0) {
      // Today genuinely has no records — the doc's exact precondition.
      expect(await timeTrackingPage.isEmpty()).toBe(true);
      expect(await timeTrackingPage.emptyHint()).toMatch(EMPTY_RANGE_HINT);
      return;
    }

    // Today has records, so reach the same empty state deterministically through
    // a search nobody matches; the title is the same, the hint names the search.
    try {
      await timeTrackingPage.search(NO_SUCH_STAFF);
      expect(await timeTrackingPage.isEmpty()).toBe(true);
      expect(await timeTrackingPage.emptyHint()).toMatch(EMPTY_SEARCH_HINT);
    } finally {
      await timeTrackingPage.search('');
    }
  });

  it(title('Add requires a Staff selection (TC-TT-04)', Tag.REGRESSION), async () => {
    await timeTrackingPage.open();
    await timeTrackingPage.openAddDialog();
    try {
      await timeTrackingPage.pressSubmit();

      expect((await timeTrackingPage.formMessages()).join(' | ')).toMatch(STAFF_REQUIRED);
      expect(await timeTrackingPage.isStaffInvalid()).toBe(true);
      expect(await timeTrackingPage.isAddDialogOpen()).toBe(true);
    } finally {
      await timeTrackingPage.closeDialog();
    }
  });

  it(
    title('Adding a Time Keeping record succeeds (TC-TT-05)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      assertWritesAllowed('create a time keeping record');
      // Start from a clean slate so THIS case is the one that adds.
      await deleteQaRecords();

      qaStaff = await step('Add a record with the QA note', () => timeTrackingPage.addRecord(QA_MARKER));
      // The toast is transient — read it before anything else.
      expect((await timeTrackingPage.toastTexts()).join(' | ')).toMatch(ADDED_TOAST);

      await timeTrackingPage.waitRecord(QA_MARKER);
      const record = await timeTrackingPage.recordByNote(QA_MARKER);
      expect(record).not.toBeNull();
      expect(record?.staff).toBe(qaStaff);
      expect(record?.dateIn).toMatch(/\d/);
      expect(record?.dateOut).toBe('-');
      expect(record?.totalHours).toBe('—');
      // Date IN, Created At and Updated At are all the submit instant.
      expect(record?.createdAt).toBe(record?.updatedAt);
      expect(record?.note).toBe(QA_MARKER);
    },
  );

  it(
    title(
      'Staff is locked (disabled) in Edit and Save waits for a change (TC-TT-06)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const staff = await ensureQaRecord();
      await timeTrackingPage.openEditFor(QA_MARKER);

      expect(await timeTrackingPage.isStaffReadonly()).toBe(true);
      expect(await timeTrackingPage.readonlyStaffName()).toContain(staff);
      expect(await timeTrackingPage.isSubmitEnabled()).toBe(false);

      // Editing another field enables Save; saving updates only the note.
      await timeTrackingPage.setNote(QA_NOTE_EDITED);
      expect(await timeTrackingPage.isSubmitEnabled()).toBe(true);
      await timeTrackingPage.pressSubmit();
      await timeTrackingPage.waitDialogClosed();

      await timeTrackingPage.waitRecord(QA_NOTE_EDITED);
      const record = await timeTrackingPage.recordByNote(QA_MARKER);
      expect(record?.note).toBe(QA_NOTE_EDITED);
      expect(record?.staff).toBe(staff);
    },
  );

  it(
    title('Deleting a Time Keeping record succeeds (TC-TT-07)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const staff = await ensureQaRecord();
      await timeTrackingPage.openDeleteFor(QA_MARKER);

      expect(await timeTrackingPage.deleteDialogText()).toContain(staff);
      await timeTrackingPage.confirmDelete();
      expect((await timeTrackingPage.toastTexts()).join(' | ')).toMatch(DELETED_TOAST);

      await timeTrackingPage.waitRecordGone(QA_MARKER);
      expect(await timeTrackingPage.hasRecordWithNote(QA_MARKER)).toBe(false);
    },
  );

  it(
    title('Cancel in the delete confirmation keeps the record (TC-TT-08)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await ensureQaRecord();
      await timeTrackingPage.openDeleteFor(QA_MARKER);
      await timeTrackingPage.cancelDelete();

      expect(await timeTrackingPage.isDeleteDialogOpen()).toBe(false);
      expect(await timeTrackingPage.hasRecordWithNote(QA_MARKER, Timeouts.SHORT)).toBe(true);
    },
  );

  it(title('Changing the date preset re-queries the table (TC-TT-09)', Tag.REGRESSION), async () => {
    await timeTrackingPage.open();
    expect(TODAY).toContain(await timeTrackingPage.presetText());
    const todayCount = (await timeTrackingPage.readRecords()).length;

    await timeTrackingPage.selectPreset(...THIS_WEEK);

    expect(THIS_WEEK).toContain(await timeTrackingPage.presetText());
    // A wider range can only hold as many records as today, or more — and the
    // table is either rows or the empty state, never neither.
    const weekCount = (await timeTrackingPage.readRecords()).length;
    expect(weekCount).toBeGreaterThanOrEqual(todayCount);
    if (weekCount === 0) expect(await timeTrackingPage.isEmpty()).toBe(true);
  });

  it(
    title('Search staff filters the table by name (TC-TT-10)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const staff = await ensureQaRecord();
      // A partial name — the doc allows "đúng/một phần".
      const query = staff.length > 3 ? staff.slice(0, Math.ceil(staff.length / 2)) : staff;

      try {
        await timeTrackingPage.search(query);
        const records = await timeTrackingPage.readRecords();

        expect(records.length).toBeGreaterThan(0);
        expect(records.some((r) => r.note.includes(QA_MARKER))).toBe(true);
        const strays = records.filter((r) => !r.staff.toLowerCase().includes(query.toLowerCase()));
        expect(strays.map((r) => r.staff)).toEqual([]);
      } finally {
        await timeTrackingPage.search('');
      }
    },
  );

  it(title('Note is limited to 255 characters in Add (TC-TT-11)', Tag.REGRESSION), async () => {
    await timeTrackingPage.open();
    await timeTrackingPage.openAddDialog();
    try {
      await timeTrackingPage.chooseStaff(0);
      await timeTrackingPage.setNote('N'.repeat(300));

      // The input carries maxLength=255: the build CUTS at 255 rather than
      // showing a message (the schema's "Note must be less than 255 characters"
      // is unreachable by typing).
      expect((await timeTrackingPage.noteValue()).length).toBe(255);
    } finally {
      // Never saved: the dialog is closed with its X.
      await timeTrackingPage.closeDialog();
    }
    expect(await timeTrackingPage.isAddDialogOpen()).toBe(false);
  });

  it(
    title(
      'TC-TT-12: a record inside a locked payroll cannot be deleted — PENDING (needs a seeded time record inside a LOCKED payroll period; build 1.1.56 disables the Delete button for it instead of showing the Linear message)',
    ),
  );
});
