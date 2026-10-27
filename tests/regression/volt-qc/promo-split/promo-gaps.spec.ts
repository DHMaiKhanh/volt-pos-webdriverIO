/**
 * volt-qc 04 PROMO — TC rows with no volt-qc Playwright test, written from the
 * catalogue (docs/qc/volt-qc/windows-regression/04-khuyen-mai-diem-giftcard.md).
 *
 * Gift-card data comes from env, like the source suite (this device is merchant
 * 14; the static catalogue in src/data/static/giftCards.json is merchant 20258):
 *   VOLT_TEST_GIFT_CARD  an Active card that may be topped up / redeemed
 *   VOLT_GC_NEW          a "Not Sold Yet" card (read-only use)
 *   VOLT_GC_INACTIVE     an Inactive card
 *   VOLT_GC_USED         a "Used Up" ($0) card
 *   VOLT_GC_DRAIN        an Active card that may be redeemed down to $0.00
 *   VOLT_GC_NEW_CANCEL   a "Not Sold Yet" card that may be sold then cancelled
 *   VOLT_GC_CODES        ≥ 11 comma-separated codes of this merchant (max-10 check)
 * A case whose card is not configured skips with the reason.
 *
 * Writes: draft orders (deleted again); PROMO-140/143/144/148/182 take payments.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsCheckout } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { payWithGiftCards } from '../../../../src/flows/index.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  closeSellGiftCard,
  gcAdd,
  gcBonusOrDiscount,
  gcCustomAmount,
  gcEnterCode,
  gcIn,
  gcQuick,
  gcSummary,
} from '../../../../src/pages/voltqc/pos/giftCardProbe.js';
import {
  addDays,
  applyFilter,
  openRow,
  pickDateRange,
  rowCodes,
} from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  addGiftCardLine,
  checkoutBack,
  createQuickPayOrder,
  customerEarnedPoints,
  ensureGiftCardBalance,
  giftCardCooldown,
  markGiftCardUse,
  openPromo,
  closeDialogX,
  payOpenOrder,
  pointsFor,
  promoDlg,
  settledGiftCardBalance,
  waitGiftCardBalance,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import {
  app,
  appears,
  clickFound,
  cust,
  randomPhone,
  uniqueName,
  visible,
  vqEnv,
  waitUntil,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const envCode = (k: string): string => (process.env[k] ?? '').trim();
const GC = vqEnv.testGiftCard;
const SELL = { role: 'dialog', name: 'Sell Gift Card', nth: -1 } as const;
const gcLine = (code: string): ReturnType<typeof inMain> =>
  inMain({ textRe: `Gift Card \\[\\*+-\\*+-${code.slice(-4)}\\]`, nth: 0 });

function needCard(ctx: Mocha.Context, code: string, envName: string, id: string): void {
  if (!code) {
    console.warn(`${id}: ${envName} is not set`);
    ctx.skip();
  }
}

/** Remove the first gift-card line of the open order (trash icon on its row → confirm). */
async function removeGiftCardLine(code: string): Promise<void> {
  const ok = await clickFound(
    `var last4 = arguments[0];
     var rows = document.querySelectorAll('main div.pr-11');
     for (var i = 0; i < rows.length; i++) {
       if (new RegExp('Gift Card \\\\[\\\\*+-\\\\*+-' + last4 + '\\\\]').test(rows[i].textContent || '')) return rows[i].querySelector('button.text-destructive');
     }
     return null;`,
    code.slice(-4),
  );
  if (!ok) throw new Error('No remove button on the gift card line');
  const dlg = { role: 'dialog', hasTextRe: 'Remove', nth: -1 } as const;
  if (await appears([dlg, btn('Remove')], 3_000)) await P.clickQ([dlg, btn('Remove')]);
  await settle(800);
}

