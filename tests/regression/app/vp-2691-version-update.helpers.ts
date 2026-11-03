/**
 * Helpers for vp-2691-version-update.spec.ts — a FAKE updater plus in-page
 * probes of the Version Update page and the updater toasts.
 *
 * ## Why the updater is faked
 *
 * The dev feed never offers a build newer than the one installed, so every
 * "an update is available" case needs an offer the server does not have. The
 * Tauri IPC is out of reach (`__TAURI_INTERNALS__.invoke` / `.ipc` are
 * non-writable), but on Windows every IPC call is a `fetch` to
 * `http://ipc.localhost/<command>`. {@link installUpdaterMock} wraps
 * `window.fetch` and answers three commands itself:
 *
 *   - `plugin:updater|check`      → an offer / `null` / a network error, per {@link MockMode};
 *   - `plugin:updater|download`   → ALWAYS an error (also `install`, `download_and_install`);
 *   - `plugin:resources|close`    → ok, for the fake resource id only.
 *
 * Download and install are refused whatever the resource id, so a stray
 * "Update Now" while the mock is installed can never fetch or run a real
 * installer. Everything else passes through to the real IPC.
 *
 * A document reload drops the wrapper (and the app's updater store with it) —
 * the spec's `after()` reloads to leave the till exactly as it found it.
 *
 * The offer's `body` is JSON (`{"description": …}`): the app reads release notes
 * with `parseUpdateNotes(body).description`, so a plain string would render no
 * Description. It never carries `deprecated`, which would trip the forced-update
 * screen (and that screen installs on mount).
 */

import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { VersionUpdateCss, VersionUpdateText } from '../../../src/constants/testids.version-update.js';
import { appNav } from '../../../src/components/index.js';
import { settle } from '../../../src/helpers/wait.js';
import { appShellProbe } from '../../../src/pages/voltqc/app-perm/AppShellProbe.js';

/** What the fake `plugin:updater|check` answers. */
export type MockMode = 'offer' | 'none' | 'offline';

export interface UpdaterMockConfig {
  mode: MockMode;
  /** The running build, as the real check would report it (`update.currentVersion`). */
  currentVersion: string;
  /** The fake offered build — must be strictly newer than `currentVersion`. */
  version: string;
  /** Release notes packed into the offer's JSON `body`. */
  description: string;
  /** Delay before the check answers, so "Checking for Updates" can be observed. */
  checkDelayMs: number;
  /** Delay before the download fails, so "Software Updating" can be observed. */
  downloadDelayMs: number;
}

export interface UpdaterMockCalls {
  check: number;
  download: number;
  install: number;
}

/** Resource id of the fake `Update` handle — far above anything the app allocates in a session. */
const FAKE_RID = 990_001;

interface MockState extends UpdaterMockConfig {
  rid: number;
  calls: UpdaterMockCalls;
}

/** Install (or re-arm) the fetch wrapper. Self-contained: runs inside the WebView. */
function installInPage(state: MockState): boolean {
  const w = window as unknown as {
    fetch: typeof fetch;
    __e2eUpdaterMock?: MockState;
    __e2eOrigFetch?: typeof fetch;
  };
  const previous = w.__e2eUpdaterMock;
  w.__e2eUpdaterMock = { ...state, calls: previous ? previous.calls : state.calls };
  if (w.__e2eOrigFetch) return true;

  const original = w.fetch;
  w.__e2eOrigFetch = original;

  const reply = (ok: boolean, body: string, type: string, delay: number): Promise<Response> =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          new Response(body, {
            status: ok ? 200 : 500,
            headers: { 'Content-Type': type, 'Tauri-Response': ok ? 'ok' : 'error' },
          }),
        );
      }, delay);
    });

  w.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const mock = w.__e2eUpdaterMock;
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const match = /^(?:https?:\/\/ipc\.localhost|ipc:\/\/localhost)\/([^?]+)/.exec(url);
    if (!mock || !match?.[1]) return original.call(window, input, init);

    const command = decodeURIComponent(match[1]);
    if (command === 'plugin:updater|check') {
      mock.calls.check += 1;
      if (mock.mode === 'offline') {
        return reply(
          false,
          'error sending request (e2e updater mock: offline)',
          'text/plain',
          mock.checkDelayMs,
        );
      }
      if (mock.mode === 'none') return reply(true, 'null', 'application/json', mock.checkDelayMs);
      const offer = {
        rid: mock.rid,
        currentVersion: mock.currentVersion,
        version: mock.version,
        date: null,
        body: JSON.stringify({ description: mock.description }),
        rawJson: {},
      };
      return reply(true, JSON.stringify(offer), 'application/json', mock.checkDelayMs);
    }
    if (
      command === 'plugin:updater|download' ||
      command === 'plugin:updater|download_and_install' ||
      command === 'plugin:updater|install'
    ) {
      // Refused for EVERY resource id: nothing real is ever fetched or installed.
      if (command === 'plugin:updater|install') mock.calls.install += 1;
      else mock.calls.download += 1;
      return reply(false, 'e2e updater mock: download refused', 'text/plain', mock.downloadDelayMs);
    }
    if (
      command === 'plugin:resources|close' &&
      typeof init?.body === 'string' &&
      init.body.includes(String(mock.rid))
    ) {
      return reply(true, 'null', 'application/json', 0);
    }
    return original.call(window, input, init);
  };
  return true;
}

