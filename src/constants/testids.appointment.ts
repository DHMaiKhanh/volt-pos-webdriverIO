/**
 * Appointment (`/appointment`) — selectors for the VP-1615 port
 * (docs/screens/appointment/appointment-test-cases.md) on top of {@link AppointmentIds}.
 *
 * ## Evidence
 *
 * Live DOM dump of installed build 1.1.56, merchant 14, DEV
 * (`reports/scans/2026-10-25-feature-inventory/dom/appointment.json`). In its
 * initial state the screen has ONE heading and SEVEN controls:
 *
 *   h "Appointment Overview"
 *   button "Now"
 *   button[aria-label="Previous day"]          — aria-label hardcoded EN (i18n scan)
 *   button "10/25/2026"                        — date-picker trigger (no id)
 *   button[aria-label="Next day"]
 *   button "Staffs 306"                        — staff filter + badge
 *   button "Statuses 3"                        — status filter + badge
 *   button "Reset to Default"
 *
 * plus the scheduler body: 15-minute time rows `12:00 AM … 11:45 PM` and staff
 * column headers starting with `Unassigned` + a per-column count. The URL carries
 * `date` (unix SECONDS of local midnight), `statuses` and `staffIds` (JSON arrays).
 *
 * There is NO "Create Appointment" / "New Appointment" / "+" control in the
 * dump: the create/edit form (VP-1615, Linear P-VP-476 "Book appointment from
 * POS" — PAUSED) is not reachable on 1.1.56. The form entries below come from
 * the 2026-07/08 dev-server scans recorded in the test-case doc and code-detail
 * doc; they are what a build WITH the form is expected to render, and the specs
 * only drive them behind a runtime probe ({@link AppointmentScreenIds.createEntry}).
 *
 * Every entry declares the id the app SHOULD expose (`appointment-<thing>`) first.
 */

import { Actions, Appointment, both } from './labels.js';
import { AppointmentIds } from './testids.orders.js';
import { buttonWithAnyText, locator, textIsAnyOf, type Locator } from '../helpers/selectors.js';

/* ------------------------------------------------------------------------- *
 * Values (not labels) and label sets used by the page object
 * ------------------------------------------------------------------------- */

/** The overview heading — `global.appointmentOverview` (VI from the 2026-08-20 i18n scan). */
export const APPOINTMENT_OVERVIEW_TITLE = ['Appointment Overview', 'Tổng quan lịch hẹn'] as const;

/** `Staffs 306` / `Nhân viên 306`. */
export const APPOINTMENT_STAFFS_LABEL = /^(Staffs|Nhân viên)\s*\d+$/;
/** `Statuses 3` / `Trạng thái 3`. */
export const APPOINTMENT_STATUSES_LABEL = /^(Statuses|Trạng thái)\s*\d+$/;

/** The statuses the overview selects on arrival (from the dump's URL). */
export const DEFAULT_APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'done'] as const;

/**
 * Status labels as the appointment detail prints them.
 *
 * Confirmed / Canceled VI come from the 2026-08-20 i18n scan. Scheduled / Done
 * VI were NOT captured by any scan — the English half is the verified one.
 */
export const APPOINTMENT_STATUS_LABELS = {
  scheduled: ['Scheduled', 'Đã lên lịch'],
  confirmed: ['Confirmed', 'Đã xác nhận'],
  canceled: ['Canceled', 'Cancelled', 'Đã huỷ', 'Đã hủy'],
  done: ['Done', 'Hoàn thành'],
} as const;
export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS_LABELS;

/** The column that holds appointments with no staff — `global.unassigned`. */
export const UNASSIGNED_COLUMN = ['Unassigned', 'Chưa phân công'] as const;

/** A scheduler time row label, e.g. `12:00 AM`. 12h clock in both bundles. */
export const SLOT_TIME_LABEL = /^\d{2}:\d{2} (AM|PM)$/;

/** The first time row of the day — the slot TC-OPEN-03 clicks as "already past". */
export const FIRST_SLOT_LABEL = '12:00 AM';

