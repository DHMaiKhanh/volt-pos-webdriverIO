/**
 * volt-qc port — 07 ORDER HISTORY: Cancel Order (void) on unsettled cash / other orders.
 *
 * Source: volt-qc `e2e/tests/07-order-history/history.spec.ts` (OH-C), `oh-deep.spec.ts` (OH-D08),
 * `oh-plan-detail.spec.ts` (OH-T50..T53, T57).
 * TC catalogue: docs/qc/volt-qc/windows-regression/07-order-history.md.
 *
 * CREATES, SETTLES AND CANCELS ORDERS; one case flips the cancel_order passcode gate and puts
 * it back — dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { VqcOrderHistory as OH, btn } from '../../../../src/constants/testids.voltqc-pos.js';
import {
  OhRoButtons as B,
  OhRoDialogs as D,
  OhRoText as T,
} from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  adjustTipTo,
  applyOhFilter,
  centsIn,
  createPaidOrder,
  detailActions,
  detailText,
  enterCodeRaw,
  field,
  isConfirmCancelDisabled,
  openByCode,
  openCancelDialog,
  openHistoryOrder,
  passcodeIfAsked,
  paymentSection,
  reasonOptions,
  selectReason,
  setPasscodeGate,
  staffRoleCode,
  waitStatus,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { rowCodes, rowTexts, search } from '../../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const REASONS = [
  'Customer Request',
  'Service issue',
  'Incorrect order',
  'Duplicate payment',
  'Promotion / Discount error',
  'Staff mistake',
  'Other',
];
const SKIP_KEY = OH.passcodeSkipKey;
const OTHER_INPUT = [
  D.cancel,
  { css: '[data-testid="oh-cancel-reason-other-input"], textarea', nth: 0 },
] as const;
const UNKNOWN = (process.env.VOLT_UNKNOWN_CODE ?? '').trim() || '9137';

function cancelInfo(d: string): string {
  const i = d.indexOf('Cancel information');
  if (i < 0) return '';
  const end = d.indexOf('Payment Details', i);
  return d.slice(i, end > i ? end : undefined);
}

async function toastCount(text: string): Promise<number> {
  return (await P.texts({ css: '[data-sonner-toast]' })).filter((t) => t.includes(text)).length;
}

async function confirmCancel(): Promise<void> {
  await P.clickQ([D.cancel, btn(B.confirmCancel, 0)]);
  await passcodeIfAsked(3_000);
}

describe('volt-qc 07 ORDER HISTORY — Cancel Order (write)', () => {
  after(async () => {
    await P.escape().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Cancel dialog copy, 7 reasons in order, Confirm only with a reason, Keep Order changes nothing (OH-111, OH-112)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const { code } = await createPaidOrder({ method: 'other' });
      await openCancelDialog();
      const text = (await P.rawText(D.cancel)) ?? '';
      expect(text).toContain('All payments will be voided');
      expect(text).toMatch(/select a reason/i);
      expect(await isConfirmCancelDisabled()).toBe(true);
      expect(await reasonOptions(D.cancel)).toEqual(REASONS);
      expect(REASONS).toHaveLength(T.cancelReasons);
      await selectReason(D.cancel, 'Staff mistake');
      expect(await isConfirmCancelDisabled()).toBe(false);
      await P.clickQ([D.cancel, btn(B.keepOrder, 0)]);
      await P.waitGoneQ(D.cancel, Timeouts.SHORT, 'Cancel dialog');
      expect(field(await detailText(code), 'Status')).toBe('Successful - Unsettled');
      const a = await detailActions();
      expect(a[B.receipt] && a[B.reopen] && a[B.cancelOrder]).toBe(true);
    },
  );

  it(
    title(
      'Cancelling an unsettled cash order with a tip voids it: Canceled, Cancel information = amount + tip, line Voided, only Receipt; out of the Successful filter (OH-114, OH-116, OH-211)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { code, paidCents } = await createPaidOrder({ method: 'cash' });
      await adjustTipTo('200'); // $2.00 tip
      await P.poll(
        () => detailText(code),
        (t) => field(t, 'Tip') === '$2.00',
        15_000,
      );
      await openCancelDialog();
      await selectReason(D.cancel, 'Staff mistake');
      await confirmCancel();
      expect(await waitStatus(code, /^Canceled$/, 90_000)).toBe('Canceled');
      const d = await detailText(code);
      const info = cancelInfo(d);
      expect(info).toMatch(/By Staff:? \|?\s*\S/);
      expect(info).toContain('Staff mistake');
      expect(centsIn(/Amount:? \|?\s*(\$[\d,.]+)/.exec(info)?.[1])).toBe(paidCents + 200);
      expect(paymentSection(d)).toContain('Voided');
      const a = await detailActions();
      expect(
        Object.entries(a)
          .filter(([, v]) => v)
          .map(([k]) => k),
      ).toEqual([B.receipt]);

      await step('OH-211 / OH-116 list badge follows the detail; out of the Successful filter', async () => {
        await search(code);
        expect((await rowTexts()).find((r) => r.startsWith(code)) ?? '').toContain('Canceled');
        await search('');
        await applyOhFilter({ statuses: ['successful'] });
        await search(code);
        expect(await rowCodes()).not.toContain(code);
        await search('');
        await applyOhFilter({ clear: true, statuses: ['canceled'] });
        await search(code);
        expect(
          await P.poll(
            () => rowCodes(),
            (c) => c.includes(code),
            10_000,
          ),
        ).toContain(code);
      });
    },
  );

  it(
    title(
      'Reason Other: text required (spaces do not count), max 80 chars; switching reason clears it; wrong code does not cancel (OH-113, OH-117)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'other' });
      await step('OH-113 Other needs text, capped at 80', async () => {
        await openCancelDialog();
        await selectReason(D.cancel, 'Other');
        expect(await P.attrOf(OTHER_INPUT, 'placeholder')).toBe('Enter your reason here...');
        expect(await isConfirmCancelDisabled()).toBe(true);
        await P.fillQ(OTHER_INPUT, '   ');
        expect(await isConfirmCancelDisabled()).toBe(true);
        await P.fillQ(OTHER_INPUT, 'a'.repeat(81));
        expect((await P.inputValue(OTHER_INPUT)).length).toBe(T.maxReason);
        expect((await P.rawText(D.cancel)) ?? '').toContain('80/80');
        await P.fillQ(OTHER_INPUT, 'Khach doi y');
        expect(await isConfirmCancelDisabled()).toBe(false);
        await selectReason(D.cancel, 'Customer Request');
        await selectReason(D.cancel, 'Other');
        expect(await P.inputValue(OTHER_INPUT)).toBe('');
        await P.clickQ([D.cancel, btn(B.keepOrder, 0)]);
        await P.waitGoneQ(D.cancel, Timeouts.SHORT, 'Cancel dialog');
      });
      await step('OH-117 wrong code → not cancelled', async () => {
        const saved = await P.localGet(SKIP_KEY);
        await P.localSet(SKIP_KEY, null);
        try {
          await openCancelDialog();
          await selectReason(D.cancel, 'Customer Request');
          await P.clickQ([D.cancel, btn(B.confirmCancel, 0)]);
          if (
            !(await P.poll(
              () => P.has(D.passcode),
              (v) => v,
              3_000,
            ))
          )
            return; // gate OFF: nothing to check
          const r = await enterCodeRaw(UNKNOWN);
          expect(r.visible).toBe(true);
          expect(r.text).toMatch(OH.wrongCode);
          await P.clickQ([D.passcode, { css: 'button', nth: 0 }]);
          if (await P.has(D.cancel)) await P.clickQ([D.cancel, btn(B.keepOrder, 0)]);
          await settle(1_500);
          expect(await toastCount('Order canceled successfully')).toBe(0);
        } finally {
          await P.localSet(SKIP_KEY, saved);
        }
        await openHistoryOrder(orderId);
        expect(field(await detailText(code), 'Status')).toBe('Successful - Unsettled');
      });
    },
  );

  it(
    title('A typed Other reason is shown verbatim in Cancel information (OH-115)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(4 * 60_000);
      const { code } = await createPaidOrder({ method: 'other' });
      const reason = 'Khach doi y - test E2E';
      await openCancelDialog();
      await selectReason(D.cancel, 'Other');
      await P.fillQ(OTHER_INPUT, reason);
      await confirmCancel();
      expect(await waitStatus(code, /^Canceled$/, 90_000)).toBe('Canceled');
      const info = cancelInfo(await detailText(code));
      expect(info).toContain(reason);
      expect(info).not.toMatch(/\| Other \|/);
    },
  );

  it(
    title(
      'A Staff-role code without Cancel Order (Void) permission is refused (OH-118)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const staffCode = staffRoleCode();
      if (!staffCode) this.skip(); // VOLT_STAFFROLE_CODE not configured
      const { code } = await createPaidOrder({ method: 'other' });
      const saved = await P.localGet(SKIP_KEY);
      await P.localSet(SKIP_KEY, null);
      try {
        await openCancelDialog().catch(() => undefined);
        if (!(await P.has(D.cancel))) this.skip();
        await selectReason(D.cancel, 'Customer Request');
        await P.clickQ([D.cancel, btn(B.confirmCancel, 0)]);
        if (
          !(await P.poll(
            () => P.has(D.passcode),
            (v) => v,
            3_000,
          ))
        )
          this.skip();
        const r = await enterCodeRaw(staffCode);
        if (!r.visible) this.skip(); // the Staff role HAS the permission on this merchant
        expect(r.text).toContain("You don't have permission for this action");
        await P.escape();
        if (await P.has(D.cancel)) await P.clickQ([D.cancel, btn(B.keepOrder, 0)]);
      } finally {
        await P.localSet(SKIP_KEY, saved);
      }
      await openByCode(code);
      expect(field(await detailText(code), 'Status')).toBe('Successful - Unsettled');
    },
  );

  it(
    title(
      'Cancel Order (Void) gate OFF: Confirm Cancel runs with no passcode dialog (OH-119)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'other' });
      const saved = await P.localGet(SKIP_KEY);
      const before = await setPasscodeGate('cancel_order', false);
      try {
        await P.localSet(SKIP_KEY, null);
        await openHistoryOrder(orderId);
        await openCancelDialog();
        await selectReason(D.cancel, 'Customer Request');
        await P.clickQ([D.cancel, btn(B.confirmCancel, 0)]);
        expect(
          await P.poll(
            () => P.has(D.passcode),
            (v) => v,
            2_500,
          ),
        ).toBe(false);
        expect(await waitStatus(code, /^Canceled$/, 90_000)).toBe('Canceled');
      } finally {
        await setPasscodeGate('cancel_order', before);
        await P.localSet(SKIP_KEY, saved);
      }
    },
  );

  it(
    title('Double-clicking Confirm Cancel creates one void only (OH-126)', Tag.REGRESSION, Tag.WRITE),
    async function () {
      this.timeout(5 * 60_000);
      const { code } = await createPaidOrder({ method: 'other' });
      await settle(5_000); // let earlier toasts expire
      await openCancelDialog();
      await selectReason(D.cancel, 'Customer Request');
      await P.exec<null>(`
      var dl = Array.prototype.filter.call(document.querySelectorAll('[role="alertdialog"]'), function (d) { return /Cancel Order/.test(d.textContent || ''); });
      var b = dl.length && Array.prototype.find.call(dl[dl.length - 1].querySelectorAll('button'), function (x) { return (x.textContent || '').trim() === 'Confirm Cancel'; });
      if (b) { b.click(); b.click(); }
      return null;
    `);
      await passcodeIfAsked(2_500);
      expect(await waitStatus(code, /^Canceled$/, 90_000)).toBe('Canceled');
      expect(await toastCount('Order canceled successfully')).toBeLessThanOrEqual(1);
      const info = cancelInfo(await detailText(code));
      expect((info.match(/Amount/g) ?? []).length).toBe(1);
    },
  );
});
