/**
 * Selectors for the specs ported from volt-qc modules 01-app (APP-*) and
 * 12-perm (PERM-*) — `tests/regression/volt-qc/app-perm/`.
 *
 * Kept in its own file so the port does not collide with the shared catalogue
 * (`testids.ts`); every entry pairs a PROPOSED testid with the fallback volt-qc
 * proved against the live till (`e2e/src/flows/app-nav.ts`, `flows/perm.ts`).
 * Installed build 1.1.x strips nearly all `data-testid`s, so the fallbacks are
 * what actually resolves today.
 *
 * Two shapes live here:
 *  - {@link VqcAppPermIds}: `Locator`s for elements a helper clicks / finds;
 *  - {@link VQC_DOM}: raw CSS strings handed to in-page probes
 *    (`browser.execute`), where a Locator chain cannot be passed.
 */

import { locator, type Locator } from '../helpers/selectors.js';

/** "Enter staff code to access …" (en) / "Nhập mã nhân viên …" (vi) — the guard's own `h2`. */
const GATE_HEADING = `starts-with(normalize-space(),"Enter staff code") or starts-with(normalize-space(),"Nhập mã nhân viên")`;

export const VqcAppPermIds = {
  /** The passcode guard, told apart from every other Radix dialog by its heading. */
  gateDialog: locator(
    'passcode gate dialog',
    'passcode-guard-dialog',
    `//*[@role="dialog"][.//h2[${GATE_HEADING}]]`,
  ),
  /** Close (X) of the guard — `passcode-guard-dialog.tsx` gives it no aria-label; `right-6` positions it. */
  gateClose: locator(
    'passcode gate close',
    'passcode-guard-dialog-close',
    './/button[contains(@class,"right-6")]',
  ),
  /** Backspace key of the guard keypad (the only `w-[136px]` buttons; the last one). */
  gateBackspace: locator(
    'passcode gate backspace',
    'passcode-guard-dialog-backspace',
    '(.//button[contains(@class,"w-[136px]")])[last()]',
  ),
  gateSkipBox: locator(
    'passcode gate skip 30 min',
    'passcode-guard-dialog-skip-30min',
    './/*[@id="passcode-skip-30min"]',
  ),

  /** Header (role=banner). */
  header: locator('app header', 'app-header', 'header'),
  headerLogo: locator('header logo', 'header-logo', 'header a[href="/home"]'),
  headerPendingOrders: locator(
    'header pending orders',
    'header-order-processing',
    'header [aria-label="Open pending orders"]',
  ),
  headerOrderHistory: locator(
    'header order history link',
    'header-menu-item-/order-history',
    'header a[href^="/order-history"]',
  ),
  headerAppointment: locator(
    'header appointment link',
    'header-menu-item-/appointment',
    'header a[href^="/appointment"]',
  ),
  /** Right-hand icon group [Devices, Time keeping, Notifications] — no aria-labels, addressed by position. */
  headerDevices: locator('header devices button', 'header-devices', '(//header/div[last()]//button)[1]'),
  headerTimeKeeping: locator(
    'header time keeping button',
    'header-time-keeping',
    '(//header/div[last()]//button)[2]',
  ),
  headerBell: locator(
    'header notifications button',
    'header-notifications',
    '(//header/div[last()]//button)[3]',
  ),

  /** 404 page "← Back to Home" link. */
  notFoundBack: locator('404 back to home', 'not-found-back-home', '//a[normalize-space()="← Back to Home"]'),

  /** App sidebar pieces (the drawer is portalled; scope carried in the selector). */
  sidebarBack: locator(
    'sidebar back button',
    'app-sidebar-close',
    '[data-sidebar="sidebar"] [data-sidebar="header"] button',
  ),
  sidebarHome: locator(
    'sidebar home link',
    'app-sidebar-item-/home',
    '[data-sidebar="sidebar"] a[href="/home"]',
    '[data-slot="sidebar"] a[href="/home"]',
  ),
  sidebarDeviceId: locator(
    'sidebar device id',
    'app-sidebar-device-id',
    '//*[@data-sidebar="sidebar"]//*[starts-with(normalize-space(text()),"Device ID")]',
  ),
  sidebarVersionUpdate: locator(
    'sidebar version update',
    'app-sidebar-item-version-update',
    '//*[@data-sidebar="sidebar"]//button[normalize-space()="Version Update"]',
  ),

  /** Version Update dialog. */
  versionDialog: locator(
    'version update dialog',
    'version-update-dialog',
    '//*[@role="dialog"][.//*[normalize-space()="Version Update"]][.//*[normalize-space()="Current version"]]',
  ),
  versionCheck: locator(
    'check for updates',
    'version-update-check',
    // 1.1.x: an icon-only button, named by aria-label.
    './/button[@aria-label="Check for updates" or normalize-space()="Check for updates"]',
  ),
  versionClose: locator(
    'version update close',
    'version-update-close',
    './/button[normalize-space()="Close"]',
    './/button[@aria-label="Close"]',
  ),

  /** Home staff / service search boxes (APP-116). */
  homeStaffSearch: locator(
    'home search staff',
    'home-search-staff',
    'main input[placeholder="Search staff"]',
  ),
  homeServiceSearch: locator(
    'home search service',
    'home-search-service',
    'main input[placeholder="Search service"]',
  ),
} satisfies Record<string, Locator>;

/** CSS for in-page probes (`browser.execute`). */
export const VQC_DOM = {
  dialog: '[role="dialog"]',
  gateHeadingRe: 'Enter staff code|Nhập mã nhân viên',
  filledDot: 'div.rounded-full.bg-primary-500',
  emptyDot: 'div.rounded-full.bg-neutral-500',
  backspace: 'button[class*="w-[136px]"]',
  close: 'button[class*="right-6"]',
  error: 'span.text-red-500',
  skipBox: '#passcode-skip-30min',
  main: 'main',
  header: 'header',
  sidebar: '[data-sidebar="sidebar"]',
  popper: '[data-radix-popper-content-wrapper]',
  alertDialog: '[role="alertdialog"]',
  passcodeGateSwitch: '[id^="passcode-gate-"]',
} as const;

/** localStorage key of the 30-minute skip (`volt-pos/src/lib/passcode-skip.ts`). */
export const VQC_SKIP_KEY = 'volt-passcode-skip';

/** Dialog / gate copy (en). */
export const VqcText = {
  skipLabel: 'Do not require passcode for the next 30 minutes',
  failed: 'Failed to verify staff code',
  inactive: 'This staff is inactive',
  support: '(832) 968 9900',
} as const;
