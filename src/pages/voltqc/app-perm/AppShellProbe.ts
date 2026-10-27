import { browser } from '@wdio/globals';
import { Key } from 'webdriverio';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { appSidebarItem } from '../../../constants/testids.js';
import { VQC_DOM, VqcAppPermIds } from '../../../constants/testids.voltqc-app-perm.js';
import { settle } from '../../../helpers/wait.js';
import { UiObject } from '../../../support/UiObject.js';

/**
 * Read-only probes of the app chrome for the volt-qc APP port: header layout,
 * the right-hand icon group, popovers (Devices, Notifications, Device ID QR),
 * the sidebar's About block and close gestures, the Version Update dialog and
 * the 404 page. `AppNav` (src/components/nav) stays the way specs MOVE between
 * screens; this only adds what APP-05x/07x/10x/12x need to LOOK at.
 */

export interface HeaderItem {
  name: string;
  visible: boolean;
  x: number;
}

export interface AboutBlock {
  version: string;
  deviceId: string;
  support: string;
  text: string;
}

export interface VersionDialogState {
  currentVersion: string;
  checkEnabled: boolean;
  status: string;
  text: string;
  hasUpdateNow: boolean;
}

export class AppShellProbe extends UiObject {
  readonly name = 'volt-qc app shell probe';

  /* ------------------------------------------------------------------ *
   * Header
   * ------------------------------------------------------------------ */

  /** APP-055: the left group, in the order the TC lists it, with each item's x. */
  async headerLeftItems(): Promise<HeaderItem[]> {
    return browser.execute(function (headerSel: string): HeaderItem[] {
      const header = Array.from(document.querySelectorAll(headerSel)).find(
        (h) => h.getClientRects().length > 0,
      );
      const pick = (name: string, find: (h: Element) => Element | null | undefined): HeaderItem => {
        const el = header ? find(header) : null;
        const r = el ? (el as HTMLElement).getBoundingClientRect() : null;
        // Height only: below ~1600px the header collapses the Search box to width 0
        // (responsive layout, not a missing item), yet it keeps its slot in the row.
        return { name, visible: !!r && r.height > 0, x: r ? r.x : -1 };
      };
      const byName = (h: Element, n: string): Element | undefined =>
        Array.from(h.querySelectorAll('button, [role=button]')).find(
          (b) => b.getAttribute('aria-label') === n || (b.textContent ?? '').trim() === n,
        );
      return [
        pick('Open sidebar', (h) => h.querySelector('[aria-label="Open sidebar"]')),
        pick('Logo', (h) => h.querySelector('a[href="/home"]')),
        pick('Pending Orders', (h) => h.querySelector('[aria-label="Open pending orders"]')),
        pick('Order History', (h) => h.querySelector('a[href^="/order-history"]')),
        pick('Appointment', (h) => h.querySelector('a[href^="/appointment"]')),
        pick('Scanner', (h) => byName(h, 'Scanner')),
        pick('Search...', (h) => h.querySelector('input[placeholder="Search..."]')),
      ];
    }, VQC_DOM.header);
  }

  /** Buttons in the header's right-hand group ([Devices, Time keeping, Notifications] + update icon). */
  async headerRightButtonCount(): Promise<number> {
    return browser.execute(function (headerSel: string) {
      const header = Array.from(document.querySelectorAll(headerSel)).find(
        (h) => h.getClientRects().length > 0,
      );
      const group = header?.querySelector(':scope > div:last-child');
      return group ? group.querySelectorAll('button').length : 0;
    }, VQC_DOM.header);
  }

  async clickLogo(): Promise<void> {
    await this.click(VqcAppPermIds.headerLogo);
    await settle();
  }

  async clickPendingOrders(): Promise<void> {
    await this.click(VqcAppPermIds.headerPendingOrders);
    await settle();
  }

  async clickHeaderOrderHistory(): Promise<void> {
    await this.click(VqcAppPermIds.headerOrderHistory);
    await settle();
  }

  async clickHeaderAppointment(): Promise<void> {
    await this.click(VqcAppPermIds.headerAppointment);
    await settle();
  }

  /** `href` of the header Appointment link (TanStack renders `/appointment?date=<unix>`). */
  async headerAppointmentHref(): Promise<string> {
    const el = await this.find(VqcAppPermIds.headerAppointment, { visible: true });
    return (await el.getAttribute('href')) ?? '';
  }

