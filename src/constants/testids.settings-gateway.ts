/**
 * `/settings/payment-gateway` — the "Charge directly via Fastboy Payment
 * gateway" switch.
 *
 * Source: docs/screens/settings-payment-gateway (scan 2026-08-21).
 *
 * ## Not reachable on build 1.1.56
 *
 * The live dump of installed build 1.1.56 (reports/scans/2026-10-25-feature-inventory/
 * dom/settings_payment-gateway.json) shows no sidebar entry for this path and the
 * route itself renders the settings shell plus "Not Found". These locators are
 * kept so the screen can be re-covered the day it returns; the testids are the
 * ones to request, the DOM id `direct-gateway` is the one the doc recorded.
 */

import { locator, textIsAnyOf, type Locator } from '../helpers/selectors.js';

/** The path the doc gives; NOT in `Routes` because the build does not route it. */
export const PAYMENT_GATEWAY_PATH = '/settings/payment-gateway';

/** `@tauri-apps/plugin-store` key holding the switch (device-scoped, not merchant). */
export const PAYMENT_GATEWAY_STORE_KEY = 'payment_direct_gateway';

/** localStorage key the plugin-store falls back to outside a Tauri webview. */
export const PAYMENT_GATEWAY_STORAGE_ITEM = 'tauri-store:settings.json';

export const PaymentGatewayIds = {
  heading: locator(
    'payment gateway heading',
    'payment-gateway-heading',
    '//h3[normalize-space()="Payment Gateway" or normalize-space()="Cổng thanh toán"]',
  ),
  description: locator(
    'payment gateway description',
    'payment-gateway-description',
    textIsAnyOf('Choose how card payments are processed.', 'Chọn cách xử lý thanh toán thẻ.'),
  ),
  directSwitch: locator(
    'direct gateway switch',
    'payment-gateway-direct-switch',
    '#direct-gateway',
    '//*[@role="switch"][@id="direct-gateway"]',
  ),
  /** Every switch on the screen — TC-PGW-03 expects exactly one. */
  anySwitch: locator(
    'payment gateway switches',
    'payment-gateway-switch-',
    '//main//*[@role="switch"]',
    '[role="switch"]',
  ),
  directLabel: locator('direct gateway label', 'payment-gateway-direct-label', 'label[for="direct-gateway"]'),
  /** Any Save button on the screen — TC-PGW-05 expects none. */
  anySave: locator(
    'payment gateway save',
    'payment-gateway-save',
    '//main//button[normalize-space()="Save" or normalize-space()="Lưu"]',
  ),
  /** The settings content area's "Not Found" — what 1.1.56 renders for this path. */
  notFound: locator('settings not found', 'settings-not-found', textIsAnyOf('Not Found', 'Không tìm thấy')),
} satisfies Record<string, Locator>;
