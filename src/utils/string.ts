import { randomBytes } from 'node:crypto';

/**
 * Text helpers for comparing what the app renders against what a spec expects.
 */

/**
 * Collapse every run of whitespace to one space and trim.
 *
 * `getText()` returns the rendered text of a subtree, so a flex row of labels
 * arrives with newlines and runs of indentation that nobody wrote in the JSX.
 * `\u200b` is added to the class because a zero-width space is NOT matched by
 * `\s` and survives into the string invisibly, making an equality check fail
 * against a value that looks identical in the terminal.
 */
export function normalizeWhitespace(s: string): string {
  return s.replace(/[\s\u200b]+/g, ' ').trim();
}

/**
 * A label to a lowercase, hyphenated, ASCII token — for artifact filenames and
 * generated test data.
 *
 * Merchant data is routinely Vietnamese (the app ships a `vi` locale), so
 * diacritics are stripped through NFD; `đ`/`Đ` has no combining form and has to
 * be replaced by hand or it would vanish with the rest of the non-ASCII.
 */
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Keep only digits — phone numbers are entered as `(555) 123-4567` and stored bare. */
export function digitsOnly(s: string): string {
  return s.replace(/\D+/g, '');
}

/**
 * A suffix that will not collide with another run's test data.
 *
 * Nothing wipes the merchant between runs: rows created by a spec are pushed
 * upstream through `/syncing/pushing` and come back on every later session, so
 * a fixed name like "E2E Customer" accumulates duplicates until a search step
 * matches the wrong one. The timestamp keeps names sorted and lets a human see
 * when the row was made; the random tail covers the case the timestamp cannot —
 * two runners (or a retry) starting inside the same millisecond.
 */
export function uniqueSuffix(prefix?: string): string {
  const stamp = Date.now().toString(36);
  const tail = randomBytes(2).toString('hex');
  return prefix ? `${prefix}-${stamp}-${tail}` : `${stamp}-${tail}`;
}
