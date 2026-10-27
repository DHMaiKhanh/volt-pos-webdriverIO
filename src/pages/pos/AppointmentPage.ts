import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import {
  APPOINTMENT_STATUS_LABELS,
  AppointmentScreenIds as AppointmentIds,
  statusFilterItem,
  type AppointmentStatus,
} from '../../constants/testids.appointment.js';
import { goTo } from '../../helpers/navigate.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/** What a spec supplies to book an appointment. */
export interface AppointmentDraft {
  /**
   * The customer's phone. REQUIRED — the app rejects a save without it
   * (`global.appointmentCustomerRequired`), and the name is explicitly optional.
   */
  customerPhone: string;
  customerName?: string;
  /** Free text, capped at 255 characters by the app. */
  note?: string;
}

/**
 * Appointment — `/appointment`.
 *
 * ## The dialog is one component for two flows
 *
 * Create and Edit share the same form; only the heading differs
 * (`appointmentCreateTitle` / `appointmentEditTitle`). {@link AppointmentIds.dialog}
 * matches either, so a spec that edits does not need a second locator — and a
 * spec that wants to be sure which flow it is in should read the heading.
 *
 * ## Phone is the required field, not name
 *
 * The app labels the name field "Customer Name (Optional)" and validates only
 * the phone. {@link book} enforces that up front rather than letting the form's
 * own validation surface three steps later as a save that silently did nothing.
 */
export class AppointmentPage extends BasePage {
  readonly name = 'Appointment';
  readonly route = Routes.APPOINTMENT;

  /**
   * "Appointment Overview" — the heading this route renders (dump, 1.1.56). The
   * old anchor (`AppointmentIds.heading`) fell back to the text "Appointment",
   * which is also the header quick-nav link on every screen.
   */
  protected readonly readyAnchor: Locator = AppointmentIds.overviewHeading;

  async open(): Promise<this> {
    await logStep(`Open ${this.name}`);
    await goTo(this.route);
    return this.waitForReady();
  }

  /** Is the calendar showing its empty state? A real state, not a failure. */
  isEmpty(): Promise<boolean> {
    return this.isVisible(AppointmentIds.emptyState, Timeouts.SHORT);
  }

  /** How many appointment cards are on the calendar. */
  async cardCount(): Promise<number> {
    return (await this.findAll(AppointmentIds.appointmentCards, { timeout: Timeouts.SHORT })).length;
  }

  /**
   * Is there a calendar card for `customerName`?
   *
   * The correlation key for the web→app sync check: an appointment booked on the
   * GoPOS web POS should appear here once it syncs down. Matches on the card's
   * visible text (case-insensitive substring) because the calendar component
   * carries no testid per card — see {@link AppointmentIds.appointmentCards}.
   */
  async hasAppointmentFor(customerName: string): Promise<boolean> {
    const needle = customerName.trim().toLowerCase();
    const cards = await this.findAll(AppointmentIds.appointmentCards, { timeout: Timeouts.MEDIUM });
    for (const card of cards) {
      const text = (await card.getText().catch(() => '')) || '';
      if (text.toLowerCase().includes(needle)) return true;
    }
    return false;
  }

  /* --------------------------------------------------------------------- *
   * The create/edit dialog
   * --------------------------------------------------------------------- */

