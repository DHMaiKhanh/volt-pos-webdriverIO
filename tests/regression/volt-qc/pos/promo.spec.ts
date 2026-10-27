/**
 * volt-qc port — 04 PROMO / 17-added PROMO: the "Sell Gift Card" dialog (read-only cases).
 *
 * Source: volt-qc `e2e/tests/04-promo/promo-plan-giftcard-sell.spec.ts` (PROMO-N) and
 * `e2e/tests/17-added/promo-added.spec.ts` (PROMO-AD1 / AD2 / AD4).
 * TC catalogue: docs/qc/volt-qc/windows-regression/04-khuyen-mai-diem-giftcard.md.
 *
 * Every case opens the dialog from an EMPTY order frame (Quick Checkout), plays
 * with the form and closes it WITHOUT pressing Add — no order line, no top-up.
 *
 * Data: the gift card comes from the catalogue (src/data/static/giftCards.json —
 * merchant 20258 only) or `VOLT_TEST_GIFT_CARD`; PROMO-AD1 needs a card in the
 * `initial` (Not Sold Yet) state, from the catalogue or `VOLT_GC_NEW`. A merchant
 * without either skips at runtime.
 *
 * All amounts are compared in CENTS (`parseMoney`).
 */

import { expect } from '@wdio/globals';
import { VqcGiftCard } from '../../../../src/constants/testids.voltqc-pos.js';
import { activeGiftCards, giftCardCatalog } from '../../../../src/data/static/giftCards.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
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
  gcTab,
  openSellGiftCard,
} from '../../../../src/pages/voltqc/pos/giftCardProbe.js';
import { quickCheckout } from '../../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const ACTIVE_CODE = (process.env.VOLT_TEST_GIFT_CARD ?? '').trim() || (activeGiftCards[0]?.code ?? '');
const NEW_CODE =
  (process.env.VOLT_GC_NEW ?? '').trim() || (giftCardCatalog.find((c) => c.status === 'initial')?.code ?? '');

async function freshDialog(): Promise<void> {
  await returnToHome();
  await quickCheckout();
  await openSellGiftCard();
}

