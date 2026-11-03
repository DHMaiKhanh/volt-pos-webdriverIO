/**
 * VP-4376 — the gift-card cancel guard (VP-3727) must treat a code the API
 * answers with an EMPTY card (`id: ""`, balance 0) as "unknown", try the next
 * lookup code, and only say "insufficient" for a real card that is short.
 *
 * TC doc: docs/qc/volt-qc/vp-tickets/VP-4376-gift-card-cancel-guard-test-cases.md (TC-VP4376-01..10)
 *
 * ## How "the code does not resolve" is produced
 *
 * The ticket uses Fiddler/Charles on `GET …/gift_card/code/<code>`. The POS
 * reaches that endpoint through ONE GraphQL operation over IPC
 * (`getGiftCardByCode` → `giftCardQueryByCode`), so the spec wraps
 * `window.__TAURI_INTERNALS__.invoke` for that operation only
 * (`installGiftCardStub`) and restores it in `afterEach`. Everything else —
 * the history read, the cancel mutation — goes to the real app. A webview that
 * refuses the wrap makes the stubbed cases skip.
 *
 * ## Data
 *
 * Orders are $25 top-ups of `VOLT_TEST_GIFT_CARD` paid in Cash. The blocked
 * cases (02/03/04) share one order — a blocked cancel changes nothing — and
 * TC-05 finally cancels it for real; TC-01 and TC-06 cancel orders of their own.
 *
 * CREATES DATA AND TAKES PAYMENTS: 2–3 Cash top-up orders, 2–3 real cancels
 * (the test card's balance nets out). dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { VpCancelGuard } from '../../../src/constants/testids.vp-promo-gc.js';
import {
  settledGiftCardBalance,
  waitGiftCardBalance,
} from '../../../src/pages/voltqc/promo-split/promoFlows.js';
import { app } from '../../../src/pages/voltqc/promo-split/vqApp.js';
import { waitHistoryStatusHard } from '../../../src/pages/voltqc/promo-split/promoDeepExtra.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  attemptCancel,
  dismissCancelBlocked,
  giftCardHistoryOf,
  historyStatus,
  installGiftCardStub,
  lookupCodes,
  orderSnapshot,
  paidGiftCardTopUpOrder,
  removeGiftCardStub,
  vpGiftCardCode,
  type GcStubAnswer,
} from './vp-promo-gc.helpers.js';

const TOP_UP = 25;

/** Lookup codes the guard will try for the order's top-up (first TOP_UP history row). */
async function topUpLookupCodes(code: string): Promise<string[]> {
  const id = (await orderSnapshot(code))?.id ?? '';
  if (!id) return [];
  const histories = await giftCardHistoryOf(id).catch(() => []);
  const topUp = histories.find((h) => h.type === 'TOP_UP') ?? histories[0];
  return topUp ? lookupCodes(topUp) : [];
}

/** Install a stub or skip the case when the webview refuses it. */
async function stubOrSkip(ctx: Mocha.Context, stubs: Record<string, GcStubAnswer>): Promise<void> {
  if (!(await installGiftCardStub(stubs))) ctx.skip();
}

