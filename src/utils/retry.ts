import { moduleLogger } from './logger.js';

const log = moduleLogger('retry');

export interface RetryOptions {
  /** Total attempts, INCLUDING the first. `2` means one retry. */
  attempts: number;
  /** Wait before the second attempt, in ms. */
  delayMs: number;
  /** Multiply the delay by this after each failure. `2` doubles it. */
  factor?: number;
  /**
   * Decide whether an error is worth another attempt.
   *
   * Defaults to retrying everything, which is almost never right — see the note
   * below. Pass a predicate that names the transient case.
   */
  retryOn?: (error: unknown, attempt: number) => boolean;
  /** What is being retried, for the log line. */
  label?: string;
}

/**
 * Run something again when it fails for a reason that passes.
 *
 * ## Retry only what is actually transient
 *
 * A blanket retry is a bug amplifier in a UI suite: a genuinely wrong selector
 * gets tried three times, the run takes three times as long to fail, and the
 * log reads like a flake instead of a defect. Worse, a retried action that
 * PARTLY succeeded — a tap that opened a dialog before the assertion failed —
 * runs again against a screen that has moved on.
 *
 * So this is for narrow, idempotent, genuinely-racy things: a driver call
 * during app boot, a sync-backed read that has not landed yet. Anything that
 * clicks belongs in a `waitUntil`, not here — waiting for the right state is
 * always better than repeating the wrong one.
 */
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const { attempts, delayMs, factor = 1, retryOn = () => true, label = 'operation' } = opts;
  if (attempts < 1) throw new Error(`retry(${label}): attempts must be at least 1.`);

  let delay = delayMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !retryOn(error, attempt)) break;

      const message = error instanceof Error ? error.message : String(error);
      log.warn(`${label}: attempt ${String(attempt)}/${String(attempts)} failed (${message})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.floor(delay * factor);
    }
  }

  throw lastError;
}

/**
 * Poll until a predicate returns a value, or give up.
 *
 * Distinct from {@link retry}: this expects the FIRST calls to legitimately
 * return nothing (the row has not synced yet, the dialog has not mounted), so
 * an empty answer is not an error and never logs a warning. Returns `null` on
 * timeout rather than throwing, because the caller usually has a better message
 * than this function could write.
 */
export async function pollFor<T>(
  produce: () => Promise<T | null | undefined>,
  opts: { timeoutMs: number; intervalMs?: number },
): Promise<T | null> {
  const interval = opts.intervalMs ?? 250;
  const deadline = Date.now() + opts.timeoutMs;

  for (;;) {
    const value = await produce();
    if (value !== null && value !== undefined) return value;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
