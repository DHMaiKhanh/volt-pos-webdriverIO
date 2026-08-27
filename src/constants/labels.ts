/**
 * Every UI string this suite matches on, in BOTH languages the app ships.
 *
 * ## Why this file exists
 *
 * A text selector is the last resort — but on this app it is a resort the suite
 * genuinely needs, because ~90% of the `data-testid` attributes the page objects
 * want are not in the product yet (`npm run audit:testids` prints the count).
 * The Playwright suite that solved this first reached for English text
 * (`getByRole('button', { name: 'Pay' })`) and its 306 tests pass — on an
 * English till. The app language is merchant state in the local database, so the
 * moment someone flips `/settings/language` to Tiếng Việt every one of those
 * selectors stops matching, and the failure looks like a missing button.
 *
 * The app ships exactly TWO bundles, `src/locales/en/common.json` and
 * `src/locales/vi/common.json`. So "every language the app can be in" is a
 * two-element set that can be enumerated inside the selector, and a bilingual
 * match is language-INDEPENDENT for every state the app can actually reach.
 * That is what the helpers in `src/helpers/selectors.ts` take, and this file is
 * what feeds them.
 *
 * ## The rules
 *
 * 1. **Both strings, copied verbatim from the locale files.** The `key` on each
 *    entry is the i18next path they came from, so a reviewer can check one
 *    without leaving this file and `npm run audit:testids` can flag drift.
 * 2. **Labels only, never values.** A price, an order code and a staff name are
 *    the same in both bundles and belong in a plain text match — not here.
 * 3. **A third bundle invalidates every entry.** If `src/locales/` ever grows a
 *    third directory this whole file is wrong, which is why the audit script is
 *    the gate rather than this paragraph.
 *
 * ## Entries with no key
 *
 * A few labels are hardcoded in JSX rather than translated — `Re-Open`,
 * `Refund Information`, `Cancel Information`, the settings nav items. They are
 * marked `key: null` and carry the SAME string twice. That is not laziness: it
 * records that the app has an i18n gap there, so the day it is translated this
 * file shows exactly which entries need a Vietnamese half. Those are also the
 * strings worth raising with the team — a hardcoded user-facing label is a
 * violation of the project's own i18n rule.
 */

/** One label, in both bundles, with the i18next key it was read from. */
export interface Label {
  readonly en: string;
  readonly vi: string;
  /** The i18next path, or `null` when the app hardcodes this string. */
  readonly key: string | null;
}

const label = (en: string, vi: string, key: string | null): Label => ({ en, vi, key });

/** A label the app has NOT translated — both halves are the English string. */
const untranslated = (en: string): Label => ({ en, vi: en, key: null });

/** Spread a label into the `...texts` helpers: `buttonWithAnyText(...both(L.pay))`. */
export const both = (l: Label): [string, string] => [l.en, l.vi];

/* ------------------------------------------------------------------------- *
 * Actions — buttons that appear across many screens
 * ------------------------------------------------------------------------- */

export const Actions = {
  confirm: label('Confirm', 'Xác nhận', 'actions.confirm'),
  cancel: label('Cancel', 'Huỷ', 'actions.cancel'),
  close: label('Close', 'Đóng', 'common.close'),
  done: label('Done', 'Hoàn tất', 'actions.done'),
  save: label('Save', 'Lưu', 'actions.save'),
  edit: label('Edit', 'Sửa', 'actions.edit'),
  add: label('Add', 'Thêm', 'global.add'),
  apply: label('Apply', 'Áp dụng', 'actions.apply'),
  print: label('Print', 'In', 'actions.print'),
  receipt: label('Receipt', 'Hoá đơn', 'actions.receipt'),
  reset: label('Reset', 'Đặt lại', 'turn.reset'),
  clear: label('Clear', 'Xoá', 'global.clear'),
  filter: label('Filter', 'Bộ lọc', 'global.filter'),
  remove: label('Remove', 'Xoá', 'global.remove'),
  logout: label('Logout', 'Đăng xuất', 'global.logout'),
  showMore: label('Show more', 'Xem thêm', 'global.showMore'),
  showLess: label('Show less', 'Thu gọn', 'global.showLess'),
  openSidebar: label('Open sidebar', 'Mở thanh điều hướng', 'common.openSidebar'),
} as const;

