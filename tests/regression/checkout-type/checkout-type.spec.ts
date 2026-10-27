/**
 * Checkout Type Setting — loyalty points on completion (VP-4591, volt-pos#3031).
 *
 * docs/screens/checkout-type/checkout-type-test-cases.md (CHK-POS-001..038)
 * docs/specs/checkout-type-setting.md
 *
 * ## How to run it
 *
 * The cases do NOT change the setting — they read it and skip when their
 * precondition does not hold (see checkout-type.helpers.ts). One pass per type:
 *
 *   1. Portal → Checkout Type = Manual, run both halves
 *   2. Portal → Auto (Point Bonus 10), run both halves
 *   3. Portal → Hybrid, run both halves
 *
 *     npm run test:checkout-type-gci
 *
 * Orders come from GoCheckin kiosk check-ins, not Quick Checkout: the web half
 * (`npm run web:checkout-type-checkin`, `tests/web/checkout-type-checkins.spec.ts`)
 * checks in one fresh customer per case on gap.gocheckin.net → GoCheckin and
 * writes `.tmp/checkout-type-checkins.json`; this file (`npm run
 * test:checkout-type`) opens each customer's checked-in pending order and
 * completes it. `CHECKOUT_TYPE_CASES=CHK-POS-007,...` limits the web half to the
 * cases the current Portal type runs. No check-in for a case → it skips.
 *
 * CHK-POS-033 is the one exception: it tests an order created on POS, so it
 * uses Quick Checkout and needs `LOYALTY_CUSTOMER_PHONE`. Card cases also need
 * `CARD_SETTLE=1 SPEC_RETRIES=0` and a terminal; gift-card cases a funded
 * `GIFT_CARD_CODE`. Unmet → the case skips, never passes.
 *
 * ## What is asserted
 *
 * For every completion: the customer's balance delta (GoCheckin) and the
 * order's `pointBonus` stamp both equal the award recomputed from the live
 * setting and the order's real tenders (src/domain/loyaltyPoints.ts); for a
 * kiosk order, the check-in it completed is the one it carried while pending. Cases
 * whose expectation is type-specific (Auto ignores the amount, a "No points"
 * method earns nothing) assert that figure directly as well.
 *
 * ## PENDING
 *
 * Cases needing a Portal change mid-test, the API end-of-day job, re-open,
 * refund of a settled order, selling a gift card, split tenders, network
 * control, an old build, or the Android app — reasons in the doc's §9
 * automation map. The $0 cases (011/017/018) redeem `FULL_REDEEM_REWARD`.
 *
 * CREATES DATA and grows a real customer's points. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { CHECKOUT_TYPE, methodEarns, type CheckoutType } from '../../../src/domain/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  completeAndMeasure,
  FULL_REDEEM_REWARD,
  gciCustomer,
  liveSetting,
  loyaltyPhone,
  requireTender,
  skipUnless,
  type OrderSource,
  type PointsRun,
  type PointsTender,
} from './checkout-type.helpers.js';
import type { LivePointSetting } from '../../../src/api/index.js';

const TYPE_NAME: Record<CheckoutType, string> = {
  [CHECKOUT_TYPE.MANUAL]: 'Manual',
  [CHECKOUT_TYPE.AUTO]: 'Auto',
  [CHECKOUT_TYPE.HYBRID]: 'Hybrid',
};

interface CaseSpec {
  /** The doc's case id — keys the kiosk check-in the web half made for it. */
  tc: string;
  tender: PointsTender;
  /** Precondition on the live setting; false → skip with `reason`. */
  when: (setting: LivePointSetting) => boolean;
  reason: string;
  /** Default `gci` (kiosk check-in order). Only CHK-POS-033 uses `pos`. */
  source?: OrderSource;
  /** Redeem this reward before Pay — the $0 cases. */
  reward?: string;
  /** Cashier tip in cents, added on checkout before paying. */
  tipCents?: number;
}

/**
 * Gate, complete, and assert the invariant every case shares:
 * balance delta == order stamp == recomputed award, and — for a kiosk order —
 * the check-in it completed is the one it already carried while pending.
 */
