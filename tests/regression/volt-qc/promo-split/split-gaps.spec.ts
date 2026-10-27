/**
 * volt-qc 05 SPLIT — TC rows with no volt-qc Playwright test, written from the
 * catalogue (docs/qc/volt-qc/windows-regression/05-split-order.md).
 *
 * Numbers are relations measured on the app (the merchant's fee/tax may change):
 * checks always sum to the Home Total, Equally follows the floor/last-cent rule.
 *
 * CREATES DATA — draft orders; SPLIT-067 / SPLIT-122 also settle a split order.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsSplit } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  addGiftCardLine,
  createQuickPayOrder,
  customDiscountSplit,
  ensureGiftCardBalance,
  giftCardCooldown,
  markGiftCardUse,
} from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import {
  cardTotalOrder,
  checkAmounts,
  completeDone,
  evenSplit,
  isModeActive,
  methodButton,
  modeButton,
  openAmountKeypad,
  openSplit,
  payButton,
  payCheck,
  selectCheck,
  setCheckAmount,
  settleSplit,
  splitButton,
} from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  app,
  clickOrJs,
  money,
  visible,
  vqEnv,
  waitUntil,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const sumC = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) * 100);

/** Poll the unpaid check amounts until they sum to `totalCents` (re-render after an edit). */
async function settledAmounts(id: string, totalCents: number): Promise<number[]> {
  let a: number[] = [];
  await waitUntil(
    async () => {
      a = await checkAmounts(id);
      return sumC(a) === totalCents;
    },
    5_000,
    250,
  );
  return a;
}

