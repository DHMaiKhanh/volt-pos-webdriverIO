import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import { settingsNavItem } from '../../constants/testids.js';
import {
  CREATE_STAFF_INPUTS,
  STAFF_INFO_FIELDS,
  StaffsCss,
  StaffsIds,
  StaffsText,
  staffsCreateInput,
  staffsLink,
  staffsSelectOption,
  staffsTab,
} from '../../constants/testids.settings-staffs.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle, waitUntilPath } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/** One row of the All Employees list. */
export interface StaffRow {
  name: string;
  /** The status badge text (`Active` / `Inactive`, or the vi pair). */
  status: string;
  href: string;
}

/** One weekday of the Work Hours tab. */
export interface StaffWorkDay {
  day: string;
  on: boolean;
  /** Values of the `type="time"` pickers in that row (empty for a closed day). */
  times: string[];
}

/** Console messages a page-level hook caught. */
export interface CapturedConsole {
  level: 'error' | 'warn';
  text: string;
}

/**
 * Settings → Employees — `/settings/staffs` and `/settings/staffs/$staffId`.
 *
 * ## Nothing here persists
 *
 * The detail has ONE screen-level Save shared by its five tabs, and Create New
 * Staff submits from its header — this page object exposes neither. The specs
 * read, make the form dirty (TC-EMP-23) and then DISCARD through the app's own
 * leave-with-unsaved-changes guard ({@link leaveToSection}). The Work Hours /
 * Permissions switches would dirty the form too, so they are only read.
 *
 * ## The leave guard
 *
 * `staff-detail-pending-update-confirm.tsx` registers a TanStack `useBlocker`:
 * while the form is dirty, any route change raises an alertdialog ("Are you sure
 * you want to change tab?"). A plain `settingsPage.openSection()` would wait for
 * a path that never comes, so leaving a possibly-dirty detail goes through
 * {@link leaveToSection}, which answers the guard.
 */
export class StaffsSettingsPage extends BasePage {
  readonly name = 'Employees';

  readonly route: string = Routes.SETTINGS_STAFFS;

  /** A staff row — only rendered once the staff query returned. */
  protected readonly readyAnchor: Locator = StaffsIds.staffLinks;

  /* --------------------------------------------------------------------- *
   * List chrome
   * --------------------------------------------------------------------- */

  isHeadingShown(): Promise<boolean> {
    return this.isVisible(StaffsIds.heading, Timeouts.MEDIUM);
  }

  isReorderShown(): Promise<boolean> {
    return this.isVisible(StaffsIds.reorderButton);
  }

  isCreateShown(): Promise<boolean> {
    return this.isVisible(StaffsIds.createButton);
  }

  isSearchShown(): Promise<boolean> {
    return this.isVisible(StaffsIds.search);
  }

  isSelectStaffPlaceholderShown(): Promise<boolean> {
    return this.isVisible(StaffsIds.selectStaffPlaceholder, Timeouts.MEDIUM);
  }

  async statusFilterText(): Promise<string> {
    return this.text(StaffsIds.statusFilter, { visible: true });
  }

  /** Every listed staff row. Name and badge come from the row's rendered lines. */
  async staffRows(): Promise<StaffRow[]> {
    // An empty list (no match) is a valid state, so no hard wait on the anchor.
    await this.exists(StaffsIds.staffLinks, Timeouts.SHORT);
    await settle(Timeouts.DEBOUNCE);
    return browser.execute((css: string) => {
      return Array.from(document.querySelectorAll<HTMLAnchorElement>(css))
        .filter((a) => a.getClientRects().length > 0)
        .map((a) => {
          const lines = a.innerText
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
          return {
            name: lines.length >= 2 ? (lines[lines.length - 2] ?? '') : (lines[0] ?? ''),
            status: lines[lines.length - 1] ?? '',
            href: a.getAttribute('href') ?? '',
          };
        });
    }, StaffsCss.staffLinks);
  }

  /** Open the status filter and return its option labels. Leaves the listbox OPEN. */
  async openStatusFilter(): Promise<string[]> {
    await this.click(StaffsIds.statusFilter);
    const options = await this.findAll(StaffsIds.selectOptions, { timeout: Timeouts.MEDIUM });
    const labels: string[] = [];
    for (const option of options) labels.push((await option.getText()).trim());
    return labels;
  }

