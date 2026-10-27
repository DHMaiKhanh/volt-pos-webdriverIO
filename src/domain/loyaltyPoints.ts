/**
 * Loyalty points awarded on order completion — the Checkout Type rules (VP-4591).
 *
 * A port of the app's `src/shared/settings/point-payment-config.ts` and
 * `src/shared/checkout/points.ts` (volt-pos PR #3031), so a spec can derive the
 * points a completion SHOULD award from the merchant's live setting and the
 * order's real tenders, then compare that to the customer's balance delta.
 *
 * Integer cents throughout. `point` in a method config is CENTS PER POINT
 * (100 = 1 point / $1), and every method rounds down.
 *
 * docs/specs/checkout-type-setting.md §2–§3.
 */

export const CHECKOUT_TYPE = {
  MANUAL: 'payment_method',
  AUTO: 'auto_checkout',
  HYBRID: 'hybrid_checkout',
} as const;

export type CheckoutType = (typeof CHECKOUT_TYPE)[keyof typeof CHECKOUT_TYPE];

export const POINT_METHODS = ['cash', 'card', 'gift_card', 'other'] as const;
export type PointMethod = (typeof POINT_METHODS)[number];

export interface PointMethodConfig {
  enabled: boolean;
  /** Cents per point. */
  point: number;
}

export interface PointPaymentSetting {
  methods: Record<PointMethod, PointMethodConfig>;
  checkoutType: CheckoutType;
  pointBonus: number;
  /** The stored `selected_type` was missing or not one of the three — the app fell back to Manual. */
  checkoutTypeDefaulted: boolean;
  /** The stored `point_bonus` was missing or invalid — the app fell back to 0. */
  pointBonusDefaulted: boolean;
}

const DEFAULT_POINT_CENTS = 100;

const asObject = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === 'string') {
    try {
      return asObject(JSON.parse(raw) as unknown);
    } catch {
      return {};
    }
  }
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
};

function parseMethod(raw: unknown): PointMethodConfig {
  const stored = asObject(raw);
  const point = stored['point'];
  return {
    enabled: stored['enabled'] !== false,
    point: typeof point === 'number' && Number.isFinite(point) && point >= 0 ? point : DEFAULT_POINT_CENTS,
  };
}

const isCheckoutType = (value: unknown): value is CheckoutType =>
  Object.values(CHECKOUT_TYPE).includes(value as CheckoutType);

const isPointBonus = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Parse the `merchant_point_payment_config` value exactly as POS #3031 does: unknown → Manual, bonus 0. */
export function parsePointPaymentSetting(value: string | null | undefined): PointPaymentSetting {
  const stored = asObject(value ?? '');
  const selected = stored['selected_type'];
  const bonus = stored['point_bonus'];
  return {
    methods: {
      cash: parseMethod(stored['cash']),
      card: parseMethod(stored['card']),
      gift_card: parseMethod(stored['gift_card']),
      other: parseMethod(stored['other']),
    },
    checkoutType: isCheckoutType(selected) ? selected : CHECKOUT_TYPE.MANUAL,
    pointBonus: isPointBonus(bonus) ? bonus : 0,
    checkoutTypeDefaulted: !isCheckoutType(selected),
    pointBonusDefaulted: !isPointBonus(bonus),
  };
}

/** Does this method earn anything under Point Config? (Portal "No points" = disabled or 0.) */
export const methodEarns = (setting: PointPaymentSetting, method: PointMethod): boolean =>
  setting.methods[method].enabled && setting.methods[method].point > 0;

export interface PointTender {
  id?: string | null;
  referenceId?: string | null;
  paymentType?: string | null;
  transactionType?: string | null;
  status?: string | null;
  amount?: number | null;
  tip?: number | null;
  isCancelled?: boolean | null;
}

export interface PointOrderItem {
  giftCardId?: string | null;
  finalPrice?: number | null;
  servicePrice?: number | null;
}

const paidWithTip = (tender: PointTender): number => (tender.amount ?? 0) + (tender.tip ?? 0);

/**
 * Point Config award (Manual / Hybrid).
 *
 * One deliberate difference from the app: the app also drops a CARD tender
 * whose gateway status is not settled yet. The suite only measures card
 * completions that reached payment-success, so every card tender passed here
 * is treated as settled.
 */
export function pointsFromConfig(
  setting: PointPaymentSetting,
  transactions: readonly PointTender[],
  items: readonly PointOrderItem[],
): number {
  const voided = new Set(
    transactions.flatMap((t) => (t.transactionType === 'void' && t.referenceId ? [t.referenceId] : [])),
  );
  const tenders = transactions.filter(
    (t) =>
      t.isCancelled !== true &&
      !(t.status ?? '').toLowerCase().includes('void') &&
      !(t.id && voided.has(t.id)) &&
      (t.transactionType ?? 'sale') === 'sale' &&
      paidWithTip(t) > 0,
  );
  if (tenders.length === 0) return 0;

  const tenderTotal = tenders.reduce((sum, t) => sum + paidWithTip(t), 0);
  const giftCardSold = items.reduce(
    (sum, item) => (item.giftCardId ? sum + (item.servicePrice ?? item.finalPrice ?? 0) : sum),
    0,
  );
  const eligible = tenderTotal - Math.min(giftCardSold, tenderTotal);
  if (eligible <= 0) return 0;

  // Pro-rate the eligible total over the tenders; the rounding drift lands on the last one.
  const bases = tenders.map((t) => Math.round((paidWithTip(t) * eligible) / tenderTotal));
  const drift = eligible - bases.reduce((sum, b) => sum + b, 0);
  bases[bases.length - 1] = Math.max(0, (bases[bases.length - 1] ?? 0) + drift);

  const byMethod = new Map<string, number>();
  tenders.forEach((t, i) => {
    const method = t.paymentType ?? 'cash';
    byMethod.set(method, (byMethod.get(method) ?? 0) + (bases[i] ?? 0));
  });

  let points = 0;
  for (const [method, base] of byMethod) {
    const config = setting.methods[method as PointMethod] as PointMethodConfig | undefined;
    if (!config?.enabled || config.point <= 0) continue;
    points += Math.floor(base / config.point);
  }
  return points;
}

/** Every line sells or reloads a gift card. An order with no lines is not one. */
export const isGiftCardSaleOnly = (items: readonly PointOrderItem[]): boolean =>
  items.length > 0 && items.every((item) => !!item.giftCardId);

export interface ExpectedAwardInput {
  setting: PointPaymentSetting;
  transactions: readonly PointTender[];
  items: readonly PointOrderItem[];
  /** Grand total due in cents, after every discount, tips included. */
  orderTotal: number;
  /** Every tip on the order, in cents. */
  tipTotal: number;
}

export interface ExpectedAward {
  points: number;
  /** `false` only when Auto withholds its bonus — the earned-points block is hidden, not "0". */
  showEarned: boolean;
}

/** What one first completion of an order should award under the live Checkout Type. */
export function expectedAward({
  setting,
  transactions,
  items,
  orderTotal,
  tipTotal,
}: ExpectedAwardInput): ExpectedAward {
  switch (setting.checkoutType) {
    case CHECKOUT_TYPE.MANUAL:
    case CHECKOUT_TYPE.HYBRID:
      return { points: pointsFromConfig(setting, transactions, items), showEarned: true };
    case CHECKOUT_TYPE.AUTO:
      return orderTotal - tipTotal > 0 && !isGiftCardSaleOnly(items)
        ? { points: setting.pointBonus, showEarned: true }
        : { points: 0, showEarned: false };
  }
}
