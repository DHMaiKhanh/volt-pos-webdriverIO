/**
 * volt-qc port — Time Keeping dialog (open / close / sort / search / select)
 * and the Time Tracking 30-minute passcode skip. Read-only: no Check In / Out.
 *
 * Source: volt-qc `e2e/tests/09-time/time-plan-keeping.spec.ts` — TIME-T05 and
 * TIME-T08 (`@readonly`). TC catalogue:
 * docs/qc/volt-qc/windows-regression/09-time-keeping.md.
 *
 * volt-qc T08 part 2 (the 30-minute skip of a staff WITHOUT the Time Tracking permission)
 * is not ported: it needs a Staff-role code and the permission matrix, which
 * this suite has no fixture for.
 */

import { expect } from '@wdio/globals';
import { browser } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { RptCss, RptRoutes, RptText } from '../../../../src/constants/testids.voltqc-reports-time.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  closeStrayDialogs,
  gateElement,
  gateTickSkip,
  gateType,
  hasText,
  navigateRaw,
  openReport,
  parseUsDateTime,
  pathname,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  clickHeaderTimeKeeping,
  closeTkWithEscape,
  closeTkWithOverlay,
  closeTkWithX,
  openTimeKeepingByUrl,
  tkActionButtons,
  tkBadge,
  tkClickTile,
  tkNoStaffCount,
  tkSearch,
  tkTiles,
  ttHeadingVisible,
  ttNavigateRaw,
  waitTk,
} from '../../../../src/pages/voltqc/reports-time/rptTime.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { check, ensure, note } from './reports-time.helpers.js';
import { Key } from 'webdriverio';

describe('volt-qc TIME — Time Keeping dialog (read-only)', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await closeTkWithEscape().catch(() => undefined);
    await ensurePasscodeGrant();
    await navigateRaw(RptRoutes.home);
  });

  it(
    title(
      'Open from the header / URL, close 3 ways, column sort, search, empty state, one tile selected at a time (TIME-002, TIME-003, TIME-004, TIME-008, TIME-009, TIME-010, TIME-016, TIME-028)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);

      await step('TIME-002 the header clock opens the dialog on several screens', async () => {
        for (const route of ['/home', '/appointment', '/order-history']) {
          await openReport(route, undefined, { fresh: false });
          const path = await pathname();
          await clickHeaderTimeKeeping();
          expect(await pathname()).toBe(path);
          expect(await browser.getUrl()).toContain('dialog=time-keeping');
          await closeTkWithEscape();
        }
      });

      await step('TIME-003 ?dialog=time-keeping opens it straight away', async () => {
        await navigateRaw(RptRoutes.home);
        await navigateRaw('/order-pending', { dialog: 'time-keeping' });
        expect(await waitTk(true)).toBe(true);
        expect(await pathname()).toMatch(/^\/order-pending/);
        await closeTkWithEscape();
      });

      await step(
        'TIME-004 close with X / Escape / overlay — the dialog param is dropped each time',
        async () => {
          for (const how of ['x', 'escape', 'overlay'] as const) {
            await openTimeKeepingByUrl();
            if (how === 'x') await closeTkWithX();
            else if (how === 'escape') await closeTkWithEscape();
            else await closeTkWithOverlay();
            ensure(await waitTk(false, Timeouts.SHORT), `Dialog did not close with ${how}`);
            expect(await browser.getUrl()).not.toContain('dialog=');
          }
        },
      );

      await openTimeKeepingByUrl();
      const unavailable = await tkTiles('Unavailable');

      await step('TIME-008 Unavailable A→Z; Available by IN time, newest first', async () => {
        const names = unavailable.map((t) => t.name);
        const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        expect(names).toEqual(sorted);
        const times = (await tkTiles('Available')).map(
          (x) => parseUsDateTime(x.text.split(' | ').pop() ?? '')?.getTime() ?? 0,
        );
        if (times.length >= 2) expect(times).toEqual([...times].sort((a, b) => b - a));
        else note('TIME-008: < 2 staff IN — Available order not checked');
      });

      await check('TIME-028 a tile without a valid OUT shows no "Invalid Date"', () => {
        for (const x of unavailable) expect(x.text).not.toContain('Invalid Date');
        const never = unavailable.find((x) => /\| OUT$/.test(x.text));
        note(
          never
            ? `TIME-028: "${never.text}" (OUT blank)`
            : 'TIME-028: no never-clocked staff among rendered tiles',
        );
      });

      await step('TIME-016 select tile A then tile B → only B offers an action', async () => {
        const enabled = unavailable.filter((x) => !x.disabled);
        ensure(enabled.length >= 2, 'Needs ≥ 2 selectable Unavailable tiles');
        await tkClickTile('Unavailable', 0);
        await tkClickTile('Unavailable', 1);
        expect(await tkActionButtons()).toHaveLength(1);
        const sel = (await tkTiles('Unavailable')).filter((x) => x.selected).map((x) => x.name);
        expect(sel).toEqual([enabled[1]?.name ?? '']);
        // Deselect — never check anybody in.
        await tkClickTile('Unavailable', 1);
      });

      await step('TIME-009 search by 3 middle letters, then the upper-case name with spaces', async () => {
        const staff = unavailable.find((x) => !x.disabled && x.name.length > 4)?.name ?? unavailable[0]?.name;
        ensure(staff !== undefined, 'No staff tile to search for');
        const mid = staff.slice(1, 4);
        await tkSearch(mid);
        const all = [...(await tkTiles('Unavailable')), ...(await tkTiles('Available'))].map((x) => x.name);
        expect(all).toContain(staff);
        for (const n of all) expect(n.toLowerCase()).toContain(mid.toLowerCase());
        expect((await tkBadge('Unavailable')) + (await tkBadge('Available'))).toBe(all.length);
        await tkSearch(` ${staff.toUpperCase()} `);
        expect(
          [...(await tkTiles('Unavailable')), ...(await tkTiles('Available'))].map((x) => x.name),
        ).toContain(staff);
      });

      await step('TIME-010 no match → "No staff found." in both columns, badges 0', async () => {
        await tkSearch('zzzqqq');
        expect(await tkNoStaffCount()).toBe(2);
        expect(await tkBadge('Unavailable')).toBe(0);
        expect(await tkBadge('Available')).toBe(0);
        await tkSearch('');
      });
      await closeTkWithEscape();
    },
  );
});

describe('volt-qc TIME — Time Tracking passcode skip (read-only)', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await closeStrayDialogs().catch(() => undefined);
    await ensurePasscodeGrant();
  });

  it(
    title(
      'Owner ticks the 30-minute skip → Time Tracking opens directly next time; clearing it asks again (TIME-038)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await navigateRaw(RptRoutes.home);
      await clearPasscodeGrant();
      await ttNavigateRaw();
      if ((await gateElement(4_000)) === null) {
        note('TIME-038: the Time Tracking passcode gate is off on this merchant');
        this.skip();
      }
      await gateTickSkip();
      await gateType(env.OWNER_PASSCODE);
      await browser.waitUntil(ttHeadingVisible, { timeout: Timeouts.MEDIUM, interval: 250 });

      await ttNavigateRaw();
      expect(await gateElement(2_500)).toBeNull();
      expect(await ttHeadingVisible()).toBe(true);

      await clearPasscodeGrant();
      await ttNavigateRaw();
      ensure((await gateElement(4_000)) !== null, 'Clearing the skip did not bring the gate back');
      expect(await hasText(RptCss.main, RptText.ttEmpty)).toBe(false);
      await browser.keys([Key.Escape]);
    },
  );
});
