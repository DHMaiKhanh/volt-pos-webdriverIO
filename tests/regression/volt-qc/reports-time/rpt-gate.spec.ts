/**
 * volt-qc port — report menu, passcode gate, 30-minute skip, offline banner.
 *
 * Source: volt-qc `e2e/tests/10-reports/rpt-plan-gate.spec.ts` (RPT-T01, T02,
 * T03a, T03c, T05), `rpt-deep.spec.ts` (RPT-D01) and `rpt-plan-data.spec.ts`
 * (RPT-T48a) — the `@readonly` ones. TC catalogue:
 * docs/qc/volt-qc/windows-regression/10-bao-cao-payroll.md.
 *
 * Read-only: the gate is typed into, never configured. Each case drops the
 * 30-minute grant to observe the guard; `after` re-arms it so the rest of the
 * lane does not start prompting. Offline is FAKED (`navigator.onLine` +
 * event), the network is never cut.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { passcodeDialog } from '../../../../src/components/modal/PasscodeDialog.js';
import {
  RptCss,
  RptRoutes,
  RptText,
  SIDEBAR_ORDER,
} from '../../../../src/constants/testids.voltqc-reports-time.js';
import { step } from '../../../../src/helpers/steps.js';
import { settle } from '../../../../src/helpers/wait.js';
import {
  clickSidebarLink,
  closeStrayDialogs,
  countText,
  expireSkip,
  fakeOnline,
  gateBackspace,
  gateElement,
  gateKey,
  gateSkipChecked,
  gateState,
  gateTickSkip,
  gateType,
  hasText,
  navigateRaw,
  offlineBanner,
  openGate,
  openReport,
  openSidebar,
  pathname,
  readSkip,
  sidebarLinkState,
  sidebarOpen,
  unknownCode,
} from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import { clearPasscodeGrant, ensurePasscodeGrant } from '../../../../src/support/passcodeGrant.js';
import { Tag, title } from '../../../../src/types/testTags.js';
import { ensure, note } from './reports-time.helpers.js';
import { browser } from '@wdio/globals';
import { Key } from 'webdriverio';

/** Wait for the gate to show an error / to stop showing one. */
async function waitGateError(present: boolean, timeout = 8_000): Promise<string> {
  let last = '';
  await browser
    .waitUntil(
      async () => {
        last = (await gateState()).error;
        return present ? last !== '' : last === '';
      },
      { timeout, interval: 200 },
    )
    .catch(() => undefined);
  return last;
}

async function escapeGate(): Promise<void> {
  if ((await gateState()).open) {
    await browser.keys([Key.Escape]);
    await settle(500);
  }
  await closeStrayDialogs();
}

