/**
 * volt-qc port — 04 PROMO: selling / topping up a gift card into an order
 * (PROMO-O / O3 / O2 / L / P).
 *
 * Source: volt-qc `e2e/tests/04-promo/promo-plan-giftcard-sell.spec.ts` — every test
 * except PROMO-N (the read-only dialog walk, already ported in
 * tests/regression/volt-qc/pos/promo.spec.ts).
 * TC catalogue: docs/qc/volt-qc/windows-regression/04-khuyen-mai-diem-giftcard.md.
 *
 * Data: the card is `VOLT_TEST_GIFT_CARD` (an Active card on THIS merchant); unset →
 * every case skips. Money is compared in DOLLARS, except the Sell Gift Card summary
 * (`gcSummary`), which reads CENTS.
 *
 * Known DEV issues kept as hard asserts (volt-qc used expect.soft):
 * - bug #32 — the gift-card line on Home carries the Card Service Fee ($90 → $99).
 * - bug #17 — clicking a gift-card line of an unpaid order does not reopen the editor.
 *
 * CREATES DATA (pending orders, deleted afterwards; PROMO-P tops the card up by $25 in Cash).
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { VqcGiftCard, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsHome, VqpsPromo } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  closeSellGiftCard,
  gcAdd,
  gcBonusOrDiscount,
  gcCodeBox,
  gcEnterCode,
  gcIn,
  gcQuick,
  gcSummary,
} from '../../../../src/pages/voltqc/pos/giftCardProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  gcLine,
  gcLineSrc,
  openSellFresh,
  removeStaffBlock,
} from '../../../../src/pages/voltqc/promo-split/giftCardExtra.js';
import {
  addGiftCardLine,
  checkoutBack,
  closeDialogX,
  createQuickPayOrder,
  customDiscountSplit,
  inPromo,
  openPromo,
  pollValue,
  promoApply,
  settledGiftCardBalance,
  waitGiftCardBalance,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import {
  app,
  appears,
  escapeRe,
  money,
  pick,
  randomPhone,
  uniqueName,
  vqEnv,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const CODE = vqEnv.testGiftCard;
const NO_CARD = 'VOLT_TEST_GIFT_CARD is not set (an Active gift card on this merchant)';

/** Price on the "Gift Card [****-****-xxxx] | $x" line of the main text. */
const gcLinePrice = (t: string, code: string): number =>
  money(new RegExp(`${gcLineSrc(code)} \\| (\\$[\\d,.]+)`).exec(t)?.[1]);

