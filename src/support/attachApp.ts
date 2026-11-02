import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Paths } from '../../configs/constants/paths.js';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { loadEnv } from '../../configs/env/loadEnv.js';
import { moduleLogger } from '../utils/logger.js';
import { instanceSuffix, seedWindowState } from './instance.js';
import { isPortOpen, waitForPortFree, waitForPortOpen } from './net.js';
import { killStaleProcesses, launchDetached } from './process.js';
import { appEnvPassthrough, resolveMsEdgeDriver } from './services/TauriDriverService.js';

const log = moduleLogger('attachApp');

export interface CdpTarget {
  type?: string;
  url?: string;
  title?: string;
}

/**
 * Stuck screens the rootHooks recovery (`returnToHome`) cannot escape — an app
 * sitting on one would only cascade into the next file: a half-finished
 * `/order/…/checkout`, a `/split-order` with no nav bar, the `/force-update`
 * route, or a bare `about:blank`. Everything else ON tauri.localhost — /home,
 * /login, /splashscreen, an order or pending/history list — is a screen the next
 * file's `ensureLoggedIn` + `returnToHome` can recover from, so it counts as
 * drivable. (A freshly launched app sits on splash/login until a spec drives it
 * to /home, so requiring /home here would relaunch a perfectly good app.)
 */
const STUCK_PATH = /\/checkout$|\/split-order$|\/force-update/;

/**
 * The customer display is a second page target on the same host. It says nothing
 * about the STAFF window the specs drive — counting it let a main window wedged on
 * /checkout read as healthy whenever the customer window sat on /customer/.
 */
const CUSTOMER_PATH = /^\/customer(\/|$)/;

export function isDrivableTarget(target: CdpTarget): boolean {
  if (target.type !== 'page') return false;
  try {
    const url = new URL(target.url ?? '');
    return (
      url.hostname === 'tauri.localhost' &&
      !STUCK_PATH.test(url.pathname) &&
      !CUSTOMER_PATH.test(url.pathname)
    );
  } catch {
    return false; // about:blank, devtools://, an empty url — not drivable
  }
}

/**
 * Is a drivable Volt POS webview answering on the CDP port right now?
 *
 * More than "the port is open": after a crash or a force-update the socket can
 * linger with only an `about:blank` / `/force-update` target, and a wedged spec
 * can leave the app stuck mid-checkout — both read as "up" on a plain port probe
 * but neither is drivable by the next file. Require a `page` target on a ready
 * route ({@link isReadyUrl}). Polled a few times so a brief mid-navigation blip
 * does not trigger a needless relaunch.
 */
export async function isAttachedAppHealthy(tries = 3): Promise<boolean> {
  const env = loadEnv();
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await isPortOpen(env.DRIVER_HOST, env.REMOTE_DEBUG_PORT)) {
      try {
        const res = await fetch(`http://${env.DRIVER_HOST}:${String(env.REMOTE_DEBUG_PORT)}/json/list`);
        const targets = (await res.json()) as CdpTarget[];
        if (targets.some(isDrivableTarget)) return true;
      } catch {
        /* CDP not answering yet — fall through to the retry */
      }
    }
    if (attempt < tries - 1) await delay(1_000);
  }
  return false;
}

/**
 * Launch the installed app (WebView2 remote debugging on) and `msedgedriver` for
 * attach mode — the same wiring as `scripts/launch-app.ts`, callable mid-run so a
 * wedged app can be replaced with a fresh one.
 */
