#!/usr/bin/env node
/**
 * collect-failures.mjs — gom MỌI test case đã từng FAIL (dashboard history + sổ cái),
 * phân loại sơ bộ nguyên nhân, xuất báo cáo Markdown + JSON cho skill /triage-failures.
 *
 * Nguồn:
 *   dashboard/public/data/history.json   (50 run gần nhất, do DashboardReporter ghi)
 *   reports/evidence/<dir>/manifest.json (ảnh final.png, dom.html, app.log, url lúc fail)
 *   docs/triage/failure-ledger.json      (SỔ CÁI bền vững: verdict đã chốt + mọi lỗi từng thấy,
 *                                         không mất khi history bị cắt 50 run)
 *   .claude/skills/triage-failures/references/known-patterns.json (mẫu lỗi đã biết gốc rễ)
 *
 * Dùng:
 *   node .claude/skills/triage-failures/scripts/collect-failures.mjs [options]
 *     --open            chỉ TC mà lần chạy gần nhất vẫn FAIL (mặc định: tất cả từng fail)
 *     --spec <substr>   lọc theo đường dẫn spec
 *     --since <date>    chỉ tính run từ ngày này (YYYY-MM-DD)
 *     --category <CAT>  lọc theo nhóm (APP_BUG, UI_CHANGE, ...)
 *     --no-ledger-write không cập nhật sổ cái (mặc định: có ghi lịch sử lỗi vào sổ cái)
 *     --out <dir>       thư mục xuất (mặc định reports/triage/<timestamp>)
 *
 * Chỉ ĐỌC dữ liệu run; ghi duy nhất: thư mục --out và (trừ khi --no-ledger-write) phần
 * `seen` của sổ cái. KHÔNG bao giờ ghi đè `verdict` đã chốt — cái đó do người/Claude chốt
 * bằng set-verdict.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const HISTORY = path.join(ROOT, 'dashboard/public/data/history.json');
const EVIDENCE = path.join(ROOT, 'reports/evidence');
const LEDGER = path.join(ROOT, 'docs/triage/failure-ledger.json');
const PATTERNS = path.join(HERE, '../references/known-patterns.json');

// ---------- args ----------
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(name);
const ONLY_OPEN = flag('--open');
const SPEC_FILTER = opt('--spec');
const SINCE = opt('--since');
const CAT_FILTER = opt('--category')?.toUpperCase();
const WRITE_LEDGER = !flag('--no-ledger-write');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.resolve(ROOT, opt('--out', `reports/triage/${stamp}`));

// ---------- helpers ----------
const readJson = (p, def) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return def;
  }
};
const relSpec = (file) =>
  decodeURIComponent(String(file).replace(/^file:\/\/\//, ''))
    .replace(/\\/g, '/')
    .replace(/^.*?\/(tests\/)/, '$1');
/** Chữ ký lỗi: bỏ số/thời gian/id để các lần fail cùng gốc gom chung một nhóm. */
const signature = (err = '') =>
  String(err)
    .split('\n')[0]
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.\-]+Z?/g, '<ts>')
    .replace(/\$[\d,.]+/g, '$#')
    .replace(/\d+(\.\d+)?/g, '#')
    .replace(/[0-9a-f]{8,}/gi, '<id>')
    .slice(0, 160)
    .trim();
