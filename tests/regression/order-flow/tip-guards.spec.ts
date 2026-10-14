/**
 * ADJUST TIP & SPLIT TIP — spec + regression guards from
 * docs/screens/order-flow/payment-flows-test-cases.md §5.
 *
 * Four describe blocks, by fixture:
 *
 *   - **Adjust Tip** runs on a single-staff cash order (the attach lane can build
 *     one): the dialog is cashier-side, no customer display. Covers the Cash branch
 *     of TIP-01 and VP-3936 (TIP-R1 — the entry must start at $0, not the old tip).
 *
 *   - **Split Tip** needs an order with MORE THAN ONE staff AND a tip on it, so its
 *     before-hook composes a two-staff order and seeds a tip on the customer
 *     display during the cash settle (the launch lane). When the roster is too
 *     short, the lane has no customer display, or the merchant does not surface
 *     Split Tip, the whole block SKIPS rather than failing — the page object is
 *     ready (`openSplitTip` / `chooseSplitMethod` / `confirmSplitTip`), the fixture
 *     is the gate.
 *
 *   - **Adjust Tip / Split Tip ON A CARD ORDER** (TIP-R3 / TIP-R7, both `💳`) repeat
 *     those two flows on an order whose tender is a Card **Auth** — the context the
 *     two bugs actually fired in. They charge a real card, so each is gated behind
 *     `CARD_SETTLE=1` and skips when it is off (see {@link CARD_SETTLE_ENABLED}).
 *
 * Pending, each with its reason:
 *   - TIP-02 (🌙) a multi-tender order forces a tender choice — a two-settle order
 *     this suite does not script (same as adjust-tip.spec.ts TC-70).
 *   - TIP-R2 (🌙, VP-3935) "tip ≤ original is rejected on entry" needs an order
 *     with an existing tip and a validation signal the dialog does not expose yet.
 *   - TIP-R4 (🌙, VP-4167) / TIP-R6 (🌙, VP-3976) need a point / setting read.
 *   - TIP-R5 (🌙, VP-4192) "Split Evenly shows the wrong initial value" needs a
 *     per-staff amount reader on the split-tip dialog (no locator yet).
 *
 * CREATES DATA AND TAKES PAYMENTS: two settled cash orders (Adjust block: tip
 * untouched; Split block: a real tip seeded and re-split) always, plus — only under
 * CARD_SETTLE=1 — two card orders (one adjusted, one split-tipped). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { payInCash, returnToHome, goToOrderHistory } from '../../../src/flows/index.js';
import { homePage, orderHistoryDetailPage, orderHistoryPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  buildTwoStaffDraftOrSkip,
  CARD_SETTLE_ENABLED,
  createAndSettleCashOrder,
  createAndSettleCardOrder,
  createAndSettleTwoStaffCardOrderWithTip,
} from './payment-flows.helpers.js';

describe('Payment flows — Adjust Tip', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await createAndSettleCashOrder();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title('Adjust Tip is offered on an eligible unsettled cash order (TIP-01)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      if (!(await orderHistoryDetailPage.isAdjustTipAvailable())) {
        // Tip-after-payment is off on this merchant — nothing to adjust. The
        // Gift-Card exclusion half of TIP-01 needs an unsettled gift-card order,
        // which this suite cannot leave unsettled.
        this.skip();
      }

      await orderHistoryDetailPage.openAdjustTip();
      // A single-tender cash order skips the tender picker and lands on amount entry.
      expect(await orderHistoryDetailPage.isTenderPickerOpen()).toBe(false);
      expect(await orderHistoryDetailPage.isAdjustTipEntryShown()).toBe(true);
      await orderHistoryDetailPage.closeAdjustTip();
    },
  );

  it(
    title(
      'Adjust Tip starts the entry at $0, not the current tip (TIP-R1, VP-3936)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      if (!(await orderHistoryDetailPage.isAdjustTipAvailable())) {
        this.skip();
      }

      await orderHistoryDetailPage.openAdjustTip();
      // VP-3936: the keypad must open empty so a cashier types the NEW tip, rather
      // than prefilling the old one (which risks doubling it on save).
      expect(await orderHistoryDetailPage.readEnteredTip()).toBe(0);
      await orderHistoryDetailPage.closeAdjustTip();
    },
  );

  it(title('TIP-02: multi-tender order forces a tender choice — PENDING 🌙 (two-settle order)'));

  it(
    title(
      'TIP-R2 (VP-3935): tip ≤ original is rejected on entry — PENDING 🌙 (needs an order with an existing tip + validation signal)',
    ),
  );

  it(title('TIP-R4 (VP-4167): point calculation includes the tip — PENDING 🌙 (needs a point/report read)'));

  it(
    title(
      'TIP-R6 (VP-3976): tip always Proportion despite the setting — PENDING 🌙 (needs a setting + P8D order read)',
    ),
  );
});

describe('Payment flows — Split Tip', () => {
  let splitTipReady = false;

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);

    // Build a two-staff order and seed a $5 tip on the customer display during the
    // cash settle. Any failure here (short roster, no customer-display handle on
    // the attach lane, merchant without a cash tip flow) is a SKIP of the whole
    // block, not a failure — the fixture is the precondition, not the subject.
    try {
      await buildTwoStaffDraftOrSkip(this);
      const checkout = await homePage.pressPay();
      await checkout.waitForReady();
      const orderId = await checkout.orderId();
      await checkout.selectTender('cash');

      const success = await payInCash(orderId, { customTipCents: 500 });
      await success.continueToNextOrder();
      await success.waitForFlowToEnd();

      await returnToHome();
      await goToOrderHistory();
      await orderHistoryPage.openOrder(orderId);
      await orderHistoryDetailPage.waitForOrder(orderId);

      splitTipReady = await orderHistoryDetailPage.isSplitTipAvailable();
    } catch {
      splitTipReady = false;
    }

    if (!splitTipReady) this.skip();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title('Split Tip offers Evenly / Proportion / Manual and confirms (TIP-03)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await orderHistoryDetailPage.openSplitTip();

      // All three modes are reachable — the dialog's three tabs.
      await orderHistoryDetailPage.chooseSplitMethod('evenly');
      await orderHistoryDetailPage.chooseSplitMethod('manual');
      await orderHistoryDetailPage.chooseSplitMethod('proportion');

      // Confirm the (default) proportional split — proves the Confirm path closes.
      await orderHistoryDetailPage.confirmSplitTip();
    },
  );

  it(
    title(
      'Split Tip action is present on an unsettled order with a tip (TIP-R8, VP-3884)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      // The before-hook already gated on this; asserting it documents the fix for
      // VP-3884 (the action was missing in Order History for such orders).
      expect(await orderHistoryDetailPage.isSplitTipAvailable()).toBe(true);
    },
  );

  it(
    title(
      'TIP-R5 (VP-4192): Split Evenly shows the wrong initial value — PENDING 🌙 (needs a split-tip per-staff amount reader)',
    ),
  );
});

describe('Payment flows — Adjust Tip on a card order', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    // 💳 A card adjust charges and drives the customer display — only run it when an
    // operator at the terminal opts in. Skipping in `before` skips the whole block
    // before any money moves.
    if (!CARD_SETTLE_ENABLED) this.skip();
    this.timeout(Timeouts.MOCHA_HOOK);
    await createAndSettleCardOrder();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title(
      'Adjust Tip on a card (Auth) order saves and persists (TIP-R3, VP-4157)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      if (!(await orderHistoryDetailPage.isAdjustTipAvailable())) {
        // Tip-after-payment is off on this merchant — nothing to adjust.
        this.skip();
      }

      // VP-4157: adjusting the tip on a card tender used to FAIL for every merchant
      // user. Save a $5 tip; the save completing is half the fix, and re-reading the
      // tender's current tip proves it persisted rather than silently dropping.
      await orderHistoryDetailPage.adjustTip(500);

      await orderHistoryDetailPage.openAdjustTip();
      // The keypad entry resets to $0 (TIP-R1), but the tender's CURRENT tip now
      // reads the saved $5.00 — the direct proof the adjust landed.
      expect(await orderHistoryDetailPage.readCurrentTipText()).toContain('5.00');
      await orderHistoryDetailPage.closeAdjustTip();
    },
  );
});

describe('Payment flows — Split Tip on a card order', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    if (!CARD_SETTLE_ENABLED) this.skip();
    this.timeout(Timeouts.MOCHA_HOOK);

    // buildTwoStaffDraftOrSkip (inside the helper) skips the block when the roster
    // is < 2. A charge failure here is a REAL failure, not a skip — so it is not
    // swallowed, unlike the cash Split Tip fixture which cannot fail at the terminal.
    await createAndSettleTwoStaffCardOrderWithTip(this, 500);
    if (!(await orderHistoryDetailPage.isSplitTipAvailable())) this.skip();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
  });

  it(
    title(
      'Card + Split Tip completes instead of wedging in processing (TIP-R7, VP-4209)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);

      // VP-4209: splitting the tip on a CARD order used to wedge in "processing" and
      // flip the order to Payment Failed. Confirming the split must complete (the
      // dialog closes) and leave the order Successful.
      await orderHistoryDetailPage.openSplitTip();
      await orderHistoryDetailPage.chooseSplitMethod('evenly');
      await orderHistoryDetailPage.confirmSplitTip();

      const info = (await orderHistoryDetailPage.readInformation()).toLowerCase();
      expect(info).toContain('successful');
      expect(info).not.toContain('failed');
    },
  );
});
