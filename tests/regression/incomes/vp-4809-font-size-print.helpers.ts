/**
 * Scaffolding for `vp-4809-font-size-print.spec.ts` (VP-4809).
 *
 * NOT a spec (the runner globs `*.spec.ts`). Three things live here because no
 * page object covers them yet and the shared catalogue / page objects carry
 * uncommitted edits from parallel work:
 *
 * 1. {@link fontSizeCard} — the Font Size card on Settings → Accessibility, and
 *    the in-page probe that measures what the setting actually did to text.
 * 2. {@link reportPrintPanel} — the print tick boxes and the Print button the
 *    V4 Staff Income / Staff Payroll report pages draw (volt-pos#3087).
 * 3. {@link installPrintCapture} — a wrap of `window.__TAURI_INTERNALS__.invoke`
 *    that captures the `print` GraphQL mutation's base64 ESC/POS payload and
 *    answers it itself, so the shared till never reaches its receipt printer and
 *    the receipt's TEXT ("Staff: …" per part) can be asserted.
 */

import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { gql } from '../../../src/api/index.js';
import { Routes } from '../../../src/constants/routes.js';
import {
  FONT_SIZES,
  FontSizeIds,
  fontSizeOptionLabel,
  fontSizeRadio,
  ReportPrintCss,
  ReportPrintIds,
  reportRowTick,
  reportStaffRowClickCell,
  type FontSizeOption,
} from '../../../src/constants/testids.font-size-print.js';
import { moneyCents } from '../../../src/pages/incomes/reportDom.js';
import { ReportChromeIds, V4_ROUTE_PREFIX } from '../../../src/constants/testids.reports-v4.js';
import type { Locator } from '../../../src/helpers/selectors.js';
import { logStep } from '../../../src/helpers/steps.js';
import { settle } from '../../../src/helpers/wait.js';
import { BasePage } from '../../../src/pages/BasePage.js';

/* ------------------------------------------------------------------------- *
 * Font Size
 * ------------------------------------------------------------------------- */

/** `merchant_theme_pos_style` — the sys_setting row holding `font_size` (`shared/settings/font-size.ts`). */
export const THEME_POS_STYLE_KEY = 'merchant_theme_pos_style';

/** The POS's own read (`hooks/font-size.gql.ts → getFontSizeSetting`), transcribed. */
const GET_FONT_SIZE_SETTING = `
  query getFontSizeSetting {
    sysSettingList(where: { key: { eq: "merchant_theme_pos_style" } }) {
      id
      key
      value
    }
  }
`;

interface SysSettingRow {
  id: string;
  key: string;
  value: string | null;
}

/** What the stored row says, parsed. `raw` is `null` when the merchant has no row at all. */
export interface StoredThemePosStyle {
  raw: string | null;
  object: Record<string, unknown>;
  fontSize: string | null;
}

/** Read the stored `merchant_theme_pos_style` row the way the screen does. Read-only. */
export async function readStoredThemePosStyle(): Promise<StoredThemePosStyle> {
  const data = await gql().query<{ sysSettingList: SysSettingRow[] }>(GET_FONT_SIZE_SETTING, {
    operationName: 'getFontSizeSetting',
  });
  const raw = data.sysSettingList.find((row) => row.key === THEME_POS_STYLE_KEY)?.value ?? null;
  let object: Record<string, unknown> = {};
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      // The API may hand back a JSON string of the object (double-encoded).
      const inner: unknown = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
      if (inner && typeof inner === 'object') object = inner as Record<string, unknown>;
    } catch {
      object = {};
    }
  }
  const fontSize = typeof object['font_size'] === 'string' ? object['font_size'] : null;
  return { raw, object, fontSize };
}

/**
 * Text scale per option — `windows.css`: `--font-size-text` is
 * `--font-size-base × 0.875 / 1 / 1.125`, and `text-base` is `1.25 ×` that.
 */
export const TEXT_SCALE: Record<FontSizeOption, number> = { small: 0.875, medium: 1, large: 1.125 };

