/**
 * volt-qc 13 CUSTOMER DISPLAY / 14 E2E — cases the POS lane cannot automate.
 *
 * TC catalogue: docs/qc/volt-qc/windows-regression/13-customer-display.md and
 * 14-e2e-xuyen-suot.md. Automated cases live in tests/regression/volt-qc/cd-e2e/.
 *
 * Every entry is a Mocha PENDING test (`it.skip`) so the id is tracked in the
 * report and in docs/qc/volt-qc/COVERAGE.md. The comment above each says why it
 * needs a human (or a lane this suite does not have): production deploy smoke,
 * a card terminal / printer / cash drawer / GCI scanner, a second POS, Portal or
 * GoCheckin web, cutting the network, killing the app process, real SMS, or data
 * that only exists after an overnight batch close.
 */

import { Tag, title } from '../../../../src/types/testTags.js';

const manual = (summary: string): string => title(`[MANUAL] ${summary}`, Tag.REGRESSION);

describe('volt-qc 13 CUSTOMER DISPLAY — manual', () => {
  // Needs the network cut on the till while the cart is mirrored.
  it.skip(
    manual(
      'Offline → Card / Gift Card / Other tiles dim on the customer display, Cash stays normal (CD-021)',
    ),
    () => {},
  );
  // Needs the dual-screen GCI ticket scanner.
  it.skip(
    manual(
      'Customer scans a GCI ticket + confirms the phone without resetting the order being keyed on main (CD-033)',
    ),
    () => {},
  );
  // Needs Portal › Settings › Configuration › Customer Display to compare / edit (the POS leave-guard half is automated in cd-settings CD-037).
  it.skip(
    manual('Show Point / Show Reward saved on POS match Portal and Portal edits sync back (CD-038)'),
    () => {},
  );
  // Needs a card terminal driving the Insert/Tap → Processing → success / failed / timed-out states.
  it.skip(
    manual(
      'Customer display follows the terminal states: Total Amount, Insert/Tap/Swipe, Processing, success, failed, timed out (CD-056)',
    ),
    () => {},
  );
  // Needs the network cut while Card / Gift Card is selected.
  it.skip(
    manual(
      'Offline during Card / Gift Card → "Oops... Disconnected" on both screens, back to the cart when online (CD-057)',
    ),
    () => {},
  );
  // Needs a receipt printer and the auto-print toggle.
  it.skip(manual('Customer "Print" prints through main; hidden when auto-print is on (CD-064)'), () => {});
  // Sends a real SMS — only with QA's own number and approval.
  it.skip(
    manual('Text Message → Send → "Receipt Sent via SMS Successfully!" + main "Receipt Sent" (CD-067)'),
    () => {},
  );
});

