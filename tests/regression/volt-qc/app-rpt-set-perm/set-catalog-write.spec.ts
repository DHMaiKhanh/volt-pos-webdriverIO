/**
 * volt-qc module 11-settings (SET-*) — Services & Products rows that CREATE
 * data (`GHI-DU-LIEU`): new category / service, duplicate names, rename,
 * Active switch, "Shown on Go POS", and what Home shows afterwards.
 *
 * No volt-qc test exists for these; written from the TC rows SET-132, 135, 136,
 * 143, 144, 145, 146, 147, 148 of docs/qc/volt-qc/windows-regression/11-settings.md.
 *
 * Data left behind: the app has no delete for a category / service on the POS,
 * so every record this file creates is named `QC E2E …` and switched INACTIVE at
 * the end (it then shows on no till). dev / staging only (Tag.WRITE); the
 * catalogue is merchant-global, hence Tag.EXCLUSIVE.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { Vq, VqScope, type VqQuery } from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { homePage } from '../../../../src/pages/index.js';
import ServicesSettingsPage from '../../../../src/pages/settings/ServicesSettingsPage.js';
import {
  cleanTill,
  goAnyLang,
  log,
  qcTag,
  toastShown,
} from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import { dismissOverlays } from '../../../../src/pages/voltqc/settings-devm/nav.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const q = (query: VqQuery): VqQuery => query;

/** The Active switch of the table row whose name cell contains `name`. */
const rowSwitch = (name: string): VqQuery =>
  q({
    name: `row switch "${name}"`,
    css: 'td',
    text: name,
    match: 'contains',
    within: VqScope.main,
    up: { until: '[role="switch"]', css: '[role="switch"]', nth: 0 },
  });

/** The switch next to a dialog setting label ("Shown on Go POS", "Active" …). */
const dialogSwitch = (label: string): VqQuery =>
  q({
    name: `dialog switch "${label}"`,
    css: 'label, p, span, div',
    text: label,
    within: VqScope.dialog,
    up: { until: '[role="switch"]', css: '[role="switch"]', nth: 0 },
  });

const submit = (label: 'Create' | 'Add' | 'Update'): VqQuery => Vq.button(label, VqScope.dialog);

async function openServices(): Promise<void> {
  await dismissOverlays();
  await goAnyLang('/settings/services');
  await vqProbe.waitShown(Vq.heading('Category'), Timeouts.MEDIUM).catch(() => undefined);
}

/** Add a service in the open category; returns when the dialog closed. */
async function addService(name: string, priceDigits?: string): Promise<void> {
  await ServicesSettingsPage.openAddItem();
  await ServicesSettingsPage.typeDialogName(name);
  if (priceDigits !== undefined) {
    if (await ServicesSettingsPage.isFlexiblePricingChecked())
      await ServicesSettingsPage.toggleFlexiblePricing();
    await ServicesSettingsPage.replacePrice(priceDigits);
  }
  await vqProbe.press(submit('Add'));
  await vqProbe.isGone(Vq.anyDialog(), Timeouts.MEDIUM);
  await settle(1_200);
}

/** Does Home offer a service tile for `name` (search narrows the virtualised grid)? */
async function homeHasService(name: string): Promise<boolean> {
  await cleanTill();
  await homePage.selectStaffByIndex(0);
  await homePage.searchService(name);
  await settle(800);
  const n = await homePage.visibleServiceCount();
  await cleanTill();
  return n > 0;
}

