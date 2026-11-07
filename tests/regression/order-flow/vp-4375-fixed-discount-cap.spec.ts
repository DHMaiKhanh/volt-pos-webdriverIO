/**
 * VP-4375 — a FIXED promotion / reward larger than what it may discount must be
 * SHOWN and SAVED at the amount actually applied (fix: volt-pos#2937).
 *
 * TC doc: docs/qc/volt-qc/vp-tickets/VP-4375-fixed-discount-cap-test-cases.md (TC-VP4375-01..20)
 *
 * ## Shape
 *
 * "Service $20" is a Quick Pay $20.00 line of `VOLT_TEST_STAFF`; "Gift Card Sale
 * $100" is a $100 top-up of `VOLT_TEST_GIFT_CARD` (a gift-card line leaves the
 * promotion base exactly like a new-card sale — VP-3767). The Windows dialog
 * already refuses a custom FIXED above the budget, so the custom cases use the
 * ticket's own route: two $20 lines → apply $30 → delete one line
 * (`overBudgetCustomOrder`). Campaign / reward cases need customer data and
 * skip with the reason when it is missing.
 *
 * What is SAVED is read back through the app's own GraphQL IPC (read-only,
 * cents): `totalPromotionDiscount`, `rewardRedemptionAmount`, the line's
 * `discountAmount` and `staffPromotionFeeAmount` — the numbers payroll and the
 * receipt are built from.
 *
 * On a build WITHOUT #2937 the display/saved cases fail on exactly the ticket's
 * "Actual" column (−$30, discountAmount $30, staff fee $15).
 *
 * Section 1 is one order walked through its life (panel → customer display →
 * checkout → saved → Order History → Staff Income), so its cases run in order
 * and each skips when the case before it did not leave the order where it needs it.
 *
 * Settings expected: Service Fee 0, Cash Discount 0 (as the ticket says).
 *
 * Section 6 (TC-21..23) charges a REAL card: it skips unless CARD_SETTLE=1 and
 * header Devices shows "Terminal | Connected"; an operator taps the card.
 * Split (TC-15) cannot be driven here: `isSplitBlockedByGiftCard` greys Split
 * out, and over budget only the gift card is left to pay — TC-15 locks that rule.
 *
 * CREATES DATA AND TAKES PAYMENTS (Cash / Other): several completed orders, a
 * $100 top-up per gift-card case on the test card, and — for TC-10/11/14 — a
 * customer's campaign / reward points are consumed. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { VpDiscountLabels, VpPromoTrigger } from '../../../src/constants/testids.vp-promo-gc.js';
import { step } from '../../../src/helpers/steps.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { POLL_TIMEOUT, valueSoon } from '../../../src/pages/voltqc/promo-split/promoDeepExtra.js';
import {
  itemDiscount,
  promoInput,
  staffDiscountCharge,
  waitDiscountChargeDelta,
} from '../../../src/pages/voltqc/promo-split/promoFlows.js';
import * as S from '../../../src/pages/voltqc/promo-split/splitFlows.js';
import { app, cust, field, money, vqEnv } from '../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  ONE_CHARGE_MS,
  assertCardPayable,
  chargeSelectedCard,
  requireCardTerminal,
} from '../volt-qc/card-terminal/card-terminal.helpers.js';
import {
  FIXED,
  addGiftCardTopUp,
  affordableRewards,
  applyPromo,
  attachCustomer,
  closePromoDialog,
  customerPromotions,
  discountLine,
  lineByLabel,
  openPromoDialog,
  orderSnapshot,
  overBudgetCustomOrder,
  quickPayLinesOrder,
  selectOffer,
  serviceLines,
  setOwnerPercent,
  typeCustomFixed,
  vpCustomerPhone,
  vpGiftCardCode,
  waitOrderSnapshot,
  type VpOrder,
  type VpReward,
} from './vp-promo-gc.helpers.js';

const STAFF = vqEnv.testStaff;

/* ------------------------------------------------------------------------- *
 * Spec-local steps
 * ------------------------------------------------------------------------- */

