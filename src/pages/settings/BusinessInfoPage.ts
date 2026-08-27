import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../constants/routes.js';
import { BusinessInfoIds, payPeriodRadio } from '../../constants/testids.settings.js';
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
}

export default new BusinessInfoPage();
