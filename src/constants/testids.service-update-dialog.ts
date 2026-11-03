/**
 * Update Service dialog — the WRITE side (VP-1418: the dialog showed a stale
 * name after an update).
 *
 * The read-only locators of Settings → Services & Products live in
 * `testids.settings-services.ts` (`ServicesIds`); this file only adds what a
 * spec that PRESSES Update needs: the X, the duration selects, the web-booking
 * switch and the success toast. Source: volt-pos `origin/develop` (2026-11-02)
 * `src/routes/_app/settings/services/-service/service-update-dialog.tsx`,
 * `service-duration-select.tsx`, `src/components/ui/switch-label.tsx`,
 * `src/components/ui/dialog.tsx` (`DialogHeaderClose` → sr-only "Close").
 *
 * No testids on this dialog in the installed build: primaries are the ids the
 * app should expose, fallbacks are structural + both shipped bundles.
 */

import { locator, type Locator } from '../helpers/selectors.js';

/** `[en, vi]` from `src/locales/{en,vi}/common.json`. */
export const ServiceUpdateText = {
  updateService: ['Update Service', 'Cập nhật dịch vụ'],
  serviceDuration: ['Service Duration', 'Thời lượng dịch vụ'],
  shownOnWebBooking: ['Shown on Web Booking', 'Hiển thị trên Web Booking'],
  updatedToast: ['Service updated successfully', 'Cập nhật dịch vụ thành công'],
  close: ['Close', 'Đóng'],
} as const;

const anyText = (pair: readonly string[]): string => pair.map((t) => `normalize-space()="${t}"`).join(' or ');

export const ServiceUpdateIds = {
  /** The dialog header X (`DialogHeaderClose`, label is sr-only). Scope with `within`. */
  dialogClose: locator(
    'update service close',
    'settings-services-dialog-close',
    `.//button[${anyText(ServiceUpdateText.close)}]`,
  ),
  /** Hour + minute selects under "Service Duration" — two matches, minute is the second. Scope with `within`. */
  durationSelects: locator(
    'service duration selects',
    'settings-services-dialog-duration-',
    `.//label[${anyText(ServiceUpdateText.serviceDuration)}]/following-sibling::*[1]//*[@role="combobox"]`,
  ),
  /** The "Shown on Web Booking" switch — the switch sits before its label (`SwitchLabel`). Scope with `within`. */
  webBookingSwitch: locator(
    'shown on web booking switch',
    'settings-services-dialog-web-booking',
    `.//*[@role="switch"][following-sibling::*//label[${anyText(ServiceUpdateText.shownOnWebBooking)}]]`,
  ),
  /** sonner toast "Service updated successfully" — raised after a successful Update. */
  successToast: locator(
    'service updated toast',
    'settings-services-updated-toast',
    `//*[@data-sonner-toast][.//*[${anyText(ServiceUpdateText.updatedToast)}]]`,
  ),
} satisfies Record<string, Locator>;

/** A minute option (`"15 mins"`) of the open duration select. */
export const durationOption = (label: string): Locator =>
  locator(
    `duration option ${label}`,
    `settings-services-dialog-duration-option-${label}`,
    `//*[@role="listbox"]//*[@role="option"][normalize-space()="${label}"]`,
  );

/** A service card on /home by its (data) name — same shape as `HomePage.addServiceByName`. */
export const homeServiceCardByName = (name: string): Locator =>
  locator(
    `home service card "${name}"`,
    `service-item-name-${name}`,
    `//li[contains(@class,"cursor-pointer")][.//span[normalize-space(.)="${name}"]]`,
  );