/** Home → Checkout (when not already there). */
async function toCheckout(): Promise<void> {
  if (!/\/checkout/.test(await app.path())) await app.pay();
}

/** Checkout → Cash → Complete → No Tip → Payment Successful → No Receipt. */
async function completeCash(): Promise<void> {
  await toCheckout();
  await app.selectMethod('Cash');
  await app.completePayment({ tip: 'none' });
  await app.successText();
  await app.noReceipt();
}

/** The saved order once completion has landed (status left `pending`). */
async function savedOrder(code: string): Promise<VpOrder> {
  return waitOrderSnapshot(code, (o) => !/pending/i.test(o.status), 30_000);
}

/** The single non-gift-card line of a saved order. */
function theServiceLine(o: VpOrder): NonNullable<ReturnType<typeof serviceLines>[number]> {
  const lines = serviceLines(o);
  expect(lines.length).toBe(1);
  const [line] = lines;
  if (!line) throw new Error(`Order ${o.orderCode} has no service line`);
  return line;
}

/** A FIXED value (USD) → the $ line price that it overshoots by $10 (never below $1). */
const lineBelow = (fixedUsd: number): number => Math.max(1, Math.round((fixedUsd - 10) * 100) / 100);

/** The richest active FIXED reward the points afford, or null. */
async function pickFixedReward(points: number): Promise<VpReward | null> {
  const rewards = (await affordableRewards(points)).filter(
    (r) => r.logicType === FIXED && r.isActive !== false && Number(r.logicValue) > 0,
  );
  rewards.sort((a, b) => Number(b.logicValue) - Number(a.logicValue));
  return rewards[0] ?? null;
}

