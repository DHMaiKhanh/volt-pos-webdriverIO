/**
 * `npm run test:fresh` — chạy LẠI toàn bộ E2E test rồi mở dashboard.
 *
 * Khác với script gộp cũ `test:dashboard` (`npm test & npm run dashboard`):
 * script này chờ lane test chạy XONG HẲN (await exit) rồi mới mở viewer, và in
 * mốc tiến trình rõ ràng — nên bạn luôn biết test có thực sự chạy hay không,
 * thay vì nhìn nhầm vào số liệu cũ khi run mới chưa hoàn tất.
 *
 * Trình tự:
 *   1. npm run test:dev   → preflight + wdio (toàn bộ spec). DashboardReporter
 *                           ghi dashboard/public/data/history.json ở onComplete.
 *   2. npm run dashboard  → mở React viewer (http://localhost:4321), poll mỗi 5s.
 *
 * Dashboard CHỈ có điểm mới khi bước 1 kết thúc. Nếu preflight fail (exit != 0),
 * wdio không chạy → không có data mới; script vẫn mở viewer nhưng cảnh báo rõ.
 */

import { spawn } from 'node:child_process';

const line = (text = ''): void => console.log(text);

function run(script: string): Promise<number> {
  return new Promise((resolve) => {
    // shell:true để cmd.exe/sh phân giải `npm` + các script lồng nhau (&&).
    const child = spawn('npm', ['run', script], { stdio: 'inherit', shell: true });
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

async function main(): Promise<void> {
  line();
  line('='.repeat(78));
  line(' VOLT POS E2E — chạy lại TẤT CẢ test rồi mở dashboard');
  line('='.repeat(78));
  line(' [1/2]  Đang chạy toàn bộ E2E (ENV=dev)… có thể mất ~50 phút.');
  line();

  const code = await run('test:dev');

  line();
  line('-'.repeat(78));
  if (code === 0) {
    line(' [ OK ]  Lane test kết thúc — history.json đã được cập nhật.');
  } else {
    line(` [WARN]  Lane test thoát với mã ${String(code)}.`);
    line('         Nếu lỗi ở preflight thì wdio KHÔNG chạy → dashboard vẫn là số cũ.');
    line('         Kiểm tra: device 20258 đã đăng nhập chưa, driver/app path ổn chưa.');
  }
  line('-'.repeat(78));
  line(' [2/2]  Mở dashboard tại http://localhost:4321 (Ctrl+C để tắt viewer).');
  line();

  await run('dashboard');
}

await main();
