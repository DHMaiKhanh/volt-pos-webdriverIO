/**
 * volt-qc port — 03 PAY: checkout layout, tenders, navigation (draft orders only).
 *
 * Source: volt-qc `e2e/tests/03-checkout/payment.spec.ts` (PAY-A),
 * `pay-plan-keypad.spec.ts` (PAY-K, PAY-A2) and `pay-plan-layout.spec.ts`
 * (PAY-I, PAY-J, PAY-R, PAY-W). TC catalogue:
 * docs/qc/volt-qc/windows-regression/03-checkout-thanh-toan.md.
 *
 * Nothing here takes money: every case builds a draft, probes the checkout and
 * voids the draft (`cleanTill`). Amounts are read off the till at runtime —
 * merchant 14 may have Service Fee / Cash Discount / Tax switched on or off at
 * any time, so a tender is always compared with ITS OWN button amount, never with
 * a hard-coded price.
 *
 * Adaptations vs the source:
 * - Staff/service by TILE INDEX (no `VOLT_TEST_STAFF` / service names on this merchant).
 * - The customer-display tile `bg-primary-500` class check (testid
 *   `customer-pay-by-*`, stripped on 1.1.x) is replaced by the tile AMOUNTS,
 *   which the TC actually cares about (PAY-006 / PAY-096).
 * - Tip-dependent steps run only when the merchant enables the Tip button.
 *
 * CREATES DATA (drafts, all voided). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { PAY_METHODS, QUICK_CASH, VqcPay } from '../../../../src/constants/testids.voltqc-pay.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { checkoutPage, homePage, orderPendingPage } from '../../../../src/pages/index.js';
import {
  P,
  TENDER,
  checkoutOrderCode,
  checkoutState,
  cleanTill,
  customerText,
  isHomePayDisabled,
  isMethodActive,
  isTipEnabled,
  usd,
  methodAmounts,
  pick,
  setCashierTip,
  typeAmount,
} from '../../../../src/pages/voltqc/pay/payProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { buildDraft, voidAnyDraft } from '../../order-flow/charge-matrix.helpers.js';
import { buildTwoStaffDraftOrSkip } from '../../order-flow/payment-flows.helpers.js';

/** Build a one-line draft, read the Home total (Card price), press Pay. */
async function draftAtCheckout(): Promise<{ homeTotal: number; orderId: string }> {
  await buildDraft({});
  const homeTotal = await homePage.cartTotal();
  await homePage.pressPay();
  await checkoutPage.waitForReady();
  return { homeTotal, orderId: await checkoutPage.orderId() };
}

const randomPhone = (): string => `832${String(Math.floor(1_000_000 + Math.random() * 8_000_000))}`;

