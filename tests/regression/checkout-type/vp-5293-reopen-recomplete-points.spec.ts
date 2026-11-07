/**
 * VP-5293 — Re-Open → complete lại phải THU HỒI điểm cũ rồi cộng theo tổng mới,
 * kể cả ở lần re-open ĐẦU TIÊN ngay sau khi mở app (đơn không có trong cache).
 *
 * Từ VP-5290/5291 Re-Open chỉ cho đổi thợ (item/giá/khách khoá), nên tổng không
 * đổi: đúng rule VP-4980 là −N rồi +N → số dư KHÔNG đổi, `pointBonus` giữ nguyên.
 * Lỗi cũ (cộng chồng) sẽ hiện thành số dư +N.
 *
 * Chạy 2 pha:
 *   1. VP5293_PHASE=pay   — thanh toán đơn A (Cash) cho LOYALTY_CUSTOMER_PHONE, ghi id vào .tmp/vp5293.json
 *   2. (tắt app, mở lại app có CDP)
 *   3. VP5293_PHASE=reopen — TC-5293-01 re-open đơn A (lần đầu sau launch) + TC-5293-02 đơn B cùng phiên
 *
 *   VP5293_PHASE=pay npm run test:attach -- --spec tests/regression/checkout-type/vp-5293-reopen-recomplete-points.spec.ts
 *
 * Dòng log POS (1.1.109+) được đối chiếu ở `%LOCALAPPDATA%\VoltPOS\logs\<yyyy-MM-dd>.log`.
 * CREATES DATA. dev / staging only.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { browser, expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { expectedAward } from '../../../src/domain/index.js';
import { payInCash } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { homePage } from '../../../src/pages/index.js';
import {
  buildCart,
  changeStaffTo,
  detailText,
  field,
  leaveReopen,
  openHistoryOrder,
  payFromEdit,
  reopenDone,
  reopenToHome,
  staffInDetail,
} from '../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { moduleLogger } from '../../../src/utils/logger.js';
import { liveSetting, loyalty, loyaltyPhone, skipUnless } from './checkout-type.helpers.js';

const log = moduleLogger('vp-5293');
const SHOT_DIR = join('.playwright-mcp', 'VP-5293');
const STATE_FILE = join('.tmp', 'vp5293.json');
const PHASE = process.env.VP5293_PHASE ?? 'reopen';

interface Paid {
  orderId: string;
  phone: string;
  points: number;
  pointBonus: number | null;
  award: number;
}

async function shot(name: string): Promise<void> {
  mkdirSync(SHOT_DIR, { recursive: true });
  await browser.saveScreenshot(join(SHOT_DIR, `${name}.png`));
}

function logFileToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const base = process.env.LOCALAPPDATA ?? '';
  return join(
    base,
    'VoltPOS',
    'logs',
    `${String(d.getFullYear())}-${p(d.getMonth() + 1)}-${p(d.getDate())}.log`,
  );
}

/** The `[checkinAndCheckout] re-complete of order <id>` line, polled (the log is flushed lazily). */
async function recompleteLogLine(orderId: string): Promise<string> {
  let line = '';
  await browser
    .waitUntil(
      () => {
        const file = logFileToday();
        if (!existsSync(file)) return false;
        line =
          readFileSync(file, 'utf8')
            .split(/\r?\n/)
            .find((l) => l.includes(`re-complete of order ${orderId}`)) ?? '';
        return line !== '';
      },
      { timeout: 30_000, interval: 1_000 },
    )
    .catch(() => undefined);
  return line;
}

/** "No change" is only proven by outlasting GoCheckin's window. */
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

