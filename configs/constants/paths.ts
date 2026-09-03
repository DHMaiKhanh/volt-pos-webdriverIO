import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repository root of THIS test project (…/e2e_volt_pos_webdriverIO). */
export const ROOT = path.resolve(here, '..', '..');

export const Paths = {
  ROOT,
  CONFIGS: path.join(ROOT, 'configs'),
  ENV_DIR: path.join(ROOT, 'configs', 'env'),
  SRC: path.join(ROOT, 'src'),
  TESTS: path.join(ROOT, 'tests'),
  SCRIPTS: path.join(ROOT, 'scripts'),

  /** Everything a run produces. Wiped by `npm run clean`. */
  REPORTS: path.join(ROOT, 'reports'),
  ALLURE_RESULTS: path.join(ROOT, 'reports', 'allure-results'),
  ALLURE_REPORT: path.join(ROOT, 'reports', 'allure-report'),
  SCREENSHOTS: path.join(ROOT, 'reports', 'screenshots'),
  APP_LOGS: path.join(ROOT, 'reports', 'app-logs'),
  LOGS: path.join(ROOT, 'logs'),
  TMP: path.join(ROOT, '.tmp'),

  /**
   * Self-contained React app that visualises run history — its own package,
   * NOT wiped by `npm run clean`.
   */
  DASHBOARD: path.join(ROOT, 'dashboard'),
  /** Where the run history the app fetches is persisted (survives `clean`). */
  DASHBOARD_DATA: path.join(ROOT, 'dashboard', 'public', 'data'),
  /**
   * Per-run scratch: the reporter drops one file per spec here, the store folds
   * them into a run at `onComplete`. Under `reports/` so `clean` wipes it.
   */
  DASHBOARD_TMP: path.join(ROOT, 'reports', '.dashboard-tmp'),

  /** Driver binaries installed by scripts/setup-drivers.ts. */
  DRIVERS: path.join(ROOT, '.drivers'),
  /** DB snapshots taken before a destructive reset. */
  DB_BACKUPS: path.join(ROOT, '.db-backups'),
} as const;

/**
 * Windows roaming app-data root of the app under test.
 *
 * The app's Tauri identifier is overridden to `VoltPOS` in
 * `src-tauri/tauri.windows.conf.json`, so `app_data_dir()` resolves to
 * `%APPDATA%\VoltPOS` — NOT `%APPDATA%\com.fastboy.volt-pos`, which is what the
 * base `tauri.conf.json` identifier would suggest. Getting this wrong makes
 * every DB helper silently no-op.
 */
export function appDataRoot(identifier = process.env.APP_IDENTIFIER ?? 'VoltPOS'): string {
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error('APPDATA is not set — the DB helpers only work on Windows.');
  }
  return path.join(appData, identifier);
}

/** `%APPDATA%\VoltPOS\Databases\<merchantId>` — holds Main / Pulling / Pushing. */
export function merchantDbDir(merchantId: string, identifier?: string): string {
  return path.join(appDataRoot(identifier), 'Databases', merchantId);
}
