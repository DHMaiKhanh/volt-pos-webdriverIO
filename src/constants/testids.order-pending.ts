/**
 * Pending Orders (`/order-pending`) — the selectors the TC-OP-01..11 port needs
 * on top of {@link OrderPendingIds}.
 *
 * Source: live DOM dump of installed build 1.1.56, merchant 14, DEV
 * (`reports/scans/2026-10-25-feature-inventory/dom/order-pending.json`). That
 * build strips every `data-testid` except `env-badge`, so each entry below
 * declares the id the app SHOULD expose (naming: `order-pending-<thing>`) and a
 * structural / bilingual fallback taken from the dump:
 *
 *   input[placeholder="Search order ID, customer name or phone"]
 *   button "Staff 305"                      — staff filter + badge
 *   button[role=combobox] "Latest"          — sort select
 *   button[role=combobox] "Today"           — date-range PRESET select
 *   button#selected-date-range "10/25/2026" — calendar trigger
 *   button "Quick Checkout"
 *   button "OD261025-64284984 Unknown N/A 0 Pts 12:51 AM Processing …" — a card
 *
 * Kept in its own file so the order-pending port does not touch the shared
 * catalogue (`testids.orders.ts` is imported, never edited).
 */

import { OrderPendingIds } from './testids.orders.js';
import { locator, type Locator } from '../helpers/selectors.js';

/** The four strings the SORT combobox can show — EN + VI (`global.latest` / `global.oldest`). */
const SORT_VALUE_TEXTS = ['Latest', 'Oldest', 'Mới nhất', 'Cũ nhất'] as const;
const SORT_VALUE_PREDICATE = SORT_VALUE_TEXTS.map((t) => `contains(normalize-space(),"${t}")`).join(' or ');

/** Card status label — `common.processing`. */
export const PENDING_STATUS_PROCESSING = ['Processing', 'Đang xử lý'] as const;

/** A card's created-at time, e.g. `12:51 AM`. Same in both bundles (12h clock in VI too). */
export const PENDING_CARD_TIME = /\b\d{1,2}:\d{2}\s?(AM|PM)\b/i;

/** The staff filter label + its count badge: `Staff 305` / `Nhân viên 305`. */
export const PENDING_STAFF_FILTER_LABEL = /^(Staff|Nhân viên)\s*\d+$/;

/** The date-range preset that is selected on arrival (`Today` / `Hôm nay`). */
export const PENDING_DATE_PRESET_TODAY = ['Today', 'Hôm nay'] as const;

export const OrderPendingScreenIds = {
  ...OrderPendingIds,

  /**
   * The date-range PRESET select (`Today`, `Yesterday`, …).
   *
   * The toolbar has two Radix comboboxes and neither has a label; the sort one
   * always shows a sort value, so "the combobox that does NOT show a sort value"
   * is the preset. Structural + value-based, not positional.
   */
  datePreset: locator(
    'date range preset',
    'order-pending-date-preset',
    `//*[@role="combobox"][not(${SORT_VALUE_PREDICATE})]`,
  ),
} satisfies Record<string, Locator>;
