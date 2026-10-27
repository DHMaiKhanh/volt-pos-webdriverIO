/**
 * volt-qc port — 07 ORDER HISTORY: order detail pane + Receipt (write cases).
 *
 * Source: volt-qc `e2e/tests/07-order-history/history.spec.ts` (OH-A), `oh-plan-detail.spec.ts`
 * (OH-T26, T28, T31, T32, T34) and `oh-deep.spec.ts` (OH-D02, D12).
 * TC catalogue: docs/qc/volt-qc/windows-regression/07-order-history.md.
 *
 * CREATES AND SETTLES ORDERS, cancels one — dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { VqcHome, btn } from '../../../../src/constants/testids.voltqc-pos.js';
import {
  OhRoButtons as B,
  OhRoDialogs as D,
  OhRoText as T,
} from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { goToOrderHistory, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  adjustTipTo,
  cancelOrder,
  centsIn,
  createPaidOrder,
  detailActions,
  detailText,
  field,
  fmtPhone,
  openReceipt,
  paymentSection,
  randomPhone,
  receiptText,
  serviceSection,
  staffInDetail,
  waitStatus,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import {
  addDays,
  applyFilter,
  openRow,
  pickDateRange,
  rowCodes,
} from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const usd = (c: number): string => `$${(c / 100).toFixed(2)}`;

/** Text of one detail card, from its heading to the next known heading. */
function section(d: string, heading: string): string {
  const heads = [
    'Order Information',
    'Order Summary',
    'Service Details',
    'Payment Details',
    'Order Note',
    'Cancel information',
    'Refund information',
  ];
  const i = d.indexOf(`| ${heading} |`) >= 0 ? d.indexOf(`| ${heading} |`) : d.indexOf(heading);
  if (i < 0) return '';
  const rest = d.slice(i + heading.length + 2);
  const ends = heads
    .filter((h) => h !== heading)
    .map((h) => rest.indexOf(`| ${h} |`))
    .filter((x) => x >= 0);
  return rest.slice(0, ends.length ? Math.min(...ends) : undefined);
}

const toast = (text: string | RegExp): Promise<boolean> =>
  P.poll(
    async () => {
      const t = (await P.texts({ css: '[data-sonner-toast]' })).join(' | ');
      return typeof text === 'string' ? t.includes(text) : text.test(t);
    },
    (v) => v,
    10_000,
  );

