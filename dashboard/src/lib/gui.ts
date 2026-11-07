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
  /** Whole failure message (multi-line expect diffs). */
  message?: string;
  stack?: string;
  /** Why a skipped test did not run. */
  skip?: SkipInfo;
  /** Screenshot / replay / steps captured at the failure. */
  evidence?: Evidence;
  flaky: boolean;
  at: number;
}

/** Mirrors configs/reporters/liveRegistry.ts — keep in sync by hand. */
export interface SkipInfo {
  text: string;
  kind: 'runtime' | 'static' | 'hook-failed' | 'unknown';
  where?: string;
  code?: string;
  comment?: string;
}

export interface Evidence {
  dir: string;
  shot?: string;
  frames: { name: string; at: number; label: string }[];
  steps: { at: number; text: string }[];
  dom?: string;
  log?: string;
  url?: string;
  failedAt: number;
}

/** URL of one file in a failure's evidence folder, served by runner.mjs. */
export const evidenceUrl = (ev: Evidence, name: string): string =>
  `/api/gui/evidence/${ev.dir.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(name)}`;

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
  /** Apps for this run; omitted = the choice saved on the runner (AppsStatus.config). */
  apps?: { count?: number; stores?: string[] };
  /** "Chạy tất cả": the runner first checks web pages + terminal (preflight.mjs). */
  all?: boolean;
}

/* ── "Chạy tất cả" gate (dashboard/server/preflight.mjs) ─────────────────── */

export type PreflightState = 'ok' | 'login' | 'closed' | 'nocreds' | 'down' | 'unknown';
export interface PreflightItem {
  state: PreflightState;
  detail: string;
  url?: string;
}
export interface PreflightStore {
  store: string;
  name: string;
  sites: { gocheckin: PreflightItem; gap: PreflightItem; portal: PreflightItem };
  terminal: PreflightItem;
}
export interface PreflightStatus {
  env: string;
  stores: PreflightStore[];
  ok: boolean;
  problems: string[];
  checkedAt: string | null;
  busy?: boolean;
}

export async function fetchPreflight(env: string): Promise<PreflightStatus> {
  return (await json<{ preflight: PreflightStatus }>(`/api/gui/preflight?env=${encodeURIComponent(env)}`))
    .preflight;
}

/** `open`: open + sign in the missing web pages and boot the app to read the terminal. */
export async function checkPreflight(env: string, open: boolean): Promise<PreflightStatus> {
  return (await json<{ preflight: PreflightStatus }>('/api/gui/preflight', post({ env, open }))).preflight;
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

/** Environments / stores / apps (dashboard/server/apps.mjs, docs/parallel-instances.md). */
/** `dev` is shown as "Staging": dev and staging are one environment (the dev build). */
export type EnvName = 'dev' | 'prod';

export interface StoreInfo {
  id: string;
  name?: string;
}

export interface EnvProfile {
  label: string;
  stores: StoreInfo[];
  readOnly: boolean;
  /** Most apps this env may run side by side. */
  max: number;
}

export interface AppSlot {
  /** 1-based position: App 1, App 2, App 3. */
  slot: number;
  /** Instance number: 0 = the installed app, else the copy in <root>\i<n>. */
  n: number;
  store: string;
  kind: 'installed' | 'copy';
  exists: boolean;
  signedIn: boolean;
  /** Which build the copy was made from (dev / staging / prod), if known. */
  buildEnv: string | null;
  madeAt?: string | null;
}

export interface AppsStatus {
  env: EnvName;
  profiles: Record<EnvName, EnvProfile>;
  config: Record<EnvName, { count: number; stores: string[] }>;
  /** The build new copies of `env` are made from, and whether it IS that env. */
  source: { path: string; env: string | null; matches: boolean };
  slots: AppSlot[];
  root: string;
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
  apps: AppsStatus | null;
  freeze: FreezeStatus | null;
  start: (req: RunRequest) => Promise<string | null>;
  stop: () => Promise<string | null>;
  /** `true`/`false` switches the pre-warm; omitted retries it now. */
  setWarm: (enabled?: boolean) => Promise<void>;
  /** Make copy `n` if needed and open it on screen with its QR login, for the one-time device sign-in. */
  signInApp: (n: number) => Promise<string | null>;
  /** Save how many apps the current env runs and which store each one tests. */
  setApps: (patch: { count?: number; stores?: string[] }) => Promise<string | null>;
  setFreeze: (enabled: boolean) => Promise<void>;
  clearLog: () => void;
}

/**
 * Polls the runner: state every second while busy (4 s idle), results only when
 * the server's version moved, and the log by byte offset so it grows in place.
 * `onFinished` fires once on the running → idle edge.
 */
export function useGuiRunner(env: string, onFinished?: (run: RunInfo) => void): GuiRunner {
  const [online, setOnline] = useState(false);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunInfo | null>(null);
  const [results, setResults] = useState<LiveResult[]>([]);
  const [log, setLog] = useState('');
  const [warm, setWarmState] = useState<WarmStatus | null>(null);
  const [apps, setAppsState] = useState<AppsStatus | null>(null);
  const envRef = useRef(env);
  envRef.current = env;
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
        apps?: AppsStatus | null;
        freeze?: FreezeStatus | null;
      }>(`/api/gui/state?since=${version.current}&env=${encodeURIComponent(envRef.current)}`);
      setOnline(true);
      setRunning(s.running);
      setRun(s.run);
      setWarmState(s.warm ?? null);
      setAppsState(s.apps ?? null);
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

  const signInApp = useCallback(async (n: number): Promise<string | null> => {
    try {
      const r = await json<{ apps: AppsStatus }>('/api/gui/apps/signin', post({ n, env: envRef.current }));
      setAppsState(r.apps);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  }, []);

  const setApps = useCallback(
    async (patch: { count?: number; stores?: string[] }): Promise<string | null> => {
      try {
        const r = await json<{ apps: AppsStatus }>('/api/gui/apps', post({ env: envRef.current, ...patch }));
        setAppsState(r.apps);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
    [],
  );

  // Another env picked: show its apps now rather than at the next idle poll.
  useEffect(() => {
    void poll();
  }, [env, poll]);

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
    apps,
    freeze,
    start,
    stop,
    setWarm,
    signInApp,
    setApps,
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
