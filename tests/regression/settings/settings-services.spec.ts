/**
 * Services & Products (`/settings/services`, `/settings/services/$categoryId`) —
 * category panel, service/product tables, status filter, the Create/Update
 * Category, Add New Item and Update Service dialogs, and the Reorder dialog.
 *
 * Covers TC-SVC-01..37 from
 * docs/screens/settings-services/settings-services-test-cases.md.
 *
 * ## Why this file never writes
 *
 * Every dialog here submits through a header button (Create / Update / Add) and
 * no case presses one: dialogs are opened, typed into, and dismissed with Escape,
 * which the app treats as a no-confirm cancel. The row Status switches and the
 * reorder drag handles save IMMEDIATELY, so they are only read. Names typed into
 * dialogs carry the `QA-SCAN-20261025-` prefix so a regression that DID persist
 * one is obvious and greppable — TC-SVC-15/22 assert none appears.
 *
 * ## The doc's fixtures vs this merchant
 *
 * The doc was scanned against a merchant with a `MANICURE & PEDICURE` category
 * (16 services, first row `Regular Toe Polish Change` $20.00). Merchant 14 on
 * build 1.1.56 has no such category, so the spec picks "the first active
 * category whose detail is a service table with rows" once, in `before`, and
 * asserts the doc's RULES against it (counts compared to each other, prefill
 * compared to the row) instead of the doc's literal numbers. The product cases
 * use the `Product` category, which this merchant does have.
 *
 * ## Known-bug cases
 *
 * TC-SVC-09 ("null" description) and TC-SVC-11 (no empty state) assert the
 * CORRECT behaviour, so they fail while the bug the doc records is still there.
 * The ⚠️ "needs confirmation" cases (TC-SVC-21, TC-SVC-29) assert what the app
 * does today, so a change in behaviour is noticed.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { passcodeDialog } from '../../../src/components/index.js';
import { ServicesText } from '../../../src/constants/testids.settings-services.js';
import { goToSettings } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import servicesSettingsPage from '../../../src/pages/settings/ServicesSettingsPage.js';
import settingsPage from '../../../src/pages/settings/SettingsPage.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { parseMoney } from '../../../src/utils/money.js';

/** Prefix for anything typed as a record name — see the header note. */
const QA_PREFIX = 'QA-SCAN-20261025-';

/** Category names that are not service categories (product / gift-card detail screens). */
const NOT_SERVICE = ['Product', 'Gift Card', 'Thẻ quà tặng'];

/** The `Product` category's name in the Category panel (data, not a label). */
const PRODUCT_CATEGORY = 'Product';

/** Is `text` one of a bilingual pair? */
const isOneOf = (pair: readonly string[], text: string): boolean => pair.includes(text.trim());

