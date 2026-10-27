/**
 * volt-qc port — 13 CD: the customer tip screen (Other; Card only up to
 * "Present Card", then Close — no card is ever presented).
 *
 * Source: volt-qc `e2e/tests/13-customer-display/cd-plan-tip.spec.ts`
 * (CD-T11a/b, T12, T13a/b, T14a/b, T15a/b, T30) plus CD-039 from the catalogue.
 *
 * Every case that needs the tip screen skips when the merchant does not push one
 * for the tender (tip disabled for Other) — the volt-qc behaviour.
 *
 * CD-077 needs a code that belongs to NO staff: `VOLT_UNKNOWN_CODE` (default
 * 9137, as in volt-qc `flows/perm.ts`).
 */

import { expect } from '@wdio/globals';
import { CdCustomer, CdMain } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { app, type PayMethod } from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, expectCents, note, resetTill, track, untrack, usd } from './cd-e2e.helpers.js';

const UNKNOWN_CODE = (process.env.VOLT_UNKNOWN_CODE ?? '9137').trim();
const pct = (label: string): number => Number(label.replace('%', ''));

async function checkoutToTipScreen(
  method: PayMethod = 'Other',
): Promise<{ code: string; total: number; reached: boolean }> {
  const code = track(await app.createOrder());
  await app.pay();
  const total = await app.methodCents(method);
  await app.selectMethod(method);
  const reached = await app.completeUntilTipScreen();
  return { code, total, reached };
}

/** Quick Pay $0.01 → Other → tip screen (every small % preset rounds to $0.00). */
async function centOrderToTipScreen(): Promise<{ code: string; reached: boolean }> {
  const d = await app.testData();
  await app.quickCheckout();
  await app.pickStaff(d.staff);
  await app.quickPay(1, 'QP Cent');
  const code = track(await app.orderCode());
  await app.pay();
  await app.selectMethod('Other');
  return { code, reached: await app.completeUntilTipScreen() };
}

