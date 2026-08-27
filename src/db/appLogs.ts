import fs from 'node:fs';
import path from 'node:path';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('app-logs');

const DEFAULT_TAIL_LINES = 400;

/**
 * Upper bound on how much of a log file is read from the end.
 *
 * `tauri_plugin_log::Builder::max_file_size(1048576)` (src-tauri/src/logging.rs)
 * rotates at 1 MiB, so this covers a full file twice over while still bounding
 * memory if a future build raises the cap — this runs in `afterTest`, on a
 * machine that is already driving a desktop app.
 */
const MAX_TAIL_BYTES = 2 * 1024 * 1024;

export interface AppLogOptions {
  /** `%APPDATA%` / `%LOCALAPPDATA%` folder name — `VoltPOS` for every current build. */
  identifier: string;
  tailLines?: number;
}

/**
 * The app's own log directory, `%LOCALAPPDATA%\<identifier>\logs`.
 *
 * That is what Tauri v2's `app_log_dir()` resolves to on Windows — LOCAL app
 * data, not the roaming `%APPDATA%` the databases live under.
 */
function logsDir(identifier: string): string | null {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;
  return path.join(localAppData, identifier, 'logs');
}

/**
 * The `*.log` file the app is writing to right now.
 *
 * Picked by mtime rather than by name, because the name cannot be derived:
 * `CURRENT_LOG_FILE_STEM` is resolved once at startup and never re-dated
 * (logging.rs), so an app launched at 23:50 is still writing yesterday's
 * `<YYYY-MM-DD>.log` well into the next day. Rotation adds further files.
 *
 * Deliberately not recursive. The log directory also holds `bamboo_dot/` (a
 * payment-module-only channel, same file name) and `trash/` (files an operator
 * set aside via the `app_trash_log` remote action); both would shadow the real
 * log if they happened to sort newer.
 */
function newestLogFile(dir: string): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  let newest: { file: string; mtimeMs: number } | null = null;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.log')) continue;
    const file = path.join(dir, entry.name);
    try {
      const { mtimeMs } = fs.statSync(file);
      if (!newest || mtimeMs > newest.mtimeMs) newest = { file, mtimeMs };
    } catch {
      continue;
    }
  }

  return newest?.file ?? null;
}

/** Read at most `maxBytes` from the end of a file without loading the whole thing. */
function readTail(file: string, maxBytes: number): string {
  const { size } = fs.statSync(file);
  const start = Math.max(0, size - maxBytes);
  const length = size - start;
  if (length <= 0) return '';

  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buffer, 0, length, start);
  } finally {
    fs.closeSync(fd);
  }

  const text = buffer.toString('utf8');
  if (start === 0) return text;

  // Starting mid-file lands mid-line, and mid UTF-8 sequence often enough that
  // the first "line" is mojibake. Drop it instead of reporting it as a log line.
  const firstBreak = text.indexOf('\n');
  return firstBreak === -1 ? text : text.slice(firstBreak + 1);
}

/**
 * Tail of the app's own log, for attaching to a failed test.
 *
 * A Tauri app leaves almost nothing behind on failure — there is no console to
 * reopen and no network tab — so this and the screenshot are the whole
 * post-mortem. Everything below the webview (IPC, GraphQL, migrations, the
 * SQLCipher open, the updater request) only ever reports here.
 *
 * Returns `null` rather than throwing, on every failure path: this is called
 * from `afterTest`, where losing the real failure to a bookkeeping error would
 * be a bad trade. Two null cases are normal rather than broken:
 *   - a DEBUG build logs to stdout, not to a file (logging.rs picks
 *     `TargetKind::Stdout` under `cfg!(debug_assertions)`), so there is nothing
 *     on disk to read;
 *   - a release build filters at `LevelFilter::Warn`, so a clean run can leave
 *     the file empty.
 */
export function collectAppLogs(options: AppLogOptions): string | null {
  const { identifier, tailLines = DEFAULT_TAIL_LINES } = options;
  const count = tailLines > 0 ? tailLines : DEFAULT_TAIL_LINES;

  const dir = logsDir(identifier);
  if (!dir) {
    log.debug('LOCALAPPDATA is not set — app logs are a Windows-only artifact.');
    return null;
  }

  const file = newestLogFile(dir);
  if (!file) {
    log.debug(`No *.log file under ${dir} (expected for a debug build, which logs to stdout).`);
    return null;
  }

  let text: string;
  try {
    text = readTail(file, MAX_TAIL_BYTES);
  } catch (error) {
    log.debug(`Could not read ${file}: ${(error as Error).message}`);
    return null;
  }

  const trimmed = text.replace(/\s+$/, '');
  if (trimmed === '') {
    log.debug(`${file} is empty — a release build only logs at warn level and above.`);
    return null;
  }

  log.debug(`Collected app log tail from ${file}`);
  return trimmed.split(/\r?\n/).slice(-count).join('\n');
}
