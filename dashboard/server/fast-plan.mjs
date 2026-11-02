/**
 * ⚡ Chạy nhanh — pure planning for the GUI's fast mode (kept apart from
 * runner.mjs so it can be checked without starting the server).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * Calls that pay or drive the customer display. CDP attach reaches the staff
 * window only — the customer window can be primed to /customer/, but payments
 * still wedge on it — so a file that makes any of these calls runs on LAUNCH.
 * The tags catch the declared ones; this catches the cash flows that pay without
 * a tag (e.g. `payInCash` inside an order-history spec).
 */
const LAUNCH_ONLY_CALLS =
  /CustomerDisplay|switchToCustomer|withCustomerWindow|payInCash|payWithCard|payWithGiftCards|completeCustomerTip|chargeCard|completePayment|payProbe/;

/** Relative imports worth following: the spec's own kits, not the shared page objects every spec imports. */
const LOCAL_KIT = /^(tests\/|src\/pages\/voltqc\/)/;

/**
 * The spec's source plus every local kit it imports, transitively — a reopen
 * spec that pays through `ohReopen.ts` must read as paying. Shared modules
 * (src/flows, src/pages/pos) are not followed: every spec reaches the checkout
 * flow through them, which would send the whole suite to launch.
 */
export function specSourceWithKits(repoRoot, relPath, seen = new Set()) {
  if (seen.has(relPath)) return '';
  seen.add(relPath);
  let src;
  try {
    src = readFileSync(path.join(repoRoot, relPath), 'utf8');
  } catch {
    return '';
  }
  let out = src;
  for (const [, spec] of src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = path
      .relative(repoRoot, path.resolve(repoRoot, path.dirname(relPath), spec.replace(/\.js$/, '.ts')))
      .replace(/\\/g, '/');
    if (LOCAL_KIT.test(target) && existsSync(path.join(repoRoot, target))) {
      out += `\n${specSourceWithKits(repoRoot, target, seen)}`;
    }
  }
  return out;
}

/**
 * Must this file run in LAUNCH mode (both windows real), or can it attach to the
 * pre-warmed app? `source` is {@link specSourceWithKits}' text for the file.
 */
export function needsLaunch(file, source) {
  if (file.path.includes('/cd-e2e/') || file.path.startsWith('tests/web/')) return true;
  if (file.tests.some((t) => t.tags.includes('@payment') || t.tags.includes('@dual-window'))) return true;
  return LAUNCH_ONLY_CALLS.test(source);
}

/** Never executed by a fast run: it.skip stubs and hand-repro probes. */
const isNeverRun = (p) => p.includes('/volt-qc/_manual/') || p.startsWith('tests/_recovery/');

/**
 * Mocha grep as lookaheads, so "NOT these tags" and "has one of the picked
 * tags" combine in one RegExp (mocha's `invert` can only do one or the other).
 */
export function fastGrep({ exclude, userTags = [], require = [] }) {
  let re = `^(?!.*(?:${exclude.map(escapeRe).join('|')}))`;
  if (userTags.length) re += `(?=.*(?:${userTags.map(escapeRe).join('|')}))`;
  for (const tag of require) re += `(?=.*${escapeRe(tag)})`;
  return `/${re}/`;
}

/** `files` cut into runs of `size` — each one wdio worker (one session). */
function chunk(files, size) {
  const groups = [];
  for (let i = 0; i < files.length; i += size) groups.push(files.slice(i, i + size));
  return groups;
}

/**
 * The picked specs as GROUPS of `groupSize` files. Each group is one wdio
 * worker = one session; a wedged app only costs the rest of its own group,
 * never the whole run. `_manual` / `_recovery` files and files with nothing left
 * to run are dropped; `@broken` tests are counted out here and grepped out at
 * run time.
 *
 * With `needsLaunch` (path → boolean) the files split in two, attach first:
 *   - `attachGroups` run ATTACHED to the app the GUI keeps pre-warmed — no boot
 *     at all, so the first test starts within seconds of pressing Run;
 *   - `launchGroups` (payments, customer display) launch their own app per
 *     group, both windows real.
 * Without it every file is a launch file (`attachGroups` empty).
 */
