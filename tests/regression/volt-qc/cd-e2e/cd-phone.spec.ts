/**
 * volt-qc port — 13 CD: phone entry on the customer display, confirmation,
 * check-in, and the lock while main is in checkout / re-open.
 *
 * Source: volt-qc `e2e/tests/13-customer-display/cd-plan-phone.spec.ts`
 * (CD-T07, T08a/b/c, T09, T10, T26, T31) plus CD-025 from the catalogue row.
 *
 * Test customers are created per worker (volt-qc `runState`):
 * - A: has points (one Other order paid);
 * - B: a plain customer (quick-added on a draft that is then deleted).
 *
 * CD-078 needs a passcode of a staff WITHOUT "POS Settings": `VOLT_STAFFROLE_CODE`
 * (same variable volt-qc used) or the case skips.
 */

import { expect } from '@wdio/globals';
import { env } from '../../../../configs/env/loadEnv.js';
import { CdCustomer, CdMain } from '../../../../src/constants/testids.voltqc-cd-e2e.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { app, fmtPhone, masked, randomPhone, uniqueName } from '../../../../src/pages/voltqc/cd-e2e/cdApp.js';
import { cust } from '../../../../src/pages/voltqc/cd-e2e/customerScreen.js';
import { readCustomerDisplay } from '../../../../src/pages/voltqc/cd-e2e/settingsCd.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, note, resetTill, track, untrack } from './cd-e2e.helpers.js';

interface Cust {
  phone: string;
  name: string;
}

const customers: Partial<Record<'A' | 'B', Cust>> = {};

async function ensureCustomer(key: 'A' | 'B'): Promise<Cust> {
  const saved = customers[key];
  if (saved) return saved;
  const c: Cust = { phone: randomPhone(), name: uniqueName('QC E2E') };
  const code = track(await app.createOrder());
  await app.attachNewCustomer(c.phone, c.name);
  await app.customerConfirmPhone();
  expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
  if (key === 'A') {
    await app.payCurrentOrder('Other');
    await app.noReceipt();
  } else {
    await app.deleteCurrentOrder();
  }
  untrack(code);
  customers[key] = c;
  await app.pause(1_200); // keep the next randomPhone()/uniqueName() distinct
  return c;
}

