/**
 * Local-database side of the suite: everything that reads or clears the app's
 * own state on disk, outside the WebDriver session.
 *
 * The three modules are deliberately independent of `loadEnv()` — they take the
 * merchant and identifier as arguments so `scripts/reset-db.ts` can run them
 * against a machine with no `.env` at all.
 */
export { CONNECTION_DIRS, resetDatabases } from './reset.js';
export type { ConnectionName, ResetOptions, ResetResult } from './reset.js';

export { collectAppLogs } from './appLogs.js';
export type { AppLogOptions } from './appLogs.js';

export { VoltPosDb } from './VoltPosDb.js';
export type { SqlParam, VoltPosDbOptions } from './VoltPosDb.js';
