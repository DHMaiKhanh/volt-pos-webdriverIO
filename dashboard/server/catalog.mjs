/**
 * Static test catalogue for the GUI runner's feature tree.
 *
 * Reads every `tests/**\/*.spec.ts` as TEXT (no import — importing a spec would
 * pull in WebdriverIO globals) and pulls out each `describe` / `it` title plus
 * its tags. Titles in this repo are written either as a plain literal or via
 * `title('…', Tag.REGRESSION, Tag.WRITE)` from src/types/testTags.ts, so both
 * shapes are handled. Loop-generated `it`s show up once with their template
 * text — good enough for picking a file; the live view shows the real titles.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/** `Tag.KEY` → `@value`, mirrored from src/types/testTags.ts. */
const TAGS = {
  SMOKE: '@smoke',
  REGRESSION: '@regression',
  CRITICAL: '@critical',
  WRITE: '@write',
  PAYMENT: '@payment',
  EXCLUSIVE: '@exclusive',
  DUAL_WINDOW: '@dual-window',
  DB: '@db',
  SLOW: '@slow',
  FLAKY: '@flaky',
};

/** Folder (relative to tests/) → name shown in the tree. Unknown folders get a title-cased name. */
const FEATURE_NAMES = {
  smoke: 'Kiểm tra nhanh toàn app (Smoke) — chỉ xem',
  _recovery: 'Khôi phục app (Recovery)',
  web: 'Web GoPOS / GoCheckin (tạo lịch hẹn, check-in)',
  'regression/app': 'Tải lại app (Reload)',
  'regression/appointment': 'Lịch hẹn (Appointment)',
  'regression/checkout': 'Thanh toán tiền mặt (Checkout)',
  'regression/home': 'Home: tạo đơn, chấm công, Turn board',
  'regression/incomes': 'Báo cáo thu nhập & Lương thợ',
  'regression/order-flow': 'Luồng đơn hàng: tạo đơn, thanh toán, refund, tách đơn',
  'regression/order-history': 'Lịch sử đơn (Order History)',
  'regression/settings': 'Cài đặt (Settings)',
  // volt-qc catalogue folders, named by the feature they cover.
  'regression/volt-qc/_manual': 'Case kiểm tay — chỉ ghi nhận, không tự chạy',
  'regression/volt-qc/app-perm': 'Giao diện chung & Phân quyền passcode — chỉ xem',
  'regression/volt-qc/app-rpt-set-perm': 'Giao diện chung & Phân quyền passcode — có đổi cài đặt',
  'regression/volt-qc/appt-time-turn': 'Lịch hẹn · Chấm công · Turn thợ',
  'regression/volt-qc/card-terminal': 'Thanh toán thẻ qua máy cà thẻ (terminal)',
  'regression/volt-qc/cd-e2e': 'Màn hình khách (Customer Display)',
  'regression/volt-qc/home-pend': 'Tạo đơn ở Home & Đơn chờ (pending)',
  'regression/volt-qc/oh-reopen': 'Lịch sử đơn · Huỷ đơn · Hoá đơn · Mở lại đơn',
  'regression/volt-qc/pay': 'Thanh toán: tiền mặt, Other, phí, thẻ',
  'regression/volt-qc/pos': 'Kiểm tra nhanh Home, Lịch sử đơn, Lịch hẹn — chỉ xem',
  'regression/volt-qc/promo-split': 'Khuyến mãi · Gift card · Tách đơn',
  'regression/volt-qc/reports-time': 'Báo cáo: Batch, Daily Sale, đối chiếu — chỉ xem',
  'regression/volt-qc/settings-devm': 'Cài đặt & Quản lý thiết bị — chỉ xem',
  'regression/volt-qc/vp-tickets': 'Lỗi theo ticket VP (thẻ, gift card, thanh toán)',
};

const titleCase = (s) =>
  s
    .replace(/^_/, '')
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

function featureName(key) {
  if (FEATURE_NAMES[key]) return FEATURE_NAMES[key];
  const qc = key.match(/^regression\/volt-qc\/(.+)$/);
  if (qc) return `volt-qc › ${qc[1]}`;
  return titleCase(key.split('/').pop());
}

