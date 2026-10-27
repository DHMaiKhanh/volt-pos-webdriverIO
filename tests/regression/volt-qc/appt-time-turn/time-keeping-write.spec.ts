/**
 * volt-qc port — 09 TIME KEEPING: Check In / Check Out write paths.
 *
 * Source: volt-qc `e2e/tests/09-time/time-plan-keeping.spec.ts` (TIME-T01, T03,
 * T04a, T04b) and `time-deep.spec.ts` (TIME-D03), plus TC rows TIME-001 and
 * TIME-011 of docs/qc/volt-qc/windows-regression/09-time-keeping.md.
 *
 * ## Data safety
 *
 * WRITES ATTENDANCE (and, for TIME-029, one paid cash order). Staff are picked
 * at runtime among those OUT right now — never-clocked-in first, never
 * `STAFF_NAME` (`pickTimeStaff`). Every case ends with `ttCleanup`: Check Out,
 * then delete every Time Tracking record of that staff created during the case.
 *
 * Adaptation: volt-qc pins VOLT_TIME_STAFF; here the staff comes from live data.
 */

import { $, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog, turnBoardDialog } from '../../../../src/components/index.js';
import { timeKeepingDialog } from '../../../../src/components/modal/TimeKeepingDialog.js';
import { payInCash, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { homePage } from '../../../../src/pages/index.js';
import {
  closeTkWithEscape,
  near,
  nearMidnight,
  openTimeKeepingByUrl,
  pickTimeStaff,
  rowsOf,
  showStaff,
  tkTileOf,
  tkToggle,
  ttCleanup,
} from '../../../../src/pages/voltqc/appt-time-turn/timeWrite.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  clickSidebarLink,
  navigateRaw,
  openSidebar,
  parseUsDateTime,
  pathname,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  tkActionButtons,
  tkBadge,
  tkSearch,
  tkTiles,
  waitTk,
} from '../../../../src/pages/voltqc/reports-time/rptTime.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const lastPart = (tileText: string): string => tileText.split(' | ').pop() ?? '';

/** No passcode guard is up (Time Keeping never asks for one). */
async function expectNoPasscode(): Promise<void> {
  expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION)).toBe(false);
}

/** Turn count of a staff on today's board, `null` when the staff is not on it. */
async function turnCountOf(staff: string): Promise<number | null> {
  await turnBoardDialog.open();
  const row = await turnBoardDialog.rowFor(staff);
  await turnBoardDialog.close();
  return row ? row.turnCount : null;
}

