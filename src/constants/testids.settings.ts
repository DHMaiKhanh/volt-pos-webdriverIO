/**
 * The settings sub-screens the suite did not cover yet.
 *
 * `SettingsIds` in `testids.ts` already carries the shell, the nav and the
 * pay-period cards. This file adds Business Info and Employees — the two
 * screens with forms of their own.
 *
 * ## A rare case where a DOM id beats everything
 *
 * The pay-period radios render `id={`pay-period-${value}`}` where `value` is
 * the app's `PAY_PERIOD_TYPE` enum (`weekly` | `biweekly` | `monthly` |
 * `custom`). That is a literal, untranslated, structural handle — better than
 * the testid this file proposes for it, and far better than the label-text
 * evaluation the Playwright suite needed. It is used directly.
 */

import { Actions, Settings, both } from './labels.js';
import {
  buttonContainingAnyText,
  buttonWithAnyText,
  byRole,
  byTestIdPrefix,
  inputWithAnyPlaceholder,
  locator,
  textIsAnyOf,
  type Locator,
} from '../helpers/selectors.js';

/* ------------------------------------------------------------------------- *
 * Business Info — /settings/business
 * ------------------------------------------------------------------------- */

/**
 * One pay-period radio, by the app's own enum value.
 *
 * `#pay-period-weekly` and friends — see the file note. The `[role="radio"]`
 * fallback exists only for a build that drops the id; it matches ALL four
 * radios, so a caller must not treat it as selecting one.
 */
export const payPeriodRadio = (type: 'weekly' | 'biweekly' | 'monthly' | 'custom'): Locator =>
  locator(`${type} pay period radio`, `pay-period-${type}`, `#pay-period-${type}`);

export const BusinessInfoIds = {
  heading: locator(
    'business info heading',
    'business-info-heading',
    textIsAnyOf('Business Info', 'Thông tin doanh nghiệp'),
  ),

  payPeriodGroup: locator('pay period group', 'pay-period-group', '[role="radiogroup"]'),

  /**
   * The button listing the custom cut-off days, e.g. `28, 31`.
   *
   * Only rendered while `custom` is selected. Matched by shape — a button whose
   * whole label is digits and commas — because the days are data and there is
   * no stable label to name.
   */
  customDaysButton: locator(
    'custom cut-off days',
    'pay-period-custom-days',
    `//*[@role="radiogroup"]//button[normalize-space()][not(.//*)]` +
      `[string-length(translate(normalize-space(),"0123456789, ","")) = 0]`,
  ),

  editButton: locator('edit button', 'business-info-edit', buttonWithAnyText(...both(Actions.edit))),
  saveButton: locator('save button', 'business-info-save', buttonWithAnyText(...both(Actions.save))),

  /** The confirm shown when leaving with unsaved changes. */
  unsavedDialog: locator('unsaved changes dialog', 'business-info-unsaved', byRole('alertdialog')),

  /**
   * The open/closed switch for a weekday.
   *
   * `aria-label="Open on monday"` — hardcoded English in the app, so this is
   * deliberately NOT bilingual. Worth flagging to the team: an `aria-label` is
   * user-facing text and belongs behind `t()`.
   */
  dayOpenSwitch: (day: string): Locator =>
    locator(`open on ${day} switch`, `business-info-open-${day}`, `[aria-label="Open on ${day}"]`),
} satisfies Record<string, Locator | ((day: string) => Locator)>;

/* ------------------------------------------------------------------------- *
 * Employees — /settings/staffs
 * ------------------------------------------------------------------------- */

