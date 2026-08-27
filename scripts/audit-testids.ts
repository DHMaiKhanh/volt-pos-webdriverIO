/**
 * `npm run audit:testids`
 *
 * Cross-references every `data-testid` this suite declares (src/constants/testids.ts)
 * against every `data-testid` the app actually renders (VOLT_POS_SRC), and prints
 * the gap.
 *
 * ## Why this is a report and not a gate
 *
 * The app ships far fewer testids than the suite wants, which is why every
 * locator carries a reviewed fallback selector (see `src/helpers/selectors.ts`).
 * A missing id therefore does not break a run — it makes the run depend on a
 * CSS path that some refactor will silently invalidate. The useful output is
 * the list a developer can paste into the app to retire those fallbacks, so
 * this exits 0 by default. `--strict` turns it into a gate for a CI job that
 * has decided to hold the line.
 *
 * ## What counts as "present"
 *
 * Static attributes (`data-testid="foo"`) match exactly, as do ids handed to a
 * component through a `testId` prop (`pay-period-summary-card.tsx` stamps
 * `data-testid={testId}`). Templated ones
 * (`data-testid={`oh-refund-service-item-${id}`}`) are turned into a pattern, so
 * a locator for `oh-refund-service-item-42` is correctly reported as present.
 * `data-testid={someVariable}` cannot be resolved statically at all; those are
 * counted and named rather than guessed at.
 *
 * Flags:
 *   --strict         exit 1 when any declared testid is missing from the app
 *   --missing-only   print only the rows that are missing
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from '../configs/env/loadEnv.js';
import { ALL_LOCATOR_GROUPS, FACTORY_TESTID_PREFIXES } from '../src/constants/testids.js';

const line = (text = ''): void => console.log(text);

const strict = process.argv.includes('--strict');
const missingOnly = process.argv.includes('--missing-only');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', 'coverage', '.turbo', '.vite']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// ── Reading the suite's declared locators ───────────────────────────────────

interface DeclaredLocator {
  group: string;
  name: string;
  testId: string;
  fallbacks: number;
}

interface LocatorLike {
  readonly name?: unknown;
  readonly testId?: unknown;
  readonly fallbacks?: unknown;
}

function isLocator(value: unknown): value is LocatorLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LocatorLike).testId === 'string' &&
    (value as LocatorLike).testId !== ''
  );
}

/**
 * Walk `ALL_LOCATOR_GROUPS` structurally rather than against a fixed type.
 *
 * That file is owned by the page-object layer and grows constantly; a rigid
 * shape here would mean editing the audit every time someone adds a screen.
 * The walk handles the two shapes that make sense — a record of records, and a
 * list of `{ name, locators }` descriptors — and identifies a leaf by its
 * `testId`, which is the only field this report needs.
 */
function flatten(value: unknown, trail: readonly string[], out: DeclaredLocator[], depth = 0): void {
  if (depth > 8) return;

  if (isLocator(value)) {
    const fallbacks = Array.isArray(value.fallbacks) ? value.fallbacks.length : 0;
    out.push({
      group: trail.slice(0, -1).join('.') || 'ungrouped',
      name: typeof value.name === 'string' && value.name ? value.name : (trail.at(-1) ?? '(unnamed)'),
      testId: String(value.testId),
      fallbacks,
    });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, [...trail, String(index)], out, depth + 1));
    return;
  }

  if (typeof value !== 'object' || value === null) return;

  const record = value as Record<string, unknown>;
  const label = record.name;
  const nested = record.locators;
  if (typeof label === 'string' && typeof nested === 'object' && nested !== null) {
    flatten(nested, [...trail.slice(0, -1), label], out, depth + 1);
    return;
  }

  for (const [key, child] of Object.entries(record)) {
    flatten(child, [...trail, key], out, depth + 1);
  }
}

// ── Reading the app's rendered testids ──────────────────────────────────────

interface AppScan {
  root: string;
  filesScanned: number;
  /** `data-testid="foo"` — the ideal case. */
  literals: Map<string, string[]>;
  /** ``data-testid={`foo-${id}`}`` — matched as a pattern. */
  patterns: { source: string; regex: RegExp; file: string }[];
  /** `data-testid={someVariable}` — cannot be resolved without running the app. */
  unresolved: { expression: string; file: string }[];
}

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `foo-${id}-bar` becomes `/^foo-[^"]+-bar$/`, so an instance id still matches. */
function templateToRegex(template: string): RegExp {
  const literalParts = template.split(/\$\{[^}]*\}/g).map(escapeRegex);
  return new RegExp(`^${literalParts.join('[^"]+')}$`);
}

function listSourceFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // `__tests__` and `*.test.tsx` mock components with throwaway testids
        // (`<span data-testid={name} />`). Counting those as shipped ids would
        // report locators as present that no real screen renders.
        if (SKIP_DIRS.has(entry.name) || entry.name === '__tests__') continue;
        walk(full);
      } else if (
        SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
        !/\.(test|spec)\.[jt]sx?$/.test(entry.name)
      ) {
        files.push(full);
      }
    }
  };
  walk(root);
  return files;
}

function scanApp(root: string): AppScan {
  const scan: AppScan = { root, filesScanned: 0, literals: new Map(), patterns: [], unresolved: [] };

  const record = (id: string, file: string): void => {
    const seen = scan.literals.get(id);
    if (seen) seen.push(file);
    else scan.literals.set(id, [file]);
  };

  for (const file of listSourceFiles(root)) {
    const content = fs.readFileSync(file, 'utf8');
    scan.filesScanned += 1;
    const relative = path.relative(root, file);

    // JSX attribute: data-testid="value" / data-testid='value'
    for (const match of content.matchAll(/data-testid\s*=\s*["']([^"']+)["']/g)) {
      if (match[1]) record(match[1], relative);
    }
    // Object property form: { 'data-testid': 'value' }
    for (const match of content.matchAll(/["']data-testid["']\s*:\s*["']([^"']+)["']/g)) {
      if (match[1]) record(match[1], relative);
    }
    // Templated attribute: data-testid={`prefix-${expr}`}
    for (const match of content.matchAll(/data-testid\s*=\s*\{\s*`([^`]+)`\s*\}/g)) {
      const source = match[1];
      if (source) scan.patterns.push({ source, regex: templateToRegex(source), file: relative });
    }
    // Indirect attribute: `data-testid={testId}` fed by a component prop.
    //
    // `pay-period-summary-card.tsx` stamps `data-testid={testId}` and its two
    // call sites pass `testId="pay-period-current"` / `"pay-period-scheduled"`.
    // Both ids DO ship, but neither ever appears next to the word `data-testid`,
    // so the literal pass above misses them and the report called them missing —
    // sending someone off to add an attribute the app already has.
    //
    // Collecting the prop literal is exact rather than heuristic here: a
    // `testId` / `testid` prop exists in this codebase for one reason, which is
    // to reach a `data-testid`. The indirection is still recorded below so a
    // prop that is passed a VARIABLE stays visible as unresolved.
    for (const match of content.matchAll(/\btestI[dD]\s*=\s*["']([^"']+)["']/g)) {
      if (match[1]) record(match[1], relative);
    }
    // Anything else in braces resolves only at runtime.
    for (const match of content.matchAll(/data-testid\s*=\s*\{\s*([^`{][^}]*)\}/g)) {
      const expression = match[1]?.trim();
      if (expression) scan.unresolved.push({ expression, file: relative });
    }
  }

  return scan;
}

// ── Matching ────────────────────────────────────────────────────────────────

type Presence = 'exact' | 'pattern' | 'prefix' | 'missing';

/** First app-side id that starts with `prefix`, literal or templated. */
function firstWithPrefix(prefix: string, scan: AppScan): string | null {
  for (const id of scan.literals.keys()) {
    if (id.startsWith(prefix)) return id;
  }
  return scan.patterns.find((p) => p.source.startsWith(prefix))?.source ?? null;
}

function presenceOf(testId: string, scan: AppScan): Presence {
  if (scan.literals.has(testId)) return 'exact';
  if (scan.patterns.some((p) => p.regex.test(testId))) return 'pattern';
  // A locator whose id ends in `-` addresses a SET of rows (see the "Collection
  // locators" note in src/constants/testids.ts). Its exact form never renders,
  // so it is present exactly when the app emits anything under that prefix.
  if (testId.endsWith('-') && firstWithPrefix(testId, scan)) return 'prefix';
  return 'missing';
}

/**
 * Report on the parameterised id factories.
 *
 * `src/constants/testids.ts` builds ids like `staff-item-<id>` at call time, so
 * they cannot be enumerated the way the locator groups can — the value only
 * exists once a row is on screen. The prefix list is the audit's only handle on
 * them, and without this section every row, tile and keypad key would look
 * absent.
 */
