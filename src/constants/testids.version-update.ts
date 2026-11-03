/**
 * Version Update page + updater toasts (VP-2691 / VP-2787 / VP-5102).
 *
 * Source: volt-pos `origin/develop` (2026-11-02) —
 * `src/components/software-updater/version-update-dialog.tsx`,
 * `version-update-status-card.tsx`, `software-updater-toast.tsx`,
 * `software-updater-install.tsx`, `src/components/app-sidebar-menu-item.tsx`,
 * and `src/locales/{en,vi}/common.json`.
 *
 * ## No testids on these surfaces
 *
 * None of the updater components render a `data-testid`, so every primary below
 * is the id the app SHOULD expose and the fallback is structural (Radix roles,
 * sonner's `data-sonner-toast`, lucide's icon class) corroborated by the
 * translated copy. Text is matched in BOTH bundles the app ships, because the UI
 * language is merchant state.
 *
 * The dialog / sidebar entry / refresh / close locators already live in
 * `testids.voltqc-app-perm.ts` (`VqcAppPermIds.version*`) and are reused, not
 * redeclared.
 */

import { locator, type Locator } from '../helpers/selectors.js';

/** `[en, vi]` copy from `src/locales/{en,vi}/common.json`. */
export const VersionUpdateText = {
  versionUpdate: ['Version Update', 'Cập nhật phiên bản'],
  checking: ['Checking for Updates', 'Đang kiểm tra cập nhật'],
  available: ['A New Update is Available', 'Đã có bản cập nhật mới'],
  upToDate: ["You're Up to Date", 'Đang ở phiên bản mới nhất'],
  upToDateDescription: ['Volt POS is running the latest version'],
  checkFailed: ["Couldn't Check for Updates", 'Không kiểm tra được bản cập nhật'],
  checkFailedDescription: ['Check the network connection and try again'],
  currentVersion: ['Current version', 'Phiên bản hiện tại'],
  latestVersion: ['Latest version', 'Phiên bản mới nhất'],
  description: ['Description', 'Mô tả'],
  updateNow: ['Update Now', 'Cập nhật ngay'],
  updateLater: ['Update Later', 'Để sau'],
  cancel: ['Cancel', 'Huỷ'],
  /** `global.confirmUpdateTitle` = "Update to version {{version}}?" — prefix only. */
  confirmTitlePrefix: ['Update to version', 'Cập nhật lên phiên bản'],
  updateFailed: ['Update failed. Please try again.', 'Cập nhật thất bại. Vui lòng thử lại.'],
  softwareUpdating: ['Software Updating', 'Đang cập nhật phần mềm'],
  noUpdateAvailable: ['No update is currently available.', 'Hiện chưa có bản cập nhật nào.'],
  updateRequired: ['Update Required', 'Yêu cầu cập nhật'],
} as const;

/**
 * Raw CSS for in-page probes (`browser.execute`), where a `Locator` chain cannot
 * be passed. Kept here so the selector still lives in a catalogue.
 */
export const VersionUpdateCss = {
  /** Every Radix dialog (the Version Update page is one). */
  dialog: '[role="dialog"]',
  /** Radix AlertDialog: the "Update to version X?" confirm and the "Software Updating" overlay. */
  alertDialog: '[role="alertdialog"]',
  /** One sonner toast `<li>`. */
  toast: '[data-sonner-toast]',
  /** The open sidebar sheet. */
  sidebar: '[data-sidebar="sidebar"]',
  /** lucide `<TriangleAlert />` — the "new build" mark after the Version Update entry. */
  alertIcon: 'svg.lucide-triangle-alert, svg.lucide-alert-triangle',
  /** lucide `<X />` — the toast's own close button. */
  closeIcon: 'svg.lucide-x',
} as const;

const anyText = (pair: readonly string[]): string => pair.map((t) => `normalize-space()="${t}"`).join(' or ');

export const VersionUpdateIds = {
  /** "Update Now" in the Version Update page's top bar (only while an update is offered). */
  pageUpdateNow: locator(
    'version update — Update Now',
    'version-update-update-now',
    `//*[@role="dialog"]//button[${anyText(VersionUpdateText.updateNow)}]`,
  ),
  /** The "Update to version X?" confirm. */
  confirmDialog: locator(
    'version update confirm',
    'version-update-confirm',
    `//*[@role="alertdialog"][.//*[${VersionUpdateText.confirmTitlePrefix
      .map((t) => `starts-with(normalize-space(),"${t}")`)
      .join(' or ')}]]`,
  ),
  /** Sonner toast carrying the "Update failed" heading. */
  updateFailedToast: locator(
    'update failed toast',
    'software-updater-failed-toast',
    `//*[@data-sonner-toast][.//h3[${anyText(VersionUpdateText.updateFailed)}]]`,
  ),
  /** Sonner toast carrying the "A New Update is Available" heading. */
  updateAvailableToast: locator(
    'update available toast',
    'software-updater-toast',
    `//*[@data-sonner-toast][.//h3[${anyText(VersionUpdateText.available)}]]`,
  ),
} satisfies Record<string, Locator>;
