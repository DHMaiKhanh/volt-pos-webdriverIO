/**
 * volt-qc module 11-settings (SET-*) — Business Info and Accessibility, cases
 * that SAVE (and restore) plus the remaining read/draft-only rows.
 *
 * Source: volt-qc `e2e/tests/11-settings/set-plan-settings-business.spec.ts`
 * (SET-T03a, T03b, T05, T09, T10, T12) and the TC rows SET-001, 006, 015, 028,
 * 033 of docs/qc/volt-qc/windows-regression/11-settings.md (no volt-qc test —
 * written from the row).
 *
 * ## Why this file is @exclusive
 *
 * Business Info, Appearance and Customer Display › Show Point are MERCHANT-GLOBAL
 * (Appearance and the virtual keyboard are per-device, but shared by every
 * spec on this till). Each saving case snapshots the original value, writes,
 * asserts, and restores in `finally`; the restore is then asserted.
 * Draft-only cases (SET-015, SET-028) never press a Confirm — they Cancel.
 */

import { browser, expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import {
  AspCard,
  AspIds,
  AspKeyboard,
  AspText,
} from '../../../../src/constants/testids.voltqc-app-rpt-set-perm.js';
import {
  BUSINESS_FIELD_NAMES_VQ,
  Vq,
  VqBusiness,
  VqScope,
  type VqQuery,
} from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { settingsPage } from '../../../../src/pages/index.js';
import StaffsSettingsPage from '../../../../src/pages/settings/StaffsSettingsPage.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import {
  customerIsDark,
  customerText,
  goAnyLang,
  isDark,
  log,
  openAccessibility,
  ownerCode,
  payCashWithNewCustomer,
  qcTag,
  toastShown,
} from '../../../../src/pages/voltqc/app-rpt-set-perm/aspFlows.js';
import {
  cancelBusinessEditIfOpen,
  dismissOverlays,
  openBusinessVq,
} from '../../../../src/pages/voltqc/settings-devm/nav.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const SAVED_TOAST = 'Business info updated successfully';
const city = Vq.named(BUSINESS_FIELD_NAMES_VQ.City);
const postal = Vq.named(BUSINESS_FIELD_NAMES_VQ['Postal / Zip Code']);
const otherPolicies = Vq.labelled('Other Policies', VqScope.main);

async function pressEdit(): Promise<void> {
  await vqProbe.press(VqBusiness.headerButton('Edit'));
  await vqProbe.waitShown(VqBusiness.headerButton('Cancel'), Timeouts.SHORT);
}

async function pressSave(): Promise<void> {
  await vqProbe.press(VqBusiness.headerButton('Save'));
  await toastShown(SAVED_TOAST, Timeouts.API);
  await vqProbe.isShown(VqBusiness.headerButton('Edit'), Timeouts.MEDIUM);
}

/** Re-open Business Info until `read()` satisfies `ok` (sync can lag a few seconds after Save). */
async function waitBusiness(
  read: () => Promise<string>,
  ok: (v: string) => boolean,
  ms = 30_000,
): Promise<string> {
  const end = Date.now() + ms;
  let v = await read();
  while (!ok(v) && Date.now() < end) {
    await settle(2_500);
    await openBusinessVq();
    v = await read();
  }
  return v;
}

/** Edit → set one field → Save (only when the value differs). */
async function saveField(field: VqQuery, value: string): Promise<void> {
  await openBusinessVq();
  if ((await vqProbe.inputValue(field)) === value) return;
  await pressEdit();
  await vqProbe.fill(field, value);
  if (await vqProbe.isDisabled(VqBusiness.headerButton('Save'))) {
    await cancelBusinessEditIfOpen();
    return;
  }
  await pressSave();
}

const virtualKeyboardShown = async (): Promise<boolean> => (await vqProbe.count(AspKeyboard.root)) > 0;

async function setVirtualKeyboard(on: boolean): Promise<void> {
  await openAccessibility();
  await vqProbe.setChecked(AspIds.virtualKeyboard, on);
  await settle(600);
}

/** Press the keyboard's Done (`{enter}`) or Escape, then wait for the drawer to go. */
async function hideKeyboard(): Promise<boolean> {
  if ((await vqProbe.count(AspKeyboard.key('{enter}'))) > 0) await vqProbe.press(AspKeyboard.key('{enter}'));
  else await vqProbe.pressKey('Escape');
  return vqProbe.isGone(AspKeyboard.root, Timeouts.SHORT);
}

