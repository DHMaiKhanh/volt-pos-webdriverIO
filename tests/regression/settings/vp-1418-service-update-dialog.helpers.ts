/**
 * Helpers for vp-1418-service-update-dialog-stale-name.spec.ts — the WRITE side
 * of the Update Service dialog.
 *
 * `ServicesSettingsPage` deliberately exposes no method that presses Update (its
 * spec never persists anything). VP-1418 is about what the dialog shows AFTER an
 * update, so this driver adds exactly that: fill the fields, press Update, close
 * with the X — and the read-back of every field the ticket names.
 *
 * Every Update here edits a REAL service of the merchant. The spec snapshots the
 * service first and puts every field back in `after()` ({@link ServiceForm}).
 */

import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/index.js';
import {
  ServiceUpdateIds,
  durationOption,
  homeServiceCardByName,
} from '../../../src/constants/testids.service-update-dialog.js';
import { ServicesIds } from '../../../src/constants/testids.settings-services.js';
import type { Locator } from '../../../src/helpers/selectors.js';
import { settle } from '../../../src/helpers/wait.js';
import servicesSettingsPage from '../../../src/pages/settings/ServicesSettingsPage.js';
import { UiObject } from '../../../src/support/UiObject.js';

/** Every field VP-1418 reads back from the dialog. */
export interface ServiceForm {
  name: string;
  description: string;
  /** As displayed by the currency mask, e.g. `$2.50`. */
  supplyFee: string;
  /** Label of the minute select, e.g. `15 mins`. */
  minutes: string;
  /** `null` when the switch is disabled (an Inactive service). */
  webBooking: boolean | null;
}

class ServiceUpdateDriver extends UiObject {
  readonly name = 'Update Service dialog (write)';

  private async dialog(): Promise<WebdriverIO.Element> {
    return this.find(ServicesIds.dialog, { visible: true, timeout: Timeouts.MEDIUM });
  }

  private async inDialog(loc: Locator): Promise<WebdriverIO.Element> {
    return this.find(loc, { within: await this.dialog(), timeout: Timeouts.SHORT });
  }

  /** Open Update Service on the displayed table's row named `name`. */
  async openByName(name: string): Promise<void> {
    // The table re-queries after an Update — give the renamed row time to land.
    let rows = await servicesSettingsPage.rows();
    await browser
      .waitUntil(
        async () => {
          rows = await servicesSettingsPage.rows();
          return rows.some((row) => row.name === name);
        },
        { timeout: Timeouts.MEDIUM, interval: 300 },
      )
      .catch(() => undefined);
    const index = rows.findIndex((row) => row.name === name);
    if (index < 0) {
      throw new Error(`No service row named "${name}" (rows: ${rows.map((r) => r.name).join(', ')}).`);
    }
    await servicesSettingsPage.openEditRow(index);
    // The form resets from the query once it lands — wait for the name to be filled in.
    await browser.waitUntil(async () => (await this.read()).name !== '', {
      timeout: Timeouts.MEDIUM,
      interval: 150,
      timeoutMsg: `Update Service for "${name}" never filled its name`,
    });
  }

  async isOpen(): Promise<boolean> {
    return this.isVisible(ServicesIds.dialog, Timeouts.ANIMATION);
  }

  async read(): Promise<ServiceForm> {
    const name = (await (await this.inDialog(ServicesIds.dialogNameInput)).getValue()) ?? '';
    const description = (await (await this.inDialog(ServicesIds.dialogDescription)).getValue()) ?? '';
    const supplyFee = (await (await this.inDialog(ServicesIds.dialogSupplyFeeInput)).getValue()) ?? '';
    const selects = await this.findAll(ServiceUpdateIds.durationSelects, {
      within: await this.dialog(),
      timeout: Timeouts.SHORT,
    });
    const minutes = selects[1] ? (await selects[1].getText()).trim() : '';
    const sw = await this.inDialog(ServiceUpdateIds.webBookingSwitch);
    const webBooking = (await sw.isEnabled()) ? (await sw.getAttribute('aria-checked')) === 'true' : null;
    return {
      name: name.trim(),
      description: description.trim(),
      supplyFee: supplyFee.trim(),
      minutes,
      webBooking,
    };
  }