describe('volt-qc 04 PROMO — catalogue gaps', () => {
  before(() => {
    assertWritesAllowed('build promo / gift-card orders');
  });

  afterEach(async () => {
    await closeSellGiftCard().catch(() => undefined);
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders().catch(() => undefined);
  });

  /* ------------------------------ Cashback / points ------------------------------ */

  it(
    title('No Cashback section in Promo & Rewards on this build (PROMO-102)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(3 * 60_000);
      await app.createOrder();
      await app.attachNewCustomer(randomPhone(), uniqueName('QC Cash'));
      await app.customerConfirmPhone();
      await openPromo();
      const t = (await P.rawText(promoDlg)) ?? '';
      expect(t).not.toMatch(/Cashback/i);
      expect(t).not.toMatch(/Do you want to use Cashback\?/);
      await closeDialogX();
    },
  );

  it(
    title(
      'Paying with a gift card earns points at the Gift Card rate (PROMO-084)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-084');
      const rate = Number(envCode('VOLT_POINT_RATE_GIFT_CARD'));
      if (!Number.isFinite(rate) || rate <= 0) {
        console.warn('PROMO-084: set VOLT_POINT_RATE_GIFT_CARD ($ per point for Gift Card on this merchant)');
        this.skip();
      }
      this.timeout(6 * 60_000);
      await ensureGiftCardBalance(GC, 30);
      await app.createOrder();
      await app.attachNewCustomer(randomPhone(), uniqueName('QC GcPt'));
      await app.customerConfirmPhone();
      await app.pay();
      const paid = await app.methodAmount('Gift Card');
      await giftCardCooldown();
      const r = await app.payWithGiftCard(GC);
      expect(r.info).toContain('Gift Card Accepted');
      await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
      await app.driveToSuccess('none');
      markGiftCardUse();
      const e = await customerEarnedPoints();
      expect(e.earned).toBe(pointsFor(paid, rate));
      await app.noReceipt();
    },
  );

  /* ------------------------------ Sell Gift Card ------------------------------ */

  it(
    title(
      'A "Not Sold Yet" card: Not Sold Yet badge, Balance $0.00, View Details (PROMO-108)',
      Tag.REGRESSION,
    ),
    async function () {
      const code = envCode('VOLT_GC_NEW');
      needCard(this, code, 'VOLT_GC_NEW', 'PROMO-108');
      await app.quickCheckout();
      await app.openSellGiftCard();
      await gcEnterCode(code);
      const t = (await P.rawText(SELL)) ?? '';
      expect(t).toMatch(/Not Sold Yet/);
      expect(t).toMatch(/Balance: \$0\.00/);
      expect(await P.has(gcIn(btn('View Details')))).toBe(true);
      await closeSellGiftCard();
    },
  );

  it(
    title(
      'An Inactive card: Inactive badge, Balance + View Details, Add stays disabled, no red error (PROMO-111)',
      Tag.REGRESSION,
    ),
    async function () {
      const code = envCode('VOLT_GC_INACTIVE');
      needCard(this, code, 'VOLT_GC_INACTIVE', 'PROMO-111');
      await app.quickCheckout();
      await app.openSellGiftCard();
      await gcEnterCode(code);
      expect(await P.has(gcIn({ text: 'Inactive' }))).toBe(true);
      expect(await P.has(gcIn({ textRe: 'Balance: \\$', nth: 0 }))).toBe(true);
      expect(await P.has(gcIn(btn('View Details')))).toBe(true);
      await P.clickQ(gcQuick('$25'));
      expect(await P.isDisabled(gcAdd)).toBe(true);
      expect(await P.count(gcIn({ text: 'Invalid gift card number' }))).toBe(0);
      await closeSellGiftCard();
    },
  );

  it(
    title(
      'A Used Up ($0) card can be topped up: Used Up badge, Balance $0.00, Add enabled (PROMO-112)',
      Tag.REGRESSION,
    ),
    async function () {
      const code = envCode('VOLT_GC_USED');
      needCard(this, code, 'VOLT_GC_USED', 'PROMO-112');
      await app.quickCheckout();
      await app.openSellGiftCard();
      await gcEnterCode(code);
      const t = (await P.rawText(SELL)) ?? '';
      expect(t).toMatch(/Used Up/);
      expect(t).toMatch(/Balance: \$0\.00/);
      await P.clickQ(gcQuick('$25'));
      expect(await P.isDisabled(gcAdd)).toBe(false);
      await closeSellGiftCard();
    },
  );

  it(
    title(
      'At most 10 gift cards per order: the 11th shows "Maximum 10 gift cards allowed per order." (PROMO-126)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      const codes = envCode('VOLT_GC_CODES')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (codes.length < 11) {
        console.warn(
          `PROMO-126: VOLT_GC_CODES needs ≥ 11 codes of this merchant (got ${String(codes.length)})`,
        );
        this.skip();
      }
      this.timeout(10 * 60_000);
      await app.quickCheckout();
      for (const code of codes.slice(0, 10)) await addGiftCardLine(code, 25);
      app.createdOrders.add(await app.orderId());
      await app.openSellGiftCard();
      await gcEnterCode(codes[10] ?? '');
      await P.clickQ(gcQuick('$25'));
      expect(await P.has(gcIn({ textRe: 'Maximum 10 gift cards allowed per order' }))).toBe(true);
      expect(await P.isDisabled(gcAdd)).toBe(true);
      await closeSellGiftCard();
    },
  );

  it(
    title(
      'Discount $20 on a $100 card: Customer Pays $80.00, balance credited $100.00; the order line is $80.00 (PROMO-169)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-169');
      this.timeout(3 * 60_000);
      await app.quickCheckout();
      await app.openSellGiftCard();
      await gcEnterCode(GC);
      await P.clickQ(gcQuick('$100'));
      await gcBonusOrDiscount('Discount', '$', '2000');
      const s = await gcSummary();
      expect(s.value).toBe(10_000);
      expect(s.bonus).toBe(0);
      expect(s.totalBalance).toBe(10_000);
      expect(s.discount).toBe(-2_000);
      expect(s.customerPays).toBe(8_000);
      await P.clickQ(gcAdd);
      await P.waitGoneQ(SELL, 8_000);
      app.createdOrders.add(await app.orderId());
      expect(await app.text('main')).toMatch(/Gift Card \[\*+-\*+-\d{4}\][^|]*\| \$80\.00/);
    },
  );

  it(
    title(
      'Discount = the whole value: Customer Pays $0.00 and Add still enabled; line $0.00 (PROMO-170)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-170');
      this.timeout(3 * 60_000);
      await app.quickCheckout();
      await app.openSellGiftCard();
      await gcEnterCode(GC);
      await P.clickQ(gcQuick('$50'));
      await gcBonusOrDiscount('Discount', '%', '100');
      const s = await gcSummary();
      expect(s.totalBalance).toBe(5_000);
      expect(s.customerPays).toBe(0);
      expect(await P.isDisabled(gcAdd)).toBe(false);
      await P.clickQ(gcAdd);
      await P.waitGoneQ(SELL, 8_000);
      app.createdOrders.add(await app.orderId());
      expect(await app.text('main')).toMatch(/Gift Card \[\*+-\*+-\d{4}\][^|]*\| \$0\.00/);
    },
  );

  it(
    title(
      'Money is formatted with thousands separators and 2 decimals; Bonus $ is not capped at the card value (PROMO-172)',
      Tag.REGRESSION,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-172');
      await app.quickCheckout();
      await app.openSellGiftCard();
      await gcEnterCode(GC);
      await P.fillQ(gcCustomAmount, '500');
      expect(await P.inputValue(gcCustomAmount)).toBe('$5.00');
      expect((await gcSummary()).customerPays).toBe(500);
      await P.fillQ(gcCustomAmount, '100000');
      expect(await P.inputValue(gcCustomAmount)).toBe('$1,000.00');
      const s1 = await gcSummary();
      expect(s1.text).toMatch(/Customer Pays \| \$1,000\.00/);
      await gcBonusOrDiscount('Bonus', '$', '150000');
      const s2 = await gcSummary();
      expect(s2.bonus).toBeGreaterThan(100_000);
      expect(s2.text).toMatch(/Total Balance \| \$2,500\.00/);
      await closeSellGiftCard();
    },
  );

  it(
    title(
      'Editing a gift-card line keeps its Discount; changing it re-prices the line (PROMO-173)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-173');
      this.timeout(3 * 60_000);
      await app.quickCheckout();
      await app.openSellGiftCard();
      await gcEnterCode(GC);
      await P.clickQ(gcQuick('$100'));
      await gcBonusOrDiscount('Discount', '%', '10');
      await P.clickQ(gcAdd);
      await P.waitGoneQ(SELL, 8_000);
      app.createdOrders.add(await app.orderId());
      expect(await app.text('main')).toMatch(/\$90\.00/);

      await P.clickQ(gcLine(GC));
      if (!(await appears(SELL, 5_000))) {
        console.warn(
          'PROMO-173: clicking the gift-card line does not reopen Sell Gift Card (known DEV bug #17)',
        );
      }
      expect(await visible(SELL)).toBe(true);
      const s = await gcSummary();
      expect(s.discount).toBe(-1_000);
      await gcBonusOrDiscount('Discount', '%', '20');
      await P.clickQ([SELL, { role: 'button', nameRe: '^(Add|Update|Save)$', nth: 0 }]);
      await P.waitGoneQ(SELL, 8_000);
      const t = await app.text('main');
      expect(t).toMatch(/\$80\.00/);
      expect(t).not.toMatch(/Gift Card \[\*+-\*+-\d{4}\][^|]*\| \$90\.00/);
    },
  );

  it(
    title(
      'Deleting the gift-card line before payment releases the card: status and balance unchanged, usable in a new order (PROMO-174)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-174');
      this.timeout(5 * 60_000);
      const before = await app.giftCardBalance(GC);
      const id = await app.createOrder();
      await addGiftCardLine(GC, 25);
      await app.openPendingOrder(id);
      await removeGiftCardLine(GC);
      expect(await visible(gcLine(GC))).toBe(false);
      const after = await app.giftCardBalance(GC);
      expect(after.status).toBe(before.status);
      expect(after.balance).toBeCloseTo(before.balance, 2);
      await app.quickCheckout();
      await addGiftCardLine(GC, 25);
      app.createdOrders.add(await app.orderId());
      expect(await visible(gcLine(GC))).toBe(true);
    },
  );

  it(
    title(
      'Same device: a card sitting in pending order A cannot be added to order B (PROMO-176)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-176');
      this.timeout(4 * 60_000);
      await app.quickCheckout();
      await addGiftCardLine(GC, 25);
      app.createdOrders.add(await app.orderId());
      await app.quickCheckout();
      await app.openSellGiftCard();
      await P.fillQ(gcIn({ role: 'textbox', name: 'Enter gift card code' }), GC);
      await settle(2_500);
      await P.clickQ(gcQuick('$25')).catch(() => undefined);
      const t = (await P.rawText(SELL)) ?? '';
      console.warn(`PROMO-176 dialog: ${t.replace(/\s*\n+\s*/g, ' | ').slice(0, 300)}`);
      expect(t).toMatch(/This gift card|already|another order|in use/i);
      expect(await P.isDisabled(gcAdd)).toBe(true);
      await closeSellGiftCard();
    },
  );

  it(
    title(
      'Completing another order B does not top up the card still sitting in unpaid order A (PROMO-177)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-177');
      this.timeout(6 * 60_000);
      const b0 = await settledGiftCardBalance(GC);
      await app.quickCheckout();
      await addGiftCardLine(GC, 25);
      app.createdOrders.add(await app.orderId());
      await app.createPaidOrder({ method: 'Cash' });
      const b1 = await settledGiftCardBalance(GC);
      expect(b1).toBeCloseTo(b0, 2);
    },
  );

  /* ------------------------------ Redeem ------------------------------ */

  it(
    title(
      'Redeem with enough balance: Accepted dialog (balance, amount needed), success, balance drops; Payment Details shows the remaining balance (PROMO-140, PROMO-151)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-140');
      this.timeout(6 * 60_000);
      const b0 = await ensureGiftCardBalance(GC, 40);
      const id = await app.createOrder();
      await app.pay();
      const need = await app.methodAmount('Gift Card');
      await giftCardCooldown();
      const r = await app.payWithGiftCard(GC);
      expect(r.info).toContain('Gift Card Accepted');
      expect(r.info).toMatch(/Current Balance/);
      expect(r.info).toMatch(/Amount Needed/);
      expect(r.info).toContain(`$${need.toFixed(2)}`);
      await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
      await app.driveToSuccess('none');
      markGiftCardUse();
      expect(await app.successText()).toContain(`$${need.toFixed(2)}`);
      await app.noReceipt();
      const b1 = await waitGiftCardBalance(GC, b0 - need);
      expect(b1).toBeCloseTo(b0 - need, 2);
      await app.openHistoryOrder(id);
      expect(await app.historyDetail(id)).toMatch(/\d{4}: Balance \$[\d,.]+/);
    },
  );

  it(
    title(
      'An Inactive card cannot pay: "Gift card is not valid", nothing deducted (PROMO-142)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      const code = envCode('VOLT_GC_INACTIVE');
      needCard(this, code, 'VOLT_GC_INACTIVE', 'PROMO-142');
      this.timeout(4 * 60_000);
      await app.createOrder();
      await app.pay();
      const r = await app.payWithGiftCard(code);
      expect(r.info).toMatch(/not valid/i);
      expect(r.info).not.toContain('Gift Card Accepted');
      await app.closeStrayDialogs();
      expect(/payment-success/.test(await app.path())).toBe(false);
      await checkoutBack().catch(() => undefined);
    },
  );

  it(
    title(
      'Not enough balance: "Redeem & Add New Check" / Cancel; Cancel deducts nothing (PROMO-143)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-143');
      this.timeout(6 * 60_000);
      const b0 = await settledGiftCardBalance(GC);
      if (!Number.isFinite(b0) || b0 > 900) {
        console.warn(`PROMO-143: card balance ${String(b0)} too large to build an order above it`);
        this.skip();
      }
      await createQuickPayOrder([{ amount: Math.ceil(b0) + 20, name: 'QC GC short' }]);
      await app.pay();
      await giftCardCooldown();
      const r = await app.payWithGiftCard(GC);
      markGiftCardUse();
      expect(r.info).toMatch(/not Enough Balance/i);
      expect(await P.has([VqpsCheckout.gcResultDialog, btn('Redeem & Add New Check')])).toBe(true);
      await P.clickQ([VqpsCheckout.gcResultDialog, btn('Cancel')]);
      await app.closeStrayDialogs();
      await checkoutBack().catch(() => undefined);
      const b1 = await settledGiftCardBalance(GC);
      expect(b1).toBeCloseTo(b0, 2);
    },
  );

  it(
    title(
      'Redeem the whole remaining balance and add a new check: card ends at $0.00 (never negative), order completes with 2 payments (PROMO-144)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      const drain = envCode('VOLT_GC_DRAIN');
      needCard(this, drain, 'VOLT_GC_DRAIN', 'PROMO-144');
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-144');
      this.timeout(8 * 60_000);
      const d0 = await settledGiftCardBalance(drain);
      if (!(d0 > 0) || d0 > 200) {
        console.warn(`PROMO-144: VOLT_GC_DRAIN balance ${String(d0)} must be between $0.01 and $200`);
        this.skip();
      }
      await ensureGiftCardBalance(GC, Math.ceil(d0) + 40);
      const id = await createQuickPayOrder([{ amount: Math.ceil(d0) + 10, name: 'QC GC drain' }]);
      await app.pay();
      const uuid = /\/order\/([^/?#]+)/.exec(await app.url())?.[1] ?? '';
      await giftCardCooldown();
      await payWithGiftCards(uuid, [drain, GC]);
      markGiftCardUse();
      await app.noReceipt().catch(() => undefined);
      const d1 = await waitGiftCardBalance(drain, 0);
      expect(d1).toBeCloseTo(0, 2);
      await app.openHistoryOrder(id);
      const d = await app.historyDetail(id);
      expect((d.match(/\d{4}: Balance \$/g) ?? []).length).toBeGreaterThanOrEqual(2);
    },
  );

  it(
    title(
      'Gift card with a customer tip: the card is charged amount + tip and the transaction records both (PROMO-148)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      needCard(this, GC, 'VOLT_TEST_GIFT_CARD', 'PROMO-148');
      this.timeout(6 * 60_000);
      const b0 = await ensureGiftCardBalance(GC, 40);
      const id = await app.createOrder();
      await app.pay();
      const amt = await app.methodAmount('Gift Card');
      await app.selectMethod('Gift Card');
      await P.clickQ(VqpsCheckout.complete);
      let tipped = false;
      const reached = await waitUntil(
        async () => {
          if (await app.passcodeVisible()) await app.enterPasscode();
          if (!tipped && (await cust.tipShown())) {
            await cust.customTip('200');
            tipped = true;
          }
          return visible(VqpsCheckout.inputGiftCard);
        },
        40_000,
        400,
      );
      expect(reached).toBe(true);
      if (!tipped) {
        console.warn('PROMO-148: the merchant does not prompt a tip on Gift Card');
        await app.closeStrayDialogs();
        await checkoutBack().catch(() => undefined);
        this.skip();
      }
      await giftCardCooldown();
      const r = await app.confirmGiftCardCode(GC);
      expect(r.info).toContain('Gift Card Accepted');
      await P.clickQ([VqpsCheckout.gcResultDialog, btn('Pay')]);
      await app.driveToSuccess('none');
      markGiftCardUse();
      await app.noReceipt();
      const b1 = await waitGiftCardBalance(GC, b0 - amt - 2);
      expect(b0 - b1).toBeCloseTo(amt + 2, 2);
      await app.openHistoryOrder(id);
      expect(await app.historyDetail(id)).toMatch(/Tip: \$2\.00/);
    },
  );

  it(
    title('A settled order paid by gift card has no Refund button (PROMO-153)', Tag.REGRESSION),
    async function () {
      this.timeout(4 * 60_000);
      await app.go('/order-history');
      await P.waitFor({ role: 'heading', name: 'Order History' }, 15_000, 'Order History');
      const today = new Date();
      await pickDateRange(addDays(today, -364), today);
      await applyFilter({ statuses: ['successful-settled'], payments: ['gift-card'] });
      const code = (await rowCodes())[0];
      if (!code) {
        console.warn('PROMO-153: no settled gift-card order in the last year');
        this.skip();
      }
      await openRow(code ?? '');
      await P.waitFor(inMain({ text: `Order #${code ?? ''}` }), 15_000);
      expect(await P.count(inMain(btn('Refund')))).toBe(0);
      expect(await P.count({ css: '[data-testid="order-action-refund"]' })).toBe(0);
      await app.go('/home', { passcode: false });
    },
  );

  /* ------------------------------ Cancel a card sale ------------------------------ */

  it(
    title(
      'Cancelling the sale of a new card takes its balance back to $0.00 (PROMO-182)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      const code = envCode('VOLT_GC_NEW_CANCEL');
      needCard(this, code, 'VOLT_GC_NEW_CANCEL', 'PROMO-182');
      this.timeout(6 * 60_000);
      const s0 = await app.giftCardBalance(code);
      if (!/Not Sold Yet/.test(s0.status)) {
        console.warn(`PROMO-182: VOLT_GC_NEW_CANCEL is "${s0.status}", not "Not Sold Yet"`);
        this.skip();
      }
      await app.quickCheckout();
      await addGiftCardLine(code, 50);
      const id = await app.orderId();
      app.createdOrders.add(id);
      await payOpenOrder('Other');
      expect(await waitGiftCardBalance(code, 50)).toBeCloseTo(50, 2);
      await app.openHistoryOrder(id);
      await app.cancelOrder(0);
      expect(await app.waitHistoryStatus(id, /^Canceled$/, 90_000)).toBe('Canceled');
      const b = await waitGiftCardBalance(code, 0);
      expect(b).toBeCloseTo(0, 2);
    },
  );
});
