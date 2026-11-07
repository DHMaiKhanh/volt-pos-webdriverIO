/**
 * Checkout Type (VP-4591) — Re-Open only changes the staff, points stay put.
 *
 * Replaces the old Re-Open cases (Edit Order + re-complete per type, re-open to
 * another customer: CHK-POS-027..030 in checkout-type.spec.ts, 026..029 in the
 * 30/10 Linear summary). Re-Open now lets the cashier change the staff only —
 * items, prices and the customer stay locked (VP-5290 / VP-5291 behaviour) — so
 * the one thing left to prove for Checkout Type is that a staff change does not
 * re-award points.
 *
 * Flow: a Home order (staff → customer keypad → service) for `LOYALTY_CUSTOMER_PHONE` on Cash (first award
 * measured against the live setting, any type) → Order History → Re-Open → Edit
 * Order → try to add a service (must be refused) → Change Staff to another tile
 * → Pay → Re-Open Done. Then: the detail lists the new staff, the total did not
 * move, the balance and the order's `pointBonus` stamp did not change.
 *
 * The RO-M01..M06 block replays the 03/11 manual pass on one two-staff order
 * with a $20 cashier tip: every editor control except Change Staff is locked,
 * the tip follows the new staff, a staff already on the order cannot be picked,
 * an abandoned re-open parks as "Re-open" and finishes through "Continue
 * Re-open" — and the balance never moves after the first completion.
 *
 * Screens go to `.tmp/vp4591-reopen-staff/` for the Linear comment.
 *
 *   APP_PATH="$LOCALAPPDATA\Volt POS\volt-pos.exe" npm run test:attach -- \
 *     --spec tests/regression/checkout-type/vp-4591-reopen-change-staff.spec.ts
 *
 * CREATES DATA and grows a real customer's points. dev / staging only.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { browser, expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { OhRoButtons } from '../../../src/constants/testids.voltqc-oh-reopen.js';
import { expectedAward } from '../../../src/domain/index.js';
import { payInCash } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { settle } from '../../../src/helpers/wait.js';
import { checkoutPage, homePage } from '../../../src/pages/index.js';
import {
  buildCart,
  cartLineCount,
  changeStaffTo,
  detailText,
  editOrderFromCheckout,
  enterChangeStaff,
  field,
  leaveReopen,
  mainText,
  openHistoryOrder,
  payFromEdit,
  reopenDialogText,
  reopenDone,
  reopenToCheckout,
  reopenToHome,
  staffInDetail,
} from '../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { moduleLogger } from '../../../src/utils/logger.js';
import { abandonReopen } from '../order-flow/reopen-flow.helpers.js';
import { liveSetting, loyalty, loyaltyPhone, skipUnless } from './checkout-type.helpers.js';

const log = moduleLogger('reopen-staff');
const SHOT_DIR = join('.tmp', 'vp4591-reopen-staff');

async function shot(name: string): Promise<void> {
  mkdirSync(SHOT_DIR, { recursive: true });
  await browser.saveScreenshot(join(SHOT_DIR, `${name}.png`));
}

/** Outlast GoCheckin's lag: "no change" is only proven by waiting the full window. */
async function balanceAfterWindow(phone: string, before: number): Promise<number> {
  let last = before;
  await browser
    .waitUntil(
      async () => {
        last = await loyalty.currentPoints(phone);
        return last !== before;
      },
      { timeout: Timeouts.API, interval: 1_000 },
    )
    .catch(() => undefined);
  return last;
}

/** Live staff tiles on Home (`staff-tile-<id>`, 1.1.90). */
const STAFF_TILE_CSS = '[data-testid^="staff-tile-"]';
/** The order header's remove-customer button — see `HomeIds.orderRemoveCustomerBtn`. */
const REMOVE_CUSTOMER_XPATH =
  '(//div[contains(@class,"min-w-[120px]")]//button[contains(@class,"size-13")])[2]';

/** Is the staff tile showing `name` dead to the pointer (re-open editor / already on the order)? */
function staffTileLocked(name: string): Promise<boolean> {
  return browser.execute(
    (css, staff) => {
      const tile = [...document.querySelectorAll<HTMLElement>(css)].find((t) => t.innerText.includes(staff));
      if (!tile) throw new Error(`no staff tile for ${staff}`);
      return getComputedStyle(tile).pointerEvents === 'none';
    },
    STAFF_TILE_CSS,
    name,
  );
}