/** What the setting did to THIS window, measured — not the radio state. */
export interface FontSizeProbe {
  /** `data-font-size` on `<html>` (`useApplyFontSize`), `null` when unset. */
  attr: string | null;
  /** Computed px of `1rem` — spacing/layout; must NOT move with the setting. */
  remPx: number;
  /** Computed px of `var(--text-base)` — body text; scales with the setting. */
  textBasePx: number;
  /** `textBasePx / remPx / 1.25` → 0.875 / 1 / 1.125. */
  scale: number;
  /** `<html>` scrolls sideways (text overflowing the layout). */
  overflowX: boolean;
}

/** Measure the current window with two throw-away probe elements. */
export async function probeFontSize(): Promise<FontSizeProbe> {
  const raw = await browser.execute(function () {
    const root = document.documentElement;
    const make = function (fontSize: string): number {
      const el = document.createElement('span');
      el.style.position = 'absolute';
      el.style.visibility = 'hidden';
      el.style.fontSize = fontSize;
      el.textContent = 'x';
      document.body.appendChild(el);
      const px = parseFloat(getComputedStyle(el).fontSize);
      el.remove();
      return px;
    };
    return {
      attr: root.getAttribute('data-font-size'),
      remPx: make('1rem'),
      textBasePx: make('var(--text-base)'),
      overflowX: root.scrollWidth > root.clientWidth + 1,
    };
  });
  const scale = raw.remPx > 0 ? raw.textBasePx / raw.remPx / 1.25 : Number.NaN;
  return { ...raw, scale };
}

/** Settings → Accessibility, the Font Size card only. */
export class FontSizeCard extends BasePage {
  readonly name = 'Accessibility — Font Size';
  readonly route: string = Routes.SETTINGS_ACCESSIBILITY;

  protected readonly readyAnchor: Locator = fontSizeRadio('medium');

  isCardShown(): Promise<boolean> {
    return this.isVisible(FontSizeIds.cardTitle, Timeouts.MEDIUM);
  }

  /** Which options are rendered (radio present). */
  async renderedOptions(): Promise<FontSizeOption[]> {
    const out: FontSizeOption[] = [];
    for (const option of FONT_SIZES) if (await this.exists(fontSizeRadio(option), 1_000)) out.push(option);
    return out;
  }

  /** The label text beside each radio, in order. */
  async optionLabels(): Promise<string[]> {
    const out: string[] = [];
    for (const option of FONT_SIZES) {
      out.push((await this.text(fontSizeOptionLabel(option)).catch(() => '')).trim());
    }
    return out;
  }

  /** The checked radio, by Radix state. */
  async selected(): Promise<FontSizeOption | null> {
    for (const option of FONT_SIZES) {
      const el = await this.find(fontSizeRadio(option), { visible: true });
      const aria = await el.getAttribute('aria-checked');
      const state = await el.getAttribute('data-state');
      if (aria === 'true' || state === 'checked') return option;
    }
    return null;
  }

  /**
   * Pick an option and wait until `<html data-font-size>` follows. The card
   * disables itself while the upsert runs; the attribute is the end state.
   */
  async choose(option: FontSizeOption): Promise<void> {
    await logStep(`Font Size → ${option}`);
    await this.click(fontSizeRadio(option));
    await browser.waitUntil(async () => (await probeFontSize()).attr === option, {
      timeout: Timeouts.MEDIUM,
      interval: 200,
      timeoutMsg: `<html data-font-size> never became "${option}" after picking it.`,
    });
  }
}

export const fontSizeCard = new FontSizeCard();

/* ------------------------------------------------------------------------- *
 * Multi-staff print on the V4 report pages
 * ------------------------------------------------------------------------- */

/** One mounted row tick: the staff name (`aria-label`) and whether it is ticked. */
export interface RowTickState {
  name: string;
  checked: boolean;
}

/** One mounted staff row of the V4 list, read through its tick box. */
export interface MountedStaffRow {
  /** 0-based position among the MOUNTED staff rows. */
  index: number;
  name: string;
  checked: boolean;
  orders: number;
  subtotalCents: number;
  supplyFeeCents: number;
  tipCents: number;
  totalIncomeCents: number;
}

/** Any figure on the row other than zero — what decides "has something to print". */
export const rowHasFigures = (row: MountedStaffRow): boolean =>
  row.orders !== 0 ||
  row.subtotalCents !== 0 ||
  row.supplyFeeCents !== 0 ||
  row.tipCents !== 0 ||
  row.totalIncomeCents !== 0;

