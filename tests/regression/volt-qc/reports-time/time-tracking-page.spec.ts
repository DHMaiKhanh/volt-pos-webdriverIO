/**
 * volt-qc port — Time Tracking page: filters, search, empty states, lazy
 * loading, and the Add dialog's inputs. Read-only: the Add dialog is opened,
 * inspected and closed — never submitted.
 *
 * Source: volt-qc `e2e/tests/09-time/time-plan-tracking.spec.ts` — TIME-T10,
 * T11 and T15 (`@readonly`). The 3D wheel-picker case was already
 * dropped by volt-qc as not automatable.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { DATE_PRESETS, RptCss, RptText } from '../../../../src/constants/testids.voltqc-reports-time.js';
import { step } from '../../../../src/helpers/steps.js';
import { countText, hasText, parseUsDateTime } from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  addClose,
  addDateText,
  addDays,
  addDialogOpen,
  addOpenStaffCombobox,
  addOptionCount,
  addPickDate,
  addStaffSearch,
  addStaffSearchVisible,
  addTimeInputAttrs,
  addTypeTime,
  mdy,
  noResultsVisible,
  ttCollectRows,
  ttOpen,
  ttOpenAdd,
  ttPickRange,
  ttPreset,
  ttPresetOptions,
  ttRowButtons,
  ttRows,
  ttSearch,
} from '../../../../src/pages/voltqc/reports-time/rptTime.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, note } from './reports-time.helpers.js';
import { browser } from '@wdio/globals';
import { Key } from 'webdriverio';

const at = (base: Date, hh: number, mm = 0): Date => {
  const d = new Date(base);
  d.setHours(hh, mm, 0, 0);
  return d;
};

describe('volt-qc TIME — Time Tracking page (read-only)', () => {
  after(async () => {
    if (await addDialogOpen().catch(() => false)) await addClose().catch(() => undefined);
  });

  it(
    title(
      'Date presets, Custom range, staff search, empty states, no Export button (TIME-047, TIME-048, TIME-049, TIME-050, TIME-103)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);
      const today = new Date();
      await ttOpen();

      await step('TIME-047 every preset is offered; Yesterday lists only yesterday', async () => {
        const opts = await ttPresetOptions();
        for (const p of DATE_PRESETS)
          ensure(opts.includes(p), `Preset "${p}" missing — has ${opts.join(', ')}`);
        await ttPreset('Yesterday');
        const y = mdy(addDays(today, -1));
        for (const r of await ttRows()) ensure(r.dateIn.startsWith(y), `Row Date IN ${r.dateIn} is not ${y}`);
      });

      await step(
        'TIME-048 Custom 7 → 3 days ago lists only that range; "Custom" shows in the list',
        async () => {
          const from = addDays(today, -7);
          const to = addDays(today, -3);
          await ttPickRange(from, to);
          for (const r of await ttRows()) {
            const d = parseUsDateTime(r.dateIn);
            ensure(
              d !== null && d >= at(from, 0) && d <= at(to, 23, 59),
              `Row Date IN ${r.dateIn} is outside the range`,
            );
          }
          expect(await ttPresetOptions()).toContain('Custom');
        },
      );

      await step('TIME-049 search by staff; no match → message', async () => {
        await ttPreset('This Month');
        const first = (await ttRows())[0];
        if (first) {
          await ttSearch(first.staff);
          for (const r of await ttRows()) expect(r.staff.toLowerCase()).toContain(first.staff.toLowerCase());
        } else note('TIME-049: no record this month — only the no-match branch runs');
        await ttSearch('zzz');
        expect(await hasText(RptCss.main, RptText.ttEmpty)).toBe(true);
        expect(
          await hasText(RptCss.main, 'No records found for "zzz". Try a different search or date range.'),
        ).toBe(true);
      });

      await step(
        'TIME-050 a range without data → empty state (01/2020; future days are locked)',
        async () => {
          await ttSearch('');
          await ttPickRange(new Date(2020, 0, 1), new Date(2020, 0, 2));
          expect(await hasText(RptCss.main, RptText.ttEmpty)).toBe(true);
          expect(await hasText(RptCss.main, RptText.ttEmptyRange)).toBe(true);
        },
      );

      await step('TIME-103 there is no Export button', async () => {
        expect(await countText(RptCss.main, /Export/i, 'button')).toBe(0);
      });
    },
  );

  it(
    title(
      'This Year: scrolling loads more rows, # is continuous and rows are unique (TIME-051)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      await ttOpen();
      await ttPreset('This Year');
      const rows = await ttCollectRows();
      if (rows.length <= 15) {
        note(`TIME-051: only ${String(rows.length)} records this year (needs > 15)`);
        this.skip();
      }
      rows.forEach((r, i) => expect(r.no).toBe(String(i + 1)));
      const keys = rows.map((r) => `${r.staff}|${r.dateIn}|${r.createdAt}`);
      expect(new Set(keys).size).toBe(keys.length);
    },
  );

  it(
    title('Records of an Inactive staff are still listed with Edit / Delete (TIME-052)', Tag.REGRESSION),
    async function (this: Mocha.Context) {
      const name = (process.env['VOLT_INACTIVE_NAME'] ?? '').trim();
      if (name === '') {
        note('TIME-052 skipped: VOLT_INACTIVE_NAME (an Inactive staff with old records) is not set');
        this.skip();
      }
      await ttOpen();
      for (const p of ['This Year', 'Last Year']) {
        await ttPreset(p);
        await ttSearch(name);
        const row = (await ttRows()).find((r) => r.staff === name);
        if (row) {
          const buttons = await ttRowButtons(row.index);
          ensure(
            buttons.some((b) => /Edit/.test(b)),
            `No Edit on ${name}'s row: ${buttons.join(', ')}`,
          );
          ensure(
            buttons.some((b) => /Delete/.test(b)),
            `No Delete on ${name}'s row: ${buttons.join(', ')}`,
          );
          return;
        }
      }
      note(`TIME-052: ${name} has no record this year or last year`);
      this.skip();
    },
  );

  it(
    title(
      'Add dialog inputs: staff combobox with search, numeric time input, typed time, date change keeps the time (TIME-067, TIME-071, TIME-073, TIME-074)',
      Tag.REGRESSION,
    ),
    async () => {
      await ttOpen();
      await ttOpenAdd();

      await step('TIME-067 the staff combobox has a search box; no match → "No results found."', async () => {
        await addOpenStaffCombobox();
        expect(await addStaffSearchVisible()).toBe(true);
        ensure((await addOptionCount()) > 0, 'The staff combobox lists no staff');
        await addStaffSearch('zzz');
        expect(await noResultsVisible()).toBe(true);
        await browser.keys([Key.Escape]);
        await browser.waitUntil(addDialogOpen, { timeout: Timeouts.SHORT, interval: 200 });
      });

      await step('TIME-071 the time input is type=time with a numeric keyboard', async () => {
        const a = await addTimeInputAttrs('Date IN');
        expect(a.type).toBe('time');
        expect(a.inputmode).toBe('numeric');
      });

      await step('TIME-073 typing 0930 AM', async () => {
        await addTypeTime('Date IN', '0930A');
        expect((await addTimeInputAttrs('Date IN')).value).toBe('09:30');
      });

      await step('TIME-074 moving Date IN to yesterday keeps 09:30', async () => {
        const y = addDays(new Date(), -1);
        await addPickDate('Date IN', y);
        expect(await addDateText('Date IN')).toBe(mdy(y));
        expect((await addTimeInputAttrs('Date IN')).value).toBe('09:30');
      });

      await addClose();
      expect(await addDialogOpen()).toBe(false);
    },
  );
});
