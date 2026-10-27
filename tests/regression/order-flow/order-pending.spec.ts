/**
 * PENDING ORDERS QUEUE — /order-pending.
 *
 * Test cases: docs/screens/order-pending/order-pending-test-cases.md (TC-OP-01..11).
 * Selectors from the live DOM dump of build 1.1.56 (merchant 14, DEV):
 * reports/scans/2026-10-25-feature-inventory/dom/order-pending.json — see
 * src/constants/testids.order-pending.ts.
 *
 *   TC-OP-01  toolbar renders: search, Staff filter, Sort, date preset + calendar, Quick Checkout
 *   TC-OP-02  a card shows the OD code, created-at time and "Processing"
 *   TC-OP-03  searching the 8-digit suffix of a code narrows the queue to it
 *   TC-OP-04  a search that matches nothing leaves 0 cards
 *   TC-OP-05  Latest ↔ Oldest changes the first card (needs ≥2 cards — skips otherwise)
 *   TC-OP-06  Sort offers exactly Latest / Oldest
 *   TC-OP-07  Quick Checkout is visible and enabled
 *   TC-OP-08  the Staff filter carries a count badge
 *   TC-OP-09  the date preset defaults to Today and the calendar shows today's date
 *   TC-OP-10  header links cross to /order-history and /appointment
 *   TC-OP-11  a paid order leaves the queue (and an unknown code is never listed)
 *
 * ## Data
 *
 * The doc's version only READ the queue and skipped on an empty shop. Here the
 * `before` hook creates ONE draft order of our own (first staff + first service
 * via `createOrder`) and leaves it unpaid, so TC-02/03 always have a card whose
 * code we know — no assertion depends on another merchant's or another run's
 * orders. TC-OP-11 then pays that same order in cash (the real meaning of "a
 * paid order leaves Pending"); if anything fails before that, the `after` hook
 * reopens the draft from the queue and deletes it (passcode guard handled by
 * `HomePage.deleteOrder` → `confirmDestructiveAction`).
 *
 * CREATES ONE ORDER AND TAKES ONE CASH PAYMENT. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { Routes } from '../../../src/constants/routes.js';
import {
  PENDING_CARD_TIME,
  PENDING_DATE_PRESET_TODAY,
  PENDING_STAFF_FILTER_LABEL,
  PENDING_STATUS_PROCESSING,
} from '../../../src/constants/testids.order-pending.js';
import { PENDING_ORDER_CODE } from '../../../src/constants/testids.orders.js';
import { createOrder, payInCash, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { waitUntilPath } from '../../../src/helpers/wait.js';
import { checkoutPage, homePage, orderPendingPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** A code that cannot exist: the real shape is OD + 6 digits + '-' + 8 digits. */
const UNKNOWN_CODE = 'OD000000-00000000';
/** The doc's no-match search term. */
const NO_MATCH_TERM = 'ZZZ000000';

/** Today as the calendar trigger prints it — MM/DD/YYYY (EN) or DD/MM/YYYY (VI). */
function todayLabels(): string[] {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return [`${mm}/${dd}/${yyyy}`, `${dd}/${mm}/${yyyy}`];
}

/**
 * Open OUR draft from the queue and land on the till with it loaded.
 *
 * The card click leaves /order-pending for the order workspace (the till, or its
 * checkout when the order was last left there); `returnToHome()` normalises both.
 */
async function reopenFromQueue(code: string): Promise<void> {
  await orderPendingPage.openOrder(code);
  await waitUntilPath((path) => !path.startsWith(Routes.ORDER_PENDING), {
    timeout: Timeouts.NAVIGATION,
    message: `Opening pending order ${code} did not leave the queue`,
  });
  await returnToHome();
}

/** Leave the till empty — the convention every order-flow spec starts from. */
async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

