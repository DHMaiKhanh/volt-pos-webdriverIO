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