const frames = (stack = '') => {
  const out = { spec: null, helper: null };
  for (const line of String(stack).split('\n')) {
    const m = line.match(/([A-Z]:[\\/][^():]+?\.ts|\/[^():]+?\.ts):(\d+):\d+/);
    if (!m) continue;
    const p = m[1].replace(/\\/g, '/');
    if (/node_modules/.test(p)) continue;
    const rel = p.replace(/^.*?\/(tests\/|src\/|configs\/)/, '$1');
    if (!out.spec && rel.startsWith('tests/')) out.spec = `${rel}:${m[2]}`;
    if (!out.helper && (rel.startsWith('src/') || rel.startsWith('configs/')) && !/helpers\/steps\.ts/.test(rel))
      out.helper = `${rel}:${m[2]}`;
  }
  return out;
};
const gitCache = new Map();
/** Commit gần nhất chạm vào file + file có đang sửa dở (uncommitted) không. */
const gitInfo = (rel) => {
  if (!rel) return null;
  const file = rel.split(':')[0];
  if (gitCache.has(file)) return gitCache.get(file);
  let info = null;
  try {
    const log = execFileSync('git', ['log', '-1', '--format=%cI|%h|%s', '--', file], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--', file], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const [date, hash, ...subj] = log.split('|');
    info = { lastCommit: date || null, hash: hash || null, subject: subj.join('|') || null, dirty: !!dirty };
  } catch {
    info = null;
  }
  gitCache.set(file, info);
  return info;
};

// ---------- load ----------
const history = readJson(HISTORY, { runs: [] });
const patterns = (readJson(PATTERNS, { patterns: [] }).patterns || []).map((p) => ({ ...p, re: new RegExp(p.match, 'i') }));
const ledger = readJson(LEDGER, { _doc: '', tests: {} });
ledger.tests ||= {};

let runs = [...(history.runs || [])].sort((a, b) => a.startedAt.localeCompare(b.startedAt)); // cũ → mới
if (SINCE) runs = runs.filter((r) => r.startedAt >= SINCE);

// ---------- walk every test result ----------
/** key = specRel + " › " + fullTitle */
const tests = new Map();
for (const run of runs) {
  for (const spec of run.specs || []) {
    const specRel = relSpec(spec.file);
    if (SPEC_FILTER && !specRel.includes(SPEC_FILTER)) continue;
    const walk = (suite) => {
      for (const t of suite.tests || []) {
        const key = `${specRel} › ${t.fullTitle}`;
        let rec = tests.get(key);
        if (!rec) {
          rec = { key, spec: specRel, title: t.title, fullTitle: t.fullTitle, results: [] };
          tests.set(key, rec);
        }
        rec.results.push({
          runId: run.runId,
          at: spec.startedAt || run.startedAt,
          mode: run.env?.mode,
          merchant: run.env?.merchant,
          state: t.state,
          error: t.error,
          message: t.message,
          stack: t.stack,
          evidence: t.evidence,
          skip: t.skip,
        });
      }
      (suite.suites || []).forEach(walk);
    };
    (spec.suites || []).forEach(walk);
  }
}

// ---------- classify ----------
const ASSERT_RE = /expect\(received\)|expected .* but got|toBe|toEqual|toContain|toMatch|toHaveLength|≠|AssertionError/i;
const LOCATOR_RE =
  /Never appeared|Could not find|nothing matches|still not clickable|not displayed|not interactable|no such element|was not found|wasn't found|stale element|element .* not existing|because element was(n't| not) found/i;

function classify(rec, last, timeline) {
  const text = [last.error, last.message, last.stack, rec.fullTitle].filter(Boolean).join('\n');
  const reasons = [];
  // 1) mẫu đã biết
  const known = patterns.find((p) => p.re.test(text));
  // 2) đặc trưng lịch sử
  const states = timeline.filter((s) => s === 'P' || s === 'F');
  const flips = states.slice(1).filter((s, i) => s !== states[i]).length;
  const everPassed = states.includes('P');
  const firstFailIdx = rec.results.findIndex((r) => r.state === 'failed');
  const passedBeforeFirstFail = rec.results.slice(0, firstFailIdx).some((r) => r.state === 'passed');
  const isHook = /"before (all|each)" hook|"after (all|each)" hook/i.test(rec.fullTitle);
  const fr = frames(last.stack);
  const specGit = gitInfo(fr.spec || rec.spec);
  const helperGit = gitInfo(fr.helper);
  const firstFailAt = rec.results[firstFailIdx]?.at;
  const codeChangedNearFail = [specGit, helperGit].some(
    (g) => g && (g.dirty || (g.lastCommit && firstFailAt && Math.abs(new Date(g.lastCommit) - new Date(firstFailAt)) < 2 * 864e5)),
  );

  let category;
  if (known) {
    category = known.category;
    reasons.push(`Khớp mẫu đã biết "${known.id}": ${known.cause}`);
  } else if (isHook) {
    category = 'CASCADE';
    reasons.push('Fail ở hook before/after → cả file/nhóm test chết theo; lỗi thật nằm trong bước setup.');
  } else if (flips >= 2) {
    category = 'FLAKY';
    reasons.push(`Lúc pass lúc fail (${flips} lần đảo trạng thái) với cùng code → không ổn định (timing/dữ liệu/overlay).`);
  } else if (LOCATOR_RE.test(text) || /click intercepted|out of bounds/i.test(text)) {
    category = 'UI_CHANGE';
    reasons.push(
      passedBeforeFirstFail
        ? 'Không tìm thấy/không click được phần tử mà trước đó vẫn pass → nghi giao diện đổi (testid/placeholder/vị trí) hoặc overlay che.'
        : 'Không tìm thấy/không click được phần tử, CHƯA từng pass → có thể locator viết sai ngay từ đầu (TEST_CODE) hoặc UI khác thiết kế.',
    );
  } else if (ASSERT_RE.test(text)) {
    category = 'APP_BUG?';
    reasons.push(
      passedBeforeFirstFail
        ? 'Assertion sai giá trị, trước đó từng PASS → app đổi hành vi: hoặc lỗi thật (APP_BUG) hoặc đổi logic có chủ đích (LOGIC_CHANGE) — cần đối chiếu ticket/release note.'
        : 'Assertion sai giá trị, chưa từng PASS → kỳ vọng của test có thể sai (TEST_CODE) hoặc app lỗi từ đầu — cần đối chiếu yêu cầu.',
    );
  } else {
    category = 'UNKNOWN';
    reasons.push('Không khớp mẫu nào — cần mở evidence để điều tra.');
  }
  if (codeChangedNearFail && !['ENV', 'CASCADE'].includes(category)) {
    reasons.push(
      `Code test thay đổi sát thời điểm bắt đầu fail (${[specGit, helperGit]
        .filter(Boolean)
        .map((g) => (g.dirty ? 'đang sửa dở' : `${g.hash} ${g.lastCommit?.slice(0, 10)}`))
        .join(', ')}) → nghi TEST_CODE.`,
    );
    if (category === 'UNKNOWN') category = 'TEST_CODE?';
  }
  if (!everPassed && !known) reasons.push('Chưa từng PASS trong khoảng history.');
  return { category, known: known?.id || null, fix: known?.fix || null, reasons, frames: fr, specGit, helperGit, flips, everPassed };
}

