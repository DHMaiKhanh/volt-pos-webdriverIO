/**
 * VP-4894 — a gift card that is NOT active (Inactive, Initial / not sold yet) but
 * still carries a balance must be refused at checkout on LOOKUP: "Gift card is
 * inactive" + Scan Again, never "Gift Card Accepted" / Pay. Fixed in dev 1.1.106
 * (1.1.104 still accepted it → sub-bug VP-6056).
 *
 * TC doc: docs/qc/volt-qc/vp-tickets/VP-4894-inactive-gift-card-checkout-test-cases.md (TC-VP4894-01..06)
 *
 * ## Data
 *
 * Real inactive cards from the 20258 catalog (`inactiveGiftCards`, re-verified live
 * 06/11/2026). 20258 has no card in the `initial` state, so TC-03 stubs ONLY the
 * `giftCardQueryByCode` answer (status `initial`, $50) with the VP-4376 stub; the
 * dialog the till renders is the real one.
 *
 * READ-ONLY for money: one order is created and left unpaid, Pay is never pressed,
 * no card is spent. Needs the LAUNCH lane (customer display for the tip handoff).
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../src/components/index.js';
import {
  fundedActiveGiftCards,
  inactiveGiftCards,
  INVALID_GIFT_CARD_CODE,
  requireFundedActiveGiftCard,
} from '../../../src/data/index.js';
import { completeCustomerTipIfPrompted, createOrder, returnToHome } from '../../../src/flows/index.js';
import { checkoutPage, homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { installGiftCardStub, removeGiftCardStub } from './vp-promo-gc.helpers.js';

type Outcome = 'accepted' | 'inactive' | 'invalid' | 'none';

/** Code TC-03 looks up; the stub answers it as an `initial` card holding $50. */
const STUB_INITIAL_CODE = '111122223333';

/** Bring the gift-card scan dialog up on the current order (opens checkout's gift-card tender if needed). */
async function ensureScanDialog(): Promise<void> {
  if (await checkoutPage.isGiftCardScanDialogOpen()) return;
  await checkoutPage.waitForReady();
  await checkoutPage.selectTender('gift-card');
  await checkoutPage.pressCompletePayment();
  await passcodeDialog.enterIfPresent(env.STAFF_PASSCODE);
  // 20258 pushes a tip prompt to the customer display before the scan dialog opens.
  await completeCustomerTipIfPrompted('none', undefined, Timeouts.MEDIUM);
  await checkoutPage.waitForGiftCardScanDialog();
}

/** Wait for the lookup to settle on one of the dialog's result screens. */
async function lookupOutcome(): Promise<Outcome> {
  let result: Outcome = 'none';
  await browser
    .waitUntil(
      async () => {
        if (await checkoutPage.isGiftCardAccepted()) result = 'accepted';
        else if (await checkoutPage.isGiftCardInactive()) result = 'inactive';
        else if (await checkoutPage.isGiftCardInvalid()) result = 'invalid';
        return result !== 'none';
      },
      { timeout: Timeouts.MEDIUM, interval: 300 },
    )
    .catch(() => undefined);
  return result;
}

/** Type `code`, press Confirm and return which result screen the dialog lands on. */
async function lookUp(code: string): Promise<Outcome> {
  // From the accepted screen there is no Scan Again — Cancel back out first.
  if (await checkoutPage.isGiftCardAccepted()) {
    await checkoutPage.closeGiftCardDialog();
  }
  await ensureScanDialog();
  await checkoutPage.enterGiftCardCode(code);
  await checkoutPage.redeemGiftCard();
  return lookupOutcome();
}

/** Assert the dialog refused the card: no Accepted, no Pay, Scan Again offered. */
async function expectRefused(outcome: Outcome): Promise<void> {
  expect(outcome).not.toBe('accepted');
  expect(await checkoutPage.isGiftCardAccepted()).toBe(false);
  expect(await checkoutPage.isGiftCardPayAvailable()).toBe(false);
  expect(await checkoutPage.isGiftCardScanAgainAvailable()).toBe(true);
}

describe('VP-4894 — inactive / unsold gift card with a balance is refused at checkout', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    // Catalog belongs to 20258; on another merchant there is nothing to drive.
    if (inactiveGiftCards.length === 0 || fundedActiveGiftCards.length === 0) this.skip();
    await returnToHome();
    await homePage.discardDraftIfAny();
    await createOrder();
    await ensureScanDialog();
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await removeGiftCardStub();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await removeGiftCardStub();
    await checkoutPage.closeGiftCardDialog().catch(() => undefined);
    await returnToHome().catch(() => undefined);
    await homePage.discardDraftIfAny().catch(() => undefined);
  });

  /* ----------------------------------------------------------------------- */
  describe('1. Non-active cards are refused on lookup', () => {
    it(
      title(
        'TC-VP4894-01: an Inactive card with a balance shows "Gift card is inactive", never Gift Card Accepted',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const card = inactiveGiftCards[0];
        if (!card) this.skip();
        const outcome = await lookUp(card.code);
        expect(outcome).toBe('inactive');
        await expectRefused(outcome);
      },
    );

    it(
      title(
        'TC-VP4894-02: every Inactive card in the catalog is refused the same way',
        Tag.REGRESSION,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(5 * 60_000);
        const outcomes: Record<string, Outcome> = {};
        for (const card of inactiveGiftCards) {
          const outcome = await lookUp(card.code);
          outcomes[card.code] = outcome;
          await expectRefused(outcome);
        }
        expect(Object.values(outcomes).every((o) => o === 'inactive')).toBe(true);
      },
    );

    it(
      title(
        'TC-VP4894-03: an Initial (not sold yet) card with a balance is refused (lookup stubbed — 20258 has no initial card)',
        Tag.REGRESSION,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const stubbed = await installGiftCardStub({
          [STUB_INITIAL_CODE]: { kind: 'card', currentBalanceCents: 5000, status: 'initial' },
        });
        if (!stubbed) this.skip();
        const outcome = await lookUp(STUB_INITIAL_CODE);
        await expectRefused(outcome);
      },
    );

    it(
      title('TC-VP4894-04: Scan Again after a refusal returns to an empty code entry', Tag.REGRESSION),
      async function () {
        this.timeout(3 * 60_000);
        const card = inactiveGiftCards[0];
        if (card && !(await checkoutPage.isGiftCardScanAgainAvailable())) {
          await lookUp(card.code);
        }
        // enterGiftCardCode presses Scan Again itself; a fresh lookup proves re-entry works.
        const outcome = await lookUp(INVALID_GIFT_CARD_CODE);
        expect(outcome).toBe('invalid');
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('2. Regression — active / unknown cards', () => {
    it(
      title(
        'TC-VP4894-06: an unknown code still reads "Gift card is not valid", not the inactive message',
        Tag.REGRESSION,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const outcome = await lookUp(INVALID_GIFT_CARD_CODE);
        expect(outcome).toBe('invalid');
        expect(await checkoutPage.isGiftCardInactive()).toBe(false);
      },
    );

    it(
      title(
        'TC-VP4894-05: an Active funded card is still accepted with Pay (Pay is not pressed)',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(3 * 60_000);
        const outcome = await lookUp(requireFundedActiveGiftCard().code);
        expect(outcome).toBe('accepted');
        expect(await checkoutPage.isGiftCardPayAvailable()).toBe(true);
        expect(await checkoutPage.isGiftCardInactive()).toBe(false);
      },
    );
  });
});
