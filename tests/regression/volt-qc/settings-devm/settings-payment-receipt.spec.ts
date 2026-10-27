/**
 * volt-qc port — 11-settings: Charge & Fee (Tax / Discount / Turn), Tipping
 * Settings (Tip Setting, Tip Option table, Signature) and Receipt (summary
 * lines, header, messages, display options, leave guard).
 *
 * Source: volt-qc `e2e/tests/11-settings/set-plan-readonly-payment.spec.ts`
 * (`@readonly` cases). TC definitions:
 * docs/qc/volt-qc/windows-regression/11-settings.md.
 *
 * ## Read-only
 *
 * No Save is pressed anywhere. Every case dirties a form, reads the gate back,
 * and then either restores the controls it touched or leaves through the rail
 * with the guard's "Discard & Leave" / "Confirm" — and re-reads the screen to
 * prove nothing stuck. Tax, discount split, turn rules, tip options and receipt
 * layout are merchant-global, so `afterEach` discards a draft a failed case
 * left behind.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { Routes } from '../../../../src/constants/routes.js';
import {
  BUSINESS_FIELD_NAMES_VQ,
  Vq,
  VqChargeFee,
  VqReceipt,
  VqScope,
  VqTipping,
  type VqQuery,
} from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { step } from '../../../../src/helpers/steps.js';
import chargeFeePage from '../../../../src/pages/settings/ChargeFeePage.js';
import receiptSettingsPage from '../../../../src/pages/settings/ReceiptSettingsPage.js';
import {
  dismissOverlays,
  leaveDiscardingVq,
  openBusinessVq,
  openSettingsVq,
  pressRailLink,
} from '../../../../src/pages/voltqc/settings-devm/nav.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { vqTipTable } from '../../../../src/pages/voltqc/settings-devm/VqTipTable.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const DISCARD_PROMPT =
  'You have unsaved changes. Do you want to undo changes and leave this page, or continue editing?';

/** Receipt summary toggles and the preview lines each one drives. */
const SUMMARY: Record<string, string[]> = {
  subtotal: ['Subtotal'],
  'total-discount': ['Total Discount', 'Item Discount', 'Promotion', 'Reward Redemption'],
  tax: ['Tax'],
  tip: ['Tip'],
  total: ['Total'],
};

async function landedOn(path: string): Promise<boolean> {
  return vqProbe.poll(async () => (await vqProbe.path()).startsWith(path), true, Timeouts.NAVIGATION);
}

async function openTipping(): Promise<void> {
  await openSettingsVq('PAYMENT_TRANSACTION');
  await vqProbe.waitShown(Vq.th('Tip Suggestion', VqScope.main), Timeouts.MEDIUM);
}

async function openReceipt(): Promise<void> {
  await openSettingsVq('RECEIPT');
  await receiptSettingsPage.waitForReady(Timeouts.MEDIUM);
  await vqProbe.waitShown(VqReceipt.paperEl(), Timeouts.MEDIUM);
}

async function readToggles(ids: readonly string[]): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const id of ids) out[id] = await vqProbe.isChecked(VqReceipt.toggle(id));
  return out;
}

async function restoreToggles(state: Record<string, boolean>): Promise<void> {
  for (const [id, on] of Object.entries(state)) await vqProbe.setChecked(VqReceipt.toggle(id), on);
}