export async function launchAttachedApp(): Promise<void> {
  const env = loadEnv();
  if (!env.APP_PATH)
    throw new Error('attach relaunch: APP_PATH is unresolved (set it in configs/env/.env.<ENV>).');

  const msEdgeDriver = resolveMsEdgeDriver(env.MSEDGEDRIVER_PATH);
  if (!msEdgeDriver) throw new Error('attach relaunch: msedgedriver not found. Fix: npm run setup:drivers');

  // single-instance would hand a new launch to the old window, so clear both first.
  killStaleProcesses({ app: true, drivers: true });
  await waitForPortFree(env.DRIVER_HOST, env.REMOTE_DEBUG_PORT, Timeouts.SHORT).catch(() => undefined);
  await waitForPortFree(env.DRIVER_HOST, env.DRIVER_PORT, Timeouts.SHORT).catch(() => undefined);

  const browserArgs =
    `--remote-debugging-port=${String(env.REMOTE_DEBUG_PORT)} ${env.APP_BROWSER_ARGS}`.trim();
  seedWindowState();
  const appPid = launchDetached(env.APP_PATH, env.APP_ARGS, {
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: browserArgs,
    ...appEnvPassthrough(),
  });
  log.warn(
    `attach relaunch: launched ${env.APP_PATH} (pid ${String(appPid)}); waiting for CDP ${String(env.REMOTE_DEBUG_PORT)}`,
  );
  await waitForPortOpen(env.DRIVER_HOST, env.REMOTE_DEBUG_PORT, Timeouts.APP_BOOT);

  const driverPid = launchDetached(msEdgeDriver, [`--port=${String(env.DRIVER_PORT)}`], {});
  await waitForPortOpen(env.DRIVER_HOST, env.DRIVER_PORT, Timeouts.DRIVER_READY);
  log.warn(`attach relaunch: msedgedriver up (pid ${String(driverPid)}) on ${String(env.DRIVER_PORT)}`);

  // The CDP socket binds before the splash paints its first route; wait for the
  // webview to show a drivable target so the next file attaches to a live app.
  const booted = await isAttachedAppHealthy(Math.ceil(Timeouts.APP_BOOT / 1_000));
  if (!booted)
    log.warn(
      'attach relaunch: app came up but never showed a drivable screen — the next file may still need to recover.',
    );
}

/**
 * Make sure a healthy, attachable app is up before a spec file's session.
 *
 * Returns whether it had to (re)launch. A no-op when the app the operator (or the
 * previous file) left on /home is still healthy — the common case, which keeps the
 * open-once speed. A relaunch happens only when the previous file wedged or crashed
 * the app, which is what stops the no-self-heal cascade. Also covers the FIRST file
 * when nobody ran `app:launch`, so the attach lane can start the app itself.
 */
export async function ensureHealthyAttachedApp(): Promise<boolean> {
  let relaunched = false;
  if (!(await isAttachedAppHealthy())) {
    log.warn('attach: no healthy app on /home — (re)launching a fresh one for this spec file.');
    await launchAttachedApp();
    relaunched = true;
  } else {
    await ensureAttachDriver();
    // GUI attach phases (fast-run.mjs sets ATTACH_RESET=1): give this worker the
    // clean webview a launch would — unless the pre-warm left an app nobody has
    // driven yet, which is the one case where a reload buys nothing.
    if (process.env.ATTACH_RESET === '1' && !consumeWarmFreshFlag()) await reloadAttachedApp();
  }
  if (relaunched) consumeWarmFreshFlag(); // a new app is fresh by definition — drop a stale flag
  await primeCustomerWindow().catch((error: unknown) =>
    log.warn(`attach: could not prime the customer window: ${(error as Error).message}`),
  );
  return relaunched;
}

/**
 * Start `msedgedriver` if the app is healthy but nothing listens on DRIVER_PORT.
 *
 * The app and its driver die separately: `app:kill --drivers-only`, a run that
 * swept the drivers, or a crashed driver leaves a perfectly good app that no
 * session can reach. Relaunching the app for that would throw away the booted
 * webview — starting the driver alone is enough. Returns whether it started one.
 */
export async function ensureAttachDriver(): Promise<boolean> {
  const env = loadEnv();
  if (await isPortOpen(env.DRIVER_HOST, env.DRIVER_PORT)) return false;
  const msEdgeDriver = resolveMsEdgeDriver(env.MSEDGEDRIVER_PATH);
  if (!msEdgeDriver) throw new Error('attach: msedgedriver not found. Fix: npm run setup:drivers');
  const driverPid = launchDetached(msEdgeDriver, [`--port=${String(env.DRIVER_PORT)}`], {});
  await waitForPortOpen(env.DRIVER_HOST, env.DRIVER_PORT, Timeouts.DRIVER_READY);
  log.warn(`attach: app was up without a driver — started msedgedriver (pid ${String(driverPid)})`);
  return true;
}

