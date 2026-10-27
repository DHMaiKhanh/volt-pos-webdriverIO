/**
 * volt-qc port — 08 APPOINTMENT board (read-only cases).
 *
 * Source: volt-qc `e2e/tests/08-appointment/appt-plan-board.spec.ts` (APPT-T01a..d, T03a/b,
 * T04, T05a/b/c, T09), `appt-deep.spec.ts` (APPT-D01, D04) and `appt-plan-booking.spec.ts`
 * (APPT-T08b). TC catalogue: docs/qc/volt-qc/windows-regression/08-appointment.md.
 *
 * Board navigation and the Staffs / Statuses filters only. Filters and the
 * remembered date are merchant-local state (localStorage `appointment_filters`,
 * sessionStorage `appointment_filter_date`): every case ends with Reset to
 * Default so the next spec sees the board's defaults.
 *
 * Adaptations: volt-qc pins one staff by name (VOLT_TEST_STAFF); here the staff
 * is the first real staff in the Staffs filter of the merchant under test.
 *
 * Not ported: volt-qc APPT-T02 (the three "no write action on prod" TCs) — it asserts the PROD build has no
 * create-appointment entry; the dev build this suite runs creates appointments
 * (tests/regression/appointment/appointment-create.spec.ts), so the expectation
 * does not hold here.
 */

import { expect } from '@wdio/globals';
import { appNav } from '../../../../src/components/index.js';
import {
  VqcAppointment as A,
  VqcCommon,
  VqcHome,
  inMain,
} from '../../../../src/constants/testids.voltqc-pos.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  DAY_HEIGHT,
  boardDateText,
  boardScroll,
  boardSearch,
  calendarDay,
  cardCount,
  checkedCount,
  clearBoardStorage,
  closePopover,
  columnHeaders,
  dayStart,
  dispatchBoardWheel,
  filterBadge,
  filterCheckbox,
  filterLabels,
  gotoBoard,
  headerAppointmentBadge,
  mdyOf,
  nextDay,
  nonWorkingBlocks,
  nowLine,
  nowLineInViewport,
  onlyStatuses,
  openBoardFromHeader,
  openDatePicker,
  openStaffFilter,
  openStatusFilter,
  pickOtherDayInShownMonth,
  prevDay,
  readBoardStorage,
  resetBoard,
  scrollBoardTo,
  scrollBoardX,
  setStaffChecked,
  staffSearchBox,
  timeLabels,
  unixOf,
  unselectAll,
  waitBoardDate,
} from '../../../../src/pages/voltqc/pos/appointmentProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

/** Board as on first use: no remembered filters or date. */
async function freshBoard(date: Date = new Date()): Promise<void> {
  await returnToHome();
  await gotoBoard(dayStart(0));
  await clearBoardStorage();
  await gotoBoard(date);
}

/** Staff names in the Staffs filter (Unassigned excluded), A→Z as the app lists them. */
async function staffOptions(): Promise<string[]> {
  await openStaffFilter();
  const labels = await filterLabels(A.staffPopover);
  await closePopover();
  return labels.slice(1).filter((l) => l !== 'Unassigned' && l !== '');
}

