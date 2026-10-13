/**
 * Home screen order building and the cart footer.
 *
 * Covers the "compose an order on the till" half of the order flow
 * (docs/screens/order-flow/order-flow-test-cases.md §7):
 *   - TC-ORDERFLOW-01  the three-panel till renders populated
 *   - TC-ORDERFLOW-02  a service tapped before any staff raises "Select Staff First"
 *   - TC-ORDERFLOW-77  selecting a staff opens a draft order
 *   - TC-ORDERFLOW-03  staff + service open a priced draft
 *   - TC-ORDERFLOW-04  the staff search filters the panel
 *   - TC-ORDERFLOW-05  the service search filters the panel
 *   - TC-ORDERFLOW-21  the cart footer's Subtotal / Tax / Total add up
 *   - TC-ORDERFLOW-18  Promo & Rewards opens its dialog
 *   - TC-ORDERFLOW-19  Note opens the order-note dialog
 *   - TC-ORDERFLOW-20  Merge Order is offered once the order has a line
 *   - TC-ORDERFLOW-11  Change Staff enters swap mode
 *   - TC-ORDERFLOW-12  removing a staff column clears its services
 *   - TC-ORDERFLOW-78  Remove discards the whole draft
 *   - TC-ORDERFLOW-22  editing a cart line changes its price
 *   - TC-ORDERFLOW-23  the Apply-Discount switch toggles on a cart line
 *   - TC-ORDERFLOW-24  a per-line service note is accepted
 *
 * TC-22/23/24 open the per-line editor from the cart service row
 * (`HomeIds.orderServiceRows`, the clickable line the catalogue was missing —
 * added and verified live 2026-09-10). The update dialog itself was already
 * annotated (`home-update-service-*`); only the row you tap to open it was new.
 *
 * CREATES DATA: draft orders are written locally and pushed upstream by the sync
 * loop, but NO payment is taken — every draft is voided. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../src/utils/money.js';
import type { CartTotals } from '../../../src/pages/pos/HomePage.js';

/** The cart footer's own arithmetic, restated so the spec asserts it rather than trusting it. */
const expectedTotal = (t: CartTotals): number => t.subtotal - t.itemDiscount - t.promotion - t.reward + t.tax;

/** Leave the till empty for the next test, whatever state this one ended in. */
async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

