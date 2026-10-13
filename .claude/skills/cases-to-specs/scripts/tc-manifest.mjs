#!/usr/bin/env node
/**
 * tc-manifest.mjs — đọc một `<screen>-test-cases.md` và liệt kê TẤT CẢ test case
 * trong đó, để khi port sang spec WebdriverIO không bỏ sót dòng nào.
 *
 * Zero-dependency (Node >= 22, giống cdp.mjs). Chạy:
 *
 *   node .claude/skills/cases-to-specs/scripts/tc-manifest.mjs <path-to-test-cases.md>
 *   node .claude/skills/cases-to-specs/scripts/tc-manifest.mjs <path> --json
 *   node .claude/skills/cases-to-specs/scripts/tc-manifest.mjs <path> --scaffold
 *
 * Mặc định: in bảng manifest + tổng kết (bao nhiêu TC, implement vs PENDING).
 *   --json      : xuất JSON (để tool khác đọc).
 *   --scaffold  : in ra một skeleton `.spec.ts` với MỖI TC là một `it()`
 *                 (implement-able -> body rỗng + TODO; blocked -> title-only PENDING).
 *                 In ra stdout; tự quyết định lưu ở đâu / tách file thế nào.
 *
 * Cách phân loại (provenance legend trong doc):
 *   ✅ quét live khớp              -> IMPLEMENT
 *   ⚠️ có drift/điều kiện          -> IMPLEMENT (assert theo GIÁ TRỊ THẬT đã drift)
 *   🧱 chưa quét được              -> PENDING  (cần settle/terminal/dual-screen...)
 *   📄 document-only / LINEAR-ONLY -> PENDING  (UI chưa dựng)
 *   (không rõ)                     -> IMPLEMENT (best-effort, cờ REVIEW)
 */

import { readFileSync } from 'node:fs';

const GLYPH = { done: '✅', drift: '⚠️', blocked: '🧱', doc: '📄' };

