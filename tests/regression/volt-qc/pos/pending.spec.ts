/**
 * volt-qc port — 06 PEND / 17-added PEND: the /order-pending page (read-only cases).
 *
 * Source: volt-qc `e2e/tests/06-pending/pend-plan-page.spec.ts` (PEND-T01, T04, T34) and
 * `e2e/tests/17-added/pend-added.spec.ts` (PEND-AD1).
 * TC catalogue: docs/qc/volt-qc/windows-regression/06-pending-checkin.md.
 *
 * Filters and scrolling only — no card is opened, nothing is written. The date
 * filter is put back on "Today" after every case.
 *
 * Not ported: volt-qc PEND-T23 (GoCheckin new-customer name field) drives the GoCheckin kiosk in a separate
 * Chrome page (volt-qc `gci` fixture) — a different surface from this POS lane.
 */

import { expect } from '@wdio/globals';
import { VqcCommon, VqcPending, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { orderPendingPage } from '../../../../src/pages/index.js';
import {
  DATETIME_MEDIUM_RE,
  cardsPerRow,
  choosePreset,
  clickCalendarDay,
  collectAllIds,
  daysAgo,
  mdy,
  openCalendar,
  pickDateRange,
  presetOptions,
  renderedCards,
  renderedIds,
  scrollList,
} from '../../../../src/pages/voltqc/pos/pendingProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

async function resetToToday(): Promise<void> {
  if (!(await orderPendingPage.isActive())) return;
  await P.escape().catch(() => undefined);
  if (!/Today/.test(await P.textOf(VqcPending.presetCombo).catch(() => ''))) {
    await choosePreset('Today').catch(() => undefined);
  }
}

describe('volt-qc 06 PEND — Pending Orders page (read-only)', () => {
  afterEach(async () => {
    await resetToToday();
  });

  it(
    title(
      '"/" redirects to /order-pending with the full filter bar and no passcode (PEND-001, PEND-003)',
      Tag.REGRESSION,
    ),
    async () => {
      await returnToHome();
      await P.routerGo('/');
      await P.poll(
        () => P.path(),
        (p) => p.startsWith('/order-pending'),
        15_000,
      );
      expect(await P.path()).toMatch(/^\/order-pending/);
      await P.waitFor(VqcPending.searchBox, 15_000, 'pending search box');
      expect(await P.has(VqcPending.staffButton)).toBe(true);
      expect(await P.textOf(VqcPending.sortCombo)).toMatch(/Latest/);
      expect(await P.textOf(VqcPending.presetCombo)).toMatch(/Today/);
      expect(await P.has(VqcPending.dateRange)).toBe(true);
      expect(await P.has(VqcPending.quickCheckout)).toBe(true);
      const cardsOrEmpty = await P.poll(
        async () => (await P.has(VqcPending.cards)) || (await P.has(inMain({ text: VqcPending.noPending }))),
        (v) => v,
        15_000,
      );
      expect(cardsOrEmpty).toBe(true);
      expect(await P.count(VqcCommon.passcodeDialog)).toBe(0);
    },
  );

  it(
    title(
      'Date picker: the 8 presets, Cancel keeps Today, a custom range applies, an empty range shows the empty state (PEND-005, PEND-007, PEND-008, PEND-009)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const today = new Date();
      await orderPendingPage.open();

      await step('PEND-005 exactly 8 presets (no This Year / Last Year / Custom)', async () => {
        expect(await presetOptions()).toEqual([...VqcPending.presets]);
      });

      await step('PEND-008 pick another day then Cancel → still Today', async () => {
        await openCalendar();
        await clickCalendarDay(daysAgo(3));
        await P.clickQ([VqcPending.calendarPopover, { role: 'button', name: 'Cancel' }]);
        await P.waitGoneQ(VqcPending.calendarPopover, 5_000, 'date popover');
        expect((await P.textOf(VqcPending.presetCombo)).trim()).toBe('Today');
        expect(await P.textOf(VqcPending.dateRange)).toBe(mdy(today));
      });

      await step(
        'PEND-007 custom range → Apply: "MM/dd/yyyy - MM/dd/yyyy", preset Custom, cards in range',
        async () => {
          // 8 days ending yesterday: matches no preset.
          const from = daysAgo(8);
          const to = daysAgo(1);
          await pickDateRange(from, to);
          expect(await P.textOf(VqcPending.dateRange)).toBe(`${mdy(from)} - ${mdy(to)}`);
          expect(await P.textOf(VqcPending.presetCombo)).toMatch(/Custom/);
          const lo = new Date(from).setHours(0, 0, 0, 0);
          const hi = new Date(to).setHours(23, 59, 59, 999);
          for (const c of await renderedCards()) {
            const m = DATETIME_MEDIUM_RE.exec(c.text);
            expect(m).not.toBeNull();
            if (!m) continue;
            const at = new Date(m[0]).getTime();
            expect(at >= lo && at <= hi).toBe(true);
          }
        },
      );

      await step('PEND-009 a range with no order (one day, two years ago) → empty state', async () => {
        const d = daysAgo(730);
        await pickDateRange(d, d);
        expect(await P.textOf(VqcPending.dateRange)).toBe(mdy(d));
        expect(await P.textOf(VqcPending.presetCombo)).toMatch(/Custom/);
        await P.waitFor(inMain({ text: VqcPending.noPending }), 10_000, '"No pending orders"');
        expect(await P.has(inMain({ text: VqcPending.noPendingDesc }))).toBe(true);
      });
    },
  );

  it(
    title(
      'Grid holds at most 4 cards a row and scrolls to the last card (Last 30 Days) (PEND-022)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await orderPendingPage.open();
      await choosePreset('Last 30 Days');
      const all = await collectAllIds();
      // Needs > 12 pending orders in the last 30 days.
      if (all.length <= 12) this.skip();
      await scrollList('top');
      const perRow = await cardsPerRow();
      expect(perRow.length).toBeGreaterThan(0);
      expect(Math.max(...perRow)).toBeLessThanOrEqual(4);
      expect(perRow[0]).toBe(4);
      await scrollList('bottom');
      const infos = await P.infos(VqcPending.cards);
      expect(infos[infos.length - 1]?.inViewport).toBe(true);
      expect(await renderedIds()).toContain(all[all.length - 1]);
    },
  );

  it(
    title(
      'Pending filter bar: search, Staff, Latest/Oldest, date, Quick Checkout — no source "Filters" yet (PEND-094)',
      Tag.REGRESSION,
    ),
    async () => {
      await orderPendingPage.open();
      expect(await P.has(VqcPending.searchBox)).toBe(true);
      expect(await P.has(VqcPending.staffButton)).toBe(true);
      expect(await P.has(VqcPending.sortCombo)).toBe(true);
      expect(await P.has(VqcPending.dateRange)).toBe(true);
      expect(await P.has(VqcPending.quickCheckout)).toBe(true);
      // VP-1252 (Manual / Appointment / GoCheckin source filter) not shipped.
      expect(await P.count(VqcPending.filtersButton)).toBe(0);
    },
  );
});
