import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Mocha from 'mocha';
import { Paths } from '../../configs/constants/paths.js';
import { registry, titleKey, type SkipInfo } from '../../configs/reporters/liveRegistry.js';

/**
 * Give every runtime `this.skip()` a reason the GUI can show.
 *
 * The suite has ~1300 `if (…) this.skip()` guards and Mocha keeps none of their
 * context: a skip reaches the reporter as a bare `pending`. Patching
 * `Context.prototype.skip` records, at the moment of the call, the source line
 * that skipped (read from the stack), the comment its author left next to it,
 * and a plain-words reading of the condition — no spec has to change.
 *
 * A spec may still pass its own words: `this.skip('Tiệm chưa bật tip')`.
 */

type AnyRunnable = Mocha.Runnable & {
  type?: string;
  ctx?: { currentTest?: Mocha.Test };
  parent?: Mocha.Suite;
};

/** Known guard conditions → what they mean for whoever reads the run. */
const EXPLAIN: [RegExp, string][] = [
  [/CARD_SETTLE/, 'CARD_SETTLE chưa bật — test charge thẻ thật bị tắt (đặt CARD_SETTLE=1 trong .env.dev).'],
  [/REFUND_SETTLE/, 'REFUND_SETTLE chưa bật — test refund thật bị tắt (đặt REFUND_SETTLE=1).'],
  [/CHARGE_SETTLE/, 'CHARGE_SETTLE chưa bật — test thanh toán thật bị tắt (đặt CHARGE_SETTLE=1).'],
  [/SETTLE_ENABLED|SETTLE\b/, 'Cờ settle (giao dịch thật) chưa bật cho spec này.'],
  [/WRITE_ALLOWED|writeAllowed/, 'Đang chạy chế độ chỉ đọc (WRITE_ALLOWED=false) — test ghi dữ liệu bị bỏ.'],
  [/nearMidnight/, 'Đang gần nửa đêm — bỏ để đơn không rơi sang ngày hôm sau.'],
  [
    /fundedActiveGiftCards|GIFT_CARD|\bGC\(\)|giftCard/i,
    'Không có gift card test dùng được (thiếu mã hoặc hết số dư).',
  ],
  [
    /staff\w*\.length\s*<\s*(\d+)|visibleStaffCount\(\)\)\s*<\s*(\d+)/,
    'Tiệm không đủ thợ trên màn hình cho test này.',
  ],
  [/!\s*(staff|staffName)\b|staff\w*\.length\s*===\s*0/, 'Không tìm thấy thợ phù hợp trên màn hình.'],
  [/svc\w*\.length|service\w*\.length|names\.length/i, 'Không đủ dịch vụ/mục trong danh sách cho test này.'],
  [
    /openGate|gateProbe|passcode/i,
    'Không mở được màn bị khoá passcode (gate) — passcode sai hoặc màn không có.',
  ],
  [
    /isTipEnabled|tipIsPercent|completeUntilTipScreen|\btip/i,
    'Cài đặt tip của tiệm không khớp điều kiện test (tip tắt / không phải %).',
  ],
  [/ACTIVE_CODE|CODE\s*===\s*''|!\s*code\b/, 'Thiếu mã cần cho test (code/gift card) trong env hoặc data.'],
  [/!\s*db\b/, 'Không đọc được DB của app (bản build mã hoá) — test kiểm tra qua DB bị bỏ.'],
  [/turnValueCents/, 'Tiệm đang tắt Turn — test không bật Turn để tránh lưu $0.'],
  [/\bMODE\b|\battach|\blaunch|\blane\b/i, 'Lane chạy hiện tại (attach/launch) không hỗ trợ test này.'],
  [
    /!\s*(reached|hit|probe|first|d\.\w+)\b/,
    'Bước chuẩn bị trước đó không tới được trạng thái cần thiết (precondition).',
  ],
];

export function explainSkip(code: string, comment: string): string {
  for (const [re, text] of EXPLAIN) if (re.test(code)) return comment ? `${text} (${comment})` : text;
  if (comment) return comment;
  const cond = /if\s*\((.+)\)\s*\w*\.?skip/.exec(code)?.[1];
  return cond ? `Điều kiện tiên quyết không thoả: ${cond}` : 'Bị bỏ qua lúc chạy (this.skip()).';
}

