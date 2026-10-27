import { $, browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import type { VqcChain, VqcQuery } from '../../../constants/testids.voltqc-pos.js';
import { settle } from '../../../helpers/wait.js';
import { UiObject } from '../../../support/UiObject.js';

/**
 * A Playwright-style role/name query engine for the specs ported from volt-qc.
 *
 * ## Why it exists
 *
 * The volt-qc suite addresses the app through Playwright locators —
 * `getByRole('tab', { name: /^Order/ })`, `filter({ hasText })`, `.last()` —
 * and build 1.1.x ships almost no `data-testid`. Rewriting each of those as a
 * hand-built XPath would be ~400 brittle strings; instead a {@link VqcQuery}
 * chain (catalogued in `src/constants/testids.voltqc-pos.ts`) is resolved by a
 * small in-page engine in ONE `execute` round trip.
 *
 * Reads (`count`, `info`, `texts`) come straight back from that round trip.
 * Clicks do NOT run in page JS: the engine stamps the hit with a one-shot
 * `data-vqc-hit` token and WebDriver clicks that element, so hit testing,
 * overlays and `pointer-events: none` behave exactly as for a cashier.
 *
 * ## The script is a STRING on purpose
 *
 * `browser.execute(fn)` serialises `fn.toString()`; under tsx/esbuild a named
 * inner helper can pick up `__name(...)` wrappers that do not exist in the
 * page. A string body is immune to the transpiler, and it installs the engine
 * once per document (`window.__vqc`).
 */

export interface VqcInfo {
  count: number;
  text: string;
  value: string;
  disabled: boolean;
  attrs: Record<string, string>;
  focused: boolean;
  inViewport: boolean;
  fullyInViewport: boolean;
  scrollFits: boolean;
  rect: { x: number; y: number; w: number; h: number };
}

const ENGINE = String.raw`
if (!window.__vqc || window.__vqc.v !== 3) {
  var norm = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
  var ROLE = {
    button: 'button,[role="button"]',
    tab: '[role="tab"]',
    tabpanel: '[role="tabpanel"]',
    textbox: 'input:not([type]),input[type="text"],input[type="search"],input[type="tel"],input[type="email"],input[type="number"],input[type="password"],textarea,[role="textbox"]',
    combobox: '[role="combobox"],select',
    checkbox: '[role="checkbox"],input[type="checkbox"]',
    switch: '[role="switch"]',
    option: '[role="option"]',
    heading: 'h1,h2,h3,h4,h5,h6,[role="heading"]',
    dialog: '[role="dialog"],[role="alertdialog"]',
    link: 'a[href],[role="link"]',
    complementary: 'aside,[role="complementary"]',
    banner: 'header,[role="banner"]',
    grid: '[role="grid"],table',
    row: '[role="row"],tr',
    columnheader: '[role="columnheader"],th'
  };
  var visible = function (el) {
    if (!el || !el.getClientRects || el.getClientRects().length === 0) return false;
    var st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
  };
  var labelFor = function (el) {
    if (!el.id) return '';
    var l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
    return l ? norm(l.textContent) : '';
  };
  var accName = function (el) {
    var a = el.getAttribute('aria-label');
    if (a) return norm(a);
    var lb = el.getAttribute('aria-labelledby');
    if (lb) {
      var t = norm(lb.split(/\s+/).map(function (id) { var x = document.getElementById(id); return x ? x.textContent : ''; }).join(' '));
      if (t) return t;
    }
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return labelFor(el) || norm(el.getAttribute('placeholder') || el.getAttribute('title') || '');
    }
    return norm(el.textContent) || labelFor(el) || norm(el.getAttribute('title'));
  };
  var match = function (el, q) {
    if (q.role === 'button') { var r = el.getAttribute('role'); if (r && r !== 'button') return false; }
    if (q.role && q.css && !el.matches(q.css)) return false;
    if (q.name !== undefined && accName(el) !== q.name) return false;
    if (q.nameRe !== undefined && !new RegExp(q.nameRe, q.flags || '').test(accName(el))) return false;
    if (q.placeholder !== undefined && el.getAttribute('placeholder') !== q.placeholder) return false;
    if (q.text !== undefined && norm(el.textContent) !== q.text) return false;
    if (q.textRe !== undefined && !new RegExp(q.textRe, q.flags || '').test(norm(el.textContent))) return false;
    if (q.hasText !== undefined && norm(el.textContent).indexOf(q.hasText) < 0) return false;
    if (q.hasTextRe !== undefined && !new RegExp(q.hasTextRe, q.flags || '').test(norm(el.textContent))) return false;
    if (q.hasCss !== undefined && !el.querySelector(q.hasCss)) return false;
    if (!q.hidden && !visible(el)) return false;
    return true;
  };
  var resolve = function (chain) {
    var list = Array.isArray(chain) ? chain : [chain];
    var roots = [document];
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      var base = q.role ? ROLE[q.role] : (q.css || '*');
      var out = [];
      for (var j = 0; j < roots.length; j++) {
        var found = roots[j].querySelectorAll(base);
        for (var k = 0; k < found.length; k++) {
          var el = found[k];
          if (out.indexOf(el) < 0 && match(el, q)) out.push(el);
        }
      }
      if (q.text !== undefined || q.textRe !== undefined) {
        out = out.filter(function (el) { return !out.some(function (o) { return o !== el && el.contains(o); }); });
      }
      if (q.nth !== undefined) {
        var n = q.nth < 0 ? out.length + q.nth : q.nth;
        out = out[n] ? [out[n]] : [];
      }
      roots = out;
    }
    return roots;
  };
  var info = function (el, count) {
    var r = el.getBoundingClientRect();
    var attrs = {};
    for (var i = 0; i < el.attributes.length; i++) attrs[el.attributes[i].name] = el.attributes[i].value;
    return {
      count: count,
      text: norm(el.innerText || el.textContent),
      value: el.value === undefined || el.value === null ? '' : String(el.value),
      disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
      attrs: attrs,
      focused: document.activeElement === el,
      inViewport: r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && r.width > 0,
      fullyInViewport: r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
      scrollFits: el.scrollWidth <= el.clientWidth + 1,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height }
    };
  };
  window.__vqc = {
    v: 3,
    count: function (chain) { return resolve(chain).length; },
    info: function (chain) { var els = resolve(chain); return els[0] ? info(els[0], els.length) : null; },
    infos: function (chain) { var els = resolve(chain); return els.map(function (el) { return info(el, els.length); }); },
    texts: function (chain) { return resolve(chain).map(function (el) { return norm(el.innerText || el.textContent); }); },
    raw: function (chain) { var el = resolve(chain)[0]; return el ? String(el.innerText || el.textContent || '') : null; },
    mark: function (chain, token) {
      var prev = document.querySelectorAll('[data-vqc-hit]');
      for (var i = 0; i < prev.length; i++) prev[i].removeAttribute('data-vqc-hit');
      var el = resolve(chain)[0];
      if (!el) return false;
      el.setAttribute('data-vqc-hit', token);
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return true;
    },
    jsClick: function (chain) { var el = resolve(chain)[0]; if (!el) return false; el.click(); return true; },
    fill: function (chain, value) {
      var el = resolve(chain)[0];
      if (!el) return null;
      el.focus();
      if (el.select) el.select();
      var ok = value === '' ? document.execCommand('delete') : document.execCommand('insertText', false, value);
      if (!ok || (value !== '' && el.value === '')) {
        var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return String(el.value);
    }
  };
}
return window.__vqc[arguments[0]].apply(null, Array.prototype.slice.call(arguments, 1));
`;

let tokenSeq = 0;

export class VoltQcProbe extends UiObject {
  readonly name = 'volt-qc probe';

  /* ------------------------------------------------------------------- *
   * Raw engine
   * ------------------------------------------------------------------- */

  private run<T>(op: string, ...args: unknown[]): Promise<T> {
    return browser.execute(ENGINE, op, ...args) as Promise<T>;
  }

  /** Number of visible hits for the chain. */
  count(chain: VqcChain): Promise<number> {
    return this.run<number>('count', chain);
  }

  async has(chain: VqcChain): Promise<boolean> {
    return (await this.count(chain)) > 0;
  }

  /** Snapshot of the first hit, or null. */
  info(chain: VqcChain): Promise<VqcInfo | null> {
    return this.run<VqcInfo | null>('info', chain);
  }

  infos(chain: VqcChain): Promise<VqcInfo[]> {
    return this.run<VqcInfo[]>('infos', chain);
  }

  /** Normalised text of every hit. */
  texts(chain: VqcChain): Promise<string[]> {
    return this.run<string[]>('texts', chain);
  }

  /** `innerText` of the first hit with line breaks kept. */
  rawText(chain: VqcChain): Promise<string | null> {
    return this.run<string | null>('raw', chain);
  }

  async textOf(chain: VqcChain): Promise<string> {
    return (await this.info(chain))?.text ?? '';
  }

  async inputValue(chain: VqcChain): Promise<string> {
    return (await this.info(chain))?.value ?? '';
  }

  async attrOf(chain: VqcChain, attr: string): Promise<string | null> {
    return (await this.info(chain))?.attrs[attr] ?? null;
  }

  async isDisabled(chain: VqcChain): Promise<boolean> {
    const i = await this.info(chain);
    if (!i) throw new Error(`isDisabled(): nothing matches ${JSON.stringify(chain)}`);
    return i.disabled;
  }

  /** Run arbitrary page JS (string body, `arguments` available). */
  exec<T>(body: string, ...args: unknown[]): Promise<T> {
    return browser.execute(body, ...args) as Promise<T>;
  }

  /* ------------------------------------------------------------------- *
   * Waiting
   * ------------------------------------------------------------------- */

  async waitFor(chain: VqcChain, timeout: number = Timeouts.MEDIUM, what = ''): Promise<void> {
    await browser.waitUntil(async () => (await this.count(chain)) > 0, {
      timeout,
      interval: 150,
      timeoutMsg: `Never appeared: ${what || JSON.stringify(chain)}`,
    });
  }

  async waitGoneQ(chain: VqcChain, timeout: number = Timeouts.MEDIUM, what = ''): Promise<void> {
    await browser.waitUntil(async () => (await this.count(chain)) === 0, {
      timeout,
      interval: 150,
      timeoutMsg: `Still present: ${what || JSON.stringify(chain)}`,
    });
  }

  /** Poll `fn` until it returns a value satisfying `ok`; returns the last value either way. */
  async poll<T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeout: number = Timeouts.MEDIUM): Promise<T> {
    const deadline = Date.now() + timeout;
    let last = await fn();
    while (!ok(last) && Date.now() < deadline) {
      await settle(250);
      last = await fn();
    }
    return last;
  }

  /* ------------------------------------------------------------------- *
   * Acting
   * ------------------------------------------------------------------- */

  /** Real WebDriver click on the first hit (waits for it to appear). */
  async clickQ(chain: VqcChain, timeout: number = Timeouts.MEDIUM): Promise<void> {
    await this.waitFor(chain, timeout);
    const token = `t${String((tokenSeq += 1))}`;
    if (!(await this.run<boolean>('mark', chain, token))) {
      throw new Error(`clickQ(): nothing matches ${JSON.stringify(chain)}`);
    }
    const el = await $(`[data-vqc-hit="${token}"]`).getElement();
    await el.click();
    await settle(150);
  }

  /** In-page `element.click()` — for elements WebDriver refuses (aria-disabled cards, zero-size triggers). */
  async jsClickQ(chain: VqcChain): Promise<void> {
    await this.waitFor(chain);
    await this.run<boolean>('jsClick', chain);
    await settle(150);
  }

  /** Playwright `fill()`: select all, insert the whole string at once. Returns the resulting value. */
  async fillQ(chain: VqcChain, value: string): Promise<string> {
    await this.waitFor(chain);
    const out = await this.run<string | null>('fill', chain, value);
    await settle(200);
    return out ?? '';
  }

  /** Focus the hit and type key by key (Playwright `pressSequentially`). */
  async typeQ(chain: VqcChain, value: string): Promise<void> {
    await this.clickQ(chain);
    await browser.keys([...value]);
    await settle(200);
  }

  async press(...keys: string[]): Promise<void> {
    await browser.keys(keys);
    await settle(200);
  }

  async escape(): Promise<void> {
    await this.press('Escape');
    await settle(150);
  }

  /** Click a viewport coordinate (CSS px). */
  async clickAt(x: number, y: number): Promise<void> {
    await browser
      .action('pointer')
      .move({ x: Math.round(x), y: Math.round(y) })
      .down()
      .up()
      .perform();
    await settle(200);
  }

  /** Mouse drag between viewport coordinates. */
  async drag(from: { x: number; y: number }, to: { x: number; y: number }, durationMs = 600): Promise<void> {
    await browser
      .action('pointer')
      .move({ x: Math.round(from.x), y: Math.round(from.y) })
      .down()
      .move({ x: Math.round(to.x), y: Math.round(to.y), duration: durationMs })
      .up()
      .perform();
    await settle(400);
  }

  /** Mouse-wheel at a viewport coordinate. */
  async wheel(x: number, y: number, deltaY: number): Promise<void> {
    await browser
      .action('wheel')
      .scroll({ x: Math.round(x), y: Math.round(y), deltaX: 0, deltaY })
      .perform();
    await settle(150);
  }

  /* ------------------------------------------------------------------- *
   * Page state
   * ------------------------------------------------------------------- */

  /** Whitespace-collapsed text of `<main>` (or `sel`). */
  async pageText(sel = 'main'): Promise<string> {
    return this.exec<string>(
      'var el = document.querySelector(arguments[0]); return el ? String(el.innerText || el.textContent || "").replace(/\\s*\\n+\\s*/g, " | ") : "";',
      sel,
    );
  }

  async path(): Promise<string> {
    return this.exec<string>('return window.location.pathname;');
  }

  /** Router search params (`window.__TSR_ROUTER__.state.location.search`). */
  async routerSearch(): Promise<Record<string, unknown>> {
    return this.exec<Record<string, unknown>>(
      'var r = window.__TSR_ROUTER__; var s = r && r.state && r.state.location ? r.state.location.search : null; return s ? JSON.parse(JSON.stringify(s)) : {};',
    );
  }

  async urlParam(name: string): Promise<string | null> {
    return this.exec<string | null>(
      'return new URLSearchParams(window.location.search).get(arguments[0]);',
      name,
    );
  }

  /**
   * Client-side navigation WITHOUT waiting on gates — the volt-qc `navigateRaw`.
   * A gated route keeps its path while the passcode guard is up, so this only
   * waits (briefly) for the path, never for the screen.
   */
  async routerGo(to: string, search?: Record<string, unknown>): Promise<void> {
    await this.exec<null>(
      'var r = window.__TSR_ROUTER__; if (!r) throw new Error("__TSR_ROUTER__ not published"); ' +
        'var o = { to: arguments[0] }; if (arguments[1]) o.search = arguments[1]; void r.navigate(o); return null;',
      to,
      search ?? null,
    );
    const target = to.split('?')[0] ?? to;
    const deadline = Date.now() + 4_000;
    while (Date.now() < deadline && !(await this.path()).startsWith(target)) await settle(80);
    await settle(400);
  }

  async localGet(key: string): Promise<string | null> {
    return this.exec<string | null>(
      'try { return localStorage.getItem(arguments[0]); } catch (e) { return null; }',
      key,
    );
  }

  async localSet(key: string, value: string | null): Promise<void> {
    await this.exec<null>(
      'try { if (arguments[1] === null) localStorage.removeItem(arguments[0]); else localStorage.setItem(arguments[0], arguments[1]); } catch (e) {} return null;',
      key,
      value,
    );
  }

  async sessionGet(key: string): Promise<string | null> {
    return this.exec<string | null>(
      'try { return sessionStorage.getItem(arguments[0]); } catch (e) { return null; }',
      key,
    );
  }

  async sessionRemove(key: string): Promise<void> {
    await this.exec<null>('try { sessionStorage.removeItem(arguments[0]); } catch (e) {} return null;', key);
  }

  async noHorizontalScroll(): Promise<boolean> {
    return this.exec<boolean>(
      'return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;',
    );
  }

  async innerWidth(): Promise<number> {
    return this.exec<number>('return window.innerWidth;');
  }

  /** Close stray toasts / popovers the way a cashier would (Escape) — never a dialog with unsaved state. */
  async closeToasts(): Promise<void> {
    await this.exec<null>(
      'var b = document.querySelectorAll("[data-sonner-toast] button[aria-label=\\"Close toast\\"]"); for (var i = 0; i < b.length; i++) b[i].click(); return null;',
    );
  }
}

export const voltQcProbe = new VoltQcProbe();

/** Shorthand used by the ported specs. */
export type { VqcQuery };