describe('Order flow — Home & Cart', () => {
  describe('The three-panel till and order creation', () => {
    before(async () => {
      assertWritesAllowed('build a draft order on /home');
      await voidAnyDraft();
    });

    after(voidAnyDraft);

    it(title('The staff and service panels render populated (TC-ORDERFLOW-01)', Tag.REGRESSION), async () => {
      expect(await homePage.visibleStaffCount()).toBeGreaterThan(0);
      expect(await homePage.visibleServiceCount()).toBeGreaterThan(0);
      // A clean till has no order behind it — the assertions that follow depend
      // on starting from nothing.
      expect(await homePage.hasActiveDraft()).toBe(false);
    });

    it(
      title('A service before any staff raises "Select Staff First" (TC-ORDERFLOW-02)', Tag.REGRESSION),
      async () => {
        await homePage.addFirstService();

        expect(await homePage.isSelectStaffFirstShown()).toBe(true);
        // No staff means no order: the prompt blocks the add rather than starting one.
        await homePage.dismissSelectStaffFirst();
        expect(await homePage.hasActiveDraft()).toBe(false);
      },
    );

    it(
      title('Selecting a staff opens a draft order (TC-ORDERFLOW-77)', Tag.REGRESSION, Tag.WRITE),
      async () => {
        await homePage.selectFirstStaff();
        // The Remove affordance renders only while a draft is open, so its
        // presence is the proof the order was created.
        expect(await homePage.hasActiveDraft()).toBe(true);
      },
    );
  });

  describe('A draft with one service', () => {
    before(async () => {
      assertWritesAllowed('build a draft order on /home');
      await voidAnyDraft();
      await homePage.selectFirstStaff();
      await homePage.addFirstService();
    });

    after(voidAnyDraft);

    it(
      title('The draft is priced and payable (TC-ORDERFLOW-03)', Tag.REGRESSION, Tag.WRITE, Tag.CRITICAL),
      async () => {
        const totals = await homePage.cartTotals();
        expect(totals.subtotal).toBeGreaterThan(0);
        expectCentsEqual(totals.total, expectedTotal(totals), 'draft order total');
        expect(await homePage.hasActiveDraft()).toBe(true);
      },
    );

    it(title('The staff search filters the panel (TC-ORDERFLOW-04)', Tag.REGRESSION), async () => {
      expect(await homePage.visibleStaffCount()).toBeGreaterThan(0);

      // A term nothing matches proves the filter runs without needing a fixture
      // name; clearing it must bring the roster back.
      await homePage.searchStaff('zzzzzzzz');
      expect(await homePage.visibleStaffCount()).toBe(0);

      await homePage.searchStaff('');
      expect(await homePage.visibleStaffCount()).toBeGreaterThan(0);
    });

    it(title('The service search filters the panel (TC-ORDERFLOW-05)', Tag.REGRESSION), async () => {
      expect(await homePage.visibleServiceCount()).toBeGreaterThan(0);

      await homePage.searchService('zzzzzzzz');
      expect(await homePage.visibleServiceCount()).toBe(0);

      await homePage.searchService('');
      expect(await homePage.visibleServiceCount()).toBeGreaterThan(0);
    });

    it(title('The cart footer totals reconcile (TC-ORDERFLOW-21)', Tag.REGRESSION, Tag.WRITE), async () => {
      const totals = await homePage.cartTotals();
      expect(totals.subtotal).toBeGreaterThan(0);
      // Tax is either zero or positive, never a stray negative from a parse slip.
      expect(totals.tax).toBeGreaterThanOrEqual(0);
      expectCentsEqual(totals.total, expectedTotal(totals), 'cart total from the footer rows');
    });

    it(title('Promo & Rewards opens its dialog (TC-ORDERFLOW-18)', Tag.REGRESSION, Tag.WRITE), async () => {
      await homePage.openPromoDialog();
      expect(await homePage.isPromoDialogShown()).toBe(true);
      await homePage.closePromoDialog();
    });

    it(title('Note opens the order-note dialog (TC-ORDERFLOW-19)', Tag.REGRESSION, Tag.WRITE), async () => {
      await homePage.openNoteDialog();
      expect(await homePage.isNoteDialogShown()).toBe(true);
      await homePage.closeNoteDialog();
    });

    it(
      title('Merge Order is offered once the order has a line (TC-ORDERFLOW-20)', Tag.REGRESSION, Tag.WRITE),
      async () => {
        expect(await homePage.isMergeOrderAvailable()).toBe(true);
      },
    );

    it(title('Change Staff enters swap mode (TC-ORDERFLOW-11)', Tag.REGRESSION, Tag.WRITE), async () => {
      await homePage.pressChangeStaff();
      // The cancel affordance only unhides while a swap is in progress.
      expect(await homePage.isChangeStaffModeActive()).toBe(true);
      // Leave the draft as it was, so the after-hook's delete is clean.
      await homePage.cancelChangeStaff();
    });

    // Edit a cart line — price (TC-ORDERFLOW-22), item discount (TC-ORDERFLOW-23),
    // note (TC-ORDERFLOW-24). The per-line editor opens from the cart service row
    // (`HomeIds.orderServiceRows`, verified live 2026-09-10). Each test opens the
    // dialog fresh and leaves the line clean for the after-hook — only TC-22 saves,
    // dropping the line price, which the later two do not depend on.
    it(
      title('Editing a cart line changes its price (TC-ORDERFLOW-22)', Tag.REGRESSION, Tag.WRITE),
      async () => {
        await homePage.openServiceEditor();
        expect(await homePage.isServiceEditorShown()).toBe(true);
        // The field opens on the line's current price.
        const original = await homePage.serviceEditorPriceCents();
        expect(original).toBeGreaterThan(0);

        // Zero the field and enter a new price, then read back whatever the currency
        // mask settled on — the assertion checks the edit took AND reconciles, not
        // the mask's per-keystroke model.
        await homePage.setServiceEditorPrice(1_200);
        const edited = await homePage.serviceEditorPriceCents();
        expect(edited).not.toBe(original);
        await homePage.saveServiceEditor();

        // A single line, so the cart subtotal is exactly the edited line price.
        expectCentsEqual(await homePage.cartSubtotal(), edited, 'cart subtotal after a price edit');
      },
    );

    it(
      title('Apply Discount toggles on a cart line (TC-ORDERFLOW-23)', Tag.REGRESSION, Tag.WRITE),
      async () => {
        await homePage.openServiceEditor();

        // Flip the switch and assert the state changed, whichever way it started —
        // robust to a merchant that defaults item discount on.
        const before = await homePage.isItemDiscountOn();
        await homePage.toggleItemDiscount();
        expect(await homePage.isItemDiscountOn()).toBe(!before);

        // Leave the line untouched for the after-hook.
        await homePage.closeServiceEditor();
      },
    );

    it(
      title('A per-line service note is accepted (TC-ORDERFLOW-24)', Tag.REGRESSION, Tag.WRITE),
      async () => {
        await homePage.openServiceEditor();

        const note = 'E2E line note';
        await homePage.setServiceNote(note);
        expect(await homePage.serviceNoteValue()).toBe(note);

        await homePage.closeServiceEditor();
      },
    );
  });

  describe('Removing lines and the whole order', () => {
    before(async () => {
      assertWritesAllowed('build a draft order on /home');
      await voidAnyDraft();
      await homePage.selectFirstStaff();
      await homePage.addFirstService();
    });

    after(voidAnyDraft);

    it(
      title('Removing a staff column clears its services (TC-ORDERFLOW-12)', Tag.REGRESSION, Tag.WRITE),
      async () => {
        expect(await homePage.cartSubtotal()).toBeGreaterThan(0);

        await homePage.removeStaff();

        // Removing the only staff either empties the order or discards it; both
        // mean the priced line is gone.
        if (await homePage.hasActiveDraft()) {
          expect(await homePage.cartSubtotal()).toBe(0);
        } else {
          expect(await homePage.hasActiveDraft()).toBe(false);
        }
      },
    );

    it(title('Remove discards the whole draft (TC-ORDERFLOW-78)', Tag.REGRESSION, Tag.WRITE), async () => {
      // The previous test may have left the till empty; rebuild a draft to delete.
      if (!(await homePage.hasActiveDraft())) {
        await homePage.selectFirstStaff();
        await homePage.addFirstService();
      }
      expect(await homePage.hasActiveDraft()).toBe(true);

      await homePage.deleteOrder();
      expect(await homePage.hasActiveDraft()).toBe(false);
    });
  });
});
