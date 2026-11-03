/**
 * Read-only colour probes of the Home "Menu service" panel for VP-4039 (and the
 * Home half of VP-5338): every tile's computed text colour and background, read
 * in ONE `browser.execute` so all values come from the same frame.
 *
 * Selectors come from `src/constants/testids.vp-palette.ts` (no testid exists on
 * the category tiles — see the evidence note there).
 */

import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { gql } from '../../../src/api/index.js';
import { PaletteCss } from '../../../src/constants/testids.vp-palette.js';
import { homePage } from '../../../src/pages/index.js';
import { toHex } from '../../../src/utils/color.js';

/** One coloured Home tile as rendered. Colours are upper-case `#RRGGBB`. */
export interface TileColor {
  name: string;
  /** Computed `color` of the tile (inherited by name / description / price). */
  text: string;
  /** Computed `color` of the name element itself. */
  nameText: string;
  /** Computed `color` of the last line (price on a service, count on a category). */
  lastLineText: string;
  background: string;
}

export interface StaffNameColor {
  name: string;
  text: string;
}

export interface HomeColors {
  services: TileColor[];
  categories: TileColor[];
  staff: StaffNameColor[];
}

/** Read the mounted service tiles, category tiles (every carousel page) and staff names. */
export async function readHomeColors(): Promise<HomeColors> {
  await homePage.waitForReady();
  // A data-dependent anchor: tiles exist only once the service query returned.
  await browser.waitUntil(
    async () =>
      browser.execute(
        (a: string, b: string) =>
          document.querySelectorAll(a).length + document.querySelectorAll(b).length > 0,
        PaletteCss.serviceTiles,
        PaletteCss.serviceTilesFallback,
      ),
    { timeout: Timeouts.MEDIUM, interval: 250, timeoutMsg: 'Home rendered no service tile' },
  );

  const raw = await browser.execute(
    (css: {
      serviceTiles: string;
      serviceTilesFallback: string;
      categoryTiles: string;
      staffTiles: string;
      staffTilesFallback: string;
    }) => {
      const color = (el: Element | null): string => (el ? window.getComputedStyle(el).color : '');
      const bg = (el: Element): string => window.getComputedStyle(el).backgroundColor;
      const textOf = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

      let serviceEls = Array.from(document.querySelectorAll(css.serviceTiles));
      if (serviceEls.length === 0)
        serviceEls = Array.from(document.querySelectorAll(css.serviceTilesFallback));
      const services = serviceEls.map((tile) => {
        const name = tile.firstElementChild?.firstElementChild ?? tile.firstElementChild;
        return {
          name: textOf(name),
          text: color(tile),
          nameText: color(name),
          lastLineText: color(tile.lastElementChild),
          background: bg(tile),
        };
      });

      const categories = Array.from(document.querySelectorAll(css.categoryTiles))
        .filter((tile) => tile.querySelector('h3') !== null)
        .map((tile) => {
          const h3 = tile.querySelector('h3');
          return {
            name: textOf(h3),
            text: color(tile),
            nameText: color(h3),
            lastLineText: color(tile.lastElementChild),
            background: bg(tile),
          };
        });

      let staffEls = Array.from(document.querySelectorAll(css.staffTiles));
      if (staffEls.length === 0) staffEls = Array.from(document.querySelectorAll(css.staffTilesFallback));
      const staff = staffEls
        .map((tile) => tile.querySelector('span'))
        .filter((span): span is HTMLSpanElement => span !== null)
        .map((span) => ({ name: textOf(span), text: color(span) }));

      return { services, categories, staff };
    },
    {
      serviceTiles: PaletteCss.serviceTiles,
      serviceTilesFallback: PaletteCss.serviceTilesFallback,
      categoryTiles: PaletteCss.categoryTiles,
      staffTiles: PaletteCss.staffTiles,
      staffTilesFallback: PaletteCss.staffTilesFallback,
    },
  );

  const hexTile = (t: TileColor): TileColor => ({
    name: t.name,
    text: toHex(t.text),
    nameText: toHex(t.nameText),
    lastLineText: toHex(t.lastLineText),
    background: toHex(t.background),
  });
  return {
    services: raw.services.map(hexTile),
    categories: raw.categories.map(hexTile),
    staff: raw.staff.map((s) => ({ name: s.name, text: toHex(s.text) })),
  };
}

/**
 * The staff-name ink: the most common nickname colour across the staff tiles.
 * The SELECTED tile paints its name white on the selection band, so a plain
 * "first tile" read could pick the exception.
 */
export function staffInk(staff: StaffNameColor[]): string {
  const counts = new Map<string, number>();
  for (const s of staff) if (s.text !== '') counts.set(s.text, (counts.get(s.text) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/** Home's own category query (`home/-service/service.gql.ts` → `query category`). */
const HOME_CATEGORIES = `
  query category {
    categoryList(
      where: { status: { eq: "active" }, type: { in: ["service", "product"] } }
      orderBy: [{ createdAt: desc }]
    ) {
      id
      name
      colorHex
      type
    }
  }
`;

export interface HomeCategoryRow {
  id: string;
  name: string | null;
  colorHex: string | null;
  type: string | null;
}

/** The active service/product categories Home renders tiles from. */
export async function homeCategories(): Promise<HomeCategoryRow[]> {
  const data = await gql().query<{ categoryList: HomeCategoryRow[] }>(HOME_CATEGORIES, {
    operationName: 'category',
  });
  return data.categoryList;
}
