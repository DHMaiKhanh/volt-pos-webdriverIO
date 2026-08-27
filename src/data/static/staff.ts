import { env } from '../../../configs/env/loadEnv.js';
import type { StaffRef } from '../../types/models.js';

/**
 * The staff members specs name by hand.
 *
 * ## These are ACCOUNT values, and nothing here can conjure them
 *
 * Every id below must already exist in the merchant under test
 * (`MERCHANT_ID`, default `14`). The suite creates orders; it does not create
 * staff, and a staff row that is missing, archived or belonging to another
 * merchant produces a tile that never renders — which surfaces as "could not
 * find staff card <id>", not as a data problem, unless the spec was told where
 * to look.
 *
 * ## How to check a value before trusting it
 *
 * 1. **On screen.** `/home` → the staff panel. Each tile is
 *    `data-testid="staff-item-<id>"`, so the id is readable straight off the
 *    DOM once the VP-802 annotations land; today `/settings/staffs` lists the
 *    same people and the row's detail URL carries the id.
 * 2. **From the app's own database — DEBUG builds only.**
 *    `VoltPosDb.tryOpen({ merchantId: env.MERCHANT_ID })?.query('SELECT id, nickname, status FROM staff')`.
 *    On a release build `tryOpen` returns `null`: the file is SQLCipher-encrypted
 *    with a per-merchant key that only the app holds, and `node:sqlite` has no
 *    cipher support. That is a limit, not a bug to work around.
 *
 * ## Why these read `process.env` directly
 *
 * They describe the DATA under test rather than the binary being driven, which
 * is the same reason `MERCHANT_TIME_ZONE` is read straight from the environment
 * in `src/utils/date.ts`. `AppEnv` stays the contract for "how do I launch and
 * drive the app"; fixtures stay out of it.
 *
 * A spec whose subject is the ORDER, not the person, should pass no staff at
 * all — `createOrder()` then takes the first tile and needs none of this.
 */

/**
 * The staff member most specs book a line to.
 *
 * `STAFF_NAME` comes from `AppEnv` because the login and permission paths
 * already use it; `STAFF_ID` is fixture-only and therefore read here. Leaving
 * `STAFF_ID` unset is legitimate — {@link requireStaffRef} is what turns "unset"
 * into a sentence instead of a selector failure.
 */
export const primaryStaff: StaffRef = {
  id: (process.env.STAFF_ID ?? '').trim(),
  nickname: env.STAFF_NAME,
};

/**
 * A second, different staff member.
 *
 * Needed by the flows that only mean something with two people on the order:
 * change-staff, split-by-staff, and the per-staff income reports. It must NOT be
 * the same person as {@link primaryStaff} — a split assertion passes vacuously
 * when both columns are one staff member.
 */
export const secondaryStaff: StaffRef = {
  id: (process.env.SECOND_STAFF_ID ?? '').trim(),
  nickname: (process.env.SECOND_STAFF_NAME ?? '').trim(),
};

/** Every named staff fixture, for a spec that wants to state its own prerequisites. */
export const staffFixtures: readonly StaffRef[] = [primaryStaff, secondaryStaff];

/**
 * Assert a staff fixture is actually configured, and say what to set when it is not.
 *
 * Call it at the top of a spec that cannot run without a named person, so the
 * run fails in the `before` hook with the variable name rather than three steps
 * later inside a locator.
 */
export function requireStaffRef(staff: StaffRef, envVar = 'STAFF_ID'): StaffRef {
  if (staff.id !== '') return staff;

  throw new Error(
    `This spec needs a specific staff member, but ${envVar} is not set for merchant ` +
      `${env.MERCHANT_ID}.\nSet it in configs/env/.env.${env.ENV} or configs/env/.env.local — ` +
      `the id is the one in the tile's data-testid ("staff-item-<id>") on /home.\n` +
      `If the spec does not actually care WHO takes the order, omit the staff reference instead ` +
      `and let createOrder() use the first tile.`,
  );
}
