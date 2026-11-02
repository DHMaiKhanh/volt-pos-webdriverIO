import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Shapes served by dashboard/server/runner.mjs ───────────────────────── */

export interface CatalogTest {
  title: string;
  tags: string[];
  skip: boolean;
}

export interface CatalogFile {
  /** Repo-relative, forward slashes — the id used everywhere. */
  path: string;
  name: string;
  describe: string;
  tags: string[];
  tests: CatalogTest[];
}

export interface Feature {
  key: string;
  name: string;
  files: CatalogFile[];
}

export type LiveState = 'passed' | 'failed' | 'skipped';

export interface LiveResult {
  key: string;
  file: string;
  title: string;
  fullTitle: string;
  state: LiveState;
  durationMs: number;
  /** 1-based spec-file attempt (specFileRetries reruns a whole file). */
  attempt: number;
  hook: boolean;
  error?: string;
  flaky: boolean;
  at: number;
}

export interface RunSummary {
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  done: number;
}

export interface RunInfo {
  id: string;
  env: string;
  label: string;
  specs: string[];
  grep: string;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  planned: number;
  estimateMs: number;
  activeSpec: string | null;
  specsDone: number;
  summary: RunSummary;
  version: number;
}

export interface RunRequest {
  env: string;
  specs: string[];
  tags?: string[];
  titles?: string[];
  label?: string;
  retries?: number;
  /** ⚡ Chạy nhanh: attach to the pre-warmed app, launch only payment / customer-display files; skips manual/@broken. */
  fast?: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  time: string;
  days: number[];
  env: string;
  specs: string[];
  tags: string[];
  enabled: boolean;
  lastResult?: string;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body ?? {}),
});

/* ── Catalogue ──────────────────────────────────────────────────────────── */