describe('VP-4375 — FIXED promo/reward above the discountable amount is shown and saved as applied', () => {
  before(function (this: Mocha.Context): void {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create and pay orders with promotions, rewards and gift-card top-ups');
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
  describe('1. Custom FIXED — service $20 + gift card $100, $30 off', () => {
    let code = '';
    let paid = false;
    let dc0 = Number.NaN;

    before(async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      if (!vpGiftCardCode()) this.skip();
      // Staff Income baseline for TC-09, read BEFORE any order of this section completes.
      dc0 = await staffDiscountCharge(STAFF).catch(() => Number.NaN);
    });

    it(
      title(
        'TC-VP4375-01: the dialog refuses a custom FIXED above the discountable amount (gift card excluded)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await quickPayLinesOrder([{ cents: 2000, name: `QC VP4375 01-${String(Date.now()).slice(-5)}` }]);
        await addGiftCardTopUp(100);
        await openPromoDialog();
        await typeCustomFixed(30);
        const err = [VpPromoTrigger.dialog, { textRe: VpPromoTrigger.maxDiscountRe, nth: 0 }] as const;
        if (await P.has(err)) {
          expect(await P.textOf(err)).toContain('$20.00');
          expect(await P.isDisabled([VpPromoTrigger.dialog, { role: 'button', name: 'Apply', nth: 0 }])).toBe(
            true,
          );
        } else {
          // InputCurrency maxValue = discountMax → the box clamps as you type.
          expect(await valueSoon(promoInput, '$20.00')).toBe('$20.00');
        }
        await closePromoDialog();
      },
    );

    it(
      title(
        'TC-VP4375-02: order panel shows Promotion −$20.00 (applied), not the typed −$30.00',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        ({ code } = await overBudgetCustomOrder({
          lineCents: 2000,
          typedDollars: 30,
          ownerPercent: 50,
          giftCardDollars: 100,
        }));
        const t = await app.orderTotals();
        expect(t.promotion).toBeCloseTo(-20, 2);
        expect(t.total).toBeCloseTo(100, 2);
      },
    );

    it(
      title(
        'TC-VP4375-03: customer display shows Promotion −$20.00',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        if (!code) this.skip();
        const text = await cust.text();
        if (!text) this.skip(); // no customer-display window on this session
        expect(lineByLabel(text, VpDiscountLabels.promotion)).toBeCloseTo(-20, 2);
      },
    );

    it(
      title(
        'TC-VP4375-04: checkout shows Promotion −$20.00 and Cash $100.00',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
      ),
      async function () {
        if (!code) this.skip();
        await toCheckout();
        const t = await app.orderTotals();
        expect(t.promotion).toBeCloseTo(-20, 2);
        expect(await app.methodAmount('Cash')).toBeCloseTo(100, 2);
      },
    );

    it(
      title(
        'TC-VP4375-05: Cash completion saves totalPromotionDiscount $20 and line discountAmount $20 (≤ line price)',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(4 * 60_000);
        if (!code) this.skip();
        await completeCash();
        paid = true;
        const o = await savedOrder(code);
        expect(o.totalPromotionDiscount).toBe(2000);
        const line = theServiceLine(o);
        expect(line.discountAmount).toBe(2000);
        expect(Number(line.discountAmount)).toBeLessThanOrEqual(Number(line.servicePrice));
      },
    );

    it(
      title(
        'TC-VP4375-06: staff promotion fee (50%) is $10.00, not $15.00',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
      ),
      async function () {
        if (!paid) this.skip();
        const o = await savedOrder(code);
        expect(theServiceLine(o).staffPromotionFeeAmount).toBe(1000);
      },
    );

    it(
      title('TC-VP4375-07: Order History shows Total Discount $20.00', Tag.REGRESSION, Tag.WRITE),
      async function () {
        this.timeout(2 * 60_000);
        if (!paid) this.skip();
        await app.openHistoryOrder(code);
        const d = await app.historyDetail(code);
        expect(field(d, 'Status')).toMatch(/^Successful/);
        expect(Math.abs(money(field(d, VpDiscountLabels.totalDiscount)))).toBeCloseTo(20, 2);
      },
    );

    // Disabled for now: needs a real thermal printer — re-enable once QC has one.
    // it(
    //   title(
    //     'TC-VP4375-08: printed receipt shows Promotion −$20 and the discount lines add up — PENDING 🧱 (needs a receipt printer)',
    //   ),
    // );

    it(
      title(
        'TC-VP4375-09: Staff Income Discount Charge grows by exactly $10.00',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.SLOW,
      ),
      async function () {
        this.timeout(POLL_TIMEOUT + 2 * 60_000);
        if (!paid || !Number.isFinite(dc0)) this.skip();
        const now = await waitDiscountChargeDelta(STAFF, dc0, 10, POLL_TIMEOUT);
        expect(now - dc0).toBeCloseTo(10, 2);
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('2. Campaign FIXED (a) and Reward FIXED (b)', () => {
    it(
      title(
        'TC-VP4375-10: a FIXED campaign above the line is shown and saved at the line price, staff fee at the campaign staff share',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(6 * 60_000);
        const phone = vpCustomerPhone('VP4375_CAMPAIGN_CUSTOMER_PHONE');
        if (!phone || !vpGiftCardCode()) this.skip();

        const code = await S.startOrder(STAFF);
        await attachCustomer(phone);
        const customerId = (await orderSnapshot(code))?.customerId ?? '';
        const campaigns = (await customerPromotions(customerId)).filter(
          (c) => c.logicType === FIXED && Number(c.logicValue) > 0,
        );
        campaigns.sort((a, b) => Number(b.logicValue) - Number(a.logicValue));
        const campaign = campaigns[0];
        if (!campaign) this.skip(); // customer has no unused FIXED campaign
        if (!campaign) return;

        const lineUsd = lineBelow(Number(campaign.logicValue));
        const lineCents = Math.round(lineUsd * 100);
        await S.addQuickPay({ cents: lineCents, name: `QC VP4375 10-${String(Date.now()).slice(-5)}` });
        await addGiftCardTopUp(100);
        // A campaign carries its own Owner/Staff split (the boxes are disabled) — the fee follows the saved split.
        await step(
          `Apply campaign "${campaign.name}" ($${String(campaign.logicValue)}) on a $${String(lineUsd)} line`,
          async () => {
            await openPromoDialog();
            await selectOffer(campaign.name);
            await applyPromo();
          },
        );
        expect((await app.orderTotals()).promotion).toBeCloseTo(-lineUsd, 2);

        await toCheckout();
        expect((await app.orderTotals()).promotion).toBeCloseTo(-lineUsd, 2);
        expect(await app.methodAmount('Cash')).toBeCloseTo(100, 2);
        await completeCash();

        const o = await savedOrder(code);
        expect(o.totalPromotionDiscount).toBe(lineCents);
        const line = theServiceLine(o);
        expect(line.discountAmount).toBe(lineCents);
        expect(line.staffPromotionFeeAmount).toBe(
          Math.round((lineCents * Number(o.staffPromotionPercent)) / 100),
        );
      },
    );

    it(
      title(
        'TC-VP4375-11: a FIXED reward above the line is shown and saved at the line price, no staff fee',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(6 * 60_000);
        const phone = vpCustomerPhone('VP4375_REWARD_CUSTOMER_PHONE');
        if (!phone || !vpGiftCardCode()) this.skip();

        const code = await S.startOrder(STAFF);
        const points = await attachCustomer(phone);
        const reward = await pickFixedReward(points);
        if (!reward) this.skip(); // no FIXED reward the customer can afford
        if (!reward) return;

        const lineUsd = lineBelow(Number(reward.logicValue));
        const lineCents = Math.round(lineUsd * 100);
        await S.addQuickPay({ cents: lineCents, name: `QC VP4375 11-${String(Date.now()).slice(-5)}` });
        await addGiftCardTopUp(100);
        await step(
          `Apply reward "${reward.content}" ($${String(reward.logicValue)}) on a $${String(lineUsd)} line`,
          async () => {
            await openPromoDialog();
            await selectOffer(reward.content);
            await applyPromo();
          },
        );
        expect(discountLine(await app.text('main'), VpDiscountLabels.rewardRe)).toBeCloseTo(-lineUsd, 2);

        await toCheckout();
        expect(discountLine(await app.text('main'), VpDiscountLabels.rewardRe)).toBeCloseTo(-lineUsd, 2);
        expect(await app.methodAmount('Cash')).toBeCloseTo(100, 2);
        await completeCash();

        const o = await savedOrder(code);
        expect(o.rewardRedemptionAmount).toBe(lineCents);
        const line = theServiceLine(o);
        expect(line.discountAmount).toBe(lineCents);
        expect(Number(line.staffPromotionFeeAmount ?? 0)).toBe(0);
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('3. Service only (c)', () => {
    it(
      title(
        'TC-VP4375-12: service $20 with $30 custom off — Total $0.00, saved promo $20, discountAmount $20, staff fee $10',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const { code } = await overBudgetCustomOrder({ lineCents: 2000, typedDollars: 30, ownerPercent: 50 });
        const t = await app.orderTotals();
        expect(t.promotion).toBeCloseTo(-20, 2);
        expect(t.total).toBeCloseTo(0, 2);

        await toCheckout();
        expect(await app.methodAmount('Cash')).toBeCloseTo(0, 2);
        // Condition (⚠️): the till must let a $0.00 order complete.
        await completeCash();

        const o = await savedOrder(code);
        expect(o.totalPromotionDiscount).toBe(2000);
        const line = theServiceLine(o);
        expect(line.discountAmount).toBe(2000);
        expect(line.staffPromotionFeeAmount).toBe(1000);
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('4. Shared budget (d, e)', () => {
    it(
      title(
        'TC-VP4375-13: item discount $5 + custom FIXED $18 on $20 — promo applied $15, staff fee $7.50',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const name = `QC VP4375 13-${String(Date.now()).slice(-5)}`;
        const code = await quickPayLinesOrder([{ cents: 2000, name }]);
        // Promo FIRST (budget still $20), item discount AFTER — the dialog would refuse $18 over a $15 budget.
        await openPromoDialog();
        await typeCustomFixed(18);
        await setOwnerPercent(50);
        await applyPromo();
        await itemDiscount(name, '$', 5);

        expect((await app.orderTotals()).promotion).toBeCloseTo(-15, 2);
        await toCheckout();
        expect((await app.orderTotals()).promotion).toBeCloseTo(-15, 2);
        await completeCash();

        const o = await savedOrder(code);
        expect(o.totalPromotionDiscount).toBe(1500);
        const line = theServiceLine(o);
        expect(line.staffPromotionFeeAmount).toBe(750);
        expect(Number(line.discountAmount)).toBeLessThanOrEqual(Number(line.servicePrice));
      },
    );

    it(
      title(
        'TC-VP4375-14: custom FIXED + reward FIXED together above the line — applied total = line price',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(6 * 60_000);
        const phone = vpCustomerPhone('VP4375_REWARD_CUSTOMER_PHONE');
        if (!phone) this.skip();

        const code = await S.startOrder(STAFF);
        const points = await attachCustomer(phone);
        const reward = await pickFixedReward(points);
        if (!reward) this.skip();
        if (!reward) return;

        // Ticket shape $15 + $15 on $20, generalised to the reward R found: line R + 5, custom R.
        const r = Number(reward.logicValue);
        const lineCents = Math.round((r + 5) * 100);
        await S.addQuickPay({ cents: lineCents, name: `QC VP4375 14-${String(Date.now()).slice(-5)}` });
        await openPromoDialog();
        await typeCustomFixed(r);
        await selectOffer(reward.content);
        await applyPromo();

        await toCheckout();
        await completeCash();

        const o = await savedOrder(code);
        const promo = Number(o.totalPromotionDiscount ?? 0);
        const rew = Number(o.rewardRedemptionAmount ?? 0);
        expect(promo + rew).toBe(lineCents);
        expect(promo).toBeLessThanOrEqual(lineCents);
        expect(rew).toBeLessThanOrEqual(lineCents);
        expect(theServiceLine(o).discountAmount).toBe(lineCents);

        await app.openHistoryOrder(code);
        const d = await app.historyDetail(code);
        expect(Math.abs(money(field(d, VpDiscountLabels.totalDiscount)))).toBeCloseTo(lineCents / 100, 2);
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('5. Other completion paths', () => {
    let reopenCode = '';

    it(
      title(
        'TC-VP4375-15: split is blocked on an over-budget order with a gift card; Cash still saves promo $20, discountAmount $20, staff fee $10',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(6 * 60_000);
        if (!vpGiftCardCode()) this.skip();
        const { code } = await overBudgetCustomOrder({
          lineCents: 2000,
          typedDollars: 30,
          ownerPercent: 50,
          giftCardDollars: 100,
        });
        // Over budget, only the gift card is left to pay — and `isSplitBlockedByGiftCard` greys Split out (by design).
        expect(await P.isDisabled(S.splitButton)).toBe(true);
        await completeCash();

        const o = await savedOrder(code);
        expect(o.totalPromotionDiscount).toBe(2000);
        const line = theServiceLine(o);
        expect(line.discountAmount).toBe(2000);
        expect(line.staffPromotionFeeAmount).toBe(1000);
      },
    );

    // PENDING 04/11/2026: Re-Open Order tạm không test (theo yêu cầu) — bỏ .skip để chạy lại.
    it.skip(
      title(
        'TC-VP4375-16: Re-Open → Re-Open Done without changes keeps promo $20, discountAmount $20, staff fee $10',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(6 * 60_000);
        if (!vpGiftCardCode()) this.skip();
        ({ code: reopenCode } = await overBudgetCustomOrder({
          lineCents: 2000,
          typedDollars: 30,
          ownerPercent: 50,
          giftCardDollars: 100,
        }));
        await completeCash();

        await app.reopenOrder(reopenCode);
        await app.finishReopen();

        const o = await savedOrder(reopenCode);
        expect(o.totalPromotionDiscount).toBe(2000);
        const line = theServiceLine(o);
        expect(line.discountAmount).toBe(2000);
        expect(line.staffPromotionFeeAmount).toBe(1000);
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  // 💳 Real charges: CARD_SETTLE=1 + "Terminal | Connected", an operator taps the card (see card-terminal.helpers.ts).
  describe('6. Card tender', () => {
    let cardCode = '';

    /** Checkout → Card (skips when the terminal is not payable) → charge → No Receipt. */
    async function completeCard(ctx: Mocha.Context): Promise<void> {
      await toCheckout();
      expect(await app.methodAmount('Card')).toBeCloseTo(100, 2);
      await app.selectMethod('Card');
      await assertCardPayable(ctx);
      await chargeSelectedCard();
      await app.successText();
      await app.noReceipt();
    }

    it(
      title(
        'TC-VP4375-21: custom FIXED over budget paid by Card — Card $100.00, saved promo $20, discountAmount $20, staff fee $10',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(ONE_CHARGE_MS);
        await requireCardTerminal(this);
        if (!vpGiftCardCode()) this.skip();
        const { code } = await overBudgetCustomOrder({
          lineCents: 2000,
          typedDollars: 30,
          ownerPercent: 50,
          giftCardDollars: 100,
        });
        await completeCard(this);
        cardCode = code;

        const o = await savedOrder(code);
        expect(o.totalPromotionDiscount).toBe(2000);
        const line = theServiceLine(o);
        expect(line.discountAmount).toBe(2000);
        expect(line.staffPromotionFeeAmount).toBe(1000);
      },
    );

    it(
      title(
        'TC-VP4375-22: reward FIXED over the line paid by Card — Card $100.00, saved reward = line price, no staff fee',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(ONE_CHARGE_MS);
        await requireCardTerminal(this);
        const phone = vpCustomerPhone('VP4375_REWARD_CUSTOMER_PHONE');
        if (!phone || !vpGiftCardCode()) this.skip();

        const code = await S.startOrder(STAFF);
        const points = await attachCustomer(phone);
        const reward = await pickFixedReward(points);
        if (!reward) this.skip();
        if (!reward) return;

        const lineUsd = lineBelow(Number(reward.logicValue));
        const lineCents = Math.round(lineUsd * 100);
        await S.addQuickPay({ cents: lineCents, name: `QC VP4375 22-${String(Date.now()).slice(-5)}` });
        await addGiftCardTopUp(100);
        await openPromoDialog();
        await selectOffer(reward.content);
        await applyPromo();
        await completeCard(this);

        const o = await savedOrder(code);
        expect(o.rewardRedemptionAmount).toBe(lineCents);
        const line = theServiceLine(o);
        expect(line.discountAmount).toBe(lineCents);
        expect(Number(line.staffPromotionFeeAmount ?? 0)).toBe(0);
      },
    );

    // PENDING 04/11/2026: Re-Open Order tạm không test (theo yêu cầu) — bỏ .skip để chạy lại.
    it.skip(
      title(
        'TC-VP4375-23: Re-Open → Re-Open Done on the Card order keeps promo $20, discountAmount $20, staff fee $10',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(6 * 60_000);
        if (!cardCode) this.skip();
        await app.reopenOrder(cardCode);
        expect((await app.orderTotals()).promotion).toBeCloseTo(-20, 2);
        await app.finishReopen();

        const o = await savedOrder(cardCode);
        expect(o.totalPromotionDiscount).toBe(2000);
        const line = theServiceLine(o);
        expect(line.discountAmount).toBe(2000);
        expect(line.staffPromotionFeeAmount).toBe(1000);
      },
    );
  });
});