export const EmployeeSettingsIds = {
  heading: locator('employees heading', 'settings-staffs-heading', textIsAnyOf('Employee', 'Nhân viên')),

  search: locator(
    'employee search',
    'settings-staffs-search',
    'input[placeholder*="employee" i]',
    inputWithAnyPlaceholder('Search staff', 'Tìm nhân viên'),
  ),

  /** Rows link to `/settings/staffs/{id}` — the only structural handle on a row. */
  staffLinks: locator('employee links', 'settings-staffs-link-', 'a[href*="/settings/staffs/"]'),

  table: locator('employee table', 'settings-staffs-table', 'table', byRole('table')),
  rows: locator('employee rows', 'settings-staffs-row-', 'tbody tr'),

  compensationTab: locator(
    'compensation tab',
    'settings-staffs-compensation-tab',
    textIsAnyOf('Compensation', 'Thù lao'),
  ),

  salaryAmount: locator(
    'salary amount',
    'settings-staffs-salary-amount',
    `//*[normalize-space()="Salary Amount" or normalize-space()="Mức lương"]/following::input[1]`,
  ),

  deductionPerDay: locator(
    'deduction per day',
    'settings-staffs-deduction',
    `//*[normalize-space()="Deduction Per Day" or normalize-space()="Khấu trừ mỗi ngày"]/following::input[1]`,
  ),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Language — /settings/language
 * ------------------------------------------------------------------------- */

/**
 * The two language choices.
 *
 * Language names are NOT translated — a picker shows each language in its own
 * script — so these are the only text matches in this repo that legitimately
 * carry one string. See `labels.ts` → `Settings.english` / `Settings.vietnamese`.
 */
export const LanguageSettingsIds = {
  heading: locator('language heading', 'settings-language-heading', textIsAnyOf(...both(Settings.language))),
  english: locator('English option', 'settings-language-en', textIsAnyOf(Settings.english.en)),
  vietnamese: locator('Vietnamese option', 'settings-language-vi', textIsAnyOf(Settings.vietnamese.en)),
} satisfies Record<string, Locator>;

/* ------------------------------------------------------------------------- *
 * Charge & Fee — /settings/charge-fee
 * ------------------------------------------------------------------------- */

/**
 * `/settings/charge-fee` — Tip Setting / Tax Setting / Signature, one screen-level
 * Save.
 *
 * Source: `docs/screens/charge-fee/charge-fee-test-cases.md` (playwright-mcp scan,
 * 2026-08-21). The screen ships REAL DOM ids on its radios
 * (`#charge-fee-tip-timing-before`, `#charge-fee-tip-type-percent`,
 * `#charge-fee-signature-timing-after`) and a named tax input
 * (`input[name="taxPercentage"]`), so most locators here fall back to a
 * structural handle rather than translated text. The three collapsible section
 * headers and the four tip-method checkboxes are matched POSITIONALLY /
 * BY-ROLE — they render in a fixed order (Tip / Tax / Signature) and are the only
 * `button[aria-expanded]` / `role="checkbox"` on the screen.
 *
 * The Add-Tip-Option dialog inputs are named (`amount` / `percent` / `desc`), and
 * the Edit/Delete row buttons carry the accessible names the scan recorded
 * (`Edit Tip Option` / `Delete Tip Option`) — see the factories below.
 */
export const ChargeFeeIds = {
  heading: locator(
    'charge & fee heading',
    'charge-fee-heading',
    textIsAnyOf('Charge & Fee', 'Phí & Phụ thu'),
  ),

  /** Screen-level Save — the only Save on the page; the tip dialog uses "Add". */
  saveBtn: locator('charge & fee save', 'charge-fee-save-btn', buttonWithAnyText(...both(Actions.save))),

  /** The three collapsible section headers, in render order: Tip / Tax / Signature. */
  sectionHeaders: locator(
    'section headers',
    'charge-fee-section-',
    byTestIdPrefix('charge-fee-section-'),
    '//button[@aria-expanded]',
  ),

  // --- Tip Setting ---
  /** The four tip-method checkboxes (Card / Cash / Gift Card / Other) — the only checkboxes here. */
  tipMethodCheckboxes: locator(
    'tip method checkboxes',
    'charge-fee-tip-method-',
    byTestIdPrefix('charge-fee-tip-method-'),
    byRole('checkbox'),
  ),
  tipTimingBefore: locator(
    'tip timing before',
    'charge-fee-tip-timing-before',
    '#charge-fee-tip-timing-before',
  ),
  tipTimingAfter: locator('tip timing after', 'charge-fee-tip-timing-after', '#charge-fee-tip-timing-after'),
  tipTypePercent: locator('tip type percent', 'charge-fee-tip-type-percent', '#charge-fee-tip-type-percent'),
  tipTypeAmount: locator('tip type amount', 'charge-fee-tip-type-amount', '#charge-fee-tip-type-amount'),

  addTipOptionBtn: locator(
    'add tip option',
    'charge-fee-add-tip-option',
    buttonContainingAnyText('Add Tip Option', 'Thêm tuỳ chọn tiền boa'),
  ),
  tipTable: locator('tip option table', 'charge-fee-tip-table', 'table'),
  tipTableHead: locator('tip option table head', 'charge-fee-tip-thead', 'table thead'),
  tipRows: locator(
    'tip option rows',
    'charge-fee-tip-row-',
    byTestIdPrefix('charge-fee-tip-row-'),
    'tbody tr',
  ),

  // --- Add Tip Option dialog ---
  tipDialog: locator('add tip option dialog', 'charge-fee-tip-dialog', byRole('dialog')),
  tipDialogAmount: locator('tip dialog amount', 'charge-fee-tip-dialog-amount', '[name="amount"]'),
  tipDialogPercent: locator('tip dialog percent', 'charge-fee-tip-dialog-percent', '[name="percent"]'),
  tipDialogDesc: locator('tip dialog description', 'charge-fee-tip-dialog-desc', '[name="desc"]'),
  tipDialogAddBtn: locator(
    'tip dialog add',
    'charge-fee-tip-dialog-add',
    '//*[@data-slot="dialog-content"]//button[normalize-space()="Add" or normalize-space()="Thêm"]',
  ),

  // --- Delete confirm ---
  deleteDialog: locator('delete tip option dialog', 'charge-fee-delete-dialog', byRole('alertdialog')),
  deleteConfirmBtn: locator(
    'delete confirm',
    'charge-fee-delete-confirm',
    '[data-slot="alert-dialog-footer"] button:last-of-type',
  ),
  deleteCancelBtn: locator(
    'delete cancel',
    'charge-fee-delete-cancel',
    '[data-slot="alert-dialog-footer"] button:first-of-type',
  ),

  // --- Tax Setting ---
  taxInput: locator('tax percentage input', 'charge-fee-tax-input', 'input[name="taxPercentage"]'),

  // --- Signature ---
  /**
   * The Require-Digital-Signature switch. The tip-option Status switches share
   * `role="switch"`, so this one is the switch that is NOT inside the table body
   * — the fallback after its accessible name.
   */
  signatureSwitch: locator(
    'require signature switch',
    'charge-fee-signature-switch',
    '[aria-label="Require Digital Signature"]',
    '//*[@role="switch"][not(ancestor::tbody)]',
  ),
  signatureTimingBefore: locator(
    'signature timing before',
    'charge-fee-signature-timing-before',
    '#charge-fee-signature-timing-before',
  ),
  signatureTimingAfter: locator(
    'signature timing after',
    'charge-fee-signature-timing-after',
    '#charge-fee-signature-timing-after',
  ),
} satisfies Record<string, Locator>;

/** One tip-option row's Edit button, by 1-based row. Accessible name from the scan. */
export const chargeFeeEditTipOption = (row: number): Locator =>
  locator(
    `edit tip option row ${String(row)}`,
    `charge-fee-edit-tip-${String(row)}`,
    `(//button[@aria-label="Edit Tip Option"])[${String(row)}]`,
    `(//tbody/tr[${String(row)}]//button)[last()-1]`,
  );

/** One tip-option row's Delete button, by 1-based row. */
export const chargeFeeDeleteTipOption = (row: number): Locator =>
  locator(
    `delete tip option row ${String(row)}`,
    `charge-fee-delete-tip-${String(row)}`,
    `(//button[@aria-label="Delete Tip Option"])[${String(row)}]`,
    `(//tbody/tr[${String(row)}]//button)[last()]`,
  );

/** Registered with the audit script by `src/constants/testids.ts`. */
export const SETTINGS_LOCATOR_GROUPS: Record<string, Record<string, Locator>> = {
  // `BusinessInfoIds` holds a factory alongside its locators, so it is filtered
  // to the plain entries — the audit script enumerates values and a function
  // would arrive as a locator with no `testId`.
  BusinessInfoIds: Object.fromEntries(
    Object.entries(BusinessInfoIds).filter(
      (entry): entry is [string, Locator] => typeof entry[1] !== 'function',
    ),
  ),
  EmployeeSettingsIds,
  LanguageSettingsIds,
  ChargeFeeIds,
};
