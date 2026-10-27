/**
 * volt-qc 08 APPOINTMENT / 09 TIME KEEPING / 15 TURN — cases the POS lane cannot automate.
 *
 * TC catalogue: docs/qc/volt-qc/windows-regression/08-appointment.md,
 * 09-time-keeping.md, 15-turn.md. Automated cases live in
 * tests/regression/volt-qc/appt-time-turn/ and tests/regression/volt-qc/pos|reports-time/.
 *
 * Every entry is a Mocha PENDING test (`it.skip`) so the id is tracked in the
 * report and in docs/qc/volt-qc/COVERAGE.md. The comment above each says why it
 * needs a human (or a lane this suite does not have): the online booking site,
 * GoBooking / Portal web, a second POS, an overnight run, seeded data the POS
 * cannot create, or a feature build 1.1.56 does not ship.
 */

import { Tag, title } from '../../../../src/types/testTags.js';

const manual = (summary: string): string => title(`[MANUAL] ${summary}`, Tag.REGRESSION);

describe('volt-qc 08 APPOINTMENT — manual', () => {
  // Needs the GoCheckin (GBK) dashboard to compare against.
  it.skip(
    manual('Board lists every appointment of the day like the GBK dashboard, Unassigned included (APPT-021)'),
    () => {},
  );
  // Needs a new booking placed on the online booking site for a chosen staff.
  it.skip(
    manual('Online booking lands in the chosen staff column, never in a blocked area (APPT-022)'),
    () => {},
  );
  // Needs Work Hours edited / a staff day closed in Settings to know the expected hatching.
  it.skip(manual('Outside-work-hours area of a staff is hatched (APPT-024)'), () => {});
  // Needs two seeded Confirmed bookings at the same time for one staff, plus an app reload.
  it.skip(
    manual('A Confirmed appointment in the list is shown at its time, also after Reload (APPT-027)'),
    () => {},
  );
  // Needs an online multi-service, multi-staff booking.
  it.skip(manual('Multi-service multi-staff booking spans several columns (APPT-029)'), () => {});
  // Needs a seeded booking that crosses midnight.
  it.skip(
    manual('An appointment crossing midnight shows only the part on the current day (APPT-031)'),
    () => {},
  );
  // Needs customer names compared with the GBK dashboard.
  it.skip(manual('Customer name matches GBK, never "Unknown" or blank (APPT-049)'), () => {});
  // Needs a guest booking (booker name, no customer) from GBK / DTS.
  it.skip(manual('Walk-in booking without customer shows the booker name (APPT-050)'), () => {});
  // Needs a seeded booking with no contact and a sub-line.
  it.skip(
    manual('Line without name and booker shows Unknown; sub-lines borrow the root line name (APPT-051)'),
    () => {},
  );
  // Needs a seeded booking with a Product item.
  it.skip(manual('Product items show the product name (APPT-052)'), () => {});
  // Needs a seeded service with a 60-character name.
  it.skip(manual('Long service names are truncated inside the card (APPT-053)'), () => {});
  // Highlight / Requested / No Show tags are only set in GoBooking.
  it.skip(manual('Highlight, Requested and No Show tags are displayed (APPT-054)'), () => {});
  // Needs an online multi-service booking that was checked out.
  it.skip(
    manual('Every line of a checked-out multi-service booking shows the same order number (APPT-055)'),
    () => {},
  );
  // Needs an order paid while the booking is not Done yet (short sync window, real payment).
  it.skip(manual('Booking whose order is paid (no longer pending) has no Checkout (APPT-064)'), () => {});
  // No fixture for a staff code whose role lacks "view phone number".
  it.skip(manual('Staff without the phone permission is refused (APPT-069)'), () => {});
  // No fixture for an inactive staff code.
  it.skip(manual('Inactive staff code is refused (APPT-070)'), () => {});
  // No fixture for an active 30-minute skip held by a staff without the permission.
  it.skip(
    manual('30-minute skip of a staff without permission does not reveal the phone (APPT-073)'),
    () => {},
  );
  // Not shipped on build 1.1.56 (VP-1614).
  it.skip(
    manual('"Unlock customer phone for 30 minute" setting applies to appointments only (APPT-074)'),
    () => {},
  );
  // Needs a known mix of bookings (multi-service + canceled) to compute the expected badge.
  it.skip(
    manual('Header badge counts root bookings of today and ignores canceled ones (APPT-075)'),
    () => {},
  );
  // Needs a new online booking to sync in.
  it.skip(manual('Header badge updates by itself when a new appointment syncs in (APPT-078)'), () => {});
  // Needs an online multi-service, multi-staff booking.
  it.skip(
    manual('Multi-service multi-staff booking creates one order with every service (APPT-086)'),
    () => {},
  );
  // Needs an online "Any staff" booking.
  it.skip(manual('"Any staff" (Unassigned) line is assigned to the first active staff (APPT-088)'), () => {});
  // Needs an online booking with a staff and no service.
  it.skip(
    manual('Booking without services creates an order with customer and staff, no items (APPT-089)'),
    () => {},
  );
  // Needs the booking staff deactivated in Portal.
  it.skip(manual('Inactive booking staff warns and asks for another staff (APPT-093)'), () => {});
  // Needs every staff inactive — not allowed on a shared merchant.
  it.skip(manual('No active staff left for the Unassigned line shows an error (APPT-094)'), () => {});
  // Needs a second POS device.
  it.skip(
    manual('Booking already given an order by another device does not get a second order (APPT-095)'),
    () => {},
  );
  // Needs a second POS device.
  it.skip(manual('Two devices checking out one booking at once produce one order (APPT-096)'), () => {});
  // Paying turns a real booking Done for good; needs a seeded online booking.
  it.skip(manual('After payment the booking becomes Done and loses Checkout (APPT-097)'), () => {});
  // Same seeded booking + payment as APPT-097.
  it.skip(manual('Done status sticks and never goes back to Confirmed (APPT-098)'), () => {});
  // Needs a customer-linked online booking, a payment and a points check.
  it.skip(manual('Order from an appointment keeps the customer and earns points (APPT-099)'), () => {});
  // Needs a past unpaid online booking (overnight) plus payment.
  it.skip(
    manual('Past appointment checked out today gets the completion date as order date (APPT-100)'),
    () => {},
  );
  // Needs the order open on a second device.
  it.skip(
    manual('Order of the appointment open on another device shows "Order in use" (APPT-105)'),
    () => {},
  );
  // Needs a new-booking notification from the online booking site.
  it.skip(
    manual('Clicking a new-appointment notification moves the board to it and opens the popover (APPT-106)'),
    () => {},
  );
  // Needs a notification deep link.
  it.skip(
    manual('Changing the day after opening from a notification leaves deep-link mode (APPT-107)'),
    () => {},
  );
  // Needs new-booking notifications.
  it.skip(
    manual('Opening the board marks the appointment notifications of that day as read (APPT-108)'),
    () => {},
  );
  // Online booking site.
  it.skip(manual('New online booking appears on POS without reload (APPT-109)'), () => {});
  // Needs a cancellation done in GoBooking.
  it.skip(manual('Appointment canceled in GoBooking disappears from the board (APPT-110)'), () => {});
  // Needs a Work Hours change on Portal.
  it.skip(manual('Changing staff work hours on Portal updates the hatched area (APPT-111)'), () => {});
  // Needs a Vietnamese Checkout from a booking; labels / booking-time format not catalogued.
  it.skip(manual('Booking time in the order follows the Vietnamese format (APPT-114)'), () => {});

  // APPT-116..139: the create / edit / confirm / cancel / drag form is absent on build 1.1.56 (P-VP-476 paused).
  it.skip(manual('Create form from the header rounds the start time up to 15 minutes (APPT-116)'), () => {});
  it.skip(
    manual('Clicking a future slot opens the form at that time; a past slot does nothing (APPT-117)'),
    () => {},
  );
  it.skip(manual('Booking outside store hours is blocked (APPT-118)'), () => {});
  it.skip(manual('Customer is required (APPT-119)'), () => {});
  it.skip(manual('Customer search by phone and name (APPT-120)'), () => {});
  it.skip(manual('Default date is the selected day; past dates cannot be picked (APPT-121)'), () => {});
  it.skip(manual('Staff selection rules (APPT-122)'), () => {});
  it.skip(manual('Service, duration and start-time rules (APPT-123)'), () => {});
  it.skip(
    manual('A new line starts right after the previous one, also across midnight (APPT-124)'),
    () => {},
  );
  it.skip(manual('Requested / Highlight / No Show / Repeat tag rules (APPT-125)'), () => {});
  it.skip(manual('Note is limited to 255 characters (APPT-126)'), () => {});
  it.skip(manual('An appointment with warnings cannot be created (APPT-127)'), () => {});
  it.skip(manual('Create an appointment and see it synced to Portal (APPT-128)'), () => {});
  it.skip(manual('Saving an edited appointment asks whether to message the customer (APPT-129)'), () => {});
  it.skip(manual('Confirm a Scheduled appointment (APPT-130)'), () => {});
  it.skip(manual('Cancel an appointment (APPT-131)'), () => {});
  it.skip(
    manual('Confirm and Cancel ask for passcode / staff code per Booking Settings (APPT-132)'),
    () => {},
  );
  it.skip(manual('Drag a card to another time / staff, confirm and enter passcode (APPT-133)'), () => {});
  it.skip(manual('Dragging an appointment into the past is allowed (APPT-134)'), () => {});
  it.skip(manual('Canceled or Done appointments have no actions (APPT-135)'), () => {});
  it.skip(
    manual('Canceling after checkout leaves the order alone; paying still makes the booking Done (APPT-136)'),
    () => {},
  );
  it.skip(manual('Customer with an appointment checks in and agrees to link it (APPT-137)'), () => {});
  it.skip(
    manual('Dragging a walk-in from the sidebar onto the board creates an appointment (APPT-138)'),
    () => {},
  );
  it.skip(manual('Calendar Settings toggles take effect on POS (APPT-139)'), () => {});

  // Not shipped on build 1.1.56 (VP-1614).
  it.skip(manual('Visible time window = Booking Hours ± 1 hour (APPT-140)'), () => {});
  // Not shipped on build 1.1.56 (VP-4402, VP-4311).
  it.skip(
    manual('Auto-sorted staff columns, appointment colours and new-booking sound (APPT-141)'),
    () => {},
  );
  // Not shipped on build 1.1.56 (VP-2452).
  it.skip(manual('Unassigned column hidden when it has no appointments (APPT-142)'), () => {});
});

