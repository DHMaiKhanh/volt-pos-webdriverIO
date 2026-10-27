/**
 * Locators for the VP-ticket specs ported from `volt-qc` (Volt-pos-Hung).
 *
 * Covers the controls those test-case sheets exercise that the main catalogue
 * did not address yet:
 *
 * - VP-1434 — the Apply-Discount block and the "Reset amount" (×) control of the
 *   Quick Pay dialog.
 * - VP-1433 — the Order History empty state and the detail placeholder.
 * - VP-1873 — the sidebar "Reload" action.
 * - VP-2400 — the Passcode Setting block on `/settings/accessibility`.
 * - VP-2465 — the name / ellipsis / price parts of a service card.
 *
 * Fallbacks come from two sources and were re-checked against the running till
 * (build 1.1.40, 2026-10-17, attach lane over CDP):
 *
 * 1. the volt-qc Playwright suite (`volt-pos-nail-window/e2e`), whose role- and
 *    name-based locators were proven live — `getByRole('switch')`,
 *    `getByRole('radio', { name: '%' })`, `getByRole('button', { name: 'Reset amount' })`;
 * 2. a DOM dump of the live screens, which supplied the literal DOM ids the
 *    Accessibility page ships (`#passcode-gate-<permission>`) and the service
 *    card markup (`span.overflow-hidden` + a sibling `...` span + the price div).
 *
 * WebdriverIO has no accessible-name engine, so a Playwright `getByRole(name)` is
 * transcribed as an XPath on the role plus the visible text / aria-label.
 */

import {
  buttonWithAnyText,
  inputWithAnyPlaceholder,
  locator,
  textIsAnyOf,
  type Locator,
} from '../helpers/selectors.js';

/**
 * The Quick Pay dialog's content node — the one dialog that carries a
 * "Service Name" field. Scoping on it keeps the switch / radio / reset lookups
 * off the line editor (`order-item-dialog.tsx`), which renders the same
 * Apply-Discount block but has no Service Name input.
 */
const QUICK_PAY_DIALOG =
  '//*[@data-slot="dialog-content"][.//input[@placeholder="Service Name" or @placeholder="Tên dịch vụ"]]';

export const QuickPayIds = {
  dialog: locator('quick pay dialog', 'home-quickpay-dialog', QUICK_PAY_DIALOG),
  /** The Apply-Discount Radix `Switch` — the first switch in the dialog. */
  discountSwitch: locator(
    'quick pay apply-discount switch',
    'home-quickpay-discount-switch',
    `(${QUICK_PAY_DIALOG}//*[@role="switch"])[1]`,
  ),
  /** `ToggleGroup type="single"` items — Radix renders them as role=radio. */
  discountModePercent: locator(
    'quick pay discount % mode',
    'home-quickpay-discount-mode-percent',
    `${QUICK_PAY_DIALOG}//*[@role="radio"][normalize-space(.)="%" or @aria-label="%"]`,
    `${QUICK_PAY_DIALOG}//button[normalize-space(.)="%"]`,
  ),
  discountModeFixed: locator(
    'quick pay discount $ mode',
    'home-quickpay-discount-mode-fixed',
    `${QUICK_PAY_DIALOG}//*[@role="radio"][normalize-space(.)="$" or @aria-label="$"]`,
    `${QUICK_PAY_DIALOG}//button[normalize-space(.)="$"]`,
  ),
  /**
   * The discount VALUE field the switch reveals. It is the last plain input of
   * the dialog: the amount carries the "0.00" placeholder, the name its own, and
   * the note is a textarea.
   */
  discountInput: locator(
    'quick pay discount input',
    'home-quickpay-discount-input',
    `(${QUICK_PAY_DIALOG}//input[not(@placeholder="0.00") and not(@placeholder="Service Name") and not(@placeholder="Tên dịch vụ") and not(@type="hidden")])[last()]`,
  ),
  /** The (×) beside the amount. The app only renders it while the amount is non-zero. */
  resetAmountBtn: locator(
    'quick pay reset-amount button',
    'home-quickpay-reset-amount-btn',
    `${QUICK_PAY_DIALOG}//button[@aria-label="Reset amount"]`,
  ),
  /** Inline validation under the discount field (VP-1434 TC-04). */
  discountError: locator(
    'quick pay discount error',
    'home-quickpay-discount-error',
    `${QUICK_PAY_DIALOG}//*[normalize-space(.)="Discount amount must be greater than 0" or normalize-space(.)="Số tiền giảm giá phải lớn hơn 0"]`,
  ),
} satisfies Record<string, Locator>;

/**
 * The order panel's customer slot ("Enter Customer Phone, Name or Email"). On
 * build 1.1.40 the phone keypad is NOT mounted until this slot is tapped — it
 * then replaces the service panel with the keypad + Back / Done.
 */
