/**
 * Queries / labels for the VP-ticket specs of the loyalty + pending-order batch
 * (imported 2026-11-02):
 *
 * - VP-4489 / VP-5112 — "Congrats! You've earned N point(s)" on the customer display.
 * - VP-4538 — campaign (Reminder / New Client / Birthday) rows in Promo & Rewards.
 * - VP-4823 — GoCheckin kiosk check-ins on Pending Orders.
 * - VP-4035 — Home staff "Sort by" → "Staff Checked In".
 *
 * Kept OUT of `testids.ts` on purpose (that catalogue has uncommitted edits and
 * other agents write to it). None of these screens ships a `data-testid` on build
 * 1.1.6x, so the entries are en-US labels from `src/locales/en/common.json` and
 * the structural anchors the volt-qc ports already proved live
 * (`testids.voltqc-pos.ts`, `testids.voltqc-cd-e2e.ts`). Customer display is
 * English-only (`CUSTOMER_DISPLAY_MULTI_LANGUAGE = false`), so the earned-points
 * text is safe to match on any till language.
 */

import type { VqcQuery } from './testids.voltqc-pos.js';

/* ------------------------------------------------------------------------- *
 * VP-4489 / VP-5112 — customer display, payment success
 * ------------------------------------------------------------------------- */

export const VpEarnedPoints = {
  /** `global.congratsEarned`. */
  heading: "Congrats! You've earned",
  /**
   * The value line under it — `global.pointsValue_one` / `_other` since the
   * VP-5112 fix (1.1.64): "1 point" / "5 points". Captures number + unit word.
   */
  valueLineRe: /^\s*(\d[\d,]*)\s+(points?)\s*$/m,
  /** `global.yourCurrentPoints`. */
  currentPoints: 'Your current points',
} as const;

/* ------------------------------------------------------------------------- *
 * VP-4538 — campaigns (the Promo & Rewards dialog itself is driven through
 * `src/pages/voltqc/promo-split/promoFlows.ts` → `openPromo()` / `promoDlg`)
 * ------------------------------------------------------------------------- */

/**
 * How a `campaign.type` / `campaign.name` row is classified. The DTS type
 * strings are not documented on the POS side, so both fields are matched
 * loosely (`reminder`, `new_client` / `New Client`, `birthday`).
 */
export const VpCampaignKind = {
  reminder: /remind/i,
  newClient: /new[\s_-]*(client|customer)/i,
  birthday: /birth/i,
} as const;

export type VpCampaignKindKey = keyof typeof VpCampaignKind;

/* ------------------------------------------------------------------------- *
 * VP-4823 — Pending Orders
 * ------------------------------------------------------------------------- */

export const VpPendingOrders = {
  /** Masked phone a pending card prints: `***-***-0017`. */
  maskedPhone: (last4: string): string => `***-***-${last4}`,
} as const;

/* ------------------------------------------------------------------------- *
 * VP-4035 — Home staff grid "Sort by"
 * ------------------------------------------------------------------------- */

export const VpStaffSort = {
  /** Popover title `global.sortBy`. */
  popover: { css: '[data-radix-popper-content-wrapper]', hasText: 'Sort by', nth: -1 } as VqcQuery,
  /** Radio labels (`staff-sort.tsx`; "Staff Checked In" added by VP-4035). */
  staffCheckedIn: 'Staff Checked In',
  defaultOrder: 'Default Order',
  ascending: 'Ascending',
  descending: 'Descending',
  /** Grid host (`#home-staff-listing`) and the nickname span on each tile. */
  listingCss: '#home-staff-listing',
  staffNameCss: 'main span.col-span-2.text-xl',
} as const;
