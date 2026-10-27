import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from './lib/useHistory';
import { formatDuration } from './lib/format';
import type { RunInfo, RunRequest } from './lib/gui';
import { useCatalog, useGuiRunner, usePersisted } from './lib/gui';
import { Sidebar, type FileCounts } from './components/gui/Sidebar';
import { ResultsTab } from './components/gui/ResultsTab';
import { ConsoleTab } from './components/gui/ConsoleTab';
import { HistoryTab } from './components/gui/HistoryTab';
import { ScheduleTab } from './components/gui/ScheduleTab';
import { DEFAULT_NOTIFY, NotifyTab, notify, type NotifyPrefs } from './components/gui/NotifyTab';

type Tab = 'dashboard' | 'results' | 'console' | 'history' | 'schedule' | 'notify';

const TABS: [Tab, string][] = [
  ['dashboard', '🎯 Dashboard'],
  ['results', '📊 Kết quả'],
  ['console', '⚡ Chạy & Console'],
  ['history', '🕘 Lịch sử'],
  ['schedule', '⏰ Lên lịch'],
  ['notify', '🔔 Thông báo'],
];

/** `D:\…\tests\regression\x.spec.ts` → `tests/regression/x.spec.ts`. */
const relSpec = (file: string): string => {
  const norm = decodeURIComponent(file).replace(/\\/g, '/');
  const i = norm.lastIndexOf('/tests/');
  return i >= 0 ? norm.slice(i + 1) : norm;
};

/** Strip the `@tag` suffixes `title()` appends, so live titles match catalogue titles. */
const cleanTitle = (t: string): string => t.replace(/(\s+@[a-z][\w-]*)+\s*$/i, '').trim();

function useThemeToggle(): [string, () => void] {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme ?? '');
  const toggle = (): void => {
    const active = theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = active === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('volt-dashboard-theme', next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };
  return [theme, toggle];
}

