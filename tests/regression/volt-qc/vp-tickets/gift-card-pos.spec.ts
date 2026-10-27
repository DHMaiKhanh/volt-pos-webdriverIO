/**
 * gift-card-pos-test-cases — [POS] Sell / Add Fund Gift Card (volt-qc per-ticket
 * file `docs/qc/volt-qc/vp-tickets/gift-card-pos-test-cases.md`, TC-01–50).
 *
 * Automated (READ-ONLY): the "Sell Gift Card" dialog — category tile, layout,
 * code lookup (Not Sold Yet / Active / invalid / Inactive / long), Balance
 * Detail + history, value presets and boundaries, Bonus/Discount arithmetic,
 * rounding and money format. Every case closes the dialog WITHOUT pressing Add,
 * which writes nothing (volt-qc promo port, tests/regression/volt-qc/pos/promo.spec.ts).
 * Dialog access is the existing role/text probe (src/pages/voltqc/pos/giftCardProbe.ts)
 * because the dialog ships no data-testid on 1.1.x.
 *
 * Data: cards from the catalogue (src/data/static/giftCards.json, merchant-scoped)
 * or VOLT_TEST_GIFT_CARD / VOLT_GC_NEW; a missing card skips its case.
 *
 * Known build deviation: switching the Bonus/Discount tab resets the other one
 * (PROMO-123), so TC-21 "Bonus AND Discount together" asserts the sheet and
 * names that gap when it fails.
 *
 * Manual: adding to an order and everything after it (payment, revenue, state
 * transitions, report, CRM, multi-card orders, void/refund/redeem) — those
 * settle money or need the Portal/CRM; and the physical-card Scan.
 */

import { expect } from '@wdio/globals';
import { VqcGiftCard, VqcHome } from '../../../../src/constants/testids.voltqc-pos.js';
import { activeGiftCards, giftCardCatalog } from '../../../../src/data/static/giftCards.js';
import { returnToHome } from '../../../../src/flows/index.js';
import {
  closeSellGiftCard,
  gcAdd,
  gcBalanceCents,
  gcBonusOrDiscount,
  gcCodeBox,
  gcCustomAmount,
  gcEnterCode,
  gcIn,
  gcPanelBox,
  gcQuick,
  gcQuickSelected,
  gcSummary,
  openSellGiftCard,
} from '../../../../src/pages/voltqc/pos/giftCardProbe.js';
import { quickCheckout } from '../../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const ACTIVE_CODE = (process.env.VOLT_TEST_GIFT_CARD ?? '').trim() || (activeGiftCards[0]?.code ?? '');
const NEW_CODE =
  (process.env.VOLT_GC_NEW ?? '').trim() || (giftCardCatalog.find((c) => c.status === 'initial')?.code ?? '');
const INACTIVE_CODE = giftCardCatalog.find((c) => c.status === 'inactive')?.code ?? '';

async function freshDialog(): Promise<void> {
  await returnToHome();
  await quickCheckout();
  await openSellGiftCard();
}

/** Dialog open with the Active card looked up — the starting point of the amount cases. */
async function activeDialog(ctx: Mocha.Context): Promise<void> {
  if (!ACTIVE_CODE) ctx.skip();
  await freshDialog();
  await gcEnterCode(ACTIVE_CODE);
}

