/**
 * VP-4802 — the Promo & Rewards trigger on Create Order shows how many offers
 * the order can take: unused, unexpired promotions of the customer + rewards
 * the customer's points afford (volt-pos#3109, `countAvailablePromoRewards`).
 *
 * TC doc: docs/qc/volt-qc/vp-tickets/VP-4802-promo-rewards-count-test-cases.md (TC-VP4802-01..14)
 *
 * The expected number is NOT hard-coded (the manual pass saw 10 / 5 / 3 on the
 * 26/10 data): it is recomputed per case through the app's own GraphQL IPC with
 * the very filters `use-promotion.ts` sends, then compared with the badge AND
 * with the rows the dialog lists. Customer data:
 *   - VP4802_CUSTOMER_PHONE         a customer with ≥ 1 unused promotion (TC-02/06/07/08/09/10)
 *   - VP4802_POINTS_CUSTOMER_PHONE  a customer with points (TC-05)
 * both falling back to LOYALTY_CUSTOMER_PHONE; a case whose data is missing skips
 * with the reason. TC-07 consumes a promotion → opt-in VP4802_CONSUME_PROMO=1.
 *
 * CREATES DATA: pending orders (deleted in `after`), one new 0-point customer per
 * run (TC-04), and with VP4802_CONSUME_PROMO=1 one Cash-paid order. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { VpPromoTrigger } from '../../../src/constants/testids.vp-promo-gc.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  homeCustomerStats,
  removeCustomerFromOrder,
} from '../../../src/pages/voltqc/promo-split/promoFlows.js';
import * as S from '../../../src/pages/voltqc/promo-split/splitFlows.js';
import { app, randomPhone, uniqueName, vqEnv } from '../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  addGiftCardTopUp,
  applyPromo,
  attachCustomer,
  badgeText,
  closePromoDialog,
  customerPromotions,
  dialogOfferCount,
  expectedOfferCount,
  openPromoDialog,
  orderSnapshot,
  quickPayLinesOrder,
  readPromoBadge,
  selectOffer,
  vpCustomerPhone,
  vpGiftCardCode,
  waitPromoBadge,
} from './vp-promo-gc.helpers.js';

const lineName = (tc: string): string => `QC VP4802 ${tc}-${String(Date.now()).slice(-5)}`;

/** The customer id the open order carries (from the saved order row). */
async function customerIdOf(code: string): Promise<string> {
  return (await orderSnapshot(code))?.customerId ?? '';
}

/** The open Promo & Rewards dialog's text (whitespace-collapsed). */
async function dialogText(): Promise<string> {
  return ((await P.rawText(VpPromoTrigger.dialog)) ?? '').replace(/\s+/g, ' ');
}

