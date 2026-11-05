import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { CommonIds, passcodeDigit } from '../../constants/testids.js';
import { locator } from '../../helpers/selectors.js';
import type { Locator } from '../../helpers/selectors.js';
import { capturePasscodeGrant, readPasscodeGrant, refreshGrant } from '../../support/passcodeGrant.js';
import { settle } from '../../helpers/wait.js';
import { BaseComponent } from '../BaseComponent.js';

/**
 * The permission passcode guard.
 *
 * `src/routes/_app/settings/permissions/-components/passcode-guard-dialog.tsx`
 * renders a row of dots above its own 3x4 keypad. Three properties of that
 * component shape everything below.
 *
 * 1. **There is no submit button.** An effect validates the entry 100ms after
 *    it reaches `length` (4 unless the caller overrides it), so {@link enter}
 *    types the digits and then waits for the dialog to stop prompting. Extra
 *    digits are dropped by `handleNumberClick` rather than queued, so a
 *    6-digit passcode typed into a 4-digit guard is silently truncated.
 * 2. **Whether it appears at all is merchant state.** Each gated action —
 *    refund, void, cash drawer, complete payment — first consults the staff's
 *    permissions and the "skip for the next 30 minutes" grace window. A spec
 *    that assumes the guard always shows is wrong on a till configured without
 *    it, which is why {@link enterIfPresent} is the method specs should use.
 * 3. **A wrong passcode does not close it.** The dialog clears the dots and
 *    shows an inline message instead, so "still open" is the failure signal and
 *    that message is the diagnosis.
 */

/**
 * Settle between two digit presses.
 *
 * The keys carry `active:scale-95 transition-all duration-150`, so a press
 * delivered while the previous key is still animating lands on a moving
 * target. VP-802's `waitForPasscodeDialogAndEnter()` paused 150ms for exactly
 * this and that value is proven against a running till, so it is kept.
 */
const KEY_PRESS_MS = 150;
/**
 * How long {@link PasscodeDialog.unlockForRun} looks for the guard while a
 * 30-minute grant is live. The grant names a staff id a real unlock captured, so
 * the route guard lets it through; this look is only a backstop, and each poll
 * tries two selectors, so the real cost runs ~1.5x this. 1.5s here measured
 * ~2.3s a call × ~9 calls a gated spec.
 */
const GRANTED_PROBE_MS = 500;

/**
 * One digit key.
 *
 * The declared id is taken from {@link passcodeDigit} so `npm run audit:testids`
 * keeps tracking the family it already knows, but the fallback is replaced. The
 * factory declares `[role="dialog"] //button[…]` — a single string that mixes
 * CSS with XPath, which no driver can parse — and the app on `develop` puts no
 * testid on these buttons at all: it renders `{num}` as the button's own text.
 *
 * So the working handle is that text, expressed as a RELATIVE XPath. WebdriverIO
 * routes a `./`-prefixed XPath through `findElementFromElement`, which keeps the
 * match inside the dialog; a leading `//` is evaluated from the document even
 * when the search is scoped to an element, and would happily return a digit
 * button on the screen behind the modal.
 */
const digitKey = (digit: string): Locator => {
  const declared = passcodeDigit(digit);
  return locator(declared.name, declared.testId, `.//button[normalize-space(.)="${digit}"]`);
};

/**
 * The inline rejection message.
 *
 * `text-red-500` is the only red text the dialog renders and it only exists
 * while `errorMessage` is set, which is what makes it a signal for "the passcode
 * was refused" rather than "the app was slow".
 */
const rejectionText: Locator = locator(
  'passcode error message',
  'passcode-guard-dialog-error',
  'span.text-red-500',
);

export interface PasscodeEntryOptions {
  /**
   * Tick "skip passcode for the next 30 minutes" before typing.
   *
   * The checkbox only renders when the calling screen passed `showSkipOption`,
   * so leave this unset unless the screen under test actually shows it.
   */
  skipForNext30Min?: boolean;
  /** How long to wait for the guard to appear before typing into it. */
  timeout?: number;
}

