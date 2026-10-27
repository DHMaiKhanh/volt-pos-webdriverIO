import { useMemo, useState } from 'react';
import type { CatalogFile, Feature } from '../../lib/gui';

export interface FileCounts {
  passed: number;
  failed: number;
  flaky: number;
}

interface SidebarProps {
  features: Feature[];
  selected: Set<string>;
  onSelect: (paths: string[], on: boolean) => void;
  onReplace: (paths: string[]) => void;
  activeTags: string[];
  onTags: (tags: string[]) => void;
  failedOnly: boolean;
  onFailedOnly: (v: boolean) => void;
  /** Per spec path: counts from the live run, else the last recorded run. */
  counts: Map<string, FileCounts>;
  /** Status per `file::title` from the live run, for the test rows. */
  testState: Map<string, 'passed' | 'failed' | 'flaky' | 'skipped'>;
  onRunTest: (file: string, title: string) => void;
  onRunFile: (file: string) => void;
  activeSpec: string | null;
  disabled: boolean;
}

const sum = (list: FileCounts[]): FileCounts =>
  list.reduce((a, c) => ({ passed: a.passed + c.passed, failed: a.failed + c.failed, flaky: a.flaky + c.flaky }), {
    passed: 0,
    failed: 0,
    flaky: 0,
  });

function Counts({ c, total }: { c?: FileCounts; total: number }): JSX.Element {
  return (
    <span className="tree-counts">
      {c && c.passed + c.flaky > 0 && <span className="c-ok">✓{c.passed + c.flaky}</span>}
      {c && c.failed > 0 && <span className="c-bad">✗{c.failed}</span>}
      <span className="count-pill">{total}</span>
    </span>
  );
}

