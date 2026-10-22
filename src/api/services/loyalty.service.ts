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
 * Three reads, each transcribed from a query the app itself sends:
 *
 * - the merchant's `merchant_point_payment_config` row
 *   (`src/hooks/point-payment-config.gql.ts`, PR #3031);
 * - a customer's current balance, via `customerInfo(phone)` — the same
 *   upstream lookup the Promo & Rewards dialog runs
 *   (`-customer/-share/customer.gql.ts`), so it reads GoCheckin, not a local copy;
 * - an order's tenders, lines and `pointBonus` stamp, which is what the
 *   completion computed its award from.
 *
 * Read-only, like every service here. The setting is changed on the Portal by a
 * person, never by a spec — see docs/screens/checkout-type/checkout-type-test-cases.md §7.
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
          `. Check LOYALTY_CUSTOMER_PHONE is a customer of this merchant and the till is online.`,
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
}
