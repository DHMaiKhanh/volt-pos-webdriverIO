import { env } from '../../../configs/env/loadEnv.js';
import { PAYMENT_METHODS, PAYMENT_TYPE_BY_METHOD } from '../../types/models.js';
import type { AppPaymentType, MoneyCents, PaymentMethod } from '../../types/models.js';

/**
 * What each tender needs before a spec can drive it.
 *
 * Most of this is not account data — it is app behaviour, transcribed from the
 * checkout so a spec can decide whether a lane is runnable HERE rather than
 * discovering it in a timeout:
 *
 * - The four tabs are `PAYMENT_METHODS` in a fixed order (card, cash, gift card,
 *   other) — a module constant, not merchant data.
 * - Card, gift card and other are disabled offline; only cash survives a
 *   disconnected till.
 * - Only the card tender waits on the customer display and on a physical
 *   terminal.
 *
 * The one ACCOUNT value here is the gift-card number, which has to be a real
 * card in the merchant under test — see {@link giftCard}.
 */

/**
 * Cash quick-select presets, in CENTS: $5 / $10 / $50 / $100.
 *
 * Read off `checkout-keypad.tsx`, which hardcodes `["10000","5000","1000","500"]`.
 * VP-802's page object assumed a $20/$50/$100/$200 ladder — that is the
 * ADJUST-TIP keypad's, and `checkout-keypad-2000` matches nothing on this
 * screen. Presets ADD to the entry rather than replacing it, and the column only
 * renders on the cash tab.
 */
export const CASH_PRESETS_CENTS: readonly MoneyCents[] = [500, 1_000, 5_000, 10_000];

export interface PaymentMethodFixture {
  /** Tab spelling, as `checkout-tab-<method>` and `CheckoutPage.selectTender()` use it. */
  method: PaymentMethod;
  /** What the app writes to `order_transaction.paymentType` — `gift-card` becomes `gift_card`. */
  paymentType: AppPaymentType;
  /** Disabled while the till is offline. Cash is the only tender that is not. */
  requiresNetwork: boolean;
  /** Needs a Bamboo DOT terminal physically attached, or the charge never resolves. */
  requiresTerminal: boolean;
  /**
   * Complete Payment stays disabled until the customer display returns the tip
   * and the signature, so the spec has to drive the second window first.
   */
  requiresCustomerHandoff: boolean;
}

/**
 * Every tender, keyed by tab spelling.
 *
 * `Record<PaymentMethod, …>` on purpose: adding a fifth tender to
 * `PAYMENT_METHODS` breaks this file at compile time instead of leaving a
 * silently unmapped tab.
 */
export const PAYMENT_METHOD_FIXTURES: Record<PaymentMethod, PaymentMethodFixture> = {
  card: {
    method: 'card',
    paymentType: PAYMENT_TYPE_BY_METHOD.card,
    requiresNetwork: true,
    requiresTerminal: true,
    requiresCustomerHandoff: true,
  },
  cash: {
    method: 'cash',
    paymentType: PAYMENT_TYPE_BY_METHOD.cash,
    requiresNetwork: false,
    requiresTerminal: false,
    requiresCustomerHandoff: false,
  },
  'gift-card': {
    method: 'gift-card',
    paymentType: PAYMENT_TYPE_BY_METHOD['gift-card'],
    requiresNetwork: true,
    requiresTerminal: false,
    requiresCustomerHandoff: false,
  },
  other: {
    method: 'other',
    paymentType: PAYMENT_TYPE_BY_METHOD.other,
    requiresNetwork: true,
    requiresTerminal: false,
    requiresCustomerHandoff: false,
  },
};

/**
 * The tenders a machine with no card terminal can actually settle.
 *
 * The natural list for a parameterised payment suite on a developer laptop or a
 * CI box — everything else stalls on hardware that is not there.
 */
export const TENDERS_WITHOUT_HARDWARE: readonly PaymentMethod[] = PAYMENT_METHODS.filter(
  (method) => !PAYMENT_METHOD_FIXTURES[method].requiresTerminal,
);

