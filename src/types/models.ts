/**
 * The domain vocabulary specs are written in.
 *
 * Every union here is transcribed from the app, not guessed:
 * `src/shared/types.ts` (`ORDER_STATUS`, `PAYMENT_TYPE`, `SERVICE_TYPE`) and the
 * generated GraphQL entities in `src/generated/graphql.ts` (`Order`, `Staff`,
 * `Service`). Field names follow the app's so a value read out of the database
 * or a GraphQL response maps across without a translation step.
 */

declare const cents: unique symbol;

/**
 * An integer number of cents — the only representation of money in this app.
 *
 * The brand is OPTIONAL, which makes it assignable in both directions with
 * `number`. That is the point: a hard brand would demand a cast at every
 * arithmetic site and people would reach for `as any` within a day. This one
 * costs nothing, still shows up as `MoneyCents` in tooltips and signatures, and
 * leaves the actual dollars-vs-cents enforcement to `expectCentsEqual()` and
 * `sumCents()` in `../utils/money.js`, which check at runtime.
 */
export type MoneyCents = number & { readonly [cents]?: 'cents' };

/**
 * Payment methods, spelled as the checkout tabs are: `checkout-tab-gift-card`.
 *
 * The wire value differs — `PAYMENT_TYPE.GIFT_CARD` is `gift_card` — so anything
 * that touches stored data goes through {@link PAYMENT_TYPE_BY_METHOD} rather
 * than passing the tab spelling straight down.
 */
export const PAYMENT_METHODS = ['cash', 'card', 'gift-card', 'other'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The values `PAYMENT_TYPE` writes to `order_transaction.paymentType`. */
export type AppPaymentType = 'cash' | 'card' | 'gift_card' | 'other';

/** Tab spelling to the value the app stores on a transaction. */
export const PAYMENT_TYPE_BY_METHOD: Record<PaymentMethod, AppPaymentType> = {
  cash: 'cash',
  card: 'card',
  'gift-card': 'gift_card',
  other: 'other',
};

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

/**
 * Order statuses, verbatim from `ORDER_STATUS` in the app's `src/shared/types.ts`.
 *
 * Two that surprise people: `re_open` is the value behind the "Reopened" label
 * (not `reopened`), and `merged` marks a child order absorbed by a merge — its
 * row survives for the audit trail but the app hides it from every list, so a
 * count assertion that includes it will not match the screen.
 */
export const ORDER_STATUSES = [
  'pending',
  'successful',
  'canceled',
  'canceling',
  'cancel_issue',
  'refunded',
  'partial_refunded',
  'refund_issue',
  'refunding',
  're_open',
  'merged',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** `SERVICE_TYPE` — a menu row is either a service or a retail product. */
export type ServiceKind = 'service' | 'product';

/** A staff member, as a spec needs to name one. Their tile is `staff-item-<id>`. */
export interface StaffRef {
  id: string;
  /**
   * `staff.nickname` — the only name field the entity guarantees (`firstName` /
   * `lastName` are nullable) and the one printed on the tile and the receipt.
   */
  nickname: string;
  firstName?: string;
  lastName?: string;
}

/** A menu item, as a spec needs to name one. Its tile is `service-item-<id>`. */
export interface ServiceRef {
  id: string;
  name: string;
  /** `service.price` — cents, and nullable on the entity for flexible-priced items. */
  price?: MoneyCents;
  kind?: ServiceKind;
  categoryId?: string;
}

/**
 * The money and state of one order.
 *
 * Names mirror the `Order` entity so a row read from the database or a GraphQL
 * response drops in unchanged. Every amount is cents; the app derives the
 * printed total from these, it does not store a formatted string.
 */
export interface OrderSummary {
  id: string;
  /** `order.orderCode` — the short human-facing ticket number, absent on drafts. */
  orderCode?: string;
  status: OrderStatus;
  subtotal: MoneyCents;
  totalDiscount: MoneyCents;
  taxAmount: MoneyCents;
  /** Settled once at completion, so it is null on an order that has not been paid. */
  tipAmount?: MoneyCents;
  total: MoneyCents;
  /**
   * `order.settled` — paid is not settled. Order history prints the two
   * together ("Successful - Unsettled") until the batch closes.
   */
  settled?: boolean;
  /** One entry per transaction: a split order is paid by more than one method. */
  paymentMethods?: PaymentMethod[];
  /** RFC3339, UTC. Convert before comparing with a merchant-local day. */
  createdAt?: string;
  customerName?: string;
  customerPhone?: string;
}
