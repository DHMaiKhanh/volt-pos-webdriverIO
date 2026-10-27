---
name: scan-feature
description: Quét/khám phá (exploratory test) một tính năng của app Volt POS ĐANG CHẠY mà không cần viết code — attach vào WebView2 qua CDP 9222, tự lái app (click/gõ/đọc màn hình), săn bug (lỗi JS, API 4xx/5xx, tính tiền sai, validate thiếu, UI vỡ), rồi xuất báo cáo bug + bảng test case TC-<SCREEN>-NN. Dùng khi user nói "quét / scan / test thử / tìm bug / khám phá / tạo test case cho màn X / tính năng X" của app POS.
argument-hint: '<tính năng hoặc yêu cầu tự do, vd: checkout giảm giá | order history search | settings staffs>'
---

# scan-feature — test tính năng bằng chat, không cần code

User chỉ mô tả tính năng muốn quét. Bạn tự lái app thật, tìm bug, viết test case.
Tham số: `$ARGUMENTS` (tính năng / phạm vi / ghi chú như "chỉ đọc", "sâu", "có thanh toán thật").

## 0. Kết nối app (luôn làm trước)

1. Kiểm tra CDP: `curl -s -m 3 http://127.0.0.1:9222/json/version`.
   - Không có → `npm run app:launch` (chạy nền, đợi tới khi port 9222 mở; ~30-90s).
   - App cài ở `%LOCALAPPDATA%\Volt POS\volt-pos.exe` nếu APP_PATH trống.
2. Chọn công cụ lái (theo thứ tự ưu tiên):
   - **MCP `volt-app`** (Playwright MCP `--cdp-endpoint 9222`, khai trong `.mcp.json`): tool
     `mcp__volt-app__browser_snapshot / _click / _type / _fill_form / _press_key /
_console_messages / _network_requests / _take_screenshot / _evaluate / _tabs`.
     Tìm bằng ToolSearch `+volt-app`. Dùng `browser_tabs` chọn tab POS chính (không phải `/customer/`).
   - **Fallback `cdp.mjs`** (zero-dep, bền với mọi version WebView2) khi MCP không attach được:
     ```
     node .claude/skills/scan-feature/scripts/cdp.mjs scan            # = snapshot (JSON field/nút/dialog)
     node .claude/skills/scan-feature/scripts/cdp.mjs click "Charge"
     node .claude/skills/scan-feature/scripts/cdp.mjs type "Customer name" "QA Test"
     node .claude/skills/scan-feature/scripts/cdp.mjs shot reports/scans/<x>/01.png
     node .claude/skills/scan-feature/scripts/cdp.mjs watch 30        # nghe lỗi JS + API lỗi 30s (chạy nền song song)
     node .claude/skills/scan-feature/scripts/cdp.mjs text | eval <file.js> | nav-home | targets
     ```
     Thêm `customer` làm tham số cuối để lái màn hình khách (dual-screen).
3. KHÔNG dùng MCP `playwright` thường (nó mở Chromium mới, không phải app) — cái đó cho web lane.

## 1. Chuẩn bị bối cảnh (nhanh)

- Đọc doc sẵn có: `docs/screens/<screen>/*-test-cases.md`, `docs/specs/`, `docs/screens/README.md`
  → biết TC đã có (không đánh số lại), tránh quét trùng.
- Đọc memory liên quan (passcode guard, preset keypad, gift card, tip màn khách…) — đó là các
  quirk đã biết, KHÔNG báo lại là bug mới; ghi "known" nếu gặp lại.
- Môi trường: tiệm đang đăng nhập (đọc trên màn hình), staff passcode trong `configs/env/.env.dev`.

## 2. Khám phá (exploratory loop)

Lặp: **snapshot → hiểu màn → hành động → snapshot lại → so kỳ vọng**. Với mỗi màn trong phạm vi:

