import { useLayoutEffect, useRef, useState } from 'react';
import type { DashboardRun } from '../types';
import { formatDateTime, formatPercent } from '../lib/format';

/** Tracks a block element's rendered width so the SVG maps 1 unit to 1px. */
function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, width];
}

const H = 240;
const PAD = { top: 18, right: 18, bottom: 30, left: 40 };
const Y_TICKS = [0, 25, 50, 75, 100];

/**
 * Pass rate across runs — one blue series (so no legend), chronological
 * left→right. End dots are status-coloured (green = clean run, red = had
 * failures) so the eye lands on the bad runs; hover any dot for the detail.
 */
export function PassRateTrend({
  runs,
  selectedId,
  onSelect,
}: {
  runs: DashboardRun[];
  selectedId: string | null;
  onSelect: (runId: string) => void;
}): JSX.Element {
  const [wrapRef, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  // History is newest-first; the trend reads oldest→newest.
  const series = [...runs].reverse();
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;

  const x = (i: number): number =>
    series.length > 1 ? PAD.left + i * stepX : PAD.left + innerW / 2;
  const y = (rate: number): number => PAD.top + innerH * (1 - rate / 100);

  const points = series.map((run, i) => ({
    run,
    i,
    px: x(i),
    py: y(run.totals.passRate),
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px},${p.py}`).join(' ');

  const onMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (!series.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let nearest = 0;
    let best = Infinity;
    for (const p of points) {
      const d = Math.abs(p.px - mx);
      if (d < best) {
        best = d;
        nearest = p.i;
      }
    }
    setHover(nearest);
  };

  const active = hover !== null ? points[hover] : null;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label="Pass rate across recent runs"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block' }}
      >
        {/* Gridlines + y labels (recessive hairlines, text in muted ink) */}
        {Y_TICKS.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}

        {/* Trend line */}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--series)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Hover guide */}
        {active && (
          <line
            x1={active.px}
            x2={active.px}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--baseline)"
            strokeWidth={1}
          />
        )}

        {/* Status dots with a 2px surface ring; selected/hovered grow */}
        {points.map((p) => {
          const clean = p.run.totals.failed === 0;
          const isSel = p.run.runId === selectedId;
          const isHover = hover === p.i;
          const r = isHover || isSel ? 6 : 4;
          return (
            <circle
              key={p.run.runId}
              cx={p.px}
              cy={p.py}
              r={r}
              fill={clean ? 'var(--pass)' : 'var(--fail)'}
              stroke="var(--surface)"
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelect(p.run.runId)}
              onMouseEnter={() => setHover(p.i)}
            />
          );
        })}
      </svg>

      {active && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(active.px, 60), width - 60),
            top: active.py,
          }}
        >
          <b>{formatPercent(active.run.totals.passRate)}</b> pass rate
          <br />
          {active.run.totals.passed}/{active.run.totals.tests} tests ·{' '}
          {active.run.totals.failed} failed
          <br />
          <span style={{ opacity: 0.75 }}>{formatDateTime(active.run.finishedAt)}</span>
        </div>
      )}
    </div>
  );
}
