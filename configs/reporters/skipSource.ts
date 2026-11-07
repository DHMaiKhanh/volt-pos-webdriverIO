import fs from 'node:fs';
import path from 'node:path';
import { Paths } from '../constants/paths.js';
import type { SkipInfo } from './liveRegistry.js';

/** The whole error message (expect diffs span lines), ANSI colours stripped, capped. */
export function fullMessage(value?: string): string | undefined {
  const esc = String.fromCharCode(27);
  const text = (value ?? '')
    .split(esc)
    .map((part, i) => (i === 0 ? part : part.replace(/^\[[0-9;]*m/, '')))
    .join('')
    .trim();
  return text ? text.slice(0, 4000) : undefined;
}

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A skip no runtime call explains: look the test up in its spec source. Covers
 * `it.skip` / `xit`, a skipped `describe`, and `it('title')` with no body.
 */
export function staticSkip(title: string, fullTitle: string, file: string): SkipInfo {
  const src = file.replace(/^file:\/\/\/?/, '');
  let lines: string[] = [];
  try {
    lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
  } catch {
    /* source not readable — fall through to the generic reason */
  }
  const rel = path.relative(Paths.ROOT, src).replace(/\\/g, '/');
  const titleRe = new RegExp(`['"\`]${escapeRe(title.slice(0, 60))}`);
  const at = lines.findIndex((l) => titleRe.test(l));
  if (at >= 0) {
    const code = lines[at]!.trim();
    const where = `${rel}:${String(at + 1)}`;
    if (/(^|[^\w])(it|test)\.skip\(|(^|[^\w])xit\(/.test(code)) {
      return { kind: 'static', text: 'Test bị tắt trong code (it.skip) — cố ý không chạy.', where, code };
    }
    if (/\)\s*;?\s*$/.test(code) && !/=>|function|async/.test(code)) {
      return {
        kind: 'static',
        text: 'Test chưa viết (pending) — chỉ có tiêu đề, chưa có thân hàm.',
        where,
        code,
      };
    }
  }
  const suiteAt = lines.findIndex((l) => {
    if (!/(^|[^\w])(describe|context)\.skip\(|(^|[^\w])xdescribe\(/.test(l)) return false;
    const name = /['"`](.+?)['"`]/.exec(l)?.[1];
    return !!name && fullTitle.includes(name);
  });
  if (suiteAt >= 0) {
    return {
      kind: 'static',
      text: 'Cả nhóm test bị tắt trong code (describe.skip).',
      where: `${rel}:${String(suiteAt + 1)}`,
      code: lines[suiteAt]!.trim(),
    };
  }
  return {
    kind: 'unknown',
    text: 'Mocha đánh dấu bỏ qua nhưng không rõ nguồn (có thể run bị dừng / spec bị huỷ giữa chừng).',
  };
}
