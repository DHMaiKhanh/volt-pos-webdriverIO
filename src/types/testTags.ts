/**
 * Suite tags.
 *
 * Mocha has no first-class tag concept — these are substrings appended to the
 * test title and selected with `--mochaOpts.grep`. Keeping them in one table
 * stops the usual drift where `@smoke` and `@Smoke` both exist and half the
 * lane silently stops running.
 */
export const Tag = {
  /**
   * Read-only, no data created, safe against ANY environment including
   * production. The only tag `npm run test:prod` is allowed to select.
   */
  SMOKE: '@smoke',
  /** The full functional suite. Creates data — dev/staging only. */
  REGRESSION: '@regression',
  /** Revenue-path checks that gate a release. Subset of regression. */
  CRITICAL: '@critical',

  /** Creates an order / takes a payment / issues a refund. Needs WRITE_ALLOWED. */
  WRITE: '@write',
  /** Touches the payment gateway. Never runs against prod. */
  PAYMENT: '@payment',

  /**
   * Mutates merchant-GLOBAL state — app language, passcode-verification switch,
   * business info, turn settings. Two of these running together corrupt each
   * other regardless of which staff member they use, so they run last and alone.
   */
  EXCLUSIVE: '@exclusive',

  /** Asserts across BOTH windows (staff main + customer display). */
  DUAL_WINDOW: '@dual-window',
  /** Needs the local SQLCipher DB to re-derive expected numbers. */
  DB: '@db',

  /** Known-slow: app boot, sync waits, report generation. */
  SLOW: '@slow',
  /** Quarantined. Runs, but never gates a merge. */
  FLAKY: '@flaky',
} as const;

export type TagKey = keyof typeof Tag;
export type TagValue = (typeof Tag)[TagKey];

/** Compose a Mocha title with its tags: `title('Refund a paid order', Tag.CRITICAL, Tag.WRITE)`. */
export function title(text: string, ...tags: TagValue[]): string {
  return tags.length ? `${text} ${tags.join(' ')}` : text;
}
