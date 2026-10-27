/**
 * volt-qc 10-reports / 11-settings — the last rows of the APP/RPT/SET/PERM port,
 * written from the TC rows (no volt-qc test exists for them):
 *
 *  - Daily Sale: hourly chart sums vs the cards; an order with a $1.00 custom
 *    promotion + $2.00 tip in the Sale / Tip / Tax columns.
 *  - Staff Income: an order with 3 services does not overlap the next row.
 *  - Business Info: a Closed day blocks the appointment board for that day.
 *  - Services & Products: create a product (then switch it Inactive).
 *  - Employees › Compensation: the three types' sections, and the
 *    "Limit days off" controls (draft only, discarded).
 *
 * Writes: cash orders (one with a custom promotion), Sunday's Work Hours flipped
 * and restored, one `QC E2E prod …` product left INACTIVE (the POS has no
 * delete). Compensation is never saved. Tag.EXCLUSIVE where a merchant-global
 * setting is changed.
 */

import { $, browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { RptCss } from '../../../../src/constants/testids.voltqc-reports-time.js';
import { ServicesText } from '../../../../src/constants/testids.settings-services.js';
import {
  Vq,
  VqBusiness,
  VqScope,
  type VqQuery,
} from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { goToOrderHistory, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  checkoutPage,
  homePage,
  orderHistoryDetailPage,
  orderHistoryPage,
} from '../../../../src/pages/index.js';
import ServicesSettingsPage from '../../../../src/pages/settings/ServicesSettingsPage.js';
import StaffsSettingsPage from '../../../../src/pages/settings/StaffsSettingsPage.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import {
  buildHomeDraft,
  cashToTipScreen,
  cleanTill,
  finishFromTipScreen,
  goAnyLang,
  log,
  ownerCode,
  qcTag,
  settleCashOrder,
  toastShown,
} from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import { gotoBoard, nonWorkingBlocks } from '../../../../src/pages/voltqc/pos/appointmentProbe.js';
import { customDiscountSplit } from '../../../../src/pages/voltqc/promo-split/promoFlows.js';
import { rangeOffset } from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import {
  clickDailyCard,
  dailySnapshot,
  openDaily,
  openStaffIncome,
  selectStaffRow,
  staffList,
  type DailyRow,
  type DailySnap,
} from '../../../../src/pages/voltqc/reports-time/rptReports.js';
import {
  cancelBusinessEditIfOpen,
  dismissOverlays,
  openBusinessVq,
} from '../../../../src/pages/voltqc/settings-devm/nav.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const bare = (code: string): string => code.replace(/^#/, '').trim();
const rowFor = (s: DailySnap, code: string): DailyRow | undefined =>
  s.rows.find((r) => r.order.includes(bare(code)));

async function dailyUntil(ok: (s: DailySnap) => boolean, budgetMs = 60_000): Promise<DailySnap> {
  const end = Date.now() + budgetMs;
  let s = await dailySnapshot(0);
  while (!ok(s) && Date.now() < end) {
    await settle(3_000);
    s = await dailySnapshot(0);
  }
  return s;
}

/** Hover every bar of the Daily Sale chart and add up the tooltip values (cents, or a count). */
async function chartSum(asMoney: boolean): Promise<{ sum: number; bars: number }> {
  const bars = await browser.execute(function (left: string) {
    return Array.from(document.querySelectorAll(`${left} .recharts-bar-rectangle`))
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .map((r) => ({ x: r.x + r.width / 2, y: r.y + Math.max(r.height, 2) / 2 + (r.height < 2 ? -1 : 0) }));
  }, RptCss.leftPane);
  let sum = 0;
  for (const b of bars) {
    await browser
      .action('pointer')
      .move({ x: Math.round(b.x), y: Math.round(b.y) })
      .perform();
    await settle(250);
    const tip = await browser.execute(function () {
      const w = Array.from(document.querySelectorAll<HTMLElement>('.recharts-tooltip-wrapper')).pop();
      return w ? (w.innerText || w.textContent || '').replace(/\s+/g, ' ') : '';
    });
    const nums = tip.match(/-?\$?-?[\d,]+(?:\.\d+)?/g) ?? [];
    const last = nums[nums.length - 1] ?? '0';
    const n = Number(last.replace(/[$,]/g, ''));
    sum += asMoney ? Math.round(n * 100) : n;
  }
  return { sum, bars: bars.length };
}