describe('gift-card-pos-test-cases — Sell Gift Card dialog', () => {
  afterEach(async () => {
    await P.escape().catch(() => undefined);
    await closeSellGiftCard().catch(() => undefined);
  });

  after(async () => {
    await returnToHome();
  });

  it(
    title(
      'gift-card-pos-test-cases TC-01 Gift Card is its own tile on the create-order screen',
      Tag.REGRESSION,
    ),
    async () => {
      await returnToHome();
      await quickCheckout();
      expect(await P.has(VqcHome.giftCardTile)).toBe(true);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-02 The tile opens "Sell Gift Card" with Card Number, Scan, value, Bonus/Discount, Add',
      Tag.REGRESSION,
    ),
    async () => {
      await freshDialog();
      for (const l of VqcGiftCard.layoutLabels) expect(await P.has(gcIn({ text: l, nth: 0 }))).toBe(true);
      expect(await P.has(gcCodeBox)).toBe(true);
      expect(await P.has(gcIn(VqcGiftCard.scan))).toBe(true);
      expect(await P.has(gcAdd)).toBe(true);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-03 A Not-Sold-Yet code shows its balance (≥ $0) — Buy New flow',
      Tag.REGRESSION,
    ),
    async function () {
      if (!NEW_CODE) this.skip();
      await freshDialog();
      await gcEnterCode(NEW_CODE);
      expect(await gcBalanceCents()).toBeGreaterThanOrEqual(0);
      expect((await P.rawText(VqcGiftCard.dialog)) ?? '').toMatch(/Not Sold Yet/i);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-04 An Active code shows Balance and the details button — Add Fund flow',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      expect(await P.has(gcIn({ text: 'Active' }))).toBe(true);
      expect(await P.has(gcIn({ textRe: VqcGiftCard.balanceRe }))).toBe(true);
      expect(await P.has(gcIn(VqcGiftCard.viewDetails))).toBe(true);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-06 An unknown code is rejected — no balance, Add disabled',
      Tag.REGRESSION,
    ),
    async () => {
      await freshDialog();
      await gcEnterCode('000000000001');
      expect(await P.has(gcIn({ text: VqcGiftCard.invalid }))).toBe(true);
      expect(await P.count(gcIn({ textRe: 'Balance: \\$' }))).toBe(0);
      await P.clickQ(gcQuick('$25'));
      expect(await P.isDisabled(gcAdd)).toBe(true);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-07 An Inactive card cannot be used nor balance-checked',
      Tag.REGRESSION,
    ),
    async function () {
      if (!INACTIVE_CODE) this.skip();
      await freshDialog();
      await gcEnterCode(INACTIVE_CODE);
      await P.clickQ(gcQuick('$25'));
      expect(await P.isDisabled(gcAdd)).toBe(true);
      expect(await P.has(gcIn({ text: 'Active' }))).toBe(false);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-08 A very long code is accepted in full (no truncation)',
      Tag.REGRESSION,
    ),
    async () => {
      await freshDialog();
      const long = '123456789012345678901234567890';
      await P.fillQ(gcCodeBox, long);
      expect(await P.inputValue(gcCodeBox)).toBe(long);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-09 Balance Detail shows Balance, Status and the history columns',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      await P.clickQ(gcIn(VqcGiftCard.viewDetails));
      const det = VqcGiftCard.detailsDialog;
      await P.waitFor(det, 10_000, 'Gift Card Details');
      expect(await P.has([det, { textRe: '\\$[\\d,.]+', nth: 0 }])).toBe(true);
      expect(await P.has([det, { text: 'Active', nth: 0 }])).toBe(true);
      expect(await P.has([det, { text: 'Gift card history', nth: 0 }])).toBe(true);
      await P.clickQ([det, { role: 'button', name: 'Close', nth: 0 }]);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-11 History renders either its rows or a clean empty state',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      await P.clickQ(gcIn(VqcGiftCard.viewDetails));
      const det = VqcGiftCard.detailsDialog;
      await P.waitFor(det, 10_000, 'Gift Card Details');
      const t = (await P.rawText(det)) ?? '';
      expect(
        t.includes('No transaction history available') ||
          ['Order ID', 'Date', 'Amount', 'Balance'].every((h) => t.includes(h)),
      ).toBe(true);
      await P.clickQ([det, { role: 'button', name: 'Close', nth: 0 }]);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-12 Presets $25 / $50 / $100 set the value and the balance',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      for (const v of [25, 50, 100]) {
        const label = `$${String(v)}`;
        await P.clickQ(gcQuick(label));
        for (const o of VqcGiftCard.quick) expect(await gcQuickSelected(o)).toBe(o === label);
        const s = await gcSummary();
        expect(s.value).toBe(v * 100);
        expect(s.totalBalance).toBe(v * 100);
      }
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-13 A custom $73.50 is taken and formatted; balance follows',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      await P.fillQ(gcCustomAmount, '7350');
      expect(await P.inputValue(gcCustomAmount)).toBe('$73.50');
      expect((await gcSummary()).totalBalance).toBe(7_350);
    },
  );

  it(
    title('gift-card-pos-test-cases TC-14 Custom = $10,000.00 (the max) is accepted', Tag.REGRESSION),
    async function () {
      await activeDialog(this);
      await P.fillQ(gcCustomAmount, '1000000');
      expect(await P.inputValue(gcCustomAmount)).toBe('$10,000.00');
      expect(await P.isDisabled(gcAdd)).toBe(false);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-15 Above the max is refused — the value stays $10,000.00',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      await P.fillQ(gcCustomAmount, '1000000');
      await P.clickQ(gcCustomAmount);
      await P.press('End', '1');
      expect(await P.inputValue(gcCustomAmount)).toBe('$10,000.00');
    },
  );

  it(
    title('gift-card-pos-test-cases TC-16 Value $0.00 / empty cannot be added', Tag.REGRESSION),
    async function () {
      await activeDialog(this);
      expect(await P.inputValue(gcCustomAmount)).toBe('$0.00');
      expect(await P.isDisabled(gcAdd)).toBe(true);
      expect(await P.isDisabled(gcPanelBox)).toBe(true);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-17 Bonus 10% on $100 → balance $110, customer pays $100',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      await P.clickQ(gcQuick('$100'));
      await gcBonusOrDiscount('Bonus', '%', '10');
      const s = await gcSummary();
      expect(s.bonus).toBe(1_000);
      expect(s.totalBalance).toBe(11_000);
      expect(s.customerPays).toBe(10_000);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-18 Bonus $15 on $100 → balance $115, customer pays $100',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      await P.clickQ(gcQuick('$100'));
      await gcBonusOrDiscount('Bonus', '$', '1500');
      const s = await gcSummary();
      expect(s.totalBalance).toBe(11_500);
      expect(s.customerPays).toBe(10_000);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-19 Discount 10% on $100 → pays $90, balance stays $100',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      await P.clickQ(gcQuick('$100'));
      await gcBonusOrDiscount('Discount', '%', '10');
      const s = await gcSummary();
      expect(s.customerPays).toBe(9_000);
      expect(s.totalBalance).toBe(10_000);
    },
  );

  it(
    title('gift-card-pos-test-cases TC-20 Discount $20 on $100 → pays $80, balance $100', Tag.REGRESSION),
    async function () {
      await activeDialog(this);
      await P.clickQ(gcQuick('$100'));
      await gcBonusOrDiscount('Discount', '$', '2000');
      const s = await gcSummary();
      expect(s.customerPays).toBe(8_000);
      expect(s.totalBalance).toBe(10_000);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-21 Bonus $10 + Discount $15 together → balance $110, pays $85',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      await P.clickQ(gcQuick('$100'));
      await gcBonusOrDiscount('Bonus', '$', '1000');
      await gcBonusOrDiscount('Discount', '$', '1500');
      const s = await gcSummary();
      // Sheet: both apply. 1.1.x resets Bonus when Discount is chosen (PROMO-123).
      expect(s.totalBalance).toBe(11_000);
      expect(s.customerPays).toBe(8_500);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-22 Discount ≥ value → customer pays $0 (never negative)',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      await P.clickQ(gcQuick('$50'));
      await gcBonusOrDiscount('Discount', '$', '6000');
      const s = await gcSummary();
      expect(s.customerPays).toBe(0);
      expect(s.discount).toBe(-5_000);
    },
  );

  it(
    title(
      'gift-card-pos-test-cases TC-48 Percent bonus rounds to the cent ($33.33 + 15% → $5.00)',
      Tag.REGRESSION,
    ),
    async function () {
      await activeDialog(this);
      await P.fillQ(gcCustomAmount, '3333');
      await gcBonusOrDiscount('Bonus', '%', '15');
      const s = await gcSummary();
      expect(s.bonus).toBe(500);
      expect(s.totalBalance).toBe(3_833);
    },
  );

  it(
    title('gift-card-pos-test-cases TC-49 Every summary amount renders as $#,##0.00', Tag.REGRESSION),
    async function () {
      await activeDialog(this);
      await P.clickQ(gcQuick('$50'));
      const s = await gcSummary();
      for (const v of [s.value, s.bonus, s.totalBalance, s.customerPays])
        expect(Number.isInteger(v)).toBe(true);
      expect(s.text).toMatch(/\$\d{1,3}(,\d{3})*\.\d{2}/);
    },
  );

  it(
    title('gift-card-pos-test-cases TC-50 Letters typed into the value are ignored', Tag.REGRESSION),
    async function () {
      await activeDialog(this);
      await P.fillQ(gcCustomAmount, 'abc');
      expect(await P.inputValue(gcCustomAmount)).toBe('$0.00');
    },
  );
});
