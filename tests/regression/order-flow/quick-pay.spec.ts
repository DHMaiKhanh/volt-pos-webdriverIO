/**
 * Quick Pay — selling an arbitrary amount without a catalogue row.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-13  Quick Pay before any staff raises "Select Staff First"
 *   - TC-ORDERFLOW-14  the dialog exposes Amount / Service Name / Note / Add / Close
 *   - TC-ORDERFLOW-15  Add unlocks only with an amount AND a service name
 *
 * TC-ORDERFLOW-16 (amount capped at $9,999,999.99) and TC-ORDERFLOW-17 (the
 * item does not persist and takes no item-discount) are pending: the max-value
 * clamp needs a reviewed assertion about what the InputCurrency does with an
 * over-limit entry, and the persistence claim can only be checked by reading the
 * catalogue back — neither is a screen the suite can settle on today.
 *
 * CREATES DATA: a draft order is opened (selecting a staff) but nothing is added
 * or paid — the draft is voided in the after-hook. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** $50.00 — a plausible Quick Pay amount, in cents. */
const AMOUNT_CENTS = 5_000;

async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

describe('Order flow — Quick Pay', () => {
  describe('Without a staff on the order', () => {
    before(async () => {
      assertWritesAllowed('open Quick Pay on /home');
      await voidAnyDraft();
    });

    after(voidAnyDraft);

    it(
      title('Quick Pay before any staff raises "Select Staff First" (TC-ORDERFLOW-13)', Tag.REGRESSION),
      async () => {
        await homePage.openQuickPay();

        expect(await homePage.isSelectStaffFirstShown()).toBe(true);
        expect(await homePage.isQuickPayDialogShown()).toBe(false);

        await homePage.dismissSelectStaffFirst();
      },
    );
  });

  describe('With a staff on the order', () => {
    before(async () => {
      assertWritesAllowed('open Quick Pay on /home');
      await voidAnyDraft();
      await homePage.selectFirstStaff();
    });

    after(voidAnyDraft);

    it(
      title('The Quick Pay dialog opens with Add disabled (TC-ORDERFLOW-14)', Tag.REGRESSION, Tag.WRITE),
      async () => {
        await homePage.openQuickPay();

        expect(await homePage.isQuickPayDialogShown()).toBe(true);
        // Both required fields are empty, so Add starts disabled.
        expect(await homePage.isQuickPayAddEnabled()).toBe(false);

        await homePage.closeQuickPayDialog();
      },
    );

    it(
      title('Add unlocks only with an amount AND a name (TC-ORDERFLOW-15)', Tag.REGRESSION, Tag.WRITE),
      async () => {
        await homePage.openQuickPay();

        await homePage.fillQuickPayAmount(AMOUNT_CENTS);
        // An amount alone is not enough — the service name is the second required field.
        expect(await homePage.isQuickPayAddEnabled()).toBe(false);

        await homePage.fillQuickPayName('E2E Quick Pay');
        expect(await homePage.isQuickPayAddEnabled()).toBe(true);

        // Close without adding — the draft stays a bare staff selection for the
        // after-hook to void.
        await homePage.closeQuickPayDialog();
      },
    );

    it(title('TC-ORDERFLOW-16: amount capped at $9,999,999.99 — PENDING (clamp assertion undefined)'));

    it(title('TC-ORDERFLOW-17: Quick Pay item does not persist / takes no item discount — PENDING'));
  });
});
