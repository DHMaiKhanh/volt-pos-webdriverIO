/**
 * volt-qc port — 09 TIME TRACKING passcode gate (no setting changed).
 *
 * Source: volt-qc `e2e/tests/09-time/time-plan-keeping.spec.ts` TIME-T07
 * (the parts that need no role-specific code: wrong code, Escape, physical
 * keyboard) plus TC rows TIME-032 / TIME-033 of
 * docs/qc/volt-qc/windows-regression/09-time-keeping.md.
 *
 * Read-only on merchant data. The run's 30-minute passcode grant is dropped to
 * see the gate and put back in `after` (`gateProbe.restoreRunGrant`). When the
 * Time Tracking gate is OFF in Passcode Setting every case skips (the gate-off
 * behaviour is covered in time-settings-exclusive.spec.ts).
 *
 * Not ported: the volt-qc T07 Staff / Manager role-code checks — this suite has no
 * role-specific staff-code fixture.
 */

import { expect } from '@wdio/globals';
import { Timeouts } from '../../../../configs/constants/timeouts.js';
import { env } from '../../../../configs/env/loadEnv.js';
import { VqcTime as T } from '../../../../src/constants/testids.voltqc-appt-time-turn.js';
import { returnToHome } from '../../../../src/flows/index.js';
import { step } from '../../../../src/helpers/steps.js';
import { gateProbe } from '../../../../src/pages/voltqc/app-perm/GateProbe.js';
import { voltQcProbe as P } from '../../../../src/pages/voltqc/pos/VoltQcProbe.js';
import { unknownCode } from '../../../../src/pages/voltqc/reports-time/rptDom.js';
import { Tag, title } from '../../../../src/types/testTags.js';

const ROUTE = '/time-tracking';

/** Open the gate fresh; skip the case when the gate is off. */
async function gateOrSkip(ctx: Mocha.Context): Promise<void> {
  if (!(await gateProbe.openGate(ROUTE))) ctx.skip();
}

describe('volt-qc 09 TIME — Time Tracking gate', () => {
  after(async function (this: Mocha.Context): Promise<void> {
    this.timeout(Timeouts.MOCHA_HOOK);
    await gateProbe.restoreRunGrant().catch(() => undefined);
    await returnToHome().catch(() => undefined);
  });

  it(
    title(
      'The gate asks for a staff code with the 30-minute skip box before any content; the Owner code opens the page (TIME-032, TIME-033)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      if (env.OWNER_PASSCODE === '') this.skip();
      await gateOrSkip(this);
      await step('TIME-032 heading + skip box, page not rendered yet', async () => {
        const s = await gateProbe.state();
        expect(s?.heading).toBe(T.gateHeading);
        expect(s?.skipLabelShown).toBe(true);
        expect(await gateProbe.mainHeadingShown(T.pageHeading)).toBe(false);
      });
      await step('TIME-033 the Owner code → heading Time Tracking and the table', async () => {
        const r = await gateProbe.submit(env.OWNER_PASSCODE);
        expect(r.result).toBe('allowed');
        expect(await gateProbe.waitMainHeading(T.pageHeading)).toBe(true);
        expect(await P.has({ css: 'main table' })).toBe(true);
      });
    },
  );

  it(
    title(
      'Wrong code is refused; Escape goes back to Pending Orders; the physical keyboard fills / erases dots and submits (TIME-036, TIME-037, TIME-042)',
      Tag.REGRESSION,
    ),
    async function (this: Mocha.Context) {
      this.timeout(3 * 60_000);
      await gateOrSkip(this);
      await step('TIME-036 an unknown code → "Invalid staff code"', async () => {
        const r = await gateProbe.submit(unknownCode());
        expect(r.result).toBe('invalid');
        await gateProbe.dismiss();
      });
      await step('TIME-037 Escape at the gate → /order-pending, no Time Tracking heading', async () => {
        expect(await gateProbe.openGate(ROUTE)).toBe(true);
        await gateProbe.pressEscape();
        const path = await P.poll(
          () => gateProbe.path(),
          (p) => p.startsWith('/order-pending'),
          10_000,
        );
        expect(path).toMatch(/^\/order-pending/);
        expect(await gateProbe.mainHeadingShown(T.pageHeading)).toBe(false);
      });
      await step(
        'TIME-042 keyboard: "12" → 2 dots, Backspace → 1, full Owner code → page',
        async function () {
          if (env.OWNER_PASSCODE === '') return;
          expect(await gateProbe.openGate(ROUTE)).toBe(true);
          await gateProbe.typeKeys('12');
          expect(await gateProbe.waitFilled(2)).toBe(2);
          await gateProbe.pressBackspaceKey();
          expect(await gateProbe.waitFilled(1)).toBe(1);
          await gateProbe.pressBackspaceKey();
          expect(await gateProbe.waitFilled(0)).toBe(0);
          const r = await gateProbe.submit(env.OWNER_PASSCODE, { keyboard: true });
          expect(r.result).toBe('allowed');
          expect(await gateProbe.waitMainHeading(T.pageHeading)).toBe(true);
        },
      );
    },
  );
});
