/**
 * `npm run web:open [pos|gap|portal] [--store <id>] [--env dev|prod]` — open one
 * store's web surface in Edge, already signed in, and leave the window open.
 *
 *   pos     https://pos.gocheckin.net      (GoCheckin / GoPOS web — the default)
 *   gap     https://gap.gocheckin.net      (GAP Checkin owner portal)
 *   portal  https://v2.dev-fastboypay.com  (Fastboy Portal, Store Settings)
 *
 * Accounts come from `configs/web-accounts.json` (one entry per store and site);
 * without `--store`, merchant 14 on dev — whose account falls back to
 * WEB_MERCHANT_ID / WEB_USERNAME / WEB_PASSWORD in configs/env/.env.dev.
 *
 * The Portal only offers a GCI Business QR or Google 2FA, so it is never typed in:
 * `web:open portal` waits for a person to sign in (10 min; `--no-wait` returns at
 * once — the GUI preflight uses that and polls the window itself), and the session
 * lives in the store's Portal profile (`.portal-profile/` for store 14 — the SAME
 * profile the Portal spec lane uses).
 *
 * Each window runs on its own Edge profile (git-ignored) with DevTools on the
 * site's `cdpPort`, so the session survives between runs and the GUI runner can
 * read the page URL to tell "signed in" from "on the login page". `detach` keeps
 * Edge open after this script and its msedgedriver exit.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { remote } from 'webdriverio';
import { Paths } from '../configs/constants/paths.js';
import { env } from '../configs/env/loadEnv.js';

type Site = 'pos' | 'gap' | 'portal';

interface SiteAccount {
  url: string;
  merchantId: string;
  username?: string;
  password?: string;
  login?: 'qr';
  cdpPort: number;
}
interface StoreAccount {
  id: string;
  name?: string;
  gocheckin: SiteAccount;
  gap: SiteAccount;
  portal: SiteAccount;
}

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const site: Site = argv.includes('gap') ? 'gap' : argv.includes('portal') ? 'portal' : 'pos';
const runEnv = flag('env') === 'prod' ? 'prod' : 'dev';
const storeId = flag('store') ?? (runEnv === 'dev' ? '14' : '');
const noWait = argv.includes('--no-wait');
const PORTAL_LOGIN_WAIT_MS = 10 * 60_000;

function loadAccount(): SiteAccount {
  const file = path.join(Paths.ROOT, 'configs', 'web-accounts.json');
  const all = JSON.parse(readFileSync(file, 'utf8')) as Record<string, StoreAccount[] | string[]>;
  const store = (all[runEnv] as StoreAccount[] | undefined)?.find((s) => s.id === storeId);
  if (!store) throw new Error(`configs/web-accounts.json has no store "${storeId}" under "${runEnv}".`);
  const acc = { ...(site === 'pos' ? store.gocheckin : site === 'gap' ? store.gap : store.portal) };
  // Store 14 on dev keeps working from .env.dev when the JSON entry is blank.
  if (runEnv === 'dev' && storeId === '14' && site !== 'portal') {
    acc.merchantId ||= env.WEB_MERCHANT_ID;
    acc.username ||= env.WEB_USERNAME;
    acc.password ||= env.WEB_PASSWORD;
  }
  return acc;
}

/** Store 14 on dev keeps the profiles it always had, so existing sign-ins carry over. */
function profileDir(): string {
  const legacy = runEnv === 'dev' && storeId === '14';
  if (site === 'portal')
    return path.join(Paths.ROOT, legacy ? '.portal-profile' : `.portal-profile-${runEnv}-${storeId}`);
  return legacy
    ? path.join(Paths.ROOT, '.gocheckin-profile', site)
    : path.join(Paths.ROOT, '.gocheckin-profile', `${runEnv}-${storeId}`, site);
}

const acc = loadAccount();

