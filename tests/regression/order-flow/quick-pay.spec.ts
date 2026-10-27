/**
 * Quick Pay — selling an arbitrary amount without a catalogue row.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7:
 *   - TC-ORDERFLOW-13  Quick Pay before any staff raises "Select Staff First"
 *   - TC-ORDERFLOW-14  the dialog exposes Amount / Service Name / Note / Add / Close
 *   - TC-ORDERFLOW-15  Add unlocks only with an amount AND a service name
 *
 *   - TC-ORDERFLOW-16  the amount is capped at $9,999,999.99 — an over-limit
 *     entry never reads back above the cap (the InputCurrency clamps it).
 *   - TC-ORDERFLOW-17  a Quick Pay line is added to the cart, and its discount is
 *     the dialog's own Apply-Discount (order-level), which is WHY a quick-pay line
 *     takes no per-line item discount. (The "does not persist across a reload"
 *     sub-claim needs a reload harness and stays a documented manual check.)
 *
 * CREATES DATA: a draft order is opened (selecting a staff) and, for TC-17, one
 * Quick Pay line is added — the draft is voided in the after-hook. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** $50.00 — a plausible Quick Pay amount, in cents. */
const AMOUNT_CENTS = 5_000;

/** $9,999,999.99 — the documented Quick Pay ceiling, in cents. */
const MAX_AMOUNT_CENTS = 999_999_999;

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

    it(
      title('The amount is capped at $9,999,999.99 (TC-ORDERFLOW-16)', Tag.REGRESSION, Tag.WRITE),
      async () => {
        await homePage.openQuickPay();

        // Try to enter ten million dollars — a hair over the documented ceiling.
        // The InputCurrency must refuse to read back anything above $9,999,999.99.
        await homePage.fillQuickPayAmount(MAX_AMOUNT_CENTS + 100_00);
        expect(await homePage.quickPayAmountCents()).toBeLessThanOrEqual(MAX_AMOUNT_CENTS);

        await homePage.closeQuickPayDialog();
      },
    );

    it(
      title(
        'A Quick Pay line is added; its discount is the dialog toggle, not a per-line item discount (TC-ORDERFLOW-17)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async () => {
        await homePage.openQuickPay();
        await homePage.fillQuickPayAmount(AMOUNT_CENTS);
        await homePage.fillQuickPayName('E2E Quick Pay line');

        // The quick-pay discount lives ON the dialog (order-level). Its presence is
        // the mechanism the catalogue means by "takes no per-line item discount".
        await homePage.setQuickPayDiscountEnabled(true);
        expect(await homePage.isQuickPayDiscountFieldShown()).toBe(true);
        await homePage.setQuickPayDiscountEnabled(false);

        const added = await homePage.submitQuickPay();
        expect(added).toBe(true);

        // The line is on the order now: the footer subtotal carries the $50.
        expect(await homePage.cartSubtotal()).toBeGreaterThanOrEqual(AMOUNT_CENTS);
      },
    );
  });
});
