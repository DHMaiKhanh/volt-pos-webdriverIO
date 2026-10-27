/**
 * volt-qc 03 PAY — cases that cannot be automated on this POS lane.
 *
 * TC catalogue: docs/qc/volt-qc/windows-regression/03-checkout-thanh-toan.md.
 * Every `it.skip` below is a MANUAL test case kept here so the coverage report
 * (`npx tsx scripts/volt-qc-coverage.ts`) counts it as manual rather than
 * missing. The comment above each one says why it is manual: it needs a payment
 * terminal, a printer / cash drawer / scanner, a network cut, a second POS, a
 * Portal configuration change, or a store-wide setting that would break the
 * other lanes sharing this till.
 *
 * Automated PAY cases live in tests/regression/volt-qc/pay/*.spec.ts.
 */

import { Tag, title } from '../../../../src/types/testTags.js';

describe('volt-qc 03 PAY — manual cases', () => {
  /* --------------------------- Network cut ---------------------------- */

  // Network cut: needs the till's network dropped mid-flow and restored.
  it.skip(
    title('[MANUAL] Cash payment works offline and syncs when the network returns (PAY-030)', Tag.REGRESSION),
    () => {},
  );
  // Network cut.
  it.skip(title('[MANUAL] Gift Card cannot be used while offline (PAY-052)', Tag.REGRESSION), () => {});
  // Network cut during a void.
  it.skip(
    title(
      '[MANUAL] A void that fails offline shows an error and keeps the transactions (PAY-158)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Network cut.
  it.skip(
    title(
      '[MANUAL] Card / Gift Card / Other while offline show the "Disconnected" dialog (PAY-159)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Network cut.
  it.skip(
    title(
      '[MANUAL] "Pay with cash" from the Disconnected dialog switches to Cash and completes offline (PAY-160)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Network cut + restore.
  it.skip(
    title(
      '[MANUAL] Back online → Try Again closes the Disconnected dialog and keeps the method (PAY-161)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Network cut right after Complete Payment.
  it.skip(
    title(
      '[MANUAL] Network lost right after Complete Payment (Other) does not duplicate the transaction on retry (PAY-162)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Network cut during a card charge + terminal.
  it.skip(
    title(
      '[MANUAL] Network lost during a card charge: retry online detects the existing charge and blocks Back (PAY-163)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* --------------------------- Second POS ----------------------------- */

  // Needs a second POS on the same merchant.
  it.skip(
    title(
      '[MANUAL] An order paid on another device while this one sits on checkout is not charged twice (PAY-164)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a second POS holding the order.
  it.skip(
    title('[MANUAL] An order held by another device cannot be opened for payment (PAY-165)', Tag.REGRESSION),
    () => {},
  );

  /* ----------------------- Payment terminal (card) -------------------- */

  // Needs an interrupted card completion on a real terminal (not prod-safe).
  it.skip(
    title(
      '[MANUAL] An order already fully charged after an interrupted completion shows Complete Done (PAY-054)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Terminal decline.
  it.skip(
    title('[MANUAL] A declined card shows an error and leaves the order unpaid (PAY-140)', Tag.REGRESSION),
    () => {},
  );
  // Terminal decline → retry.
  it.skip(
    title(
      '[MANUAL] Decline → Try Again → approved counts one successful transaction (PAY-141)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Terminal timeout.
  it.skip(
    title('[MANUAL] Timeout then retry does not create a second charge (PAY-142)', Tag.REGRESSION),
    () => {},
  );
  // Terminal: close the Present Card / error popup with X.
  it.skip(
    title(
      '[MANUAL] Closing the card error popup with X cancels the terminal session (PAY-143)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Terminal unplugged near the timeout.
  it.skip(
    title(
      '[MANUAL] Terminal disconnected near timeout leaves POS and gateway in sync (PAY-144)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Terminal + killing the app mid-charge.
  it.skip(
    title(
      '[MANUAL] App killed while waiting for the card leaves no "Card – Processing" transaction (PAY-145)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Terminal, 60–90 s idle charge.
  it.skip(
    title(
      '[MANUAL] A charge after 60–90 s with no gateway transaction is still approved (PAY-146)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Gateway double-charge response needs a real terminal + gateway.
  it.skip(
    title(
      '[MANUAL] "Recently charged" gateway reply shows the Possible Double Charge popup (PAY-148)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Gateway "unknown" outcome needs network fault injection + terminal.
  it.skip(
    title(
      '[MANUAL] An "unknown" result after 5 polls shows as Declined with Try Again (PAY-149)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* --------------------- Printer / drawer / scanner ------------------- */

  // Hardware: barcode scanner.
  it.skip(
    title(
      '[MANUAL] Scanning a gift card with the scanner works every time, second order included (PAY-050)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Hardware: receipt printer.
  it.skip(
    title('[MANUAL] Print in receipt then moves on like No Receipt (PAY-120)', Tag.REGRESSION),
    () => {},
  );
  // Hardware: receipt printer + auto-print setting.
  it.skip(
    title(
      '[MANUAL] Auto-print on completion prints on arrival and hides Print on the customer display (PAY-127)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Hardware: cash drawer.
  it.skip(
    title('[MANUAL] Cash Drawer asks for the passcode then opens the drawer (PAY-132)', Tag.REGRESSION),
    () => {},
  );
  // Printer/drawer state must be verified physically (a connected printer changes the outcome).
  it.skip(
    title(
      '[MANUAL] Completing Cash with no printer still succeeds and only reports the drawer error (PAY-136)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ------------------------ Receipt delivery -------------------------- */

  // Sends a real SMS (not prod-safe); delivery is verified on a phone.
  it.skip(title('[MANUAL] Sending the receipt by SMS succeeds (PAY-123)', Tag.REGRESSION), () => {});
  // Sends a real e-mail; delivery is verified in a mailbox.
  it.skip(title('[MANUAL] Sending the receipt by Email succeeds (PAY-125)', Tag.REGRESSION), () => {});
  // Sends a real SMS from the customer display.
  it.skip(
    title(
      '[MANUAL] The customer types their own phone for the receipt on the display (PAY-126)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* -------------------- Portal / store configuration ------------------ */

  // Portal: needs a fixed SF 2.5% fixture.
  it.skip(
    title('[MANUAL] Ticket example: Service $75, SF 2.5%, Tip $15 ⇒ $91.88 (PAY-067)', Tag.REGRESSION),
    () => {},
  );
  // Portal: needs SF 4% + CD 4%.
  it.skip(
    title(
      '[MANUAL] Standard example: items $100, SF 4%, CD 4% ⇒ Card $104.00, Cash/Other/Gift Card $100.00 (PAY-082)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: needs SF 5% + tax 10%.
  it.skip(
    title(
      '[MANUAL] SF on net, tax on net + SF: $100, SF 5%, tax 10% ⇒ Card $115.50, Cash $110.00 (PAY-083)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: needs SF 5% + tax 10%.
  it.skip(
    title(
      '[MANUAL] 2 × $100 by Card, SF 5%, tax 10% ⇒ Subtotal $210, Tax $21, Total $231 (PAY-084)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: needs a fixed SF/CD and odd-cent catalogue items.
  it.skip(
    title(
      '[MANUAL] SF/CD rounding over several odd-cent items lands on whole cents for Card and Cash (PAY-085)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: needs SF 10% and the $5 / $17 fixture services.
  it.skip(
    title(
      '[MANUAL] Service Fee doc example: S1 $5 (−10%), S2 $17 (−50%), SF 10% ⇒ fee $1.30 (PAY-087)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: needs a fixed SF to read the fee base of a 100%-off line.
  it.skip(
    title('[MANUAL] A 100%-discounted item adds nothing to the fee base (PAY-088)', Tag.REGRESSION),
    () => {},
  );
  // Portal: needs SF 5% fixture.
  it.skip(
    title(
      '[MANUAL] Ticket example: Service $100 + Gift Card $50, SF 5% ⇒ SF $5.00 (PAY-091)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal toggle "Apply Service Fee to Gift Card" = ON.
  it.skip(
    title(
      '[MANUAL] With Apply Service Fee to Gift Card ON, gift card sales carry SF/CD (PAY-093)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Re-open Edit Order is locked on build 1.1.56 + needs a fee config.
  it.skip(
    title(
      '[MANUAL] Re-open a Cash order, add a service, pay Cash: no SF, correct tax (PAY-094)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Re-open Edit Order is locked on build 1.1.56 + needs SF 5% / tax 10%.
  it.skip(
    title(
      '[MANUAL] Re-open Cash (2×$100) + $100, switch to Card ⇒ Enter Amount $115.50 (PAY-095)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: Product Tax + a "Supply Sale" product.
  it.skip(
    title('[MANUAL] Product Tax applies to products, Supply Sale included (PAY-097)', Tag.REGRESSION),
    () => {},
  );
  // Portal: Service Tax + Product Tax both set.
  it.skip(
    title(
      '[MANUAL] Service Tax + Product Tax merge into one Tax row on checkout and customer display (PAY-098)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: tax 10% + six $0.15 catalogue lines.
  it.skip(
    title(
      '[MANUAL] Per-line tax allocation never goes negative: 6 × $0.15 at 10% ⇒ Cash $0.99 (PAY-099)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Portal: variant price sets.
  it.skip(
    title('[MANUAL] Variant price sets still produce correct, non-negative tax (PAY-100)', Tag.REGRESSION),
    () => {},
  );
  // Portal: SF 4%, CD 3.5%, tax 8.25% + a $19.00 product.
  it.skip(
    title(
      '[MANUAL] 1-cent fixture: SF 4%, CD 3.5%, tax 8.25%, product $19.00 by Cash ⇒ Tax $1.58 / Total $20.67 (PAY-101)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Sign-out / sign-in is a QR login on this device.
  it.skip(
    title('[MANUAL] Tax still applies after sign-out / sign-in and after sync (PAY-102)', Tag.REGRESSION),
    () => {},
  );
  // Tip Settings (store-wide, synced from Portal) must exclude a method.
  it.skip(
    title(
      '[MANUAL] A method left out of Tip Settings gets tip 0 and a disabled Tip button (PAY-063)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a Store-only line beside the staff block + Remove Staff; the Remove Staff flow has no reliable hooks on 1.1.x.
  it.skip(
    title(
      '[MANUAL] Removing every staff from a tipped order warns "Tip Not Available" and drops the tip (PAY-064)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Tip Settings type Amount (store-wide).
  it.skip(
    title(
      '[MANUAL] Tip type Amount shows fixed-amount presets and no "Tip based on total" (PAY-072)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Tip Settings must exclude the method (store-wide).
  it.skip(
    title(
      '[MANUAL] A method not allowed to tip does not push the tip screen and completes at once (PAY-079)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ------------------- Roles / passcode gates (shared) ---------------- */

  // Needs a staff code whose role lacks "Completed Payment".
  it.skip(
    title('[MANUAL] A role without Completed Payment is refused at the passcode (PAY-110)', Tag.REGRESSION),
    () => {},
  );
  // Turning the Complete Order gate off changes the shared till for every lane.
  it.skip(
    title('[MANUAL] With the Complete Order gate off no passcode is asked (PAY-114)', Tag.REGRESSION),
    () => {},
  );
  // Needs a staff code whose role lacks "Open Cash Drawer".
  it.skip(title('[MANUAL] A role without Open Cash Drawer is refused (PAY-134)', Tag.REGRESSION), () => {});
  // Turning the Open Cash Drawer gate off changes the shared till.
  it.skip(
    title(
      '[MANUAL] With the Open Cash Drawer gate off the drawer opens without a passcode (PAY-135)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a staff code whose role lacks "Cancel Order".
  it.skip(
    title('[MANUAL] A role without Cancel Order (Void) cannot void (PAY-157)', Tag.REGRESSION),
    () => {},
  );

  /* ------------------------- Re-open with edits ----------------------- */

  // Re-open Edit Order (items/prices) is locked on build 1.1.56 — no money change can be made.
  it.skip(
    title(
      '[MANUAL] Re-open + edit a paid order: checkout requires voiding the old transactions first (PAY-154)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Same lock: the Void Order Transactions dialog never appears.
  it.skip(
    title('[MANUAL] Void All voids every transaction after confirmation (PAY-155)', Tag.REGRESSION),
    () => {},
  );
  // Same lock.
  it.skip(
    title('[MANUAL] Back to Order closes the void dialog without voiding (PAY-156)', Tag.REGRESSION),
    () => {},
  );

  /* ---------------------- Language / display size --------------------- */

  // Switching the till to Vietnamese is a device setting shared by every lane.
  it.skip(title('[MANUAL] VI: the checkout header is fully translated (PAY-166)', Tag.REGRESSION), () => {});
  // Same device-language switch.
  it.skip(
    title(
      '[MANUAL] VI: success-screen Cash line, Tip and receipt buttons are translated (PAY-167)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Same device-language switch.
  it.skip(
    title(
      '[MANUAL] VI: gift card insufficient-balance popup and block message are translated (PAY-168)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Same device-language switch, on the customer display.
  it.skip(
    title('[MANUAL] VI: the customer tip screen is fully translated (PAY-169)', Tag.REGRESSION),
    () => {},
  );
  // Needs a physical 1920×1080 display (WebDriver cannot emulate device metrics on the Tauri window).
  it.skip(
    title(
      '[MANUAL] At 1920×1080 every method shows Total Paid / Remaining / Change without scrolling (PAY-170)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Same 1920×1080 display requirement.
  it.skip(
    title(
      '[MANUAL] Total Paid / Change / Remaining labels are bold black, amounts keep their colour (PAY-171)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Same 1920 px display requirement.
  it.skip(
    title(
      '[MANUAL] At 1920 px the success-screen tip line (staff + amount) fits on one line (PAY-172)',
      Tag.REGRESSION,
    ),
    () => {},
  );
});