  async openCreateDialog(): Promise<this> {
    await logStep(`${this.name}: create`);
    await this.click(AppointmentIds.createEntry);
    await this.find(AppointmentIds.dialog, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  isDialogOpen(): Promise<boolean> {
    return this.isVisible(AppointmentIds.dialog, Timeouts.SHORT);
  }

  async closeDialog(): Promise<void> {
    if (!(await this.isDialogOpen())) return;
    await browser.keys(['Escape']);
    await this.waitGone(AppointmentIds.dialog, Timeouts.SHORT);
  }

  /** Fill the form without saving. */
  async fill(draft: AppointmentDraft): Promise<this> {
    await this.setValue(AppointmentIds.phoneSearch, draft.customerPhone);
    // The phone box is a search — it queries for a matching customer, and the
    // suggestion list has to settle before the next field takes focus or the
    // click lands on a suggestion instead.
    await settle(Timeouts.DEBOUNCE);

    if (draft.customerName !== undefined) {
      await this.setValue(AppointmentIds.customerSearch, draft.customerName);
      await settle(Timeouts.DEBOUNCE);
    }

    if (draft.note !== undefined) {
      if (draft.note.length > 255) {
        throw new Error(
          `The appointment note is ${String(draft.note.length)} characters; the app rejects ` +
            'anything over 255 (global.appointmentNoteTooLong).',
        );
      }
      await this.setValue(AppointmentIds.noteInput, draft.note);
    }

    return this;
  }

  async save(): Promise<this> {
    await this.click(AppointmentIds.saveButton);
    return this;
  }

  /**
   * Book an appointment end to end.
   *
   * Waits for the dialog to CLOSE rather than for a toast: the toast is
   * transient and a spec that misses it cannot tell a slow save from a rejected
   * one, whereas a dialog still open after the wait means the form refused.
   */
  async book(draft: AppointmentDraft): Promise<this> {
    if (draft.customerPhone.trim() === '') {
      throw new Error(
        'book() needs a customer phone: the app validates it and refuses to save without one ' +
          '(the name field is explicitly optional).',
      );
    }

    await this.openCreateDialog();
    await this.fill(draft);
    await this.save();

    try {
      await this.waitGone(AppointmentIds.dialog, Timeouts.API);
    } catch (error) {
      const validation = await this.text(AppointmentIds.customerRequiredError, {
        timeout: Timeouts.ANIMATION,
      }).catch(() => '');
      throw new Error(
        `${this.name}: the dialog is still open after saving` +
          (validation ? ` — it says "${validation}"` : '') +
          '. The appointment was not created.',
        { cause: error },
      );
    }

    return this;
  }

  /* --------------------------------------------------------------------- *
   * Overview — toolbar (build 1.1.56 dump: Now / ‹ / date / › / Staffs / Statuses / Reset)
   * --------------------------------------------------------------------- */

  /** Which overview controls are on screen. */
  async overviewToolbarVisibility(): Promise<
    Record<'heading' | 'now' | 'previousDay' | 'date' | 'nextDay' | 'staffs' | 'statuses' | 'reset', boolean>
  > {
    return {
      heading: await this.isVisible(AppointmentIds.overviewHeading, Timeouts.SHORT),
      now: await this.isVisible(AppointmentIds.nowButton, Timeouts.SHORT),
      previousDay: await this.isVisible(AppointmentIds.previousDay, Timeouts.SHORT),
      date: await this.isVisible(AppointmentIds.dateTrigger, Timeouts.SHORT),
      nextDay: await this.isVisible(AppointmentIds.nextDay, Timeouts.SHORT),
      staffs: await this.isVisible(AppointmentIds.staffsFilter, Timeouts.SHORT),
      statuses: await this.isVisible(AppointmentIds.statusesFilter, Timeouts.SHORT),
      reset: await this.isVisible(AppointmentIds.resetToDefault, Timeouts.SHORT),
    };
  }

  /**
   * The overview's state as the URL carries it: `date` (unix seconds of the
   * viewed day's local midnight), `statuses` and `staffIds` (JSON arrays —
   * TanStack serialises non-string search values as JSON).
   */
  async overviewParams(): Promise<{ date: number | null; statuses: string[]; staffIds: string[] }> {
    const url = new URL(await browser.getUrl());
    const parseList = (raw: string | null): string[] => {
      if (raw === null) return [];
      try {
        const value: unknown = JSON.parse(raw);
        return Array.isArray(value) ? value.map(String) : [];
      } catch {
        return [];
      }
    };
    const rawDate = url.searchParams.get('date');
    const date = rawDate === null ? Number.NaN : Number(rawDate.replace(/"/g, ''));
    return {
      date: Number.isNaN(date) ? null : date,
      statuses: parseList(url.searchParams.get('statuses')),
      staffIds: parseList(url.searchParams.get('staffIds')),
    };
  }

  /** The date trigger's text, e.g. `10/25/2026`. */
  dateLabel(): Promise<string> {
    return this.text(AppointmentIds.dateTrigger, { timeout: Timeouts.SHORT });
  }

  /** `Staffs 306`, whitespace-collapsed. */
  async staffsFilterLabel(): Promise<string> {
    return (await this.text(AppointmentIds.staffsFilter, { timeout: Timeouts.SHORT }))
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** `Statuses 3`, whitespace-collapsed. */
  async statusesFilterLabel(): Promise<string> {
    return (await this.text(AppointmentIds.statusesFilter, { timeout: Timeouts.SHORT }))
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Step the viewed day and wait for the date label to change. Returns the new label. */
  async stepDay(direction: 'previous' | 'next'): Promise<string> {
    const before = await this.dateLabel();
    await logStep(`${this.name}: ${direction} day`);
    await this.click(direction === 'previous' ? AppointmentIds.previousDay : AppointmentIds.nextDay);
    await browser.waitUntil(async () => (await this.dateLabel()) !== before, {
      timeout: Timeouts.MEDIUM,
      interval: 200,
      timeoutMsg: `${this.name}: the date label stayed "${before}" after pressing ${direction} day.`,
    });
    return this.dateLabel();
  }

  /** Press "Now" (back to today, scrolled to the current time). */
  async pressNow(): Promise<this> {
    await this.click(AppointmentIds.nowButton);
    await settle(Timeouts.ANIMATION);
    return this;
  }

  async pressResetToDefault(): Promise<this> {
    await this.click(AppointmentIds.resetToDefault);
    await settle(Timeouts.ANIMATION);
    return this;
  }

  /**
   * Open the Statuses (or Staffs) filter popover, read its item labels, and
   * close it with Escape. Labels come from checkbox rows; when the popover has
   * none of the expected roles, its whole text is returned as one entry.
   */
  async readFilterItems(filter: 'statuses' | 'staffs'): Promise<string[]> {
    await this.click(filter === 'statuses' ? AppointmentIds.statusesFilter : AppointmentIds.staffsFilter);
    await this.find(AppointmentIds.anyOverlay, { visible: true, timeout: Timeouts.MEDIUM });
    await settle(Timeouts.ANIMATION);

    const labels: string[] = [];
    for (const item of await this.findAll(AppointmentIds.popoverItems, { timeout: Timeouts.SHORT })) {
      let text = (await item.getText().catch(() => '')).trim();
      if (text === '') {
        // A Radix checkbox is a bare <button>; its label is the parent row's text.
        const parentText: unknown = await browser.execute(
          (el: HTMLElement) => el.parentElement?.textContent ?? '',
          item as unknown as HTMLElement,
        );
        text = typeof parentText === 'string' ? parentText.trim() : '';
      }
      if (text !== '') labels.push(text);
    }
    if (labels.length === 0)
      labels.push(await this.text(AppointmentIds.anyOverlay, { timeout: Timeouts.SHORT }));

    await browser.keys(['Escape']);
    await this.waitGone(AppointmentIds.anyOverlay, Timeouts.SHORT).catch(() => undefined);
    return labels;
  }

  /**
   * Toggle one status in the Statuses filter (open popover → click row → Escape).
   * Undo with {@link pressResetToDefault}.
   */
  async toggleStatusFilter(status: AppointmentStatus): Promise<this> {
    await logStep(`${this.name}: toggle status filter ${status}`);
    await this.click(AppointmentIds.statusesFilter);
    await this.click(statusFilterItem(status), { timeout: Timeouts.MEDIUM });
    await browser.keys(['Escape']);
    await this.waitGone(AppointmentIds.anyOverlay, Timeouts.SHORT).catch(() => undefined);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /** Is any dialog / popover / sheet open? */
  isAnyOverlayOpen(timeout: number = Timeouts.ANIMATION): Promise<boolean> {
    return this.isVisible(AppointmentIds.anyOverlay, timeout);
  }

  /* --------------------------------------------------------------------- *
   * Overview — scheduler grid (TC-UI-01, TC-UI-02, TC-OPEN-03)
   * --------------------------------------------------------------------- */

  /**
   * Does the Unassigned column body render a striped / pattern background?
   *
   * Samples the element stack a little below the column header (inside the
   * grid, where the slots are) and reports whether ANY layer there carries a
   * gradient / image background or a stripe/pattern class. VP-2355: the column
   * is always hatched like a blocked cell, though it is a valid column.
   */
  async isUnassignedColumnStriped(): Promise<{ striped: boolean; evidence: string[] }> {
    const header = await this.find(AppointmentIds.unassignedHeader, {
      visible: true,
      timeout: Timeouts.MEDIUM,
    });
    const result: unknown = await browser.execute(
      (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const evidence: string[] = [];
        for (const offset of [60, 140, 260]) {
          const y = Math.min(rect.bottom + offset, window.innerHeight - 5);
          for (const layer of document.elementsFromPoint(x, y)) {
            if (layer === document.body || layer === document.documentElement) break;
            const style = getComputedStyle(layer);
            const cls = typeof layer.className === 'string' ? layer.className : '';
            if (/gradient|url\(/.test(style.backgroundImage) || /stripe|hatch|pattern|diagonal/i.test(cls)) {
              evidence.push(
                `${layer.tagName.toLowerCase()}.${cls.slice(0, 60)} bg=${style.backgroundImage.slice(0, 60)}`,
              );
            }
          }
        }
        return evidence;
      },
      header as unknown as HTMLElement,
    );
    const evidence = Array.isArray(result) ? result.map(String) : [];
    return { striped: evidence.length > 0, evidence };
  }

  /**
   * Scroll the scheduler a LITTLE (one wheel notch) over its body.
   *
   * A real wheel action first — VP-2365 is about the wheel handler — with a
   * scrollBy on the nearest scroll container as the fallback for a driver that
   * rejects wheel actions.
   */
  async scrollGridSlightly(deltaY = 120): Promise<void> {
    const anchor = await this.find(AppointmentIds.unassignedHeader, {
      visible: true,
      timeout: Timeouts.MEDIUM,
    });
    try {
      await browser
        .action('wheel')
        .scroll({ origin: anchor, x: 0, y: 200, deltaX: 0, deltaY, duration: 150 })
        .perform();
    } catch {
      await browser.execute(
        (el: HTMLElement, dy: number) => {
          let node: HTMLElement | null = el;
          while (node && node.scrollHeight <= node.clientHeight) node = node.parentElement;
          (node ?? document.scrollingElement ?? document.body).scrollBy(0, dy);
        },
        anchor as unknown as HTMLElement,
        deltaY,
      );
    }
    await settle(Timeouts.DEBOUNCE);
  }

  /**
   * Click the FIRST slot of the day (12:00 AM) in the Unassigned column.
   *
   * Used on TODAY, where that slot is in the past (unless the run is between
   * 00:00 and 00:15 — the caller checks). Coordinates come from the column
   * header (x) and the time-row label (y), because slot cells carry no text, id
   * or testid.
   */
  async clickFirstSlotInUnassigned(): Promise<void> {
    const row = await this.find(AppointmentIds.firstSlotLabel, { timeout: Timeouts.MEDIUM });
    await row.scrollIntoView({ block: 'center' });
    await settle(Timeouts.ANIMATION);
    const column = await this.find(AppointmentIds.unassignedHeader, {
      visible: true,
      timeout: Timeouts.MEDIUM,
    });

    const x = await browser.execute(
      (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2;
      },
      column as unknown as HTMLElement,
    );
    const y = await browser.execute(
      (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      },
      row as unknown as HTMLElement,
    );

    await browser
      .action('pointer', { parameters: { pointerType: 'mouse' } })
      .move({ x: Math.round(x), y: Math.round(y), origin: 'viewport' })
      .down()
      .up()
      .perform();
    await settle(Timeouts.DEBOUNCE);
  }

  /* --------------------------------------------------------------------- *
   * Existing appointments — read-only (TC-EDIT-01..03, TC-CONFIRM-02)
   * --------------------------------------------------------------------- */

  /**
   * Find an appointment whose detail shows `status`, scanning the viewed day and
   * then up to `extraDays` following days. Leaves the matching detail OPEN and
   * returns true; returns false (detail closed) when none is found.
   *
   * READ-ONLY: it opens a card's detail and reads it — it never presses an
   * action inside it.
   */
  async openAppointmentWithStatus(status: AppointmentStatus, extraDays = 6): Promise<boolean> {
    const wanted: readonly string[] = APPOINTMENT_STATUS_LABELS[status];
    for (let day = 0; day <= extraDays; day += 1) {
      if (day > 0) await this.stepDay('next');
      const count = (await this.findAll(AppointmentIds.cards, { timeout: Timeouts.SHORT })).length;
      for (let i = 0; i < count; i += 1) {
        // Re-query each round: the scheduler re-renders on websocket count updates.
        const card = (await this.findAll(AppointmentIds.cards, { timeout: Timeouts.SHORT }))[i];
        if (!card) break;
        await card.scrollIntoView({ block: 'center' }).catch(() => undefined);
        await card.click().catch(() => undefined);
        if (!(await this.isVisible(AppointmentIds.detailPanel, Timeouts.SHORT))) continue;
        const text = await this.text(AppointmentIds.detailPanel, { timeout: Timeouts.SHORT }).catch(() => '');
        if (wanted.some((label) => text.includes(label))) return true;
        await this.closeDetail();
      }
    }
    return false;
  }

  /** Which status actions the open appointment detail offers. */
  async detailActions(): Promise<{ update: boolean; confirm: boolean; cancel: boolean }> {
    return {
      update: await this.isVisible(AppointmentIds.detailUpdate, Timeouts.SHORT),
      confirm: await this.isVisible(AppointmentIds.detailConfirm, Timeouts.SHORT),
      cancel: await this.isVisible(AppointmentIds.detailCancel, Timeouts.SHORT),
    };
  }

  /** Close whatever overlay is open (detail, popover) with Escape. */
  async closeDetail(): Promise<void> {
    if (!(await this.isAnyOverlayOpen())) return;
    await browser.keys(['Escape']);
    await this.waitGone(AppointmentIds.anyOverlay, Timeouts.SHORT).catch(() => undefined);
  }

  /* --------------------------------------------------------------------- *
   * Create/edit form — only on builds that ship it (NOT 1.1.56)
   * --------------------------------------------------------------------- */

  /** Does this build render an entry point to the create form? */
  hasCreateEntry(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(AppointmentIds.createEntry, timeout);
  }

  /** Close the form with its own Close button (TC-OPEN-08/09), not Escape. */
  async closeDialogViaButton(): Promise<void> {
    await this.click(AppointmentIds.dialogClose);
    await this.waitGone(AppointmentIds.dialog, Timeouts.MEDIUM);
  }

  /** Is Save Appointment rendered and enabled? */
  async isSaveEnabled(): Promise<boolean> {
    const save = await this.find(AppointmentIds.saveButton, { visible: true, timeout: Timeouts.SHORT });
    return save.isEnabled();
  }

  /** Type into the phone box WITHOUT clearing or blurring — focus stays in the field. */
  async typePhone(digits: string): Promise<this> {
    await this.click(AppointmentIds.phoneSearch);
    await this.addValue(AppointmentIds.phoneSearch, digits);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /** The phone box's value as rendered (the app formats it: `19` → `(19`). */
  phoneValue(): Promise<string> {
    return this.value(AppointmentIds.phoneSearch, { timeout: Timeouts.SHORT });
  }

  /** Press the phone field's clear icon. */
  async clearPhoneViaIcon(): Promise<this> {
    await this.click(AppointmentIds.phoneClear);
    await settle(Timeouts.ANIMATION);
    return this;
  }

  isPhoneDigitsErrorShown(): Promise<boolean> {
    return this.isVisible(AppointmentIds.phoneDigitsError, Timeouts.ANIMATION);
  }

  /** Replace the note — no length guard here: the specs probe the app's own cap. */
  async typeNote(text: string): Promise<this> {
    await this.setValue(AppointmentIds.noteInput, text);
    await settle(Timeouts.ANIMATION);
    return this;
  }

  noteValue(): Promise<string> {
    return this.value(AppointmentIds.noteInput, { timeout: Timeouts.SHORT });
  }

  isNoteTooLongErrorShown(): Promise<boolean> {
    return this.isVisible(AppointmentIds.noteTooLongError, Timeouts.ANIMATION);
  }

  isRepeatTagShown(): Promise<boolean> {
    return this.isVisible(AppointmentIds.repeatTag, Timeouts.SHORT);
  }
}

export default new AppointmentPage();
