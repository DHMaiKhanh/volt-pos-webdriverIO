import {
  parsePointPaymentSetting,
  type PointOrderItem,
  type PointPaymentSetting,
  type PointTender,
} from '../../domain/index.js';
import { gql, type GraphQLClient } from '../GraphQLClient.js';

/**
 * Loyalty points — the oracle for the Checkout Type specs (VP-4591).
 *
 * Four reads, the first three transcribed from a query the app itself sends:
 *
 * - the merchant's `merchant_point_payment_config` row
 *   (`src/hooks/point-payment-config.gql.ts`, PR #3031);
 * - a customer's current balance, via `customerInfo(phone)` — the same
 *   upstream lookup the Promo & Rewards dialog runs
 *   (`-customer/-share/customer.gql.ts`), so it reads GoCheckin, not a local copy;
 * - an order's tenders, lines and `pointBonus` stamp, which is what the
 *   completion computed its award from;
 * - the pending order a GoCheckin kiosk check-in created for a phone (order +
 *   check-in status), which is where every Checkout Type case starts.
 *
 * Read-only, like every service here. The setting is changed on the Portal by a
 * person, never by a spec — see docs/screens/checkout-type/checkout-type-test-cases.md §9.
 */

const POINT_PAYMENT_CONFIG = `
  query getPointPaymentConfig {
    sysSettingList(where: { key: { eq: "merchant_point_payment_config" } }) {
      id
      key
      value
    }
  }
`;

const CUSTOMER_POINTS = `
  query getCustomerPromotionInfo($phone: String!) {
    customerInfo(phone: $phone) {
      id
      currentPoint
      message
    }
  }
`;

const ORDER_POINT_STATE = `
  query orderPointState($ids: [String!]) {
    orderList(where: { id: { in: $ids } }) {
      id
      status
      total
      tipAmount
      pointBonus
      customerCheckinId
      orderItemListById {
        giftCardId
        finalPrice
        servicePrice
      }
      orderTransactionListById {
        id
        referenceId
        paymentType
        transactionType
        status
        amount
        tip
        isCancelled
      }
    }
  }
`;

/**
 * Recent pending orders with their customer and check-in — filtered client-side,
 * because the order row does not carry the phone (only the customer relation does).
 */
const PENDING_CHECKINS = `
  query pendingCheckinOrders {
    orderList(where: { status: { eq: "pending" } }, orderBy: [{ createdAt: desc }], limit: 100) {
      id
      orderCode
      customerCheckinId
      customer {
        phone
      }
      customerCheckin {
        id
        status
        checkinAt
      }
    }
  }
`;

/** A pending order a GoCheckin kiosk check-in created, as POS synced it down. */
export interface CheckedInOrder {
  id: string;
  /** Bare code, e.g. `OD261027-00003444` — what the Pending Orders cards print. */
  orderCode: string;
  customerCheckinId: string;
  checkinStatus: string | null;
  checkinAt: string | null;
}

interface PendingCheckinResponse {
  orderList: Array<{
    id: string;
    orderCode: string;
    customerCheckinId: string | null;
    customer: { phone: string | null } | null;
    customerCheckin: { id: string; status: string | null; checkinAt: string | null } | null;
  }>;
}

export interface LivePointSetting extends PointPaymentSetting {
  /** The stored JSON, verbatim — null when the merchant has no row at all. */
  raw: string | null;
}

export interface OrderPointState {
  id: string;
  status: string;
  total: number;
  tipAmount: number | null;
  /** Stamped by the first completion with the points it sent; null = never sent. */
  pointBonus: number | null;
  customerCheckinId: string | null;
  items: PointOrderItem[];
  transactions: PointTender[];
}

interface SysSettingResponse {
  sysSettingList: Array<{ id: string; key: string; value: string | null }> | null;
}

interface CustomerInfoResponse {
  customerInfo: { id: number | null; currentPoint: number | null; message: string | null } | null;
}

interface OrderPointResponse {
  orderList: Array<
    Omit<OrderPointState, 'items' | 'transactions'> & {
      orderItemListById: PointOrderItem[] | null;
      orderTransactionListById: PointTender[] | null;
    }
  >;
}

export class LoyaltyService {
  constructor(private readonly client: GraphQLClient = gql()) {}

  /** The setting as POS reads it at completion time: unknown type → Manual, bad bonus → 0. */
  async pointSetting(): Promise<LivePointSetting> {
    const data = await this.client.query<SysSettingResponse>(POINT_PAYMENT_CONFIG, {
      operationName: 'getPointPaymentConfig',
    });
    const raw =
      data.sysSettingList?.find((row) => row.key === 'merchant_point_payment_config')?.value ?? null;
    return { ...parsePointPaymentSetting(raw), raw };
  }

  /**
   * The customer's current balance.
   *
   * The Rust resolver answers null for every upstream error, so a null here is
   * "GoCheckin did not answer", not "zero points" — it throws rather than let a
   * spec compute a delta against a balance it never read.
   */
  async currentPoints(phone: string): Promise<number> {
    const data = await this.client.query<CustomerInfoResponse>(CUSTOMER_POINTS, {
      operationName: 'getCustomerPromotionInfo',
      variables: { phone },
    });
    const points = data.customerInfo?.currentPoint;
    if (typeof points !== 'number') {
      throw new Error(
        `customerInfo(${phone}) returned no currentPoint` +
          (data.customerInfo?.message ? ` (${data.customerInfo.message})` : '') +
          `. Check the phone is a customer of this merchant (kiosk check-in synced, or ` +
          `LOYALTY_CUSTOMER_PHONE for CHK-POS-033) and the till is online.`,
      );
    }
    return points;
  }

  async orderPointState(orderId: string): Promise<OrderPointState | null> {
    const data = await this.client.query<OrderPointResponse>(ORDER_POINT_STATE, {
      operationName: 'orderPointState',
      variables: { ids: [orderId] },
    });
    const row = data.orderList[0];
    if (!row) return null;
    const { orderItemListById, orderTransactionListById, ...rest } = row;
    return { ...rest, items: orderItemListById ?? [], transactions: orderTransactionListById ?? [] };
  }

  /**
   * The newest pending order of `phone` that already carries an ACTIVE check-in
   * — the order a GoCheckin kiosk check-in creates. Null until it has synced.
   *
   * An order created on POS has `customerCheckinId = null` while pending, so it
   * never matches: that is the point.
   */
  async checkedInPendingOrder(phone: string): Promise<CheckedInOrder | null> {
    const digits = phone.replace(/\D/g, '');
    const data = await this.client.query<PendingCheckinResponse>(PENDING_CHECKINS, {
      operationName: 'pendingCheckinOrders',
    });
    const row = data.orderList.find(
      (o) =>
        (o.customer?.phone ?? '').replace(/\D/g, '') === digits &&
        o.customerCheckinId !== null &&
        o.customerCheckin?.status === 'active',
    );
    if (!row?.customerCheckinId) return null;
    return {
      id: row.id,
      orderCode: row.orderCode,
      customerCheckinId: row.customerCheckinId,
      checkinStatus: row.customerCheckin?.status ?? null,
      checkinAt: row.customerCheckin?.checkinAt ?? null,
    };
  }
}
