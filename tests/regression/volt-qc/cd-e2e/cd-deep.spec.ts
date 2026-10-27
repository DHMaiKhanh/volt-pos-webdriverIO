/**
 * volt-qc port — 13 CD deep: the customer display step by step through one
 * order, Tax only at checkout, gift card + Service Fee, tip choice kept when the
 * tip screen comes back, Show Point / Show Reward independence.
 *
 * Source: volt-qc `e2e/tests/13-customer-display/cd-deep.spec.ts` (CD-D01..D05).
 *
 * Adaptations: volt-qc compared against a fee model; here the customer must
 * equal the main window for the same state (Subtotal, Tax, tender buttons) —
 * which is what "mirrors" means in CD-014 / CD-015. PAY-091's SF formula is not
 * re-derived, so D02 claims CD-015 only.
 *
 * Data: D02 needs `VOLT_TEST_GIFT_CARD`; D03 needs a connected terminal (Card
 * keeps Complete Payment disabled otherwise) but never presents a card; D04
 * needs `VOLT_REWARD_PHONE` (a customer with a redeemable reward).
 */

import { expect } from '@wdio/globals';
import { CdCustomer, CdMain } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import {
  app,
  field,
  fmtPhone,
  masked,
  moneyField,
  randomPhone,
  uniqueName,
} from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import {
  setCustomerDisplay,
  setSignatureSettings,
  type CustomerDisplaySettings,
  type SignatureSettings,
} from '../../../../src/pages/voltqc/cd-e2e/settingsCd.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { parseMoney } from '../../../../src/utils/money.js';
import { ensure, expectCents, note, resetTill, track, untrack, usd } from './cd-e2e.helpers.js';

const GIFT_CARD = (process.env.VOLT_TEST_GIFT_CARD ?? '').trim();
const REWARD_PHONE = (process.env.VOLT_REWARD_PHONE ?? '').trim();

const taxLines = (t: string): number => (t.match(/\| Tax \|/g) ?? []).length;

/** At Home: customer Subtotal = main, no Tax line on the customer, Card tile = Home Total. */
async function expectHomeMirror(label: string): Promise<void> {
  const main = await app.orderTotals();
  const t = await cust.waitText((x) => moneyField(x, 'Subtotal') === main.subtotal, 5_000);
  expectCents(moneyField(t, 'Subtotal'), main.subtotal, `${label}: customer Subtotal`, 0);
  expect(taxLines(t)).toBe(0);
  expectCents(await cust.tileCents('card'), main.total, `${label}: Card tile = Home Total`);
}

