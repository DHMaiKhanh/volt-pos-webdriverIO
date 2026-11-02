import { execFileSync, spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('process');

const imagesFromEnv = (name: string): string[] =>
  (process.env[name] ?? '')
    .split(',')
    .map((image) => image.trim())
    .filter(Boolean);

/**
 * Image names that belong to a Volt POS run and must not survive it.
 *
 * A parallel test instance (VOLT_INSTANCE ≥ 1, docs/parallel-instances.md) runs
 * RENAMED copies — `volt-pos-i1.exe`, `msedgedriver-i1.exe`, `tauri-driver-i1.exe`
 * — and lists them in APP_IMAGES / DRIVER_IMAGES, so every kill and "is it
 * running" below stays inside its own instance and never takes down the app or
 * the driver another lane is driving.
 */
export const APP_IMAGE_NAMES: readonly string[] = imagesFromEnv('APP_IMAGES').length
  ? imagesFromEnv('APP_IMAGES')
  : ['volt-pos-app.exe', 'volt-pos.exe', 'VoltPOS.exe'];
export const DRIVER_IMAGE_NAMES: readonly string[] = imagesFromEnv('DRIVER_IMAGES').length
  ? imagesFromEnv('DRIVER_IMAGES')
  : ['tauri-driver.exe', 'msedgedriver.exe'];
export const MSEDGEDRIVER_IMAGE =
  DRIVER_IMAGE_NAMES.find((i) => /msedgedriver/i.test(i)) ?? 'msedgedriver.exe';
export const TAURI_DRIVER_IMAGE =
  DRIVER_IMAGE_NAMES.find((i) => /tauri-driver/i.test(i)) ?? 'tauri-driver.exe';

function tasklistHas(image: string): boolean {
  try {
    const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return out.toLowerCase().includes(image.toLowerCase());
  } catch {
    return false;
  }
}

/** Every listed image currently running. */
export function runningImages(images: readonly string[]): string[] {
  return images.filter((image) => tasklistHas(image));
}

/**
 * Command lines of the wdio runs alive on this machine — a launcher
 * (`…\@wdio\cli\bin\wdio.js run …`) or a worker (`…\@wdio\local-runner\…`).
 * With `includeGuiJobs`, also the GUI runner's job wrapper (`fast-run.mjs`),
 * which is alive between the phases of a run when no wdio is.
 *
 * A process listing through CIM (~1s), so only for decisions that may close an
 * app someone else's run is driving.
 *
 * Parallel lanes each run their own config, named `….i<N>.conf.ts` for instance
 * N ≥ 1, so a wdio process is counted only for the instance whose app it drives:
 * lane 1 mid-test does not make instance 0's preflight think its app is in use.
 * The GUI job wrapper drives every lane, so it counts for all of them.
 */
export function activeWdioRuns({ includeGuiJobs = false }: { includeGuiJobs?: boolean } = {}): string[] {
  const instance = Number(process.env.VOLT_INSTANCE ?? 0) || 0;
  const laneOf = (cmd: string): number => Number(/\.i(\d+)\.conf\.ts/i.exec(cmd)?.[1] ?? 0);
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object { $_.CommandLine }`,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  return (r.stdout ?? '')
    .split(/\r?\n/)
    .filter(
      (cmd) =>
        (/local-runner|wdio\.js"?\s+run/i.test(cmd) && laneOf(cmd) === instance) ||
        (includeGuiJobs && cmd.includes('fast-run.mjs')),
    );
}

/**
 * Window titles of the running app processes, `''` for a windowless one.
 *
 * The app runs as TWO `volt-pos.exe` processes: the window owner and an ~11 MB
 * helper with no window. When the window is closed the helper can linger for a
 * while on its own — a leftover that no person is using, unlike a titled
 * window (minimised or not, it keeps its title). `tasklist /V` is slow
 * machine-wide, so it is filtered per image (~1s).
 */
export function appWindowTitles(): string[] {
  const titles: string[] = [];
  for (const image of APP_IMAGE_NAMES) {
    let out = '';
    try {
      out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/V', '/FO', 'CSV', '/NH'], {
        encoding: 'utf8',
        windowsHide: true,
      });
    } catch {
      continue;
    }
    for (const row of out.split(/\r?\n/)) {
      const cells = row.split('","').map((cell) => cell.replace(/^"|"$/g, ''));
      if (cells[0]?.toLowerCase() !== image.toLowerCase()) continue; // "INFO: No tasks…" and blanks
      const title = cells.at(-1) ?? '';
      titles.push(title === 'N/A' ? '' : title);
    }
  }
  return titles;
}

/**
 * Force-kill an image and its children.
 *
 * `/T` matters: tauri-driver spawns msedgedriver, which spawns the WebView2
 * host processes. Killing only the parent leaves an orphaned msedgedriver
 * holding port 4444, and the next spec file then fails with a connection error
 * that has nothing to do with the test.
 */
export function killImage(image: string): boolean {
  const result = spawnSync('taskkill', ['/F', '/T', '/IM', image], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const killed = result.status === 0;
  if (killed) log.debug(`killed ${image}`);
  return killed;
}

/**
 * Clear anything left over from a previous run.
 *
 * ALWAYS call this before starting a session. The app registers
 * `tauri-plugin-single-instance`, so a stale window does not merely waste
 * memory — it swallows the new launch entirely and focuses the OLD window,
 * and the suite then drives a process the driver has no session with.
 */
export function killStaleProcesses({
  app = true,
  drivers = true,
}: { app?: boolean; drivers?: boolean } = {}): string[] {
  const targets = [...(app ? APP_IMAGE_NAMES : []), ...(drivers ? DRIVER_IMAGE_NAMES : [])];
  const running = runningImages(targets);
  for (const image of running) killImage(image);
  return running;
}

/**
 * Block until none of `images` is running, and report whatever survived.
 *
 * `taskkill /F /T` returns as soon as the request is queued, not once the
 * kernel has torn the tree down — and a WebView2 host routinely outlives its
 * parent by a beat. Anything that must observe the machine as CLEAN (a database
 * reset refuses to run while the app still holds its SQLCipher handles) has to
 * verify rather than trust the exit code.
 *
 * Synchronous on purpose: the caller is `beforeSession`, which WebdriverIO runs
 * before the session exists, and every other process helper here is sync too.
 * `Atomics.wait` is the only way to block a Node main thread without a busy
 * loop that would starve the very processes being waited on.
 */
export function waitForImagesGone(images: readonly string[], timeoutMs = 5_000): string[] {
  const deadline = Date.now() + timeoutMs;
  let survivors = runningImages(images);

  while (survivors.length > 0 && Date.now() < deadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    survivors = runningImages(images);
  }

  return survivors;
}

/** Launch an app detached, with extra environment applied to it. */
export function launchDetached(exe: string, args: string[], extraEnv: NodeJS.ProcessEnv): number {
  const child = spawn(exe, args, {
    cwd: path.dirname(exe),
    env: { ...process.env, ...extraEnv },
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  return child.pid ?? -1;
}
