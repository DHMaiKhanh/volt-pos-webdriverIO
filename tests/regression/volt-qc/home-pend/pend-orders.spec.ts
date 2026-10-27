/**
 * volt-qc port — 06 PEND: Pending Orders page and pending-order lifecycle (WRITE cases).
 *
 * Source: volt-qc `e2e/tests/06-pending/pend-plan-page.spec.ts` (PEND-T02, T03, T05…T09, T11),
 * `pend-plan-order.spec.ts` (PEND-T10, T14…T20, T22) and `e2e/tests/17-added/pend-added.spec.ts`
 * (PEND-AD2…AD4). TC catalogue: docs/qc/volt-qc/windows-regression/06-pending-checkin.md.
 *
 * Every order is created here and recognised by its own code on the shared till;
 * counts are compared as "at least" because other people create orders too.
 *
 * Adaptations vs the source:
 * - Staff / services are discovered at runtime (volt-qc pinned Pamela / Thalia).
 * - Settles use Cash (`payInCash`) instead of "Other".
 * - PEND-T10 (FOREIGN KEY 787) opens cards repeatedly but does not reload the
 *   WebView — a reload re-runs the splash boot this lane is not allowed to do;
 *   the TC's "never shows FOREIGN KEY" check is made after each open.
 * - Customer-display halves are not driven.
 * - Not ported here: PEND-T12/T13 (customer types the phone on the customer
 *   display), the GoCheckin kiosk cases and PEND-T21 / PEND-D01 (partial split
 *   payment) — see `_manual/home-pend.manual.spec.ts`.
 */