/**
 * Wait until the staff window is past `/splashscreen`, and return its URL (`null`
 * on timeout).
 *
 * {@link isAttachedAppHealthy} counts the splash as drivable, which is right for
 * the self-heal (the next file's `ensureLoggedIn` waits it out). A pre-warm wants
 * more than that: an app that has already finished booting, so the first spec
 * file pays nothing for the migrations and the opening sync.
 */
export async function waitForBootedApp(timeoutMs: number = Timeouts.APP_BOOT): Promise<string | null> {
  const env = loadEnv();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${env.DRIVER_HOST}:${String(env.REMOTE_DEBUG_PORT)}/json/list`);
      const staff = ((await res.json()) as CdpTarget[]).find(isDrivableTarget);
      if (staff?.url && !new URL(staff.url).pathname.startsWith('/splashscreen')) return staff.url;
    } catch {
      /* CDP not answering yet */
    }
    await delay(500);
  }
  return null;
}

/**
 * Left by the GUI pre-warm (scripts/warm-app.ts) beside an app that has booted
 * or been reloaded and that no spec has driven since. One per instance.
 */
export const WARM_FRESH_FLAG = path.join(Paths.ROOT, '.tmp', `gui-warm-fresh${instanceSuffix()}`);

export function markWarmFresh(): void {
  fs.mkdirSync(path.dirname(WARM_FRESH_FLAG), { recursive: true });
  fs.writeFileSync(WARM_FRESH_FLAG, new Date().toISOString());
}

/** Take the flag (one worker only gets to skip the reset). Returns whether it was there. */
export function consumeWarmFreshFlag(): boolean {
  try {
    fs.rmSync(WARM_FRESH_FLAG);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reload every app webview (staff + customer) over CDP, then wait out the splash.
 *
 * The attach-mode twin of `isolateGroupedFiles` in tests/setup/rootHooks.ts: it
 * drops what the last file left in memory — an open dialog, a search filter, a
 * selected draft, a tip-wait modal — the way a fresh app would, for ~2s instead
 * of a relaunch. Done here, before the WebDriver session exists, so no element
 * handle goes stale under it.
 */
export async function reloadAttachedApp(): Promise<void> {
  const env = loadEnv();
  const base = `http://${env.DRIVER_HOST}:${String(env.REMOTE_DEBUG_PORT)}`;
  const targets = (await (await fetch(`${base}/json/list`)).json()) as Array<
    CdpTarget & { webSocketDebuggerUrl?: string }
  >;
  for (const target of targets) {
    if (target.type !== 'page' || !target.webSocketDebuggerUrl) continue;
    if (!(target.url ?? '').startsWith('http://tauri.localhost')) continue;
    await cdpCall(target.webSocketDebuggerUrl, 'Page.reload', {}).catch((error: unknown) =>
      log.warn(`attach reset: could not reload ${target.url ?? '?'}: ${(error as Error).message}`),
    );
  }
  // The staff page re-enters the router at /splashscreen; give it a beat to get there.
  await delay(300);
  const url = await waitForBootedApp(Timeouts.APP_BOOT);
  log.info(`attach reset: reloaded the webviews — staff window back on ${url ?? '(still booting)'}`);
}

/** `/customer/` — the customer window's own `url` in src-tauri/tauri.conf.json. */
const CUSTOMER_URL = 'http://tauri.localhost/customer/';

/**
 * Load the customer display when an attach-mode launch left it on `about:blank`.
 *
 * Launched with WebView2 remote debugging on, the app opens the `customer`
 * window (Tauri internals, label and all) but never navigates it — so every
 * cash/card payment, whose tip step lands on the customer screen, wedged on the
 * window switch and the attach lane had to send those specs to a relaunching
 * lane. Navigating that target to the window's configured URL is exactly what
 * the launch path does on its own. A no-op when it is already loaded (one
 * `/json/list` read), so it is cheap to call before every spec file.
 */
