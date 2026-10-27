/**
 * volt-qc port — 09 TIME cases that flip a merchant-GLOBAL setting.
 *
 * Source: volt-qc `e2e/tests/09-time/time-plan-keeping.spec.ts` TIME-T09
 * (Passcode Setting › Time Tracking gate) and `time-deep.spec.ts` TIME-D04
 * (Vietnamese UI). TC catalogue: docs/qc/volt-qc/windows-regression/09-time-keeping.md.
 *
 * EXCLUSIVE: the gate switch and the UI language are merchant state every other
 * spec reads. Each case restores what it changed in `finally` (gate to its saved
 * value, language to English). TIME-D04 also WRITES ATTENDANCE for one staff
 * picked among those OUT now; the record is deleted again (`ttCleanup`).
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { assertWritesAllowed } from '../../../../configs/env/loadEnv.js';
import { VqcTime as T } from '../../../../src/constants/testids.voltqc-appt-time-turn.js';
import { goToSettings, returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import { accessibilitySettingsPage, settingsPage } from '../../../../src/pages/index.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import {
  pickTimeStaff,
  toastShown,
  ttCleanup,
} from '../../../../src/pages/voltqc/appt-time-turn/timeWrite.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import {
  clickSidebarLink,
  navigateRaw,
  openSidebar,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const V = T.vi;

async function openAccessibility(): Promise<void> {
  await goToSettings();
  await settingsPage.openSection('ACCESSIBILITY');
  await accessibilitySettingsPage.waitForReady(Timeouts.MEDIUM);
}

/** Set the Time Tracking gate and save; returns the value it had before. */
async function setTimeTrackingGate(on: boolean): Promise<boolean> {
  await openAccessibility();
  const before = await accessibilitySettingsPage.isGateOn('time_tracking');
  await accessibilitySettingsPage.applyGates({ time_tracking: on });
  await settle(800);
  return before;
}

async function setLanguage(code: 'en' | 'vi'): Promise<void> {
  await goToSettings();
  await settingsPage.chooseLanguage(code);
  await settle(800);
}

/* Vietnamese Time Keeping dialog, addressed by its translated title. */
const viTk = { role: 'dialog', hasText: V.tkTitle, nth: -1 } as const;
const viColumn = (label: string) => [viTk, { css: '[data-slot="card"]', hasText: label, nth: 0 }] as const;
const viTile = (label: string, staff: string) =>
  [...viColumn(label), { css: 'div[class*="h-[108px]"]', hasText: staff, nth: 0 }] as const;

