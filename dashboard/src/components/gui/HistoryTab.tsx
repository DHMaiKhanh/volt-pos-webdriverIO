import { useEffect, useState } from 'react';
import type { DashboardHistory, DashboardRun } from '../../types';
import { formatDateTime } from '../../lib/format';
import { StatTiles } from '../StatTiles';
import { PassRateTrend } from '../PassRateTrend';
import { RunList } from '../RunList';
import { SpecResults } from '../SpecResults';
import { EmptyState } from '../EmptyState';

function RunMeta({ run }: { run: DashboardRun }): JSX.Element {
  const item = (k: string, v: string): JSX.Element => (
    <span className="pill">
      <span className="k">{k}</span>
      {v}
    </span>
  );
  return (
    <div className="runmeta">
      <strong style={{ fontSize: 15 }}>{formatDateTime(run.finishedAt)}</strong>
      {item('env', run.env.name)}
      {item('mode', run.env.mode)}
      {item('merchant', run.env.merchant)}
      {item('app', run.env.app)}
    </div>
  );
}

/** `overview`: latest run + trend (the Dashboard tab). `full`: pick any recorded run (Lịch sử). */
export function HistoryTab({ history, mode }: { history: DashboardHistory; mode: 'overview' | 'full' }): JSX.Element {
  const runs = history.runs;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    setSelectedId((prev) => (prev && runs.some((r) => r.runId === prev) ? prev : (runs[0]?.runId ?? null)));
  }, [runs]);
  const selected = mode === 'overview' ? (runs[0] ?? null) : (runs.find((r) => r.runId === selectedId) ?? runs[0] ?? null);

  if (!selected) return <EmptyState />;

  return (
    <>
      <section className="section">
        <RunMeta run={selected} />
        <StatTiles run={selected} />
      </section>
      <section className="section card card-pad">
        <h3 className="card-title">Tỉ lệ đạt · {runs.length} lần chạy gần nhất</h3>
        <PassRateTrend runs={runs} selectedId={selected.runId} onSelect={setSelectedId} />
      </section>
      {mode === 'full' ? (
        <div className="grid layout">
          <div className="card card-pad">
            <h3 className="card-title">Lịch sử chạy</h3>
            <RunList runs={runs} selectedId={selected.runId} onSelect={setSelectedId} />
          </div>
          <div className="card card-pad">
            <h3 className="card-title">Kết quả · {selected.specs.length} spec</h3>
            <SpecResults run={selected} />
          </div>
        </div>
      ) : (
        <div className="card card-pad">
          <h3 className="card-title">Lần chạy gần nhất · {selected.specs.length} spec</h3>
          <SpecResults run={selected} />
        </div>
      )}
    </>
  );
}
