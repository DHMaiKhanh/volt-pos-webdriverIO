import fs from 'node:fs';
import path from 'node:path';

export interface AppCandidate {
  /** Absolute path to the executable. */
  exe: string;
  /** Human label for the preflight report. */
  label: string;
  /** How it was found — an explicit env var beats discovery. */
  source: 'APP_PATH' | 'install' | 'source-build';
}

/**
 * Known Windows install roots, newest-first in the order we trust them.
 *
 * The NSIS bundle is built with `installMode: currentUser`
 * (src-tauri/tauri.conf.json), so the app lands in `%LOCALAPPDATA%\<productName>`
 * rather than Program Files. Per-environment builds are produced by
 * `.github/workflows/release.yml` with a different `TAURI_BUILD_CONFIG`, so a
 * machine can legitimately hold more than one of these at once — which is
 * exactly why the ENV must name the binary instead of the suite guessing.
 */
const INSTALL_DIR_CANDIDATES = (localAppData: string, programFiles: string[]): string[] => [
  path.join(localAppData, 'volt-pos'),
  path.join(localAppData, 'VoltPOS'),
  path.join(localAppData, 'VoltPOS.Dev'),
  ...programFiles.map((root) => path.join(root, 'volt-pos')),
  ...programFiles.map((root) => path.join(root, 'VoltPOS')),
];

const EXE_NAMES = ['volt-pos-app.exe', 'volt-pos.exe', 'VoltPOS.exe'];

function firstExisting(dir: string): string | null {
  for (const name of EXE_NAMES) {
    const full = path.join(dir, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

/**
 * Resolve which binary this run drives.
 *
 * Order:
 *  1. `APP_PATH` from the environment file — the only deterministic answer, and
 *     the one CI must use.
 *  2. A discovered install under `%LOCALAPPDATA%` / Program Files.
 *  3. A debug build inside the app repo, when `VOLT_POS_SRC` points at it.
 *
 * Returns every candidate so `preflight` can SHOW the operator what it picked
 * and what else was lying around — silently picking the wrong build is the most
 * expensive failure mode this suite has, because the tests still pass, just
 * against the wrong backend.
 */
export function resolveAppCandidates(explicitPath?: string, voltPosSrc?: string): AppCandidate[] {
  const found: AppCandidate[] = [];

  if (explicitPath && explicitPath.trim()) {
    const exe = path.resolve(explicitPath.trim());
    found.push({ exe, label: 'APP_PATH (explicit)', source: 'APP_PATH' });
  }

  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(
    (v): v is string => !!v,
  );

  if (localAppData) {
    for (const dir of INSTALL_DIR_CANDIDATES(localAppData, programFiles)) {
      const exe = firstExisting(dir);
      if (exe) found.push({ exe, label: `install: ${path.basename(dir)}`, source: 'install' });
    }
  }

  if (voltPosSrc && voltPosSrc.trim()) {
    for (const profile of ['debug', 'release']) {
      const exe = firstExisting(path.join(path.resolve(voltPosSrc.trim()), 'target', profile));
      if (exe) found.push({ exe, label: `source build (${profile})`, source: 'source-build' });
    }
  }

  return found;
}

/** The one binary this run drives, or `null` when nothing was found. */
export function resolveAppPath(explicitPath?: string, voltPosSrc?: string): string | null {
  const candidates = resolveAppCandidates(explicitPath, voltPosSrc);
  const chosen = candidates[0];
  if (!chosen) return null;
  return fs.existsSync(chosen.exe) ? chosen.exe : null;
}
