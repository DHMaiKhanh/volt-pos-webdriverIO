/**
 * Merchant-local dates.
 *
 * The books are kept in the MERCHANT's timezone, not the machine's. The app
 * reads `host.timezone` (an IANA name) and scopes every day window with it —
 * `src/lib/merchant-day.ts` → `merchantToday()` / `merchantDayWindow()`, used by
 * the income, turn-board and batch screens. A runner in UTC+7 checking a
 * New York merchant's "today" report at 09:00 is asking about YESTERDAY at the
 * store, and the row counts will not match unless the day is resolved in the
 * merchant's zone.
 *
 * `Intl.DateTimeFormat` does all the zone maths here — no date library, and no
 * offset arithmetic of our own, which is what gets DST wrong.
 */

/**
 * The merchant's IANA timezone.
 *
 * Defaults to the reference merchant (UTC+7, no DST). Override per machine with
 * `MERCHANT_TZ` when pointing the suite at another merchant — it is read from
 * the raw environment rather than `AppEnv` because it describes the DATA under
 * test, not the binary being driven.
 */
export const MERCHANT_TIME_ZONE: string = process.env.MERCHANT_TZ ?? 'Asia/Ho_Chi_Minh';

interface CalendarDate {
  year: string;
  month: string;
  day: string;
}

/** Calendar components of `instant` as seen in `timeZone`. Throws on an unknown zone name. */
function calendarInZone(instant: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const found: Record<string, string> = {};
  for (const part of parts) found[part.type] = part.value;

  const { year, month, day } = found;
  if (!year || !month || !day) {
    throw new Error(`Could not resolve a calendar date in time zone "${timeZone}".`);
  }
  return { year, month, day };
}

function toInstant(d: Date | string, caller: string): Date {
  const instant = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`${caller} received an unparsable date: ${JSON.stringify(String(d))}.`);
  }
  return instant;
}

/**
 * Now, as UTC ISO-8601 — for log lines, report metadata and test-data stamps.
 *
 * NOT a filter value. Timestamps the app writes are RFC3339 with an explicit
 * `+00:00` offset, and the local GraphQL server compares them as raw TEXT (no
 * DATETIME() normalization in its where-builder), so `…Z` and `…+00:00` are the
 * same instant but different strings. Compare instants, never these strings.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/** The merchant's current calendar day as `yyyy-MM-dd` — what a "today" report is scoped to. */
export function todayInZone(timeZone: string = MERCHANT_TIME_ZONE): string {
  const { year, month, day } = calendarInZone(new Date(), timeZone);
  return `${year}-${month}-${day}`;
}

/**
 * A date as the app prints it: `MM/dd/yyyy` (`DATE_FORMATS.SHORT_NUMERIC`).
 *
 * Only comparable against on-screen text while the merchant language is
 * English: `VI_DISPLAY_FORMAT_MAP` in the app's `src/lib/utils.ts` remaps the
 * same format to `dd/MM/yyyy` under locale `vi`, so a language-switch spec must
 * assert on the value it expects for the active locale, not on this one.
 */
export function formatDisplayDate(d: Date | string, timeZone: string = MERCHANT_TIME_ZONE): string {
  const { year, month, day } = calendarInZone(toInstant(d, 'formatDisplayDate()'), timeZone);
  return `${month}/${day}/${year}`;
}

/** `MM/dd/yyyy`, optionally followed by `hh:mm[:ss] [AM|PM]` as the order rows print it. */
const DISPLAY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})(?:[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?)?$/i;

/**
 * Parse `MM/dd/yyyy` (with an optional time) back into a Date.
 *
 * The result is that calendar date at **midnight UTC** — a date, not an
 * instant. It has to be: the printed string carries no zone, so inventing one
 * would silently shift the day for anyone whose zone differs from the
 * merchant's. Read it with the `getUTC*` accessors or feed it straight back to
 * {@link formatDisplayDate}; do not treat it as a moment in the merchant's day.
 */
export function parseDisplayDate(text: string): Date {
  const match = DISPLAY_DATE.exec(text.replace(/[\u00a0\u202f]/g, ' ').trim());
  if (!match) {
    throw new Error(
      `parseDisplayDate() expects MM/dd/yyyy with an optional time, received ${JSON.stringify(text)}.`,
    );
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const minute = Number(match[5] ?? '0');
  const second = Number(match[6] ?? '0');
  const meridiem = match[7]?.toUpperCase();
  let hour = Number(match[4] ?? '0');

  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`parseDisplayDate() received an impossible time: ${JSON.stringify(text)}.`);
  }
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  // Date.UTC rolls overflow silently — 02/31 becomes March 3 — which would turn
  // a misread cell into a plausible-looking date instead of a failure.
  if (
    instant.getUTCFullYear() !== year ||
    instant.getUTCMonth() !== month - 1 ||
    instant.getUTCDate() !== day
  ) {
    throw new Error(`parseDisplayDate() received an impossible calendar date: ${JSON.stringify(text)}.`);
  }
  return instant;
}
