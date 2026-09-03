import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardHistory } from '../types';

const DATA_URL = 'data/history.json';
/** Re-poll while the tab is open so a run finishing shows up without a reload. */
const POLL_MS = 5000;

interface HistoryState {
  history: DashboardHistory;
  loading: boolean;
  error: string | null;
  /** Force an immediate refetch (the header's refresh button). */
  reload: () => void;
}

const EMPTY: DashboardHistory = { updatedAt: '', runs: [] };

/**
 * Loads the run history the WDIO reporter writes to `public/data/history.json`.
 *
 * The file is regenerated after every run; a cache-busting query defeats the
 * dev server's 304s so a poll actually sees new data. The `updatedAt` stamp is
 * the change signal — we only re-render when it moves, so the 5s poll is cheap.
 */
export function useHistory(): HistoryState {
  const [history, setHistory] = useState<DashboardHistory>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastStamp = useRef<string | null>(null);

  const fetchOnce = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DashboardHistory;
      const stamp = `${data.updatedAt}:${data.runs?.length ?? 0}`;
      if (stamp !== lastStamp.current) {
        lastStamp.current = stamp;
        setHistory({ updatedAt: data.updatedAt ?? '', runs: data.runs ?? [] });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOnce();
    const id = window.setInterval(() => void fetchOnce(), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchOnce]);

  const reload = useCallback(() => void fetchOnce(), [fetchOnce]);

  return { history, loading, error, reload };
}
