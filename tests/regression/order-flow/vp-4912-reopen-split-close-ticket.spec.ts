/**
 * VP-4912 — Re-Open of a split-paid order offers Close Ticket ("Re-Open Done") and is not
 * forced through "Void Order Transactions"; money is locked, non-money edits are kept.
 * Sub-bugs VP-5286 (popup Void + Subtotal/Tax recomputed on 1.1.85) and VP-5287 (a staff
 * / non-money edit still forces Void All) are TC-11 / TC-08 / TC-12.
 *
 * TC catalogue: docs/qc/volt-qc/vp-tickets/VP-4912-reopen-split-close-ticket-test-cases.md
 * (TC-VP4912-01…13). PR volt-pos#3172 (locked reopen).
 *
 * TC-02 builds ONE Cash + Other split order that TC-03…08, TC-11 and TC-12 re-open in
 * turn (the order can be re-opened again after each Re-Open Done). TC-09 (Cash + Cash)
 * and TC-10 (single cash payment, the control) build their own orders.
 *
 * No card terminal on this machine (Card → Pay is disabled): TC-13 stays PENDING.
 *
 * CREATES, SETTLES AND RE-OPENS ORDERS — dev / staging only. Leaves 3 paid orders
 * (Successful - Unsettled) on the merchant.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { OhRoText as T } from '../../../src/constants/testids.voltqc-oh-reopen.js';
import { VqpsCheckout } from '../../../src/constants/testids.voltqc-promo-split.js';
import { VpSplitReopen } from '../../../src/constants/testids.vp-split-tip-history.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { countPayments } from '../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import {
  editOrderFromCheckout,
  freshDetail,
  leaveReopenVq,
  payAndReopenDone,
  payFromEdit,
  reopenDialogText,
  reopenToCheckout,
  serviceLocked,
  staffSegment,
  tryAddService,
  voidDialog,
} from '../../../src/pages/voltqc/oh-reopen/vqReopen.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  app,
  field,
  money,
  uniqueName,
  vqEnv,
  visible,
  waitUntil,
} from '../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { escapeSplit, leaveSuccessIfShown, splitPayToSuccess } from './vp-split-payment.helpers.js';

interface Baseline {
  subtotal: number;
  tax: number;
  cash: number;
  other: number;
}

/** The Cash + Other split order TC-02 builds and later cases re-open. */
let splitId = '';
let base: Baseline = { subtotal: Number.NaN, tax: Number.NaN, cash: 0, other: 0 };

function requireSplit(ctx: Mocha.Context): string {
  if (!splitId) ctx.skip(); // TC-02 did not build the split order
  return splitId;
}

/** Subtotal / Tax / tender counts of a settled order's detail. */
async function baselineOf(id: string): Promise<Baseline> {
  const d = await freshDetail(id);
  return {
    subtotal: money(field(d, 'Subtotal')),
    tax: money(field(d, 'Tax')) || 0,
    cash: countPayments(d, 'Cash'),
    other: countPayments(d, 'Other'),
  };
}

/** Did "Void Order Transactions" come up within `ms`? (Backs out of it so cleanup can run.) */
async function voidForced(ms = 3_000): Promise<boolean> {
  const forced = await waitUntil(() => visible(voidDialog), ms);
  if (forced)
    await P.clickQ([voidDialog, { role: 'button', name: 'Back to Order', nth: 0 }]).catch(() => undefined);
  return forced;
}

/** Re-open `id` onto its checkout unless a previous case left it there. */
async function ensureReopenedCheckout(id: string): Promise<void> {
  const onCheckout = /\/checkout\?editOrderId=/.test(await app.url());
  if (!onCheckout) await reopenToCheckout(id);
}

