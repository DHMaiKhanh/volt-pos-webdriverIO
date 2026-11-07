/**
 * VP-5297 — Re-Open of a split Card + Cash order: the Edit screen (reopened checkout panel
 * and the Edit Order cart) must show the same Subtotal / service-line price as Order
 * Details. Bug on 1.1.68: Edit showed $101.49 while Order Details said $101.50 (rounding
 * when the card / cash prices are spread over the line). Fixed — QC by hand on 1.1.108.
 *
 * TC catalogue: docs/qc/volt-qc/vp-tickets/VP-5297-reopen-split-card-cash-subtotal-test-cases.md
 * (TC-VP5297-02…09; TC-01 "ghi version" đã bỏ 07/11).
 *
 * TC-02 builds ONE Card + Cash split order (REAL card charge — needs CARD_SETTLE=1 and
 * header Devices › Terminal Connected) that TC-03 → TC-06 re-open in turn. TC-07 / TC-08
 * are the no-card controls (Cash + Other, Cash + Cash) and build their own orders.
 *
 * CREATES, SETTLES AND RE-OPENS ORDERS — dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { VqpsCheckout } from '../../../src/constants/testids.voltqc-promo-split.js';
import { returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { settle } from '../../../src/helpers/wait.js';
import {
  countPayments,
  detailActions,
  detailText,
  findHistoryCode,
} from '../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { openRow, rowCodes } from '../../../src/pages/voltqc/pos/orderHistoryProbe.js';
import {
  editOrderFromCheckout,
  freshDetail,
  leaveReopenVq,
  payAndReopenDone,
  payFromEdit,
  reopenToCheckout,
  voidDialog,
} from '../../../src/pages/voltqc/oh-reopen/vqReopen.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  settleCardDialog,
  terminalConnected,
  watchCard,
} from '../../../src/pages/voltqc/promo-split/splitDeepExtra.js';
import * as S from '../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  app,
  clickOrJs,
  field,
  money,
  visible,
  vqEnv,
  waitUntil,
} from '../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { escapeSplit, leaveSuccessIfShown, splitPayToSuccess } from './vp-split-payment.helpers.js';

const SERVICE = process.env.VP5297_SERVICE ?? 'Dark Queen';
const STAFF = process.env.VP5297_STAFF ?? 'Zelene Doyle';

interface Amounts {
  subtotal: number;
  tax: number;
  total: number;
  /** Price of the SERVICE line. */
  line: number;
}

/** "| <name> | $x" → x, from a pipe-joined page text. */
function lineAmount(text: string, name: string): number {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return money(new RegExp(`\\| ${esc} \\| (-?\\$[\\d,.]+)`).exec(text)?.[1]);
}

/** Order Details amounts of a paid order. */
async function detailAmounts(id: string): Promise<{ a: Amounts; detail: string }> {
  // A just-paid order can be missing from the Order History list for a few seconds
  // ("Never appeared: Order #…") — retry the open a couple of times.
  let d = '';
  for (let attempt = 1; ; attempt += 1) {
    try {
      d = await freshDetail(id);
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      await settle(4_000);
      await returnToHome().catch(() => undefined);
    }
  }
  return {
    detail: d,
    a: {
      subtotal: money(field(d, 'Subtotal')),
      tax: money(field(d, 'Tax')) || 0,
      total: money(field(d, 'Total')),
      line: lineAmount(d, SERVICE),
    },
  };
}

/** Amounts on the current screen (reopened checkout panel or Edit Order cart). */
async function screenAmounts(): Promise<Amounts> {
  const t = await app.orderTotals();
  return {
    subtotal: t.subtotal,
    tax: t.tax,
    total: t.total,
    line: lineAmount(await app.text('main'), SERVICE),
  };
}

function expectSame(actual: Amounts, want: Amounts, where: string): void {
  expect({ where, ...actual }).toEqual({ where, ...want });
}

/** Did "Void Order Transactions" come up within `ms`? (Backs out of it so cleanup can run.) */
async function voidForced(ms = 3_000): Promise<boolean> {
  const forced = await waitUntil(() => visible(voidDialog), ms);
  if (forced)
    await P.clickQ([voidDialog, { role: 'button', name: 'Back to Order', nth: 0 }]).catch(() => undefined);
  return forced;
}

