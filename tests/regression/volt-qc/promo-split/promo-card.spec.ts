/**
 * volt-qc port — 04 PROMO: a gift-card top-up paid with a REAL card (PROMO-C1).
 *
 * Source: volt-qc `e2e/tests/04-promo/promo-plan-card.spec.ts`.
 * TC catalogue: docs/qc/volt-qc/windows-regression/04-khuyen-mai-diem-giftcard.md.
 *
 * Gated on CARD_SETTLE=1 (`vqEnv.cardSettle`) — a real charge needs a connected
 * Bamboo DOT terminal and an operator, like tests/regression/order-flow/card-payment.spec.ts.
 * The card is `VOLT_TEST_GIFT_CARD` (topped up by $25). The charge itself goes
 * through the shared `payWithCard` flow (passcode, customer tip, signatures, settle).
 *
 * Known DEV issue kept as a hard assert (volt-qc used expect.soft): bug #32 — the
 * Card button adds the Service Fee on the gift-card line ($25.00 → $27.50).
 *
 * TAKES A REAL CARD PAYMENT. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { VqcGiftCard, btn } from '../../../../src/constants/testids.voltqc-pos.js';
import { payWithCard } from '../../../../src/flows/index.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  giftCardCooldown,
  markGiftCardUse,
  settledGiftCardBalance,
  waitGiftCardBalance,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import { app, cents, usd, vqEnv } from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

describe('volt-qc 04 PROMO — gift card paid by card (PROMO-C1)', () => {
  before(() => {
    assertWritesAllowed('top up a gift card paid by card (volt-qc 04 PROMO)');
  });

  afterEach(async () => {
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders();
  });

  it(
    title(
      'PROMO-C1 Top up $25 paid by Card: Card button = $25.00 (no Service Fee), Payment Successful, card balance + $25 (PROMO-179)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn('Needs VOLT_TEST_GIFT_CARD');
        this.skip();
      }
      if (!vqEnv.cardSettle) {
        console.warn(
          'Real card charge is off — set CARD_SETTLE=1 (Bamboo DOT connected, operator at the terminal)',
        );
        this.skip();
      }
      this.timeout(6 * 60_000);
      const code = vqEnv.testGiftCard;
      await giftCardCooldown();
      const before = await settledGiftCardBalance(code);

      await app.quickCheckout();
      await app.openSellGiftCard();
      const dlg = VqcGiftCard.dialog;
      await P.fillQ([dlg, VqcGiftCard.codeBox], code);
      await P.waitFor([dlg, { textRe: 'Balance: \\$', nth: 0 }], 10_000, 'gift card Balance');
      await P.clickQ([dlg, btn('$25')]);
      await P.clickQ([dlg, VqcGiftCard.add]);
      await P.waitGoneQ(dlg, 8_000, 'Sell Gift Card');
      const id = await app.orderId();
      app.createdOrders.add(id);
      await app.pay();
      const card = await app.methodAmount('Card');
      const cash = await app.methodAmount('Cash');
      console.warn(
        `[info] order ${id}: Card ${usd(card)} / Cash ${usd(cash)} (${cents(card)}¢ / ${cents(cash)}¢)`,
      );
      // bug #32: Card adds the Service Fee on the gift-card line ($27.50) — volt-qc kept this soft.
      expect(card).toBeCloseTo(25, 2);
      expect(cash).toBeCloseTo(25, 2);

      await payWithCard(id);
      markGiftCardUse();
      const t = await app.successText();
      expect(t).toContain(`Card | (Credit) | ${usd(card)}`);
      await app.noReceipt();
      app.createdOrders.delete(id);

      const after = await waitGiftCardBalance(code, before + 25);
      console.warn(`[info] balance ${code}: ${usd(before)} → ${usd(after)}`);
      // The balance grows by exactly the face value (no fee).
      expect(after - before).toBeCloseTo(25, 2);
    },
  );
});
