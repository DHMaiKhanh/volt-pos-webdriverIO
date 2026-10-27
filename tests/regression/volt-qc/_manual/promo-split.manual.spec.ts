/**
 * volt-qc 04 PROMO / 05 SPLIT — cases that cannot be automated on this POS lane.
 *
 * TC catalogue: docs/qc/volt-qc/windows-regression/04-khuyen-mai-diem-giftcard.md and
 * 05-split-order.md. Every `it.skip` below is a MANUAL test case kept here so the
 * coverage report (`npx tsx scripts/volt-qc-coverage.ts`) counts it as manual
 * rather than missing. The comment above each one says why it is manual: it needs
 * Portal configuration (promotions, rewards, point rates, fee/tax, products), a
 * network cut, a second POS, a payment terminal / printer / scanner, an app
 * restart, an overnight settle, or a feature that is not shipped on this build.
 *
 * Automated PROMO / SPLIT cases live in tests/regression/volt-qc/promo-split/*.spec.ts
 * (and the read-only Sell Gift Card cases in tests/regression/volt-qc/pos/promo.spec.ts).
 */

import { Tag, title } from '../../../../src/types/testTags.js';

describe('volt-qc 04 PROMO / 05 SPLIT — manual cases', () => {
  /* ---------------- Portal: preset promotions ---------------- */

  // Network cut before opening the dialog.
  it.skip(
    title(
      '[MANUAL] Promotions fail to load offline: toast, "No promotions available", Custom Discount still works (PROMO-006)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: an Active 10% promotion for the customer's group.
  it.skip(
    title('[MANUAL] Apply a preset % promotion to every service (PROMO-007)', Tag.REGRESSION),
    () => {},
  );
  // Portal: an Active $5 promotion.
  it.skip(
    title('[MANUAL] A fixed $ preset promotion takes off exactly its amount (PROMO-008)', Tag.REGRESSION),
    () => {},
  );
  // Portal: ≥ 2 Active promotions for the test customer.
  it.skip(
    title('[MANUAL] One promotion per order: picking a 2nd unselects the 1st (PROMO-009)', Tag.REGRESSION),
    () => {},
  );
  // Portal: preset promotions.
  it.skip(
    title(
      '[MANUAL] Custom Discount and a preset promotion are mutually exclusive (PROMO-010)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: two preset promotions.
  it.skip(
    title('[MANUAL] Switch the applied promotion before payment (PROMO-011)', Tag.REGRESSION),
    () => {},
  );
  // Portal: a preset promotion to remove.
  it.skip(
    title('[MANUAL] Remove an applied promotion: untick → Apply (PROMO-012)', Tag.REGRESSION),
    () => {},
  );
  // Portal: an expired / Inactive promotion.
  it.skip(
    title('[MANUAL] Expired or Inactive promotions do not show on POS (PROMO-013)', Tag.REGRESSION),
    () => {},
  );
  // Portal: a promotion targeted at a customer group + customers in / out of it.
  it.skip(
    title(
      '[MANUAL] A group-targeted promotion shows only for customers of that group (PROMO-014)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: a one-time-use promotion already used by the customer.
  it.skip(
    title(
      '[MANUAL] A one-time-use promotion does not reappear for the same customer (PROMO-015)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal promotion + Discount Setting 40/60 (store-wide setting shared with other lanes).
  it.skip(
    title(
      '[MANUAL] A preset promotion shows the store Owner/Staff split, locked (VP-3533) (PROMO-016)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal promotion + Discount Setting 40/60.
  it.skip(
    title(
      '[MANUAL] After a 40/60 preset, switching to Custom Discount resets the split to 100/0 (VP-3533) (PROMO-017)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- Portal: rewards / discount charge ---------------- */

  // Portal reward + a customer with enough points.
  it.skip(
    title(
      '[MANUAL] Custom $15 + fixed $15 reward on $20 is capped at $20 (VP-4375) (PROMO-035)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs item discount + promotion + reward on one order (Portal reward).
  it.skip(
    title(
      '[MANUAL] Checkout groups item / promotion / reward under "Total Discount" (PROMO-045)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: a retail product (Store line) in the catalogue.
  it.skip(
    title(
      '[MANUAL] Discount Charge counts service lines only, not products (VP-3436) (PROMO-057)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal promotion + changing the store Discount Setting.
  it.skip(
    title('[MANUAL] A new Discount Setting applies to new orders only (VP-3596) (PROMO-059)', Tag.REGRESSION),
    () => {},
  );
  // Portal reward.
  it.skip(title('[MANUAL] A reward charges nothing to the staff (PROMO-060)', Tag.REGRESSION), () => {});
  // Portal reward + customer with ≥ 500 points.
  it.skip(
    title('[MANUAL] A customer with enough points sees the reward (VP-4335) (PROMO-062)', Tag.REGRESSION),
    () => {},
  );
  // Portal reward + customer below the threshold.
  it.skip(
    title('[MANUAL] A customer without enough points does not see the reward (PROMO-063)', Tag.REGRESSION),
    () => {},
  );
  // Portal reward.
  it.skip(title('[MANUAL] Apply a fixed $10 reward (PROMO-064)', Tag.REGRESSION), () => {});
  // Portal reward + points ledger.
  it.skip(
    title(
      '[MANUAL] Completing a reward order deducts its points and earns on the amount paid (PROMO-065)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal promotion + reward.
  it.skip(title('[MANUAL] A promotion and a reward together (PROMO-066)', Tag.REGRESSION), () => {});
  // Portal reward.
  it.skip(title('[MANUAL] Untick a reward → Apply removes it (PROMO-067)', Tag.REGRESSION), () => {});
  // Portal/DTS: edit a reward value and wait for sync.
  it.skip(
    title(
      '[MANUAL] A reward created at $0 then edited to $50 discounts $50 (VP-3974) (PROMO-068)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: change the reward type and wait for sync.
  it.skip(
    title(
      '[MANUAL] Changing a reward $10 OFF → 10% OFF on Portal is picked up by POS (VP-3302) (PROMO-069)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // GoCheckin: an imported customer with points.
  it.skip(
    title(
      '[MANUAL] GoCheckin points (incl. imported customers) sync to POS and unlock rewards (VP-3038) (PROMO-070)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Refund of a SETTLED reward order (overnight settle + Portal reward).
  it.skip(
    title('[MANUAL] Refunding a reward order does not return the reward points (PROMO-071)', Tag.REGRESSION),
    () => {},
  );

  /* ---------------- Portal: fee / tax / point configuration ---------------- */

  // Portal: SF 5% + Tax 10% + gift-card SF toggle off (store-wide config).
  it.skip(
    title(
      '[MANUAL] Promotion on an order with 2 × $105 gift cards keeps each card at $105 (VP-4160) (PROMO-073)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: Tax 10% + Other point rate $1.00.
  it.skip(
    title(
      '[MANUAL] Tax is part of the points base; gift-card sales are excluded (VP-4171) (PROMO-081)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal reward + Other point rate $1.00.
  it.skip(title('[MANUAL] A reward lowers the points base (VP-3981) (PROMO-085)', Tag.REGRESSION), () => {});
  // Payment terminal (decline then approve).
  it.skip(
    title(
      '[MANUAL] Card declined then Try Again approved: points earned once (VP-4377) (PROMO-087)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Payment terminal (decline, X, card again).
  it.skip(
    title(
      '[MANUAL] Card declined → X → card again approved: points earned once (VP-4377) (PROMO-088)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: set a method's point rate to $0.00.
  it.skip(
    title(
      '[MANUAL] A method with a 0 point rate earns 0 points without an error (VP-3984) (PROMO-090)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- Re-open editing (locked on this build) ---------------- */

  // Re-open of a paid order locks prices and the customer field on build 1.1.56 (Edit Order disabled).
  it.skip(
    title(
      '[MANUAL] Re-open, raise the amount, complete: old points revoked, new total earned (VP-3200) (PROMO-094)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Re-open customer change is locked on build 1.1.56.
  it.skip(
    title('[MANUAL] Re-open switching customer A → B moves the points (VP-3598) (PROMO-095)', Tag.REGRESSION),
    () => {},
  );
  // Re-open customer removal is locked on build 1.1.56.
  it.skip(
    title('[MANUAL] Re-open removing the customer revokes the points (VP-4085) (PROMO-096)', Tag.REGRESSION),
    () => {},
  );
  // Needs a Confirmed appointment with a customer today (booking / Portal), points from GoCheckin.
  it.skip(
    title(
      '[MANUAL] Checkout from an appointment keeps the customer and earns points + visit (VP-4135) (PROMO-101)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- Cashback (not shipped) ---------------- */

  // Cashback is not shipped on this build.
  it.skip(
    title('[MANUAL] Earn 10% cashback on $100 + $15 tip → $10.00 (PROMO-103)', Tag.REGRESSION),
    () => {},
  );
  // Cashback is not shipped.
  it.skip(
    title('[MANUAL] Cashback redemption outside Min / Max is refused (PROMO-104)', Tag.REGRESSION),
    () => {},
  );
  // Cashback is not shipped.
  it.skip(title('[MANUAL] Reward and Cashback cannot be combined (PROMO-105)', Tag.REGRESSION), () => {});
  // Cashback is not shipped; also a refund of a settled order.
  it.skip(
    title(
      '[MANUAL] Full refund reverses earned cashback and restores redeemed cashback (VP-1171) (PROMO-106)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- Gift card: hardware / network / restart / Portal ---------------- */

  // Barcode scanner / camera + a QR gift card.
  it.skip(
    title(
      '[MANUAL] Scanning a card code on Sell Gift Card fills it, repeatedly (VP-2935) (PROMO-132)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Network cut.
  it.skip(title('[MANUAL] Selling a card offline queues the top-up (PROMO-139)', Tag.REGRESSION), () => {});
  // Network cut exactly while pressing Pay.
  it.skip(
    title('[MANUAL] A failed redeem rolls its transaction back (VP-3565) (PROMO-149)', Tag.REGRESSION),
    () => {},
  );
  // Network cut on checkout.
  it.skip(
    title(
      '[MANUAL] Offline: Gift Card cannot be selected / "Oops... Disconnected" (PROMO-150)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Receipt printer.
  it.skip(
    title(
      '[MANUAL] The receipt prints the gift-card balance line, $0.00 included (VP-4176) (PROMO-152)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // App restart with an unpaid gift-card line.
  it.skip(
    title(
      '[MANUAL] After an app restart the unpaid gift-card line is still editable and tops the card up (PROMO-178)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Refund of a gift-card sale SETTLED on a previous day (overnight settle).
  it.skip(
    title(
      '[MANUAL] Refunding a settled gift-card sale (Cash): is the card balance reversed? (PROMO-183)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal Gift Card Management web.
  it.skip(
    title('[MANUAL] Card code, status, balance and history on Portal match POS (PROMO-186)', Tag.REGRESSION),
    () => {},
  );
  // Network cut + restore.
  it.skip(
    title(
      '[MANUAL] Sell a new card offline: Cash only, top-up pending, syncs Active when online (VP-1261) (PROMO-187)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Network cut + restore.
  it.skip(
    title(
      '[MANUAL] Top up an Active card offline: balance rises once after sync (VP-1261) (PROMO-188)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Network cut.
  it.skip(
    title(
      '[MANUAL] An offline gift-card sale can only be paid in Cash (VP-1261) (PROMO-189)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Network cut.
  it.skip(
    title(
      '[MANUAL] Completing an offline gift-card sale shows the queued dialog that needs OK (VP-1261) (PROMO-190)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app data folder inspected with dev help (encryption at rest).
  it.skip(
    title(
      '[MANUAL] Gift-card data stored on the device is not plain text (VP-1261) (PROMO-191)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Flaky network during sync.
  it.skip(
    title(
      '[MANUAL] A flaky network during sync neither loses nor doubles a top-up (VP-1261) (PROMO-192)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Network cut with several queued top-ups.
  it.skip(
    title('[MANUAL] Several offline top-ups each sync exactly once (VP-1261) (PROMO-193)', Tag.REGRESSION),
    () => {},
  );

  /* ---------------- SPLIT: Portal config ---------------- */

  // Portal: change the gift-card SF toggle after an order was paid (store-wide).
  it.skip(
    title(
      '[MANUAL] Split lock for gift-card orders follows the order snapshot, not the current config (VP-4077) (SPLIT-008)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: SF 3% fixture (PC-SP $100 → Card $103.00).
  it.skip(
    title(
      '[MANUAL] By Amount: a Cash check is entered at the cash price, Card checks on the Card base (SPLIT-028)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: a retail product with Product Tax.
  it.skip(
    title(
      '[MANUAL] By Items: product tax lands only on the check holding the product (VP-3334) (SPLIT-035)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: SF 4% + CD 4% + product tax 10%, 2 products × $50.
  it.skip(
    title(
      '[MANUAL] After a Cash check, the footer Total = cash paid + the open check (VP-4405) (SPLIT-069)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal Audit Log.
  it.skip(
    title(
      '[MANUAL] Audit Log records Complete / void / refund / partial refund of a split order (SPLIT-126)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- SPLIT: terminal / printer ---------------- */

  // Payment terminal in semi mode.
  it.skip(
    title('[MANUAL] Terminal in semi mode: Check 1 + Card enables Pay (VP-4084) (SPLIT-043)', Tag.REGRESSION),
    () => {},
  );
  // Payment terminal unplugged near the timeout + gateway reconciliation.
  it.skip(
    title(
      '[MANUAL] Terminal cut near timeout on a Card check: POS and gateway agree, no extra charge (VP-4287) (SPLIT-044)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Receipt printer + "Auto-print customer receipt after each split check".
  it.skip(
    title(
      '[MANUAL] Auto-print a receipt after each split check and skip the receipt screen (SPLIT-052)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- SPLIT: not reachable on DEV / restart / settle ---------------- */

  // DEV blocks partial gift-card redemption inside Split (VP-3788), so the carried-over tip cannot be produced.
  it.skip(
    title(
      '[MANUAL] The tip of a short gift-card check moves to the new check as tip (VP-3788) (SPLIT-057)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // App restart after paying one check.
  it.skip(
    title(
      '[MANUAL] Closing the app after one paid check: reopens Processing, Pay locked, Split resumes (SPLIT-066)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Split order SETTLED (next day) → refund.
  it.skip(
    title('[MANUAL] A settled split order supports full refund only (SPLIT-091)', Tag.REGRESSION),
    () => {},
  );
  // Split order SETTLED (next day) → full refund + reports.
  it.skip(
    title(
      '[MANUAL] Full refund of a settled Cash + Other split with tips refunds every check (SPLIT-123)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Settled split with a Card check (terminal) → partial refund per check.
  it.skip(
    title(
      '[MANUAL] Partial refund per check of a settled split, tip rules per method (SPLIT-124)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- SPLIT: network / second POS ---------------- */

  // Network cut on the split screen (volt-qc net proxy is not ported).
  it.skip(
    title(
      '[MANUAL] Offline on the split screen: Other / Gift Card / Card locked, Cash still pays (SPLIT-094)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Second POS on the same merchant.
  it.skip(
    title(
      '[MANUAL] An order being split on device A cannot be opened on device B (SPLIT-095)',
      Tag.REGRESSION,
    ),
    () => {},
  );
});
