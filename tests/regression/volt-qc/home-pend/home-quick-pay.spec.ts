/**
 * volt-qc port — 02 HOME: Quick Pay (WRITE cases).
 *
 * Source: volt-qc `e2e/tests/02-home/home-plan-items.spec.ts` (HOME-QP1…QP9) and
 * `e2e/tests/17-added/home-pay-oh-added.spec.ts` (HOME-AD1…AD6, VP-1434).
 * TC catalogue: docs/qc/volt-qc/windows-regression/02-home-tao-order.md.
 *
 * Every case builds its own draft and {@link cleanupOrders} deletes it afterwards.
 *
 * Adaptations vs the source:
 * - The source compares line prices against a price model of its merchant
 *   (`core/price.ts`: Service Fee + Tax). Here the amount typed into Quick Pay
 *   is the BASE price; assertions use what does not depend on the merchant's fee
 *   setup — the field mask, the discount text (computed on the base), and the
 *   identity Total = Subtotal + Item Discount + Tax.
 * - The staff is the first one the grid renders, not volt-qc's "Pamela".
 */

import { expect } from '@wdio/globals';
import { VqcHome } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqhDialog, VqhEditor, VqhOrder } from '../../../../src/constants/testids.voltqc-home-pend.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  cleanupOrders,
  closeEditor,
  closeStrayDialogs,
  createOrder,
  currentOrderId,
  discover,
  editorAmount,
  openLine,
  openQuickPay,
  orderLines,
  payEnabled,
  qp,
  quickPay,
  radioPressed,
  setDiscount,
  summary,
  switchOn,
} from '../../../../src/pages/voltqc/home-pend/homePendProbe.js';
import { quickCheckout } from '../../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

let staff = '';

const totalIdentity = async (): Promise<void> => {
  const s = await summary();
  expect(s.subtotal).not.toBeNull();
  expect(s.total).not.toBeNull();
  expect(s.total ?? NaN).toBeCloseTo((s.subtotal ?? 0) + (s.itemDiscount ?? 0) + (s.tax ?? 0), 1);
};

