/**
 * Router paths, transcribed from the app's `src/routeTree.gen.ts`.
 *
 * The `_app` segment is a TanStack **pathless layout** route — it groups the
 * authenticated screens and contributes nothing to the URL. So the file tree
 * says `/_app/home/` while `browser.getUrl()` reports `/home`. Asserting on the
 * file-tree spelling is a classic false failure, which is why the mapping lives
 * here once instead of being re-derived per page object.
 *
 * In a packaged build the origin is the custom protocol (`http://tauri.localhost`
 * on Windows), never `http://localhost:1420` — that port only exists while
 * `tauri dev` is proxying Vite. Compare on the PATH, never the full URL.
 */
export const Routes = {
  SPLASH: '/splashscreen',
  LOGIN: '/login',

  HOME: '/home',
  APPOINTMENT: '/appointment',
  ORDER_HISTORY: '/order-history',
  ORDER_HISTORY_DETAIL: (orderId: string) => `/order-history/${orderId}`,
  ORDER_PENDING: '/order-pending',

  CHECKOUT: (orderId: string) => `/order/${orderId}/checkout`,
  CHECKOUT_VIEW_CART: (orderId: string) => `/order/${orderId}/checkout/view-cart`,
  CHECKOUT_PROCESSING: (orderId: string) => `/order/${orderId}/checkout/processing-payment`,
  CHECKOUT_SUCCESS: (orderId: string) => `/order/${orderId}/checkout/payment-success`,
  PAYMENT_SUCCESS: (orderId: string) => `/order/${orderId}/payment-success`,
  SPLIT_ORDER: (orderId: string) => `/order/${orderId}/split-order`,

  INCOMES: '/incomes',
  INCOME_DAILY: '/incomes/income-daily',
  INCOME_STAFF: '/incomes/income-staff',
  INCOME_SUMMARY: '/incomes/income-summary',
  STAFF_PAYROLL: '/incomes/staff-payroll',

  TIME_TRACKING: '/time-tracking',
  CASH_DRAWER: '/cash-drawer',
  BATCH_HISTORY: '/batch-history',

  SETTINGS: '/settings',
  SETTINGS_ACCESSIBILITY: '/settings/accessibility',
  SETTINGS_BUSINESS: '/settings/business',
  SETTINGS_CHARGE_FEE: '/settings/charge-fee',
  SETTINGS_LANGUAGE: '/settings/language',
  SETTINGS_PAYMENT_TRANSACTION: '/settings/payment-transaction',
  SETTINGS_PERMISSIONS: '/settings/permissions',
  SETTINGS_RECEIPT: '/settings/receipt',
  SETTINGS_ROLES: '/settings/roles',
  SETTINGS_SERVICES: '/settings/services',
  SETTINGS_STAFFS: '/settings/staffs',

  /** Second window — the customer-facing display. */
  CUSTOMER: '/customer',
} as const;

/** Strip origin + query + hash so a route can be compared as a bare path. */
export function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
