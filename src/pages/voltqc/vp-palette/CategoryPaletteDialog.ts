import { browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { ServicesIds } from '../../../constants/testids.settings-services.js';
import { PaletteCss, PaletteIds } from '../../../constants/testids.vp-palette.js';
import { settle } from '../../../helpers/wait.js';
import { UiObject } from '../../../support/UiObject.js';
import { toHex } from '../../../utils/color.js';

/** One colour swatch of the Create / Update Category dialog. */
export interface Swatch {
  /** Upper-case `#RRGGBB`. */
  hex: string;
  /** The swatch carries the check icon (the form's current value). */
  selected: boolean;
}

/** One card of the Reorder dialog's active tab, with its text colour. */
export interface ReorderCardColor {
  name: string;
  text: string;
  background: string;
}

/**
 * The colour half of Settings → Services → Create / Update Category (VP-5338).
 *
 * `ServicesSettingsPage` opens the dialogs and deliberately never submits one;
 * VP-5338 has to SAVE a colour to prove the round trip, so the swatch picker and
 * the submit live here, in a probe only the VP-5338 spec imports. Everything is
 * scoped to the topmost open dialog.
 */
export class CategoryPaletteDialog extends UiObject {
  readonly name = 'Category palette dialog';

  /** The swatches in render order, with the selected one flagged. */
  async swatches(): Promise<Swatch[]> {
    const dialog = await this.dialog();
    const raw = await browser.execute(
      (el: HTMLElement, css: string) =>
        Array.from(el.querySelectorAll<HTMLElement>(css)).map((swatch) => ({
          color: swatch.style.getPropertyValue('--color').trim(),
          selected: swatch.querySelector('svg') !== null,
        })),
      dialog as unknown as HTMLElement,
      PaletteCss.dialogSwatch,
    );
    return raw.map((s) => ({ hex: toHex(s.color), selected: s.selected }));
  }

  /** The hex of the selected swatch, or `''`. */
  async selectedHex(): Promise<string> {
    return (await this.swatches()).find((s) => s.selected)?.hex ?? '';
  }

  /** Click the swatch of `hex` and wait for its check icon. */
  async pick(hex: string): Promise<void> {
    const dialog = await this.dialog();
    const wanted = toHex(hex);
    const all = await this.findAll(PaletteIds.dialogSwatches, { within: dialog, timeout: Timeouts.SHORT });
    for (const swatch of all) {
      const style = ((await swatch.getAttribute('style')) ?? '').match(/--color:\s*([^;]+)/)?.[1] ?? '';
      if (toHex(style) !== wanted) continue;
      await swatch.scrollIntoView({ block: 'center' });
      await swatch.click();
      await browser.waitUntil(async () => (await this.selectedHex()) === wanted, {
        timeout: Timeouts.SHORT,
        interval: 200,
        timeoutMsg: `${this.name}: swatch ${wanted} never showed its check icon`,
      });
      return;
    }
    throw new Error(`${this.name}: no swatch ${wanted} in the dialog.`);
  }

  /** Press the header Create / Update button once enabled; resolves when the dialog closed. */
  async submit(which: 'create' | 'update'): Promise<void> {
    const dialog = await this.dialog();
    const button = await this.find(
      which === 'create' ? ServicesIds.dialogCreateBtn : ServicesIds.dialogUpdateBtn,
      {
        within: dialog,
        timeout: Timeouts.SHORT,
      },
    );
    // Create waits on the async name-uniqueness check; Update on a dirty form.
    await button.waitForEnabled({ timeout: Timeouts.MEDIUM });
    await button.click();
    await this.waitGone(ServicesIds.dialog, Timeouts.API);
    await settle();
  }

  /** Text colour of every card in the open Reorder dialog's active tab. */
  async reorderCardColors(): Promise<ReorderCardColor[]> {
    const dialog = await this.dialog();
    await settle();
    const raw = await browser.execute(
      (el: HTMLElement, panelCss: string) => {
        const panel = el.querySelector(panelCss) ?? el;
        const out: { name: string; text: string; background: string }[] = [];
        for (const h3 of Array.from(panel.querySelectorAll('h3'))) {
          let card: HTMLElement | null = h3;
          for (let i = 0; i < 4 && card && !card.style.backgroundColor; i += 1) card = card.parentElement;
          if (!card?.style.backgroundColor) continue;
          out.push({
            name: (h3.textContent ?? '').trim(),
            text: window.getComputedStyle(h3).color,
            background: window.getComputedStyle(card).backgroundColor,
          });
        }
        return out;
      },
      dialog as unknown as HTMLElement,
      PaletteCss.activeTabpanel,
    );
    return raw.map((c) => ({ name: c.name, text: toHex(c.text), background: toHex(c.background) }));
  }

  private async dialog(): Promise<WebdriverIO.Element> {
    return this.find(ServicesIds.dialog, { visible: true, timeout: Timeouts.MEDIUM });
  }
}

export const categoryPaletteDialog = new CategoryPaletteDialog();
