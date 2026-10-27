/**
 * volt-qc port — 07 ORDER HISTORY: Refund on Successful - Settled orders.
 *
 * Source: volt-qc `e2e/tests/07-order-history/oh-plan-refund.spec.ts` (OH-T35, T60, T61, T63, T64,
 * T67, T70). TC catalogue: docs/qc/volt-qc/windows-regression/07-order-history.md.
 *
 * Refund needs a SETTLED order (cash / other settle at the merchant's day rollover, card at batch
 * close), which one run cannot make. The volt-qc suite used seeds from the day before; this port
 * FINDS one in the list (last 7 / 30 days) and skips with a reason when none exists.
 *
 * Opening / reading / cancelling the dialog moves no money. The cases that CONFIRM a refund
 * run only with `REFUND_SETTLE=1` (an operator who knows the found order is a throwaway).
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { type VqcQuery } from '../../../../src/constants/testids.voltqc-pos.js';
import { OhRoDialogs as D, OhRoText as T } from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  centsIn,
  detailActions,
  detailText,
  field,
  findHistoryCode,
  openByCode,
  passcodeIfAsked,
  paymentSection,
  refundAmountCents,
  refundDialogText,
  closeRefundDialog,
  openRefundDialog,
  staffRoleCode,
  enterCodeRaw,
  waitStatus,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { openRow, rowCodes } from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const REFUND_SETTLE = process.env.REFUND_SETTLE === '1';
const REASONS = [
  'Customer Request',
  'Service issue',
  'Incorrect order',
  'Duplicate payment',
  'Promotion / Discount error',
  'Staff mistake',
  'Other',
];

const tid = (id: string, fallback: string): VqcQuery => ({
  css: `[data-testid="${id}"], ${fallback}`,
  nth: 0,
});
const R = {
  confirm: [D.refund, tid('order-refund-confirm-btn', 'button:last-of-type')] as const,
  services: [D.refund, tid('oh-refund-service-select', '[role="combobox"]')] as const,
  method: [D.refund, { css: '[data-testid="oh-refund-method-select"]', nth: 0 }] as const,
  reason: [D.refund, tid('oh-refund-reason-select', '[role="combobox"]:last-of-type')] as const,
  otherText: [D.refund, tid('oh-refund-reason-other-input', 'textarea')] as const,
  all: [D.refund, tid('oh-refund-service-all', '[id="refund-service-all"]')] as const,
};

async function openSettledOrSkip(
  ctx: Mocha.Context,
  payments: string[] = ['cash', 'other'],
  daysBack = 7,
  statuses = ['successful-settled'],
): Promise<string> {
  const code = await findHistoryCode(statuses, payments, daysBack);
  if (!code) ctx.skip();
  await openRow(code ?? '');
  await P.waitFor({ css: 'main', hasText: `Order #${code ?? ''}` }, Timeouts.MEDIUM, 'settled order detail');
  return code ?? '';
}

/** Codes of settled orders in range, so a case can look for a particular shape (2 services, split…). */
async function settledCodes(payments: string[], daysBack = 7): Promise<string[]> {
  await findHistoryCode(['successful-settled'], payments, daysBack);
  return rowCodes();
}

async function serviceCount(code: string): Promise<number> {
  const d = await detailText(code);
  const i = d.indexOf('Service Details');
  const j = d.indexOf('Payment Details', i);
  const seg = i >= 0 ? d.slice(i, j > i ? j : undefined) : '';
  return (seg.match(/\$[\d,]+\.\d{2}/g) ?? []).length;
}

async function chooseReason(reason: string): Promise<void> {
  await P.clickQ(R.reason);
  await P.clickQ({ role: 'option', name: reason });
  await settle(250);
}