describe('Settings — Services & Products', () => {
  /** The service category the detail cases run against (resolved in `before`). */
  let serviceCategory = '';

  /** Back on the services screen with nothing open over it. */
  async function onServicesScreen(): Promise<void> {
    await servicesSettingsPage.closeAnything();
    if (!(await servicesSettingsPage.isActive())) {
      await goToSettings();
      await settingsPage.openSection('SERVICES');
    }
    await servicesSettingsPage.waitForReady(Timeouts.MEDIUM);
  }

  /** On the chosen service category's detail, filter back on All. */
  async function onServiceCategory(): Promise<void> {
    await onServicesScreen();
    // Re-clicking the open category is a no-op route change, and resets the
    // status filter to All (the table remounts per category).
    await servicesSettingsPage.openCategory(serviceCategory);
  }

  /** On the Product category's detail. */
  async function onProductCategory(): Promise<void> {
    await onServicesScreen();
    await servicesSettingsPage.openCategory(PRODUCT_CATEGORY);
  }

  /** Index of the first row whose price is a positive amount — a non-flexible-priced service. */
  async function firstPricedRow(): Promise<{ index: number; name: string; price: string }> {
    const rows = await servicesSettingsPage.rows();
    const index = rows.findIndex((row) => {
      try {
        return parseMoney(row.price) > 0;
      } catch {
        return false;
      }
    });
    const row = rows[index];
    if (!row) throw new Error(`No priced row in "${serviceCategory}" to open Update Service on.`);
    return { index, name: row.name, price: row.price };
  }

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await goToSettings();
    await settingsPage.openSection('SERVICES');
    await servicesSettingsPage.waitForReady(Timeouts.MEDIUM);
    serviceCategory = await step('Pick a service category with rows', () =>
      servicesSettingsPage.openFirstServiceCategory(NOT_SERVICE),
    );
  });

  beforeEach(async () => {
    await onServicesScreen();
  });

  after(async () => {
    // Nothing was submitted; just leave no dialog over the screen and the grant armed.
    await servicesSettingsPage.closeAnything();
    await ensurePasscodeGrant();
  });

  /* ------------------------------------------------------------------ *
   * Category panel
   * ------------------------------------------------------------------ */

  it(title('The route opens without a passcode gate (TC-SVC-01)', Tag.REGRESSION), async () => {
    // Drop the run's grant so a gate WOULD show if the route had one, then
    // re-enter through the settings rail.
    try {
      await clearPasscodeGrant();
      await settingsPage.openSection('STAFFS');
      await settingsPage.openSection('SERVICES');

      expect(await passcodeDialog.isPrompting(Timeouts.SHORT)).toBe(false);
      expect(await servicesSettingsPage.isCategoryHeadingShown()).toBe(true);
      expect((await servicesSettingsPage.categoryRows()).length).toBeGreaterThan(0);
    } finally {
      await ensurePasscodeGrant();
    }
  });

  it(
    title('With no category chosen the detail shows a placeholder (TC-SVC-02)', Tag.REGRESSION),
    async () => {
      // A category may be open from `before`; the bare route is the rail link.
      await settingsPage.openSection('STAFFS');
      await settingsPage.openSection('SERVICES');

      expect(await servicesSettingsPage.isSelectCategoryPlaceholderShown()).toBe(true);
    },
  );

  it(title('The Active tab lists categories, each with Update (TC-SVC-03)', Tag.REGRESSION), async () => {
    expect(await servicesSettingsPage.isCategoryTabSelected('active')).toBe(true);

    const rows = await servicesSettingsPage.categoryRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.href).toMatch(/^\/settings\/services\/[^/]+$/);
      // The app omits the pencil only on the built-in "Other" category.
      if (row.name !== 'Other')
        expect({ name: row.name, update: row.hasUpdate }).toEqual({ name: row.name, update: true });
    }
  });

  it(title('The Inactive tab switches to the inactive categories (TC-SVC-04)', Tag.REGRESSION), async () => {
    const active = await servicesSettingsPage.categoryNames();

    try {
      await servicesSettingsPage.selectCategoryTab('inactive');
      expect(await servicesSettingsPage.isCategoryTabSelected('inactive')).toBe(true);

      const inactive = await servicesSettingsPage.categoryNames();
      expect(inactive.length).toBeGreaterThan(0);
      expect(inactive).not.toEqual(active);
    } finally {
      await servicesSettingsPage.selectCategoryTab('active');
    }
  });

  it(
    title('An exact "Active" tab match is unique; a substring match is not (TC-SVC-05)', Tag.REGRESSION),
    async () => {
      const { exact, partial } = await servicesSettingsPage.activeTabMatchCounts();

      expect(exact).toBe(1);
      // "Inactive" contains "Active" (vi: both contain "hoạt động") — the strict-mode trap.
      expect(partial).toBe(2);
    },
  );

  it(
    title('Clicking a category routes to it and renders its table (TC-SVC-06)', Tag.REGRESSION),
    async () => {
      const path = await servicesSettingsPage.openCategory(serviceCategory);

      expect(path).toMatch(/^\/settings\/services\/[^/]+$/);
      expect(await servicesSettingsPage.detailHeading()).toBe(serviceCategory);
      expect(await servicesSettingsPage.rowCount()).toBeGreaterThan(0);
    },
  );

  /* ------------------------------------------------------------------ *
   * Service table
   * ------------------------------------------------------------------ */

  it(title('The service table columns are in order (TC-SVC-07)', Tag.REGRESSION), async () => {
    await onServiceCategory();

    const headers = await servicesSettingsPage.tableHeaders();
    expect([ServicesText.serviceColumnsEn.join('|'), ServicesText.serviceColumnsVi.join('|')]).toContain(
      headers.join('|'),
    );
  });

  it(title('Every row has a Status switch and an Edit button (TC-SVC-08)', Tag.REGRESSION), async () => {
    await onServiceCategory();

    const rows = await servicesSettingsPage.rows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect({ row: row.name, switch: row.hasSwitch, edit: row.hasEdit }).toEqual({
        row: row.name,
        switch: true,
        edit: true,
      });
    }
  });

  it(
    title(
      'No service shows the literal text "null" as its description — known bug (TC-SVC-09)',
      Tag.REGRESSION,
    ),
    async () => {
      // The doc's rows (Milk and Honey Butter Pedicure, …) are not on this
      // merchant, so every active service category is swept instead.
      const offenders: string[] = [];
      const categories = (await servicesSettingsPage.categoryNames()).filter(
        (name) => !NOT_SERVICE.includes(name),
      );

      for (const category of categories) {
        await servicesSettingsPage.openCategory(category);
        for (const row of await servicesSettingsPage.rows()) {
          if (row.description === 'null') offenders.push(`${category} › ${row.name}`);
        }
      }

      expect(offenders).toEqual([]);
    },
  );

  /* ------------------------------------------------------------------ *
   * Status filter
   * ------------------------------------------------------------------ */

  it(title('The status filter offers All / Active / Inactive (TC-SVC-10)', Tag.REGRESSION), async () => {
    await onServiceCategory();

    expect(isOneOf(ServicesText.all, await servicesSettingsPage.statusFilterText())).toBe(true);
    const options = await servicesSettingsPage.openStatusFilter();
    expect(['All|Active|Inactive', 'Tất cả|Đang hoạt động|Ngưng hoạt động']).toContain(options.join('|'));

    await servicesSettingsPage.closeAnything();
  });

  it(
    title(
      'Filter Inactive leaves only inactive rows, with an empty state when none — known bug (TC-SVC-11)',
      Tag.REGRESSION,
    ),
    async () => {
      await onServiceCategory();

      try {
        await servicesSettingsPage.chooseStatusFilter(ServicesText.inactive);
        const rows = await servicesSettingsPage.rows();

        expect(rows.every((row) => !row.switchOn)).toBe(true);
        // The doc records "header only, no message" as a bug; the correct
        // screen says so when the filter matches nothing.
        if (rows.length === 0) expect(await servicesSettingsPage.isEmptyStateShown()).toBe(true);
      } finally {
        await servicesSettingsPage.chooseStatusFilter(ServicesText.all);
      }
    },
  );

  it(title('Switching the filter back to All restores the rows (TC-SVC-12)', Tag.REGRESSION), async () => {
    await onServiceCategory();
    const initial = await servicesSettingsPage.rowCount();

    await servicesSettingsPage.chooseStatusFilter(ServicesText.inactive);
    await servicesSettingsPage.chooseStatusFilter(ServicesText.all);

    expect(await servicesSettingsPage.rowCount()).toBe(initial);
  });

  /* ------------------------------------------------------------------ *
   * Create / Update Category — never submitted
   * ------------------------------------------------------------------ */

  it(
    title('Create Category opens with every field and Create disabled (TC-SVC-13)', Tag.REGRESSION),
    async () => {
      await servicesSettingsPage.openCreateCategory();

      expect(isOneOf(ServicesText.createCategory, await servicesSettingsPage.dialogTitle())).toBe(true);
      expect(
        isOneOf(ServicesText.categoryNamePlaceholder, await servicesSettingsPage.dialogNamePlaceholder()),
      ).toBe(true);
      expect(await servicesSettingsPage.dialogSwitchStates()).toEqual([true]);
      expect(await servicesSettingsPage.dialogText()).toMatch(/Active|Đang hoạt động/);
      expect(await servicesSettingsPage.dialogSwatchCount()).toBe(20);
      expect(await servicesSettingsPage.isSubmitEnabled('create')).toBe(false);

      await servicesSettingsPage.closeDialogWithEscape();
    },
  );

  it(title('Typing a name enables Create (TC-SVC-14)', Tag.REGRESSION), async () => {
    await servicesSettingsPage.openCreateCategory();

    await servicesSettingsPage.typeDialogName(`${QA_PREFIX}probe`);
    expect(await servicesSettingsPage.isSubmitEnabled('create')).toBe(true);

    await servicesSettingsPage.closeDialogWithEscape();
  });

  it(
    title('Escape closes Create Category without creating anything (TC-SVC-15)', Tag.REGRESSION),
    async () => {
      const name = `${QA_PREFIX}escape-probe`;
      await servicesSettingsPage.openCreateCategory();
      await servicesSettingsPage.typeDialogName(name);

      await servicesSettingsPage.closeDialogWithEscape();

      expect(await servicesSettingsPage.isDialogOpen()).toBe(false);
      expect(await servicesSettingsPage.categoryNames()).not.toContain(name);
    },
  );

  it(
    title(
      'Update Category is prefilled and Update stays disabled until a change (TC-SVC-16)',
      Tag.REGRESSION,
    ),
    async () => {
      await servicesSettingsPage.openUpdateCategory(serviceCategory);

      expect(isOneOf(ServicesText.updateCategory, await servicesSettingsPage.dialogTitle())).toBe(true);
      expect(await servicesSettingsPage.dialogNameValue()).toBe(serviceCategory);
      expect(await servicesSettingsPage.dialogSwitchStates()).toEqual([true]);
      expect(await servicesSettingsPage.isSubmitEnabled('update')).toBe(false);

      await servicesSettingsPage.closeDialogWithEscape();
    },
  );

  it(title('Update Category offers no delete action (TC-SVC-17)', Tag.REGRESSION), async () => {
    await servicesSettingsPage.openUpdateCategory(serviceCategory);

    const labels = await servicesSettingsPage.dialogButtonLabels();
    expect(labels.filter((label) => /delete|remove|xoá|xóa/i.test(label))).toEqual([]);
    // What IS there: Update, Close and the (nameless) colour swatches.
    expect(labels.some((label) => isOneOf(ServicesText.update, label))).toBe(true);
    expect(labels.some((label) => isOneOf(ServicesText.close, label))).toBe(true);

    await servicesSettingsPage.closeDialogWithEscape();
  });

  /* ------------------------------------------------------------------ *
   * Add New Item (service) — never submitted
   * ------------------------------------------------------------------ */

  it(
    title('Add New Item (service) shows every field, Add disabled (TC-SVC-18)', Tag.REGRESSION),
    async () => {
      await onServiceCategory();
      await servicesSettingsPage.openAddItem();

      expect(isOneOf(ServicesText.addNewItem, await servicesSettingsPage.dialogTitle())).toBe(true);
      expect(isOneOf(ServicesText.enterServiceName, await servicesSettingsPage.dialogNamePlaceholder())).toBe(
        true,
      );
      expect(await servicesSettingsPage.hasDialogField('price')).toBe(true);
      expect(await servicesSettingsPage.hasDialogField('supplyFee')).toBe(true);
      expect(await servicesSettingsPage.hasDialogField('description')).toBe(true);
      expect(await servicesSettingsPage.isFlexiblePricingChecked()).toBe(true);

      // Category (prefilled with the open category) + the two duration selects.
      const combos = await servicesSettingsPage.dialogComboboxTexts();
      expect(combos).toHaveLength(3);
      expect(combos[0]).toBe(serviceCategory);
      expect(combos[1]).toMatch(/^0\b/);
      expect(combos[2]).toMatch(/^0\b/);

      // Visibility: Active, Web Booking, Go Checkin, Go POS — all ON.
      expect(await servicesSettingsPage.dialogSwitchStates()).toEqual([true, true, true, true]);
      expect(await servicesSettingsPage.isSubmitEnabled('add')).toBe(false);

      await servicesSettingsPage.closeDialogWithEscape();
    },
  );

  it(
    title('Flexible Pricing is on by default and locks the price at $0.00 (TC-SVC-19)', Tag.REGRESSION),
    async () => {
      await onServiceCategory();
      await servicesSettingsPage.openAddItem();

      expect(await servicesSettingsPage.isFlexiblePricingChecked()).toBe(true);
      expect(await servicesSettingsPage.isPriceDisabled()).toBe(true);
      expect(await servicesSettingsPage.priceValue()).toBe('$0.00');

      await servicesSettingsPage.closeDialogWithEscape();
    },
  );

  it(title('Unticking Flexible Pricing unlocks the price field (TC-SVC-20)', Tag.REGRESSION), async () => {
    await onServiceCategory();
    await servicesSettingsPage.openAddItem();

    await servicesSettingsPage.toggleFlexiblePricing();

    expect(await servicesSettingsPage.isFlexiblePricingChecked()).toBe(false);
    expect(await servicesSettingsPage.isPriceDisabled()).toBe(false);
    expect(await servicesSettingsPage.priceValue()).toBe('$0.00');

    await servicesSettingsPage.closeDialogWithEscape();
  });

  it(
    title('Add enables with only a name and a $0.00 price — validation gap (TC-SVC-21)', Tag.REGRESSION),
    async () => {
      await onServiceCategory();
      await servicesSettingsPage.openAddItem();
      await servicesSettingsPage.toggleFlexiblePricing();

      await servicesSettingsPage.typeDialogName(`${QA_PREFIX}probe service`);

      // Documents today's behaviour (⚠️ in the doc): Add is enabled although the
      // price is still $0.00 with flexible pricing OFF. Never pressed.
      expect(await servicesSettingsPage.priceValue()).toBe('$0.00');
      expect(await servicesSettingsPage.isSubmitEnabled('add')).toBe(true);

      await servicesSettingsPage.closeDialogWithEscape();
    },
  );

  it(title('Escape cancels Add New Item and adds no row (TC-SVC-22)', Tag.REGRESSION), async () => {
    await onServiceCategory();
    const before = await servicesSettingsPage.rowCount();
    const name = `${QA_PREFIX}escape service`;

    await servicesSettingsPage.openAddItem();
    await servicesSettingsPage.toggleFlexiblePricing();
    await servicesSettingsPage.typeDialogName(name);
    await servicesSettingsPage.closeDialogWithEscape();

    expect(await servicesSettingsPage.isDialogOpen()).toBe(false);
    const rows = await servicesSettingsPage.rows();
    expect(rows).toHaveLength(before);
    expect(rows.map((row) => row.name)).not.toContain(name);
  });

  /* ------------------------------------------------------------------ *
   * Update Service — never submitted
   * ------------------------------------------------------------------ */

  it(title('Update Service is prefilled and Update stays disabled (TC-SVC-23)', Tag.REGRESSION), async () => {
    await onServiceCategory();
    const row = await firstPricedRow();

    await servicesSettingsPage.openEditRow(row.index);

    expect(isOneOf(ServicesText.updateService, await servicesSettingsPage.dialogTitle())).toBe(true);
    expect(await servicesSettingsPage.dialogNameValue()).toBe(row.name);
    expect(await servicesSettingsPage.priceValue()).toBe(row.price);
    expect(await servicesSettingsPage.supplyFeeValue()).toMatch(/^\$[\d,]+\.\d{2}$/);
    // A row with a fixed positive price is not flexible-priced.
    expect(await servicesSettingsPage.isFlexiblePricingChecked()).toBe(false);
    expect(await servicesSettingsPage.isSubmitEnabled('update')).toBe(false);

    await servicesSettingsPage.closeDialogWithEscape();
  });

  it(title('The price field drops letters and the minus sign (TC-SVC-24)', Tag.REGRESSION), async () => {
    await onServiceCategory();
    await servicesSettingsPage.openEditRow((await firstPricedRow()).index);

    await servicesSettingsPage.appendToPrice('abc-45x6');

    const value = await servicesSettingsPage.priceValue();
    expect(value).not.toMatch(/[a-zA-Z]/);
    expect(value).not.toContain('-');
    expect(value).toMatch(/\d/);

    await servicesSettingsPage.closeDialogWithEscape();
  });

  it(title('The price field clamps at $10,000.00 (TC-SVC-25)', Tag.REGRESSION), async () => {
    await onServiceCategory();
    await servicesSettingsPage.openEditRow((await firstPricedRow()).index);

    await servicesSettingsPage.replacePrice('987654321');

    expect(await servicesSettingsPage.priceValue()).toBe('$10,000.00');

    await servicesSettingsPage.closeDialogWithEscape();
  });

  it(
    title('Escape discards the price edit; the row keeps its price (TC-SVC-26)', Tag.REGRESSION),
    async () => {
      await onServiceCategory();
      const row = await firstPricedRow();

      await servicesSettingsPage.openEditRow(row.index);
      await servicesSettingsPage.replacePrice('987654321');
      expect(await servicesSettingsPage.priceValue()).toBe('$10,000.00');
      await servicesSettingsPage.closeDialogWithEscape();

      expect(await servicesSettingsPage.isDialogOpen()).toBe(false);
      const after = (await servicesSettingsPage.rows())[row.index];
      expect(after?.name).toBe(row.name);
      expect(after?.price).toBe(row.price);
    },
  );

  /* ------------------------------------------------------------------ *
   * Reorder dialog — read only (a drag would save immediately)
   * ------------------------------------------------------------------ */

  it(
    title('The Reorder dialog has the Category and All services tabs (TC-SVC-27)', Tag.REGRESSION),
    async () => {
      await servicesSettingsPage.openReorder();

      expect(isOneOf(ServicesText.reorder, await servicesSettingsPage.dialogTitle())).toBe(true);
      const tabs = await servicesSettingsPage.reorderTabs();
      expect(tabs.map((tab) => tab.label)).toHaveLength(2);
      expect(isOneOf(ServicesText.category, tabs[0]?.label ?? '')).toBe(true);
      expect(tabs[0]?.selected).toBe(true);
      expect(isOneOf(ServicesText.allServices, tabs[1]?.label ?? '')).toBe(true);

      await servicesSettingsPage.closeDialogWithEscape();
    },
  );

  it(title('The Category tab pins Quick Pay and Gift Card first (TC-SVC-28)', Tag.REGRESSION), async () => {
    await servicesSettingsPage.openReorder();
    const cards = await servicesSettingsPage.reorderCards();

    const [first, second, ...rest] = cards;
    expect(isOneOf(ServicesText.quickPay, first?.name ?? '')).toBe(true);
    expect(isOneOf(ServicesText.giftCard, second?.name ?? '')).toBe(true);
    for (const pinned of [first, second]) {
      expect({ name: pinned?.name, count: pinned?.count, draggable: pinned?.draggable }).toEqual({
        name: pinned?.name,
        count: null,
        draggable: false,
      });
    }
    expect(rest.length).toBeGreaterThan(0);
    for (const card of rest) {
      expect({ name: card.name, count: card.count }).toEqual({
        name: card.name,
        count: expect.stringMatching(/\d+/),
      });
    }

    await servicesSettingsPage.closeDialogWithEscape();
  });

  // ⚠️ in the doc: Reorder listed 11 vs 13 in the panel ("empty categories
  // hidden?"). On 1.1.56 that gap is the PREVIEW row, which drops empty
  // categories; the draggable GRID lists every one. (The sidebar list is
  // virtualised, so its DOM count is not a usable total.)
  it(
    title(
      'Reorder preview hides empty categories; the grid lists them all — count gap (TC-SVC-29)',
      Tag.REGRESSION,
    ),
    async () => {
      await servicesSettingsPage.openReorder();
      const pinned = (await servicesSettingsPage.reorderCards('preview')).slice(0, 2);
      const preview = (await servicesSettingsPage.reorderCards('preview')).slice(2);
      const grid = await servicesSettingsPage.reorderCards('grid');
      await servicesSettingsPage.closeDialogWithEscape();

      expect(pinned.every((card) => card.count === null)).toBe(true);
      expect(preview.length).toBeGreaterThan(0);
      expect(preview.length).toBeLessThanOrEqual(grid.length);
      const isEmpty = (count: string | null): boolean => count !== null && /^0 /.test(count);
      expect(preview.filter((card) => isEmpty(card.count))).toEqual([]);
      const gridNames = grid.map((card) => card.name);
      for (const card of preview) expect(gridNames).toContain(card.name);
    },
  );

  it(
    title('The Reorder service count matches the category table rows (TC-SVC-30)', Tag.REGRESSION),
    async () => {
      await servicesSettingsPage.openReorder();
      const card = (await servicesSettingsPage.reorderCards()).find((c) => c.name === serviceCategory);
      await servicesSettingsPage.closeDialogWithEscape();

      expect(card?.count).toMatch(/\d+/);
      const reorderCount = Number((card?.count ?? '').match(/\d+/)?.[0] ?? NaN);

      await onServiceCategory();
      expect(await servicesSettingsPage.rowCount()).toBe(reorderCount);
    },
  );

  it(
    title('The All services tab is a 4-column grid of coloured, draggable cards (TC-SVC-31)', Tag.REGRESSION),
    async () => {
      await servicesSettingsPage.openReorder();
      await servicesSettingsPage.selectReorderTab(ServicesText.allServices);

      const cards = await servicesSettingsPage.reorderCards('grid');
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards.slice(0, 8)) {
        expect({
          name: card.name,
          price: card.subtitle,
          draggable: card.draggable,
          colored: card.colored,
        }).toEqual({
          name: card.name,
          price: expect.stringMatching(/\$[\d,]+\.\d{2}/),
          draggable: true,
          colored: true,
        });
      }
      expect(await servicesSettingsPage.reorderGridColumns()).toBe(4);

      await servicesSettingsPage.closeDialogWithEscape();
    },
  );

  it(title('The Reorder dialog has no Save button (TC-SVC-32)', Tag.REGRESSION), async () => {
    await servicesSettingsPage.openReorder();

    const labels = await servicesSettingsPage.dialogButtonLabels();
    expect(labels.filter((label) => /^(save|lưu|apply|áp dụng)$/i.test(label))).toEqual([]);

    await servicesSettingsPage.closeDialogWithEscape();
  });

  /* ------------------------------------------------------------------ *
   * Product category
   * ------------------------------------------------------------------ */

  it(title('The Product category is titled "Products" (TC-SVC-33)', Tag.REGRESSION), async () => {
    await onProductCategory();

    expect(isOneOf(ServicesText.products, await servicesSettingsPage.detailHeading())).toBe(true);
  });

  it(title('The product table has its own columns (TC-SVC-34)', Tag.REGRESSION), async () => {
    await onProductCategory();

    const headers = await servicesSettingsPage.tableHeaders();
    expect([ServicesText.productColumnsEn.join('|'), ServicesText.productColumnsVi.join('|')]).toContain(
      headers.join('|'),
    );
  });

  it(title('Product rows show their real description (TC-SVC-35)', Tag.REGRESSION), async () => {
    await onProductCategory();

    const rows = await servicesSettingsPage.rows();
    expect(rows.length).toBeGreaterThan(0);
    const gel = rows.find((row) => row.name === 'Gel Manicure');
    if (gel) {
      // The doc's own fixture row, when this merchant has it.
      expect(gel.description).toBe('Gel nail polish');
    } else {
      expect(rows.some((row) => row.description !== '' && row.description !== 'null')).toBe(true);
    }
  });

  it(
    title('Add New Item (product) shows the product variant, Add disabled (TC-SVC-36)', Tag.REGRESSION),
    async () => {
      await onProductCategory();
      await servicesSettingsPage.openAddItem();

      expect(isOneOf(ServicesText.addNewItem, await servicesSettingsPage.dialogTitle())).toBe(true);
      expect(isOneOf(ServicesText.enterProductName, await servicesSettingsPage.dialogNamePlaceholder())).toBe(
        true,
      );
      expect(await servicesSettingsPage.isPriceDisabled()).toBe(true);
      expect(await servicesSettingsPage.isFlexiblePricingChecked()).toBe(true);
      expect(await servicesSettingsPage.hasDialogField('description')).toBe(true);
      // No category select, no duration, no supply fee; one visibility switch.
      expect(await servicesSettingsPage.dialogComboboxTexts()).toEqual([]);
      expect(await servicesSettingsPage.hasDialogField('supplyFee')).toBe(false);
      expect(await servicesSettingsPage.dialogSwitchStates()).toEqual([true]);
      expect(await servicesSettingsPage.isSubmitEnabled('add')).toBe(false);

      await servicesSettingsPage.closeDialogWithEscape();
    },
  );

  it(
    title('Two tables stay mounted after switching category; one is displayed (TC-SVC-37)', Tag.REGRESSION),
    async () => {
      await onServiceCategory();
      await servicesSettingsPage.openCategory(PRODUCT_CATEGORY);

      const { total, visible } = await servicesSettingsPage.tableCounts();
      expect(total).toBeGreaterThanOrEqual(2);
      expect(visible).toBe(1);
    },
  );
});
