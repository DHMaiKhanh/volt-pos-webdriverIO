/**
 * VP-5338 — Category colours use the Staff palette (Portal #934, POS volt-pos #3273,
 * BE remap command volt-pos-api #1609) + sub-bug VP-5483 (legacy categories not remapped).
 *
 * Test cases: docs/qc/volt-qc/vp-tickets/VP-5338-category-staff-palette-test-cases.md
 * (TC-VP5338-01..21).
 *
 * ## What runs here
 *
 * - Settings → Services Create / Update Category dialogs (TC-08..14): the swatch
 *   set and order are read from the dialog and compared with `staffHexColors`;
 *   the saved colour is read back through the app's own GraphQL (`categoryList`).
 * - Home category tiles (TC-15..17): rendered background vs `category.colorHex`.
 * - VP-5483 (TC-18): every active category's stored colour is in the staff palette.
 *
 * Portal cases (TC-01..07, TC-20) live in tests/web/portal-vp-5338-category-palette.spec.ts
 * (web lane, `npm run portal:vp-5338`); the BE command re-run is title-only PENDING. Android is out of scope for this Windows suite.
 *
 * ## Writes
 *
 * TC-10 creates ONE category `QC VP5338 <rand>` and TC-12 recolours it. POS
 * cannot delete a category, so each run leaves one (0 services → never on Home).
 *
 * ## Remap cases
 *
 * TC-17 / TC-18 assert the remapped state (VP-5483). The BE command ran on dev
 * 2026-11-02; a store whose categories were not remapped fails them.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { gql } from '../../../src/api/index.js';
import { ServicesText } from '../../../src/constants/testids.settings-services.js';
import {
  DEFAULT_CATEGORY_HEX,
  LEGACY_CATEGORY_HEX,
  PINNED_TILE_LABELS,
  QA_CATEGORY_PREFIX,
  STAFF_PALETTE_HEX,
} from '../../../src/constants/testids.vp-palette.js';
import { goToSettings, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import servicesSettingsPage from '../../../src/pages/settings/ServicesSettingsPage.js';
import settingsPage from '../../../src/pages/settings/SettingsPage.js';
import { categoryPaletteDialog } from '../../../src/pages/voltqc/vp-palette/CategoryPaletteDialog.js';
import { skipUnlessBuild } from '../../../src/support/appVersion.js';
import { ensurePasscodeGrant } from '../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { toHex, WHITE_HEX } from '../../../src/utils/color.js';
import { homeCategories, readHomeColors } from '../home/vp-4039.helpers.js';

const TICKET = 'VP-5338';
/** First POS build with PR #3273 (1.1.87 was built before the merge). */
const MIN_BUILD = '1.1.88';

const TEAL = '#83F0CC'; // the Portal calls it "Mint"
const YELLOW = '#F8D885';

interface CategoryRow {
  id: string;
  name: string | null;
  colorHex: string | null;
  status: string | null;
  type: string | null;
}

const ALL_CATEGORIES = `
  query vp5338Categories {
    categoryList(orderBy: [{ updatedAt: desc }]) {
      id
      name
      colorHex
      status
      type
    }
  }
`;

async function allCategories(): Promise<CategoryRow[]> {
  const data = await gql().query<{ categoryList: CategoryRow[] }>(ALL_CATEGORIES, {
    operationName: 'vp5338Categories',
  });
  return data.categoryList;
}

/** Poll the local schema until the named category carries `hex` (the save is async to the toast). */
async function waitForCategoryColor(name: string, hex: string): Promise<CategoryRow | undefined> {
  let row: CategoryRow | undefined;
  await browser
    .waitUntil(
      async () => {
        row = (await allCategories()).find((c) => c.name === name);
        return toHex(row?.colorHex) === hex;
      },
      { timeout: Timeouts.API, interval: 500 },
    )
    .catch(() => undefined);
  return row;
}

/** A stored colour the app renders as-is: a valid `#RRGGBB`. */
const validHex = (value: string | null): string => toHex(value);

const isPinnedLabel = (name: string): boolean =>
  (PINNED_TILE_LABELS.quickPay as readonly string[]).includes(name) ||
  (PINNED_TILE_LABELS.giftCard as readonly string[]).includes(name);

async function onServicesScreen(): Promise<void> {
  await servicesSettingsPage.closeAnything();
  if (!(await servicesSettingsPage.isActive())) {
    await goToSettings();
    await settingsPage.openSection('SERVICES');
  }
  await servicesSettingsPage.waitForReady(Timeouts.MEDIUM);
}

