import { useMemo, useState } from 'react';
import type { Feature, GuiRunner, LiveResult } from '../../lib/gui';
import { featureKeyOf } from '../../lib/gui';
import { formatDuration } from '../../lib/format';

interface ResultsTabProps {
  runner: GuiRunner;
  features: Feature[];
  now: number;
  onRerun: (file: string, title: string) => void;
  disabled: boolean;
}

/** Ring: pass (incl. flaky, amber) and fail arcs over the executed count. */
function Donut({ passed, flaky, failed, skipped }: { passed: number; flaky: number; failed: number; skipped: number }): JSX.Element {
  const total = passed + flaky + failed + skipped;
  const pct = total === 0 ? 0 : Math.round(((passed + flaky) / Math.max(1, passed + flaky + failed)) * 100);
  const R = 56;
  const C = 2 * Math.PI * R;
  const seg = (n: number): number => (total === 0 ? 0 : (n / total) * C);
  const parts = [
    { n: passed, cls: 'pass' },
    { n: flaky, cls: 'flaky' },
    { n: failed, cls: 'fail' },
    { n: skipped, cls: 'skip' },
  ];
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="donut" role="img" aria-label={`${pct}% đạt`}>
      <circle cx="70" cy="70" r={R} className="donut-track" />
      {parts.map((p) => {
        const len = seg(p.n);
        const el =
          len > 0 ? (
            <circle
              key={p.cls}
              cx="70"
              cy="70"
              r={R}
              className={`donut-seg ${p.cls}`}
              strokeDasharray={`${Math.max(0, len - (len > 3 ? 1.5 : 0))} ${C}`}
              strokeDashoffset={-offset}
            />
          ) : null;
        offset += len;
        return el;
      })}
      <text x="70" y="72" className="donut-pct">
        {pct}%
      </text>
      <text x="70" y="94" className="donut-sub">
        ĐẠT
      </text>
    </svg>
  );
}

type Filter = 'all' | 'failed' | 'flaky';

