/**
 * volt-qc port — 05 SPLIT: paying checks by CARD (Bamboo Dot), terminal not connected, network loss.
 *
 * Source: volt-qc `e2e/tests/05-split/split-plan-card.spec.ts` (SPL-C1..C6). Default order = Equally, 2 checks.
 *
 * Gating (this suite has no volt-qc IPC interceptor nor its net proxy):
 *  - Real card charges (SPL-C2, SPL-C6) need CARD_SETTLE=1 AND header Devices › Terminal Connected.
 *  - SPL-C5 drives Card + Signature Before up to the customer tip/signature screen and cancels there (no charge);
 *    it still talks to the terminal, so it is gated the same way.
 *  - SPL-C1 runs the "terminal not connected" half only when the till really has no terminal; with a terminal plugged in
 *    the unplug would have to be simulated (volt-qc `src/flows/ipc.ts`) → skipped.
 *  - SPL-C3 needs volt-qc's network proxy (`src/flows/net.ts`) → skipped.
 *  - SPL-C4 never charges (reads prices / customer tiles only) → always runs.
 *
 * CREATES DATA. SPL-C5 / SPL-C6 flip Tipping Settings (signature rule, Card tip) and restore them in `finally`.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { btn } from '../../../../src/constants/testids.voltqc-pos.js';
import { VqpsCustomer } from '../../../../src/constants/testids.voltqc-promo-split.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  readSignatureSettings,
  setSignatureSettings,
  setTipMethod,
  type SignatureSettings,
} from '../../../../src/pages/voltqc/cd-e2e/settingsCd.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  cardPayments,
  customerTileLit,
  flat,
  note,
  payAmount,
  payDisabled,
  paymentDetails,
  settleCardDialog,
  signatureWaitDialog,
  successfulCards,
  terminalConnected,
  waitingDialog,
  watchCard,
} from '../../../../src/pages/voltqc/promo-split/splitDeepExtra.js';
import * as S from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import {
  app,
  cust,
  field,
  visible,
  vqEnv,
  waitUntil,
} from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';

/** A synchronous assertion block reported as a step. */
const check = (name: string, fn: () => void): Promise<void> => step(name, () => Promise.resolve().then(fn));

/** Skip unless real charges are allowed and the terminal is connected (volt-qc `requireTerminal`). */
async function requireTerminal(ctx: Mocha.Context): Promise<void> {
  if (!vqEnv.cardSettle) {
    console.warn('Real card charge — set CARD_SETTLE=1 (Bamboo Dot plugged in, card on the reader)');
    ctx.skip();
  }
  if (!(await terminalConnected())) {
    console.warn('Terminal not connected (header Devices › Terminal is not Connected)');
    ctx.skip();
  }
}

/** Run `fn` with the signature rule (and optionally Card tip) changed; always restore. */
async function withSignature(
  want: SignatureSettings,
  tipOnCard: boolean | null,
  fn: () => Promise<void>,
): Promise<void> {
  const sigBefore = await readSignatureSettings();
  let tipBefore: boolean | null = null;
  try {
    await setSignatureSettings(want);
    if (tipOnCard !== null) tipBefore = await setTipMethod('card', tipOnCard);
    await app.go('/home', { passcode: false });
    await fn();
  } finally {
    await app.closeStrayDialogs().catch(() => undefined);
    if (tipBefore !== null && tipBefore !== tipOnCard) {
      await setTipMethod('card', tipBefore).catch((e: unknown) =>
        note(`Restoring Card tip failed: ${String(e)}`, 'cleanup'),
      );
    }
    await setSignatureSettings(sigBefore).catch((e: unknown) =>
      note(`Restoring signature rule failed: ${String(e)}`, 'cleanup'),
    );
    await app.go('/home', { passcode: false }).catch(() => undefined);
  }
}

const reMoney = (n: number): string => `\\$${n.toFixed(2).replace('.', '\\.')}`;