/**
 * Install the fake updater (idempotent; a later call only changes the config
 * and keeps the call counters). Re-installs after a reload wiped it.
 */
export async function installUpdaterMock(config: UpdaterMockConfig): Promise<void> {
  const state: MockState = { ...config, rid: FAKE_RID, calls: { check: 0, download: 0, install: 0 } };
  const ok = await browser.execute(installInPage, state);
  if (!ok) throw new Error('Could not install the updater mock.');
}

/** Change the mode (and delays) of an installed mock. */
export async function setUpdaterMock(patch: Partial<UpdaterMockConfig>): Promise<void> {
  const ok = await browser.execute(function (p: Partial<UpdaterMockConfig>): boolean {
    const w = window as unknown as { __e2eUpdaterMock?: Record<string, unknown> };
    if (!w.__e2eUpdaterMock) return false;
    Object.assign(w.__e2eUpdaterMock, p);
    return true;
  }, patch);
  if (!ok) throw new Error('setUpdaterMock(): the mock is not installed (a reload drops it).');
}

export async function updaterMockCalls(): Promise<UpdaterMockCalls> {
  return browser.execute(function (): UpdaterMockCalls {
    const w = window as unknown as { __e2eUpdaterMock?: { calls: UpdaterMockCalls } };
    return w.__e2eUpdaterMock ? { ...w.__e2eUpdaterMock.calls } : { check: 0, download: 0, install: 0 };
  });
}

/** Put the real `fetch` back (the app store keeps whatever the mock told it — reload for a clean slate). */
export async function removeUpdaterMock(): Promise<void> {
  await browser.execute(function (): void {
    const w = window as unknown as {
      fetch: typeof fetch;
      __e2eUpdaterMock?: unknown;
      __e2eOrigFetch?: typeof fetch;
    };
    if (w.__e2eOrigFetch) w.fetch = w.__e2eOrigFetch;
    delete w.__e2eOrigFetch;
    delete w.__e2eUpdaterMock;
  });
}

