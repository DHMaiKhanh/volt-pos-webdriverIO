import { env } from '../../../configs/env/loadEnv.js';
import type { MoneyCents, ServiceRef } from '../../types/models.js';

/**
 * The menu items specs sell.
 *
 * ## These are ACCOUNT values — see the same warning on `staff.ts`
 *
 * The ids must exist in the merchant under test (`MERCHANT_ID`, default `14`)
 * and be visible to this till: `service.status` has to be active and
 * `show_on_go_pos` true, or the tile is simply not in the panel even though the
 * row exists. Nothing in this repository creates services.
 *
 * ## How to check a value before trusting it
 *
 * 1. **On screen.** `/home` → the service panel; each tile is
 *    `data-testid="service-item-<id>"`. `/settings/services` lists the same
 *    catalogue with prices.
 * 2. **From the app's own database — DEBUG builds only.**
 *    `VoltPosDb.tryOpen({ merchantId: env.MERCHANT_ID })?.query('SELECT id, name, price, status FROM service')`.
 *    A release build is SQLCipher-encrypted and `tryOpen` returns `null`.
 *
 * ## Prices are CENTS
 *
 * `service.price` is an `Option<i32>` of cents in the app's own entity, and it
 * is nullable because a flexible-priced item has no fixed price at all. So
 * `SERVICE_PRICE_CENTS=2500` is $25.00 — writing `25` there books a 25-cent
 * service and every total assertion downstream is wrong by two orders of
 * magnitude. {@link centsFromEnv} rejects a decimal for exactly that reason.
 */

/**
 * The service most order specs add.
 *
 * `price` is optional on purpose: a spec that asserts on a total should set
 * `SERVICE_PRICE_CENTS` and read it from here, while a spec that only needs
 * "one line on the order" leaves it unset and asserts against what the cart
 * prints.
 */
export const primaryService: ServiceRef = {
  id: (process.env.SERVICE_ID ?? '').trim(),
  name: (process.env.SERVICE_NAME ?? '').trim(),
  price: centsFromEnv('SERVICE_PRICE_CENTS'),
  kind: 'service',
};

/**
 * A second, differently-priced item.
 *
 * For the specs that need more than one line: split order, per-item discount,
 * partial refund. Picking one with a different price from {@link primaryService}
 * is what makes a per-line assertion able to fail.
 */
export const secondaryService: ServiceRef = {
  id: (process.env.SECOND_SERVICE_ID ?? '').trim(),
  name: (process.env.SECOND_SERVICE_NAME ?? '').trim(),
  price: centsFromEnv('SECOND_SERVICE_PRICE_CENTS'),
  kind: 'service',
};

/**
 * A retail product rather than a service.
 *
 * `SERVICE_TYPE` splits the menu in two and the app treats the halves
 * differently — a product is not commissionable and does not carry a duration —
 * so a payroll or turn-board spec needs one of each to be meaningful.
 */
export const retailProduct: ServiceRef = {
  id: (process.env.PRODUCT_ID ?? '').trim(),
  name: (process.env.PRODUCT_NAME ?? '').trim(),
  price: centsFromEnv('PRODUCT_PRICE_CENTS'),
  kind: 'product',
};

/**
 * The Quick Pay amount for specs that sell an arbitrary sum.
 *
 * Quick Pay needs no catalogue row at all, which makes it the one "add a line"
 * path that works on any merchant — useful when a suite has to run against an
 * account whose service ids nobody has configured yet.
 */
export const QUICK_PAY_AMOUNT_CENTS: MoneyCents = centsFromEnv('QUICK_PAY_AMOUNT_CENTS') ?? 5_000;

/** Every named service fixture, for a spec that wants to state its own prerequisites. */
export const serviceFixtures: readonly ServiceRef[] = [primaryService, secondaryService, retailProduct];

/**
 * Assert a service fixture is configured, and say what to set when it is not.
 *
 * Same contract as `requireStaffRef`: fail in the hook with a variable name, not
 * later inside a locator that reports a missing testid for a tile the merchant
 * never had.
 */
export function requireServiceRef(service: ServiceRef, envVar = 'SERVICE_ID'): ServiceRef {
  if (service.id !== '') return service;

  throw new Error(
    `This spec needs a specific service, but ${envVar} is not set for merchant ` +
      `${env.MERCHANT_ID}.\nSet it in configs/env/.env.${env.ENV} or configs/env/.env.local — ` +
      `the id is the one in the tile's data-testid ("service-item-<id>") on /home.\n` +
      `If the spec only needs A line on the order, omit the service reference and let ` +
      `createOrder() take the first tile.`,
  );
}

/**
 * Read an integer number of cents from the environment.
 *
 * Returns `undefined` for an unset variable — `ServiceRef.price` is optional and
 * a flexible-priced item genuinely has none. A decimal is rejected rather than
 * rounded: `12.50` in a cents variable means the author was thinking in dollars,
 * and silently accepting `1250` or `13` would ship one of two different bugs.
 */
function centsFromEnv(name: string): MoneyCents | undefined {
  const raw = (process.env[name] ?? '').trim();
  if (raw === '') return undefined;

  const cents = Number(raw);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(
      `${name}="${raw}" is not a non-negative integer number of CENTS. ` +
        `$25.00 is written 2500 here; there is no decimal form.`,
    );
  }
  return cents;
}
