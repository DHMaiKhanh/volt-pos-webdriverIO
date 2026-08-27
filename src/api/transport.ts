import { browser } from '@wdio/globals';
import { env } from '../../configs/env/loadEnv.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('GraphQLTransport');

/**
 * How a GraphQL request reaches the app's schema.
 *
 * ## Why this is not just `fetch('/graphql')`
 *
 * The Playwright suite this layer was ported from talks HTTP to
 * `http://localhost:1420/graphql`, and that works there for a reason that does
 * NOT hold here: it drives the app through the Vite dev server, whose config
 * proxies `/graphql` to `http://127.0.0.1:8080` (`volt-pos/vite.config.ts`).
 *
 * A packaged build has neither half of that.
 *
 * 1. **No dev server.** The webview is served from the custom protocol
 *    (`http://tauri.localhost`), which serves `dist/` and nothing else — there
 *    is no `/graphql` route to proxy.
 * 2. **No HTTP GraphQL server, usually.** The axum listener on `0.0.0.0:8080`
 *    (`src-tauri/src/app_handle/graphql.rs`) sits behind the cargo feature
 *    `graphql_server`, and `src-tauri/Cargo.toml` declares `default = []`. A
 *    release installer is compiled without it, so the port is simply closed.
 *
 * What the app itself uses is neither: `src/lib/graphql-fetcher.ts` calls the
 * Tauri command `graphql` over IPC. That command is present in every build,
 * which is why it is this framework's PRIMARY transport.
 *
 * ## Reaching a Tauri command from WebdriverIO
 *
 * The app does not set `withGlobalTauri`, so `window.__TAURI__` is undefined —
 * the generated bindings in `src/generated/tauri-specta.ts` import
 * `@tauri-apps/api` at build time and the bundle keeps it module-private.
 * `window.__TAURI_INTERNALS__.invoke` is the transport that package itself
 * calls and it IS on the window object, so `browser.executeAsync` can use it.
 *
 * ## When HTTP is still the right answer
 *
 * A `tauri dev` session, or a build compiled with `--features graphql_server`,
 * does expose the port — and hitting it from Node skips the webview entirely,
 * which is the only way to query the schema when no session is open (a `before`
 * hook that seeds data, anything under `scripts/`). {@link httpTransport}
 * covers that case; {@link autoTransport} prefers IPC whenever a session exists.
 */
export interface GraphQLTransport {
  readonly name: 'ipc' | 'http';
  send(body: GraphQLBody, timeoutMs: number): Promise<unknown>;
}

export interface GraphQLBody {
  query: string;
  variables?: Record<string, unknown> | undefined;
  operationName?: string | undefined;
}

/** The raw envelope both transports return, before errors are unwrapped. */
export interface GraphQLEnvelope<T> {
  data?: T;
  errors?: Array<{ message: string; path?: (string | number)[] }>;
}

/** What the in-browser function hands back — never a raw value, so a thrown string survives. */
interface TransportResult {
  __transportOk?: unknown;
  __transportError?: string;
}

/**
 * Talk to the schema through the app's own `graphql` Tauri command.
 *
 * `executeAsync` rather than `execute` because the browser-side function has to
 * await the IPC round trip; the sync form would return the pending promise as
 * an empty object.
 *
 * The command's Rust signature is
 * `graphql(query, variables, operation) -> Result<JsonValue, String>`, and
 * tauri-specta's binding passes camelCase keys (`{ query, variables, operation }`),
 * so the argument object below is exactly what the app itself sends. A rejected
 * command surfaces as a thrown string, re-thrown here with the operation name
 * attached — an unadorned `no such table: order` in a spec failure is otherwise
 * impossible to place.
 */