/** `1.1.88` → `1.1.89` (a `-b<ts>` suffix is dropped). */
export function nextPatch(version: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!m) throw new Error(`Not a semver: "${version}"`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

/* ------------------------------------------------------------------ *
 * Version Update page
 * ------------------------------------------------------------------ */

export type PageStatus = 'checking' | 'available' | 'upToDate' | 'failed' | '';

export interface VersionPage {
  open: boolean;
  status: PageStatus;
  /** Whole dialog text, whitespace-collapsed. */
  text: string;
  current: string;
  latest: string;
  description: string;
  hasUpdateNow: boolean;
  /** The icon-only "Check for updates" (refresh) button is enabled. */
  refreshEnabled: boolean;
}

interface PageProbeConfig {
  dialogCss: string;
  titles: readonly string[];
  checking: readonly string[];
  available: readonly string[];
  upToDate: readonly string[];
  failed: readonly string[];
  current: readonly string[];
  latest: readonly string[];
  description: readonly string[];
  updateNow: readonly string[];
  refreshLabels: readonly string[];
}

const PAGE_PROBE: PageProbeConfig = {
  dialogCss: VersionUpdateCss.dialog,
  titles: VersionUpdateText.versionUpdate,
  checking: VersionUpdateText.checking,
  available: VersionUpdateText.available,
  upToDate: VersionUpdateText.upToDate,
  failed: VersionUpdateText.checkFailed,
  current: VersionUpdateText.currentVersion,
  latest: VersionUpdateText.latestVersion,
  description: VersionUpdateText.description,
  updateNow: VersionUpdateText.updateNow,
  refreshLabels: ['Check for updates', 'Kiểm tra cập nhật'],
};

function probePage(cfg: PageProbeConfig): VersionPage {
  const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const empty: VersionPage = {
    open: false,
    status: '',
    text: '',
    current: '',
    latest: '',
    description: '',
    hasUpdateNow: false,
    refreshEnabled: false,
  };
  const dialog = Array.from(document.querySelectorAll<HTMLElement>(cfg.dialogCss)).find(
    (d) =>
      d.getClientRects().length > 0 &&
      Array.from(d.querySelectorAll('h2')).some((h) => cfg.titles.includes(norm(h.textContent))) &&
      cfg.current.some((c) => norm(d.textContent).includes(c)),
  );
  if (!dialog) return empty;

  const text = norm(dialog.textContent);
  const has = (pair: readonly string[]): boolean => pair.some((t) => text.includes(t));
  // "Phiên bản mới nhất" (vi "Latest version" label) is a substring of the vi up-to-date
  // headline, so the headline is read from the card title (`CardTitle` → data-slot), not the text.
  const titles = Array.from(dialog.querySelectorAll('[data-slot="card-title"]')).map((el) =>
    norm(el.textContent),
  );
  const isTitle = (pair: readonly string[]): boolean =>
    titles.some((t) => pair.includes(t)) || (titles.length === 0 && has(pair));
  const status: PageStatus = isTitle(cfg.checking)
    ? 'checking'
    : isTitle(cfg.available)
      ? 'available'
      : isTitle(cfg.failed)
        ? 'failed'
        : isTitle(cfg.upToDate)
          ? 'upToDate'
          : '';

  const valueAfterLabel = (pair: readonly string[]): string => {
    const label = Array.from(dialog.querySelectorAll('label')).find((l) =>
      pair.includes(norm(l.textContent)),
    );
    const next = label?.nextElementSibling;
    if (!next) return '';
    const input = next instanceof HTMLInputElement ? next : next.querySelector('input');
    return input ? norm(input.value) : norm(next.textContent);
  };

  const buttons = Array.from(dialog.querySelectorAll('button'));
  const refresh = buttons.find((b) => cfg.refreshLabels.includes(b.getAttribute('aria-label') ?? ''));
  return {
    open: true,
    status,
    text,
    current: valueAfterLabel(cfg.current),
    latest: valueAfterLabel(cfg.latest),
    description: valueAfterLabel(cfg.description),
    hasUpdateNow: buttons.some(
      (b) => cfg.updateNow.includes(norm(b.textContent)) && b.getClientRects().length > 0,
    ),
    refreshEnabled: refresh ? !refresh.disabled : false,
  };
}

export async function readVersionPage(): Promise<VersionPage> {
  return browser.execute(probePage, PAGE_PROBE);
}

/** Wait for the page to report `status` (and return it). */
export async function waitForPageStatus(
  status: PageStatus,
  timeout: number = Timeouts.MEDIUM,
): Promise<VersionPage> {
  let last: VersionPage | null = null;
  await browser
    .waitUntil(
      async () => {
        last = await readVersionPage();
        return last.status === status;
      },
      {
        timeout,
        interval: 150,
        timeoutMsg: `Version Update never showed "${status}"`,
      },
    )
    .catch((error: unknown) => {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} — last seen: ${JSON.stringify(last)}`,
      );
    });
  return readVersionPage();
}

/** Open ≡ → Version Update (the dialog re-checks on open). */
export async function openVersionUpdatePage(): Promise<void> {
  if ((await readVersionPage()).open) return;
  await appNav.openSidebar();
  await appShellProbe.clickVersionUpdate();
  await browser.waitUntil(async () => (await readVersionPage()).open, {
    timeout: Timeouts.MEDIUM,
    interval: 200,
    timeoutMsg: 'The Version Update dialog never opened',
  });
}

/**
 * Press the dialog's X by JS. A WebDriver click can land on the updater toast,
 * which sits top-right over the dialog's header when one is up.
 */
export async function closeVersionUpdatePage(): Promise<void> {
  if (!(await readVersionPage()).open) return;
  const ok = await clickButtonIn(VersionUpdateCss.dialog, VersionUpdateText.currentVersion, [
    'Close',
    'Đóng',
  ]);
  if (!ok) await appShellProbe.closeVersionDialog();
  await browser.waitUntil(async () => !(await readVersionPage()).open, {
    timeout: Timeouts.SHORT,
    interval: 150,
    timeoutMsg: 'The Version Update dialog did not close',
  });
}

/** Press the page's icon-only refresh ("Check for updates") by JS. Returns whether it was clickable. */
export async function pressRefresh(): Promise<boolean> {
  return browser.execute(function (cfg: PageProbeConfig): boolean {
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>(cfg.dialogCss));
    for (const d of dialogs) {
      const btn = Array.from(d.querySelectorAll('button')).find((b) =>
        cfg.refreshLabels.includes(b.getAttribute('aria-label') ?? ''),
      );
      if (btn && !btn.disabled) {
        btn.click();
        return true;
      }
    }
    return false;
  }, PAGE_PROBE);
}

/** Refresh and wait until the check finished (refresh re-enabled). */
export async function refreshAndSettle(timeout: number = Timeouts.LONG): Promise<VersionPage> {
  await browser.waitUntil(async () => (await readVersionPage()).refreshEnabled, {
    timeout,
    interval: 150,
    timeoutMsg: 'Check for updates never became clickable',
  });
  if (!(await pressRefresh())) throw new Error('Check for updates could not be pressed');
  await settle(Timeouts.ANIMATION);
  await browser.waitUntil(async () => (await readVersionPage()).refreshEnabled, {
    timeout,
    interval: 150,
    timeoutMsg: 'The update check never finished',
  });
  return readVersionPage();
}

/* ------------------------------------------------------------------ *
 * Buttons, confirm, overlay, toasts — all by JS + text
 * ------------------------------------------------------------------ */

/**
 * Click the first VISIBLE button whose text is one of `labels`, inside the first
 * visible `scopeCss` element whose text contains one of `markers`.
 */
export async function clickButtonIn(
  scopeCss: string,
  markers: readonly string[],
  labels: readonly string[],
): Promise<boolean> {
  return browser.execute(
    function (css: string, mk: readonly string[], lb: readonly string[]): boolean {
      const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
      for (const scope of Array.from(document.querySelectorAll<HTMLElement>(css))) {
        if (scope.getClientRects().length === 0) continue;
        if (!mk.some((m) => norm(scope.textContent).includes(m))) continue;
        const btn = Array.from(scope.querySelectorAll('button')).find(
          (b) => lb.includes(norm(b.textContent)) && b.getClientRects().length > 0,
        );
        if (btn) {
          btn.click();
          return true;
        }
      }
      return false;
    },
    scopeCss,
    markers,
    labels,
  );
}

/** Version Update page → "Update Now" (opens the confirm). */
export async function pressPageUpdateNow(): Promise<void> {
  const ok = await clickButtonIn(
    VersionUpdateCss.dialog,
    VersionUpdateText.currentVersion,
    VersionUpdateText.updateNow,
  );
  if (!ok) throw new Error('The Version Update page shows no "Update Now".');
}

/** Title of the open "Update to version X?" confirm, or `''`. */
export async function confirmTitle(): Promise<string> {
  return browser.execute(
    function (css: string, prefixes: readonly string[]): string {
      for (const d of Array.from(document.querySelectorAll<HTMLElement>(css))) {
        if (d.getClientRects().length === 0) continue;
        const h = Array.from(d.querySelectorAll('h2')).find((el) =>
          prefixes.some((p) => (el.textContent ?? '').trim().startsWith(p)),
        );
        if (h) return (h.textContent ?? '').replace(/\s+/g, ' ').trim();
      }
      return '';
    },
    VersionUpdateCss.alertDialog,
    VersionUpdateText.confirmTitlePrefix,
  );
}

export async function waitForConfirm(): Promise<string> {
  await browser.waitUntil(async () => (await confirmTitle()) !== '', {
    timeout: Timeouts.SHORT,
    interval: 150,
    timeoutMsg: 'The "Update to version X?" confirm never opened',
  });
  return confirmTitle();
}

/** Answer the confirm: `cancel` or `confirm` ("Update Now"). */
export async function answerConfirm(answer: 'cancel' | 'confirm'): Promise<void> {
  const labels = answer === 'cancel' ? VersionUpdateText.cancel : VersionUpdateText.updateNow;
  const ok = await clickButtonIn(VersionUpdateCss.alertDialog, VersionUpdateText.confirmTitlePrefix, labels);
  if (!ok) throw new Error(`The confirm has no "${labels[0]}" button.`);
  await browser.waitUntil(async () => (await confirmTitle()) === '', {
    timeout: Timeouts.SHORT,
    interval: 150,
    timeoutMsg: 'The confirm did not close',
  });
}

/** Is the "Software Updating" progress overlay on screen? */
export async function isSoftwareUpdatingShown(): Promise<boolean> {
  return browser.execute(
    function (css: string, markers: readonly string[]): boolean {
      return Array.from(document.querySelectorAll<HTMLElement>(css)).some(
        (d) => d.getClientRects().length > 0 && markers.some((m) => (d.textContent ?? '').includes(m)),
      );
    },
    VersionUpdateCss.alertDialog,
    VersionUpdateText.softwareUpdating,
  );
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ToastButton {
  label: string;
  rect: Rect;
  fontSizePx: number;
  /** Fully inside the toast's box. */
  inToast: boolean;
  /** Fully inside the viewport. */
  inViewport: boolean;
  /** `elementFromPoint` at its centre hits the button (only meaningful with no modal open). */
  onTop: boolean;
}

export interface ToastProbe {
  present: boolean;
  heading: string;
  rect: Rect | null;
  viewport: { width: number; height: number };
  buttons: ToastButton[];
  hasClose: boolean;
}

interface ToastProbeConfig {
  toastCss: string;
  headings: readonly string[];
  labels: readonly string[];
  closeIconCss: string;
}

function probeToast(cfg: ToastProbeConfig): ToastProbe {
  const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const box = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const toast = Array.from(document.querySelectorAll<HTMLElement>(cfg.toastCss)).find(
    (t) =>
      t.getClientRects().length > 0 &&
      Array.from(t.querySelectorAll('h3')).some((h) => cfg.headings.includes(norm(h.textContent))),
  );
  if (!toast) return { present: false, heading: '', rect: null, viewport, buttons: [], hasClose: false };

  const tr = box(toast);
  const inside = (r: Rect, o: Rect): boolean =>
    r.left >= o.left - 0.5 && r.top >= o.top - 0.5 && r.right <= o.right + 0.5 && r.bottom <= o.bottom + 0.5;
  const vp: Rect = { left: 0, top: 0, right: viewport.width, bottom: viewport.height, ...viewport };
  const buttons = Array.from(toast.querySelectorAll('button'))
    .filter((b) => cfg.labels.includes(norm(b.textContent)))
    .map((b) => {
      const r = box(b);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        label: norm(b.textContent),
        rect: r,
        fontSizePx: parseFloat(window.getComputedStyle(b).fontSize) || 0,
        inToast: inside(r, tr),
        inViewport: inside(r, vp),
        onTop: !!hit && (hit === b || b.contains(hit)),
      };
    });
  const hasClose = Array.from(toast.querySelectorAll('button')).some((b) =>
    b.querySelector(cfg.closeIconCss),
  );
  const heading = norm(
    Array.from(toast.querySelectorAll('h3'))
      .map((h) => h.textContent)
      .join(' '),
  );
  return { present: true, heading, rect: tr, viewport, buttons, hasClose };
}

const FAILED_TOAST: ToastProbeConfig = {
  toastCss: VersionUpdateCss.toast,
  headings: VersionUpdateText.updateFailed,
  labels: [...VersionUpdateText.updateLater, ...VersionUpdateText.updateNow],
  closeIconCss: VersionUpdateCss.closeIcon,
};

const AVAILABLE_TOAST: ToastProbeConfig = { ...FAILED_TOAST, headings: VersionUpdateText.available };

export type UpdaterToast = 'failed' | 'available';

export async function probeUpdaterToast(which: UpdaterToast): Promise<ToastProbe> {
  return browser.execute(probeToast, which === 'failed' ? FAILED_TOAST : AVAILABLE_TOAST);
}

export async function waitForToast(
  which: UpdaterToast,
  timeout: number = Timeouts.MEDIUM,
): Promise<ToastProbe> {
  await browser.waitUntil(async () => (await probeUpdaterToast(which)).present, {
    timeout,
    interval: 150,
    timeoutMsg: `The "${which}" updater toast never appeared`,
  });
  return probeUpdaterToast(which);
}

export async function waitToastGone(which: UpdaterToast, timeout: number = Timeouts.SHORT): Promise<void> {
  await browser.waitUntil(async () => !(await probeUpdaterToast(which)).present, {
    timeout,
    interval: 150,
    timeoutMsg: `The "${which}" updater toast did not close`,
  });
}

/** Press a control on an updater toast by JS: a labelled button or the X. */
export async function pressToast(
  which: UpdaterToast,
  control: 'updateNow' | 'updateLater' | 'close',
): Promise<void> {
  const cfg = which === 'failed' ? FAILED_TOAST : AVAILABLE_TOAST;
  const labels: readonly string[] =
    control === 'updateNow'
      ? VersionUpdateText.updateNow
      : control === 'updateLater'
        ? VersionUpdateText.updateLater
        : [];
  const ok = await browser.execute(
    function (c: ToastProbeConfig, lb: readonly string[]): boolean {
      const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
      const toast = Array.from(document.querySelectorAll<HTMLElement>(c.toastCss)).find((t) =>
        Array.from(t.querySelectorAll('h3')).some((h) => c.headings.includes(norm(h.textContent))),
      );
      if (!toast) return false;
      const btn = Array.from(toast.querySelectorAll('button')).find((b) =>
        lb.length > 0 ? lb.includes(norm(b.textContent)) : b.querySelector(c.closeIconCss) !== null,
      );
      if (!btn) return false;
      btn.click();
      return true;
    },
    cfg,
    labels,
  );
  if (!ok) throw new Error(`The "${which}" toast has no "${control}" control.`);
}

/** Text of every visible sonner toast (info toasts included). */
export async function toastTexts(): Promise<string[]> {
  return browser.execute(function (css: string): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>(css))
      .filter((t) => t.getClientRects().length > 0)
      .map((t) => (t.textContent ?? '').replace(/\s+/g, ' ').trim());
  }, VersionUpdateCss.toast);
}

/** Any dialog / alertdialog on screen whose text holds updater copy (the old auto-update popup, forced update…). */
export async function updaterPopupTexts(): Promise<string[]> {
  return browser.execute(
    function (css: string, markers: readonly string[]): string[] {
      return Array.from(document.querySelectorAll<HTMLElement>(css))
        .filter((d) => d.getClientRects().length > 0)
        .map((d) => (d.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((t) => markers.some((m) => t.includes(m)));
    },
    `${VersionUpdateCss.dialog}, ${VersionUpdateCss.alertDialog}`,
    [
      ...VersionUpdateText.available,
      ...VersionUpdateText.updateNow,
      ...VersionUpdateText.updateRequired,
      ...VersionUpdateText.softwareUpdating,
    ],
  );
}

/** Is any modal (dialog / alertdialog) on screen? */
export async function anyModalOpen(): Promise<boolean> {
  return browser.execute(function (css: string): boolean {
    return Array.from(document.querySelectorAll<HTMLElement>(css)).some((d) => d.getClientRects().length > 0);
  }, `${VersionUpdateCss.dialog}, ${VersionUpdateCss.alertDialog}`);
}

/** Sidebar (must be open): does the Version Update entry carry the warning triangle? */
export async function sidebarVersionEntry(): Promise<{ found: boolean; alert: boolean }> {
  return browser.execute(
    function (
      sidebarCss: string,
      titles: readonly string[],
      iconCss: string,
    ): { found: boolean; alert: boolean } {
      const sidebar = document.querySelector(sidebarCss);
      if (!sidebar) return { found: false, alert: false };
      const entry = Array.from(sidebar.querySelectorAll('button')).find((b) =>
        titles.some((t) => (b.textContent ?? '').replace(/\s+/g, ' ').trim() === t),
      );
      if (!entry) return { found: false, alert: false };
      return { found: true, alert: entry.querySelector(iconCss) !== null };
    },
    VersionUpdateCss.sidebar,
    VersionUpdateText.versionUpdate,
    VersionUpdateCss.alertIcon,
  );
}