async function requireTerminal(ctx: Mocha.Context): Promise<void> {
  if (!vqEnv.cardSettle) {
    console.warn('VP-5297 Card + Cash: real card charge — set CARD_SETTLE=1');
    ctx.skip();
  }
  if (!(await terminalConnected({ fresh: true }))) {
    console.warn('VP-5297 Card + Cash: header Devices › Terminal is not Connected');
    ctx.skip();
  }
}

/**
 * Quick Checkout → STAFF → SERVICE → Split Equally → check 1 Card (real charge, No Tip,
 * signature on the customer display) → check 2 Cash → Complete Done → No Receipt.
 */
async function splitCardCash(): Promise<string> {
  await returnToHome();
  const id = await app.createOrder({ staff: STAFF, services: [SERVICE] });
  await S.openSplit();
  try {
    await step('Check 1 → Card → Pay (terminal, No Tip, sign)', async () => {
      await S.selectCheck(id, 1);
      await clickOrJs(S.methodButton('Card'), 3_000);
      await settle(300);
      await clickOrJs(S.payButton, 3_000);
      await watchCard(async () => visible(S.paidDialog(1)), { timeoutMs: 180_000, reset: true });
      await S.closePaidDialog(1);
    });
    await step('Check 2 → Cash → Complete Check 2', async () => {
      await S.payCheck(id, 2, 'Cash');
    });
    await step('Complete Done → No Receipt', async () => {
      const success = await S.completeDone();
      expect(success).toContain('Payment Successful!');
      await app.noReceipt();
    });
    return id;
  } catch (e) {
    await settleCardDialog().catch(() => undefined);
    await escapeSplit().catch(() => undefined);
    throw e;
  }
}

/** Shared TC-07 / TC-08 body: split with two non-card methods, re-open, compare, Re-Open Done. */
async function controlCase(methods: readonly S.CheckMethod[]): Promise<void> {
  await returnToHome();
  const r = await splitPayToSuccess(methods, { services: [SERVICE] });
  await app.noReceipt();
  const { a: before } = await detailAmounts(r.id);
  await reopenToCheckout(r.id);
  expect(await voidForced()).toBe(false);
  expectSame(await screenAmounts(), before, 'reopened checkout');
  await payAndReopenDone();
  const { a: after } = await detailAmounts(r.id);
  expectSame(after, before, 'Order Details after Re-Open Done');
}

/** The order the bug was reported on (30/10, now Settled). */
const ORIGINAL_ORDER = 'OD261030-39808255';

/**
 * Order History filtered to Successful - Settled + Card/Cash over 14 days; open the
 * original order if listed, else the first row whose Payment Details hold both a Card
 * and a Cash tender. Leaves that order's detail open; returns its code ('' = none).
 */
async function findSettledCardCash(): Promise<string> {
  await findHistoryCode(['successful-settled'], ['card', 'cash'], 14);
  const codes = await rowCodes();
  const ordered = codes.includes(ORIGINAL_ORDER)
    ? [ORIGINAL_ORDER, ...codes.filter((c) => c !== ORIGINAL_ORDER)]
    : codes;
  for (const code of ordered.slice(0, 12)) {
    await openRow(code);
    const ok = await waitUntil(async () => field(await detailText(code), 'Status') !== '', 10_000);
    if (!ok) continue;
    const d = await detailText(code);
    if (countPayments(d, 'Card') >= 1 && countPayments(d, 'Cash') >= 1) return code;
  }
  return '';
}

let cardId = '';
let base: Amounts = { subtotal: Number.NaN, tax: Number.NaN, total: Number.NaN, line: Number.NaN };

function requireCardOrder(ctx: Mocha.Context): string {
  if (!cardId) ctx.skip(); // TC-02 did not build the Card + Cash order
  return cardId;
}

async function ensureReopened(id: string): Promise<void> {
  if (!/editOrderId=/.test(await app.url())) {
    await reopenToCheckout(id);
    await voidForced();
  }
}

