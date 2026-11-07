import fs from 'node:fs';
import path from 'node:path';
import WDIOReporter, {
  type HookStats,
  type RunnerStats,
  type SuiteStats,
  type TestStats,
} from '@wdio/reporter';
import { Paths } from '../constants/paths.js';
import { emitLive, registry, skipReasonFor, titleKey, type SkipInfo } from './liveRegistry.js';
import { fullMessage, staticSkip } from './skipSource.js';
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

  /**
   * Spec file the running tests belong to. One worker normally runs one file,
   * but a GROUPED worker (`specs: [[a, b, c]]` — the GUI's ⚡ launch phase, one
   * app launch for many files) runs several, so track it per top-level suite.
   */
  private currentFile = '';

  override onRunnerStart(runner: RunnerStats): void {
    this.currentFile = runner.specs[0] ?? '';
    emitLive({ t: 'spec-start', file: this.currentFile });
  }

  override onSuiteStart(suite: SuiteStats): void {
    // runner.specs are `file:///D:/…` URLs, suite.file is `D:…` — compare as paths.
    if (!suite.file || samePath(suite.file, this.currentFile)) return;
    emitLive({ t: 'spec-end', file: this.currentFile, failures: 0 });
    this.currentFile = suite.file;
    emitLive({ t: 'spec-start', file: this.currentFile });
  }

  // Live per-test events for the GUI runner (dashboard/server/runner.mjs). Only
  // emitted when the GUI launched the run — it sets GUI_LIVE_FILE — so a plain
  // terminal run pays nothing.
  override onTestPass(test: TestStats): void {
    this.emitTest(test, 'passed');
  }

  override onTestFail(test: TestStats): void {
    this.emitTest(test, 'failed');
  }

  override onTestSkip(test: TestStats): void {
    this.emitTest(test, 'skipped');
  }

  /** Failed hooks so far in this worker — the tests they take down are skipped "because of" them. */
  private failedHookList: { title: string; parent: string; error: string }[] = [];

  override onHookEnd(hook: HookStats): void {
    const err = hook.error ?? hook.errors?.[0];
    if (hook.state !== 'failed' && !err) return;
    this.failedHookList.push({
      title: hook.title,
      parent: hook.parent ?? '',
      error: firstLine(err?.message) || 'Hook failed',
    });
    emitLive({
      t: 'test',
      file: this.currentFile || (this.specs[0] ?? ''),
      title: hook.title,
      fullTitle: hook.title,
      state: 'failed',
      durationMs: hook.duration ?? 0,
      hook: true,
      error: firstLine(err?.message) || 'Hook failed',
      message: fullMessage(err?.message),
      stack: trimStack(err?.stack),
    });
  }

  private emitTest(test: TestStats, state: TestState): void {
    const err = test.error ?? test.errors?.[0];
    emitLive({
      t: 'test',
      file: this.currentFile || (this.specs[0] ?? ''),
      title: test.title,
      fullTitle: test.fullTitle,
      state,
      durationMs: test.duration ?? 0,
      mochaRetries: test.retries ?? 0,
      ...(state === 'failed'
        ? {
            error: firstLine(err?.message) || 'Test failed',
            message: fullMessage(err?.message),
            stack: trimStack(err?.stack),
          }
        : {}),
      ...(state === 'skipped' ? { skip: this.skipInfo(test) } : {}),
    });
  }

  /**
   * Why a test did not run, most specific first: the reason the patched
   * `this.skip()` recorded (src/support/skipReason.ts), a hook that failed
   * before it, then `it.skip` / `describe.skip` / a body-less `it` found in the
   * spec source.
   */
  private skipInfo(test: TestStats): SkipInfo {
    const runtime = skipReasonFor(test.fullTitle);
    if (runtime) return runtime;
    const hook = this.failedHookList.at(-1);
    if (hook) {
      const where = hook.parent ? ` (nhóm "${hook.parent}")` : '';
      return {
        kind: 'hook-failed',
        text: `Không chạy vì hook "${hook.title}"${where} lỗi trước đó: ${hook.error}`,
      };
    }
    return staticSkip(test.title, test.fullTitle, this.currentFile || (this.specs[0] ?? ''));
  }

  override onRunnerEnd(runner: RunnerStats): void {
    emitLive({
      t: 'spec-end',
      file: this.currentFile || (runner.specs[0] ?? ''),
      failures: runner.failures ?? 0,
    });
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
    const fallback = runner.specs[0] ?? this.specs[0] ?? 'unknown-spec';
    // A grouped worker ran several files: write one result per file, timed from
    // its own suites, so history/ETA stay per spec. A normal worker is one group.
    const byFile = new Map<string, SuiteStats[]>();
    for (const s of root?.suites ?? []) {
      const key = s.file || fallback;
      byFile.set(key, [...(byFile.get(key) ?? []), s]);
    }
    if (byFile.size <= 1) {
      this.writeResult(runner, fallback, root?.suites ?? [], runner.start, runner.end, runner.duration);
      return;
    }
    for (const [file, group] of byFile) {
      const start = group[0]?.start;
      const end = group[group.length - 1]?.end;
      const ms = start && end ? end.getTime() - start.getTime() : 0;
      this.writeResult(runner, file, group, start, end, ms);
    }
  }

  private writeResult(
    runner: RunnerStats,
    file: string,
    rawSuites: SuiteStats[],
    startAt: Date | undefined,
    endAt: Date | undefined,
    duration: number | undefined,
  ): void {
    const suites = rawSuites.map((s) => this.toSuite(s)).filter(hasContent);

    const totals = tallyTree(suites);
    const durationMs = duration ?? 0;
    const end = endAt ?? new Date();
    const start = startAt ?? new Date(end.getTime() - durationMs);

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
      // A `before all` / `after all` hook that throws aborts its suite around
      // the `it`s rather than inside one, so the failure lands in `suite.hooks`
      // and NEVER in `suite.tests`. Counting tests alone made such a spec
      // contribute zero tests and zero failures — `hasContent` then dropped the
      // suite entirely and the run read as a green pass while a whole spec file
      // had failed. Surface each failed hook as a synthetic failed test so it is
      // counted and its error reaches the drawer.
      tests: [...onePerTest(suite.tests).map((t) => this.toTest(t)), ...this.failedHooks(suite.hooks)],
      suites: suite.suites.map((s) => this.toSuite(s)).filter(hasContent),
    };
  }

  /** Failed before/after hooks, shaped as failed tests. Passing hooks are dropped. */
  private failedHooks(hooks: readonly HookStats[]): DashboardTest[] {
    return hooks
      .filter((h) => h.state === 'failed' || h.error !== undefined || (h.errors?.length ?? 0) > 0)
      .map((hook) => {
        const err = hook.error ?? hook.errors?.[0];
        return {
          title: hook.title,
          fullTitle: hook.title,
          state: 'failed' as const,
          durationMs: hook.duration ?? 0,
          retries: 0,
          error: firstLine(err?.message) || 'Hook failed',
          message: fullMessage(err?.message),
          stack: trimStack(err?.stack),
        };
      });
  }

  private toTest(test: TestStats): DashboardTest {
    const state = normaliseState(test.state);
    const base: DashboardTest = {
      title: test.title,
      fullTitle: test.fullTitle,
      state,
      // A skipped test never ran; WDIO times it from a start it never had (~26 min
      // of "duration" per skip in one grouped full run).
      durationMs: state === 'skipped' ? 0 : (test.duration ?? 0),
      retries: test.retries ?? 0,
    };
    if (state === 'skipped') return { ...base, skip: this.skipInfo(test) };
    if (state !== 'failed') return base;

    // WDIO exposes both `error` and `errors[]`; the first error is the one the
    // spec reporter prints, so match that.
    const err = test.error ?? test.errors?.[0];
    const evidence = registry().evidence.get(titleKey(test.fullTitle));
    return {
      ...base,
      error: firstLine(err?.message) || 'Test failed',
      message: fullMessage(err?.message),
      stack: trimStack(err?.stack),
      ...(evidence ? { evidence: evidence.dir } : {}),
    };
  }
}

const normPath = (p: string): string =>
  p
    .replace(/^file:\/\/\/?/, '')
    .replace(/\\/g, '/')
    .toLowerCase();
const samePath = (a: string, b: string): boolean => normPath(a) === normPath(b);

const hasContent = (suite: DashboardSuite): boolean =>
  suite.tests.length > 0 || suite.suites.some(hasContent);

/**
 * Each test once. When a hook fails, the tests it takes down reach the reporter
 * as a SECOND `test:pending` for a test already listed — one full run counted
 * 1891 tests for 1627 results. A run state (passed/failed) wins over the skip.
 */
function onePerTest(tests: readonly TestStats[]): TestStats[] {
  const byTitle = new Map<string, TestStats>();
  for (const test of tests) {
    const prev = byTitle.get(test.fullTitle);
    if (!prev || normaliseState(prev.state) === 'skipped') byTitle.set(test.fullTitle, test);
  }
  return [...byTitle.values()];
}

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
