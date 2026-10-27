import { $, browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { pathOf } from '../../../constants/routes.js';
import { VQ_MARK_ATTR, type VqQuery } from '../../../constants/testids.voltqc-settings-devm.js';
import { settle } from '../../../helpers/wait.js';
import { UiObject } from '../../../support/UiObject.js';

/** What {@link VqProbe.read} reports about one resolved element. */
export interface VqState {
  found: boolean;
  /** Normalized textContent (falls back to aria-label). */
  text: string;
  /** `.value` of an input / textarea / select, else `''`. */
  value: string;
  /** Radix `aria-checked="true"` / `data-state="checked|on"`, or a native `.checked`. */
  checked: boolean;
  /** Native `disabled`, `aria-disabled="true"` or Radix `data-disabled`. */
  disabled: boolean;
  /** Does it have keyboard focus? */
  focused: boolean;
  /** Computed `pointer-events`. */
  pointerEvents: string;
  placeholder: string;
  /** The attribute named in the call, or `null`. */
  attr: string | null;
}

/**
 * Resolve a {@link VqQuery} in the page and run one operation on the match.
 *
 * Runs inside the WebView (serialized by `browser.execute`), so it must be
 * self-contained — no closures over module scope.
 */
function vqPageOp(query: VqQuery, op: string, arg: string, markAttr: string): unknown {
  const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const shown = (el: Element): boolean => {
    if (el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };
  const textOf = (el: Element): string => norm(el.textContent) || norm(el.getAttribute('aria-label'));
  const textMatches = (el: Element): boolean => {
    if (query.text === undefined) return true;
    const own = textOf(el);
    const aria = norm(el.getAttribute('aria-label'));
    const wanted = query.text;
    if (query.match === 'contains') return own.includes(wanted) || aria.includes(wanted);
    if (query.match === 'regex') {
      const re = new RegExp(wanted);
      return re.test(own) || re.test(aria);
    }
    return own === wanted || aria === wanted;
  };
  const okVisible = (el: Element): boolean => query.hidden === true || shown(el);

  // Scopes, smallest first: the innermost container holding the title wins.
  let scopes: Element[] = [document.documentElement];
  if (query.within !== undefined) {
    const within = query.within;
    if (query.withinText === undefined) {
      scopes = Array.from(document.querySelectorAll(within)).filter(okVisible);
    } else {
      // Walk up from each visible title node, collecting the containers that hold it.
      const title = query.withinText;
      const set = new Set<Element>();
      for (const node of Array.from(document.querySelectorAll('body *'))) {
        if (norm(node.textContent) !== title || !shown(node)) continue;
        for (let box: Element | null = node; box; box = box.parentElement) {
          if (box.matches(within) && okVisible(box)) set.add(box);
        }
      }
      scopes = Array.from(set);
    }
    scopes.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
  }

  let found: Element[] = [];
  for (const scope of scopes) {
    let candidates: Element[];
    if (query.label !== undefined) {
      candidates = [];
      for (const label of Array.from(scope.querySelectorAll('label'))) {
        if (norm(label.textContent) !== query.label) continue;
        let target: Element | null = null;
        const forId = label.getAttribute('for');
        if (forId) target = document.getElementById(forId);
        if (!target || (query.css !== '' && !target.matches(query.css))) {
          const box = label.closest('[data-slot="form-item"], [data-slot="field"]') ?? label.parentElement;
          target =
            box?.querySelector(
              query.css !== ''
                ? query.css
                : 'input, textarea, button[role="combobox"], [role="switch"], [role="checkbox"]',
            ) ?? null;
        }
        if (target) candidates.push(target);
      }
    } else {
      candidates = Array.from(scope.querySelectorAll(query.css));
      if (scope.matches(query.css)) candidates.unshift(scope);
    }
    const hits = candidates.filter((el) => okVisible(el) && textMatches(el));
    // Innermost only: drop a hit that merely wraps another hit.
    const innermost = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
    if (innermost.length > 0) {
      found = innermost;
      break;
    }
  }

  if (query.up !== undefined && found.length > 0) {
    const up = query.up;
    const climbed: Element[] = [];
    for (const base of found) {
      let box: Element | null = base.parentElement;
      for (let i = 0; i < 8 && box && !box.querySelector(up.until); i += 1) box = box.parentElement;
      if (!box) continue;
      const list = Array.from(box.querySelectorAll(up.css)).filter(
        (el) => el !== base && okVisible(el) && (up.text === undefined || textOf(el) === up.text),
      );
      if (up.nth === undefined) {
        for (const el of list) if (!climbed.includes(el)) climbed.push(el);
        continue;
      }
      const pick = list[up.nth < 0 ? list.length + up.nth : up.nth];
      if (pick) climbed.push(pick);
    }
    found = climbed;
  }

  if (op === 'count') return found.length;
  if (op === 'texts') return found.map(textOf);

  const el = found[query.nth ?? 0];
  if (op === 'mark') {
    if (!el) return false;
    el.setAttribute(markAttr, arg);
    return true;
  }
  if (op === 'read') {
    if (!el) {
      return {
        found: false,
        text: '',
        value: '',
        checked: false,
        disabled: false,
        focused: false,
        pointerEvents: '',
        placeholder: '',
        attr: null,
      };
    }
    const input = el as HTMLInputElement;
    const state = el.getAttribute('data-state');
    return {
      found: true,
      text: textOf(el),
      value: typeof input.value === 'string' ? input.value : '',
      checked:
        el.getAttribute('aria-checked') === 'true' ||
        state === 'checked' ||
        state === 'on' ||
        (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') && el.checked),
      disabled:
        input.disabled === true ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.hasAttribute('data-disabled'),
      focused: document.activeElement === el,
      pointerEvents: window.getComputedStyle(el).pointerEvents,
      placeholder: el.getAttribute('placeholder') ?? '',
      attr: arg !== '' ? el.getAttribute(arg) : null,
    };
  }
  if (op === 'formMessage') {
    if (!el) return '';
    const box = el.closest('[data-slot="form-item"], [data-slot="field"]');
    const message = box?.querySelector('[data-slot="form-message"], [data-slot="field-error"]');
    return message && shown(message) ? norm(message.textContent) : '';
  }
  if (op === 'setNative') {
    if (!el) return null;
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    // The prototype setter, not `el.value =`: React tracks the last value it set and ignores a plain assignment.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, arg);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return (el as HTMLInputElement).value;
  }
  if (op === 'scroll') {
    // Scroll the match's nearest scrollable ancestor (a virtualised list). Returns whether it moved.
    let box: HTMLElement | null = el instanceof HTMLElement ? el : null;
    while (
      box &&
      !(box.scrollHeight > box.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(box).overflowY))
    ) {
      box = box.parentElement;
    }
    if (!box) return false;
    const before = box.scrollTop;
    if (arg === 'top') box.scrollTop = 0;
    else if (arg === 'bottom') box.scrollTop = box.scrollHeight;
    else box.scrollTop += Math.max(100, box.clientHeight / 2);
    return box.scrollTop !== before;
  }
  if (op === 'textAround') {
    // Climb from the match until an ancestor's text matches `arg` (a RegExp source).
    let box: Element | null = el ?? null;
    const re = new RegExp(arg);
    for (let i = 0; i < 8 && box; i += 1) {
      if (re.test(norm(box.textContent))) return norm(box.textContent);
      box = box.parentElement;
    }
    return el ? norm(el.textContent) : '';
  }
  return null;
}

let markSeq = 0;

/**
 * In-page resolver for the volt-qc Settings / DEVM port.
 *
 * Build 1.1.x ships the Settings screens with almost no `data-testid`, so the
 * port reaches controls the way the volt-qc Playwright suite did — role, exact
 * label, DOM id, scoped to the card that holds a title — but resolves them in
 * ONE `browser.execute` round trip and only among VISIBLE nodes (Radix keeps
 * closed dialogs and a `display:none` Products panel mounted, so a plain
 * first-match XPath is the wrong element half the time).
 *
 * Reads go through the DOM (`textContent`, never `getText()` — see the
 * WebView2 152 quirk in `UiObject.text()`); actions stamp the match with a
 * one-off attribute and then click / type through real WebDriver input so
 * React's handlers run exactly as for a tap.
 *
 * Every method is a primitive; the specs in
 * `tests/regression/volt-qc/settings-devm/` compose them with queries from
 * `src/constants/testids.voltqc-settings-devm.ts`. Nothing here saves.
 */
export class VqProbe extends UiObject {
  async path(): Promise<string> {
    return pathOf(await browser.getUrl());
  }

  /** How many visible elements match. */
  async count(query: VqQuery): Promise<number> {
    return (await browser.execute(vqPageOp, query, 'count', '', VQ_MARK_ATTR)) as number;
  }

  /** Normalized text of every match. */
  async texts(query: VqQuery): Promise<string[]> {
    return (await browser.execute(vqPageOp, query, 'texts', '', VQ_MARK_ATTR)) as string[];
  }

  /** State of the first match (or the `nth`). `attr` reads one attribute. */
  async read(query: VqQuery, attr = ''): Promise<VqState> {
    return (await browser.execute(vqPageOp, query, 'read', attr, VQ_MARK_ATTR)) as VqState;
  }

  async isChecked(query: VqQuery): Promise<boolean> {
    return (await this.read(query)).checked;
  }

  async isDisabled(query: VqQuery): Promise<boolean> {
    return (await this.read(query)).disabled;
  }

  async inputValue(query: VqQuery): Promise<string> {
    return (await this.read(query)).value;
  }

  async textOf(query: VqQuery): Promise<string> {
    return (await this.read(query)).text;
  }

  /** The text of the first ancestor of the match whose text matches `source`. */
  async textAround(query: VqQuery, source: string): Promise<string> {
    return (await browser.execute(vqPageOp, query, 'textAround', source, VQ_MARK_ATTR)) as string;
  }

  /** The validation message of the form field holding the match, `''` when none. */
  async fieldMessage(query: VqQuery): Promise<string> {
    return (await browser.execute(vqPageOp, query, 'formMessage', '', VQ_MARK_ATTR)) as string;
  }

  /** Poll until at least one match is visible. */
  async isShown(query: VqQuery, timeout: number = Timeouts.SHORT): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      if ((await this.count(query)) > 0) return true;
      await settle(150);
    } while (Date.now() < deadline);
    return false;
  }

  /** Poll until nothing matches. Returns false when it is still there. */
  async isGone(query: VqQuery, timeout: number = Timeouts.SHORT): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      if ((await this.count(query)) === 0) return true;
      await settle(150);
    } while (Date.now() < deadline);
    return false;
  }

  async waitShown(query: VqQuery, timeout: number = Timeouts.MEDIUM): Promise<void> {
    if (!(await this.isShown(query, timeout))) {
      throw new Error(`"${query.name}" never became visible within ${String(timeout)}ms.`);
    }
  }

  /** Poll a reader until it returns `expected` (or the timeout); returns the last value. */
  async poll<T>(read: () => Promise<T>, expected: T, timeout: number = Timeouts.SHORT): Promise<T> {
    const deadline = Date.now() + timeout;
    let last = await read();
    while (last !== expected && Date.now() < deadline) {
      await settle(150);
      last = await read();
    }
    return last;
  }

  /** Click the first visible match through a real WebDriver click. */
  async press(query: VqQuery, timeout: number = Timeouts.MEDIUM): Promise<void> {
    const el = await this.marked(query, timeout);
    await el.waitForClickable({ timeout: Timeouts.SHORT }).catch(() => undefined);
    this.log.debug(`press ${query.name}`);
    await el.click();
    await settle(250);
  }

  /** Press only when the switch / checkbox is not already in `on` state. */
  async setChecked(query: VqQuery, on: boolean): Promise<void> {
    if ((await this.isChecked(query)) === on) return;
    await this.press(query);
    await this.poll(() => this.isChecked(query), on);
  }

  /** Replace a text field's content with keystrokes (select-all, delete, type). */
  async fill(query: VqQuery, value: string, timeout: number = Timeouts.MEDIUM): Promise<void> {
    const el = await this.marked(query, timeout);
    await el.click();
    await browser.keys(['Control', 'a']);
    await browser.keys(['Control']);
    await browser.keys(['Backspace']);
    if (value !== '') await el.addValue(value);
    await settle(300);
  }

  /**
   * Set an input's value the way React's own change path does (native setter +
   * `input`/`change` events). For `type="time"` pickers, which take no
   * keystrokes in a predictable format across WebView2 locales.
   */
  async setNative(query: VqQuery, value: string): Promise<string | null> {
    const out = (await browser.execute(vqPageOp, query, 'setNative', value, VQ_MARK_ATTR)) as string | null;
    await settle(300);
    return out;
  }

  /** Scroll the virtualised list holding the match: to the top, the bottom, or one half-page step. */
  async scroll(query: VqQuery, to: 'top' | 'bottom' | 'step'): Promise<boolean> {
    const moved = (await browser.execute(vqPageOp, query, 'scroll', to, VQ_MARK_ATTR)) as boolean;
    await settle(250);
    return moved;
  }

  async pressKey(key: string): Promise<void> {
    await browser.keys([key]);
    await settle(300);
  }

  /** Visible text of the whole page body (for "no Logout anywhere" style checks). */
  async bodyText(): Promise<string> {
    return browser.execute(() =>
      (document.body.innerText || document.body.textContent || '').replace(/\s+/g, ' '),
    );
  }

  /** Mark the match with a one-off attribute and hand back the WebDriver element. */
  private async marked(query: VqQuery, timeout: number): Promise<WebdriverIO.Element> {
    markSeq += 1;
    const token = `${String(Date.now())}-${String(markSeq)}`;
    const deadline = Date.now() + timeout;
    do {
      if ((await browser.execute(vqPageOp, query, 'mark', token, VQ_MARK_ATTR)) === true) {
        return $(`[${VQ_MARK_ATTR}="${token}"]`).getElement();
      }
      await settle(150);
    } while (Date.now() < deadline);
    throw new Error(`Could not find a visible "${query.name}" within ${String(timeout)}ms.`);
  }
}

export const vqProbe = new VqProbe();