export async function primeCustomerWindow(): Promise<boolean> {
  const env = loadEnv();
  const base = `http://${env.DRIVER_HOST}:${String(env.REMOTE_DEBUG_PORT)}`;
  const targets = (await (await fetch(`${base}/json/list`)).json()) as Array<
    CdpTarget & { webSocketDebuggerUrl?: string }
  >;
  if (targets.some((t) => t.type === 'page' && (t.url ?? '').includes('/customer'))) return false;

  for (const target of targets) {
    if (target.type !== 'page' || target.url !== 'about:blank' || !target.webSocketDebuggerUrl) continue;
    const label = await cdpCall(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
      expression: 'window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? null',
      returnByValue: true,
    });
    if ((label as { result?: { value?: unknown } }).result?.value !== 'customer') continue;
    await cdpCall(target.webSocketDebuggerUrl, 'Page.navigate', { url: CUSTOMER_URL });
    await waitCustomerLoaded();
    log.info('attach: customer window was about:blank — navigated it to /customer/');
    return true;
  }
  return false;
}

/**
 * Reset the customer display of an attached app: load `/customer/` afresh over CDP.
 *
 * The attach-mode twin of the WebDriver refresh `isolateGroupedFiles` gives the
 * customer window between grouped files. In a CDP-launched app that refresh (or
 * a CDP Page.reload) leaves the window on `about:blank` — no "VOLT POS -
 * Customer Display" title, so every later `switchToCustomer` reported "No
 * customer window is open" and any payment that shows the tip screen there
 * wedged. Navigating to the window's own URL is the same fresh load, and it also
 * mends a window that is already blank. Returns whether a customer window was found.
 *
 * The window is told apart by its Tauri label, not only by its URL: a case cut by
 * a timeout once drove the customer window onto a staff route (/incomes/…), after
 * which both windows read "Volt POS" on a staff path and only the label said which
 * one belonged back on /customer/.
 */
export async function resetCustomerWindow(): Promise<boolean> {
  const env = loadEnv();
  const base = `http://${env.DRIVER_HOST}:${String(env.REMOTE_DEBUG_PORT)}`;
  const targets = (await (await fetch(`${base}/json/list`)).json()) as Array<
    CdpTarget & { webSocketDebuggerUrl?: string }
  >;
  for (const target of targets) {
    if (target.type !== 'page' || !target.webSocketDebuggerUrl) continue;
    let isCustomer = (target.url ?? '').includes('/customer');
    if (!isCustomer) {
      const label = await cdpCall(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
        expression: 'window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? null',
        returnByValue: true,
      });
      isCustomer = (label as { result?: { value?: unknown } }).result?.value === 'customer';
    }
    if (!isCustomer) continue;
    await cdpCall(target.webSocketDebuggerUrl, 'Page.navigate', { url: CUSTOMER_URL });
    await waitCustomerLoaded();
    return true;
  }
  return false;
}

/**
 * Wait until the customer window's target reports `/customer` (≤5s).
 *
 * Page.navigate returns once the navigation STARTS. Until it commits, the
 * target is still `about:blank` — which a window listing counts as a second
 * staff window (app-launch's "exactly one of each" saw 2 staff windows).
 */
async function waitCustomerLoaded(timeoutMs = 5_000): Promise<void> {
  const env = loadEnv();
  const base = `http://${env.DRIVER_HOST}:${String(env.REMOTE_DEBUG_PORT)}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const targets = (await (await fetch(`${base}/json/list`)).json()) as CdpTarget[];
    if (targets.some((t) => t.type === 'page' && (t.url ?? '').includes('/customer'))) return;
    await delay(150);
  }
  log.warn('attach: the customer window did not reach /customer/ within 5s');
}

/** One CDP request over a page's own websocket. */
async function cdpCall(wsUrl: string, method: string, params: Record<string, unknown>): Promise<unknown> {
  const ws = new WebSocket(wsUrl);
  try {
    await new Promise<void>((resolve, reject) => {
      ws.onopen = (): void => resolve();
      ws.onerror = (): void => reject(new Error(`CDP socket failed: ${wsUrl}`));
    });
    return await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP ${method} timed out`)), Timeouts.SHORT);
      ws.onmessage = (event: MessageEvent): void => {
        const msg = JSON.parse(String(event.data)) as { id?: number; result?: unknown };
        if (msg.id !== 1) return;
        clearTimeout(timer);
        resolve(msg.result);
      };
      ws.send(JSON.stringify({ id: 1, method, params }));
    });
  } finally {
    ws.close();
  }
}