/** Text of one Compensation section (Commission / Commission + Salary / Salary), isolated from the others. */
async function compensationSection(name: string): Promise<string> {
  return browser.execute(function (n: string) {
    const names = ['Commission', 'Commission + Salary', 'Salary'];
    const others = names.filter((x) => x !== n);
    const leaf = Array.from(document.querySelectorAll('main *')).find(
      (e) => e.children.length === 0 && (e.textContent ?? '').trim() === n && e.getClientRects().length > 0,
    );
    if (!leaf) return '';
    let box: Element | null = leaf.parentElement;
    let best: Element | null = leaf.parentElement;
    while (box && box.tagName !== 'MAIN') {
      const heads = Array.from(box.querySelectorAll('*')).filter(
        (e) => e.children.length === 0 && others.includes((e.textContent ?? '').trim()),
      );
      if (heads.length > 0) break;
      best = box;
      box = box.parentElement;
    }
    return best ? ((best as HTMLElement).innerText || '').replace(/\s+/g, ' ') : '';
  }, name);
}

/** Open (expand) the Compensation accordion titled `name` and pick its radio. */
async function pickCompensation(name: string): Promise<void> {
  await browser.execute(function (n: string) {
    const leaf = Array.from(document.querySelectorAll('main *')).find(
      (e) => e.children.length === 0 && (e.textContent ?? '').trim() === n && e.getClientRects().length > 0,
    );
    const trigger = leaf?.closest('button, [role="button"], label');
    const box = trigger?.parentElement ?? leaf?.parentElement;
    const radio = box?.querySelector<HTMLElement>('[role="radio"], input[type="radio"]');
    if (trigger && trigger.getAttribute('aria-expanded') === 'false') (trigger as HTMLElement).click();
    radio?.click();
    if (!radio && trigger) (trigger as HTMLElement).click();
  }, name);
  await settle(800);
}

/** Days-off controls inside the Commission + Salary section. */
async function daysOffState(): Promise<{
  found: boolean;
  checked: boolean;
  maxDisabled: boolean;
  maxValue: string;
  days: { label: string; disabled: boolean; on: boolean }[];
}> {
  return browser.execute(function () {
    const leaf = Array.from(document.querySelectorAll('main *')).find(
      (e) => e.children.length === 0 && (e.textContent ?? '').trim() === 'Limit days off for this staff',
    );
    let box: Element | null = leaf?.parentElement ?? null;
    for (
      let i = 0;
      i < 8 &&
      box &&
      !(
        box.querySelector('input:not([type="checkbox"])') &&
        (box.textContent ?? '').includes('Days not allowed to be off')
      );
      i += 1
    )
      box = box.parentElement;
    if (!leaf || !box) return { found: false, checked: false, maxDisabled: false, maxValue: '', days: [] };
    const cb = box.querySelector('[role="checkbox"], input[type="checkbox"]');
    const max = box.querySelector<HTMLInputElement>('input:not([type="checkbox"])');
    const dis = (e: Element | null): boolean =>
      !!e &&
      ((e as HTMLInputElement).disabled ||
        e.getAttribute('aria-disabled') === 'true' ||
        e.hasAttribute('data-disabled'));
    const days = Array.from(box.querySelectorAll('button')).filter((b) =>
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test((b.textContent ?? '').trim()),
    );
    return {
      found: true,
      checked: cb
        ? cb.getAttribute('aria-checked') === 'true' || (cb as HTMLInputElement).checked === true
        : false,
      maxDisabled: dis(max),
      maxValue: max ? max.value : '',
      days: days.map((b) => ({
        label: (b.textContent ?? '').trim(),
        disabled: dis(b),
        on:
          b.getAttribute('data-state') === 'on' ||
          b.getAttribute('aria-pressed') === 'true' ||
          /bg-primary/.test(b.className),
      })),
    };
  });
}

