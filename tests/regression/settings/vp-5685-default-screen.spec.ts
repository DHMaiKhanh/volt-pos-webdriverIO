/**
 * VP-5685 — merchant-wide "Default Screen": the POS lands on Pending Orders or
 * Home (Create Order) on app open and after Complete order. PRs volt-pos#3336,
 * volt-pos-api#1625, fastboy-portal#959 (POS >= 1.1.107).
 *
 * docs/qc/volt-qc/vp-tickets/VP-5685-default-screen-test-cases.md (TC-VP5685-01..12)
 *
 *   npm run test:spec -- tests/regression/settings/vp-5685-default-screen.spec.ts
 *
 * WRITES the merchant setting (`merchant_default_screen`) and pays two Cash
 * orders. `after` puts the merchant default (Pending Orders) back. TC-08/09 kill
 * and relaunch the app — do not run while another session drives the same app.
 * dev / staging only.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../configs/env/loadEnv.js';
import { appNav } from '../../../src/components/index.js';
import type { DefaultScreen } from '../../../src/constants/testids.settings-accessibility.js';
import { Routes } from '../../../src/constants/routes.js';
import { createOrder, payInCash, returnToHome } from '../../../src/flows/index.js';
import { settle, waitUntilPath } from '../../../src/helpers/wait.js';
import {
  accessibilitySettingsPage,
  checkoutPage,
  homePage,
  paymentSuccessPage,
} from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import {
  backToTill,
  clearToasts,
  LANDING,
  openDefaultScreenCard,
  relaunchApp,
  SAVED_TOAST_RE,
  savedDefaultScreen,
  setDefaultScreen,
  waitSavedDefaultScreen,
  waitToast,
} from './vp-5685.helpers.js';

/** Every merchant's default (old and new stores) per the ticket. */
const MERCHANT_DEFAULT: DefaultScreen = 'pending_orders';

/** Create a 1-line order, pay it in Cash (No Tip), decline the receipt; return the route it lands on. */
async function completeCashOrder(): Promise<string> {
  await returnToHome();
  await homePage.discardDraftIfAny();
  const { orderId } = await createOrder();
  await payInCash(orderId, { tip: 'none' });
  await paymentSuccessPage.continueToNextOrder();
  await paymentSuccessPage.waitForFlowToEnd();
  // The router can hop through /home before the landing resolves; let it settle.
  await waitUntilPath((p) => p.startsWith(Routes.HOME) || p.startsWith(Routes.ORDER_PENDING), {
    timeout: Timeouts.NAVIGATION,
    message: 'Complete order landed neither on Home nor on Pending Orders',
  });
  await settle(1_500);
  return appNav.currentPath();
}

