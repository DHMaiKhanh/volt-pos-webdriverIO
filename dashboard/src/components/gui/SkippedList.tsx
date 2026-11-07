import { useMemo, useState } from 'react';
import type { LiveResult } from '../../lib/gui';

const KIND_LABEL: Record<string, string> = {
  runtime: 'Điều kiện lúc chạy',
  static: 'Tắt trong code',
  'hook-failed': 'Do hook lỗi',
  unknown: 'Không rõ',
};

/**
 * Skipped tests grouped by WHY — "25 test: CARD_SETTLE chưa bật" reads at a
 * glance where 25 bare "bỏ qua" rows did not.
 */
export function SkippedList({ results }: { results: LiveResult[] }): JSX.Element | null {
  const [open, setOpen] = useState<string | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, { text: string; kind: string; tests: LiveResult[] }>();
    for (const r of results) {
      if (r.state !== 'skipped') continue;
      const text = r.skip?.text ?? 'Không ghi được lý do (chạy trước khi bật tính năng ghi lý do skip).';
      const g = m.get(text) ?? { text, kind: r.skip?.kind ?? 'unknown', tests: [] };
      g.tests.push(r);
      m.set(text, g);
    }
    return [...m.values()].sort((a, b) => b.tests.length - a.tests.length);
  }, [results]);

  const total = groups.reduce((n, g) => n + g.tests.length, 0);
  if (total === 0) return null;

  return (
    <section className="card">
      <div className="sec-head pad">
        <h3>⏭ Test bị bỏ qua</h3>
        <span className="pill">
          {total} test · {groups.length} lý do
        </span>
      </div>
      <ul className="inbox">
        {groups.map((g) => (
          <li key={g.text} className="inbox-row">
            <div className="inbox-main" onClick={() => setOpen(open === g.text ? null : g.text)}>
              <span className="ibadge skip">{g.tests.length}</span>
              <div className="inbox-text">
                <div className="inbox-title">{g.text}</div>
                <div className="inbox-meta">
                  {KIND_LABEL[g.kind] ?? g.kind} · bấm để xem từng test và dòng code gây skip
                </div>
              </div>
            </div>
            {open === g.text && (
              <ul className="skip-tests">
                {g.tests.map((r) => (
                  <li key={r.key}>
                    <div>
                      <b>{r.title}</b> <span className="muted small">· {r.file.replace(/^tests\//, '')}</span>
                    </div>
                    {r.skip?.where && (
                      <div className="small">
                        <span className="muted">Tại</span> <code>{r.skip.where}</code>
                        {r.skip.code && (
                          <>
                            {' '}
                            <span className="muted">·</span> <code>{r.skip.code}</code>
                          </>
                        )}
                      </div>
                    )}
                    {r.skip?.comment && r.skip.text.indexOf(r.skip.comment) < 0 && (
                      <div className="small muted">Ghi chú trong code: {r.skip.comment}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
