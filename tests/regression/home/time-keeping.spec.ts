/**
 * Time Keeping dialog (`/home?dialog=time-keeping`) — staff self clock-in/out.
 *
 * Test cases: docs/screens/time-keeping/time-keeping-test-cases.md — TC-TK-01..08.
 *
 * ## Data safety
 *
 * Check In / Check Out write real attendance. Every case that checks a staff IN
 * picks someone who is OUT right now (read from the "Unavailable Staff" column
 * first) and checks them OUT again in the same test; `after` checks out anyone a
 * failing case left IN. Nobody who was already IN is touched.
 *
 * ## Virtualisation
 *
 * Each column only renders on-screen cards (the 1.1.56 dump: badge 305, ~29
 * cards in the DOM), so badge-vs-cards comparisons are made on a column short
 * enough to render whole, or after narrowing with the search box.
 *
 * WRITES ATTENDANCE. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/modal/PasscodeDialog.js';
import { timeKeepingDialog } from '../../../src/components/modal/TimeKeepingDialog.js';
import { toastMessage } from '../../../src/components/toast/ToastMessage.js';
import { Routes } from '../../../src/constants/routes.js';
import { Payroll, both } from '../../../src/constants/labels.js';
import { TimeKeepingText } from '../../../src/constants/testids.time-keeping.js';
import { returnToHome } from '../../../src/flows/index.js';
import { currentRoutePath } from '../../../src/helpers/navigate.js';
import { dismissUpdaterIfPresent } from '../../../src/helpers/updater.js';
import { homePage, timeTrackingPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

/** A column renders whole when it holds at most this many cards (5 rows of 3 at 1080p). */
const FULLY_RENDERED_MAX = 15;

const STATUS_IN = [TimeKeepingText.statusIn.en, TimeKeepingText.statusIn.vi];
const STATUS_OUT = [TimeKeepingText.statusOut.en, TimeKeepingText.statusOut.vi];

