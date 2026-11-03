/**
 * VP-1418 — after a service inside a category is updated, reopening its Update
 * Service dialog must show the saved values, not the ones it opened with.
 *
 * TC doc: docs/qc/volt-qc/vp-tickets/VP-1418-service-update-dialog-stale-name-test-cases.md
 * (TC-VP1418-01..08).
 *
 * ## It edits a real service — and puts it back
 *
 * The case runs on the FIRST row of the first service category that has rows
 * (the QC run used "Other test" → "aaa"; that category is not on every merchant).
 * `before()` snapshots every field VP-1418 reads (name, description, supply fee,
 * duration minutes, Shown on Web Booking); the cases rename it through
 * `QA1418-<tag>-A..D`; `after()` writes the snapshot back. The cases follow the
 * QC run's chain (rename → reopen → rename again …), so `liveName` tracks the
 * name the service carries right now and every case opens it by that name.
 *
 * Pending: TC-08 (data across a POS reinstall / Version Update — restarts the app).
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { appNav } from '../../../src/components/index.js';
import { Routes } from '../../../src/constants/routes.js';
import { goToSettings, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { dismissUpdaterIfPresent } from '../../../src/helpers/updater.js';
import { waitUntilPath } from '../../../src/helpers/wait.js';
import { homePage } from '../../../src/pages/index.js';
import servicesSettingsPage from '../../../src/pages/settings/ServicesSettingsPage.js';
import settingsPage from '../../../src/pages/settings/SettingsPage.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  runTag,
  serviceUpdateDriver as dialog,
  type ServiceForm,
} from './vp-1418-service-update-dialog.helpers.js';

/** Category names that are not service categories (product / gift-card detail screens). */
const NOT_SERVICE = ['Product', 'Gift Card', 'Thẻ quà tặng'];

