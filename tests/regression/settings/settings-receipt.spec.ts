/**
 * Receipt (`/settings/receipt`) — Receipt Setting (4 accordion sections) and the
 * live Receipt Preview.
 *
 * Covers TC-RCP-01..20 from docs/screens/receipt/receipt-test-cases.md.
 *
 * ## Why this file is safe to run yet mutates controls
 *
 * The form sits behind ONE screen-level Save and the receipt template is
 * merchant-global. Nothing here ever presses Save. Each mutating case flips a
 * control, reads the preview / Save gate, and puts the control back; leftover
 * dirty state is discarded by leaving the screen, which is what {@link discardChanges}
 * and the `after` hook do. The doc says there is no unsaved-changes guard; build
 * 1.1.56 does raise one ("Are you sure want to leave?"), so leaving goes through
 * `settingsPage.openSectionDiscarding`, which confirms it. The doc's "reload" steps are done the same way: `browser.url()` would
 * re-run the whole splash boot.
 *
 * ## Where build 1.1.56 differs from the doc (scan of 2026-08-21)
 *
 * - Printing Preference renders 2 switches, not 4 (`#auto-print-split-order` and
 *   `#auto-print-gift-card` are absent) — TC-RCP-03 requires the 2 and checks the
 *   other 2 only if present.
 * - Display Options has 17 toggles, not 13 (the combined
 *   `#subtotal-total-discount-tip-total` split into five) — TC-RCP-07 uses the
 *   live list.
 * - The preview's store block is merchant data (the doc's `Test 100004` was a
 *   different merchant) — TC-RCP-08 asserts its shape, not those strings.
 *
 * Tagged `@regression` only: with no Save there is no upstream write.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { goToSettings } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import receiptSettingsPage from '../../../src/pages/settings/ReceiptSettingsPage.js';
import { settingsPage } from '../../../src/pages/index.js';
import {
  RECEIPT_BUSINESS_INFO_IDS,
  RECEIPT_DISPLAY_OPTION_IDS,
  RECEIPT_MESSAGE_PAIRS,
  RECEIPT_PRINTING_IDS,
  RECEIPT_PRINTING_OPTIONAL_IDS,
  RECEIPT_SECTIONS,
  type ReceiptSection,
} from '../../../src/constants/testids.settings-receipt.js';
import { Tag, title } from '../../../src/types/testTags.js';

const SECTIONS = Object.keys(RECEIPT_SECTIONS) as ReceiptSection[];

/** Open the screen fresh — discarding any unsaved change — and wait for its data. */
async function discardChanges(): Promise<void> {
  await goToSettings();
  // Bounce through another section so the form re-mounts from the saved settings.
  if (await receiptSettingsPage.isActive()) await settingsPage.openSectionDiscarding('ROLES');
  await settingsPage.openSection('RECEIPT');
  await receiptSettingsPage.waitForReady(Timeouts.MEDIUM);
}

