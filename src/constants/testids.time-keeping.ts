/**
 * Time Keeping — the `?dialog=time-keeping` dialog (staff self clock-in/out).
 *
 * Source: `volt-pos/src/components/time-keeping/` — `time-keeping.tsx`
 * (dialog + search), `time-keeping-section.tsx` (one shadcn `Card` per column,
 * a `Badge` with the column's count, a VIRTUALISED 3-column grid of cards) and
 * `time-keeping-section-item.tsx` (one staff card; tapping it swaps the card
 * for a "Check In" / "Check Out" button).
 *
 * The installed build strips `data-testid`, so each locator declares the id
 * the app SHOULD expose (`time-keeping-*`) and falls back to structure the
 * source guarantees: the dialog title, shadcn `data-slot`s (`card`,
 * `card-title`, `card-content`, `badge`, `avatar`), the search placeholder and
 * the bilingual labels. Scoped locators are relative (`.//`) — see the note in
 * `testids.turn.ts`.
 *
 * ## Virtualisation
 *
 * Each column renders only the rows in view (+2 overscan) — the 1.1.56 dump
 * shows a badge of 305 with ~29 cards in the DOM. Never compare a badge to the
 * rendered card count on an unfiltered long column; filter with the search box
 * first.
 */

import { Actions, Home, Payroll, both, type Label } from './labels.js';
import { inputWithAnyPlaceholder, locator, type Locator } from '../helpers/selectors.js';

const L = (en: string, vi: string, key: string | null): Label => ({ en, vi, key });

/** Verbatim from volt-pos `src/locales/{en,vi}/common.json`. */
export const TimeKeepingText = {
  title: L('Time Keeping', 'Chấm công', 'global.timeKeeping'),
  unavailable: L('Unavailable Staff', 'Nhân viên chưa sẵn sàng', 'global.unavailableStaff'),
  available: L('Available Staff', 'Nhân viên sẵn sàng', 'global.availableStaff'),
  /** `global.noStaffsFound` — the 2026-08 doc saw the older hardcoded "No staffs found.". */
  noStaff: L('No staff found.', 'Không tìm thấy nhân viên.', 'global.noStaffsFound'),
  noStaffLegacy: L('No staffs found.', 'No staffs found.', null),
  statusIn: L('IN', 'VÀO', 'global.timeIn'),
  statusOut: L('OUT', 'RA', 'global.timeOut'),
  checkInSuccess: L('Check in successfully', 'Ghi nhận giờ vào thành công', 'global.checkInSuccess'),
  checkOutSuccess: L('Check out successfully', 'Ghi nhận giờ ra thành công', 'global.checkOutSuccess'),
} as const;

const anyText = (l: Label): string => `normalize-space()="${l.en}" or normalize-space()="${l.vi}"`;

/** Which column of the dialog. */
export type TimeKeepingColumn = 'unavailable' | 'available';

export const TimeKeepingIds = {
  dialog: locator(
    'time keeping dialog',
    'time-keeping-dialog',
    `//*[@role="dialog"][.//*[@data-slot="dialog-title"][${anyText(TimeKeepingText.title)}]]`,
  ),

  close: locator(
    'time keeping close',
    'time-keeping-close',
    `.//*[@data-slot="dialog-header"]//button[${anyText(Actions.close)}]`,
    `.//button[${anyText(Actions.close)}]`,
  ),

  /** `SearchInput placeholder={t("global.searchStaff")}` — same string as the home staff filter. */
  search: locator(
    'time keeping search',
    'time-keeping-search',
    `.//input[@placeholder="${Home.searchStaff.en}" or @placeholder="${Home.searchStaff.vi}"]`,
    inputWithAnyPlaceholder(...both(Home.searchStaff)),
  ),

  /* Section-relative (use with `within: section`). */

  /** `Badge` next to the column title — `data?.length` of the (filtered) column. */
  sectionBadge: locator('time keeping column badge', 'time-keeping-column-count', './/*[@data-slot="badge"]'),

  /**
   * Every rendered staff card. A card is the grandparent of its `Avatar`
   * (card → name/avatar row → avatar), in both the idle and the selected form.
   */
  sectionCards: locator(
    'time keeping cards',
    'time-keeping-card-',
    './/*[@data-slot="card-content"]//*[@data-slot="avatar"]/../..',
  ),

  sectionEmpty: locator(
    'time keeping column empty state',
    'time-keeping-column-empty',
    `.//*[@data-slot="card-content"]//span[${anyText(TimeKeepingText.noStaff)} or ${anyText(TimeKeepingText.noStaffLegacy)}]`,
  ),

  /** The action button a SELECTED card turns into — "Check In" or "Check Out" (card-relative). */
  cardAction: locator(
    'time keeping card action',
    'time-keeping-card-action',
    `.//button[${anyText(Payroll.checkIn)} or ${anyText(Payroll.checkOut)}]`,
    './/button',
  ),

  /** The hamburger drawer's "Time Keeping" entry (a `<Button>` setting `dialog=time-keeping`). */
  sidebarEntry: locator(
    'sidebar time keeping entry',
    'app-sidebar-item-time-keeping',
    `//*[@data-slot="sidebar"]//button[.//span[${anyText(TimeKeepingText.title)}]]`,
  ),
} satisfies Record<string, Locator>;

/** One column (`Card`) of the dialog, matched by its own title. Dialog-relative. */
export const timeKeepingSection = (column: TimeKeepingColumn): Locator => {
  const l = column === 'available' ? TimeKeepingText.available : TimeKeepingText.unavailable;
  return locator(
    `time keeping ${column} column`,
    `time-keeping-column-${column}`,
    `.//*[@data-slot="card"][.//*[@data-slot="card-title"]//span[${anyText(l)}]]`,
  );
};
