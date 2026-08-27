/**
 * Is the session actually signed in?
 *
 * Read-only. The credentials are supplied by `ensureLoggedIn()` in the root
 * hooks; this file only decides whether the result is what the suite needs.
 * Nothing here creates data, so it is safe against a production till.
 */

import { expect } from '@wdio/globals';
import { Routes } from '../../src/constants/routes.js';
import { homePage, loginPage, splashPage } from '../../src/pages/index.js';
import { Tag, title } from '../../src/types/testTags.js';

describe('Authentication', () => {
  it(title('The session lands on the till, not on the login screen', Tag.SMOKE, Tag.CRITICAL), async () => {
    expect(await loginPage.isDisplayed()).toBe(false);
    expect(await splashPage.isActive()).toBe(false);
    expect(await homePage.currentPath()).toBe(Routes.HOME);
  });

  it(title('The authenticated staff directory renders', Tag.SMOKE, Tag.CRITICAL), async () => {
    await homePage.waitForReady();

    // This is the assertion that separates "the router allowed /home" from "the
    // session holds a usable token". The staff tiles come from a GraphQL query
    // over Tauri IPC that the Rust side answers only for an authenticated
    // merchant, so a populated panel is proof the credentials survived the boot
    // — a stale token renders the route and an empty panel.
    expect(await homePage.visibleStaffCount()).toBeGreaterThan(0);
  });
});
