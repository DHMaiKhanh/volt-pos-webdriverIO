/**
 * VP-4039 — Menu service text in ink like the staff name (volt-pos PR #3133, build ≥ 1.1.58).
 *
 * Test cases: docs/qc/volt-qc/vp-tickets/VP-4039-menu-service-ink-text-test-cases.md
 * (TC-VP4039-01..08).
 *
 * The rule under test: the Home service tiles and category tiles (pinned Quick
 * Pay / Gift Card included) render their text in the SAME colour as the staff
 * nickname on the staff tiles (`text-ink`), never white — while the tile
 * background stays the category colour. Colours are read as computed styles in
 * one frame (`vp-4039.helpers.ts`) and the backgrounds are checked against the
 * schema (`query category`, Home's own document).
 *
 * TC-08 (request 2, Employees "Active" filter memory) was struck from the ticket
 * and is not in the PR — title-only PENDING.
 *
 * READ-ONLY: types into the service search and clears it; creates nothing.
 */

import { expect } from '@wdio/globals';
import { PINNED_TILE_HEX, PINNED_TILE_LABELS } from '../../../src/constants/testids.vp-palette.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { homePage } from '../../../src/pages/index.js';
import { appVersion, skipUnlessBuild, versionAtLeast } from '../../../src/support/appVersion.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { contrastRatio, WHITE_HEX } from '../../../src/utils/color.js';
import {
  homeCategories,
  readHomeColors,
  staffInk,
  type HomeColors,
  type TileColor,
} from './vp-4039.helpers.js';

const MIN_BUILD = '1.1.58';
const TICKET = 'VP-4039';

/** Backgrounds a dark-category case looks for — luminance below Peach's by a wide margin. */
const DARK_BG_CONTRAST_WITH_WHITE = 3;

let colors: HomeColors;
let ink = '';

/** Tiles whose text is not the staff ink, by name — empty string when all match. */
const offInk = (tiles: TileColor[]): string =>
  tiles
    .filter((t) => t.text !== ink || t.nameText !== ink)
    .map((t) => `"${t.name}" text=${t.text} name=${t.nameText}`)
    .join(', ');

async function backHome(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  await homePage.clearSearches();
}

describe('VP-4039 — Menu service text in ink like the staff name', () => {
  before(async () => {
    await backHome();
    colors = await step('Read Home tile colours', () => readHomeColors());
    ink = staffInk(colors.staff);
  });

  beforeEach(async function (this: Mocha.Context): Promise<void> {
    // TC-01 IS the build check — it must fail, not skip, on an old build.
    if (this.currentTest?.title.includes('TC-VP4039-01') === true) return;
    await skipUnlessBuild(this, MIN_BUILD, TICKET);
  });

  after(backHome);

  it(title('TC-VP4039-01: the installed build carries the fix (≥ 1.1.58)', Tag.REGRESSION), async () => {
    const version = await appVersion();
    expect(version).not.toBe('');
    expect(versionAtLeast(version, MIN_BUILD)).toBe(true);
  });

  it(title('TC-VP4039-02: service tiles show name, description and price in ink', Tag.REGRESSION), () => {
    expect(colors.services.length).toBeGreaterThan(0);
    expect(ink).not.toBe('');
    expect(ink).not.toBe(WHITE_HEX);
    expect(offInk(colors.services)).toBe('');
    const whitePrice = colors.services.filter((t) => t.lastLineText === WHITE_HEX).map((t) => t.name);
    expect(whitePrice).toEqual([]);
  });

  it(
    title('TC-VP4039-03: category tiles (Quick Pay and Gift Card included) show text in ink', Tag.REGRESSION),
    () => {
      expect(colors.categories.length).toBeGreaterThan(0);
      expect(offInk(colors.categories)).toBe('');
      const names = colors.categories.map((c) => c.name);
      expect(names.some((n) => (PINNED_TILE_LABELS.quickPay as readonly string[]).includes(n))).toBe(true);
    },
  );

  it(title('TC-VP4039-04: service text uses the same colour as the staff name', Tag.REGRESSION), () => {
    const serviceColors = [...new Set(colors.services.map((t) => t.text))];
    expect(serviceColors).toEqual([ink]);
  });

  it(title('TC-VP4039-05: service search results are also in ink', Tag.REGRESSION), async function () {
    const term = (colors.services[0]?.name ?? '').split(/\s+/)[0] ?? '';
    if (term.length < 3) this.skip();
    await homePage.searchService(term);
    const results = (await readHomeColors()).services;
    await homePage.clearSearches();
    expect(results.length).toBeGreaterThan(0);
    expect(offInk(results)).toBe('');
  });

  it(
    title('TC-VP4039-06: ink text on a dark category tile (needs a dark category)', Tag.REGRESSION),
    function () {
      // Only categories still on a legacy dark colour qualify (VP-5338 remaps them).
      const dark = colors.categories.filter(
        (c) => c.background !== '' && contrastRatio(c.background, WHITE_HEX) >= DARK_BG_CONTRAST_WITH_WHITE,
      );
      if (dark.length === 0) this.skip();
      for (const tile of dark) {
        // eslint-disable-next-line no-console
        console.log(
          `[${TICKET}] dark tile "${tile.name}" ${tile.background}: ink contrast ` +
            contrastRatio(tile.background, ink).toFixed(2),
        );
      }
      expect(offInk(dark)).toBe('');
    },
  );

  it(title('TC-VP4039-07: tile backgrounds still carry the category colour', Tag.REGRESSION), async () => {
    const rows = await homeCategories();
    // Category names may repeat (dev has two "test color 2"), so a name maps to every stored colour.
    const byName = new Map<string, Set<string>>();
    for (const r of rows) {
      const name = (r.name ?? '').trim();
      if (!r.colorHex) continue;
      byName.set(name, (byName.get(name) ?? new Set()).add(r.colorHex.toUpperCase()));
    }
    const mismatches: string[] = [];
    for (const tile of colors.categories) {
      const allowed = new Set<string>(byName.get(tile.name) ?? []);
      // The pinned tiles come from constants; a stored "Gift Card" row may ALSO render its own tile.
      if ((PINNED_TILE_LABELS.quickPay as readonly string[]).includes(tile.name))
        allowed.add(PINNED_TILE_HEX.quickPay);
      if ((PINNED_TILE_LABELS.giftCard as readonly string[]).includes(tile.name))
        allowed.add(PINNED_TILE_HEX.giftCard);
      // A null colour falls back to the default — checked by VP-5338, not here.
      if (allowed.size === 0) continue;
      if (!allowed.has(tile.background)) {
        mismatches.push(`"${tile.name}" bg=${tile.background} expected ${[...allowed].join('/')}`);
      }
    }
    expect(mismatches).toEqual([]);
    // And the service tiles are never white-on-white or transparent.
    expect(colors.services.filter((t) => t.background === '' || t.background === WHITE_HEX).length).toBe(0);
  });

  it(
    title(
      'TC-VP4039-08: Settings/Employees remembers the Active filter — PENDING ' +
        '(request 2 struck from the ticket, not in PR #3133)',
      Tag.REGRESSION,
    ),
  );
});
