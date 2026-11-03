/**
 * Selectors + copy for the VP-4912 / VP-4913 / VP-2105 ticket specs:
 *   - tests/regression/order-flow/vp-4912-reopen-split-close-ticket.spec.ts
 *   - tests/regression/order-flow/vp-4913-adjust-tip-split-payment.spec.ts
 *   - tests/regression/order-history/vp-2105-date-range-calendar.spec.ts
 *
 * Same {@link VqcQuery} vocabulary as `testids.voltqc-pos.ts` (resolved by
 * `src/pages/voltqc/pos/VoltQcProbe.ts`). Only what the existing voltqc catalogues
 * (`testids.voltqc-promo-split.ts`, `testids.voltqc-oh-reopen.ts`) do not already carry.
 *
 * Sources (volt-pos): `src/components/tip/order-adjust-tip-dialog.tsx` (row layout,
 * `global.plusTip` = " + {{amount}} Tip"), `src/components/date-range-picker.tsx` +
 * `src/components/ui/calendar.tsx` (two react-day-picker v9 calendars, each a
 * `data-slot="calendar"` root with its own Previous / Next Month buttons).
 */

import { btn, type VqcQuery } from './testids.voltqc-pos.js';

/** Payment Success / Order History — Adjust Tip after a split payment (VP-4913). */
export const VpSplitTip = {
  /** Split Order's own top bar exit (no header nav on that screen). */
  backToOrder: { css: 'button[aria-label="Back to order"]', nth: 0 } as VqcQuery,
  /**
   * The "Adjust Tip" link of the Payment Success screen. Unscoped on purpose: the
   * success route hides the header and its layout is not guaranteed to sit in `<main>`.
   */
  successAdjustTip: btn('Adjust Tip', 0),
  /** Per-payment "Adjust Tip" button inside the "Adjust Order Tip" list. */
  rowAdjustTipLabel: 'Adjust Tip',
  /** One payment row of the "Adjust Order Tip" list (closest ancestor of its button). */
  rowCss: 'div.justify-between',
  /** Row amount suffix ` + $10.00 Tip`. */
  plusTipRe: '\\+\\s*(\\$[\\d,.]+)\\s*Tip',
} as const;

/** Re-Open of a split order (VP-4912). */
export const VpSplitReopen = {
  /** Second sentence of the locked "Re-Open Order?" dialog (items/prices locked, non-money editable). */
  lockedNonMoney: 'Staff, customer and notes can still change',
} as const;

/** Order History date-range popover (VP-2105). */
export const VpDateRange = {
  /** One of the two calendars inside the popover. */
  calendarCss: '[data-slot="calendar"]',
  /** react-day-picker caption ("June 2026"). */
  captionCss: '.rdp-caption_label',
  /** Day cell button; `data-day` is `M/D/YYYY` (en-US `toLocaleDateString`). */
  dayCss: 'button[data-day]',
  previousMonth: { role: 'button', nameRe: 'Previous Month', flags: 'i', nth: 0 } as VqcQuery,
  nextMonth: { role: 'button', nameRe: 'Next Month', flags: 'i', nth: 0 } as VqcQuery,
  today: { role: 'button', name: 'Today' } as VqcQuery,
  cancel: { role: 'button', name: 'Cancel' } as VqcQuery,
  apply: { role: 'button', name: 'Apply' } as VqcQuery,
} as const;