describe('volt-qc 05 SPLIT card — pay a check by card / no terminal / network loss', () => {
  before(() => {
    assertWritesAllowed('volt-qc 05 SPLIT card: split checks paid by card / cash');
  });

  afterEach(async () => {
    await settleCardDialog().catch(() => undefined);
    await app.closeStrayDialogs().catch(() => undefined);
    await app.cleanupOrders();
  });

  it(
    title(
      'SPL-C1 Terminal not connected: Card on a check locks Pay; Cash still pays; Card again locks (SPLIT-041)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      const realConnected = await terminalConnected({ fresh: true });
      if (realConnected) {
        console.warn(
          'Terminal is plugged in — the unplug is simulated in volt-qc through its IPC interceptor (src/flows/ipc.ts), not ported; run on a till without a terminal',
        );
        this.skip();
      }
      const id = await app.createOrder();
      await S.openSplit();
      await S.selectCheck(id, 1);
      await P.clickQ(S.methodButton('Card'));
      await step('Card + no terminal → Pay locked', async () => {
        await waitUntil(() => payDisabled(), 10_000, 300);
        expect(await payDisabled()).toBe(true);
      });
      await step('Cash → Pay enabled; Card again → locked', async () => {
        await P.clickQ(S.methodButton('Cash'));
        await waitUntil(async () => !(await payDisabled()), 5_000, 200);
        expect(await payDisabled()).toBe(false);
        await P.clickQ(S.methodButton('Card'));
        await waitUntil(() => payDisabled(), 5_000, 200);
        expect(await payDisabled()).toBe(true);
      });
      note(
        'Re-plug → Pay enabled not checked: needs the volt-qc terminal simulation (no real terminal on this till).',
      );
    },
  );

  it(
    title(
      'SPL-C2 Check 1 by Card + cashier tip $1: reader approves, row "Paid with Card … + Tip: $1.00"; Void the card check → Void Payment Successful!, check unpaid (SPLIT-042, SPLIT-087)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
    ),
    async function () {
      this.timeout(8 * 60_000);
      await requireTerminal(this);
      const id = await app.createOrder();
      await S.openSplit();
      const [check1] = await S.checkAmounts(id);
      const c1 = check1 ?? Number.NaN;
      try {
        await S.selectCheck(id, 1);
        await P.clickQ(S.methodButton('Card'));
        await S.cashierTip('100');
        const pay = await payAmount();
        expect(pay).toBeCloseTo(c1 + 1, 2);
        await P.clickQ(S.payButton);
        const trace = await watchCard(async () => visible(S.paidDialog(1)), {
          timeoutMs: 150_000,
          reset: true,
        });

        await check(
          'SPLIT-042 card dialog Present Card → Processing Payment → Payment Successful!; customer shows the amount',
          () => {
            const m = trace.main.join(' ⟶ ');
            note(`Card trace: ${m}`);
            expect(m).toMatch(/Present Card[\s\S]*Processing Payment[\s\S]*Payment Successful!/);
            expect(trace.customer.join(' ⟶ ')).toContain(`Total Amount | $${pay.toFixed(2)}`);
            if (!/\+ \$1\.00 [Tt]ip/.test(m)) {
              note(
                `Card dialog does not show "(… + $1.00 Tip)" as TC SPLIT-042 says: ${trace.main.find((x) => /Present Card/.test(x)) ?? ''}`,
                'observation',
              );
            }
          },
        );

        await step(
          'SPLIT-042 "Check 1 Paid Successfully | $x", "1 check remaining"; row "Paid with Card - … $check + Tip: $1.00"',
          async () => {
            const paidText = await flat(S.paidDialog(1));
            expect(paidText).toMatch(new RegExp(`Check 1 Paid Successfully \\| ${reMoney(pay)}`));
            expect(paidText).toMatch(/1 check remaining - total \$/);
            await S.closePaidDialog(1);
            const t = await app.text('main');
            expect(t).toMatch(new RegExp(`Paid with Card - [^|]*${reMoney(c1)} \\+ Tip: \\$1\\.00`));
            expect((await S.paidRemaining()).totalPaid).toBeCloseTo(pay, 2);
          },
        );

        await step('SPLIT-087 Void the card check → check 1 unpaid, Total Paid $0', async () => {
          await app.closeToasts();
          await S.voidCheck(id, 1);
          expect(await S.isCheckPaid(id, 1)).toBe(false);
          expect((await S.paidRemaining()).totalPaid).toBe(0);
        });

        // Finish the order in Cash so no half-paid split is left behind.
        await S.payCheck(id, 1, 'Cash');
        await S.payCheck(id, 2, 'Cash');
        await S.completeDone();
        await app.noReceipt();
        app.createdOrders.delete(id);
      } finally {
        await S.settleSplit(id);
      }

      await step(
        'Order History: original charge Successful + Voided row (same Auth Code), Cancel information #-1; Total = the 2 Cash checks',
        async () => {
          await app.openHistoryOrder(id);
          // The card void goes through the gateway: "Canceling" a few seconds before the "Voided" row → reopen until there (≤ 90 s).
          let d = await app.historyDetail(id);
          const t0 = Date.now();
          while (
            !cardPayments(paymentDetails(d)).some((x) => x.status === 'Voided') &&
            Date.now() - t0 < 90_000
          ) {
            await settle(5_000);
            await app.openHistoryOrder(id);
            d = await app.historyDetail(id);
          }
          const pd = paymentDetails(d);
          note(`Payment Details (after ${String(Math.round((Date.now() - t0) / 1000))} s): ${pd}`);
          expect(field(d, 'Status')).toMatch(/^Successful/);
          const sale = successfulCards(pd);
          const voided = cardPayments(pd).filter((x) => x.status === 'Voided');
          expect(sale).toHaveLength(1);
          expect(voided).toHaveLength(1);
          expect(voided[0]?.auth).toBe(sale[0]?.auth);
          expect(d).toMatch(new RegExp(`Cancel information \\| #${id}-1`));
          const cashSum = [...pd.matchAll(/Got: \$([\d,.]+)/g)].reduce(
            (a, mm) => a + Number((mm[1] ?? '0').replace(/,/g, '')),
            0,
          );
          expect(Number(field(d, 'Total').replace(/[$,]/g, ''))).toBeCloseTo(cashSum, 2);
        },
      );
    },
  );

  it(
    title(
      'SPL-C4 Price per check method: check 1 Cash / Other / Gift Card shows the Cash price (no Service Fee), check 2 Card keeps the Card price; customer display follows the selected check (SPLIT-068)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(4 * 60_000);
      const id = await app.createOrder();
      await S.openSplit();
      const [a1, a2] = await S.checkAmounts(id);
      const c1 = a1 ?? Number.NaN;
      const c2 = a2 ?? Number.NaN;
      await S.selectCheck(id, 2);
      await P.clickQ(S.methodButton('Card'));
      const card2 = await payAmount();
      expect(card2).toBeCloseTo(c2, 2);
      await S.selectCheck(id, 1);
      const cashLike: Record<string, number> = {};
      for (const m of ['Cash', 'Other', 'Gift Card'] as const) {
        await P.clickQ(S.methodButton(m));
        await settle(300);
        cashLike[m] = await payAmount();
      }
      note(
        `Check 1 Card ${String(c1)} → Cash ${String(cashLike.Cash)} / Other ${String(cashLike.Other)} / Gift Card ${String(cashLike['Gift Card'])}; check 2 Card ${String(card2)}`,
      );
      expect(cashLike.Cash).toBeLessThan(c1);
      expect(cashLike.Other).toBeCloseTo(cashLike.Cash ?? Number.NaN, 2);
      expect(cashLike['Gift Card']).toBeCloseTo(cashLike.Cash ?? Number.NaN, 2);
      await P.clickQ(S.methodButton('Card'));
      await settle(300);
      expect(await payAmount()).toBeCloseTo(c1, 2);
      expect(await customerTileLit('Card')).toBe(true);
      await P.clickQ(S.methodButton('Cash'));
      expect(await customerTileLit('Cash')).toBe(true);
    },
  );

  it(
    title(
      'SPL-C5 Signature Before + Card check with cashier tip $2: customer shows "Tip Amount: $2.00", Custom Tip opens on $2.00 (not $0) (SPLIT-075, CD-054)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(6 * 60_000);
      await requireTerminal(this);
      await withSignature({ required: true, timing: 'before' }, true, async () => {
        const id = await app.createOrder();
        await S.openSplit();
        await S.selectCheck(id, 1);
        await P.clickQ(S.methodButton('Card'));
        await S.cashierTip('200');
        await P.clickQ(S.payButton);
        await app.passcodeIfAsked(3_000);
        expect(await cust.waitFor(VqpsCustomer.addTip, 15_000)).toBe(true);
        expect(await cust.has({ textRe: 'Tip Amount: \\$2\\.00', nth: 0 })).toBe(true);
        await cust.click(btn('Custom Tip', 0));
        expect(await cust.waitFor({ textRe: '^Custom tip on \\$', nth: 0 }, 10_000)).toBe(true);
        const txt = await cust.text();
        const at = txt.indexOf('Custom tip on');
        // Keypad part: "Custom tip on $<base> | <entered> | 1 | 2 | …" → the entered amount must be $2.00.
        const keypad = txt.slice(at).replace(/^Custom tip on \$[\d,.]+/, '');
        note(`Custom Tip: ${txt.slice(at, at + 160)}`);
        expect(/\$[\d,.]+/.exec(keypad)?.[0]).toBe('$2.00');
        // No charge: close the keypad, cancel the wait on main.
        await cust.click(btn('Done', -1)).catch(() => undefined);
        await P.clickQ([waitingDialog, btn('Cancel')]);
        await P.waitGoneQ(waitingDialog, 10_000);
      });
    },
  );

  it(
    title(
      'SPL-C6 Signature After NOT required: after a Card check, "Payment Successful! Customer is adding signature." has Skip → Skip goes on (SPLIT-077)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      await requireTerminal(this);
      await withSignature({ required: false, timing: 'after' }, null, async () => {
        const id = await app.createOrder();
        await S.openSplit();
        try {
          await S.selectCheck(id, 1);
          await P.clickQ(S.methodButton('Card'));
          await P.clickQ(S.payButton);
          await watchCard(
            async () => (await visible(signatureWaitDialog)) || (await visible(S.paidDialog(1))),
            {
              timeoutMs: 150_000,
              sign: false,
              reset: true,
            },
          );
          await P.waitFor(signatureWaitDialog, 10_000, 'waiting for the customer signature');
          expect(await flat(signatureWaitDialog)).toMatch(/Please wait\.\.\./);
          await P.clickQ([signatureWaitDialog, btn('Skip')]);
          await P.waitGoneQ(signatureWaitDialog, 10_000);
          await P.waitFor(S.paidDialog(1), 20_000, 'Check 1 Paid Successfully');
          await S.closePaidDialog(1);
          await S.payCheck(id, 2, 'Cash');
          await S.completeDone();
          await app.noReceipt();
          app.createdOrders.delete(id);
        } finally {
          await S.settleSplit(id);
        }
      });
    },
  );

  it(
    title(
      'SPL-C3 Network loss on the Split screen: Other / Card / Gift Card → "Oops... Disconnected" blocks; Pay with cash works; back online pays the rest',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    function () {
      console.warn(
        'SPL-C3 needs the volt-qc network proxy (src/flows/net.ts: navigator.onLine + payment-tunnel cut) — not available in this suite',
      );
      this.skip();
    },
  );
});
