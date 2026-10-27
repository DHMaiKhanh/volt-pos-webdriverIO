/**
 * volt-qc port — 08 APPOINTMENT cards, columns, popover, phone reveal and
 * Home › Appointments Today, on appointments that ALREADY exist.
 *
 * Source: volt-qc `e2e/tests/08-appointment/appt-plan-booking.spec.ts`
 * (APPT-T06c, T07, T08a, T10, T11, T13b read-only parts) and TC rows of
 * docs/qc/volt-qc/windows-regression/08-appointment.md.
 *
 * Adaptation: volt-qc books two appointments on the online booking site first
 * (APPT-T06a) and asserts on those. That site is not drivable from this lane and
 * build 1.1.56 has no create form, so every case DISCOVERS a matching card by
 * walking the board ±10 days and skips with a reason when none exists. Nothing
 * is written: the phone-reveal case saves and restores `volt-passcode-skip`.
 */

import { expect } from '@wdio/globals';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../../src/components/modal/PasscodeDialog.js';
import { VqaAppt as Q } from '../../../../src/constants/testids.voltqc-appt-time-turn.js';
import { VqcAppointment as A, VqcCommon } from '../../../../src/constants/testids.voltqc-pos.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  type BoardCard,
  boardCards,
  clickHomeRow,
  closeAppointmentsToday,
  closePopoverX,
  durationOf,
  findCard,
  homeRows,
  openAppointmentsToday,
  openCardByText,
  popoverHasLabel,
  popoverInfo,
  popoverNoteStyle,
  popoverOpen,
  popoverPhoneUnmasked,
  rawColumnHeaders,
  readSkipRaw,
  setStatusChecked,
  writeSkipRaw,
} from '../../../../src/pages/voltqc/appt-time-turn/apptBoard.js';
import {
  ROW_PX_PER_MIN,
  boardSearch,
  clearBoardStorage,
  columnHeaders,
  dayStart,
  filterBadge,
  gotoBoard,
  headerAppointmentBadge,
  onlyStatuses,
  resetBoard,
} from '../../../../src/pages/voltqc/pos/appointmentProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  gateState,
  gateTickSkip,
  gateType,
  readSkip,
  unknownCode,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const MASKED_RE = new RegExp(Q.maskedPhoneRe);
const TIME_RANGE_RE = /\d{2}:\d{2} (AM|PM) - \d{2}:\d{2} (AM|PM)/;

/** Board with no remembered filters, on `day`. */
async function freshBoardOn(day: Date): Promise<void> {
  await gotoBoard(dayStart(0));
  await clearBoardStorage();
  await gotoBoard(day);
}

/** Open the card whose status is one of `statuses`, optionally only one with no order yet. */
async function openFirst(
  statuses: string[],
  opts: { withoutOrder?: boolean; allStatuses?: boolean; predicate?: (c: BoardCard) => boolean } = {},
): Promise<{ day: Date; card: BoardCard } | null> {
  const want = (c: BoardCard): boolean => statuses.includes(c.status) && (opts.predicate?.(c) ?? true);
  const tried = new Set<string>();
  const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7];
  for (const from of offsets) {
    const hit = await findCard(want, { span: 0, from, allStatuses: opts.allStatuses });
    if (!hit) continue;
    for (const card of (await boardCards()).filter(want)) {
      const key = `${String(from)}|${card.text}`;
      if (tried.has(key)) continue;
      tried.add(key);
      await openCardByText(card.text);
      if (!opts.withoutOrder || (await popoverInfo()).orderId === '') return { day: hit.day, card };
      await closePopoverX();
    }
  }
  return null;
}

