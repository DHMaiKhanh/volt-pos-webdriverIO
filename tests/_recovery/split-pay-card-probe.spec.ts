/**
 * PROBE-ONLY (recovery lane, no rootHooks) — discover the per-check payment UI of
 * Split Order so SPL-R1 / SPL-R4 / SPL-R5 can be wired with REAL locators.
 *
 * ## Why this exists
 *
 * Nothing in the suite pays a split check yet (split-order*.spec.ts void the
 * draft; TC-ORDERFLOW-31 "each check pays independently" is still PENDING), there
 * are NO split-tender testids in constants/testids.orders.ts, the app route tree
 * has no separate split-checkout route, and the installed build strips data-testid
 * ([[build-1-1-x-testid-drift]]). So the per-check payment surface — where the
 * Card/Cash/Gift Card/Other method is chosen and where VP-4084's "Pay disabled for
 * Card" lives — is UNKNOWN from code. Writing SPL-R1/R4/R5 blind would guess
 * locators and produce false reds.
 *
 * This probe builds a draft, splits it equally into two checks, presses "Pay $X"
 * on check 1, and DUMPS the interactive DOM at two points — on the split screen
 * before paying, and on whatever screen the Pay press lands on. It NEVER completes
 * a payment and voids the draft at the end, so it is safe to run read-only (no
 * terminal, no charge). Read its console output, then hand the real selectors back
 * to constants/testids.orders.ts + SplitOrderPage.
 *
 * Run (app already launched on merchant 20258):
 *   cross-env ENV=dev wdio run configs/wdio/wdio.recovery.conf.ts \
 *     --spec tests/_recovery/split-pay-card-probe.spec.ts
 */
import { browser } from '@wdio/globals';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { returnToHome } from '../../src/flows/index.js';
import { step } from '../../src/helpers/steps.js';
import { settle, waitUntilPath } from '../../src/helpers/wait.js';
import { switchToMain } from '../../src/helpers/window.js';
import { checkoutPage, homePage, splashPage, splitOrderPage } from '../../src/pages/index.js';

/** Every on-screen interactive element, trimmed to what a locator is built from. */
interface ProbedElement {
  tag: string;
  testid: string;
  role: string;
  text: string;
  cls: string;
  disabled: boolean;
}

/**
 * Snapshot the interactive DOM: buttons, tabs and anything still carrying a
 * data-testid. Visible-only (zero-size nodes are React's off-screen scaffolding),
 * so the output is the controls a cashier actually sees on this screen.
 */
async function probeInteractive(label: string): Promise<void> {
  const els = await browser.execute(() => {
    const out: ProbedElement[] = [];
    const seen = document.querySelectorAll('button, [role="tab"], [role="radio"], [data-testid], input');
    seen.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      out.push({
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute('data-testid') ?? '',
        role: el.getAttribute('role') ?? '',
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48),
        cls: (el.getAttribute('class') ?? '').slice(0, 90),
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
      });
    });
    return out;
  });

  const path = (await browser.getUrl()).replace(/^[^/]*\/\/[^/]+/, '');
  // eslint-disable-next-line no-console
  console.log(`\n===== PROBE [${label}] path=${path} count=${String(els.length)} =====`);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(els, null, 2));
}

describe('PROBE — Split per-check payment UI (for SPL-R1/R4/R5)', () => {
  it('splits equally, presses Pay on check 1, and dumps the payment surface', async () => {
    await switchToMain();

    await step('Wait for app boot', async () => {
      await waitUntilPath((p) => p !== '' && p !== '/', {
        timeout: Timeouts.NAVIGATION,
        message: 'WebView never routed off "/"',
      });
      await splashPage.waitUntilLeft(Timeouts.APP_BOOT);
    });

    await returnToHome();
    await homePage.waitForReady();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();

    // A single default-priced line clears the $5 split floor; Equally needs no
    // second line. If the default service is under $5 this will need a price bump.
    await homePage.selectFirstStaff();
    await homePage.addFirstService();

    await homePage.openSplitOrder();
    await splitOrderPage.waitForReady();
    await splitOrderPage.selectMethod('equally');

    // (1) The split screen itself — does it carry a per-check method selector
    //     (Card/Cash/Gift Card/Other) BEFORE Pay? That is where VP-4084 lives.
    await probeInteractive('split-screen-before-pay');

    // Press "Pay $X" on check 1. Where this lands is the whole question.
    await splitOrderPage.payCheck();
    await settle(Timeouts.ANIMATION);

    // (2) Whatever screen Pay produced — a routed /checkout, or an inline tender
    //     panel/dialog within split-order. isActive tells us if it is the standard
    //     checkout (then CheckoutPage + payWithCard are reusable as-is).
    let onCheckout = false;
    try {
      onCheckout = await checkoutPage.isActive();
    } catch {
      onCheckout = false;
    }
    // eslint-disable-next-line no-console
    console.log(`\n===== PROBE checkoutPage.isActive()=${String(onCheckout)} =====`);
    await probeInteractive('after-pay-check-1');

    // Cleanup — never completed a payment; drop the draft so the till is clean.
    await returnToHome();
    await homePage.waitForReady();
    if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
  });
});
