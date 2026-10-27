/**
 * Coverage of the volt-qc test-case catalogue (docs/qc/volt-qc/) by this suite.
 *
 * The catalogue was imported from the volt-qc repo (Windows + per-ticket files,
 * mobile/Android left out). This script lists every TC id in it, scans every
 * spec under tests/ for the ids it names, and writes docs/qc/volt-qc/COVERAGE.md.
 *
 * ## How a spec claims a TC
 *
 * - Windows regression ids (APP-001, PAY-123, RO-045 …) are globally unique:
 *   naming one anywhere in a spec file — usually in the `it()` title — covers it.
 * - Per-ticket files number their rows 1, 2, 3 … (or A1, TC-01 …). Those are
 *   keyed `<file-key>:<row>`; a spec covers one when it mentions the ticket
 *   (e.g. `VP-1432`) AND the row as `TC-<row>` / `TC-0<row>`.
 *
 * Usage: `npx tsx scripts/volt-qc-coverage.ts` (prints the summary, writes the md).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CATALOG = path.join(ROOT, 'docs/qc/volt-qc');
const OUT = path.join(CATALOG, 'COVERAGE.md');

interface Tc {
  id: string;
  module: string;
  priority: string;
  kind: string;
  tag: string;
  summary: string;
  /** Per-ticket rows only: the ticket key and the row label used to match a spec. */
  ticket?: string;
  row?: string;
}

const ID_RE = /^(\d+|[A-Z]{1,3}\d+(\.\d+)?|[A-Z][A-Za-z0-9]*([-_][A-Za-z]+)*[-_]\d+[a-z]?)$/;

/**
 * Two ticket files share VP-1048 and two share VP-1252, so those get a key of
 * their own, and a spec must write it right before the row: `VP-1048 IS TC-05`.
 */
const SHARED_KEYS: Readonly<Record<string, string>> = {
  'VP-1048-daily-sale-report-test-cases': 'VP-1048 DSR',
  'VP-1048-income-summary': 'VP-1048 IS',
  'VP-1252-5-test-cases': 'VP-1252-5',
};

function ticketKey(base: string): string {
  return SHARED_KEYS[base] ?? base.match(/VP-\d+/)?.[0] ?? base;
}

