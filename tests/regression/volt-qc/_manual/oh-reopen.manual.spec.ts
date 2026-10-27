/**
 * volt-qc 07 ORDER HISTORY (OH-*) / 17 RE-OPEN (RO-*) — cases this lane cannot automate.
 *
 * Each is a Mocha pending test so the catalogue row has a home and the coverage report lists it as
 * MANUAL, not missing. The comment on each says what it needs that a single Windows till under
 * WebDriver does not have: a second POS / device, a printer or cash drawer, a card terminal or the
 * gateway, the Portal web, a network cut, or an order settled by the next-day batch.
 *
 * Automated OH/RO coverage lives in ../oh-reopen/*.spec.ts and ../pos/{order-history,reopen}.spec.ts.
 */

import { Tag, title } from '../../../../src/types/testTags.js';

describe('volt-qc 07 ORDER HISTORY / 17 RE-OPEN — manual', () => {
  /* ---------------- second POS / other device ---------------- */
  // Needs a second POS (or Portal) completing the order while this till watches the list.
  it.skip(
    title(
      '[MANUAL] An order completed on another device / Portal appears after sync without reload (OH-021)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Two tills: A completes, B still holds the old Pending copy and must not push it back.
  it.skip(
    title(
      '[MANUAL] An order completed on device A is not pushed back to Pending by device B (OH-086)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the server / Portal record to compare against after sync.
  it.skip(
    title('[MANUAL] Order status on POS matches server / Portal after sync (OH-088)', Tag.REGRESSION),
    () => {},
  );
  // Another device / Portal must change the order while the Cancel / Refund dialog is open here.
  it.skip(
    title(
      '[MANUAL] Order changed elsewhere while the dialog is open → server rejects with an error toast (OH-129)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Another device edits the order shown in the detail pane.
  it.skip(
    title(
      '[MANUAL] Another device changing the open order refreshes the detail after sync (OH-210)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // FBP / P8D Android devices.
  it.skip(
    title('[MANUAL] Tip adjusted on FBP syncs tip and new total back to POS (OH-197)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] A card order completed on P8D still offers Adjust Tip on Windows (OH-198)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      "[MANUAL] Windows reopen of an order paid on P8D, dropping / swapping the customer, takes back A's points (RO-064)",
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- Portal web ---------------- */
  // GoCheckin web check-in (cross-surface web lane) creates the order.
  it.skip(
    title(
      '[MANUAL] A GoCheckin check-in order keeps its customer in Order History after payment (OH-083)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title('[MANUAL] Voiding an order in Portal shows Canceled on POS after sync (OH-127)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title('[MANUAL] A refund done in Portal shows the same status and txns on POS (OH-153)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Support switching Cash → Other in Portal is reflected in POS Order History (OH-181)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Portal: Edit Order disabled for Re-opened, Pending, Canceled orders (RO-071)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Portal locks Edit Order while Re-open and unlocks after Re-Open Done (RO-133)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Merchant rates / toggles are Portal config (fixed SF 5% / tax 10%, gift-card SF toggle, CD%).
  it.skip(
    title(
      '[MANUAL] Reopen + $100 service on SF 5% / tax 10% → Card $115.50 / Cash $110.00 / Other $110.00 (OH-168)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Reopen + $62 paid Cash without SF → tax $6.20 → $68.20; Card 2×$100 split (OH-169)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Recompute follows the gift-card SF toggle saved at sale, not the current setting (RO-070)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      "[MANUAL] Changing the merchant CD% after the sale: the Cash difference still uses the order's saved CD% (RO-307)",
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Payroll / income-staff period must be closed in Portal first.
  it.skip(
    title('[MANUAL] An order in a closed income-staff period cannot be re-opened (RO-111)', Tag.REGRESSION),
    () => {},
  );

  /* ---------------- printer / scanner / cash drawer ---------------- */
  it.skip(
    title(
      '[MANUAL] Hardware QR scanner on Order History leaves no "ODER:" or stray characters (OH-036)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Scanning with the Vietnamese IME (Unikey) on still opens the order, no "ÖÖDERORDER:" (OH-042)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title('[MANUAL] Print with a printer connected prints the right receipt (OH-093)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title('[MANUAL] Auto-print cancel/refund receipts prints the cancel receipt (OH-128)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Paying the difference in Cash opens the cash drawer; Cash Drawer in reopen still asks (RO-305)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- real SMS / email delivery ---------------- */
  // Needs an inbox / handset the run can read; sends a real message.
  it.skip(
    title('[MANUAL] Sending the receipt SMS to a valid number shows success (OH-096)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title('[MANUAL] Sending the receipt email shows success, address lower-cased (OH-098)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] The receipt link in the SMS opens the full receipt page, no DNS error (OH-101)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- network cut ---------------- */
  it.skip(
    title('[MANUAL] Offline hides Adjust Tip; back online shows it (OH-110)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title('[MANUAL] Losing the network on Save shows an error and keeps the tip (OH-199)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Cancel / refund shows Canceling / Refunding first, then the final status (offline card void) (OH-209)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Offline, reopen with a higher total: only Cash can pay; Card / Gift Card / Other locked (RO-091)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Offline, reopen with a lower total: void is queued as canceling and pushed when online (RO-092)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Offline: Cash is the only tender for the difference; stored locally, pushed later (RO-309)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Offline: the Gift Card tab is locked when paying the difference (RO-407)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title('[MANUAL] Offline: the Other tab is locked when paying the difference (RO-508)', Tag.REGRESSION),
    () => {},
  );

  /* ---------------- card terminal / gateway ---------------- */
  it.skip(
    title(
      '[MANUAL] A Cancel Issue order retries the void on Cancel Order (needs a gateway void failure) (OH-125)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Refunding a batch-closed Card order goes through the gateway; partial excludes tip (OH-147)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Settled order still holding an un-batched Card txn shows Refund Not Available (OH-148)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title('[MANUAL] Gateway-rejected card tip: resend must be > $0.00 (OH-195)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Card original with gift-card top-up + service, reopen + service: Cash/Other = Card / (1 + SF) (RO-081)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Extra Card charge with a customer-display tip: tip on the new part only (RO-083)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title('[MANUAL] Void-all voids only successful txns, skips failed / processing (RO-087)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Split Cash + Card (signature skipped), reopen → Pay: no re-sign (RO-090)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Card difference cancelled / declined: no new txn, order stays Re-open (RO-095)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Gift Card original, difference by Card: gift-card balance untouched (RO-204)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] signatureTiming BEFORE: extra Card charge shows Add Tip & Signature, tip on the new part (RO-205)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title('[MANUAL] signatureTiming AFTER: customer signs after approval (RO-206)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Card removed from Tip Method: extra Card charge pushes no tip screen (RO-207)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title('[MANUAL] First card decline, second approve: one successful Card txn (RO-209)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] After a Card difference (2 Card txns) Adjust Tip picks the right txn (RO-210)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Card difference: Card income up by the difference, points follow (RO-214)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Card + Cash paid, reopen + service by Card: SF only on the new charge (RO-215)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Customer display check-in during reopen (dual-screen launch lane, real phone entry).
  it.skip(
    title(
      '[MANUAL] Reopened walk-in order: a new phone checked in on the customer screen does not hang POS (RO-055)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- merchant data / build this device does not have ---------------- */
  // Needs a gift card whose balance already dropped below the top-up being cancelled; the POS cannot create
  // cards by code and the standing card always covers its own top-up.
  it.skip(
    title(
      '[MANUAL] Cancelling a gift-card sale/top-up the card can no longer cover → "Unable to Cancel Order" (OH-121)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Edit Order (doc "Edit Completed Order") is locked on 1.1.56 — only the Re-Open path is live on this device.
  it.skip(
    title(
      '[MANUAL] Edit Order: move one service to another staff, confirm popup, total unchanged, Staff Income follows (OH-180)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Merchant 14 has no promotion / reward rule that applies at the till, and cashback is off (Portal config).
  it.skip(
    title(
      '[MANUAL] Order with a promotion / reward: reopen locks money edits, no apply / change of promo (RO-105)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title('[MANUAL] Order with cashback redeem / earn: reopen only edits non-money (RO-106)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Cashback redeem / earn: reopen does not double-count; closing recomputes earn (RO-134)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs an order written by an old app build (no saved taxPercent) or a tax-exempt legacy order.
  it.skip(
    title(
      '[MANUAL] Legacy order without taxPercent is not taxed at 0 on reopen; tax-exempt order stays exempt (RO-109)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---------------- next-day batch settle ---------------- */
  // Refund needs a Successful - Settled order (day rollover / batch close) that may be refunded for real.
  it.skip(
    title(
      '[MANUAL] An old order refunded today shows in "today" with Sort Last updated (OH-051)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Settled order with nothing left to refund (fully refunded / $0) has no Refund (OH-109)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Cancelling exactly while the batch close runs still ends Canceled, not counted in Staff Income (OH-124)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] On a Partial Refunded order the last item is still PARTIAL, then the order becomes Refunded (OH-139)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Full refund of an order with a tip: refund amount = total incl. tip (OH-141)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] An order-level discount is allocated pro rata when refunding per item (OH-142)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Odd-cent discount allocation: item refunds add up to what was paid (OH-143)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] A refunded order keeps the original item name / price after the service is edited (OH-145)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title('[MANUAL] Refund gate OFF: confirm runs with no passcode (OH-151)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title('[MANUAL] Double-clicking the refund confirm creates one refund (OH-152)', Tag.REGRESSION),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Server refuses a refund on a not-yet-settled order (race) with an error toast (OH-154)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  it.skip(
    title(
      '[MANUAL] Partial Refunded order: refunded services locked, only the rest editable, no toast (OH-179)',
      Tag.REGRESSION,
    ),
    () => {},
  );
});
