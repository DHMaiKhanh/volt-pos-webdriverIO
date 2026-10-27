/**
 * volt-qc port — 07 ORDER HISTORY, the cases that need gift cards, splits, reports, settings or the
 * Vietnamese locale.
 *
 * Source: volt-qc `e2e/tests/07-order-history/oh-deep.spec.ts` (OH-D11 pending-with-payment, D13 Tip Timing,
 * D14 Vietnamese, D15 refund options VI, D16 Batch History), `oh-plan-detail.spec.ts` (OH-T27, T54, T56),
 * `oh-plan-reopen-tip.spec.ts` (OH-T74 income half, T75), `oh-plan-list.spec.ts` (OH-T22 search staff).
 * TC catalogue: docs/qc/volt-qc/windows-regression/07-order-history.md.
 *
 * Drives the volt-qc `app` port by ORDER CODE with the merchant-14 fixtures (VOLT_TEST_STAFF[_2],
 * VOLT_TEST_SERVICE[_2], VOLT_TEST_GIFT_CARD / GIFT_CARD_CODE). Money in dollars.
 *
 * WRITES: orders, cancels, gift-card top-ups; the EXCLUSIVE cases switch the till language / Tip
 * Timing and put them back in `finally`. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { VqcOrderHistory as OH, btn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { CdSettings } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { readLanguage, setLanguage } from '../../../../src/pages/voltqc/cd-e2e/settingsCd.js';
import {
  adjustTipTo,
  findHistoryCode,
  paymentSection,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import {
  GC,
  createSplitPaid,
  freshDetail,
  leaveReopenVq,
  payAndReopenDone,
  reopenToHome,
  staffSegment,
} from '../../../../src/pages/voltqc/oh-reopen/vqReopen.js';
import { settledGiftCardBalance } from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import { openSplit, payCheck, settleSplit } from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import { app, field, vqEnv, visible, waitUntil } from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import {
  collectCodes,
  inFilter,
  openFilter,
  openRow,
  rowCodes,
} from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  batchReview,
  clickBatchAmount,
  closeOrderDetails,
  dailyCards,
  openBatch,
  openDaily,
  openStaffIncome,
  orderDetailsButtons,
  orderDetailsText,
  staffList,
  waitOrderDetails,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const GC_LINE = /Gift Card \[[*\-\d]+\]/;
const SEARCH_ANY = inMain({ css: 'input', nth: 0 });

/** Open an order by code on a list whose labels may be translated. */
async function openByCodeAnyLang(code: string): Promise<string> {
  await app.go('/home', { passcode: false });
  await P.routerGo('/order-history');
  await app.passcodeIfAsked(3_000);
  await P.waitFor({ css: OH.rowCss }, Timeouts.MEDIUM, 'order rows');
  await P.fillQ(SEARCH_ANY, code);
  await waitUntil(async () => (await rowCodes()).includes(code), 20_000, 300);
  await openRow(code);
  await settle(1_500);
  return P.pageText('main');
}

async function staffIncomeRow(name: string): Promise<{ orders: number; tip: number }> {
  await openStaffIncome();
  await waitUntil(async () => (await staffList()).rows.length > 0, 30_000, 1_000);
  const row = (await staffList()).rows.find((r) => r.name === name);
  return { orders: row?.orders ?? 0, tip: row?.tip ?? 0 };
}