describe('volt-qc SET — Charge & Fee, Tipping, Receipt (read-only)', () => {
  afterEach(async () => {
    await dismissOverlays().catch(() => undefined);
    // A draft left by a failed case: leave through the rail and discard it.
    if ((await vqProbe.path()).startsWith(Routes.SETTINGS)) {
      await leaveDiscardingVq('Language').catch(() => undefined);
    }
  });

  /* ------------------------------------------------------------------ *
   * Charge & Fee
   * ------------------------------------------------------------------ */

  it(
    title(
      'Charge & Fee: 3 sections with 3 Saves, Service Tax read-only, Product Tax input rules, leaving a draft asks Discard (SET-044, SET-045, SET-048, SET-050)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('CHARGE_FEE');
      await chargeFeePage.waitForReady(Timeouts.MEDIUM);
      const tax = Vq.labelled('Product Tax', VqScope.main);
      const original = await vqProbe.inputValue(tax);

      await step('Structure', async () => {
        for (const section of ['Tax Setting', 'Discount Setting', 'Turn Settings']) {
          expect({ section, shown: await vqProbe.isShown(Vq.heading(section)) }).toEqual({
            section,
            shown: true,
          });
        }
        expect(await vqProbe.count(Vq.button('Save', VqScope.main))).toBe(3);
      });

      await step('Service Tax is read-only; no Service Fee / Cash Discount', async () => {
        expect(await vqProbe.isShown(Vq.text('Service Tax', VqScope.main))).toBe(true);
        const before = await vqProbe.inputValue(VqChargeFee.serviceTax());
        expect(await vqProbe.isDisabled(VqChargeFee.serviceTax())).toBe(true);
        await vqProbe.fill(VqChargeFee.serviceTax(), '9', Timeouts.SHORT).catch(() => undefined);
        expect(await vqProbe.inputValue(VqChargeFee.serviceTax())).toBe(before);
        expect(await vqProbe.count(Vq.textMatching('^(Service Fee|Cash Discount)$', VqScope.main))).toBe(0);
      });

      await step('Product Tax: >100 refused, letters and minus stripped, 0 / 100 valid', async () => {
        await vqProbe.fill(tax, '101');
        const v101 = await vqProbe.inputValue(tax);
        const error = await vqProbe.fieldMessage(tax);
        expect({ typed: '101', accepted: Number(v101) <= 100 || error !== '' }).toEqual({
          typed: '101',
          accepted: true,
        });
        await vqProbe.fill(tax, 'abc');
        expect(await vqProbe.inputValue(tax)).not.toMatch(/[a-z]/i);
        await vqProbe.fill(tax, '-5');
        expect(await vqProbe.inputValue(tax)).not.toContain('-');
        for (const value of ['0', '100']) {
          await vqProbe.fill(tax, value);
          expect({ value, message: await vqProbe.fieldMessage(tax) }).toEqual({ value, message: '' });
        }
        expect(await vqProbe.count(Vq.toast('Charge & Fee settings updated successfully'))).toBe(0);
      });

      await step('A draft tax, then leave: Discard & Leave keeps the stored value', async () => {
        await vqProbe.fill(tax, original === '7' ? '8' : '7');
        expect(await chargeFeePage.isSaveEnabled()).toBe(true);
        await pressRailLink('Receipt');
        expect(await vqProbe.isShown(Vq.text('Discard changes and leave?', VqScope.alertDialog))).toBe(true);
        expect(await vqProbe.isShown(Vq.text(DISCARD_PROMPT, VqScope.alertDialog))).toBe(true);
        await vqProbe.press(Vq.alertButton('Discard & Leave'));
        expect(await landedOn(Routes.SETTINGS_RECEIPT)).toBe(true);
        await openSettingsVq('CHARGE_FEE');
        await chargeFeePage.waitForReady(Timeouts.MEDIUM);
        expect(await vqProbe.inputValue(tax)).toBe(original);
      });
    },
  );

  it(
    title(
      'Discount Setting: owner + staff = 100%, mismatch / out-of-range blocked, Save only when valid and changed (SET-051, SET-052, SET-053, SET-054)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('CHARGE_FEE');
      await chargeFeePage.waitForReady(Timeouts.MEDIUM);
      const error = VqChargeFee.sectionError('Discount Setting');
      const { owner: o0, staff: s0 } = await chargeFeePage.readDiscountSplit();
      const set = async (owner: string, staff: string): Promise<void> => {
        await vqProbe.fill(VqChargeFee.discountOwner(), owner);
        await vqProbe.fill(VqChargeFee.discountStaff(), staff);
      };

      try {
        await step('Display', async () => {
          expect(
            await vqProbe.isShown(
              Vq.text('Set how promotion discounts are shared between the owner and staff.', VqScope.main),
            ),
          ).toBe(true);
          expect(await vqProbe.isShown(Vq.text('Percent for owner', VqScope.main))).toBe(true);
          expect(await vqProbe.isShown(Vq.text('Percent for staff', VqScope.main))).toBe(true);
          expect(Number(o0) + Number(s0)).toBe(100);
          expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(false);
        });

        await step('A split that is not 100% shows the error, no auto-fill', async () => {
          for (const [owner, staff] of [
            ['60', '30'],
            ['30', '60'],
          ] as const) {
            await set(owner, staff);
            expect(await vqProbe.textOf(error)).toBe('Owner and staff percent must total 100%');
            expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(false);
            expect(await vqProbe.inputValue(VqChargeFee.discountStaff())).toBe(staff);
          }
        });

        await step('Out of range or empty keeps Save disabled', async () => {
          await set('110', '-10');
          const owner = Number(await vqProbe.inputValue(VqChargeFee.discountOwner()));
          expect(owner <= 100 || (await vqProbe.count(error)) > 0).toBe(true);
          expect(await vqProbe.inputValue(VqChargeFee.discountStaff())).not.toContain('-');
          expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(false);
          await vqProbe.fill(VqChargeFee.discountOwner(), '');
          expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(false);
        });

        await step('Boundaries 0/100 and 100/0 are valid', async () => {
          for (const [owner, staff] of [
            [0, 100],
            [100, 0],
          ] as const) {
            await set(String(owner), String(staff));
            expect(await vqProbe.count(error)).toBe(0);
            expect(await chargeFeePage.isDiscountSaveEnabled()).toBe(String(owner) !== o0);
          }
        });
      } finally {
        await set(o0, s0);
      }

      expect(await vqProbe.poll(() => chargeFeePage.isDiscountSaveEnabled(), false)).toBe(false);
      expect(await vqProbe.count(Vq.toast('Discount setting updated'))).toBe(0);
    },
  );

  it(
    title(
      'Turn Settings: labels, service-based off locks decimals, Turn value refuses minus / letters, leaving asks nothing and keeps the stored values (SET-060, SET-063)',
      Tag.REGRESSION,
    ),
    async () => {
      await openSettingsVq('CHARGE_FEE');
      await chargeFeePage.waitForReady(Timeouts.MEDIUM);
      const serviceBased = VqChargeFee.turnServiceBased();
      const decimal = VqChargeFee.turnDecimal();
      const turnValue = Vq.labelled('Turn value (minimum order amount counted as 1 turn)', VqScope.main);
      await vqProbe.waitShown(serviceBased);
      const original = {
        sb: await vqProbe.isChecked(serviceBased),
        dec: await vqProbe.isChecked(decimal),
        tv: await vqProbe.inputValue(turnValue),
      };

      await step('Labels and the service-based → decimal dependency', async () => {
        for (const label of [
          'Calculate turns from services instead of orders',
          'Calculate turn values with decimals instead of rounding',
          'Turn value (minimum order amount counted as 1 turn)',
        ]) {
          expect({ label, shown: await vqProbe.isShown(Vq.text(label, VqScope.main)) }).toEqual({
            label,
            shown: true,
          });
        }
        if (!original.sb) await vqProbe.press(serviceBased);
        expect(await vqProbe.poll(() => vqProbe.isDisabled(decimal), false)).toBe(false);
        await vqProbe.press(serviceBased);
        expect(await vqProbe.poll(() => vqProbe.isChecked(serviceBased), false)).toBe(false);
        expect(await vqProbe.isChecked(decimal)).toBe(false);
        expect(await vqProbe.isDisabled(decimal)).toBe(true);
      });

      await step('Turn value takes no minus and no letters', async () => {
        await vqProbe.fill(turnValue, '-5');
        expect(await vqProbe.inputValue(turnValue)).not.toContain('-');
        await vqProbe.fill(turnValue, 'abc');
        const value = await vqProbe.inputValue(turnValue);
        expect(value).not.toMatch(/[a-z]/i);
        expect(value).toMatch(/^\$?\d[\d,]*\.\d{2}$/);
      });

      await step('Leaving asks nothing; coming back shows the stored values', async () => {
        await pressRailLink('Receipt');
        expect(await vqProbe.isShown(Vq.alertDialog(), Timeouts.ANIMATION * 3)).toBe(false);
        expect(await landedOn(Routes.SETTINGS_RECEIPT)).toBe(true);
        await openSettingsVq('CHARGE_FEE');
        await vqProbe.waitShown(serviceBased);
        expect({
          sb: await vqProbe.isChecked(serviceBased),
          dec: await vqProbe.isChecked(decimal),
          tv: await vqProbe.inputValue(turnValue),
        }).toEqual(original);
      });
    },
  );

  /* ------------------------------------------------------------------ *
   * Tipping Settings
   * ------------------------------------------------------------------ */

  it(
    title(
      'Tipping Settings: sections, Tip Method / Timing / Amount, Tip Option table order, Signature, Save follows changes and the leave guard discards (SET-064, SET-066, SET-067, SET-083, SET-086)',
      Tag.REGRESSION,
    ),
    async () => {
      await openTipping();
      const save = Vq.button('Save', VqScope.main);
      // The method checkboxes carry no text of their own — reach them through their <label>.
      const tipSection = (text: string): VqQuery =>
        Vq.labelled(text, 'div, section, form', 'Tip Setting', '[role="checkbox"], input[type="checkbox"]');

      await step('Page structure', async () => {
        expect(
          await vqProbe.isShown(Vq.text('Manage how tips are handled during checkout.', VqScope.main)),
        ).toBe(true);
        expect(await vqProbe.isShown(save)).toBe(true);
        for (const section of ['Tip Setting', 'Signature', 'Split Tip Setting']) {
          expect({ section, shown: await vqProbe.isShown(Vq.heading(section)) }).toEqual({
            section,
            shown: true,
          });
        }
        expect(await vqProbe.count(Vq.text('Discount Setting', VqScope.main))).toBe(0);
        expect(await vqProbe.count(Vq.textMatching('^Supply Share', VqScope.main))).toBe(0);
      });

      await step('Tip Method, Tip Timing, Tip Amount', async () => {
        for (const method of ['Card', 'Cash', 'Gift Card', 'Other']) {
          expect({ method, shown: await vqProbe.isShown(tipSection(method)) }).toEqual({
            method,
            shown: true,
          });
        }
        expect(await vqProbe.isShown(Vq.text('Before Payment', VqScope.main))).toBe(true);
        expect(await vqProbe.isShown(Vq.text('After Payment', VqScope.main))).toBe(true);
        expect(
          await vqProbe.isShown(
            Vq.text(
              'Before: tip included in charge, After: tip added later, allows adjustment.',
              VqScope.main,
            ),
          ),
        ).toBe(true);
        const timing = [
          await vqProbe.isChecked(VqTipping.timingBefore()),
          await vqProbe.isChecked(VqTipping.timingAfter()),
        ];
        expect(timing.filter(Boolean)).toHaveLength(1);
        const unit = [
          await vqProbe.isChecked(VqTipping.typePercent()),
          await vqProbe.isChecked(VqTipping.typeAmount()),
        ];
        expect(unit.filter(Boolean)).toHaveLength(1);
      });

      await step('Tip Option table', async () => {
        for (const header of ['Reorder', 'Tip Suggestion', 'Status', 'Action']) {
          expect({ header, shown: await vqProbe.isShown(Vq.th(header, VqScope.main)) }).toEqual({
            header,
            shown: true,
          });
        }
        expect(await vqProbe.isShown(Vq.thMatching('^Tip Amount \\((%|\\$)\\)$', VqScope.main))).toBe(true);
        expect(await vqProbe.isShown(Vq.button('Add Tip Option', VqScope.main))).toBe(true);
        const rows = await vqTipTable.rows();
        if (rows.length === 0) {
          expect(await vqProbe.isShown(Vq.text('No tip options available.', VqScope.main))).toBe(true);
        } else {
          const firstInactive = rows.findIndex((r) => !r.active);
          const active = firstInactive < 0 ? rows : rows.slice(0, firstInactive);
          expect(active.map((r) => r.pos)).toEqual(active.map((_, i) => String(i + 1)));
          if (firstInactive >= 0) {
            expect(rows.slice(firstInactive).every((r) => !r.active)).toBe(true);
            expect(rows.slice(firstInactive).every((r) => r.pos === '')).toBe(true);
          }
        }
      });

      await step('Signature', async () => {
        expect(await vqProbe.isShown(Vq.text('Require Digital Signature', VqScope.main))).toBe(true);
        expect(
          await vqProbe.isShown(
            Vq.text(
              'Enabled: customer signs on screen, waiving if skipped. Disabled: customer signs on paper receipt.',
              VqScope.main,
            ),
          ),
        ).toBe(true);
        const timing = [
          await vqProbe.isChecked(VqTipping.signatureBefore()),
          await vqProbe.isChecked(VqTipping.signatureAfter()),
        ];
        expect(timing.filter(Boolean)).toHaveLength(1);
      });

      await step('Save follows the Card checkbox; leaving with a draft asks Discard', async () => {
        const card = tipSection('Card');
        const original = await vqProbe.isChecked(card);
        expect(await vqProbe.isDisabled(save)).toBe(true);
        await vqProbe.press(card);
        expect(await vqProbe.poll(() => vqProbe.isDisabled(save), false)).toBe(false);
        await vqProbe.press(card);
        expect(await vqProbe.poll(() => vqProbe.isDisabled(save), true)).toBe(true);
        await vqProbe.press(card);
        await pressRailLink('Receipt');
        expect(await vqProbe.isShown(Vq.text('Discard changes and leave?', VqScope.alertDialog))).toBe(true);
        await vqProbe.press(Vq.alertButton('Discard & Leave'));
        expect(await landedOn(Routes.SETTINGS_RECEIPT)).toBe(true);
        await openTipping();
        expect(await vqProbe.isChecked(tipSection('Card'))).toBe(original);
      });
    },
  );

  it(
    title(
      'Tipping: switching % → $ shows $ values and an Amount field; back to % leaves Save disabled (SET-079)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await openTipping();
      if (!(await vqProbe.isChecked(VqTipping.typePercent()))) this.skip(); // written for a merchant on "%"
      const save = Vq.button('Save', VqScope.main);

      await vqProbe.press(VqTipping.typeAmount());
      expect(await vqProbe.isShown(Vq.th('Tip Amount ($)', VqScope.main))).toBe(true);
      for (const row of (await vqTipTable.rows()).slice(0, 5)) expect(row.value).toMatch(/^\$[\d,]+\.\d{2}$/);
      await chargeFeePage.openAddTipDialog();
      expect(await vqProbe.isShown(Vq.text('Amount', VqScope.dialog))).toBe(true);
      if ((await vqProbe.count(VqTipping.dialogPercent())) > 0) {
        await vqProbe.fill(VqTipping.dialogPercent(), '25');
        expect(await chargeFeePage.isAddTipAddEnabled()).toBe(false);
      }
      await chargeFeePage.closeAddTipDialog();

      await vqProbe.press(VqTipping.typePercent());
      expect(await vqProbe.isShown(Vq.th('Tip Amount (%)', VqScope.main))).toBe(true);
      expect(await vqProbe.poll(() => vqProbe.isDisabled(save), true)).toBe(true);
    },
  );

  it(
    title(
      'Tip option (no Save): Add disabled when empty / 0, duplicates flagged, edits clamp at 100, Delete asks and Cancel keeps the row (SET-070, SET-071, SET-072, SET-077)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await openTipping();
      if (!(await vqProbe.isChecked(VqTipping.typePercent()))) this.skip(); // written for Tip Amount = %
      const rows = await vqTipTable.rows();
      const duplicate = 'This tip value already exists. Please enter a unique value.';
      if (rows.length < 2) this.skip(); // needs two tip options to collide

      await step('Add is disabled when empty or 0', async () => {
        await chargeFeePage.openAddTipDialog();
        expect(await chargeFeePage.isAddTipAddEnabled()).toBe(false);
        await chargeFeePage.typeAddTipAmount('0');
        expect(await chargeFeePage.isAddTipAddEnabled()).toBe(false);
        await chargeFeePage.closeAddTipDialog();
        expect(await vqTipTable.rows()).toHaveLength(rows.length);
      });

      await step('A duplicate value is flagged inline and in the Add dialog', async () => {
        await chargeFeePage.startInlineEdit(1);
        await vqProbe.fill(VqTipping.rowInput(), rows[1]?.value ?? '');
        expect(await vqProbe.isShown(Vq.text(duplicate, VqScope.table))).toBe(true);
        expect(await vqProbe.isDisabled(Vq.button('Save', VqScope.main))).toBe(true);
        await chargeFeePage.openAddTipDialog();
        await chargeFeePage.typeAddTipAmount(rows[1]?.value ?? '');
        expect(await vqProbe.isShown(Vq.text(duplicate, VqScope.dialog))).toBe(true);
        expect(await chargeFeePage.isAddTipAddEnabled()).toBe(false);
        await chargeFeePage.closeAddTipDialog();
        await leaveDiscardingVq('Receipt');
      });

      await step('An inline edit clamps above 100 and refuses letters', async () => {
        await openTipping();
        await chargeFeePage.startInlineEdit(1);
        await vqProbe.fill(VqTipping.rowInput(), '150');
        expect(await vqProbe.inputValue(VqTipping.rowInput())).toBe('100');
        await vqProbe.fill(VqTipping.rowInput(), 'abc');
        expect(await vqProbe.inputValue(VqTipping.rowInput())).not.toMatch(/[a-z]/i);
        await leaveDiscardingVq('Receipt');
      });

      await step('Delete asks for confirmation; Cancel keeps every row', async () => {
        await openTipping();
        await chargeFeePage.openDeleteConfirm(1);
        expect(
          await vqProbe.isShown(
            Vq.text('Are you sure you want to delete this tip option?', VqScope.alertDialog),
          ),
        ).toBe(true);
        expect(await vqProbe.isShown(Vq.alertButton('Delete'))).toBe(true);
        await chargeFeePage.cancelDelete();
        expect(await vqTipTable.rows()).toHaveLength(rows.length);
      });
    },
  );

  /* ------------------------------------------------------------------ *
   * Receipt
   * ------------------------------------------------------------------ */

  it(
    title(
      'Receipt: layout, each summary line follows its checkbox, Total Discount takes its sub-lines, all off removes the totals block (SET-088, SET-089, SET-090, SET-091)',
      Tag.REGRESSION,
    ),
    async () => {
      await openReceipt();

      await step('Layout', async () => {
        expect(await receiptSettingsPage.isSaveEnabled()).toBe(false);
        expect(await receiptSettingsPage.isPreviewHeadingShown()).toBe(true);
        for (const section of ['printing', 'branding', 'message', 'display'] as const) {
          expect({ section, open: await receiptSettingsPage.isSectionExpanded(section) }).toEqual({
            section,
            open: true,
          });
        }
        expect(
          await vqProbe.isShown(Vq.text('Auto-print customer receipt after each order', VqScope.main)),
        ).toBe(true);
        expect(await vqProbe.isShown(Vq.text('Auto-print cancel/refund receipts', VqScope.main))).toBe(true);
        // The split-check / gift-card print options are either gone or locked.
        for (const label of [
          'Auto-print customer receipt after each split check',
          'Print separate gift card receipts at check-out',
        ]) {
          if ((await vqProbe.count(Vq.text(label, VqScope.main))) === 0) continue;
          expect({ label, locked: await vqProbe.isDisabled(Vq.switches('div', label)) }).toEqual({
            label,
            locked: true,
          });
        }
      });

      const original = await readToggles(Object.keys(SUMMARY));
      try {
        await step('Each summary line hides and shows with its checkbox', async () => {
          for (const id of Object.keys(SUMMARY)) await vqProbe.setChecked(VqReceipt.toggle(id), true);
          for (const [id, labels] of Object.entries(SUMMARY)) {
            await vqProbe.press(VqReceipt.toggle(id));
            for (const label of labels) {
              expect({ off: id, line: label, count: await vqProbe.count(VqReceipt.line(label)) }).toEqual({
                off: id,
                line: label,
                count: 0,
              });
            }
            for (const [other, otherLabels] of Object.entries(SUMMARY)) {
              if (other === id) continue;
              const line = otherLabels[0] ?? '';
              expect({ off: id, line, count: await vqProbe.count(VqReceipt.line(line)) }).toEqual({
                off: id,
                line,
                count: 1,
              });
            }
            await vqProbe.press(VqReceipt.toggle(id));
            for (const label of labels) {
              expect({ on: id, line: label, count: await vqProbe.count(VqReceipt.line(label)) }).toEqual({
                on: id,
                line: label,
                count: 1,
              });
            }
          }
        });

        await step('Total Discount drags its sub-lines; Subtotal off keeps Tip and Total', async () => {
          await vqProbe.setChecked(VqReceipt.toggle('total-discount'), false);
          for (const label of SUMMARY['total-discount'] ?? [])
            expect(await vqProbe.count(VqReceipt.line(label))).toBe(0);
          await vqProbe.setChecked(VqReceipt.toggle('total-discount'), true);
          await vqProbe.setChecked(VqReceipt.toggle('subtotal'), false);
          expect(await vqProbe.count(VqReceipt.line('Tip'))).toBe(1);
          expect(await vqProbe.count(VqReceipt.line('Total'))).toBe(1);
          await vqProbe.setChecked(VqReceipt.toggle('subtotal'), true);
        });

        await step('All five off: no totals block, the rest of the receipt remains', async () => {
          for (const id of Object.keys(SUMMARY)) await vqProbe.setChecked(VqReceipt.toggle(id), false);
          for (const label of Object.values(SUMMARY).flat())
            expect(await vqProbe.count(VqReceipt.line(label))).toBe(0);
          if (await vqProbe.isChecked(VqReceipt.toggle('show-payment-method'))) {
            expect(await vqProbe.isShown(VqReceipt.previewExact('Paid with:'))).toBe(true);
          }
          expect((await vqProbe.textOf(VqReceipt.paperEl())).length).toBeGreaterThan(0);
        });
      } finally {
        await restoreToggles(original);
      }
      expect(await vqProbe.poll(() => receiptSettingsPage.isSaveEnabled(), false)).toBe(false);
    },
  );

  it(
    title(
      'Receipt header: the business phone shows masked, asks a passcode on click and hides with its switch (SET-093)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await openBusinessVq();
      const phone = (await vqProbe.inputValue(Vq.named(BUSINESS_FIELD_NAMES_VQ['Business phone']))).replace(
        /\D/g,
        '',
      );
      if (phone === '') this.skip(); // the merchant has no Business phone
      await openReceipt();
      const original = await readToggles(['show-business-phone']);
      try {
        await vqProbe.setChecked(VqReceipt.toggle('show-business-phone'), true);
        expect(await vqProbe.isShown(VqReceipt.maskedPhone())).toBe(true);
        expect(await vqProbe.textOf(VqReceipt.maskedPhone())).toContain(phone.slice(-4));
        await vqProbe.press(VqReceipt.maskedPhone());
        const asked = await vqProbe.isShown(
          Vq.textContaining('Enter staff code', VqScope.dialog),
          Timeouts.SHORT,
        );
        if (asked) await vqProbe.pressKey('Escape');
        expect(asked).toBe(true);
        await vqProbe.setChecked(VqReceipt.toggle('show-business-phone'), false);
        expect(await vqProbe.count(VqReceipt.maskedPhone())).toBe(0);
      } finally {
        await restoreToggles(original);
      }
    },
  );

  it(
    title(
      'Receipt (no Save): name / address / logo follow their switches, header-footer-marketing messages preview, footer capped at 512, Tip leave guard (SET-095, SET-096, SET-097, SET-103)',
      Tag.REGRESSION,
    ),
    async () => {
      await openBusinessVq();
      const bizName = (await vqProbe.inputValue(Vq.named(BUSINESS_FIELD_NAMES_VQ['Business Name']))).trim();
      const bizAddress = (await vqProbe.inputValue(Vq.named(BUSINESS_FIELD_NAMES_VQ.Address))).trim();
      await openReceipt();
      const ids = [
        'show-logo',
        'show-business-name',
        'show-business-address',
        'show-business-phone',
        'header-text',
        'footer-text',
        'marketing-opt-in-prompt',
        'tip',
      ];
      const original = await readToggles(ids);

      await step(
        'Logo / name / address show and hide; all header switches off clears the header',
        async () => {
          await vqProbe.setChecked(VqReceipt.toggle('show-business-name'), true);
          if (bizName) expect(await vqProbe.isShown(VqReceipt.previewContains(bizName))).toBe(true);
          await vqProbe.setChecked(VqReceipt.toggle('show-business-name'), false);
          if (bizName) expect(await vqProbe.count(VqReceipt.previewExact(bizName))).toBe(0);
          await vqProbe.setChecked(VqReceipt.toggle('show-business-address'), true);
          if (bizAddress) expect(await vqProbe.isShown(VqReceipt.previewContains(bizAddress))).toBe(true);
          await vqProbe.setChecked(VqReceipt.toggle('show-business-address'), false);
          if (bizAddress) expect(await vqProbe.count(VqReceipt.previewContains(bizAddress))).toBe(0);
          await vqProbe.setChecked(VqReceipt.toggle('show-logo'), true);
          const withLogo = await vqProbe.count(VqReceipt.images());
          await vqProbe.setChecked(VqReceipt.toggle('show-logo'), false);
          expect(await vqProbe.count(VqReceipt.images())).toBeLessThanOrEqual(withLogo);
          for (const id of [
            'show-logo',
            'show-business-name',
            'show-business-address',
            'show-business-phone',
            'header-text',
          ]) {
            await vqProbe.setChecked(VqReceipt.toggle(id), false);
          }
          expect(await vqProbe.count(VqReceipt.maskedPhone())).toBe(0);
          if (bizName) expect(await vqProbe.count(VqReceipt.previewExact(bizName))).toBe(0);
        },
      );

      await step('Header / footer / marketing messages render on the preview', async () => {
        for (const id of ['header-text', 'footer-text', 'marketing-opt-in-prompt']) {
          await vqProbe.setChecked(VqReceipt.toggle(id), true);
        }
        await vqProbe.fill(VqReceipt.textarea('header-text-content'), 'Welcome QC');
        await vqProbe.fill(VqReceipt.textarea('footer-text-content'), 'Footer QC');
        await vqProbe.fill(VqReceipt.textarea('marketing-opt-in-prompt-content'), 'Marketing QC');
        for (const text of ['Welcome QC', 'Footer QC', 'Marketing QC']) {
          expect({ text, shown: await vqProbe.isShown(VqReceipt.previewExact(text)) }).toEqual({
            text,
            shown: true,
          });
        }
        await vqProbe.setChecked(VqReceipt.toggle('header-text'), false);
        expect(await vqProbe.count(VqReceipt.previewExact('Welcome QC'))).toBe(0);
      });

      await step('A 513-character footer raises no error and is capped at 512', async () => {
        await vqProbe.fill(VqReceipt.textarea('footer-text-content'), 'F'.repeat(513));
        expect(
          (await vqProbe.inputValue(VqReceipt.textarea('footer-text-content'))).length,
        ).toBeLessThanOrEqual(512);
        expect(await vqProbe.count(VqReceipt.formMessages())).toBe(0);
      });

      await step('Leaving discards the draft: every switch is back as stored', async () => {
        await leaveDiscardingVq('Language');
        await openReceipt();
        expect(await readToggles(ids)).toEqual(original);
      });

      await step('Tip off, then leave: Cancel stays, Confirm leaves, Tip is unchanged', async () => {
        await vqProbe.press(VqReceipt.toggle('tip'));
        await pressRailLink('Language');
        expect(await vqProbe.isShown(Vq.text('Are you sure want to leave?', VqScope.alertDialog))).toBe(true);
        await vqProbe.press(Vq.alertButton('Cancel'));
        expect(await vqProbe.path()).toMatch(/\/settings\/receipt/);
        expect(await vqProbe.isChecked(VqReceipt.toggle('tip'))).toBe(!original.tip);
        await pressRailLink('Language');
        expect(await vqProbe.isShown(Vq.alertDialog())).toBe(true);
        await vqProbe.press(Vq.alertButton('Confirm'));
        expect(await landedOn(Routes.SETTINGS_LANGUAGE)).toBe(true);
        await openReceipt();
        expect(await vqProbe.isChecked(VqReceipt.toggle('tip'))).toBe(original.tip);
      });
    },
  );

  it(
    title(
      'Receipt Display Options (no Save): each option shows / hides its part of the preview, QR code included (SET-098, SET-099)',
      Tag.REGRESSION,
    ),
    async () => {
      await openReceipt();
      // Sample data of receipt-preview-*.tsx; null = no unique marker, only checked not to break the preview.
      const markers: [string, string | null][] = [
        ['cashier-name', '^Name$'],
        ['order-id', '^0000$'],
        ['check-in-time', '^MM\\.DD\\.YYYY 00:00 AM$'],
        ['customer-info', '^\\(xxx\\) xxx-xxxx$'],
        ['current-points', '^Current points:$'],
        ['visit-time', '^Total visit:$'],
        ['group-items-by-staff-or-guest', null],
        ['items-services-products', null],
        ['show-payment-method', '^Paid with:$'],
        ['signature', '^Signature:$'],
        ['business-note', null],
        ['qr-code', '^Scan to view order$'],
      ];
      const original = await readToggles(markers.map(([id]) => id));
      try {
        for (const [id, marker] of markers) {
          await step(`#${id}`, async () => {
            await vqProbe.setChecked(VqReceipt.toggle(id), true);
            if (marker)
              expect({ on: id, shown: await vqProbe.isShown(VqReceipt.previewText(marker)) }).toEqual({
                on: id,
                shown: true,
              });
            const svgOn = await vqProbe.count(VqReceipt.svgs());
            await vqProbe.setChecked(VqReceipt.toggle(id), false);
            if (marker)
              expect({ off: id, count: await vqProbe.count(VqReceipt.previewText(marker)) }).toEqual({
                off: id,
                count: 0,
              });
            if (id === 'qr-code') expect(await vqProbe.count(VqReceipt.svgs())).toBeLessThan(svgOn);
            expect(await vqProbe.isShown(VqReceipt.paperEl())).toBe(true);
          });
        }
      } finally {
        await restoreToggles(original);
      }
      expect(await vqProbe.poll(() => receiptSettingsPage.isSaveEnabled(), false)).toBe(false);
    },
  );

  it(
    title(
      'Receipt: a merchant without a Business phone shows "-" in the preview header (SET-094)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      await openBusinessVq();
      const phone = (await vqProbe.inputValue(Vq.named(BUSINESS_FIELD_NAMES_VQ['Business phone']))).trim();
      if (phone !== '') this.skip(); // needs a merchant with no Business phone
      await openReceipt();
      const original = await readToggles(['show-business-phone']);
      try {
        await vqProbe.setChecked(VqReceipt.toggle('show-business-phone'), true);
        expect(await vqProbe.isShown(VqReceipt.previewExact('-'))).toBe(true);
      } finally {
        await restoreToggles(original);
      }
    },
  );
});