describe('volt-qc 07 ORDER HISTORY — detail pane and receipt (write)', () => {
  after(async () => {
    await P.escape().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Cash order detail: all sections, Order Information, Summary maths, Unsettled actions, no Refund; found right after payment (OH-067, OH-068, OH-069, OH-084, OH-103)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { code, paidCents } = await createPaidOrder({ method: 'cash' });
      const d = await detailText(code);
      {
        // OH-067 sections in order
        const order = [
          'Order Information',
          'Order Summary',
          'Service Details',
          'Payment Details',
          'Order Note',
        ].map((s) => d.indexOf(s));
        for (const i of order) expect(i).toBeGreaterThanOrEqual(0);
        for (let i = 1; i < order.length; i += 1) expect(order[i] ?? 0).toBeGreaterThan(order[i - 1] ?? 0);
      }
      {
        // OH-068 Order Information
        expect(field(d, 'Order ID')).toBe(code);
        expect(field(d, 'Status')).toBe('Successful - Unsettled');
        expect(d).toMatch(/\d{2}\/\d{2}\/\d{4}|\w{3} \d{1,2}, \d{4}/);
      }
      {
        // OH-069 Subtotal - Discount + Tax + Tip = Total = cash paid
        const sub = centsIn(field(d, 'Subtotal'));
        const tax = centsIn(field(d, 'Tax')) || 0;
        const disc = centsIn(field(d, 'Total Discount')) || 0;
        const tip = centsIn(field(d, 'Tip')) || 0;
        const total = centsIn(field(d, 'Total'));
        expect(total).toBe(paidCents);
        expect(sub - Math.abs(disc) + tax + tip).toBe(total);
        expect(field(d, 'Tip')).toBe('$0.00');
        expect(staffInDetail(d).length).toBeGreaterThan(0);
      }
      await step('OH-103 / OH-084 actions of a Successful - Unsettled order', async () => {
        const a = await detailActions();
        expect(a[B.receipt]).toBe(true);
        expect(a[B.reopen]).toBe(true);
        expect(a[B.cancelOrder]).toBe(true);
        expect(a.Refund).toBe(false);
      });
    },
  );

  it(
    title(
      'Cash line shows Got / Change / Tip; Tip card lists staff - $x after a tip, "No tips details available." before; "No note for this order." (OH-072, OH-073, OH-080)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { code, paidCents } = await createPaidOrder({ method: 'cash' });
      let d = await detailText(code);
      expect(d).toContain(T.noTips);
      expect(d).toContain(T.noNote);
      const pay = paymentSection(d);
      expect(pay).toContain('Cash');
      expect(pay).toMatch(/Got:?\s*\|?\s*\$[\d,.]+/);
      expect(pay).toMatch(/Change:?\s*\|?\s*\$[\d,.]+/);
      expect(centsIn(/Got:?\s*\|?\s*(\$[\d,.]+)/.exec(pay)?.[1])).toBeGreaterThanOrEqual(paidCents);

      await adjustTipTo('300'); // $3.00
      d = await P.poll(
        () => detailText(code),
        (t) => field(t, 'Tip') === '$3.00',
        15_000,
      );
      const staff = staffInDetail(d)[0] ?? '';
      expect(field(d, 'Tip')).toBe('$3.00');
      if (staff) expect(d).toContain(`${staff} - $3.00`);
      expect(d).toMatch(/Last updated:? \|?\s*\w{3} \d{1,2}, \d{4}/);
      expect(paymentSection(d)).toMatch(/Tip:?\s*\|?\s*\$3\.00/);
    },
  );

  it(
    title(
      'Other order: Payment shows "Amount: $x" (no "+ Tip"); Order Summary has no Service Fee line; not back in Pending after 15 s (OH-074, OH-085, OH-089)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { code, paidCents } = await createPaidOrder({ method: 'other' });
      const paidAt = Date.now();
      const d = await detailText(code);
      expect(paymentSection(d)).toContain(`Amount: ${usd(paidCents)}`);
      expect(paymentSection(d)).not.toMatch(/Amount: \$[\d.,]+ \+ Tip/);
      const s = section(d, 'Order Summary');
      for (const l of ['Subtotal', 'Tax', 'Tip', 'Total']) expect(s).toContain(l);
      expect(s).not.toMatch(/Service Fee/i);

      await step('OH-085 the paid order does not come back to Pending', async () => {
        await returnToHome();
        const box = [VqcHome.pendingSidebar, { role: 'textbox' as const, nth: 0 }];
        if (!(await P.has(box))) return;
        await P.fillQ(box, code);
        const rest = paidAt + 15_000 - Date.now();
        if (rest > 0) await settle(rest);
        expect(await P.has([VqcHome.pendingSidebar, { role: 'button', nameRe: `^${code}`, nth: 0 }])).toBe(
          false,
        );
        await P.fillQ(box, '');
      });
    },
  );

  it(
    title(
      'Receipt Details has Print / Send SMS / Send Email and a preview matching the order; Print without a printer toasts (OH-091, OH-092)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const { code } = await createPaidOrder({ method: 'cash' });
      await openReceipt();
      for (const b of [B.print, B.sendSms, B.sendEmail]) expect(await P.has([D.receipt, btn(b)])).toBe(true);
      const t = await receiptText();
      expect(t).toContain(code);
      expect(t).toMatch(/Total/);
      expect(t).toMatch(/Cash/);
      await P.clickQ([D.receipt, btn(B.print, 0)]);
      expect(await toast(T.printerNotConnected)).toBe(true);
      expect(await P.has(D.receipt)).toBe(true);
      await P.escape();
    },
  );

  it(
    title(
      'Send SMS pre-fills the customer phone; empty / 9 digits cannot send; bad email blocked; focus caret at the end; reopening resets the edit (OH-094, OH-095, OH-097, OH-099, OH-100)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const phone = randomPhone();
      await createPaidOrder({
        method: 'other',
        customerPhone: phone,
        customerName: `QC E2E ${phone.slice(-4)}`,
      });
      await openReceipt();
      const input = [D.customerPhone, { css: 'input', placeholder: 'Enter phone', nth: 0 }] as const;
      const send = [D.customerPhone, btn('Send', 0)] as const;
      await step('OH-094 pre-filled phone', async () => {
        await P.clickQ([D.receipt, btn(B.sendSms, 0)]);
        await P.waitFor(D.customerPhone, Timeouts.SHORT, 'Customer Phone dialog');
        expect(await P.inputValue(input)).toBe(fmtPhone(phone));
        expect(await P.isDisabled(send)).toBe(false);
      });
      await step(
        'OH-099 focusing the pre-filled field puts the caret at the end, nothing selected',
        async () => {
          await P.clickQ(input);
          const sel = await P.exec<{ start: number; end: number; len: number }>(
            'var el = document.activeElement; return { start: el && el.selectionStart || 0, end: el && el.selectionEnd || 0, len: el && el.value ? el.value.length : 0 };',
          );
          expect(sel.start).toBe(sel.end);
          expect(sel.end).toBe(sel.len);
        },
      );
      await step('OH-095 empty or 9 digits → Send disabled', async () => {
        await P.fillQ(input, '');
        expect(await P.isDisabled(send)).toBe(true);
        await P.fillQ(input, '555555123');
        expect(await P.isDisabled(send)).toBe(true);
      });
      await step('OH-100 edit, close, reopen → back to the customer phone', async () => {
        await P.fillQ(input, phone.slice(0, 6));
        await P.clickQ([D.customerPhone, { role: 'button', name: 'Close', nth: 0 }]);
        await P.waitGoneQ(D.customerPhone, Timeouts.SHORT, 'Customer Phone dialog');
        await P.clickQ([D.receipt, btn(B.sendSms, 0)]);
        expect(
          await P.poll(
            () => P.inputValue(input),
            (v) => v === fmtPhone(phone),
            5_000,
          ),
        ).toBe(fmtPhone(phone));
        await P.clickQ([D.customerPhone, { role: 'button', name: 'Close', nth: 0 }]);
      });
      await step('OH-097 malformed email → Send disabled', async () => {
        await P.clickQ([D.receipt, btn(B.sendEmail, 0)]);
        await P.waitFor(D.customerEmail, Timeouts.SHORT, 'Customer Email dialog');
        for (const v of ['abc@', 'abc']) {
          await P.fillQ([D.customerEmail, { css: 'input', placeholder: 'Enter email', nth: 0 }], v);
          expect(await P.isDisabled([D.customerEmail, btn('Send', 0)])).toBe(true);
        }
        await P.clickQ([D.customerEmail, { role: 'button', name: 'Close', nth: 0 }]);
      });
      await P.escape();
    },
  );

  it(
    title(
      'Canceled order offers only Receipt and its receipt shows the void; Refunded/Refund Issue/Canceling/Refunding (when present) only Receipt (OH-102, OH-105)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { code } = await createPaidOrder({ method: 'cash' });
      await cancelOrder(0);
      expect(await waitStatus(code, /^Canceled$/)).toBe('Canceled');
      const only = async (): Promise<void> => {
        const a = await detailActions();
        expect(a[B.receipt]).toBe(true);
        for (const k of [B.reopen, B.continueReopen, B.cancelOrder, B.adjustTip, 'Refund'])
          expect(a[k]).toBe(false);
      };
      await only();
      await openReceipt();
      expect(await receiptText()).toMatch(/Cancel|Void/i);
      await P.escape();

      await returnToHome();
      await goToOrderHistory();
      const today = new Date();
      await pickDateRange(addDays(today, -29), today);
      for (const s of ['refunded', 'refund-issue', 'canceling', 'refunding']) {
        await applyFilter({ clear: true, statuses: [s] });
        const c = (await rowCodes())[0];
        if (!c) continue;
        await openRow(c);
        await P.waitFor({ css: 'main', hasText: `Order #${c}` }, Timeouts.MEDIUM, `Order #${c}`);
        await only();
        if (s === 'refunded') {
          await openReceipt();
          expect(await receiptText()).toMatch(/Refund/i);
          await P.escape();
        }
      }
    },
  );

  it(
    title(
      'Service Details groups lines under "Staff: <name>" with each line\'s price (OH-070)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { code } = await createPaidOrder({
        method: 'other',
        lines: [
          [0, 0],
          [0, 1],
        ],
      });
      const svc = serviceSection(await detailText(code));
      expect(svc).toMatch(/Staff: [^|]+/);
      expect((svc.match(/\$[\d,]+\.\d{2}/g) ?? []).length).toBeGreaterThanOrEqual(2);
    },
  );
});