describe('Settings — Receipt', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await discardChanges();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    // Belt-and-braces: never leave the form dirty. Leaving the screen drops it.
    if ((await receiptSettingsPage.isActive()) && (await receiptSettingsPage.isSaveEnabled())) {
      await discardChanges();
    }
  });

  /* ------------------------------------------------------------------ *
   * Layout & defaults
   * ------------------------------------------------------------------ */

  it(
    title('The screen renders 4 expanded sections and the preview (TC-RCP-01)', Tag.REGRESSION),
    async () => {
      expect(await receiptSettingsPage.isSettingHeadingShown()).toBe(true);
      expect(await receiptSettingsPage.isPreviewHeadingShown()).toBe(true);
      for (const section of SECTIONS) {
        expect(await receiptSettingsPage.isSectionExpanded(section)).toBe(true);
      }
    },
  );

  it(title('Save is disabled with no changes (TC-RCP-02)', Tag.REGRESSION), async () => {
    expect(await receiptSettingsPage.isSaveEnabled()).toBe(false);
  });

  it(title('Printing Preference switches exist and default OFF (TC-RCP-03)', Tag.REGRESSION), async () => {
    for (const id of RECEIPT_PRINTING_IDS) {
      expect(await receiptSettingsPage.hasToggle(id)).toBe(true);
      expect(await receiptSettingsPage.isToggleOn(id)).toBe(false);
    }
    // The doc's other two are not rendered by 1.1.56; when present they follow the same rule.
    for (const id of RECEIPT_PRINTING_OPTIONAL_IDS) {
      if (await receiptSettingsPage.hasToggle(id)) {
        expect(await receiptSettingsPage.isToggleOn(id)).toBe(false);
      }
    }
  });

  it(title('Logo & Branding has the default/custom radios (TC-RCP-04)', Tag.REGRESSION), async () => {
    expect(await receiptSettingsPage.logoRadio('default')).toEqual({ checked: true, value: 'default' });
    expect(await receiptSettingsPage.logoRadio('custom')).toEqual({ checked: false, value: 'custom' });
  });

  it(title('The 3 business-info toggles are ON (TC-RCP-05)', Tag.REGRESSION), async () => {
    for (const id of RECEIPT_BUSINESS_INFO_IDS) {
      expect(await receiptSettingsPage.isToggleOn(id)).toBe(true);
    }
  });

  it(title('Receipt Message has 3 switch + textarea pairs (TC-RCP-06)', Tag.REGRESSION), async () => {
    for (const pair of RECEIPT_MESSAGE_PAIRS) {
      expect(await receiptSettingsPage.isToggleOn(pair.toggle)).toBe(true);
      expect(await receiptSettingsPage.readTextarea(pair.textarea)).toBe('');
      expect(await receiptSettingsPage.textareaPlaceholder(pair.textarea)).toBe(pair.placeholder);
    }
  });

  it(title('Display Options toggles all exist and are ON (TC-RCP-07)', Tag.REGRESSION), async () => {
    const off: string[] = [];
    for (const id of RECEIPT_DISPLAY_OPTION_IDS) {
      expect(await receiptSettingsPage.hasToggle(id)).toBe(true);
      if (!(await receiptSettingsPage.isToggleOn(id))) off.push(id);
    }
    expect(off).toEqual([]);
  });

  it(title('The preview shows the store block (TC-RCP-08)', Tag.REGRESSION), async () => {
    const lines = (await receiptSettingsPage.previewText())
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '');

    // [0] "Receipt Preview", [1] business name, [2] address, then the masked phone.
    expect(lines[0]).toBe('Receipt Preview');
    expect(lines[1]?.length ?? 0).toBeGreaterThan(0);
    expect(lines[2]?.length ?? 0).toBeGreaterThan(0);
    expect(lines.some((l) => /^\*{3}-\*{3}-\d{4}$/.test(l))).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   * Display Option ⇄ live preview — mutate then revert
   * ------------------------------------------------------------------ */

  it(
    title('Turning a Display Option off updates the preview at once (TC-RCP-09)', Tag.REGRESSION),
    async () => {
      expect(await receiptSettingsPage.previewText()).toContain('Customer Name');

      await receiptSettingsPage.toggle('customer-info');

      expect(await receiptSettingsPage.isToggleOn('customer-info')).toBe(false);
      expect(await receiptSettingsPage.previewText()).not.toContain('Customer Name');
      expect(await receiptSettingsPage.isSaveEnabled()).toBe(true);
    },
  );

  it(title('Other options are unaffected (TC-RCP-10)', Tag.REGRESSION), async () => {
    if (await receiptSettingsPage.isToggleOn('customer-info'))
      await receiptSettingsPage.toggle('customer-info');

    expect(await receiptSettingsPage.isToggleOn('current-points')).toBe(true);
    expect(await receiptSettingsPage.previewText()).toContain('Current points');
  });

  it(title('Turning the option back on restores the preview (TC-RCP-11)', Tag.REGRESSION), async () => {
    if (await receiptSettingsPage.isToggleOn('customer-info'))
      await receiptSettingsPage.toggle('customer-info');

    await receiptSettingsPage.toggle('customer-info');

    expect(await receiptSettingsPage.isToggleOn('customer-info')).toBe(true);
    expect(await receiptSettingsPage.previewText()).toContain('Customer Name');
  });

  it(title('Unsaved changes are dropped on re-visit (TC-RCP-12)', Tag.REGRESSION), async () => {
    if (await receiptSettingsPage.isToggleOn('customer-info'))
      await receiptSettingsPage.toggle('customer-info');
    expect(await receiptSettingsPage.isSaveEnabled()).toBe(true);

    await step('Leave and re-open Receipt without saving', () => discardChanges());

    expect(await receiptSettingsPage.isToggleOn('customer-info')).toBe(true);
    expect(await receiptSettingsPage.isSaveEnabled()).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   * Logo
   * ------------------------------------------------------------------ */

  it(title('Choosing the custom logo makes the form dirty (TC-RCP-13)', Tag.REGRESSION), async () => {
    await receiptSettingsPage.selectLogo('custom');
    try {
      expect((await receiptSettingsPage.logoRadio('custom')).checked).toBe(true);
      expect(await receiptSettingsPage.isSaveEnabled()).toBe(true);
      expect(await receiptSettingsPage.isChooseFileUsable()).toBe(true);
    } finally {
      await receiptSettingsPage.selectLogo('default');
      await discardChanges();
    }
  });

  it(title('⚠️ Logo upload has no HTML file input (TC-RCP-14)', Tag.REGRESSION), async () => {
    await receiptSettingsPage.selectLogo('custom');
    try {
      // `Choose file` opens the OS (Tauri) dialog — the upload itself stays a manual case.
      expect(await receiptSettingsPage.fileInputCount()).toBe(0);
    } finally {
      await receiptSettingsPage.selectLogo('default');
      await discardChanges();
    }
  });

  it(
    title('The preview logo is served over the Tauri asset protocol (TC-RCP-15)', Tag.REGRESSION),
    async function (this: Mocha.Context): Promise<void> {
      const src = await receiptSettingsPage.logoSrc();
      // A merchant with no logo renders no image — nothing to check.
      if (src === null) this.skip();
      // Assert the SCHEME, never that the image loaded. Tauri serves `asset://localhost/`
      // on macOS/Linux and `http(s)://asset.localhost/` on Windows (WebView2).
      expect(src).toMatch(/^(asset:\/\/localhost\/|https?:\/\/asset\.localhost\/)/);
      expect(decodeURIComponent(src ?? '')).toMatch(/VoltPOS[\\/]+ObjectFiles/i);
    },
  );

  it(title('🐞 The preview doubles the "Staff:" label (TC-RCP-16)', Tag.REGRESSION), async () => {
    // Documented defect — expected once fixed: 0 occurrences.
    const text = await receiptSettingsPage.previewText();
    expect(text.match(/Staff: Staff:/g)?.length ?? 0).toBe(2);
  });

  /* ------------------------------------------------------------------ *
   * Collapse / expand
   * ------------------------------------------------------------------ */

  it(title('Collapsing a section hides its body (TC-RCP-17)', Tag.REGRESSION), async () => {
    if (!(await receiptSettingsPage.isSectionExpanded('printing')))
      await receiptSettingsPage.toggleSection('printing');

    await receiptSettingsPage.toggleSection('printing');

    expect(await receiptSettingsPage.isSectionExpanded('printing')).toBe(false);
    expect(await receiptSettingsPage.sectionState('printing')).toBe('closed');
    for (const id of RECEIPT_PRINTING_IDS) {
      expect(await receiptSettingsPage.isToggleVisible(id)).toBe(false);
    }
  });

  it(title('Re-opening a section shows its body again (TC-RCP-18)', Tag.REGRESSION), async () => {
    if (await receiptSettingsPage.isSectionExpanded('printing'))
      await receiptSettingsPage.toggleSection('printing');

    await receiptSettingsPage.toggleSection('printing');

    expect(await receiptSettingsPage.isSectionExpanded('printing')).toBe(true);
    for (const id of RECEIPT_PRINTING_IDS) {
      expect(await receiptSettingsPage.isToggleVisible(id)).toBe(true);
    }
  });

  /* ------------------------------------------------------------------ *
   * Receipt Message — mutate then discard
   * ------------------------------------------------------------------ */

  it(title('Typing a header message makes the form dirty (TC-RCP-19)', Tag.REGRESSION), async () => {
    try {
      await receiptSettingsPage.setTextarea('header-text-content', 'QA header');

      expect(await receiptSettingsPage.readTextarea('header-text-content')).toBe('QA header');
      expect(await receiptSettingsPage.isSaveEnabled()).toBe(true);
    } finally {
      await discardChanges();
    }
    expect(await receiptSettingsPage.readTextarea('header-text-content')).toBe('');
  });

  /* ------------------------------------------------------------------ *
   * Sync window
   * ------------------------------------------------------------------ */

  it(
    title(
      'TC-RCP-20: route right after an app restart may hit the "Unknown type Setting" error boundary — PENDING (needs an app restart inside the spec; the root hook owns the app lifecycle, and the window closes once sync finishes)',
    ),
  );
});
