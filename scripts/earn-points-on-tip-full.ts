/**
 * `npm run test:earn-points-on-tip:full` — VP-4812 end to end, both sides of the toggle.
 *
 * For each of ON then OFF: set "Earn points on tip" on the Fastboy Portal (web
 * lane, QR-signed `.portal-profile/`), then run the POS spec, which gates its
 * cases on the value it reads back. Both passes always run; the exit code is
 * non-zero if any step failed.
 *
 * `--end=on|off` picks the side to finish on (default: the order below, so OFF).
 * First run on a machine: `npm run portal:login` and scan the QR once.
 */

import { spawnSync } from 'node:child_process';

const order: Array<'on' | 'off'> = ['on', 'off'];
const end = process.argv.find((a) => a.startsWith('--end='))?.slice('--end='.length);
if (end === 'on') order.reverse();

const run = (script: string): number => {
  console.log(`\n>>> npm run ${script}\n`);
  return spawnSync('npm', ['run', script], { stdio: 'inherit', shell: true }).status ?? 1;
};

const results: Array<{ step: string; code: number }> = [];
for (const side of order) {
  const portal = run(`portal:earn-on-tip:${side}`);
  results.push({ step: `Portal → ${side.toUpperCase()}`, code: portal });
  if (portal !== 0) {
    results.push({ step: `POS spec (${side.toUpperCase()})`, code: -1 });
    continue; // the POS pass would measure the wrong side of the toggle
  }
  results.push({ step: `POS spec (${side.toUpperCase()})`, code: run('test:earn-points-on-tip') });
}

console.log('\n' + '='.repeat(60));
for (const { step, code } of results) {
  console.log(`  ${code === 0 ? 'PASS' : code === -1 ? 'SKIP' : 'FAIL'}  ${step}`);
}
console.log('='.repeat(60));
process.exit(results.some((r) => r.code !== 0) ? 1 : 0);
