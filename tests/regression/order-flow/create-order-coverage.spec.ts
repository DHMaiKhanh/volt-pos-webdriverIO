/**
 * Create Order — coverage spec for the remaining catalogue items.
 *
 * Every create-order test case lives in source: the ones already automated are in
 * create-order.spec.ts / home-cart.spec.ts / quick-pay.spec.ts / customer-entry.spec.ts,
 * and the ones below are enumerated here as PENDING so the suite reports them (as
 * skipped, never failed) and the dashboard shows the true coverage surface. Each
 * maps to docs/screens/order-flow/create-order-master-catalog.md and, where it
 * comes from a ticket, to its VP id in docs/qc/linear-pos-testcase-catalog.md.
 *
 * To implement one: scan the live screen (attach: `npm run app:launch` → cdp.mjs,
 * or the /scan-feature skill), add the page-object methods it needs, then move the
 * case into the matching spec file with a real body. A pending `it()` has no
 * function on purpose — Mocha renders it as pending, which is the review signal
 * that the behaviour is specified but not yet driven.
 *
 * Why here and not inline: these need either a fixture the account must carry (a
 * second staff, a product, a known customer) or a flow not yet modelled (promotion
 * application, merge). Keeping them in one place makes the create-order backlog a
 * single file to burn down.
 */

import { title } from '../../../src/types/testTags.js';

describe('Create Order — remaining coverage (pending)', () => {
  describe('Staff', () => {
    // CO-STAFF-03 / VP-1572 — a Verified-Prod bug: staff was unselectable after a search.
    it(title('Staff is selectable after filtering the panel by search (CO-STAFF-03 · VP-1572) — PENDING'));
    // CO-STAFF-07 — two staff on one order, each with its own service group.
    it(title('A second staff adds its own service group and the total sums both (CO-STAFF-07) — PENDING'));
    // CO-STAFF-08 / VP-3247 — needs live turn data to show Available/Busy.
    it(
      title(
        'Turn shows real staff status Available/Busy, not "Available" before a service (CO-STAFF-08 · VP-3247) — PENDING',
      ),
    );
  });

  describe('Service & Product', () => {
    // CO-SVC-05 — add the same service twice; subtotal reflects the quantity.
    it(
      title('Adding the same service twice raises the subtotal by its price each time (CO-SVC-05) — PENDING'),
    );
    // CO-SVC-06 / VP-4079 — a product line, taxed at the product rate (needs PRODUCT_ID).
    it(
      title(
        'A product line is added and taxed at the product rate (CO-SVC-06 · VP-4079) — PENDING (needs PRODUCT_ID)',
      ),
    );
  });

  describe('Cart line', () => {
    // CO-LINE-04 — removing one service line drops the total by that line.
    it(title('Removing one service line lowers the total by that line (CO-LINE-04) — PENDING'));
  });

  describe('Promotion & Reward', () => {
    // CO-ORD-02 — applying a system promotion actually reduces the total.
    it(title('Applying a promotion reduces the order total by the promotion amount (CO-ORD-02) — PENDING'));
    // CO-ORD-03 / VP-4375 — a FIXED promo larger than the discountable amount is capped.
    it(
      title(
        'A FIXED promo larger than the discountable amount is capped, not saved as entered (CO-ORD-03 · VP-4375) — PENDING',
      ),
    );
    // CO-ORD-04 / VP-4162 — promo/reward is refused on a gift-card-only order.
    it(title('Promotion/Reward is blocked on a gift-card-sale-only order (CO-ORD-04 · VP-4162) — PENDING'));
    // CO-ORD-05 / VP-4802 — available promotion & reward totals shown when creating the order.
    it(
      title(
        'Available Promotion and Reward totals are shown on the create-order screen (CO-ORD-05 · VP-4802) — PENDING',
      ),
    );
    // CO-ORD-06 / VP-3564 — reward option hidden until a customer is chosen.
    it(title('Reward option is hidden until a customer is attached (CO-ORD-06 · VP-3564) — PENDING'));
  });

  describe('Fees & totals', () => {
    // CO-SUM-03 / VP-4379 — a gift-card sale line is excluded from service fee & cash discount.
    it(
      title(
        'A gift-card sale line is excluded from service fee and cash discount (CO-SUM-03 · VP-4379) — PENDING',
      ),
    );
    // CO-SUM-04 / VP-3436 — the discount charge is scoped to service, not a no-staff product.
    it(
      title(
        'Discount charge is scoped to service only, not to a no-staff product (CO-SUM-04 · VP-3436) — PENDING',
      ),
    );
  });

  describe('Entry points', () => {
    // CO-ENTRY-03 — sell a gift card from the Home "Gift Card" tile.
    it(title('Selling a gift card from the Home tile adds a gift-card line (CO-ENTRY-03) — PENDING'));
  });

  describe('Header search (needs a GlobalSearch page object)', () => {
    // CO-HDR-01 / TC-ORDERFLOW-74 — the global Search shows four tabs.
    it(
      title(
        'Global Search shows four tabs: All / Appointment / Customer / Order (CO-HDR-01 · TC-74) — PENDING',
      ),
    );
    // CO-HDR-02 / TC-ORDERFLOW-75 — searching an Order ID redirects to its detail.
    it(title('Searching an Order ID redirects to its Order History detail (CO-HDR-02 · TC-75) — PENDING'));
  });
});
