/**
 * VP-4489 — "1 check-in = 1 point" turned into "$1 = 1 point" (ticket #1552811,
 * Pinky Nails and Spa) + sub-bug VP-5112 — customer display said "1 points".
 *
 * docs/qc/volt-qc/vp-tickets/VP-4489-checkin-point-display-test-cases.md (TC-VP4489-01..12)
 *
 * ## How to run it
 *
 * Like the Checkout Type suite, the cases do NOT change the Portal setting —
 * each reads `merchant_point_payment_config` live and skips when its
 * precondition does not hold. Pinky Nails' configuration is "Auto Checkout +
 * Point Bonus 1"; set the Portal (Store Settings → Payment & transactions →
 * Checkout setting / Point config) and run once per row of the doc's
 * "Điều kiện chung" table:
 *
 *   npm run test:attach -- --spec tests/regression/checkout-type/vp-4489-checkin-point-display.spec.ts
 *
 * Orders are Quick Checkout orders for `LOYALTY_CUSTOMER_PHONE`, paid in Cash
 * with no tip. TC-05 ($0 order) reuses the kiosk check-in the Checkout Type web
 * lane makes for CHK-POS-017 (`CHECKOUT_TYPE_CASES=CHK-POS-017 npm run
 * web:checkout-type-checkin`) and redeems `FULL_REDEEM_REWARD`.
 *
 * The display cases read the customer window (`withCustomerWindow`); a lane on
 * which that window is not a WebDriver handle fails them with a window inventory.
 *
 * CREATES DATA and grows a real customer's points. dev / staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import type { LivePointSetting } from '../../../src/api/index.js';
import { appNav } from '../../../src/components/index.js';
import { CHECKOUT_TYPE, methodEarns, POINT_METHODS } from '../../../src/domain/index.js';
import { returnToHome } from '../../../src/flows/index.js';
import { appShellProbe } from '../../../src/pages/voltqc/app-perm/AppShellProbe.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  FULL_REDEEM_REWARD,
  gciCustomer,
  liveSetting,
  loyalty,
  loyaltyPhone,
  skipUnless,
} from './checkout-type.helpers.js';
import { payCashAndReadDisplay, pointsLabel, type DisplayRun } from './vp-4489-points.helpers.js';

/** First build carrying the VP-5112 fix (`pointsValue_one` / `_other`). */
const FIXED_IN = '1.1.64';

const isAuto = (s: LivePointSetting): boolean => s.checkoutType === CHECKOUT_TYPE.AUTO;
const isManual = (s: LivePointSetting): boolean => s.checkoutType === CHECKOUT_TYPE.MANUAL;
const pointConfig = (s: LivePointSetting): boolean =>
  s.checkoutType === CHECKOUT_TYPE.MANUAL || s.checkoutType === CHECKOUT_TYPE.HYBRID;
const noMethodEarns = (s: LivePointSetting): boolean => POINT_METHODS.every((m) => !methodEarns(s, m));

const describeSetting = (s: LivePointSetting): string =>
  `${s.checkoutType}, bonus ${String(s.pointBonus)}, earning: ${
    POINT_METHODS.filter((m) => methodEarns(s, m)).join('/') || 'none'
  }`;

