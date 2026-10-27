/**
 * volt-qc port — 11-settings: the settings rail, the Business Info passcode
 * gate and the Business Info form (view mode, Edit + Cancel validation, work
 * hours, pay period).
 *
 * Source: volt-qc `e2e/tests/11-settings/set-plan-readonly-business.spec.ts`
 * (`@readonly` cases only). TC definitions:
 * docs/qc/volt-qc/windows-regression/11-settings.md.
 *
 * ## Read-only
 *
 * Business Info is merchant-GLOBAL config. No case presses Save: every edit is
 * made in Edit mode and thrown away with the header Cancel (or the leave
 * guard's Confirm), then read back to prove nothing stuck. The `after` hook
 * cancels a form a failed case left in Edit mode.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { appNav, passcodeDialog } from '../../../../src/components/index.js';
import { Routes } from '../../../../src/constants/routes.js';
import {
  BUSINESS_FIELD_NAMES_VQ,
  SETTINGS_NAV_VQ,
  Vq,
  VqBusiness,
  VqScope,
  WEEKDAYS_VQ,
  type VqBusinessField,
  type VqDay,
  type VqQuery,
} from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import businessInfoPage from '../../../../src/pages/settings/BusinessInfoPage.js';
import {
  cancelBusinessEditIfOpen,
  goRail,
  openBusinessVq,
  pressRailLink,
} from '../../../../src/pages/voltqc/settings-devm/nav.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const SAVED_TOAST = 'Business info updated successfully';

const field = (label: VqBusinessField): VqQuery => Vq.named(BUSINESS_FIELD_NAMES_VQ[label]);

async function readFields(labels: readonly VqBusinessField[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const label of labels) out[label] = await vqProbe.inputValue(field(label));
  return out;
}

async function pressEdit(): Promise<void> {
  await vqProbe.press(VqBusiness.headerButton('Edit'));
  await vqProbe.waitShown(VqBusiness.headerButton('Cancel'), Timeouts.SHORT);
}

async function pressCancel(): Promise<void> {
  await cancelBusinessEditIfOpen();
}

/** The validation message under a field, polled until it equals `expected` (or times out). */
async function messageOf(label: VqBusinessField, expected: string): Promise<string> {
  return vqProbe.poll(() => vqProbe.fieldMessage(field(label)), expected, Timeouts.ANIMATION * 4);
}