describe('volt-qc 13 CD deep — the customer display through one order', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'Cart step by step (service, + Quick Pay, item −10%) mirrors main with NO Tax line at Home; checkout Card then Cash → exactly one Tax line = main Tax; back to Home → Tax gone (CD-014)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const d = await app.testData();
      const code = track(await app.createOrder());
      if ((await app.orderTotals()).tax <= 0) this.skip(); // CD-014 needs a merchant with tax

      await step('1 service', async () => {
        expect(await cust.waitFor(CdCustomer.orderDetails)).toBe(true);
        expect(await cust.has(CdCustomer.staffGroup(d.staff))).toBe(true);
        await expectHomeMirror('1 service');
      });
      await step('+ Quick Pay $20.00', async () => {
        await app.quickPay(2000, 'QC QP CD');
        expect(await cust.waitFor({ text: 'QC QP CD', nth: 0 }, 5_000)).toBe(true);
        await expectHomeMirror('+ Quick Pay');
      });
      await step('item −10%', async () => {
        await app.itemDiscount(d.service, '%', 10);
        expect(await cust.waitFor({ text: '10% OFF', nth: 0 }, 5_000)).toBe(true);
        await expectHomeMirror('item −10%');
        const mainDisc = moneyField(await app.text('main'), 'Item Discount');
        const cdDisc = moneyField((await cust.text()).replace(/\|\s*-\s*\$/g, '| $'), 'Item Discount');
        if (Number.isFinite(mainDisc))
          expectCents(Math.abs(cdDisc), Math.abs(mainDisc), 'Item Discount customer = main');
      });
      for (const m of ['Card', 'Cash'] as const) {
        await step(`checkout ${m}: one Tax line = main Tax`, async () => {
          if (m === 'Card') await app.pay();
          else await app.selectMethod('Cash');
          const mainTax = moneyField(await app.text('main'), 'Tax');
          const t = await cust.waitText((x) => moneyField(x, 'Tax') === mainTax, 5_000);
          expectCents(moneyField(t, 'Tax'), mainTax, `${m}: customer Tax`, 0);
          expect(taxLines(t)).toBe(1);
        });
      }
      await step('back to Home: Tax gone', async () => {
        await app.openPendingOrder(code);
        const t = await cust.waitText((x) => taxLines(x) === 0, 5_000);
        expect(taxLines(t)).toBe(0);
        await expectHomeMirror('back on Home');
      });
    },
  );

  it(
    title(
      'Quick Pay $100 + gift-card line $50: customer Subtotal/Tax/tiles = main on Card, Cash, Other; the gift-card line stays $50.00 (no SF/CD on it) (CD-015)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      if (!GIFT_CARD) this.skip();
      const d = await app.testData();
      await app.quickCheckout();
      await app.pickStaff(d.staff);
      track(await app.orderCode());
      await app.quickPay(10_000, 'QC QP 100');
      await app.sellGiftCardLine(GIFT_CARD, '$50');
      const gcRe = new RegExp(`Gift Card \\[[^\\]]*${GIFT_CARD.slice(-4)}\\] \\| (\\$[\\d,.]+)`);
      await step('Home', async () => {
        const t = await cust.waitText((x) => /Gift Card \[/.test(x));
        expect(t).toMatch(/Gift Card \[/);
        const main = await app.orderTotals();
        expectCents(moneyField(t, 'Subtotal'), main.subtotal, 'Subtotal', 0);
        expectCents(await cust.tileCents('card'), main.total, 'Card tile');
      });
      await app.pay();
      for (const m of ['Card', 'Cash', 'Other'] as const) {
        await step(`${m}: customer = main`, async () => {
          await app.selectMethod(m);
          const mt = await app.text('main');
          const t = await cust.waitText(
            (x) => moneyField(x, 'Subtotal') === moneyField(mt, 'Subtotal'),
            5_000,
          );
          expectCents(moneyField(t, 'Subtotal'), moneyField(mt, 'Subtotal'), `${m}: Subtotal`, 0);
          if (Number.isFinite(moneyField(mt, 'Tax')))
            expectCents(moneyField(t, 'Tax'), moneyField(mt, 'Tax'), `${m}: Tax`, 0);
          for (const [k, id] of [
            ['Card', 'card'],
            ['Cash', 'cash'],
            ['Other', 'other'],
          ] as const) {
            expectCents(await cust.tileCents(id), await app.methodCents(k), `${m}: ${k} tile`);
          }
          const line = gcRe.exec(t)?.[1];
          note(`CD-015 ${m}: gift card line on the customer ${line ?? '?'}`);
          expect(line ? parseMoney(line) : NaN).toBe(5000);
        });
      }
    },
  );

  it(
    title(
      'Card + signature BEFORE (not required): preset → Present Card → Close → Complete again: the tip screen comes back with the same preset and Tip Amount; Custom $3.21 is kept the same way (CD-048)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      let before: SignatureSettings | undefined;
      try {
        before = await setSignatureSettings({ required: false, timing: 'before' });
        await returnToHome();
        track(await app.createOrder());
        await app.pay();
        await app.selectMethod('Card');
        if (await app.isDisabled(CdMain.completePayment)) this.skip(); // terminal not connected
        let preset = { label: '', amount: NaN };

        await step('1st: preset → Continue → Present Card → Close', async () => {
          ensure(await app.completeUntilTipScreen(), 'Card + BEFORE must push the tip screen');
          const labels = await cust.tipPresetLabels();
          const last = labels[labels.length - 1];
          if (!last) {
            await app.cancelWaitingTip();
            this.skip();
          }
          await cust.clickPreset(last ?? '');
          preset = { label: last ?? '', amount: await cust.tipAmountCents() };
          expect(await cust.isContinueEnabled()).toBe(true);
          await cust.click(CdCustomer.continue);
          expect(await app.closePresentCard()).toBe('present');
          expect(await app.text('main')).toContain(`| Tip | ${usd(preset.amount)}`);
        });

        await step('2nd: same preset lit, same Tip Amount, Custom/No Tip off', async () => {
          ensure(await app.completeUntilTipScreen(), 'tip screen must come back');
          expect(await cust.presetSelected(preset.label)).toBe(true);
          expect(await cust.tipAmountCents()).toBe(preset.amount);
          expect(await cust.buttonSelected('Custom Tip')).toBe(false);
          expect(await cust.buttonSelected('No Tip')).toBe(false);
          expect(await cust.isContinueEnabled()).toBe(true);
        });

        await step('Custom $3.21 → Present Card → Close → back: Custom Tip lit, $3.21', async () => {
          await cust.customTip('321', { cont: false });
          expect(await cust.has({ text: 'Tip Amount: $3.21', nth: 0 })).toBe(true);
          await cust.click(CdCustomer.continue);
          expect(await app.closePresentCard()).toBe('present');
          expect(await app.text('main')).toContain('| Tip | $3.21');
          ensure(await app.completeUntilTipScreen(), 'tip screen must come back');
          expect(await cust.buttonSelected('Custom Tip')).toBe(true);
          expect(await cust.tipAmountCents()).toBe(321);
          for (const l of await cust.tipPresetLabels()) expect(await cust.presetSelected(l)).toBe(false);
          await app.cancelWaitingTip();
        });
      } finally {
        if (before) await setSignatureSettings(before).catch(() => undefined);
      }
    },
  );

  it(
    title(
      'Show Point OFF + Show Reward ON: Check-in Successful hides "Your current points" while "Redeem your points for" still lists rewards (CD-036)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      if (!REWARD_PHONE) this.skip();
      let before: CustomerDisplaySettings | undefined;
      let noReward = false;
      try {
        before = await setCustomerDisplay({ showPoint: false, showReward: true });
        await returnToHome();
        track(await app.createOrder());
        await app.attachExistingCustomer(REWARD_PHONE);
        await app.customerConfirmPhone();
        expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
        expect(await cust.waitGone(CdCustomer.currentPoints, 30_000)).toBe(true);
        await app.click(CdMain.promoRewards);
        await app.waitFor(CdMain.promoDialog);
        if (!(await cust.waitFor(CdCustomer.redeemPointsFor, 8_000))) {
          noReward = true;
        } else {
          expect(await cust.has({ textRe: '^(\\d+(\\.\\d+)?% OFF|\\$[\\d.,]+ OFF)$', nth: 0 })).toBe(true);
          expect(await cust.has(CdCustomer.currentPoints)).toBe(false);
        }
        await app.closeStrayDialogs();
      } finally {
        if (before) await setCustomerDisplay(before).catch(() => undefined);
      }
      if (noReward) this.skip(); // VOLT_REWARD_PHONE has no redeemable reward right now
    },
  );

  it(
    title(
      'One order on the customer display: "Hello there! / Is this your phone number?" → Check-in (points = main) → Other tile → presets/Custom/No Tip one-at-a-time → Payment complete = Other + tip with points → customer No Receipt → Welcome; Order History agrees (CD-029, CD-030, CD-040, CD-062)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const phone = randomPhone();
      const code = track(await app.createOrder());

      await step('cart', async () => {
        expect(await cust.waitFor(CdCustomer.orderDetails)).toBe(true);
        expect(await cust.phoneShown()).toBe(true);
        const main = await app.orderTotals();
        expectCents(
          moneyField(
            await cust.waitText((x) => moneyField(x, 'Subtotal') === main.subtotal, 5_000),
            'Subtotal',
          ),
          main.subtotal,
          'Subtotal',
          0,
        );
      });

      await step('CD-029 main attaches a customer → confirm screen', async () => {
        await app.attachNewCustomer(phone, uniqueName('QC E2E'));
        expect(await cust.waitFor(CdCustomer.helloThere)).toBe(true);
        expect(await cust.has(CdCustomer.isThisYourPhone)).toBe(true);
        expect(await cust.has({ text: fmtPhone(phone), nth: 0 })).toBe(true);
        expect(await cust.has(CdCustomer.noEnterAgain)).toBe(true);
        expect(await cust.has(CdCustomer.yes)).toBe(true);
      });

      await step('CD-030 Yes → Check-in Successful, points = main', async () => {
        await app.customerConfirmPhone();
        expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
        expect(await cust.has({ text: masked(phone), nth: 0 })).toBe(true);
        if (await cust.has(CdCustomer.currentPoints))
          expect(await cust.currentPoints()).toBe(await app.customerPoints());
        else note('CD-030: Show Point OFF — no "Your current points"');
      });

      let due = NaN;
      await step('Other tile lit, amount = Other button', async () => {
        await app.pay();
        await app.selectMethod('Other');
        expect(await cust.waitActiveTiles(['other'], 3_000)).toEqual(['other']);
        due = await app.methodCents('Other');
        expectCents(await cust.tileCents('other'), due, 'Other tile');
      });

      let tip = NaN;
      await step('tip screen: one choice lit at a time', async () => {
        if (!(await app.completeUntilTipScreen())) this.skip();
        const labels = await cust.tipPresetLabels();
        const first = labels[0];
        const last = labels[labels.length - 1];
        if (!first || !last) {
          await app.cancelWaitingTip();
          this.skip();
        }
        const base = await cust.tipBaseCents();
        await cust.clickPreset(first ?? '');
        if (Number.isFinite(base))
          expect(await cust.tipAmountCents()).toBe(
            Math.round((base * Number((first ?? '0').replace('%', ''))) / 100),
          );
        let lit = 0;
        for (const l of labels) if (await cust.presetSelected(l)) lit += 1;
        expect(lit).toBe(1);
        expect(await cust.isContinueEnabled()).toBe(true);

        await cust.customTip('456', { cont: false });
        expect(await cust.has({ text: 'Tip Amount: $4.56', nth: 0 })).toBe(true);
        expect(await cust.buttonSelected('Custom Tip')).toBe(true);
        for (const l of labels) expect(await cust.presetSelected(l)).toBe(false);

        await cust.click(CdCustomer.noTip);
        expect(await cust.has({ text: 'Tip Amount: $0.00', nth: 0 })).toBe(true);
        expect(await cust.buttonSelected('No Tip')).toBe(true);
        expect(await cust.buttonSelected('Custom Tip')).toBe(false);

        await cust.clickPreset(last ?? '');
        expect(await cust.buttonSelected('No Tip')).toBe(false);
        expect(await cust.buttonSelected('Custom Tip')).toBe(false);
        tip = await cust.tipAmountCents();
        await cust.click(CdCustomer.continue);
        await app.waitPaymentSuccess();
      });

      let big = NaN;
      await step('CD-040 Payment Successful = Other + tip; customer same figure + points', async () => {
        const s = await app.successText();
        const m = /Payment Successful! \| (\$[\d,.]+)/.exec(s);
        big = m?.[1] ? parseMoney(m[1]) : NaN;
        expectCents(big, due + tip, 'Payment Successful amount');
        if (tip > 0) expect(s).toContain(`Total Tip: ${usd(tip)}`);
        expect(await cust.waitFor(CdCustomer.paymentComplete)).toBe(true);
        expect(await cust.has({ text: usd(big), nth: 0 })).toBe(true);
        expect(await cust.earnedPoints()).toBeGreaterThan(0);
      });

      await step('CD-062 customer No Receipt → /order-pending, Welcome', async () => {
        await cust.click(CdCustomer.noReceipt);
        expect(await app.waitPath(/\/order-pending/, 15_000)).toBe(true);
        expect(await cust.waitWelcome()).toBe(true);
        untrack(code);
      });

      await step('Order History agrees', async () => {
        await app.openHistoryOrder(code);
        const dump = await app.historyDetail(code);
        expect(field(dump, 'Status')).toBe('Successful - Unsettled');
        expectCents(moneyField(dump, 'Total'), big, 'history Total');
        expect(dump).toContain(phone.slice(-4));
        if (tip > 0) expect(field(dump, 'Tip')).toBe(usd(tip));
      });
    },
  );
});
