import type { DashboardSuite, DashboardTest, TestState } from '../types';

export interface FlatTest {
  test: DashboardTest;
  /** `Outer › Inner` — the describe chain that owns the test, for context. */
  suitePath: string;
}

/** Depth-first flatten of a spec's suite tree into a labelled test list. */
export function flattenTests(suites: DashboardSuite[], prefix = ''): FlatTest[] {
  const out: FlatTest[] = [];
  for (const suite of suites) {
    const path = prefix ? `${prefix} › ${suite.title}` : suite.title;
    for (const test of suite.tests) out.push({ test, suitePath: path });
    out.push(...flattenTests(suite.suites, path));
  }
  return out;
}

/** Skips and Mocha-pending both read as "skipped" to the filter chips. */
export function bucket(state: TestState): 'passed' | 'failed' | 'skipped' {
  if (state === 'passed' || state === 'failed') return state;
  return 'skipped';
}
