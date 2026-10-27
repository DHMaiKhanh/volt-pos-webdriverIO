/**
 * WEB→POS sync — Phase B of the cross-surface check.
 *
 * Confirms that an appointment created on the GoPOS web POS (Phase A,
 * `tests/web/create-appointment.spec.ts`) syncs down to the Volt POS desktop
 * app and lands on the Appointment calendar.
 *
 * ## How the two phases meet
 *
 * They are separate WebdriverIO runs — different browsers, different configs —
 * so the web lane leaves the appointment's correlation key in
 * `.tmp/web-appointment-handoff.json` and this spec reads it back. No handoff
 * file ⇒ the web lane has not run, so this spec SKIPS rather than fails: it is a
 * second half with nothing to verify, not a regression.
 *
 * ## Same-store precondition (read this before trusting a pass)
 *
 * Sync only crosses stores that are the same store. The web lane signs into
 * `WEB_MERCHANT_ID` (14, "Fastboy Nails"); this app drives `MERCHANT_ID`. If the
 * app on this machine is signed into a DIFFERENT merchant, the appointment will
 * never appear here and that is correct behaviour, not a bug — align the two
 * before reading into a failure. See [[gopos-web-login-appointment-flow]].
 *
 * ## How to run
 *
 *   npm run test:web2pos             # Phase A (web create) + this spec, in one go
 *
 * or the two halves separately:
 *
 *   npm run web:appointment          # Phase A — creates the appointment + handoff
 *   npm run test:web-to-pos          # this spec, on the launch lane (tauri-driver
 *                                    #   boots the till; the attach lane only
 *                                    #   exposes the customer-display window)
 *
 * READ-ONLY on the app: it only opens the calendar and reads it.
 */

import { browser, expect } from '@wdio/globals';
import { readHandoff } from '../../../src/pages/web/handoff.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../../src/constants/routes.js';
import { goTo } from '../../../src/helpers/navigate.js';
import { settle } from '../../../src/helpers/wait.js';

const env = loadEnv();
const handoff = readHandoff();

describe('WEB→POS appointment sync', () => {
  before(function () {
    if (!handoff) {
      // eslint-disable-next-line no-console
      console.log('[web-to-pos] No handoff file — run `npm run web:appointment` first. Skipping.');
      this.skip();
    }
  });

  it('shows the web-created appointment on the app calendar', async function () {
    if (!handoff) return; // guarded by before(); keeps the type-checker happy

    if (env.WEB_MERCHANT_ID !== env.MERCHANT_ID) {
      // eslint-disable-next-line no-console
      console.log(
        `[web-to-pos] WEB_MERCHANT_ID=${env.WEB_MERCHANT_ID} but app MERCHANT_ID=${env.MERCHANT_ID}. ` +
          'The appointment was created on a different store, so it cannot sync here. Skipping.',
      );
      this.skip();
    }

    // Go to the calendar. We deliberately do NOT use AppointmentPage.open() — its
    // readyAnchor is a testid the installed 1.1.x build strips, so it would time
    // out on a screen that is actually rendering. A client-side route change is
    // enough; the sync-presence check below is what proves readiness.
    await goTo(Routes.APPOINTMENT);

    const name = handoff.customerName;
    const isListed = async (): Promise<boolean> => {
      // Reading the rendered text sidesteps every per-card testid/class question:
      // if the synced appointment is on the calendar, the customer's name is in
      // the document. Re-navigate each poll so a late sync is picked up.
      await goTo(Routes.APPOINTMENT);
      await settle(Timeouts.ANIMATION);
      const text = await browser.execute(() => document.body.innerText).catch(() => '');
      return typeof text === 'string' && text.toLowerCase().includes(name.toLowerCase());
    };

    // Sync is an upstream round trip, and on a cold boot the first pull can lag.
    // Give it the full boot budget and poll the calendar.
    await browser.waitUntil(isListed, {
      timeout: Timeouts.APP_BOOT,
      interval: 3_000,
      timeoutMsg:
        `Appointment for "${name}" (created on web at ${handoff.createdAtLabel}) ` +
        'did not appear on the app calendar within the sync window.',
    });

    expect(await isListed()).toBe(true);
  });
});
