import { browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { settle } from '../../../helpers/wait.js';
import { UiObject } from '../../../support/UiObject.js';

/**
 * Read-only layout probe of Settings › Accessibility › Passcode Setting
 * (PERM-031 / PERM-037). Switch state and draft toggling stay with
 * `AccessibilitySettingsPage`; this only reads what that page object does not:
 * the card's copy, each gate's `<label for>`, the switch count and the vertical
 * gap between the card title and "Require Passcode For".
 */

export interface PasscodeCardLayout {
  found: boolean;
  text: string;
  /** `label[for="passcode-gate-<gate>"]` text per gate id suffix. */
  labels: Record<string, string>;
  switchCount: number;
  /** Pixels between the bottom of "Passcode Setting" and the top of "Require Passcode For". */
  titleGap: number | null;
}

export class PasscodeSettingProbe extends UiObject {
  readonly name = 'volt-qc passcode setting probe';

  async readCard(gates: readonly string[]): Promise<PasscodeCardLayout> {
    return browser.execute(
      function (ids: string[]): PasscodeCardLayout {
        const all = document.getElementById('passcode-gate-all');
        const leafWith = (root: Element, t: string): HTMLElement | undefined =>
          Array.from(root.querySelectorAll('*')).find(
            (e) => e.children.length === 0 && (e.textContent ?? '').trim() === t,
          ) as HTMLElement | undefined;
        // Deepest ancestor of the Active All switch that also holds the card title.
        let card: Element | null = all;
        while (card && !leafWith(card, 'Passcode Setting')) card = card.parentElement;
        if (!all || !card) return { found: false, text: '', labels: {}, switchCount: 0, titleGap: null };
        const labels: Record<string, string> = {};
        for (const g of ids) {
          const l = document.querySelector(`label[for="passcode-gate-${g}"]`);
          labels[g] = (l?.textContent ?? '').trim();
        }
        const t1 = leafWith(card, 'Passcode Setting')?.getBoundingClientRect();
        const t2 = leafWith(card, 'Require Passcode For')?.getBoundingClientRect();
        return {
          found: true,
          text: ((card as HTMLElement).innerText || card.textContent || '').replace(/\s+/g, ' '),
          labels,
          switchCount: card.querySelectorAll('[role="switch"]').length,
          titleGap: t1 && t2 ? t2.y - (t1.y + t1.height) : null,
        };
      },
      [...gates],
    );
  }

  /** Is the settings leave guard ("Discard changes and leave?") up? */
  async leaveGuardShown(timeout: number = Timeouts.SHORT): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      const ok = await browser.execute(function () {
        return Array.from(document.querySelectorAll('[role="alertdialog"],[role="dialog"]')).some(
          (d) =>
            d.getClientRects().length > 0 && (d.textContent ?? '').includes('Discard changes and leave?'),
        );
      });
      if (ok) return true;
      await settle(200);
    } while (Date.now() < deadline);
    return false;
  }
}

export const passcodeSettingProbe = new PasscodeSettingProbe();
