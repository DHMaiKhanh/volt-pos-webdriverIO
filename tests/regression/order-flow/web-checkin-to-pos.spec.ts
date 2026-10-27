/**
 * WEB CHECK-IN → POS sync — Phase B of the GoCheckin cross-surface check.
 *
 * Confirms that a check-in created on the GoCheckin kiosk (Phase A,
 * `tests/web/create-checkin.spec.ts`, which drives gap.gocheckin.net → GoCheckin
 * mini app) syncs down to the Volt POS desktop app and surfaces on the Home /
 * Order-pending screen as a waiting customer.
 *
 * ## How the two phases meet
 *
 * They are separate WebdriverIO runs — different browsers, different configs —
 * so the web lane leaves the check-in's correlation key in
 * `.tmp/web-checkin-handoff.json` and this spec reads it back. No handoff file ⇒
 * the web lane has not run, so this spec SKIPS rather than fails: it is a second
 * half with nothing to verify, not a regression.
 *
 * ## Same-store precondition (read this before trusting a pass)
 *
 * Sync only crosses within one store. Phase A checks in on tenant 14 ("Tenant
 * Test Volpos"); this app drives `MERCHANT_ID`. If the app on this machine is
 * signed into a DIFFERENT merchant the check-in will never appear here, and that
 * is correct behaviour, not a bug — align the two before reading into a failure.
 *
 * ## Sync latency
 *
 * The GoCheckin → Volt POS pull is an upstream round trip and on a cold boot the
 * first pull can lag a couple of minutes. We poll Home / Order-pending for the
 * full boot budget; a single cold run that misses the window usually passes on
 * the lane's one retry (fresh boot = fresh pull).
 *
 * ## How to run
 *
 *   npm run test:web2checkin           # Phase A (kiosk create) + this spec, in one go
 *
 * or the two halves separately:
 *
 *   npm run web:checkin                # Phase A — creates the check-in + handoff
 *   npm run test:checkin-to-pos        # this spec, on the launch lane
 *
 * READ-ONLY on the app: it only navigates and reads.
 */

import { browser, expect } from '@wdio/globals';
import { readCheckinHandoff } from '../../../src/pages/web/checkinHandoff.js';
import { loadEnv } from '../../../configs/env/loadEnv.js';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../../src/constants/routes.js';
import { goTo } from '../../../src/helpers/navigate.js';
import { settle } from '../../../src/helpers/wait.js';

const env = loadEnv();
const handoff = readCheckinHandoff();

describe('WEB CHECK-IN → POS sync', () => {
  before(function () {
    if (!handoff) {
      // eslint-disable-next-line no-console
      console.log('[web-checkin] No handoff file — run `npm run web:checkin` first. Skipping.');
      this.skip();
    }
  });

  it('shows the GoCheckin web check-in as a pending order on the app', async function () {
    if (!handoff) return; // guarded by before(); keeps the type-checker happy

    if (env.MERCHANT_ID !== env.WEB_MERCHANT_ID) {
      // eslint-disable-next-line no-console
      console.log(
        `[web-checkin] app MERCHANT_ID=${env.MERCHANT_ID} but the check-in was made on ` +
          `merchant ${env.WEB_MERCHANT_ID}. Different store cannot sync. Skipping.`,
      );
      this.skip();
    }

    // A GoCheckin walk-in can surface as a pending order (/home, /order-pending)
    // OR as a waiting entry on the Appointment board — in manual inspection the
    // Appointment tab carried a "1" badge while Pending Orders was empty. Scan
    // all three and log each screen's text so a miss is diagnosable.
    const routesToScan = [Routes.HOME, Routes.APPOINTMENT, Routes.ORDER_PENDING];

    const needle = (hay: string): boolean => {
      const t = hay.toLowerCase();
      return t.includes(handoff.name.toLowerCase()) || t.includes(handoff.phone) || t.includes(handoff.last4);
    };

    const isListed = async (): Promise<boolean> => {
      for (const route of routesToScan) {
        await goTo(route).catch(() => undefined);
        await settle(Timeouts.ANIMATION);
        const text = await browser.execute(() => document.body.innerText).catch(() => '');
        const body = typeof text === 'string' ? text : '';
        // eslint-disable-next-line no-console
        console.log(
          `[web-checkin] ${route} (${body.length} chars): ${body.replace(/\s+/g, ' ').slice(0, 500)}`,
        );
        if (needle(body)) {
          // eslint-disable-next-line no-console
          console.log(`[web-checkin] FOUND "${handoff.name}" on ${route}`);
          return true;
        }
      }
      return false;
    };

    await browser.waitUntil(isListed, {
      timeout: Timeouts.APP_BOOT,
      interval: 3_000,
      timeoutMsg:
        `Web check-in for "${handoff.name}" (phone ${handoff.phone}, created ${handoff.createdAtLabel}) ` +
        'did not appear on the app Home / Order-pending within the sync window.',
    });

    expect(await isListed()).toBe(true);
  });
});