describe('volt-qc 13 CD — customer tip screen', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'Other with tip on → main waits "Customer is adding a tip."; customer "Add a tip": base, $0.00, presets = round(base × %), Custom Tip, No Tip, Continue disabled, Terms footer (CD-039)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { reached } = await checkoutToTipScreen('Other');
      if (!reached) this.skip();
      const waiting = await app.waitingTipText();
      expect(waiting).toContain('Customer is adding a tip.');
      expect(waiting).toContain('Please wait...');
      const t = await cust.text();
      const base = await cust.tipBaseCents();
      expect(await cust.tipAmountCents()).toBe(0);
      expect(await cust.has(CdCustomer.customTip)).toBe(true);
      expect(await cust.has(CdCustomer.noTip)).toBe(true);
      expect(await cust.isContinueEnabled()).toBe(false);
      expect(t).toMatch(/Terms/);
      expect(t).toMatch(/Privacy Policy/);
      const labels = await cust.tipPresetLabels();
      note(
        `CD-039: base ${Number.isFinite(base) ? usd(base) : 'n/a'}, presets ${labels.join(', ') || '(amount mode)'}`,
      );
      if (Number.isFinite(base)) {
        for (const l of labels) {
          const want = usd(Math.round((base * pct(l)) / 100));
          expect(t).toContain(want);
        }
      }
    },
  );

  it(
    title(
      'No Tip → highlighted, Tip Amount $0.00, Continue → paid with no tip, customer "Payment complete" with the total (CD-041)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { code, total, reached } = await checkoutToTipScreen('Other');
      if (!reached) this.skip();
      expect(await app.waitingTipShown()).toBe(true);
      await cust.click(CdCustomer.noTip);
      expect(await cust.buttonSelected('No Tip')).toBe(true);
      expect(await cust.has({ text: 'Tip Amount: $0.00', nth: 0 })).toBe(true);
      expect(await cust.isContinueEnabled()).toBe(true);
      await cust.click(CdCustomer.continue);
      await app.waitPaymentSuccess();
      const s = await app.successText();
      expect(s).not.toMatch(/Total Tip: \$(?!0\.00)/);
      expect(s).toContain(usd(total));
      expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
      expect(await cust.has({ text: usd(total), nth: 0 })).toBe(true);
      await app.noReceipt();
      untrack(code);
    },
  );

  it(
    title(
      'Custom Tip 500 → "Custom tip on $base", $5.00, Done → Tip Amount $5.00, Custom Tip highlighted → paid with tip $5.00 (CD-042)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { code, reached } = await checkoutToTipScreen('Other');
      if (!reached) this.skip();
      const base = await cust.tipBaseCents();
      await cust.click(CdCustomer.customTip);
      expect(await cust.waitFor(CdCustomer.customTipTitle)).toBe(true);
      if (Number.isFinite(base))
        expect(await cust.textOf(CdCustomer.customTipTitle)).toBe(`Custom tip on ${usd(base)}`);
      await cust.keys('500');
      expect(await cust.has({ text: '$5.00', nth: 0 })).toBe(true);
      await cust.click(CdCustomer.doneLast);
      expect(await cust.waitGone(CdCustomer.customTipTitle)).toBe(true);
      expect(await cust.has({ text: 'Tip Amount: $5.00', nth: 0 })).toBe(true);
      expect(await cust.buttonSelected('Custom Tip')).toBe(true);
      await cust.click(CdCustomer.continue);
      await app.waitPaymentSuccess();
      expect(await app.successText()).toContain('Total Tip: $5.00');
      expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
      await app.noReceipt();
      untrack(code);
    },
  );

  it(
    title(
      'Nothing chosen: Continue disabled, main keeps waiting; Custom tip back discards, C → $0.00, 9×8 caps at $10,000.00 (CD-043, CD-044)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { reached } = await checkoutToTipScreen('Other');
      if (!reached) this.skip();
      await step('CD-044 Continue disabled', async () => {
        expect(await cust.isContinueEnabled()).toBe(false);
        await cust.forceClick(CdCustomer.continue);
        await app.pause(800);
        expect(await cust.has(CdCustomer.addTip)).toBe(true);
        const w = await app.waitingTipText();
        expect(w).toContain('Customer is adding a tip.');
        expect(w).toContain('Please wait...');
        expect(await app.has([CdMain.waitingDialog, { role: 'button', name: 'Cancel', nth: 0 }])).toBe(true);
      });
      await step('CD-043.1 700 then back → Tip Amount unchanged', async () => {
        await cust.click(CdCustomer.customTip);
        expect(await cust.waitFor(CdCustomer.customTipTitle)).toBe(true);
        await cust.keys('700');
        expect(await cust.has({ text: '$7.00', nth: 0 })).toBe(true);
        await cust.customTipBack();
        expect(await cust.waitGone(CdCustomer.customTipTitle)).toBe(true);
        expect(await cust.has({ text: 'Tip Amount: $0.00', nth: 0 })).toBe(true);
      });
      await step('CD-043.2/3 1234 → C → $0.00; 9×8 → $10,000.00', async () => {
        await cust.click(CdCustomer.customTip);
        expect(await cust.waitFor(CdCustomer.customTipTitle)).toBe(true);
        await cust.keys('1234');
        expect(await cust.has({ text: '$12.34', nth: 0 })).toBe(true);
        await cust.keys('C');
        expect(await cust.has({ textRe: '^(\\$0\\.00|Enter Amount)$', nth: 0 })).toBe(true);
        await cust.keys('99999999');
        expect(await cust.has({ text: '$10,000.00', nth: 0 })).toBe(true);
        expect(await cust.backspaceShown()).toBe(true);
        await cust.customTipBack();
        expect(await cust.waitGone(CdCustomer.customTipTitle)).toBe(true);
        expect(await cust.has({ text: 'Tip Amount: $0.00', nth: 0 })).toBe(true);
      });
      await app.cancelWaitingTip();
    },
  );

  it(
    title(
      '$0.01 order: the smallest % preset rounds to $0.00, still enables Continue and settles with no tip (CD-045, PAY-076)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { code, reached } = await centOrderToTipScreen();
      if (!reached) this.skip();
      const labels = (await cust.tipPresetLabels()).sort((x, y) => pct(x) - pct(y));
      const first = labels[0];
      if (first === undefined || pct(first) >= 50) {
        await app.cancelWaitingTip();
        this.skip();
      }
      const label = first ?? '';
      await cust.clickPreset(label);
      expect(await cust.presetSelected(label)).toBe(true);
      expect(await cust.has({ text: 'Tip Amount: $0.00', nth: 0 })).toBe(true);
      expect(await cust.isContinueEnabled()).toBe(true);
      await cust.click(CdCustomer.continue);
      await app.waitPaymentSuccess();
      expect(await app.successText()).not.toMatch(/Total Tip: \$(?!0\.00)/);
      expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
      await app.noReceipt();
      untrack(code);
    },
  );

  it(
    title(
      'Several presets all $0.00: only the tapped one is highlighted (CD-046, PAY-077)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { reached } = await centOrderToTipScreen();
      if (!reached) this.skip();
      const labels = (await cust.tipPresetLabels())
        .sort((x, y) => pct(x) - pct(y))
        .filter((l) => pct(l) < 50);
      if (labels.length < 2) {
        await app.cancelWaitingTip();
        this.skip();
      }
      const second = labels[1] ?? '';
      await cust.clickPreset(second);
      for (const l of labels) expect(await cust.presetSelected(l)).toBe(l === second);
      await app.cancelWaitingTip();
    },
  );

  it(
    title(
      'Cashier Cancel while waiting on the tip: no transaction, still on checkout, customer back to the cart with the phone locked (CD-047)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { reached } = await checkoutToTipScreen('Other');
      if (!reached) this.skip();
      await app.cancelWaitingTip();
      expect(await app.path()).toMatch(/checkout/);
      expect(await app.has(CdMain.completePayment)).toBe(true);
      expect(await app.totalPaidCents()).toBe(0);
      expect(await cust.waitGone(CdCustomer.addTip)).toBe(true);
      expect(await cust.has(CdCustomer.orderDetails)).toBe(true);
      expect(await cust.waitPhoneLocked(true)).toBe(true);
    },
  );

  it(
    title(
      'Card: preset → Continue → Present Card → Close → Complete again goes straight to Present Card carrying the tip (no TC id — volt-qc CD-T14b)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const { reached } = await checkoutToTipScreen('Card');
      if (!reached) this.skip();
      const labels = await cust.tipPresetLabels();
      if (labels.length === 0) {
        await app.cancelWaitingTip();
        this.skip();
      }
      const label = labels.includes('10%') ? '10%' : (labels[0] ?? '');
      await cust.clickPreset(label);
      expect(await cust.presetSelected(label)).toBe(true);
      const amount = await cust.tipAmountCents();
      if (!(await cust.isContinueEnabled())) {
        await app.cancelWaitingTip();
        this.skip(); // signature BEFORE + required — covered by cd-settings CD-052
      }
      await cust.click(CdCustomer.continue);
      if ((await app.closePresentCard()) === 'no-terminal') this.skip();
      const main = await app.text('main');
      expect(main).toContain('Total Paid');
      expect(main).toContain(`| Tip | ${usd(amount)}`);
      await app.click(CdMain.completePayment);
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline && !(await app.has(CdMain.presentCardDialog))) {
        await app.passcodeIfAsked(300);
        await app.pause(300);
      }
      expect(await app.has(CdMain.presentCardDialog)).toBe(true);
      expect(await cust.has(CdCustomer.addTip)).toBe(false);
      expect(await app.text('body')).toContain(`+ ${usd(amount)} Tip`);
      expect(await app.closePresentCard()).toBe('present');
    },
  );

  it(
    title(
      'Cashier tip $5.00 on main → Complete pushes no tip screen, paid with Total Tip $5.00 (CD-049)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const code = track(await app.createOrder());
      await app.pay();
      await app.selectMethod('Other');
      await app.cashierTip('500');
      const t = await cust.waitText((x) => /\| Tip[\s|]*\$5\.00/.test(x));
      expect(t).toMatch(/\| Tip[\s|]*\$5\.00/);
      expect(await app.completeUntilTipScreen()).toBe(false);
      expect(await app.waitingTipShown()).toBe(false);
      expect(await cust.has(CdCustomer.addTip)).toBe(false);
      expect(await app.successText()).toContain('Total Tip: $5.00');
      expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
      await app.noReceipt();
      untrack(code);
    },
  );

  it(
    title(
      'Cashier tip $0 counts as no tip → the Add a tip screen is still pushed (CD-050)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      track(await app.createOrder());
      await app.pay();
      await app.selectMethod('Other');
      await app.cashierTip('0');
      expect(await app.completeUntilTipScreen()).toBe(true);
      expect(await cust.has(CdCustomer.addTip)).toBe(true);
      expect(await app.waitingTipShown()).toBe(true);
      await app.cancelWaitingTip();
    },
  );

  it(
    title(
      'Complete Payment passcode: wrong code / closed dialog leave the customer cart as is; only the right code pushes the tip screen (CD-077)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      track(await app.createOrder());
      await app.pay();
      await app.selectMethod('Other');
      await app.clearPasscodeSkip();
      await app.click(CdMain.completePayment);
      if (!(await app.waitFor(CdMain.passcodeDialog, 4_000))) {
        if (await app.waitingTipShown()) await app.cancelWaitingTip();
        this.skip();
      }
      await step('wrong code → "Failed to verify staff code", customer still on the cart', async () => {
        await app.typeIntoPasscode(UNKNOWN_CODE);
        expect(await app.text('body')).toMatch(/Failed to verify staff code|Invalid staff code/);
        expect(await cust.has(CdCustomer.addTip)).toBe(false);
        expect(await cust.has(CdCustomer.orderDetails)).toBe(true);
      });
      await step('Escape → no waiting dialog, customer unchanged', async () => {
        await app.escape();
        expect(await app.waitGone(CdMain.passcodeDialog)).toBe(true);
        await app.pause(1_500);
        expect(await app.waitingTipShown()).toBe(false);
        expect(await cust.has(CdCustomer.addTip)).toBe(false);
      });
      await step('right code → Add a tip', async () => {
        const reached = await app.completeUntilTipScreen();
        ensure(reached, 'Right passcode must push the tip screen');
        expect(await cust.has(CdCustomer.addTip)).toBe(true);
      });
      await app.cancelWaitingTip();
      expectCents(await app.totalPaidCents(), 0, 'Total Paid after cancel');
    },
  );
});
