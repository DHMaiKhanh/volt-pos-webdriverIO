import path from 'node:path';
import { Paths } from '../constants/paths.js';
import { loadEnv } from '../env/loadEnv.js';
import { shared } from './wdio.shared.conf.js';

const env = loadEnv();

/**
 * PRODUCTION lane — read-only smoke only.
 *
 * ## Why this file refuses to run anything else
 *
 * A production build points at the live payment gateway and pushes every local
 * row upstream through `/syncing/pushing`. A checkout spec here does not
 * simulate a sale, it MAKES one: a real order against a real merchant, a real
 * card authorisation, real money in someone's daily report.
 *
 * So the spec set is hard-pinned to `tests/smoke`, the DB is never reset (it
 * belongs to a live till), and retries are off — a flaky production result is a
 * finding, not something to paper over.
 *
 * The `assertWritesAllowed()` guard in the flows is the second line of defence;
 * this is the first.
 */
if (env.ENV !== 'prod') {
  throw new Error(`wdio.prod.conf.ts loaded with ENV=${env.ENV}. Run it via \`npm run test:prod\`.`);
}

export const config: WebdriverIO.Config = {
  ...shared,
  specs: [path.join(Paths.TESTS, 'smoke', '**', '*.spec.ts')],
  suites: { smoke: [path.join(Paths.TESTS, 'smoke', '**', '*.spec.ts')] },
  specFileRetries: 0,
  bail: 1,
};