/** Stamp a days-off control and return its selector. */
async function markDaysOff(which: string): Promise<string> {
  const tag = `d${String(Date.now())}`;
  const ok = await browser.execute(
    function (w: string, t: string) {
      const leaf = Array.from(document.querySelectorAll('main *')).find(
        (e) => e.children.length === 0 && (e.textContent ?? '').trim() === 'Limit days off for this staff',
      );
      let box: Element | null = leaf?.parentElement ?? null;
      for (let i = 0; i < 8 && box && !(box.textContent ?? '').includes('Days not allowed to be off'); i += 1)
        box = box.parentElement;
      if (!box) return false;
      const el =
        w === 'checkbox'
          ? box.querySelector('[role="checkbox"], input[type="checkbox"]')
          : w === 'max'
            ? box.querySelector('input:not([type="checkbox"])')
            : Array.from(box.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === w);
      if (!el) return false;
      el.setAttribute('data-asp-dayoff', t);
      return true;
    },
    which,
    tag,
  );
  if (!ok) throw new Error(`Days-off control "${which}" not found`);
  return `[data-asp-dayoff="${tag}"]`;
}

const productSwitch = (name: string): VqQuery => ({
  name: `product switch "${name}"`,
  css: 'td',
  text: name,
  match: 'contains',
  within: VqScope.main,
  up: { until: '[role="switch"]', css: '[role="switch"]', nth: 0 },
});

async function openEmployeeCompensation(): Promise<void> {
  await dismissOverlays();
  await goAnyLang('/settings/staffs');
  const rows = await StaffsSettingsPage.staffRows();
  if (!rows[0]) throw new Error('Settings › Employees lists nobody');
  await StaffsSettingsPage.openStaff(rows[0].name);
  await StaffsSettingsPage.openTab(1);
}

async function leaveDiscarding(): Promise<void> {
  await StaffsSettingsPage.leaveToSection('/settings/language').catch(() => goAnyLang('/settings/language'));
}

