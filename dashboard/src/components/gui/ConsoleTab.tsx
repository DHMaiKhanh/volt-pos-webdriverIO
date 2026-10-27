import { useEffect, useRef, useState } from 'react';
import type { GuiRunner } from '../../lib/gui';

/** Raw `wdio` output. Lines tinted by the spec reporter's [PASS]/[FAIL]/[SKIP] symbols. */
export function ConsoleTab({ runner }: { runner: GuiRunner }): JSX.Element {
  const ref = useRef<HTMLPreElement>(null);
  const [follow, setFollow] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [runner.log, follow]);

  // Only the tail is rendered: a full regression log is megabytes.
  const lines = runner.log.split('\n');
  const shown = (filter ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase())) : lines).slice(-4000);

  return (
    <div className="card console">
      <div className="sec-head pad">
        <h3>⚡ Console</h3>
        {runner.run && (
          <span className="muted">
            {runner.run.label} · ENV {runner.run.env}
          </span>
        )}
        <span className="spacer" />
        <input type="search" placeholder="Lọc dòng log…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label className="toggle">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Tự cuộn
        </label>
        <button className="btn sm" onClick={() => void navigator.clipboard?.writeText(runner.log)}>
          Copy
        </button>
        <button className="btn sm" onClick={runner.clearLog}>
          Xoá
        </button>
      </div>
      <pre className="log big" ref={ref}>
        {shown.length === 1 && !shown[0] ? (
          <span className="muted">Chưa có log. Bấm ▶ Chạy để bắt đầu.</span>
        ) : (
          shown.map((l, i) => (
            <div
              key={i}
              className={
                /\[FAIL\]|Error:|✖|FAILED/.test(l) ? 'ln-fail' : /\[PASS\]|PASSED/.test(l) ? 'ln-pass' : /\[SKIP\]/.test(l) ? 'ln-skip' : undefined
              }
            >
              {l || ' '}
            </div>
          ))
        )}
      </pre>
    </div>
  );
}
