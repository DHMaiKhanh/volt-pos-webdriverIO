import path from 'node:path';
import { browser } from '@wdio/globals';
import { Paths } from '../../configs/constants/paths.js';
import { readJsonIfExists, writeJson } from '../utils/file.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('passcodeGrant');

/**
 * The app's own key and shape — `volt-pos/src/lib/passcode-skip.ts`.
 *
 * Transcribed rather than guessed, and if that file changes this one is wrong:
 * {@link seedPasscodeGrant} writes a value the app parses, so a shape drift
 * makes every gated screen prompt again with no error anywhere. The app's own
 * reader is defensive (it removes a malformed entry and returns null), so the
 * failure mode is a slow suite, not a broken one.
 */
const STORAGE_KEY = 'volt-passcode-skip';

/** `PASSCODE_SKIP_DURATION_MS` in the app — 30 minutes. */
export const GRANT_DURATION_MS = 30 * 60 * 1_000;

export interface PasscodeGrant {
  staffId: string;
  /** Epoch millis. The app treats `expiresAt <= Date.now()` as expired and clears it. */
  expiresAt: number;
}

/** Where the staff id is remembered between spec files and workers. */
const CACHE_FILE = path.join(Paths.TMP, 'passcode-grant.json');

/**
 * Skip the passcode gate for the rest of the run.
 *
 * ## The cost this removes
 *
 * Every gated screen — `/incomes/*`, `/settings/business`, refunds, void —
 * opens an "Enter staff code to access <screen>" dialog. Paying it per test is
 * roughly 3-5s each: the dialog mounts after a round trip, four keypad taps, then
 * the dismiss animation. Across a regression lane that is minutes of nothing.
 *
 * ## Why writing localStorage is legitimate and not a cheat
 *
 * The dialog itself offers "Do not require passcode for the next 30 minutes",
 * and taking it is what the app stores under this key. Seeding it is the same
 * grant a cashier would give, not a bypass of the permission model — on entry
 * `permission-protected-route.tsx` still re-fetches the staff by id and
 * re-runs `verifyPermission` against their live role. A grant naming a staff
 * member who lacks the permission simply does not unlock the screen.
 *
 * That is also why {@link seedPasscodeGrant} needs a REAL staff id: an invented
 * one fails `fetchStaffById`, the app clears the key, and the gate returns.
 *
 * ## Consequence for specs
 *
 * With a grant active the dialog never appears, so an unconditional
 * `enterPasscode()` waits out its full timeout and fails. Passcode entry must
 * always be conditional — see `PasscodeDialog.unlockIfPrompted()`.
 *
 * ## The 30-minute edge
 *
 * The grant expires mid-run on a long lane, which is exactly why the unlock
 * helper stays conditional rather than being deleted. {@link refreshGrant}
 * re-stamps it from the cached staff id without another dialog.
 */
export async function readPasscodeGrant(): Promise<PasscodeGrant | null> {
  const raw = await browser.execute(function (key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, STORAGE_KEY);

  if (typeof raw !== 'string' || raw === '') return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PasscodeGrant>;
    if (typeof parsed.staffId !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    return { staffId: parsed.staffId, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

/** Write a fresh 30-minute grant for `staffId`, and remember the id for later sessions. */
export async function seedPasscodeGrant(staffId: string): Promise<void> {
  if (staffId === '') throw new Error('seedPasscodeGrant() needs a real staff id, received "".');

  const grant: PasscodeGrant = { staffId, expiresAt: Date.now() + GRANT_DURATION_MS };

  await browser.execute(
    function (key: string, value: string) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // A webview with storage disabled just means the gate stays — not fatal.
      }
    },
    STORAGE_KEY,
    JSON.stringify(grant),
  );

  writeJson(CACHE_FILE, { staffId });
  log.info(`passcode gate skipped for 30min (staff ${staffId})`);
}

export async function clearPasscodeGrant(): Promise<void> {
  await browser.execute(function (key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clear if storage is unavailable.
    }
  }, STORAGE_KEY);
}

/**
 * Capture whatever grant the app just wrote, so later sessions can re-seed it.
 *
 * Called right after a spec unlocked a gate WITH the 30-minute box ticked. The
 * staff id comes from the app rather than from a fixture, which is what makes
 * this work on a merchant whose owner id nobody wrote down.
 */
export async function capturePasscodeGrant(): Promise<PasscodeGrant | null> {
  const grant = await readPasscodeGrant();
  if (grant) writeJson(CACHE_FILE, { staffId: grant.staffId });
  return grant;
}

/** The staff id a previous session captured, if any. */
export function cachedGrantStaffId(): string | null {
  const cached = readJsonIfExists<{ staffId?: string }>(CACHE_FILE);
  return typeof cached?.staffId === 'string' && cached.staffId !== '' ? cached.staffId : null;
}

/**
 * Make sure a usable grant is in place, without opening a dialog.
 *
 * Returns whether the gate is now skipped. `false` means the caller has to
 * unlock through the UI once — there is no cached staff id yet, or the one
 * there is no longer valid.
 *
 * The one-minute floor on the remaining window is deliberate: a grant with
 * seconds left passes a naive `expiresAt > Date.now()` and then expires between
 * the check and the navigation, which reads as a flaky gate.
 */
export async function ensurePasscodeGrant(): Promise<boolean> {
  const current = await readPasscodeGrant();
  if (current && current.expiresAt - Date.now() > 60_000) return true;

  const staffId = current?.staffId ?? cachedGrantStaffId();
  if (staffId === null) return false;

  await seedPasscodeGrant(staffId);
  return true;
}

/** Re-stamp an existing grant. For a lane long enough to outlive 30 minutes. */
export async function refreshGrant(): Promise<boolean> {
  const staffId = (await readPasscodeGrant())?.staffId ?? cachedGrantStaffId();
  if (staffId === null) return false;
  await seedPasscodeGrant(staffId);
  return true;
}
