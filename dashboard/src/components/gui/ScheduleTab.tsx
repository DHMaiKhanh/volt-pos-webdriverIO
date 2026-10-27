import { useEffect, useState } from 'react';
import type { Schedule } from '../../lib/gui';
import { loadSchedules, saveSchedules } from '../../lib/gui';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

interface ScheduleTabProps {
  env: string;
  selected: string[];
  tags: string[];
}

/**
 * Lịch chạy tự động. The runner server owns the clock (checks every 20 s) and
 * fires a schedule only while this app's server is up — it is not a Windows task.
 */
export function ScheduleTab({ env, selected, tags }: ScheduleTabProps): JSX.Element {
  const [list, setList] = useState<Schedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('Regression đêm');
  const [time, setTime] = useState('22:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    loadSchedules().then(setList).catch((e: Error) => setError(e.message));
  }, []);

  const persist = async (next: Schedule[]): Promise<void> => {
    try {
      setList(await saveSchedules(next));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const add = (): void => {
    if (selected.length === 0) {
      setError('Chọn ít nhất một spec ở cột trái trước khi lưu lịch.');
      return;
    }
    void persist([
      ...list,
      { id: String(Date.now()), name: name || 'Lịch chạy', time, days, env, specs: selected, tags, enabled: true },
    ]);
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card card-pad">
        <h3 className="card-title">Thêm lịch từ lựa chọn hiện tại</h3>
        <div className="form-row">
          <label>
            Tên
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Giờ
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <div className="days">
            {DAYS.map((d, i) => (
              <button
                key={d}
                className={`chip ${days.includes(i) ? 'on' : ''}`}
                onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())}
              >
                {d}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={add}>
            + Lưu lịch
          </button>
        </div>
        <p className="muted small">
          Sẽ chạy <b>{selected.length}</b> spec trên ENV <b>{env}</b>
          {tags.length ? ` (lọc tag ${tags.join(', ')})` : ''}. Lịch chỉ chạy khi cửa sổ Test Runner (server) đang mở; nếu lúc
          đó đang có lần chạy khác thì bỏ qua.
        </p>
        {error && <p className="run-error">{error}</p>}
      </section>

      <section className="card">
        {list.length === 0 ? (
          <p className="muted pad">Chưa có lịch nào.</p>
        ) : (
          <ul className="inbox">
            {list.map((s) => (
              <li key={s.id} className="inbox-row">
                <div className="inbox-main">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => void persist(list.map((x) => (x.id === s.id ? { ...x, enabled: e.target.checked } : x)))}
                    />
                  </label>
                  <div className="inbox-text">
                    <div className="inbox-title">
                      ⏰ {s.time} · {s.name}
                    </div>
                    <div className="inbox-meta">
                      {s.days.length === 7 || s.days.length === 0 ? 'Hằng ngày' : s.days.map((d) => DAYS[d]).join(', ')} · ENV {s.env} ·{' '}
                      {s.specs.length} spec{s.tags.length ? ` · ${s.tags.join(' ')}` : ''}
                      {s.lastResult ? ` · lần cuối: ${s.lastResult}` : ''}
                    </div>
                  </div>
                  <button className="btn sm" onClick={() => void persist(list.filter((x) => x.id !== s.id))}>
                    Xoá
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