describe('volt-qc 03 PAY — checkout layout & tenders (drafts)', function () {
  this.timeout(Timeouts.MOCHA_TEST * 2);

  afterEach(async () => {
    await cleanTill();
  });

  it(
    title(
      'Pay is disabled while the order has no line; the till stays on /home (PAY-002)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await voidAnyDraft();
      await homePage.selectStaffByIndex(0);
      expect(await isHomePayDisabled()).toBe(true);
      expect(await homePage.currentPath()).toMatch(/\/home/);
    },
  );

  it(
    title(
      'Checkout layout: Card default, per-method amounts, Cash/Other/Gift Card panels, Cash Drawer only on Cash, Home total = Card (PAY-001, PAY-007, PAY-008, PAY-009, PAY-010, PAY-106, PAY-131)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      const { homeTotal } = await draftAtCheckout();
      const amt = await methodAmounts();

      await step(
        'PAY-001: /order/<uuid>/checkout, 4 tenders in order, Card active, summary + actions',
        async () => {
          expect(await checkoutPage.currentPath()).toMatch(/^\/order\/[0-9a-f-]{36}\/checkout\/?$/);
          const t = await P.pageText('main');
          const order = PAY_METHODS.map((m) => t.search(new RegExp(`(^|\\| )${m} \\| \\$`)));
          expect(order.every((p) => p >= 0)).toBe(true);
          expect([...order].sort((a, b) => a - b)).toEqual(order);
          expect(await isMethodActive('Card')).toBe(true);
          expect(await checkoutPage.enteredAmountCents()).toBe(amt.Card);
          expect(t).toContain('Total Paid');
          expect(t).toContain('Remaining');
          expect(await checkoutOrderCode()).toMatch(/\S+/);
          for (const b of [VqcPay.printButton, VqcPay.tipButton, VqcPay.completePayment])
            expect(await P.has(b)).toBe(true);
          expect(await P.has(VqcPay.cashDrawer)).toBe(false);
        },
      );

      await step('PAY-106: Home total = Card button = checkout Total on arrival', async () => {
        expect(amt.Card).toBe(homeTotal);
        expect((await checkoutState()).total).toBe(homeTotal);
      });

      await step(
        'PAY-007: every tender shows its own amount; Card ≥ cash price; Other = Gift Card = Cash',
        async () => {
          const again = await methodAmounts();
          expect(again).toEqual(amt);
          for (const m of PAY_METHODS) expect(amt[m]).toBeGreaterThan(0);
          expect(amt.Card).toBeGreaterThanOrEqual(amt.Cash);
          expect(amt.Other).toBe(amt.Cash);
          expect(amt['Gift Card']).toBe(amt.Cash);
        },
      );

      await step(
        'PAY-008 / PAY-131: Cash → active, pre-filled cash price, quick cash + Cash Drawer',
        async () => {
          await checkoutPage.selectTender('cash');
          expect(await isMethodActive('Cash')).toBe(true);
          expect(await checkoutPage.enteredAmountCents()).toBe(amt.Cash);
          for (const q of QUICK_CASH) expect(await P.has(VqcPay.quickCash(q))).toBe(true);
          expect(await P.has(VqcPay.cashDrawer)).toBe(true);
        },
      );

      await step(
        'PAY-009 / PAY-131: Other → pre-filled, name field, no quick cash, no Cash Drawer',
        async () => {
          await checkoutPage.selectTender('other');
          expect(await checkoutPage.enteredAmountCents()).toBe(amt.Other);
          expect(await checkoutPage.isOtherMethodNameShown()).toBe(true);
          for (const q of QUICK_CASH) expect(await P.has(VqcPay.quickCash(q))).toBe(false);
          for (const k of ['1', '9', 'C', '0']) expect(await P.has(VqcPay.keypadKey(k))).toBe(true);
          expect(await P.has(VqcPay.cashDrawer)).toBe(false);
        },
      );

      await step(
        'PAY-010 / PAY-131: Gift Card → pre-filled cash price, no quick cash, Complete enabled',
        async () => {
          await checkoutPage.selectTender('gift-card');
          expect(await checkoutPage.enteredAmountCents()).toBe(amt['Gift Card']);
          for (const q of QUICK_CASH) expect(await P.has(VqcPay.quickCash(q))).toBe(false);
          expect(await checkoutPage.isCompletePaymentEnabled()).toBe(true);
          expect(await P.has(VqcPay.cashDrawer)).toBe(false);
        },
      );

      await step('PAY-131: back on Card the Cash Drawer is gone again', async () => {
        await checkoutPage.selectTender('card');
        expect(await P.has(VqcPay.cashDrawer)).toBe(false);
      });
    },
  );

  it(
    title(
      'Switching tender re-fills its own due and drops a typed amount; no partial pay on any tender; leaving resets to Card (PAY-011, PAY-013, PAY-014, PAY-053)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async () => {
      await draftAtCheckout();
      const amt = await methodAmounts();

      await step('PAY-011: Cash → $5.00 → Card → Cash re-fills each due', async () => {
        await checkoutPage.selectTender('cash');
        await typeAmount(500);
        expect(await checkoutPage.enteredAmountCents()).toBe(500);
        await checkoutPage.selectTender('card');
        expect(await checkoutPage.enteredAmountCents()).toBe(amt.Card);
        await checkoutPage.selectTender('cash');
        expect(await checkoutPage.enteredAmountCents()).toBe(amt.Cash);
      });

      await step(
        'PAY-053: Card / Gift Card / Other at $5.00 < due → Remaining > 0, Complete disabled, no Continue Payment',
        async () => {
          for (const m of ['Card', 'Gift Card', 'Other'] as const) {
            await checkoutPage.selectTender(TENDER[m]);
            await typeAmount(500);
            const s = await checkoutState();
            expect(s.remaining).toBeGreaterThan(0);
            expect(await checkoutPage.isCompletePaymentEnabled()).toBe(false);
            expect(await P.has(VqcPay.continuePayment)).toBe(false);
          }
        },
      );

      await step(
        'PAY-014: pre-fill = due of the method on every change; a cashier tip is added on top',
        async () => {
          for (const m of PAY_METHODS) {
            await checkoutPage.selectTender(TENDER[m]);
            expect(await checkoutPage.enteredAmountCents()).toBe(amt[m]);
          }
          await checkoutPage.selectTender('cash');
          if (await isTipEnabled()) {
            await setCashierTip(['2', '0', '0']);
            expect(await checkoutPage.enteredAmountCents()).toBe(amt.Cash + 200);
          }
        },
      );

      await step('PAY-013: Cash → back → Pay again → Card is active and pre-filled', async () => {
        await checkoutPage.selectTender('cash');
        await checkoutPage.pressBack();
        await homePage.waitForReady();
        await homePage.pressPay();
        await checkoutPage.waitForReady();
        expect(await isMethodActive('Card')).toBe(true);
        const s = await checkoutState();
        expect(s.entered).toBe((await methodAmounts()).Card);
      });
    },
  );

  it(
    title(
      'Back keeps the order with no transaction; an edit then Pay updates the due; reopening from Pending lands on the same checkout (PAY-150, PAY-151, PAY-153)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const { orderId, homeTotal } = await draftAtCheckout();
      const code = await checkoutOrderCode();
      await checkoutPage.pressBack();
      await homePage.waitForReady();
      const lines = (await homePage.cartLinePricesCents()).length;

      await step('PAY-150: back → /home, same draft, same lines, Total Paid still $0', async () => {
        expect(await homePage.currentPath()).toMatch(/\/home/);
        expect(await homePage.hasActiveDraft()).toBe(true);
        expect(lines).toBeGreaterThan(0);
        expect(await homePage.cartTotal()).toBe(homeTotal);
      });

      let newTotal = homeTotal;
      await step('PAY-151: add a second line → Pay → Enter Amount = the new Card total', async () => {
        await homePage.addServiceByIndex(1);
        await settle(800);
        newTotal = await homePage.cartTotal();
        expect(newTotal).toBeGreaterThan(homeTotal);
        await homePage.pressPay();
        await checkoutPage.waitForReady();
        expect(await checkoutPage.orderId()).toBe(orderId);
        expect(await checkoutPage.enteredAmountCents()).toBe(newTotal);
        expect((await checkoutState()).totalPaid).toBe(0);
      });

      await step(
        'PAY-153: back → Pending Orders → open the card → Pay → same /order/<uuid>/checkout',
        async () => {
          await checkoutPage.pressBack();
          await homePage.waitForReady();
          await orderPendingPage.open();
          expect(await orderPendingPage.isOrderListed(code)).toBe(true);
          await orderPendingPage.openOrder(code);
          await homePage.waitForReady();
          await homePage.pressPay();
          await checkoutPage.waitForReady();
          expect(await checkoutPage.orderId()).toBe(orderId);
          expect((await checkoutState()).total).toBe(newTotal);
        },
      );
    },
  );

  it(title('A cashier tip survives back → Pay (PAY-152)', Tag.REGRESSION, Tag.WRITE), async function () {
    const { homeTotal } = await draftAtCheckout();
    if (!(await isTipEnabled())) this.skip();
    await setCashierTip(['2', '0', '0']);
    await checkoutPage.pressBack();
    await homePage.waitForReady();
    await homePage.pressPay();
    await checkoutPage.waitForReady();
    const s = await checkoutState();
    expect(s.tip).toBe(200);
    expect(s.total).toBe(homeTotal + 200);
  });

  it(
    title(
      'Customer header: a quick-added customer shows name, phone, Points and Total visits on checkout (PAY-003)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await buildDraft({});
      const phone = randomPhone();
      const name = `QC Pay ${phone.slice(-4)}`;
      await homePage.attachCustomerByPhone(phone);
      if (await homePage.isNewCustomerFormShown()) await homePage.saveNewCustomer(name);
      await homePage.pressPay();
      await checkoutPage.waitForReady();
      const t = await P.pageText('main');
      expect(t).toContain(name);
      expect(t.replace(/\D/g, '')).toContain(phone.slice(-4));
      expect(t).toMatch(/Points: ?\d+/);
      expect(t).toMatch(/Total visits: ?\d+/);
      expect(t).toMatch(
        /(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}/,
      );
    },
  );

  it(
    title(
      'Two staff: one "Staff: <name>" group each; Total follows the tender and Card ≥ Cash (PAY-004)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      await buildTwoStaffDraftOrSkip(this);
      await homePage.pressPay();
      await checkoutPage.waitForReady();
      const t = await P.pageText('main');
      expect((t.match(/Staff: /g) ?? []).length).toBeGreaterThanOrEqual(2);
      const amt = await methodAmounts();
      const card = await checkoutState();
      const disc = pick(card.text, 'Total Discount');
      expect(card.total).toBe(card.subtotal - (Number.isNaN(disc) ? 0 : Math.abs(disc)) + card.tax);
      expect(card.total).toBe(amt.Card);
      await checkoutPage.selectTender('cash');
      expect((await checkoutState()).total).toBe(amt.Cash);
      expect(amt.Card).toBeGreaterThanOrEqual(amt.Cash);
    },
  );

  it(
    title(
      'Item discount ("% OFF", Item Discount / Total Discount rows) and the order note show on checkout (PAY-005)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await buildDraft({ discount: true });
      await homePage.openNoteDialog();
      const dlg = { role: 'dialog', nth: -1 } as const;
      await P.fillQ([dlg, { role: 'textbox', nth: 0 }], 'E2E note');
      await P.clickQ([dlg, { role: 'button', nameRe: '^(Save|Add|Done|Confirm|Update)$', nth: 0 }]);
      await settle(800);
      await homePage.pressPay();
      await checkoutPage.waitForReady();
      await checkoutPage.selectTender('cash');
      const t = await P.pageText('main');
      expect(t).toMatch(/\d+% OFF|\$[\d,.]+ OFF/);
      expect(pick(t, 'Item Discount')).toBeLessThan(0);
      expect(pick(t, 'Total Discount')).toBe(pick(t, 'Item Discount'));
      expect(t).toContain('E2E note');
      expect(pick(t, 'Total')).toBe((await methodAmounts()).Cash);
    },
  );

  it(
    title(
      'Summary: zero rows hidden; Total = Subtotal − Discount + Tax + Tip on Card and Cash (PAY-104, PAY-105)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await draftAtCheckout();
      const before = await methodAmounts();
      const s = await checkoutState();
      for (const l of ['Total Discount', 'Item Discount', 'Promotion', 'Reward Redemption', 'Tip', 'Tax']) {
        const v = pick(s.text, l);
        if (!Number.isNaN(v)) expect(v).not.toBe(0);
      }
      const tipped = await isTipEnabled();
      if (tipped) await setCashierTip(['2', '0', '0']);
      const tip = tipped ? 200 : 0;
      for (const m of ['Card', 'Cash'] as const) {
        await checkoutPage.selectTender(TENDER[m]);
        const x = await checkoutState();
        const disc = Number.isNaN(pick(x.text, 'Total Discount'))
          ? 0
          : Math.abs(pick(x.text, 'Total Discount'));
        expect(x.tip).toBe(tip);
        expect(x.total).toBe(x.subtotal - disc + x.tax + tip);
        expect(x.total).toBe(before[m] + tip);
      }
    },
  );

  it(
    title(
      'With SF = CD = 0 every tender costs the same; with Service Tax 0 there is no Tax row (PAY-089, PAY-103)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      const { homeTotal } = await draftAtCheckout();
      const a = await methodAmounts();
      // Merchant config, not test data: skip rather than fail when the store charges a fee / tax.
      if (a.Card !== a.Cash) this.skip();
      for (const m of PAY_METHODS) expect(a[m]).toBe(homeTotal);
      const s = await checkoutState();
      if (!Number.isNaN(pick(s.text, 'Tax'))) this.skip();
      expect(s.total).toBe(s.subtotal);
    },
  );

  it(
    title(
      'Customer display mirrors checkout: order details, Subtotal and each tender amount per selected method (PAY-006, PAY-096)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      await draftAtCheckout();
      for (const m of ['Cash', 'Other', 'Card'] as const) {
        await checkoutPage.selectTender(TENDER[m]);
        await settle(1_200);
        const main = await checkoutState();
        const amt = await methodAmounts();
        const ct = await customerText();
        expect(ct).toMatch(/Order Details|Staff:/);
        expect(pick(ct, 'Subtotal')).toBe(main.subtotal);
        const tax = pick(ct, 'Tax');
        if (!Number.isNaN(tax)) expect(tax).toBe(main.tax);
        for (const k of PAY_METHODS) expect(ct).toContain(usd(amt[k]));
      }
    },
  );
});
