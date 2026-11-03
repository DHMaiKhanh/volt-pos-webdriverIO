import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../configs/env/loadEnv.js';
import {
  DEFAULT_CATEGORY_HEX,
  QA_CATEGORY_PREFIX,
  STAFF_PALETTE_HEX,
} from '../../src/constants/testids.vp-palette.js';
import { type ApiCategory, portalServicesPage } from '../../src/pages/web/PortalServicesPage.js';
import { Tag, title } from '../../src/types/testTags.js';
import { toHex } from '../../src/utils/color.js';

/**
 * Fastboy Portal half of VP-5338 (category palette = staff palette, fastboy-portal#934)
 * + the Portal check of VP-5483 (legacy categories remapped).
 *
 * Test cases: docs/qc/volt-qc/vp-tickets/VP-5338-category-staff-palette-test-cases.md
 * (TC-VP5338-01..07, TC-VP5338-20). The POS cases live in
 * tests/regression/settings/vp-5338-category-staff-palette.spec.ts.
 *
 * ## Writes
 *
 * TC-03 creates ONE category `QC VP5338 Portal <rand>` (Mint), TC-05 recolours it
 * Yellow. The Portal offers no category Delete (row menu = Move… / Edit only), so
 * `after()` switches it Inactive — it leaves the Active list and never reaches POS Home.
 *
 * ## Data-dependent cases
 *
 * TC-06 / TC-07 / TC-20 pick their category from the Portal's own API (`colorHex`
 * as stored), because the list renders a colourless category as a Peach dot. A
 * merchant with no such category skips the case with the reason.
 *
 * Runs in Edge on the signed-in `.portal-profile/`: `npm run portal:vp-5338`.
 */

const MINT = '#83F0CC'; // Portal "Mint" = POS "Teal"
const YELLOW = '#F8D885';

/** Every category this spec creates starts with this — `after()` sweeps them Inactive. */
const PORTAL_PREFIX = `${QA_CATEGORY_PREFIX} Portal `;

/** Names that occur exactly once in `rows` — the list is reached by name, so duplicates are ambiguous. */
function uniqueByName(rows: ApiCategory[]): ApiCategory[] {
  const count = new Map<string, number>();
  for (const r of rows) count.set(r.name.trim(), (count.get(r.name.trim()) ?? 0) + 1);
  return rows.filter((r) => count.get(r.name.trim()) === 1);
}

const inPalette = (hex: string | null): boolean => STAFF_PALETTE_HEX.includes(toHex(hex));

