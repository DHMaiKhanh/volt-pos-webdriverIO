/**
 * volt-qc port — 13 CD: the customer display under Settings changes (each case
 * restores what it changed in a `finally`).
 *
 * Source: volt-qc `e2e/tests/13-customer-display/cd-plan-settings.spec.ts`
 * (CD-T22, T23, T23b, T24, T27, T28).
 *
 * EXCLUSIVE: theme / language are device-wide and Customer Display, tip methods
 * and the signature rule are merchant-wide — nothing else may run beside these.
 *
 * Adaptations: the Vietnamese runs drive the till by role/structure (the same
 * probe chains match both languages for passcode and tender buttons) instead of
 * volt-qc's bilingual label table; CD-053 needs `VOLT_TEST_GIFT_CARD`.
 */

import { expect } from '@wdio/globals';
import { CdCustomer, CdMain, CdSettings } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { app, masked, randomPhone, uniqueName } from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import {
  customerDisplaySwitch,
  readCustomerDisplay,
  readLanguage,
  readTheme,
  setCustomerDisplay,
  setLanguage,
  setSignatureSettings,
  setTheme,
  setTipMethod,
  themeShipped,
  type CustomerDisplaySettings,
  type LanguageCode,
  type SignatureSettings,
  type Theme,
} from '../../../../src/pages/voltqc/cd-e2e/settingsCd.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, note, resetTill, track, untrack } from './cd-e2e.helpers.js';

const GIFT_CARD = (process.env.VOLT_TEST_GIFT_CARD ?? '').trim();

async function checkinNewCustomer(): Promise<string> {
  const phone = randomPhone();
  track(await app.createOrder());
  await app.attachNewCustomer(phone, uniqueName('QC E2E'));
  await app.customerConfirmPhone();
  expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
  expect(await cust.has({ text: masked(phone), nth: 0 })).toBe(true);
  return phone;
}

/** Complete Payment in any language: answer any passcode, stop at the tip screen or success. */
async function completeAnyLang(): Promise<'tip' | 'success'> {
  await app.click([
    { css: 'main' },
    { role: 'button', nameRe: '^(Complete Payment|Hoàn tất thanh toán)$', nth: 0 },
  ]);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await app.passcodeShown()) {
      await app.passcodeIfAsked(500);
      continue;
    }
    if ((await app.waitingTipShown()) || (await app.has({ role: 'dialog', hasTextRe: 'Khách', nth: -1 }))) {
      if (await cust.waitFor(CdCustomer.addTip, 3_000)) return 'tip';
    }
    if (/payment-success/.test(await app.path())) return 'success';
    await app.pause(400);
  }
  throw new Error('Vietnamese checkout: neither the tip screen nor payment-success appeared.');
}

