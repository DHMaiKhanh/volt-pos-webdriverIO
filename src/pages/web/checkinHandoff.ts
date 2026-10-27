import fs from 'node:fs';
import path from 'node:path';
import { Paths } from '../../../configs/constants/paths.js';
import type { CheckinHandoff } from './CheckinKioskPage.js';

/**
 * Where the GoCheckin web lane leaves the check-in it created, so the app lane —
 * a separate WebdriverIO process with its own config — can read the correlation
 * key back. Mirrors `handoff.ts` (appointments) but with its own file, so the
 * two cross-surface flows never clobber each other's handoff. `.tmp/` is already
 * git-ignored and wiped by `npm run clean`.
 */
export const CHECKIN_HANDOFF_FILE = path.join(Paths.TMP, 'web-checkin-handoff.json');

export function writeCheckinHandoff(handoff: CheckinHandoff): void {
  fs.mkdirSync(Paths.TMP, { recursive: true });
  fs.writeFileSync(CHECKIN_HANDOFF_FILE, JSON.stringify(handoff, null, 2), 'utf8');
}

/** Read the handoff, or null if the GoCheckin web lane has not run yet. */
export function readCheckinHandoff(): CheckinHandoff | null {
  if (!fs.existsSync(CHECKIN_HANDOFF_FILE)) return null;
  return JSON.parse(fs.readFileSync(CHECKIN_HANDOFF_FILE, 'utf8')) as CheckinHandoff;
}

/**
 * Bulk lane (`npm run web:checkin-bulk`): every check-in the loop creates is
 * APPENDED here as soon as it commits, so a run that dies at #63 still leaves
 * 62 verifiable keys behind and the app-side bulk verify can count them.
 */
export const CHECKIN_BULK_FILE = path.join(Paths.TMP, 'web-checkin-bulk.json');

export function readCheckinBulk(): CheckinHandoff[] {
  if (!fs.existsSync(CHECKIN_BULK_FILE)) return [];
  return JSON.parse(fs.readFileSync(CHECKIN_BULK_FILE, 'utf8')) as CheckinHandoff[];
}

export function appendCheckinBulk(handoff: CheckinHandoff): void {
  const all = readCheckinBulk();
  all.push(handoff);
  fs.mkdirSync(Paths.TMP, { recursive: true });
  fs.writeFileSync(CHECKIN_BULK_FILE, JSON.stringify(all, null, 2), 'utf8');
}
