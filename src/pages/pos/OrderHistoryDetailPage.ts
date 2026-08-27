import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import {
  adjustTipKeypadKey,
  adjustTipPaymentItemAmount,
  adjustTipPaymentItemBtn,
  adjustTipPaymentItemLabel,
  OrderHistoryDetailIds,
  orderHistoryDetail,
  orderHistoryDetailSection,
  refundServiceItem,
} from '../../constants/testids.js';
import { Routes } from '../../constants/routes.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle, waitUntilPath } from '../../helpers/wait.js';
import type { MoneyCents } from '../../types/models.js';
import { parseMoney } from '../../utils/money.js';
import { BasePage } from '../BasePage.js';

/**
 * The reason list behind BOTH the cancel and the refund dialog, verbatim from
 * `ORDER_REASONS` in the app's `src/shared/order-reason.ts`.
 *
 * Order is load-bearing: a Radix `SelectItem` exposes neither its value nor a
 * testid, so {@link OrderHistoryDetailPage} picks an option by its index in
 * this array. Re-order it and every reason-picking spec silently chooses a
 * different reason.
 */
export const ORDER_REASONS = [
  'customer_request',
  'service_issue',
  'incorrect_order',
  'duplicate_payment',
  'promotion_discount_error',
  'staff_mistake',
  'other',
] as const;

export type OrderReason = (typeof ORDER_REASONS)[number];

/**
 * Detail section headings as the `en` locale renders them.
 *
 * `order-history-detail-section-{title}` embeds the ALREADY TRANSLATED heading
 * in its testid (`OrderHistoryDetailSection` receives `title` post-`t()`), so
 * these ids change with the merchant language — the one place in this suite
 * where a locator is locale-bound. Every reader below takes an override for
 * that reason; a Vietnamese till passes `t('global.serviceDetails')`'s value.
 * Raise the id scheme with the app team before writing many specs on it.
 */
export const DetailSectionTitle = {
  ORDER_INFORMATION: 'Order Information',
  ORDER_SUMMARY: 'Order Summary',
  SERVICE_DETAILS: 'Service Details',
  TIP: 'Tip',
  PAYMENT_DETAILS: 'Payment Details',
  ORDER_NOTE: 'Order Note',
} as const;

/** The four presets on the adjust-tip keypad, in cents. `$20 / $50 / $100 / $200`. */
export const TIP_PRESETS_CENTS = [2_000, 5_000, 10_000, 20_000] as const;

export type TipPresetCents = (typeof TIP_PRESETS_CENTS)[number];

/** How the tip is spread across staff. The three tabs of the split-tip dialog, in order. */
export type TipSplitMethod = 'evenly' | 'proportion' | 'manual';

/** Everything the refund dialog needs before Confirm becomes clickable. */
export interface RefundOptions {
  reason: OrderReason;
  /** Required when `reason` is `other` — the dialog blocks on an empty custom reason. */
  otherReason?: string;
  /**
   * Which tender to refund against, by position in the refund-method select.
   * Omit on a single-tender order, where the app pre-selects and disables it.
   */
  methodIndex?: number;
}

/** {@link RefundOptions} plus the line items to refund. */
export interface PartialRefundOptions extends RefundOptions {
  /** `orderItem.id` values — each maps to `oh-refund-service-item-{id}`. */
  orderItemIds: string[];
}

/**
 * `/order-history/{orderId}` — the detail pane and every dialog it launches.
 *
 * ## Which actions exist depends on the order
 *
 * `order-history-detail-actions.tsx` mounts each button behind a predicate, so
 * the action bar is never fully populated:
 *
 * | Action     | Shown when                                                          |
 * |------------|---------------------------------------------------------------------|
 * | Receipt    | always                                                              |
 * | Cancel     | successful + UNSETTLED (or `cancel_issue` while unsettled)          |
 * | Re-open    | successful + unsettled, or already `re_open`                        |
 * | Refund     | SETTLED, successful/partial-refunded, refundable value, no gift card |
 * | Adjust tip | online + unsettled + tip-after-payment + at least one adjustable tender |
 * | Split tip  | successful + unsettled + MORE THAN ONE staff on the order           |
 *
 * "Button not found" on this screen is therefore usually a fixture problem, not
 * a selector problem. The `is*Available()` probes below exist so a spec can say
 * which precondition it needs instead of failing on a click timeout.
 *
 * ## Permission-gated actions
 *
 * Cancel, refund and re-open confirm through a `PermissionProtectedButton`,
 * which pops the passcode guard (`passcode-guard-dialog`) before the mutation
 * runs. That guard is cross-screen chrome, so it is driven by the flow layer,
 * not here — every `confirm*` below returns as soon as the click lands.
 */