export function useCatalog(): { features: Feature[]; error: string | null; refresh: () => void } {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (refresh = false) => {
    try {
      const data = await json<{ features: Feature[] }>(`/api/gui/catalog${refresh ? '?refresh=1' : ''}`);
      setFeatures(data.features);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);
  useEffect(() => void load(), [load]);
  return { features, error, refresh: () => void load(true) };
}

/* ── Live run state + log ───────────────────────────────────────────────── */

/** The runner's pre-warmed app (dashboard/server/warm.mjs). */
export type WarmState = 'off' | 'cold' | 'warming' | 'ready' | 'busy' | 'error';

export interface WarmStatus {
  enabled: boolean;
  state: WarmState;
  detail: string;
  preflightOk: boolean;
  launched: boolean;
  at: string | null;
}

/** Parallel app copies (docs/parallel-instances.md): which exist, which are signed in. */
export interface LanesStatus {
  max: number;
  copies: Array<{ n: number; signedIn: boolean }>;
}

/** Freezing the user's other apps during a sweep (scripts/freeze-apps.ps1). */
export interface FreezeStatus {
  enabled: boolean;
  /** Processes frozen right now — 0 between runs. */
  frozen: number;
}

export interface GuiRunner {
  online: boolean;
  running: boolean;
  run: RunInfo | null;
  results: LiveResult[];
  log: string;
  warm: WarmStatus | null;
  lanes: LanesStatus | null;
  freeze: FreezeStatus | null;
  start: (req: RunRequest) => Promise<string | null>;
  stop: () => Promise<string | null>;
  /** `true`/`false` switches the pre-warm; omitted retries it now. */
  setWarm: (enabled?: boolean) => Promise<void>;
  /** Open copy `n` on screen with its QR login, for the one-time device sign-in. */
  signInCopy: (n: number) => Promise<string | null>;
  setFreeze: (enabled: boolean) => Promise<void>;
  clearLog: () => void;
}

/**
 * Polls the runner: state every second while busy (4 s idle), results only when
 * the server's version moved, and the log by byte offset so it grows in place.
 * `onFinished` fires once on the running → idle edge.
 */
export function useGuiRunner(onFinished?: (run: RunInfo) => void): GuiRunner {
  const [online, setOnline] = useState(false);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunInfo | null>(null);
  const [results, setResults] = useState<LiveResult[]>([]);
  const [log, setLog] = useState('');
  const [warm, setWarmState] = useState<WarmStatus | null>(null);
  const [lanes, setLanes] = useState<LanesStatus | null>(null);
  const [freeze, setFreezeState] = useState<FreezeStatus | null>(null);
  const version = useRef(-1);
  const logOffset = useRef(0);
  const wasRunning = useRef(false);
  const finishedCb = useRef(onFinished);
  finishedCb.current = onFinished;

  const poll = useCallback(async (): Promise<boolean> => {
    try {
      const s = await json<{
        running: boolean;
        run: RunInfo | null;
        results?: LiveResult[];
        warm?: WarmStatus | null;
        lanes?: LanesStatus | null;
        freeze?: FreezeStatus | null;
      }>(`/api/gui/state?since=${version.current}`);
      setOnline(true);
      setRunning(s.running);
      setRun(s.run);
      setWarmState(s.warm ?? null);
      setLanes(s.lanes ?? null);
      setFreezeState(s.freeze ?? null);
      if (s.results) setResults(s.results);
      if (s.run) version.current = s.run.version;

      const l = await json<{ text: string; nextOffset: number; reset: boolean }>(
        `/api/gui/log?offset=${logOffset.current}`,
      );
      if (l.reset) setLog(l.text);
      else if (l.text) setLog((prev) => prev + l.text);
      logOffset.current = l.nextOffset;

      if (wasRunning.current && !s.running && s.run) finishedCb.current?.(s.run);
      wasRunning.current = s.running;
      return s.running;
    } catch {
      setOnline(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let timer: number;
    let alive = true;
    const tick = async (): Promise<void> => {
      const busy = await poll();
      if (alive) timer = window.setTimeout(() => void tick(), busy ? 1000 : 4000);
    };
    void tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [poll]);

  const start = useCallback(
    async (req: RunRequest): Promise<string | null> => {
      try {
        await json('/api/gui/run', post(req));
        setLog('');
        setResults([]);
        logOffset.current = 0;
        version.current = -1;
        await poll();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
    [poll],
  );

  const stop = useCallback(async (): Promise<string | null> => {
    try {
      await json('/api/gui/stop', post());
      await poll();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  }, [poll]);

  const setWarm = useCallback(async (enabled?: boolean): Promise<void> => {
    try {
      const r = await json<{ warm: WarmStatus }>(
        '/api/gui/warm',
        post(enabled === undefined ? { now: true } : { enabled }),
      );
      setWarmState(r.warm);
    } catch {
      /* the next poll shows whatever the server has */
    }
  }, []);

  const signInCopy = useCallback(async (n: number): Promise<string | null> => {
    try {
      const r = await json<{ lanes: LanesStatus }>('/api/gui/lanes/signin', post({ n }));
      setLanes(r.lanes);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  }, []);

  const setFreeze = useCallback(async (enabled: boolean): Promise<void> => {
    try {
      const r = await json<{ freeze: FreezeStatus }>('/api/gui/freeze', post({ enabled }));
      setFreezeState(r.freeze);
    } catch {
      /* the next poll shows whatever the server has */
    }
  }, []);

  const clearLog = useCallback(() => setLog(''), []);

  return {
    online,
    running,
    run,
    results,
    log,
    warm,
    lanes,
    freeze,
    start,
    stop,
    setWarm,
    signInCopy,
    setFreeze,
    clearLog,
  };
}

/* ── Schedules ──────────────────────────────────────────────────────────── */

export async function loadSchedules(): Promise<Schedule[]> {
  return (await json<{ schedules: Schedule[] }>('/api/gui/schedules')).schedules;
}

export async function saveSchedules(schedules: Schedule[]): Promise<Schedule[]> {
  const init = { ...post({ schedules }), method: 'PUT' };
  return (await json<{ schedules: Schedule[] }>('/api/gui/schedules', init)).schedules;
}

/* ── Small persisted-state helper (per-viewer conveniences only) ────────── */

export function usePersisted<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked — keep it in memory */
    }
  }, [key, value]);
  return [value, setValue];
}

/** Feature key of a spec path: `tests/regression/home/x.spec.ts` → `regression/home`. */
export function featureKeyOf(file: string): string {
  return (
    file
      .replace(/^tests\//, '')
      .split('/')
      .slice(0, -1)
      .join('/') || 'root'
  );
}
