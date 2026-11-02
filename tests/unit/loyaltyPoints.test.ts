/**
 * The Checkout Type award model (VP-4591), checked without the app.
 *
 * `src/domain/loyaltyPoints.ts` is the oracle every checkout-type spec compares
 * the customer's balance against, so a slip here would make the suite agree
 * with a wrong award. These pin the rules from docs/specs/checkout-type-setting.md.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHECKOUT_TYPE,
  expectedAward,
  type ExpectedAward,
  parsePointPaymentSetting,
  type PointOrderItem,
  type PointTender,
} from '../../src/domain/index.js';

const METHODS = {
  cash: { enabled: true, point: 100 },
  card: { enabled: true, point: 100 },
  gift_card: { enabled: false, point: 100 },
  other: { enabled: true, point: 100 },
};

const config = (extra: Record<string, unknown> = {}): string => JSON.stringify({ ...METHODS, ...extra });

const sale = (paymentType: string, amount: number, tip = 0): PointTender => ({
  id: `${paymentType}-${String(amount)}`,
  paymentType,
  transactionType: 'sale',
  amount,
  tip,
});

const SERVICE: PointOrderItem[] = [{ giftCardId: null, finalPrice: 4_000, servicePrice: 4_000 }];

describe('parsePointPaymentSetting', () => {
  it('a setting with only the 4 method keys reads as Manual, bonus 0 (CHK-POS-001)', () => {
    const s = parsePointPaymentSetting(config());
    assert.equal(s.checkoutType, CHECKOUT_TYPE.MANUAL);
    assert.equal(s.pointBonus, 0);
    assert.equal(s.checkoutTypeDefaulted, true);
    assert.equal(s.pointBonusDefaulted, true);
  });

  it('an unknown selected_type falls back to Manual (CHK-POS-002)', () => {
    const s = parsePointPaymentSetting(config({ selected_type: 'abc', point_bonus: 10 }));
    assert.equal(s.checkoutType, CHECKOUT_TYPE.MANUAL);
    assert.equal(s.checkoutTypeDefaulted, true);
    assert.equal(s.pointBonus, 10);
  });

  it('a negative or fractional point_bonus falls back to 0', () => {
    assert.equal(parsePointPaymentSetting(config({ point_bonus: -5 })).pointBonus, 0);
    assert.equal(parsePointPaymentSetting(config({ point_bonus: 2.5 })).pointBonus, 0);
  });

  it('a missing or broken row parses to defaults rather than throwing', () => {
    assert.equal(parsePointPaymentSetting(null).checkoutType, CHECKOUT_TYPE.MANUAL);
    assert.equal(parsePointPaymentSetting('{not json').methods.cash.point, 100);
  });
});

describe('expectedAward', () => {
  const manual = parsePointPaymentSetting(config({ selected_type: 'payment_method', point_bonus: 10 }));
  const auto = parsePointPaymentSetting(config({ selected_type: 'auto_checkout', point_bonus: 10 }));
  const hybrid = parsePointPaymentSetting(config({ selected_type: 'hybrid_checkout', point_bonus: 10 }));

  const award = (
    setting: typeof manual,
    transactions: PointTender[],
    items = SERVICE,
    tipTotal = 0,
  ): ExpectedAward =>
    expectedAward({
      setting,
      transactions,
      items,
      orderTotal: transactions.reduce((s, t) => s + (t.amount ?? 0) + (t.tip ?? 0), 0),
      tipTotal,
    });

  it('Manual: $40 card earns 40, never the bonus (CHK-POS-006 / 010)', () => {
    assert.deepEqual(award(manual, [sale('card', 4_000)]), { points: 40, showEarned: true });
  });

  it('Manual split: the "No points" gift-card part earns 0 (CHK-POS-008)', () => {
    assert.equal(award(manual, [sale('cash', 3_000), sale('gift_card', 2_000)]).points, 30);
  });

  it('Manual rounds each method down', () => {
    assert.equal(award(manual, [sale('cash', 4_099)]).points, 40);
  });

  it('Auto: the bonus regardless of amount, once for a split (CHK-POS-012 / 013 / 016)', () => {
    assert.equal(award(auto, [sale('cash', 15_000)]).points, 10);
    assert.equal(award(auto, [sale('cash', 3_000), sale('card', 3_000)]).points, 10);
  });

  it('Auto: paying with a gift card still earns (CHK-POS-015)', () => {
    assert.equal(award(auto, [sale('gift_card', 5_000)]).points, 10);
  });

  it('Auto: a $0 order with only a tip earns nothing and hides the block (CHK-POS-018)', () => {
    assert.deepEqual(award(auto, [sale('cash', 0, 500)], SERVICE, 500), { points: 0, showEarned: false });
  });

  it('Auto: a gift-card-only sale earns nothing; service + gift card earns (CHK-POS-019 / 020)', () => {
    const gc = { giftCardId: 'gc-1', finalPrice: 10_000, servicePrice: 10_000 };
    assert.equal(award(auto, [sale('card', 10_000)], [gc]).points, 0);
    assert.equal(award(auto, [sale('card', 15_000)], [...SERVICE, gc]).points, 10);
  });

  it('Hybrid: Point Config only, no bonus; "No points" gift card earns 0 (CHK-POS-022 / 023)', () => {
    assert.equal(award(hybrid, [sale('card', 4_000)]).points, 40);
    assert.equal(award(hybrid, [sale('gift_card', 5_000)]).points, 0);
  });

  it('Manual excludes the gift-card sale amount from the eligible total', () => {
    const gc = { giftCardId: 'gc-1', finalPrice: 5_000, servicePrice: 5_000 };
    assert.equal(award(manual, [sale('card', 9_000)], [...SERVICE, gc]).points, 40);
  });

  it('a voided or cancelled tender earns nothing', () => {
    const t = sale('cash', 4_000);
    assert.equal(award(manual, [{ ...t, isCancelled: true }]).points, 0);
    assert.equal(
      award(manual, [
        t,
        { id: 'v', transactionType: 'void', referenceId: t.id, paymentType: 'cash', amount: 4_000 },
      ]).points,
      0,
    );
  });
});

/**
 * Portal "Earn points on tip" (`earn_on_tip`, VP-4812). Figures are the live
 * 2026-11-01 run on merchant #14 (1 point / $1): $63.00 cash and $64.89 card,
 * each with a $12.00 tip — docs/screens/earn-points-on-tip/earn-points-on-tip-test-cases.md.
 */
