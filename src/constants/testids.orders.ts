/**
 * Pending Orders, Split Order and Appointment — the order-flow screens the
 * suite did not cover yet.
 *
 * Fallbacks are transcribed from the Playwright suite (proven against a live
 * till) and re-checked against the app's JSX, which corrected three of them:
 *
 * - The pending card is a bare `<button>` with no `aria-label`; its order code
 *   is a `<span>` inside. The Playwright locator
 *   `getByRole('button', { name: ORDER_CODE_RE })` works because Playwright
 *   computes the accessible name from the button's text content — WebdriverIO
 *   has no equivalent, so the XPath here matches the button that CONTAINS a
 *   span holding the code.
 * - The search box is `placeholder={t("global.searchOrderPlaceholder")}`, which
 *   the Playwright suite hardcoded as English.
 * - The date-range control shares `#selected-date-range` with the income
 *   reports — the filter bar styles it by that id, so it is a real DOM id and
 *   the strongest handle on the toolbar.
 */

import { Actions, Home, Nav, OrderHistory, SplitOrder, both } from './labels.js';
import {
  buttonWithAnyText,
  byRole,
  inputWithAnyPlaceholder,
  locator,
  textIsAnyOf,
  type Locator,
} from '../helpers/selectors.js';

/**
 * A pending order's code as the card prints it.
 *
 * No leading `#`, unlike the active-order panel on `/home` — a spec that
 * carries the code across the two screens has to know which form it holds.
 */
export const PENDING_ORDER_CODE = /OD\d{6}-\d{8}/;

/* ------------------------------------------------------------------------- *
 * Pending Orders — /order-pending
 * ------------------------------------------------------------------------- */