describe('volt-qc 09 TIME — Time Keeping Check In / Check Out (write)', () => {
  before(async () => {
    assertWritesAllowed('check staff in and out in Time Keeping');
    await returnToHome();
  });

  afterEach(async () => {
    await closeTkWithEscape().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Sidebar › Time Keeping opens the dialog over /order-pending with the dialog param, no passcode (TIME-001)',
      Tag.REGRESSION,
    ),
    async () => {
      await navigateRaw('/order-pending');
      await openSidebar();
      await clickSidebarLink('Time Keeping');
      expect(await waitTk(true)).toBe(true);
      expect(await pathname()).toMatch(/^\/order-pending/);
      expect(await P.urlParam('dialog')).toBe('time-keeping');
      await expectNoPasscode();
    },
  );

  it(
    title(
      'Many staff: the Unavailable grid is 3 columns and scrolls to later staff (TIME-011)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      await openTimeKeepingByUrl();
      if ((await tkBadge('Unavailable')) <= 9) this.skip(); // needs more than 9 staff in one column
      const before = (await tkTiles('Unavailable')).map((t) => t.name);
      const xs = await P.exec<number[]>(
        'var out = []; document.querySelectorAll(arguments[0]).forEach(function (t) { if (t.getClientRects().length) out.push(Math.round(t.getBoundingClientRect().x)); }); return out;',
        '[data-voltqc-tk="1"] [data-slot="card"] div[class*="h-[108px]"]',
      );
      expect(new Set(xs).size).toBe(3);
      await P.exec<null>(
        'var t = Array.from(document.querySelectorAll(arguments[0])).filter(function (e) { return e.getClientRects().length; }).pop(); ' +
          'var sc = t; while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement; ' +
          'if (sc) sc.scrollTop = sc.scrollHeight; return null;',
        '[data-voltqc-tk="1"] [data-slot="card"] div[class*="h-[108px]"]',
      );
      await settle(600);
      const after = (await tkTiles('Unavailable')).map((t) => t.name);
      expect(after.length).toBeGreaterThan(0);
      expect(after).not.toEqual(before);
      const lastBefore = before[before.length - 1] ?? '';
      const lastAfter = after[after.length - 1] ?? '';
      expect(lastAfter.localeCompare(lastBefore, undefined, { sensitivity: 'base' })).toBeGreaterThanOrEqual(
        0,
      );
    },
  );

  it(
    title(
      'Check In → open record in Time Tracking → Check Out; tile actions, badges, no passcode (TIME-012, TIME-013, TIME-014, TIME-018, TIME-019, TIME-020, TIME-030, TIME-045)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);
      if (nearMidnight()) this.skip();
      const [staff] = await pickTimeStaff(1);
      if (!staff) this.skip();
      const s = staff ?? '';
      const since = Date.now();
      try {
        await returnToHome();
        await openTimeKeepingByUrl();
        await expectNoPasscode();
        const u0 = await tkBadge('Unavailable');
        const a0 = await tkBadge('Available');
        let inAt = 0;

        await step(
          'TIME-019 / TIME-012 Unavailable tile: select → only Check In; tap again → deselected',
          async () => {
            expect((await tkTileOf(s)).column).toBe('Unavailable');
            await timeKeepingDialog.selectCard(s, 'unavailable');
            expect(await tkActionButtons()).toEqual(['Check In']);
            await P.clickQ({ css: '[data-voltqc-tk="1"] div[class*="h-[108px]"]', hasText: s, nth: 0 });
            expect(await tkActionButtons()).toEqual([]);
          },
        );

        await step(
          'TIME-013 Check In → tile moves to Available with IN + now; badges shift by one',
          async () => {
            inAt = Date.now();
            await tkToggle(s, 'Check In');
            await expectNoPasscode();
            const t = await tkTileOf(s);
            expect(t.column).toBe('Available');
            expect(t.text).toMatch(/\| IN \|/);
            expect(near(lastPart(t.text), inAt)).toBe(true);
            await tkSearch('');
            expect(await tkBadge('Unavailable')).toBe(u0 - 1);
            expect(await tkBadge('Available')).toBe(a0 + 1);
          },
        );

        await step('TIME-018 Available tile: only Check Out', async () => {
          await timeKeepingDialog.selectCard(s, 'available');
          expect(await tkActionButtons()).toEqual(['Check Out']);
          await closeTkWithEscape();
        });

        await step(
          'TIME-014 / TIME-045 Time Tracking (Today): open record, Date OUT "-", Total Hours "—"',
          async () => {
            await showStaff(s, 'Today');
            const row = (await rowsOf(s)).find((r) => near(r.dateIn, inAt));
            expect(row).toBeDefined();
            expect(row?.dateOut).toBe('-');
            expect(row?.total).toBe('—');
          },
        );

        await step(
          'TIME-020 Check Out → tile back to Unavailable with OUT + now; record has Date OUT, ~0 h',
          async () => {
            await returnToHome();
            const outAt = Date.now();
            await tkToggle(s, 'Check Out');
            await expectNoPasscode();
            const t = await tkTileOf(s);
            expect(t.column).toBe('Unavailable');
            expect(t.text).toMatch(/\| OUT \|/);
            expect(near(lastPart(t.text), outAt)).toBe(true);
            await closeTkWithEscape();
            await showStaff(s, 'Today');
            const row = (await rowsOf(s)).find((r) => near(r.dateIn, inAt));
            expect(row).toBeDefined();
            expect(near(row?.dateOut ?? '', outAt)).toBe(true);
            expect(Number(row?.total)).toBeGreaterThanOrEqual(0);
            expect(Number(row?.total)).toBeLessThan(0.2);
          },
        );

        await step('TIME-030 no step asked for a passcode', expectNoPasscode);
      } finally {
        await ttCleanup([s], since);
      }
    },
  );

  it(
    title('Two shifts in one day are two separate closed records (TIME-021)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);
      if (nearMidnight()) this.skip();
      const [staff] = await pickTimeStaff(1);
      if (!staff) this.skip();
      const s = staff ?? '';
      const since = Date.now();
      try {
        await returnToHome();
        for (let i = 0; i < 2; i += 1) {
          await tkToggle(s, 'Check In');
          await settle(1_500);
          await tkToggle(s, 'Check Out');
        }
        await closeTkWithEscape();
        await showStaff(s, 'Today');
        const cut = Math.floor(since / 60_000) * 60_000 - 60_000;
        const mine = (await rowsOf(s)).filter((r) => (parseUsDateTime(r.createdAt)?.getTime() ?? 0) >= cut);
        expect(mine).toHaveLength(2);
        for (const r of mine) expect(r.dateOut).not.toBe('-');
      } finally {
        await ttCleanup([s], since);
      }
    },
  );

  it(
    title('Double-clicking Check In creates one record only (TIME-017)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      if (nearMidnight()) this.skip();
      const [staff] = await pickTimeStaff(1);
      if (!staff) this.skip();
      const s = staff ?? '';
      const since = Date.now();
      try {
        await returnToHome();
        await openTimeKeepingByUrl();
        await timeKeepingDialog.selectCard(s, 'unavailable');
        // Known issue on DEV (volt-qc): every press posts a new uuid — no double-submit guard.
        const btn = await $('//*[@data-voltqc-tk="1"]//button[normalize-space(.)="Check In"]').getElement();
        await btn.doubleClick();
        await settle(3_000);
        await closeTkWithEscape();
        await showStaff(s, 'Today');
        const cut = Math.floor(since / 60_000) * 60_000 - 60_000;
        const open = (await rowsOf(s)).filter(
          (r) => r.dateOut === '-' && (parseUsDateTime(r.createdAt)?.getTime() ?? 0) >= cut,
        );
        expect(open).toHaveLength(1);
      } finally {
        await ttCleanup([s], since);
      }
    },
  );

  it(
    title(
      'Two staff: Check In in turn → badges, "IN | time" tiles, newer first; two open shifts; Check Out → "OUT | time" and a closed record (TIME-005, TIME-008, TIME-013, TIME-045)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(6 * 60_000);
      if (nearMidnight()) this.skip();
      const staff = await pickTimeStaff(2);
      if (staff.length < 2) this.skip();
      const [a = '', b = ''] = staff;
      const since = Date.now();
      const nearNow = (t: string): boolean =>
        Math.abs((parseUsDateTime(t)?.getTime() ?? 0) - Date.now()) < 3 * 60_000;
      try {
        await returnToHome();
        await openTimeKeepingByUrl();
        const u0 = await tkBadge('Unavailable');
        const a0 = await tkBadge('Available');
        let aInAt = 0;

        await step(
          'TIME-013 Check In A → badges −1 / +1; tile "A | IN | MM/dd/yyyy hh:mm a"; A first in Available',
          async () => {
            await tkToggle(a, 'Check In');
            aInAt = Date.now();
            await tkSearch('');
            const badges = await P.poll(
              async () => [await tkBadge('Unavailable'), await tkBadge('Available')],
              (v) => v[0] === u0 - 1 && v[1] === a0 + 1,
              10_000,
            );
            expect(badges).toEqual([u0 - 1, a0 + 1]);
            const t = await tkTileOf(a);
            expect(t.text).toMatch(/\| IN \| \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} [AP]M$/);
            expect(nearNow(lastPart(t.text))).toBe(true);
            await tkSearch('');
            expect((await tkTiles('Available'))[0]?.name).toBe(a);
          },
        );

        await step(
          'TIME-005 layout: Search staff box, a badge per column, 220×108 tiles with name + IN/OUT + time',
          async () => {
            expect(await P.has({ css: '[data-voltqc-tk="1"] input[placeholder="Search staff"]' })).toBe(true);
            for (const k of ['Unavailable', 'Available'] as const)
              expect(Number.isFinite(await tkBadge(k))).toBe(true);
            await tkSearch(a);
            const box = await P.info({
              css: '[data-voltqc-tk="1"] div[class*="h-[108px]"]',
              hasText: a,
              nth: 0,
            });
            expect(Math.round(box?.rect.h ?? 0)).toBe(108);
            expect(Math.round(box?.rect.w ?? 0)).toBe(220);
          },
        );

        await step(
          'TIME-008 Check In B after A → B before A in Available; Unavailable stays A→Z',
          async () => {
            await settle(Math.max(0, aInAt + 1_100 - Date.now()));
            await tkToggle(b, 'Check In');
            await tkSearch('');
            expect(
              await P.poll(
                () => tkBadge('Available'),
                (n) => n === a0 + 2,
                10_000,
              ),
            ).toBe(a0 + 2);
            const av = (await tkTiles('Available')).map((t) => t.name);
            expect(av.indexOf(b)).toBeGreaterThanOrEqual(0);
            expect(av.indexOf(b)).toBeLessThan(av.indexOf(a));
            const un = (await tkTiles('Unavailable')).map((t) => t.name);
            expect(un).toEqual(
              [...un].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' })),
            );
            await closeTkWithEscape();
          },
        );

        await step('TIME-045 Time Tracking: both shifts open — Date OUT "-", Total Hours "—"', async () => {
          for (const who of [a, b]) {
            await showStaff(who, 'Today');
            const open = (await rowsOf(who)).find((r) => r.dateOut === '-');
            expect(open).toBeDefined();
            expect(open?.total).toBe('—');
            expect(nearNow(open?.dateIn ?? '')).toBe(true);
          }
        });

        await step(
          'TIME-005 Check Out A → "A | OUT | time" in Unavailable; the record has Date OUT and numeric hours',
          async () => {
            await returnToHome();
            await tkToggle(a, 'Check Out');
            const t = await tkTileOf(a);
            expect(t.column).toBe('Unavailable');
            expect(t.text).toMatch(/\| OUT \| \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} [AP]M$/);
            expect(nearNow(lastPart(t.text))).toBe(true);
            await closeTkWithEscape();
            await showStaff(a, 'Today');
            const row = (await rowsOf(a)).find((r) => nearNow(r.dateIn));
            expect(row).toBeDefined();
            expect(row?.dateOut).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} [AP]M$/);
            expect(row?.total).toMatch(/^\d+(\.\d{1,2})?$/);
          },
        );
      } finally {
        await ttCleanup([a, b], since);
      }
    },
  );

  it(
    title(
      'Attendance vs orders: a staff not IN can still take a service; once IN they are on the Turn board and a paid order raises their turn (TIME-015, TIME-027, TIME-029)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(8 * 60_000);
      if (nearMidnight()) this.skip();
      const [staff] = await pickTimeStaff(1);
      if (!staff) this.skip();
      const s = staff ?? '';
      const since = Date.now();
      try {
        await step('TIME-027 a staff who is OUT can be put on an order; no attendance warning', async () => {
          await returnToHome();
          await homePage.searchStaff(s);
          await homePage.selectStaffByIndex(0);
          await homePage.addFirstService();
          expect(await homePage.hasActiveDraft()).toBe(true);
          expect(await P.has({ role: 'dialog', hasTextRe: 'clock|check in|Time Keeping', flags: 'i' })).toBe(
            false,
          );
          await homePage.deleteOrder();
          await homePage.searchStaff('');
        });

        let n0 = 0;
        await step('TIME-015 after Check In the staff is on the Turn board', async () => {
          await returnToHome();
          await tkToggle(s, 'Check In');
          await closeTkWithEscape();
          // volt-qc bug #33: after 12:00 PM CT "today" on the board can be empty (host timezone).
          const n = await P.poll(
            () => turnCountOf(s),
            (v) => v !== null,
            30_000,
          );
          expect(n).not.toBeNull();
          n0 = n ?? 0;
        });

        await step('TIME-029 a paid order of the IN staff raises their turn count', async () => {
          await returnToHome();
          await homePage.searchStaff(s);
          await homePage.selectStaffByIndex(0);
          await homePage.addFirstService();
          const checkout = await homePage.pressPay();
          await payInCash(await checkout.orderId());
          await returnToHome();
          const n = await P.poll(
            async () => (await turnCountOf(s)) ?? 0,
            (v) => v > n0,
            60_000,
          );
          expect(n).toBeGreaterThan(n0);
        });
      } finally {
        await returnToHome().catch(() => undefined);
        await ttCleanup([s], since);
      }
    },
  );
});
