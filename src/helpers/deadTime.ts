import fs from 'node:fs';
import path from 'node:path';
import { Paths } from '../../configs/constants/paths.js';

/**
 * Dead-time ledger for one spec file — where a run spends time NOT driving the app.
 *
 * Two kinds, both invisible in a test's own duration breakdown:
 *   - `settle`: blind {@link settle} pauses.
 *   - `absent`: optional-element probes that waited their whole timeout for
 *     something that never showed (`isVisible` / `exists` returning false).
 *
 * Root hooks flush it per file to `.tmp/dead-time.jsonl`, so a bulk run says
 * which helpers to tighten instead of guessing from the step log.
 */
const ledger = { settleMs: 0, settleCount: 0, absentMs: 0, absentCount: 0 };
/** Absent probes by locator, slowest first in the flush — the actionable part. */
const absentBy = new Map<string, { ms: number; count: number }>();

export function recordSettle(ms: number): void {
  ledger.settleMs += ms;
  ledger.settleCount += 1;
}

export function recordAbsent(what: string, ms: number): void {
  // Only probes that really waited — an instant "no" costs nothing.
  if (ms < 250) return;
  ledger.absentMs += ms;
  ledger.absentCount += 1;
  const row = absentBy.get(what) ?? { ms: 0, count: 0 };
  row.ms += ms;
  row.count += 1;
  absentBy.set(what, row);
}

/** Append this file's totals to `.tmp/dead-time.jsonl` and reset. Never throws. */
export function flushDeadTime(spec: string): void {
  try {
    const top = [...absentBy.entries()]
      .sort((a, b) => b[1].ms - a[1].ms)
      .slice(0, 8)
      .map(([what, v]) => ({ what, ...v }));
    fs.mkdirSync(Paths.TMP, { recursive: true });
    fs.appendFileSync(
      path.join(Paths.TMP, 'dead-time.jsonl'),
      `${JSON.stringify({ spec, at: new Date().toISOString(), ...ledger, top })}\n`,
    );
  } catch {
    /* diagnostics only */
  }
  ledger.settleMs = 0;
  ledger.settleCount = 0;
  ledger.absentMs = 0;
  ledger.absentCount = 0;
  absentBy.clear();
}