export class OrderHistoryDetailPage extends BasePage {
  readonly name = 'Order History Detail';

  /**
   * `/order-history/` — with the trailing slash, and no id.
   *
   * A singleton page object cannot bind one order's uuid, and the trailing
   * slash is exactly what separates the detail route from the bare list:
   * `/order-history` does not start with `/order-history/`, so `isActive()`
   * stays honest for both. {@link routeFor} builds the concrete path.
   */
  readonly route: string = Routes.ORDER_HISTORY_DETAIL('');

  /**
   * The detail pane's own container.
   *
   * The exact testid (`order-history-detail-`) never matches — the shipped id
   * carries the order uuid — so this resolves through its declared fallback,
   * `div[class*="order-history-detail-width"]`. That node is genuinely
   * data-gated: `order-history-detail.tsx` returns `null` until
   * `useGetOrderHistoryDetailById` resolves, so its presence means the order
   * arrived, not merely that the route changed.
   */
  protected readonly readyAnchor: Locator = orderHistoryDetail('');

  /** The concrete path for one order, for `waitUntilPath` and direct navigation. */
  routeFor(orderId: string): string {
    return Routes.ORDER_HISTORY_DETAIL(orderId);
  }

  /**
   * Wait until THIS order is the one on screen.
   *
   * The path check is what makes it order-specific: the readiness anchor
   * matches any order's pane, so anchoring alone would pass while the previous
   * order was still rendered and let a spec assert against the wrong totals.
   */
  async waitForOrder(orderId: string, timeout: number = Timeouts.NAVIGATION): Promise<this> {
    const wanted = this.routeFor(orderId);
    await waitUntilPath((path) => path === wanted, {
      timeout,
      message: `Router never opened order ${orderId}`,
    });
    await this.find(orderHistoryDetail(orderId), { timeout: Timeouts.MEDIUM, visible: true });
    return this.waitForReady(timeout);
  }

  /* --------------------------------------------------------------------- *
   * Sections
   * --------------------------------------------------------------------- */

  /** Status, dates, customer and staff. */
  async readInformation(): Promise<string> {
    return this.text(OrderHistoryDetailIds.detailInformation, { timeout: Timeouts.MEDIUM });
  }

  /** Tenders, amounts and per-check badges. */
  async readPayment(): Promise<string> {
    return this.text(OrderHistoryDetailIds.detailPayment, { timeout: Timeouts.MEDIUM });
  }

  /** Any titled card in the pane, by its rendered heading. See {@link DetailSectionTitle}. */
  async readSection(title: string): Promise<string> {
    return this.text(orderHistoryDetailSection(title), { timeout: Timeouts.MEDIUM });
  }

  /** Line items and their prices. */
  async readServices(title: string = DetailSectionTitle.SERVICE_DETAILS): Promise<string> {
    return this.readSection(title);
  }

  /** Per-staff tip shares. */
  async readTip(title: string = DetailSectionTitle.TIP): Promise<string> {
    return this.readSection(title);
  }

  /** Subtotal, discount, tip and total. */
  async readSummary(title: string = DetailSectionTitle.ORDER_SUMMARY): Promise<string> {
    return this.readSection(title);
  }

  /** The order note, or the empty-note placeholder. */
  async readNote(title: string = DetailSectionTitle.ORDER_NOTE): Promise<string> {
    return this.readSection(title);
  }

  /* --------------------------------------------------------------------- *
   * Which actions this order offers
   * --------------------------------------------------------------------- */

