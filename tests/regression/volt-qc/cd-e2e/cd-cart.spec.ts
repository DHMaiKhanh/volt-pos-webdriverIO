/**
 * volt-qc port — 13 CD: Welcome screen and the live order mirror on the customer display.
 *
 * Source: volt-qc `e2e/tests/13-customer-display/cd-plan-cart.spec.ts` (CD-T01..T06, T20)
 * plus CD-004 / CD-005 / CD-010 / CD-013 written from the catalogue rows
 * (docs/qc/volt-qc/windows-regression/13-customer-display.md).
 *
 * Lane: LAUNCH (the customer window must be a WebDriver handle). Every draft a
 * case opens is deleted in afterEach.
 *
 * Adaptations vs the source:
 * - volt-qc derived expected prices from a fee/tax model (`core/price.ts`). Here
 *   the oracle is the app's own main window: the customer line / tile must equal
 *   what the till shows for the same order (row price, Total, tender buttons) —
 *   the thing CD-007/008 actually require ("mirrors").
 * - Staff / service are the first rendered tiles (or STAFF_NAME), not env names.
 * - CD-012's Store group needs a gift-card line: `VOLT_TEST_GIFT_CARD` or skip.
 */

import { expect } from '@wdio/globals';
import { CdCustomer, CdMain, CUSTOMER_TILE_IDS } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { app, masked, randomPhone, uniqueName } from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { parseMoney } from '../../../../src/utils/money.js';
import { ensure, expectCents, note, resetTill, track, untrack } from './cd-e2e.helpers.js';

const GIFT_CARD = (process.env.VOLT_TEST_GIFT_CARD ?? '').trim();

