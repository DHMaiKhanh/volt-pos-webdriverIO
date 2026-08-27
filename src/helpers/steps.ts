import { browser } from '@wdio/globals';
import allure from '@wdio/allure-reporter';
import { loadEnv } from '../../configs/env/loadEnv.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('steps');

/**
 * Id of the overlay node inside the app document.
 *
 * Prefixed `volt-e2e-` so that anyone inspecting the DOM of a paused run — or
 * reading a failure screenshot — can tell instantly that the bar is the test
 * harness talking and not a real piece of the product.
 */
const OVERLAY_ID = 'volt-e2e-step-overlay';

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Create-or-update the overlay, inside the page.
 *
 * Passed to `browser.execute`, so it must be entirely self-contained: the
 * function is stringified and evaluated in the WebView2 context, where nothing
 * from this module's scope exists.
 *
 * `pointerEvents: none` is the one property that is not cosmetic. The bar sits
 * at the top centre with the highest possible z-index, directly over the app's
 * header; without it the overlay would swallow clicks aimed at real controls
 * and every spec would fail in a way that looks like a broken selector.
 */
function paintOverlay(id: string, text: string): void {
  let el = document.getElementById(id);

  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.setAttribute('data-volt-e2e', 'step-overlay');
    Object.assign(el.style, {
      position: 'fixed',
      top: '8px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      pointerEvents: 'none',
      userSelect: 'none',
      maxWidth: '70vw',
      padding: '6px 14px',
      borderRadius: '6px',
      background: 'rgba(17, 17, 17, 0.88)',
      color: '#ffffff',
      font: '500 13px/1.4 system-ui, sans-serif',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    document.body.appendChild(el);
  }

  el.textContent = text;
}

async function tryPaint(text: string): Promise<void> {
  if (!loadEnv().SHOW_STEPS) return;
  try {
    await browser.execute(paintOverlay, OVERLAY_ID, text);
  } catch (error) {
    // The overlay is an operator convenience. Losing it — because the document
    // is mid-navigation, or the session is on a window that just closed — must
    // never be the thing that fails a test.
    log.debug(`Step overlay not painted: ${reason(error)}`);
  }
}

/**
 * Put the step bar into the app document.
 *
 * Idempotent by construction: the injected function looks the node up by id and
 * only creates it when it is absent, so calling this again after a route change
 * is free.
 *
 * The bar is appended to `document.body`, a SIBLING of the `#root` that React
 * renders into, so TanStack Router swapping the whole screen leaves it alone.
 * What DOES destroy it is a full document load — the Tauri window navigating,
 * or the app restarting after an update — which is why {@link logStep} re-runs
 * this on every call instead of trusting a one-time install.
 *
 * Only ever paints in the window the session is currently switched to; after
 * `switchToCustomer()` the next step appears on the customer display.
 */
export async function installStepOverlay(): Promise<void> {
  await tryPaint('E2E ready');
}

/**
 * Announce a step to all three audiences at once.
 *
 * The winston line is what survives in CI, the overlay is what a human watching
 * the tablet sees, and the Allure step is what makes a failed run readable
 * afterwards. They are deliberately driven from one call so a step can never be
 * present in the report but missing from the log.
 */
export async function logStep(text: string): Promise<void> {
  log.info(text);
  await tryPaint(text);

  try {
    await allure.addStep(text);
  } catch (error) {
    // `addStep` needs an active reporter context. Calling it from a worker-level
    // hook (or from `onPrepare`) throws, and that is not worth a red test.
    log.debug(`Allure step not recorded: ${reason(error)}`);
  }
}

/**
 * Wrap an async block as a named step.
 *
 * On failure the original error is re-thrown wrapped, with the step name in the
 * message and the cause preserved — a WebdriverIO "element not found" is nearly
 * useless on its own, and the step name is what turns it into "which part of the
 * checkout flow broke".
 *
 * The failure path does NO driver round trips: by the time a step fails the app
 * may be gone, and an overlay repaint that hangs would replace a clean failure
 * with a Mocha timeout. Evidence capture belongs to
 * `AppLifecycleService.afterTest`, which already runs on exactly this event.
 */
export async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  await logStep(name);
  const startedAt = Date.now();

  try {
    const result = await fn();
    log.debug(`${name} — ok in ${Date.now() - startedAt}ms`);
    return result;
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    log.error(`${name} — FAILED after ${elapsed}ms: ${reason(error)}`);
    throw new Error(`Step "${name}" failed after ${elapsed}ms: ${reason(error)}`, { cause: error });
  }
}
