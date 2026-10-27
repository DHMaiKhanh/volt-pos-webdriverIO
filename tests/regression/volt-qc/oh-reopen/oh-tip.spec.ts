/**
 * volt-qc port — 07 ORDER HISTORY: Adjust Tip and Split Tip on unsettled cash / other orders.
 *
 * Source: volt-qc `e2e/tests/07-order-history/history.spec.ts` (OH-B), `oh-plan-reopen-tip.spec.ts`
 * (OH-T78..T80, T83..T86), `oh-deep.spec.ts` (OH-D07).
 * TC catalogue: docs/qc/volt-qc/windows-regression/07-order-history.md.
 *
 * CREATES AND SETTLES ORDERS and changes their tips — dev / staging only. Two-staff cases skip
 * when the till shows fewer than two staff tiles.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { btn, inMain, tab, type VqcQuery } from '../../../../src/constants/testids.voltqc-pos.js';
import { OhRoDialogs as D, OhRoText as T } from '../../../../src/constants/testids.voltqc-oh-reopen.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { homePage } from '../../../../src/pages/index.js';
import {
  adjustTipTo,
  centsIn,
  closeTipDialog,
  countPayments,
  createPaidOrder,
  detailText,
  enteredFor,
  field,
  freshDetail,
  freshTill,
  leaveReopen,
  openAdjustTip,
  openHistoryOrder,
  passcodeIfAsked,
  payDifference,
  payFromEdit,
  paymentSection,
  reopenToHome,
  saveTip,
  serviceSection,
  staffInDetail,
  tipBackspace,
  tipCurrentCents,
  tipEnteredCents,
  tipKey,
  tryAddService,
  type PaidOrder,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SPLIT_TIP_OPEN = inMain({ textRe: '^Split Tip$', nth: 0 });
const SPLIT_INPUTS: readonly VqcQuery[] = [D.splitTip, { css: 'input', placeholder: '0.00' }];

/** One staff's tip share as the Tip card prints it (`<staff> - $x`). */
function staffTip(detail: string, staff: string): number {
  return centsIn(new RegExp(`${escRe(staff)} - (\\$[\\d,.]+)`).exec(detail)?.[1]);
}

async function waitTip(code: string, usd: string): Promise<string> {
  return P.poll(
    () => detailText(code),
    (d) => field(d, 'Tip') === usd,
    15_000,
  );
}

async function twoStaffOrder(
  ctx: Mocha.Context,
  method: 'cash' | 'other' = 'other',
): Promise<PaidOrder & { staff: string[] }> {
  await freshTill();
  if ((await homePage.visibleStaffCount()) < 2) ctx.skip();
  const o = await createPaidOrder({
    method,
    lines: [
      [0, 0],
      [1, 1],
    ],
  });
  const staff = staffInDetail(await detailText(o.code));
  if (staff.length < 2) ctx.skip();
  return { ...o, staff };
}

async function openSplitTip(): Promise<void> {
  await P.clickQ(SPLIT_TIP_OPEN);
  await passcodeIfAsked(2_000);
  await P.waitFor(D.splitTip, Timeouts.MEDIUM, 'Split Tip dialog');
}

async function chooseSplit(name: 'Split Evenly' | 'Proportion' | 'Manual', confirm = true): Promise<void> {
  const t = [D.splitTip, tab(name)] as const;
  if ((await P.attrOf(t, 'aria-selected')) !== 'true') {
    await P.clickQ(t);
    if (confirm) {
      await P.clickQ([D.splitTip, btn('Confirm', 0)]);
      await passcodeIfAsked(2_000);
      await P.waitGoneQ(D.splitTip, Timeouts.MEDIUM, 'Split Tip dialog');
      return;
    }
  } else if (confirm) {
    await P.escape();
  }
}

async function splitInputsCents(): Promise<number[]> {
  const infos = await P.infos(SPLIT_INPUTS);
  return infos.map((i) => centsIn(`$${i.value.replace(/[^\d.]/g, '') || '0.00'}`));
}

