/**
 * VP-5685 helpers — merchant-wide "Default Screen" (Pending Orders | Home): where
 * the POS lands on app open and after Complete order.
 *
 * NOT a spec. Adds what the page objects lack for this ticket: the setting's DB
 * value (oracle), the save toast, opening the Accessibility page, and a real app
 * relaunch for the "on app open" cases.
 */

import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';
import { gql } from '../../../src/api/index.js';
import type { DefaultScreen } from '../../../src/constants/testids.settings-accessibility.js';
import { Routes } from '../../../src/constants/routes.js';
import { bootApp, goToSettings, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { settle } from '../../../src/helpers/wait.js';
import { switchToMain } from '../../../src/helpers/window.js';
import { accessibilitySettingsPage, settingsPage } from '../../../src/pages/index.js';
import { ensureHealthyAttachedApp } from '../../../src/support/attachApp.js';
import { killStaleProcesses } from '../../../src/support/process.js';

export const SAVED_TOAST_RE = /Default screen setting updated successfully|màn hình mặc định/i;

/** The route each value lands on. */
export const LANDING: Record<DefaultScreen, string> = {
  pending_orders: Routes.ORDER_PENDING,
  home: Routes.HOME,
};

const DEFAULT_SCREEN_QUERY = `query vp5685DefaultScreen {
  sysSettingList(where: { key: { eq: "merchant_default_screen" } }) { value }
}`;

/** The saved value in the local schema; `null` when the row does not exist yet (= default Pending Orders). */
export async function savedDefaultScreen(): Promise<DefaultScreen | null> {
  await switchToMain();
  const data = await gql().query<{ sysSettingList: { value: string }[] }>(DEFAULT_SCREEN_QUERY, {
    operationName: 'vp5685DefaultScreen',
  });
  // Seen both raw (`pending_orders`, right after a POS save) and JSON-encoded
  // (`"pending_orders"`, after a relaunch / sync round-trip) on 1.1.107.
  const value = (data.sysSettingList[0]?.value ?? '').replace(/^"(.*)"$/, '$1');
  return value === 'home' || value === 'pending_orders' ? value : null;
}

/** Poll the DB until it holds `want`; returns the last read. */
export async function waitSavedDefaultScreen(
  want: DefaultScreen,
  timeout: number = Timeouts.MEDIUM,
): Promise<DefaultScreen | null> {
  let last = await savedDefaultScreen();
  try {
    await browser.waitUntil(
      async () => {
        last = await savedDefaultScreen();
        return last === want;
      },
      { timeout, interval: 500 },
    );
  } catch {
    // Timed out: the caller asserts on the last read.
  }
  return last;
}

/** Texts of every sonner toast on the staff window. */
export function toastTexts(): Promise<string[]> {
  return browser.execute(function () {
    return Array.prototype.map.call(document.querySelectorAll('[data-sonner-toast]'), function (t: Element) {
      return (t as HTMLElement).innerText.trim();
    }) as string[];
  });
}

/** Wait for a toast matching `re`; '' when none came. */
export async function waitToast(re: RegExp, timeout: number = Timeouts.MEDIUM): Promise<string> {
  let hit = '';
  try {
    await browser.waitUntil(
      async () => {
        hit = (await toastTexts()).find((t) => re.test(t)) ?? '';
        return hit !== '';
      },
      { timeout, interval: 250 },
    );
  } catch {
    // none
  }
  return hit;
}

/** Remove the toasts on screen so the next wait cannot match a stale one. */
export async function clearToasts(): Promise<void> {
  await browser.execute(function () {
    document.querySelectorAll('[data-sonner-toast]').forEach(function (t) {
      t.remove();
    });
  });
}

/** Settings → Accessibility, scrolled to the Default Screen card. */
export async function openDefaultScreenCard(): Promise<void> {
  await goToSettings();
  await settingsPage.openSection('ACCESSIBILITY');
  await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
  if (!(await accessibilitySettingsPage.isDefaultScreenCardShown())) {
    throw new Error(
      'Settings › Accessibility shows no Default Screen card — build older than VP-5685 (1.1.107)?',
    );
  }
}

/** Save `value` from the POS and wait until the DB holds it. Leaves the app on Settings. */
export async function setDefaultScreen(value: DefaultScreen): Promise<void> {
  await step(`Default Screen → ${value}`, async () => {
    await openDefaultScreenCard();
    await accessibilitySettingsPage.applyDefaultScreen(value);
    const saved = await waitSavedDefaultScreen(value);
    if (saved !== value) throw new Error(`Default Screen: saved ${value} but the DB reads ${String(saved)}.`);
  });
}

/**
 * Kill the app and start it again — a real "app open", which the sidebar Reload
 * is not (Reload keeps the current route). Returns the first route past the splash.
 *
 * Attach lane: relaunch through the self-heal (new app on CDP + new driver), then a
 * new session on it. Launch lane: a new session launches the app itself.
 */
export async function relaunchApp(): Promise<string> {
  return step('Relaunch the app', async () => {
    if (loadEnv().MODE === 'attach') {
      killStaleProcesses({ app: true, drivers: true });
      await settle(2_000);
      await ensureHealthyAttachedApp();
    } else {
      killStaleProcesses({ app: true, drivers: false });
      await settle(2_000);
    }
    await browser.reloadSession();
    const boot = await bootApp(Timeouts.APP_BOOT);
    if (boot.screen !== 'home') {
      throw new Error(`relaunchApp(): the app booted to the login gate (${boot.path}) — device signed out.`);
    }
    return boot.path;
  });
}

/** Back to the till from wherever a case left the app. */
export async function backToTill(): Promise<void> {
  await switchToMain().catch(() => undefined);
  await returnToHome();
}