1. Inventory: liệt kê mọi field, nút, tab, dialog, trạng thái disabled, testid (hoặc thiếu testid).
2. Happy path: đi hết luồng chính, ghi GIÁ TRỊ THẬT (số tiền, nhãn, số lượng, mã đơn).
3. Săn bug — áp checklist (chọn mục phù hợp, đừng bỏ qua phần tính tiền):
   - **Runtime**: console error / uncaught exception / request 4xx-5xx / request fail
     (MCP `browser_console_messages` + `browser_network_requests`, hoặc `cdp.mjs watch` chạy nền).
   - **Tính toán**: subtotal/tax/discount/tip/total/change cộng lại có khớp? làm tròn cent? % vs $?
     Tính tay rồi so với màn hình.
   - **Input**: rỗng, 0, âm, số rất lớn (99999999), thập phân 3 chữ số, ký tự đặc biệt/emoji,
     chuỗi 300 ký tự, dán khoảng trắng, SĐT/email sai định dạng.
   - **Trạng thái**: double-click nút submit (tạo trùng?), back/huỷ giữa chừng, mở lại sau khi lưu,
     reload (`browser_navigate` cùng URL) có mất dữ liệu?, nút disabled đúng lúc?
   - **Đồng bộ**: dữ liệu vừa tạo có hiện ở màn liên quan (order history, home, customer display)?
   - **UI**: text bị cắt/tràn, nhãn sai/chưa dịch, overlay che nút, toast sai nội dung, focus kẹt.
4. Mỗi nghi vấn → **tái hiện lần 2** trước khi ghi là bug. Chụp screenshot bằng chứng.
   Đọc text bằng snapshot/evaluate, không tin screenshot một mình (WebView2 hay render trễ).

### An toàn dữ liệu

- Mặc định được tạo/sửa/xoá dữ liệu test trên tiệm dev (user cho phép chạy liên tục, không hỏi).
- Tên dữ liệu test có tiền tố `QA-SCAN-<yyyymmdd>` để dễ dọn.
- Charge thẻ thật / refund / settle batch: chỉ khi `$ARGUMENTS` nói rõ ("có thanh toán thật"),
  nếu không thì dừng ở màn trước nút cuối và đánh 🧱.
- Nếu app đang ở ENV prod → chỉ đọc (read-only), không bấm nút ghi.
- Không nhập thẻ/mật khẩu thật nào; chỉ dùng giá trị test từ `.env.dev` / fixture.
- Dọn dẹp đơn nháp đã tạo khi xong (hoặc liệt kê chúng trong báo cáo nếu không xoá được).

## 3. Đầu ra (bắt buộc cả hai)

Thư mục phiên: `reports/scans/<yyyy-mm-dd>-<feature-slug>/` (screenshot `NN-<mô-tả>.png` ở đây).

**A. Báo cáo bug** — `reports/scans/<...>/bugs.md`, theo [references/bug-template.md](references/bug-template.md).
Mỗi bug: ID `BUG-<SCREEN>-NN`, mức độ, các bước tái hiện, kỳ vọng vs thực tế (giá trị thật),
bằng chứng (screenshot, console/network), tần suất (2/2), nghi gốc rễ. Tách riêng "Known/quirk" và
"Nghi vấn chưa chắc" — không trộn với bug đã tái hiện.

**B. Test case** — cập nhật/tạo `docs/screens/<screen>/<screen>-test-cases.md` theo
[references/output-template.md](references/output-template.md): append TC mới cuối bảng, ký hiệu
✅/⚠️/🧱/📄, giá trị quan sát thật. Mỗi bug đã xác nhận có ít nhất 1 TC regression trỏ tới nó.

## 4. Kết thúc

Trả lời user ngắn gọn (tiếng Việt): số màn đã quét, số TC mới, bảng bug (ID · mức độ · 1 dòng),
những gì chưa quét được và vì sao, link tới `bugs.md` + doc test case.
Nếu user muốn tự động hoá tiếp: gợi ý `/cases-to-specs <đường dẫn doc>` để sinh spec WebdriverIO.
