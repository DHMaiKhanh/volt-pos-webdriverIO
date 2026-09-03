/**
 * VERIFY-ONLY runner (recovery lane, no rootHooks) for the Split Order port.
 *
 * Exercises the exact page-object surface that tests/regression/order-flow/
 * split-order.spec.ts uses — homePage.openSplitOrder() + SplitOrderPage — but
 * adds the splash-boot wait that the standard lane's rootHooks would normally
 * provide. Purpose: prove the new locator + method + assertions work against the
 * live app on merchant 20258, which the standard lane cannot reach.
 *
 * Run: cross-env ENV=dev wdio run configs/wdio/wdio.recovery.conf.ts \
 *        --spec tests/_recovery/split-order-verify.spec.ts
 */
import { expect } from '@wdio/globals';
import { Timeouts } from '../../configs/constants/timeouts.js';
import { returnToHome } from '../../src/flows/index.js';
import { switchToMain } from '../../src/helpers/window.js';
import { waitUntilPath } from '../../src/helpers/wait.js';
import { step } from '../../src/helpers/steps.js';
import { homePage, splashPage, splitOrderPage } from '../../src/pages/index.js';

describe('VERIFY — Split Order port (TC-ORDERFLOW-25/26/27/28)', () => {
  it('opens split-order from a single-line draft and divides it', async () => {
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
    await homePage.selectFirstStaff();
    await homePage.addFirstService();

    await homePage.openSplitOrder();
    await splitOrderPage.waitForReady();

    // TC-25 — landed on the split-order screen
    expect(await splitOrderPage.isActive()).toBe(true);

    // TC-26 — By Items disabled for a single line; the other two enabled
    expect(await splitOrderPage.isMethodEnabled('equally')).toBe(true);
    expect(await splitOrderPage.isMethodEnabled('byAmount')).toBe(true);
    expect(await splitOrderPage.isMethodEnabled('byItems')).toBe(false);

    // TC-27 — Equally defaults to two checks summing to the whole
    await splitOrderPage.selectMethod('equally');
    const amounts = await splitOrderPage.allCheckAmountsCents();
    expect(amounts.length).toBe(2);
    const [first, second] = amounts;
    if (first === undefined || second === undefined) {
      throw new Error(`expected two checks, got ${JSON.stringify(amounts)}`);
    }
    expect(first + second).toBeGreaterThan(0);
    expect(Math.abs(first - second)).toBeLessThanOrEqual(1);

    // TC-28 — Add New Check raises the count
    const before = await splitOrderPage.checkCount();
    await splitOrderPage.addCheck();
    expect(await splitOrderPage.checkCount()).toBe(before + 1);

    // Cleanup — void the never-paid draft
    await splitOrderPage.backToOrder();
    await homePage.deleteOrder();
  });
});