describe('VP-5685 — Default Screen (Pending Orders | Home) on app open and after Complete order', () => {
  before(() => {
    assertWritesAllowed('change the merchant Default Screen setting');
  });

  afterEach(async () => {
    await backToTill().catch(() => undefined);
  });

  after(async () => {
    // Always back to the merchant default, not to a snapshot: a run cut short
    // mid-case leaves Home, and the next run would "restore" Home.
    if ((await savedDefaultScreen().catch(() => null)) !== MERCHANT_DEFAULT) {
      await setDefaultScreen(MERCHANT_DEFAULT).catch(() => undefined);
    }
    await backToTill().catch(() => undefined);
  });

  describe('1. Default Screen card', () => {
    it(
      title(
        'TC-VP5685-01: the Default Screen card sits right under Customer Display, two options + Save',
        Tag.REGRESSION,
      ),
      async () => {
        await openDefaultScreenCard();
        expect(await accessibilitySettingsPage.isDefaultScreenAfterCustomerDisplay()).toBe(true);
        expect(await accessibilitySettingsPage.hasDefaultScreenOptions()).toBe(true);
        expect(await accessibilitySettingsPage.isDefaultScreenSaveEnabled()).toBe(false);
      },
    );

    it(
      title(
        'TC-VP5685-02: Pending Orders is the default, badged "Default", Save locked',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async () => {
        await setDefaultScreen('pending_orders');
        await backToTill();
        await openDefaultScreenCard();
        expect(await accessibilitySettingsPage.selectedDefaultScreen()).toBe('pending_orders');
        expect(await accessibilitySettingsPage.hasDefaultBadge()).toBe(true);
        expect(await accessibilitySettingsPage.isDefaultScreenSaveEnabled()).toBe(false);
      },
    );

    it(
      title(
        'TC-VP5685-03: changing the choice unlocks Save, choosing the saved value back locks it',
        Tag.REGRESSION,
      ),
      async () => {
        await openDefaultScreenCard();
        const saved = (await accessibilitySettingsPage.selectedDefaultScreen()) ?? 'pending_orders';
        const other: DefaultScreen = saved === 'home' ? 'pending_orders' : 'home';
        await accessibilitySettingsPage.chooseDefaultScreen(other);
        expect(await accessibilitySettingsPage.isDefaultScreenSaveEnabled()).toBe(true);
        await accessibilitySettingsPage.chooseDefaultScreen(saved);
        expect(await accessibilitySettingsPage.isDefaultScreenSaveEnabled()).toBe(false);
        expect(await savedDefaultScreen()).toBe(saved);
      },
    );

    it(
      title(
        'TC-VP5685-04: Save Home → success toast, Save locks, DB = home',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
      ),
      async () => {
        await setDefaultScreen('pending_orders');
        await clearToasts();
        await accessibilitySettingsPage.chooseDefaultScreen('home');
        expect(await accessibilitySettingsPage.saveDefaultScreen()).toBe(true);
        expect(await waitToast(SAVED_TOAST_RE)).not.toBe('');
        expect(await accessibilitySettingsPage.isDefaultScreenSaveEnabled()).toBe(false);
        expect(await waitSavedDefaultScreen('home')).toBe('home');
      },
    );

    it(
      title(
        'TC-VP5685-05: Save Pending Orders → success toast, DB = pending_orders',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
      ),
      async () => {
        await setDefaultScreen('home');
        await clearToasts();
        await accessibilitySettingsPage.chooseDefaultScreen('pending_orders');
        expect(await accessibilitySettingsPage.saveDefaultScreen()).toBe(true);
        expect(await waitToast(SAVED_TOAST_RE)).not.toBe('');
        expect(await waitSavedDefaultScreen('pending_orders')).toBe('pending_orders');
      },
    );
  });

  describe('2. Landing after Complete order and on app open', () => {
    it(
      title(
        'TC-VP5685-06: Complete order with Home → empty till (no customer, no staff, empty cart)',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(5 * 60_000);
        await setDefaultScreen('home');
        const landed = await completeCashOrder();
        expect(landed.startsWith(LANDING.home)).toBe(true);
        // No draft = no staff column and no cart lines (an empty till renders no Total row at all).
        expect(await homePage.hasActiveDraft()).toBe(false);
        expect(await homePage.isCustomerKeypadShown()).toBe(true);
      },
    );

    it(
      title(
        'TC-VP5685-07: Complete order with Pending Orders → Pending Orders',
        Tag.REGRESSION,
        Tag.CRITICAL,
        Tag.WRITE,
        Tag.PAYMENT,
        Tag.DUAL_WINDOW,
      ),
      async function () {
        this.timeout(5 * 60_000);
        await setDefaultScreen('pending_orders');
        const landed = await completeCashOrder();
        expect(landed.startsWith(LANDING.pending_orders)).toBe(true);
      },
    );

    it(
      title(
        'TC-VP5685-08: relaunch with Home → the app opens on Home',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.EXCLUSIVE,
        Tag.SLOW,
      ),
      async function () {
        this.timeout(6 * 60_000);
        await setDefaultScreen('home');
        const landed = await relaunchApp();
        expect(landed.startsWith(LANDING.home)).toBe(true);
      },
    );

    it(
      title(
        'TC-VP5685-09: relaunch with Pending Orders → the app opens on Pending Orders',
        Tag.REGRESSION,
        Tag.WRITE,
        Tag.EXCLUSIVE,
        Tag.SLOW,
      ),
      async function () {
        this.timeout(6 * 60_000);
        await setDefaultScreen('pending_orders');
        const landed = await relaunchApp();
        expect(landed.startsWith(LANDING.pending_orders)).toBe(true);
      },
    );
  });

  describe('3. Unchanged behaviour', () => {
    it(
      title(
        'TC-VP5685-10: the VOLT logo always goes Home, even with Pending Orders',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async () => {
        await setDefaultScreen('pending_orders');
        await backToTill();
        await appNav.goToPendingOrders();
        await appNav.goHome();
        expect((await appNav.currentPath()).startsWith(Routes.HOME)).toBe(true);
      },
    );

    it(
      title('TC-VP5685-11: Back from checkout returns to the same order on Home', Tag.REGRESSION, Tag.WRITE),
      async function () {
        this.timeout(4 * 60_000);
        await setDefaultScreen('home');
        await backToTill();
        await homePage.discardDraftIfAny();
        const { orderId } = await createOrder();
        expect(orderId).not.toBe('');
        await checkoutPage.pressBack();
        await waitUntilPath((p) => p.startsWith(Routes.HOME), {
          timeout: Timeouts.NAVIGATION,
          message: 'Back from checkout did not return to the till',
        });
        expect(await homePage.hasActiveDraft(Timeouts.SHORT)).toBe(true);
        expect(await homePage.cartTotal()).toBeGreaterThan(0);
        await homePage.deleteOrder();
      },
    );

    it(
      title(
        'TC-VP5685-12: header Pending Orders tab still opens Pending Orders with Home',
        Tag.REGRESSION,
        Tag.WRITE,
      ),
      async () => {
        await setDefaultScreen('home');
        await backToTill();
        await appNav.goToPendingOrders();
        expect((await appNav.currentPath()).startsWith(Routes.ORDER_PENDING)).toBe(true);
      },
    );
  });
});
