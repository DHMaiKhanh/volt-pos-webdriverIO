import { browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import {
  CdCustomer,
  CUSTOMER_TILE_IDS,
  type CustomerTileId,
  type VqcChain,
} from '../../../constants/testids.voltqc-cd-e2e.js';
import { settle } from '../../../helpers/wait.js';
import { withCustomerWindow } from '../../../helpers/window.js';
import { parseMoney } from '../../../utils/money.js';
import { customerDisplayPage } from '../../index.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';

/**
 * The customer display (second window) for the volt-qc CD / E2E ports —
 * volt-qc `app.customer` + `src/flows/customer-display.ts`.
 *
 * Every method runs inside ONE {@link withCustomerWindow} round trip and comes
 * back to the staff window in a `finally`, so a failed read cannot strand the
 * spec on the wrong handle. Polls run INSIDE that switch (each switch walks
 * every window), which is why there are dedicated `waitX` helpers instead of
 * `browser.waitUntil(() => cust.has(...))` in the specs.
 *
 * Needs the LAUNCH lane: on the attach lane the customer webview is not a
 * WebDriver handle and `withCustomerWindow` throws with an inventory.
 */

export interface PageOverflow {
  scrollW: number;
  clientW: number;
  scrollH: number;
  clientH: number;
}

const DIGITS = /\D/g;

class CustomerScreen {
  /** Run `fn` with the session on the customer window. */
  run<T>(fn: () => Promise<T>): Promise<T> {
    return withCustomerWindow(fn);
  }

  /** Whole customer page as `a | b | c` (volt-qc `customerText`). */
  text(): Promise<string> {
    return this.run(() => P.pageText('body'));
  }

  has(chain: VqcChain): Promise<boolean> {
    return this.run(() => P.has(chain));
  }

  count(chain: VqcChain): Promise<number> {
    return this.run(() => P.count(chain));
  }

  click(chain: VqcChain, timeout: number = Timeouts.MEDIUM): Promise<void> {
    return this.run(() => P.clickQ(chain, timeout));
  }

  /** Best-effort click on a control that may be disabled / covered (Playwright `click({ force })`). */
  forceClick(chain: VqcChain): Promise<void> {
    return this.run(async () => {
      if (await P.has(chain)) await P.jsClickQ(chain).catch(() => undefined);
    });
  }

  isDisabled(chain: VqcChain): Promise<boolean> {
    return this.run(() => P.isDisabled(chain));
  }

  textOf(chain: VqcChain): Promise<string> {
    return this.run(() => P.textOf(chain));
  }

  /** Wait (inside the customer window) until `chain` matches; resolves false on timeout. */
  waitFor(chain: VqcChain, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    return this.run(() => pollIn(async () => P.has(chain), timeout));
  }

  /** Wait until `chain` matches nothing; resolves false on timeout. */
  waitGone(chain: VqcChain, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    return this.run(() => pollIn(async () => !(await P.has(chain)), timeout));
  }

  /** Wait until the page text satisfies `ok`; returns the last text read. */
  waitText(ok: (text: string) => boolean, timeout: number = Timeouts.MEDIUM): Promise<string> {
    return this.run(async () => {
      let last = '';
      await pollIn(async () => ok((last = await P.pageText('body'))), timeout);
      return last;
    });
  }

  /** Is the first hit the active element? */
  isFocused(chain: VqcChain): Promise<boolean> {
    return this.run(async () => (await P.info(chain))?.focused ?? false);
  }

  /** Focus the hit and type key by key (real keyboard events). */
  typeInto(chain: VqcChain, text: string): Promise<void> {
    return this.run(() => P.typeQ(chain, text));
  }

  /* ------------------------------ welcome ------------------------------- */

  /** On the idle "WELCOME TO <store>" screen (CSS-uppercased → case-insensitive). */
  isWelcome(): Promise<boolean> {
    return this.has(CdCustomer.welcome);
  }

  waitWelcome(timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    return this.waitFor(CdCustomer.welcome, timeout);
  }

  /** Store name under "Welcome to"; `''` when blank, `null` when not on Welcome. */
  storeName(): Promise<string | null> {
    return this.run(() => storeNameIn());
  }

  /** Poll (inside the window) for a non-empty store name — catches the ~0.5 s Welcome after a reload. */
  waitStoreName(timeout: number = Timeouts.LONG, interval = 100): Promise<string | null> {
    return this.run(async () => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const name = await storeNameIn().catch(() => null);
        if (name) return name;
        await settle(interval);
      }
      return null;
    });
  }

  /* ------------------------------- tiles -------------------------------- */

  tileOrder(): Promise<string[]> {
    return this.run(() =>
      P.exec<string[]>(
        'return Array.prototype.map.call(document.querySelectorAll(\'[data-testid^="customer-pay-by-"]\'), function (e) { return (e.getAttribute("data-testid") || "").replace("customer-pay-by-", ""); });',
      ),
    );
  }

  /** Tiles carrying the active class `bg-primary-500`, in DOM order. */
  activeTiles(): Promise<string[]> {
    return this.run(() =>
      P.exec<string[]>(
        'return Array.prototype.filter.call(document.querySelectorAll(\'[data-testid^="customer-pay-by-"]\'), function (e) { return e.classList.contains("bg-primary-500"); }).map(function (e) { return (e.getAttribute("data-testid") || "").replace("customer-pay-by-", ""); });',
      ),
    );
  }

  waitActiveTiles(want: readonly string[], timeout: number = Timeouts.MEDIUM): Promise<string[]> {
    return this.run(async () => {
      let last: string[] = [];
      await pollIn(async () => {
        last = await P.exec<string[]>(
          'return Array.prototype.filter.call(document.querySelectorAll(\'[data-testid^="customer-pay-by-"]\'), function (e) { return e.classList.contains("bg-primary-500"); }).map(function (e) { return (e.getAttribute("data-testid") || "").replace("customer-pay-by-", ""); });',
        );
        return JSON.stringify(last) === JSON.stringify(want);
      }, timeout);
      return last;
    });
  }

  /** Amount on one tile ("Cash $30.00" → 3000), NaN when the tile is missing. */
  tileCents(id: CustomerTileId): Promise<number> {
    return this.run(async () => {
      const txt = await P.textOf(CdCustomer.tile(id));
      const m = /-?\$[\d,]+\.\d{2}/.exec(txt);
      return m ? parseMoney(m[0]) : NaN;
    });
  }

  tileShown(id: CustomerTileId): Promise<boolean> {
    return this.has(CdCustomer.tile(id));
  }

  /** `disabled` of every tile, keyed by id. */
  tilesDisabled(): Promise<Record<string, boolean>> {
    return this.run(async () => {
      const out: Record<string, boolean> = {};
      for (const id of CUSTOMER_TILE_IDS) {
        const i = await P.info(CdCustomer.tile(id));
        out[id] = i?.disabled ?? false;
      }
      return out;
    });
  }

  /* ------------------------------- phone -------------------------------- */

  phoneValue(): Promise<string> {
    return this.run(() => P.inputValue(CdCustomer.phoneInput));
  }

  phoneShown(): Promise<boolean> {
    return this.has(CdCustomer.phoneInput);
  }

  /** Phone block wrapped in `opacity-50 pointer-events-none` (main in checkout / re-open). */
  phoneLocked(): Promise<boolean> {
    return this.run(() => phoneLockedIn());
  }

  waitPhoneLocked(locked: boolean, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    return this.run(() => pollIn(async () => (await phoneLockedIn()) === locked, timeout));
  }

  /** Tap keypad keys (`0-9`, `C`); `<` is the icon-only backspace two siblings after C. */
  keys(keys: string): Promise<void> {
    return this.run(async () => {
      for (const k of keys) {
        if (k === '<') await clickBackspaceIn();
        else await P.clickQ(CdCustomer.key(k));
      }
      await settle(150);
    });
  }

  /** Best-effort taps that are expected to be swallowed (locked block). */
  forceKeys(keys: string): Promise<void> {
    return this.run(async () => {
      for (const k of keys) await P.jsClickQ(CdCustomer.key(k)).catch(() => undefined);
    });
  }

  backspaceShown(): Promise<boolean> {
    return this.run(async () => (await markBackspaceIn()) !== false);
  }

  /** Customer types a phone and (by default) presses Done. Throws when the block never shows. */
  enterPhone(phone: string, opts: { done?: boolean } = {}): Promise<void> {
    return this.run(async () => {
      if (!(await pollIn(() => P.has(CdCustomer.phoneInput), Timeouts.MEDIUM))) {
        throw new Error('Customer display never showed the "Enter Customer Phone" block.');
      }
      for (const d of phone) await P.clickQ(CdCustomer.key(d));
      if (opts.done !== false) await P.clickQ(CdCustomer.done);
    });
  }

  confirm(answer: 'Yes' | 'No, enter again'): Promise<void> {
    return this.click(answer === 'Yes' ? CdCustomer.yes : CdCustomer.noEnterAgain, Timeouts.MEDIUM);
  }

  /** "Your current points" number on Check-in Successful (NaN when absent). */
  currentPoints(): Promise<number> {
    return this.run(async () => {
      const t = await P.pageText('body');
      const m = /Your current points \| ([\d,]+)/.exec(t);
      return m?.[1] ? Number(m[1].replace(DIGITS, '')) : NaN;
    });
  }

  /** "N points" under "Congrats! You've earned" (NaN when absent). */
  earnedPoints(timeout: number = Timeouts.MEDIUM): Promise<number> {
    return this.run(async () => {
      if (!(await pollIn(() => P.has(CdCustomer.earnedPoints), timeout))) return NaN;
      return Number((await P.textOf(CdCustomer.earnedPoints)).replace(DIGITS, ''));
    });
  }

  /* -------------------------------- tip --------------------------------- */

  /** "10%"-style preset labels on the tip screen (percent mode only). */
  tipPresetLabels(): Promise<string[]> {
    return this.run(async () =>
      (await P.texts({ textRe: CdCustomer.presetLabelRe })).map((s) => s.trim()).filter(Boolean),
    );
  }

  /** Is the preset tile around `label` highlighted (`bg-primary` token on its rounded-lg ancestor)? */
  presetSelected(label: string): Promise<boolean> {
    return this.run(() =>
      P.exec<boolean>(
        'var L = arguments[0]; var el = Array.prototype.find.call(document.querySelectorAll("body *"), function (e) { return e.children.length === 0 && (e.textContent || "").trim() === L; });' +
          'while (el && !(el.classList && el.classList.contains("rounded-lg"))) el = el.parentElement;' +
          'return !!el && el.classList.contains("bg-primary");',
        label,
      ),
    );
  }

  clickPreset(label: string): Promise<void> {
    return this.click({ text: label, nth: 0 });
  }

  /** `bg-primary` token on a named button (No Tip / Custom Tip highlight). */
  buttonSelected(name: string): Promise<boolean> {
    return this.run(async () => {
      const i = await P.info({ role: 'button', name, nth: 0 });
      return (i?.attrs.class ?? '').split(/\s+/).includes('bg-primary');
    });
  }

  tipAmountCents(): Promise<number> {
    return this.run(async () => moneyIn(await P.pageText('body'), CdCustomer.tipAmountRe));
  }

  tipBaseCents(): Promise<number> {
    return this.run(async () => moneyIn(await P.pageText('body'), CdCustomer.tipBaseRe));
  }

  isContinueEnabled(): Promise<boolean> {
    return this.run(async () => !(await P.isDisabled(CdCustomer.continue)));
  }

  /** Back arrow beside "Custom tip on $x" (`view-custom-tip.tsx`). */
  customTipBack(): Promise<void> {
    return this.run(async () => {
      await P.exec<null>(
        'var t = Array.prototype.find.call(document.querySelectorAll("body *"), function (e) { return /^Custom tip on \\$/.test((e.textContent || "").trim()) && e.children.length === 0; });' +
          'var s = t ? t.previousElementSibling : null; while (s && s.tagName !== "BUTTON") s = s.previousElementSibling;' +
          'if (!s && t && t.parentElement) s = t.parentElement.querySelector("button");' +
          'if (s) s.setAttribute("data-vqc-ctback", "1"); return null;',
      );
      await P.clickQ({ css: '[data-vqc-ctback="1"]' });
    });
  }

  /** Custom Tip → digits (cents) → Done; `cont` presses Continue as well. */
  customTip(cents: string, opts: { cont?: boolean } = {}): Promise<void> {
    return this.run(async () => {
      await P.clickQ(CdCustomer.customTip);
      await pollIn(() => P.has(CdCustomer.customTipTitle), Timeouts.MEDIUM);
      for (const d of cents) await P.clickQ(CdCustomer.key(d));
      await P.clickQ(CdCustomer.doneLast);
      await pollIn(async () => !(await P.has(CdCustomer.customTipTitle)), Timeouts.MEDIUM);
      if (opts.cont !== false) await P.clickQ(CdCustomer.continue);
    });
  }

  /** Pick a tip (`'none'` or a `"10%"` label) and press Continue, retrying across a re-render. */
  chooseTipAndContinue(choice: string): Promise<void> {
    return this.run(async () => {
      if (choice === 'none') await P.clickQ(CdCustomer.noTip);
      else await P.clickQ({ text: choice, nth: 0 });
      if (await customerDisplayPage.isSignaturePadShown().catch(() => false)) {
        // Already on the customer window: draw through the page object's own switch (it re-enters).
        await customerDisplayPage.sign();
      }
      for (let i = 0; i < 4; i += 1) {
        const ok = await P.clickQ(CdCustomer.continue, 2_500)
          .then(() => true)
          .catch(() => false);
        if (ok || !(await P.has(CdCustomer.addTip))) return;
      }
    });
  }

  /* ----------------------------- signature ------------------------------ */

  sign(): Promise<unknown> {
    return customerDisplayPage.sign();
  }

  canvasShown(): Promise<boolean> {
    return this.has(CdCustomer.canvas);
  }

  /* ------------------------------ layout -------------------------------- */

  overflow(): Promise<PageOverflow> {
    return this.run(() =>
      P.exec<PageOverflow>(
        'var d = document.documentElement, b = document.body; return { scrollW: Math.max(d.scrollWidth, b.scrollWidth), clientW: d.clientWidth, scrollH: Math.max(d.scrollHeight, b.scrollHeight), clientH: d.clientHeight };',
      ),
    );
  }

  /** Raw i18n keys (`global.x`, `actions.x`, `common.x`) rendered on the page. */
  rawI18nKeys(): Promise<string[]> {
    return this.run(
      async () => (await P.pageText('body')).match(/\b(global|actions|common)\.[a-zA-Z][\w.]*/g) ?? [],
    );
  }

  htmlIsDark(): Promise<boolean> {
    return this.run(() => P.exec<boolean>('return document.documentElement.classList.contains("dark");'));
  }

  /** Wait until `<html class="dark">` is (or is not) set; true when it got there. */
  waitDark(want: boolean, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    return this.run(() =>
      pollIn(
        async () =>
          (await P.exec<boolean>('return document.documentElement.classList.contains("dark");')) === want,
        timeout,
      ),
    );
  }

  /** Does the token `cls` sit on the first hit's class list? */
  hasClass(chain: VqcChain, cls: string): Promise<boolean> {
    return this.run(async () => ((await P.attrOf(chain, 'class')) ?? '').split(/\s+/).includes(cls));
  }

  /** Scroll containers holding `text`: their scroll vs client heights. */
  scrollBoxesWith(text: string): Promise<Array<{ sh: number; ch: number }>> {
    return this.run(() =>
      P.exec<Array<{ sh: number; ch: number }>>(
        'var L = arguments[0]; return Array.prototype.filter.call(document.querySelectorAll(".overflow-y-auto"), function (e) { return (e.textContent || "").indexOf(L) >= 0; }).map(function (e) { return { sh: e.scrollHeight, ch: e.clientHeight }; });',
        text,
      ),
    );
  }

  /** Scroll `text` into view, then report which of `labels` are inside the viewport. */
  inViewportAfterScroll(text: string, labels: VqcChain[]): Promise<boolean[]> {
    return this.run(async () => {
      await P.exec<null>(
        'var L = arguments[0]; var el = Array.prototype.find.call(document.querySelectorAll("body *"), function (e) { return e.children.length === 0 && (e.textContent || "").trim() === L; }); if (el) el.scrollIntoView({ block: "nearest" }); return null;',
        text,
      );
      await settle(300);
      const out: boolean[] = [];
      for (const c of labels) out.push((await P.info(c))?.inViewport ?? false);
      return out;
    });
  }

  /** Reload ONLY the customer webview (`location.reload()`), then wait for its document. */
  reloadSelf(): Promise<void> {
    return this.run(async () => {
      await P.exec<null>('setTimeout(function () { location.reload(); }, 0); return null;');
      await settle(1_500);
      await browser.waitUntil(
        async () => (await browser.execute('return document.readyState')) === 'complete',
        { timeout: Timeouts.LONG, interval: 250 },
      );
    });
  }
}