async function payFresh(phone: string, tag: string): Promise<Paid> {
  const setting = await liveSetting();
  log.info(`checkout type = ${setting.checkoutType}`);
  const before = await loyalty.currentPoints(phone);
  await buildCart([[0, 0]]);
  await homePage.attachCustomerByPhone(phone);
  const checkout = await homePage.pressPay();
  await checkout.waitForReady();
  const orderId = await checkout.orderId();
  const success = await payInCash(orderId);
  await success.continueToNextOrder();
  await success.waitForFlowToEnd();
  const order = await loyalty.orderPointState(orderId);
  if (!order) throw new Error(`Order ${orderId} not found after completion`);
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
  log.info(
    `[${tag}] paid ${orderId}: points ${String(before)} → ${String(after)} (expected +${String(expected.points)}), pointBonus=${String(order.pointBonus)}`,
  );
  expect(after - before).toBe(expected.points);
  return { orderId, phone, points: after, pointBonus: order.pointBonus, award: expected.points };
}

/** Re-Open → Change Staff → Pay → Re-Open Done, then prove no double earn. */
async function reopenAndCheck(p: Paid, tag: string): Promise<void> {
  const code = await openHistoryOrder(p.orderId);
  const before = await detailText(code);
  await shot(`${tag}-01-paid-detail`);
  await reopenToHome(p.orderId);
  await shot(`${tag}-02-reopen-editor`);
  await step('Change Staff to the 2nd staff tile', () => changeStaffTo(1));
  const pointsBefore = await loyalty.currentPoints(p.phone);
  await payFromEdit();
  await shot(`${tag}-03-reopen-checkout`);
  await reopenDone();
  const after = await detailText(code);
  await shot(`${tag}-04-detail-after`);
  const pointsAfter = await balanceAfterWindow(p.phone, pointsBefore);
  const stamp = await loyalty.orderPointState(p.orderId);
  const line = await recompleteLogLine(p.orderId);
  log.info(
    `[${tag}] ${code}: staff ${staffInDetail(before).join(',')} → ${staffInDetail(after).join(',')}; ` +
      `points ${String(pointsBefore)} → ${String(pointsAfter)}; pointBonus ${String(p.pointBonus)} → ${String(stamp?.pointBonus)}; log: ${line}`,
  );
  expect(field(after, 'Total')).toBe(field(before, 'Total'));
  expect(pointsAfter).toBe(pointsBefore);
  expect(stamp?.pointBonus).toBe(p.pointBonus);
  // POS must have sent the revoke (pointBonus = the first earn) with the owner stamp.
  expect(line).toContain(`pointBonus ${String(p.pointBonus)}, owner stamp present`);
}

describe('VP-5293 — Re-Open re-complete revokes the old earn (no double points)', () => {
  let reopened = false;

  before(() => {
    assertWritesAllowed('complete and re-open an order for a loyalty customer');
  });

  after(async () => {
    if (reopened) await leaveReopen().catch(() => undefined);
  });

  it(
    title(
      'TC-5293-00: pay order A (Cash) for the loyalty customer — phase "pay"',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      skipUnless(this, PHASE === 'pay', 'only in VP5293_PHASE=pay');
      const phone = loyaltyPhone(this);
      const paid = await payFresh(phone, 'A');
      mkdirSync('.tmp', { recursive: true });
      writeFileSync(STATE_FILE, JSON.stringify(paid, null, 2));
      await shot('A-00-paid');
    },
  );

  it(
    title(
      'TC-5293-01: first Re-Open right after app launch revokes the old earn',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      skipUnless(this, PHASE === 'reopen' && existsSync(STATE_FILE), 'needs phase "pay" + app restart first');
      const paid = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as Paid;
      paid.points = await loyalty.currentPoints(paid.phone);
      reopened = true;
      await reopenAndCheck(paid, 'TC01');
      reopened = false;
    },
  );

  it(
    title(
      'TC-5293-02: Re-Open in the same session (order in cache) revokes the old earn',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      skipUnless(this, PHASE === 'reopen', 'only in VP5293_PHASE=reopen');
      const phone = loyaltyPhone(this);
      const paid = await payFresh(phone, 'B');
      reopened = true;
      await reopenAndCheck(paid, 'TC02');
      reopened = false;
    },
  );
});