describe('volt-qc 08 APPOINTMENT — cards, popover and Appointments Today (existing data)', () => {
  let skipRaw: string | null = null;

  before(async () => {
    await returnToHome();
    skipRaw = await readSkipRaw();
  });

  afterEach(async () => {
    await P.escape().catch(() => undefined);
    await closePopoverX().catch(() => undefined);
    await resetBoard().catch(() => undefined);
  });

  after(async () => {
    await writeSkipRaw(skipRaw).catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Columns: Unassigned first then staff A→Z; each column badge = its cards; badges sum to the cards shown, none Canceled (APPT-020, APPT-043)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      await gotoBoard(dayStart(0));
      await clearBoardStorage();
      const hit = await findCard(() => true);
      if (!hit) this.skip(); // no appointment within ±10 days
      const headers = await columnHeaders();
      expect(headers[0]?.name).toBe('Unassigned');
      const staff = headers.slice(1).map((h) => h.name.toLowerCase());
      expect(staff).toEqual([...staff].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
      const cards = await boardCards();
      for (let i = 0; i < Math.min(headers.length, 6); i += 1) {
        expect(headers[i]?.count).toBe(cards.filter((c) => c.col === i).length);
      }
      expect(cards.filter((c) => c.status === 'Canceled')).toEqual([]);
      if (headers.length === (await filterBadge(A.staffsButton))) {
        expect(headers.reduce((s, h) => s + h.count, 0)).toBe(cards.length);
      }
    },
  );

  it(
    title(
      'Ticking Canceled shows the canceled cards with a Canceled badge; Statuses badge = 4 (APPT-040)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      const hit = await findCard((c) => c.status === 'Canceled', { allStatuses: true });
      if (!hit) this.skip(); // no canceled appointment within ±10 days
      await freshBoardOn(hit?.day ?? dayStart(0));
      expect((await boardCards()).filter((c) => c.status === 'Canceled')).toEqual([]);
      await setStatusChecked('Canceled', true);
      expect(await filterBadge(A.statusesButton)).toBe(4);
      const shown = await P.poll(boardCards, (cs) => cs.some((c) => c.status === 'Canceled'), 10_000);
      expect(shown.some((c) => c.text === hit?.card.text)).toBe(true);
    },
  );

  it(
    title('Only Done ticked: URL statuses = [done] and every card is Done (APPT-041)', Tag.REGRESSION),
    async function () {
      await returnToHome();
      const hit = await findCard((c) => c.status === 'Done');
      if (!hit) this.skip(); // no Done appointment within ±10 days
      await onlyStatuses(['Done']);
      expect((await boardSearch()).statuses).toEqual(['done']);
      const cards = await P.poll(boardCards, (cs) => cs.length > 0, 10_000);
      expect(cards.length).toBeGreaterThan(0);
      for (const c of cards) expect(c.status).toBe('Done');
    },
  );

  it(
    title(
      'Card + popover of a Scheduled/Confirmed booking: masked phone, badge, service, time range, staff border; popover fields, only Checkout (APPT-006, APPT-048, APPT-056)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      const got = await openFirst(['Scheduled', 'Confirmed']);
      if (!got) this.skip(); // no Scheduled / Confirmed appointment within ±7 days
      const card = got?.card;
      // card content
      expect(card.name).not.toBe('');
      expect(card.text).toMatch(MASKED_RE);
      expect(['Scheduled', 'Confirmed']).toContain(card.status);
      expect(card.text).toMatch(TIME_RANGE_RE);
      expect(card.borderLeft).not.toBe('rgba(0, 0, 0, 0)');
      await step('popover content', async () => {
        const info = await popoverInfo();
        expect(info.status).toBe(card.status);
        expect(await P.has(Q.popoverClose)).toBe(true);
        expect(info.heading).toBe(card.name);
        expect(info.text).toMatch(MASKED_RE);
        for (const label of ['Service', 'Time', 'Staff']) expect(await popoverHasLabel(label)).toBe(true);
        for (const b of ['Edit', 'Confirm', 'Cancel']) expect(info.buttons).not.toContain(b);
        expect(info.buttons).toEqual(['Checkout']);
      });
    },
  );

  it(title('A Confirmed booking with no order shows Checkout (APPT-060)', Tag.REGRESSION), async function () {
    await returnToHome();
    if (!(await openFirst(['Confirmed'], { withoutOrder: true }))) this.skip(); // none within ±7 days
    expect((await popoverInfo()).buttons).toContain('Checkout');
  });

  it(
    title(
      'A Scheduled booking with no order also shows Checkout (prod behaviour) (APPT-061)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      if (!(await openFirst(['Scheduled'], { withoutOrder: true }))) this.skip(); // none within ±7 days
      expect((await popoverInfo()).buttons).toContain('Checkout');
    },
  );

  it(
    title('A Canceled booking: Canceled badge and no button in the popover (APPT-062)', Tag.REGRESSION),
    async function () {
      await returnToHome();
      if (!(await openFirst(['Canceled'], { allStatuses: true }))) this.skip(); // none within ±7 days
      const info = await popoverInfo();
      expect(info.status).toBe('Canceled');
      expect(info.buttons).toEqual([]);
    },
  );

  it(
    title('A Done booking: Done badge, Order #OD…, no Checkout (APPT-063)', Tag.REGRESSION),
    async function () {
      await returnToHome();
      if (!(await openFirst(['Done']))) this.skip(); // none within ±7 days
      const info = await popoverInfo();
      expect(info.status).toBe('Done');
      expect(info.orderId).toMatch(/^OD\d{6}-\d+$/);
      expect(await popoverHasLabel('Order')).toBe(true);
      expect(info.buttons).not.toContain('Checkout');
    },
  );

  it(
    title(
      'Cards cannot be dragged: aria-disabled, a drag leaves the card in place with no confirm / passcode (APPT-007)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      const got = await openFirst(['Scheduled', 'Confirmed']);
      if (!got) this.skip();
      await closePopoverX();
      const card = got?.card;
      expect(card.ariaDisabled).toBe('true');
      const before = (await boardCards()).find((c) => c.text === card.text);
      if (!before) this.skip();
      const from = { x: (before?.left ?? 0) + (before?.width ?? 0) / 2, y: (before?.top ?? 0) + 20 };
      await P.drag(from, { x: from.x + 220, y: from.y + 180 });
      await settle(800);
      expect(await P.has(Q.updateDialog)).toBe(false);
      expect(await P.has(VqcCommon.passcodeDialog)).toBe(false);
      await P.escape();
      await closePopoverX();
      const after = (await boardCards()).find((c) => c.text === card.text);
      expect(after?.col).toBe(before?.col);
      expect(Math.round(after?.top ?? 0)).toBe(Math.round(before?.top ?? 0));
    },
  );

  it(
    title(
      'The popover closes with X, Escape and an outside click; date and filters stay (APPT-059)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      const got = await openFirst(['Scheduled', 'Confirmed', 'Done']);
      if (!got) this.skip();
      const text = got?.card.text ?? '';
      const s0 = await boardSearch();
      await closePopoverX();
      expect(await popoverOpen()).toBe(false);
      await openCardByText(text);
      await P.escape();
      expect(await P.poll(popoverOpen, (v) => !v, 5_000)).toBe(false);
      await openCardByText(text);
      const head = await P.info({ text: A.overviewTitle, nth: 0 });
      await P.clickAt((head?.rect.x ?? 10) + 5, (head?.rect.y ?? 10) + (head?.rect.h ?? 10) / 2);
      expect(await P.poll(popoverOpen, (v) => !v, 5_000)).toBe(false);
      const s1 = await boardSearch();
      expect(s1.date).toBe(s0.date);
      expect(s1.staffIds).toEqual(s0.staffIds);
      expect(s1.statuses).toEqual(s0.statuses);
    },
  );

  it(
    title(
      'Note shows only when the booking has one, and keeps line breaks (pre-wrap) (APPT-057)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(5 * 60_000);
      await returnToHome();
      let withNote: { whiteSpace: string; text: string } | null = null;
      let withoutNote = false;
      for (let off = 0; off <= 7 && !(withNote && withoutNote); off += 1) {
        await gotoBoard(dayStart(off));
        for (const c of (await boardCards()).slice(0, 8)) {
          await openCardByText(c.text);
          const info = await popoverInfo();
          if (info.hasNote && !withNote) withNote = await popoverNoteStyle();
          if (!info.hasNote) withoutNote = true;
          await closePopoverX();
          if (withNote && withoutNote) break;
        }
      }
      if (!withNote || !withoutNote) this.skip(); // need one booking with a note and one without
      expect(withNote?.text.trim()).not.toBe('');
      expect(withNote?.whiteSpace).toMatch(/pre-wrap|pre-line/);
    },
  );

  it(
    title(
      'Card height is proportional to the duration (6 px/min, at least 15 min) (APPT-030)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      const hit = await findCard((c) => !Number.isNaN(durationOf(c.timeRange)));
      if (!hit) this.skip();
      const cards = (await boardCards()).filter((c) => !Number.isNaN(durationOf(c.timeRange)));
      for (const c of cards.slice(0, 10)) {
        const expected = Math.max(durationOf(c.timeRange), 15) * ROW_PX_PER_MIN;
        expect(Math.abs(c.height - expected)).toBeLessThanOrEqual(6);
      }
    },
  );

  it(
    title('Two overlapping bookings in one column split the width side by side (APPT-028)', Tag.REGRESSION),
    async function () {
      await returnToHome();
      const overlapping = (cs: BoardCard[]): [BoardCard, BoardCard] | null => {
        for (const a of cs)
          for (const b of cs)
            if (a !== b && a.col === b.col && a.top < b.top + b.height - 1 && b.top < a.top + a.height - 1)
              return [a, b];
        return null;
      };
      let pair: [BoardCard, BoardCard] | null = null;
      for (let off = -7; off <= 7 && !pair; off += 1) {
        await gotoBoard(dayStart(off));
        pair = overlapping(await boardCards());
      }
      if (!pair) this.skip(); // no overlapping bookings within ±7 days
      const [a, b] = pair;
      expect(a.left + a.width <= b.left + 1 || b.left + b.width <= a.left + 1).toBe(true);
      expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(Math.max(a.width, b.width) * 0.15);
    },
  );

  it(
    title(
      'A column of an inactive staff with bookings is labelled "(Inactive)" and dimmed (APPT-025)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      let found: { text: string; minOpacity: number } | undefined;
      for (let off = -7; off <= 7 && !found; off += 1) {
        await gotoBoard(dayStart(off));
        found = (await rawColumnHeaders()).find((h) => /\(Inactive\)/.test(h.text));
      }
      if (!found) this.skip(); // no booking of an inactive staff within ±7 days
      expect(found?.minOpacity ?? 1).toBeLessThanOrEqual(0.6);
    },
  );

  it(
    title(
      'The popover of an inactive staff\'s booking marks the staff "(Inactive)" (APPT-058)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      for (let off = -7; off <= 7; off += 1) {
        await gotoBoard(dayStart(off));
        const headers = await rawColumnHeaders();
        const col = headers.findIndex((h) => /\(Inactive\)/.test(h.text));
        if (col < 0) continue;
        const card = (await boardCards()).find((c) => c.col === col);
        if (!card) continue;
        await openCardByText(card.text);
        expect((await popoverInfo()).text).toContain('(Inactive)');
        return;
      }
      this.skip(); // no booking of an inactive staff within ±7 days
    },
  );

  it(
    title(
      'Header badge on the board follows the viewed day: > 0 on a day with bookings, 0 on an empty day (APPT-076)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      await gotoBoard(dayStart(0));
      await clearBoardStorage();
      const hit = await findCard((c) => c.status !== 'Canceled');
      if (!hit) this.skip();
      const headers = await columnHeaders();
      const n = await P.poll(headerAppointmentBadge, (v) => v > 0, 15_000);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(
        Math.max(
          headers.reduce((s, h) => s + h.count, 0),
          (await boardCards()).length,
        ),
      );
      await gotoBoard(new Date(2030, 0, 15));
      expect(await P.poll(headerAppointmentBadge, (v) => v === 0, 15_000)).toBe(0);
    },
  );

  it(
    title(
      'Phone reveal: masked phone asks for a staff code; unknown code refused; Escape keeps it masked; Owner code shows it; 30-min skip stops asking (APPT-066, APPT-067, APPT-068, APPT-071, APPT-072)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await returnToHome();
      await writeSkipRaw(null);
      const got = await openFirst(['Scheduled', 'Confirmed', 'Done'], {
        predicate: (c) => MASKED_RE.test(c.text),
      });
      if (!got) this.skip(); // no booking with a phone within ±7 days
      const text = got?.card.text ?? '';

      await step(
        'click the masked phone → "Enter staff code to continue", keypad, 30-min checkbox',
        async () => {
          await P.clickQ(Q.popoverMaskedPhone);
          const g = await P.poll(gateState, (s) => s.open, 8_000);
          expect(g.open).toBe(true);
          expect(g.text).toContain(Q.phoneGateHeading);
          for (const d of '0123456789') expect(g.text).toContain(d);
          expect(g.text).toContain(Q.phoneGateSkip);
        },
      );

      await step('unknown code → "Failed to verify staff code", still masked', async () => {
        await gateType(unknownCode());
        const g = await P.poll(gateState, (s) => s.text.includes(Q.failedCode), 6_000);
        expect(g.text).toContain(Q.failedCode);
        expect(await P.has(Q.popoverMaskedPhone)).toBe(true);
      });

      await step('Escape → guard closes, popover stays, phone still masked', async () => {
        await P.escape();
        expect((await P.poll(gateState, (s) => !s.open, 5_000)).open).toBe(false);
        expect(await popoverOpen()).toBe(true);
        expect(await P.has(Q.popoverMaskedPhone)).toBe(true);
      });

      await step('Owner code → full phone, no ***; no skip stored without the tick', async () => {
        await P.clickQ(Q.popoverMaskedPhone);
        await passcodeDialog.enter(env.OWNER_PASSCODE);
        expect(await P.poll(popoverPhoneUnmasked, (v) => v, 8_000)).toBe(true);
        expect(await readSkip()).toBeNull();
      });

      await step(
        'tick the 30-min skip + Owner → stored ≈ now + 30 min; next reveal asks nothing',
        async () => {
          await closePopoverX();
          await openCardByText(text);
          expect(await P.has(Q.popoverMaskedPhone)).toBe(true);
          await P.clickQ(Q.popoverMaskedPhone);
          await P.poll(gateState, (s) => s.open, 8_000);
          await gateTickSkip();
          const t0 = Date.now();
          await gateType(env.OWNER_PASSCODE);
          expect(await P.poll(popoverPhoneUnmasked, (v) => v, 8_000)).toBe(true);
          const skip = await readSkip();
          expect(skip).not.toBeNull();
          expect(Math.abs((skip?.expiresAt ?? 0) - (t0 + 30 * 60_000))).toBeLessThan(2 * 60_000);

          await closePopoverX();
          await openCardByText(text);
          await P.clickQ(Q.popoverMaskedPhone);
          await settle(1_500);
          expect((await gateState()).open).toBe(false);
          expect(await popoverPhoneUnmasked()).toBe(true);
        },
      );
    },
  );

  it(
    title(
      'Home › Appointments Today: (N) = today\'s non-canceled lines, Show/Hide, row "time | name | Staff: … | masked phone", only today\'s bookings, popover like the board (APPT-080, APPT-081, APPT-083, APPT-084)',
      Tag.REGRESSION,
    ),
    async function () {
      await returnToHome();
      await gotoBoard(dayStart(0));
      await clearBoardStorage();
      await gotoBoard(dayStart(0));
      const today = await boardCards();
      const headers = await columnHeaders();
      const allColumns = headers.length === (await filterBadge(A.staffsButton));
      if (today.length === 0) this.skip(); // no appointment today
      await returnToHome();
      try {
        const n = await openAppointmentsToday();
        await step('count and Show / Hide', async () => {
          if (allColumns) expect(n).toBe(today.length);
          const rows = await homeRows();
          expect(rows.length).toBe(n);
          await closeAppointmentsToday();
          expect(await P.textOf({ css: 'main button', hasTextRe: '^Appointments Today', nth: 0 })).toContain(
            'Show',
          );
          expect(await homeRows()).toEqual([]);
          await openAppointmentsToday();
        });
        await step("row content and only today's non-canceled bookings", async () => {
          const rows = await homeRows();
          for (const r of rows) {
            expect(r).toMatch(/^\d{2}:\d{2} (AM|PM) \| /);
            expect(r).toMatch(/Staff: \S+/);
            expect(r).toMatch(MASKED_RE);
            if (allColumns) expect(today.some((c) => r.includes(c.name))).toBe(true);
          }
        });
        await step('a row opens the same popover as the board', async () => {
          await clickHomeRow(0);
          const info = await popoverInfo();
          expect(['Scheduled', 'Confirmed', 'Done']).toContain(info.status);
          expect(await P.has(Q.popoverClose)).toBe(true);
          expect(info.heading).not.toBe('');
          expect(info.text).toMatch(MASKED_RE);
          for (const label of ['Service', 'Time', 'Staff']) expect(await popoverHasLabel(label)).toBe(true);
          if (info.status === 'Done') expect(info.buttons).not.toContain('Checkout');
          else if (info.orderId === '') expect(info.buttons).toContain('Checkout');
          await closePopoverX();
        });
      } finally {
        await closeAppointmentsToday().catch(() => undefined);
      }
    },
  );
});