describe('volt-qc 14 E2E — manual', () => {
  // Production deploy smoke: run against the freshly deployed prod build on store 20258.
  it.skip(
    manual('Prod app starts, right version / store 20258 / production build before anything else (E2E-001)'),
    () => {},
  );
  // Production deploy smoke.
  it.skip(
    manual('Prod app frame: header, sidebar, device / network status, no develop-only entries (E2E-002)'),
    () => {},
  );
  // Production deploy smoke (read-only on prod data).
  it.skip(
    manual('Prod Pending + Order History load with the right status labels and full detail blocks (E2E-003)'),
    () => {},
  );
  // Production deploy smoke: the four reports and their add/subtract invariants on live data.
  it.skip(
    manual('Prod: open all 4 reports, cross-check their invariants on existing data (E2E-004)'),
    () => {},
  );
  // Production deploy smoke: read Settings values the later journeys depend on.
  it.skip(manual('Prod: read the Settings the journeys depend on, without saving (E2E-005)'), () => {});
  // Needs the GoCheckin kiosk (gap.gocheckin.net) check-in — the cross-surface web lane, not the app lane.
  it.skip(
    manual('One GoCheckin check-in creates exactly one pending order on POS within seconds (E2E-006)'),
    () => {},
  );
  // Depends on the E2E-006 GoCheckin order.
  it.skip(manual('Finish the E2E-006 check-in order by Other and book the right points (E2E-008)'), () => {});
  // Needs a GoCheckin check-in of an existing customer.
  it.skip(
    manual('Returning customer: GoCheckin → pending → staff/services → Cash → points → reports (E2E-011)'),
    () => {},
  );
  // Needs a GoCheckin check-in (volt-qc E2E-T03 drives the kiosk with its `gci` fixture).
  it.skip(
    manual(
      'Returning customer via GoCheckin paid by a named Other tender: Other points, "Others" in reports (E2E-012)',
    ),
    () => {},
  );
  // Needs a first-time GoCheckin check-in and Portal to read the created customer.
  it.skip(
    manual('New customer first check-in → Other → created on POS/Portal with points and 1 visit (E2E-013)'),
    () => {},
  );
  // Needs three GoCheckin check-ins.
  it.skip(manual('Three check-ins: paying #1 never hides / renames orders #2, #3 (E2E-014)'), () => {});
  // Needs a pending GoCheckin order for the phone typed on Quick Checkout.
  it.skip(
    manual(
      'Quick Checkout with the phone of a checked-in customer → "Link with pending order?" → one order (E2E-015)',
    ),
    () => {},
  );
  // Needs a Cash order from a PREVIOUS business day that the overnight batch already settled.
  it.skip(
    manual(
      "Full refund of yesterday's settled Cash order → Refunded, refund booked on today's report date (E2E-022)",
    ),
    () => {},
  );
  // Needs a settled 2-service Cash order from a previous day.
  it.skip(
    manual(
      'Partial then remaining refund of a settled 2-service Cash order → Partial Refunded → Refunded (E2E-023)',
    ),
    () => {},
  );
  // Refund half needs a settled order; the Cancel half (double Confirm Cancel) is automated in cd-e2e/e2e-errors.
  it.skip(
    manual(
      'Double-tap Confirm on Refund creates one refund only (Refund half; Cancel half automated) (E2E-025)',
    ),
    () => {},
  );
  // Needs a gift card whose balance is below one check, consumed by the run.
  it.skip(
    manual('Split By Amount with a short gift card: drains it and opens a new check for the rest (E2E-032)'),
    () => {},
  );
  // Needs an unsold ("Not Sold Yet") gift card; the sale consumes it.
  it.skip(
    manual(
      'Sell a $50 gift card by Cash: Active $50, Store line, no points / SF / staff income, Income Summary (E2E-035)',
    ),
    () => {},
  );
  // Needs the GCI / barcode scanner.
  it.skip(
    manual('Scanning a gift card to pay works on two orders in a row; scanning to sell works (E2E-038)'),
    () => {},
  );
  // Needs a ready-made promotion configured with a 40/60 Discount Setting on the store.
  it.skip(
    manual(
      'Existing promotion uses the 40/60 Discount Setting → Discount Charge per staff; Custom Discount override (E2E-039)',
    ),
    () => {},
  );
  // Needs a Confirmed appointment booked beforehand on Portal / GoCheckin (see npm run test:web2pos).
  it.skip(
    manual(
      'Checkout a Confirmed appointment → pre-filled order → paid → appointment Done with the order code (E2E-042)',
    ),
    () => {},
  );
  // Needs the same pre-booked appointment, checked out twice.
  it.skip(
    manual(
      'Second checkout of an unpaid appointment reopens the same order; deleting it leaves the appointment unchanged (E2E-043)',
    ),
    () => {},
  );
  // Needs a dedicated test staff to clock in/out (never a real staff) and real elapsed hours.
  it.skip(
    manual(
      'Test staff clock in/out → Time Tracking → hourly Staff Income + Payroll for the period (E2E-044)',
    ),
    () => {},
  );
  // Needs the same test staff and edited past days (closed days, cross-day clock-out).
  it.skip(
    manual(
      'Clock-in rules: no double check-in, no overlap, cross-day out, out before in, closed day (E2E-045)',
    ),
    () => {},
  );
  // Needs a second POS on the same store.
  it.skip(
    manual('Order open on device A shows "In Use" on device B; B can open it once A leaves (E2E-051)'),
    () => {},
  );
  // Needs a second POS holding a stale Pending copy.
  it.skip(
    manual('Device A paid, device B taps its stale Pending copy → stays Successful everywhere (E2E-052)'),
    () => {},
  );
  // Needs Portal edits (Discount Setting, customer note, Reward value, Passcode Setting) and sync both ways.
  it.skip(
    manual('Portal ↔ POS sync of Discount Setting, customer note, Reward value, Passcode Setting (E2E-054)'),
    () => {},
  );
  // Needs the network cut mid-payment.
  it.skip(
    manual(
      'Offline mid-payment: only Cash completes, reports warn offline, everything syncs back once online (E2E-055)',
    ),
    () => {},
  );
  // Needs the network dropped exactly on Complete Payment.
  it.skip(
    manual(
      'Network drops on Complete Payment with Other: no half/duplicate transaction, Try Again completes once (E2E-056)',
    ),
    () => {},
  );
  // Needs a card terminal + gateway reconciliation (never on prod).
  it.skip(
    manual(
      'Card charged but POS reports failure: POS reconciles with the gateway, no second charge (E2E-057)',
    ),
    () => {},
  );
  // Needs a card terminal and a declined test card.
  it.skip(
    manual(
      'Declined then approved retry: Successful, Payment Details show the success and the failed attempt (E2E-059)',
    ),
    () => {},
  );
  // Needs a card terminal left to time out.
  it.skip(
    manual('Card wait times out: POS reports failure, nothing charged silently, order unpaid (E2E-060)'),
    () => {},
  );
  // Needs the terminal cable pulled with 1 s left on an approval.
  it.skip(
    manual(
      'Approval at the last second + terminal unplugged: POS and FastboyPay agree (normal and split) (E2E-061)',
    ),
    () => {},
  );
  // Needs the gateway to answer "card just charged at this store" (VP-2214 not shipped).
  it.skip(
    manual('Gateway "possible double charge" → POS asks instead of failing; Cancel sends nothing (E2E-062)'),
    () => {},
  );
  // Needs a receipt printer.
  it.skip(
    manual(
      'Printer: auto-print per order, reprint from history, unplugged → "Printer not connected" but payment completes (E2E-063)',
    ),
    () => {},
  );
  // Needs a cash drawer.
  it.skip(
    manual(
      'Cash drawer: checkout button asks the passcode and opens it; Cash completion opens it without asking (E2E-064)',
    ),
    () => {},
  );
  // Needs the app process killed and relaunched mid-checkout — that ends the WebDriver session of this lane.
  it.skip(
    manual(
      'App killed mid-checkout → order still Pending, no transaction; killed after success → Successful, not paid twice (E2E-065)',
    ),
    () => {},
  );
  // Production safety guard: wrong store on Volt POS / GoCheckin must stop the whole run.
  it.skip(
    manual(
      'Wrong-store guard: not store 20258 "DEV - Volt POS TEST" on POS or GoCheckin → stop, touch nothing (E2E-068)',
    ),
    () => {},
  );
  // Needs the app opened without network / with an expired token.
  it.skip(
    manual(
      'Boot offline / with an expired session: splash does not crash, retries, expired token → Login (E2E-069)',
    ),
    () => {},
  );
});
