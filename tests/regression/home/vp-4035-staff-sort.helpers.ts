/**
 * VP-4035 helpers — Home staff grid sorted by "Staff Checked In".
 *
 * NOT a spec. Drives the Sort-by popover through the volt-qc probe (the
 * popover and the grid ship no `data-testid` on 1.1.6x) and reads the WHOLE
 * staff grid in render order: the grid is virtualised, so it is scrolled end
 * to end and the names are de-duplicated in first-seen order.
 *
 * Attendance is written through the Time Keeping dialog page object, exactly
 * like tests/regression/home/time-keeping.spec.ts. Every helper that checks a
 * staff IN records them, so the spec's `after` can check them OUT again.
 */

import { env } from '../../../configs/env/loadEnv.js';
import { gql } from '../../../src/api/index.js';
import { passcodeDialog } from '../../../src/components/modal/PasscodeDialog.js';
import { timeKeepingDialog } from '../../../src/components/modal/TimeKeepingDialog.js';
import { Routes } from '../../../src/constants/routes.js';
import { VpStaffSort } from '../../../src/constants/testids.vp-loyalty-pending.js';
import { returnToHome } from '../../../src/flows/index.js';
import { settle } from '../../../src/helpers/wait.js';
import { openStaffSort, quickCheckout } from '../../../src/pages/voltqc/pos/homeProbe.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';

export type StaffSortOption = 'staffCheckedIn' | 'defaultOrder';
export type StaffSortOrder = 'ascending' | 'descending';

/** Staff this run checked IN and has not checked OUT yet. */
export const leftIn = new Set<string>();

/** Home with an empty order frame — the state in which the staff grid is the picker. */
export async function homeWithStaffGrid(): Promise<void> {
  await returnToHome();
  await quickCheckout();
}

/** Pick a sort (and, for anything but Default Order, a direction), then close the popover. */
export async function chooseStaffSort(
  option: StaffSortOption,
  order: StaffSortOrder = 'ascending',
): Promise<void> {
  await openStaffSort();
  const pop = VpStaffSort.popover;
  await P.clickQ([pop, { text: VpStaffSort[option] }]);
  if (option !== 'defaultOrder') {
    await P.waitFor([pop, { text: VpStaffSort[order] }], 5_000, `${order} radio`);
    await P.clickQ([pop, { text: VpStaffSort[order] }]);
  }
  await P.escape();
  await settle(800);
}

/**
 * Every staff nickname on the Home grid, in render order. Scrolls the grid's
 * scroll container from the top to the end, collecting as it goes.
 */
export async function allStaffNames(): Promise<string[]> {
  const names: string[] = [];
  for (let i = -1; i < 60; i += 1) {
    const { batch, atEnd } = await P.exec<{ batch: string[]; atEnd: boolean }>(
      `
      var nameCss = arguments[0], listingCss = arguments[1], step = arguments[2];
      var spans = Array.prototype.slice.call(document.querySelectorAll(nameCss));
      var anchor = document.querySelector(listingCss) || (spans[0] && spans[0].parentElement);
      var scroller = anchor;
      while (scroller && scroller !== document.body) {
        var oy = getComputedStyle(scroller).overflowY;
        if (scroller.scrollHeight > scroller.clientHeight + 4 && /auto|scroll/.test(oy)) break;
        scroller = scroller.parentElement;
      }
      if (scroller === document.body) scroller = null;
      // Read what is rendered NOW, then move: react-virtual only mounts the rows
      // of the new position after a frame, so a read right after a scroll
      // returned the previous window (and the first rows were lost at step 0).
      if (step < 0) {
        if (scroller) scroller.scrollTop = 0;
        return { batch: [], atEnd: false };
      }
      var visible = Array.prototype.slice.call(document.querySelectorAll(nameCss))
        .map(function (s) { return (s.textContent || '').trim(); })
        .filter(function (t) { return t !== ''; });
      var end = !scroller || scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
      if (scroller && !end) scroller.scrollTop += scroller.clientHeight * 0.7;
      return { batch: visible, atEnd: end };
      `,
      VpStaffSort.staffNameCss,
      VpStaffSort.listingCss,
      i,
    );
    for (const n of batch) if (!names.includes(n)) names.push(n);
    if (atEnd) break;
    await settle(400);
  }
  return names;
}

