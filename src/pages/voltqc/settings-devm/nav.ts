/**
 * Navigation helpers for the volt-qc Settings / DEVM port.
 *
 * Thin wrappers over the suite's own navigation (`goToSettings`,
 * `settingsPage.openSectionDiscarding`, the passcode grant) so every case
 * starts on a known sub-screen with no dirty form behind it. They click the
 * same chrome a cashier would — nothing navigates by URL.
 */

import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../components/index.js';
import { Vq, VqBusiness } from '../../../constants/testids.voltqc-settings-devm.js';
import { goToSettings } from '../../../flows/index.js';
import { waitUntilPath } from '../../../helpers/wait.js';
import businessInfoPage from '../../settings/BusinessInfoPage.js';
import settingsPage, { SettingsSection, type SettingsSectionName } from '../../settings/SettingsPage.js';
import { vqProbe } from './VqProbe.js';

/** Land on a settings sub-screen, discarding whatever an earlier case left dirty. */
export async function openSettingsVq(section: SettingsSectionName): Promise<void> {
  await dismissOverlays();
  await goToSettings();
  const path = SettingsSection[section];
  // Always re-enter through the rail: a case may have left a detail route
  // (`/settings/staffs/<id>`) or a dirty form that only a navigation clears.
  if ((await settingsPage.currentPath()) === path) {
    const other = section === 'LANGUAGE' ? 'ACCESSIBILITY' : 'LANGUAGE';
    await settingsPage.openSectionDiscarding(other);
  }
  await settingsPage.openSectionDiscarding(section);
  await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
}

/** Business Info with its form loaded (gate answered with the 30-minute tick). */
export async function openBusinessVq(): Promise<void> {
  await cancelBusinessEditIfOpen();
  await openSettingsVq('BUSINESS');
  await businessInfoPage.waitForForm();
}

/** Press a settings rail link WITHOUT handling the leave guard — for cases that assert it. */
export async function pressRailLink(label: string): Promise<void> {
  await vqProbe.press(Vq.railLink(label));
}

/** Press a rail link and wait for its path. Fails when a guard or a gate holds the navigation. */
export async function goRail(label: string, path: string): Promise<void> {
  await pressRailLink(label);
  await waitUntilPath((current) => current.startsWith(path), {
    timeout: Timeouts.NAVIGATION,
    message: `Rail link "${label}" never reached ${path}`,
  });
}

/** Leave via a rail link; if the unsaved-changes guard comes up, discard. Returns whether it did. */
export async function leaveDiscardingVq(label: string): Promise<boolean> {
  await pressRailLink(label);
  if (!(await vqProbe.isShown(Vq.alertDialog(), Timeouts.ANIMATION * 3))) return false;
  if (await vqProbe.isShown(Vq.alertButton('Discard & Leave'), Timeouts.ANIMATION)) {
    await vqProbe.press(Vq.alertButton('Discard & Leave'));
  } else {
    await vqProbe.press(Vq.alertButton('Confirm'));
  }
  await vqProbe.isGone(Vq.alertDialog(), Timeouts.SHORT);
  return true;
}

/** Business Info: back to view mode if a case left the form in Edit. Never saves. */
export async function cancelBusinessEditIfOpen(): Promise<void> {
  if (!(await businessInfoPage.isActive())) return;
  if (await vqProbe.isShown(VqBusiness.headerButton('Cancel'), Timeouts.ANIMATION)) {
    await vqProbe.press(VqBusiness.headerButton('Cancel'));
    await vqProbe.isShown(VqBusiness.headerButton('Edit'), Timeouts.SHORT);
  }
}

/** Escape out of any dialog / popover / listbox left open. */
export async function dismissOverlays(): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    const open =
      (await vqProbe.count(Vq.alertDialog())) +
      (await vqProbe.count(Vq.anyDialog())) +
      (await vqProbe.count(Vq.anyOption()));
    if (open === 0) return;
    if ((await vqProbe.count(Vq.alertButton('Cancel'))) > 0) await vqProbe.press(Vq.alertButton('Cancel'));
    else await vqProbe.pressKey('Escape');
  }
}