describe('volt-qc 04 PROMO — Sell Gift Card dialog (read-only)', () => {
  afterEach(async () => {
    await P.escape().catch(() => undefined);
    await closeSellGiftCard().catch(() => undefined);
  });

  it(
    title(
      'Sell Gift Card: layout, invalid code, Active card, presets, max, $0, Bonus, Discount, tab switch, close, View Details (PROMO-107, PROMO-109, PROMO-110, PROMO-113, PROMO-114, PROMO-115, PROMO-116, PROMO-117, PROMO-118, PROMO-119, PROMO-120, PROMO-121, PROMO-122, PROMO-123, PROMO-130, PROMO-131)',
      Tag.REGRESSION,
    ),
    async function () {
      if (!ACTIVE_CODE) this.skip();
      this.timeout(5 * 60_000);
      await freshDialog();

      await step('PROMO-107 layout before any input: Add disabled', async () => {
        for (const l of VqcGiftCard.layoutLabels) expect(await P.has(gcIn({ text: l, nth: 0 }))).toBe(true);
        expect(await P.has(gcCodeBox)).toBe(true);
        expect(await P.has(gcIn(VqcGiftCard.scan))).toBe(true);
        for (const q of VqcGiftCard.quick) expect(await P.has(gcQuick(q))).toBe(true);
        for (const t of ['Bonus', 'Discount'] as const) expect(await P.has(gcTab(t))).toBe(true);
        expect(await P.isDisabled(gcAdd)).toBe(true);
      });

      await step('PROMO-116 value $0.00: Add disabled, Bonus box disabled', async () => {
        await gcEnterCode(ACTIVE_CODE);
        expect(await P.isDisabled(gcAdd)).toBe(true);
        expect(await P.isDisabled(gcPanelBox)).toBe(true);
      });

      await step('PROMO-109 "000000000001" → "Invalid gift card number", Add disabled', async () => {
        await gcEnterCode('000000000001');
        expect(await P.has(gcIn({ text: VqcGiftCard.invalid }))).toBe(true);
        await P.clickQ(gcQuick('$25'));
        expect(await P.isDisabled(gcAdd)).toBe(true);
      });

      await step('PROMO-110 real card + $25: Active badge, Balance, no Invalid, Add enabled', async () => {
        await gcEnterCode(ACTIVE_CODE);
        expect(await P.has(gcIn({ text: 'Active' }))).toBe(true);
        expect(await P.has(gcIn({ textRe: VqcGiftCard.balanceRe }))).toBe(true);
        expect(await P.count(gcIn({ text: VqcGiftCard.invalid }))).toBe(0);
        expect(await P.isDisabled(gcAdd)).toBe(false);
      });

      await step(
        'PROMO-113 $25 / $50 / $100: one preset selected, Custom = Total Balance = Customer Pays',
        async () => {
          for (const v of [25, 50, 100]) {
            const label = `$${String(v)}`;
            await P.clickQ(gcQuick(label));
            for (const o of VqcGiftCard.quick) expect(await gcQuickSelected(o)).toBe(o === label);
            expect(await P.inputValue(gcCustomAmount)).toBe(`$${String(v)}.00`);
            const s = await gcSummary();
            expect(s.totalBalance).toBe(v * 100);
            expect(s.customerPays).toBe(v * 100);
          }
        },
      );

      await step('PROMO-114 $50 → Custom 75.00: no preset selected, Customer Pays $75.00', async () => {
        await P.clickQ(gcQuick('$50'));
        await P.fillQ(gcCustomAmount, '7500');
        for (const o of VqcGiftCard.quick) expect(await gcQuickSelected(o)).toBe(false);
        expect((await gcSummary()).customerPays).toBe(7_500);
      });

      await step('PROMO-115 Custom 1000000 then one more digit → stays $10,000.00, Add enabled', async () => {
        await P.fillQ(gcCustomAmount, '1000000');
        await P.clickQ(gcCustomAmount);
        await P.press('End', '1');
        expect(await P.inputValue(gcCustomAmount)).toBe('$10,000.00');
        expect(await P.isDisabled(gcAdd)).toBe(false);
      });

      await step('PROMO-117 $100 + Bonus 10% → Bonus $10, Total $110, Customer Pays $100', async () => {
        await P.clickQ(gcQuick('$100'));
        await gcBonusOrDiscount('Bonus', '%', '10');
        const s = await gcSummary();
        expect(s.bonus).toBe(1_000);
        expect(s.totalBalance).toBe(11_000);
        expect(s.customerPays).toBe(10_000);
      });

      await step(
        'PROMO-123 Bonus 10% → Discount 5% resets Bonus; back to Bonus resets Discount',
        async () => {
          await gcBonusOrDiscount('Discount', '%', '5');
          let s = await gcSummary();
          expect(s.bonus).toBe(0);
          expect(s.discount).toBe(-500);
          await P.clickQ(gcTab('Bonus'));
          s = await gcSummary();
          expect(s.discount).toBe(0);
          expect(s.customerPays).toBe(10_000);
        },
      );

      await step('PROMO-121 $100 + Discount 10% → Discount -$10, Total $100, Customer Pays $90', async () => {
        await gcBonusOrDiscount('Discount', '%', '10');
        const s = await gcSummary();
        expect(s.discount).toBe(-1_000);
        expect(s.totalBalance).toBe(10_000);
        expect(s.customerPays).toBe(9_000);
      });

      await step('PROMO-122 $50 + Discount $60 → clamped to $50, Customer Pays $0', async () => {
        await P.clickQ(gcQuick('$50'));
        await gcBonusOrDiscount('Discount', '$', '6000');
        const s = await gcSummary();
        expect(s.discount).toBe(-5_000);
        expect(s.customerPays).toBe(0);
      });

      await step('PROMO-118 $50 + Bonus $15 → Total $65, Customer Pays $50', async () => {
        await gcBonusOrDiscount('Bonus', '$', '1500');
        const s = await gcSummary();
        expect(s.totalBalance).toBe(6_500);
        expect(s.customerPays).toBe(5_000);
      });

      await step('PROMO-119 $50 + Bonus 150% → clamped 100% → Bonus $50, Total $100', async () => {
        await gcBonusOrDiscount('Bonus', '%', '150');
        const s = await gcSummary();
        expect(s.bonus).toBe(5_000);
        expect(s.totalBalance).toBe(10_000);
      });

      await step('PROMO-120 Custom $33.33 + Bonus 15% → Bonus $5.00, Total $38.33', async () => {
        await P.fillQ(gcCustomAmount, '3333');
        await gcBonusOrDiscount('Bonus', '%', '15');
        const s = await gcSummary();
        expect(s.bonus).toBe(500);
        expect(s.totalBalance).toBe(3_833);
      });

      await step('PROMO-131 View Details → "Gift Card Details": balance, status, history table', async () => {
        await P.clickQ(gcIn(VqcGiftCard.viewDetails));
        const det = VqcGiftCard.detailsDialog;
        await P.waitFor(det, 10_000, 'Gift Card Details');
        expect(await P.has([det, { textRe: '\\$[\\d,.]+', nth: 0 }])).toBe(true);
        expect(await P.has([det, { text: 'Active', nth: 0 }])).toBe(true);
        expect(await P.has([det, { text: 'Gift card history', nth: 0 }])).toBe(true);
        const t = (await P.rawText(det)) ?? '';
        expect(
          t.includes('No transaction history available') ||
            ['Order ID', 'Date', 'Amount', 'Balance'].every((h) => t.includes(h)),
        ).toBe(true);
        await P.clickQ([det, { role: 'button', name: 'Close', nth: 0 }]);
        await P.waitGoneQ(det, 5_000, 'Gift Card Details');
      });

      await step('PROMO-130 Close → reopen: empty form, no line added to the order', async () => {
        await P.clickQ(gcQuick('$50'));
        await gcBonusOrDiscount('Bonus', '%', '10');
        await closeSellGiftCard();
        const last4 = ACTIVE_CODE.slice(-4);
        expect(await P.count([{ css: 'main' }, { textRe: `Gift Card \\[\\*+-\\*+-${last4}\\]` }])).toBe(0);
        await openSellGiftCard();
        expect(await P.inputValue(gcCodeBox)).toBe('');
        expect(await P.inputValue(gcCustomAmount)).toBe('$0.00');
        expect(await P.count(gcIn({ textRe: 'Balance: \\$' }))).toBe(0);
        await closeSellGiftCard();
      });
    },
  );

  it(
    title(
      'A code with spaces still looks up (Not Sold Yet, $0.00); 30 digits → "Invalid gift card number", Add disabled (PROMO-167)',
      Tag.REGRESSION,
    ),
    async function () {
      if (!NEW_CODE) this.skip();
      await freshDialog();
      const spaced = NEW_CODE.replace(/(\d{4})(?=\d)/g, '$1 ');
      await P.fillQ(gcCodeBox, spaced);
      await P.waitFor(gcIn({ textRe: 'Balance: \\$', nth: 0 }), 15_000, 'Balance line');
      const text = (await P.rawText(VqcGiftCard.dialog)) ?? '';
      expect(text).toMatch(/Not Sold Yet/);
      expect(text).toMatch(/Balance: \$0\.00/);

      const long = '123456789012345678901234567890';
      await P.fillQ(gcCodeBox, long);
      expect(await P.inputValue(gcCodeBox)).toBe(long);
      await P.waitFor(gcIn({ text: VqcGiftCard.invalid }), 15_000, '"Invalid gift card number"');
      await P.clickQ(gcQuick('$25'));
      expect(await P.isDisabled(gcAdd)).toBe(true);
    },
  );

  it(
    title(
      'View Details: balance = Balance; history (Order ID, Date, Amount, Balance) ≤ 5 rows, signed/coloured amounts, running balance (PROMO-168)',
      Tag.REGRESSION,
    ),
    async function () {
      if (!ACTIVE_CODE) this.skip();
      await freshDialog();
      await gcEnterCode(ACTIVE_CODE);
      const bal = await gcBalanceCents();
      await P.clickQ(gcIn(VqcGiftCard.viewDetails));
      const det = { role: 'dialog', name: 'Gift Card Details', nth: -1 } as const;
      await P.waitFor(det, 10_000, 'Gift Card Details');
      const t = ((await P.rawText(det)) ?? '').replace(/\s*\n+\s*/g, ' | ');
      expect(t).toContain('The balance of');
      const balText = `$${(bal / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      expect(t).toContain(balText);
      expect(await P.has([det, { text: 'Gift card history' }])).toBe(true);

      const headers = (await P.texts([det, { css: 'thead th, [role="columnheader"]' }])).map((s) => s.trim());
      expect(headers.slice(0, 4)).toEqual(['Order ID', 'Date', 'Amount', 'Balance']);
      const rows = await P.exec<{ order: string; amount: string; balance: string; cls: string }[]>(`
        var dlgs = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"]'), function (d) {
          return d.getAttribute('aria-label') === 'Gift Card Details' || /Gift Card Details/.test(d.textContent || '');
        });
        var dlg = dlgs[dlgs.length - 1];
        if (!dlg) return [];
        return Array.prototype.map.call(dlg.querySelectorAll('tbody tr'), function (tr) {
          var td = tr.querySelectorAll('td');
          var amt = td[2] ? td[2].querySelector('span') : null;
          return {
            order: td[0] ? (td[0].textContent || '').trim() : '',
            amount: td[2] ? (td[2].textContent || '').trim() : '',
            balance: td[3] ? (td[3].textContent || '').trim() : '',
            cls: amt ? amt.className : (td[2] ? td[2].className : '')
          };
        });
      `);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(5);
      const signed = (s: string): number =>
        (s.trim().startsWith('-') ? -1 : 1) * parseMoneyLoose(s.replace(/^[+-]/, ''));
      for (const r of rows) {
        expect(r.amount).toMatch(/^[+-]\$[\d,.]+$/);
        expect(r.cls).toMatch(signed(r.amount) >= 0 ? /green/ : /destructive|red/);
        expect(r.order).toMatch(/^(OD\d{6}-\d+|_+)$/);
      }
      // Newest row = current balance; consecutive rows differ by exactly that row's Amount.
      expect(parseMoneyLoose(rows[0]?.balance ?? '')).toBe(bal);
      for (let i = 0; i + 1 < rows.length; i += 1) {
        const a = rows[i];
        const b = rows[i + 1];
        if (!a || !b) continue;
        expect(parseMoneyLoose(a.balance) - parseMoneyLoose(b.balance)).toBe(signed(a.amount));
      }
      const viewAll = [det, { role: 'button', name: 'View all' }] as const;
      if (await P.has(viewAll)) {
        await P.clickQ(viewAll);
        const hist = VqcGiftCard.historyDialog;
        await P.waitFor(hist, 10_000, 'Gift card history');
        expect(await P.count([hist, { css: '[role="row"], tr' }])).toBeGreaterThanOrEqual(rows.length);
        await P.escape();
      }
      await P.escape();
    },
  );

  it(
    title(
      'Money inputs take digits only ("abc" ignored, "-50" → $0.50, "1.2.3" → $1.23); Bonus % 10.5 → 105 → clamped 100 (PROMO-171)',
      Tag.REGRESSION,
    ),
    async function () {
      if (!ACTIVE_CODE) this.skip();
      await freshDialog();
      await gcEnterCode(ACTIVE_CODE);
      await P.typeQ(gcCustomAmount, 'abc');
      expect(await P.inputValue(gcCustomAmount)).toMatch(/^(\$0\.00)?$/);
      expect(await P.isDisabled(gcAdd)).toBe(true);
      await P.typeQ(gcCustomAmount, '-50');
      expect(await P.inputValue(gcCustomAmount)).toBe('$0.50');
      await P.fillQ(gcCustomAmount, '');
      await P.typeQ(gcCustomAmount, '1.2.3');
      expect(await P.inputValue(gcCustomAmount)).toBe('$1.23');

      await P.clickQ(gcQuick('$100'));
      await P.clickQ(gcTab('Bonus'));
      const combo = [VqcGiftCard.dialog, { role: 'tabpanel', nth: 0 }, { role: 'combobox', nth: 0 }] as const;
      if ((await P.textOf(combo)).trim() !== '%') {
        await P.clickQ(combo);
        await P.clickQ({ role: 'option', name: '%' });
      }
      await P.typeQ(gcPanelBox, '10.5');
      expect(await P.inputValue(gcPanelBox)).toBe('100');
      const s = await gcSummary();
      expect(s.bonus).toBe(10_000);
      expect(s.totalBalance).toBe(20_000);
    },
  );
});

/** `$1,234.56` → cents; NaN instead of throwing on an empty cell. */
function parseMoneyLoose(text: string): number {
  const m = /-?\$?[\d,]+(?:\.\d{1,2})?/.exec(text.replace(/\s/g, ''));
  if (!m) return Number.NaN;
  const negative = m[0].startsWith('-');
  const n = Number(m[0].replace(/[-$,]/g, ''));
  return Math.round(n * 100) * (negative ? -1 : 1);
}
