/**
 * The API barrel — a read path into the app's own GraphQL schema.
 *
 * ## What this layer is for
 *
 * Oracles. A spec that reads a total off the screen and compares it to another
 * number off the same screen only proves the screen agrees with itself; fetching
 * the row the screen was rendered from turns that into a real check.
 *
 * ## Two rules
 *
 * 1. **Read only.** Data this suite creates goes through the UI. A row written
 *    straight into the schema skips the local write path, the pushing database
 *    and the sync handshake, so it exists in a state the app itself can never
 *    produce — and the spec stops testing the product.
 * 2. **Query what the SCREEN queries.** Every document here is transcribed from
 *    the app's own `.gql.ts`. An oracle reading a different (even equivalent)
 *    query can disagree with the screen while both are correct, and that failure
 *    costs an afternoon.
 *
 * Transport is decided per call — Tauri IPC while a session is open, HTTP
 * against a dev build otherwise. See `transport.ts`, which explains why
 * `fetch('/graphql')` cannot work against a packaged app.
 */

export { gql, GraphQLClient, GraphQLQueryError } from './GraphQLClient.js';
export type { GraphQLRequestOptions } from './GraphQLClient.js';

export { autoTransport, graphqlHttpUrl, httpTransport, ipcTransport, probeHttp } from './transport.js';
export type { GraphQLBody, GraphQLEnvelope, GraphQLTransport } from './transport.js';

export { cents } from './models/report.js';
export type {
  DailyIncomeTotals,
  OptionalCents,
  StaffDailyIncomeOrderRow,
  StaffDailyIncomeRow,
  StoreDailyIncomeOrderRow,
  StoreDailyIncomeRow,
  StoreIncomeSummaryRow,
} from './models/report.js';

export { isSelectable } from './models/staff.js';
export type { StaffListResponse, StaffNode } from './models/staff.js';

export { ReportService, ymd } from './services/report.service.js';
export { StaffService } from './services/staff.service.js';
export { OrderService } from './services/order.service.js';
export type { OrderRow } from './services/order.service.js';
