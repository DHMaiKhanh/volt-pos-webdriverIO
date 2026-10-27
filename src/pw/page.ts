/**
 * Playwright-compatible `Page` / `Locator` on top of WebdriverIO.
 *
 * Why this exists: the volt-qc Windows suite (≈2,000 regression cases, proven
 * live) is written against Playwright's API. Re-expressing every case by hand
 * would lose that proof; this layer lets the same flows and specs run on the
 * WebdriverIO runner and driver (tauri-driver → msedgedriver → WebView2) with
 * only their imports changed.
 *
 * How it works:
 * - a locator is a serialised CHAIN of steps, resolved in the page by
 *   `ENGINE_SRC` (see engine.ts) on every use — never a cached element, exactly
 *   like Playwright's lazy locators;
 * - actions resolve the chain, wait for the element to be visible/enabled, then
 *   act through WebDriver (`element.click()`, `browser.keys`) so the app sees
 *   real input events (the keypads fire on `mousedown`);
 * - the app has TWO windows (staff + customer display). Every WebDriver call goes
 *   through {@link withWindow}, which serialises access and switches handle only
 *   when needed, so `Promise.all` across the two pages cannot interleave.
 */

import { writeFileSync } from 'node:fs';
import { browser } from '@wdio/globals';
import { Key } from 'webdriverio';
import { ENGINE_SRC } from './engine.js';

/* ------------------------------------------------------------------------- *
 * Window lock
 * ------------------------------------------------------------------------- */

let currentHandle: string | null = null;
let lockTail: Promise<unknown> = Promise.resolve();

/** String-script `browser.execute`, typed by the caller. */
const execString = <R>(script: string, ...args: unknown[]): Promise<R> =>
  (browser.execute as unknown as (s: string, ...a: unknown[]) => Promise<R>)(script, ...args);

/** Run `fn` with the driver switched to `handle`. Serialised across the process. */
export function withWindow<T>(handle: string, fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    if (currentHandle !== handle) {
      await browser.switchToWindow(handle);
      currentHandle = handle;
    }
    return fn();
  };
  const next = lockTail.then(run, run);
  lockTail = next.catch(() => undefined);
  return next;
}