function renderFactorySection(scan: AppScan): { present: number; total: number } {
  const rows = FACTORY_TESTID_PREFIXES.map((prefix) => ({
    prefix,
    example: firstWithPrefix(prefix, scan),
  }));
  const present = rows.filter((r) => r.example).length;

  line('='.repeat(78));
  line(' PARAMETERISED ID FACTORIES (prefix-matched — the exact id needs a runtime value)');
  line('='.repeat(78));

  const prefixW = Math.max('PREFIX'.length, ...rows.map((r) => r.prefix.length));
  line(`  ${'PREFIX'.padEnd(prefixW)}  ${'IN APP'.padEnd(8)}  EXAMPLE FOUND IN THE APP`);
  line(`  ${'-'.repeat(prefixW)}  ${'-'.repeat(8)}  ${'-'.repeat(40)}`);
  for (const row of rows) {
    line(
      `  ${row.prefix.padEnd(prefixW)}  ${(row.example ? 'yes' : 'MISSING').padEnd(8)}  ` +
        `${row.example ?? '(nothing renders under this prefix)'}`,
    );
  }
  line();
  line(` ${String(present)} of ${String(rows.length)} prefix families render in the app.`);
  line();
  return { present, total: rows.length };
}

// ── Report ──────────────────────────────────────────────────────────────────

interface Row {
  group: string;
  name: string;
  testId: string;
  presence: Presence;
  fallbacks: number;
}

const PRESENCE_LABEL: Record<Presence, string> = {
  exact: 'yes',
  pattern: 'yes (template)',
  prefix: 'yes (rows)',
  missing: 'MISSING',
};

function renderTable(rows: readonly Row[]): void {
  const header = {
    group: 'GROUP',
    name: 'LOCATOR',
    testId: 'TESTID',
    presence: 'IN APP',
    fallbacks: 'FALLBACKS',
  };
  const cells = [
    header,
    ...rows.map((r) => ({
      group: r.group,
      name: r.name,
      testId: r.testId,
      presence: PRESENCE_LABEL[r.presence],
      fallbacks: String(r.fallbacks),
    })),
  ];

  const groupW = Math.max(...cells.map((c) => c.group.length));
  const nameW = Math.max(...cells.map((c) => c.name.length));
  const testIdW = Math.max(...cells.map((c) => c.testId.length));
  const presenceW = Math.max(...cells.map((c) => c.presence.length));

  const [head, ...body] = cells;
  if (!head) return;

  const render = (c: (typeof cells)[number]): string =>
    `  ${c.group.padEnd(groupW)}  ${c.name.padEnd(nameW)}  ${c.testId.padEnd(testIdW)}  ` +
    `${c.presence.padEnd(presenceW)}  ${c.fallbacks.padStart(header.fallbacks.length)}`;

  line(render(head));
  line(
    `  ${'-'.repeat(groupW)}  ${'-'.repeat(nameW)}  ${'-'.repeat(testIdW)}  ${'-'.repeat(presenceW)}  ` +
      '-'.repeat(header.fallbacks.length),
  );

  let previousGroup = '';
  for (const [index, cell] of body.entries()) {
    const row = rows[index];
    if (row && row.group !== previousGroup && previousGroup !== '') line();
    previousGroup = row?.group ?? previousGroup;
    line(render(cell));
  }
}

function explainMissingSource(voltPosSrc: string): number {
  line();
  line('='.repeat(78));
  line(' TESTID AUDIT — cannot run');
  line('='.repeat(78));
  line();
  if (!voltPosSrc) {
    line('  VOLT_POS_SRC is not set, so there is no app source to compare against.');
    line();
    line('  Point it at your volt-pos checkout (the folder holding src/ and src-tauri/):');
    line();
    line('    configs/env/.env.dev        VOLT_POS_SRC=D:/2.POS/volt-pos/volt-pos');
    line('    or, for one run:            cross-env VOLT_POS_SRC=... npm run audit:testids');
    line();
  } else {
    line(`  VOLT_POS_SRC points at ${voltPosSrc}, which does not exist.`);
    line();
    line('  Fix the path in configs/env/.env.<ENV> (it must be the repo root of the app under');
    line('  test, the folder holding src/ and src-tauri/).');
    line();
  }
  line('  This is a reporting tool only — no test lane depends on it.');
  line();
  return strict ? 1 : 0;
}