function requireCredentials(): void {
  if (!acc.merchantId || !acc.username || !acc.password) {
    throw new Error(
      `Store ${storeId}: ${site === 'pos' ? 'GoCheckin' : 'GAP'} has no merchantId/username/password — fill them in configs/web-accounts.json.`,
    );
  }
}

async function bodyHas(browser: WebdriverIO.Browser, text: string): Promise<boolean> {
  const body = await browser.execute(() => document.body.innerText).catch(() => '');
  return typeof body === 'string' && body.toLowerCase().includes(text.toLowerCase());
}

/** GoPOS web: ID → Log In → Username + Password → Log In. A warm profile skips /login. */
async function signInPos(browser: WebdriverIO.Browser): Promise<void> {
  await browser.url(acc.url);
  await browser.pause(2_500);
  if (!(await browser.getUrl()).includes('/login')) return;
  requireCredentials();

  const id = browser.$('aria/ID');
  if (await id.isExisting()) {
    await id.setValue(acc.merchantId);
    await browser.$('aria/Log In').click();
  }
  await browser.$('aria/Username').waitForDisplayed({ timeout: 15_000 });
  await browser.$('aria/Username').setValue(acc.username ?? '');
  await browser.$('aria/Password').setValue(acc.password ?? '');
  await browser.$('aria/Log In').click();
  await browser.waitUntil(async () => !(await browser.getUrl()).includes('/login'), {
    timeout: 20_000,
    timeoutMsg: `GoCheckin login for store ${storeId} did not leave /login — check configs/web-accounts.json.`,
  });
}

/** GAP as OWNER — same steps as `CheckinKioskPage.login()`. A warm profile shows "Mini Apps" at once. */
async function signInGap(browser: WebdriverIO.Browser): Promise<void> {
  await browser.url(acc.url);
  await browser.pause(2_500);
  if (await bodyHas(browser, 'mini apps')) return;
  requireCredentials();

  const lower = 'abcdefghijklmnopqrstuvwxyz';
  await browser
    .$(`//button[contains(translate(normalize-space(.), "${lower.toUpperCase()}", "${lower}"), "owner")]`)
    .click();
  await browser.$('input[placeholder="Enter your ID"]').setValue(acc.merchantId);
  await browser.$('input[placeholder="Enter your user/ email"]').setValue(acc.username ?? '');
  await browser.$('input[placeholder="Enter your password"]').setValue(acc.password ?? '');
  await browser.$('//button[normalize-space()="Login"]').click();
  await browser.waitUntil(() => bodyHas(browser, 'mini apps'), {
    timeout: 20_000,
    timeoutMsg: `GAP owner login for store ${storeId} did not reach the mini-app grid — check configs/web-accounts.json.`,
  });
}

/** Portal: no typed login exists (QR / Google 2FA) — wait for a person on the login page. */
async function signInPortal(browser: WebdriverIO.Browser): Promise<void> {
  const base = acc.url.replace(/\/+$/, '');
  await browser.url(`${base}/pos/nail/${acc.merchantId}/setting`);
  await browser.pause(3_000);
  const signedIn = async (): Promise<boolean> => {
    const url = await browser.getUrl();
    return url.startsWith(base) && !url.includes('/login');
  };
  if (await signedIn()) return;
  if (noWait) {
    console.log(`Portal (store ${storeId}): not signed in — scan the GCI Business QR in the Edge window.`);
    return;
  }
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
        args: [`--user-data-dir=${profileDir()}`, '--start-maximized', '--disable-popup-blocking'],
        detach: true,
      },
    },
  });

  if (site === 'portal') await signInPortal(browser);
  else if (site === 'gap') await signInGap(browser);
  else await signInPos(browser);

  console.log(`${site.toUpperCase()} (store ${storeId}) is open: ${await browser.getUrl()}`);
  console.log(`Profile: ${profileDir()}`);
  // No deleteSession(): that would close the window. `detach` keeps Edge alive
  // after msedgedriver exits with this process.
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
