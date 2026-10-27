/**
 * `npm run test:failures` — chạy LẠI chỉ những spec FAIL ở lần chạy gần nhất.
 *
 * Đi kèm với lane bulk (`test:bulk`) chạy với SPEC_RETRIES=0: thay vì để mỗi
 * spec fail tự chạy lại 2-3 lần NGAY trong lúc quét 200+ spec (đốt timeout giữa
 * chừng, kéo dài cả run), ta để nó fail một lần, quét xong thật nhanh, rồi gom
 * đúng những file đỏ chạy lại một lượt ở đây. Lần hai thường chỉ còn một nhúm.
 *
 * Nguồn dữ liệu: dashboard/public/data/history.json — bản ghi DashboardReporter
 * ghi ở onComplete của mỗi lane. Lấy run mới nhất, nhặt mọi spec có totals.failed
 * > 0, đổi file:/// URL về đường dẫn repo-relative, rồi chạy lại qua lane bulk.
 *
 *   npm run test:failures            # in danh sách đỏ rồi chạy lại
 *   npm run test:failures -- --dry   # chỉ in, không chạy (để quyết định quarantine)
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Paths } from '../configs/constants/paths.js';

const HISTORY = path.join(Paths.DASHBOARD_DATA, 'history.json');
const BULK_CONF = path.join(Paths.CONFIGS, 'wdio', 'wdio.bulk.conf.ts');
const dryRun = process.argv.includes('--dry');

const line = (text = ''): void => console.log(text);

/** file:///D:/… hoặc đường dẫn tuyệt đối → tests/…/x.spec.ts (forward slash). */
function relSpec(file: string): string {
  const abs = file.startsWith('file:') ? fileURLToPath(file) : file;
  const rel = path.isAbsolute(abs) ? path.relative(Paths.ROOT, abs) : abs;
  return rel.replace(/\\/g, '/');
}

interface SpecEntry {
  file?: string;
  totals?: { failed?: number };
}
interface RunEntry {
  runId: string;
  finishedAt?: string;
  specs?: SpecEntry[];
}

function lastRun(): RunEntry | null {
  let runs: RunEntry[] = [];
  try {
    const parsed = JSON.parse(readFileSync(HISTORY, 'utf8')) as { runs?: RunEntry[] };
    runs = parsed.runs ?? [];
  } catch {
    return null;
  }
  if (runs.length === 0) return null;
  // Mới nhất theo finishedAt; fallback về phần tử cuối nếu thiếu mốc thời gian.
  return [...runs].sort((a, b) => (a.finishedAt ?? '').localeCompare(b.finishedAt ?? '')).at(-1) ?? null;
}

function failedSpecs(run: RunEntry): string[] {
  const files = (run.specs ?? [])
    .filter((s) => (s.totals?.failed ?? 0) > 0 && s.file)
    .map((s) => relSpec(s.file as string));
  return [...new Set(files)];
}

function rerun(specs: string[]): Promise<number> {
  return new Promise((resolve) => {
    // Chạy lại qua lane bulk (retry 0, không Allure). `--spec` nhận nhiều file.
    const specArgs = specs.flatMap((s) => ['--spec', s]);
    const args = ['wdio', 'run', BULK_CONF, ...specArgs];
    const child = spawn('npx', args, {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, ENV: process.env.ENV ?? 'dev', SPEC_RETRIES: '0' },
    });
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

async function main(): Promise<void> {
  const run = lastRun();
  if (!run) {
    line('[test:failures] Chưa có history.json — hãy chạy `npm run test:bulk` trước.');
    process.exit(1);
  }

  const specs = failedSpecs(run);
  line('='.repeat(78));
  line(` Lần chạy gần nhất: ${run.runId}`);
  line(` Spec FAIL: ${specs.length}`);
  line('-'.repeat(78));
  specs.forEach((s) => line(`   ${s}`));
  line('='.repeat(78));

  if (specs.length === 0) {
    line('Không có spec nào fail — không cần chạy lại.');
    return;
  }
  if (dryRun) {
    line('(--dry) Chỉ in danh sách. Thêm file đỏ do BUG APP vào configs/wdio/quarantine.ts');
    return;
  }

  line(`Chạy lại ${specs.length} spec qua lane bulk…\n`);
  const code = await rerun(specs);
  line(`\n[test:failures] wdio thoát với mã ${String(code)}.`);
  process.exit(code);
}

await main();