describe('volt-qc 07 ORDER HISTORY — Adjust Tip / Split Tip (write)', () => {
  after(async () => {
    await P.escape().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Single-tender order opens Adjust Tip pre-filled; saving $5 on cash updates Tip, Total, the Got line and the staff tip (OH-184, OH-189)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const { code, paidCents } = await createPaidOrder({ method: 'cash' });
      await openAdjustTip();
      expect(await P.has(D.adjustTip)).toBe(true);
      expect(await tipCurrentCents()).toBe(0);
      for (const c of '500') await tipKey(c);
      await saveTip();
      const d = await waitTip(code, '$5.00');
      expect(centsIn(field(d, 'Total'))).toBe(paidCents + 500);
      expect(
        centsIn(field(d, 'Subtotal')) +
          (centsIn(field(d, 'Tax')) || 0) -
          Math.abs(centsIn(field(d, 'Total Discount')) || 0),
      ).toBe(paidCents);
      const staff = staffInDetail(d)[0] ?? '';
      if (staff) expect(d).toContain(`${staff} - $5.00`);
      expect(paymentSection(d)).toMatch(/Tip:? \|?\s*\$5\.00/);
    },
  );

  it(
    title(
      'Tip keypad: presets add up, first digit replaces the pre-fill, delete key, $10,000 cap, Escape/outside do not close, X closes without saving (OH-185, OH-186, OH-187, OH-188)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { code } = await createPaidOrder({ method: 'cash' });
      await adjustTipTo('200');
      await waitTip(code, '$2.00');
      await step('OH-185 presets add to the current amount', async () => {
        await openAdjustTip();
        expect(await tipCurrentCents()).toBe(200);
        await tipKey('$20');
        expect(await tipEnteredCents()).toBe(2_200);
        await tipKey('$50');
        expect(await tipEnteredCents()).toBe(7_200);
        await closeTipDialog();
      });
      await step('OH-186 first digit replaces, next ones append, delete drops one', async () => {
        await openAdjustTip();
        for (const [k, v] of [
          ['5', 5],
          ['0', 50],
          ['0', 500],
        ] as const) {
          await tipKey(k);
          expect(await tipEnteredCents()).toBe(v);
        }
        await tipBackspace();
        expect(await tipEnteredCents()).toBe(50);
        for (let i = 0; i < 3; i += 1) await tipBackspace();
        expect(await tipEnteredCents()).toBe(0);
        await closeTipDialog();
      });
      await step('OH-187 capped at $10,000.00', async () => {
        await openAdjustTip();
        for (let i = 0; i < 51; i += 1) await tipKey('$200');
        expect(await tipEnteredCents()).toBe(T.maxTipCents);
        await closeTipDialog();
      });
      await step('OH-188 Escape / outside click keep it open; X closes without saving', async () => {
        await openAdjustTip();
        for (const k of ['9', '0', '0']) await tipKey(k);
        await P.escape();
        expect(await P.has(D.adjustTip)).toBe(true);
        await P.clickAt(5, 5);
        expect(await P.has(D.adjustTip)).toBe(true);
        await closeTipDialog();
        expect(field(await detailText(code), 'Tip')).toBe('$2.00');
        await openAdjustTip();
        expect(await tipEnteredCents()).toBe(200);
        await closeTipDialog();
      });
    },
  );

  it(
    title(
      'Cash/Other tip can go back down to $0.00; Total drops by the old tip (OH-190)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const { code } = await createPaidOrder({ method: 'other' });
      await adjustTipTo('100');
      const d1 = await waitTip(code, '$1.00');
      const total1 = centsIn(field(d1, 'Total'));
      await openAdjustTip();
      for (let i = 0; i < 4; i += 1) await tipBackspace();
      expect(await tipEnteredCents()).toBe(0);
      await saveTip();
      const d = await waitTip(code, '$0.00');
      expect(centsIn(field(d, 'Total'))).toBe(total1 - 100);
      expect(d).toMatch(/No tips details available\.|- \$0\.00/);
    },
  );

  it(
    title(
      "Two-staff order: an adjusted tip is re-split by the order's split method (evenly: first staff takes the odd cent) (OH-191)",
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const { code, staff } = await twoStaffOrder(this);
      await adjustTipTo('501');
      const d = await waitTip(code, '$5.01');
      const a = staffTip(d, staff[0] ?? '');
      const b = staffTip(d, staff[1] ?? '');
      expect(a + b).toBe(501);
      // The split method is merchant config (Settings › Tipping): evenly gives 251 / 250.
      if (Math.abs(a - b) <= 1) expect(a).toBeGreaterThanOrEqual(b);
    },
  );

  it(
    title(
      'Split Tip shows only on an unsettled order with more than one staff (OH-200)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const two = await twoStaffOrder(this);
      await adjustTipTo('500');
      await waitTip(two.code, '$5.00');
      expect(await P.has(SPLIT_TIP_OPEN)).toBe(true);
      const one = await createPaidOrder({ method: 'other' });
      await adjustTipTo('500');
      await waitTip(one.code, '$5.00');
      expect(await P.has(SPLIT_TIP_OPEN)).toBe(false);
    },
  );

  it(
    title(
      "Split Tip Proportion follows each staff's service revenue and the shares add up to the tip to the cent (VP-3903) (OH-202, OH-203)",
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { orderId, code, staff } = await twoStaffOrder(this);
      const prices = (serviceSection(await detailText(code)).match(/\$[\d,]+\.\d{2}/g) ?? []).map((p) =>
        centsIn(p),
      );
      const proportion = async (digits: string, usd: string): Promise<string> => {
        await adjustTipTo(digits);
        await waitTip(code, usd);
        await openSplitTip();
        await chooseSplit('Proportion');
        await openHistoryOrder(orderId);
        return detailText(code);
      };
      await step('OH-202 $6.70 split by revenue', async () => {
        const d = await proportion('670', '$6.70');
        const a = staffTip(d, staff[0] ?? '');
        const b = staffTip(d, staff[1] ?? '');
        expect(a + b).toBe(670);
        const [p1, p2] = [prices[0] ?? 0, prices[1] ?? 0];
        if (p1 > 0 && p2 > 0) expect(Math.abs(a - Math.round((670 * p1) / (p1 + p2)))).toBeLessThanOrEqual(1);
      });
      await step('OH-203 odd $25.80 still adds up', async () => {
        const d = await proportion('2580', '$25.80');
        expect(staffTip(d, staff[0] ?? '') + staffTip(d, staff[1] ?? '')).toBe(2_580);
      });
    },
  );

  it(
    title(
      'Split Tip: Confirm disabled with no change; Manual caps the second field at what is left; Split Evenly shows the even split at once (OH-204, OH-205, OH-206)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { orderId, code } = await twoStaffOrder(this);
      await adjustTipTo('2000');
      await waitTip(code, '$20.00');
      await step('OH-205 nothing changed → Confirm disabled', async () => {
        await openSplitTip();
        expect(await P.isDisabled([D.splitTip, btn('Confirm', 0)])).toBe(true);
        await P.escape();
      });
      await step('OH-204 Manual: sum below the tip locks Confirm; field 2 capped at the rest', async () => {
        await openSplitTip();
        await chooseSplit('Manual', false);
        await P.fillQ([D.splitTip, { css: 'input[placeholder="0.00"]', nth: 0 }], '1500');
        await P.fillQ([D.splitTip, { css: 'input[placeholder="0.00"]', nth: 1 }], '300');
        expect(await P.isDisabled([D.splitTip, btn('Confirm', 0)])).toBe(true);
        await P.fillQ([D.splitTip, { css: 'input[placeholder="0.00"]', nth: 1 }], '900');
        expect((await splitInputsCents())[1]).toBe(500);
        expect(await P.isDisabled([D.splitTip, btn('Confirm', 0)])).toBe(false);
        await P.clickQ([D.splitTip, btn('Confirm', 0)]);
        await passcodeIfAsked(2_000);
      });
      await step('OH-206 reopening Split Tip: Split Evenly shows $10 / $10 immediately', async () => {
        await openHistoryOrder(orderId);
        await openSplitTip();
        await P.clickQ([D.splitTip, tab('Split Evenly')]);
        expect(await splitInputsCents()).toEqual([1_000, 1_000]);
        await P.escape();
      });
    },
  );

  it(
    title(
      'Split Evenly $10.00 across 3 staff: $3.34 / $3.33 / $3.33, odd cent to the first (OH-201)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await freshTill();
      if ((await homePage.visibleStaffCount()) < 3) this.skip();
      const { orderId, code } = await createPaidOrder({
        method: 'other',
        lines: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      });
      const staff = staffInDetail(await detailText(code));
      if (staff.length < 3) this.skip();
      await adjustTipTo('1000');
      await waitTip(code, '$10.00');
      await openSplitTip();
      await chooseSplit('Split Evenly');
      await openHistoryOrder(orderId);
      const d = await P.poll(
        () => detailText(code),
        (x) => staff.every((s) => !Number.isNaN(staffTip(x, s))),
        15_000,
      );
      expect(staff.map((s) => staffTip(d, s))).toEqual([334, 333, 333]);
    },
  );

  it(
    title(
      'Two Other txns after a reopen: Adjust Tip opens the "Adjust Order Tip" list, one Adjust Tip per txn, the chosen one gets the tip (OH-192, RO-512)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const { orderId, code } = await createPaidOrder({ method: 'other' });
      try {
        await reopenToHome(orderId);
        expect(await tryAddService(1)).toBe(true);
        await payFromEdit();
        await enteredFor('other');
        await payDifference(orderId, 'other', 'E2E Other 2');
      } finally {
        await leaveReopen();
      }
      await freshDetail(orderId, (x) => countPayments(x, 'Other') === 2);
      await openAdjustTip();
      expect(await P.has(D.adjustOrderTipList)).toBe(true);
      expect(await P.count([D.adjustOrderTipList, btn('Adjust Tip')])).toBe(2);
      await P.clickQ([D.adjustOrderTipList, btn('Adjust Tip', 1)]);
      await P.waitFor(D.adjustTip, Timeouts.SHORT, 'Adjust Tip dialog');
      for (const k of '100') await tipKey(k);
      await saveTip();
      await P.escape();
      await openHistoryOrder(orderId);
      expect(field(await waitTip(code, '$1.00'), 'Tip')).toBe('$1.00');
    },
  );
});
