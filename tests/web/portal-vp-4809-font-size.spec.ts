import { expect } from '@wdio/globals';
import { portalSettingsPage } from '../../src/pages/web/PortalSettingsPage.js';
import { Tag, title } from '../../src/types/testTags.js';

/**
 * Fastboy Portal half of VP-4809 (Font Size) — fastboy-portal#845.
 *
 * Test cases: docs/qc/volt-qc/vp-tickets/VP-4809-font-size-print-all-staff-income-test-cases.md
 * (TC-VP4809-13). The POS cases live in tests/regression/incomes/vp-4809-font-size-print.spec.ts;
 * TC-VP4809-14 (Portal change → POS) stays PENDING there (cross-surface).
 *
 * READ-ONLY: the merchant's font size is global to every POS terminal, so this spec
 * never clicks a radio. "Default Medium" is asserted as the merchant-14 baseline —
 * the POS spec (`@exclusive`) restores it after its own changes; a run that overlaps
 * that spec can read Large/Small and fail with the value it saw.
 *
 * Runs in Edge on the signed-in `.portal-profile/`: `npm run portal:vp-4809`.
 */
describe('Portal — VP-4809 Font size', () => {
  it(
    title(
      'TC-VP4809-13: Portal Store Setting > Configuration offers Font Size (default Medium)',
      Tag.REGRESSION,
    ),
    async () => {
      await portalSettingsPage.openConfiguration();
      const options = await portalSettingsPage.fontSizeOptions();

      expect(options.map((o) => o.value)).toEqual(['small', 'medium', 'large']);
      expect(options.map((o) => o.label)).toEqual(['Small', 'Medium', 'Large']);
      expect(options.filter((o) => o.checked).map((o) => o.value)).toEqual(['medium']);
    },
  );
});