describe('Order flow — Pending Orders queue (/order-pending)', () => {
  /** Our own draft's UUID (checkout URL) and bare OD code (queue card). */
  let orderId = '';
  let orderCode = '';
  let paid = false;

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create a draft order for the pending-queue checks');

    await voidAnyDraft();
    ({ orderId } = await createOrder());
    await checkoutPage.waitForReady();

    // The checkout header reads "Order #OD261025-64284984"; the queue prints the bare code.
    const header = await checkoutPage.orderNumber();
    orderCode = PENDING_ORDER_CODE.exec(header)?.[0] ?? header.replace(/^.*#/, '').trim();

    // Leave checkout WITHOUT paying: the order stays Pending.
    await returnToHome();
  });

  beforeEach(async () => {
    if (!(await orderPendingPage.isActive())) await orderPendingPage.open();
    else await orderPendingPage.waitForReady(Timeouts.MEDIUM);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    if (orderCode && !paid) {
      // Reopen OUR draft from the queue and delete it. Never touches another order.
      await returnToHome().catch(() => undefined);
      await orderPendingPage.open().catch(() => undefined);
      await orderPendingPage.clearSearch().catch(() => undefined);
      if (await orderPendingPage.isOrderListed(orderCode).catch(() => false)) {
        await reopenFromQueue(orderCode);
        if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
      }
    }
    await returnToHome();
  });

  it(
    title(
      'The screen loads with Search, Staff filter, Sort, Date range and Quick Checkout (TC-OP-01)',
      Tag.REGRESSION,
    ),
    async () => {
      expect(await orderPendingPage.isActive()).toBe(true);
      expect(await orderPendingPage.toolbarVisibility()).toEqual({
        search: true,
        staffFilter: true,
        sort: true,
        datePreset: true,
        dateRange: true,
        quickCheckout: true,
      });
    },
  );

  it(
    title(
      'A pending card shows its OD code, created-at time and "Processing" (TC-OP-02)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const text = await orderPendingPage.cardText(orderCode);
      expect(text).not.toBeNull();

      const card = text ?? '';
      expect(card).toMatch(PENDING_ORDER_CODE);
      expect(card).toMatch(PENDING_CARD_TIME);
      expect(PENDING_STATUS_PROCESSING.some((s) => card.includes(s))).toBe(true);

      // Every listed code has the same shape — the queue prints the bare form.
      const codes = await orderPendingPage.orderCodes();
      expect(codes.length).toBeGreaterThan(0);
      for (const code of codes) expect(code).toMatch(/^OD\d{6}-\d{8}$/);
    },
  );

  it(
    title(
      'Searching the 8-digit suffix of an order code narrows the queue to it (TC-OP-03)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const fragment = orderCode.split('-')[1] ?? orderCode;
      try {
        await orderPendingPage.search(fragment);

        const codes = await orderPendingPage.orderCodes();
        expect(codes).toContain(orderCode);
        // "Only the matching card remains": nothing that lacks the fragment is listed.
        expect(codes.filter((c) => !c.includes(fragment))).toEqual([]);
      } finally {
        await orderPendingPage.clearSearch();
      }
    },
  );

  it(title('A search that matches nothing leaves zero cards (TC-OP-04)', Tag.REGRESSION), async () => {
    try {
      await orderPendingPage.search(NO_MATCH_TERM);
      expect(await orderPendingPage.cardCount()).toBe(0);
    } finally {
      await orderPendingPage.clearSearch();
    }
  });

  it(
    title('Switching Sort Latest → Oldest changes the first card (TC-OP-05)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      const latest = await orderPendingPage.orderCodes();
      // The doc's precondition: ≥2 orders created at different times.
      if (latest.length < 2) this.skip();

      try {
        await orderPendingPage.setSort('oldest');
        const oldest = await orderPendingPage.orderCodes();

        expect(oldest.length).toBeGreaterThan(1);
        expect(oldest[0]).not.toBe(latest[0]);
      } finally {
        await orderPendingPage.setSort('latest');
      }
    },
  );

  it(title('Sort offers exactly two options: Latest and Oldest (TC-OP-06)', Tag.REGRESSION), async () => {
    const options = await orderPendingPage.readSortOptions();
    const english = ['Latest', 'Oldest'];
    const vietnamese = ['Mới nhất', 'Cũ nhất'];
    expect([english, vietnamese].some((set) => JSON.stringify(set) === JSON.stringify(options))).toBe(true);
  });

  it(title('Quick Checkout is visible and enabled (TC-OP-07)', Tag.REGRESSION), async () => {
    expect(await orderPendingPage.isQuickCheckoutEnabled()).toBe(true);
  });

  it(title('The Staff filter shows a count badge (TC-OP-08)', Tag.REGRESSION), async () => {
    const label = await orderPendingPage.staffFilterLabel();
    expect(label).toMatch(PENDING_STAFF_FILTER_LABEL);
    expect(Number(/\d+/.exec(label)?.[0] ?? '0')).toBeGreaterThan(0);
  });

  it(
    title(
      'The date preset defaults to Today and the calendar shows today as a date (TC-OP-09)',
      Tag.REGRESSION,
    ),
    async () => {
      expect(PENDING_DATE_PRESET_TODAY).toContain(await orderPendingPage.datePresetLabel());

      const date = await orderPendingPage.dateRangeLabel();
      expect(date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      // "Today" is the till's local day (memory: POS Today follows the machine clock).
      expect(todayLabels()).toContain(date);
    },
  );

  it(title('Header links cross to Order History and Appointment (TC-OP-10)', Tag.REGRESSION), async () => {
    const history = await orderPendingPage.pressHeaderLink(Routes.ORDER_HISTORY);
    expect(history.startsWith(Routes.ORDER_HISTORY)).toBe(true);

    await orderPendingPage.open();
    const appointment = await orderPendingPage.pressHeaderLink(Routes.APPOINTMENT);
    expect(appointment.startsWith(Routes.APPOINTMENT)).toBe(true);

    await orderPendingPage.open();
    expect(await orderPendingPage.isActive()).toBe(true);
  });

  it(
    title(
      'A paid order leaves the Pending queue; an unknown code is never listed (TC-OP-11)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(Timeouts.MOCHA_HOOK);

      // The doc's literal check: a code that does not exist is absent.
      expect(await orderPendingPage.isOrderListed(UNKNOWN_CODE)).toBe(false);

      // The behaviour behind it: OUR order is listed while unpaid …
      expect(await orderPendingPage.isOrderListed(orderCode)).toBe(true);

      await step('Reopen our draft from the queue and pay it in cash', async () => {
        await reopenFromQueue(orderCode);
        await homePage.pressPay();
        await checkoutPage.waitForReady();
        await checkoutPage.selectTender('cash');
        const success = await payInCash(orderId);
        paid = true;
        await success.continueToNextOrder();
        await success.waitForFlowToEnd();
      });

      // … and gone once it settles.
      await returnToHome();
      await orderPendingPage.open();
      await orderPendingPage.waitForOrderGone(orderCode, Timeouts.LONG);
      expect(await orderPendingPage.isOrderListed(orderCode)).toBe(false);
    },
  );
});