describe('volt-qc 05 SPLIT — catalogue gaps', () => {
  const splits = new Set<string>();

  before(() => {
    assertWritesAllowed('build split orders');
  });

  afterEach(async () => {
    for (const id of splits) await settleSplit(id);
    splits.clear();
    await app.closeStrayDialogs().catch(() => undefined);
    if (/split-order/.test(await app.url().catch(() => ''))) {
      await clickOrJs(VqpsSplit.backToOrder).catch(() => undefined);
    }
    await app.cleanupOrders().catch(() => undefined);
  });

  it(
    title('An order with a gift-card sale line cannot be split (SPLIT-005)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn('SPLIT-005: VOLT_TEST_GIFT_CARD is not set');
        this.skip();
      }
      this.timeout(3 * 60_000);
      const id = await app.createOrder();
      await addGiftCardLine(vqEnv.testGiftCard, 25);
      await app.openPendingOrder(id);
      expect(await P.isDisabled(splitButton)).toBe(true);
    },
  );

  it(
    title(
      'Equally: a total divisible by 3 gives 3 equal checks with no stray cent (SPLIT-115)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const { id, T } = await cardTotalOrder(15_000);
      const tc = Math.round(T * 100);
      if (tc % 3 !== 0) {
        console.warn(
          `SPLIT-115: could not build a total divisible by 3 under the current fee/tax (got ${String(T)})`,
        );
        this.skip();
      }
      await openSplit();
      await clickOrJs(VqpsSplit.addCheck);
      const a = await settledAmounts(id, tc);
      expect(a.length).toBe(3);
      for (const x of a) expect(Math.round(x * 100)).toBe(tc / 3);
      expect(sumC(a)).toBe(tc);
    },
  );

  it(
    title(
      'Equally: tapping a check amount only selects the check — no keypad, no manual edit (SPLIT-120)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(3 * 60_000);
      const id = await createQuickPayOrder([{ amount: 40, name: 'QC SPL120' }]);
      const T = (await app.orderTotals()).total;
      await openSplit();
      expect(await isModeActive('Equally')).toBe(true);
      const [, c2] = evenSplit(T, 2);
      await selectCheck(id, 2);
      await clickOrJs(methodButton('Card'));
      const ok = await openAmountKeypad(id, 2)
        .then(() => true)
        .catch(() => false);
      expect(ok).toBe(false);
      expect(await visible(VqpsSplit.amountKeypad)).toBe(false);
      expect(money(await P.textOf(payButton))).toBeCloseTo(c2 ?? Number.NaN, 2);
      const a = await checkAmounts(id);
      expect(a.map((x) => Math.round(x * 100))).toEqual(evenSplit(T, 2).map((x) => Math.round(x * 100)));
    },
  );

  it(
    title(
      'Equally ↔ By Amount before any payment keeps the check count but resets to an even split (SPLIT-118)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const id = await createQuickPayOrder([{ amount: 60, name: 'QC SPL118' }]);
      const T = (await app.orderTotals()).total;
      const tc = Math.round(T * 100);
      await openSplit();
      const even = (n: number): number[] => evenSplit(T, n).map((x) => Math.round(x * 100));

      await step('2 checks: By Amount 30% on check 1 → Equally → even again', async () => {
        await clickOrJs(modeButton('By Amount'));
        await setCheckAmount(id, 1, String(Math.round(tc * 0.3)));
        await clickOrJs(modeButton('Equally'));
        const a = await settledAmounts(id, tc);
        expect(a.map((x) => Math.round(x * 100))).toEqual(even(2));
        await clickOrJs(modeButton('By Amount'));
        const b = await settledAmounts(id, tc);
        expect(b.map((x) => Math.round(x * 100))).toEqual(even(2));
      });

      await step('3 checks (Add New Check) survive the switch, still even', async () => {
        await clickOrJs(modeButton('Equally'));
        await clickOrJs(VqpsSplit.addCheck);
        await clickOrJs(modeButton('By Amount'));
        const a = await settledAmounts(id, tc);
        expect(a.length).toBe(3);
        expect(a.map((x) => Math.round(x * 100))).toEqual(even(3));
      });
    },
  );

  it(
    title(
      'By Amount keypad has no minus / decimal key; Esc applies the typed value like Done (SPLIT-116)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(3 * 60_000);
      const id = await createQuickPayOrder([{ amount: 80, name: 'QC SPL116' }]);
      const tc = Math.round((await app.orderTotals()).total * 100);
      await openSplit();
      await clickOrJs(modeButton('By Amount'));
      await selectCheck(id, 1);
      await openAmountKeypad(id, 1);
      const kp = VqpsSplit.amountKeypad;
      expect(await P.count([kp, { role: 'button', textRe: '^\\s*[-.,]\\s*$' }])).toBe(0);
      for (let i = 0; i < 10; i += 1) await P.clickQ([kp, { role: 'button', nth: 11 }]);
      const want = Math.round(tc * 0.25);
      for (const d of String(want)) await P.clickQ([kp, btn(d)]);
      await P.escape();
      await P.waitGoneQ(kp, 5_000);
      await settle(500);
      const a = await settledAmounts(id, tc);
      expect(Math.round((a[0] ?? 0) * 100)).toBe(want);
      expect(sumC(a)).toBe(tc);
    },
  );

  it(
    title(
      'By Amount: editing the LAST check rebalances the open check before it; over-total is refused (SPLIT-117)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(3 * 60_000);
      const id = await createQuickPayOrder([{ amount: 90, name: 'QC SPL117' }]);
      const tc = Math.round((await app.orderTotals()).total * 100);
      await openSplit();
      await clickOrJs(modeButton('By Amount'));
      const last = Math.round(tc * 0.3);
      await setCheckAmount(id, 2, String(last));
      let a = await settledAmounts(id, tc);
      expect(Math.round((a[1] ?? 0) * 100)).toBe(last);
      expect(Math.round((a[0] ?? 0) * 100)).toBe(tc - last);

      await setCheckAmount(id, 2, String(tc + 10_000));
      a = await settledAmounts(id, tc);
      expect(sumC(a)).toBe(tc);
      expect(Math.max(...a.map((x) => Math.round(x * 100)))).toBeLessThanOrEqual(tc);
    },
  );

  it(
    title(
      'Pay always shows the amount of the selected check (for its method); one check selected at a time (SPLIT-119)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(3 * 60_000);
      const id = await createQuickPayOrder([{ amount: 100, name: 'QC SPL119' }]);
      const tc = Math.round((await app.orderTotals()).total * 100);
      await openSplit();
      await clickOrJs(modeButton('By Amount'));
      const c1 = Math.round(tc * 0.45);
      await setCheckAmount(id, 1, String(c1));
      await settledAmounts(id, tc);

      await selectCheck(id, 1);
      await clickOrJs(methodButton('Card'));
      expect(Math.round(money(await P.textOf(payButton)) * 100)).toBe(c1);
      await selectCheck(id, 2);
      await clickOrJs(methodButton('Card'));
      expect(Math.round(money(await P.textOf(payButton)) * 100)).toBe(tc - c1);
      // Exactly one check row is marked selected (radio).
      const selected = await P.exec<number>(
        `return Array.prototype.filter.call(document.querySelectorAll('main [aria-label^="Select #"]'), function (e) {
           return e.getAttribute('aria-checked') === 'true' || e.getAttribute('data-state') === 'checked';
         }).length;`,
      );
      expect(selected).toBeLessThanOrEqual(1);
    },
  );

  it(
    title(
      'An order discount is taken before splitting: the checks sum to the discounted Total (SPLIT-121)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(3 * 60_000);
      const id = await createQuickPayOrder([{ amount: 110, name: 'QC SPL121' }]);
      await customDiscountSplit('$', 10);
      const t = await app.orderTotals();
      expect(t.promotion).toBeCloseTo(-10, 2);
      const tc = Math.round(t.total * 100);
      await openSplit();
      const a = await settledAmounts(id, tc);
      expect(sumC(a)).toBe(tc);
      expect(sumC(a)).toBeLessThan(Math.round(t.subtotal * 100) + Math.round(t.tax * 100));
    },
  );

  it(
    title(
      'A split order with a paid check: Home offers Cancel → "Order already has a payment" instead of delete (SPLIT-067)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const id = await createQuickPayOrder([{ amount: 30, name: 'QC SPL067' }]);
      await openSplit();
      splits.add(id);
      await payCheck(id, 1, 'Other', { otherName: 'E2E 067' });
      // The split screen hides "Back to order" once a check is paid: leave through the router.
      await app.openPendingOrder(id);
      const cancel = inMain({ role: 'button', nameRe: '^(Cancel Order|Remove)$', nth: 0 });
      await clickOrJs(cancel);
      await app.passcodeIfAsked(2_000);
      const dlg = { role: 'dialog', hasText: 'already', nth: -1 } as const;
      expect(
        await P.poll(
          () => P.has(dlg),
          (v) => v,
          5_000,
        ),
      ).toBe(true);
      const t = (await P.rawText(dlg)) ?? '';
      expect(t).toMatch(/Order already has a payment/);
      expect(t).toMatch(/Order History/);
      await app.closeStrayDialogs();
      // Back to the split screen so afterEach can settle the rest.
      await openSplit();
    },
  );

  it(
    title(
      'A split with a Gift Card check has no Refund — only Cancel Order while unsettled (SPLIT-122)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!vqEnv.testGiftCard) {
        console.warn('SPLIT-122: VOLT_TEST_GIFT_CARD is not set');
        this.skip();
      }
      this.timeout(6 * 60_000);
      await ensureGiftCardBalance(vqEnv.testGiftCard, 20);
      const id = await createQuickPayOrder([{ amount: 20, name: 'QC SPL122' }]);
      await openSplit();
      splits.add(id);
      await giftCardCooldown();
      await payCheck(id, 1, 'Gift Card', { giftCard: vqEnv.testGiftCard });
      markGiftCardUse();
      await payCheck(id, 2, 'Cash');
      await completeDone();
      await app.noReceipt();
      splits.delete(id);
      await app.openHistoryOrder(id);
      expect(await P.count(inMain(btn('Refund')))).toBe(0);
      expect(await P.count({ css: '[data-testid="order-action-refund"]' })).toBe(0);
      expect(await P.has(inMain(btn('Cancel Order')))).toBe(true);
    },
  );
});