describe('volt-qc 09 TIME — merchant-global settings (exclusive)', () => {
  before(() => {
    assertWritesAllowed('change the Time Tracking gate and the UI language');
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await gateProbe.restoreRunGrant().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'Time Tracking gate OFF in Passcode Setting → the sidebar opens the page with no code; back ON → it asks again (TIME-040)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(5 * 60_000);
      const before = await setTimeTrackingGate(false);
      try {
        await gateProbe.clearSkip();
        await navigateRaw('/home');
        await openSidebar();
        await clickSidebarLink('Time Tracking');
        await settle(1_000);
        expect(await gateProbe.waitOpen(2_500)).toBe(false);
        expect(await gateProbe.waitMainHeading(T.pageHeading)).toBe(true);
      } finally {
        await setTimeTrackingGate(before);
      }
      if (before) {
        expect(await gateProbe.openGate('/time-tracking')).toBe(true);
        await gateProbe.dismiss();
      }
    },
  );

  it(
    title(
      'Vietnamese: Time Keeping dialog (columns, VÀO / RA, buttons, toasts, empty state, no English left) and Time Tracking page (heading, empty state, Add dialog labels) (TIME-101, TIME-102)',
      Tag.REGRESSION,
      Tag.WRITE,
      Tag.EXCLUSIVE,
    ),
    async function (this: Mocha.Context) {
      this.timeout(8 * 60_000);
      const [staff] = await pickTimeStaff(1);
      if (!staff) this.skip();
      const s = staff ?? '';
      const since = Date.now();
      try {
        await setLanguage('vi');
        await returnToHome();

        await step(
          'TIME-101 Chấm công: Ghi nhận giờ vào / ra, toasts, VÀO / RA tiles, no English',
          async () => {
            await P.exec<null>(
              'var r = window.__TSR_ROUTER__; var l = r.state.location; void r.navigate({ to: l.pathname, search: Object.assign({}, l.search || {}, { dialog: "time-keeping" }), replace: true }); return null;',
            );
            await P.waitFor(viTk, Timeouts.MEDIUM, V.tkTitle);
            expect(await P.has(viColumn(V.unavailable))).toBe(true);
            expect(await P.has(viColumn(V.available))).toBe(true);
            const search = [viTk, { css: `input[placeholder="${V.search}"]`, nth: 0 }] as const;
            await P.fillQ(search, s);
            await settle(400);
            await P.clickQ(viTile(V.unavailable, s));
            await P.clickQ([viTk, { role: 'button', name: V.checkIn, nth: 0 }]);
            expect(await toastShown(V.toastIn)).toBe(true);
            const inTile = await P.poll(
              () => P.textOf(viTile(V.available, s)).catch(() => ''),
              (t) => t.includes(V.statusIn),
              10_000,
            );
            expect(inTile).toContain(V.statusIn);
            await P.clickQ(viTile(V.available, s));
            await P.clickQ([viTk, { role: 'button', name: V.checkOut, nth: 0 }]);
            expect(await toastShown(V.toastOut)).toBe(true);
            const outTile = await P.poll(
              () => P.textOf(viTile(V.unavailable, s)).catch(() => ''),
              (t) => t.includes(V.statusOut),
              10_000,
            );
            expect(outTile).toContain(V.statusOut);
            const text = (await P.textOf(viTk)).split(s).join(' ');
            expect(text).not.toMatch(new RegExp(V.englishLeftRe));
            await P.fillQ(search, 'zzzqqq');
            await settle(400);
            expect(await P.count([viTk, { text: V.noStaff }])).toBe(2);
            await P.escape();
            await P.waitGoneQ(viTk, Timeouts.SHORT, V.tkTitle);
          },
        );

        await step(
          'TIME-102 Quản lý chấm công: heading, empty state, Add dialog labels; form errors stay English (observed)',
          async () => {
            await navigateRaw('/time-tracking');
            if (await gateProbe.waitOpen(3_000)) await gateProbe.restoreRunGrant();
            await navigateRaw('/home');
            await navigateRaw('/time-tracking');
            await P.waitFor({ role: 'heading', name: V.ttHeading }, 15_000, V.ttHeading);
            await P.fillQ({ css: `main input[placeholder="${V.search}"]`, nth: 0 }, 'zzz');
            await settle(800);
            await P.waitFor({ css: 'main', hasText: V.ttEmpty }, 15_000, V.ttEmpty);
            expect(await P.has({ css: 'main', hasText: V.ttEmptyHint })).toBe(true);
            await P.clickQ({ css: 'main button[class*="size-13"][class*="rounded-full"]', nth: 0 });
            const add = { role: 'dialog', hasText: V.addTitle, nth: -1 } as const;
            await P.waitFor(add, Timeouts.MEDIUM, V.addTitle);
            for (const l of V.addLabels) expect(await P.has([add, { text: l }])).toBe(true);
            expect(await P.has([add, { css: `[placeholder="${V.notePlaceholder}"]` }])).toBe(true);
            await P.clickQ([add, { role: 'button', name: V.add, nth: 0 }]);
            // DEV: the form schema hard-codes its messages in English (volt-qc observation for TIME-102).
            await P.waitFor([add, { text: T.staffRequired }], 5_000, T.staffRequired);
            const close = [add, { role: 'button', name: V.close, nth: 0 }] as const;
            if (await P.has(close)) await P.clickQ(close);
            else await P.escape();
            await P.waitGoneQ(add, Timeouts.SHORT, V.addTitle);
          },
        );
      } finally {
        await setLanguage('en').catch(() => undefined);
        await returnToHome().catch(() => undefined);
        await ttCleanup([s], since);
      }
    },
  );
});
