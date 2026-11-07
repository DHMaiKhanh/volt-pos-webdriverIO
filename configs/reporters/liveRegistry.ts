import fs from 'node:fs';

/**
 * What the worker's services/hooks learn about a test that the reporter cannot
 * see on its own — WHY it was skipped, and WHERE its failure evidence went.
 *
 * Services, root hooks and reporters all run inside the same worker process, so
 * a `globalThis` map is enough to hand facts across without a file round trip.
 * Keyed by Mocha `fullTitle()` — the same string WDIO puts on `TestStats.fullTitle`.
 */

/** Why a test did not run, as the GUI shows it. */
export interface SkipInfo {
  /** Plain-words reason (Vietnamese), e.g. "CARD_SETTLE chưa bật — …". */
  text: string;
  /** `it.skip`, a runtime `this.skip()`, a hook failure that took the test down, … */
  kind: 'runtime' | 'static' | 'hook-failed' | 'unknown';
  /** Repo-relative `file:line` of the skip call, when known. */
  where?: string;
  /** The source line that skipped (`if (!CARD_SETTLE_ENABLED) this.skip();`). */
  code?: string;
  /** A comment next to that line — the author's own explanation. */
  comment?: string;
}

/** Manifest of one failure's evidence folder (under reports/evidence). */
export interface EvidenceInfo {
  /** Folder, relative to reports/evidence, forward slashes. */
  dir: string;
  /** Final screenshot at the moment of failure. */
  shot?: string;
  /** Replay frames before the failure, oldest first. */
  frames: { name: string; at: number; label: string }[];
  /** Last actions/steps the test took, oldest first. */
  steps: { at: number; text: string }[];
  dom?: string;
  log?: string;
  url?: string;
  failedAt: number;
}

interface Registry {
  /** Skip reasons by test fullTitle, or by SUITE fullTitle for a before-all skip. */
  skips: Map<string, SkipInfo>;
  evidence: Map<string, EvidenceInfo>;
}

const KEY = Symbol.for('volt-e2e.liveRegistry');

export function registry(): Registry {
  const g = globalThis as unknown as Record<symbol, Registry | undefined>;
  return (g[KEY] ??= { skips: new Map(), evidence: new Map() });
}

/**
 * Registry key for a title path. Mocha joins suite and test with a space, WDIO's
 * `TestStats.fullTitle` with a dot — fold both (and any run of either) to one space.
 */
export const titleKey = (fullTitle: string): string => fullTitle.replace(/[\s.]+/g, ' ').trim();

/** The skip reason recorded for a test — its own, else the nearest enclosing suite's. */
export function skipReasonFor(fullTitle: string): SkipInfo | undefined {
  const { skips } = registry();
  const key = titleKey(fullTitle);
  const own = skips.get(key);
  if (own) return own;
  let best: { len: number; info: SkipInfo } | undefined;
  for (const [suite, info] of skips) {
    if (key.startsWith(`${suite} `) && suite.length > (best?.len ?? -1)) best = { len: suite.length, info };
  }
  return best?.info;
}

/** Append one JSON line to the GUI runner's live-event file, if a GUI run set one. */
export function emitLive(event: Record<string, unknown>): void {
  const file = process.env.GUI_LIVE_FILE;
  if (!file) return;
  try {
    fs.appendFileSync(file, `${JSON.stringify({ ...event, at: Date.now() })}\n`);
  } catch {
    // Live view is a convenience — never fail a spec over it.
  }
}