/** `a >= b` on dotted versions. */
function versionAtLeast(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

/** Read the live setting and skip the case unless `when` holds. */
async function gate(
  ctx: Mocha.Context,
  when: (s: LivePointSetting) => boolean,
  reason: string,
): Promise<LivePointSetting> {
  const setting = await liveSetting();
  skipUnless(ctx, when(setting), `${reason} (live: ${describeSetting(setting)})`);
  return setting;
}

/** The invariant every completion shares: balance delta == order stamp == recomputed award. */
function expectAwardConsistent(run: DisplayRun): void {
  expect(run.delta).toBe(run.expected.points);
  expect(run.order.pointBonus).toBe(run.expected.points);
}

describe('VP-4489 — check-in point vs $1 = 1 point (+ VP-5112 "1 point" label)', () => {
  before(async () => {
    assertWritesAllowed('complete orders for a loyalty customer');
    await returnToHome();
  });

  after(async () => {
    await returnToHome().catch(() => undefined);
  });

  describe('1. Point awarded per check-in (VP-4489)', () => {
    it(
      title(
        'TC-VP4489-01: Auto + Point Bonus 1 with $1 = 1 point configured → +1 point, not +amount',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const phone = loyaltyPhone(this);
        const setting = await gate(
          this,
          (s) => isAuto(s) && s.pointBonus === 1 && methodEarns(s, 'cash'),
          'needs Auto Checkout, Point Bonus 1 and Cash earning by Point Config',
        );
        const run = await payCashAndReadDisplay(phone, setting);
        expect(run.order.total).toBeGreaterThan(100); // > $1, so "$1 = 1 point" would award more than 1
        expect(run.expected.points).toBe(1);
        expectAwardConsistent(run);
      },
    );

    it(
      title(
        'TC-VP4489-02: Auto + Point Bonus 1 with every method "No points" still awards +1 (the store\'s case)',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const phone = loyaltyPhone(this);
        const setting = await gate(
          this,
          (s) => isAuto(s) && s.pointBonus === 1 && noMethodEarns(s),
          'needs Auto Checkout, Point Bonus 1 and Cash/Card/Gift card/Other all "No points"',
        );
        const run = await payCashAndReadDisplay(phone, setting);
        expect(run.expected.points).toBe(1);
        expectAwardConsistent(run);
      },
    );

    it(
      title(
        'TC-VP4489-03: Manual with every method "No points" awards 0 (no bonus fallback)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const phone = loyaltyPhone(this);
        const setting = await gate(
          this,
          (s) => isManual(s) && noMethodEarns(s),
          'needs Manual and every method "No points"',
        );
        const run = await payCashAndReadDisplay(phone, setting);
        expect(run.expected.points).toBe(0);
        expect(run.delta).toBe(0);
      },
    );

    it(
      title(
        'TC-VP4489-04: Manual $1 = 1 point is unaffected → +points by amount paid',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const phone = loyaltyPhone(this);
        const setting = await gate(
          this,
          (s) => isManual(s) && methodEarns(s, 'cash'),
          'needs Manual with Cash earning by Point Config',
        );
        const run = await payCashAndReadDisplay(phone, setting);
        expectAwardConsistent(run);
        expect(run.delta).toBe(Math.floor(run.order.total / setting.methods.cash.point));
      },
    );

    it(
      title(
        'TC-VP4489-05: Auto $0 order (full redeem) awards nothing and hides the earned block',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        const phone = gciCustomer(this, 'CHK-POS-017');
        const setting = await gate(this, isAuto, 'needs Auto Checkout');
        skipUnless(
          this,
          (await loyalty.checkedInPendingOrder(phone)) !== null,
          `the CHK-POS-017 kiosk check-in for ${phone} is no longer pending (already completed by another run)`,
        );
        const run = await payCashAndReadDisplay(phone, setting, {
          source: 'gci',
          reward: FULL_REDEEM_REWARD,
        });
        expect(run.order.total).toBe(0);
        expect(run.expected.showEarned).toBe(false);
        expect(run.delta).toBe(0);
        expect(run.display.shown).toBe(false);
      },
    );

    it(
      title(
        'TC-VP4489-06: a Portal setting change applies on POS without a restart — PENDING ' +
          '(cross-surface: Portal change + POS check in one run; Portal lane is ready (`.portal-profile`), POS side not wired)',
      ),
    );
  });

  describe('2. Customer display label (VP-5112)', () => {
    it(
      title(
        'TC-VP4489-07: Auto + Point Bonus 1 → customer display says "1 point" (singular)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        const phone = loyaltyPhone(this);
        const setting = await gate(
          this,
          (s) => isAuto(s) && s.pointBonus === 1,
          'needs Auto + Point Bonus 1',
        );
        const run = await payCashAndReadDisplay(phone, setting);
        expect(run.display.shown).toBe(true);
        expect(`${String(run.display.points)} ${run.display.unit}`).toBe('1 point');
        expectAwardConsistent(run);
      },
    );

    it(
      title(`TC-VP4489-08: POS runs a build with the VP-5112 fix (>= ${FIXED_IN})`, Tag.REGRESSION),
      async () => {
        await returnToHome();
        await appNav.openSidebar();
        try {
          const { version } = await appShellProbe.readAbout();
          expect(version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(versionAtLeast(version, FIXED_IN)).toBe(true);
        } finally {
          await appNav.closeSidebar().catch(() => undefined);
        }
      },
    );

    it(
      title(
        'TC-VP4489-09: more than 1 point earned → customer display says "N points" (plural)',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        const phone = loyaltyPhone(this);
        const setting = await gate(
          this,
          (s) => (pointConfig(s) && methodEarns(s, 'cash')) || (isAuto(s) && s.pointBonus > 1),
          'needs Point Config earning on Cash, or Auto with Point Bonus > 1',
        );
        const run = await payCashAndReadDisplay(phone, setting);
        skipUnless(
          this,
          run.expected.points > 1,
          `the order earned ${String(run.expected.points)} point(s) — pick a pricier first service`,
        );
        expect(run.display.shown).toBe(true);
        expect(`${String(run.display.points)} ${run.display.unit}`).toBe(pointsLabel(run.expected.points));
        expect(run.display.unit).toBe('points');
      },
    );

    it(
      title(
        'TC-VP4489-10: "Your current points" on the display = balance before + points earned',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        const phone = loyaltyPhone(this);
        const setting = await gate(
          this,
          (s) => (pointConfig(s) && methodEarns(s, 'cash')) || (isAuto(s) && s.pointBonus > 0),
          'needs a setting that awards points on a Cash order',
        );
        const run = await payCashAndReadDisplay(phone, setting);
        expect(run.display.shown).toBe(true);
        expect(run.display.points).toBe(run.expected.points);
        expect(run.display.current).toBe(run.before + run.expected.points);
        expect(run.after).toBe(run.display.current);
      },
    );

    it(
      title(
        'TC-VP4489-11: POS in Vietnamese — the earned-points line is not broken — PENDING ' +
          '(switching the app language is merchant-global @exclusive state; run by hand)',
      ),
    );

    it(
      title(
        'TC-VP4489-12: Manual with 0 points shows "0 points" while Auto hides the block — PENDING ' +
          '(doc-only: waiting on a PO decision, no expected behaviour to assert)',
      ),
    );
  });
});
