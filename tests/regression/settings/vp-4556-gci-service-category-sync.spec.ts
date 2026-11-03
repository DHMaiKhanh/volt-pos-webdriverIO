/**
 * VP-4556 — [BE] the GCI `service_update` CDC message failed with FK
 * `fk_e19d9ad212469de2` (23503) when the category was deleted on GCI while one
 * of its services was being updated (fix: volt-pos-api#1552).
 *
 * TC doc: docs/qc/volt-qc/vp-tickets/VP-4556-gci-service-cdc-category-fk-test-cases.md
 * (TC-VP4556-01..08).
 *
 * The fix lives in the sync pipeline; the POS only sees its RESULT. What this
 * file can check on the till is that result, after a person did the GCI side:
 *
 *   - TC-01: a category created on GCI arrived with its services
 *            (`VP4556_SYNC_CATEGORY`, optional `VP4556_SYNC_COUNT`; skipped when unset);
 *   - TC-04: categories deleted on GCI are gone from both category tabs
 *            (`VP4556_DELETED_PREFIX`, default `QC-4556`).
 *
 * Creating / deleting on GCI and reading Portal → Monitoring → Report tasks
 * ("Sys Notify Cdc Failure") are manual, so TC-02/03/05/06/07 are PENDING and
 * TC-08 is documentation. READ-ONLY on the POS.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { ServicesCss } from '../../../src/constants/testids.settings-services.js';
import { goToSettings } from '../../../src/flows/index.js';
import { settle } from '../../../src/helpers/wait.js';
import servicesSettingsPage from '../../../src/pages/settings/ServicesSettingsPage.js';
import settingsPage from '../../../src/pages/settings/SettingsPage.js';
import { Tag, title } from '../../../src/types/testTags.js';

const SYNC_CATEGORY = (process.env.VP4556_SYNC_CATEGORY ?? '').trim();
const SYNC_COUNT = Number(process.env.VP4556_SYNC_COUNT ?? '0') || 0;
const DELETED_PREFIX = (process.env.VP4556_DELETED_PREFIX ?? 'QC-4556').trim();

/**
 * Every category name of the active tab. The category panel is virtualised
 * (`category-list.tsx` → react-virtual), so a plain read only sees the mounted
 * rows: scroll the list top to bottom and collect as it goes.
 */
async function allCategoryNames(): Promise<string[]> {
  await servicesSettingsPage.categoryNames(); // waits for the first rows
  const names = await browser.execute(async (css: string): Promise<string[]> => {
    const seen = new Set<string>();
    const links = (): HTMLAnchorElement[] => Array.from(document.querySelectorAll<HTMLAnchorElement>(css));
    const collect = (): void => {
      for (const a of links()) {
        if (a.getClientRects().length === 0) continue;
        // A row's text also carries its "Update" button label — the first line is the name.
        const name = (a.innerText.split('\n')[0] ?? '').trim();
        if (name) seen.add(name);
      }
    };
    collect();
    let scroller: HTMLElement | null = links()[0]?.parentElement ?? null;
    while (scroller && !/(auto|scroll)/.test(window.getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    if (scroller) {
      for (let top = 0; top <= scroller.scrollHeight; top += scroller.clientHeight / 2) {
        scroller.scrollTop = top;
        await new Promise((resolve) => setTimeout(resolve, 150));
        collect();
      }
      scroller.scrollTop = 0;
    }
    return Array.from(seen);
  }, ServicesCss.categoryLinks);
  await settle();
  return names;
}

describe('VP-4556 — GCI service sync survives a concurrently deleted category', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await goToSettings();
    await settingsPage.openSection('SERVICES');
    await servicesSettingsPage.waitForReady(Timeouts.MEDIUM);
  });

  after(async () => {
    await servicesSettingsPage.closeAnything();
    if (!(await servicesSettingsPage.isCategoryTabSelected('active'))) {
      await servicesSettingsPage.selectCategoryTab('active');
    }
  });

  /* ------------------------------------------------------------------ *
   * 1. GCI → POS sync, observed on the till
   * ------------------------------------------------------------------ */

  it(
    title('TC-VP4556-01: a category created on GCI reaches the POS with all its services', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      // Precondition: someone created the category + services on GCI for this run.
      if (!SYNC_CATEGORY) this.skip();
      await servicesSettingsPage.selectCategoryTab('active');
      expect(await allCategoryNames()).toContain(SYNC_CATEGORY);

      await servicesSettingsPage.openCategory(SYNC_CATEGORY);
      const rows = await servicesSettingsPage.rows();
      expect(rows.length).toBeGreaterThan(0);
      // The service table is not virtualised (sortable-service-table.tsx), so every row is mounted.
      if (SYNC_COUNT > 0) expect(rows.length).toBe(SYNC_COUNT);
    },
  );

  it(
    title(
      `TC-VP4556-04: categories deleted on GCI (${DELETED_PREFIX}*) are gone from both tabs`,
      Tag.REGRESSION,
    ),
    async () => {
      for (const tab of ['active', 'inactive'] as const) {
        await servicesSettingsPage.selectCategoryTab(tab);
        const leftovers = (await allCategoryNames()).filter((name) => name.startsWith(DELETED_PREFIX));
        expect({ tab, leftovers }).toEqual({ tab, leftovers: [] });
      }
    },
  );

  /* ------------------------------------------------------------------ *
   * 2. No CDC failure — GCI + Portal Monitoring, manual
   * ------------------------------------------------------------------ */

  it(
    title(
      'TC-VP4556-02: deleting a category with 30 services raises no Sys Notify Cdc Failure — PENDING ' +
        '(delete on GCI + Portal → Monitoring → Report tasks; manual)',
    ),
  );

  it(
    title(
      'TC-VP4556-03: deleting a category with 15 services (retest) raises no new CDC failure — PENDING ' +
        '(GCI + Portal Monitoring; manual)',
    ),
  );

  it(
    title(
      'TC-VP4556-05: regression — service create / update on GCI still syncs without a CDC failure — PENDING ' +
        '(changes are made on GCI; manual)',
    ),
  );

  it(
    title(
      'TC-VP4556-06: service_insert while its category is deleted is handled without 23503 — PENDING ' +
        '(needs a GCI race; BE / Monitoring only)',
    ),
  );

  it(
    title(
      'TC-VP4556-07: sibling resources (staff_service, customer_checkin_service, item) have no FK gap — PENDING ' +
        '(BE pipeline review + Monitoring)',
    ),
  );

  it(
    title(
      'TC-VP4556-08: the behaviour for a missing category (skip vs category_id = NULL) is documented — PENDING ' +
        '(doc-only: volt-pos-api#1552)',
    ),
  );
});