  async isRefundAvailable(): Promise<boolean> {
    return this.isVisible(OrderHistoryDetailIds.actionRefund);
  }

  async isCancelAvailable(): Promise<boolean> {
    return this.isVisible(OrderHistoryDetailIds.actionCancel);
  }

  async isReopenAvailable(): Promise<boolean> {
    return this.isVisible(OrderHistoryDetailIds.actionReopen);
  }

  async isAdjustTipAvailable(): Promise<boolean> {
    return this.isVisible(OrderHistoryDetailIds.actionAdjustTip);
  }

  async isSplitTipAvailable(): Promise<boolean> {
    return this.isVisible(OrderHistoryDetailIds.splitTipBtn);
  }

  /* --------------------------------------------------------------------- *
   * Receipt
   * --------------------------------------------------------------------- */

  /** Open the receipt preview. */
  async openReceiptDialog(): Promise<this> {
    await this.click(OrderHistoryDetailIds.actionReceipt);
    await this.find(OrderHistoryDetailIds.receiptDialog, { timeout: Timeouts.MEDIUM, visible: true });
    return this;
  }

  /**
   * Send the receipt to the printer.
   *
   * Fires the real `usePrint()` path, so this needs a configured printer (or a
   * driver that swallows the job) — it is not a preview-only action.
   */
  async printReceipt(): Promise<this> {
    await this.click(OrderHistoryDetailIds.receiptPrintBtn);
    return this;
  }

  async closeReceiptDialog(): Promise<this> {
    return this.dismissDialog(OrderHistoryDetailIds.receiptDialog);
  }

  /* --------------------------------------------------------------------- *
   * Cancel
   * --------------------------------------------------------------------- */

  async openCancelDialog(): Promise<this> {
    await this.click(OrderHistoryDetailIds.actionCancel);
    await this.find(OrderHistoryDetailIds.cancelDialog, { timeout: Timeouts.MEDIUM, visible: true });
    return this;
  }

  /** Pick a cancellation reason. `other` additionally reveals the free-text field. */
  async chooseCancelReason(reason: OrderReason): Promise<this> {
    await this.chooseSelectOption(OrderHistoryDetailIds.cancelReasonSelect, reasonIndex(reason));
    return this;
  }

  /** Fill the free-text reason. Only rendered once `other` is the chosen reason. */
  async enterCancelOtherReason(text: string): Promise<this> {
    await this.setValue(OrderHistoryDetailIds.cancelReasonOtherInput, text);
    return this;
  }

  /**
   * Confirm the cancellation.
   *
   * Returns once the click lands. The passcode guard (`cancel_order_void`)
   * opens next and is driven by the flow layer.
   */
  async confirmCancel(): Promise<this> {
    await this.click(OrderHistoryDetailIds.cancelConfirmBtn);
    return this;
  }

  /** Open, fill and confirm the cancel dialog in one call. */
  async cancelOrder(reason: OrderReason, otherReason?: string): Promise<this> {
    await this.openCancelDialog();
    await this.chooseCancelReason(reason);
    if (reason === 'other') {
      await this.enterCancelOtherReason(otherReason ?? '');
    }
    return this.confirmCancel();
  }

  /* --------------------------------------------------------------------- *
   * Refund
   * --------------------------------------------------------------------- */

  async openRefundDialog(): Promise<this> {
    await this.click(OrderHistoryDetailIds.actionRefund);
    await this.find(OrderHistoryDetailIds.refundDialog, { timeout: Timeouts.MEDIUM, visible: true });
    return this;
  }

  /**
   * Refund every line item — the "fully" case.
   *
   * There is no Fully/Partial tab pair on `develop`. `order-refund-confirm-dialog.tsx`
   * ships ONE form whose scope is the service selection, so "fully" is the
   * `oh-refund-service-all` checkbox and "partial" is a subset of
   * `oh-refund-service-item-{id}` rows. The `oh-refund-tab-fully` /
   * `oh-refund-tab-partial` ids in `constants/testids.ts` describe VP-802's
   * older layout and are kept there only so the audit report shows they are
   * gone; nothing here queries them.
   */
  async selectAllRefundServices(): Promise<this> {
    await this.click(OrderHistoryDetailIds.refundServiceAll);
    return this;
  }