describe('volt-qc 08 APPOINTMENT — board (read-only)', () => {
  afterEach(async () => {
    await resetBoard().catch(() => undefined);
  });

  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Board opened by URL ?date=<today+7> shows that day; the remembered date is written only by UI navigation (APPT-003)',
      Tag.REGRESSION,
    ),
    async () => {
      const target = dayStart(7);
      await returnToHome();
      await gotoBoard(dayStart(0));
      await clearBoardStorage();
      await returnToHome();
      await gotoBoard(target);
      await step('the board shows the date param', async () => {
        expect(await P.has(inMain({ text: A.overviewTitle, nth: 0 }))).toBe(true);
        expect(await boardDateText()).toBe(mdyOf(target));
        expect((await boardSearch()).date).toBe(unixOf(target));
      });
      await step('opening by URL leaves sessionStorage empty; Next day writes it', async () => {
        expect((await readBoardStorage()).date).toBeNull();
        await nextDay();
        const stored = await P.poll(
          async () => (await readBoardStorage()).date,
          (d) => d === String(unixOf(dayStart(8))),
        );
        expect(stored).toBe(String(unixOf(dayStart(8))));
      });
    },
  );

  it(
    title(
      'Many staff: columns are virtualised horizontally; scrolling to the end shows the last staff (APPT-026)',
      Tag.REGRESSION,
    ),
    async function () {
      await freshBoard();
      const staff = await staffOptions();
      if (staff.length < 9) this.skip(); // needs > 8 active staff
      const h0 = await columnHeaders();
      expect(h0[0]?.name).toBe('Unassigned');
      expect(h0.length).toBeLessThan(staff.length + 1);
      await scrollBoardX('end');
      const last = staff[staff.length - 1] ?? '';
      const names = await P.poll(
        async () => (await columnHeaders()).map((h) => h.name),
        (n) => n.includes(last),
      );
      expect(names).toContain(last);
      expect(names).not.toContain('Unassigned');
      await scrollBoardX('start');
      const first = await P.poll(
        async () => (await columnHeaders())[0]?.name,
        (n) => n === 'Unassigned',
      );
      expect(first).toBe('Unassigned');
    },
  );

  it(
    title(
      'The sidebar has no Appointment entry; ?date= opens the board on that day (APPT-002)',
      Tag.REGRESSION,
    ),
    async () => {
      await returnToHome();
      await appNav.openSidebar();
      const items = ((await P.rawText(VqcCommon.sidebar)) ?? '').split('\n').map((s) => s.trim());
      expect(items).not.toContain('Appointment');
      await P.escape();

      const target = dayStart(15);
      await clearBoardStorage();
      await gotoBoard(target);
      expect(await boardDateText()).toBe(mdyOf(target));
      expect((await boardSearch()).date).toBe(unixOf(target));
    },
  );

  it(
    title(
      'Next / Previous day, picking a day in the calendar, and Now (APPT-010, APPT-011, APPT-012)',
      Tag.REGRESSION,
    ),
    async () => {
      await freshBoard();
      const today = dayStart(0);
      await step('Next day → tomorrow, URL +1 day, sessionStorage updated, no Now line', async () => {
        await nextDay();
        const tomorrow = dayStart(1);
        expect(await waitBoardDate(mdyOf(tomorrow))).toBe(mdyOf(tomorrow));
        expect((await boardSearch()).date).toBe(unixOf(tomorrow));
        expect((await readBoardStorage()).date).toBe(String(unixOf(tomorrow)));
        expect((await nowLine())?.visible ?? false).toBe(false);
      });
      await step('Previous day ×2 → yesterday, sessionStorage updated', async () => {
        await prevDay();
        expect(await waitBoardDate(mdyOf(today))).toBe(mdyOf(today));
        expect((await readBoardStorage()).date).toBe(String(unixOf(today)));
        await prevDay();
        const yesterday = dayStart(-1);
        expect(await waitBoardDate(mdyOf(yesterday))).toBe(mdyOf(yesterday));
        expect((await readBoardStorage()).date).toBe(String(unixOf(yesterday)));
      });
      await step('a day picked in the calendar closes it and moves the board', async () => {
        const picked = await pickOtherDayInShownMonth();
        expect(await waitBoardDate(mdyOf(picked))).toBe(mdyOf(picked));
        expect((await boardSearch()).date).toBe(unixOf(picked));
      });
      await step('Now → today with the Now line in view', async () => {
        await P.clickQ(A.now);
        expect(await waitBoardDate(mdyOf(today))).toBe(mdyOf(today));
        expect(await P.poll(nowLineInViewport, (v) => v, 10_000)).toBe(true);
      });
    },
  );

  it(
    title(
      'Date limits: Previous day disabled on 02/01/1970; days after 02/01/2030 cannot be picked (APPT-013)',
      Tag.REGRESSION,
    ),
    async () => {
      const min = new Date(1970, 1, 1);
      await returnToHome();
      await gotoBoard(min);
      expect(await boardDateText()).toBe('02/01/1970');
      expect(await P.isDisabled(A.prevDay)).toBe(true);

      // The date selector remembers its shown month at mount → leave and come back at the max.
      await returnToHome();
      const max = new Date(2030, 1, 1);
      await gotoBoard(max);
      expect(await boardDateText()).toBe('02/01/2030');
      await openDatePicker();
      expect(await P.attrOf(calendarDay(max), 'data-disabled')).not.toBe('true');
      expect(await P.attrOf(calendarDay(new Date(2030, 1, 2)), 'data-disabled')).toBe('true');
      expect(await P.isDisabled([...calendarDay(new Date(2030, 1, 2)), { css: 'button' }])).toBe(true);
      await closePopover();
    },
  );

  it(
    title(
      'The picked date survives leaving and returning; only Reset / Now go back to today (APPT-016)',
      Tag.REGRESSION,
    ),
    async () => {
      await freshBoard();
      const today = mdyOf(dayStart(0));
      const picked = await pickOtherDayInShownMonth();
      await returnToHome();
      await openBoardFromHeader();
      expect(await waitBoardDate(mdyOf(picked))).toBe(mdyOf(picked));

      await P.clickQ(A.reset);
      expect(await waitBoardDate(today)).toBe(today);

      const picked2 = await pickOtherDayInShownMonth();
      expect(await waitBoardDate(mdyOf(picked2))).toBe(mdyOf(picked2));
      await P.clickQ(A.now);
      expect(await waitBoardDate(today)).toBe(today);
      await returnToHome();
      await openBoardFromHeader();
      expect(await waitBoardDate(today)).toBe(today);
    },
  );

  it(
    title(
      'Staff filter: all ticked by default, search, untick hides the column, Unassigned, Unselect/Select All (APPT-032, APPT-033, APPT-034, APPT-035, APPT-036, APPT-038)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await freshBoard();
      const total = await filterBadge(A.staffsButton);
      const pop = A.staffPopover;
      let staffName = '';

      await step(
        'default popover: badge = options, Unselect All ticked, Unassigned first then A→Z',
        async () => {
          await openStaffFilter();
          expect(await P.has(staffSearchBox)).toBe(true);
          const labels = await filterLabels(pop);
          expect(labels[0]).toBe('Unselect All');
          expect(await P.attrOf([pop, { css: '#select-all-staff' }], 'data-state')).toBe('checked');
          const options = labels.slice(1);
          expect(total).toBe(options.length);
          expect(options[0]).toBe('Unassigned');
          const staff = options.slice(1).map((s) => s.toLowerCase());
          expect(staff).toEqual([...staff].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
          expect(await P.count([pop, { css: '[role="checkbox"][data-state="unchecked"]' }])).toBe(0);
          staffName = options[1] ?? '';

          await P.fillQ(staffSearchBox, 'zzz');
          expect(await P.has([pop, { text: 'No results found.' }])).toBe(true);
          expect(await P.isDisabled([pop, { css: '#select-all-staff' }])).toBe(true);
          await P.fillQ(staffSearchBox, staffName.toLowerCase());
          expect(await P.has(filterCheckbox(pop, staffName))).toBe(true);
          await P.fillQ(staffSearchBox, '');
          await closePopover();
        },
      );
      if (!staffName) this.skip();

      await step('Unselect All → empty state', async () => {
        await openStaffFilter();
        await unselectAll(pop, '#select-all-staff');
        await closePopover();
        await P.waitFor(inMain({ text: A.emptyTitle }), 10_000, A.emptyTitle);
        expect(await P.has(inMain({ text: A.emptyDesc }))).toBe(true);
      });

      await step(
        'only Unassigned + one staff → untick the staff: column gone, badge −1, URL + storage updated',
        async () => {
          await openStaffFilter();
          await P.clickQ(filterCheckbox(pop, 'Unassigned'));
          const staffId = await setStaffChecked(staffName, true);
          await closePopover();
          const both = await P.poll(
            async () => (await columnHeaders()).map((h) => h.name),
            (n) => n.length === 2,
          );
          expect(both).toEqual(['Unassigned', staffName]);
          expect(await filterBadge(A.staffsButton)).toBe(2);

          await openStaffFilter();
          await setStaffChecked(staffName, false);
          await closePopover();
          const one = await P.poll(
            async () => (await columnHeaders()).map((h) => h.name),
            (n) => n.length === 1,
          );
          expect(one).toEqual(['Unassigned']);
          expect(await filterBadge(A.staffsButton)).toBe(1);
          expect((await boardSearch()).staffIds ?? []).not.toContain(staffId);
          const stored = JSON.parse((await readBoardStorage()).filters ?? '{}') as { staffIds?: string[] };
          expect(stored.staffIds ?? []).not.toContain(staffId);
          expect(stored.staffIds ?? []).toContain('unassigned');
        },
      );

      await step('only the staff, Unassigned unticked → Unassigned column hidden', async () => {
        await openStaffFilter();
        await setStaffChecked(staffName, true);
        await P.clickQ(filterCheckbox(pop, 'Unassigned'));
        expect(await P.attrOf(filterCheckbox(pop, 'Unassigned'), 'data-state')).toBe('unchecked');
        await closePopover();
        const only = await P.poll(
          async () => (await columnHeaders()).map((h) => h.name),
          (n) => n.length === 1 && n[0] === staffName,
        );
        expect(only).toEqual([staffName]);
      });

      await step('Select All → every column back, Unassigned first', async () => {
        await openStaffFilter();
        expect(await P.textOf([pop, { css: 'label[for="select-all-staff"]' }])).toBe('Select All');
        await P.clickQ([pop, { css: '#select-all-staff' }]);
        expect(await P.textOf([pop, { css: 'label[for="select-all-staff"]' }])).toBe('Unselect All');
        await closePopover();
        expect(await filterBadge(A.staffsButton)).toBe(total);
        const first = await P.poll(
          async () => (await columnHeaders())[0]?.name,
          (n) => n === 'Unassigned',
        );
        expect(first).toBe('Unassigned');
        expect((await columnHeaders()).length).toBeGreaterThan(2);
      });
    },
  );

  it(
    title(
      'A hidden staff stays hidden after visiting Order History and Pending and coming back (APPT-037)',
      Tag.REGRESSION,
    ),
    async function () {
      await freshBoard();
      const staffName = (await staffOptions())[0];
      if (!staffName) this.skip();
      const total = await filterBadge(A.staffsButton);
      await openStaffFilter();
      const staffId = await setStaffChecked(staffName ?? '', false);
      await closePopover();
      expect(await filterBadge(A.staffsButton)).toBe(total - 1);

      await P.routerGo('/order-history');
      await P.escape(); // a passcode guard here would only cover the screen; Escape sends it to /order-pending
      await P.routerGo('/order-pending');
      await openBoardFromHeader();
      expect(await filterBadge(A.staffsButton)).toBe(total - 1);
      expect((await boardSearch()).staffIds ?? []).not.toContain(staffId);
      await openStaffFilter();
      await P.fillQ(staffSearchBox, staffName ?? '');
      expect(await P.attrOf(filterCheckbox(A.staffPopover, staffName ?? ''), 'data-state')).toBe('unchecked');
      await P.fillQ(staffSearchBox, '');
      await closePopover();
    },
  );

  it(
    title(
      'Status filter + Reset to Default: order, none ticked, Reset clears storage, new filters still persist (APPT-042, APPT-044, APPT-045, APPT-046)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await freshBoard();
      const totalStaff = await filterBadge(A.staffsButton);
      const staffName = (await staffOptions())[0];
      if (!staffName) this.skip();

      await step(
        'Scheduled, Canceled, Confirmed, Done; none ticked → 0 cards, headers still shown',
        async () => {
          await openStatusFilter();
          expect((await filterLabels(A.statusPopover)).slice(1)).toEqual([...A.statusLabels]);
          const ids = (await P.infos([A.statusPopover, { role: 'checkbox' }])).map((i) => i.attrs.id ?? '');
          expect(ids.slice(1)).toEqual([...A.statusIds]);
          await unselectAll(A.statusPopover, '#select-all-status');
          expect(await checkedCount(A.statusPopover)).toBe(0);
          await closePopover();
          expect(await filterBadge(A.statusesButton)).toBe(0);
          expect(await cardCount()).toBe(0);
          expect((await columnHeaders()).length).toBeGreaterThan(0);
        },
      );

      await step(
        'another day + staff hidden + Done only → Reset to Default restores defaults and clears storage',
        async () => {
          await pickOtherDayInShownMonth();
          await openStaffFilter();
          await setStaffChecked(staffName ?? '', false);
          await closePopover();
          await openStatusFilter();
          await P.clickQ(filterCheckbox(A.statusPopover, 'Done'));
          await closePopover();
          expect((await boardSearch()).statuses).toEqual(['done']);

          await P.clickQ(A.reset);
          expect(await waitBoardDate(mdyOf(dayStart(0)))).toBe(mdyOf(dayStart(0)));
          expect(
            await P.poll(
              () => filterBadge(A.staffsButton),
              (n) => n === totalStaff,
            ),
          ).toBe(totalStaff);
          expect(await filterBadge(A.statusesButton)).toBe(3);
          expect([...((await boardSearch()).statuses ?? [])].sort()).toEqual([
            'confirmed',
            'done',
            'scheduled',
          ]);
          const st = await readBoardStorage();
          expect(st.filters).toBeNull();
          expect(st.date).toBeNull();
        },
      );

      await step(
        'after Reset: hide the staff + pick a day → both survive leaving and returning',
        async () => {
          await openStaffFilter();
          const staffId = await setStaffChecked(staffName ?? '', false);
          await closePopover();
          const picked = await pickOtherDayInShownMonth();
          await returnToHome();
          await openBoardFromHeader();
          expect(await waitBoardDate(mdyOf(picked))).toBe(mdyOf(picked));
          expect((await boardSearch()).staffIds ?? []).not.toContain(staffId);
          expect(await filterBadge(A.staffsButton)).toBe(totalStaff - 1);
        },
      );
    },
  );

  it(
    title(
      'Time axis has 96 quarter-hour labels; Unassigned is not hatched; no header badge on a day without appointments (APPT-018, APPT-023, APPT-077)',
      Tag.REGRESSION,
    ),
    async () => {
      await freshBoard();
      const labels = await timeLabels();
      expect(labels.length).toBe(96);
      expect(labels[0]).toBe('12:00 AM');
      expect(labels[1]).toBe('12:15 AM');
      expect(labels[48]).toBe('12:00 PM');
      expect(labels[95]).toBe('11:45 PM');
      for (const l of labels) expect(l).toMatch(/^\d{2}:\d{2} (AM|PM)$/);

      expect((await columnHeaders())[0]?.name).toBe('Unassigned');
      // Known issue on DEV (volt-qc bug #37, regression of VP-2355): Unassigned hatched all day.
      expect(await nonWorkingBlocks(0)).toEqual([]);

      await gotoBoard(new Date(2030, 0, 15));
      expect(await boardDateText()).toBe('01/15/2030');
      expect(await P.poll(headerAppointmentBadge, (n) => n === 0)).toBe(0);
    },
  );

  it(
    title(
      'Scrolling past an edge changes the day (0.8 s cooldown); a gentle scroll on a past day does not (APPT-014, APPT-015)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(3 * 60_000);
      await freshBoard();
      const today = dayStart(0);

      await step('bottom + wheel down → previous day; top + wheel up → next day', async () => {
        const box = await boardScroll();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await scrollBoardTo('bottom');
        await P.wheel(cx, cy, 300);
        expect(await waitBoardDate(mdyOf(dayStart(-1)), 5_000)).toBe(mdyOf(dayStart(-1)));
        expect((await boardScroll()).top).toBeLessThan(20);
        await settle(1_000);
        await scrollBoardTo('top');
        await P.wheel(cx, cy, -300);
        expect(await waitBoardDate(mdyOf(today), 5_000)).toBe(mdyOf(today));
      });

      await step('repeated wheel at the edge inside 0.8 s moves one day only', async () => {
        await settle(1_000);
        await dispatchBoardWheel(100, 'bottom');
        await dispatchBoardWheel(100, 'bottom');
        await dispatchBoardWheel(100, 'bottom');
        expect(await waitBoardDate(mdyOf(dayStart(-1)), 5_000)).toBe(mdyOf(dayStart(-1)));
        await settle(300);
        expect(await boardDateText()).toBe(mdyOf(dayStart(-1)));
        await settle(900);
        await dispatchBoardWheel(100, 'bottom');
        expect(await waitBoardDate(mdyOf(dayStart(-2)), 5_000)).toBe(mdyOf(dayStart(-2)));
      });

      await step('past day: 5 gentle wheels (delta 5) mid-board keep the day', async () => {
        const past = dayStart(-7);
        await gotoBoard(past);
        await scrollBoardTo(DAY_HEIGHT / 2);
        const b = await boardScroll();
        for (let i = 0; i < 5; i += 1) {
          await P.wheel(b.x + b.width / 2, b.y + b.height / 2, 5);
          await settle(150);
        }
        await settle(800);
        expect(await boardDateText()).toBe(mdyOf(past));
      });
    },
  );

  it(
    title('The Now line moves down by itself (~6 px a minute, no reload) (APPT-019)', Tag.REGRESSION),
    async function () {
      this.timeout(3 * 60_000);
      await freshBoard();
      const first = await nowLine();
      if (!first?.visible) this.skip(); // e.g. right at midnight
      // The app repositions the line every 60 s (6 px/min); wait for the next tick.
      const second = await P.poll(nowLine, (l) => (l?.top ?? first?.top) !== first?.top, 75_000);
      const diff = (second?.top ?? Number.NaN) - (first?.top ?? 0);
      expect(diff).toBeGreaterThanOrEqual(3);
      expect(diff).toBeLessThanOrEqual(9);
    },
  );

  it(
    title('Home with no appointment today shows the empty state (APPT-082)', Tag.REGRESSION),
    async function () {
      await returnToHome();
      const header = await P.textOf(VqcHome.appointmentsToday);
      const n = Number(/\((\d+)\)/.exec(header)?.[1] ?? NaN);
      if (n > 0) this.skip(); // the shop already has appointments today
      const wasOpen = /Hide/.test(header);
      if (!wasOpen) await P.clickQ(VqcHome.appointmentsToday);
      try {
        expect(await P.textOf(VqcHome.appointmentsToday)).toContain('Appointments Today (0)');
        await P.waitFor(VqcHome.noAppointmentsToday, 5_000, '"No appointments today"');
      } finally {
        if (!wasOpen) await P.clickQ(VqcHome.appointmentsToday).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Off the board, the header badge follows the saved status filter; Reset restores the default (APPT-079)',
      Tag.REGRESSION,
    ),
    async () => {
      await returnToHome();
      await gotoBoard(dayStart(0));
      await clearBoardStorage();
      await P.routerGo('/order-pending');
      const d0 = await headerAppointmentBadge();

      await gotoBoard(dayStart(0));
      await onlyStatuses(['Done']);
      const bd = await headerAppointmentBadge();
      expect(bd).toBeLessThanOrEqual(d0);

      await P.routerGo('/order-pending');
      expect(await P.poll(headerAppointmentBadge, (n) => n === bd)).toBe(bd);

      await gotoBoard(dayStart(0));
      await P.clickQ(A.reset);
      await settle(800);
      await P.routerGo('/order-pending');
      expect(await P.poll(headerAppointmentBadge, (n) => n === d0)).toBe(d0);
    },
  );
});
