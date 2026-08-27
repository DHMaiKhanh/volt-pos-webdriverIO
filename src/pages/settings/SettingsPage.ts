import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import { SettingsIds, settingsLanguageOption, settingsNavItem } from '../../constants/testids.js';
import type { Locator } from '../../helpers/selectors.js';
import { waitUntilPath } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/**
 * The ten sub-screens the settings sidebar links to.
 *
 * Transcribed from `navSections` in the app's
 * `settings/-components/settings-sidebar.tsx`, in the order it renders them,
 * and matching `Routes.SETTINGS_*` one for one. The KEY is what a spec names;
 * the value is the `href` the sidebar puts in the DOM, which is also the
 * fallback selector behind `settings-menu-item-{path}`.
 */
export const SettingsSection = {
  BUSINESS: Routes.SETTINGS_BUSINESS,
  SERVICES: Routes.SETTINGS_SERVICES,
  STAFFS: Routes.SETTINGS_STAFFS,
  ROLES: Routes.SETTINGS_ROLES,
  PERMISSIONS: Routes.SETTINGS_PERMISSIONS,
  RECEIPT: Routes.SETTINGS_RECEIPT,
  CHARGE_FEE: Routes.SETTINGS_CHARGE_FEE,
  /** Labelled "Tipping Settings" in the sidebar — the path and the label disagree. */
  PAYMENT_TRANSACTION: Routes.SETTINGS_PAYMENT_TRANSACTION,
  ACCESSIBILITY: Routes.SETTINGS_ACCESSIBILITY,
  LANGUAGE: Routes.SETTINGS_LANGUAGE,
} as const;

export type SettingsSectionName = keyof typeof SettingsSection;

export type SettingsSectionPath = (typeof SettingsSection)[SettingsSectionName];

/** The two locales the app ships. `language-list.tsx` puts the code straight into the radio's DOM id. */
export const LANGUAGE_CODES = ['en', 'vi'] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/**
 * `/settings/*` — the sidebar and the screens it reaches.
 *
 * ## `/settings` is never a destination
 *
 * `settings/index.tsx` is a `beforeLoad` redirect straight to
 * `/settings/business`, so the router never rests on the bare path. `route` is
 * still `/settings` because `isActive()` is a `startsWith` test and every
 * sub-screen has to answer "yes" — one page object owns the whole section.
 *
 * ## Why the sidebar is the readiness anchor
 *
 * There is no single data gate for `/settings/*`: each sub-screen loads its own
 * query, and half of them are static forms. The sidebar is the frame that
 * proves the section mounted, and — unusually for chrome in this app — it is
 * i18n-proof, because a TanStack `<Link to="/settings/business">` renders a
 * plain `<a href="/settings/business">` whose href does not translate. Waiting
 * on a heading would break the first time a merchant switched to Vietnamese.
 * A spec that needs a sub-screen's DATA waits on that screen's own anchor.
 */
export class SettingsPage extends BasePage {
  readonly name = 'Settings';

  readonly route: string = Routes.SETTINGS;

  protected readonly readyAnchor: Locator = settingsNavItem(SettingsSection.BUSINESS);

  /* --------------------------------------------------------------------- *
   * Navigation
   * --------------------------------------------------------------------- */

  /** Which sub-screen is on show, as a path. `/settings/roles/abc` reports `/settings/roles`. */
  async currentSection(): Promise<string> {
    const path = await this.currentPath();
    const segments = path.split('/').filter((segment) => segment.length > 0);
    return `/${segments.slice(0, 2).join('/')}`;
  }

  /**
   * Click a sidebar entry and wait for the router to land on it.
   *
   * Waits on the PATH rather than on anything the target screen renders: the
   * destinations have nothing in common to anchor on, and the router lands
   * before the sub-screen's query resolves either way.
   */
  async openSection(section: SettingsSectionName): Promise<this> {
    const path = SettingsSection[section];
    await this.click(settingsNavItem(path));
    await waitUntilPath((current) => current.startsWith(path), {
      timeout: Timeouts.NAVIGATION,
      message: `Settings never opened ${section} (${path})`,
    });
    return this;
  }

  /** Is a sidebar entry on screen? Some entries are permission-gated on a staff login. */
  async hasSection(section: SettingsSectionName): Promise<boolean> {
    return this.isVisible(settingsNavItem(SettingsSection[section]));
  }

  /* --------------------------------------------------------------------- *
   * Language
   * --------------------------------------------------------------------- */

  /**
   * Switch the merchant's UI language.
   *
   * This is the single most disruptive setting for a suite: every visible label
   * in the app re-renders in the new locale, which breaks any selector that
   * reads text and changes the `order-history-detail-section-{title}` ids. Put
   * it back before the spec ends, or run it in an `EXCLUSIVE`-tagged file.
   */
  async chooseLanguage(code: LanguageCode): Promise<this> {
    await this.openSection('LANGUAGE');
    await this.click(settingsLanguageOption(code));
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Business — pay period
   * --------------------------------------------------------------------- */

  /** The active pay-period card on `/settings/business`. */
  async readCurrentPayPeriod(): Promise<string> {
    return this.text(SettingsIds.payPeriodCurrent, { timeout: Timeouts.MEDIUM });
  }

  /** The queued pay-period card. Only rendered once a change has been scheduled. */
  async readScheduledPayPeriod(): Promise<string> {
    return this.text(SettingsIds.payPeriodScheduled, { timeout: Timeouts.MEDIUM });
  }

  /** Is a pay-period change pending? The note only mounts while one is queued. */
  async hasScheduledPayPeriodNote(): Promise<boolean> {
    return this.isVisible(SettingsIds.payPeriodScheduledNote);
  }
}

export default new SettingsPage();
