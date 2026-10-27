import fs from 'node:fs';
import { browser } from '@wdio/globals';
import { checkinKioskPage, CHECKIN_DAILY_LIMIT_ERROR } from '../../src/pages/web/CheckinKioskPage.js';
import {
  CHECKOUT_TYPE_CHECKINS_FILE,
  CHECKOUT_TYPE_GCI_CASES,
  readCheckoutTypeCheckins,
  recordCheckoutTypeCheckin,
} from '../../src/pages/web/checkinHandoff.js';

/**
 * WEB-04 — check-ins for the Checkout Type specs (VP-4591), web half.
 *
 * Every automated Checkout Type case (except CHK-POS-033) completes an order
 * that came from a kiosk check-in, because an order created on POS carries no
 * check-in until it completes — see docs/screens/checkout-type/checkout-type-test-cases.md
 * "Điều kiện chung". This lane logs into GAP as OWNER, opens the **GoCheckin**
 * mini app (iframe `gap.gocheckin.net/iframe`) and checks in ONE fresh customer
 * per case — a customer can hold only one active check-in — then records
 * `case id → customer` in `.tmp/checkout-type-checkins.json` for the app half
 * (`tests/regression/checkout-type/checkout-type.spec.ts`).
 *
 * - `CHECKOUT_TYPE_CASES=CHK-POS-007,CHK-POS-013` limits the run to those cases
 *   (default: all of {@link CHECKOUT_TYPE_GCI_CASES}). Check in only what the
 *   Portal's current Checkout Type will run: every check-in left unused stays a
 *   pending order on the till.
 * - The file is reset each run, so the app half never completes a stale order.
 *
 * Runs on the web lane: `npm run web:checkout-type-checkin`
 * (or `npm run test:checkout-type-gci` for both halves).
 */

// The shared app glob (`tests/**/*.spec.ts`) also matches this file — opt in explicitly.
const ENABLED = process.env.CHECKOUT_TYPE_CHECKIN === '1';

const CASES: readonly string[] = (() => {
  const only = (process.env.CHECKOUT_TYPE_CASES ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');
  if (only.length === 0) return CHECKOUT_TYPE_GCI_CASES;
  const unknown = only.filter((id) => !(CHECKOUT_TYPE_GCI_CASES as readonly string[]).includes(id));
  if (unknown.length > 0) {
    throw new Error(
      `CHECKOUT_TYPE_CASES has ${unknown.join(', ')}, which do not run on a kiosk order. ` +
        `Pick from: ${CHECKOUT_TYPE_GCI_CASES.join(', ')}.`,
    );
  }
  return only;
})();

/** Run tag shared by every customer of this run — fresh numbers, never a prior run's card. */
const BATCH = Date.now().toString().slice(-5);

(ENABLED ? describe : describe.skip)(`WEB-04 Checkout Type check-ins (${String(CASES.length)} cases)`, () => {
  before(() => {
    if (fs.existsSync(CHECKOUT_TYPE_CHECKINS_FILE)) fs.rmSync(CHECKOUT_TYPE_CHECKINS_FILE);
  });

  it('checks in one fresh customer per case on the GoCheckin kiosk', async () => {
    await checkinKioskPage.login();
    await checkinKioskPage.openKiosk();

    /* eslint-disable no-console */
    for (const caseId of CASES) {
      const seq = caseId.replace(/\D/g, '').padStart(3, '0').slice(-3);
      const input = { phone: `8${BATCH}2${seq}`, name: `CT${seq} T${BATCH}` };
      try {
        const handoff = await checkinKioskPage.createCheckin(input);
        handoff.createdAtLabel = new Date().toISOString();
        recordCheckoutTypeCheckin(caseId, handoff);
        console.log(`[WEB-04] ${caseId} → ${handoff.name} ${handoff.phone}`);
      } catch (error) {
        // The store's daily cap will not lift by retrying.
        if (String(error).includes(CHECKIN_DAILY_LIMIT_ERROR)) throw error;
        // One retry on a fresh session: a wedged GAP tab times out every later command.
        console.log(`[WEB-04] ${caseId} failed once, retrying: ${String(error).slice(0, 200)}`);
        await browser.reloadSession().catch(() => undefined);
        await checkinKioskPage.login();
        await checkinKioskPage.openKiosk();
        const handoff = await checkinKioskPage.createCheckin(input);
        handoff.createdAtLabel = new Date().toISOString();
        recordCheckoutTypeCheckin(caseId, handoff);
        console.log(`[WEB-04] ${caseId} → ${handoff.name} ${handoff.phone} (after retry)`);
      }
    }

    const recorded = Object.keys(readCheckoutTypeCheckins()).length;
    console.log(`[WEB-04] DONE ${String(recorded)}/${String(CASES.length)} → ${CHECKOUT_TYPE_CHECKINS_FILE}`);
    /* eslint-enable no-console */
  });
});