  /** Refund specific line items. Opens the service picker, ticks each row, closes it. */
  async selectRefundServices(orderItemIds: string[]): Promise<this> {
    await this.click(OrderHistoryDetailIds.refundServiceSelect);
    for (const orderItemId of orderItemIds) {
      await this.click(refundServiceItem(orderItemId));
    }
    await browser.keys(['Escape']);
    await settle();
    return this;
  }

  /**
   * Choose which tender the money goes back to, by position.
   *
   * Positional because the options are per-transaction and their labels are
   * built at runtime from the payment method plus a localized description.
   * A single-tender order disables this select entirely — skip the call there.
   */
  async chooseRefundMethod(index: number): Promise<this> {
    await this.chooseSelectOption(OrderHistoryDetailIds.refundMethodSelect, index);
    return this;
  }

  async chooseRefundReason(reason: OrderReason): Promise<this> {
    await this.chooseSelectOption(OrderHistoryDetailIds.refundReasonSelect, reasonIndex(reason));
    return this;
  }

  async enterRefundOtherReason(text: string): Promise<this> {
    await this.setValue(OrderHistoryDetailIds.refundReasonOtherInput, text);
    return this;
  }

  /**
   * The amount the dialog will refund.
   *
   * The field is a disabled `InputCurrency` the app computes from the selected
   * services, so this reads what the app decided — never write to it.
   */
  async readRefundAmount(): Promise<MoneyCents> {
    const raw = await this.value(OrderHistoryDetailIds.refundAmount, { timeout: Timeouts.MEDIUM });
    return parseMoney(raw.length > 0 ? raw : await this.text(OrderHistoryDetailIds.refundAmount));
  }

  /** Confirm the refund. The `refund` passcode guard opens next. */
  async confirmRefund(): Promise<this> {
    await this.click(OrderHistoryDetailIds.refundConfirmBtn);
    return this;
  }

  /** Open the dialog, select every service, fill the form and confirm. */
  async refundFully(options: RefundOptions): Promise<this> {
    await this.openRefundDialog();
    await this.selectAllRefundServices();
    return this.completeRefundForm(options);
  }

  /** Open the dialog, select the named line items, fill the form and confirm. */
  async refundPartially(options: PartialRefundOptions): Promise<this> {
    await this.openRefundDialog();
    await this.selectRefundServices(options.orderItemIds);
    return this.completeRefundForm(options);
  }

  /* --------------------------------------------------------------------- *
   * Re-open
   * --------------------------------------------------------------------- */

  async openReopenDialog(): Promise<this> {
    await this.click(OrderHistoryDetailIds.actionReopen);
    await this.find(OrderHistoryDetailIds.reopenDialog, { timeout: Timeouts.MEDIUM, visible: true });
    return this;
  }

  /**
   * Confirm the re-open and wait for the router to reach checkout.
   *
   * Returns `void` rather than the checkout page object on purpose: coupling
   * the order-history pair to the whole checkout module for one navigation buys
   * nothing, and the spec reads fine as
   * `await detail.confirmReopen(); await checkoutPage.waitForReady();`.
   * Resolves with the `edit_order` passcode guard already answered — the wait
   * spans it, because the navigation only happens after the mutation.
   */
  async confirmReopen(orderId: string): Promise<void> {
    await this.click(OrderHistoryDetailIds.reopenConfirmBtn);
    await waitUntilPath((path) => path === Routes.CHECKOUT(orderId), {
      timeout: Timeouts.NAVIGATION,
      message: `Re-opening ${orderId} never reached checkout`,
    });
  }

  /* --------------------------------------------------------------------- *
   * Adjust tip
   * --------------------------------------------------------------------- */

