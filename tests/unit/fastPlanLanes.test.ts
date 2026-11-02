/**
 * The parallel-lane classifier and planner (dashboard/server/fast-plan.mjs), checked without the app.
 *
 * Two apps on one merchant share every server-side record, so which lane a file
 * may run on decides whether a lanes run means anything: a report reader beside a
 * lane that is checking out, or a card spec on a copy with no terminal, fails for
 * reasons that have nothing to do with the build. Neither shows up as a failing
 * unit of the app, so the rules are pinned here (docs/parallel-instances.md).
 *
 * Pure-function test: no app, no driver. `npm run test:unit`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { laneClass, planLanes } from '../../dashboard/server/fast-plan.mjs';

interface CatalogFile {
  path: string;
  tests: Array<{ title: string; tags: string[] }>;
}

const file = (path: string, tags: string[] = ['@regression']): CatalogFile => ({
  path,
  tests: [{ title: 't', tags }],
});
const classify = laneClass as (f: CatalogFile, source: string) => 'alone' | 'primary' | 'any';

describe('laneClass — which app a spec file may run on', () => {
  it('runs @exclusive files and report readers alone', () => {
    assert.equal(classify(file('tests/regression/settings/x.spec.ts', ['@exclusive']), ''), 'alone');
    assert.equal(classify(file('tests/regression/incomes/daily-sale-report.spec.ts'), ''), 'alone');
    assert.equal(classify(file('tests/regression/volt-qc/reports-time/rt.spec.ts'), ''), 'alone');
    assert.equal(
      classify(file('tests/regression/volt-qc/vp-tickets/vp-1048-income-summary.spec.ts'), ''),
      'alone',
    );
    assert.equal(
      classify(file('tests/regression/volt-qc/vp-tickets/vp-1341-payroll-salary.spec.ts'), ''),
      'alone',
    );
    // Who is clocked in is merchant-wide.
    assert.equal(classify(file('tests/regression/home/turn-board.spec.ts'), ''), 'alone');
    assert.equal(
      classify(file('tests/regression/volt-qc/appt-time-turn/time-keeping-write.spec.ts'), ''),
      'alone',
    );
  });

  it('holds back the whole file when only some of its tests are @exclusive', () => {
    // settings-tipping: TC-TIP-11/12 (untagged) read what TC-TIP-10 (@exclusive) saved.
    const mixed: CatalogFile = {
      path: 'tests/regression/settings/settings-tipping.spec.ts',
      tests: [
        { title: 'saves the other method', tags: ['@regression', '@exclusive'] },
        { title: 'the new method stays selected', tags: ['@regression'] },
      ],
    };
    assert.equal(classify(mixed, ''), 'alone');
  });

  it('splits a @lane-split file: its lane for the rest, alone for the @exclusive tests', () => {
    const mixed: CatalogFile = {
      path: 'tests/regression/volt-qc/oh-reopen/reopen-vq.spec.ts',
      tests: [
        { title: 'tip method on the difference', tags: ['@regression', '@exclusive'] },
        { title: 'reopen adds a line', tags: ['@regression'] },
      ],
    };
    assert.equal(classify(mixed, '/** @lane-split */'), 'split:any');
    assert.equal(classify(mixed, '/** @lane-split */ payWithGiftCards(cards)'), 'split:primary');
    // A report reader stays alone whatever the file vouches for.
    assert.equal(
      classify({ ...mixed, path: 'tests/regression/incomes/x.spec.ts' }, '/** @lane-split */'),
      'alone',
    );
  });

  it('keeps the terminal, gift cards and the appointment book on the installed app', () => {
    assert.equal(
      classify(file('tests/regression/order-flow/x.spec.ts'), 'if (env.CARD_SETTLE) await payWithCard()'),
      'primary',
    );
    assert.equal(
      classify(file('tests/regression/order-flow/x.spec.ts'), 'await payWithGiftCards(cards)'),
      'primary',
    );
    assert.equal(classify(file('tests/regression/appointment/appointment-edit.spec.ts'), ''), 'primary');
    assert.equal(classify(file('tests/web/web-to-pos.spec.ts'), ''), 'primary');
    // Device-level setup a fresh copy does not have.
    assert.equal(classify(file('tests/regression/settings/settings-receipt.spec.ts'), ''), 'primary');
  });

  it('pins on USES of the terminal / standing card, not on a kit that merely names them', () => {
    const spec = file('tests/regression/volt-qc/home-pend/home-order.spec.ts');
    // vqApp.ts / splitDeepExtra.ts define these; defining is not using.
    const kit =
      "cardSettle: str('CARD_SETTLE'), export async function terminalConnected(opts) {} openSellGiftCard()";
    assert.equal(classify(spec, kit), 'any');
    assert.equal(classify(spec, `${kit} if (!vqEnv.cardSettle) this.skip();`), 'primary');
    assert.equal(classify(spec, 'const code = GC();'), 'primary');
    // The volt-qc card pins only while it is set.
    const reads = 'const GIFT_CARD = (process.env.VOLT_TEST_GIFT_CARD ?? "").trim();';
    assert.equal(classify(spec, reads), 'primary');
    assert.equal(
      (laneClass as (f: CatalogFile, s: string, o: object) => string)(spec, reads, {
        voltTestCardSet: false,
      }),
      'any',
    );
  });

  it('shares everything else, read-only settings included', () => {
    assert.equal(
      classify(file('tests/regression/settings/settings-staffs.spec.ts'), 'await page.open()'),
      'any',
    );
    assert.equal(
      classify(file('tests/regression/order-flow/split-order.spec.ts'), 'await payInCash()'),
      'any',
    );
  });
});

