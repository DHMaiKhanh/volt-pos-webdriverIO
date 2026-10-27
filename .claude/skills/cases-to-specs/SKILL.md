---
name: cases-to-specs
description: Chuyển một file docs/screens/<screen>/<screen>-test-cases.md (thường do /scan-feature sinh ra) thành spec WebdriverIO, không bỏ sót TC nào. Dùng khi user nói "tạo spec / tự động hoá / port test case thành code" cho một màn.
argument-hint: '<path tới *-test-cases.md>'
---

# cases-to-specs

1. Liệt kê đủ TC: `node .claude/skills/cases-to-specs/scripts/tc-manifest.mjs $ARGUMENTS`
   (`--scaffold` in skeleton `.spec.ts`, mỗi TC một `it()`; ✅/⚠️ → implement, 🧱/📄 → PENDING).
2. Đọc `docs/writing-tests.md` + một spec cùng thư mục làm mẫu; dùng page object có sẵn trong
   `src/pages/**` (thêm method nếu thiếu), testid trong `src/constants/testids.ts`.
3. Title spec chứa TC id: `title('… (TC-<SCREEN>-NN)', Tag.REGRESSION, …)`. Không đánh số lại TC.
4. Đặt file ở `tests/regression/<screen>/`, chạy `npm run test:spec -- <file>` cho tới khi pass
   (hoặc PENDING có lý do), rồi báo kết quả.
