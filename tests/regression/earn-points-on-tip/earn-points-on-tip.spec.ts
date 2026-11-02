/**
 * Earn points on tip — Portal setting `earn_on_tip` (VP-4812, volt-pos#3262).
 *
 * docs/screens/earn-points-on-tip/earn-points-on-tip-test-cases.md (EPT-01..08)
 *
 * ## How to run it
 *
 * The cases do NOT change the setting — they read it and skip when their
 * precondition does not hold, the same contract as the Checkout Type suite
 * (tests/regression/checkout-type/checkout-type.helpers.ts). Two passes, with
 * the app left running in between (that is EPT-07):
 *
 *   1. Portal → Setting point config → Tip → "Earn points on tip" ON, run
 *   2. Portal → OFF, run again
 *
 *     npm run test:earn-points-on-tip
 *
 * Orders are Quick Checkout orders for `LOYALTY_CUSTOMER_PHONE` (card cases:
 * `EPT_CARD_CUSTOMER_PHONE`, falling back to the same phone). The customer
 * picks the tip on the customer display, so this is a LAUNCH-lane spec. Card
 * cases need `CARD_SETTLE=1` and a terminal.
 *
 * ## What is asserted
 *
 * Every completion: the customer's balance delta (GoCheckin) and the order's
 * `pointBonus` stamp both equal the award recomputed from the live setting and
 * the order's real tenders (src/domain/loyaltyPoints.ts). The tipped cases also
 * pin the one thing VP-4812 changes: the award equals Point Config applied to
 * amount + tip (ON) or to the amount alone (OFF), and the two differ.
 *
 * CREATES DATA and grows a real customer's points. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { CHECKOUT_TYPE, methodEarns, pointsFromConfig } from '../../../src/domain/index.js';
import type { LivePointSetting } from '../../../src/api/index.js';
import type { TipChoice } from '../../../src/pages/pos/CustomerDisplayPage.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  completeAndMeasure,
  liveSetting,
  loyaltyPhone,
  requireTender,
  skipUnless,
  type PointsRun,
  type PointsTender,
} from '../checkout-type/checkout-type.helpers.js';

interface CaseSpec {
  tender: PointsTender;
  tip: TipChoice;
  /** Precondition on the live setting; false → skip with `reason`. */
  when: (setting: LivePointSetting) => boolean;
  reason: string;
}

const describeSetting = (s: LivePointSetting): string =>
  `earn on tip ${s.earnOnTip ? 'ON' : 'OFF'}${s.earnOnTipDefaulted ? ' (key missing)' : ''}, ` +
  `checkout type ${s.checkoutType}`;

/** The phone to measure on: card cases may use their own customer so the two balances stay apart. */
function customerFor(ctx: Mocha.Context, tender: PointsTender): string {
  const phone = loyaltyPhone(ctx);
  const card = (process.env.EPT_CARD_CUSTOMER_PHONE ?? '').replace(/\D/g, '');
  return tender === 'card' && card !== '' ? card : phone;
}

/** Gate, complete, and assert the invariant every case shares: delta == stamp == recomputed award. */
async function runCase(
  ctx: Mocha.Context,
  spec: CaseSpec,
): Promise<{ run: PointsRun; setting: LivePointSetting }> {
  const phone = customerFor(ctx, spec.tender);
  requireTender(ctx, spec.tender);
  const setting = await liveSetting();
  skipUnless(ctx, spec.when(setting), `${spec.reason} (live: ${describeSetting(setting)})`);

  const run = await completeAndMeasure(phone, spec.tender, setting, {
    source: 'pos',
    // Quick Checkout: a fresh order even when another draft is open on the till.
    quickCheckout: true,
    customerTip: spec.tip,
  });
  expect(run.delta).toBe(run.expected.points);
  expect(run.order.pointBonus).toBe(run.expected.points);
  return { run, setting };
}

/** Point Config on the same tenders with the tip counted / left out — the two sides of the toggle. */
function bothSides(run: PointsRun, setting: LivePointSetting): { withTip: number; withoutTip: number } {
  const on = { ...setting, earnOnTip: true };
  const off = { ...setting, earnOnTip: false };
  return {
    withTip: pointsFromConfig(on, run.order.transactions, run.order.items),
    withoutTip: pointsFromConfig(off, run.order.transactions, run.order.items),
  };
}

const pointConfig = (s: LivePointSetting): boolean =>
  s.checkoutType === CHECKOUT_TYPE.MANUAL || s.checkoutType === CHECKOUT_TYPE.HYBRID;

const earnOn = (s: LivePointSetting): boolean => pointConfig(s) && s.earnOnTip;
const earnOff = (s: LivePointSetting): boolean => pointConfig(s) && !s.earnOnTip;

