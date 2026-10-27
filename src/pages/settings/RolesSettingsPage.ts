import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import {
  ALL_ROLE_LABELS,
  MEMBERS_COUNT_PATTERN,
  ROLE_NAMES,
  RolesSettingsIds,
  roleLink,
  type RoleKey,
} from '../../constants/testids.settings-roles.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle, waitUntilPath } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/** One entry of the role list, as rendered. */
export interface RoleEntry {
  /** First line of the link — `Owner`. */
  name: string;
  /** Second line of the link — `11 Members`. */
  countLabel: string;
  /** The number in {@link countLabel}, or `NaN` when it does not parse. */
  count: number;
  href: string;
}

/** One staff member in the Assign dialog. */
export interface AssignItem {
  /** Visible text of the item minus the badge — the nickname (may be EMPTY: TC-ROLE-17). */
  name: string;
  /** The current-role badge, or `null` when the item shows none (TC-ROLE-18). */
  badge: string | null;
  hasCheckbox: boolean;
  checked: boolean;
  /** `alt` of the avatar `img`, or `null` when there is no image. */
  avatarAlt: string | null;
}

/**
 * `/settings/roles` — the four fixed system roles on the left, the selected
 * role's staff table on the right (`/settings/roles/<uuid>`), and the
 * "Assign to Staff Role" dialog.
 *
 * ## No write path, on purpose
 *
 * Assigning moves a staff member to another role — it changes what that person
 * can open and may raise the reset-permissions confirm. This page object exposes
 * NO method that presses the dialog's `Assign`: the specs open the dialog, search,
 * tick, read the button state and close it with Escape, which assigns nothing.
 *
 * ## Reading the dialog in one round trip
 *
 * The list can hold every staff member on the merchant. {@link assignItems} walks
 * the visible `li`s inside `browser.execute` and returns plain data, instead of
 * a WebDriver call per field per item.
 */
export class RolesSettingsPage extends BasePage {
  readonly name = 'Settings — Roles';

  readonly route: string = Routes.SETTINGS_ROLES;

  /** The role links only exist once the roles query returned. */
  protected readonly readyAnchor: Locator = RolesSettingsIds.roleLinks;

  /* --------------------------------------------------------------------- *
   * Role list
   * --------------------------------------------------------------------- */

  isHeadingShown(): Promise<boolean> {
    return this.isVisible(RolesSettingsIds.heading);
  }

  /** Are both list column headers ("Role", "Members Count") on screen? */
  async areListHeadersShown(): Promise<{ role: boolean; members: boolean }> {
    return {
      role: await this.isVisible(RolesSettingsIds.listHeaderRole),
      members: await this.isVisible(RolesSettingsIds.listHeaderMembers),
    };
  }

  isDetailPlaceholderShown(): Promise<boolean> {
    return this.isVisible(RolesSettingsIds.detailPlaceholder);
  }

  /** Is there any "create role" button? Expected: no. */
  hasCreateRoleButton(): Promise<boolean> {
    return this.isVisible(RolesSettingsIds.createRoleButton, Timeouts.ANIMATION);
  }

  /** Every role link, top to bottom, parsed into name + member count. */
  async roleEntries(): Promise<RoleEntry[]> {
    const links = await this.findAll(RolesSettingsIds.roleLinks, { timeout: Timeouts.MEDIUM });
    const entries: RoleEntry[] = [];
    for (const link of links) {
      const raw = await link.getProperty('innerText');
      const lines = (typeof raw === 'string' ? raw : await link.getText())
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
      const countLabel = lines[lines.length - 1] ?? '';
      const match = MEMBERS_COUNT_PATTERN.exec(countLabel);
      entries.push({
        name: lines[0] ?? '',
        countLabel,
        count: match ? Number(match[1]) : Number.NaN,
        href: (await link.getAttribute('href')) ?? '',
      });
    }
    return entries;
  }

