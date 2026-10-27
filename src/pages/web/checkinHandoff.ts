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

/**
 * Checkout Type lane (VP-4591, `npm run web:checkout-type-checkin`).
 *
 * Every Checkout Type case completes an order that came from a GoCheckin
 * kiosk check-in — an order created on POS has no check-in until it completes,
 * so it is not the flow the feature is about. One customer can hold only ONE
 * active check-in, so the web lane checks in a separate fresh customer per case
 * and records `case id → customer` here; the app lane opens that customer's
 * pending order. Each entry is written as soon as its check-in commits, so a run
 * that dies part-way still leaves the cases it reached usable.
 */
export const CHECKOUT_TYPE_CHECKINS_FILE = path.join(Paths.TMP, 'checkout-type-checkins.json');

/**
 * The cases whose order comes from a kiosk check-in — every automated case in
 * tests/regression/checkout-type/checkout-type.spec.ts except CHK-POS-033,
 * which exists to test an order created on POS.
 */
export const CHECKOUT_TYPE_GCI_CASES = [
  'CHK-POS-001',
  'CHK-POS-002',
  'CHK-POS-006',
  'CHK-POS-007',
  'CHK-POS-009',
  'CHK-POS-010',
  'CHK-POS-011',
  'CHK-POS-012',
  'CHK-POS-013',
  'CHK-POS-014',
  'CHK-POS-015',
  'CHK-POS-017',
  'CHK-POS-018',
  'CHK-POS-021',
  'CHK-POS-022',
  'CHK-POS-023',
] as const;

export type CheckoutTypeCheckins = Record<string, CheckinHandoff>;

export function readCheckoutTypeCheckins(): CheckoutTypeCheckins {
  if (!fs.existsSync(CHECKOUT_TYPE_CHECKINS_FILE)) return {};
  return JSON.parse(fs.readFileSync(CHECKOUT_TYPE_CHECKINS_FILE, 'utf8')) as CheckoutTypeCheckins;
}

export function recordCheckoutTypeCheckin(caseId: string, handoff: CheckinHandoff): void {
  const all = readCheckoutTypeCheckins();
  all[caseId] = handoff;
  fs.mkdirSync(Paths.TMP, { recursive: true });
  fs.writeFileSync(CHECKOUT_TYPE_CHECKINS_FILE, JSON.stringify(all, null, 2), 'utf8');
}