/** A tipped run: the tip really landed, and the award sits on the side of the toggle that is live. */
function expectTipSide(run: PointsRun, setting: LivePointSetting): void {
  expect(run.order.tipAmount ?? 0).toBeGreaterThan(0);
  const { withTip, withoutTip } = bothSides(run, setting);
  expect(withTip).toBeGreaterThan(withoutTip);
  expect(run.delta).toBe(setting.earnOnTip ? withTip : withoutTip);
}

describe('Earn points on tip (VP-4812)', () => {
  before(() => {
    assertWritesAllowed('complete orders for a loyalty customer');
  });

  describe('1. Portal', () => {
    it(title('EPT-01: Portal toggle saves and survives a reload — PENDING (Portal UI, manual)'));

    it(title('EPT-01b: the saved setting reaches POS as earn_on_tip', Tag.REGRESSION), async function () {
      const setting = await liveSetting();
      skipUnless(this, setting.raw !== null, 'merchant has no merchant_point_payment_config row');
      expect(setting.earnOnTipDefaulted).toBe(false);
      expect(setting.raw).toMatch(/"earn_on_tip"\s*:\s*(true|false)/);
    });
  });

  describe('2. ON — tip counts', () => {
    it(
      title('EPT-02: ON + Cash with a 20% tip earns on amount + tip', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
      async function () {
        const { run, setting } = await runCase(this, {
          tender: 'cash',
          tip: 20,
          when: earnOn,
          reason: 'needs "Earn points on tip" ON under Manual / Hybrid',
        });
        expectTipSide(run, setting);
      },
    );

    it(
      title('EPT-03: ON + Card with a 20% tip earns on amount + tip', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
      async function () {
        const { run, setting } = await runCase(this, {
          tender: 'card',
          tip: 20,
          when: earnOn,
          reason: 'needs "Earn points on tip" ON under Manual / Hybrid',
        });
        expectTipSide(run, setting);
      },
    );
  });

  describe('3. OFF — tip left out', () => {
    it(
      title(
        'EPT-04: OFF + Cash with a 20% tip earns on the amount alone',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tender: 'cash',
          tip: 20,
          when: earnOff,
          reason: 'needs "Earn points on tip" OFF under Manual / Hybrid',
        });
        expectTipSide(run, setting);
      },
    );

    it(
      title(
        'EPT-05: OFF + Card with a 20% tip earns on the amount alone',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tender: 'card',
          tip: 20,
          when: earnOff,
          reason: 'needs "Earn points on tip" OFF under Manual / Hybrid',
        });
        expectTipSide(run, setting);
      },
    );

    it(
      title('EPT-06: no tip earns the same whatever the toggle', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
      async function () {
        const { run, setting } = await runCase(this, {
          tender: 'cash',
          tip: 'none',
          when: pointConfig,
          reason: 'needs Checkout Type = Manual / Hybrid',
        });
        expect(run.order.tipAmount ?? 0).toBe(0);
        const { withTip, withoutTip } = bothSides(run, setting);
        expect(withTip).toBe(withoutTip);
      },
    );
  });

  describe('3b. Other and gift card tenders', () => {
    it(
      title(
        'EPT-09: ON + Other with a 20% tip earns on amount + tip',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tender: 'other',
          tip: 20,
          when: (s) => earnOn(s) && methodEarns(s, 'other'),
          reason: 'needs "Earn points on tip" ON and Other earning under Manual / Hybrid',
        });
        expectTipSide(run, setting);
      },
    );

    it(
      title(
        'EPT-10: OFF + Other with a 20% tip earns on the amount alone',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tender: 'other',
          tip: 20,
          when: (s) => earnOff(s) && methodEarns(s, 'other'),
          reason: 'needs "Earn points on tip" OFF and Other earning under Manual / Hybrid',
        });
        expectTipSide(run, setting);
      },
    );

    it(
      title(
        'EPT-11: Gift card with a 20% tip follows Point Config and the toggle (No points → 0)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tender: 'gift-card',
          tip: 20,
          when: pointConfig,
          reason: 'needs Checkout Type = Manual / Hybrid',
        });
        if (methodEarns(setting, 'gift_card')) {
          expectTipSide(run, setting);
        } else {
          // "No points" on the Portal: the tip must not sneak an award in either way.
          expect(run.order.tipAmount ?? 0).toBeGreaterThan(0);
          expect(run.delta).toBe(0);
        }
      },
    );
  });

  describe('4. Changing the setting while POS runs', () => {
    it(
      title(
        'EPT-07: toggling on the Portal applies to the next order without a restart — PENDING ' +
          '(needs a Portal change mid-test; covered by running the ON and OFF passes on one app session)',
      ),
    );
  });

  describe('5. Unaffected', () => {
    it(
      title(
        'EPT-08: Auto Checkout awards the bonus whatever the toggle',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tender: 'cash',
          tip: 20,
          when: (s) => s.checkoutType === CHECKOUT_TYPE.AUTO,
          reason: 'needs Checkout Type = Auto',
        });
        expect(run.delta).toBe(setting.pointBonus);
      },
    );
  });
});
