import { browser } from '@wdio/globals';
import { pathOf, Routes } from '../constants/routes.js';
import { moduleLogger } from '../utils/logger.js';
import { retry } from './wait.js';

const log = moduleLogger('window');

/**
 * Window titles, transcribed from `src-tauri/tauri.conf.json` → `app.windows[]`.
 *
 * The app declares BOTH windows up front: `main` (fullscreen, `/splashscreen`)
 * and `customer` (`/customer/`, positioned at x:2560 for the second monitor).
 * Neither is opened later by application code, so a missing handle always means
 * something went wrong at launch — never that a spec forgot to open it.
 */
export const MAIN_WINDOW_TITLE = 'VOLT POS';
export const CUSTOMER_WINDOW_TITLE = 'VOLT POS - Customer Display';

export interface WindowInfo {
  handle: string;
  title: string;
  url: string;
}

type WindowRole = 'main' | 'customer';

const ROLE_TITLE: Record<WindowRole, string> = {
  main: MAIN_WINDOW_TITLE,
  customer: CUSTOMER_WINDOW_TITLE,
};

const normalize = (title: string): string => title.replace(/\s+/g, ' ').trim().toLowerCase();

const isCustomerPath = (url: string): boolean => pathOf(url).startsWith(Routes.CUSTOMER);

/**
 * How strongly a window matches a role. Higher wins; `0` means "not this one".
 *
 * Title is weighted above path because a window that is still booting reports
 * its configured title long before the router has settled on a path — the main
 * window sits on `/splashscreen` for up to `Timeouts.APP_BOOT` while migrations
 * and the first sync run.
 *
 * The main-window branch additionally REQUIRES a non-customer path, and that is
 * not belt-and-braces: WebDriver's Get Title returns `document.title`, and the
 * app ships a single `index.html` whose title is `Volt POS` for both windows.
 * Whether the native titles from `tauri.conf.json` reach the webview depends on
 * the WebView2 host, so both windows can legitimately report the same string.
 * The path is the only thing that always separates them, and only the customer
 * window ever sits under `/customer`.
 */
function score(role: WindowRole, info: WindowInfo): number {
  const titleMatches = normalize(info.title) === normalize(ROLE_TITLE[role]);
  const onCustomer = isCustomerPath(info.url);

  if (role === 'customer') {
    if (titleMatches) return 2;
    return onCustomer ? 1 : 0;
  }

  if (onCustomer) return 0;
  return titleMatches ? 2 : 1;
}

/** The handle the session is on right now, or `null` if that window is gone. */
async function currentHandle(): Promise<string | null> {
  try {
    return await browser.getWindowHandle();
  } catch {
    return null;
  }
}

/**
 * Every open window with its title and URL.
 *
 * Reading a title or URL requires being switched to that window, so this walks
 * the whole set and switches back to where it started. Callers get a snapshot
 * without having to care that taking it moved the session around.
 */
export async function listWindows(): Promise<WindowInfo[]> {
  const origin = await currentHandle();
  const handles = await browser.getWindowHandles();
  const found: WindowInfo[] = [];

  for (const handle of handles) {
    try {
      await browser.switchToWindow(handle);
      found.push({ handle, title: await browser.getTitle(), url: await browser.getUrl() });
    } catch (error) {
      // A window can close between `getWindowHandles()` and the switch — the
      // customer display does exactly that during an update install. Reporting
      // the windows that ARE readable beats failing the whole enumeration.
      log.debug(`Skipping window ${handle}: ${(error as Error).message}`);
    }
  }

  if (origin && handles.includes(origin)) await browser.switchToWindow(origin);
  return found;
}

function missingWindowError(role: WindowRole, found: WindowInfo[]): Error {
  const inventory = found.length
    ? found.map((w) => `  - handle=${w.handle} title="${w.title}" url=${w.url}`).join('\n')
    : '  (none — the session has no open window)';

  return new Error(
    `No ${role} window is open. Expected title "${ROLE_TITLE[role]}"` +
      (role === 'customer'
        ? ` or a path under "${Routes.CUSTOMER}"`
        : ` on a path outside "${Routes.CUSTOMER}"`) +
      `.\nWindows found (${found.length}):\n${inventory}\n` +
      `Both windows are declared in src-tauri/tauri.conf.json and open at launch, so a missing one ` +
      `means the app under test is not the build this suite expects, the window was closed by an ` +
      `earlier spec, or tauri-plugin-single-instance handed the session to a stale process.`,
  );
}

async function switchTo(role: WindowRole): Promise<WindowInfo> {
  // Retried because the second window's handle can surface a beat after the
  // first one during a cold boot — that is a driver-level race, not a bug in
  // the app, and it resolves on its own within a few hundred milliseconds.
  return retry(
    async () => {
      const found = await listWindows();
      const best = found
        .map((info) => ({ info, rank: score(role, info) }))
        .filter((candidate) => candidate.rank > 0)
        .sort((a, b) => b.rank - a.rank)[0];

      if (!best) throw missingWindowError(role, found);

      await browser.switchToWindow(best.info.handle);
      log.debug(`switched to ${role} window (title="${best.info.title}", url=${best.info.url})`);
      return best.info;
    },
    { attempts: 3, label: `switch to the ${role} window` },
  );
}

/** Focus the staff window. Safe to call when already there. */
export async function switchToMain(): Promise<void> {
  await switchTo('main');
}

/** Focus the customer-facing display window. Safe to call when already there. */
export async function switchToCustomer(): Promise<void> {
  await switchTo('customer');
}

/**
 * Run `fn` against the customer display, then return to where the caller was.
 *
 * The restore lives in `finally` so a failed assertion on the customer window
 * cannot strand the rest of the spec there — every later step would then look
 * for staff controls in a window that does not have any, and the reported
 * failure would name the wrong screen entirely.
 *
 * A failure of the restore itself is logged rather than thrown: throwing from
 * `finally` would replace `fn`'s error with a window-management one and destroy
 * the actual diagnosis.
 */
export async function withCustomerWindow<T>(fn: () => Promise<T>): Promise<T> {
  const origin = await currentHandle();
  await switchToCustomer();

  try {
    return await fn();
  } finally {
    try {
      const handles = await browser.getWindowHandles();
      if (origin && handles.includes(origin)) {
        await browser.switchToWindow(origin);
      } else {
        await switchToMain();
      }
    } catch (error) {
      log.warn(`Could not return from the customer window: ${(error as Error).message}`);
    }
  }
}