/** Read the string literal starting at `src[i]` (', " or `). Returns [text, endIndex]. */
function readString(src, i) {
  const q = src[i];
  let out = '';
  let j = i + 1;
  while (j < src.length && src[j] !== q) {
    if (src[j] === '\\') {
      out += src[j + 1] ?? '';
      j += 2;
      continue;
    }
    out += src[j];
    j += 1;
  }
  return [out, j + 1];
}

/** Index just past the `)` matching the `(` at `open`, skipping strings. */
function matchParen(src, open) {
  let depth = 0;
  for (let j = open; j < src.length; j += 1) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') {
      j = readString(src, j)[1] - 1;
    } else if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return j + 1;
    }
  }
  return src.length;
}

const skipWs = (src, i) => {
  while (i < src.length && /\s/.test(src[i])) i += 1;
  return i;
};

/** Parse the first argument of describe/it: a literal or `title('…', Tag.X…)`. */
function readTitleArg(src, i) {
  i = skipWs(src, i);
  const c = src[i];
  if (c === "'" || c === '"' || c === '`') {
    const [text] = readString(src, i);
    return { text, tags: [] };
  }
  if (src.startsWith('title(', i)) {
    const open = i + 5;
    const close = matchParen(src, open);
    const inner = src.slice(open + 1, close - 1);
    const s = skipWs(inner, 0);
    const text = "'\"`".includes(inner[s]) ? readString(inner, s)[0] : inner.slice(0, 60);
    const tags = [...inner.matchAll(/Tag\.([A-Z_]+)/g)].map((m) => TAGS[m[1]]).filter(Boolean);
    return { text, tags };
  }
  return null;
}

const CALL_RE = /\b(describe|it)(\.skip|\.only)?\s*\(/g;

/** Parse one spec file into its describe titles and test list. */
export function parseSpec(src) {
  const describes = [];
  const tests = [];
  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(src))) {
    // Ignore `.it(` / `.describe(` member calls and identifiers ending in it (e.g. `waitFor…it(`).
    const prev = src[m.index - 1];
    if (prev === '.' || (prev && /[\w$]/.test(prev))) continue;
    const arg = readTitleArg(src, m.index + m[0].length);
    if (!arg) continue;
    const inline = [...arg.text.matchAll(/@[a-z][\w-]*/g)].map((x) => x[0]);
    const tags = [...new Set([...arg.tags, ...inline])];
    const clean = arg.text.replace(/\s+@[a-z][\w-]*/g, '').trim();
    if (m[1] === 'describe') describes.push(clean);
    else tests.push({ title: clean, tags, skip: m[2] === '.skip' });
  }
  return { describes, tests };
}

/** Walk tests/ and return features → files → tests. */
export function buildCatalog(repoRoot) {
  const testsDir = path.join(repoRoot, 'tests');
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.spec.ts')) files.push(full);
    }
  };
  walk(testsDir);

  const features = new Map();
  for (const full of files.sort()) {
    const rel = path.relative(repoRoot, full).replace(/\\/g, '/');
    const insideTests = path.relative(testsDir, path.dirname(full)).replace(/\\/g, '/');
    const key = insideTests || 'root';
    let parsed;
    try {
      parsed = parseSpec(readFileSync(full, 'utf8'));
    } catch {
      parsed = { describes: [], tests: [] };
    }
    const tags = [...new Set(parsed.tests.flatMap((t) => t.tags))];
    if (!features.has(key)) features.set(key, { key, name: featureName(key), files: [] });
    features.get(key).files.push({
      path: rel,
      name: path.basename(full).replace(/\.spec\.ts$/, ''),
      describe: parsed.describes[0] ?? '',
      tags,
      tests: parsed.tests,
    });
  }

  // Smoke first, then regression features, then the rest — the order people reach for.
  const rank = (k) => (k === 'smoke' ? 0 : k.startsWith('regression/volt-qc') ? 2 : k.startsWith('regression') ? 1 : 3);
  return [...features.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.name.localeCompare(b.name));
}
