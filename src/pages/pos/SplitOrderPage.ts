import { Timeouts } from '../../../configs/constants/timeouts.js';
import { splitCheckAmount, splitCheckCard, SplitOrderIds } from '../../constants/testids.orders.js';
import type { Locator } from '../../helpers/selectors.js';
import { logStep } from '../../helpers/steps.js';
import { settle } from '../../helpers/wait.js';
import { parseMoney } from '../../utils/money.js';
import { BasePage } from '../BasePage.js';

/** How the order is divided. */
export type SplitMethod = 'equally' | 'byAmount' | 'byItems';

const METHOD_TAB: Record<SplitMethod, Locator> = {
  equally: SplitOrderIds.tabEqually,
  byAmount: SplitOrderIds.tabByAmount,
  byItems: SplitOrderIds.tabByItems,
};

/**
 * Split Order — `/order/{id}/split-order`.
 *
 * Reached from the split icon in the cart, between Print and Pay.
 *
 * ## The three methods are not equally available
 *
 * `byItems` is **disabled for a single-line-item order** — there is nothing to
 * divide by item. That is product behaviour, not a bug, so
 * {@link isMethodEnabled} exists and a spec that wants byItems has to build a
 * multi-item order first. Clicking a disabled tab fails on `waitForClickable`
 * with the tab named, which is the right diagnosis but a slow one.
 *
 * ## Checks are numbered, and the numbering is translated
 *
 * A check's label is `t("global.checkNumber", { number })` — `Check 1` in
 * English, `Thanh toán đơn 1` in Vietnamese. Every locator here goes through
 * {@link splitCheckCard}, which names both. The delete affordance only appears
 * once there are **three or more** checks: with two, removing one would leave a
 * split of one, which is just the order.
 *
 * ## The route needs a suffix match, not a prefix one
 *
 * `Routes.SPLIT_ORDER` is a function of the order id, and the id sits in the
 * MIDDLE: `/order/{id}/split-order`. `BasePage.isActive()` does a `startsWith`
 * on `route`, so the prefix `/order` would also accept `/order/{id}/checkout`
 * and report that this page is showing from the middle of a checkout.
 * {@link isActive} is therefore overridden to match the suffix.
 */
export class SplitOrderPage extends BasePage {
  readonly name = 'Split Order';

  /**
   * The path segment every split-order URL contains.
   *
   * `/order/{id}/split-order` has the id in the MIDDLE, so a prefix match on
   * `/order` would also accept the checkout screen. `isActive()` is overridden
   * below to check the suffix instead.
   */
  readonly route = '/order';

  protected readonly readyAnchor: Locator = SplitOrderIds.heading;

  /** True only on a split-order URL — `/order/{id}/checkout` must not qualify. */
  override async isActive(): Promise<boolean> {
    return (await this.currentPath()).endsWith('/split-order');
  }

  /* --------------------------------------------------------------------- *
   * Method tabs
   * --------------------------------------------------------------------- */

  async selectMethod(method: SplitMethod): Promise<this> {
    await logStep(`${this.name}: split ${method}`);

    if (!(await this.isMethodEnabled(method))) {
      throw new Error(
        `${this.name}: the "${method}" tab is disabled. ` +
          (method === 'byItems'
            ? 'By Items needs an order with more than one line item — a single-service order ' +
              'has nothing to divide.'
            : 'The merchant or the order state does not allow this split method right now.'),
      );
    }

    await this.click(METHOD_TAB[method]);
    // Switching method rebuilds the check list, so reading a check straight
    // after the click can hit a card React is replacing.
    await settle();
    return this;
  }

  async isMethodEnabled(method: SplitMethod): Promise<boolean> {
    const el = await this.find(METHOD_TAB[method], { visible: true });
    return el.isEnabled();
  }

  /* --------------------------------------------------------------------- *
   * Checks
   * --------------------------------------------------------------------- */

  /** How many checks the split currently has. */
  async checkCount(): Promise<number> {
    // Counted by probing upward rather than by matching a container: the cards
    // have no shared class the app controls, and a wrong container would report
    // a plausible number that is silently off.
    let count = 0;
    for (let index = 1; index <= 20; index++) {
      if (!(await this.exists(splitCheckCard(index), Timeouts.ANIMATION))) break;
      count = index;
    }
    return count;
  }

  /** The amount on one check, in integer cents. */
  async checkAmountCents(index: number): Promise<number> {
    const text = await this.text(splitCheckAmount(index), { visible: true });
    try {
      return parseMoney(text);
    } catch (error) {
      throw new Error(`${this.name}: check ${String(index)} read ${JSON.stringify(text)}, not one amount.`, {
        cause: error,
      });
    }
  }

  /** Every check's amount, in order. */
  async allCheckAmountsCents(): Promise<number[]> {
    const count = await this.checkCount();
    const amounts: number[] = [];
    for (let index = 1; index <= count; index++) amounts.push(await this.checkAmountCents(index));
    return amounts;
  }

  async addCheck(): Promise<this> {
    await logStep(`${this.name}: add a check`);
    const before = await this.checkCount();
    await this.click(SplitOrderIds.addCheck);

    // Waiting for the COUNT rather than for a card lets the failure say what
    // actually happened: the app caps the number of checks at the number of
    // guests it can divide, and a silent no-op looks identical to a slow render.
    await this.waitForCheckCount(before + 1);
    return this;
  }

  async waitForCheckCount(expected: number, timeout: number = Timeouts.MEDIUM): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await this.checkCount()) === expected) return;
      await settle(200);
    }
    throw new Error(
      `${this.name}: expected ${String(expected)} checks but found ${String(await this.checkCount())} ` +
        `after ${String(timeout)}ms.`,
    );
  }

  /** Open the amount keypad for one check — the By Amount flow. */
  async openAmountEditor(index: number): Promise<this> {
    await this.click(splitCheckAmount(index));
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Guests
   * --------------------------------------------------------------------- */

  /** The guest count between the stepper buttons. */
  async guestCount(): Promise<number> {
    const text = await this.text(SplitOrderIds.guestCount);
    const parsed = Number.parseInt(text.replace(/\D/g, ''), 10);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${this.name}: the guest stepper read ${JSON.stringify(text)}, not a number.`);
    }
    return parsed;
  }

  async increaseGuests(): Promise<this> {
    await this.click(SplitOrderIds.increaseGuests);
    await settle();
    return this;
  }

  async decreaseGuests(): Promise<this> {
    await this.click(SplitOrderIds.decreaseGuests);
    await settle();
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Receipt panel and payment
   * --------------------------------------------------------------------- */

  /** Expand or collapse the receipt breakdown, whichever it currently is. */
  async toggleReceiptDetails(): Promise<this> {
    if (await this.isVisible(SplitOrderIds.showMore, Timeouts.ANIMATION)) {
      await this.click(SplitOrderIds.showMore);
    } else {
      await this.click(SplitOrderIds.showLess);
    }
    return this;
  }

  /** Pay the selected check. The tender panel and passcode guard are the caller's. */
  async payCheck(): Promise<this> {
    await logStep(`${this.name}: pay the selected check`);
    await this.click(SplitOrderIds.payCheck);
    return this;
  }

  /** Leave the split and return to the cart. */
  async backToOrder(): Promise<this> {
    await this.click(SplitOrderIds.backToOrder);
    return this;
  }
}

export default new SplitOrderPage();
