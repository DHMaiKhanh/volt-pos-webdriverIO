/**
 * volt-qc port — 02 HOME (read-only cases only).
 *
 * Source: volt-qc `e2e/tests/02-home/home-plan-panels.spec.ts` + `home-plan-customer.spec.ts`
 * (`@readonly` tests). TC catalogue: docs/qc/volt-qc/windows-regression/02-home-tao-order.md.
 *
 * Nothing here selects a staff or adds a line: every case runs on the EMPTY order
 * frame that Quick Checkout opens, so no draft order is ever created.
 *
 * Adaptations vs the source:
 * - HOME-038 asserted "Express Pedicure $30.00" (a service on volt-qc's merchant);
 *   here it asserts the TC's actual expectation — service tiles show a name and a
 *   `$x.xx` catalogue price — on whatever merchant the till is signed into.
 * - HOME-039 searched "express"; here the term is the first word of a real
 *   rendered service, so the case does not depend on one merchant's catalogue.
 * - HOME-G4 (1920×1080 via CDP device-metrics emulation, no TC id) is not ported:
 *   WebDriver on the Tauri window has no device-metrics override.
 */

import { expect } from '@wdio/globals';
import { VqcGlobalSearch, VqcHome, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  accordionOpen,
  categoryTiles,
  clickCategoryAt,
  closeGlobalSearch,
  customerKeys,
  globalSearchBox,
  globalSearchTab,
  openGlobalSearch,
  openStaffSort,
  quickCheckout,
  serviceTiles,
  visibleStaffNames,
} from '../../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const byBase = (a: string, b: string): number => a.localeCompare(b, 'en', { sensitivity: 'base' });

