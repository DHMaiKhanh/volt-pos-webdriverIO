import { browser } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { pathOf, Routes } from '../../../constants/routes.js';
import { VQC_DOM, VQC_SKIP_KEY, VqcAppPermIds, VqcText } from '../../../constants/testids.voltqc-app-perm.js';
import { locator, type Locator } from '../../../helpers/selectors.js';
import { settle } from '../../../helpers/wait.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../support/passcodeGrant.js';
import { UiObject } from '../../../support/UiObject.js';

/**
 * Passcode-guard probe for the volt-qc APP/PERM port.
 *
 * `PasscodeDialog` (src/components/modal) is built to GET THROUGH the guard; the
 * PERM cases need to look AT it — dot counts, the disabled backspace, the inline
 * error, the skip checkbox — and to reach a gated route WITHOUT the run's
 * 30-minute grant. That is this helper. It never presses Save and never changes
 * a setting; the only state it touches is the `volt-passcode-skip` key, and
 * {@link restoreRunGrant} re-arms the run's grant afterwards.
 *
 * Navigation is a fire-and-forget `__TSR_ROUTER__.navigate` (volt-qc's
 * `navigate()`): `helpers/navigate.goTo` waits for the router to LAND, and a
 * gated route held behind the dialog — or cancelled back to `/order-pending` —
 * never lands where it was sent.
 */

export type GateResult = 'allowed' | 'denied' | 'inactive' | 'unknown' | 'invalid' | 'error';

export interface GateState {
  heading: string;
  filled: number;
  empty: number;
  backspaceDisabled: boolean | null;
  hasClose: boolean;
  /** `aria-checked` of the skip box, `null` when the box is not rendered. */
  skipChecked: boolean | null;
  skipLabelShown: boolean;
  digits: string[];
  hasSubmit: boolean;
  error: string;
}

const digitKey = (digit: string): Locator =>
  locator(
    `gate digit ${digit}`,
    `passcode-guard-dialog-button-${digit}`,
    `.//button[normalize-space(.)="${digit}"]`,
  );

export class GateProbe extends UiObject {
  readonly name = 'volt-qc gate probe';

  /* ------------------------------------------------------------------ *
   * Routing
   * ------------------------------------------------------------------ */

  /** Router navigate WITHOUT waiting for it to land (a gate holds it). */
  async routerNavigate(to: string): Promise<void> {
    await browser.execute(function (target: string) {
      const router = (window as unknown as Record<string, unknown>)['__TSR_ROUTER__'] as
        { navigate: (o: { to: string }) => unknown } | undefined;
      if (router) void router.navigate({ to: target });
    }, to);
    await settle(600);
  }

  async path(): Promise<string> {
    return pathOf(await browser.getUrl());
  }

  async searchParam(key: string): Promise<string | null> {
    return browser.execute(function (k: string) {
      return new URLSearchParams(window.location.search).get(k);
    }, key);
  }

