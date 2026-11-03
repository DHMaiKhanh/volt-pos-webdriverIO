/**
 * VP-2105 — Order History date-range popover: the two side-by-side calendars no longer
 * repeat boundary days, a selected boundary day is painted in ONE calendar, and Apply
 * still filters correctly.
 *
 * TC catalogue: docs/qc/volt-qc/vp-tickets/VP-2105-order-history-date-range-calendar-test-cases.md
 * (TC-VP2105-01…10). PR volt-pos#3210. The older one-case check is OH-049 in
 * tests/regression/volt-qc/pos/order-history.spec.ts.
 *
 * Read-only: opens Order History, pages the calendars and applies ranges — no order is
 * created or edited. The fixed months (6/2026, 9–10/2026, 12/2025–1/2026, 2–3/2026) are in
 * the past for any run on or after 2026-11-02.
 *
 * Rows show the COMPLETION date while the range filters on CREATION, so a row is only
 * wrong when its date is BEFORE the range start (a reopened order may complete later).
 */

import { expect } from '@wdio/globals';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import {
  dateRangeText,
  dayCellCounts,
  mdy,
  openDatePicker,
  parseMdy,
  rowDates,
  startOfDay,
} from '../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  applyPopover,
  calendars,
  cancelPopover,
  clickDay,
  foreignDays,
  isPopoverOpen,
  openHistoryList,
  selectRangeInPopover,
  selectedDays,
  sharedKeys,
  showMonths,
  todayPopover,
  type CalInfo,
} from './vp-2105-date-range.helpers.js';

const JUN15 = new Date(2026, 5, 15);
const JUN30 = new Date(2026, 5, 30);
const SEP28 = new Date(2026, 8, 28);
const OCT03 = new Date(2026, 9, 3);
const DEC29_25 = new Date(2025, 11, 29);
const JAN04_26 = new Date(2026, 0, 4);
const FEB_26 = new Date(2026, 1, 1);

/** Every calendar paints only its own month, and no day key sits in both. */
function expectNoOverlap(cals: readonly CalInfo[]): void {
  expect(cals).toHaveLength(2);
  for (const c of cals) {
    expect(c.month).toBeGreaterThanOrEqual(0);
    expect(foreignDays(c).map((d) => d.key)).toEqual([]);
  }
  expect(sharedKeys(cals)).toEqual([]);
}

/** No listed order completed before `from`. */
async function expectRowsFrom(from: Date): Promise<void> {
  for (const s of await rowDates()) expect(parseMdy(s) >= startOfDay(from)).toBe(true);
}

