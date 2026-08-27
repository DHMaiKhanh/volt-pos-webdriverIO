import { execFileSync, spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('process');

/** Image names that belong to a Volt POS run and must not survive it. */
export const APP_IMAGE_NAMES = ['volt-pos-app.exe', 'volt-pos.exe', 'VoltPOS.exe'] as const;
export const DRIVER_IMAGE_NAMES = ['tauri-driver.exe', 'msedgedriver.exe'] as const;

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
