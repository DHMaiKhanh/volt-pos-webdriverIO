/**
 * VP-4815 helpers — passcode gates for Quick Checkout / Quick Pay / Sell Gift
 * Card / Edit Service Price / Calendar, and the Customer Status badge.
 *
 * NOT a spec. Holds the test data, the gate snapshot/apply plumbing, the
 * "start from an empty cart" setup and the GraphQL oracle for `v_customer_type`.
 *
 * Staff codes come from env with merchant #14 defaults (dev only):
 *   VP4815_OWNER_CODE    — Owner   (8888, Merri 1)
 *   VP4815_MANAGER_CODE  — Manager (9876, Aubrey Shepard)
 *   VP4815_STAFF_CODE    — Staff   (5559, Pamela)        — holds none of the 5 permissions
 *   VP4815_PARTNER_CODE  — Partner (7775, Ramona Dunn)   — holds `quick_pay` only
 * Customers:
 *   VP4815_VIP_PHONE         — a VIP customer (2052051122, Tuti)
 *   VP4815_SEARCH_NAME       — a name prefix whose matches mix statuses ("QC Srch")
 *   VP4815_AT_RISK_NAME      — an At Risk customer ("UNKNOWN5560")
 *   VP4815_HISTORY_CUSTOMER  — a customer with a paid order in Order History ("QC Srch Ckhogz")
 */

import { browser } from '@wdio/globals';
import { Timeouts } from '../../../configs/constants/timeouts.js';
import { env } from '../../../configs/env/loadEnv.js';
import { gql } from '../../../src/api/index.js';
import { passcodeDialog } from '../../../src/components/index.js';
import { CUSTOMER_TYPE_LABELS, type CustomerType } from '../../../src/constants/testids.vp-4815.js';
import { goToSettings, returnToHome } from '../../../src/flows/index.js';
import { settle } from '../../../src/helpers/wait.js';
import {
  accessibilitySettingsPage,
  homePage,
  orderPendingPage,
  settingsPage,
} from '../../../src/pages/index.js';
import type { PasscodeGate } from '../../../src/pages/index.js';
import { voltQcProbe as P } from '../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { clearPasscodeGrant } from '../../../src/support/passcodeGrant.js';

const code = (v: string | undefined, fallback: string): string => (v ?? '').replace(/\D/g, '') || fallback;

export const vp4815 = {
  owner: code(process.env.VP4815_OWNER_CODE, env.STAFF_PASSCODE || '8888'),
  manager: code(process.env.VP4815_MANAGER_CODE, '9876'),
  staff: code(process.env.VP4815_STAFF_CODE, '5559'),
  partner: code(process.env.VP4815_PARTNER_CODE, '7775'),
  vipPhone: code(process.env.VP4815_VIP_PHONE, '2052051122'),
  searchName: process.env.VP4815_SEARCH_NAME?.trim() || 'QC Srch',
  atRiskName: process.env.VP4815_AT_RISK_NAME?.trim() || 'UNKNOWN5560',
  historyCustomer: process.env.VP4815_HISTORY_CUSTOMER?.trim() || 'QC Srch Ckhogz',
} as const;

/** The five gates this ticket wires on the POS. */
export const VP4815_GATES = [
  'quick_checkout',
  'quick_pay',
  'gift_card_sale',
  'edit_service_price',
  'calendar',
] as const satisfies readonly PasscodeGate[];

export type Vp4815Gate = (typeof VP4815_GATES)[number];

export const ALL_ON: Record<Vp4815Gate, boolean> = {
  quick_checkout: true,
  quick_pay: true,
  gift_card_sale: true,
  edit_service_price: true,
  calendar: true,
};

export const ALL_OFF: Record<Vp4815Gate, boolean> = {
  quick_checkout: false,
  quick_pay: false,
  gift_card_sale: false,
  edit_service_price: false,
  calendar: false,
};

/** en / vi "You don't have permission…" (action + page variants). */
export const NO_PERMISSION_RE = /don.t have permission|không có quyền/i;

/* ----------------------------------------------------------------------- *
 * Gates
 * ----------------------------------------------------------------------- */

export async function openAccessibility(): Promise<void> {
  await goToSettings();
  await settingsPage.openSection('ACCESSIBILITY');
  await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
}

/** Apply gate positions, save, leave settings and drop the 30-minute grant. */
export async function setGates(state: Partial<Record<PasscodeGate, boolean>>): Promise<void> {
  await openAccessibility();
  await accessibilitySettingsPage.applyGates(state);
  await returnToHome();
  await clearPasscodeGrant();
}

/** The merchant's stored `merchant_passcode_settings`, flattened to leaf → bool. */
export async function storedGates(): Promise<Record<string, boolean>> {
  const data = await gql().query<{ sysSettingList: { value: string }[] }>(
    'query vp4815Gates { sysSettingList(where:{key:{eq:"merchant_passcode_settings"}}){ value } }',
    { operationName: 'vp4815Gates' },
  );
  const raw = data.sysSettingList[0]?.value ?? '{}';
  const tree = JSON.parse(raw) as Record<string, Record<string, boolean>>;
  const flat: Record<string, boolean> = {};
  for (const group of Object.values(tree)) Object.assign(flat, group);
  return flat;
}

