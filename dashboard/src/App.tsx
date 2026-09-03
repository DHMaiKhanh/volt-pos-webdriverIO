import { useEffect, useState } from 'react';
import type { DashboardRun } from './types';
import { useHistory } from './lib/useHistory';
import { formatDateTime } from './lib/format';
import { Header } from './components/Header';
import { StatTiles } from './components/StatTiles';
import { PassRateTrend } from './components/PassRateTrend';
import { RunList } from './components/RunList';
import { SpecResults } from './components/SpecResults';
import { EmptyState } from './components/EmptyState';

/** Env context strip under the selected run's title. */
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

export function App(): JSX.Element {
  const { history, loading, error, reload } = useHistory();
  const runs = history.runs;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Keep a valid selection: default to newest, and re-point if the selected run
  // ages out of the capped history.
  useEffect(() => {
    if (runs.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev && runs.some((r) => r.runId === prev) ? prev : runs[0]!.runId));
  }, [runs]);

  const selected = runs.find((r) => r.runId === selectedId) ?? runs[0] ?? null;

  return (
    <div className="app">
      <Header updatedAt={history.updatedAt} runCount={runs.length} onRefresh={reload} />

      {!selected ? (
        loading ? (
          <div className="empty">
            <p className="muted">Loading run data…</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="card card-pad section" style={{ borderColor: 'var(--fail)' }}>
                <span className="muted">
                  Couldn’t read run data ({error}). Serve this app with{' '}
                  <code>npm run dev</code> from the <code>dashboard/</code> folder.
                </span>
              </div>
            )}
            <EmptyState />
          </>
        )
      ) : (
        <>
          <section className="section">
            <RunMeta run={selected} />
            <StatTiles run={selected} />
          </section>

          <section className="section card card-pad">
            <h3 className="card-title">Pass rate trend · last {runs.length} runs</h3>
            <PassRateTrend runs={runs} selectedId={selected.runId} onSelect={setSelectedId} />
          </section>

          <div className="grid layout">
            <div className="card card-pad">
              <h3 className="card-title">Run history</h3>
              <RunList runs={runs} selectedId={selected.runId} onSelect={setSelectedId} />
            </div>
            <div className="card card-pad">
              <h3 className="card-title">
                Results · {selected.specs.length} spec{selected.specs.length === 1 ? '' : 's'}
              </h3>
              <SpecResults run={selected} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