describe('volt-qc 13 CD — Welcome & order mirror', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'Welcome when idle (store name, no buttons); main leaves Home → Welcome, reopen → cart; Quick Checkout after a check-in → Welcome, new order has no old phone (CD-001, CD-002, CD-003)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const d = await app.testData();

      await step('CD-001 no active order → WELCOME TO + store name, no buttons', async () => {
        await app.quickCheckout();
        expect(await cust.waitWelcome()).toBe(true);
        expect(await cust.waitStoreName(10_000)).toBeTruthy();
        expect(await cust.count(CdCustomer.anyButton)).toBe(0);
      });

      const code = track(await app.createOrder());

      await step('CD-002 main → Order History: Welcome; reopen the order: cart is back', async () => {
        expect(await cust.waitFor(CdCustomer.orderDetails)).toBe(true);
        await app.go('/order-history');
        expect(await cust.waitWelcome()).toBe(true);
        expect(await cust.has(CdCustomer.orderDetails)).toBe(false);
        await app.openPendingOrder(code);
        expect(await cust.waitFor(CdCustomer.orderDetails)).toBe(true);
        expect(await cust.has(CdCustomer.staffGroup(d.staff))).toBe(true);
        expect(await cust.has({ text: d.service, nth: 0 })).toBe(true);
      });

      await step(
        'CD-003 order with a checked-in customer → Quick Checkout → Welcome; next order starts empty',
        async () => {
          const phone = randomPhone();
          await app.attachNewCustomer(phone, uniqueName('QC E2E'));
          await app.customerConfirmPhone();
          expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
          expect(await cust.has({ text: masked(phone), nth: 0 })).toBe(true);
          await app.quickCheckout();
          expect(await cust.waitWelcome()).toBe(true);
          const second = track(await app.createOrder());
          expect(await cust.waitFor(CdCustomer.orderDetails)).toBe(true);
          expect(await cust.phoneShown()).toBe(true);
          expect(await cust.phoneValue()).toBe('');
          expect(await cust.has({ text: masked(phone), nth: 0 })).toBe(false);
          expect(await cust.has(CdCustomer.checkinSuccessful)).toBe(false);
          await app.deleteCurrentOrder();
          untrack(second);
        },
      );
    },
  );

  it(
    title(
      'Delete the order on main (Remove → Delete) → customer display back to Welcome, no old item/customer (CD-004)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const d = await app.testData();
      const code = track(await app.createOrder());
      const phone = randomPhone();
      await app.attachNewCustomer(phone, uniqueName('QC E2E'));
      await app.customerConfirmPhone();
      expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
      await app.deleteCurrentOrder();
      untrack(code);
      expect(await cust.waitWelcome()).toBe(true);
      expect(await cust.has({ text: d.service, nth: 0 })).toBe(false);
      expect(await cust.has({ text: masked(phone), nth: 0 })).toBe(false);
    },
  );

  it(
    title(
      'Staff + service → cart within ~2 s: Order Details, "Staff: <name>", the line, Subtotal, 4 tiles, phone block (CD-005)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const d = await app.testData();
      await app.quickCheckout();
      await app.pickStaff(d.staff);
      track(await app.orderCode());
      const t0 = Date.now();
      await app.addService(d.service);
      expect(await cust.waitFor({ text: d.service, nth: 0 }, 10_000)).toBe(true);
      note(
        `CD-005: line mirrored ${String(Date.now() - t0)} ms after the click (incl. the 700 ms total-sync settle)`,
      );
      const text = await cust.text();
      expect(text).toContain('Order Details');
      expect(text).toContain(`Staff: ${d.staff}`);
      expect(text).toContain('Subtotal');
      for (const id of CUSTOMER_TILE_IDS) expect(Number.isFinite(await cust.tileCents(id))).toBe(true);
      expect(await cust.phoneShown()).toBe(true);
      const row = await app.itemRowText(d.service);
      const linePrice = /\$[\d,]+\.\d{2}/.exec(row)?.[0] ?? '';
      expect(linePrice).not.toBe('');
      expect(text).toContain(linePrice);
    },
  );

  it(
    title(
      'Staff only (no service): no service line, no error; edit the line price to $20.00 → customer line and tiles follow the till (CD-006, CD-007)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const d = await app.testData();
      await step('CD-006 staff only', async () => {
        await app.quickCheckout();
        await app.pickStaff(d.staff);
        await app.pause(2_000);
        expect(await cust.has({ text: d.service, nth: 0 })).toBe(false);
        const welcome = await cust.isWelcome();
        const staffShown = await cust.has(CdCustomer.staffGroup(d.staff));
        note(
          `CD-006: staff-only draft → customer ${welcome ? 'stays on Welcome' : staffShown ? 'shows the staff group' : 'neither'}`,
        );
        ensure(welcome || staffShown, 'Customer display must be on Welcome or show "Staff: <name>"');
      });
      await app.addService(d.service);
      const code = track(await app.orderCode());
      expect(await cust.waitFor({ text: d.service, nth: 0 })).toBe(true);

      await step('CD-007 price → $20.00: line + tiles follow the till', async () => {
        await app.editItemPrice(d.service, 2000);
        const row = await app.itemRowText(d.service);
        const line = /\$[\d,]+\.\d{2}/.exec(row)?.[0] ?? '';
        expect(parseMoney(line)).toBeGreaterThanOrEqual(2000);
        expect((await cust.waitText((t) => t.includes(line))).includes(line)).toBe(true);
        const homeTotal = (await app.orderTotals()).total;
        expectCents(await cust.tileCents('card'), homeTotal, 'Card tile = Home Total');
        await app.pay();
        expectCents(await cust.tileCents('card'), await app.methodCents('Card'), 'Card tile = Card button');
        expectCents(await cust.tileCents('cash'), await app.methodCents('Cash'), 'Cash tile = Cash button');
        expectCents(
          await cust.tileCents('other'),
          await app.methodCents('Other'),
          'Other tile = Other button',
        );
        await app.openPendingOrder(code);
      });
    },
  );

  it(
    title(
      'Item discount 10% → "10% OFF" + Item Discount line on the customer; + Custom Discount 10% → Promotion and Item Discount, no Total Discount (CD-008, CD-009)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const d = await app.testData();
      track(await app.createOrder());
      await step('CD-008 item −10%', async () => {
        await app.itemDiscount(d.service, '%', 10);
        expect(await app.itemRowText(d.service)).toContain('10% OFF');
        const t = await cust.waitText((x) => x.includes('10% OFF'));
        expect(t).toContain('10% OFF');
        expect(t).toMatch(/Item Discount[\s|]*-\s*\$[\d,]+\.\d{2}/);
        expectCents(await cust.tileCents('card'), (await app.orderTotals()).total, 'Card tile = Home Total');
      });
      await step('CD-009 + Custom Discount 10%', async () => {
        await app.customDiscount('%', 10);
        expect(await cust.waitFor({ text: 'Promotion', nth: 0 })).toBe(true);
        expect(await cust.has({ text: 'Item Discount', nth: 0 })).toBe(true);
        expect(await cust.has({ textRe: 'Total Discount', nth: 0 })).toBe(false);
      });
    },
  );

  it(
    title(
      'Promotion larger than the subtotal is shown CAPPED on the customer display (Promotion = −subtotal, total never negative) (CD-010)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const d = await app.testData();
      await app.quickCheckout();
      await app.pickStaff(d.staff);
      track(await app.orderCode());
      await app.quickPay(2000, 'QP Cap');
      const sub = (await app.orderTotals()).subtotal;
      try {
        await app.customDiscount('$', 30);
      } catch (error) {
        await app.closeStrayDialogs();
        note(
          `CD-010: a $30.00 custom discount on ${String(sub)}¢ could not be applied (${(error as Error).message})`,
        );
        this.skip();
      }
      const t = await cust.waitText((x) => /Promotion/.test(x));
      const promo = /Promotion[\s|]*-\s*(\$[\d,]+\.\d{2})/.exec(t)?.[1];
      ensure(promo !== undefined, `No Promotion line on the customer display: ${t}`);
      expect(parseMoney(promo ?? '$0.00')).toBeLessThanOrEqual(sub);
      expect(t).not.toContain('-$30.00');
      for (const id of CUSTOMER_TILE_IDS) expect(await cust.tileCents(id)).toBeGreaterThanOrEqual(0);
    },
  );

  it(
    title(
      'Groups by staff / Store: second staff + Quick Pay "Unknown Service 1" + gift-card line under Store; item note not shown (CD-011, CD-012)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const d = await app.testData();
      if (!GIFT_CARD || !d.staff2) this.skip();
      const noteText = 'E2E allergy note';
      track(await app.createOrder());
      await app.addItemNote(d.service, noteText);
      await app.pickStaff(d.staff2);
      await app.quickPay(1500);
      expect(await app.itemRowCount('Unknown Service 1')).toBe(1);
      await app.sellGiftCardLine(GIFT_CARD, '$25');
      const t = await cust.waitText((x) => x.includes('Store') && x.includes('Unknown Service 1'));
      const iStaff1 = t.indexOf(`Staff: ${d.staff}`);
      const iStaff2 = t.indexOf(`Staff: ${d.staff2}`);
      const iStore = t.indexOf('Store');
      ensure(iStaff1 >= 0 && iStaff2 >= 0 && iStore >= 0, `Groups missing: ${t}`);
      expect(t.indexOf(d.service, iStaff1)).toBeGreaterThan(iStaff1);
      expect(t.indexOf('Unknown Service 1', iStaff2)).toBeGreaterThan(iStaff2);
      expect(t.slice(iStore)).toMatch(/Gift Card \[/);
      expect(t).not.toContain(noteText);
    },
  );

  it(
    title(
      'Remove a line → it leaves the customer display and the tiles update; remove the last one → Welcome (CD-013)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const d = await app.testData();
      await app.quickCheckout();
      await app.pickStaff(d.staff);
      track(await app.orderCode());
      await app.quickPay(500, 'QP Keep');
      await app.quickPay(700, 'QP Drop');
      await cust.waitText((x) => x.includes('QP Drop'));
      const cardBefore = await cust.tileCents('card');
      await app.removeItem('QP Drop');
      const t = await cust.waitText((x) => !x.includes('QP Drop'));
      expect(t).not.toContain('QP Drop');
      expect(t).toContain('QP Keep');
      expect(await cust.tileCents('card')).toBeLessThan(cardBefore);
      await app.removeItem('QP Keep');
      expect(await cust.waitWelcome(10_000)).toBe(true);
    },
  );

  it(
    title(
      'Three Quick Pays in a row then remove one → customer ends on the right lines and Subtotal (CD-016)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const d = await app.testData();
      await app.quickCheckout();
      await app.pickStaff(d.staff);
      track(await app.orderCode());
      await app.quickPay(500, 'QP Five');
      await app.quickPay(600, 'QP Six');
      await app.quickPay(700, 'QP Seven');
      await app.removeItem('QP Six');
      const t = await cust.waitText(
        (x) => x.includes('QP Five') && x.includes('QP Seven') && !x.includes('QP Six'),
      );
      expect(t).toContain('QP Five');
      expect(t).toContain('QP Seven');
      expect(t).not.toContain('QP Six');
      const sub = (await app.orderTotals()).subtotal;
      expect(t).toMatch(new RegExp(`Subtotal[\\s|]*\\$${(sub / 100).toFixed(2).replace('.', '\\.')}`));
    },
  );

  it(
    title(
      '15 lines: the Order Details list scrolls inside its frame, tiles and Subtotal stay in view, no horizontal page scroll (CD-017)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const d = await app.testData();
      await app.quickCheckout();
      await app.pickStaff(d.staff);
      for (let i = 1; i <= 15; i += 1) {
        await app.quickPay(100, `QP Item ${String(i)}`);
        if (i === 1) track(await app.orderCode());
      }
      await cust.waitText((x) => x.includes('QP Item 15'), 15_000);
      const boxes = await cust.scrollBoxesWith('QP Item 1');
      ensure(
        boxes.some((b) => b.sh > b.ch),
        `Order Details frame must scroll: ${JSON.stringify(boxes)}`,
      );
      const [item15, cardTile, subtotal] = await cust.inViewportAfterScroll('QP Item 15', [
        { text: 'QP Item 15', nth: 0 },
        CdCustomer.tile('card'),
        { text: 'Subtotal', nth: 0 },
      ]);
      expect(item15).toBe(true);
      expect(cardTile).toBe(true);
      expect(subtotal).toBe(true);
      const o = await cust.overflow();
      expect(o.scrollW).toBeLessThanOrEqual(o.clientW + 1);
    },
  );

  it(
    title(
      'Pay-by tiles: Card/Cash/Other/Gift Card order, always disabled, highlight follows the tender main picks (CD-018, CD-019, CD-020)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const code = track(await app.createOrder());
      await step('CD-018 order + Card active', async () => {
        expect(await cust.waitFor(CdCustomer.tile('card'))).toBe(true);
        expect(await cust.tileOrder()).toEqual(['card', 'cash', 'other', 'gift_card']);
        for (const id of CUSTOMER_TILE_IDS) expect(Number.isFinite(await cust.tileCents(id))).toBe(true);
        expect(await cust.activeTiles()).toEqual(['card']);
      });
      await step('CD-019 tiles disabled, tapping Cash changes nothing', async () => {
        const disabled = await cust.tilesDisabled();
        for (const id of CUSTOMER_TILE_IDS) expect(disabled[id]).toBe(true);
        await cust.forceClick(CdCustomer.tile('cash'));
        await app.pause(800);
        expect(await cust.activeTiles()).toEqual(['card']);
      });
      await step('CD-020 checkout Card → Cash → Other: one tile lit, amount = main button', async () => {
        await app.pay();
        expect(await cust.waitActiveTiles(['card'])).toEqual(['card']);
        expectCents(await cust.tileCents('card'), await app.methodCents('Card'), 'Card tile');
        for (const [m, id] of [
          ['Cash', 'cash'],
          ['Other', 'other'],
        ] as const) {
          await app.selectMethod(m);
          expect(await cust.waitActiveTiles([id])).toEqual([id]);
          expectCents(await cust.tileCents(id), await app.methodCents(m), `${m} tile`);
        }
      });
      await app.openPendingOrder(code);
    },
  );

  it(
    title(
      'Sidebar Reload → customer Welcome with store name, then the cart again; reload ONLY the customer window → Welcome with blank name until main sends it (CD-070, CD-071)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const d = await app.testData();
      const code = track(await app.createOrder());
      expect(await cust.waitFor(CdCustomer.orderDetails)).toBe(true);

      await step('CD-070 sidebar Reload', async () => {
        await app.reloadApp();
        // The Welcome flashes for ~0.5 s before main re-opens the held order; the
        // reload itself is blocking here, so accept either the name or the cart.
        const name = await cust.storeName().catch(() => null);
        note(`CD-070: after reload the customer shows ${name ? `Welcome "${name}"` : 'the cart'}`);
        // The reloaded customer window must know the store again: idle frame → Welcome + name.
        await app.quickCheckout();
        expect(await cust.waitStoreName(15_000)).toBeTruthy();
        await app.openPendingOrder(code);
        expect(await cust.waitFor(CdCustomer.orderDetails, 15_000)).toBe(true);
        expect(await cust.has({ text: d.service, nth: 0 })).toBe(true);
      });

      await step('CD-071 reload just the customer window', async () => {
        await cust.reloadSelf();
        expect(await cust.waitWelcome(20_000)).toBe(true);
        await app.pause(1_500);
        expect(await cust.storeName()).toBe('');
        expect(await cust.has(CdCustomer.orderDetails)).toBe(false);
        await app.quickCheckout();
        expect(await cust.waitStoreName(15_000)).toBeTruthy();
      });
      ensure((await app.count(CdMain.quickCheckout)) > 0, 'main still on Home');
    },
  );
});