/** Forget the cached handle (after a reload the driver may have re-targeted). */
export function resetWindowCache(): void {
  currentHandle = null;
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------------- *
 * Types
 * ------------------------------------------------------------------------- */

type TextMatch = string | RegExp;
type SerialMatch = { s: string } | { re: string; flags: string };
type Step = Record<string, unknown> & { k: string };
type ElRef = Record<string, string>;

const ser = (m: TextMatch): SerialMatch =>
  m instanceof RegExp ? { re: m.source, flags: m.flags.replace('g', '') } : { s: String(m) };

export interface RoleOptions {
  name?: TextMatch;
  exact?: boolean;
  checked?: boolean;
  pressed?: boolean;
  selected?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  includeHidden?: boolean;
  level?: number;
}

export interface FilterOptions {
  hasText?: TextMatch;
  hasNotText?: TextMatch;
  has?: PwLocator;
  hasNot?: PwLocator;
  visible?: boolean;
}

export interface TimeoutOption {
  timeout?: number;
}

export interface ClickOptions extends TimeoutOption {
  force?: boolean;
  position?: { x: number; y: number };
  clickCount?: number;
  button?: 'left' | 'right' | 'middle';
  delay?: number;
  noWaitAfter?: boolean;
  trial?: boolean;
  modifiers?: string[];
}

export type BoundingBox = { x: number; y: number; width: number; height: number };

/** Default action / expect timeouts — the volt-qc playwright.config values. */
export const Defaults = { action: 10_000, expect: 10_000, navigation: 30_000 };

/* ------------------------------------------------------------------------- *
 * Keys
 * ------------------------------------------------------------------------- */

const KEY_MAP: Record<string, string> = {
  Enter: Key.Enter,
  Escape: Key.Escape,
  Backspace: Key.Backspace,
  Tab: Key.Tab,
  Delete: Key.Delete,
  ArrowDown: Key.ArrowDown,
  ArrowUp: Key.ArrowUp,
  ArrowLeft: Key.ArrowLeft,
  ArrowRight: Key.ArrowRight,
  Home: Key.Home,
  End: Key.End,
  PageDown: Key.PageDown,
  PageUp: Key.PageUp,
  Space: Key.Space,
  Control: Key.Ctrl,
  ControlOrMeta: Key.Ctrl,
  Meta: Key.Ctrl,
  Shift: Key.Shift,
  Alt: Key.Alt,
};

/** Playwright key chord ("Control+A", "Shift+Tab", "a") → browser.keys() argument. */
export function mapKey(chord: string): string[] {
  if (chord === '+') return ['+'];
  return chord.split('+').map((k) => KEY_MAP[k] ?? (k.length === 1 ? (k.toLowerCase() === k ? k : k) : k));
}

/* ------------------------------------------------------------------------- *
 * Page
 * ------------------------------------------------------------------------- */

interface QueryResult {
  els: ElRef[];
  href: string;
}

export class PwPage {
  private cachedUrl = 'http://tauri.localhost/';

  readonly keyboard: PwKeyboard;

  readonly mouse: PwMouse;

  constructor(
    public handle: string,
    readonly label: string,
  ) {
    this.keyboard = new PwKeyboard(this);
    this.mouse = new PwMouse(this);
  }

  /** Synchronous like Playwright: the last URL any operation on this page observed. */
  url(): string {
    return this.cachedUrl;
  }

  noteUrl(href: string | undefined): void {
    if (href) this.cachedUrl = href;
  }

  async refreshUrl(): Promise<string> {
    const href = await withWindow(this.handle, () => browser.execute(() => location.href));
    this.noteUrl(href);
    return href;
  }

  /** Resolve a chain in this window. */
  async query(chain: Step[]): Promise<QueryResult> {
    const res = await withWindow(this.handle, () =>
      execString<QueryResult>(
        `${ENGINE_SRC}; return { els: window.__pw.run(arguments[0], null), href: location.href };`,
        chain,
      ),
    );
    this.noteUrl(res.href);
    return res;
  }

  /** Run `body` (JS source using `els` = resolved elements and `arg`) in the page. */
  async onElements<T>(chain: Step[], body: string, arg?: unknown): Promise<T> {
    const res = await withWindow(this.handle, () =>
      execString<{ v: T; href: string }>(
        `${ENGINE_SRC}; var els = window.__pw.run(arguments[0], null); var arg = arguments[1]; var pw = window.__pw; ` +
          `var __r = (function(){ ${body} })(); return Promise.resolve(__r).then(function (v) { return { v: v, href: location.href }; });`,
        chain,
        arg as never,
      ),
    );
    this.noteUrl(res.href);
    return res.v;
  }

  locator(selector: string, opts?: FilterOptions): PwLocator {
    return new PwLocator(this, []).locator(selector, opts);
  }

  getByRole(role: string, opts: RoleOptions = {}): PwLocator {
    return new PwLocator(this, []).getByRole(role, opts);
  }

  getByText(text: TextMatch, opts: { exact?: boolean } = {}): PwLocator {
    return new PwLocator(this, []).getByText(text, opts);
  }

  getByPlaceholder(text: TextMatch, opts: { exact?: boolean } = {}): PwLocator {
    return new PwLocator(this, []).getByPlaceholder(text, opts);
  }

  getByLabel(text: TextMatch, opts: { exact?: boolean } = {}): PwLocator {
    return new PwLocator(this, []).getByLabel(text, opts);
  }

  getByTestId(id: string): PwLocator {
    return new PwLocator(this, []).getByTestId(id);
  }

  getByTitle(text: TextMatch, opts: { exact?: boolean } = {}): PwLocator {
    return new PwLocator(this, []).getByTitle(text, opts);
  }

  getByAltText(text: TextMatch, opts: { exact?: boolean } = {}): PwLocator {
    return new PwLocator(this, []).getByAltText(text, opts);
  }

  /** `page.evaluate(fn, arg)` — fn is serialised and run in the page. */
  async evaluate<R, A = unknown>(fn: ((arg: A) => R | Promise<R>) | string, arg?: A): Promise<R> {
    const src = typeof fn === 'string' ? `return (${fn});` : `return (${fn.toString()})(arguments[0]);`;
    const res = await withWindow(this.handle, () =>
      execString<{ v: R; href: string }>(
        `var __r = (function(){ ${src} }).apply(null, arguments); ` +
          `return Promise.resolve(__r).then(function (v) { return { v: v === undefined ? null : v, href: location.href }; });`,
        arg as never,
      ),
    );
    this.noteUrl(res.href);
    return res.v;
  }

  async waitForTimeout(ms: number): Promise<void> {
    await sleep(ms);
  }

  async waitForURL(target: string | RegExp | ((u: URL) => boolean), opts: TimeoutOption = {}): Promise<void> {
    const timeout = opts.timeout ?? Defaults.navigation;
    const ok = (href: string): boolean => {
      if (typeof target === 'function') return target(new URL(href));
      if (target instanceof RegExp) return target.test(href);
      if (target.includes('*')) {
        const re = new RegExp(
          `^${target
            .split('**')
            .map((p) => p.split('*').map(escapeRe).join('[^/]*'))
            .join('.*')}$`,
        );
        return re.test(href);
      }
      return href === target || new URL(href).pathname === target;
    };
    const end = Date.now() + timeout;
    let last = '';
    while (Date.now() < end) {
      last = await this.refreshUrl().catch(() => last);
      if (last && ok(last)) return;
      await sleep(100);
    }
    throw new Error(`page.waitForURL: timeout ${timeout}ms — last url ${last}, wanted ${String(target)}`);
  }

  async waitForFunction<A>(
    fn: ((arg: A) => unknown) | string,
    arg?: A,
    opts: TimeoutOption & { polling?: number } = {},
  ): Promise<unknown> {
    const end = Date.now() + (opts.timeout ?? Defaults.navigation);
    while (Date.now() < end) {
      const v = await this.evaluate(fn as (a: A) => unknown, arg).catch(() => null);
      if (v) return v;
      await sleep(opts.polling ?? 100);
    }
    throw new Error('page.waitForFunction: timeout');
  }

  async goto(url: string): Promise<void> {
    await withWindow(this.handle, () => browser.url(url));
    await this.refreshUrl();
  }

  async reload(): Promise<void> {
    await withWindow(this.handle, () => browser.execute(() => location.reload()));
    await sleep(500);
    await this.refreshUrl().catch(() => undefined);
  }

  async title(): Promise<string> {
    return withWindow(this.handle, () => browser.getTitle());
  }

  async screenshot(opts: { path?: string; fullPage?: boolean; timeout?: number } = {}): Promise<Buffer> {
    const b64 = await withWindow(this.handle, () => browser.takeScreenshot());
    const buf = Buffer.from(b64, 'base64');
    if (opts.path) writeFileSync(opts.path, buf);
    return buf;
  }

  async bringToFront(): Promise<void> {
    await withWindow(this.handle, () => Promise.resolve(undefined));
  }

  /** Event hooks are not available over WebDriver; accepted and ignored. */
  on(_event: string, _fn: unknown): this {
    return this;
  }

  off(_event: string, _fn: unknown): this {
    return this;
  }

  context(): { pages: () => PwPage[] } {
    return { pages: () => [this] };
  }

  isClosed(): boolean {
    return false;
  }
}

/* ------------------------------------------------------------------------- *
 * Locator
 * ------------------------------------------------------------------------- */

export class PwLocator {
  constructor(
    readonly page: PwPage,
    readonly chain: Step[],
  ) {}

  private with(...steps: Step[]): PwLocator {
    return new PwLocator(this.page, [...this.chain, ...steps]);
  }

  /* --- composition --------------------------------------------------- */

  locator(selector: string | PwLocator, opts?: FilterOptions): PwLocator {
    const base =
      selector instanceof PwLocator ? this.with(...selector.chain) : this.with({ k: 'css', s: selector });
    return opts ? base.filter(opts) : base;
  }

  getByRole(role: string, opts: RoleOptions = {}): PwLocator {
    return this.with({
      k: 'role',
      role,
      name: opts.name === undefined ? undefined : ser(opts.name),
      exact: !!opts.exact,
      checked: opts.checked,
      pressed: opts.pressed,
      selected: opts.selected,
      expanded: opts.expanded,
      disabled: opts.disabled,
      includeHidden: !!opts.includeHidden,
      level: opts.level,
    });
  }

  getByText(text: TextMatch, opts: { exact?: boolean } = {}): PwLocator {
    return this.with({ k: 'text', m: ser(text), exact: !!opts.exact });
  }

  getByPlaceholder(text: TextMatch, opts: { exact?: boolean } = {}): PwLocator {
    return this.with({ k: 'placeholder', m: ser(text), exact: !!opts.exact });
  }

  getByLabel(text: TextMatch, opts: { exact?: boolean } = {}): PwLocator {
    return this.with({ k: 'label', m: ser(text), exact: !!opts.exact });
  }

  getByTestId(id: string): PwLocator {
    return this.with({ k: 'testid', s: id });
  }

  getByTitle(text: TextMatch, opts: { exact?: boolean } = {}): PwLocator {
    return this.with({ k: 'title', m: ser(text), exact: !!opts.exact });
  }

  getByAltText(text: TextMatch, opts: { exact?: boolean } = {}): PwLocator {
    return this.with({ k: 'alt', m: ser(text), exact: !!opts.exact });
  }

  filter(opts: FilterOptions): PwLocator {
    return this.with({
      k: 'filter',
      hasText: opts.hasText === undefined ? undefined : ser(opts.hasText),
      hasNotText: opts.hasNotText === undefined ? undefined : ser(opts.hasNotText),
      has: opts.has?.chain,
      hasNot: opts.hasNot?.chain,
      visible: opts.visible,
    });
  }

  first(): PwLocator {
    return this.with({ k: 'nth', i: 0 });
  }

  last(): PwLocator {
    return this.with({ k: 'nth', i: -1 });
  }

  nth(i: number): PwLocator {
    return this.with({ k: 'nth', i });
  }

  or(other: PwLocator): PwLocator {
    return this.with({ k: 'or', chain: other.chain });
  }

  and(other: PwLocator): PwLocator {
    return this.with({ k: 'and', chain: other.chain });
  }

  toString(): string {
    return `Locator(${this.page.label}: ${JSON.stringify(this.chain)})`;
  }

  /* --- resolution ---------------------------------------------------- */

  /** Elements now (no wait). */
  async resolveNow(): Promise<ElRef[]> {
    return (await this.page.query(this.chain)).els;
  }

  async count(): Promise<number> {
    return (await this.resolveNow()).length;
  }

  /** Wait for the first match satisfying the state, return its WebDriver ref. */
  private async waitEl(
    state: 'attached' | 'visible' | 'enabled' | 'editable',
    timeout: number,
  ): Promise<ElRef> {
    const end = Date.now() + timeout;
    let lastReason = 'no element matched';
    do {
      const r = await this.page.onElements<{ ok: boolean; why: string; idx: number } | null>(
        this.chain,
        `if (!els.length) return { ok: false, why: 'no element matched', idx: -1 };
         var st = arg;
         for (var i = 0; i < els.length; i++) {
           var inf = pw.info(els[i]);
           if (st === 'attached') return { ok: true, why: '', idx: i };
           if (!inf.visible) continue;
           if (st === 'visible') return { ok: true, why: '', idx: i };
           if (!inf.enabled) return { ok: false, why: 'element is disabled', idx: i };
           if (st === 'editable' && !inf.editable) return { ok: false, why: 'element is not editable', idx: i };
           return { ok: true, why: '', idx: i };
         }
         return { ok: false, why: els.length + ' element(s) matched but none is visible', idx: -1 };`,
        state,
      );
      if (r?.ok) {
        const els = await this.resolveNow();
        const ref = els[r.idx];
        if (ref) return ref;
      } else if (r) lastReason = r.why;
      await sleep(100);
    } while (Date.now() < end);
    throw new Error(`${this.toString()}: timeout ${timeout}ms waiting for ${state} — ${lastReason}`);
  }

  private async el(ref: ElRef): Promise<WebdriverIO.Element> {
    return browser.$(ref as never).getElement();
  }

  /** Retry an action on transient WebDriver errors (stale, intercepted, re-render). */
  private async act<T>(
    state: 'attached' | 'visible' | 'enabled' | 'editable',
    timeout: number | undefined,
    fn: (el: WebdriverIO.Element, ref: ElRef) => Promise<T>,
  ): Promise<T> {
    const total = timeout ?? Defaults.action;
    const end = Date.now() + total;
    let lastErr: unknown;
    for (;;) {
      const left = Math.max(200, end - Date.now());
      const ref = await this.waitEl(state, left);
      try {
        return await withWindow(this.page.handle, async () => fn(await this.el(ref), ref));
      } catch (e) {
        lastErr = e;
        const msg = String((e as Error)?.message ?? e);
        if (
          !/stale|intercept|not interactable|detached|no such element|obscured|could not be scrolled/i.test(
            msg,
          )
        )
          throw e;
        if (Date.now() > end) break;
        await sleep(120);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  /* --- actions ------------------------------------------------------- */

  async click(opts: ClickOptions = {}): Promise<void> {
    await this.act(opts.force ? 'attached' : 'enabled', opts.timeout, async (el) => {
      if (opts.trial) return;
      if (opts.force) {
        await browser.execute((e: HTMLElement) => {
          e.scrollIntoView({ block: 'center' });
          ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((t) =>
            e.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })),
          );
        }, el as never);
        return;
      }
      if (opts.position) {
        await el.scrollIntoView({ block: 'center' });
        const size = await el.getSize();
        await el.click({
          x: Math.round(opts.position.x - size.width / 2),
          y: Math.round(opts.position.y - size.height / 2),
          button: opts.button ?? 'left',
        });
      } else if (opts.button && opts.button !== 'left') {
        await el.click({ button: opts.button });
      } else {
        await el.click();
      }
      if ((opts.clickCount ?? 1) > 1) await el.doubleClick();
    });
    await this.page.refreshUrl().catch(() => undefined);
  }

  async dblclick(opts: ClickOptions = {}): Promise<void> {
    await this.act('enabled', opts.timeout, (el) => el.doubleClick());
  }

  async hover(opts: TimeoutOption = {}): Promise<void> {
    await this.act('visible', opts.timeout, (el) => el.moveTo());
  }

  async tap(opts: ClickOptions = {}): Promise<void> {
    await this.click(opts);
  }

  async focus(opts: TimeoutOption = {}): Promise<void> {
    await this.act('attached', opts.timeout, (el) =>
      browser.execute((e: HTMLElement) => e.focus(), el as never),
    );
  }

  async blur(opts: TimeoutOption = {}): Promise<void> {
    await this.act('attached', opts.timeout, (el) =>
      browser.execute((e: HTMLElement) => e.blur(), el as never),
    );
  }

  /**
   * Playwright `fill`: focus, select everything, replace with `value`. Typed as
   * real keystrokes after Ctrl+A, which the app's masked inputs (InputCurrency)
   * reduce to the same value Playwright's insertText produces.
   */
  async fill(value: string, opts: TimeoutOption & { force?: boolean } = {}): Promise<void> {
    await this.act(opts.force ? 'attached' : 'editable', opts.timeout, async (el) => {
      await browser.execute((e: HTMLElement) => {
        e.scrollIntoView({ block: 'center' });
        e.focus();
        const inp = e as HTMLInputElement;
        try {
          if (typeof inp.select === 'function') inp.select();
        } catch {
          /* not selectable */
        }
      }, el as never);
      await browser.keys([Key.Ctrl, 'a']);
      if (value === '') {
        await browser.keys([Key.Backspace]);
        return;
      }
      await browser.keys(value.split(''));
    });
  }

  async clear(opts: TimeoutOption = {}): Promise<void> {
    await this.fill('', opts);
  }

  async press(key: string, opts: TimeoutOption & { delay?: number } = {}): Promise<void> {
    await this.act('attached', opts.timeout, async (el) => {
      await browser.execute((e: HTMLElement) => e.focus(), el as never);
      await browser.keys(mapKey(key));
    });
    await this.page.refreshUrl().catch(() => undefined);
  }

  async pressSequentially(text: string, opts: TimeoutOption & { delay?: number } = {}): Promise<void> {
    await this.act('editable', opts.timeout, async (el) => {
      await browser.execute((e: HTMLElement) => e.focus(), el as never);
      for (const ch of text.split('')) {
        await browser.keys([ch]);
        if (opts.delay) await sleep(opts.delay);
      }
    });
  }

  async type(text: string, opts: TimeoutOption & { delay?: number } = {}): Promise<void> {
    await this.pressSequentially(text, opts);
  }

  async check(opts: ClickOptions = {}): Promise<void> {
    if (!(await this.isChecked())) await this.click(opts);
  }

  async uncheck(opts: ClickOptions = {}): Promise<void> {
    if (await this.isChecked()) await this.click(opts);
  }

  async setChecked(on: boolean, opts: ClickOptions = {}): Promise<void> {
    if ((await this.isChecked()) !== on) await this.click(opts);
  }

  async scrollIntoViewIfNeeded(opts: TimeoutOption = {}): Promise<void> {
    await this.act('attached', opts.timeout, (el) =>
      browser.execute((e: HTMLElement) => e.scrollIntoView({ block: 'center' }), el as never),
    );
  }

  async dispatchEvent(
    type: string,
    init: Record<string, unknown> = {},
    opts: TimeoutOption = {},
  ): Promise<void> {
    await this.act('attached', opts.timeout, (el) =>
      browser.execute(
        (e: HTMLElement, t: string, i: Record<string, unknown>) => {
          const ev = /click|mouse|pointer/.test(t)
            ? new MouseEvent(t, { bubbles: true, cancelable: true, view: window, ...i })
            : new Event(t, { bubbles: true, cancelable: true, ...i });
          e.dispatchEvent(ev);
        },
        el as never,
        type,
        init,
      ),
    );
  }

  async selectOption(value: string | string[], opts: TimeoutOption = {}): Promise<void> {
    const v = Array.isArray(value) ? value[0] : value;
    await this.act('enabled', opts.timeout, (el) => el.selectByAttribute('value', v ?? ''));
  }

  async screenshot(opts: { path?: string; timeout?: number } = {}): Promise<Buffer> {
    return this.act('visible', opts.timeout, async (el) => {
      const b64 = await browser.takeElementScreenshot(el.elementId);
      const buf = Buffer.from(b64, 'base64');
      if (opts.path) writeFileSync(opts.path, buf);
      return buf;
    });
  }

  async waitFor(
    opts: TimeoutOption & { state?: 'attached' | 'detached' | 'visible' | 'hidden' } = {},
  ): Promise<void> {
    const state = opts.state ?? 'visible';
    const timeout = opts.timeout ?? Defaults.action;
    if (state === 'attached' || state === 'visible') {
      await this.waitEl(state, timeout);
      return;
    }
    const end = Date.now() + timeout;
    do {
      const n = await this.page.onElements<number>(
        this.chain,
        state === 'detached'
          ? 'return els.length;'
          : 'return els.filter(function(e){return pw.isVisible(e);}).length;',
      );
      if (n === 0) return;
      await sleep(100);
    } while (Date.now() < end);
    throw new Error(`${this.toString()}: timeout ${timeout}ms waiting for ${state}`);
  }

  /* --- reads --------------------------------------------------------- */

  /** Read from the first match, waiting for it to exist. */
  private async read<T>(body: string, opts: TimeoutOption = {}, arg?: unknown): Promise<T> {
    await this.waitEl('attached', opts.timeout ?? Defaults.action);
    return this.page.onElements<T>(
      this.chain,
      `var el = els[0]; if (!el) throw new Error('element detached'); ${body}`,
      arg,
    );
  }

  innerText(opts: TimeoutOption = {}): Promise<string> {
    return this.read<string>('return el.innerText;', opts);
  }

  async textContent(opts: TimeoutOption = {}): Promise<string | null> {
    return this.read<string | null>('return el.textContent;', opts);
  }

  inputValue(opts: TimeoutOption = {}): Promise<string> {
    return this.read<string>("return el.value == null ? '' : String(el.value);", opts);
  }

  getAttribute(name: string, opts: TimeoutOption = {}): Promise<string | null> {
    return this.read<string | null>('return el.getAttribute(arg);', opts, name);
  }

  innerHTML(opts: TimeoutOption = {}): Promise<string> {
    return this.read<string>('return el.innerHTML;', opts);
  }

  async isVisible(): Promise<boolean> {
    return this.page.onElements<boolean>(this.chain, 'return els.length > 0 && pw.isVisible(els[0]);');
  }

  async isHidden(): Promise<boolean> {
    return !(await this.isVisible());
  }

  async isEnabled(opts: TimeoutOption = {}): Promise<boolean> {
    return this.read<boolean>('return pw.info(el).enabled;', opts);
  }

  async isDisabled(opts: TimeoutOption = {}): Promise<boolean> {
    return !(await this.isEnabled(opts));
  }

  async isEditable(opts: TimeoutOption = {}): Promise<boolean> {
    return this.read<boolean>('return pw.info(el).editable;', opts);
  }

  async isChecked(opts: TimeoutOption = {}): Promise<boolean> {
    return this.read<boolean>('return pw.info(el).checked === true;', opts);
  }

  async boundingBox(opts: TimeoutOption = {}): Promise<BoundingBox | null> {
    const n = await this.count();
    if (n === 0) {
      try {
        await this.waitEl('attached', opts.timeout ?? Defaults.action);
      } catch {
        return null;
      }
    }
    return this.page.onElements<BoundingBox | null>(
      this.chain,
      'if (!els[0]) return null; var r = els[0].getBoundingClientRect(); if (!r.width && !r.height) return null; return { x: r.x, y: r.y, width: r.width, height: r.height };',
    );
  }

  allInnerTexts(): Promise<string[]> {
    return this.page.onElements<string[]>(
      this.chain,
      'return els.map(function (e) { return e.innerText; });',
    );
  }

  allTextContents(): Promise<string[]> {
    return this.page.onElements<string[]>(
      this.chain,
      "return els.map(function (e) { return e.textContent || ''; });",
    );
  }

  async all(): Promise<PwLocator[]> {
    const n = await this.count();
    return Array.from({ length: n }, (_, i) => this.nth(i));
  }

  /** `locator.evaluate(fn, arg)` — `fn(element, arg)` runs in the page. */
  async evaluate<R, A = unknown>(
    fn: ((el: never, arg: A) => R | Promise<R>) | string,
    arg?: A,
    opts: TimeoutOption = {},
  ): Promise<R> {
    const src = typeof fn === 'string' ? fn : fn.toString();
    return this.read<R>(`return (${src})(el, arg);`, opts, arg);
  }

  async evaluateAll<R, A = unknown>(
    fn: ((els: never[], arg: A) => R | Promise<R>) | string,
    arg?: A,
  ): Promise<R> {
    const src = typeof fn === 'string' ? fn : fn.toString();
    return this.page.onElements<R>(this.chain, `return (${src})(els, arg);`, arg);
  }

  async elementHandle(): Promise<WebdriverIO.Element> {
    const ref = await this.waitEl('attached', Defaults.action);
    return withWindow(this.page.handle, () => this.el(ref));
  }
}

/* ------------------------------------------------------------------------- *
 * Keyboard / mouse
 * ------------------------------------------------------------------------- */

export class PwKeyboard {
  constructor(private readonly page: PwPage) {}

  async press(key: string, opts: { delay?: number } = {}): Promise<void> {
    await withWindow(this.page.handle, () => browser.keys(mapKey(key)));
    if (opts.delay) await sleep(opts.delay);
    await this.page.refreshUrl().catch(() => undefined);
  }

  async type(text: string, opts: { delay?: number } = {}): Promise<void> {
    for (const ch of text.split('')) {
      await withWindow(this.page.handle, () => browser.keys([ch]));
      if (opts.delay) await sleep(opts.delay);
    }
  }

  async insertText(text: string): Promise<void> {
    await withWindow(this.page.handle, () =>
      browser.execute((t: string) => document.execCommand('insertText', false, t), text),
    );
  }

  async down(key: string): Promise<void> {
    await withWindow(this.page.handle, () =>
      browser
        .action('key')
        .down(mapKey(key)[0] ?? key)
        .perform(true),
    );
  }

  async up(key: string): Promise<void> {
    await withWindow(this.page.handle, () =>
      browser
        .action('key')
        .up(mapKey(key)[0] ?? key)
        .perform(),
    );
  }
}

export class PwMouse {
  private x = 0;

  private y = 0;

  constructor(private readonly page: PwPage) {}

  async move(x: number, y: number, _opts: { steps?: number } = {}): Promise<void> {
    this.x = Math.round(x);
    this.y = Math.round(y);
    await withWindow(this.page.handle, () =>
      browser.action('pointer').move({ x: this.x, y: this.y, origin: 'viewport' }).perform(true),
    );
  }

  async down(): Promise<void> {
    await withWindow(this.page.handle, () =>
      browser.action('pointer').move({ x: this.x, y: this.y, origin: 'viewport' }).down().perform(true),
    );
  }

  async up(): Promise<void> {
    await withWindow(this.page.handle, () =>
      browser.action('pointer').move({ x: this.x, y: this.y, origin: 'viewport' }).up().perform(),
    );
  }

  async click(x: number, y: number, _opts: { delay?: number } = {}): Promise<void> {
    this.x = Math.round(x);
    this.y = Math.round(y);
    await withWindow(this.page.handle, () =>
      browser.action('pointer').move({ x: this.x, y: this.y, origin: 'viewport' }).down().up().perform(),
    );
  }

  async wheel(dx: number, dy: number): Promise<void> {
    await withWindow(this.page.handle, () =>
      browser.execute(
        (px: number, py: number, ddx: number, ddy: number) => {
          const el = document.elementFromPoint(px, py) ?? document.scrollingElement ?? document.body;
          el.dispatchEvent(
            new WheelEvent('wheel', {
              deltaX: ddx,
              deltaY: ddy,
              bubbles: true,
              cancelable: true,
              clientX: px,
              clientY: py,
            }),
          );
          let n: Element | null = el;
          while (n) {
            const s = getComputedStyle(n);
            if (
              /(auto|scroll)/.test(s.overflowY + s.overflowX) &&
              (n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth)
            ) {
              n.scrollBy(ddx, ddy);
              return;
            }
            n = n.parentElement;
          }
          window.scrollBy(ddx, ddy);
        },
        this.x,
        this.y,
        dx,
        dy,
      ),
    );
  }
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type Page = PwPage;
export type Locator = PwLocator;
