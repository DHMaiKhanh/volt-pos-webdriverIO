---
name: tc-md-code-run
description: Quy trình trọn gói 3 bước cho 1 task Linear (VP-xxxx) hoặc 1 tính năng Volt POS — (1) tạo file test case .md, (2) code spec WebdriverIO cho từng TC, (3) chạy lại TẤT CẢ test case đã code và báo bảng PASS/FAIL. Dùng khi user nói "tạo file md + code + chạy test", "viết test case rồi tự động hoá rồi chạy lại", "làm đủ 3 bước cho VP-xxxx", "/tc-md-code-run", hoặc chỉ muốn chạy lại toàn bộ TC đã code của một ticket/màn.
argument-hint: '<VP-xxxx | URL Linear | tên tính năng> [chỉ bước: md | code | run]'
---

# tc-md-code-run — .md → code → chạy lại tất cả

Tham số: `$ARGUMENTS` = mã task / URL / tên tính năng, tuỳ chọn giới hạn bước (`md`, `code`, `run`).
Thiếu đối tượng → hỏi user, không đoán. Nếu file .md / spec đã có → **cập nhật**, không tạo bản trùng.

## Bước 1 — Tạo file test case `.md`

1. Đọc nguồn: task Linear (`get_issue` + `list_comments`, ảnh qua `extract_images`, PR dev nếu có)
   hoặc quét app thật theo skill `scan-feature` khi chỉ có tên tính năng.
2. Vị trí file:
   - Task VP: `docs/qc/volt-qc/vp-tickets/VP-<id>-<slug>-test-cases.md`
   - Theo màn: `docs/screens/<screen>/<screen>-test-cases.md`
3. Format theo mẫu `docs/qc/volt-qc/vp-tickets/VP-5195-customer-display-phone-reject-test-cases.md`:
   - Frontmatter: `title`, `ticket`, `sub-issues`, `spec-files`, `imported-at`, `updated-at` (ngày hôm nay).
   - Mục: Hành vi mong đợi → Điều kiện chung (env, merchant, data, biến env `VP<id>_*`) → bảng TC theo nhóm.
   - Cột bảng: `TC ID | Title | Priority | Precondition | Test Data | Steps | Expected Result | Status`.
   - TC ID `TC-VP<id>-NN` (hoặc `TC-<SCREEN>-NN`), đánh số liên tục, **không đánh số lại** TC cũ.
   - Status: ✅ tự động được · ⚠️ được, có điều kiện · 🧱 chưa tự động được (lý do) · 📄 chỉ tài liệu · 🐞 VP-xxxx bug đã log.
4. Kiểm tra parse được: `node .claude/skills/cases-to-specs/scripts/tc-manifest.mjs <file.md>`
   — số TC in ra phải khớp số dòng trong bảng.

## Bước 2 — Code spec

1. `node .claude/skills/cases-to-specs/scripts/tc-manifest.mjs <file.md> --scaffold` → skeleton, mỗi TC một `it()`.
2. Đọc `docs/writing-tests.md` + 1 spec cùng thư mục làm mẫu (vd `tests/regression/customer-display/vp-5195-phone-reject.spec.ts`
   - `vp-5195.helpers.ts`). Dùng page object `src/pages/**`, testid `src/constants/testids*.ts`; thiếu thì thêm method/testid, không hard-code selector trong spec.
3. Title chứa TC id: `title('… (TC-VP<id>-NN)', Tag.REGRESSION, …)`. ✅/⚠️ → implement thật; 🧱/📄 → `it.skip`/PENDING kèm lý do.
4. Đặt file ở `tests/regression/<feature>/vp-<id>-<slug>.spec.ts` (helper riêng: `vp-<id>.helpers.ts`).
   Ghi đường dẫn spec vào `spec-files` của .md.
5. `npm run typecheck` và `npm run lint` phải sạch trước khi chạy.

## Bước 3 — Chạy lại TẤT CẢ test case đã code

1. Trước khi chạy: kiểm tra build POS là **bản dev mới nhất** (memory `qc-always-latest-dev-build`), device đã đăng nhập.
2. Liệt kê mọi spec của ticket/màn: các path trong `spec-files` + `ls tests/regression/<feature>/*<id>*.spec.ts`.
3. Chạy cả cụm một lần (nền, có thể > 2 phút):
   `npm run test:spec -- <spec1> <spec2> …`
   Chỉ chạy lại các TC fail: `npm run test:failures` hoặc
   `npx cross-env ENV=dev wdio run configs/wdio/wdio.dev.conf.ts --spec <file> --mochaOpts.grep "TC-VP<id>-NN"`.
4. Phân loại từng TC fail:
   - **Lỗi spec** (selector, timing, data) → sửa spec, chạy lại TC đó.
   - **Lỗi app** → KHÔNG nới assertion cho pass; ghi 🐞 + mô tả, đề xuất tạo bug (skill `create-bug`) nếu user muốn.
5. Cập nhật cột Status + `updated-at` trong .md theo kết quả thật, rồi báo user:

| TC ID | Title | Kết quả | Ghi chú |
| ----- | ----- | ------- | ------- |

Kèm tổng `X PASS / Y FAIL / Z PENDING`, version POS đã test, lệnh đã chạy, đường dẫn .md + spec.
Không commit / không comment Linear trừ khi user yêu cầu.
