/**
 * VP-1433 — Order History: Customer Info & Search.
 *
 * Source: volt-qc `VP-1433-order-history-customer-info-search-test-cases.md` (TC 1–10).
 *
 * Fixture built in `before`: two cash-paid orders —
 *   A. with a brand-new customer (unique name, random phone), and
 *   B. with no customer at all.
 * A unique name keeps the name search to exactly one hit, so the assertions do
 * not depend on whatever else the merchant has on the books.
 *
 * Phone display on the LIST row is ambiguous in the sheet (full vs last 4, see
 * its TC-02 note), so the row assertion is "shows the last 4 digits", which both
 * readings satisfy. The DETAIL pane is specified as masked `***-***-XXXX`.
 *
 * CREATES DATA AND TAKES TWO CASH PAYMENTS. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { goToOrderHistory, payInCash, returnToHome } from '../../../src/flows/index.js';
import { checkoutPage, homePage, orderHistoryPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

const stamp = Date.now().toString().slice(-6);
const CUSTOMER_NAME = `QC Coby ${stamp}`;
/** 10 digits, area code 832 — a real-looking number nobody on the merchant has. */
const PHONE = `832${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
const LAST4 = PHONE.slice(-4);

let customerOrderId = '';
let customerOrderCode = '';
let anonOrderId = '';

async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

/** Staff + (optional customer) + first service → cash → back home. Returns [uuid, code]. */
async function paidOrder(withCustomer: boolean): Promise<[string, string]> {
  await voidAnyDraft();
  await homePage.selectFirstStaff();
  if (withCustomer) {
    await homePage.attachCustomerByPhone(PHONE);
    if (await homePage.isNewCustomerFormShown()) await homePage.saveNewCustomer(CUSTOMER_NAME);
  }
  await homePage.addFirstService();
  const checkout = await homePage.pressPay();
  const id = await checkout.orderId();
  // The header reads "Order #OD261017-24460486"; the search wants the bare code.
  const header = await checkoutPage.orderNumber();
  const code = /OD\d+-\d+/.exec(header)?.[0] ?? header.replace(/^.*#/, '').trim();
  await payInCash(id);
  await returnToHome();
  return [id, code];
}

describe('VP-1433 — Order History: Customer Info & Search', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK * 2);
    assertWritesAllowed('create two paid orders for the order-history search checks');
    [customerOrderId, customerOrderCode] = await paidOrder(true);
    [anonOrderId] = await paidOrder(false);
    await goToOrderHistory();
    await orderHistoryPage.waitForRows(1);
  });

  // A failed test hands the next one a till that root-hook recovery put back on
  // /home, where the search box would be the STAFF search — re-enter Order History
  // (idempotent) so every search lands in the right field.
  beforeEach(async () => {
    await goToOrderHistory();
  });

  afterEach(async () => {
    if (await orderHistoryPage.isActive()) await orderHistoryPage.clearSearch();
  });

  after(returnToHome);

  it(title('TC-01 The list row shows the customer name', Tag.REGRESSION, Tag.WRITE), async () => {
    const row = await orderHistoryPage.findRowByOrderId(customerOrderId);
    expect(row).not.toBeNull();
    expect(row!.text).toContain(CUSTOMER_NAME);
  });

  it(
    title('TC-02 The list row shows the last 4 digits of the customer phone', Tag.REGRESSION, Tag.WRITE),
    async () => {
      const row = await orderHistoryPage.findRowByOrderId(customerOrderId);
      expect(row!.text.replace(/\D/g, '')).toContain(LAST4);
    },
  );

  it(
    title(
      'TC-03 An order without a customer shows "-", never empty/null/undefined',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const row = await orderHistoryPage.findRowByOrderId(anonOrderId);
      expect(row).not.toBeNull();
      expect(row!.lines).toContain('-');
      expect(row!.text).not.toMatch(/\bnull\b|\bundefined\b/i);
    },
  );

  it(
    title(
      'TC-04 The detail pane shows the name and the phone masked ***-***-XXXX',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const detail = await orderHistoryPage.openOrder(customerOrderId);
      const info = await detail.readInformation();

      expect(info).toContain(CUSTOMER_NAME);
      expect(info).toContain(`***-***-${LAST4}`);
    },
  );

  it(
    title("TC-05 Search by customer name returns only that customer's order", Tag.REGRESSION, Tag.WRITE),
    async () => {
      const ids = await orderHistoryPage.searchUntil(CUSTOMER_NAME, (r) => r.length === 1);
      expect(ids).toEqual([customerOrderId]);
    },
  );

  it(
    title('TC-06 Search by the last 4 phone digits finds the order', Tag.REGRESSION, Tag.WRITE),
    async () => {
      const ids = await orderHistoryPage.searchUntil(LAST4, (r) => r.includes(customerOrderId));
      expect(ids).toContain(customerOrderId);
      expect(ids).not.toContain(anonOrderId);
    },
  );

  it(title('TC-07 Search by Order ID still works (regression)', Tag.REGRESSION, Tag.WRITE), async () => {
    const ids = await orderHistoryPage.searchUntil(customerOrderCode, (r) => r.length === 1);
    expect(ids).toEqual([customerOrderId]);
  });

  it(title('TC-08 Search by the full phone digits finds the order', Tag.REGRESSION, Tag.WRITE), async () => {
    const ids = await orderHistoryPage.searchUntil(PHONE, (r) => r.includes(customerOrderId));
    expect(ids).toContain(customerOrderId);
    expect(ids).not.toContain(anonOrderId);
  });

  it(
    title(
      'TC-09 A keyword with no match shows the empty state and the detail placeholder',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await returnToHome();
      await goToOrderHistory();
      const ids = await orderHistoryPage.searchUntil('zzzqcnomatch', (r) => r.length === 0);

      expect(ids).toEqual([]);
      expect(await orderHistoryPage.isEmptySearchStateShown()).toBe(true);
      expect(await orderHistoryPage.isDetailPlaceholderShown()).toBe(true);
    },
  );

  it(
    title('TC-10 Clearing the search restores the full list in the same order', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await orderHistoryPage.clearSearch();
      await orderHistoryPage.waitForRows(1);
      const before = await orderHistoryPage.renderedOrderIds();

      await orderHistoryPage.searchUntil(CUSTOMER_NAME, (r) => r.length === 1);
      await orderHistoryPage.clearSearch();
      await orderHistoryPage.waitForRows(before.length);

      expect(await orderHistoryPage.searchValue()).toBe('');
      expect(await orderHistoryPage.renderedOrderIds()).toEqual(before);
    },
  );
});
