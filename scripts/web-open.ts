/**
 * `npm run web:open [pos|gap|portal]` — open a merchant-14 web surface in Edge,
 * already signed in, and leave the window open for a person to use.
 *
 *   pos     https://pos.gocheckin.net      (GoPOS web — the default)
 *   gap     https://gap.gocheckin.net      (GAP owner portal: mini apps, GoCheckin kiosk)
 *   portal  https://v2.dev-fastboypay.com  (Fastboy Portal, Store Settings)
 *
 * The Portal only offers a GCI Business QR or Google 2FA, so it is never typed in:
 * the first `web:open portal` waits up to 10 minutes for a person to sign in, and
 * the session lives in `.portal-profile/` — the SAME profile the Portal spec lane
 * (`PORTAL_PROFILE=1`, `npm run portal:login`) uses, so one sign-in serves both
 * until the Portal expires the cookie.
 *
 * The window runs on its own Edge profile (`.gocheckin-profile/<site>/`, git-ignored),
 * so the session survives between runs: the first run signs in with
 * WEB_MERCHANT_ID / WEB_USERNAME / WEB_PASSWORD from configs/env/.env.dev, later
 * runs land straight on the signed-in screen. `detach` keeps Edge open after this
 * script and its msedgedriver exit — close the window yourself when done.
 */

import path from 'node:path';
import { remote } from 'webdriverio';
import { Paths } from '../configs/constants/paths.js';
import { env } from '../configs/env/loadEnv.js';

type Site = 'pos' | 'gap' | 'portal';

const arg = process.argv[2];
const site: Site = arg === 'gap' || arg === 'portal' ? arg : 'pos';
// One profile per site: Edge refuses a second window on a profile already open,
// so the three can stay open side by side.
const PROFILE =
  site === 'portal'
    ? path.join(Paths.ROOT, '.portal-profile')
    : path.join(Paths.ROOT, '.gocheckin-profile', site);
const PORTAL_LOGIN_WAIT_MS = 10 * 60_000;

function requireCredentials(): void {
  if (!env.WEB_USERNAME || !env.WEB_PASSWORD) {
    throw new Error('WEB_USERNAME/WEB_PASSWORD are empty — fill them in configs/env/.env.dev first.');
  }
}

async function bodyHas(browser: WebdriverIO.Browser, text: string): Promise<boolean> {
  const body = await browser.execute(() => document.body.innerText).catch(() => '');
  return typeof body === 'string' && body.toLowerCase().includes(text.toLowerCase());
}

/** GoPOS web: ID → Log In → Username + Password → Log In. A warm profile skips /login. */
async function signInPos(browser: WebdriverIO.Browser): Promise<void> {
  await browser.url(env.WEB_URL);
  await browser.pause(2_500);
  if (!(await browser.getUrl()).includes('/login')) return;
  requireCredentials();

  const id = browser.$('aria/ID');
  if (await id.isExisting()) {
    await id.setValue(env.WEB_MERCHANT_ID);
    await browser.$('aria/Log In').click();
  }
  await browser.$('aria/Username').waitForDisplayed({ timeout: 15_000 });
  await browser.$('aria/Username').setValue(env.WEB_USERNAME);
  await browser.$('aria/Password').setValue(env.WEB_PASSWORD);
  await browser.$('aria/Log In').click();
  await browser.waitUntil(async () => !(await browser.getUrl()).includes('/login'), {
    timeout: 20_000,
    timeoutMsg: 'GoPOS web login did not leave /login — check the credentials in .env.dev.',
  });
}

/** GAP as OWNER — same steps as `CheckinKioskPage.login()`. A warm profile shows "Mini Apps" at once. */
async function signInGap(browser: WebdriverIO.Browser): Promise<void> {
  await browser.url(env.GAP_URL);
  await browser.pause(2_500);
  if (await bodyHas(browser, 'mini apps')) return;
  requireCredentials();

  const lower = 'abcdefghijklmnopqrstuvwxyz';
  await browser
    .$(`//button[contains(translate(normalize-space(.), "${lower.toUpperCase()}", "${lower}"), "owner")]`)
    .click();
  await browser.$('input[placeholder="Enter your ID"]').setValue(env.WEB_MERCHANT_ID);
  await browser.$('input[placeholder="Enter your user/ email"]').setValue(env.WEB_USERNAME);
  await browser.$('input[placeholder="Enter your password"]').setValue(env.WEB_PASSWORD);
  await browser.$('//button[normalize-space()="Login"]').click();
  await browser.waitUntil(() => bodyHas(browser, 'mini apps'), {
    timeout: 20_000,
    timeoutMsg: 'GAP owner login did not reach the mini-app grid — check the credentials in .env.dev.',
  });
}

/** Portal: no typed login exists (QR / Google 2FA) — wait for a person on the login page. */
async function signInPortal(browser: WebdriverIO.Browser): Promise<void> {
  await browser.url(`${env.PORTAL_URL}/pos/nail/${env.PORTAL_MERCHANT_ID}/setting`);
  await browser.pause(3_000);
  const signedIn = async (): Promise<boolean> => {
    const url = await browser.getUrl();
    return url.startsWith(env.PORTAL_URL) && !url.includes('/login');
  };
  if (await signedIn()) return;
  console.log('Portal: sign in in the Edge window (GCI Business QR or Google) — waiting up to 10 minutes…');
  await browser.waitUntil(signedIn, {
    timeout: PORTAL_LOGIN_WAIT_MS,
    interval: 2_000,
    timeoutMsg: 'Nobody signed in to the Portal within 10 minutes.',
  });
}

async function main(): Promise<void> {
  const browser = await remote({
    logLevel: 'warn',
    capabilities: {
      browserName: 'MicrosoftEdge',
      'ms:edgeOptions': {
        args: [`--user-data-dir=${PROFILE}`, '--start-maximized', '--disable-popup-blocking'],
        detach: true,
      },
    },
  });

  if (site === 'portal') await signInPortal(browser);
  else if (site === 'gap') await signInGap(browser);
  else await signInPos(browser);

  console.log(`${site.toUpperCase()} web is open and signed in: ${await browser.getUrl()}`);
  console.log(`Profile: ${PROFILE} (the next run reuses this session)`);
  // No deleteSession(): that would close the window. `detach` keeps Edge alive
  // after msedgedriver exits with this process.
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