export const OrderPendingIds = {
  heading: locator(
    'pending orders heading',
    'order-pending-heading',
    textIsAnyOf(...both(Nav.pendingOrders)),
  ),

  searchInput: locator(
    'pending search input',
    'order-pending-search',
    inputWithAnyPlaceholder(
      'Search order ID, customer name or phone',
      'Tìm mã đơn hàng, tên khách hàng hoặc SĐT',
    ),
  ),

  /**
   * Every pending order card.
   *
   * The card is a `<button>` whose first row holds the order code in a span.
   * Matching on that span and walking up is what makes this a card locator
   * rather than a text locator — clicking the span works, but reading "is this
   * order listed" needs the button.
   */
  orderCards: locator(
    'pending order cards',
    'order-pending-card-',
    `//button[.//span[contains(normalize-space(),"OD")]]`,
  ),

  staffFilter: locator(
    'staff filter',
    'order-pending-staff-filter',
    buttonWithAnyText(...both(OrderHistory.staff)),
    `//button[starts-with(normalize-space(),"Staff") or starts-with(normalize-space(),"Nhân viên")]`,
  ),

  /**
   * The sort control.
   *
   * A Radix `Select`, so it is a `combobox` whose text is the CURRENT value —
   * `Latest` / `Oldest` in English, `Mới nhất` / `Cũ nhất` in Vietnamese. There
   * is more than one combobox in the toolbar, which is why the value text is
   * part of the match rather than an index.
   */
  sortSelect: locator(
    'sort select',
    'order-pending-sort',
    `//*[@role="combobox"][contains(.,"Latest") or contains(.,"Oldest")` +
      ` or contains(.,"Mới nhất") or contains(.,"Cũ nhất")]`,
  ),

  /** Shares the DOM id with the income reports' range control — see the file note. */
  dateRange: locator('date range', 'order-pending-date-range', '#selected-date-range'),

  quickCheckout: locator(
    'quick checkout button',
    'order-pending-quick-checkout',
    buttonWithAnyText(...both(Home.quickCheckout)),
  ),

  emptyState: locator(
    'no pending orders',
    'order-pending-empty',
    textIsAnyOf('No pending orders', 'Không có đơn hàng đang chờ'),
  ),

  /** Any Radix `option` in an open select. Used to read a dropdown's choices. */
  selectOptions: locator('select options', 'select-option-', byRole('option')),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Split Order — /order/{id}/split-order
 * ------------------------------------------------------------------------- */

/**
 * The three split modes.
 *
 * Radix `TabsTrigger` reflects `role="tab"` and `data-state`, never its
 * `value`, and the generated `id` embeds a per-mount random `baseId` — so the
 * tabs can only be reached by their label or positionally. Bilingual labels are
 * the better of the two.
 */
export const SplitOrderIds = {
  heading: locator('split order heading', 'split-order-heading', textIsAnyOf(...both(SplitOrder.title))),

  tabEqually: locator(
    'split equally tab',
    'split-order-tab-equally',
    buttonWithAnyText(...both(SplitOrder.equally)),
  ),
  tabByAmount: locator(
    'split by amount tab',
    'split-order-tab-by-amount',
    buttonWithAnyText(...both(SplitOrder.byAmount)),
  ),
  tabByItems: locator(
    'split by items tab',
    'split-order-tab-by-items',
    buttonWithAnyText(...both(SplitOrder.byItems)),
  ),

  addCheck: locator(
    'add new check button',
    'split-order-add-check',
    buttonWithAnyText('Add New Check', 'Thêm thanh toán đơn mới'),
  ),

  /**
   * The guest-count stepper.
   *
   * Its two buttons carry hardcoded English `aria-label`s (`decrease` /
   * `increase`) rather than translated text — an accessibility gap in the app,
   * and the reason these two are NOT bilingual. Worth raising: an aria-label is
   * user-facing text and should go through `t()`.
   */
  decreaseGuests: locator('decrease guests', 'split-order-decrease', '[aria-label="decrease"]'),
  increaseGuests: locator('increase guests', 'split-order-increase', '[aria-label="increase"]'),

  /** The count between the two stepper buttons. */
  guestCount: locator('guest count', 'split-order-guest-count', 'button[aria-label="decrease"] + span'),

  receiptDetails: locator(
    'receipt details heading',
    'split-order-receipt-details',
    textIsAnyOf('Receipt Details', 'Chi tiết hoá đơn'),
  ),

  showMore: locator('show more', 'split-order-show-more', buttonWithAnyText(...both(Actions.showMore))),
  showLess: locator('show less', 'split-order-show-less', buttonWithAnyText(...both(Actions.showLess))),

  splitByItemsHint: locator(
    'how to split by items',
    'split-order-items-hint',
    buttonWithAnyText('How to Split Payment by Item?', 'Cách tách thanh toán theo dịch vụ?'),
  ),

  backToOrder: locator(
    'back to order',
    'split-order-back',
    // The header back control is icon-only with an aria-label, not visible text,
    // so the text match never resolves on the shipped build — the aria-label is
    // the working fallback (verified live 2026-09-03). Kept the text match too in
    // case a later build labels it visibly.
    '[aria-label="Back to order"]',
    buttonWithAnyText('Back to order', 'Quay lại đơn hàng'),
  ),

  /**
   * The scoped Pay button.
   *
   * Its label carries the amount (`Pay $12.10`), so it cannot be matched
   * exactly — and the amount is the same in both languages while the verb is
   * not. `starts-with` on either verb is the honest match.
   */
  payCheck: locator(
    'pay this check',
    'split-order-pay',
    `//button[starts-with(normalize-space(),"Pay $") or starts-with(normalize-space(),"Thanh toán $")]`,
  ),

  confirm: locator('split confirm', 'split-order-confirm', buttonWithAnyText(...both(Actions.confirm))),
} satisfies Record<string, Locator>;

/**
 * One check card, by its 1-based number.
 *
 * ## Why this is a factory and not a regex
 *
 * The Playwright suite matched `^Check ${index}$`. The label is
 * `t("global.checkNumber", { number })`, which is `Check 1` in English and
 * **`Thanh toán đơn 1`** in Vietnamese — so that regex finds nothing at all on
 * a Vietnamese till, and the failure reads as "the split screen has no checks".
 *
 * The card itself is the grandparent of the label (`../..` in the original), so
 * the XPath walks up two levels. That is a structural assumption worth naming:
 * if the card markup gains a wrapper this locator silently returns the wrong
 * element rather than failing, which is why {@link splitCheckAmount} scopes to
 * the money text rather than trusting the card's own text.
 */
export const splitCheckCard = (index: number): Locator =>
  locator(
    `check ${String(index)} card`,
    `split-order-check-${String(index)}`,
    `//*[normalize-space()="Check ${String(index)}" or normalize-space()="Thanh toán đơn ${String(index)}"]/../..`,
  );

/** The amount printed on a check card. */
export const splitCheckAmount = (index: number): Locator =>
  locator(
    `check ${String(index)} amount`,
    `split-order-check-${String(index)}-amount`,
    `//*[normalize-space()="Check ${String(index)}" or normalize-space()="Thanh toán đơn ${String(index)}"]` +
      `/../..//*[starts-with(normalize-space(),"$")][not(.//*)]`,
  );

/* ------------------------------------------------------------------------- *
 * Appointment — /appointment
 * ------------------------------------------------------------------------- */

export const AppointmentIds = {
  heading: locator('appointment heading', 'appointment-heading', textIsAnyOf(...both(Nav.appointment))),

  /** CONFIRMED — one of the ~20 ids the app actually ships. No fallback wanted. */
  createButton: locator('create appointment button', 'create-appointment-button'),

  saveButton: locator(
    'save appointment button',
    'appointment-save-btn',
    buttonWithAnyText('Save Appointment', 'Lưu lịch hẹn'),
  ),

  /**
   * The create/edit dialog.
   *
   * Matched by EITHER title so one locator covers both flows — the app reuses
   * the same component and only the heading differs
   * (`appointmentCreateTitle` / `appointmentEditTitle`).
   */
  dialog: locator(
    'appointment dialog',
    'appointment-dialog',
    `//*[@role="dialog"][.//*[normalize-space()="Create Appointment" or normalize-space()="Tạo lịch hẹn"` +
      ` or normalize-space()="Edit Appointment" or normalize-space()="Chỉnh sửa lịch hẹn"]]`,
  ),

  /** `global.appointmentSearchCustomerPhone` — the required field. */
  phoneSearch: locator(
    'appointment phone search',
    'appointment-phone-search',
    inputWithAnyPlaceholder('Search for Customer Phone', 'Tìm số điện thoại khách hàng'),
  ),

  /** `global.appointmentSearchCustomerName` — optional, per the app's own label. */
  customerSearch: locator(
    'appointment customer search',
    'appointment-customer-search',
    inputWithAnyPlaceholder('Search for Customer Name', 'Tìm tên khách hàng'),
  ),

  /** `global.appointmentNotePlaceholder`. The app caps the note at 255 characters. */
  noteInput: locator(
    'appointment note',
    'appointment-note',
    inputWithAnyPlaceholder('Add an appointment note', 'Thêm ghi chú lịch hẹn'),
  ),

  selectStaff: locator(
    'select staff',
    'appointment-select-staff',
    buttonWithAnyText('Select staff', 'Chọn nhân viên'),
  ),

  selectService: locator(
    'select service',
    'appointment-select-service',
    buttonWithAnyText('Select service', 'Chọn dịch vụ'),
  ),

  addMore: locator('add more', 'appointment-add-more', buttonWithAnyText('Add more', 'Thêm')),

  /** The validation shown when the phone field is left empty. */
  customerRequiredError: locator(
    'customer required error',
    'appointment-customer-required',
    textIsAnyOf('Please choose customer phone!', 'Chọn số điện thoại khách hàng'),
  ),

  emptyState: locator(
    'no appointments',
    'appointment-empty',
    textIsAnyOf('No appointments to show', 'Không có lịch hẹn để hiển thị'),
  ),

  /**
   * Appointment cards on the calendar.
   *
   * A class *fragment* match, which is weaker than everything else in this file
   * — it is here because the calendar renders its events through a third-party
   * component whose markup the app does not control. Replace it the day the app
   * puts a testid on the card.
   */
  appointmentCards: locator(
    'appointment cards',
    'appointment-card-',
    '[class*="appointment-card"]',
    '[class*="event-card"]',
  ),
} satisfies Record<string, Locator>;

/** Registered with the audit script by `src/constants/testids.ts`. */
export const ORDER_FLOW_LOCATOR_GROUPS: Record<string, Record<string, Locator>> = {
  OrderPendingIds,
  SplitOrderIds,
  AppointmentIds,
};
