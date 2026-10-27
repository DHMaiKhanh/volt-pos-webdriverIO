/**
 * APPOINTMENT — Edit / Confirm / Cancel by status (VP-1615 Nhóm 6).
 *
 * Test cases: docs/screens/appointment/appointment-test-cases.md
 *   TC-EDIT-01..10, TC-CONFIRM-01..02, TC-CANCEL-01..03, TC-GUARD-01 (16).
 *
 * What runs on build 1.1.56:
 *   - the action MATRIX (TC-EDIT-01/02/03, TC-CONFIRM-02) is read off EXISTING
 *     appointments: open a card's detail, read which of Update / Confirm / Cancel
 *     it offers, close it. READ-ONLY — no action inside the detail is pressed.
 *     A status with no appointment in today + the next 6 days SKIPS (data, not a
 *     failure). Canceled cards are hidden by the default Statuses filter, so
 *     TC-EDIT-03 turns that status on and restores the default afterwards.
 *   - everything that MUTATES an appointment is PENDING: the rule is to change
 *     only appointments this suite booked (customer prefix QA-SCAN-20261025,
 *     cancelled in after), and the form to book one is not on this build.
 *
 * The appointment card / detail markup is UNVERIFIED (the dump's day had no
 * appointments) — see AppointmentScreenIds.cards / detail* in
 * src/constants/testids.appointment.ts.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { returnToHome } from '../../../src/flows/index.js';
import { appointmentPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { NO_FORM_REASON, openOverview, skipBecause } from './appointment.helpers.js';

const NO_FORM = NO_FORM_REASON;
const OWN_ONLY = 'mutates an appointment — allowed only on a QA-SCAN-20261025 appointment this suite books';

/** Open an existing appointment of `status` (today..+6 days) or skip the test. */
async function openOrSkip(
  ctx: Mocha.Context,
  status: Parameters<typeof appointmentPage.openAppointmentWithStatus>[0],
): Promise<void> {
  await appointmentPage.pressNow();
  if (!(await appointmentPage.openAppointmentWithStatus(status))) {
    skipBecause(ctx, `no ${status} appointment on the scheduler between today and +6 days`);
  }
}

describe('Appointment — Edit / Confirm / Cancel (VP-1615)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await openOverview();
  });

  beforeEach(async () => {
    await openOverview();
  });

  afterEach(async () => {
    await appointmentPage.closeDetail().catch(() => undefined);
  });

  after(async () => {
    await appointmentPage.closeDetail().catch(() => undefined);
    await appointmentPage.pressResetToDefault().catch(() => undefined);
    await returnToHome();
  });

  it(
    title('A Scheduled appointment offers Update, Confirm and Cancel (TC-EDIT-01)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openOrSkip(this, 'scheduled');
      expect(await appointmentPage.detailActions()).toEqual({ update: true, confirm: true, cancel: true });
    },
  );

  it(
    title('A Confirmed appointment offers Update and Cancel, no Confirm (TC-EDIT-02)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openOrSkip(this, 'confirmed');
      expect(await appointmentPage.detailActions()).toEqual({ update: true, confirm: false, cancel: true });
    },
  );

  it(
    title('A Canceled appointment offers no action (TC-EDIT-03)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      this.timeout(Timeouts.MOCHA_HOOK);
      // Canceled is outside the default Statuses selection (scheduled/confirmed/done).
      await appointmentPage.toggleStatusFilter('canceled');
      try {
        await openOrSkip(this, 'canceled');
        expect(await appointmentPage.detailActions()).toEqual({
          update: false,
          confirm: false,
          cancel: false,
        });
      } finally {
        await appointmentPage.closeDetail().catch(() => undefined);
        await appointmentPage.pressResetToDefault();
      }
    },
  );

  it(
    title(
      'A Done appointment offers no action except Checkout (TC-EDIT-04) — PENDING: NEEDS CONFIRM; Done is set by the Checkout task (separate ticket), no linked fixture',
    ),
  );
  it(
    title(
      `Editing fields → "send a message to [Customer]?" popup; status unchanged (TC-EDIT-05) — PENDING: ${NO_FORM}; ${OWN_ONLY}`,
    ),
  );
  it(
    title(
      `Edit → Send sends the SMS and updates the appointment (TC-EDIT-06) — PENDING: ${NO_FORM}; ${OWN_ONLY}; SMS verification needs a log/mock`,
    ),
  );
  it(title(`Edit → Don't Send updates without SMS (TC-EDIT-07) — PENDING: ${NO_FORM}; ${OWN_ONLY}`));
  it(
    title(
      `Edit that creates an overlap re-runs validation? (TC-EDIT-08) — PENDING: NEEDS CONFIRM + ${NO_FORM}`,
    ),
  );
  it(
    title(
      `Edit of a Repeat occurrence — one or the whole series? (TC-EDIT-09) — PENDING: NEEDS CONFIRM + Repeat setting + ${NO_FORM}`,
    ),
  );
  it(
    title(
      `Edit a line's Staff/Service shows the new values (child replaced) (TC-EDIT-10) — PENDING: ${NO_FORM}; ${OWN_ONLY}`,
    ),
  );
  it(
    title(
      `Confirm a Scheduled appointment → popup, SMS, notification, Confirmed (TC-CONFIRM-01) — PENDING: ${OWN_ONLY}; no form on 1.1.56 to book a Scheduled one`,
    ),
  );

  it(
    title('Confirm is not offered on a non-Scheduled appointment (TC-CONFIRM-02)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      this.timeout(Timeouts.MOCHA_HOOK);
      await appointmentPage.pressNow();
      const found =
        (await appointmentPage.openAppointmentWithStatus('confirmed')) ||
        (await (async () => {
          await appointmentPage.pressNow();
          return appointmentPage.openAppointmentWithStatus('done');
        })());
      if (!found) skipBecause(this, 'no Confirmed or Done appointment between today and +6 days');
      expect((await appointmentPage.detailActions()).confirm).toBe(false);
    },
  );

  it(
    title(
      `Cancel a Scheduled appointment → popup, SMS, notification, Canceled (TC-CANCEL-01) — PENDING: ${OWN_ONLY}; no form on 1.1.56 to book one`,
    ),
  );
  it(
    title(
      `Cancel a Confirmed appointment (TC-CANCEL-02) — PENDING: ${OWN_ONLY}; no form on 1.1.56 to book one`,
    ),
  );
  it(
    title(
      `Dismissing the Cancel confirm keeps the status (TC-CANCEL-03) — PENDING: ${OWN_ONLY} (a mis-click would cancel a real appointment); no form on 1.1.56 to book one`,
    ),
  );
  it(
    title(
      'Passcode / staff-code guard on Edit / Confirm / Cancel (TC-GUARD-01) — PENDING: NEEDS CONFIRM; guard source task not linked + needs an own appointment to act on',
    ),
  );
});