describe('VP-4376 — gift-card cancel guard: empty-card lookup is "unknown", not "$0"', () => {
  let blockedOrder = '';
  let codes: string[] = [];

  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK * 3);
    assertWritesAllowed('top up a gift card in Cash and cancel the order');
    if (!vpGiftCardCode()) this.skip(); // no active gift card (VOLT_TEST_GIFT_CARD)
    blockedOrder = await paidGiftCardTopUpOrder(TOP_UP);
    codes = await topUpLookupCodes(blockedOrder);
  });

  afterEach(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await removeGiftCardStub();
    await dismissCancelBlocked().catch(() => undefined);
    await app.closeStrayDialogs().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await removeGiftCardStub();
    await app.closeStrayDialogs().catch(() => undefined);
  });

  /* ----------------------------------------------------------------------- */
  describe('1. Acceptance criteria', () => {
    it(
      title(
        'TC-VP4376-02: no code resolves (empty card everywhere) → "Unable to verify the Gift Card balance", never "insufficient"',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        await stubOrSkip(this, { '*': { kind: 'empty' } });
        const r = await attemptCancel(blockedOrder);
        expect(r.blocked).toBe(true);
        expect(r.message).toContain(VpCancelGuard.blockedTitle);
        expect(r.message).toContain(VpCancelGuard.unverified);
        expect(r.message).not.toContain(VpCancelGuard.insufficient);
        await dismissCancelBlocked();
        expect(await historyStatus(blockedOrder)).not.toMatch(/Cancel/);
      },
    );

    it(
      title(
        'TC-VP4376-03: a real card that is short is still blocked with "balance is insufficient"',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        await stubOrSkip(this, { '*': { kind: 'card', currentBalanceCents: 0 } });
        const r = await attemptCancel(blockedOrder);
        expect(r.blocked).toBe(true);
        expect(r.message).toContain(VpCancelGuard.insufficient);
        expect(r.message).not.toContain(VpCancelGuard.unverified);
        await dismissCancelBlocked();
        expect(await historyStatus(blockedOrder)).not.toMatch(/Cancel/);
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('2. Additional regression', () => {
    it(
      title(
        'TC-VP4376-04: a failing balance lookup (transport error) → "Unable to verify the Gift Card balance"',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(3 * 60_000);
        await stubOrSkip(this, { '*': { kind: 'error' } });
        const r = await attemptCancel(blockedOrder);
        expect(r.blocked).toBe(true);
        expect(r.message).toContain(VpCancelGuard.unverified);
        await dismissCancelBlocked();
        expect(await historyStatus(blockedOrder)).not.toMatch(/Cancel/);
      },
    );

    it(
      title(
        'TC-VP4376-05: OK on the blocked dialog leaves the order Successful; the real cancel then succeeds',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async function () {
        this.timeout(4 * 60_000);
        await removeGiftCardStub();
        await app.openHistoryOrder(blockedOrder);
        expect(await historyStatus(blockedOrder)).toMatch(/^Successful/);
        const r = await attemptCancel(blockedOrder);
        expect(r.blocked).toBe(false);
        expect(r.canceled).toBe(true);
        expect(await waitHistoryStatusHard(blockedOrder, 'Canceled', 150_000)).toBe('Canceled');
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('1b. Acceptance criteria — cancels of their own', () => {
    it(
      title(
        'TC-VP4376-01: first lookup code answers an empty card, the next code has the balance → cancel goes through',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(5 * 60_000);
        // ⚠️ The card's history must carry ≥ 2 distinct lookup codes (giftCard.code / history.code / posGiftCard.code).
        const [first] = codes;
        if (codes.length < 2 || !first) this.skip();
        if (!first) return;
        const order = await paidGiftCardTopUpOrder(TOP_UP);
        await stubOrSkip(this, { [first]: { kind: 'empty' } });
        const r = await attemptCancel(order);
        expect(r.blocked).toBe(false);
        expect(r.canceled).toBe(true);
        await removeGiftCardStub();
        expect(await waitHistoryStatusHard(order, 'Canceled', 150_000)).toBe('Canceled');
      },
    );

    it(
      title(
        'TC-VP4376-06: a card with enough balance cancels normally and the top-up is reverted',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.PAYMENT,
      ),
      async function () {
        this.timeout(6 * 60_000);
        const card = vpGiftCardCode();
        // Read the balance BEFORE the top-up: a read right after paying can still miss
        // the TOP_UP row, and then the (correct) REVERT looked like no change at all.
        const original = await settledGiftCardBalance(card);
        const order = await paidGiftCardTopUpOrder(TOP_UP, card);
        expect(await waitGiftCardBalance(card, original + TOP_UP, 90_000)).toBeCloseTo(original + TOP_UP, 2);
        const r = await attemptCancel(order);
        expect(r.blocked).toBe(false);
        expect(r.canceled).toBe(true);
        expect(await waitHistoryStatusHard(order, 'Canceled', 150_000)).toBe('Canceled');
        expect(await waitGiftCardBalance(card, original, 90_000)).toBeCloseTo(original, 2);
      },
    );
  });

  /* ----------------------------------------------------------------------- */
  describe('3. Not automatable here / documentation', () => {
    it(
      title(
        'TC-VP4376-07: AC 01–03 on a PRODUCTION build (v1.1.2+, #2844 picked) — PENDING 🧱 (no production build / no writes on prod from this PC)',
      ),
    );

    it(
      title(
        'TC-VP4376-08: make the code unresolvable for real (rename / delete the card code) — PENDING 🧱 (Portal / BE access)',
      ),
    );

    it(
      title(
        'TC-VP4376-10: cherry-pick of #2844 keeps only fetchCurrentBalance + the "empty card" unit test — PENDING 📄 (PR review)',
      ),
    );
  });
});
