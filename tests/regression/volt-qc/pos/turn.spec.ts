/**
 * volt-qc port — 15 TURN board (read-only cases).
 *
 * Source: volt-qc `e2e/tests/15-turn/turn-plan-board.spec.ts` (TURN-B2, TURN-B7).
 * TC catalogue: docs/qc/volt-qc/windows-regression/15-turn.md.
 *
 * Opens / closes the board and its child dialogs. Turn Settings switches are
 * toggled but NEVER saved (the dialog is closed with X), and the case then
 * re-reads the dialog to prove nothing changed.
 *
 * Reuses `turnBoardDialog` (src/components/modal/TurnBoardDialog.ts) for the
 * board itself; only what it does not expose goes through the probe.
 */

import { expect } from '@wdio/globals';
import { passcodeDialog, turnBoardDialog } from '../../../../src/components/index.js';
import { VqcTurn, inMain } from '../../../../src/constants/testids.voltqc-pos.js';
import { goToSettings, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { orderPendingPage, settingsPage } from '../../../../src/pages/index.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { formatMoney } from '../../../../src/utils/money.js';

async function expectBoardClosedOnPending(): Promise<void> {
  expect(await turnBoardDialog.isOpen(1_000)).toBe(false);
  expect(await P.path()).toBe('/order-pending');
  expect(await turnBoardDialog.currentDialogParam()).toBeNull();
}

async function closeSettingsWithX(): Promise<void> {
  const x = [VqcTurn.settingsDialog, { role: 'button', name: 'Close', nth: 0 }] as const;
  if (await P.has(x)) await P.clickQ(x);
  else await turnBoardDialog.cancelSettings();
  await P.waitGoneQ(VqcTurn.settingsDialog, 5_000, 'Turn Settings');
}

describe('volt-qc 15 TURN — board (read-only)', () => {
  after(async () => {
    await turnBoardDialog.cancelSettings().catch(() => undefined);
    await turnBoardDialog.close().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Board opened by URL on /order-pending; X / Escape / overlay close it, drop the dialog param and keep the page (TURN-002)',
      Tag.REGRESSION,
    ),
    async () => {
      await returnToHome();
      await orderPendingPage.open();

      await turnBoardDialog.open('/order-pending');
      expect(await P.path()).toBe('/order-pending');
      await turnBoardDialog.closeWithButton();
      await expectBoardClosedOnPending();

      await turnBoardDialog.open('/order-pending');
      await turnBoardDialog.pressEscape();
      await expectBoardClosedOnPending();

      await turnBoardDialog.open('/order-pending');
      await P.clickAt(8, 8); // the overlay outside the (1000 px wide, centred) dialog
      await settle(500);
      await expectBoardClosedOnPending();
    },
  );

  it(
    title(
      'Board / Adjust Turn / Setting open with no passcode; Turn Settings labels + value = Charge & Fee; X saves nothing; service-based OFF locks decimals (TURN-060, TURN-062, TURN-063, TURN-085)',
      Tag.REGRESSION,
    ),
    async function () {
      this.timeout(4 * 60_000);
      await returnToHome();
      await turnBoardDialog.open();
      expect(await passcodeDialog.isPrompting(1_000)).toBe(false);

      await turnBoardDialog.openAdjust();
      expect(await passcodeDialog.isPrompting(1_000)).toBe(false);
      expect(await turnBoardDialog.isAdjustOpen()).toBe(true);
      await turnBoardDialog.closeAdjust();

      await turnBoardDialog.openSettings();
      expect(await passcodeDialog.isPrompting(1_000)).toBe(false);
      const saved = await turnBoardDialog.readSettings();

      await step('TURN-060 labels, help text and Save', async () => {
        const t = ((await P.rawText(VqcTurn.settingsDialog)) ?? '').replace(/\s*\n+\s*/g, ' | ');
        for (const s of VqcTurn.settingsLabels) expect(t).toContain(s);
        expect(saved.turnValueText).toMatch(/^\$[\d,]+\.\d{2}$/);
        expect(await P.has([VqcTurn.settingsDialog, { role: 'button', name: 'Save' }])).toBe(true);
      });

      await step(
        'TURN-063 service-based OFF → decimals OFF + disabled; ON again → decimals still OFF',
        async () => {
          if (!saved.serviceBased) await turnBoardDialog.setServiceBased(true);
          await turnBoardDialog.setServiceBased(false);
          let s = await turnBoardDialog.readSettings();
          expect(s.decimalEnabled).toBe(false);
          expect(s.decimal).toBe(false);
          await turnBoardDialog.setServiceBased(true);
          s = await turnBoardDialog.readSettings();
          expect(s.decimalEnabled).toBe(true);
          expect(s.decimal).toBe(false);
        },
      );

      await step(
        'TURN-062 change Turn value then X → no toast; reopening shows the saved values',
        async () => {
          await turnBoardDialog.typeTurnValue(String(saved.turnValueCents + 100));
          await closeSettingsWithX();
          expect(await P.count(VqcTurn.savedToast)).toBe(0);
          await turnBoardDialog.openSettings();
          const again = await turnBoardDialog.readSettings();
          expect({ s: again.serviceBased, d: again.decimal, v: again.turnValueCents }).toEqual({
            s: saved.serviceBased,
            d: saved.decimal,
            v: saved.turnValueCents,
          });
          await closeSettingsWithX();
        },
      );
      await turnBoardDialog.close();

      await step('TURN-060 the values match Settings › Charge & Fee › Turn Settings', async () => {
        await goToSettings();
        await settingsPage.openSection('CHARGE_FEE');
        const card = VqcTurn.chargeFeeTurnCard;
        await P.waitFor([card, { css: 'input', nth: 0 }], 15_000, 'Charge & Fee Turn Settings card');
        const values = (await P.infos([card, { css: 'input' }])).map((i) => i.value);
        expect(values).toContain(formatMoney(saved.turnValueCents));
        const sw = (label: string) => [card, { role: 'switch', name: label }] as const;
        expect(await P.attrOf(sw(VqcTurn.settingsLabels[0] ?? ''), 'aria-checked')).toBe(
          String(saved.serviceBased),
        );
        if (saved.serviceBased) {
          expect(await P.attrOf(sw(VqcTurn.settingsLabels[2] ?? ''), 'aria-checked')).toBe(
            String(saved.decimal),
          );
        }
        expect(await P.count(inMain({ text: 'Something went wrong' }))).toBe(0);
      });
    },
  );
});