async function runCase(
  ctx: Mocha.Context,
  spec: CaseSpec,
): Promise<{ run: PointsRun; setting: LivePointSetting }> {
  const source = spec.source ?? 'gci';
  const phone = source === 'gci' ? gciCustomer(ctx, spec.tc) : loyaltyPhone(ctx);
  requireTender(ctx, spec.tender);
  const setting = await liveSetting();
  skipUnless(
    ctx,
    spec.when(setting),
    `${spec.reason} (live: ${TYPE_NAME[setting.checkoutType]}, bonus ${String(setting.pointBonus)})`,
  );

  const run = await completeAndMeasure(phone, spec.tender, setting, {
    source,
    reward: spec.reward,
    tipCents: spec.tipCents,
  });
  expect(run.delta).toBe(run.expected.points);
  expect(run.order.pointBonus).toBe(run.expected.points);
  if (source === 'gci') {
    expect(run.checkinBeforePay).not.toBeNull();
    expect(run.order.customerCheckinId).toBe(run.checkinBeforePay?.customerCheckinId);
  }
  return { run, setting };
}

const is =
  (type: CheckoutType) =>
  (setting: LivePointSetting): boolean =>
    setting.checkoutType === type;

describe('Checkout Type — points on completion (VP-4591)', () => {
  before(() => {
    assertWritesAllowed('complete orders for a loyalty customer');
  });

  describe('1. Reading the setting', () => {
    it(
      title(
        'CHK-POS-001: no selected_type / point_bonus keys → runs as Manual',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tc: 'CHK-POS-001',
          tender: 'cash',
          when: (s) => s.raw !== null && s.checkoutTypeDefaulted && s.pointBonusDefaulted,
          reason: 'needs a setting that carries only the 4 payment-method keys',
        });
        expect(setting.checkoutType).toBe(CHECKOUT_TYPE.MANUAL);
        expect(run.expected.showEarned).toBe(true);
      },
    );

    it(
      title(
        'CHK-POS-002: unknown selected_type → Manual, bonus not added',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tc: 'CHK-POS-002',
          tender: 'cash',
          when: (s) => s.raw !== null && s.checkoutTypeDefaulted && /"selected_type"\s*:/.test(s.raw),
          reason: 'needs selected_type set to a value that is not one of the three (e.g. "abc")',
        });
        expect(setting.checkoutType).toBe(CHECKOUT_TYPE.MANUAL);
        // Whatever point_bonus is stored, a Manual completion never adds it.
        expect(run.delta).toBe(run.expected.points);
      },
    );

    it(
      title('CHK-POS-003: Portal change applies without restart — PENDING (needs a Portal change mid-test)'),
    );
    it(title('CHK-POS-004: setting is read at complete time — PENDING (needs a Portal change mid-test)'));
    it(
      title(
        'CHK-POS-005: new Point Bonus applies to the next order — PENDING (needs a Portal change mid-test)',
      ),
    );
  });

  describe('2. Manual', () => {
    it(
      title('CHK-POS-006: Manual + Card earns by Point Config', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
      async function () {
        await runCase(this, {
          tc: 'CHK-POS-006',
          tender: 'card',
          when: is(CHECKOUT_TYPE.MANUAL),
          reason: 'needs Checkout Type = Manual',
        });
      },
    );

    it(
      title(
        'CHK-POS-007: Manual + Cash earns by Point Config on what was paid',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tc: 'CHK-POS-007',
          tender: 'cash',
          when: is(CHECKOUT_TYPE.MANUAL),
          reason: 'needs Checkout Type = Manual',
        });
        if (methodEarns(setting, 'cash')) {
          const paid = run.order.transactions
            .filter((t) => t.transactionType === 'sale' && t.isCancelled !== true)
            .reduce((sum, t) => sum + (t.amount ?? 0) + (t.tip ?? 0), 0);
          expect(run.delta).toBe(Math.floor(paid / setting.methods.cash.point));
        }
      },
    );

    it(
      title(
        'CHK-POS-008: Manual split, gift-card part earns 0 — PENDING (no cash + gift-card split-tender flow)',
      ),
    );

    it(
      title(
        'CHK-POS-009: Manual + "No points" method → 0, no bonus top-up',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run } = await runCase(this, {
          tc: 'CHK-POS-009',
          tender: 'card',
          when: (s) => is(CHECKOUT_TYPE.MANUAL)(s) && !methodEarns(s, 'card'),
          reason: 'needs Manual with Card = No points',
        });
        expect(run.delta).toBe(0);
      },
    );

    it(
      title('CHK-POS-010: Manual never adds the stored Point Bonus', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
      async function () {
        const { run, setting } = await runCase(this, {
          tc: 'CHK-POS-010',
          tender: 'cash',
          when: (s) => is(CHECKOUT_TYPE.MANUAL)(s) && s.pointBonus > 0,
          reason: 'needs Manual with a non-zero Point Bonus still stored',
        });
        expect(run.delta).not.toBe(run.expected.points + setting.pointBonus);
      },
    );

    it(
      title(
        'CHK-POS-011: Manual $0 order (full redeem) earns nothing',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run } = await runCase(this, {
          tc: 'CHK-POS-011',
          tender: 'cash',
          when: is(CHECKOUT_TYPE.MANUAL),
          reason: 'needs Checkout Type = Manual',
          reward: FULL_REDEEM_REWARD,
        });
        expect(run.order.total).toBe(0);
        expect(run.delta).toBe(0);
      },
    );
  });

  describe('3. Auto', () => {
    it(
      title('CHK-POS-012: Auto earns exactly the Point Bonus', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
      async function () {
        const { run, setting } = await runCase(this, {
          tc: 'CHK-POS-012',
          tender: 'cash',
          when: is(CHECKOUT_TYPE.AUTO),
          reason: 'needs Checkout Type = Auto',
        });
        expect(run.delta).toBe(setting.pointBonus);
      },
    );

    it(
      title(
        'CHK-POS-013: Auto ignores the amount — Cash earns the Point Bonus',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tc: 'CHK-POS-013',
          tender: 'cash',
          when: is(CHECKOUT_TYPE.AUTO),
          reason: 'needs Checkout Type = Auto',
        });
        expect(run.delta).toBe(setting.pointBonus);
      },
    );

    it(
      title(
        'CHK-POS-014: Auto ignores Point Config — "No points" Card still earns the bonus',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tc: 'CHK-POS-014',
          tender: 'card',
          when: (s) => is(CHECKOUT_TYPE.AUTO)(s) && !methodEarns(s, 'card'),
          reason: 'needs Auto with Card = No points',
        });
        expect(run.delta).toBe(setting.pointBonus);
      },
    );

    it(
      title(
        'CHK-POS-015: Auto, paid 100% by gift card, still earns the bonus',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tc: 'CHK-POS-015',
          tender: 'gift-card',
          when: is(CHECKOUT_TYPE.AUTO),
          reason: 'needs Checkout Type = Auto',
        });
        expect(run.delta).toBe(setting.pointBonus);
      },
    );

    it(
      title(
        'CHK-POS-016: Auto split payment adds the bonus once — PENDING (no cash + card split-tender flow)',
      ),
    );
    it(
      title(
        'CHK-POS-017: Auto $0 order (full redeem) earns no bonus',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run } = await runCase(this, {
          tc: 'CHK-POS-017',
          tender: 'cash',
          when: (s) => is(CHECKOUT_TYPE.AUTO)(s) && s.pointBonus > 0,
          reason: 'needs Auto with a non-zero Point Bonus (else 0 proves nothing)',
          reward: FULL_REDEEM_REWARD,
        });
        expect(run.order.total).toBe(0);
        expect(run.expected.showEarned).toBe(false);
        expect(run.delta).toBe(0);
      },
    );

    it(
      title('CHK-POS-018: Auto $0 order + tip earns no bonus', Tag.REGRESSION, Tag.WRITE, Tag.PAYMENT),
      async function () {
        // The cashier tip attaches to the Card tender only; paying Cash $0 is the
        // flow the 27/10 retest took (OD261027-00003433 → VP-5151).
        const { run } = await runCase(this, {
          tc: 'CHK-POS-018',
          tender: 'cash',
          when: (s) => is(CHECKOUT_TYPE.AUTO)(s) && s.pointBonus > 0,
          reason: 'needs Auto with a non-zero Point Bonus (else 0 proves nothing)',
          reward: FULL_REDEEM_REWARD,
          tipCents: 500,
        });
        expect(run.order.total - (run.order.tipAmount ?? 0)).toBe(0);
        expect(run.expected.showEarned).toBe(false);
        expect(run.delta).toBe(0);
      },
    );
    it(title('CHK-POS-019: Auto gift-card-only sale earns no bonus — PENDING (no sell-gift-card flow)'));
    it(
      title('CHK-POS-020: Auto service + gift-card sale earns the bonus — PENDING (no sell-gift-card flow)'),
    );

    it(
      title(
        'CHK-POS-021: Auto with Point Bonus = 0 earns 0 without error',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run } = await runCase(this, {
          tc: 'CHK-POS-021',
          tender: 'cash',
          when: (s) => is(CHECKOUT_TYPE.AUTO)(s) && s.pointBonus === 0,
          reason: 'needs Auto with Point Bonus = 0',
        });
        expect(run.delta).toBe(0);
      },
    );
  });

  describe('4. Hybrid', () => {
    it(
      title(
        'CHK-POS-022: Hybrid same-day completion earns by Point Config, no bonus',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tc: 'CHK-POS-022',
          tender: 'cash',
          when: is(CHECKOUT_TYPE.HYBRID),
          reason: 'needs Checkout Type = Hybrid',
        });
        if (setting.pointBonus > 0) expect(run.delta).not.toBe(run.expected.points + setting.pointBonus);
      },
    );

    it(
      title(
        'CHK-POS-023: Hybrid + "No points" gift card → 0, no bonus top-up',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const { run } = await runCase(this, {
          tc: 'CHK-POS-023',
          tender: 'gift-card',
          when: (s) => is(CHECKOUT_TYPE.HYBRID)(s) && !methodEarns(s, 'gift_card'),
          reason: 'needs Hybrid with Gift card = No points',
        });
        expect(run.delta).toBe(0);
      },
    );

    it(title('CHK-POS-024: Hybrid end-of-day auto-checkout adds the bonus — PENDING (API job, not POS)'));
    it(
      title(
        'CHK-POS-025: completing after the auto-checkout adds nothing, no error — PENDING (depends on 024)',
      ),
    );
    it(title('CHK-POS-026: restored end-of-day order adds nothing — PENDING (depends on 024)'));
  });

  describe('5. One checkout per check-in / Refund / Cancel', () => {
    it(title('CHK-POS-027: Manual Edit Order + re-complete adds nothing — PENDING (re-open is mutating)'));
    it(title('CHK-POS-028: Auto Edit Order + re-complete adds no 2nd bonus — PENDING (re-open is mutating)'));
    it(title('CHK-POS-029: Hybrid Edit Order + re-complete adds nothing — PENDING (re-open is mutating)'));
    it(
      title(
        'CHK-POS-030: re-open to another customer, nobody earns — PENDING (re-open + 2nd customer fixture)',
      ),
    );
    it(title('CHK-POS-031: Refund after checkout keeps the points — PENDING (needs a settled order)'));
    it(title('CHK-POS-032: Cancel/Void after checkout keeps the points — PENDING (needs a settled order)'));

    it(
      title(
        'CHK-POS-033: an order created on POS (no prior check-in) checks out by type',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        const { run, setting } = await runCase(this, {
          tc: 'CHK-POS-033',
          tender: 'cash',
          source: 'pos',
          when: is(CHECKOUT_TYPE.AUTO),
          reason: 'needs Checkout Type = Auto',
        });
        expect(run.order.customerCheckinId).toBeTruthy();
        expect(run.delta).toBe(setting.pointBonus);
      },
    );
  });

  describe('6. Merge / Offline / Compatibility', () => {
    it(title('CHK-POS-034: merge of checked-in orders keeps the merge flow — PENDING (needs 2 check-ins)'));
    it(
      title(
        'CHK-POS-035: Auto completed offline earns the bonus once after sync — PENDING (no network harness)',
      ),
    );
    it(title('CHK-POS-036: Manual completed offline earns once after sync — PENDING (no network harness)'));
    it(title('CHK-POS-037: a pre-#3031 build reads Auto as Manual — PENDING (needs the old build)'));
    it(title('CHK-POS-038: Windows and Android give the same result — PENDING (Android P8D is manual)'));
  });
});
