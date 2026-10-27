/**
 * volt-qc port — 02 HOME: service tiles and the line editor (WRITE cases).
 *
 * Source: volt-qc `e2e/tests/02-home/order.spec.ts` (HOME-A), `home-plan-items.spec.ts`
 * (HOME-L1…L7, HOME-L2a…L2f, HOME-GC1). TC catalogue:
 * docs/qc/volt-qc/windows-regression/02-home-tao-order.md.
 *
 * Adaptations vs the source:
 * - The service is the first PRICED tile the till renders (volt-qc pinned
 *   "Express Pedicure $30.00"). Its catalogue price is read off the line editor
 *   (the editor's amount is the BASE price; the line adds any service fee).
 * - Discount texts are computed from that base price, so "10% OFF -$3.00" becomes
 *   "10% OFF -<10% of base>".
 * - Customer-display assertions are dropped (the attach lane cannot drive the
 *   second window); the POS-side expectation of each TC is kept.
 */

import { expect } from '@wdio/globals';
import { VqcGiftCard, VqcHome, btn } from '../../../../src/constants/testids.voltqc-pos.js';
import {
  VqhDialog,
  VqhEditor,
  VqhOrder,
  VqhSidebar,
} from '../../../../src/constants/testids.voltqc-home-pend.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  addService,
  backToHome,
  cleanupOrders,
  closeEditor,
  closeStrayDialogs,
  created,
  createOrder,
  currentOrderId,
  discover,
  ed,
  editItem,
  editorAmount,
  enteredAmount,
  fmt,
  money,
  openLine,
  openPendingOrder,
  openQuickPay,
  orderLines,
  payEnabled,
  pickStaff,
  pressPay,
  qp,
  r2,
  selectTender,
  setDiscount,
  setEditorAmount,
  sidebarCardText,
  sidebarHas,
  summary,
  tenderAmount,
} from '../../../../src/pages/voltqc/home-pend/homePendProbe.js';
import {
  categoryTiles,
  clickCategoryAt,
  quickCheckout,
  serviceTiles,
} from '../../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

let staff: string[] = [];
let svc = '';
let base = NaN;

/** Open the editor of the first line and read its base price. */
async function readBase(name: string): Promise<number> {
  await openLine(name);
  const v = money(await editorAmount());
  await closeEditor();
  return v;
}