describe('volt-qc SET — settings rail & Business Info (read-only)', () => {
  before(async () => {
    await openBusinessVq();
  });

  afterEach(async () => {
    await vqProbe.pressKey('Escape').catch(() => undefined);
    await cancelBusinessEditIfOpen().catch(() => undefined);
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await cancelBusinessEditIfOpen().catch(() => undefined);
    await ensurePasscodeGrant();
  });

  /* ------------------------------------------------------------------ *
   * Settings rail
   * ------------------------------------------------------------------ */

  it(
    title(
      'Settings rail: groups and links in order, the other 9 screens open without a passcode, footer shows Version / Device ID (SET-002, SET-003, SET-007)',
      Tag.REGRESSION,
    ),
    async () => {
      await openBusinessVq();
      expect(await vqProbe.isShown(Vq.heading('Setting', VqScope.rail))).toBe(true);

      await step('Rail lists every group and link, in order, and nothing extra', async () => {
        const railText = await vqProbe.textOf(Vq.rail());
        let at = -1;
        for (const label of SETTINGS_NAV_VQ.flatMap((g) => [g.group, ...g.links.map((l) => l.label)])) {
          const index = railText.indexOf(label, at + 1);
          expect({ label, inOrder: index > at }).toEqual({ label, inOrder: true });
          if (index > at) at = index;
        }
        expect(await vqProbe.count(Vq.railLinks())).toBe(10);
        const labels = await vqProbe.texts(Vq.railLinks());
        expect(labels.filter((l) => /Payment Gateway|Demo Mode|Supply Share/.test(l))).toEqual([]);
        expect(labels.filter((l) => l === 'Tip')).toEqual([]);
      });

      await step(
        'Each other screen opens with no passcode, its link active and its heading shown',
        async () => {
          for (const link of SETTINGS_NAV_VQ.flatMap((g) => g.links).filter(
            (l) => l.path !== Routes.SETTINGS_BUSINESS,
          )) {
            await goRail(link.label, link.path);
            expect({
              link: link.label,
              prompted: await passcodeDialog.isPrompting(Timeouts.ANIMATION * 2),
            }).toEqual({
              link: link.label,
              prompted: false,
            });
            const current = await vqProbe.read(Vq.railLink(link.label), 'aria-current');
            const status = await vqProbe.read(Vq.railLink(link.label), 'data-status');
            expect({ link: link.label, active: current.attr === 'page' || status.attr === 'active' }).toEqual(
              {
                link: link.label,
                active: true,
              },
            );
            expect({
              link: link.label,
              heading: await vqProbe.isShown(Vq.heading(link.heading), Timeouts.MEDIUM),
            }).toEqual({
              link: link.label,
              heading: true,
            });
          }
        },
      );

      await step('Rail footer carries Version and Device ID', async () => {
        expect(await vqProbe.isShown(Vq.textMatching('^Version: \\d+\\.\\d+\\.\\d+', VqScope.rail))).toBe(
          true,
        );
        expect(await vqProbe.isShown(Vq.textContaining('Device ID:', VqScope.rail))).toBe(true);
      });
    },
  );

  /* ------------------------------------------------------------------ *
   * Business Info passcode gate
   * ------------------------------------------------------------------ */

  it(
    title(
      'Business Info gate: X / Escape cancel without rendering the form; passing without the skip tick asks again on return (SET-004, SET-005)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await step('Leave settings and drop the 30-minute grant', async () => {
        await returnToHome();
        await clearPasscodeGrant();
      });
      try {
        await appNav.openSidebarLink(Routes.SETTINGS_BUSINESS);
        if (!(await passcodeDialog.isPrompting(Timeouts.MEDIUM))) {
          this.skip(); // POS Settings gate is OFF on this merchant (Accessibility › Passcode Setting).
        }
        expect(await vqProbe.isShown(Vq.text('Enter staff code to access Merchant Settings Page'))).toBe(
          true,
        );

        await step('X closes the gate: back outside settings, no Business Info field', async () => {
          await vqProbe.press(Vq.dialogClose('Enter staff code to access Merchant Settings Page'));
          expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION * 2)).toBe(false);
          expect(await vqProbe.path()).not.toMatch(/\/settings\/business/);
          expect(await vqProbe.count(field('City'))).toBe(0);
        });

        await step('Escape closes the gate the same way', async () => {
          await appNav.openSidebarLink(Routes.SETTINGS_BUSINESS);
          expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(true);
          await vqProbe.pressKey('Escape');
          expect(await passcodeDialog.isPrompting(Timeouts.ANIMATION * 2)).toBe(false);
          expect(await vqProbe.path()).not.toMatch(/\/settings\/business/);
          expect(await vqProbe.count(field('City'))).toBe(0);
        });

        await step(
          'Pass the gate WITHOUT the skip tick, go to Language and back: it asks again',
          async () => {
            await appNav.openSidebarLink(Routes.SETTINGS_BUSINESS);
            await passcodeDialog.enter(env.OWNER_PASSCODE);
            await businessInfoPage.waitForForm();
            await goRail('Language', Routes.SETTINGS_LANGUAGE);
            await pressRailLink('Business Info');
            expect(await passcodeDialog.isPrompting(Timeouts.MEDIUM)).toBe(true);
            expect(await vqProbe.isShown(Vq.text('Enter staff code to access Merchant Settings Page'))).toBe(
              true,
            );
            expect(await vqProbe.count(field('City'))).toBe(0);
            await vqProbe.pressKey('Escape');
          },
        );
      } finally {
        await returnToHome().catch(() => undefined);
        await ensurePasscodeGrant();
        await openBusinessVq();
      }
    },
  );

  /* ------------------------------------------------------------------ *
   * View mode
   * ------------------------------------------------------------------ */

  it(
    title(
      'Business Info view mode: only Edit in the header, the form is not focusable, Store Brand and Store Policies render (SET-008, SET-031)',
      Tag.REGRESSION,
    ),
    async () => {
      await openBusinessVq();

      expect(await vqProbe.isShown(VqBusiness.headerButton('Edit'))).toBe(true);
      expect(await vqProbe.count(VqBusiness.headerButton('Save'))).toBe(0);
      expect(await vqProbe.count(VqBusiness.headerButton('Cancel'))).toBe(0);
      for (const label of Object.keys(BUSINESS_FIELD_NAMES_VQ) as VqBusinessField[]) {
        expect({ label, shown: (await vqProbe.count(field(label))) > 0 }).toEqual({ label, shown: true });
      }
      for (const label of ['Country', 'State']) {
        expect({ label, shown: await vqProbe.isShown(Vq.text(label, VqScope.main)) }).toEqual({
          label,
          shown: true,
        });
      }

      await step('The form is read-only: City takes no focus', async () => {
        expect((await vqProbe.read(VqBusiness.readonlyContainer(), 'data-readonly')).attr).toBe('true');
        expect((await vqProbe.read(field('City'))).pointerEvents).toBe('none');
        await vqProbe.press(field('City'), Timeouts.SHORT).catch(() => undefined);
        expect((await vqProbe.read(field('City'))).focused).toBe(false);
      });

      await step('Store Brand: Store Logo and Cover Photo with Add Image or a preview', async () => {
        expect(await vqProbe.isShown(Vq.text('Store Logo', VqScope.main))).toBe(true);
        expect(await vqProbe.isShown(Vq.text('Cover Photo', VqScope.main))).toBe(true);
        const slots =
          (await vqProbe.count(Vq.text('Add Image', VqScope.main))) +
          (await vqProbe.count(VqBusiness.previewImages()));
        expect(slots).toBeGreaterThanOrEqual(2);
      });

      await step('Store Policies: description and three policy fields', async () => {
        expect(
          await vqProbe.isShown(Vq.textContaining('You can add your liability policies here', VqScope.main)),
        ).toBe(true);
        for (const label of ['Liability Policies', 'Cancellation Policies', 'Other Policies']) {
          expect({ label, shown: await vqProbe.isShown(Vq.text(label, VqScope.main)) }).toEqual({
            label,
            shown: true,
          });
        }
        expect(await vqProbe.count(Vq.placeholder('Enter your policies'))).toBe(3);
      });
    },
  );

  /* ------------------------------------------------------------------ *
   * Edit mode — validate, never save
   * ------------------------------------------------------------------ */

  it(
    title(
      'Edit: Business Name / Legal Name / phone stay locked, the rest are editable, Cancel restores them (SET-009)',
      Tag.REGRESSION,
    ),
    async () => {
      await openBusinessVq();
      const editable: VqBusinessField[] = ['Website', 'Address', 'City', 'Postal / Zip Code'];
      const original = await readFields(editable);

      await pressEdit();
      try {
        for (const label of ['Business Name', 'Legal Name', 'Business phone'] as VqBusinessField[]) {
          expect({ label, disabled: await vqProbe.isDisabled(field(label)) }).toEqual({
            label,
            disabled: true,
          });
        }
        const phone = await vqProbe.inputValue(field('Business phone'));
        if (phone !== '') {
          expect(phone).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
          expect(phone).not.toContain('((');
        }
        for (const label of editable) {
          expect({ label, disabled: await vqProbe.isDisabled(field(label)) }).toEqual({
            label,
            disabled: false,
          });
          const typed =
            label === 'Postal / Zip Code' ? '12345' : label === 'Website' ? 'https://qc-e2e.test' : 'QC Tmp';
          await vqProbe.fill(field(label), typed);
          expect({ label, value: await vqProbe.inputValue(field(label)) }).toEqual({ label, value: typed });
        }
      } finally {
        await pressCancel();
      }

      expect(await readFields(editable)).toEqual(original);
      expect(await vqProbe.count(Vq.toast(SAVED_TOAST))).toBe(0);
    },
  );

  it(
    title(
      'Edit validation (no Save): Address, City, Postal code and Website messages; Cancel restores (SET-011, SET-012, SET-013, SET-014)',
      Tag.REGRESSION,
    ),
    async () => {
      await openBusinessVq();
      const labels: VqBusinessField[] = ['Address', 'City', 'Postal / Zip Code', 'Website'];
      const original = await readFields(labels);

      const check = async (label: VqBusinessField, value: string, expected: string): Promise<void> => {
        await vqProbe.fill(field(label), value);
        const shownLabel = value.length > 20 ? `${String(value.length)} chars` : `"${value}"`;
        expect({ label, value: shownLabel, message: await messageOf(label, expected) }).toEqual({
          label,
          value: shownLabel,
          message: expected,
        });
      };

      await pressEdit();
      try {
        await step('Address', async () => {
          await check('Address', '', 'Address is required');
          await check('Address', 'A'.repeat(51), 'Address must be less than 50 characters');
          await check('Address', 'A'.repeat(50), '');
        });
        await step('City', async () => {
          await check('City', '', 'City is required');
          await check('City', 'C'.repeat(51), 'City must be less than 50 characters');
          await check('City', 'C'.repeat(50), '');
        });
        await step('Postal / Zip Code', async () => {
          await check('Postal / Zip Code', '', 'Postal code is required');
          await check('Postal / Zip Code', '123456', 'Postal code must be less than 5 characters');
          await check('Postal / Zip Code', '12345', '');
        });
        await step('Website', async () => {
          await check('Website', 'abc.com', 'Website must be a valid URL');
          await check('Website', 'https://abc.com', '');
          await check('Website', '', '');
        });
      } finally {
        await pressCancel();
      }

      expect(await readFields(labels)).toEqual(original);
      expect(await vqProbe.count(Vq.toast(SAVED_TOAST))).toBe(0);
    },
  );

  it(
    title(
      'Cancel drops every change; leaving while editing asks first — Cancel stays, Confirm leaves without saving (SET-016, SET-017)',
      Tag.REGRESSION,
    ),
    async () => {
      await openBusinessVq();
      const original = await readFields(['City', 'Address']);
      const monday = (await businessInfoPage.workHourRows()).find((r) => r.day === 'monday');

      await step('Edit City, Address and switch Monday, then Cancel', async () => {
        await pressEdit();
        await vqProbe.fill(field('City'), 'QC Tmp City');
        await vqProbe.fill(field('Address'), 'QC Tmp Address');
        await vqProbe.press(VqBusiness.daySwitch('monday'));
        await pressCancel();
        expect(await readFields(['City', 'Address'])).toEqual(original);
        expect((await businessInfoPage.workHourRows()).find((r) => r.day === 'monday')).toEqual(monday);
        expect(await vqProbe.count(Vq.toast(SAVED_TOAST))).toBe(0);
      });

      await step(
        'Leave while editing: Cancel keeps the draft, Confirm leaves and saves nothing',
        async () => {
          await pressEdit();
          await vqProbe.fill(field('City'), 'QC Leave City');
          await pressRailLink('Language');
          expect(await vqProbe.isShown(Vq.text('Are you sure want to leave?', VqScope.alertDialog))).toBe(
            true,
          );
          expect(
            await vqProbe.isShown(
              Vq.text('You have unsaved changes. Are you sure want to leave?', VqScope.alertDialog),
            ),
          ).toBe(true);
          await vqProbe.press(Vq.alertButton('Cancel'));
          expect(await vqProbe.isGone(Vq.alertDialog())).toBe(true);
          expect(await vqProbe.path()).toMatch(/\/settings\/business/);
          expect(await vqProbe.inputValue(field('City'))).toBe('QC Leave City');

          await pressRailLink('Language');
          expect(await vqProbe.isShown(Vq.alertDialog())).toBe(true);
          await vqProbe.press(Vq.alertButton('Confirm'));
          expect(
            await vqProbe.poll(async () => (await vqProbe.path()).startsWith(Routes.SETTINGS_LANGUAGE), true),
          ).toBe(true);
          await openBusinessVq();
          expect(await vqProbe.inputValue(field('City'))).toBe(original.City);
        },
      );
    },
  );

  /* ------------------------------------------------------------------ *
   * Work hours
   * ------------------------------------------------------------------ */

  it(
    title(
      'Work Hours: 7 "Open on <day>" switches; an open day shows two times, a closed day a disabled "Closed" (SET-018)',
      Tag.REGRESSION,
    ),
    async () => {
      await openBusinessVq();
      const rows = await businessInfoPage.workHourRows();
      expect(rows.map((r) => r.day)).toEqual([...WEEKDAYS_VQ]);

      for (const row of rows) {
        expect({
          day: row.day,
          switch: (await vqProbe.count(VqBusiness.daySwitch(row.day as VqDay))) > 0,
        }).toEqual({
          day: row.day,
          switch: true,
        });
        if (row.on) {
          const times = row.inputs.filter((input) => input.type === 'time').map((input) => input.value);
          expect({
            day: row.day,
            times: times.length,
            format: times.every((t) => /^\d{2}:\d{2}/.test(t)),
          }).toEqual({
            day: row.day,
            times: 2,
            format: true,
          });
        } else {
          const closed = row.inputs.find((input) => input.type !== 'time');
          expect({ day: row.day, value: closed?.value, disabled: closed?.disabled }).toEqual({
            day: row.day,
            value: 'Closed',
            disabled: true,
          });
        }
      }
    },
  );

  it(
    title(
      'Work Hours validation (no Save): open must be before close; switching a day off and on restores its hours (SET-020, SET-021)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await openBusinessVq();
      const rows = await businessInfoPage.workHourRows();
      const open = rows.find((r) => r.day === 'monday' && r.on) ?? rows.find((r) => r.on);
      if (!open) this.skip(); // the shop is closed every day — nothing to validate
      const day = open.day as VqDay;
      const [origStart = '', origEnd = ''] = open.inputs.filter((i) => i.type === 'time').map((i) => i.value);

      await pressEdit();
      try {
        for (const [start, end] of [
          ['18:00', '09:00'],
          ['09:00', '09:00'],
        ] as const) {
          await vqProbe.setNative(VqBusiness.dayTime(day, 0), start);
          await vqProbe.setNative(VqBusiness.dayTime(day, 1), end);
          expect((await vqProbe.inputValue(VqBusiness.dayTime(day, 0))).slice(0, 5)).toBe(start);
          expect((await vqProbe.inputValue(VqBusiness.dayTime(day, 1))).slice(0, 5)).toBe(end);
          const expected = 'Open time must be before close time';
          const message = await vqProbe.poll(
            () => vqProbe.fieldMessage(VqBusiness.dayTime(day, 0)),
            expected,
            Timeouts.ANIMATION * 4,
          );
          expect({ day, start, end, message }).toEqual({ day, start, end, message: expected });
          expect(await vqProbe.count(Vq.toast(SAVED_TOAST))).toBe(0);
        }

        await step('Change the open time, switch the day off and on: the original hours return', async () => {
          await vqProbe.setNative(VqBusiness.dayTime(day, 0), origStart.slice(0, 5));
          await vqProbe.setNative(VqBusiness.dayTime(day, 1), origEnd.slice(0, 5));
          await vqProbe.setNative(
            VqBusiness.dayTime(day, 0),
            origStart.startsWith('10:00') ? '11:00' : '10:00',
          );
          await vqProbe.press(VqBusiness.daySwitch(day));
          expect(await vqProbe.poll(() => vqProbe.isChecked(VqBusiness.daySwitch(day)), false)).toBe(false);
          await vqProbe.press(VqBusiness.daySwitch(day));
          expect(await vqProbe.poll(() => vqProbe.isChecked(VqBusiness.daySwitch(day)), true)).toBe(true);
          expect((await vqProbe.inputValue(VqBusiness.dayTime(day, 0))).slice(0, 5)).toBe(
            origStart.slice(0, 5),
          );
        });
      } finally {
        await pressCancel();
      }

      expect((await businessInfoPage.workHourRows()).find((r) => r.day === day)).toEqual(open);
    },
  );

  /* ------------------------------------------------------------------ *
   * Pay period
   * ------------------------------------------------------------------ */

  it(
    title(
      'Pay Period: the Current plan card and exactly one pay-period radio checked (SET-024)',
      Tag.REGRESSION,
    ),
    async () => {
      await openBusinessVq();

      const card = await vqProbe.textAround(Vq.text('Current plan', VqScope.main), '\\d{4}');
      expect(card).toContain('Current plan');
      expect(card).toMatch(/[A-Z][a-z]{2} \d{1,2}.*-.*\d{4}/);
      expect(card).toMatch(/Weekly|Biweekly|Monthly|Custom/);

      let checked = 0;
      for (const type of ['weekly', 'biweekly', 'monthly', 'custom'] as const) {
        if (await vqProbe.isChecked(VqBusiness.payPeriodRadio(type))) checked += 1;
      }
      expect(checked).toBe(1);
    },
  );

  it(
    title(
      'Pay Period: a scheduled change shows its card and the "not applied now" note (SET-025)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await openBusinessVq();
      if (!(await vqProbe.isShown(Vq.text('Scheduled change', VqScope.main), Timeouts.ANIMATION * 2))) {
        this.skip(); // needs a merchant with a queued pay-period change (creating one is a payroll write)
      }
      expect(await vqProbe.textAround(Vq.text('Scheduled change', VqScope.main), 'Effective on')).toMatch(
        /Effective on /,
      );
      expect(
        await vqProbe.isShown(Vq.textMatching('^This is scheduled, not applied now\\.', VqScope.main)),
      ).toBe(true);
    },
  );

  it(
    title(
      'Pay Period Custom (no Save): the date picker allows up to 4 days; clearing them all asks for one (SET-026, SET-027)',
      Tag.REGRESSION,
    ),
    async () => {
      await openBusinessVq();
      const originalType = (await businessInfoPage.readPayPeriod()).type;

      const openPicker = async (): Promise<void> => {
        if (await vqProbe.isShown(VqBusiness.payrollPopover(), Timeouts.ANIMATION)) return;
        await vqProbe.press(VqBusiness.payrollDatesTrigger());
        await vqProbe.waitShown(VqBusiness.payrollPopover(), Timeouts.SHORT);
      };
      const clearAll = async (): Promise<void> => {
        for (let i = 0; i < 31 && (await vqProbe.count(VqBusiness.payrollDaysOn())) > 0; i += 1) {
          await vqProbe.press(VqBusiness.payrollDaysOn());
        }
      };

      await pressEdit();
      try {
        await vqProbe.press(VqBusiness.payPeriodRadio('custom'));
        await openPicker();

        await step('Popover texts, four days selectable, the fifth disabled', async () => {
          expect(await vqProbe.isShown(Vq.text('Set Payroll Dates', VqScope.popover))).toBe(true);
          expect(await vqProbe.isShown(Vq.textContaining('Select up to 4', VqScope.popover))).toBe(true);
          expect(
            await vqProbe.isShown(
              Vq.textContaining(
                "If the selected date doesn't exist in a month, the system will use the last day of that month.",
                VqScope.popover,
              ),
            ),
          ).toBe(true);
          await clearAll();
          for (const day of [1, 10, 15, 31]) {
            await vqProbe.press(VqBusiness.payrollDay(day));
            expect({
              day,
              state: (await vqProbe.read(VqBusiness.payrollDay(day), 'data-state')).attr,
            }).toEqual({
              day,
              state: 'on',
            });
          }
          expect(await vqProbe.isDisabled(VqBusiness.payrollDay(20))).toBe(true);
          await vqProbe.pressKey('Escape');
          expect(await vqProbe.isGone(VqBusiness.payrollPopover())).toBe(true);
        });

        await step('Clearing every day shows "Please select at least one payroll date"', async () => {
          await openPicker();
          await clearAll();
          await vqProbe.pressKey('Escape');
          expect(await vqProbe.isGone(VqBusiness.payrollPopover())).toBe(true);
          expect(
            await vqProbe.isShown(Vq.text('Please select at least one payroll date', VqScope.main)),
          ).toBe(true);
        });
      } finally {
        await vqProbe.pressKey('Escape');
        await pressCancel();
      }

      expect((await businessInfoPage.readPayPeriod()).type).toBe(originalType);
      expect(await vqProbe.count(Vq.toast(SAVED_TOAST))).toBe(0);
    },
  );
});
