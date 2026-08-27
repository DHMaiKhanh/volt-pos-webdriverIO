/**
 * Money arithmetic, in integer cents only.
 *
 * The app stores every amount as an integer number of cents and formats it with
 * currency.js (`src/lib/utils.ts` → `money()`, called with `fromCents: true`).
 * This framework has no currency.js dependency on purpose: an oracle that
 * imports the implementation it is checking cannot catch a rounding regression
 * in that implementation. So nothing here multiplies or divides a float —
 * decimals exist only at the string boundary, where text is read off the screen
 * or written by a spec.
 */

/** A signed decimal amount: `12`, `12.3`, `-1234.56`. Grouping separators are not allowed. */
const DECIMAL = /^[+-]?(\d+)(?:\.(\d+))?$/;

/** Whitespace that shows up inside rendered money strings — NBSP and narrow NBSP included. */
const MONEY_SPACE = /[\s\u00a0\u202f]/g;

function assertCents(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number of cents, received ${String(value)}.`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(
      `${label} must be an integer number of cents, received ${String(value)}. ` +
        `A fractional value here is almost always dollars that skipped toCents().`,
    );
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} is outside the safe integer range: ${String(value)} cents.`);
  }
}

/**
 * Decimal text to cents, decided on the DIGITS.
 *
 * The obvious `Math.round(value * 100)` is wrong at exactly the values a POS
 * produces: `4.615 * 100` is `461.49999999999994`, so a 15% tip on $30.77
 * rounds DOWN a cent and every downstream total is off by one. Reading the
 * third fraction digit as the rounding decision never touches a float.
 */
function centsFromDecimal(text: string, source: string): number {
  const match = DECIMAL.exec(text);
  if (!match) {
    throw new Error(`${source} could not read a decimal amount from ${JSON.stringify(text)}.`);
  }

  const whole = match[1] ?? '0';
  const fraction = `${match[2] ?? ''}000`.slice(0, 3);
  const magnitude =
    Number(whole) * 100 + Number(fraction.slice(0, 2)) + (Number(fraction.slice(2, 3)) >= 5 ? 1 : 0);

  if (!Number.isSafeInteger(magnitude)) {
    throw new Error(`${source} received an amount too large to hold as cents: ${text}.`);
  }
  return text.startsWith('-') ? -magnitude : magnitude;
}

/**
 * A decimal amount to integer cents: `12.34` and `'12.34'` both give `1234`.
 *
 * Takes a bare decimal. Formatted text (`'$1,234.56'`) goes through
 * {@link parseMoney} instead, so a spec that reads a screen and a spec that
 * writes a literal fail in different, nameable ways.
 */
export function toCents(amount: number | string): number {
  if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (!DECIMAL.test(trimmed)) {
      throw new Error(
        `toCents() takes a plain decimal amount, received ${JSON.stringify(amount)}. ` +
          `Use parseMoney() for formatted text such as "$1,234.56".`,
      );
    }
    return centsFromDecimal(trimmed, 'toCents()');
  }

  if (!Number.isFinite(amount)) {
    throw new Error(`toCents() received ${String(amount)}, which is not a finite amount.`);
  }

  // `String(1e-7)` is `'1e-7'` and `String(1e21)` is `'1e+21'` — neither is a
  // decimal literal. `toFixed(3)` recovers the small end (three digits is all
  // the rounding reads); the large end is beyond cents anyway and is rejected.
  const literal = String(amount);
  return centsFromDecimal(DECIMAL.test(literal) ? literal : amount.toFixed(3), 'toCents()');
}

/**
 * Cents back to a decimal amount.
 *
 * For handing a number to something that insists on dollars. The result is a
 * float and must not be added up — sum with {@link sumCents} and convert once,
 * at the end.
 */
export function fromCents(cents: number): number {
  assertCents(cents, 'fromCents(cents)');
  return cents / 100;
}

/**
 * Cents as the app renders them: `1234` → `$12.34`, `-123456` → `-$1,234.56`.
 *
 * Mirrors the currency.js defaults the app never overrides — symbol `$`,
 * separator `,`, decimal `.`, precision 2, `negativePattern: '-!#'`. Assembled
 * by hand rather than through `Intl.NumberFormat` so the expected string cannot
 * drift with the runner's locale or ICU build.
 */
export function formatMoney(cents: number, opts?: { symbol?: string }): string {
  assertCents(cents, 'formatMoney(cents)');
  const magnitude = Math.abs(cents);
  const whole = String(Math.trunc(magnitude / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const remainder = String(magnitude % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${opts?.symbol ?? '$'}${whole}.${remainder}`;
}

/**
 * Rendered money to cents: `'$1,234.56'` → `123456`.
 *
 * Throws on anything that is not one amount. A silent `NaN` from a cell that
 * held `'—'` or two amounts would surface much later as a total that is wrong
 * for no visible reason.
 */
export function parseMoney(text: string): number {
  const compact = text.replace(MONEY_SPACE, '');
  const negative = compact.startsWith('-');
  const body = (negative ? compact.slice(1) : compact).replace(/^[^\d.+-]+/, '').replace(/,/g, '');

  if (!DECIMAL.test(body)) {
    throw new Error(`parseMoney() could not read a single amount from ${JSON.stringify(text)}.`);
  }

  const cents = centsFromDecimal(body, 'parseMoney()');
  return negative ? -cents : cents;
}

/** Total a list of cent amounts, rejecting any member that is not integer cents. */
export function sumCents(values: number[]): number {
  let total = 0;
  for (const [index, value] of values.entries()) {
    assertCents(value, `sumCents() value at index ${String(index)}`);
    total += value;
  }
  assertCents(total, 'sumCents() total');
  return total;
}

/**
 * Assert two cent amounts match, and say what the difference LOOKS like.
 *
 * `expected 1234 to equal 12340` costs minutes of squinting; `expected $12.34
 * but got $123.40` names the bug (a stray x10) on sight.
 */
export function expectCentsEqual(actual: number, expected: number, label: string): void {
  assertCents(actual, `${label}: actual`);
  assertCents(expected, `${label}: expected`);
  if (actual === expected) return;

  throw new Error(
    `${label}: expected ${formatMoney(expected)} but got ${formatMoney(actual)} ` +
      `(off by ${formatMoney(actual - expected)}; ${String(expected)} vs ${String(actual)} cents).`,
  );
}
