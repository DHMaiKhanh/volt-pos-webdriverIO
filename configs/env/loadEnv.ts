import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Paths } from '../constants/paths.js';
import { resolveAppPath } from './resolveApp.js';

export type EnvName = 'dev' | 'staging' | 'prod';
export type RunMode = 'launch' | 'attach';

export interface AppEnv {
  /** Which BUILD of the app is under test. Not a runtime switch — see below. */
  ENV: EnvName;
  /**
   * `launch` — tauri-driver starts the binary itself (the default, and the only
   * mode that gives a clean per-session app).
   * `attach` — connect to an app a human already started with WebView2 remote
   * debugging enabled. The only way to drive an existing production install
   * in place, without reinstalling anything.
   */
  MODE: RunMode;

  // ── Binary under test ──────────────────────────────────────────────────────
  APP_PATH: string;
  APP_ARGS: string[];
  /** `%APPDATA%` folder name — `VoltPOS` unless a build overrides the identifier. */
  APP_IDENTIFIER: string;
  /** App repo checkout, used for the debug-build fallback and `audit:testids`. */
  VOLT_POS_SRC: string;

  // ── Backend this build was COMPILED against ────────────────────────────────
  /**
   * These mirror `src-tauri/build.rs`, which bakes them in with
   * `cargo:rustc-env` and reads them back through the compile-time `env!()`
   * macro. They exist here for ASSERTION and reporting only: nothing the suite
   * sets at runtime can move a build from dev to production. Pointing at
   * another environment means installing another binary.
   */
  UPSTREAM_BASE_URI: string;
  UPSTREAM_AUTH_BASE_URI: string;
  UPDATER_ENDPOINT: string;

  // ── Account / data under test ──────────────────────────────────────────────
  MERCHANT_ID: string;
  /**
   * The credential for `/login-staff-token`.
   *
   * There is no username/password pair to hold: `/login` is a QR login
   * (`volt-pos/src/routes/login/index.tsx`), so the single `staffToken` field on
   * the secret-tap route is the only credential this suite can type. Usually
   * unset and unused — a device stays authenticated between runs — and needed
   * only to recover one that has been signed out.
   */
  STAFF_TOKEN: string;
  /** Owner-level passcode — unlocks settings, reports, refunds. */
  OWNER_PASSCODE: string;
  /** Staff passcode used by payment flows (needs `completed_payment`). */
  STAFF_PASSCODE: string;
  STAFF_NAME: string;

  // ── Safety rails ───────────────────────────────────────────────────────────
  /**
   * Whether specs may CREATE data (orders, payments, refunds).
   *
   * Forced `false` for `prod` unless `ALLOW_PROD_WRITES=i-know-what-i-am-doing`.
   * A production build talks to the live payment gateway and pushes every local
   * row upstream through `/syncing/pushing`, so a stray checkout spec bills a
   * real merchant.
   */
  WRITE_ALLOWED: boolean;
  /** Wipe the local SQLCipher databases before the session. Never on prod. */
  RESET_DB: boolean;
  /**
   * Auto-dismiss the software-updater toast / forced-update screen when it
   * appears.
   *
   * It cannot be blocked at the source: the endpoint is baked into
   * `tauri.<env>.conf.json` and the check runs from Rust (reqwest), out of the
   * webview's reach. The app also treats EVERY response as newer — its
   * comparator is `|_current, _update| true` — so an installed build under test
   * will reliably raise the toast, and the toast overlays the top-right of the
   * screen where real controls live. Hard-blocking needs a hosts entry; see
   * docs/troubleshooting.md.
   */
  AUTO_DISMISS_UPDATER: boolean;

  // ── Drivers ────────────────────────────────────────────────────────────────
  DRIVER_HOST: string;
  DRIVER_PORT: number;
  TAURI_DRIVER_PATH: string;
  MSEDGEDRIVER_PATH: string;
  /** WebView2 CDP port used by `attach` mode. */
  REMOTE_DEBUG_PORT: number;

  // ── Run behaviour ──────────────────────────────────────────────────────────
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  SPEC_RETRIES: number;
  /** Draw the current step in an overlay inside the app window. */
  SHOW_STEPS: boolean;
  /** Leave the app running after the session — for debugging a failure by hand. */
  KEEP_APP_OPEN: boolean;
}

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const toInt = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

type BackendDefaults = Pick<AppEnv, 'UPSTREAM_BASE_URI' | 'UPSTREAM_AUTH_BASE_URI' | 'UPDATER_ENDPOINT'>;

/**
 * Per-environment endpoints, transcribed from the app repo so a mismatch is
 * visible without opening the Rust source:
 *   - `src-tauri/build.rs`                 → UPSTREAM_* defaults
 *   - `src-tauri/tauri.<env>.conf.json`    → updater endpoint
 */
const ENV_DEFAULTS: Record<EnvName, BackendDefaults> = {
  dev: {
    UPSTREAM_BASE_URI: 'https://volt-pos.v2.dev-fastboypay.com',
    UPSTREAM_AUTH_BASE_URI: 'https://sys.v2.dev-fastboypay.com',
    UPDATER_ENDPOINT: 'https://volt-pos.v2.dev-fastboypay.com/auto_update/check_version_update',
  },
  staging: {
    UPSTREAM_BASE_URI: 'https://sys.stage.volt-pos.fastboy.dev',
    UPSTREAM_AUTH_BASE_URI: 'https://sys.stage.volt-pos.fastboy.dev',
    UPDATER_ENDPOINT: 'https://sys.stage.volt-pos.fastboy.dev/auto_update/check_version_update',
  },
  prod: {
    UPSTREAM_BASE_URI: 'https://volt-pos.v2.fastboypay.com',
    UPSTREAM_AUTH_BASE_URI: 'https://sys.v2.fastboypay.com',
    UPDATER_ENDPOINT: 'https://volt-pos.v2.fastboypay.com/auto_update/check_version_update',
  },
};

