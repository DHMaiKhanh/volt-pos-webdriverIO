import { Timeouts } from '../../../configs/constants/timeouts.js';
import { byRole, locator } from '../../helpers/selectors.js';
import type { Locator } from '../../helpers/selectors.js';
import { BaseComponent } from '../BaseComponent.js';

/**
 * The generic Radix **alert**-dialog: a title, a message, cancel and confirm.
 *
 * `src/components/ui/alert-dialog.tsx` is the single shell behind the destructive
 * confirmations in this app — cancel order, re-open order, refund, void a split
 * check — so one wrapper covers all of them. Point it at a specific dialog when
 * you have an id for it:
 *
 * ```ts
 * const cancelOrder = new ConfirmDialog(OrderHistoryDetailIds.cancelDialog, 'cancel order dialog');
 * await cancelOrder.confirm();
 * ```
 *
 * Two facts about that shell drive the locators below.
 *
 * - `AlertDialogAction` and `AlertDialogCancel` are the only parts that get **no**
 *   `data-slot`: they render the Radix primitive with `buttonVariants()` classes
 *   applied directly, so `bg-destructive` (action) and `bg-muted` (cancel) are
 *   their only intrinsic handles. Position inside `[data-slot="alert-dialog-footer"]`
 *   is the stronger one and is what `src/constants/testids.ts` already uses for
 *   the cancel-order and re-open confirmations, so it is tried first.
 * - `AlertDialogFooter` accepts `orientation="vertical"`. A vertical footer stacks
 *   its buttons, and nothing guarantees the primary is still last, so a dialog
 *   built that way needs its own testid rather than the positional fallback.
 *
 * Dialogs built on the plain `Dialog` primitive (`role="dialog"`) are NOT this —
 * the receipt, split-tip and gift-card dialogs have their own page-object methods.
 */

/**
 * Fallback root.
 *
 * `alertdialog` is the role Radix puts on `AlertDialogContent`, so it matches
 * whichever destructive confirmation is currently up. That is the point of the
 * default instance and also its limit: with two alert dialogs stacked, the first
 * in document order wins. Pass a root with a real testid when the flow can stack.
 */
const DEFAULT_ROOT: Locator = locator(
  'confirm dialog',
  'confirm-dialog',
  byRole('alertdialog'),
  '[data-slot="alert-dialog-content"]',
);

const confirmButton: Locator = locator(
  'confirm button',
  'confirm-dialog-confirm-btn',
  '[data-slot="alert-dialog-footer"] button:last-of-type',
  'button.bg-destructive',
);

const cancelButton: Locator = locator(
  'cancel button',
  'confirm-dialog-cancel-btn',
  '[data-slot="alert-dialog-footer"] button:first-of-type',
  'button.bg-muted',
);

const titleText: Locator = locator(
  'confirm dialog title',
  'confirm-dialog-title',
  '[data-slot="alert-dialog-title"]',
);

const messageText: Locator = locator(
  'confirm dialog message',
  'confirm-dialog-message',
  '[data-slot="alert-dialog-description"]',
);

export interface ConfirmDialogOptions {
  /**
   * Wait for the dialog to disappear after the press (default `true`).
   *
   * Set it to `false` for a confirmation that keeps the dialog open on failure —
   * a rejected refund, a validation error — so the spec can read the message
   * instead of drowning in a timeout from the wrong layer.
   */
  waitClosed?: boolean;
  timeout?: number;
}

export class ConfirmDialog extends BaseComponent {
  readonly name: string;

  protected readonly root: Locator;

  constructor(root: Locator = DEFAULT_ROOT, name?: string) {
    super();
    this.root = root;
    this.name = name ?? root.name;
  }

  /** Press the primary (destructive) action. */
  async confirm(options: ConfirmDialogOptions = {}): Promise<void> {
    await this.press(confirmButton, options);
  }

  /** Press the dismissive action. Radix always closes the dialog on this one. */
  async cancel(options: ConfirmDialogOptions = {}): Promise<void> {
    await this.press(cancelButton, options);
  }

  /** The dialog's body copy. Translated by i18next — assert on it only when the run's language is known. */
  async message(): Promise<string> {
    const el = await this.inside(messageText, { timeout: Timeouts.SHORT });
    return (await el.getText()).trim();
  }

  /** The dialog's heading. Same i18n caveat as {@link message}. */
  async title(): Promise<string> {
    const el = await this.inside(titleText, { timeout: Timeouts.SHORT });
    return (await el.getText()).trim();
  }

  private async press(loc: Locator, options: ConfirmDialogOptions): Promise<void> {
    const timeout = options.timeout ?? Timeouts.MEDIUM;
    const el = await this.inside(loc, { timeout, visible: true });
    await el.waitForClickable({ timeout });
    this.log.debug(`press ${loc.name}`);
    await el.click();

    if (options.waitClosed === false) return;

    // The overlay outlives the close handler by the length of its fade-out and
    // still swallows clicks while it does, so the next step in a flow has to
    // wait for the dialog to actually be gone rather than for the press to
    // return. `waitClosed()` polls the root, which covers the overlay too.
    await this.waitClosed(timeout);
  }
}

/**
 * Shared instance bound to the generic `alertdialog` root.
 *
 * Enough for a flow with exactly one confirmation on screen, which is the normal
 * case. Construct a scoped `ConfirmDialog` for anything more specific.
 */
export const confirmDialog = new ConfirmDialog();