export const ipcTransport: GraphQLTransport = {
  name: 'ipc',
  async send(body, timeoutMs) {
    const result: TransportResult = await browser.executeAsync(
      function (payload: GraphQLBody, ms: number, done: (value: TransportResult) => void) {
        const internals = (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] as
          { invoke?: (cmd: string, args: unknown) => Promise<unknown> } | undefined;

        if (!internals || typeof internals.invoke !== 'function') {
          done({
            __transportError:
              'window.__TAURI_INTERNALS__.invoke is not available. The page under the driver is ' +
              'not a Tauri webview — check that the session attached to the app window and not ' +
              'to a plain browser tab.',
          });
          return;
        }

        const timer = setTimeout(function () {
          done({ __transportError: 'Tauri command "graphql" did not answer within ' + ms + 'ms.' });
        }, ms);

        internals
          .invoke('graphql', {
            query: payload.query,
            variables: payload.variables ?? null,
            operation: payload.operationName ?? null,
          })
          .then(function (value: unknown) {
            clearTimeout(timer);
            done({ __transportOk: value });
          })
          .catch(function (error: unknown) {
            clearTimeout(timer);
            done({ __transportError: String(error) });
          });
      },
      body,
      timeoutMs,
    );

    if (result.__transportError !== undefined) {
      throw new Error(
        `GraphQL over IPC failed (${body.operationName ?? 'anonymous'}): ${result.__transportError}`,
      );
    }
    return result.__transportOk;
  },
};

/**
 * Talk to the axum listener directly from Node.
 *
 * Only reachable against a `tauri dev` session or a build compiled with the
 * `graphql_server` feature; {@link probeHttp} is what decides that, rather than
 * a comment telling the reader to know.
 */
export const httpTransport: GraphQLTransport = {
  name: 'http',
  async send(body, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch(graphqlHttpUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`GraphQL HTTP ${String(response.status)}: ${await response.text()}`);
      }
      // `json()` is typed `Promise<any>`; the envelope is validated by the
      // client's `unwrap`, so `unknown` is the honest type to hand back here.
      return (await response.json()) as unknown;
    } finally {
      clearTimeout(timer);
    }
  },
};

/**
 * The local GraphQL HTTP endpoint.
 *
 * `GRAPHQL_SERVER_HOST_PORT` is the same variable the Rust side reads, so a
 * machine that moved the listener moves this with it. The bind address there is
 * `0.0.0.0`, which is a listen-on-everything wildcard and NOT a connectable
 * host — dialling it works on Linux by accident and fails on Windows, so the
 * wildcard is rewritten to loopback.
 */
export function graphqlHttpUrl(): string {
  const hostPort = process.env['GRAPHQL_SERVER_HOST_PORT'] ?? '127.0.0.1:8080';
  const [host, port] = hostPort.split(':');
  const dialHost = host === undefined || host === '' || host === '0.0.0.0' ? '127.0.0.1' : host;
  return `http://${dialHost}:${port ?? '8080'}/`;
}

/** Is the HTTP listener actually up? Cached — the answer cannot change mid-run. */
let httpAvailable: boolean | null = null;

export async function probeHttp(timeoutMs = 1_500): Promise<boolean> {
  if (httpAvailable !== null) return httpAvailable;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    // `{ __typename }` is legal against any schema and touches no table, so a
    // 200 here proves the listener is serving GraphQL rather than merely that
    // something holds the port.
    const response = await fetch(graphqlHttpUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: controller.signal,
    });
    httpAvailable = response.ok;
  } catch {
    httpAvailable = false;
  } finally {
    clearTimeout(timer);
  }

  log.debug(`HTTP GraphQL at ${graphqlHttpUrl()}: ${httpAvailable ? 'available' : 'closed'}`);
  return httpAvailable;
}

/** True when a WebdriverIO session exists, so the IPC transport can be used. */
function hasSession(): boolean {
  try {
    return typeof browser !== 'undefined' && typeof browser.executeAsync === 'function';
  } catch {
    return false;
  }
}

/**
 * Pick a transport for the current context.
 *
 * IPC first whenever a session is open: it answers against the SAME app process
 * the spec is driving, so a row the UI just wrote is guaranteed visible. HTTP
 * can only be a fallback for that reason — on a dev build both endpoints exist
 * but they are two connections to one database, and preferring the
 * out-of-process one would make a read-after-write race possible for no gain.
 */
export async function autoTransport(): Promise<GraphQLTransport> {
  if (hasSession()) return ipcTransport;
  if (await probeHttp()) return httpTransport;

  throw new Error(
    'No GraphQL transport available.\n' +
      '  - IPC needs an open WebdriverIO session (this call is outside a spec).\n' +
      '  - HTTP needs the app compiled with --features graphql_server (or a running ' +
      `tauri dev); ${graphqlHttpUrl()} did not answer.\n` +
      `ENV=${env.ENV} MODE=${env.MODE}`,
  );
}
