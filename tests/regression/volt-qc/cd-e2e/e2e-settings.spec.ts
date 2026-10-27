/**
 * volt-qc port — 14 E2E: settings that change what the screens show (every
 * change is restored in a `finally`).
 *
 * Source: volt-qc `e2e/tests/14-e2e/e2e-plan-settings.spec.ts` (E2E-T26..T30).
 *
 * EXCLUSIVE: tip options, receipt display, passcode gates and Customer Display
 * are merchant-wide; language is device-wide.
 *
 * Adaptations: the passcode gate is driven through the suite's
 * `accessibilitySettingsPage` (`#passcode-gate-complete_order`); report legs are
 * reduced to the order's Daily Sale row; E2E-T29's per-screen sweep checks for
 * raw i18n keys and unchanged amounts, as the source did.
 */

import { expect } from '@wdio/globals';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../../src/components/index.js';
import { CdCustomer, CdMain, type VqcQuery } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { accessibilitySettingsPage } from '../../../../src/pages/index.js';
import {
  app,
  field,
  moneyField,
  randomPhone,
  uniqueName,
} from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import { setCustomerDisplay, setLanguage } from '../../../../src/pages/voltqc/cd-e2e/settingsCd.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, expectCents, note, resetTill, track, untrack, usd } from './cd-e2e.helpers.js';

/* ----------------------------- tip options ----------------------------- */

interface TipRow {
  index: number;
  value: string;
  active: boolean;
}

async function readTipOptions(): Promise<{ isPercent: boolean; list: TipRow[] }> {
  await app.openReport('/settings/payment-transaction');
  await app.waitFor({ text: 'Tip Option', nth: 0 });
  await app.pause(800);
  const isPercent = await app.isOn({ css: '#charge-fee-tip-type-percent', nth: 0 });
  const rows = await app.texts([{ css: 'main' }, { css: 'tbody tr' }]);
  const list: TipRow[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const cells = await app.texts([{ css: 'main' }, { css: 'tbody tr', nth: i }, { css: 'td' }]);
    const active = await app
      .isOn([{ css: 'main' }, { css: 'tbody tr', nth: i }, { role: 'switch', nth: 0 }])
      .catch(() => false);
    list.push({ index: i, value: (cells[1] ?? '').replace('%', '').trim(), active });
  }
  return { isPercent, list };
}

async function editTipOption(index: number, value: number): Promise<void> {
  await readTipOptions();
  const row: readonly VqcQuery[] = [{ css: 'main' }, { css: 'tbody tr', nth: index }];
  await app.click([...row, { role: 'button', name: 'Edit Tip Option', nth: 0 }]);
  await app.fill([...row, { role: 'textbox', nth: 0 }], String(value));
  await app.click([...row, { role: 'button', name: 'Edit Tip Option', nth: 0 }]);
  await app.click([{ css: 'main' }, { role: 'button', name: 'Save', nth: 0 }]);
  await app.passcodeIfAsked(1_500);
  if (!(await app.waitFor({ text: 'Tipping settings updated successfully', nth: 0 }))) {
    throw new Error('Tip Option save: no "Tipping settings updated successfully" toast');
  }
}

/* --------------------------- receipt display --------------------------- */

const receiptToggle = (id: string): VqcQuery => ({ css: `form #${id}`, nth: 0 });
const PREVIEW: VqcQuery = { css: 'div.paper', nth: 0 };

async function setReceiptDisplay(
  values: Record<string, boolean>,
): Promise<{ orig: Record<string, boolean>; changed: boolean }> {
  await app.openReport('/settings/receipt');
  const orig: Record<string, boolean> = {};
  let changed = false;
  for (const [id, on] of Object.entries(values)) {
    const was = await app.isOn(receiptToggle(id));
    orig[id] = was;
    if (was !== on) {
      await app.click(receiptToggle(id));
      changed = true;
    }
  }
  return { orig, changed };
}