const activeInputId = (): Promise<string> =>
  browser.execute(function () {
    const a = document.activeElement;
    return a && a.tagName === 'INPUT' ? a.id : '';
  });

describe('volt-qc SET — Business Info & Accessibility (settings)', () => {
  before(function (this: Mocha.Context): void {
    this.timeout(Timeouts.MOCHA_HOOK);
    assertWritesAllowed('edit Business Info / Accessibility and restore');
  });

  afterEach(async () => {
    await dismissOverlays().catch(() => undefined);
    await cancelBusinessEditIfOpen().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await ensurePasscodeGrant();
    await gateProbe.routerNavigate('/home');
    await settingsPage.confirmLeaveGuardIfShown();
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Settings goes through the "Merchant Settings Page" guard and lands on Business Info; /settings redirects to /settings/business (SET-001, SET-006)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      try {
        await returnToHome();
        if (!(await gateProbe.openGate('/settings'))) {
          log.warn('SET-001: POS Settings gate OFF — guard not checked');
        } else {
          const s = await gateProbe.state();
          expect(s?.heading).toBe(AspText.gateAccess('Merchant Settings Page'));
          expect(s?.filled).toBe(0);
          expect(s?.skipChecked).toBe(false);
          expect((await gateProbe.submit(ownerCode(), { keyboard: true })).result).toBe('allowed');
        }
        await browser.waitUntil(async () => (await gateProbe.path()) === '/settings/business', {
          timeout: Timeouts.NAVIGATION,
          timeoutMsg: '/settings never redirected to /settings/business',
        });
        expect(await vqProbe.isShown(Vq.heading('Business Info'), Timeouts.MEDIUM)).toBe(true);
      } finally {
        await clearPasscodeGrant();
        await ensurePasscodeGrant();
      }
    },
  );

  it(
    title(
      'Business Info: edit City → Save → still there after reopening; City restored (SET-010)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await openBusinessVq();
      const old = await vqProbe.inputValue(city);
      log.info(`SET-010 original City: "${old}"`);
      const nv = `QC City ${qcTag()}`;
      let touched = false;
      try {
        await pressEdit();
        expect(await vqProbe.isDisabled(VqBusiness.headerButton('Save'))).toBe(true);
        await vqProbe.fill(city, nv);
        expect(await vqProbe.isDisabled(VqBusiness.headerButton('Save'))).toBe(false);
        touched = true;
        await pressSave();
        expect(
          await waitBusiness(
            () => vqProbe.inputValue(city),
            (v) => v === nv,
          ),
        ).toBe(nv);
      } finally {
        if (touched) {
          await waitBusiness(
            () => vqProbe.inputValue(city),
            (v) => v !== old,
            10_000,
          );
          await saveField(city, old);
        }
      }
      expect(
        await waitBusiness(
          () => vqProbe.inputValue(city),
          (v) => v === old,
        ),
      ).toBe(old);
    },
  );

  it(
    title(
      'Business Info: Other Policies with surrounding spaces is saved trimmed; restored (SET-032)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await openBusinessVq();
      const old = await vqProbe.inputValue(otherPolicies);
      log.info(`SET-032 original Other Policies: "${old}"`);
      const nv = `QC policy ${qcTag()}`;
      let touched = false;
      try {
        await pressEdit();
        await vqProbe.fill(otherPolicies, `  ${nv}  `);
        touched = true;
        await pressSave();
        expect(
          await waitBusiness(
            () => vqProbe.inputValue(otherPolicies),
            (v) => v.trim() === nv,
          ),
        ).toBe(nv);
      } finally {
        if (touched) await saveField(otherPolicies, old);
      }
      expect(
        await waitBusiness(
          () => vqProbe.inputValue(otherPolicies),
          (v) => v === old,
        ),
      ).toBe(old);
    },
  );

  it(
    title(
      'Work Hours: flip Sunday open/closed → Save; Sunday state and hours restored (SET-019)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      const sw = VqBusiness.daySwitch('sunday');
      const readDay = async (): Promise<{ open: boolean; start: string; end: string }> => ({
        open: await vqProbe.isChecked(sw),
        start:
          (await vqProbe.count(VqBusiness.dayTime('sunday', 0))) > 0
            ? (await vqProbe.inputValue(VqBusiness.dayTime('sunday', 0))).slice(0, 5)
            : '',
        end:
          (await vqProbe.count(VqBusiness.dayTime('sunday', 1))) > 0
            ? (await vqProbe.inputValue(VqBusiness.dayTime('sunday', 1))).slice(0, 5)
            : '',
      });
      await openBusinessVq();
      const orig = await readDay();
      log.info(`SET-019 original Sunday: ${JSON.stringify(orig)}`);
      let touched = false;
      try {
        await pressEdit();
        await vqProbe.press(sw);
        if (!orig.open) {
          await vqProbe.setNative(VqBusiness.dayTime('sunday', 0), '09:00');
          await vqProbe.setNative(VqBusiness.dayTime('sunday', 1), '17:00');
        }
        touched = true;
        await pressSave();
        const now = await waitBusiness(
          async () => String((await readDay()).open),
          (v) => v === String(!orig.open),
        );
        expect(now).toBe(String(!orig.open));
        if (orig.open) expect(await bodyHas('Closed')).toBe(true);
        else expect([(await readDay()).start, (await readDay()).end]).toEqual(['09:00', '17:00']);
      } finally {
        if (touched) {
          await openBusinessVq();
          await pressEdit();
          if ((await vqProbe.isChecked(sw)) !== orig.open) await vqProbe.press(sw);
          if (orig.open && orig.start !== '') {
            await vqProbe.setNative(VqBusiness.dayTime('sunday', 0), orig.start);
            await vqProbe.setNative(VqBusiness.dayTime('sunday', 1), orig.end);
          }
          if (await vqProbe.isDisabled(VqBusiness.headerButton('Save'))) await cancelBusinessEditIfOpen();
          else await pressSave();
        }
      }
      await waitBusiness(
        async () => String((await readDay()).open),
        (v) => v === String(orig.open),
      );
      const back = await readDay();
      expect(back.open).toBe(orig.open);
      if (orig.open) expect([back.start, back.end]).toEqual([orig.start, orig.end]);
    },
  );

  it(
    title(
      'Business Info › Country: picking another country clears State and Save then requires it; Cancel restores (SET-015)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      const country = Vq.labelled('Country', VqScope.main);
      const state = Vq.labelled('State', VqScope.main);
      await openBusinessVq();
      const origCountry = await vqProbe.textOf(country);
      const origState = await vqProbe.textOf(state);
      const target = /United States/.test(origCountry) ? 'Canada' : 'United States';
      try {
        await pressEdit();
        await vqProbe.press(country);
        if ((await vqProbe.count(Vq.placeholder('Search country'))) > 0)
          await vqProbe.fill(Vq.placeholder('Search country'), target);
        await vqProbe.press(Vq.option(target));
        await settle(500);
        const stateNow = await vqProbe.textOf(state);
        expect(stateNow === '' || /Select a state/i.test(stateNow)).toBe(true);
        await vqProbe.press(VqBusiness.headerButton('Save'));
        expect(
          await vqProbe.poll(() => vqProbe.fieldMessage(state), 'State is required', Timeouts.SHORT),
        ).toBe('State is required');
      } finally {
        await cancelBusinessEditIfOpen();
      }
      await openBusinessVq();
      expect(await vqProbe.textOf(country)).toBe(origCountry);
      expect(await vqProbe.textOf(state)).toBe(origState);
    },
  );

  it(
    title(
      'Business Info › Pay Period: change + Save opens the apply dialog; Cancel changes nothing (SET-028)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openBusinessVq();
      const before = await vqProbe.textOf(VqBusiness.currentPlan());
      const types = ['weekly', 'biweekly', 'monthly'] as const;
      try {
        await pressEdit();
        let picked = '';
        for (const t of types) {
          const radio = VqBusiness.payPeriodRadio(t);
          if ((await vqProbe.count(radio)) > 0 && !(await vqProbe.isChecked(radio))) {
            await vqProbe.press(radio);
            picked = t;
            break;
          }
        }
        if (picked === '') this.skip();
        await vqProbe.press(VqBusiness.headerButton('Save'));
        const dlg =
          (await vqProbe.isShown(Vq.alertDialog(), Timeouts.SHORT)) ||
          (await vqProbe.isShown(Vq.anyDialog(), 1_000));
        expect(dlg).toBe(true);
        const text = await vqProbe.bodyText();
        expect(/Apply Pay Period Change|Schedule Pay Period Change/.test(text)).toBe(true);
        if ((await vqProbe.count(Vq.alertButton('Cancel'))) > 0)
          await vqProbe.press(Vq.alertButton('Cancel'));
        else await vqProbe.press(Vq.button('Cancel', VqScope.dialog));
        expect(await toastShown(SAVED_TOAST, 1_500)).toBe(false);
      } finally {
        await dismissOverlays();
        await cancelBusinessEditIfOpen();
      }
      await openBusinessVq();
      expect(await vqProbe.textOf(VqBusiness.currentPlan())).toBe(before);
    },
  );

  it(
    title(
      'Accessibility lists Keyboard Setting → Passcode Setting → Customer Display, with no Appearance card (SET-033)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context): Promise<void> {
      await openAccessibility();
      const titles = await vqProbe.texts(Vq.cardTitles());
      log.info(`SET-033 Accessibility cards: ${titles.join(' | ')}`);
      if (titles.includes('Appearance')) {
        log.warn(
          'SET-033: this build ships the Appearance card (dev build) — the prod-only row does not apply',
        );
        this.skip();
      }
      expect(titles.filter((t) => /Keyboard Setting|Passcode Setting|Customer Display/.test(t))).toEqual([
        'Keyboard Setting',
        'Passcode Setting',
        'Customer Display',
      ]);
    },
  );

  it(
    title(
      'Appearance: switching theme applies at once to both windows, Receipt Preview stays white; restored (SET-034)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK);
      await openAccessibility();
      if ((await vqProbe.count(AspIds.themeDark)) === 0) {
        log.warn('SET-034: no Appearance radios on this build');
        this.skip();
      }
      const origDark = await isDark();
      const target = origDark ? AspIds.themeLight : AspIds.themeDark;
      try {
        await vqProbe.press(target);
        expect(await vqProbe.poll(() => isDark(), !origDark, Timeouts.SHORT)).toBe(!origDark);
        const cust = await customerIsDark();
        if (cust === null) log.warn('SET-034: customer window not reachable — second window not checked');
        else expect(cust).toBe(!origDark);
        if (!origDark) {
          await goAnyLang('/settings/receipt');
          const bg = await browser.execute(function () {
            const el = document.querySelector('div.paper');
            return el ? getComputedStyle(el).backgroundColor : '';
          });
          expect(bg).toMatch(/rgb\(255, 255, 255\)|^$/);
        }
      } finally {
        await openAccessibility();
        await vqProbe.press(origDark ? AspIds.themeDark : AspIds.themeLight);
      }
      expect(await vqProbe.poll(() => isDark(), origDark, Timeouts.SHORT)).toBe(origDark);
    },
  );

  it(
    title(
      'Virtual keyboard: ON/OFF takes effect at once; Postal respects maxLength; Product Tax opens the numeric layout; Done only hides it (SET-035, SET-037, SET-046, SET-168)',
      Tag.REGRESSION,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await openAccessibility();
      const orig = await vqProbe.isChecked(AspIds.virtualKeyboard);
      log.info(`virtual keyboard originally ${orig ? 'ON' : 'OFF'}`);
      try {
        await step('SET-035 ON → keyboard on focus; OFF → none', async () => {
          await setVirtualKeyboard(true);
          await goAnyLang('/settings/staffs');
          await vqProbe.press(Vq.placeholder('Search employee'));
          expect(await vqProbe.isShown(AspKeyboard.root, Timeouts.SHORT)).toBe(true);
          await hideKeyboard();
          await setVirtualKeyboard(false);
          await goAnyLang('/settings/staffs');
          await vqProbe.press(Vq.placeholder('Search employee'));
          await settle(1_000);
          expect(await virtualKeyboardShown()).toBe(false);
        });
        await setVirtualKeyboard(true);
        await step(
          'SET-037 Postal typed on the virtual keyboard stays within maxLength (not saved)',
          async () => {
            await openBusinessVq();
            await pressEdit();
            try {
              await vqProbe.fill(postal, '');
              await vqProbe.press(postal);
              expect(await vqProbe.isShown(AspKeyboard.root, Timeouts.SHORT)).toBe(true);
              for (const d of '1234567') await vqProbe.press(AspKeyboard.key(d));
              const v = await vqProbe.inputValue(postal);
              const err = await vqProbe.fieldMessage(postal);
              log.info(`SET-037 7 virtual keys → "${v}" ${err}`);
              expect(/^\d*$/.test(v)).toBe(true);
              expect(v.length <= 5 || err !== '').toBe(true);
            } finally {
              await hideKeyboard();
              await cancelBusinessEditIfOpen();
            }
          },
        );
        await step('SET-046 Product Tax → numeric layout, Done hides it, focus stays', async () => {
          await goAnyLang('/settings/charge-fee');
          const tax = Vq.labelled('Product Tax', VqScope.main);
          const taxId = (await vqProbe.read(tax, 'id')).attr ?? '';
          await vqProbe.press(tax);
          expect(await vqProbe.isShown(AspKeyboard.root, Timeouts.SHORT)).toBe(true);
          expect(await vqProbe.count(AspKeyboard.numeric)).toBeGreaterThan(0);
          expect(await hideKeyboard()).toBe(true);
          const active = await activeInputId();
          expect(active === '' || active === taxId).toBe(true);
        });
        await step('SET-168 Done on First / Last / Nick Name hides the keyboard, no focus jump', async () => {
          await goAnyLang('/settings/staffs');
          const rows = await StaffsSettingsPage.staffRows();
          if (!rows[0]) throw new Error('No employee listed');
          await StaffsSettingsPage.openStaff(rows[0].name);
          for (const label of ['First Name', 'Last Name', 'Nick Name']) {
            const input = Vq.labelled(label, VqScope.main);
            const ownId = (await vqProbe.read(input, 'id')).attr ?? '';
            await vqProbe.press(input);
            expect(await vqProbe.isShown(AspKeyboard.root, Timeouts.SHORT)).toBe(true);
            expect({ label, hidden: await hideKeyboard() }).toEqual({ label, hidden: true });
            await settle(500);
            expect({ label, reopened: await virtualKeyboardShown() }).toEqual({ label, reopened: false });
            const active = await activeInputId();
            expect({ label, ok: active === '' || active === ownId }).toEqual({ label, ok: true });
          }
          await StaffsSettingsPage.leaveToSection('/settings/accessibility');
        });
      } finally {
        await dismissOverlays();
        await setVirtualKeyboard(orig);
      }
      await openAccessibility();
      expect(await vqProbe.isChecked(AspIds.virtualKeyboard)).toBe(orig);
    },
  );

  it(
    title(
      'Customer Display: Show Point OFF → "Payment complete" shows no points; restored ON (SET-040)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
      Tag.DUAL_WINDOW,
    ),
    async function (this: Mocha.Context): Promise<void> {
      this.timeout(Timeouts.MOCHA_HOOK * 2);
      await openAccessibility();
      await vqProbe.waitShown(AspIds.showPoint, Timeouts.MEDIUM);
      await settle(1_500);
      const orig = await vqProbe.isChecked(AspIds.showPoint);
      if (!orig) {
        log.warn('SET-040: Show Point is already OFF on this merchant — not changed');
        this.skip();
      }
      if ((await customerText()) === null) {
        log.warn('SET-040: customer window not reachable in this lane');
        this.skip();
      }
      let touched = false;
      try {
        await vqProbe.press(AspIds.showPoint);
        touched = true;
        await vqProbe.press(AspCard.save('Customer Display'));
        expect(await toastShown(AspText.customerDisplaySaved, Timeouts.API)).toBe(true);
        const { customerSuccessText } = await payCashWithNewCustomer();
        expect(AspText.pointsOnCustomer.test(customerSuccessText ?? '')).toBe(false);
      } finally {
        if (touched) {
          await openAccessibility();
          await vqProbe.waitShown(AspIds.showPoint, Timeouts.MEDIUM);
          await settle(1_500);
          if (!(await vqProbe.isChecked(AspIds.showPoint))) {
            await vqProbe.press(AspIds.showPoint);
            if (!(await vqProbe.isDisabled(AspCard.save('Customer Display')))) {
              await vqProbe.press(AspCard.save('Customer Display'));
              await toastShown(AspText.customerDisplaySaved, Timeouts.API);
            }
          }
        }
      }
      await openAccessibility();
      await settle(1_500);
      expect(await vqProbe.isChecked(AspIds.showPoint)).toBe(true);
    },
  );
});

async function bodyHas(text: string): Promise<boolean> {
  return browser.execute(function (t: string) {
    return (
      Array.from(document.querySelectorAll('main input')).some((e) => (e as HTMLInputElement).value === t) ||
      (document.querySelector('main')?.textContent ?? '').includes(t)
    );
  }, text);
}
