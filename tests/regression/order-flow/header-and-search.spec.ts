/**
 * Header bar and global Customer & Order Search — pending.
 *
 * These need either hardware or a screen the catalogue does not address yet:
 *
 *   - TC-ORDERFLOW-71  Cash Drawer is NOT in the header. Asserting the ABSENCE of
 *     an unlabelled control is not a reliable automated check — there is nothing
 *     to point a locator at — so this stays a manual observation (verified
 *     2026-09-02). Where the button DOES live, the cash tender, is covered by
 *     checkout-tenders.spec.ts (TC-ORDERFLOW-49).
 *   - TC-ORDERFLOW-72  Scan a gift card for a quick look — needs a barcode/QR scanner.
 *   - TC-ORDERFLOW-73  Scan an order QR → Order History — needs a scanner.
 *   - TC-ORDERFLOW-74  the global Search shows four tabs (All / Appointment /
 *     Customer / Order). The header search popup has no page object or reviewed
 *     locators in this framework yet.
 *   - TC-ORDERFLOW-75  Search by Order ID redirects to the detail — same popup.
 *
 * TC-74/75 become live once a `GlobalSearch` component with `oh-*`/`search-*`
 * locators is added; TC-72/73 need a scanner-injection harness the app does not
 * expose to WebDriver.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7.
 */

import { title } from '../../../src/types/testTags.js';

describe('Order flow — Header & Search', () => {
  it(
    title('TC-ORDERFLOW-71: Cash Drawer absent from the header — PENDING (absence of an unlabelled control)'),
  );

  it(title('TC-ORDERFLOW-72: scan a gift card for a quick look — PENDING (needs a scanner)'));

  it(title('TC-ORDERFLOW-73: scan an order QR → Order History — PENDING (needs a scanner)'));

  it(title('TC-ORDERFLOW-74: global Search shows four tabs — PENDING (no page object for the search popup)'));

  it(
    title(
      'TC-ORDERFLOW-75: Search by Order ID redirects to detail — PENDING (no page object for the search popup)',
    ),
  );
});