async function saveReceipt(): Promise<void> {
  await app.click([{ css: 'main' }, { role: 'button', name: 'Save', nth: 0 }]);
  await app.passcodeIfAsked(1_500);
  if (!(await app.waitFor({ text: 'Receipt settings updated successfully', nth: 0 }))) {
    throw new Error('Receipt save: no "Receipt settings updated successfully" toast');
  }
}

describe('volt-qc 14 E2E — settings → screens', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'Change a Tip Option % → the customer tip screen shows that % with round(base × %), one tile lit; the tip lands on the order, history and the Daily Sale row (E2E-046)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(10 * 60_000);
      const d = await app.testData();
      const opts = await readTipOptions();
      const row = opts.list.find((r) => r.active && /^\d+$/.test(r.value));
      if (!opts.isPercent || !row) this.skip();
      const orig = Number(row?.value);
      const used = new Set(opts.list.map((r) => Number(r.value)));
      let next = orig + 1;
      while (used.has(next) && next < 100) next += 1;
      note(`E2E-046: Tip Option row ${String((row?.index ?? 0) + 1)} ${String(orig)}% → ${String(next)}%`);
      try {
        await editTipOption(row?.index ?? 0, next);
        await returnToHome();
        const code = track(await app.createOrder());
        await app.pay();
        const paid = await app.methodCents('Other');
        await app.selectMethod('Other');
        ensure(await app.completeUntilTipScreen(), 'no customer tip screen for Other');
        const base = await cust.tipBaseCents();
        expect(base).toBeGreaterThan(0);
        const tip = Math.round((base * next) / 100);
        const label = `${String(next)}%`;
        expect(await cust.tipPresetLabels()).toContain(label);
        expect(await cust.text()).toContain(usd(tip));
        await cust.clickPreset(label);
        let lit = 0;
        for (const l of await cust.tipPresetLabels()) if (await cust.presetSelected(l)) lit += 1;
        expect(lit).toBe(1);
        expect(await cust.presetSelected(label)).toBe(true);
        expect(await cust.tipAmountCents()).toBe(tip);
        await cust.click(CdCustomer.continue);
        await app.waitPaymentSuccess();
        expect(await app.successText()).toContain(`${usd(paid)} + ${usd(tip)} Tip`);
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await app.noReceipt();
        untrack(code);
        await app.openHistoryOrder(code);
        const dump = await app.historyDetail(code);
        expect(field(dump, 'Tip')).toBe(usd(tip));
        expect(dump).toContain(`${d.staff} - ${usd(tip)}`);
        expectCents(moneyField(dump, 'Total'), paid + tip, 'history Total');
        const r = await app.dailySaleRow(code);
        ensure(r !== null, `${code} never showed in Daily Sale`);
        expect(r ?? '').toContain(usd(tip));
      } finally {
        await editTipOption(row?.index ?? 0, orig).catch((e: unknown) =>
          note(`RESTORE-FAILED Tip Option ${String(orig)}%: ${String(e)}`),
        );
      }
      expect((await readTipOptions()).list[row?.index ?? 0]?.value).toBe(String(orig));
    },
  );

  it(
    title(
      'Receipt Display Options: hide Subtotal + Total Discount → preview hides them (Tip/Total stay); the order Receipt hides them too while Order Summary keeps the numbers (E2E-047)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const code = track(await app.createOrder());
      await app.customDiscount('%', 10);
      await app.payCurrentOrder('Cash');
      await app.noReceipt();
      untrack(code);
      let orig: Record<string, boolean> = {};
      try {
        await step('untick Subtotal + Total Discount → preview', async () => {
          const r = await setReceiptDisplay({ subtotal: false, 'total-discount': false });
          orig = r.orig;
          expect(await app.has([PREVIEW, { text: 'Subtotal' }])).toBe(false);
          expect(await app.has([PREVIEW, { text: 'Total Discount' }])).toBe(false);
          expect(await app.has([PREVIEW, { text: 'Tip', nth: 0 }])).toBe(true);
          expect(await app.has([PREVIEW, { text: 'Total', nth: 0 }])).toBe(true);
          if (r.changed) await saveReceipt();
        });
        await step('Order History receipt', async () => {
          await app.openHistoryOrder(code);
          const dump = await app.historyDetail(code);
          const sub = moneyField(dump, 'Subtotal');
          expect(sub).toBeGreaterThan(0);
          expect(moneyField(dump, 'Total Discount')).toBeLessThan(0);
          await app.click([{ css: 'main' }, { role: 'button', name: 'Receipt', nth: 0 }]);
          const dlg: VqcQuery = { role: 'dialog', hasText: 'Receipt Details', nth: -1 };
          expect(await app.waitFor(dlg)).toBe(true);
          expect(await app.has([dlg, { text: 'Total', nth: 0 }])).toBe(true);
          expect(await app.has([dlg, { text: 'Subtotal' }])).toBe(false);
          expect(await app.has([dlg, { text: 'Total Discount' }])).toBe(false);
          await app.escape();
        });
      } finally {
        if (Object.keys(orig).length) {
          const r = await setReceiptDisplay(orig).catch(() => null);
          if (r?.changed)
            await saveReceipt().catch((e: unknown) => note(`RESTORE-FAILED receipt display: ${String(e)}`));
        }
      }
      await app.openReport('/settings/receipt');
      if (orig.subtotal) expect(await app.has([PREVIEW, { text: 'Subtotal', nth: 0 }])).toBe(true);
      if (orig['total-discount'])
        expect(await app.has([PREVIEW, { text: 'Total Discount', nth: 0 }])).toBe(true);
    },
  );

  it(
    title(
      'Passcode "Completed Payment" OFF → payment asks no code while reports still do; back ON → asks again; ticking "skip 30 minutes" carries to Staff Income (E2E-048)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      await app.clearPasscodeSkip();
      await app.openReport('/settings/accessibility');
      await accessibilitySettingsPage.waitForReady();
      const orig = await accessibilitySettingsPage.isGateOn('complete_order');
      try {
        await step('gate OFF', async () => {
          await accessibilitySettingsPage.setGate('complete_order', false);
          await accessibilitySettingsPage.savePasscodeSettings();
          await returnToHome();
          const code = track(await app.createOrder());
          await app.pay();
          await app.selectMethod('Other');
          await app.click(CdMain.completePayment);
          expect(
            await app.waitFor(
              { role: 'dialog', hasText: 'Enter staff code to complete payment', nth: -1 },
              4_000,
            ),
          ).toBe(false);
          await app.driveToSuccess('none');
          await app.successText();
          await app.noReceipt();
          untrack(code);
        });
        await step('Daily Sale still gated', async () => {
          expect(await app.tryGate('/incomes/income-daily', env.OWNER_PASSCODE)).toBe('allowed');
        });
        await step('gate ON → asks; skip 30 min → Staff Income does not ask', async () => {
          await app.openReport('/settings/accessibility');
          await accessibilitySettingsPage.setGate('complete_order', true);
          await accessibilitySettingsPage.savePasscodeSettings();
          await returnToHome();
          const code = track(await app.createOrder());
          await app.pay();
          await app.selectMethod('Other');
          await app.click(CdMain.completePayment);
          ensure(await passcodeDialog.isPrompting(5_000), 'gate back ON but Complete Payment asked no code');
          await passcodeDialog.enter(env.STAFF_PASSCODE, {
            skipForNext30Min: await passcodeDialog.canSkip(),
          });
          await app.driveToSuccess('none');
          await app.successText();
          await app.noReceipt();
          untrack(code);
          await app.go('/home', { passcode: false });
          await app.routerGoRaw('/incomes/income-staff');
          expect(await passcodeDialog.isPrompting(4_000)).toBe(false);
        });
      } finally {
        await app.clearPasscodeSkip();
        await app.openReport('/settings/accessibility').catch(() => undefined);
        await accessibilitySettingsPage.setGate('complete_order', orig).catch(() => undefined);
        await accessibilitySettingsPage.savePasscodeSettings().catch(() => undefined);
      }
      expect(await accessibilitySettingsPage.isGateOn('complete_order')).toBe(orig);
      expect(await app.skipGrantActive()).toBe(false);
    },
  );

  it(
    title(
      'Tiếng Việt on the main screens (Home, Pending, checkout, Order History, order detail, Daily Sale): no raw i18n key, amounts unchanged, customer display still English → back to English (E2E-049)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
      Tag.SLOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const d = await app.testData();
      const { code: paidCode } = await app.createPaidOrder({ method: 'Cash' });
      await app.openHistoryOrder(paidCode);
      const detailPath = await app.path();
      const draft = track(await app.createOrder());
      await app.pay();
      const checkoutPath = await app.path();
      const enTiles: number[] = [];
      for (const m of ['Card', 'Cash', 'Gift Card', 'Other'] as const) enTiles.push(await app.methodCents(m));
      const raw: string[] = [];
      try {
        await setLanguage('vi');
        expect(await app.waitFor({ text: 'Ngôn ngữ', nth: 0 }, 10_000)).toBe(true);
        for (const [label, to] of [
          ['Home', '/home'],
          ['Pending', '/order-pending'],
          ['Checkout', checkoutPath],
          ['Order History', '/order-history'],
          ['Order detail', detailPath],
          ['Daily Sale', '/incomes/income-daily'],
        ] as const) {
          await step(`${label} (${to})`, async () => {
            await app.routerGoRaw(to);
            if (await passcodeDialog.isPrompting(2_000)) await passcodeDialog.enter(env.OWNER_PASSCODE);
            await app.pause(1_500);
            const keys = (await app.text('body')).match(/\b(global|actions|common)\.[a-zA-Z][\w.]*/g) ?? [];
            if (keys.length) raw.push(`${label}: ${keys.join(', ')}`);
            if (to === checkoutPath) {
              const t = await app.text('main');
              expect(t).toContain(d.service);
              const amounts = [...t.matchAll(/\$[\d,]+\.\d{2}/g)].map((m) =>
                Math.round(Number(m[0].replace(/[$,]/g, '')) * 100),
              );
              for (const a of enTiles) expect(amounts).toContain(a);
              expect(await cust.text()).toMatch(/Cash|Card|Other/);
            }
            if (to === '/home')
              expect(await app.has({ css: CdMain.staffNameCss, text: d.staff, nth: 0 })).toBe(true);
          });
        }
      } finally {
        await setLanguage('en').catch(() => undefined);
      }
      note(raw.length ? `E2E-049 raw keys: ${raw.join(' ; ')}` : 'E2E-049: no raw i18n key');
      expect(raw).toEqual([]);
      await app.openPendingOrder(draft);
      await app.deleteCurrentOrder();
      untrack(draft);
      expect(await cust.waitWelcome()).toBe(true);
    },
  );

  it(
    title(
      'Show Point OFF → customer display shows no earned/current points, yet the points are still booked (POS "Point:" > 0) (E2E-050)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(8 * 60_000);
      const phone = randomPhone();
      let before: { showPoint: boolean; showReward: boolean } | undefined;
      try {
        before = await setCustomerDisplay({ showPoint: false });
        await returnToHome();
        const code = track(await app.createOrder());
        await app.attachNewCustomer(phone, uniqueName('QC E2E'));
        await app.customerConfirmPhone();
        await app.pay();
        await app.selectMethod('Other');
        await app.completePayment('none');
        await app.successText();
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await app.pause(5_000);
        expect(await cust.has({ textRe: "You've earned", nth: 0 })).toBe(false);
        expect(await cust.has(CdCustomer.currentPoints)).toBe(false);
        await app.noReceipt();
        untrack(code);
        const probe = track(await app.createOrder());
        await app.attachExistingCustomer(phone);
        const point = await app.customerPoints();
        await app.deleteCurrentOrder();
        untrack(probe);
        note(`E2E-050: Show Point OFF, POS Point ${String(point)}`);
        expect(point).toBeGreaterThan(0);
      } finally {
        if (before) await setCustomerDisplay(before).catch(() => undefined);
      }
    },
  );
});
