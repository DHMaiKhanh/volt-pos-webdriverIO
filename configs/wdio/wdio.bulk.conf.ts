import path from 'node:path';
import { shared } from './wdio.shared.conf.js';
import { Paths } from '../constants/paths.js';
import DashboardReporter from '../reporters/DashboardReporter.js';
import { QUARANTINE } from './quarantine.js';

/**
 * BULK lane — the whole suite, tuned to finish in as few hours as one machine
 * can manage. Same dev BUILD and the same real settles as `test:dev`; this file
 * only strips the per-run OVERHEAD that a 200-spec inventory pass cannot afford.
 *
 * It does NOT and CANNOT beat the serial floor: `maxInstances: 1` is locked by
 * the single-instance app + shared SQLCipher DB (see wdio.shared.conf.ts), so
 * 2208 cases still run one after another. Sub-hour needs sharding across
 * machines — see docs/bulk-run.md. What this lane buys back:
 *
 *   1. Retries off — set by the `test:bulk` script (SPEC_RETRIES=0). A failing
 *      spec runs once, not three times; re-run just the reds with
 *      `npm run test:failures`. This is the single biggest saving.
 *   2. No Allure — the default reporter logs EVERY WebDriver command as a step
 *      and screenshots each one. Dropping it removes real per-command I/O with
 *      zero coverage loss; spec + DashboardReporter still feed the GUI + history.
 *   3. Quarantine + manual excluded — `@broken` app-bug files and the `_manual`
 *      it.skip stubs are dropped from `specs`, so neither pays a worker boot.
 *
 * Everything else — real card/cash/gift settles, every green spec — runs exactly
 * as it does on the normal dev lane.
 */

const toAbs = (p: string): string => (path.isAbsolute(p) ? p : path.join(Paths.ROOT, p));

export const config: WebdriverIO.Config = {
  ...shared,

  // Drop whole files before any worker boots them: the `_manual` stubs (all
  // it.skip, but each still spins a worker) and every confirmed-app-bug file.
  exclude: [
    path.join(Paths.TESTS, 'regression', 'volt-qc', '_manual', '*.spec.ts'),
    // `_recovery/` holds exploratory PROBE/DEMO specs (cash-demo, *-scan, *-probe,
    // *-verify) used to reproduce a defect by hand — NOT authoritative regression.
    // Some target a different merchant (20258) than this machine (14), so they
    // always red and burn a full timeout each. Dropped from the bulk inventory.
    path.join(Paths.TESTS, '_recovery', '*.spec.ts'),
    ...QUARANTINE.map(toAbs),
  ],

  // Skip `@broken` tests that live INSIDE an otherwise-green file (file-level
  // reds go in `exclude` above). `invert` flips grep to "run everything NOT
  // tagged @broken". Safe to pin here: the GUI runner builds its own grep off
  // wdio.dev.conf, never this file, so there is nothing to collide with.
  mochaOpts: {
    ...shared.mochaOpts,
    grep: '@broken',
    invert: true,
  },

  // Reporters without Allure. DashboardReporter MUST stay — the GUI runner tails
  // its live events and the history.json it writes is what the dashboard shows.
  reporters: [
    ['spec', { symbols: { passed: '[PASS]', failed: '[FAIL]', skipped: '[SKIP]' } }],
    [DashboardReporter, {}],
  ],
};
