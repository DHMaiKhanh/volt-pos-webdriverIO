/**
 * Does the desktop application come up at all?
 *
 * Read-only, and safe against a production till: it opens no dialog, touches no
 * order, and only ever reads window metadata and the router path.
 */

import { expect } from '@wdio/globals';
import { pathOf, Routes } from '../../src/constants/routes.js';
import { listWindows, MAIN_WINDOW_TITLE, withCustomerWindow } from '../../src/helpers/window.js';
import { customerDisplayPage, homePage, splashPage } from '../../src/pages/index.js';
import { Tag, title } from '../../src/types/testTags.js';

const isCustomerWindow = (url: string): boolean => pathOf(url).startsWith(Routes.CUSTOMER);

describe('App launch', () => {
  it(title('The app boots past the splash screen into a titled window', Tag.SMOKE), async () => {
    const windows = await listWindows();
    expect(windows.length).toBeGreaterThanOrEqual(1);

    for (const window of windows) {
      // Containment, not equality. `tauri.conf.json` gives the two windows
      // different native titles, but WebDriver's Get Title returns
      // `document.title`, and the app ships ONE index.html — so on some WebView2
      // hosts both windows report the same string. The shared prefix is the part
      // that holds everywhere, and it still fails loudly if the session attached
      // to some other application's window.
      expect(window.title.toLowerCase()).toContain(MAIN_WINDOW_TITLE.toLowerCase());
    }

    // `/splashscreen` is where migrations and the first sync run. Still being
    // there means the boot never finished, which is a different failure from
    // "the till rendered but is empty".
    expect(await splashPage.isActive()).toBe(false);
  });

  it(
    title('Both the staff window and the customer display are open', Tag.SMOKE, Tag.DUAL_WINDOW),
    async () => {
      const windows = await listWindows();
      const staffWindows = windows.filter((window) => !isCustomerWindow(window.url));
      const customerWindows = windows.filter((window) => isCustomerWindow(window.url));

      // Exactly one of each: both windows are declared up front in
      // `src-tauri/tauri.conf.json` and neither is opened later by app code, so a
      // second staff window means `tauri-plugin-single-instance` handed this
      // session a stale process.
      expect(staffWindows.length).toBe(1);
      expect(customerWindows.length).toBe(1);

      await withCustomerWindow(async () => {
        expect(await customerDisplayPage.isActive()).toBe(true);
      });

      // The switch back is part of the contract for a `@dual-window` spec: the
      // next test assumes it starts on the staff window.
      expect(await homePage.isActive()).toBe(true);
    },
  );
});