/** Ticks + Print button of the V4 Staff Income / Staff Payroll pages. */
export class ReportPrintPanel extends BasePage {
  readonly name = 'Reports V4 — print ticks';
  readonly route = V4_ROUTE_PREFIX.replace(/\/$/, '');

  protected readonly readyAnchor: Locator = ReportPrintIds.tickAll;

  hasTickAll(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(ReportPrintIds.tickAll, timeout);
  }

  /** Every row tick currently mounted (virtualised list → the rows near the scroll position). */
  async rowTicks(): Promise<RowTickState[]> {
    return browser.execute(function (css: string) {
      return Array.prototype.slice
        .call(document.querySelectorAll(css))
        .filter(function (el: HTMLElement) {
          return el.getClientRects().length > 0;
        })
        .map(function (el: HTMLElement) {
          return {
            name: (el.getAttribute('aria-label') ?? '').trim(),
            checked:
              el.getAttribute('data-state') === 'checked' || el.getAttribute('aria-checked') === 'true',
          };
        });
    }, ReportPrintCss.rowTick);
  }

  /**
   * The mounted staff rows (the ones with a tick box), figures in cents, in
   * display order. Does NOT scroll — unlike `reportsV4Page.staffRows()` — so the
   * rows read are the rows whose tick boxes exist right now.
   */
  async mountedStaffRows(): Promise<MountedStaffRow[]> {
    const raw = await browser.execute(function (css: string) {
      const out: { name: string; checked: boolean; cells: string[] }[] = [];
      const ticks = Array.prototype.slice.call(document.querySelectorAll(css)) as HTMLElement[];
      for (const tick of ticks) {
        if (tick.getClientRects().length === 0) continue;
        const tr = tick.closest('tr');
        if (!tr) continue;
        const cells = (Array.prototype.slice.call(tr.querySelectorAll('td')) as HTMLElement[]).map(
          function (td) {
            return (td.innerText || td.textContent || '').replace(/\s+/g, ' ').trim();
          },
        );
        out.push({
          name: (tick.getAttribute('aria-label') ?? '').trim(),
          checked:
            tick.getAttribute('data-state') === 'checked' || tick.getAttribute('aria-checked') === 'true',
          cells: cells,
        });
      }
      return out;
    }, ReportPrintCss.rowTick);

    const money = (text: string | undefined): number => {
      try {
        return text && text !== '-' ? moneyCents(text) : 0;
      } catch {
        return 0;
      }
    };
    return raw.map((row, index) => ({
      index,
      name: row.name,
      checked: row.checked,
      orders: Number.parseInt((row.cells[1] ?? '0').replace(/[^\d-]/g, ''), 10) || 0,
      subtotalCents: money(row.cells[2]),
      supplyFeeCents: money(row.cells[3]),
      tipCents: money(row.cells[4]),
      totalIncomeCents: money(row.cells[5]),
    }));
  }

  /** Select (tap) the mounted staff row at 0-based `index` — opens its detail rail. */
  async selectRowAt(index: number): Promise<void> {
    await logStep(`${this.name}: select staff row #${String(index)}`);
    await this.click(reportStaffRowClickCell(index + 1));
    await settle(Timeouts.DEBOUNCE);
  }

  async isTickAllChecked(): Promise<boolean> {
    const el = await this.find(ReportPrintIds.tickAll, { visible: true });
    return (
      (await el.getAttribute('data-state')) === 'checked' ||
      (await el.getAttribute('aria-checked')) === 'true'
    );
  }

  /** Set the header box to `on` (clicks only when it differs). */
  async setTickAll(on: boolean): Promise<void> {
    if ((await this.isTickAllChecked()) === on) return;
    await logStep(`${this.name}: tick-all → ${on ? 'ON' : 'OFF'}`);
    await this.click(ReportPrintIds.tickAll);
    await settle();
  }

  /** Set one row's box to `on`, by staff name (clicks only when it differs). */
  async setRowTick(staffName: string, on: boolean): Promise<void> {
    const current = (await this.rowTicks()).find((tick) => tick.name === staffName);
    if (current?.checked === on) return;
    await logStep(`${this.name}: tick "${staffName}" → ${on ? 'ON' : 'OFF'}`);
    await this.click(reportRowTick(staffName));
    await settle();
  }

