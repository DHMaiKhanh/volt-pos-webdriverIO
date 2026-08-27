/**
 * Switching the till's language, and putting it back.
 *
 * ## Why this file carries `Tag.EXCLUSIVE`
 *
 * The app language is MERCHANT-GLOBAL state, not per-session and not per-staff.
 * `language-list.tsx` calls `i18n.changeLanguage(code)` and then
 * `mainEmitToCustomer("language:changed", code)`, so one click re-renders every
 * label in BOTH windows for whoever is looking at the till — there is no
 * second staff member, second window or second tab that could be running in
 * English while this spec is in Vietnamese.
 *
 * A spec running beside this one therefore does not merely see different text.
 * Any locator built on rendered text stops matching, and the order-history
 * detail sections are addressed by their TRANSLATED title
 * (`order-history-detail-section-{title}`), so their ids change underneath a
 * running spec. That is corruption of the other run, not flake, and it happens
 * in whichever direction the two tests interleave. Hence: this file runs LAST
 * and ALONE, and it restores English in `after` even when the assertion failed
 * part-way through the switch.
 *
 * CREATES/MUTATES DATA: dev / staging only — `Tag.WRITE`.
 *
 * PREREQUISITE: the merchant has a configured pay period, so
 * `/settings/business` renders the current-plan card this spec reads.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../../src/constants/routes.js';
import { goToSettings } from '../../../src/flows/index.js';
import { settingsPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

describe('Settings — app language', () => {
  let englishPayPeriod = '';

  before(async () => {
    // The mutation is a single page-object call, so there is no data-creating
    // flow to inherit the rail from — it is stated here instead.
    assertWritesAllowed('switch the merchant UI language');

    await goToSettings();
    await settingsPage.openSection('BUSINESS');
    englishPayPeriod = await settingsPage.readCurrentPayPeriod();
  });

  after(async () => {
    // Unconditional. A failure between the two switches would otherwise leave
    // the merchant — and therefore every later run on this machine — on a
    // Vietnamese till.
    await settingsPage.chooseLanguage('en');
  });

  it(
    title(
      'Switching to Vietnamese re-renders the UI, and switching back restores it',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async () => {
      expect(englishPayPeriod.length).toBeGreaterThan(0);

      await settingsPage.chooseLanguage('vi');
      expect(await settingsPage.currentSection()).toBe(Routes.SETTINGS_LANGUAGE);

      await settingsPage.openSection('BUSINESS');
      const vietnamesePayPeriod = await settingsPage.readCurrentPayPeriod();

      // The card's heading is `t("global.currentPlan")` — "Current plan" in en,
      // "Kỳ hiện tại" in vi. A changed string is the app re-rendering through
      // i18next; an unchanged one means the radio was recorded but the locale
      // never propagated, which is the bug this spec exists to catch.
      expect(vietnamesePayPeriod).not.toBe(englishPayPeriod);

      await settingsPage.chooseLanguage('en');
      await settingsPage.openSection('BUSINESS');
      expect(await settingsPage.readCurrentPayPeriod()).toBe(englishPayPeriod);
    },
  );
});
