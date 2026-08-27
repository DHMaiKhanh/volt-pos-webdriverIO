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
import { homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { expectCentsEqual, formatMoney } from '../../../src/utils/money.js';

/** What the customer hands over above the amount due: $20.00. */
const OVERPAY_CENTS = 2_000;

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
      const checkout = await step('Open checkout', () => homePage.pressPay());
      await checkout.waitForReady();

      const orderId = await checkout.orderId();
      const totalCents = await checkout.totalCents();
      expect(totalCents).toBeGreaterThan(0);

      await checkout.selectTender('cash');

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

      const tenderedCents = totalCents + OVERPAY_CENTS;
      await step(`Tender ${formatMoney(tenderedCents)} in cash`, () => checkout.enterAmount(tenderedCents));

      expectCentsEqual(await checkout.enteredAmountCents(), tenderedCents, 'entered cash amount');
      expect(await checkout.isChangeShown()).toBe(true);
      expectCentsEqual(await checkout.changeCents(), OVERPAY_CENTS, 'change owed back to the customer');

      // Over-tendering must not leave the order believing it is still owed
      // money: `remainingAmount` clamps at zero on the high side. This separates
      // "the change was computed" from "the balance was cleared".
      expectCentsEqual(await checkout.remainingCents(), 0, 'remaining owed after an over-tender');

      // Completion is handed back to the flow rather than pressed here: the
      // write rail and the `completed_payment` passcode guard belong on that
      // side of the layering. Re-passing the same tender is safe because
      // `enterAmount()` clears the field before typing.
      const success = await payInCash(orderId, { tenderedCents });

      expect(await success.orderId()).toBe(orderId);
      expect(await success.isActive()).toBe(true);
    },
  );
});
