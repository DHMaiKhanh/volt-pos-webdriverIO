/**
 * VP-5627 — Discount Setting: default Owner/Staff split for Custom promotion
 * (POS half). PRs volt-pos#3320, fastboy-portal#953, volt-pos-api#1623.
 *
 * docs/qc/volt-qc/vp-tickets/VP-5627-custom-promotion-default-split-test-cases.md (TC-VP5627-08..20)
 * Portal half (TC-01..07): tests/web/portal-vp-5627-custom-promo-split.spec.ts
 *
 *   npm run app:launch
 *   npm run test:attach -- --spec tests/regression/settings/vp-5627-custom-promo-split.spec.ts
 *
 * Cases run in order and share state: TC-10 sets Custom 60/40, TC-12/13 use one
 * order, TC-17 pays one order in Cash and moves Custom to 50/50, TC-20 puts the
 * store's original Custom split back. Pending orders are deleted after each case.
 *
 * CREATES DATA (draft orders, one Cash payment, store setting) — dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { inMain } from '../../../src/constants/testids.voltqc-pos.js';
import { step } from '../../../src/helpers/steps.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  applyPromo,
  closeDialogX,
  fillCustom,
  itemDiscount,
  openPromo,
  promoSplitInputs,
} from '../../../src/pages/voltqc/promo-split/promoFlows.js';
import { app, waitUntil } from '../../../src/pages/voltqc/promo-split/vqApp.js';
import { PortalDiscountSettingCdp } from '../../../src/pages/web/PortalDiscountSettingCdp.js';
import { settle } from '../../../src/helpers/wait.js';
import { PortalCdp } from '../../../src/support/portal/PortalCdp.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  SUBTITLE,
  TOTAL_ERROR_RE,
  attachCustomer,
  chargeFee,
  chargeFeeValues,
  closePromoIfOpen,
  openChargeFee,
  promoRow,
  readOrder,
  readSettings,
  setCustomOnPos,
  typeCustom,
  vp5627,
  waitOrder,
  type PromoSettings,
} from './vp-5627.helpers.js';

const SHOT_DIR = '.playwright-mcp/VP-5627';

/** Staff fee (cents) of a 10% promotion on a line of `price` dollars at `staffPct`. */
const fee10 = (price: number, staffPct: number): number => Math.floor((price * 10 * staffPct) / 100);

async function splitValues(): Promise<[number, number]> {
  const { owner, staff } = await promoSplitInputs();
  return [Number(await P.inputValue(owner)), Number(await P.inputValue(staff))];
}

