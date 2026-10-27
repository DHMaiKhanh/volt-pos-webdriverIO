/**
 * Quarantine — spec FILES a bulk run skips.
 *
 * Why file-level and not just the `@broken` title tag: a `--mochaOpts.grep`
 * invert still LOADS and BOOTS a quarantined file before Mocha filters its
 * tests, so a fully-red file would pay a full worker spin-up + app handshake for
 * nothing. Listing the file here drops it from `specs` entirely, so a bulk run
 * never touches it. Use the `@broken` tag instead when only SOME `it`s in an
 * otherwise-green file are red.
 *
 * This list is the ONLY coverage a bulk run deliberately gives up, so keep it
 * honest:
 *   - Every entry is red because of a CONFIRMED app bug (link the ticket), not a
 *     flaky selector — fix the selector instead of hiding the spec.
 *   - Delete the entry the moment the app fix ships. A stale quarantine silently
 *     stops testing a feature that works again.
 *
 * `npm run test:failures` prints the last run's failed files so you can decide
 * what belongs here. Paths are repo-relative, forward slashes, and may be exact
 * files or globs under tests/ (a trailing `/**\/*.spec.ts` matches a folder).
 */
export const QUARANTINE: readonly string[] = [
  // e.g. 'tests/regression/order-flow/adjust-tip.spec.ts', // VP-1432 preset-replace bug
];
