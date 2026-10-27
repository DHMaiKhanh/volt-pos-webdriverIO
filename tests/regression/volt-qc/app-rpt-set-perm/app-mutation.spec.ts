/**
 * volt-qc module 01-app (APP-*) — the `@mutation` / `@settings` cases plus the
 * remaining rows that can run on a live till.
 *
 * Source: volt-qc `e2e/tests/01-app/app-plan.spec.ts` (NAV-20, NAV-23, NAV-24,
 * NAV-25), `app-deep.spec.ts` (APP-D02 Reload, APP-D04 notifications, APP-D05
 * Vietnamese), and the TC rows APP-001, 002, 003, 009, 010, 049, 061, 063, 081-084,
 * 121, 123, 132
 * of docs/qc/volt-qc/windows-regression/01-khoi-dong-dang-nhap-dieu-huong.md
 * (written from the row).
 *
 * Writes: drafts on the till (deleted after), "Mark all as read" on the
 * notifications (accepted on the dev store), Appearance and Language switched
 * and restored (Tag.EXCLUSIVE). Offline is FAKED (`navigator.onLine` + the
 * offline event) — the network is never cut. Reload (sidebar, F5) reboots the
 * WebView; those cases are Tag.SLOW.
 */

import { browser, expect } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed, env } from '../../../../configs/env/loadEnv.js';
import { appNav } from '../../../../src/components/index.js';
import {
  AspChrome,
  AspIds,
  AspText,
  AspVi,
} from '../../../../src/constants/testids.voltqc-app-rpt-set-perm.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle, waitUntilPath } from '../../../../src/helpers/wait.js';
import { CUSTOMER_WINDOW_TITLE, listWindows } from '../../../../src/helpers/window.js';
import { homePage, orderPendingPage } from '../../../../src/pages/index.js';
import { appShellProbe } from '../../../../src/pages/voltqc/app-perm/AppShellProbe.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import {
  bodyText,
  buildHomeDraft,
  cleanTill,
  customerIsDark,
  customerText,
  goAnyLang,
  isDark,
  log,
  openAccessibility,
  ownerCode,
  restoreEnglish,
  setLanguage,
  waitCustomerText,
} from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import { BUSINESS_FIELD_NAMES_VQ, Vq } from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { fakeOnline, openSidebar } from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const PROD_SIDEBAR = [
  'Home',
  'Order History',
  'Batch History',
  'Daily Sale Report',
  'Income Summary',
  'Staff Income',
  'Staff Payroll',
  'Time Keeping',
  'Time Tracking',
  'Turn',
  'Setting',
  'Reload',
];

/** `#network-status`: shown flag + text. */
async function networkStatus(): Promise<{ shown: boolean; text: string }> {
  return browser.execute(function () {
    const el = document.querySelector<HTMLElement>('#network-status');
    if (!el) return { shown: false, text: '' };
    const flag = el.getAttribute('data-show-network-status');
    const visible = el.getClientRects().length > 0 && flag !== 'false';
    return { shown: visible, text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() };
  });
}

async function waitNetwork(re: RegExp, shown: boolean, timeout: number = Timeouts.SHORT): Promise<boolean> {
  const end = Date.now() + timeout;
  do {
    const s = await networkStatus();
    if (s.shown === shown && (!shown || re.test(s.text))) return true;
    await settle(200);
  } while (Date.now() < end);
  return false;
}

/** The header bell's badge text ('' when none). */
async function bellBadge(): Promise<string> {
  return browser.execute(function () {
    const bell = Array.from(document.querySelectorAll('header button')).find((b) =>
      /notification|thông báo/i.test(`${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`),
    );
    if (!bell) return '';
    const badge = Array.from(bell.querySelectorAll('span, div')).find((s) =>
      /^\d+\+?$/.test((s.textContent ?? '').trim()),
    );
    return (badge?.textContent ?? '').trim();
  });
}

const pageZoom = (): Promise<number> =>
  browser.execute(function () {
    return (
      Math.round((window.outerWidth / window.innerWidth) * 100) / 100 + (window.visualViewport?.scale ?? 1)
    );
  });