/** Name of the `index`-th staff tile on Home. */
function staffTileName(index: number): Promise<string> {
  return browser.execute(
    (css, i) => document.querySelectorAll<HTMLElement>(css)[i]?.innerText.split('\n')[0]?.trim() ?? '',
    STAFF_TILE_CSS,
    index,
  );
}

/** `Staff - $10.00` pairs from the detail's Tip section, as `{ staff: cents }`. */
function tipByStaff(detail: string): Record<string, number> {
  const start = detail.indexOf('| Tip | Last updated');
  const end = detail.indexOf('Payment Details', start);
  if (start < 0) return {};
  const out: Record<string, number> = {};
  for (const m of detail
    .slice(start, end > 0 ? end : undefined)
    .matchAll(/\| ([^|]+?) - \$([\d,]+\.\d{2})/g)) {
    out[(m[1] ?? '').trim()] = Math.round(Number((m[2] ?? '0').replace(/,/g, '')) * 100);
  }
  return out;
}

interface PaidOrder {
  orderId: string;
  before: number;
  after: number;
  order: NonNullable<Awaited<ReturnType<typeof loyalty.orderPointState>>>;
  expected: ReturnType<typeof expectedAward>;
}

/**
 * Build `lines` ([staff tile, service tile]) on a FRESH till, attach `phone` by
 * keypad, optionally add a cashier tip, pay Cash, and measure the award.
 *
 * `buildCart` clears any draft first: on a till other runs share, tapping a staff
 * can otherwise land on a leftover pending order that already has a customer.
 */
async function payFreshOrder(
  phone: string,
  setting: Awaited<ReturnType<typeof liveSetting>>,
  lines: readonly (readonly [number, number])[],
  tipCents?: number,
): Promise<PaidOrder> {
  const before = await loyalty.currentPoints(phone);
  await buildCart(lines);
  await homePage.attachCustomerByPhone(phone);
  expect(await homePage.isNewCustomerFormShown()).toBe(false);
  const checkout = await homePage.pressPay();
  await checkout.waitForReady();
  const orderId = await checkout.orderId();
  if (tipCents !== undefined) {
    await step(`Add a cashier tip of ${String(tipCents)}¢`, () => checkoutPage.addCashierTip(tipCents));
  }
  const success = await payInCash(orderId);
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();

  const order = await loyalty.orderPointState(orderId);
  if (!order) throw new Error(`Order ${orderId} is not in the schema after completion.`);
  const expected = expectedAward({
    setting,
    transactions: order.transactions,
    items: order.items,
    orderTotal: order.total,
    tipTotal: order.tipAmount ?? 0,
  });
  let after = before;
  await browser
    .waitUntil(
      async () => {
        after = await loyalty.currentPoints(phone);
        return expected.points !== 0 && after === before + expected.points;
      },
      { timeout: Timeouts.API, interval: 1_000 },
    )
    .catch(() => undefined);
  return { orderId, before, after, order, expected };
}

/** Shared state for the RO-M block — one order, walked case by case. */
interface ManualRun {
  phone: string;
  orderId: string;
  code: string;
  points: number;
  pointBonus: number | null;
  total: string;
  customer: string;
  /** [first column, second column] staff names at first completion. */
  staff: [string, string];
}

