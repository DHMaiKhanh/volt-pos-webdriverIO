import { Timeouts } from '../../../../configs/constants/timeouts.js';
import {
  VqcGlobalSearch,
  VqcHome,
  inTopDialog,
  type VqcQuery,
} from '../../../constants/testids.voltqc-pos.js';
import { settle } from '../../../helpers/wait.js';
import { voltQcProbe as P } from './VoltQcProbe.js';

/**
 * Home-screen reads/actions for the volt-qc 02-home port
 * (volt-qc `src/flows/home.ts`). Read-only: nothing here selects a staff or
 * adds a line, so the till never gets a draft order from these helpers.
 */

export interface CategoryTile {
  name: string;
  sub: string;
  selected: boolean;
  slide: number;
}

export interface ServiceTile {
  name: string;
  price: string;
}

/**
 * Pending sidebar → Quick Checkout, until the till shows an EMPTY order frame
 * (customer field up, no `#OD…` header) for 400 ms straight. The app can bounce
 * back to the order bound to this device right after the click — hence the
 * stability window and the retry (volt-qc `App.quickCheckout`).
 */
export async function quickCheckout(): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await P.clickQ(VqcHome.quickCheckout);
    const deadline = Date.now() + 3_000;
    let emptySince = 0;
    while (Date.now() < deadline) {
      const hasOrder = await P.has(VqcHome.orderHeading);
      const empty = !hasOrder && (await P.has(VqcHome.customerInput));
      if (!empty) emptySince = 0;
      else if (!emptySince) emptySince = Date.now();
      else if (Date.now() - emptySince >= 400) return;
      await settle(80);
    }
  }
  throw new Error('Quick Checkout never produced an empty order frame (an "#OD…" header kept showing).');
}

/** Category tiles of the service carousel, in DOM order. */
export async function categoryTiles(): Promise<CategoryTile[]> {
  return P.exec<CategoryTile[]>(`
    var section = Array.prototype.find.call(document.querySelectorAll('main section'), function (s) {
      return !!s.querySelector('input[placeholder="Search service"]');
    });
    if (!section) return [];
    var slides = Array.prototype.slice.call(section.querySelectorAll('[aria-roledescription="slide"]'));
    return Array.prototype.map.call(section.querySelectorAll('h3'), function (h) {
      var tile = h.parentElement;
      var cls = ' ' + tile.className + ' ';
      var p = tile.querySelector('p');
      return {
        name: (h.textContent || '').trim(),
        sub: p ? (p.textContent || '').trim() : '',
        selected: / outline-4 /.test(cls),
        slide: slides.findIndex(function (s) { return s.contains(tile); })
      };
    });
  `);
}

/** Click the n-th category heading (by position: a category may be NAMED "Gift Card"). */
export async function clickCategoryAt(index: number): Promise<void> {
  await P.clickQ([
    { css: 'main section', hasCss: 'input[placeholder="Search service"]' },
    { css: 'h3', nth: index },
  ]);
  await settle(600);
}

/** Name + price of every rendered service tile (`li` with `span.block`). */
export async function serviceTiles(): Promise<ServiceTile[]> {
  return P.exec<ServiceTile[]>(`
    return Array.prototype.filter.call(document.querySelectorAll('main li'), function (li) {
      return !!li.querySelector('span.block');
    }).map(function (li) {
      var n = li.querySelector('span.block');
      var p = li.querySelector('div.text-right');
      return { name: n ? (n.textContent || '').trim() : '', price: p ? (p.textContent || '').trim() : '' };
    });
  `);
}

/** Nicknames on the rendered staff cards (the grid is virtualised). */
export async function visibleStaffNames(): Promise<string[]> {
  return (await P.texts({ css: VqcHome.staffNameCss })).filter(Boolean);
}

/** Open the staff "Sort by" popover (the last button beside the staff search's input group). */
export async function openStaffSort(): Promise<void> {
  await P.exec<null>(`
    var input = document.querySelector('main input[placeholder="Search staff"]');
    var group = input && input.closest('[data-slot="input-group"]');
    var host = group && group.parentElement;
    var buttons = host ? host.querySelectorAll('button') : [];
    var b = buttons[buttons.length - 1];
    if (b) b.setAttribute('data-vqc-sort', '1');
    return null;
  `);
  await P.clickQ({ css: '[data-vqc-sort="1"]' });
  await P.waitFor(VqcHome.sortPopover, Timeouts.SHORT, 'Sort by popover');
}

/** Press a key on the centre customer keypad; `<` is the backspace key right after `0`. */
export async function customerKeys(keys: string): Promise<void> {
  for (const k of keys) {
    if (k === '<') {
      await P.exec<null>(`
        var zero = Array.prototype.find.call(document.querySelectorAll('main button'), function (b) {
          return (b.textContent || '').trim() === '0' && b.getClientRects().length > 0;
        });
        var next = zero && zero.nextElementSibling;
        if (next) next.setAttribute('data-vqc-bksp', '1');
        return null;
      `);
      await P.clickQ({ css: '[data-vqc-bksp="1"]' });
    } else {
      await P.clickQ(VqcHome.keypadKey(k));
    }
  }
  await settle(150);
}

/** Header "Search..." → the global search dialog. */
export async function openGlobalSearch(): Promise<void> {
  await P.clickQ([{ css: 'header' }, { css: 'input', placeholder: 'Search...' }]);
  await P.waitFor(VqcGlobalSearch.dialog, Timeouts.SHORT, 'global search dialog');
}

export const globalSearchBox: readonly VqcQuery[] = [
  VqcGlobalSearch.dialog,
  { css: 'input', placeholder: VqcGlobalSearch.placeholder },
];

export const globalSearchTab = (nameRe: string): readonly VqcQuery[] => [
  VqcGlobalSearch.dialog,
  { role: 'tab', nameRe },
];

export async function closeGlobalSearch(): Promise<void> {
  if (!(await P.has(VqcGlobalSearch.dialog))) return;
  await P.clickQ(inTopDialog({ role: 'button', name: 'Close', nth: 0 }));
  await P.waitGoneQ(VqcGlobalSearch.dialog, Timeouts.SHORT, 'global search dialog');
}

/** Show/Hide state of a Home accordion header ("Checkin Today (n) Show"). */
export async function accordionOpen(chain: readonly VqcQuery[]): Promise<boolean> {
  return /Hide/.test(await P.textOf(chain));
}