  /** The member count badge of one role. Throws when the role is not listed. */
  async memberCount(role: RoleKey): Promise<number> {
    const names: readonly string[] = ROLE_NAMES[role];
    const entry = (await this.roleEntries()).find((e) => names.includes(e.name));
    if (!entry) throw new Error(`${this.name}: role "${ROLE_NAMES[role][0]}" is not in the list.`);
    return entry.count;
  }

  /**
   * Open a role's detail panel and wait for the router to land on its uuid path
   * and for the staff table to mount.
   */
  async openRole(role: RoleKey): Promise<this> {
    const target = roleLink(ROLE_NAMES[role]);
    const href = await (await this.find(target, { visible: true })).getAttribute('href');
    await this.click(target);
    await waitUntilPath((path) => (href ? path === href : /^\/settings\/roles\/[^/]+$/.test(path)), {
      timeout: Timeouts.NAVIGATION,
      message: `Roles: clicking "${ROLE_NAMES[role][0]}" never reached its detail route`,
    });
    await this.find(RolesSettingsIds.detailTable, { timeout: Timeouts.MEDIUM });
    await settle();
    return this;
  }

  /**
   * Is a role's link the active one?
   *
   * TanStack's `<Link>` stamps `aria-current="page"` and `data-status="active"` on
   * the link matching the current route; either counts.
   */
  async isRoleActive(role: RoleKey): Promise<boolean> {
    const link = await this.find(roleLink(ROLE_NAMES[role]));
    const current = await link.getAttribute('aria-current');
    const status = await link.getAttribute('data-status');
    return current === 'page' || status === 'active';
  }

  /* --------------------------------------------------------------------- *
   * Detail panel
   * --------------------------------------------------------------------- */

  isDetailTableShown(): Promise<boolean> {
    return this.isVisible(RolesSettingsIds.detailTable, Timeouts.MEDIUM);
  }

  /** The staff table header row, as text. */
  detailTableHeader(): Promise<string> {
    return this.text(RolesSettingsIds.detailTableHead, { timeout: Timeouts.MEDIUM });
  }

  async detailRowCount(): Promise<number> {
    return (await this.findAll(RolesSettingsIds.detailRows, { timeout: Timeouts.SHORT })).length;
  }

  /** The `href` of every staff link in the table, top to bottom. */
  async detailStaffHrefs(): Promise<string[]> {
    const links = await this.findAll(RolesSettingsIds.detailStaffLinks, { timeout: Timeouts.SHORT });
    const hrefs: string[] = [];
    for (const link of links) hrefs.push((await link.getAttribute('href')) ?? '');
    return hrefs;
  }

  /**
   * The text of one column for every row, by 1-based column index.
   * Columns on 1.1.56: 1 Nick Name · 2 Phone Number · 3 Staff Code.
   */
  async detailColumn(column: number): Promise<string[]> {
    const rows = await this.findAll(RolesSettingsIds.detailRows, { timeout: Timeouts.SHORT });
    const values: string[] = [];
    for (const row of rows) {
      const cells = await row.$$('td').getElements();
      const cell = cells[column - 1];
      if (!cell) {
        values.push('');
        continue;
      }
      const raw = await cell.getProperty('textContent');
      values.push((typeof raw === 'string' ? raw : '').trim());
    }
    return values;
  }

  /**
   * The detail panel's `h1` as the user sees it (`innerText`).
   * Returns `null` when no such heading is mounted at all.
   */
  async detailTitle(): Promise<string | null> {
    if (!(await this.exists(RolesSettingsIds.detailTitle, Timeouts.SHORT))) return null;
    const heading = await this.find(RolesSettingsIds.detailTitle);
    const raw = await heading.getProperty('innerText');
    return (typeof raw === 'string' ? raw : '').trim();
  }

  /* --------------------------------------------------------------------- *
   * Assign dialog — read-only interactions
   * --------------------------------------------------------------------- */

