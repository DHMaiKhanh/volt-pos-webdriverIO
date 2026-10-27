/**
 * Business Info (`/settings/business`) — passcode gate, profile fields, work
 * hours, pay period, store policies, Vietnamese labels.
 *
 * Covers TC-BIZ-01..12 from
 * docs/screens/settings-business/settings-business-test-cases.md.
 *
 * ## Read-only by design
 *
 * Business Info is merchant-GLOBAL config (the pay period feeds salary
 * proration), so nothing here types into a field, flips a switch or presses
 * Save/Edit — every case reads the form as it loaded. "Editable" (TC-BIZ-06)
 * is asserted from the control's enabled state, not by typing.
 *
 * Two cases touch shared state and put it back:
 *
 * - TC-BIZ-01/02 drop the run's 30-minute passcode grant to see the gate, then
 *   re-arm it by unlocking with the 30-minute tick (the same grant every other
 *   spec relies on).
 * - TC-BIZ-12 switches the till to Vietnamese. The language is merchant-global,
 *   so that case is `@exclusive` and the `after` hook restores English
 *   unconditionally, even when the assertion failed half-way.
 *
 * Selectors: build 1.1.56 strips every data-testid here, so the page object
 * reaches fields by their react-hook-form `name`, weekday switches by their DOM
 * id (`#monday`…) and pay-period radios by `#pay-period-<type>` — see
 * `src/constants/testids.settings-business-extra.ts`.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog } from '../../../src/components/index.js';
import {
  BUSINESS_EN_ONLY_LABELS,
  BUSINESS_SECTIONS,
  WEEKDAYS,
} from '../../../src/constants/testids.settings-business-extra.js';
import { Routes } from '../../../src/constants/routes.js';
import { goToSettings, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import accessibilitySettingsPage from '../../../src/pages/settings/AccessibilitySettingsPage.js';
import businessInfoPage from '../../../src/pages/settings/BusinessInfoPage.js';
import settingsPage from '../../../src/pages/settings/SettingsPage.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** Land on Business Info with the form loaded, unlocking the gate if it asks. */
async function openBusinessInfo(): Promise<void> {
  if (!(await businessInfoPage.isActive())) {
    await goToSettings();
    await settingsPage.openSection('BUSINESS');
  }
  await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
  await businessInfoPage.waitForForm();
}

