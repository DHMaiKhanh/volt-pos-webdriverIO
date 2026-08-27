import { gql, type GraphQLClient } from '../GraphQLClient.js';
import { type OptionalCents } from '../models/report.js';

/**
 * An order, as the schema stores it.
 *
 * Money is integer cents and every total here is `Int!` EXCEPT `tipAmount` — an
 * order that was never tipped holds null, not zero.
 */
export interface OrderRow {
  id: string;
  orderCode: string | null;
  status: string;
  subtotal: number;
  total: number;
  totalDiscount: number;
  totalPromotionDiscount: number;
  taxAmount: number;
  tipAmount: OptionalCents;
  createdAt: string;
  completedAt: string | null;
}

interface OrderListResponse {
  orderList: OrderRow[];
}

const ORDER_FIELDS = `
  id
  orderCode
  status
  subtotal
  total
  totalDiscount
  totalPromotionDiscount
  taxAmount
  tipAmount
  createdAt
  completedAt
`;

const ORDERS_BY_IDS = `
  query ordersByIds($ids: [String!]) {
    orderList(where: { id: { in: $ids } }) {
      ${ORDER_FIELDS}
    }
  }
`;

const ORDER_BY_CODE = `
  query orderByCode($code: String) {
    orderList(where: { orderCode: { eq: $code } }, limit: 1) {
      ${ORDER_FIELDS}
    }
  }
`;

const RECENT_ORDERS = `
  query recentOrders($limit: Int) {
    orderList(orderBy: [{ createdAt: desc }], limit: $limit) {
      ${ORDER_FIELDS}
    }
  }
`;

/**
 * Orders, for the checks the report views cannot answer.
 *
 * The `vReport*Order` views carry `orderId` and no relation to `Order`, so the
 * human-readable `orderCode` a spec reads off the Order History screen has to be
 * resolved here. That is the main job. The totals are the secondary one: an
 * order created through the UI can be re-read to confirm what the app actually
 * persisted, which is a stronger assertion than re-reading the same screen.
 *
 * Read-only, like every service here — orders are created by driving the app.
 */
export class OrderService {
  constructor(private readonly client: GraphQLClient = gql()) {}

  /**
   * `orderId` → `orderCode`, for a batch of report rows.
   *
   * A Map rather than a list because the caller invariably has report rows in
   * hand and wants to label them; and one round trip rather than one per row,
   * since a busy day's report is easily a hundred lines.
   *
   * Orders whose code is null are present in the map with a `null` value — a
   * missing KEY means the id does not resolve to an order at all, which is a
   * genuine data problem and should not look the same as an uncoded order.
   */
  async orderCodesById(orderIds: string[]): Promise<Map<string, string | null>> {
    const unique = [...new Set(orderIds)];
    if (unique.length === 0) return new Map();

    const data = await this.client.query<OrderListResponse>(ORDERS_BY_IDS, {
      operationName: 'ordersByIds',
      variables: { ids: unique },
    });
    return new Map(data.orderList.map((order) => [order.id, order.orderCode]));
  }

  async byId(orderId: string): Promise<OrderRow | null> {
    const data = await this.client.query<OrderListResponse>(ORDERS_BY_IDS, {
      operationName: 'ordersByIds',
      variables: { ids: [orderId] },
    });
    return data.orderList[0] ?? null;
  }

  async byCode(orderCode: string): Promise<OrderRow | null> {
    const data = await this.client.query<OrderListResponse>(ORDER_BY_CODE, {
      operationName: 'orderByCode',
      variables: { code: orderCode },
    });
    return data.orderList[0] ?? null;
  }

  /**
   * The most recent orders, newest first.
   *
   * How a spec that just completed a checkout finds the order it created without
   * scraping an id out of the URL — assert on the newest row and confirm its
   * total matches what the cart said.
   */
  async recent(limit = 10): Promise<OrderRow[]> {
    const data = await this.client.query<OrderListResponse>(RECENT_ORDERS, {
      operationName: 'recentOrders',
      variables: { limit },
    });
    return data.orderList;
  }
}
