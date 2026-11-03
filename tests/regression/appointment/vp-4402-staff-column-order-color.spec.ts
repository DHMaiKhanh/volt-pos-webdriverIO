/**
 * VP-4402 — Appointment Overview: staff columns in the GAP order and cards
 * tinted with the staff colour (volt-pos PR #3274, build ≥ 1.1.87; BE sync
 * VP-5094 / volt-pos-api #1566) + sub-bugs VP-5479 and VP-5481.
 *
 * Test cases: docs/qc/volt-qc/vp-tickets/VP-4402-appointment-staff-order-color-test-cases.md
 * (TC-VP4402-01..17).
 *
 * ## Oracles
 *
 * GAP itself is a separate web app (🧱), so "same as GAP" is checked against
 * the data the POS sorts by: the `staff_appointment` display-order rows synced
 * from GCI `employee.priority` (`vp-4402.helpers.ts` re-derives volt-pos's
 * `sortStaffByAppointmentOrder`). The board is read by
 * `appointmentBoardProbe`, which sweeps the virtualised columns / time rows.
 *
 * ## Data
 *
 * Card cases (TC-08..10) need appointments created on GAP within the next 7
 * days; without one they SKIP with the reason. VP-5481 cases carry the GAP
 * colours QC read on 02/11 for merchant 14 and are `@broken` until fixed, as is
 * TC-05 (VP-5479).
 *
 * READ-ONLY: navigates days and opens/closes the Staffs filter; changes nothing.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import {
  DEFAULT_STAFF_HEX,
  GAP_EXPECTED_COLORS,
  UNASSIGNED_LABELS,
  VP5479_STAFF,
} from '../../../src/constants/testids.vp-palette.js';
import { step } from '../../../src/helpers/steps.js';
import { appointmentPage } from '../../../src/pages/index.js';
import {
  appointmentBoardProbe,
  type BoardColumn,
} from '../../../src/pages/voltqc/vp-palette/AppointmentBoardProbe.js';
import { appVersion, skipUnlessBuild, versionAtLeast } from '../../../src/support/appVersion.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { toHex } from '../../../src/utils/color.js';
import { openOverview, skipBecause } from './appointment.helpers.js';
import {
  appointmentsByDay,
  boardStaff,
  expectedColumnOrder,
  expectedDropdownOrder,
  rankOf,
  type BoardStaff,
  type DayAppointments,
} from './vp-4402.helpers.js';

const TICKET = 'VP-4402';
const MIN_BUILD = '1.1.87';

const isUnassigned = (name: string): boolean => (UNASSIGNED_LABELS as readonly string[]).includes(name);

let staff: BoardStaff[] = [];
let expected: BoardStaff[] = [];
/** Board columns of today, Unassigned excluded. */
let columns: BoardColumn[] = [];
let unassignedColumn: BoardColumn | undefined;
let days: DayAppointments[] = [];

/** Back on Overview, on today. */
async function onToday(): Promise<void> {
  await openOverview();
  await appointmentPage.pressNow();
}

/** Step forward `offset` days from today. */
async function goToDay(offset: number): Promise<void> {
  await onToday();
  for (let i = 0; i < offset; i += 1) await appointmentPage.stepDay('next');
  await appointmentBoardProbe.waitForColumns();
}

/** Board position (0-based, Unassigned excluded) of each name. */
const positions = (cols: BoardColumn[]): Map<string, number> => new Map(cols.map((c, i) => [c.name, i]));