describe('volt-qc 07 ORDER HISTORY — gift card, split, reports, settings, Vietnamese (write)', () => {
  afterEach(async () => {
    await leaveReopenVq();
  });

  /* ---------------- gift card ---------------- */

  it(
    title(
      'A gift-card top-up order lists "Gift Card [****-****-xxxx]" under Store; in reopen that line is read-only (OH-071, OH-163)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      if (!GC()) this.skip();
      const id = await app.topUpGiftCard(GC(), 10);
      const d = await freshDetail(id);
      const svc = d.slice(d.indexOf('Service Details'), d.indexOf('Payment Details'));
      expect(svc).toMatch(/\| Store \|/);
      expect(svc).toMatch(GC_LINE);
      expect(svc).toContain(GC().slice(-4));
      await reopenToHome(id);
      const rows = await P.count({ css: 'main div.pr-11' });
      await P.clickQ(inMain({ textRe: '^Gift Card \\[', nth: 0 })).catch(() => undefined);
      await settle(1_000);
      const sell = { role: 'dialog' as const, name: 'Sell Gift Card', nth: -1 };
      if (await visible(sell)) {
        expect(await P.isDisabled([sell, { role: 'textbox', name: 'Enter gift card code' }])).toBe(true);
        expect(await P.has([sell, btn('Add')])).toBe(false);
        await P.clickQ([sell, btn('Close', 0)]);
      }
      expect(await P.count({ css: 'main div.pr-11' })).toBe(rows);
      const del = [
        { css: 'main div.pr-11', hasText: 'Gift Card', nth: 0 },
        { css: 'button.text-destructive', nth: 0 },
      ] as const;
      if (await P.has(del)) expect(await P.isDisabled(del)).toBe(true);
      await payAndReopenDone();
    },
  );

  it(
    title(
      'Cancelling a gift-card top-up while the card still holds the amount: Canceled, balance back to before (OH-122)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(7 * 60_000);
      if (!GC()) this.skip();
      const b0 = await settledGiftCardBalance(GC());
      const id = await app.topUpGiftCard(GC(), 10);
      await app.openHistoryOrder(id);
      await app.cancelOrder(0);
      expect(await app.waitHistoryStatus(id, /^Canceled$/)).toBe('Canceled');
      expect(await app.text('body')).not.toMatch(/Unable to Cancel Order|not enough balance/i);
      expect(await settledGiftCardBalance(GC())).toBeCloseTo(b0, 1);
    },
  );

  it(
    title(
      'Cancelling an order paid by two gift-card txns (split) refunds each to the card and ends Canceled, not stuck Canceling (OH-123)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      if (!GC()) this.skip();
      const b0 = await settledGiftCardBalance(GC());
      const { id } = await createSplitPaid(['Gift Card', 'Gift Card'], { giftCard: GC() });
      await app.openHistoryOrder(id);
      await app.cancelOrder(0);
      expect(await app.waitHistoryStatus(id, /^Canceled$/)).toBe('Canceled');
      expect(await settledGiftCardBalance(GC())).toBeCloseTo(b0, 1);
    },
  );

  /* ---------------- pending with a payment ---------------- */

  it(
    title(
      'Pending order with one check paid: Home › Cancel Order only points to Order History ("Order already has a payment"); detail says "Status is being updated" (OH-081, OH-130)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const id = await app.createOrder({ services: [vqEnv.testService, vqEnv.testService2] });
      await openSplit();
      await payCheck(id, 1, 'Cash');
      try {
        await app.openPendingOrder(id);
        await P.clickQ(inMain({ role: 'button', name: 'Cancel Order', nth: 0 }));
        const dlg = { role: 'dialog' as const, hasText: 'Order already has a payment', nth: -1 };
        expect(await waitUntil(() => visible(dlg), 8_000)).toBe(true);
        expect((await P.rawText(dlg)) ?? '').toMatch(/Review it in Order History/);
        await P.clickQ([dlg, btn('Review in Order History', 0)]);
        await app.passcodeIfAsked(2_500);
        await app.waitPath(/\/order-history\/[0-9a-f-]{20,}/, 15_000);
        expect(await app.historyDetail(id)).toContain('Status is being updated');
        expect(await app.text('main')).not.toMatch(/Order canceled successfully/);
      } finally {
        await app.openPendingOrder(id).catch(() => undefined);
        await P.clickQ(inMain({ role: 'button', name: 'Pay', nth: 0 })).catch(() => undefined);
        await settle(2_000);
        await settleSplit(id);
      }
    },
  );

  /* ---------------- reports ---------------- */

  it(
    title(
      'After moving an order to another staff through reopen, Staff Income shows its order and tip under the new staff (OH-162)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const t0 = await staffIncomeRow(vqEnv.testStaff2);
      const { id } = await app.createPaidOrder({ method: 'Cash' });
      await app.openHistoryOrder(id);
      await adjustTipTo('200');
      await waitUntil(async () => field(await app.historyDetail(id), 'Tip') === '$2.00', 15_000);
      await reopenToHome(id);
      await app.changeStaff(vqEnv.testStaff2);
      await payAndReopenDone();
      const d = await freshDetail(id);
      expect(staffSegment(d, vqEnv.testStaff2)).not.toBe('');
      const ok = await waitUntil(
        async () => (await staffIncomeRow(vqEnv.testStaff2)).orders > t0.orders,
        180_000,
        5_000,
      );
      expect(ok).toBe(true);
      const t1 = await staffIncomeRow(vqEnv.testStaff2);
      expect(t1.tip - t0.tip).toBeGreaterThanOrEqual(200);
    },
  );

  it(
    title(
      'The list for a date range agrees with the Daily Sale order count of the same range (OH-048)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(5 * 60_000);
      await findHistoryCode(['successful', 'successful-settled', 'partial-refunded'], [], 1);
      const listed = (await collectCodes()).length;
      await openDaily(0);
      const cards = await dailyCards();
      const key = Object.keys(cards).find((k) => /Total Order/i.test(k));
      if (!key) this.skip();
      expect(listed).toBe(cards[key ?? '']?.value ?? -1);
    },
  );

  it(
    title(
      'Batch History › Batch Close Review › order code → read-only Order Details; a 2-staff unsettled order still has Split Tip (OH-207)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const id = await app.createOrder({ services: [vqEnv.testService] });
      await app.pickStaff(vqEnv.testStaff2);
      await app.addService(vqEnv.testService2);
      await app.pay();
      await app.selectMethod('Other');
      await app.completePayment({ tip: 'none' });
      await app.waitSuccess();
      await app.noReceipt();
      await app.openHistoryOrder(id);
      await adjustTipTo('500');
      await openBatch();
      await clickBatchAmount(0);
      const review = await batchReview();
      if (!review.text.includes(id)) this.skip(); // the open batch review does not list this order on screen
      await P.clickQ({ textRe: `^${id}$`, nth: 0 });
      expect(await waitOrderDetails(true)).toBe(true);
      const buttons = (await orderDetailsButtons()).join(' | ');
      for (const b of ['Adjust Tip', 'Re-Open Order', 'Cancel Order']) expect(buttons).not.toContain(b);
      expect(await orderDetailsText()).toContain('Split Tip');
      await closeOrderDetails();
    },
  );

  /* ---------------- data that already exists ---------------- */

  it(
    title(
      'A failed card swipe followed by a success shows the successful txn, the failed one apart (OH-079)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(5 * 60_000);
      if (!(await findHistoryCode(['successful', 'successful-settled'], ['card'], 30))) this.skip();
      for (const c of (await rowCodes()).slice(0, 15)) {
        await openRow(c);
        await settle(1_200);
        const pay = paymentSection(await P.pageText('main'));
        if (!/Failed|Declined|Error/i.test(pay)) continue;
        expect(pay).toMatch(/Success|Approved|Credit|Auth/i);
        return;
      }
      this.skip(); // no card order with a failed attempt in 30 days
    },
  );

  it(
    title('Search staff by first name / last name / staff code (OH-057)', Tag.REGRESSION),
    async function () {
      this.timeout(3 * 60_000);
      const keys = ['VOLT_STAFF_FIRST', 'VOLT_STAFF_LAST', 'VOLT_STAFF_CODE_NO'].map((k) =>
        (process.env[k] ?? '').trim(),
      );
      const nick = vqEnv.testStaff;
      if (keys.every((k) => !k)) this.skip(); // VOLT_STAFF_FIRST / _LAST / _CODE_NO of VOLT_TEST_STAFF
      await app.go('/order-history');
      await P.waitFor(OH.heading, Timeouts.MEDIUM, 'Order History');
      await openFilter();
      await P.clickQ(inFilter({ role: 'button', nameRe: 'Select staff', nth: 0 }));
      for (const k of keys.filter(Boolean)) {
        await P.fillQ({ css: 'input', placeholder: 'Search staff', nth: -1 }, k);
        await settle(800);
        expect(await P.has({ role: 'checkbox', name: nick })).toBe(true);
      }
      await P.escape();
      await P.escape();
    },
  );

  /* ---------------- settings ---------------- */

  it(
    title(
      'Tip Timing = Before Payment hides Adjust Tip on an unsettled cash order; back to After shows it again (OH-183)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { id } = await app.createPaidOrder({ method: 'Cash' });
      const setTiming = async (when: 'before' | 'after'): Promise<boolean> => {
        await app.go('/settings/payment-transaction');
        const radio = { css: `#charge-fee-tip-timing-${when}`, nth: 0 };
        if (!(await waitUntil(() => visible(radio), 10_000))) return false;
        const on =
          (await P.attrOf(radio, 'aria-checked')) === 'true' ||
          (await P.attrOf(radio, 'data-state')) === 'checked';
        if (!on) {
          await P.clickQ(radio);
          await P.clickQ(CdSettings.tippingSave);
          await app.passcodeIfAsked(1_500);
          await settle(1_500);
        }
        return on;
      };
      if (
        !(await waitUntil(async () => {
          await app.go('/settings/payment-transaction');
          return visible({ css: '#charge-fee-tip-timing-after' });
        }, 10_000))
      )
        this.skip();
      const wasAfter = (await P.attrOf({ css: '#charge-fee-tip-timing-after' }, 'aria-checked')) === 'true';
      try {
        await setTiming('before');
        await app.openHistoryOrder(id);
        expect(await P.has(inMain(btn('Adjust Tip')))).toBe(false);
        await setTiming('after');
        await app.openHistoryOrder(id);
        expect(await P.has(inMain(btn('Adjust Tip')))).toBe(true);
      } finally {
        await setTiming(wasAfter ? 'after' : 'before').catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Vietnamese: list, detail, Cash line, dates, calendar and printer toast are translated; long badge fits its card (OH-022, OH-052, OH-212, OH-213, OH-215, OH-216)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { id } = await app.createPaidOrder({ method: 'Cash' });
      const before = await readLanguage();
      try {
        await setLanguage('vi');
        const t = await openByCodeAnyLang(id);
        // OH-212 no English left on the screen
        for (const en of [
          'Order History',
          'Order Summary',
          'Payment Details',
          'Order Note',
          'Search order ID',
        ])
          expect(t).not.toContain(en);
        // OH-213 / OH-215 Cash line and "last updated" in Vietnamese
        const pay = t.slice(Math.max(0, t.indexOf(id)));
        expect(pay).not.toMatch(/\| Got:|\| Change:|\bGot \$/);
        expect(t).toMatch(/Cập nhật/);
        expect(t).not.toMatch(/Last updated/);
        await step('OH-022 the long "Thành công - Chưa quyết toán" badge fits its row', async () => {
          const overflow = await P.exec<boolean>(
            `
            var rows = document.querySelectorAll(arguments[0]);
            for (var i = 0; i < rows.length; i++) {
              var els = rows[i].querySelectorAll('*');
              for (var j = 0; j < els.length; j++) {
                var e = els[j];
                if (!e.children.length && /Thành công/.test(e.textContent || '')) {
                  var r = e.getBoundingClientRect(), p = rows[i].getBoundingClientRect();
                  if (r.right > p.right + 1 || e.scrollWidth > e.clientWidth + 1) return true;
                }
              }
            }
            return false;`,
            OH.rowCss,
          );
          expect(overflow).toBe(false);
        });
        await step('OH-052 calendar months / weekdays in Vietnamese', async () => {
          await P.clickQ(OH.dateRange);
          await settle(600);
          const cal = await P.pageText('body');
          expect(cal).toMatch(/[Tt]háng|Thg|CN|T2/);
          await P.escape();
        });
        await step('OH-216 printer toast in Vietnamese', async () => {
          await P.clickQ(inMain({ role: 'button', nameRe: 'Hoá đơn|Hóa đơn|Biên lai', nth: 0 }));
          await settle(800);
          await P.clickQ({ role: 'button', nameRe: '^In$', nth: 0 });
          const toastText = await P.poll(
            async () => (await P.texts({ css: '[data-sonner-toast]' })).join(' | '),
            (x) => x !== '',
            10_000,
          );
          expect(toastText).not.toBe('');
          expect(toastText).not.toMatch(/Printer not connected/);
          await P.escape();
        });
      } finally {
        await setLanguage(before === 'vi' ? 'vi' : 'en').catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Vietnamese: refund method options show the remaining balance as "(Còn lại $x)" (OH-214)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const code = await findHistoryCode(['partial-refunded', 'successful-settled'], ['cash', 'other'], 30);
      if (!code) this.skip(); // needs a settled order
      const before = await readLanguage();
      try {
        await setLanguage('vi');
        await openByCodeAnyLang(code ?? '');
        await P.clickQ(inMain({ role: 'button', nameRe: '^(Hoàn tiền|Hoàn một phần)', nth: 0 }));
        await app.passcodeIfAsked(1_500);
        const method = { css: '[data-testid="oh-refund-method-select"]', nth: 0 };
        if (!(await visible(method)) || (await P.isDisabled(method))) {
          await P.clickQ([{ css: '[data-testid="oh-refund-service-select"]', nth: 0 }]).catch(
            () => undefined,
          );
          await P.clickQ({ css: '[id^="refund-service-"]:not([id="refund-service-all"])', nth: 0 }).catch(
            () => undefined,
          );
          await P.escape();
        }
        if (!(await visible(method)) || (await P.isDisabled(method))) this.skip();
        await P.clickQ(method);
        const opts = (await P.texts({ role: 'option' })).join(' | ');
        expect(opts).toMatch(/Còn lại \$[\d,.]+/);
        expect(opts).not.toMatch(/Remaining/);
        await P.escape();
        await P.escape();
      } finally {
        await setLanguage(before === 'vi' ? 'vi' : 'en').catch(() => undefined);
      }
    },
  );
});