export class PasscodeDialog extends BaseComponent {
  readonly name = 'passcode guard dialog';

  protected readonly root: Locator = CommonIds.passcodeGuardDialog;

  /**
   * Is the GUARD on screen — as opposed to "some dialog is on screen"?
   *
   * Stricter than the inherited `isOpen()` on purpose. The root locator falls
   * back to `[role="dialog"]`, which every Radix dialog in this app satisfies,
   * so `isOpen()` alone answers "yes" for the receipt dialog, the gift-card scan
   * dialog and anything else that happens to be up. Probing for a digit key
   * inside that root is what separates the guard from its neighbours.
   */
  async isPrompting(timeout: number = Timeouts.SHORT): Promise<boolean> {
    // With a live 30-minute grant the guard does not mount at all — route guards
    // and inline action guards both read it — so probing the full timeout for an
    // absent dialog was 42 min of a 7-hour full run (dead-time.jsonl, 2026-10-31).
    // A dialog that IS coming shows well inside GRANTED_PROBE_MS. Gate tests clear
    // the grant before they probe, so they keep their full wait.
    const live = await readPasscodeGrant();
    const probe =
      live && live.expiresAt - Date.now() > 60_000 ? Math.min(timeout, GRANTED_PROBE_MS) : timeout;
    if (!(await this.isOpen(probe))) return false;
    return this.hasKeypad();
  }

  /**
   * Type a passcode and wait for the guard to accept it.
   *
   * Throws when the guard is still prompting afterwards, quoting the dialog's
   * own message — a rejected passcode and a hung app fail very differently and
   * the error has to say which one happened.
   */
  async enter(passcode: string, options: PasscodeEntryOptions = {}): Promise<void> {
    await this.waitOpen(options.timeout ?? Timeouts.MEDIUM);

    if (options.skipForNext30Min === true) {
      // Ticked BEFORE the digits deliberately: the dialog validates itself 100ms
      // after the last digit and hands the checkbox state to `onPasscodeEntered`
      // at that moment, so a tick arriving afterwards is read by nobody.
      await this.tap(CommonIds.passcodeSkip30Min);
    }

    for (const digit of passcode) {
      await this.tap(digitKey(digit));
      await settle(KEY_PRESS_MS);
    }

    await this.waitAccepted(passcode.length);
  }

  /**
   * Enter the passcode only if the guard actually came up.
   *
   * Resolves `false` when no passcode was required. That is the common case:
   * whether the guard appears depends on the merchant's permission settings and
   * on the 30-minute grace window, so a spec that treats the guard as
   * unconditional fails on half the tills it runs against. Call this after every
   * permission-gated click and branch on nothing.
   */
  async enterIfPresent(passcode: string, options: PasscodeEntryOptions = {}): Promise<boolean> {
    if (!(await this.isPrompting(options.timeout ?? Timeouts.SHORT))) {
      this.log.debug('no passcode required');
      return false;
    }

    await this.enter(passcode, options);
    return true;
  }