/** Tri-state checkbox: `indeterminate` is a DOM property, not an attribute. */
function Check({ state, onChange }: { state: 'all' | 'some' | 'none'; onChange: (on: boolean) => void }): JSX.Element {
  return (
    <input
      type="checkbox"
      className="tree-check"
      checked={state === 'all'}
      ref={(el) => {
        if (el) el.indeterminate = state === 'some';
      }}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function Sidebar(props: SidebarProps): JSX.Element {
  const { features, selected, onSelect, activeTags, counts, testState } = props;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleOpen = (key: string): void =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of features) for (const file of f.files) for (const t of file.tests) for (const g of t.tags) m.set(g, (m.get(g) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [features]);

  // Filter: search over feature/file/test/TC id, tag chips, and "only failing".
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const testOk = (file: CatalogFile, t: CatalogFile['tests'][number]): boolean =>
      (activeTags.length === 0 || t.tags.some((g) => activeTags.includes(g))) &&
      (!q || t.title.toLowerCase().includes(q) || file.path.toLowerCase().includes(q));
    return features
      .map((f) => {
        const featureHit = q && f.name.toLowerCase().includes(q);
        const files = f.files
          .map((file) => ({
            file,
            tests: file.tests.filter((t) => (featureHit && activeTags.length === 0 ? true : testOk(file, t))),
          }))
          .filter(({ file, tests }) => {
            if (props.failedOnly && !((counts.get(file.path)?.failed ?? 0) > 0)) return false;
            if (featureHit && activeTags.length === 0) return true;
            if (tests.length > 0) return true;
            return !q && activeTags.length === 0 && file.tests.length === 0;
          });
        return { feature: f, files };
      })
      .filter((g) => g.files.length > 0);
  }, [features, query, activeTags, props.failedOnly, counts]);

  const visiblePaths = visible.flatMap((g) => g.files.map((x) => x.file.path));
  const allPaths = features.flatMap((f) => f.files.map((x) => x.path));
  const selectedTests = features
    .flatMap((f) => f.files)
    .filter((f) => selected.has(f.path))
    .reduce((n, f) => n + f.tests.filter((t) => activeTags.length === 0 || t.tags.some((g) => activeTags.includes(g))).length, 0);
  const filtering = query.trim() !== '' || activeTags.length > 0 || props.failedOnly;

  const stateOf = (paths: string[]): 'all' | 'some' | 'none' => {
    const n = paths.filter((p) => selected.has(p)).length;
    return n === 0 ? 'none' : n === paths.length ? 'all' : 'some';
  };

  const toggleTag = (tag: string): void =>
    props.onTags(activeTags.includes(tag) ? activeTags.filter((t) => t !== tag) : [...activeTags, tag]);

  return (
    <aside className="sidebar">
      <div className="side-top">
        <input
          type="search"
          className="side-search"
          placeholder="Tìm tính năng, file, mã TC…  ( / )"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          id="side-search"
        />
        <div className="chips">
          {tagCounts.map(([tag, n]) => (
            <button key={tag} className={`chip ${activeTags.includes(tag) ? 'on' : ''}`} onClick={() => toggleTag(tag)}>
              {tag} · {n}
            </button>
          ))}
          <button className={`chip ${props.failedOnly ? 'on bad' : ''}`} onClick={() => props.onFailedOnly(!props.failedOnly)}>
            ✗ Chỉ test lỗi
          </button>
        </div>
        <div className="side-actions">
          <button className="btn sm" onClick={() => onSelect(filtering ? visiblePaths : allPaths, true)}>
            ☑ Chọn {filtering ? 'đang lọc' : 'tất cả'}
          </button>
          <button className="btn sm" onClick={() => (filtering ? onSelect(visiblePaths, false) : props.onReplace([]))}>
            Bỏ chọn
          </button>
          <button className="btn sm icon" title="Mở hết" onClick={() => setOpen(new Set(visible.map((g) => g.feature.key)))}>
            ⊞
          </button>
          <button className="btn sm icon" title="Thu gọn" onClick={() => setOpen(new Set())}>
            ⊟
          </button>
          <span className="side-count">
            Đã chọn <b>{selected.size}</b> / {allPaths.length} file spec ·{' '}
            <b>{selectedTests.toLocaleString('vi-VN')}</b> test case
          </span>
        </div>
      </div>

      <div className="tree">
        {visible.length === 0 && <p className="muted pad">Không có spec nào khớp bộ lọc.</p>}
        {visible.map(({ feature, files }) => {
          const paths = files.map((x) => x.file.path);
          const isOpen = open.has(feature.key) || (query.trim() !== '' && visible.length <= 3);
          const total = files.reduce((n, x) => n + x.tests.length, 0);
          return (
            <div key={feature.key} className="tree-group">
              <div className="tree-row feature" onClick={() => toggleOpen(feature.key)}>
                <span className={`caret ${isOpen ? 'open' : ''}`}>›</span>
                <Check state={stateOf(paths)} onChange={(on) => onSelect(paths, on)} />
                <span className="tree-name" title={feature.key}>
                  {feature.name}
                </span>
                <Counts c={sum(paths.map((p) => counts.get(p)).filter((x): x is FileCounts => !!x))} total={total} />
              </div>
              {isOpen &&
                files.map(({ file, tests }) => {
                  const fileOpen = open.has(file.path);
                  const running = props.activeSpec === file.path;
                  return (
                    <div key={file.path}>
                      <div className={`tree-row file ${running ? 'running' : ''}`} onClick={() => toggleOpen(file.path)}>
                        <span className={`caret ${fileOpen ? 'open' : ''}`}>›</span>
                        <Check state={selected.has(file.path) ? 'all' : 'none'} onChange={(on) => onSelect([file.path], on)} />
                        <span className="tree-name" title={`${file.path}\n${file.describe}`}>
                          {running && <span className="spinner sm" />}
                          {file.name}
                        </span>
                        <button
                          className="row-run"
                          title="Chạy riêng spec này"
                          disabled={props.disabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onRunFile(file.path);
                          }}
                        >
                          ▶
                        </button>
                        <Counts c={counts.get(file.path)} total={tests.length} />
                      </div>
                      {fileOpen &&
                        tests.map((t, i) => {
                          const st = testState.get(`${file.path}::${t.title}`);
                          return (
                            <div key={`${t.title}-${i}`} className={`tree-row test ${t.skip ? 'is-skip' : ''}`}>
                              <span className={`tdot ${st ?? (t.skip ? 'skipped' : '')}`} />
                              <span className="tree-name" title={`${t.title}\n${t.tags.join(' ')}`}>
                                {t.title}
                              </span>
                              <button
                                className="row-run"
                                title="Chạy riêng test này"
                                disabled={props.disabled || t.skip}
                                onClick={() => props.onRunTest(file.path, t.title)}
                              >
                                ▶
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
