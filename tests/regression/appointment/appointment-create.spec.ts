/**
 * APPOINTMENT — open the Create form, Customer, Date (VP-1615 Nhóm 1, 2, 3-Date).
 *
 * Test cases: docs/screens/appointment/appointment-test-cases.md
 *   TC-OPEN-01..09, TC-CUST-01..11, TC-DATE-01..04 (24).
 *
 * Build 1.1.56 has NO create entry (dump 2026-10-25; P-VP-476 paused) — see
 * ./appointment.helpers.ts. What runs here:
 *   - TC-OPEN-03 (past slot is a no-op) needs only the scheduler → runs on 1.1.56.
 *   - TC-OPEN-01/08/09, TC-CUST-02/04/09/11 drive the form without saving →
 *     runtime-gated: SKIP on 1.1.56, run on a build with the form.
 *   - the rest: PENDING (form absent, plus the TC's own fixture / confirm need).
 *
 * Creates NOTHING: no case presses Save.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { returnToHome } from '../../../src/flows/index.js';
import { appointmentPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { openOverview, requireCreateForm, skipBecause } from './appointment.helpers.js';

describe('Appointment — Create form: open, customer, date (VP-1615)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await openOverview();
  });

  beforeEach(async () => {
    await openOverview();
  });

  afterEach(async () => {
    await appointmentPage.closeDialog().catch(() => undefined);
  });

  after(async () => {
    await appointmentPage.closeDialog().catch(() => undefined);
    await returnToHome();
  });

  /* ------------------------------ Nhóm 1 — Mở form Create ------------------------------ */

  it(
    title('"Create Appointment" opens the dialog with Save disabled (TC-OPEN-01)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      await requireCreateForm(this);
      expect(await appointmentPage.isDialogOpen()).toBe(true);
      expect(await appointmentPage.isSaveEnabled()).toBe(false);
      // Start-time rounding is asserted by TC-LINE-01 (appointment-line.spec.ts).
    },
  );

  it(
    title(
      'Clicking a future slot opens the form prefilled with slot time/staff/date (TC-OPEN-02) — PENDING: create/edit form not present on build 1.1.56 (P-VP-476 paused)',
    ),
  );

  it(
    title('Clicking a past slot is a no-op — no dialog opens (TC-OPEN-03)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() < 15) {
        skipBecause(
          this,
          'the 12:00 AM slot is the CURRENT slot until 00:15 — not past yet (see TC-OPEN-04)',
        );
      }
      await appointmentPage.pressNow();
      const before = await appointmentPage.overviewParams();

      await appointmentPage.clickFirstSlotInUnassigned();

      expect(await appointmentPage.isAnyOverlayOpen(Timeouts.SHORT)).toBe(false);
      expect(await appointmentPage.isDialogOpen()).toBe(false);
      expect(await appointmentPage.isActive()).toBe(true);
      expect((await appointmentPage.overviewParams()).date).toBe(before.date);
    },
  );

  it(
    title(
      'Clicking the slot in progress — past or present? (TC-OPEN-04) — PENDING: NEEDS CONFIRM (PO ruling) + create/edit form not present on build 1.1.56 (P-VP-476 paused)',
    ),
  );
  it(
    title(
      'Block Time popup reads "Cannot schedule appointments outside staff\'s normal work hours!" (TC-OPEN-05) [VP-2343] — PENDING: needs a Block Time fixture on the viewed day; no block cell located on 1.1.56',
    ),
  );
  it(
    title(
      'Outside-business-hours message vs Block Time message (TC-OPEN-06) — PENDING: NEEDS CONFIRM + business-hours fixture',
    ),
  );
  it(
    title(
      'A Closed weekday in Work Hours is treated as block time (TC-OPEN-07) [VP-2344] — PENDING: mutates merchant Work Hours (@exclusive fixture) + create/edit form not present on build 1.1.56 (P-VP-476 paused)',
    ),
  );

  it(
    title('Close on an empty form closes it without a warning (TC-OPEN-08)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      await requireCreateForm(this);
      await appointmentPage.closeDialogViaButton();
      expect(await appointmentPage.isDialogOpen()).toBe(false);
      expect(await appointmentPage.isAnyOverlayOpen()).toBe(false);
    },
  );

  it(
    title(
      'Close after typing a phone closes the form (observed: no unsaved-changes prompt) (TC-OPEN-09)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await requireCreateForm(this);
      await appointmentPage.typePhone('250');
      await appointmentPage.closeDialogViaButton();
      // The doc records current behaviour: it closes straight away, no confirm.
      expect(await appointmentPage.isDialogOpen()).toBe(false);
      expect(await appointmentPage.isAnyOverlayOpen()).toBe(false);
    },
  );

  /* ------------------------------ Nhóm 2 — Customer ------------------------------ */

  it(
    title(
      'Phone search returns only matches, each masked (***) ***-NNNN (TC-CUST-01) [VP-2345, VP-2346] — PENDING: create/edit form not present on build 1.1.56 (P-VP-476 paused); suggestion-list markup never scanned',
    ),
  );

  it(
    title('No "10 or 11 digits" error while the phone is still being typed (TC-CUST-02)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      await requireCreateForm(this);
      await appointmentPage.typePhone('19');
      // Focus is still in the field — the error belongs to blur/submit.
      expect(await appointmentPage.isPhoneDigitsErrorShown()).toBe(false);
    },
  );

  it(
    title(
      'An unknown 10-digit phone offers "+ Create new client" (TC-CUST-03) [VP-2347] — PENDING: create/edit form not present on build 1.1.56 (P-VP-476 paused); action label never scanned',
    ),
  );

  it(
    title('An 11-digit phone can be typed in full (TC-CUST-04) [VP-2351]', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      await requireCreateForm(this);
      await appointmentPage.typePhone('12505550123');
      const digits = (await appointmentPage.phoneValue()).replace(/\D/g, '');
      expect(digits).toBe('12505550123');
      expect(await appointmentPage.isPhoneDigitsErrorShown()).toBe(false);
    },
  );

  it(
    title(
      'Customer Name search suggests name + masked phone (TC-CUST-05) [VP-2349] — PENDING: create/edit form not present on build 1.1.56 (P-VP-476 paused); needs a seeded customer name',
    ),
  );
  it(
    title(
      'Choosing a suggestion fills Phone/Name and closes the list (TC-CUST-06) — PENDING: create/edit form not present on build 1.1.56 (P-VP-476 paused)',
    ),
  );
  it(
    title(
      'The suggestion list scrolls by drag/wheel (TC-CUST-07) [VP-2357] — PENDING: create/edit form not present on build 1.1.56 (P-VP-476 paused); needs > one screen of matching customers',
    ),
  );
  it(
    title(
      'Create a new client inside the form and auto-select it (TC-CUST-08) — PENDING: depends on VP-2347 + create/edit form not present on build 1.1.56 (P-VP-476 paused)',
    ),
  );

  it(
    title('The phone "x" clears the input and the validation (TC-CUST-09)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      await requireCreateForm(this);
      await appointmentPage.typePhone('250');
      await appointmentPage.clearPhoneViaIcon();
      expect((await appointmentPage.phoneValue()).replace(/\D/g, '')).toBe('');
      expect(await appointmentPage.isPhoneDigitsErrorShown()).toBe(false);
    },
  );

  it(
    title(
      'Mask is consistent for international / other-length phones (TC-CUST-10) — PENDING: NEEDS CONFIRM + create/edit form not present on build 1.1.56 (P-VP-476 paused)',
    ),
  );

  it(
    title('Without a customer, Save Appointment stays disabled (TC-CUST-11)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      await requireCreateForm(this);
      await appointmentPage.typeNote('QA-SCAN-20261025 no customer');
      expect(await appointmentPage.isSaveEnabled()).toBe(false);
    },
  );

  /* ------------------------------ Nhóm 3 — Date ------------------------------ */

  it(
    title(
      'The form Date defaults to the day viewed on the calendar (TC-DATE-01) — PENDING: create/edit form not present on build 1.1.56 (P-VP-476 paused); form Date control never scanned',
    ),
  );
  it(
    title(
      'The form Date Next (>) reaches a future day (TC-DATE-02) [bug, no ticket] — PENDING: create/edit form not present on build 1.1.56 (P-VP-476 paused)',
    ),
  );
  it(
    title(
      'Saving with a past date/time is refused (TC-DATE-03) [VP-2342] — PENDING: create/edit form not present on build 1.1.56 (P-VP-476 paused); would book a QA-SCAN-20261025 appointment + cancel it',
    ),
  );
  it(
    title(
      'The form Date Previous (<) cannot go into the past (TC-DATE-04) [VP-2352] — PENDING: create/edit form not present on build 1.1.56 (P-VP-476 paused)',
    ),
  );
});