describe('volt-qc RPT / SET — remaining rows (mutation / settings)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('settle orders, flip Work Hours, create a product');
    await cleanTill();
  });

  afterEach(async () => {
    await dismissOverlays().catch(() => undefined);
    await gateProbe.dismiss().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await cancelBusinessEditIfOpen().catch(() => undefined);
    await ensurePasscodeGrant();
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Daily Sale: the hourly bars of Total Order add up to the Total Order card, and the Sale bars to the Sale card (RPT-035)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      let snap = await dailySnapshot(0);
      if (!((snap.cards['Total Order']?.value ?? 0) > 0)) {
        await settleCashOrder();
        snap = await dailyUntil((s) => (s.cards['Total Order']?.value ?? 0) > 0);
      }
      await openDaily(0, 'order');
      await clickDailyCard('Total Order');
      await settle(1_200);
      const orders = await chartSum(false);
      log.info(`RPT-035 Total Order bars ${String(orders.bars)} sum ${String(orders.sum)}`);
      expect(orders.bars).toBeGreaterThan(0);
      expect(orders.sum).toBe(snap.cards['Total Order']?.value);
      await clickDailyCard('Sale');
      await settle(1_200);
      const sale = await chartSum(true);
      log.info(`RPT-035 Sale bars ${String(sale.bars)} sum ${String(sale.sum)}`);
      expect(Math.abs(sale.sum - (snap.cards['Sale']?.value ?? 0))).toBeLessThanOrEqual(sale.bars);
    },
  );

  it(
    title(
      'Order with a $1.00 custom promotion + $2.00 tip: Daily Sale row Sale = price − $1, Tip $2, Total = Sale + Tax + Tip; Δ Sale card = row Sale (RPT-185)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      const before = await dailySnapshot(0);
      await buildHomeDraft();
      const price = (await homePage.cartLinePricesCents())[0] ?? 0;
      await customDiscountSplit('$', 1);
      await homePage.pressPay();
      await checkoutPage.waitForReady();
      const draft = {
        orderId: await checkoutPage.orderId(),
        orderNumber: (await checkoutPage.orderNumber()).trim(),
      };
      const r = await cashToTipScreen(draft);
      await finishFromTipScreen(r.tipScreen ? 200 : undefined);
      if (!r.tipScreen) {
        await step('No tip screen on cash — add the $2.00 with Adjust Tip', async () => {
          await goToOrderHistory();
          await orderHistoryPage.openOrder(draft.orderId);
          await orderHistoryDetailPage.waitForOrder(draft.orderId);
          if (!(await orderHistoryDetailPage.isAdjustTipAvailable())) {
            log.warn('RPT-185: no tip screen and no Adjust Tip — tip part not checked');
            return;
          }
          await orderHistoryDetailPage.adjustTip(200);
          if (await gateProbe.waitOpen(1_500)) await gateProbe.submit(ownerCode());
          await settle(1_500);
        });
      }
      const after = await dailyUntil((s) => (rowFor(s, draft.orderNumber)?.tip ?? 0) === 200);
      const row = rowFor(after, draft.orderNumber);
      expect(row).toBeDefined();
      expect(row?.sale).toBe(price - 100);
      expect(row?.tip).toBe(200);
      expect(row?.total).toBe((row?.sale ?? 0) + (row?.tax ?? 0) + (row?.tip ?? 0));
      expect((after.cards['Sale']?.value ?? 0) - (before.cards['Sale']?.value ?? 0)).toBeGreaterThanOrEqual(
        row?.sale ?? 0,
      );
      if (after.detail) expect(after.cards['Sale']?.value).toBe(after.detail.sale);
    },
  );

  it(
    title(
      'Staff Income detail: an order with 3 services wraps inside its row and does not overlap the next row or the totals (RPT-099)',
      Tag.REGRESSION,
      Tag.WRITE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      const today = rangeOffset(0);
      await openStaffIncome(today);
      const before = await staffList();
      await settleCashOrder(3);
      let name = '';
      const end = Date.now() + 60_000;
      while (name === '' && Date.now() < end) {
        await openStaffIncome(today);
        const now = await staffList();
        name =
          now.rows.find((r) => r.orders > (before.rows.find((b) => b.name === r.name)?.orders ?? 0))?.name ??
          '';
        if (name === '') await settle(3_000);
      }
      if (name === '') throw new Error('Staff Income never showed the new 3-service order');
      await selectStaffRow(name);
      await settle(1_500);
      const layout = await browser.execute(function (right: string) {
        const rows = Array.from(document.querySelectorAll(`${right} tbody tr`)).filter(
          (r) => r.getClientRects().length > 0,
        );
        const rects = rows.map((r) => r.getBoundingClientRect());
        const overlaps = rects.slice(1).filter((r, i) => r.top < (rects[i]?.bottom ?? 0) - 1).length;
        const clipped = Array.from(document.querySelectorAll(`${right} tbody td`)).filter((td) => {
          const s = getComputedStyle(td);
          return td.scrollHeight > td.clientHeight + 2 && s.overflowY === 'visible';
        }).length;
        const multi = rows.filter(
          (r) => ((r as HTMLElement).innerText.match(/\n/g) ?? []).length >= 3,
        ).length;
        return { rows: rows.length, overlaps, clipped, multi };
      }, RptCss.rightPane);
      log.info(`RPT-099 ${name}: ${JSON.stringify(layout)}`);
      expect(layout.rows).toBeGreaterThan(0);
      expect(layout.multi).toBeGreaterThan(0);
      expect(layout.overlaps).toBe(0);
      expect(layout.clipped).toBe(0);
    },
  );

  it(
    title(
      'A day set Closed in Business Info blocks the appointment board for that day; Work Hours restored (SET-023)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 3);
      const sw = VqBusiness.daySwitch('sunday');
      const sunday = new Date();
      sunday.setHours(0, 0, 0, 0);
      sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7));
      const setSunday = async (open: boolean): Promise<void> => {
        await openBusinessVq();
        if ((await vqProbe.isChecked(sw)) === open) return;
        await vqProbe.press(VqBusiness.headerButton('Edit'));
        await vqProbe.waitShown(VqBusiness.headerButton('Cancel'), Timeouts.SHORT);
        await vqProbe.press(sw);
        if (open) {
          await vqProbe.setNative(VqBusiness.dayTime('sunday', 0), '09:00');
          await vqProbe.setNative(VqBusiness.dayTime('sunday', 1), '17:00');
        }
        await vqProbe.press(VqBusiness.headerButton('Save'));
        await toastShown('Business info updated successfully', Timeouts.API);
        await vqProbe.isShown(VqBusiness.headerButton('Edit'), Timeouts.MEDIUM);
        await settle(2_000);
      };
      const boardState = async (): Promise<{ blocked: number; closedText: boolean }> => {
        await returnToHome();
        await gotoBoard(sunday);
        await settle(1_500);
        const blocks = await nonWorkingBlocks(0);
        const text = await browser.execute(() => document.querySelector('main')?.textContent ?? '');
        return { blocked: blocks.reduce((a, b) => a + b.height, 0), closedText: /\bClosed\b/i.test(text) };
      };
      await openBusinessVq();
      const orig = {
        open: await vqProbe.isChecked(sw),
        start:
          (await vqProbe.count(VqBusiness.dayTime('sunday', 0))) > 0
            ? (await vqProbe.inputValue(VqBusiness.dayTime('sunday', 0))).slice(0, 5)
            : '',
        end:
          (await vqProbe.count(VqBusiness.dayTime('sunday', 1))) > 0
            ? (await vqProbe.inputValue(VqBusiness.dayTime('sunday', 1))).slice(0, 5)
            : '',
      };
      log.info(`SET-023 original Sunday ${JSON.stringify(orig)}`);
      try {
        await setSunday(true);
        const open = await boardState();
        await setSunday(false);
        const closed = await boardState();
        log.info(`SET-023 board open ${JSON.stringify(open)} closed ${JSON.stringify(closed)}`);
        expect(closed.closedText || closed.blocked > open.blocked).toBe(true);
      } finally {
        await setSunday(orig.open).catch(() => undefined);
        if (orig.open && orig.start !== '') {
          await openBusinessVq();
          if ((await vqProbe.inputValue(VqBusiness.dayTime('sunday', 0))).slice(0, 5) !== orig.start) {
            await vqProbe.press(VqBusiness.headerButton('Edit'));
            await vqProbe.setNative(VqBusiness.dayTime('sunday', 0), orig.start);
            await vqProbe.setNative(VqBusiness.dayTime('sunday', 1), orig.end);
            await vqProbe.press(VqBusiness.headerButton('Save'));
            await toastShown('Business info updated successfully', Timeouts.API);
          }
        }
        await cancelBusinessEditIfOpen().catch(() => undefined);
      }
      await openBusinessVq();
      expect(await vqProbe.isChecked(sw)).toBe(orig.open);
    },
  );

  it(
    title(
      'New product $5.00: "Product created successfully", listed, offered on Home; then switched Inactive (SET-149)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      const name = `QC E2E prod ${qcTag()}`;
      await goAnyLang('/settings/services');
      let category = '';
      for (const c of await ServicesSettingsPage.categoryNames()) {
        await ServicesSettingsPage.openCategory(c);
        const headers = await ServicesSettingsPage.tableHeaders();
        if (!headers.some((h) => (ServicesText.durationColumn as readonly string[]).includes(h))) {
          category = c;
          break;
        }
        await goAnyLang('/settings/services');
      }
      if (category === '') {
        log.warn('SET-149: no product category on this merchant');
        this.skip();
      }
      try {
        await ServicesSettingsPage.openAddItem();
        await ServicesSettingsPage.typeDialogName(name);
        await ServicesSettingsPage.replacePrice('500');
        await vqProbe.press(Vq.button('Add', VqScope.dialog));
        expect(await toastShown('Product created successfully', Timeouts.API)).toBe(true);
        await vqProbe.isGone(Vq.anyDialog(), Timeouts.MEDIUM);
        await settle(1_200);
        const row = (await ServicesSettingsPage.rows()).find((r) => r.name === name);
        expect(row?.price).toBe('$5.00');
        await cleanTill();
        await homePage.selectStaffByIndex(0);
        await homePage.searchService(name);
        await settle(800);
        const onHome = await browser.execute(
          (n: string) => (document.querySelector('main')?.textContent ?? '').includes(n),
          name,
        );
        expect(onHome).toBe(true);
        await cleanTill();
      } finally {
        await goAnyLang('/settings/services');
        await ServicesSettingsPage.openCategory(category);
        if (
          (await vqProbe.count(productSwitch(name))) > 0 &&
          (await vqProbe.isChecked(productSwitch(name)))
        ) {
          await vqProbe.press(productSwitch(name));
          await settle(1_000);
        }
      }
      expect(await vqProbe.isChecked(productSwitch(name))).toBe(false);
    },
  );

  it(
    title(
      'Compensation: Commission / Commission + Salary / Salary each show their own sections; Salary Setting has 3 options (draft, discarded) (SET-181)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openEmployeeCompensation();
      try {
        for (const n of ['Commission', 'Commission + Salary', 'Salary']) await pickCompensation(n);
        const commission = await compensationSection('Commission');
        const both = await compensationSection('Commission + Salary');
        const salary = await compensationSection('Salary');
        log.info(
          `SET-181 sections: C=${String(commission.length)} CS=${String(both.length)} S=${String(salary.length)}`,
        );
        for (const s of [
          'Commission Setting',
          'Pay 1 - Pay 2',
          'Deduction Per Day',
          'Card Fee Charge',
          'Exclude Tips From Cash/Check Income',
        ])
          expect({ s, has: commission.includes(s) }).toEqual({ s, has: true });
        expect(commission.includes('Staff Days Off Setting')).toBe(false);
        for (const s of ['Salary Setting', 'Staff Days Off Setting', 'Limit days off for this staff'])
          expect({ s, has: both.includes(s) }).toEqual({ s, has: true });
        for (const s of [
          'Salary Setting',
          'Salary by Period',
          'Wage Per Day',
          'Wage Per Hour',
          'Exclude Tips From Cash/Check Income',
        ])
          expect({ s, has: salary.includes(s) }).toEqual({ s, has: true });
        expect(salary.includes('Commission Setting')).toBe(false);
        expect(salary.includes('Staff Days Off Setting')).toBe(false);
        expect(salary.includes('On Staff Commission')).toBe(false);
      } finally {
        await leaveDiscarding();
      }
    },
  );

  it(
    title(
      'Compensation › Limit days off: unticked locks Max + Mon…Sun; ticked unlocks them, Max keeps digits only, several days selectable (draft, discarded) (SET-182)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openEmployeeCompensation();
      try {
        await pickCompensation('Commission + Salary');
        let s = await daysOffState();
        if (!s.found) throw new Error('No "Limit days off for this staff" in Commission + Salary');
        if (s.checked) {
          await $(await markDaysOff('checkbox')).click();
          await settle(400);
          s = await daysOffState();
        }
        expect(s.maxDisabled).toBe(true);
        expect(s.days.length).toBe(7);
        expect(s.days.every((d) => d.disabled)).toBe(true);

        await $(await markDaysOff('checkbox')).click();
        await settle(400);
        const maxSel = await markDaysOff('max');
        await $(maxSel).click();
        await browser.keys(['Control', 'a']);
        await browser.keys(['Control']);
        await browser.keys(['2', 'a']);
        await $(await markDaysOff('Tue')).click();
        await $(await markDaysOff('Wed')).click();
        await settle(400);
        s = await daysOffState();
        expect(s.maxDisabled).toBe(false);
        expect(s.maxValue).toBe('2');
        expect(s.days.every((d) => !d.disabled)).toBe(true);
        expect(s.days.filter((d) => d.on).map((d) => d.label)).toEqual(
          expect.arrayContaining(['Tue', 'Wed']),
        );

        await $(await markDaysOff('checkbox')).click();
        await settle(400);
        s = await daysOffState();
        expect(s.maxDisabled).toBe(true);
        expect(s.days.every((d) => d.disabled)).toBe(true);
      } finally {
        await leaveDiscarding();
      }
    },
  );
});
