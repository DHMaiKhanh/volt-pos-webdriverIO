import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from '../../configs/env/loadEnv.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('instance');

/**
 * `''` for the installed app, `-i<N>` for parallel test instance N — appended to
 * every per-run scratch file an instance owns (the warm marker, the "fresh"
 * flag), so two lanes never read each other's state.
 */
export function instanceSuffix(): string {
  const { INSTANCE } = loadEnv();
  return INSTANCE > 0 ? `-i${String(INSTANCE)}` : '';
}

/**
 * Put APP_WINDOW_SEED in place of the app's saved window placement before it starts.
 *
 * The app opens both windows FULLSCREEN (tauri.conf.json) and then lets
 * tauri-plugin-window-state restore whatever it saved last. A parallel copy is
 * seeded with a non-fullscreen 1920×1080 window parked off the right edge of the
 * screen: it never covers the primary app or the person's own work, and with the
 * anti-throttling browser arguments it keeps rendering while out of sight.
 * Re-seeded on every launch because the plugin writes the live placement back
 * on exit. No-op unless the instance asks for it.
 */
export function seedWindowState(): void {
  const env = loadEnv();
  if (!env.APP_WINDOW_SEED || !process.env.APPDATA) return;
  const dir = path.join(process.env.APPDATA, env.APP_IDENTIFIER);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(env.APP_WINDOW_SEED, path.join(dir, '.window-state.json'));
  } catch (error) {
    log.warn(`could not seed the window placement in ${dir}: ${(error as Error).message}`);
  }
}