interface Frame {
  file: string;
  line: number;
}

const toPath = (file: string): string => (file.startsWith('file:') ? fileURLToPath(file) : file);

/** First stack frame in the project's own code — the line that called skip. */
function callerFrame(stack: string): Frame | undefined {
  for (const raw of stack.split('\n').slice(1)) {
    const m = /\(?((?:file:\/\/\/?)?(?:[A-Za-z]:)?[^():]+\.(?:ts|mts|js|mjs)):(\d+):\d+\)?\s*$/.exec(
      raw.trim(),
    );
    if (!m) continue;
    const file = toPath(m[1]!);
    const norm = file.replace(/\\/g, '/');
    if (norm.includes('/node_modules/') || norm.endsWith('/skipReason.ts') || norm.includes('/node:'))
      continue;
    return { file, line: Number(m[2]) };
  }
  return undefined;
}

const sourceCache = new Map<string, string[]>();
function sourceLines(file: string): string[] {
  let lines = sourceCache.get(file);
  if (!lines) {
    try {
      lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    } catch {
      lines = [];
    }
    sourceCache.set(file, lines);
  }
  return lines;
}

/** The skipping line, a trailing `// …`, and the `//` block right above it. */
export function readSkipSite(file: string, line: number): { code: string; comment: string } {
  const lines = sourceLines(file);
  const at = lines[line - 1] ?? '';
  const trailing = /\/\/\s*(.+)$/.exec(at)?.[1]?.trim() ?? '';
  const above: string[] = [];
  for (let i = line - 2; i >= 0 && above.length < 4; i--) {
    const m = /^\s*(?:\/\/|\*)\s?(.*)$/.exec(lines[i] ?? '');
    if (!m) break;
    if (m[1]!.trim() && !m[1]!.startsWith('/')) above.unshift(m[1]!.trim());
  }
  const code = at.replace(/\/\/.*$/, '').trim();
  return { code, comment: trailing || above.join(' ') };
}

export const relToRepo = (file: string): string => path.relative(Paths.ROOT, file).replace(/\\/g, '/');

/** Who the skip covers: the test itself, the test a beforeEach was guarding, or a before-all's whole suite. */
function targetOf(runnable: AnyRunnable): string | undefined {
  if (runnable.type === 'hook') {
    const current = runnable.ctx?.currentTest;
    const eachHook = /"before each"/.test(runnable.title ?? '');
    if (eachHook && current) return current.fullTitle();
    return runnable.parent?.fullTitle();
  }
  return runnable.fullTitle();
}

function record(runnable: AnyRunnable, own: unknown, stack: string): void {
  const key = targetOf(runnable);
  if (!key) return;
  const frame = callerFrame(stack);
  const site = frame ? readSkipSite(frame.file, frame.line) : { code: '', comment: '' };
  const info: SkipInfo = {
    kind: 'runtime',
    text: typeof own === 'string' && own.trim() ? own.trim() : explainSkip(site.code, site.comment),
    ...(frame ? { where: `${relToRepo(frame.file)}:${String(frame.line)}` } : {}),
    ...(site.code ? { code: site.code } : {}),
    ...(site.comment ? { comment: site.comment } : {}),
  };
  registry().skips.set(titleKey(key), info);
}

const ctxProto = (Mocha as unknown as { Context: { prototype: Record<string, unknown> } }).Context.prototype;
const original = ctxProto.skip as ((this: Mocha.Context) => never) & { __voltPatched?: boolean };

if (!original.__voltPatched) {
  const patched = function skip(this: Mocha.Context, reason?: unknown): never {
    try {
      record(this.runnable(), reason, new Error().stack ?? '');
    } catch {
      // A reason is a convenience; the skip itself must always happen.
    }
    return original.call(this);
  };
  (patched as { __voltPatched?: boolean }).__voltPatched = true;
  ctxProto.skip = patched;
}
