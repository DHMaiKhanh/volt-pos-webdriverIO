import type { DashboardRun } from '../types';
import { formatDateTime, formatDuration, formatPercent, formatRelative } from '../lib/format';

function MiniBar({ run }: { run: DashboardRun }): JSX.Element {
  const { passed, failed, skipped, tests } = run.totals;
  const pct = (n: number): string => (tests ? `${(n / tests) * 100}%` : '0%');
  return (
    <div className="compbar" style={{ height: 6 }}>
      {passed > 0 && <span className="s-pass" style={{ width: pct(passed) }} />}
      {failed > 0 && <span className="s-fail" style={{ width: pct(failed) }} />}
      {skipped > 0 && <span className="s-skip" style={{ width: pct(skipped) }} />}
    </div>
  );
}

export function RunList({
  runs,
  selectedId,
  onSelect,
}: {
  runs: DashboardRun[];
  selectedId: string | null;
  onSelect: (runId: string) => void;
}): JSX.Element {
  return (
    <div className="runlist">
      {runs.map((run) => (
        <button
          key={run.runId}
          className={`runrow${run.runId === selectedId ? ' active' : ''}`}
          onClick={() => onSelect(run.runId)}
          title={formatDateTime(run.finishedAt)}
        >
          <div className="top">
            <span className="when">{formatRelative(run.finishedAt)}</span>
            <span className={`badge ${run.passed ? 'passed' : 'failed'}`}>
              <span className="dot" />
              {run.passed ? 'Green' : `${run.totals.failed} failed`}
            </span>
          </div>
          <MiniBar run={run} />
          <div className="meta">
            <span>{formatPercent(run.totals.passRate)}</span>
            <span>
              {run.totals.passed}/{run.totals.tests} passed
            </span>
            <span>{formatDuration(run.durationMs)}</span>
            <span className="pill">{run.env.name}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
