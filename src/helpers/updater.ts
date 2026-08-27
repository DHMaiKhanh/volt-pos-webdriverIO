import { browser } from '@wdio/globals';
import { byTestId, locator, type Locator } from './selectors.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('updater');

/**
 * ## Why this file has to exist
 *
 * The updater cannot be switched off for a test run. Its endpoint is baked into
 * `src-tauri/tauri.<env>.conf.json` and the check runs from Rust (reqwest), out
 * of the webview's reach — and the version comparator in `src-tauri` is
 * `|_current, _update| true`, i.e. EVERY response is treated as newer. So an
 * installed build under test reliably decides an update is available.
 *
 * `SoftwareUpdaterTrigger` (`src/components/software-updater/`) then raises a
 * sonner toast one second after mount. The Toaster is configured
 * `position="top-right"`, `offset={{ top: 86, right: 24 }}`, `duration: Infinity`
 * and `min-w-[520px]` — which parks a 520px-wide, never-expiring panel exactly
 * over the app header, where the settings, batch and profile controls live. It
 * is not a cosmetic nuisance; it makes real controls unclickable for the rest of
 * the session.
 *
 * The customer window is unaffected: `src/routes/customer/index.tsx` sets
 * `staticData.softwareUpdater.enabled === false`, so `__root.tsx` never mounts
 * the updater there. A sweep on that window is a cheap no-op, which is why the
 * watcher does not care which window the session is currently on.
 */

/** How often the watcher sweeps. See {@link startUpdaterWatcher} for the trade-off. */
const WATCH_INTERVAL_MS = 3_000;

/**
 * The toast the watcher is allowed to close.
 *
 * The primary testid is not aspirational guesswork: sonner 2.x renders
 * `data-testid={toast.testId}` onto the toast `<li>` (verified in
 * `node_modules/sonner/dist/index.mjs`), so `showSoftwareUpdaterToast` only has
 * to pass `testId: 'software-updater-toast'` for this candidate to start
 * matching — no change to the app's markup is needed.
 *
 * Until then the fallbacks are structural. `data-styled="false"` is set by
 * sonner for `toast.custom()` toasts only (`!Boolean(toast.jsx || …)`), which
 * separates the updater panel from every `toast.success`/`toast.error` the app
 * raises. Structural matches are ALWAYS corroborated by the heading text below,
 * so this can never swallow a toast a spec is asserting on.
 */
const UPDATER_TOAST: Locator = locator(
  'software updater toast',
  'software-updater-toast',
  '[data-sonner-toast][data-styled="false"]',
  '[data-sonner-toast]',
);

/**
 * A dialog-shaped "update available" prompt.
 *
 * The app uses a toast today, so this exists for the version that moves to a
 * dialog. The `alertdialog` role is what Radix's `AlertDialog` renders, which is
 * the primitive both existing updater dialogs are built on.
 */
const UPDATER_DIALOG: Locator = locator(
  'software updater dialog',
  'software-updater-dialog',
  '[role="alertdialog"]',
  '[role="dialog"]',
);

/**
 * Controls that close the prompt, in preference order, resolved WITHIN the
 * matched surface.
 *
 * `[data-close-button]` is sonner's own close button. It is deliberately first
 * even though the current updater toast never has one — sonner skips it for
 * custom/jsx toasts — because it is the correct control the moment the app
 * switches to a plain `toast.warning`.
 *
 * `svg.lucide-x` is the app's hand-rolled close button
 * (`software-updater-toast.tsx` renders lucide's `<X />`, which lucide-react
 * 0.562 emits with the class `lucide-x`).
 */
const DISMISS_CONTROL: Locator = locator(
  'software updater dismiss control',
  'software-updater-dismiss',
  '[data-close-button]',
  'button:has(svg.lucide-x)',
);

/**
 * `global.newUpdateAvailable`, in every language the app ships
 * (`src/locales/{en,vi}/common.json`).
 *
 * Matching chrome by text is normally forbidden here because the UI language is
 * merchant state. It is accepted for this one job: the alternative is a blanket
 * `[data-sonner-toast]` sweep that also closes the toasts specs assert on, and
 * the app ships exactly two locales, so the list is complete and reviewable.
 */
const UPDATE_AVAILABLE_MARKERS = ['A New Update is Available', 'Đã có bản cập nhật mới'];