function main(): number {
  const env = loadEnv();
  const checkout = env.VOLT_POS_SRC.trim();

  if (!checkout || !fs.existsSync(checkout)) return explainMissingSource(checkout);

  const srcDir = path.join(checkout, 'src');
  const root = fs.existsSync(srcDir) ? srcDir : checkout;

  const declared: DeclaredLocator[] = [];
  flatten(ALL_LOCATOR_GROUPS, [], declared);
  declared.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

  const scan = scanApp(root);
  const rows: Row[] = declared.map((d) => ({
    group: d.group,
    name: d.name,
    testId: d.testId,
    presence: presenceOf(d.testId, scan),
    fallbacks: d.fallbacks,
  }));

  const missing = rows.filter((r) => r.presence === 'missing');
  const stranded = missing.filter((r) => r.fallbacks === 0);
  const groups = new Set(rows.map((r) => r.group));
  const coverage = rows.length ? Math.round(((rows.length - missing.length) / rows.length) * 100) : 0;

  line();
  line('='.repeat(78));
  line(' TESTID AUDIT — what the suite expects vs what the app renders');
  line('='.repeat(78));
  line(' Suite locators   src/constants/testids.ts');
  line(` App source       ${root}`);
  line(` Files scanned    ${String(scan.filesScanned)} (excluding __tests__ and *.test.*)`);
  line('='.repeat(78));
  line();

  if (!rows.length) {
    line('  No locators are declared in src/constants/testids.ts yet — nothing to audit.');
    line();
    return 0;
  }

  renderTable(missingOnly ? missing : rows);
  line();

  const factories = renderFactorySection(scan);

  line('='.repeat(78));
  line(' SUMMARY');
  line('='.repeat(78));
  line(` Declared by the suite     ${String(rows.length)} locators across ${String(groups.size)} group(s)`);
  line(` Present in the app        ${String(rows.length - missing.length)}  (${String(coverage)}%)`);
  line(` Missing from the app      ${String(missing.length)}`);
  line(` Missing AND no fallback   ${String(stranded.length)}`);
  line(` Id factories rendering    ${String(factories.present)} of ${String(factories.total)} prefixes`);
  line();
  line(` App renders               ${String(scan.literals.size)} literal data-testid value(s)`);
  line(`                           ${String(scan.patterns.length)} templated value(s)`);
  line(`                           ${String(scan.unresolved.length)} runtime expression(s) (not auditable)`);
  line('='.repeat(78));
  line();

  if (stranded.length) {
    line(' THESE ARE THE DANGEROUS ONES');
    line(' Missing from the app AND with no fallback selector declared, so the page object has');
    line(' nothing to fall back to and the spec fails on a "not found" that reads like a bug in');
    line(' the app:');
    line();
    const groupW = Math.max(...stranded.map((r) => r.group.length));
    const nameW = Math.max(...stranded.map((r) => r.name.length));
    for (const row of stranded) {
      line(`   ${row.group.padEnd(groupW)}  ${row.name.padEnd(nameW)}  ${row.testId}`);
    }
    line();
  }

  if (scan.unresolved.length) {
    line(' Runtime-computed testids in the app (this audit cannot see their values):');
    const seen = new Set<string>();
    for (const item of scan.unresolved) {
      const key = `${item.file}:${item.expression}`;
      if (seen.has(key)) continue;
      seen.add(key);
      line(`   data-testid={${item.expression}}   ${item.file}`);
    }
    line();
    line(' If a locator below is reported MISSING but you believe one of these renders it,');
    line(' check the prop by hand — a testid passed in from a caller cannot be matched here.');
    line();
  }

  if (!missing.length) {
    line(' Every declared testid exists in the app. Delete the fallback selectors in');
    line(' src/constants/testids.ts — they are scaffolding, and a stale fallback that still');
    line(' matches is worse than none.');
    line();
    return 0;
  }

  line('='.repeat(78));
  line(' COPY THIS TO THE APP TEAM');
  line('='.repeat(78));
  line(` ${String(missing.length)} data-testid value(s) the E2E suite expects but the app does not render.`);
  line(' Add them to the matching element in the app; the suite then drops its fallback.');
  line();

  let previousGroup = '';
  const emitted = new Set<string>();
  for (const row of missing) {
    if (row.group !== previousGroup) {
      if (previousGroup) line();
      line(`  # ${row.group}`);
      previousGroup = row.group;
    }
    if (emitted.has(row.testId)) continue;
    emitted.add(row.testId);
    // A trailing dash is a collection locator: the app renders one id per row,
    // so pasting the literal would be wrong. Show the templated form instead.
    line(
      row.testId.endsWith('-')
        ? '  data-testid={`' + row.testId + '${id}`}' + `   // one per ${row.name}`
        : `  data-testid="${row.testId}"`,
    );
  }
  line();
  line('='.repeat(78));
  line();

  if (strict) {
    line(` --strict: failing because ${String(missing.length)} declared testid(s) are missing.`);
    line();
    return 1;
  }

  line(' This report never blocks a run. Add --strict in a CI job that wants it to.');
  line();
  return 0;
}

process.exitCode = main();
