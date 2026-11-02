import { expect } from '@wdio/globals';
import { portalSettingsPage } from '../../src/pages/web/PortalSettingsPage.js';

/**
 * Fastboy Portal half of VP-4812 — set "Earn points on tip" before the POS half
 * (`tests/regression/earn-points-on-tip/earn-points-on-tip.spec.ts`) measures it.
 *
 *   PORTAL_EARN_ON_TIP=on|off   the value to leave the merchant on
 *   PORTAL_LOGIN=1              portal:login — wait for a QR scan instead of failing
 *
 * EPT-01 (toggle saves and survives a reload) is asserted here on every run.
 * Runs in Edge on the QR-signed `.portal-profile/` (`npm run portal:earn-on-tip:on`).
 */
const LOGIN_WAIT_MS = 8 * 60_000;

/* eslint-disable no-console -- the web lanes report what they did on stdout, like create-appointment.spec.ts */
describe('Portal — Earn points on tip (VP-4812)', () => {
  const wanted = (process.env.PORTAL_EARN_ON_TIP ?? '').toLowerCase();

  it('EPT-01: the toggle saves and survives a reload', async () => {
    await portalSettingsPage.open(process.env.PORTAL_LOGIN === '1' ? LOGIN_WAIT_MS : 0);
    if (wanted !== 'on' && wanted !== 'off') {
      // portal:login with no target: the scan is the whole job.
      console.log(
        `[portal] signed in; "Earn points on tip" is ${(await portalSettingsPage.isEarnOnTip()) ? 'ON' : 'OFF'}`,
      );
      return;
    }

    const on = wanted === 'on';
    const { changed } = await portalSettingsPage.setEarnOnTip(on);
    await portalSettingsPage.open();
    expect(await portalSettingsPage.isEarnOnTip()).toBe(on);
    console.log(`[portal] "Earn points on tip" = ${on ? 'ON' : 'OFF'}${changed ? ' (saved)' : ' (already)'}`);
  });
});