describe('VP-4912 — Re-Open after a split payment: Close Ticket, no forced Void', () => {
  before(async () => {
    assertWritesAllowed('settle and re-open split orders');
    await returnToHome();
  });

  afterEach(async function () {
    // Keep the open re-open only between TC-03 → TC-04 → TC-05 (they continue one another).
    const t = this.currentTest?.title ?? '';
    if (/TC-VP4912-0[34]:/.test(t) && this.currentTest?.state === 'passed') return;
    await escapeSplit().catch(() => undefined);
    await leaveReopenVq();
    await leaveSuccessIfShown().catch(() => undefined);
  });

  after(async () => {
    await escapeSplit().catch(() => undefined);
    await leaveReopenVq();
    await returnToHome().catch(() => undefined);
  });

  describe('1. Split payment + first Re-Open', () => {
    it(title('TC-VP4912-01: POS version recorded (Menu › Version Update) — PENDING (doc-only)'));

    it(
      title(
        'TC-VP4912-02: split Equally Cash + Other → All checks paid → Payment Successful, one Cash + one Other txn',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(6 * 60_000);
        const r = await splitPayToSuccess(['Cash', 'Other']);
        splitId = r.id;
        expect(r.allChecksPaid).toBe(true);
        expect(r.successText).toContain('Payment Successful!');
        await app.noReceipt();
        const d = await freshDetail(r.id);
        expect(field(d, 'Status')).toBe('Successful - Unsettled');
        base = await baselineOf(r.id);
        expect(base.cash).toBe(1);
        expect(base.other).toBe(1);
      },
    );

    it(
      title(
        'TC-VP4912-03: first Re-Open of the split order → locked-reopen dialog, no "Void Order Transactions"',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = requireSplit(this);
        const dialog = await reopenDialogText(id);
        expect(dialog).toContain(T.msgNoEdit);
        expect(dialog).toContain(VpSplitReopen.lockedNonMoney);
        await reopenToCheckout(id);
        expect(await voidForced()).toBe(false);
      },
    );

    it(
      title(
        'TC-VP4912-04: the reopened split checkout offers Re-Open Done (Close Ticket)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = requireSplit(this);
        await ensureReopenedCheckout(id);
        expect(await voidForced(1_500)).toBe(false);
        expect(await visible(VqpsCheckout.reopenDone)).toBe(true);
        expect(await P.isDisabled(VqpsCheckout.reopenDone)).toBe(false);
      },
    );

    it(
      title(
        'TC-VP4912-05: Re-Open Done with no change closes the ticket — Successful - Unsettled, both txns kept',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = requireSplit(this);
        await ensureReopenedCheckout(id);
        await payAndReopenDone();
        expect(await app.path()).toMatch(/^\/order-history\//);
        const after = await baselineOf(id);
        expect(field(await freshDetail(id), 'Status')).toBe('Successful - Unsettled');
        expect(after.cash).toBe(base.cash);
        expect(after.other).toBe(base.other);
      },
    );

    it(
      title(
        'TC-VP4912-06: Subtotal / Tax on the reopened split checkout equal the paid values (not recomputed, VP-5286)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = requireSplit(this);
        await reopenToCheckout(id);
        expect(await voidForced()).toBe(false);
        const t = await app.orderTotals();
        expect(t.subtotal).toBeCloseTo(base.subtotal, 2);
        expect(t.tax).toBeCloseTo(base.tax, 2);
        await payAndReopenDone();
      },
    );
  });

  describe('2. Money locked, non-money editable', () => {
    it(
      title(
        'TC-VP4912-07: split reopen locks money — no service can be added, Home total unchanged',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = requireSplit(this);
        await reopenToCheckout(id);
        await voidForced();
        await editOrderFromCheckout();
        const before = await app.orderTotals();
        expect(await serviceLocked(vqEnv.testService2)).toBe(true);
        expect(await tryAddService(vqEnv.testService2)).toBe(false);
        const after = await app.orderTotals();
        expect(after.subtotal).toBeCloseTo(before.subtotal, 2);
        expect(after.total).toBeCloseTo(before.total, 2);
        await payAndReopenDone();
      },
    );

    it(
      title(
        'TC-VP4912-08: split reopen → Change Staff → Pay is not forced to Void; Re-Open Done keeps the new staff and both txns (VP-5287)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const id = requireSplit(this);
        const staff2 = vqEnv.testStaff2;
        await reopenToCheckout(id);
        await voidForced();
        await editOrderFromCheckout();
        await step(`Change Staff → ${staff2}`, () => app.changeStaff(staff2));
        await payFromEdit();
        expect(await voidForced()).toBe(false);
        expect(await visible(VqpsCheckout.reopenDone)).toBe(true);
        await payAndReopenDone();
        const d = await freshDetail(id, (x) => staffSegment(x, staff2) !== '');
        expect(staffSegment(d, staff2)).not.toBe('');
        expect(countPayments(d, 'Cash')).toBe(base.cash);
        expect(countPayments(d, 'Other')).toBe(base.other);
      },
    );

    it(
      title(
        'TC-VP4912-09: split Cash + Cash → reopen: no Void popup, Re-Open Done, Subtotal/Tax kept, both cash txns kept',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(7 * 60_000);
        await returnToHome();
        const r = await splitPayToSuccess(['Cash', 'Cash']);
        await app.noReceipt();
        const b = await baselineOf(r.id);
        expect(b.cash).toBe(2);
        await reopenToCheckout(r.id);
        expect(await voidForced()).toBe(false);
        expect(await visible(VqpsCheckout.reopenDone)).toBe(true);
        const t = await app.orderTotals();
        expect(t.subtotal).toBeCloseTo(b.subtotal, 2);
        expect(t.tax).toBeCloseTo(b.tax, 2);
        await payAndReopenDone();
        const after = await baselineOf(r.id);
        expect(after.cash).toBe(2);
      },
    );

    it(
      title(
        'TC-VP4912-10: control — a single cash payment reopens normally: no Void popup, Re-Open Done, totals kept',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(5 * 60_000);
        await returnToHome();
        const { id } = await app.createPaidOrder({ method: 'Cash' });
        const b = await baselineOf(id);
        await reopenToCheckout(id);
        expect(await voidForced()).toBe(false);
        expect(await visible(VqpsCheckout.reopenDone)).toBe(true);
        const t = await app.orderTotals();
        expect(t.subtotal).toBeCloseTo(b.subtotal, 2);
        expect(t.tax).toBeCloseTo(b.tax, 2);
        await payAndReopenDone();
        expect(field(await freshDetail(id), 'Status')).toBe('Successful - Unsettled');
      },
    );
  });

  describe('3. Sub-bugs VP-5286 / VP-5287', () => {
    it(
      title(
        'TC-VP4912-11: VP-5286 — split reopen → Edit Order → Pay again with no change: still no Void popup, Re-Open Done closes',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = requireSplit(this);
        await reopenToCheckout(id);
        await voidForced();
        await editOrderFromCheckout();
        await payFromEdit();
        expect(await voidForced()).toBe(false);
        expect(await visible(VqpsCheckout.reopenDone)).toBe(true);
        await payAndReopenDone();
        const after = await baselineOf(id);
        expect(after.cash).toBe(base.cash);
        expect(after.other).toBe(base.other);
      },
    );

    it(
      title(
        'TC-VP4912-12: VP-5287 — split reopen → edit the Order Note → Pay is not forced to Void All; the note is saved',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const id = requireSplit(this);
        const note = uniqueName('QC VP4912');
        await reopenToCheckout(id);
        await voidForced();
        await editOrderFromCheckout();
        await step(`Order Note → "${note}"`, () => app.addNote(note));
        await payFromEdit();
        expect(await voidForced()).toBe(false);
        expect(await visible(VqpsCheckout.reopenDone)).toBe(true);
        await payAndReopenDone();
        const d = await freshDetail(id, (x) => x.includes(note));
        expect(d).toContain(note);
        expect(countPayments(d, 'Cash')).toBe(base.cash);
        expect(countPayments(d, 'Other')).toBe(base.other);
      },
    );

    it(
      title(
        'TC-VP4912-13: split with a Card leg (Card + Cash) → reopen offers Re-Open Done — PENDING (no card terminal: Card → Pay disabled)',
      ),
    );
  });
});
