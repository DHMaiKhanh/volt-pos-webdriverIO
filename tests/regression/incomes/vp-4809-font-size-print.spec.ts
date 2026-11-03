/**
 * VP-4809 — Font Size setting + Print All Staff Income (POS Windows).
 *
 * Source: docs/qc/volt-qc/vp-tickets/VP-4809-font-size-print-all-staff-income-test-cases.md
 * (TC-VP4809-01…29, one `it()` each; 🧱 rows are title-only PENDING).
 *
 * ## Font Size (TC-01…12) — @exclusive
 *
 * `merchant_theme_pos_style.font_size` is MERCHANT-GLOBAL. `before` records the
 * stored value; `after` puts it back through the same radio. Each case asserts
 * what the setting DID — `<html data-font-size>`, the measured `text-base / 1rem`
 * scale, the stored JSON — not just which radio looks checked.
 *
 * ## Print several staff (TC-15…29)
 *
 * Driven on the V4 report pages (`/report-pages/v4/staff-payroll|staff-income`),
 * the only screens PR volt-pos#3087 changed. Nothing reaches the shared till's
 * printer: {@link installPrintCapture} wraps the Tauri IPC, records the `print`
 * mutation's base64 ESC/POS receipt and answers it itself; the receipt TEXT is
 * then checked for one "Staff: <name>" part per ticked staff, in list order.
 * When the build refuses the wrap, the print-content cases skip with a reason.
 *
 * The V4 list is virtualised: every case ticks rows that are MOUNTED (read via
 * their tick boxes), never rows found by scrolling.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { toastMessage } from '../../../src/components/index.js';
import {
  FontSizeLabels,
  ReportPrintLabels,
  type FontSizeOption,
} from '../../../src/constants/testids.font-size-print.js';
import { V4Labels } from '../../../src/constants/testids.reports-v4.js';
import { goToOrderHistory, goToSettings, returnToHome } from '../../../src/flows/index.js';
import { step } from '../../../src/helpers/steps.js';
import { settle } from '../../../src/helpers/wait.js';
import { listWindows, withCustomerWindow } from '../../../src/helpers/window.js';
import reportsV4Page from '../../../src/pages/incomes/ReportsV4Page.js';
import { orderPendingPage, settingsPage } from '../../../src/pages/index.js';
import { Tag, title } from '../../../src/types/testTags.js';
import { moduleLogger } from '../../../src/utils/logger.js';
import {
  capturedPrints,
  fontSizeCard,
  installPrintCapture,
  probeFontSize,
  readStoredThemePosStyle,
  receiptStaffLines,
  receiptText,
  reportPrintPanel,
  rowHasFigures,
  TEXT_SCALE,
  uninstallPrintCapture,
  waitForPrint,
  type CaptureMode,
  type MountedStaffRow,
} from './vp-4809-font-size-print.helpers.js';

const log = moduleLogger('vp-4809');

/** `PRINT_THROTTLE_MS` (printer.constants.ts): a print within 2 s of the last one is silently dropped. */
const PRINT_THROTTLE_MS = 2_000;

async function openAccessibility(): Promise<void> {
  await goToSettings();
  await settingsPage.openSection('ACCESSIBILITY');
  await fontSizeCard.waitForReady(Timeouts.MEDIUM);
}

/** Poll the stored row until `font_size` reads `option` (the upsert lands after the click). */
async function waitStoredFontSize(option: FontSizeOption): Promise<string | null> {
  let last: string | null = null;
  await browser
    .waitUntil(
      async () => {
        last = (await readStoredThemePosStyle()).fontSize;
        return last === option;
      },
      { timeout: Timeouts.MEDIUM, interval: 300 },
    )
    .catch(() => undefined);
  return last;
}

/** Wait for a toast whose text matches either locale's copy. */
async function waitToast(
  texts: readonly string[],
  timeout: number = Timeouts.MEDIUM,
): Promise<string | null> {
  let seen: string | null = null;
  await browser
    .waitUntil(
      async () => {
        seen = await toastMessage.latest(Timeouts.ANIMATION);
        return seen !== null && texts.some((t) => seen?.toLowerCase().includes(t.toLowerCase()));
      },
      { timeout, interval: 250 },
    )
    .catch(() => undefined);
  return seen;
}

