import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import { AccessibilityExtraIds } from '../../constants/testids.settings-accessibility.js';
import { AccessibilityIds, passcodeGate } from '../../constants/testids.vp.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/**
 * The permissions the Passcode Setting block lists, by the suffix of their
 * `#passcode-gate-<permission>` DOM id (read off the live page, build 1.1.40).
 */
export const PASSCODE_GATES = [
  'summary_income',
  'daily_income',
  'staff_income',
  'staff_payroll',
  'batch_history',
  'complete_order',
  'cancel_order',
  'refund',
  'reopen_order',
  'delete_order',
  'view_order_history',
  // Added in build 1.1.x, between Order History and Open Cash Drawer.
  'quick_pay',
  'open_cash_drawer',
  'settings_page',
  'time_tracking',
] as const;

export type PasscodeGate = (typeof PASSCODE_GATES)[number];

export type PasscodeGateState = Record<PasscodeGate, boolean>;

/**
 * `/settings/accessibility` — Keyboard, Appearance, **Passcode Setting** (VP-2400)
 * and Customer Display.
 *
 * ## What VP-2400 actually shipped
 *
 * The ticket describes one "Enable Passcode Verification" toggle. The build
 * renders a finer control: "Require Passcode For" with an "Active All" master
 * switch and one switch per guarded action. Each switch is the per-action form of
 * the ticket's toggle, so the spec drives one gate (Order History, the cheapest
 * guarded action to reach) and the master switch for the "all actions" cases.
 *
 * Changes are committed by the section's own Save — the page has one Save per
 * section — and the setting is merchant-global, so every spec that flips a gate
 * restores it with {@link applyGates}.
 */
export class AccessibilitySettingsPage extends BasePage {
  readonly name = 'Accessibility settings';

  readonly route: string = Routes.SETTINGS_ACCESSIBILITY;

  protected readonly readyAnchor: Locator = AccessibilityIds.passcodeGateAll;

  async isPasscodeSectionShown(): Promise<boolean> {
    return this.isVisible(AccessibilityIds.passcodeSectionTitle, Timeouts.MEDIUM);
  }

  /** Is one gate switched on (= that action asks for a passcode)? */
  async isGateOn(gate: PasscodeGate | 'all'): Promise<boolean> {
    const el = await this.find(gate === 'all' ? AccessibilityIds.passcodeGateAll : passcodeGate(gate), {
      visible: true,
    });
    const aria = await el.getAttribute('aria-checked');
    if (aria === 'true' || aria === 'false') return aria === 'true';
    return (await el.getAttribute('data-state')) === 'checked';
  }

  /** Every gate's current state, for snapshot/restore around a mutating spec. */
  async readGates(): Promise<PasscodeGateState> {
    const state = {} as PasscodeGateState;
    for (const gate of PASSCODE_GATES) state[gate] = await this.isGateOn(gate);
    return state;
  }

  /** Is this gate rendered at all? */
  hasGate(gate: PasscodeGate): Promise<boolean> {
    return this.exists(passcodeGate(gate), Timeouts.SHORT);
  }

  /** Flip a switch to the wanted position, without saving. */
  async setGate(gate: PasscodeGate | 'all', on: boolean): Promise<this> {
    if ((await this.isGateOn(gate)) === on) return this;
    await logStep(`Accessibility: passcode gate ${gate} → ${on ? 'ON' : 'OFF'}`);
    await this.click(gate === 'all' ? AccessibilityIds.passcodeGateAll : passcodeGate(gate));
    await settle();
    return this;
  }

  /** Press the Passcode Setting section's Save. */
  async savePasscodeSettings(): Promise<this> {
    // The section's Save stays disabled until something changed, so a "set it to
    // what it already is" call has nothing to commit — that is not a failure.
    const save = await this.find(AccessibilityIds.passcodeSaveBtn, { visible: true });
    if (!(await save.isEnabled())) {
      this.log.debug('passcode settings unchanged; Save is disabled, nothing to commit');
      return this;
    }
    await logStep('Accessibility: save passcode settings');
    await save.click();
    // The save is a local write plus a sync push; give the toast/state a beat.
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /** Set several gates and save once. */
  async applyGates(state: Partial<Record<PasscodeGate, boolean>>): Promise<this> {
    for (const [gate, on] of Object.entries(state) as [PasscodeGate, boolean][]) {
      if (await this.hasGate(gate)) await this.setGate(gate, on);
    }
    return this.savePasscodeSettings();
  }

  /* --------------------------------------------------------------------- *
   * Keyboard / Appearance (read-only helpers for the accessibility spec)
   * --------------------------------------------------------------------- */

  isHeadingShown(): Promise<boolean> {
    return this.isVisible(AccessibilityExtraIds.heading, Timeouts.MEDIUM);
  }

  /** "Show the virtual keyboard" — independent of the passcode gates (TC-PASSCODE-05). */
  isVirtualKeyboardOn(): Promise<boolean> {
    return this.isSwitchOn(AccessibilityExtraIds.virtualKeyboardSwitch);
  }

  /** Which appearance theme radio is checked. */
  async currentTheme(): Promise<'light' | 'dark' | null> {
    if (await this.isSwitchOn(AccessibilityExtraIds.themeLight)) return 'light';
    if (await this.isSwitchOn(AccessibilityExtraIds.themeDark)) return 'dark';
    return null;
  }

  /** Is the Passcode Setting section's Save pressable (= the gate list is dirty)? */
  async isPasscodeSaveEnabled(): Promise<boolean> {
    const save = await this.find(AccessibilityIds.passcodeSaveBtn, { visible: true });
    return save.isEnabled();
  }

  /** Radix switch / radio state: `aria-checked`, falling back to `data-state`. */
  private async isSwitchOn(loc: Locator): Promise<boolean> {
    const el = await this.find(loc, { visible: true });
    const aria = await el.getAttribute('aria-checked');
    if (aria === 'true' || aria === 'false') return aria === 'true';
    return (await el.getAttribute('data-state')) === 'checked';
  }
}

export default new AccessibilitySettingsPage();