  /** Is the Print button drawn at all (the app hides it with nothing to print)? */
  isPrintShown(timeout: number = Timeouts.ANIMATION): Promise<boolean> {
    return this.isVisible(ReportPrintIds.printButton, timeout);
  }

  /** The Print button label — "Print", "Print (3)", "In (3)". */
  async printLabel(): Promise<string> {
    return (await this.text(ReportPrintIds.printButton, { visible: true })).replace(/\s+/g, ' ').trim();
  }

  /** `n` of "Print (n)", or 0 for a bare "Print". */
  async printCount(): Promise<number> {
    const match = /\((\d+)\)\s*$/.exec(await this.printLabel());
    return match ? Number(match[1]) : 0;
  }

  async pressPrint(): Promise<void> {
    await logStep(`${this.name}: press Print`);
    await this.click(ReportPrintIds.printButton);
  }

  /** Was the "Preparing n of m" modal seen within `timeout`? Polls fast — the walk can be short. */
  async sawProgress(timeout: number = Timeouts.SHORT): Promise<boolean> {
    return this.isVisible(ReportPrintIds.printProgress, timeout);
  }

  waitProgressGone(timeout: number = Timeouts.LONG): Promise<void> {
    return this.waitGone(ReportPrintIds.printProgress, timeout);
  }

  /** The period combobox's options (Staff Payroll). */
  async periodOptions(): Promise<string[]> {
    await this.click(ReportChromeIds.presetCombobox);
    const options = await this.findAll(ReportChromeIds.options, { timeout: Timeouts.SHORT });
    const labels: string[] = [];
    for (const option of options) labels.push((await option.getText()).trim());
    await browser.keys(['Escape']);
    await settle();
    return labels;
  }

  /** Pick the period at `index`; returns its label. */
  async selectPeriodAt(index: number): Promise<string> {
    await this.click(ReportChromeIds.presetCombobox);
    const options = await this.findAll(ReportChromeIds.options, { timeout: Timeouts.SHORT });
    const option = options[index];
    if (!option) {
      await browser.keys(['Escape']);
      throw new Error(
        `${this.name}: the period select has ${String(options.length)} option(s); #${String(index)} asked.`,
      );
    }
    const label = (await option.getText()).trim();
    await logStep(`${this.name}: period → "${label}"`);
    await option.click();
    await this.waitGone(ReportChromeIds.options, Timeouts.SHORT).catch(() => undefined);
    await settle(Timeouts.DEBOUNCE);
    return label;
  }
}

export const reportPrintPanel = new ReportPrintPanel();

/* ------------------------------------------------------------------------- *
 * Print capture
 * ------------------------------------------------------------------------- */

/** How the wrap got in — or `none` when the IPC object refused every way. */
export type CaptureMode = 'direct' | 'define' | 'replace' | 'none';

/**
 * Wrap the Tauri IPC so the `print` mutation is RECORDED and answered locally.
 *
 * `@tauri-apps/api`'s `invoke` reads `window.__TAURI_INTERNALS__.invoke` at call
 * time, and the POS fetcher (`lib/graphql-fetcher.ts`) goes through it, so the
 * wrap sees `mutation print($data: String!)` with the base64 ESC/POS receipt in
 * `variables.data`. Answering `{ data: { print: true } }` is what the Rust
 * command returns on success — the app then clears the ticks as after a real
 * print, and nothing reaches the shared till's printer. Every other command
 * (including this suite's own GraphQL reads) passes through untouched.
 *
 * Idempotent: a second install just empties the buffer.
 */
