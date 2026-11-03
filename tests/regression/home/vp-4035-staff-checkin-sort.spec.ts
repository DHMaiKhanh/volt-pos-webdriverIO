/**
 * VP-4035 — sort checked-in staff by check-in order (Home staff grid →
 * Sort by → "Staff Checked In").
 *
 * docs/qc/volt-qc/vp-tickets/VP-4035-staff-checkin-sort-test-cases.md (TC-VP4035-01..08)
 *
 * ## Shape
 *
 * The ticket's cases are one story told in order — two staff check in (A then
 * B), A checks out, A checks in again — so this file runs them as a sequence
 * on two staff it picks from "Unavailable" in Time Keeping. Each case re-checks
 * the state it relies on and skips when an earlier step did not get there.
 *
 * The grid is virtualised: {@link allStaffNames} scrolls it end to end.
 * "Checked in" / "not checked in" sets come from the Time Keeping columns as
 * rendered (≤ ~30 cards per column), so orders are compared on the staff the
 * suite can actually see, never on a guess.
 *
 * WRITES ATTENDANCE (check in / out, one re-check-in). `after` checks out every
 * staff this run left IN and puts the sort back to "Default Order". dev only.
 *
 *   npm run test:attach -- --spec tests/regression/home/vp-4035-staff-checkin-sort.spec.ts
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { moduleLogger } from '../../../src/utils/logger.js';
import {
  allStaffNames,
  attendance,
  checkIn,
  checkOut,
  chooseStaffSort,
  clockMinutes,
  homeWithStaffGrid,
  leftIn,
  onlyThese,
  outCandidates,
  type StaffSortOrder,
} from './vp-4035-staff-sort.helpers.js';

const log = moduleLogger('vp-4035');

/** The two staff the story runs on: A checks in first, B second. */
let A = '';
let B = '';
/** Staff already IN before this run touched anything. */
let inBefore: string[] = [];
/** Time Keeping IN times of A and B right after their FIRST check-in. */
const firstIn = new Map<string, number>();
/** Story progress, so a case whose setup failed skips instead of lying. */
const done = new Set<'A+B in' | 'A out' | 'A in again'>();

async function sortedNames(
  option: 'staffCheckedIn' | 'defaultOrder',
  order?: StaffSortOrder,
): Promise<string[]> {
  await homeWithStaffGrid();
  await chooseStaffSort(option, order);
  const names = await allStaffNames();
  log.info(`${option}${order ? `/${order}` : ''}: ${names.join(' → ')}`);
  return names;
}

const idx = (list: readonly string[], name: string): number => list.indexOf(name);

/** Every name of `first` sits before every name of `then` in `list` (names missing from `list` ignored). */
function expectAllBefore(list: readonly string[], first: readonly string[], then: readonly string[]): void {
  const a = onlyThese(list, first).map((n) => idx(list, n));
  const b = onlyThese(list, then).map((n) => idx(list, n));
  if (a.length === 0 || b.length === 0) return;
  expect(Math.max(...a)).toBeLessThan(Math.min(...b));
}