/**
 * Gift-card numbers hard-set in source, keyed by merchant.
 *
 * A gift card is ACCOUNT data — see {@link giftCard} — so every entry here MUST
 * be a real, funded card issued in that merchant; a card from another merchant
 * comes back "not valid" rather than "unknown". This is the standing redemption
 * card for a device the suite is run on with no personal `.env`, which is why it
 * lives in source rather than in a git-ignored env file. `GIFT_CARD_CODE` still
 * overrides it, for a machine pointed at another merchant or another card.
 *
 * - `20258` — the test device's merchant (see the device-merchant-20258 note):
 *   `152298102986`, the shop's standing redemption card. Redemption drains it, so
 *   keep it topped up.
 */
const GIFT_CARD_BY_MERCHANT: Readonly<Record<string, string>> = {
  '20258': '152298102986',
};

/**
 * The gift card the redemption specs spend.
 *
 * ## An ACCOUNT value: this card must exist, and it must have money on it
 *
 * A gift card is merchant data — the suite cannot mint one, and a card issued
 * for another merchant comes back "not valid" rather than "unknown". Check one
 * before relying on it:
 *
 * 1. **On screen.** `/home` → the order panel sells and tops up gift cards, and
 *    `/settings` reports on them; the number is printed on the card itself.
 * 2. **From the app's own database — DEBUG builds only.**
 *    `VoltPosDb.tryOpen({ merchantId: env.MERCHANT_ID })?.query('SELECT code, balance, status FROM gift_card')`.
 *    A release build is SQLCipher-encrypted and `tryOpen` returns `null`.
 *
 * Redemption SPENDS the balance, so a card configured here drains across runs —
 * top it up, or point `GIFT_CARD_CODE` at a card kept for this purpose.
 *
 * The number resolves in this order: `GIFT_CARD_CODE` if set, else the card
 * hard-set for `MERCHANT_ID` in {@link GIFT_CARD_BY_MERCHANT} (merchant 20258
 * ships with `152298102986`), else empty — which {@link requireGiftCardCode}
 * turns into an actionable error.
 */
export const giftCard = {
  code: resolveGiftCardCode(),
  /** Optional: what the card is expected to hold, in cents, when a spec asserts the balance line. */
  balanceCents: balanceFromEnv(),
} as const;

/**
 * A number that cannot resolve to a card — for the rejection path.
 *
 * Digits only, and sixteen of them, because `InputCode` is bound to
 * `GIFT_CARD_CODE_MIN_DIGITS`/`MAX_DIGITS` (1 and 16) and strips everything that
 * is not a digit. VP-802's `"INVALID-CODE-000"` cannot be typed into this field
 * at all: it would arrive as `000`, which is a perfectly well-formed short code
 * and tests something else entirely.
 */
export const INVALID_GIFT_CARD_CODE = '9999999999999999';

/** Assert a gift card is configured, and say what to set when it is not. */
export function requireGiftCardCode(): string {
  if (giftCard.code !== '') return giftCard.code;

  throw new Error(
    `This spec redeems a gift card, but no card is configured for merchant ${env.MERCHANT_ID}.\n` +
      `Either set GIFT_CARD_CODE in configs/env/.env.${env.ENV} / .env.local, or hard-set the ` +
      `merchant's card in GIFT_CARD_BY_MERCHANT (src/data/static/paymentMethods.ts) — use a card ` +
      `that exists in this merchant and still holds a balance, redemption spends it.\n` +
      `For the rejection path use INVALID_GIFT_CARD_CODE instead; that one needs no account setup.`,
  );
}

/**
 * The gift-card number to spend: `GIFT_CARD_CODE` if set, else the card hard-set
 * for `MERCHANT_ID`, else empty.
 *
 * Env wins so a developer can aim a run at their own card without touching
 * source; the hard-set default is what makes the redemption specs runnable on a
 * shared test device with no `.env` at all.
 */
function resolveGiftCardCode(): string {
  const fromEnv = (process.env.GIFT_CARD_CODE ?? '').trim();
  if (fromEnv !== '') return fromEnv;
  return GIFT_CARD_BY_MERCHANT[env.MERCHANT_ID] ?? '';
}

/** `GIFT_CARD_BALANCE_CENTS`, in cents, or `undefined` when the spec does not assert on it. */
function balanceFromEnv(): MoneyCents | undefined {
  const raw = (process.env.GIFT_CARD_BALANCE_CENTS ?? '').trim();
  if (raw === '') return undefined;

  const cents = Number(raw);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(
      `GIFT_CARD_BALANCE_CENTS="${raw}" is not a non-negative integer number of CENTS. ` +
        `$25.00 is written 2500 here; there is no decimal form.`,
    );
  }
  return cents;
}