  /**
   * Open the adjust-tip flow.
   *
   * Which dialog appears depends on the order: `order-adjust-tip-dialog.tsx`
   * skips its own tender picker when the order has exactly ONE adjustable
   * transaction and mounts the amount-entry dialog directly. So this waits for
   * either, and {@link isTenderPickerOpen} tells the spec which it got.
   */
  async openAdjustTip(): Promise<this> {
    await this.click(OrderHistoryDetailIds.actionAdjustTip);
    await browser.waitUntil(
      async () =>
        (await this.exists(OrderHistoryDetailIds.adjustTipTransactionDialog, 500)) ||
        (await this.exists(OrderHistoryDetailIds.adjustTipDialog, 500)),
      {
        timeout: Timeouts.MEDIUM,
        interval: 250,
        timeoutMsg: 'Neither the adjust-tip tender picker nor the amount-entry dialog opened.',
      },
    );
    return this;
  }

  /** True on a multi-tender order, where a tender must be chosen before entering an amount. */
  async isTenderPickerOpen(): Promise<boolean> {
    return this.isVisible(OrderHistoryDetailIds.adjustTipDialog);
  }

  /** Method label of one tender row of the picker. `index` is 0-based. */
  async readTenderLabel(index: number): Promise<string> {
    return this.text(adjustTipPaymentItemLabel(index), { timeout: Timeouts.SHORT });
  }

  /** Amount of one tender row of the picker, in cents. */
  async readTenderAmount(index: number): Promise<MoneyCents> {
    return parseMoney(await this.text(adjustTipPaymentItemAmount(index), { timeout: Timeouts.SHORT }));
  }

  /** Pick the tender to adjust and wait for the amount-entry dialog. */
  async chooseTender(index: number): Promise<this> {
    await this.click(adjustTipPaymentItemBtn(index));
    await this.find(OrderHistoryDetailIds.adjustTipTransactionDialog, {
      timeout: Timeouts.MEDIUM,
      visible: true,
    });
    return this;
  }

  /** The tip already on this tender, as the entry dialog prints it. */
  async readCurrentTipText(): Promise<string> {
    return this.text(OrderHistoryDetailIds.adjustTipCurrentAmount, { timeout: Timeouts.SHORT });
  }

  /** The amount currently entered on the keypad, in cents. */
  async readEnteredTip(): Promise<MoneyCents> {
    return parseMoney(
      await this.text(OrderHistoryDetailIds.adjustTipEnterAmount, { timeout: Timeouts.SHORT }),
    );
  }

  /**
   * Type an exact tip on the keypad.
   *
   * Clears with repeated backspace, NOT with a `C` key: `custom-tip-keypad.tsx`
   * ships a preset row, digits, `00`, `0` and `back` — there is no clear key on
   * `develop`, which is why `adjust-tip-keypad-C` is declared for traceability
   * only. The digit count of the current entry bounds the loop, with two spare
   * presses for a value the display rounds.
   */
  async enterTip(cents: MoneyCents): Promise<this> {
    const digits = String(Math.trunc(Math.abs(cents)));
    const current = String(Math.trunc(Math.abs(await this.readEnteredTip())));

    for (let press = 0; press < current.length + 2; press += 1) {
      await this.click(OrderHistoryDetailIds.adjustTipKeypadBackspace);
    }
    for (const digit of digits) {
      await this.click(adjustTipKeypadKey(digit));
    }
    return this;
  }

  /**
   * Tap one of the four preset keys.
   *
   * Presets ACCUMULATE — `accumulateTipPreset` adds to whatever is entered
   * rather than replacing it — so two taps of `$20` leave $40 on the display.
   */
  async useTipPreset(preset: TipPresetCents): Promise<this> {
    await this.click(adjustTipKeypadKey(String(preset)));
    return this;
  }

  async saveTip(): Promise<this> {
    await this.click(OrderHistoryDetailIds.adjustTipSaveBtn);
    await this.waitGone(OrderHistoryDetailIds.adjustTipTransactionDialog, Timeouts.MEDIUM);
    return this;
  }

  /**
   * Set the tip on one tender, end to end.
   *
   * `tenderIndex` is ignored on a single-tender order, where the app never
   * shows the picker — pass it anyway and this does the right thing on both.
   */
  async adjustTip(cents: MoneyCents, tenderIndex = 0): Promise<this> {
    await this.openAdjustTip();
    if (await this.isTenderPickerOpen()) {
      await this.chooseTender(tenderIndex);
    }
    await this.enterTip(cents);
    return this.saveTip();
  }

