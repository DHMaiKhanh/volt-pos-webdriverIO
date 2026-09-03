import { useEffect, useMemo, useState } from 'react';
import type { DashboardRun, DashboardSpecResult } from '../types';
import { flattenTests, bucket, type FlatTest } from '../lib/selectors';
import { formatDuration } from '../lib/format';
import { StatusBadge } from './StatusBadge';

type StatusFilter = 'all' | 'passed' | 'failed' | 'skipped';
const FILTERS: StatusFilter[] = ['all', 'failed', 'passed', 'skipped'];

interface PreparedSpec {
  spec: DashboardSpecResult;
  tests: FlatTest[];
}

export function SpecResults({ run }: { run: DashboardRun }): JSX.Element {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [openSpecs, setOpenSpecs] = useState<Set<string>>(new Set());
  const [openErrors, setOpenErrors] = useState<Set<string>>(new Set());

  // A new run: default to failures expanded — that is what a viewer opens for.
  useEffect(() => {
    setOpenSpecs(new Set(run.specs.filter((s) => s.totals.failed > 0).map((s) => s.file)));
    setOpenErrors(new Set());
    setStatus('all');
    setQuery('');
  }, [run.runId]);

  const q = query.trim().toLowerCase();
  const prepared = useMemo<PreparedSpec[]>(() => {
    return run.specs
      .map((spec) => {
        const tests = flattenTests(spec.suites).filter(({ test, suitePath }) => {
          if (status !== 'all' && bucket(test.state) !== status) return false;
          if (!q) return true;
          return (
            test.fullTitle.toLowerCase().includes(q) ||
            suitePath.toLowerCase().includes(q) ||
            spec.specName.toLowerCase().includes(q)
          );
        });
        return { spec, tests };
      })
      .filter((p) => p.tests.length > 0);
  }, [run.specs, status, q]);

  const toggleSpec = (file: string): void =>
    setOpenSpecs((prev) => {
      const next = new Set(prev);
      next.has(file) ? next.delete(file) : next.add(file);
      return next;
    });

  const toggleError = (key: string): void =>
    setOpenErrors((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div>
      <div className="filters">
        <div className="seg">
          {FILTERS.map((f) => (
            <button key={f} className={status === f ? 'on' : ''} onClick={() => setStatus(f)}>
              {f[0]!.toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search test or spec…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <div className="spacer" />
        <button className="btn" onClick={() => setOpenSpecs(new Set(run.specs.map((s) => s.file)))}>
          Expand all
        </button>
        <button className="btn" onClick={() => setOpenSpecs(new Set())}>
          Collapse all
        </button>
      </div>

      {prepared.length === 0 ? (
        <div className="muted" style={{ padding: '24px 4px' }}>
          No tests match the current filter.
        </div>
      ) : (
        prepared.map(({ spec, tests }) => {
          const open = openSpecs.has(spec.file);
          const { passed, failed, skipped } = spec.totals;
          return (
            <div className="spec" key={spec.file}>
              <div
                className="spec-head"
                onClick={() => toggleSpec(spec.file)}
                role="button"
                aria-expanded={open}
              >
                <span className={`caret${open ? ' open' : ''}`}>▶</span>
                <span className="name mono" title={spec.specName}>
                  {spec.specName}
                </span>
                <span className="spec-counts">
                  {failed > 0 && (
                    <span style={{ color: 'var(--fail-text)' }}>
                      <b>{failed}</b> failed
                    </span>
                  )}
                  <span>
                    <b>{passed}</b> passed
                  </span>
                  {skipped > 0 && (
                    <span>
                      <b>{skipped}</b> skipped
                    </span>
                  )}
                  <span>{formatDuration(spec.durationMs)}</span>
                </span>
              </div>

              {open &&
                tests.map(({ test, suitePath }) => {
                  const key = `${spec.file}::${test.fullTitle}`;
                  const isFail = test.state === 'failed';
                  const errorOpen = openErrors.has(key);
                  return (
                    <div key={key} className={`test ${test.state}`}>
                      <StatusBadge state={test.state} />
                      <span className="title">
                        <span className="suite-prefix">{suitePath} › </span>
                        {test.title}
                      </span>
                      <span className="dur">{formatDuration(test.durationMs)}</span>

                      {isFail && (
                        <div className="test-error">
                          <div className="msg">{test.error}</div>
                          {test.stack && (
                            <>
                              {errorOpen && <pre>{test.stack}</pre>}
                              <button
                                className="btn"
                                style={{ padding: '3px 8px', fontSize: 12, marginTop: errorOpen ? 8 : 0 }}
                                onClick={() => toggleError(key)}
                              >
                                {errorOpen ? 'Hide stack' : 'Show stack'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })
      )}
    </div>
  );
}