describe('volt-qc 02 HOME — services & line editor (write)', () => {
  before(async () => {
    await returnToHome();
    const d = await discover();
    staff = d.staff;
    svc = d.services[0]?.name ?? '';
    base = d.services[0]?.price ?? NaN;
  });

  beforeEach(function () {
    // Needs a staff and a priced service tile on this till.
    if (staff.length === 0 || !svc) this.skip();
  });

  afterEach(async () => {
    await closeStrayDialogs().catch(() => undefined);
    await cleanupOrders();
  });

  it(
    title(
      'Quick Checkout opens an empty frame; a service with no staff is blocked by "Select Staff First" (HOME-041, PEND-035)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await returnToHome();
      await P.fillQ(VqhSidebar.search, '');
      const before = (await P.texts(VqhSidebar.cards)).length;
      await quickCheckout();
      expect(await currentOrderId()).toBe('');
      expect(await P.has(VqcHome.customerInput)).toBe(true);
      expect((await P.texts(VqhSidebar.cards)).length).toBeLessThanOrEqual(before);
      await P.clickQ(VqhOrder.serviceTile(svc));
      await P.waitFor(VqhOrder.selectStaffFirst, 8_000, '"Select Staff First"');
      expect(await P.has([VqhOrder.selectStaffFirst, { text: VqhOrder.selectStaffFirstText }])).toBe(true);
      await P.clickQ([VqhOrder.selectStaffFirst, btn('Done', 0)]);
      await P.waitGoneQ(VqhOrder.selectStaffFirst, 5_000);
      expect(await currentOrderId()).toBe('');
    },
  );

  it(
    title(
      'Pinned Quick Pay + Gift Card lead the tiles, then categories; the first category is pre-selected (HOME-035)',
      Tag.REGRESSION,
    ),
    async () => {
      await quickCheckout();
      const tiles = await categoryTiles();
      expect(tiles.slice(0, 2).map((t) => t.name)).toEqual(['Quick Pay', 'Gift Card']);
      expect(tiles.length).toBeGreaterThan(2);
      const sel = tiles.findIndex((t) => t.selected);
      expect(sel).toBe(2);
      for (const t of tiles.slice(2))
        expect(Number(/^(\d+)/.exec(t.sub)?.[1] ?? 0)).toBeGreaterThanOrEqual(1);
    },
  );

  it(
    title('A product picked with no staff lands in the "Store" group (HOME-042)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      await quickCheckout();
      const tiles = await categoryTiles();
      const idx = tiles.findIndex((t, i) => i >= 2 && /Products?$/.test(t.sub) && t.slide <= 0);
      // Needs a product category on page 1 of the carousel.
      if (idx < 0) this.skip();
      await clickCategoryAt(idx);
      const product = (await serviceTiles()).find((s) => s.name !== '');
      if (!product) this.skip();
      await P.clickQ(VqhOrder.serviceTile(product?.name ?? ''));
      const id = await P.poll(currentOrderId, (v) => v !== '', 10_000);
      if (id) created.add(id);
      expect(id).toMatch(/^OD\d{6}-\d+$/);
      expect(await P.count(VqhOrder.selectStaffFirst)).toBe(0);
      expect(await P.has([{ css: VqhOrder.groupCss }, { text: 'Store' }])).toBe(true);
    },
  );

  it(
    title(
      'Line editor: title, base price + Reset amount, note 0/80, Apply Discount, Save disabled, numeric inputmode; Close discards (HOME-063, HOME-069, HOME-076)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff[0] ?? '', [svc]);
      const linePrice = (await orderLines())[0]?.priceText ?? '';
      await openLine(svc);
      expect(await P.has(ed({ text: svc }))).toBe(true);
      expect(await editorAmount()).toBe(fmt(base));
      expect(await P.has(ed(VqhEditor.reset))).toBe(true);
      expect(await P.has(ed(VqhEditor.note))).toBe(true);
      expect(await P.has(ed({ text: '0/80' }))).toBe(true);
      expect(await P.has(ed({ text: 'Apply Discount' }))).toBe(true);
      expect(await P.isDisabled(ed(VqhEditor.save))).toBe(true);
      expect(await P.attrOf(ed(VqhEditor.amount), 'inputmode')).toMatch(/^(numeric|decimal)$/);

      await setEditorAmount('1500');
      await closeEditor();
      expect((await orderLines())[0]?.priceText).toBe(linePrice);
      await openLine(svc);
      expect(await editorAmount()).toBe(fmt(base));
      await closeEditor();

      await step('the Quick Pay amount field is numeric too', async () => {
        await openQuickPay();
        expect(await P.attrOf(qp(VqhEditor.amount), 'inputmode')).toMatch(/^(numeric|decimal)$/);
        await closeEditor();
      });
    },
  );

  it(
    title(
      'Reset amount → $33.00 → Save: the line and Subtotal update and survive switching orders (HOME-064)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      // Needs a second staff for the second order.
      if (staff.length < 2) this.skip();
      const a = await createOrder(staff[0] ?? '', [svc]);
      const before = await summary();
      const oldLine = (await orderLines())[0]?.price ?? NaN;
      await openLine(svc);
      await P.clickQ(ed(VqhEditor.reset));
      expect(await editorAmount()).toMatch(/\$?0\.00/);
      await P.fillQ(ed(VqhEditor.amount), '3300');
      await P.clickQ(ed(VqhEditor.save));
      await P.waitGoneQ(VqhDialog.editor, 10_000);
      const newLine = await P.poll(
        async () => (await orderLines())[0]?.price ?? NaN,
        (p) => p !== oldLine,
        10_000,
      );
      expect(newLine).toBeGreaterThanOrEqual(33 - 0.001);
      expect((await summary()).subtotal ?? NaN).toBeCloseTo((before.subtotal ?? 0) + newLine - oldLine, 2);

      await createOrder(staff[1] ?? '');
      await openPendingOrder(a);
      expect((await orderLines())[0]?.price ?? NaN).toBeCloseTo(newLine, 2);
      expect(await readBase(svc)).toBeCloseTo(33, 2);
    },
  );

  it(
    title(
      'Line price $0 (Reset amount then Save): a $0.00 line, Pay still enabled (HOME-065)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff[0] ?? '', [svc]);
      await openLine(svc);
      await P.clickQ(ed(VqhEditor.reset));
      await P.clickQ(ed(VqhEditor.save));
      await P.waitGoneQ(VqhDialog.editor, 10_000);
      const p = await P.poll(
        async () => (await orderLines())[0]?.priceText ?? '',
        (t) => t === '$0.00',
        10_000,
      );
      expect(p).toBe('$0.00');
      expect(await payEnabled()).toBe(true);
    },
  );

  it(
    title('Line price stops at $10,000.00 and drops a "-" sign (HOME-066)', Tag.REGRESSION, Tag.WRITE),
    async () => {
      await createOrder(staff[0] ?? '', [svc]);
      await openLine(svc);
      await setEditorAmount('1000001');
      expect(await editorAmount()).toBe('$10,000.00');
      await setEditorAmount('-500');
      expect(await editorAmount()).toBe('$5.00');
      expect(await editorAmount()).not.toContain('-');
      await closeEditor();
    },
  );

  it(
    title(
      'Line note: 50 chars saves and shows under the name; 81 chars keeps 80 or errors (HOME-067, HOME-068)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff[0] ?? '', [svc]);
      await openLine(svc);
      await P.fillQ(ed(VqhEditor.note), 'x'.repeat(50));
      expect(await P.has(ed({ text: '50/80' }))).toBe(true);
      await P.clickQ(ed(VqhEditor.save));
      await P.waitGoneQ(VqhDialog.editor, 10_000);
      expect(
        await P.poll(
          async () => (await orderLines())[0]?.note ?? '',
          (n) => n === 'x'.repeat(50),
          10_000,
        ),
      ).toBe('x'.repeat(50));

      // HOME-068 on dev: the schema allows 80, so 51 saves; 81 is the real boundary.
      await openLine(svc);
      await P.fillQ(ed(VqhEditor.note), 'z'.repeat(81));
      const v = await P.inputValue(ed(VqhEditor.note));
      if (v.length > 80)
        expect(await P.has(ed({ textRe: 'Note must be less than 80 characters' }))).toBe(true);
      else expect(v).toHaveLength(80);
      await closeEditor();
    },
  );

  it(
    title(
      'Same service twice → two separate lines at catalogue price; an edited line keeps its own price (HOME-044)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff[0] ?? '', [svc]);
      const catalogueLine = (await orderLines())[0]?.price ?? NaN;
      await editItem(svc, { cents: '3250' });
      const edited = (await orderLines())[0]?.price ?? NaN;
      const before = (await summary()).subtotal ?? NaN;
      await addService(svc);
      const lines = (
        await P.poll(orderLines, (l) => l.filter((x) => x.name === svc).length === 2, 10_000)
      ).filter((l) => l.name === svc);
      expect(lines).toHaveLength(2);
      expect(lines.map((l) => l.price).sort((x, y) => x - y)).toEqual(
        [catalogueLine, edited].sort((x, y) => x - y),
      );
      expect((await summary()).subtotal ?? NaN).toBeCloseTo(before + catalogueLine, 2);
      // No quantity box on the order frame (one line per tap).
      expect(await P.count({ css: 'main div.pr-11 input[type="number"]' })).toBe(0);
    },
  );

  it(
    title(
      'Edit the price then Pay at once: checkout Card amount = Home Total; back on Home the sidebar card shows it (HOME-077)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(staff[0] ?? '', [svc]);
      await editItem(svc, { cents: '2000' });
      const total = (await summary()).total ?? NaN;
      await pressPay();
      await selectTender('Card');
      expect(await enteredAmount()).toBeCloseTo(total, 2);
      expect(await tenderAmount('Card')).toBeCloseTo(total, 2);
      await backToHome(id);
      expect((await summary()).total ?? NaN).toBeCloseTo(total, 2);
      expect(await sidebarHas(id)).toBe(true);
      expect(
        await P.poll(
          () => sidebarCardText(id),
          (t) => t.includes(fmt(total)),
          20_000,
        ),
      ).toContain(fmt(total));
      await P.fillQ(VqhSidebar.search, '');
    },
  );

  it(
    title(
      'Item discount 10% → "10% OFF -<10% of base>" and the Item Discount row (HOME-070)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff[0] ?? '', [svc]);
      await editItem(svc, { discount: { kind: '%', typed: '10' } });
      const d = r2(base * 0.1);
      expect(
        await P.poll(
          async () => (await orderLines())[0]?.discount ?? '',
          (t) => t !== '',
          10_000,
        ),
      ).toBe(`10% OFF -${fmt(d)}`);
      expect((await summary()).itemDiscount ?? NaN).toBeCloseTo(-d, 2);
    },
  );

  it(
    title(
      'Item discount $5.00 → "$5.00 OFF -$5.00", Item Discount -$5.00 (HOME-071)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      // Needs a service priced at least $5.
      if (!(base >= 5)) this.skip();
      await createOrder(staff[0] ?? '', [svc]);
      await editItem(svc, { discount: { kind: '$', typed: '500' } });
      expect(
        await P.poll(
          async () => (await orderLines())[0]?.discount ?? '',
          (t) => t !== '',
          10_000,
        ),
      ).toBe('$5.00 OFF -$5.00');
      expect((await summary()).itemDiscount ?? NaN).toBeCloseTo(-5, 2);
    },
  );

  it(
    title(
      'Apply Discount with % = 0 → "Discount amount must be greater than 0", Save disabled (HOME-072)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff[0] ?? '', [svc]);
      await openLine(svc);
      await setDiscount('%', '5');
      await P.fillQ(ed(VqhEditor.discount), '0');
      await P.waitFor(ed({ text: VqhEditor.zeroDiscountError }), 5_000, 'zero-discount error');
      expect(await P.isDisabled(ed(VqhEditor.save))).toBe(true);
      await closeEditor();
    },
  );

  it(
    title(
      '% typed 150 stops at 100; $ above the item price stops at the price (HOME-073)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff[0] ?? '', [svc]);
      await openLine(svc);
      await setDiscount('%', '150');
      expect(await P.inputValue(ed(VqhEditor.discount))).toBe('100');
      await setDiscount('$', String(Math.round(base * 100) + 500));
      expect(await P.inputValue(ed(VqhEditor.discount))).toBe(fmt(base));
      await closeEditor();
    },
  );

  it(
    title(
      '100% off → "100% OFF -<base>"; switching Apply Discount off clears it and the Item Discount row (HOME-074)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await createOrder(staff[0] ?? '', [svc]);
      const full = (await orderLines())[0]?.priceText ?? '';
      await editItem(svc, { discount: { kind: '%', typed: '100' } });
      expect(
        await P.poll(
          async () => (await orderLines())[0]?.discount ?? '',
          (t) => t !== '',
          10_000,
        ),
      ).toBe(`100% OFF -${fmt(base)}`);
      await openLine(svc);
      await P.clickQ(ed(VqhEditor.switch));
      expect(await P.attrOf(ed(VqhEditor.switch), 'aria-checked')).toBe('false');
      await P.clickQ(ed(VqhEditor.save));
      await P.waitGoneQ(VqhDialog.editor, 10_000);
      expect(
        await P.poll(
          async () => (await orderLines())[0]?.discount ?? 'x',
          (t) => t === '',
          10_000,
        ),
      ).toBe('');
      expect((await summary()).itemDiscount).toBeNull();
      expect((await orderLines())[0]?.priceText).toBe(full);
    },
  );

  it(
    title(
      'Lowering the price under an existing $ discount clamps the discount to the new price (HOME-075)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      // Needs a service priced above $10 (discount $ = base − $5, new price $5... scaled to the base).
      if (!(base > 10)) this.skip();
      const disc = Math.round((base - 5) * 100);
      const newPrice = Math.round((base / 2) * 100);
      await createOrder(staff[0] ?? '', [svc]);
      await editItem(svc, { discount: { kind: '$', typed: String(disc) } });
      await P.poll(
        async () => (await summary()).itemDiscount,
        (v) => v !== null,
        10_000,
      );
      await openLine(svc);
      await setEditorAmount(String(newPrice));
      const clamped = money(await P.inputValue(ed(VqhEditor.discount)));
      const msg = await P.has(ed({ textRe: 'Maximum discount is' }));
      expect(clamped <= newPrice / 100 + 0.001 || msg).toBe(true);
      if (!(await P.isDisabled(ed(VqhEditor.save)))) {
        await P.clickQ(ed(VqhEditor.save));
        await P.waitGoneQ(VqhDialog.editor, 10_000);
        const d = await P.poll(
          async () => Math.abs((await summary()).itemDiscount ?? 0),
          (v) => v <= newPrice / 100 + 0.001,
          10_000,
        );
        expect(d).toBeLessThanOrEqual(newPrice / 100 + 0.001);
        expect((await summary()).total ?? -1).toBeGreaterThanOrEqual(0);
      } else {
        await closeEditor();
      }
    },
  );

  it(
    title(
      'Gift Card tile opens "Sell Gift Card" with no staff; Close creates no order (HOME-061, HOME-062)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await quickCheckout();
      await P.clickQ(VqcHome.giftCardTile);
      await P.waitFor(VqcGiftCard.dialog, 8_000, 'Sell Gift Card');
      expect(await P.has([VqcGiftCard.dialog, { text: 'Card Number' }])).toBe(true);
      expect(await P.has([VqcGiftCard.dialog, VqcGiftCard.codeBox])).toBe(true);
      expect(await P.has([VqcGiftCard.dialog, VqcGiftCard.scan])).toBe(true);
      expect(await P.isDisabled([VqcGiftCard.dialog, VqcGiftCard.add])).toBe(true);
      expect(await P.count(VqhOrder.selectStaffFirst)).toBe(0);
      await P.clickQ([VqcGiftCard.dialog, btn('Close', 0)]);
      await P.waitGoneQ(VqcGiftCard.dialog, 5_000);
      expect(await currentOrderId()).toBe('');
      expect(await P.has(VqcHome.customerInput)).toBe(true);
      // A staff pick afterwards still works (nothing was half-created).
      await pickStaff(staff[0] ?? '');
      expect(await P.poll(currentOrderId, (v) => v !== '', 10_000)).toMatch(/^OD/);
      created.add(await currentOrderId());
    },
  );
});