describe('VP-5627 — POS Discount Setting: Custom promotion default split', () => {
  let original: PromoSettings;
  let orderA = '';
  let priceA = 0;

  before(async () => {
    assertWritesAllowed('change the store promotion split and create orders');
    original = await readSettings();
    console.warn(`VP5627 original split = ${JSON.stringify(original)}`);
  });

  afterEach(async () => {
    await closePromoIfOpen();
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders().catch(() => undefined);
  });

  after(async () => {
    if (original && Number.isFinite(original.custom))
      await setCustomOnPos(original.custom).catch(() => undefined);
  });

  /* ---------------------------- Charge & Fee ---------------------------- */

  it(
    title('POS: Discount Setting shows both sections + new subtitle (TC-VP5627-08)', Tag.REGRESSION),
    async () => {
      await step('Setting › Charge & Fee', () => openChargeFee());
      expect(await P.has(inMain({ text: SUBTITLE, nth: 0 }))).toBe(true);
      expect(await P.has(inMain({ text: 'Available promotions', nth: 0 }))).toBe(true);
      expect(await P.has(inMain({ text: 'Custom promotion', nth: 0 }))).toBe(true);
      const v = await chargeFeeValues();
      expect(v.a).toEqual([original.available, 100 - original.available]);
      expect(v.c).toEqual([original.custom, 100 - original.custom]);
    },
  );

  it(
    title('POS: total other than 100 shows an error and locks Save (TC-VP5627-09)', Tag.REGRESSION),
    async () => {
      await openChargeFee();
      await step('Custom 60 / 30', () => typeCustom(60, 30));
      expect(await P.has(inMain({ textRe: TOTAL_ERROR_RE, nth: 0 }))).toBe(true);
      expect(await P.isDisabled(chargeFee.save)).toBe(true);
      expect((await readSettings()).custom).toBe(original.custom);
    },
  );

  it(title('POS: save Custom 60/40 (TC-VP5627-10)', Tag.REGRESSION), async () => {
    await step('Save 60 / 40', () => setCustomOnPos(60));
    await step('Reopen Charge & Fee', async () => {
      await app.go('/home');
      await openChargeFee();
    });
    const v = await chargeFeeValues();
    expect(v.c).toEqual([60, 40]);
    expect(v.a).toEqual([original.available, 100 - original.available]);
    const s = await readSettings();
    expect(s.custom).toBe(60);
    expect(s.available).toBe(original.available);
  });

  /* ------------------------- Promo & Rewards / order ------------------------- */

  it(title('Promo & Rewards pre-fills the store Custom split (TC-VP5627-11)', Tag.REGRESSION), async () => {
    orderA = await app.createOrder({ services: [vp5627.service] });
    priceA = await app.basePrice(vp5627.service);
    await openPromo();
    await fillCustom('%', '10');
    expect(await splitValues()).toEqual([60, 40]);
    await closeDialogX();
    // TC-12/13 keep working on this order — keep it out of the per-case cleanup.
    app.createdOrders.delete(orderA);
  });

  it(
    title('Split left collapsed → order stores the Custom default (TC-VP5627-12)', Tag.CRITICAL),
    async () => {
      if (!orderA) {
        orderA = await app.createOrder({ services: [vp5627.service] });
        priceA = await app.basePrice(vp5627.service);
        app.createdOrders.delete(orderA);
      }
      await step('Custom 10% → Apply (split not opened)', async () => {
        await openPromo();
        await fillCustom('%', '10');
        await applyPromo();
      });
      const o = await waitOrder(orderA, (x) => x.owner !== null);
      expect([o.owner, o.staff]).toEqual([60, 40]);
      expect(o.items[0]?.fee).toBe(fee10(priceA, 40));
    },
  );

  it(
    title('Reopen shows the saved split; editing changes only this order (TC-VP5627-13)', Tag.CRITICAL),
    async () => {
      if (!orderA) throw new Error('needs the TC-12 order');
      await app.openPendingOrder(orderA);
      await openPromo();
      expect(await splitValues()).toEqual([60, 40]);
      await step('Owner 70 → Apply', async () => {
        const { owner } = await promoSplitInputs();
        await P.fillQ(owner, '70');
        await applyPromo();
      });
      const o = await waitOrder(orderA, (x) => x.owner === 70);
      expect([o.owner, o.staff]).toEqual([70, 30]);
      expect(o.items[0]?.fee).toBe(fee10(priceA, 30));
      expect((await readSettings()).custom).toBe(60);
    },
  );

  afterEach(function () {
    // Hand the shared TC-11..13 order back to the cleanup once TC-13 is done.
    if (orderA && /TC-VP5627-13/.test(this.currentTest?.title ?? '')) app.createdOrders.add(orderA);
  });

  it(title('Item Discount does not take the Custom split (TC-VP5627-14)', Tag.REGRESSION), async () => {
    const code = await app.createOrder({ services: [vp5627.service2] });
    await step('Item Discount 10%', () => itemDiscount(vp5627.service2, '%', 10));
    const o = await waitOrder(code, (x) => x.items[0]?.discountRate === 10);
    expect(o.items[0]?.discountType).toBe('percentage');
    expect(o.owner).toBeNull();
    expect(o.staff).toBeNull();
    expect(o.items[0]?.fee).toBeNull();
  });

  it(
    title('Available promotion keeps the Available split (TC-VP5627-15)', Tag.REGRESSION),
    async function () {
      const code = await app.createOrder({ services: [vp5627.service] });
      if (!(await attachCustomer(vp5627.customerSearch, vp5627.promoCustomer))) {
        console.warn(
          `VP5627 SKIP TC-15: customer "${vp5627.promoCustomer}" not found (VP5627_PROMO_CUSTOMER)`,
        );
        this.skip();
      }
      await openPromo();
      if (!(await P.has(promoRow(vp5627.promotion)))) {
        console.warn(
          `VP5627 SKIP TC-15: promotion "${vp5627.promotion}" not offered to "${vp5627.promoCustomer}" (VP5627_PROMOTION / VP5627_PROMO_CUSTOMER — "New Client" needs a customer with no paid visit)`,
        );
        this.skip();
      }
      await P.clickQ(promoRow(vp5627.promotion));
      expect(await splitValues()).toEqual([original.available, 100 - original.available]);
      await applyPromo();
      const o = await waitOrder(code, (x) => x.campaignId !== null);
      expect([o.owner, o.staff]).toEqual([original.available, 100 - original.available]);
    },
  );

  it(title('Reward keeps the old (no) split (TC-VP5627-16)', Tag.REGRESSION), async function () {
    const code = await app.createOrder({ services: [vp5627.service] });
    if (!(await attachCustomer(vp5627.customerSearch, vp5627.customer))) {
      console.warn(`VP5627 SKIP TC-16: customer "${vp5627.customer}" not found (VP5627_CUSTOMER)`);
      this.skip();
    }
    await openPromo();
    if (!(await P.has(promoRow(vp5627.reward)))) {
      console.warn(`VP5627 SKIP TC-16: reward "${vp5627.reward}" not offered (VP5627_REWARD)`);
      this.skip();
    }
    await P.clickQ(promoRow(vp5627.reward));
    await applyPromo();
    const o = await waitOrder(code, (x) => x.redeemId !== null);
    expect(o.owner).toBeNull();
    expect(o.staff).toBeNull();
    expect(o.items[0]?.fee).toBeNull();
  });

  it(title('Paid order keeps its split after the setting changes (TC-VP5627-17)', Tag.CRITICAL), async () => {
    await setCustomOnPos(60);
    const code = await app.createOrder({ services: [vp5627.service] });
    const price = await app.basePrice(vp5627.service);
    await openPromo();
    await fillCustom('%', '10');
    await applyPromo();
    await waitOrder(code, (x) => x.owner === 60);
    await step('Pay Cash', async () => {
      await app.pay();
      await app.selectMethod('Cash');
      await app.completePayment({ tip: 'none' });
      await app.successText();
      await app.noReceipt();
    });
    await step('Store Custom → 50/50', () => setCustomOnPos(50));
    const o = await readOrder(code);
    expect([o.owner, o.staff]).toEqual([60, 40]);
    expect(o.items[0]?.fee).toBe(fee10(price, 40));
    expect((await readSettings()).custom).toBe(50);
  });

  /* ------------------------------ Not automated ------------------------------ */

  it(title('Portal ↔ POS two-way sync, no app restart (TC-VP5627-18)', Tag.REGRESSION), async function () {
    this.timeout(6 * 60_000);
    // A second browser in the same run: Edge on the QR-signed .portal-profile, over CDP.
    const cdp = await new PortalCdp().start();
    try {
      const portal = new PortalDiscountSettingCdp(cdp);
      if (!(await portal.open())) {
        console.warn(
          'VP5627 SKIP TC-18: .portal-profile session expired — run `npm run portal:login` (QR) and re-run',
        );
        this.skip();
      }
      const avail = (await portal.read()).availableOwner;

      await step('Portal → POS: Portal saves Custom 70/30', async () => {
        const s = await portal.setCustom(70, 30);
        expect([s.customOwner, s.customStaff]).toEqual([70, 30]);
        await portal.scrollToCard();
        await cdp.screenshot(`${SHOT_DIR}/tc18-portal-7030.png`);
      });
      await step('POS picks 70 up without reopening the app', async () => {
        const ok = await waitUntil(async () => (await readSettings()).custom === 70, 60_000, 1_000);
        expect(ok).toBe(true);
        await openChargeFee();
        expect((await chargeFeeValues()).c).toEqual([70, 30]);
      });

      await step('POS → Portal: POS saves Custom 40/60', () => setCustomOnPos(40));
      await step('Portal shows 40/60 after reload', async () => {
        await portal.reload();
        let s = await portal.read();
        const deadline = Date.now() + 60_000;
        while (s.customOwner !== 40 && Date.now() < deadline) {
          await settle(2_000);
          await portal.reload();
          s = await portal.read();
        }
        await portal.scrollToCard();
        await cdp.screenshot(`${SHOT_DIR}/tc18-portal-4060.png`);
        expect([s.customOwner, s.customStaff]).toEqual([40, 60]);
        expect(s.availableOwner).toBe(avail);
      });
    } finally {
      await cdp.stop().catch(() => undefined);
    }
  });

  it(
    title('Cleanup: store Custom split back to its original value (TC-VP5627-20)', Tag.REGRESSION),
    async () => {
      await setCustomOnPos(original.custom);
      const s = await readSettings();
      expect(s.custom).toBe(original.custom);
      expect(s.available).toBe(original.available);
    },
  );
});
