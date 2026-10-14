import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../components/index.js';
import { Routes } from '../../constants/routes.js';
import {
  customerSuggestionItem,
  HomeIds,
  homeCustomerKeypadKey,
  removeServiceBtn,
  serviceCategory,
  serviceItem,
  staffGroupTab,
  staffItem,
} from '../../constants/testids.js';
import { byRole, locator, textIsAnyOf } from '../../helpers/selectors.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle, waitUntilPath } from '../../helpers/wait.js';
import type { MoneyCents } from '../../types/models.js';
import { fromCents, parseMoney } from '../../utils/money.js';
import { BasePage } from '../BasePage.js';
import type { CheckoutPage } from './CheckoutPage.js';
import type { SplitOrderPage } from './SplitOrderPage.js';

/**
 * Where `handlePay` lands: `/order/{uuid}/checkout`, plus its nested steps
 * (`/view-cart`, `/processing-payment`) in case the app resumes mid-flow.
 */
const CHECKOUT_PATH = /^\/order\/[^/]+\/checkout(?:\/|$)/;

/** `/order/{uuid}/split-order` — where {@link HomePage.openSplitOrder} lands. */
const SPLIT_ORDER_PATH = /^\/order\/[^/]+\/split-order(?:\/|$)/;

/**
 * The confirm button of the shared `ConfirmDialog` (`src/components/confirm-dialog.tsx`).
 *
 * Declared here instead of in `constants/testids.ts` because there is nothing to
 * put there yet: every destructive action on this screen — removing a service
 * line, removing a staff column, deleting the draft order — routes through the
 * SAME anonymous Radix `AlertDialogAction`, so the id the app eventually ships
 * has to be per-action, not one shared name. Adding a single invented entry to
 * the catalogue would make `npm run audit:testids` report a name the app team
 * never agreed to.
 *
 * The fallback is the same shape the catalogue already uses for the
 * order-history cancel dialog: `AlertDialogFooter` renders Cancel then Action,
 * both plain buttons, so the action is the footer's last button.
 */
const CONFIRM_DIALOG_ACTION: Locator = locator(
  'confirm dialog action',
  'home-confirm-dialog-confirm-btn',
  '[data-slot="alert-dialog-footer"] button:last-of-type',
  // Text fallback for builds whose footer is not slotted: the destructive action
  // is the confirm button on the "Delete Order — Are you sure?" alert-dialog.
  '//div[@role="alertdialog"]//button[normalize-space()="Delete" or normalize-space()="Xoá" or normalize-space()="Xóa" or normalize-space()="Confirm" or normalize-space()="Xác nhận"]',
);

/**
 * The "Select Staff First" prompt.
 *
 * Declared inline for the same reason as {@link CONFIRM_DIALOG_ACTION}: the app
 * ships no testid for it, and the catalogue must not carry an invented one.
 * Raised when a service or Quick Pay is tapped before any staff is on the order
 * (`-service/index.tsx` guards `handleAddService` on the selected staff). The
 * English heading is the primary handle; the alert-dialog role is the fallback
 * for a Vietnamese till, which is safe here because the till is otherwise idle
 * when this fires — nothing else is open to mistake for it.
 */
const SELECT_STAFF_FIRST: Locator = locator(
  'select staff first prompt',
  'home-select-staff-first',
  textIsAnyOf('Select Staff First', 'Vui lòng chọn nhân viên trước'),
  byRole('alertdialog'),
);

/** Optional fields of the Quick Pay dialog. */
export interface QuickPayItem {
  /** Line name. Left blank, the app names it "Unknown service N" itself. */
  name?: string;
  note?: string;
}

/**
 * The cart footer, read as cents.
 *
 * The four middle rows are OPTIONAL by construction, not by timing:
 * `-order/order-summary.tsx` guards each one with `amount > 0`, so a plain order
 * genuinely has no discount, promotion, reward or tax row in the DOM. They read
 * back as `0` rather than throwing — see {@link HomePage.cartTotals}.
 *
 * A `type`, not an `interface`, and that is load-bearing: TypeScript gives an
 * object-literal type alias an implicit index signature but denies one to an
 * interface, so `Object.entries(totals)` infers `MoneyCents` here and would fall
 * back to the `[string, any]` overload if this were an interface. The smoke spec
 * walks exactly that way to check every row reads as whole cents, and `any`
 * would silently disable the check.
 */