describe('volt-qc 09 TIME KEEPING — manual', () => {
  // The expected total is the Active staff count on Portal.
  it.skip(
    manual('Dialog lists Active staff only; both columns add up to the Active staff count (TIME-006)'),
    () => {},
  );
  // Needs a staff set Inactive on Portal and a sync wait.
  it.skip(manual('Staff switched to Inactive disappears, even while IN (TIME-007)'), () => {});
  // Needs a check-in before midnight and a check after the real midnight.
  it.skip(
    manual('Shift IN before midnight returns the staff to Unavailable on the new day (TIME-024)'),
    () => {},
  );
  // Needs a real network cut and a sync to Portal.
  it.skip(manual('Offline clock-in is stored locally and synced when back online (TIME-025)'), () => {});
  // Needs a second POS.
  it.skip(manual('Clock-in on POS A shows on POS B (TIME-026)'), () => {});
  // Staff Code clock-in with On-time / In-late (VP-2722) is not shipped on build 1.1.56.
  it.skip(manual('Staff Code clock-in shows On-time / In-late and a timer (TIME-031)'), () => {});
  // No Staff-role staff code fixture.
  it.skip(
    manual('Staff role (no view_time_tracking) is refused at the Time Tracking gate (TIME-034)'),
    () => {},
  );
  // No Manager-role staff code fixture.
  it.skip(manual('Manager role is refused by default (no view_time_tracking) (TIME-035)'), () => {});
  // Needs a Staff-role code plus the permission matrix.
  it.skip(manual('30-minute skip of a staff without permission does not open the page (TIME-039)'), () => {});
  // Needs an app restart and a second POS.
  it.skip(
    manual(
      'Saving the Time Tracking toggle has no 422, survives restart and syncs to another device (TIME-041)',
    ),
    () => {},
  );
  // Needs an existing record on the lock day after lockedAt; behaviour unconfirmed on dev.
  it.skip(
    manual('Record on the lock day after lockedAt: Delete clickable, Edit blocked (TIME-080)'),
    () => {},
  );
  // Payroll formula cases: need staff compensation, day-off rules and a payroll period set up in Settings / Portal.
  it.skip(manual('Hourly wage is computed from the sum of Total Hours (TIME-091)'), () => {});
  it.skip(manual('Working Days counting for daily wage (TIME-092)'), () => {});
  it.skip(
    manual('Days off within the limit, none on a banned day: larger of salary and commission (TIME-093)'),
    () => {},
  );
  it.skip(manual('Days off over the limit: base salary only (TIME-094)'), () => {});
  it.skip(manual('Check-in without check-out still counts as a working day (TIME-095)'), () => {});
  it.skip(manual('A day without schedule is not counted as a day off (TIME-096)'), () => {});
  it.skip(
    manual('Owner back-fills attendance for a day off before the lock: violation removed (TIME-097)'),
    () => {},
  );
  it.skip(manual('Salary by Period does not apply Count Days Off (TIME-098)'), () => {});
  // Needs Portal Timekeeping.
  it.skip(
    manual('Record created on POS shows on Portal at the right time in the merchant timezone (TIME-099)'),
    () => {},
  );
  // Needs a record edited on Portal.
  it.skip(manual('Record edited on Portal is updated on POS (TIME-100)'), () => {});
  // Needs a Manager code; the rule is doc-vs-prod "to confirm".
  it.skip(manual('Only Owner may edit and must give a reason (TIME-104)'), () => {});
});