describe('VP-2105 — Order History date range: no duplicate / overlapping days', () => {
  before(async () => {
    await returnToHome();
    await openHistoryList();
  });

  afterEach(async function () {
    // TC-03 → TC-04 → TC-05 continue on the same open popover.
    if (/TC-VP2105-0[34]:/.test(this.currentTest?.title ?? '') && this.currentTest?.state === 'passed')
      return;
    await cancelPopover().catch(() => P.escape().catch(() => undefined));
  });

  after(async () => {
    await cancelPopover().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  describe('1. Two calendars', () => {
    it(title('TC-VP2105-01: POS version carries the fix (Menu › Version Update) — PENDING (doc-only)'));

    it(
      title(
        'TC-VP2105-02: default popover — each calendar shows only its own month, no shared day',
        Tag.REGRESSION,
      ),
      async () => {
        await openHistoryList();
        await openDatePicker();
        const cals = await calendars();
        expectNoOverlap(cals);
        const [l, r] = cals;
        // The right calendar is the month after the left one.
        if (l && r) expect(r.year * 12 + r.month - (l.year * 12 + l.month)).toBe(1);
      },
    );

    it(
      title(
        'TC-VP2105-03: Jun 15 → Jun 30 2026 on June / July — Jun 29/30 only in June, July starts on the 1st',
        Tag.REGRESSION,
      ),
      async () => {
        await openHistoryList();
        await selectRangeInPopover(JUN15, JUN15, JUN30);
        const cals = await calendars();
        expectNoOverlap(cals);
        const [jun, jul] = cals;
        expect(jun?.caption).toMatch(/June 2026/);
        expect(jul?.caption).toMatch(/July 2026/);
        for (const d of [29, 30]) {
          expect(jun?.days.some((x) => x.day === d && x.month === 5)).toBe(true);
          expect(jul?.days.some((x) => x.month === 5 && x.day === d)).toBe(false);
        }
        expect(jul?.days[0]?.key).toBe('2026-07-01');
        expect((await dayCellCounts(JUN30)).shown).toBe(1);
      },
    );

    it(
      title(
        'TC-VP2105-04: the range end Jun 30 is painted once — only in June; July paints nothing',
        Tag.REGRESSION,
      ),
      async () => {
        if (!(await isPopoverOpen())) {
          await openHistoryList();
          await selectRangeInPopover(JUN15, JUN15, JUN30);
        }
        expect((await dayCellCounts(JUN30)).lit).toBe(1);
        const [jun, jul] = await calendars();
        expect(jun?.days.find((d) => d.key === '2026-06-30')?.rangeEnd).toBe(true);
        expect(selectedDays(jul)).toEqual([]);
        expect(selectedDays(jun)).toEqual(Array.from({ length: 16 }, (_, i) => 15 + i));
      },
    );

    it(
      title('TC-VP2105-05: Apply 06/15/2026 – 06/30/2026 filters the list to the range', Tag.REGRESSION),
      async () => {
        if (!(await isPopoverOpen())) {
          await openHistoryList();
          await selectRangeInPopover(JUN15, JUN15, JUN30);
        }
        await applyPopover();
        expect(await dateRangeText()).toMatch(new RegExp(`${mdy(JUN15)} - ${mdy(JUN30)}`));
        await expectRowsFrom(JUN15);
      },
    );

    it(
      title(
        'TC-VP2105-06: reopening after Apply shows June / July with the range kept, painted only in June',
        Tag.REGRESSION,
      ),
      async () => {
        if (!(await dateRangeText()).includes(`${mdy(JUN15)} - ${mdy(JUN30)}`)) {
          await openHistoryList();
          await selectRangeInPopover(JUN15, JUN15, JUN30);
          await applyPopover();
        }
        await openDatePicker();
        const cals = await calendars();
        expectNoOverlap(cals);
        const [jun, jul] = cals;
        expect(jun?.caption).toMatch(/June 2026/);
        expect(jul?.caption).toMatch(/July 2026/);
        expect(selectedDays(jun)).toEqual(Array.from({ length: 16 }, (_, i) => 15 + i));
        expect(selectedDays(jul)).toEqual([]);
        expect((await dayCellCounts(JUN30)).lit).toBe(1);
      },
    );
  });

  describe('2. Across months, years, short months', () => {
    it(
      title(
        'TC-VP2105-07: Sep 28 → Oct 3 2026 across both calendars — each paints its own days; Apply filters',
        Tag.REGRESSION,
      ),
      async () => {
        await openHistoryList();
        await selectRangeInPopover(SEP28, SEP28, OCT03);
        const cals = await calendars();
        expectNoOverlap(cals);
        const [sep, oct] = cals;
        expect(sep?.caption).toMatch(/September 2026/);
        expect(oct?.caption).toMatch(/October 2026/);
        expect(selectedDays(sep)).toEqual([28, 29, 30]);
        expect(selectedDays(oct)).toEqual([1, 2, 3]);
        expect((await dayCellCounts(SEP28)).shown).toBe(1);
        expect((await dayCellCounts(OCT03)).lit).toBe(1);
        await step('Apply', async () => {
          await applyPopover();
          expect(await dateRangeText()).toMatch(new RegExp(`${mdy(SEP28)} - ${mdy(OCT03)}`));
          await expectRowsFrom(SEP28);
        });
      },
    );

    it(
      title(
        'TC-VP2105-08: Dec 29 2025 → Jan 4 2026 across the year — each calendar its own month, days painted in their own calendar',
        Tag.REGRESSION,
      ),
      async () => {
        await openHistoryList();
        await selectRangeInPopover(DEC29_25, DEC29_25, JAN04_26);
        const cals = await calendars();
        expectNoOverlap(cals);
        const [dec, jan] = cals;
        expect(dec?.caption).toMatch(/December 2025/);
        expect(jan?.caption).toMatch(/January 2026/);
        expect(selectedDays(dec)).toEqual([29, 30, 31]);
        expect(selectedDays(jan)).toEqual([1, 2, 3, 4]);
      },
    );

    it(
      title('TC-VP2105-09: February / March 2026 — Feb shows only 1–28, March only 1–31', Tag.REGRESSION),
      async () => {
        await openHistoryList();
        await openDatePicker();
        await showMonths(FEB_26);
        const cals = await calendars();
        expectNoOverlap(cals);
        const [feb, mar] = cals;
        expect(feb?.days.map((d) => d.day)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
        expect(mar?.days.map((d) => d.day)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
      },
    );

    it(
      title(
        'TC-VP2105-10: Today filters today; Cancel after paging and picking keeps the applied range',
        Tag.REGRESSION,
      ),
      async () => {
        const today = startOfDay(new Date());
        await openHistoryList();
        await step('Today', async () => {
          await openDatePicker();
          await todayPopover();
          expect(await dateRangeText()).toMatch(new RegExp(`(^|\\s)${mdy(today)}( - ${mdy(today)})?\\s*$`));
          for (const d of await rowDates()) expect(d).toBe(mdy(today));
        });
        await step('Cancel keeps the range', async () => {
          const before = await dateRangeText();
          await openDatePicker();
          await showMonths(SEP28);
          await clickDay(0, SEP28);
          await cancelPopover();
          expect(await isPopoverOpen()).toBe(false);
          expect(await dateRangeText()).toBe(before);
        });
      },
    );
  });
});