/* --------------------------- in-window helpers --------------------------- */

async function pollIn(ok: () => Promise<boolean>, timeout: number, interval = 250): Promise<boolean> {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await ok().catch(() => false)) return true;
    if (Date.now() >= deadline) return false;
    await settle(interval);
  }
}

function moneyIn(text: string, re: string): number {
  const m = new RegExp(re).exec(text);
  return m?.[1] ? parseMoney(m[1]) : NaN;
}

function storeNameIn(): Promise<string | null> {
  return P.exec<string | null>(
    'var p = Array.prototype.find.call(document.querySelectorAll("p"), function (e) { return /^welcome to$/i.test((e.textContent || "").trim()); });' +
      'if (!p) return null; var next = p.parentElement ? p.parentElement.nextElementSibling : null;' +
      'return String((next && next.innerText) || "").trim();',
  );
}

function phoneLockedIn(): Promise<boolean> {
  return P.exec<boolean>(
    'var e = document.querySelector(\'input[placeholder="Enter Customer Phone"]\');' +
      'while (e) { if (e.classList && e.classList.contains("pointer-events-none") && e.classList.contains("opacity-50")) return true; e = e.parentElement; }' +
      'return false;',
  );
}

/** Stamp the icon-only backspace (2nd button sibling after "C"); false when absent. */
function markBackspaceIn(): Promise<boolean> {
  return P.exec<boolean>(
    'var c = Array.prototype.find.call(document.querySelectorAll("button"), function (x) { return (x.textContent || "").trim() === "C" && x.getClientRects().length > 0; });' +
      'if (!c) return false; var s = c.nextElementSibling; var n = 0;' +
      'while (s) { if (s.tagName === "BUTTON") { n += 1; if (n === 2) { s.setAttribute("data-vqc-bksp", "1"); return true; } } s = s.nextElementSibling; }' +
      'return false;',
  );
}

async function clickBackspaceIn(): Promise<void> {
  if (!(await markBackspaceIn()))
    throw new Error('Customer keypad backspace (the button after "0") not found.');
  await P.clickQ({ css: '[data-vqc-bksp="1"]' });
}

export const cust = new CustomerScreen();
export type { CustomerScreen };
