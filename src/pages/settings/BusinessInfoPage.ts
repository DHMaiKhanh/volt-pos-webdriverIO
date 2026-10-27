import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import { BusinessInfoIds, payPeriodRadio } from '../../constants/testids.settings.js';
import {
  BusinessExtraIds,
  WEEKDAYS,
  businessCombobox,
  businessDaySwitch,
  businessField,
  businessSectionTitle,
  type Weekday,
} from '../../constants/testids.settings-business-extra.js';
import { goTo } from '../../helpers/navigate.js';
import { locator, type Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { passcodeDialog } from '../../components/modal/PasscodeDialog.js';
import { BasePage } from '../BasePage.js';

/** The four pay-period models. Values are the app's own `PAY_PERIOD_TYPE` enum. */
export type PayPeriodType = 'weekly' | 'biweekly' | 'monthly' | 'custom';

export interface PayPeriod {
  type: PayPeriodType | 'unknown';
  /** Cut-off days of the month. Only meaningful for `custom`; empty otherwise. */
  customDays: number[];
}

/** A named form field, addressed by its visible label. */
const field = (en: string, vi: string): Locator =>
  locator(
    `${en} field`,
    `business-info-${en.toLowerCase().replace(/\s+/g, '-')}`,
    `//*[normalize-space()="${en}" or normalize-space()="${vi}"]/following::input[1]`,
    `//label[normalize-space()="${en}" or normalize-space()="${vi}"]/..//input`,
  );

/**
 * Settings → Business Info — `/settings/business` (passcode-gated).
 *
 * ## Why a money spec cares about this screen
 *
 * The **Pay Period** setting is an input to salary proration. A staff member on
 * a salary model earns a fraction of their salary per period, and the period
 * length comes from here — so an Income Summary figure that looks wrong is
 * sometimes a pay period that is set differently from what the spec assumed.
 * Reading it is how a payroll assertion states its own premise.
 *
 * ## The radios have real DOM ids
 *
 * The Playwright suite read this group by evaluating over `[role="radio"]` and
 * matching English label text — necessary there, but not here: the app renders
 * `<RadioGroupItem id={`pay-period-${value}`} />`
 * (`volt-pos/src/routes/_app/settings/business/-pay-period/index.tsx:76`),
 * where `value` is the `PAY_PERIOD_TYPE` enum. A literal id beats a translated
 * label, so {@link payPeriodRadio} uses it and the whole English-label problem
 * disappears.
 *
 * The custom cut-off DAYS still have to be read from a button's text, because
 * they are data rather than a control.
 */
export class BusinessInfoPage extends BasePage {
  readonly name = 'Business Info';
  readonly route = Routes.SETTINGS_BUSINESS;

  protected readonly readyAnchor: Locator = BusinessInfoIds.heading;

  async open(): Promise<this> {
    await logStep(`Open ${this.name}`);
    await goTo(this.route);
    await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
    await this.waitForReady();
    // The pay-period group mounts with the form, after the gate — waiting for
    // the heading alone would let a spec read fields that are still empty.
    await this.find(BusinessInfoIds.payPeriodGroup, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Pay period
   * --------------------------------------------------------------------- */

  /** Which pay-period model is selected, plus the cut-off days when custom. */
  async readPayPeriod(): Promise<PayPeriod> {
    const types: PayPeriodType[] = ['weekly', 'biweekly', 'monthly', 'custom'];

    let selected: PayPeriodType | 'unknown' = 'unknown';
    for (const type of types) {
      const el = await this.find(payPeriodRadio(type), { timeout: Timeouts.SHORT }).catch(() => null);
      if (el === null) continue;

      // Radix reflects the selection on BOTH attributes; either is authoritative
      // and builds have differed on which one is present.
      const checked =
        (await el.getAttribute('aria-checked')) === 'true' ||
        (await el.getAttribute('data-state')) === 'checked';
      if (checked) {
        selected = type;
        break;
      }
    }

    return {
      type: selected,
      customDays: selected === 'custom' ? await this.customCutoffDays() : [],
    };
  }

  /**
   * The custom cut-off days, e.g. `[28, 31]`.
   *
   * Read from the button's text because they are values, not controls — there
   * is no id per day. Filtered to 1..31 so a stray number elsewhere in the
   * button (a count, a year) cannot become a cut-off day.
   */
  async customCutoffDays(): Promise<number[]> {
    const text = await this.text(BusinessInfoIds.customDaysButton, { visible: true }).catch(() => '');
    return (text.match(/\d+/g) ?? [])
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);
  }

  /** Select a pay-period model. Leaves the form dirty — Save is the caller's. */
  async selectPayPeriod(type: PayPeriodType): Promise<this> {
    await logStep(`${this.name}: pay period ${type}`);
    await this.click(payPeriodRadio(type));
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Form fields
   * --------------------------------------------------------------------- */

  /** A named field's current value. */
  fieldValue(labelEn: string, labelVi: string): Promise<string> {
    return this.value(field(labelEn, labelVi));
  }

  /**
   * Is a field editable right now?
   *
   * The form is read-only until Edit is pressed, so this doubles as "is the
   * form in edit mode".
   */
  async isFieldEditable(labelEn: string, labelVi: string): Promise<boolean> {
    const el = await this.find(field(labelEn, labelVi), { timeout: Timeouts.SHORT }).catch(() => null);
    if (el === null) return false;
    return el.isEnabled();
  }

  async pressEdit(): Promise<this> {
    await this.click(BusinessInfoIds.editButton);
    return this;
  }

  async pressSave(): Promise<this> {
    await this.click(BusinessInfoIds.saveButton);
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Work hours
   * --------------------------------------------------------------------- */

  /**
   * Is the shop open on this weekday?
   *
   * `day` is the lowercase English weekday the app puts in the switch's
   * `aria-label` (`Open on monday`). That label is NOT translated — an
   * accessibility gap worth raising, and the reason this argument is not
   * bilingual.
   */
  async isOpenOn(day: string): Promise<boolean> {
    const el = await this.find(BusinessInfoIds.dayOpenSwitch(day), { timeout: Timeouts.SHORT });
    return (
      (await el.getAttribute('aria-checked')) === 'true' ||
      (await el.getAttribute('data-state')) === 'checked'
    );
  }

  /** Dismiss the unsaved-changes prompt if the screen raised one. */
  async dismissUnsavedPrompt(): Promise<void> {
    if (await this.isVisible(BusinessInfoIds.unsavedDialog, Timeouts.SHORT)) {
      await browser.keys(['Escape']);
    }
  }

  /* --------------------------------------------------------------------- *
   * Read-only inspection (settings-business.spec.ts, TC-BIZ-*)
   *
   * Nothing below types, toggles or saves. The screen is merchant-GLOBAL
   * config, so the spec verifies it purely by reading.
   * --------------------------------------------------------------------- */

  /**
   * Wait for the FORM, not just the heading — for a caller that arrived through
   * the settings rail rather than {@link open}. The pay-period radios render from
   * the loaded merchant settings, so their presence means the data arrived.
   */
  async waitForForm(): Promise<this> {
    await this.waitForReady(Timeouts.MEDIUM);
    await this.find(BusinessInfoIds.payPeriodGroup, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  /** Which of the given `[en, vi]` section titles are NOT on screen. Empty = all present. */
  async missingSections(sections: readonly (readonly [string, string])[]): Promise<string[]> {
    const missing: string[] = [];
    for (const [en, vi] of sections) {
      if (!(await this.isVisible(businessSectionTitle(en, vi), Timeouts.SHORT))) missing.push(en);
    }
    return missing;
  }

  /** Is the field with this react-hook-form `name` rendered? */
  hasField(name: string): Promise<boolean> {
    return this.exists(businessField(name), Timeouts.SHORT);
  }

  /** Is the field with this `name` disabled (read-only)? Throws when it is not rendered. */
  async isFieldDisabledByName(name: string): Promise<boolean> {
    const el = await this.find(businessField(name), { timeout: Timeouts.SHORT });
    return !(await el.isEnabled());
  }

  /** Is the Country / State combobox rendered? */
  hasCombobox(en: string, vi: string): Promise<boolean> {
    return this.exists(businessCombobox(en, vi), Timeouts.SHORT);
  }

  /** Is the header Edit button visible AND enabled? Never clicks it. */
  async isEditAvailable(): Promise<boolean> {
    const el = await this.find(BusinessExtraIds.editButton, { visible: true, timeout: Timeouts.SHORT }).catch(
      () => null,
    );
    if (el === null) return false;
    return el.isEnabled();
  }

  /** Is this weekday's switch rendered? */
  hasDaySwitch(day: Weekday): Promise<boolean> {
    return this.exists(businessDaySwitch(day), Timeouts.SHORT);
  }

  /**
   * Every weekday row: whether the switch is ON, and the inputs next to it.
   *
   * Read in one round trip. A day row has no container id, so the row is the
   * nearest ancestor of the `#<weekday>` switch that also holds an input — an
   * open day holds two `type="time"` pickers, a closed day one disabled input
   * whose value is "Closed" / "Đóng cửa".
   */
  async workHourRows(): Promise<WorkHourRow[]> {
    await this.find(businessDaySwitch('monday'), { timeout: Timeouts.MEDIUM });
    return browser.execute((days: readonly string[]) => {
      return days.map((day) => {
        const sw = document.getElementById(day);
        let row: HTMLElement | null = sw;
        for (let i = 0; i < 6 && row && !row.querySelector('input'); i += 1) row = row.parentElement;
        const inputs = row ? Array.from(row.querySelectorAll('input')) : [];
        return {
          day,
          on: sw?.getAttribute('aria-checked') === 'true' || sw?.getAttribute('data-state') === 'checked',
          inputs: inputs.map((input) => ({ type: input.type, value: input.value, disabled: input.disabled })),
        };
      });
    }, WEEKDAYS);
  }

  /**
   * Which of these English labels are VISIBLE as a whole text node in `<main>`,
   * ignoring the settings rail (its links are navigation, scanned elsewhere).
   * Used with the till in Vietnamese: anything returned is a leftover.
   */
  async visibleExactLabels(labels: readonly string[]): Promise<string[]> {
    await this.find(BusinessExtraIds.main, { timeout: Timeouts.SHORT });
    return browser.execute((wanted: readonly string[]) => {
      const root = document.querySelector('main') ?? document.body;
      const found = new Set<string>();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (!wanted.includes(text)) continue;
        const parent = node.parentElement;
        if (!parent || parent.closest('a[href^="/settings/"]')) continue;
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (parent.getClientRects().length === 0) continue;
        found.add(text);
      }
      return Array.from(found);
    }, labels);
  }
}

/** One weekday row as {@link BusinessInfoPage.workHourRows} reads it. */
export interface WorkHourRow {
  day: string;
  on: boolean;
  inputs: { type: string; value: string; disabled: boolean }[];
}

export default new BusinessInfoPage();