  async chooseStatusFilter(pair: readonly string[]): Promise<this> {
    if (!(await this.exists(StaffsIds.selectOptions, Timeouts.ANIMATION)))
      await this.click(StaffsIds.statusFilter);
    await this.click(staffsSelectOption(pair));
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  async search(text: string): Promise<this> {
    await this.setValue(StaffsIds.search, text);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  async clearSearch(): Promise<this> {
    const input = await this.find(StaffsIds.search, { visible: true });
    await input.click();
    await browser.keys(['Control', 'a']);
    await browser.keys(['Backspace']);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Detail
   * --------------------------------------------------------------------- */

  /** Open a staff member by name; waits for the detail route and the Information form. */
  async openStaff(name: string): Promise<string> {
    await this.click(staffsLink(name));
    const path = await waitUntilPath((p) => /^\/settings\/staffs\/[^/]+$/.test(p), {
      timeout: Timeouts.NAVIGATION,
      message: `Staff "${name}" never opened its detail route`,
    });
    await this.find(StaffsIds.detailTabs, { visible: true, timeout: Timeouts.MEDIUM });
    await settle();
    return path;
  }

  /** The detail `<h3>` (the staff display name) — every visible h3 except "All Employees". */
  async detailHeading(): Promise<string> {
    await this.find(StaffsIds.detailTabs, { visible: true, timeout: Timeouts.MEDIUM });
    return browser.execute(
      (exclude: readonly string[]) => {
        const h3 = Array.from(document.querySelectorAll('h3')).find((el) => {
          const text = (el.textContent ?? '').trim();
          return (
            text !== '' &&
            !exclude.includes(text) &&
            !el.closest('[role="dialog"]') &&
            el.getClientRects().length > 0
          );
        });
        return (h3?.textContent ?? '').trim();
        // The settings shell's own "Setting" h3 renders first on 1.1.56 — skip it too.
      },
      [...StaffsText.allEmployees, 'Setting', 'Cài đặt'],
    );
  }

  /**
   * Is Save pressable? The form recomputes dirty state a beat after an edit, so
   * this waits briefly for it to light up rather than reading a single frame.
   */
  async isSaveEnabled(): Promise<boolean> {
    const button = await this.find(StaffsIds.saveButton, { visible: true, timeout: Timeouts.MEDIUM });
    return browser
      .waitUntil(() => button.isEnabled(), { timeout: Timeouts.ANIMATION, interval: 100 })
      .catch(() => false);
  }

  async tabs(): Promise<{ label: string; selected: boolean }[]> {
    const tabs = await this.findAll(StaffsIds.detailTabs, { timeout: Timeouts.MEDIUM });
    const out: { label: string; selected: boolean }[] = [];
    for (const tab of tabs) {
      if (!(await tab.isDisplayed())) continue;
      out.push({
        label: (await tab.getText()).trim(),
        selected: (await tab.getAttribute('aria-selected')) === 'true',
      });
    }
    return out;
  }

  /** Open a detail tab by its 0-based position (Information … Permissions). */
  async openTab(index: number): Promise<this> {
    const en = StaffsText.tabsEn[index];
    const vi = StaffsText.tabsVi[index];
    if (en === undefined || vi === undefined) throw new Error(`${this.name}: no tab ${String(index)}.`);
    await this.click(staffsTab(en, vi));
    await this.find(StaffsIds.activeTabpanel, { visible: true, timeout: Timeouts.MEDIUM });
    await settle();
    return this;
  }

  /** The active tab panel's visible text, whitespace-collapsed. */
  async activePanelText(): Promise<string> {
    return (await this.text(StaffsIds.activeTabpanel, { visible: true })).replace(/\s+/g, ' ');
  }

  /* --- Information --- */

  /** Information-tab fields that are NOT rendered (empty = all present), plus Country/State. */
  async missingInfoFields(): Promise<string[]> {
    await this.find(StaffsIds.nickname, { timeout: Timeouts.MEDIUM });
    const missing = await browser.execute(
      (fields: readonly { name: string; css: string }[]) =>
        fields.filter((field) => document.querySelector(field.css) === null).map((field) => field.name),
      STAFF_INFO_FIELDS,
    );
    if (!(await this.exists(StaffsIds.countrySelect, Timeouts.ANIMATION))) missing.push('country');
    if (!(await this.exists(StaffsIds.stateSelect, Timeouts.ANIMATION))) missing.push('state');
    return missing;
  }

  nicknameValue(): Promise<string> {
    return this.value(StaffsIds.nickname, { timeout: Timeouts.MEDIUM });
  }

  staffCodeValue(): Promise<string> {
    return this.value(StaffsIds.staffCode, { timeout: Timeouts.MEDIUM });
  }

  cityValue(): Promise<string> {
    return this.value(StaffsIds.city, { timeout: Timeouts.MEDIUM });
  }

  /** Replace the City value — dirties the form. Never followed by Save in this suite. */
  async setCity(text: string): Promise<this> {
    await this.setValue(StaffsIds.city, text);
    await settle();
    return this;
  }

  /* --- Compensation --- */

  /**
   * Make the salary-type radios mountable.
   *
   * They live inside the Commission + Salary / Salary accordion sections, and a
   * collapsed Radix accordion unmounts its content. Expanding a section header
   * only opens it — selecting a mode is the LABEL's click, not the header's —
   * so this does not dirty the form.
   */
  async ensureSalaryControls(): Promise<boolean> {
    for (let i = 0; i < 3; i += 1) {
      if (await this.exists(StaffsIds.salaryByPeriod, Timeouts.ANIMATION)) return true;
      const collapsed = await this.findAll(StaffsIds.collapsedAccordion, { timeout: Timeouts.ANIMATION });
      const header = collapsed[0];
      if (!header) return false;
      // Click near the RIGHT edge (the chevron): the label on the left selects
      // the compensation mode, which would dirty the form. `x` is an offset from
      // the element's centre.
      const { width } = await header.getSize();
      await header.click({ x: Math.max(0, Math.floor(width / 2) - 16) });
      await settle();
    }
    return this.exists(StaffsIds.salaryByPeriod, Timeouts.ANIMATION);
  }

  /** Checked state of the three salary-type radios (first displayed copy each). */
  async salaryTypeStates(): Promise<{ salaryByPeriod: boolean; wagePerDay: boolean; wagePerHour: boolean }> {
    return {
      salaryByPeriod: await this.isCheckedDisplayed(StaffsIds.salaryByPeriod),
      wagePerDay: await this.isCheckedDisplayed(StaffsIds.wagePerDay),
      wagePerHour: await this.isCheckedDisplayed(StaffsIds.wagePerHour),
    };
  }

  /** The four money/percent fields, `null` where not rendered for this staff's mode. */
  async compensationValues(): Promise<
    Record<'salaryAmount' | 'deductionPerDay' | 'cashCheckSplit' | 'percentCreditCardTip', string | null>
  > {
    const read = async (loc: Locator): Promise<string | null> => {
      const el = await this.firstDisplayed(loc);
      return el ? ((await el.getValue()) ?? '') : null;
    };
    return {
      salaryAmount: await read(StaffsIds.salaryAmount),
      deductionPerDay: await read(StaffsIds.deductionPerDay),
      cashCheckSplit: await read(StaffsIds.cashCheckSplit),
      percentCreditCardTip: await read(StaffsIds.percentCreditCardTip),
    };
  }

  /** The Exclude-Tips switch: present?, its `aria-checked`, and its label text. */
  async payrollTipSwitch(): Promise<{ present: boolean; checked: string | null; label: string }> {
    const el = await this.firstDisplayed(StaffsIds.payrollTipSwitch);
    if (!el) return { present: false, checked: null, label: '' };
    const label = await browser.execute(
      (target: HTMLElement) => {
        const id = target.id;
        const lab = id ? document.querySelector(`label[for="${id}"]`) : null;
        return ((lab ?? target.parentElement)?.textContent ?? '').replace(/\s+/g, ' ').trim();
      },
      el as unknown as HTMLElement,
    );
    return { present: true, checked: await el.getAttribute('aria-checked'), label };
  }

  /* --- Service Skills / Work Hours / Permissions --- */

  /** What the Service Skills panel renders: category checkboxes and toggle items. */
  async serviceSkills(): Promise<{ checkboxes: number; toggles: number; text: string }> {
    const panel = await this.find(StaffsIds.activeTabpanel, { visible: true, timeout: Timeouts.MEDIUM });
    await settle();
    return browser.execute(
      (el: HTMLElement) => ({
        checkboxes: el.querySelectorAll('[role="checkbox"]').length,
        toggles: el.querySelectorAll('[role="radio"], button[data-state="on"], button[data-state="off"]')
          .length,
        text: (el.innerText ?? '').replace(/\s+/g, ' ').trim(),
      }),
      panel as unknown as HTMLElement,
    );
  }

  /** Each weekday row of the Work Hours tab. */
  async workHours(): Promise<StaffWorkDay[]> {
    const panel = await this.find(StaffsIds.activeTabpanel, { visible: true, timeout: Timeouts.MEDIUM });
    await settle();
    return browser.execute(
      (el: HTMLElement) =>
        Array.from(el.querySelectorAll<HTMLElement>('[role="switch"]')).map((sw) => {
          let row: HTMLElement | null = sw;
          for (let i = 0; i < 6 && row && !row.querySelector('input, p'); i += 1) row = row.parentElement;
          const times = row
            ? Array.from(row.querySelectorAll<HTMLInputElement>('input[type="time"]')).map(
                (input) => input.value,
              )
            : [];
          return {
            day: sw.id,
            on: sw.getAttribute('aria-checked') === 'true' || sw.getAttribute('data-state') === 'checked',
            times,
          };
        }),
      panel as unknown as HTMLElement,
    );
  }

  isSyncBusinessHoursShown(): Promise<boolean> {
    return this.isVisible(StaffsIds.syncBusinessHours, Timeouts.MEDIUM);
  }

  /** The Permissions panel: assigned-role badge, its text, and the switch count. */
  async permissions(): Promise<{ role: string; text: string; switches: number }> {
    const panel = await this.find(StaffsIds.activeTabpanel, { visible: true, timeout: Timeouts.MEDIUM });
    await settle();
    return browser.execute(
      (el: HTMLElement) => {
        const badge = el.querySelector('[data-slot="badge"]');
        return {
          role: (badge?.textContent ?? '').trim(),
          text: (el.innerText ?? '').replace(/\s+/g, ' ').trim(),
          switches: el.querySelectorAll('[role="switch"]').length,
        };
      },
      panel as unknown as HTMLElement,
    );
  }

  /* --------------------------------------------------------------------- *
   * Leaving (with the unsaved-changes guard answered)
   * --------------------------------------------------------------------- */

  /**
   * Click a settings-rail entry and land on it, DISCARDING unsaved staff edits
   * if the router blocker asks. Returns whether the guard came up.
   */
  async leaveToSection(path: string): Promise<boolean> {
    await this.click(settingsNavItem(path));
    let sawGuard = false;
    if (await this.isVisible(StaffsIds.unsavedGuard, Timeouts.SHORT)) {
      sawGuard = true;
      await this.click(StaffsIds.unsavedGuardConfirm);
      await this.waitGone(StaffsIds.unsavedGuard, Timeouts.SHORT);
    }
    await waitUntilPath((p) => p.startsWith(path), {
      timeout: Timeouts.NAVIGATION,
      message: `Never left the staff detail for ${path}`,
    });
    return sawGuard;
  }

  /* --------------------------------------------------------------------- *
   * Create New Staff dialog (never submitted)
   * --------------------------------------------------------------------- */

  async openCreateDialog(): Promise<this> {
    await this.click(StaffsIds.createButton);
    await this.dialog();
    return this;
  }

  isDialogOpen(): Promise<boolean> {
    return this.isVisible(StaffsIds.dialog, Timeouts.ANIMATION);
  }

  async dialogTitle(): Promise<string> {
    const dialog = await this.dialog();
    return (
      await (await this.find(StaffsIds.dialogTitle, { within: dialog, timeout: Timeouts.SHORT })).getText()
    ).trim();
  }

  async dialogText(): Promise<string> {
    return (await (await this.dialog()).getText()).replace(/\s+/g, ' ');
  }

  /** Create-form inputs that are NOT rendered (empty = all present). */
  async missingCreateInputs(): Promise<string[]> {
    const dialog = await this.dialog();
    const missing: string[] = [];
    for (const name of CREATE_STAFF_INPUTS) {
      const found = await this.findAll(staffsCreateInput(name), {
        within: dialog,
        timeout: Timeouts.ANIMATION,
      });
      if (found.length === 0) missing.push(name);
    }
    return missing;
  }

  /** Placeholder of each Create-form input, by `name`. */
  async createPlaceholders(): Promise<Record<string, string>> {
    const dialog = await this.dialog();
    const out: Record<string, string> = {};
    for (const name of CREATE_STAFF_INPUTS) {
      const el = await this.find(staffsCreateInput(name), { within: dialog, timeout: Timeouts.SHORT }).catch(
        () => null,
      );
      out[name] = el ? ((await el.getAttribute('placeholder')) ?? '') : '';
    }
    return out;
  }

  async isCreateStateDisabled(): Promise<boolean> {
    const dialog = await this.dialog();
    const trigger = await this.find(StaffsIds.dialogStateTrigger, {
      within: dialog,
      timeout: Timeouts.SHORT,
    });
    return !(await trigger.isEnabled());
  }

  async isCreateEnabled(): Promise<boolean> {
    const dialog = await this.dialog();
    return (
      await this.find(StaffsIds.dialogCreateBtn, { within: dialog, timeout: Timeouts.SHORT })
    ).isEnabled();
  }

  async closeDialogWithEscape(): Promise<this> {
    await browser.keys(['Escape']);
    // Escape normally closes it; 1.1.56 sometimes keeps it open, so the header
    // Close is the fallback.
    const closed = await this.waitGone(StaffsIds.dialog, Timeouts.SHORT)
      .then(() => true)
      .catch(() => false);
    if (!closed) {
      await this.click(StaffsIds.dialogClose);
      await this.waitGone(StaffsIds.dialog, Timeouts.SHORT);
    }
    return this;
  }

  /** Escape until no dialog / listbox is open — hygiene between cases. */
  async closeAnything(): Promise<void> {
    for (let i = 0; i < 3; i += 1) {
      const open =
        (await this.exists(StaffsIds.dialog, Timeouts.ANIMATION)) ||
        (await this.exists(StaffsIds.selectOptions, Timeouts.ANIMATION));
      if (!open) return;
      await browser.keys(['Escape']);
      await settle();
    }
  }

  /* --------------------------------------------------------------------- *
   * Console capture (TC-EMP-30)
   * --------------------------------------------------------------------- */

  /**
   * Start recording `console.error` / `console.warn` in the page.
   *
   * WebView2 exposes no browser-log endpoint to the driver, so the hook wraps
   * the two console methods in place. Resource-load failures (the `asset://`
   * avatar) never reach `console.*` this way — they are not captured.
   */
  async startConsoleCapture(): Promise<void> {
    await browser.execute(() => {
      const w = window as unknown as {
        __qaConsole?: { level: string; text: string }[];
        __qaConsoleHooked?: boolean;
      };
      w.__qaConsole = [];
      if (w.__qaConsoleHooked) return;
      w.__qaConsoleHooked = true;
      for (const level of ['error', 'warn'] as const) {
        // Runs in the APP's page, not the test process: wrapping `console` is
        // the capture itself (TC-EMP-30), so the rule against console use does not apply.
        // eslint-disable-next-line no-console
        const original = console[level].bind(console);
        // eslint-disable-next-line no-console
        console[level] = (...args: unknown[]) => {
          w.__qaConsole?.push({
            level,
            text: args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '),
          });
          original(...args);
        };
      }
    });
  }

  async readConsoleCapture(): Promise<CapturedConsole[]> {
    return browser.execute(() => {
      const w = window as unknown as { __qaConsole?: { level: 'error' | 'warn'; text: string }[] };
      return w.__qaConsole ?? [];
    });
  }

  /* --------------------------------------------------------------------- *
   * Internals
   * --------------------------------------------------------------------- */

  private async dialog(): Promise<WebdriverIO.Element> {
    return this.find(StaffsIds.dialog, { visible: true, timeout: Timeouts.MEDIUM });
  }

  /** First displayed match, or `null` — the compensation forms mount one copy per mode. */
  private async firstDisplayed(loc: Locator): Promise<WebdriverIO.Element | null> {
    const all = await this.findAll(loc, { timeout: Timeouts.ANIMATION });
    for (const el of all) if (await el.isDisplayed()) return el;
    return all[0] ?? null;
  }

  private async isCheckedDisplayed(loc: Locator): Promise<boolean> {
    const el = await this.firstDisplayed(loc);
    if (!el) return false;
    return (
      (await el.getAttribute('aria-checked')) === 'true' ||
      (await el.getAttribute('data-state')) === 'checked'
    );
  }
}

export default new StaffsSettingsPage();
