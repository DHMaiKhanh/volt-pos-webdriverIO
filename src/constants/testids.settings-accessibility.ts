/**
 * `/settings/accessibility` — the controls the Passcode Setting group in
 * `testids.vp.ts` (`AccessibilityIds`) does not address: Keyboard Setting,
 * Appearance and Customer Display.
 *
 * Re-checked against the live DOM dump of installed build 1.1.56, merchant 14
 * (reports/scans/2026-10-25-feature-inventory/dom/settings_accessibility.json).
 *
 * The build ships literal DOM ids for every switch (note the keyboard switch's id
 * is the misleading `sensitive-data`) and two real testids on the theme radios
 * (`appearance-theme-light` / `appearance-theme-dark`) — those are used as the
 * PRIMARY testid, the rest are proposals paired with the DOM id.
 */

import { locator, textIsAnyOf, type Locator } from '../helpers/selectors.js';

export const AccessibilityExtraIds = {
  heading: locator(
    'accessibility heading',
    'accessibility-heading',
    '//h3[normalize-space()="Accessibility" or normalize-space()="Hiển thị"]',
    textIsAnyOf('Accessibility', 'Hiển thị'),
  ),
  /** "Show the virtual keyboard" — DOM id `sensitive-data` on 1.1.56. */
  virtualKeyboardSwitch: locator(
    'virtual keyboard switch',
    'accessibility-virtual-keyboard-switch',
    '#sensitive-data',
    '//*[@role="switch"][@id=//label[normalize-space()="Show the virtual keyboard"]/@for]',
  ),
  themeLight: locator('appearance theme light', 'appearance-theme-light', '#light'),
  themeDark: locator('appearance theme dark', 'appearance-theme-dark', '#dark'),
  customerShowPoint: locator(
    'customer display show point',
    'accessibility-customer-show-point',
    '#customer-display-show-point',
  ),
  customerShowReward: locator(
    'customer display show reward',
    'accessibility-customer-show-reward',
    '#customer-display-show-reward',
  ),
} satisfies Record<string, Locator>;

/** The two values of the merchant-wide `merchant_default_screen` setting (VP-5685). */
export type DefaultScreen = 'pending_orders' | 'home';

/** XPath of the Default Screen card (title text; the build ships no testid on the card). */
const DEFAULT_SCREEN_CARD =
  '//div[@data-slot="card"][.//div[@data-slot="card-title"][normalize-space()="Default Screen"]]';
const CUSTOMER_DISPLAY_CARD =
  '//div[@data-slot="card"][.//div[@data-slot="card-title"][normalize-space()="Customer Display"]]';

/**
 * VP-5685 "Default Screen" card, under Customer Display (build 1.1.107, merchant 14).
 *
 * The build renders each option as a Radix radio `button#default-screen-<value>`
 * inside `label[for=…]`, with a skeleton `[data-testid=default-screen-preview-<value>]`,
 * and the card's own Save in `card-action`. The primary testids are proposals.
 */
export const DefaultScreenIds = {
  card: locator('default screen card', 'default-screen-card', DEFAULT_SCREEN_CARD),
  /** The card right after Customer Display — the placement the ticket asks for. */
  cardAfterCustomerDisplay: locator(
    'default screen card after customer display',
    'default-screen-card-after-customer-display',
    `${CUSTOMER_DISPLAY_CARD}/following-sibling::div[@data-slot="card"][1][.//div[@data-slot="card-title"][normalize-space()="Default Screen"]]`,
  ),
  saveBtn: locator(
    'default screen save',
    'default-screen-save-btn',
    `${DEFAULT_SCREEN_CARD}//div[@data-slot="card-action"]//button`,
  ),
  /** "Default" badge on the Pending Orders option. */
  defaultBadge: locator(
    'default screen default badge',
    'default-screen-default-badge',
    '//label[@for="default-screen-pending_orders"]//*[normalize-space(text())="Default"]',
  ),
} satisfies Record<string, Locator>;

/** The radio of one option (`data-state=checked` when selected). */
export const defaultScreenRadio = (value: DefaultScreen): Locator =>
  locator(`default screen radio ${value}`, `default-screen-radio-${value}`, `#default-screen-${value}`);

/** The clickable label (whole option tile) of one option. */
export const defaultScreenOption = (value: DefaultScreen): Locator =>
  locator(
    `default screen option ${value}`,
    `default-screen-option-${value}`,
    `label[for="default-screen-${value}"]`,
  );

/** The skeleton preview of one option — a real testid on 1.1.107. */
export const defaultScreenPreview = (value: DefaultScreen): Locator =>
  locator(`default screen preview ${value}`, `default-screen-preview-${value}`);