/** Phone validation — `global.phoneNumberInvalid`-style text, matched by substring. */
export const PHONE_DIGITS_ERROR = ['10 or 11 digits', '10 hoặc 11 số'] as const;

/** The app caps the appointment note at 255 characters (`global.appointmentNoteTooLong`). */
export const APPOINTMENT_NOTE_MAX = 255;

/** Customer-name prefix for any appointment a spec books — cancelled in an after hook. */
export const QA_APPOINTMENT_PREFIX = 'QA-SCAN-20261025';

/* ------------------------------------------------------------------------- *
 * Locators
 * ------------------------------------------------------------------------- */

/** XPath: an open overlay — Radix dialog, popover or sheet. */
const OVERLAY =
  '//*[@role="dialog" or @role="alertdialog" or @data-slot="popover-content" or @data-slot="sheet-content"]';

/**
 * One row of the open Statuses filter popover, by its label (any of `labels`).
 * Popover markup UNVERIFIED (not in the dump) — matched by row text inside the overlay.
 */
export const statusFilterItem = (status: AppointmentStatus): Locator =>
  locator(
    `status filter item ${status}`,
    `appointment-status-filter-${status}`,
    `${OVERLAY}//*[not(*)][${APPOINTMENT_STATUS_LABELS[status].map((t) => `normalize-space()="${t}"`).join(' or ')}]`,
  );

