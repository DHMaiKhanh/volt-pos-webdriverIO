/**
 * The test-data barrel.
 *
 * ## The two halves, and why they are separate
 *
 * - `static/` — references to rows that must ALREADY EXIST in the merchant under
 *   test. Account-specific values come from the environment, because they change
 *   with the merchant while the code does not, and each module documents how to
 *   verify one before a spec depends on it. Nothing here creates data.
 * - `builders/` — inputs the suite constructs for itself, carrying a
 *   `uniqueSuffix()` token so repeated and parallel runs never collide. Rows a
 *   spec creates are pushed upstream and come back on every later session, so
 *   "unique" is about the merchant's whole history, not just this run.
 *
 * ## Reading a fixture is never enough
 *
 * `primaryStaff.id` is `''` on a machine that never set `STAFF_ID`, and an empty
 * id builds a locator that matches nothing — reported as a missing testid, which
 * blames the app for the runner's `.env`. Specs that need a named row call the
 * matching `require*` first, in a `before` hook, where the failure still points
 * at the person who can fix it.
 */

export { primaryStaff, requireStaffRef, secondaryStaff, staffFixtures } from './static/staff.js';

export {
  primaryService,
  QUICK_PAY_AMOUNT_CENTS,
  requireServiceRef,
  retailProduct,
  secondaryService,
  serviceFixtures,
} from './static/services.js';

export {
  CASH_PRESETS_CENTS,
  giftCard,
  INVALID_GIFT_CARD_CODE,
  PAYMENT_METHOD_FIXTURES,
  requireGiftCardCode,
  TENDERS_WITHOUT_HARDWARE,
} from './static/paymentMethods.js';
export type { PaymentMethodFixture } from './static/paymentMethods.js';

export { anOrder, OrderBuilder } from './builders/orderBuilder.js';
export type { OrderDraft } from './builders/orderBuilder.js';
