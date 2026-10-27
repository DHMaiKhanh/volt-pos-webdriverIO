/**
 * Shared glue for the volt-qc APP / PERM port (read-only specs).
 *
 * Every case here either drops the run's 30-minute passcode grant on purpose or
 * leaves a popover / dialog up when an assertion fails, so each spec ends with
 * {@link recoverShell}: no guard, no drawer, no dialog, back on /home, grant re-armed.
 */

import { browser } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog } from '../../../../src/components/index.js';
import { Routes } from '../../../../src/constants/routes.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { waitUntilPath } from '../../../../src/helpers/wait.js';
import { settingsPage } from '../../../../src/pages/index.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import { moduleLogger } from '../../../../src/utils/logger.js';

export const log = moduleLogger('volt-qc-app-perm');

/** The owner passcode — what the APP/PERM TCs call `<OWNER_CODE>`. */
export const ownerCode = (): string => env.OWNER_PASSCODE;

/**
 * A 4-digit code that belongs to no staff (`<UNKNOWN_CODE>`). volt-qc found
 * `0000` taken on merchant 14 and settled on `9137`; override with
 * `VOLT_UNKNOWN_CODE` on another merchant.
 */
export const unknownCode = (): string => (process.env.VOLT_UNKNOWN_CODE ?? '').trim() || '9137';

/** `<INACTIVE_CODE>` — the code of a staff set Inactive. Optional: cases skip without it. */
export const inactiveCode = (): string => (process.env.VOLT_INACTIVE_CODE ?? '').trim();

/** Go to `route` through the router, answering a guard with the owner code if one comes up. */
export async function visit(route: string): Promise<void> {
  await gateProbe.routerNavigate(route);
  await passcodeDialog.unlockForRun(ownerCode());
  await waitUntilPath((p) => p === route || p.startsWith(`${route}/`), {
    timeout: Timeouts.NAVIGATION,
    message: `visit(): router never reached ${route}`,
  });
}

/** Put the till back: no guard, no drawer, no open dialog, on /home, run grant re-armed. */
export async function recoverShell(): Promise<void> {
  try {
    await gateProbe.dismiss();
    if (await appNav.isSidebarOpen()) await appNav.closeSidebar();
    await browser.keys([Key.Escape]);
    await gateProbe.restoreRunGrant();
    const path = await gateProbe.path();
    if (!path.startsWith(Routes.HOME)) {
      await gateProbe.routerNavigate(Routes.HOME);
      if (path.startsWith(Routes.SETTINGS)) await settingsPage.confirmLeaveGuardIfShown();
    }
    await returnToHome();
  } catch (error) {
    log.warn(`recoverShell(): ${error instanceof Error ? error.message : String(error)}`);
    await gateProbe.routerNavigate(Routes.HOME).catch(() => undefined);
  }
}
