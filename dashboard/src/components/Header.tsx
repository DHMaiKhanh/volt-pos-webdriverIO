import { useState } from 'react';
import { formatRelative } from '../lib/format';

interface HeaderProps {
  updatedAt: string;
  runCount: number;
  onRefresh: () => void;
}

type Theme = 'light' | 'dark';

function currentTheme(): Theme | null {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : null;
}

export function Header({ updatedAt, runCount, onRefresh }: HeaderProps): JSX.Element {
  const [theme, setTheme] = useState<Theme | null>(currentTheme());

  const toggleTheme = (): void => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const active = theme ?? (prefersDark ? 'dark' : 'light');
    const next: Theme = active === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('volt-dashboard-theme', next);
    setTheme(next);
  };

  return (
    <header className="header">
      <div>
        <h1>Volt POS — E2E Run Dashboard</h1>
        <div className="sub">
          {runCount === 0
            ? 'No runs recorded yet'
            : `${runCount} run${runCount === 1 ? '' : 's'}`}
          {updatedAt ? ` · updated ${formatRelative(updatedAt)}` : ''}
        </div>
      </div>
      <div className="header-actions">
        <button className="btn" onClick={onRefresh} title="Reload run data">
          ↻ Refresh
        </button>
        <button className="btn icon" onClick={toggleTheme} title="Toggle light/dark">
          {(theme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) ===
          'dark'
            ? '☀'
            : '☾'}
        </button>
      </div>
    </header>
  );
}
