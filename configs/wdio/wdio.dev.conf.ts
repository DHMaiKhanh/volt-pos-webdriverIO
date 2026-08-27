import { shared } from './wdio.shared.conf.js';

/**
 * DEV lane — the default, and the only lane that should be run casually.
 *
 * Drives a build compiled with `UPSTREAM_BASE_URI=https://volt-pos.v2.dev-fastboypay.com`.
 * Full suite, data creation allowed, one retry.
 */
export const config: WebdriverIO.Config = {
  ...shared,
};
