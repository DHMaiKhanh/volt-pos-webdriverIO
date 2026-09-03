/**
 * Attaching a customer to an order from the phone keypad.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-06  a phone that matches nobody opens the quick-add form
 *
 * The rest of the customer-entry cases are pending on a fixture this repository
 * does not carry — a KNOWN customer to search for:
 *   - TC-ORDERFLOW-07  existing customer → "Customers Found" list
 *   - TC-ORDERFLOW-08  duplicate phone → Done attaches the first match
 *   - TC-ORDERFLOW-10  a customer with a saved note → note popup
 * and TC-ORDERFLOW-09 (Skip → "Unknown" customer) is pending on a reviewed
 * locator for the Skip control, which the catalogue does not expose yet.
 *
 * CREATES DATA: a draft order is opened to attach against, but the customer form
 * is never saved and the draft is voided. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

/**
 * A fictional-block US number (555-01xx is reserved for fiction), so the lookup
 * reliably falls through to the quick-add form rather than matching a real
 * customer on the merchant.
 */
const UNMATCHED_PHONE = '5550101234';

async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

describe('Order flow — Customer entry', () => {
  before(async () => {
    assertWritesAllowed('attach a customer on /home');
    await voidAnyDraft();
    // Attaching a customer needs an order to attach to.
    await homePage.selectFirstStaff();
  });

  after(voidAnyDraft);

  it(
    title('A phone matching nobody opens the quick-add form (TC-ORDERFLOW-06)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await homePage.attachCustomerByPhone(UNMATCHED_PHONE);

      // No match means the Done handler falls through to the create form rather
      // than attaching anyone.
      expect(await homePage.isNewCustomerFormShown()).toBe(true);

      // Close without saving — nothing is written but the draft.
      await homePage.dismissNewCustomerForm();
    },
  );

  it(
    title('TC-ORDERFLOW-07: existing customer → "Customers Found" list — PENDING (needs a customer fixture)'),
  );

  it(
    title('TC-ORDERFLOW-08: duplicate phone → Done attaches the first — PENDING (needs a customer fixture)'),
  );

  it(title('TC-ORDERFLOW-09: Skip → "Unknown" customer — PENDING (no reviewed locator for Skip)'));

  it(title('TC-ORDERFLOW-10: customer with a saved note → note popup — PENDING (needs a customer fixture)'));
});
