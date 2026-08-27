import { Timeouts } from '../../configs/constants/timeouts.js';
import { moduleLogger } from '../utils/logger.js';
import { autoTransport, type GraphQLBody, type GraphQLEnvelope, type GraphQLTransport } from './transport.js';

const log = moduleLogger('GraphQLClient');

export interface GraphQLRequestOptions {
  variables?: Record<string, unknown>;
  /**
   * The operation name, which must MATCH the name in the query document.
   *
   * Not decoration: the Rust command forwards it to async-graphql as the
   * operation selector, so a mismatch is rejected outright rather than ignored.
   * It is also what every log line and error message here is keyed on.
   */
  operationName?: string;
  timeoutMs?: number;
  /** Force a transport instead of letting {@link autoTransport} decide. */
  transport?: GraphQLTransport;
}

/**
 * A read path into the app's own GraphQL schema.
 *
 * ## What this is for
 *
 * An oracle. A spec that reads a total off the screen and compares it to
 * another number off the same screen only proves the screen agrees with itself.
 * Fetching the row the screen was rendered from turns that into a real check —
 * and it is how the ported income specs assert money without re-implementing
 * the app's arithmetic.
 *
 * ## Why it is read-only by convention
 *
 * Nothing here refuses a mutation, but no service in `src/api/services` sends
 * one, and new ones should not. Data this suite creates must go through the UI:
 * a row written straight into the schema skips the local write path, the
 * pushing database and the sync handshake, so it exists in a state the app
 * itself can never produce and the spec stops testing the product.
 *
 * Sending a query is the whole surface. {@link query} unwraps the envelope so a
 * caller never sees `{ data, errors }` — a GraphQL-level error throws with the
 * operation name and the server's message attached.
 */
export class GraphQLClient {
  private readonly forced: GraphQLTransport | undefined;

  constructor(options: { transport?: GraphQLTransport } = {}) {
    this.forced = options.transport;
  }

  /**
   * Run one query and return its `data`.
   *
   * ## What is retried, and what is not
   *
   * Only transport failures. A GraphQL error is a real answer from a schema
   * that parsed the request — `Unknown field "storeDailyIncomeLive"` means the
   * query is wrong, and retrying it three times just delays the same failure by
   * a second while making the log look like a flake. Transport failures (the
   * webview reloading mid-call, the IPC bridge not yet mounted after a route
   * change) genuinely do succeed on a second attempt.
   */
  async query<T>(document: string, options: GraphQLRequestOptions = {}): Promise<T> {
    const transport = this.forced ?? (await autoTransport());
    const timeoutMs = options.timeoutMs ?? Timeouts.API;
    const name = options.operationName ?? 'anonymous';
    const body: GraphQLBody = {
      query: document,
      variables: options.variables,
      operationName: options.operationName,
    };

    const maxAttempts = 3;
    let lastTransportError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        log.debug(`${transport.name} → ${name} (attempt ${String(attempt)})`);
        const raw = await transport.send(body, timeoutMs);
        return unwrap<T>(raw, name);
      } catch (error) {
        if (error instanceof GraphQLQueryError) throw error;

        lastTransportError = error;
        if (attempt === maxAttempts) break;

        const message = error instanceof Error ? error.message : String(error);
        log.warn(`${name}: transport attempt ${String(attempt)}/3 failed (${message}); retrying…`);
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }

    throw lastTransportError;
  }
}

/** A GraphQL-level failure: the schema answered, and the answer was an error. */
export class GraphQLQueryError extends Error {
  constructor(
    readonly operationName: string,
    readonly errors: Array<{ message: string; path?: (string | number)[] }>,
  ) {
    const detail = errors
      .map((e) => (e.path?.length ? `${e.path.join('.')}: ${e.message}` : e.message))
      .join('; ');
    super(
      `GraphQL operation "${operationName}" failed: ${detail}\n` +
        `If this says Unknown field, the query in src/api/services is ahead of (or behind) the ` +
        `schema this build ships. Diff it against ` +
        `\${VOLT_POS_SRC}/src/generated/schema.graphql before touching the spec.`,
    );
    this.name = 'GraphQLQueryError';
  }
}

/**
 * Envelope to `data`, or a thrown error naming the operation.
 *
 * Both transports return the same `{ data, errors }` shape — the Tauri command
 * hands back the serialised async-graphql response verbatim, exactly as the
 * HTTP endpoint does — so one unwrapper covers both.
 */
function unwrap<T>(raw: unknown, operationName: string): T {
  if (raw === null || typeof raw !== 'object') {
    throw new Error(
      `GraphQL operation "${operationName}" returned ${String(raw)} instead of a response object.`,
    );
  }

  const envelope = raw as GraphQLEnvelope<T>;

  // Errors first, and even when `data` is present: async-graphql returns a
  // PARTIAL result for a field that resolved to null with an error attached, so
  // checking `data` first would hand a spec a half-filled row and let it assert
  // on zeros that mean "this field blew up".
  if (envelope.errors?.length) {
    throw new GraphQLQueryError(operationName, envelope.errors);
  }
  if (envelope.data === undefined) {
    throw new Error(
      `GraphQL operation "${operationName}" returned neither data nor errors: ` +
        `${JSON.stringify(raw).slice(0, 240)}`,
    );
  }
  return envelope.data;
}

/**
 * The shared client.
 *
 * A lazy singleton, not a module-level `new GraphQLClient()`: constructing one
 * is free, but every service that imported an eager instance would drag
 * `@wdio/globals` into `scripts/`, where there is no session and importing it
 * throws.
 */
let shared: GraphQLClient | null = null;

export function gql(): GraphQLClient {
  shared ??= new GraphQLClient();
  return shared;
}