describe('volt-qc APP — shell, reload, offline banner, notifications (mutation)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('create drafts, mark notifications read and switch Appearance / Language');
    await cleanTill();
  });

  afterEach(async () => {
    await fakeOnline(true).catch(() => undefined);
    await gateProbe.dismiss().catch(() => undefined);
    if (await appNav.isSidebarOpen().catch(() => false)) await appNav.closeSidebar().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await restoreEnglish();
    await ensurePasscodeGrant();
    await cleanTill().catch(() => undefined);
  });

  it(
    title(
      'Two windows are open: "Volt POS" and "Volt POS - Customer Display" on /customer (APP-001)',
      Tag.REGRESSION,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      const wins = await listWindows();
      log.info(`APP-001 windows: ${wins.map((w) => `${w.title} ${w.url}`).join(' | ')}`);
      if (wins.length < 2) {
        log.warn('APP-001: only one window handle in this lane (attach)');
        this.skip();
      }
      expect(wins.length).toBe(2);
      expect(wins.some((w) => w.title === CUSTOMER_WINDOW_TITLE && w.url.includes('/customer'))).toBe(true);
      expect(wins.some((w) => /^volt pos$/i.test(w.title.trim()))).toBe(true);
    },
  );

  it(
    title('Prod-like build: no DEV / STAGING env badge in the header (APP-002)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      await orderPendingPage.open();
      const badges = await vqProbe.count(Vq.envBadge());
      const header = await bodyText('header');
      if (env.ENV !== 'prod' && (badges > 0 || /\b(DEV|STAGING)\b/.test(header))) {
        log.warn(`APP-002: ${env.ENV} build shows its env badge — the prod-only row does not apply`);
        this.skip();
      }
      expect(badges).toBe(0);
      expect(/\b(DEV|STAGING)\b/.test(header)).toBe(false);
    },
  );

  it(
    title(
      'Store guard: away from /home the customer display idles on "WELCOME TO" + the store business name (APP-003)',
      Tag.REGRESSION,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await goAnyLang('/settings/business');
      const business = (await vqProbe.inputValue(Vq.named(BUSINESS_FIELD_NAMES_VQ['Business Name']))).trim();
      await orderPendingPage.open();
      const welcome = await waitCustomerText(AspText.welcome, Timeouts.MEDIUM);
      if (welcome === null) this.skip();
      const cust = (await customerText()) ?? '';
      expect(cust).toMatch(/WELCOME TO/i);
      if (business !== '') expect(cust.toLowerCase()).toContain(business.toLowerCase());
    },
  );

  it(
    title(
      'Prod-like build: Settings has no Account / Logout entry and no lock screen (APP-049)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await goAnyLang('/settings/business');
      const rail = await bodyText('aside');
      if (env.ENV !== 'prod' && /\b(Account|Logout)\b/.test(rail)) {
        log.warn(`APP-049: ${env.ENV} build ships Account / Logout — the prod-only row does not apply`);
        this.skip();
      }
      expect(/\b(Account|Logout|Lock)\b/.test(rail)).toBe(false);
      await returnToHome();
    },
  );

  it(
    title('Prod 1.1.31: Accessibility has no Appearance card / Light / Dark (APP-132)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      await openAccessibility();
      const shipped = (await vqProbe.count(AspIds.themeDark)) > 0;
      if (shipped) {
        log.warn('APP-132: this build already ships Appearance (VP-3800) — the 1.1.31 row does not apply');
        this.skip();
      }
      expect((await vqProbe.texts(Vq.cardTitles())).includes('Appearance')).toBe(false);
      await returnToHome();
    },
  );

  it(
    title(
      'WebView zoom hotkeys are disabled: Ctrl + = / - / 0 leave the UI size unchanged (APP-009)',
      Tag.REGRESSION,
    ),
    async () => {
      await gateProbe.routerNavigate('/order-pending');
      const before = await pageZoom();
      for (const k of ['=', '-', '0']) {
        await browser.keys([Key.Ctrl, k]);
        await browser.keys([Key.Ctrl]);
        await settle(400);
      }
      expect(await pageZoom()).toBe(before);
      await returnToHome();
    },
  );

  it(
    title(
      'Typing on the physical keyboard lands in the main window search (the customer display holds no focus) (APP-010)',
      Tag.REGRESSION,
    ),
    async () => {
      await orderPendingPage.open();
      await orderPendingPage.search('OD');
      const value = await browser.execute(function () {
        const i = document.querySelector<HTMLInputElement>('main input[placeholder^="Search order ID"]');
        return i ? i.value : '';
      });
      expect(value).toBe('OD');
      expect(await browser.execute(() => document.hasFocus())).toBe(true);
      await orderPendingPage.clearSearch();
      await returnToHome();
    },
  );

  it(
    title(
      'Ctrl + click on the header Order History link navigates inside the app and opens no other window (APP-061)',
      Tag.REGRESSION,
    ),
    async () => {
      await orderPendingPage.open();
      const handles = (await browser.getWindowHandles()).length;
      await browser.execute(function () {
        const a = document.querySelector<HTMLAnchorElement>('header a[href^="/order-history"]');
        a?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
      });
      await settle(1_500);
      if (await gateProbe.isOpen()) await gateProbe.submit(ownerCode());
      expect((await browser.getWindowHandles()).length).toBe(handles);
      expect(['/order-history', '/order-pending']).toContain((await gateProbe.path()).replace(/\/$/, ''));
      await returnToHome();
    },
  );

  it(
    title(
      'Sidebar lists the 12 prod entries in order, with no "(V1)" suffix and no Version Update (APP-063)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await returnToHome();
      const lines = (await openSidebar()).map((l) => l.trim()).filter(Boolean);
      await browser.keys([Key.Escape]);
      log.info(`APP-063 sidebar: ${lines.join(' | ')}`);
      const picked = lines.filter((l) => PROD_SIDEBAR.includes(l));
      expect(picked).toEqual(PROD_SIDEBAR);
      expect(lines.some((l) => /\(V1\)$/.test(l))).toBe(false);
      expect(lines.includes('Version Update')).toBe(false);
    },
  );

  it(
    title(
      'Sidebar › Reload hard-reloads both windows to /home and keeps the pending order (APP-075)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await buildHomeDraft();
      await orderPendingPage.open();
      const before = await orderPendingPage.orderCodes();
      await appNav.openSidebar();
      if (!(await appNav.isReloadShown())) {
        await appNav.closeSidebar();
        this.skip();
      }
      await appNav.pressReload();
      await waitUntilPath((p) => p.startsWith('/home') || p.startsWith('/order-pending'), {
        timeout: Timeouts.APP_BOOT,
        message: 'Reload never came back to the app',
      });
      await homePage.waitForReady(Timeouts.APP_BOOT).catch(() => undefined);
      const welcome = await waitCustomerText(AspText.welcome, Timeouts.MEDIUM);
      if (welcome === null) log.warn('APP-075: customer window not reachable — Welcome not checked');
      else expect(welcome).toBe(true);
      await ensurePasscodeGrant();
      await orderPendingPage.open();
      const after = await orderPendingPage.orderCodes();
      for (const code of before) expect(after).toContain(code);
      await cleanTill();
    },
  );

  it(
    title(
      'F5 / Ctrl+R: whatever WebView2 does, the app stays signed in on its route and keeps pending orders (APP-121)',
      Tag.REGRESSION,
      Tag.SLOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await orderPendingPage.open();
      const before = await orderPendingPage.orderCodes();
      for (const keys of [[Key.F5], [Key.Ctrl, 'r']]) {
        await browser.keys(keys);
        await browser.keys([Key.Ctrl]);
        await settle(4_000);
        await browser.waitUntil(async () => !(await gateProbe.path()).startsWith('/splashscreen'), {
          timeout: Timeouts.APP_BOOT,
          interval: 1_000,
        });
        expect(await gateProbe.path()).not.toMatch(/^\/login/);
      }
      await ensurePasscodeGrant();
      await orderPendingPage.open();
      const after = await orderPendingPage.orderCodes();
      for (const code of before) expect(after).toContain(code);
      await returnToHome();
    },
  );

  it(
    title(
      'Unshipped shortcuts (F1/F2/F6/F8-F10, Ctrl+Q, Ctrl+Shift+L, Ctrl+,) do nothing on an open order (APP-115, APP-119)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await buildHomeDraft();
      const path = await gateProbe.path();
      for (const k of [Key.F1, Key.F2, Key.F6, Key.F8, Key.F9, Key.F10]) {
        await browser.keys([k]);
        await settle(300);
      }
      expect(await gateProbe.path()).toBe(path);
      expect(await homePage.hasActiveDraft()).toBe(true);
      for (const combo of [
        [Key.Ctrl, 'q'],
        [Key.Ctrl, Key.Shift, 'L'],
        [Key.Ctrl, ','],
      ]) {
        await browser.keys(combo);
        await browser.keys([Key.Ctrl, Key.Shift]);
        await settle(400);
      }
      expect(await gateProbe.path()).toBe(path);
      expect(await vqProbe.isShown(AspChrome.openSidebar, Timeouts.SHORT)).toBe(true);
      expect(await homePage.hasActiveDraft()).toBe(true);
      await cleanTill();
    },
  );

  it(
    title(
      'Leaving /home resets the customer display to Welcome (APP-131)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await buildHomeDraft();
      const cart = await waitCustomerText(/\$\d/, Timeouts.MEDIUM);
      if (cart === null) this.skip();
      await vqProbe.press(AspChrome.headerAppointment);
      if (await gateProbe.waitOpen(1_500)) await gateProbe.submit(ownerCode());
      expect(await waitCustomerText(AspText.welcome, Timeouts.SHORT)).toBe(true);
      await cleanTill();
    },
  );

  it(
    title(
      'The time on a Pending card matches when the order was created (APP-091)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await buildHomeDraft();
      const now = await browser.execute(() => {
        const d = new Date();
        return d.getHours() * 60 + d.getMinutes();
      });
      await orderPendingPage.open();
      const code = (await orderPendingPage.orderCodes())[0];
      if (!code) throw new Error('No pending card after creating a draft');
      const text = (await orderPendingPage.cardText(code)) ?? '';
      const m = /(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(text);
      expect(m).not.toBeNull();
      const mins = ((Number(m?.[1]) % 12) + (/p/i.test(m?.[3] ?? '') ? 12 : 0)) * 60 + Number(m?.[2]);
      let diff = Math.abs(mins - now);
      diff = Math.min(diff, 1440 - diff);
      expect(diff).toBeLessThanOrEqual(1);
      await cleanTill();
    },
  );

  it(
    title(
      'Offline: red "Lost internet connection." banner; X hides it until the route changes; online → green "restored", gone after ~3 s (APP-081, APP-082, APP-083)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await orderPendingPage.open();
      try {
        await fakeOnline(false);
        expect(await waitNetwork(/Lost internet connection\./, true)).toBe(true);
        expect((await networkStatus()).text).toContain('Your device is currently offline');
        await step('APP-083 X hides it; a route change brings it back', async () => {
          await browser.execute(function () {
            document.querySelector<HTMLButtonElement>('#network-status button')?.click();
          });
          expect(await waitNetwork(/./, false)).toBe(true);
          await gateProbe.routerNavigate('/home');
          expect(await waitNetwork(/Lost internet connection\./, true)).toBe(true);
        });
        await fakeOnline(true);
        expect(await waitNetwork(/Internet connection restored\./, true)).toBe(true);
        const t0 = Date.now();
        expect(await waitNetwork(/./, false, 6_000)).toBe(true);
        expect(Date.now() - t0).toBeLessThanOrEqual(5_000);
      } finally {
        await fakeOnline(true);
      }
    },
  );

  it(
    title(
      'Offline the till keeps working on local data: Time Keeping, Appointment, Pending open without a crash (APP-084)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await returnToHome();
      try {
        await fakeOnline(false);
        await appShellProbe.clickTimeKeepingIcon();
        await settle(1_500);
        expect((await bodyText('[role="dialog"]')).length).toBeGreaterThan(0);
        await browser.keys([Key.Escape]);
        for (const route of ['/appointment', '/order-pending']) {
          await gateProbe.routerNavigate(route);
          await settle(1_500);
          if (await gateProbe.isOpen()) await gateProbe.submit(ownerCode());
          const t = await bodyText('main');
          expect({ route, blank: t.trim() === '' }).toEqual({ route, blank: false });
          expect({ route, crash: /Something went wrong|Unexpected Application Error/i.test(t) }).toEqual({
            route,
            crash: false,
          });
        }
      } finally {
        await fakeOnline(true);
        await returnToHome();
      }
    },
  );

  it(
    title(
      'Notifications: popover with heading and Mark all as read; opening clears the badge; after Mark all the button is disabled (APP-122, APP-126)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await returnToHome();
      await appShellProbe.clickBell();
      const pop = await appShellProbe.waitPopover('Notifications', Timeouts.MEDIUM);
      expect(pop).not.toBeNull();
      expect(pop ?? '').toContain('Mark all as read');
      if (!(await vqProbe.isDisabled(AspChrome.markAllRead))) await vqProbe.press(AspChrome.markAllRead);
      await settle(1_500);
      expect(await vqProbe.isDisabled(AspChrome.markAllRead)).toBe(true);
      await browser.keys([Key.Escape]);
      expect(await appShellProbe.waitPopoverGone('Notifications')).toBe(true);
      expect(await bellBadge()).toBe('');
    },
  );

  it(
    title('Notifications: the bell badge never shows more than "99+" (APP-123)', Tag.REGRESSION),
    async () => {
      await returnToHome();
      const badge = await bellBadge();
      log.info(`APP-123 badge: "${badge}"`);
      expect(badge === '' || badge === '99+' || (Number(badge) >= 1 && Number(badge) <= 99)).toBe(true);
    },
  );

  it(
    title(
      'Notifications: an appointment item shows a status pill and a "MMM d, yyyy at h:mm AM" date (APP-124)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await returnToHome();
      await appShellProbe.clickBell();
      const pop = (await appShellProbe.waitPopover('Notifications', Timeouts.MEDIUM)) ?? '';
      await browser.keys([Key.Escape]);
      if (/No notifications yet/.test(pop)) this.skip();
      expect(pop).toMatch(/Scheduled|Confirmed|Canceled|Cancelled|Done/);
      expect(pop).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M/);
    },
  );

  it(
    title(
      'Appearance Dark applies at once to BOTH windows, re-selecting changes nothing; restored (APP-133)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openAccessibility();
      if ((await vqProbe.count(AspIds.themeDark)) === 0) this.skip();
      const wasDark = await isDark();
      try {
        await vqProbe.press(AspIds.themeDark);
        expect(await vqProbe.poll(() => isDark(), true, Timeouts.SHORT)).toBe(true);
        const cust = await customerIsDark();
        if (cust !== null) expect(cust).toBe(true);
        await returnToHome();
        expect(await isDark()).toBe(true);
        await openAccessibility();
        await vqProbe.press(AspIds.themeDark);
        await settle(500);
        expect(await isDark()).toBe(true);
      } finally {
        await openAccessibility();
        await vqProbe.press(wasDark ? AspIds.themeDark : AspIds.themeLight);
      }
      expect(await vqProbe.poll(() => isDark(), wasDark, Timeouts.SHORT)).toBe(wasDark);
    },
  );

  it(
    title(
      'Vietnamese: sidebar + header, the Notifications panel and the network banner have no English left (APP-085, APP-130, APP-134)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await setLanguage('vi');
        await goAnyLang('/home');
        await step('APP-134 sidebar and header', async () => {
          await vqProbe.press(AspChrome.openSidebar);
          await vqProbe.waitShown(AspChrome.sidebar, Timeouts.SHORT);
          const sb = await bodyText('[data-sidebar="sidebar"]');
          expect(sb).toContain(AspVi.sidebarHome);
          for (const re of AspVi.forbiddenChrome)
            expect({ word: re.exec(sb)?.[0] ?? null }).toEqual({ word: null });
          await browser.keys([Key.Escape]);
        });
        await step('APP-130 Notifications panel', async () => {
          await appShellProbe.clickBell();
          await settle(1_200);
          const pop = await bodyText('[data-radix-popper-content-wrapper]');
          expect(pop).not.toMatch(/\bNotifications\b|Mark all as read/);
          await browser.keys([Key.Escape]);
        });
        await step('APP-085 network banner', async () => {
          await fakeOnline(false);
          await settle(800);
          const off = await networkStatus();
          expect(off.shown).toBe(true);
          expect(off.text).not.toMatch(/Lost internet connection/);
          await fakeOnline(true);
          await settle(800);
          expect((await networkStatus()).text).not.toMatch(/Internet connection restored/);
        });
      } finally {
        await fakeOnline(true);
        await restoreEnglish();
      }
    },
  );
});
