/**
 * Colour / order tickets — VP-5338 (category palette = staff palette), VP-4402
 * (appointment board: GAP staff column order + staff-coloured cards) and VP-4039
 * (Menu service text in ink).
 *
 * ## Evidence
 *
 * volt-pos `origin/develop` read on 2026-11-02:
 *
 * - `src/shared/types.ts` `staffHexColors` — the 15-colour staff palette, and
 *   `defaultStaffHexColor` (#cdccd2) for a staff with no colour.
 * - `src/shared/constants/service.ts` — `CATEGORY_COLORS = staffHexColors`
 *   (VP-5338, PR #3273), `DEFAULT_CATEGORY_COLOR` = Peach, and the pinned
 *   Quick Pay / Gift Card tile colours.
 * - `-category/category.constants.ts` before #3273 — the 20 legacy category colours.
 * - `-category/category-create-dialog.tsx` / `category-update-dialog.tsx` — each
 *   swatch is a `div[role=button]` coloured through an inline `--color` custom
 *   property; the selected one renders a lucide `CheckIcon` (svg) inside.
 * - `home/-service/service-items.tsx` — `li[data-testid="service-tile-<id>"]`,
 *   `text-ink`, inline `background-color` = category colour (VP-4039, PR #3133).
 * - `home/-service/service-category.tsx` — category tiles: `div` with inline
 *   `background-color` inside a `[data-slot="carousel-item"]`, an `<h3>` name and
 *   a `<p>` count. No testid.
 * - `home/-staff/staff-tile.tsx` — `div[data-testid="staff-tile-<id>"]`; the
 *   nickname `<span>` is `text-ink` (white only on the SELECTED tile).
 * - `appointment/-appointment-scheduler/appointment-scheduler-staff-header.tsx` —
 *   each column header is an absolutely positioned cell with inline
 *   `transform: translateX(<px>)` and `border-bottom: 3px solid <staff colour>`;
 *   Unassigned uses `var(--color-neutral-700)`.
 * - `appointment-scheduler-card-body.tsx` — a card sets inline `border-color`
 *   (all four sides) = staff colour and, when assigned, inline
 *   `background-color: color-mix(in srgb, <staff> 30%, var(--card))` (VP-4402, PR #3274).
 *
 * None of these elements carry a testid on develop except the service and staff
 * tiles, so the CSS below is anchored to inline-style SHAPES and `data-slot`
 * attributes (structural, language-proof) — never Tailwind classes or text.
 * Requested ids: `home-service-category-<id>`, `appointment-column-header-<staffId>`,
 * `appointment-card-<id>`, `category-color-swatch-<hex>`.
 */

import { byTestIdPrefix, locator, type Locator } from '../helpers/selectors.js';

/* ------------------------------------------------------------------------- *
 * Values
 * ------------------------------------------------------------------------- */

/** `staffHexColors` — POS names; the Portal names some differently (Teal ↔ Mint, Mint ↔ Aqua…). */
export const STAFF_PALETTE = [
  { name: 'Peach', hex: '#E3AA8A' },
  { name: 'Pink', hex: '#F5A3B5' },
  { name: 'Lavender', hex: '#B5ADEF' },
  { name: 'Coral', hex: '#F4B6A0' },
  { name: 'Mint', hex: '#9DF5EC' },
  { name: 'Sky Blue', hex: '#9DDDF9' },
  { name: 'Blue', hex: '#96BDF5' },
  { name: 'Purple', hex: '#E299F1' },
  { name: 'Salmon', hex: '#F59992' },
  { name: 'Teal', hex: '#83F0CC' },
  { name: 'Yellow', hex: '#F8D885' },
  { name: 'Light Green', hex: '#B7D5A1' },
  { name: 'Green', hex: '#78D4A2' },
  { name: 'Apricot', hex: '#F5A98A' },
  { name: 'Periwinkle', hex: '#A0AFF0' },
] as const;

export const STAFF_PALETTE_HEX: readonly string[] = STAFF_PALETTE.map((c) => c.hex);

/** `DEFAULT_CATEGORY_COLOR` after VP-5338 — Peach. */
export const DEFAULT_CATEGORY_HEX = '#E3AA8A';

/** `defaultStaffHexColor` — what a staff with `colorHex = null` renders as. */
export const DEFAULT_STAFF_HEX = '#CDCCD2';

