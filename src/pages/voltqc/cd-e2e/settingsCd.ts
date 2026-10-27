import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../components/index.js';
import { Routes } from '../../../constants/routes.js';
import { CdSettings, type CustomerTileId, type VqcChain } from '../../../constants/testids.voltqc-cd-e2e.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from '../pos/VoltQcProbe.js';
import { app } from './cdApp.js';

/**
 * Settings the CD / E2E ports flip and restore (volt-qc `customer-display.ts`
 * "Settings" section). Every setter returns the value it found so the spec can
 * put it back in a `finally`.
 *
 * Appearance and Language are stored PER DEVICE; Customer Display, tip methods
 * and the signature rule are MERCHANT-level (synced to Portal) — restore them.
 */

export type Theme = 'light' | 'dark';
export type LanguageCode = 'en' | 'vi';
export interface CustomerDisplaySettings {
  showPoint: boolean;
  showReward: boolean;
}
export interface SignatureSettings {
  required: boolean;
  timing: 'before' | 'after';
}

async function openSettings(route: string, anchor: VqcChain): Promise<void> {
  if (!(await P.path()).startsWith(route)) {
    await app.go(route, { passcode: false });
    await passcodeDialog.enterIfPresent(env.OWNER_PASSCODE, { timeout: Timeouts.SHORT });
  }
  if (!(await app.waitFor(anchor, Timeouts.MEDIUM))) {
    throw new Error(
      `${route}: ${JSON.stringify(anchor)} never rendered (setting not shipped on this build?).`,
    );
  }
}

const isOn = async (chain: VqcChain): Promise<boolean> =>
  (await P.attrOf(chain, 'aria-checked')) === 'true' || (await P.attrOf(chain, 'data-state')) === 'checked';

/* --------------------------------- theme --------------------------------- */

export async function readTheme(): Promise<Theme> {
  await openSettings(Routes.SETTINGS_ACCESSIBILITY, CdSettings.themeRadio('dark'));
  return (await isOn(CdSettings.themeRadio('dark'))) ? 'dark' : 'light';
}

/** Applies immediately (no Save); the main window emits `theme:changed` to the customer display. */
export async function setTheme(theme: Theme): Promise<void> {
  await openSettings(Routes.SETTINGS_ACCESSIBILITY, CdSettings.themeRadio(theme));
  await P.clickQ(CdSettings.themeRadio(theme));
  await P.poll(() => isOn(CdSettings.themeRadio(theme)), Boolean, Timeouts.SHORT);
}

/** Does this build ship the Appearance card at all (VP-3800 — not on production)? */
export async function themeShipped(): Promise<boolean> {
  await app.go(Routes.SETTINGS_ACCESSIBILITY, { passcode: false });
  await passcodeDialog.enterIfPresent(env.OWNER_PASSCODE, { timeout: Timeouts.SHORT });
  return app.waitFor(CdSettings.themeRadio('dark'), Timeouts.SHORT);
}

/* -------------------------------- language ------------------------------- */

export async function readLanguage(): Promise<LanguageCode> {
  await openSettings(Routes.SETTINGS_LANGUAGE, CdSettings.languageRadio('vi'));
  return (await isOn(CdSettings.languageRadio('vi'))) ? 'vi' : 'en';
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  await openSettings(Routes.SETTINGS_LANGUAGE, CdSettings.languageRadio(code));
  await P.clickQ(CdSettings.languageRadio(code));
  await P.poll(() => isOn(CdSettings.languageRadio(code)), Boolean, Timeouts.SHORT);
  // Some builds put a Save under the radios; press it when there is one.
  const save = [{ css: 'main' }, { role: 'button' as const, nameRe: '^(Save|Lưu)$', nth: 0 }];
  if (await P.has(save)) {
    if (!(await P.isDisabled(save).catch(() => true))) await P.clickQ(save);
  }
  await settle(800);
}

/* ---------------------------- customer display --------------------------- */

export async function readCustomerDisplay(): Promise<CustomerDisplaySettings> {
  await openSettings(Routes.SETTINGS_ACCESSIBILITY, CdSettings.showPoint);
  return { showPoint: await isOn(CdSettings.showPoint), showReward: await isOn(CdSettings.showReward) };
}

export function customerDisplaySwitch(key: keyof CustomerDisplaySettings): VqcChain {
  return key === 'showPoint' ? CdSettings.showPoint : CdSettings.showReward;
}

/** Toggle to `want`, Save, wait for the toast. Returns the values BEFORE the change. */
export async function setCustomerDisplay(
  want: Partial<CustomerDisplaySettings>,
): Promise<CustomerDisplaySettings> {
  const before = await readCustomerDisplay();
  let changed = false;
  for (const k of ['showPoint', 'showReward'] as const) {
    const w = want[k];
    if (w === undefined || w === before[k]) continue;
    await P.clickQ(customerDisplaySwitch(k));
    await P.poll(
      () => isOn(customerDisplaySwitch(k)),
      (v) => v === w,
      Timeouts.SHORT,
    );
    changed = true;
  }
  if (changed) {
    await P.clickQ(CdSettings.customerDisplaySave);
    await app.passcodeIfAsked(1_500);
    if (!(await app.waitFor(CdSettings.customerDisplaySaved, Timeouts.MEDIUM))) {
      throw new Error('Customer Display Save: no "Customer display setting updated successfully" toast.');
    }
  }
  return before;
}

/* -------------------------------- tipping -------------------------------- */

async function saveTipping(): Promise<void> {
  await P.clickQ(CdSettings.tippingSave);
  await app.passcodeIfAsked(1_500);
  if (!(await app.waitFor(CdSettings.tippingSaved, Timeouts.MEDIUM))) {
    throw new Error('Tipping Save: no "Tipping settings updated successfully" toast.');
  }
}

/** Tip on/off for one tender (merchant-level). Returns the state before. */
export async function setTipMethod(method: CustomerTileId, enabled: boolean): Promise<boolean> {
  await openSettings(Routes.SETTINGS_PAYMENT_TRANSACTION, CdSettings.tipMethod(method));
  const before = await isOn(CdSettings.tipMethod(method));
  if (before !== enabled) {
    await P.clickQ(CdSettings.tipMethod(method));
    await P.poll(
      () => isOn(CdSettings.tipMethod(method)),
      (v) => v === enabled,
      Timeouts.SHORT,
    );
    await saveTipping();
  }
  return before;
}

export async function readSignatureSettings(): Promise<SignatureSettings> {
  await openSettings(Routes.SETTINGS_PAYMENT_TRANSACTION, CdSettings.signatureTiming('before'));
  return {
    required: await isOn(CdSettings.signatureSwitch),
    timing: (await isOn(CdSettings.signatureTiming('before'))) ? 'before' : 'after',
  };
}

/** Set the signature rule, Save. Returns the values before. */
export async function setSignatureSettings(want: SignatureSettings): Promise<SignatureSettings> {
  const before = await readSignatureSettings();
  let changed = false;
  if (before.required !== want.required) {
    await P.clickQ(CdSettings.signatureSwitch);
    changed = true;
  }
  if (before.timing !== want.timing) {
    await P.clickQ(CdSettings.signatureTiming(want.timing));
    changed = true;
  }
  if (changed) await saveTipping();
  return before;
}