// PENDING 04/11/2026: Re-Open Order tạm không test (theo yêu cầu) — bỏ .skip để chạy lại.
describe.skip('Checkout Type — Re-Open change staff (VP-4591)', () => {
  let orderId = '';

  before(() => {
    assertWritesAllowed('complete and re-open an order for a loyalty customer');
  });

  after(async () => {
    if (orderId !== '') await leaveReopen();
  });

  it(
    title(
      'CHK-POS-026: Re-Open only changes the staff and adds no points',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      const phone = loyaltyPhone(this);
      const setting = await liveSetting();

      const first = await payFreshOrder(phone, setting, [[0, 0]]);
      orderId = first.orderId;
      expect(first.after - first.before).toBe(first.expected.points);

      const code = await openHistoryOrder(orderId);
      const before = await detailText(code);
      const staffBefore = staffInDetail(before);
      const totalBefore = field(before, 'Total');
      await shot('01-paid-detail');

      const dialog = await reopenDialogText(orderId);
      log.info(`[reopen-staff] ${code} Re-Open dialog: ${dialog}`);

      await reopenToHome(orderId);
      await shot('02-edit-order');

      const lines = await cartLineCount();
      await homePage.addServiceByIndex(1).catch(() => undefined);
      await settle(Timeouts.DEBOUNCE);
      const linesAfterAdd = await cartLineCount();
      await shot('03-add-service-attempt');

      await step('Change Staff to the 2nd staff tile', () => changeStaffTo(1));
      await shot('04-staff-changed');

      const pointsBefore = await loyalty.currentPoints(phone);
      await payFromEdit();
      await shot('05-reopened-checkout');
      await reopenDone();

      const after = await detailText(code);
      const staffAfter = staffInDetail(after);
      await shot('06-detail-after');
      const pointsAfter = await balanceAfterWindow(phone, pointsBefore);
      const stamp = await loyalty.orderPointState(orderId);
      orderId = '';

      log.info(
        `[reopen-staff] ${code}: staff ${staffBefore.join(',')} → ${staffAfter.join(',')}; ` +
          `total ${totalBefore} → ${field(after, 'Total')}; lines ${String(lines)} → ${String(linesAfterAdd)}; ` +
          `points 1st +${String(first.after - first.before)}, re-complete ${String(pointsBefore)} → ${String(pointsAfter)}; ` +
          `pointBonus ${String(first.order.pointBonus)} → ${String(stamp?.pointBonus)}`,
      );

      expect(linesAfterAdd).toBe(lines);
      expect(staffAfter).not.toEqual(staffBefore);
      expect(field(after, 'Total')).toBe(totalBefore);
      expect(pointsAfter).toBe(pointsBefore);
      expect(stamp?.pointBonus).toBe(first.order.pointBonus);
    },
  );
});