describe('VP-5297 — Re-Open split Card + Cash: Edit screen Subtotal matches Order Details', () => {
  before(async () => {
    assertWritesAllowed('settle (real card) and re-open split orders');
    await returnToHome();
  });

  afterEach(async function () {
    // TC-03 → TC-04 → TC-05 continue one open re-open; keep it while they pass.
    const t = this.currentTest?.title ?? '';
    if (/TC-VP5297-0[345]/.test(t) && this.currentTest?.state === 'passed') return;
    await settleCardDialog().catch(() => undefined);
    await escapeSplit().catch(() => undefined);
    await leaveReopenVq();
    await leaveSuccessIfShown().catch(() => undefined);
  });

  after(async () => {
    await leaveReopenVq();
    await returnToHome().catch(() => undefined);
  });

  describe('1. Split Card + Cash → Re-Open', () => {
    it(
      title(
        'TC-VP5297-02: split Equally Card + Cash → Payment Successful, one Card + one Cash txn (TC-VP5297-02)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(8 * 60_000);
        await requireTerminal(this);
        const id = await splitCardCash();
        cardId = id;
        const { a, detail } = await detailAmounts(id);
        base = a;
        expect(field(detail, 'Status')).toBe('Successful - Unsettled');
        expect(countPayments(detail, 'Card')).toBe(1);
        expect(countPayments(detail, 'Cash')).toBe(1);
        expect(base.line).toBeCloseTo(base.subtotal, 2);
        // Not asserted: Subtotal + Tax can be 1¢ above Total on a Card + Cash split
        // ($101.50 + $5.08 vs $106.57 = card + cash) — the VP-4405 tax drift, not VP-5297.
      },
    );

    it(
      title(
        'TC-VP5297-03: Re-Open the Card + Cash split → no "Void Order Transactions", Re-Open Done offered (TC-VP5297-03)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = requireCardOrder(this);
        await reopenToCheckout(id);
        expect(await voidForced()).toBe(false);
        expect(await visible(VqpsCheckout.reopenDone)).toBe(true);
      },
    );

    it(
      title(
        'TC-VP5297-04: reopened checkout panel — Subtotal and service line equal Order Details, not 1 cent off (TC-VP5297-04)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.CRITICAL,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = requireCardOrder(this);
        await ensureReopened(id);
        expectSame(await screenAmounts(), base, 'reopened checkout');
      },
    );

    it(
      title(
        'TC-VP5297-05: Edit Order cart — Subtotal and service line equal Order Details (TC-VP5297-05)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const id = requireCardOrder(this);
        await ensureReopened(id);
        await editOrderFromCheckout();
        expectSame(await screenAmounts(), base, 'Edit Order cart');
      },
    );

    it(
      title(
        'TC-VP5297-06: Re-Open Done keeps Subtotal / Tax / Total and the Card + Cash txns (TC-VP5297-06)',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        const id = requireCardOrder(this);
        if (/\/home/.test(await app.path())) await payFromEdit();
        else await ensureReopened(id);
        expect(await voidForced()).toBe(false);
        await payAndReopenDone();
        const { a, detail } = await detailAmounts(id);
        expectSame(a, base, 'Order Details after Re-Open Done');
        expect(field(detail, 'Status')).toBe('Successful - Unsettled');
        expect(countPayments(detail, 'Card')).toBe(1);
        expect(countPayments(detail, 'Cash')).toBe(1);
      },
    );
  });

  describe('2. Controls without a card leg', () => {
    it(
      title(
        'TC-VP5297-07: control split Cash + Other — Order Details = reopened checkout = after Re-Open Done (TC-VP5297-07)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(8 * 60_000);
        await controlCase(['Cash', 'Other']);
      },
    );

    it(
      title(
        'TC-VP5297-08: control split Cash + Cash — Order Details = reopened checkout = after Re-Open Done (TC-VP5297-08)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(8 * 60_000);
        await controlCase(['Cash', 'Cash']);
      },
    );

    it(
      title(
        'TC-VP5297-09: a Successful - Settled Card + Cash split order offers only Receipt + Refund — no Re-Open / Cancel / Adjust Tip (TC-OH-08, OH-104) (TC-VP5297-09)',
        Tag.REGRESSION,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const code = await findSettledCardCash();
        if (!code) {
          console.warn('VP-5297 TC-09: no Successful - Settled Card + Cash split order in the last 14 days');
          this.skip();
        }
        const d = await detailText(code);
        await step(`Settled Card + Cash order: ${code} (${field(d, 'Total')})`, () => Promise.resolve());
        expect(field(d, 'Status')).toBe('Successful - Settled');
        expect(countPayments(d, 'Card')).toBeGreaterThanOrEqual(1);
        expect(countPayments(d, 'Cash')).toBeGreaterThanOrEqual(1);
        const a = await detailActions();
        expect({ code, ...a }).toEqual(
          expect.objectContaining({
            code,
            Receipt: true,
            Refund: true,
            'Re-Open Order': false,
            'Continue Re-open': false,
            'Cancel Order': false,
            'Adjust Tip': false,
          }),
        );
      },
    );
  });
});
