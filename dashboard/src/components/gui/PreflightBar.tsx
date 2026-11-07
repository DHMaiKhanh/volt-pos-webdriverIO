import { useCallback, useEffect, useState } from 'react';
import type { PreflightItem, PreflightStatus } from '../../lib/gui';
import { checkPreflight, fetchPreflight } from '../../lib/gui';

interface Props {
  env: string;
  /** Re-check when the App bar's store choice changes. */
  storesKey: string;
  disabled: boolean;
  /** The runner pushes a fresh result with a refused "Chạy tất cả". */
  pushed: PreflightStatus | null;
}

const ITEMS: [keyof PreflightStatus['stores'][number]['sites'] | 'terminal', string][] = [
  ['gocheckin', 'GoCheckin'],
  ['gap', 'GAP Checkin'],
  ['portal', 'Portal'],
  ['terminal', 'Terminal'],
];

const ICON: Record<string, string> = { ok: '✓', login: '!', closed: '○', nocreds: '✕', down: '✕', unknown: '?' };

/**
 * "Chạy tất cả" gate: per store under test, GoCheckin / GAP Checkin / Portal
 * open + signed in and the card terminal connected (dashboard/server/preflight.mjs).
 * Pressing Run on every spec runs the same check (and opens / signs in what is
 * missing) before it starts; this bar shows the state and does it on demand.
 */
export function PreflightBar({ env, storesKey, disabled, pushed }: Props): JSX.Element | null {
  const [status, setStatus] = useState<PreflightStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (open: boolean) => {
      setBusy(true);
      setError(null);
      try {
        setStatus(await checkPreflight(env, open));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [env],
  );

  // A quick read-only check on load / env / store change (opens nothing).
  useEffect(() => {
    let alive = true;
    void fetchPreflight(env)
      .then((s) => {
        if (alive && s.checkedAt) setStatus(s);
      })
      .catch(() => undefined);
    void run(false);
    return () => {
      alive = false;
    };
  }, [env, storesKey, run]);

  useEffect(() => {
    if (pushed) setStatus(pushed);
  }, [pushed]);

  if (env !== 'dev') return null;

  const ok = !!status?.ok;
  return (
    <section className={`preflight ${ok ? 'ok' : 'bad'}`} aria-label="Điều kiện Chạy tất cả">
      <div className="pf-head">
        <b>{ok ? '✓ Đủ điều kiện "Chạy tất cả"' : '⛔ "Chạy tất cả" cần đủ:'}</b>
        <span className="muted small">GoCheckin · GAP Checkin · Portal đã mở + đăng nhập, Terminal đã kết nối</span>
      </div>
      <div className="pf-stores">
        {(status?.stores ?? []).map((s) => (
          <div key={s.store} className="pf-store">
            <span className="pf-name">
              Tiệm {s.store}
              {s.name ? ` · ${s.name}` : ''}
            </span>
            {ITEMS.map(([k, label]) => {
              const it: PreflightItem = k === 'terminal' ? s.terminal : s.sites[k];
              return (
                <span key={k} className={`pf-chip ${it.state}`} title={it.detail + (it.url ? `\n${it.url}` : '')}>
                  <i>{ICON[it.state] ?? '?'}</i> {label}
                </span>
              );
            })}
          </div>
        ))}
        {!status && <span className="muted small">{busy ? 'Đang kiểm tra…' : 'Chưa kiểm tra'}</span>}
      </div>
      <div className="pf-actions">
        <button
          className="btn sm primary"
          disabled={disabled || busy}
          onClick={() => void run(true)}
          title="Mở các trang còn thiếu (Edge, profile riêng mỗi tiệm), tự đăng nhập GoCheckin + GAP, mở app để đọc terminal"
        >
          {busy ? 'Đang mở & kiểm tra…' : 'Mở & đăng nhập tất cả'}
        </button>
        <button className="btn sm" disabled={busy} onClick={() => void run(false)} title="Chỉ đọc trạng thái, không mở gì">
          ↻ Kiểm tra lại
        </button>
      </div>
      {error && <div className="pf-problems">{error}</div>}
      {status && !ok && status.problems.length > 0 && (
        <ul className="pf-problems">
          {status.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
