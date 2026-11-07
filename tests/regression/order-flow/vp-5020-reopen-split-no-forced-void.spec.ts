/**
 * VP-5020 — Re-Open of a fully paid split order must not force "Void Order Transactions".
 * Bug (22/10, dev): every Re-Open of a split order opened the Edit screen straight into
 * the Void popup, so the paid checks could never be kept. Fixed — QC by hand 30/10 on
 * 1.1.68 and 06/11 on 1.1.108 (QC Completed).
 *
 * TC catalogue: docs/qc/volt-qc/vp-tickets/VP-5020-reopen-split-no-forced-void-test-cases.md
 * (TC-VP5020-02…10).
 *
 * Group 1 builds ONE Cash + Cash split of 2 services (the ticket's steps) in TC-02 that
 * TC-03 → TC-08 re-open in turn. Group 2 builds a Card + Cash split (REAL card charge —
 * CARD_SETTLE=1 and a connected terminal).
 *
 * CREATES, SETTLES AND RE-OPENS ORDERS — dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { changeStaffTo, field, staffInDetail } from '../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import {
  createSplitPaid,
  editOrderFromCheckout,
  leaveReopenVq,
  payAndReopenDone,
  reopenToCheckout,
} from '../../../src/pages/voltqc/oh-reopen/vqReopen.js';
import { settleCardDialog } from '../../../src/pages/voltqc/promo-split/splitDeepExtra.js';
import { app } from '../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  countPayments,
  detailOf,
  hasVoided,
  otherStaffIndex,
  paidState,
  reopenDoneShown,
  requireTerminal,
  screenTotals,
  splitCardCash,
  type Totals,
  voidForced,
} from './vp-5020.helpers.js';
import { escapeSplit, leaveSuccessIfShown } from './vp-split-payment.helpers.js';

const NO_TOTALS: Totals = { subtotal: Number.NaN, tax: Number.NaN, total: Number.NaN };

let cashId = '';
let cashBase: Totals = NO_TOTALS;
let cardId = '';
let cardBase: Totals = NO_TOTALS;

function need(id: string, ctx: Mocha.Context): string {
  if (!id) ctx.skip(); // the case that builds the order did not run / failed
  return id;
}

/** Already on the reopened checkout of `id`? Otherwise Re-Open it (backing out of any Void). */
async function ensureReopened(id: string): Promise<void> {
  if (!/editOrderId=/.test(await app.url())) {
    await reopenToCheckout(id);
    await voidForced();
  }
}

/** Re-Open Done, then the order must still be Successful - Unsettled with the same money. */
async function expectKeptAfterDone(
  id: string,
  base: Totals,
  payments: { Cash: number; Card?: number },
): Promise<string> {
  await payAndReopenDone();
  const { t, detail } = await detailOf(id);
  expect({ where: 'Order Details after Re-Open Done', ...t }).toEqual({
    where: 'Order Details after Re-Open Done',
    ...base,
  });
  expect(detailField(detail)).toBe('Successful - Unsettled');
  expect(countPayments(detail, 'Cash')).toBe(payments.Cash);
  if (payments.Card !== undefined) expect(countPayments(detail, 'Card')).toBe(payments.Card);
  expect(hasVoided(detail)).toBe(false);
  return detail;
}

const detailField = (detail: string): string => field(detail, 'Status');