  /** Visible text of `<main>` (textContent fallback for the WebView2 getText quirk). */
  async mainText(): Promise<string> {
    return browser.execute(function (sel: string) {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) return '';
      return (el.innerText || el.textContent || '').replace(/\s+/g, ' ');
    }, VQC_DOM.main);
  }

  async waitMainText(re: RegExp, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      if (re.test(await this.mainText())) return true;
      await settle(250);
    } while (Date.now() < deadline);
    return false;
  }

  /**
   * Drop the 30-minute grant, go to /home, then router-navigate to `route`.
   * Resolves whether the guard came up within `waitMs`.
   */
  async openGate(route: string, waitMs = 4_000): Promise<boolean> {
    await this.dismiss();
    await clearPasscodeGrant();
    if (!(await this.path()).startsWith(Routes.HOME)) {
      await this.routerNavigate(Routes.HOME);
      await browser.waitUntil(async () => (await this.path()).startsWith(Routes.HOME), {
        timeout: Timeouts.NAVIGATION,
        timeoutMsg: 'openGate(): router never reached /home',
      });
    }
    await this.routerNavigate(route);
    return this.waitOpen(waitMs);
  }

  /* ------------------------------------------------------------------ *
   * Reading the guard
   * ------------------------------------------------------------------ */

  /** Everything PERM-001..008 look at, in one in-page read; `null` when no guard is up. */
  async state(): Promise<GateState | null> {
    return browser.execute(
      function (dom: typeof VQC_DOM, skipLabel: string): GateState | null {
        const re = new RegExp(dom.gateHeadingRe);
        const shown = (el: Element): boolean => el.getClientRects().length > 0;
        const dlg = Array.from(document.querySelectorAll(dom.dialog)).find((d) => {
          const h = d.querySelector('h2');
          return !!h && re.test(h.textContent ?? '') && shown(d);
        });
        if (!dlg) return null;
        const buttons = Array.from(dlg.querySelectorAll('button'));
        const back = Array.from(dlg.querySelectorAll(dom.backspace)).pop() as HTMLButtonElement | undefined;
        const skip = dlg.querySelector(dom.skipBox);
        const errors = Array.from(dlg.querySelectorAll(dom.error))
          .map((e) => (e.textContent ?? '').trim())
          .filter(Boolean);
        return {
          heading: (dlg.querySelector('h2')?.textContent ?? '').trim(),
          filled: dlg.querySelectorAll(dom.filledDot).length,
          empty: dlg.querySelectorAll(dom.emptyDot).length,
          backspaceDisabled: back ? back.disabled || back.getAttribute('aria-disabled') === 'true' : null,
          hasClose: !!dlg.querySelector(dom.close),
          skipChecked: skip ? skip.getAttribute('aria-checked') === 'true' : null,
          skipLabelShown: (dlg.textContent ?? '').includes(skipLabel),
          digits: buttons.map((b) => (b.textContent ?? '').trim()).filter((t) => /^\d$/.test(t)),
          hasSubmit: buttons.some((b) => /^(Submit|OK)$/.test((b.textContent ?? '').trim())),
          error: errors.join(' '),
        };
      },
      VQC_DOM,
      VqcText.skipLabel,
    );
  }

  async isOpen(): Promise<boolean> {
    return (await this.state()) !== null;
  }

  async waitOpen(timeout: number = Timeouts.SHORT): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      if (await this.isOpen()) return true;
      await settle(150);
    } while (Date.now() < deadline);
    return false;
  }

  /** Wait for the guard to go away AND stay away for 500 ms (it re-renders while validating). */
  async waitClosed(timeout: number = Timeouts.SHORT): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      if (!(await this.isOpen())) {
        await settle(500);
        if (!(await this.isOpen())) return true;
      }
      await settle(150);
    } while (Date.now() < deadline);
    return false;
  }

  /** Wait until the filled-dot count reaches `n` (a press paints on the next frame). */
  async waitFilled(n: number, timeout: number = Timeouts.ANIMATION * 4): Promise<number> {
    const deadline = Date.now() + timeout;
    let last = -1;
    do {
      last = (await this.state())?.filled ?? -1;
      if (last === n) return last;
      await settle(100);
    } while (Date.now() < deadline);
    return last;
  }

  /* ------------------------------------------------------------------ *
   * Driving the guard
   * ------------------------------------------------------------------ */

  /** Press digits on the on-screen keypad, scoped to the guard. */
  async pressDigits(code: string): Promise<void> {
    const dlg = await this.find(VqcAppPermIds.gateDialog, { visible: true, timeout: Timeouts.SHORT });
    for (const d of code) {
      await this.click(digitKey(d), { within: dlg, timeout: Timeouts.SHORT });
      await settle(150);
    }
  }

  /** Type on the physical keyboard, one key at a time. */
  async typeKeys(text: string, delayMs = 80): Promise<void> {
    for (const ch of text) {
      await browser.keys([ch]);
      await settle(delayMs);
    }
  }

  async pressBackspaceKey(): Promise<void> {
    await browser.keys([Key.Backspace]);
    await settle(150);
  }

  async pressDeleteKey(): Promise<void> {
    await browser.keys([Key.Delete]);
    await settle(150);
  }

  async pressEscape(): Promise<void> {
    await browser.keys([Key.Escape]);
    await settle(300);
  }

  async clickBackspace(): Promise<void> {
    const dlg = await this.find(VqcAppPermIds.gateDialog, { visible: true });
    await this.click(VqcAppPermIds.gateBackspace, { within: dlg });
    await settle(150);
  }

  async clickClose(): Promise<void> {
    const dlg = await this.find(VqcAppPermIds.gateDialog, { visible: true });
    await this.click(VqcAppPermIds.gateClose, { within: dlg });
    await settle(300);
  }

  async tickSkip(): Promise<void> {
    const dlg = await this.find(VqcAppPermIds.gateDialog, { visible: true });
    await this.click(VqcAppPermIds.gateSkipBox, { within: dlg });
    await settle(150);
  }

  /**
   * Enter a code and classify the outcome: the guard closing = allowed, else
   * the inline red message. Never closes the guard on a rejection.
   */
  async submit(
    code: string,
    opts: { keyboard?: boolean } = {},
  ): Promise<{ result: GateResult; error: string }> {
    if (opts.keyboard) await this.typeKeys(code);
    else await this.pressDigits(code);
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const s = await this.state();
      if (s === null) {
        await settle(500);
        if (!(await this.isOpen())) return { result: 'allowed', error: '' };
        continue;
      }
      if (s.error) {
        const e = s.error;
        const result: GateResult = /permission/i.test(e)
          ? 'denied'
          : /inactive/i.test(e)
            ? 'inactive'
            : /Failed to verify/i.test(e)
              ? 'unknown'
              : /Invalid staff code/i.test(e)
                ? 'invalid'
                : 'error';
        return { result, error: e };
      }
      await settle(200);
    }
    return { result: 'error', error: 'timeout' };
  }

  /** Open `route`'s gate fresh and try `code`; `'no-gate'` when it never asked. Cancels a rejection. */
  async tryGate(route: string, code: string): Promise<GateResult | 'no-gate'> {
    if (!(await this.openGate(route))) return 'no-gate';
    const r = await this.submit(code);
    if (r.result !== 'allowed') await this.dismiss();
    return r.result;
  }

  /** Escape out of a guard that is up. */
  async dismiss(): Promise<void> {
    for (let i = 0; i < 3 && (await this.isOpen()); i += 1) await this.pressEscape();
  }

  /* ------------------------------------------------------------------ *
   * The 30-minute skip key
   * ------------------------------------------------------------------ */

  /** Raw `volt-passcode-skip` entry, parsed; `null` when absent. */
  async readSkip(): Promise<{ staffId: string; expiresAt: number } | null> {
    return browser.execute(function (k: string) {
      const raw = window.localStorage.getItem(k);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as { staffId: string; expiresAt: number };
      } catch {
        return { staffId: '?', expiresAt: 0 };
      }
    }, VQC_SKIP_KEY);
  }

  async clearSkip(): Promise<void> {
    await clearPasscodeGrant();
  }

  /** Rewrite the skip's `expiresAt` (simulate the 30 minutes running out). */
  async setSkipExpiry(expiresAt: number): Promise<void> {
    await browser.execute(
      function (k: string, t: number) {
        const raw = window.localStorage.getItem(k);
        if (!raw) return;
        const s = JSON.parse(raw) as { expiresAt: number };
        s.expiresAt = t;
        window.localStorage.setItem(k, JSON.stringify(s));
      },
      VQC_SKIP_KEY,
      expiresAt,
    );
  }

  /** Browser clock, for comparing against `expiresAt`. */
  async now(): Promise<number> {
    return browser.execute(function () {
      return Date.now();
    });
  }

  /** Tick the skip box and enter `code` at `route`'s gate. False when the gate never asked. */
  async activateSkip(route: string, code: string): Promise<boolean> {
    if (!(await this.openGate(route))) return false;
    await this.tickSkip();
    const r = await this.submit(code);
    if (r.result !== 'allowed')
      throw new Error(`Could not create a skip with the given code at ${route}: ${r.error}`);
    return true;
  }

  /** Leave no guard up and put the run's grant back (for the specs after this one). */
  async restoreRunGrant(): Promise<void> {
    await this.dismiss();
    await ensurePasscodeGrant();
  }

  /* ------------------------------------------------------------------ *
   * Watchers
   * ------------------------------------------------------------------ */

  /** Record every passcode guard that mounts from now on (read with {@link gatesSeen}). */
  async watchGates(): Promise<void> {
    await browser.execute(function (reSrc: string) {
      const w = window as unknown as Record<string, unknown>;
      w['__vqcPc'] = [];
      (w['__vqcPcObs'] as MutationObserver | undefined)?.disconnect();
      const re = new RegExp(reSrc);
      const obs = new MutationObserver(function () {
        for (const d of Array.from(document.querySelectorAll('[role=dialog]'))) {
          const el = d as unknown as Record<string, unknown>;
          if (el['__vqcPc']) continue;
          const h = (d.querySelector('h2')?.textContent ?? '').trim();
          if (re.test(h)) {
            el['__vqcPc'] = 1;
            (w['__vqcPc'] as string[]).push(h);
          }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      w['__vqcPcObs'] = obs;
    }, VQC_DOM.gateHeadingRe);
  }

  async gatesSeen(): Promise<string[]> {
    return browser.execute(function () {
      const w = window as unknown as Record<string, unknown>;
      (w['__vqcPcObs'] as MutationObserver | undefined)?.disconnect();
      return [...((w['__vqcPc'] as string[] | undefined) ?? [])];
    });
  }

  /**
   * PERM-029: count DOM mutations where the page heading (outside dialogs) is rendered
   * while no guard is up. Start before navigating; read with {@link flashCount}.
   */
  async watchHeadingFlash(headingText: string): Promise<void> {
    await browser.execute(
      function (text: string, reSrc: string) {
        const w = window as unknown as Record<string, unknown>;
        w['__vqcFlash'] = 0;
        (w['__vqcFlashObs'] as MutationObserver | undefined)?.disconnect();
        const re = new RegExp(reSrc);
        const obs = new MutationObserver(function () {
          const page = Array.from(document.querySelectorAll('h1, h2, h3')).some(
            (e) =>
              (e.textContent ?? '').trim() === text &&
              !e.closest('[role=dialog]') &&
              !e.closest('[data-sidebar]'),
          );
          const gate = Array.from(document.querySelectorAll('[role=dialog] h2')).some((e) =>
            re.test(e.textContent ?? ''),
          );
          if (page && !gate) w['__vqcFlash'] = (w['__vqcFlash'] as number) + 1;
        });
        obs.observe(document.body, { childList: true, subtree: true });
        w['__vqcFlashObs'] = obs;
      },
      headingText,
      VQC_DOM.gateHeadingRe,
    );
  }

  async flashCount(): Promise<number> {
    return browser.execute(function () {
      const w = window as unknown as Record<string, unknown>;
      (w['__vqcFlashObs'] as MutationObserver | undefined)?.disconnect();
      return (w['__vqcFlash'] as number | undefined) ?? 0;
    });
  }

  /** Is a page h1/h2/h3 (outside dialogs and the sidebar) with exactly this text on screen? */
  async mainHeadingShown(text: string): Promise<boolean> {
    return browser.execute(function (t: string) {
      return Array.from(document.querySelectorAll('h1, h2, h3')).some(
        (e) =>
          (e.textContent ?? '').trim() === t &&
          e.getClientRects().length > 0 &&
          !e.closest('[role=dialog]') &&
          !e.closest('[data-sidebar]'),
      );
    }, text);
  }

  async waitMainHeading(text: string, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      if (await this.mainHeadingShown(text)) return true;
      await settle(250);
    } while (Date.now() < deadline);
    return false;
  }
}

export const gateProbe = new GateProbe();