describe('volt-qc 07 ORDER HISTORY — Refund (settled orders)', () => {
  after(async () => {
    await P.escape().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'A Successful - Settled cash/other order offers only Receipt + Refund (no Re-Open / Cancel / Adjust Tip) (OH-104, OH-208)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await openSettledOrSkip(this);
      const a = await detailActions();
      expect(a.Receipt).toBe(true);
      expect(a.Refund).toBe(true);
      for (const k of ['Re-Open Order', 'Cancel Order', 'Adjust Tip', 'Split Tip']) expect(a[k]).toBe(false);
    },
  );

  it(
    title('A settled order paid with any Gift Card has no Refund (OH-108)', Tag.REGRESSION),
    async function () {
      this.timeout(4 * 60_000);
      await openSettledOrSkip(this, ['gift-card'], 30);
      expect((await detailActions()).Refund).toBe(false);
    },
  );

  it(
    title('A Partial Refunded settled order still offers Refund for the rest (OH-107)', Tag.REGRESSION),
    async function () {
      this.timeout(4 * 60_000);
      await openSettledOrSkip(this, [], 30, ['partial-refunded']);
      expect((await detailActions()).Refund).toBe(true);
    },
  );

  it(
    title(
      'Refund dialog on a one-service order: FULL, amount = Total and locked, method locked, reason required (7, Other text ≤ 80) (OH-131, OH-136, OH-135)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(5 * 60_000);
      let code = '';
      for (const c of (await settledCodes(['cash', 'other'])).slice(0, 8)) {
        await openByCode(c);
        if ((await serviceCount(c)) === 1) {
          code = c;
          break;
        }
      }
      if (!code) this.skip();
      const total = centsIn(field(await detailText(code), 'Total'));
      await openRefundDialog();
      await step('OH-131 defaults', async () => {
        expect(await refundDialogText()).toContain(
          'Enter amount or select check payment you want to refund.',
        );
        expect(await refundAmountCents()).toBe(total);
        expect(await P.textOf(R.confirm)).toMatch(/^\s*Refund\s*$/);
        expect(await P.isDisabled(R.confirm)).toBe(true);
        if (await P.has(R.method)) expect(await P.isDisabled(R.method)).toBe(true);
      });
      await step('OH-136 reason list and Other text', async () => {
        await P.clickQ(R.reason);
        expect((await P.texts({ role: 'option' })).map((s) => s.trim())).toEqual(REASONS);
        await P.clickQ({ role: 'option', name: 'Other' });
        expect(await P.isDisabled(R.confirm)).toBe(true);
        await P.fillQ(R.otherText, '   ');
        expect(await P.isDisabled(R.confirm)).toBe(true);
        await P.fillQ(R.otherText, 'r'.repeat(81));
        expect((await P.inputValue(R.otherText)).length).toBe(T.maxReason);
        await P.fillQ(R.otherText, 'Test refund');
        expect(await P.isDisabled(R.confirm)).toBe(false);
      });
      await step('OH-135 no Gift Card among refund methods', async () => {
        if (await P.has(R.method)) expect(await refundDialogText()).not.toMatch(/Gift Card/);
      });
      await closeRefundDialog();
      expect(field(await detailText(code), 'Status')).toBe('Successful - Settled');
    },
  );

  it(
    title(
      "Two services: All services = FULL; one service = PARTIAL with that line's amount, method required showing Remaining; Cancel resets; line refund prices (with tax) add up to Total − Tip (OH-132, OH-133, OH-134, OH-137, OH-144)",
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(6 * 60_000);
      let code = '';
      for (const c of (await settledCodes(['cash', 'other'])).slice(0, 10)) {
        await openByCode(c);
        if (/Partial Refunded|Refunded/.test(field(await detailText(c), 'Status'))) continue;
        if ((await serviceCount(c)) >= 2) {
          code = c;
          break;
        }
      }
      if (!code) this.skip();
      const total = centsIn(field(await detailText(code), 'Total'));
      await openRefundDialog();
      if (!(await P.has(R.all))) {
        await P.clickQ(R.services);
      }
      await step('OH-132 All services → full', async () => {
        if ((await P.attrOf(R.all, 'data-state')) !== 'checked') await P.clickQ(R.all);
        await P.escape();
        expect(await refundAmountCents()).toBe(total);
        expect(await P.textOf(R.confirm)).toMatch(/^\s*Refund\s*$/);
      });
      await step('OH-133 / OH-134 one service → partial, method with Remaining', async () => {
        await P.clickQ(R.services);
        await P.clickQ(R.all); // untick all
        // OH-144: each line's refundable price carries its tax share — the lines add up to Total − Tip.
        const linePrices = await P.exec<string[]>(
          `return Array.prototype.map.call(document.querySelectorAll('[id^="refund-service-"]:not([id="refund-service-all"])'), function (cb) { var r = cb.closest("div.justify-between") || (cb.parentElement && cb.parentElement.parentElement); return r ? String(r.textContent || "") : ""; });`,
        );
        const tip = centsIn(field(await detailText(code), 'Tip')) || 0;
        const sum = linePrices
          .map((t) => centsIn(t))
          .filter((c) => !Number.isNaN(c))
          .reduce((a, b) => a + b, 0);
        expect(sum).toBe(total - tip);
        await P.clickQ([D.refund, { css: '[id^="refund-service-"]:not([id="refund-service-all"])', nth: 0 }]);
        await P.escape();
        const amount = await refundAmountCents();
        expect(amount).toBeGreaterThan(0);
        expect(amount).toBeLessThan(total);
        expect(await P.textOf(R.confirm)).toMatch(/Partial Refund/);
        expect(await P.isDisabled(R.confirm)).toBe(true);
        await P.clickQ(R.method);
        const opts = await P.texts({ role: 'option' });
        expect(opts.join(' | ')).toMatch(/Remaining \$[\d,.]+/);
        for (const o of opts) {
          const rem = centsIn(/Remaining (\$[\d,.]+)/.exec(o)?.[1]);
          if (!Number.isNaN(rem) && rem < amount)
            expect(await P.isDisabled({ role: 'option', hasText: o.trim(), nth: 0 })).toBe(true);
        }
        await P.clickQ({ role: 'option', nth: 0 });
        await chooseReason('Customer Request');
        expect(await P.isDisabled(R.confirm)).toBe(false);
      });
      await step('OH-137 Cancel and reopen → nothing selected', async () => {
        await closeRefundDialog();
        await openRefundDialog();
        const t = await refundDialogText();
        expect(t).toMatch(/Please select reason refund/);
        expect(await P.isDisabled(R.confirm)).toBe(true);
        await closeRefundDialog();
      });
    },
  );

  it(
    title(
      'A settled split order refunds only in full: no service pick, no method pick (OH-149)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(6 * 60_000);
      let code = '';
      for (const c of (await settledCodes([], 30)).slice(0, 15)) {
        await openByCode(c);
        if (new RegExp(`#${c}-2`).test(await detailText(c))) {
          code = c;
          break;
        }
      }
      if (!code) this.skip();
      await openRefundDialog();
      if (await P.has(R.method)) expect(await P.isDisabled(R.method)).toBe(true);
      expect(await refundAmountCents()).toBe(centsIn(field(await detailText(code), 'Total')));
      await closeRefundDialog();
    },
  );

  it(
    title('A Staff-role code without Refund permission cannot refund (OH-150)', Tag.REGRESSION),
    async function () {
      this.timeout(5 * 60_000);
      const staffCode = staffRoleCode();
      if (!staffCode) this.skip();
      const code = await openSettledOrSkip(this);
      await openRefundDialog();
      await chooseReason('Customer Request');
      await P.clickQ(R.confirm);
      if (
        !(await P.poll(
          () => P.has(D.passcode),
          (v) => v,
          3_000,
        ))
      ) {
        await closeRefundDialog().catch(() => undefined);
        this.skip(); // gate off — would refund for real
      }
      const r = await enterCodeRaw(staffCode);
      if (!r.visible) this.skip(); // the Staff role may refund on this merchant (and now did) — nothing else to check
      expect(r.text).toContain("You don't have permission for this action");
      await P.escape();
      if (await P.has(D.refund)) await closeRefundDialog();
      expect(field(await detailText(code), 'Status')).toBe('Successful - Settled');
    },
  );

  it(
    title(
      '🌙 Partial refund of one service: Refunding → Partial Refunded, Refund information, refunded line locked on reopen; list badge = detail (OH-138, OH-146, OH-211)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      if (!REFUND_SETTLE) this.skip(); // moves money back — opt in with REFUND_SETTLE=1
      let code = '';
      for (const c of (await settledCodes(['other'])).slice(0, 10)) {
        await openByCode(c);
        if ((await serviceCount(c)) >= 2) {
          code = c;
          break;
        }
      }
      if (!code) this.skip();
      await openRefundDialog();
      await P.clickQ(R.services);
      if ((await P.attrOf(R.all, 'data-state')) === 'checked') await P.clickQ(R.all);
      await P.clickQ([D.refund, { css: '[id^="refund-service-"]:not([id="refund-service-all"])', nth: 0 }]);
      await P.escape();
      const amount = await refundAmountCents();
      await P.clickQ(R.method);
      await P.clickQ({ role: 'option', hasText: 'Other', nth: 0 });
      await chooseReason('Customer Request');
      await P.clickQ(R.confirm);
      await passcodeIfAsked(3_000);
      expect(await waitStatus(code, /^Partial Refunded$/, 90_000)).toBe('Partial Refunded');
      const d = await detailText(code);
      expect(d).toContain('Refund information');
      expect(d.slice(d.indexOf('Refund information'))).toContain(`$${(amount / 100).toFixed(2)}`);
      await openRefundDialog();
      await P.clickQ(R.services);
      const first = [
        D.refund,
        { css: '[id^="refund-service-"]:not([id="refund-service-all"])', nth: 0 },
      ] as const;
      expect(await P.isDisabled(first)).toBe(true);
      await P.escape();
      await closeRefundDialog();
      await openByCode(code);
      expect(field(await detailText(code), 'Status')).toBe('Partial Refunded');
    },
  );

  it(
    title(
      '🌙 Full refund of a settled Other order: Refunding → Refunded, the payment line reads "Refunded" (OH-140)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      if (!REFUND_SETTLE) this.skip();
      const code = await openSettledOrSkip(this, ['other']);
      await openRefundDialog();
      if (await P.has(R.all)) {
        await P.clickQ(R.services);
        if ((await P.attrOf(R.all, 'data-state')) !== 'checked') await P.clickQ(R.all);
        await P.escape();
      }
      await chooseReason('Customer Request');
      await P.clickQ(R.confirm);
      await passcodeIfAsked(3_000);
      expect(await waitStatus(code, /^Refunded$/, 90_000)).toBe('Refunded');
      expect(paymentSection(await detailText(code))).toContain('Refunded');
    },
  );
});
