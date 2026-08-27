/**
 * `npm run db:reset` / `npm run db:backup`
 *
 * A CLI over `resetDatabases()` for the app's local SQLCipher databases at
 * `%APPDATA%\VoltPOS\Databases\<merchantId>\{Main,Pulling,Pushing}`.
 *
 * ## What resetting actually costs
 *
 * The three databases are the till's local state. Wiping them forces the next
 * boot to re-run every migration and pull the merchant's catalogue down again,
 * which is why the first launch afterwards is slow. Anything sitting in the
 * Pushing database that has not synced yet is GONE — those rows are orders and
 * payments that never reached the server, and no upstream copy exists.
 *
 * That is also why `--backup-only` exists and why the destructive path takes a
 * snapshot by default.
 *
 * Flags:
 *   --backup-only    copy the databases aside and remove nothing
 *   --no-backup      skip the snapshot on a reset (fast, unrecoverable)
 *   --yes, -y        skip the interactive confirmation (CI)
 *   --merchant <id>  override MERCHANT_ID for this invocation
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { Paths, merchantDbDir } from '../configs/constants/paths.js';
import { loadEnv } from '../configs/env/loadEnv.js';
import { resetDatabases } from '../src/db/reset.js';
import { APP_IMAGE_NAMES, runningImages } from '../src/support/process.js';

const line = (text = ''): void => console.log(text);

const argv = process.argv.slice(2);
const has = (flag: string): boolean => argv.includes(flag);

function optionValue(flag: string): string | null {
  const inline = argv.find((a) => a.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = argv.indexOf(flag);
  return index >= 0 ? (argv[index + 1] ?? null) : null;
}

const backupOnly = has('--backup-only');
const skipBackup = has('--no-backup');
const assumeYes = has('--yes') || has('-y');

interface DbFile {
  relative: string;
  bytes: number;
}

function listDbFiles(root: string): DbFile[] {
  const files: DbFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile())
        files.push({ relative: path.relative(root, full), bytes: fs.statSync(full).size });
    }
  };
  walk(root);
  return files;
}

const humanBytes = (bytes: number): string => {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

async function confirm(question: string): Promise<boolean> {
  if (assumeYes) {
    line('  --yes was passed; skipping the confirmation prompt.');
    return true;
  }
  if (!process.stdin.isTTY) {
    line('  [FAIL]  Not an interactive terminal and --yes was not passed.');
    line('          Refusing to delete databases nobody can confirm. Add --yes in CI.');
    return false;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * `--backup-only` cannot go through `resetDatabases()` — that function always
 * removes. A snapshot is a plain recursive copy, so it is done here instead of
 * widening the shared API with a mode only this script would use.
 */
function snapshot(dbDir: string, merchantId: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(Paths.DB_BACKUPS, `${merchantId}-${stamp}`);
  fs.mkdirSync(Paths.DB_BACKUPS, { recursive: true });
  fs.cpSync(dbDir, dest, { recursive: true });
  return dest;
}

async function main(): Promise<number> {
  const env = loadEnv();
  const merchantId = optionValue('--merchant') ?? env.MERCHANT_ID;

  line();
  line('='.repeat(78));
  line(` VOLT POS E2E — ${backupOnly ? 'database snapshot' : 'DATABASE RESET'}  (ENV=${env.ENV})`);
  line('='.repeat(78));
  line(` Merchant       ${merchantId}`);
  line(` Identifier     ${env.APP_IDENTIFIER}`);
  line('='.repeat(78));
  line();

  // A prod build is someone's till. Its Pushing database holds real orders that
  // have not reached the server yet, and there is no upstream copy to restore
  // from — so the destructive path is not offered here at any confirmation
  // level. A snapshot only reads, so it stays available: it is exactly what you
  // want before touching a live machine.
  if (env.ENV === 'prod' && !backupOnly) {
    line('  [FAIL]  Refusing to reset databases with ENV=prod.');
    line();
    line('  A production build is a LIVE TILL. Its Pushing database holds orders and payments');
    line('  that have not synced yet; deleting them destroys the only copy that exists. The');
    line("  Main database is the merchant's working state for the day.");
    line();
    line('  There is no override flag for this. If you really need a clean prod machine, do it');
    line('  deliberately and by hand, after taking a snapshot:');
    line();
    line('      npm run db:backup');
    line();
    line('  For test data, run the lane against dev or staging instead:');
    line();
    line('      cross-env ENV=dev npm run db:reset');
    line();
    return 1;
  }

  let dbDir: string;
  try {
    dbDir = merchantDbDir(merchantId, env.APP_IDENTIFIER);
  } catch (error) {
    line(`  [FAIL]  ${(error as Error).message}`);
    line();
    return 1;
  }

  line(` Target         ${dbDir}`);
  line();

  if (!fs.existsSync(dbDir)) {
    line('  [ OK ]  Nothing to do — that directory does not exist.');
    line('          The app creates it on the first successful login for this merchant.');
    line();
    return 0;
  }

  const files = listDbFiles(dbDir);
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);

  line(` ${String(files.length)} file(s), ${humanBytes(totalBytes)}:`);
  for (const file of files) line(`   ${file.relative.padEnd(52)} ${humanBytes(file.bytes).padStart(10)}`);
  line();
  line(' Not touched: credentials and settings.json under %APPDATA%\\' + env.APP_IDENTIFIER + '.');
  line(' The session stays logged in; only the local data is affected.');
  line();

  if (backupOnly) {
    const dest = snapshot(dbDir, merchantId);
    line(`  [ OK ]  Snapshot written to ${dest}`);
    line('          Nothing was removed. Restore by copying the folder back over the target.');
    line();
    return 0;
  }

  // SQLCipher keeps -wal and -shm alongside each database. Deleting them under a
  // live process leaves the app writing into handles whose files are gone, and
  // the app then re-creates a half-state that looks like corruption on the next
  // boot. Stop the app first, always.
  const live = runningImages(APP_IMAGE_NAMES);
  if (live.length) {
    line(`  [FAIL]  The app is still running: ${live.join(', ')}`);
    line();
    line('  Deleting an open SQLCipher database (and its -wal / -shm siblings) leaves the app');
    line('  writing to handles whose files no longer exist. Close it first:');
    line();
    line('      npm run app:kill');
    line();
    return 1;
  }

  line(' This DELETES the local Main, Pulling and Pushing databases for this merchant.');
  line(' Un-synced rows in Pushing are unrecoverable — no upstream copy exists.');
  if (skipBackup) line(' --no-backup was passed: NO snapshot will be taken.');
  line();

  const approved = await confirm(` Type "yes" to delete ${String(files.length)} file(s) from ${dbDir}: `);
  if (!approved) {
    line();
    line('  [SKIP]  Cancelled. Nothing was removed.');
    line();
    return 1;
  }

  line();
  const result = resetDatabases({ merchantId, identifier: env.APP_IDENTIFIER, backup: !skipBackup });

  line(`  [ OK ]  Removed ${String(result.removed.length)} file(s).`);
  for (const removed of result.removed) line(`          ${removed}`);
  line();
  if (result.backupPath) {
    line(`  [ OK ]  Snapshot kept at ${result.backupPath}`);
  } else {
    line('  [WARN]  No snapshot was taken. This reset cannot be undone.');
  }
  line();
  line(' The next app launch re-runs every migration and pulls the catalogue again, so the');
  line(' first boot after a reset is slow. Budget the full Timeouts.APP_BOOT window for it.');
  line();
  return 0;
}

process.exitCode = await main();
