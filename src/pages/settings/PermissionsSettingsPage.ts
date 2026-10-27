import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { Routes } from '../../constants/routes.js';
import {
  PERMISSION_DOM,
  PERMISSION_TEXT,
  PermissionsSettingsIds,
  ROLE_NAMES,
  permissionRoleHeader,
} from '../../constants/testids.settings-permissions.js';
import type { RoleKey } from '../../constants/testids.settings-roles.js';
import type { Locator } from '../../helpers/selectors.js';
import { settle } from '../../helpers/wait.js';
import { BasePage } from '../BasePage.js';

/** Column order of the four switches in every row. */
export const PERMISSION_COLUMNS: readonly RoleKey[] = ['owner', 'manager', 'partner', 'staff'];

/** One permission row as rendered: its label and its four switches. */
export interface PermissionRow {
  name: string;
  /** Per column (Owner, Manager, Partner, Staff): `aria-checked="true"`. */
  checked: boolean[];
  /** Per column: the switch is disabled. */
  disabled: boolean[];
}

/** What a role's column header carries. */
export interface RoleHeaderState {
  /** Is the role's name shown in the header? */
  shown: boolean;
  /** The Select All / Unselect All button label under it, or `null` when it has none. */
  button: string | null;
}

/**
 * `/settings/permissions` — the permission × role matrix.
 *
 * ## Every click is a live write
 *
 * There is no Save: flipping a switch (or Select All / Unselect All) mutates the
 * role on the server at once, and the roles are the merchant's real, fixed four.
 * This page object therefore exposes NO method that flips a switch or presses a
 * Select All — the specs only read the matrix and drive Expand/Collapse All,
 * which is view state. The TCs that need a write are PENDING in the spec.
 *
 * ## Reading the matrix
 *
 * The switches have no id, testid or name. {@link readMatrix} walks them in one
 * `browser.execute`: a row is the nearest ancestor of a switch holding exactly
 * four switches and some text, and its label is that row's `p` (sr-only
 * "Toggle" text stripped). Only rows with a rendered box count — collapsed
 * children are not part of the visible tree.
 */
export class PermissionsSettingsPage extends BasePage {
  readonly name = 'Settings — Permissions';

  readonly route: string = Routes.SETTINGS_PERMISSIONS;

  /** The switches only render once the role/permission query returned. */
  protected readonly readyAnchor: Locator = PermissionsSettingsIds.switches;

  /* --------------------------------------------------------------------- *
   * Header
   * --------------------------------------------------------------------- */

  /** Is the title shown as an `h1`? */
  isLevelOneHeadingShown(): Promise<boolean> {
    return this.isVisible(PermissionsSettingsIds.heading);
  }

  isAccessHeaderShown(): Promise<boolean> {
    return this.isVisible(PermissionsSettingsIds.accessHeader);
  }

  isRoleHeaderShown(role: RoleKey): Promise<boolean> {
    return this.isVisible(permissionRoleHeader(ROLE_NAMES[role]));
  }

  /**
   * Each role's header: is its name shown, and which button (if any) sits under
   * it. Walks up from the role's label at most three levels, stopping before a
   * container that also holds ANOTHER role's name — so the Owner column cannot
   * borrow the Manager column's button.
   */
  async roleHeaders(): Promise<Record<RoleKey, RoleHeaderState>> {
    const groups = PERMISSION_COLUMNS.map((key) => [...ROLE_NAMES[key]]);
    const states = await browser.execute(
      function (
        roleGroups: string[][],
        buttonSelector: string,
      ): Array<{ shown: boolean; button: string | null }> {
        const all = roleGroups.flat();
        const leaves = Array.from(document.querySelectorAll('body *')).filter(
          (el) => el.children.length === 0 && el.closest('a') === null && el.getClientRects().length > 0,
        );
        return roleGroups.map((names) => {
          const leaf = leaves.find((el) => names.includes((el.textContent ?? '').trim()));
          if (!leaf) return { shown: false, button: null };
          let cell: Element | null = leaf.parentElement;
          for (let depth = 0; depth < 3 && cell; depth += 1) {
            const text = (cell.textContent ?? '').trim();
            const others = all.filter((n) => !names.includes(n));
            if (others.some((n) => text.includes(n))) break;
            const button = cell.querySelector(buttonSelector);
            if (button) return { shown: true, button: (button.textContent ?? '').trim() };
            cell = cell.parentElement;
          }
          return { shown: true, button: null };
        });
      },
      groups,
      PERMISSION_DOM.button,
    );
    const result = {} as Record<RoleKey, RoleHeaderState>;
    PERMISSION_COLUMNS.forEach((key, i) => {
      result[key] = states[i] ?? { shown: false, button: null };
    });
    return result;
  }