  /** Select-all + type: React's controlled inputs see real key events. */
  private async retype(loc: Locator, text: string, clear = true): Promise<void> {
    const input = await this.inDialog(loc);
    await input.click();
    await browser.keys(['Control', 'a']);
    await browser.keys(['Control']); // release the modifier before typing
    if (clear) await browser.keys(['Backspace']);
    if (text) await browser.keys(text.split(''));
    await settle();
  }

  async setName(name: string): Promise<void> {
    await this.retype(ServicesIds.dialogNameInput, name);
  }

  async setDescription(text: string): Promise<void> {
    await this.retype(ServicesIds.dialogDescription, text);
  }

  /** The currency mask takes cents as digits: `"250"` → `$2.50`. */
  async setSupplyFeeDigits(digits: string): Promise<void> {
    // Same as `ServicesSettingsPage.replacePrice`: select-all then digits (the mask has no "empty").
    await this.retype(ServicesIds.dialogSupplyFeeInput, digits, false);
  }

  /** Pick the minute option whose label is exactly `label` (e.g. `15 mins`). */
  async setMinutes(label: string): Promise<void> {
    const selects = await this.findAll(ServiceUpdateIds.durationSelects, {
      within: await this.dialog(),
      timeout: Timeouts.SHORT,
    });
    const minute = selects[1];
    if (!minute) throw new Error('Update Service: no minute select under Service Duration.');
    await minute.click();
    await this.click(durationOption(label), { timeout: Timeouts.SHORT });
    await settle();
  }

  /** Labels of the minute select's options (opens and closes the listbox). */
  async minuteOptions(): Promise<string[]> {
    const selects = await this.findAll(ServiceUpdateIds.durationSelects, {
      within: await this.dialog(),
      timeout: Timeouts.SHORT,
    });
    const minute = selects[1];
    if (!minute) return [];
    await minute.click();
    const options = await this.findAll(ServicesIds.selectOptions, { timeout: Timeouts.SHORT });
    const labels: string[] = [];
    for (const option of options) labels.push((await option.getText()).trim());
    await browser.keys(['Escape']); // closes the listbox only
    await settle();
    return labels;
  }

  async setWebBooking(on: boolean): Promise<void> {
    const sw = await this.inDialog(ServiceUpdateIds.webBookingSwitch);
    if (!(await sw.isEnabled())) return;
    if (((await sw.getAttribute('aria-checked')) === 'true') !== on) {
      await sw.click();
      await settle();
    }
  }

  async isUpdateEnabled(): Promise<boolean> {
    return (await this.inDialog(ServicesIds.dialogUpdateBtn)).isEnabled();
  }

  /** Press Update and wait for the dialog to close (it closes only on success). */
  async pressUpdate(): Promise<void> {
    assertWritesAllowed('update a service in Settings → Services & Products');
    const button = await this.inDialog(ServicesIds.dialogUpdateBtn);
    await button.waitForEnabled({ timeout: Timeouts.SHORT });
    await button.click();
    // Settings is owner-gated on some merchants; a no-op when no guard shows.
    await passcodeDialog.enterIfPresent(env.OWNER_PASSCODE, { timeout: Timeouts.ANIMATION });
    await this.waitGone(ServicesIds.dialog, Timeouts.LONG);
    await settle();
  }

  /** Close with the header X — no update. */
  async closeWithX(): Promise<void> {
    await this.click(ServiceUpdateIds.dialogClose, { within: await this.dialog(), timeout: Timeouts.SHORT });
    await this.waitGone(ServicesIds.dialog, Timeouts.SHORT);
  }

  /** Was the "Service updated successfully" toast raised (within a short window)? */
  async sawSuccessToast(): Promise<boolean> {
    return this.exists(ServiceUpdateIds.successToast, Timeouts.SHORT);
  }

  /** Is a /home service card named `name` mounted? */
  async homeCardShown(name: string): Promise<boolean> {
    return this.isVisible(homeServiceCardByName(name), Timeouts.MEDIUM);
  }
}

export const serviceUpdateDriver = new ServiceUpdateDriver();

/** Short unique suffix so parallel / repeated runs never collide on a name. */
export function runTag(): string {
  return Date.now().toString(36).slice(-5).toUpperCase();
}
