import fs from 'node:fs';
import path from 'node:path';
import { Paths, merchantDbDir } from '../../configs/constants/paths.js';
import { APP_IMAGE_NAMES, runningImages } from '../support/process.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('db-reset');

/**
 * The connection folders the app creates under a merchant, spelled exactly as
 * `ConnectionType` serializes them in `src-tauri/src/database/connection.rs`.
 *
 * Wiping only `Main` is not a reset. `Pushing` holds rows the app has not yet
 * handed to `/syncing/pushing` and replays them on the next launch, and
 * `Pulling` holds the server's side of the handshake; leave either in place and
 * the "clean" merchant comes back partly populated a few seconds after boot.
 */
export const CONNECTION_DIRS = ['Main', 'Pulling', 'Pushing'] as const;

export type ConnectionName = (typeof CONNECTION_DIRS)[number];

/**
 * Every connection is opened with `journal_mode(SqliteJournalMode::Wal)`
 * (connection.rs `init_connection`), so a database is always three files:
 * `<uuid>`, `<uuid>-wal`, `<uuid>-shm`.
 *
 * Deleting only `<uuid>` does not empty the database — it strands a WAL that
 * SQLite replays into the next file created under that name, resurrecting the
 * orders the reset was supposed to remove. Siblings go first, which is also the
 * order the app itself uses in `PathManager::remove_path`.
 */
const SIBLING_SUFFIXES = ['-wal', '-shm'] as const;

export interface ResetOptions {
  merchantId: string;
  identifier?: string;
  backup?: boolean;
}

export interface ResetResult {
  /** Absolute paths actually deleted, siblings included. */
  removed: string[];
  /** Where the pre-delete snapshot was written, or `null` when none was asked for. */
  backupPath: string | null;
}

/** `2026-08-26T09-41-07-812Z`: colons and dots are not legal in a Windows path segment. */
const fileStamp = (): string => new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Files to delete from one connection folder, siblings ordered before their base.
 *
 * The folder can legitimately hold more than one database: every login mints a
 * fresh uid (`ConnectionStackFactory::factory`) and the previous set is left on
 * disk, so a reset that only handled the newest uid would leave a full history
 * behind for the app to pick up again.
 */
function dbFilesIn(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const present = new Set(names);
  const ordered: string[] = [];
  const seen = new Set<string>();

  const push = (name: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    ordered.push(path.join(dir, name));
  };

  for (const base of names.filter((name) => !SIBLING_SUFFIXES.some((s) => name.endsWith(s)))) {
    for (const suffix of SIBLING_SUFFIXES) {
      if (present.has(`${base}${suffix}`)) push(`${base}${suffix}`);
    }
    push(base);
  }

  // A -wal whose base is already gone is the exact failure this module exists to
  // prevent, so sweep the leftovers of a previous half-done reset too.
  for (const name of names) push(name);

  return ordered;
}

/**
 * Delete the local SQLCipher databases of one merchant.
 *
 * Used to put a session on a known-empty device: no cached orders, no pending
 * push queue, no half-finished batch. The app rebuilds all three databases and
 * re-runs its migrations on the next boot, which is why `Timeouts.APP_BOOT` has
 * to cover a first launch and not just a warm one.
 *
 * Missing folders are not an error — a machine that has never run the app, or a
 * merchant that was already reset, both return `removed: []`.
 *
 * @throws if the app is still running, or if a file cannot be deleted.
 */
export function resetDatabases(options: ResetOptions): ResetResult {
  const { merchantId, identifier, backup = false } = options;

  // The app keeps every connection open for its whole lifetime with a 30s busy
  // timeout. Deleting the file out from under a live SQLCipher connection on
  // Windows either fails with EBUSY or, worse, succeeds for the -wal only and
  // leaves the app writing into a handle whose directory entry is gone — which
  // surfaces much later as a corrupted database rather than as this reset.
  const blocking = runningImages(APP_IMAGE_NAMES);
  if (blocking.length > 0) {
    throw new Error(
      `Refusing to reset the databases of merchant ${merchantId}: ${blocking.join(', ')} is ` +
        `still running and holds the SQLCipher files open. Close the app first — ` +
        `killStaleProcesses() from src/support/process.ts, or \`npm run app:kill\`.`,
    );
  }

  const merchantDir = merchantDbDir(merchantId, identifier);
  if (!fs.existsSync(merchantDir)) {
    log.debug(`Nothing to reset: ${merchantDir} does not exist.`);
    return { removed: [], backupPath: null };
  }

  let backupPath: string | null = null;
  if (backup) {
    backupPath = path.join(Paths.DB_BACKUPS, `${merchantId}-${fileStamp()}`);
    fs.mkdirSync(backupPath, { recursive: true });
    fs.cpSync(merchantDir, backupPath, { recursive: true });
    log.info(`Snapshot of ${merchantDir} kept at ${backupPath}`);
  }

  const removed: string[] = [];
  const failed: string[] = [];

  for (const connection of CONNECTION_DIRS) {
    for (const file of dbFilesIn(path.join(merchantDir, connection))) {
      try {
        fs.rmSync(file, { force: true });
        removed.push(file);
      } catch (error) {
        failed.push(`${file} (${(error as Error).message})`);
      }
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `Reset of merchant ${merchantId} left ${String(failed.length)} file(s) behind:\n  ` +
        `${failed.join('\n  ')}\n` +
        `A partial reset is worse than none — the surviving -wal is replayed on the next boot. ` +
        `Check for a stray process holding a handle before rerunning.`,
    );
  }

  log.debug(`Removed ${String(removed.length)} database file(s) under ${merchantDir}`);
  return { removed, backupPath };
}