function parseFile(file: string, module: string, perTicket: boolean): Tc[] {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r/g, '').split('\n');
  const ticket = perTicket ? ticketKey(path.basename(file, '.md')) : undefined;
  const out = new Map<string, Tc>();
  let header: string[] | null = null;
  for (const line of lines) {
    if (!line.startsWith('|')) {
      header = null;
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((s) => s.trim().replace(/[*`]/g, ''));
    if (!header) {
      header = cells.map((c) => c.toLowerCase());
      continue;
    }
    if (cells.length < (perTicket ? 4 : 5) || /^:?-+/.test(cells[0] ?? '')) continue;
    const raw = cells[0] ?? '';
    if (!ID_RE.test(raw)) continue;
    const text = cells.join(' | ');
    const note = cells[cells.length - 1] ?? '';
    const desc = cells[header.indexOf('description')] ?? cells[1] ?? '';
    const tag = /KHÔNG CHẠY PROD/.test(note)
      ? 'KHONG-CHAY-PROD'
      : /CẦN THIẾT BỊ/.test(note)
        ? 'CAN-THIET-BI'
        : /GHI DỮ LIỆU/.test(note)
          ? 'GHI-DU-LIEU'
          : /PROD-SAFE/.test(note)
            ? 'PROD-SAFE'
            : '';
    const id = perTicket ? `${ticket}:${raw}` : raw;
    if (out.has(id)) continue;
    out.set(id, {
      id,
      module,
      priority: text.match(/\bP[123]\b/)?.[0] ?? '',
      kind: desc.match(/^\[(Happy|Bad|Edge|Regression[^\]]*)\]/)?.[1]?.split(' ')[0] ?? '',
      tag,
      summary: desc.replace(/^(\[[^\]]+\])+\s*/, '').slice(0, 140),
      ...(perTicket ? { ticket, row: raw } : {}),
    });
  }
  // Some ticket files write one TC per heading (`### TC-01 — …`) instead of a table row.
  for (const line of lines) {
    const m = line.match(/^#{2,4}\s+\**((?:TC|[A-Z]+)-\d+)\b\**\s*[—:-]?\s*(.*)$/);
    if (!m || !perTicket) continue;
    const raw = (m[1] ?? '').replace(/^TC-0*/, '');
    const id = `${ticket}:${raw}`;
    if (!out.has(id))
      out.set(id, {
        id,
        module,
        priority: '',
        kind: '',
        tag: '',
        summary: (m[2] ?? '').slice(0, 140),
        ticket,
        row: raw,
      });
  }
  return [...out.values()];
}

function loadCatalog(): Tc[] {
  const tcs: Tc[] = [];
  const win = path.join(CATALOG, 'windows-regression');
  for (const f of fs
    .readdirSync(win)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()) {
    tcs.push(...parseFile(path.join(win, f), f.replace(/\.md$/, ''), false));
  }
  const vp = path.join(CATALOG, 'vp-tickets');
  for (const f of fs
    .readdirSync(vp)
    .filter((f) => f.endsWith('.md') && !/analysis|data-setup/.test(f))
    .sort()) {
    tcs.push(...parseFile(path.join(vp, f), `vp/${f.replace(/\.md$/, '')}`, true));
  }
  return tcs;
}

function specFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return specFiles(p);
    return e.name.endsWith('.ts') ? [p] : [];
  });
}

function main(): void {
  const tcs = loadCatalog();
  const specs = specFiles(path.join(ROOT, 'tests')).map((f) => ({ f, t: fs.readFileSync(f, 'utf8') }));
  const all = specs.map((s) => s.t).join('\n');
  const coveredBy = new Map<string, string[]>();

  for (const tc of tcs) {
    const hits: string[] = [];
    for (const s of specs) {
      let hit = false;
      if (tc.ticket) {
        const n = tc.row ?? '';
        const rowRe = /^\d+$/.test(n) ? new RegExp(`TC-0?${n}\\b`) : new RegExp(`\\b${n}\\b`);
        if (Object.values(SHARED_KEYS).includes(tc.ticket)) {
          const esc = tc.ticket.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
          hit = new RegExp(`${esc} TC-0?${n}\\b`).test(s.t);
        } else {
          // `VP-1252` must not match inside `VP-1252-5`.
          hit = new RegExp(`${tc.ticket}(?!-\\d)`).test(s.t) && rowRe.test(s.t);
        }
      } else {
        hit = new RegExp(`\\b${tc.id}\\b`).test(s.t);
      }
      if (hit) hits.push(path.relative(ROOT, s.f).replace(/\\/g, '/'));
    }
    if (hits.length) coveredBy.set(tc.id, hits);
  }
  void all;
  // Claimed only by pending specs under a `_manual/` folder: listed, but not automated.
  const isManual = (id: string): boolean => (coveredBy.get(id) ?? []).every((f) => f.includes('/_manual/'));
  const isAuto = (id: string): boolean => coveredBy.has(id) && !isManual(id);

  const byModule = new Map<string, Tc[]>();
  for (const tc of tcs) byModule.set(tc.module, [...(byModule.get(tc.module) ?? []), tc]);

  const rows: string[] = [];
  let tot = 0;
  let cov = 0;
  let man = 0;
  for (const [m, list] of byModule) {
    const c = list.filter((t) => isAuto(t.id)).length;
    const mc = list.filter((t) => coveredBy.has(t.id) && isManual(t.id)).length;
    const safe = list.filter((t) => t.tag === 'PROD-SAFE');
    const safeCov = safe.filter((t) => isAuto(t.id)).length;
    tot += list.length;
    cov += c;
    man += mc;
    rows.push(
      `| ${m} | ${list.length} | ${c} | ${Math.round((c / list.length) * 100)}% | ${mc} | ${list.length - c - mc} | ${safeCov}/${safe.length} |`,
    );
  }

  const md: string[] = [
    '# volt-qc catalogue — coverage by this suite',
    '',
    `> Generated by \`npx tsx scripts/volt-qc-coverage.ts\` on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand.`,
    '> Source: volt-qc repo (`volt-pos-nail-window/regression-test-cases/` + root per-ticket files). Mobile/Android is out of scope.',
    '',
    `**Total:** ${tot} TC · automated **${cov}** (${Math.round((cov / tot) * 100)}%) · manual (pending spec) **${man}** · missing **${tot - cov - man}**`,
    '',
    '| Module | TC | Automated | % | Manual | Missing | PROD-SAFE automated |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Missing TCs',
    '',
  ];
  for (const [m, list] of byModule) {
    const miss = list.filter((t) => !coveredBy.has(t.id));
    if (!miss.length) continue;
    md.push(
      `### ${m} — ${miss.length} missing`,
      '',
      '| ID | P | Kind | Tag | Summary |',
      '|---|---|---|---|---|',
    );
    for (const t of miss)
      md.push(`| ${t.id} | ${t.priority} | ${t.kind} | ${t.tag} | ${t.summary.replace(/\|/g, '/')} |`);
    md.push('');
  }
  md.push('## Covered TCs', '', '| ID | Spec |', '|---|---|');
  for (const tc of tcs) {
    const h = coveredBy.get(tc.id);
    if (h) md.push(`| ${tc.id} | ${h.join(', ')} |`);
  }

  fs.writeFileSync(OUT, md.join('\n') + '\n');
  console.log(`volt-qc: ${tot} TC, automated ${cov}, manual ${man}, missing ${tot - cov - man}`);
  for (const r of rows) console.log(r);
  console.log(`-> ${path.relative(ROOT, OUT)}`);
}

main();