/* ------------------------------------------------------------------------- *
 * Home / order building
 * ------------------------------------------------------------------------- */

export const Home = {
  pay: label('Pay', 'Thanh toán', 'global.pay'),
  /**
   * The whole-order delete affordance.
   *
   * It is labelled "Remove" today; older builds said "Delete Order", and the
   * Playwright page object still carries both. Both are listed so the suite
   * spans the versions a QC machine might have installed — see
   * {@link Home.deleteOrderLegacy}.
   */
  removeOrder: label('Remove', 'Xoá', 'global.remove'),
  deleteOrderLegacy: label('Delete Order', 'Xoá đơn hàng', 'global.deleteOrder'),
  note: label('Note', 'Lưu ý', 'global.note'),
  mergeOrder: label('Merge Order', 'Gộp đơn', 'global.mergeOrder'),
  promoRewards: label('Promo & Rewards', 'Khuyến mãi & Phần thưởng', 'global.promoRewards'),
  quickPay: label('Quick Pay', 'Thanh toán nhanh', 'global.quickPay'),
  quickCheckout: label('Quick Checkout', 'Thanh toán nhanh', 'global.quickCheckout'),
  giftCard: label('Gift Card', 'Thẻ quà tặng', 'global.giftCard'),
  searchStaff: label('Search staff', 'Tìm nhân viên', 'global.searchStaff'),
  searchService: label('Search service', 'Tìm kiếm tên dịch vụ', 'global.searchService'),
  enterCustomerPhone: label('Enter Customer Phone', 'Nhập SĐT khách hàng', 'global.enterCustomerPhone'),
  selectStaff: label('Select staff', 'Chọn nhân viên', 'global.selectStaff'),
  availableStaff: label('Available Staff', 'Nhân viên sẵn sàng', 'global.availableStaff'),
  unavailableStaff: label('Unavailable Staff', 'Nhân viên chưa sẵn sàng', 'global.unavailableStaff'),
  serviceDetails: label('Service Details', 'Chi tiết dịch vụ', 'global.serviceDetails'),
  orderSummary: label('Order Summary', 'Tóm tắt đơn hàng', 'global.orderSummary'),
} as const;

/* ------------------------------------------------------------------------- *
 * Checkout / payment
 * ------------------------------------------------------------------------- */

export const Checkout = {
  completePayment: label('Complete Payment', 'Hoàn tất thanh toán', 'global.completePayment'),
  cancelOrder: label('Cancel Order', 'Huỷ đơn', 'global.cancelOrder'),
  backToOrder: label('Back to order', 'Quay lại đơn hàng', 'global.backToOrder'),
  enterAmount: label('Enter Amount', 'Nhập số tiền', 'global.enterAmount'),
  customAmount: label('Custom Amount', 'Số tiền tuỳ chỉnh', 'global.customAmount'),
  tip: label('Tip', 'Tiền boa', 'global.tip'),
  cashDrawer: label('Cash Drawer', 'Khay tiền', 'global.cashDrawer'),
  selectPaymentMethod: label(
    'Select payment method',
    'Chọn phương thức thanh toán',
    'global.selectPaymentMethod',
  ),
  inputGiftCardCode: label('Input Gift Card Code', 'Nhập mã thẻ quà tặng', 'global.inputGiftCardCode'),
  giftCardAccepted: label('Gift Card Accepted', 'Thẻ quà tặng hợp lệ', 'global.giftCardAccepted'),
  paymentSuccessful: label('Payment Successful!', 'Thanh toán thành công!', 'global.paymentSuccessful'),
  paymentDetails: label('Payment Details', 'Chi tiết thanh toán', 'global.paymentDetails'),
  addNewCheck: label('Add New Check', 'Thêm thanh toán đơn mới', 'global.addNewCheck'),

  // Receipt delivery, on the payment-success screen.
  email: label('Email', 'Email', 'global.email'),
  textMessage: label('Text Message', 'Tin nhắn', 'global.textMessage'),
  noReceipt: label('No Receipt', 'Không hoá đơn', 'global.noReceipt'),
} as const;

