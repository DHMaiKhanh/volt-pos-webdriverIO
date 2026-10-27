/**
 * Desktop launcher for the GUI test runner.
 *
 * Builds the UI if dist/ is missing (or `--build` is passed), starts the runner
 * server in-process, and opens it in a chromeless Microsoft Edge "app" window —
 * a real desktop window with its own taskbar entry, no Electron to install.
 * Edge ships with Windows 11, and the separate profile dir keeps this window out
 * of the user's normal browser session.
 *
 * Closing the window stops the server, unless a run is still in flight — then
 * the server keeps going so the run is not killed half-way (reopen with the same
 * command to watch it).
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASH_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(DASH_ROOT, '..');

if (process.argv.includes('--build') || !existsSync(path.join(DASH_ROOT, 'dist', 'index.html'))) {
  console.log('[desktop] building UI…');
  const r = spawnSync('npx vite build', { cwd: DASH_ROOT, shell: true, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const { listen, isRunning, PORT } = await import('./runner.mjs');
const url = `http://127.0.0.1:${PORT}/`;

try {
  await listen();
} catch (err) {
  if (err?.code !== 'EADDRINUSE') throw err;
  // A runner is already up (another window or `dashboard:full`) — just open a window onto it.
  console.log(`[desktop] port ${PORT} already in use — attaching a window to the running server.`);
}

function findEdge() {
  const candidates = [
    process.env.EDGE_PATH,
    path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

const edge = findEdge();
if (!edge) {
  console.log(`[desktop] Edge not found — open ${url} in any browser.`);
} else {
  const profile = path.join(REPO_ROOT, '.tmp', 'gui-window-profile');
  const win = spawn(
    edge,
    [`--app=${url}`, `--user-data-dir=${profile}`, '--window-size=1500,950', '--no-first-run', '--no-default-browser-check'],
    { stdio: 'ignore' },
  );
  console.log(`[desktop] window opened → ${url}`);
  const openedAt = Date.now();
  win.on('exit', () => {
    // Edge hands a URL to an already-open instance of the same profile and exits
    // at once — that is not the user closing the window.
    if (Date.now() - openedAt < 5000) {
      console.log('[desktop] window handed to an existing Edge instance — server stays up. Ctrl-C to stop.');
      return;
    }
    if (isRunning()) {
      console.log('[desktop] window closed, but a run is in progress — server stays up. Ctrl-C to stop.');
      return;
    }
    console.log('[desktop] window closed — bye.');
    process.exit(0);
  });
}
