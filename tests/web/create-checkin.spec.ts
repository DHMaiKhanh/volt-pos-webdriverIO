import { checkinKioskPage } from '../../src/pages/web/CheckinKioskPage.js';
import { writeCheckinHandoff, CHECKIN_HANDOFF_FILE } from '../../src/pages/web/checkinHandoff.js';

/**
 * WEB-02 — Phase A of the GoCheckin cross-surface check.
 *
 * Log into GAP as OWNER, open the **GoCheckin** mini app, and walk the kiosk
 * wizard (phone → name → service → staff → consent + signature) to create one
 * check-in, then persist its correlation key to the handoff file. The app lane
 * (`tests/regression/order-flow/web-checkin-to-pos.spec.ts`) reads that key to
 * confirm the same check-in synced down to the Volt POS Home screen.
 *
 * Runs on the web lane: `npm run web:checkin`.
 */
describe('WEB-02 create check-in on GoCheckin kiosk', () => {
  it('logs in, runs the kiosk wizard, and records the check-in', async () => {
    await checkinKioskPage.login();
    await checkinKioskPage.openKiosk();

    const handoff = await checkinKioskPage.createCheckin();
    handoff.createdAtLabel = new Date().toISOString();

    writeCheckinHandoff(handoff);
    /* eslint-disable no-console */
    console.log(`\n[WEB-02] Check-in created → ${CHECKIN_HANDOFF_FILE}`);
    console.log(`         ${JSON.stringify(handoff)}\n`);
    /* eslint-enable no-console */
  });
});
