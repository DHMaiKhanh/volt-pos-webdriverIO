#!/usr/bin/env node
/**
 * set-verdict.mjs — chốt kết luận nguyên nhân fail cho 1 hoặc nhiều TC vào sổ cái
 * docs/triage/failure-ledger.json, để lần quét sau collect-failures.mjs dùng lại (không
 * phải điều tra lại) và tự cảnh báo khi lỗi đổi khác verdict cũ.
 *
 *   node .claude/skills/triage-failures/scripts/set-verdict.mjs \
 *     --match "<chuỗi con của key '<spec> › <fullTitle>'>"   (lặp được; hoặc --key chính xác)
 *     --category APP_BUG|LOGIC_CHANGE|UI_CHANGE|TEST_CODE|ENV|CASCADE|FLAKY \
 *     --cause "nguyên nhân chi tiết, có bằng chứng" \
 *     [--evidence "ảnh/dom/log/so sánh đã xem"] [--bug VP-1234] [--fix "cách xử lý"] \
 *     [--status open|fixed|wontfix] [--signature-from-latest]
 *
 * --signature-from-latest (mặc định bật): lưu chữ ký lỗi gần nhất của TC vào verdict; khi lần
 * sau TC fail với chữ ký KHÁC → collect-failures đánh dấu "verdict cũ, lỗi đã đổi".
 * --dry-run: chỉ in TC nào khớp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const LEDGER = path.join(ROOT, 'docs/triage/failure-ledger.json');
const CATS = ['APP_BUG', 'LOGIC_CHANGE', 'UI_CHANGE', 'TEST_CODE', 'ENV', 'CASCADE', 'FLAKY'];

const argv = process.argv.slice(2);
const all = (name) => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : []));
const one = (name) => all(name)[0];
const matches = all('--match');
const keys = all('--key');
const category = one('--category')?.toUpperCase();
const cause = one('--cause');
const dry = argv.includes('--dry-run');

if (!matches.length && !keys.length) fail('Cần --match hoặc --key');
if (!dry && !CATS.includes(category)) fail(`--category phải là một trong ${CATS.join(', ')}`);
if (!dry && !cause) fail('Cần --cause (nguyên nhân chi tiết)');

const ledger = JSON.parse(fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8') : '{"tests":{}}');
ledger.tests ||= {};
const hit = Object.keys(ledger.tests).filter((k) => keys.includes(k) || matches.some((m) => k.toLowerCase().includes(m.toLowerCase())));
if (!hit.length) fail('Không TC nào trong sổ cái khớp — chạy collect-failures.mjs trước (nó ghi TC vào sổ cái).');

for (const k of hit) {
  const e = ledger.tests[k];
  if (dry) {
    console.log(`would set: ${k}`);
    continue;
  }
  // chữ ký gần nhất = seen có `last` mới nhất
  const latestSig = Object.entries(e.seen || {}).sort((a, b) => String(b[1].last).localeCompare(String(a[1].last)))[0]?.[0] || null;
  const prev = e.verdict;
  e.verdict = {
    category,
    cause,
    evidence: one('--evidence') || null,
    bug: one('--bug') || null,
    fix: one('--fix') || null,
    status: one('--status') || 'open',
    signature: argv.includes('--no-signature') ? null : latestSig,
    decidedAt: new Date().toISOString(),
  };
  if (prev) (e.verdictHistory ||= []).push(prev);
  console.log(`set ${category}: ${k}`);
}
if (!dry) {
  ledger.updatedAt = new Date().toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
}
console.log(`${hit.length} TC`);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
