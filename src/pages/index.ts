/**
 * The page-object barrel.
 *
 * ## What a spec imports
 *
 * One line: `import { homePage, checkoutPage } from '../../src/pages/index.js'`.
 * Every page object is a singleton — page objects hold no per-test state, only
 * locators and intent — so the lowercase name IS the object, and the exported
 * class beside it exists for type annotations and for the rare spec that needs
 * a second instance.
 *
 * ## Why the names are frozen
 *
 * These identifiers are the suite's public surface: specs, flows and the
 * fixtures under `src/data/` all spell a screen the same way. Renaming one is a
 * breaking change to every spec, so a page object that moves files keeps its
 * exported name and only its path changes here.
 *
 * ## Why there is no `export *`
 *
 * A star re-export would flatten each module's supporting types into one
 * namespace, where `CheckoutPage`'s `Tender` and the order-history filters'
 * `PaymentMethod` are one collision away from silently shadowing each other —
 * and in ESM an ambiguous star export resolves to nothing at all rather than
 * failing loudly. Types therefore stay with their module: a spec that needs
 * `OrderRowSummary` imports it from `./pos/OrderHistoryPage.js`.
 */

export { BasePage } from './BasePage.js';

/** `/splashscreen` — migrations, DB open, sync handshake. */
export { default as splashPage, SplashPage } from './pos/SplashPage.js';

/** `/login` (QR) and `/login-staff-token` (credential). */
export { default as loginPage, LoginPage } from './pos/LoginPage.js';

/** `/home` — the three-panel till: Staff | Order | Service. */
export { default as homePage, HomePage } from './pos/HomePage.js';

/** `/order/{id}/checkout` — tender selection, amount entry, completion. */
export { default as checkoutPage, CheckoutPage } from './pos/CheckoutPage.js';

/** `/order/{id}/payment-success` — receipt delivery. */
export { default as paymentSuccessPage, PaymentSuccessPage } from './pos/PaymentSuccessPage.js';

/**
 * `/customer` — the SECOND window, title `VOLT POS - Customer Display`.
 *
 * Its methods only work while the driver is switched to that window; the
 * window helpers in `src/helpers/window.js` do the switching.
 */
export { default as customerDisplayPage, CustomerDisplayPage } from './pos/CustomerDisplayPage.js';

/** `/order-history` — the searchable, filterable order list. */
export { default as orderHistoryPage, OrderHistoryPage } from './pos/OrderHistoryPage.js';

/** `/order-history/{id}` — the detail pane and its refund / cancel / tip dialogs. */
export { default as orderHistoryDetailPage, OrderHistoryDetailPage } from './pos/OrderHistoryDetailPage.js';

/** `/settings/*` — the sidebar and every sub-screen it reaches. */
export { default as settingsPage, SettingsPage } from './settings/SettingsPage.js';

/**
 * `/incomes/*` — the money reports.
 *
 * Pair these with `src/api` rather than asserting a screen against itself: the
 * services there query the same `vReport*` views the screens render from, so a
 * disagreement between the two is a real defect rather than a tautology.
 */
export {
  incomeDailyPage,
  IncomeDailyPage,
  incomeStaffPage,
  IncomeStaffPage,
  incomeSummaryPage,
  IncomeSummaryPage,
  SummaryRows,
} from './incomes/index.js';
export type { GroupBy, StaffIncomeRow, SummaryRowKey } from './incomes/index.js';

/** `/order-pending` — the queue of orders still open. */
export { default as orderPendingPage, OrderPendingPage } from './pos/OrderPendingPage.js';
export type { SortOrder } from './pos/OrderPendingPage.js';

/** `/order/{id}/split-order` — dividing one order into several checks. */
export { default as splitOrderPage, SplitOrderPage } from './pos/SplitOrderPage.js';
export type { SplitMethod } from './pos/SplitOrderPage.js';

/**
 * `/time-tracking` and `/incomes/staff-payroll` — what staff DID, as opposed to
 * what the shop earned. Both are passcode-gated and both feed the income
 * reports, so a payroll figure that looks wrong is often an input from here.
 */
export {
  default as timeTrackingPage,
  parseHoursToMinutes,
  TimeTrackingPage,
} from './payroll/TimeTrackingPage.js';
export type { TimeTrackingRow } from './payroll/TimeTrackingPage.js';
export { default as staffPayrollPage, StaffPayrollPage } from './payroll/StaffPayrollPage.js';
export type { PayrollRow, PayrollStat, PayType } from './payroll/StaffPayrollPage.js';

/** `/settings/business` — pay period, work hours, store details. */
export { default as businessInfoPage, BusinessInfoPage } from './settings/BusinessInfoPage.js';
export type { PayPeriod, PayPeriodType } from './settings/BusinessInfoPage.js';

/** `/appointment` — the booking calendar and its create/edit dialog. */
export { default as appointmentPage, AppointmentPage } from './pos/AppointmentPage.js';
export type { AppointmentDraft } from './pos/AppointmentPage.js';
