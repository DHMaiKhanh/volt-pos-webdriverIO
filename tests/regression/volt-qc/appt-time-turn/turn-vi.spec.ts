/**
 * volt-qc port — 15 TURN in Vietnamese (TURN-H4).
 *
 * Source: volt-qc `e2e/tests/15-turn/turn-plan-home.spec.ts` TURN-H4. TC
 * catalogue: docs/qc/volt-qc/windows-regression/15-turn.md (TURN-086).
 *
 * Switches the merchant UI language to Vietnamese (merchant-GLOBAL → EXCLUSIVE)
 * and back to English in `finally`. Unlike volt-qc it saves no manual
 * adjustment (the VI save toast is not asserted): every dialog is only opened
 * and read, then closed.
 *
 * WRITES ATTENDANCE (one staff IN / OUT) and the app language (restored).
 */

import { expect } from '@wdio/globals';
import { turnBoardDialog } from '../../../../src/components/modal/TurnBoardDialog.js';
import { VqaTurn } from '../../../../src/constants/testids.voltqc-appt-time-turn.js';
import { VqcHome } from '../../../../src/constants/testids.voltqc-pos.js';
import { goToSettings, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { settingsPage } from '../../../../src/pages/index.js';
import { boardText, closeStray, withTurnStaff } from '../../../../src/pages/voltqc/appt-time-turn/turnKit.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const V = VqaTurn.vi;

async function setLanguage(code: 'en' | 'vi'): Promise<void> {
  await closeStray();
  await goToSettings();
  await settingsPage.chooseLanguage(code);
  await settle(1_500);
  await returnToHome();
}

describe('volt-qc 15 TURN — Vietnamese (write, settings)', () => {
  after(async () => {
    await setLanguage('en').catch(() => undefined);
  });

  it(
    title(
      'Vietnamese: board, Adjust, Turn Settings, Turn Order and the Home sort carry no English left-overs (TURN-086)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function () {
      this.timeout(8 * 60_000);
      await withTurnStaff(this, 1, async () => {
        try {
          await setLanguage('vi');
          await turnBoardDialog.open();
          await step('board', async () => {
            expect(await turnBoardDialog.titleText()).toBe(V.boardTitle);
            expect(await turnBoardDialog.sortText()).toContain(V.sorts[0]);
            expect((await turnBoardDialog.sortOptions()).map((o) => o.text)).toEqual([...V.sorts]);
            const t = await boardText();
            expect(t).toContain(V.adjust);
            expect(t).toContain(V.setting);
            expect(t).toMatch(new RegExp(`\\| ${V.unit}( \\||$)`));
            expect(t).toMatch(/\d{2}\/\d{2}\/\d{4}/);
            for (const en of V.englishLeftovers) expect(t).not.toContain(en);
          });
          await step('Adjust Manual Turn', async () => {
            await turnBoardDialog.openAdjust();
            const t = (await P.rawText({ role: 'dialog', hasText: V.adjustTitle, nth: -1 })) ?? '';
            expect(t).toContain(V.current);
            expect(t).toContain(V.reset);
            expect(t).not.toContain('Current:');
            await turnBoardDialog.closeAdjust();
          });
          await step('Turn Settings', async () => {
            await turnBoardDialog.openSettings();
            expect(await P.has({ role: 'dialog', hasText: V.settingsTitle })).toBe(true);
            await turnBoardDialog.cancelSettings();
          });
          await turnBoardDialog.close();
          await step('Turn Order', async () => {
            await turnBoardDialog.openQuickView();
            const pop = { css: '[data-slot="popover-content"]', hasText: V.quickTitle, nth: -1 } as const;
            const t = (await P.rawText(pop)) ?? '';
            expect(t).toContain(V.viewTurn);
            expect(t).toMatch(new RegExp(V.statusRe));
            await turnBoardDialog.closeQuickView();
          });
          await step('Home › Sort by offers "Số lượt"', async () => {
            await P.exec<null>(
              `var input = Array.prototype.slice.call(document.querySelectorAll('main input')).filter(function (i) { return i.getAttribute('placeholder') === 'Tìm nhân viên'; })[0];
               var group = input && input.closest('[data-slot="input-group"]');
               var host = group && group.parentElement;
               var b = host ? host.querySelectorAll('button') : [];
               if (b.length) b[b.length - 1].setAttribute('data-vqc-sort', '1');
               return null;`,
            );
            await P.clickQ({ css: '[data-vqc-sort="1"]' });
            await settle(600);
            expect(
              await P.has([
                { css: VqcHome.sortPopover.css, nth: -1 },
                { text: V.homeTurnCount, nth: 0 },
              ]),
            ).toBe(true);
            await P.escape();
          });
        } finally {
          await setLanguage('en').catch(() => undefined);
        }
      });
    },
  );
});