/* ----------------------------------------------------------------------- *
 * Till state
 * ----------------------------------------------------------------------- */

/**
 * Land on /home with NO order open and no live grant.
 *
 * Quick Checkout only clears the cart (VP-4815 review F9 — it is not gated), so
 * it is the cheap way out of whatever order the last case left selected.
 */
export async function startEmptyCart(): Promise<void> {
  await returnToHome();
  await clearPasscodeGrant();
  if (await homePage.hasActiveDraft()) {
    await orderPendingPage.pressQuickCheckout();
    await browser.waitUntil(async () => !(await homePage.hasActiveDraft(Timeouts.ANIMATION)), {
      timeout: Timeouts.MEDIUM,
      timeoutMsg: 'Quick Checkout did not clear the order panel',
    });
  }
  await clearPasscodeGrant();
}

/**
 * A staff tile whose staff has NO pending order.
 *
 * Tapping a staff who already has one re-opens that order instead of starting a
 * sale, which would skip the gate for the wrong reason. Reads the tiles and the
 * Pending Orders column off the screen.
 */
export async function freeStaffId(): Promise<string> {
  const id = await browser.execute(function () {
    const qc = Array.prototype.find.call(document.querySelectorAll('button'), function (b: HTMLElement) {
      return String(b.innerText || '').trim() === 'Quick Checkout';
    }) as HTMLElement | undefined;
    let col: HTMLElement | null = qc ?? null;
    while (col && !/OD\d{6}-\d+/.test(col.innerText || '')) col = col.parentElement;
    const busy = col ? String(col.innerText) : '';
    const tiles = document.querySelectorAll('[data-testid^="staff-tile-"]');
    for (let i = 0; i < tiles.length; i += 1) {
      const t = tiles[i] as HTMLElement;
      const name = String(t.innerText || '')
        .split('\n')[0]!
        .trim();
      if (name && busy.indexOf(name) === -1) {
        return String(t.getAttribute('data-testid')).replace('staff-tile-', '');
      }
    }
    return '';
  });
  if (typeof id !== 'string' || id === '') {
    throw new Error('VP-4815: every visible staff tile has a pending order; free one up before running');
  }
  return id;
}

/** Delete the order this spec created (Remove is gated too — unlocked with the Owner code). */
export async function discardCreatedOrder(): Promise<void> {
  await returnToHome();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
  // deleteOrder() ticks "skip for 30 minutes" on the Delete guard; a live grant
  // would hide every gate the next case probes.
  await clearPasscodeGrant();
}

/** Answer a guard that is up with the Owner code, if any (cleanup only). */
export async function unlockIfPrompted(): Promise<void> {
  if (await passcodeDialog.isPrompting(Timeouts.ANIMATION)) await passcodeDialog.enter(vp4815.owner);
}

/* ----------------------------------------------------------------------- *
 * Customer Status oracle
 * ----------------------------------------------------------------------- */

interface CustomerRow {
  id: string;
  name: string | null;
  phone: string | null;
}

export async function customersWhere(where: Record<string, unknown>, limit = 200): Promise<CustomerRow[]> {
  const data = await gql().query<{ customerList: CustomerRow[] }>(
    'query vp4815Customers($w:CustomerComparisonExp, $l:Int){ customerList(where:$w, limit:$l){ id name phone } }',
    { operationName: 'vp4815Customers', variables: { w: where, l: limit } },
  );
  return data.customerList;
}

/** Customers whose name contains `text` (case-insensitive), filtered client-side. */
export async function customersNamed(text: string): Promise<CustomerRow[]> {
  const needle = text.toLowerCase();
  return (await customersWhere({}, 10_000)).filter((c) => (c.name ?? '').toLowerCase().includes(needle));
}

/** `v_customer_type.type` per customer id (missing id = no row = no badge). */
export async function customerTypes(ids: readonly string[]): Promise<Record<string, CustomerType>> {
  if (ids.length === 0) return {};
  const data = await gql().query<{ vCustomerTypeList: { customerId: string; type: string }[] }>(
    'query vp4815Types($w:VCustomerTypeComparisonExp){ vCustomerTypeList(where:$w){ customerId type } }',
    { operationName: 'vp4815Types', variables: { w: { customerId: { in: [...ids] } } } },
  );
  const out: Record<string, CustomerType> = {};
  for (const r of data.vCustomerTypeList) out[r.customerId] = r.type as CustomerType;
  return out;
}

/** The badge label a type should render, or null for none (`normal` / unknown). */
export function expectedLabel(type: CustomerType | undefined): string | null {
  if (!type || type === 'normal') return null;
  return CUSTOMER_TYPE_LABELS[type]?.[0] ?? null;
}