/* ------------------------------------------------------------------------- *
 * Money rows — the label half of a label/amount pair
 * ------------------------------------------------------------------------- */

export const Money = {
  subtotal: label('Subtotal', 'Tạm tính', 'global.subtotal'),
  total: label('Total', 'Tổng cộng', 'global.total'),
  totalPaid: label('Total Paid', 'Tổng đã trả', 'global.totalPaid'),
  remaining: label('Remaining', 'Còn lại', 'global.remaining'),
  change: label('Change', 'Tiền thối', 'global.change'),
  discount: label('Discount', 'Giảm giá', 'global.discount'),
  totalDiscount: label('Total Discount', 'Tổng giảm giá', 'global.totalDiscount'),
  tip: label('Tip', 'Tiền boa', 'global.tip'),
  amount: label('Amount', 'Số tiền', 'global.amount'),
  totalIncome: label('Total Income', 'Tổng thu nhập', 'global.totalIncome'),
} as const;

/* ------------------------------------------------------------------------- *
 * Order history
 * ------------------------------------------------------------------------- */

export const OrderHistory = {
  title: label('Order History', 'Lịch sử đơn hàng', 'global.orderHistory'),
  refund: label('Refund', 'Hoàn tiền', 'global.refund'),
  partialRefund: label('Partial Refund', 'Hoàn tiền một phần', 'global.partialRefund'),
  void: label('Void', 'Huỷ', 'global.void'),
  confirmCancel: label('Confirm Cancel', 'Xác nhận huỷ', 'global.confirmCancel'),
  adjustTip: label('Adjust Tip', 'Chỉnh tiền boa', 'global.adjustTip'),
  splitTip: label('Split Tip', 'Chia tiền boa', 'global.splitTip'),
  status: label('Status', 'Trạng thái', 'global.status'),
  staff: label('Staff', 'Nhân viên', 'global.staff'),

  /**
   * Hardcoded in JSX — no i18next key.
   *
   * The Playwright page object matched `/Re-?Open|Mở lại/i`, i.e. it already
   * knew a Vietnamese string existed in someone's build, but there is no key
   * behind it in `common.json` today. Both spellings are kept because the
   * hyphen has moved between builds.
   */
  reopen: untranslated('Re-Open'),
  reopenAlt: untranslated('Reopen'),
  refundInformation: untranslated('Refund Information'),
  cancelInformation: untranslated('Cancel Information'),
} as const;

/* ------------------------------------------------------------------------- *
 * Split order
 * ------------------------------------------------------------------------- */

export const SplitOrder = {
  title: label('Split Order', 'Tách đơn', 'global.splitOrder'),
  byAmount: label('By Amount', 'Theo số tiền', 'global.splitByAmount'),
  byItems: label('By Items', 'Theo món', 'global.splitByItems'),
  equally: label('Equally', 'Chia đều', 'global.splitEqually'),
} as const;

/* ------------------------------------------------------------------------- *
 * Turn board
 * ------------------------------------------------------------------------- */

export const Turn = {
  title: label('Turn', 'Phiên làm việc', 'global.turn'),
  order: label('Turn Order', 'Thứ tự lượt', 'turn.quickViewTitle'),
  view: label('View Turn', 'Xem Turn', 'turn.viewTurn'),
  adjust: label('Adjust Turn', 'Chỉnh lượt', 'turn.adjustButton'),
  setting: label('Setting', 'Cài đặt', 'global.setting'),
  today: label('Today', 'Hôm nay', 'global.today'),
} as const;

/* ------------------------------------------------------------------------- *
 * Time tracking / payroll
 * ------------------------------------------------------------------------- */