describe('VP-1418 — Update Service dialog shows the saved values after an update', () => {
  const tag = runTag();
  const names = {
    A: `QA1418-${tag}-A`,
    B: `QA1418-${tag}-B`,
    C: `QA1418-${tag}-C`,
    D: `QA1418-${tag}-D`,
    draft: `QA1418-${tag}-DRAFT`,
  };

  /** The service category the cases run in, and the service's state before the run. */
  let category = '';
  let original: ServiceForm | null = null;
  /** The name the service carries right now. */
  let liveName = '';

  /** On the chosen category's detail with nothing open over it. */
  async function onCategory(): Promise<void> {
    if (await dialog.isOpen()) await servicesSettingsPage.closeAnything();
    if (!(await servicesSettingsPage.isActive())) {
      await goToSettings();
      await settingsPage.openSection('SERVICES');
    }
    await servicesSettingsPage.waitForReady(Timeouts.MEDIUM);
    await servicesSettingsPage.openCategory(category);
  }

  /** Open the service, rename it, Update, and remember the new name. */
  async function rename(to: string): Promise<void> {
    await step(`Rename "${liveName}" → "${to}"`, async () => {
      await dialog.openByName(liveName);
      await dialog.setName(to);
      await dialog.pressUpdate();
      liveName = to;
    });
  }

  /** Reopen the service's dialog and read it back (leaves it OPEN). */
  async function reopen(name: string = liveName): Promise<ServiceForm> {
    await onCategory();
    await dialog.openByName(name);
    return dialog.read();
  }

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('edit a real service (VP-1418) and restore it');
    await goToSettings();
    await settingsPage.openSection('SERVICES');
    await servicesSettingsPage.waitForReady(Timeouts.MEDIUM);
    category = await step('Pick a service category with rows', () =>
      servicesSettingsPage.openFirstServiceCategory(NOT_SERVICE),
    );
    const first = (await servicesSettingsPage.rows())[0];
    if (!first) throw new Error(`"${category}" has no service row.`);
    liveName = first.name;
    original = await step(`Snapshot "${liveName}"`, async () => {
      await dialog.openByName(liveName);
      const form = await dialog.read();
      await dialog.closeWithX();
      return form;
    });
  });

  afterEach(async () => {
    if (await dialog.isOpen()) await servicesSettingsPage.closeAnything();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    const snapshot = original;
    if (!snapshot || !liveName) return;
    await step(`Restore "${snapshot.name}"`, async () => {
      await onCategory();
      await dialog.openByName(liveName);
      const now = await dialog.read();
      if (now.name !== snapshot.name) await dialog.setName(snapshot.name);
      if (now.description !== snapshot.description) await dialog.setDescription(snapshot.description);
      if (now.supplyFee !== snapshot.supplyFee) {
        await dialog.setSupplyFeeDigits(snapshot.supplyFee.replace(/\D/g, '') || '0');
      }
      if (snapshot.minutes && now.minutes !== snapshot.minutes) await dialog.setMinutes(snapshot.minutes);
      if (snapshot.webBooking !== null) await dialog.setWebBooking(snapshot.webBooking);
      if (await dialog.isUpdateEnabled()) await dialog.pressUpdate();
      else await dialog.closeWithX();
      liveName = snapshot.name;
    });
  });

  /* ------------------------------------------------------------------ *
   * 1. Reopening after Update
   * ------------------------------------------------------------------ */

  it(
    title('TC-VP1418-01: rename, Update, reopen — the dialog shows the new name', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await onCategory();
      await rename(names.A);
      expect(await dialog.sawSuccessToast()).toBe(true);

      const rows = await servicesSettingsPage.rows();
      expect(rows.map((r) => r.name)).toContain(names.A);

      const form = await reopen();
      expect(form.name).toBe(names.A);
      expect(form.name).not.toBe(original?.name);
    },
  );

  it(
    title(
      'TC-VP1418-02: description, supply fee, duration and web booking reopen with the saved values',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const before = await reopen();
      const description = `QC desc VP-1418 ${tag}`;
      const feeDigits = before.supplyFee === '$2.50' ? '375' : '250';
      const feeShown = feeDigits === '250' ? '$2.50' : '$3.75';
      const options = await dialog.minuteOptions();
      const minutes =
        ['15 mins', '30 mins'].find((label) => options.includes(label) && label !== before.minutes) ??
        options.find((label) => label !== before.minutes) ??
        '';
      const webBooking = before.webBooking === null ? null : !before.webBooking;

      await step('Edit the other fields and Update', async () => {
        await dialog.setDescription(description);
        await dialog.setSupplyFeeDigits(feeDigits);
        if (minutes) await dialog.setMinutes(minutes);
        if (webBooking !== null) await dialog.setWebBooking(webBooking);
        await dialog.pressUpdate();
      });

      const after = await reopen();
      expect(after.name).toBe(liveName);
      expect(after.description).toBe(description);
      expect(after.supplyFee).toBe(feeShown);
      if (minutes) expect(after.minutes).toBe(minutes);
      if (webBooking !== null) expect(after.webBooking).toBe(webBooking);
    },
  );

  it(
    title('TC-VP1418-03: consecutive edits — every reopen shows the latest name', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await onCategory();
      await rename(names.B);
      expect((await reopen()).name).toBe(names.B);
      await dialog.closeWithX();

      await rename(names.C);
      expect((await reopen()).name).toBe(names.C);
    },
  );

  it(
    title('TC-VP1418-07: an edit closed with X is not kept — reopen shows the saved name', Tag.REGRESSION),
    async () => {
      const saved = liveName;
      await reopen();
      await dialog.setName(names.draft);
      await dialog.closeWithX();

      const form = await reopen();
      expect(form.name).toBe(saved);
      expect(form.name).not.toBe(names.draft);
    },
  );

  /* ------------------------------------------------------------------ *
   * 2. The new data elsewhere / after leaving the screen
   * ------------------------------------------------------------------ */

  it(
    title('TC-VP1418-04: another category and back — the dialog still shows the new name', Tag.REGRESSION),
    async () => {
      await onCategory();
      const other = (await servicesSettingsPage.categoryNames()).find(
        (name) => name !== category && !NOT_SERVICE.includes(name),
      );
      if (other) await servicesSettingsPage.openCategory(other);
      await servicesSettingsPage.openCategory(category);

      await dialog.openByName(liveName);
      expect((await dialog.read()).name).toBe(liveName);
    },
  );

  it(title('TC-VP1418-05: Home lists the service under its new name', Tag.REGRESSION), async () => {
    await returnToHome();
    try {
      await homePage.searchService(liveName);
      expect(await dialog.homeCardShown(liveName)).toBe(true);
    } finally {
      await homePage.clearSearches();
    }
  });

  it(
    title(
      'TC-VP1418-06: rename, reload the app, reopen — the dialog shows the saved name',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await onCategory();
      await rename(names.D);

      await step('Reload the app', async () => {
        await returnToHome();
        await appNav.pressReload();
        await waitUntilPath((p) => p.startsWith(Routes.HOME), {
          timeout: Timeouts.APP_BOOT,
          message: 'Reload did not land on /home',
        });
        await homePage.waitForReady(Timeouts.APP_BOOT);
        await dismissUpdaterIfPresent();
      });

      expect((await reopen()).name).toBe(names.D);
    },
  );

  it(
    title(
      'TC-VP1418-08: the service keeps its saved values across a POS reinstall / Version Update — PENDING ' +
        '(installs another POS build and restarts the app, ending the WebDriver session; manual)',
    ),
  );
});