describe('volt-qc 02 HOME — Quick Pay (write)', () => {
  before(async function () {
    await returnToHome();
    const d = await discover();
    staff = d.staff[0] ?? '';
  });

  beforeEach(function () {
    // Needs at least one staff on the grid to put a Quick Pay line on.
    if (!staff) this.skip();
  });

  afterEach(async () => {
    await closeStrayDialogs().catch(() => undefined);
    await cleanupOrders();
  });

  it(
    title(
      'No staff selected: the Quick Pay tile raises "Select Staff First" and creates no order (HOME-048)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await quickCheckout();
      await P.clickQ(VqcHome.quickPayTile);
      await P.waitFor(VqhOrder.selectStaffFirst, 8_000, '"Select Staff First"');
      expect(await P.has([VqhOrder.selectStaffFirst, { text: VqhOrder.selectStaffFirstText }])).toBe(true);
      expect(await P.count(VqhDialog.quickPay)).toBe(0);
      await P.clickQ([VqhOrder.selectStaffFirst, { role: 'button', name: 'Done', nth: 0 }]);
      await P.waitGoneQ(VqhOrder.selectStaffFirst, 5_000);
      expect(await currentOrderId()).toBe('');
    },
  );

  it(
    title(
      'Quick Pay dialog fields; $25.00 "Custom nail art" + note adds a line that is not a catalogue service (HOME-049, HOME-050)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await openQuickPay();
      expect(await P.has(qp({ text: 'Custom Amount' }))).toBe(true);
      for (const q of [
        VqhEditor.amount,
        VqhEditor.serviceName,
        VqhEditor.note,
        VqhEditor.switch,
        VqhEditor.add,
        VqhEditor.close,
      ]) {
        expect(await P.has(qp(q))).toBe(true);
      }
      expect(await P.has(qp({ text: '0/80' }))).toBe(true);
      expect(await P.has(qp({ text: 'Apply Discount' }))).toBe(true);

      await P.fillQ(qp(VqhEditor.amount), '2500');
      expect(await P.inputValue(qp(VqhEditor.amount))).toBe('$25.00');
      await P.fillQ(qp(VqhEditor.serviceName), 'Custom nail art');
      await P.fillQ(qp(VqhEditor.note), 'French tip');
      await P.clickQ(qp(VqhEditor.add));
      await P.waitGoneQ(VqhDialog.quickPay, 10_000);

      const line = await P.poll(
        async () => (await orderLines()).find((l) => l.name === 'Custom nail art'),
        (l) => !!l,
        10_000,
      );
      expect(line?.note).toBe('French tip');
      // The line shows the base + any service fee: never below the typed $25.00.
      expect(line?.price ?? 0).toBeGreaterThanOrEqual(25 - 0.001);
      await P.fillQ(VqcHome.serviceSearch, 'Custom nail art');
      await P.waitFor(VqcHome.noServices, 10_000, '"No services available."');
      await P.fillQ(VqcHome.serviceSearch, '');
    },
  );

  it(
    title(
      'Empty / blank Service Name → "Unknown Service 1", "Unknown Service 2" (HOME-051)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await quickPay({ cents: 1000 });
      await quickPay({ cents: 1500, name: '   ' });
      const names = (await P.poll(orderLines, (l) => l.length >= 2, 10_000)).map((l) => l.name);
      expect(names).toEqual(['Unknown Service 1', 'Unknown Service 2']);
    },
  );

  it(
    title(
      'Quick Pay $0.00 "Free gift": a $0.00 line, Total unchanged, Pay still enabled (HOME-052)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await quickPay({ cents: 1000, name: 'QP base' });
      const before = (await summary()).total ?? NaN;
      await quickPay({ cents: 0, name: 'Free gift' });
      const gift = await P.poll(
        async () => (await orderLines()).find((l) => l.name === 'Free gift'),
        (l) => !!l,
        10_000,
      );
      expect(gift?.priceText).toBe('$0.00');
      expect((await summary()).total ?? NaN).toBeCloseTo(before, 2);
      expect(await payEnabled()).toBe(true);
    },
  );

  it(
    title(
      'Limits: amount stops at $10,000.00; Service Name keeps 50 chars; note keeps 80 (80/80) (HOME-053, HOME-054, HOME-055)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await openQuickPay();
      await P.fillQ(qp(VqhEditor.amount), '1000001');
      expect(await P.inputValue(qp(VqhEditor.amount))).toBe('$10,000.00');
      await P.fillQ(qp(VqhEditor.serviceName), 'A'.repeat(51));
      expect(await P.inputValue(qp(VqhEditor.serviceName))).toBe('A'.repeat(50));
      await P.fillQ(qp(VqhEditor.note), 'N'.repeat(81));
      expect(await P.inputValue(qp(VqhEditor.note))).toBe('N'.repeat(80));
      expect(await P.has(qp({ text: '80/80' }))).toBe(true);
      await P.clickQ(qp(VqhEditor.add));
      await P.waitGoneQ(VqhDialog.quickPay, 10_000);
      const line = (await P.poll(orderLines, (l) => l.length > 0, 10_000))[0];
      expect(line?.name).toBe('A'.repeat(50));
      expect(line?.price ?? 0).toBeGreaterThanOrEqual(10_000 - 0.001);
    },
  );

  it(
    title(
      'Typing a Quick Pay then Close adds no line and keeps the Total (HOME-057)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await quickPay({ cents: 1000, name: 'QP keep' });
      const before = (await summary()).total ?? NaN;
      await openQuickPay();
      await P.fillQ(qp(VqhEditor.amount), '3000');
      await P.fillQ(qp(VqhEditor.serviceName), 'QP closed');
      await P.clickQ(qp(VqhEditor.close));
      await P.waitGoneQ(VqhDialog.quickPay, 5_000);
      const lines = await orderLines();
      expect(lines.map((l) => l.name)).toEqual(['QP keep']);
      expect((await summary()).total ?? NaN).toBeCloseTo(before, 2);
    },
  );

  it(
    title(
      'Click a Quick Pay line: dialog pre-filled, Update disabled until changed; $25 → $30 raises the Total (HOME-058)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await quickPay({ cents: 2500, name: 'Custom nail art', note: 'French tip' });
      const before = (await summary()).total ?? NaN;
      await openLine('Custom nail art');
      expect(await editorAmount()).toBe('$25.00');
      expect(await P.inputValue(qp(VqhEditor.serviceName))).toBe('Custom nail art');
      expect(await P.inputValue(qp(VqhEditor.note))).toBe('French tip');
      expect(await P.isDisabled(qp(VqhEditor.update))).toBe(true);
      await P.fillQ(qp(VqhEditor.amount), '3000');
      expect(await P.isDisabled(qp(VqhEditor.update))).toBe(false);
      await P.clickQ(qp(VqhEditor.update));
      await P.waitGoneQ(VqhDialog.quickPay, 10_000);
      const after = await P.poll(
        async () => (await summary()).total ?? NaN,
        (t) => t > before,
        10_000,
      );
      expect(after).toBeGreaterThan(before);
      expect(after - before).toBeGreaterThanOrEqual(5 - 0.01);
    },
  );

  it(
    title(
      'Quick Pay $40 + Apply Discount 25% → "25% OFF -$10.00", Item Discount -$10.00 (HOME-059)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await quickPay({ cents: 4000, name: 'QP disc', discount: { kind: '%', typed: '25' } });
      const line = await P.poll(
        async () => (await orderLines()).find((l) => l.name === 'QP disc'),
        (l) => !!l?.discount,
        10_000,
      );
      expect(line?.discount).toBe('25% OFF -$10.00');
      const s = await P.poll(summary, (x) => x.itemDiscount !== null, 10_000);
      expect(s.itemDiscount ?? NaN).toBeCloseTo(-10, 2);
      await totalIdentity();
    },
  );

  it(
    title(
      '$ discount cannot exceed the amount ($20.00); a 0 discount errors and Add adds nothing (HOME-060)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await openQuickPay();
      await P.fillQ(qp(VqhEditor.amount), '2000');
      await setDiscount('$', '2500');
      expect(await P.inputValue(qp(VqhEditor.discount))).toBe('$20.00');
      await P.fillQ(qp(VqhEditor.discount), '0');
      await P.waitFor(qp({ text: VqhEditor.zeroDiscountError }), 5_000, 'zero-discount error');
      await P.clickQ(qp(VqhEditor.add));
      expect(await P.has(VqhDialog.quickPay)).toBe(true);
      await closeEditor();
      expect(await orderLines()).toHaveLength(0);
    },
  );

  it(
    title(
      'Apply Discount off: label + switch only; on: 0 field and %/$ with % default; Close adds nothing (HOME-178)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await openQuickPay();
      await P.fillQ(qp(VqhEditor.amount), '2000');
      expect(await P.has(qp({ text: 'Apply Discount' }))).toBe(true);
      expect(await switchOn()).toBe(false);
      expect(await P.count(qp(VqhEditor.radio('%')))).toBe(0);
      expect(await P.count(qp(VqhEditor.radio('$')))).toBe(0);
      await P.clickQ(qp(VqhEditor.switch));
      expect(await switchOn()).toBe(true);
      expect(await P.has(qp(VqhEditor.radio('%')))).toBe(true);
      expect(await P.has(qp(VqhEditor.radio('$')))).toBe(true);
      expect(await radioPressed('%')).toBe(true);
      expect(await P.inputValue(qp(VqhEditor.discount))).toMatch(/^0?$/);
      await closeEditor();
      expect(await orderLines()).toHaveLength(0);
    },
  );

  it(
    title(
      'Quick Pay $20 − $5: line "$5.00 OFF -$5.00", Item Discount -$5.00, Total = Subtotal − discount + Tax (HOME-179)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await openQuickPay();
      await P.fillQ(qp(VqhEditor.amount), '2000');
      await P.fillQ(qp(VqhEditor.serviceName), 'QP fixed');
      await setDiscount('$', '500');
      expect(await P.inputValue(qp(VqhEditor.discount))).toBe('$5.00');
      await P.clickQ(qp(VqhEditor.add));
      await P.waitGoneQ(VqhDialog.quickPay, 10_000);
      const line = await P.poll(
        async () => (await orderLines()).find((l) => l.name === 'QP fixed'),
        (l) => !!l?.discount,
        10_000,
      );
      expect(line?.discount).toBe('$5.00 OFF -$5.00');
      const s = await P.poll(summary, (x) => x.itemDiscount !== null, 10_000);
      expect(s.itemDiscount ?? NaN).toBeCloseTo(-5, 2);
      expect(s.subtotal ?? 0).toBeGreaterThanOrEqual(20 - 0.001);
      await totalIdentity();
    },
  );

  it(
    title(
      'Discount switched on then off before Add: field hidden, line keeps full price, no Item Discount (HOME-180)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await openQuickPay();
      await P.fillQ(qp(VqhEditor.amount), '2000');
      await P.fillQ(qp(VqhEditor.serviceName), 'QP no disc');
      await setDiscount('%', '10');
      await P.clickQ(qp(VqhEditor.switch));
      expect(await P.count(qp(VqhEditor.radio('%')))).toBe(0);
      await P.clickQ(qp(VqhEditor.add));
      await P.waitGoneQ(VqhDialog.quickPay, 10_000);
      const line = await P.poll(
        async () => (await orderLines()).find((l) => l.name === 'QP no disc'),
        (l) => !!l,
        10_000,
      );
      expect(line?.discount).toBe('');
      expect(line?.price ?? 0).toBeGreaterThanOrEqual(20 - 0.001);
      const s = await P.poll(summary, (x) => (x.total ?? 0) > 0, 10_000);
      expect(s.itemDiscount).toBeNull();
      await totalIdentity();
    },
  );

  it(
    title(
      'Quick Pay 100% off: "100% OFF -$20.00", Item Discount -$20.00, Total $0.00, Pay still enabled (HOME-181)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await quickPay({ cents: 2000, name: 'QP 100', discount: { kind: '%', typed: '100' } });
      const line = await P.poll(
        async () => (await orderLines()).find((l) => l.name === 'QP 100'),
        (l) => !!l?.discount,
        10_000,
      );
      expect(line?.discount).toBe('100% OFF -$20.00');
      const s = await P.poll(summary, (x) => x.itemDiscount !== null, 10_000);
      expect(s.itemDiscount ?? NaN).toBeCloseTo(-20, 2);
      expect(s.total ?? NaN).toBeCloseTo(0, 2);
      expect(await payEnabled()).toBe(true);
    },
  );

  it(
    title(
      '$ discount above the amount clamps to $400.00; switching to % resets to 0 and 1-5-0 stops at 100 (HOME-182)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await openQuickPay();
      await P.fillQ(qp(VqhEditor.amount), '40000');
      await setDiscount('$', '50000');
      expect(await P.inputValue(qp(VqhEditor.discount))).toBe('$400.00');
      await P.clickQ(qp(VqhEditor.radio('%')));
      expect(await P.inputValue(qp(VqhEditor.discount))).toMatch(/^0?$/);
      await P.typeQ(qp(VqhEditor.discount), '15');
      expect(await P.inputValue(qp(VqhEditor.discount))).toBe('15');
      await P.typeQ(qp(VqhEditor.discount), '0');
      expect(await P.inputValue(qp(VqhEditor.discount))).toBe('100');
      await closeEditor();
      expect(await orderLines()).toHaveLength(0);
    },
  );

  it(
    title(
      'Reset amount (x): hidden at $0.00, shown with an amount; one press → 0.00, keeps name/note/discount, dialog stays (HOME-183)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff);
      await openQuickPay();
      expect(await P.count(qp(VqhEditor.reset))).toBe(0);
      await P.fillQ(qp(VqhEditor.amount), '2000');
      expect(await P.has(qp(VqhEditor.reset))).toBe(true);
      await P.fillQ(qp(VqhEditor.serviceName), 'Test');
      await P.fillQ(qp(VqhEditor.note), 'abc');
      await setDiscount('%', '10');
      await step('one press of Reset amount', async () => {
        await P.clickQ(qp(VqhEditor.reset));
      });
      expect(await P.inputValue(qp(VqhEditor.amount))).toMatch(/^(\$?0\.00)?$/);
      expect(await P.count(qp(VqhEditor.reset))).toBe(0);
      expect(await P.inputValue(qp(VqhEditor.serviceName))).toBe('Test');
      expect(await P.inputValue(qp(VqhEditor.note))).toBe('abc');
      expect(await P.has(qp({ text: '3/80' }))).toBe(true);
      expect(await switchOn()).toBe(true);
      expect(await P.inputValue(qp(VqhEditor.discount))).toBe('10');
      expect(await P.has(VqhDialog.quickPay)).toBe(true);
      await closeEditor();
      expect(await orderLines()).toHaveLength(0);
    },
  );
});