export function planFast(catalog, specs, userTags, groupSize, { needsLaunch: launchOnly } = {}) {
  const byPath = new Map(catalog.flatMap((f) => f.files).map((f) => [f.path, f]));
  const runnable = (t) =>
    !t.tags.includes('@broken') && (!userTags.length || t.tags.some((g) => userTags.includes(g)));
  const files = [];
  let planned = 0;
  for (const p of specs) {
    if (isNeverRun(p)) continue;
    const n = (byPath.get(p)?.tests ?? []).filter(runnable).length;
    if (n === 0) continue;
    files.push(p);
    planned += n;
  }
  const size = Math.max(1, groupSize || files.length);
  const attachFiles = launchOnly ? files.filter((p) => !launchOnly(p)) : [];
  const launchFiles = files.filter((p) => !attachFiles.includes(p));
  const attachGroups = chunk(attachFiles, size);
  const launchGroups = chunk(launchFiles, size);
  return {
    groups: [...attachGroups, ...launchGroups],
    attachGroups,
    launchGroups,
    attachFiles,
    files,
    planned,
  };
}

/* ── Parallel lanes (docs/parallel-instances.md) ─────────────────────────────── */

/**
 * Report readers: their totals move whenever ANY device on the merchant takes a
 * payment, so they cannot share the merchant with a lane that is checking out.
 * Clock-in / turn files too: who is checked in is merchant-wide, and a staff
 * card the other lane just clocked out is gone from this lane's board (TC-TURN-11
 * in the first lanes run). (Files that mutate other merchant-global state carry
 * `@exclusive` — docs/writing-tests.md.) All run last, every other instance stopped.
 *
 * `@exclusive` sits on tests, but a file is held back whole: the tests around a
 * tagged one often read the state it saved (settings-tipping TC-TIP-11/12 check
 * the method TC-TIP-10 saved, untagged), so running the untagged rest in a lane
 * broke them in the 01/11 smoke — for ~7 min simulated gain.
 *
 * The vp-tickets report specs (daily sale, income summary, payroll, wage) are
 * report readers too: in the 01/11 lanes run VP-1048's income summary read the
 * totals while the other lane was paying, and missed by $2.46 and $407.05.
 */
const ALONE_PATH =
  /\/incomes\/|volt-qc\/reports-time\/|turn-board|time-keeping|time-tracking|turn-(count|adjust)|vp-tickets\/vp-\d+-(daily-sale|income-summary|payroll|wage)/;

/**
 * Files that need what only the installed app's device has — the paired card
 * terminal, the standing gift cards, the appointment book the web lane writes to,
 * and the DEVICE-level setup a fresh copy lacks (receipt/printer options: every
 * settings-receipt case failed on the copy in the first lanes run, all passed on
 * the installed app). They run on instance 0 while the other instances take
 * shared work.
 */
const PRIMARY_PATH =
  /\/appointment\/|^tests\/web\/|volt-qc\/(card-terminal|pay)\/|\/checkout-type\/|receipt|payment-gateway/;
/**
 * USES of the terminal or the standing gift card — calls and env reads, not
 * names. Matching the bare word `GiftCard` / `CARD_SETTLE` sent ~60 files to
 * instance 0 only because a shared volt-qc kit defines gift-card helpers or
 * reads the env (vqApp.ts, homePendProbe.ts); in the 02/11 run that made
 * instance 0's queue the critical path while the copy sat idle. A definition
 * (`function terminalConnected(`) is not a use.
 */
const PRIMARY_CALLS = new RegExp(
  [
    String.raw`(?<!function\s)\b(?:payWithCard|chargeCard|payWithGiftCards|requireGiftCardCode|requireCardTerminal|terminalConnected|GC)\s*\(`,
    String.raw`\bgiftCard\.code\b`,
    String.raw`\bvqEnv\.cardSettle\b`,
    String.raw`\b(?:process\.)?env\.(?:CARD_SETTLE|GIFT_CARD_CODE)\b`,
  ].join('|'),
);

