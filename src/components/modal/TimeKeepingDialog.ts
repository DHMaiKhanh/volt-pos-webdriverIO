import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import {
  TimeKeepingIds,
  timeKeepingSection,
  type TimeKeepingColumn,
} from '../../constants/testids.time-keeping.js';
import { currentRoutePath, goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { BaseComponent } from '../BaseComponent.js';

export type { TimeKeepingColumn } from '../../constants/testids.time-keeping.js';

/** Search-param value that opens the dialog. */
export const TIME_KEEPING_DIALOG_PARAM = 'time-keeping';

/** `textContent` of an element, trimmed — immune to the WebView2 empty-`getText()` quirk. */
async function textContentOf(el: WebdriverIO.Element): Promise<string> {
  const raw = await el.getProperty('textContent');
  return typeof raw === 'string' ? raw.trim() : '';
}

/** One rendered staff card. */
export interface TimeKeepingCard {
  name: string;
  /** Avatar fallback letter (`''` when the staff has a photo that loaded). */
  avatarText: string;
  /** `IN` / `OUT` (`VÀO` / `RA`) — `''` on a selected card, which shows the action button instead. */
  status: string;
  /** Last check-in (IN) / check-out (OUT) time as rendered, `''` when never. */
  time: string;
  /** `disableTimeKeepingActions` — the card is inert (`pointer-events: none`). */
  disabled: boolean;
  /** The card is in its selected form (shows the Check In / Check Out button). */
  selected: boolean;
}

/**
 * Time Keeping dialog (`volt-pos/src/components/time-keeping/time-keeping.tsx`).
 *
 * Mounted app-wide in `_app.tsx`, open while `?dialog=time-keeping`. Two
 * columns — "Unavailable Staff" (clocked OUT) and "Available Staff" (clocked
 * IN) — each a virtualised 3-wide grid of cards; tapping a card turns it into a
 * "Check In" / "Check Out" button, and pressing that writes a real attendance
 * record (`time_keeping`) for the current time.
 *
 * ## Writes are real
 *
 * {@link checkIn} / {@link checkOut} change the staff's attendance on the
 * merchant. Callers must check a staff IN and OUT again in the same test (or
 * restore in an `after` hook) — this component does not do it for them, on
 * purpose: it acts, the spec decides what to undo.
 *
 * ## Virtualisation
 *
 * Only on-screen rows are in the DOM. Card lookups by name therefore filter
 * with the search box first ({@link search}), which also shrinks both columns
 * to a size whose badge can be compared with the rendered cards.
 */
export class TimeKeepingDialog extends BaseComponent {
  readonly name = 'time keeping dialog';

  protected readonly root: Locator = TimeKeepingIds.dialog;

  /* --------------------------------------------------------------------- *
   * Opening / closing
   * --------------------------------------------------------------------- */

  /** Open through the `dialog` search param (same navigation the header clock / sidebar perform). Idempotent. */
  async open(route?: string): Promise<this> {
    if (route === undefined && (await this.isOpen(Timeouts.ANIMATION))) return this;
    const path = route ?? (await currentRoutePath());
    const target = path === '' || path === '/' || path.startsWith('/login') ? Routes.HOME : path;
    await logStep(`Open Time Keeping on ${target}`);
    await goTo(target, { search: { dialog: TIME_KEEPING_DIALOG_PARAM } });
    await this.waitOpen();
    await this.waitLoaded();
    return this;
  }

  /** Press the drawer's "Time Keeping" entry. The drawer must already be open. */
  async pressSidebarEntry(): Promise<this> {
    await this.click(TimeKeepingIds.sidebarEntry);
    return this;
  }

  /** Close with the header Close button. */
  async close(): Promise<void> {
    if (!(await this.isOpen(Timeouts.ANIMATION))) return;
    await this.click(TimeKeepingIds.close, { within: await this.rootEl() });
    await this.waitClosed(Timeouts.MEDIUM);
  }

  /** Close with Escape. */
  async closeWithEscape(): Promise<void> {
    if (!(await this.isOpen(Timeouts.ANIMATION))) return;
    await browser.keys(['Escape']);
    await this.waitClosed(Timeouts.MEDIUM);
  }

  /** `dialog` search param of the current URL, or `null`. */
  async currentDialogParam(): Promise<string | null> {
    return browser.execute(function () {
      return new URLSearchParams(window.location.search).get('dialog');
    });
  }

  /* --------------------------------------------------------------------- *
   * Reading
   * --------------------------------------------------------------------- */

  /** Is the search box on screen? */
  async hasSearch(): Promise<boolean> {
    try {
      const el = await this.inside(TimeKeepingIds.search, { visible: true, timeout: Timeouts.SHORT });
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  /** The count badge of a column (counts the FILTERED list when a search is active). */
  async columnCount(column: TimeKeepingColumn): Promise<number> {
    const section = await this.section(column);
    const badge = await this.find(TimeKeepingIds.sectionBadge, { within: section, timeout: Timeouts.SHORT });
    const raw = (await badge.getText()).trim() || (await textContentOf(badge));
    const n = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }

  /** Every card currently RENDERED in a column (virtualised — see the class note). */
  async columnCards(column: TimeKeepingColumn): Promise<TimeKeepingCard[]> {
    const section = await this.section(column);
    return browser.execute(
      (el: HTMLElement) => {
        const cards = Array.from(el.querySelectorAll('[data-slot="card-content"] [data-slot="avatar"]'))
          .map((avatar) => avatar.parentElement?.parentElement ?? null)
          .filter((card): card is HTMLElement => card !== null);
        return Array.from(new Set(cards)).map((card) => {
          const head = card.children[0] as HTMLElement | undefined;
          const foot = card.children[1] as HTMLElement | undefined;
          const footSpans = foot ? Array.from(foot.querySelectorAll(':scope > span')) : [];
          return {
            name: (head?.querySelector('span')?.textContent ?? '').trim(),
            avatarText: (head?.querySelector('[data-slot="avatar"]')?.textContent ?? '').trim(),
            status: (footSpans[0]?.textContent ?? '').trim(),
            time: (footSpans[1]?.textContent ?? '').trim(),
            disabled: window.getComputedStyle(card).pointerEvents === 'none',
            selected: card.querySelector('button') !== null,
          };
        });
      },
      section as unknown as HTMLElement,
    );
  }

  /** Does the column show its "No staff found." empty state? */
  async isColumnEmpty(column: TimeKeepingColumn): Promise<boolean> {
    const section = await this.section(column);
    try {
      const el = await this.find(TimeKeepingIds.sectionEmpty, {
        within: section,
        visible: true,
        timeout: Timeouts.ANIMATION,
      });
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  /** Where a staff (exact nickname) is right now: searches for them first. `null` = in neither column. */
  async columnOf(staffName: string): Promise<TimeKeepingColumn | null> {
    await this.search(staffName);
    return this.columnOfRendered(staffName);
  }

  /** Same as {@link columnOf} but against what is rendered now — no search typed. */
  async columnOfRendered(staffName: string): Promise<TimeKeepingColumn | null> {
    if ((await this.columnCards('available')).some((c) => c.name === staffName)) return 'available';
    if ((await this.columnCards('unavailable')).some((c) => c.name === staffName)) return 'unavailable';
    return null;
  }

  /**
   * Up to `count` staff that can be checked IN right now: rendered, enabled,
   * not selected, and with a nickname that is unique among the rendered cards
   * (search is substring-based, so a duplicate name could hit the wrong card).
   */
  async checkInCandidates(count: number): Promise<string[]> {
    await this.clearSearch();
    const cards = await this.columnCards('unavailable');
    const counts = new Map<string, number>();
    for (const c of cards) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
    return cards
      .filter((c) => c.name !== '' && !c.disabled && !c.selected && counts.get(c.name) === 1)
      .map((c) => c.name)
      .slice(0, count);
  }

  /* --------------------------------------------------------------------- *
   * Actions
   * --------------------------------------------------------------------- */

  /** Type into the search box (debounced). */
  async search(term: string): Promise<this> {
    await this.setValue(TimeKeepingIds.search, term, { within: await this.rootEl() });
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  async clearSearch(): Promise<this> {
    const input = await this.inside(TimeKeepingIds.search, { visible: true });
    if (((await input.getValue()) ?? '') === '') return this;
    await input.click();
    await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', 'a']);
    await browser.keys(['Backspace']);
    if (((await input.getValue()) ?? '') !== '') await input.setValue('');
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /**
   * Tap a staff card so it reveals its action button. Searches first; a card
   * that is already selected is left alone (tapping it again would deselect it,
   * and the tap can land on the action button itself).
   */
  async selectCard(staffName: string, column: TimeKeepingColumn): Promise<this> {
    await this.search(staffName);
    const card = await this.cardElement(staffName, column);
    if (await this.hasAction(card)) return this;
    await card.click();
    await settle();
    return this;
  }

  /** The label of the action button on a selected card (`Check In` / `Check Out`), or `''`. */
  async selectedCardAction(staffName: string, column: TimeKeepingColumn): Promise<string> {
    const card = await this.cardElement(staffName, column);
    try {
      const btn = await this.find(TimeKeepingIds.cardAction, {
        within: card,
        visible: true,
        timeout: Timeouts.SHORT,
      });
      return (await btn.getText()).trim() || (await textContentOf(btn));
    } catch {
      return '';
    }
  }

  /**
   * Check a staff IN: select their card in "Unavailable", press "Check In",
   * wait until the card shows up under "Available". WRITES ATTENDANCE.
   */
  async checkIn(staffName: string): Promise<void> {
    await this.act(staffName, 'unavailable', 'available', 'Check In');
  }

  /** Check a staff OUT (the mirror of {@link checkIn}). WRITES ATTENDANCE. */
  async checkOut(staffName: string): Promise<void> {
    await this.act(staffName, 'available', 'unavailable', 'Check Out');
  }

  /* --------------------------------------------------------------------- *
   * Internals
   * --------------------------------------------------------------------- */

  private async hasAction(card: WebdriverIO.Element): Promise<boolean> {
    return browser.execute(
      (el: HTMLElement) => el.querySelector('button') !== null,
      card as unknown as HTMLElement,
    );
  }

  private async section(column: TimeKeepingColumn): Promise<WebdriverIO.Element> {
    return this.inside(timeKeepingSection(column), { visible: true, timeout: Timeouts.MEDIUM });
  }

  /** Wait until both columns have rendered something: cards, or their empty state. */
  private async waitLoaded(): Promise<void> {
    await browser
      .waitUntil(
        async () => {
          for (const column of ['unavailable', 'available'] as const) {
            const ready = (await this.columnCards(column)).length > 0 || (await this.isColumnEmpty(column));
            if (!ready) return false;
          }
          return true;
        },
        { timeout: Timeouts.MEDIUM, interval: 250 },
      )
      .catch(() => undefined);
  }

  private async cardElement(staffName: string, column: TimeKeepingColumn): Promise<WebdriverIO.Element> {
    const section = await this.section(column);
    const deadline = Date.now() + Timeouts.MEDIUM;
    do {
      const cards = await this.findAll(TimeKeepingIds.sectionCards, {
        within: section,
        timeout: Timeouts.SHORT,
      });
      for (const card of cards) {
        const name = await browser.execute(
          (el: HTMLElement) => (el.children[0]?.querySelector('span')?.textContent ?? '').trim(),
          card as unknown as HTMLElement,
        );
        if (name === staffName) return card;
      }
      await settle(250);
    } while (Date.now() < deadline);
    throw new Error(`Time Keeping: no card named "${staffName}" in the ${column} column.`);
  }

  private async act(
    staffName: string,
    from: TimeKeepingColumn,
    to: TimeKeepingColumn,
    label: 'Check In' | 'Check Out',
  ): Promise<void> {
    await logStep(`Time Keeping: ${label} ${staffName}`);
    await this.selectCard(staffName, from);
    const card = await this.cardElement(staffName, from);
    await this.click(TimeKeepingIds.cardAction, { within: card, timeout: Timeouts.SHORT });
    await browser.waitUntil(async () => (await this.columnOfRendered(staffName)) === to, {
      timeout: Timeouts.API,
      interval: 300,
      timeoutMsg: `Time Keeping: after "${label}", ${staffName} never appeared under ${to}.`,
    });
    await settle();
  }
}

export const timeKeepingDialog = new TimeKeepingDialog();