/** The 20 category colours before VP-5338 (`VALID_COLORS`, removed by PR #3273). */
export const LEGACY_CATEGORY_HEX: readonly string[] = [
  '#36BFF2',
  '#1FD69F',
  '#3A86EB',
  '#2EE4D9',
  '#785EE1',
  '#DB4B91',
  '#E77653',
  '#E9434A',
  '#3FB2F2',
  '#E74F78',
  '#CA7146',
  '#9E6442',
  '#C239DD',
  '#E66436',
  '#0AA456',
  '#546AD7',
  '#70A950',
  '#F2BB3B',
  '#6C64E9',
  '#E363AC',
];

/** `PINNED_CATEGORY_CARDS` — rendered from constants, no category row behind them. */
export const PINNED_TILE_HEX = { quickPay: '#E66436', giftCard: '#F49D1A' } as const;

/** Pinned tile labels (EN / VI) — data used to tell the two tiles apart, not to find them. */
export const PINNED_TILE_LABELS = {
  quickPay: ['Quick Pay', 'Thanh toán nhanh'],
  giftCard: ['Gift Card', 'Thẻ quà tặng'],
} as const;

/** The appointment board's first column — `global.unassigned`. */
export const UNASSIGNED_LABELS = ['Unassigned', 'Chưa phân công'] as const;

/**
 * VP-5481 expectations taken from GAP (pos.gocheckin.net, store 14, 02/11/2026).
 * Merchant-14 data: the specs only assert them when the staff exists.
 */
export const GAP_EXPECTED_COLORS = {
  unassigned: '#5669FF',
  /** GAP `var(--primary)` fallback for a staff with no colour (VP-5500 → POS side, VP-5481). */
  nullStaff: '#5669FF',
  staff: {
    Anna: '#96BDF5',
    'Teri Jennings': '#F8D885',
    'Lizzie Wade': '#A0AFF0',
    'Ramona Dunn': '#96BDF5',
  } as Record<string, string>,
} as const;

/** VP-5479: the staff GAP shows as column 2 but POS has no `staff_appointment` row for. */
export const VP5479_STAFF = '1001vvv';

/** Prefix of every category VP-5338 creates (POS cannot delete — inactivate/clean on Portal). */
export const QA_CATEGORY_PREFIX = 'QC VP5338';

/* ------------------------------------------------------------------------- *
 * Raw CSS for `browser.execute` reads (a Locator cannot cross into the page)
 * ------------------------------------------------------------------------- */

export const PaletteCss = {
  /** The topmost open Radix dialog. */
  openDialog: '[role="dialog"][data-state="open"]',
  /** A colour swatch in the Create / Update Category dialog. */
  dialogSwatch: '[role="button"][style*="--color"]',
  /** Active Radix tab panel (Reorder dialog). */
  activeTabpanel: '[role="tabpanel"][data-state="active"]',
  /** Home service tiles — develop id first, VP-802 id, then the 1.1.x list item. */
  serviceTiles: `${byTestIdPrefix('service-tile-')}, ${byTestIdPrefix('service-item-')}`,
  serviceTilesFallback: 'li.cursor-pointer',
  /** Home category tiles: the coloured block inside a carousel item. */
  categoryTiles: '[data-slot="carousel-item"] [style*="background-color"]',
  /** Home staff tiles (develop id, VP-802 id). */
  staffTiles: `${byTestIdPrefix('staff-tile-')}, ${byTestIdPrefix('staff-item-')}`,
  staffTilesFallback: '#home-staff-listing div.cursor-pointer',
  /** Appointment board column header cells. */
  boardHeaderCell: '[style*="translateX"][style*="border-bottom"]',
  /** Appointment cards (inline four-side border colour). */
  boardCard: '[style*="border-color"]',
} as const;

/* ------------------------------------------------------------------------- *
 * Locators (for waits)
 * ------------------------------------------------------------------------- */

export const PaletteIds = {
  serviceTiles: locator(
    'home service tiles',
    'service-tile-',
    byTestIdPrefix('service-tile-'),
    byTestIdPrefix('service-item-'),
    PaletteCss.serviceTilesFallback,
  ),
  categoryTiles: locator('home category tiles', 'home-service-category-', PaletteCss.categoryTiles),
  staffTiles: locator(
    'home staff tiles',
    'staff-tile-',
    byTestIdPrefix('staff-tile-'),
    byTestIdPrefix('staff-item-'),
    PaletteCss.staffTilesFallback,
  ),
  boardHeaderCells: locator(
    'appointment board column headers',
    'appointment-column-header-',
    PaletteCss.boardHeaderCell,
  ),
  dialogSwatches: locator('category colour swatches', 'category-color-swatch-', PaletteCss.dialogSwatch),
} satisfies Record<string, Locator>;