let cached: AppEnv | null = null;

/**
 * Build the run configuration.
 *
 * Precedence, highest first:
 *   1. Real process env — the CI secret store, and `cross-env ENV=…`
 *   2. `configs/env/.env.<ENV>`   (git-ignored, per-machine)
 *   3. `configs/env/.env.local`   (git-ignored, personal overrides)
 *   4. `configs/env/.env.example` (tracked defaults)
 *
 * `dotenv` runs with `override: false`, so step 1 always wins.
 */
export function loadEnv(force = false): AppEnv {
  if (cached && !force) return cached;

  const envName = (process.env.ENV ?? 'dev') as EnvName;
  if (!['dev', 'staging', 'prod'].includes(envName)) {
    throw new Error(`Unknown ENV="${envName}". Expected one of: dev | staging | prod.`);
  }

  for (const file of [`.env.${envName}`, '.env.local', '.env.example']) {
    const full = path.join(Paths.ENV_DIR, file);
    if (fs.existsSync(full)) dotenv.config({ path: full, override: false });
  }

  const defaults = ENV_DEFAULTS[envName];
  const voltPosSrc = process.env.VOLT_POS_SRC ?? '';
  const appPath = resolveAppPath(process.env.APP_PATH, voltPosSrc) ?? '';

  // Production writes need a deliberate, spelled-out opt-in. A plain boolean is
  // too easy to flip by accident in a CI matrix.
  const prodWriteOptIn = process.env.ALLOW_PROD_WRITES === 'i-know-what-i-am-doing';
  const writeAllowed = envName === 'prod' ? prodWriteOptIn : toBool(process.env.WRITE_ALLOWED, true);

  cached = {
    ENV: envName,
    MODE: (process.env.WDIO_MODE as RunMode | undefined) ?? 'launch',

    APP_PATH: appPath,
    APP_ARGS: toList(process.env.APP_ARGS),
    APP_IDENTIFIER: process.env.APP_IDENTIFIER ?? 'VoltPOS',
    VOLT_POS_SRC: voltPosSrc,

    UPSTREAM_BASE_URI: process.env.UPSTREAM_BASE_URI ?? defaults.UPSTREAM_BASE_URI,
    UPSTREAM_AUTH_BASE_URI: process.env.UPSTREAM_AUTH_BASE_URI ?? defaults.UPSTREAM_AUTH_BASE_URI,
    UPDATER_ENDPOINT: process.env.UPDATER_ENDPOINT ?? defaults.UPDATER_ENDPOINT,

    MERCHANT_ID: process.env.MERCHANT_ID ?? '14',
    STAFF_TOKEN: process.env.STAFF_TOKEN ?? '',
    OWNER_PASSCODE: process.env.OWNER_PASSCODE ?? '8888',
    STAFF_PASSCODE: process.env.STAFF_PASSCODE ?? '9999',
    STAFF_NAME: process.env.STAFF_NAME ?? '',

    WRITE_ALLOWED: writeAllowed,
    RESET_DB: envName === 'prod' ? false : toBool(process.env.RESET_DB, false),
    AUTO_DISMISS_UPDATER: toBool(process.env.AUTO_DISMISS_UPDATER, true),

    DRIVER_HOST: process.env.DRIVER_HOST ?? '127.0.0.1',
    DRIVER_PORT: toInt(process.env.DRIVER_PORT, 4444),
    TAURI_DRIVER_PATH: process.env.TAURI_DRIVER_PATH ?? '',
    MSEDGEDRIVER_PATH: process.env.MSEDGEDRIVER_PATH ?? '',
    REMOTE_DEBUG_PORT: toInt(process.env.REMOTE_DEBUG_PORT, 9222),

    LOG_LEVEL: (process.env.LOG_LEVEL as AppEnv['LOG_LEVEL'] | undefined) ?? 'info',
    SPEC_RETRIES: toInt(process.env.SPEC_RETRIES, envName === 'prod' ? 0 : 1),
    SHOW_STEPS: toBool(process.env.SHOW_STEPS, true),
    KEEP_APP_OPEN: toBool(process.env.KEEP_APP_OPEN, false),
  };

  return cached;
}

/**
 * Guard every data-creating flow with this.
 *
 * Throwing — rather than skipping — is deliberate: a checkout spec that
 * silently no-ops against production reads as a pass and hides the fact that
 * the lane was never covered at all.
 */
export function assertWritesAllowed(action: string): void {
  const current = loadEnv();
  if (current.WRITE_ALLOWED) return;
  throw new Error(
    `Refusing to "${action}" against ENV=${current.ENV}: writes are disabled.\n` +
      `A ${current.ENV} build talks to ${current.UPSTREAM_BASE_URI} and the live payment ` +
      `gateway, so creating orders here bills a real merchant.\n` +
      `Run this spec against dev/staging, or set ALLOW_PROD_WRITES=i-know-what-i-am-doing.`,
  );
}

export const env: AppEnv = loadEnv();
