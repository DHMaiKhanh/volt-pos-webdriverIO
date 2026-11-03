/**
 * Selectors for the per-ticket specs VP-4375 / VP-4376 / VP-4802
 * (`tests/regression/order-flow/vp-4375-*.spec.ts`, `vp-4376-*`, `vp-4802-*`).
 *
 * Same vocabulary as `testids.voltqc-pos.ts` / `testids.voltqc-promo-split.ts`:
 * {@link VqcQuery} chains resolved by `src/pages/voltqc/pos/VoltQcProbe.ts`.
 * Where the app ships a `data-testid` (volt-pos develop, checked 2026-11-02) the
 * chain uses it FIRST in a CSS list, with the structural fallback after it:
 *
 *   - `promo-rewards-count` — order-promo-rewards-dialog.tsx (VP-4802 badge).
 *   - `oh-cancel-gift-card-blocked-dialog` / `order-action-cancel` /
 *     `oh-cancel-confirm` — order-cancel-confirm-dialog.tsx (VP-4376 guard).
 *
 * Texts are the en-US strings of `src/locales/en/common.json`; they are VALUES
 * the cases assert (a message, a label), not the way an element is found,
 * except where the app gives the element no other handle (the dialogs below).
 */

import { inMain, type VqcQuery } from './testids.voltqc-pos.js';

/* ------------------------------------------------------------------------- *
 * VP-4802 — Promo & Rewards trigger + its count badge
 * ------------------------------------------------------------------------- */

export const VpPromoTrigger = {
  /**
   * The Promo & Rewards trigger WITH or WITHOUT its badge. The badge is a child
   * of the button, so the accessible name becomes "Promo & Rewards5" once it
   * shows — the exact-name `VqpsHome.promoButton` stops matching then.
   */
  button: { role: 'button', nameRe: '^Promo & Rewards\\s*(\\d+|99\\+)?$', nth: 0 } as VqcQuery,
  /** The red count badge inside the trigger (`data-testid` first, shadcn `data-slot` fallback). */
  badgeCss: '[data-testid="promo-rewards-count"], [data-slot="badge"]',
  /** Promo & Rewards dialog (title text). */
  dialog: { role: 'dialog', hasText: 'Promo & Rewards', nth: -1 } as VqcQuery,
  /** One selectable promotion / reward row: `<Label htmlFor={campaign.id | redeem.id}>`. */
  offerRowCss: 'label[for]',
  /** Dialog fully loaded: one of the promotion-section terminal states. */
  loadedRe: "No promotions available|Promotions and rewards don't apply to gift cards|Custom Discount",
  noPromotions: 'No promotions available',
  noRewards: 'No rewards available',
  giftCardOnly: "Promotions and rewards don't apply to gift cards",
  maxDiscountRe: 'Discount cannot exceed \\$[\\d,.]+',
} as const;

export const vpPromoBadge = (): readonly VqcQuery[] => [
  VpPromoTrigger.button,
  { css: VpPromoTrigger.badgeCss, nth: 0 },
];

/* ------------------------------------------------------------------------- *
 * VP-4375 — discount lines (order panel / checkout / customer display)
 * ------------------------------------------------------------------------- */

export const VpDiscountLabels = {
  promotion: 'Promotion',
  /** Checkout summary label for a reward; the order panel may print the shorter "Reward". */
  rewardRe: 'Reward Redemption|Reward',
  itemDiscount: 'Item Discount',
  totalDiscount: 'Total Discount',
} as const;

/* ------------------------------------------------------------------------- *
 * VP-4376 — cancel guard on a gift-card top-up order
 * ------------------------------------------------------------------------- */

export const VpCancelGuard = {
  cancelButton: inMain({
    css: '[data-testid="order-action-cancel"], button',
    hasText: 'Cancel Order',
    nth: 0,
  }),
  /** The blocked state replaces the Cancel Order dialog content (alertdialog). */
  blockedDialog: {
    role: 'dialog',
    css: '[data-testid="oh-cancel-gift-card-blocked-dialog"], [role="alertdialog"]',
    hasText: 'Unable to Cancel Order',
    nth: -1,
  } as VqcQuery,
  blockedTitle: 'Unable to Cancel Order',
  insufficient: 'Gift Card balance is insufficient to revert this top-up. This order cannot be cancelled.',
  unverified: 'Unable to verify the Gift Card balance. Please check the connection and try again.',
  canceledToast: 'Order canceled successfully',
} as const;
