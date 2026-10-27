/**
 * Business Info (`/settings/business`) — the locators `BusinessInfoIds` in
 * `testids.settings.ts` does not carry yet.
 *
 * Source: `docs/screens/settings-business/settings-business-test-cases.md` and the
 * live DOM dump of build 1.1.56 (`reports/scans/2026-10-25-feature-inventory/dom/
 * settings-business.json`). That build strips every data-testid on this screen, so
 * each primary below is the id the app SHOULD expose and the fallback is the
 * structural handle the dump proved exists:
 *
 * - every text field is a react-hook-form `<Input {...field}>`, so it carries its
 *   schema key as `name` (`businessName`, `legalName`, `businessPhone`, `website`,
 *   `address`, `city`, `postalCode`; the policies are `<textarea name=…>`);
 * - the seven weekday switches render `id="<weekday>"` (and the English-only
 *   `aria-label="Open on <weekday>"` that `BusinessInfoIds.dayOpenSwitch` uses);
 * - section titles are card titles, not headings — matched by their text in both
 *   locale bundles (`global.information`, `global.workHours`, …).
 */

import { Actions, both } from './labels.js';
import { buttonWithAnyText, locator, textIsAnyOf, type Locator } from '../helpers/selectors.js';

/** The weekdays in render order, as the app spells them in ids and aria-labels. */
export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/** The five section titles TC-BIZ-03 expects, `[en, vi]` from the locale bundles. */
export const BUSINESS_SECTIONS: readonly (readonly [string, string])[] = [
  ['Information', 'Thông tin'],
  ['Work Hours', 'Giờ làm việc'],
  ['Pay Period', 'Kỳ trả lương'],
  ['Store Brand', 'Thương hiệu cửa hàng'],
  ['Store Policies', 'Chính sách cửa hàng'],
];

/**
 * English labels that MUST disappear when the till is in Vietnamese (TC-BIZ-12).
 *
 * Only labels whose Vietnamese differs — `Website` is deliberately absent (the vi
 * bundle keeps the loanword), as are data values (business name, address) and the
 * hardcoded English `aria-label="Open on …"`, which is not visible text.
 */
export const BUSINESS_EN_ONLY_LABELS: readonly string[] = [
  'Business Info',
  'Edit',
  'Information',
  'Business Name',
  'Legal Name',
  'Business phone',
  'Address',
  'Country',
  'State',
  'City',
  'Postal / Zip Code',
  'Work Hours',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Closed',
  'Pay Period',
  'Current plan',
  'Weekly',
  'Biweekly',
  'Monthly',
  'Custom',
  'Select payroll dates',
  'Store Brand',
  'Store Logo',
  'Cover Photo',
  'Store Policies',
  'Liability Policies',
  'Cancellation Policies',
  'Other Policies',
];

/** A form field by its react-hook-form `name` — inputs and textareas alike. */
export const businessField = (name: string): Locator =>
  locator(
    `business ${name} field`,
    `business-info-field-${name}`,
    `input[name="${name}"]`,
    `textarea[name="${name}"]`,
  );

/** A section's card title, by its text in either bundle. */
export const businessSectionTitle = (en: string, vi: string): Locator =>
  locator(
    `business section ${en}`,
    `business-info-section-${en.toLowerCase().replace(/\s+/g, '-')}`,
    textIsAnyOf(en, vi),
  );

/**
 * A labelled combobox (Country / State) — a Radix Select trigger, `button[role=combobox]`.
 *
 * The trigger's id is generated (`_r_8s_-form-item`), so it is reached through its
 * `<label>`: the FIRST combobox after the label text.
 */
export const businessCombobox = (en: string, vi: string): Locator =>
  locator(
    `business ${en} combobox`,
    `business-info-${en.toLowerCase()}-select`,
    `//label[normalize-space()="${en}" or normalize-space()="${vi}"]/following::button[@role="combobox"][1]`,
  );

/** One weekday's open/closed switch, by its literal DOM id. */
export const businessDaySwitch = (day: Weekday): Locator =>
  locator(`business ${day} switch`, `business-info-open-${day}`, `#${day}`, `[aria-label="Open on ${day}"]`);

export const BusinessExtraIds = {
  /**
   * The header Edit button. Same as `BusinessInfoIds.editButton` but declared here
   * so this file's page-object methods do not depend on the shared catalogue's
   * ordering — the fallback is identical.
   */
  editButton: locator('business edit button', 'business-info-edit', buttonWithAnyText(...both(Actions.edit))),

  /** `<main>` — the scope for the leftover-English scan, so the settings rail is excluded. */
  main: locator('settings main region', 'settings-main', 'main'),
} satisfies Record<string, Locator>;
