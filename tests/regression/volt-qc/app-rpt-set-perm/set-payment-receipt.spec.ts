/**
 * volt-qc module 11-settings (SET-*) — Charge & Fee, Tipping Settings and
 * Receipt cases that SAVE (and restore).
 *
 * Source: volt-qc `e2e/tests/11-settings/set-plan-settings-payment.spec.ts`
 * (SET-T18, T22, T25, T26a, T26b, T26c, T27, T28, T30). SET-T15 (Product Tax) is
 * not ported: the owner decided not to change Tax / Service Fee of merchant 14 —
 * the Product Tax rows are [MANUAL] for that reason.
 *
 * ## Why this file is @exclusive
 *
 * Every setting here is MERCHANT-GLOBAL. Each case snapshots the original value,
 * writes, asserts, restores in `finally`, and asserts the restore. Tip options a
 * case adds carry the description prefix {@link TIP_PREFIX} and are deleted in
 * `finally` (and again in `after`).
 *
 * The customer-display checks (tip presets) need the customer window as a
 * WebDriver handle AND a merchant that prompts for a tip on cash; without either
 * the case skips with a reason.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { turnBoardDialog } from '../../../../src/components/index.js';
import {
  AspCard,
  AspHeader,
  AspIds,
  AspText,
  AspTip,
} from '../../../../src/constants/testids.voltqc-app-rpt-set-perm.js';
import {
  Vq,
  VqChargeFee,
  VqReceipt,
  VqTipping,
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
import {
  cashToTipScreen,
  cleanTill,
  customerTipPresets,
  draftToCheckout,
  finishFromTipScreen,
  goAnyLang,
  log,
  moneyCents,
  presetsOnNextCashOrder,
  qcTag,
  toastShown,
} from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import { dismissOverlays } from '../../../../src/pages/voltqc/settings-devm/nav.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { vqTipTable, type VqTipRow } from '../../../../src/pages/voltqc/settings-devm/VqTipTable.js';
import { voltQcProbe } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const TIP_PREFIX = 'QC E2E tip';
const TIP_SAVED = 'Tipping settings updated successfully';
const RECEIPT_SAVED = 'Receipt settings updated successfully';
const TURN_VALUE = VqChargeFee.turnValue();

async function openChargeFee(): Promise<void> {
  await dismissOverlays();
  await goAnyLang('/settings/charge-fee');
  await vqProbe.waitShown(Vq.heading('Charge & Fee'), Timeouts.MEDIUM);
}

async function openTipping(): Promise<void> {
  await dismissOverlays();
  await goAnyLang('/settings/payment-transaction');
  await vqProbe.waitShown(Vq.heading('Tipping Settings'), Timeouts.MEDIUM);
  await settle(800);
}

async function openReceipt(): Promise<void> {
  await dismissOverlays();
  await goAnyLang('/settings/receipt');
  await vqProbe.waitShown(Vq.heading('Receipt Setting'), Timeouts.MEDIUM);
}

/** Leave a settings page discarding unsaved drafts (rail → Language). */
async function leaveToLanguage(): Promise<void> {
  await goAnyLang('/settings/language');
}

async function saveTipping(): Promise<void> {
  await vqProbe.press(AspHeader.save('Tipping Settings'));
  await toastShown(TIP_SAVED, Timeouts.API);
  await settle(1_000);
}

function unusedPercent(rows: VqTipRow[], start: number): number {
  const used = new Set(rows.map((r) => Number(r.value)));
  let v = start;
  while (used.has(v)) v += 1;
  return v;
}

async function addTipOption(percent: number, desc: string): Promise<void> {
  await vqProbe.press(AspTip.addButton);
  await vqProbe.waitShown(AspTip.dialog, Timeouts.SHORT);
  await vqProbe.fill(AspTip.dialogPercent, String(percent));
  await vqProbe.fill(AspTip.dialogDesc, desc);
  await vqProbe.setChecked(AspTip.dialogStatus, true);
  await vqProbe.press(AspTip.dialogAdd);
  await vqProbe.isGone(AspTip.dialog, Timeouts.SHORT);
}