export type CartTotals = {
  subtotal: MoneyCents;
  itemDiscount: MoneyCents;
  promotion: MoneyCents;
  reward: MoneyCents;
  tax: MoneyCents;
  total: MoneyCents;
};

/**
 * `/home` — the three-panel till.
 *
 * Staff | Order | Service, plus the customer phone lookup and the cart footer.
 * Nearly every spec in the suite starts here, so the method surface is wide on
 * purpose; what it does NOT do is hand elements back, because a spec that owns a
 * `WebdriverIO.Element` from this screen goes stale the moment the panel
 * re-renders after an order mutation.
 *
 * ## Virtualization — the one thing that surprises people
 *
 * Both tile grids run `@tanstack/react-virtual` (`-staff/staff-items.tsx`,
 * `-service/service-items.tsx`), so the DOM holds only the rows near the scroll
 * position plus a small overscan. Two consequences:
 *
 * - {@link visibleStaffCount} / {@link visibleServiceCount} count what is
 *   MOUNTED, never the size of the directory. They answer "is this panel
 *   populated", not "how many staff does the merchant have".
 * - {@link selectStaff} / {@link addService} address a tile by id, which only
 *   resolves while that tile is inside the rendered window. Narrow the list with
 *   {@link searchStaff} / {@link searchService} first when the target is not
 *   near the top.
 *
 * ## Cart totals read through a bilingual label match
 *
 * `home-cart-subtotal` … `home-cart-total` do not ship as testids, and each row
 * is an unmarked `div.flex.justify-between` holding a translated label and a
 * `money()` span — so the label is the only handle. An nth-child chain is not
 * one: the discount, promotion, reward and tax rows render only when their
 * amount is above zero, so the index shifts per order.
 *
 * The catalogue therefore matches the label in BOTH languages the app ships
 * (`src/locales/{en,vi}`), scoped to the footer's own `div.is-changing-staff`
 * root, and returns the amount span rather than the row. {@link cartTotals} is
 * live; it stops being a text match the day the annotations merge.
 */
export class HomePage extends BasePage {
  readonly name = 'Home';
  readonly route = Routes.HOME;

  /**
   * The staff TILES, not the container that holds them.
   *
   * `#home-staff-listing` mounts with the route and paints before the staff
   * query resolves, so anchoring on it lets a spec race ahead of its data and
   * fail later, inside `selectStaff`, with a message about a missing tile. The
   * tiles only exist once the directory arrived, which is what readiness means
   * on this screen.
   */
  protected readonly readyAnchor: Locator = HomeIds.staffItems;

  /* --- Staff panel ----------------------------------------------------- */

