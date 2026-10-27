/**
 * volt-qc port — 05 SPLIT plan, part A (SPLIT-E … SPLIT-J).
 *
 * Source: volt-qc `e2e/tests/05-split/split-plan.spec.ts` (every test before SPLIT-K1).
 *
 * Since 2026-10-09 the merchant may charge a Card service fee + tax: checks are
 * split from the Card Total on Home; Cash/Other/Gift Card ≈ check / (1 + fee)
 * (S.nonCardShare; the app reconciles ≤ 2¢ → read the "Pay $x" button).
 * "$100 / $10.01 / …" orders are built with S.cardTotalOrder (Quick Pay base
 * price chosen by the price model so the Card Total ≈ the TC amount) and the
 * expectations are computed from the Total T read on Home. A test that paid one
 * check must settle it (S.settleSplit) — the split screen blocks leaving with a
 * paid check and a paid order cannot be deleted. Money in DOLLARS.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { VqcCommon, btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsHome, VqpsSplit } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { cardTotalOf, priceModel } from '../../../../src/pages/voltqc/promo-split/price.js';
import * as S from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  addCheckButton,
  amountBoxText,
  cashDrawerButton,
  clickCheckRow,
  clickRowButton,
  closePasscode,
  dblClickOtherPay,
  deleteCheckButton,
  dragItemToCheck,
  hasHardware,
  isEnabled,
  moveItem,
  prices,
  reopenToHome,
  roleWithout,
  routerNavigate,
  rowLabelCount,
  selectCheckButton,
  sum,
  tapAmountBox,
  textQ,
  typeCode,
  unknownCode,
  waitAmountBox,
} from '../../../../src/pages/voltqc/promo-split/splitPlanAExtra.js';
import {
  app,
  appears,
  clickOrJs,
  field,
  money,
  vqEnv,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const r2 = (x: number): number => Math.round(x * 100) / 100;
const obs = (s: string): void => console.warn(`[observation] ${s}`);

/** Split left half-paid by the running test (settled in afterEach). */
let openSplit = '';

/** Run `body`, always settling the half-paid split `id` afterwards (source `try … finally S.settleSplit`). */
async function withSettle(id: string, body: () => Promise<void>): Promise<void> {
  openSplit = id;
  try {
    await body();
  } finally {
    await S.settleSplit(id);
    openSplit = '';
  }
}

