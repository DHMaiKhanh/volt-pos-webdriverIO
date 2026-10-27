/**
 * Receipt — `/settings/receipt` (Receipt Setting form + live Receipt Preview).
 *
 * Source: `docs/screens/receipt/receipt-test-cases.md` (playwright-mcp scan,
 * 2026-08-21) and the live DOM dump of build 1.1.56
 * (`reports/scans/2026-10-25-feature-inventory/dom/settings-receipt.json`).
 *
 * ## Real DOM ids — the best handles in the Settings group
 *
 * Every toggle and textarea renders a literal, untranslated `id`
 * (`#customer-info`, `#header-text-content`, …). They are used directly as the
 * fallback behind a proposed `settings-receipt-<id>` testid. The four accordion
 * headers have only Radix-generated ids (`radix-_r_au_`), which change per mount,
 * so they are matched by label and, failing that, by position inside the form.
 *
 * ## Where build 1.1.56 differs from the doc (2026-08-21)
 *
 * - Printing Preference renders TWO switches, not four:
 *   `#auto-print-split-order` / `#auto-print-gift-card` are absent from the live
 *   dump (probably feature-flagged) — kept as OPTIONAL ids.
 * - Display Options has 17 toggles, not 13: the doc's single
 *   `#subtotal-total-discount-tip-total` is now five (`#subtotal`,
 *   `#total-discount`, `#tax`, `#tip`, `#total`).
 * - Logo/branding/message/display toggles are `role="checkbox"`, not switches.
 *   Both carry `aria-checked`, which is all the page object reads.
 *
 * ## Text fallbacks
 *
 * Section titles and the preview heading were not part of a Vietnamese scan, so
 * they are English-only; the DOM ids carry the screen on a Vietnamese till.
 */

import { buttonWithAnyText, locator, type Locator } from '../helpers/selectors.js';

/** Printing Preference switches the live build renders. */
export const RECEIPT_PRINTING_IDS = ['auto-print-complete-order', 'auto-print-cancel-refund'] as const;

/** Printing Preference switches the doc lists but 1.1.56 does not render. */
export const RECEIPT_PRINTING_OPTIONAL_IDS = ['auto-print-split-order', 'auto-print-gift-card'] as const;

/** Logo & Branding — the three business-info toggles. */
export const RECEIPT_BUSINESS_INFO_IDS = [
  'show-business-name',
  'show-business-address',
  'show-business-phone',
] as const;

/** Receipt Message — switch id → textarea id + placeholder (EN). */
export const RECEIPT_MESSAGE_PAIRS = [
  { toggle: 'header-text', textarea: 'header-text-content', placeholder: 'Enter header message' },
  { toggle: 'footer-text', textarea: 'footer-text-content', placeholder: 'Enter footer message' },
  {
    toggle: 'marketing-opt-in-prompt',
    textarea: 'marketing-opt-in-prompt-content',
    placeholder: 'Enter message for marketing consent',
  },
] as const;

/** Display Options, in render order, as build 1.1.56 ships them (17). */
export const RECEIPT_DISPLAY_OPTION_IDS = [
  'cashier-name',
  'order-id',
  'check-in-time',
  'customer-info',
  'current-points',
  'visit-time',
  'group-items-by-staff-or-guest',
  'items-services-products',
  'subtotal',
  'total-discount',
  'tax',
  'tip',
  'total',
  'show-payment-method',
  'signature',
  'business-note',
  'qr-code',
] as const;

export type ReceiptToggleId =
  | (typeof RECEIPT_PRINTING_IDS)[number]
  | (typeof RECEIPT_PRINTING_OPTIONAL_IDS)[number]
  | 'show-logo'
  | (typeof RECEIPT_BUSINESS_INFO_IDS)[number]
  | (typeof RECEIPT_MESSAGE_PAIRS)[number]['toggle']
  | (typeof RECEIPT_DISPLAY_OPTION_IDS)[number];

export type ReceiptTextareaId = (typeof RECEIPT_MESSAGE_PAIRS)[number]['textarea'];

/** The four accordion sections, in render order. */
export const RECEIPT_SECTIONS = {
  printing: { label: 'Printing Preference', index: 1 },
  branding: { label: 'Logo & Branding', index: 2 },
  message: { label: 'Receipt Message', index: 3 },
  display: { label: 'Display Options', index: 4 },
} as const;

export type ReceiptSection = keyof typeof RECEIPT_SECTIONS;

export const ReceiptSettingsIds = {
  heading: locator(
    'receipt setting heading',
    'settings-receipt-heading',
    '//*[self::h1 or self::h2 or self::h3][normalize-space()="Receipt Setting"]',
  ),
  previewHeading: locator(
    'receipt preview heading',
    'settings-receipt-preview-heading',
    '//*[self::h1 or self::h2 or self::h3][normalize-space()="Receipt Preview"]',
  ),

  /**
   * The preview panel: the nearest ancestor of the "Receipt Preview" heading that
   * holds the template's `$xx.xx` placeholder amounts — i.e. the card, not just
   * its header row.
   */
  previewPanel: locator(
    'receipt preview panel',
    'settings-receipt-preview',
    '(//*[self::h1 or self::h2 or self::h3][normalize-space()="Receipt Preview"]' +
      '/ancestor::*[contains(normalize-space(),"$xx.xx")][1])[1]',
  ),

  /** Screen-level Save — the form's only submit (`type="submit"` in the dump). */
  saveBtn: locator(
    'receipt save',
    'settings-receipt-save-btn',
    '//form//button[@type="submit"]',
    buttonWithAnyText('Save', 'Lưu'),
  ),

  /** Choose file — opens the OS (Tauri) file dialog. NEVER clicked by the suite. */
  chooseFileBtn: locator(
    'choose logo file',
    'settings-receipt-choose-file',
    buttonWithAnyText('Choose file'),
  ),

  /** Any HTML file input — expected to be ABSENT (TC-RCP-14). */
  fileInputs: locator('file inputs', 'settings-receipt-file-input', 'input[type="file"]'),

  logoDefault: locator('logo default radio', 'settings-receipt-logo-default', '#logo-default'),
  logoCustom: locator('logo custom radio', 'settings-receipt-logo-custom', '#logo-custom'),

  /** The preview's logo, when the merchant has one. */
  logoImg: locator('preview business logo', 'settings-receipt-preview-logo', 'img[alt="Business Logo"]'),
} satisfies Record<string, Locator>;

/** One toggle (switch or checkbox) by its DOM id. */
export const receiptToggle = (id: ReceiptToggleId): Locator =>
  locator(`receipt toggle ${id}`, `settings-receipt-${id}`, `#${id}`);

/** One Receipt Message textarea by its DOM id. */
export const receiptTextarea = (id: ReceiptTextareaId): Locator =>
  locator(`receipt textarea ${id}`, `settings-receipt-${id}`, `#${id}`, `textarea#${id}`);

/**
 * One accordion header. By label first; then by position among the form's
 * `aria-expanded` buttons — the Device-ID popover trigger also has
 * `aria-expanded` but lives outside the form.
 */
export const receiptSectionHeader = (section: ReceiptSection): Locator => {
  const { label, index } = RECEIPT_SECTIONS[section];
  return locator(
    `receipt section ${label}`,
    `settings-receipt-section-${section}`,
    `//button[@aria-expanded][normalize-space()="${label}"]`,
    `(//form//button[@aria-expanded])[${String(index)}]`,
  );
};

/** For the parent session to register with the audit script via `testids.ts`. */
export const SETTINGS_RECEIPT_LOCATOR_GROUPS: Record<string, Record<string, Locator>> = {
  ReceiptSettingsIds,
};