  /**
   * Unlock the guard ONCE for the whole run.
   *
   * ## What this buys
   *
   * Every gated screen — `/incomes/*`, `/settings/business`, refund, void, cash
   * drawer — puts this dialog up, and paying for it per test costs roughly 3-5s
   * each: the dialog mounts after a round trip, four keypad taps
   * {@link KEY_PRESS_MS} apart, then the dismiss. Across a regression lane that
   * is minutes spent on a dialog nothing is testing.
   *
   * The dialog's own "skip for the next 30 minutes" checkbox is the supported
   * way out, and taking it writes `volt-passcode-skip` into localStorage. This
   * method takes it and then CAPTURES that grant, so later sessions can re-seed
   * it without opening the dialog at all — see `src/support/passcodeGrant.ts`.
   *
   * ## Why it is not a bypass
   *
   * The grant stores a staff id, and `permission-protected-route.tsx` re-fetches
   * that staff and re-runs `verifyPermission` on every gated entry. A grant
   * naming a staff member who lacks the permission unlocks nothing.
   *
   * ## Safe to call anywhere
   *
   * The checkbox only renders when the calling screen passed `showSkipOption` —
   * route guards do, some inline action dialogs do not. With no checkbox this
   * still enters the passcode correctly and returns `false`.
   */
  async unlockForRun(passcode: string, options: PasscodeEntryOptions = {}): Promise<boolean> {
    // With a live grant the guard never mounts, so waiting the full SHORT probe
    // burned ~5s on EVERY gated navigation of a run. The route guard checks the
    // grant against the local DB, so a dialog that is coming shows well inside
    // GRANTED_PROBE_MS; without a grant keep the patient probe.
    const live = options.timeout === undefined ? await readPasscodeGrant() : null;
    const probe =
      options.timeout ?? (live && live.expiresAt - Date.now() > 60_000 ? GRANTED_PROBE_MS : Timeouts.SHORT);
    if (!(await this.isPrompting(probe))) {
      // Already unlocked — a grant is active, or this till has no guard at all.
      // Re-stamp from the cached staff id so a lane longer than 30 minutes does
      // not fall off the edge halfway through.
      return refreshGrant();
    }

    const hasCheckbox = await this.canSkip();
    await this.enter(passcode, { ...options, skipForNext30Min: hasCheckbox });

    if (!hasCheckbox) {
      this.log.debug('no "skip for 30 minutes" checkbox on this dialog; nothing to capture');
      return false;
    }

    const grant = await capturePasscodeGrant();
    if (grant === null) {
      this.log.warn(
        'Ticked "skip for the next 30 minutes" but the app wrote no volt-passcode-skip entry, ' +
          'so every later gated screen will prompt again. Check that volt-pos ' +
          'src/lib/passcode-skip.ts still uses that key — src/support/passcodeGrant.ts ' +
          'transcribes it and a rename there breaks this silently.',
      );
      return false;
    }
    return true;
  }

  /**
   * The guard's heading, e.g. "Enter staff code to access Quick Checkout".
   *
   * Read from the DOM rather than a testid: the dialog renders the title as a
   * plain leaf, and the screen it protects is the only part that varies. `''`
   * when no guard is up.
   */
  async promptTitle(): Promise<string> {
    const title = await browser.execute(function () {
      const re = /^(Enter staff code|Nhập mã nhân viên)/i;
      const hits = Array.prototype.filter.call(
        document.querySelectorAll('[role="dialog"] *'),
        function (e: Element) {
          const r = e.getBoundingClientRect();
          return (
            e.children.length === 0 &&
            r.width > 0 &&
            re.test(String((e as HTMLElement).innerText || '').trim())
          );
        },
      ) as HTMLElement[];
      const last = hits[hits.length - 1];
      return last ? String(last.innerText).trim() : '';
    });
    return typeof title === 'string' ? title : '';
  }