describe('VP-4809 — Font Size + Print All Staff Income', () => {
  /* ------------------------------------------------------------------ *
   * 1. Font Size — POS (Settings > Accessibility)
   * ------------------------------------------------------------------ */

  describe('1. Font Size — POS', () => {
    let original: FontSizeOption = 'medium';

    before(async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openAccessibility();
      const stored = (await readStoredThemePosStyle()).fontSize;
      original = (['small', 'medium', 'large'] as const).find((o) => o === stored) ?? 'medium';
      log.info(`Font Size before the run: stored=${String(stored)} → restore to "${original}"`);
    });

    after(async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openAccessibility();
      if ((await fontSizeCard.selected()) !== original) await fontSizeCard.choose(original);
      await returnToHome();
    });

    it(
      title(
        'TC-VP4809-01: Accessibility shows Font Size with exactly Small / Medium / Large',
        Tag.REGRESSION,
        Tag.EXCLUSIVE,
      ),
      async () => {
        await openAccessibility();
        expect(await fontSizeCard.isCardShown()).toBe(true);
        expect(await fontSizeCard.renderedOptions()).toEqual(['small', 'medium', 'large']);

        const labels = await fontSizeCard.optionLabels();
        const expected = [FontSizeLabels.small, FontSizeLabels.medium, FontSizeLabels.large];
        expect(labels.map((label, i) => (expected[i] as readonly string[]).includes(label))).toEqual([
          true,
          true,
          true,
        ]);
        expect(await fontSizeCard.selected()).not.toBeNull();
      },
    );

    for (const [tc, option] of [
      ['02', 'small'],
      ['03', 'medium'],
      ['04', 'large'],
    ] as const) {
      it(
        title(
          `TC-VP4809-${tc}: choosing ${option} resizes text (×${String(TEXT_SCALE[option])}) and stores "${option}"`,
          Tag.REGRESSION,
          Tag.EXCLUSIVE,
        ),
        async () => {
          await openAccessibility();
          // From a DIFFERENT size, so the click is a real change and an upsert.
          const from: FontSizeOption = option === 'medium' ? 'large' : 'medium';
          if ((await fontSizeCard.selected()) !== from) await fontSizeCard.choose(from);
          await fontSizeCard.choose(option);

          expect(await fontSizeCard.selected()).toBe(option);
          const probe = await probeFontSize();
          expect(probe.attr).toBe(option);
          expect(probe.scale).toBeCloseTo(TEXT_SCALE[option], 2);
          expect(await waitStoredFontSize(option)).toBe(option);
        },
      );
    }

    it(
      title(
        'TC-VP4809-05: only text scales — 1rem (spacing / layout) stays the same',
        Tag.REGRESSION,
        Tag.EXCLUSIVE,
      ),
      async () => {
        await openAccessibility();
        await fontSizeCard.choose('small');
        const small = await probeFontSize();
        await fontSizeCard.choose('large');
        const large = await probeFontSize();

        expect(large.remPx).toBe(small.remPx);
        expect(large.textBasePx).toBeGreaterThan(small.textBasePx);
      },
    );

    it(
      title(
        'TC-VP4809-06: changing the size confirms with "Font size updated"',
        Tag.REGRESSION,
        Tag.EXCLUSIVE,
      ),
      async () => {
        await openAccessibility();
        await toastMessage.dismissAll(Timeouts.SHORT);
        const current = await fontSizeCard.selected();
        const target: FontSizeOption = current === 'large' ? 'medium' : 'large';

        await fontSizeCard.choose(target);
        const toast = await waitToast(FontSizeLabels.updated);
        expect(toast ?? '(no toast)').toMatch(new RegExp(FontSizeLabels.updated.join('|'), 'i'));
      },
    );

    it(
      title(
        'TC-VP4809-07: Large applies on Pending Orders and Order History without horizontal overflow',
        Tag.REGRESSION,
        Tag.EXCLUSIVE,
      ),
      async () => {
        await openAccessibility();
        await fontSizeCard.choose('large');

        await step('Pending Orders at Large', async () => {
          await orderPendingPage.open();
          const probe = await probeFontSize();
          expect(probe.attr).toBe('large');
          expect(probe.scale).toBeCloseTo(TEXT_SCALE.large, 2);
          expect(probe.overflowX).toBe(false);
        });

        await step('Order History at Large', async () => {
          await goToOrderHistory();
          const probe = await probeFontSize();
          expect(probe.attr).toBe('large');
          expect(probe.overflowX).toBe(false);
        });
      },
    );

    it(
      title('TC-VP4809-08: the choice survives moving between screens', Tag.REGRESSION, Tag.EXCLUSIVE),
      async () => {
        await openAccessibility();
        await fontSizeCard.choose('small');

        await returnToHome();
        expect((await probeFontSize()).attr).toBe('small');
        await orderPendingPage.open();
        expect((await probeFontSize()).attr).toBe('small');

        await openAccessibility();
        expect(await fontSizeCard.selected()).toBe('small');
      },
    );

    it(
      title(
        'TC-VP4809-09: the choice survives a reload / app restart — PENDING (attach mode cannot restart the shared POS; passed manually 02/11 on 1.1.86)',
      ),
    );

    it(
      title(
        'TC-VP4809-10: saving font_size keeps every other merchant_theme_pos_style field',
        Tag.REGRESSION,
        Tag.EXCLUSIVE,
      ),
      async () => {
        await openAccessibility();
        const before = await readStoredThemePosStyle();
        const target: FontSizeOption = before.fontSize === 'large' ? 'medium' : 'large';

        await fontSizeCard.choose(target);
        expect(await waitStoredFontSize(target)).toBe(target);
        const after = await readStoredThemePosStyle();

        const others = Object.keys(before.object).filter((key) => key !== 'font_size');
        log.info(`merchant_theme_pos_style other fields: ${others.join(', ') || '(none)'}`);
        for (const key of others) expect({ [key]: after.object[key] }).toEqual({ [key]: before.object[key] });
      },
    );

    it(
      title(
        'TC-VP4809-11: a merchant without the setting defaults to Medium — PENDING (needs a merchant with no merchant_theme_pos_style row; the DEV shop already has one)',
      ),
    );

    it(
      title(
        'TC-VP4809-12: the Customer Display window keeps its default text size',
        Tag.REGRESSION,
        Tag.EXCLUSIVE,
        Tag.DUAL_WINDOW,
      ),
      async function (this: Mocha.Context): Promise<void> {
        const hasCustomer = (await listWindows()).some(
          (w) => w.label === 'customer' || /Customer Display/.test(w.title),
        );
        if (!hasCustomer) this.skip();

        await openAccessibility();
        await fontSizeCard.choose('large');
        const customerAttr = await withCustomerWindow(async () => (await probeFontSize()).attr);
        // `useApplyFontSize` is mounted in the STAFF layout only (PR #3087).
        expect(customerAttr).toBeNull();
      },
    );
  });

  /* ------------------------------------------------------------------ *
   * 2. Font Size — Portal
   * ------------------------------------------------------------------ */

  describe('2. Font Size — Portal', () => {
    // TC-VP4809-13 runs on the Portal web lane: tests/web/portal-vp-4809-font-size.spec.ts (npm run portal:vp-4809).

    it(
      title(
        'TC-VP4809-14: a Portal change reaches POS after sync without a restart — PENDING (cross-surface: Portal change + POS check in one run; Portal lane is ready (`.portal-profile`), POS side not wired)',
      ),
    );
  });

  /* ------------------------------------------------------------------ *
   * 3. Print All Staff Income — Reports V4
   * ------------------------------------------------------------------ */

  describe('3. Print several staff — Reports V4', () => {
    let capture: CaptureMode = 'none';

    /** Fresh page state: leave the route first so the report remounts with no selection and no ticks. */
    async function freshV4(slug: 'staff-payroll' | 'staff-income'): Promise<void> {
      await returnToHome();
      await reportsV4Page.open(slug);
      if (!(await reportPrintPanel.hasTickAll(Timeouts.MEDIUM))) {
        throw new Error(
          `${slug} V4 draws no print tick boxes — the page does not offer Print (Portal report config) or the build predates volt-pos#3087.`,
        );
      }
    }

    /** Print follows the Portal report config (volt-pos#2958): no Print action, no button even with ticks. */
    let printOn = true;
    function requirePrint(ctx: Mocha.Context): void {
      if (!printOn) {
        log.warn('SKIP — the Portal report config offers no Print on Staff Payroll V4 for this merchant.');
        ctx.skip();
      }
    }

    function requireCapture(ctx: Mocha.Context): void {
      if (capture === 'none') {
        log.warn(
          'SKIP — window.__TAURI_INTERNALS__.invoke could not be wrapped; the receipt cannot be captured.',
        );
        ctx.skip();
      }
    }

    /** Mounted rows with figures — what a print part can come from. */
    async function rowsWithFigures(min: number, ctx: Mocha.Context): Promise<MountedStaffRow[]> {
      const rows = (await reportPrintPanel.mountedStaffRows()).filter(rowHasFigures);
      if (rows.length < min) {
        log.warn(`SKIP — need ${String(min)} mounted staff rows with figures, found ${String(rows.length)}.`);
        ctx.skip();
      }
      return rows;
    }

    /** Print and wait for the walk to finish; respects the app's 2 s print throttle. */
    async function printAndSettle(): Promise<void> {
      await settle(PRINT_THROTTLE_MS + 200);
      await reportPrintPanel.pressPrint();
      await reportPrintPanel.waitProgressGone(Timeouts.LONG).catch(() => undefined);
      await settle(Timeouts.DEBOUNCE);
    }

    before(async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await returnToHome();
      capture = await installPrintCapture();
      log.info(`print capture: ${capture}`);
      // Does a tick raise the Print button at all here? (it is config-driven, see requirePrint)
      await freshV4('staff-payroll');
      const [first] = await reportPrintPanel.rowTicks();
      if (first) {
        await reportPrintPanel.setRowTick(first.name, true);
        printOn = await reportPrintPanel.isPrintShown(Timeouts.SHORT);
        await reportPrintPanel.setRowTick(first.name, false);
      }
      log.info(`print button offered: ${String(printOn)}`);
    });

    after(async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await uninstallPrintCapture().catch(() => undefined);
      await returnToHome();
    });

    it(
      title('TC-VP4809-15: Staff Payroll V4 draws a tick-all and one tick box per staff row', Tag.REGRESSION),
      async () => {
        await freshV4('staff-payroll');
        expect(await reportPrintPanel.isTickAllChecked()).toBe(false);

        const ticks = await reportPrintPanel.rowTicks();
        expect(ticks.length).toBeGreaterThan(0);
        expect(ticks.filter((t) => t.name === '').length).toBe(0);
        expect(ticks.filter((t) => t.checked).map((t) => t.name)).toEqual([]);
      },
    );

    it(title('TC-VP4809-16: Staff Income V4 draws the same tick boxes', Tag.REGRESSION), async () => {
      await freshV4('staff-income');
      const ticks = await reportPrintPanel.rowTicks();
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks.filter((t) => t.checked).length).toBe(0);
    });

    it(
      title('TC-VP4809-17: no staff picked and nothing ticked → no Print button', Tag.REGRESSION),
      async () => {
        await freshV4('staff-payroll');
        // Precondition: the page opened with no staff selected (rail empty).
        const lines = await reportsV4Page.lines();
        expect(lines.some((line) => (V4Labels.noDetail as readonly string[]).includes(line))).toBe(true);
        expect(await reportPrintPanel.isPrintShown(Timeouts.SHORT)).toBe(false);
      },
    );

    it(
      title('TC-VP4809-18: ticking one staff reads "Print (1)" and does not open its detail', Tag.REGRESSION),
      async function () {
        requirePrint(this);
        await freshV4('staff-payroll');
        const [first] = await reportPrintPanel.rowTicks();
        if (!first) throw new Error('Staff Payroll V4 mounted no staff row.');

        await reportPrintPanel.setRowTick(first.name, true);
        expect(await reportPrintPanel.printCount()).toBe(1);
        expect(await reportPrintPanel.printLabel()).toMatch(/^(Print|In) \(1\)$/);

        // A tick never selects the row: the rail still shows its empty state.
        const lines = await reportsV4Page.lines();
        expect(lines.some((line) => (V4Labels.noDetail as readonly string[]).includes(line))).toBe(true);
      },
    );

    it(
      title(
        'TC-VP4809-19: tick-all reads "Print (Total staff)"; un-ticking clears every box',
        Tag.REGRESSION,
      ),
      async function () {
        requirePrint(this);
        await freshV4('staff-payroll');
        const totalStaff = await reportsV4Page.cardCount(V4Labels.totalStaff);

        await reportPrintPanel.setTickAll(true);
        expect(await reportPrintPanel.printCount()).toBe(totalStaff);
        expect((await reportPrintPanel.rowTicks()).every((t) => t.checked)).toBe(true);

        await reportPrintPanel.setTickAll(false);
        expect((await reportPrintPanel.rowTicks()).some((t) => t.checked)).toBe(false);
        if (await reportPrintPanel.isPrintShown()) expect(await reportPrintPanel.printCount()).toBe(0);
      },
    );

    it(
      title(
        'TC-VP4809-20: several ticked staff print on ONE receipt, one "Staff:" part each, in list order',
        Tag.REGRESSION,
        Tag.CRITICAL,
      ),
      async function (this: Mocha.Context): Promise<void> {
        requirePrint(this);
        this.timeout(Timeouts.MOCHA_HOOK);
        requireCapture(this);
        await freshV4('staff-payroll');
        const picked = (await rowsWithFigures(2, this)).slice(0, 3);

        for (const row of picked) await reportPrintPanel.setRowTick(row.name, true);
        expect(await reportPrintPanel.printCount()).toBe(picked.length);

        const before = (await capturedPrints()).length;
        await printAndSettle();
        const receipt = receiptText(await waitForPrint(before + 1));
        expect((await capturedPrints()).length).toBe(before + 1);

        const staffLines = receiptStaffLines(receipt);
        expect(staffLines.length).toBe(picked.length);
        picked.forEach((row, i) => expect(staffLines[i] ?? '').toContain(row.name));
        expect((receipt.match(/(?:Date|Ngày):/g) ?? []).length).toBeGreaterThanOrEqual(picked.length);
      },
    );

    it(
      title(
        'TC-VP4809-21: a "Preparing n of m" modal holds the page while the staff are collected',
        Tag.REGRESSION,
      ),
      async function (this: Mocha.Context): Promise<void> {
        requirePrint(this);
        this.timeout(Timeouts.MOCHA_HOOK);
        requireCapture(this);
        await freshV4('staff-payroll');
        const picked = (await rowsWithFigures(2, this)).slice(0, 3);
        for (const row of picked) await reportPrintPanel.setRowTick(row.name, true);

        await settle(PRINT_THROTTLE_MS + 200);
        await reportPrintPanel.pressPrint();
        const seen = await reportPrintPanel.sawProgress(Timeouts.SHORT);
        await reportPrintPanel.waitProgressGone(Timeouts.LONG);

        expect(seen).toBe(true);
        expect(await reportPrintPanel.sawProgress(Timeouts.ANIMATION)).toBe(false);
      },
    );

    it(
      title('TC-VP4809-22: after a successful print every tick clears', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        requirePrint(this);
        this.timeout(Timeouts.MOCHA_HOOK);
        requireCapture(this);
        await freshV4('staff-payroll');
        const picked = (await rowsWithFigures(2, this)).slice(0, 2);
        for (const row of picked) await reportPrintPanel.setRowTick(row.name, true);

        const before = (await capturedPrints()).length;
        await printAndSettle();
        await waitForPrint(before + 1);

        await browser.waitUntil(async () => !(await reportPrintPanel.rowTicks()).some((t) => t.checked), {
          timeout: Timeouts.SHORT,
          interval: 200,
          timeoutMsg: 'Ticks were still set after the receipt printed.',
        });
        if (await reportPrintPanel.isPrintShown()) expect(await reportPrintPanel.printCount()).toBe(0);
      },
    );

    it(
      title(
        'TC-VP4809-23: nothing ticked → Print prints only the staff on screen (one part)',
        Tag.REGRESSION,
      ),
      async function (this: Mocha.Context): Promise<void> {
        requirePrint(this);
        this.timeout(Timeouts.MOCHA_HOOK);
        requireCapture(this);
        await freshV4('staff-payroll');
        const [row] = await rowsWithFigures(1, this);
        if (!row) return;

        await reportPrintPanel.selectRowAt(row.index);
        await reportsV4Page.waitForDataSettled();
        expect(await reportPrintPanel.isPrintShown(Timeouts.MEDIUM)).toBe(true);
        expect(await reportPrintPanel.printCount()).toBe(0);

        const before = (await capturedPrints()).length;
        await printAndSettle();
        const staffLines = receiptStaffLines(receiptText(await waitForPrint(before + 1)));
        expect(staffLines.length).toBe(1);
        expect(staffLines[0] ?? '').toContain(row.name);
      },
    );

    it(
      title(
        'TC-VP4809-24: only staff with no figures ticked → nothing prints, "Nothing to print" toast, ticks stay',
        Tag.REGRESSION,
      ),
      async function (this: Mocha.Context): Promise<void> {
        requirePrint(this);
        this.timeout(Timeouts.MOCHA_HOOK);
        requireCapture(this);
        await freshV4('staff-payroll');
        const empty = (await reportPrintPanel.mountedStaffRows()).find((r) => !rowHasFigures(r));
        if (!empty) {
          log.warn('SKIP — no mounted Staff Payroll row with every figure at $0.00.');
          this.skip();
        }

        await reportPrintPanel.setRowTick(empty.name, true);
        const before = (await capturedPrints()).length;
        await toastMessage.dismissAll(Timeouts.SHORT);
        await printAndSettle();

        const toast = await waitToast(ReportPrintLabels.nothing, Timeouts.LONG);
        expect(toast ?? '(no toast)').toMatch(new RegExp(ReportPrintLabels.nothing.join('|'), 'i'));
        expect((await capturedPrints()).length).toBe(before);
        expect((await reportPrintPanel.rowTicks()).find((t) => t.name === empty.name)?.checked).toBe(true);
      },
    );

    it(
      title('TC-VP4809-25: changing the pay period drops every tick', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        requirePrint(this);
        await freshV4('staff-payroll');
        const options = await reportPrintPanel.periodOptions();
        if (options.length < 2) this.skip();

        const [first] = await reportPrintPanel.rowTicks();
        if (!first) throw new Error('Staff Payroll V4 mounted no staff row.');
        await reportPrintPanel.setRowTick(first.name, true);
        expect(await reportPrintPanel.printCount()).toBe(1);

        await reportPrintPanel.selectPeriodAt(1);
        await reportsV4Page.waitForDataSettled();
        expect((await reportPrintPanel.rowTicks()).some((t) => t.checked)).toBe(false);
        if (await reportPrintPanel.isPrintShown()) expect(await reportPrintPanel.printCount()).toBe(0);
      },
    );

    it(
      title('TC-VP4809-26: a ticked staff hidden by the search loses its tick', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        requirePrint(this);
        await freshV4('staff-payroll');
        const ticks = await reportPrintPanel.rowTicks();
        const a = ticks[0];
        const b = ticks.find(
          (t) =>
            a !== undefined &&
            t.name.length >= 3 &&
            !t.name.toLowerCase().includes(a.name.toLowerCase()) &&
            !a.name.toLowerCase().includes(t.name.toLowerCase()),
        );
        if (!a || !b) this.skip();

        await reportPrintPanel.setRowTick(a.name, true);
        expect(await reportPrintPanel.printCount()).toBe(1);
        try {
          await reportsV4Page.search(b.name);
          const listed = await reportPrintPanel.rowTicks();
          expect(listed.map((t) => t.name)).not.toContain(a.name);
          if (await reportPrintPanel.isPrintShown()) expect(await reportPrintPanel.printCount()).toBe(0);
        } finally {
          await reportsV4Page.clearSearch();
        }
        expect((await reportPrintPanel.rowTicks()).find((t) => t.name === a.name)?.checked ?? false).toBe(
          false,
        );
      },
    );

    it(
      title('TC-VP4809-27: Staff Income V4 prints several ticked staff on one receipt', Tag.REGRESSION),
      async function (this: Mocha.Context): Promise<void> {
        requirePrint(this);
        this.timeout(Timeouts.MOCHA_HOOK);
        requireCapture(this);
        await freshV4('staff-income');
        const picked = (await rowsWithFigures(2, this)).slice(0, 2);
        for (const row of picked) await reportPrintPanel.setRowTick(row.name, true);

        const before = (await capturedPrints()).length;
        await printAndSettle();
        const staffLines = receiptStaffLines(receiptText(await waitForPrint(before + 1)));
        expect(staffLines.length).toBe(picked.length);
        picked.forEach((row, i) => expect(staffLines[i] ?? '').toContain(row.name));
      },
    );

    // Disabled for now: needs a real thermal printer — re-enable once QC has one.
    // it(
    //   title(
    //     'TC-VP4809-28: the paper receipt separates each staff clearly — PENDING (needs a real thermal printer; paper output is not assertable here)',
    //   ),
    // );
  });
});
