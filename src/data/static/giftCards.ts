import { env } from '../../../configs/env/loadEnv.js';
import catalog from './giftCards.json' with { type: 'json' };

/**
 * The gift-card CATALOG — a snapshot of real cards issued in a merchant, loaded
 * from {@link ./giftCards.json}.
 *
 * ## Why a JSON file and not more entries in paymentMethods.ts
 *
 * {@link giftCard} in `paymentMethods.ts` resolves the ONE standing redemption
 * card per merchant — the card a spec spends when it just needs "a funded card".
 * This file is the opposite: a LIST, so a spec can iterate many cards (prove each
 * is a usable charge source), pick a low/empty one to top up, or pin a case to a
 * specific number. Data that is a list of rows belongs in data, not in code, and
 * keeping it in `.json` lets it be regenerated from the gift-card report without a
 * TypeScript edit.
 *
 * ## Still ACCOUNT data — reading a row is never enough
 *
 * Every code here must be a real card in the merchant under test; a card from
 * another merchant comes back "not valid" rather than "unknown" (see
 * {@link giftCard}). The catalog is tagged with the merchant it was captured in
 * (`_meta.merchant`), and {@link giftCardCatalog} is EMPTY on any other merchant —
 * so a spec pointed at a different till skips rather than driving stale numbers.
 * `balance` is the report figure verbatim; it is used only to rank and to tell
 * funded from empty, never asserted (see `_meta.balanceUnit`).
 */

/** A card's lifecycle state as the gift-card report prints it. */
export type GiftCardStatus = 'active' | 'inactive' | 'initial';

/** One catalog row: the number, its status, and the balance figure as displayed. */
export interface GiftCardRecord {
  /** The gift-card number, digits only, leading zeros preserved. */
  code: string;
  /** Lifecycle state. Only `active` cards validate at checkout. */
  status: GiftCardStatus;
  /**
   * The balance figure printed on the report, verbatim. Unit is unconfirmed (see
   * `_meta.balanceUnit`) — compare and rank by it, do NOT assert a dollar amount
   * off it.
   */
  balance: number;
}

interface GiftCardCatalogFile {
  _meta: { merchant: string; [key: string]: unknown };
  cards: GiftCardRecord[];
}

const file = catalog as GiftCardCatalogFile;

/** The merchant the catalog was captured in — the only one its codes are valid for. */
export const GIFT_CARD_CATALOG_MERCHANT: string = file._meta.merchant;

/**
 * The full catalog, but ONLY when the current merchant matches the one it was
 * captured in. Empty on any other merchant, so a spec iterating it finds nothing
 * to run instead of charging numbers that belong to a different till.
 */
export const giftCardCatalog: readonly GiftCardRecord[] =
  env.MERCHANT_ID === GIFT_CARD_CATALOG_MERCHANT ? file.cards : [];

/** Active cards, in catalog order. The only status that validates at checkout. */
export const activeGiftCards: readonly GiftCardRecord[] = giftCardCatalog.filter(
  (card) => card.status === 'active',
);

/**
 * Active cards that still hold a balance, richest first — the cards a redemption
 * can actually be settled with. Sorted by `balance` descending so the first entry
 * is the safest to spend; `balance` here is a magnitude, not an assertion.
 */
export const fundedActiveGiftCards: readonly GiftCardRecord[] = activeGiftCards
  .filter((card) => card.balance > 0)
  .slice()
  .sort((a, b) => b.balance - a.balance);

/**
 * Active cards with NO balance — the natural subjects for a "top up then charge"
 * case: nothing to redeem until money is added first.
 */
export const emptyActiveGiftCards: readonly GiftCardRecord[] = activeGiftCards.filter(
  (card) => card.balance <= 0,
);

/**
 * The first `count` funded active cards (richest first). A spec parameterises
 * over these to prove several catalog cards are usable without walking all 30-odd
 * every run. Returns fewer than asked — or none — when the catalog is short or on
 * the wrong merchant; callers treat an empty result as a skip.
 */
export function pickFundedActiveGiftCards(count: number): readonly GiftCardRecord[] {
  return fundedActiveGiftCards.slice(0, Math.max(count, 0));
}

/**
 * The richest funded active card, or throw with what to fix. For a spec that
 * needs exactly one card to spend and should fail LOUDLY — pointing at the
 * merchant or the capture — rather than skip, when the catalog cannot supply one.
 */
export function requireFundedActiveGiftCard(): GiftCardRecord {
  const [card] = fundedActiveGiftCards;
  if (card !== undefined) return card;

  throw new Error(
    `No funded active gift card is available in the catalog for merchant ${env.MERCHANT_ID}.\n` +
      (env.MERCHANT_ID === GIFT_CARD_CATALOG_MERCHANT
        ? `src/data/static/giftCards.json lists ${String(giftCardCatalog.length)} cards for this ` +
          `merchant but none are both active and carrying a balance — re-capture the gift-card report, ` +
          `or top one up first.`
        : `The catalog was captured in merchant ${GIFT_CARD_CATALOG_MERCHANT}, not ${env.MERCHANT_ID}; ` +
          `its codes are not valid here. Re-capture it against this merchant, or run against ` +
          `${GIFT_CARD_CATALOG_MERCHANT}.`),
  );
}