export async function installPrintCapture(): Promise<CaptureMode> {
  const mode = await browser.execute(function () {
    type Invoke = (cmd: string, args?: unknown, options?: unknown) => Promise<unknown>;
    const w = window as unknown as Record<string, unknown>;
    const existing = w['__e2ePrintCapture'] as { mode: string; payloads: string[] } | undefined;
    if (existing) {
      existing.payloads.length = 0;
      return existing.mode;
    }
    const internals = w['__TAURI_INTERNALS__'] as Record<string, unknown> | undefined;
    if (!internals || typeof internals['invoke'] !== 'function') return 'none';

    const original = internals['invoke'] as Invoke;
    const payloads: string[] = [];
    const wrapped: Invoke = function (cmd, args, options) {
      const a = (args ?? {}) as { query?: unknown; variables?: { data?: unknown } | null };
      if (cmd === 'graphql' && typeof a.query === 'string' && /mutation\s+print\b/.test(a.query)) {
        const data = a.variables && typeof a.variables.data === 'string' ? a.variables.data : '';
        payloads.push(data);
        return Promise.resolve({ data: { print: true } });
      }
      return original.call(internals, cmd, args, options);
    };

    let mode = 'none';
    try {
      internals['invoke'] = wrapped;
    } catch {
      /* non-writable — try the next way */
    }
    if (internals['invoke'] === wrapped) {
      mode = 'direct';
    } else {
      try {
        Object.defineProperty(internals, 'invoke', { value: wrapped, configurable: true, writable: true });
      } catch {
        /* non-configurable — try the next way */
      }
      if (internals['invoke'] === wrapped) {
        mode = 'define';
      } else {
        const proxy = Object.create(internals) as Record<string, unknown>;
        Object.defineProperty(proxy, 'invoke', { value: wrapped, configurable: true, writable: true });
        try {
          w['__TAURI_INTERNALS__'] = proxy;
        } catch {
          /* window property locked */
        }
        if (w['__TAURI_INTERNALS__'] === proxy) mode = 'replace';
      }
    }
    if (mode === 'none') return 'none';
    w['__e2ePrintCapture'] = { mode: mode, payloads: payloads, original: original, internals: internals };
    return mode;
  });
  return mode as CaptureMode;
}

/** Every captured print payload so far (base64 ESC/POS), oldest first. */
export async function capturedPrints(): Promise<string[]> {
  return browser.execute(function () {
    const capture = (window as unknown as Record<string, unknown>)['__e2ePrintCapture'] as
      { payloads: string[] } | undefined;
    return capture ? capture.payloads.slice() : [];
  });
}

/** Wait for the `n`-th captured print (1-based) and return it. */
export async function waitForPrint(n: number, timeout: number = Timeouts.LONG): Promise<string> {
  let prints: string[] = [];
  await browser.waitUntil(
    async () => {
      prints = await capturedPrints();
      return prints.length >= n;
    },
    { timeout, interval: 250, timeoutMsg: `No print #${String(n)} was sent within ${String(timeout)}ms.` },
  );
  return prints[n - 1] ?? '';
}

/** Put the real `invoke` back. Safe to call when nothing was installed. */
export async function uninstallPrintCapture(): Promise<void> {
  await browser.execute(function () {
    const w = window as unknown as Record<string, unknown>;
    const capture = w['__e2ePrintCapture'] as
      { mode: string; original: unknown; internals: Record<string, unknown> } | undefined;
    if (!capture) return;
    if (capture.mode === 'direct') capture.internals['invoke'] = capture.original;
    if (capture.mode === 'define')
      Object.defineProperty(capture.internals, 'invoke', {
        value: capture.original,
        configurable: true,
        writable: true,
      });
    if (capture.mode === 'replace') w['__TAURI_INTERNALS__'] = capture.internals;
    delete w['__e2ePrintCapture'];
  });
}

/**
 * The printable text of a base64 ESC/POS payload: control bytes become spaces,
 * runs of spaces collapse, line breaks survive. Enough to find "Staff: <name>".
 */
export function receiptText(payload: string): string {
  const trimmed = payload.trim();
  const isBase64 = trimmed.length > 0 && trimmed.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed);
  const text = isBase64 ? Buffer.from(trimmed, 'base64').toString('utf8') : trimmed;
  let printable = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    printable += char === '\n' || (code >= 0x20 && code !== 0x7f) ? char : ' ';
  }
  return printable.replace(/[^\S\n]+/g, ' ');
}

/** The "Staff: <name>" lines of a receipt, in print order (EN "Staff" / VI "Nhân viên"). */
export function receiptStaffLines(text: string): string[] {
  const out: string[] = [];
  const re = /(?:Staff|Nhân viên): ?([^\n]+)/g;
  for (let match = re.exec(text); match; match = re.exec(text)) out.push((match[1] ?? '').trim());
  return out;
}
