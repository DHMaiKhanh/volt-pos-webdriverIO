/**
 * volt-qc card terminal — the per-ticket card rows that only needed a terminal:
 * a split Card + Cash order, a double press on Complete Payment, and voiding a
 * card order right after the charge.
 *
 * TC catalogue: docs/qc/volt-qc/vp-tickets/card-charge-payment-success-fail-test-cases.md
 * (rows are named `<ticket> <row>` so the coverage script matches them) and
 * docs/qc/volt-qc/windows-regression/07-order-history.md for the cancel/void row.
 *
 * Keep other row labels of that ticket OUT of this file: the coverage script
 * marks a row covered when the ticket key and the bare row label both appear here.
 *
 * Gating and the operator tap: see ./card-terminal.helpers.ts. One real charge per
 * case (3 taps).
 *
 *     CARD_SETTLE=1 SPEC_RETRIES=0 npm run test:spec -- ./tests/regression/volt-qc/card-terminal/card-vp-tickets.spec.ts
 *
 * CREATES DATA, TAKES CARD PAYMENTS AND VOIDS ONE AT THE GATEWAY. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  buildCart,
  cancelOrder,
  countPayments,
  detailText,
  field,
  freshDetail,
  openByCode,
} from '../../../../src/pages/voltqc/oh-reopen/ohReopen.js';
import { P, noReceipt, waitSuccess } from '../../../../src/pages/voltqc/pay/payProbe.js';
import {
  payAmount,
  payDisabled,
  watchCard,
} from '../../../../src/pages/voltqc/promo-split/splitDeepExtra.js';
import * as S from '../../../../src/pages/voltqc/promo-split/splitFlows.js';
import { app, visible } from '../../../../src/pages/voltqc/promo-split/vqApp.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import {
  CARD_WAIT_MS,
  ONE_CHARGE_MS,
  cardsOf,
  chargeSelectedCard,
  cleanAfterCard,
  createCardOrder,
  detailWithCards,
  dollarsToCents,
  openCardCheckout,
  requireCardTerminal,
  successfulCardsOf,
} from './card-terminal.helpers.js';

const TICKET = 'card-charge-payment-success-fail-test-cases';

describe(`${TICKET} — card rows on a connected terminal`, function () {
  this.timeout(ONE_CHARGE_MS);

  before(() => assertWritesAllowed('take card payments (volt-qc card terminal)'));
  afterEach(cleanAfterCard);

  it(
    title(
      `${TICKET} A3 Split: check 1 by Card is approved for its own amount, check 2 in Cash; the order lists one card txn of that amount and one Cash txn`,
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(ONE_CHARGE_MS + 2 * 60_000);
      await requireCardTerminal(this);
      await buildCart([[0, 0]]);
      const code = await app.orderId();
      await S.openSplit();
      let charged = false;
      let cardDollars = Number.NaN;
      try {
        expect((await S.checkNumbers(code)).length).toBeGreaterThanOrEqual(2);
        await S.selectCheck(code, 1);
        await P.clickQ(S.methodButton('Card'));
        await settle(Timeouts.DEBOUNCE);
        if (await payDisabled()) {
          console.warn(
            '[card-terminal] skipped: Pay is disabled on the Card check — the terminal is not connected to the app',
          );
          this.skip();
        }
        cardDollars = await payAmount();
        expect(cardDollars).toBeGreaterThan(0);
        await P.clickQ(S.payButton);
        await watchCard(async () => visible(S.paidDialog(1)), { timeoutMs: CARD_WAIT_MS, reset: true });
        charged = true;
        await S.closePaidDialog(1);
        await S.payCheck(code, 2, 'Cash');
        await S.completeDone();
        await app.noReceipt();
      } finally {
        // A half-paid split is finished in Other so the till is left clean.
        if (charged) await S.settleSplit(code);
      }

      await openByCode(code);
      const d = await P.poll(
        () => detailText(code),
        (t) => successfulCardsOf(t).length === 1,
        60_000,
      );
      expect(field(d, 'Status')).toMatch(/^Successful/);
      expect(dollarsToCents(successfulCardsOf(d)[0]?.amount ?? 0)).toBe(dollarsToCents(cardDollars));
      expect(countPayments(d, 'Cash')).toBe(1);
    },
  );

  it(
    title(
      `${TICKET} B10 A double click on Complete Payment (Card) charges once: one Successful card txn for the order total`,
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await requireCardTerminal(this);
      const checkout = await openCardCheckout(this);
      const trace = await chargeSelectedCard({ double: true });
      expect(trace.main.join(' ⟶ ')).not.toMatch(/Possible Double Charge|already paid successfully/i);
      await waitSuccess(Timeouts.CARD_CHARGE);
      await noReceipt();

      const d = await detailWithCards(checkout.orderId, 1);
      // Give a stray second submit time to land before counting.
      await settle(5_000);
      const again = await freshDetail(checkout.orderId);
      const cards = cardsOf(again).filter((c) => c.status !== 'Voided');
      expect(cards).toHaveLength(1);
      expect(successfulCardsOf(d)).toHaveLength(1);
      if (!Number.isNaN(checkout.cardCents))
        expect(dollarsToCents(cards[0]?.amount ?? 0)).toBe(checkout.cardCents);
    },
  );

  it(
    title(
      `${TICKET} A7 Void right after a successful charge: Cancel Order on the unsettled card order → Canceled, the card txn Voided at the gateway, no money held (OH-120)`,
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.PAYMENT,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(ONE_CHARGE_MS + 3 * 60_000);
      await requireCardTerminal(this);
      const o = await createCardOrder(this);
      expect(successfulCardsOf(await detailText(o.code))).toHaveLength(1);

      await cancelOrder(0);
      await step('Canceling → Canceled (not Cancel Issue)', async () => {
        const status = await P.poll(
          async () => field(await detailText(o.code), 'Status'),
          (s) => /^(Canceled|Cancel Issue)$/.test(s),
          120_000,
        );
        expect(status).toBe('Canceled');
      });

      await step('The card txn is Voided', async () => {
        const d = await freshDetail(o.orderId, (t) => cardsOf(t).some((c) => c.status === 'Voided'), 90_000);
        expect(cardsOf(d).some((c) => c.status === 'Voided')).toBe(true);
      });
    },
  );
});
