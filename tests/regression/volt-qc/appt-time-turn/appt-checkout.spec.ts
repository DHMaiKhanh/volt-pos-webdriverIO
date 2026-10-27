/**
 * volt-qc port — 08 APPOINTMENT Checkout from a booking (writes pending orders).
 *
 * Source: volt-qc `e2e/tests/08-appointment/appt-plan-booking.spec.ts` —
 * APPT-T12 (Checkout → prefilled order, re-Checkout opens the same order,
 * delete → new order), APPT-T13a (holding another order: Open Appointment
 * Order dialog), APPT-T13b (Checkout from Home) and the order-edit half of
 * APPT-T14. TC catalogue: docs/qc/volt-qc/windows-regression/08-appointment.md.
 *
 * Adaptations:
 * - volt-qc books its own appointment on the online booking site; here a
 *   Scheduled / Confirmed booking WITHOUT an order is discovered on the board
 *   (today first, then ±7 days) and the case skips when there is none.
 * - Every order created here is a draft that is DELETED before the case ends
 *   (`after` sweeps leftovers), so the booking is back to "no order" and its
 *   status is untouched. Nothing is paid: paying would turn a real booking Done
 *   for good (APPT-097/098 stay manual).
 * - Customer Display assertions are left out (single-window lane).
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { VqaAppt as Q } from '../../../../src/constants/testids.voltqc-appt-time-turn.js';
import { VqcPending } from '../../../../src/constants/testids.voltqc-pos.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { homePage } from '../../../../src/pages/index.js';
import {
  type BoardCard,
  boardCards,
  clickHomeRow,
  closeAppointmentsToday,
  closePopoverX,
  homeOrderId,
  homeRows,
  openAppointmentsToday,
  openCardByText,
  openFromPendingSidebar,
  popoverCheckout,
  popoverInfo,
} from '../../../../src/pages/voltqc/appt-time-turn/apptBoard.js';
import {
  clearBoardStorage,
  dayStart,
  gotoBoard,
  resetBoard,
} from '../../../../src/pages/voltqc/pos/appointmentProbe.js';
import { quickCheckout } from '../../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

interface Target {
  day: Date;
  card: BoardCard;
  status: string;
  service: string;
}

/** A Scheduled / Confirmed booking with no order yet; leaves its popover open. */
async function findOpenBooking(span = 7): Promise<Target | null> {
  await gotoBoard(dayStart(0));
  await clearBoardStorage();
  const offsets = [0];
  for (let i = 1; i <= span; i += 1) offsets.push(i, -i);
  for (const off of offsets) {
    const day = dayStart(off);
    await gotoBoard(day);
    for (const card of (await boardCards()).filter(
      (c) => c.status === 'Scheduled' || c.status === 'Confirmed',
    )) {
      await openCardByText(card.text);
      const info = await popoverInfo();
      if (info.orderId === '' && info.buttons.includes('Checkout'))
        return { day, card, status: info.status, service: info.service };
      await closePopoverX();
    }
  }
  return null;
}

/** Re-open the target's popover on its day. */
async function reopen(t: Target): Promise<void> {
  await gotoBoard(t.day);
  await openCardByText(t.card.text);
}

