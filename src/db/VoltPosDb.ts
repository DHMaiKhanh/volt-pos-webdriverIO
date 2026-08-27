import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { merchantDbDir } from '../../configs/constants/paths.js';
import { moduleLogger } from '../utils/logger.js';
import type { ConnectionName } from './reset.js';

const log = moduleLogger('VoltPosDb');

/** A value that can be bound to a `?` placeholder — mirrors node:sqlite's `SQLInputValue`. */
export type SqlParam = string | number | bigint | null | Uint8Array;

export interface VoltPosDbOptions {
  merchantId: string;
  /** `%APPDATA%` folder name — `VoltPOS` unless a build overrides the Tauri identifier. */
  identifier?: string;
  /** Which of the three connection folders to read. `Main` is the app's own data. */
  connection?: ConnectionName;
}

/** UUID file names, the only thing `PathManager::lookup` treats as a database. */
const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The database file the app itself would open.
 *
 * `PathManager::lookup` (src-tauri/src/database/connection.rs) lists the folder,
 * keeps the names that parse as a UUID, sorts DESCENDING and takes the first.
 * The uids are UUIDv7, whose leading 48 bits are a millisecond timestamp, so the
 * lexicographic maximum is the newest — and the folder really can hold several,
 * because a re-login mints a fresh uid and leaves the old files in place.
 */
function newestDbFile(dir: string): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const uids = entries
    .filter((entry) => entry.isFile() && UUID_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const newest = uids.at(-1);
  return newest === undefined ? null : path.join(dir, newest);
}

/**
 * Copy a database and its WAL siblings into a scratch directory.
 *
 * The base file first, then `-wal`/`-shm`: if the app checkpoints between the
 * two copies the WAL content is already in the base file, whereas the other
 * order can miss a transaction entirely. This is still only a best-effort
 * snapshot of a live writer — its value is that the ORIGINAL is never opened,
 * so nothing this class does can corrupt the app's data or block its writes.
 */
function copyDatabase(source: string, workDir: string): string {
  const target = path.join(workDir, path.basename(source));
  fs.copyFileSync(source, target);
  for (const suffix of ['-wal', '-shm']) {
    const sibling = `${source}${suffix}`;
    if (fs.existsSync(sibling)) fs.copyFileSync(sibling, `${target}${suffix}`);
  }
  return target;
}

/**
 * Read-only accessor over one of the app's local SQLite databases.
 *
 * READ THIS BEFORE BUILDING A SPEC ON IT. On any installed build these files
 * are SQLCipher-encrypted: `init_connection` in
 * `src-tauri/src/database/connection.rs` applies `pragma("key", …)` to every
 * connection under `if !cfg!(debug_assertions)`, using a per-merchant key the
 * server issued and the app keeps in `%APPDATA%\VoltPOS\credentials`
 * (`DeviceCredentials::sqlite_encryption_key`). `node:sqlite` links plain
 * SQLite with no cipher support and there is no API here to hand it that key,
 * so opening a release-build database FAILS — the first read of the copy throws
 * `file is not a database` — and {@link tryOpen} returns `null`.
 *
 * That is the designed outcome, not a defect to work around. Nothing in this
 * class decrypts anything. It reads plain SQLite and only that, which in
 * practice means: a DEBUG build (the `cfg!` above skips the key entirely), or a
 * file someone decrypted out of band and put in place themselves.
 *
 * Every spec must therefore SKIP rather than fail when it gets `null`:
 *
 * ```ts
 * const db = VoltPosDb.tryOpen({ merchantId: env.MERCHANT_ID });
 * if (!db) this.skip(); // encrypted build — assert through the UI instead
 * ```
 *
 * Tag such specs `Tag.DB` so a lane that only ever runs installed builds can
 * exclude them outright instead of collecting skips.
 */
export class VoltPosDb {
  /**
   * SQLite datetime modifier that turns a stored UTC timestamp into merchant
   * wall-clock time: `datetime(created_at, VoltPosDb.TZ_SQL)`.
   *
   * Every timestamp column is written as RFC3339 UTC, but nothing the app shows
   * is scoped by UTC days. `src/lib/merchant-day.ts` builds every day filter
   * from the MERCHANT's midnight — the timezone stored in `key_storage_item`
   * under `key_name = 'host.timezone'` — and the income, batch-close and
   * payroll screens all follow it. A query that counts "today's orders" over
   * UTC days disagrees with the screen for every order placed in the offset
   * window, which is exactly the evening hours a salon is busiest in.
   *
   * This is a FIXED offset for the merchant under test (UTC+7, which has no
   * DST), not a timezone lookup: SQLite ships no tz database. A merchant in a
   * DST zone — the app's pay-period code defaults to EST — needs its own
   * modifier derived from that `key_storage_item` row.
   */
  static readonly TZ_SQL = '+7 hours';

  private constructor(
    private readonly db: DatabaseSync,
    private readonly workDir: string,
    /** The app's file this snapshot was taken from — worth logging on a mismatch. */
    readonly sourceFile: string,
  ) {}

  /**
   * Snapshot the merchant's database and open the copy, or return `null`.
   *
   * `null` means "not readable", covering all of: no app data on this machine,
   * no database for this merchant, and — the usual case — SQLCipher. It never
   * throws, so a caller can decide to skip in one line.
   */
  static tryOpen(options: VoltPosDbOptions): VoltPosDb | null {
    const { merchantId, identifier, connection = 'Main' } = options;
    let workDir: string | null = null;
    let db: DatabaseSync | null = null;

    try {
      const dir = path.join(merchantDbDir(merchantId, identifier), connection);
      const source = newestDbFile(dir);
      if (source === null) {
        log.debug(`No ${connection} database for merchant ${merchantId} under ${dir}.`);
        return null;
      }

      workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'volt-pos-e2e-db-'));
      db = new DatabaseSync(copyDatabase(source, workDir), { readOnly: true });

      // The header check is not part of opening the handle — an encrypted file
      // opens fine and fails on the first read. Probe here so `tryOpen` either
      // hands back a usable object or `null`, never something that throws later
      // in the middle of an assertion.
      db.prepare('SELECT count(*) AS tables FROM sqlite_schema').get();

      log.debug(`Opened a snapshot of ${source}`);
      return new VoltPosDb(db, workDir, source);
    } catch (error) {
      try {
        db?.close();
      } catch {
        /* the handle may never have opened */
      }
      if (workDir !== null) fs.rmSync(workDir, { recursive: true, force: true });
      log.debug(
        `node:sqlite cannot read the ${connection} database of merchant ${merchantId}: ` +
          `${(error as Error).message}. Expected on a release build — the file is SQLCipher-encrypted.`,
      );
      return null;
    }
  }

  /** Close the handle and delete the scratch copy. Safe to call twice. */
  close(): void {
    try {
      this.db.close();
    } catch {
      /* already closed */
    }
    fs.rmSync(this.workDir, { recursive: true, force: true });
  }

  /**
   * Run a SELECT and return every row.
   *
   * Bind with `?` placeholders rather than interpolating: half the tables here
   * hold customer names and notes, and `order` is a SQL keyword that has to be
   * quoted (`SELECT * FROM "order"`) before it parses at all.
   */
  query<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): T[] {
    return this.db.prepare(sql).all(...params) as unknown as T[];
  }

  /** First row of a SELECT, or `undefined` when it matched nothing. */
  first<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): T | undefined {
    const row = this.db.prepare(sql).get(...params);
    return row === undefined ? undefined : (row as unknown as T);
  }
}
