import { orderSitePage } from '../../src/pages/web/OrderSitePage.js';
import { writeHandoff, HANDOFF_FILE } from '../../src/pages/web/handoff.js';

/**
 * WEB-01 — Phase A of the cross-surface check.
 *
 * Log into the GoPOS web POS and create an appointment, then persist its
 * correlation key to the handoff file. The app lane
 * (`tests/regression/order-flow/web-to-pos-pending.spec.ts`) reads that key to
 * confirm the same appointment synced down to Volt POS.
 *
 * Runs on its own lane: `npm run web:appointment`.
 */
describe('WEB-01 create appointment on GoPOS web', () => {
  it('logs in and creates an appointment that syncs upstream', async () => {
    await orderSitePage.login();

    const handoff = await orderSitePage.createAppointment();
    handoff.createdAtLabel = new Date().toISOString();

    writeHandoff(handoff);
    /* eslint-disable no-console */
    console.log(`\n[WEB-01] Appointment created → ${HANDOFF_FILE}`);
    console.log(`         ${JSON.stringify(handoff)}\n`);
    /* eslint-enable no-console */
  });
});
