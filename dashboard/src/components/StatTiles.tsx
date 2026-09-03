import type { DashboardRun } from '../types';
import { formatDuration, formatPercent } from '../lib/format';

/** One KPI tile. `accent`/`color` tint it by the status it reports. */
function Tile(props: {
  label: string;
  value: string;
  hero?: boolean;
  accent?: 'pass' | 'fail' | 'skip';
  color?: 'pass' | 'fail' | 'skip';
  foot?: string;
}): JSX.Element {
  const { label, value, hero, accent, color, foot } = props;
  return (
    <div className={`card tile${accent ? ` accent-${accent}` : ''}`}>
      <span className="label">{label}</span>
      <span className={`value${hero ? ' hero' : ''}${color ? ` c-${color}` : ''}`}>{value}</span>
      {foot ? <span className="foot">{foot}</span> : null}
    </div>
  );
}

/**
 * The composition bar: passed/failed/skipped as one stacked track, each segment
 * separated by the 2px surface gap. Zero-width segments collapse cleanly.
 */
function CompositionBar({ run }: { run: DashboardRun }): JSX.Element {
  const { passed, failed, skipped, tests } = run.totals;
  const pct = (n: number): string => (tests ? `${(n / tests) * 100}%` : '0%');
  return (
    <div
      className="compbar"
      role="img"
      aria-label={`${passed} passed, ${failed} failed, ${skipped} skipped`}
    >
      {passed > 0 && <span className="s-pass" style={{ width: pct(passed) }} />}
      {failed > 0 && <span className="s-fail" style={{ width: pct(failed) }} />}
      {skipped > 0 && <span className="s-skip" style={{ width: pct(skipped) }} />}
    </div>
  );
}

export function StatTiles({ run }: { run: DashboardRun }): JSX.Element {
  const { tests, passed, failed, skipped, passRate } = run.totals;
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid tiles">
        <Tile
          label="Pass rate"
          value={formatPercent(passRate)}
          hero
          color={failed > 0 ? 'fail' : 'pass'}
          foot={`${passed}/${passed + failed} executed`}
        />
        <Tile label="Total tests" value={String(tests)} />
        <Tile label="Passed" value={String(passed)} accent="pass" color="pass" />
        <Tile label="Failed" value={String(failed)} accent={failed ? 'fail' : undefined} color="fail" />
        <Tile label="Skipped" value={String(skipped)} accent={skipped ? 'skip' : undefined} color="skip" />
        <Tile label="Duration" value={formatDuration(run.durationMs)} />
      </div>
      <CompositionBar run={run} />
    </div>
  );
}
