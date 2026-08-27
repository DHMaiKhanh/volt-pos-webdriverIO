import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import { AppointmentIds } from '../../constants/testids.orders.js';
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

  protected readonly readyAnchor: Locator = AppointmentIds.heading;

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

  /* --------------------------------------------------------------------- *
   * The create/edit dialog
   * --------------------------------------------------------------------- */

  async openCreateDialog(): Promise<this> {
    await logStep(`${this.name}: create`);
    await this.click(AppointmentIds.createButton);
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
}

export default new AppointmentPage();