const evidenceOf = (dir) => {
  if (!dir) return null;
  const abs = path.join(EVIDENCE, dir);
  if (!fs.existsSync(abs)) return { dir, exists: false };
  const man = readJson(path.join(abs, 'manifest.json'), {});
  const rel = (f) => (f && fs.existsSync(path.join(abs, f)) ? `reports/evidence/${dir}/${f}` : null);
  return {
    dir,
    exists: true,
    url: man.url || null,
    shot: rel(man.shot || 'final.png'),
    dom: rel(man.dom || 'dom.html'),
    log: rel(man.log || 'app.log'),
    lastSteps: (man.steps || []).slice(-5),
  };
};

const srcCache = new Map();
/**
 * TC còn trong code không? 'gone' = file spec đã xoá hoặc không tìm thấy tiêu đề (đổi tên/xoá TC);
 * 'parked' = dòng khai báo có .skip( hoặc nằm dưới describe.skip( (TC đang tạm tắt);
 * 'live' = còn chạy. Tiêu đề dựng bằng template string có thể không khớp → coi là live.
 */
function testPresence(rec) {
  const abs = path.join(ROOT, rec.spec);
  if (!fs.existsSync(abs)) {
    // hook title hoặc spec helper (.helpers.ts) — không kết luận được
    return 'gone';
  }
  if (!srcCache.has(abs)) srcCache.set(abs, fs.readFileSync(abs, 'utf8').split('\n'));
  const lines = srcCache.get(abs);
  if (/"(before|after) (all|each)" hook/.test(rec.title)) return 'live';
  const probe = rec.title.replace(/\s@\S+/g, '').slice(0, 30).trim();
  if (probe.length < 8) return 'live';
  const idx = lines.findIndex((l) => l.includes(probe));
  if (idx < 0) {
    const loose = probe.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 20);
    const any = lines.some((l) => l.replace(/[^A-Za-z0-9 ]/g, '').includes(loose));
    return any ? 'live' : 'gone';
  }
  const near = lines.slice(Math.max(0, idx - 2), idx + 1).join('\n');
  if (/\b(it|test)\.skip\(|\bxit\(/.test(near)) return 'parked';
  if (lines.slice(0, idx).some((l) => /\bdescribe\.skip\(|\bxdescribe\(/.test(l))) return 'parked';
  return 'live';
}

// ---------- build rows ----------
const rows = [];
for (const rec of tests.values()) {
  const failed = rec.results.filter((r) => r.state === 'failed');
  if (!failed.length) continue;
  const ran = rec.results.filter((r) => r.state === 'passed' || r.state === 'failed');
  const lastRan = ran.at(-1);
  const presence = testPresence(rec);
  const lastAny = rec.results.at(-1);
  const status =
    presence === 'gone'
      ? 'GONE'
      : presence === 'parked' || lastAny.state === 'skipped' || lastAny.state === 'pending'
        ? 'PARKED'
        : lastRan.state === 'failed'
          ? 'OPEN'
          : 'RECOVERED';
  if (ONLY_OPEN && status !== 'OPEN') continue;
  const last = failed.at(-1);
  const timeline = rec.results.map((r) => (r.state === 'passed' ? 'P' : r.state === 'failed' ? 'F' : '-'));
  const cls = classify(rec, last, timeline);
  const sigs = {};
  for (const f of failed) {
    const s = signature(f.error);
    sigs[s] = sigs[s] || { count: 0, first: f.at, last: f.at };
    sigs[s].count++;
    sigs[s].last = f.at;
  }
  const led = ledger.tests[rec.key];
  const lastSig = signature(last.error);
  const verdict = led?.verdict || null;
  const verdictStale = verdict && verdict.signature && verdict.signature !== lastSig;
  const row = {
    key: rec.key,
    spec: rec.spec,
    title: rec.title,
    status: verdict?.status === 'fixed' && status === 'OPEN' ? 'REGRESSED' : status,
    category: verdict && !verdictStale ? verdict.category : cls.category,
    categorySource: verdict && !verdictStale ? 'ledger' : 'heuristic',
    heuristic: cls.category,
    verdict,
    verdictStale: !!verdictStale,
    knownPattern: cls.known,
    suggestedFix: cls.fix,
    reasons: cls.reasons,
    failCount: failed.length,
    passCount: rec.results.filter((r) => r.state === 'passed').length,
    flips: cls.flips,
    everPassed: cls.everPassed,
    firstFail: failed[0].at,
    lastFail: last.at,
    lastRun: lastRan.at,
    timeline: timeline.join(''),
    lastError: last.error,
    lastMessage: (last.message || '').slice(0, 1500),
    signatures: sigs,
    where: cls.frames,
    specGit: cls.specGit,
    helperGit: cls.helperGit,
    evidence: evidenceOf(last.evidence),
    env: { mode: last.mode, merchant: last.merchant },
  };
  if (CAT_FILTER && !row.category.toUpperCase().startsWith(CAT_FILTER)) continue;
  rows.push(row);

  // sổ cái: cộng dồn lịch sử lỗi (không đụng verdict)
  if (WRITE_LEDGER) {
    const e = (ledger.tests[rec.key] ||= { spec: rec.spec, title: rec.title, seen: {} });
    e.seen ||= {};
    for (const [s, v] of Object.entries(sigs)) {
      const old = e.seen[s];
      e.seen[s] = {
        count: Math.max(old?.count || 0, v.count),
        first: old?.first && old.first < v.first ? old.first : v.first,
        last: old?.last && old.last > v.last ? old.last : v.last,
      };
    }
    e.lastStatus = row.status;
    e.lastRun = row.lastRun;
    e.heuristic = cls.category;
  }
}

// ---------- order: OPEN trước, rồi theo nhóm, rồi số lần fail ----------
const ORDER = { REGRESSED: 0, OPEN: 1, RECOVERED: 2, PARKED: 3, GONE: 4 };
rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.category.localeCompare(b.category) || b.failCount - a.failCount);

// ---------- output ----------
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'failures.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs: runs.length, rows }, null, 2));

const LABEL = {
  APP_BUG: '🐞 Lỗi thật của app',
  'APP_BUG?': '🐞? Assertion sai — lỗi app HOẶC đổi logic (chưa chốt)',
  LOGIC_CHANGE: '🔀 App đổi logic có chủ đích (test cần cập nhật)',
  UI_CHANGE: '🎨 Giao diện đổi / locator lệch',
  TEST_CODE: '🧪 Lỗi code test',
  'TEST_CODE?': '🧪? Nghi lỗi code test (code đổi sát lúc fail)',
  ENV: '🖥️ Môi trường / dữ liệu / thiết bị',
  CASCADE: '⛓️ Hệ quả của lỗi khác (dây chuyền)',
  FLAKY: '🎲 Chập chờn (flaky)',
  UNKNOWN: '❓ Chưa rõ',
};
const byCat = {};
for (const r of rows) (byCat[r.category] ||= []).push(r);
const md = [];
md.push(`# Triage test case FAIL — ${new Date().toLocaleString('vi-VN')}`);
md.push('');
md.push(
  `Nguồn: ${runs.length} run (${runs[0]?.startedAt?.slice(0, 10) ?? '-'} → ${runs.at(-1)?.startedAt?.slice(0, 10) ?? '-'}) · ${rows.length} TC từng fail · ` +
    `OPEN ${rows.filter((r) => r.status === 'OPEN').length} · REGRESSED ${rows.filter((r) => r.status === 'REGRESSED').length} · ` +
    `RECOVERED ${rows.filter((r) => r.status === 'RECOVERED').length} · ` +
    `PARKED (đang skip) ${rows.filter((r) => r.status === 'PARKED').length} · GONE (đã xoá/đổi tên) ${rows.filter((r) => r.status === 'GONE').length}`,
);
md.push('');
md.push('Timeline: P=pass F=fail -=skip, cũ → mới. Nhóm có "?" là đoán từ heuristic, CHƯA chốt — cần /triage-failures điều tra rồi set-verdict.');
md.push('');
md.push('| Nhóm | Số TC | OPEN |');
md.push('|---|---:|---:|');
for (const [c, list] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length))
  md.push(`| ${LABEL[c] || c} | ${list.length} | ${list.filter((r) => r.status === 'OPEN' || r.status === 'REGRESSED').length} |`);
md.push('');
for (const [c, list] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
  md.push(`## ${LABEL[c] || c} (${list.length})`);
  md.push('');
  for (const r of list) {
    md.push(`### [${r.status}] ${r.title}`);
    md.push(`- Spec: \`${r.where.spec || r.spec}\`${r.where.helper ? ` · helper \`${r.where.helper}\`` : ''}`);
    md.push(`- Fail ${r.failCount} / pass ${r.passCount} · lần đầu fail ${r.firstFail?.slice(0, 16)} · gần nhất ${r.lastFail?.slice(0, 16)} · timeline \`${r.timeline}\``);
    md.push(`- Lỗi: \`${(r.lastError || '').replace(/`/g, "'").slice(0, 300)}\``);
    if (r.verdict && !r.verdictStale)
      md.push(
        `- ✅ Verdict đã chốt (${r.verdict.decidedAt?.slice(0, 10)}): **${r.verdict.category}** — ${r.verdict.cause}${r.verdict.bug ? ` · bug ${r.verdict.bug}` : ''}${r.verdict.fix ? ` · xử lý: ${r.verdict.fix}` : ''}`,
      );
    if (r.verdictStale) md.push(`- ⚠️ Verdict cũ (${r.verdict.category}) nhưng LỖI ĐÃ ĐỔI → cần triage lại.`);
    for (const why of r.reasons) md.push(`- Lý do (heuristic): ${why}`);
    if (r.suggestedFix) md.push(`- Gợi ý xử lý: ${r.suggestedFix}`);
    if (Object.keys(r.signatures).length > 1)
      md.push(`- Nhiều kiểu lỗi khác nhau: ${Object.entries(r.signatures).map(([s, v]) => `\`${s.slice(0, 80)}\`×${v.count}`).join(' · ')}`);
    if (r.evidence?.exists)
      md.push(`- Evidence: ${[r.evidence.shot, r.evidence.dom, r.evidence.log].filter(Boolean).map((p) => `[${path.basename(p)}](${p})`).join(' · ')}${r.evidence.url ? ` · url ${r.evidence.url}` : ''}`);
    md.push('');
  }
}
fs.writeFileSync(path.join(OUT, 'failures.md'), md.join('\n'));

if (WRITE_LEDGER) {
  ledger._doc =
    'Sổ cái triage test fail. tests[<spec> › <fullTitle>].seen = mọi chữ ký lỗi từng thấy (tự cộng dồn bởi collect-failures.mjs). ' +
    '.verdict = kết luận ĐÃ CHỐT (set-verdict.mjs): category, cause, evidence, bug, fix, status(open|fixed|wontfix), signature, decidedAt.';
  ledger.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
}

// ---------- stdout summary ----------
console.log(`runs=${runs.length} failingTCs=${rows.length} out=${path.relative(ROOT, OUT).replace(/\\/g, '/')}`);
for (const [c, list] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length))
  console.log(`  ${c.padEnd(12)} ${String(list.length).padStart(4)} (open ${list.filter((r) => r.status === 'OPEN' || r.status === 'REGRESSED').length})`);
const stale = rows.filter((r) => r.verdictStale).length;
if (stale) console.log(`  ⚠ ${stale} verdict cũ có lỗi đã đổi → triage lại`);
