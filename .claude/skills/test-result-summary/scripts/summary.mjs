#!/usr/bin/env node
/**
 * summary.mjs — đếm PASS / FAIL / SKIP của lần chạy test gần nhất (hoặc gộp nhiều lần).
 * Nguồn: dashboard/public/data/latest.json + history.json (DashboardReporter ghi sau mỗi lane).
 *
 *   node .claude/skills/test-result-summary/scripts/summary.mjs                 # lần chạy gần nhất
 *   node ... summary.mjs --filter VP5195       # chỉ TC/spec chứa chuỗi (không phân biệt hoa thường, bỏ '-')
 *   node ... summary.mjs --run 2               # lần chạy thứ 2 tính từ mới nhất (1 = mới nhất)
 *   node ... summary.mjs --merge --filter VP5195  # gộp history: mỗi TC lấy kết quả MỚI NHẤT (sau khi chạy lại fail)
 *   node ... summary.mjs --runs 10             # liệt kê 10 lần chạy gần nhất + tổng
 *   --json                                     # xuất JSON
 */
import { readFileSync, existsSync } from 'node:fs';

const DIR = 'dashboard/public/data';
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const has = (k) => args.includes(k);

const load = (f) => (existsSync(`${DIR}/${f}`) ? JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) : null);
const history = load('history.json')?.runs ?? [];
const latest = load('latest.json');
const runs = history.length ? history : latest ? [latest] : [];
if (!runs.length) { console.error(`Không thấy kết quả trong ${DIR}. Chạy test trước.`); process.exit(1); }

const norm = (s) => String(s ?? '').toLowerCase().replace(/[-_\s]/g, '');
const filter = opt('--filter');
const tcId = (title) => (title.match(/TC-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d+[a-z]?/i) ?? [null])[0];
const cleanTitle = (t) => t.replace(/\s@[\w-]+/g, '').trim();
const fmtDate = (iso) => new Date(iso).toLocaleString('vi-VN', { hour12: false });

function testsOf(run) {
  const out = [];
  const walk = (spec, suite) => {
    for (const t of suite.tests ?? []) {
      const row = {
        id: tcId(t.title) ?? '-', title: cleanTitle(t.title), state: t.state,
        spec: spec.specName, file: spec.file, error: t.error ?? '', runId: run.runId, at: run.startedAt,
      };
      if (!filter || norm(row.title + row.spec + t.fullTitle).includes(norm(filter))) out.push(row);
    }
    for (const s of suite.suites ?? []) walk(spec, s);
  };
  for (const sp of run.specs ?? []) for (const s of sp.suites ?? []) walk(sp, s);
  return out;
}

function count(rows) {
  const c = { total: rows.length, passed: 0, failed: 0, skipped: 0 };
  for (const r of rows) c[r.state === 'passed' ? 'passed' : r.state === 'failed' ? 'failed' : 'skipped']++;
  c.passRate = c.passed + c.failed ? +((c.passed / (c.passed + c.failed)) * 100).toFixed(1) : 0;
  return c;
}

if (opt('--runs')) {
  const n = +opt('--runs');
  console.log('| # | Bắt đầu | Mode | Tests | PASS | FAIL | SKIP | Pass % |\n|---|---|---|---|---|---|---|---|');
  runs.slice(0, n).forEach((r, i) => {
    const c = filter ? count(testsOf(r)) : { total: r.totals.tests, ...r.totals };
    if (filter && !c.total) return;
    console.log(`| ${i + 1} | ${fmtDate(r.startedAt)} | ${r.env?.mode ?? ''} | ${c.total} | ${c.passed} | ${c.failed} | ${c.skipped} | ${c.passRate}% |`);
  });
  process.exit(0);
}

let rows, source;
if (has('--merge')) {
  const byKey = new Map();
  const newestRunOfSpec = new Map();
  for (const r of runs) for (const t of testsOf(r)) { // runs: mới nhất trước → giữ lần đầu gặp
    if (!newestRunOfSpec.has(t.spec)) newestRunOfSpec.set(t.spec, t.runId);
    // hook / test không có TC id: chỉ tính ở lần chạy mới nhất của spec đó (tránh lỗi cũ đã hết)
    if (t.id === '-' && newestRunOfSpec.get(t.spec) !== t.runId) continue;
    const key = t.id !== '-' ? t.id : t.spec + '::' + t.title;
    if (!byKey.has(key)) byKey.set(key, t);
  }
  // Bỏ TC đã bị xoá / comment lại trong spec hiện tại (kết quả cũ không còn ý nghĩa).
  const srcCache = new Map();
  const liveCode = (file) => {
    if (!srcCache.has(file)) {
      let p = String(file ?? '').replace(/^file:\/\/\/?/, '');
      try { p = decodeURIComponent(p); } catch {}
      srcCache.set(file, existsSync(p)
        ? readFileSync(p, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
        : null);
    }
    return srcCache.get(file);
  };
  const dropped = [];
  rows = [...byKey.values()].filter((t) => {
    const code = t.id === '-' ? null : liveCode(t.file);
    if (code != null && !code.includes(t.id)) { dropped.push(t.id); return false; }
    return true;
  });
  source = `gộp ${runs.length} lần chạy trong history (mỗi TC lấy kết quả mới nhất)` +
    (dropped.length ? `; bỏ ${dropped.length} TC không còn trong spec: ${dropped.join(', ')}` : '');
} else {
  const idx = (+opt('--run') || 1) - 1;
  const run = runs[idx];
  if (!run) { console.error(`Chỉ có ${runs.length} lần chạy.`); process.exit(1); }
  rows = testsOf(run);
  source = `lần chạy ${fmtDate(run.startedAt)} (${Math.round(run.durationMs / 1000)}s, env ${run.env?.name}/${run.env?.mode}, app ${run.env?.app})`;
}
rows.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const c = count(rows);

if (has('--json')) { console.log(JSON.stringify({ source, filter, counts: c, tests: rows }, null, 2)); process.exit(0); }

const icon = { passed: '✅ PASS', failed: '❌ FAIL' };
console.log(`Nguồn: ${source}${filter ? ` — lọc "${filter}"` : ''}`);
console.log(`TỔNG: ${c.total} TC | PASS ${c.passed} | FAIL ${c.failed} | SKIP ${c.skipped} | Pass rate ${c.passRate}%\n`);
console.log('| TC ID | Title | Kết quả | Spec | Lỗi |\n|---|---|---|---|---|');
for (const r of rows) {
  const err = r.error.split('\n')[0].replace(/\|/g, '/').slice(0, 120);
  console.log(`| ${r.id} | ${r.title.replace(/^TC-[^:]+:\s*/, '').replace(/\|/g, '/')} | ${icon[r.state] ?? '⏭️ ' + r.state.toUpperCase()} | ${r.spec} | ${err} |`);
}