describe('volt-qc 15 TURN — manual', () => {
  // Needs an overnight run across the shop's midnight.
  it.skip(manual('After shop midnight the board and Turn Order roll to the new day (TURN-013)'), () => {});
  // Needs a pending order created on a previous day (seeded across runs).
  it.skip(
    manual('Pending order from a previous day does not make the staff Busy today (TURN-026)'),
    () => {},
  );
  // Needs two POS devices.
  it.skip(
    manual('Choose-service state on device A shows Available on device B until synced (TURN-027)'),
    () => {},
  );
  // Needs a Product catalogue item on the order.
  it.skip(
    manual('Per-order mode: product-only order gives no turn; two-staff order gives +1 each (TURN-035)'),
    () => {},
  );
  // Needs product and gift-card sales.
  it.skip(
    manual('Only service lines (Quick Pay included) count; products and gift cards do not (TURN-037)'),
    () => {},
  );
  // No page-object path for an order-level promo / discount.
  it.skip(manual('Order-level promotion / discount does not reduce turns (TURN-041)'), () => {});
  // No checkout path enters a tip on an Other / Cash payment.
  it.skip(manual('Tip is not counted in turns (TURN-042)'), () => {});
  // The Split screen blocks leaving until every check is paid, so the mid-state cannot be read.
  it.skip(
    manual('Split order: check 1 paid adds nothing; all checks paid adds once by service price (TURN-044)'),
    () => {},
  );
  // Needs a pending order seeded on a previous day.
  it.skip(
    manual('Turn counts on the completion day: created yesterday, paid today counts today (TURN-045)'),
    () => {},
  );
  // Refunds need a batch-settled order and are irreversible.
  it.skip(
    manual('Full refund of a settled order removes its turns on the completion day (TURN-047)'),
    () => {},
  );
  it.skip(manual('Partial refund by item drops the refunded item from turns (TURN-048)'), () => {});
  it.skip(manual('Partial amount refund pro-rates the item turn (TURN-049)'), () => {});
  it.skip(manual('Integer mode: fully refunded item drops out (TURN-050)'), () => {});
  // No page-object path for Change Staff inside the re-open editor.
  it.skip(manual('Re-open changing staff SA to SB moves the order turns to SB (TURN-052)'), () => {});
  // No merge-order flow in the page objects.
  it.skip(manual('Merge Order counts once on the merged order (TURN-053)'), () => {});
  // Needs a second POS.
  it.skip(manual('Turn Settings changed on device A reach device B (TURN-081)'), () => {});
  it.skip(manual('Simultaneous manual adjustments on two devices add up (TURN-082)'), () => {});
  it.skip(manual('Order paid on device B updates the board on device A (TURN-083)'), () => {});
  // Needs network control and a second POS.
  it.skip(
    manual('Offline adjustments / settings saves sync to other devices when back online (TURN-084)'),
    () => {},
  );
});