/**
 * Surfaces this helper must NEVER close, matched the same way.
 *
 * `global.updateRequired` is the FORCED-update screen, shown when the updater
 * payload carries `deprecated: true` — i.e. the server has retired the build
 * under test. Dismissing it (if it even could be dismissed; it renders with
 * `open={true}` and `onEscapeKeyDown` prevented) would convert a genuine "you
 * are testing a dead build" finding into a run of confusing downstream
 * failures. `BasePage.waitForReady` already detects it and fails with that
 * explanation, and that is the behaviour we want to preserve.
 *
 * `global.softwareUpdating` is the install-progress dialog. Clicking anything
 * there interferes with a running install.
 */
const DO_NOT_TOUCH_MARKERS = [
  'Update Required',
  'Yêu cầu cập nhật',
  'Software Updating',
  'Đang cập nhật phần mềm',
];

/**
 * `actions.updateLater` — the app's own "not now" button.
 *
 * Last-resort control, and matched on the EXACT label rather than a substring
 * for one reason: `actions.updateNow` ("Update Now" / "Cập nhật ngay") sits
 * right beside it and starts a real download-and-restart. A substring match on
 * "Update"/"Cập nhật" would hit both.
 */
const DISMISS_LABELS = ['Update Later', 'Để sau'];

interface SweepConfig {
  toastDefinitive: string[];
  toastStructural: string[];
  dialogDefinitive: string[];
  dialogStructural: string[];
  dismissSelectors: string[];
  dismissLabels: string[];
  availableMarkers: string[];
  doNotTouchMarkers: string[];
}

interface SweepResult {
  /** Surfaces actually closed, by kind. */
  dismissed: string[];
  /** A forced-update or install-progress surface was on screen and left alone. */
  forced: boolean;
  /** Surfaces recognised but deliberately not closed, with the reason. */
  skipped: string[];
}

/**
 * Find and close the updater prompt, entirely inside the page.
 *
 * Handed to `browser.execute`, so it must be self-contained — it is stringified
 * and evaluated in the WebView2 context, where this module's scope is gone.
 *
 * Doing the whole match-and-click in one in-page pass, instead of a sequence of
 * WebDriver calls, is what makes the watcher safe to run alongside a spec: there
 * is no window between "found the toast" and "clicked it" in which sonner's
 * exit animation can invalidate the element, so it can never fail with a stale
 * element or a mid-flight "not interactable".
 */
