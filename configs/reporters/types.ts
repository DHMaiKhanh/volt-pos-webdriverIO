/**
 * Shared shapes for the run dashboard.
 *
 * Two producers write these: {@link ../reporters/DashboardReporter.ts} emits one
 * {@link DashboardSpecResult} per spec file into a per-run temp folder, and
 * {@link ../reporters/dashboardStore.ts} folds every spec of a run into one
 * {@link DashboardRun} appended to the dashboard's history file.
 *
 * The React app under `dashboard/` keeps its OWN copy of these types
 * (`dashboard/src/types.ts`) because it is a separate package with a separate
 * tsconfig — the two must be kept in sync by hand. Keep them small for exactly
 * that reason.
 */

/** A test's final state. `pending` is Mocha's `it.skip`/`describe.skip`. */
export type TestState = 'passed' | 'failed' | 'skipped' | 'pending';

export interface DashboardTest {
  title: string;
  fullTitle: string;
  state: TestState;
  durationMs: number;
  /** Present only for `failed` — the first line of the assertion error. */
  error?: string;
  /** Present only for `failed` — a trimmed stack for the detail drawer. */
  stack?: string;
  /** Mocha test-level retries consumed before this result. */
  retries?: number;
}

/** A `describe` block. Suites nest; tests hang off the leaf that owns them. */
export interface DashboardSuite {
  title: string;
  tests: DashboardTest[];
  suites: DashboardSuite[];
}

export interface DashboardTotals {
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  /** 0–100, `passed / tests`. `100` for an empty spec so it never reads red. */
  passRate: number;
}

/**
 * One spec FILE's result — the unit the reporter writes.
 *
 * `specFileRetries` reruns a whole file as a fresh runner, so the same `file`
 * can be written more than once with an increasing `retry`; the store keeps the
 * highest.
 */
export interface DashboardSpecResult {
  cid: string;
  /** Absolute path of the `.spec.ts`. */
  file: string;
  /** `tests`-relative, extension-stripped, forward-slashed — the display name. */
  specName: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** 0 on the first attempt, 1+ on a `specFileRetries` rerun. */
  retry: number;
  suites: DashboardSuite[];
  totals: DashboardTotals;
}

/** The build/account context a run was executed against — for the run header. */
export interface DashboardRunEnv {
  name: string;
  mode: string;
  merchant: string;
  app: string;
  upstream: string;
}

/** One whole `wdio run` — the unit the dashboard lists and trends. */
export interface DashboardRun {
  /** Sortable, filename-safe timestamp id, e.g. `2026-09-03T10-15-30-123Z`. */
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  env: DashboardRunEnv;
  totals: DashboardTotals;
  /** True when nothing failed — the one-glance verdict for the run row. */
  passed: boolean;
  specs: DashboardSpecResult[];
}

/** The file the React app fetches: newest run first, capped by the store. */
export interface DashboardHistory {
  updatedAt: string;
  runs: DashboardRun[];
}
