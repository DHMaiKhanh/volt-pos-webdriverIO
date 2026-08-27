import { browser } from '@wdio/globals';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { pathOf } from '../constants/routes.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('wait');

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export interface WaitUntilPathOptions {
  timeout?: number;
  /** Prefix for the failure message — say what was expected, not what happened. */
  message?: string;
}

/**
 * Block until the router's PATH satisfies `predicate`, then return that path.
 *
 * Always compares the path, never the full URL: a packaged build serves the UI
 * from the custom protocol (`http://tauri.localhost`) while `tauri dev` serves
 * it from `http://localhost:1420`, so any assertion touching the origin passes
 * in one lane and fails in the other for no real reason.
 */
export async function waitUntilPath(
  predicate: (path: string) => boolean,
  opts: WaitUntilPathOptions = {},
): Promise<string> {
  const timeout = opts.timeout ?? Timeouts.NAVIGATION;
  let seen = '';

  try {
    await browser.waitUntil(
      async () => {
        seen = pathOf(await browser.getUrl());
        return predicate(seen);
      },
      { timeout, interval: 200 },
    );
  } catch {
    // WebdriverIO's own `timeoutMsg` is a plain string built BEFORE the wait
    // starts, so it can only ever report the path as it was on entry. Raising
    // the error here is what lets the message name the LAST path observed,
    // which is the whole diagnosis when a route redirects somewhere unexpected.
    throw new Error(
      `${opts.message ?? 'Router never reached the expected path'} ` +
        `— gave up after ${timeout}ms, last path seen was "${seen}".`,
    );
  }

  return seen;
}

export interface RetryOptions {
  /** Total tries, not extra tries. `1` disables retrying. */
  attempts?: number;
  delayMs?: number;
  /** Name used in the log line and the final error. */
  label?: string;
}

/**
 * Re-run `fn` a few times before giving up.
 *
 * Reserved for operations that are non-deterministic at the DRIVER level — a
 * window handle that appears a beat after the second window opens, a WebView2
 * host that drops one command while it repaints. Never wrap an assertion in
 * this: a flaky assertion is a real finding, and retrying it hides the bug the
 * suite exists to catch.
 */
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const delayMs = opts.delayMs ?? Timeouts.ANIMATION;
  const label = opts.label ?? 'operation';
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      log.debug(
        `${label}: attempt ${attempt}/${attempts} failed (${reason(error)}) — retrying in ${delayMs}ms`,
      );
      await browser.pause(delayMs);
    }
  }

  throw new Error(`${label} failed after ${attempts} attempt(s). Last error: ${reason(lastError)}`, {
    cause: lastError,
  });
}

/**
 * The suite's ONE sanctioned blind pause.
 *
 * Everything else waits on observable state. This exists for the single case
 * where there is no state to observe: a Radix overlay's exit transition keeps
 * the node mounted and hit-testable for the length of a CSS animation after the
 * close handler has already run, so the next click lands on a dying dialog.
 * Centralising it means `grep -rn 'browser.pause'` over `src/pages` and `tests`
 * stays empty and every deliberate pause is visible as `settle()` in review.
 */
export async function settle(ms: number = Timeouts.ANIMATION): Promise<void> {
  await browser.pause(ms);
}
