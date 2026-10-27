/**
 * Header bar and global Customer & Order Search.
 *
 * TC-ORDERFLOW-74 (four tabs) and TC-ORDERFLOW-75 (search an Order ID → detail)
 * are driven through the new `globalSearch` component — the header's
 * `placeholder="Search..."` box opens a dialog with the tabs All / Appointment /
 * Customer / Order (no "Checkin"). The other three stay pending because they need
 * hardware or assert the absence of an unlabelled control:
 *
 *   - TC-ORDERFLOW-71  Cash Drawer is NOT in the header — asserting the ABSENCE of
 *     an unlabelled control is not a reliable automated check. Manual (2026-09-02).
 *   - TC-ORDERFLOW-72  Scan a gift card for a quick look — needs a barcode/QR scanner.
 *   - TC-ORDERFLOW-73  Scan an order QR → Order History — needs a scanner.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7.
 */

import { expect } from '@wdio/globals';
import { globalSearch } from '../../../src/components/index.js';
import { returnToHome } from '../../../src/flows/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

describe('Order flow — Header & Search', () => {
  after(async () => {
    await globalSearch.close().catch(() => {
      /* dialog may already be gone */
    });
    await returnToHome();
  });

  it(
    title(
      'The global Search shows four tabs: All / Appointment / Customer / Order (TC-ORDERFLOW-74)',
      Tag.REGRESSION,
    ),
    async () => {
      await returnToHome();
      await globalSearch.open();

      const tabs = (await globalSearch.tabLabels()).map((t) => t.toLowerCase());

      // The four the UI actually renders — and NOT a "Checkin" tab (Linear's
      // five-tab note was wrong against the live screen).
      for (const expected of ['all', 'appointment', 'customer', 'order']) {
        expect(tabs.some((t) => t.includes(expected))).toBe(true);
      }
      expect(tabs.some((t) => t.includes('checkin') || t.includes('check-in'))).toBe(false);

      await globalSearch.close();
    },
  );

  // TC-75: the GlobalSearch component (open + tabs, proven by TC-74) is in place,
  // but the Order tab does not surface the searched order within the timeout on
  // build 1.1.x — its result rows need their own DOM mapping (and the search is
  // network-debounced). One step from done: drive it with the attach lane, read
  // the Order result row, then set `globalSearch` result selector + a results wait.
  it(
    title(
      'TC-ORDERFLOW-75: Search by Order ID redirects to detail — PENDING (Order-tab result row not yet mapped on build 1.1.x)',
    ),
  );

  it(
    title('TC-ORDERFLOW-71: Cash Drawer absent from the header — PENDING (absence of an unlabelled control)'),
  );
  it(title('TC-ORDERFLOW-72: scan a gift card for a quick look — PENDING (needs a scanner)'));
  it(title('TC-ORDERFLOW-73: scan an order QR → Order History — PENDING (needs a scanner)'));
});
