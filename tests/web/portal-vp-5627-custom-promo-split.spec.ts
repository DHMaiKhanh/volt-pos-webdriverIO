import { browser, $, expect } from '@wdio/globals';
import { portalSettingsPage } from '../../src/pages/web/PortalSettingsPage.js';
import { settle } from '../../src/helpers/wait.js';
import { Tag, title } from '../../src/types/testTags.js';

/**
 * Fastboy Portal half of VP-5627 (default owner/staff split for Custom promotion).
 * Store Settings → Payment & transactions → Discount setting.
 *
 * Reads the Available / Custom split as the Portal renders it, logs it as
 * `VP5627 portal split = {...}` and screenshots the card. With
 * `VP5627_SET_CUSTOM=<owner>/<staff>` it also types that Custom split and saves.
 *
 * Runs in Edge on the signed-in `.portal-profile/`: `npm run portal:vp-5627`.
 */
const SHOT_DIR = '.playwright-mcp/VP-5627';
const setTo = process.env.VP5627_SET_CUSTOM?.trim();
const shotName = process.env.VP5627_SHOT?.trim() || 'portal-discount-setting';

interface Split {
  availableOwner: string;
  availableStaff: string;
  customOwner: string;
  customStaff: string;
}

/** The two number inputs under the section whose heading reads `heading`. */
async function sectionInputs(heading: string): Promise<string[]> {
  return browser.execute((h: string) => {
    const label = Array.from(document.querySelectorAll('body *')).find(
      (el) => el.children.length === 0 && el.textContent?.trim() === h,
    );
    let box: Element | null | undefined = label;
    while (box && box.querySelectorAll('input').length < 2) box = box.parentElement;
    return Array.from(box?.querySelectorAll('input') ?? [])
      .slice(0, 2)
      .map((i) => i.value);
  }, heading);
}

async function readSplit(): Promise<Split> {
  const [availableOwner = '', availableStaff = ''] = await sectionInputs('Available promotions');
  const [customOwner = '', customStaff = ''] = await sectionInputs('Custom promotion');
  return { availableOwner, availableStaff, customOwner, customStaff };
}

async function scrollToCard(): Promise<void> {
  await browser.execute(() => {
    const el = Array.from(document.querySelectorAll('body *')).find(
      (e) => e.children.length === 0 && e.textContent?.trim() === 'Custom promotion',
    );
    el?.scrollIntoView({ block: 'center' });
  });
}

/** Leaf text present anywhere on the page. */
async function hasText(t: string): Promise<boolean> {
  return browser.execute(
    (s: string) =>
      Array.from(document.querySelectorAll('body *')).some(
        (e) => e.children.length === 0 && e.textContent?.trim() === s,
      ),
    t,
  );
}

async function openCard(): Promise<void> {
  await portalSettingsPage.open();
  await browser.waitUntil(async () => (await readSplit()).customOwner !== '', {
    timeout: 20_000,
    timeoutMsg: 'VP-5627: Custom promotion inputs did not render on the Portal.',
  });
  await settle(1500);
}

describe('Portal — VP-5627 custom promotion split', () => {
  it(
    title('Portal: Discount setting card has the new subtitle + 2 sections (TC-VP5627-01)', Tag.REGRESSION),
    async () => {
      await openCard();
      expect(await hasText('Split of a promotion discount between the owner and the staff.')).toBe(true);
      expect(await hasText('Available promotions')).toBe(true);
      expect(await hasText('Custom promotion')).toBe(true);
      const s = await readSplit();
      expect(Number(s.availableOwner) + Number(s.availableStaff)).toBe(100);
      expect(Number(s.customOwner) + Number(s.customStaff)).toBe(100);
    },
  );

  it(
    title('Portal: untouched Custom shows 100/0, not the Available split (TC-VP5627-02)', Tag.REGRESSION),
    async function () {
      // Only meaningful on a store whose Custom split was never changed (VP5627_EXPECT_DEFAULT=1).
      if (process.env.VP5627_EXPECT_DEFAULT !== '1') this.skip();
      await openCard();
      const s = await readSplit();
      expect([s.customOwner, s.customStaff]).toEqual(['100', '0']);
    },
  );

  it.skip(title('Portal: total other than 100 is not saved (TC-VP5627-03)', Tag.REGRESSION), () => undefined); // PENDING: validation steps not coded; manual PASS 05/11.
  it.skip(
    title('Portal: value outside 0–100 shows an error (TC-VP5627-04)', Tag.REGRESSION),
    () => undefined,
  ); // PENDING: manual PASS 05/11.
  it.skip(
    title('Portal: 0/100 and 33.5/66.5 save and reload (TC-VP5627-05)', Tag.REGRESSION),
    () => undefined,
  ); // PENDING: manual PASS 05/11.
  it.skip(
    title('Portal: Discard returns to the saved value (TC-VP5627-07)', Tag.REGRESSION),
    () => undefined,
  ); // PENDING: manual PASS 05/11.

  it(title('Portal: save the Custom split and reload (TC-VP5627-06)', Tag.REGRESSION), async () => {
    await openCard();
    const before = await readSplit();
    console.warn(`VP5627 portal split (before) = ${JSON.stringify(before)}`);
    // VP5627_SET_CUSTOM=<owner>/<staff> keeps that value; by default 60/40 is saved, checked, then put back.
    const [owner = '60', staff = '40'] = (setTo || '60/40').split('/');

    await typeAndSave(owner, staff);
    const after = await readSplit();
    console.warn(`VP5627 portal split (after save+reload) = ${JSON.stringify(after)}`);
    await scrollToCard();
    await browser.saveScreenshot(`${SHOT_DIR}/${shotName}.png`);
    if (!setTo) await typeAndSave(before.customOwner, before.customStaff);

    expect([after.customOwner, after.customStaff]).toEqual([owner, staff]);
    expect([after.availableOwner, after.availableStaff]).toEqual([
      before.availableOwner,
      before.availableStaff,
    ]);
  });
});

/** Type the Custom split, Save, reload and wait for the stored values. */
async function typeAndSave(owner: string, staff: string): Promise<void> {
  const handles = await browser.execute(() => {
    const label = Array.from(document.querySelectorAll('body *')).find(
      (el) => el.children.length === 0 && el.textContent?.trim() === 'Custom promotion',
    );
    let box: Element | null | undefined = label;
    while (box && box.querySelectorAll('input').length < 2) box = box.parentElement;
    Array.from(box?.querySelectorAll('input') ?? []).forEach((i, n) =>
      i.setAttribute('data-vp5627', String(n)),
    );
    return box ? 2 : 0;
  });
  if (!handles) throw new Error('VP-5627: Custom inputs not found');
  for (const [n, v] of [
    ['0', owner],
    ['1', staff],
  ] as const) {
    const input = $(`[data-vp5627="${n}"]`);
    await input.click();
    await browser.keys(['Control', 'a']);
    await browser.keys('Backspace');
    await input.addValue(v);
  }
  await settle(500);
  await $('//button[normalize-space(.)="Save"]').click();
  await settle(3000);
  await browser.refresh();
  await browser.waitUntil(async () => (await readSplit()).customOwner === owner, {
    timeout: 20_000,
    timeoutMsg: `VP-5627: Portal Custom owner share never showed ${owner} after save + reload.`,
  });
}