// PENDING 04/11/2026: Re-Open Order tạm không test (theo yêu cầu) — bỏ .skip để chạy lại.
describe.skip('Checkout Type — Re-Open locks, change staff with tip, resume (VP-4591, manual 03/11)', () => {
  const TIP_CENTS = 2_000;
  let run: ManualRun | null = null;
  let reopened = false;

  /** The RO-M cases share one order: a later case without it has nothing to work on. */
  function need(ctx: Mocha.Context): ManualRun {
    if (run === null) {
      skipUnless(ctx, false, 'RO-M01 did not complete the shared order');
      throw new Error('unreachable: skip() throws the Mocha Pending marker');
    }
    return run;
  }

  async function pointsUnchanged(r: ManualRun): Promise<void> {
    expect(await balanceAfterWindow(r.phone, r.points)).toBe(r.points);
    expect((await loyalty.orderPointState(r.orderId))?.pointBonus).toBe(r.pointBonus);
  }

  before(() => {
    assertWritesAllowed('complete and re-open an order for a loyalty customer');
  });

  after(async () => {
    if (reopened) await leaveReopen();
  });

  it(
    title(
      'RO-M01: two-staff order with a $20 tip earns once by type',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      const phone = loyaltyPhone(this);
      const setting = await liveSetting();
      const { orderId, before, after, order, expected } = await payFreshOrder(
        phone,
        setting,
        [
          [0, 0],
          [1, 1],
        ],
        TIP_CENTS,
      );

      const code = await openHistoryOrder(orderId);
      const detail = await detailText(code);
      const [first = '', second = ''] = staffInDetail(detail);
      const staff: [string, string] = [first, second];
      await shot('m01-paid-detail');
      log.info(
        `[reopen-manual] ${code}: staff ${staff.join(' + ')}, total ${field(detail, 'Total')}, ` +
          `points ${String(before)} → ${String(after)} (expected +${String(expected.points)}), tip ${JSON.stringify(tipByStaff(detail))}`,
      );

      expect(order.tipAmount).toBe(TIP_CENTS);
      expect(after - before).toBe(expected.points);
      expect(order.pointBonus).toBe(expected.points);
      expect(staffInDetail(detail)).toHaveLength(2);
      run = {
        phone,
        orderId,
        code,
        points: after,
        pointBonus: order.pointBonus,
        total: field(detail, 'Total'),
        customer: field(detail, 'Customer'),
        staff,
      };
    },
  );

  it(
    title('RO-M02: the re-open editor locks items, prices and the customer', Tag.REGRESSION, Tag.WRITE),
    async function () {
      const r = need(this);
      await reopenToHome(r.orderId);
      reopened = true;
      await shot('m02-editor');

      const lines = await cartLineCount();
      await homePage.addServiceByIndex(2).catch(() => undefined);
      await settle(Timeouts.DEBOUNCE);
      expect(await cartLineCount()).toBe(lines);
      expect(await staffTileLocked(r.staff[0])).toBe(true);

      // Clicking a line opens the note-only popup, never the price editor.
      const priceEditor = await homePage.openServiceEditor().then(
        () => true,
        () => false,
      );
      await shot('m02-line-click');
      await homePage.dismissOpenDialogs();
      expect(priceEditor).toBe(false);

      await $(REMOVE_CUSTOMER_XPATH)
        .click()
        .catch(() => undefined);
      await settle(Timeouts.DEBOUNCE);
      await homePage.dismissOpenDialogs();
      expect(await mainText()).toContain(r.customer);
      expect(await cartLineCount()).toBe(lines);
    },
  );

  it(
    title(
      'RO-M03: change staff on the 2nd column — tip follows, points stay',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      const r = need(this);
      skipUnless(this, reopened, 'RO-M02 did not leave the order in the re-open editor');
      const target = await staffTileName(4);
      await step(`Change Staff ${r.staff[1]} → ${target}`, () => changeStaffTo(4, 1));
      await shot('m03-staff-changed');
      r.staff = [r.staff[0], target];
    },
  );

  it(
    title('RO-M04: a staff already on the order cannot be the change target', Tag.REGRESSION, Tag.WRITE),
    async function () {
      const r = need(this);
      skipUnless(this, reopened, 'not in the re-open editor');
      await enterChangeStaff(0);
      await shot('m04-same-staff');
      const locked = await staffTileLocked(r.staff[1]);
      await homePage.cancelChangeStaff();
      expect(locked).toBe(true);

      await payFromEdit();
      await reopenDone();
      reopened = false;
      const detail = await detailText(r.code);
      await shot('m04-detail-after');
      const tips = tipByStaff(detail);
      log.info(
        `[reopen-manual] ${r.code}: staff ${staffInDetail(detail).join(' + ')}, tip ${JSON.stringify(tips)}`,
      );

      expect(staffInDetail(detail)).toEqual(r.staff);
      expect(Object.keys(tips).sort()).toEqual([...r.staff].sort());
      expect(Object.values(tips).reduce((a, b) => a + b, 0)).toBe(TIP_CENTS);
      expect(field(detail, 'Total')).toBe(r.total);
      await pointsUnchanged(r);
    },
  );

  it(
    title('RO-M05: an abandoned re-open parks the order as "Re-open"', Tag.REGRESSION, Tag.WRITE),
    async function () {
      const r = need(this);
      await reopenToCheckout(r.orderId);
      reopened = true;
      await abandonReopen(r.orderId);
      const detail = await detailText(r.code);
      await shot('m05-abandoned');
      expect(field(detail, 'Status')).toBe('Re-open');
      expect(detail).toContain(OhRoButtons.continueReopen);
    },
  );

  it(
    title('RO-M06: Continue Re-open → Re-Open Done unchanged adds no points', Tag.REGRESSION, Tag.WRITE),
    async function () {
      const r = need(this);
      await reopenToCheckout(r.orderId, OhRoButtons.continueReopen);
      await editOrderFromCheckout();
      await reopenDone();
      reopened = false;
      const detail = await detailText(r.code);
      await shot('m06-done-unchanged');
      expect(field(detail, 'Status')).toContain('Successful');
      expect(staffInDetail(detail)).toEqual(r.staff);
      expect(field(detail, 'Total')).toBe(r.total);
      await pointsUnchanged(r);
    },
  );
});