describe('VP-4402 — Appointment board: GAP staff order + staff-coloured cards (+ VP-5479, VP-5481)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await onToday();
    staff = await step('Read board staff + staff_appointment order', () => boardStaff());
    expected = expectedColumnOrder(staff);
    const all = await step('Read every board column header', () => appointmentBoardProbe.columns());
    unassignedColumn = all.find((c) => isUnassigned(c.name));
    columns = all.filter((c) => !isUnassigned(c.name));
    days = await step('Find appointments in the next 7 days', () => appointmentsByDay(7));
  });

  beforeEach(async function (this: Mocha.Context): Promise<void> {
    if (this.currentTest?.title.includes('TC-VP4402-01') === true) return;
    await skipUnlessBuild(this, MIN_BUILD, TICKET);
  });

  after(async () => {
    await appointmentPage.closeDetail().catch(() => undefined);
    await onToday().catch(() => undefined);
  });

  /* ------------------------------------------------------------------ *
   * 1. Column order
   * ------------------------------------------------------------------ */

  it(title('TC-VP4402-01: the installed build carries the feature (≥ 1.1.87)', Tag.REGRESSION), async () => {
    const version = await appVersion();
    expect(version).not.toBe('');
    expect(versionAtLeast(version, MIN_BUILD)).toBe(true);
  });

  it(
    title('TC-VP4402-02: board columns follow the staff_appointment (GAP) priority order', Tag.REGRESSION),
    () => {
      expect(unassignedColumn).toBeDefined();
      expect(columns.length).toBe(expected.length);
      expect(columns.map((c) => c.name)).toEqual(expected.map((s) => s.name));
    },
  );

  it(title('TC-VP4402-03: priority = 0 staff sit after every ranked staff', Tag.REGRESSION), function () {
    const pos = positions(columns);
    const zero = staff.filter((s) => rankOf(s) === 1);
    if (zero.length === 0) skipBecause(this, 'no staff_appointment row with priority 0 on this merchant');
    const lastRanked = Math.max(
      -1,
      ...staff.filter((s) => rankOf(s) === 0).map((s) => pos.get(s.name) ?? -1),
    );
    const firstUnranked = Math.min(
      columns.length,
      ...staff.filter((s) => rankOf(s) === 2).map((s) => pos.get(s.name) ?? columns.length),
    );
    const misplaced = zero
      .map((s) => ({ name: s.name, at: pos.get(s.name) ?? -1 }))
      .filter((z) => z.at <= lastRanked || z.at >= firstUnranked);
    expect(misplaced).toEqual([]);
  });

  it(
    title('TC-VP4402-04: staff without a staff_appointment row are the board tail', Tag.REGRESSION),
    function () {
      const unranked = expected.filter((s) => rankOf(s) === 2).map((s) => s.name);
      if (unranked.length === 0) skipBecause(this, 'every board staff has a staff_appointment row');
      expect(columns.slice(-unranked.length).map((c) => c.name)).toEqual(unranked);
    },
  );

  it(
    title(
      'TC-VP4402-05: VP-5479 — 1001vvv is column 2 like GAP (every staff has a row)',
      Tag.REGRESSION,
      Tag.BROKEN,
    ),
    () => {
      const missing = staff.filter((s) => rankOf(s) === 2).map((s) => s.name);
      expect(missing).toEqual([]);
      const target = staff.find((s) => s.name === VP5479_STAFF);
      if (target) expect(columns[0]?.name).toBe(VP5479_STAFF);
    },
  );

  it(title('TC-VP4402-06: the Staffs filter dropdown keeps its A→Z order', Tag.REGRESSION), async () => {
    await onToday();
    const items = await appointmentPage.readFilterItems('staffs');
    const known = new Set(staff.map((s) => s.name));
    const listed = items.filter((label) => known.has(label));
    expect(listed.length).toBeGreaterThan(1);
    const alpha = expectedDropdownOrder(staff).filter((name) => listed.includes(name));
    expect(listed).toEqual(alpha);
  });

  it(title('TC-VP4402-07: the column order does not change with the day', Tag.REGRESSION), async () => {
    await goToDay(1);
    const tomorrow = (await appointmentBoardProbe.columns()).filter((c) => !isUnassigned(c.name));
    await onToday();
    expect(tomorrow.map((c) => c.name)).toEqual(columns.map((c) => c.name));
  });

  /* ------------------------------------------------------------------ *
   * 2. Card and column colours
   * ------------------------------------------------------------------ */

  it(
    title(
      'TC-VP4402-08: an assigned card is tinted with its staff colour and bordered in it',
      Tag.REGRESSION,
    ),
    async function () {
      const day = days.find((d) => d.assigned.some((a) => a.colorHex !== null));
      if (!day)
        skipBecause(this, 'no appointment with a coloured staff in the next 7 days (create one on GAP)');
      const appt = day.assigned.find((a) => a.colorHex !== null);
      if (!appt) skipBecause(this, 'no coloured assigned appointment');
      await goToDay(day.offset);
      const cards = await appointmentBoardProbe.cardsInColumn(appt.staffName);
      await onToday();
      expect(cards.length).toBeGreaterThan(0);
      const staffHex = toHex(appt.colorHex);
      for (const card of cards) {
        expect(card.tinted).toBe(true);
        expect(card.border).toBe(staffHex);
        // Mixed 30% toward the card colour: lighter than the staff colour, never white.
        expect(card.background).not.toBe(staffHex);
        expect(card.background).not.toBe('#FFFFFF');
      }
    },
  );

  it(
    title('TC-VP4402-09: an unassigned appointment sits in Unassigned without a staff tint', Tag.REGRESSION),
    async function () {
      const day = days.find((d) => d.unassigned > 0);
      if (!day) skipBecause(this, 'no unassigned appointment in the next 7 days (create one on GAP)');
      await goToDay(day.offset);
      const label = unassignedColumn?.name ?? UNASSIGNED_LABELS[0];
      const cards = await appointmentBoardProbe.cardsInColumn(label);
      await onToday();
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.filter((c) => c.tinted).map((c) => c.title)).toEqual([]);
    },
  );

  it(
    title(
      'TC-VP4402-10: a card on another day sits in its staff column, tinted, order unchanged',
      Tag.REGRESSION,
    ),
    async function () {
      const day = days.find((d) => d.offset > 0 && d.assigned.length > 0);
      if (!day)
        skipBecause(this, 'no assigned appointment after today in the next 7 days (create one on GAP)');
      const appt = day.assigned[0];
      if (!appt) skipBecause(this, 'no assigned appointment');
      await goToDay(day.offset);
      const order = (await appointmentBoardProbe.columns()).filter((c) => !isUnassigned(c.name));
      const cards = await appointmentBoardProbe.cardsInColumn(appt.staffName);
      await onToday();
      expect(order.map((c) => c.name)).toEqual(columns.map((c) => c.name));
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.every((c) => c.tinted)).toBe(true);
      expect(cards.every((c) => c.border === (toHex(appt.colorHex) || DEFAULT_STAFF_HEX))).toBe(true);
    },
  );

  it(title('TC-VP4402-11: each column header is drawn in its staff colour', Tag.REGRESSION), () => {
    const byName = new Map(staff.map((s) => [s.name, s]));
    const wrong = columns
      .map((c) => ({ c, s: byName.get(c.name) }))
      .filter(({ c, s }) => s !== undefined && c.color !== (toHex(s.colorHex) || DEFAULT_STAFF_HEX))
      .map(({ c, s }) => `"${c.name}" header=${c.color} db=${s?.colorHex ?? 'null'}`);
    expect(wrong).toEqual([]);
  });

  /* ------------------------------------------------------------------ *
   * 3. VP-5481 — colours differ from GAP
   * ------------------------------------------------------------------ */

  it(
    title(
      'TC-VP4402-12: VP-5481 — no board column falls back to the default grey',
      Tag.REGRESSION,
      Tag.BROKEN,
    ),
    () => {
      const grey = columns.filter((c) => c.color === DEFAULT_STAFF_HEX).map((c) => c.name);
      expect(grey).toEqual([]);
      for (const [name, hex] of Object.entries(GAP_EXPECTED_COLORS.staff)) {
        const col = columns.find((c) => c.name === name);
        if (col && name !== 'Anna') expect({ name, color: col.color }).toEqual({ name, color: hex });
      }
    },
  );

  it(
    title(
      'TC-VP4402-13: VP-5481 — the Unassigned column is blue #5669FF like GAP',
      Tag.REGRESSION,
      Tag.BROKEN,
    ),
    () => {
      expect(unassignedColumn?.color).toBe(GAP_EXPECTED_COLORS.unassigned);
    },
  );

  it(
    title('TC-VP4402-14: VP-5481 — Anna carries her GAP colour #96BDF5', Tag.REGRESSION, Tag.BROKEN),
    function () {
      const anna = columns.find((c) => c.name === 'Anna');
      if (!anna) skipBecause(this, 'no staff "Anna" on this merchant board');
      expect(anna.color).toBe(GAP_EXPECTED_COLORS.staff['Anna']);
    },
  );

  /* ------------------------------------------------------------------ *
   * 4. Not automatable here
   * ------------------------------------------------------------------ */

  it(
    title(
      'TC-VP4402-15: visual GAP vs POS board comparison — PENDING (GAP web pos.gocheckin.net)',
      Tag.REGRESSION,
    ),
  );
  it(
    title(
      'TC-VP4402-16: the API refuses staff_appointment writes (422/403) — PENDING (BE-only)',
      Tag.REGRESSION,
    ),
  );
});