describe('VP-5338 — Category palette = Staff palette (+ VP-5483)', () => {
  /** The category TC-10 created (empty when TC-10 did not run). */
  let created = '';

  after(async () => {
    await servicesSettingsPage.closeAnything().catch(() => undefined);
    await ensurePasscodeGrant();
    await returnToHome();
  });

  // 1. Portal — TC-VP5338-01..07 run on the Portal web lane: tests/web/portal-vp-5338-category-palette.spec.ts (npm run portal:vp-5338).

  /* ------------------------------------------------------------------ *
   * 2. POS — Settings → Services dialogs
   * ------------------------------------------------------------------ */
  describe('2. POS Settings → Services', () => {
    before(async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await onServicesScreen();
    });

    beforeEach(async function (this: Mocha.Context): Promise<void> {
      await skipUnlessBuild(this, MIN_BUILD, TICKET);
      await onServicesScreen();
    });

    it(
      title('TC-VP5338-08: Create Category offers exactly the 15 staff colours, in order', Tag.REGRESSION),
      async () => {
        await servicesSettingsPage.openCreateCategory();
        const swatches = await categoryPaletteDialog.swatches();
        await servicesSettingsPage.closeDialogWithEscape();
        expect(swatches.map((s) => s.hex)).toEqual([...STAFF_PALETTE_HEX]);
        expect(swatches.filter((s) => LEGACY_CATEGORY_HEX.includes(s.hex))).toEqual([]);
      },
    );

    it(title('TC-VP5338-09: Create Category preselects Peach', Tag.REGRESSION), async () => {
      await servicesSettingsPage.openCreateCategory();
      const selected = await categoryPaletteDialog.selectedHex();
      await servicesSettingsPage.closeDialogWithEscape();
      expect(selected).toBe(DEFAULT_CATEGORY_HEX);
    });

    it(
      title('TC-VP5338-10: a category created in Teal is saved with #83F0CC', Tag.REGRESSION, Tag.WRITE),
      async () => {
        assertWritesAllowed('create a category on POS');
        const name = `${QA_CATEGORY_PREFIX} ${Date.now().toString(36).slice(-5)}`;
        await step(`Create category "${name}" in Teal`, async () => {
          await servicesSettingsPage.openCreateCategory();
          await servicesSettingsPage.typeDialogName(name);
          await categoryPaletteDialog.pick(TEAL);
          await categoryPaletteDialog.submit('create');
        });
        created = name;
        const row = await waitForCategoryColor(name, TEAL);
        expect(row?.name).toBe(name);
        expect(toHex(row?.colorHex)).toBe(TEAL);
      },
    );

    it(title('TC-VP5338-11: Update Category preselects the saved colour', Tag.REGRESSION), async function () {
      if (created === '') this.skip();
      await servicesSettingsPage.openUpdateCategory(created);
      const swatches = await categoryPaletteDialog.swatches();
      await servicesSettingsPage.closeDialogWithEscape();
      expect(swatches.map((s) => s.hex)).toEqual([...STAFF_PALETTE_HEX]);
      expect(swatches.find((s) => s.selected)?.hex).toBe(TEAL);
    });

    it(
      title(
        'TC-VP5338-12: recolouring to Yellow saves #F8D885 and reopens with Yellow',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        if (created === '') this.skip();
        assertWritesAllowed('recolour a category on POS');
        await step(`Recolour "${created}" to Yellow`, async () => {
          await servicesSettingsPage.openUpdateCategory(created);
          await categoryPaletteDialog.pick(YELLOW);
          await categoryPaletteDialog.submit('update');
        });
        const row = await waitForCategoryColor(created, YELLOW);
        expect(toHex(row?.colorHex)).toBe(YELLOW);

        await onServicesScreen();
        await servicesSettingsPage.openUpdateCategory(created);
        const selected = await categoryPaletteDialog.selectedHex();
        await servicesSettingsPage.closeDialogWithEscape();
        expect(selected).toBe(YELLOW);
      },
    );

    it(
      title(
        'TC-VP5338-13: a legacy-colour category shows its colour as an extra first swatch',
        Tag.REGRESSION,
      ),
      async function () {
        const listed = await servicesSettingsPage.categoryNames();
        const legacy = (await allCategories()).find(
          (c) =>
            c.status === 'active' &&
            c.name !== null &&
            listed.includes(c.name) &&
            validHex(c.colorHex) !== '' &&
            !STAFF_PALETTE_HEX.includes(validHex(c.colorHex)),
        );
        // After the BE remap (VP-5483) there is nothing off-palette left to open.
        if (!legacy?.name) this.skip();
        const name = legacy?.name ?? '';
        await servicesSettingsPage.openCategory(name).catch(() => undefined);
        await servicesSettingsPage.openUpdateCategory(name);
        const swatches = await categoryPaletteDialog.swatches();
        await servicesSettingsPage.closeDialogWithEscape();
        expect(swatches).toHaveLength(STAFF_PALETTE_HEX.length + 1);
        expect(swatches[0]).toEqual({ hex: validHex(legacy?.colorHex ?? null), selected: true });
        expect(swatches.slice(1).map((s) => s.hex)).toEqual([...STAFF_PALETTE_HEX]);
      },
    );

    it(title('TC-VP5338-14: Reorder dialog cards show ink text on both tabs', Tag.REGRESSION), async () => {
      await servicesSettingsPage.openReorder();
      const categoryTab = await categoryPaletteDialog.reorderCardColors();
      await servicesSettingsPage.selectReorderTab(ServicesText.allServices);
      const servicesTab = await categoryPaletteDialog.reorderCardColors();
      await servicesSettingsPage.closeDialogWithEscape();

      for (const [label, cards] of [
        ['Category', categoryTab],
        ['All services', servicesTab],
      ] as const) {
        expect(cards.length).toBeGreaterThan(0);
        const white = cards.filter((c) => c.text === WHITE_HEX).map((c) => `${label}: "${c.name}"`);
        expect(white).toEqual([]);
        expect(new Set(cards.map((c) => c.text)).size).toBe(1);
      }
    });
  });

  /* ------------------------------------------------------------------ *
   * 3. POS — Home tiles
   * ------------------------------------------------------------------ */
  describe('3. POS Home', () => {
    before(async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await servicesSettingsPage.closeAnything().catch(() => undefined);
      await returnToHome();
    });

    it(title('TC-VP5338-15: Home category tiles render their stored colour', Tag.REGRESSION), async () => {
      const [tiles, rows] = [(await readHomeColors()).categories, await homeCategories()];
      // Category names are not unique (dev has two "test color 2"), so a tile matches
      // any of the colours stored under its name.
      const byName = new Map<string, string[]>();
      for (const r of rows) {
        const key = (r.name ?? '').trim();
        byName.set(key, [...(byName.get(key) ?? []), validHex(r.colorHex) || DEFAULT_CATEGORY_HEX]);
      }
      const mismatches: string[] = [];
      for (const tile of tiles) {
        if (isPinnedLabel(tile.name)) continue;
        const expected = byName.get(tile.name);
        if (!expected) continue;
        if (!expected.includes(tile.background))
          mismatches.push(`"${tile.name}" bg=${tile.background} db=${expected.join('|')}`);
      }
      expect(tiles.length).toBeGreaterThan(0);
      expect(mismatches).toEqual([]);
    });

    it(
      title('TC-VP5338-16: a colourless category falls back to Peach on Home', Tag.REGRESSION),
      async function () {
        await skipUnlessBuild(this, MIN_BUILD, TICKET);
        const colourless = new Set(
          (await homeCategories())
            .filter((r) => validHex(r.colorHex) === '')
            .map((r) => (r.name ?? '').trim()),
        );
        const tiles = (await readHomeColors()).categories.filter(
          (t) => colourless.has(t.name) && !isPinnedLabel(t.name),
        );
        if (tiles.length === 0) this.skip();
        expect(tiles.filter((t) => t.background !== DEFAULT_CATEGORY_HEX).map((t) => t.name)).toEqual([]);
      },
    );

    it(
      title('TC-VP5338-17: every Home category tile is in the staff palette (VP-5483)', Tag.REGRESSION),
      async () => {
        const tiles = (await readHomeColors()).categories.filter((t) => !isPinnedLabel(t.name));
        expect(tiles.length).toBeGreaterThan(0);
        const offPalette = tiles
          .filter((t) => !STAFF_PALETTE_HEX.includes(t.background))
          .map((t) => `"${t.name}" ${t.background}`);
        expect(offPalette).toEqual([]);
      },
    );
  });

  /* ------------------------------------------------------------------ *
   * 4. VP-5483 — legacy categories remapped by the BE command
   * ------------------------------------------------------------------ */
  describe('4. VP-5483', () => {
    it(
      title('TC-VP5338-18: no active category keeps a colour outside the staff palette', Tag.REGRESSION),
      async () => {
        const offPalette = (await allCategories())
          .filter((c) => c.status === 'active' && validHex(c.colorHex) !== '')
          .filter((c) => !STAFF_PALETTE_HEX.includes(validHex(c.colorHex)))
          .map((c) => `"${c.name ?? c.id}" ${validHex(c.colorHex)}`);
        expect(offPalette).toEqual([]);
      },
    );

    it(
      title(
        'TC-VP5338-19: BE command re-run cleans categories re-created by old POS — PENDING (BE-only)',
        Tag.REGRESSION,
      ),
    );
    // TC-VP5338-20 runs on the Portal web lane: tests/web/portal-vp-5338-category-palette.spec.ts.
  });
});