export const CustomerEntryIds = {
  trigger: locator(
    'customer entry trigger',
    'home-customer-entry-trigger',
    `//*[contains(@class,"is-changing-staff")][.//*[normalize-space(.)="Enter Customer Phone, Name or Email" or normalize-space(.)="Nhập SĐT, tên hoặc email khách hàng"]]`,
    textIsAnyOf('Enter Customer Phone, Name or Email', 'Nhập SĐT, tên hoặc email khách hàng'),
  ),
} satisfies Record<string, Locator>;

export const OrderHistoryVpIds = {
  /** Empty search result — VP-1433 TC-09. */
  emptyTitle: locator(
    'order history empty title',
    'oh-empty-title',
    textIsAnyOf('No Orders Found', 'Không tìm thấy đơn hàng'),
  ),
  emptySubtitle: locator(
    'order history empty subtitle',
    'oh-empty-subtitle',
    textIsAnyOf('Your search did not return any results.', 'Tìm kiếm của bạn không có kết quả nào.'),
  ),
  /** The right pane while no order is selected. */
  detailPlaceholder: locator(
    'order history detail placeholder',
    'oh-detail-placeholder',
    textIsAnyOf('Select an order to view details.', 'Chọn một đơn hàng để xem chi tiết.'),
  ),
} satisfies Record<string, Locator>;

export const SidebarVpIds = {
  /**
   * The drawer's "Reload" action (VP-1873). A plain `<button>` beside "Version
   * Update" — not a link, so `appSidebarItem(path)` cannot address it.
   */
  reloadBtn: locator(
    'sidebar reload button',
    'app-sidebar-reload',
    `//*[@data-slot="sidebar" or @data-sidebar="sidebar"]//button[normalize-space(.)="Reload" or normalize-space(.)="Tải lại"]`,
  ),
  /** The "Reloading ..." loader the app paints while it re-initialises. */
  reloadingText: locator(
    'reloading message',
    'app-reloading',
    `//*[starts-with(normalize-space(.),"Reloading") or starts-with(normalize-space(.),"Đang tải lại")][not(*)]`,
  ),
} satisfies Record<string, Locator>;

/**
 * `/settings/accessibility` → "Passcode Setting".
 *
 * VP-2400 shipped as a per-action gate list rather than the single "Enable
 * Passcode Verification" toggle the ticket describes: an "Active All" master
 * switch (`#passcode-gate-all`) plus one switch per guarded permission
 * (`#passcode-gate-<permission>`), committed by the section's own Save button.
 */
export const AccessibilityIds = {
  passcodeSectionTitle: locator(
    'passcode setting title',
    'accessibility-passcode-title',
    textIsAnyOf('Passcode Setting', 'Cài đặt mật mã'),
  ),
  passcodeGateAll: locator('passcode gate: active all', 'passcode-gate-all', '#passcode-gate-all'),
  /**
   * The Save of the Passcode Setting section. The page renders one Save per
   * section; the passcode one is the first Save that FOLLOWS the section title.
   */
  passcodeSaveBtn: locator(
    'passcode setting save',
    'accessibility-passcode-save',
    `(//*[normalize-space(.)="Passcode Setting" or normalize-space(.)="Cài đặt mật mã"][not(*)]/following::button[normalize-space(.)="Save" or normalize-space(.)="Lưu"])[1]`,
  ),
  anySave: locator('accessibility save', 'accessibility-save', buttonWithAnyText('Save', 'Lưu')),
} satisfies Record<string, Locator>;

/** One permission's gate switch on the Accessibility page. */
export const passcodeGate = (permission: string): Locator =>
  locator(`passcode gate: ${permission}`, `passcode-gate-${permission}`, `#passcode-gate-${permission}`);

/** The service-card parts VP-2465 measures. Relative to a card (`li.cursor-pointer`). */
export const ServiceCardParts = {
  name: 'span.overflow-hidden',
  /** The `...` span rendered right after the name. */
  ellipsis: 'span.overflow-hidden + span',
  /** The price is the card's last child div. */
  price: ':scope > div:last-child',
} as const;

export const QuickPayFieldIds = {
  amount: locator(
    'quick pay amount',
    'home-quickpay-amount-input',
    `${QUICK_PAY_DIALOG}//input[@placeholder="0.00"]`,
  ),
  name: locator(
    'quick pay name',
    'home-quickpay-name-input',
    inputWithAnyPlaceholder('Service Name', 'Tên dịch vụ'),
  ),
  note: locator(
    'quick pay note',
    'home-quickpay-note-input',
    `${QUICK_PAY_DIALOG}//textarea`,
    `${QUICK_PAY_DIALOG}//*[@placeholder="Add note" or @placeholder="Thêm ghi chú"]`,
  ),
} satisfies Record<string, Locator>;

/** Registered with the audit script by `src/constants/testids.ts`. */
export const VP_LOCATOR_GROUPS: Record<string, Record<string, Locator>> = {
  QuickPayIds,
  QuickPayFieldIds,
  CustomerEntryIds,
  OrderHistoryVpIds,
  SidebarVpIds,
  AccessibilityIds,
};