/**
 * The volt-qc gift card (`VOLT_TEST_GIFT_CARD`). Unset, as on this machine, every
 * case reading it skips on whichever app it runs, so it pins nothing; set, two
 * apps would spend one card at once, so its readers stay on instance 0.
 */
const VOLT_TEST_CARD_READS = /\bvqEnv\.testGiftCard\b|\bVOLT_TEST_GIFT_CARD\b|(?<!const\s)\btestGiftCard\s*\(/;

/**
 * A spec whose header carries `@lane-split` vouches that each of its `@exclusive`
 * tests restores what it changed (try/finally or a `with…` wrapper) and that no
 * other test reads that state. Its untagged tests then run in a lane and only the
 * `@exclusive` ones wait for the alone phase. Holding such files back whole made
 * the alone phase ~190 min of the 02/11 run, with the copy idle all that time;
 * reopen-vq alone was 20 min for 3 exclusive tests out of 30.
 */
const LANE_SPLIT = /@lane-split\b/;

/**
 * 'alone' | 'primary' | 'any' for a file — or 'split:primary' / 'split:any' for a
 * `@lane-split` file, whose `@exclusive` tests go alone and the rest to that lane.
 * `source` is {@link specSourceWithKits}' text; `voltTestCardSet` says whether
 * `VOLT_TEST_GIFT_CARD` has a value for this run.
 */
export function laneClass(file, source, { voltTestCardSet = true } = {}) {
  const pinned =
    PRIMARY_PATH.test(file.path) ||
    PRIMARY_CALLS.test(source) ||
    (voltTestCardSet && VOLT_TEST_CARD_READS.test(source));
  const base = pinned ? 'primary' : 'any';
  if (ALONE_PATH.test(file.path)) return 'alone';
  if (!file.tests.some((t) => t.tags.includes('@exclusive'))) return base;
  return LANE_SPLIT.test(source) ? `split:${base}` : 'alone';
}

/**
 * {@link planFast}'s files, split for N parallel app instances. Each class is cut
 * into attach and launch groups of `groupSize` files; the lanes pull groups off
 * these queues as they free up (dashboard/server/fast-run.mjs), so a slow group
 * never leaves another lane idle until the end:
 *   - `primary` — instance 0 only, while the others work through `any`;
 *   - `any`     — whichever lane is free (instance 0 joins once `primary` is done);
 *   - `alone`   — instance 0 after every lane has finished, the others stopped.
 *
 * Each group is `{ files, only? }`: `only: 'shared'` runs a `@lane-split` file's
 * untagged tests, `only: 'exclusive'` its `@exclusive` ones; those files never
 * share a group with whole files, since a group has one grep.
 */
export function planLanes(catalog, specs, userTags, groupSize, { needsLaunch: launchOnly, laneOf }) {
  const base = planFast(catalog, specs, userTags, groupSize, { needsLaunch: launchOnly });
  const size = Math.max(1, groupSize);
  const groupsOf = (files, only) => {
    const attach = files.filter((p) => base.attachFiles.includes(p));
    const launch = files.filter((p) => !attach.includes(p));
    const wrap = (g) => (only ? { files: g, only } : { files: g });
    return { attach: chunk(attach, size).map(wrap), launch: chunk(launch, size).map(wrap) };
  };
  const split = base.files.filter((p) => laneOf(p).startsWith('split:'));
  const queues = {};
  for (const cls of ['primary', 'any', 'alone']) {
    const whole = groupsOf(base.files.filter((p) => laneOf(p) === cls));
    const part =
      cls === 'alone'
        ? groupsOf(split, 'exclusive')
        : groupsOf(split.filter((p) => laneOf(p) === `split:${cls}`), 'shared');
    queues[cls] = {
      attach: [...whole.attach, ...part.attach],
      launch: [...whole.launch, ...part.launch],
      files: [...whole.attach, ...whole.launch, ...part.attach, ...part.launch].reduce(
        (n, g) => n + g.files.length,
        0,
      ),
    };
  }
  return { ...base, queues };
}