describe('volt-qc 13 CD — phone entry, confirm, check-in, lock', () => {
  before(async () => {
    await returnToHome();
  });

  afterEach(async () => {
    await resetTill();
  });

  it(
    title(
      'Phone block: input, 0-9/C, backspace, Done disabled, consent + Terms + Privacy; Done only at 10 digits, backspace drops one, C clears (CD-022, CD-023)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      track(await app.createOrder());
      await step('CD-022 parts', async () => {
        expect(await cust.waitFor(CdCustomer.phoneInput)).toBe(true);
        expect(await cust.phoneValue()).toBe('');
        for (const k of '0123456789C') expect(await cust.has(CdCustomer.key(k))).toBe(true);
        expect(await cust.backspaceShown()).toBe(true);
        expect(await cust.isDisabled(CdCustomer.done)).toBe(true);
        expect(await cust.has(CdCustomer.agree)).toBe(true);
        expect(await cust.has(CdCustomer.terms)).toBe(true);
        expect(await cust.has(CdCustomer.privacy)).toBe(true);
      });
      await step('CD-023 Done at 10 digits; backspace; C', async () => {
        await cust.keys('555010123');
        expect(await cust.isDisabled(CdCustomer.done)).toBe(true);
        await cust.keys('4');
        expect(await cust.phoneValue()).toBe('(555) 010-1234');
        expect(await cust.isDisabled(CdCustomer.done)).toBe(false);
        await cust.keys('<');
        expect(await cust.isDisabled(CdCustomer.done)).toBe(true);
        expect((await cust.phoneValue()).replace(/\D/g, '')).toBe('555010123');
        await cust.keys('C');
        expect(await cust.phoneValue()).toBe('');
      });
    },
  );

  it(
    title(
      'Customer types an existing phone → Check-in Successful, main attaches them; cashier removes the customer → empty phone box, cart kept (CD-024, CD-034)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const d = await app.testData();
      const b = await ensureCustomer('B');
      track(await app.createOrder());

      await step('CD-024 existing phone from the customer side', async () => {
        await cust.enterPhone(b.phone);
        expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
        expect(await cust.has({ text: masked(b.phone), nth: 0 })).toBe(true);
        expect(await app.waitFor(CdMain.customerBox)).toBe(true);
        const box = await app.customerBoxText();
        expect(box).toContain(b.name);
        expect(box).toContain(masked(b.phone));
      });

      await step('CD-034 main removes the customer', async () => {
        await app.removeCustomer();
        expect(await cust.waitFor(CdCustomer.phoneInput)).toBe(true);
        expect(await cust.phoneValue()).toBe('');
        expect(await cust.has(CdCustomer.checkinSuccessful)).toBe(false);
        expect(await cust.has(CdCustomer.orderDetails)).toBe(true);
        expect(await cust.has(CdCustomer.staffGroup(d.staff))).toBe(true);
        expect(await cust.has({ text: d.service, nth: 0 })).toBe(true);
      });
    },
  );

  it(
    title(
      'Customer types a NEW phone → main opens the quick-add dialog pre-filled; closing it adds no customer (CD-025)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      track(await app.createOrder());
      const p = randomPhone();
      await cust.enterPhone(p);
      expect(await app.waitFor(CdMain.newCustomerDialog)).toBe(true);
      const dlg = await app.text('body');
      expect(dlg).toMatch(
        new RegExp(
          `\\(${p.slice(0, 3)}\\) ${p.slice(3, 6)}-${p.slice(6)}|\\*\\*\\*-\\*\\*\\*-${p.slice(-4)}`,
        ),
      );
      const customerSide = await cust.text();
      note(
        `CD-025: customer display after Done on a new phone: ${customerSide.includes('Check-in Successful') ? 'Check-in Successful' : 'no check-in screen'}`,
      );
      await app.click([CdMain.newCustomerDialog, { role: 'button', nth: 0 }]);
      if (await app.has(CdMain.newCustomerDialog)) await app.escape();
      expect(await app.waitGone(CdMain.newCustomerDialog)).toBe(true);
      expect((await app.has(CdMain.customerBox)) && (await app.customerBoxText()).includes(masked(p))).toBe(
        false,
      );
    },
  );

  it(
    title(
      'Main attaches A → customer "No, enter again" → types B → Check-in B; remove, re-attach A → Yes: "Your current points" = Point on main (CD-031, CD-035)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(6 * 60_000);
      const setting = await readCustomerDisplay();
      if (!setting.showPoint) this.skip();
      const a = await ensureCustomer('A');
      const b = await ensureCustomer('B');
      track(await app.createOrder());

      await step('CD-031 No, enter again → B', async () => {
        await app.attachExistingCustomer(a.phone);
        expect(await cust.waitFor(CdCustomer.isThisYourPhone)).toBe(true);
        await cust.confirm('No, enter again');
        expect(await cust.waitFor(CdCustomer.phoneInput)).toBe(true);
        expect(await cust.phoneValue()).toBe('');
        await cust.enterPhone(b.phone);
        expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
        expect(await cust.has({ text: masked(b.phone), nth: 0 })).toBe(true);
        await app.waitFor([{ css: 'main' }, { css: 'div.bg-turquoise-topaz-20', hasText: b.name, nth: 0 }]);
        const box = await app.customerBoxText();
        expect(box).toContain(b.name);
        expect(box).not.toContain(a.name);
      });

      await step('CD-035 A again → Yes → points match', async () => {
        await app.removeCustomer();
        await app.attachExistingCustomer(a.phone);
        await app.customerConfirmPhone();
        expect(await cust.waitFor(CdCustomer.checkinSuccessful)).toBe(true);
        expect(await cust.has(CdCustomer.currentPoints)).toBe(true);
        const mainPts = await app.customerPoints();
        // volt-qc bug #39: points just earned were not stored → Point: 0 on re-attach.
        expect(mainPts).toBeGreaterThan(0);
        const shown = await cust.currentPoints();
        expect(shown).toBe(mainPts);
      });
    },
  );

  it(
    title(
      'Re-check-in with a new phone on the customer display does not hang the till (CD-032)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const a = await ensureCustomer('A');
      track(await app.createOrder());
      await app.attachExistingCustomer(a.phone);
      await cust.confirm('No, enter again');
      const p = randomPhone();
      await cust.enterPhone(p);
      expect(await app.waitFor(CdMain.newCustomerDialog)).toBe(true);
      expect(await app.text('body')).toMatch(
        new RegExp(
          `\\(${p.slice(0, 3)}\\) ${p.slice(3, 6)}-${p.slice(6)}|\\*\\*\\*-\\*\\*\\*-${p.slice(-4)}`,
        ),
      );
      await app.click([CdMain.newCustomerDialog, { role: 'button', nth: 0 }]);
      if (await app.has(CdMain.newCustomerDialog)) await app.escape();
      expect(await app.waitGone(CdMain.newCustomerDialog)).toBe(true);
      const t0 = Date.now();
      await app.quickCheckout();
      expect(Date.now() - t0).toBeLessThan(30_000);
      expect(await cust.waitWelcome()).toBe(true);
    },
  );

  it(
    title(
      'Main presses Pay → phone block dims (opacity-50, pointer-events-none) and ignores taps; back to Home → cart, unlocked, Card tile lit (CD-027, CD-068)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async () => {
      const code = track(await app.createOrder());
      expect(await cust.waitFor(CdCustomer.phoneInput)).toBe(true);
      expect(await cust.phoneLocked()).toBe(false);
      await step('CD-027 locked in checkout', async () => {
        await app.pay();
        expect(await cust.waitPhoneLocked(true)).toBe(true);
        await cust.forceKeys('58');
        expect(await cust.phoneValue()).toBe('');
      });
      await step('CD-068 back on Home', async () => {
        await app.openPendingOrder(code);
        expect(await cust.waitFor(CdCustomer.orderDetails)).toBe(true);
        expect(await cust.waitPhoneLocked(false)).toBe(true);
        expect(await cust.waitActiveTiles(['card'])).toEqual(['card']);
      });
    },
  );

  it(
    title(
      'Re-opened paid order: phone block locked, no "No, enter again" (CD-028)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      this.timeout(5 * 60_000);
      const phone = randomPhone();
      const code = track(await app.createOrder());
      await app.attachNewCustomer(phone, uniqueName('QC E2E'));
      await app.customerConfirmPhone();
      await app.payCurrentOrder('Other');
      await app.noReceipt();
      untrack(code);

      await app.reopenOrder(code);
      expect(await cust.waitFor(CdCustomer.orderDetails)).toBe(true);
      await app.pause(1_500);
      expect(await cust.has(CdCustomer.noEnterAgain)).toBe(false);
      const inputShown = await cust.phoneShown();
      const confirmShown = await cust.has(CdCustomer.isThisYourPhone);
      const checkinShown = await cust.has(CdCustomer.checkinSuccessful);
      note(
        `CD-028: re-open shows ${inputShown ? 'the phone input' : confirmShown ? 'the confirm screen' : checkinShown ? 'Check-in Successful' : 'unknown'}`,
      );
      if (inputShown) expect(await cust.phoneLocked()).toBe(true);
      if (confirmShown) expect(await cust.has(CdCustomer.yes)).toBe(true);
      await app.reopenDone();
    },
  );

  it(
    title(
      'Terms Service / Privacy Policy dialogs on the customer display open with content and close without clearing the typed digits (CD-026)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.DUAL_WINDOW,
    ),
    async function () {
      track(await app.createOrder());
      expect(await cust.waitFor(CdCustomer.phoneInput)).toBe(true);
      // Plain text (no text-link) = the merchant has no Terms/Privacy content from Portal.
      if (!(await cust.hasClass(CdCustomer.terms, 'text-link'))) this.skip();
      await cust.keys('832');
      for (const [label, heading] of [
        ['Terms', 'Terms Service'],
        ['Privacy Policy', 'Privacy Policy'],
      ] as const) {
        await cust.click({ text: label, nth: 0 });
        expect(await cust.waitFor(CdCustomer.dialog(heading))).toBe(true);
        const body = await cust.textOf(CdCustomer.dialog(heading));
        expect(body.replace(heading, '').trim().length).toBeGreaterThan(20);
        await cust.click(CdCustomer.closeIn(heading));
        expect(await cust.waitGone(CdCustomer.dialog(heading))).toBe(true);
        expect(await cust.phoneValue()).toContain('832');
      }
      await cust.keys('C');
    },
  );

  it(
    title(
      'Settings › Accessibility (Customer Display: Show Point / Show Reward) is denied to a staff without POS Settings, open with the right code (CD-078)',
      Tag.REGRESSION,
    ),
    async function () {
      const staffRole = (process.env.VOLT_STAFFROLE_CODE ?? '').trim();
      if (!staffRole) this.skip();
      const denied = await app.tryGate('/settings/accessibility', staffRole);
      if (denied === 'no-gate') this.skip();
      expect(denied).toBe('denied');
      await app.go('/home', { passcode: false });
      expect(await app.tryGate('/settings/accessibility', env.OWNER_PASSCODE)).toBe('allowed');
      expect(await app.waitFor({ text: 'Customer Display', nth: 0 })).toBe(true);
      expect(await app.has({ text: 'Show Point', nth: 0 })).toBe(true);
      expect(await app.has({ text: 'Show Reward', nth: 0 })).toBe(true);
      ensure(fmtPhone('5550101234') === '(555) 010-1234', 'phone mask helper');
    },
  );
});