describe('Time Keeping — staff clock in / clock out', () => {
  /** Staff a case checked IN and has not checked OUT yet. */
  const leftIn = new Set<string>();

  /** Read the state first: a staff who is OUT now, enabled and uniquely named. */
  async function pickOutStaff(): Promise<string> {
    const [name] = await timeKeepingDialog.checkInCandidates(1);
    if (name === undefined) throw new Error('No staff in "Unavailable Staff" can be checked in.');
    expect(await timeKeepingDialog.columnOf(name)).toBe('unavailable');
    await timeKeepingDialog.clearSearch();
    return name;
  }

  async function checkIn(name: string): Promise<void> {
    await timeKeepingDialog.checkIn(name);
    leftIn.add(name);
  }

  async function checkOut(name: string): Promise<void> {
    await timeKeepingDialog.open();
    if ((await timeKeepingDialog.columnOf(name)) === 'available') await timeKeepingDialog.checkOut(name);
    leftIn.delete(name);
  }

  before(async () => {
    assertWritesAllowed('check staff in and out in Time Keeping');
    await returnToHome();
    await dismissUpdaterIfPresent();
  });

  afterEach(async () => {
    if (await timeKeepingDialog.isOpen(Timeouts.ANIMATION))
      await timeKeepingDialog.clearSearch().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await returnToHome().catch(() => undefined);
    for (const name of [...leftIn]) await checkOut(name).catch(() => undefined);
    await timeKeepingDialog.close().catch(() => undefined);
    await returnToHome();
  });

  it(title('Deep link opens Time Keeping with no passcode gate (TC-TK-01)', Tag.REGRESSION), async () => {
    await timeKeepingDialog.close();
    await timeKeepingDialog.open(Routes.HOME);

    expect(await timeKeepingDialog.isOpen()).toBe(true);
    expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION)).toBe(false);
    expect(await timeKeepingDialog.currentDialogParam()).toBe('time-keeping');
    expect(await timeKeepingDialog.hasSearch()).toBe(true);
  });

  it(title('Column badges match the cards they list (TC-TK-02)', Tag.REGRESSION), async () => {
    await timeKeepingDialog.open();
    await timeKeepingDialog.clearSearch();

    for (const column of ['available', 'unavailable'] as const) {
      const count = await timeKeepingDialog.columnCount(column);
      const cards = await timeKeepingDialog.columnCards(column);
      if (count === 0) {
        expect(cards).toHaveLength(0);
        expect(await timeKeepingDialog.isColumnEmpty(column)).toBe(true);
      } else if (count <= FULLY_RENDERED_MAX) {
        expect(cards).toHaveLength(count);
      } else {
        // Virtualised: only part of the column is in the DOM.
        expect(cards.length).toBeGreaterThan(0);
        expect(cards.length).toBeLessThanOrEqual(count);
      }
    }

    // Narrow both columns with a real name and compare exactly.
    const sample = (await timeKeepingDialog.columnCards('unavailable'))[0]?.name;
    expect(sample).toBeDefined();
    await timeKeepingDialog.search(sample ?? '');
    for (const column of ['available', 'unavailable'] as const) {
      const count = await timeKeepingDialog.columnCount(column);
      if (count <= FULLY_RENDERED_MAX)
        expect(await timeKeepingDialog.columnCards(column)).toHaveLength(count);
    }
  });

  it(
    title('Check In moves the staff to Available with IN and a time (TC-TK-03)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await timeKeepingDialog.open();
      const name = await pickOutStaff();
      const outBefore = await timeKeepingDialog.columnCount('unavailable');
      const inBefore = await timeKeepingDialog.columnCount('available');

      try {
        await checkIn(name);
        expect(await toastMessage.latestType(Timeouts.SHORT)).toBe('success');

        const card = (await timeKeepingDialog.columnCards('available')).find((c) => c.name === name);
        expect(card).toBeDefined();
        expect(STATUS_IN).toContain(card?.status);
        expect(card?.time).toMatch(/\d{2}\/\d{2}\/\d{4}/);

        await timeKeepingDialog.clearSearch();
        expect(await timeKeepingDialog.columnCount('unavailable')).toBe(outBefore - 1);
        expect(await timeKeepingDialog.columnCount('available')).toBe(inBefore + 1);
      } finally {
        await checkOut(name);
      }
    },
  );

  it(
    title(
      'Check Out moves the staff back to Unavailable with OUT and a time (TC-TK-04)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await timeKeepingDialog.open();
      const name = await pickOutStaff();
      await checkIn(name);
      await toastMessage.dismissAll(Timeouts.SHORT);

      await timeKeepingDialog.checkOut(name);
      leftIn.delete(name);

      expect(await toastMessage.latestType(Timeouts.SHORT)).toBe('success');
      expect(await timeKeepingDialog.columnOfRendered(name)).toBe('unavailable');
      const card = (await timeKeepingDialog.columnCards('unavailable')).find((c) => c.name === name);
      expect(STATUS_OUT).toContain(card?.status);
      expect(card?.time).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    },
  );

  it(title('Search filters both columns at once (TC-TK-05)', Tag.REGRESSION), async () => {
    await timeKeepingDialog.open();
    await timeKeepingDialog.clearSearch();
    const sample = (await timeKeepingDialog.columnCards('unavailable'))[0]?.name ?? '';
    expect(sample).not.toBe('');

    await timeKeepingDialog.search(sample);
    for (const column of ['available', 'unavailable'] as const) {
      const cards = await timeKeepingDialog.columnCards(column);
      for (const card of cards) expect(card.name.toLowerCase()).toContain(sample.toLowerCase());
      if (cards.length === 0) expect(await timeKeepingDialog.isColumnEmpty(column)).toBe(true);
    }

    await timeKeepingDialog.search(`zz-no-such-staff-${Date.now()}`);
    for (const column of ['available', 'unavailable'] as const) {
      expect(await timeKeepingDialog.columnCount(column)).toBe(0);
      expect(await timeKeepingDialog.isColumnEmpty(column)).toBe(true);
    }
  });

  it(title('Close returns to Home (TC-TK-06)', Tag.REGRESSION), async () => {
    await timeKeepingDialog.open();
    await timeKeepingDialog.close();

    expect(await timeKeepingDialog.isOpen(Timeouts.ANIMATION)).toBe(false);
    expect(await timeKeepingDialog.currentDialogParam()).toBeNull();
    expect(await currentRoutePath()).toBe(Routes.HOME);
    await homePage.waitForReady(Timeouts.MEDIUM);
  });

  it(
    title('A staff who is IN offers no second Check In (TC-TK-07)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await timeKeepingDialog.open();
      const name = await pickOutStaff();
      try {
        await checkIn(name);

        await timeKeepingDialog.search(name);
        expect((await timeKeepingDialog.columnCards('unavailable')).some((c) => c.name === name)).toBe(false);
        expect(
          (await timeKeepingDialog.columnCards('available')).filter((c) => c.name === name),
        ).toHaveLength(1);

        // Tapping the IN card offers Check Out — never Check In.
        await timeKeepingDialog.selectCard(name, 'available');
        const action = await timeKeepingDialog.selectedCardAction(name, 'available');
        expect(action).not.toBe('');
        expect(both(Payroll.checkIn)).not.toContain(action);
        expect(both(Payroll.checkOut)).toContain(action);
      } finally {
        await checkOut(name);
      }
    },
  );

  it(
    title('A Time Keeping check-in shows up on /time-tracking (TC-TK-08)', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await timeKeepingDialog.open();
      const name = await pickOutStaff();
      try {
        await checkIn(name);
        await timeKeepingDialog.close();

        await timeTrackingPage.open(new Date());
        await timeTrackingPage.search(name);
        const row = await timeTrackingPage.rowFor(name);

        expect(row).not.toBeNull();
        expect(row?.dateIn).not.toBeNull();
        expect(row?.dateOut).toBeNull();
      } finally {
        await returnToHome();
        await checkOut(name);
      }
    },
  );
});
