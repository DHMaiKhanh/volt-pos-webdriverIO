---
name: test-result-summary
description: Báo kết quả lần chạy test E2E Volt POS gần nhất — bao nhiêu PASS, bao nhiêu FAIL, SKIP, pass rate, bảng từng TC kèm lỗi — đọc từ dashboard/public/data (latest.json + history.json). Lọc theo ticket/spec (VP-xxxx, tên màn), xem lần chạy cũ, hoặc gộp kết quả sau khi chạy lại test fail. Dùng khi user hỏi "kết quả chạy lại bao nhiêu pass bao nhiêu fail", "test vừa chạy thế nào", "tổng kết kết quả test VP-xxxx", "/test-result-summary".
argument-hint: '[VP-xxxx | tên spec/màn] [merge] [run N] [runs N]'
---

# test-result-summary — đếm PASS / FAIL của lần chạy test

Tham số `$ARGUMENTS`: tuỳ chọn mã ticket / chuỗi lọc, `merge`, `run N`, `runs N`.

## Cách làm

1. Chạy script (đọc `dashboard/public/data/*.json`, do DashboardReporter ghi sau mỗi lane `npm run test:*`):

   | User muốn                                         | Lệnh                                                                 |
   | ------------------------------------------------- | -------------------------------------------------------------------- |
   | Lần chạy gần nhất                                 | `node .claude/skills/test-result-summary/scripts/summary.mjs`        |
   | Chỉ 1 ticket / spec                               | `… summary.mjs --filter VP5195` (bỏ `-`, không phân biệt hoa thường) |
   | Sau khi đã chạy lại TC fail (kết quả cuối mỗi TC) | `… summary.mjs --merge --filter VP5195`                              |
   | Lần chạy cũ hơn                                   | `… summary.mjs --run 2` (1 = mới nhất)                               |
   | Xu hướng nhiều lần chạy                           | `… summary.mjs --runs 10 [--filter …]`                               |

   Có ticket cụ thể mà lần chạy gần nhất không chứa TC nào của ticket → dùng `--merge --filter`.
   `--merge` chỉ dùng kèm `--filter`, nếu không sẽ gộp cả suite cũ.

2. Kiểm tra lần chạy có đúng là lần user nói tới: xem dòng `Nguồn:` (thời điểm, env, mode).
   Thời điểm cũ hơn lần chạy user vừa làm → báo rằng reporter chưa ghi (lane chưa xong / chạy bằng lệnh không có DashboardReporter), không đoán số.

3. Trả lời user bằng tiếng Việt:
   - Dòng đầu: **X PASS / Y FAIL / Z SKIP** (trên N TC, pass rate %), thời điểm chạy, version app nếu biết.
   - Bảng TC (TC ID | Title | Kết quả | Lỗi ngắn). Nhiều TC → chỉ liệt kê FAIL + SKIP, PASS gộp một dòng.
   - Mỗi FAIL: một câu nhận định lỗi do **spec** (selector/timing/data) hay nghi **bug app**. Cần chi tiết → `--json` có `error`; stack đầy đủ trong `latest.json`.
   - Lệnh chạy lại các FAIL: `npm run test:failures` hoặc
     `npx cross-env ENV=dev wdio run configs/wdio/wdio.dev.conf.ts --spec <file> --mochaOpts.grep "TC-…"`.

Chỉ đọc và báo cáo: không sửa spec, không cập nhật file .md, không comment Linear trừ khi user yêu cầu.