  /* --------------------------------------------------------------------- *
   * Expand / collapse — view state only, never persisted
   * --------------------------------------------------------------------- */

  /** The Expand All ⇄ Collapse All button's current label. */
  expandToggleLabel(): Promise<string> {
    return this.text(PermissionsSettingsIds.expandToggle, { timeout: Timeouts.MEDIUM });
  }

  async isExpanded(): Promise<boolean> {
    const label = await this.expandToggleLabel();
    return (PERMISSION_TEXT.collapseAll as readonly string[]).includes(label);
  }

  async expandAll(): Promise<this> {
    if (!(await this.isExpanded())) {
      await this.click(PermissionsSettingsIds.expandToggle);
      await settle();
    }
    return this;
  }

  async collapseAll(): Promise<this> {
    if (await this.isExpanded()) {
      await this.click(PermissionsSettingsIds.expandToggle);
      await settle();
    }
    return this;
  }

  /* --------------------------------------------------------------------- *
   * Matrix — read-only
   * --------------------------------------------------------------------- */

  /** Every VISIBLE permission row, top to bottom. */
  async readMatrix(): Promise<PermissionRow[]> {
    await this.find(PermissionsSettingsIds.switches, { timeout: Timeouts.MEDIUM });
    return browser.execute(function (dom: {
      switch: string;
      label: string;
      srOnly: string;
    }): PermissionRow[] {
      const clean = (el: Element): string => {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(dom.srOnly).forEach((n) => n.remove());
        return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
      };
      const rows = new Map<Element, Element[]>();
      for (const sw of Array.from(document.querySelectorAll(dom.switch))) {
        if (sw.getClientRects().length === 0) continue;
        let row: Element | null = sw.parentElement;
        while (row && row !== document.body) {
          const count = row.querySelectorAll(dom.switch).length;
          if (count > 4) {
            row = null;
            break;
          }
          if (count === 4 && clean(row) !== '') break;
          row = row.parentElement;
        }
        if (!row || row === document.body) continue;
        const list = rows.get(row) ?? [];
        list.push(sw);
        rows.set(row, list);
      }
      return Array.from(rows.entries()).map(([row, switches]) => {
        const label = row.querySelector(dom.label);
        return {
          name: label ? clean(label) : clean(row),
          checked: switches.map((s) => s.getAttribute('aria-checked') === 'true'),
          disabled: switches.map(
            (s) =>
              s.hasAttribute('disabled') ||
              s.getAttribute('aria-disabled') === 'true' ||
              s.hasAttribute('data-disabled'),
          ),
        };
      });
    }, PERMISSION_DOM);
  }

  /** How many `[role="switch"]` are currently rendered and visible. */
  async visibleSwitchCount(): Promise<number> {
    const switches = await this.findAll(PermissionsSettingsIds.switches, { timeout: Timeouts.SHORT });
    let visible = 0;
    for (const sw of switches) if (await sw.isDisplayed()) visible += 1;
    return visible;
  }

  /**
   * Labels of every button inside the permission table (switches excluded) —
   * Expand/Collapse All, the Select All buttons and the group "Toggle"s.
   */
  async tableButtonLabels(): Promise<string[]> {
    const toggleLabels = [...PERMISSION_TEXT.expandAll, ...PERMISSION_TEXT.collapseAll];
    return browser.execute(
      function (dom: { switch: string; button: string }, labels: string[]): string[] {
        const norm = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        const toggle = Array.from(document.querySelectorAll(dom.button)).find((b) =>
          labels.includes(norm(b)),
        );
        if (!toggle) return [];
        // The table = the nearest ancestor of the Expand/Collapse toggle that also holds switches.
        let table: Element | null = toggle.parentElement;
        while (table && table !== document.body && table.querySelector(dom.switch) === null) {
          table = table.parentElement;
        }
        if (!table) return [];
        return Array.from(table.querySelectorAll(dom.button)).map(norm);
      },
      PERMISSION_DOM,
      toggleLabels,
    );
  }

  /** Is a Save / Apply button anywhere on screen? Expected: no. */
  hasSaveOrApply(): Promise<boolean> {
    return this.isVisible(PermissionsSettingsIds.saveOrApply, Timeouts.ANIMATION);
  }
}

export default new PermissionsSettingsPage();