export function App(): JSX.Element {
  const { history, reload } = useHistory();
  const { features, error: catalogError, refresh } = useCatalog();
  const [tab, setTab] = usePersisted<Tab>('gui-tab', 'results');
  const [env, setEnv] = usePersisted('gui-env', 'dev');
  const [selectedList, setSelectedList] = usePersisted<string[]>('gui-selected', []);
  const [tags, setTags] = usePersisted<string[]>('gui-tags', []);
  const [failedOnly, setFailedOnly] = useState(false);
  const [notifyPrefs, setNotifyPrefs] = usePersisted<NotifyPrefs>('gui-notify', DEFAULT_NOTIFY);
  const [startError, setStartError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [, toggleTheme] = useThemeToggle();

  const onFinished = useCallback(
    (run: RunInfo) => {
      reload();
      const s = run.summary;
      const ok = s.failed === 0 && run.exitCode === 0;
      notify(
        notifyPrefs,
        ok ? '✅ Volt POS test: ĐẠT' : '❌ Volt POS test: có lỗi',
        `${run.label} · ${s.passed + s.flaky} đạt, ${s.failed} lỗi, ${s.flaky} flaky, ${s.skipped} bỏ qua`,
        ok,
      );
    },
    [reload, notifyPrefs],
  );
  const runner = useGuiRunner(onFinished);
  const { run, running, results } = runner;

  const selected = useMemo(() => new Set(selectedList), [selectedList]);
  const knownPaths = useMemo(() => new Set(features.flatMap((f) => f.files.map((x) => x.path))), [features]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // `/` focuses search, like the reference runner.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        document.getElementById('side-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Window title carries progress so the taskbar shows it.
  useEffect(() => {
    document.title = running && run ? `(${run.summary.done}/${run.planned}) Volt POS Test Runner` : 'Volt POS Test Runner';
  }, [running, run]);

  /* Per-file counts: live run first, else the last recorded run. */
  const counts = useMemo(() => {
    const m = new Map<string, FileCounts>();
    const last = history.runs[0];
    if (last) {
      for (const s of last.specs) {
        m.set(relSpec(s.file), { passed: s.totals.passed, failed: s.totals.failed, flaky: 0 });
      }
    }
    if (run) {
      const live = new Map<string, FileCounts>();
      for (const r of results) {
        const c = live.get(r.file) ?? { passed: 0, failed: 0, flaky: 0 };
        if (r.state === 'failed') c.failed += 1;
        else if (r.flaky) c.flaky += 1;
        else if (r.state === 'passed') c.passed += 1;
        live.set(r.file, c);
      }
      for (const [k, v] of live) m.set(k, v);
    }
    return m;
  }, [history.runs, run, results]);

  const testState = useMemo(() => {
    const m = new Map<string, 'passed' | 'failed' | 'flaky' | 'skipped'>();
    for (const r of results) m.set(`${r.file}::${cleanTitle(r.title)}`, r.flaky ? 'flaky' : r.state);
    return m;
  }, [results]);

  /* Failed specs of the previous run — live run if it finished, else the last recorded one. */
  const lastFailedSpecs = useMemo(() => {
    if (run && !running && results.length) {
      return [...new Set(results.filter((r) => r.state === 'failed').map((r) => r.file))];
    }
    const last = history.runs[0];
    return last ? last.specs.filter((s) => s.totals.failed > 0).map((s) => relSpec(s.file)) : [];
  }, [run, running, results, history.runs]);

  const start = async (req: Omit<RunRequest, 'env'>): Promise<void> => {
    setStartError(null);
    const err = await runner.start({ env, ...req });
    if (err) setStartError(err);
    else setTab('results');
  };

  const runSelected = (): void => {
    const specs = selectedList.filter((p) => knownPaths.has(p));
    void start({ specs, tags, label: `${specs.length} spec${tags.length ? ` · ${tags.join(' ')}` : ''}` });
  };

  const onSelect = (paths: string[], on: boolean): void =>
    setSelectedList((prev) => {
      const next = new Set(prev);
      for (const p of paths) {
        if (on) next.add(p);
        else next.delete(p);
      }
      return [...next];
    });

  const remaining = run && running ? Math.max(0, run.estimateMs - (now - new Date(run.startedAt).getTime())) : 0;
  const selectedCount = selectedList.filter((p) => knownPaths.has(p)).length;
  // Test cases (it) the run will execute: tests in the ticked files, narrowed by the tag chips.
  const selectedTests = useMemo(
    () =>
      features
        .flatMap((f) => f.files)
        .filter((f) => selected.has(f.path))
        .reduce((n, f) => n + f.tests.filter((t) => tags.length === 0 || t.tags.some((g) => tags.includes(g))).length, 0),
    [features, selected, tags],
  );

  return (
    <div className="gui">
      <header className="topbar">
        <div className="brand">
          <span className="logo">⚗</span>
          <div>
            <div className="brand-name">Volt POS Test Runner</div>
            <div className="brand-sub">WebdriverIO E2E · chọn &amp; chạy test</div>
          </div>
        </div>
        <select value={env} onChange={(e) => setEnv(e.target.value)} disabled={running} title="Môi trường (build .exe)">
          <option value="dev">ENV: dev</option>
          <option value="staging">ENV: staging</option>
          <option value="prod">ENV: prod (chỉ smoke)</option>
        </select>
        <span className={`status-pill ${!runner.online ? 'off' : running ? 'busy' : 'idle'}`}>
          <i />
          {!runner.online
            ? 'Server offline'
            : running && run
              ? `Đang chạy ${run.summary.done}/${run.planned}`
              : run
                ? `Xong · ${run.summary.failed} lỗi`
                : 'Sẵn sàng'}
        </span>
        <span className="spacer" />
        {running && run && <span className="muted eta">≈ {formatDuration(remaining)} ước tính</span>}
        <button
          className="btn"
          disabled={running || lastFailedSpecs.length === 0}
          onClick={() => void start({ specs: lastFailedSpecs, label: `Test lỗi lần trước (${lastFailedSpecs.length} spec)` })}
          title={lastFailedSpecs.join('\n')}
        >
          ↻ Test lỗi lần trước ({lastFailedSpecs.length})
        </button>
        {running ? (
          <button className="btn stop big" onClick={() => void runner.stop()}>
            ■ Dừng
          </button>
        ) : (
          <button className="btn primary big" disabled={!runner.online || selectedCount === 0} onClick={runSelected}>
            ▶ Chạy {selectedCount} spec · {selectedTests.toLocaleString('vi-VN')} test
          </button>
        )}
        <button className="btn icon" onClick={toggleTheme} title="Sáng / tối">
          ◐
        </button>
      </header>

      <div className="body">
        <Sidebar
          features={features}
          selected={selected}
          onSelect={onSelect}
          onReplace={setSelectedList}
          activeTags={tags}
          onTags={setTags}
          failedOnly={failedOnly}
          onFailedOnly={setFailedOnly}
          counts={counts}
          testState={testState}
          activeSpec={run?.activeSpec ?? null}
          disabled={running || !runner.online}
          onRunFile={(file) => void start({ specs: [file], label: file.split('/').pop() })}
          onRunTest={(file, title) => void start({ specs: [file], titles: [title], label: title, retries: 0 })}
        />

        <main className="main">
          <nav className="tabs">
            {TABS.map(([k, label]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
            <span className="spacer" />
            <button className="btn sm" onClick={refresh} title="Đọc lại danh sách spec từ thư mục tests/">
              ↻ Quét lại spec
            </button>
          </nav>

          <div className="tab-body">
            {!runner.online && (
              <div className="banner bad">
                Không kết nối được runner server. Mở bằng <code>npm run runner:gui</code> (hoặc <code>npm run dashboard:full</code> khi dev).
              </div>
            )}
            {catalogError && <div className="banner bad">Không đọc được danh sách spec: {catalogError}</div>}
            {startError && (
              <div className="banner bad">
                {startError}
                <button className="btn sm" onClick={() => setStartError(null)}>
                  ✕
                </button>
              </div>
            )}
            {env === 'prod' && (
              <div className="banner warn">ENV prod là app thật của tiệm — chỉ chạy được spec trong tests/smoke (read-only).</div>
            )}

            {tab === 'dashboard' && <HistoryTab history={history} mode="overview" />}
            {tab === 'results' && (
              <ResultsTab
                runner={runner}
                features={features}
                now={now}
                disabled={running || !runner.online}
                onRerun={(file, title) =>
                  void start({ specs: [file], titles: [cleanTitle(title)], label: cleanTitle(title), retries: 0 })
                }
              />
            )}
            {tab === 'console' && <ConsoleTab runner={runner} />}
            {tab === 'history' && <HistoryTab history={history} mode="full" />}
            {tab === 'schedule' && <ScheduleTab env={env} selected={selectedList.filter((p) => knownPaths.has(p))} tags={tags} />}
            {tab === 'notify' && <NotifyTab prefs={notifyPrefs} onChange={setNotifyPrefs} />}
          </div>
        </main>
      </div>
    </div>
  );
}