describe('volt-qc 08 APPOINTMENT — Checkout from a booking', () => {
  /** Draft orders this file created and has not deleted yet. */
  const created = new Set<string>();

  async function deleteOrder(orderId: string): Promise<void> {
    if ((await homeOrderId()) !== orderId && !(await openFromPendingSidebar(orderId))) return;
    await homePage.deleteOrder();
    await P.poll(homeOrderId, (id) => id !== orderId, 10_000);
    created.delete(orderId);
  }

  before(async () => {
    assertWritesAllowed('check out an appointment into a draft order');
    await returnToHome();
  });

  afterEach(async () => {
    await P.escape().catch(() => undefined);
    await closePopoverX().catch(() => undefined);
  });

  after(async function () {
    this.timeout(3 * 60_000);
    for (const id of [...created]) await deleteOrder(id).catch(() => undefined);
    await resetBoard().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Checkout creates a prefilled order; Pending shows it; the booking then has Order # + Checkout which reopens the same order; editing the order leaves the booking; delete → Checkout makes a new order (APPT-065, APPT-085, APPT-087, APPT-090, APPT-101, APPT-102, APPT-103)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      await returnToHome();
      await quickCheckout(); // the device holds no order
      const t = await findOpenBooking();
      if (!t) this.skip(); // no Scheduled / Confirmed booking without an order within ±7 days
      const target = t;
      let id1 = '';

      await step(
        'Checkout → /home, new OD order with the booked line, Booking Time, no appointmentId in the URL',
        async () => {
          const { dialogShown } = await popoverCheckout();
          expect(dialogShown).toBe(false);
          id1 = await homeOrderId();
          created.add(id1);
          expect(id1).toMatch(/^OD\d{6}-\d+$/);
          expect(await P.urlParam('appointmentId')).toBeNull();
          const lines = await P.poll(
            () => homePage.cartLinePricesCents(),
            (l) => l.length > 0,
            15_000,
          );
          expect(lines.length).toBeGreaterThan(0);
          expect((await homePage.cartTotals()).subtotal).toBeGreaterThan(0);
          expect(await P.pageText('main')).toContain(Q.bookingTimeRe);
          if (target.service) expect(await P.pageText('main')).toContain(target.service);
        },
      );

      await step('Pending Orders: the card shows Processing and the booked service', async () => {
        await P.routerGo('/order-pending');
        await P.fillQ(VqcPending.searchBox, id1);
        const card = [{ css: 'main' }, { role: 'button', hasText: id1, nth: 0 }] as const;
        await P.waitFor(card, 15_000, `pending card ${id1}`);
        const text = await P.textOf(card);
        expect(text).toContain('Processing');
        if (target.service) expect(text).toContain(target.service);
        await P.fillQ(VqcPending.searchBox, '');
      });

      await step(
        'booking popover: Order #id1 and Checkout; Checkout reopens id1, one pending card',
        async () => {
          await reopen(target);
          const info = await P.poll(popoverInfo, (i) => i.orderId === id1, 20_000);
          expect(info.orderId).toBe(id1);
          expect(info.buttons).toContain('Checkout');
          const { dialogShown } = await popoverCheckout();
          expect(dialogShown).toBe(false);
          expect(await homeOrderId()).toBe(id1);
          await P.fillQ(Q.pendingSideSearch, id1);
          expect(
            await P.count([
              { role: 'complementary', name: 'Pending Orders sidebar' },
              { role: 'button', nameRe: `^\\s*${id1}` },
            ]),
          ).toBe(1);
          await P.fillQ(Q.pendingSideSearch, '');
        },
      );

      await step('add a service to the order → the booking keeps its original service', async () => {
        const before = (await homePage.cartLinePricesCents()).length;
        await homePage.addFirstService();
        await P.poll(
          () => homePage.cartLinePricesCents(),
          (l) => l.length > before,
          10_000,
        );
        await reopen(target);
        const info = await popoverInfo();
        expect(info.service).toBe(target.service);
        expect(info.status).toBe(target.status);
        await closePopoverX();
      });

      await step(
        'delete the order → booking keeps its status, no Order #; Checkout makes a NEW order',
        async () => {
          await returnToHome();
          await deleteOrder(id1);
          await reopen(target);
          const info = await P.poll(popoverInfo, (i) => i.orderId === '', 30_000);
          expect(info.orderId).toBe('');
          expect(info.status).toBe(target.status);
          await popoverCheckout();
          const id2 = await homeOrderId();
          created.add(id2);
          expect(id2).toMatch(/^OD\d{6}-\d+$/);
          expect(id2).not.toBe(id1);
          expect((await homePage.cartLinePricesCents()).length).toBeGreaterThan(0);
          await deleteOrder(id2);
        },
      );
    },
  );

  it(
    title(
      'Holding another order: Checkout asks "Open Appointment Order" — Cancel keeps the held order, Continue opens the booking\'s order and parks the other in Pending (APPT-091, APPT-092)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await returnToHome();
      await quickCheckout();
      await homePage.selectFirstStaff();
      await homePage.addFirstService();
      const x = await P.poll(homeOrderId, (id) => id !== '', 15_000);
      if (!x) this.skip(); // the till did not open a draft
      created.add(x);
      await settle(1_500);

      const t = await findOpenBooking();
      if (!t) this.skip();
      const target = t;

      await step('Checkout → dialog → Cancel: still on the board, held order unchanged', async () => {
        const { dialogShown } = await popoverCheckout('Cancel');
        expect(dialogShown).toBe(true);
        expect(await P.path()).toBe('/appointment');
        await returnToHome();
        expect(await P.poll(homeOrderId, (id) => id === x, 10_000)).toBe(x);
      });

      await step(
        'Checkout → dialog text → Continue: booking order on /home, held order in Pending',
        async () => {
          await reopen(target);
          await P.clickQ(Q.popoverCheckout);
          await P.waitFor(Q.openOrderDialog, 8_000, 'Open Appointment Order');
          expect(await P.textOf(Q.openOrderDialog)).toContain(Q.openOrderText);
          expect(await P.has([Q.openOrderDialog, { role: 'button', name: 'Continue' }])).toBe(true);
          await P.clickQ([Q.openOrderDialog, { role: 'button', name: 'Continue', nth: 0 }]);
          await P.poll(
            () => P.path(),
            (p) => p === '/home',
            20_000,
          );
          const y = await P.poll(homeOrderId, (id) => id !== '' && id !== x, 15_000);
          created.add(y);
          expect(y).not.toBe(x);
          await P.fillQ(Q.pendingSideSearch, x);
          expect(
            await P.poll(
              () => P.has(Q.pendingSideCard(x)),
              (v) => v,
              10_000,
            ),
          ).toBe(true);
          await P.fillQ(Q.pendingSideSearch, '');
          await deleteOrder(y);
        },
      );
      await deleteOrder(x);
    },
  );

  it(
    title(
      'Checkout from Home › Appointments Today gives the same prefilled order as from the board (APPT-104)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      await returnToHome();
      await quickCheckout();
      const n = await openAppointmentsToday();
      if (!(n > 0)) {
        await closeAppointmentsToday();
        this.skip(); // no appointment today
      }
      const rows = await homeRows();
      let opened = false;
      for (let i = 0; i < rows.length && !opened; i += 1) {
        await clickHomeRow(i);
        const info = await popoverInfo();
        if (info.orderId === '' && info.buttons.includes('Checkout')) opened = true;
        else await closePopoverX();
      }
      if (!opened) {
        await closeAppointmentsToday();
        this.skip(); // every booking today already has an order or is Done
      }
      const service = (await popoverInfo()).service;
      const { dialogShown } = await popoverCheckout();
      expect(dialogShown).toBe(false);
      const id = await homeOrderId();
      created.add(id);
      expect(id).toMatch(/^OD\d{6}-\d+$/);
      expect(
        (
          await P.poll(
            () => homePage.cartLinePricesCents(),
            (l) => l.length > 0,
            15_000,
          )
        ).length,
      ).toBeGreaterThan(0);
      expect(await P.pageText('main')).toContain(Q.bookingTimeRe);
      if (service) expect(await P.pageText('main')).toContain(service);
      await deleteOrder(id);
      await closeAppointmentsToday().catch(() => undefined);
    },
  );
});
