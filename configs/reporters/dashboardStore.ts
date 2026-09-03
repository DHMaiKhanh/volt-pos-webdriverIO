import fs from 'node:fs';
import path from 'node:path';
import { Paths } from '../constants/paths.js';
import { loadEnv } from '../env/loadEnv.js';
import type { DashboardHistory, DashboardRun, DashboardSpecResult, DashboardTotals } from './types.js';

/**
 * The launcher-side half of the run dashboard.
 *
 * {@link DashboardReporter} writes one fragment per spec file into
 * {@link Paths.DASHBOARD_TMP} from the WORKER processes. This module runs in the
 * LAUNCHER — the single place that sees a whole `wdio run` — and folds those
 * fragments into one {@link DashboardRun} appended to the history file the React
 * app fetches. Being the only writer of that file is the whole point: no locking,
 * no interleaving.
 *
 * Wire it from the shared config's lifecycle hooks:
 *   - `onPrepare`  → {@link beginDashboardRun}
 *   - `onComplete` → {@link finalizeDashboardRun}
 */

/** Keep history bounded — full per-test detail, so old runs are not free. */
const MAX_RUNS = 50;

const HISTORY_FILE = path.join(Paths.DASHBOARD_DATA, 'history.json');
const LATEST_FILE = path.join(Paths.DASHBOARD_DATA, 'latest.json');

/**
 * Run start, remembered across the two hooks.
 *
 * `onPrepare` and `onComplete` fire in the SAME launcher process, so plain module
 * state bridges them — no file needed. Defaults to now in case `onComplete`
 * somehow runs first.
 */
let runStartedAt = new Date();

/** `onPrepare`: clear last run's fragments and stamp this run's start. */
export function beginDashboardRun(): void {
  runStartedAt = new Date();
  try {
    fs.rmSync(Paths.DASHBOARD_TMP, { recursive: true, force: true });
    fs.mkdirSync(Paths.DASHBOARD_TMP, { recursive: true });
  } catch {
    // Non-fatal — a stale fragment at worst duplicates a spec in this run's view.
  }
}

export interface RunSummary {
  runId: string;
  totals: DashboardTotals;
  durationMs: number;
}

/**
 * `onComplete`: fold this run's fragments into a run record and append it.
 *
 * Returns a short summary for the console banner, or `null` when nothing was
 * collected (e.g. the app never booted, so no spec ran) — the caller can then
 * stay quiet rather than print an empty run.
 */
export function finalizeDashboardRun(): RunSummary | null {
  const specs = readFragments();
  if (specs.length === 0) return null;

  const env = loadEnv();
  const finishedAt = new Date();
  const totals = sumTotals(specs);
  const runId = toRunId(runStartedAt);

  const run: DashboardRun = {
    runId,
    startedAt: runStartedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.max(0, finishedAt.getTime() - runStartedAt.getTime()),
    env: {
      name: env.ENV,
      mode: env.MODE,
      merchant: env.MERCHANT_ID,
      app: env.APP_PATH ? path.basename(env.APP_PATH) : '(unresolved)',
      upstream: env.UPSTREAM_BASE_URI,
    },
    totals,
    passed: totals.failed === 0,
    specs,
  };

  writeHistory(run);
  writeJson(LATEST_FILE, run);

  // The fragments are folded in now; leave the folder empty for the next run.
  try {
    fs.rmSync(Paths.DASHBOARD_TMP, { recursive: true, force: true });
  } catch {
    /* best effort */
  }

  return { runId, totals, durationMs: run.durationMs };
}

/**
 * Read every fragment, keeping only the latest attempt of each spec.
 *
 * `specFileRetries` writes the same spec more than once with an increasing
 * `retry`; the last attempt is the result that counts, so higher `retry` wins.
 */
function readFragments(): DashboardSpecResult[] {
  let files: string[];
  try {
    files = fs.readdirSync(Paths.DASHBOARD_TMP).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const latestByFile = new Map<string, DashboardSpecResult>();
  for (const name of files) {
    const spec = safeRead(path.join(Paths.DASHBOARD_TMP, name));
    if (!spec) continue;
    const prev = latestByFile.get(spec.file);
    if (!prev || spec.retry >= prev.retry) latestByFile.set(spec.file, spec);
  }

  return [...latestByFile.values()].sort((a, b) => a.specName.localeCompare(b.specName));
}

function safeRead(file: string): DashboardSpecResult | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as DashboardSpecResult;
  } catch {
    return null;
  }
}

function sumTotals(specs: DashboardSpecResult[]): DashboardTotals {
  const totals: DashboardTotals = { tests: 0, passed: 0, failed: 0, skipped: 0, passRate: 100 };
  for (const spec of specs) {
    totals.tests += spec.totals.tests;
    totals.passed += spec.totals.passed;
    totals.failed += spec.totals.failed;
    totals.skipped += spec.totals.skipped;
  }
  const ran = totals.passed + totals.failed;
  totals.passRate = ran === 0 ? 100 : Math.round((totals.passed / ran) * 1000) / 10;
  return totals;
}

function writeHistory(run: DashboardRun): void {
  const history = readHistory();
  history.updatedAt = run.finishedAt;
  // Drop any prior record with this id (a resumed/re-run id) then push newest first.
  history.runs = [run, ...history.runs.filter((r) => r.runId !== run.runId)].slice(0, MAX_RUNS);
  writeJson(HISTORY_FILE, history);
}

function readHistory(): DashboardHistory {
  try {
    const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) as Partial<DashboardHistory>;
    if (Array.isArray(parsed.runs)) {
      return { updatedAt: parsed.updatedAt ?? '', runs: parsed.runs };
    }
  } catch {
    // Missing or corrupt — start a fresh history rather than crash the run.
  }
  return { updatedAt: '', runs: [] };
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/** `2026-09-03T10:15:30.123Z` → `2026-09-03T10-15-30-123Z` (filename/id safe). */
const toRunId = (date: Date): string => date.toISOString().replace(/[:.]/g, '-');
