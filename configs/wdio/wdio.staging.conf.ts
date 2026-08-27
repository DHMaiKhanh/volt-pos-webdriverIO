import { Paths } from '../constants/paths.js';
import { shared } from './wdio.shared.conf.js';
import path from 'node:path';

/**
 * STAGING lane — the release gate.
 *
 * Same coverage as dev, but it runs against the build QC signs off on, so it
 * stops at the first failure: a broken staging build should not spend twenty
 * minutes proving the rest still works.
 */
export const config: WebdriverIO.Config = {
  ...shared,
  bail: 1,
  specs: [path.join(Paths.TESTS, '**', '*.spec.ts')],
};