  /** Filter the staff list. Waits out the search debounce before returning. */
  async searchStaff(name: string): Promise<this> {
    await logStep(`Home: search staff "${name}"`);
    await this.setValue(HomeIds.staffSearchInput, name);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /** Switch staff group tab. `'all'` is the default tab. */
  async openStaffGroup(groupId: string): Promise<this> {
    await logStep(`Home: open staff group "${groupId}"`);
    await this.click(staffGroupTab(groupId));
    return this;
  }

  /** Put a named staff member on the order. See the virtualization note. */
  async selectStaff(staffId: string): Promise<this> {
    await logStep(`Home: select staff ${staffId}`);
    await this.click(staffItem(staffId));
    return this;
  }

  /**
   * Put whichever staff member sorts first on the order.
   *
   * For specs whose subject is the order, not the person. Anything asserting on
   * a specific staff member should name them with {@link selectStaff} — the tile
   * order follows the merchant's sort setting and is not stable across accounts.
   */
  async selectFirstStaff(): Promise<this> {
    return this.selectStaffByIndex(0);
  }

  /**
   * Select the staff tile at `index` (0-based) among those mounted right now.
   *
   * The positional sibling of {@link selectStaff}: it books by WHERE a tile sits,
   * not by WHO it is, so a spec can walk `0, 1, 2, …` to put a run of orders on
   * different people without hard-coding an account. {@link selectFirstStaff} is
   * just this at index 0.
   *
   * Bounded by react-virtual (see the virtualization note): only on-screen tiles
   * are mounted, so the first screenful is always addressable and a far index
   * would need a scroll the panel does not do here. Drive it off
   * {@link visibleStaffCount} — `for (let i = 0; i < n; i++)` — and an
   * out-of-range index throws with the count it actually saw.
   */
  async selectStaffByIndex(index: number): Promise<this> {
    await logStep(`Home: select staff tile #${index + 1}`);
    const tiles = await this.findAll(HomeIds.staffItems, { timeout: Timeouts.MEDIUM });
    const tile = tiles[index];

    if (!tile) {
      throw new Error(
        `${this.name}: no staff tile at index ${index} — ${tiles.length} mounted. ` +
          `An empty panel means the directory did not sync or the active group tab filters ` +
          `everything out; a too-high index means you walked past visibleStaffCount().`,
      );
    }

    await tile.waitForClickable({ timeout: Timeouts.SHORT });
    await tile.click();
    return this;
  }

  /** How many staff tiles are MOUNTED right now — see the virtualization note. */
  async visibleStaffCount(): Promise<number> {
    return (await this.findAll(HomeIds.staffItems, { timeout: Timeouts.SHORT })).length;
  }

  /* --- Service panel --------------------------------------------------- */

  /**
   * Filter the service list.
   *
   * Typing here clears the selected category (`-service/index.tsx` nulls
   * `categoryId` on a non-empty search), so the result set spans the whole menu
   * rather than the tab that happened to be open.
   */
  async searchService(name: string): Promise<this> {
    await logStep(`Home: search service "${name}"`);
    await this.setValue(HomeIds.serviceSearchInput, name);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /** Switch service category tile. */
  async openServiceCategory(categoryId: string): Promise<this> {
    await logStep(`Home: open service category "${categoryId}"`);
    await this.click(serviceCategory(categoryId));
    return this;
  }

  /** Add a named service to the order. See the virtualization note. */
  async addService(serviceId: string): Promise<this> {
    await logStep(`Home: add service ${serviceId}`);
    await this.click(serviceItem(serviceId));
    return this;
  }

  /** Add whichever service tile renders first. Same caveat as {@link selectFirstStaff}. */
  async addFirstService(): Promise<this> {
    return this.addServiceByIndex(0);
  }

  /**
   * Add the service tile at `index` (0-based) among those mounted right now.
   *
   * The positional sibling of {@link addService}: it sells by WHERE a tile sits,
   * not by WHICH item it is. Call it more than once with different indices to put
   * several distinct lines on one order, or across successive orders to vary what
   * each sells — no hard-coded service id either way. {@link addFirstService} is
   * this at index 0.
   *
   * Same react-virtual bound as {@link selectStaffByIndex}: address within
   * {@link visibleServiceCount}. The app APPENDS, so adding the same index twice
   * sells that line twice — step the index to vary the item.
   */
  async addServiceByIndex(index: number): Promise<this> {
    await logStep(`Home: add service tile #${index + 1}`);
    const tiles = await this.findAll(HomeIds.serviceItems, { timeout: Timeouts.MEDIUM });
    const tile = tiles[index];

    if (!tile) {
      throw new Error(
        `${this.name}: no service tile at index ${index} — ${tiles.length} mounted. ` +
          `An empty panel comes from a search term or a category with no items (clear the search ` +
          `first); a too-high index means you walked past visibleServiceCount().`,
      );
    }

    await tile.waitForClickable({ timeout: Timeouts.SHORT });
    await tile.click();
    return this;
  }

  /** How many service tiles are MOUNTED right now — see the virtualization note. */
  async visibleServiceCount(): Promise<number> {
    return (await this.findAll(HomeIds.serviceItems, { timeout: Timeouts.SHORT })).length;
  }

  /**
   * Open the Quick Pay dialog — the pinned tile that sells an arbitrary amount.
   *
   * Quick Pay is not a category: `PINNED_CATEGORY_IDS` makes it render as a
   * title-only, centered tile in the category strip, which is the shape the
   * catalogue's fallback keys on.
   */
  async openQuickPay(): Promise<this> {
    await logStep('Home: open Quick Pay');
    await this.click(HomeIds.serviceCategoryQuickPay);
    return this;
  }

  /**
   * Fill and submit the Quick Pay dialog. Requires a staff member on the order.
   *
   * The amount is written as a plain decimal because the field is an
   * `InputCurrency`: it formats what it receives, so handing it "50.00" is the
   * same keystroke sequence a cashier produces, while handing it cents ("5000")
   * would book a $5,000 line.
   */
  async addQuickPayItem(amount: MoneyCents, options: QuickPayItem = {}): Promise<this> {
    await logStep(`Home: quick pay ${String(amount)} cents`);
    await this.setValue(HomeIds.quickPayAmountInput, fromCents(amount).toFixed(2));

    if (options.name !== undefined) await this.setValue(HomeIds.quickPayNameInput, options.name);
    if (options.note !== undefined) await this.setValue(HomeIds.quickPayNoteInput, options.note);

    await this.click(HomeIds.quickPayAddBtn);
    return this;
  }

  /* --- Customer panel -------------------------------------------------- */

  /**
   * Tap a phone number into the customer keypad.
   *
   * Driven key by key rather than through `setValue` because
   * `use-customer-search-input.ts` owns the mask and the max length: it rewrites
   * the field on every keystroke, and a one-shot value set lands as a raw string
   * that the formatter then disagrees with. The keypad is also what a cashier
   * actually touches, which makes this the path under test.
   */
  async enterCustomerPhone(phone: string): Promise<this> {
    if (!/^\d+$/.test(phone)) {
      throw new Error(
        `${this.name}: enterCustomerPhone() takes digits only, received "${phone}". ` +
          `The keypad has no key for anything else, so formatting characters cannot be typed.`,
      );
    }

    await logStep(`Home: enter customer phone ${phone}`);
    for (const digit of phone) {
      await this.click(homeCustomerKeypadKey(digit));
    }
    return this;
  }

  /** Wipe the phone field (the keypad's `C` key). */
  async clearCustomerPhone(): Promise<this> {
    await logStep('Home: clear the customer phone field');
    await this.click(HomeIds.customerKeypadClear);
    return this;
  }

  /**
   * Press Done on the phone keypad.
   *
   * Two outcomes, both normal: `handleDoneBtn` re-fetches the customer list and
   * attaches the first match, or — when nothing matches — opens the quick-add
   * form. The button stays disabled until the number is complete, so a premature
   * press fails as "not clickable" rather than silently doing nothing.
   */
  async confirmCustomerPhone(): Promise<this> {
    await logStep('Home: confirm the customer phone');
    await this.click(HomeIds.customerDoneBtn);
    return this;
  }

  /** Pick a specific match out of the phone-lookup popover. */
  async selectSuggestedCustomer(customerId: string): Promise<this> {
    await logStep(`Home: select suggested customer ${customerId}`);
    await this.click(customerSuggestionItem(customerId));
    return this;
  }

  /** Type a phone number and accept the match: the everyday customer attach. */
  async attachCustomerByPhone(phone: string): Promise<this> {
    await this.enterCustomerPhone(phone);
    await this.confirmCustomerPhone();
    return this;
  }

  /**
   * Is the "Add new customer" quick-add form up?
   *
   * `confirmCustomerPhone()` opens it when the typed number matches nobody, so
   * its name field is the signal that the lookup fell through to a create.
   */
  isNewCustomerFormShown(): Promise<boolean> {
    return this.isVisible(HomeIds.createCustomerNameInput);
  }

  /** Close the quick-add customer form with Escape, saving nothing. */
  async dismissNewCustomerForm(): Promise<this> {
    await browser.keys(['Escape']);
    await this.waitGone(HomeIds.createCustomerNameInput, Timeouts.SHORT);
    return this;
  }

  /* --- Order panel ----------------------------------------------------- */

  /**
   * Drop one service line, confirming the dialog it raises.
   *
   * `orderItemId` is the order-item row id, not the service id — the same line
   * can appear twice under different staff.
   */
  async removeService(orderItemId: string): Promise<this> {
    await logStep(`Home: remove order line ${orderItemId}`);
    await this.click(removeServiceBtn(orderItemId));
    await this.confirmDestructiveAction();
    return this;
  }

  /** Discard the whole draft order, confirming the dialog it raises. */
  async deleteOrder(): Promise<this> {
    await logStep('Home: delete the current order');
    await this.click(HomeIds.orderDeleteBtn);
    await this.confirmDestructiveAction();
    return this;
  }

  /**
   * Is a draft order currently open on the till?
   *
   * `home-order-delete-btn` (Remove) renders only while a draft is open
   * (`-order/order-info.tsx`), so its presence is the cheapest proof that
   * selecting a staff member created an order — and its absence, after a delete,
   * that the order was discarded.
   */
  hasActiveDraft(): Promise<boolean> {
    return this.isVisible(HomeIds.orderDeleteBtn);
  }

  /**
   * Enter change-staff mode for a staff column.
   *
   * Only the first half of the interaction: the app then expects a NEW staff
   * tile to be tapped, so a caller follows this with {@link selectStaff} /
   * {@link selectFirstStaff}. Rendered only while `canChangeStaff`.
   */
  async pressChangeStaff(): Promise<this> {
    await logStep('Home: change staff');
    await this.click(HomeIds.orderChangeStaffBtn);
    return this;
  }

  /**
   * Is the order in change-staff mode?
   *
   * The cancel affordance only unhides (`{ flex: isChanging }`) while a staff
   * change is in progress, so its visibility IS the mode — see
   * `HomeIds.orderChangeStaffCancelBtn`.
   */
  isChangeStaffModeActive(): Promise<boolean> {
    return this.isVisible(HomeIds.orderChangeStaffCancelBtn);
  }

  /** Leave change-staff mode without swapping anyone. */
  async cancelChangeStaff(): Promise<this> {
    await this.click(HomeIds.orderChangeStaffCancelBtn);
    return this;
  }

  /** Remove a whole staff column and its services, confirming the dialog it raises. */
  async removeStaff(): Promise<this> {
    await logStep('Home: remove the staff column');
    await this.click(HomeIds.orderRemoveStaffBtn);
    await this.confirmDestructiveAction();
    return this;
  }

  /* --- Cart actions: Promo & Rewards / Note / Merge -------------------- */

  /** Open the Promo & Rewards dialog. The cart must hold at least one line. */
  async openPromoDialog(): Promise<this> {
    await logStep('Home: open Promo & Rewards');
    await this.click(HomeIds.cartPromoBtn);
    await this.find(HomeIds.cartPromoDialog, { timeout: Timeouts.MEDIUM, visible: true });
    return this;
  }

  /** Is the Promo & Rewards dialog on screen? */
  isPromoDialogShown(): Promise<boolean> {
    return this.isVisible(HomeIds.cartPromoDialog);
  }

  /** Close the Promo & Rewards dialog with Escape. */
  closePromoDialog(): Promise<this> {
    return this.dismissDialog(HomeIds.cartPromoDialog);
  }

  /** Open the order-note dialog. */
  async openNoteDialog(): Promise<this> {
    await logStep('Home: open order note');
    await this.click(HomeIds.cartNoteBtn);
    await this.find(HomeIds.cartNoteDialog, { timeout: Timeouts.MEDIUM, visible: true });
    return this;
  }

  /** Is the order-note dialog on screen? */
  isNoteDialogShown(): Promise<boolean> {
    return this.isVisible(HomeIds.cartNoteDialog);
  }

  /** Close the order-note dialog with Escape. */
  closeNoteDialog(): Promise<this> {
    return this.dismissDialog(HomeIds.cartNoteDialog);
  }

  /** Is the Merge Order action offered? It renders only once the order has a line. */
  isMergeOrderAvailable(): Promise<boolean> {
    return this.isVisible(HomeIds.cartMergeBtn);
  }

  /**
   * Dismiss whichever cart dialog is open with Escape and wait it out.
   *
   * Radix keeps the overlay mounted through its exit transition, so the wait is
   * what makes the next action land on the screen rather than on a dying dialog —
   * the same reasoning as {@link confirmDestructiveAction}.
   */
  async dismissDialog(dialog: Locator): Promise<this> {
    await browser.keys(['Escape']);
    await this.waitGone(dialog, Timeouts.SHORT);
    return this;
  }

  /* --- Cart line editor (update-service dialog) ------------------------ */

  /**
   * Open the per-line editor for the first cart service line.
   *
   * Tapping a cart line opens `order-item-dialog.tsx` — the price field, an
   * Apply-Discount switch and a note field. The line is a `cursor-pointer` row
   * that renders only while a SINGLE draft is active (see
   * {@link HomeIds.orderServiceRows}); readiness keys on the price field rather
   * than the shared dialog role, so it cannot resolve against a stale overlay.
   */
  async openServiceEditor(): Promise<this> {
    await logStep('Home: open the cart line editor');
    const rows = await this.findAll(HomeIds.orderServiceRows, { timeout: Timeouts.MEDIUM });
    const first = rows[0];
    if (!first) {
      throw new Error(
        `${this.name}: no editable cart line found. The per-line editor opens from a cart ` +
          `service row, which renders only while exactly one draft is active — build the draft, ` +
          `and clear any leftover orders first.`,
      );
    }

    await first.waitForClickable({ timeout: Timeouts.SHORT });
    await first.click();
    await this.find(HomeIds.updateServicePriceInput, { visible: true, timeout: Timeouts.MEDIUM });
    return this;
  }

  /** Is the update-service dialog open? Its price field is the signal. */
  isServiceEditorShown(): Promise<boolean> {
    return this.isVisible(HomeIds.updateServicePriceInput);
  }

  /** The price field's current value, in cents. */
  async serviceEditorPriceCents(): Promise<MoneyCents> {
    return parseMoney(await this.value(HomeIds.updateServicePriceInput));
  }

  /**
   * Overwrite the line price.
   *
   * The field is a masked `InputCurrency` PRE-FILLED with the current line price,
   * and typing into it appends to the mask ($54.00 + "12.00" → $5,412.00…). So it
   * is zeroed with the dialog's own "Reset amount" control first, and only then
   * entered as a decimal the way the empty Quick Pay field is driven.
   */
  async setServiceEditorPrice(amount: MoneyCents): Promise<this> {
    await this.click(HomeIds.updateServiceResetAmountBtn);
    await this.setValue(HomeIds.updateServicePriceInput, fromCents(amount).toFixed(2));
    return this;
  }

  /**
   * Is the Apply-Discount switch on?
   *
   * Reads the Radix state either way it can be exposed — `aria-checked` when the
   * accessibility attribute is present, `data-state="checked"` otherwise.
   */
  async isItemDiscountOn(): Promise<boolean> {
    const el = await this.find(HomeIds.updateServiceDiscountSwitch, { visible: true });
    const aria = await el.getAttribute('aria-checked');
    if (aria === 'true' || aria === 'false') return aria === 'true';
    return (await el.getAttribute('data-state')) === 'checked';
  }

  /** Flip the Apply-Discount switch. */
  async toggleItemDiscount(): Promise<this> {
    await this.click(HomeIds.updateServiceDiscountSwitch);
    return this;
  }

  /**
   * Type a discount amount into the field the switch reveals.
   *
   * Flipping {@link toggleItemDiscount} on alone keeps Save disabled — the app
   * treats a `0` discount as "nothing to apply" — so a case that wants a discount
   * must enter a non-zero value here. `value` is taken in the mode the dialog is
   * already in (a "%"/"$" pair beside the field switches it); the default suits a
   * plain percentage. The switch must already be on.
   */
  async setItemDiscount(value: string): Promise<this> {
    await this.setValue(HomeIds.updateServiceDiscountInput, value);
    return this;
  }

  /** Type a per-line note (the app caps it at 50 characters). */
  async setServiceNote(note: string): Promise<this> {
    await this.setValue(HomeIds.updateServiceNoteInput, note);
    return this;
  }

  /** The note field's current value. */
  serviceNoteValue(): Promise<string> {
    return this.value(HomeIds.updateServiceNoteInput);
  }

  /** Save the editor and wait for it to close. */
  async saveServiceEditor(): Promise<this> {
    await this.click(HomeIds.updateServiceSaveBtn);
    await this.waitGone(HomeIds.updateServicePriceInput, Timeouts.MEDIUM);
    return this;
  }

  /** Close the editor without saving, via Escape. */
  async closeServiceEditor(): Promise<this> {
    return this.dismissDialog(HomeIds.updateServicePriceInput);
  }

  /* --- Quick Pay dialog probes ----------------------------------------- */

  /** Is the Quick Pay dialog on screen? Its amount field is the readiness signal. */
  isQuickPayDialogShown(): Promise<boolean> {
    return this.isVisible(HomeIds.quickPayAmountInput);
  }

  /** Is the Quick Pay Add button pressable? It unlocks only with an amount AND a service name. */
  async isQuickPayAddEnabled(): Promise<boolean> {
    const button = await this.find(HomeIds.quickPayAddBtn, { visible: true });
    return button.isEnabled();
  }

  /** Type an amount into the open Quick Pay dialog, without submitting. */
  async fillQuickPayAmount(amount: MoneyCents): Promise<this> {
    await this.setValue(HomeIds.quickPayAmountInput, fromCents(amount).toFixed(2));
    return this;
  }

  /** Type a service name into the open Quick Pay dialog, without submitting. */
  async fillQuickPayName(name: string): Promise<this> {
    await this.setValue(HomeIds.quickPayNameInput, name);
    return this;
  }

  /** Close the Quick Pay dialog with Escape. */
  async closeQuickPayDialog(): Promise<this> {
    await browser.keys(['Escape']);
    await this.waitGone(HomeIds.quickPayAmountInput, Timeouts.SHORT);
    return this;
  }

  /**
   * Is the "Select Staff First" prompt up?
   *
   * The app raises it when a service or Quick Pay is tapped before any staff is
   * on the order. See {@link SELECT_STAFF_FIRST}.
   */
  isSelectStaffFirstShown(): Promise<boolean> {
    return this.isVisible(SELECT_STAFF_FIRST);
  }

  /**
   * Acknowledge and close the "Select Staff First" prompt.
   *
   * The prompt is a single-action alert, so the app's shared `AlertDialog`
   * action (see {@link CONFIRM_DIALOG_ACTION}) is its Done button; Escape is the
   * fallback for a build that renders it as a plain dialog.
   */
  async dismissSelectStaffFirst(): Promise<this> {
    if (await this.exists(CONFIRM_DIALOG_ACTION, Timeouts.SHORT)) {
      await this.click(CONFIRM_DIALOG_ACTION);
    } else {
      await browser.keys(['Escape']);
    }
    await this.waitGone(SELECT_STAFF_FIRST, Timeouts.SHORT);
    return this;
  }

  /* --- Cart footer ----------------------------------------------------- */

  /** Cart subtotal in cents. Always rendered, even at zero. */
  async cartSubtotal(): Promise<MoneyCents> {
    return this.readAmount(HomeIds.cartSubtotal, true);
  }

  /** Tax in cents, or `0` when the order carries none (the row is then absent). */
  async cartTax(): Promise<MoneyCents> {
    return this.readAmount(HomeIds.cartTax, false);
  }

  /**
   * Order total in cents, as the footer prints it.
   *
   * That figure is `orderTotal - totalTipAmount`: the cart shows the pre-tip
   * total, and tip is collected later on the checkout screen. Comparing this
   * against a stored `order.total` after a tipped payment will not match, and
   * should not.
   */
  async cartTotal(): Promise<MoneyCents> {
    return this.readAmount(HomeIds.cartTotal, true);
  }

  /** Every footer row at once, with the optional ones defaulted to `0`. */
  async cartTotals(): Promise<CartTotals> {
    return {
      subtotal: await this.readAmount(HomeIds.cartSubtotal, true),
      itemDiscount: await this.readAmount(HomeIds.cartItemDiscount, false),
      promotion: await this.readAmount(HomeIds.cartPromotion, false),
      reward: await this.readAmount(HomeIds.cartReward, false),
      tax: await this.readAmount(HomeIds.cartTax, false),
      total: await this.readAmount(HomeIds.cartTotal, true),
    };
  }

  /**
   * Press Pay and land on checkout.
   *
   * The button is disabled until the order has items, so calling this on an
   * empty cart fails as "not clickable" — which is the honest report, since the
   * app is refusing the action rather than losing the click.
   *
   * The return value is imported for its TYPE only and resolved with a dynamic
   * `import()`. Checkout leads back to home (payment success, re-open), so a
   * static import would close a module cycle and leave one of the two singletons
   * `undefined` depending on which file the runner loaded first.
   */
  async pressPay(): Promise<CheckoutPage> {
    await logStep('Home: pay');
    await this.click(HomeIds.cartPayBtn, { timeout: Timeouts.MEDIUM });

    await waitUntilPath((path) => CHECKOUT_PATH.test(path), {
      timeout: Timeouts.NAVIGATION,
      message: 'Pay did not open the checkout screen',
    });

    const { default: checkoutPage } = await import('./CheckoutPage.js');
    return checkoutPage;
  }

  /**
   * Is the cart's Split action offered right now?
   *
   * The icon sits between Print and Pay and the app only lets an order be split
   * once its total clears the minimum (the doc's "Total Order > $5" rule), so a
   * cheap order renders it hidden or disabled. A spec proving the gate checks this
   * on a sub-threshold order; `false` is the expected answer there, not a fault.
   */
  async isSplitOrderAvailable(): Promise<boolean> {
    if (!(await this.isVisible(HomeIds.cartSplitBtn, Timeouts.ANIMATION))) return false;
    const button = await this.find(HomeIds.cartSplitBtn, { visible: true });
    return button.isEnabled();
  }

  /**
   * Press the cart's Split icon and land on `/order/{id}/split-order`.
   *
   * The button sits between Print and Pay and only renders once the order has
   * items, so calling this on an empty cart fails as "not clickable" — the honest
   * report, same as {@link pressPay}. Returns the split-order page via a dynamic
   * `import()` for the same cycle reason pressPay documents (split-order routes
   * back to the till through Back to order / finishing the split).
   */
  async openSplitOrder(): Promise<SplitOrderPage> {
    await logStep('Home: open split order');
    await this.click(HomeIds.cartSplitBtn, { timeout: Timeouts.MEDIUM });

    await waitUntilPath((path) => SPLIT_ORDER_PATH.test(path), {
      timeout: Timeouts.NAVIGATION,
      message: 'Split did not open the split-order screen',
    });

    const { default: splitOrderPage } = await import('./SplitOrderPage.js');
    return splitOrderPage;
  }

  /* --- internals ------------------------------------------------------- */

  /**
   * Confirm the `ConfirmDialog` a destructive action raises, and wait it out.
   *
   * The `waitGone` is what makes the next action safe: Radix keeps the overlay
   * mounted and hit-testable for the length of its exit transition, so a click
   * issued straight after the confirm lands on a dying dialog instead of the
   * screen behind it.
   */
  private async confirmDestructiveAction(): Promise<void> {
    // A permission-guarded till (merchant 20258) fronts a destructive action
    // with the PASSCODE guard FIRST: the Remove click opens "Enter staff code
    // to access Delete Order" — a keypad, not an alert-dialog. Enter the staff
    // code when that guard is up; on a till without the guard this is a no-op.
    await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);

    // The shared ConfirmDialog ("Delete Order — Are you sure?", Cancel / Delete)
    // then follows in BOTH cases, so always confirm it too.
    await this.click(CONFIRM_DIALOG_ACTION);
    await this.waitGone(CONFIRM_DIALOG_ACTION, Timeouts.MEDIUM);
  }

  /**
   * Read one money row as cents.
   *
   * `required: false` returns `0` for an absent row because that is what the app
   * means by absent — `order-summary.tsx` renders each discount/tax row only
   * when its amount is above zero. The probe is short: the footer is already on
   * screen by the time anything reads it, so a row that is not there now is not
   * arriving.
   */
  private async readAmount(loc: Locator, required: boolean): Promise<MoneyCents> {
    if (!required && !(await this.exists(loc, Timeouts.ANIMATION))) return 0;
    return parseMoney(await this.text(loc, { timeout: Timeouts.MEDIUM }));
  }
}

export default new HomePage();