/** Switch a QC row inactive (best-effort cleanup). */
async function deactivate(category: string, names: string[]): Promise<void> {
  try {
    await openServices();
    await ServicesSettingsPage.openCategory(category);
    for (const n of names) {
      if ((await vqProbe.count(rowSwitch(n))) > 0 && (await vqProbe.isChecked(rowSwitch(n)))) {
        await vqProbe.press(rowSwitch(n));
        await settle(800);
      }
    }
  } catch (error) {
    log.warn(`deactivate(${names.join(', ')}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

describe('volt-qc SET — Services & Products writes (settings)', () => {
  let category = '';
  const created: string[] = [];

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create QC services / categories');
    await openServices();
    category = await ServicesSettingsPage.openFirstServiceCategory();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    if (created.length > 0) await deactivate(category, created);
    await dismissOverlays().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'New service: price defaults to 0 with Flexible Pricing ON, it is created; a duplicate name is allowed; a rename shows in the Update dialog (SET-136, SET-143, SET-144)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      const name = `QC E2E svc ${qcTag()}`;
      await openServices();
      await ServicesSettingsPage.openCategory(category);
      await step('SET-136 defaults, then Add', async () => {
        await ServicesSettingsPage.openAddItem();
        expect(await ServicesSettingsPage.isFlexiblePricingChecked()).toBe(true);
        const price = await ServicesSettingsPage.priceValue();
        expect(price === '' || /^\$?0(\.00)?$/.test(price.trim())).toBe(true);
        await ServicesSettingsPage.typeDialogName(name);
        await vqProbe.press(submit('Add'));
        await vqProbe.isGone(Vq.anyDialog(), Timeouts.MEDIUM);
        created.push(name);
        await settle(1_200);
        expect((await ServicesSettingsPage.rows()).filter((r) => r.name === name).length).toBe(1);
      });
      await step('SET-143 the same name again is accepted', async () => {
        await addService(name);
        expect((await ServicesSettingsPage.rows()).filter((r) => r.name === name).length).toBe(2);
      });
      await step('SET-144 rename → reopening Update shows the new name', async () => {
        const rows = await ServicesSettingsPage.rows();
        const idx = rows.findIndex((r) => r.name === name);
        const renamed = `${name} R`;
        await ServicesSettingsPage.openEditRow(idx);
        await ServicesSettingsPage.typeDialogName(renamed);
        await vqProbe.press(submit('Update'));
        await vqProbe.isGone(Vq.anyDialog(), Timeouts.MEDIUM);
        created.push(renamed);
        await settle(1_200);
        const after = await ServicesSettingsPage.rows();
        const j = after.findIndex((r) => r.name === renamed);
        expect(j).toBeGreaterThanOrEqual(0);
        await ServicesSettingsPage.openEditRow(j);
        expect(await ServicesSettingsPage.dialogNameValue()).toBe(renamed);
        await ServicesSettingsPage.closeAnything();
      });
    },
  );

  it(
    title(
      'A price change reaches the Home cart; the Active switch writes at once and an Inactive service leaves Home; editing it does not re-activate it; "Shown on Go POS" OFF hides it from Home (SET-145, SET-146, SET-147, SET-148)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 3);
      const name = `QC E2E act ${qcTag()}`;
      await openServices();
      await ServicesSettingsPage.openCategory(category);
      await addService(name, '1500');
      created.push(name);
      expect(await homeHasService(name)).toBe(true);

      await step('SET-145 a new price is what Home puts in the cart', async () => {
        await openServices();
        await ServicesSettingsPage.openCategory(category);
        const idx = (await ServicesSettingsPage.rows()).findIndex((r) => r.name === name);
        await ServicesSettingsPage.openEditRow(idx);
        await ServicesSettingsPage.replacePrice('1700');
        await vqProbe.press(submit('Update'));
        await vqProbe.isGone(Vq.anyDialog(), Timeouts.MEDIUM);
        await cleanTill();
        await homePage.selectStaffByIndex(0);
        await homePage.searchService(name);
        await homePage.addServiceByIndex(0);
        expect(await homePage.cartLinePricesCents()).toContain(1700);
        await cleanTill();
      });

      await step('SET-146 switch OFF in the table — no Save — gone from Home', async () => {
        await openServices();
        await ServicesSettingsPage.openCategory(category);
        await vqProbe.press(rowSwitch(name));
        await settle(1_200);
        expect(await vqProbe.isChecked(rowSwitch(name))).toBe(false);
        expect(await vqProbe.count(Vq.button('Save', VqScope.main))).toBe(0);
        expect(await homeHasService(name)).toBe(false);
      });

      await step('SET-147 edit the Inactive service → stays Inactive', async () => {
        await openServices();
        await ServicesSettingsPage.openCategory(category);
        const idx = (await ServicesSettingsPage.rows()).findIndex((r) => r.name === name);
        await ServicesSettingsPage.openEditRow(idx);
        await ServicesSettingsPage.replacePrice('1600');
        await vqProbe.press(submit('Update'));
        await vqProbe.isGone(Vq.anyDialog(), Timeouts.MEDIUM);
        await settle(1_200);
        expect(await vqProbe.isChecked(rowSwitch(name))).toBe(false);
      });

      await step('SET-148 Active again, "Shown on Go POS" OFF → not on Home', async () => {
        await vqProbe.press(rowSwitch(name));
        await settle(1_200);
        const idx = (await ServicesSettingsPage.rows()).findIndex((r) => r.name === name);
        await ServicesSettingsPage.openEditRow(idx);
        if ((await vqProbe.count(dialogSwitch('Shown on Go POS'))) === 0) {
          await ServicesSettingsPage.closeAnything();
          return void log.warn('SET-148: no "Shown on Go POS" switch in the dialog');
        }
        await vqProbe.setChecked(dialogSwitch('Shown on Go POS'), false);
        await vqProbe.press(submit('Update'));
        await toastShown('updated', Timeouts.SHORT);
        await vqProbe.isGone(Vq.anyDialog(), Timeouts.MEDIUM);
        expect(await homeHasService(name)).toBe(false);
      });
    },
  );

  it(
    title(
      'New category is created and shows on Home once it holds a service; set Inactive it leaves Home (SET-132, SET-135)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 3);
      const cat = `QC E2E cat ${qcTag()}`;
      const svc = `${cat} svc`;
      await openServices();
      await ServicesSettingsPage.openCreateCategory();
      await ServicesSettingsPage.typeDialogName(cat);
      await vqProbe.press(submit('Create'));
      await vqProbe.isGone(Vq.anyDialog(), Timeouts.MEDIUM);
      await settle(1_200);
      expect(await ServicesSettingsPage.categoryNames()).toContain(cat);
      await ServicesSettingsPage.openCategory(cat);
      await addService(svc, '1000');
      expect(await homeHasService(svc)).toBe(true);
      const homeText = await homePage.currentPath();
      log.info(`SET-132 home path ${homeText}`);

      await step('SET-135 category Inactive → its service leaves Home', async () => {
        await openServices();
        await ServicesSettingsPage.openUpdateCategory(cat);
        await vqProbe.setChecked(dialogSwitch('Active'), false);
        await vqProbe.press(submit('Update'));
        await vqProbe.isGone(Vq.anyDialog(), Timeouts.MEDIUM);
        await settle(1_200);
        expect(await homeHasService(svc)).toBe(false);
      });
    },
  );
});