  /**
   * Type a passcode that SHOULD be refused and return the dialog's message.
   *
   * The negative twin of {@link enter}: a staff whose role lacks the gated
   * permission gets an inline "You don't have permission…" and the guard stays
   * up. Resolves `''` when the guard closed instead — i.e. the code was
   * accepted, which the caller asserts against.
   */
  async enterExpectingRefusal(passcode: string, timeout: number = Timeouts.MEDIUM): Promise<string> {
    await this.waitOpen(Timeouts.MEDIUM);
    for (const digit of passcode) {
      await this.tap(digitKey(digit));
      await settle(KEY_PRESS_MS);
    }

    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const message = await this.rejectionMessage();
      if (message) return message;
      if (!(await this.isPrompting(Timeouts.ANIMATION))) return '';
      await settle(KEY_PRESS_MS);
    }
    return this.rejectionMessage();
  }

  /**
   * Wait until a guard whose title matches `title` is up (keypad mounted).
   *
   * Stronger than {@link isPrompting} for an action that opens the guard from
   * ON TOP of another dialog (the line editor): there `isOpen()` already sees
   * the editor's `[role="dialog"]` and the single keypad probe can run before
   * the guard has mounted.
   */
  async waitForPrompt(title: RegExp, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    try {
      await browser.waitUntil(
        async () => (await this.isPrompting(Timeouts.ANIMATION)) && title.test(await this.promptTitle()),
        { timeout, interval: KEY_PRESS_MS },
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Type a passcode without judging the outcome — for a guard that is followed
   * straight away by ANOTHER guard (Quick Checkout → Sell Gift Card), where
   * {@link enter} would read the second prompt as "not accepted".
   */
  async typeCode(passcode: string): Promise<void> {
    await this.waitOpen(Timeouts.MEDIUM);
    for (const digit of passcode) {
      await this.tap(digitKey(digit));
      await settle(KEY_PRESS_MS);
    }
  }

  /** Close the guard without unlocking (Escape — the dialog's X does the same). */
  async dismiss(): Promise<void> {
    if (!(await this.isPrompting(Timeouts.ANIMATION))) return;
    await browser.keys(['Escape']);
    await browser.waitUntil(async () => !(await this.isPrompting(Timeouts.ANIMATION)), {
      timeout: Timeouts.SHORT,
      timeoutMsg: 'The passcode guard did not close on Escape',
    });
  }

  /** Does this dialog offer the 30-minute skip? Only when the caller passed `showSkipOption`. */
  async canSkip(): Promise<boolean> {
    try {
      await this.inside(CommonIds.passcodeSkip30Min, {
        timeout: Timeouts.ANIMATION,
        visible: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  /** The dialog's own error text, or `''` when it is not showing one. */
  async rejectionMessage(): Promise<string> {
    try {
      const el = await this.inside(rejectionText, { timeout: Timeouts.ANIMATION, visible: true });
      return (await el.getText()).trim();
    } catch {
      return '';
    }
  }

  /**
   * Wait for the guard to stop prompting after the last digit.
   *
   * Deliberately not the inherited `waitClosed()`: that waits on the root
   * locator, whose fallback is `[role="dialog"]`, and the normal outcome of a
   * correct passcode is that the guard closes while the action it protected
   * opens its OWN dialog (receipt, refund, cash drawer). `waitClosed()` would
   * still see a dialog and report a timeout on a flow that worked perfectly.
   */
  private async waitAccepted(digitsTyped: number): Promise<void> {
    const deadline = Date.now() + Timeouts.MEDIUM;

    while (Date.now() < deadline) {
      if (!(await this.isPrompting(Timeouts.ANIMATION))) {
        this.log.debug('passcode accepted');
        return;
      }
      await settle(KEY_PRESS_MS);
    }

    const inline = await this.rejectionMessage();
    throw new Error(
      `Passcode was not accepted: the guard is still prompting ${Timeouts.MEDIUM}ms after ` +
        `${digitsTyped} digit(s) were entered` +
        (inline ? ` — the dialog says "${inline}"` : '') +
        `. Check the staff passcode and that the staff holds the permission this action needs.`,
    );
  }

  /** Does a digit key exist inside the root we just matched? */
  private async hasKeypad(): Promise<boolean> {
    try {
      await this.inside(digitKey('1'), { timeout: Timeouts.ANIMATION, visible: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Click something inside the dialog.
   *
   * Routed through `inside()` like every other lookup here so a closed-but-still
   * mounted copy of the guard can never be the one that receives the press.
   */
  private async tap(loc: Locator, timeout: number = Timeouts.SHORT): Promise<void> {
    const el = await this.inside(loc, { timeout, visible: true });
    await el.waitForClickable({ timeout });
    this.log.debug(`press ${loc.name}`);
    await el.click();
  }
}

/**
 * Shared instance.
 *
 * The component holds no state of its own — it resolves everything against the
 * live DOM on each call — so one instance per worker is enough and specs are
 * spared constructing it.
 */
export const passcodeDialog = new PasscodeDialog();
