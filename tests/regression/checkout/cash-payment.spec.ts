/**
 * A cash sale, end to end, with the change checked to the cent.
 *
 * CREATES DATA AND TAKES A PAYMENT: an order is created, tendered and closed.
 * dev / staging only — `Tag.WRITE` plus `Tag.PAYMENT`, and the flows carry
 * `assertWritesAllowed()`.
 *
 * The oracle is the app's own shared tender module: `computeCashChange` is
 * `max(0, tendered - due)` and `remainingAmount` is `min(0, tendered - due)`
 * rendered through `Math.abs()`. Both are asserted below in integer cents, so a
 * float regression on either shows up as a named difference rather than as a
 * receipt nobody reads.
 */

import { expect } from '@wdio/globals';
import { createOrder, payInCash, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { checkoutPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual } from '../../../src/utils/money.js';

/**
 * The full cash tender typed in — comfortably above the order total, and 9-free.
 *
 * This build's checkout keypad renders the preset column ON TOP of the digit
 * column, so the "$50" button physically covers the "9" key and typing any amount
 * containing a 9 stalls on "9 still not clickable" (see the checkout-keypad-
 * preset-overlap note). The presets ALSO replace the entry rather than add to it,
 * so change can no longer be dialled in by preset. Typing a fixed 9-free amount
 * ($888.88) over-tenders any order and the change is then `tendered - due`.
 */
const OVER_TENDER_CENTS = 88_888;

describe('Checkout — cash', () => {
  before(async () => {
    await returnToHome();
    await createOrder();
  });

  it(
    title(
      'A cash over-tender computes the change to the cent and closes the order',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.CRITICAL,
    ),
    async () => {
      // `createOrder()` in the before hook already presses Pay and leaves the app
      // on `/order/{id}/checkout` (see order.flow.ts) — pressing Pay again here
      // would click the card tender's Complete Payment button, which is disabled
      // until the customer-display handoff and so never becomes clickable. Take
      // the checkout the flow already opened.
      const checkout = await step('Open checkout', async () => {
        await checkoutPage.waitForReady();
        return checkoutPage;
      });

      const orderId = await checkout.orderId();

      // The amount due differs by tender — the card tab carries the service fee,
      // the cash tab the cash discount — and the entry field pre-fills the due
      // for the SELECTED tender. So select cash FIRST, then read the total: read
      // on the card tab it opens on, the two legitimately differ (live: card
      // $14.51 vs cash $13.19) and this looks like a part-paid order when it is
      // not.
      await checkout.selectTender('cash');
      const totalCents = await checkout.totalCents();
      expect(totalCents).toBeGreaterThan(0);

      // `checkout/index.tsx` re-runs `setAmount(remaining)` on every change of
      // method, remaining or tip, so the entry field arrives holding the full
      // amount due — paying in full means pressing Complete Payment and typing
      // nothing. On an order with no earlier tender that pre-fill IS the total,
      // and a mismatch here means the order is already part-paid.
      expectCentsEqual(await checkout.enteredAmountCents(), totalCents, 'pre-filled amount due');

      // The Change row is rendered only while change is above zero, so an exact
      // tender must not show it. Asserting its absence first is what makes the
      // later assertion that it appeared meaningful.
      expect(await checkout.isChangeShown()).toBe(false);

      // Over-tender by TYPING a fixed 9-free amount ($888.88). setCashTendered
      // refuses any amount with a 9 (the "$50" preset covers that key) and clears
      // the field before typing, so the entry lands on exactly the tender and the
      // change is `tendered - due` whatever the order total happens to be.
      await step('Over-tender by typing $888.88 (9-free)', () => checkout.setCashTendered(OVER_TENDER_CENTS));
      const tenderedCents = OVER_TENDER_CENTS;

      expectCentsEqual(await checkout.enteredAmountCents(), tenderedCents, 'entered cash amount');
      expect(await checkout.isChangeShown()).toBe(true);
      expectCentsEqual(
        await checkout.changeCents(),
        tenderedCents - totalCents,
        'change owed back to the customer',
      );

      // Over-tendering must not leave the order believing it is still owed
      // money: `remainingAmount` clamps at zero on the high side. This separates
      // "the change was computed" from "the balance was cleared".
      expectCentsEqual(await checkout.remainingCents(), 0, 'remaining owed after an over-tender');

      // Settle on the amount already in the field. payInCash WITHOUT tenderedCents
      // presses Complete Payment on the current entry rather than re-typing it —
      // re-typing an $XX.X9 amount would hit the covered "9" key again.
      const success = await payInCash(orderId);

      expect(await success.orderId()).toBe(orderId);
      expect(await success.isActive()).toBe(true);
    },
  );
});