describe('volt-qc RPT — menu & passcode gate', () => {
  beforeEach(async () => {
    await clearPasscodeGrant();
  });

  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await fakeOnline(true).catch(() => undefined);
    await escapeGate().catch(() => undefined);
    await ensurePasscodeGrant();
  });

  it(
    title(
      'Sidebar lists the reports once each in menu order; the clicked link is active (RPT-001)',
      Tag.REGRESSION,
    ),
    async () => {
      await navigateRaw(RptRoutes.home);
      const lines = await openSidebar();
      const idx = (s: string): number => lines.indexOf(s);

      for (const item of SIDEBAR_ORDER)
        ensure(idx(item) >= 0, `Sidebar lacks "${item}" — has: ${lines.join(' | ')}`);
      for (let i = 1; i < SIDEBAR_ORDER.length; i += 1) {
        const cur = SIDEBAR_ORDER[i] ?? '';
        const prev = SIDEBAR_ORDER[i - 1] ?? '';
        ensure(idx(cur) > idx(prev), `"${cur}" must come after "${prev}" — has: ${lines.join(' | ')}`);
      }
      const mainGroup = lines.slice(0, idx('Time Keeping'));
      for (const report of SIDEBAR_ORDER.slice(2, 6)) {
        expect(mainGroup.filter((l) => l === report)).toHaveLength(1);
      }

      await step('Click Batch History → the sidebar closes; reopened, that link is active', async () => {
        await clickSidebarLink('Batch History');
        await browser.waitUntil(async () => !(await sidebarOpen()), {
          timeout: Timeouts.SHORT,
          interval: 150,
        });
        await passcodeDialog.unlockForRun(env.OWNER_PASSCODE);
        await browser.waitUntil(async () => (await pathname()).startsWith(RptRoutes.batch), {
          timeout: Timeouts.MEDIUM,
        });
        await openSidebar();
        const active = await sidebarLinkState('Batch History');
        const other = await sidebarLinkState('Order History');
        ensure(active !== null && other !== null, 'Sidebar links not found');
        expect(active.ariaCurrent).toBe('page');
        expect(/(^|\s)bg-primary-100(\s|$)/.test(active.classes)).toBe(true);
        expect(/(^|\s)bg-primary-100(\s|$)/.test(other.classes)).toBe(false);
        expect(other.ariaCurrent).not.toBe('page');
        await browser.keys([Key.Escape]);
        await settle(300);
      });
    },
  );

  it(
    title(
      'Daily Sale gate: an unknown staff code shows "Failed to verify staff code", clears the dots and keeps the report hidden (RPT-007)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      if (!(await openGate(RptRoutes.daily))) this.skip();
      await gateType(unknownCode());

      const error = await waitGateError(true);
      expect(error).toBe(RptText.failedVerify);
      const s = await gateState();
      expect(s.open).toBe(true);
      expect(s.filled).toBe(0);
      expect(s.empty).toBe(4);
      expect(await countText(RptCss.main, 'Total Order')).toBe(0);

      await gateKey('1');
      expect(await waitGateError(false)).toBe('');
      expect((await gateState()).filled).toBe(1);
      await escapeGate();
    },
  );

  it(
    title(
      'Income Summary gate: an inactive staff code shows "This staff is inactive" (RPT-008)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      const code = (process.env['VOLT_INACTIVE_CODE'] ?? '').trim();
      if (code === '') {
        note('RPT-008 skipped: VOLT_INACTIVE_CODE (an Inactive staff code) is not set');
        this.skip();
      }
      ensure(await openGate(RptRoutes.summary), 'Income Summary did not ask for a passcode');
      await gateType(code);
      expect(await waitGateError(true)).toBe(RptText.inactive);
      expect((await gateState()).open).toBe(true);
      expect(await countText(RptCss.main, 'Total Income')).toBe(0);
      await escapeGate();
    },
  );

  it(
    title(
      'Staff Income gate: a deleted staff code shows "Failed to verify staff code" (RPT-009)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      const code = (process.env['VOLT_DELETED_CODE'] ?? '').trim();
      if (code === '') {
        note('RPT-009 skipped: VOLT_DELETED_CODE (a deleted staff code) is not set');
        this.skip();
      }
      if (!(await openGate(RptRoutes.staff))) this.skip();
      await gateType(code);
      expect(await waitGateError(true)).toBe(RptText.failedVerify);
      expect((await gateState()).open).toBe(true);
      expect(await countText(RptCss.main, 'Total staff income')).toBe(0);
      await escapeGate();
    },
  );

  it(
    title(
      'Three digits do not submit; backspace removes dots one by one; the right code opens the report (RPT-014)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      if (!(await openGate(RptRoutes.daily))) this.skip();
      expect(await (await gateBackspace()).isEnabled()).toBe(false);

      await gateType('123');
      await settle(2000);
      let s = await gateState();
      expect(s.open).toBe(true);
      expect(s.filled).toBe(3);
      expect(s.error).toBe('');

      for (const left of [2, 1, 0]) {
        await (await gateBackspace()).click();
        await settle(200);
        s = await gateState();
        expect(s.filled).toBe(left);
      }
      expect(await (await gateBackspace()).isEnabled()).toBe(false);

      await gateType(env.OWNER_PASSCODE);
      await browser.waitUntil(async () => !(await gateState()).open, {
        timeout: Timeouts.MEDIUM,
        interval: 200,
      });
      await browser.waitUntil(async () => hasText(RptCss.main, 'Total Order'), {
        timeout: Timeouts.MEDIUM,
        interval: 250,
      });
    },
  );

  it(
    title(
      'Ticking "Do not require passcode for the next 30 minutes" opens the other reports directly (RPT-015)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      if (!(await openGate(RptRoutes.daily))) this.skip();
      expect(await gateSkipChecked()).toBe(false);
      await gateTickSkip();
      const t0 = Date.now();
      await gateType(env.OWNER_PASSCODE);
      await browser.waitUntil(async () => !(await gateState()).open, {
        timeout: Timeouts.MEDIUM,
        interval: 200,
      });

      const skip = await readSkip();
      ensure(skip !== null, 'volt-passcode-skip was not written to localStorage');
      expect(typeof skip.staffId).toBe('string');
      ensure(
        Math.abs(skip.expiresAt - (t0 + 30 * 60_000)) < 60_000,
        `expiresAt ${String(skip.expiresAt)} is not ~30 minutes after ${String(t0)}`,
      );

      for (const [route, anchor] of [
        [RptRoutes.staff, 'Total staff income'],
        [RptRoutes.summary, 'Total Income'],
        [RptRoutes.payroll, /Current Period/],
        [RptRoutes.batch, 'Batch Number'],
      ] as const) {
        await step(`${route} opens without a passcode`, async () => {
          expect(await openGate(route)).toBe(false);
          await browser.waitUntil(async () => hasText(RptCss.main, anchor), {
            timeout: Timeouts.MEDIUM,
            interval: 250,
            timeoutMsg: `${route} never showed its content while the skip was active`,
          });
        });
      }
    },
  );

  it(
    title(
      'Without the skip the gate asks again; an expired skip asks again and is removed (RPT-017)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      if (!(await openGate(RptRoutes.daily))) this.skip();
      await gateType(env.OWNER_PASSCODE);
      await browser.waitUntil(async () => !(await gateState()).open, {
        timeout: Timeouts.MEDIUM,
        interval: 200,
      });
      await browser.waitUntil(async () => hasText(RptCss.main, 'Total Order'), {
        timeout: Timeouts.MEDIUM,
        interval: 250,
      });

      await step('Leave and come back without the skip → asked again', async () => {
        expect(await openGate(RptRoutes.daily)).toBe(true);
      });

      await step(
        'Tick the skip, then push its expiry into the past → asked again, grant removed',
        async () => {
          await gateTickSkip();
          await gateType(env.OWNER_PASSCODE);
          await browser.waitUntil(async () => !(await gateState()).open, {
            timeout: Timeouts.MEDIUM,
            interval: 200,
          });
          await browser.waitUntil(async () => hasText(RptCss.main, 'Total Order'), {
            timeout: Timeouts.MEDIUM,
            interval: 250,
          });
          await expireSkip();
          expect(await openGate(RptRoutes.summary)).toBe(true);
          await escapeGate();
          expect(await readSkip()).toBeNull();
        },
      );
    },
  );

  it(
    title(
      'Offline (faked) shows the warning banner on the 4 income reports, never on Batch History (RPT-021, RPT-022)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(4 * 60_000);
      await ensurePasscodeGrant();
      try {
        await openReport(RptRoutes.daily);
        await browser.waitUntil(async () => hasText(RptCss.main, 'Total Order'), {
          timeout: Timeouts.MEDIUM,
          interval: 250,
        });
        expect((await offlineBanner()).visible).toBe(false);

        await fakeOnline(false);
        for (const route of [RptRoutes.daily, RptRoutes.summary, RptRoutes.staff, RptRoutes.payroll]) {
          await step(`${route} offline`, async () => {
            await openReport(route);
            let banner = await offlineBanner();
            await browser
              .waitUntil(async () => (banner = await offlineBanner()).visible, {
                timeout: Timeouts.SHORT,
                interval: 200,
              })
              .catch(() => undefined);
            ensure(banner.visible, `${route}: no offline banner while offline`);
            expect(banner.role).toBe('alert');
            expect(banner.text).toBe(RptText.offlineBanner);
          });
        }
        await fakeOnline(true);
        await browser
          .waitUntil(async () => !(await offlineBanner()).visible, { timeout: Timeouts.SHORT, interval: 200 })
          .catch(() => undefined);
        expect((await offlineBanner()).visible).toBe(false);

        await step('RPT-022 Batch History has no banner', async () => {
          await fakeOnline(false);
          await openReport(RptRoutes.batch);
          await browser.waitUntil(async () => hasText(RptCss.main, 'Batch Number'), {
            timeout: Timeouts.MEDIUM,
            interval: 250,
          });
          expect((await offlineBanner()).visible).toBe(false);
        });
      } finally {
        await fakeOnline(true);
      }
      ensure(
        (await gateElement(Timeouts.ANIMATION)) === null,
        'A passcode guard is still up after the offline case',
      );
    },
  );
});