describe('VP-5020 — Re-Open of a paid split order does not force Void All', () => {
  before(async () => {
    assertWritesAllowed('settle and re-open split orders');
    await returnToHome();
  });

  afterEach(async function () {
    // TC-03 → TC-04 → TC-05 (and TC-09) continue one open re-open; keep it while they pass.
    const t = this.currentTest?.title ?? '';
    if (/TC-VP5020-0[3459]/.test(t) && this.currentTest?.state === 'passed') return;
    await settleCardDialog().catch(() => undefined);
    await escapeSplit().catch(() => undefined);
    await leaveReopenVq();
    await leaveSuccessIfShown().catch(() => undefined);
  });

  after(async () => {
    await leaveReopenVq();
    await returnToHome().catch(() => undefined);
  });

  describe('1. Split Cash + Cash (ticket steps)', () => {
    it(
      title(
        'TC-VP5020-02: split Equally 2 services Cash + Cash → Successful - Unsettled, 2 Cash txns (TC-VP5020-02)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(8 * 60_000);
        await returnToHome();
        const { id } = await createSplitPaid(['Cash', 'Cash']);
        cashId = id;
        const { t, detail } = await detailOf(id);
        cashBase = t;
        expect(detailField(detail)).toBe('Successful - Unsettled');
        expect(countPayments(detail, 'Cash')).toBe(2);
        expect(t.total).toBeGreaterThan(0);
      },
    );

    it(
      title(
        'TC-VP5020-03: Re-Open without changes → no "Void Order Transactions", Re-Open Done offered (TC-VP5020-03)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = need(cashId, this);
        await reopenToCheckout(id);
        expect(await voidForced()).toBe(false);
        expect(await reopenDoneShown()).toBe(true);
      },
    );

    it(
      title(
        'TC-VP5020-04: reopened checkout keeps the paid checks — Total Paid = Total, Remaining $0.00 (TC-VP5020-04)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = need(cashId, this);
        await ensureReopened(id);
        const s = await paidState();
        expect(s.totalPaid).toBeCloseTo(cashBase.total, 2);
        expect(s.remaining).toBeCloseTo(0, 2);
      },
    );

    it(
      title(
        'TC-VP5020-05: reopened checkout Subtotal / Tax / Total equal Order Details (TC-VP5020-05)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = need(cashId, this);
        await ensureReopened(id);
        expect({ where: 'reopened checkout', ...(await screenTotals()) }).toEqual({
          where: 'reopened checkout',
          ...cashBase,
        });
      },
    );

    it(
      title(
        'TC-VP5020-06: Re-Open Done without changes keeps both Cash txns, nothing Voided (TC-VP5020-06)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = need(cashId, this);
        await ensureReopened(id);
        expect(await voidForced(1_500)).toBe(false);
        await expectKeptAfterDone(id, cashBase, { Cash: 2 });
      },
    );

    it(
      title(
        'TC-VP5020-07: Re-Open a second time → still no Void, Re-Open Done keeps the txns (TC-VP5020-07)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = need(cashId, this);
        await reopenToCheckout(id);
        expect(await voidForced()).toBe(false);
        expect(await reopenDoneShown()).toBe(true);
        await expectKeptAfterDone(id, cashBase, { Cash: 2 });
      },
    );

    it(
      title(
        'TC-VP5020-08: Re-Open → Change Staff → Re-Open Done, no forced Void, staff saved (TC-VP5020-08)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const id = need(cashId, this);
        const before = (await detailOf(id)).detail;
        const current = staffInDetail(before)[0] ?? '';
        await reopenToCheckout(id);
        expect(await voidForced()).toBe(false);
        await editOrderFromCheckout();
        const target = await otherStaffIndex(current);
        if (target.index < 0) this.skip(); // only one staff tile on Home
        await step(`Change Staff ${current} → ${target.name}`, () => changeStaffTo(target.index));
        expect(await voidForced(2_000)).toBe(false);
        const detail = await expectKeptAfterDone(id, cashBase, { Cash: 2 });
        expect(staffInDetail(detail)).toContain(target.name);
      },
    );
  });

  describe('2. Split Card + Cash', () => {
    it(
      title(
        'TC-VP5020-09: split Card + Cash → Re-Open: no Void, Remaining $0.00, totals equal Order Details (TC-VP5020-09)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(10 * 60_000);
        await requireTerminal(this);
        const id = await splitCardCash();
        cardId = id;
        const { t, detail } = await detailOf(id);
        cardBase = t;
        expect(countPayments(detail, 'Card')).toBe(1);
        expect(countPayments(detail, 'Cash')).toBe(1);
        await reopenToCheckout(id);
        expect(await voidForced()).toBe(false);
        expect(await reopenDoneShown()).toBe(true);
        const s = await paidState();
        expect(s.totalPaid).toBeCloseTo(cardBase.total, 2);
        expect(s.remaining).toBeCloseTo(0, 2);
        expect({ where: 'reopened checkout', ...(await screenTotals()) }).toEqual({
          where: 'reopened checkout',
          ...cardBase,
        });
      },
    );

    it(
      title(
        'TC-VP5020-10: Re-Open Done on the Card + Cash split keeps 1 Card + 1 Cash, nothing Voided (TC-VP5020-10)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = need(cardId, this);
        await ensureReopened(id);
        await expectKeptAfterDone(id, cardBase, { Cash: 1, Card: 1 });
      },
    );
  });
});