describe('volt-qc 13 CD — customer display under Settings', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'Dark mode applies to the customer display, Light removes it (CD-073)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      if (!(await themeShipped())) this.skip(); // VP-3800: Appearance card not on this build
      const before: Theme = await readTheme();
      note(`CD-073: original appearance ${before}`);
      try {
        await setTheme('dark');
        expect(await cust.waitDark(true, 10_000)).toBe(true);
        await setTheme('light');
        expect(await cust.waitDark(false, 10_000)).toBe(true);
      } finally {
        await setTheme(before).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'App in Tiếng Việt: the customer display stays English on cart, tip and Payment complete, no raw keys (CD-074)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const d = await app.testData();
      const before: LanguageCode = await readLanguage();
      const enOnly = async (screen: string, labels: string[]): Promise<void> => {
        const t = await cust.text();
        for (const l of labels) ensure(t.includes(l), `${screen}: English label "${l}" missing`);
        expect(await cust.rawI18nKeys()).toEqual([]);
      };
      try {
        await setLanguage('vi');
        await returnToHome();
        expect(await cust.waitWelcome()).toBe(true);
        await app.click({ role: 'button', nameRe: '^(Quick Checkout|Thanh toán nhanh)$', nth: 0 });
        await app.pause(1_200);
        await app.pickStaff(d.staff);
        await app.addService(d.service);
        const code = track(await app.orderCode());
        await cust.waitFor(CdCustomer.orderDetails);
        await enOnly('Cart', [
          'Order Details',
          `Staff: ${d.staff}`,
          'Subtotal',
          'By entering your phone number',
        ]);
        expect(await cust.phoneShown()).toBe(true);
        expect(await cust.text()).toMatch(/\$\d{1,3}(,\d{3})*\.\d{2}/);

        await app.click([{ css: 'main' }, { role: 'button', nameRe: '^(Pay|Thanh toán)$', nth: 0 }]);
        await app.waitPath(/\/checkout/, 15_000);
        await app.click([{ css: 'main' }, { role: 'button', nameRe: '^(Other|Khác) \\$', nth: 0 }]);
        if ((await completeAnyLang()) === 'tip') {
          await enOnly('Add a tip', ['Add a tip', 'Custom Tip', 'No Tip', 'Continue', 'Tip Amount:']);
          await cust.chooseTipAndContinue('none');
        }
        await app.waitPath(/payment-success/, 30_000);
        untrack(code);
        await cust.waitFor(CdCustomer.paymentComplete);
        await enOnly('Payment complete', ['Payment complete', 'No Receipt', 'Text Message', 'Email']);
        await app.click({ role: 'button', nameRe: '^(No Receipt|Không hoá đơn|Không hóa đơn)$', nth: 0 });
        await app.waitPath(/^(?!.*payment-success)/, 15_000);
        expect(await cust.waitWelcome()).toBe(true);
      } finally {
        await setLanguage(before).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'App in Tiếng Việt: Terms / Privacy popups on the customer display carry content and no raw key (CD-075)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      const d = await app.testData();
      const before: LanguageCode = await readLanguage();
      let skip = false;
      try {
        await setLanguage('vi');
        await returnToHome();
        await app.click({ role: 'button', nameRe: '^(Quick Checkout|Thanh toán nhanh)$', nth: 0 });
        await app.pause(1_200);
        await app.pickStaff(d.staff);
        await app.addService(d.service);
        track(await app.orderCode());
        expect(await cust.waitFor(CdCustomer.terms)).toBe(true);
        if (!(await cust.hasClass(CdCustomer.terms, 'text-link'))) {
          skip = true; // no Terms/Privacy content configured for this merchant
        } else {
          for (const [label, heading] of [
            ['Terms', 'Terms Service'],
            ['Privacy Policy', 'Privacy Policy'],
          ] as const) {
            await cust.click({ text: label, nth: 0 });
            expect(await cust.waitFor(CdCustomer.dialog(heading))).toBe(true);
            expect((await cust.textOf(CdCustomer.dialog(heading))).trim().length).toBeGreaterThan(20);
            expect(await cust.rawI18nKeys()).toEqual([]);
            await cust.click(CdCustomer.closeIn(heading));
            expect(await cust.waitGone(CdCustomer.dialog(heading))).toBe(true);
          }
        }
      } finally {
        await setLanguage(before).catch(() => undefined);
      }
      if (skip) this.skip();
    },
  );

  it(
    title(
      'Show Point / Show Reward: unsaved change → "Discard changes and leave?"; Point ON + Reward OFF → points, no reward list; both OFF → no loyalty box (CD-037)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      let before: CustomerDisplaySettings | undefined;
      try {
        await step('dirty form → leave guard → Continue Editing', async () => {
          const original = await readCustomerDisplay();
          await app.click(customerDisplaySwitch('showPoint'));
          expect(await app.isDisabled(CdSettings.customerDisplaySave)).toBe(false);
          await app.routerGoRaw('/home');
          expect(await app.waitFor(CdMain.leaveDialog)).toBe(true);
          expect(
            await app.has([CdMain.leaveDialog, { role: 'button', name: 'Discard & Leave', nth: 0 }]),
          ).toBe(true);
          await app.click([CdMain.leaveDialog, CdMain.continueEditing]);
          expect(await app.waitGone(CdMain.leaveDialog)).toBe(true);
          expect(await app.path()).toMatch(/\/settings\/accessibility/);
          await app.click(customerDisplaySwitch('showPoint'));
          expect(await app.isDisabled(CdSettings.customerDisplaySave)).toBe(true);
          note(
            `CD-037: original Show Point=${String(original.showPoint)} Show Reward=${String(original.showReward)}`,
          );
        });

        before = await setCustomerDisplay({ showPoint: true, showReward: false });

        await step('CD-037.1 Point ON, Reward OFF', async () => {
          await checkinNewCustomer();
          expect(await cust.waitFor(CdCustomer.currentPoints, 30_000)).toBe(true);
          expect(await cust.has(CdCustomer.redeemPointsFor)).toBe(false);
          await app.deleteCurrentOrder();
        });

        await setCustomerDisplay({ showPoint: false, showReward: false });
        await step('CD-037.2 both OFF', async () => {
          await checkinNewCustomer();
          expect(await cust.waitGone(CdCustomer.currentPoints, 30_000)).toBe(true);
          expect(await cust.has(CdCustomer.redeemPointsFor)).toBe(false);
          await app.deleteCurrentOrder();
        });
      } finally {
        if (before) await setCustomerDisplay(before).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Tender without tip (Other tip off) → no tip screen, customer goes straight to Payment complete (CD-051)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      let before: boolean | undefined;
      try {
        before = await setTipMethod('other', false);
        note(`CD-051: Other tip originally ${before ? 'on' : 'off'}`);
        await returnToHome();
        const code = track(await app.createOrder());
        await app.pay();
        await app.selectMethod('Other');
        expect(await app.completeUntilTipScreen()).toBe(false);
        expect(await cust.has(CdCustomer.addTip)).toBe(false);
        await app.successText();
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        await app.noReceipt();
        untrack(code);
      } finally {
        if (before !== undefined) await setTipMethod('other', before).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Card + signature BEFORE required: tip + pad + Clear, Continue only once signed (CD-052)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      let before: SignatureSettings | undefined;
      try {
        before = await setSignatureSettings({ required: true, timing: 'before' });
        await returnToHome();
        const code = track(await app.createOrder());
        await app.pay();
        await app.selectMethod('Card');
        ensure(await app.completeUntilTipScreen(), 'Card + BEFORE must push the tip + signature screen');
        expect(await cust.waitFor(CdCustomer.canvas, 25_000)).toBe(true);
        expect(await cust.has(CdCustomer.clear)).toBe(true);
        const labels = await cust.tipPresetLabels();
        if (labels[0]) await cust.clickPreset(labels[0]);
        else await cust.click(CdCustomer.noTip);
        expect(await cust.isContinueEnabled()).toBe(false);
        await cust.sign();
        expect(await cust.isContinueEnabled()).toBe(true);
        await cust.click(CdCustomer.clear);
        expect(await cust.isContinueEnabled()).toBe(false);
        await cust.sign();
        expect(await cust.isContinueEnabled()).toBe(true);
        await app.cancelWaitingTip(); // never Continue: that is the card charge
        await app.openPendingOrder(code);
      } finally {
        if (before) await setSignatureSettings(before).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Signature BEFORE required: gift-card-only order (no staff) + Card → "Add Signature" only, no tip screen (CD-053)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      if (!GIFT_CARD) this.skip();
      let before: SignatureSettings | undefined;
      try {
        before = await setSignatureSettings({ required: true, timing: 'before' });
        await returnToHome();
        await app.quickCheckout();
        await app.sellGiftCardLine(GIFT_CARD, '$25');
        const code = track(await app.orderCode());
        await app.pay();
        await app.selectMethod('Card');
        await app.click(CdMain.completePayment);
        await app.passcodeIfAsked(4_000);
        expect(await cust.waitFor(CdCustomer.addSignature, 15_000)).toBe(true);
        expect(await cust.has(CdCustomer.pleaseSign)).toBe(true);
        expect(await cust.has(CdCustomer.addTip)).toBe(false);
        expect(await app.waitingTipText()).toContain('Customer is adding signature.');
        await app.cancelWaitingTip();
        await app.openPendingOrder(code);
      } finally {
        if (before) await setSignatureSettings(before).catch(() => undefined);
      }
    },
  );
});