/** Delete every saved tip option whose description starts with `prefix` (writes immediately). */
async function cleanupTipOptions(prefix: string): Promise<void> {
  try {
    await openTipping();
    for (let i = 0; i < 10; i += 1) {
      const row = (await vqTipTable.rows()).find((r) => r.desc.startsWith(prefix));
      if (!row) break;
      await vqProbe.press(AspTip.rowButton(row.desc, 'Delete Tip Option'));
      await vqProbe.press(AspTip.deleteConfirm);
      await vqProbe.isGone(Vq.alertDialog(), Timeouts.SHORT);
      await settle(800);
    }
    await leaveToLanguage();
  } catch (error) {
    log.warn(`cleanupTipOptions(): ${error instanceof Error ? error.message : String(error)}`);
  }
}

const tipIsPercent = (): Promise<boolean> => vqProbe.isChecked(VqTipping.typePercent());

describe('volt-qc SET — Charge & Fee / Tipping / Receipt (settings)', () => {
  before(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('change merchant payment settings and restore');
    await cleanTill();
  });

  afterEach(async () => {
    await dismissOverlays().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await cleanupTipOptions(TIP_PREFIX);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Discount Setting: save 40/60 → still there after leaving; restored (SET-055)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openChargeFee();
      const o0 = await vqProbe.inputValue(AspIds.discountOwner);
      const s0 = await vqProbe.inputValue(AspIds.discountStaff);
      log.info(`SET-055 original Discount Setting: owner ${o0}% / staff ${s0}%`);
      const [o1, s1] = o0 === '40' ? ['50', '50'] : ['40', '60'];
      const apply = async (o: string, s: string): Promise<void> => {
        await vqProbe.fill(AspIds.discountOwner, o);
        await vqProbe.fill(AspIds.discountStaff, s);
        await vqProbe.press(AspCard.save('Discount Setting'));
        expect(await toastShown(AspText.discountSaved, Timeouts.API)).toBe(true);
      };
      try {
        await apply(o1, s1);
        await leaveToLanguage();
        await openChargeFee();
        expect([
          await vqProbe.inputValue(AspIds.discountOwner),
          await vqProbe.inputValue(AspIds.discountStaff),
        ]).toEqual([o1, s1]);
      } finally {
        await openChargeFee();
        if (
          (await vqProbe.inputValue(AspIds.discountOwner)) !== o0 ||
          (await vqProbe.inputValue(AspIds.discountStaff)) !== s0
        )
          await apply(o0, s0);
      }
      expect([
        await vqProbe.inputValue(AspIds.discountOwner),
        await vqProbe.inputValue(AspIds.discountStaff),
      ]).toEqual([o0, s0]);
    },
  );

  it(
    title(
      'Turn value: save a new amount → Turn board › Setting shows it; restored (SET-061)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openChargeFee();
      const old = await vqProbe.inputValue(TURN_VALUE);
      if (!(moneyCents(old) > 0)) {
        log.warn(`SET-061: Turn value is ${old} (Turn disabled) — not changed`);
        this.skip();
      }
      const nv = moneyCents(old) === 3000 ? '$31.00' : '$30.00';
      const setTv = async (v: string): Promise<void> => {
        await vqProbe.fill(TURN_VALUE, v.replace(/\D/g, ''));
        await vqProbe.press(AspCard.save('Turn Settings'));
        expect(await toastShown(AspText.turnSaved, Timeouts.API)).toBe(true);
      };
      try {
        await setTv(nv);
        expect(await vqProbe.inputValue(TURN_VALUE)).toBe(nv);
        await step('Turn board › Setting shows the new value (never saved there)', async () => {
          await returnToHome();
          await turnBoardDialog.open();
          await turnBoardDialog.openSettings();
          expect((await turnBoardDialog.readSettings()).turnValueCents).toBe(moneyCents(nv));
          await turnBoardDialog.cancelSettings();
          await turnBoardDialog.close();
        });
      } finally {
        await openChargeFee();
        if ((await vqProbe.inputValue(TURN_VALUE)) !== old) await setTv(old);
      }
      expect(await vqProbe.inputValue(TURN_VALUE)).toBe(old);
    },
  );

  it(
    title(
      'Customer tip screen shows exactly the Active options, in priority order, with % of the basis (SET-068)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openTipping();
      if (!(await tipIsPercent())) this.skip();
      const active = (await vqTipTable.rows()).filter((r) => r.active).map((r) => Number(r.value));
      const r = await cashToTipScreen(await draftToCheckout());
      if (!r.tipScreen) {
        await finishFromTipScreen().catch(() => undefined);
        log.warn('SET-068: the cash sale settled without a tip screen');
        this.skip();
      }
      const presets = await customerTipPresets();
      await finishFromTipScreen();
      if (presets === null) this.skip();
      log.info(`SET-068 active ${active.join(', ')} | customer ${JSON.stringify(presets)}`);
      expect((presets ?? []).map((p) => p.percent)).toEqual(active);
    },
  );

  it(
    title(
      'Tip option: add → Save → on the customer screen; edit value + description → Save; Delete writes at once and renumbers (SET-069, SET-074, SET-078)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 3);
      await openTipping();
      if (!(await tipIsPercent())) this.skip();
      const desc = `${TIP_PREFIX} ${qcTag()}`;
      const desc2 = `${desc} R`;
      try {
        const p1 = unusedPercent(await vqTipTable.rows(), 22);
        await step('SET-069 add → listed → Save → customer screen', async () => {
          await addTipOption(p1, desc);
          const row = (await vqTipTable.rows()).find((r) => r.desc === desc);
          expect(row?.value).toBe(String(p1));
          await saveTipping();
          const presets = await presetsOnNextCashOrder();
          if (presets === null)
            log.warn('SET-069: no tip screen / customer handle — customer side not checked');
          else expect(presets.map((p) => p.percent)).toContain(p1);
        });
        await openTipping();
        const p2 = unusedPercent(await vqTipTable.rows(), p1 + 1);
        await step('SET-074 edit value + description → Save', async () => {
          await vqProbe.press(AspTip.rowButton(desc, 'Edit Tip Option'));
          await vqProbe.fill(AspTip.editingInput(0), String(p2));
          await vqProbe.fill(AspTip.editingInput(1), desc2);
          await vqProbe.press({
            ...VqTipping.rowEdit(0),
            css: 'tbody tr:has(input) button[aria-label="Edit Tip Option"]',
          });
          await saveTipping();
          await openTipping();
          const saved = (await vqTipTable.rows()).find((r) => r.desc === desc2);
          expect(saved?.value).toBe(String(p2));
          const presets = await presetsOnNextCashOrder();
          if (presets !== null) {
            expect(presets.map((p) => p.percent)).toContain(p2);
            expect(presets.map((p) => p.percent)).not.toContain(p1);
          }
        });
        await step('SET-078 Delete → gone at once, no Discard prompt, numbering continuous', async () => {
          await openTipping();
          await vqProbe.press(AspTip.rowButton(desc2, 'Delete Tip Option'));
          await vqProbe.press(AspTip.deleteConfirm);
          await vqProbe.isGone(Vq.alertDialog(), Timeouts.SHORT);
          expect((await vqTipTable.rows()).some((r) => r.desc === desc2)).toBe(false);
          await vqProbe.press(Vq.railLink('Receipt'));
          expect(await vqProbe.isShown(Vq.alertDialog(), Timeouts.ANIMATION * 3)).toBe(false);
          await openTipping();
          const rows = await vqTipTable.rows();
          expect(rows.some((r) => r.desc === desc2)).toBe(false);
          const act = rows.filter((r) => r.active);
          expect(act.map((r) => r.pos)).toEqual(act.map((_, i) => String(i + 1)));
        });
      } finally {
        await cleanupTipOptions(TIP_PREFIX);
      }
    },
  );

  it(
    title(
      'Tip option Status OFF → moves to the bottom unnumbered, gone from the customer screen; ON again → numbered (SET-075)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await openTipping();
      if (!(await tipIsPercent())) this.skip();
      const desc = `${TIP_PREFIX} ${qcTag()}`;
      try {
        const p = unusedPercent(await vqTipTable.rows(), 24);
        await addTipOption(p, desc);
        await saveTipping();
        await openTipping();
        await vqProbe.press(AspTip.rowSwitch(desc));
        await saveTipping();
        await openTipping();
        const rows = await vqTipTable.rows();
        const i = rows.findIndex((r) => r.desc === desc);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(rows[i]?.active).toBe(false);
        expect(rows[i]?.pos).toBe('');
        expect(rows.slice(i).every((r) => !r.active)).toBe(true);
        const presets = await presetsOnNextCashOrder();
        if (presets !== null) expect(presets.map((x) => x.percent)).not.toContain(p);
        await openTipping();
        await vqProbe.press(AspTip.rowSwitch(desc));
        await saveTipping();
        await openTipping();
        const back = (await vqTipTable.rows()).find((r) => r.desc === desc);
        expect(back?.active).toBe(true);
        expect(back?.pos).not.toBe('');
      } finally {
        await cleanupTipOptions(TIP_PREFIX);
      }
    },
  );

  it(
    title(
      'A 5th Active tip option saves; dragging the last QC option to #1 reorders the customer screen (SET-073, SET-076)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 3);
      await openTipping();
      if (!(await tipIsPercent())) this.skip();
      const origActive = (await vqTipTable.rows()).filter((r) => r.active).map((r) => r.value);
      const tag = qcTag();
      try {
        let rows = await vqTipTable.rows();
        let n = 0;
        let lastDesc = '';
        let lastPct = 0;
        while ((n === 0 || rows.filter((r) => r.active).length < 5) && n < 6) {
          lastPct = unusedPercent(rows, 30 + n);
          lastDesc = `${TIP_PREFIX} ${tag} ${String(n)}`;
          await addTipOption(lastPct, lastDesc);
          rows = await vqTipTable.rows();
          n += 1;
        }
        await step('SET-073 Save with ≥ 5 Active options', async () => {
          await saveTipping();
          await openTipping();
          rows = await vqTipTable.rows();
          expect(rows.filter((r) => r.active).length).toBeGreaterThanOrEqual(5);
        });
        await step('SET-076 drag the last QC option to #1 → Save', async () => {
          const pts = await browser.execute(function (d: string) {
            const trs = Array.from(document.querySelectorAll('main tbody tr'));
            const grip = (tr: Element | undefined): { x: number; y: number } | null => {
              const g = tr?.querySelector(
                'td div.cursor-grab, td [aria-roledescription="sortable"], td button',
              );
              if (!g) return null;
              g.scrollIntoView({ block: 'center' });
              const r = g.getBoundingClientRect();
              return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            };
            return { from: grip(trs.find((tr) => (tr.textContent ?? '').includes(d))), to: grip(trs[0]) };
          }, lastDesc);
          if (!pts.from || !pts.to) throw new Error('SET-076: no drag handle found on the tip rows');
          await voltQcProbe.drag(pts.from, { x: pts.to.x, y: pts.to.y - 6 }, 900);
          const moved = await vqTipTable.rows();
          expect(moved[0]?.desc).toBe(lastDesc);
          await saveTipping();
          await openTipping();
          rows = await vqTipTable.rows();
          expect(rows[0]?.desc).toBe(lastDesc);
        });
        const active = rows.filter((r) => r.active).map((r) => Number(r.value));
        const presets = await presetsOnNextCashOrder();
        if (presets !== null) {
          expect(presets.map((p) => p.percent)).toEqual(active);
          expect(presets[0]?.percent).toBe(lastPct);
        }
      } finally {
        await cleanupTipOptions(TIP_PREFIX);
      }
      await openTipping();
      expect((await vqTipTable.rows()).filter((r) => r.active).map((r) => r.value)).toEqual(origActive);
    },
  );

  it(
    title(
      'Split Tip Setting = Proportion saves on its own; a two-staff cash order then splits the tip by line price; restored (SET-085)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await openTipping();
      expect(await vqProbe.count(AspCard.radios('Split Tip Setting'))).toBe(2);
      const orig = (await vqProbe.isChecked(AspIds.splitTipProportion))
        ? 'proportion'
        : (await vqProbe.isChecked(AspIds.splitTipEvenly))
          ? 'evenly'
          : null;
      log.info(`SET-085 original split method: ${orig ?? '(none)'}`);
      const saveSplit = async (): Promise<void> => {
        await vqProbe.press(AspCard.save('Split Tip Setting'));
        expect(await toastShown(AspText.splitTipSaved, Timeouts.API)).toBe(true);
      };
      let changed = false;
      try {
        if (orig !== 'proportion') {
          await vqProbe.press(AspIds.splitTipProportion);
          changed = true;
          await saveSplit();
        }
        await leaveToLanguage();
        await openTipping();
        expect(await vqProbe.isChecked(AspIds.splitTipProportion)).toBe(true);

        await step('Two-staff cash order with a $5.00 custom tip', async () => {
          await cleanTill();
          if ((await homePage.visibleStaffCount()) < 2)
            return void log.warn('SET-085: fewer than 2 staff — split not checked');
          await homePage.selectStaffByIndex(0);
          await homePage.addServiceByIndex(0);
          await homePage.selectStaffByIndex(1);
          await homePage.addServiceByIndex(1);
          const prices = await homePage.cartLinePricesCents();
          await homePage.pressPay();
          await checkoutPage.waitForReady();
          const r = await cashToTipScreen({ orderId: await checkoutPage.orderId(), orderNumber: '' });
          if (!r.tipScreen) {
            await finishFromTipScreen().catch(() => undefined);
            return void log.warn('SET-085: no tip screen on cash — split not checked');
          }
          const text = await finishFromTipScreen(500);
          const shares = Array.from(text.matchAll(/ - \$([\d,]+\.\d{2})/g)).map((m) => moneyCents(m[1]));
          log.info(`SET-085 prices ${prices.join(', ')} shares ${shares.join(', ')}`);
          if (shares.length >= 2 && prices.length >= 2) {
            const [pa, pb] = [prices[0] ?? 0, prices[1] ?? 0];
            expect((shares[0] ?? 0) + (shares[1] ?? 0)).toBe(500);
            expect(Math.abs((shares[0] ?? 0) - (500 * pa) / (pa + pb))).toBeLessThanOrEqual(1);
          }
        });
      } finally {
        if (changed && orig) {
          await openTipping();
          await vqProbe.press(orig === 'evenly' ? AspIds.splitTipEvenly : AspIds.splitTipProportion);
          await saveSplit();
        }
      }
      if (orig) {
        await openTipping();
        expect(
          await vqProbe.isChecked(orig === 'evenly' ? AspIds.splitTipEvenly : AspIds.splitTipProportion),
        ).toBe(true);
      }
    },
  );

  it(
    title(
      'Supply Share: both formulas shown; switching method → Save → kept after leaving; restored (SET-065)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openTipping();
      const t = await vqProbe.bodyText();
      expect(t).toContain('Commission = (Subtotal - Supply Share) x Commission Rate');
      expect(t).toContain('Commission = (Subtotal x Commission Rate) - Supply Share');
      const wasBefore = await vqProbe.isChecked(AspIds.supplyBefore);
      const choose = async (toBefore: boolean): Promise<void> => {
        await vqProbe.press(toBefore ? AspIds.supplyBefore : AspIds.supplyAfter);
        await vqProbe.press(AspCard.save('Supply Share'));
        expect(await toastShown(AspText.supplySaved, Timeouts.API)).toBe(true);
      };
      try {
        await choose(!wasBefore);
        await leaveToLanguage();
        await openTipping();
        expect(await vqProbe.isChecked(wasBefore ? AspIds.supplyAfter : AspIds.supplyBefore)).toBe(true);
      } finally {
        await openTipping();
        if ((await vqProbe.isChecked(AspIds.supplyBefore)) !== wasBefore) await choose(wasBefore);
      }
      expect(await vqProbe.isChecked(AspIds.supplyBefore)).toBe(wasBefore);
    },
  );

  it(
    title(
      'Receipt: Tip + Cashier name OFF → the Order History receipt drops both, Total unchanged; restored (SET-092, SET-100)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await openReceipt();
      const tipOn = await vqProbe.isChecked(VqReceipt.toggle('tip'));
      const cashierOn = await vqProbe.isChecked(VqReceipt.toggle('cashier-name'));
      if (!tipOn || !cashierOn) {
        log.warn('SET-092/100: Tip / Cashier name already OFF — not changed');
        this.skip();
      }
      const r = await cashToTipScreen(await draftToCheckout());
      await finishFromTipScreen(r.tipScreen ? 300 : undefined);
      const readReceipt = async (): Promise<string> => {
        await returnToHome();
        await goToOrderHistory();
        await orderHistoryPage.openOrder(r.orderId);
        await orderHistoryDetailPage.waitForOrder(r.orderId);
        await orderHistoryDetailPage.openReceiptDialog();
        await settle(1_200);
        const text = await browser.execute(function () {
          const dlg = Array.from(document.querySelectorAll('[role="dialog"]'))
            .filter((d) => (d.textContent ?? '').includes('Receipt'))
            .pop();
          return dlg ? (dlg as HTMLElement).innerText : '';
        });
        await orderHistoryDetailPage.closeReceiptDialog();
        return text;
      };
      const before = await readReceipt();
      const totalOf = (t: string): number => moneyCents(/(?:^|\n)Total\s*\n?\s*(-?\$[\d,.]+)/.exec(t)?.[1]);
      const cashier = /Cashier[:\s]*([^\n]+)/.exec(before)?.[1]?.trim() ?? '';
      expect(/(?:^|\n)Tip(?:\n|\s)/.test(before)).toBe(true);
      let touched = false;
      try {
        await openReceipt();
        await vqProbe.setChecked(VqReceipt.toggle('tip'), false);
        await vqProbe.setChecked(VqReceipt.toggle('cashier-name'), false);
        touched = true;
        await vqProbe.press(AspHeader.save('Receipt Setting'));
        expect(await toastShown(RECEIPT_SAVED, Timeouts.API)).toBe(true);
        const after = await readReceipt();
        expect(/(?:^|\n)Tip(?:\n|\s)/.test(after)).toBe(false);
        expect(totalOf(after)).toBe(totalOf(before));
        if (cashier !== '') expect(after.includes(cashier)).toBe(false);
      } finally {
        if (touched) {
          await openReceipt();
          await vqProbe.setChecked(VqReceipt.toggle('tip'), true);
          await vqProbe.setChecked(VqReceipt.toggle('cashier-name'), true);
          if (!(await vqProbe.isDisabled(AspHeader.save('Receipt Setting')))) {
            await vqProbe.press(AspHeader.save('Receipt Setting'));
            await toastShown(RECEIPT_SAVED, Timeouts.API);
          }
        }
      }
      await openReceipt();
      expect(await vqProbe.isChecked(VqReceipt.toggle('tip'))).toBe(true);
      expect(await vqProbe.isChecked(VqReceipt.toggle('cashier-name'))).toBe(true);
    },
  );
});
