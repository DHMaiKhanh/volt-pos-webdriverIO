import { browser } from '@wdio/globals';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('appVersion');

/**
 * The installed POS build's version (e.g. `1.1.88`), or `''` when it cannot be read.
 *
 * Read through Tauri's core `plugin:app|version` command over
 * `window.__TAURI_INTERNALS__.invoke` — the same IPC bridge `src/api/transport.ts`
 * uses for GraphQL — so no sidebar has to be opened. Cached: a session never
 * changes build without a relaunch.
 */
let cached: string | null = null;

export async function appVersion(): Promise<string> {
  if (cached !== null) return cached;
  const version = await browser
    .executeAsync(function (done: (value: string) => void) {
      const internals = (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] as
        { invoke?: (cmd: string, args?: unknown) => Promise<unknown> } | undefined;
      if (!internals || typeof internals.invoke !== 'function') {
        done('');
        return;
      }
      internals
        .invoke('plugin:app|version')
        .then(function (value: unknown) {
          done(typeof value === 'string' ? value : '');
        })
        .catch(function () {
          done('');
        });
    })
    .catch(() => '');
  cached = version;
  log.info(`installed POS build: ${version || '(unknown)'}`);
  return version;
}

/** `a >= b` for dotted numeric versions (`1.1.88` vs `1.1.9` compares 88 > 9). */
export function versionAtLeast(actual: string, minimum: string): boolean {
  const a = actual.split('.').map((part) => Number(part));
  const b = minimum.split('.').map((part) => Number(part));
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (Number.isNaN(x) || Number.isNaN(y)) return false;
    if (x !== y) return x > y;
  }
  return true;
}

/**
 * Skip the current test when the installed build predates `minimum` — the fix
 * under test is simply not there, which is a precondition, not a failure. An
 * unreadable version does NOT skip: the assertions decide.
 */
export async function skipUnlessBuild(ctx: Mocha.Context, minimum: string, ticket: string): Promise<void> {
  const version = await appVersion();
  if (version !== '' && !versionAtLeast(version, minimum)) {
    // eslint-disable-next-line no-console
    console.log(
      `[${ticket}] SKIP "${ctx.currentTest?.title ?? ctx.test?.title ?? ''}": POS ${version} < ${minimum} (fix not in build)`,
    );
    ctx.skip();
  }
}
