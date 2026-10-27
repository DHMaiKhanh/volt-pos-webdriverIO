/**
 * VP-2465 — More characters for service names on the Create Order screen.
 *
 * Source: volt-qc `VP-2465-service-name-display-test-cases.md` (TC 1–10).
 *
 * Driven on the merchant's real catalogue rather than seeded services: the
 * cards are measured in the browser (`homePage.serviceCardLayouts()`), and each
 * case picks the cards that fit its class — short (1 line, not clamped),
 * 2-line (not clamped) and long (clamped). A class the catalogue happens not to
 * contain is reported as a skip, not a pass.
 *
 * TC-08 (Vietnamese diacritics) and TC-09 (other screen sizes / orientation)
 * need fixture services / a resized window and stay pending.
 *
 * Read-only except TC-10, which adds two lines to a draft and voids it.
 */

import { expect } from '@wdio/globals';
import { returnToHome } from '../../../src/flows/index.js';
import { homePage } from '../../../src/pages/index.js';
import type { ServiceCardLayout } from '../../../src/pages/pos/HomePage.js';
import { Tag, title } from '../../../src/types/testTags.js';

let cards: ServiceCardLayout[] = [];

const short = (): ServiceCardLayout[] => cards.filter((c) => !c.truncated && c.visibleLines <= 1);
const twoLine = (): ServiceCardLayout[] => cards.filter((c) => !c.truncated && c.visibleLines === 2);
const long = (): ServiceCardLayout[] => cards.filter((c) => c.truncated);

async function voidAnyDraft(): Promise<void> {
  await returnToHome();
  await homePage.waitForReady();
  if (await homePage.hasActiveDraft()) await homePage.deleteOrder();
}

/** Fail with the offending card names, not just "expected true". */
const names = (list: ServiceCardLayout[]): string => list.map((c) => `"${c.name}"`).join(', ');

describe('VP-2465 — Service name display on Create Order', () => {
  before(async () => {
    await voidAnyDraft();
    cards = await homePage.serviceCardLayouts();
  });

  after(voidAnyDraft);

  it(
    title('TC-01 A short name shows in full, without "..."', Tag.REGRESSION),
    function (this: Mocha.Context) {
      if (short().length === 0) this.skip();
      const withEllipsis = short().filter((c) => c.ellipsisVisible);
      expect(names(withEllipsis)).toBe('');
      for (const c of short()) expect(c.price).toMatch(/^\$[\d,]+\.\d{2}$/);
    },
  );

  it(
    title('TC-02 A 2-line name shows in full on 2 lines, without "..."', Tag.REGRESSION),
    function (this: Mocha.Context) {
      if (twoLine().length === 0) this.skip();
      const withEllipsis = twoLine().filter((c) => c.ellipsisVisible);
      expect(names(withEllipsis)).toBe('');
    },
  );

  it(
    title('TC-03 A long name is clamped to 2 lines with "..." on line 3', Tag.REGRESSION),
    function (this: Mocha.Context) {
      if (long().length === 0) this.skip();
      for (const c of long()) {
        expect(c.visibleLines).toBe(2);
        expect(c.ellipsisVisible).toBe(true);
        expect(c.price).toMatch(/^\$[\d,]+\.\d{2}$/);
      }
    },
  );

  it(title('TC-04 Clamping starts around 28 characters', Tag.REGRESSION), function (this: Mocha.Context) {
    if (cards.length === 0) this.skip();
    // Line-clamp is pixel-based, so allow word-wrap slack: nothing ≤ 20 chars is
    // clamped, and anything ≥ 40 chars always is.
    expect(names(cards.filter((c) => c.name.length <= 20 && c.truncated))).toBe('');
    expect(names(cards.filter((c) => c.name.length >= 40 && !c.truncated))).toBe('');
  });

  it(title('TC-05 The name never overlaps the price', Tag.REGRESSION), () => {
    expect(cards.length).toBeGreaterThan(0);
    expect(names(cards.filter((c) => c.overlapsPrice))).toBe('');
  });

  it(title('TC-06 Every card keeps the same height', Tag.REGRESSION), () => {
    const heights = new Set(cards.map((c) => c.cardHeight));
    expect([...heights]).toHaveLength(1);
  });

  it(title('TC-07 The rule applies consistently across the list', Tag.REGRESSION), () => {
    // "..." visible exactly when the name is clamped, and never more than 2 text lines.
    const inconsistent = cards.filter((c) => c.ellipsisVisible !== c.truncated || c.visibleLines > 2);
    expect(names(inconsistent)).toBe('');
  });

  it(title('TC-08: Vietnamese / special-character names — PENDING (needs a fixture service)'));

  it(title('TC-09: other screen sizes / orientation — PENDING (fixed-size till window)'));

  it(
    title('TC-10 Tapping a clamped and a short card still adds both to the order', Tag.REGRESSION, Tag.WRITE),
    async function (this: Mocha.Context): Promise<void> {
      const target = [long()[0], short()[0] ?? twoLine()[0]].filter((c): c is ServiceCardLayout => !!c);
      if (target.length < 2) this.skip();

      await voidAnyDraft();
      await homePage.selectFirstStaff();
      const before = (await homePage.cartTotals()).subtotal;
      for (const c of target) await homePage.addServiceByName(c.name);

      const after = (await homePage.cartTotals()).subtotal;
      expect(after).toBeGreaterThan(before);
      expect(await homePage.hasActiveDraft()).toBe(true);
    },
  );
});