export const AppointmentScreenIds = {
  ...AppointmentIds,

  /** Route-specific readiness anchor (the header "Appointment" link exists on every screen). */
  overviewHeading: locator(
    'appointment overview heading',
    'appointment-overview-heading',
    textIsAnyOf(...APPOINTMENT_OVERVIEW_TITLE),
  ),

  nowButton: locator('appointment now button', 'appointment-now-btn', buttonWithAnyText('Now', 'Bây giờ')),

  /** aria-label is hardcoded English on 1.1.56 (i18n scan: date-selector.tsx:175). */
  previousDay: locator(
    'appointment previous day',
    'appointment-prev-day',
    'button[aria-label="Previous day"]',
  ),
  /** aria-label is hardcoded English on 1.1.56 (date-selector.tsx:283). */
  nextDay: locator('appointment next day', 'appointment-next-day', 'button[aria-label="Next day"]'),

  /**
   * The date-picker trigger between Previous/Next.
   *
   * It has no id or label; first fallback is the structural relation to the
   * Previous-day button, second is the value SHAPE `NN/NN/NNNN` (a date, the
   * same in both bundles apart from field order).
   */
  dateTrigger: locator(
    'appointment date trigger',
    'appointment-date-trigger',
    '//button[@aria-label="Previous day"]/following::button[1][not(@aria-label)]',
    '//button[string-length(normalize-space())=10 and substring(normalize-space(),3,1)="/" and substring(normalize-space(),6,1)="/"]',
  ),

  staffsFilter: locator(
    'appointment staffs filter',
    'appointment-staffs-filter',
    '//button[starts-with(normalize-space(),"Staffs") or starts-with(normalize-space(),"Nhân viên")]',
  ),

  statusesFilter: locator(
    'appointment statuses filter',
    'appointment-statuses-filter',
    '//button[starts-with(normalize-space(),"Statuses") or starts-with(normalize-space(),"Trạng thái")]',
  ),

  /** Only the English label is verified (dump); no scan captured the VI string. */
  resetToDefault: locator(
    'appointment reset to default',
    'appointment-reset-default',
    buttonWithAnyText('Reset to Default'),
  ),

  /** The leaf text node heading the Unassigned column. */
  unassignedHeader: locator(
    'unassigned column header',
    'appointment-column-unassigned',
    `//*[not(*)][${UNASSIGNED_COLUMN.map((t) => `normalize-space()="${t}"`).join(' or ')}]`,
  ),

  /** The first scheduler time row (`12:00 AM`) — leaf text. */
  firstSlotLabel: locator(
    'first time row label',
    'appointment-slot-0000',
    `//*[not(*)][normalize-space()="${FIRST_SLOT_LABEL}"]`,
  ),

  /** Any open overlay. Used to prove a click opened NOTHING (TC-OPEN-03). */
  anyOverlay: locator('any open overlay', 'appointment-any-overlay', OVERLAY),

  /** Items inside an open filter popover (checkbox rows). */
  popoverItems: locator(
    'filter popover items',
    'appointment-filter-item-',
    `${OVERLAY}//*[@role="checkbox" or @role="menuitemcheckbox" or @role="option"]`,
    `${OVERLAY}//label`,
  ),

  /**
   * Appointment cards on the scheduler.
   *
   * UNVERIFIED on 1.1.56 — the dump's day had zero appointments in every column,
   * so no card markup was captured. Class fragments inherited from
   * {@link AppointmentIds.appointmentCards}; replace once a card is scanned.
   */
  cards: locator(
    'appointment cards',
    'appointment-card-',
    '[class*="appointment-card"]',
    '[class*="event-card"]',
    '[class*="appointment-item"]',
  ),

  /* --- appointment detail (opened from a card) — UNVERIFIED, labels from VP-1615 §6 --- */

  detailPanel: locator('appointment detail', 'appointment-detail', OVERLAY),

  detailUpdate: locator(
    'appointment detail update',
    'appointment-detail-update',
    `${OVERLAY}//button[normalize-space()="Update" or normalize-space()="Cập nhật" or normalize-space()="Edit" or normalize-space()="Sửa"]`,
  ),
  detailConfirm: locator(
    'appointment detail confirm',
    'appointment-detail-confirm',
    `${OVERLAY}//button[normalize-space()="${Actions.confirm.en}" or normalize-space()="${Actions.confirm.vi}"]`,
  ),
  detailCancel: locator(
    'appointment detail cancel',
    'appointment-detail-cancel',
    `${OVERLAY}//button[normalize-space()="${Actions.cancel.en}" or normalize-space()="${Actions.cancel.vi}" or normalize-space()="Hủy"]`,
  ),

  /* --- create/edit form — NOT on 1.1.56; from the 2026-07 dev-server scan --- */

  /**
   * The form's entry point. `create-appointment-button` is the shipped testid on
   * dev builds; the doc's analysis calls it "New Appointment", the dev scan saw
   * "Create Appointment".
   */
  createEntry: locator(
    'create appointment entry',
    'create-appointment-button',
    buttonWithAnyText(...both(Appointment.create)),
    buttonWithAnyText('New Appointment'),
  ),

  dialogClose: locator(
    'appointment dialog close',
    'appointment-dialog-close',
    `//*[@role="dialog"]//button[@aria-label="${Actions.close.en}" or @aria-label="${Actions.close.vi}"` +
      ` or normalize-space()="${Actions.close.en}" or normalize-space()="${Actions.close.vi}"]`,
  ),

  /** The phone input's clear icon — "Clear input" per the dev scan (TC-CUST-09). */
  phoneClear: locator(
    'appointment phone clear',
    'appointment-phone-clear',
    '//*[@role="dialog"]//button[@aria-label="Clear input" or @aria-label="Xoá" or @aria-label="Xóa"]',
  ),

  phoneDigitsError: locator(
    'appointment phone digits error',
    'appointment-phone-error',
    `//*[@role="dialog"]//*[not(*)][${PHONE_DIGITS_ERROR.map((t) => `contains(normalize-space(),"${t}")`).join(' or ')}]`,
  ),

  noteTooLongError: locator(
    'appointment note too long',
    'appointment-note-error',
    `//*[@role="dialog"]//*[not(*)][contains(normalize-space(),"255")]`,
  ),

  /** The Repeat tag — rendered only while the Repeat setting is ON (VP-1615 §4). */
  repeatTag: locator(
    'appointment repeat tag',
    'appointment-tag-repeat',
    `//*[@role="dialog"]//*[not(*)][normalize-space()="Repeat" or normalize-space()="Lặp lại"]`,
  ),
} satisfies Record<string, Locator>;