describe('VP-4802 — Promo & Rewards shows the number of available promotions + rewards', () => {
  before(function (this: Mocha.Context): void {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create pending orders and a test customer');
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await app.closeStrayDialogs().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders().catch(() => undefined);
  });

  /* ----------------------------------------------------------------------- */
  describe('1. With / without a customer', () => {
    let withCustomerCode = '';

    it(
      title(
        'TC-VP4802-01: no customer → no badge; dialog says "No promotions available" / "No rewards available"',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        await quickPayLinesOrder([{ cents: 1000, name: lineName('01') }]);
        expect(await waitPromoBadge(0)).toBe('');
        await openPromoDialog();
        const t = await dialogText();
        expect(t).toContain(VpPromoTrigger.noPromotions);
        expect(t).toContain(VpPromoTrigger.noRewards);
        expect(await dialogOfferCount()).toBe(0);
        await closePromoDialog();
      },
    );

    it(
      title(
        'TC-VP4802-02: customer with promotions + rewards → badge = promotions + affordable rewards = dialog rows',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const phone = vpCustomerPhone('VP4802_CUSTOMER_PHONE');
        if (!phone) this.skip();
        const code = await quickPayLinesOrder([{ cents: 1000, name: lineName('02') }]);
        const points = await attachCustomer(phone);
        const exp = await expectedOfferCount(await customerIdOf(code), points);
        if (exp.promotions === 0) this.skip(); // ⚠️ needs a customer with ≥ 1 unused promotion
        withCustomerCode = code;

        expect(await waitPromoBadge(exp.total)).toBe(badgeText(exp.total));
        await openPromoDialog();
        expect(await dialogOfferCount()).toBe(exp.total);
        await closePromoDialog();
      },
    );

    it(
      title('TC-VP4802-03: removing the customer removes the badge', Tag.REGRESSION, Tag.WRITE),
      async function () {
        this.timeout(2 * 60_000);
        if (!withCustomerCode) this.skip();
        await removeCustomerFromOrder();
        expect(await waitPromoBadge(0)).toBe('');
      },
    );

    it(
      title(
        'TC-VP4802-04: new 0-point customer → badge = 0-point rewards only, no promotion',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const code = await quickPayLinesOrder([{ cents: 1000, name: lineName('04') }]);
        await app.attachNewCustomer(randomPhone(), uniqueName('QC VPfoureight'));
        await app.customerConfirmPhone();
        const points = (await homeCustomerStats()).point;
        expect(points).toBe(0);
        const exp = await expectedOfferCount(await customerIdOf(code), 0);

        expect(await waitPromoBadge(exp.total)).toBe(badgeText(exp.total));
        await openPromoDialog();
        if (exp.promotions === 0) expect(await dialogText()).toContain(VpPromoTrigger.noPromotions);
        expect(await dialogOfferCount()).toBe(exp.total);
        await closePromoDialog();
      },
    );

    it(
      title(
        'TC-VP4802-05: customer with points → only rewards with point ≤ points are counted',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const phone = vpCustomerPhone('VP4802_POINTS_CUSTOMER_PHONE');
        if (!phone) this.skip();
        const code = await quickPayLinesOrder([{ cents: 1000, name: lineName('05') }]);
        const points = await attachCustomer(phone);
        const exp = await expectedOfferCount(await customerIdOf(code), points);

        expect(await waitPromoBadge(exp.total)).toBe(badgeText(exp.total));
        await openPromoDialog();
        expect(await dialogOfferCount()).toBe(exp.total);
        await closePromoDialog();
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('2. Applying / using a promotion', () => {
    let code = '';
    let phone = '';
    let usedCampaign = '';
    let countBefore = 0;

    it(
      title('TC-VP4802-06: applying a promotion keeps the badge number', Tag.REGRESSION, Tag.WRITE),
      async function () {
        this.timeout(3 * 60_000);
        phone = vpCustomerPhone('VP4802_CUSTOMER_PHONE');
        if (!phone) this.skip();
        code = await quickPayLinesOrder([{ cents: 1000, name: lineName('06') }]);
        const points = await attachCustomer(phone);
        const customerId = await customerIdOf(code);
        const promos = await customerPromotions(customerId);
        const first = promos[0];
        if (!first) this.skip(); // ⚠️ needs a customer with ≥ 1 unused promotion
        if (!first) return;
        const exp = await expectedOfferCount(customerId, points);
        countBefore = exp.total;
        expect(await waitPromoBadge(countBefore)).toBe(badgeText(countBefore));

        await openPromoDialog();
        await selectOffer(first.name);
        await applyPromo();
        usedCampaign = first.name;
        expect((await app.orderTotals()).promotion).toBeLessThan(0);
        expect(await waitPromoBadge(countBefore)).toBe(badgeText(countBefore));
      },
    );

    it(
      title(
        'TC-VP4802-07: after paying, the used promotion is no longer counted on a new order',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(5 * 60_000);
        if (process.env.VP4802_CONSUME_PROMO !== '1') this.skip(); // consumes the customer's promotion
        if (!code || !usedCampaign) this.skip();

        await app.payCurrentOrder('Cash');
        await app.noReceipt();

        const next = await quickPayLinesOrder([{ cents: 1000, name: lineName('07') }]);
        const points = await attachCustomer(phone);
        const customerId = await customerIdOf(next);
        const promos = await customerPromotions(customerId);
        expect(promos.map((p) => p.name)).not.toContain(usedCampaign);
        const exp = await expectedOfferCount(customerId, points);

        expect(await waitPromoBadge(exp.total)).toBe(badgeText(exp.total));
        await openPromoDialog();
        expect(
          await P.has([VpPromoTrigger.dialog, { css: VpPromoTrigger.offerRowCss, hasText: usedCampaign }]),
        ).toBe(false);
        expect(await dialogOfferCount()).toBe(exp.total);
        await closePromoDialog();
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('3. Gift card', () => {
    let gcCode = '';
    let phone = '';

    it(
      title(
        "TC-VP4802-08: gift-card-only order → no badge; dialog says promotions and rewards don't apply",
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        phone = vpCustomerPhone('VP4802_CUSTOMER_PHONE');
        if (!phone || !vpGiftCardCode()) this.skip();
        await app.quickCheckout();
        await attachCustomer(phone);
        await addGiftCardTopUp(25);
        gcCode = await app.orderId();
        app.createdOrders.add(gcCode);

        expect(await waitPromoBadge(0)).toBe('');
        await openPromoDialog();
        expect(await dialogText()).toContain(VpPromoTrigger.giftCardOnly);
        expect(await dialogOfferCount()).toBe(0);
        await closePromoDialog();
      },
    );

    it(
      title(
        'TC-VP4802-09: adding a service to the gift-card order brings the badge back',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        if (!gcCode) this.skip();
        await app.pickStaff(vqEnv.testStaff);
        await S.addQuickPay({ cents: 1000, name: lineName('09') });
        const points = (await homeCustomerStats()).point;
        const exp = await expectedOfferCount(await customerIdOf(gcCode), points);
        expect(await waitPromoBadge(exp.total)).toBe(badgeText(exp.total));
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('4. Pending order', () => {
    it(
      title(
        'TC-VP4802-10: re-opening a pending order with a customer shows the right number',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const phone = vpCustomerPhone('VP4802_CUSTOMER_PHONE');
        if (!phone) this.skip();
        const code = await quickPayLinesOrder([{ cents: 1000, name: lineName('10') }]);
        const points = await attachCustomer(phone);
        const exp = await expectedOfferCount(await customerIdOf(code), points);

        // Leave it pending: start another order, then open this one from the Pending sidebar.
        await app.quickCheckout();
        await app.openPendingOrder(code);
        expect(await app.orderId()).toBe(code);

        expect(await waitPromoBadge(exp.total)).toBe(badgeText(exp.total));
        expect(await readPromoBadge()).toBe(badgeText(exp.total));
        await openPromoDialog();
        expect(await dialogOfferCount()).toBe(exp.total);
        await closePromoDialog();
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('5. Not automatable here / documentation', () => {
    it(
      title(
        'TC-VP4802-11: more than 99 offers shows "99+" — PENDING 🧱 (no customer with ≥ 100 offers on dev)',
      ),
    );

    it(
      title(
        'TC-VP4802-12: a promotion assigned on Portal / another POS updates the badge live — PENDING 🧱 (Portal needs Google 2FA)',
      ),
    );

    it(
      title(
        'TC-VP4802-13: inactive / not-yet-started promotion is (not) counted — PENDING 🧱 (needs Portal set-up + PO decision)',
      ),
    );

    it(
      title(
        'TC-VP4802-14: the badge never shows half the sum while loading — PENDING 📄 (code review of isCountReady)',
      ),
    );
  });
});