import { expect } from '@wdio/globals';
import { env } from '../../../../configs/env/loadEnv.js';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { passcodeDialog } from '../../../../src/components/index.js';
import {
  VqcCommon,
  VqcGiftCard,
  VqcHome,
  VqcPending,
  btn,
  inMain,
} from '../../../../src/constants/testids.voltqc-pos.js';
import {
  VqhDialog,
  VqhOrder,
  VqhPasscode,
  VqhPendingPage,
  VqhSidebar,
  inDlg,
  reEscape,
} from '../../../../src/constants/testids.voltqc-home-pend.js';
import { goToOrderHistory, goToSettings, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { accessibilitySettingsPage, checkoutPage, settingsPage } from '../../../../src/pages/index.js';
import {
  addService,
  allChecked,
  attachNewCustomer,
  backToHome,
  cleanupOrders,
  closePasscode,
  closeStrayDialogs,
  createOrder,
  created,
  currentOrderId,
  deleteCurrentOrder,
  discover,
  dropGrant,
  fmt,
  gotoPendingPage,
  headerPending,
  masked,
  noDeleteCode,
  openFromPendingPage,
  openPendingOrder,
  openStaffPopover,
  orderLines,
  orderStaffNames,
  passcodeShown,
  passcodeTitle,
  payCurrentInCash,
  pendingCardText,
  pendingHas,
  pickStaff,
  pressPay,
  quickPayOrder,
  randomPhone,
  removeLine,
  restoreGrant,
  searchPending,
  selectTender,
  sidebarBadge,
  sidebarCardText,
  sidebarHas,
  sortBy,
  staffFilter,
  staffFilterBadge,
  summary,
  testGiftCard,
  typeCode,
  uniqueName,
  unknownCode,
  waitOrderId,
} from '../../../../src/pages/voltqc/home-pend/homePendProbe.js';
import { rowCodes, search as searchHistory } from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { gcAdd, gcEnterCode, openSellGiftCard } from '../../../../src/pages/voltqc/pos/giftCardProbe.js';
import { quickCheckout } from '../../../../src/pages/voltqc/pos/homeProbe.js';
import {
  DATETIME_MEDIUM_RE,
  choosePreset,
  daysAgo,
  mdy,
  openCalendar,
  renderedCards,
  renderedIds,
  scrollList,
} from '../../../../src/pages/voltqc/pos/pendingProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

let staff: string[] = [];
let svc: string[] = [];
const A = (): string => staff[0] ?? '';
const B = (): string => staff[1] ?? '';
const S1 = (): string => svc[0] ?? '';
const S2 = (): string => svc[1] ?? svc[0] ?? '';

/** "Oct 8, 2026" — the date half of the multi-day card time. */
const medDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const T12 = VqhPendingPage.time12hRe;

/** Is `id` listed in Order History (searched by code)? */
async function inOrderHistory(id: string): Promise<boolean> {
  await goToOrderHistory();
  await passcodeDialog.unlockForRun(env.STAFF_PASSCODE, { timeout: 3_000 });
  await searchHistory(id);
  await settle(2_500);
  const codes = await rowCodes();
  await searchHistory('').catch(() => undefined);
  return codes.includes(id);
}

async function resetPendingFilters(): Promise<void> {
  if (!(await P.has(VqcPending.dateRange))) return;
  await P.escape().catch(() => undefined);
  await searchPending('').catch(() => undefined);
  await staffFilter(null).catch(() => undefined);
  if (!/Latest/.test(await P.textOf(VqcPending.sortCombo).catch(() => 'Latest')))
    await sortBy('Latest').catch(() => undefined);
  if (!/Today/.test(await P.textOf(VqcPending.presetCombo).catch(() => 'Today')))
    await choosePreset('Today').catch(() => undefined);
}

describe('volt-qc 06 PEND — pending orders (write)', () => {
  before(async () => {
    await returnToHome();
    const d = await discover();
    staff = d.staff;
    svc = d.services.map((s) => s.name);
  });

  beforeEach(function () {
    if (staff.length === 0 || svc.length === 0) this.skip();
  });

  afterEach(async () => {
    await closePasscode().catch(() => undefined);
    await closeStrayDialogs().catch(() => undefined);
    await resetPendingFilters().catch(() => undefined);
    await restoreGrant();
    await cleanupOrders();
  });

  /* ---------------------------------------------------------------- page / filters */

  it(
    title(
      'Header "Pending Orders" leaves the open order for /order-pending; its card is not "In Use", no error (PEND-002)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      const id = await createOrder(A(), [S1()]);
      await headerPending();
      expect(await P.path()).toMatch(/^\/order-pending/);
      expect(await P.pageText('body')).not.toContain(VqhPendingPage.openError);
      await searchPending(id);
      expect(await pendingHas(id)).toBe(true);
      expect(await pendingCardText(id)).not.toMatch(/In Use/i);
      expect(await P.pageText('body')).not.toContain(VqhPendingPage.openError);
    },
  );

  it(
    title(
      'Date filter: Today by default with hh:mm card times; Last 7 Days adds the date; the calendar "Today" button resets (PEND-004, PEND-006, PEND-010)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const id = await createOrder(A(), [S1()]);
      const today = new Date();
      await gotoPendingPage();

      await step('PEND-004 Today: preset, MM/dd/yyyy button, hh:mm a card time', async () => {
        expect((await P.textOf(VqcPending.presetCombo)).trim()).toBe('Today');
        expect(await P.textOf(VqcPending.dateRange)).toBe(mdy(today));
        await searchPending(id);
        const t = await pendingCardText(id);
        expect(t).toMatch(T12);
        expect(t).not.toMatch(DATETIME_MEDIUM_RE);
        await searchPending('');
      });

      await step("PEND-004 yesterday's orders are not in Today", async () => {
        await choosePreset('Yesterday');
        const yIds = (await renderedIds()).slice(0, 5);
        await choosePreset('Today');
        for (const y of yIds) {
          await searchPending(y);
          expect(await P.count(VqhPendingPage.card(y))).toBe(0);
        }
        await searchPending('');
      });

      await step('PEND-006 Last 7 Days: card time carries the date; our order still shows', async () => {
        await choosePreset('Last 7 Days');
        expect(await P.textOf(VqcPending.presetCombo)).toMatch(/Last 7 Days/);
        expect(await P.textOf(VqcPending.dateRange)).toBe(`${mdy(daysAgo(6))} - ${mdy(today)}`);
        await searchPending(id);
        expect(await pendingHas(id)).toBe(true);
        const t = await pendingCardText(id);
        expect(t).toMatch(DATETIME_MEDIUM_RE);
        expect(t).toContain(medDate(today));
      });

      await step('PEND-010 calendar → Today: back to today, hh:mm a only', async () => {
        await openCalendar();
        await P.clickQ([VqcPending.calendarPopover, btn('Today', 0)]);
        await P.waitGoneQ(VqcPending.calendarPopover, 5_000, 'date popover');
        expect((await P.textOf(VqcPending.presetCombo)).trim()).toBe('Today');
        expect(await P.textOf(VqcPending.dateRange)).toBe(mdy(today));
        const t = await P.poll(
          () => pendingCardText(id),
          (x) => !DATETIME_MEDIUM_RE.test(x),
          10_000,
        );
        expect(t).toMatch(T12);
      });
    },
  );

  it(
    title(
      'Pending search: code / partial code, name (any case), last 4 phone, formatted phone does not match, "ORDER:" prefix, junk → empty (PEND-011, PEND-012, PEND-013, PEND-014, PEND-015, PEND-016)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const id = await createOrder(A(), [S1()]);
      const phone = randomPhone();
      const name = uniqueName('QC Pend');
      await attachNewCustomer(phone, name);
      await headerPending();

      await step('PEND-011 full code → only that card; last 4 of the code still finds it', async () => {
        await searchPending(id);
        expect(await pendingHas(id)).toBe(true);
        expect(await P.count(VqcPending.cards)).toBe(1);
        await searchPending(id.slice(-4));
        expect(await pendingHas(id)).toBe(true);
      });
      await step('PEND-012 lower-case name', async () => {
        await searchPending(name.toLowerCase());
        expect(await pendingHas(id)).toBe(true);
      });
      await step('PEND-013 last 4 phone digits; the card shows the masked phone', async () => {
        await searchPending(phone.slice(-4));
        expect(await pendingHas(id)).toBe(true);
        expect(await pendingCardText(id)).toContain(masked(phone));
      });
      await step('PEND-014 "(xxx) xxx-xxxx" does not match, raw digits do', async () => {
        await searchPending(`(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`);
        expect(
          await P.poll(
            () => P.count(VqhPendingPage.card(id)),
            (n) => n === 0,
            5_000,
          ),
        ).toBe(0);
        expect(await P.has(inMain({ text: VqcPending.noPending }))).toBe(true);
        await searchPending(phone);
        expect(await pendingHas(id)).toBe(true);
      });
      await step('PEND-015 "ORDER:<code>" drops the prefix', async () => {
        await searchPending(`ORDER:${id}`);
        expect(
          await P.poll(
            () => P.inputValue(VqcPending.searchBox),
            (v) => v === id,
            5_000,
          ),
        ).toBe(id);
        expect(await pendingHas(id)).toBe(true);
        expect(await P.count(VqcPending.cards)).toBe(1);
      });
      await step('PEND-016 junk → empty state; cleared → back', async () => {
        await searchPending('zzzzqqq');
        expect(await P.has(inMain({ text: VqcPending.noPending }))).toBe(true);
        expect(await P.has(inMain({ text: VqcPending.noPendingDesc }))).toBe(true);
        expect(await P.count(VqcPending.cards)).toBe(0);
        await searchPending('');
        await searchPending(id);
        expect(await pendingHas(id)).toBe(true);
      });
    },
  );

  it(
    title(
      'Staff filter: one staff (badge 1), All logic, "No results found." in By Staff, orders listed under the staff who served them (PEND-017, PEND-018, PEND-019, PEND-020)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (staff.length < 2) this.skip();
      this.timeout(4 * 60_000);
      const a = await createOrder(A(), [S1()]);
      const b = await createOrder(B(), [S1()]);
      await gotoPendingPage();

      await step(`PEND-017/020 only ${A()}`, async () => {
        await staffFilter([A()]);
        expect(await staffFilterBadge()).toBe(1);
        await searchPending(a);
        expect(await pendingHas(a)).toBe(true);
        expect(await pendingCardText(a)).toMatch(new RegExp(`${reEscape(S1())} \\| ${reEscape(A())}`));
        await searchPending(b);
        expect(
          await P.poll(
            () => P.count(VqhPendingPage.card(b)),
            (n) => n === 0,
            5_000,
          ),
        ).toBe(0);
      });
      await step(`PEND-020 only ${B()}`, async () => {
        await staffFilter([B()]);
        await searchPending(a);
        expect(
          await P.poll(
            () => P.count(VqhPendingPage.card(a)),
            (n) => n === 0,
            5_000,
          ),
        ).toBe(0);
        await searchPending(b);
        expect(await pendingHas(b)).toBe(true);
        await searchPending('');
      });
      await step('PEND-018 All → none → All; untick one staff unticks All; re-tick ticks All', async () => {
        const all = VqhPendingPage.staffCheckbox('All');
        await openStaffPopover();
        if (!(await allChecked())) await P.clickQ(all);
        expect(await allChecked()).toBe(true);
        await P.clickQ(all);
        expect(await allChecked()).toBe(false);
        await P.escape();
        await settle(500);
        expect(await P.count(VqcPending.cards)).toBe(0);
        expect(await P.has(inMain({ text: VqcPending.noPending }))).toBe(true);

        await openStaffPopover();
        await P.clickQ(all);
        expect(await allChecked()).toBe(true);
        const total = (await P.count([VqhPendingPage.staffPopover, { role: 'checkbox' }])) - 1;
        await P.escape();
        await settle(500);
        expect(await staffFilterBadge()).toBe(total);
        await searchPending(a);
        expect(await pendingHas(a)).toBe(true);
        await searchPending(b);
        expect(await pendingHas(b)).toBe(true);
        await searchPending('');

        await openStaffPopover();
        await P.clickQ(VqhPendingPage.staffCheckbox(A()));
        expect(await allChecked()).toBe(false);
        await P.clickQ(VqhPendingPage.staffCheckbox(A()));
        expect(await allChecked()).toBe(true);
        await P.escape();
      });
      await step('PEND-019 "zzz" in By Staff → "No results found."', async () => {
        await openStaffPopover();
        await P.fillQ([VqhPendingPage.staffPopover, VqhPendingPage.byStaff], 'zzz');
        await P.waitFor(
          [VqhPendingPage.staffPopover, { text: 'No results found.' }],
          5_000,
          '"No results found."',
        );
        await P.fillQ([VqhPendingPage.staffPopover, VqhPendingPage.byStaff], '');
        await P.escape();
      });
    },
  );

  it(
    title(
      'Sort: Latest (newest first) by default; Oldest flips the order (PEND-021)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const older = await createOrder(A(), [S1()]);
      await settle(2_000);
      const newer = await createOrder(A(), [S1()]);
      await gotoPendingPage();
      expect(await P.textOf(VqcPending.sortCombo)).toMatch(/Latest/);
      let ids = await P.poll(renderedIds, (x) => x.includes(older) && x.includes(newer), 15_000);
      expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));
      await sortBy('Oldest');
      expect(await P.textOf(VqcPending.sortCombo)).toMatch(/Oldest/);
      ids = await P.poll(
        async () => {
          await scrollList('bottom');
          return renderedIds();
        },
        (x) => x.includes(older) && x.includes(newer),
        20_000,
      );
      expect(ids.indexOf(older)).toBeLessThan(ids.indexOf(newer));
    },
  );

  it(
    title(
      'Card content: Unknown / N/A / 0 Pts; "+ N more services"; services added on Home appear; sidebar card has total, points, time (PEND-025, PEND-026, PEND-028, PEND-038)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const plain = await createOrder(A(), [S1()]);
      const four = await createOrder(A(), [S1(), S2(), S1(), S2()]);
      const three = await createOrder(A(), [S1(), S2(), S1()]);
      await quickCheckout();
      const phone = randomPhone();
      const name = uniqueName('QC Card');
      // Customer first, no staff yet: the order exists with no service.
      await attachNewCustomer(phone, name);
      const withCust = await waitOrderId();
      created.add(withCust);

      await gotoPendingPage();
      await step('PEND-025 no customer: Unknown, N/A, 0 Pts, no Checked-in pill', async () => {
        await searchPending(plain);
        const t = await pendingCardText(plain);
        expect(t).toContain('Unknown');
        expect(t).toContain('N/A');
        expect(t).toContain('0 Pts');
        expect(t).not.toContain('Checked-in');
      });
      await step('PEND-026 four services → "+ 2 more services"; three → "+ 1 more service"', async () => {
        await searchPending(four);
        const t4 = await pendingCardText(four);
        expect(t4).toContain('+ 2 more services');
        expect(t4).toContain(S1());
        await searchPending(three);
        const t3 = await pendingCardText(three);
        expect(t3).toContain('+ 1 more service');
        expect(t3).not.toContain('more services');
      });
      let total = NaN;
      await step('PEND-028 staff + service added on Home show on the card', async () => {
        await searchPending(withCust);
        expect(await pendingCardText(withCust)).not.toContain(S1());
        await P.clickQ(VqhPendingPage.card(withCust));
        await P.poll(currentOrderId, (v) => v === withCust, 15_000);
        await pickStaff(A());
        await addService(S1());
        total = (await summary()).total ?? NaN;
        await headerPending();
        await searchPending(withCust);
        const t = await P.poll(
          () => pendingCardText(withCust),
          (x) => x.includes(S1()),
          8_000,
        );
        expect(t).toContain(S1());
        expect(t).toContain(A());
      });
      await step(
        'PEND-038 sidebar card: code, Processing, name, masked phone, service, total, Pts, time',
        async () => {
          await returnToHome();
          expect(await sidebarHas(withCust)).toBe(true);
          const t = await P.poll(
            () => sidebarCardText(withCust),
            (x) => x.includes(fmt(total)),
            10_000,
          );
          expect(t).toContain(withCust);
          expect(t).toContain('Processing');
          expect(t).toContain(name);
          expect(t).toContain(masked(phone));
          expect(t).toContain(S1());
          expect(t).toMatch(/\b\d+ Pts\b/);
          expect(t).toMatch(T12);
          await P.fillQ(VqhSidebar.search, '');
        },
      );
    },
  );

  it(
    title(
      'A gift card sale order shows "Gift Card [****-****-xxxx]" on its card (PEND-027)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      // Needs VOLT_TEST_GIFT_CARD (sold, never paid here).
      if (!testGiftCard()) this.skip();
      await quickCheckout();
      await openSellGiftCard();
      await gcEnterCode(testGiftCard());
      await P.fillQ([VqcGiftCard.dialog, VqcGiftCard.customAmount], '1000');
      await P.clickQ(gcAdd);
      await P.waitGoneQ(VqcGiftCard.dialog, 10_000);
      const id = await waitOrderId();
      created.add(id);
      await gotoPendingPage();
      await searchPending(id);
      const last4 = testGiftCard().replace(/[\s-]/g, '').slice(-4);
      expect(
        await P.poll(
          () => pendingCardText(id),
          (t) => t.includes(`Gift Card [****-****-${last4}]`),
          10_000,
        ),
      ).toContain(`Gift Card [****-****-${last4}]`);
    },
  );

  it(
    title(
      'A pending card opens its order on /home; repeated opens never show a FOREIGN KEY (787) error (PEND-029, PEND-030)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const id = await createOrder(A(), [S1()]);
      for (let i = 0; i < 3; i += 1) {
        await openFromPendingPage(id);
        expect(await P.path()).toMatch(/^\/home/);
        expect(await currentOrderId()).toBe(id);
        expect((await orderLines()).map((l) => l.name)).toEqual([S1()]);
        expect(await P.pageText('body')).not.toMatch(/FOREIGN KEY|787/);
        await headerPending();
        expect(await P.pageText('body')).not.toMatch(/FOREIGN KEY|787/);
      }
    },
  );

  it(
    title(
      'Sidebar badge grows by 1 with a new order; sidebar search filters cards and the badge counts them (PEND-037, PEND-039)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async () => {
      await quickCheckout();
      await P.fillQ(VqhSidebar.search, '');
      const before = await sidebarBadge();
      await pickStaff(A());
      const id = await waitOrderId();
      created.add(id);
      await settle(3_000);
      expect(await sidebarBadge()).toBeGreaterThanOrEqual(before + 1);
      expect(await P.has(VqhSidebar.card(id))).toBe(true);
      expect(await sidebarCardText(id)).toContain('Unknown');

      const phone = randomPhone();
      await attachNewCustomer(phone, uniqueName('QC Side'));
      const last4 = phone.slice(-4);
      await P.fillQ(VqhSidebar.search, last4);
      expect(
        await P.poll(
          () => P.has(VqhSidebar.card(id)),
          (v) => v,
          10_000,
        ),
      ).toBe(true);
      await settle(1_000);
      const cards = await P.texts(VqhSidebar.cards);
      for (const c of cards) expect(c).toContain(last4);
      expect(await sidebarBadge()).toBe(cards.length);
      await P.fillQ(VqhSidebar.search, '');
    },
  );

  /* ---------------------------------------------------------------- lifecycle */

  it(
    title(
      'Lifecycle: a staff pick creates a Processing pending order not in Order History; paying moves it out of Pending into Order History (PEND-072, PEND-073)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const id = await createOrder(A(), [S1()]);
      await step(
        'PEND-072 Processing in the sidebar and on /order-pending; absent from Order History',
        async () => {
          expect(await sidebarHas(id)).toBe(true);
          expect(
            await P.poll(
              () => sidebarCardText(id),
              (t) => t.includes('Processing'),
              10_000,
            ),
          ).toContain('Processing');
          await P.fillQ(VqhSidebar.search, '');
          await gotoPendingPage();
          await searchPending(id);
          expect(
            await P.poll(
              () => pendingCardText(id),
              (t) => t.includes('Processing'),
              10_000,
            ),
          ).toContain('Processing');
          expect(await inOrderHistory(id)).toBe(false);
        },
      );
      await step('PEND-073 pay → gone from Pending, present in Order History', async () => {
        await openPendingOrder(id);
        await payCurrentInCash();
        await gotoPendingPage();
        await searchPending(id);
        expect(
          await P.poll(
            () => P.count(VqhPendingPage.card(id)),
            (n) => n === 0,
            5_000,
          ),
        ).toBe(0);
        expect(await inOrderHistory(id)).toBe(true);
      });
      await returnToHome();
    },
  );

  it(
    title('A paid order never comes back to Pending over 30 seconds (PEND-074)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(5 * 60_000);
      const id = await createOrder(A(), [S1()]);
      await payCurrentInCash();
      await gotoPendingPage();
      await searchPending(id);
      for (let i = 0; i < 10; i += 1) {
        expect(await P.count(VqhPendingPage.card(id))).toBe(0);
        await settle(3_000);
      }
      expect(await inOrderHistory(id)).toBe(true);
      await returnToHome();
    },
  );

  it(
    title(
      'Leaving an order (back from checkout / header Pending Orders) and reopening it keeps the same code and data (PEND-076, PEND-077)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (svc.length < 2) this.skip();
      this.timeout(6 * 60_000);
      await step('PEND-076 checkout → back → Pay again: same code, same line, no duplicate', async () => {
        const id = await createOrder(A(), [S1()]);
        await pressPay();
        expect(await P.pageText()).toContain(`Order #${id}`);
        await backToHome(id);
        expect((await orderLines()).map((l) => l.name)).toEqual([S1()]);
        await pressPay();
        expect(await P.pageText()).toContain(`Order #${id}`);
        await backToHome(id);
        await P.fillQ(VqhSidebar.search, id);
        expect(
          await P.poll(
            () => P.count(VqhSidebar.cards),
            (n) => n === 1,
            10_000,
          ),
        ).toBe(1);
        await P.fillQ(VqhSidebar.search, '');
      });
      await step('PEND-077 customer + 2 services + note → header Pending → card: all kept', async () => {
        const id = await createOrder(A(), [S1(), S2()]);
        const name = uniqueName('QC Keep');
        await attachNewCustomer(randomPhone(), name);
        await P.clickQ(VqhOrder.note);
        await P.fillQ(
          inDlg(VqhDialog.orderNote, { css: 'textarea,input', placeholder: 'Order note' }),
          'E2E pend note',
        );
        await P.clickQ(inDlg(VqhDialog.orderNote, btn('Save', 0)));
        await P.waitGoneQ(VqhDialog.orderNote, 8_000);
        await settle(800);
        const before = await summary();
        await headerPending();
        await searchPending(id);
        await P.clickQ(VqhPendingPage.card(id));
        await P.poll(currentOrderId, (v) => v === id, 15_000);
        const t = await P.pageText();
        expect(t).toContain(name);
        expect(t).toContain('E2E pend note');
        expect((await orderLines()).map((l) => l.name)).toEqual([S1(), S2()]);
        expect((await summary()).total ?? NaN).toBeCloseTo(before.total ?? NaN, 2);
      });
    },
  );

  it(
    title(
      'Cancelling while the customer picks a tip keeps the order pending with Remove, no Cancel Order (PEND-078)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const id = await createOrder(A(), [S1()]);
      await pressPay();
      await selectTender('Cash');
      await checkoutPage.pressCompletePayment();
      await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
      const waiting = await P.poll(
        () => checkoutPage.isWaitingForCustomerTip(),
        (v) => v,
        8_000,
      );
      if (!waiting) {
        // The merchant has no customer tip step: the sale settled — nothing to cancel.
        created.delete(id);
        await returnToHome();
        this.skip();
      }
      await P.clickQ(inDlg(VqhDialog.waitingTip, btn('Cancel', 0)));
      await P.waitGoneQ(VqhDialog.waitingTip, 10_000);
      expect(await P.path()).not.toMatch(/payment-success/);
      await gotoPendingPage();
      await searchPending(id);
      expect(await pendingHas(id)).toBe(true);
      await P.clickQ(VqhPendingPage.card(id));
      await P.poll(currentOrderId, (v) => v === id, 15_000);
      expect(await P.has(VqhOrder.remove)).toBe(true);
      expect(await P.count(VqhOrder.cancelOrder)).toBe(0);
    },
  );

  /* ---------------------------------------------------------------- delete */

  it(
    title(
      'Delete a pending order: unknown code refused, Cancel keeps it, Delete removes it everywhere (PEND-080, PEND-081, PEND-082)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const id = await createOrder(A(), [S1()]);
      await dropGrant();
      await P.clickQ(VqhOrder.remove);
      // Needs the Delete Order gate ON (PEND-084 covers it OFF).
      if (!(await passcodeShown(4_000))) {
        await P.clickQ(inDlg(VqhDialog.deleteOrder, btn('Cancel', 0))).catch(() => undefined);
        this.skip();
      }
      await step('PEND-082 unknown code → error, no Delete Order', async () => {
        expect(await passcodeTitle()).toBe(VqhPasscode.deleteOrderTitle);
        const r = await typeCode(unknownCode());
        expect(r.text).toMatch(new RegExp(VqhPasscode.wrongCodeRe));
        expect(await P.count(VqhDialog.deleteOrder)).toBe(0);
        await closePasscode();
        expect(await currentOrderId()).toBe(id);
      });
      await step('PEND-081 right code → Delete Order → Cancel: order intact', async () => {
        await P.clickQ(VqhOrder.remove);
        await typeCode(env.STAFF_PASSCODE);
        await P.waitFor(VqhDialog.deleteOrder, 8_000);
        expect(
          await P.has([
            VqhDialog.deleteOrder,
            { text: 'Are you sure you want to delete this entire order?' },
          ]),
        ).toBe(true);
        await P.clickQ(inDlg(VqhDialog.deleteOrder, btn('Cancel', 0)));
        await P.waitGoneQ(VqhDialog.deleteOrder, 5_000);
        expect(await currentOrderId()).toBe(id);
        expect((await orderLines()).map((l) => l.name)).toEqual([S1()]);
      });
      await step('PEND-080 Delete → gone from the sidebar, /order-pending and Order History', async () => {
        await deleteCurrentOrder();
        expect(
          await P.poll(
            () => P.has(VqcHome.customerInput),
            (v) => v,
            10_000,
          ),
        ).toBe(true);
        expect(await sidebarHas(id, 3_000)).toBe(false);
        await P.fillQ(VqhSidebar.search, '');
        await gotoPendingPage();
        await searchPending(id);
        expect(
          await P.poll(
            () => P.count(VqhPendingPage.card(id)),
            (n) => n === 0,
            5_000,
          ),
        ).toBe(0);
        expect(await inOrderHistory(id)).toBe(false);
        await returnToHome();
      });
    },
  );

  it(
    title('A role without Delete Order is refused at Remove (PEND-083)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      // Needs VOLT_NO_DELETE_ORDER_CODE.
      if (!noDeleteCode()) this.skip();
      const id = await createOrder(A(), [S1()]);
      await dropGrant();
      await P.clickQ(VqhOrder.remove);
      if (!(await passcodeShown(4_000))) this.skip();
      const r = await typeCode(noDeleteCode());
      expect(r.text).toContain(VqhPasscode.noPermissionText);
      expect(await P.count(VqhDialog.deleteOrder)).toBe(0);
      await closePasscode();
      expect(await currentOrderId()).toBe(id);
    },
  );

  it(
    title(
      'Delete Order gate OFF (Settings › Passcode): Remove opens the confirm directly (PEND-084, HOME-153)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const openAccessibility = async (): Promise<void> => {
        await goToSettings();
        await settingsPage.openSection('ACCESSIBILITY');
        await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
      };
      await openAccessibility();
      if (!(await accessibilitySettingsPage.hasGate('delete_order'))) this.skip();
      const original = await accessibilitySettingsPage.isGateOn('delete_order');
      try {
        await accessibilitySettingsPage.setGate('delete_order', false);
        await accessibilitySettingsPage.savePasscodeSettings();
        await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
        await returnToHome();
        await createOrder(A(), [S1()]);
        await dropGrant();
        await P.clickQ(VqhOrder.remove);
        await P.waitFor(VqhDialog.deleteOrder, 8_000, 'Delete Order (no passcode)');
        expect(await P.count(VqcCommon.passcodeDialog)).toBe(0);
        await P.clickQ(inDlg(VqhDialog.deleteOrder, btn('Cancel', 0)));
        await P.waitGoneQ(VqhDialog.deleteOrder, 5_000);
        await deleteCurrentOrder();
      } finally {
        await restoreGrant();
        await openAccessibility();
        await accessibilitySettingsPage.setGate('delete_order', original);
        await accessibilitySettingsPage.savePasscodeSettings();
        await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
        await returnToHome();
      }
    },
  );

  it(
    title(
      '"Do not require passcode for the next 30 minutes" ticked once → the next Remove skips the passcode (PEND-085)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      await createOrder(A(), [S1()]);
      await dropGrant();
      await P.clickQ(VqhOrder.remove);
      if (!(await passcodeShown(4_000))) this.skip();
      await typeCode(env.STAFF_PASSCODE, { skip30: true });
      await P.waitFor(VqhDialog.deleteOrder, 8_000);
      await P.clickQ(inDlg(VqhDialog.deleteOrder, btn('Cancel', 0)));
      expect(await P.localGet('volt-passcode-skip')).toBeTruthy();

      await createOrder(A(), [S1()]);
      await P.clickQ(VqhOrder.remove);
      await P.waitFor(VqhDialog.deleteOrder, 8_000, 'Delete Order (no passcode)');
      expect(await P.count(VqcCommon.passcodeDialog)).toBe(0);
      await P.clickQ(inDlg(VqhDialog.deleteOrder, btn('Cancel', 0)));
    },
  );

  /* ---------------------------------------------------------------- editing a reopened pending order */

  it(
    title(
      'Add / remove a service on a pending order reopened from /order-pending: Total, sidebar card, page card and reopened data follow (PEND-095)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const id = await createOrder(A(), [S1()]);
      const one = (await summary()).total ?? NaN;
      await openFromPendingPage(id);
      await pickStaff(A());
      await addService(S1());
      expect((await orderLines()).filter((l) => l.name === S1())).toHaveLength(2);
      const two = await P.poll(
        async () => (await summary()).total ?? NaN,
        (t) => t > one,
        10_000,
      );
      await settle(800);
      expect(await sidebarHas(id)).toBe(true);
      expect(
        await P.poll(
          () => sidebarCardText(id),
          (t) => t.includes(fmt(two)),
          10_000,
        ),
      ).toContain(fmt(two));
      await P.fillQ(VqhSidebar.search, '');
      await gotoPendingPage();
      await searchPending(id);
      const card = await pendingCardText(id);
      expect(card.split(S1()).length - 1).toBe(2);
      expect(card).toContain('Processing');

      await openFromPendingPage(id);
      await removeLine(S1());
      expect(
        await P.poll(
          async () => (await summary()).total ?? NaN,
          (t) => Math.abs(t - one) < 0.01,
          10_000,
        ),
      ).toBeCloseTo(one, 2);
      await openFromPendingPage(id);
      expect((await orderLines()).filter((l) => l.name === S1())).toHaveLength(1);
      expect(await inOrderHistory(id)).toBe(false);
    },
  );

  it(
    title(
      'Change staff on a pending order: card + Staff filter follow the new staff, reopening keeps it, Total unchanged (PEND-096)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      if (staff.length < 2) this.skip();
      this.timeout(5 * 60_000);
      const id = await createOrder(A(), [S1()]);
      await openFromPendingPage(id);
      const total0 = (await summary()).total ?? NaN;
      await P.clickQ(VqhOrder.changeStaff);
      await P.waitFor(VqhOrder.changeFrom, 5_000);
      await P.jsClickQ(VqhOrder.staffTile(B()));
      await P.clickQ(inDlg(VqhDialog.changeStaffConfirm, btn('Confirm', 0)));
      expect(await P.poll(orderStaffNames, (n) => n.includes(B()), 10_000)).toEqual([B()]);
      expect((await summary()).total ?? NaN).toBeCloseTo(total0, 2);
      await settle(800);
      await gotoPendingPage();
      await searchPending(id);
      const t = await pendingCardText(id);
      expect(t).toContain(B());
      expect(t).not.toContain(A());
      await staffFilter([B()]);
      expect(await pendingHas(id)).toBe(true);
      await staffFilter([A()]);
      expect(
        await P.poll(
          () => P.count(VqhPendingPage.card(id)),
          (n) => n === 0,
          5_000,
        ),
      ).toBe(0);
      await staffFilter(null);
      await openFromPendingPage(id);
      expect(await P.poll(orderStaffNames, (n) => n.length > 0, 10_000)).toEqual([B()]);
    },
  );

  it(
    title(
      'Custom Discount 10% on a pending order: still Pending, card Total updated, Promotion kept on reopen (PEND-097)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const id = await quickPayOrder(A(), [{ cents: 5000, name: 'QP pend 50' }]);
      await openFromPendingPage(id);
      await P.clickQ(VqhOrder.promo);
      const dlg = { css: '[role="dialog"]', hasText: 'Promo & Rewards', nth: -1 } as const;
      await P.waitFor(dlg, 8_000, 'Promo & Rewards');
      if ((await P.attrOf([dlg, { role: 'checkbox', nth: 0 }], 'aria-checked')) !== 'true')
        await P.clickQ([dlg, { role: 'checkbox', nth: 0 }]);
      await P.clickQ([dlg, { role: 'tab', name: 'Percentage %' }]);
      await P.fillQ([dlg, { role: 'textbox', nth: 0 }], '10');
      await P.clickQ([dlg, btn('Apply', 0)]);
      await passcodeDialog.unlockForRun(env.STAFF_PASSCODE, { timeout: 2_000 });
      await P.waitGoneQ(dlg, 8_000);
      const s = await P.poll(summary, (x) => x.promotion !== null, 10_000);
      expect(s.promotion ?? 0).toBeLessThanOrEqual(-5 + 0.01);
      expect(s.total ?? NaN).toBeCloseTo(
        (s.subtotal ?? 0) + (s.promotion ?? 0) + (s.itemDiscount ?? 0) + (s.tax ?? 0),
        1,
      );
      await settle(800);
      expect(await sidebarHas(id)).toBe(true);
      expect(
        await P.poll(
          () => sidebarCardText(id),
          (t) => t.includes(fmt(s.total ?? NaN)),
          10_000,
        ),
      ).toContain(fmt(s.total ?? NaN));
      await P.fillQ(VqhSidebar.search, '');
      await gotoPendingPage();
      await searchPending(id);
      expect(await pendingCardText(id)).toContain('Processing');
      expect(await inOrderHistory(id)).toBe(false);
      await openFromPendingPage(id);
      const again = await summary();
      expect(again.promotion ?? NaN).toBeCloseTo(s.promotion ?? NaN, 2);
      expect(again.total ?? NaN).toBeCloseTo(s.total ?? NaN, 2);
    },
  );

  /* ---------------------------------------------------------------- Checkin Today (read-only on today's data) */

  it(
    title(
      'Checkin Today shows its count and one card per check-in; an Active card opens that pending order, a Completed one its detail (PEND-041, PEND-042, PEND-043)',
      Tag.REGRESSION,
    ),
    async function () {
      await quickCheckout();
      const head = VqcHome.checkinToday;
      const n = Number(/\((\d+)\)/.exec(await P.textOf(head))?.[1] ?? NaN);
      // Needs at least one GoCheckin check-in today on this merchant.
      if (!(n > 0)) this.skip();
      const wasOpen = /Hide/.test(await P.textOf(head));
      if (!wasOpen) await P.clickQ(head);
      try {
        const cards = {
          css: 'main [data-slot="card"], main div.cursor-pointer',
          hasText: 'Checkin:',
        } as const;
        const count = await P.poll(
          () => P.count(cards),
          (c) => c > 0,
          8_000,
        );
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThanOrEqual(n);
        const texts = await P.texts(cards);
        const activeIdx = texts.findIndex((t) => /Active|Processing/i.test(t));
        if (activeIdx >= 0) {
          await P.clickQ({ ...cards, nth: activeIdx });
          const id = await P.poll(currentOrderId, (v) => v !== '', 10_000);
          expect(id).toMatch(/^OD\d{6}-\d+$/);
          await quickCheckout();
          if (!/Hide/.test(await P.textOf(head))) await P.clickQ(head);
        }
        const doneIdx = (await P.texts(cards)).findIndex((t) => /Completed|Finished/i.test(t));
        if (doneIdx >= 0) {
          await P.clickQ({ ...cards, nth: doneIdx });
          await passcodeDialog.unlockForRun(env.STAFF_PASSCODE, { timeout: 3_000 });
          expect(
            await P.poll(
              () => P.path(),
              (p) => p.startsWith('/order-history/'),
              15_000,
            ),
          ).toMatch(/^\/order-history\//);
          await returnToHome();
        }
      } finally {
        await quickCheckout().catch(() => undefined);
        if ((await P.textOf(head).catch(() => '')).includes('Hide') !== wasOpen)
          await P.clickQ(head).catch(() => undefined);
      }
    },
  );

  it(
    title('Rendered cards on Last 7 Days all carry a "MMM d, yyyy hh:mm" time (PEND-006)', Tag.REGRESSION),
    async () => {
      await gotoPendingPage();
      await choosePreset('Last 7 Days');
      for (const c of await renderedCards()) expect(c.text).toMatch(DATETIME_MEDIUM_RE);
      await choosePreset('Today');
    },
  );
});