describe('Settings — Business Info', () => {
  /** Set when TC-BIZ-12 switched the till to Vietnamese — tells `after` to put English back. */
  let switchedLanguage = false;

  before(async () => {
    await openBusinessInfo();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    // Unconditional when TC-BIZ-12 ran: a failure between the two switches
    // would otherwise leave every later run on a Vietnamese till.
    if (switchedLanguage) {
      await goToSettings();
      await settingsPage.chooseLanguage('en');
    }
    // Whatever TC-BIZ-01 dropped, the rest of the lane expects an armed grant.
    await ensurePasscodeGrant();
  });

  /* ------------------------------------------------------------------ *
   * Passcode gate
   * ------------------------------------------------------------------ */

  // The gate is a merchant toggle (Accessibility → Require Passcode For → POS
  // Settings), OFF on merchant 14. TC-BIZ-01 reads it and asserts the entry
  // follows it; when it is on, the dialog is left up for TC-BIZ-02 to answer.
  let settingsGateOn = false;

  it(
    title('Entering Business Info follows the POS Settings passcode gate (TC-BIZ-01)', Tag.REGRESSION),
    async () => {
      await settingsPage.openSection('ACCESSIBILITY');
      settingsGateOn = await accessibilitySettingsPage.isGateOn('settings_page');

      // With a grant active the guard never shows, so the probe drops it first
      // and enters through the app sidebar WITHOUT unlocking.
      await step('Leave settings and drop the 30-minute grant', async () => {
        await returnToHome();
        await clearPasscodeGrant();
      });
      await appNav.openSidebarLink(Routes.SETTINGS_BUSINESS);

      expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(settingsGateOn);
      // The route guard passes `showSkipOption`, so the 30-minute tick is offered.
      if (settingsGateOn) expect(await passcodeDialog.canSkip()).toBe(true);
    },
  );

  it(title('The correct owner passcode unlocks the form (TC-BIZ-02)', Tag.REGRESSION), async () => {
    // Ticks "do not require for 30 minutes" before typing — re-arms the grant.
    // A no-op when the gate is off and nothing is prompting.
    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);

    expect(await passcodeDialog.isPrompting(Timeouts.SHORT)).toBe(false);
    await openBusinessInfo();
    expect(await businessInfoPage.isActive()).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   * Layout & profile fields
   * ------------------------------------------------------------------ */

  it(title('Heading plus the five sections render (TC-BIZ-03)', Tag.REGRESSION), async () => {
    await openBusinessInfo();

    expect(await businessInfoPage.isActive()).toBe(true);
    expect(await businessInfoPage.missingSections(BUSINESS_SECTIONS)).toEqual([]);
  });

  it(title('The Information block shows every profile field (TC-BIZ-04)', Tag.REGRESSION), async () => {
    await openBusinessInfo();

    // The doc's "Phone" is labelled "Business phone" on build 1.1.56 (name=businessPhone).
    for (const name of [
      'businessName',
      'legalName',
      'businessPhone',
      'website',
      'address',
      'city',
      'postalCode',
    ]) {
      expect({ name, present: await businessInfoPage.hasField(name) }).toEqual({ name, present: true });
    }
    expect(await businessInfoPage.hasCombobox('Country', 'Quốc gia')).toBe(true);
    expect(await businessInfoPage.hasCombobox('State', 'Tiểu bang')).toBe(true);
  });

  it(title('Business Name, Legal Name and Phone are read-only (TC-BIZ-05)', Tag.REGRESSION), async () => {
    await openBusinessInfo();

    expect(await businessInfoPage.isFieldDisabledByName('businessName')).toBe(true);
    expect(await businessInfoPage.isFieldDisabledByName('legalName')).toBe(true);
    expect(await businessInfoPage.isFieldDisabledByName('businessPhone')).toBe(true);
  });

  it(title('Website, Address and City are editable (TC-BIZ-06)', Tag.REGRESSION), async () => {
    await openBusinessInfo();

    // Enabled state only — typing would dirty merchant-global config.
    expect(await businessInfoPage.isFieldDisabledByName('website')).toBe(false);
    expect(await businessInfoPage.isFieldDisabledByName('address')).toBe(false);
    expect(await businessInfoPage.isFieldDisabledByName('city')).toBe(false);
  });

  it(title('The Edit button is shown and pressable (TC-BIZ-07)', Tag.REGRESSION), async () => {
    await openBusinessInfo();

    // Not clicked: entering edit mode is the start of a merchant-global write.
    expect(await businessInfoPage.isEditAvailable()).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   * Work hours
   * ------------------------------------------------------------------ */

  it(
    title('Work Hours has a switch per weekday; open days show two times (TC-BIZ-08)', Tag.REGRESSION),
    async () => {
      await openBusinessInfo();

      for (const day of WEEKDAYS) {
        expect({ day, switch: await businessInfoPage.hasDaySwitch(day) }).toEqual({ day, switch: true });
      }

      const rows = await businessInfoPage.workHourRows();
      expect(rows).toHaveLength(7);
      for (const row of rows.filter((r) => r.on)) {
        const times = row.inputs.filter((input) => input.type === 'time');
        expect({ day: row.day, times: times.length }).toEqual({ day: row.day, times: 2 });
      }
    },
  );

  it(title('A day switched off shows a disabled "Closed" field (TC-BIZ-09)', Tag.REGRESSION), async () => {
    await openBusinessInfo();

    const closedDays = (await businessInfoPage.workHourRows()).filter((row) => !row.on);
    // The doc's fixture has Sunday off (the 1.1.56 dump agrees). A merchant open
    // seven days has nothing to check — fail loudly rather than pass vacuously.
    expect(closedDays.length).toBeGreaterThan(0);

    for (const row of closedDays) {
      expect(row.inputs.some((input) => input.type === 'time')).toBe(false);
      const closed = row.inputs.find((input) => input.disabled);
      expect({ day: row.day, value: closed?.value ?? '(no disabled field)' }).toEqual({
        day: row.day,
        value: expect.stringMatching(/^(Closed|Đóng cửa)$/),
      });
    }
  });

  /* ------------------------------------------------------------------ *
   * Pay period & policies
   * ------------------------------------------------------------------ */

  it(title('The pay period reads back as a known type (TC-BIZ-10)', Tag.REGRESSION), async () => {
    await openBusinessInfo();

    const period = await businessInfoPage.readPayPeriod();
    expect(['weekly', 'biweekly', 'monthly', 'custom']).toContain(period.type);
    if (period.type === 'custom') expect(period.customDays.length).toBeGreaterThan(0);
    else expect(period.customDays).toEqual([]);
  });

  it(title('Store Policies has the three policy fields (TC-BIZ-11)', Tag.REGRESSION), async () => {
    await openBusinessInfo();

    expect(await businessInfoPage.hasField('liabilityPolicies')).toBe(true);
    expect(await businessInfoPage.hasField('cancellationPolicies')).toBe(true);
    expect(await businessInfoPage.hasField('otherPolicies')).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   * Vietnamese — merchant-global, restored in `after`
   * ------------------------------------------------------------------ */

  it(
    title(
      'In Vietnamese no English label is left on the screen (TC-BIZ-12)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async () => {
      assertWritesAllowed('switch the merchant UI language');
      await openBusinessInfo();

      await step('Switch the till to Vietnamese', async () => {
        switchedLanguage = true;
        await settingsPage.chooseLanguage('vi');
        await settingsPage.openSection('BUSINESS');
        await businessInfoPage.waitForForm();
      });

      const leftovers = await businessInfoPage.visibleExactLabels(BUSINESS_EN_ONLY_LABELS);

      await step('Switch the till back to English', async () => {
        await settingsPage.chooseLanguage('en');
        switchedLanguage = false;
      });

      expect(leftovers).toEqual([]);
    },
  );
});