/** Status badge texts currently on screen (header DEV badge excluded), optionally inside `scopeText`'s dialog. */
export async function visibleStatusBadges(dialogText?: string): Promise<string[]> {
  const known = Object.values(CUSTOMER_TYPE_LABELS).flat();
  const texts = await browser.execute(
    function (scope: string | null, labels: string[]) {
      let root: ParentNode = document;
      if (scope) {
        const dialogs = Array.prototype.filter.call(
          document.querySelectorAll('[role="dialog"]'),
          function (d: HTMLElement) {
            return String(d.innerText || '').indexOf(scope) !== -1;
          },
        ) as HTMLElement[];
        const last = dialogs[dialogs.length - 1];
        if (!last) return [];
        root = last;
      }
      return Array.prototype.map
        .call(root.querySelectorAll('[data-slot="badge"]'), function (b: HTMLElement) {
          if (b.closest('[data-testid="env-badge"]')) return '';
          const r = b.getBoundingClientRect();
          return r.width > 0 ? String(b.innerText || '').trim() : '';
        })
        .filter(function (t: unknown) {
          return labels.indexOf(String(t)) !== -1;
        }) as string[];
    },
    dialogText ?? null,
    known,
  );
  return Array.isArray(texts) ? texts : [];
}

export interface SearchRow {
  /** Masked phone, e.g. `***-***-6079`. */
  phone: string;
  name: string;
  badge: string | null;
}

/** The "Customers Found" rows (scrolled through) with their badge. */
export async function customersFoundRows(): Promise<SearchRow[]> {
  await settle(Timeouts.DEBOUNCE);
  const known = Object.values(CUSTOMER_TYPE_LABELS).flat();
  const rows = await browser.execute(function (labels: string[]) {
    return Array.prototype.map.call(
      document.querySelectorAll('div[class*="active:bg-accent"]'),
      function (r: HTMLElement) {
        const badgeEl = r.querySelector<HTMLElement>('[data-slot="badge"]');
        const badge = badgeEl ? String(badgeEl.innerText || '').trim() : '';
        const parts = String(r.innerText || '')
          .split('\n')
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean);
        const phone =
          parts.find(function (p) {
            return /\*\*\*-\*\*\*-\d{4}/.test(p);
          }) || '';
        const name =
          parts.filter(function (p) {
            return p !== phone && p !== badge && p.indexOf('@') === -1;
          })[0] || '';
        return { phone: phone, name: name, badge: labels.indexOf(badge) !== -1 ? badge : null };
      },
    );
  }, known);
  return Array.isArray(rows) ? (rows as SearchRow[]) : [];
}

/* ----------------------------------------------------------------------- *
 * Scanner → Add Funds (TC-07)
 * ----------------------------------------------------------------------- */

/**
 * An active gift card the Scanner can resolve.
 *
 * The Scanner looks the code up REMOTELY (`giftCardQueryByCode`), not in the
 * local `giftCardList`, so a code is only usable once that lookup returns an
 * id. `VP4815_GIFT_CARD` pins one; otherwise the first local active card the
 * remote lookup knows is taken. `''` when none resolves.
 */
export async function scannerGiftCard(): Promise<string> {
  const pinned = (process.env.VP4815_GIFT_CARD ?? '').replace(/\D/g, '');
  const local = await gql().query<{ giftCardList: { code: string }[] }>(
    'query vp4815Cards { giftCardList(where:{status:{eq:"active"}}, limit:10){ code } }',
    { operationName: 'vp4815Cards' },
  );
  const candidates = pinned ? [pinned] : local.giftCardList.map((c) => c.code);
  for (const code of candidates) {
    const remote = await gql()
      .query<{ giftCardQueryByCode: { id: string | null } | null }>(
        'query vp4815Remote($code:String!){ giftCardQueryByCode(code:$code){ id } }',
        { operationName: 'vp4815Remote', variables: { code } },
      )
      .catch(() => null);
    if (remote?.giftCardQueryByCode?.id) return code;
  }
  return '';
}

/**
 * Header Scanner → Input Gift Card Code → Confirm → Gift card history →
 * Add Funds. Stops at the Add Funds press: with the gates on, the Quick
 * Checkout guard comes up next.
 */
export async function openScannerAddFunds(code: string): Promise<void> {
  await P.clickQ({ text: 'Scanner', nth: 0 });
  await P.clickQ({ role: 'button', name: 'Input Gift Card Code', nth: 0 });
  await settle(Timeouts.ANIMATION);
  await browser.keys(code.split(''));
  await P.clickQ([
    { role: 'dialog', hasText: 'Enter Gift Card Code', nth: -1 },
    { role: 'button', name: 'Confirm', nth: 0 },
  ]);
  await P.clickQ({ role: 'button', name: 'Gift card history', nth: 0 }, Timeouts.MEDIUM);
  await P.clickQ({ role: 'button', name: 'Add Funds', nth: 0 }, Timeouts.MEDIUM);
}
