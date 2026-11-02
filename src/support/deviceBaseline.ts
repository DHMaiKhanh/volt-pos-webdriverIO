import { browser } from '@wdio/globals';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('deviceBaseline');

/**
 * Device settings every spec assumes, as the app stores them: tauri-plugin-store
 * `settings.json` (volt-pos `shared/tauri-store`), keyed as in
 * `tauri-store.constants.ts`.
 *
 * - `virtual_keyboard_show: false` — with it on, Home swaps the "Enter Customer
 *   Phone, Name or Email" input for an on-screen keypad. On 2026-10-31 it was left
 *   on by a keyboard spec and ~220 of a full run's 423 failures followed, every
 *   one "Quick Checkout never produced an empty order frame".
 * - `language: 'en'` — most label lookups are English-first.
 */
const BASELINE = { virtual_keyboard_show: false, language: 'en' } as const;

/**
 * Put the device store back to {@link BASELINE}; returns the keys it changed.
 *
 * A device setting outlives the spec that flips it — across files, workers and
 * app relaunches — so one spec that does not restore it (or fails before its
 * `finally`) quietly breaks every later file. Run between spec files: the reload
 * that follows remounts the screens, which read the store on mount. Goes through
 * the app's own store IPC, so it costs milliseconds, not a trip to Settings.
 */
export async function restoreDeviceBaseline(): Promise<string[]> {
  try {
    const changed = await browser.execute(async (baseline: Record<string, unknown>) => {
      const invoke = (
        window as unknown as {
          __TAURI_INTERNALS__: { invoke: (cmd: string, args: object) => Promise<unknown> };
        }
      ).__TAURI_INTERNALS__.invoke;
      const rid = await invoke('plugin:store|load', { path: 'settings.json' });
      const keys: string[] = [];
      for (const [key, value] of Object.entries(baseline)) {
        const [current] = (await invoke('plugin:store|get', { rid, key })) as [unknown, boolean];
        if (current === value) continue;
        await invoke('plugin:store|set', { rid, key, value });
        keys.push(key);
      }
      if (keys.length) await invoke('plugin:store|save', { rid });
      return keys;
    }, BASELINE);
    if (changed.length) log.warn(`Device settings restored to the suite baseline: ${changed.join(', ')}`);
    return changed;
  } catch (error) {
    log.warn(
      `Could not check the device settings baseline: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}