describe('volt-qc 04 PROMO — sell / top up a gift card (PROMO-O/O3/O2/L/P)', () => {
  before(() => {
    assertWritesAllowed('sell / top up gift cards (volt-qc 04 PROMO)');
  });

  afterEach(async () => {
    await closeSellGiftCard().catch(() => undefined);
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders();
  });

  it(
    title(
      'PROMO-O Gift card into an order: Store line = Customer Pays, duplicate code blocked, Gift Card & Split locked, Store removed (PROMO-124, PROMO-125, PROMO-129, PROMO-133, PROMO-134)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(5 * 60_000);
      let id = '';

      await step(
        'PROMO-124 $100 + Discount 10% → Add: Store group with "Gift Card [****-****-xxxx]" $90.00, pending card shows the line',
        async () => {
          await openSellFresh();
          await gcEnterCode(CODE);
          await P.clickQ(gcQuick('$100'));
          await gcBonusOrDiscount('Discount', '%', '10');
          await P.clickQ(gcAdd);
          await P.waitGoneQ(VqcGiftCard.dialog, 8_000, 'Sell Gift Card');
          id = await app.orderId();
          app.createdOrders.add(id);
          const t = await app.text('main');
          expect(t).toContain('Store');
          // bug #32 (DEV $99.00) — volt-qc kept this soft.
          expect(t).toMatch(new RegExp(`${gcLineSrc(CODE)} \\| \\$90\\.00`));
          const box = [VqpsHome.pendingSidebar, { role: 'textbox', nth: 0 }] as const;
          await P.fillQ(box, id);
          const card = [VqpsHome.pendingSidebar, { role: 'button', nameRe: `^${id}`, nth: 0 }] as const;
          await P.waitFor(card, 10_000, `pending card ${id}`);
          expect(await P.textOf(card)).toMatch(new RegExp(gcLineSrc(CODE)));
          await P.fillQ(box, '');
        },
      );

      await step('PROMO-125 same code again in this order → "already been added", Add disabled', async () => {
        await app.openSellGiftCard();
        await gcEnterCode(CODE);
        expect(
          await appears(
            gcIn({
              text: 'This gift card has already been added in this order. Please edit the existing amount instead.',
              nth: 0,
            }),
            5_000,
          ),
        ).toBe(true);
        await P.clickQ(gcQuick('$25'));
        expect(await P.isDisabled(gcAdd)).toBe(true);
        await closeSellGiftCard();
      });

      await step(
        'PROMO-133 / PROMO-134 Split locked; checkout Gift Card says a gift card cannot buy a gift card',
        async () => {
          expect(await P.isDisabled(VqpsHome.splitButton)).toBe(true);
          await app.pay();
          expect(
            await appears(
              inMain({
                textRe: escapeRe('Cannot use Gift Card to buy a Gift Card. Use another payment method.'),
                nth: 0,
              }),
              10_000,
            ),
          ).toBe(true);
          expect(await P.isDisabled(inMain({ role: 'button', nameRe: '^Gift Card', nth: 0 }))).toBe(true);
          await checkoutBack();
        },
      );

      await step(
        'PROMO-129 add a service → remove the Store block: "Remove Store" + prompt; gift card gone, service kept',
        async () => {
          await app.openPendingOrder(id);
          await app.pickStaff(vqEnv.testStaff);
          await app.addService(vqEnv.testService);
          await removeStaffBlock('Store');
          const rm = { role: 'dialog', name: 'Remove Store', nth: -1 } as const;
          await P.waitFor(rm, 5_000, 'Remove Store');
          expect(
            await P.has([
              rm,
              { text: 'Are you sure you want to remove this store and all products/gift cards?', nth: 0 },
            ]),
          ).toBe(true);
          await P.clickQ([rm, { role: 'button', name: 'Remove' }]);
          await P.waitGoneQ(rm, 8_000, 'Remove Store');
          await app.idle(100);
          expect(await P.count(gcLine(CODE))).toBe(0);
          expect(await app.itemRowCount(vqEnv.testService)).toBe(1);
        },
      );
    },
  );

  it(
    title(
      'PROMO-O3 Click the gift card line → Sell Gift Card reopens with the code, no duplicate warning → $50 → Add: line updated (PROMO-128)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(3 * 60_000);
      // bug #17: on DEV the line of an unpaid order does not open the editor.
      await app.quickCheckout();
      await addGiftCardLine(CODE, 100);
      app.createdOrders.add(await app.orderId());
      await P.clickQ(inMain({ textRe: gcLineSrc(CODE), nth: 0 }));
      await P.waitFor(VqcGiftCard.dialog, 8_000, 'Sell Gift Card');
      expect((await P.inputValue(gcCodeBox)).replace(/\D/g, '')).toBe(CODE.replace(/\D/g, ''));
      expect(await P.count(gcIn({ textRe: 'already been added' }))).toBe(0);
      await P.clickQ(gcQuick('$50'));
      const pays = (await gcSummary()).customerPays / 100;
      await P.clickQ(gcAdd);
      await P.waitGoneQ(VqcGiftCard.dialog, 8_000, 'Sell Gift Card');
      const price = await pollValue(
        async () => gcLinePrice(await app.text('main'), CODE),
        (v) => Math.abs(v - pays) < 0.005,
        10_000,
      );
      expect(price).toBeCloseTo(pays, 2);
    },
  );

  // DEV: order B still allows Add with the same card (only duplicates inside ONE order are blocked).
  // PROMO-127 says "to confirm" — recorded as an observation, not covered.
  it(
    title(
      'PROMO-O2 Same card on 2 pending orders: DEV still allows Add on order B (observation)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(3 * 60_000);
      await app.quickCheckout();
      await addGiftCardLine(CODE, 25);
      app.createdOrders.add(await app.orderId());
      await openSellFresh();
      await gcEnterCode(CODE);
      await P.clickQ(gcQuick('$25'));
      const blocked = await P.isDisabled(gcAdd);
      console.warn(
        `[observation] PROMO-127 dev: order B ${blocked ? 'IS BLOCKED' : 'STILL ALLOWS Add'} for the same card`,
      );
      expect(blocked).toBe(false);
      await closeSellGiftCard();
    },
  );

  it(
    title(
      'PROMO-L Gift-card-only order: no promotion/reward; service + gift card order: % only on the service (PROMO-072, PROMO-074)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(5 * 60_000);

      await step(
        'PROMO-072 gift card $50 + customer → "Promotions and rewards don\'t apply to gift cards", no Custom/split, Apply disabled',
        async () => {
          await app.quickCheckout();
          await addGiftCardLine(CODE, 50);
          app.createdOrders.add(await app.orderId());
          await app.attachNewCustomer(randomPhone(), uniqueName('QC E2E'));
          await app.customerConfirmPhone();
          await openPromo();
          expect(await P.count(inPromo({ text: VqpsPromo.giftOnly }))).toBe(2);
          expect(await P.count(inPromo({ text: 'Custom Discount' }))).toBe(0);
          expect(await P.count(inPromo({ text: VqpsPromo.splitSetting }))).toBe(0);
          expect(await P.isDisabled(promoApply)).toBe(true);
          await closeDialogX();
        },
      );

      await step(
        'PROMO-074 Quick Pay $50 + gift card $100 → Custom 10% → Promotion -$5.00, gift card line $100.00',
        async () => {
          // bug #32: the $100 gift-card line on Home can read $110.00 (Service Fee added).
          const id = await createQuickPayOrder([{ amount: 50, name: 'QC Promo L' }]);
          await addGiftCardLine(CODE, 100);
          await app.openPendingOrder(id);
          await customDiscountSplit('%', 10);
          const t = await app.text('main');
          // The % is taken on the service base price ($50) only, never on the gift card.
          expect(pick(t, 'Promotion')).toBeCloseTo(-5, 2);
          expect(t).toMatch(new RegExp(`${gcLineSrc(CODE)} \\| \\$100\\.00`));
        },
      );
    },
  );

  it(
    title(
      'PROMO-P Top up an Active card by $25: balance + $25.00, history shows the new Order ID (PROMO-138)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!CODE) {
        console.warn(NO_CARD);
        this.skip();
      }
      this.timeout(4 * 60_000);
      // Top-ups land asynchronously (bug #6): read a settled balance, then poll up to 60 s for +$25.
      const b0 = await settledGiftCardBalance(CODE);
      const orderId = await app.topUpGiftCard(CODE, 25);
      const b1 = await waitGiftCardBalance(CODE, b0 + 25);
      expect(b1).toBeCloseTo(b0 + 25, 2);
      await openSellFresh();
      await gcEnterCode(CODE);
      await P.clickQ(gcIn({ role: 'button', name: 'View Details' }));
      const det = VqcGiftCard.detailsDialog;
      await P.waitFor(det, 10_000, 'Gift Card Details');
      expect(await appears([det, { textRe: escapeRe(orderId), nth: 0 }], 15_000)).toBe(true);
      await P.clickQ([det, { role: 'button', name: 'Close', nth: 0 }]);
      await P.waitGoneQ(det, 5_000, 'Gift Card Details');
      await closeSellGiftCard();
    },
  );
});
