/**
 * APPOINTMENT — appointment lines: start time, duration, staff, service, Add more
 * (VP-1615 Nhóm 3 — Line).
 *
 * Test cases: docs/screens/appointment/appointment-test-cases.md — TC-LINE-01..24.
 *
 * All 24 are PENDING on build 1.1.56: the create/edit form is not rendered
 * (2026-10-25 dump has no Create/New/+ entry; Linear P-VP-476 paused), and the
 * line controls (start-time picker, the two duration comboboxes, the Staff and
 * Service dropdowns with their All/Available/Busy filter) were never captured in
 * a DOM scan, so there is nothing verified to drive even behind a runtime gate.
 * Each title carries any extra blocker (fixture, NEEDS CONFIRM, known bug).
 * The TC-UI-01/02 overview cases live in appointment-overview.spec.ts.
 */

import { title } from '../../../src/types/testTags.js';

const NO_FORM = 'create/edit form not present on build 1.1.56 (P-VP-476 paused)';

describe('Appointment — lines: start time, duration, staff, service (VP-1615)', () => {
  it(title(`Start time from the header = now rounded up to 15 min (TC-LINE-01) — PENDING: ${NO_FORM}`));
  it(title(`Start time from a slot = the slot's time (TC-LINE-02) — PENDING: ${NO_FORM}`));
  it(
    title(
      `The Start time dropdown highlights the selected time (TC-LINE-03) [VP-2353] — PENDING: ${NO_FORM}`,
    ),
  );
  it(title(`Editing Start time by hand updates it (TC-LINE-04) — PENDING: ${NO_FORM}`));
  it(title(`Duration follows the chosen service (TC-LINE-05) — PENDING: ${NO_FORM}`));
  it(title(`Duration edited by hand is not reset to the service default (TC-LINE-06) — PENDING: ${NO_FORM}`));
  it(
    title(
      `A staff off/Closed that day cannot be picked (TC-LINE-07) [VP-2356] — PENDING: ${NO_FORM}; needs a staff with a Closed weekday`,
    ),
  );
  it(title(`Staff = "Any Staffs" shows every available service (TC-LINE-08) — PENDING: ${NO_FORM}`));
  it(
    title(
      `Any Staffs does not restrict the service list to one staff (TC-LINE-09) [VP-2358] — PENDING: ${NO_FORM}`,
    ),
  );
  it(title(`Staff = "Unassigned" shows "Unassigned" in the form (TC-LINE-10) — PENDING: ${NO_FORM}`));
  it(title(`Unassigned becomes Any Staffs on save (TC-LINE-11) — PENDING: NEEDS CONFIRM + ${NO_FORM}`));
  it(title(`Staff filter All / Available / Busy (TC-LINE-12) — PENDING: ${NO_FORM}`));
  it(
    title(
      `A busy staff warns "This Staff is not available for this time." (TC-LINE-13) — PENDING: ${NO_FORM}; needs an overlapping appointment fixture`,
    ),
  );
  it(
    title(
      `Select service lists services by Category with name/duration/price (TC-LINE-14) — PENDING: ${NO_FORM}`,
    ),
  );
  it(
    title(
      `A service the staff does not offer shows "Service unavailable for [Staff]" (TC-LINE-15) [VP-2360] — PENDING: ${NO_FORM}; needs a staff/service exclusion fixture`,
    ),
  );
  it(
    title(
      `Service is optional — Save allowed without it (TC-LINE-16) — PENDING: ${NO_FORM}; would book a QA-SCAN-20261025 appointment + cancel it`,
    ),
  );
  it(title(`Add more adds a line starting at line 1's end time (TC-LINE-17) — PENDING: ${NO_FORM}`));
  it(title(`Maximum number of lines (TC-LINE-18) — PENDING: NEEDS CONFIRM + ${NO_FORM}`));
  it(title(`Removing an added line (TC-LINE-19) — PENDING: NEEDS CONFIRM + ${NO_FORM}`));
  it(
    title(
      `Any Staffs when every staff is busy — warning text (TC-LINE-20) — PENDING: ${NO_FORM}; needs all-busy fixture`,
    ),
  );
  it(
    title(
      `Duration auto-fills from a non-1h service (TC-LINE-21) [VP-2366] — PENDING: ${NO_FORM}; needs a 45m service`,
    ),
  );
  it(title(`Duration accepts minutes beyond 0/15/30/45 (TC-LINE-22) [VP-2368] — PENDING: ${NO_FORM}`));
  it(title(`Start time picker snaps to 15-minute steps (TC-LINE-23) [VP-2369] — PENDING: ${NO_FORM}`));
  it(
    title(
      `Add more past midnight rolls over to 12:00 AM next day (TC-LINE-24) [VP-2364] — PENDING: ${NO_FORM}`,
    ),
  );
});