describe('volt-qc 02 HOME — read-only', () => {
  beforeEach(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    // Leave the till clean: no search terms, no open popover/dialog.
    await P.escape().catch(() => undefined);
    await closeGlobalSearch().catch(() => undefined);
    if (await P.has(VqcHome.staffSearch)) await P.fillQ(VqcHome.staffSearch, '').catch(() => undefined);
    if (await P.has(VqcHome.serviceSearch)) await P.fillQ(VqcHome.serviceSearch, '').catch(() => undefined);
  });

  it(
    title(
      'Customer entry: keypad 0-9/C + backspace, Done disabled, phone mask, paste 11 digits drops the leading 1 (HOME-089, HOME-091, HOME-095, HOME-104)',
      Tag.REGRESSION,
    ),
    async () => {
      await quickCheckout();
      const box = VqcHome.customerInput;
      expect(await P.has(box)).toBe(true);
      for (const k of '0123456789C') {
        expect(await P.has(VqcHome.keypadKey(k))).toBe(true);
      }
      expect(await P.isDisabled(VqcHome.doneButton)).toBe(true);
      expect(await P.textOf(VqcHome.checkinToday)).toMatch(/Show|Hide/);
      expect(await P.textOf(VqcHome.appointmentsToday)).toMatch(/Show|Hide/);

      await step('HOME-104: 555010 → backspace → "(555) 01" → C → empty', async () => {
        await customerKeys('C555010');
        await customerKeys('<');
        expect(await P.inputValue(box)).toBe('(555) 01');
        await customerKeys('C');
        expect(await P.inputValue(box)).toBe('');
      });

      await step('HOME-095: 9 digits keep Done disabled', async () => {
        await customerKeys('555010123');
        expect(await P.isDisabled(VqcHome.doneButton)).toBe(true);
        await customerKeys('C');
      });

      await step('HOME-091: paste "15550101234" → (555) 010-1234; one more key changes nothing', async () => {
        await P.fillQ(box, '15550101234');
        expect(await P.inputValue(box)).toBe('(555) 010-1234');
        await customerKeys('9');
        expect(await P.inputValue(box)).toBe('(555) 010-1234');
        await customerKeys('C');
      });

      expect(await P.count(VqcHome.orderHeading)).toBe(0);
    },
  );

  it(
    title(
      'Tile order Quick Pay, Gift Card, then categories; "N Service(s)" plural rule; service tiles show name + $x.xx (HOME-036, HOME-038)',
      Tag.REGRESSION,
    ),
    async () => {
      await quickCheckout();
      const tiles = await categoryTiles();
      expect(tiles.slice(0, 2).map((t) => t.name)).toEqual(['Quick Pay', 'Gift Card']);
      expect(tiles.length).toBeGreaterThan(2);
      expect(tiles.filter((t) => t.selected).length).toBe(1);
      for (const t of tiles.slice(2)) {
        const m = /^(\d+) (Services?|Products?)$/.exec(t.sub);
        expect(m).not.toBeNull();
        if (m) expect(m[2]?.endsWith('s')).toBe(Number(m[1]) !== 1);
      }

      await step('HOME-038: a category on page 1 renders service tiles with a $x.xx price', async () => {
        let found = (await serviceTiles()).find((s) => s.name !== '');
        for (const [i, t] of tiles.entries()) {
          if (found) break;
          if (i < 2 || t.slide > 0) continue;
          await clickCategoryAt(i);
          found = (await serviceTiles()).find((s) => s.name !== '');
        }
        expect(found).toBeDefined();
        expect(found?.price ?? '').toMatch(/^\$[\d,]+\.\d{2}$/);
      });
    },
  );

  it(
    title(
      'Service search keeps only matching services and deselects the category; no match → "No services available." (HOME-039, HOME-040)',
      Tag.REGRESSION,
    ),
    async () => {
      await quickCheckout();
      const first = (await serviceTiles()).find((s) => s.name.trim() !== '');
      expect(first).toBeDefined();
      const term = (first?.name ?? '').split(/\s+/)[0]?.toLowerCase() ?? '';
      await P.fillQ(VqcHome.serviceSearch, term);
      const hits = await P.poll(serviceTiles, (s) => s.length > 0);
      expect(hits.length).toBeGreaterThan(0);
      for (const s of hits) expect(s.name.toLowerCase()).toContain(term);
      expect((await categoryTiles()).some((t) => t.selected)).toBe(false);

      await P.fillQ(VqcHome.serviceSearch, 'zzqqxx');
      await P.waitFor(VqcHome.noServices, 10_000, '"No services available."');
      await P.fillQ(VqcHome.serviceSearch, '');
    },
  );

  it(
    title(
      'More than 8 tiles: dragging the carousel shows the rest and keeps the selected category (HOME-037)',
      Tag.REGRESSION,
    ),
    async function () {
      await quickCheckout();
      const tiles = await categoryTiles();
      if (tiles.length <= 8) this.skip();
      const selected = tiles.find((t) => t.selected)?.name;
      const page2 = tiles.find((t) => t.slide >= 1);
      if (!page2) this.skip();
      const firstHeading = await P.info(inMain({ role: 'heading', name: tiles[0]?.name ?? '', nth: 0 }));
      expect(firstHeading).not.toBeNull();
      const r = firstHeading?.rect ?? { x: 0, y: 0, w: 0, h: 0 };
      await P.drag({ x: r.x + 600, y: r.y + r.h / 2 }, { x: Math.max(5, r.x - 400), y: r.y + r.h / 2 }, 700);
      const target = inMain({ role: 'heading', name: page2?.name ?? '', nth: 0 });
      const shown = await P.poll(
        async () => (await P.info(target))?.inViewport ?? false,
        (v) => v,
        5_000,
      );
      expect(shown).toBe(true);
      expect((await categoryTiles()).find((t) => t.selected)?.name).toBe(selected);
    },
  );

  it(
    title('Staff search never returns an Inactive staff or the Owner (HOME-017)', Tag.REGRESSION),
    async function () {
      const names = [process.env.VOLT_INACTIVE_NAME, process.env.VOLT_OWNER_NAME]
        .map((n) => (n ?? '').trim())
        .filter(Boolean);
      // Needs the names of an Inactive staff / the Owner on this merchant (Portal data).
      if (names.length === 0) this.skip();
      await quickCheckout();
      for (const n of names) {
        await P.fillQ(VqcHome.staffSearch, n);
        await settle(800);
        expect(await visibleStaffNames()).not.toContain(n);
      }
      await P.fillQ(VqcHome.staffSearch, '');
    },
  );

  it(
    title('Sort by popover lists every option; Name sorts A→Z then Z→A (HOME-023, HOME-024)', Tag.REGRESSION),
    async () => {
      await quickCheckout();
      await openStaffSort();
      const pop = VqcHome.sortPopover;
      try {
        for (const l of VqcHome.sortOptions) expect(await P.has([pop, { text: l }])).toBe(true);
        await P.clickQ([pop, { text: 'Name' }]);
        expect(await P.has([pop, { text: 'Ascending' }])).toBe(true);
        expect(await P.has([pop, { text: 'Descending' }])).toBe(true);
        await P.clickQ([pop, { text: 'Ascending' }]);
        await settle(800);
        const asc = await visibleStaffNames();
        expect(asc.length).toBeGreaterThan(1);
        // Known issue on DEV (volt-qc bug #12): the sort is case-sensitive ("APIB…" before "Alexander2").
        expect(asc).toEqual([...asc].sort(byBase));
        await P.clickQ([pop, { text: 'Descending' }]);
        await settle(800);
        const desc = await visibleStaffNames();
        expect(desc).toEqual([...desc].sort((x, y) => byBase(y, x)));
      } finally {
        if (await P.has(pop)) await P.clickQ([pop, { text: 'Default Order' }]).catch(() => undefined);
        await P.escape();
      }
    },
  );

  it(
    title(
      'Global Search modal: title, autofocus, hint, 4 tabs (All selected), no-result text, reset on reopen (HOME-155, HOME-161, HOME-162)',
      Tag.REGRESSION,
    ),
    async () => {
      const dlg = VqcGlobalSearch.dialog;
      await openGlobalSearch();
      expect(await P.has([dlg, { text: 'Search', nth: 0 }])).toBe(true);
      expect((await P.info(globalSearchBox))?.focused).toBe(true);
      expect(await P.has([dlg, { text: VqcGlobalSearch.hint }])).toBe(true);
      for (const t of VqcGlobalSearch.tabs) expect(await P.has([dlg, { role: 'tab', name: t }])).toBe(true);
      expect(await P.attrOf([dlg, { role: 'tab', name: 'All' }], 'aria-selected')).toBe('true');

      await P.fillQ(globalSearchBox, 'zzqq');
      await P.waitFor([dlg, { textRe: 'No results found for "zzqq"', nth: 0 }], 15_000, 'no-result text');

      await P.fillQ(globalSearchBox, 'qc');
      await P.clickQ(globalSearchTab('^Order'));
      await closeGlobalSearch();

      await openGlobalSearch();
      expect(await P.inputValue(globalSearchBox)).toBe('');
      expect(await P.attrOf([dlg, { role: 'tab', name: 'All' }], 'aria-selected')).toBe('true');
      expect(await P.has([dlg, { text: VqcGlobalSearch.hint }])).toBe(true);
      await closeGlobalSearch();
    },
  );

  it(title('Global Search "5" → Customer tab capped at 20 rows (HOME-163)', Tag.REGRESSION), async () => {
    await openGlobalSearch();
    await P.fillQ(globalSearchBox, '5');
    const label = await P.poll(
      () => P.textOf(globalSearchTab('^Customer')),
      (t) => /Customer \(\d+\)/.test(t),
      20_000,
    );
    expect(label).toMatch(/Customer \(\d+\)/);
    const n = Number(/\((\d+)\)/.exec(label)?.[1] ?? NaN);
    expect(n).toBeLessThanOrEqual(20);
    await P.clickQ(globalSearchTab('^Customer'));
    expect(await P.count([VqcGlobalSearch.dialog, { css: VqcGlobalSearch.resultCss }])).toBeLessThanOrEqual(
      20,
    );
    await closeGlobalSearch();
  });

  it(
    title(
      'Home layout: 4 panels, no horizontal scroll, customer placeholder not clipped, sidebar has no collapse/pin (HOME-001, HOME-003, HOME-016)',
      Tag.REGRESSION,
    ),
    async () => {
      await quickCheckout();
      expect(await P.has(VqcHome.pendingSidebar)).toBe(true);
      expect(await P.has(VqcHome.staffSearch)).toBe(true);
      expect(await P.has(VqcHome.customerInput)).toBe(true);
      expect(await P.has(VqcHome.keypadKey('1'))).toBe(true);
      expect(await P.has(VqcHome.checkinToday)).toBe(true);
      expect(await P.has(VqcHome.appointmentsToday)).toBe(true);
      expect(await P.has(VqcHome.quickPayTile)).toBe(true);
      expect(await P.has(VqcHome.giftCardTile)).toBe(true);
      expect(await P.noHorizontalScroll()).toBe(true);

      const box = await P.info(VqcHome.customerInput);
      expect(box?.attrs.placeholder).toBe('Enter Customer Phone, Name or Email');
      expect(box?.scrollFits).toBe(true);

      const side = (await P.texts([VqcHome.pendingSidebar, { role: 'button' }])).map((t) => t.trim());
      const extra = side.filter((t) => !/^OD\d{6}-\d+/.test(t) && t !== 'Quick Checkout' && t !== '');
      expect(extra).toEqual([]);
      expect(
        await P.count([
          VqcHome.pendingSidebar,
          { role: 'button', nameRe: 'collapse|pin|toggle', flags: 'i' },
        ]),
      ).toBe(0);
    },
  );

  it(
    title(
      'Typing one character in Search staff / Search service shows no "null"/"undefined" (HOME-002)',
      Tag.REGRESSION,
    ),
    async () => {
      await quickCheckout();
      for (const box of [VqcHome.staffSearch, VqcHome.serviceSearch]) {
        await P.fillQ(box, 'a');
        expect((await P.info(box))?.fullyInViewport).toBe(true);
      }
      expect(await P.pageText()).not.toMatch(/\bnull\b|\bundefined\b/);
      await P.fillQ(VqcHome.staffSearch, '');
      await P.fillQ(VqcHome.serviceSearch, '');
      expect(await P.pageText()).not.toMatch(/\bnull\b|\bundefined\b/);
    },
  );

  it(
    title(
      'Checkin Today / Appointments Today accordions toggle Show/Hide; none today → "No appointments today" (HOME-117)',
      Tag.REGRESSION,
    ),
    async () => {
      await quickCheckout();
      const checkin = VqcHome.checkinToday;
      const appt = VqcHome.appointmentsToday;
      // The open/closed state is kept for the session — restore it afterwards.
      const apptWasOpen = await accordionOpen(appt);
      const checkinWasOpen = await accordionOpen(checkin);
      try {
        if (checkinWasOpen) await P.clickQ(checkin);
        expect(await P.textOf(checkin)).toContain('Show');
        await P.clickQ(checkin);
        expect(await P.textOf(checkin)).toContain('Hide');
        await P.clickQ(checkin);
        expect(await P.textOf(checkin)).toContain('Show');
        if (apptWasOpen) await P.clickQ(appt);
        expect(await P.textOf(appt)).toContain('Show');
        await P.clickQ(appt);
        expect(await P.textOf(appt)).toContain('Hide');
        const n = Number(/\((\d+)\)/.exec(await P.textOf(appt))?.[1] ?? NaN);
        if (n === 0) await P.waitFor(VqcHome.noAppointmentsToday, 5_000, '"No appointments today"');
      } finally {
        if ((await accordionOpen(appt).catch(() => apptWasOpen)) !== apptWasOpen)
          await P.clickQ(appt).catch(() => undefined);
        if ((await accordionOpen(checkin).catch(() => checkinWasOpen)) !== checkinWasOpen) {
          await P.clickQ(checkin).catch(() => undefined);
        }
      }
    },
  );
});