describe('VP-4035 — Home staff sort "Staff Checked In"', function () {
  this.timeout(Timeouts.MOCHA_HOOK * 4);

  before(async function () {
    assertWritesAllowed('check staff in and out in Time Keeping');
    await returnToHome();
    const candidates = await outCandidates(2);
    if (candidates.length < 2) {
      log.info('SKIP — fewer than 2 staff can be checked in (Unavailable column)');
      this.skip();
    }
    [A = '', B = ''] = candidates;
    inBefore = (await attendance()).inNames;
    log.info(`story staff A=${A}, B=${B}; already IN: ${inBefore.join(', ') || '(none)'}`);
  });

  after(async function () {
    this.timeout(Timeouts.MOCHA_HOOK);
    for (const name of [...leftIn]) await checkOut(name).catch(() => undefined);
    await homeWithStaffGrid().catch(() => undefined);
    await chooseStaffSort('defaultOrder').catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title('TC-VP4035-01: Ascending puts checked-in staff first, in check-in order', Tag.REGRESSION),
    async () => {
      const { inNames, outNames } = await attendance();
      const asc = await sortedNames('staffCheckedIn', 'ascending');
      expect(asc.length).toBeGreaterThan(0);
      expectAllBefore(asc, inNames, outNames);
    },
  );

  it(
    title(
      'TC-VP4035-02: staff checking in later are appended after the checked-in group',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await step(`Check in ${A}, then ${B}`, async () => {
        await checkIn(A);
        await checkIn(B);
      });
      const { inTime } = await attendance();
      firstIn.set(A, clockMinutes(inTime.get(A) ?? ''));
      firstIn.set(B, clockMinutes(inTime.get(B) ?? ''));
      done.add('A+B in');

      const asc = await sortedNames('staffCheckedIn', 'ascending');
      expect(idx(asc, A)).toBeGreaterThanOrEqual(0);
      expect(idx(asc, A)).toBeLessThan(idx(asc, B));
      expectAllBefore(asc, inBefore, [A, B]);
    },
  );

  it(
    title('TC-VP4035-03: staff not checked in come after the group, in default order', Tag.REGRESSION),
    async function () {
      if (!done.has('A+B in')) this.skip();
      const { inNames, outNames } = await attendance();
      const def = await sortedNames('defaultOrder');
      const asc = await sortedNames('staffCheckedIn', 'ascending');
      expectAllBefore(asc, inNames, outNames);
      expect(onlyThese(asc, outNames)).toEqual(onlyThese(def, outNames));
    },
  );

  it(
    title(
      'TC-VP4035-04: Descending puts not-checked-in first, then checked-in newest → earliest',
      Tag.REGRESSION,
    ),
    async function () {
      if (!done.has('A+B in')) this.skip();
      const { inNames, outNames } = await attendance();
      const asc = await sortedNames('staffCheckedIn', 'ascending');
      const desc = await sortedNames('staffCheckedIn', 'descending');
      // staff.utils.ts sortByCheckInOrder: staff with no check-in share one rank, and the
      // sort is stable, so Descending moves that group FIRST in its default order — it does
      // not reverse it. The checked-in group goes last, newest check-in first.
      expect(desc.length).toBe(asc.length);
      expectAllBefore(desc, outNames, inNames);
      expect(onlyThese(desc, inNames)).toEqual([...onlyThese(asc, inNames)].reverse());
      expect(idx(desc, B)).toBeLessThan(idx(desc, A));
    },
  );

  it(
    title('TC-VP4035-05: a staff who checks out leaves the checked-in group', Tag.REGRESSION, Tag.WRITE),
    async function () {
      if (!done.has('A+B in')) this.skip();
      await step(`Check out ${A}`, () => checkOut(A));
      done.add('A out');
      const asc = await sortedNames('staffCheckedIn', 'ascending');
      // B is still IN, A is not: the group (B) now comes before A.
      expect(idx(asc, B)).toBeLessThan(idx(asc, A));
      expectAllBefore(asc, [...inBefore, B], [A]);
    },
  );

  it(
    title(
      'TC-VP4035-06: checking in again the same day keeps the FIRST check-in position',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (!done.has('A out')) this.skip();
      await step(`Check ${A} in again`, () => checkIn(A));
      done.add('A in again');
      const asc = await sortedNames('staffCheckedIn', 'ascending');
      // A's first check-in was before B's, so A goes back ahead of B.
      expect(idx(asc, A)).toBeGreaterThanOrEqual(0);
      expect(idx(asc, A)).toBeLessThan(idx(asc, B));
    },
  );

  it(
    title('TC-VP4035-07: the Ascending order matches the IN times in Time Keeping', Tag.REGRESSION),
    async function () {
      if (!done.has('A+B in')) this.skip();
      const tA = firstIn.get(A) ?? Number.NaN;
      const tB = firstIn.get(B) ?? Number.NaN;
      if (!Number.isFinite(tA) || !Number.isFinite(tB)) this.skip();
      expect(tA).toBeLessThanOrEqual(tB);
      const asc = await sortedNames('staffCheckedIn', 'ascending');
      expect(idx(asc, A) < idx(asc, B)).toBe(tA <= tB);
    },
  );

  it(
    title(
      'TC-VP4035-08: after an app reload the sort falls back to "Default Order" — PENDING ' +
        '(doc-only observation outside the ticket scope; needs an app reload on the shared till)',
    ),
  );
});
