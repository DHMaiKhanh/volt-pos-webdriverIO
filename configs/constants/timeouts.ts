/**
 * Central timeout budget.
 *
 * WHY a single table: a desktop Tauri app is materially slower to become
 * interactive than a web page — the splash screen runs migrations, opens three
 * SQLCipher databases and performs a sync handshake before the router even
 * mounts. Scattering ad-hoc `{ timeout: 30000 }` across specs makes a slow
 * environment look like a broken selector. Everything waits through these names
 * so one edit re-tunes the whole suite.
 */
export const Timeouts = {
  /** UI reaction to a click that does not hit the network. */
  ANIMATION: 500,
  /** Debounced inputs (search boxes) before the query fires. */
  DEBOUNCE: 800,
  /** A local element that should already be on screen. */
  SHORT: 5_000,
  /** An element gated by a local GraphQL/IPC round trip. */
  MEDIUM: 15_000,
  /** An element gated by an upstream API call or a route transition. */
  LONG: 30_000,
  /** Route change inside the SPA. */
  NAVIGATION: 30_000,
  /** Upstream HTTP (sync push/pull, payment gateway). */
  API: 30_000,
  /** Splash screen: migrations + DB open + first sync. Measured worst case ~50s cold. */
  APP_BOOT: 90_000,
  /** tauri-driver / msedgedriver must answer on its port within this window. */
  DRIVER_READY: 20_000,
  /** Per-test ceiling handed to Mocha. */
  MOCHA_TEST: 120_000,
  /** Per-hook ceiling handed to Mocha (before/after blocks do the app boot). */
  MOCHA_HOOK: 180_000,
} as const;

export type TimeoutKey = keyof typeof Timeouts;