/** Cắt một dòng bảng markdown `| a | b | c |` thành mảng cell đã trim. */
function cells(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  // bỏ `|` đầu/cuối rồi split; KHÔNG xử lý `\|` escape (các bảng này không dùng)
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** Dọn markdown nhấn mạnh + xuống dòng trong một cell để in gọn. */
function clean(s) {
  return (s ?? '')
    .replace(/\*\*/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Glyph trạng thái đầu tiên tìm thấy trong chuỗi, hoặc ''. */
function statusOf(s) {
  for (const g of Object.values(GLYPH)) if (s.includes(g)) return g;
  return '';
}

/** `TC-ORDERFLOW-07` / `TC-07` -> số thứ tự 7 (để map bảng chi tiết <-> bảng trạng thái). */
function tcNumber(id) {
  const m = id.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

function decisionFor(glyph) {
  if (glyph === GLYPH.done || glyph === GLYPH.drift) return 'implement';
  if (glyph === GLYPH.blocked || glyph === GLYPH.doc) return 'pending';
  return 'implement'; // không rõ -> cứ viết, nhưng sẽ gắn cờ REVIEW
}

const TC_ID = /^TC-[A-Z0-9]+-\d+$/i; // đầy đủ: TC-ORDERFLOW-01, TC-CHF-01, TC-OPEN-01
const TC_ANY = /^TC-[A-Z0-9]*-?\d+$/i; // gồm cả dạng ngắn TC-01 ở bảng trạng thái

/** Lập chỉ mục cột theo TÊN header (bền với số cột/khác thứ tự giữa các doc). */
function mapColumns(header) {
  const h = header.map((x) => x.toLowerCase());
  const find = (...needles) => h.findIndex((x) => needles.some((n) => x.includes(n)));
  return {
    id: find('id') === -1 ? 0 : find('id'),
    title: find('tiêu đề', 'title', 'tính năng'),
    precond: find('tiền điều kiện', 'precond', 'điều kiện'),
    steps: find('các bước', 'bước', 'steps'),
    expected: find('kết quả', 'mong đợi', 'expected'),
    type: find('loại', 'type'),
    prio: find('ưu tiên', 'priority'),
    status: find('trạng thái', 'status'),
  };
}

/**
 * Đọc mọi bảng markdown trong file theo header của từng bảng. Một bảng có cột
 * "Các bước"/"Kết quả" là bảng CHI TIẾT; có cột "Trạng thái" là bảng TRẠNG THÁI.
 */
function parse(md) {
  const lines = md.split(/\r?\n/);
  const detailed = new Map(); // fullId -> {id,title,precond,steps,expected,type,prio,glyph}
  const statusById = new Map(); // fullId -> glyph
  const statusByNum = new Map(); // num    -> glyph (fallback khi doc chỉ 1 prefix)

  let col = null; // map cột của bảng đang đọc
  for (let i = 0; i < lines.length; i++) {
    const c = cells(lines[i]);
    if (!c) {
      col = null;
      continue;
    }
    // Header của bảng = dòng `|...|` ngay trước dòng phân cách `| --- | --- |`.
    const next = cells(lines[i + 1] || '');
    const isSeparator = next && next.every((x) => /^:?-{2,}:?$/.test(x));
    if (isSeparator) {
      col = mapColumns(c);
      continue;
    }
    if (!col) continue; // đang không ở trong bảng nào đã biết header

    const id = c[col.id] ?? c[0];
    const rowGlyph = statusOf(c.join(' '));

    const hasDetail = col.steps !== -1 || col.expected !== -1;
    if (hasDetail && TC_ID.test(id)) {
      const get = (k) => (col[k] !== -1 ? clean(c[col[k]]) : '');
      detailed.set(id, {
        id,
        title: get('title'),
        precond: get('precond'),
        steps: get('steps'),
        expected: get('expected'),
        type: get('type').toLowerCase(),
        prio: get('prio').toUpperCase(),
        glyph: rowGlyph,
      });
      continue;
    }

    // Bảng trạng thái (hoặc feature inventory) — thu glyph theo id/num.
    if (col.status !== -1 && TC_ANY.test(id) && rowGlyph) {
      if (TC_ID.test(id)) statusById.set(id, rowGlyph);
      const num = tcNumber(id);
      if (num != null && !statusByNum.has(num)) statusByNum.set(num, rowGlyph);
    }
  }

  // Doc chỉ 1 prefix id (vd mọi TC đều TC-ORDERFLOW-*) thì fallback-theo-số an toàn.
  const prefixes = new Set([...detailed.keys()].map((id) => id.replace(/-\d+$/, '')));
  const numFallbackOk = prefixes.size === 1;

  const prefixOf = (id) => id.replace(/-\d+$/, '');
  const rows = [...detailed.values()].sort((a, b) => {
    const p = prefixOf(a.id).localeCompare(prefixOf(b.id));
    return p !== 0 ? p : tcNumber(a.id) - tcNumber(b.id);
  });
  for (const d of rows) {
    const glyph =
      d.glyph || statusById.get(d.id) || (numFallbackOk ? statusByNum.get(tcNumber(d.id)) : '') || '';
    d.glyph = glyph;
    d.decision = decisionFor(glyph);
  }
  return rows;
}

/**
 * Tag CHẮC CHẮN để bake vào title(): REGRESSION luôn có; CRITICAL khi P1.
 * (@smoke/@write/@payment/... phụ thuộc hành vi thật nên KHÔNG đoán ở đây —
 * xem candidateTags.)
 */
function baseTags(r) {
  const tags = ['Tag.REGRESSION'];
  if (r.prio === 'P1') tags.push('Tag.CRITICAL');
  return tags;
}

/**
 * Tag ỨNG VIÊN gợi ý (heuristic trên text) — in dạng comment để người viết chốt,
 * KHÔNG bake vào title vì đoán sai tag là có hại (sai lane chạy).
 */
function candidateTags(r) {
  const text = `${r.title} ${r.steps} ${r.expected}`.toLowerCase();
  const out = [];
  if (/\b(thanh toán|charge|refund|hoàn tiền|cancel order|complete payment|settle|adjust tip|tạo order|xoá đơn|delete order)\b/.test(text))
    out.push('@write');
  if (/\b(card|gift ?card|gateway|terminal|settle|charge)\b/.test(text)) out.push('@payment');
  if (/\b(màn khách|customer display|dual-screen|dual screen|signature|chữ ký)\b/.test(text))
    out.push('@dual-window');
  if (/\b(app language|ngôn ngữ app|passcode-verification|business info|turn setting)\b/.test(text))
    out.push('@exclusive');
  return [...new Set(out)];
}

function printManifest(rows, file) {
  const impl = rows.filter((r) => r.decision === 'implement');
  const pend = rows.filter((r) => r.decision === 'pending');
  const unknown = rows.filter((r) => !r.glyph);

  console.log(`\nTest-case manifest — ${file}`);
  console.log('─'.repeat(78));
  for (const r of rows) {
    const flag = r.decision === 'pending' ? 'PENDING ' : 'write   ';
    const g = r.glyph || '· ';
    const review = r.glyph ? '' : '  (REVIEW: không rõ provenance)';
    console.log(`${g} ${flag} ${r.id.padEnd(18)} [${r.type || '?'}/${r.prio || '?'}] ${r.title}${review}`);
  }
  console.log('─'.repeat(78));
  console.log(
    `TỔNG: ${rows.length} TC  |  implement: ${impl.length}  |  PENDING: ${pend.length}` +
      (unknown.length ? `  |  cần REVIEW provenance: ${unknown.length}` : ''),
  );
  console.log(
    `Legend: ${GLYPH.done} live-khớp  ${GLYPH.drift} drift(assert giá trị thật)  ` +
      `${GLYPH.blocked} blocked  ${GLYPH.doc} doc-only\n`,
  );
}

function printScaffold(rows, file) {
  const slug = (rows[0]?.id.match(/^TC-([A-Z0-9]+)-\d+/i)?.[1] || 'SCREEN').toUpperCase();
  const out = [];
  out.push('/**');
  out.push(` * <mô tả spec> — port từ ${file}`);
  out.push(' *');
  out.push(' * TC bao phủ (điền lại cho đúng nhóm khi tách file):');
  for (const r of rows) {
    const mark = r.decision === 'pending' ? ' — PENDING' : '';
    out.push(` *   - ${r.id}  ${r.title}${mark}`);
  }
  out.push(' *');
  out.push(' * CREATES DATA ... . dev / staging only.   <-- sửa cho đúng mức ghi dữ liệu');
  out.push(' */');
  out.push('');
  out.push("import { expect } from '@wdio/globals';");
  out.push("import { returnToHome } from '../../../src/flows/index.js';");
  out.push("import { homePage } from '../../../src/pages/index.js';");
  out.push("import { Tag, title } from '../../../src/types/testTags.js';");
  out.push('');
  out.push(`describe('${slug} — <nhóm>', () => {`);
  out.push('  before(async () => {');
  out.push('    await returnToHome();');
  out.push('  });');
  out.push('');
  for (const r of rows) {
    if (r.decision === 'pending') {
      out.push('  it(');
      out.push(
        `    title('${r.id}: ${esc(r.title)} — PENDING (${reason(r.glyph)})'),`,
      );
      out.push('  );');
      out.push('');
      continue;
    }
    const tags = baseTags(r).join(', ');
    const cand = candidateTags(r);
    out.push('  it(');
    out.push(`    title('${esc(r.title)} (${r.id})', ${tags}),`);
    out.push('    async () => {');
    if (cand.length) out.push(`      // tag ứng viên (chốt lại): ${cand.join(' ')}`);
    out.push(`      // Bước:  ${r.steps}`);
    out.push(`      // Mong:  ${r.expected}`);
    out.push('      // TODO: dùng page object/flow có sẵn; KHÔNG đặt selector ở đây.');
    out.push('      expect(true).toBe(true);');
    out.push('    },');
    out.push('  );');
    out.push('');
  }
  out.push('});');
  console.log(out.join('\n'));
}

function esc(s) {
  return s.replace(/'/g, "\\'");
}
function reason(glyph) {
  if (glyph === GLYPH.blocked) return 'cần settle/terminal/dual-screen — xem lý do trong doc';
  if (glyph === GLYPH.doc) return 'document-only, UI chưa dựng';
  return 'xem doc';
}

// ── main ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: node tc-manifest.mjs <path-to-test-cases.md> [--json|--scaffold]');
  process.exit(1);
}
const md = readFileSync(file, 'utf8');
const rows = parse(md);
if (rows.length === 0) {
  console.error(
    `Không thấy dòng TC nào trong ${file}. Kỳ vọng bảng chi tiết với cột ` +
      `ID | Tiêu đề | Tiền điều kiện | Các bước | Kết quả mong đợi | Loại | Ưu tiên.`,
  );
  process.exit(2);
}
if (args.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else if (args.includes('--scaffold')) printScaffold(rows, file);
else printManifest(rows, file);