/** Open Time Keeping on Home, through the passcode guard when the till asks for one. */
export async function openTimeKeeping(): Promise<void> {
  await timeKeepingDialog.open(Routes.HOME);
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE, { timeout: 2_000 });
}

export async function checkIn(name: string): Promise<void> {
  await openTimeKeeping();
  await timeKeepingDialog.checkIn(name);
  leftIn.add(name);
  await timeKeepingDialog.clearSearch();
  await timeKeepingDialog.close();
}

export async function checkOut(name: string): Promise<void> {
  await openTimeKeeping();
  if ((await timeKeepingDialog.columnOf(name)) === 'available') await timeKeepingDialog.checkOut(name);
  leftIn.delete(name);
  await timeKeepingDialog.clearSearch();
  await timeKeepingDialog.close();
}

const ATTENDANCE = `
  query vp4035Attendance($since: String!) {
    open: timeKeepingList(
      where: { checkInAt: { gte: $since }, checkOutAt: { isNull: true } }
      orderBy: { checkInAt: asc }
    ) {
      checkInAt
      staff { nickname }
    }
    staff: staffList(where: { status: { eq: "active" } }) { nickname }
  }
`;

/**
 * Today's IN staff (an open time-keeping row checked in since local midnight), in
 * check-in order, and every other active staff as OUT — read from the app's own
 * data. The Time Keeping columns are virtualised, so reading their rendered cards
 * missed most of the IN group (dev also keeps months-old rows never checked out,
 * hence "since midnight"). The columns are String in this schema, compared
 * as text, so the bound uses the stored `YYYY-MM-DDTHH:mm:ss+00:00` shape.
 */
export async function attendance(): Promise<{
  inNames: string[];
  outNames: string[];
  inTime: Map<string, string>;
}> {
  // Same window as the app (use-clocked-in-staff.ts: merchant day via host.timezone).
  // Merchant 14 is Asia/Ho_Chi_Minh, the QC PC's own zone, so device midnight matches.
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const data = await gql().query<{
    open: { checkInAt: string; staff: { nickname: string } | null }[];
    staff: { nickname: string }[];
  }>(ATTENDANCE, {
    variables: { since: midnight.toISOString().replace(/\.\d{3}Z$/, '+00:00') },
    operationName: 'vp4035Attendance',
  });
  const inTime = new Map<string, string>();
  for (const row of data.open) {
    const name = (row.staff?.nickname ?? '').trim();
    if (!name || inTime.has(name)) continue;
    inTime.set(
      name,
      new Date(row.checkInAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    );
  }
  const inNames = [...inTime.keys()];
  const outNames = [...new Set(data.staff.map((s) => s.nickname.trim()))].filter(
    (n) => n !== '' && !inTime.has(n),
  );
  return { inNames, outNames, inTime };
}

/** Up to `count` OUT staff that can be checked in, uniquely named. */
export async function outCandidates(count: number): Promise<string[]> {
  await openTimeKeeping();
  const names = await timeKeepingDialog.checkInCandidates(count);
  await timeKeepingDialog.close();
  return names;
}

/** `h:mm AM` → minutes since midnight (NaN when unparsable). */
export function clockMinutes(label: string): number {
  const m = /(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(label);
  if (!m) return Number.NaN;
  let h = Number(m[1]) % 12;
  if ((m[3] ?? '').toUpperCase() === 'PM') h += 12;
  if (m[3] === undefined) h = Number(m[1]);
  return h * 60 + Number(m[2]);
}

/** `list` filtered to the members of `keep`, order preserved. */
export const onlyThese = (list: readonly string[], keep: readonly string[]): string[] =>
  list.filter((n) => keep.includes(n));
