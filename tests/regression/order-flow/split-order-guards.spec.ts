/**
 * SPLIT ORDER — spec + regression guards from
 * docs/screens/order-flow/payment-flows-test-cases.md §1.
 *
 * ## Division of labour with the existing split specs
 *
 * The SPEC happy-path (navigate, 3 methods, Equally, By Amount, Add Check) already
 * runs in split-order.spec.ts / split-order-multi.spec.ts (TC-ORDERFLOW-25..33).
 * This file adds the part those do not cover:
 *
 *   - SPL-01 (✅, NEW) the "Total > $5" eligibility gate — a sub-$5 order is not
 *     splittable, a larger one is. Driven on the cart, no split screen needed.
 *
 * The GUARDs (SPL-R1..R7) are every one card / settle / fault-injection bound, so
 * they are documented pending stubs with their VP ids:
 *   - SPL-R1 (💳, VP-4353) pay one check by Card, the rest collapse to one check.
 *   - SPL-R2 (💳, VP-3788) gift-card "Pay & create new check" merges tip into principal (= GC-R2).
 *   - SPL-R3 (🖥️💳, VP-4255) a check's card tip is missing on the customer screen.
 *   - SPL-R4 (💳, VP-4227) split card skips the tip-suggestion screen.
 *   - SPL-R5 (💳, VP-4084) the Pay button is disabled for Card in a split.
 *   - SPL-R6 (🔌, VP-4287) terminal disconnect at timeout desyncs POS/FBP — OUT OF SCOPE (§9a).
 *   - SPL-R7 (🌙, VP-4405#2) split Total drops after one check is paid in cash.
 *
 * CREATES DATA: a draft order is built and voided; no payment is taken. dev /
 * staging only.
 */

import { expect } from '@wdio/globals';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';

describe('Payment flows — Split Order', () => {
  before(async () => {
    // Building the draft IS the setup, so the write rail is stated here.
    assertWritesAllowed('build a draft to probe the split eligibility gate');
    await returnToHome();
    await homePage.waitForReady();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
  });

  after(async () => {
    await returnToHome();
    await homePage.waitForReady();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
  });

  it(title('Split is gated behind a Total above $5 (SPL-01)', Tag.REGRESSION, Tag.WRITE), async () => {
    await homePage.selectFirstStaff();
    await homePage.addFirstService();

    // Drop the single line below the threshold: a $1 order cannot be split.
    await homePage.openServiceEditor();
    await homePage.setServiceEditorPrice(100);
    await homePage.saveServiceEditor();
    expect(await homePage.isSplitOrderAvailable()).toBe(false);

    // Raise it well clear of $5: split becomes available again.
    await homePage.openServiceEditor();
    await homePage.setServiceEditorPrice(5_000);
    await homePage.saveServiceEditor();
    expect(await homePage.isSplitOrderAvailable()).toBe(true);
  });

  it(
    title(
      'SPL-02..08: split methods / tax / clear-check SPEC — COVERED by split-order*.spec.ts (TC-ORDERFLOW-25..33)',
    ),
  );

  it(
    title(
      'SPL-R1 (VP-4353): pay one check by Card, remaining checks collapse to one — PENDING 💳 (needs card + split)',
    ),
  );

  it(
    title(
      'SPL-R2 (VP-3788): gift-card "Pay & create new check" merges tip into principal — PENDING 💳 (= GC-R2)',
    ),
  );

  it(
    title(
      'SPL-R3 (VP-4255): a check card tip is missing on the customer screen — PENDING 🖥️💳 (dual-screen + card)',
    ),
  );

  it(title('SPL-R4 (VP-4227): split card skips the tip-suggestion screen — PENDING 💳 (needs card + split)'));

  it(
    title(
      'SPL-R5 (VP-4084): Pay button disabled for Card in a split — PENDING 💳 (needs the split tender panel)',
    ),
  );

  it(
    title(
      'SPL-R6 (VP-4287): terminal disconnect at timeout desyncs POS/FBP — PENDING 🔌 OUT OF SCOPE (fault-injection, §9a)',
    ),
  );

  it(
    title(
      'SPL-R7 (VP-4405#2): split Total drops after one check is paid in cash — PENDING 🌙 (needs a partial split settle)',
    ),
  );
});