  async openAssignDialog(): Promise<this> {
    await this.click(RolesSettingsIds.assignToRoleButton);
    await this.find(RolesSettingsIds.assignDialog, { timeout: Timeouts.MEDIUM, visible: true });
    await settle();
    return this;
  }

  isAssignDialogShown(): Promise<boolean> {
    return this.isVisible(RolesSettingsIds.assignDialog, Timeouts.ANIMATION);
  }

  assignDialogTitle(): Promise<string> {
    return this.text(RolesSettingsIds.assignDialogTitle, { timeout: Timeouts.SHORT });
  }

  hasAssignSearch(): Promise<boolean> {
    return this.isVisible(RolesSettingsIds.assignSearch);
  }

  /** Is the dialog's `Assign` button pressable? Disabled until someone is ticked. */
  async isAssignEnabled(): Promise<boolean> {
    const button = await this.find(RolesSettingsIds.assignSubmit, { visible: true });
    return button.isEnabled();
  }

  /** Type into the dialog's search box and let the list filter. */
  async searchAssign(text: string): Promise<this> {
    await this.setValue(RolesSettingsIds.assignSearch, text);
    await settle(Timeouts.DEBOUNCE);
    return this;
  }

  /** Every VISIBLE staff item in the dialog, as plain data. */
  async assignItems(): Promise<AssignItem[]> {
    // Wait (briefly) for the list to mount; an empty result is a valid answer.
    await this.findAll(RolesSettingsIds.assignItems, { timeout: Timeouts.SHORT });
    const roleLabels = [...ALL_ROLE_LABELS];
    return browser.execute(function (labels: string[]): AssignItem[] {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      const dialog = dialogs.find((d) => d.getClientRects().length > 0);
      if (!dialog) return [];
      return Array.from(dialog.querySelectorAll('li'))
        .filter((li) => li.getClientRects().length > 0)
        .map((li) => {
          const box = li.querySelector('[role="checkbox"], input[type="checkbox"]');
          const img = li.querySelector('img');
          const clone = li.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('.sr-only').forEach((n) => n.remove());
          const texts: string[] = [];
          const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const t = (node.textContent ?? '').trim();
            if (t !== '') texts.push(t);
          }
          const badge = texts.find((t) => labels.includes(t)) ?? null;
          const name = texts
            .filter((t) => t !== badge)
            .join(' ')
            .trim();
          const checked =
            box !== null &&
            (box.getAttribute('aria-checked') === 'true' ||
              box.getAttribute('data-state') === 'checked' ||
              (box as HTMLInputElement).checked === true);
          return {
            name,
            badge,
            hasCheckbox: box !== null,
            checked,
            avatarAlt: img ? img.getAttribute('alt') : null,
          };
        });
    }, roleLabels);
  }

  /** Tick (or untick) the checkbox of the n-th VISIBLE item, 1-based. */
  async toggleAssignItem(index: number): Promise<this> {
    const all = await this.findAll(RolesSettingsIds.assignItems, { timeout: Timeouts.SHORT });
    const visible: WebdriverIO.Element[] = [];
    for (const item of all) if (await item.isDisplayed()) visible.push(item);
    const item = visible[index - 1];
    if (!item) {
      throw new Error(
        `${this.name}: no assign item ${String(index)} (only ${String(visible.length)} shown).`,
      );
    }
    const box = await this.find(RolesSettingsIds.assignItemCheckbox, {
      within: item,
      timeout: Timeouts.SHORT,
    });
    await box.click();
    await settle();
    return this;
  }

  /** Close the dialog with Escape — the no-write exit. */
  async closeAssignDialog(): Promise<this> {
    await browser.keys(['Escape']);
    // Visibility, not presence: closed Radix dialogs can stay mounted.
    await browser.waitUntil(async () => !(await this.isVisible(RolesSettingsIds.assignDialog, 300)), {
      timeout: Timeouts.SHORT,
      interval: 150,
      timeoutMsg: `${this.name}: the Assign dialog was still open after Escape.`,
    });
    return this;
  }
}

export default new RolesSettingsPage();