function sweepUpdaterSurfaces(config: SweepConfig): SweepResult {
  const dismissed: string[] = [];
  const skipped: string[] = [];
  let forced = false;

  const norm = (value: string | null): string => (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

  const holdsMarker = (el: Element, markers: string[]): boolean => {
    const text = norm(el.textContent);
    return markers.some((marker) => text.includes(norm(marker)));
  };

  const visible = (el: Element): boolean => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const queryAll = (root: ParentNode, selector: string): HTMLElement[] => {
    try {
      return Array.from(root.querySelectorAll<HTMLElement>(selector));
    } catch {
      // An engine that does not implement a selector (`:has()`) throws a
      // SyntaxError. One unsupported candidate must not abort the whole sweep.
      return [];
    }
  };

  const dismissControl = (root: HTMLElement): HTMLElement | null => {
    for (const selector of config.dismissSelectors) {
      const hit = queryAll(root, selector).find(visible);
      if (hit) return hit;
    }
    const labelled = queryAll(root, 'button').find(
      (button) =>
        visible(button) && config.dismissLabels.some((label) => norm(button.textContent) === norm(label)),
    );
    return labelled ?? null;
  };

  const sweep = (kind: string, definitive: string[], structural: string[]): void => {
    const seen = new Set<HTMLElement>();

    const consider = (el: HTMLElement, corroborate: boolean): void => {
      if (seen.has(el) || !visible(el)) return;
      seen.add(el);

      if (holdsMarker(el, config.doNotTouchMarkers)) {
        forced = true;
        skipped.push(`${kind}: forced-update / install-progress surface, left alone`);
        return;
      }

      // A declared testid is the app saying "this is the updater prompt". A
      // structural match is only a guess, so it has to be backed by the
      // updater's own heading before anything gets clicked.
      if (corroborate && !holdsMarker(el, config.availableMarkers)) return;

      const control = dismissControl(el);
      if (!control) {
        skipped.push(`${kind}: no dismiss control found`);
        return;
      }

      control.click();
      dismissed.push(kind);
    };

    for (const selector of definitive) {
      for (const el of queryAll(document, selector)) consider(el, false);
    }
    for (const selector of structural) {
      for (const el of queryAll(document, selector)) consider(el, true);
    }
  };

  sweep('toast', config.toastDefinitive, config.toastStructural);
  sweep('dialog', config.dialogDefinitive, config.dialogStructural);

  return { dismissed, forced, skipped };
}

const SWEEP_CONFIG: SweepConfig = {
  toastDefinitive: [byTestId(UPDATER_TOAST.testId)],
  toastStructural: [...UPDATER_TOAST.fallbacks],
  dialogDefinitive: [byTestId(UPDATER_DIALOG.testId)],
  dialogStructural: [...UPDATER_DIALOG.fallbacks],
  dismissSelectors: [byTestId(DISMISS_CONTROL.testId), ...DISMISS_CONTROL.fallbacks],
  dismissLabels: DISMISS_LABELS,
  availableMarkers: UPDATE_AVAILABLE_MARKERS,
  doNotTouchMarkers: DO_NOT_TOUCH_MARKERS,
};

let watchTimer: NodeJS.Timeout | null = null;
let watching = false;
let sweepInFlight = false;

/**
 * Close the updater prompt if it is on screen. Resolves to whether it closed.
 *
 * Never throws for "there was nothing to close" — the prompt is optional by
 * nature (it depends on what the updater endpoint answered), so absence is the
 * normal case, not a failure.
 */
export async function dismissUpdaterIfPresent(): Promise<boolean> {
  const result = await browser.execute(sweepUpdaterSurfaces, SWEEP_CONFIG);

  if (result.forced) {
    log.warn(
      'A forced-update / install-progress screen is on display and was deliberately NOT dismissed. ' +
        'The updater endpoint returned `deprecated: true` for this build, which means the server has ' +
        'retired the binary under test — install the version the environment expects.',
    );
  }

  for (const note of result.skipped) log.debug(note);

  if (result.dismissed.length === 0) return false;

  log.info(`Dismissed the software updater prompt (${result.dismissed.join(', ')}).`);
  return true;
}

async function tick(): Promise<void> {
  // `watching` is re-checked here, not only at schedule time, so a tick queued
  // just before `stopUpdaterWatcher()` does nothing when it finally runs.
  if (!watching || sweepInFlight) return;

  sweepInFlight = true;
  try {
    await dismissUpdaterIfPresent();
  } catch (error) {
    // Everything is swallowed, by design. The watcher shares one WebDriver
    // session with the spec, so a sweep can land while a command is in flight
    // or while the session is switching windows. Those are transport hiccups in
    // a background convenience, and turning them into test failures would make
    // the suite flakier than the toast ever did.
    log.debug(`Updater sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    sweepInFlight = false;
  }
}

/**
 * Start sweeping for the updater prompt in the background.
 *
 * Polling rather than reacting because there is nothing to react to: the toast
 * is raised by a `setTimeout` inside the app after an IPC round trip, with no
 * event the driver can subscribe to.
 *
 * `WATCH_INTERVAL_MS` is the trade-off between two costs. Too short and the
 * watcher competes with the spec for the single WebDriver session on every
 * command; too long and the toast is still up when the next click fires. Three
 * seconds keeps the session mostly idle while closing the prompt well inside
 * the first navigation of a test.
 *
 * Idempotent — calling it twice does not create a second interval.
 */
export function startUpdaterWatcher(): void {
  if (watchTimer) return;

  watching = true;
  watchTimer = setInterval(() => void tick(), WATCH_INTERVAL_MS);
  // An interval alone would keep the worker process alive after the session
  // ends if anything ever forgot to stop it, turning a finished run into a hang.
  watchTimer.unref();

  log.debug(`Updater watcher started (every ${WATCH_INTERVAL_MS}ms).`);
}

/**
 * Stop sweeping. Idempotent, and safe to call from a teardown hook that may run
 * twice.
 *
 * A sweep already awaiting a driver round trip cannot be cancelled and will
 * finish; what is guaranteed is that no NEW sweep starts after this returns.
 */
export function stopUpdaterWatcher(): void {
  watching = false;
  if (!watchTimer) return;

  clearInterval(watchTimer);
  watchTimer = null;
  log.debug('Updater watcher stopped.');
}
