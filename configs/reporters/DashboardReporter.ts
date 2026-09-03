import fs from 'node:fs';
import path from 'node:path';
import WDIOReporter, { type RunnerStats, type SuiteStats, type TestStats } from '@wdio/reporter';
import { Paths } from '../constants/paths.js';
import type {
  DashboardSpecResult,
  DashboardSuite,
  DashboardTest,
  DashboardTotals,
  TestState,
} from './types.js';

/**
 * Per-spec-file sink for the run dashboard.
 *
 * ## Why a reporter and not a config hook
 *
 * WebdriverIO reporters get the fully-built suite/test tree for free — the base
 * `WDIOReporter` accumulates every `describe`/`it` into `currentSuites[0]` (its
 * synthetic `(root)` suite) with durations and errors already attached. A
 * `afterTest` hook would hand back one test at a time and leave the nesting and
 * spec-file boundaries to reassemble by hand.
 *
 * ## What it writes, and why per-spec
 *
 * Each runner (one spec file) emits ONE json file into {@link Paths.DASHBOARD_TMP}.
 * It deliberately does NOT touch the history file: reporters run in the worker
 * process, one per spec, and several could be interleaved. Aggregating there
 * would mean concurrent read-modify-write on a shared file. Instead the launcher
 * folds these fragments into a single run at `onComplete` — see
 * {@link ./dashboardStore.ts} — where it is the only writer.
 *
 * `specFileRetries` reruns a whole file as a NEW runner, so the same file may be
 * written twice with an increasing `retry`; the store keeps the highest.
 */
export default class DashboardReporter extends WDIOReporter {
  /** Reporter runs sync file I/O only — never hold up shutdown. */
  override get isSynchronised(): boolean {
    return true;
  }

  override onRunnerEnd(runner: RunnerStats): void {
    try {
      this.persist(runner);
    } catch (error) {
      // A dashboard is a convenience, never a gate. A broken write must not
      // fail the spec that just passed.
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[dashboard] skipped writing spec result: ${reason}`);
    }
  }

  private persist(runner: RunnerStats): void {
    // `currentSuites[0]` is the base reporter's `(root)` suite. Every real
    // `describe` is a child of it; by runner:end each has been popped back off
    // `currentSuites`, so the root is all that remains and holds the whole tree.
    const root = this.currentSuites[0];
    const suites = (root?.suites ?? []).map((s) => this.toSuite(s)).filter(hasContent);

    const totals = tallyTree(suites);
    const file = runner.specs[0] ?? this.specs[0] ?? 'unknown-spec';
    const durationMs = runner.duration ?? 0;
    const end = runner.end ?? new Date();
    const start = runner.start ?? new Date(end.getTime() - durationMs);

    const result: DashboardSpecResult = {
      cid: runner.cid,
      file,
      specName: specName(file),
      startedAt: start.toISOString(),
      finishedAt: end.toISOString(),
      durationMs,
      retry: runner.retry ?? 0,
      suites,
      totals,
    };

    fs.mkdirSync(Paths.DASHBOARD_TMP, { recursive: true });
    // cid + retry keeps concurrent workers and retried attempts from colliding
    // on the same filename; the store dedupes by spec path afterwards.
    const name = `${sanitize(result.specName)}__${runner.cid}__r${result.retry}.json`;
    fs.writeFileSync(path.join(Paths.DASHBOARD_TMP, name), JSON.stringify(result, null, 2));
  }

  private toSuite(suite: SuiteStats): DashboardSuite {
    return {
      title: suite.title,
      tests: suite.tests.map((t) => this.toTest(t)),
      suites: suite.suites.map((s) => this.toSuite(s)).filter(hasContent),
    };
  }

  private toTest(test: TestStats): DashboardTest {
    const state = normaliseState(test.state);
    const base: DashboardTest = {
      title: test.title,
      fullTitle: test.fullTitle,
      state,
      durationMs: test.duration ?? 0,
      retries: test.retries ?? 0,
    };
    if (state !== 'failed') return base;

    // WDIO exposes both `error` and `errors[]`; the first error is the one the
    // spec reporter prints, so match that.
    const err = test.error ?? test.errors?.[0];
    return {
      ...base,
      error: firstLine(err?.message) || 'Test failed',
      stack: trimStack(err?.stack),
    };
  }
}

const hasContent = (suite: DashboardSuite): boolean =>
  suite.tests.length > 0 || suite.suites.some(hasContent);

/** Mocha `pending` is a skip for counting purposes; everything else passes through. */
function normaliseState(state: TestStats['state']): TestState {
  if (state === 'passed' || state === 'failed' || state === 'skipped') return state;
  return 'skipped';
}

function tallyTree(suites: DashboardSuite[]): DashboardTotals {
  const totals: DashboardTotals = { tests: 0, passed: 0, failed: 0, skipped: 0, passRate: 100 };
  const walk = (list: DashboardSuite[]): void => {
    for (const suite of list) {
      for (const test of suite.tests) {
        totals.tests += 1;
        if (test.state === 'passed') totals.passed += 1;
        else if (test.state === 'failed') totals.failed += 1;
        else totals.skipped += 1;
      }
      walk(suite.suites);
    }
  };
  walk(suites);
  // Ratio over EXECUTED tests (skips don't drag the rate down), and 100 when the
  // file ran nothing so an empty spec never shows as a failure.
  const ran = totals.passed + totals.failed;
  totals.passRate = ran === 0 ? 100 : Math.round((totals.passed / ran) * 1000) / 10;
  return totals;
}

/** `d:\…\tests\regression\home\x.spec.ts` → `regression/home/x`. */
function specName(file: string): string {
  const rel = path.relative(Paths.TESTS, file);
  const inside = rel.startsWith('..') ? path.basename(file) : rel;
  return inside
    .replace(/\.spec\.[tj]s$/i, '')
    .split(path.sep)
    .join('/');
}

const sanitize = (value: string): string => value.replace(/[^a-z0-9-_]+/gi, '-');

const firstLine = (value?: string): string => (value ?? '').split('\n')[0]!.trim();

/** Keep the top of the stack — enough to locate the failure, not a wall of text. */
function trimStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  return stack.split('\n').slice(0, 12).join('\n');
}