describe('volt-qc 05 SPLIT plan A (SPLIT-E … SPLIT-J)', () => {
  before(() => {
    assertWritesAllowed('volt-qc 05 SPLIT plan A');
  });

  afterEach(async () => {
    await app.closeStrayDialogs().catch(() => undefined);
    if (openSplit) await S.settleSplit(openSplit).catch(() => undefined);
    openSplit = '';
    await app.cleanupOrders().catch(() => undefined);
  });

  /* ======================= SPLIT-E entry conditions ======================= */

  describe('SPLIT-E entry conditions', () => {
    it(
      title(
        'SPLIT-E1 Staff only → Split disabled; Quick Pay (Total $5.01) → Split enabled, 2 checks $2.50 / $2.51 (SPLIT-003, SPLIT-004)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        // Quick Pay base price chosen so the Card Total = $5.01 (as the TC: $4.86 + SF).
        const m = await priceModel(); // measure before opening the order
        await S.startOrder();
        expect(await P.isDisabled(VqpsHome.splitButton)).toBe(true);
        const lines = S.quickPayLinesFor(m, 501);
        for (const c of lines) await S.addQuickPay({ cents: c });
        const T = (await app.orderTotals()).total;
        // VERIFY: app rounding of fee/tax matches the model so Total is exactly $5.01 (the threshold).
        expect(T).toBeCloseTo(5.01, 2);
        expect(await P.isDisabled(VqpsHome.splitButton)).toBe(false);
        const id = await app.orderId();
        await S.openSplit();
        expect(await S.checkAmounts(id)).toEqual(S.evenSplit(T, 2));
      },
    );

    it(
      title(
        'SPLIT-E2 Direct split URL of an order with a gift card sale line → blocking toast and back to /home (SPLIT-006)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        if (!vqEnv.testGiftCard) {
          console.warn('Needs VOLT_TEST_GIFT_CARD');
          this.skip();
        }
        this.timeout(4 * 60_000);
        const id = await app.createOrder();
        await app.openSellGiftCard();
        const gc = { role: 'dialog', name: 'Sell Gift Card', nth: -1 } as const;
        await P.fillQ([gc, { role: 'textbox', name: 'Enter gift card code' }], vqEnv.testGiftCard);
        await P.waitFor([gc, { textRe: 'Balance: \\$', nth: 0 }], 10_000, 'gift card Balance');
        await P.clickQ([gc, btn('$25')]);
        await P.clickQ([gc, btn('Add')]);
        await P.waitGoneQ(gc, 8_000, 'Sell Gift Card');
        await app.pay();
        const uuid = await S.orderUuidFromUrl();
        await app.openPendingOrder(id);
        await routerNavigate('/order/$orderId/split-order', { orderId: uuid });
        expect(
          await appears(
            textQ('Cannot split an order with a Gift Card. Create a separate order for the Gift Card.'),
            10_000,
          ),
        ).toBe(true);
        await app.waitPath(/\/home/, 10_000);
      },
    );

    it(
      title(
        'SPLIT-E3 Re-open a paid order: no Split button on Home; split-order?editOrderId redirects to /order-history/<id> (SPLIT-007)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const { id } = await app.createPaidOrder({ method: 'Other' });
        await reopenToHome(id);
        const uuid = (await P.urlParam('editOrderId')) ?? '';
        try {
          expect(await P.count(VqpsHome.splitButton)).toBe(0);
          await routerNavigate('/order/$orderId/split-order', { orderId: uuid }, { editOrderId: uuid });
          await app.waitPath(new RegExp(`/order-history/${uuid}`), 15_000);
        } finally {
          // VERIFY: go back to edit mode to finish the re-open cleanly (Pay → Re-Open Done).
          await routerNavigate('/home', undefined, { editOrderId: uuid }).catch(() => undefined);
          await app.passcodeIfAsked(2_000);
          await app.waitPath(/\/home\?editOrderId=/, 15_000).catch(() => undefined);
          await app
            .finishReopen()
            .catch((e: unknown) => console.warn(`[cleanup] Re-Open Done failed: ${(e as Error).message}`));
        }
      },
    );

    it(
      title(
        'SPLIT-E4 By Amount, Back to order, re-enter Split: checks sum = Total (SPLIT-010)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
        const total = (await app.orderTotals()).total;
        await S.openSplit();
        await clickOrJs(S.modeButton('By Amount'));
        await P.clickQ(inMain(btn('Back to order', 0)));
        await app.waitPath(/\/home/, 10_000);
        await S.openSplit();
        const modes: string[] = [];
        for (const m of ['Equally', 'By Amount', 'By Items'] as const)
          if (await S.isModeActive(m)) modes.push(m);
        obs(`SPLIT-010: re-entered Split in mode ${modes.join(',') || '?'}`);
        expect(sum(await S.checkAmounts(id))).toBeCloseTo(total, 2);
      },
    );
  });

  /* ========================= SPLIT-F Equally ========================= */

  describe('SPLIT-F Equally', () => {
    // Orders built by S.cardTotalOrder (Card Total ≈ $10.01, $100, …); expectations from T read on Home (S.evenSplit).
    it(
      title(
        'SPLIT-F1 $10.01 split in two → Check 1 $5.00, Check 2 $5.01 (SPLIT-011)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const { id, T } = await S.cardTotalOrder(1001);
        // VERIFY: the built Total must have an odd cent (like $10.01) to check the leftover cent; otherwise just note it.
        if (Math.round(T * 100) % 2 !== 1)
          obs(`SPLIT-011: Total ${String(T)} has no odd cent — leftover cent not checked`);
        await S.openSplit();
        expect(await S.checkAmounts(id)).toEqual(S.evenSplit(T, 2));
      },
    );

    it(
      title(
        'SPLIT-F2 $100 + Add New Check → $33.33/$33.33/$33.34 with #<code>-3; delete Check 3 → $50/$50, delete icon hidden at 2 checks (SPLIT-012, SPLIT-015)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const { id, T } = await S.cardTotalOrder(10000);
        await S.openSplit();
        await P.clickQ(addCheckButton);
        await P.waitFor(selectCheckButton(id, 3), 5_000, 'Check 3');
        expect(
          (await P.has(inMain({ text: `(${id.slice(-5)}-3)`, nth: 0 }))) ||
            (await P.has(inMain({ textRe: '\\(.*-3\\)', nth: 0 }))),
        ).toBe(true);
        expect(await S.checkAmounts(id)).toEqual(S.evenSplit(T, 3));
        await clickOrJs(deleteCheckButton(id, 3));
        await P.waitGoneQ(selectCheckButton(id, 3), 5_000, 'Check 3');
        expect(await S.checkAmounts(id)).toEqual(S.evenSplit(T, 2));
        expect(await P.count(inMain({ role: 'button', nameRe: `^Delete #${id}-` }))).toBe(0);
      },
    );

    it(
      title(
        'SPLIT-F3 $100.02 into 4 checks → $25.00/$25.00/$25.01/$25.01 (SPLIT-013)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const { id, T } = await S.cardTotalOrder(10002);
        // VERIFY: the built Total must leave ≥ 2 cents when split by 4 (like $100.02); otherwise just note it.
        if (Math.round(T * 100) % 4 < 2)
          obs(`SPLIT-013: Total ${String(T)} / 4 leaves < 2 cents — spread not checked`);
        await S.openSplit();
        await P.clickQ(addCheckButton);
        await P.clickQ(addCheckButton);
        await settle(300);
        expect(await S.checkAmounts(id)).toEqual(S.evenSplit(T, 4));
      },
    );

    it(
      title(
        'SPLIT-F4 $5.50: add checks until locked → 5 checks × $1.10, Add New Check disabled (SPLIT-014)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const { id, T } = await S.cardTotalOrder(550);
        await S.openSplit();
        for (let i = 0; i < 6 && (await isEnabled(addCheckButton)); i += 1) {
          await P.clickQ(addCheckButton);
          await settle(300);
        }
        // Max checks with each ≥ $1.00 (T = $5.50 → 5 checks × $1.10).
        const n = Math.floor(Math.round(T * 100) / 100);
        expect(await S.checkAmounts(id)).toEqual(S.evenSplit(T, n));
        expect(await P.isDisabled(addCheckButton)).toBe(true);
      },
    );

    it(
      title(
        'SPLIT-F5 $100 3 checks, pay Check 1 Other then delete Check 3: Check 1 keeps Total Paid (Other price of $33.33), rest $66.67, sum $100 (SPLIT-016)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const { id, T, m } = await S.cardTotalOrder(10000);
        await S.openSplit();
        await withSettle(id, async () => {
          await P.clickQ(addCheckButton);
          await settle(300);
          const slice1 = (await S.checkAmounts(id))[0] ?? Number.NaN;
          // TC SPLIT-016: Total Paid = Other price of the slice, read on "Pay $x" (≤ 2¢ off slice / (1 + fee)).
          const other1 = await S.methodPrice(id, 1, 'Other');
          expect(other1).toBeCloseTo(S.nonCardShare(m, slice1), 1);
          await S.payCheck(id, 1, 'Other');
          await clickOrJs(deleteCheckButton(id, 3));
          await P.waitGoneQ(selectCheckButton(id, 3), 5_000, 'Check 3');
          expect(await S.isCheckPaid(id, 1)).toBe(true);
          expect(await S.checkRowText(id, 1)).toContain(`Total Paid: $${other1.toFixed(2)}`);
          const rest = await S.checkAmount(id, 2);
          expect(rest).toBeCloseTo(T - slice1, 2);
          // Card-price sum of the checks (paid slice + remaining check) = Total.
          expect(slice1 + rest).toBeCloseTo(T, 2);
        });
      },
    );

    it(
      title(
        'SPLIT-F6 Equally → By Amount → By Items → Equally: active button follows, checks sum always = Total (SPLIT-017)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
        const total = (await app.orderTotals()).total;
        await S.openSplit();
        for (const m of ['By Amount', 'By Items', 'Equally'] as const) {
          await clickOrJs(S.modeButton(m));
          await settle(600);
          expect(await S.isModeActive(m)).toBe(true);
          expect(sum(await S.checkAmounts(id))).toBeCloseTo(total, 2);
        }
      },
    );
  });

  /* ========================= SPLIT-G By Amount ========================= */

  describe('SPLIT-G By Amount', () => {
    it(
      title(
        'SPLIT-G1 Amount box: 1st tap selects, 2nd opens keypad ($50.00 prefilled); Check 1 = $30 → 30/70; $0 or $110 → keeps 30/70 (SPLIT-018, SPLIT-019, SPLIT-021, SPLIT-022)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        // Card Total ≈ $100; expectations from T instead of hard 50 / 70.
        const { id, T } = await S.cardTotalOrder(10000);
        await S.openSplit();
        await clickOrJs(S.modeButton('By Amount'));
        await S.selectCheck(id, 1);
        await tapAmountBox(id, 2);
        expect(await P.count(VqpsSplit.amountKeypad)).toBe(0); // first tap only selects the check
        await tapAmountBox(id, 2);
        const kp = VqpsSplit.amountKeypad;
        await P.waitFor(kp, 5_000, 'amount keypad');
        for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'Done'])
          expect(await P.has([kp, btn(k)])).toBe(true);
        expect(await P.count([kp, { role: 'button' }])).toBe(13); // + backspace (icon)
        const want2 = `$${(S.evenSplit(T, 2)[1] ?? 0).toFixed(2)}`;
        expect(await waitAmountBox(id, 2, want2)).toBe(want2);
        await P.clickQ([kp, btn('Done')]);

        await S.setCheckAmount(id, 1, '3000');
        const want = [30, r2(T - 30)];
        expect(await S.checkAmounts(id)).toEqual(want);
        await S.setCheckAmount(id, 1, '0');
        expect(await S.checkAmounts(id)).toEqual(want); // $0 must revert to 30/70
        await S.setCheckAmount(id, 1, String(Math.round(T * 100) + 1000)); // over Total by $10
        expect(await S.checkAmounts(id)).toEqual(want); // over-total must revert to 30/70
      },
    );

    it(
      title(
        'SPLIT-G2 30/70 + Add New Check → 30/69/1; Check 2 = $50 → 30/50/20; Check 1 = $80 → no negative check, sum $100 (SPLIT-020, SPLIT-023)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const { id, T } = await S.cardTotalOrder(10000);
        await S.openSplit();
        await clickOrJs(S.modeButton('By Amount'));
        await S.setCheckAmount(id, 1, '3000');
        await P.clickQ(addCheckButton);
        await settle(300);
        // The new check takes $1.00 from the last check (T = $100 → 30/69/1).
        expect(await S.checkAmounts(id)).toEqual([30, r2(T - 31), 1]);
        await S.setCheckAmount(id, 2, '5000');
        expect(await S.checkAmounts(id)).toEqual([30, 50, r2(T - 80)]);
        await S.setCheckAmount(id, 1, '8000');
        const after = await S.checkAmounts(id);
        obs(`SPLIT-023: 30/50/20 → Check 1 = $80 gives ${after.join(' / ')}`);
        for (const a of after) expect(a).toBeGreaterThan(0);
        expect(sum(after)).toBeCloseTo(T, 2);
      },
    );

    it(
      title(
        'SPLIT-G3 Check 1 $99.50 (leaves < $1) reverts; $99.00 → 99/1 (SPLIT-024)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const { id, T } = await S.cardTotalOrder(10000);
        const tc = Math.round(T * 100);
        await S.openSplit();
        await clickOrJs(S.modeButton('By Amount'));
        const before = await S.checkAmounts(id);
        // Relative to T: leaving $0.50 (< $1) reverts; leaving exactly $1.00 is accepted.
        await S.setCheckAmount(id, 1, String(tc - 50));
        expect(await S.checkAmounts(id)).toEqual(before);
        await S.setCheckAmount(id, 1, String(tc - 100));
        expect(await S.checkAmounts(id)).toEqual([(tc - 100) / 100, 1]);
      },
    );

    it(
      title(
        'SPLIT-G4 30/70, pay Check 1 Other → Check 2 typed $50 keeps $70.00 (last check fixed) (SPLIT-025)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const { id, T } = await S.cardTotalOrder(10000);
        await S.openSplit();
        await withSettle(id, async () => {
          await clickOrJs(S.modeButton('By Amount'));
          await S.setCheckAmount(id, 1, '3000');
          await S.payCheck(id, 1, 'Other');
          await S.setCheckAmount(id, 2, '5000');
          // Last check fixed = T − 30 (T = $100 → $70.00).
          expect(await S.checkAmount(id, 2)).toBeCloseTo(T - 30, 2);
        });
      },
    );

    it(
      title(
        'SPLIT-G5 $5.01 By Amount: add checks until locked → at most 5 checks, each ≥ $1.00, sum $5.01 (SPLIT-026)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const { id, T } = await S.cardTotalOrder(501);
        await S.openSplit();
        await clickOrJs(S.modeButton('By Amount'));
        for (let i = 0; i < 6 && (await isEnabled(addCheckButton)); i += 1) {
          await P.clickQ(addCheckButton);
          await settle(300);
        }
        const a = await S.checkAmounts(id);
        expect(a.length).toBeLessThanOrEqual(5);
        for (const x of a) expect(x).toBeGreaterThanOrEqual(1);
        expect(sum(a)).toBeCloseTo(T, 2);
        expect(await P.isDisabled(addCheckButton)).toBe(true);
      },
    );

    it(
      title(
        'SPLIT-G6 Keypad: clear all → 1, 00 = $1.00; a 10th digit is ignored (SPLIT-027)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = await S.quickPayOrder([10000]);
        await S.openSplit();
        await clickOrJs(S.modeButton('By Amount'));
        await S.selectCheck(id, 1);
        await tapAmountBox(id, 1);
        const kp = VqpsSplit.amountKeypad;
        await P.waitFor(kp, 5_000, 'amount keypad');
        const back = [kp, { role: 'button', nth: 11 }] as const;
        for (let i = 0; i < 10; i += 1) await P.clickQ(back);
        await P.clickQ([kp, btn('1')]);
        await P.clickQ([kp, btn('00')]);
        expect(await waitAmountBox(id, 1, '$1.00')).toBe('$1.00');
        for (let i = 0; i < 10; i += 1) await P.clickQ(back);
        for (const d of '123456789') await P.clickQ([kp, btn(d)]);
        expect(await waitAmountBox(id, 1, '$1,234,567.89')).toBe('$1,234,567.89');
        await P.clickQ([kp, btn('9')]);
        await settle(300);
        expect(await amountBoxText(id, 1)).toBe('$1,234,567.89'); // the 10th digit must be dropped
        await P.clickQ([kp, btn('Done')]);
      },
    );
  });

  /* ========================= SPLIT-H By Items ========================= */

  describe('SPLIT-H By Items', () => {
    /**
     * Pamela: test service (Express Pedicure $30 base) + Quick Pay $20 + Quick Pay $30 ($80 base).
     * With fee/tax on, a check's amount (Card price) = Σ Card price of its items (itemsCard).
     */
    let itemsCard: (items: ('svc' | 20 | 30)[]) => number = () => Number.NaN;
    let itemsTotal = Number.NaN;

    async function itemsOrder(): Promise<string> {
      const { m, base } = await prices();
      const b = base[vqEnv.testService] ?? Number.NaN;
      // VERIFY: a By Items check = Σ Card price of its items (fee + tax allocated per item, ≤ 1¢ rounding).
      itemsCard = (items) =>
        cardTotalOf(
          m,
          items.map((i) => (i === 'svc' ? b : i)),
        );
      const id = await app.createOrder();
      await S.addQuickPay({ cents: 2000, name: 'QP Items 20' });
      await S.addQuickPay({ cents: 3000, name: 'QP Items 30' });
      itemsTotal = (await app.orderTotals()).total;
      await S.openSplit();
      await clickOrJs(S.modeButton('By Items'));
      await settle(600);
      return id;
    }

    /** Check 1 only Express Pedicure, Check 2 both Quick Pay lines (each step keeps ≥ 1 item per check). */
    async function arrange(id: string): Promise<void> {
      if (!(await rowLabelCount(id, 1, vqEnv.testService))) {
        if ((await rowLabelCount(id, 2)) <= 1) {
          const qp = (await rowLabelCount(id, 1, 'QP Items 20')) ? 'QP Items 20' : 'QP Items 30';
          await moveItem(id, 1, qp, 2);
        }
        await moveItem(id, 2, vqEnv.testService, 1);
      }
      for (const name of ['QP Items 20', 'QP Items 30'])
        if (await rowLabelCount(id, 1, name)) await moveItem(id, 1, name, 2);
      expect(
        await P.poll(
          () => rowLabelCount(id, 1),
          (n) => n === 1,
          5_000,
        ),
      ).toBe(1);
      expect(
        await P.poll(
          () => rowLabelCount(id, 2),
          (n) => n === 2,
          5_000,
        ),
      ).toBe(2);
    }

    it(
      title(
        'SPLIT-H1 By Items hint box (close button aria-label "actions.close"); Check 1 only Express Pedicure → $30 / $50, Pay enabled (SPLIT-030, SPLIT-033)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const id = await itemsOrder();
        expect(await appears(inMain({ textRe: 'How to Split Payment by Item\\?', nth: 0 }), 5_000)).toBe(
          true,
        );
        expect(
          await P.has(
            inMain(textQ('Select one or more items, then drag or click to move them to another check.')),
          ),
        ).toBe(true);
        // i18n bug still on develop: missing key actions.close → aria-label shows the raw key.
        expect(await P.has(inMain(btn('actions.close')))).toBe(true);

        await arrange(id);
        expect(await S.checkAmount(id, 1)).toBeCloseTo(itemsCard(['svc']), 1);
        expect(await S.checkAmount(id, 2)).toBeCloseTo(itemsCard([20, 30]), 1);
        expect(sum(await S.checkAmounts(id))).toBeCloseTo(itemsTotal, 2);
        await S.selectCheck(id, 1);
        await clickOrJs(S.methodButton('Other'));
        await settle(300);
        expect(await P.isDisabled(S.payButton)).toBe(false);
      },
    );

    it(
      title(
        'SPLIT-H2 Moving the only item of Check 1 → toast "Each check must keep at least one item.", item stays (SPLIT-031)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const id = await itemsOrder();
        await arrange(id);
        await moveItem(id, 1, vqEnv.testService, 2);
        expect(await appears(textQ('Each check must keep at least one item.'), 5_000)).toBe(true);
        expect(await rowLabelCount(id, 1, vqEnv.testService)).toBe(1);
      },
    );

    // DEV: TC SPLIT-032 (new check "No Item", Pay disabled) no longer holds — develop pre-fills the new check with one spare
    // item from the first unpaid check with > 1 item; Add New Check is enabled only while items > checks. No covers.
    it(
      title(
        'SPLIT-H3 By Items Add New Check (DEV): new check gets 1 item, no empty check, sum = Total; no spare item → Add New Check disabled',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const id = await itemsOrder();
        await arrange(id);
        await P.clickQ(addCheckButton);
        await P.waitFor(selectCheckButton(id, 3), 5_000, 'Check 3');
        expect(
          await P.poll(
            () => rowLabelCount(id, 3),
            (n) => n === 1,
            5_000,
          ),
        ).toBe(1);
        expect(await S.checkRowText(id, 3)).not.toContain('No Item');
        for (const n of [1, 2]) expect(await rowLabelCount(id, n)).toBe(1);
        expect(sum(await S.checkAmounts(id))).toBeCloseTo(itemsTotal, 2);
        expect(await P.isDisabled(addCheckButton)).toBe(true); // 3 items / 3 checks → no spare item
        await S.selectCheck(id, 3);
        await clickOrJs(S.methodButton('Other'));
        await settle(300);
        expect(await P.isDisabled(S.payButton)).toBe(false);
      },
    );

    it(
      title(
        'SPLIT-H4 Drag Quick Pay $20 to Check 1 → $50 / $30; select-then-tap moves back and forth; Collapse hides items, Expand shows them (SPLIT-034)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const id = await itemsOrder();
        await arrange(id);
        // VERIFY: dnd-kit on WebView needs a multi-step mouse down/move/up drag.
        await dragItemToCheck(id, 2, 'QP Items 20', 1);
        const svc20 = itemsCard(['svc', 20]);
        const svc = itemsCard(['svc']);
        expect(await S.checkAmount(id, 1)).toBeCloseTo(svc20, 1);
        expect(await S.checkAmount(id, 2)).toBeCloseTo(itemsCard([30]), 1);

        // Select-then-tap: QP $20 back to Check 2, then again to Check 1 (Check 2 then only has QP $30, which cannot move).
        await moveItem(id, 1, 'QP Items 20', 2);
        expect(await S.checkAmount(id, 1)).toBeCloseTo(svc, 1);
        expect(await S.checkAmount(id, 2)).toBeCloseTo(itemsCard([20, 30]), 1);
        await moveItem(id, 2, 'QP Items 20', 1);
        expect(await S.checkAmount(id, 1)).toBeCloseTo(svc20, 1);
        expect(await S.checkAmount(id, 2)).toBeCloseTo(itemsCard([30]), 1);

        await clickRowButton(id, 1, 'Collapse');
        expect(
          await P.poll(
            () => rowLabelCount(id, 1),
            (n) => n === 0,
            5_000,
          ),
        ).toBe(0);
        await clickRowButton(id, 1, 'Expand');
        expect(
          await P.poll(
            () => rowLabelCount(id, 1),
            (n) => n > 0,
            5_000,
          ),
        ).toBeGreaterThan(0);
      },
    );
  });

  /* ======================= SPLIT-I paying checks ======================= */

  describe('SPLIT-I paying each check', () => {
    it(
      title(
        'SPLIT-I1 Cash short → Complete Check 1 disabled; type $20 then close X → check unpaid, reopening does not keep $20 (SPLIT-037, SPLIT-038)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = await app.createOrder();
        await S.openSplit();
        await S.selectCheck(id, 1);
        await clickOrJs(S.methodButton('Cash'));
        await settle(300);
        await clickOrJs(S.payButton);
        await app.passcodeIfAsked(3_000);
        const dlg = S.cashDialog(1);
        await P.waitFor(dlg, 8_000, 'Cash dialog');
        await S.dialogKeys(dlg, ['C', '1', '0', '0', '0']);
        expect(await P.isDisabled([dlg, btn('Complete Check 1')])).toBe(true);
        await S.dialogKeys(dlg, ['C', '2', '0', '0', '0']);
        expect(await appears([dlg, textQ('$20.00')], 3_000)).toBe(true);
        await P.clickQ([dlg, btn('Close', 0)]);
        await P.waitGoneQ(dlg, 5_000, 'Cash dialog');
        expect(await S.isCheckPaid(id, 1)).toBe(false);
        await clickOrJs(S.payButton);
        await app.passcodeIfAsked(3_000);
        await P.waitFor(dlg, 8_000, 'Cash dialog');
        expect(await P.count([dlg, { textRe: '\\$20\\.00' }])).toBe(0); // dialog must not keep the typed $20.00
        await P.clickQ([dlg, btn('Close', 0)]);
      },
    );

    it(
      title(
        'SPLIT-I2 $100 3 checks: pay Check 1 Cash → locked (Paid with Cash, no delete, split modes disabled); Continue Payment counts remaining checks (SPLIT-045, SPLIT-046, SPLIT-062, SPLIT-064)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(6 * 60_000);
        const { id, T, m } = await S.cardTotalOrder(10000);
        await S.openSplit();
        await withSettle(id, async () => {
          await P.clickQ(addCheckButton);
          await settle(300);
          // Checks follow T (Card price); Total Paid = Cash/Other price.
          const sl = S.evenSplit(T, 3);
          const [s0 = 0, s1 = 0, s2 = 0] = sl;
          // Cash price of check 1 read on "Pay $x" (≈ check / (1 + fee), ≤ 2¢ reconcile).
          const cash1 = await S.methodPrice(id, 1, 'Cash');
          expect(cash1).toBeCloseTo(S.nonCardShare(m, s0), 1);
          const t1 = await S.payCheck(id, 1, 'Cash', { next: 'none' });
          expect(t1).toContain(`2 checks remaining - total $${(s1 + s2).toFixed(2)}`);
          await S.closePaidDialog(1);
          expect((await S.paidRemaining()).totalPaid).toBeCloseTo(cash1, 2);

          await step('SPLIT-045: Check 1 locked, shows Paid with Cash', async () => {
            expect(await S.checkRowText(id, 1)).toContain('Paid with Cash');
            expect(await P.count(selectCheckButton(id, 1))).toBe(0);
            await clickCheckRow(id, 1);
            await clickOrJs(S.methodButton('Other'));
            await settle(300);
            expect(await S.checkRowText(id, 1)).toContain('Paid with Cash');
          });
          await step('SPLIT-064: no delete icon on a paid check', async () => {
            expect(await P.count(deleteCheckButton(id, 1))).toBe(0);
          });
          await step('SPLIT-062: the 3 split-mode buttons are disabled', async () => {
            for (const md of ['Equally', 'By Amount', 'By Items'] as const)
              expect(await P.isDisabled(S.modeButton(md))).toBe(true);
            expect(await S.isModeActive('Equally')).toBe(true);
          });

          const other2 = await S.methodPrice(id, 2, 'Other');
          expect(other2).toBeCloseTo(S.nonCardShare(m, s1), 1);
          const t2 = await S.payCheck(id, 2, 'Other', { next: 'none' });
          expect(t2).toContain(`1 check remaining - total $${s2.toFixed(2)}`);
          await S.closePaidDialog(2);
          expect((await S.paidRemaining()).totalPaid).toBeCloseTo(cash1 + other2, 2);
        });
      },
    );

    // DEV: TC SPLIT-092 (per-check receipt with money summary + QR) does not apply — develop omits the per-check money
    // breakdown/QR (VP-2050). Dropped SPLIT-092 from covers.
    it(
      title(
        'SPLIT-I3 Split Cash + Other completed: Order History Successful, #<code>-1/-2 with View receipt; per-check receipt (SPLIT-040)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(6 * 60_000);
        const id = await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
        await S.openSplit();
        await withSettle(id, async () => {
          await S.payCheck(id, 1, 'Cash');
          await S.payCheck(id, 2, 'Other', { otherName: 'Zelle E2E' });
          await S.completeDone();
          await app.noReceipt();
        });

        await app.openHistoryOrder(id);
        const d = await app.historyDetail(id);
        expect(field(d, 'Status')).toMatch(/Successful/);
        expect(d).toContain(`#${id}-1`);
        expect(d).toContain(`#${id}-2`);
        expect(d).toMatch(/Cash/);
        expect(d).toMatch(/Other/);
        expect(await appears(inMain(btn('View receipt for check 1')), 5_000)).toBe(true);
        expect(await P.has(inMain(btn('View receipt for check 2')))).toBe(true);

        await step('Receipt of check 1 (DEV: no money summary/QR)', async () => {
          await P.clickQ(inMain(btn('View receipt for check 1')));
          const rc = { role: 'dialog', hasText: `Receipt #${id}-1`, nth: -1 } as const;
          await P.waitFor(rc, 8_000, `Receipt #${id}-1`);
          const t = ((await P.rawText(rc)) ?? '').replace(/\s*\n+\s*/g, ' | ');
          expect(t).toContain(`#${id}-1`);
          expect(t).toMatch(/Paid with: \| Cash \| \$[\d,.]+/);
          expect(t).toMatch(/Got: \$[\d,.]+ \(Change: \$[\d,.]+ - Tip: \$[\d,.]+\)/);
          obs(`Receipt check 1: ${t}`);
          await P.clickQ([rc, btn('Close', 0)], 3_000).catch(() => P.escape());
          await P.waitGoneQ(rc, 5_000, 'receipt dialog');
        });
      },
    );

    it(
      title(
        'SPLIT-I4 Skip passcode 30 min: double click Pay in Other Payment creates 1 transaction; Check 2 asks no passcode (SPLIT-047, SPLIT-050)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        if (!vqEnv.staffCode) {
          console.warn('Needs VOLT_STAFF_CODE');
          this.skip();
        }
        this.timeout(6 * 60_000);
        const m = await priceModel(); // measure before opening the order
        await app.clearPasscodeSkip();
        const id = await app.createOrder();
        await S.openSplit();
        openSplit = id;
        try {
          const c1 = await S.checkAmount(id, 1);
          await S.selectCheck(id, 1);
          await clickOrJs(S.methodButton('Other'));
          await settle(300);
          const other1 = money(await P.textOf(S.payButton)); // Other price of check 1
          await clickOrJs(S.payButton);
          await typeCode(vqEnv.staffCode, { skip30: true });
          const other = S.otherDialog;
          await P.waitFor(other, 8_000, 'Other Payment');
          await dblClickOtherPay();
          await S.drivePaid(1, 'Other', { skipPasscode: true });
          await S.closePaidDialog(1);
          await settle(1_500);
          // c1 = check amount (Card price); Other price ≈ c1 / (1 + fee) (≤ 2¢ reconcile).
          expect(other1).toBeCloseTo(S.nonCardShare(m, c1), 1);
          expect((await S.paidRemaining()).totalPaid).toBeCloseTo(other1, 2); // Total Paid rises once only

          await S.selectCheck(id, 2);
          await clickOrJs(S.methodButton('Other'));
          await settle(300);
          await clickOrJs(S.payButton);
          await P.waitFor(other, 8_000, 'Other Payment');
          expect(await P.count(VqcCommon.passcodeDialog)).toBe(0); // within the 30-min skip no passcode is asked
          await P.clickQ([other, { role: 'button', nameRe: '^Pay\\s*\\$', nth: 0 }]);
          await S.drivePaid(2, 'Other', { skipPasscode: true });
          await S.closePaidDialog(2);
        } finally {
          await app.clearPasscodeSkip();
          await S.settleSplit(id);
          openSplit = '';
        }
      },
    );
  });

  /* ===================== SPLIT-J passcode on paying ===================== */

  describe('SPLIT-J passcode when paying a check', () => {
    beforeEach(async () => {
      await app.clearPasscodeSkip().catch(() => undefined);
    });

    it(
      title(
        'SPLIT-J1 Pay check with a wrong code → error, check unpaid (SPLIT-048)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = await app.createOrder();
        await S.openSplit();
        await S.selectCheck(id, 1);
        await clickOrJs(S.methodButton('Other'));
        await settle(300);
        await clickOrJs(S.payButton);
        // '0000' is a real staff code on merchant 14 → use a code nobody owns (unknownCode).
        const r = await typeCode(unknownCode());
        expect(r.open).toBe(true);
        expect(r.text).toMatch(/Invalid staff code|Failed to verify staff code/);
        await closePasscode();
        expect(await S.isCheckPaid(id, 1)).toBe(false);
        expect(await P.count(S.otherDialog)).toBe(0);
      },
    );

    it(
      title(
        'SPLIT-J2 Role lacking Completed Payment → "You don\'t have permission for this action" (SPLIT-049)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const role = await roleWithout('Completed Payment');
        if (!role) {
          console.warn(
            'Every role with a staff code in .env has Completed Payment (or Permissions unreadable)',
          );
          this.skip();
        }
        const id = await app.createOrder();
        await S.openSplit();
        await S.selectCheck(id, 1);
        await clickOrJs(S.methodButton('Other'));
        await settle(300);
        await clickOrJs(S.payButton);
        const r = await typeCode(role.code);
        expect(r.text).toContain("You don't have permission for this action");
        await closePasscode();
        expect(await S.isCheckPaid(id, 1)).toBe(false);
      },
    );

    it(
      title(
        'SPLIT-J3 Cash check → Cash Drawer asks "Enter staff code to open cash drawer"; no drawer → "Open cash drawer failed" (SPLIT-051)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        if (!vqEnv.staffCode) {
          console.warn('Needs VOLT_STAFF_CODE');
          this.skip();
        }
        this.timeout(4 * 60_000);
        const id = await app.createOrder();
        await S.openSplit();
        await S.selectCheck(id, 1);
        await clickOrJs(S.methodButton('Cash'));
        await settle(300);
        // VERIFY: shouldShowCashDrawer(checks) — the button only shows while the selected check is Cash.
        await P.clickQ(cashDrawerButton);
        const pass = VqcCommon.passcodeDialog;
        const toast = textQ('Open cash drawer failed');
        // The "open_cash_drawer" gate (Passcode Setting › Others) is OFF on merchant 14 → no code asked, drawer opens directly.
        const asked = await appears(pass, 5_000);
        if (asked) {
          expect(await P.textOf([pass, { role: 'heading', nth: 0 }])).toBe(
            'Enter staff code to open cash drawer',
          );
          await app.enterPasscode(vqEnv.staffCode);
        }
        const failed = await appears(toast, 8_000);
        obs(
          `Cash Drawer: ${asked ? 'asked passcode' : 'NO passcode (open_cash_drawer gate off)'}; error toast: ${String(failed)}`,
        );
        if (!asked) {
          console.warn(
            'Passcode gate open_cash_drawer (merchant Passcode Setting, Others) is off → no "Enter staff code to open cash drawer" dialog to check (TC precondition: gate on)',
          );
          this.skip();
        }
        obs(
          failed
            ? 'Toast "Open cash drawer failed" (no drawer)'
            : 'No error toast — machine may have a real drawer',
        );
        expect(failed || hasHardware).toBe(true); // no drawer → must report "Open cash drawer failed"
      },
    );
  });
});