describe('earn_on_tip (VP-4812)', () => {
  const setting = (earnOnTip?: unknown): ReturnType<typeof parsePointPaymentSetting> =>
    parsePointPaymentSetting(
      config({
        selected_type: 'payment_method',
        point_bonus: 10,
        ...(earnOnTip === undefined ? {} : { earn_on_tip: earnOnTip }),
      }),
    );
  const award = (s: ReturnType<typeof setting>, transactions: PointTender[]): number =>
    expectedAward({
      setting: s,
      transactions,
      items: SERVICE,
      orderTotal: transactions.reduce((sum, t) => sum + (t.amount ?? 0) + (t.tip ?? 0), 0),
      tipTotal: transactions.reduce((sum, t) => sum + (t.tip ?? 0), 0),
    }).points;

  it('a row without the key keeps the old behaviour: tips earn', () => {
    const s = setting();
    assert.equal(s.earnOnTip, true);
    assert.equal(s.earnOnTipDefaulted, true);
    assert.equal(award(s, [sale('cash', 6_300, 1_200)]), 75);
  });

  it('a non-boolean value is treated as missing', () => {
    const s = setting('false');
    assert.equal(s.earnOnTip, true);
    assert.equal(s.earnOnTipDefaulted, true);
  });

  it('on: cash and card earn on amount + tip (EPT-02 / EPT-03)', () => {
    const s = setting(true);
    assert.equal(s.earnOnTipDefaulted, false);
    assert.equal(award(s, [sale('cash', 6_300, 1_200)]), 75);
    assert.equal(award(s, [sale('card', 6_489, 1_200)]), 76);
  });

  it('off: cash and card earn on the amount alone (EPT-04 / EPT-05)', () => {
    const s = setting(false);
    assert.equal(s.earnOnTip, false);
    assert.equal(award(s, [sale('cash', 6_300, 1_200)]), 63);
    assert.equal(award(s, [sale('card', 6_489, 1_200)]), 64);
  });

  it('off with no tip earns exactly what on does (EPT-06)', () => {
    assert.equal(award(setting(false), [sale('cash', 6_300)]), award(setting(true), [sale('cash', 6_300)]));
  });

  it('off: a split keeps each tender on its own amount', () => {
    assert.equal(award(setting(false), [sale('cash', 3_000, 500), sale('card', 3_000, 700)]), 60);
  });

  it('off: a tender that carries only a tip earns nothing', () => {
    assert.equal(award(setting(false), [sale('cash', 0, 500)]), 0);
  });

  it('Auto ignores the setting — the bonus is the award either way (EPT-08)', () => {
    const auto = (earnOnTip: boolean): ReturnType<typeof setting> =>
      parsePointPaymentSetting(
        config({ selected_type: 'auto_checkout', point_bonus: 10, earn_on_tip: earnOnTip }),
      );
    assert.equal(award(auto(true), [sale('cash', 6_300, 1_200)]), 10);
    assert.equal(award(auto(false), [sale('cash', 6_300, 1_200)]), 10);
  });
});
