/**
 * VP-4402 — Appointment Overview: staff columns in the GAP order and coloured
 * like the staff (volt-pos PR #3274, build ≥ 1.1.87; BE sync VP-5094 /
 * volt-pos-api #1566, staff colour VP-5500) + sub-bug VP-5481.
 *
 * Test cases: docs/qc/volt-qc/vp-tickets/VP-4402-appointment-staff-order-color-test-cases.md
 * (TC-VP4402-01..04, 06, 07, 11..14 — TC-05, 08..10, 15, 16 removed 07/11/2026 on request;
 * numbers are not reused).
 *
 * ## Oracles
 *
 * GAP itself is a separate web app, so "same as GAP" is checked against the data
 * the POS sorts by: the `staff_appointment` display-order rows synced from GCI
 * `employee.priority` (`vp-4402.helpers.ts` re-derives volt-pos's
 * `sortStaffByAppointmentOrder`). The board is read by `appointmentBoardProbe`,
 * which sweeps the virtualised columns.
 *
 * ## Data
 *
 * VP-5481 cases carry the GAP colours QC read for merchant 14; TC-12/13
 * (null-colour staff and Unassigned → GAP `#5669FF`, POS side per VP-5500) are
 * `@broken` until fixed. Old staff only get their GCI colour once re-saved on
 * GoCheckin (store 14 was re-saved 06/11).
 *
 * READ-ONLY: navigates days and opens/closes the Staffs filter; changes nothing.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import {
  DEFAULT_STAFF_HEX,
  GAP_EXPECTED_COLORS,
  UNASSIGNED_LABELS,
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
  boardStaff,
  expectedColumnOrder,
  expectedDropdownOrder,
  rankOf,
  type BoardStaff,
} from './vp-4402.helpers.js';

const TICKET = 'VP-4402';
const MIN_BUILD = '1.1.87';

const isUnassigned = (name: string): boolean => (UNASSIGNED_LABELS as readonly string[]).includes(name);

let staff: BoardStaff[] = [];
let expected: BoardStaff[] = [];
/** Board columns of today, Unassigned excluded. */
let columns: BoardColumn[] = [];
let unassignedColumn: BoardColumn | undefined;

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

describe('VP-4402 — Appointment board: GAP staff order + staff colours (+ VP-5481)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await onToday();
    staff = await step('Read board staff + staff_appointment order', () => boardStaff());
    expected = expectedColumnOrder(staff);
    const all = await step('Read every board column header', () => appointmentBoardProbe.columns());
    unassignedColumn = all.find((c) => isUnassigned(c.name));
    columns = all.filter((c) => !isUnassigned(c.name));
  });

  beforeEach(async function (this: Mocha.Context): Promise<void> {
    if (this.currentTest?.title.includes('TC-VP4402-01') === true) return;
    await skipUnlessBuild(this, MIN_BUILD, TICKET);
  });

  after(async () => {
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
   * 2. Column colours
   * ------------------------------------------------------------------ */

  it(title('TC-VP4402-11: each column header is drawn in its staff colour', Tag.REGRESSION), () => {
    // Null-colour staff are VP-5481's fallback question (TC-12), not this one.
    const byName = new Map(staff.map((s) => [s.name, s]));
    const wrong = columns
      .map((c) => ({ c, s: byName.get(c.name) }))
      .filter(({ c, s }) => s?.colorHex != null && c.color !== toHex(s.colorHex))
      .map(({ c, s }) => `"${c.name}" header=${c.color} db=${s?.colorHex ?? 'null'}`);
    expect(wrong).toEqual([]);
  });

  /* ------------------------------------------------------------------ *
   * 3. VP-5481 — colours differ from GAP
   * ------------------------------------------------------------------ */

  it(
    title(
      'TC-VP4402-12: VP-5481 — no column is grey; a no-colour staff is #5669FF like GAP',
      Tag.REGRESSION,
      Tag.BROKEN,
    ),
    () => {
      for (const [name, hex] of Object.entries(GAP_EXPECTED_COLORS.staff)) {
        const col = columns.find((c) => c.name === name);
        if (col && name !== 'Anna') expect({ name, color: col.color }).toEqual({ name, color: hex });
      }
      const grey = columns.filter((c) => c.color === DEFAULT_STAFF_HEX).map((c) => c.name);
      expect(grey).toEqual([]);
      const byName = new Map(staff.map((s) => [s.name, s]));
      const wrongFallback = columns
        .filter((c) => byName.get(c.name)?.colorHex == null && byName.has(c.name))
        .filter((c) => c.color !== GAP_EXPECTED_COLORS.nullStaff)
        .map((c) => `${c.name}=${c.color}`);
      expect(wrongFallback).toEqual([]);
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

  it(title('TC-VP4402-14: VP-5481 — Anna carries her GAP colour #96BDF5', Tag.REGRESSION), function () {
    const anna = columns.find((c) => c.name === 'Anna');
    if (!anna) skipBecause(this, 'no staff "Anna" on this merchant board');
    expect(anna.color).toBe(GAP_EXPECTED_COLORS.staff['Anna']);
  });
});
