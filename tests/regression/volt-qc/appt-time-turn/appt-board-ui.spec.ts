/**
 * volt-qc port — 08 APPOINTMENT board: entry, defaults, no-write surface,
 * persistence, offline, Vietnamese and Dark mode.
 *
 * Source: volt-qc `e2e/tests/08-appointment/appt-plan-board.spec.ts` (APPT-T02,
 * APPT-T26) plus TC rows of docs/qc/volt-qc/windows-regression/08-appointment.md
 * that the read-only port (tests/regression/volt-qc/pos/appointment.spec.ts)
 * left out: APPT-001, 009, 017, 039, 047, 112, 113.
 *
 * Build 1.1.56 renders no create form, so the "no write action" rows
 * (APPT-004/005/008) hold on this dev build as on prod.
 *
 * Adaptations: an app restart (APPT-017, APPT-047) is simulated by dropping the
 * sessionStorage date — the only state a new WebView session loses — and
 * re-entering from the header; a real relaunch would re-run the splash boot.
 * Offline (APPT-112) is faked with `navigator.onLine` + an `offline` event.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { VqaAppt as Q } from '../../../../src/constants/testids.voltqc-appt-time-turn.js';
import { VqcAppointment as A, VqcCommon, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { goToSettings, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { settingsPage } from '../../../../src/pages/index.js';
import {
  boardCards,
  clickBoardAt,
  closeAppointmentsToday,
  hatchedBlocks,
  openAppointmentsToday,
  setStatusChecked,
} from '../../../../src/pages/voltqc/appt-time-turn/apptBoard.js';
import {
  ROW_PX_PER_MIN,
  boardDateText,
  boardScroll,
  boardSearch,
  clearBoardStorage,
  closePopover,
  columnHeaders,
  dayStart,
  filterBadge,
  filterCheckbox,
  filterLabels,
  gotoBoard,
  mdyOf,
  nextDay,
  nowLine,
  openBoardFromHeader,
  openStaffFilter,
  openStatusFilter,
  pickOtherDayInShownMonth,
  readBoardStorage,
  resetBoard,
  setStaffChecked,
  unixOf,
  unselectAll,
  waitBoardDate,
} from '../../../../src/pages/voltqc/pos/appointmentProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { fakeOnline } from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import { Tag, title } from '../../../../src/types/testTags.js';

async function freshBoard(date: Date = new Date()): Promise<void> {
  await returnToHome();
  await gotoBoard(dayStart(0));
  await clearBoardStorage();
  await gotoBoard(date);
}

describe('volt-qc 08 APPOINTMENT — board entry, defaults and surface', () => {
  afterEach(async () => {
    await P.escape().catch(() => undefined);
    await resetBoard().catch(() => undefined);
  });

  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      "Header Appointment link opens today's board without a passcode; init adds staffIds + statuses to the URL (APPT-001)",
      Tag.REGRESSION,
    ),
    async () => {
      await returnToHome();
      await gotoBoard(dayStart(0));
      await clearBoardStorage();
      await P.routerGo('/order-pending');
      await P.escape();
      await P.clickQ(VqcCommon.headerAppointmentLink);
      await settle(800);
      expect(await P.has(VqcCommon.passcodeDialog)).toBe(false);
      await P.waitFor(A.prevDay, 20_000, 'board');
      const s = await P.poll(
        boardSearch,
        (v) => v.staffIds !== undefined && v.statuses !== undefined,
        20_000,
      );
      expect(await P.path()).toBe('/appointment');
      expect(s.date).toBe(unixOf(dayStart(0)));
      expect(s.staffIds).toBeDefined();
      expect(s.statuses).toBeDefined();
      expect(await P.has(inMain({ text: A.overviewTitle, nth: 0 }))).toBe(true);
      expect(await boardDateText()).toBe(mdyOf(dayStart(0)));
    },
  );

  it(
    title(
      'Default board is today with the red Now line scrolled to about the middle (APPT-009)',
      Tag.REGRESSION,
    ),
    async function () {
      await freshBoard();
      expect(await boardDateText()).toBe(mdyOf(dayStart(0)));
      const line = await P.poll(nowLine, (l) => !!l?.visible, 10_000);
      if (!line?.visible) this.skip(); // e.g. exactly at midnight
      const now = new Date();
      const expectedTop = (now.getHours() * 60 + now.getMinutes()) * ROW_PX_PER_MIN;
      expect(Math.abs((line?.top ?? 0) - expectedTop)).toBeLessThanOrEqual(3 * ROW_PX_PER_MIN);
      const box = await boardScroll();
      const y = await P.poll(
        async () => (await nowLine())?.y ?? -1,
        (v) => v >= box.y && v <= box.y + box.height,
        10_000,
      );
      // Auto-scroll centres the line; at the very start / end of the day it is clamped by the scroller.
      const dayMin = now.getHours() * 60 + now.getMinutes();
      if (dayMin > 120 && dayMin < 22 * 60) {
        expect(Math.abs(y - (box.y + box.height / 2))).toBeLessThan(box.height * 0.35);
      } else {
        expect(y).toBeGreaterThanOrEqual(box.y);
      }
    },
  );

  it(
    title(
      'A new session (no sessionStorage date) opens the board on today even if another day was picked (APPT-017)',
      Tag.REGRESSION,
    ),
    async () => {
      await freshBoard();
      const picked = await pickOtherDayInShownMonth();
      expect(await waitBoardDate(mdyOf(picked))).toBe(mdyOf(picked));
      expect((await readBoardStorage()).date).toBe(String(unixOf(picked)));
      await returnToHome();
      await P.sessionRemove(A.dateKey); // what a relaunched WebView no longer has
      await openBoardFromHeader();
      expect(await waitBoardDate(mdyOf(dayStart(0)))).toBe(mdyOf(dayStart(0)));
    },
  );

  it(
    title(
      'Staff / status filters persist per device across sessions, the date does not (APPT-047)',
      Tag.REGRESSION,
    ),
    async function () {
      await freshBoard();
      await openStaffFilter();
      const labels = (await filterLabels(A.staffPopover))
        .slice(1)
        .filter((l) => l !== '' && l !== 'Unassigned');
      await closePopover();
      const staffName = labels[0];
      if (!staffName) this.skip();
      await openStaffFilter();
      const staffId = await setStaffChecked(staffName ?? '', false);
      await closePopover();
      await setStatusChecked('Canceled', true);
      await pickOtherDayInShownMonth();

      const stored = JSON.parse((await readBoardStorage()).filters ?? '{}') as {
        staffIds?: string[];
        statuses?: string[];
      };
      expect(stored.staffIds ?? []).not.toContain(staffId);
      expect(stored.statuses ?? []).toContain('canceled');

      await returnToHome();
      await P.sessionRemove(A.dateKey);
      await openBoardFromHeader();
      expect(await waitBoardDate(mdyOf(dayStart(0)))).toBe(mdyOf(dayStart(0)));
      const s = await boardSearch();
      expect(s.staffIds ?? []).not.toContain(staffId);
      expect(s.statuses ?? []).toContain('canceled');
      expect(await filterBadge(A.statusesButton)).toBe(4);
    },
  );

  it(
    title(
      'Default status filter: Scheduled, Confirmed, Done ticked, Canceled not; no Canceled card on the board (APPT-039)',
      Tag.REGRESSION,
    ),
    async () => {
      await freshBoard();
      expect(await filterBadge(A.statusesButton)).toBe(3);
      expect([...((await boardSearch()).statuses ?? [])].sort()).toEqual(['confirmed', 'done', 'scheduled']);
      await openStatusFilter();
      for (const l of ['Scheduled', 'Confirmed', 'Done']) {
        expect(await P.attrOf(filterCheckbox(A.statusPopover, l), 'data-state')).toBe('checked');
      }
      expect(await P.attrOf(filterCheckbox(A.statusPopover, 'Canceled'), 'data-state')).toBe('unchecked');
      await closePopover();
      for (let d = 0; d < 3; d += 1) {
        if (d > 0) await nextDay();
        expect((await boardCards()).filter((c) => c.status === 'Canceled')).toEqual([]);
      }
    },
  );

  it(
    title(
      'No create entry: no create button, an empty slot / hatched block opens nothing, Home Appointments Today has no add (APPT-004, APPT-005, APPT-008)',
      Tag.REGRESSION,
    ),
    async () => {
      await freshBoard();
      await step('board header: no Create / New Appointment', async () => {
        expect(await P.count(Q.createTestid)).toBe(0);
        expect(await P.has(inMain({ textRe: Q.createTextRe }))).toBe(false);
      });

      await step('tomorrow: click an empty slot around 2:00 PM and a hatched block → no dialog', async () => {
        await nextDay();
        const headers = await columnHeaders();
        const colIndex = headers.length > 1 ? 1 : 0;
        let clicked = false;
        for (const minute of [14 * 60, 14 * 60 + 30, 15 * 60, 13 * 60 + 30, 16 * 60]) {
          if ((clicked = await clickBoardAt(colIndex, minute))) break;
        }
        expect(clicked).toBe(true);
        await settle(800);
        expect(await P.count(Q.anyDialog)).toBe(0);

        const blocks = await hatchedBlocks(colIndex);
        const b = blocks[0];
        if (b) {
          const minute = Math.round((b.top + Math.min(b.height, 120) / 2) / ROW_PX_PER_MIN);
          expect(await clickBoardAt(colIndex, minute)).toBe(true);
          await settle(800);
          expect(await P.count(Q.anyDialog)).toBe(0);
          expect(await P.has({ textRe: Q.cannotScheduleRe })).toBe(false);
        }
      });

      await step('Home › Appointments Today: no add / create button', async () => {
        await resetBoard();
        await openAppointmentsToday();
        try {
          expect(await P.count(Q.createTestid)).toBe(0);
          expect(await P.has(inMain({ textRe: Q.createTextRe }))).toBe(false);
        } finally {
          await closeAppointmentsToday().catch(() => undefined);
        }
      });
    },
  );

  it(
    title(
      'Offline: the board still renders, changes day and opens a popover from local data (APPT-112)',
      Tag.REGRESSION,
    ),
    async () => {
      await freshBoard();
      await fakeOnline(false);
      try {
        await nextDay();
        expect(await waitBoardDate(mdyOf(dayStart(1)))).toBe(mdyOf(dayStart(1)));
        await nextDay();
        expect(await waitBoardDate(mdyOf(dayStart(2)))).toBe(mdyOf(dayStart(2)));
        expect(await P.has({ text: VqcCommon.errorText })).toBe(false);
        expect((await columnHeaders()).length).toBeGreaterThan(0);
        const cards = await boardCards();
        if (cards[0]) {
          await P.clickQ(Q.card(0)).catch(async () => P.jsClickQ(Q.card(0)));
          expect(
            await P.poll(
              () => P.has(Q.popover),
              (v) => v,
              8_000,
            ),
          ).toBe(true);
          await P.escape();
        }
      } finally {
        await fakeOnline(true);
      }
    },
  );

  it(
    title(
      'Vietnamese: board heading, Now, Staffs, Statuses, Reset and empty state are translated (APPT-113)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      assertWritesAllowed('switch the merchant UI language to Vietnamese and back');
      await returnToHome();
      await goToSettings();
      await settingsPage.chooseLanguage('vi');
      try {
        await returnToHome();
        await P.sessionRemove(A.dateKey);
        await P.routerGo('/appointment', { date: unixOf(dayStart(0)) });
        await P.poll(boardSearch, (s) => s.staffIds !== undefined, 20_000);
        await settle(800);
        const main = await P.pageText('main');
        for (const label of [Q.vi.overview, Q.vi.now, Q.vi.staffs, Q.vi.statuses, Q.vi.reset])
          expect(main).toContain(label);
        for (const en of ['Appointment Overview', 'Reset to Default', 'Statuses'])
          expect(main).not.toContain(en);
        await openStaffFilter();
        await unselectAll(A.staffPopover, '#select-all-staff');
        await closePopover();
        await P.waitFor(inMain({ text: Q.vi.empty }), 10_000, Q.vi.empty);
        await P.clickQ(A.reset);
        await settle(800);
      } finally {
        await goToSettings();
        await settingsPage.chooseLanguage('en');
        await returnToHome();
      }
    },
  );

  it(
    title(
      'Dark mode: Unassigned badge contrast ≥ 4.5:1, hatching still drawn, cards not white (APPT-115)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
    ),
    async function () {
      await returnToHome();
      await P.routerGo('/settings/accessibility');
      await settle(1_000);
      if (!(await P.has(Q.themeRadio('dark')))) this.skip(); // Dark mode not shipped on this build (VP-3817)
      const wasDark = await P.exec<boolean>("return document.documentElement.classList.contains('dark');");
      try {
        await P.clickQ(Q.themeRadio('dark'));
        expect(
          await P.poll(
            () => P.exec<boolean>("return document.documentElement.classList.contains('dark');"),
            (v) => v,
            5_000,
          ),
        ).toBe(true);
        await freshBoard();
        const look = await P.exec<{ ratio: number; hatch: number; cardBg: number[] | null }>(`
          var toRgb = function (c) { var cv = document.createElement('canvas'); cv.width = cv.height = 1; var x = cv.getContext('2d');
            x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1); var d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
          var lum = function (p) { var f = function (v) { var s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
            return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); };
          var cells = Array.prototype.slice.call(document.querySelectorAll('main div.sticky.top-0.z-60 > div > div'));
          var un = cells.find(function (c) { return /Unassigned/.test(c.textContent || ''); });
          var badge = un ? un.querySelector('span.rounded-full') : null;
          var ratio = 0;
          if (badge) { var cs = getComputedStyle(badge); var a = lum(toRgb(cs.color)), b = lum(toRgb(cs.backgroundColor));
            ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
          var hatch = Array.prototype.filter.call(document.querySelectorAll('main div'), function (d) {
            return (d.style.backgroundImage || '').indexOf('repeating-linear-gradient') >= 0; }).length;
          var card = document.querySelector('main [data-appointment-card] > div');
          return { ratio: ratio, hatch: hatch, cardBg: card ? toRgb(getComputedStyle(card).backgroundColor) : null };
        `);
        expect(look.ratio).toBeGreaterThanOrEqual(4.5);
        expect(look.hatch).toBeGreaterThan(0);
        if (look.cardBg) expect(look.cardBg).not.toEqual([255, 255, 255]);
      } finally {
        if (!wasDark) {
          await P.routerGo('/settings/accessibility').catch(() => undefined);
          await P.clickQ(Q.themeRadio('light')).catch(() => undefined);
        }
      }
    },
  );
});
