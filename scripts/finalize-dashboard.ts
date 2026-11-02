/**
 * `tsx scripts/finalize-dashboard.ts` — fold a parallel-lane GUI run into ONE history entry.
 *
 * Lanes run their `wdio run`s side by side, so no single launcher's `onComplete`
 * can be "the last phase". dashboard/server/fast-run.mjs clears the fragments and
 * stamps the start itself, gives every lane `DASHBOARD_RUN_PHASE=2/3` (keep the
 * fragments, never fold), and calls this once every lane has finished.
 */

import { beginDashboardRun, finalizeDashboardRun } from '../configs/reporters/dashboardStore.js';

process.env.DASHBOARD_RUN_PHASE = '2/2';
beginDashboardRun(); // a later phase: keeps the fragments, takes the start from the stamp
const summary = finalizeDashboardRun();
console.log(
  summary
    ? `[dashboard] ${summary.runId}: ${String(summary.totals.passed)} passed, ${String(summary.totals.failed)} failed, ` +
        `${String(summary.totals.skipped)} skipped in ${String(Math.round(summary.durationMs / 60_000))} min`
    : '[dashboard] nothing to fold',
);
