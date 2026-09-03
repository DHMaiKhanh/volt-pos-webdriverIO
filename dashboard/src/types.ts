/**
 * Mirror of `configs/reporters/types.ts` in the test project.
 *
 * This app is a separate package with its own tsconfig, so the shapes are
 * duplicated rather than imported. Keep the two files in sync when either
 * changes — they are intentionally small so that stays cheap.
 */

export type TestState = 'passed' | 'failed' | 'skipped' | 'pending';

export interface DashboardTest {
  title: string;
  fullTitle: string;
  state: TestState;
  durationMs: number;
  error?: string;
  stack?: string;
  retries?: number;
}

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
  passRate: number;
}

export interface DashboardSpecResult {
  cid: string;
  file: string;
  specName: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  retry: number;
  suites: DashboardSuite[];
  totals: DashboardTotals;
}

export interface DashboardRunEnv {
  name: string;
  mode: string;
  merchant: string;
  app: string;
  upstream: string;
}

export interface DashboardRun {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  env: DashboardRunEnv;
  totals: DashboardTotals;
  passed: boolean;
  specs: DashboardSpecResult[];
}

export interface DashboardHistory {
  updatedAt: string;
  runs: DashboardRun[];
}