export const Payroll = {
  timeTracking: label('Time Tracking', 'Quản lý chấm công', 'global.timeTracking'),
  staffPayroll: label('Staff Payroll', 'Bảng lương nhân viên', 'global.staffPayroll'),
  checkIn: label('Check In', 'Ghi nhận giờ vào', 'global.checkIn'),
  checkOut: label('Check Out', 'Ghi nhận giờ ra', 'global.checkOut'),
  workingDays: label('Working Days', 'Số ngày làm', 'global.workingDays'),
  compensation: label('Compensation', 'Thù lao', 'global.tabs.compensation'),
  salaryAmount: label('Salary Amount', 'Mức lương', 'global.salaryAmount'),
  deductionPerDay: label('Deduction Per Day', 'Khấu trừ mỗi ngày', 'global.deductionPerDay'),
} as const;

/* ------------------------------------------------------------------------- *
 * Navigation & settings
 * ------------------------------------------------------------------------- */

export const Nav = {
  home: label('Home', 'Trang chủ', 'global.home'),
  appointment: label('Appointment', 'Lịch hẹn', 'global.appointment'),
  orderHistory: label('Order History', 'Lịch sử đơn hàng', 'global.orderHistory'),
  pendingOrders: label('Pending Orders', 'Đơn đang chờ', 'global.pendingOrders'),
  income: label('Income', 'Thu nhập', 'global.income'),
  batchHistory: label('Batch History', 'Lịch sử Batch', 'global.batchHistory'),
  cashDrawer: label('Cash Drawer', 'Khay tiền', 'global.cashDrawer'),
} as const;

export const Settings = {
  language: label('Language', 'Ngôn ngữ', 'global.language'),
  accessibility: label('Accessibility', 'Hiển thị', 'global.accessibility'),
  roles: label('Roles', 'Vai trò', 'global.roles'),
  permissions: label('Permissions', 'Quyền', 'global.permissions'),
  enablePasscodeVerification: label(
    'Enable Passcode Verification',
    'Bật xác thực Passcode',
    'global.enablePasscodeVerification',
  ),

  /**
   * Language names are NOT translated, by design — a language picker shows each
   * language in its own script, so "English" and "Tiếng Việt" read the same
   * whichever bundle is loaded. These are values, not labels; they are here
   * only because the language screen has no testids at all.
   */
  english: untranslated('English'),
  vietnamese: untranslated('Tiếng Việt'),
} as const;

/* ------------------------------------------------------------------------- *
 * Appointments
 * ------------------------------------------------------------------------- */

export const Appointment = {
  create: label('Create Appointment', 'Tạo lịch hẹn', 'global.appointmentCreateTitle'),
  save: label('Save Appointment', 'Lưu lịch hẹn', 'global.appointmentSaveAppointment'),
  selectService: label('Select service', 'Chọn dịch vụ', 'global.appointmentSelectService'),
  addMore: label('Add more', 'Thêm', 'global.appointmentAddMore'),
  addNote: label('Add note', 'Thêm ghi chú', 'global.addNote'),
} as const;

/* ------------------------------------------------------------------------- *
 * Whole-screen failure states
 * ------------------------------------------------------------------------- */

export const Failure = {
  somethingWentWrong: label('Something went wrong', 'Đã có lỗi xảy ra', 'common.error'),
  updateRequired: label('Update Required', 'Yêu cầu cập nhật', 'global.updateRequired'),
} as const;

/* ------------------------------------------------------------------------- *
 * Language-independent patterns
 * ------------------------------------------------------------------------- *
 *
 * Not labels — shapes. Digits, currency and codes render identically in both
 * bundles, so these need no bilingual treatment and must NOT be added above.
 */

export const Patterns = {
  /** A rendered money amount: `$1,234.56`, `-$12.00`. */
  MONEY: /-?\$[\d,]+\.\d{2}/,
  /** An order code as the app prints it: `#OD123456`. */
  ORDER_CODE: /#OD\d{6}/,
  /** A masked phone as shown on the customer row: `(***) ***-1234`. */
  MASKED_PHONE: /\(\*{3}\)\s*\*{3}-\d{4}/,
  /** A percentage cell: `12.5%`. */
  PERCENT: /^\d[\d,]*\.?\d*%$/,
  /** A short date cell: `8/26/26`. */
  SHORT_DATE: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
} as const;