  /**
   * Forget the board date picked earlier in this session (`appointment_filter_date`
   * in sessionStorage — VP-3359), so the header link falls back to today. View
   * state only.
   */
  async clearAppointmentDateFilter(): Promise<void> {
    await browser.execute(function () {
      try {
        window.sessionStorage.removeItem('appointment_filter_date');
      } catch {
        // storage unavailable — nothing to forget
      }
    });
  }

  /** Unix SECONDS of local midnight today, on the app's own clock. */
  async startOfTodayUnix(): Promise<number> {
    return browser.execute(function () {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return Math.floor(d.getTime() / 1000);
    });
  }

  async clickTimeKeepingIcon(): Promise<void> {
    await this.click(VqcAppPermIds.headerTimeKeeping);
    await settle();
  }

  async clickDevices(): Promise<void> {
    await this.click(VqcAppPermIds.headerDevices);
    await settle();
  }

  async clickBell(): Promise<void> {
    await this.click(VqcAppPermIds.headerBell);
    await settle();
  }

  /** Does the page show this text anywhere (toasts included)? */
  async bodyHasText(text: string): Promise<boolean> {
    return browser.execute(function (t: string) {
      return (document.body.innerText || document.body.textContent || '').includes(t);
    }, text);
  }

  /** `<main>` shows a pending card (`OD……-n`) or the "No pending orders" empty state. */
  async pendingListRendered(timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      const ok = await browser.execute(function () {
        const main = document.querySelector('main');
        const t = main ? main.innerText || main.textContent || '' : '';
        return /OD\d{6}-\d+/.test(t) || t.includes('No pending orders');
      });
      if (ok) return true;
      await settle(300);
    } while (Date.now() < deadline);
    return false;
  }

  /** Is a visible button labelled exactly `label` in `<main>`? (e.g. "Quick Checkout") */
  async mainButtonShown(label: string, timeout: number = Timeouts.MEDIUM): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      const ok = await browser.execute(function (l: string) {
        return Array.from(document.querySelectorAll('main button')).some(
          (b) => (b.textContent ?? '').trim() === l && b.getClientRects().length > 0,
        );
      }, label);
      if (ok) return true;
      await settle(250);
    } while (Date.now() < deadline);
    return false;
  }

  /* ------------------------------------------------------------------ *
   * Popovers
   * ------------------------------------------------------------------ */

  /** Text of the open Radix popover whose heading is `heading`, or `null`. */
  async popoverText(heading: string): Promise<string | null> {
    return browser.execute(
      function (popSel: string, h: string) {
        const pops = Array.from(document.querySelectorAll(popSel)).filter(
          (p) => p.getClientRects().length > 0,
        );
        const pop = pops
          .reverse()
          .find((p) =>
            Array.from(p.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')).some(
              (e) => (e.textContent ?? '').trim() === h,
            ),
          );
        if (!pop) return null;
        return ((pop as HTMLElement).innerText || pop.textContent || '').replace(/\s*\n+\s*/g, ' | ');
      },
      VQC_DOM.popper,
      heading,
    );
  }

  async waitPopover(heading: string, timeout: number = Timeouts.SHORT): Promise<string | null> {
    const deadline = Date.now() + timeout;
    do {
      const t = await this.popoverText(heading);
      if (t !== null) return t;
      await settle(200);
    } while (Date.now() < deadline);
    return null;
  }

  async waitPopoverGone(heading: string, timeout: number = Timeouts.SHORT): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      if ((await this.popoverText(heading)) === null) return true;
      await settle(200);
    } while (Date.now() < deadline);
    return false;
  }

  /** Does the last open popover hold an `<svg>` (the Device ID QR)? */
  async lastPopoverHasSvg(timeout: number = Timeouts.SHORT): Promise<boolean> {
    const deadline = Date.now() + timeout;
    do {
      const ok = await browser.execute(function (popSel: string) {
        const pops = Array.from(document.querySelectorAll(popSel)).filter(
          (p) => p.getClientRects().length > 0,
        );
        const last = pops[pops.length - 1];
        return !!last && !!last.querySelector('svg');
      }, VQC_DOM.popper);
      if (ok) return true;
      await settle(200);
    } while (Date.now() < deadline);
    return false;
  }

  /**
   * APP-127: scroll the Notifications list until its end marker shows. Returns
   * the marker text ("No more notifications" / "No notifications yet") or `null`.
   */
  async scrollNotificationsToEnd(budgetMs = 110_000): Promise<string | null> {
    const deadline = Date.now() + budgetMs;
    let stalls = 0;
    while (Date.now() < deadline && stalls < 3) {
      const r = await browser.execute(function (popSel: string) {
        const pop = Array.from(document.querySelectorAll(popSel))
          .filter((p) => p.getClientRects().length > 0)
          .reverse()
          .find((p) =>
            Array.from(p.querySelectorAll('h1,h2,h3,h4')).some(
              (e) => (e.textContent ?? '').trim() === 'Notifications',
            ),
          );
        if (!pop) return { end: null as string | null, height: -1 };
        const end = Array.from(pop.querySelectorAll('*')).find(
          (e) =>
            /^(No more notifications|No notifications yet)$/.test((e.textContent ?? '').trim()) &&
            e.children.length === 0,
        );
        if (end) return { end: (end.textContent ?? '').trim(), height: 0 };
        const list = pop.querySelector('div.overflow-y-auto');
        if (!list) return { end: null, height: -1 };
        list.scrollTop = list.scrollHeight;
        return { end: null, height: list.scrollHeight };
      }, VQC_DOM.popper);
      if (r.end) return r.end;
      if (r.height < 0) return null;
      // Wait for the next page to load (scrollHeight grows) or the marker to show.
      const grew = await browser
        .waitUntil(
          async () => {
            const h = await browser.execute(function (popSel: string) {
              const pops = Array.from(document.querySelectorAll(popSel)).filter(
                (p) => p.getClientRects().length > 0,
              );
              const last = pops[pops.length - 1];
              const list = last?.querySelector('div.overflow-y-auto');
              const t = last ? (last as HTMLElement).innerText : '';
              if (/No more notifications|No notifications yet/.test(t)) return Number.MAX_SAFE_INTEGER;
              return list ? list.scrollHeight : 0;
            }, VQC_DOM.popper);
            return h > r.height;
          },
          { timeout: 5_000, interval: 250 },
        )
        .then(() => true)
        .catch(() => false);
      stalls = grew ? 0 : stalls + 1;
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Sidebar
   * ------------------------------------------------------------------ */

  async clickSidebarLink(path: string): Promise<void> {
    await this.click(appSidebarItem(path));
    await settle();
  }

  /** `aria-current` of the sidebar Home link (TanStack marks the active link `page`). */
  async sidebarHomeAriaCurrent(): Promise<string | null> {
    const el = await this.find(VqcAppPermIds.sidebarHome, { visible: true });
    return el.getAttribute('aria-current');
  }

  async clickSidebarBack(): Promise<void> {
    await this.click(VqcAppPermIds.sidebarBack);
    await settle();
  }

  /** Click the overlay to the right of the drawer (40 px in from the right edge, mid-height). */
  async clickOverlay(): Promise<void> {
    const { w, h } = await browser.execute(function () {
      return { w: window.innerWidth, h: window.innerHeight };
    });
    await browser
      .action('pointer', { parameters: { pointerType: 'mouse' } })
      .move({ x: Math.max(1, w - 40), y: Math.round(h / 2), origin: 'viewport' })
      .down()
      .up()
      .perform();
    await settle();
  }

  async pressCtrlB(): Promise<void> {
    await browser.keys([Key.Ctrl, 'b']);
    await settle();
  }

  /** APP-079: the About block at the foot of the (open) sidebar. */
  async readAbout(timeout: number = Timeouts.MEDIUM): Promise<AboutBlock> {
    const deadline = Date.now() + timeout;
    let text = '';
    do {
      text = await browser.execute(function (sel: string) {
        const sb = document.querySelector<HTMLElement>(sel);
        return sb ? (sb.innerText || sb.textContent || '').replace(/\s*\n+\s*/g, ' | ') : '';
      }, VQC_DOM.sidebar);
      if (/Version: \d+\.\d+\.\d+/.test(text)) break;
      await settle(300);
    } while (Date.now() < deadline);
    return {
      version: text.match(/Version: (\d+\.\d+\.\d+)/)?.[1] ?? '',
      deviceId: text.match(/Device ID:\s*\|?\s*([^|]+)/)?.[1]?.trim() ?? '',
      support: text.match(/Support: ([^|]+)/)?.[1]?.trim() ?? '',
      text,
    };
  }

  async clickDeviceId(): Promise<void> {
    await this.click(VqcAppPermIds.sidebarDeviceId);
    await settle();
  }

  async clickVersionUpdate(): Promise<void> {
    await this.click(VqcAppPermIds.sidebarVersionUpdate);
    await settle();
  }

  /* ------------------------------------------------------------------ *
   * Version Update dialog (read-only: never presses Update Now)
   * ------------------------------------------------------------------ */

  async isVersionDialogOpen(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(VqcAppPermIds.versionDialog, timeout);
  }

  async versionDialogState(): Promise<VersionDialogState> {
    const dlg = await this.find(VqcAppPermIds.versionDialog, { visible: true });
    const input = await dlg.$('.//input').getElement();
    const currentVersion = (await input.isExisting()) ? ((await input.getValue()) ?? '') : '';
    const check = await this.find(VqcAppPermIds.versionCheck, { within: dlg, timeout: Timeouts.SHORT });
    const raw = await dlg.getProperty('textContent');
    const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ') : '';
    const status =
      text.match(/You're Up to Date|A New Update is Available|Couldn't Check for Updates/)?.[0] ?? '';
    return {
      currentVersion: currentVersion.trim(),
      checkEnabled: await check.isEnabled(),
      status,
      text,
      hasUpdateNow: /Update Now/.test(text),
    };
  }

  /** Press "Check for updates" and wait for it to re-enable (the check finished). */
  async checkForUpdates(timeout: number = Timeouts.LONG): Promise<void> {
    const dlg = await this.find(VqcAppPermIds.versionDialog, { visible: true });
    const check = await this.find(VqcAppPermIds.versionCheck, { within: dlg });
    await check.waitForEnabled({ timeout });
    await check.click();
    await settle(Timeouts.ANIMATION);
    await check.waitForEnabled({ timeout });
  }

  async closeVersionDialog(): Promise<void> {
    const dlg = await this.find(VqcAppPermIds.versionDialog, { visible: true });
    await this.click(VqcAppPermIds.versionClose, { within: dlg });
    await this.waitGone(VqcAppPermIds.versionDialog, Timeouts.MEDIUM);
  }

  /* ------------------------------------------------------------------ *
   * 404
   * ------------------------------------------------------------------ */

  async notFoundShown(
    timeout: number = Timeouts.SHORT,
  ): Promise<{ code: boolean; title: boolean; message: boolean }> {
    const deadline = Date.now() + timeout;
    let r = { code: false, title: false, message: false };
    do {
      r = await browser.execute(function () {
        const leaves = Array.from(document.querySelectorAll('body *')).filter(
          (e) => e.children.length === 0 && e.getClientRects().length > 0,
        );
        const has = (t: string): boolean => leaves.some((e) => (e.textContent ?? '').trim() === t);
        return {
          code: has('404'),
          title: has('Page Not Found'),
          message: has("The page you're looking for doesn't exist."),
        };
      });
      if (r.code && r.title && r.message) return r;
      await settle(250);
    } while (Date.now() < deadline);
    return r;
  }

  async clickNotFoundBack(): Promise<void> {
    await this.click(VqcAppPermIds.notFoundBack);
    await settle();
  }

  /* ------------------------------------------------------------------ *
   * Home search boxes (APP-116)
   * ------------------------------------------------------------------ */

  async homeSearchBoxesShown(): Promise<boolean> {
    return (
      (await this.isVisible(VqcAppPermIds.homeStaffSearch, Timeouts.SHORT)) &&
      (await this.isVisible(VqcAppPermIds.homeServiceSearch, Timeouts.SHORT))
    );
  }

  /** Type into Search staff, select all, Ctrl+C; focus Search service, Ctrl+V. */
  async copyStaffSearchIntoServiceSearch(text: string): Promise<void> {
    const staff = await this.find(VqcAppPermIds.homeStaffSearch, { visible: true });
    await staff.click();
    await staff.setValue(text);
    await browser.keys([Key.Ctrl, 'a']);
    await browser.keys([Key.Ctrl, 'c']);
    const svc = await this.find(VqcAppPermIds.homeServiceSearch, { visible: true });
    await svc.click();
    await browser.keys([Key.Ctrl, 'v']);
    await settle();
  }

  async serviceSearchValue(): Promise<string> {
    return this.value(VqcAppPermIds.homeServiceSearch);
  }

  async clearHomeSearchBoxes(): Promise<void> {
    for (const loc of [VqcAppPermIds.homeStaffSearch, VqcAppPermIds.homeServiceSearch]) {
      try {
        const el = await this.find(loc, { visible: true, timeout: Timeouts.ANIMATION });
        await el.click();
        await browser.keys([Key.Ctrl, 'a']);
        await browser.keys([Key.Backspace]);
      } catch {
        // Box gone — nothing to clear.
      }
    }
  }

  /** Count of open alertdialogs (APP-116: Ctrl+V must not open Void). */
  async alertDialogCount(): Promise<number> {
    return browser.execute(function (sel: string) {
      return Array.from(document.querySelectorAll(sel)).filter((e) => e.getClientRects().length > 0).length;
    }, VQC_DOM.alertDialog);
  }
}

export const appShellProbe = new AppShellProbe();