export function ResultsTab({ runner, features, now, onRerun, disabled }: ResultsTabProps): JSX.Element {
  const { run, results, running } = runner;
  const [filter, setFilter] = useState<Filter>('all');
  const [featureFilter, setFeatureFilter] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const featureName = useMemo(() => new Map(features.map((f) => [f.key, f.name])), [features]);

  const byFeature = useMemo(() => {
    const m = new Map<string, { passed: number; failed: number; flaky: number; skipped: number }>();
    for (const r of results) {
      const k = featureKeyOf(r.file);
      const c = m.get(k) ?? { passed: 0, failed: 0, flaky: 0, skipped: 0 };
      if (r.state === 'failed') c.failed += 1;
      else if (r.state === 'skipped') c.skipped += 1;
      else if (r.flaky) c.flaky += 1;
      else c.passed += 1;
      m.set(k, c);
    }
    return [...m.entries()].sort((a, b) => (featureName.get(a[0]) ?? a[0]).localeCompare(featureName.get(b[0]) ?? b[0]));
  }, [results, featureName]);

  const plannedByFeature = useMemo(() => {
    const m = new Map<string, number>();
    if (!run) return m;
    for (const f of features) for (const file of f.files) if (run.specs.includes(file.path)) m.set(f.key, (m.get(f.key) ?? 0) + file.tests.length);
    return m;
  }, [features, run]);

  if (!run) {
    return (
      <div className="empty card">
        <h2>Chưa có lần chạy nào</h2>
        <p className="muted">Chọn tính năng ở cột trái rồi bấm <b>▶ Chạy</b>. Kết quả sẽ hiện trực tiếp ở đây.</p>
      </div>
    );
  }

  const s = run.summary;
  const elapsed = (run.finishedAt ? new Date(run.finishedAt).getTime() : now) - new Date(run.startedAt).getTime();
  const done = s.done;
  const planned = Math.max(run.planned, done);
  const stopped = !running && run.exitCode !== null && run.exitCode !== 0 && done < run.planned;

  const issues: LiveResult[] = results
    .filter((r) => r.state === 'failed' || r.flaky)
    .filter((r) => (filter === 'failed' ? r.state === 'failed' : filter === 'flaky' ? r.flaky : true))
    .filter((r) => !featureFilter || featureKeyOf(r.file) === featureFilter)
    .sort((a, b) => b.at - a.at);
  const failedCount = results.filter((r) => r.state === 'failed').length;
  const flakyCount = results.filter((r) => r.flaky).length;

  return (
    <div className="results">
      <section className="card hero">
        <Donut passed={s.passed} flaky={s.flaky} failed={s.failed} skipped={s.skipped} />
        <div className="hero-body">
          <h2 className={running ? 'h-running' : s.failed ? 'h-fail' : 'h-pass'}>
            {running ? `Đang chạy… ${done}/${planned}` : stopped ? `Đã dừng · ${done}/${planned}` : `Xong · ${done}/${planned}`}
          </h2>
          <p className="muted">
            {running
              ? 'Kết quả cập nhật trực tiếp, bạn cứ làm việc khác.'
              : `${run.label} · ENV ${run.env} · exit ${run.exitCode ?? '—'}`}
            {run.activeSpec && <> · đang chạy <code>{run.activeSpec.replace(/^tests\//, '')}</code></>}
          </p>
          <div className="stat-pills">
            <span className="spill"><i className="d pass" /> <b>{s.passed}</b> đạt</span>
            <span className="spill"><i className="d fail" /> <b>{s.failed}</b> lỗi</span>
            <span className="spill"><i className="d flaky" /> <b>{s.flaky}</b> flaky</span>
            <span className="spill"><i className="d skip" /> <b>{s.skipped}</b> bỏ qua</span>
            <span className="spill"><i className="d time" /> <b>{formatDuration(elapsed)}</b> thời gian</span>
          </div>
          {running && planned > 0 && (
            <div className="progress">
              <span style={{ width: `${Math.min(100, (done / planned) * 100)}%` }} />
            </div>
          )}
        </div>
      </section>

      <section className="card card-pad">
        <div className="sec-head">
          <h3>🗺 Bản đồ màn hình</h3>
          <span className="muted">· bấm một ô để lọc lỗi theo màn hình</span>
          {featureFilter && (
            <button className="btn sm" onClick={() => setFeatureFilter(null)}>
              ✕ Bỏ lọc
            </button>
          )}
        </div>
        {byFeature.length === 0 ? (
          <p className="muted">Chưa có test nào xong…</p>
        ) : (
          <div className="screen-map">
            {byFeature.map(([key, c]) => {
              const total = c.passed + c.failed + c.flaky + c.skipped;
              const tone = c.failed ? 'fail' : c.flaky ? 'flaky' : 'pass';
              const w = (n: number): string => `${(n / Math.max(1, total)) * 100}%`;
              return (
                <button
                  key={key}
                  className={`map-tile ${tone} ${featureFilter === key ? 'on' : ''}`}
                  onClick={() => setFeatureFilter(featureFilter === key ? null : key)}
                  title={featureName.get(key) ?? key}
                >
                  <span className="map-name">{featureName.get(key) ?? key}</span>
                  <span className="compbar">
                    <span className="s-pass" style={{ width: w(c.passed) }} />
                    <span className="s-flaky" style={{ width: w(c.flaky) }} />
                    <span className="s-fail" style={{ width: w(c.failed) }} />
                    <span className="s-skip" style={{ width: w(c.skipped) }} />
                  </span>
                  <span className="map-counts">
                    {c.failed > 0 && <span className="c-bad">✗{c.failed}</span>}
                    {c.flaky > 0 && <span className="c-warn">!{c.flaky}</span>}
                    <span className="c-ok">
                      ✓{c.passed + c.flaky}/{Math.max(total, plannedByFeature.get(key) ?? 0)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="sec-head pad">
          <h3>📥 Hộp thư lỗi</h3>
          <span className="pill">
            {failedCount} lỗi · {flakyCount} flaky
          </span>
          <span className="spacer" />
          <div className="seg">
            {(
              [
                ['all', `Tất cả ${failedCount + flakyCount}`],
                ['failed', `Lỗi ${failedCount}`],
                ['flaky', `Flaky ${flakyCount}`],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {issues.length === 0 ? (
          <p className="muted pad">{running ? 'Chưa có lỗi nào. 🎉' : 'Không có lỗi trong bộ lọc này.'}</p>
        ) : (
          <ul className="inbox">
            {issues.map((r) => (
              <li key={r.key} className={`inbox-row ${r.state === 'failed' ? 'is-fail' : 'is-flaky'}`}>
                <div className="inbox-main" onClick={() => setOpenKey(openKey === r.key ? null : r.key)}>
                  <span className={`ibadge ${r.state === 'failed' ? 'fail' : 'flaky'}`}>{r.state === 'failed' ? '✗' : '!'}</span>
                  <div className="inbox-text">
                    <div className="inbox-title">{r.title}</div>
                    <div className="inbox-meta">
                      {featureName.get(featureKeyOf(r.file)) ?? featureKeyOf(r.file)} · <code>{r.file.replace(/^tests\//, '')}</code> · thử lần{' '}
                      {r.attempt}
                      {r.flaky ? ' · chập chờn' : ''}
                      {r.hook ? ' · hook' : ''}
                    </div>
                  </div>
                  <span className="inbox-dur">{formatDuration(r.durationMs)}</span>
                  <button
                    className="btn sm"
                    disabled={disabled}
                    title="Chạy lại riêng test này"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRerun(r.file, r.title);
                    }}
                  >
                    ↻
                  </button>
                </div>
                {openKey === r.key && r.error && <pre className="inbox-err">{r.error}</pre>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
