/**
 * APPOINTMENT OVERVIEW — /appointment (the scheduler, no form).
 *
 * Test cases: docs/screens/appointment/appointment-test-cases.md — the two
 * Overview TCs of VP-1615 (Nhóm 3 "UI phụ trợ"):
 *   TC-UI-01  (VP-2355) the Unassigned column has a plain background, not hatching
 *   TC-UI-02  (VP-2365) a slight scroll on a past day does not jump across days
 * Both are KNOWN BUGS written to the Expected behaviour: they fail until fixed.
 *
 * Plus overview probes that are NOT doc TCs (marked "overview probe") — the
 * 1.1.56 dump (reports/scans/2026-10-25-feature-inventory/dom/appointment.json)
 * shows the overview is ALL this build renders, so its toolbar, day navigation
 * and filters are covered here so the screen is not left untested while the
 * create/edit form (P-VP-476) is paused.
 *
 * READ-ONLY: navigates days and opens/closes filter popovers; changes no data.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import {
  APPOINTMENT_STAFFS_LABEL,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUSES_LABEL,
  DEFAULT_APPOINTMENT_STATUSES,
} from '../../../src/constants/testids.appointment.js';
import { returnToHome } from '../../../src/flows/index.js';
import { settle } from '../../../src/helpers/wait.js';
import { appointmentPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { openOverview } from './appointment.helpers.js';

const DAY_SECONDS = 86_400;
/** A calendar day is 23–25 h across a DST switch. */
const isOneDay = (delta: number): boolean =>
  Math.abs(delta) >= DAY_SECONDS - 3_600 && Math.abs(delta) <= DAY_SECONDS + 3_600;

/** Today as the date trigger prints it — MM/DD/YYYY (EN) or DD/MM/YYYY (VI). */
function todayLabels(): string[] {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return [`${mm}/${dd}/${String(now.getFullYear())}`, `${dd}/${mm}/${String(now.getFullYear())}`];
}

const countIn = (label: string): number => Number(/\d+/.exec(label)?.[0] ?? 'NaN');

describe('Appointment — Overview (VP-1615 Overview TCs + overview probes)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await openOverview();
  });

  beforeEach(async () => {
    await openOverview();
  });

  after(async () => {
    await appointmentPage.closeDetail().catch(() => undefined);
    await returnToHome();
  });

  /* ------------------------------------------------------------------ *
   * Overview probes (not doc TCs)
   * ------------------------------------------------------------------ */

  it(
    title(
      'Overview renders its toolbar and carries date/statuses/staffIds in the URL (overview probe)',
      Tag.REGRESSION,
    ),
    async () => {
      expect(await appointmentPage.overviewToolbarVisibility()).toEqual({
        heading: true,
        now: true,
        previousDay: true,
        date: true,
        nextDay: true,
        staffs: true,
        statuses: true,
        reset: true,
      });

      const params = await appointmentPage.overviewParams();
      expect(params.date).not.toBeNull();
      expect(params.statuses.length).toBeGreaterThan(0);
      expect(params.staffIds.length).toBeGreaterThan(0);
      // The Unassigned bucket is a selectable "staff" in the filter.
      expect(params.staffIds).toContain('unassigned');
    },
  );

  it(
    title(
      'Previous/Next day move the view by exactly one day and Now returns to today (overview probe)',
      Tag.REGRESSION,
    ),
    async () => {
      await appointmentPage.pressNow();
      const today = await appointmentPage.dateLabel();
      expect(todayLabels()).toContain(today);
      const start = (await appointmentPage.overviewParams()).date ?? Number.NaN;

      await appointmentPage.stepDay('next');
      const next = (await appointmentPage.overviewParams()).date ?? Number.NaN;
      expect(isOneDay(next - start)).toBe(true);
      expect(next).toBeGreaterThan(start);

      await appointmentPage.stepDay('previous');
      await appointmentPage.stepDay('previous');
      const previous = (await appointmentPage.overviewParams()).date ?? Number.NaN;
      expect(isOneDay(start - previous)).toBe(true);
      expect(await appointmentPage.dateLabel()).not.toBe(today);

      await appointmentPage.pressNow();
      expect(await appointmentPage.dateLabel()).toBe(today);
    },
  );

  it(
    title(
      'Staffs / Statuses badges match the selection in the URL; defaults are scheduled+confirmed+done (overview probe)',
      Tag.REGRESSION,
    ),
    async () => {
      await appointmentPage.pressResetToDefault();
      const params = await appointmentPage.overviewParams();

      const statuses = await appointmentPage.statusesFilterLabel();
      expect(statuses).toMatch(APPOINTMENT_STATUSES_LABEL);
      expect(countIn(statuses)).toBe(params.statuses.length);
      expect([...params.statuses].sort()).toEqual([...DEFAULT_APPOINTMENT_STATUSES].sort());

      const staffs = await appointmentPage.staffsFilterLabel();
      expect(staffs).toMatch(APPOINTMENT_STAFFS_LABEL);
      // Whether the badge counts the "unassigned" bucket is not specified — accept either.
      expect([params.staffIds.length, params.staffIds.length - 1]).toContain(countIn(staffs));
    },
  );

  it(
    title(
      'The Statuses filter offers Scheduled, Confirmed, Canceled and Done (overview probe)',
      Tag.REGRESSION,
    ),
    async () => {
      const items = (await appointmentPage.readFilterItems('statuses')).join(' | ');
      for (const status of ['scheduled', 'confirmed', 'canceled', 'done'] as const) {
        expect(APPOINTMENT_STATUS_LABELS[status].some((label) => items.includes(label))).toBe(true);
      }
      expect(await appointmentPage.isAnyOverlayOpen()).toBe(false);
    },
  );

  /* ------------------------------------------------------------------ *
   * Doc TCs
   * ------------------------------------------------------------------ */

  it(
    title(
      'The Unassigned column renders a plain background like the staff columns (TC-UI-01) [VP-2355]',
      Tag.REGRESSION,
    ),
    async () => {
      await appointmentPage.pressNow();
      const { striped, evidence } = await appointmentPage.isUnassignedColumnStriped();
      // Expected per spec; fails while VP-2355 is open. `evidence` names the hatched layer.
      expect({ striped, evidence }).toEqual({ striped: false, evidence: [] });
    },
  );

  it(
    title(
      'A slight scroll on a past day does not jump across other past days (TC-UI-02) [VP-2365]',
      Tag.REGRESSION,
    ),
    async () => {
      await appointmentPage.pressNow();
      await appointmentPage.stepDay('previous');
      await appointmentPage.stepDay('previous');
      const pastLabel = await appointmentPage.dateLabel();
      const pastDate = (await appointmentPage.overviewParams()).date;

      await appointmentPage.scrollGridSlightly();
      // Give a runaway wheel handler time to show itself before reading.
      await settle(Timeouts.DEBOUNCE * 2);

      expect(await appointmentPage.dateLabel()).toBe(pastLabel);
      expect((await appointmentPage.overviewParams()).date).toBe(pastDate);

      await appointmentPage.pressNow();
    },
  );
});