  /* --------------------------------------------------------------------- *
   * Split tip
   * --------------------------------------------------------------------- */

  /** Open the split-tip dialog from the Tip section. */
  async openSplitTip(): Promise<this> {
    await this.click(OrderHistoryDetailIds.splitTipBtn);
    await this.find(OrderHistoryDetailIds.splitTipDialog, { timeout: Timeouts.MEDIUM, visible: true });
    return this;
  }

  /** Switch the split method. The three tabs render in the order of {@link TipSplitMethod}. */
  async chooseSplitMethod(method: TipSplitMethod): Promise<this> {
    const tabs: Record<TipSplitMethod, Locator> = {
      evenly: OrderHistoryDetailIds.splitTipEvenly,
      proportion: OrderHistoryDetailIds.splitTipProportion,
      manual: OrderHistoryDetailIds.splitTipManual,
    };
    await this.click(tabs[method]);
    await settle();
    return this;
  }

  async confirmSplitTip(): Promise<this> {
    await this.click(OrderHistoryDetailIds.splitTipConfirmBtn);
    await this.waitGone(OrderHistoryDetailIds.splitTipDialog, Timeouts.MEDIUM);
    return this;
  }

  async closeSplitTip(): Promise<this> {
    await this.click(OrderHistoryDetailIds.splitTipCloseBtn);
    await this.waitGone(OrderHistoryDetailIds.splitTipDialog, Timeouts.SHORT);
    return this;
  }

  /** Split the tip with one of the automatic methods and confirm. */
  async splitTip(method: TipSplitMethod): Promise<this> {
    await this.openSplitTip();
    await this.chooseSplitMethod(method);
    return this.confirmSplitTip();
  }

  /* --------------------------------------------------------------------- *
   * Internals
   * --------------------------------------------------------------------- */

  /** Fill the shared half of the refund form and confirm. */
  private async completeRefundForm(options: RefundOptions): Promise<this> {
    if (options.methodIndex !== undefined) {
      await this.chooseRefundMethod(options.methodIndex);
    }
    await this.chooseRefundReason(options.reason);
    if (options.reason === 'other') {
      await this.enterRefundOtherReason(options.otherReason ?? '');
    }
    return this.confirmRefund();
  }

  /**
   * Choose the option at `index` from a Radix `<Select>`, from the keyboard.
   *
   * Radix reflects neither the item's `value` nor a testid onto the DOM, and
   * the generated `id` embeds a per-mount random `baseId`, so there is no
   * selector for an option at all. `Home` parks on the first item and each
   * `ArrowDown` advances one — position without a selector, which is also why
   * every caller above takes a typed value and converts it to an index here
   * rather than making specs count.
   */
  private async chooseSelectOption(trigger: Locator, index: number): Promise<void> {
    await this.click(trigger);
    await settle();

    await browser.keys(['Home']);
    for (let step = 0; step < index; step += 1) {
      await browser.keys(['ArrowDown']);
    }
    await browser.keys(['Enter']);
    await settle();
  }

  /**
   * Close a dialog with Escape and wait for its exit animation.
   *
   * The header close button has no declared locator, and Escape is what the
   * VP-802 suite used against this same dialog — Radix dismisses only the
   * topmost layer, so nothing underneath is disturbed.
   */
  private async dismissDialog(dialog: Locator): Promise<this> {
    await browser.keys(['Escape']);
    await this.waitGone(dialog, Timeouts.SHORT);
    return this;
  }
}

/** Position of a reason in the select. Throws rather than silently picking the first option. */
function reasonIndex(reason: OrderReason): number {
  const index = ORDER_REASONS.indexOf(reason);
  if (index < 0) {
    throw new Error(`"${reason}" is not one of ORDER_REASONS: ${ORDER_REASONS.join(', ')}.`);
  }
  return index;
}

export default new OrderHistoryDetailPage();
