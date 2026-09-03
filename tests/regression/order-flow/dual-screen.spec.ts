/**
 * The customer display (second window) during payment — pending.
 *
 * These assert the CUSTOMER-facing half of completion: the tip prompt the second
 * window shows, and the "Please wait..." the till shows while it is up. Driving
 * it needs two things at once — the tauri-driver LAUNCH lane (both windows are
 * real WebDriver handles there, so `helpers/window.ts → withCustomerWindow()`
 * works; the attach lane cannot see the customer webview as a handle), AND a
 * merchant configured for tip-after-payment so the prompt appears at all. The
 * page object is built for it (`customerDisplayPage.waitForTipPrompt()`,
 * `completeTipPrompt()`, and `checkoutPage.isWaitingForCustomerTip()`), but a run
 * against a merchant without that tip flow would hang on a prompt that never
 * comes — so this is gated behind that config rather than run blind.
 *
 * The reception side of TC-ORDERFLOW-50 (the four receipt actions) IS covered,
 * on the main window, in payment-success.spec.ts.
 *
 * docs/screens/order-flow/order-flow-test-cases.md §7 (verified live 2026-09-03):
 *   - TC-ORDERFLOW-80  the till waits on "Customer is adding a tip" after Complete
 *   - TC-ORDERFLOW-81  the customer "Add a tip" screen: 15/18/20/25% + Custom + No Tip
 */

import { Tag, title } from '../../../src/types/testTags.js';

describe('Order flow — Customer display', () => {
  it(
    title(
      'TC-ORDERFLOW-80: till waits on "Customer is adding a tip" — PENDING (needs launch lane + tip config)',
      Tag.DUAL_WINDOW,
    ),
  );

  it(
    title(
      'TC-ORDERFLOW-81: customer "Add a tip" screen options — PENDING (needs launch lane + tip config)',
      Tag.DUAL_WINDOW,
    ),
  );
});