/* eslint-disable no-console -- the web lanes report what they did on stdout, like portal-earn-on-tip.spec.ts */
describe('Portal — VP-5338 Category palette = Staff palette (+ VP-5483)', () => {
  const created = `${PORTAL_PREFIX}${Math.random().toString(36).slice(2, 7)}`;
  let createdOk = false;

  afterEach(async () => {
    await portalServicesPage.cancel().catch(() => undefined);
  });

  after(async () => {
    // No Delete on the Portal → park every ACTIVE category this spec made (this run's and
    // any a crashed run left) in Inactive.
    await portalServicesPage.open();
    const leftovers = (await portalServicesPage.apiCategories())
      .filter((c) => c.status === 'active' && c.name.startsWith(PORTAL_PREFIX))
      .map((c) => c.name);
    for (const name of leftovers) {
      await portalServicesPage.open();
      await portalServicesPage.openEditCategory(name);
      await portalServicesPage.setActive(false);
      await portalServicesPage.submit();
      console.log(`[portal] "${name}" switched Inactive (the Portal cannot delete a category)`);
    }
  });

  /* ------------------------------------------------------------------ *
   * 1. Portal — New / Edit category
   * ------------------------------------------------------------------ */

  it(title('TC-VP5338-01: Portal New category palette = New staff palette', Tag.REGRESSION), async () => {
    await portalServicesPage.open();
    await portalServicesPage.openNewCategory();
    expect(await portalServicesPage.dialogTitle()).toBe('New category');
    const category = await portalServicesPage.swatches();
    await portalServicesPage.cancel();

    await portalServicesPage.openNewStaff();
    expect(await portalServicesPage.dialogTitle()).toBe('New staff');
    const staff = await portalServicesPage.swatches();
    await portalServicesPage.cancel();

    expect(category.map((s) => s.hex)).toEqual([...STAFF_PALETTE_HEX]);
    expect(category.map((s) => `${s.name} ${s.hex}`)).toEqual(staff.map((s) => `${s.name} ${s.hex}`));
  });

  it(title('TC-VP5338-02: Portal New category defaults to Peach', Tag.REGRESSION), async () => {
    await portalServicesPage.open();
    await portalServicesPage.openNewCategory();
    const checked = (await portalServicesPage.swatches()).filter((s) => s.checked);
    expect(checked.map((s) => s.hex)).toEqual([DEFAULT_CATEGORY_HEX]);
  });

  it(
    title('TC-VP5338-03: Portal creates a category in a staff colour (Mint)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      assertWritesAllowed('create a category on the Portal');
      await portalServicesPage.open();
      await portalServicesPage.openNewCategory();
      await portalServicesPage.setName(created);
      await portalServicesPage.pickColor(MINT);
      await portalServicesPage.submit();
      createdOk = true;

      expect((await portalServicesPage.categoryRow(created)).dotHex).toBe(MINT);
      const stored = (await portalServicesPage.apiCategories()).filter((c) => c.name === created);
      expect(stored.map((c) => toHex(c.colorHex))).toEqual([MINT]);
    },
  );

  it(title('TC-VP5338-04: Portal Edit preselects the saved colour', Tag.REGRESSION), async function () {
    if (!createdOk) this.skip();
    await portalServicesPage.open();
    await portalServicesPage.openEditCategory(created);
    expect(await portalServicesPage.dialogTitle()).toBe('Edit category');
    const swatches = await portalServicesPage.swatches();
    expect(swatches.map((s) => s.hex)).toEqual([...STAFF_PALETTE_HEX]);
    expect(swatches.filter((s) => s.checked).map((s) => s.hex)).toEqual([MINT]);
  });

  it(
    title('TC-VP5338-05: Portal recolours a category to Yellow', Tag.REGRESSION, Tag.WRITE),
    async function () {
      if (!createdOk) this.skip();
      assertWritesAllowed('recolour a category on the Portal');
      await portalServicesPage.open();
      await portalServicesPage.openEditCategory(created);
      await portalServicesPage.pickColor(YELLOW);
      await portalServicesPage.submit();

      await portalServicesPage.open();
      expect((await portalServicesPage.categoryRow(created)).dotHex).toBe(YELLOW);
      const stored = (await portalServicesPage.apiCategories()).filter((c) => c.name === created);
      expect(stored.map((c) => toHex(c.colorHex))).toEqual([YELLOW]);

      await portalServicesPage.openEditCategory(created);
      expect((await portalServicesPage.swatches()).filter((s) => s.checked).map((s) => s.hex)).toEqual([
        YELLOW,
      ]);
    },
  );

  it(title('TC-VP5338-06: Portal Edit of a legacy-colour category', Tag.REGRESSION), async function () {
    const all = await portalServicesPage.apiCategories();
    // After the VP-5483 remap no ACTIVE category keeps an off-palette colour; an inactive one may.
    const legacy = ['active', 'inactive']
      .flatMap((status) => uniqueByName(all.filter((c) => c.status === status)))
      .find((c) => toHex(c.colorHex) !== '' && !inPalette(c.colorHex));
    if (!legacy) {
      console.log('[portal] SKIP TC-06 — no category keeps a colour outside the staff palette');
      this.skip();
      return;
    }
    const legacyHex = toHex(legacy.colorHex);
    console.log(`[portal] TC-06 uses "${legacy.name}" (${legacy.status}, ${legacyHex})`);

    await portalServicesPage.open();
    if (legacy.status !== 'active') await portalServicesPage.showStatus('Inactive');
    await portalServicesPage.openEditCategory(legacy.name.trim());
    const swatches = await portalServicesPage.swatches();

    // The stored colour is its own first swatch, checked; then the 15 staff colours, all pickable.
    expect(swatches.map((s) => s.hex)).toEqual([legacyHex, ...STAFF_PALETTE_HEX]);
    expect(swatches.filter((s) => s.checked).map((s) => s.hex)).toEqual([legacyHex]);
    await portalServicesPage.pickColor(STAFF_PALETTE_HEX[1] ?? '');
    // cancel() in afterEach — nothing is saved.
  });

  it(title('TC-VP5338-07: Portal shows a colourless category in Peach', Tag.REGRESSION), async function () {
    const active = uniqueByName(
      (await portalServicesPage.apiCategories()).filter((c) => c.status === 'active'),
    );
    const colourless = active
      .filter((c) => c.colorHex === null || toHex(c.colorHex) === '')
      .map((c) => c.name.trim());
    if (colourless.length === 0) {
      console.log('[portal] SKIP TC-07 — no active category with colorHex = null');
      this.skip();
      return;
    }

    await portalServicesPage.open();
    const rows = await portalServicesPage.categoryRows();
    const shown = rows.filter((r) => colourless.includes(r.name));
    expect(shown.length).toBeGreaterThan(0);
    console.log(
      `[portal] TC-07 checks ${String(shown.length)} colourless categories, e.g. "${shown[0]?.name ?? ''}"`,
    );
    // QC 02/11: the Portal falls back to Peach like POS (not #36BFF2 as the PR note said).
    expect(
      shown.filter((r) => r.dotHex !== DEFAULT_CATEGORY_HEX).map((r) => `${r.name} ${r.dotHex}`),
    ).toEqual([]);
  });

  /* ------------------------------------------------------------------ *
   * 4. VP-5483 — the Portal after the BE remap
   * ------------------------------------------------------------------ */

  it(title('TC-VP5338-20: Portal lists remapped categories in staff colours', Tag.REGRESSION), async () => {
    await portalServicesPage.open();
    const rows = await portalServicesPage.categoryRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.filter((r) => !STAFF_PALETTE_HEX.includes(r.dotHex)).map((r) => `${r.name} ${r.dotHex}`),
    ).toEqual([]);

    // Edit of a pre-VP-5338 category: no separate legacy swatch, its remapped colour checked.
    const remapped = uniqueByName(
      (await portalServicesPage.apiCategories()).filter((c) => c.status === 'active'),
    )
      .filter((c) => c.type === 'service') // a product category's row menu has no Edit
      .filter(
        (c) => inPalette(c.colorHex) && c.createdAt < '2026-11-02' && !c.name.startsWith(QA_CATEGORY_PREFIX),
      )
      .find((c) => rows.some((r) => r.name === c.name.trim()));
    expect(remapped).toBeDefined();
    if (!remapped) return;
    console.log(
      `[portal] TC-20: ${String(rows.length)} rows in palette; Edit "${remapped.name}" (${toHex(remapped.colorHex)})`,
    );

    await portalServicesPage.openEditCategory(remapped.name.trim());
    const swatches = await portalServicesPage.swatches();
    expect(swatches.map((s) => s.hex)).toEqual([...STAFF_PALETTE_HEX]);
    expect(swatches.filter((s) => s.checked).map((s) => s.hex)).toEqual([toHex(remapped.colorHex)]);
  });
});
