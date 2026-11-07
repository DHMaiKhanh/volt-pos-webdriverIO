import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from './lib/useHistory';
import { formatDuration } from './lib/format';
import type { PreflightStatus, RunInfo, RunRequest, WarmState, WarmStatus } from './lib/gui';
import { fetchPreflight, useCatalog, useGuiRunner, usePersisted } from './lib/gui';
import { Sidebar, type FileCounts } from './components/gui/Sidebar';
import { AppsBar } from './components/gui/AppsBar';
import { PreflightBar } from './components/gui/PreflightBar';
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

/** Pre-warm pill text (dashboard/server/warm.mjs states). */
const WARM_LABEL: Record<WarmState, string> = {
  off: 'Mở sẵn app: tắt',
  cold: 'App chưa mở sẵn',
  warming: 'Đang mở sẵn app…',
  ready: 'App mở sẵn · chạy ngay',
  busy: 'App đang bận',
  error: 'Mở sẵn app lỗi',
};

const warmTitle = (w: WarmStatus): string =>
  'Mở sẵn app: runner boot app (CDP) từ trước, nên bấm Chạy là pha attach chạy luôn trong vài giây\n' +
  'thay vì đợi splash ~20s (máy nguội tới ~2 phút). Spec thanh toán / màn khách vẫn launch app riêng.\n' +
  (w.detail ? `\nTrạng thái: ${w.detail}\n` : '') +
  '\nBỏ tick để tắt (đóng luôn app runner đã mở). Log: .tmp/gui-warm.log';

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
  const [savedEnv, setEnv] = usePersisted('gui-env', 'dev');
  // `dev` is shown as Staging (one environment); an old saved `staging` lands there too.
  const env = savedEnv === 'prod' ? 'prod' : 'dev';
  const [selectedList, setSelectedList] = usePersisted<string[]>('gui-selected', []);
  const [tags, setTags] = usePersisted<string[]>('gui-tags', []);
  const [fast, setFast] = usePersisted('gui-fast', true);
  const [failedOnly, setFailedOnly] = useState(false);
  const [notifyPrefs, setNotifyPrefs] = usePersisted<NotifyPrefs>('gui-notify', DEFAULT_NOTIFY);
  const [startError, setStartError] = useState<string | null>(null);
  /** Gate result pushed back by a refused "Chạy tất cả" (PreflightBar shows it). */
  const [pushedPf, setPushedPf] = useState<PreflightStatus | null>(null);
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
  const runner = useGuiRunner(env, onFinished);
  const { run, running, results } = runner;

  // Coming back to the runner is when a Run is likely: if the pre-warmed app is
  // not up (closed by hand, …), retry now instead of waiting out the server's
  // 3-minute backoff. At most once per 30s.
  const warmNow = useRef({ warm: runner.warm, running });
  warmNow.current = { warm: runner.warm, running };
  const { setWarm } = runner;
  useEffect(() => {
    let last = 0;
    const wake = (): void => {
      const { warm, running: busy } = warmNow.current;
      if (document.visibilityState !== 'visible' || busy || !warm?.enabled) return;
      if (!['cold', 'busy', 'error'].includes(warm.state) || Date.now() - last < 30_000) return;
      last = Date.now();
      void setWarm();
    };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [setWarm]);

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
    document.title =
      running && run ? `(${run.summary.done}/${run.planned}) Volt POS Test Runner` : 'Volt POS Test Runner';
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
    if (err) {
      setStartError(err);
      if (req.all) void fetchPreflight(env).then(setPushedPf).catch(() => undefined);
    } else setTab('results');
  };

  const runSelected = (): void => {
    const specs = selectedList.filter((p) => knownPaths.has(p));
    const isAll = allSelected;
    const useFast = fast && env === 'dev';
    const count = runner.apps?.env === env ? runner.apps.config[runner.apps.env].count : 1;
    const where =
      env === 'prod' ? ` · Production ×${count} app` : count > 1 ? ` · Staging ×${count} app` : '';
    void start({
      specs,
      tags,
      all: isAll,
      fast: useFast,
      label: `${useFast ? '⚡ ' : ''}${specs.length} spec${tags.length ? ` · ${tags.join(' ')}` : ''}${where}`,
    });
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

  const remaining =
    run && running ? Math.max(0, run.estimateMs - (now - new Date(run.startedAt).getTime())) : 0;
  const warmState: WarmState = runner.warm?.enabled ? runner.warm.state : 'off';
  const selectedCount = selectedList.filter((p) => knownPaths.has(p)).length;
  // "Chạy tất cả" = every automated spec ticked (manual stubs / _recovery probes don't count).
  const automatedPaths = useMemo(
    () => [...knownPaths].filter((p) => !p.includes('/volt-qc/_manual/') && !p.startsWith('tests/_recovery/')),
    [knownPaths],
  );
  const allSelected = useMemo(() => {
    const sel = new Set(selectedList);
    return automatedPaths.length > 0 && automatedPaths.every((p) => sel.has(p));
  }, [automatedPaths, selectedList]);
  const storesKey = JSON.stringify(runner.apps?.env === env ? runner.apps.config[env as 'dev'] : null);
  // Test cases (it) the run will execute: tests in the ticked files, narrowed by the tag chips.
  // ⚡ fast mode never runs the _manual stubs, _recovery probes or @broken tests — and
  // staging / prod always run that way, on their store copies.
  const fastOn = env !== 'dev' || fast;
  const selectedTests = useMemo(
    () =>
      features
        .flatMap((f) => f.files)
        .filter((f) => selected.has(f.path))
        .filter(
          (f) => !fastOn || !(f.path.includes('/volt-qc/_manual/') || f.path.startsWith('tests/_recovery/')),
        )
        .reduce(
          (n, f) =>
            n +
            f.tests.filter(
              (t) =>
                (tags.length === 0 || t.tags.some((g) => tags.includes(g))) &&
                (!fastOn || !t.tags.includes('@broken')),
            ).length,
          0,
        ),
    [features, selected, tags, fastOn],
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
        {env === 'dev' && runner.warm && (
          <span className={`warm-pill ${warmState}`} title={warmTitle(runner.warm)}>
            <label>
              <input
                type="checkbox"
                checked={runner.warm.enabled}
                onChange={(e) => void runner.setWarm(e.target.checked)}
              />
              <i />
              {WARM_LABEL[warmState]}
            </label>
            {runner.warm.enabled && !running && ['cold', 'busy', 'error'].includes(warmState) && (
              <button
                className="warm-retry"
                onClick={() => void runner.setWarm()}
                title="Mở sẵn app ngay bây giờ"
              >
                ↻
              </button>
            )}
          </span>
        )}
        {runner.freeze && (
          <span
            className={`warm-pill ${runner.freeze.frozen > 0 ? 'busy' : runner.freeze.enabled ? 'ready' : 'off'}`}
            title={
              'Khi chạy cả bộ (≥ 20 spec): tạm dừng Edge/Chrome (profile của bạn), Discord, WhatsApp, Teams, WPS, ' +
              'OneDrive… và trả RAM của chúng cho các app Volt POS. Hết run hoặc bấm Dừng thì chúng chạy lại, ' +
              'tab và tin nhắn còn nguyên. Không đụng Claude, Windows, WebView2. Script: scripts/freeze-apps.ps1'
            }
          >
            <label>
              <input
                type="checkbox"
                checked={runner.freeze.enabled}
                onChange={(e) => void runner.setFreeze(e.target.checked)}
              />
              <i />
              {runner.freeze.frozen > 0
                ? `Đang đóng băng ${runner.freeze.frozen} tiến trình`
                : 'Đóng băng app khác khi chạy'}
            </label>
          </span>
        )}
        <span className="spacer" />
        {running && run && <span className="muted eta">≈ {formatDuration(remaining)} ước tính</span>}
        <button
          className="btn"
          disabled={running || lastFailedSpecs.length === 0}
          onClick={() =>
            void start({
              specs: lastFailedSpecs,
              label: `Test lỗi lần trước (${lastFailedSpecs.length} spec)`,
            })
          }
          title={lastFailedSpecs.join('\n')}
        >
          ↻ Test lỗi lần trước ({lastFailedSpecs.length})
        </button>
        {running ? (
          <button className="btn stop big" onClick={() => void runner.stop()}>
            ■ Dừng
          </button>
        ) : env !== 'dev' ? null : (
          <label
            className="fast-toggle"
            title={
              'Chạy nhanh: spec thường attach vào app mở sẵn (bắt đầu ngay), chỉ spec thanh toán / màn khách / @dual-window\n' +
              'mới launch app riêng (gom file mỗi lần mở). Bỏ case kiểm tay (_manual), _recovery và @broken. Chỉ áp dụng ENV dev.\n' +
              'Chạy từ 20 file trở lên thì LUÔN chạy nhanh — và chia cho 2 app song song khi bản sao đã đăng nhập.'
            }
          >
            <input
              type="checkbox"
              checked={fast}
              onChange={(e) => setFast(e.target.checked)}
            />
            ⚡ Chạy nhanh
          </label>
        )}
        {running ? null : (
          <button
            className="btn primary big"
            disabled={!runner.online || selectedCount === 0}
            onClick={runSelected}
          >
            ▶ {allSelected && env === 'dev' ? 'Chạy tất cả · ' : 'Chạy '}
            {selectedCount} spec · {selectedTests.toLocaleString('vi-VN')} test
          </button>
        )}
        <button className="btn icon" onClick={toggleTheme} title="Sáng / tối">
          ◐
        </button>
      </header>

      <AppsBar env={env} onEnv={setEnv} runner={runner} disabled={running || !runner.online} />
      {runner.online && (
        <PreflightBar env={env} storesKey={storesKey} disabled={running} pushed={pushedPf} />
      )}

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
          onRunTest={(file, title) =>
            void start({ specs: [file], titles: [title], label: title, retries: 0 })
          }
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
                Không kết nối được runner server. Mở bằng <code>npm run runner:gui</code> (hoặc{' '}
                <code>npm run dashboard:full</code> khi dev).
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
              <div className="banner warn">
                ENV prod là app thật của tiệm — chỉ chạy được spec trong tests/smoke (read-only).
              </div>
            )}

            {tab === 'dashboard' && <HistoryTab history={history} mode="overview" />}
            {tab === 'results' && (
              <ResultsTab
                runner={runner}
                features={features}
                now={now}
                disabled={running || !runner.online}
                onRerun={(file, title) =>
                  void start({
                    specs: [file],
                    titles: [cleanTitle(title)],
                    label: cleanTitle(title),
                    retries: 0,
                  })
                }
              />
            )}
            {tab === 'console' && <ConsoleTab runner={runner} />}
            {tab === 'history' && <HistoryTab history={history} mode="full" />}
            {tab === 'schedule' && (
              <ScheduleTab env={env} selected={selectedList.filter((p) => knownPaths.has(p))} tags={tags} />
            )}
            {tab === 'notify' && <NotifyTab prefs={notifyPrefs} onChange={setNotifyPrefs} />}
          </div>
        </main>
      </div>
    </div>
  );
}