describe('planLanes — queues the lanes pull from', () => {
  const catalog = [
    {
      files: [
        file('tests/regression/a/one.spec.ts'),
        file('tests/regression/a/two.spec.ts'),
        file('tests/regression/incomes/three.spec.ts'),
        file('tests/regression/a/card.spec.ts'),
        file('tests/regression/a/split.spec.ts'),
        file('tests/regression/volt-qc/_manual/stub.spec.ts'),
      ],
    },
  ];
  const specs = catalog[0]!.files.map((f) => f.path);
  const lanesOf: Record<string, string> = {
    'tests/regression/a/one.spec.ts': 'any',
    'tests/regression/a/two.spec.ts': 'any',
    'tests/regression/incomes/three.spec.ts': 'alone',
    'tests/regression/a/card.spec.ts': 'primary',
    'tests/regression/a/split.spec.ts': 'split:any',
  };
  type Group = { files: string[]; only?: 'shared' | 'exclusive' };
  const plan = (
    planLanes as unknown as (...args: unknown[]) => {
      queues: Record<string, { attach: Group[]; launch: Group[]; files: number }>;
    }
  )(catalog, specs, [], 1, {
    needsLaunch: (p: string) => p.includes('card'),
    laneOf: (p: string) => lanesOf[p],
  });

  it('splits each class into attach and launch groups, never-run stubs dropped', () => {
    assert.deepEqual(plan.queues.any!.attach.slice(0, 2), [
      { files: ['tests/regression/a/one.spec.ts'] },
      { files: ['tests/regression/a/two.spec.ts'] },
    ]);
    assert.deepEqual(plan.queues.primary!.launch, [{ files: ['tests/regression/a/card.spec.ts'] }]);
    assert.deepEqual(plan.queues.alone!.attach[0], { files: ['tests/regression/incomes/three.spec.ts'] });
    const all = Object.values(plan.queues).flatMap((q) => [...q.attach, ...q.launch].flatMap((g) => g.files));
    assert.equal(all.includes('tests/regression/volt-qc/_manual/stub.spec.ts'), false);
    assert.equal(all.length, 6);
  });

  it('queues a @lane-split file twice: shared half in its lane, exclusive half alone', () => {
    const split = 'tests/regression/a/split.spec.ts';
    assert.deepEqual(plan.queues.any!.attach.at(-1), { files: [split], only: 'shared' });
    assert.deepEqual(plan.queues.alone!.attach.at(-1), { files: [split], only: 'exclusive' });
  });
});
