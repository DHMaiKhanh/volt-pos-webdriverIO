/**
 * volt-qc port — 16-devm (Portal › Device Management), the POS-side case.
 *
 * Source: volt-qc `e2e/tests/16-devm/devm-plan.spec.ts` › DEVM-P7. Every other
 * DEVM case drives the fastboy Portal web (a second browser context) and is
 * not part of this app lane. TC definitions:
 * docs/qc/volt-qc/windows-regression/16-portal-device-management.md.
 *
 * Read-only: opens the app drawer and two settings screens, reads text.
 */

import { expect } from '@wdio/globals';
import { appNav } from '../../../../src/components/index.js';
import { Vq } from '../../../../src/constants/testids.voltqc-settings-devm.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { openSettingsVq } from '../../../../src/pages/voltqc/settings-devm/nav.js';
import { vqProbe } from '../../../../src/pages/voltqc/settings-devm/VqProbe.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const LOGOUT = /\b(log ?out|sign ?out|đăng xuất)\b/i;

describe('volt-qc DEVM — POS side (read-only)', () => {
  after(async () => {
    await appNav.closeSidebar().catch(() => undefined);
    await returnToHome();
  });

  it(
    title(
      'POS has no Logout in the drawer or in Settings — "Device logout" can only be triggered by revoking the token (DEVM-021)',
      Tag.REGRESSION,
    ),
    async () => {
      await step('App drawer', async () => {
        await returnToHome();
        await appNav.openSidebar();
        expect(await vqProbe.textOf(Vq.appDrawer())).not.toMatch(LOGOUT);
        expect(await vqProbe.count(Vq.buttonMatching('^(Log ?out|Sign ?out|Đăng xuất)$'))).toBe(0);
        await appNav.closeSidebar();
      });

      for (const section of ['BUSINESS', 'ACCESSIBILITY'] as const) {
        await step(`Settings › ${section}`, async () => {
          await openSettingsVq(section);
          expect({ section, text: await vqProbe.bodyText() }).toEqual({
            section,
            text: expect.not.stringMatching(LOGOUT),
          });
        });
      }
    },
  );
});
